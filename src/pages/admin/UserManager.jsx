import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BookOpen, Coins, Gift, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import useContentCatalog from '../../hooks/useContentCatalog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';

function UserDrawer({ profile, balance, catalog, onClose, onUpdated }) {
  const { user, supabase, refreshAccount } = useAuth();
  const [access, setAccess] = useState([]);
  const [orders, setOrders] = useState([]);
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
    const loadUserDetails = async () => {
      const [accessResult, ordersResult] = await Promise.all([
        supabase.from('user_access').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('payment_orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(50)
      ]);
      const failed = [accessResult, ordersResult].find((result) => result.error);
      if (failed) throw failed.error;
      if (!active) return;
      setAccess(accessResult.data || []);
      setOrders(ordersResult.data || []);
      setAccessLoading(false);
    };
    loadUserDetails().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load this user’s access and orders.');
        setAccessLoading(false);
      }
    });
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

  return <div className="user-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <aside className="user-drawer" role="dialog" aria-modal="true" aria-labelledby="user-drawer-title">
      <header className="user-drawer-header"><div><div className="eyebrow">USER ACCOUNT</div><h2 id="user-drawer-title">Account details</h2></div><button className="icon-button" aria-label="Close user details" onClick={onClose}><X size={18} /></button></header>
      <section className="user-drawer-identity"><span className="user-avatar-large">{(profile.full_name || profile.email || 'S').slice(0, 1).toUpperCase()}</span><div><strong>{profile.full_name || 'Student'}</strong><small>{profile.email || 'Email unavailable'}</small>{profile.mobile ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}><span style={{ fontSize: '12px', fontWeight: 'bold', color: '#34d399', fontFamily: 'monospace' }}>+91 {profile.mobile}</span><a href={`https://wa.me/91${profile.mobile.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent('Namaste ' + (profile.full_name || 'Student') + '! Zyvra ki taraf se aapke liye vishesh update.')}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.4)', textDecoration: 'none' }} title="Send message on WhatsApp">💬 WhatsApp</a></div> : <small style={{ color: 'var(--muted)', fontSize: '10px' }}>No mobile number</small>}<span className={`user-role-badge ${profile.role === 'super_admin' || profile.role === 'admin' ? 'admin' : ''}`}>{profile.role || 'student'}</span></div></section>
      {error && <div className="feedback error-feedback">{error}</div>}
      {message && <div className="feedback success-feedback">{message}</div>}
      <section className="user-drawer-section"><div className="section-heading"><div><div className="eyebrow">CONTENT ACCESS</div><h3>Active grants</h3></div><span className="chapter-item-count">{activeAccess.length}</span></div>{accessLoading ? <p className="field-hint">Loading access grants…</p> : !activeAccess.length ? <p className="field-hint">No active access grants.</p> : <div className="user-detail-list">{activeAccess.map((grant) => <div key={grant.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpen size={15} /><span><strong>{accessLabel(grant)}</strong><small>{grant.status || (grant.expires_at ? `Expires ${new Date(grant.expires_at).toLocaleDateString()}` : 'Lifetime / active')}</small></span></div><button type="button" onClick={() => revokeAccess(grant.id)} disabled={busy} style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer' }} title="Revoke access">Revoke</button></div>)}</div>}</section>
      <section className="user-drawer-section"><div className="section-heading"><div><div className="eyebrow">PAYMENT HISTORY</div><h3>Recent orders</h3></div><span className="chapter-item-count">{orders.length}</span></div>{accessLoading ? <p className="field-hint">Loading orders…</p> : !orders.length ? <p className="field-hint">No payment orders found.</p> : <div className="user-order-list">{orders.slice(0, 8).map((order) => <div key={order.id}><span><strong>{order.item_title || order.item_name || order.item_type || 'Learning access'}</strong><small>{order.created_at ? new Date(order.created_at).toLocaleDateString() : '—'}</small></span><span className={`order-status order-${String(order.status || 'pending').toLowerCase()}`}>{order.status || 'pending'}</span></div>)}</div>}</section>
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
  const { supabase } = useAuth();
  const catalog = useContentCatalog();
  const [users, setUsers] = useState([]);
  const [wallets, setWallets] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    setError('');
    const [profilesResult, walletsResult] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,mobile,role,target_exams,created_at').order('created_at', { ascending: false }).limit(1000),
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

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((profile) => {
      const role = String(profile.role || 'student');
      const matchesRole = roleFilter === 'all' || (roleFilter === 'admin' ? ['admin', 'super_admin'].includes(role) : role === 'student');
      const matchesExam = examFilter === 'all' || (profile.target_exams || []).includes(examFilter);
      const matchesSearch = !query || `${profile.full_name || ''} ${profile.email || ''} ${profile.mobile || ''} ${profile.id || ''}`.toLowerCase().includes(query);
      return matchesRole && matchesExam && matchesSearch;
    });
  }, [users, search, roleFilter, examFilter]);

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
    <section className="panel-card user-directory">
      <div className="user-directory-toolbar">
        <label className="content-search"><Search size={15} /><input placeholder="Search name, email, mobile or ID…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="filter-select">Role<select className="text-input" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option><option value="student">Students</option><option value="admin">Admins</option></select></label>
        <label className="filter-select">Target exam<select className="text-input" value={examFilter} onChange={(event) => setExamFilter(event.target.value)}><option value="all">All exams</option>{(catalog?.exams || []).map((exam) => <option key={exam.id} value={exam.title}>{exam.title}</option>)}</select></label>
      </div>
      {loading ? <LoadingSkeleton variant="table" count={5} /> : !filteredUsers.length ? <div className="empty-content"><UserRound size={23} /><strong>No matching users.</strong><span>Adjust your search or filters to see more accounts.</span></div> : <div className="user-directory-list">{filteredUsers.map((profile) => {
        const name = profile.full_name || 'Student';
        const isAdmin = ['admin', 'super_admin'].includes(profile.role);
        return <button className="user-directory-row" key={profile.id} onClick={() => setSelected(profile)}><span className={`user-avatar ${isAdmin ? 'admin' : ''}`}>{name.slice(0, 1).toUpperCase()}</span><span className="user-directory-name"><strong>{name}</strong><small>{profile.email || 'Email unavailable'}{profile.mobile ? ` · 📱 +91 ${profile.mobile}` : ''}</small></span><span className={`user-role-badge ${isAdmin ? 'admin' : ''}`}>{isAdmin ? 'super_admin' : 'student'}</span><span className="user-target-tags">{(profile.target_exams || []).length ? profile.target_exams.map((exam) => <i key={exam}>{exam}</i>) : <small>No target exam</small>}</span><span className="user-wallet-pill"><Coins size={14} /> {(wallets[profile.id] || 0).toLocaleString()}</span><span className="user-join-date">{profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}</span></button>;
      })}</div>}
    </section>
    {selected && <UserDrawer key={selected.id} profile={selected} balance={wallets[selected.id]} catalog={catalog} onClose={() => setSelected(null)} onUpdated={refreshUsers} />}
  </div>;
}
