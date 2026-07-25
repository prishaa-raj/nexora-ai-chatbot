"""
Seeds demo data on first startup so the app is immediately usable:
- One admin account and one customer account
- The real Nexora Technologies Knowledge Base (PDF, chunked + embedded into Chroma)
- Default bot settings
Controlled by SEED_DEMO_DATA=true in .env.
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings as app_settings
from app.database import documents_col, notifications_col, settings_col, users_col
from app.models import BotSettings
from app.rag.document_loader import chunk_text, extract_text_from_pdf
from app.rag.vector_store import add_chunks
from app.security import hash_password

# The single source-of-truth knowledge base document. Replaces the old
# hardcoded "SmartHome Hub Pro" demo docs (Warranty / Wifi / Refund FAQ) --
# this repo now seeds from the actual company PDF instead of placeholder
# sample content.
KB_PDF_PATH = Path(__file__).resolve().parent / "data" / "nexora_knowledge_base.pdf"
KB_DOC_NAME = "Nexora Technologies Knowledge Base"


async def seed_if_needed() -> None:
    if not app_settings.seed_demo_data:
        return

    if await users_col().count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        await users_col().insert_many([
            {
                "id": "user-admin-demo",
                "email": "admin@example.com",
                "name": "Alex Admin",
                "role": "admin",
                "password_hash": hash_password("admin123"),
                "createdAt": now,
            },
            {
                "id": "user-customer-demo",
                "email": "user@example.com",
                "name": "Jane Doe",
                "role": "user",
                "password_hash": hash_password("user123"),
                "createdAt": now,
            },
        ])

    if await documents_col().count_documents({}) == 0 and KB_PDF_PATH.exists():
        now = datetime.now(timezone.utc).isoformat()
        pdf_bytes = KB_PDF_PATH.read_bytes()
        text = extract_text_from_pdf(pdf_bytes)
        if text.strip():
            doc_id = f"doc-{uuid.uuid4().hex[:12]}"
            chunks = chunk_text(text)
            indexed = add_chunks(doc_id, KB_DOC_NAME, chunks)
            await documents_col().insert_one({
                "id": doc_id,
                "name": KB_DOC_NAME,
                "content": text,
                "type": "pdf",
                "uploadedAt": now,
                "size": len(text.encode("utf-8")),
                "wordCount": len(text.split()),
                "chunkCount": indexed,
                "status": "indexed",
            })

    if await settings_col().count_documents({"_id": "singleton"}) == 0:
        default = BotSettings(
            chatbotName="SmartHelp AI",
            welcomeMessage=(
                "Hello! I am SmartHelp AI, Nexora Technologies' assistant. I can help answer "
                "questions about our services, internship program, and projects. How can I "
                "assist you today?"
            ),
            systemPrompt=(
                "You are SmartHelp AI, Nexora Technologies' helpful, polite, and professional "
                "assistant. Answer the user's questions truthfully and accurately using ONLY "
                "the retrieved context from the Nexora Technologies Knowledge Base. Never "
                "invent facts, prices, dates, or policies that are not present in the context. "
                "If a figure in the context is marked as a placeholder (e.g. '[FILL IN: ...]'), "
                "do not state it -- instead direct the user to contactnexoratechs@gmail.com for "
                "the current, confirmed figure. If the context does not contain the answer at "
                "all, politely say so and direct the user to contactnexoratechs@gmail.com "
                "rather than guessing. Escalate account-specific issues (application, payment, "
                "or certificate status) to that same email. Cite sources as [Document Name]."
            ),
        )
        await settings_col().insert_one({"_id": "singleton", **default.model_dump()})

    if await notifications_col().count_documents({}) == 0:
        await notifications_col().insert_one({
            "id": f"notif-{uuid.uuid4().hex[:10]}",
            "userId": None,  # global admin notification
            "type": "system",
            "title": "Welcome to SmartHelp AI",
            "message": "Your knowledge base has been seeded with the Nexora Technologies Knowledge Base. Upload more from the Knowledge Base tab.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False,
        })