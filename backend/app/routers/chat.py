"""
Module 4: AI Chat Engine
Module 5: Retrieval-Augmented Generation (RAG)
Module 7: Feedback & Rating System
Module 8: Notification System (partial -- admin alerts on AI failure / escalation)
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.database import conversations_col, documents_col, notifications_col
from app.deps import CurrentUser, get_current_user, require_admin
from app.models import (
    AdminReplyRequest,
    Conversation,
    EscalateRequest,
    Message,
    NewChatRequest,
    RateRequest,
    SendMessageRequest,
    SuggestedQuestion,
)
from app.rag.chain import FailureReason, classify_category, generate_answer, generate_suggested_question
from app.rag.vector_store import query as vector_query
from app.routers.admin import get_bot_settings

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Admin-failure notifications (unchanged from previous fix)
# ---------------------------------------------------------------------------
_ADMIN_FAILURE_MESSAGES = {
    FailureReason.QUOTA_EXCEEDED: (
        "The AI provider(s) have hit their usage/billing quota. The chatbot "
        "is currently answering from the offline FAQ fallback only. "
        "Check provider billing/quota dashboards."
    ),
    FailureReason.AUTH_ERROR: (
        "The AI provider(s) rejected the configured API key(s) (invalid or "
        "revoked). The chatbot is currently answering from the offline FAQ "
        "fallback only. Check API keys in the environment configuration."
    ),
    FailureReason.OTHER: (
        "The AI provider(s) could not be reached (network/timeout/unknown "
        "error). The chatbot is currently answering from the offline FAQ "
        "fallback only. Check backend logs for the full exception."
    ),
    FailureReason.NOT_CONFIGURED: (
        "No AI provider API key is configured. The chatbot is running in "
        "offline FAQ fallback mode only."
    ),
}

_FAILURE_NOTIF_COOLDOWN_MIN = 15


async def _maybe_notify_admins_of_ai_failure(reason: FailureReason) -> None:
    cutoff = datetime.now(timezone.utc).timestamp() - _FAILURE_NOTIF_COOLDOWN_MIN * 60
    recent = await notifications_col().find_one(
        {
            "type": "ai_failure",
            "reason": reason.value,
            "timestamp": {"$gte": datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()},
        },
        {"_id": 0},
    )
    if recent:
        return

    notif = {
        "id": f"notif-{uuid.uuid4().hex[:10]}",
        "userId": None,
        "type": "ai_failure",
        "reason": reason.value,
        "title": "AI Chat Engine Degraded",
        "message": _ADMIN_FAILURE_MESSAGES[reason],
        "timestamp": _now(),
        "read": False,
    }
    await notifications_col().insert_one(notif)


# ---------------------------------------------------------------------------
# Fix #4 (grounding contradiction): RAG vector search always returns its
# top-N nearest chunks even when nothing is actually relevant -- that's
# inherent to nearest-neighbor search. So `sources` was previously set
# purely from "did we retrieve anything", not from "did the model actually
# use it". If the model's own answer says it doesn't have the information,
# we now suppress the source chips so the UI stops showing
# "ANSWERED USING: [Warranty Policy]" directly under a sentence that says
# the opposite.
# ---------------------------------------------------------------------------
_NO_MATCH_PATTERNS = (
    "i don't have that",
    "i do not have that",
    "not in the retrieved context",
    "not in the provided context",
    "i couldn't find",
    "i could not find",
    "no specific information",
    "don't have that specific information",
    "do not contain",
    "does not contain information",
)


def _looks_like_no_match(reply_text: str) -> bool:
    low = reply_text.lower()
    return any(p in low for p in _NO_MATCH_PATTERNS)


@router.get("")
async def list_conversations(user: CurrentUser = Depends(get_current_user)):
    query_filter = {} if user.role == "admin" else {"userId": user.id}
    cursor = conversations_col().find(query_filter, {"_id": 0}).sort("lastMessageAt", -1)
    return [doc async for doc in cursor]


# ---------------------------------------------------------------------------
# Fix #1: dynamic suggested questions, replacing the hardcoded frontend
# constant. Prefers real historical usage (what customers actually asked),
# falls back to titles of whatever is currently in the knowledge base, and
# only falls back to generic examples if there's neither yet -- so a fresh
# install for a completely different business never shows router/Wi-Fi
# questions that don't apply to it.
# ---------------------------------------------------------------------------
@router.get("/suggested-questions", response_model=list[SuggestedQuestion])
async def suggested_questions(user: CurrentUser = Depends(get_current_user)):
    # Fix: suggestions used to be derived from past chat history, which
    # drifted from reality the moment a document was deleted or replaced --
    # a question someone once typed kept showing up as "suggested" long
    # after the document that could answer it was gone. Chips are now
    # generated directly FROM each document's own content (see
    # generate_suggested_question in chain.py, called once at upload time
    # and cached on the document record as "suggestedQuestion"), so they
    # only ever reflect what's actually in the knowledge base right now.
    docs = [
        doc async for doc in
        documents_col().find({}, {"_id": 0, "id": 1, "name": 1, "content": 1, "suggestedQuestion": 1}).limit(4)
    ]

    if not docs:
        return [
            SuggestedQuestion(label='"How do I get started?"', query="How do I get started?"),
            SuggestedQuestion(label='"What are your support hours?"', query="What are your support hours?"),
            SuggestedQuestion(label='"How do I contact support?"', query="How do I contact a human agent?"),
            SuggestedQuestion(label='"What is your return policy?"', query="What is your return policy?"),
        ]

    results = []
    for d in docs:
        question = d.get("suggestedQuestion")
        if not question:
            # Lazy fallback for documents uploaded before this feature
            # existed (e.g. the seeded demo docs) -- generate once here
            # and cache it so subsequent requests don't regenerate it.
            question = generate_suggested_question(d["content"]) or f"Can you tell me about {d['name']}?"
            await documents_col().update_one({"id": d["id"]}, {"$set": {"suggestedQuestion": question}})
        results.append(SuggestedQuestion(label=f'"{question}"', query=question))

    return results


@router.post("/new")
async def create_conversation(payload: NewChatRequest, user: CurrentUser = Depends(get_current_user)):
    first_message = payload.firstMessage or ""
    title = (first_message[:30] + "...") if len(first_message) > 30 else (first_message or "New Support Chat")

    conv = Conversation(
        id=f"conv-{uuid.uuid4().hex[:12]}",
        userId=user.id,
        userName=user.name,
        title=title,
        startedAt=_now(),
        lastMessageAt=_now(),
        status="active",
        category="General Support",
        messages=[],
    )
    await conversations_col().insert_one(conv.model_dump())
    return conv.model_dump()


@router.post("/message")
async def send_message(payload: SendMessageRequest, user: CurrentUser = Depends(get_current_user)):
    conv_doc = await conversations_col().find_one({"id": payload.conversationId}, {"_id": 0})
    if not conv_doc:
        raise HTTPException(status_code=404, detail="Conversation not found")

    settings = await get_bot_settings()

    user_msg = Message(id=f"msg-{uuid.uuid4().hex[:10]}-u", sender="user", text=payload.text, timestamp=_now())
    conv_doc["messages"].append(user_msg.model_dump())
    conv_doc["lastMessageAt"] = _now()

    if conv_doc["title"] == "New Support Chat" or len(conv_doc["messages"]) == 1:
        conv_doc["title"] = (payload.text[:35] + "...") if len(payload.text) > 35 else payload.text

    # ---- Fix #3: once a human admin has joined this thread, stop the bot
    # from auto-replying over them. We still save the customer's message
    # (so the admin sees it and can respond from the dashboard), but skip
    # the RAG/LLM pipeline entirely. ----
    if conv_doc.get("humanHandling"):
        await conversations_col().replace_one({"id": conv_doc["id"]}, conv_doc)
        return {"conversation": conv_doc, "reply": None}

    # --- RAG retrieval ---
    context_text = ""
    sources: list[str] = []
    if settings.ragEnabled:
        hits = vector_query(payload.text, n_results=settings.maxSources)
        if hits:
            context_text = "\n\n".join(f"[Source: {h['document_name']}]\n{h['content']}" for h in hits)
            sources = list(dict.fromkeys(h["document_name"] for h in hits))

    # Recent chat history for context (last 5 messages before this one)
    history = [{"role": m["sender"] if m["sender"] == "user" else "bot", "text": m["text"]} for m in conv_doc["messages"][-6:-1]]
    history = [{"role": "user" if h["role"] == "user" else "assistant", "text": h["text"]} for h in history]

    bot_reply, used_ai, failure_reason = generate_answer(
        system_prompt=settings.systemPrompt,
        context=context_text,
        chat_history=history,
        user_text=payload.text,
        temperature=settings.temperature,
        language=payload.language or "en",
    )
    if not used_ai:
        bot_reply = bot_reply or settings.fallbackMessage
        if not sources:
            sources = ["Offline Help Center"]
        if failure_reason is not None:
            await _maybe_notify_admins_of_ai_failure(failure_reason)
    elif sources and _looks_like_no_match(bot_reply):
        # Fix #4: the model retrieved chunks but explicitly said it doesn't
        # have the answer -- don't show "ANSWERED USING" sources that
        # contradict the sentence right above them.
        sources = []

    # Auto-categorize on first exchange
    if len(conv_doc["messages"]) <= 3:
        category = classify_category(payload.text)
        if category:
            conv_doc["category"] = category

    bot_msg = Message(
        id=f"msg-{uuid.uuid4().hex[:10]}-b",
        sender="bot",
        text=bot_reply,
        timestamp=_now(),
        sources=sources or None,
    )
    conv_doc["messages"].append(bot_msg.model_dump())
    conv_doc["lastMessageAt"] = _now()

    await conversations_col().replace_one({"id": conv_doc["id"]}, conv_doc)

    return {"conversation": conv_doc, "reply": bot_msg.model_dump()}


# ---------------------------------------------------------------------------
# Fix #2 (part A): "Talk to a person" now has its own endpoint instead of
# faking a 1-star rating through /rate. It doesn't touch rating/feedback at
# all -- it only flags the conversation for human attention and notifies
# admins. The customer-visible thread stays exactly as it was; nothing
# resets, nothing gets overwritten.
# ---------------------------------------------------------------------------
@router.post("/escalate")
async def escalate_conversation(payload: EscalateRequest, user: CurrentUser = Depends(get_current_user)):
    conv_doc = await conversations_col().find_one({"id": payload.conversationId}, {"_id": 0})
    if not conv_doc:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv_doc["userId"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your conversation")

    if conv_doc["status"] == "active":
        conv_doc["status"] = "ticket_open"
    conv_doc["escalationReason"] = "user_requested"
    conv_doc["lastMessageAt"] = _now()
    await conversations_col().replace_one({"id": conv_doc["id"]}, conv_doc)

    notif = {
        "id": f"notif-{uuid.uuid4().hex[:10]}",
        "userId": None,
        "type": "escalation",
        "title": "Customer Requested a Human Agent",
        "message": f"\"{conv_doc['title']}\" ({conv_doc['userName']}) asked to talk to a person.",
        "timestamp": _now(),
        "read": False,
    }
    await notifications_col().insert_one(notif)

    return {"success": True, "conversation": conv_doc}


# ---------------------------------------------------------------------------
# Fix #3 (part B): lets an admin actually reply inside a conversation --
# previously the admin transcript view was read-only. Flips on
# `humanHandling` so the bot stops answering for this thread (see the check
# in send_message above), and notifies the customer that an agent replied.
# ---------------------------------------------------------------------------
@router.post("/admin-reply")
async def admin_reply(payload: AdminReplyRequest, admin: CurrentUser = Depends(require_admin)):
    conv_doc = await conversations_col().find_one({"id": payload.conversationId}, {"_id": 0})
    if not conv_doc:
        raise HTTPException(status_code=404, detail="Conversation not found")

    admin_msg = Message(
        id=f"msg-{uuid.uuid4().hex[:10]}-a",
        sender="admin",
        text=payload.text,
        timestamp=_now(),
    )
    conv_doc["messages"].append(admin_msg.model_dump())
    conv_doc["humanHandling"] = True
    conv_doc["assignedAdminName"] = admin.name
    conv_doc["lastMessageAt"] = _now()
    await conversations_col().replace_one({"id": conv_doc["id"]}, conv_doc)

    await notifications_col().insert_one({
        "id": f"notif-{uuid.uuid4().hex[:10]}-c",
        "userId": conv_doc["userId"],
        "type": "human_reply",
        "title": f"{admin.name} replied to your conversation",
        "message": f"An agent has joined \"{conv_doc['title']}\" and sent you a reply.",
        "timestamp": _now(),
        "read": False,
    })

    return {"success": True, "conversation": conv_doc}


# ---------------------------------------------------------------------------
# Fix #2 (part B): rating is now append-only history (`feedbackHistory`)
# instead of a single value that's frozen after first submit. `rating` /
# `feedbackText` on the conversation still hold the MOST RECENT values for
# backward compatibility with the existing analytics aggregation, but the
# full history is preserved so nothing is silently overwritten.
# ---------------------------------------------------------------------------
@router.post("/rate")
async def rate_conversation(payload: RateRequest, user: CurrentUser = Depends(get_current_user)):
    conv_doc = await conversations_col().find_one({"id": payload.conversationId}, {"_id": 0})
    if not conv_doc:
        raise HTTPException(status_code=404, detail="Conversation not found")

    settings = await get_bot_settings()

    if payload.rating is not None:
        conv_doc["rating"] = payload.rating
    if payload.feedbackText is not None:
        conv_doc["feedbackText"] = payload.feedbackText

    conv_doc.setdefault("feedbackHistory", []).append({
        "rating": payload.rating,
        "feedbackText": payload.feedbackText,
        "timestamp": _now(),
    })

    # Fix: previously admins were ONLY notified when a rating triggered
    # auto-escalation (<=2 stars). A normal rating, or a customer going
    # back and CHANGING an earlier rating, produced no notification at
    # all -- admins had no way to know feedback had come in (or been
    # updated) unless they happened to click into that exact conversation.
    if payload.rating is not None:
        is_update = len(conv_doc["feedbackHistory"]) > 1
        rating_notif_text = f"{conv_doc['userName']} rated \"{conv_doc['title']}\" {payload.rating}\u2605"
        if payload.feedbackText:
            rating_notif_text += f' \u2014 "{payload.feedbackText}"'
        await notifications_col().insert_one({
            "id": f"notif-{uuid.uuid4().hex[:10]}-r",
            "userId": None,
            "type": "rating",
            "title": "Customer Updated Their Rating" if is_update else "New Customer Rating",
            "message": rating_notif_text,
            "timestamp": _now(),
            "read": False,
        })

    if payload.rating is not None and payload.rating <= 2 and settings.autoTicketOnLowRating and conv_doc["status"] == "active":
        conv_doc["status"] = "ticket_open"
        conv_doc["escalationReason"] = "low_rating"
        notif = {
            "id": f"notif-{uuid.uuid4().hex[:10]}",
            "userId": None,
            "type": "ticket",
            "title": "Escalated to Support Ticket",
            "message": f"Chat \"{conv_doc['title']}\" rated {payload.rating} stars by {conv_doc['userName']}. Automatically created a support ticket.",
            "timestamp": _now(),
            "read": False,
        }
        await notifications_col().insert_one(notif)

        customer_notif = {
            "id": f"notif-{uuid.uuid4().hex[:10]}-c",
            "userId": conv_doc["userId"],
            "type": "ticket",
            "title": "We've opened a support ticket for you",
            "message": f"Based on your feedback on \"{conv_doc['title']}\", our support team will follow up shortly.",
            "timestamp": _now(),
            "read": False,
        }
        await notifications_col().insert_one(customer_notif)

    await conversations_col().replace_one({"id": conv_doc["id"]}, conv_doc)
    return {"success": True, "conversation": conv_doc}