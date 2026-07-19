"""
Seeds demo data on first startup so the app is immediately usable:
- One admin account and one customer account
- Three sample knowledge base documents (chunked + embedded into Chroma)
- Default bot settings
Controlled by SEED_DEMO_DATA=true in .env.
"""
import uuid
from datetime import datetime, timezone

from app.config import settings as app_settings
from app.database import documents_col, notifications_col, settings_col, users_col
from app.models import BotSettings
from app.rag.document_loader import chunk_text
from app.rag.vector_store import add_chunks
from app.security import hash_password

SAMPLE_DOCS = [
    {
        "name": "Warranty Policy",
        "type": "policy",
        "content": (
            "SmartHome Hub Pro Limited Warranty Policy.\n\n"
            "Our company warrants the SmartHome Hub Pro against defects in materials and "
            "workmanship under normal consumer use for a period of one (1) year from the date "
            "of original retail purchase. This limited warranty applies only to hardware "
            "components of the product that are not subject to accident, misuse, neglect, fire, "
            "or other external causes, unauthorized use, alterations, or repair.\n\n"
            "During this warranty period, if a defect arises in the Device, we will, at our "
            "option, repair the Device using new or refurbished parts, replace the Device, or "
            "refund the purchase price. To obtain support or warranty service, contact us at "
            "support@smarthomepro.example.com or call 1-800-555-0199."
        ),
    },
    {
        "name": "Troubleshooting & Wifi Guide",
        "type": "manual",
        "content": (
            "SmartHome Hub Pro Wi-Fi and Network Troubleshooting Guide.\n\n"
            "If your SmartHome Hub Pro status light is flashing red or amber, it indicates a "
            "network connection error. The SmartHome Hub Pro ONLY supports 2.4GHz Wi-Fi "
            "networks; it does NOT support 5GHz bands.\n\n"
            "Power Cycle: Unplug the USB power cable, wait 15 seconds, then plug it back in. "
            "The status indicator light will glow solid blue once boot-up is complete "
            "(approx. 45 seconds).\n\n"
            "Factory Reset: Press and hold the pinhole RESET button for exactly 10 seconds. "
            "The status light will flash amber rapidly, confirming the reset."
        ),
    },
    {
        "name": "Return and Refund FAQ",
        "type": "faq",
        "content": (
            "SmartHome Hub Pro Returns, Exchange and Refund Policy.\n\n"
            "We offer a 30-day money-back guarantee for products purchased directly from our "
            "official online store. To qualify for a full refund: returns must be initiated "
            "within 30 days of delivery, the product must be returned in its original "
            "packaging with all accessories, and a valid RMA number is required (obtained by "
            "emailing returns@smarthomepro.example.com).\n\n"
            "Refunds are credited to the original payment method within 5-7 business days of "
            "our warehouse receiving the returned item."
        ),
    },
]


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

    if await documents_col().count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for sample in SAMPLE_DOCS:
            doc_id = f"doc-{uuid.uuid4().hex[:12]}"
            chunks = chunk_text(sample["content"])
            indexed = add_chunks(doc_id, sample["name"], chunks)
            await documents_col().insert_one({
                "id": doc_id,
                "name": sample["name"],
                "content": sample["content"],
                "type": sample["type"],
                "uploadedAt": now,
                "size": len(sample["content"].encode("utf-8")),
                "wordCount": len(sample["content"].split()),
                "chunkCount": indexed,
                "status": "indexed",
            })

    if await settings_col().count_documents({"_id": "singleton"}) == 0:
        default = BotSettings(
            chatbotName="SmartHelp AI",
            welcomeMessage=(
                "Hello! I am SmartHelp AI, your dedicated support assistant. I can help "
                "answer questions about our SmartHome Hub Pro, warranty, troubleshooting, "
                "and returns. How can I assist you today?"
            ),
            systemPrompt=(
                "You are SmartHelp AI, a helpful, polite, and technical customer support "
                "assistant for SmartHome Hub Pro. Answer the user's questions truthfully and "
                "accurately using ONLY the retrieved context. If the context does not contain "
                "the answer, politely explain that you don't have that specific information, "
                "and offer to raise a support ticket. Cite sources as [Document Name]."
            ),
        )
        await settings_col().insert_one({"_id": "singleton", **default.model_dump()})

    if await notifications_col().count_documents({}) == 0:
        await notifications_col().insert_one({
            "id": f"notif-{uuid.uuid4().hex[:10]}",
            "userId": None,  # global admin notification
            "type": "system",
            "title": "Welcome to SmartHelp AI",
            "message": "Your knowledge base has been seeded with 3 sample documents. Upload more from the Knowledge Base tab.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "read": False,
        })
