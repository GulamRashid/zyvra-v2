import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coins,
  FileQuestion,
  Filter,
  Flame,
  HelpCircle,
  LockKeyhole,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useThemeLanguage } from '../../context/ThemeLanguageContext';
import useContentCatalog from '../../hooks/useContentCatalog';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { TEST_PATTERNS } from '../../lib/tests';

function isComplete(attempt) {
  const status = String(attempt.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt.completed_at || attempt.submitted_at || attempt.finished_at);
}

function getPatternLabel(patternValue) {
  const found = TEST_PATTERNS.find((item) => item.value === patternValue);
  return found ? found.label : patternValue || 'Standard';
}

function classifyTest(test) {
  const title = String(test.title || '').toLowerCase();
  const pattern = String(test.pattern || '').toLowerCase();
  const duration = Number(test.duration_minutes || 0);

  const categories = ['all'];

  // Mock exams: mock in title, duration >= 60 min, or BPSC mandatory pattern
  if (title.includes('mock') || title.includes('full') || duration >= 60 || pattern.includes('mandatory')) {
    categories.push('mock');
  }

  // Daily practice: daily / quick / practice in title, or duration <= 25 min
  if (title.includes('daily') || title.includes('practice') || title.includes('quick') || duration <= 25) {
    categories.push('daily');
  }

  // Chapter tests: linked to a chapter or chapter in title
  if (test.chapter_id || title.includes('chapter') || !categories.includes('mock')) {
    categories.push('chapter');
  }

  return categories;
}

export default function TestHub() {
  const { user, supabase } = useAuth();
  const { t, language } = useThemeLanguage();
  const { chapters, folders, exams, loading: catalogLoading } = useContentCatalog();
  const navigate = useNavigate();
  const location = useLocation();

  const [tests, setTests] = useState([]);
  const [questionCounts, setQuestionCounts] = useState({});
  const [userAttempts, setUserAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [feedbackNotice, setFeedbackNotice] = useState('');

  // Chapter & Exam lookup maps
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const examById = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  const loadTestData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      // 1. Fetch published tests
      const { data: testRows, error: testError } = await supabase
        .from('tests')
        .select('id, title, slug, instructions, pattern, duration_minutes, attempt_limit, positive_marks, negative_marks, mandatory_option_e_penalty, coin_reward_enabled, chapter_id, status, created_at')
        .in('status', ['published', 'live', 'available'])
        .order('created_at', { ascending: false });

      if (testError) throw testError;
      setTests(testRows || []);

      // 2. Fetch question counts from test_questions
      const { data: qRows, error: qError } = await supabase
        .from('test_questions')
        .select('test_id');

      if (!qError && qRows) {
        const counts = {};
        qRows.forEach((row) => {
          counts[row.test_id] = (counts[row.test_id] || 0) + 1;
        });
        setQuestionCounts(counts);
      }

      // 3. Fetch user attempts if logged in
      if (user) {
        const { data: attemptRows, error: attemptError } = await supabase
          .from('test_attempts')
          .select('id, test_id, user_id, score, total_score, total_marks, percentage, status, started_at, completed_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!attemptError && attemptRows) {
          setUserAttempts(attemptRows);
        }
      }
    } catch (err) {
      console.error('Failed to load test hub:', err);
      setError(err.message || 'Unable to load tests.');
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    loadTestData();
  }, [loadTestData]);

  // Aggregate user attempt status per test
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

  // Available subjects for filtering
  const allSubjects = useMemo(() => {
    const subjects = new Set();
    tests.forEach((test) => {
      const chapter = chapterById.get(test.chapter_id);
      if (chapter?.subject) subjects.add(chapter.subject);
    });
    return Array.from(subjects).sort();
  }, [tests, chapterById]);

  // Processed tests with metadata
  const processedTests = useMemo(() => {
    return tests.map((test) => {
      const chapter = chapterById.get(test.chapter_id);
      const folder = chapter ? folderById.get(chapter.folder_id) : null;
      const exam = folder ? examById.get(folder.exam_id) : null;
      const categories = classifyTest(test);
      const questionCount = questionCounts[test.id] || 0;
      const attempts = attemptsByTestId.get(test.id) || [];
      const completedAttempts = attempts.filter(isComplete);
      const incompleteAttempt = attempts.find((a) => !isComplete(a) && ['started', 'in_progress', 'pending'].includes(String(a.status || '').toLowerCase()));
      const limit = Number(test.attempt_limit || 1);
      const exhausted = user && completedAttempts.length >= limit;

      let bestScore = null;
      let latestCompleted = null;
      if (completedAttempts.length > 0) {
        latestCompleted = completedAttempts[0];
        const scores = completedAttempts.map((a) => Number(a.percentage ?? ((a.score / (a.total_marks || 1)) * 100))).filter(Number.isFinite);
        if (scores.length > 0) bestScore = Math.max(...scores);
      }

      let attemptStatus = 'not_started';
      if (incompleteAttempt) {
        attemptStatus = 'in_progress';
      } else if (completedAttempts.length > 0) {
        attemptStatus = 'completed';
      }

      return {
        ...test,
        chapter,
        folder,
        exam,
        categories,
        questionCount,
        attemptsCount: completedAttempts.length,
        attemptLimit: limit,
        exhausted,
        incompleteAttempt,
        latestCompleted,
        bestScore,
        attemptStatus,
        subject: chapter?.subject || 'General'
      };
    });
  }, [tests, chapterById, folderById, examById, questionCounts, attemptsByTestId, user]);

  // Real-time filtering by search, category, and subject
  const filteredTests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return processedTests.filter((test) => {
      // Category filter
      if (activeCategory !== 'all' && !test.categories.includes(activeCategory)) {
        return false;
      }
      // Subject filter
      if (selectedSubject !== 'all' && test.subject !== selectedSubject) {
        return false;
      }
      // Search query
      if (query) {
        const titleMatch = test.title.toLowerCase().includes(query);
        const subjectMatch = test.subject.toLowerCase().includes(query);
        const chapterMatch = test.chapter?.title?.toLowerCase().includes(query);
        const examMatch = test.exam?.title?.toLowerCase().includes(query);
        if (!titleMatch && !subjectMatch && !chapterMatch && !examMatch) {
          return false;
        }
      }
      return true;
    });
  }, [processedTests, activeCategory, selectedSubject, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: processedTests.length, chapter: 0, mock: 0, daily: 0 };
    processedTests.forEach((test) => {
      test.categories.forEach((cat) => {
        if (cat !== 'all') counts[cat] = (counts[cat] || 0) + 1;
      });
    });
    return counts;
  }, [processedTests]);

  // Overall statistics for user
  const stats = useMemo(() => {
    const completedCount = processedTests.filter((t) => t.attemptStatus === 'completed').length;
    const inProgressCount = processedTests.filter((t) => t.attemptStatus === 'in_progress').length;
    return {
      total: processedTests.length,
      completed: completedCount,
      inProgress: inProgressCount
    };
  }, [processedTests]);

  const handleStartOrResume = (test) => {
    if (!user) {
      setFeedbackNotice('Please log in to attempt practice tests.');
      return;
    }
    if (test.exhausted && !test.incompleteAttempt) {
      setFeedbackNotice(`You have reached the limit of ${test.attemptLimit} attempt(s) for this test.`);
      return;
    }
    sessionStorage.setItem('last_quiz_return_url', location.pathname);
    navigate(`/quiz/${test.id}`, { state: { returnTo: location.pathname } });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setSelectedSubject('all');
  };

  return (
    <div className="test-hub-page w-full min-w-0 overflow-x-hidden">
      {/* Header Banner */}
      <section className="test-hub-hero">
        <div className="test-hub-hero-content">
          <div className="eyebrow flex items-center gap-2">
            <Sparkles size={14} /> ASSESSMENT & PRACTICE HUB
          </div>
          <h1>Practice & Tests</h1>
          <p>
            Build exam temperament with real pattern timed assessments, chapter tests, and comprehensive mock exams.
          </p>

          {/* Quick Stats Badges */}
          <div className="test-hub-stats-row">
            <div className="test-stat-chip">
              <ClipboardList size={16} className="text-amber-400" />
              <span>
                <strong>{stats.total}</strong> Available tests
              </span>
            </div>
            {user && (
              <>
                <div className="test-stat-chip">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>
                    <strong>{stats.completed}</strong> Completed
                  </span>
                </div>
                {stats.inProgress > 0 && (
                  <div className="test-stat-chip in-progress">
                    <Flame size={16} className="text-amber-500 animate-pulse" />
                    <span>
                      <strong>{stats.inProgress}</strong> In progress
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {feedbackNotice && (
        <div className="feedback success-feedback my-4 flex items-center justify-between">
          <span>{feedbackNotice}</span>
          <button
            type="button"
            onClick={() => setFeedbackNotice('')}
            className="text-xs underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && <div className="feedback error-feedback my-4">{error}</div>}

      {/* Filter and Search Bar Toolbar */}
      <section className="test-hub-toolbar">
        {/* Search Input */}
        <div className="test-search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="test-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tests by title, subject, chapter or exam…"
            aria-label="Search tests"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="test-filter-pills min-w-0" role="tablist" aria-label="Test categories">
          {[
            { id: 'all', label: 'All Tests', count: categoryCounts.all },
            { id: 'chapter', label: 'Chapter tests', count: categoryCounts.chapter },
            { id: 'mock', label: 'Mock exams', count: categoryCounts.mock },
            { id: 'daily', label: 'Daily practice', count: categoryCounts.daily }
          ].map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeCategory === id}
              className={`test-filter-pill ${activeCategory === id ? 'active' : ''}`}
              onClick={() => setActiveCategory(id)}
            >
              <span>{label}</span>
              <span className="pill-count">{count}</span>
            </button>
          ))}
        </div>

        {/* Optional Subject Filter dropdown if subjects exist */}
        {allSubjects.length > 0 && (
          <div className="subject-filter-dropdown">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-input"
              aria-label="Filter by subject"
            >
              <option value="all">All Subjects</option>
              {allSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      {loading || catalogLoading ? (
        <LoadingSkeleton message="Loading assessment tests..." />
      ) : filteredTests.length === 0 ? (
        <div className="empty-content test-hub-empty my-8">
          <FileQuestion size={36} className="text-amber-400 mb-2" />
          <h3>No tests found</h3>
          <p>
            {searchQuery || activeCategory !== 'all' || selectedSubject !== 'all'
              ? 'No tests matched your active search or filters. Try adjusting them.'
              : 'There are no published tests available right now. Check back soon!'}
          </p>
          {(searchQuery || activeCategory !== 'all' || selectedSubject !== 'all') && (
            <button
              type="button"
              className="button button-outline mt-3 min-h-[44px]"
              onClick={clearFilters}
            >
              <RotateCcw size={15} /> Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="test-cards-grid w-full min-w-0">
          {filteredTests.map((test) => {
            const hasIncomplete = Boolean(test.incompleteAttempt);
            const isFinished = test.attemptStatus === 'completed';

            return (
              <article key={test.id} className="test-card panel-card w-full min-w-0 break-words">
                {/* Top Badge Row */}
                <div className="test-card-header">
                  <span className="subject-pill">{test.subject}</span>
                  <div className="flex items-center gap-2">
                    {test.coin_reward_enabled && (
                      <span className="test-reward-badge" title="Coin rewards enabled">
                        <Coins size={12} /> Reward
                      </span>
                    )}
                    <span className="test-pattern-badge">
                      {getPatternLabel(test.pattern)}
                    </span>
                  </div>
                </div>

                {/* Title & Hierarchy Context */}
                <div className="test-card-body">
                  <h3 className="test-card-title">{test.title}</h3>

                  {test.chapter && (
                    <div className="test-card-context">
                      {test.exam?.title && <span>{test.exam.title} · </span>}
                      {test.folder?.title && <span>{test.folder.title} · </span>}
                      <Link
                        to={`/chapter/${test.chapter.id}`}
                        className="hover:underline text-amber-500 font-medium"
                      >
                        {test.chapter.title}
                      </Link>
                    </div>
                  )}

                  {test.instructions && (
                    <p className="test-card-desc">{test.instructions}</p>
                  )}
                </div>

                {/* Meta Row: Duration, Questions, Marks */}
                <div className="test-card-meta">
                  <span title="Test duration">
                    <Clock3 size={14} className="text-amber-400" />
                    {test.duration_minutes} mins
                  </span>
                  <span title="Total questions">
                    <HelpCircle size={14} className="text-amber-400" />
                    {test.questionCount > 0 ? `${test.questionCount} Qs` : 'Questions loaded live'}
                  </span>
                  <span title="Scoring scheme">
                    +{test.positive_marks} / −{test.negative_marks}
                  </span>
                </div>

                {/* Attempt Status Banner */}
                <div className="test-card-status">
                  {hasIncomplete ? (
                    <span className="status-badge in-progress">
                      <Flame size={13} className="text-amber-500" /> Attempt in progress
                    </span>
                  ) : isFinished ? (
                    <span className="status-badge completed">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      Completed
                      {test.bestScore !== null && ` · ${Math.round(test.bestScore)}%`}
                      {test.attemptsCount > 0 && ` (${test.attemptsCount}/${test.attemptLimit})`}
                    </span>
                  ) : (
                    <span className="status-badge not-started">
                      <span className="dot" /> Not started
                    </span>
                  )}
                </div>

                {/* Card Actions */}
                <div className="test-card-actions">
                  {hasIncomplete ? (
                    <button
                      type="button"
                      className="button button-gold w-full min-h-[44px]"
                      onClick={() => handleStartOrResume(test)}
                    >
                      Resume test <ArrowRight size={15} />
                    </button>
                  ) : test.exhausted ? (
                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        className="button button-quiet flex-1 min-h-[44px]"
                        disabled
                      >
                        Limit reached
                      </button>
                      {test.latestCompleted && (
                        <Link
                          to={`/quiz/result/${test.latestCompleted.id}`}
                          className="button button-outline min-h-[44px] px-3"
                          title="View solutions"
                        >
                          View result
                        </Link>
                      )}
                    </div>
                  ) : isFinished ? (
                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        className="button button-gold flex-1 min-h-[44px]"
                        onClick={() => handleStartOrResume(test)}
                      >
                        Retake <RotateCcw size={14} />
                      </button>
                      {test.latestCompleted && (
                        <Link
                          to={`/quiz/result/${test.latestCompleted.id}`}
                          className="button button-outline min-h-[44px] px-3"
                          title="View solutions"
                        >
                          Solutions
                        </Link>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="button button-gold w-full min-h-[44px]"
                      onClick={() => handleStartOrResume(test)}
                    >
                      Start test <Play size={14} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
