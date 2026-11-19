import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle, X, Send, Mail, Clock, Check, CheckCheck,
  Sparkles, RefreshCw, AlertCircle, Headphones
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { useLocation } from 'react-router-dom';

const SUPPORT_EMAIL = 'zyvra.education@gmail.com';
const POLL_INTERVAL_MS = 4000;

const QUICK_PROMPTS = [
  'Course / Folder unlock nahi hua',
  'Payment ho gayi par pass active nahi hai',
  'Zyvra Coins redeem karne me issue hai',
  'Pass validity & syllabus sawal'
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
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef(null);
  const pollTimerRef = useRef(null);

  // Hide on admin routes or while in active live quiz
  const isExcludedRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/quiz') ||
    location.pathname.startsWith('/auth');

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Fetch thread and messages via API or Supabase
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
          if (!isOpen && data.thread?.unread_user_count > 0) {
            setUnreadCount(data.thread.unread_user_count);
          } else if (isOpen) {
            setUnreadCount(0);
          }
        }
      }
    } catch (err) {
      console.warn('Could not poll support messages:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [user, supabase, isOpen]);

  // Listen for open event from anywhere in the app
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setUnreadCount(0);
    };
    window.addEventListener('zyvra:open-support-chat', handleOpen);
    return () => window.removeEventListener('zyvra:open-support-chat', handleOpen);
  }, []);

  // Poll for new messages when open or periodically for unread badges
  useEffect(() => {
    if (!user || isExcludedRoute) return;

    loadMessages(true);

    const interval = setInterval(() => {
      loadMessages(false);
    }, isOpen ? POLL_INTERVAL_MS : 25000);

    pollTimerRef.current = interval;
    return () => clearInterval(interval);
  }, [user, isExcludedRoute, isOpen, loadMessages]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [isOpen, messages.length]);

  const handleSendMessage = async (textToSend) => {
    const content = (textToSend || inputText).trim();
    if (!content || sending || !user) return;

    setInputText('');
    setSending(true);

    // Optimistic UI update
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
          // Replace temp msg with real saved msg
          setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
        }
      }
    } catch (err) {
      console.error('Failed to send support message:', err);
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(true), 100);
    }
  };

  if (isExcludedRoute || !user) return null;

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setUnreadCount(0);
          }}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 p-3.5 sm:px-4 sm:py-3 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl hover:shadow-indigo-500/30 flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 group border border-indigo-400/30"
          aria-label="Open Zyvra Student Support Chat"
        >
          <div className="relative">
            <MessageCircle size={22} className="group-hover:rotate-12 transition-transform" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce shadow-md">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="hidden sm:inline text-xs font-black tracking-tight">
            {language === 'hi' ? 'सहायता चाहिए? (Support)' : 'Need Help? Chat'}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse hidden sm:inline" />
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Zyvra Support Chat"
          className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-50 w-[calc(100vw-24px)] sm:w-[380px] h-[520px] max-h-[85vh] rounded-3xl dark:bg-[#0F172A] bg-white border dark:border-slate-800 border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-lg">
                  🎓
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-indigo-700" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5 leading-none">
                  <span>Zyvra Student Support</span>
                </h3>
                <span className="text-[10px] text-indigo-200 font-medium block mt-0.5">
                  {language === 'hi' ? '⚡ आमतौर पर तुरंत जवाब मिलता है' : '⚡ Online • Quick replies'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => loadMessages(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
                title="Refresh messages"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-indigo-200 hover:text-white transition-colors"
                title="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Official Email Info Strip */}
          <div className="px-3 py-1.5 dark:bg-slate-900 bg-slate-50 border-b dark:border-slate-800 border-slate-100 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
              <Mail size={12} className="text-indigo-500 shrink-0" />
              <span className="truncate">{SUPPORT_EMAIL}</span>
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0"
            >
              Email Us
            </a>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 dark:bg-[#0B1120] bg-slate-50/60">
            {/* Welcome Greeting from Zyvra */}
            <div className="p-3 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200/80 shadow-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-500">
                <Sparkles size={12} />
                <span>Zyvra Help Desk</span>
              </div>
              <p className="text-xs dark:text-slate-200 text-slate-700 leading-relaxed">
                {language === 'hi'
                  ? 'नमस्ते! ज़ाइव्रा स्टूडेंट सपोर्ट में आपका स्वागत है। कोर्स, टेस्ट, पेमेंट या कॉइन से जुड़ा कोई भी सवाल नीचे लिखकर भेजें।'
                  : 'Namaste! Welcome to Zyvra Support. How can we help you with your courses, mock tests, or payments today?'}
              </p>
            </div>

            {/* Quick Prompts (Only shown if less than 2 messages) */}
            {messages.length <= 1 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block px-1">
                  {language === 'hi' ? 'त्वरित सवाल (Quick help):' : 'Suggested topics:'}
                </span>
                <div className="flex flex-col gap-1.5">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="text-left px-3 py-2 rounded-xl dark:bg-slate-900/90 bg-white border dark:border-slate-800 border-slate-200 hover:border-indigo-500 text-[11px] font-semibold dark:text-slate-300 text-slate-700 transition-all hover:translate-x-0.5 shadow-xs"
                    >
                      💬 {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((msg, index) => {
              const isMe = msg.sender_role === 'user';
              const timeStr = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-xs ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-xs'
                        : 'dark:bg-slate-900 bg-white dark:text-slate-100 text-slate-800 border dark:border-slate-800 border-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {!isMe && (
                      <span className="text-[9px] uppercase font-black tracking-wider text-emerald-500 block mb-0.5">
                        Zyvra Support Agent
                      </span>
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
              placeholder={language === 'hi' ? 'अपना संदेश लिखें...' : 'Type your question...'}
              className="flex-1 px-3.5 py-2 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 text-xs font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-sm transition-all active:scale-95 shrink-0"
              title="Send message"
            >
              <Send size={15} className={sending ? 'animate-pulse' : ''} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
