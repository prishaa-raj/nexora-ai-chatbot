"""
Module 3 (Knowledge Base) + Module 5 (RAG) unit tests.

Embeddings and the Chroma client are swapped for fast, deterministic fakes
so these tests run in milliseconds and never need to download the real
Sentence-Transformers model or hit a real vector DB file on disk.
"""
import chromadb
import pytest

from app.rag import document_loader, vector_store, embeddings


def _fake_embed_text(text: str) -> list[float]:
    # Not semantically meaningful -- just numeric and deterministic, which
    # is all Chroma needs to store/retrieve consistently in these tests.
    return [float(len(text) % 7), float(sum(map(ord, text[:12])) % 17), 1.0]


def _fake_embed_texts(texts: list[str]) -> list[list[float]]:
    return [_fake_embed_text(t) for t in texts]


@pytest.fixture(autouse=True)
def isolated_vector_store(monkeypatch):
    """Every test gets a brand-new in-memory Chroma client and fake
    embeddings, so tests can't see each other's indexed documents."""
    monkeypatch.setattr(embeddings, "embed_text", _fake_embed_text)
    monkeypatch.setattr(embeddings, "embed_texts", _fake_embed_texts)
    # vector_store.py imported these names directly, so the module-local
    # references need patching too, not just the embeddings module.
    monkeypatch.setattr(vector_store, "embed_text", _fake_embed_text)
    monkeypatch.setattr(vector_store, "embed_texts", _fake_embed_texts)

    fresh_client = chromadb.EphemeralClient()
    monkeypatch.setattr(vector_store, "get_chroma_client", lambda: fresh_client)
    yield


# ---------- document_loader ----------

def test_chunk_text_splits_long_text_into_multiple_chunks():
    long_text = "This sentence describes the SmartHome Hub Pro warranty policy in detail. " * 40
    chunks = document_loader.chunk_text(long_text)
    assert len(chunks) > 1
    assert all(len(c) > 20 for c in chunks)


def test_chunk_text_returns_empty_list_for_blank_input():
    assert document_loader.chunk_text("   ") == []


def test_chunk_text_drops_fragments_of_20_characters_or_less():
    assert document_loader.chunk_text("hi") == []


# ---------- vector_store ----------

def test_add_chunks_returns_the_number_of_chunks_indexed():
    chunks = ["The hub only supports 2.4GHz Wi-Fi networks.", "Warranty covers manufacturing defects for one year."]
    indexed = vector_store.add_chunks("doc-1", "Test Guide", chunks)
    assert indexed == 2


def test_add_chunks_with_no_chunks_indexes_nothing():
    assert vector_store.add_chunks("doc-empty", "Empty Doc", []) == 0


def test_query_finds_previously_added_chunks_and_attributes_the_source():
    vector_store.add_chunks("doc-2", "Wifi Guide", ["The hub only supports 2.4GHz Wi-Fi networks."])
    hits = vector_store.query("wifi network", n_results=3)
    assert len(hits) > 0
    assert all(h["document_name"] == "Wifi Guide" for h in hits)
    assert all("content" in h and "score" in h for h in hits)


def test_query_against_an_empty_store_returns_no_hits():
    assert vector_store.query("anything at all") == []


def test_delete_document_chunks_removes_them_from_future_searches():
    vector_store.add_chunks("doc-3", "Refund Policy", ["Refunds are issued within 5-7 business days."])
    assert vector_store.query("refund") != []

    vector_store.delete_document_chunks("doc-3")
    assert vector_store.query("refund") == []


# ---------- rag.chain (LLM orchestration) ----------

class _FakeResponse:
    def __init__(self, content):
        self.content = content


class _FakeLLM:
    def __init__(self, content):
        self._content = content

    def bind(self, **_kwargs):
        return self

    def invoke(self, _messages):
        return _FakeResponse(self._content)


class _FailingLLM:
    def bind(self, **_kwargs):
        return self

    def invoke(self, _messages):
        raise RuntimeError("provider unreachable")


def test_generate_answer_falls_back_to_a_canned_message_with_no_provider_configured():
    from app.rag import chain

    reply, used_ai = chain.generate_answer(
        system_prompt="You are helpful.", context="", chat_history=[], user_text="Hello"
    )
    assert used_ai is False
    assert "No AI provider" in reply


def test_generate_answer_uses_gemini_when_available(monkeypatch):
    from app.rag import chain

    monkeypatch.setattr(chain, "_get_gemini_llm", lambda: _FakeLLM("Mocked Gemini answer"))
    monkeypatch.setattr(chain, "_get_openai_llm", lambda: _FakeLLM("Should never be reached"))

    reply, used_ai = chain.generate_answer(
        system_prompt="sp", context="ctx", chat_history=[], user_text="What's the warranty period?"
    )
    assert used_ai is True
    assert reply == "Mocked Gemini answer"


def test_generate_answer_falls_back_to_openai_when_gemini_errors(monkeypatch):
    from app.rag import chain

    monkeypatch.setattr(chain, "_get_gemini_llm", lambda: _FailingLLM())
    monkeypatch.setattr(chain, "_get_openai_llm", lambda: _FakeLLM("OpenAI covered it"))

    reply, used_ai = chain.generate_answer(
        system_prompt="sp", context="", chat_history=[], user_text="hi"
    )
    assert used_ai is True
    assert reply == "OpenAI covered it"


def test_classify_category_returns_none_with_no_provider_configured():
    from app.rag import chain

    assert chain.classify_category("My hub won't connect to Wi-Fi") is None


def test_classify_category_returns_a_valid_category_from_a_mocked_llm(monkeypatch):
    from app.rag import chain

    monkeypatch.setattr(chain, "_get_gemini_llm", lambda: _FakeLLM("Wi-Fi Connectivity"))
    result = chain.classify_category("My hub won't connect to Wi-Fi")
    assert result == "Wi-Fi Connectivity"


def test_classify_category_ignores_a_response_outside_the_allowed_options(monkeypatch):
    from app.rag import chain

    monkeypatch.setattr(chain, "_get_gemini_llm", lambda: _FakeLLM("Something made up"))
    monkeypatch.setattr(chain, "_get_openai_llm", lambda: None)
    assert chain.classify_category("random query") is None
