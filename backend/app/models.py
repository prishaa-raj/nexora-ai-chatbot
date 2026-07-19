"""
Pydantic schemas — mirrors src/types.ts on the frontend so the API contract
stays consistent across the stack.
"""
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field

UserRole = Literal["admin", "user"]
DocType = Literal["pdf", "faq", "policy", "manual"]
ConvStatus = Literal["active", "ticket_open", "ticket_resolved"]
# "ai_failure" (a provider outage/quota/auth failure) and "escalation" /
# "human_reply" (the "talk to a person" flow) are new -- added alongside
# the fixes that generate them, so those notifications validate correctly
# instead of silently never matching a Literal.
NotifType = Literal["upload", "ticket", "rating", "system", "ai_failure", "escalation", "human_reply"]
# Why a request was flagged for a human: a genuinely bad rating vs. the
# customer explicitly asking for a person. Kept distinct so the admin UI
# can show *why* something is in the queue instead of one undifferentiated
# "ticket_open" bucket.
EscalationReason = Literal["low_rating", "user_requested"]


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    """Public self-registration. Role is intentionally NOT accepted here --
    every self-registered account is a 'user'. Admin accounts can only be
    created by an existing admin via POST /api/admin/users (see admin.py)."""
    email: EmailStr
    name: str
    password: str = Field(min_length=6)


class AdminCreateRequest(BaseModel):
    """Used by an existing admin to create another admin account."""
    email: EmailStr
    name: str
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ---------- Documents (Knowledge Base) ----------
class DocumentOut(BaseModel):
    id: str
    name: str
    content: str
    type: DocType
    uploadedAt: str
    size: int
    wordCount: int
    chunkCount: int
    status: Literal["processing", "indexed"]
    # Generated once at upload time from the document's own content (see
    # generate_suggested_question in rag/chain.py) and cached here so the
    # /suggested-questions endpoint doesn't regenerate it on every request.
    suggestedQuestion: Optional[str] = None


class DocumentTextUploadRequest(BaseModel):
    name: str
    content: str
    type: DocType = "faq"


# ---------- Chat ----------
class Message(BaseModel):
    id: str
    # "admin" added so a support agent's reply (POST /api/chat/admin-reply)
    # can be stored as a Message the same way user/bot messages are,
    # instead of needing a separate parallel structure. Without this, that
    # endpoint raised a pydantic ValidationError on every call.
    sender: Literal["user", "bot", "admin"]
    text: str
    timestamp: str
    sources: Optional[list[str]] = None
    rating: Optional[Literal["up", "down"]] = None
    feedback: Optional[str] = None


class FeedbackHistoryEntry(BaseModel):
    """One rating/comment submission. Conversation.feedbackHistory is a
    list of these -- rating is now append-only rather than a single value
    that gets silently overwritten every time the customer re-rates."""
    rating: Optional[int] = None
    feedbackText: Optional[str] = None
    timestamp: str


class Conversation(BaseModel):
    id: str
    userId: str
    userName: str
    title: str
    startedAt: str
    lastMessageAt: str
    messages: list[Message] = []
    status: ConvStatus = "active"
    rating: Optional[int] = None  # most recent rating -- kept for backward compatibility with existing analytics
    feedbackText: Optional[str] = None  # most recent comment -- same reason
    feedbackHistory: list[FeedbackHistoryEntry] = []
    category: Optional[str] = None
    # True once an admin has replied via /api/chat/admin-reply -- the bot
    # checks this and stops auto-answering so it doesn't talk over a human.
    humanHandling: bool = False
    assignedAdminName: Optional[str] = None
    escalationReason: Optional[EscalationReason] = None


class NewChatRequest(BaseModel):
    firstMessage: Optional[str] = ""


class SendMessageRequest(BaseModel):
    conversationId: str
    text: str
    language: Optional[str] = "en"


class RateRequest(BaseModel):
    conversationId: str
    rating: Optional[int] = None
    feedbackText: Optional[str] = None


class EscalateRequest(BaseModel):
    """'Talk to a person' -- deliberately separate from RateRequest. The
    old implementation reused /rate with a faked 1-star rating to trigger
    escalation, which corrupted the customer's real satisfaction rating
    and offered no way to distinguish 'genuinely unhappy' from 'just wants
    a human'."""
    conversationId: str


class AdminReplyRequest(BaseModel):
    conversationId: str
    text: str


class SuggestedQuestion(BaseModel):
    label: str
    query: str


# ---------- Bot Settings ----------
class BotSettings(BaseModel):
    chatbotName: str = "SmartHelp AI"
    welcomeMessage: str = "Hello! How can I help you today?"
    systemPrompt: str = (
        "You are a helpful, polite customer support assistant. Answer truthfully "
        "using ONLY the retrieved context. If unsure, offer to open a support ticket."
    )
    temperature: float = 0.3
    fallbackMessage: str = (
        "I could not find a specific answer in my knowledge base. "
        "Would you like me to open a support ticket for you?"
    )
    ragEnabled: bool = True
    maxSources: int = 3
    autoTicketOnLowRating: bool = True


# ---------- Notifications ----------
class AppNotification(BaseModel):
    id: str
    userId: Optional[str] = None  # None = admin-facing/global; set = targets one customer
    type: NotifType
    title: str
    message: str
    timestamp: str
    read: bool = False


# ---------- Analytics ----------
class DashboardStats(BaseModel):
    totalConversations: int
    activeUsers: int
    avgResponseTime: float
    avgRating: float
    customerSatisfaction: float
    knowledgeBaseSize: int
    ticketCount: int