"""
Local embedding model powered by Sentence-Transformers.
Runs fully on-device (CPU is fine) -- no external embedding API calls needed.
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
