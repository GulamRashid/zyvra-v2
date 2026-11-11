import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, Target, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

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

  return <div className="analytics-page">
    <div className="page-heading"><div><div className="eyebrow">YOUR LEARNING JOURNEY</div><h1>Performance analytics</h1><p>See your progress, identify strong subjects and revisit completed tests.</p></div><Link className="button button-outline" to="/tests">Practice more <ArrowRight size={14} /></Link></div>
    {error && <div className="feedback error-feedback">{error}</div>}
    {loading ? <LoadingSkeleton rows={5} /> : <>
      <section className="analytics-stat-grid">
        <article className="analytics-stat-card"><span className="analytics-stat-icon gold"><CheckCircle2 size={18} /></span><small>Tests taken</small><strong>{stats.total}</strong><span>Completed attempts</span></article>
        <article className="analytics-stat-card"><span className="analytics-stat-icon green"><Target size={18} /></span><small>Overall accuracy</small><strong>{stats.accuracy.toFixed(1)}%</strong><span>Correct answers</span></article>
        <article className="analytics-stat-card"><span className="analytics-stat-icon blue"><BarChart3 size={18} /></span><small>Average score</small><strong>{stats.averageScore.toFixed(1)}%</strong><span>Across scored tests</span></article>
        <article className="analytics-stat-card"><span className="analytics-stat-icon violet"><Trophy size={18} /></span><small>Current streak</small><strong>{stats.streak}</strong><span>Consecutive days</span></article>
      </section>
      <div className="analytics-detail-grid">
        <section className="panel-card subject-analytics-card"><div className="section-heading"><div><div className="eyebrow">FIND YOUR EDGE</div><h2>Subject-wise accuracy</h2></div><span className="setting-symbol"><Target size={17} /></span></div>
          {!subjectStats.length ? <div className="empty-content"><BarChart3 size={21} /><strong>Subject insights will appear here.</strong><span>Complete tests with tagged questions to build this breakdown.</span></div> : <div className="subject-accuracy-list">{subjectStats.map((item) => <div className="subject-accuracy-row" key={item.subject}><div><strong>{item.subject}</strong><small>{item.count} questions</small></div><span>{item.accuracy.toFixed(1)}%</span><div className="subject-accuracy-track"><i style={{ width: `${Math.min(100, item.accuracy)}%` }} /></div></div>)}</div>}
        </section>
        <section className="panel-card recent-attempts-card"><div className="section-heading"><div><div className="eyebrow">KEEP GETTING BETTER</div><h2>Recent test attempts</h2></div><span className="chapter-item-count">{attempts.length} completed</span></div>
          {!attempts.length ? <div className="empty-content"><CalendarDays size={21} /><strong>Your first result is one test away.</strong><span>Take a mock test and review your solutions here.</span><Link className="button button-gold" to="/tests">Find a test</Link></div> : <div className="analytics-attempt-list">{attempts.slice(0, 20).map((attempt) => {
            const attemptResponses = responseByAttempt.get(attempt.id) || [];
            const percent = asPercent(numberFrom(attempt, ['percentage', 'score_percentage', 'percentage_score']));
            const score = numberFrom(attempt, ['score', 'total_score', 'final_score']);
            const blankCount = optionECount(attempt, attemptResponses);
            const date = attempt.completed_at || attempt.submitted_at || attempt.finished_at || attempt.created_at;
            return <article className="analytics-attempt-row" key={attempt.id}><span className="attempt-result-icon"><Trophy size={16} /></span><div className="analytics-attempt-copy"><strong>{tests[attempt.test_id]?.title || attempt.test_title || 'Practice test'}</strong><small>{date ? new Date(date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date unavailable'} · {attemptResponses.length} questions</small></div><div className="analytics-attempt-score"><strong>{percent ? `${percent.toFixed(1)}%` : score.toLocaleString()}</strong><small>{blankCount} Option E {blankCount === 1 ? 'penalty' : 'penalties'}</small></div><Link className="icon-button" aria-label="Review test solutions" to={`/quiz/result/${attempt.id}`}><ArrowRight size={16} /></Link></article>;
          })}</div>}
        </section>
      </div>
      <p className="analytics-note"><Clock3 size={14} /> Accuracy is based on saved response correctness; unavailable score fields are shown as zero until a test is submitted and graded.</p>
    </>}
  </div>;
}
