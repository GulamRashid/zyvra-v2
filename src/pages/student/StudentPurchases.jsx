import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  GraduationCap, ShoppingBag, CheckCircle2, Clock, ArrowRight, ArrowLeft,
  ShieldCheck, RefreshCw, AlertCircle, Coins, Crown, Home, Wrench, Folder, FolderOpen,
  BookOpen, Compass, Search, FileText, Sparkles, ChevronRight, Play, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import useModalBack from '../../hooks/useModalBack';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { formatRupees } from '../../lib/commerce';
import { getExamCategory, isPublished, sortContentItems } from '../../lib/content';

export default function StudentPurchases() {
  const { user, supabase, accountAccess } = useAuth();
  const { language } = useThemeLanguage();
  const { exams, folders, chapters, loading: catalogLoading } = useContentCatalog();

  const [grants, setGrants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'orders'
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [error, setError] = useState('');

  // Hierarchical Drill-down Navigation State
  const [selectedExam, setSelectedExam] = useState(null); // Exam object
  const [folderStack, setFolderStack] = useState([]); // Array of folder objects [rootFolder, subFolder, ...]
  const [searchQuery, setSearchQuery] = useState('');

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
      setError(language === 'hi'
        ? 'आपके कोर्स और खरीदारी लोड नहीं हो सके। कृपया दोबारा प्रयास करें।'
        : 'Unable to load your courses & purchases. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [supabase, user, language]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  // Lookup maps
  const examMap = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);
  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const chaptersByFolderId = useMemo(() => {
    const map = new Map();
    chapters.forEach((ch) => {
      if (!isPublished(ch)) return;
      const fid = ch.folder_id;
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid).push(ch);
    });
    return map;
  }, [chapters]);

  // Check Full Pass
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

  // Determine Enrolled Exams with natural sorting
  const enrolledExams = useMemo(() => {
    const publishedExams = exams.filter(isPublished);
    let list = [];
    if (hasFullPass) {
      list = publishedExams;
    } else {
      const grantedExamIds = new Set(
        grants
          .filter((g) => g.item_type === 'exam' && g.is_active !== false)
          .map((g) => g.item_id)
      );
      list = publishedExams.filter((e) => grantedExamIds.has(e.id));
    }
    return sortContentItems(list);
  }, [exams, hasFullPass, grants]);

  // Determine Standalone Enrolled Folders with natural sorting
  const enrolledStandaloneFolders = useMemo(() => {
    if (hasFullPass) return [];
    const grantedExamIds = new Set(
      grants
        .filter((g) => g.item_type === 'exam' && g.is_active !== false)
        .map((g) => g.item_id)
    );
    const grantedFolderIds = new Set(
      grants
        .filter((g) => g.item_type === 'folder' && g.is_active !== false)
        .map((g) => g.item_id)
    );

    const list = folders
      .filter(isPublished)
      .filter((f) => grantedFolderIds.has(f.id) && !grantedExamIds.has(f.exam_id));
    return sortContentItems(list);
  }, [folders, hasFullPass, grants]);

  // Has Toolbox access
  const hasToolboxAccess = useMemo(() => {
    if (hasFullPass) return true;
    return grants.some((g) =>
      ['toolbox_combo', 'tool'].includes(g.item_type) && g.is_active !== false
    );
  }, [hasFullPass, grants]);

  // Total Enrolled Courses count
  const enrolledCount = enrolledExams.length + enrolledStandaloneFolders.length + (hasToolboxAccess ? 1 : 0);

  // Drill-down navigation handlers
  const handleSelectExam = useCallback((exam) => {
    setSelectedExam(exam);
    setFolderStack([]);
    setSearchQuery('');
  }, []);

  const handleSelectFolder = useCallback((folder) => {
    setFolderStack((prev) => [...prev, folder]);
    setSearchQuery('');
  }, []);

  const handleBack = useCallback(() => {
    if (folderStack.length > 0) {
      setFolderStack((prev) => prev.slice(0, -1));
    } else if (selectedExam) {
      setSelectedExam(null);
      setFolderStack([]);
    }
  }, [folderStack.length, selectedExam]);

  useModalBack(Boolean(selectedExam || folderStack.length > 0), handleBack, 'purchases-folder');

  const handleResetToRoot = useCallback(() => {
    setSelectedExam(null);
    setFolderStack([]);
    setSearchQuery('');
  }, []);

  const handleJumpToFolderLevel = useCallback((levelIndex) => {
    if (levelIndex < 0) {
      setFolderStack([]);
    } else {
      setFolderStack((prev) => prev.slice(0, levelIndex + 1));
    }
    setSearchQuery('');
  }, []);

  // Current view context
  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;

  // Root folders for currently selected exam with natural sorting
  const currentExamRootFolders = useMemo(() => {
    if (!selectedExam) return [];
    const list = folders
      .filter(isPublished)
      .filter((f) => f.exam_id === selectedExam.id && !f.parent_folder_id && !f.parent_id);
    return sortContentItems(list);
  }, [folders, selectedExam]);

  // Child folders for currently selected folder with natural sorting
  const currentSubFolders = useMemo(() => {
    if (!currentFolder) return [];
    const list = folders
      .filter(isPublished)
      .filter((f) => f.parent_folder_id === currentFolder.id || f.parent_id === currentFolder.id);
    return sortContentItems(list);
  }, [folders, currentFolder]);

  // Chapters directly under currently selected folder with natural sorting
  const currentFolderChapters = useMemo(() => {
    if (!currentFolder) return [];
    const list = chaptersByFolderId.get(currentFolder.id) || [];
    return sortContentItems(list);
  }, [chaptersByFolderId, currentFolder]);

  // Search filter across enrolled courses
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matchedExams = enrolledExams.filter((e) =>
      e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)
    );

    // Filter folders belonging to enrolled exams or standalone
    const enrolledExamIdSet = new Set(enrolledExams.map((e) => e.id));
    const matchedFolders = folders
      .filter(isPublished)
      .filter((f) => enrolledExamIdSet.has(f.exam_id) || enrolledStandaloneFolders.some((sf) => sf.id === f.id))
      .filter((f) => f.title?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q));

    const matchedFolderIdSet = new Set(folders.filter(isPublished).map((f) => f.id));
    const matchedChapters = chapters
      .filter(isPublished)
      .filter((c) => matchedFolderIdSet.has(c.folder_id))
      .filter((c) => c.title?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));

    return {
      exams: matchedExams,
      folders: matchedFolders.slice(0, 20),
      chapters: matchedChapters.slice(0, 20)
    };
  }, [searchQuery, enrolledExams, folders, chapters, enrolledStandaloneFolders]);

  return (
    <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6 text-slate-900 dark:text-slate-100">

        {/* Top Header Card */}
        <div className="rounded-3xl dark:bg-slate-900/90 bg-white border dark:border-slate-800 border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 text-sm">
                <GraduationCap size={16} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {language === 'hi' ? 'मेरा अध्ययन कक्ष' : 'Student Learning Dashboard'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold dark:text-white text-slate-900 tracking-tight">
              {language === 'hi' ? 'मेरे कोर्सेज (My Courses)' : 'My Enrolled Courses'}
            </h1>
            <p className="text-xs dark:text-slate-400 text-slate-600 font-medium">
              {language === 'hi'
                ? 'आपके खरीदे गए सभी एग्जाम, मुख्य विषय, सब-फोल्डर्स और टेस्ट्स क्रमबद्ध रूप से।'
                : 'All your unlocked exams, subject folders, sub-folders, and mock tests in structured hierarchy.'}
            </p>
          </div>

          <button
            type="button"
            onClick={loadPurchases}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl dark:bg-slate-800/80 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border dark:border-slate-700/60 border-slate-200 text-xs font-bold dark:text-slate-200 text-slate-700 shadow-xs transition-colors shrink-0 active:scale-95"
            title="Refresh courses"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{language === 'hi' ? 'रिफ्रेश' : 'Refresh'}</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher: Courses vs Orders */}
        <div className="flex items-center gap-2 border-b dark:border-slate-800 border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[38px] ${
              activeTab === 'courses'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <BookOpen size={14} />
            <span>{language === 'hi' ? 'मेरे कोर्सेज व फोल्डर्स' : 'My Courses & Folders'}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'courses' ? 'bg-white/20 text-white' : 'dark:bg-slate-800 bg-slate-100 text-slate-500'}`}>
              {enrolledCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 min-h-[38px] ${
              activeTab === 'orders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShoppingBag size={14} />
            <span>{language === 'hi' ? 'पेमेंट रसीदें (Orders)' : 'Payment Orders'}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${activeTab === 'orders' ? 'bg-white/20 text-white' : 'dark:bg-slate-800 bg-slate-100 text-slate-500'}`}>
              {orders.length}
            </span>
          </button>
        </div>

        {/* MAIN COURSES VIEW */}
        {loading || catalogLoading ? (
          <LoadingSkeleton rows={4} />
        ) : activeTab === 'courses' ? (
          <div className="space-y-4">

            {/* 1. Full Pass VIP Highlight Banner */}
            {hasFullPass && !selectedExam && folderStack.length === 0 && (
              <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-indigo-500/10 border border-amber-400/30 dark:border-amber-400/20 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-xs shrink-0">
                    <Crown size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-800 dark:text-amber-300 border border-amber-400/30 uppercase tracking-wider">
                        VIP UNLIMITED PASS
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        <span>{language === 'hi' ? 'सक्रिय' : 'Active'}</span>
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold dark:text-white text-slate-900 tracking-tight mt-0.5">
                      Zyvra All-Access Full Pass
                    </h2>
                    <p className="text-xs dark:text-slate-300 text-slate-600 font-medium mt-0.5">
                      {language === 'hi'
                        ? 'सभी परीक्षाओं के सभी विषय, सब-फोल्डर्स, मॉक टेस्ट्स और स्टडी टूल्स पूरी तरह अनलॉक हैं!'
                        : 'Full platform unlocked! All exam folders, full mock tests and tools are active.'}
                    </p>
                  </div>
                </div>

                <div className="sm:text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">
                    {language === 'hi' ? 'वैधता (Validity)' : 'Validity'}
                  </span>
                  <span className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">
                    {fullPassGrant?.expires_at
                      ? new Date(fullPassGrant.expires_at).toLocaleDateString(undefined, { dateStyle: 'medium' })
                      : accountAccess?.validTill || 'Lifetime Access'}
                  </span>
                </div>
              </section>
            )}

            {/* 2. Interactive Breadcrumbs Bar (Visible when drilling into exam/folder) */}
            {(selectedExam || folderStack.length > 0) && (
              <nav className="p-3 rounded-2xl dark:bg-slate-900/90 bg-white border dark:border-slate-800 border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto text-xs font-bold">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shrink-0 transition-colors"
                >
                  <ArrowLeft size={13} />
                  <span>{language === 'hi' ? 'पीछे (Back)' : 'Back'}</span>
                </button>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0 mx-1" />

                {/* Root Crumb */}
                <button
                  type="button"
                  onClick={handleResetToRoot}
                  className="text-slate-500 hover:text-indigo-600 dark:hover:text-white whitespace-nowrap flex items-center gap-1.5"
                >
                  <Home size={13} className="shrink-0" />
                  <span>{language === 'hi' ? 'मेरे कोर्सेज' : 'My Courses'}</span>
                </button>

                {/* Exam Crumb */}
                {selectedExam && (
                  <>
                    <ChevronRight size={13} className="text-slate-400 shrink-0" />
                    <button
                      type="button"
                      onClick={() => handleJumpToFolderLevel(-1)}
                      className={`whitespace-nowrap hover:text-indigo-600 dark:hover:text-white truncate max-w-[150px] flex items-center gap-1 ${
                        folderStack.length === 0 ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-500'
                      }`}
                    >
                      <GraduationCap size={13} className="shrink-0" />
                      <span>{selectedExam.title}</span>
                    </button>
                  </>
                )}

                {/* Folder Stack Crumbs */}
                {folderStack.map((folder, index) => {
                  const isLast = index === folderStack.length - 1;
                  return (
                    <div key={folder.id} className="flex items-center gap-2 whitespace-nowrap">
                      <ChevronRight size={13} className="text-slate-400 shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleJumpToFolderLevel(index)}
                        className={`truncate max-w-[150px] hover:text-indigo-600 dark:hover:text-white flex items-center gap-1 ${
                          isLast ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-500'
                        }`}
                      >
                        <Folder size={13} className="shrink-0" />
                        <span>{folder.title}</span>
                      </button>
                    </div>
                  );
                })}
              </nav>
            )}

            {/* 3. Search Bar for Fast Lookups */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'hi'
                    ? 'अपने कोर्सेज, विषय, सब-फोल्डर या टेस्ट सर्च करें...'
                    : 'Search subjects, sub-folders, or tests in your enrolled courses...'
                }
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 text-xs sm:text-sm font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 4. Search Results Display (if searching) */}
            {searchResults ? (
              <div className="space-y-4">
                <div className="text-xs font-bold dark:text-slate-400 text-slate-500 px-1">
                  {language === 'hi' ? 'सर्च परिणाम' : 'Search Results for'} "{searchQuery}"
                </div>

                {/* Exam Matches */}
                {searchResults.exams.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase font-black tracking-wider text-indigo-500 block px-1">
                      {language === 'hi' ? 'परीक्षाएं' : 'Exams'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {searchResults.exams.map((exam) => (
                        <button
                          key={exam.id}
                          type="button"
                          onClick={() => handleSelectExam(exam)}
                          className="p-3.5 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 hover:border-indigo-500 flex items-center justify-between text-left transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                              <GraduationCap size={20} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 truncate">
                                {exam.title}
                              </h4>
                              <p className="text-[10px] text-slate-500 truncate">{exam.description || 'Full Exam Pack'}</p>
                            </div>
                          </div>
                          <ArrowRight size={14} className="text-indigo-500 group-hover:translate-x-1 transition-transform shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Folder Matches */}
                {searchResults.folders.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase font-black tracking-wider text-amber-500 block px-1">
                      {language === 'hi' ? 'विषय व फोल्डर्स' : 'Subjects & Folders'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {searchResults.folders.map((folder) => {
                        const parentExam = examMap.get(folder.exam_id);
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => {
                              if (parentExam) setSelectedExam(parentExam);
                              setFolderStack([folder]);
                              setSearchQuery('');
                            }}
                            className="p-3.5 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 hover:border-amber-500 flex items-center justify-between text-left transition-all group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                                <Folder size={20} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-bold uppercase text-indigo-500 block truncate">
                                  {parentExam?.title || 'Subject'}
                                </span>
                                <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 truncate">
                                  {folder.title}
                                </h4>
                              </div>
                            </div>
                            <ArrowRight size={14} className="text-amber-500 group-hover:translate-x-1 transition-transform shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Chapter Matches */}
                {searchResults.chapters.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] uppercase font-black tracking-wider text-emerald-500 block px-1">
                      {language === 'hi' ? 'चैप्टर व टेस्ट सीरीज' : 'Chapters & Tests'}
                    </span>
                    <div className="space-y-2">
                      {searchResults.chapters.map((chapter) => {
                        const parentFolder = folderMap.get(chapter.folder_id);
                        return (
                          <Link
                            key={chapter.id}
                            to={`/chapter/${chapter.id}`}
                            className="p-3.5 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 hover:border-emerald-500 flex items-center justify-between transition-all group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                <FileText size={16} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block truncate">
                                  {parentFolder?.title || 'Chapter'}
                                </span>
                                <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 truncate">
                                  {chapter.title}
                                </h4>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 group-hover:translate-x-1 transition-transform shrink-0">
                              <span>{language === 'hi' ? 'खोलें' : 'Open'}</span>
                              <ArrowRight size={13} />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {searchResults.exams.length === 0 && searchResults.folders.length === 0 && searchResults.chapters.length === 0 && (
                  <div className="p-8 text-center rounded-2xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 text-xs text-slate-500">
                    {language === 'hi' ? 'कोई परिणाम नहीं मिला। कृपया दूसरा शब्द खोजें।' : 'No matches found. Try another search term.'}
                  </div>
                )}
              </div>
            ) : !selectedExam && folderStack.length === 0 ? (
              /* ============================================================ */
              /* LEVEL 0: ROOT DASHBOARD - ENROLLED EXAMS & FOLDERS CARDS    */
              /* ============================================================ */
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
                    <GraduationCap size={15} className="text-indigo-500" />
                    <span>{language === 'hi' ? 'आपके नामांकित कोर्सेज' : 'Your Enrolled Courses'}</span>
                  </h3>
                  <span className="text-[11px] text-emerald-500 font-bold">
                    ✓ {enrolledCount} {language === 'hi' ? 'कोर्स उपलब्ध' : 'courses ready'}
                  </span>
                </div>

                {enrolledCount === 0 ? (
                  /* Zero State */
                  <div className="p-8 sm:p-10 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 text-center space-y-4 shadow-sm">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mx-auto flex items-center justify-center">
                      <GraduationCap size={28} />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900">
                        {language === 'hi' ? 'अभी तक कोई कोर्स नहीं खरीदा गया है' : 'No courses enrolled yet'}
                      </h3>
                      <p className="text-xs sm:text-sm dark:text-slate-400 text-slate-600 max-w-md mx-auto">
                        {language === 'hi'
                          ? 'अपनी तैयारी शुरू करने के लिए हमारी परीक्षा और टेस्ट सीरीज चुनें। खरीदने के बाद आपके सभी मुख्य विषय और फोल्डर्स सीधे यहां दिखाई देंगे।'
                          : 'When you purchase subject folders, exam passes or the All-Access Pass, your course folders will appear directly here for structured 1-tap study.'}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link
                        to="/explore"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black shadow-md transition-all active:scale-95"
                      >
                        <span>{language === 'hi' ? 'उपलब्ध परीक्षाएं देखें' : 'Explore Available Exams'}</span>
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

                    {/* ENROLLED EXAM CARDS */}
                    {enrolledExams.map((exam) => {
                      const rootCount = folders.filter(
                        (f) => isPublished(f) && f.exam_id === exam.id && !f.parent_folder_id && !f.parent_id
                      ).length;
                      const examFolders = folders.filter((f) => isPublished(f) && f.exam_id === exam.id);
                      const examFolderIdSet = new Set(examFolders.map((f) => f.id));
                      const totalChaptersCount = chapters.filter(
                        (c) => isPublished(c) && examFolderIdSet.has(c.folder_id)
                      ).length;

                      return (
                        <div
                          key={exam.id}
                          className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-500/50 transition-all group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                {getExamCategory(exam)}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500">
                                <CheckCircle2 size={12} />
                                <span>{language === 'hi' ? 'अनलॉक' : 'Unlocked'}</span>
                              </span>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                <GraduationCap size={24} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-base font-black dark:text-white text-slate-900 tracking-tight leading-snug line-clamp-2">
                                  {exam.title}
                                </h4>
                                <p className="text-xs dark:text-slate-400 text-slate-500 line-clamp-1 mt-0.5">
                                  {exam.description || 'Comprehensive exam test series & syllabus folders.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              <span className="px-2 py-0.5 rounded-lg dark:bg-slate-800 bg-slate-100 flex items-center gap-1">
                                <Folder size={12} className="text-indigo-400 shrink-0" />
                                <span>{rootCount} {language === 'hi' ? 'मुख्य विषय' : 'Main Subjects'}</span>
                              </span>
                              {totalChaptersCount > 0 && (
                                <span className="px-2 py-0.5 rounded-lg dark:bg-slate-800 bg-slate-100 flex items-center gap-1">
                                  <FileText size={12} className="text-emerald-400 shrink-0" />
                                  <span>{totalChaptersCount} {language === 'hi' ? 'टेस्ट व नोट्स' : 'Tests & Notes'}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400">
                              {language === 'hi' ? 'क्रमबद्ध फोल्डर्स' : 'Hierarchical Folders'}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleSelectExam(exam)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-sm transition-all active:scale-95 group-hover:shadow-indigo-500/20"
                            >
                              <span>{language === 'hi' ? 'कोर्स खोलें' : 'Open Course'}</span>
                              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* STANDALONE ENROLLED FOLDERS */}
                    {enrolledStandaloneFolders.map((folder) => {
                      const parentExam = examMap.get(folder.exam_id);
                      const chapterCount = chaptersByFolderId.get(folder.id)?.length || 0;

                      return (
                        <div
                          key={folder.id}
                          className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-amber-500/50 transition-all group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-wider truncate max-w-[170px]">
                                {parentExam?.title || 'Subject Pack'}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500">
                                <CheckCircle2 size={12} />
                                <span>{language === 'hi' ? 'खरीदा हुआ' : 'Purchased'}</span>
                              </span>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                                <Folder size={24} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-base font-black dark:text-white text-slate-900 tracking-tight leading-snug line-clamp-2">
                                  {folder.title}
                                </h4>
                                <p className="text-xs dark:text-slate-400 text-slate-500 line-clamp-1 mt-0.5">
                                  {folder.description || 'Subject learning material and tests.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              <span className="px-2 py-0.5 rounded-lg dark:bg-slate-800 bg-slate-100 flex items-center gap-1">
                                <FileText size={12} className="text-amber-400 shrink-0" />
                                <span>{chapterCount} {language === 'hi' ? 'चैप्टर व टेस्ट्स' : 'Chapters & Tests'}</span>
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400">
                              {language === 'hi' ? 'विषय फोल्डर' : 'Subject Folder'}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                if (parentExam) setSelectedExam(parentExam);
                                handleSelectFolder(folder);
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-sm transition-all active:scale-95"
                            >
                              <span>{language === 'hi' ? 'विषय खोलें' : 'Open Subject'}</span>
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* STUDY TOOLBOX CARD */}
                    {hasToolboxAccess && (
                      <div className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-cyan-500/50 transition-all group">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                              Smart Suite
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500">
                              <CheckCircle2 size={12} />
                              <span>{language === 'hi' ? 'सक्रिय' : 'Active'}</span>
                            </span>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-500/20">
                              <Wrench size={24} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-base font-black dark:text-white text-slate-900 tracking-tight leading-snug">
                                {language === 'hi' ? 'स्टडी टूलबॉक्स (6 टूल्स)' : 'Study Toolbox Suite'}
                              </h4>
                              <p className="text-xs dark:text-slate-400 text-slate-500 line-clamp-1 mt-0.5">
                                {language === 'hi'
                                  ? 'नोट्स मेकर, फॉर्मूला शीट, टाइमर और रिवीजन टूल्स।'
                                  : 'Notes maker, formula sheets, revision tools and timers.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400">
                            6 Tools Included
                          </span>

                          <Link
                            to="/toolbox"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black shadow-sm transition-all active:scale-95"
                          >
                            <span>{language === 'hi' ? 'टूल्स खोलें' : 'Open Tools'}</span>
                            <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : selectedExam && folderStack.length === 0 ? (
              /* ============================================================ */
              /* LEVEL 1: INSIDE EXAM - ROOT / MAIN SUBJECT FOLDERS          */
              /* ============================================================ */
              <div className="space-y-4">
                {/* Exam Banner Header */}
                <div className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-indigo-500 block">
                        {language === 'hi' ? 'चयनित कोर्स' : 'Selected Course'}
                      </span>
                      <h2 className="text-base sm:text-xl font-black dark:text-white text-slate-900 tracking-tight">
                        {selectedExam.title}
                      </h2>
                      <p className="text-xs dark:text-slate-400 text-slate-500 line-clamp-1 mt-0.5">
                        {selectedExam.description || 'Select any subject folder below to start studying.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-xs font-black text-indigo-500 flex items-center gap-1">
                      <Folder size={12} className="text-indigo-400 shrink-0" />
                      <span>{currentExamRootFolders.length} {language === 'hi' ? 'मुख्य विषय' : 'Main Subjects'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
                    <Folder size={14} className="text-indigo-500" />
                    <span>{language === 'hi' ? 'मुख्य विषय फोल्डर्स (Main Subjects)' : 'Main Subject Folders'}</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {language === 'hi' ? 'अंदर के सब-फोल्डर्स देखने के लिए क्लिक करें' : 'Click any subject to view sub-folders'}
                  </span>
                </div>

                {currentExamRootFolders.length === 0 ? (
                  <div className="p-8 text-center rounded-3xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 space-y-2">
                    <Folder size={24} className="mx-auto text-slate-400" />
                    <p className="text-xs font-bold dark:text-white text-slate-900">
                      {language === 'hi' ? 'इस परीक्षा में अभी कोई फोल्डर प्रकाशित नहीं है।' : 'No published folders found in this exam yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {currentExamRootFolders.map((folder) => {
                      const subCount = folders.filter(
                        (f) => isPublished(f) && (f.parent_folder_id === folder.id || f.parent_id === folder.id)
                      ).length;
                      const chapterCount = chaptersByFolderId.get(folder.id)?.length || 0;

                      return (
                        <div
                          key={folder.id}
                          className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col justify-between space-y-3 hover:border-indigo-500/50 transition-all group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-500/10 text-indigo-500 uppercase tracking-wider">
                                {subCount > 0 ? `${subCount} Sub-Subjects` : 'Main Folder'}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-500">
                                <CheckCircle2 size={12} />
                                <span>Unlocked</span>
                              </span>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
                                <Folder size={20} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm sm:text-base font-black dark:text-white text-slate-900 tracking-tight leading-snug line-clamp-2">
                                  {folder.title}
                                </h4>
                                <p className="text-xs dark:text-slate-400 text-slate-500 line-clamp-2 mt-0.5">
                                  {folder.description || 'Tap to explore sub-folders and practice chapters.'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              {subCount > 0 && (
                                <span className="px-2 py-0.5 rounded-lg dark:bg-slate-800 bg-slate-100 flex items-center gap-1">
                                  <FolderOpen size={12} className="text-amber-400 shrink-0" />
                                  <span>{subCount} {language === 'hi' ? 'सब-फोल्डर्स' : 'Sub-folders'}</span>
                                </span>
                              )}
                              {chapterCount > 0 && (
                                <span className="px-2 py-0.5 rounded-lg dark:bg-slate-800 bg-slate-100 flex items-center gap-1">
                                  <FileText size={12} className="text-indigo-400 shrink-0" />
                                  <span>{chapterCount} {language === 'hi' ? 'टेस्ट/चैप्टर्स' : 'Tests/Chapters'}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t dark:border-slate-800 border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400">
                              {language === 'hi' ? 'अंदर देखें' : 'View Inside'}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleSelectFolder(folder)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-sm transition-all active:scale-95 group-hover:shadow-indigo-500/20"
                            >
                              <span>{language === 'hi' ? 'विषय खोलें' : 'Open Subject'}</span>
                              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================ */
              /* LEVEL 2+: INSIDE FOLDER / SUB-FOLDERS & CHAPTERS            */
              /* ============================================================ */
              <div className="space-y-4">
                {/* Current Folder Header */}
                <div className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
                      <FolderOpen size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-amber-500 block">
                        {language === 'hi' ? 'वर्तमान विषय' : 'Current Subject'}
                      </span>
                      <h2 className="text-base sm:text-xl font-black dark:text-white text-slate-900 tracking-tight">
                        {currentFolder?.title}
                      </h2>
                      <p className="text-xs dark:text-slate-400 text-slate-500 line-clamp-1 mt-0.5">
                        {currentFolder?.description || 'Explore sub-topics and practice mock tests.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/folder/${currentFolder?.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                      title="Open full page view"
                    >
                      <ExternalLink size={12} />
                      <span>{language === 'hi' ? 'फुल पेज व्यू' : 'Full Page'}</span>
                    </Link>
                  </div>
                </div>

                {/* 1. Sub-folders Section (अगर इस फोल्डर के अंदर और फोल्डर्स हैं) */}
                {currentSubFolders.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
                        <FolderOpen size={14} className="text-amber-500" />
                        <span>{language === 'hi' ? 'सब-फोल्डर्स (Sub-Folders / Topics)' : 'Sub-Folders & Topics'}</span>
                      </h3>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {currentSubFolders.length} {language === 'hi' ? 'विषय' : 'topics'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {currentSubFolders.map((subFolder) => {
                        const deeperSubCount = folders.filter(
                          (f) => isPublished(f) && (f.parent_folder_id === subFolder.id || f.parent_id === subFolder.id)
                        ).length;
                        const subChapterCount = chaptersByFolderId.get(subFolder.id)?.length || 0;

                        return (
                          <div
                            key={subFolder.id}
                            className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 hover:border-amber-500/60 shadow-xs flex items-center justify-between gap-3 transition-all group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                                <Folder size={20} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 truncate">
                                  {subFolder.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
                                  {deeperSubCount > 0 && (
                                    <span className="flex items-center gap-1">
                                      <FolderOpen size={11} className="text-amber-400 shrink-0" />
                                      <span>{deeperSubCount} Sub-topics</span>
                                    </span>
                                  )}
                                  {subChapterCount > 0 && (
                                    <span className="flex items-center gap-1">
                                      <FileText size={11} className="text-emerald-400 shrink-0" />
                                      <span>{subChapterCount} Tests/Notes</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectFolder(subFolder)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 shadow-xs transition-all active:scale-95 group-hover:translate-x-0.5"
                            >
                              <span>{language === 'hi' ? 'खोलें' : 'Open'}</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Direct Chapters & Mock Tests Section (इस फोल्डर का कंटेंट) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 flex items-center gap-1.5">
                      <BookOpen size={14} className="text-emerald-500" />
                      <span>{language === 'hi' ? 'स्टडी चैप्टर व टेस्ट सीरीज' : 'Study Chapters & Mock Tests'}</span>
                    </h3>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {currentFolderChapters.length} {language === 'hi' ? 'अध्याय' : 'items'}
                    </span>
                  </div>

                  {currentFolderChapters.length === 0 && currentSubFolders.length === 0 ? (
                    <div className="p-8 text-center rounded-3xl dark:bg-slate-900 bg-white border dark:border-slate-800 border-slate-200 space-y-2">
                      <BookOpen size={24} className="mx-auto text-slate-400 opacity-60" />
                      <p className="text-xs font-bold dark:text-white text-slate-900">
                        {language === 'hi'
                          ? 'इस फोल्डर में अभी अध्ययन सामग्री जोड़ी जा रही है।'
                          : 'Study content and tests are currently being prepared for this subject.'}
                      </p>
                    </div>
                  ) : currentFolderChapters.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic px-1">
                      {language === 'hi'
                        ? 'कृपया अध्याय और टेस्ट देखने के लिए ऊपर दिए गए सब-फोल्डर चुनें।'
                        : 'Select one of the sub-folders above to access tests and study materials.'}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {currentFolderChapters.map((chapter, idx) => (
                        <div
                          key={chapter.id}
                          className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-500/50 transition-all group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-sm font-black shrink-0 border border-emerald-500/20">
                              {idx + 1}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.2 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  {chapter.content_type || 'Study Material'}
                                </span>
                              </div>
                              <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 truncate mt-0.5">
                                {chapter.title}
                              </h4>
                              {chapter.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                                  {chapter.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <Link
                            to={`/chapter/${chapter.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shrink-0 shadow-xs transition-all active:scale-95 group-hover:shadow-emerald-500/20"
                          >
                            <span>{language === 'hi' ? 'शुरू करें' : 'Start'}</span>
                            <Play size={11} className="fill-current" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* PAYMENT ORDERS & RECEIPTS TAB                                */
          /* ============================================================ */
          (() => {
            const seenKeys = new Set();
            const dedupedOrders = orders.filter((o) => {
              const key = o.razorpay_order_id || o.gateway_order_id || o.id;
              if (seenKeys.has(key)) return false;
              seenKeys.add(key);
              return true;
            });
            const paidOrders = dedupedOrders.filter((o) => String(o.status || '').toLowerCase() === 'paid');
            const inactiveOrders = dedupedOrders.filter((o) => String(o.status || '').toLowerCase() !== 'paid');
            const displayedOrders = showAllOrders ? dedupedOrders : paidOrders;

            return (
              <div className="space-y-3">
                <div className="px-1 flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500">
                    {language === 'hi' ? 'लेनदेन और भुगतान रसीदें' : 'Transactions & Order Invoices'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {inactiveOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllOrders((prev) => !prev)}
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {showAllOrders
                          ? (language === 'hi' ? 'अपूर्ण / समाप्त ऑर्डर छिपाएं' : 'Hide unpaid / expired')
                          : (language === 'hi' ? `अपूर्ण / समाप्त दिखाएं (${inactiveOrders.length})` : `Show unpaid / expired (${inactiveOrders.length})`)}
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400 font-semibold">{displayedOrders.length} orders</span>
                  </div>
                </div>

                {displayedOrders.length === 0 ? (
                  <div className="p-8 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 text-center space-y-2 shadow-sm">
                    <p className="text-xs dark:text-slate-400 text-slate-600 font-medium">
                      {language === 'hi' ? 'कोई सफल पेमेंट रिकॉर्ड उपलब्ध नहीं है।' : 'No completed payment transactions recorded.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {displayedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-800 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
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
                            <div className="text-[10px] text-amber-500 font-bold flex items-center gap-1 justify-end">
                              <Coins size={12} className="text-amber-500" />
                              <span>{order.coins_redeemed} coins redeemed</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>
  );
}
