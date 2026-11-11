import { useEffect, useMemo, useState } from 'react';
import {
  CreditCard, Search, RefreshCw, CheckCircle2, Clock, XCircle, ArrowUpRight,
  Filter, FileText, Download, TrendingUp, IndianRupee
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

export default function AdminOrders() {
  const { supabase } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = async (active = () => true) => {
    if (!supabase) return;
    setRefreshing(true);
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
          .select('id, full_name, name, email')
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
    } finally {
      if (active()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    loadOrders(() => active);
    return () => { active = false; };
  }, [supabase]);

  const summary = useMemo(() => {
    const paid = orders.filter((o) => ['paid', 'success', 'captured'].includes(String(o.status || '').toLowerCase()));
    const totalRevenue = paid.reduce((acc, o) => acc + (Number(o.amount || 0)), 0);
    const pending = orders.filter((o) => ['created', 'pending'].includes(String(o.status || '').toLowerCase()));
    return {
      totalRevenue,
      paidCount: paid.length,
      pendingCount: pending.length,
      totalCount: orders.length
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = statusFilter === 'all' || String(o.status || '').toLowerCase() === statusFilter;
      if (!matchStatus) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const userName = (o.user?.full_name || o.user?.name || '').toLowerCase();
      const userEmail = (o.user?.email || '').toLowerCase();
      const orderId = String(o.gateway_order_id || o.order_id || o.id || '').toLowerCase();
      const paymentId = String(o.gateway_payment_id || '').toLowerCase();
      return userName.includes(term) || userEmail.includes(term) || orderId.includes(term) || paymentId.includes(term);
    });
  }, [orders, search, statusFilter]);

  const getStatusBadge = (status) => {
    const st = String(status || '').toLowerCase();
    if (['paid', 'success', 'captured'].includes(st)) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
          <CheckCircle2 size={12} /> PAID
        </span>
      );
    }
    if (['created', 'pending'].includes(st)) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
          <Clock size={12} /> PENDING
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
        <XCircle size={12} /> {st.toUpperCase() || 'FAILED'}
      </span>
    );
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
        <LoadingSkeleton rows={4} />
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
              <div className="metric-icon gold"><CheckCircle2 size={18} /></div>
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

          <section className="panel-card" style={{ marginTop: '24px' }}>
            <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="input-with-icon" style={{ minWidth: '260px' }}>
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

                <div style={{ display: 'flex', gap: '6px' }}>
                  {['all', 'paid', 'pending', 'failed'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`button button-small ${statusFilter === st ? 'button-gold' : 'button-outline'}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <span className="chapter-item-count">{filteredOrders.length} records shown</span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="empty-content" style={{ padding: '40px 16px', textAlign: 'center' }}>
                <CreditCard size={28} style={{ opacity: 0.4, margin: '0 auto 10px' }} />
                <strong>No orders found</strong>
                <span>Try clearing search filters or refreshing data.</span>
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
                      <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.04))' }}>
                        <td style={{ padding: '12px' }}>{getStatusBadge(ord.status)}</td>
                        <td style={{ padding: '12px' }}>
                          <strong style={{ display: 'block' }}>{ord.user?.full_name || ord.user?.name || 'Student'}</strong>
                          <small style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.775rem' }}>{ord.user?.email || '—'}</small>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600 }}>
                          ₹{Number(ord.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '0.775rem', color: 'var(--text-muted, #94a3b8)' }}>
                          <div>{ord.gateway_payment_id || ord.payment_id || '—'}</div>
                          <div style={{ opacity: 0.7 }}>{ord.gateway_order_id || ord.order_id || ord.id}</div>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.825rem' }}>
                          {ord.item_type ? `${ord.item_type}: ${ord.item_id?.slice(0, 8)}…` : ord.description || 'Test Series Access'}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                          {ord.created_at ? new Date(ord.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
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
    </div>
  );
}
