/**
 * Shared Type Definitions for AI-Powered Customer Support Chatbot
 */

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  name: string;
  content: string; // Full text content
  type: 'pdf' | 'faq' | 'policy' | 'manual';
  uploadedAt: string;
  size: number; // in bytes
  wordCount: number;
  chunkCount: number;
  status: 'processing' | 'indexed';
  // Generated once from the document's own content when uploaded, and
  // cached -- used to drive the customer-side suggested-question chips.
  suggestedQuestion?: string;
}

export interface Message {
  id: string;
  // 'admin' added for support-agent replies sent from the Admin Dashboard
  // (POST /api/chat/admin-reply) -- mirrors Message.sender in models.py.
  sender: 'user' | 'bot' | 'admin';
  text: string;
  timestamp: string;
  sources?: string[]; // Referenced source document names
  rating?: 'up' | 'down' | null;
  feedback?: string;
}

// One rating/comment submission. Conversation.feedbackHistory is a list of
// these -- rating is append-only, not a single value that gets silently
// overwritten every time the customer re-rates.
export interface FeedbackHistoryEntry {
  rating?: number | null;
  feedbackText?: string | null;
  timestamp: string;
}

export type EscalationReason = 'low_rating' | 'user_requested';

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  title: string;
  startedAt: string;
  lastMessageAt: string;
  messages: Message[];
  status: 'active' | 'ticket_open' | 'ticket_resolved';
  rating?: number; // Most recent chat satisfaction rating (1-5 stars)
  feedbackText?: string; // Most recent comment
  feedbackHistory?: FeedbackHistoryEntry[];
  category?: string; // Auto-categorized topic
  // True once an admin has replied via /api/chat/admin-reply -- the bot
  // stops auto-answering this thread once this is set.
  humanHandling?: boolean;
  assignedAdminName?: string;
  escalationReason?: EscalationReason;
}

export interface BotSettings {
  chatbotName: string;
  welcomeMessage: string;
  systemPrompt: string;
  temperature: number;
  fallbackMessage: string;
  ragEnabled: boolean;
  maxSources: number;
  autoTicketOnLowRating: boolean;
}

export interface AppNotification {
  id: string;
  userId?: string | null; // absent/null = admin-facing global notification
  // 'ai_failure': every configured LLM provider failed (quota/auth/network).
  // 'escalation': customer clicked "Talk to a person".
  // 'human_reply': an admin replied inside a conversation.
  type: 'upload' | 'ticket' | 'rating' | 'system' | 'ai_failure' | 'escalation' | 'human_reply';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface DashboardStats {
  totalConversations: number;
  activeUsers: number;
  avgResponseTime: number; // in seconds
  avgRating: number; // 1-5 scale
  customerSatisfaction: number; // percentage of positive ratings
  knowledgeBaseSize: number; // number of indexed docs
  ticketCount: number;
}

// GET /api/chat/suggested-questions -- dynamic replacement for the old
// hardcoded chip list, sourced from real conversation history or the
// current knowledge base (see chat.py).
export interface SuggestedQuestion {
  label: string;
  query: string;
}