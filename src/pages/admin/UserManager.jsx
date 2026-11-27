import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BookOpen, Coins, Gift, GitMerge, History, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import useContentCatalog from '../../hooks/useContentCatalog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { logAdminAction } from '../../lib/auditLog';

function normalizePhone(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function UserDrawer({ profile, balance, catalog, onClose, onUpdated }) {
  const { user, supabase, refreshAccount } = useAuth();
  const [access, setAccess] = useState([]);
  const [orders, setOrders] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [accessLoading, setAccessLoading] = useState(true);
  const [currentBalance, setCurrentBalance] = useState(balance || 0);
  const [action, setAction] = useState('coins');
  const [direction, setDirection] = useState('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [itemType, setItemType] = useState('chapter');
  const [itemId, setItemId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setCurrentBalance(balance || 0);
  }, [balance]);

  useEffect(() => {
    let active = true;
    setAccessLoading(true);
    const loadUserDetails = async () => {
      try {
        const [accessResult, ordersResult, attemptsResult] = await Promise.all([
          supabase.from('user_access').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
          supabase.from('payment_orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50),
          supabase.from('test_attempts').select('id, test_id, score, status, time_spent_seconds, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20)
        ]);
        if (!active) return;
        if (accessResult.error) setError(accessResult.error.message || 'Unable to load access grants.');
        setAccess(accessResult.data || []);
        setOrders(ordersResult.data || []);
        const attemptRows = attemptsResult.data || [];
        if (attemptRows.length > 0) {
          const testIds = Array.from(new Set(attemptRows.map((a) => a.test_id).filter(Boolean)));
          const { data: testsData } = testIds.length
            ? await supabase.from('tests').select('id, title').in('id', testIds)
            : { data: [] };
          const testMap = Object.fromEntries((testsData || []).map((t) => [t.id, t.title]));
          if (active) {
            setAttempts(attemptRows.map((a) => ({ ...a, test_title: testMap[a.test_id] || null })));
          }
        } else {
          setAttempts([]);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || 'Unable to load this user’s access and orders.');
        }
      } finally {
        if (active) setAccessLoading(false);
      }
    };
    loadUserDetails();
    return () => { active = false; };
  }, [profile.id, supabase]);

  const contentItems = useMemo(() => ({
    exam: (catalog?.exams || []).filter((item) => item.status !== 'archived').map((item) => ({ id: item.id, title: item.title })),
    folder: (catalog?.folders || []).filter((item) => item.status !== 'archived').map((item) => ({ id: item.id, title: item.title })),
    chapter: (catalog?.chapters || []).filter((item) => item.status !== 'archived').map((item) => ({ id: item.id, title: item.title }))
  }), [catalog]);
  const selectedItems = contentItems[itemType] || [];
  const activeAccess = access.filter((grant) => {
    if (grant.is_active === false || grant.active === false) return false;
    const status = String(grant.status || '').toLowerCase();
    if (['revoked', 'expired', 'inactive', 'cancelled', 'canceled'].includes(status)) return false;
    if (grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now()) return false;
    if (grant.starts_at && new Date(grant.starts_at).getTime() > Date.now()) return false;
    return true;
  });

  const revokeAccess = async (grantId) => {
    if (!window.confirm('Are you sure you want to revoke this access grant?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error: revokeErr } = await supabase
        .from('user_access')
        .update({ is_active: false, status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', grantId);
      if (revokeErr) throw revokeErr;
      setAccess((prev) => prev.filter((g) => g.id !== grantId));
      setMessage('Access grant revoked.');
      logAdminAction(supabase, {
        actor: user,
        action: 'revoke_user_access',
        targetType: 'user_access',
        targetId: grantId,
        details: { user_id: profile.id, email: profile.email }
      });
      await onUpdated();
    } catch (err) {
      setError(err.message || 'Unable to revoke access.');
    } finally {
      setBusy(false);
    }
  };

  const performAction = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!reason.trim()) { setError('Add an audit reason for this admin action.'); return; }
    if (action === 'coins' && (!Number.isInteger(Number(amount)) || Number(amount) < 1)) { setError('Enter a whole coin amount greater than zero.'); return; }
    const targetItemId = itemType === 'full_pass' ? 'global' : itemId;
    if (action === 'grant' && !targetItemId) { setError('Choose an exam, folder or chapter to grant.'); return; }
    setBusy(true);
    try {
      if (action === 'coins') {
        const absAmount = Math.abs(parseInt(amount, 10));

        // Call primary Postgres RPC definition: admin_adjust_user_coins(p_target_user_id, p_amount, p_action, p_reason)
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_adjust_user_coins', {
          p_target_user_id: profile.id,
          p_amount: absAmount,
          p_action: direction,
          p_reason: reason.trim()
        });

        if (rpcError) {
          throw new Error(rpcError.message || 'Unable to adjust user coins.');
        }

        if (rpcData && typeof rpcData.new_balance === 'number') {
          setCurrentBalance(rpcData.new_balance);
        } else {
          setCurrentBalance((prev) => direction === 'credit' ? prev + absAmount : Math.max(0, prev - absAmount));
        }

      setMessage(`${direction === 'credit' ? 'Credited' : 'Debited'} ${absAmount.toLocaleString()} coins with an audit reason.`);
      logAdminAction(supabase, {
        actor: user,
        action: `admin_coins_${direction}`,
        targetType: 'profile',
        targetId: profile.id,
        details: { amount: absAmount, reason: reason.trim(), email: profile.email }
      });
      setAmount('');
      setReason('');
      } else if (action === 'role') {
        const newRole = profile.role === 'super_admin' || profile.role === 'admin' ? 'student' : 'super_admin';
        const { error: rpcError } = await supabase.rpc('admin_update_user_role', {
          p_user_id: profile.id,
          p_role: newRole,
          p_reason: reason.trim()
        });
        if (rpcError) {
          // Direct fallback to profiles
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: newRole, updated_at: new Date().toISOString() })
            .eq('id', profile.id);
          if (profileError) throw profileError;
        }

        setMessage(`Role changed to ${newRole}.`);
        setReason('');
        if (profile.id === user?.id && typeof refreshAccount === 'function') {
          await refreshAccount();
        }
      } else {
        // Course Access Grant
        const now = new Date().toISOString();
        const selectedItem = (contentItems[itemType] || []).find((entry) => entry.id === targetItemId);
        const itemTitle = itemType === 'full_pass' ? 'All-in-One Global Full Pass' : (selectedItem?.title || `${itemType} access`);

        let grantSuccess = false;
        try {
          const res1 = await supabase.rpc('admin_grant_user_access', {
            p_user_id: profile.id,
            p_item_type: itemType,
            p_item_id: String(targetItemId),
            p_reason: reason.trim()
          });
          if (!res1.error) {
            grantSuccess = true;
          } else {
            const res2 = await supabase.rpc('admin_grant_user_access', {
              p_target_user_id: profile.id,
              p_item_type: itemType,
              p_item_id: targetItemId,
              p_duration_days: null
            });
            if (!res2.error) grantSuccess = true;
          }
        } catch (_) {}

        if (!grantSuccess) {
          const grantPayload = {
            user_id: profile.id,
            item_type: itemType,
            item_id: String(targetItemId),
            status: 'active',
            is_active: true,
            granted_by: user?.id || null,
            reason: reason.trim(),
            starts_at: now,
            expires_at: null,
            updated_at: now
          };

          const { error: insertError } = await supabase
            .from('user_access')
            .upsert(grantPayload, { onConflict: 'user_id,item_type,item_id' });

          if (insertError) {
            const { error: simpleInsertError } = await supabase
              .from('user_access')
              .insert({
                user_id: profile.id,
                item_type: itemType,
                item_id: String(targetItemId),
                status: 'active',
                is_active: true,
                granted_by: user?.id || null,
                reason: reason.trim(),
                starts_at: now,
                created_at: now,
                updated_at: now
              });
            if (simpleInsertError) throw simpleInsertError;
          }
        }

        // Reload access list
        const { data: updatedAccess } = await supabase
          .from('user_access')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });
        if (updatedAccess) {
          setAccess(updatedAccess);
        }
        setMessage(`Lifetime access granted for "${itemTitle}".`);
        if (itemType !== 'full_pass') setItemId('');
        setReason('');
      }
      await onUpdated();
    } catch (actionError) {
      setError(actionError.message || 'Unable to apply this admin action.');
    } finally { setBusy(false); }
  };

  const accessLabel = (grant) => {
    const type = grant.item_type || grant.content_type || 'content';
    const id = grant.item_id || grant.content_id;
    if (type === 'full_pass' || id === 'global') return '🌐 All-in-One Global Full Pass';
    const item = (contentItems[type] || []).find((entry) => entry.id === id);
    return grant.item_title || item?.title || `${type} · ${id || 'access'}`;
  };

  const toggleEmailVerification = async () => {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const nextVerified = !profile.email_verified;
      const { error: verifyErr } = await supabase
        .from('profiles')
        .update({ email_verified: nextVerified, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (verifyErr) throw verifyErr;
      setMessage(nextVerified ? 'User email marked as verified.' : 'User email marked as pending verification.');
      await onUpdated();
    } catch (err) {
      setError(err.message || 'Unable to update verification status.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="user-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <aside className="user-drawer" role="dialog" aria-modal="true" aria-labelledby="user-drawer-title">
      <header className="user-drawer-header"><div><div className="eyebrow">USER ACCOUNT</div><h2 id="user-drawer-title">Account details</h2></div><button className="icon-button" aria-label="Close user details" onClick={onClose}><X size={18} /></button></header>
      <section className="user-drawer-identity"><span className="user-avatar-large">{(profile.full_name || profile.email || 'S').slice(0, 1).toUpperCase()}</span><div><strong>{profile.full_name || 'Student'}</strong><small>{profile.email || 'Email unavailable'}</small>{profile.mobile ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><span style={{ fontSize: '12px', fontWeight: 'bold', color: '#34d399', fontFamily: 'monospace' }}>+91 {profile.mobile}</span><a href={`https://wa.me/91${profile.mobile.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent('Namaste ' + (profile.full_name || 'Student') + '! Zyvra ki taraf se aapke liye vishesh update.')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.4)', textDecoration: 'none' }} title="Send message on WhatsApp">💬 WhatsApp</a></div> : <small style={{ color: 'var(--muted)', fontSize: '10px' }}>No mobile number</small>}<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}><span className={`user-role-badge ${profile.role === 'super_admin' || profile.role === 'admin' ? 'admin' : ''}`}>{profile.role || 'student'}</span><button type="button" onClick={toggleEmailVerification} disabled={busy} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', border: profile.email_verified ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)', background: profile.email_verified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: profile.email_verified ? '#34d399' : '#fbbf24', cursor: 'pointer' }}>{profile.email_verified ? '✓ Verified' : '⏳ Verify Email'}</button></div></div></section>
      {error && <div className="feedback error-feedback">{error}</div>}
      {message && <div className="feedback success-feedback">{message}</div>}
      <section className="user-drawer-section"><div className="section-heading"><div><div className="eyebrow">CONTENT ACCESS</div><h3>Active grants</h3></div><span className="chapter-item-count">{activeAccess.length}</span></div>{accessLoading ? <p className="field-hint">Loading access grants…</p> : !activeAccess.length ? <p className="field-hint">No active access grants.</p> : <div className="user-detail-list">{activeAccess.map((grant) => <div key={grant.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={15} /><span><strong>{accessLabel(grant)}</strong><small>{grant.status || (grant.expires_at ? `Expires ${new Date(grant.expires_at).toLocaleDateString()}` : 'Lifetime / active')}</small></span></div><button type="button" onClick={() => revokeAccess(grant.id)} disabled={busy} style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer' }} title="Revoke access">Revoke</button></div>)}</div>}</section>
      <section className="user-drawer-section"><div className="section-heading"><div><div className="eyebrow">PAYMENT HISTORY</div><h3>Recent orders</h3></div><span className="chapter-item-count">{orders.length}</span></div>{accessLoading ? <p className="field-hint">Loading orders…</p> : !orders.length ? <p className="field-hint">No payment orders found.</p> : <div className="user-order-list">{orders.slice(0, 8).map((order) => <div key={order.id}><span><strong>{order.item_title || order.item_name || order.item_type || 'Learning access'}</strong><small>{order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN') : '—'}</small></span><span className={`order-status order-${String(order.status || 'pending').toLowerCase()}`}>{order.status || 'pending'}</span></div>)}</div>}</section>
      <section className="user-drawer-section"><div className="section-heading"><div><div className="eyebrow">LEARNING HISTORY</div><h3>Recent test attempts</h3></div><span className="chapter-item-count">{attempts.length}</span></div>{accessLoading ? <p className="field-hint">Loading learning history…</p> : !attempts.length ? <p className="field-hint">No test attempts recorded yet.</p> : <div className="user-order-list">{attempts.slice(0, 10).map((att) => <div key={att.id}><span><strong>{att.test_title || `Test ${String(att.test_id || '').slice(0, 8)}`}</strong><small>{att.created_at ? new Date(att.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</small></span><span className={`order-status ${att.status === 'completed' ? 'order-paid' : 'order-pending'}`}>{att.score !== null && att.score !== undefined ? `${att.score}%` : att.status || 'in_progress'}</span></div>)}</div>}</section>
      <section className="user-drawer-section user-admin-actions"><div className="section-heading"><div><div className="eyebrow">ADMIN ACTIONS</div><h3>Manage account</h3></div><span className="user-wallet-pill"><Coins size={14} /> {Number(currentBalance || 0).toLocaleString()}</span></div>
        <div className="user-action-tabs"><button className={action === 'coins' ? 'active' : ''} onClick={() => setAction('coins')}>🪙 कॉइन एडजस्ट करें</button><button className={action === 'grant' ? 'active' : ''} onClick={() => setAction('grant')}>🎁 कोर्स एक्सेस दें</button><button className={action === 'role' ? 'active' : ''} onClick={() => setAction('role')}>🛡️ रोल बदलें</button></div>
        <form className="user-action-form" onSubmit={performAction}>
          {action === 'coins' && <><div className="content-form-row"><label className="field-label">Adjustment<select className="text-input" value={direction} onChange={(event) => setDirection(event.target.value)}><option value="credit">Credit coins (+ जोड़ें)</option><option value="debit">Debit coins (− काटें)</option></select></label><label className="field-label">Amount (Coins)<input className="text-input" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label></div><small className="user-action-hint">{direction === 'debit' && Number(amount) > Number(currentBalance) ? 'Debit exceeds displayed balance; the server will validate the request.' : 'छात्र के वॉलेट में सीधे कॉइन जोड़ें या काटें (रिफंड, इनाम या बोनस)। लेजर में ऑडिट एंट्री रिकॉर्ड होगी।'}</small></>}
          {action === 'grant' && <><div className="content-form-row"><label className="field-label">Content type<select className="text-input" value={itemType} onChange={(event) => { const newType = event.target.value; setItemType(newType); setItemId(newType === 'full_pass' ? 'global' : ''); }}><option value="exam">Exam (पूरी परीक्षा)</option><option value="folder">Folder (विषय फ़ोल्डर)</option><option value="chapter">Chapter (अध्याय)</option><option value="full_pass">Full Pass (ऑल-एक्सेस ग्लोबल पास)</option></select></label><label className="field-label">Content item{itemType === 'full_pass' ? <select className="text-input" value="global" disabled><option value="global">🌐 All-in-One Global Full Pass</option></select> : <select className="text-input" value={itemId} onChange={(event) => setItemId(event.target.value)} required><option value="">Select content</option>{selectedItems.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select>}</label></div><small className="user-action-hint">छात्र को बिना किसी पेमेंट के इस कोर्स का मुफ़्त लाइफटाइम एक्सेस मिल जाएगा।</small></>}
          {action === 'role' && <div className="role-change-notice"><ShieldCheck size={17} /><span>Change this account to <strong>{profile.role === 'super_admin' || profile.role === 'admin' ? 'Student' : 'Super Admin'}</strong>. एडमिन रोल देने पर यह यूज़र कंट्रोल सेंटर के सभी डेटा को एक्सेस कर सकेगा।</span></div>}
          <label className="field-label">Audit reason * <textarea className="text-input" rows="2" maxLength="300" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="कारण लिखें: जैसे 'Doubt competition winner' या 'Offline fees verified'" required /></label>
          <button className="button button-gold button-full" disabled={busy}>{busy ? 'Applying…' : action === 'coins' ? direction === 'credit' ? <><ArrowDownLeft size={15} /> Credit coins</> : <><ArrowUpRight size={15} /> Debit coins</> : action === 'grant' ? <><Gift size={15} /> Grant lifetime access</> : <><ShieldCheck size={15} /> Update role</>}</button>
        </form>
      </section>
    </aside>
  </div>;
}

export default function UserManager() {
  const { user, supabase } = useAuth();
  const catalog = useContentCatalog();
  const [users, setUsers] = useState([]);
  const [wallets, setWallets] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [mergeGroup, setMergeGroup] = useState(null);
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [mergeReason, setMergeReason] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeFeedback, setMergeFeedback] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    setError('');
    const [profilesResult, walletsResult] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,mobile,role,target_exams,email_verified,created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('coin_wallets').select('user_id,balance')
    ]);
    const failed = [profilesResult, walletsResult].find((result) => result.error);
    if (failed) throw failed.error;
    const profileRows = profilesResult.data || [];
    const walletMap = Object.fromEntries((walletsResult.data || []).map((wallet) => [wallet.user_id, Number(wallet.balance || 0)]));
    setUsers(profileRows);
    setWallets(walletMap);
    setLoading(false);
    return { profileRows, walletMap };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    loadUsers().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load the student directory.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [loadUsers]);

  const duplicateGroups = useMemo(() => {
    const byPhone = new Map();
    users.forEach((u) => {
      const phone = normalizePhone(u.mobile);
      if (!phone) return;
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone).push(u);
    });
    return Array.from(byPhone.entries())
      .filter(([, list]) => list.length > 1)
      .map(([phone, accounts]) => ({ key: `phone:${phone}`, label: `+91 ${phone}`, accounts }));
  }, [users]);

  const duplicateUserIds = useMemo(() => {
    const set = new Set();
    duplicateGroups.forEach((g) => g.accounts.forEach((a) => set.add(a.id)));
    return set;
  }, [duplicateGroups]);

  const targetExamOptions = useMemo(() => {
    const map = new Map();
    (catalog?.exams || []).forEach((exam) => map.set(exam.title, { value: exam.title, label: exam.title }));
    users.forEach((u) => {
      (u.target_exams || []).forEach((tag) => {
        if (tag && !map.has(tag)) {
          map.set(tag, { value: tag, label: `${tag} (from onboarding)` });
        }
      });
    });
    return Array.from(map.values());
  }, [catalog?.exams, users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((profile) => {
      const role = String(profile.role || 'student');
      const matchesRole = roleFilter === 'all' || (roleFilter === 'admin' ? ['admin', 'super_admin', 'editor', 'support_agent'].includes(role) : role === 'student');
      const matchesExam = examFilter === 'all' || (profile.target_exams || []).includes(examFilter);
      const matchesDuplicate = !showDuplicatesOnly || duplicateUserIds.has(profile.id);
      const matchesSearch = !query || `${profile.full_name || ''} ${profile.email || ''} ${profile.mobile || ''} ${profile.id || ''}`.toLowerCase().includes(query);
      return matchesRole && matchesExam && matchesDuplicate && matchesSearch;
    });
  }, [users, search, roleFilter, examFilter, showDuplicatesOnly, duplicateUserIds]);

  const openMergeModal = (group) => {
    setMergeGroup(group);
    setPrimaryId(group.accounts[0]?.id || '');
    setSecondaryId(group.accounts[1]?.id || '');
    setMergeReason('Duplicate phone / test account merge');
    setMergeFeedback('');
  };

  const handleMergeAccounts = async (e) => {
    e.preventDefault();
    if (!supabase || !primaryId || !secondaryId || primaryId === secondaryId || !mergeReason.trim()) return;
    if (!window.confirm('Merge secondary account grants, orders, attempts, and coins into the primary account? The secondary account will be tagged [MERGED] and its mobile cleared.')) return;
    setMerging(true);
    setMergeFeedback('');
    try {
      const { data: secAccess } = await supabase.from('user_access').select('*').eq('user_id', secondaryId);
      for (const grant of secAccess || []) {
        await supabase.from('user_access').upsert({
          user_id: primaryId,
          item_type: grant.item_type,
          item_id: grant.item_id,
          status: grant.status || 'active',
          is_active: grant.is_active !== false,
          starts_at: grant.starts_at,
          expires_at: grant.expires_at,
          reason: `Merged from ${secondaryId}: ${mergeReason.trim()}`
        }, { onConflict: 'user_id,item_type,item_id' });
      }
      await supabase.from('payment_orders').update({ user_id: primaryId }).eq('user_id', secondaryId);
      await supabase.from('test_attempts').update({ user_id: primaryId }).eq('user_id', secondaryId);

      const secCoins = Number(wallets[secondaryId] || 0);
      if (secCoins > 0) {
        await supabase.rpc('admin_adjust_user_coins', {
          p_target_user_id: primaryId,
          p_amount: secCoins,
          p_action: 'credit',
          p_reason: `Account merge from ${secondaryId}: ${mergeReason.trim()}`
        });
        await supabase.rpc('admin_adjust_user_coins', {
          p_target_user_id: secondaryId,
          p_amount: secCoins,
          p_action: 'debit',
          p_reason: `Merged into ${primaryId}: ${mergeReason.trim()}`
        });
      }

      const secUser = users.find((u) => u.id === secondaryId);
      const mergedName = secUser?.full_name?.includes('[MERGED]')
        ? secUser.full_name
        : `${secUser?.full_name || 'Account'} [MERGED]`;
      await supabase.from('profiles').update({
        full_name: mergedName,
        mobile: null,
        updated_at: new Date().toISOString()
      }).eq('id', secondaryId);

      await logAdminAction(supabase, {
        actor: user,
        action: 'merge_duplicate_accounts',
        targetType: 'profile',
        targetId: primaryId,
        details: { secondary_id: secondaryId, coins_transferred: secCoins, reason: mergeReason.trim() }
      });

      setMergeGroup(null);
      await loadUsers();
    } catch (err) {
      setMergeFeedback(err.message || 'Unable to merge accounts.');
    } finally {
      setMerging(false);
    }
  };

  const refreshUsers = async () => {
    const { profileRows, walletMap } = await loadUsers();
    if (selected) {
      const refreshed = profileRows.find((item) => item.id === selected.id);
      if (refreshed) setSelected(refreshed);
      setWallets(walletMap);
    }
  };

  return <div className="user-manager-page">
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION / ACCESS CONTROL</div><h1>Users & access</h1><p>Review student accounts, balances, purchases and learning grants.</p></div><div className="user-directory-count"><Users size={16} /> {filteredUsers.length} users</div></div>
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/90 dark:bg-indigo-950/30 px-3.5 py-2.5 text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-2 mb-4">
      <span>💡 <strong>त्वरित सहायता:</strong> किसी भी छात्र पर क्लिक करके उसका एक्टिव कोर्स, ऑर्डर हिस्ट्री व वॉलेट देखें। आप वहाँ से सीधे मुफ़्त कोर्स का लाइफटाइम एक्सेस ग्रांट या कॉइन क्रेडिट कर सकते हैं।</span>
    </div>
    {error && <div className="feedback error-feedback">{error}</div>}
    {duplicateGroups.length > 0 && (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 mb-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <GitMerge size={15} />
            <span>{duplicateGroups.length} duplicate phone group(s) detected ({duplicateUserIds.size} accounts)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDuplicatesOnly((v) => !v)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-500"
            >
              {showDuplicatesOnly ? 'Show All Users' : 'Filter Duplicates'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {duplicateGroups.map((grp) => (
            <button
              key={grp.key}
              type="button"
              onClick={() => openMergeModal(grp)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900 border border-amber-400/40 text-[11px] font-semibold text-slate-800 dark:text-slate-200 hover:border-amber-500"
            >
              <GitMerge size={12} /> Merge {grp.label} ({grp.accounts.length} accounts)
            </button>
          ))}
        </div>
      </div>
    )}
    <section className="panel-card user-directory">
      <div className="user-directory-toolbar">
        <label className="content-search"><Search size={15} /><input aria-label="Search users" placeholder="Search name, email, mobile or ID…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="filter-select">Role<select className="text-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option><option value="student">Students</option><option value="admin">Admins & Staff</option></select></label>
        <label className="filter-select">Target exam<select className="text-input" value={examFilter} onChange={(event) => setExamFilter(event.target.value)}><option value="all">All exams</option>{targetExamOptions.map((exam) => <option key={exam.value} value={exam.value}>{exam.label}</option>)}</select></label>
      </div>
      {loading ? <LoadingSkeleton variant="table" count={5} /> : !filteredUsers.length ? <div className="empty-content"><UserRound size={23} /><strong>No matching users.</strong><span>Adjust your search or filters to see more accounts.</span></div> : <div className="user-directory-list">{filteredUsers.map((profile) => {
        const name = profile.full_name || 'Student';
        const isAdmin = ['admin', 'super_admin'].includes(profile.role);
        return <button className="user-directory-row" key={profile.id} onClick={() => setSelected(profile)}><span className={`user-avatar ${isAdmin ? 'admin' : ''}`}>{name.slice(0, 1).toUpperCase()}</span><span className="user-directory-name"><strong>{name}</strong><small>{profile.email || 'Email unavailable'}{profile.mobile ? ` · 📱 +91 ${profile.mobile}` : ''}</small></span><span className={`user-role-badge ${isAdmin ? 'admin' : ''}`}>{isAdmin ? 'super_admin' : 'student'}</span><span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: profile.email_verified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: profile.email_verified ? '#34d399' : '#fbbf24' }}>{profile.email_verified ? 'Verified' : 'Pending'}</span><span className="user-target-tags">{(profile.target_exams || []).length ? profile.target_exams.map((exam) => <i key={exam}>{exam}</i>) : <small>No target exam</small>}</span><span className="user-wallet-pill"><Coins size={14} /> {(wallets[profile.id] || 0).toLocaleString()}</span><span className="user-join-date">{profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}</span></button>;
      })}</div>}
    </section>
    {selected && <UserDrawer key={selected.id} profile={selected} balance={wallets[selected.id]} catalog={catalog} onClose={() => setSelected(null)} onUpdated={refreshUsers} />}
    {mergeGroup && (
      <div className="user-drawer-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !merging) setMergeGroup(null); }}>
        <div className="panel-card p-5 sm:p-6 w-full max-w-lg mx-4 space-y-4" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">DUPLICATE ACCOUNT DEDUPLICATION</div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Merge Accounts ({mergeGroup.label})</h3>
            </div>
            <button type="button" className="icon-button" onClick={() => setMergeGroup(null)} aria-label="Close merge dialog"><X size={18} /></button>
          </div>
          {mergeFeedback && <div className="feedback error-feedback">{mergeFeedback}</div>}
          <form onSubmit={handleMergeAccounts} className="space-y-3">
            <label className="field-label">
              Primary Account (Keep)
              <select className="text-input" value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}>
                {mergeGroup.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.full_name || 'Student'} ({acc.email || acc.id.slice(0, 8)}) — {(wallets[acc.id] || 0)} coins
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Secondary Account (Merge data from &amp; tag [MERGED])
              <select className="text-input" value={secondaryId} onChange={(e) => setSecondaryId(e.target.value)}>
                {mergeGroup.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.full_name || 'Student'} ({acc.email || acc.id.slice(0, 8)}) — {(wallets[acc.id] || 0)} coins
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Audit Reason *
              <input className="text-input" value={mergeReason} onChange={(e) => setMergeReason(e.target.value)} required />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="button button-outline" onClick={() => setMergeGroup(null)} disabled={merging}>Cancel</button>
              <button type="submit" className="button button-gold" disabled={merging || primaryId === secondaryId}>
                <GitMerge size={15} /> {merging ? 'Merging…' : 'Merge Accounts'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>;
}
