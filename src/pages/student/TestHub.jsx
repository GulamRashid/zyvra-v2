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
  const status = String(attempt.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt.completed_at || attempt.submitted_at || attempt.finished_at);
}

// Mockup baseline subjects for Practice Hub
const defaultSubjectsData = [
  {
    id: 'history',
    title: 'Indian History',
    icon: '🏛️',
    chaptersCount: 12,
    questionsCount: 640,
    progress: 72,
    color: 'from-emerald-950/80 to-[#072418]'
  },
  {
    id: 'geography',
    title: 'Geography',
    icon: '🌐',
    chaptersCount: 15,
    questionsCount: 780,
    progress: 58,
    color: 'from-emerald-950/80 to-[#072418]'
  },
  {
    id: 'polity',
    title: 'Indian Polity',
    icon: '⚛️',
    chaptersCount: 14,
    questionsCount: 720,
    progress: 63,
    color: 'from-emerald-950/80 to-[#072418]'
  },
  {
    id: 'economy',
    title: 'Economy',
    icon: '🌱',
    chaptersCount: 10,
    questionsCount: 520,
    progress: 49,
    color: 'from-emerald-950/80 to-[#072418]'
  },
  {
    id: 'science',
    title: 'General Science',
    icon: '👥',
    chaptersCount: 18,
    questionsCount: 1040,
    progress: 67,
    color: 'from-emerald-950/80 to-[#072418]'
  },
  {
    id: 'physiology',
    title: 'Human Physiology',
    icon: '🧘',
    chaptersCount: 8,
    questionsCount: 400,
    progress: 41,
    color: 'from-emerald-950/80 to-[#072418]'
  }
];

export default function TestHub() {
  const { user, supabase } = useAuth();
  const { t, language } = useThemeLanguage();
  const { chapters, folders, exams, loading: catalogLoading } = useContentCatalog();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab State: 'subjects' | 'chapters' | 'tests' | 'custom'
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'mock') return 'tests';
    return 'subjects';
  });

  const [tests, setTests] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({});
  const [userAttempts, setUserAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [testFilter, setTestFilter] = useState('all'); // 'all' | 'mock' | 'chapter' | 'daily'

  // Custom Practice Generator State
  const [customSubject, setCustomSubject] = useState('General Studies');
  const [customQuestionCount, setCustomQuestionCount] = useState(25);
  const [customDifficulty, setCustomDifficulty] = useState('medium');

  // Chapter & Exam lookup maps
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const examById = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  // Fetch tests and user attempts
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

  // Compute Subjects with Dynamic Progress Bars
  const displaySubjects = useMemo(() => {
    // If real catalog folders/subjects exist, combine with baseline progress
    if (folders.length > 0) {
      const subjectFolders = folders.filter((f) => !f.parent_folder_id);
      if (subjectFolders.length > 0) {
        return subjectFolders.slice(0, 8).map((sf, idx) => {
          const fallback = defaultSubjectsData[idx % defaultSubjectsData.length];
          const subjectChapters = chapters.filter((c) => c.folder_id === sf.id);
          const qCount = subjectChapters.reduce((sum, c) => sum + (c.question_count || 40), 0);
          return {
            id: sf.id,
            title: sf.title || fallback.title,
            icon: fallback.icon,
            chaptersCount: Math.max(subjectChapters.length, fallback.chaptersCount),
            questionsCount: Math.max(qCount, fallback.questionsCount),
            progress: fallback.progress,
            folderId: sf.id
          };
        });
      }
    }
    return defaultSubjectsData;
  }, [folders, chapters]);

  // Total Solved vs Total Questions Aggregate Ratio
  const totalQuestionsSum = useMemo(() => {
    return displaySubjects.reduce((sum, s) => sum + s.questionsCount, 0);
  }, [displaySubjects]);

  const totalQuestionsSolved = useMemo(() => {
    const attemptsQuestions = userAttempts.reduce((sum, a) => sum + (Number(a.total_questions) || 20), 0);
    return Math.max(attemptsQuestions, 8460); // Mockup baseline
  }, [userAttempts]);

  // Filtered Tests
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = String(test.title || '').toLowerCase().includes(q);
        const matchesDesc = String(test.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      if (testFilter === 'mock') {
        const title = String(test.title || '').toLowerCase();
        return title.includes('mock') || title.includes('full') || Number(test.duration_minutes) >= 60;
      }
      if (testFilter === 'chapter') {
        return Boolean(test.chapter_id);
      }
      if (testFilter === 'daily') {
        const title = String(test.title || '').toLowerCase();
        return title.includes('daily') || title.includes('quick') || Number(test.duration_minutes) <= 25;
      }
      return true;
    });
  }, [tests, searchQuery, testFilter]);

  // Handle Custom Practice Start
  const handleStartCustomPractice = () => {
    // Pick the first available test or route to test attempt
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
                <span>{language === 'hi' ? 'अभ्यास' : 'Practice'}</span>
              </h1>
              <p className="text-emerald-300/80 text-xs sm:text-sm mt-0.5 font-medium">
                {language === 'hi'
                  ? 'अध्याय-वार अभ्यास, विषय परीक्षण और कस्टम टेस्ट।'
                  : 'Chapter-wise practice, topic tests and custom tests.'}
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
        {/* TAB 1: SUBJECTS (Matching Mockup 1794580723912.png) */}
        {/* ======================================================== */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            {/* Overview Hero Card */}
            <Link
              to="/explore"
              className="block bg-gradient-to-r from-[#0a3525] via-[#06241a] to-[#041911] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-lg transition-transform hover:scale-[1.01] group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-2xl shrink-0">
                    📚
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                      <span>General Studies Master Track</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                        Pro
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-300/80 font-medium mt-0.5">
                      10 Subjects • 320 Chapters • 12,850 Questions
                    </p>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-emerald-300 group-hover:text-white group-hover:scale-110 transition-transform shrink-0">
                  <ChevronRight size={18} />
                </div>
              </div>
            </Link>

            {/* Subject List Cards with Progress Bars (Matching Mockup 1794580723912.png) */}
            <div className="space-y-2.5">
              {displaySubjects.map((subject) => {
                const targetPath = subject.folderId ? `/folder/${subject.folderId}` : '/tests';
                return (
                  <div
                    key={subject.id}
                    className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-xl shrink-0">
                        {subject.icon}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <h4 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                          {subject.title}
                        </h4>
                        <div className="text-xs text-emerald-400/75 font-medium">
                          {subject.chaptersCount} {language === 'hi' ? 'अध्याय' : 'Chapters'} • {subject.questionsCount} {language === 'hi' ? 'प्रश्न' : 'Questions'}
                        </div>

                        {/* Progress Bar (Total Solved vs Total Questions Ratio) */}
                        <div className="flex items-center gap-3 pt-0.5">
                          <div className="flex-1 max-w-xs h-2 bg-emerald-950 rounded-full overflow-hidden border border-emerald-800/40">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-400 to-[#22c55e] rounded-full transition-all duration-700"
                              style={{ width: `${subject.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-emerald-300 shrink-0">
                            {subject.progress}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Play Button */}
                    <Link
                      to={targetPath}
                      className="w-10 h-10 rounded-full bg-[#22c55e] hover:bg-emerald-400 text-black flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-transform hover:scale-110 active:scale-95 shrink-0"
                      aria-label={`Practice ${subject.title}`}
                    >
                      <Play size={18} fill="currentColor" className="ml-0.5 text-black" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CHAPTERS */}
        {/* ======================================================== */}
        {activeTab === 'chapters' && (
          <div className="space-y-3">
            {chapters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {chapters.map((chapter) => (
                  <Link
                    key={chapter.id}
                    to={`/chapter/${chapter.id}`}
                    className="p-4 rounded-2xl bg-[#072117]/85 border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                          {chapter.title}
                        </h4>
                        <p className="text-xs text-emerald-400/70 font-medium">
                          {chapter.question_count || 24} Questions
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-emerald-400/60 group-hover:text-emerald-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#072117]/60 rounded-2xl border border-emerald-500/20">
                <BookOpen size={28} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-bold text-white">No chapters loaded yet.</p>
                <p className="text-xs text-emerald-400/70 mt-1">Explore available exams in the syllabus.</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: TESTS (Mock Tests, Chapter Tests, Daily Practice) */}
        {/* ======================================================== */}
        {activeTab === 'tests' && (
          <div className="space-y-4">
            {/* Search & Filter Chips */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400/60" />
                <input
                  type="text"
                  placeholder="Search tests by title or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#072117] border border-emerald-500/20 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {[
                  ['all', 'All Tests'],
                  ['mock', 'Mock Exams'],
                  ['chapter', 'Chapter Tests'],
                  ['daily', 'Daily Practice']
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTestFilter(val)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                      testFilter === val
                        ? 'bg-emerald-500/30 border border-emerald-400 text-white'
                        : 'bg-[#072117] border border-emerald-500/20 text-emerald-400/80 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Cards List */}
            {loading ? (
              <LoadingSkeleton rows={4} />
            ) : filteredTests.length > 0 ? (
              <div className="space-y-3">
                {filteredTests.map((test) => {
                  const qCount = questionCounts[test.id] || 25;
                  const attempts = attemptsByTestId.get(test.id) || [];
                  const completed = attempts.filter(isComplete);
                  const incomplete = attempts.find((a) => !isComplete(a) && ['started', 'in_progress'].includes(String(a.status || '').toLowerCase()));

                  return (
                    <div
                      key={test.id}
                      className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-emerald-500/40"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            {test.duration_minutes || 30} mins
                          </span>
                          <span className="text-xs text-emerald-400/70 font-semibold">
                            {qCount} Questions
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white">{test.title}</h4>
                        <p className="text-xs text-emerald-300/80 line-clamp-1">
                          {test.instructions || 'Standard test rules apply with time limit.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {incomplete ? (
                          <Link
                            to={`/quiz/${test.id}`}
                            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs shadow-md flex items-center gap-1.5"
                          >
                            <Play size={14} fill="currentColor" />
                            <span>Resume</span>
                          </Link>
                        ) : completed.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/quiz/result/${completed[0].id}`}
                              className="px-3.5 py-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-300 hover:text-white font-bold text-xs"
                            >
                              Solutions
                            </Link>
                            <Link
                              to={`/quiz/${test.id}`}
                              className="px-3.5 py-2 rounded-xl bg-[#22c55e] hover:bg-emerald-400 text-black font-extrabold text-xs flex items-center gap-1.5"
                            >
                              <RotateCcw size={13} />
                              <span>Re-take</span>
                            </Link>
                          </div>
                        ) : (
                          <Link
                            to={`/quiz/${test.id}`}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
                          >
                            <Play size={14} fill="currentColor" />
                            <span>Start Test</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#072117]/60 rounded-2xl border border-emerald-500/20">
                <Target size={28} className="mx-auto text-emerald-400 mb-2" />
                <p className="text-sm font-bold text-white">No tests match your filter.</p>
                <p className="text-xs text-emerald-400/70 mt-1">Try clearing the search query or selecting All Tests.</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: CUSTOM PRACTICE GENERATOR */}
        {/* ======================================================== */}
        {activeTab === 'custom' && (
          <div className="bg-[#072117]/85 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-amber-400" />
                <span>Custom Practice Test Generator</span>
              </h3>
              <p className="text-xs text-emerald-300/80 mt-1">
                Customize your practice session by choosing topic, question volume, and difficulty.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1.5">
                  Select Focus Subject
                </label>
                <select
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400"
                >
                  <option value="General Studies">General Studies (Mixed)</option>
                  <option value="Indian History">Indian History</option>
                  <option value="Geography">Geography</option>
                  <option value="Indian Polity">Indian Polity</option>
                  <option value="Economy">Economy</option>
                  <option value="General Science">General Science</option>
                  <option value="Human Physiology">Human Physiology</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1.5">
                  Question Count
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 30, 50].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setCustomQuestionCount(count)}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition-colors ${
                        customQuestionCount === count
                          ? 'bg-amber-400 border-amber-400 text-black shadow-md'
                          : 'bg-emerald-950/60 border-emerald-500/20 text-emerald-300 hover:text-white'
                      }`}
                    >
                      {count} Qs
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-300 block mb-1.5">
                  Difficulty Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['easy', 'Easy'],
                    ['medium', 'Medium'],
                    ['hard', 'Challenging']
                  ].map(([lvl, label]) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCustomDifficulty(lvl)}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition-colors ${
                        customDifficulty === lvl
                          ? 'bg-emerald-500/30 border-emerald-400 text-white'
                          : 'bg-emerald-950/60 border-emerald-500/20 text-emerald-400/80 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartCustomPractice}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black font-black text-sm shadow-[0_4px_20px_rgba(245,197,66,0.3)] transition-transform hover:scale-[1.02] active:scale-98 flex items-center justify-center gap-2"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Generate & Start Practice ({customQuestionCount} Qs)</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
