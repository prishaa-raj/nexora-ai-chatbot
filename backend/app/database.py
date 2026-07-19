"""
MongoDB connection layer using Motor (async driver).
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def connect_to_mongo() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongo_uri)
    _db = _client[settings.mongo_db_name]


def close_mongo_connection() -> None:
    global _client
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongo() first.")
    return _db


# Convenience collection accessors -------------------------------------------------

def users_col():
    return get_db()["users"]


def conversations_col():
    return get_db()["conversations"]


def documents_col():
    return get_db()["documents"]


def notifications_col():
    return get_db()["notifications"]


def settings_col():
    return get_db()["bot_settings"]
