"""
LLM orchestration via LangChain. Groq only -- no Gemini/OpenAI fallback.
This implements Module 4 (AI Chat Engine) and Module 5 (RAG).
"""
import logging
from enum import Enum
from functools import lru_cache

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.config import settings

logger = logging.getLogger("uvicorn.error")

CATEGORY_OPTIONS = [
    "Wi-Fi Connectivity",
    "Warranty & Repair",
    "Refunds & Store",
    "Hardware Defects",
    "General Support",
]

LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "zh": "Chinese",
    "ja": "Japanese",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
}


class FailureReason(str, Enum):
    """Why the Groq call failed, so callers/monitoring can react
    differently instead of getting the same generic string for everything."""
    NOT_CONFIGURED = "not_configured"   # no API key set at all
    QUOTA_EXCEEDED = "quota_exceeded"   # billing/quota/rate-limit (429-family)
    AUTH_ERROR = "auth_error"           # bad/revoked API key (401/403)
    OTHER = "other"                     # network, timeout, unknown


def _classify_exception(exc: Exception) -> FailureReason:
    """Best-effort classification, matched on exception class name + message
    text rather than importing Groq's specific exception classes."""
    name = type(exc).__name__
    msg = str(exc).lower()

    quota_markers = (
        "resourceexhausted", "ratelimiterror", "insufficient_quota",
        "quota", "429",
    )
    auth_markers = (
        "permissiondenied", "unauthorized", "authenticationerror",
        "invalid_api_key", "401", "403",
    )

    haystack = f"{name.lower()} {msg}"
    if any(marker in haystack for marker in quota_markers):
        return FailureReason.QUOTA_EXCEEDED
    if any(marker in haystack for marker in auth_markers):
        return FailureReason.AUTH_ERROR
    return FailureReason.OTHER


@lru_cache(maxsize=1)
def _get_groq_llm():
    if not settings.groq_api_key:
        return None
    from langchain_groq import ChatGroq
    # settings.groq_model e.g. "llama-3.3-70b-versatile" or "llama-3.1-8b-instant"
    return ChatGroq(model=settings.groq_model, api_key=settings.groq_api_key)


def _build_messages(system_prompt: str, chat_history: list[dict], user_text: str):
    messages = [SystemMessage(content=system_prompt)]
    for m in chat_history:
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["text"]))
        else:
            messages.append(AIMessage(content=m["text"]))
    messages.append(HumanMessage(content=user_text))
    return messages


# Messages shown to the end user, keyed by why Groq failed.
_FALLBACK_MESSAGES = {
    FailureReason.QUOTA_EXCEEDED: (
        "The AI assistant has hit its usage limit for now. Your message has "
        "been saved -- please try again later, or open a support ticket if "
        "this keeps happening."
    ),
    FailureReason.AUTH_ERROR: (
        "The AI assistant is temporarily misconfigured. Your message has "
        "been saved -- our team has been notified."
    ),
    FailureReason.OTHER: (
        "I'm having trouble reaching the AI assistant right now. Your "
        "message has been saved -- please try again in a moment, or open a "
        "support ticket if this keeps happening."
    ),
    FailureReason.NOT_CONFIGURED: (
        "The AI assistant isn't set up yet. Please try again shortly, or "
        "contact support if this continues."
    ),
}


def generate_answer(
    system_prompt: str,
    context: str,
    chat_history: list[dict],
    user_text: str,
    temperature: float = 0.3,
    language: str = "en",
) -> tuple[str, bool, FailureReason | None]:
    """Returns (reply_text, used_ai, failure_reason).

    failure_reason is None when used_ai is True. When used_ai is False, it
    tells the caller (API layer / monitoring) WHY Groq failed, so e.g. quota
    errors can trigger an alert distinct from auth errors."""
    lang_name = LANGUAGE_NAMES.get(language, "English")
    full_system_prompt = (
        f"{system_prompt}\n\n"
        f"Respond in {lang_name}.\n\n"
        f"RETRIEVED KNOWLEDGE BASE CONTEXT:\n{context or 'No context found. Proceed with standard helpful assistance.'}"
    )
    messages = _build_messages(full_system_prompt, chat_history, user_text)

    llm = _get_groq_llm()
    if llm is None:
        return _FALLBACK_MESSAGES[FailureReason.NOT_CONFIGURED], False, FailureReason.NOT_CONFIGURED

    try:
        llm_with_temp = llm.bind(temperature=temperature)
        response = llm_with_temp.invoke(messages)
        return response.content, True, None
    except Exception as exc:
        reason = _classify_exception(exc)
        logger.exception("Groq call failed [%s]", reason.value)
        return _FALLBACK_MESSAGES[reason], False, reason


def classify_category(user_text: str) -> str | None:
    prompt = (
        f'Analyze this user query: "{user_text}". Classify it into exactly one of these '
        f'categories: {", ".join(CATEGORY_OPTIONS)}. Return ONLY the category name.'
    )
    llm = _get_groq_llm()
    if llm is None:
        return None
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        category = response.content.strip().strip('"')
        if category in CATEGORY_OPTIONS:
            return category
    except Exception:
        logger.exception("classify_category failed (groq)")
    return None


def generate_suggested_question(document_text: str) -> str | None:
    """Generates ONE natural customer-facing question that the given
    document actually answers -- used for the suggested-question chips on
    the empty chat screen (see chat.py's /suggested-questions).

    This replaces suggesting from past chat history, which drifted from
    reality the moment a document was deleted or replaced (a question
    someone once typed can keep showing up as "suggested" long after the
    document that answered it is gone). Tying the chip directly to a
    document's own content means it's automatically correct as of
    whatever is currently in the knowledge base -- add a document, its
    question appears; remove it, the question goes with it.

    Returns None on failure; the caller falls back to a generic
    "Can you tell me about {document name}?" template.
    """
    snippet = document_text[:2000]  # opening portion is representative enough; keeps the prompt small
    prompt = (
        "Here is an internal support document:\n\n"
        f"{snippet}\n\n"
        "Write ONE short, natural question a customer might type into a support chat "
        "that this document directly answers. Return ONLY the question itself -- no "
        "quotation marks, no preamble, under 12 words."
    )
    llm = _get_groq_llm()
    if llm is None:
        return None
    try:
        response = llm.invoke([HumanMessage(content=prompt)])
        question = response.content.strip().strip('"')
        return question or None
    except Exception:
        logger.exception("generate_suggested_question failed (groq)")
        return None