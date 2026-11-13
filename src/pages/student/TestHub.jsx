import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Coins,
  Compass,
  FileQuestion,
  Filter,
  Flame,
  GraduationCap,
  HelpCircle,
  Layers,
  LockKeyhole,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import MountainSunsetAura from '../../components/common/MountainSunsetAura';
import { TEST_PATTERNS } from '../../lib/tests';

function isComplete(attempt) {
  const status = String(attempt?.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt?.completed_at || attempt?.submitted_at || attempt?.finished_at);
}

export default function TestHub() {
  const { user, supabase } = useAuth();
  const { t, language } = useThemeLanguage();
  const { chapters, folders, exams, loading: catalogLoading } = useContentCatalog();
  const navigate = useNavigate();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [testFilter, setTestFilter] = useState('all'); // 'all' | 'free' | 'chapter'

  // Custom Practice Generator State
  const [customFolderId, setCustomFolderId] = useState('');
  const [customQuestionCount, setCustomQuestionCount] = useState(25);
  const [customDifficulty, setCustomDifficulty] = useState('medium');

  // Chapter & Exam lookup maps
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const examById = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  // Fetch tests and user attempts strictly from Supabase
  const loadTestData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: testRows } = await supabase
        .from('tests')
        .select('*')
        .in('status', ['published', 'live', 'available'])
        .order('created_at', { ascending: false });

      setTests(testRows || []);

      const { data: qRows } = await supabase
        .from('test_questions')
        .select('test_id');

      if (qRows) {
        const counts = {};
        qRows.forEach((row) => {
          counts[row.test_id] = (counts[row.test_id] || 0) + 1;
        });
        setQuestionCounts(counts);
      }

      if (user) {
        const { data: attemptRows } = await supabase
          .from('test_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (attemptRows) {
          setUserAttempts(attemptRows);
        }
      }
    } catch (err) {
      console.error('Failed to load test hub:', err);
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
      const qCount = subjectTests.reduce((sum, t) => sum + (questionCounts[t.id] || 20), 0)
        || subjectChapters.reduce((sum, c) => sum + (Number(c.question_count) || 15), 0);

      // Solved questions by user in this subject
      const solvedInSubject = userAttempts
        .filter((att) => subjectTests.some((t) => t.id === att.test_id))
        .reduce((sum, att) => sum + Number(att.score || att.answered_count || 0), 0);

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
    return tests.reduce((sum, t) => sum + (questionCounts[t.id] || 20), 0)
      || chapters.reduce((sum, c) => sum + (Number(c.question_count) || 15), 0);
  }, [tests, questionCounts, chapters]);

  const totalQuestionsSolved = useMemo(() => {
    return userAttempts
      .filter(isComplete)
      .reduce((sum, a) => sum + (Number(a.score || a.answered_count || 0)), 0);
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

  // Handle Custom Practice Start
  const handleStartCustomPractice = () => {
    if (tests.length > 0) {
      navigate(`/quiz/${tests[0].id}`);
    } else {
      navigate('/explore');
    }
  };

  return (
    <div className="min-h-screen bg-[#04140e] text-[#f0fdf4] pb-28 md:pb-12">
      {/* Top Ambient Mountain Aura */}
      <div className="relative">
        <MountainSunsetAura height={190} showSun={true} />

        {/* Practice Hub Header */}
        <div className="px-4 sm:px-6 pt-4 pb-2 relative z-10 max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{language === 'hi' ? 'अभ्यास' : 'Practice Hub'}</span>
              </h1>
              <p className="text-emerald-300/80 text-xs sm:text-sm mt-0.5 font-medium">
                {language === 'hi'
                  ? 'अध्याय-वार अभ्यास, विषय परीक्षण और कस्टम टेस्ट।'
                  : 'Chapter-wise practice, topic tests and full syllabus assessments.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 max-w-5xl mx-auto space-y-5 -mt-2 relative z-10">
        {/* Navigation Tabs (Subjects | Chapters | Tests | Custom) */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#072117]/90 border border-emerald-500/20 backdrop-blur-md overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('subjects')}
            className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'subjects'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
            }`}
          >
            <Layers size={15} />
            <span>{language === 'hi' ? 'विषय' : 'Subjects'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chapters')}
            className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'chapters'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
            }`}
          >
            <BookOpen size={15} />
            <span>{language === 'hi' ? 'अध्याय' : 'Chapters'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tests'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
            }`}
          >
            <Target size={15} />
            <span>{language === 'hi' ? 'परीक्षण' : 'Tests'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'custom'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black shadow-md'
                : 'text-emerald-300 hover:text-white hover:bg-emerald-950/60'
            }`}
          >
            <SlidersHorizontal size={15} />
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
              <div className="bg-gradient-to-r from-[#0a3525] via-[#06241a] to-[#041911] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shrink-0">
                      🎓
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                        <span>{exams[0]?.title} Syllabus Track</span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                          Active
                        </span>
                      </h3>
                      <p className="text-xs text-emerald-300/80 font-medium mt-0.5">
                        {folders.length} Subjects/Folders · {chapters.length} Chapters · {tests.length} Tests
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/explore/${exams[0]?.slug || exams[0]?.id}`}
                    className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs shadow-sm transition-transform active:scale-95"
                  >
                    <span>View Syllabus</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>

                {/* Progress bar */}
                <div className="mt-4 pt-3 border-t border-emerald-800/40">
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-emerald-300">Overall Track Completion</span>
                    <span className="text-amber-300 font-bold">
                      {totalQuestionsSolved} / {totalQuestionsSum} Solved ({aggregateProgressPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-emerald-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-[#22c55e] rounded-full transition-all duration-700"
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
              <div className="p-8 text-center text-xs text-emerald-400/70 bg-[#072117]/60 rounded-2xl border border-emerald-500/20">
                <p>No subject folders found in database.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {displaySubjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-[#072418] border border-emerald-500/25 flex flex-col justify-between space-y-3 transition-all hover:border-emerald-400 hover:scale-[1.01]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{subject.icon}</span>
                        <div>
                          <h4 className="text-sm font-black text-white">{subject.title}</h4>
                          <span className="text-[10px] text-emerald-300/80">
                            {subject.chaptersCount} Chapters · {subject.questionsCount} Questions
                          </span>
                        </div>
                      </div>

                      {/* Play Action */}
                      <Link
                        to={subject.firstTestId ? `/quiz/${subject.firstTestId}` : `/folder/${subject.folderId}`}
                        className="w-8 h-8 rounded-full bg-[#22c55e] hover:bg-emerald-400 text-black flex items-center justify-center shadow-sm transition-transform hover:scale-110 active:scale-95 shrink-0"
                        title="Start Practice"
                      >
                        <Play size={14} fill="currentColor" className="ml-0.5 text-black" />
                      </Link>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 mb-1">
                        <span>Solved</span>
                        <span>{subject.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-[#22c55e] rounded-full transition-all duration-500"
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
              <div className="p-8 text-center text-xs text-emerald-400/70 bg-[#072117]/60 rounded-2xl border border-emerald-500/20">
                <p>No chapters available in database.</p>
              </div>
            ) : (
              chapters.map((chapter) => {
                const parentFolder = folderById.get(chapter.folder_id);
                return (
                  <div
                    key={chapter.id}
                    className="p-3.5 rounded-2xl bg-[#072117]/80 border border-emerald-500/25 flex items-center justify-between gap-3 hover:border-emerald-400 transition-colors"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-teal-400 shrink-0">
                        <BookOpen size={18} />
                      </div>
                      <div className="truncate">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {chapter.title}
                        </h4>
                        <div className="text-[10px] text-emerald-400/80 truncate">
                          {parentFolder?.title || chapter.subject || 'Chapter Practice'} · {chapter.estimated_study_time_minutes || 30} mins
                        </div>
                      </div>
                    </div>

                    <Link
                      to={`/chapter/${chapter.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold text-xs shrink-0 transition-colors"
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
                <Search size={14} className="absolute left-3 top-2.5 text-emerald-400/60" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-white text-xs placeholder:text-emerald-400/50 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto">
                {['all', 'free', 'chapter'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTestFilter(f)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold capitalize transition-colors ${
                      testFilter === f
                        ? 'bg-amber-400 text-black shadow-sm'
                        : 'bg-emerald-950/80 border border-emerald-500/20 text-emerald-300 hover:text-white'
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
              <div className="p-8 text-center text-xs text-emerald-400/70 bg-[#072117]/60 rounded-2xl border border-emerald-500/20">
                <p>No tests matching criteria found in database.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTests.map((test) => {
                  const attempts = attemptsByTestId.get(test.id) || [];
                  const lastAttempt = attempts[0];
                  const qCount = questionCounts[test.id] || 20;

                  return (
                    <div
                      key={test.id}
                      className="p-4 rounded-2xl bg-gradient-to-r from-[#072117] to-[#041810] border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-400 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-white">{test.title}</h4>
                          {test.is_free ? (
                            <span className="px-2 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              FREE
                            </span>
                          ) : (
                            <span className="px-2 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ₹{test.price || 49}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-emerald-400/80">
                          <span>⏱️ {test.duration_minutes || 60} mins</span>
                          <span>•</span>
                          <span>❓ {qCount} Questions</span>
                          {lastAttempt && (
                            <>
                              <span>•</span>
                              <span className="text-amber-300 font-bold">
                                Last Score: {lastAttempt.score}/{lastAttempt.total_questions}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {lastAttempt && (
                          <Link
                            to={`/quiz/${test.id}/result`}
                            className="px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:text-white transition-colors"
                          >
                            Analysis
                          </Link>
                        )}
                        <Link
                          to={`/quiz/${test.id}`}
                          className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black shadow-glowGold transition-transform active:scale-95 flex items-center gap-1.5"
                        >
                          <Play size={13} fill="currentColor" />
                          <span>{lastAttempt ? 'Retake' : 'Start Test'}</span>
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
          <div className="p-6 rounded-3xl bg-[#072117]/90 border border-emerald-500/25 max-w-xl mx-auto space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-white">Create Custom Practice Test</h3>
              <p className="text-xs text-emerald-300/80">
                Select your target folder and question volume to start.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">Target Folder</label>
                <select
                  value={customFolderId}
                  onChange={(e) => setCustomFolderId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-white text-xs font-bold focus:outline-none"
                >
                  <option value="">All Available Folders</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">
                  Questions: {customQuestionCount}
                </label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="5"
                  value={customQuestionCount}
                  onChange={(e) => setCustomQuestionCount(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1">Difficulty</label>
                <div className="grid grid-cols-3 gap-2">
                  {['easy', 'medium', 'hard'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCustomDifficulty(d)}
                      className={`py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                        customDifficulty === d
                          ? 'bg-amber-400 text-black shadow-sm'
                          : 'bg-emerald-950 border border-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleStartCustomPractice}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-xs shadow-glowGold transition-transform hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-1.5"
                >
                  <Play size={15} fill="currentColor" />
                  <span>Start Practice Session</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
