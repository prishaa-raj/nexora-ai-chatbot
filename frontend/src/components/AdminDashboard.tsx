import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  BookOpen,
  Settings,
  Shield,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Star,
  Users,
  MessageSquare,
  FileText,
  Save,
  Sliders,
  RefreshCw,
  Eye,
  LogOut,
  Bell,
  Check,
  Plus,
  HelpCircle,
  Send,
  UserCog,
  Wrench
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { BotSettings, Document, AppNotification, DashboardStats } from '../types';
import { apiFetch } from '../api';

const COLORS = ['#3452E1', '#059669', '#D97706', '#DC2626', '#7C6FE0'];

interface AdminDashboardProps {
  user: { id: string; name: string; email: string; role: 'admin' | 'user' };
  token: string;
  onLogout: () => void;
}

export default function AdminDashboard({ user, token, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'kb' | 'chats' | 'settings'>('analytics');

  // Analytics State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyVolume, setDailyVolume] = useState<any[]>([]);
  const [ratingsDist, setRatingsDist] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [feedbackLogs, setFeedbackLogs] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingKB, setLoadingKB] = useState(true);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Documents KB State
  const [documents, setDocuments] = useState<Document[]>([]);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadType, setUploadType] = useState<'faq' | 'policy' | 'manual'>('faq');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'chunking' | 'indexing' | 'success'>('idle');
  const [docChunksPreview, setDocChunksPreview] = useState<number>(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Active Chats / Tickets state
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);

  // Admin reply compose state (fix #3: admins previously had no way to
  // reply inside a conversation -- the transcript view was read-only)
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Bot Settings State
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Fix for the Chroma/Mongo drift bug: lets the admin force the vector
  // store to be rebuilt strictly from what's currently in Mongo, clearing
  // out any orphaned embeddings (e.g. the "sample_faq" ghost document) that
  // don't show up in this Knowledge Base tab but the bot can still retrieve.
  const [rebuildingIndex, setRebuildingIndex] = useState(false);
  const [rebuildStatus, setRebuildStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Team / Admin creation state
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createAdminStatus, setCreateAdminStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch Stats & Charts
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await apiFetch('/api/admin/analytics');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setDailyVolume(data.dailyVolume);
        setRatingsDist(data.ratingsDist);
        setCategories(data.categories);
        setFeedbackLogs(data.feedbackLogs);
      }
    } catch (err) {
      console.error("Error fetching admin analytics", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Fetch Documents
  const fetchDocuments = async () => {
    setLoadingKB(true);
    try {
      const res = await apiFetch('/api/admin/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Error fetching documents", err);
    } finally {
      setLoadingKB(false);
    }
  };

  // Fetch Conversations (to review transcripts)
  const fetchConversations = async () => {
    setLoadingChats(true);
    try {
      const res = await apiFetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Error fetching transcripts", err);
    } finally {
      setLoadingChats(false);
    }
  };

  // Fetch Bot Settings
  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await apiFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Error fetching settings", err);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Fetch Alerts
  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/api/admin/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Error fetching alerts", err);
    }
  };

  // Initialize
  useEffect(() => {
    fetchAnalytics();
    fetchDocuments();
    fetchConversations();
    fetchSettings();
    fetchNotifications();

    // Set polling interval for active notifications & analytics
    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Sync selections on refresh
  const handleRefreshAll = () => {
    fetchAnalytics();
    fetchDocuments();
    fetchConversations();
    fetchSettings();
    fetchNotifications();
  };

  // Fixes the "bot answers from a document that isn't in this list" bug --
  // wipes the ChromaDB collection entirely and re-embeds strictly from
  // what's in Mongo right now, so any orphaned/ghost embeddings left behind
  // by a manual database reset are guaranteed to be gone afterward.
  const handleRebuildIndex = async () => {
    if (!confirm(
      "This rebuilds the entire vector search index from what's currently listed below. " +
      "It clears out any orphaned data the bot might still be citing that isn't shown here. " +
      "The bot will briefly be unable to answer from documents while this runs. Continue?"
    )) return;

    setRebuildingIndex(true);
    setRebuildStatus(null);
    try {
      const res = await apiFetch('/api/admin/documents/rebuild-index', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRebuildStatus({
          type: 'success',
          message: `Rebuilt successfully: ${data.documentsReindexed} document(s), ${data.chunksIndexed} chunk(s) re-indexed.`
        });
        fetchDocuments();
        fetchAnalytics();
      } else {
        setRebuildStatus({ type: 'error', message: data.detail || 'Rebuild failed.' });
      }
    } catch (err) {
      setRebuildStatus({ type: 'error', message: 'Network error -- could not reach the server.' });
    } finally {
      setRebuildingIndex(false);
      setTimeout(() => setRebuildStatus(null), 6000);
    }
  };

  // Handle Drag & Drop / File Upload parsing
  const handleFileSelect = (file: File) => {
    // Determine title from name (without extension)
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setUploadName(baseName);
    
    // Set type based on file name/metadata
    const nameLower = file.name.toLowerCase();
    if (nameLower.includes('faq')) {
      setUploadType('faq');
    } else if (nameLower.includes('policy') || nameLower.includes('warranty') || nameLower.includes('return')) {
      setUploadType('policy');
    } else {
      setUploadType('manual');
    }

    if (file.type === "text/plain" || file.name.endsWith('.txt')) {
      setUploadFile(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setUploadContent(e.target.result as string);
        }
      };
      reader.readAsText(file);
    } else if (file.type === "application/json" || file.name.endsWith('.json')) {
      setUploadFile(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          try {
            const parsed = JSON.parse(e.target.result as string);
            setUploadContent(typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2));
          } catch {
            setUploadContent(e.target.result as string);
          }
        }
      };
      reader.readAsText(file);
    } else {
      // PDF (or other binary doc): send the raw file to the backend, where
      // pypdf extracts the real text server-side (Module 3: Knowledge Base).
      setUploadContent('');
      setUploadFile(file);
    }
  };

  // Document Upload
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadName.trim() || (!uploadContent.trim() && !uploadFile)) return;

    setUploadStatus('chunking');
    const estimatedChunks = uploadFile
      ? Math.max(1, Math.ceil(uploadFile.size / 800))
      : Math.max(1, Math.ceil(uploadContent.split(/\n\n+/).length));
    setDocChunksPreview(estimatedChunks);

    // Brief delay purely for a clean chunking -> indexing UX transition
    setTimeout(async () => {
      setUploadStatus('indexing');

      try {
        const formData = new FormData();
        formData.append('name', uploadName);
        formData.append('type', uploadType);
        if (uploadFile) {
          formData.append('file', uploadFile);
        } else {
          formData.append('content', uploadContent);
        }

        const res = await apiFetch('/api/admin/documents/upload', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          setUploadStatus('success');
          setUploadName('');
          setUploadContent('');
          setUploadFile(null);
          fetchDocuments();
          fetchNotifications();
          fetchAnalytics();

          setTimeout(() => {
            setUploadStatus('idle');
          }, 3000);
        } else {
          setUploadStatus('idle');
        }
      } catch (err) {
        console.error("Upload error", err);
        setUploadStatus('idle');
      }
    }, 1200);
  };

  // Delete Document
  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to remove this document from the RAG knowledge base? The bot will no longer retrieve answers from its chunks.")) return;

    try {
      const res = await apiFetch(`/api/admin/documents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchDocuments();
        fetchAnalytics();
      }
    } catch (err) {
      console.error("Delete document error", err);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSavingSettings(true);
    setSettingsStatus('');

    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSettingsStatus('success');
        setTimeout(() => setSettingsStatus(''), 3000);
      }
    } catch (err) {
      console.error("Error saving settings", err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Create a new admin account. Only reachable by an already-authenticated
  // admin -- the backend enforces this too via require_admin, this is not
  // just a UI-level restriction.
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);
    setCreateAdminStatus(null);

    try {
      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name: newAdminName, email: newAdminEmail, password: newAdminPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCreateAdminStatus({ type: 'success', message: `Admin account created for ${data.email}.` });
        setNewAdminName('');
        setNewAdminEmail('');
        setNewAdminPassword('');
      } else {
        setCreateAdminStatus({ type: 'error', message: data.detail || 'Could not create admin account.' });
      }
    } catch (err) {
      setCreateAdminStatus({ type: 'error', message: 'Network error -- could not reach the server.' });
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Mark Alerts Read
  const handleMarkAllRead = async () => {
    try {
      const res = await apiFetch('/api/admin/notifications/read-all', {
        method: 'POST'
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error clearing alerts", err);
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/notifications/${id}/read`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error reading alert", err);
    }
  };

  // Resolve Ticket
  const handleResolveTicket = async (id: string) => {
    try {
      const res = await apiFetch(`/api/admin/tickets/${id}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchConversations();
        if (selectedConv && selectedConv.id === id) {
          setSelectedConv({ ...selectedConv, status: 'ticket_resolved' });
        }
        fetchAnalytics();
      }
    } catch (err) {
      console.error("Error resolving ticket", err);
    }
  };

  // Fix #3: admin can now actually reply inside a conversation instead of
  // only viewing it read-only. Hitting this also flips the conversation
  // into "humanHandling" server-side, so the bot stops auto-answering the
  // customer once a person has joined.
  const handleSendAdminReply = async () => {
    if (!selectedConv || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await apiFetch('/api/chat/admin-reply', {
        method: 'POST',
        body: JSON.stringify({ conversationId: selectedConv.id, text: replyText.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedConv(data.conversation);
        setConversations(prev => prev.map(c => (c.id === data.conversation.id ? data.conversation : c)));
        setReplyText('');
      }
    } catch (err) {
      console.error("Error sending admin reply", err);
    } finally {
      setSendingReply(false);
    }
  };

  const unreadAlerts = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper text-ink flex flex-col font-sans">
      {/* Upper sub-header bar */}
      <div className="bg-card text-ink px-6 py-4 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 border-b border-line">
        <div className="flex items-center space-x-3">
          <div className="bg-hub p-2 rounded-xl text-white shadow-lg shadow-hub/10">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight">AI Control Center</h1>
            <p className="text-xs text-ink-soft">Manage RAG documents, model configurations, and view customer transcripts</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleRefreshAll}
            className="flex items-center px-3 py-1.5 bg-surface hover:bg-hub-soft text-ink-soft hover:text-hub rounded-lg text-xs font-bold transition-all border border-line"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reload Database
          </button>

          {/* Alerts Bell Icon */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-surface hover:bg-hub-soft rounded-lg text-ink hover:text-hub transition-all relative border border-line"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-status-red text-white font-extrabold text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full animate-bounce">
                  {unreadAlerts}
                </span>
              )}
            </button>

            {/* Alerts Dropdown Drawer */}
            {showNotifications && (
              <div className="absolute right-0 mt-2.5 w-80 bg-card rounded-2xl border border-line py-2 z-50 text-ink shadow-xl shadow-black/40">
                <div className="px-4 py-2 border-b border-line flex justify-between items-center bg-paper rounded-t-2xl">
                  <span className="font-extrabold text-xs text-ink">System Alerts ({unreadAlerts})</span>
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-hub hover:text-hub"
                  >
                    Mark All Read
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto px-2 py-1 space-y-1.5">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-ink-faint">No recent notifications.</div>
                  ) : (
                    notifications.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkSingleRead(notif.id)}
                        className={`p-3 rounded-xl transition-colors text-left relative cursor-pointer ${
                          notif.read ? 'bg-card opacity-60' : 'bg-hub/5 hover:bg-hub/10 border border-hub/20'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-bold text-xs text-ink flex items-center">
                            {notif.type === 'ticket' && <AlertCircle className="w-3.5 h-3.5 text-status-amber mr-1" />}
                            {notif.type === 'rating' && <Star className="w-3.5 h-3.5 text-status-amber mr-1 fill-amber-400" />}
                            {notif.type === 'upload' && <CheckCircle2 className="w-3.5 h-3.5 text-status-green mr-1" />}
                            {/* New notification types (from the AI-fallback and
                                "talk to a person" fixes) get their own icons
                                instead of falling through with no icon at all. */}
                            {notif.type === 'ai_failure' && <AlertCircle className="w-3.5 h-3.5 text-status-red mr-1" />}
                            {notif.type === 'escalation' && <HelpCircle className="w-3.5 h-3.5 text-status-amber mr-1" />}
                            {notif.type === 'human_reply' && <UserCog className="w-3.5 h-3.5 text-hub mr-1" />}
                            {notif.title}
                          </span>
                          {!notif.read && <span className="w-1.5 h-1.5 bg-hub rounded-full"></span>}
                        </div>
                        <p className="text-[11px] text-ink-soft mt-1">{notif.message}</p>
                        <span className="text-[9px] text-ink-faint block mt-1.5">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-l border-line h-6"></div>

          <button
            onClick={onLogout}
            className="flex items-center px-3.5 py-1.5 bg-status-red hover:bg-status-red-dark text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-status-red/10"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main Tab Controls Grid */}
      <div className="bg-card border-b border-line px-6 flex space-x-1">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center ${
            activeTab === 'analytics'
              ? 'border-hub text-hub'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Analytics & CSAT
        </button>
        <button
          onClick={() => setActiveTab('kb')}
          className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center ${
            activeTab === 'kb'
              ? 'border-hub text-hub'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <BookOpen className="w-4 h-4 mr-2" />
          Knowledge Base (RAG)
        </button>
        <button
          onClick={() => setActiveTab('chats')}
          className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center ${
            activeTab === 'chats'
              ? 'border-hub text-hub'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          User Conversations
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-3.5 px-4 font-bold text-sm border-b-2 transition-all flex items-center ${
            activeTab === 'settings'
              ? 'border-hub text-hub'
              : 'border-transparent text-ink-faint hover:text-ink'
          }`}
        >
          <Settings className="w-4 h-4 mr-2" />
          Bot Configuration
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* TAB 1: ANALYTICS & CSAT */}
        {activeTab === 'analytics' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {loadingAnalytics || !stats ? (
              <div className="space-y-6 animate-pulse">
                {/* Stats Counter Cards Grid Skeleton */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-card p-4 rounded-2xl border border-line flex flex-col justify-between h-24">
                      <div className="h-3 bg-surface w-16 rounded-md"></div>
                      <div className="flex justify-between items-baseline mt-4">
                        <div className="h-7 bg-surface w-12 rounded-md"></div>
                        <div className="w-5 h-5 bg-surface rounded-lg"></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts Grid Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Chart 1: Daily Support Volume Skeleton */}
                  <div className="bg-card p-5 rounded-2xl border border-line lg:col-span-2">
                    <div className="h-4 bg-surface w-44 rounded-md mb-6"></div>
                    <div className="h-64 bg-paper rounded-xl border border-line flex items-center justify-center">
                      <div className="w-11/12 h-5/6 flex items-end justify-between px-4 pb-2">
                        {[40, 60, 45, 80, 50, 95, 70, 85].map((h, i) => (
                          <div key={i} className="w-8 bg-surface rounded-t-lg transition-all" style={{ height: `${h}%` }}></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Chart 2: Category Distribution Skeleton */}
                  <div className="bg-card p-5 rounded-2xl border border-line flex flex-col justify-between">
                    <div>
                      <div className="h-4 bg-surface w-48 rounded-md mb-6"></div>
                      <div className="h-40 flex items-center justify-center">
                        <div className="w-28 h-28 rounded-full border-8 border-line flex items-center justify-center">
                          <div className="w-12 h-12 bg-paper rounded-full"></div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <div className="w-2.5 h-2.5 bg-surface rounded-full"></div>
                          <div className="h-3 bg-surface w-14 rounded-md"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Chart 3: Star Rating Skeleton */}
                  <div className="bg-card p-5 rounded-2xl border border-line">
                    <div className="h-4 bg-surface w-40 rounded-md mb-6"></div>
                    <div className="space-y-4">
                      {[90, 70, 40, 20, 15].map((w, i) => (
                        <div key={i} className="flex items-center space-x-3">
                          <div className="h-3 bg-surface w-8 rounded-md"></div>
                          <div className="flex-1 h-3.5 bg-paper rounded-full overflow-hidden">
                            <div className="h-full bg-surface rounded-full" style={{ width: `${w}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Feed Skeleton: Recent Feedback */}
                  <div className="bg-card p-5 rounded-2xl border border-line lg:col-span-2 space-y-4">
                    <div className="h-4 bg-surface w-48 rounded-md mb-4"></div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-3.5 bg-paper border border-line rounded-xl space-y-2.5">
                          <div className="flex justify-between items-center">
                            <div className="h-3.5 bg-surface w-24 rounded-md"></div>
                            <div className="h-3 bg-surface w-16 rounded-md"></div>
                          </div>
                          <div className="h-3 bg-surface w-3/4 rounded-md"></div>
                          <div className="h-3 bg-surface w-1/2 rounded-md"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Stats Counter Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="bg-card p-4 rounded-2xl border border-line flex flex-col justify-between">
                    <span className="text-xs font-bold text-ink-faint uppercase tracking-wider">Total Chats</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-extrabold text-ink">{stats.totalConversations}</span>
                      <MessageSquare className="w-5 h-5 text-hub" />
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-2xl border border-line flex flex-col justify-between">
                    <span className="text-xs font-bold text-ink-faint uppercase tracking-wider">Active Users</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-extrabold text-ink">{stats.activeUsers}</span>
                      <Users className="w-5 h-5 text-hub" />
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-2xl border border-line flex flex-col justify-between">
                    <span className="text-xs font-bold text-ink-faint uppercase tracking-wider">Avg Stars</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-extrabold text-status-amber">{stats.avgRating} ★</span>
                      <Star className="w-5 h-5 text-status-amber fill-amber-400" />
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-2xl border border-line flex flex-col justify-between">
                    <span className="text-xs font-bold text-ink-faint uppercase tracking-wider">Satisfaction</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-extrabold text-status-green">{stats.customerSatisfaction}%</span>
                      <CheckCircle2 className="w-5 h-5 text-status-green" />
                    </div>
                    {/* Fix #4: this number was confusing next to Avg Stars with
                        no explanation of how it's derived -- now it's labeled. */}
                    <span className="text-[9px] text-ink-faint mt-1">% of rated chats at 4★ or 5★</span>
                  </div>
                  <div className="bg-card p-4 rounded-2xl border border-line flex flex-col justify-between">
                    <span className="text-xs font-bold text-ink-faint uppercase tracking-wider">RAG Docs</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-extrabold text-ink">{stats.knowledgeBaseSize}</span>
                      <BookOpen className="w-5 h-5 text-hub" />
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-2xl border border-line flex flex-col justify-between">
                    <span className="text-xs font-bold text-ink-faint uppercase tracking-wider">Open Tickets</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-extrabold text-status-amber">{stats.ticketCount}</span>
                      <AlertCircle className="w-5 h-5 text-status-amber" />
                    </div>
                  </div>
                </div>

                {/* Live Interactive Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Chart 1: Daily Support Volume */}
                  <div className="bg-card p-5 rounded-2xl border border-line lg:col-span-2">
                    <h4 className="font-extrabold text-ink text-sm mb-4">Daily Support Volume Logs</h4>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyVolume}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 230, 236, 0.9)" />
                          <XAxis dataKey="date" stroke="#88919B" style={{ fontSize: '12px' }} />
                          <YAxis stroke="#88919B" style={{ fontSize: '12px' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', color: '#16202A' }} />
                          <Legend />
                          <Line type="monotone" dataKey="chats" stroke="#3452E1" strokeWidth={3} name="Total Queries" />
                          <Line type="monotone" dataKey="resolved" stroke="#059669" strokeWidth={2} name="Resolved" />
                          <Line type="monotone" dataKey="escalated" stroke="#D97706" strokeWidth={2} name="Escalated Tickets" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Category distribution breakdown */}
                  <div className="bg-card p-5 rounded-2xl border border-line">
                    <h4 className="font-extrabold text-ink text-sm mb-4">Support Query Category Distribution</h4>
                    <div className="h-72 flex flex-col justify-between items-center">
                      <div className="w-full h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categories}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {categories.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', color: '#16202A' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Legend list */}
                      <div className="w-full grid grid-cols-2 gap-1.5 text-[10px] mt-2">
                        {categories.map((cat, idx) => (
                          <div key={idx} className="flex items-center space-x-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            ></span>
                            <span className="text-ink-soft truncate font-semibold">{cat.name}: {cat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Chart 3: Star Rating Distribution */}
                  <div className="bg-card p-5 rounded-2xl border border-line">
                    <h4 className="font-extrabold text-ink text-sm mb-4">Star Satisfaction Distribution</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ratingsDist} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 230, 236, 0.9)" />
                          <XAxis type="number" stroke="#88919B" style={{ fontSize: '11px' }} allowDecimals={false} />
                          {/* Fix: this axis was silently skipping tick labels
                              (only "1" and "3" ever showed) because Recharts'
                              default label-collision logic thins out
                              category ticks. interval={0} forces every one
                              of the 5 star buckets to render regardless. */}
                          <YAxis dataKey="rating" type="category" stroke="#88919B" style={{ fontSize: '11px' }} interval={0} />
                          <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E6EC', color: '#16202A' }} />
                          <Bar dataKey="count" fill="#D97706" radius={[0, 8, 8, 0]} name="Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Feed Section: Recent User Feedback */}
                  <div className="bg-card p-5 rounded-2xl border border-line lg:col-span-2 flex flex-col">
                    <h4 className="font-extrabold text-ink text-sm mb-4">Recent Customer Satisfaction Reviews</h4>
                    <div className="flex-1 overflow-y-auto max-h-64 space-y-3 pr-2 animate-fade-in">
                      {feedbackLogs.length === 0 ? (
                        <div className="text-center py-10 text-ink-faint text-xs">No feedback comments logged yet.</div>
                      ) : (
                        feedbackLogs.map((log) => (
                          <div key={log.id} className="p-3.5 bg-paper border border-line rounded-xl space-y-1 text-left">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-xs text-ink">{log.userName}</span>
                              <div className="flex items-center space-x-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3.5 h-3.5 ${
                                      star <= log.rating ? 'text-status-amber fill-amber-400' : 'text-ink-soft'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {log.title && (
                              <p className="text-[10px] font-bold text-hub font-mono">Topic: {log.title}</p>
                            )}
                            <p className="text-xs text-ink-soft mt-1.5 italic">
                              {log.feedback ? `"${log.feedback}"` : 'No written comment left.'}
                            </p>
                            <div className="flex justify-between items-center pt-2 text-[9px] text-ink-faint">
                              <span>
                                Status:{' '}
                                <strong>
                                  {log.status === 'ticket_open'
                                    ? 'Ticket open'
                                    : log.status === 'ticket_resolved'
                                    ? 'Resolved'
                                    : 'Active'}
                                </strong>
                              </span>
                              <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* TAB 2: KNOWLEDGE BASE RAG */}
        {activeTab === 'kb' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* List indexed documents */}
            <div className="bg-card p-5 rounded-2xl border border-line lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center border-b border-line pb-3">
                <h4 className="font-extrabold text-ink text-base">Grounded Documents</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-hub/10 border border-hub/20 font-bold text-hub px-3 py-1 rounded-full">
                    {documents.length} Articles Indexed
                  </span>
                  <button
                    onClick={handleRebuildIndex}
                    disabled={rebuildingIndex}
                    title="Wipe and re-embed the vector search index strictly from the documents listed below -- fixes the bot citing documents that don't appear in this list"
                    className="flex items-center px-2.5 py-1 bg-surface hover:bg-hub-soft text-ink-soft hover:text-hub rounded-full text-[11px] font-bold transition-all border border-line disabled:opacity-50"
                  >
                    <Wrench className={`w-3 h-3 mr-1 ${rebuildingIndex ? 'animate-spin' : ''}`} />
                    {rebuildingIndex ? 'Rebuilding...' : 'Rebuild Index'}
                  </button>
                </div>
              </div>

              {rebuildStatus && (
                <div
                  className={`p-3 rounded-xl flex items-center text-xs font-bold space-x-2 ${
                    rebuildStatus.type === 'success'
                      ? 'bg-status-green-soft text-status-green'
                      : 'bg-status-red-soft text-status-red'
                  }`}
                >
                  {rebuildStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>{rebuildStatus.message}</span>
                </div>
              )}

              {loadingKB ? (
                <div className="space-y-2.5 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="p-4 bg-paper border border-line rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                    >
                      <div className="flex items-start space-x-3.5 w-full">
                        <div className="w-10 h-10 bg-surface rounded-xl flex-shrink-0"></div>
                        <div className="space-y-2 flex-grow">
                          <div className="h-4 bg-surface w-1/3 rounded-md"></div>
                          <div className="flex space-x-3.5 mt-1">
                            <div className="h-3 bg-surface w-12 rounded"></div>
                            <div className="h-3 bg-surface w-16 rounded"></div>
                            <div className="h-3 bg-surface w-16 rounded"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2 w-full sm:w-auto justify-end">
                        <div className="h-8 bg-surface w-28 rounded-lg"></div>
                        <div className="h-8 bg-surface w-8 rounded-lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-20 text-ink-faint text-xs">No documents uploaded to database yet.</div>
              ) : (
                <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 bg-paper border border-line rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-hub/30 transition-all text-left"
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className="p-2.5 bg-hub/10 rounded-xl text-hub flex-shrink-0 border border-hub/10">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="font-bold text-ink text-sm">{doc.name}</h5>
                          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-ink-soft text-xs mt-1">
                            <span className="uppercase font-bold bg-surface text-ink px-1.5 py-0.5 rounded text-[10px]">
                              {doc.type}
                            </span>
                            <span>{doc.wordCount} words</span>
                            <span>{doc.chunkCount} chunks</span>
                            <span>{(doc.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => setViewingDoc(doc)}
                          className="p-1.5 rounded-lg border border-line hover:bg-card text-ink-soft hover:text-ink hover:border-hub/35 transition-all flex items-center justify-center text-xs font-semibold"
                          title="View raw parsed contents"
                        >
                          <Eye className="w-4 h-4 mr-1.5" />
                          View Contents
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded-lg border border-status-red/35 bg-status-red-soft text-status-red hover:bg-status-red-soft transition-all flex items-center justify-center"
                          title="Delete from model database"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document upload / paste console */}
            <div className="bg-card p-5 rounded-2xl border border-line space-y-4">
              <h4 className="font-extrabold text-ink text-base">Index New FAQ or Manual</h4>
              <p className="text-xs text-ink-soft leading-relaxed">
                Provide rich textual articles below. Our vectorizer automatically segments articles into distinct chunks to allow context-relevant answers.
              </p>

              <form onSubmit={handleUploadDocument} className="space-y-4 text-left">
                {/* Drag and Drop File Zone */}
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handleFileSelect(files[0]);
                    }
                  }}
                  onClick={() => {
                    const fileInput = document.getElementById('kb-file-input');
                    if (fileInput) fileInput.click();
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                    isDragging 
                      ? 'border-hub bg-hub/10' 
                      : 'border-line bg-paper hover:border-ink-faint hover:bg-paper'
                  }`}
                >
                  <input 
                    type="file" 
                    id="kb-file-input" 
                    className="hidden" 
                    accept=".txt,.pdf,.json"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleFileSelect(files[0]);
                      }
                    }}
                  />
                  <Upload className="w-8 h-8 text-ink-faint mx-auto mb-2 animate-bounce" />
                  <p className="text-xs font-bold text-ink">Drag & Drop or Choose Document File</p>
                  <p className="text-[10px] text-ink-faint mt-1">
                    {uploadFile ? `Selected: ${uploadFile.name} (parsed server-side on upload)` : 'Supports PDF, TXT, or JSON up to 10MB \u2014 PDFs are parsed on the backend'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Article Title</label>
                  <input
                    type="text"
                    required
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="e.g. Return shipping rates guide"
                    disabled={uploadStatus !== 'idle'}
                    className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Source Type</label>
                  <select
                    value={uploadType}
                    onChange={(e: any) => setUploadType(e.target.value)}
                    disabled={uploadStatus !== 'idle'}
                    className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-hub/50"
                  >
                    <option value="faq">FAQ</option>
                    <option value="policy">Policy / Warranties</option>
                    <option value="manual">Operation Manual / Guides</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink-faint mb-1">
                    Text Contents {uploadFile && <span className="text-ink-faint normal-case font-normal">(not needed \u2014 using uploaded file)</span>}
                  </label>
                  <textarea
                    rows={8}
                    value={uploadContent}
                    onChange={(e) => setUploadContent(e.target.value)}
                    placeholder="Paste paragraphs of information here. Be specific with details (numbers, prices, models) so the RAG model returns accurate grounding answers."
                    disabled={uploadStatus !== 'idle' || !!uploadFile}
                    className="w-full bg-paper border border-line rounded-xl p-3 text-sm text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/50 font-sans disabled:opacity-50"
                  ></textarea>
                </div>

                {uploadStatus === 'idle' && (
                  <button
                    type="submit"
                    disabled={!uploadName.trim() || (!uploadContent.trim() && !uploadFile)}
                    className="w-full bg-hub hover:bg-hub-dark disabled:bg-surface disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-hub/15 flex items-center justify-center text-sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Add to Knowledge Base
                  </button>
                )}

                {/* Live upload pipeline (real backend chunking + embedding) */}
                {uploadStatus === 'chunking' && (
                  <div className="bg-hub-soft border border-hub/40 p-4 rounded-xl text-center space-y-2">
                    <RefreshCw className="w-5 h-5 text-hub animate-spin mx-auto" />
                    <p className="text-xs font-bold text-hub">Extracting text & chunking content...</p>
                    <p className="text-[10px] text-hub/70">Splitting into roughly {docChunksPreview} segments via LangChain's text splitter.</p>
                  </div>
                )}

                {uploadStatus === 'indexing' && (
                  <div className="bg-hub-soft border border-hub/40 p-4 rounded-xl text-center space-y-2 animate-pulse">
                    <Sliders className="w-5 h-5 text-hub mx-auto" />
                    <p className="text-xs font-bold text-hub">Embedding chunks into ChromaDB...</p>
                    <p className="text-[10px] text-hub/70">Generating Sentence-Transformers vectors and writing to the vector index.</p>
                  </div>
                )}

                {uploadStatus === 'success' && (
                  <div className="bg-status-green-soft border border-status-green/50 p-4 rounded-xl text-center space-y-1">
                    <CheckCircle2 className="w-5 h-5 text-status-green mx-auto" />
                    <p className="text-xs font-bold text-status-green">Indexing Success!</p>
                    <p className="text-[10px] text-status-green/70">This is now saved and the chatbot can use it to answer questions.</p>
                  </div>
                )}
              </form>
            </div>

            {/* Document contents viewer modal */}
            {viewingDoc && (
              <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                <div className="bg-card border border-line rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="flex justify-between items-center border-b border-line pb-3 mb-4">
                    <h5 className="font-extrabold text-ink text-lg flex items-center">
                      <FileText className="w-5 h-5 text-hub mr-2" />
                      {viewingDoc.name}
                    </h5>
                    <button
                      onClick={() => setViewingDoc(null)}
                      className="text-ink-faint hover:text-ink-soft font-bold px-2 py-1 text-sm"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto text-left space-y-3 p-4 bg-paper border border-line rounded-xl font-sans text-xs text-ink leading-relaxed whitespace-pre-wrap">
                    {viewingDoc.content}
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex justify-between items-center text-[11px] text-ink-faint">
                    <span>Uploaded: {new Date(viewingDoc.uploadedAt).toLocaleString()}</span>
                    <span>Chunks: {viewingDoc.chunkCount} segments</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: USER CONVERSATIONS (Escalations) */}
        {activeTab === 'chats' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Conversation list */}
            <div className="bg-card p-5 rounded-2xl border border-line space-y-4">
              <h4 className="font-extrabold text-ink text-base">History & Escalated Tickets</h4>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                {loadingChats ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="p-4 bg-paper border border-line rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="h-4 bg-surface w-28 rounded-md"></div>
                          <div className="h-3 bg-surface w-12 rounded-md"></div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="h-3 bg-surface w-20 rounded-md"></div>
                          <div className="h-4 bg-surface w-16 rounded-full"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-10 text-ink-faint text-xs">No user chats logged yet.</div>
                ) : (
                  conversations.map((conv) => {
                    const isSelected = selectedConv?.id === conv.id;

                    return (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConv(conv)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col ${
                          isSelected
                            ? 'bg-hub/10 border-hub/40'
                            : 'border-transparent hover:bg-surface'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="font-bold text-ink text-sm truncate max-w-[140px]">
                            {conv.title}
                          </span>
                          <span className="text-[10px] text-ink-faint">
                            {new Date(conv.lastMessageAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center w-full mt-2">
                          <span className="text-xs text-ink-soft font-semibold flex items-center">
                            <Users className="w-3 h-3 text-ink-faint mr-1" />
                            {conv.userName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {conv.humanHandling && (
                              <span
                                className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-hub-soft text-hub border border-hub/30"
                                title="An admin has replied in this thread; the bot has paused"
                              >
                                Agent Joined
                              </span>
                            )}
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                conv.status === 'ticket_open'
                                  ? 'bg-status-amber-soft text-status-amber border border-status-amber/30 animate-pulse'
                                  : conv.status === 'ticket_resolved'
                                  ? 'bg-status-green-soft text-status-green border border-status-green/30'
                                  : 'bg-surface text-ink-soft border border-line'
                              }`}
                            >
                              {conv.status === 'ticket_open'
                                ? (conv.escalationReason === 'user_requested' ? 'Human Requested' : 'Ticket Open')
                                : conv.status === 'ticket_resolved'
                                ? 'Resolved'
                                : 'Bot Active'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Transcription & action panel */}
            <div className="bg-card p-5 rounded-2xl border border-line lg:col-span-2 flex flex-col min-h-[500px]">
              {selectedConv ? (
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    {/* Header info */}
                    <div className="flex justify-between items-start border-b border-line pb-4 mb-4">
                      <div>
                        <h4 className="font-extrabold text-ink text-base">{selectedConv.title}</h4>
                        <div className="flex items-center space-x-3.5 text-xs text-ink-soft mt-1">
                          <span>User: <strong>{selectedConv.userName}</strong></span>
                          <span>Category: <strong className="text-hub">{selectedConv.category || 'General'}</strong></span>
                          {selectedConv.escalationReason === 'user_requested' && (
                            <span className="text-status-amber font-bold flex items-center">
                              <HelpCircle className="w-3.5 h-3.5 mr-1" />
                              Requested a human
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {selectedConv.status === 'ticket_open' && (
                          <button
                            onClick={() => handleResolveTicket(selectedConv.id)}
                            className="flex items-center bg-status-green hover:bg-status-green-dark text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-lg shadow-status-green/15"
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Mark Resolved
                          </button>
                        )}
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                            selectedConv.status === 'ticket_open'
                              ? 'bg-status-amber-soft text-status-amber border border-status-amber/30'
                              : selectedConv.status === 'ticket_resolved'
                              ? 'bg-status-green-soft text-status-green border border-status-green/30'
                              : 'bg-surface text-ink-soft border border-line'
                          }`}
                        >
                          {selectedConv.status === 'ticket_open'
                            ? 'Escalated Customer Support Ticket'
                            : selectedConv.status === 'ticket_resolved'
                            ? 'Resolved support dispute'
                            : 'Standard Bot Chat'}
                        </span>
                      </div>
                    </div>

                    {/* Chat transcript list */}
                    <div className="space-y-4 max-h-[350px] overflow-y-auto p-4 border border-line rounded-2xl bg-paper">
                      {selectedConv.messages.map((msg: any, sIdx: number) => {
                        const isBot = msg.sender === 'bot';
                        const isAdmin = msg.sender === 'admin';
                        return (
                          <div key={sIdx} className={`flex ${isBot || isAdmin ? 'justify-start' : 'justify-end'}`}>
                            <div className="max-w-[80%] flex items-start space-x-2 text-left">
                              {isBot && (
                                <div className="w-6.5 h-6.5 rounded bg-hub text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                  Bot
                                </div>
                              )}
                              {isAdmin && (
                                <div className="w-6.5 h-6.5 rounded bg-status-green text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                  You
                                </div>
                              )}
                              <div>
                                <div
                                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                    isBot
                                      ? 'bg-card text-ink border border-line rounded-tl-none'
                                      : isAdmin
                                      ? 'bg-status-green-soft text-ink border border-status-green/30 rounded-tl-none'
                                      : 'bg-hub text-white rounded-tr-none'
                                  }`}
                                >
                                  <p>{msg.text}</p>
                                  {isBot && msg.sources && (
                                    <p className="text-[10px] text-hub font-bold mt-1.5 uppercase">
                                      Cited: {msg.sources.join(', ')}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[9px] text-ink-faint mt-0.5 block">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Fix #3: admin reply compose box -- previously this
                        panel was entirely read-only, with no way to answer
                        the customer directly from here. */}
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendAdminReply();
                          }
                        }}
                        placeholder="Reply to this customer as an agent..."
                        disabled={selectedConv.status === 'ticket_resolved' || sendingReply}
                        className="flex-1 bg-paper border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/50 disabled:opacity-50"
                      />
                      <button
                        onClick={handleSendAdminReply}
                        disabled={!replyText.trim() || selectedConv.status === 'ticket_resolved' || sendingReply}
                        className="flex items-center bg-hub hover:bg-hub-dark disabled:bg-surface disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {sendingReply ? 'Sending...' : 'Reply'}
                      </button>
                    </div>
                    {selectedConv.humanHandling && (
                      <p className="text-[10px] text-ink-faint mt-1.5 flex items-center">
                        <UserCog className="w-3 h-3 mr-1 text-hub" />
                        The bot has paused auto-replies for this thread since {selectedConv.assignedAdminName || 'an admin'} joined.
                      </p>
                    )}
                  </div>

                  {/* Rating / action footer */}
                  <div className="mt-6 pt-4 border-t border-line flex flex-col sm:flex-row justify-between items-center gap-4 bg-paper p-4 rounded-xl">
                    <div className="text-left w-full sm:w-auto">
                      <span className="text-xs font-bold text-ink-faint uppercase tracking-wider block">Customer Satisfaction rating</span>
                      {selectedConv.rating ? (
                        <div className="flex items-center mt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 mr-0.5 ${
                                star <= selectedConv.rating ? 'text-status-amber fill-amber-400' : 'text-ink-soft'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-ink ml-1.5">{selectedConv.rating} / 5 Stars</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-faint italic font-semibold mt-1 block">No rating provided yet</span>
                      )}
                    </div>

                    <div className="text-right w-full sm:w-auto">
                      <span className="text-xs font-bold text-ink-faint uppercase tracking-wider block">Customer Feedback Comments</span>
                      <p className="text-xs text-ink-soft mt-1 italic font-semibold truncate max-w-xs">
                        "{selectedConv.feedbackText || 'None provided'}"
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center text-ink-faint py-16">
                  <Eye className="w-12 h-12 text-ink-soft mb-2" />
                  <p className="text-sm font-semibold">Select a conversation from the list</p>
                  <p className="text-xs max-w-xs mt-1">Review full conversation logs, check citings, inspect star ratings, or click resolve on open tickets.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 4: BOT CONFIG / SETTINGS */}
        {activeTab === 'settings' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-4xl mx-auto"
          >
            {loadingSettings || !settings ? (
              <div className="bg-card p-6 rounded-2xl border border-line space-y-6 animate-pulse text-left">
                <div className="flex justify-between items-center border-b border-line pb-3">
                  <div className="h-5 bg-surface w-48 rounded-md"></div>
                  <div className="h-8 bg-surface w-28 rounded-xl"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="h-3 bg-surface w-32 rounded-md"></div>
                      <div className="h-9 bg-paper border border-line rounded-xl"></div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 bg-surface w-36 rounded-md"></div>
                      <div className="h-20 bg-paper border border-line rounded-xl"></div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 bg-surface w-44 rounded-md"></div>
                      <div className="h-20 bg-paper border border-line rounded-xl"></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="h-3 bg-surface w-40 rounded-md"></div>
                      <div className="h-28 bg-paper border border-line rounded-xl"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-16 bg-paper border border-line rounded-xl"></div>
                      <div className="h-16 bg-paper border border-line rounded-xl"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-16 bg-paper border border-line rounded-xl"></div>
                      <div className="h-16 bg-paper border border-line rounded-xl"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveSettings} className="bg-card p-6 rounded-2xl border border-line space-y-6 text-left">
                <div className="flex justify-between items-center border-b border-line pb-3 mb-2">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-5 h-5 text-hub" />
                    <h4 className="font-extrabold text-ink text-base">Bot & RAG Configuration Controls</h4>
                  </div>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="flex items-center bg-hub hover:bg-hub-dark disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-hub/15 transition-all"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>

                {settingsStatus === 'success' && (
                  <div className="bg-status-green-soft border border-status-green/50 p-4 rounded-xl flex items-center text-xs text-status-green font-bold space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-status-green" />
                    <span>Configurations written to db.json successfully. All RAG retrievals updated in real-time.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Basic Text variables */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Support Assistant Name</label>
                      <input
                        type="text"
                        required
                        value={settings.chatbotName}
                        onChange={(e) => setSettings({ ...settings, chatbotName: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/50 focus:bg-card"
                      />
                      {/* This field is exactly why the chat header showed
                          "NEXORA AI CHAT BOT" in your screenshots -- it's
                          not a code bug, it's just what's saved here. Set
                          it to whatever name you want shown everywhere. */}
                      <p className="text-[10px] text-ink-faint mt-1">This exact name is shown as the chat header on the customer side.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Bot Welcome Message</label>
                      <textarea
                        required
                        rows={3}
                        value={settings.welcomeMessage}
                        onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-hub/50 focus:bg-card"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Fallback Message (No Context Match)</label>
                      <textarea
                        required
                        rows={3}
                        value={settings.fallbackMessage}
                        onChange={(e) => setSettings({ ...settings, fallbackMessage: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-hub/50 focus:bg-card"
                      ></textarea>
                    </div>
                  </div>

                  {/* Right Column: Model Sliders & Toggles */}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold uppercase text-ink-faint mb-1">System instructions & RAG prompt</label>
                      <textarea
                        required
                        rows={5}
                        value={settings.systemPrompt}
                        onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                        className="w-full bg-paper border border-line rounded-xl p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-hub/50 focus:bg-card font-mono"
                      ></textarea>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Temperature slider */}
                      <div className="bg-paper p-3.5 rounded-xl border border-line">
                        <label className="block text-xs font-bold uppercase text-ink-faint mb-1 flex justify-between">
                          <span>Temperature</span>
                          <span className="text-hub font-bold">{settings.temperature}</span>
                        </label>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.1"
                          value={settings.temperature}
                          onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                          className="w-full accent-blue-500 mt-2"
                        />
                        <span className="text-[10px] text-ink-faint">Lower values make answers precise.</span>
                      </div>

                      {/* Max RAG Sources */}
                      <div className="bg-paper p-3.5 rounded-xl border border-line">
                        <label className="block text-xs font-bold uppercase text-ink-faint mb-1 flex justify-between">
                          <span>Max Sources</span>
                          <span className="text-hub font-bold">{settings.maxSources} chunks</span>
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={settings.maxSources}
                          onChange={(e) => setSettings({ ...settings, maxSources: parseInt(e.target.value) })}
                          className="w-full accent-blue-500 mt-2"
                        />
                        <span className="text-[10px] text-ink-faint">Determines document retrieval density.</span>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="flex items-center justify-between p-3.5 border border-line bg-paper rounded-xl">
                        <div>
                          <span className="font-bold text-xs text-ink">Answer using Knowledge Base</span>
                          <span className="text-[10px] text-ink-faint block">Uses knowledge database answers</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.ragEnabled}
                          onChange={(e) => setSettings({ ...settings, ragEnabled: e.target.checked })}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3.5 border border-line bg-paper rounded-xl">
                        <div>
                          <span className="font-bold text-xs text-ink">Auto Ticket bad review</span>
                          <span className="text-[10px] text-ink-faint block">Auto-escalates 1-2 star reviews</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings.autoTicketOnLowRating}
                          onChange={(e) => setSettings({ ...settings, autoTicketOnLowRating: e.target.checked })}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Team access -- the only place a new admin account can be created.
                Public registration can never produce one (see auth.py). */}
            <div className="bg-card p-6 rounded-2xl border border-line mt-6 space-y-4">
              <div className="flex items-center space-x-2 border-b border-line pb-3">
                <Shield className="w-5 h-5 text-hub" />
                <h4 className="font-extrabold text-ink text-base">Team Access</h4>
              </div>
              <p className="text-xs text-ink-soft -mt-1">
                Give another teammate admin access. They'll be able to sign in immediately with the credentials below.
              </p>

              {createAdminStatus && (
                <div
                  className={`p-3 rounded-xl flex items-center text-xs font-bold space-x-2 ${
                    createAdminStatus.type === 'success'
                      ? 'bg-status-green-soft text-status-green'
                      : 'bg-status-red-soft text-status-red'
                  }`}
                >
                  {createAdminStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  <span>{createAdminStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Jordan Lee"
                    className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/50 focus:bg-card"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="jordan@example.com"
                    className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/50 focus:bg-card"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-ink-faint mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-paper border border-line rounded-xl px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-hub/50 focus:bg-card"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={creatingAdmin}
                    className="flex items-center bg-hub hover:bg-hub-dark disabled:opacity-50 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-lg shadow-hub/15 transition-all"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    {creatingAdmin ? 'Creating...' : 'Create Admin Account'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
