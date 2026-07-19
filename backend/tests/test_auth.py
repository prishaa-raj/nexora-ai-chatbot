"""
Module 1: User Authentication -- endpoint tests.

Covers the normal register/login flow AND the security fix from this
project: public registration can never create an admin account.
"""


def test_register_creates_a_user_and_returns_a_token(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "name": "New Person", "password": "password123"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user"]["email"] == "new@example.com"
    assert body["user"]["role"] == "user"
    assert body["token"]


def test_register_rejects_a_duplicate_email(client):
    payload = {"email": "dupe@example.com", "name": "First", "password": "password123"}
    first = client.post("/api/auth/register", json=payload)
    assert first.status_code == 200

    second = client.post("/api/auth/register", json={**payload, "name": "Second"})
    assert second.status_code == 400


def test_register_ignores_a_client_supplied_role_field(client):
    """The actual security fix: even if a client sends role=admin, the
    account that gets created is a regular user. This is the regression
    test for the vulnerability that was found and patched."""
    res = client.post(
        "/api/auth/register",
        json={
            "email": "wannabe-admin@example.com",
            "name": "Wannabe Admin",
            "password": "password123",
            "role": "admin",  # extra field the schema doesn't even declare
        },
    )
    assert res.status_code == 200, res.text
    assert res.json()["user"]["role"] == "user"


def test_login_succeeds_with_correct_credentials(client):
    client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "name": "Login Test", "password": "password123"},
    )
    res = client.post("/api/auth/login", json={"email": "login@example.com", "password": "password123"})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "login@example.com"


def test_login_fails_with_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={"email": "login2@example.com", "name": "Login Test", "password": "password123"},
    )
    res = client.post("/api/auth/login", json={"email": "login2@example.com", "password": "wrong-password"})
    assert res.status_code == 401


def test_login_fails_for_an_email_that_was_never_registered(client):
    res = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "whatever"})
    assert res.status_code == 401


def test_a_protected_route_rejects_a_request_with_no_token(client):
    res = client.get("/api/chat")
    assert res.status_code == 401


def test_a_protected_route_rejects_a_garbage_token(client):
    res = client.get("/api/chat", headers={"Authorization": "Bearer not-a-real-token"})
    assert res.status_code == 401


def test_admin_only_route_rejects_a_regular_user(client, register_and_login):
    headers, _ = register_and_login()
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 403


def test_admin_only_route_accepts_an_admin(client, admin_headers):
    res = client.get("/api/admin/users", headers=admin_headers)
    assert res.status_code == 200


def test_repeated_failed_logins_are_rate_limited(client):
    """RATE_LIMIT_AUTH is set to 10/minute in tests (see conftest.py).
    The 11th request in a minute from the same client should be rejected
    before it even checks credentials."""
    last_status = None
    for _ in range(11):
        res = client.post("/api/auth/login", json={"email": "nope@example.com", "password": "wrong"})
        last_status = res.status_code
    assert last_status == 429
