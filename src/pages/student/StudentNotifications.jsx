import { useCallback, useEffect, useState, useMemo } from 'react';
import { Bell, Megaphone, CheckCircle2, Clock, RefreshCw, AlertCircle, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const STORAGE_KEY = 'zyvra_read_announcement_ids';

export default function StudentNotifications() {
  const { user, supabase, profile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const storageKey = `${STORAGE_KEY}:${user?.id || 'guest'}`;
  const [readIds, setReadIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${user?.id || 'guest'}`) || '[]'));
    } catch {
      return new Set();
    }
  });

  const loadAnnouncements = useCallback(async () => {
    if (!supabase) {
      setAnnouncements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('platform_settings')
        .select('key,setting_key,value,setting_value')
        .or('key.eq.platform_announcements,setting_key.eq.platform_announcements');

      if (fetchErr) throw fetchErr;

      const row = data?.[0];
      const val = row?.setting_value !== undefined ? row.setting_value : row?.value;
      const audience = new Set((profile?.target_exams || []).map((exam) => String(exam).toLowerCase()));
      const list = (Array.isArray(val) ? val : []).filter((notice) =>
        !notice.audience || String(notice.audience).toLowerCase() === 'all' || audience.has(String(notice.audience).toLowerCase())
      );
      setAnnouncements(list);
    } catch (err) {
      console.warn('Error fetching announcements:', err);
      setError('Unable to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [supabase, profile?.target_exams]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    try {
      setReadIds(new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')));
    } catch {
      setReadIds(new Set());
    }
  }, [storageKey]);

  const markAllAsRead = () => {
    const allIds = announcements.map((a) => a.id);
    const newSet = new Set(allIds);
    setReadIds(newSet);
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)));
    } catch { /* ignore storage write error */ }
  };

  const markAsRead = (id) => {
    if (readIds.has(id)) return;
    const newSet = new Set(readIds);
    newSet.add(id);
    setReadIds(newSet);
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)));
    } catch { /* ignore storage write error */ }
  };

  const unreadCount = useMemo(() => {
    return announcements.filter((a) => !readIds.has(a.id)).length;
  }, [announcements, readIds]);

  return (
    <div className="notifications-page min-h-screen dark:bg-[#0B1120] bg-[#f4faf7] dark:text-slate-100 text-slate-900 transition-colors">
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Page Heading Banner */}
        <div className="page-heading relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider">
              PLATFORM & STUDY UPDATES
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
              <Bell className="text-indigo-500 w-6 h-6" />
              <span>Notifications & Notices</span>
            </h1>
            <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium mt-0.5">
              Important exam notifications, test updates, and announcements from the Zyvra team.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-indigo-600/20 bg-indigo-50 border border-indigo-400/30 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 transition-colors"
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
            <button
              type="button"
              onClick={loadAnnouncements}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-xs font-bold dark:text-slate-200 text-slate-700 shadow-xs hover:border-indigo-500 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : announcements.length === 0 ? (
          <div className="p-8 rounded-3xl dark:bg-[#1E293B]/80 bg-white border dark:border-slate-800 border-slate-200 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mx-auto flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="text-base font-black dark:text-white text-slate-900">You are all caught up!</h3>
            <p className="text-xs dark:text-slate-400 text-slate-600 max-w-sm mx-auto">
              No new announcements right now. Study reminders, test schedule changes, and updates will be posted here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => {
              const isRead = readIds.has(item.id);
              const isHigh = item.priority === 'urgent' || item.priority === 'high';

              return (
                <div
                  key={item.id}
                  onClick={() => markAsRead(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      markAsRead(item.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`p-4 rounded-3xl border transition-all cursor-pointer ${
                    !isRead
                      ? 'dark:bg-slate-800/90 bg-white border-indigo-500/40 shadow-md ring-1 ring-indigo-500/20'
                      : 'dark:bg-[#1E293B]/70 bg-white/80 dark:border-slate-800 border-slate-200 opacity-90'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isHigh
                            ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500'
                            : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-500'
                        }`}
                      >
                        <Megaphone size={17} />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-extrabold dark:text-white text-slate-900 leading-snug">
                            {item.title}
                          </h3>
                          {isHigh && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/15 text-rose-500 border border-rose-500/30">
                              {item.priority}
                            </span>
                          )}
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                          )}
                        </div>

                        <p className="text-xs dark:text-slate-300 text-slate-700 whitespace-pre-line leading-relaxed">
                          {item.content}
                        </p>

                        <div className="pt-1 flex items-center gap-2 text-[10px] dark:text-slate-400 text-slate-500 font-medium">
                          <Clock size={11} />
                          <span>
                            {item.created_at
                              ? new Date(item.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                              : 'Recent'}
                          </span>
                          <span>•</span>
                          <span>By {item.author || 'Team Zyvra'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
