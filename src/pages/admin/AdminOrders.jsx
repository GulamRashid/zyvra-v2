import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clock, CreditCard, IndianRupee, RefreshCw, Search, XCircle
} from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import StatusBadge from '../../components/common/StatusBadge';
import useContentCatalog from '../../hooks/useContentCatalog';
import { useAuth } from '../../context/AuthContext';

export default function AdminOrders() {
  const { supabase } = useAuth();
  const { exams, folders, chapters } = useContentCatalog();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  const productTitleMap = useMemo(() => {
    const map = new Map();
    (exams || []).forEach((e) => map.set(`exam:${e.id}`, e.title));
    (folders || []).forEach((f) => map.set(`folder:${f.id}`, f.title));
    (chapters || []).forEach((c) => map.set(`chapter:${c.id}`, c.title));
    return map;
  }, [exams, folders, chapters]);

  const resolveOrderProductName = useCallback((ord) => {
    if (ord.item_title) return ord.item_title;
    const type = String(ord.item_type || '').toLowerCase();
    const id = String(ord.item_id || '');
    if (type === 'full_pass' || id === 'global' || id === 'full_pass') return 'Zyvra Full Pass (All Exams)';
    if (type === 'toolbox' || type === 'tool_combo') return 'Study Toolbox Pro Pass';
    if (type === 'tool') return `Toolbox Tool (${id})`;
    const mapped = productTitleMap.get(`${type}:${id}`);
    if (mapped) return mapped;
    if (ord.description) return ord.description;
    return type ? `${type.toUpperCase()} · ${id.slice(0, 8)}…` : 'Test Series Access';
  }, [productTitleMap]);

  const loadOrders = useCallback(async (active = () => true) => {
    if (!supabase) {
      setLoadError('Orders could not be loaded. Please try again.');
      setLoading(false);
      return;
    }
    setRefreshing(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Enrich with user email/name if available
      const userIds = [...new Set((data || []).map((o) => o.user_id))].filter(Boolean);
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
        const enriched = (data || []).map((o) => ({
          ...o,
          user: userMap[o.user_id] || { name: 'User ' + (o.user_id?.slice(0, 6) || ''), email: '—' }
        }));
        setOrders(enriched);
      }
    } catch (err) {
      console.warn('Error loading payment orders:', err.message);
      if (active()) {
        setOrders([]);
        setLoadError('Orders could not be loaded. Please try again.');
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
    loadOrders(() => active);
    return () => { active = false; };
  }, [loadOrders]);

  const summary = useMemo(() => {
    const paid = orders.filter((o) => ['paid', 'success', 'captured'].includes(String(o.status || '').toLowerCase()));
    const totalRevenue = paid.reduce((acc, o) => acc + (Number(o.amount || 0)), 0);
    const pending = orders.filter((o) => ['created', 'pending'].includes(String(o.status || '').toLowerCase()));
    const expired = orders.filter((o) => String(o.status || '').toLowerCase() === 'expired');
    return {
      totalRevenue,
      paidCount: paid.length,
      pendingCount: pending.length,
      expiredCount: expired.length,
      totalCount: orders.length
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const st = String(o.status || '').toLowerCase();
      const matchStatus = statusFilter === 'all'
        || (statusFilter === 'pending' ? ['created', 'pending'].includes(st) : st === statusFilter);
      if (!matchStatus) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const userName = (o.user?.full_name || o.user?.name || '').toLowerCase();
      const userEmail = (o.user?.email || '').toLowerCase();
      const orderId = String(o.gateway_order_id || o.razorpay_order_id || o.order_id || o.id || '').toLowerCase();
      const paymentId = String(o.gateway_payment_id || o.razorpay_payment_id || '').toLowerCase();
      const productName = resolveOrderProductName(o).toLowerCase();
      return userName.includes(term) || userEmail.includes(term) || orderId.includes(term) || paymentId.includes(term) || productName.includes(term);
    });
  }, [orders, search, statusFilter, resolveOrderProductName]);

  const handleOrderAction = async (order, actionType) => {
    if (!order || !supabase || actionBusy) return;
    if (actionType === 'refund') {
      const ok = window.confirm(`Mark order ${order.id.slice(0, 8)} (₹${order.amount}) as REFUNDED and revoke access?`);
      if (!ok) return;
    } else if (actionType === 'verify') {
      const ok = window.confirm(`Verify and mark order ${order.id.slice(0, 8)} (₹${order.amount}) as PAID?`);
      if (!ok) return;
    }
    setActionBusy(true);
    setActionFeedback('');
    try {
      const nextStatus = actionType === 'refund' ? 'refunded' : 'paid';
      const { error: updErr } = await supabase
        .from('payment_orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', order.id);
      if (updErr) throw updErr;
      setActionFeedback(`Order marked as ${nextStatus.toUpperCase()}.`);
      await loadOrders();
      setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
    } catch (err) {
      setActionFeedback(err.message || 'Unable to update order status.');
    } finally {
      setActionBusy(false);
    }
  };

  const getStatusBadge = (status) => {
    const st = String(status || '').toLowerCase();
    if (['paid', 'success', 'captured'].includes(st)) {
      return <StatusBadge status="paid" label="PAID" />;
    }
    if (['created', 'pending'].includes(st)) {
      return <StatusBadge status="pending" label="PENDING" />;
    }
    return <StatusBadge status={st || 'failed'} label={st.toUpperCase() || 'FAILED'} />;
  };

  return (
    <div className="admin-orders-page">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">FINANCIAL AUDIT & TRANSACTIONS</div>
          <h1>Orders & Payments</h1>
          <p>Real-time log of gateway checkout sessions, successful charges, and pending learner orders.</p>
        </div>
        <button className="button button-outline" onClick={() => loadOrders()} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton variant="dashboard" />
      ) : loadError ? (
        <div className="empty-content" role="alert" style={{ padding: '40px 16px', textAlign: 'center' }}>
          <XCircle size={28} style={{ opacity: 0.6, margin: '0 auto 10px', color: '#f87171' }} />
          <strong>Orders load nahi hue</strong>
          <span>{loadError}</span>
          <button
            type="button"
            className="button button-primary"
            onClick={() => loadOrders()}
            disabled={refreshing}
            style={{ minHeight: '44px', marginTop: '16px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Try again
          </button>
        </div>
      ) : (
        <>
          <div className="metrics-grid">
            <article className="metric-card">
              <div className="metric-icon green"><IndianRupee size={18} /></div>
              <span className="metric-label">Total Revenue</span>
              <strong>₹{summary.totalRevenue.toLocaleString('en-IN')}</strong>
              <span className="metric-foot">From {summary.paidCount} successful payments</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon green"><CheckCircle2 size={18} /></div>
              <span className="metric-label">Paid Transactions</span>
              <strong>{summary.paidCount}</strong>
              <span className="metric-foot">Successful orders</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon blue"><Clock size={18} /></div>
              <span className="metric-label">Pending In Checkout</span>
              <strong>{summary.pendingCount}</strong>
              <span className="metric-foot">Awaiting payment verification</span>
            </article>

            <article className="metric-card">
              <div className="metric-icon violet"><CreditCard size={18} /></div>
              <span className="metric-label">Total Gateway Sessions</span>
              <strong>{summary.totalCount}</strong>
              <span className="metric-foot">Razorpay / Cashfree orders</span>
            </article>
          </div>

          <section className="panel-card p-5 sm:p-6 mt-6 min-w-0 overflow-hidden">
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', width: '100%', maxWidth: '640px' }}>
                <div className="input-with-icon" style={{ minWidth: '0', flex: '1 1 200px' }}>
                  <Search size={15} />
                  <input
                    type="search"
                    placeholder="Search user, email, payment ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="text-input"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {['all', 'paid', 'pending', 'expired', 'failed'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`button button-small ${statusFilter === st ? 'button-primary' : 'button-outline'}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st.toUpperCase()}
                      {st === 'expired' && summary.expiredCount > 0 ? ` (${summary.expiredCount})` : ''}
                    </button>
                  ))}
                </div>
              </div>

              <span className="chapter-item-count">{filteredOrders.length} records shown</span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="empty-content" style={{ padding: '40px 16px', textAlign: 'center' }}>
                <CreditCard size={28} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                <strong>{orders.length === 0 ? 'No orders yet' : 'No matching orders'}</strong>
                <span>{orders.length === 0 ? 'Completed and pending orders will appear here.' : 'Try clearing search filters.'}</span>
              </div>
            ) : (
              <div className="data-table-wrap" style={{ overflowX: 'auto', marginTop: '16px' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))', textAlign: 'left', color: 'var(--text-muted, #94a3b8)' }}>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Learner</th>
                      <th style={{ padding: '10px 12px' }}>Amount</th>
                      <th style={{ padding: '10px 12px' }}>Gateway Payment / Order ID</th>
                      <th style={{ padding: '10px 12px' }}>Item / Package</th>
                      <th style={{ padding: '10px 12px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        onClick={() => {
                          setSelectedOrder(ord);
                          setActionFeedback('');
                        }}
                        style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '12px' }}>{getStatusBadge(ord.status)}</td>
                        <td style={{ padding: '12px' }}>
                          <strong style={{ display: 'block' }}>{ord.user?.full_name || ord.user?.name || 'Student'}</strong>
                          <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.775rem' }}>{ord.user?.email || '—'}</small>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          ₹{Number(ord.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '0.775rem', color: 'var(--text-muted, #94a3b8)' }}>
                          <div>{ord.gateway_payment_id || ord.razorpay_payment_id || ord.payment_id || '—'}</div>
                          <div style={{ opacity: 0.7 }}>{ord.gateway_order_id || ord.razorpay_order_id || ord.order_id || ord.id}</div>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.825rem' }}>
                          {resolveOrderProductName(ord)}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                          {ord.created_at ? new Date(ord.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-700 border-slate-200 p-5 sm:p-6 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">ORDER DETAILS</div>
                <h2 className="text-base font-black dark:text-white text-slate-900">
                  {resolveOrderProductName(selectedOrder)}
                </h2>
              </div>
              {getStatusBadge(selectedOrder.status)}
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200">
                <span className="text-slate-400 block">Learner</span>
                <strong className="dark:text-white text-slate-900">{selectedOrder.user?.full_name || 'Student'}</strong>
                <span className="block text-[11px] text-slate-400 truncate">{selectedOrder.user?.email || '—'}</span>
              </div>
              <div className="p-2.5 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200">
                <span className="text-slate-400 block">Amount</span>
                <strong className="text-sm dark:text-emerald-400 text-emerald-600">
                  ₹{Number(selectedOrder.amount || 0).toLocaleString('en-IN')}
                </strong>
                {selectedOrder.coins_redeemed > 0 && (
                  <span className="block text-[11px] text-amber-500">{selectedOrder.coins_redeemed} coins redeemed</span>
                )}
              </div>
              <div className="p-2.5 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200 col-span-2 font-mono text-[11px]">
                <div>Order ID: {selectedOrder.gateway_order_id || selectedOrder.razorpay_order_id || selectedOrder.id}</div>
                <div>Payment ID: {selectedOrder.gateway_payment_id || selectedOrder.razorpay_payment_id || '—'}</div>
              </div>
            </div>

            {actionFeedback && (
              <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs font-bold text-indigo-300">
                {actionFeedback}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {['created', 'pending', 'expired'].includes(String(selectedOrder.status || '').toLowerCase()) && (
                <button
                  type="button"
                  className="button button-primary button-small"
                  disabled={actionBusy}
                  onClick={() => handleOrderAction(selectedOrder, 'verify')}
                >
                  Verify & Mark Paid
                </button>
              )}
              {['paid', 'success', 'captured'].includes(String(selectedOrder.status || '').toLowerCase()) && (
                <button
                  type="button"
                  className="button button-danger-outline button-small"
                  disabled={actionBusy}
                  onClick={() => handleOrderAction(selectedOrder, 'refund')}
                >
                  Mark Refunded
                </button>
              )}
              <button
                type="button"
                className="button button-outline button-small"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
