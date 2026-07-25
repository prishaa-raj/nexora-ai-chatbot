"""
AI-Powered Customer Support Chatbot -- FastAPI backend entrypoint.

Stack: FastAPI (Python) + MongoDB (Motor) + ChromaDB (vector store) +
LangChain (LLM orchestration, Gemini/OpenAI) + Sentence-Transformers (embeddings).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import close_mongo_connection, connect_to_mongo, users_col, conversations_col, documents_col
from app.rate_limit import limiter
from app.routers import admin, auth, chat, documents, notifications
from app.seed import seed_if_needed

logger = logging.getLogger("uvicorn.error")



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Refuse to boot with the default JWT secret in production -- this is
    # the single most important thing standing between "demo" and "deployed".
    if settings.is_production and settings.jwt_secret == "change-this-secret":
        raise RuntimeError(
            "JWT_SECRET is still set to the default value. Set a real secret "
            "via the JWT_SECRET environment variable before running in production."
        )

    connect_to_mongo()
    # Helpful indexes
    await users_col().create_index("email", unique=True)
    await users_col().create_index("id", unique=True)
    await conversations_col().create_index("id", unique=True)
    await conversations_col().create_index("userId")
    await documents_col().create_index("id", unique=True)

    await seed_if_needed()
    yield
    close_mongo_connection()


app = FastAPI(title="AI-Powered Customer Support Chatbot API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS -- explicit methods/headers instead of "*". Wildcards are harmless
# for a public API with no cookies, but this app uses allow_credentials=True
# (Authorization header), so the origin list in .env is what actually does
# the restricting -- keep it to real frontend origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline security headers. Not a substitute for HTTPS termination at
    the proxy/load balancer -- set that up at the Nginx/Render/Vercel level
    too -- but these cost nothing and stop a few cheap attacks (clickjacking,
    MIME sniffing) regardless of where this ends up deployed."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak stack traces / internal details to the client -- log them
    # server-side and return a generic message instead.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(admin.router)
app.include_router(notifications.router)


@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "ok"}