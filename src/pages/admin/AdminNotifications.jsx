import { useEffect, useState } from 'react';
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

  const loadAnnouncements = async (active = () => true) => {
    if (!supabase) return;
    setRefreshing(true);
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
    } finally {
      if (active()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    loadAnnouncements(() => active);
    return () => { active = false; };
  }, [supabase]);

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

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="admin-two-col-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) 1fr', gap: '24px', marginTop: '20px' }}>
          {/* Create Announcement Form */}
          <section className="panel-card">
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
                <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Subject / Heading
                  <input
                    type="text"
                    placeholder="e.g. BPSC Prelims 2026 Test Series is Now Live!"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-input"
                    style={{ marginTop: '4px', width: '100%' }}
                    required
                  />
                </label>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Message Content
                  <textarea
                    rows={4}
                    placeholder="Provide details about exam dates, new question packs, or tips for learners..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="text-input"
                    style={{ marginTop: '4px', width: '100%', resize: 'vertical' }}
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
                <div>
                  <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.825rem', fontWeight: 600 }}>
                    Audience
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="text-input"
                      style={{ marginTop: '4px', width: '100%' }}
                    >
                      <option value="all">All Learners</option>
                      <option value="bpsc">BPSC Aspirants</option>
                      <option value="ssc">SSC Aspirants</option>
                      <option value="ctet">CTET Aspirants</option>
                    </select>
                  </label>
                </div>

                <div>
                  <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.825rem', fontWeight: 600 }}>
                    Priority
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="text-input"
                      style={{ marginTop: '4px', width: '100%' }}
                    >
                      <option value="normal">Standard Notice</option>
                      <option value="high">Urgent Alert</option>
                      <option value="promo">Special Reward / Offer</option>
                    </select>
                  </label>
                </div>
              </div>

              {feedback.text && (
                <div className={`feedback ${feedback.type === 'success' ? 'success-feedback' : 'error-feedback'}`} style={{ marginTop: '14px' }}>
                  {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {feedback.text}
                </div>
              )}

              <div style={{ marginTop: '20px' }}>
                <button
                  type="submit"
                  className="button button-gold"
                  disabled={submitting || !title.trim() || !content.trim()}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Send size={15} /> {submitting ? 'Broadcasting…' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </section>

          {/* Published Announcements List */}
          <section className="panel-card">
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                {announcements.map((ann) => (
                  <article
                    key={ann.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: 'var(--bg-subtle, rgba(255,255,255,0.03))',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: ann.priority === 'urgent' ? 'rgba(239, 68, 68, 0.15)' : ann.priority === 'promo' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                              color: ann.priority === 'urgent' ? '#f87171' : ann.priority === 'promo' ? '#fbbf24' : '#60a5fa'
                            }}
                          >
                            {ann.priority || 'NORMAL'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                            Audience: {ann.audience?.toUpperCase() || 'ALL'}
                          </span>
                        </div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 6px' }}>{ann.title}</h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted, #cbd5e1)', margin: 0, whiteSpace: 'pre-line' }}>
                          {ann.content}
                        </p>
                        <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                          Posted {new Date(ann.created_at).toLocaleString()} by {ann.author}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="button button-outline button-small danger-button"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        title="Delete announcement"
                        style={{ padding: '6px 8px', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
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
