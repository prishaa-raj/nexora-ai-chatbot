"""
Local embedding model powered by Sentence-Transformers.
Runs fully on-device (CPU is fine) -- no external embedding API, no API key,
no billing. Groq has no embeddings endpoint at all (chat/audio/models/
batches/files/fine-tuning only -- confirmed against their API reference),
so this is the only genuinely-Groq-only-compatible option: Groq handles
chat, this handles embeddings locally.

Note: this is the SAME approach the project used originally, before it was
swapped to a hosted embeddings API. That swap was made because an earlier
version of this endpoint called embed_texts() directly on the request's
event loop, which froze the whole (single-worker) process for long enough
that Render's health check killed it -- easy to mistake for an OOM crash,
but actually just a blocking-call freeze. That freeze is now fixed at the
call site (routers/documents.py wraps this in asyncio.to_thread), so a
local model should no longer trigger it. If this genuinely starts crashing
the process on large uploads (rather than just running slower), that would
point to real memory pressure on a 512MB instance -- worth upgrading
Render's plan, or moving to a smaller model, at that point.
"""
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import settings


@lru_cache(maxsize=1)
def get_embedder() -> SentenceTransformer:
    return SentenceTransformer(settings.embedding_model_name)


def embed_text(text: str) -> list[float]:
    model = get_embedder()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    model = get_embedder()
    vectors = model.encode(texts, normalize_embeddings=True)
    return vectors.tolist()