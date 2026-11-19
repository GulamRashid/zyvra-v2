import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, BookOpen, CheckCircle2,
  ChevronRight, Clock3, FileText, LoaderCircle, LockKeyhole, Play, Sparkles
} from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import PdfReaderModal from '../../components/common/PdfReaderModal';
import CheckoutModal from '../../components/common/CheckoutModal';
import QuestionPracticeModal from '../../components/common/QuestionPracticeModal';
import useContentCatalog from '../../hooks/useContentCatalog';
import { getChapterAccess, getFolderPath, getFolderPricing, isFolderUnlocked, isPublished } from '../../lib/content';
import useContentAccess from '../../hooks/useContentAccess';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import { supabase } from '../../lib/supabase';
import { sanitizeLiveQuestion } from '../../lib/tests';
import { prefetchLiveQuiz } from '../../lib/prefetchLiveQuiz';
import { getFriendlyErrorMessage } from '../../lib/errors';

export default function ChapterDetail() {
  const { chapterId } = useParams();
  const location = useLocation();
  const { exams, folders, chapters, loading, error } = useContentCatalog();
  const { user } = useAuth();
  const { t, language } = useThemeLanguage();
  const [activeTab, setActiveTab] = useState('practice');
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

  const practiceSets = useMemo(() => {
    return chapterTests.filter((t) => t.solution_mode === 'immediate');
  }, [chapterTests]);

  const mockTests = useMemo(() => {
    return chapterTests.filter((t) => t.solution_mode !== 'immediate');
  }, [chapterTests]);

  const tabsList = useMemo(() => [
    {
      id: 'practice',
      label: language === 'hi' ? 'अभ्यास सेट्स' : 'Practice Sets',
      count: practiceSets.length || (practiceQuestionsCount > 0 ? 1 : 0),
      icon: Sparkles
    },
    {
      id: 'tests',
      label: language === 'hi' ? 'मॉक टेस्ट' : 'Mock Tests',
      count: mockTests.length,
      icon: Clock3
    },
    {
      id: 'notes',
      label: language === 'hi' ? 'नोट्स एवं PDF' : 'Notes & PDFs',
      count: resources.length,
      icon: FileText
    }
  ], [language, practiceSets.length, practiceQuestionsCount, mockTests.length, resources.length]);

  const [checkoutItem, setCheckoutItem] = useState(null);
  const [accessRefreshKey, setAccessRefreshKey] = useState(0);
  const warmQuiz = useCallback(() => {
    prefetchLiveQuiz().catch((error) => console.warn('Unable to prefetch quiz:', error));
  }, []);
  const chapter = chapters.find((item) => item.id === chapterId && isPublished(item));
  const folder = folders.find((item) => item.id === chapter?.folder_id && isPublished(item));
  const exam = exams.find((item) => item.id === folder?.exam_id && isPublished(item));
  const folderPath = useMemo(() => (folder ? getFolderPath(folder, folders) : []), [folder, folders]);
  const hierarchyPublished = folderPath.every(isPublished);
  const access = getChapterAccess(chapter, folder, folders);
  const examPrice = Number(exam?.price || 0);
  const examIsPaid = examPrice > 0 || exam?.access_mode === 'paid-own' || exam?.access_mode === 'paid_own' || exam?.pricing_mode === 'paid-own' || exam?.pricing_mode === 'paid_own';

  const accessItems = useMemo(() => [
    ...(exam && examIsPaid ? [{ type: 'exam', id: exam.id, paid: true }] : []),
    ...folderPath.filter((p) => getFolderPricing(p, folders).amount > 0).map((p) => ({ type: 'folder', id: p.id, paid: true })),
    ...(access.amount > 0 && chapter ? [{ type: 'chapter', id: chapter.id, paid: true }] : [])
  ], [exam, examIsPaid, folderPath, access.amount, chapter, folders]);

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
    let cancelled = false;
    const prefetch = () => {
      if (!cancelled) warmQuiz();
    };
    const idleId = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(prefetch, { timeout: 1500 })
      : window.setTimeout(prefetch, 800);
    return () => {
      cancelled = true;
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [warmQuiz]);

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
        setResourcesError(getFriendlyErrorMessage(loadError, 'Unable to load chapter resources.'));
        setResourcesLoading(false);
      }
    });
    return () => { active = false; };
  }, [chapter?.id, hasNotes, isComingSoon, user]);

  const fetchChapterPracticeQuestions = useCallback(async () => {
    if (!supabase || !chapter?.id) return [];

    const { data, error } = await supabase.rpc('get_practice_questions', {
      p_chapter_id: chapter.id
    });
    if (error) {
      console.warn('Unable to load secure practice questions:', error);
      return [];
    }
    const rows = Array.isArray(data) ? data : data?.questions;
    return (Array.isArray(rows) ? rows : []).map(sanitizeLiveQuestion);
  }, [chapter?.id]);

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
  }, [chapter?.id, hasPractice, isComingSoon, fetchChapterPracticeQuestions]);

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
      setNotice(t('signInToBookmark'));
      return;
    }
    const busyKey = resource?.id || 'chapter';
    setBookmarkBusy(busyKey);
    setNotice('');
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
      setNotice(getFriendlyErrorMessage(bookmarkError, 'Unable to update your bookmark.'));
    } finally {
      setBookmarkBusy('');
    }
  };

  const openResource = async (resource) => {
    setReaderLoading(resource.id);
    setNotice('');
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
      setNotice(getFriendlyErrorMessage(openError, 'Unable to open this document.'));
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
        .select('id,title,instructions,pattern,duration_minutes,attempt_limit,coin_reward_enabled,status,solution_mode')
        .eq('chapter_id', chapter.id)
        .in('status', ['published', 'live', 'available'])
        .order('created_at', { ascending: true });
      if (loadError) throw loadError;
      if (!active) return;
      const availableTests = data || [];
      setChapterTests(availableTests);
      if (user && availableTests.length) {
        const testIds = availableTests.map((test) => test.id);
        const [attemptsCountResult, pausedAttemptsResult] = await Promise.all([
          supabase.from('test_attempts')
            .select('test_id')
            .eq('user_id', user.id)
            .in('test_id', testIds),
          supabase.from('test_attempts')
            .select('id, test_id, status, remaining_seconds, current_question_index, state_json, updated_at')
            .eq('user_id', user.id)
            .in('test_id', testIds)
            .in('status', ['paused', 'in_progress'])
            .is('completed_at', null)
            .order('updated_at', { ascending: false })
        ]);
        if (attemptsCountResult.error) throw attemptsCountResult.error;

        const countMap = {};
        testIds.forEach((id) => { countMap[id] = 0; });
        (attemptsCountResult.data || []).forEach((row) => {
          countMap[row.test_id] = (countMap[row.test_id] || 0) + 1;
        });
        if (active) setTestAttempts(countMap);

        const pausedRows = pausedAttemptsResult?.data || [];
        const resumeMap = {};
        availableTests.forEach((test) => {
          const dbAttempt = pausedRows.find((a) => a.test_id === test.id);
          let localSnapshot = null;
          try {
            const raw = localStorage.getItem(`zyvra_test_progress_${user.id}_${test.id}`)
              || localStorage.getItem(`zyvra-paused-attempt-${user.id}-${test.id}`);
            if (raw) localSnapshot = JSON.parse(raw);
          } catch { /* ignore invalid local snapshot */ }

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
        setTestsError(getFriendlyErrorMessage(loadError, 'Unable to load tests for this chapter.'));
        setTestsLoading(false);
      }
    });
    return () => { active = false; };
  }, [chapter?.id, hasTests, user, isLocked]);

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      <div className="max-w-3xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-indigo-400/80 overflow-x-auto no-scrollbar py-1">
          <Link to="/explore" className="hover:text-indigo-600 dark:hover:text-white whitespace-nowrap">
            {t('exploreExams')}
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
          {folderPath.map((item) => (
            <span className="flex items-center gap-1.5 whitespace-nowrap" key={item.id}>
              <Link to={`/folder/${item.id}`} className="hover:text-indigo-600 dark:hover:text-white">
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
          <div className="p-8 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-3">
            <BookOpen size={30} className="mx-auto text-indigo-500 opacity-60" />
            <strong className="text-base font-black dark:text-white text-slate-900 block">
              This chapter isn’t available.
            </strong>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              It may be unpublished or its folder has changed.
            </span>
            <Link
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white text-sm font-black"
              to="/explore"
            >
              <ArrowLeft size={15} /> <span>Explore exams</span>
            </Link>
          </div>
        )}

        {!loading && !error && chapter && folder && exam && hierarchyPublished && (
          <>
            {/* Chapter Hero Section with Focus Tech Theme */}
            <section className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50/90 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200 p-4 sm:p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl dark:bg-indigo-950/80 bg-white border dark:border-indigo-500/30 border-indigo-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                    <BookOpen size={18} />
                  </div>
                  <span className="text-xs font-bold dark:text-indigo-300 text-indigo-800">
                    {exam.title} • {folder.title}
                  </span>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isLocked
                      ? 'bg-amber-400/20 text-amber-700 dark:text-amber-300 border border-amber-400/40'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {accessLoading ? t('checkingAccess') : isLocked ? t('paidAccess') : t('freeToExplore')}
                </span>
              </div>

              <div>
                <h1 className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {chapter.title}
                </h1>
                <p className="text-sm dark:text-slate-300 text-slate-600 font-medium mt-1 leading-relaxed">
                  {chapter.description ||
                    (language === 'hi'
                      ? 'केंद्रित अध्ययन, अभ्यास और दोहराव से विषय को स्पष्ट रूप से समझें।'
                      : 'Build a clear understanding with focused learning, practice and review.')}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-1 text-sm">
                <span className="px-2.5 py-0.5 rounded-full dark:bg-indigo-500/10 bg-indigo-50 text-indigo-700 dark:text-indigo-300 font-bold border dark:border-indigo-500/20 border-indigo-200">
                  {chapter.subject || (language === 'hi' ? 'सामान्य' : 'General')}
                </span>
                <span className="flex items-center gap-1 dark:text-slate-400 text-slate-500 font-semibold">
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

            {/* Tab Bar with Distinct Color Identity for Test vs Practice vs Notes */}
            <div
              className="flex items-center gap-1.5 p-1 rounded-2xl dark:bg-[#1E293B]/85 bg-white border dark:border-slate-700/60 border-slate-200 shadow-sm"
              role="tablist"
              aria-label={t('chapterContent')}
            >
              {tabsList.map(({ id, label, count, icon: Icon }) => {
                const isActive = activeTab === id;
                let activeStyle = 'bg-indigo-600 text-white shadow-sm border-indigo-400/30';
                if (id === 'practice') {
                  activeStyle = 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm border-emerald-400/30';
                } else if (id === 'tests') {
                  activeStyle = 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm border-indigo-400/30';
                } else if (id === 'notes') {
                  activeStyle = 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-sm border-amber-400/30';
                }

                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 py-2 sm:py-2.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all min-h-[44px] border ${
                      isActive
                        ? activeStyle
                        : 'border-transparent dark:text-slate-400 text-slate-600 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                    {typeof count === 'number' && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'dark:bg-slate-800 bg-slate-200/80 dark:text-slate-300 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Clear Mode Explainer Banner */}
            <div className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 ${
              activeTab === 'practice'
                ? 'dark:bg-emerald-950/30 bg-emerald-50/80 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                : activeTab === 'tests'
                ? 'dark:bg-indigo-950/30 bg-indigo-50/80 border-indigo-500/30 text-indigo-800 dark:text-indigo-200'
                : 'dark:bg-amber-950/30 bg-amber-50/80 border-amber-500/30 text-amber-800 dark:text-amber-200'
            }`}>
              <div className="shrink-0 text-lg">
                {activeTab === 'practice' ? '🎯' : activeTab === 'tests' ? '⏱️' : '📄'}
              </div>
              <div className="min-w-0">
                <span className="font-black block uppercase tracking-wider text-[10px]">
                  {activeTab === 'practice'
                    ? (language === 'hi' ? 'सेल्फ-पेस्ड प्रैक्टिस मोड (Practice Mode)' : 'Self-Paced Practice Mode')
                    : activeTab === 'tests'
                    ? (language === 'hi' ? 'टाइम-बाउंड मॉक टेस्ट मोड (Real Exam Mode)' : 'Timed Exam Simulation Mode')
                    : (language === 'hi' ? 'रिवीजन नोट्स एवं PDF मोड (Study Handouts)' : 'Revision Notes & Handouts')}
                </span>
                <span className="text-[11px] opacity-90 block mt-0.5">
                  {activeTab === 'practice'
                    ? (language === 'hi' ? 'हर सवाल का तुरंत समाधान देखें। कोई टाइमर का दबाव नहीं, गहरी समझ बनाएं।' : 'Instant solutions after every question. No timer stress — learn with deep concept clarity.')
                    : activeTab === 'tests'
                    ? (language === 'hi' ? 'परीक्षा हॉल जैसे टाइमर और नेगेटिव मार्किंग के साथ टेस्ट दें और अपनी रैंक देखें।' : 'Timed countdown, negative marking, and detailed rank analytics after submission.')
                    : (language === 'hi' ? 'परीक्षा से पहले त्वरित रिवीजन के लिए महत्वपूर्ण सूत्र, तथ्य और PDF नोट्स पढ़ें।' : 'Key formulas, facts and PDF notes for rapid revision before the exam.')}
                </span>
              </div>
            </div>

            {notice && (
              <div className="p-3 rounded-2xl dark:bg-indigo-950/40 bg-indigo-50 border border-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-xs font-bold">
                {notice}
              </div>
            )}
            {accessError && (
              <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
                {accessError}
              </div>
            )}

            {/* Paywall Banner if Locked */}
            {isLocked && !accessLoading && !accessError && (
              <section className="p-4 sm:p-5 rounded-2xl dark:bg-gradient-to-r dark:from-amber-950/40 dark:to-slate-800/60 bg-amber-50/90 border dark:border-amber-500/30 border-amber-300/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
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

            {/* Tab 1: Practice Sets */}
            {activeTab === 'practice' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      {language === 'hi' ? 'अपनी गति से सीखें और अभ्यास करें' : 'Learn & Practice at your own pace'}
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">
                      {language === 'hi' ? 'अध्याय अभ्यास सेट्स' : 'Chapter Practice Sets'}
                    </h2>
                  </div>
                  <span className="text-xs font-bold dark:text-slate-300 text-slate-700">
                    {practiceSets.length > 0 ? `${practiceSets.length} ${language === 'hi' ? 'सेट्स उपलब्ध' : 'Sets Available'}` : ''}
                  </span>
                </div>

                {!hasPractice ? (
                  <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                    <Sparkles size={24} className="mx-auto text-emerald-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('practiceUnavailable')}</strong>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('chooseAnotherTab')}</span>
                  </div>
                ) : accessLoading ? (
                  <p className="text-xs dark:text-slate-300 text-slate-600 font-medium">{t('checkingAccess')}</p>
                ) : isLocked ? (
                  <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                    <LockKeyhole size={24} className="mx-auto text-amber-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{language === 'hi' ? 'अभ्यास अनलॉक करें' : 'Unlock Practice'}</strong>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('freePreviewsNotes')}</span>
                  </div>
                ) : testsLoading ? (
                  <p className="text-xs dark:text-slate-300 text-slate-600 font-medium">{language === 'hi' ? 'अभ्यास सेट्स लोड हो रहे हैं...' : 'Loading practice sets...'}</p>
                ) : practiceSets.length > 0 ? (
                  practiceSets.map((test) => {
                    const pausedInfo = resumeAttempts[test.id];
                    const hasIncomplete = Boolean(pausedInfo);

                    return (
                      <div
                        key={test.id}
                        className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-emerald-500/40 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl dark:bg-emerald-500/10 bg-emerald-50 border dark:border-emerald-500/30 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">
                                {test.title}
                              </strong>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                {language === 'hi' ? '⚡ तुरंत समाधान' : '⚡ Instant Solution'}
                              </span>
                            </div>
                            <span className="text-xs dark:text-slate-400 text-slate-500">
                              {language === 'hi' ? '20 प्रश्न • असीमित अभ्यास • नो टाइमर' : '20 Questions • Untimed Practice'}
                            </span>
                          </div>
                        </div>

                        <Link
                          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 min-h-[44px] transition-all ${
                            hasIncomplete
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-sm'
                          }`}
                          onClick={(event) => {
                            if (!user) {
                              event.preventDefault();
                              setNotice(t('signInToStartTest'));
                              return;
                            }
                            sessionStorage.setItem('last_quiz_return_url', location.pathname);
                          }}
                          onMouseEnter={warmQuiz}
                          onTouchStart={warmQuiz}
                          to={!user ? '#' : `/quiz/${test.id}`}
                          state={{ returnTo: location.pathname, autoResume: hasIncomplete }}
                        >
                          <span>
                            {hasIncomplete
                              ? (language === 'hi' ? 'अभ्यास जारी रखें' : 'Resume Practice')
                              : (language === 'hi' ? 'अभ्यास शुरू करें' : 'Start Practice')}
                          </span>
                          <Play size={13} />
                        </Link>
                      </div>
                    );
                  })
                ) : practiceQuestionsCount > 0 ? (
                  <div className="p-5 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-lg shrink-0">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black dark:text-white text-slate-900">
                          {chapter.subject || t('chapter')} {t('questionPractice')}
                        </h3>
                        <p className="text-xs dark:text-slate-400 text-slate-600">
                          {t('reviewKeyConcepts')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm dark:text-slate-400 text-slate-600 flex-wrap">
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
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center justify-center gap-2 min-h-[44px] shadow-sm"
                      disabled={practiceLoading}
                      onClick={handleStartPractice}
                    >
                      {practiceLoading ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />}
                      <span>{t('startPractice')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                    <Sparkles size={24} className="mx-auto text-emerald-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">
                      {language === 'hi' ? 'जल्द आ रहा है: अभ्यास सेट्स' : 'Coming Soon: Practice Sets'}
                    </strong>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'hi' ? 'इस अध्याय के अभ्यास प्रश्न जल्द ही जोड़े जाएँगे।' : 'Practice questions for this chapter will be added soon.'}
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Tab 2: Mock Tests */}
            {activeTab === 'tests' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">
                      {language === 'hi' ? 'परीक्षा हॉल जैसा अनुभव' : 'Timed Exam Simulation'}
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">
                      {language === 'hi' ? 'अध्याय मॉक टेस्ट' : 'Chapter Mock Tests'}
                    </h2>
                  </div>
                  <span className="text-xs font-bold dark:text-slate-300 text-slate-700">
                    {mockTests.length} {language === 'hi' ? 'टेस्ट उपलब्ध' : 'Tests Available'}
                  </span>
                </div>

                {!hasTests ? (
                  <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                    <Clock3 size={24} className="mx-auto text-indigo-400 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('testsUnavailable')}</strong>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('chooseAnotherTab')}</span>
                  </div>
                ) : accessLoading ? (
                  <p className="text-xs dark:text-slate-300 text-slate-600 font-medium">{t('checkingAccess')}</p>
                ) : accessError ? (
                  <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold">{accessError}</div>
                ) : isLocked ? (
                  <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                    <LockKeyhole size={24} className="mx-auto text-amber-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('unlockLiveTests')}</strong>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('freePreviewsNotes')}</span>
                  </div>
                ) : testsLoading ? (
                  <p className="text-xs dark:text-slate-300 text-slate-600 font-medium">{t('loadingTests')}</p>
                ) : testsError ? (
                  <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-bold">
                    {testsError}
                  </div>
                ) : !mockTests.length ? (
                  <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                    <Clock3 size={24} className="mx-auto text-indigo-400 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">
                      {language === 'hi' ? 'अभी कोई टाइम्ड मॉक टेस्ट निर्धारित नहीं है' : 'No timed mock tests scheduled yet'}
                    </strong>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'hi' ? 'प्रश्नों को तुरंत हल करने के लिए "अभ्यास सेट्स" टैब देखें।' : 'Check the "Practice Sets" tab to practice with instant solutions.'}
                    </span>
                  </div>
                ) : (
                  mockTests.map((test) => {
                    const attempts = testAttempts[test.id] || 0;
                    const limit = Number(test.attempt_limit || 1);
                    const pausedInfo = resumeAttempts[test.id];
                    const hasIncomplete = Boolean(pausedInfo);
                    const exhausted = user && !hasIncomplete && attempts >= limit;

                    return (
                      <div
                        key={test.id}
                        className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl dark:bg-indigo-500/10 bg-indigo-50 border dark:border-indigo-500/20 border-indigo-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Clock3 size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block">
                                {test.title}
                              </strong>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                                {language === 'hi' ? 'टाइम्ड टेस्ट' : 'Timed Mock'}
                              </span>
                            </div>
                            <span className="text-xs dark:text-slate-400 text-slate-500">
                              {test.duration_minutes} {language === 'hi' ? 'मिनट' : 'min'} • {attempts}/{limit}{' '}
                              {t('attemptsUsed')}
                            </span>
                          </div>
                        </div>

                        <Link
                          className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 min-h-[44px] transition-all ${
                            exhausted
                              ? 'dark:bg-slate-800 bg-slate-100 text-slate-400 border border-slate-300 pointer-events-none'
                              : hasIncomplete
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold shadow-sm'
                          }`}
                          onClick={(event) => {
                            if (exhausted || !user) {
                              event.preventDefault();
                              setNotice(exhausted ? t('limitReached') : t('signInToStartTest'));
                              return;
                            }
                            sessionStorage.setItem('last_quiz_return_url', location.pathname);
                          }}
                          onMouseEnter={warmQuiz}
                          onTouchStart={warmQuiz}
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

            {/* Tab 3: Notes & PDFs */}
            {activeTab === 'notes' && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                      {t('readReviseRemember').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">{t('notesPdfs')}</h2>
                  </div>
                  <span className="text-xs font-bold dark:text-slate-300 text-slate-700">
                    {resources.length} {t('resources')}
                  </span>
                </div>

                {resourcesLoading ? (
                  <p className="text-xs dark:text-slate-400 text-slate-600 font-medium">{t('loadingResources')}</p>
                ) : resourcesError ? (
                  <p className="text-xs text-rose-500 font-medium">{resourcesError}</p>
                ) : !resources.length ? (
                  <div className="p-8 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 text-center space-y-2">
                    <FileText size={24} className="mx-auto text-indigo-400 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">{t('noPublishedNotes')}</strong>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{t('resourceCheckBack')}</span>
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
                        className="p-3.5 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl dark:bg-indigo-500/10 bg-indigo-50 border dark:border-indigo-500/20 border-indigo-200 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0">
                            <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                              {resource.title}
                            </strong>
                            <div className="text-sm dark:text-slate-400 text-slate-500 flex items-center gap-2">
                              {resource.file_size && <span>{resource.file_size}</span>}
                              {resource.page_count && <span>{resource.page_count} {t('pages')}</span>}
                              <span className={canRead ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-amber-500 font-bold'}>
                                {isPreview ? t('freePreview') : canRead ? t('downloadAllowed') : t('locked')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="w-9 h-9 rounded-xl dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-500 hover:text-amber-500 transition-colors"
                            disabled={bookmarkBusy === resource.id}
                            onClick={() => toggleBookmark(resource)}
                          >
                            {bookmarked ? <BookmarkCheck size={16} className="text-amber-500" /> : <Bookmark size={16} />}
                          </button>

                          <button
                            type="button"
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 min-h-[44px] ${
                              canRead
                                ? 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white shadow-glowIndigo'
                                : 'dark:bg-slate-800 bg-slate-100 text-slate-400 border border-slate-300'
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
                className="inline-flex items-center gap-1.5 text-xs font-bold dark:text-indigo-400 text-indigo-600 hover:underline min-h-[44px]"
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
