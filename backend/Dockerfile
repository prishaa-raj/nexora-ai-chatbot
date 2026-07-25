FROM python:3.11-slim

# System deps: gcc etc. needed to build some ML wheels; removed after install
# to keep the final image lean.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# sentence-transformers depends on torch. Installing the CPU-only build
# explicitly first (before the rest of requirements.txt) avoids pip pulling
# the much larger default GPU build, which isn't needed or usable here
# for our use case (sentence-transformers embeddings on CPU).
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Persisted ChromaDB data + downloaded embedding model cache. Mount a volume
# at /app/chroma_data in production so re-deploys don't lose the vector store.
RUN mkdir -p /app/chroma_data

EXPOSE 8000

# Run as a non-root user
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]