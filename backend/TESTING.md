# Running the test suite

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest -v
```

No real MongoDB, ChromaDB, or LLM API key is needed to run these -- everything
external is mocked or swapped for an in-memory equivalent (see
`tests/conftest.py` and the top of `tests/test_rag.py`).

## What's covered

- `test_security.py` -- password hashing, JWT issuance/verification (tampering, wrong secret, expiry)
- `test_auth.py` -- register/login, and specifically the fix that stops public
  registration from creating admin accounts, plus the auth rate limit
- `test_admin.py` -- the protected admin-creation endpoint, and that only an
  admin can reach admin-only routes
- `test_rag.py` -- document chunking, vector store add/query/delete round-trip,
  and the Gemini→OpenAI→offline-fallback chain in `rag/chain.py`
- `test_chat.py` -- conversation creation, sending a message (RAG mocked),
  per-role conversation visibility, and the auto-ticket-on-low-rating flow
- `test_documents.py` -- knowledge base upload, including the new max-upload-size
  rejection

## What's intentionally NOT covered yet

- Real PDF text extraction (`extract_text_from_pdf`) -- needs a real sample PDF
  fixture, which wasn't available to generate here. Worth adding a small
  `tests/fixtures/sample.pdf` and a test around it if you have time.
- Real calls to Gemini/OpenAI or the real Sentence-Transformers model -- these
  are deliberately mocked everywhere so the suite runs fast, offline, and
  deterministically. If you want a small number of true end-to-end tests
  against a real (test) API key, keep them in a separate marked group so the
  main suite still runs without one.
- Analytics endpoint (`/api/admin/analytics`) and notification read/resolve
  routes -- straightforward to add following the same pattern as `test_admin.py`
  if you want fuller coverage before submission.

I wrote and syntax-checked all of these (`python -m py_compile`), but I was not
able to actually execute `pytest` in this environment -- no network access
here to install FastAPI/Chroma/mongomock-motor. Please run the suite yourself
once before relying on it; if anything doesn't pass, the failure output will
usually point straight at a fixture/mock mismatch, which is easy to fix.
