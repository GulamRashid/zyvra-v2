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

    // 1. Query public.questions where chapter_id = currentChapterId AND status = 'published'
    const { data: directQuestions, error: directError } = await supabase
      .from('questions')
      .select('*')
      .eq('chapter_id', chapter.id)
      .eq('status', 'published');

    if (directError) {
      console.warn('Error fetching direct chapter questions:', directError);
    }

    // 2. ALSO fetch any published questions linked via test_questions for all published tests belonging to currentChapterId
    const { data: publishedTests, error: testError } = await supabase
      .from('tests')
      .select('id')
      .eq('chapter_id', chapter.id)
      .in('status', ['published', 'live', 'available']);

    let testLinkedQuestions = [];
    if (!testError && publishedTests?.length > 0) {
      const testIds = publishedTests.map((t) => t.id);
      const { data: tqRows, error: tqError } = await supabase
        .from('test_questions')
        .select('question_id')
        .in('test_id', testIds);

      if (!tqError && tqRows?.length > 0) {
        const questionIds = Array.from(new Set(tqRows.map((r) => r.question_id).filter(Boolean)));
        if (questionIds.length > 0) {
          const { data: testQuestions, error: tqQuestionsError } = await supabase
            .from('questions')
            .select('*')
            .in('id', questionIds)
            .eq('status', 'published');

          if (!tqQuestionsError && testQuestions) {
            testLinkedQuestions = testQuestions;
          }
        }
      }
    }

    // 3. Deduplicate them by question.id
    const questionMap = new Map();
    (directQuestions || []).forEach((q) => {
      if (q && q.id) questionMap.set(q.id, q);
    });
    (testLinkedQuestions || []).forEach((q) => {
      if (q && q.id) questionMap.set(q.id, q);
    });

    return Array.from(questionMap.values());
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

  return <div className="chapter-page">
    <nav className="student-breadcrumbs"><Link to="/explore">{t('exploreExams')}</Link><ChevronRight size={14} />{exam && <><Link to={`/explore/${encodeURIComponent(exam.slug)}`}>{exam.title}</Link><ChevronRight size={14} /></>}{folderPath.map((item) => <span className="breadcrumb-part" key={item.id}><Link to={`/folder/${item.id}`}>{item.title}</Link><ChevronRight size={14} /></span>)}<span>{chapter?.title || t('chapter')}</span></nav>
    {error && <div className="feedback error-feedback">{error}</div>}
    {loading && <LoadingSkeleton rows={4} />}
    {!loading && !error && (!chapter || !folder || !exam || !hierarchyPublished) && <div className="empty-content"><BookOpen size={25} /><strong>This chapter isn’t available.</strong><span>It may be unpublished or its folder has changed.</span><Link className="button button-outline" to="/explore"><ArrowLeft size={15} /> Explore exams</Link></div>}
    {!loading && !error && chapter && folder && exam && hierarchyPublished && <>
      <section className="chapter-hero"><div className="chapter-hero-top"><div className="chapter-hero-icon"><BookOpen size={23} /></div><span className={`access-badge ${isLocked ? 'access-paid' : 'access-free'}`}>{isLocked ? t('paidAccess') : t('freeToExplore')}</span></div><div className="eyebrow">{exam.title} · {folder.title}</div><h1>{chapter.title}</h1><p>{chapter.description || (language === 'hi' ? 'केंद्रित अध्ययन, अभ्यास और दोहराव से विषय को स्पष्ट रूप से समझें।' : 'Build a clear understanding with focused learning, practice and review.')}</p><div className="chapter-hero-meta"><span className="subject-pill">{chapter.subject || (language === 'hi' ? 'सामान्य' : 'General')}</span><span><Clock3 size={14} /> {chapter.estimated_study_time_minutes || '—'} {language === 'hi' ? 'मिनट अध्ययन समय' : t('studyTime')}</span><span>{access.label === 'Coming Soon' ? t('chapterComingSoon') : access.label}</span></div></section>
      <div className="chapter-tabs" role="tablist" aria-label={t('chapterContent')}>{tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}><Icon size={16} /><span>{t(label)}</span></button>)}</div>
      {notice && <div className="feedback success-feedback">{notice}</div>}
      {accessError && <div className="feedback error-feedback">{accessError}</div>}
      {isLocked && <section className="paywall-banner"><span className="paywall-icon"><LockKeyhole size={19} /></span><div><strong>{t('fullAccess')} {`₹${access.amount.toLocaleString('en-IN')}`}</strong><span>{t('unlockChapterCopy')}</span></div><div className="paywall-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}><button className="button button-gold" disabled={!user || accessLoading} onClick={() => setCheckoutItem({ itemType: 'chapter', itemId: chapter.id, itemTitle: chapter.title, tier: 'Chapter', basePrice: access.amount })}>{accessLoading ? t('checkingAccess') : `Buy Chapter · ₹${access.amount}`} <ArrowRight size={14} /></button>{folder && parentPricing.amount > 0 && !hasParentFolderAccess && <button className="button button-outline" disabled={!user || accessLoading} onClick={() => setCheckoutItem({ itemType: 'folder', itemId: folder.id, itemTitle: folder.title, tier: 'Folder Bundle', basePrice: parentPricing.amount })}>Unlock {folder.title} Bundle · ₹{parentPricing.amount.toLocaleString('en-IN')}</button>}{rootFolder && rootFolder.id !== folder?.id && rootPricing.amount > 0 && !isFolderUnlocked(rootFolder.id, folders, purchasedFolderIds) && <button className="button button-outline" disabled={!user || accessLoading} onClick={() => setCheckoutItem({ itemType: 'folder', itemId: rootFolder.id, itemTitle: rootFolder.title, tier: 'Root Bundle', basePrice: rootPricing.amount })}>Unlock Complete {rootFolder.title} · ₹{rootPricing.amount.toLocaleString('en-IN')}</button>}{exam && examIsPaid && !hasPurchasedExam && <button className="button button-outline" disabled={!user || accessLoading} onClick={() => setCheckoutItem({ itemType: 'exam', itemId: exam.id, itemTitle: exam.title, tier: 'Complete Exam Bundle', basePrice: examPrice })}>Unlock Complete {exam.title} · ₹{examPrice.toLocaleString('en-IN')}</button>}</div></section>}
      {isComingSoon ? <section className="chapter-locked panel-card"><div className="locked-icon"><Clock3 size={22} /></div><h2>{t('chapterComingSoon')}</h2><p>{t('chapterPreparing')}</p><Link className="button button-outline" to={`/folder/${folder.id}`}><ArrowLeft size={14} /> {t('backToSyllabus')}</Link></section> : isLocked && activeTab !== 'notes' ? <section className="chapter-locked panel-card"><div className="locked-icon"><LockKeyhole size={22} /></div><h2>{t('paidLearningPath')}</h2><p>{access.label}. {t('accessVerified')}</p><Link className="button button-gold" to="/purchases">{t('viewAccessOptions')} <ChevronRight size={15} /></Link></section> : <>
        {activeTab === 'tests' && <section className="chapter-tab-panel"><div className="section-heading"><div><div className="eyebrow">{t('checkUnderstanding')}</div><h2>{t('chapterTests')}</h2></div><span className="chapter-item-count">{chapterTests.length} {t('available')}</span></div>{!hasTests ? <div className="empty-content chapter-tab-empty"><CheckCircle2 size={23} /><strong>{t('testsUnavailable')}</strong><span>{t('chooseAnotherTab')}</span></div> : isLocked ? <div className="empty-content chapter-tab-empty"><LockKeyhole size={23} /><strong>{t('unlockLiveTests')}</strong><span>{t('freePreviewsNotes')}</span></div> : testsLoading ? <p className="field-hint">{t('loadingTests')}</p> : testsError ? <div className="feedback error-feedback">{testsError}</div> : !chapterTests.length ? <div className="empty-content chapter-tab-empty"><CheckCircle2 size={23} /><strong>{t('noPublishedTests')}</strong><span>{t('checkBackPractice')}</span></div> : chapterTests.map((test) => {
          const attempts = testAttempts[test.id] || 0;
          const limit = Number(test.attempt_limit || 1);
          const pausedInfo = resumeAttempts[test.id];
          const hasIncomplete = Boolean(pausedInfo);
          const exhausted = user && !hasIncomplete && attempts >= limit;
          const formatRemainingTime = (seconds) => {
            const safe = Math.max(0, Number(seconds) || 0);
            const m = Math.floor(safe / 60);
            const s = safe % 60;
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          };
          return <div className="learning-activity chapter-test-item" key={test.id}><span className="activity-type-icon"><CheckCircle2 size={18} /></span><div><strong>{test.title}</strong><span>{test.duration_minutes} {language === 'hi' ? 'मिनट' : 'min'}{hasIncomplete ? ` · ${pausedInfo.answeredCount} ${language === 'hi' ? 'उत्तर दिए गए' : 'answered'}` : ''} · {attempts}/{limit} {t('attemptsUsed')}</span></div><span className="activity-tag">{hasIncomplete ? (language === 'hi' ? 'जारी रखें' : 'RESUME') : test.pattern === 'bpsc-classic-5' || test.pattern === 'bpsc-mandatory-e' ? 'BPSC' : 'TEST'}</span><Link className={`button ${exhausted ? 'button-outline' : 'button-gold'} chapter-test-start`} aria-disabled={Boolean(exhausted) || !user} onClick={(event) => { if (exhausted || !user) { event.preventDefault(); setNotice(exhausted ? t('limitReached') : t('signInToStartTest')); return; } sessionStorage.setItem('last_quiz_return_url', location.pathname); }} to={exhausted || !user ? '#' : `/quiz/${test.id}`} state={{ returnTo: location.pathname, autoResume: hasIncomplete }}>{hasIncomplete ? `${language === 'hi' ? 'टेस्ट जारी रखें' : 'Resume Test'} · ${formatRemainingTime(pausedInfo.remainingSeconds)} ${language === 'hi' ? 'बचे' : 'left'}` : exhausted ? t('limitReached') : t('startTest')} <Play size={13} /></Link></div>;
        })}</section>}
        {activeTab === 'practice' && <section className="chapter-tab-panel practice-set-panel"><div className="section-heading"><div><div className="eyebrow">{t('learnByDoing')}</div><h2>{t('questionPractice')}</h2></div><span className="chapter-item-count">{practiceQuestionsCount > 0 ? `${practiceQuestionsCount} ${language === 'hi' ? 'प्रश्न उपलब्ध' : 'questions'}` : t('topicPractice')}</span></div>{!hasPractice ? <div className="empty-content chapter-tab-empty"><BookOpen size={23} /><strong>{t('practiceUnavailable')}</strong><span>{t('chooseAnotherTab')}</span></div> : isLocked ? <div className="empty-content chapter-tab-empty"><LockKeyhole size={23} /><strong>{t('unlockPractice')}</strong><span>{t('freePreviewsNotes')}</span></div> : <><div className="practice-set-summary"><div className="practice-set-icon"><Sparkles size={22} /></div><div><h3>{chapter.subject || t('chapter')} {t('questionPractice')}</h3><p>{t('reviewKeyConcepts')}</p></div></div><div className="practice-facts"><span><CheckCircle2 size={14} /> {practiceQuestionsCount > 0 ? `${practiceQuestionsCount} ${t('topicQuestions')}` : t('topicQuestions')}</span><span><Clock3 size={14} /> {t('ownPace')}</span><span><BookOpen size={14} /> {t('reviewExplanations')}</span></div><button className="button button-gold chapter-cta" disabled={practiceLoading} onClick={handleStartPractice}>{practiceLoading ? <LoaderCircle className="spin" size={15} /> : <Play size={15} />} {t('startPractice')}</button></>}</section>}
        {activeTab === 'notes' && <section className="chapter-tab-panel"><div className="section-heading"><div><div className="eyebrow">{t('readReviseRemember').toLocaleUpperCase(language === 'hi' ? 'hi-IN' : 'en-US')}</div><h2>{t('notesPdfs')}</h2></div><span className="chapter-item-count">{resources.length} {t('resources')}</span></div>{!hasNotes ? <div className="empty-content chapter-tab-empty"><FileText size={23} /><strong>{t('notesUnavailable')}</strong><span>{t('chooseAnotherTab')}</span></div> : resourcesLoading ? <p className="field-hint">{t('loadingResources')}</p> : resourcesError ? <div className="feedback error-feedback">{resourcesError}</div> : !resources.length ? <div className="empty-content chapter-tab-empty"><FileText size={23} /><strong>{t('noPublishedNotes')}</strong><span>{t('resourceCheckBack')}</span></div> : <div className="chapter-resource-list">{resources.map((resource) => {
          const bookmarked = bookmarks.some((bookmark) => bookmark.resource_id === resource.id);
          const isPreview = Boolean(resource.is_free_preview);
          const isDownloadable = Boolean(resource.is_downloadable);
          const canRead = isPreview || (isDownloadable && !isLocked);
          const status = isPreview ? t('freePreview') : canRead ? t('downloadAllowed') : t('locked');
          const rawKind = String(resource.resource_type || resource.type || 'PDF').toLowerCase();
          const fileKind = rawKind === 'formula_sheet' || rawKind === 'formula sheet' ? 'Formula Sheet'
            : rawKind === 'revision_sheet' || rawKind === 'revision sheet' ? 'Revision Sheet'
            : rawKind === 'notes' ? 'Notes'
            : rawKind === 'pdf' ? 'PDF'
            : (resource.resource_type || resource.type || 'PDF');
          return <article className={`chapter-resource-card ${canRead ? '' : 'resource-locked'}`} key={resource.id}>
            <span className="resource-file-icon"><FileText size={19} /></span>
            <div className="resource-card-copy"><strong>{resource.title}</strong><div className="resource-card-meta"><span className="resource-file-badge">{fileKind}</span>{resource.file_size && <span>{resource.file_size}</span>}{resource.page_count && <span>{resource.page_count} {t('pages')}</span>}<span className={`resource-access-status ${canRead ? 'available' : ''}`}>{status}</span></div></div>
            <div className="resource-card-actions"><button type="button" className="icon-button" disabled={bookmarkBusy === resource.id} aria-label={bookmarked ? t('removeBookmark') : t('bookmarkResource')} title={bookmarked ? t('removeBookmark') : t('bookmarkResource')} onClick={() => toggleBookmark(resource)}>{bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}</button><button type="button" className={`button ${canRead ? 'button-gold' : 'button-outline'}`} disabled={!canRead || readerLoading === resource.id} onClick={() => openResource(resource)}>{!canRead ? <LockKeyhole size={14} /> : <BookOpen size={14} />}{readerLoading === resource.id ? t('opening') : canRead ? t('readDocument') : t('locked')}</button></div>
          </article>;
        })}</div>}{resourceNotice && <div className="feedback error-feedback">{resourceNotice}</div>}{hasNotes && <button className={`chapter-bookmark-button ${bookmarks.some((bookmark) => !bookmark.resource_id && bookmark.chapter_id === chapter.id) ? 'saved' : ''}`} onClick={() => toggleBookmark()} disabled={bookmarkBusy === 'chapter'}>{bookmarks.some((bookmark) => !bookmark.resource_id && bookmark.chapter_id === chapter.id) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}{bookmarks.some((bookmark) => !bookmark.resource_id && bookmark.chapter_id === chapter.id) ? t('chapterSaved') : t('bookmarkResource')}</button>}</section>}
      </>}
      <Link to={`/folder/${folder.id}`} className="chapter-back-link"><ArrowLeft size={14} /> Back to {folder.title}</Link>
    </>}
    {reader && <PdfReaderModal resource={reader.resource} url={reader.url} onClose={() => setReader(null)} />}
    {checkoutItem && <CheckoutModal {...checkoutItem} onClose={() => setCheckoutItem(null)} onCompleted={() => setAccessRefreshKey((value) => value + 1)} />}
    {practiceActive && practiceQuestions.length > 0 && (
      <QuestionPracticeModal
        questions={practiceQuestions}
        chapterTitle={chapter.title}
        subject={chapter.subject}
        onClose={() => setPracticeActive(false)}
      />
    )}
  </div>;
}
