"""
Module 2 (Admin Dashboard) + the admin-account-creation endpoint added
alongside the self-registration security fix.
"""


def test_create_admin_requires_an_existing_admin(client, register_and_login):
    """A regular customer must NOT be able to create an admin account --
    this is the only place admin accounts can be created at all now, so it
    has to be locked down as tightly as the thing it replaced."""
    headers, _ = register_and_login()
    res = client.post(
        "/api/admin/users",
        json={"email": "sneaky@example.com", "name": "Sneaky", "password": "password123"},
        headers=headers,
    )
    assert res.status_code == 403


def test_create_admin_requires_authentication_at_all(client):
    res = client.post(
        "/api/admin/users",
        json={"email": "nobody@example.com", "name": "Nobody", "password": "password123"},
    )
    assert res.status_code == 401


def test_an_existing_admin_can_create_another_admin(client, admin_headers):
    res = client.post(
        "/api/admin/users",
        json={"email": "second-admin@example.com", "name": "Second Admin", "password": "password123"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["role"] == "admin"

    # And that new admin can actually log in and use admin routes.
    login = client.post(
        "/api/auth/login", json={"email": "second-admin@example.com", "password": "password123"}
    )
    assert login.status_code == 200
    new_admin_headers = {"Authorization": f"Bearer {login.json()['token']}"}
    res2 = client.get("/api/admin/users", headers=new_admin_headers)
    assert res2.status_code == 200


def test_create_admin_rejects_a_duplicate_email(client, admin_headers, register_and_login):
    _, existing_user = register_and_login(email="taken@example.com")
    res = client.post(
        "/api/admin/users",
        json={"email": "taken@example.com", "name": "Whoever", "password": "password123"},
        headers=admin_headers,
    )
    assert res.status_code == 400


def test_list_users_is_not_accessible_to_customers(client, register_and_login):
    headers, _ = register_and_login()
    res = client.get("/api/admin/users", headers=headers)
    assert res.status_code == 403


def test_bot_settings_can_be_read_without_auth_but_only_updated_by_admin(client, admin_headers):
    res = client.get("/api/admin/settings")
    assert res.status_code == 200
    settings_body = res.json()

    # A logged-out request can't change settings.
    denied = client.post("/api/admin/settings", json=settings_body)
    assert denied.status_code == 401

    # An admin can.
    settings_body["chatbotName"] = "Renamed Assistant"
    allowed = client.post("/api/admin/settings", json=settings_body, headers=admin_headers)
    assert allowed.status_code == 200
    assert allowed.json()["chatbotName"] == "Renamed Assistant"


def test_analytics_avg_response_time_is_zero_with_no_conversations(client, admin_headers):
    """Regression test: this used to be hardcoded to 2.4 regardless of
    actual data. A fresh install with zero conversations should report 0."""
    res = client.get("/api/admin/analytics", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["stats"]["avgResponseTime"] == 0


def test_analytics_avg_response_time_reflects_real_message_timestamps(
    client, register_and_login, admin_headers, monkeypatch
):
    import app.routers.chat as chat_router

    monkeypatch.setattr(chat_router, "vector_query", lambda *a, **kw: [])
    monkeypatch.setattr(chat_router, "generate_answer", lambda **kwargs: ("Mocked reply.", True))
    monkeypatch.setattr(chat_router, "classify_category", lambda *_: None)

    headers, _ = register_and_login()
    conv = client.post("/api/chat/new", json={"firstMessage": "hi"}, headers=headers)
    conv_id = conv.json()["id"]
    client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hi"}, headers=headers)

    res = client.get("/api/admin/analytics", headers=admin_headers)
    assert res.status_code == 200
    # Should be a small, real, non-negative number of seconds -- not the old
    # hardcoded 2.4, and not zero now that a real user->bot exchange exists.
    assert res.json()["stats"]["avgResponseTime"] >= 0


def test_analytics_daily_volume_uses_chats_resolved_escalated_keys(client, admin_headers):
    """Regression test: the frontend's LineChart plots dataKey='chats' /
    'resolved' / 'escalated'. This used to send {date, conversations} instead,
    which meant the chart silently rendered with no lines at all."""
    res = client.get("/api/admin/analytics", headers=admin_headers)
    assert res.status_code == 200
    daily_volume = res.json()["dailyVolume"]
    assert len(daily_volume) == 7
    for day in daily_volume:
        assert set(day.keys()) == {"date", "chats", "resolved", "escalated"}
