"""
LLM orchestration via LangChain. Groq is the primary model (free tier, no
card required -- see console.groq.com) since it responds fastest and has no
billing/quota blockers. Gemini and OpenAI are kept as fallbacks in case
their quota/billing gets sorted out later -- but they are tried AFTER Groq
so a healthy provider always answers first instead of the request waiting
on two dead providers' retry/backoff cycles before ever reaching Groq.
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
    """Why an LLM provider call failed, so callers/monitoring can react
    differently instead of getting the same generic string for everything."""
    NOT_CONFIGURED = "not_configured"   # no API key set at all
    QUOTA_EXCEEDED = "quota_exceeded"   # billing/quota/rate-limit (429-family)
    AUTH_ERROR = "auth_error"           # bad/revoked API key (401/403)
    OTHER = "other"                     # network, timeout, unknown


def _classify_exception(exc: Exception) -> FailureReason:
    """Best-effort classification without hard-importing every provider's
    exception classes (keeps this file working even if a provider package
    isn't installed). Matches on exception class name + message text."""
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
def _get_gemini_llm():
    if not settings.gemini_api_key:
        return None
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.gemini_api_key,
    )


@lru_cache(maxsize=1)
def _get_openai_llm():
    if not settings.openai_api_key:
        return None
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)


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


# Messages shown to the end user, keyed by why every provider failed.
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
    tells the caller (API layer / monitoring) WHY every provider failed, so
    e.g. quota errors can trigger an alert distinct from auth errors, and
    the frontend/ops dashboard doesn't have to grep uvicorn logs to tell
    "we're out of money" apart from "the key is wrong"."""
    lang_name = LANGUAGE_NAMES.get(language, "English")
    full_system_prompt = (
        f"{system_prompt}\n\n"
        f"Respond in {lang_name}.\n\n"
        f"RETRIEVED KNOWLEDGE BASE CONTEXT:\n{context or 'No context found. Proceed with standard helpful assistance.'}"
    )
    messages = _build_messages(full_system_prompt, chat_history, user_text)

    any_provider_configured = False
    worst_reason: FailureReason | None = None  # last non-None reason seen

    for get_llm in (_get_groq_llm, _get_gemini_llm, _get_openai_llm):
        llm = get_llm()
        if llm is None:
            continue
        any_provider_configured = True
        try:
            # ChatGoogleGenerativeAI (unlike ChatOpenAI) doesn't accept a
            # top-level `temperature` kwarg at call time -- it must be
            # nested inside `generation_config`, or the raw google-genai
            # client rejects it with
            # "generate_content() got an unexpected keyword argument
            # 'temperature'". OpenAI's and Groq's clients (both
            # OpenAI-compatible) are fine with the top-level form.
            if get_llm is _get_gemini_llm:
                llm_with_temp = llm.bind(generation_config={"temperature": temperature})
            else:
                llm_with_temp = llm.bind(temperature=temperature)
            response = llm_with_temp.invoke(messages)
            return response.content, True, None
        except Exception as exc:
            reason = _classify_exception(exc)
            worst_reason = reason
            logger.exception(
                "LLM provider call failed (%s) [%s]",
                getattr(get_llm, "__name__", "unknown"),
                reason.value,
            )
            continue

    if any_provider_configured:
        reason = worst_reason or FailureReason.OTHER
        return _FALLBACK_MESSAGES[reason], False, reason

    # No key is set at all -- this is a setup issue, not a runtime failure.
    return _FALLBACK_MESSAGES[FailureReason.NOT_CONFIGURED], False, FailureReason.NOT_CONFIGURED


def classify_category(user_text: str) -> str | None:
    prompt = (
        f'Analyze this user query: "{user_text}". Classify it into exactly one of these '
        f'categories: {", ".join(CATEGORY_OPTIONS)}. Return ONLY the category name.'
    )
    # Groq first, matching generate_answer() and generate_suggested_question()
    # -- this was the actual cause of multi-minute delays on new
    # conversations. Gemini's client retries 429s internally with growing
    # backoff (2s, 4s, 8s, 16s, 32s...) BEFORE our except/continue ever
    # gets a chance to move to the next provider. With Gemini's quota
    # permanently at 0 on the free tier, every single call to it was
    # eating ~2 minutes of pure retry-and-fail time -- and this function
    # runs on every new conversation's first 3 messages, blocking the
    # actual chat reply until it finished failing.
    for get_llm in (_get_groq_llm, _get_gemini_llm, _get_openai_llm):
        llm = get_llm()
        if llm is None:
            continue
        try:
            response = llm.invoke([HumanMessage(content=prompt)])
            category = response.content.strip().strip('"')
            if category in CATEGORY_OPTIONS:
                return category
        except Exception:
            logger.exception("classify_category failed (%s)", getattr(get_llm, "__name__", "unknown"))
            continue
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

    Returns None if every provider fails; the caller falls back to a
    generic "Can you tell me about {document name}?" template.
    """
    snippet = document_text[:2000]  # opening portion is representative enough; keeps the prompt small
    prompt = (
        "Here is an internal support document:\n\n"
        f"{snippet}\n\n"
        "Write ONE short, natural question a customer might type into a support chat "
        "that this document directly answers. Return ONLY the question itself -- no "
        "quotation marks, no preamble, under 12 words."
    )
    for get_llm in (_get_groq_llm, _get_gemini_llm, _get_openai_llm):
        llm = get_llm()
        if llm is None:
            continue
        try:
            response = llm.invoke([HumanMessage(content=prompt)])
            question = response.content.strip().strip('"')
            if question:
                return question
        except Exception:
            logger.exception("generate_suggested_question failed (%s)", getattr(get_llm, "__name__", "unknown"))
            continue
    return None