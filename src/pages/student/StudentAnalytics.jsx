import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

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

function isComplete(attempt) {
  const status = String(attempt.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt.completed_at || attempt.submitted_at || attempt.finished_at);
}

function asPercent(value) {
  return value > 0 && value <= 1 ? value * 100 : value;
}

function scorePercentage(attempt) {
  for (const key of ['percentage', 'score_percentage', 'percentage_score']) {
    if (attempt[key] !== undefined && attempt[key] !== null && Number.isFinite(Number(attempt[key]))) {
      return asPercent(Number(attempt[key]));
    }
  }
  const score = numberFrom(attempt, ['score', 'total_score', 'final_score'], NaN);
  const total = numberFrom(attempt, ['total_marks', 'maximum_marks'], NaN);
  return Number.isFinite(score) && Number.isFinite(total) && total > 0 ? score / total * 100 : null;
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

function streakDays(attempts) {
  const daySet = new Set(attempts.map((attempt) => {
    const date = attempt.completed_at || attempt.submitted_at || attempt.finished_at || attempt.created_at;
    return date ? new Date(date).toLocaleDateString('en-CA') : null;
  }).filter(Boolean));
  let date = new Date();
  let current = date.toLocaleDateString('en-CA');
  if (!daySet.has(current)) {
    date.setDate(date.getDate() - 1);
    current = date.toLocaleDateString('en-CA');
    if (!daySet.has(current)) return 0;
  }
  let streak = 0;
  while (daySet.has(current)) {
    streak += 1;
    date.setDate(date.getDate() - 1);
    current = date.toLocaleDateString('en-CA');
  }
  return streak;
}

export default function StudentAnalytics() {
  const { user, supabase } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [responses, setResponses] = useState([]);
  const [questions, setQuestions] = useState({});
  const [tests, setTests] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadAnalytics = async () => {
      if (!supabase || !user) throw new Error('Sign in to view your learning analytics.');
      const attemptRows = await fetchAllPages((start, end) => supabase.from('test_attempts').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).range(start, end));
      const completed = (attemptRows || []).filter(isComplete);
      const attemptIds = completed.map((attempt) => attempt.id).filter(Boolean);
      if (!attemptIds.length) {
        if (active) { setAttempts([]); setResponses([]); setLoading(false); }
        return;
      }
      const responseRows = await fetchByIds((batch) => supabase.from('test_responses').select('*').in('attempt_id', batch), attemptIds);
      const responseList = responseRows || [];
      const questionIds = [...new Set(responseList.map((response) => response.question_id).filter(Boolean))];
      const testIds = [...new Set(completed.map((attempt) => attempt.test_id).filter(Boolean))];
      const [questionRows, testRows] = await Promise.all([
        fetchByIds((batch) => supabase.rpc('get_published_question_metadata', { p_question_ids: batch }), questionIds),
        fetchByIds((batch) => supabase.from('tests').select('id,title').in('id', batch), testIds)
      ]);
      if (!active) return;
      setAttempts(completed);
      setResponses(responseList);
      setQuestions(Object.fromEntries(questionRows.map((question) => [question.id, question])));
      setTests(Object.fromEntries(testRows.map((test) => [test.id, test])));
      setLoading(false);
    };
    loadAnalytics().catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Unable to load your performance analytics.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [supabase, user]);

  const responseByAttempt = useMemo(() => responses.reduce((map, response) => {
    const key = response.attempt_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(response);
    return map;
  }, new Map()), [responses]);
  const stats = useMemo(() => {
    const allResponses = responses;
    const answered = allResponses.filter((response) => response.selected_option !== null && response.selected_option !== undefined && response.selected_option !== '');
    const correct = allResponses.filter((response) => response.is_correct === true || response.correct === true || response.was_correct === true).length;
    const storedAccuracy = attempts.map((attempt) => numberFrom(attempt, ['accuracy_percentage', 'accuracy'])).filter((value) => value > 0);
    const accuracy = answered.length ? correct / answered.length * 100 : storedAccuracy.length ? storedAccuracy.reduce((sum, value) => sum + asPercent(value), 0) / storedAccuracy.length : 0;
    const percentages = attempts.map(scorePercentage).filter((value) => value !== null);
    const averageScore = percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : 0;
    return { total: attempts.length, accuracy, averageScore, streak: streakDays(attempts) };
  }, [attempts, responses]);

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
    <div className="min-h-screen dark:bg-[#04140e] bg-[#f4faf7] dark:text-[#f0fdf4] text-slate-900 transition-colors">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 space-y-4">
        {/* Page Heading Banner */}
        <div className="relative overflow-hidden rounded-3xl dark:bg-gradient-to-br dark:from-[#07261b] dark:to-[#04140e] bg-gradient-to-br from-emerald-100/90 via-teal-50 to-white border dark:border-emerald-500/25 border-emerald-200 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
              Your Learning Journey
            </div>
            <h1 className="text-xl sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
              Performance Analytics
            </h1>
            <p className="text-xs sm:text-sm dark:text-emerald-200/80 text-slate-600 font-medium mt-0.5">
              See your progress, identify strong subjects and revisit completed tests.
            </p>
          </div>

          <Link
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/30 text-white text-sm font-black inline-flex items-center gap-1.5 shrink-0 min-h-[44px]"
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
          <LoadingSkeleton rows={5} />
        ) : (
          <>
            {/* 4 Analytics Stat Cards (2x2 on mobile 360px, 4 across on desktop) */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-emerald-500/20 bg-emerald-100 text-emerald-500 flex items-center justify-center mb-1">
                  <CheckCircle2 size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold dark:text-emerald-400/70 text-slate-500">
                  Tests taken
                </small>
                <strong className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {stats.total}
                </strong>
                <span className="text-sm dark:text-emerald-300/80 text-slate-500">Completed attempts</span>
              </article>

              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-emerald-500/20 bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                  <Target size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold dark:text-emerald-400/70 text-slate-500">
                  Overall accuracy
                </small>
                <strong className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {stats.accuracy.toFixed(1)}%
                </strong>
                <span className="text-sm dark:text-emerald-300/80 text-slate-500">Correct answers</span>
              </article>

              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-cyan-500/20 bg-cyan-100 text-cyan-600 flex items-center justify-center mb-1">
                  <BarChart3 size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold dark:text-emerald-400/70 text-slate-500">
                  Average score
                </small>
                <strong className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {stats.averageScore.toFixed(1)}%
                </strong>
                <span className="text-sm dark:text-emerald-300/80 text-slate-500">Across scored tests</span>
              </article>

              <article className="p-3 sm:p-4 rounded-2xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl dark:bg-purple-500/20 bg-purple-100 text-purple-600 flex items-center justify-center mb-1">
                  <Trophy size={16} />
                </div>
                <small className="text-[10px] uppercase font-bold dark:text-emerald-400/70 text-slate-500">
                  Current streak
                </small>
                <strong className="text-lg sm:text-2xl font-black dark:text-white text-slate-900 tracking-tight">
                  {stats.streak}d
                </strong>
                <span className="text-sm dark:text-emerald-300/80 text-slate-500">Consecutive days</span>
              </article>
            </section>

            {/* Detailed Grids: Subject Accuracy & Recent Attempts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Subject-wise Accuracy */}
              <section className="p-4 sm:p-5 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      Find Your Edge
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">Subject-wise accuracy</h2>
                  </div>
                  <Target size={18} className="text-emerald-500" />
                </div>

                {!subjectStats.length ? (
                  <div className="p-6 text-center space-y-2 dark:text-emerald-300/80 text-slate-500 text-xs">
                    <BarChart3 size={24} className="mx-auto text-emerald-500 opacity-60" />
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
                            <span className="text-sm text-slate-400 dark:text-emerald-400/60 ml-2">
                              {item.count} questions
                            </span>
                          </div>
                          <span className="font-extrabold text-[#22c55e]">{item.accuracy.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full dark:bg-emerald-950 bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#22c55e]"
                            style={{ width: `${Math.min(100, item.accuracy)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Recent Test Attempts */}
              <section className="p-4 sm:p-5 rounded-3xl dark:bg-[#072117]/85 bg-white shadow-sm border dark:border-emerald-500/20 border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                      Keep Getting Better
                    </div>
                    <h2 className="text-base font-black dark:text-white text-slate-900">Recent test attempts</h2>
                  </div>
                  <span className="text-xs font-bold dark:text-emerald-300 text-emerald-800">
                    {attempts.length} completed
                  </span>
                </div>

                {!attempts.length ? (
                  <div className="p-6 text-center space-y-2 dark:text-emerald-300/80 text-slate-500 text-xs">
                    <CalendarDays size={24} className="mx-auto text-emerald-500 opacity-60" />
                    <strong className="block text-sm dark:text-white text-slate-900">Your first result is one test away.</strong>
                    <span>Take a mock test and review your solutions here.</span>
                    <div className="pt-2">
                      <Link className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/30 text-white text-sm font-black inline-block" to="/tests">
                        Find a test
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y dark:divide-emerald-800/30 divide-slate-100 max-h-[380px] overflow-y-auto pr-1">
                    {attempts.slice(0, 20).map((attempt) => {
                      const attemptResponses = responseByAttempt.get(attempt.id) || [];
                      const percent = asPercent(numberFrom(attempt, ['percentage', 'score_percentage', 'percentage_score']));
                      const score = numberFrom(attempt, ['score', 'total_score', 'final_score']);
                      const blankCount = optionECount(attempt, attemptResponses);
                      const date = attempt.completed_at || attempt.submitted_at || attempt.finished_at || attempt.created_at;

                      return (
                        <article key={attempt.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg dark:bg-emerald-950/80 bg-emerald-50 border dark:border-emerald-500/25 border-emerald-200 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                              <Trophy size={14} />
                            </div>
                            <div className="min-w-0">
                              <strong className="text-xs sm:text-sm font-bold dark:text-white text-slate-900 block truncate">
                                {tests[attempt.test_id]?.title || attempt.test_title || 'Practice test'}
                              </strong>
                              <small className="text-[10px] text-slate-400 dark:text-emerald-400/60 block truncate">
                                {date ? new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date unavailable'} • {attemptResponses.length} questions
                              </small>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <strong className="text-sm font-black dark:text-emerald-300 text-emerald-700 block">
                                {percent ? `${percent.toFixed(1)}%` : score.toLocaleString()}
                              </strong>
                              {blankCount > 0 && (
                                <small className="text-[9px] text-red-500 block">
                                  {blankCount} Opt E
                                </small>
                              )}
                            </div>
                            <Link
                              className="w-8 h-8 rounded-xl dark:bg-emerald-950/80 bg-slate-100 flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-colors"
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

            <p className="text-center text-xs dark:text-emerald-400/70 text-slate-500 font-medium pt-2">
              <Clock3 size={13} className="inline mr-1" />
              Accuracy is based on saved response correctness; unavailable score fields are shown as zero until a test is submitted and graded.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
