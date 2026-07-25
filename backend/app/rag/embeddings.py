"""
Embeddings via Google's Gemini embedding API.

Moved off local Sentence-Transformers/torch on purpose: that model has to be
loaded into memory (and downloaded on first use) inside the same 512MB
Render free-tier process as FastAPI + ChromaDB + LangChain, and it was
crashing the worker mid-request (OOM -> Render silently restarts the
container) as soon as a real PDF forced it to actually run. Calling an
embedding API instead means the backend process itself stays small --
nothing heavy loads locally at all.

Uses your existing GEMINI_API_KEY -- no new key/account needed. Note: Gemini
meters embedding calls on a separate quota bucket from the chat model
(gemini-2.0-flash), so this should keep working even during the chat-model
quota issue mentioned in chain.py -- but if uploads start failing with a
quota-style error, that assumption was wrong and this should switch to
OpenAI's embedding API instead (a small change, same shape).
"""
from functools import lru_cache

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from app.config import settings


@lru_cache(maxsize=2)
def _get_embedder(task_type: str) -> GoogleGenerativeAIEmbeddings:
    # task_type tunes Gemini's embedding output differently for a query vs a
    # stored document -- passing the right one improves retrieval match
    # quality over using one generic embedding for both sides.
    return GoogleGenerativeAIEmbeddings(
        model=settings.embedding_model_name,
        google_api_key=settings.gemini_api_key,
        task_type=task_type,
    )


def embed_text(text: str) -> list[float]:
    """Embeds a single user QUERY at retrieval/chat time."""
    return _get_embedder("retrieval_query").embed_query(text)


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embeds DOCUMENT chunks at upload / rebuild-index time."""
    if not texts:
        return []
    return _get_embedder("retrieval_document").embed_documents(texts)