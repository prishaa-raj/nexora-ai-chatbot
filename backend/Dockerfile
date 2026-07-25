FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Persisted ChromaDB data. Mount a volume at /app/chroma_data in production
# so re-deploys don't lose the vector store.
RUN mkdir -p /app/chroma_data

EXPOSE 8000

# Run as a non-root user
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]