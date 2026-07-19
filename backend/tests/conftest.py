"""
Shared pytest fixtures for the whole test suite.

Key idea: nothing here talks to a real MongoDB, real ChromaDB persistence,
or a real LLM provider. Everything is mocked or swapped for an in-memory
equivalent, so `pytest` runs standalone with no external services and no
API keys -- exactly what you want in CI or before a viva demo.
"""
import asyncio
import os

# These MUST be set before anything under `app` is imported, because
# app/config.py builds its Settings() object at import time.
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("SEED_DEMO_DATA", "false")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("MAX_UPLOAD_MB", "1")  # small on purpose, see test_documents.py
os.environ.setdefault("RATE_LIMIT_AUTH", "10/minute")

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import app.database as database
from app.rate_limit import limiter
from app.security import hash_password


@pytest.fixture(autouse=True)
def mock_mongo(monkeypatch):
    """Replace the real Motor client with an in-memory mongomock-motor one
    for every test. Each test gets a fresh, empty database."""
    mock_client = AsyncMongoMockClient()
    mock_db = mock_client["test_db"]

    monkeypatch.setattr(database, "_client", mock_client)
    monkeypatch.setattr(database, "_db", mock_db)
    monkeypatch.setattr(database, "connect_to_mongo", lambda: None)
    monkeypatch.setattr(database, "close_mongo_connection", lambda: None)

    # slowapi's in-memory rate-limit counters persist for the life of the
    # process, not per-test -- reset them so one test's requests never
    # trip another test's rate limit.
    try:
        limiter.reset()
    except Exception:
        pass

    yield


@pytest.fixture()
def client(mock_mongo):
    """A TestClient with the app's real lifespan (startup/shutdown) run
    against the mocked database above."""
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def register_and_login(client):
    """Returns a helper that registers + logs in a fresh customer account
    and returns (auth_headers, user_dict)."""

    def _do(email="customer@example.com", name="Test Customer", password="password123"):
        res = client.post(
            "/api/auth/register",
            json={"email": email, "name": name, "password": password},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        headers = {"Authorization": f"Bearer {data['token']}"}
        return headers, data["user"]

    return _do


@pytest.fixture()
def admin_headers(client):
    """Seeds an admin account directly into the (mocked) database and logs
    in as them.

    This mirrors reality: since the security fix, there is no API path that
    creates the FIRST admin account -- that has to come from somewhere else
    (SEED_DEMO_DATA=true, a one-off DB insert, or an ops script). Tests seed
    it directly for the same reason a real deployment would.
    """

    async def _seed():
        await database.users_col().insert_one(
            {
                "id": "user-admin-test",
                "email": "admin-test@example.com",
                "name": "Test Admin",
                "role": "admin",
                "password_hash": hash_password("adminpass123"),
                "createdAt": "2026-01-01T00:00:00+00:00",
            }
        )

    asyncio.run(_seed())

    res = client.post(
        "/api/auth/login",
        json={"email": "admin-test@example.com", "password": "adminpass123"},
    )
    assert res.status_code == 200, res.text
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}
