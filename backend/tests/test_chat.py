"""
Module 4 (AI Chat Engine) + Module 5 (RAG) + Module 7 (Feedback/Rating)
endpoint tests.

The router imports generate_answer / classify_category / vector_query by
name, so they're patched on app.routers.chat directly rather than on the
original app.rag modules -- patching the original wouldn't affect the
already-bound names in chat.py.
"""
import app.routers.chat as chat_router


def _mock_rag(monkeypatch, reply="Mocked bot reply.", sources=None, category=None):
    monkeypatch.setattr(chat_router, "vector_query", lambda *a, **kw: sources or [])
    monkeypatch.setattr(
        chat_router, "generate_answer", lambda **kwargs: (reply, True)
    )
    monkeypatch.setattr(chat_router, "classify_category", lambda *_: category)


def test_create_conversation_and_send_a_message(client, register_and_login, monkeypatch):
    _mock_rag(monkeypatch, reply="The warranty lasts one year.")
    headers, _ = register_and_login()

    conv = client.post("/api/chat/new", json={"firstMessage": "How long is the warranty?"}, headers=headers)
    assert conv.status_code == 200
    conv_id = conv.json()["id"]

    res = client.post(
        "/api/chat/message",
        json={"conversationId": conv_id, "text": "How long is the warranty?"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["reply"]["text"] == "The warranty lasts one year."
    assert body["reply"]["sender"] == "bot"
    assert len(body["conversation"]["messages"]) == 2  # user message + bot reply


def test_sending_a_message_to_an_unknown_conversation_returns_404(client, register_and_login, monkeypatch):
    _mock_rag(monkeypatch)
    headers, _ = register_and_login()
    res = client.post(
        "/api/chat/message", json={"conversationId": "conv-does-not-exist", "text": "hi"}, headers=headers
    )
    assert res.status_code == 404


def test_customers_only_see_their_own_conversations(client, register_and_login, monkeypatch):
    _mock_rag(monkeypatch)
    headers_a, _ = register_and_login(email="a@example.com")
    headers_b, _ = register_and_login(email="b@example.com")

    client.post("/api/chat/new", json={"firstMessage": "A's question"}, headers=headers_a)
    client.post("/api/chat/new", json={"firstMessage": "B's question"}, headers=headers_b)

    res_a = client.get("/api/chat", headers=headers_a)
    assert res_a.status_code == 200
    assert len(res_a.json()) == 1
    assert res_a.json()[0]["userName"]  # sanity: has a user attached


def test_admin_sees_every_conversation(client, register_and_login, admin_headers, monkeypatch):
    _mock_rag(monkeypatch)
    headers_a, _ = register_and_login(email="a2@example.com")
    headers_b, _ = register_and_login(email="b2@example.com")
    client.post("/api/chat/new", json={"firstMessage": "one"}, headers=headers_a)
    client.post("/api/chat/new", json={"firstMessage": "two"}, headers=headers_b)

    res = client.get("/api/chat", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 2


def test_offline_fallback_reply_is_used_when_no_ai_provider_is_reachable(client, register_and_login, monkeypatch):
    """Mirrors generate_answer's real fallback contract (used_ai=False), and
    checks the router substitutes the configured fallback message."""
    monkeypatch.setattr(chat_router, "vector_query", lambda *a, **kw: [])
    monkeypatch.setattr(chat_router, "generate_answer", lambda **kwargs: ("", False))
    monkeypatch.setattr(chat_router, "classify_category", lambda *_: None)

    headers, _ = register_and_login()
    conv = client.post("/api/chat/new", json={"firstMessage": "hello"}, headers=headers)
    conv_id = conv.json()["id"]

    res = client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hello"}, headers=headers)
    assert res.status_code == 200
    body = res.json()
    # Router falls back to settings.fallbackMessage when used_ai is False.
    assert body["reply"]["sources"] == ["Offline Help Center"]


def test_low_rating_automatically_opens_a_support_ticket(client, register_and_login, admin_headers, monkeypatch):
    _mock_rag(monkeypatch)
    headers, _ = register_and_login()
    conv = client.post("/api/chat/new", json={"firstMessage": "hi"}, headers=headers)
    conv_id = conv.json()["id"]
    client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hi"}, headers=headers)

    res = client.post("/api/chat/rate", json={"conversationId": conv_id, "rating": 1}, headers=headers)
    assert res.status_code == 200
    assert res.json()["conversation"]["status"] == "ticket_open"

    notifs = client.get("/api/admin/notifications", headers=admin_headers)
    assert notifs.status_code == 200
    assert any(n["type"] == "ticket" for n in notifs.json())


def test_a_good_rating_does_not_open_a_ticket(client, register_and_login, monkeypatch):
    _mock_rag(monkeypatch)
    headers, _ = register_and_login()
    conv = client.post("/api/chat/new", json={"firstMessage": "hi"}, headers=headers)
    conv_id = conv.json()["id"]
    client.post("/api/chat/message", json={"conversationId": conv_id, "text": "hi"}, headers=headers)

    res = client.post("/api/chat/rate", json={"conversationId": conv_id, "rating": 5}, headers=headers)
    assert res.status_code == 200
    assert res.json()["conversation"]["status"] == "active"
