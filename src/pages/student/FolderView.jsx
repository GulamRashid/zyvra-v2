import { useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, ChevronRight, Clock3, Folder, FolderOpen, LockKeyhole
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import CheckoutModal from '../../components/common/CheckoutModal';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ContentIcon from '../../components/common/ContentIcon';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getChapterAccess, getFolderPath, getFolderPricing, isFolderUnlocked, isPublished, sortContentItems } from '../../lib/content';
import useContentAccess from '../../hooks/useContentAccess';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';

function AccessBadge({ label }) {
  const lower = (label || '').toLowerCase();
  const isPaid = lower.includes('paid') || lower.includes('locked');
  const isPurchased = lower.includes('purchased') || (label || '').includes('अनलॉक');
  const isComing = lower.includes('coming');

  let badgeClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
  if (isPurchased) {
    badgeClasses = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold';
  } else if (isPaid) {
    badgeClasses = 'bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-400/30 font-bold';
  } else if (isComing) {
    badgeClasses = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-bold';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] tracking-wide inline-block font-semibold ${badgeClasses}`}>
      {label}
    </span>
  );
}

export default function FolderView() {
  const { folderId } = useParams();
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user } = useAuth();
  const { language } = useThemeLanguage();
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [folderTests, setFolderTests] = useState([]);
  const [folderTestsLoading, setFolderTestsLoading] = useState(false);

  const folder = folders.find((item) => item.id === folderId && isPublished(item));
  const exam = exams.find((item) => item.id === folder?.exam_id && isPublished(item));
  const path = useMemo(() => (folder ? getFolderPath(folder, folders) : []), [folder, folders]);
  const hierarchyPublished = path.every(isPublished);
  const childFolders = useMemo(() => {
    const list = folders.filter((item) => (item.parent_folder_id === folder?.id || item.parent_id === folder?.id) && isPublished(item));
    return sortContentItems(list);
  }, [folders, folder?.id]);

  const folderChapters = useMemo(() => {
    const list = chapters.filter((chapter) => chapter.folder_id === folder?.id && isPublished(chapter));
    return sortContentItems(list);
  }, [chapters, folder?.id]);

  // Fetch any tests assigned directly to this folder (e.g. Full Syllabus Mock Tests)
  useEffect(() => {
    if (!folder?.id || !supabase) return;
    let isCancelled = false;
    setFolderTestsLoading(true);
    supabase
      .from('tests')
      .select('id, title, duration_minutes, duration_mins, total_marks, is_free, solution_mode, status, pattern_type')
      .eq('folder_id', folder.id)
      .eq('status', 'published')
      .then(({ data, error: tErr }) => {
        if (!isCancelled) {
          if (!tErr && data) {
            setFolderTests(data);
          }
          setFolderTestsLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setFolderTestsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [folder?.id]);
  const parent = path.length > 1 ? path[path.length - 2] : null;
  const pricing = getFolderPricing(folder, folders);
  const examPrice = Number(exam?.price || 0);
  const examIsPaid = examPrice > 0 || exam?.access_mode === 'paid-own' || exam?.access_mode === 'paid_own' || exam?.pricing_mode === 'paid-own' || exam?.pricing_mode === 'paid_own';

  const accessItems = useMemo(() => [
    ...(exam && examIsPaid ? [{ type: 'exam', id: exam.id, paid: true }] : []),
    ...path.filter((p) => getFolderPricing(p, folders).amount > 0).map((p) => ({ type: 'folder', id: p.id, paid: true })),
    ...(pricing.amount > 0 ? [{ type: 'folder', id: folder.id, paid: true }] : []),
    ...childFolders.map((child) => ({ type: 'folder', id: child.id, paid: getFolderPricing(child, folders).amount > 0 })),
    ...folderChapters.map((chapter) => ({ type: 'chapter', id: chapter.id, paid: getChapterAccess(chapter, folder, folders).amount > 0 }))
  ], [exam, examIsPaid, path, folder, pricing.amount, childFolders, folderChapters, folders]);

  const { accessByKey, loading: accessLoading, error: accessError } = useContentAccess(accessItems, user, supabase, refreshKey);

  const purchasedFolderIds = useMemo(() => {
    return Object.entries(accessByKey)
      .filter(([key, granted]) => granted === true && key.startsWith('folder:'))
      .map(([key]) => key.replace('folder:', ''));
  }, [accessByKey]);

  const hasPurchasedExam = examIsPaid && accessByKey[`exam:${exam?.id}`] === true;
  const isCurrentFolderUnlocked = hasPurchasedExam || pricing.amount <= 0 || isFolderUnlocked(folder?.id, folders, purchasedFolderIds) || accessByKey[`folder:${folder?.id}`] === true;

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#F8FAFC] dark:text-slate-100 text-slate-900 transition-colors">
      <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-indigo-400/80 overflow-x-auto no-scrollbar py-1">
          <Link to="/explore" className="hover:text-indigo-600 dark:hover:text-white whitespace-nowrap">
            {language === 'hi' ? 'परीक्षाएं' : 'Explore'}
          </Link>
          <ChevronRight size={13} className="shrink-0 text-slate-400" />
          {exam && (
            <>
              <Link to={`/explore/${encodeURIComponent(exam.slug)}`} className="hover:text-indigo-600 dark:hover:text-white whitespace-nowrap">
                {exam.title}
              </Link>
              <ChevronRight size={13} className="shrink-0 text-slate-400" />
            </>
          )}
          {path.map((item, index) => (
            <span className="flex items-center gap-1.5 whitespace-nowrap" key={item.id}>
              {index > 0 && <ChevronRight size={13} className="shrink-0 text-slate-400" />}
              {index === path.length - 1 ? (
                <span className="dark:text-white text-slate-900 font-extrabold truncate">{item.title}</span>
              ) : (
                <Link to={`/folder/${item.id}`} className="hover:text-indigo-600 dark:hover:text-white">
                  {item.title}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {loading && <LoadingSkeleton rows={4} />}

        {!loading && !error && (!folder || !exam || !hierarchyPublished) && (
          <div className="p-8 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-3">
            <Folder size={28} className="mx-auto text-indigo-500 opacity-60" />
            <strong className="text-base font-black dark:text-white text-slate-900 block">
              {language === 'hi' ? 'यह फ़ोल्डर उपलब्ध नहीं है।' : 'This folder isn’t available.'}
            </strong>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              {language === 'hi' ? 'यह अभी अप्रकाशित हो सकता है।' : 'It may be unpublished or its exam has changed.'}
            </span>
            <Link
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white text-sm font-black"
              to="/explore"
            >
              {language === 'hi' ? 'परीक्षाओं पर वापस जाएं' : 'Back to explore'}
            </Link>
          </div>
        )}

        {!loading && !error && folder && exam && hierarchyPublished && (
          <>
            {/* Folder Hero Banner with Minimalist Theme */}
            <section className="relative overflow-hidden rounded-2xl dark:bg-[#1E293B]/70 bg-white border dark:border-slate-800 border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                  <ContentIcon icon={folder.icon_url || folder.icon} className="w-5 h-5 text-indigo-500 dark:text-indigo-400" fallback={FolderOpen} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider">
                    {exam.title} / {language === 'hi' ? 'पाठ्यक्रम' : 'Syllabus'}
                  </div>
                  <h1 className="text-base sm:text-xl font-bold dark:text-white text-slate-900 tracking-tight truncate">
                    {folder.title}
                  </h1>
                </div>
              </div>

              <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium">
                {folder.description || (language === 'hi' ? 'इस अध्ययन विषय के अध्यायों और टॉपिक्स का अभ्यास करें।' : 'Explore the topics and chapters in this learning section.')}
              </p>

              <div className="flex items-center gap-2 flex-wrap pt-0.5 text-xs">
                <AccessBadge label={pricing.amount ? (accessLoading ? (language === 'hi' ? 'जाँच जारी है…' : 'Checking…') : isCurrentFolderUnlocked ? (language === 'hi' ? 'अनलॉक किया हुआ' : 'Purchased') : pricing.label) : (language === 'hi' ? 'मुफ़्त' : 'Free')} />
                {pricing.amount > 0 && (
                  <span className="text-amber-500 dark:text-amber-400 font-bold">
                    {pricing.label}
                  </span>
                )}
                {childFolders.length > 0 && (
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                    <Folder size={12} /> {childFolders.length} {language === 'hi' ? 'सब-फ़ोल्डर' : 'subfolders'}
                  </span>
                )}
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                  <BookOpen size={12} /> {folderChapters.length} {language === 'hi' ? 'अध्याय' : 'chapters'}
                </span>
                {folderTests.length > 0 && (
                  <span className="flex items-center gap-1 text-amber-500 font-medium">
                    <Clock3 size={12} /> {folderTests.length} {language === 'hi' ? 'मॉक टेस्ट' : 'mock tests'}
                  </span>
                )}
              </div>
            </section>

            {accessError && (
              <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
                {accessError}
              </div>
            )}

            {/* Paywall Banner if Locked */}
            {pricing.amount > 0 && !accessLoading && !accessError && !isCurrentFolderUnlocked && (
              <section className="p-3.5 sm:p-4 rounded-2xl dark:bg-gradient-to-r dark:from-amber-950/40 dark:to-slate-800/60 bg-amber-50/90 border dark:border-amber-500/30 border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-500 shrink-0">
                    <LockKeyhole size={16} />
                  </div>
                  <div>
                    <strong className="text-xs sm:text-sm font-black dark:text-white text-slate-900 block">
                      {language === 'hi' ? `${folder.title} अनलॉक करें` : `Unlock Access for ${folder.title}`}
                    </strong>
                    <span className="text-[11px] sm:text-xs text-amber-900/80 dark:text-amber-200/80 font-medium">
                      {language === 'hi' ? `इस अनुभाग के सभी सब-फ़ोल्डर्स और अध्यायों का पूरा एक्सेस पाएं।` : `Get this section to automatically unlock all nested sub-folders and chapters inside it.`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-black shadow-glowGold flex items-center justify-center gap-1.5 min-h-[44px]"
                    disabled={!user || accessLoading}
                    onClick={() =>
                      setCheckoutItem({
                        itemType: 'folder',
                        itemId: folder.id,
                        itemTitle: folder.title,
                        tier: 'Folder Bundle',
                        basePrice: pricing.amount
                      })
                    }
                  >
                    <span>{accessLoading ? (language === 'hi' ? 'जाँच जारी है…' : 'Checking…') : `${language === 'hi' ? 'खरीदें' : 'Buy'} ${folder.title} · ₹${pricing.amount.toLocaleString('en-IN')}`}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </section>
            )}

            {/* Section Heading */}
            <div className="flex items-center justify-between px-1">
              <div>
                <div className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider">
                  {language === 'hi' ? 'इस अनुभाग में' : 'Inside This Section'}
                </div>
                <h2 className="text-sm sm:text-base font-black dark:text-white text-slate-900">
                  {language === 'hi' ? 'विषय और अध्याय' : 'Topics & chapters'}
                </h2>
              </div>
              <span className="text-xs sm:text-sm font-bold dark:text-slate-300 text-slate-700">
                {childFolders.length + folderChapters.length + folderTests.length} {language === 'hi' ? 'अध्ययन सामग्री' : 'learning items'}
              </span>
            </div>

            {!childFolders.length && !folderChapters.length && !folderTests.length && (
              <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                <FolderOpen size={24} className="mx-auto text-indigo-500 opacity-60" />
                <strong className="block text-sm dark:text-white text-slate-900">More learning content coming soon.</strong>
                <span className="text-xs text-slate-500 dark:text-slate-400">This section is being prepared for you.</span>
              </div>
            )}

            {/* Child Folders Section */}
            {childFolders.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs sm:text-sm font-black dark:text-white text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-indigo-500">
                    <Folder size={14} />
                    <span>{language === 'hi' ? 'उप-विषय एवं सेक्शन्स' : 'Sub-Folders & Subjects'} ({childFolders.length})</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {childFolders.map((child) => {
                    const childPricing = getFolderPricing(child, folders);
                    const count = chapters.filter((chapter) => chapter.folder_id === child.id && isPublished(chapter)).length;
                    const childStatus = ['coming-soon', 'coming_soon'].includes(String(child.status || '').toLowerCase());
                    const isChildUnlocked = isCurrentFolderUnlocked || childPricing.amount <= 0 || isFolderUnlocked(child.id, folders, purchasedFolderIds) || accessByKey[`folder:${child.id}`] === true;

                    return (
                      <article
                        key={child.id}
                        className="p-3 sm:p-3.5 rounded-2xl dark:bg-[#1E293B]/70 bg-white shadow-xs border dark:border-slate-800 border-slate-200/80 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-2 group"
                      >
                        <Link to={`/folder/${child.id}`} className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform mt-0.5">
                              <ContentIcon icon={child.icon_url || child.icon} className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fallback={Folder} />
                            </div>
                            <div className="min-w-0">
                              <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate group-hover:text-indigo-400 transition-colors">
                                {child.title}
                              </strong>
                              <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate mt-0.5">
                                {child.description || `${count} ${count === 1 ? 'अध्याय' : 'अध्याय'}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <AccessBadge label={childStatus ? 'Coming Soon' : childPricing.amount ? (accessLoading ? 'Checking…' : isChildUnlocked ? 'Purchased' : 'Paid') : 'Free'} />
                            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </Link>

                        {childPricing.amount > 0 && !accessLoading && !accessError && !isChildUnlocked && (
                          <div className="pt-2 border-t dark:border-slate-800/80 border-slate-100 flex justify-end">
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold flex items-center gap-1 min-h-[38px]"
                              onClick={() => setCheckoutItem({ itemType: 'folder', itemId: child.id, itemTitle: child.title, tier: 'Folder Bundle', basePrice: childPricing.amount })}
                            >
                              <span>Buy bundle · ₹{childPricing.amount.toLocaleString('en-IN')}</span>
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full-Book / Full-Syllabus Mock Tests Section (if folder has direct mock tests) */}
            {folderTests.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-amber-500">
                    <Clock3 size={14} />
                    <span>{language === 'hi' ? 'संपूर्ण पुस्तक मॉक टेस्ट्स' : 'Full Book Mock Tests'} ({folderTests.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">{language === 'hi' ? 'परीक्षा हॉल पैटर्न' : 'Full Exam Mode'}</span>
                </div>

                <div className="space-y-2">
                  {folderTests.map((test) => (
                    <article
                      key={test.id}
                      className="p-3 sm:p-3.5 rounded-2xl dark:bg-[#1E293B]/70 bg-white shadow-xs border dark:border-slate-800 border-slate-200/80 hover:border-amber-400/40 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl dark:bg-amber-500/10 bg-amber-50 border dark:border-amber-500/20 border-amber-200 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-105 transition-transform">
                          <Clock3 size={16} />
                        </div>
                        <div className="min-w-0">
                          <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate group-hover:text-amber-400 transition-colors">
                            {test.title}
                          </strong>
                          <span className="text-[11px] dark:text-slate-400 text-slate-500 block truncate mt-0.5">
                            {test.duration_minutes || test.duration_mins || 60} {language === 'hi' ? 'मिनट' : 'mins'} • {test.total_marks ? `${test.total_marks} अंक` : 'Timed Exam'}
                          </span>
                        </div>
                      </div>

                      <Link
                        to={isCurrentFolderUnlocked ? `/quiz/${test.id}` : '#'}
                        onClick={(e) => {
                          if (!isCurrentFolderUnlocked) {
                            e.preventDefault();
                            setCheckoutItem({
                              itemType: 'folder',
                              itemId: folder.id,
                              itemTitle: folder.title,
                              tier: 'Folder Bundle',
                              basePrice: pricing.amount
                            });
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-sm border border-indigo-400/20 min-h-[40px]"
                      >
                        <span>{language === 'hi' ? 'मॉक टेस्ट दें' : 'Take Mock'}</span>
                        <ArrowRight size={13} />
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* Chapter Modules Section with Minimalist Cards */}
            {folderChapters.length > 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-indigo-500">
                    <BookOpen size={14} />
                    <span>{language === 'hi' ? 'अध्याय एवं अभ्यास सामग्री' : 'Chapters & Learning Materials'} ({folderChapters.length})</span>
                  </h3>
                </div>

                <div className="space-y-2">
                  {folderChapters.map((chapter) => {
                    const access = getChapterAccess(chapter, folder, folders);
                    const isChapterUnlocked = isCurrentFolderUnlocked || access.amount <= 0 || accessByKey[`chapter:${chapter.id}`] === true;

                    return (
                      <article
                        key={chapter.id}
                        className="p-3 sm:p-3.5 rounded-2xl dark:bg-[#1E293B]/70 bg-white shadow-xs border dark:border-slate-800 border-slate-200/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all space-y-2 group"
                      >
                        <Link to={`/chapter/${chapter.id}`} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl dark:bg-slate-800/80 bg-slate-100 border dark:border-slate-700/60 border-slate-200 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                              <BookOpen size={16} />
                            </div>
                            <div className="min-w-0">
                              <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate group-hover:text-indigo-400 transition-colors">
                                {chapter.title}
                              </strong>

                              <div className="text-[11px] dark:text-slate-400 text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="font-semibold text-indigo-500 dark:text-indigo-400">{chapter.subject || 'General'}</span>
                                <span>•</span>
                                <span><Clock3 size={11} className="inline mr-0.5" />{chapter.estimated_study_time_minutes || 20} min</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <AccessBadge label={access.amount > 0 ? (accessLoading ? (language === 'hi' ? 'जाँच जारी है…' : 'Checking…') : isChapterUnlocked ? (language === 'hi' ? 'अनलॉक किया हुआ' : 'Purchased') : access.label) : (language === 'hi' ? 'मुफ़्त' : 'Free')} />
                            <ArrowRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </Link>

                        {access.amount > 0 && !isChapterUnlocked && (
                          <div className="pt-2 border-t dark:border-slate-800/80 border-slate-100 flex justify-end">
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold flex items-center gap-1 min-h-[38px]"
                              onClick={() => setCheckoutItem({ itemType: 'chapter', itemId: chapter.id, itemTitle: chapter.title, tier: 'Chapter', basePrice: access.amount })}
                            >
                              <span>{language === 'hi' ? 'अध्याय खरीदें' : 'Buy chapter'} · ₹{access.amount.toLocaleString('en-IN')}</span>
                              <ArrowRight size={13} />
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {parent && (
              <div className="pt-2">
                <Link
                  className="inline-flex items-center gap-1.5 text-xs font-bold dark:text-indigo-400 text-indigo-600 hover:underline min-h-[44px]"
                  to={`/folder/${parent.id}`}
                >
                  <ArrowRight className="rotate-180" size={14} /> <span>Back to {parent.title}</span>
                </Link>
              </div>
            )}
            {checkoutItem && <CheckoutModal {...checkoutItem} onClose={() => setCheckoutItem(null)} onCompleted={() => setRefreshKey((value) => value + 1)} />}
          </>
        )}
      </div>
    </div>
  );
}
