"""
Module 8: Notification System -- customer-facing half.

Separate from the admin notification endpoints in routers/admin.py on
purpose: those are global (userId=None) and admin-only. These are scoped to
`userId == current_user.id`, so a customer only ever sees notifications
meant for them (e.g. "your ticket was resolved") and never anyone else's.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.database import notifications_col
from app.deps import CurrentUser, get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_my_notifications(user: CurrentUser = Depends(get_current_user)):
    cursor = notifications_col().find({"userId": user.id}, {"_id": 0}).sort("timestamp", -1)
    return [doc async for doc in cursor]


@router.post("/read-all")
async def mark_all_mine_read(user: CurrentUser = Depends(get_current_user)):
    await notifications_col().update_many({"userId": user.id}, {"$set": {"read": True}})
    return {"success": True}


@router.post("/{notif_id}/read")
async def mark_one_mine_read(notif_id: str, user: CurrentUser = Depends(get_current_user)):
    result = await notifications_col().update_one(
        {"id": notif_id, "userId": user.id}, {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}
