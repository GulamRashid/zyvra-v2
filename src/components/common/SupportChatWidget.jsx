import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle, X, Send, Mail, Clock, Check, CheckCheck,
  Sparkles, RefreshCw, AlertCircle, Headphones, Bot, UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { useLocation } from 'react-router-dom';

const SUPPORT_EMAIL = 'zyvra.education@gmail.com';
const POLL_INTERVAL_MS = 3500;

const QUICK_PROMPTS = [
  { label: '🔓 Course Unlock', text: 'Mera purchase kiya hua Course / Folder unlock nahi hua' },
  { label: '💳 Payment Issue', text: 'Payment ho gayi par pass activate nahi hua' },
  { label: '🪙 Zyvra Coins', text: 'Zyvra Coins aur Referral bonus kaise use karein?' },
  { label: '⏳ Pass Validity', text: 'Full Pass validity aur Mock Tests access ka kya niyam hai?' },
  { label: '👤 Human Admin', text: 'Mujhe Zyvra Admin se direct baat karni hai' }
];

export default function SupportChatWidget() {
  const { user, supabase } = useAuth();
  const { language } = useThemeLanguage();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);

  const messagesEndRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Hide completely on admin routes or while in active live quiz
  const isExcludedRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/quiz') ||
    location.pathname.startsWith('/auth');

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Fetch thread and messages via API
  const loadMessages = useCallback(async (isInitial = false) => {
    if (!user || !supabase) return;
    if (isInitial) setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'get_thread' })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          if (data.thread?.id) setThreadId(data.thread.id);
          setMessages(data.messages || []);
        }
      }
    } catch (err) {
      console.warn('Could not poll support messages:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user, supabase]);

  // Listen for open event triggered from Profile section
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      loadMessages(true);
    };
    window.addEventListener('zyvra:open-support-chat', handleOpen);
    return () => window.removeEventListener('zyvra:open-support-chat', handleOpen);
  }, [loadMessages]);

  // Poll for new messages when open
  useEffect(() => {
    if (!user || isExcludedRoute || !isOpen) return;

    loadMessages(false);

    const interval = setInterval(() => {
      loadMessages(false);
    }, POLL_INTERVAL_MS);

    pollTimerRef.current = interval;
    return () => clearInterval(interval);
  }, [user, isExcludedRoute, isOpen, loadMessages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [isOpen, messages.length]);

  const handleSendMessage = async (textToSend) => {
    const content = (textToSend || inputText).trim();
    if (!content || sending || !user) return;

    setInputText('');
    setSending(true);

    // Optimistic UI update for user message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      thread_id: threadId,
      sender_id: user.id,
      sender_role: 'user',
      sender_name: 'You',
      message: content,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(true), 50);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'send_message',
          message: content,
          thread_id: threadId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.message) {
          // Replace temp msg with real saved message and immediately append AI bot reply
          setMessages((prev) => {
            const updated = prev.map((m) => (m.id === tempId ? data.message : m));
            if (data.bot_reply) {
              const alreadyHasBot = updated.some((m) => m.id === data.bot_reply.id);
              if (!alreadyHasBot) {
                return [...updated, data.bot_reply];
              }
            }
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Failed to send support message:', err);
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  // Do not render anything when excluded or closed. Chat is strictly accessed via Profile section!
  if (isExcludedRoute || !user || !isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Zyvra Support Chat"
      className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-full sm:w-[420px] h-full sm:h-[620px] sm:max-h-[85vh] sm:rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-slate-800 border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shadow-inner">
              🤖
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-indigo-900" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5 leading-none">
              <span>Zyvra AI Sahayak & Support</span>
            </h3>
            <span className="text-[10px] text-indigo-200 font-medium block mt-1">
              ⚡ 24×7 Instant AI + Official Admin Support
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => loadMessages(false)}
            className="p-2 rounded-xl hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
            title="Refresh chat"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
            title="Close chat"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Official Email Info Strip */}
      <div className="px-3.5 py-2 dark:bg-slate-900/90 bg-slate-100/90 border-b dark:border-slate-800 border-slate-200 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
          <Mail size={13} className="text-indigo-500 shrink-0" />
          <span className="truncate">Email: <strong className="text-slate-700 dark:text-slate-200">{SUPPORT_EMAIL}</strong></span>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-600/20 transition-colors shrink-0"
        >
          Send Mail
        </a>
      </div>

      {/* Quick Prompts Bar (Always Available for 1-Tap Answers) */}
      <div className="px-3 py-2 border-b dark:border-slate-800/60 border-slate-200/60 dark:bg-slate-950/40 bg-slate-50/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-500 shrink-0 flex items-center gap-1">
          <Sparkles size={11} /> Quick:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(prompt.text)}
            disabled={sending}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-700 hover:border-indigo-500 hover:text-indigo-500 transition-all active:scale-95 shadow-xs"
          >
            {prompt.label}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 dark:bg-[#0B1120] bg-slate-50/70">
        {/* Welcome Greeting from Zyvra */}
        <div className="p-3.5 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200/80 shadow-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-500">
            <Bot size={13} />
            <span>Zyvra 24×7 AI Support Desk</span>
          </div>
          <p className="text-xs dark:text-slate-300 text-slate-700 leading-relaxed">
            {language === 'hi'
              ? 'नमस्ते! ज़ाइव्रा स्टूडेंट हेल्प डेस्क में आपका स्वागत है 🎓। किसी भी कोर्स, टेस्ट, पेमेंट या कॉइन की समस्या का तुरंत समाधान पाने के लिए नीचे टाइप करें या ऊपर दिए क्विक बटन्स दबाएं।'
              : 'Namaste! Welcome to Zyvra Student Support 🎓. For instant assistance with courses, tests, payments, or coins, tap any quick topic above or type your query below.'}
          </p>
        </div>

        {/* Chat Messages */}
        {messages.map((msg, index) => {
          const isUser = msg.sender_role === 'user';
          const isBot = msg.sender_role === 'bot';
          const isAdmin = msg.sender_role === 'admin';
          const timeStr = msg.created_at
            ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div
              key={msg.id || index}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-xs ${
                  isUser
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs'
                    : isBot
                    ? 'dark:bg-slate-900 bg-white dark:text-slate-100 text-slate-800 border-2 dark:border-purple-500/40 border-purple-200 rounded-bl-xs'
                    : 'dark:bg-emerald-950/30 bg-emerald-50 dark:text-emerald-100 text-emerald-900 border-2 dark:border-emerald-500/40 border-emerald-300 rounded-bl-xs'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center gap-1.5 mb-1">
                    {isBot ? (
                      <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                        <Bot size={10} />
                        Zyvra AI Sahayak 🤖
                      </span>
                    ) : (
                      <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                        <UserCheck size={10} />
                        Zyvra Official Admin 🛡️
                      </span>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
              </div>
              <span className="text-[9px] text-slate-400 px-1">{timeStr}</span>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-2.5 sm:p-3 dark:bg-slate-900 bg-white border-t dark:border-slate-800 border-slate-200 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={language === 'hi' ? 'अपना सवाल या समस्या लिखें...' : 'Type your question or issue...'}
          className="flex-1 px-3.5 py-2.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 text-xs font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-40 text-white shadow-sm transition-all active:scale-95 shrink-0"
          title="Send message"
        >
          <Send size={16} className={sending ? 'animate-pulse' : ''} />
        </button>
      </form>
    </div>
  );
}
