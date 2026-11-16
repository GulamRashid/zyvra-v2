import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, CheckCircle2, Layers, Play, Search,
  SlidersHorizontal, Target
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';


import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import { prefetchLiveQuiz } from '../../lib/prefetchLiveQuiz';
import { getAnsweredQuestionCount } from '../../lib/tests';

function isComplete(attempt) {
  const status = String(attempt?.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt?.completed_at || attempt?.submitted_at || attempt?.finished_at);
}

export default function TestHub() {
  const { user, supabase } = useAuth();
  const { t, language } = useThemeLanguage();
  const { chapters, folders, exams, loading: catalogLoading } = useContentCatalog();
  const location = useLocation();

  // Tab State: 'subjects' | 'chapters' | 'tests' | 'custom'
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'mock' || params.get('tab') === 'tests') return 'tests';
    return 'subjects';
  });

  const [tests, setTests] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({});
  const [userAttempts, setUserAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [testFilter, setTestFilter] = useState('all'); // 'all' | 'free' | 'chapter'
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

  // Chapter & Exam lookup maps
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const examById = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

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

  // Real Subjects mapped from actual database folders
  const displaySubjects = useMemo(() => {
    if (folders.length === 0) return [];

    return folders.map((sf, idx) => {
      const subjectChapters = chapters.filter((c) => c.folder_id === sf.id);
      const subjectTests = tests.filter((t) => subjectChapters.some((ch) => ch.id === t.chapter_id) || t.folder_id === sf.id);

      // Total questions in this subject folder
      const qCount = subjectTests.reduce((sum, t) => sum + (questionCounts[t.id] ?? (Number(t.question_count) || 0)), 0)
        || subjectChapters.reduce((sum, c) => sum + (Number(c.question_count) || 0), 0);

      // Solved questions by user in this subject
      const solvedInSubject = userAttempts
        .filter((att) => subjectTests.some((t) => t.id === att.test_id))
        .reduce((sum, att) => sum + getAnsweredQuestionCount(att), 0);

      const progress = qCount > 0 ? Math.min(100, Math.round((solvedInSubject / qCount) * 100)) : 0;

      return {
        id: sf.id,
        title: sf.title,
        icon: idx === 0 ? '📖' : idx === 1 ? '📝' : '🔬',
        chaptersCount: subjectChapters.length,
        testsCount: subjectTests.length,
        questionsCount: qCount,
        progress,
        folderId: sf.id,
        firstTestId: subjectTests[0]?.id || null,
        firstChapterId: subjectChapters[0]?.id || null
      };
    });
  }, [folders, chapters, tests, questionCounts, userAttempts]);

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

  const aggregateProgressPct = totalQuestionsSum > 0
    ? Math.min(100, Math.round((totalQuestionsSolved / totalQuestionsSum) * 100))
    : 0;

  // Filtered Tests strictly from DB
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = String(test.title || '').toLowerCase().includes(q);
        const matchesDesc = String(test.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (testFilter === 'free') {
        return test.is_free || !test.price;
      }
      if (testFilter === 'chapter') {
        return Boolean(test.chapter_id);
      }
      return true;
    });
  }, [tests, searchQuery, testFilter]);

  return (
    <div className="min-h-screen dark:bg-[#0B1120] bg-[#F7FAF8] dark:text-[#E8F3EC] text-slate-800 transition-colors duration-200 overflow-x-hidden">
      {/* Top Ambient Tech Data Grid Aura */}
      <div className="relative">
        <MountainSunsetAura height={190} showSun={true} />

        {/* Practice Hub Header */}
        <div className="px-3.5 sm:px-6 pt-4 pb-2 relative z-10 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight dark:text-white text-slate-900 flex items-center gap-2">
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
      </div>

      <div className="px-3.5 sm:px-6 max-w-5xl mx-auto space-y-4 sm:space-y-5 -mt-2 relative z-10">
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
        {/* Navigation Tabs (Subjects | Chapters | Tests | Custom) */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl dark:bg-[#1E293B]/90 bg-white border dark:border-slate-700/60 border-slate-200 backdrop-blur-md overflow-x-auto shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('subjects')}
            className={`flex-1 min-w-[70px] sm:min-w-[85px] py-2 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'subjects'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers size={14} />
            <span>{language === 'hi' ? 'विषय' : 'Subjects'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chapters')}
            className={`flex-1 min-w-[70px] sm:min-w-[85px] py-2 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'chapters'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen size={14} />
            <span>{language === 'hi' ? 'अध्याय' : 'Chapters'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`flex-1 min-w-[70px] sm:min-w-[85px] py-2 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'tests'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Target size={14} />
            <span>{language === 'hi' ? 'परीक्षण' : 'Tests'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 min-w-[70px] sm:min-w-[85px] py-2 px-2.5 sm:px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1 sm:gap-1.5 min-h-[44px] ${
              activeTab === 'custom'
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>{language === 'hi' ? 'कस्टम' : 'Custom'}</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SUBJECTS */}
        {/* ======================================================== */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            {/* Overview Hero Card */}
            {exams.length > 0 && (
              <div className="dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 rounded-3xl p-6 sm:p-8 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-3.5">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl dark:bg-indigo-500/20 bg-indigo-100 border dark:border-indigo-400/30 border-indigo-200 flex items-center justify-center text-xl sm:text-2xl shrink-0">
                      🎓
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-lg font-black dark:text-white text-slate-900 tracking-tight flex items-center gap-2">
                        <span>{exams[0]?.title} Syllabus Track</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full dark:bg-indigo-500/20 bg-indigo-100 dark:text-indigo-300 text-indigo-800 border dark:border-indigo-400/30 border-indigo-200">
                          Active
                        </span>
                      </h3>
                      <p className="text-xs dark:text-slate-400 text-slate-600 font-medium mt-0.5">
                        {folders.length} Subjects/Folders · {chapters.length} Chapters · {tests.length} Tests
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/explore/${exams[0]?.slug || exams[0]?.id}`}
                    className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white font-extrabold text-sm transition-colors shadow-glowIndigo"
                  >
                    <span>View Syllabus</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>

                {/* Progress bar */}
                <div className="mt-3.5 pt-3 border-t dark:border-slate-700/60 border-slate-200">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="dark:text-slate-300 text-slate-700">Overall Track Completion</span>
                    <span className="text-amber-500 dark:text-amber-400 font-bold">
                      {totalQuestionsSum > 0
                        ? `${totalQuestionsSolved} / ${totalQuestionsSum} Solved (${aggregateProgressPct}%)`
                        : `${totalQuestionsSolved} Solved`}
                    </span>
                  </div>
                  <div className="w-full h-2 dark:bg-slate-700/60 bg-slate-200 rounded-full overflow-hidden">
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
              <LoadingSkeleton count={4} />
            ) : displaySubjects.length === 0 ? (
              <div className="p-8 text-center text-sm dark:text-slate-400 text-slate-500 dark:bg-[#1E293B] bg-white rounded-3xl border dark:border-slate-700/60 border-slate-200">
                <p>No subjects are available yet. Check back soon to start practicing.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displaySubjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="p-4 sm:p-6 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 flex flex-col justify-between space-y-3 transition-colors hover:border-indigo-500"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{subject.icon}</span>
                        <div>
                          <h4 className="text-sm font-black dark:text-white text-slate-900">{subject.title}</h4>
                          <span className="text-sm dark:text-slate-400 text-slate-500">
                            {subject.chaptersCount} Chapters · {subject.questionsCount} Questions
                          </span>
                        </div>
                      </div>

                      {/* Play Action */}
                      <Link
                        to={subject.firstTestId ? `/quiz/${subject.firstTestId}` : `/folder/${subject.folderId}`}
                        className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white flex items-center justify-center transition-colors shrink-0 shadow-glowIndigo"
                        title="Start Practice"
                      >
                        <Play size={14} fill="currentColor" className="ml-0.5 text-white" />
                      </Link>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-sm font-bold dark:text-slate-300 text-slate-700 mb-1">
                        <span>Solved</span>
                        <span className="text-amber-500 dark:text-amber-400">{subject.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 dark:bg-slate-700/60 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${subject.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CHAPTERS (Strictly from Real DB Chapters) */}
        {/* ======================================================== */}
        {activeTab === 'chapters' && (
          <div className="space-y-3">
            {catalogLoading ? (
              <LoadingSkeleton count={4} />
            ) : chapters.length === 0 ? (
              <div className="p-8 text-center text-sm dark:text-slate-400 text-slate-500 dark:bg-[#1E293B] bg-white rounded-3xl border dark:border-slate-700/60 border-slate-200">
                <p>No chapters are available yet. Check back soon for new study content.</p>
              </div>
            ) : (
              chapters.map((chapter) => {
                const parentFolder = folderById.get(chapter.folder_id);
                return (
                  <div
                    key={chapter.id}
                    className="p-3.5 rounded-2xl dark:bg-[#1E293B]/80 bg-white border dark:border-slate-700/60 border-slate-200 flex items-center justify-between gap-3 hover:border-indigo-500 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-xl dark:bg-indigo-500/10 bg-indigo-50 border dark:border-indigo-500/20 border-indigo-200 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
                        <BookOpen size={18} />
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 truncate">
                          {chapter.title}
                        </h4>
                        <div className="text-sm dark:text-slate-400 text-slate-500 truncate">
                          {parentFolder?.title || chapter.subject || 'Chapter Practice'} · {chapter.estimated_study_time_minutes || 30} mins
                        </div>
                      </div>
                    </div>

                    <Link
                      to={`/chapter/${chapter.id}`}
                      className="px-3.5 py-1.5 rounded-xl dark:bg-indigo-500/20 bg-indigo-100 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 border dark:border-indigo-400/40 border-indigo-300 dark:text-indigo-300 text-indigo-800 font-bold text-xs shrink-0 transition-colors min-h-[44px] flex items-center"
                    >
                      Open Chapter
                    </Link>
                  </div>
                );
              })
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
                <Search size={14} className="absolute left-3 top-2.5 dark:text-slate-400 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl dark:bg-slate-900 bg-white border dark:border-slate-700/60 border-slate-300 dark:text-white text-slate-900 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 min-h-[44px]"
                />
              </div>

              <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-0.5">
                {['all', 'free', 'chapter'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTestFilter(f)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition-colors min-h-[44px] ${
                      testFilter === f
                        ? 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white shadow-glowIndigo'
                        : 'dark:bg-slate-800 bg-white border dark:border-slate-700/60 border-slate-300 dark:text-slate-300 text-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f} Tests
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <LoadingSkeleton count={3} />
            ) : filteredTests.length === 0 ? (
              <div className="p-8 text-center text-xs dark:text-slate-400 text-slate-500 dark:bg-[#1E293B]/60 bg-white rounded-2xl border dark:border-slate-700/60 border-slate-200">
                <p>No tests match these filters. Try clearing a filter or check back later.</p>
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

                  return (
                    <div
                      key={test.id}
                      className="p-4 sm:p-6 rounded-3xl dark:bg-[#1E293B] bg-white border dark:border-slate-700/60 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black dark:text-white text-slate-900">{test.title}</h4>
                          {test.is_free ? (
                            <span className="px-2 py-0.2 rounded text-[9px] font-black dark:bg-emerald-500/20 bg-emerald-100 dark:text-emerald-300 text-emerald-600 border dark:border-emerald-500/30 border-emerald-300">
                              FREE
                            </span>
                          ) : (
                            <span className="px-2 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                              ₹{test.price || 49}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 text-sm dark:text-slate-400 text-slate-600">
                          <span>⏱️ {test.duration_minutes || 60} mins</span>
                          <span>•</span>
                          <span>❓ {qCount > 0 ? `${qCount} Questions` : 'Question count unavailable'}</span>
                          {completedAttempt && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-500 dark:text-emerald-400 font-bold">
                                Last Score: {completedAttempt.score}/{completedAttempt.total_questions}
                              </span>
                            </>
                          )}
                        </div>
                        {test.coin_reward_enabled && (
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            Rewards enabled for qualifying attempts.
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
                            Retake
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
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                              : completedAttempt
                                ? 'dark:bg-slate-800 bg-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-glowIndigo'
                          }`}
                          onMouseEnter={warmQuiz}
                          onTouchStart={warmQuiz}
                        >
                          {resumableAttempt ? <Play size={13} fill="currentColor" /> : completedAttempt ? <CheckCircle2 size={15} /> : <Play size={13} fill="currentColor" />}
                          <span>{resumableAttempt ? 'Resume' : completedAttempt ? 'Review result' : 'Start Test'}</span>
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
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <SlidersHorizontal size={23} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black dark:text-white text-slate-900">Custom Practice is coming soon</h3>
              <p className="text-sm dark:text-slate-400 text-slate-600">
                We are building a reliable question generator for folder, difficulty, and question-count controls. Your selections will be available here once the session can honour them end to end.
              </p>
            </div>
            <Link
              to="/tests?tab=tests"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white font-black text-sm min-h-[44px] shadow-glowIndigo"
            >
              <Play size={15} fill="currentColor" />
              <span>Choose an available test</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
