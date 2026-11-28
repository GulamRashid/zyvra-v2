import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, CheckCircle2, GraduationCap, Layers, Play, Search,
  SlidersHorizontal, Target
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { formatMinutes, formatQuestions } from '../../lib/formatters';


import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import { prefetchLiveQuiz } from '../../lib/prefetchLiveQuiz';
import { getAnsweredQuestionCount } from '../../lib/tests';
import { isPyqFolderOrTitle } from '../../lib/syllabusProgress';

function normalizeSubjectFilterName(raw = '') {
  const cleaned = String(raw || '')
    .replace(/\bIndla\b/gi, 'India')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

function getSubjectIcon(title = '') {
  const t = String(title || '').toLowerCase();
  if (t.includes('history') || t.includes('past') || t.includes('themes')) return '🏛️';
  if (t.includes('geography') || t.includes('earth')) return '🌍';
  if (t.includes('polity') || t.includes('civics') || t.includes('political') || t.includes('constitution')) return '⚖️';
  if (t.includes('economics') || t.includes('economy')) return '📊';
  if (t.includes('sociology')) return '👥';
  if (t.includes('psychology')) return '🧠';
  if (t.includes('social')) return '🗺️';
  if (t.includes('physics')) return '⚛️';
  if (t.includes('chemistry')) return '🧪';
  if (t.includes('biology')) return '🧬';
  if (t.includes('science')) return '🔬';
  if (t.includes('math')) return '📐';
  if (t.includes('english') || t.includes('hindi')) return '📖';
  return '📚';
}

function isComplete(attempt) {
  const status = String(attempt?.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt?.completed_at || attempt?.submitted_at || attempt?.finished_at);
}

export default function TestHub() {
  const { user, supabase } = useAuth();
  const { language } = useThemeLanguage();
  const { chapters, folders, exams, loading: catalogLoading } = useContentCatalog();
  const location = useLocation();
  const navigate = useNavigate();

  // Tab State: 'subjects' | 'chapters' | 'tests' | 'custom'
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'mock' || params.get('tab') === 'tests') return 'tests';
    return 'subjects';
  });

  useEffect(() => {
    const requestedTab = new URLSearchParams(location.search).get('tab');
    const nextTab = requestedTab === 'mock' ? 'tests' : requestedTab;
    setActiveTab(['subjects', 'chapters', 'tests', 'custom'].includes(nextTab) ? nextTab : 'subjects');
  }, [location.search]);

  const [tests, setTests] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({});
  const [userAttempts, setUserAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [chapterPage, setChapterPage] = useState(1);
  const [testFilter, setTestFilter] = useState('all'); // 'all' | 'free' | 'chapter'
  const [testPage, setTestPage] = useState(1);
  const [selectedExamId, setSelectedExamId] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState('all');

  const warmQuiz = useCallback(() => {
    prefetchLiveQuiz().catch((error) => console.warn('Unable to prefetch quiz:', error));
  }, []);

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

  // Chapter, Folder & Exam lookup maps
  const examById = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);

  // Top-level folders (classes) for selected exam
  const availableClassesForExam = useMemo(() => {
    if (selectedExamId === 'all') return [];
    return folders.filter((f) => f.exam_id === selectedExamId && !(f.parent_folder_id || f.parent_id));
  }, [folders, selectedExamId]);

  // Hierarchy Resolver for Chapter
  const getChapterHierarchy = useCallback((chapter) => {
    if (!chapter) return { examId: null, classFolderId: null, examTitle: '', classTitle: '', subjectTitle: '', chapterTitle: '', badge: '' };
    const folder = folderById.get(chapter.folder_id);
    if (!folder) return { examId: null, classFolderId: null, examTitle: '', classTitle: '', subjectTitle: chapter.subject || '', chapterTitle: chapter.title || '', badge: '' };

    const parent = (folder.parent_folder_id || folder.parent_id)
      ? folderById.get(folder.parent_folder_id || folder.parent_id)
      : null;
    const rootParent = parent && (parent.parent_folder_id || parent.parent_id)
      ? folderById.get(parent.parent_folder_id || parent.parent_id)
      : null;

    const examId = folder.exam_id || parent?.exam_id || rootParent?.exam_id;
    const exam = examId ? examById.get(examId) : null;
    const classFolder = rootParent || parent;

    if (classFolder) {
      const examName = exam?.title || '';
      const className = classFolder.title || '';
      return {
        examId,
        classFolderId: classFolder.id,
        examTitle: examName,
        classTitle: className,
        subjectTitle: folder.title || chapter.subject || '',
        chapterTitle: chapter.title || '',
        badge: examName && className ? `${examName} • ${className}` : (examName || className)
      };
    }

    const examName = exam?.title || '';
    const className = folder.title || '';
    return {
      examId,
      classFolderId: folder.id,
      examTitle: examName,
      classTitle: className,
      subjectTitle: chapter.subject || '',
      chapterTitle: chapter.title || '',
      badge: examName && className ? `${examName} • ${className}` : (examName || className)
    };
  }, [folderById, examById]);

  // Hierarchy Resolver for Test
  const getTestHierarchy = useCallback((test) => {
    if (!test) return { badge: '', examId: null, classFolderId: null, subjectTitle: '', classTitle: '', chapterTitle: '' };
    if (test.chapter_id) {
      const ch = chapterById.get(test.chapter_id);
      if (ch) return getChapterHierarchy(ch);
    }
    if (test.folder_id) {
      const folder = folderById.get(test.folder_id);
      if (folder) {
        const parent = (folder.parent_folder_id || folder.parent_id)
          ? folderById.get(folder.parent_folder_id || folder.parent_id)
          : null;
        const examId = folder.exam_id || parent?.exam_id || test.exam_id;
        const exam = examId ? examById.get(examId) : null;
        const examName = exam?.title || '';
        const className = parent?.title || folder.title || '';
        return {
          examId,
          classFolderId: parent?.id || folder.id,
          classTitle: className,
          subjectTitle: parent ? folder.title : '',
          chapterTitle: '',
          badge: examName && className ? `${examName} • ${className}` : (examName || className)
        };
      }
    }
    if (test.exam_id) {
      const exam = examById.get(test.exam_id);
      return {
        examId: test.exam_id,
        classFolderId: null,
        classTitle: '',
        subjectTitle: '',
        chapterTitle: '',
        badge: exam?.title || ''
      };
    }
    return { badge: '', examId: null, classFolderId: null, subjectTitle: '', classTitle: '', chapterTitle: '' };
  }, [chapterById, folderById, examById, getChapterHierarchy]);


  // Fetch tests and user attempts strictly from Supabase
  const loadTestData = useCallback(async () => {
    if (!supabase) {
      setLoadError('Test services are currently unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const { data: testRows, error: testError } = await supabase
        .from('tests')
        .select('*')
        .in('status', ['published', 'live', 'available'])
        .order('created_at', { ascending: false });
      if (testError) throw testError;

      setTests(testRows || []);

      // Students cannot read test_questions directly (it contains protected
      // question links). Ask the count-only RPC instead so a permission error
      // cannot take down the entire Test Hub.
      if (testRows?.length) {
        const { data: countRows, error: countError } = await supabase.rpc('get_published_test_question_counts', {
          p_test_ids: testRows.map((test) => test.id)
        });
        const counts = {};
        if (countError) console.warn('Test question counts are unavailable:', countError.message);
        else (countRows || []).forEach((row) => {
          counts[row.test_id] = Number(row.question_count) || 0;
        });
        setQuestionCounts(counts);
      } else {
        setQuestionCounts({});
      }

      if (user) {
        const { data: attemptRows, error: attemptError } = await supabase
          .from('test_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (attemptError) throw attemptError;

        if (attemptRows) {
          setUserAttempts(attemptRows);
        }
      }
    } catch (err) {
      console.error('Failed to load test hub:', err);
      setLoadError('Could not load tests. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  // Map attempts by testId
  const attemptsByTestId = useMemo(() => {
    const map = new Map();
    for (const attempt of userAttempts) {
      if (!map.has(attempt.test_id)) {
        map.set(attempt.test_id, []);
      }
      map.get(attempt.test_id).push(attempt);
    }
    return map;
  }, [userAttempts]);

  // Real Subjects mapped from actual database folders (filtered by exam & class if selected)
  const displaySubjects = useMemo(() => {
    if (folders.length === 0) return [];

    const getDescendantIds = (rootId) => {
      const ids = new Set([rootId]);
      let added = true;
      while (added) {
        added = false;
        folders.forEach((f) => {
          const pId = f.parent_folder_id || f.parent_id;
          if (pId && ids.has(pId) && !ids.has(f.id)) {
            ids.add(f.id);
            added = true;
          }
        });
      }
      return ids;
    };

    const relevantFolders = folders.filter((sf) => {
      // Exclude container folders (Classes / parent groupings) that only hold child folders and no direct chapters/tests
      const hasChildren = folders.some((child) => (child.parent_folder_id || child.parent_id) === sf.id);
      const hasDirectContent = chapters.some((c) => c.folder_id === sf.id) || tests.some((t) => t.folder_id === sf.id);
      if (hasChildren && !hasDirectContent) return false;

      const parent = (sf.parent_folder_id || sf.parent_id) ? folderById.get(sf.parent_folder_id || sf.parent_id) : null;
      const rootParent = parent && (parent.parent_folder_id || parent.parent_id)
        ? folderById.get(parent.parent_folder_id || parent.parent_id)
        : null;

      if (selectedExamId !== 'all') {
        const examId = sf.exam_id || parent?.exam_id || rootParent?.exam_id;
        if (examId !== selectedExamId) return false;
      }
      if (selectedClassId !== 'all') {
        const classFolder = rootParent || parent;
        if (sf.id !== selectedClassId && classFolder?.id !== selectedClassId) return false;
      }
      return true;
    });

    return relevantFolders.map((sf) => {
      const parent = (sf.parent_folder_id || sf.parent_id) ? folderById.get(sf.parent_folder_id || sf.parent_id) : null;
      const rootParent = parent && (parent.parent_folder_id || parent.parent_id)
        ? folderById.get(parent.parent_folder_id || parent.parent_id)
        : null;
      const classFolder = rootParent || parent;
      const exam = sf.exam_id
        ? examById.get(sf.exam_id)
        : classFolder?.exam_id
          ? examById.get(classFolder.exam_id)
          : null;
      const badge = classFolder
        ? `${exam?.title ? `${exam.title} • ` : ''}${classFolder.title}`
        : (exam?.title || '');

      const descendantIds = getDescendantIds(sf.id);
      const subjectChapters = chapters.filter((c) => descendantIds.has(c.folder_id));
      const subjectTests = tests.filter((t) => subjectChapters.some((ch) => ch.id === t.chapter_id) || descendantIds.has(t.folder_id));

      // Total questions in this subject folder
      const qCount = subjectTests.reduce((sum, t) => sum + (questionCounts[t.id] ?? (Number(t.question_count) || 0)), 0)
        || subjectChapters.reduce((sum, c) => sum + (Number(c.question_count) || 0), 0);

      // Solved questions by user in this subject (unique questions per completed/best attempt capped by qCount)
      const solvedInSubject = userAttempts
        .filter((att) => subjectTests.some((t) => t.id === att.test_id))
        .reduce((sum, att) => sum + getAnsweredQuestionCount(att), 0);

      const rawProgress = qCount > 0 ? Math.min(100, (solvedInSubject / qCount) * 100) : 0;
      const progress = rawProgress > 0 && rawProgress < 1 ? 1 : Math.round(rawProgress);

      const cleanTitle = String(sf.title || '').replace(/\bIndla\b/g, 'India');
      const uniqueTitle = classFolder && !cleanTitle.toLowerCase().includes(String(classFolder.title || '').toLowerCase())
        ? `${cleanTitle} — ${classFolder.title}`
        : cleanTitle;

      return {
        id: sf.id,
        title: uniqueTitle,
        badge,
        icon: getSubjectIcon(cleanTitle),
        chaptersCount: subjectChapters.length,
        testsCount: subjectTests.length,
        questionsCount: qCount,
        progress,
        folderId: sf.id,
        firstTestId: subjectTests[0]?.id || null,
        firstChapterId: subjectChapters[0]?.id || null
      };
    });
  }, [folders, chapters, tests, questionCounts, userAttempts, selectedExamId, selectedClassId, folderById, examById]);

  // Total Solved vs Total Questions Real Ratio
  const totalQuestionsSum = useMemo(() => {
    return tests.reduce((sum, t) => sum + (questionCounts[t.id] ?? (Number(t.question_count) || 0)), 0)
      || chapters.reduce((sum, c) => sum + (Number(c.question_count) || 0), 0);
  }, [tests, questionCounts, chapters]);

  const totalQuestionsSolved = useMemo(() => {
    return userAttempts
      .filter(isComplete)
      .reduce((sum, a) => sum + getAnsweredQuestionCount(a), 0);
  }, [userAttempts]);

  const rawAggregatePct = totalQuestionsSum > 0
    ? Math.min(100, (totalQuestionsSolved / totalQuestionsSum) * 100)
    : 0;
  const aggregateProgressPct = rawAggregatePct > 0 && rawAggregatePct < 1 ? 1 : Math.round(rawAggregatePct);
  const aggregateProgressLabel = rawAggregatePct > 0 && rawAggregatePct < 1
    ? `${rawAggregatePct.toFixed(1)}%`
    : `${Math.round(rawAggregatePct)}%`;

  // Unique canonical subjects for Chapter Practice filter
  const availableSubjects = useMemo(() => {
    const set = new Set();
    chapters.forEach((c) => {
      const h = getChapterHierarchy(c);
      if (selectedExamId !== 'all' && h.examId && h.examId !== selectedExamId) return;
      if (selectedClassId !== 'all' && h.classFolderId && h.classFolderId !== selectedClassId) return;
      const normalized = normalizeSubjectFilterName(h.subjectTitle);
      if (normalized) set.add(normalized);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [chapters, getChapterHierarchy, selectedExamId, selectedClassId]);

  useEffect(() => {
    setChapterPage(1);
  }, [selectedExamId, selectedClassId, selectedSubjectFilter, chapterSearchQuery]);

  useEffect(() => {
    setTestPage(1);
  }, [selectedExamId, selectedClassId, searchQuery, testFilter]);

  // Filtered Chapters strictly from DB (with Exam, Class, Subject, and Search filters)
  const filteredChapters = useMemo(() => {
    return chapters.filter((chapter) => {
      const h = getChapterHierarchy(chapter);
      if (selectedExamId !== 'all' && h.examId && h.examId !== selectedExamId) {
        return false;
      }
      if (selectedClassId !== 'all' && h.classFolderId && h.classFolderId !== selectedClassId) {
        return false;
      }
      if (selectedSubjectFilter !== 'all' && normalizeSubjectFilterName(h.subjectTitle) !== selectedSubjectFilter) {
        return false;
      }
      if (chapterSearchQuery.trim()) {
        const q = chapterSearchQuery.toLowerCase();
        const matchesTitle = String(chapter.title || '').toLowerCase().includes(q);
        const matchesSubject = String(h.subjectTitle || '').toLowerCase().includes(q);
        const matchesClass = String(h.classTitle || '').toLowerCase().includes(q);
        const matchesExam = String(h.examTitle || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesSubject && !matchesClass && !matchesExam) return false;
      }
      return true;
    });
  }, [chapters, getChapterHierarchy, selectedExamId, selectedClassId, selectedSubjectFilter, chapterSearchQuery]);

  const CHAPTERS_PER_PAGE = 15;
  const totalChapterPages = Math.max(1, Math.ceil(filteredChapters.length / CHAPTERS_PER_PAGE));
  const paginatedChapters = useMemo(() => {
    const start = (chapterPage - 1) * CHAPTERS_PER_PAGE;
    return filteredChapters.slice(start, start + CHAPTERS_PER_PAGE);
  }, [filteredChapters, chapterPage]);

  // Filtered Tests strictly from DB (with Exam, Class, and Search filters)
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const h = getTestHierarchy(test);
      if (selectedExamId !== 'all' && h.examId && h.examId !== selectedExamId) {
        return false;
      }
      if (selectedClassId !== 'all' && h.classFolderId && h.classFolderId !== selectedClassId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = String(test.title || '').toLowerCase().includes(q);
        const matchesDesc = String(test.description || '').toLowerCase().includes(q);
        const matchesBadge = String(h.badge || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesBadge) return false;
      }
      if (testFilter === 'timed') {
        return test.solution_mode === 'after_submit';
      }
      if (testFilter === 'free') {
        return test.is_free || !test.price;
      }
      if (testFilter === 'chapter') {
        return Boolean(test.chapter_id);
      }
      if (testFilter === 'pyq') {
        const h = getTestHierarchy(test);
        return isPyqFolderOrTitle(test.title) || isPyqFolderOrTitle(h.badge) || isPyqFolderOrTitle(h.folderPath);
      }
      return true;
    });
  }, [tests, getTestHierarchy, selectedExamId, selectedClassId, searchQuery, testFilter]);

  return (
    <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6 text-slate-800 dark:text-slate-100 relative">
      {/* Practice Hub Header */}
      <div className="pt-2 pb-1 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight dark:text-white text-slate-900 flex items-center gap-2">
              <span>{language === 'hi' ? 'अभ्यास' : 'Practice Hub'}</span>
            </h1>
            <p className="dark:text-slate-400 text-slate-600 text-xs sm:text-sm mt-0.5 font-medium">
              {language === 'hi'
                ? 'अध्याय-वार अभ्यास, विषय परीक्षण और कस्टम टेस्ट।'
                : 'Chapter-wise practice, topic tests and full syllabus assessments.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6 relative z-10">
        {loadError && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
            <span>{loadError}</span>
            <button
              type="button"
              className="shrink-0 min-h-[44px] rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100 dark:border-rose-400/40 dark:hover:bg-rose-950/50"
              onClick={loadTestData}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Try again'}
            </button>
          </div>
        )}
        {/* Exam & Class Selection Bar */}
        {exams.length > 0 && (
          <div className="space-y-2 p-2.5 sm:p-3 rounded-2xl dark:bg-[#1E293B]/70 bg-white/80 border dark:border-slate-700/60 border-slate-200/80 backdrop-blur-md shadow-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => { setSelectedExamId('all'); setSelectedClassId('all'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all min-h-[38px] ${
                  selectedExamId === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'dark:bg-slate-900/60 bg-slate-100 dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {language === 'hi' ? '⭐ सभी परीक्षाएं' : '⭐ All Exams'}
              </button>

              {exams.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => { setSelectedExamId(exam.id); setSelectedClassId('all'); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all min-h-[38px] flex items-center gap-1.5 ${
                    selectedExamId === exam.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'dark:bg-slate-900/60 bg-slate-100 dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{exam.title}</span>
                </button>
              ))}
            </div>

            {availableClassesForExam.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1.5 border-t dark:border-slate-800 border-slate-100 scrollbar-none">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1">
                  {language === 'hi' ? 'कक्षा / स्तर:' : 'Class / Level:'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedClassId('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                    selectedClassId === 'all'
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-black'
                      : 'dark:text-slate-400 text-slate-600 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {language === 'hi' ? 'सभी' : 'All'}
                </button>
                {availableClassesForExam.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClassId(cls.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                      selectedClassId === cls.id
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-black'
                        : 'dark:text-slate-400 text-slate-600 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cls.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation Tabs with Distinct Section Separation (Practice vs Chapter Tests vs Custom) */}
        <div role="tablist" aria-label={language === 'hi' ? 'अभ्यास अनुभाग' : 'Practice sections'} className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl dark:bg-[#1E293B]/90 bg-white border dark:border-slate-700/60 border-slate-200 backdrop-blur-md overflow-x-auto shadow-sm">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'subjects'}
            onClick={() => navigate('/tests?tab=subjects', { replace: true })}
            className={`flex-1 min-w-[75px] sm:min-w-[90px] py-2 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'subjects'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <Layers size={14} />
            <span>{language === 'hi' ? 'विषय' : 'Subjects'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chapters'}
            onClick={() => navigate('/tests?tab=chapters', { replace: true })}
            className={`flex-1 min-w-[75px] sm:min-w-[90px] py-2 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'chapters'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <BookOpen size={14} />
            <span>{language === 'hi' ? 'अध्याय अभ्यास' : 'Chapter Practice'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tests'}
            onClick={() => navigate('/tests?tab=tests', { replace: true })}
            className={`flex-1 min-w-[75px] sm:min-w-[90px] py-2 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'tests'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <Target size={14} />
            <span>{language === 'hi' ? 'टेस्ट एवं सेट' : 'Tests & Sets'}</span>
          </button>
        </div>

        {/* Clear Mode Context Banner */}
        <div className="p-3 sm:p-3.5 rounded-2xl dark:bg-[#1E293B] bg-slate-50 border dark:border-slate-800 border-slate-200 text-xs flex items-center gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            {activeTab === 'chapters' ? <BookOpen size={16} /> : activeTab === 'tests' ? <Target size={16} /> : activeTab === 'custom' ? <SlidersHorizontal size={16} /> : <Layers size={16} />}
          </div>
          <div className="min-w-0">
            <span className="font-black block uppercase tracking-wider text-[10px] text-slate-800 dark:text-slate-200">
              {activeTab === 'chapters'
                ? (language === 'hi' ? 'अध्याय-वार अभ्यास (Self-Paced Practice)' : 'Chapter-Wise Practice')
                : activeTab === 'tests'
                ? (language === 'hi' ? 'अध्याय टेस्ट और अभ्यास सेट (समयबद्ध + तुरंत उत्तर)' : 'Chapter Assessments & Practice Sets')
                : activeTab === 'custom'
                ? (language === 'hi' ? 'कस्टम टेस्ट जनरेटर (Personalized Test Builder)' : 'Custom Test Builder')
                : (language === 'hi' ? 'विषय-वार अध्ययन संरचना (Subject Hierarchy)' : 'Subject Learning Hierarchy')}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
              {activeTab === 'chapters'
                ? (language === 'hi' ? 'अपनी गति से सीखें, हर सवाल का विस्तृत समाधान तुरंत देखें।' : 'Learn at your own pace with instant step-by-step solutions.')
                : activeTab === 'tests'
                ? (language === 'hi' ? 'समयबद्ध अध्याय मास्टरी टेस्ट और अभ्यास सेट। पूर्ण-सिलेबस मॉक टेस्ट जल्द उपलब्ध होंगे।' : 'Timed chapter mastery tests and instant-solution practice sets. Full-syllabus mocks are coming soon.')
                : activeTab === 'custom'
                ? (language === 'hi' ? 'अपनी पसंद के विषय, प्रश्न संख्या और समय चुनकर अपना खुद का टेस्ट बनाएं।' : 'Choose subjects, questions and duration to generate your custom test.')
                : (language === 'hi' ? 'कक्षा और विषय चुनकर अपनी अध्ययन सामग्री ब्राउज़ करें।' : 'Browse your syllabus topics grouped by subject and level.')}
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SUBJECTS */}
        {/* ======================================================== */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            {/* Overview Hero Card */}
            {exams.length > 0 && (
              <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-2xl p-3.5 sm:p-5 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3.5">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-base font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                        <span>{exams[0]?.title} {language === 'hi' ? 'सिलेबस ट्रैक' : 'Syllabus Track'}</span>
                        <span className="text-[9px] sm:text-[10px] uppercase font-bold px-1.5 sm:px-2 py-0.5 rounded-full dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-300 text-indigo-800 border dark:border-indigo-400/30 border-indigo-200">
                          {language === 'hi' ? 'सक्रिय' : 'Active'}
                        </span>
                      </h3>
                      <p className="text-[11px] sm:text-xs dark:text-slate-400 text-slate-600 font-medium mt-0.5">
                        {displaySubjects.length} {language === 'hi' ? 'विषय' : 'Subjects'} · {chapters.length} {language === 'hi' ? 'अध्याय' : 'Chapters'} · {tests.length} {language === 'hi' ? 'टेस्ट' : 'Tests'}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/explore/${exams[0]?.slug || exams[0]?.id}`}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white font-bold text-xs transition-colors shadow-sm"
                  >
                    <span>{language === 'hi' ? 'सिलेबस देखें' : 'View Syllabus'}</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>

                {/* Progress bar */}
                <div className="mt-3 pt-2.5 border-t dark:border-slate-700/60 border-slate-200">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold mb-1">
                    <span className="dark:text-slate-300 text-slate-700">{language === 'hi' ? 'सिलेबस प्रगति' : 'Track Completion'}</span>
                    <span className="text-amber-500 dark:text-amber-400 font-bold">
                      {totalQuestionsSum > 0
                        ? (language === 'hi'
                          ? `${totalQuestionsSolved} / ${totalQuestionsSum} हल (${aggregateProgressLabel})`
                          : `${totalQuestionsSolved} / ${totalQuestionsSum} Solved (${aggregateProgressLabel})`)
                        : (language === 'hi' ? `${totalQuestionsSolved} हल` : `${totalQuestionsSolved} Solved`)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 dark:bg-slate-700/60 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${aggregateProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Subject Cards Grid (Strictly from Real DB Folders) */}
            {catalogLoading ? (
              <LoadingSkeleton variant="cards" count={4} />
            ) : displaySubjects.length === 0 ? (
              <div className="p-8 text-center text-sm dark:text-slate-400 text-slate-500 dark:bg-[#1E293B] bg-white rounded-3xl border dark:border-slate-700/60 border-slate-200">
                <p>No subjects are available yet. Check back soon to start practicing.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displaySubjects.map((subject) => {
                  const titleLower = String(subject.title || '').toLowerCase();
                  const accentBorder = titleLower.includes('science') && !titleLower.includes('social')
                    ? 'border-l-4 border-l-emerald-500'
                    : titleLower.includes('social') || titleLower.includes('history')
                      ? 'border-l-4 border-l-amber-500'
                      : titleLower.includes('math')
                        ? 'border-l-4 border-l-indigo-500'
                        : titleLower.includes('geo')
                          ? 'border-l-4 border-l-cyan-500'
                          : 'border-l-4 border-l-purple-500';
                  return (
                  <div
                    key={subject.id}
                    className={`p-3.5 sm:p-4.5 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 ${accentBorder} flex flex-col justify-between space-y-2.5 transition-colors hover:border-indigo-500 shadow-sm`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl sm:text-2xl">{subject.icon}</span>
                        <div>
                          {subject.badge && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 mb-1">
                              {subject.badge}
                            </span>
                          )}
                          <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900">{String(subject.title || '').replace(/\bIndla\b/g, 'India')}</h4>
                          <span className="text-[11px] sm:text-xs dark:text-slate-400 text-slate-500">
                            {subject.questionsCount === 0
                              ? (subject.chaptersCount > 0
                                ? `${subject.chaptersCount} ${language === 'hi' ? 'अध्याय · जल्द उपलब्ध' : 'Chapters · Coming Soon'}`
                                : (language === 'hi' ? 'जल्द उपलब्ध' : 'Coming Soon'))
                              : `${subject.chaptersCount} ${language === 'hi' ? 'अध्याय' : 'Chapters'} · ${formatQuestions(subject.questionsCount, language)}`}
                          </span>
                        </div>
                      </div>

                      {/* Play Action only when real questions exist */}
                      {subject.questionsCount > 0 && (subject.firstTestId || subject.folderId) ? (
                        <Link
                          to={subject.firstTestId ? `/quiz/${subject.firstTestId}` : `/folder/${subject.folderId}`}
                          className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white flex items-center justify-center transition-colors shrink-0 shadow-xs"
                          title={language === 'hi' ? 'अभ्यास शुरू करें' : 'Start Practice'}
                        >
                          <Play size={14} fill="currentColor" className="ml-0.5 text-white" />
                        </Link>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
                          {language === 'hi' ? 'जल्द उपलब्ध' : 'Coming Soon'}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar only for active subjects */}
                    {subject.questionsCount > 0 ? (
                      <div>
                        <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold dark:text-slate-300 text-slate-700 mb-1">
                          <span>{language === 'hi' ? 'हल किए गए' : 'Solved'}</span>
                          <span className="text-amber-500 dark:text-amber-400">{subject.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 dark:bg-slate-700/60 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${subject.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        {language === 'hi' ? 'टेस्ट और प्रश्न जल्द जोड़े जाएंगे।' : 'Tests and questions are being added.'}
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CHAPTERS (Strictly from Real DB Chapters) */}
        {/* ======================================================== */}
        {activeTab === 'chapters' && (
          <div className="space-y-3">
            {/* Search & Subject Filter for Chapters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-3 dark:text-slate-400 text-slate-400" />
                <input
                  type="text"
                  aria-label="Search chapters"
                  placeholder={language === 'hi' ? 'अध्याय, विषय या कक्षा खोजें (उदा. Science, Class 6)...' : 'Search chapters, subjects or classes...'}
                  value={chapterSearchQuery}
                  onChange={(e) => setChapterSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>
              {availableSubjects.length > 0 && (
                <select
                  aria-label="Filter chapters by subject"
                  value={selectedSubjectFilter}
                  onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 text-xs font-bold min-h-[44px]"
                >
                  <option value="all">{language === 'hi' ? 'सभी विषय' : 'All Subjects'}</option>
                  {availableSubjects.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              )}
            </div>

            {catalogLoading ? (
              <LoadingSkeleton variant="cards" count={4} />
            ) : filteredChapters.length === 0 ? (
              <div className="p-8 text-center text-sm dark:text-slate-400 text-slate-500 dark:bg-[#1E293B] bg-white rounded-3xl border dark:border-slate-700/60 border-slate-200">
                <p>{language === 'hi' ? 'कोई अध्याय नहीं मिला। कृपया फ़िल्टर बदलें।' : 'No chapters match your selection. Try clearing filters.'}</p>
              </div>
            ) : (
              <>
                {paginatedChapters.map((chapter) => {
                  const hInfo = getChapterHierarchy(chapter);
                  const chTests = tests.filter((t) => t.chapter_id === chapter.id);
                  const chQCount = chTests.reduce((sum, t) => sum + (questionCounts[t.id] ?? (Number(t.question_count) || 0)), 0) || (Number(chapter.question_count) || 0);
                  const chDuration = chTests[0]?.duration_minutes || chapter.estimated_study_time_minutes || 30;
                  const chSolved = userAttempts
                    .filter((att) => chTests.some((t) => t.id === att.test_id))
                    .reduce((sum, att) => sum + (Number(att.attempted_count) || 0), 0);
                  const chPct = chQCount > 0 ? Math.min(100, Math.round((chSolved / chQCount) * 100)) : 0;

                  return (
                    <div
                      key={chapter.id}
                      className="p-3.5 rounded-2xl dark:bg-[#1E293B]/80 bg-white border dark:border-slate-700/60 border-slate-200 flex items-center justify-between gap-3 hover:border-indigo-500 transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl dark:bg-indigo-500/10 bg-indigo-50 border dark:border-indigo-500/20 border-indigo-200 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                          <BookOpen size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          {/* Clear Hierarchy Badge (Exam • Class) */}
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            {hInfo.badge && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                                {hInfo.badge}
                              </span>
                            )}
                            {hInfo.subjectTitle && (
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                {hInfo.subjectTitle}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate">
                            {String(chapter.title || '').replace(/\bIndla\b/g, 'India')}
                          </h4>
                          <div className="text-[11px] dark:text-slate-400 text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            {chQCount > 0 || chTests.length > 0 ? (
                              <>
                                <span>⏱️ {formatMinutes(chDuration, language)}</span>
                                <span>• {formatQuestions(chQCount, language)}</span>
                                {chTests.length > 0 && (
                                  <span>• {chTests.length} {language === 'hi' ? 'टेस्ट' : (chTests.length === 1 ? 'Test' : 'Tests')}</span>
                                )}
                              </>
                            ) : (
                              <span>{language === 'hi' ? 'सामग्री जल्द उपलब्ध होगी' : 'Content coming soon'}</span>
                            )}
                          </div>
                          {(chQCount > 0 || chTests.length > 0) && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="w-full max-w-[180px] h-1.5 dark:bg-slate-700/60 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${chPct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{chPct}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {chQCount > 0 || chTests.length > 0 ? (
                        <Link
                          to={`/chapter/${chapter.id}`}
                          className="px-3.5 py-1.5 rounded-xl dark:bg-indigo-500/20 bg-indigo-100 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 border dark:border-indigo-400/40 border-indigo-300 dark:text-indigo-300 text-indigo-800 font-bold text-xs shrink-0 transition-colors min-h-[44px] flex items-center"
                        >
                          {language === 'hi' ? 'अध्याय खोलें' : 'Open Chapter'}
                        </Link>
                      ) : (
                        <span className="px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0">
                          {language === 'hi' ? 'जल्द उपलब्ध' : 'Coming Soon'}
                        </span>
                      )}
                    </div>
                  );
                })}

                {totalChapterPages > 1 && (
                  <div className="flex items-center justify-between pt-2 text-xs font-bold">
                    <button
                      type="button"
                      disabled={chapterPage <= 1}
                      onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                      className="px-3.5 py-2 rounded-xl border dark:border-slate-700 border-slate-300 disabled:opacity-40 min-h-[44px]"
                    >
                      Previous
                    </button>
                    <span className="text-slate-500 dark:text-slate-400">
                      Page {chapterPage} of {totalChapterPages} ({filteredChapters.length} chapters)
                    </span>
                    <button
                      type="button"
                      disabled={chapterPage >= totalChapterPages}
                      onClick={() => setChapterPage((p) => Math.min(totalChapterPages, p + 1))}
                      className="px-3.5 py-2 rounded-xl border dark:border-slate-700 border-slate-300 disabled:opacity-40 min-h-[44px]"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: TESTS (Strictly from Real DB Tests) */}
        {/* ======================================================== */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-3.5 dark:text-slate-400 text-slate-400" />
                <input
                  type="text"
                  placeholder={language === 'hi' ? 'टेस्ट या अध्याय खोजें...' : 'Search tests or chapters...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>

              <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-0.5">
                {['all', 'timed', 'free', 'chapter', 'pyq'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTestFilter(f)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors min-h-[44px] ${
                      testFilter === f
                        ? 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white shadow-xs'
                        : 'dark:bg-slate-800 bg-white border dark:border-slate-700/60 border-slate-300 dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f === 'all'
                      ? (language === 'hi' ? 'सभी टेस्ट' : 'All Tests')
                      : f === 'timed'
                      ? (language === 'hi' ? 'समयबद्ध टेस्ट' : 'Timed Tests')
                      : f === 'free'
                      ? (language === 'hi' ? 'मुफ़्त टेस्ट' : 'Free Tests')
                      : f === 'chapter'
                      ? (language === 'hi' ? 'अध्याय टेस्ट' : 'Chapter Tests')
                      : (language === 'hi' ? 'केवल PYQ' : 'PYQ only')}
                  </button>
                ))}
              </div>
            </div>

            {!loading && tests.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl dark:bg-slate-900/60 bg-slate-50 border dark:border-slate-800 border-slate-200 text-xs dark:text-slate-300 text-slate-700">
                <span className="font-semibold">
                  {language === 'hi'
                    ? `दिख रहे टेस्ट: ${filteredTests.length} / ${tests.length}`
                    : `Showing ${filteredTests.length} of ${tests.length} published tests`}
                </span>
                <span className="text-[11px] dark:text-slate-400 text-slate-500">
                  {language === 'hi'
                    ? `${tests.filter((t) => t.solution_mode === 'after_submit').length} समयबद्ध मास्टरी टेस्ट · ${tests.filter((t) => t.solution_mode !== 'after_submit').length} अभ्यास सेट`
                    : `${tests.filter((t) => t.solution_mode === 'after_submit').length} Timed Mastery · ${tests.filter((t) => t.solution_mode !== 'after_submit').length} Practice Sets`}
                </span>
              </div>
            )}

            {loading ? (
              <LoadingSkeleton variant="cards" count={3} />
            ) : filteredTests.length === 0 ? (
              <div className="p-8 text-center text-xs dark:text-slate-400 text-slate-500 dark:bg-[#1E293B]/60 bg-white rounded-2xl border dark:border-slate-700/60 border-slate-200">
                <p>{language === 'hi' ? 'इस फ़िल्टर के लिए कोई टेस्ट नहीं मिला। फ़िल्टर बदलें या बाद में देखें।' : 'No tests match these filters. Try clearing a filter or check back later.'}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTests.map((test) => {
                  const attempts = attemptsByTestId.get(test.id) || [];
                  const resumableAttempt = attempts.find((attempt) => (
                    !isComplete(attempt)
                    && (attempt.state_json || attempt.answers || attempt.responses)
                  ));
                  const completedAttempt = attempts.find(isComplete);
                  const qCount = questionCounts[test.id] ?? (Number(test.question_count) || 0);
                  const hInfo = getTestHierarchy(test);
                  const isTimedAssessment = test.solution_mode === 'after_submit';
                  const titleParts = [
                    hInfo.subjectTitle,
                    hInfo.classTitle,
                    hInfo.chapterTitle
                  ].filter((part, idx, arr) => part && arr.indexOf(part) === idx && !String(test.title || '').toLowerCase().includes(part.toLowerCase()));
                  const displayTitle = titleParts.length > 0
                    ? `${titleParts.join(' — ')} — ${test.title}`
                    : test.title;

                  return (
                    <div
                      key={test.id}
                      className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 hover:border-indigo-500 transition-colors shadow-sm"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {hInfo.badge && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                              {hInfo.badge}
                            </span>
                          )}
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                            isTimedAssessment
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20'
                          }`}>
                            {isTimedAssessment
                              ? (language === 'hi' ? 'समयबद्ध टेस्ट' : 'Timed Test')
                              : (language === 'hi' ? 'अभ्यास सेट' : 'Practice Set')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black dark:text-white text-slate-900">{displayTitle}</h4>
                          {test.is_free ? (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black dark:bg-emerald-500/20 bg-emerald-100 dark:text-emerald-300 text-emerald-600 border dark:border-emerald-500/30 border-emerald-300">
                              {language === 'hi' ? 'मुफ़्त' : 'FREE'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                              ₹{test.price || 49}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs dark:text-slate-400 text-slate-600 flex-wrap">
                          <span>⏱️ {formatMinutes(test.duration_minutes || 60, language)}</span>
                          <span>•</span>
                          <span>❓ {qCount > 0 ? formatQuestions(qCount, language) : (language === 'hi' ? 'प्रश्न संख्या उपलब्ध नहीं' : 'Question count unavailable')}</span>
                          {completedAttempt && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-500 dark:text-emerald-400 font-bold">
                                {language === 'hi' ? 'स्कोर' : 'Score'}: {completedAttempt.score}/{completedAttempt.total_questions}
                              </span>
                            </>
                          )}
                        </div>
                        {test.coin_reward_enabled && (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            {language === 'hi' ? '🪙 टेस्ट पूरा करने पर कॉइन रिवार्ड्स उपलब्ध हैं' : '🪙 Rewards enabled for qualifying attempts.'}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {completedAttempt && !resumableAttempt && (
                          <Link
                            to={`/quiz/${test.id}`}
                            onMouseEnter={warmQuiz}
                            onTouchStart={warmQuiz}
                            className="px-3 py-1.5 rounded-xl dark:bg-slate-800 bg-slate-100 border dark:border-slate-700 border-slate-300 dark:text-slate-200 text-slate-700 text-xs font-bold hover:text-slate-900 dark:hover:text-white transition-colors min-h-[44px] flex items-center"
                          >
                            {language === 'hi' ? 'फिर से दें' : 'Retake'}
                          </Link>
                        )}
                        <Link
                          to={resumableAttempt
                            ? `/quiz/${test.id}`
                            : completedAttempt
                              ? `/quiz/result/${completedAttempt.id}`
                              : `/quiz/${test.id}`}
                          className={`px-4 py-2 rounded-xl text-sm font-black transition-colors flex items-center gap-1.5 min-h-[44px] ${
                            resumableAttempt
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-xs'
                              : completedAttempt
                                ? 'dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                          }`}
                          onMouseEnter={warmQuiz}
                          onTouchStart={warmQuiz}
                        >
                          {resumableAttempt ? <Play size={13} fill="currentColor" /> : completedAttempt ? <CheckCircle2 size={15} /> : <Play size={13} fill="currentColor" />}
                          <span>
                            {resumableAttempt
                              ? (language === 'hi' ? 'जारी रखें' : 'Resume')
                              : completedAttempt
                                ? (language === 'hi' ? 'परिणाम देखें' : 'Review result')
                                : (language === 'hi' ? 'टेस्ट शुरू करें' : 'Start Test')}
                          </span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CUSTOM PRACTICE GENERATOR */}
        {/* ======================================================== */}
        {activeTab === 'custom' && (
          <div className="p-6 sm:p-8 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 max-w-xl mx-auto text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              <SlidersHorizontal size={23} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900">
                {language === 'hi' ? 'कस्टम अभ्यास जल्द उपलब्ध होगा' : 'Custom Practice is coming soon'}
              </h3>
              <p className="text-sm dark:text-slate-400 text-slate-600">
                {language === 'hi'
                  ? 'हम फ़ोल्डर, कठिनाई स्तर और प्रश्न संख्या के अनुसार भरोसेमंद प्रश्न जनरेटर तैयार कर रहे हैं।'
                  : 'We are building a reliable question generator for folder, difficulty, and question-count controls. Your selections will be available here once the session can honour them end to end.'}
              </p>
            </div>
            <Link
              to="/tests?tab=tests"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white font-black text-sm min-h-[44px] shadow-xs"
            >
              <Play size={15} fill="currentColor" />
              <span>{language === 'hi' ? 'उपलब्ध टेस्ट चुनें' : 'Choose an available test'}</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
