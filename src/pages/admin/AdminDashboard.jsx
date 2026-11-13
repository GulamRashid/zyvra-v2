import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, BadgeCheck, BookOpen, CircleDollarSign,
  Coins, FileQuestion, RefreshCw, ShieldCheck, Users, WalletCards
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SettingsPreview from './SettingsPreview';

const metrics = [
  { key: 'users', label: 'Total users', icon: Users, tone: 'gold', trend: 'All registered accounts' },
  { key: 'paid', label: 'Paid users', icon: WalletCards, tone: 'green', trend: 'Active content grants' },
  { key: 'pending', label: 'Pending verifications', icon: BadgeCheck, tone: 'blue', trend: 'Awaiting email verification' },
  { key: 'revenue', label: 'Revenue', icon: CircleDollarSign, tone: 'violet', trend: 'Lifetime collected' },
  { key: 'content', label: 'Content items', icon: BookOpen, tone: 'green', trend: 'Published resources' },
  { key: 'questions', label: 'Question bank', icon: FileQuestion, tone: 'gold', trend: 'Ready to practice' }
];

const metricStateDefaults = Object.fromEntries(
  metrics.map(({ key }) => [key, { loading: true, value: null, error: '' }])
);

export default function AdminDashboard() {
  const { supabase } = useAuth();
  const [metricState, setMetricState] = useState(metricStateDefaults);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (active = () => true) => {
    if (!supabase) {
      setMetricState(Object.fromEntries(
        metrics.map(({ key }) => [key, { loading: false, value: null, error: 'Data unavailable' }])
      ));
      return;
    }
    setRefreshing(true);
    setError('');
    setMetricState(Object.fromEntries(
      metrics.map(({ key }) => [key, { loading: true, value: null, error: '' }])
    ));

    try {
      const [
        usersResult,
        grantsResult,
        unconfirmedResult,
        ordersResult,
        chaptersResult,
        questionsResult
      ] = await Promise.allSettled([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_access').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).or('email_confirmed_at.is.null,email_verified.is.false'),
        supabase.from('payment_orders').select('amount, status'),
        supabase.from('chapters').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true })
      ]);

      if (!active()) return;

      const getResultError = (result) => {
        if (result.status === 'rejected') return result.reason?.message || 'Data unavailable';
        return result.value?.error?.message || '';
      };
      const usersError = getResultError(usersResult);
      const grantsError = getResultError(grantsResult);
      const pendingError = getResultError(unconfirmedResult);
      const ordersError = getResultError(ordersResult);
      const contentError = getResultError(chaptersResult);
      const questionsError = getResultError(questionsResult);

      const usersCount = usersError ? null : (usersResult.value.count ?? 0);
      let paidCount = grantsError ? null : (grantsResult.value.count ?? 0);
      let paidError = grantsError;

      // Fallback for paid users if user_access count is 0: check paid orders
      if (!paidError && !paidCount) {
        try {
          const { count: paidOrdersCount, error: paidOrdersError } = await supabase.from('payment_orders').select('*', { count: 'exact', head: true }).eq('status', 'paid');
          if (paidOrdersError) paidError = paidOrdersError.message || 'Data unavailable';
          if (paidOrdersCount) paidCount = paidOrdersCount;
        } catch (fallbackError) {
          paidCount = null;
          paidError = fallbackError.message || 'Data unavailable';
        }
      }

      const pendingCount = pendingError ? null : (unconfirmedResult.value.count ?? 0);

      let revenue = null;
      if (!ordersError && ordersResult.value.data) {
        revenue = ordersResult.value.data
          .filter((ord) => ['paid', 'success', 'captured'].includes(String(ord.status || '').toLowerCase()))
          .reduce((sum, order) => sum + Number(order.amount || 0), 0);
      }

      const contentCount = contentError ? null : (chaptersResult.value.count ?? 0);
      const questionsCount = questionsError ? null : (questionsResult.value.count ?? 0);

      setMetricState({
        users: { loading: false, value: usersCount, error: usersError },
        paid: { loading: false, value: paidCount, error: paidError },
        pending: { loading: false, value: pendingCount, error: pendingError },
        revenue: { loading: false, value: revenue, error: ordersError },
        content: { loading: false, value: contentCount, error: contentError },
        questions: { loading: false, value: questionsCount, error: questionsError }
      });
    } catch (loadError) {
      if (active()) {
        setError(loadError.message || 'Unable to load dashboard metrics.');
      }
    } finally {
      if (active()) setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchStats(() => active);
    return () => { active = false; };
  }, [supabase]);

  const refresh = () => {
    fetchStats();
  };

  return (
    <div className="admin-dashboard">
      <div className="page-heading admin-page-heading">
        <div>
          <div className="eyebrow">
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()}{' '}
            <span className="heading-dot">·</span> PLATFORM OVERVIEW
          </div>
          <h1>Good morning, Admin.</h1>
          <p>Here’s what’s happening across your learning platform today.</p>
        </div>
        <button className="button button-outline" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh data
        </button>
      </div>

      {error && (
        <div className="admin-error-box">
          <AlertTriangle size={18} style={{ flexShrink: 0, color: '#f87171' }} />
          <div>
            <strong>Dashboard Notice</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="metrics-grid">
        {metrics.map(({ key, label, icon: Icon, tone, trend }) => {
          const state = metricState[key];
          const displayVal = state.loading
            ? '…'
            : state.error
              ? '—'
              : key === 'revenue'
                ? `₹${Number(state.value).toLocaleString('en-IN')}`
                : Number(state.value).toLocaleString();

          return (
            <article className="metric-card" key={key}>
              <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
              <span className="metric-label">{label}</span>
              <strong title={state.error || undefined}>{displayVal}</strong>
              <span className="metric-foot">{state.error ? 'Data unavailable' : trend}</span>
            </article>
          );
        })}
      </div>

      <div className="admin-dashboard-grid">
        <section className="panel-card system-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">PLATFORM STATUS</div>
              <h2>System health</h2>
            </div>
            <span className="health-pill"><span className="health-dot" /> Operational</span>
          </div>
          <div className="system-row">
            <div className="system-symbol"><ShieldCheck size={17} /></div>
            <div>
              <strong>Authentication</strong>
              <span>Supabase Auth connection configured</span>
            </div>
            <span className="system-status">HEALTHY</span>
          </div>
          <div className="system-row">
            <div className="system-symbol"><Activity size={17} /></div>
            <div>
              <strong>Data services</strong>
              <span>Database and profile service</span>
            </div>
            <span className={`system-status ${supabase ? '' : 'warning'}`}>{supabase ? 'CONNECTED' : 'SETUP NEEDED'}</span>
          </div>
          <div className="system-row">
            <div className="system-symbol"><Coins size={17} /></div>
            <div>
              <strong>Reward engine</strong>
              <span>Configurable coin reward slabs</span>
            </div>
            <span className="system-status">READY</span>
          </div>
        </section>

        <section className="panel-card admin-quick-links">
          <div className="eyebrow">QUICK ACCESS</div>
          <h2>Keep things moving.</h2>
          <Link to="/admin/content"><BookOpen size={17} /> Manage learning content <ArrowUpRight size={15} /></Link>
          <Link to="/admin/users"><Users size={17} /> Review users & access <ArrowUpRight size={15} /></Link>
          <Link to="/admin/coins"><Coins size={17} /> Configure coin rewards <ArrowUpRight size={15} /></Link>
        </section>
      </div>

      <SettingsPreview compact />
    </div>
  );
}
