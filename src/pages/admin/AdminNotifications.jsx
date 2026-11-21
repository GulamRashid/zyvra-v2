import { useCallback, useEffect, useState } from 'react';
import {
  Bell, Send, Trash2, Megaphone, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

export default function AdminNotifications() {
  const { supabase, user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', type: '' });

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [priority, setPriority] = useState('normal');
  const [loadError, setLoadError] = useState('');

  const loadAnnouncements = useCallback(async (active = () => true) => {
    if (!supabase) return;
    setRefreshing(true);
    setLoadError('');
    try {
      // Check platform_settings for platform_announcements
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error && error.code !== 'PGRST116') throw error;

      if (active()) {
        const row = (data || []).find((r) => r.key === 'platform_announcements' || r.setting_key === 'platform_announcements');
        const val = row?.setting_value !== undefined ? row.setting_value : row?.value;
        const list = Array.isArray(val) ? val : [];
        setAnnouncements(list);
      }
    } catch (err) {
      console.warn('Error loading announcements:', err.message);
      if (active()) {
        setAnnouncements([]);
        setLoadError('Announcements could not be loaded. Please refresh or check connection.');
      }
    } finally {
      if (active()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    loadAnnouncements(() => active);
    return () => { active = false; };
  }, [loadAnnouncements]);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    setFeedback({ text: '', type: '' });

    try {
      const newEntry = {
        id: 'ann_' + Date.now(),
        title: title.trim(),
        content: content.trim(),
        audience: targetAudience,
        priority,
        created_at: new Date().toISOString(),
        author: user?.email || 'Admin'
      };

      const updated = [newEntry, ...announcements];

      let { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'platform_announcements',
          setting_key: 'platform_announcements',
          setting_value: updated,
          value: updated
        }, { onConflict: 'setting_key' });

      if (error) {
        const fallback = await supabase
          .from('platform_settings')
          .upsert({
            key: 'platform_announcements',
            setting_key: 'platform_announcements',
            setting_value: updated,
            value: updated
          }, { onConflict: 'key' });
        if (fallback.error) throw fallback.error;
      }

      setAnnouncements(updated);
      setTitle('');
      setContent('');
      setFeedback({ text: 'Announcement successfully broadcast to all learners.', type: 'success' });
    } catch (err) {
      setFeedback({ text: err.message || 'Unable to publish announcement.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!confirm('Remove this announcement?')) return;
    try {
      const updated = announcements.filter((a) => a.id !== id);
      let { error } = await supabase
        .from('platform_settings')
        .upsert({
          key: 'platform_announcements',
          setting_key: 'platform_announcements',
          setting_value: updated,
          value: updated
        }, { onConflict: 'setting_key' });

      if (error) {
        const fallback = await supabase
          .from('platform_settings')
          .upsert({
            key: 'platform_announcements',
            setting_key: 'platform_announcements',
            setting_value: updated,
            value: updated
          }, { onConflict: 'key' });
        if (fallback.error) throw fallback.error;
      }
      setAnnouncements(updated);
    } catch (err) {
      alert('Failed to delete announcement: ' + err.message);
    }
  };

  return (
    <div className="admin-notifications-page">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">COMMUNICATION & ALERTS</div>
          <h1>Platform Announcements & Notices</h1>
          <p>Publish banner announcements, exam updates, and important updates to student dashboards.</p>
        </div>
        <button className="button button-outline" onClick={() => loadAnnouncements()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/90 dark:bg-indigo-950/30 px-3.5 py-2.5 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2 mb-4">
        <span>💡 <strong>त्वरित सहायता:</strong> यहाँ से नया नोटिस प्रकाशित करें जो छात्रों के होम डैशबोर्ड पर सबसे ऊपर दिखेगा। आप इसे सभी छात्रों या किसी ख़ास परीक्षा (BPSC, SSC, CTET) के छात्रों के लिए लक्षित कर सकते हैं।</span>
      </div>

      {loadError && (
        <div className="banner error-banner" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          <strong>Error:</strong> {loadError}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="admin-two-col-grid">
          {/* Create Announcement Form */}
          <section className="panel-card p-5 sm:p-6">
            <div className="section-heading">
              <div>
                <div className="eyebrow">BROADCAST</div>
                <h2>Create Announcement</h2>
              </div>
              <div className="setting-symbol"><Megaphone size={18} /></div>
            </div>
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Broadcast messages are highlighted on the learner home feed.
            </p>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject / Heading *
                </label>
                <input
                  type="text"
                  placeholder="e.g. BPSC Prelims 2026 Test Series is Now Live!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Message Content *
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide details about exam dates, new question packs, or tips for learners..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Audience
                  </label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">All Learners</option>
                    <option value="bpsc">BPSC Aspirants</option>
                    <option value="ssc">SSC Aspirants</option>
                    <option value="ctet">CTET Aspirants</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="normal">Standard Notice</option>
                    <option value="high">Urgent Alert</option>
                    <option value="promo">Special Reward / Offer</option>
                  </select>
                </div>
              </div>

              {feedback.text && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300'
                }`}>
                  {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || !title.trim() || !content.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
                >
                  <Send size={15} />
                  <span>{submitting ? 'Broadcasting…' : 'Publish Announcement'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Published Announcements List */}
          <section className="panel-card p-5 sm:p-6">
            <div className="section-heading">
              <div>
                <div className="eyebrow">FEED HISTORY</div>
                <h2>Active Announcements</h2>
              </div>
              <span className="chapter-item-count">{announcements.length} messages</span>
            </div>

            {announcements.length === 0 ? (
              <div className="empty-content" style={{ padding: '40px 16px', textAlign: 'center' }}>
                <Bell size={28} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                <strong>No announcements currently live</strong>
                <span>Create an announcement on the left to broadcast it to students.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                {announcements.map((ann) => (
                  <article
                    key={ann.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm relative"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                              ann.priority === 'urgent'
                                ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/30'
                                : ann.priority === 'promo'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                            }`}
                          >
                            {ann.priority || 'NORMAL'}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Audience: {ann.audience?.toUpperCase() || 'ALL'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">{ann.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                          {ann.content}
                        </p>
                        <div className="mt-2 text-[10px] text-slate-400">
                          Posted {new Date(ann.created_at).toLocaleString()} by {ann.author}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 transition-colors shrink-0"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        title="Delete announcement"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
