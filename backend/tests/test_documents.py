"""
Module 3: Knowledge Base Management -- upload endpoint tests.

extract_text_from_pdf / chunk_text / add_chunks are mocked here so these
tests exercise the endpoint's own logic (auth, size limit, notification,
DB record) without needing a real PDF fixture or a real embedding model.
"""
import app.routers.documents as documents_router


def _mock_indexing(monkeypatch, chunk_count=2):
    monkeypatch.setattr(documents_router, "chunk_text", lambda text: ["chunk-a", "chunk-b"][:chunk_count])
    monkeypatch.setattr(documents_router, "add_chunks", lambda *a, **kw: chunk_count)


def test_upload_text_document_requires_admin(client, register_and_login):
    headers, _ = register_and_login()
    res = client.post(
        "/api/admin/documents/upload",
        data={"name": "Some FAQ", "content": "Some content here."},
        headers=headers,
    )
    assert res.status_code == 403


def test_upload_text_document_as_admin(client, admin_headers, monkeypatch):
    _mock_indexing(monkeypatch)
    res = client.post(
        "/api/admin/documents/upload",
        data={"name": "Some FAQ", "type": "faq", "content": "Some FAQ content about returns."},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Some FAQ"
    assert body["chunkCount"] == 2
    assert body["status"] == "indexed"


def test_upload_with_neither_file_nor_content_is_rejected(client, admin_headers, monkeypatch):
    _mock_indexing(monkeypatch)
    res = client.post("/api/admin/documents/upload", data={"name": "Empty"}, headers=admin_headers)
    assert res.status_code == 400


def test_upload_rejects_a_file_over_the_configured_size_limit(client, admin_headers, monkeypatch):
    """MAX_UPLOAD_MB is set to 1 in tests (see conftest.py), so a 2MB file
    should be rejected with 413 before any text extraction is attempted."""
    _mock_indexing(monkeypatch)
    oversized_content = b"a" * (2 * 1024 * 1024)  # 2MB

    res = client.post(
        "/api/admin/documents/upload",
        data={"name": "Huge File", "type": "manual"},
        files={"file": ("huge.txt", oversized_content, "text/plain")},
        headers=admin_headers,
    )
    assert res.status_code == 413


def test_upload_accepts_a_file_within_the_size_limit(client, admin_headers, monkeypatch):
    _mock_indexing(monkeypatch)
    small_content = b"Some perfectly reasonably sized document content."

    res = client.post(
        "/api/admin/documents/upload",
        data={"name": "Small File", "type": "manual"},
        files={"file": ("small.txt", small_content, "text/plain")},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text


def test_deleting_a_document_requires_admin(client, register_and_login):
    headers, _ = register_and_login()
    res = client.delete("/api/admin/documents/doc-123", headers=headers)
    assert res.status_code == 403


def test_deleting_an_unknown_document_returns_404(client, admin_headers):
    res = client.delete("/api/admin/documents/doc-does-not-exist", headers=admin_headers)
    assert res.status_code == 404
