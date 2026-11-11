import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, BadgeCheck, BookOpen, CircleDollarSign,
  Coins, FileQuestion, RefreshCw, ShieldCheck, Users, WalletCards
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import SettingsPreview from './SettingsPreview';

const metrics = [
  { key: 'users', label: 'Total users', icon: Users, tone: 'gold', trend: 'All registered accounts' },
  { key: 'paid', label: 'Paid users', icon: WalletCards, tone: 'green', trend: 'Active content grants' },
  { key: 'pending', label: 'Pending verifications', icon: BadgeCheck, tone: 'blue', trend: 'Awaiting email verification' },
  { key: 'revenue', label: 'Revenue', icon: CircleDollarSign, tone: 'violet', trend: 'Lifetime collected' },
  { key: 'content', label: 'Content items', icon: BookOpen, tone: 'green', trend: 'Published resources' },
  { key: 'questions', label: 'Question bank', icon: FileQuestion, tone: 'gold', trend: 'Ready to practice' }
];

export default function AdminDashboard() {
  const { supabase } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (active = () => true) => {
    if (!supabase) { setStats({}); return; }
    setRefreshing(true);
    setError('');

    try {
      const [
        usersResult,
        grantsResult,
        unconfirmedResult,
        ordersResult,
        contentResult,
        questionsResult
      ] = await Promise.allSettled([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_access').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).is('email_confirmed_at', null),
        supabase.from('payment_orders').select('amount, status'),
        supabase.from('content_items').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true })
      ]);

      if (!active()) return;

      const usersCount = usersResult.status === 'fulfilled' && !usersResult.value.error ? (usersResult.value.count ?? 0) : 0;
      let paidCount = grantsResult.status === 'fulfilled' && !grantsResult.value.error ? (grantsResult.value.count ?? 0) : 0;

      // Fallback for subscriptions if user_access count is 0
      if (!paidCount) {
        const { count: subsCount } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true });
        if (subsCount) paidCount = subsCount;
      }

      const pendingCount = unconfirmedResult.status === 'fulfilled' && !unconfirmedResult.value.error ? (unconfirmedResult.value.count ?? 0) : 0;

      let revenue = 0;
      if (ordersResult.status === 'fulfilled' && ordersResult.value.data) {
        revenue = ordersResult.value.data
          .filter((ord) => ['paid', 'success', 'captured'].includes(String(ord.status || '').toLowerCase()))
          .reduce((sum, order) => sum + Number(order.amount || 0), 0);
      } else {
        // Fallback for legacy orders table
        const { data: legacyOrders } = await supabase.from('orders').select('amount').eq('status', 'paid');
        if (legacyOrders) {
          revenue = legacyOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
        }
      }

      const contentCount = contentResult.status === 'fulfilled' && !contentResult.value.error ? (contentResult.value.count ?? 0) : 0;
      const questionsCount = questionsResult.status === 'fulfilled' && !questionsResult.value.error ? (questionsResult.value.count ?? 0) : 0;

      setStats({
        users: usersCount,
        paid: paidCount,
        pending: pendingCount,
        revenue,
        content: contentCount,
        questions: questionsCount
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
    setStats(null);
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

      {!stats && <LoadingSkeleton rows={3} />}

      {stats && (
        <div className="metrics-grid">
          {metrics.map(({ key, label, icon: Icon, tone, trend }) => {
            const rawVal = stats[key];
            const displayVal =
              rawVal === null || rawVal === undefined || isNaN(rawVal)
                ? '0'
                : key === 'revenue'
                ? `₹${Number(rawVal).toLocaleString('en-IN')}`
                : Number(rawVal).toLocaleString();

            return (
              <article className="metric-card" key={key}>
                <div className={`metric-icon ${tone}`}><Icon size={18} /></div>
                <span className="metric-label">{label}</span>
                <strong>{displayVal}</strong>
                <span className="metric-foot">{trend}</span>
              </article>
            );
          })}
        </div>
      )}

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
          <Link to="/admin/settings"><Coins size={17} /> Configure coin rewards <ArrowUpRight size={15} /></Link>
        </section>
      </div>

      <SettingsPreview compact />
    </div>
  );
}
