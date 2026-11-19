import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  GraduationCap, ShoppingBag, CheckCircle2, Clock, ArrowRight,
  ShieldCheck, RefreshCw, AlertCircle, Crown, Wrench, Folder,
  BookOpen, Compass, ExternalLink, Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { formatRupees } from '../../lib/commerce';

export default function StudentPurchases() {
  const { user, supabase, accountAccess } = useAuth();
  const { language } = useThemeLanguage();
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
      setError('Unable to load your courses & purchases. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  // Lookup maps for content details
  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);
  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const chapterMap = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  // Group chapters by folder
  const chaptersByFolderId = useMemo(() => {
    const map = new Map();
    chapters.forEach((ch) => {
      const fid = ch.folder_id;
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid).push(ch);
    });
    return map;
  }, [chapters]);

  // Check if student has full pass
  const fullPassGrant = useMemo(() => {
    const now = new Date();
    return grants.find((g) => {
      if (g.item_type !== 'full_pass') return false;
      if (g.is_active === false) return false;
      if (g.status && !['active', 'granted', 'lifetime'].includes(String(g.status).toLowerCase())) return false;
      if (g.expires_at) {
        const expiresAt = new Date(g.expires_at);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return false;
      }
      return true;
    });
  }, [grants]);

  const hasFullPass = Boolean(fullPassGrant || (accountAccess?.ready && accountAccess?.isPremium));

  // Map user access grants to displayable active items
  const activeEntitlements = useMemo(() => {
    const now = new Date();
    return grants.map((grant) => {
      let title = 'Learning Resource';
      let parentTitle = '';
      let path = '/explore';
      let typeLabel = grant.item_type?.toUpperCase() || 'COURSE';
      let chaptersCount = 0;

      if (grant.item_type === 'full_pass') {
        title = 'Zyvra All-Access Full Pass';
        parentTitle = 'All Exams & Tools Unlocked';
        path = '/explore';
        typeLabel = 'Full Pass';
      } else if (grant.item_type === 'exam') {
        const item = examMap.get(grant.item_id);
        title = item?.title || 'Exam Pass';
        path = item?.slug ? `/explore/${item.slug}` : '/explore';
        typeLabel = 'Full Exam';
      } else if (grant.item_type === 'folder') {
        const item = folderMap.get(grant.item_id);
        title = item?.title || 'Subject Folder';
        const parentExam = item?.exam_id ? examMap.get(item.exam_id) : null;
        parentTitle = parentExam?.title || '';
        path = `/folder/${grant.item_id}`;
        typeLabel = 'Subject Folder';
        chaptersCount = chaptersByFolderId.get(grant.item_id)?.length || 0;
      } else if (grant.item_type === 'chapter') {
        const item = chapterMap.get(grant.item_id);
        title = item?.title || 'Study Chapter';
        const parentFolder = item?.folder_id ? folderMap.get(item.folder_id) : null;
        parentTitle = parentFolder?.title || '';
        path = `/chapter/${grant.item_id}`;
        typeLabel = 'Chapter Access';
      } else if (grant.item_type === 'toolbox_combo' || grant.item_type === 'tool') {
        title = 'Study Toolbox Access';
        parentTitle = '6 Smart Revision & Calculation Tools';
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
        parentTitle,
        path,
        typeLabel,
        chaptersCount,
        isActive,
        isExpired
      };
    });
  }, [grants, examMap, folderMap, chapterMap, chaptersByFolderId]);

  const activeCoursesCount = useMemo(() => {
    if (hasFullPass) return folders.length > 0 ? folders.length : 1;
    return activeEntitlements.filter((e) => e.isActive).length;
  }, [hasFullPass, folders.length, activeEntitlements]);

  return (
    <div className="purchases-page min-h-screen dark:bg-[#0B1120] bg-[#f8fafc] dark:text-slate-100 text-slate-900 transition-colors pb-24">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Page Heading Card */}
        <div className="page-heading relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200/90 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
              <GraduationCap size={14} />
              <span>{language === 'hi' ? 'मेरे खरीदे गए कोर्स व पास' : 'MY ENROLLED COURSES & PURCHASES'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
              <span>{language === 'hi' ? 'मेरे कोर्स (My Courses)' : 'My Courses & Purchases'}</span>
            </h1>
            <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium mt-0.5">
              {language === 'hi'
                ? 'आपके खरीदे गए सभी फोल्डर्स, टेस्ट सीरीज और ऑल-एक्सेस पास एक ही जगह।'
                : 'All your unlocked subjects, test folders, and all-access passes in one place.'}
            </p>
          </div>

          <button
            type="button"
            onClick={loadPurchases}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-xs font-bold dark:text-slate-200 text-slate-700 shadow-xs hover:border-indigo-500 transition-colors shrink-0 active:scale-95"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{language === 'hi' ? 'रिफ्रेश करें' : 'Refresh'}</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b dark:border-slate-800 border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'access'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <GraduationCap size={15} />
            <span>{language === 'hi' ? 'सक्रिय कोर्स व फोल्डर' : 'My Courses & Access'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20 dark:bg-slate-800">
              {activeCoursesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShoppingBag size={15} />
            <span>{language === 'hi' ? 'पेमेंट रसीद (Orders)' : 'Payment Orders'}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white/20 dark:bg-slate-800">
              {orders.length}
            </span>
          </button>
        </div>

        {/* Content Area */}
        {loading || catalogLoading ? (
          <LoadingSkeleton rows={4} />
        ) : activeTab === 'access' ? (
          /* ACTIVE ACCESS / MY COURSES TAB */
          <div className="space-y-4">
            {/* 1. If User has Full Pass */}
            {hasFullPass && (
              <section className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1e1906] dark:via-slate-900 dark:to-[#0f172a] bg-gradient-to-br from-amber-50 via-amber-100/40 to-indigo-50/30 border dark:border-amber-500/40 border-amber-300 p-4 sm:p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-2xl shadow-md shrink-0">
                      👑
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">
                          VIP UNLIMITED
                        </span>
                        <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>Active</span>
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-black dark:text-white text-slate-900 tracking-tight mt-0.5">
                        Zyvra All-Access Full Pass
                      </h2>
                      <p className="text-xs dark:text-amber-200/90 text-amber-900 font-medium mt-0.5">
                        {language === 'hi'
                          ? 'सभी परीक्षाओं के सभी विषय, टेस्ट सीरीज और स्टडी टूल्स पूरी तरह अनलॉक हैं!'
                          : 'Full platform unlocked! All exam folders, full mock tests and tools are active.'}
                      </p>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-amber-500 block">Validity</span>
                    <span className="text-xs sm:text-sm font-black dark:text-white text-slate-900 block">
                      {fullPassGrant?.expires_at
                        ? new Date(fullPassGrant.expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
                        : accountAccess?.validTill || 'Lifetime Access'}
                    </span>
                  </div>
                </div>

                {/* Quick Shortcuts for Full Pass Holder */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t dark:border-slate-800 border-amber-200/60">
                  <Link
                    to="/explore"
                    className="p-3 rounded-2xl dark:bg-slate-800/80 bg-white/90 border dark:border-slate-700 border-amber-200/80 hover:border-amber-400 flex items-center justify-between gap-2 group transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Compass size={16} className="text-amber-500 shrink-0" />
                      <span className="text-xs font-bold dark:text-white text-slate-900 truncate">
                        {language === 'hi' ? 'सभी परीक्षाएं' : 'All Exams'}
                      </span>
                    </div>
                    <ArrowRight size={13} className="text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>

                  <Link
                    to="/toolbox"
                    className="p-3 rounded-2xl dark:bg-slate-800/80 bg-white/90 border dark:border-slate-700 border-amber-200/80 hover:border-amber-400 flex items-center justify-between gap-2 group transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench size={16} className="text-amber-500 shrink-0" />
                      <span className="text-xs font-bold dark:text-white text-slate-900 truncate">
                        {language === 'hi' ? 'स्टडी टूल्स' : 'Study Tools (6)'}
                      </span>
                    </div>
                    <ArrowRight size={13} className="text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                </div>
              </section>
            )}

            {/* 2. List of Unlocked Folders & Courses */}
            {hasFullPass ? (
              /* If Full Pass is active, show all available subject folders */
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
                    <Folder size={14} className="text-indigo-500" />
                    <span>{language === 'hi' ? 'अनलॉक किए गए विषय व फोल्डर्स' : 'Unlocked Course Folders'}</span>
                  </h3>
                  <span className="text-[11px] text-emerald-500 font-bold">
                    ✓ {folders.length} {language === 'hi' ? 'फोल्डर्स अनलॉक' : 'folders unlocked'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {folders.map((folder) => {
                    const parentExam = examMap.get(folder.exam_id);
                    const chapterCount = chaptersByFolderId.get(folder.id)?.length || 0;

                    return (
                      <div
                        key={folder.id}
                        className="p-4 rounded-3xl dark:bg-[#111827] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:border-indigo-500/50 transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold dark:bg-indigo-950/60 bg-indigo-50 text-indigo-600 dark:text-indigo-300 truncate max-w-[170px]">
                              {parentExam?.title || 'Course'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500">
                              <CheckCircle2 size={12} />
                              <span>Unlocked</span>
                            </span>
                          </div>

                          <h4 className="text-sm font-black dark:text-white text-slate-900 line-clamp-2">
                            {folder.title}
                          </h4>

                          <p className="text-[11px] dark:text-slate-400 text-slate-500 line-clamp-1">
                            {chapterCount > 0 ? `${chapterCount} Chapters & Tests included` : 'Study Material & Tests'}
                          </p>
                        </div>

                        <div className="pt-2 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                            <span>👑</span>
                            <span>Full Pass</span>
                          </span>

                          <Link
                            to={`/folder/${folder.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
                          >
                            <span>{language === 'hi' ? 'पढ़ाई शुरू करें' : 'Start Learning'}</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeEntitlements.filter((e) => e.isActive).length > 0 ? (
              /* If specific folders or exams are purchased */
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
                    <Folder size={14} className="text-indigo-500" />
                    <span>{language === 'hi' ? 'आपके खरीदे गए कोर्स व फोल्डर' : 'Your Enrolled Courses'}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {activeEntitlements.filter((e) => e.isActive).length} items
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeEntitlements
                    .filter((e) => e.isActive)
                    .map((grant) => (
                      <div
                        key={grant.id}
                        className="p-4 rounded-3xl dark:bg-[#111827] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:border-indigo-500/50 transition-all"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold dark:bg-indigo-950/60 bg-indigo-50 text-indigo-600 dark:text-indigo-300 truncate max-w-[170px]">
                              {grant.parentTitle || grant.typeLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500">
                              <CheckCircle2 size={12} />
                              <span>Active</span>
                            </span>
                          </div>

                          <h4 className="text-sm font-black dark:text-white text-slate-900 line-clamp-2">
                            {grant.title}
                          </h4>

                          <div className="text-[11px] dark:text-slate-400 text-slate-500 flex items-center gap-1">
                            <ShieldCheck size={12} className="text-indigo-400 shrink-0" />
                            <span>
                              {grant.expires_at
                                ? `Valid till ${new Date(grant.expires_at).toLocaleDateString()}`
                                : 'Lifetime Full Access'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] dark:text-slate-500 text-slate-400">
                            {grant.chaptersCount > 0 ? `${grant.chaptersCount} Chapters` : 'Enrolled'}
                          </span>

                          <Link
                            to={grant.path}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
                          >
                            <span>{language === 'hi' ? 'कोर्स खोलें' : 'Open Course'}</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              /* Zero State: No active purchases */
              <div className="p-8 sm:p-10 rounded-3xl dark:bg-[#111827] bg-white border dark:border-slate-800 border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mx-auto flex items-center justify-center text-3xl">
                  🎓
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900">
                    {language === 'hi' ? 'अभी तक कोई कोर्स नहीं खरीदा गया है' : 'No courses enrolled yet'}
                  </h3>
                  <p className="text-xs sm:text-sm dark:text-slate-400 text-slate-600 max-w-md mx-auto">
                    {language === 'hi'
                      ? 'अपनी तैयारी शुरू करने के लिए हमारे NCERT या सरकारी परीक्षा के चैप्टर व टेस्ट सीरीज चुनें। खरीदने के बाद आपके सभी फोल्डर्स सीधे यहां दिखाई देंगे।'
                      : 'When you purchase subject folders, mock test packages or the All-Access Pass, all your folders and tools will appear directly here for instant 1-tap study.'}
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/explore"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black shadow-md transition-all active:scale-95"
                  >
                    <span>{language === 'hi' ? 'उपलब्ध कोर्स व परीक्षाएं देखें' : 'Explore Available Courses'}</span>
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* PAYMENT ORDERS & RECEIPTS TAB */
          <div className="space-y-3">
            <div className="px-1 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500">
                {language === 'hi' ? 'लेनदेन और भुगतान रसीदें' : 'Transactions & Order Invoices'}
              </h3>
              <span className="text-[11px] text-slate-400 font-semibold">{orders.length} orders</span>
            </div>

            {orders.length === 0 ? (
              <div className="p-8 rounded-3xl dark:bg-[#111827] bg-white border dark:border-slate-800 border-slate-200 text-center space-y-2 shadow-sm">
                <p className="text-xs dark:text-slate-400 text-slate-600 font-medium">
                  {language === 'hi' ? 'कोई पेमेंट रिकॉर्ड उपलब्ध नहीं है।' : 'No payment transactions recorded.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl dark:bg-[#111827] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black dark:text-white text-slate-900 text-sm">
                          {order.item_title || order.item_id || 'Course Package'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            order.status === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              : order.status === 'created'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          }`}
                        >
                          {order.status === 'paid' ? 'Paid ✓' : order.status}
                        </span>
                      </div>
                      <div className="dark:text-slate-400 text-slate-500 text-[11px] space-x-2">
                        <span>Receipt ID: {order.razorpay_order_id || order.id.slice(0, 10)}</span>
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
