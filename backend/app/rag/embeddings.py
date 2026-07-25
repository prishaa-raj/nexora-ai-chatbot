"""
Local embeddings via ChromaDB's built-in ONNX MiniLM function.

Same underlying model as before (all-MiniLM-L6-v2), but running on
ONNX Runtime -- which you already have installed as Chroma's own
dependency -- instead of full PyTorch. Chroma's own source literally
says this function exists "to remove dependencies on
sentence-transformers, which in turn depends on pytorch": that's exactly
the problem that was crashing this app (torch + a first-time model
download/load + encoding ~100 chunks in one batch, on a 512MB Render
instance, took the whole process down -- genuine memory exhaustion, not
just the earlier event-loop-freeze issue).

No external embeddings API, no API key, no billing -- fully local, and
much lighter than the torch-based version.
"""
from functools import lru_cache

from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2


@lru_cache(maxsize=1)
def _get_embedder() -> ONNXMiniLM_L6_V2:
    return ONNXMiniLM_L6_V2()


def embed_text(text: str) -> list[float]:
    return _get_embedder()([text])[0]


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    return _get_embedder()(texts)