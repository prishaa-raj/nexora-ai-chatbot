"""
Module 2: Admin Dashboard (settings, users)
Module 6: Analytics Dashboard
Module 8: Notification System
"""
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import conversations_col, documents_col, notifications_col, settings_col, users_col
from app.deps import CurrentUser, get_current_user, require_admin
from app.models import AdminCreateRequest, BotSettings, UserOut
from app.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])

SETTINGS_DOC_ID = "singleton"


async def get_bot_settings() -> BotSettings:
    doc = await settings_col().find_one({"_id": SETTINGS_DOC_ID})
    if not doc:
        default = BotSettings()
        await settings_col().insert_one({"_id": SETTINGS_DOC_ID, **default.model_dump()})
        return default
    doc.pop("_id", None)
    return BotSettings(**doc)


# ---------- Settings ----------
@router.get("/settings", response_model=BotSettings)
async def read_settings():
    return await get_bot_settings()


@router.post("/settings", response_model=BotSettings)
async def update_settings(payload: BotSettings, _: CurrentUser = Depends(require_admin)):
    await settings_col().update_one({"_id": SETTINGS_DOC_ID}, {"$set": payload.model_dump()}, upsert=True)
    return payload


# ---------- Users ----------
@router.get("/users")
async def list_users(_: CurrentUser = Depends(require_admin)):
    cursor = users_col().find({}, {"_id": 0, "password_hash": 0})
    return [doc async for doc in cursor]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_admin(payload: AdminCreateRequest, _: CurrentUser = Depends(require_admin)):
    """Create a new admin account. Only callable by an already-authenticated
    admin (enforced by require_admin) -- this is the ONLY way to create an
    admin account; public /api/auth/register can never do so."""
    existing = await users_col().find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

    user_doc = {
        "id": f"user-{uuid.uuid4().hex[:12]}",
        "email": payload.email.lower(),
        "name": payload.name,
        "role": "admin",
        "password_hash": hash_password(payload.password),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await users_col().insert_one(user_doc)
    return UserOut(id=user_doc["id"], email=user_doc["email"], name=user_doc["name"], role="admin")


# ---------- Analytics ----------
@router.get("/analytics")
async def analytics(_: CurrentUser = Depends(require_admin)):
    conversations = [doc async for doc in conversations_col().find({}, {"_id": 0})]
    documents = [doc async for doc in documents_col().find({}, {"_id": 0})]

    total_conversations = len(conversations)
    active_users = len({c["userId"] for c in conversations})
    ratings = [c["rating"] for c in conversations if c.get("rating")]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0
    positive = len([r for r in ratings if r >= 4])
    satisfaction = round((positive / len(ratings)) * 100, 1) if ratings else 0
    ticket_count = len([c for c in conversations if c["status"] in ("ticket_open", "ticket_resolved")])

    # Real average response time: seconds between each user message and the
    # bot reply that immediately follows it, averaged across every
    # conversation. Previously this was a hardcoded placeholder (2.4) --
    # this now reflects actual message timestamps, and is 0 when there is
    # no data yet (e.g. a fresh install with no conversations).
    response_time_seconds: list[float] = []
    for c in conversations:
        msgs = c.get("messages", [])
        for i in range(len(msgs) - 1):
            if msgs[i].get("sender") == "user" and msgs[i + 1].get("sender") == "bot":
                try:
                    t_user = datetime.fromisoformat(msgs[i]["timestamp"])
                    t_bot = datetime.fromisoformat(msgs[i + 1]["timestamp"])
                    response_time_seconds.append((t_bot - t_user).total_seconds())
                except Exception:
                    continue
    avg_response_time = round(sum(response_time_seconds) / len(response_time_seconds), 2) if response_time_seconds else 0

    stats = {
        "totalConversations": total_conversations,
        "activeUsers": active_users,
        "avgResponseTime": avg_response_time,
        "avgRating": avg_rating,
        "customerSatisfaction": satisfaction,
        "knowledgeBaseSize": len(documents),
        "ticketCount": ticket_count,
    }

    # Daily volume (last 7 days): chats started that day, plus how many
    # conversations were sitting in each status as of their last message
    # that day. This is an approximation -- we don't keep a separate status
    # change log, so "resolved"/"escalated" per day are inferred from
    # lastMessageAt rather than the exact moment the status changed. Good
    # enough to show a real trend; noted here so it isn't mistaken for
    # perfectly precise event tracking.
    started_by_day: Counter = Counter()
    resolved_by_day: Counter = Counter()
    escalated_by_day: Counter = Counter()
    for c in conversations:
        try:
            started_day = datetime.fromisoformat(c["startedAt"]).date().isoformat()
            started_by_day[started_day] += 1
        except Exception:
            pass
        try:
            last_day = datetime.fromisoformat(c["lastMessageAt"]).date().isoformat()
            if c["status"] == "ticket_resolved":
                resolved_by_day[last_day] += 1
            elif c["status"] == "ticket_open":
                escalated_by_day[last_day] += 1
        except Exception:
            pass

    today = datetime.now(timezone.utc).date()
    daily_volume = []
    for i in range(6, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        daily_volume.append({
            "date": day,
            "chats": started_by_day.get(day, 0),
            "resolved": resolved_by_day.get(day, 0),
            "escalated": escalated_by_day.get(day, 0),
        })

    # Ratings distribution
    ratings_dist = [{"rating": r, "count": len([x for x in ratings if x == r])} for r in range(1, 6)]

    # Categories
    cat_counts = Counter(c.get("category", "General Support") for c in conversations)
    categories = [{"name": k, "value": v} for k, v in cat_counts.items()]

    # Feedback logs
    #
    # Two bugs fixed here:
    # 1. The "feedback" (written comment) key was never actually included
    #    in this dict -- only "lastMessage" (the most recent CHAT message,
    #    not the rating comment) was set. The frontend reads `log.feedback`,
    #    which was therefore always undefined, so every card showed
    #    "No written comment left." regardless of what the customer wrote.
    # 2. "timestamp" used `lastMessageAt` -- the time of the last CHAT
    #    message, not the time the rating was actually submitted. Rating
    #    /api/chat/rate does NOT touch lastMessageAt, so re-rating an old,
    #    already-closed conversation left this timestamp stuck in the past
    #    and the entry never sorted to the top of "Recent Reviews" (which,
    #    also previously, wasn't sorted at all -- Mongo's natural order was
    #    used as-is).
    # Both are fixed by reading the actual rating timestamp from
    # feedbackHistory (added when rating became append-only/editable) and
    # sorting by it explicitly.
    feedback_logs = []
    for c in conversations:
        if not (c.get("feedbackText") or c.get("rating")):
            continue
        history = c.get("feedbackHistory") or []
        rated_at = history[-1]["timestamp"] if history else c.get("lastMessageAt")
        feedback_logs.append({
            "id": c["id"],
            "userName": c["userName"],
            "title": c.get("title"),
            "lastMessage": c["messages"][-1]["text"] if c.get("messages") else "",
            "feedback": c.get("feedbackText"),
            "timestamp": rated_at,
            "status": c["status"],
            "rating": c.get("rating"),
        })
    feedback_logs.sort(key=lambda x: x["timestamp"] or "", reverse=True)

    return {
        "stats": stats,
        "dailyVolume": daily_volume,
        "ratingsDist": ratings_dist,
        "categories": categories,
        "feedbackLogs": feedback_logs,
    }


# ---------- Notifications (admin-facing / global only) ----------
# Customer-facing, per-user notifications live in routers/notifications.py --
# these two are intentionally separate so a customer's personal "your ticket
# was resolved" message never shows up mixed into the admin bell, and vice
# versa. Global admin notifications are stored with userId=None.
@router.get("/notifications")
async def list_notifications(_: CurrentUser = Depends(require_admin)):
    cursor = notifications_col().find({"userId": None}, {"_id": 0}).sort("timestamp", -1)
    return [doc async for doc in cursor]


@router.post("/notifications/read-all")
async def mark_all_read(_: CurrentUser = Depends(require_admin)):
    await notifications_col().update_many({"userId": None}, {"$set": {"read": True}})
    return {"success": True}


@router.post("/notifications/{notif_id}/read")
async def mark_one_read(notif_id: str, _: CurrentUser = Depends(require_admin)):
    result = await notifications_col().update_one({"id": notif_id, "userId": None}, {"$set": {"read": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


# ---------- Tickets ----------
@router.post("/tickets/{conv_id}/resolve")
async def resolve_ticket(conv_id: str, _: CurrentUser = Depends(require_admin)):
    conv_doc = await conversations_col().find_one({"id": conv_id}, {"_id": 0})
    if not conv_doc:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await conversations_col().update_one({"id": conv_id}, {"$set": {"status": "ticket_resolved"}})

    # Notify the CUSTOMER, not the admin -- this was previously missing
    # entirely, so a customer had no way to know their ticket was resolved
    # short of re-opening the chat and noticing the status themselves.
    await notifications_col().insert_one({
        "id": f"notif-{uuid.uuid4().hex[:10]}",
        "userId": conv_doc["userId"],
        "type": "ticket",
        "title": "Your support ticket was resolved",
        "message": f"Good news -- \"{conv_doc['title']}\" has been marked resolved by our support team.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "read": False,
    })
    return {"success": True}