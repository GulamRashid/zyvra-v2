import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getChapterAccess, getFolderPath, getFolderPricing, isFolderUnlocked, isPublished } from '../../lib/content';
import useContentAccess from '../../hooks/useContentAccess';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

function AccessBadge({ label }) {
  const lower = label.toLowerCase();
  const isPaid = lower.includes('paid') || lower.includes('locked');
  const isPurchased = lower.includes('purchased');
  const isComing = lower.includes('coming');

  let badgeClasses = 'bg-[#22c55e]/20 text-emerald-700 dark:text-emerald-300 border border-[#22c55e]/30';
  if (isPurchased) {
    badgeClasses = 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-black';
  } else if (isPaid) {
    badgeClasses = 'bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 font-bold';
  } else if (isComing) {
    badgeClasses = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 font-bold';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider inline-block ${badgeClasses}`}>
      {label}
    </span>
  );
}

export default function FolderView() {
  const { folderId } = useParams();
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user } = useAuth();
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const folder = folders.find((item) => item.id === folderId && isPublished(item));
  const exam = exams.find((item) => item.id === folder?.exam_id && isPublished(item));
  const path = useMemo(() => (folder ? getFolderPath(folder, folders) : []), [folder, folders]);
  const hierarchyPublished = path.every(isPublished);
  const childFolders = folders.filter((item) => (item.parent_folder_id === folder?.id || item.parent_id === folder?.id) && isPublished(item));
  const folderChapters = chapters.filter((chapter) => chapter.folder_id === folder?.id && isPublished(chapter));
  const parent = path.length > 1 ? path[path.length - 2] : null;
  const rootFolder = path.length > 0 ? path[0] : null;
  const rootPricing = rootFolder ? getFolderPricing(rootFolder, folders) : { amount: 0 };
  const pricing = getFolderPricing(folder, folders);
  const examPrice = Number(exam?.price || 0);
  const examIsPaid = examPrice > 0 || exam?.access_mode === 'paid-own' || exam?.access_mode === 'paid_own' || exam?.pricing_mode === 'paid-own' || exam?.pricing_mode === 'paid_own';

  const accessItems = useMemo(() => [
    ...(exam && examIsPaid ? [{ type: 'exam', id: exam.id, paid: true }] : []),
    ...path.filter((p) => getFolderPricing(p, folders).amount > 0).map((p) => ({ type: 'folder', id: p.id, paid: true })),
    ...(pricing.amount > 0 ? [{ type: 'folder', id: folder.id, paid: true }] : []),
    ...childFolders.map((child) => ({ type: 'folder', id: child.id, paid: getFolderPricing(child, folders).amount > 0 })),
    ...folderChapters.map((chapter) => ({ type: 'chapter', id: chapter.id, paid: getChapterAccess(chapter, folder, folders).amount > 0 }))
  ], [exam, examIsPaid, path, folder?.id, pricing.amount, childFolders, folderChapters, folders]);

  const { accessByKey, loading: accessLoading, error: accessError } = useContentAccess(accessItems, user, supabase, refreshKey);

  const purchasedFolderIds = useMemo(() => {
    return Object.entries(accessByKey)
      .filter(([key, granted]) => granted === true && key.startsWith('folder:'))
      .map(([key]) => key.replace('folder:', ''));
  }, [accessByKey]);

  const hasPurchasedExam = examIsPaid && accessByKey[`exam:${exam?.id}`] === true;
  const isRootPurchased = rootFolder ? (hasPurchasedExam || rootPricing.amount <= 0 || isFolderUnlocked(rootFolder.id, folders, purchasedFolderIds) || accessByKey[`folder:${rootFolder.id}`] === true) : false;
  const isCurrentFolderUnlocked = hasPurchasedExam || pricing.amount <= 0 || isFolderUnlocked(folder?.id, folders, purchasedFolderIds) || accessByKey[`folder:${folder?.id}`] === true;

  return (
    <div className="min-h-screen dark:bg-[#04140e] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-emerald-400/80 overflow-x-auto no-scrollbar py-1">
          <Link to="/explore" className="hover:text-emerald-700 dark:hover:text-white whitespace-nowrap">
            Explore
          </Link>
          <ChevronRight size={13} className="shrink-0 text-slate-400" />
          {exam && (
            <>
              <Link to={`/explore/${encodeURIComponent(exam.slug)}`} className="hover:text-emerald-700 dark:hover:text-white whitespace-nowrap">
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
                <Link to={`/folder/${item.id}`} className="hover:text-emerald-700 dark:hover:text-white">
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
          <div className="p-8 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-3">
            <Folder size={28} className="mx-auto text-emerald-500 opacity-60" />
            <strong className="text-base font-black dark:text-white text-slate-900 block">
              This folder isn’t available.
            </strong>
            <span className="text-xs text-slate-500 dark:text-emerald-300/80 block">
              It may be unpublished or its exam has changed.
            </span>
            <Link
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/30 text-white text-sm font-black"
              to="/explore"
            >
              Back to explore
            </Link>
          </div>
        )}

        {!loading && !error && folder && exam && hierarchyPublished && (
          <>
            {/* Folder Hero Banner */}
            <section className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#07261b] dark:to-[#04140e] bg-gradient-to-br from-emerald-100/90 via-teal-50 to-white border dark:border-emerald-500/25 border-emerald-200 p-4 sm:p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl dark:bg-emerald-950/80 bg-white border dark:border-emerald-500/30 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs shrink-0">
                  <FolderOpen size={20} />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                    {exam.title} / Syllabus
                  </div>
                  <h1 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                    {folder.title}
                  </h1>
                </div>
              </div>

              <p className="text-sm dark:text-emerald-200/80 text-slate-600 font-medium">
                {folder.description || 'Explore the topics and chapters in this learning section.'}
              </p>

              <div className="flex items-center gap-2 flex-wrap pt-1 text-sm">
                <AccessBadge label={pricing.amount ? (isCurrentFolderUnlocked ? 'Purchased' : pricing.label) : 'Free'} />
                {pricing.amount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    Explicit pricing rule · {pricing.label}
                  </span>
                )}
                <span className="flex items-center gap-1 text-slate-500 dark:text-emerald-300/80 font-medium">
                  <Folder size={13} /> {childFolders.length} subfolders
                </span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-emerald-300/80 font-medium">
                  <BookOpen size={13} /> {folderChapters.length} chapters
                </span>
              </div>
            </section>

            {accessError && (
              <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
                {accessError}
              </div>
            )}

            {/* Paywall Banner if Locked */}
            {pricing.amount > 0 && !isCurrentFolderUnlocked && (
              <section className="p-4 sm:p-5 rounded-2xl dark:bg-gradient-to-r dark:from-amber-950/40 dark:to-emerald-950/40 bg-amber-50/90 border dark:border-amber-500/30 border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-500 shrink-0">
                    <LockKeyhole size={18} />
                  </div>
                  <div>
                    <strong className="text-sm font-black dark:text-white text-slate-900 block">
                      Unlock Access for {folder.title}
                    </strong>
                    <span className="text-xs text-amber-900/80 dark:text-amber-200/80 font-medium">
                      Get this section, or unlock the entire {rootFolder?.id !== folder.id ? `${rootFolder?.title} syllabus` : 'bundle'} to automatically unlock all nested sub-folders and chapters inside it.
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
                    <span>{accessLoading ? 'Checking access…' : `Buy ${folder.title} · ₹${pricing.amount.toLocaleString('en-IN')}`}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </section>
            )}

            {/* Section Heading */}
            <div className="flex items-center justify-between px-1">
              <div>
                <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                  Inside This Section
                </div>
                <h2 className="text-base font-black dark:text-white text-slate-900">Topics & chapters</h2>
              </div>
              <span className="text-sm font-bold dark:text-emerald-300 text-emerald-800">
                {childFolders.length + folderChapters.length} learning items
              </span>
            </div>

            {!childFolders.length && !folderChapters.length && (
              <div className="p-8 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-2">
                <FolderOpen size={24} className="mx-auto text-emerald-500 opacity-60" />
                <strong className="block text-sm dark:text-white text-slate-900">More learning content coming soon.</strong>
                <span className="text-xs text-slate-500 dark:text-emerald-300/80">This section is being prepared for you.</span>
              </div>
            )}

            {/* Child Folders & Chapters List */}
            <div className="space-y-2.5">
              {childFolders.map((child) => {
                const childPricing = getFolderPricing(child, folders);
                const count = chapters.filter((chapter) => chapter.folder_id === child.id && isPublished(chapter)).length;
                const childStatus = ['coming-soon', 'coming_soon'].includes(String(child.status || '').toLowerCase());
                const isChildUnlocked = isCurrentFolderUnlocked || childPricing.amount <= 0 || isFolderUnlocked(child.id, folders, purchasedFolderIds) || accessByKey[`folder:${child.id}`] === true;

                return (
                  <article
                    key={child.id}
                    className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-400 transition-all space-y-2"
                  >
                    <Link to={`/folder/${child.id}`} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Folder size={18} />
                        </div>
                        <div className="min-w-0">
                          <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                            {child.title}
                          </strong>
                          <small className="text-sm dark:text-emerald-300/70 text-slate-500 block truncate">
                            {child.description || `${count} chapters to explore`}
                          </small>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <AccessBadge label={childStatus ? 'Coming Soon' : childPricing.amount ? (isChildUnlocked ? 'Purchased' : 'Paid') : 'Free'} />
                        <ChevronRight size={17} className="text-slate-400 dark:text-emerald-400/50" />
                      </div>
                    </Link>

                    {childPricing.amount > 0 && !isChildUnlocked && (
                      <div className="pt-2 border-t dark:border-emerald-800/25 border-slate-100 flex justify-end">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold flex items-center gap-1 min-h-[44px]"
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

              {folderChapters.map((chapter) => {
                const access = getChapterAccess(chapter, folder, folders);
                const isChapterUnlocked = isCurrentFolderUnlocked || access.amount <= 0 || accessByKey[`chapter:${chapter.id}`] === true;

                return (
                  <article
                    key={chapter.id}
                    className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 hover:border-emerald-400 transition-all space-y-2"
                  >
                    <Link to={`/chapter/${chapter.id}`} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <BookOpen size={18} />
                        </div>
                        <div className="min-w-0">
                          <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                            {chapter.title}
                          </strong>
                          <div className="text-sm dark:text-emerald-300/70 text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{chapter.subject || 'General'}</span>
                            <span>•</span>
                            <span><Clock3 size={11} className="inline mr-0.5" />{chapter.estimated_study_time_minutes || '—'} min</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <AccessBadge label={access.amount > 0 ? (isChapterUnlocked ? 'Purchased' : access.label) : access.label} />
                        <ArrowRight size={16} className="text-slate-400 dark:text-emerald-400/50" />
                      </div>
                    </Link>

                    {access.amount > 0 && !isChapterUnlocked && (
                      <div className="pt-2 border-t dark:border-emerald-800/25 border-slate-100 flex justify-end">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold flex items-center gap-1 min-h-[44px]"
                          onClick={() => setCheckoutItem({ itemType: 'chapter', itemId: chapter.id, itemTitle: chapter.title, tier: 'Chapter', basePrice: access.amount })}
                        >
                          <span>Buy chapter · ₹{access.amount.toLocaleString('en-IN')}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {parent && (
              <div className="pt-2">
                <Link
                  className="inline-flex items-center gap-1.5 text-xs font-bold dark:text-emerald-400 text-emerald-800 hover:underline min-h-[44px]"
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
