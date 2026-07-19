"""
ChromaDB-backed vector store for the knowledge base.
Each chunk is stored with its Sentence-Transformers embedding plus metadata
(document id / name) so retrieved matches can be traced back to a source doc.
"""
from functools import lru_cache

import chromadb

from app.config import settings
from app.rag.embeddings import embed_text, embed_texts


@lru_cache(maxsize=1)
def get_chroma_client() -> chromadb.ClientAPI:
    return chromadb.PersistentClient(path=settings.chroma_persist_dir)


def get_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=settings.chroma_collection_name,
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(document_id: str, document_name: str, chunks: list[str]) -> int:
    """Embed and upsert chunks for a document. Returns number of chunks indexed."""
    if not chunks:
        return 0
    collection = get_collection()
    embeddings = embed_texts(chunks)
    ids = [f"{document_id}-chunk-{i}" for i in range(len(chunks))]
    metadatas = [{"document_id": document_id, "document_name": document_name, "chunk_index": i} for i in range(len(chunks))]
    collection.upsert(ids=ids, embeddings=embeddings, documents=chunks, metadatas=metadatas)
    return len(chunks)


def delete_document_chunks(document_id: str) -> None:
    collection = get_collection()
    collection.delete(where={"document_id": document_id})


def reset_collection() -> None:
    """Wipe the ENTIRE vector store and recreate an empty collection --
    every chunk from every document, tracked or not.

    Why this exists: Chroma (a persistent on-disk store) and MongoDB
    (documents_col, what the Admin Dashboard's "Knowledge Base" tab
    actually reads) have no shared source of truth and no shared reset
    lifecycle. Deleting a document through the app's own DELETE endpoint
    cascades correctly (see documents.py), but ANY reset that bypasses that
    endpoint -- a manual `documents_col().delete_many({})`, dropping just
    the Mongo volume/container, restoring a Mongo backup, etc. -- leaves
    Chroma's embeddings sitting on disk completely untouched. The bot then
    keeps retrieving and citing documents an admin can no longer even see
    in the UI, because vector_query() only ever talks to Chroma, not Mongo.

    This is the escape hatch for that: nuke Chroma completely, and let the
    caller (see documents.py's /rebuild-index) re-embed strictly from
    whatever Mongo currently says exists. After that runs, Chroma is
    guaranteed to contain exactly what Mongo contains -- nothing orphaned,
    nothing missing.
    """
    client = get_chroma_client()
    try:
        client.delete_collection(name=settings.chroma_collection_name)
    except Exception:
        # Collection may not exist yet on a fresh install -- fine, the
        # get_or_create_collection() call below handles that case.
        pass
    client.get_or_create_collection(
        name=settings.chroma_collection_name,
        metadata={"hnsw:space": "cosine"},
    )


def query(query_text: str, n_results: int = 3) -> list[dict]:
    """Semantic similarity search. Returns list of {content, document_name, score}."""
    collection = get_collection()
    if collection.count() == 0:
        return []

    query_embedding = embed_text(query_text)
    n = min(n_results, collection.count())
    results = collection.query(query_embeddings=[query_embedding], n_results=n)

    hits = []
    docs = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]
    for content, meta, distance in zip(docs, metadatas, distances):
        hits.append({
            "content": content,
            "document_name": meta.get("document_name", "Unknown"),
            "score": 1 - distance,  # cosine distance -> similarity
        })
    return hits
