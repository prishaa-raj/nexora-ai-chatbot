"""
Document ingestion helpers: extract text from uploaded PDFs and split
long text into overlapping chunks (using LangChain's text splitter) ready
for embedding into the vector store.
"""
import io

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text)
    return "\n\n".join(pages)


def chunk_text(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    chunks = _splitter.split_text(text)
    return [c.strip() for c in chunks if len(c.strip()) > 20]
