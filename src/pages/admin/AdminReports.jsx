import { useEffect, useMemo, useState } from 'react';
import {
  Activity, TrendingUp, Users, FileQuestion, IndianRupee,
  Coins, CheckCircle2, Award, Clock, ArrowUpRight, RefreshCw, BarChart3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

export default function AdminReports() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalAttempts: 0,
    completedAttempts: 0,
    averageScore: 0,
    totalRevenue: 0,
    totalCoins: 0,
    totalReferrals: 0
  });

  const [recentAttempts, setRecentAttempts] = useState([]);
  const [dropoffInsights, setDropoffInsights] = useState({ total: 0, byType: [], hotspots: [] });

  const loadReportData = async (active = () => true) => {
    if (!supabase) return;
    setRefreshing(true);

    try {
      const [
        usersResult,
        attemptsResult,
        ordersResult,
        walletsResult,
        referralsResult,
        recentAttemptsResult
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('test_attempts').select('score, status, time_spent, state_json'),
        supabase.from('payment_orders').select('amount, status'),
        supabase.from('coin_wallets').select('balance'),
        supabase.from('referrals').select('id', { count: 'exact', head: true }),
        supabase.from('test_attempts').select('id, user_id, test_id, score, status, created_at').order('created_at', { ascending: false }).limit(15)
      ]);

      if (active()) {
        const attempts = attemptsResult.data || [];
        const completed = attempts.filter((a) => a.status === 'completed');
        const eventCounts = new Map();
        const hotspotCounts = new Map();
        attempts.forEach((attempt) => {
          const events = Array.isArray(attempt.state_json?.dropoffEvents) ? attempt.state_json.dropoffEvents : [];
          events.forEach((event) => {
            const type = String(event?.type || 'unknown');
            eventCounts.set(type, (eventCounts.get(type) || 0) + 1);
            const hotspot = event?.section || event?.questionId;
            if (hotspot) hotspotCounts.set(String(hotspot), (hotspotCounts.get(String(hotspot)) || 0) + 1);
          });
        });
        const totalScore = completed.reduce((sum, a) => sum + (Number(a.score) || 0), 0);
        const avgScore = completed.length > 0 ? Math.round(totalScore / completed.length) : 0;

        const orders = ordersResult.data || [];
        const revenue = orders
          .filter((o) => ['paid', 'success', 'captured'].includes(String(o.status || '').toLowerCase()))
          .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

        const wallets = walletsResult.data || [];
        const coins = wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);

        setMetrics({
          totalUsers: usersResult.count || 0,
          totalAttempts: attempts.length,
          completedAttempts: completed.length,
          averageScore: avgScore,
          totalRevenue: revenue,
          totalCoins: coins,
          totalReferrals: referralsResult.count || 0
        });

        setRecentAttempts(recentAttemptsResult.data || []);
        setDropoffInsights({
          total: Array.from(eventCounts.values()).reduce((sum, count) => sum + count, 0),
          byType: Array.from(eventCounts.entries()).sort(([, a], [, b]) => b - a).slice(0, 4),
          hotspots: Array.from(hotspotCounts.entries()).sort(([, a], [, b]) => b - a).slice(0, 5)
        });
      }
    } catch (err) {
      console.warn('Error loading admin reports:', err.message);
    } finally {
      if (active()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    loadReportData(() => active);
    return () => { active = false; };
  }, [supabase]);

  return (
    <div className="admin-reports-page">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">ANALYTICS & PLATFORM HEALTH</div>
          <h1>Platform Reports & Insights</h1>
          <p>Holistic view of student mock attempts, academic engagement, revenue, and referral virality.</p>
        </div>
        <button className="button button-outline" onClick={() => loadReportData()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="metrics-grid">
            <article className="metric-card">
              <div className="metric-icon blue"><Users size={18} /></div>
              <span className="metric-label">Registered Learners</span>
              <strong>{metrics.totalUsers.toLocaleString()}</strong>
              <span className="metric-foot">Active student accounts</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon blue"><FileQuestion size={18} /></div>
              <span className="metric-label">Mock Tests Attempted</span>
              <strong>{metrics.totalAttempts.toLocaleString()}</strong>
              <span className="metric-foot">{metrics.completedAttempts} completed attempts</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon green"><IndianRupee size={18} /></div>
              <span className="metric-label">Gross Revenue</span>
              <strong>₹{metrics.totalRevenue.toLocaleString('en-IN')}</strong>
              <span className="metric-foot">All-time course & test sales</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon violet"><Award size={18} /></div>
              <span className="metric-label">Avg Test Score</span>
              <strong>{metrics.averageScore}%</strong>
              <span className="metric-foot">Overall accuracy index</span>
            </article>
          </div>

          <div className="admin-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">ENGAGEMENT RATIOS</div>
                  <h2>Learning & Virality Ratios</h2>
                </div>
                <div className="setting-symbol"><BarChart3 size={18} /></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <div style={{ padding: '14px', background: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.875rem' }}>Test Completion Rate</span>
                    <strong>{metrics.totalAttempts > 0 ? Math.round((metrics.completedAttempts / metrics.totalAttempts) * 100) : 0}%</strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${metrics.totalAttempts > 0 ? Math.round((metrics.completedAttempts / metrics.totalAttempts) * 100) : 0}%`, height: '100%', background: '#34d399', borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ padding: '14px', background: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.875rem' }}>Referral Adoption</span>
                    <strong>{metrics.totalUsers > 0 ? ((metrics.totalReferrals / metrics.totalUsers) * 100).toFixed(1) : 0}%</strong>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, metrics.totalUsers > 0 ? ((metrics.totalReferrals / metrics.totalUsers) * 100) : 0)}%`, height: '100%', background: '#f59e0b', borderRadius: '3px' }} />
                  </div>
                </div>

                <div style={{ padding: '14px', background: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: '8px', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.875rem' }}>Total Coins in Ecosystem</span>
                    <strong>{metrics.totalCoins.toLocaleString()} coins</strong>
                  </div>
                  <small style={{ color: 'var(--text-muted, #94a3b8)', display: 'block', marginTop: '4px' }}>
                    Liquid coin reward supply across learner wallets.
                  </small>
                </div>
              </div>
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">DROP-OFF SIGNALS</div>
                  <h2>Where learners leave</h2>
                </div>
                <span className="chapter-item-count">{dropoffInsights.total} events</span>
              </div>
              {dropoffInsights.total === 0 ? (
                <div className="empty-content" style={{ padding: '30px', textAlign: 'center' }}>
                  <Activity size={24} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                  <span>No pause, tab-switch, or abandonment events recorded yet.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Event types</strong>
                    {dropoffInsights.byType.map(([type, count]) => (
                      <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <span>{type.replace('_', ' ')}</span><strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Question or section hotspots</strong>
                    {dropoffInsights.hotspots.map(([hotspot, count]) => (
                      <div key={hotspot} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', gap: '12px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{hotspot}</span><strong>{count}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="panel-card">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">ACTIVITY STREAM</div>
                  <h2>Recent Test Submissions</h2>
                </div>
                <span className="chapter-item-count">{recentAttempts.length} attempts</span>
              </div>

              {recentAttempts.length === 0 ? (
                <div className="empty-content" style={{ padding: '30px', textAlign: 'center' }}>
                  <FileQuestion size={24} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                  <span>No test attempts recorded yet.</span>
                </div>
              ) : (
                <div className="data-table-wrap" style={{ overflowX: 'auto', marginTop: '14px' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', textAlign: 'left', color: 'var(--text-muted, #94a3b8)' }}>
                        <th style={{ padding: '8px 10px' }}>User ID</th>
                        <th style={{ padding: '8px 10px' }}>Status</th>
                        <th style={{ padding: '8px 10px' }}>Score</th>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttempts.map((att) => (
                        <tr key={att.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))' }}>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>
                            {att.user_id ? `${att.user_id.slice(0, 8)}…` : 'Guest'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: att.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: att.status === 'completed' ? '#34d399' : '#fbbf24'
                            }}>
                              {att.status || 'in_progress'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {att.score !== null && att.score !== undefined ? `${att.score}%` : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                            {att.created_at ? new Date(att.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
