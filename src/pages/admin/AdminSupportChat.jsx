import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle, Search, Send, CheckCircle2, Clock, Mail,
  RefreshCw, CheckCheck, User, Sparkles, Filter, ChevronRight, ChevronDown, ChevronUp,
  ArrowLeft, Check, AlertCircle, Headphones
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { logAdminAction } from '../../lib/auditLog';

function formatDateTimeIN(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const POLL_INTERVAL_MS = 3500;

const CANNED_REPLIES = [
  'Namaste! Zyvra Support me aapka swagat hai. Kaise madad kar sakte hain?',
  'Kripya apna registered email aur payment order ID share karein.',
  'Aapka course / folder access active kar diya gaya hai. Kripya app refresh karein.',
  'Hamari team iski jaanch kar rahi hai, hum jald hi resolve karenge.',
  'Aapka issue resolve ho gaya hai. Kya aapko kisi aur cheez me sahayata chahiye?'
];

export default function AdminSupportChat() {
  const { user, supabase } = useAuth();

  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'unread' | 'resolved'
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [expandedThreadIds, setExpandedThreadIds] = useState({});
  const [resolveReasonPrompt, setResolveReasonPrompt] = useState(false);
  const [resolveReason, setResolveReason] = useState('');
  const [statusError, setStatusError] = useState('');

  const messagesEndRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // 1. Fetch all support threads
  const loadThreads = useCallback(async (quiet = false) => {
    if (!supabase || !user) return;
    if (!quiet) setLoadingThreads(true);

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
        if (data?.success && Array.isArray(data.threads)) {
          setThreads(data.threads);
        }
      }
    } catch (err) {
      console.warn('Error loading support threads:', err);
    } finally {
      if (!quiet) setLoadingThreads(false);
    }
  }, [supabase, user]);

  // 2. Fetch messages for the currently selected thread
  const loadMessages = useCallback(async (threadId, quiet = false) => {
    if (!threadId || !supabase) return;
    if (!quiet) setLoadingMessages(true);

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
        body: JSON.stringify({
          action: 'get_thread',
          thread_id: threadId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.messages)) {
          setMessages(data.messages);
          if (data.thread) {
            setSelectedThread(data.thread);
            // Also update thread in list so unread count clears
            setThreads((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, unread_admin_count: 0 } : t))
            );
          }
        }
      }
    } catch (err) {
      console.warn('Error loading thread messages:', err);
    } finally {
      if (!quiet) setLoadingMessages(false);
    }
  }, [supabase]);

  // Initial load
  useEffect(() => {
    loadThreads(false);
  }, [loadThreads]);

  // Periodic polling for threads and active thread messages
  useEffect(() => {
    const interval = setInterval(() => {
      loadThreads(true);
      if (selectedThread?.id) {
        loadMessages(selectedThread.id, true);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadThreads, loadMessages, selectedThread?.id]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (selectedThread?.id) {
      setTimeout(() => scrollToBottom(false), 50);
    }
  }, [selectedThread?.id, messages.length]);

  const handleSelectThread = (thread) => {
    setSelectedThread(thread);
    loadMessages(thread.id, false);
  };

  const handleSendReply = async (textToSend) => {
    const content = (textToSend || replyText).trim();
    if (!content || sending || !selectedThread?.id) return;

    setReplyText('');
    setSending(true);

    // Optimistic UI update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      thread_id: selectedThread.id,
      sender_id: user?.id,
      sender_role: 'admin',
      sender_name: 'You (Support)',
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
          thread_id: selectedThread.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.message) {
          setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
        }
      }
    } catch (err) {
      console.error('Failed to send admin reply:', err);
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(true), 100);
      loadThreads(true);
    }
  };

  const handleToggleStatus = async (explicitReason = '') => {
    if (!selectedThread?.id || updatingStatus) return;
    const nextStatus = selectedThread.status === 'resolved' ? 'open' : 'resolved';
    const hasHumanReply = messages.some((m) => m.sender_role === 'admin');
    setStatusError('');

    if (nextStatus === 'resolved' && !hasHumanReply && explicitReason.trim().length < 5) {
      setResolveReasonPrompt(true);
      return;
    }

    setUpdatingStatus(true);

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
          action: 'update_status',
          thread_id: selectedThread.id,
          status: nextStatus,
          resolution_reason: explicitReason.trim() || undefined
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const updatedThread = data?.thread || { ...selectedThread, status: nextStatus };
        setSelectedThread(updatedThread);
        setThreads((prev) =>
          prev.map((t) => (t.id === selectedThread.id ? { ...t, ...updatedThread } : t))
        );
        setResolveReasonPrompt(false);
        setResolveReason('');
        logAdminAction(supabase, {
          actor: user,
          action: nextStatus === 'resolved' ? 'support_ticket_resolved' : 'support_ticket_reopened',
          targetType: 'support_thread',
          targetId: selectedThread.id,
          details: { reason: explicitReason.trim() || 'Admin replied' }
        });
      } else {
        setStatusError(data?.error || 'Unable to update ticket status.');
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      setStatusError(err.message || 'Unable to update ticket status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filtered threads list
  const filteredThreads = threads.filter((t) => {
    if (statusFilter === 'open' && t.status !== 'open') return false;
    if (statusFilter === 'resolved' && t.status !== 'resolved') return false;
    if (statusFilter === 'unread' && (!t.unread_admin_count || t.unread_admin_count <= 0)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (t.user_name || '').toLowerCase().includes(q);
      const emailMatch = (t.user_email || '').toLowerCase().includes(q);
      const msgMatch = (t.last_message || '').toLowerCase().includes(q);
      return nameMatch || emailMatch || msgMatch;
    }
    return true;
  });

  const totalUnreadCount = threads.reduce((acc, t) => acc + (t.unread_admin_count || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-3xl dark:bg-[#111827] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-md shrink-0">
            💬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black tracking-wider text-indigo-500">
                Help Desk & Live Chat
              </span>
              {totalUnreadCount > 0 && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                  {totalUnreadCount} Unread
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
              Student Support Messenger
            </h1>
            <p className="text-xs dark:text-slate-400 text-slate-500">
              Live two-way chat with students. Official support email: <span className="font-bold text-indigo-500">zyvra.education@gmail.com</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            loadThreads(false);
            if (selectedThread?.id) loadMessages(selectedThread.id, false);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold dark:text-slate-200 text-slate-700 transition-colors shrink-0"
        >
          <RefreshCw size={13} className={loadingThreads ? 'animate-spin' : ''} />
          <span>Refresh Chats</span>
        </button>
      </div>

      {/* Main Messaging App Layout (2 Panes: Conversations List + Chat Area) */}
      <div className="rounded-3xl dark:bg-[#111827] bg-white border dark:border-slate-800 border-slate-200 shadow-sm overflow-hidden h-[680px] max-h-[82vh] flex">

        {/* LEFT PANE: Conversations List (Hidden on mobile if a thread is selected) */}
        <div
          className={`w-full sm:w-[340px] md:w-[380px] border-r dark:border-slate-800 border-slate-200 flex flex-col shrink-0 ${
            selectedThread ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* Search Box */}
          <div className="p-3.5 border-b dark:border-slate-800 border-slate-200 space-y-2.5 shrink-0">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or message..."
                className="w-full pl-9 pr-3 py-2 rounded-xl dark:bg-slate-900 bg-slate-50 border dark:border-slate-800 border-slate-200 text-xs font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold">
              {[
                { id: 'all', label: `All (${threads.length})` },
                { id: 'open', label: 'Open' },
                { id: 'unread', label: totalUnreadCount > 0 ? `Unread (${totalUnreadCount})` : 'Unread' },
                { id: 'resolved', label: 'Resolved' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y dark:divide-slate-800/60 divide-slate-100">
            {loadingThreads ? (
              <div className="p-4">
                <LoadingSkeleton rows={5} />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <MessageCircle size={28} className="mx-auto text-slate-400 opacity-60" />
                <p className="font-bold dark:text-slate-300 text-slate-700">No conversations found</p>
                <p className="text-[11px] text-slate-400">Students who message for help will appear here.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = selectedThread?.id === thread.id;
                const isExpanded = Boolean(expandedThreadIds[thread.id]);
                const hasUnread = Boolean(thread.unread_admin_count && thread.unread_admin_count > 0);
                const timeStr = formatDateTimeIN(thread.last_message_at);

                return (
                  <div
                    key={thread.id}
                    className={`w-full p-3.5 text-left transition-colors ${
                      isSelected
                        ? 'dark:bg-indigo-950/40 bg-indigo-50/70 border-l-4 border-indigo-600'
                        : hasUnread
                        ? 'dark:bg-slate-900/60 bg-amber-50/30 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectThread(thread)}
                        className="flex-1 min-w-0 flex items-start gap-3 text-left"
                      >
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-sm shadow-xs">
                            {(thread.user_name || 'S').slice(0, 1).toUpperCase()}
                          </div>
                          {thread.status === 'open' && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 dark:border-slate-900 border-white" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={`text-xs font-black dark:text-white text-slate-900 ${isExpanded ? 'break-words' : 'truncate'}`}>
                              {thread.user_name || 'Student'}
                            </h4>
                            <span className="text-[10px] text-slate-400 shrink-0">{timeStr}</span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <p className={`text-[11px] text-slate-400 flex-1 ${isExpanded ? 'break-all' : 'truncate'}`}>
                              {thread.user_email || 'No email'}
                            </p>
                            {thread.needs_admin ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/15 text-rose-500 border border-rose-500/30 shrink-0 animate-pulse">
                                🔴 Pending Human Reply
                              </span>
                            ) : thread.status === 'open' ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                                🤖 Bot Handled
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                                ✓ Resolved
                              </span>
                            )}
                          </div>

                          <div className="flex items-start justify-between gap-2 mt-1">
                            <p className={`text-[11px] ${isExpanded ? 'whitespace-pre-wrap break-words' : 'truncate'} ${hasUnread ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                              {thread.last_message || 'No messages yet'}
                            </p>
                            {hasUnread && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white shrink-0">
                                {thread.unread_admin_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedThreadIds((prev) => ({ ...prev, [thread.id]: !prev[thread.id] }))}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 shrink-0"
                        title={isExpanded ? 'Collapse row' : 'Expand full message'}
                        aria-label={isExpanded ? 'Collapse row' : 'Expand full message'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                    {isExpanded && thread.resolution_reason && (
                      <div className="mt-2 ml-13 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/70 text-[10px] text-slate-600 dark:text-slate-300">
                        <strong>Resolution note:</strong> {thread.resolution_reason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Active Chat Thread */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${
            !selectedThread ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {!selectedThread ? (
            /* Empty State when no conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 dark:bg-[#0B1120] bg-slate-50/50">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-3xl">
                💬
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black dark:text-white text-slate-900">
                  Select a Student Chat
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Click on any conversation from the list on the left to read messages and assist students in real-time.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="p-3.5 sm:p-4 border-b dark:border-slate-800 border-slate-200 dark:bg-slate-900 bg-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedThread(null)}
                    className="sm:hidden p-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 text-slate-700 dark:text-slate-300"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                    {(selectedThread.user_name || 'S').slice(0, 1).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 truncate">
                        {selectedThread.user_name || 'Student'}
                      </h3>
                      <span
                        className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase ${
                          selectedThread.status === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        }`}
                      >
                        {selectedThread.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {selectedThread.user_email || 'No email registered'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus()}
                    disabled={updatingStatus}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      selectedThread.status === 'resolved'
                        ? 'dark:bg-slate-800 bg-slate-100 text-slate-700 dark:text-slate-300 hover:border-amber-500'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>
                      {selectedThread.status === 'resolved' ? 'Reopen Thread' : 'Mark Resolved'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => loadMessages(selectedThread.id, false)}
                    className="p-2 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                    title="Refresh thread"
                  >
                    <RefreshCw size={14} className={loadingMessages ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {(statusError || resolveReasonPrompt) && (
                <div className="px-4 py-2.5 border-b dark:border-slate-800 border-slate-200 bg-amber-50 dark:bg-amber-950/30 space-y-2 shrink-0">
                  {statusError && (
                    <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">{statusError}</div>
                  )}
                  {resolveReasonPrompt && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 shrink-0">
                        No human reply sent yet. Enter resolution reason:
                      </span>
                      <input
                        type="text"
                        value={resolveReason}
                        onChange={(e) => setResolveReason(e.target.value)}
                        placeholder="e.g. Verified offline / duplicate test thread"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs text-slate-900 dark:text-white"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(resolveReason)}
                          disabled={updatingStatus || resolveReason.trim().length < 5}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                        >
                          Confirm Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => { setResolveReasonPrompt(false); setResolveReason(''); }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 dark:bg-[#0B1120] bg-slate-50/60">
                {loadingMessages ? (
                  <LoadingSkeleton rows={4} />
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No messages in this conversation yet. Send a greeting below!
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isAdmin = msg.sender_role === 'admin';
                    const isBot = msg.sender_role === 'bot';
                    const timeStr = formatDateTimeIN(msg.created_at);

                    return (
                      <div
                        key={msg.id || index}
                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-xs ${
                            isAdmin
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs'
                              : isBot
                              ? 'dark:bg-purple-950/30 bg-purple-50 dark:text-purple-100 text-purple-900 border-2 dark:border-purple-500/40 border-purple-200 rounded-bl-xs'
                              : 'dark:bg-slate-900 bg-white dark:text-slate-100 text-slate-800 border dark:border-slate-800 border-slate-200 rounded-bl-xs'
                          }`}
                        >
                          <span
                            className={`text-[9px] uppercase font-black tracking-wider block mb-1 ${
                              isAdmin
                                ? 'text-indigo-200'
                                : isBot
                                ? 'text-purple-400'
                                : 'text-indigo-500'
                            }`}
                          >
                            {isAdmin
                              ? 'Zyvra Support Team (You)'
                              : isBot
                              ? '🤖 Zyvra AI Sahayak (Auto-Response)'
                              : selectedThread.user_name || 'Student'}
                          </span>
                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        </div>
                        <span className="text-[9px] text-slate-400 px-1">{timeStr}</span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Canned Replies Bar */}
              <div className="p-2 border-t dark:border-slate-800 border-slate-200 dark:bg-slate-900/60 bg-white/60 overflow-x-auto flex items-center gap-1.5 shrink-0 no-scrollbar">
                <span className="text-[10px] font-black uppercase text-indigo-500 shrink-0 px-1">
                  Quick:
                </span>
                {CANNED_REPLIES.map((canned, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendReply(canned)}
                    className="px-2.5 py-1 rounded-lg dark:bg-slate-800 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-[11px] font-semibold dark:text-slate-300 text-slate-700 whitespace-nowrap transition-colors border dark:border-slate-700 border-slate-200"
                  >
                    💬 {canned.slice(0, 32)}...
                  </button>
                ))}
              </div>

              {/* Reply Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReply();
                }}
                className="p-3 dark:bg-slate-900 bg-white border-t dark:border-slate-800 border-slate-200 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type reply to student (Press Enter to send)..."
                  className="flex-1 px-4 py-2.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-200 text-xs font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sending}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black shadow-sm transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                >
                  <span>Send</span>
                  <Send size={13} className={sending ? 'animate-pulse' : ''} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
