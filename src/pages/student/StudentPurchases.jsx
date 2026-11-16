import { useCallback, useEffect, useState, useMemo } from 'react';
import { ShoppingBag, CheckCircle2, Clock, ArrowRight, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { formatRupees } from '../../lib/commerce';

export default function StudentPurchases() {
  const { user, supabase } = useAuth();
  const { exams, folders, chapters, loading: catalogLoading } = useContentCatalog();
  const [grants, setGrants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('access'); // 'access' | 'orders'
  const [error, setError] = useState('');

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!supabase || !user) {
      setGrants([]);
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      const [grantsRes, ordersRes] = await Promise.all([
        supabase
          .from('user_access')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('payment_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      if (grantsRes.error) throw grantsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      setGrants(grantsRes.data || []);
      setOrders(ordersRes.data || []);
    } catch (err) {
      console.warn('Error loading student purchases:', err);
      setError('Unable to load your purchases. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  // Lookup map for content details
  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);
  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  const activeEntitlements = useMemo(() => {
    const now = new Date();
    return grants.map((grant) => {
      let title = 'Learning Resource';
      let path = '/explore';
      let typeLabel = grant.item_type?.toUpperCase() || 'COURSE';

      if (grant.item_type === 'exam') {
        const item = examMap.get(grant.item_id);
        title = item?.title || 'Exam Pass';
        path = item?.slug ? `/explore/${item.slug}` : '/explore';
        typeLabel = 'Full Exam';
      } else if (grant.item_type === 'folder') {
        const item = folderMap.get(grant.item_id);
        title = item?.title || 'Study Folder';
        path = `/folder/${grant.item_id}`;
        typeLabel = 'Subject Folder';
      } else if (grant.item_type === 'chapter') {
        const item = chapterMap.get(grant.item_id);
        title = item?.title || 'Study Chapter';
        path = `/chapter/${grant.item_id}`;
        typeLabel = 'Chapter Access';
      } else if (grant.item_type === 'toolbox_combo' || grant.item_type === 'tool') {
        title = 'Study Toolbox Access';
        path = '/toolbox';
        typeLabel = 'Tools Suite';
      }

      const expiresAt = grant.expires_at ? new Date(grant.expires_at) : null;
      const isExpired = Boolean(expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= now));
      const isAllowedStatus = !grant.status || ['active', 'granted', 'lifetime'].includes(String(grant.status).toLowerCase());
      const isActive = grant.is_active !== false && isAllowedStatus && !isExpired;

      return {
        ...grant,
        title,
        path,
        typeLabel,
        isActive,
        isExpired
      };
    });
  }, [grants, examMap, folderMap, chapterMap]);

  return (
    <div className="purchases-page min-h-screen dark:bg-[#0B1120] bg-[#f4faf7] dark:text-slate-100 text-slate-900 transition-colors">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Page Heading */}
        <div className="page-heading relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider">
              YOUR LEARNING ENTITLEMENTS
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
              <ShoppingBag className="text-indigo-500 w-6 h-6" />
              <span>My Purchases & Access</span>
            </h1>
            <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium mt-0.5">
              All your unlocked courses, exam passes, and transaction receipts in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPurchases}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-xs font-bold dark:text-slate-200 text-slate-700 shadow-xs hover:border-indigo-500 transition-colors shrink-0"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b dark:border-slate-800 border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all min-h-[44px] ${
              activeTab === 'access'
                ? 'bg-indigo-600 text-white shadow-glowIndigo'
                : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            Active Access ({activeEntitlements.filter((e) => e.isActive).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all min-h-[44px] ${
              activeTab === 'orders'
                ? 'bg-indigo-600 text-white shadow-glowIndigo'
                : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            Payment Orders ({orders.length})
          </button>
        </div>

        {loading || catalogLoading ? (
          <LoadingSkeleton rows={4} />
        ) : activeTab === 'access' ? (
          /* Active Access Tab */
          activeEntitlements.length === 0 ? (
            <div className="p-8 rounded-3xl dark:bg-[#1E293B]/80 bg-white border dark:border-slate-800 border-slate-200 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mx-auto flex items-center justify-center">
                <ShoppingBag size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black dark:text-white text-slate-900">No active purchases yet</h3>
                <p className="text-xs dark:text-slate-400 text-slate-600 max-w-sm mx-auto">
                  When you purchase full exams, folders, or chapters, your access passes and validities will show up here.
                </p>
              </div>
              <div>
                <Link
                  to="/explore"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-transform active:scale-95 shadow-glowIndigo"
                >
                  <span>Explore Available Exams</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {activeEntitlements.map((grant) => (
                <div
                  key={grant.id}
                  className="p-4 rounded-3xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-300 text-indigo-800 uppercase">
                        {grant.typeLabel}
                      </span>
                      {grant.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                          <CheckCircle2 size={13} />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                          <Clock size={13} />
                          <span>Expired</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold dark:text-white text-slate-900 line-clamp-2">
                      {grant.title}
                    </h3>

                    <div className="text-[11px] dark:text-slate-400 text-slate-500 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-indigo-400" />
                      <span>
                        {grant.expires_at
                          ? `Valid until ${new Date(grant.expires_at).toLocaleDateString()}`
                          : 'Lifetime Full Access'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] dark:text-slate-500 text-slate-400">
                      Purchased on {new Date(grant.created_at).toLocaleDateString()}
                    </span>
                    <Link
                      to={grant.path}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-transform active:scale-95"
                    >
                      <span>Continue</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Payment Orders Tab */
          orders.length === 0 ? (
            <div className="p-8 rounded-3xl dark:bg-[#1E293B]/80 bg-white border dark:border-slate-800 border-slate-200 text-center space-y-2 shadow-sm">
              <p className="text-xs dark:text-slate-400 text-slate-600 font-medium">No payment transactions recorded.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold dark:text-white text-slate-900 text-sm">
                        {order.item_title || order.item_id || 'Learning Material'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.status === 'paid'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : order.status === 'created'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="dark:text-slate-400 text-slate-500 text-[11px] space-x-2">
                      <span>Order: {order.razorpay_order_id || order.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-right sm:shrink-0">
                    <div className="font-black text-sm dark:text-emerald-400 text-emerald-600">
                      {formatRupees(order.final_amount ?? order.amount ?? 0)}
                    </div>
                    {order.coins_redeemed > 0 && (
                      <div className="text-[10px] text-amber-500 font-bold">
                        🪙 {order.coins_redeemed} coins redeemed
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
