import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, BadgeCheck, BookOpen, CircleDollarSign, Coins, FileQuestion, RefreshCw, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import SettingsPreview from './SettingsPreview';

const metrics = [
  { key: 'users', label: 'Total users', icon: Users, tone: 'gold', trend: 'All registered accounts' },
  { key: 'paid', label: 'Paid users', icon: WalletCards, tone: 'green', trend: 'Active subscriptions' },
  { key: 'pending', label: 'Pending verifications', icon: BadgeCheck, tone: 'blue', trend: 'Awaiting review' },
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
      const results = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).is('email_confirmed_at', null),
        supabase.from('orders').select('amount').eq('status', 'paid'),
        supabase.from('content_items').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true })
      ]);
      if (!active()) return;
      const failed = results.find((result) => result.error);
      if (failed) setError(`Some dashboard metrics could not be loaded: ${failed.error.message}`);
      const revenue = results[3].data?.reduce((sum, order) => sum + Number(order.amount || 0), 0);
      setStats({
        users: results[0].count,
        paid: results[1].count,
        pending: results[2].count,
        revenue,
        content: results[4].count,
        questions: results[5].count
      });
      setRefreshing(false);
  };
  useEffect(() => {
    let active = true;
    fetchStats(() => active).catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load dashboard metrics.');
        if (active()) setRefreshing(false);
      }
    });
    return () => { active = false; };
  }, [supabase]);
  const refresh = () => { setStats(null); fetchStats().catch((loadError) => { setError(loadError.message || 'Unable to refresh metrics.'); setRefreshing(false); }); };
  return <div className="admin-dashboard">
    <div className="page-heading admin-page-heading"><div><div className="eyebrow">{new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()} <span className="heading-dot">·</span> PLATFORM OVERVIEW</div><h1>Good morning, Admin.</h1><p>Here’s what’s happening across your learning platform today.</p></div><button className="button button-outline" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh data</button></div>
    {error && <div className="feedback error-feedback">{error}</div>}
    {!stats && <LoadingSkeleton rows={3} />}
    {stats && <div className="metrics-grid">{metrics.map(({ key, label, icon: Icon, tone, trend }) => <article className="metric-card" key={key}><div className={`metric-icon ${tone}`}><Icon size={18} /></div><span className="metric-label">{label}</span><strong>{stats[key] === null || stats[key] === undefined ? '—' : key === 'revenue' ? `₹${Number(stats[key]).toLocaleString('en-IN')}` : Number(stats[key]).toLocaleString()}</strong><span className="metric-foot">{trend}</span></article>)}</div>}
    <div className="admin-dashboard-grid"><section className="panel-card system-card"><div className="section-heading"><div><div className="eyebrow">PLATFORM STATUS</div><h2>System health</h2></div><span className="health-pill"><span className="health-dot" /> Operational</span></div><div className="system-row"><div className="system-symbol"><ShieldCheck size={17} /></div><div><strong>Authentication</strong><span>Supabase Auth connection configured</span></div><span className="system-status">HEALTHY</span></div><div className="system-row"><div className="system-symbol"><Activity size={17} /></div><div><strong>Data services</strong><span>Database and profile service</span></div><span className={`system-status ${supabase ? '' : 'warning'}`}>{supabase ? 'CONNECTED' : 'SETUP NEEDED'}</span></div><div className="system-row"><div className="system-symbol"><Coins size={17} /></div><div><strong>Reward engine</strong><span>Configurable coin reward slabs</span></div><span className="system-status">READY</span></div></section>
      <section className="panel-card admin-quick-links"><div className="eyebrow">QUICK ACCESS</div><h2>Keep things moving.</h2><Link to="/admin/content"><BookOpen size={17} /> Manage learning content <ArrowUpRight size={15} /></Link><Link to="/admin/users"><Users size={17} /> Review users & access <ArrowUpRight size={15} /></Link><Link to="/admin/settings"><Coins size={17} /> Configure coin rewards <ArrowUpRight size={15} /></Link></section></div>
    <SettingsPreview compact />
  </div>;
}
