"""
Module 8: Notification System -- customer-facing half.

Covers the fix where resolving a ticket now notifies the customer who owns
it, and that customers only ever see their own notifications (never each
other's, never the admin-only global feed).
"""
import app.routers.chat as chat_router


def _mock_rag(monkeypatch, reply="Mocked bot reply."):
    monkeypatch.setattr(chat_router, "vector_query", lambda *a, **kw: [])
    monkeypatch.setattr(chat_router, "generate_answer", lambda **kwargs: (reply, True))
    monkeypatch.setattr(chat_router, "classify_category", lambda *_: None)


def test_a_fresh_user_has_no_notifications(client, register_and_login):
    headers, _ = register_and_login()
    res = client.get("/api/notifications", headers=headers)
    assert res.status_code == 200
    assert res.json() == []


def test_resolving_a_ticket_notifies_the_customer_who_owns_it(client, register_and_login, admin_headers, monkeypatch):
    _mock_rag(monkeypatch)
    headers, _ = register_and_login()
    conv = client.post("/api/chat/new", json={"firstMessage": "hi"}, headers=headers)
    conv_id = conv.json()["id"]
    client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hi"}, headers=headers)
    # Low rating opens a ticket
    client.post("/api/chat/rate", json={"conversationId": conv_id, "rating": 1}, headers=headers)

    resolve = client.post(f"/api/admin/tickets/{conv_id}/resolve", headers=admin_headers)
    assert resolve.status_code == 200

    my_notifs = client.get("/api/notifications", headers=headers)
    assert my_notifs.status_code == 200
    assert any("resolved" in n["title"].lower() for n in my_notifs.json())


def test_customers_never_see_each_others_notifications(client, register_and_login, admin_headers, monkeypatch):
    _mock_rag(monkeypatch)
    headers_a, _ = register_and_login(email="notif-a@example.com")
    headers_b, _ = register_and_login(email="notif-b@example.com")

    conv = client.post("/api/chat/new", json={"firstMessage": "hi"}, headers=headers_a)
    conv_id = conv.json()["id"]
    client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hi"}, headers=headers_a)
    client.post("/api/chat/rate", json={"conversationId": conv_id, "rating": 1}, headers=headers_a)
    client.post(f"/api/admin/tickets/{conv_id}/resolve", headers=admin_headers)

    notifs_a = client.get("/api/notifications", headers=headers_a).json()
    notifs_b = client.get("/api/notifications", headers=headers_b).json()
    assert len(notifs_a) >= 1
    assert notifs_b == []


def test_customer_notifications_never_leak_into_the_admin_feed(client, register_and_login, admin_headers, monkeypatch):
    """The admin feed is global-only (userId=None) -- a customer's personal
    'ticket resolved' notification must not show up there."""
    _mock_rag(monkeypatch)
    headers, _ = register_and_login()
    conv = client.post("/api/chat/new", json={"firstMessage": "hi"}, headers=headers)
    conv_id = conv.json()["id"]
    client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hi"}, headers=headers)
    client.post("/api/chat/rate", json={"conversationId": conv_id, "rating": 1}, headers=headers)
    client.post(f"/api/admin/tickets/{conv_id}/resolve", headers=admin_headers)

    admin_notifs = client.get("/api/admin/notifications", headers=admin_headers).json()
    assert not any("resolved" in n["title"].lower() and "your" in n["title"].lower() for n in admin_notifs)


def test_mark_all_my_notifications_read(client, register_and_login, admin_headers, monkeypatch):
    _mock_rag(monkeypatch)
    headers, _ = register_and_login()
    conv = client.post("/api/chat/new", json={"firstMessage": "hi"}, headers=headers)
    conv_id = conv.json()["id"]
    client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hi"}, headers=headers)
    client.post("/api/chat/rate", json={"conversationId": conv_id, "rating": 1}, headers=headers)

    before = client.get("/api/notifications", headers=headers).json()
    assert any(not n["read"] for n in before)

    client.post("/api/notifications/read-all", headers=headers)
    after = client.get("/api/notifications", headers=headers).json()
    assert all(n["read"] for n in after)


def test_resolving_an_unknown_ticket_returns_404(client, admin_headers):
    res = client.post("/api/admin/tickets/conv-does-not-exist/resolve", headers=admin_headers)
    assert res.status_code == 404
