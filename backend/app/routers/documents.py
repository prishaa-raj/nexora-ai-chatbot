"""
Module 3: Knowledge Base Management
Handles PDF/text upload, chunking (LangChain splitter), and embedding into
ChromaDB via a hosted embedding API.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import settings
from app.database import documents_col, notifications_col
from app.deps import CurrentUser, require_admin
from app.models import DocType
from app.rag.document_loader import chunk_text, extract_text_from_pdf
from app.rag.chain import generate_suggested_question
from app.rag.vector_store import add_chunks, delete_document_chunks, reset_collection

router = APIRouter(prefix="/api/admin/documents", tags=["documents"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_documents(_: CurrentUser = Depends(require_admin)):
    cursor = documents_col().find({}, {"_id": 0})
    return [doc async for doc in cursor]


@router.post("/upload")
async def upload_document(
    name: str = Form(...),
    type: DocType = Form("faq"),
    content: str | None = Form(None),
    file: UploadFile | None = File(None),
    _: CurrentUser = Depends(require_admin),
):
    if file is not None:
        raw = await file.read()
        max_bytes = settings.max_upload_mb * 1024 * 1024
        if len(raw) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum upload size is {settings.max_upload_mb}MB.",
            )
        if file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
            text = extract_text_from_pdf(raw)
        else:
            text = raw.decode("utf-8", errors="ignore")
    elif content:
        text = content
    else:
        raise HTTPException(status_code=400, detail="Either a file or text content is required")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract any text from the provided document")

    doc_id = f"doc-{uuid.uuid4().hex[:12]}"

    # Chunking + embedding + the suggested-question LLM call are all
    # blocking, synchronous calls (network round-trips to Gemini/Groq/etc,
    # plus local Chroma writes). Running them directly here would freeze
    # this process's ONE event loop for the whole duration -- fine for a
    # couple of chunks, but with a real multi-page document (many more
    # chunks -> many more embedding calls) that freeze can run long enough
    # that Render's own health check stops getting a response and kills
    # the instance, well before this request ever gets a chance to finish
    # or even log anything. asyncio.to_thread() moves this work off the
    # event loop so the process (and other requests) stay responsive while
    # it runs.
    def _process() -> tuple[int, str | None]:
        chunks = chunk_text(text)
        indexed = add_chunks(doc_id, name, chunks)
        # Bug fix: suggested-question chips on the customer's empty chat
        # screen used to be pulled from past chat history, which meant they
        # kept showing questions that were no longer answerable once a
        # document was deleted or swapped out. Generating (and caching) one
        # directly from THIS document's own content means the chip is
        # always honestly tied to what's actually in the knowledge base
        # right now.
        question = generate_suggested_question(text)
        return indexed, question

    indexed_count, suggested_question = await asyncio.to_thread(_process)

    doc_record = {
        "id": doc_id,
        "name": name,
        "content": text,
        "type": type,
        "uploadedAt": _now(),
        "size": len(text.encode("utf-8")),
        "wordCount": len(text.split()),
        "chunkCount": indexed_count,
        "status": "indexed",
        "suggestedQuestion": suggested_question,
    }
    await documents_col().insert_one(doc_record)

    notif = {
        "id": f"notif-{uuid.uuid4().hex[:10]}-u",
        "userId": None,  # global admin notification
        "type": "upload",
        "title": "New Document Uploaded",
        "message": f'Document "{name}" was chunked into {indexed_count} segments and indexed in the knowledge base.',
        "timestamp": _now(),
        "read": False,
    }
    await notifications_col().insert_one(notif)

    doc_record.pop("_id", None)
    return doc_record


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, _: CurrentUser = Depends(require_admin)):
    result = await documents_col().delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    delete_document_chunks(doc_id)
    return {"success": True, "message": "Document deleted successfully"}


@router.post("/rebuild-index")
async def rebuild_index(_: CurrentUser = Depends(require_admin)):
    """Wipes the ENTIRE vector store and re-embeds every document currently
    in MongoDB from scratch.

    This is the fix for drift like: the Knowledge Base tab shows 0 (or N)
    documents, but the bot still retrieves and cites something that isn't
    in that list. That happens when Chroma (on-disk, its own lifecycle)
    and Mongo (documents_col, what the admin UI reads) fall out of sync --
    most commonly because something reset/restored Mongo without also
    clearing Chroma's persistent volume, leaving orphaned embeddings behind
    that vector_query() can still return.

    After this runs, Chroma is guaranteed to contain exactly what Mongo
    says exists right now -- nothing orphaned, nothing missing. Safe to
    run any time the two look like they've drifted; it's idempotent.
    """
    docs = [doc async for doc in documents_col().find({}, {"_id": 0})]

    def _process() -> list[tuple[str, int]]:
        reset_collection()
        results = []
        for doc in docs:
            chunks = chunk_text(doc["content"])
            indexed = add_chunks(doc["id"], doc["name"], chunks)
            results.append((doc["id"], indexed))
        return results

    results = await asyncio.to_thread(_process)
    total_chunks = 0
    for doc_id, indexed in results:
        total_chunks += indexed
        await documents_col().update_one({"id": doc_id}, {"$set": {"chunkCount": indexed}})

    return {
        "success": True,
        "documentsReindexed": len(docs),
        "chunksIndexed": total_chunks,
    }