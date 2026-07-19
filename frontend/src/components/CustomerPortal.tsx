import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Plus,
  Compass,
  ArrowRight,
  Radio,
  AlertCircle,
  CheckCircle2,
  Star,
  User,
  LogOut,
  HelpCircle,
  FileText,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Globe,
  Languages,
  Bell,
  Check,
  UserCog,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message, BotSettings, AppNotification } from '../types';
import { apiFetch } from '../api';
import { StatusDot } from './StatusDot';

const LANGUAGES_SUPPORTED = [
  { code: 'en', name: 'English', flag: '🇺🇸', placeholder: 'Type your support question...', emptyTitle: 'SmartHelp Knowledge Grounded', emptyDescription: 'Ask any question about our products and services, grounded in our latest support documentation.' },
  { code: 'hi', name: 'हिन्दी (Hindi)', flag: '🇮🇳', placeholder: 'अपना सहायता प्रश्न लिखें...', emptyTitle: 'स्मार्टहेल्प नॉलेज बेस', emptyDescription: 'हमारे उत्पादों और सेवाओं के बारे में कोई भी प्रश्न पूछें, जो हमारे नवीनतम सहायता दस्तावेज़ों पर आधारित है।' },
  { code: 'ta', name: 'தமிழ் (Tamil)', flag: '🇮🇳', placeholder: 'உங்கள் ஆதரவு கேள்வியை தட்டச்சு செய்யவும்...', emptyTitle: 'ஸ்மார்ட்ஹெல்ப் அறிவுத் தளம்', emptyDescription: 'எங்கள் தயாரிப்புகள் மற்றும் சேவைகள் பற்றி எந்த கேள்வியையும் கேளுங்கள்.' },
  { code: 'te', name: 'తెలుగు (Telugu)', flag: '🇮🇳', placeholder: 'మీ మద్దతు ప్రశ్నను టైప్ చేయండి...', emptyTitle: 'స్మార్ట్‌హెల్ప్ నాలెడ్జ్ బేస్', emptyDescription: 'మా ఉత్పత్తులు మరియు సేవల గురించి ఏదైనా ప్రశ్న అడగండి.' },
  { code: 'bn', name: 'বাংলা (Bengali)', flag: '🇮🇳', placeholder: 'আপনার সহায়তা প্রশ্ন টাইপ করুন...', emptyTitle: 'স্মার্টহেল্প নলেজ বেস', emptyDescription: 'আমাদের পণ্য এবং পরিষেবা সম্পর্কে যেকোনো প্রশ্ন জিজ্ঞাসা করুন।' },
  { code: 'mr', name: 'मराठी (Marathi)', flag: '🇮🇳', placeholder: 'तुमचा सहाय्य प्रश्न टाइप करा...', emptyTitle: 'स्मार्टहेल्प नॉलेज बेस', emptyDescription: 'आमच्या उत्पादनांबद्दल आणि सेवांबद्दल कोणताही प्रश्न विचारा.' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)', flag: '🇮🇳', placeholder: 'તમારો સપોર્ટ પ્રશ્ન ટાઈપ કરો...', emptyTitle: 'સ્માર્ટહેલ્પ નોલેજ બેઝ', emptyDescription: 'અમારા ઉત્પાદનો અને સેવાઓ વિશે કોઈપણ પ્રશ્ન પૂછો.' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳', placeholder: 'ನಿಮ್ಮ ಬೆಂಬಲ ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ...', emptyTitle: 'ಸ್ಮಾರ್ಟ್‌ಹೆಲ್ಪ್ ಜ್ಞಾನ ಬೇಸ್', emptyDescription: 'ನಮ್ಮ ಉತ್ಪನ್ನಗಳು ಮತ್ತು ಸೇವೆಗಳ ಬಗ್ಗೆ ಯಾವುದೇ ಪ್ರಶ್ನೆ ಕೇಳಿ.' },
  { code: 'ml', name: 'മലയാളം (Malayalam)', flag: '🇮🇳', placeholder: 'നിങ്ങളുടെ പിന്തുണ ചോദ്യം ടൈപ്പ് ചെയ്യുക...', emptyTitle: 'സ്മാർട്ട്ഹെൽപ്പ് നോളജ് ബേസ്', emptyDescription: 'ഞങ്ങളുടെ ഉൽപ്പന്നങ്ങളെയും സേവനങ്ങളെയും കുറിച്ച് എന്ത് ചോദ്യവും ചോദിക്കുക.' },
  { code: 'es', name: 'Español', flag: '🇪🇸', placeholder: 'Escribe tu pregunta de soporte...', emptyTitle: 'Base de conocimiento de SmartHelp', emptyDescription: 'Haz cualquier pregunta sobre nuestros productos y servicios.' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', placeholder: 'Posez votre question de support...', emptyTitle: 'Base de connaissances SmartHelp', emptyDescription: 'Posez vos questions sur nos produits et services.' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', placeholder: 'Geben Sie Ihre Support-Frage ein...', emptyTitle: 'SmartHelp-Wissensdatenbank', emptyDescription: 'Stellen Sie Fragen zu unseren Produkten und Dienstleistungen.' },
  { code: 'zh', name: '中文 (Chinese)', flag: '🇨🇳', placeholder: '输入您的技术支持问题...', emptyTitle: 'SmartHelp 知识库已建立', emptyDescription: '针对我们的产品和服务提出任何问题。' },
  { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵', placeholder: 'サポートの質問を入力してください...', emptyTitle: 'SmartHelp ナレッジベース搭載', emptyDescription: '製品やサービスに関する質問を何でも入力してください。' }
];

// Fix #1: the old hardcoded SUGGESTED_QUESTIONS object (6 languages x 4
// fixed questions, identical for every business/deployment) is gone.
// Chips are now fetched from GET /api/chat/suggested-questions, which
// derives them from real historical questions or the actual documents in
// the knowledge base -- see chat.py for the fallback chain.
interface SuggestedQuestion {
  label: string;
  query: string;
}

interface CustomerPortalProps {
  user: { id: string; name: string; email: string; role: 'admin' | 'user' };
  token: string;
  onLogout: () => void;
}

export default function CustomerPortal({ user, token, onLogout }: CustomerPortalProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);

  // Dynamic suggested questions (fix #1)
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  // Rating state -- now a small popover that's always reachable from the
  // header and can be re-opened/edited at any point in an active
  // conversation, instead of a one-shot panel that locks after first
  // submit (fix #2a).
  const [showRatingPanel, setShowRatingPanel] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [tempRating, setTempRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  // "Talk to a person" now has its own state/banner, entirely separate
  // from the rating flow (fix #2b).
  const [escalating, setEscalating] = useState(false);
  const [escalationBanner, setEscalationBanner] = useState(false);

  // Voice and Language States
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [autoSpeak, setAutoSpeak] = useState(false);

  // Notifications ("your ticket was resolved", etc.) -- scoped to this
  // customer only; separate from the admin-only notification feed.
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch conversations and settings on load
  const fetchConversations = async () => {
    try {
      const res = await apiFetch('/api/chat');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0 && !activeConv) {
          setActiveConv(data[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching chats", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setBotSettings(data);
      }
    } catch (err) {
      console.error("Error fetching settings", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Error fetching notifications", err);
    }
  };

  const fetchSuggestedQuestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await apiFetch('/api/chat/suggested-questions');
      if (res.ok) {
        const data = await res.json();
        setSuggestedQuestions(data);
      }
    } catch (err) {
      console.error("Error fetching suggested questions", err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking notifications read", err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error("Error marking notification read", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      try {
        await Promise.allSettled([
          fetchConversations(),
          fetchSettings(),
          fetchNotifications(),
          fetchSuggestedQuestions()
        ]);
      } catch (err) {
        console.error("Initialization error", err);
      } finally {
        setInitialLoading(false);
      }
    };
    init();
  }, []);

  // Sync rating panel state when active conversation changes -- reflects
  // whatever was last saved for THIS conversation, but stays editable.
  useEffect(() => {
    if (activeConv) {
      setSelectedRating(activeConv.rating || null);
      setTempRating(activeConv.rating || null);
      setFeedbackText(activeConv.feedbackText || '');
      setShowRatingPanel(false);
      setEscalationBanner(false);
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    // Scroll to bottom
    scrollToBottom();
  }, [activeConv?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleStartNewChat = async () => {
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/chat/new', {
        method: 'POST',
        body: JSON.stringify({ firstMessage: '' })
      });
      if (res.ok) {
        const newChat = await res.json();
        // Append welcome message if available
        if (botSettings) {
          newChat.messages = [
            {
              id: `msg-welcome`,
              sender: 'bot',
              text: botSettings.welcomeMessage,
              timestamp: new Date().toISOString()
            }
          ];
        }
        setConversations([newChat, ...conversations]);
        setActiveConv(newChat);
        // Refresh suggestions -- a brand new empty conversation is exactly
        // where these chips are shown, so make sure they're current.
        fetchSuggestedQuestions();
      }
    } catch (err) {
      console.error("Error starting new chat", err);
    }
  };

  // Speech-to-Text: Web Speech Recognition API
  const handleStartListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg("Your browser does not support Speech Recognition. Please try Google Chrome or Safari.");
      return;
    }

    try {
      if (isListening) {
        // If already listening, stop it
        setIsListening(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      const langMap: Record<string, string> = {
        en: 'en-US',
        hi: 'hi-IN',
        ta: 'ta-IN',
        te: 'te-IN',
        bn: 'bn-IN',
        mr: 'mr-IN',
        gu: 'gu-IN',
        kn: 'kn-IN',
        ml: 'ml-IN',
        es: 'es-ES',
        fr: 'fr-FR',
        de: 'de-DE',
        zh: 'zh-CN',
        ja: 'ja-JP'
      };
      recognition.lang = langMap[selectedLanguage] || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onerror = (e: any) => {
        console.error("Speech Recognition Error", e);
        setIsListening(false);
        if (e.error === 'not-allowed') {
          setErrorMsg("Microphone permission denied. Please allow microphone access in your browser.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputValue(prev => prev + (prev ? " " : "") + transcript);
        }
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  // Text-to-Speech: Web Speech Synthesis API
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (!window.speechSynthesis) {
      setErrorMsg("Your browser does not support Text-to-Speech synthesis.");
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Remove RAG citations e.g. [Document Name] for cleaner pronunciation
    const cleanedText = text.replace(/\[([^\]]+)\]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    const voiceLangMap: Record<string, string> = {
      en: 'en-US',
      hi: 'hi-IN',
      ta: 'ta-IN',
      te: 'te-IN',
      bn: 'bn-IN',
      mr: 'mr-IN',
      gu: 'gu-IN',
      kn: 'kn-IN',
      ml: 'ml-IN',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      zh: 'zh-CN',
      ja: 'ja-JP'
    };
    utterance.lang = voiceLangMap[selectedLanguage] || 'en-US';

    utterance.onstart = () => {
      setSpeakingMessageId(msgId);
    };

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeConv || loading) return;

    const userText = inputValue.trim();
    setInputValue('');
    setLoading(true);
    setTyping(true);
    setErrorMsg('');

    // Pre-insert user message in local state for speed
    const updatedMessages = [
      ...activeConv.messages,
      {
        id: `temp-user-${Date.now()}`,
        sender: 'user' as const,
        text: userText,
        timestamp: new Date().toISOString()
      }
    ];

    const currentConv = {
      ...activeConv,
      messages: updatedMessages
    };

    setActiveConv(currentConv);
    scrollToBottom();

    try {
      const res = await apiFetch('/api/chat/message', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConv.id,
          text: userText,
          language: selectedLanguage
        })
      });

      if (!res.ok) {
        throw new Error('Failed to get bot response');
      }

      const data = await res.json();
      setActiveConv(data.conversation);

      // Refresh list
      setConversations(prev =>
        prev.map(c => (c.id === data.conversation.id ? data.conversation : c))
      );

      // Auto TTS if enabled -- only if there actually was a bot reply (a
      // human-handled thread returns reply: null, since the bot stays
      // silent once an admin has joined).
      const lastMsg = data.conversation.messages[data.conversation.messages.length - 1];
      if (autoSpeak && data.reply && lastMsg && lastMsg.sender === 'bot') {
        handleToggleSpeak(lastMsg.id || `msg-${Date.now()}`, lastMsg.text);
      }
    } catch (err: any) {
      setErrorMsg('The AI service is temporarily offline or unconfigured. Operating in local standby mode.');
      // Local fallback reply
      const fallbackReply: Message = {
        id: `msg-local-${Date.now()}`,
        sender: 'bot',
        text: botSettings?.fallbackMessage || "My system is offline, but I will log this query.",
        timestamp: new Date().toISOString(),
        sources: ["Offline Help Center"]
      };

      const finalLocalConv = {
        ...currentConv,
        messages: [...updatedMessages, fallbackReply]
      };
      setActiveConv(finalLocalConv);
      setConversations(prev =>
        prev.map(c => (c.id === currentConv.id ? finalLocalConv : c))
      );

      // Auto TTS if enabled
      if (autoSpeak) {
        handleToggleSpeak(fallbackReply.id, fallbackReply.text);
      }
    } finally {
      setLoading(false);
      setTyping(false);
      scrollToBottom();
    }
  };

  // Fix #2a: rating is now editable indefinitely, not locked after one
  // submit. Every click here re-POSTs to /api/chat/rate, which now appends
  // to a history server-side rather than overwriting a single frozen
  // value -- see chat.py.
  const handleFeedbackSubmit = async () => {
    if (!activeConv || selectedRating === null || savingRating) return;
    setSavingRating(true);
    try {
      const res = await apiFetch('/api/chat/rate', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConv.id,
          rating: selectedRating,
          feedbackText: feedbackText
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveConv(data.conversation);
        setConversations(prev =>
          prev.map(c => (c.id === data.conversation.id ? data.conversation : c))
        );
        setShowRatingPanel(false);
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error submitting feedback", err);
    } finally {
      setSavingRating(false);
    }
  };

  // Fix #2b: "Talk to a person" now calls its own endpoint. It no longer
  // fakes a 1-star rating, no longer touches feedbackText, and the thread
  // stays exactly as-is -- just flagged for a human and a banner shown.
  const handleEscalateTicket = async () => {
    if (!activeConv || escalating) return;
    setEscalating(true);
    try {
      const res = await apiFetch('/api/chat/escalate', {
        method: 'POST',
        body: JSON.stringify({ conversationId: activeConv.id })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveConv(data.conversation);
        setConversations(prev =>
          prev.map(c => (c.id === data.conversation.id ? data.conversation : c))
        );
        setEscalationBanner(true);
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error escalating conversation", err);
    } finally {
      setEscalating(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-paper text-ink flex font-sans">
        {/* Sidebar Skeleton */}
        <div className="w-80 border-r border-line bg-card flex flex-col hidden md:flex animate-pulse">
          <div className="p-4 border-b border-line flex items-center justify-between">
            <div className="h-5 bg-surface w-32 rounded-lg"></div>
            <div className="h-8 w-8 bg-surface rounded-lg"></div>
          </div>
          <div className="flex-1 p-3 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-xl border border-line bg-card space-y-2">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-surface w-24 rounded-md"></div>
                  <div className="h-3 bg-surface w-10 rounded-md"></div>
                </div>
                <div className="h-3 bg-surface w-full rounded-md"></div>
                <div className="h-4 bg-surface w-16 rounded-full mt-2"></div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-line bg-card flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-surface"></div>
              <div className="space-y-1.5">
                <div className="h-3.5 bg-surface w-20 rounded-md"></div>
                <div className="h-3 bg-surface w-28 rounded-md"></div>
              </div>
            </div>
            <div className="h-7 w-7 bg-surface rounded-md"></div>
          </div>
        </div>

        {/* Chat Interface Skeleton */}
        <div className="flex-1 flex flex-col bg-paper animate-pulse">
          <div className="bg-card border-b border-line px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-surface rounded-xl"></div>
              <div className="space-y-1.5">
                <div className="h-4 bg-surface w-28 rounded-md"></div>
                <div className="h-3 bg-surface w-40 rounded-md"></div>
              </div>
            </div>
            <div className="h-8 bg-surface w-32 rounded-xl"></div>
          </div>

          <div className="flex-1 p-6 space-y-6 overflow-hidden">
            {/* Left bubble */}
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-[70%]">
                <div className="w-8 h-8 rounded-xl bg-surface flex-shrink-0"></div>
                <div className="space-y-2">
                  <div className="p-4 bg-card border border-line rounded-2xl rounded-tl-none w-64 h-20"></div>
                  <div className="h-2.5 bg-surface w-16 rounded-md"></div>
                </div>
              </div>
            </div>

            {/* Right bubble */}
            <div className="flex justify-end">
              <div className="flex items-start space-x-3 max-w-[70%]">
                <div className="space-y-2">
                  <div className="p-4 bg-card border border-line rounded-2xl rounded-tr-none w-48 h-12"></div>
                  <div className="h-2.5 bg-surface w-12 rounded-md ml-auto"></div>
                </div>
              </div>
            </div>

            {/* Left bubble */}
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-[70%]">
                <div className="w-8 h-8 rounded-xl bg-surface flex-shrink-0"></div>
                <div className="space-y-2">
                  <div className="p-4 bg-card border border-line rounded-2xl rounded-tl-none w-80 h-32"></div>
                  <div className="h-2.5 bg-surface w-20 rounded-md"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border-t border-line p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-paper border border-line h-11 rounded-xl"></div>
              <div className="w-11 h-11 bg-surface rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-[calc(100vh-4rem)] bg-paper text-ink flex font-sans"
    >
      {/* Sidebar: Conversation List */}
      <div className="w-80 border-r border-line bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h2 className="font-bold text-ink flex items-center">
            <MessageSquare className="w-5 h-5 text-hub mr-2" />
            Your Sessions
          </h2>
          <button
            onClick={handleStartNewChat}
            className="p-1.5 rounded-lg bg-surface border border-line hover:bg-surface text-ink transition-colors"
            title="Start new support session"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 px-4 text-ink-faint">
              <Compass className="w-10 h-10 mx-auto mb-2 text-ink-soft" />
              <p className="text-sm font-semibold">No active support chats</p>
              <p className="text-xs mt-1">Click the + icon to launch a chatbot session.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              const isSelected = activeConv?.id === conv.id;

              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col ${
                    isSelected
                      ? 'bg-hub/10 border-hub/50 shadow-sm'
                      : 'border-transparent hover:bg-card'
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-semibold text-ink text-sm truncate max-w-[150px]">
                      {conv.title}
                    </span>
                    <span className="text-[10px] text-ink-faint">
                      {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className="text-xs text-ink-soft truncate mt-1 w-full">
                    {lastMsg ? lastMsg.text : 'Empty conversation'}
                  </span>
                  <div className="flex items-center space-x-2 mt-2">
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        conv.status === 'ticket_open'
                          ? 'bg-status-amber-soft text-status-amber border border-status-amber/30'
                          : conv.status === 'ticket_resolved'
                          ? 'bg-status-green-soft text-status-green border border-status-green/30'
                          : 'bg-hub-soft text-hub border border-hub/30'
                      }`}
                    >
                      {conv.status === 'ticket_open'
                        ? 'Escalated'
                        : conv.status === 'ticket_resolved'
                        ? 'Resolved'
                        : 'Active Bot'}
                    </span>
                    {conv.rating && (
                      <span className="flex items-center text-[10px] text-status-amber font-bold">
                        <Star className="w-3 h-3 fill-amber-400 text-status-amber mr-0.5" />
                        {conv.rating}★
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Customer Account Box */}
        <div className="p-4 border-t border-line bg-card flex items-center justify-between relative">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-surface flex items-center justify-center text-ink border border-line font-bold text-sm flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-ink truncate max-w-[120px]">{user.name}</p>
              <p className="text-xs text-ink-soft truncate max-w-[120px]">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface transition-all relative"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.some((n) => !n.read) && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-status-red rounded-full border border-card" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-0 mb-2 w-72 bg-card border border-line rounded-2xl shadow-xl z-30 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                      <h4 className="font-extrabold text-ink text-xs uppercase tracking-wider">Notifications</h4>
                      {notifications.some((n) => !n.read) && (
                        <button
                          onClick={handleMarkAllNotificationsRead}
                          className="text-[11px] font-bold text-hub hover:underline flex items-center"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-ink-faint text-center py-8">No notifications yet.</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleMarkNotificationRead(n.id)}
                            className={`w-full text-left px-4 py-3 border-b border-line last:border-b-0 hover:bg-paper transition-all ${
                              n.read ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-start space-x-2">
                              {!n.read && <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-hub flex-shrink-0" />}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-ink">{n.title}</p>
                                <p className="text-xs text-ink-soft mt-0.5 line-clamp-2">{n.message}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-surface transition-all"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col bg-paper">
        {activeConv ? (
          <>
            {/* Chat Window Header */}
            <div className="bg-card border-b border-line px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center space-x-3">
                <div className="bg-hub p-2 rounded-xl text-white shadow-md shadow-hub/10">
                  <Radio className="w-5 h-5" strokeWidth={2.25} />
                </div>
                <div>
                  <h3 className="font-bold text-ink text-base">
                    {botSettings?.chatbotName || 'SmartHelp AI'}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs">
                    <StatusDot
                      state={activeConv.status === 'ticket_open' ? 'pending' : activeConv.status === 'ticket_resolved' ? 'live' : 'idle'}
                      pulse={activeConv.status === 'ticket_open'}
                    />
                    <span
                      className={`font-semibold flex items-center ${
                        activeConv.status === 'ticket_open'
                          ? 'text-status-amber'
                          : activeConv.status === 'ticket_resolved'
                          ? 'text-status-green'
                          : 'text-hub'
                      }`}
                    >
                      {activeConv.status === 'ticket_open' && (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 mr-1" />
                          Support Ticket Open
                        </>
                      )}
                      {activeConv.status === 'ticket_resolved' && (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Resolved by Admin
                        </>
                      )}
                      {activeConv.status === 'active' && (
                        <>
                          <span className="w-1.5 h-1.5 bg-hub rounded-full mr-1.5 animate-ping"></span>
                          Bot Conversation Active
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2 sm:space-x-3">
                {/* Auto-Speak / TTS config */}
                <button
                  onClick={() => {
                    const nextVal = !autoSpeak;
                    setAutoSpeak(nextVal);
                    if (!nextVal && window.speechSynthesis) {
                      window.speechSynthesis.cancel();
                      setSpeakingMessageId(null);
                    }
                  }}
                  className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center space-x-1 ${
                    autoSpeak
                      ? 'border-status-green bg-status-green-soft text-status-green'
                      : 'border-line bg-paper text-ink-soft hover:text-ink hover:border-line'
                  }`}
                  title={autoSpeak ? "Auto-Voice Speak is Active" : "Auto-Voice Speak is Disabled"}
                >
                  {autoSpeak ? <Volume2 className="w-4 h-4 animate-pulse" /> : <VolumeX className="w-4 h-4 text-ink-faint" />}
                  <span className="hidden sm:inline">Voice Out</span>
                </button>

                {/* Language selection dropdown */}
                <div className="relative flex items-center bg-paper border border-line rounded-xl px-2 py-1.5 hover:border-line transition-colors">
                  <Globe className="w-3.5 h-3.5 text-ink-soft mr-1.5" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => {
                      setSelectedLanguage(e.target.value);
                      if (window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                        setSpeakingMessageId(null);
                      }
                    }}
                    className="bg-transparent text-xs text-ink font-bold focus:outline-none cursor-pointer"
                  >
                    {LANGUAGES_SUPPORTED.map((lang) => (
                      <option key={lang.code} value={lang.code} className="bg-card text-ink">
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fix #2a: rating is now a persistent header button that
                    opens an editable popover, reachable at any point in the
                    conversation -- not just once at the bottom after 2+
                    messages. */}
                <div className="relative">
                  <button
                    onClick={() => setShowRatingPanel((v) => !v)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center space-x-1 ${
                      selectedRating
                        ? 'border-status-amber bg-status-amber-soft text-status-amber'
                        : 'border-line bg-paper text-ink-soft hover:text-ink'
                    }`}
                    title="Rate this conversation"
                  >
                    <Star className={`w-4 h-4 ${selectedRating ? 'fill-amber-400' : ''}`} />
                    <span className="hidden sm:inline">{selectedRating ? `${selectedRating}★` : 'Rate'}</span>
                  </button>

                  <AnimatePresence>
                    {showRatingPanel && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-72 bg-card border border-line rounded-2xl shadow-xl z-30 p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-ink text-xs uppercase tracking-wider">
                            {selectedRating ? 'Update your rating' : 'Rate this conversation'}
                          </h4>
                          <button onClick={() => setShowRatingPanel(false)} className="text-ink-faint hover:text-ink">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((stars) => {
                            const isGold = tempRating !== null ? stars <= tempRating : (selectedRating !== null && stars <= selectedRating);
                            return (
                              <button
                                key={stars}
                                onMouseEnter={() => setTempRating(stars)}
                                onMouseLeave={() => setTempRating(selectedRating)}
                                onClick={() => setSelectedRating(stars)}
                                className="p-1 focus:outline-none"
                              >
                                <Star className={`w-5 h-5 transition-transform ${isGold ? 'fill-amber-400 text-status-amber scale-110' : 'text-ink-soft'}`} />
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          placeholder="Add comments (optional)..."
                          className="w-full text-xs border border-line px-3 py-1.5 rounded-xl bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-hub"
                        />
                        <button
                          onClick={handleFeedbackSubmit}
                          disabled={selectedRating === null || savingRating}
                          className="w-full text-xs bg-hub hover:bg-hub-dark disabled:bg-surface disabled:cursor-not-allowed font-bold text-white px-3.5 py-2 rounded-xl transition-all"
                        >
                          {savingRating ? 'Saving...' : (activeConv.rating ? 'Update Rating' : 'Submit Rating')}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {activeConv.status !== 'ticket_resolved' && (
                  <button
                    onClick={handleEscalateTicket}
                    disabled={escalating || activeConv.escalationReason === 'user_requested'}
                    className="flex items-center px-3.5 py-1.5 border border-line hover:border-status-amber/50 rounded-xl text-xs font-bold text-status-amber bg-status-amber-soft hover:bg-status-amber-soft transition-all disabled:opacity-60"
                  >
                    <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-status-amber" />
                    <span className="hidden md:inline">
                      {activeConv.escalationReason === 'user_requested' ? 'Agent Notified' : escalating ? 'Notifying...' : 'Talk to a person'}
                    </span>
                    <span className="md:hidden">Get help</span>
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl border border-line hover:bg-card md:hidden transition-all text-ink-soft"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error notifications */}
            {errorMsg && (
              <div className="bg-status-amber-soft border-b border-status-amber/50 px-6 py-2.5 flex items-center text-xs text-status-amber font-medium space-x-2">
                <AlertCircle className="w-4 h-4 text-status-amber flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Fix #2b: dedicated escalation banner -- the thread stays
                fully intact and usable, this just confirms the request
                went through. No more silently resetting to the starter
                screen. */}
            {escalationBanner && (
              <div className="bg-hub-soft border-b border-hub/40 px-6 py-2.5 flex items-center text-xs text-hub font-medium space-x-2">
                <UserCog className="w-4 h-4 text-hub flex-shrink-0" />
                <span>A human agent has been notified. You can keep chatting with the bot while you wait, or add more context below.</span>
              </div>
            )}

            {/* Fix #3: banner once an admin has actually joined and replied
                -- previously there was no way to know a human was involved
                at all versus the bot. */}
            {activeConv.humanHandling && (
              <div className="bg-status-green-soft border-b border-status-green/40 px-6 py-2.5 flex items-center text-xs text-status-green font-medium space-x-2">
                <UserCog className="w-4 h-4 text-status-green flex-shrink-0" />
                <span>{activeConv.assignedAdminName || 'An agent'} has joined this conversation and will respond directly.</span>
              </div>
            )}

            {/* Support ticket headers */}
            {activeConv.status === 'ticket_open' && (
              <div className="bg-status-amber-soft border-b border-status-amber/50 px-6 py-3 text-xs text-status-amber flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-status-amber" />
                  <span>
                    <strong>Support Ticket Generated:</strong> This thread has been escalated. An administrator has been notified to inspect.
                  </span>
                </div>
                <span className="font-bold font-mono bg-status-amber-soft text-status-amber px-2 py-0.5 rounded border border-status-amber">
                  #T-{activeConv.id.split('-')[1]?.slice(0, 4) || '884'}
                </span>
              </div>
            )}

            {/* Chat Transcript Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeConv.messages.length === 0 && botSettings ? (
                /* Empty Chat Greeting */
                <div className="max-w-md mx-auto text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-hub/10 text-hub rounded-2xl flex items-center justify-center mx-auto border border-hub/10">
                    <Radio className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <h4 className="font-extrabold text-ink text-lg">
                    {LANGUAGES_SUPPORTED.find(l => l.code === selectedLanguage)?.emptyTitle || 'SmartHelp Knowledge Grounded'}
                  </h4>
                  <p className="text-sm text-ink-soft">
                    {LANGUAGES_SUPPORTED.find(l => l.code === selectedLanguage)?.emptyDescription ||
                     'Ask any question about our products and services, grounded in our latest support documentation.'}
                  </p>
                  {loadingSuggestions ? (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="p-3 bg-card border border-line rounded-xl h-10 animate-pulse"></div>
                      ))}
                    </div>
                  ) : suggestedQuestions.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 pt-2 text-left">
                      {suggestedQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInputValue(q.query);
                          }}
                          className="p-3 bg-card border border-line rounded-xl hover:bg-surface hover:border-hub/50 transition-all text-xs text-ink font-semibold flex items-center justify-between"
                        >
                          <span className="truncate mr-1">{q.label}</span>
                          <ArrowRight className="w-3 h-3 text-hub flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                /* Message list */
                activeConv.messages.map((msg, idx) => {
                  const isBot = msg.sender === 'bot';
                  const isAdmin = msg.sender === 'admin';

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex ${isBot || isAdmin ? 'justify-start' : 'justify-end'} animate-fade-in`}
                    >
                      <div className="flex items-start space-x-3 max-w-[75%]">
                        {isBot && (
                          <div className="w-8 h-8 rounded-xl bg-hub flex items-center justify-center text-white text-xs flex-shrink-0 font-bold shadow-sm">
                            AI
                          </div>
                        )}
                        {isAdmin && (
                          <div className="w-8 h-8 rounded-xl bg-status-green flex items-center justify-center text-white text-xs flex-shrink-0 font-bold shadow-sm">
                            <UserCog className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div
                            className={`p-4 rounded-2xl text-sm leading-relaxed ${
                              isBot
                                ? 'bg-card text-ink rounded-tl-none border border-line'
                                : isAdmin
                                ? 'bg-status-green-soft text-ink rounded-tl-none border border-status-green/30'
                                : 'bg-hub text-white rounded-tr-none'
                            }`}
                          >
                            {isAdmin && (
                              <span className="text-[10px] uppercase tracking-wider text-status-green font-bold block mb-1">
                                Support Agent
                              </span>
                            )}
                            <p className="whitespace-pre-wrap">{msg.text}</p>

                            {/* RAG sources indicator */}
                            {isBot && msg.sources && msg.sources.length > 0 && (
                              <div className="mt-3.5 pt-3 border-t border-line flex flex-col space-y-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-ink-faint font-bold flex items-center">
                                  <FileText className="w-3 h-3 mr-1 text-ink-faint" />
                                  Answered using:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {msg.sources.map((src, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="text-[10px] font-bold text-hub bg-hub/10 border border-hub/20 px-2.5 py-0.5 rounded-full"
                                    >
                                      {src}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className={`flex items-center mt-1 space-x-2 ${!isBot && !isAdmin ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] text-ink-faint">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isBot && (
                              <button
                                onClick={() => handleToggleSpeak(msg.id || `msg-${idx}`, msg.text)}
                                className={`text-[10px] font-bold flex items-center space-x-1 p-0.5 rounded transition-all ${
                                  speakingMessageId === (msg.id || `msg-${idx}`)
                                    ? 'text-status-green bg-status-green-soft border border-status-green/35 px-1.5'
                                    : 'text-ink-faint hover:text-ink'
                                }`}
                                title={speakingMessageId === (msg.id || `msg-${idx}`) ? "Stop Voice" : "Listen (Text-to-Speech)"}
                              >
                                {speakingMessageId === (msg.id || `msg-${idx}`) ? (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5 text-status-green animate-bounce" />
                                    <span>Speaking</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5" />
                                    <span>Listen</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {typing && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3 max-w-[70%]">
                    <div className="w-8 h-8 rounded-xl bg-hub flex items-center justify-center text-white text-xs flex-shrink-0 font-bold animate-pulse">
                      AI
                    </div>
                    <div className="bg-card border border-line p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-1.5">
                      <span className="text-xs text-ink-soft font-semibold">Generating grounded answer...</span>
                      <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-hub rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-hub rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-hub rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="bg-card border-t border-line p-4">
              {/* Text Input form */}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    activeConv.status === 'ticket_resolved'
                      ? 'This ticket is closed. Launch a new session to chat.'
                      : (LANGUAGES_SUPPORTED.find(l => l.code === selectedLanguage)?.placeholder || 'Type your support question...')
                  }
                  disabled={activeConv.status === 'ticket_resolved' || loading}
                  className="flex-1 bg-paper border border-line rounded-xl px-4 py-3 text-sm placeholder-ink-faint text-ink focus:outline-none focus:ring-2 focus:ring-hub focus:border-hub focus:bg-card transition-all disabled:bg-card disabled:opacity-50"
                />

                {/* Voice Input Trigger */}
                {activeConv.status !== 'ticket_resolved' && (
                  <button
                    type="button"
                    onClick={handleStartListening}
                    disabled={loading}
                    className={`p-3 rounded-xl transition-all border ${
                      isListening
                        ? 'bg-status-red border-status-red text-white animate-pulse'
                        : 'bg-card border-line text-ink-soft hover:text-ink hover:border-ink-faint'
                    }`}
                    title={isListening ? "Listening... Click to stop" : "Speak your message (Voice Input)"}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!inputValue.trim() || activeConv.status === 'ticket_resolved' || loading}
                  className="bg-hub hover:bg-hub-dark disabled:bg-surface text-white p-3 rounded-xl transition-colors shadow-sm focus:outline-none"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty Chat state: click + */
          <div className="flex-1 flex flex-col justify-center items-center text-center p-8">
            <Compass className="w-16 h-16 text-ink-soft mb-4 animate-bounce" />
            <h3 className="font-extrabold text-ink text-xl">Help Desk Virtual Assistant</h3>
            <p className="text-ink-soft max-w-sm mt-2 text-sm leading-relaxed">
              Ask anything about your account or order and get an instant answer, pulled straight from our support guides.
            </p>
            <button
              onClick={handleStartNewChat}
              className="mt-6 flex items-center bg-hub hover:bg-hub-dark text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-hub/10 hover:shadow-hub/25 transition-all scale-100 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-4 h-4 mr-2" />
              Launch Support Session
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}