import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Coins, Gift, RefreshCw, Save,
  Search, Share2, Sparkles, Users
} from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusBadge from '../../components/common/StatusBadge';

import { useAuth } from '../../context/AuthContext';
import { getReferralSettings, saveReferralSettings } from '../../lib/referrals';

export default function AdminCoins() {
  const { supabase } = useAuth();

  // Metrics
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalCoinsInCirculation, setTotalCoinsInCirculation] = useState(0);
  const [activeWalletsCount, setActiveWalletsCount] = useState(0);
  const [totalReferralCoins, setTotalReferralCoins] = useState(0);
  const [referralsCount, setReferralsCount] = useState(0);

  // Settings state
  const [settings, setSettings] = useState({ enabled: true, referrerCoins: 50, referredCoins: 20 });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState({ text: '', type: '' });
  const [loadError, setLoadError] = useState('');

  // Referrals table
  const [referrals, setReferrals] = useState([]);
  const [referralSearch, setReferralSearch] = useState('');

  // Recent transactions table
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('all'); // 'all' | 'credit' | 'debit'
  const [recentTransactions, setRecentTransactions] = useState([]);

  const loadData = useCallback(async (active = () => true) => {
    if (!supabase) return;
    setRefreshing(true);
    setLoadError('');

    try {
      // 1. Load referral program settings
      const currentSettings = await getReferralSettings(supabase);
      if (active()) setSettings(currentSettings);

      // 2. Load wallets for total circulation
      const { data: wallets } = await supabase
        .from('coin_wallets')
        .select('balance');

      if (active() && wallets) {
        const total = wallets.reduce((acc, w) => acc + (Number(w.balance) || 0), 0);
        setTotalCoinsInCirculation(total);
        setActiveWalletsCount(wallets.filter((w) => Number(w.balance) > 0).length);
      }

      // 3. Load referrals with user profiles
      const { data: refRows } = await supabase
        .from('referrals')
        .select(`
          id,
          referrer_id,
          referred_id,
          referrer_coins_awarded,
          referred_coins_awarded,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (active() && refRows) {
        setReferralsCount(refRows.length);
        const refCoinsTotal = refRows.reduce(
          (acc, r) => acc + Number(r.referrer_coins_awarded || 0) + Number(r.referred_coins_awarded || 0),
          0
        );
        setTotalReferralCoins(refCoinsTotal);

        // Fetch user profiles for the user IDs
        const userIds = [...new Set([
          ...refRows.map((r) => r.referrer_id),
          ...refRows.map((r) => r.referred_id)
        ])].filter(Boolean);

        let profileMap = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email, referral_code')
            .in('id', userIds);

          if (profiles) {
            profiles.forEach((p) => {
              profileMap[p.id] = p;
            });
          }
        }

        const enrichedReferrals = refRows.map((r) => ({
          ...r,
          referrer: profileMap[r.referrer_id] || { name: 'User ' + (r.referrer_id?.slice(0, 6) || ''), email: '—' },
          referred: profileMap[r.referred_id] || { name: 'User ' + (r.referred_id?.slice(0, 6) || ''), email: '—' }
        }));

        setReferrals(enrichedReferrals);
      }

      // 4. Load full coin ledger from coin_ledger + coin_transactions and enrich with user profiles
      const [ledgerRes, txRes] = await Promise.allSettled([
        supabase
          .from('coin_ledger')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('coin_transactions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200)
      ]);

      const ledgerData = ledgerRes.status === 'fulfilled' && !ledgerRes.value.error ? (ledgerRes.value.data || []) : [];
      const txData = txRes.status === 'fulfilled' && !txRes.value.error ? (txRes.value.data || []) : [];

      const mergedMap = new Map();
      [...ledgerData, ...txData].forEach((row) => {
        const tsSec = row.created_at ? Math.floor(new Date(row.created_at).getTime() / 1000) : 0;
        const dedupeKey = `${row.user_id || ''}:${tsSec}:${Number(row.amount || 0)}:${String(row.transaction_type || row.type || 'credit').toLowerCase()}`;
        if (!mergedMap.has(dedupeKey)) {
          mergedMap.set(dedupeKey, row);
        }
      });

      const mergedLedger = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );

      // Enrich ledger rows with user & granter profiles
      const ledgerUserIds = [...new Set([
        ...mergedLedger.map((tx) => tx.user_id),
        ...mergedLedger.map((tx) => tx.granted_by || tx.admin_id)
      ])].filter(Boolean);

      let ledgerProfileMap = {};
      if (ledgerUserIds.length > 0) {
        const { data: ledgerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ledgerUserIds);
        (ledgerProfiles || []).forEach((p) => {
          ledgerProfileMap[p.id] = p;
        });
      }

      const enrichedLedger = mergedLedger.map((tx) => {
        const u = ledgerProfileMap[tx.user_id];
        const granterId = tx.granted_by || tx.admin_id;
        const granter = granterId ? ledgerProfileMap[granterId] : null;
        return {
          ...tx,
          user_name: u?.full_name || (tx.user_id ? `User ${tx.user_id.slice(0, 6)}` : '—'),
          user_email: u?.email || '—',
          granted_by_label: granter?.full_name || granter?.email || (tx.source === 'admin' ? 'Admin' : 'System')
        };
      });

      if (active()) {
        setRecentTransactions(enrichedLedger);
      }
    } catch (err) {
      console.warn('Error loading admin coin data:', err);
      if (active()) {
        setLoadError('Coin data could not be loaded. Please refresh or check connection.');
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
    loadData(() => active);
    return () => { active = false; };
  }, [loadData]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback({ text: '', type: '' });

    try {
      await saveReferralSettings(supabase, settings);
      setSettingsFeedback({ text: 'Referral rules successfully saved and active across Zyvra.', type: 'success' });
    } catch (err) {
      setSettingsFeedback({ text: err.message || 'Failed to save settings.', type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredReferrals = useMemo(() => {
    if (!referralSearch.trim()) return referrals;
    const term = referralSearch.toLowerCase();
    return referrals.filter((r) => {
      const refName = (r.referrer?.full_name || r.referrer?.name || '').toLowerCase();
      const refEmail = (r.referrer?.email || '').toLowerCase();
      const refCode = (r.referrer?.referral_code || '').toLowerCase();
      const joinedName = (r.referred?.full_name || r.referred?.name || '').toLowerCase();
      const joinedEmail = (r.referred?.email || '').toLowerCase();
      return refName.includes(term) || refEmail.includes(term) || refCode.includes(term) || joinedName.includes(term) || joinedEmail.includes(term);
    });
  }, [referrals, referralSearch]);

  return (
    <div className="admin-coins-page">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">REWARD ENGINE & INCENTIVES</div>
          <h1>Zyvra Coins & Share & Earn</h1>
          <p>Configure student referral rewards, monitor coin circulation, and audit invite milestones.</p>
        </div>
        <button
          className="button button-outline"
          onClick={() => loadData()}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loadError && (
        <div className="banner error-banner" style={{ marginBottom: '16px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
          <strong>Error:</strong> {loadError}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="metrics-grid">
            <article className="metric-card">
              <div className="metric-icon gold"><Coins size={18} /></div>
              <span className="metric-label">Coins in Circulation</span>
              <strong>{totalCoinsInCirculation.toLocaleString()}</strong>
              <span className="metric-foot">{activeWalletsCount} learner wallets holding balance</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon blue"><Gift size={18} /></div>
              <span className="metric-label">Total Referrals Completed</span>
              <strong>{referralsCount.toLocaleString()}</strong>
              <span className="metric-foot">Successful friend invites</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon green"><Sparkles size={18} /></div>
              <span className="metric-label">Referral Coins Distributed</span>
              <strong>+{totalReferralCoins.toLocaleString()}</strong>
              <span className="metric-foot">Awarded to referrers & new joiners</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon violet"><Share2 size={18} /></div>
              <span className="metric-label">Program Status</span>
              <strong>{settings.enabled ? 'ACTIVE' : 'PAUSED'}</strong>
              <span className="metric-foot">
                {settings.referrerCoins}c referrer / {settings.referredCoins}c joiner
              </span>
            </article>
          </div>

          <div className="admin-two-col-grid admin-coins-content-grid">
            {/* Share & Earn Settings Form */}
            <section className="panel-card referral-settings-card">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">CONFIGURATION</div>
                  <h2>Share & Earn Rules</h2>
                </div>
                <div className="setting-symbol"><Gift size={18} /></div>
              </div>
              <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.875rem', marginBottom: '18px' }}>
                Tune how many Zyvra Coins learners earn when sharing their invite link with peers.
              </p>

              <form onSubmit={handleSaveSettings} className="referral-settings-form">
                <div className="form-toggle-row">
                  <div>
                    <strong style={{ display: 'block', fontSize: '0.95rem' }}>Referral Program</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>Enable Share & Earn cards on student wallets</span>
                  </div>
                  <label className="toggle-switch referral-toggle">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                    />
                  </label>
                </div>

                <div className="referral-setting-field">
                  <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }}>
                    Referrer Reward (Coins)
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      className="text-input"
                      value={settings.referrerCoins}
                      onChange={(e) => setSettings({ ...settings, referrerCoins: Math.max(0, parseInt(e.target.value) || 0) })}
                      required
                    />
                  </label>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                    Awarded to the existing student when their invited friend signs up. (Configured: {settings.referrerCoins} coins)
                  </p>
                </div>

                <div className="referral-setting-field">
                  <label className="field-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.875rem', fontWeight: 600 }}>
                    New Student Bonus (Coins)
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      className="text-input"
                      value={settings.referredCoins}
                      onChange={(e) => setSettings({ ...settings, referredCoins: Math.max(0, parseInt(e.target.value) || 0) })}
                      required
                    />
                  </label>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
                    Welcome bonus credited to the new learner's wallet upon joining. (Configured: {settings.referredCoins} coins)
                  </p>
                </div>

                {settingsFeedback.text && (
                  <div className={`feedback ${settingsFeedback.type === 'success' ? 'success-feedback' : 'error-feedback'}`}>
                    {settingsFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {settingsFeedback.text}
                  </div>
                )}

                <button type="submit" className="button button-gold referral-save-button" disabled={savingSettings}>
                  <Save size={16} /> {savingSettings ? 'Saving Settings…' : 'Save Referral Rules'}
                </button>
              </form>
            </section>

            {/* Referral Analytics & Recent Invites Table */}
            <section className="panel-card referral-history-card">
              <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div className="eyebrow">AUDIT TRAIL</div>
                  <h2>Recent Referral Invites</h2>
                </div>
                <div className="input-with-icon" style={{ maxWidth: '240px' }}>
                  <Search size={15} />
                  <input
                    type="search"
                    placeholder="Search name, email, code…"
                    value={referralSearch}
                    onChange={(e) => setReferralSearch(e.target.value)}
                    className="text-input"
                    style={{ fontSize: '0.85rem', padding: '6px 10px 6px 30px' }}
                  />
                </div>
              </div>

              {filteredReferrals.length === 0 ? (
                <div className="empty-content" style={{ padding: '40px 16px', textAlign: 'center' }}>
                  <Users size={28} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                  <strong>No referral records found</strong>
                  <span>Invites and coin grants will be listed here automatically when students share links.</span>
                </div>
              ) : (
                <div className="data-table-wrap" style={{ overflowX: 'auto', marginTop: '16px' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', textAlign: 'left', color: 'var(--text-muted, #94a3b8)' }}>
                        <th style={{ padding: '10px 12px' }}>Referrer</th>
                        <th style={{ padding: '10px 12px' }}>New Learner</th>
                        <th style={{ padding: '10px 12px' }}>Coins Awarded</th>
                        <th style={{ padding: '10px 12px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReferrals.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))' }}>
                          <td style={{ padding: '12px' }}>
                            <strong style={{ display: 'block' }}>{item.referrer?.full_name || item.referrer?.name || 'Learner'}</strong>
                            <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.775rem' }}>
                              {item.referrer?.email || ''} {item.referrer?.referral_code ? `(${item.referrer.referral_code})` : ''}
                            </small>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <strong style={{ display: 'block' }}>{item.referred?.full_name || item.referred?.name || 'Learner'}</strong>
                            <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.775rem' }}>
                              {item.referred?.email || '—'}
                            </small>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span className="status-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Coins size={12} /> +{item.referrer_coins_awarded || 50} / +{item.referred_coins_awarded || 20}
                            </span>
                          </td>
                          <td style={{ padding: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                            {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Full Global Coin Ledger */}
          <section className="panel-card p-5 sm:p-6 mt-6 min-w-0 overflow-hidden">
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="eyebrow">GLOBAL LEDGER</div>
                <h2>Coin Transactions Ledger</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="input-with-icon" style={{ maxWidth: '220px' }}>
                  <Search size={15} />
                  <input
                    type="search"
                    aria-label="Search coin ledger"
                    placeholder="Search user, reason…"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    className="text-input"
                    style={{ fontSize: '0.85rem', padding: '6px 10px 6px 30px' }}
                  />
                </div>
                {['all', 'credit', 'debit'].map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`button button-small ${ledgerFilter === kind ? 'button-primary' : 'button-outline'}`}
                    onClick={() => setLedgerFilter(kind)}
                  >
                    {kind.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {(() => {
              const q = ledgerSearch.trim().toLowerCase();
              const filteredLedger = recentTransactions.filter((tx) => {
                const kind = String(tx.transaction_type || tx.type || 'credit').toLowerCase();
                const isCredit = ['credit', 'earned', 'reward', 'bonus', 'referral', 'refund'].some((k) => kind.includes(k));
                if (ledgerFilter === 'credit' && !isCredit) return false;
                if (ledgerFilter === 'debit' && isCredit) return false;
                if (!q) return true;
                return (
                  String(tx.user_name || '').toLowerCase().includes(q) ||
                  String(tx.user_email || '').toLowerCase().includes(q) ||
                  String(tx.reason || tx.description || '').toLowerCase().includes(q) ||
                  String(tx.granted_by_label || '').toLowerCase().includes(q)
                );
              });

              if (filteredLedger.length === 0) {
                return (
                  <div className="empty-content" style={{ padding: '30px', textAlign: 'center' }}>
                    <Coins size={24} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                    <span>No coin activity logged yet.</span>
                  </div>
                );
              }

              return (
                <div className="data-table-wrap" style={{ overflowX: 'auto', marginTop: '14px' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', textAlign: 'left', color: 'var(--text-muted, #94a3b8)' }}>
                        <th style={{ padding: '10px 12px' }}>Type</th>
                        <th style={{ padding: '10px 12px' }}>User</th>
                        <th style={{ padding: '10px 12px' }}>Reason / Description</th>
                        <th style={{ padding: '10px 12px' }}>Amount</th>
                        <th style={{ padding: '10px 12px' }}>Granted By</th>
                        <th style={{ padding: '10px 12px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLedger.map((tx) => {
                        const kind = String(tx.transaction_type || tx.type || 'credit').toLowerCase();
                        const isCredit = ['credit', 'earned', 'reward', 'bonus', 'referral', 'refund'].some((k) => kind.includes(k));
                        return (
                          <tr key={tx.id || `${tx.user_id}-${tx.created_at}`} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <StatusBadge
                                variant={isCredit ? 'success' : 'failed'}
                                label={isCredit ? 'CREDIT' : 'DEBIT'}
                              />
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <strong style={{ display: 'block' }}>{tx.user_name}</strong>
                              <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem' }}>{tx.user_email}</small>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div>{tx.reason || 'Coin reward'}</div>
                              {tx.description && (
                                <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem' }}>{tx.description}</small>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: isCredit ? '#34d399' : '#f87171', whiteSpace: 'nowrap' }}>
                              {isCredit ? '+' : '−'}{Math.abs(Number(tx.amount || 0)).toLocaleString()} coins
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                              {tx.granted_by_label || 'System'}
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                              {tx.created_at ? new Date(tx.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
        </>
      )}
    </div>
  );
}
