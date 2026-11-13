import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, BookOpen, CheckCircle2, ChevronRight, Clock3, FileText, LoaderCircle, LockKeyhole, Play, Sparkles } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getChapterAccess, getFolderPath, getFolderPricing, isFolderUnlocked, isPublished } from '../../lib/content';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import PdfReaderModal from '../../components/common/PdfReaderModal';
import CheckoutModal from '../../components/common/CheckoutModal';
import QuestionPracticeModal from '../../components/common/QuestionPracticeModal';
import useContentAccess from '../../hooks/useContentAccess';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import { sanitizeLiveQuestion } from '../../lib/tests';

const tabs = [
  { id: 'tests', label: 'tests', icon: CheckCircle2 },
  { id: 'practice', label: 'questionPractice', icon: Play },
  { id: 'notes', label: 'notesPdfs', icon: FileText }
];

export default function ChapterDetail() {
  const { chapterId } = useParams();
  const location = useLocation();
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user } = useAuth();
  const { t, language } = useThemeLanguage();
  const [activeTab, setActiveTab] = useState('tests');
  const [notice, setNotice] = useState('');
  const [chapterTests, setChapterTests] = useState([]);
  const [testAttempts, setTestAttempts] = useState({});
  const [resumeAttempts, setResumeAttempts] = useState({});
  const [testsLoading, setTestsLoading] = useState(true);
  const [testsError, setTestsError] = useState('');
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceQuestionsCount, setPracticeQuestionsCount] = useState(0);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceActive, setPracticeActive] = useState(false);
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkBusy, setBookmarkBusy] = useState('');
  const [reader, setReader] = useState(null);
  const [readerLoading, setReaderLoading] = useState('');
  const [resourceNotice, setResourceNotice] = useState('');
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [accessRefreshKey, setAccessRefreshKey] = useState(0);
  const chapter = chapters.find((item) => item.id === chapterId && isPublished(item));
  const folder = folders.find((item) => item.id === chapter?.folder_id && isPublished(item));
  const exam = exams.find((item) => item.id === folder?.exam_id && isPublished(item));
  const folderPath = folder ? getFolderPath(folder, folders) : [];
  const rootFolder = folderPath.length > 0 ? folderPath[0] : null;
  const rootPricing = rootFolder ? getFolderPricing(rootFolder, folders) : { amount: 0 };
  const parentPricing = folder ? getFolderPricing(folder, folders) : { amount: 0 };
  const hierarchyPublished = folderPath.every(isPublished);
  const access = getChapterAccess(chapter, folder, folders);
  const examPrice = Number(exam?.price || 0);
  const examIsPaid = examPrice > 0 || exam?.access_mode === 'paid-own' || exam?.access_mode === 'paid_own' || exam?.pricing_mode === 'paid-own' || exam?.pricing_mode === 'paid_own';

  const accessItems = useMemo(() => [
    ...(exam && examIsPaid ? [{ type: 'exam', id: exam.id, paid: true }] : []),
    ...folderPath.filter((p) => getFolderPricing(p, folders).amount > 0).map((p) => ({ type: 'folder', id: p.id, paid: true })),
    ...(access.amount > 0 && chapter ? [{ type: 'chapter', id: chapter.id, paid: true }] : [])
  ], [exam, examIsPaid, folderPath, access.amount, chapter?.id, folders]);

  const { accessByKey, loading: accessLoading, error: accessError } = useContentAccess(accessItems, user, supabase, accessRefreshKey);

  const purchasedFolderIds = useMemo(() => {
    return Object.entries(accessByKey)
      .filter(([key, granted]) => granted === true && key.startsWith('folder:'))
      .map(([key]) => key.replace('folder:', ''));
  }, [accessByKey]);

  const hasPurchasedExam = examIsPaid && accessByKey[`exam:${exam?.id}`] === true;
  const hasParentFolderAccess = hasPurchasedExam || (folder ? isFolderUnlocked(folder.id, folders, purchasedFolderIds) : false);
  const isUnlocked = hasParentFolderAccess || access.amount <= 0 || accessByKey[`chapter:${chapter?.id}`] === true;
  const isLocked = !isUnlocked;
  const isComingSoon = access.label === 'Coming Soon';
  const hasTests = folder?.allow_tests !== false;
  const hasPractice = folder?.allow_practice !== false;
  const hasNotes = folder?.allow_notes !== false;

  useEffect(() => {
    if (!chapter?.id) return;
    try {
      localStorage.setItem(`zyvra-last-chapter-${user?.id || 'guest'}`, JSON.stringify({
        id: chapter.id,
        title: chapter.title,
        folderTitle: folder?.title || '',
        examTitle: exam?.title || '',
        visitedAt: new Date().toISOString()
      }));
    } catch (storageError) {
      console.error('Unable to save the last visited chapter:', storageError);
    }
  }, [chapter?.id, chapter?.title, folder?.title, exam?.title, user?.id]);

  useEffect(() => {
    let active = true;
    const loadResources = async () => {
      setResourcesLoading(true);
      setResourcesError('');
      if (!supabase || !chapter?.id || !hasNotes || isComingSoon) {
        setResources([]);
        setBookmarks([]);
        if (!supabase && chapter?.id && hasNotes) setResourcesError('Connect to Zyvra to load chapter resources.');
        setResourcesLoading(false);
        return;
      }
      const [resourceResult, bookmarkResult] = await Promise.all([
        supabase.from('chapter_resources').select('id,chapter_id,title,resource_type,file_size,page_count,is_downloadable,is_free_preview,status,display_order').eq('chapter_id', chapter.id),
        user ? supabase.from('student_bookmarks').select('*').eq('user_id', user.id).eq('chapter_id', chapter.id) : Promise.resolve({ data: [], error: null })
      ]);
      if (resourceResult.error) throw resourceResult.error;
      if (bookmarkResult.error) {
        console.warn('Unable to load bookmarks:', bookmarkResult.error.message);
      }
      if (!active) return;
      setResources((resourceResult.data || [])
        .filter((resource) => !['archived', 'draft', 'unpublished'].includes(String(resource.status || '').toLowerCase()))
        .sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0)));
      setBookmarks(bookmarkResult.data || []);
      setResourcesLoading(false);
    };
    loadResources().catch((loadError) => {
      if (active) {
        setResourcesError(loadError.message || 'Unable to load chapter resources.');
        setResourcesLoading(false);
      }
    });
    return () => { active = false; };
  }, [chapter?.id, hasNotes, isComingSoon, user]);

  const fetchChapterPracticeQuestions = async () => {
    if (!supabase || !chapter?.id) return [];

    let directQuestions = [];
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('chapter_id', chapter.id)
        .eq('status', 'published');
      if (error) {
        console.warn('Error fetching direct chapter questions:', error);
      } else {
        directQuestions = data || [];
      }
    } catch (err) {
      console.warn('Direct questions fetch error:', err);
    }

    let testLinkedQuestions = [];
    try {
      const { data: tests, error: testErr } = await supabase
        .from('tests')
        .select('id')
        .eq('chapter_id', chapter.id)
        .in('status', ['published', 'live', 'available']);

      if (testErr) {
        console.warn('Error fetching chapter tests for practice:', testErr);
      } else if (tests && tests.length > 0) {
        const testIds = tests.map((t) => t.id).filter(Boolean);
        if (testIds.length > 0) {
          const { data: tqRows, error: tqErr } = await supabase
            .from('test_questions')
            .select('*, questions(*)')
            .in('test_id', testIds);

          if (tqErr) {
            console.warn('Error fetching test_questions with join, falling back to id lookup:', tqErr);
            const { data: fallbackTqRows } = await supabase
              .from('test_questions')
              .select('*')
              .in('test_id', testIds);
            if (fallbackTqRows && fallbackTqRows.length > 0) {
              const questionIds = Array.from(new Set(fallbackTqRows.map((r) => r.question_id).filter(Boolean)));
              if (questionIds.length > 0) {
                const { data: testQuestions, error: tqQuestionsErr } = await supabase
                  .from('questions')
                  .select('*')
                  .in('id', questionIds)
                  .eq('status', 'published');

                if (tqQuestionsErr) {
                  console.warn('Error fetching test-linked questions:', tqQuestionsErr);
                } else {
                  testLinkedQuestions = testQuestions || [];
                }
              }
            }
          } else if (tqRows && tqRows.length > 0) {
            const joinedQuestions = [];
            const missingQIds = [];
            tqRows.forEach((r) => {
              if (r.questions) {
                const q = Array.isArray(r.questions) ? r.questions[0] : r.questions;
                if (q && (q.status === 'published' || !q.status)) {
                  joinedQuestions.push(q);
                }
              } else if (r.question_id) {
                missingQIds.push(r.question_id);
              }
            });
            if (missingQIds.length > 0) {
              const { data: extraQs } = await supabase
                .from('questions')
                .select('*')
                .in('id', Array.from(new Set(missingQIds)))
                .eq('status', 'published');
              if (extraQs) joinedQuestions.push(...extraQs);
            }
            testLinkedQuestions = joinedQuestions;
          }
        }
      }
    } catch (err) {
      console.warn('Test questions fetch error:', err);
    }

    const questionMap = new Map();
    directQuestions.forEach((q) => {
      if (q && q.id) questionMap.set(q.id, q);
    });
    testLinkedQuestions.forEach((q) => {
      if (q && q.id) questionMap.set(q.id, q);
    });

    const combined = Array.from(questionMap.values());
    combined.sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    return combined.map(sanitizeLiveQuestion);
  };

  useEffect(() => {
    let active = true;
    if (!supabase || !chapter?.id || !hasPractice || isComingSoon) return;
    fetchChapterPracticeQuestions()
      .then((qs) => {
        if (active) {
          setPracticeQuestionsCount(qs.length);
          setPracticeQuestions(qs);
        }
      })
      .catch((e) => console.warn('Practice questions prefetch note:', e));
    return () => { active = false; };
  }, [chapter?.id, hasPractice, isComingSoon]);

  const handleStartPractice = async () => {
    if (isLocked) {
      setNotice(language === 'hi' ? 'अभ्यास अनलॉक करने के लिए कृपया अध्याय खरीदें।' : 'Please unlock this chapter to start question practice.');
      return;
    }
    setPracticeLoading(true);
    setNotice('');
    try {
      let qs = practiceQuestions;
      if (!qs || qs.length === 0) {
        qs = await fetchChapterPracticeQuestions();
        setPracticeQuestions(qs);
        setPracticeQuestionsCount(qs.length);
      }
      if (!qs || qs.length === 0) {
        setNotice(t('chapterPracticePending'));
        return;
      }
      setPracticeActive(true);
    } catch (err) {
      console.error('Error starting practice:', err);
      setNotice('Unable to load practice questions at this moment.');
    } finally {
      setPracticeLoading(false);
    }
  };

  const toggleBookmark = async (resource = null) => {
    if (!user || !supabase) {
      setResourceNotice(t('signInToBookmark'));
      return;
    }
    const busyKey = resource?.id || 'chapter';
    setBookmarkBusy(busyKey);
    setResourceNotice('');
    try {
      const existing = bookmarks.find((bookmark) => resource
        ? bookmark.resource_id === resource.id
        : !bookmark.resource_id && bookmark.chapter_id === chapter.id);
      if (existing) {
        const { error: deleteError } = await supabase.from('student_bookmarks').delete().eq('id', existing.id).eq('user_id', user.id);
        if (deleteError) throw deleteError;
        setBookmarks((current) => current.filter((bookmark) => bookmark.id !== existing.id));
        setNotice(resource ? '' : t('chapterRemoved'));
      } else {
        const { data, error: insertError } = await supabase.from('student_bookmarks')
          .insert({ user_id: user.id, chapter_id: chapter.id, resource_id: resource?.id || null })
          .select('*').single();
        if (insertError) throw insertError;
        setBookmarks((current) => [...current, data]);
        setNotice(resource ? '' : t('chapterSaved'));
      }
    } catch (bookmarkError) {
      setResourceNotice(bookmarkError.message || 'Unable to update your bookmark.');
    } finally {
      setBookmarkBusy('');
    }
  };

  const openResource = async (resource) => {
    setReaderLoading(resource.id);
    setResourceNotice('');
    try {
      const { data: file, error: fileError } = await supabase.from('chapter_resources')
        .select('file_url')
        .eq('id', resource.id)
        .single();
      if (fileError) throw fileError;
      const fileUrl = file.file_url;
      if (!fileUrl) throw new Error('This resource does not have a document URL yet.');
      let url = fileUrl;
      if (!/^https?:\/\//i.test(fileUrl)) {
        const { data, error: urlError } = await supabase.storage
          .from('chapter-resources')
          .createSignedUrl(fileUrl, 300);
        if (urlError) throw urlError;
        url = data.signedUrl;
      }
      setReader({ resource, url });
    } catch (openError) {
      setResourceNotice(openError.message || 'Unable to open this document.');
    } finally {
      setReaderLoading('');
    }
  };

  useEffect(() => {
    let active = true;
    setTestsError('');
    setTestAttempts({});
    const loadTests = async () => {
      if (!supabase || !chapter?.id || !hasTests || isLocked) {
        setChapterTests([]);
        if (!supabase && chapter?.id && hasTests) setTestsError('Connect to Zyvra to load chapter tests.');
        setTestsLoading(false);
        return;
      }
      const { data, error: loadError } = await supabase.from('tests')
        .select('id,title,instructions,pattern,duration_minutes,attempt_limit,coin_reward_enabled,status')
        .eq('chapter_id', chapter.id)
        .in('status', ['published', 'live', 'available'])
        .order('created_at', { ascending: true });
      if (loadError) throw loadError;
      if (!active) return;
      const availableTests = data || [];
      setChapterTests(availableTests);
      if (user && availableTests.length) {
        const testIds = availableTests.map((test) => test.id);
        const [counts, pausedAttemptsResult] = await Promise.all([
          Promise.all(availableTests.map(async (test) => {
            const { count, error: countError } = await supabase.from('test_attempts').select('id', { count: 'exact', head: true })
              .eq('test_id', test.id).eq('user_id', user.id);
            if (countError) throw countError;
            return [test.id, count || 0];
          })),
          supabase.from('test_attempts')
            .select('id, test_id, status, remaining_seconds, current_question_index, state_json, updated_at')
            .eq('user_id', user.id)
            .in('test_id', testIds)
            .in('status', ['paused', 'in_progress'])
            .is('completed_at', null)
            .order('updated_at', { ascending: false })
        ]);
        if (active) setTestAttempts(Object.fromEntries(counts));

        const pausedRows = pausedAttemptsResult?.data || [];
        const resumeMap = {};
        availableTests.forEach((test) => {
          const dbAttempt = pausedRows.find((a) => a.test_id === test.id);
          let localSnapshot = null;
          try {
            const raw = localStorage.getItem(`zyvra_test_progress_${user.id}_${test.id}`)
              || localStorage.getItem(`zyvra-paused-attempt-${user.id}-${test.id}`);
            if (raw) localSnapshot = JSON.parse(raw);
          } catch (_) {}

          if (dbAttempt || localSnapshot) {
            const remSecs = localSnapshot?.remainingSeconds ?? dbAttempt?.remaining_seconds ?? (Number(test.duration_minutes || 60) * 60);
            const rawAns = localSnapshot?.answers || localSnapshot?.responses || dbAttempt?.state_json?.responses || dbAttempt?.state_json?.answers || {};
            const answeredCount = Object.values(rawAns).filter((a) => (typeof a === 'object' ? a?.selected_option : a)).length;
            resumeMap[test.id] = {
              attemptId: dbAttempt?.id || localSnapshot?.attemptId,
              remainingSeconds: remSecs,
              answeredCount,
              currentIndex: localSnapshot?.currentIndex ?? dbAttempt?.current_question_index ?? 0
            };
          }
        });
        if (active) setResumeAttempts(resumeMap);
      }
      if (active) setTestsLoading(false);
    };
    setTestsLoading(true);
    loadTests().catch((loadError) => {
      if (active) {
        setTestsError(loadError.message || 'Unable to load tests for this chapter.');
        setTestsLoading(false);
      }
    });
    return () => { active = false; };
  }, [chapter?.id, hasTests, user, isLocked]);

  return (
    <div className="min-h-screen dark:bg-[#04140e] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 pb-28 md:pb-12 transition-colors">
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-emerald-400/80 overflow-x-auto no-scrollbar py-1">
          <Link to="/explore" className="hover:text-emerald-700 dark:hover:text-white whitespace-nowrap">
            {t('exploreExams')}
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
          {folderPath.map((item) => (
            <span className="flex items-center gap-1.5 whitespace-nowrap" key={item.id}>
              <Link to={`/folder/${item.id}`} className="hover:text-emerald-700 dark:hover:text-white">
                {item.title}
              </Link>
              <ChevronRight size={13} className="shrink-0 text-slate-400" />
            </span>
          ))}
          <span className="dark:text-white text-slate-900 font-extrabold truncate">
            {chapter?.title || t('chapter')}
          </span>
        </nav>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {loading && <LoadingSkeleton rows={4} />}

        {!loading && !error && (!chapter || !folder || !exam || !hierarchyPublished) && (
          <div className="p-8 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-3">
            <BookOpen size={30} className="mx-auto text-emerald-500 opacity-60" />
            <strong className="text-base font-black dark:text-white text-slate-900 block">
              This chapter isn’t available.
            </strong>
            <span className="text-xs text-slate-500 dark:text-emerald-300/80 block">
              It may be unpublished or its folder has changed.
            </span>
            <Link
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold"
              to="/explore"
            >
              <ArrowLeft size={15} /> <span>Explore exams</span>
            </Link>
          </div>
        )}

        {!loading && !error && chapter && folder && exam && hierarchyPublished && (
          <>
            {/* Chapter Hero Section */}
            <section className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#07261b] dark:to-[#04140e] bg-gradient-to-br from-emerald-100/90 via-teal-50 to-white border dark:border-emerald-500/25 border-emerald-200 p-4 sm:p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl dark:bg-emerald-950/80 bg-white border dark:border-emerald-500/30 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xs">
                    <BookOpen size={18} />
                  </div>
                  <span className="text-xs font-bold dark:text-emerald-300/80 text-emerald-800">
                    {exam.title} • {folder.title}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isLocked
                      ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40'
                      : 'bg-[#22c55e]/20 text-emerald-700 dark:text-emerald-300 border border-[#22c55e]/30'
                  }`}
                >
                  {isLocked ? t('paidAccess') : t('freeToExplore')}
                </span>
              </div>

              <div>
                <h1 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {chapter.title}
                </h1>
                <p className="text-xs sm:text-sm dark:text-emerald-200/80 text-slate-600 font-medium mt-1 leading-relaxed">
                  {chapter.description ||
                    (language === 'hi'
                      ? 'केंद्रित अध्ययन, अभ्यास और दोहराव से विषय को स्पष्ट रूप से समझें।'
                      : 'Build a clear understanding with focused learning, practice and review.')}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                <span className="px-2.5 py-0.5 rounded-full dark:bg-emerald-950 bg-emerald-100/80 text-emerald-800 dark:text-emerald-300 font-bold border dark:border-emerald-500/20 border-emerald-200">
                  {chapter.subject || (language === 'hi' ? 'सामान्य' : 'General')}
                </span>
                <span className="flex items-center gap-1 dark:text-emerald-300/80 text-slate-500 font-semibold">
                  <Clock3 size={13} />
                  <span>
                    {chapter.estimated_study_time_minutes || '—'}{' '}
                    {language === 'hi' ? 'मिनट अध्ययन समय' : t('studyTime')}
                  </span>
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {access.label === 'Coming Soon' ? t('chapterComingSoon') : access.label}
                </span>
              </div>
            </section>

            {/* Tab Bar */}
            <div
              className="flex items-center gap-1.5 p-1 rounded-2xl dark:bg-[#072117]/85 bg-white border dark:border-emerald-500/20 border-slate-200 shadow-sm"
              role="tablist"
              aria-label={t('chapterContent')}
            >
              {tabs.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 py-2 sm:py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all min-h-[40px] ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-glowGold'
                        : 'dark:text-emerald-300/80 text-slate-600 hover:text-black dark:hover:text-white'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{t(label)}</span>
                  </button>
                );
              })}
            </div>

            {notice && (
              <div className="p-3 rounded-2xl dark:bg-emerald-950/80 bg-emerald-50 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                {notice}
              </div>
            )}
            {accessError && (
              <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
                {accessError}
              </div>
            )}

            {/* Paywall Banner if Locked */}
            {isLocked && (
              <section className="p-4 sm:p-5 rounded-2xl dark:bg-gradient-to-r dark:from-amber-950/40 dark:to-emerald-950/40 bg-amber-50/90 border dark:border-amber-500/30 border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-500 shrink-0">
                    <LockKeyhole size={18} />
                  </div>
                  <div>
                    <strong className="text-sm font-black dark:text-white text-slate-900 block">
                      {t('fullAccess')} {`₹${access.amount.toLocaleString('en-IN')}`}
                    </strong>
                    <span className="text-xs text-amber-900/80 dark:text-amber-200/80 font-medium">
                      {t('unlockChapterCopy')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-black text-xs font-black shadow-glowGold flex items-center justify-center gap-1.5 min-h-[44px]"
                    disabled={!user || accessLoading}
                    onClick={() =>
                      setCheckoutItem({
                        itemType: 'chapter',
                        itemId: chapter.id,
                        itemTitle: chapter.title,
                        tier: 'Chapter',
                        basePrice: access.amount
                      })
                    }
                  >
                    <span>{accessLoading ? t('checkingAccess') : `Buy Chapter · ₹${access.amount}`}</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </section>
            )}

            {/* Tab 1: Tests */}
            {activeTab === 'tests' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      {t('checkUnderstanding')}
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">{t('chapterTests')}</h2>
                  </div>
                  <span className="text-xs font-bold dark:text-emerald-300 text-emerald-800">
                    {chapterTests.length} {t('available')}
                  </span>
                </div>

                {!hasTests ? (
                  <div className="p-8 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-2">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('testsUnavailable')}</strong>
                    <span className="text-xs text-slate-500 dark:text-emerald-300/80">{t('chooseAnotherTab')}</span>
                  </div>
                ) : isLocked ? (
                  <div className="p-8 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-2">
                    <LockKeyhole size={24} className="mx-auto text-amber-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('unlockLiveTests')}</strong>
                    <span className="text-xs text-slate-500 dark:text-emerald-300/80">{t('freePreviewsNotes')}</span>
                  </div>
                ) : testsLoading ? (
                  <p className="text-xs dark:text-emerald-300 text-slate-600 font-medium">{t('loadingTests')}</p>
                ) : testsError ? (
                  <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold">
                    {testsError}
                  </div>
                ) : !chapterTests.length ? (
                  <div className="p-8 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-2">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('noPublishedTests')}</strong>
                    <span className="text-xs text-slate-500 dark:text-emerald-300/80">{t('checkBackPractice')}</span>
                  </div>
                ) : (
                  chapterTests.map((test) => {
                    const attempts = testAttempts[test.id] || 0;
                    const limit = Number(test.attempt_limit || 1);
                    const pausedInfo = resumeAttempts[test.id];
                    const hasIncomplete = Boolean(pausedInfo);
                    const exhausted = user && !hasIncomplete && attempts >= limit;

                    return (
                      <div
                        key={test.id}
                        className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">
                              {test.title}
                            </strong>
                            <span className="text-[11px] dark:text-emerald-300/70 text-slate-500">
                              {test.duration_minutes} {language === 'hi' ? 'मिनट' : 'min'} • {attempts}/{limit}{' '}
                              {t('attemptsUsed')}
                            </span>
                          </div>
                        </div>

                        <Link
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 min-h-[44px] transition-all ${
                            exhausted
                              ? 'dark:bg-emerald-950 bg-slate-100 text-slate-400 border border-slate-300 pointer-events-none'
                              : 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-glowGold hover:from-amber-300'
                          }`}
                          onClick={(event) => {
                            if (exhausted || !user) {
                              event.preventDefault();
                              setNotice(exhausted ? t('limitReached') : t('signInToStartTest'));
                              return;
                            }
                            sessionStorage.setItem('last_quiz_return_url', location.pathname);
                          }}
                          to={exhausted || !user ? '#' : `/quiz/${test.id}`}
                          state={{ returnTo: location.pathname, autoResume: hasIncomplete }}
                        >
                          <span>{hasIncomplete ? (language === 'hi' ? 'टेस्ट जारी रखें' : 'Resume Test') : exhausted ? t('limitReached') : t('startTest')}</span>
                          <Play size={13} />
                        </Link>
                      </div>
                    );
                  })
                )}
              </section>
            )}

            {/* Tab 2: Question Practice */}
            {activeTab === 'practice' && (
              <section className="p-5 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-500 text-lg shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black dark:text-white text-slate-900">
                      {chapter.subject || t('chapter')} {t('questionPractice')}
                    </h3>
                    <p className="text-xs dark:text-emerald-300/80 text-slate-600">
                      {t('reviewKeyConcepts')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs dark:text-emerald-300/80 text-slate-600 flex-wrap">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span>{practiceQuestionsCount > 0 ? `${practiceQuestionsCount} ${t('topicQuestions')}` : t('topicQuestions')}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock3 size={13} className="text-emerald-500" />
                    <span>{t('ownPace')}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen size={13} className="text-emerald-500" />
                    <span>{t('reviewExplanations')}</span>
                  </span>
                </div>

                <button
                  type="button"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-black text-xs font-black shadow-glowGold flex items-center justify-center gap-2 min-h-[44px]"
                  disabled={practiceLoading}
                  onClick={handleStartPractice}
                >
                  {practiceLoading ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />}
                  <span>{t('startPractice')}</span>
                </button>
              </section>
            )}

            {/* Tab 3: Notes & PDFs */}
            {activeTab === 'notes' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      {t('readReviseRemember').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">{t('notesPdfs')}</h2>
                  </div>
                  <span className="text-xs font-bold dark:text-emerald-300 text-emerald-800">
                    {resources.length} {t('resources')}
                  </span>
                </div>

                {resourcesLoading ? (
                  <p className="text-xs dark:text-emerald-300 text-slate-600 font-medium">{t('loadingResources')}</p>
                ) : !resources.length ? (
                  <div className="p-8 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 text-center space-y-2">
                    <FileText size={24} className="mx-auto text-emerald-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('noPublishedNotes')}</strong>
                    <span className="text-xs text-slate-500 dark:text-emerald-300/80">{t('resourceCheckBack')}</span>
                  </div>
                ) : (
                  resources.map((resource) => {
                    const bookmarked = bookmarks.some((bookmark) => bookmark.resource_id === resource.id);
                    const isPreview = Boolean(resource.is_free_preview);
                    const isDownloadable = Boolean(resource.is_downloadable);
                    const canRead = isPreview || (isDownloadable && !isLocked);

                    return (
                      <article
                        key={resource.id}
                        className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                              {resource.title}
                            </strong>
                            <div className="text-[11px] dark:text-emerald-300/70 text-slate-500 flex items-center gap-2">
                              {resource.file_size && <span>{resource.file_size}</span>}
                              {resource.page_count && <span>{resource.page_count} {t('pages')}</span>}
                              <span className={canRead ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 font-bold'}>
                                {isPreview ? t('freePreview') : canRead ? t('downloadAllowed') : t('locked')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="w-9 h-9 rounded-xl dark:bg-emerald-950/80 bg-slate-100 flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-colors"
                            disabled={bookmarkBusy === resource.id}
                            onClick={() => toggleBookmark(resource)}
                          >
                            {bookmarked ? <BookmarkCheck size={16} className="text-[#22c55e]" /> : <Bookmark size={16} />}
                          </button>

                          <button
                            type="button"
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 min-h-[38px] ${
                              canRead
                                ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-glowGold'
                                : 'dark:bg-emerald-950 bg-slate-100 text-slate-400 border border-slate-300'
                            }`}
                            disabled={!canRead || readerLoading === resource.id}
                            onClick={() => openResource(resource)}
                          >
                            {!canRead ? <LockKeyhole size={13} /> : <BookOpen size={13} />}
                            <span>{readerLoading === resource.id ? t('opening') : canRead ? t('readDocument') : t('locked')}</span>
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            )}

            {/* Back link */}
            <div className="pt-2">
              <Link
                to={`/folder/${folder.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold dark:text-emerald-400 text-emerald-800 hover:underline min-h-[44px]"
              >
                <ArrowLeft size={14} /> <span>Back to {folder.title}</span>
              </Link>
            </div>
          </>
        )}

        {reader && <PdfReaderModal resource={reader.resource} url={reader.url} onClose={() => setReader(null)} />}
        {checkoutItem && (
          <CheckoutModal
            {...checkoutItem}
            onClose={() => setCheckoutItem(null)}
            onCompleted={() => setAccessRefreshKey((value) => value + 1)}
          />
        )}
        {practiceActive && practiceQuestions.length > 0 && (
          <QuestionPracticeModal
            questions={practiceQuestions}
            chapterTitle={chapter.title}
            subject={chapter.subject}
            onClose={() => setPracticeActive(false)}
          />
        )}
      </div>
    </div>
  );
}
