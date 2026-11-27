import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, Target, Trophy } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useStudentStats } from '../../context/StudentStatsContext';
import { getFriendlyErrorMessage } from '../../lib/errors';
import { computeAttemptScorePercentage } from '../../lib/studentStats';

const QUERY_PAGE_SIZE = 1000;
const ID_BATCH_SIZE = 500;

async function fetchAllPages(makeQuery) {
  const rows = [];
  for (let offset = 0; ; offset += QUERY_PAGE_SIZE) {
    const { data, error } = await makeQuery(offset, offset + QUERY_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < QUERY_PAGE_SIZE) return rows;
  }
}

async function fetchByIds(makeQuery, ids) {
  const rows = [];
  for (let index = 0; index < ids.length; index += ID_BATCH_SIZE) {
    const batch = ids.slice(index, index + ID_BATCH_SIZE);
    rows.push(...await fetchAllPages((start, end) => makeQuery(batch).range(start, end)));
  }
  return rows;
}

function numberFrom(row, keys, fallback = 0) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null && Number.isFinite(Number(row[key]))) return Number(row[key]);
  }
  return fallback;
}

function scorePercentage(attempt) {
  return computeAttemptScorePercentage(attempt);
}

function optionECount(attempt, responses) {
  const explicit = numberFrom(attempt, ['option_e_penalty_count', 'blank_penalty_count', 'option_e_penalties']);
  if (explicit) return explicit;
  return responses.filter((response) =>
    response.blank_penalty === true
    || response.option_e_penalty === true
    || response.blank_penalty_applied === true
    || (Number(response.blank_penalty_amount || response.option_e_penalty_amount) > 0)
  ).length;
}

export default function StudentAnalytics() {
  const navigate = useNavigate();
  const { user, supabase } = useAuth();
  const {
    completedAttempts: attempts,
    responses,
    testsAttempted,
    accuracy,
    averageScore,
    currentStreak,
    loading: statsLoading,
    error: statsError
  } = useStudentStats();
  const [questions, setQuestions] = useState({});
  const [tests, setTests] = useState({});
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState('');

  useEffect(() => {
    let active = true;
    const loadMetadata = async () => {
      if (statsLoading) return;
      if (!supabase || !user) {
        if (active) {
          setMetaError('Sign in to view your learning analytics.');
          setMetaLoading(false);
        }
        return;
      }
      if (!attempts.length) {
        if (active) {
          setQuestions({});
          setTests({});
          setMetaLoading(false);
        }
        return;
      }

      setMetaLoading(true);
      setMetaError('');
      try {
        const questionIds = [...new Set(responses.map((response) => response.question_id).filter(Boolean))];
        const testIds = [...new Set(attempts.map((attempt) => attempt.test_id).filter(Boolean))];
        const [questionRows, testRows] = await Promise.all([
          questionIds.length
            ? fetchByIds((batch) => supabase.rpc('get_published_question_metadata', { p_question_ids: batch }), questionIds)
            : Promise.resolve([]),
          testIds.length
            ? fetchByIds((batch) => supabase.from('tests').select('id,title').in('id', batch), testIds)
            : Promise.resolve([])
        ]);
        if (!active) return;
        setQuestions(Object.fromEntries(questionRows.map((question) => [question.id, question])));
        setTests(Object.fromEntries(testRows.map((test) => [test.id, test])));
      } catch (loadError) {
        if (active) {
          setMetaError(getFriendlyErrorMessage(loadError, 'Unable to load your performance analytics.'));
        }
      } finally {
        if (active) setMetaLoading(false);
      }
    };
    loadMetadata();
    return () => { active = false; };
  }, [supabase, user, attempts, responses, statsLoading]);

  const loading = statsLoading || metaLoading;
  const error = metaError || statsError;

  const responseByAttempt = useMemo(() => responses.reduce((map, response) => {
    const key = response.attempt_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(response);
    return map;
  }, new Map()), [responses]);

  const stats = useMemo(() => ({
    total: testsAttempted,
    accuracy,
    averageScore,
    streak: currentStreak
  }), [testsAttempted, accuracy, averageScore, currentStreak]);

  const subjectStats = useMemo(() => {
    const subjects = new Map();
    responses.forEach((response) => {
      if (response.selected_option === null || response.selected_option === undefined || response.selected_option === '') return;
      const question = questions[response.question_id];
      const subject = response.subject || question?.subject || question?.topic || 'General';
      if (!subjects.has(subject)) subjects.set(subject, { total: 0, correct: 0 });
      const entry = subjects.get(subject);
      entry.total += 1;
      if (response.is_correct === true || response.correct === true || response.was_correct === true) entry.correct += 1;
    });
    return [...subjects.entries()].map(([subject, values]) => ({
      subject,
      count: values.total,
      accuracy: values.total ? values.correct / values.total * 100 : 0
    })).sort((left, right) => right.count - left.count);
  }, [responses, questions]);

  return (
    <div className="w-full max-w-4xl min-w-0 mx-auto space-y-4 sm:space-y-6 pb-6 text-slate-900 dark:text-slate-100">
      {/* Page Heading Banner */}
        <div className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#1E293B] dark:to-[#0B1120] bg-gradient-to-br from-indigo-50 via-slate-50 to-white border dark:border-indigo-500/25 border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                type="button"
                onClick={() => {
                  if (window.history.state && window.history.state.idx > 0) {
                    navigate(-1);
                  } else {
                    navigate('/tests', { replace: true });
                  }
                }}
                className="w-7 h-7 rounded-lg dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white shrink-0 shadow-xs active:scale-95 transition-all"
                aria-label="Back"
              >
                <ArrowLeft size={14} />
              </button>
              <span className="text-[10px] uppercase font-bold text-indigo-500 dark:text-indigo-400 tracking-wider">
                Your Learning Journey
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
              Performance Analytics
            </h1>
            <p className="text-xs sm:text-sm dark:text-slate-300 text-slate-600 font-medium mt-0.5">
              See your progress, identify strong subjects and revisit completed tests.
            </p>
          </div>

          <Link
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black inline-flex items-center gap-1.5 shrink-0 min-h-[44px]"
            to="/tests"
          >
            <span>Practice more</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {error && (
          <div className="p-3 rounded-2xl dark:bg-rose-950/40 bg-rose-50 border dark:border-rose-500/30 border-rose-200 text-rose-600 dark:text-rose-300 text-xs font-bold">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton variant="dashboard" />
        ) : (
          <>
            {/* 4 Analytics Stat Cards (2x2 on mobile 360px, 4 across on desktop) */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-indigo-500/20 bg-indigo-100 text-indigo-400 flex items-center justify-center mb-1">
                  <CheckCircle2 size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold dark:text-slate-400 text-slate-500">
                  Tests taken
                </small>
                <strong className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {stats.total}
                </strong>
                <span className="text-sm dark:text-slate-400 text-slate-500">Completed attempts</span>
              </article>

              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-emerald-500/20 bg-emerald-100 text-emerald-400 flex items-center justify-center mb-1">
                  <Target size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold dark:text-slate-400 text-slate-500">
                  Overall accuracy
                </small>
                <strong className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {stats.accuracy.toFixed(1)}%
                </strong>
                <span className="text-sm dark:text-slate-400 text-slate-500">Correct answers</span>
              </article>

              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-cyan-500/20 bg-cyan-100 text-cyan-400 flex items-center justify-center mb-1">
                  <BarChart3 size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold dark:text-slate-400 text-slate-500">
                  Average score
                </small>
                <strong className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {stats.averageScore.toFixed(1)}%
                </strong>
                <span className="text-sm dark:text-slate-400 text-slate-500">Across scored tests</span>
              </article>

              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-orange-500/30 border-orange-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-orange-500/20 bg-orange-100 text-orange-500 flex items-center justify-center mb-1 shadow-xs">
                  <Trophy size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold text-orange-500 dark:text-orange-400">
                  Current streak
                </small>
                <strong className="text-lg sm:text-2xl font-black text-orange-500 dark:text-orange-400 tracking-tight">
                  {stats.streak}d
                </strong>
                <span className="text-sm dark:text-slate-400 text-slate-500">Consecutive days</span>
              </article>
            </section>

            {/* Detailed Grids: Subject Accuracy & Recent Attempts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Subject-wise Accuracy */}
              <section className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                      Find Your Edge
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">Subject-wise accuracy</h2>
                  </div>
                  <Target size={18} className="text-indigo-400" />
                </div>

                {!subjectStats.length ? (
                  <div className="p-6 text-center space-y-2 dark:text-slate-400 text-slate-500 text-xs">
                    <BarChart3 size={24} className="mx-auto text-indigo-400 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">Subject insights will appear here.</strong>
                    <span>Complete tests with tagged questions to build this breakdown.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subjectStats.map((item) => (
                      <div key={item.subject} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <strong className="dark:text-white text-slate-900 font-bold">{item.subject}</strong>
                            <span className="text-sm text-slate-400 dark:text-slate-400 ml-2">
                              {item.count} questions
                            </span>
                          </div>
                          <span className="font-extrabold text-emerald-400">{item.accuracy.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full dark:bg-slate-900 bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400"
                            style={{ width: `${Math.min(100, item.accuracy)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Recent Test Attempts */}
              <section className="p-4 sm:p-5 rounded-3xl dark:bg-[#1E293B]/85 bg-white shadow-sm border dark:border-slate-700/60 border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                      Keep Getting Better
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">Recent test attempts</h2>
                  </div>
                  <span className="text-xs font-bold dark:text-indigo-300 text-indigo-800">
                    {attempts.length} completed
                  </span>
                </div>

                {!attempts.length ? (
                  <div className="p-6 text-center space-y-2 dark:text-slate-400 text-slate-500 text-xs">
                    <CalendarDays size={24} className="mx-auto text-indigo-400 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">Your first result is one test away.</strong>
                    <span>Take a mock test and review your solutions here.</span>
                    <div className="pt-2">
                      <Link className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black inline-block" to="/tests">
                        Find a test
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-slate-800 divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
                    {attempts.slice(0, 20).map((attempt) => {
                      const attemptResponses = responseByAttempt.get(attempt.id) || [];
                      const percent = asPercent(numberFrom(attempt, ['percentage', 'score_percentage', 'percentage_score']));
                      const score = numberFrom(attempt, ['score', 'total_score', 'final_score']);
                      const blankCount = optionECount(attempt, attemptResponses);
                      const date = attempt.completed_at || attempt.submitted_at || attempt.finished_at || attempt.created_at;

                      return (
                        <article key={attempt.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-indigo-50 border dark:border-slate-700 border-indigo-200 flex items-center justify-center text-indigo-400 shrink-0">
                              <Trophy size={14} />
                            </div>
                            <div className="min-w-0">
                              <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                                {tests[attempt.test_id]?.title || attempt.test_title || 'Practice test'}
                              </strong>
                              <small className="text-[10px] text-slate-400 dark:text-slate-400 block truncate">
                                {date ? new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date unavailable'} • {attemptResponses.length} questions
                              </small>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <strong className="text-sm font-black dark:text-emerald-400 text-emerald-600 block">
                                {percent ? `${percent.toFixed(1)}%` : score.toLocaleString()}
                              </strong>
                              {blankCount > 0 && (
                                <small className="text-[9px] text-red-500 block">
                                  {blankCount} Opt E
                                </small>
                              )}
                            </div>
                            <Link
                              className="w-8 h-8 rounded-xl dark:bg-slate-800 bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors"
                              aria-label="Review test solutions"
                              to={`/quiz/result/${attempt.id}`}
                            >
                              <ArrowRight size={14} />
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <p className="text-center text-xs dark:text-slate-400 text-slate-500 font-medium pt-2">
              <Clock3 size={13} className="inline mr-1" />
              Accuracy is based on saved response correctness; unavailable score fields are shown as zero until a test is submitted and graded.
            </p>
          </>
        )}
      </div>
  );
}
