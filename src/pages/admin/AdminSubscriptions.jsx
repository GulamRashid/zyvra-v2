import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Clock, Key, Layers, PackageCheck, RefreshCw, Search
} from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusBadge from '../../components/common/StatusBadge';
import useContentCatalog from '../../hooks/useContentCatalog';
import { useAuth } from '../../context/AuthContext';

export default function AdminSubscriptions() {
  const { supabase } = useAuth();
  const { exams, folders, chapters } = useContentCatalog();
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loadError, setLoadError] = useState('');

  const loadGrants = useCallback(async (active = () => true) => {
    if (!supabase) return;
    setRefreshing(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('user_access')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const userIds = [...new Set((data || []).map((g) => g.user_id))].filter(Boolean);
      let userMap = {};

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (users) {
          users.forEach((u) => { userMap[u.id] = u; });
        }
      }

      if (active()) {
        const enriched = (data || []).map((g) => ({
          ...g,
          user: userMap[g.user_id] || { name: 'User ' + (g.user_id?.slice(0, 6) || ''), email: '—' }
        }));
        setGrants(enriched);
      }
    } catch (err) {
      console.warn('Error loading subscriptions / user_access:', err.message);
      if (active()) {
        setGrants([]);
        setLoadError('Access grants could not be loaded. Please refresh or check connection.');
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
    loadGrants(() => active);
    return () => { active = false; };
  }, [loadGrants]);

  const summary = useMemo(() => {
    const now = Date.now();
    const active = grants.filter((g) => {
      if (g.is_active === false || g.active === false) return false;
      const status = String(g.status || '').toLowerCase();
      if (['revoked', 'expired', 'inactive'].includes(status)) return false;
      if (g.expires_at && new Date(g.expires_at).getTime() <= now) return false;
      return true;
    });

    const lifetime = grants.filter((g) => !g.expires_at);
    const expiringSoon = active.filter((g) => {
      if (!g.expires_at) return false;
      const diff = new Date(g.expires_at).getTime() - now;
      return diff > 0 && diff <= 7 * 24 * 3600 * 1000;
    });

    return {
      activeCount: active.length,
      lifetimeCount: lifetime.length,
      expiringSoonCount: expiringSoon.length,
      totalCount: grants.length
    };
  }, [grants]);

  const filteredGrants = useMemo(() => {
    return grants.filter((g) => {
      if (filterType !== 'all') {
        if (filterType === 'active') {
          const isAct = g.is_active !== false && (!g.expires_at || new Date(g.expires_at).getTime() > Date.now());
          if (!isAct) return false;
        } else if (filterType === 'expired') {
          const isExp = g.expires_at && new Date(g.expires_at).getTime() <= Date.now();
          if (!isExp) return false;
        } else if (g.item_type !== filterType) {
          return false;
        }
      }

      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const userName = (g.user?.full_name || g.user?.name || '').toLowerCase();
      const userEmail = (g.user?.email || '').toLowerCase();
      const itemId = String(g.item_id || '').toLowerCase();
      return userName.includes(term) || userEmail.includes(term) || itemId.includes(term);
    });
  }, [grants, search, filterType]);

  const productMap = useMemo(() => {
    const map = new Map();
    (exams || []).forEach((e) => map.set(`exam:${e.id}`, e.title));
    (folders || []).forEach((f) => map.set(`folder:${f.id}`, f.title));
    (chapters || []).forEach((c) => map.set(`chapter:${c.id}`, c.title));
    return map;
  }, [exams, folders, chapters]);

  const resolveGrantName = (grant) => {
    if (grant.item_title) return grant.item_title;
    const type = String(grant.item_type || '').toLowerCase();
    const id = String(grant.item_id || '');
    if (type === 'full_pass' || id === 'global') return 'Zyvra Full Pass (All Exams)';
    return productMap.get(`${type}:${id}`) || (id ? `${type.toUpperCase()}: ${id.slice(0, 10)}…` : 'Global Pass');
  };

  const toggleGrantStatus = async (grant) => {
    const willActive = grant.is_active === false;
    const label = resolveGrantName(grant);
    const confirmed = window.confirm(
      willActive
        ? `Reinstate access for "${label}" (${grant.user?.full_name || grant.user?.email || 'Learner'})?`
        : `Revoke access for "${label}" (${grant.user?.full_name || grant.user?.email || 'Learner'})?`
    );
    if (!confirmed) return;
    try {
      const { error } = await supabase
        .from('user_access')
        .update({
          is_active: willActive,
          status: willActive ? 'active' : 'revoked'
        })
        .eq('id', grant.id);

      if (error) throw error;
      setGrants((prev) => prev.map((g) => g.id === grant.id ? { ...g, is_active: willActive, status: willActive ? 'active' : 'revoked' } : g));
    } catch (err) {
      alert('Unable to toggle grant: ' + err.message);
    }
  };

  return (
    <div className="admin-subscriptions-page">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">ACCESS PASSES & ENROLLMENTS</div>
          <h1>Subscriptions & User Access</h1>
          <p>Review all active content grants, course unlocks, and subscription validity periods.</p>
        </div>
        <button className="button button-outline" onClick={() => loadGrants()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/90 dark:bg-indigo-950/30 px-3.5 py-2.5 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2 mb-4">
        <span>💡 <strong>त्वरित सहायता:</strong> यहाँ छात्रों के कोर्स व टेस्ट सीरीज़ अनलॉक्स की सूची है। यदि किसी छात्र का एक्सेस अस्थायी रूप से रोकना हो तो 'Revoke' दबाएं, और वापस चालू करने के लिए 'Reinstate' दबाएं।</span>
      </div>

      {loadError && (
        <div className="banner error-banner" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          <strong>Error:</strong> {loadError}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton variant="table" />
      ) : (
        <>
          <div className="metrics-grid">
            <article className="metric-card">
              <div className="metric-icon green"><PackageCheck size={18} /></div>
              <span className="metric-label">Active Access Grants</span>
              <strong>{summary.activeCount}</strong>
              <span className="metric-foot">Learners with unlocked courses</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon gold"><Key size={18} /></div>
              <span className="metric-label">Lifetime Grants</span>
              <strong>{summary.lifetimeCount}</strong>
              <span className="metric-foot">Unrestricted validity</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon blue"><Clock size={18} /></div>
              <span className="metric-label">Expiring in 7 Days</span>
              <strong>{summary.expiringSoonCount}</strong>
              <span className="metric-foot">Target for renewal prompts</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon violet"><Layers size={18} /></div>
              <span className="metric-label">Total Entitlements</span>
              <strong>{summary.totalCount}</strong>
              <span className="metric-foot">All-time access records</span>
            </article>
          </div>

          <section className="panel-card p-5 sm:p-6 mt-6 min-w-0 overflow-hidden">
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%', maxWidth: '720px' }}>
                <div className="input-with-icon" style={{ minWidth: '0', flex: '1 1 200px' }}>
                  <Search size={15} />
                  <input
                    type="search"
                    placeholder="Search learner name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="text-input"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { id: 'all', label: 'ALL' },
                    { id: 'active', label: 'ACTIVE' },
                    { id: 'expired', label: 'EXPIRED' },
                    { id: 'exam', label: 'EXAMS' },
                    { id: 'chapter', label: 'CHAPTERS' }
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={`button button-small ${filterType === id ? 'button-gold' : 'button-outline'}`}
                      onClick={() => setFilterType(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <span className="chapter-item-count">{filteredGrants.length} grants</span>
            </div>

            {filteredGrants.length === 0 ? (
              <div className="empty-content" style={{ padding: '40px 16px', textAlign: 'center' }}>
                <PackageCheck size={28} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                <strong>No access grants found</strong>
                <span>Try modifying your search query or filter.</span>
              </div>
            ) : (
              <div className="data-table-wrap" style={{ overflowX: 'auto', marginTop: '16px' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', textAlign: 'left', color: 'var(--text-muted, #94a3b8)' }}>
                      <th style={{ padding: '10px 12px' }}>Learner</th>
                      <th style={{ padding: '10px 12px' }}>Unlocked Resource</th>
                      <th style={{ padding: '10px 12px' }}>Granted On</th>
                      <th style={{ padding: '10px 12px' }}>Validity / Expiry</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrants.map((grant) => {
                      const isExpired = grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now();
                      const isActive = grant.is_active !== false && !isExpired && grant.status !== 'revoked';

                      return (
                        <tr key={grant.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))' }}>
                          <td style={{ padding: '12px' }}>
                            <strong style={{ display: 'block' }}>{grant.user?.full_name || grant.user?.name || 'Learner'}</strong>
                            <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.775rem' }}>{grant.user?.email || '—'}</small>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                              <BookOpen size={14} style={{ color: 'var(--gold, #f59e0b)' }} />
                              <span>{resolveGrantName(grant)}</span>
                            </span>
                            <small style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>
                              {grant.item_type || 'pass'}
                            </small>
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                            {grant.created_at ? new Date(grant.created_at).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td style={{ padding: '12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {grant.expires_at ? (
                              <span style={{ color: isExpired ? '#f87171' : 'inherit' }}>
                                {new Date(grant.expires_at).toLocaleDateString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ color: '#34d399' }}>Lifetime</span>
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {isActive ? (
                              <StatusBadge status="active" label="ACTIVE" />
                            ) : (
                              <StatusBadge status={isExpired ? 'expired' : 'revoked'} label={isExpired ? 'EXPIRED' : 'REVOKED'} />
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <button
                              type="button"
                              className="button button-outline button-small"
                              onClick={() => toggleGrantStatus(grant)}
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            >
                              {isActive ? 'Revoke (रोकें)' : 'Reinstate (चालू करें)'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
