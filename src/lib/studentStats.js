import { getAnsweredQuestionCount } from './tests.js';
import { syncAttemptsWithStreak } from './streak.js';

/**
 * Return the current hour (0-23) in Asia/Kolkata (IST).
 */
export function getISTHour(dateInput = new Date()) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return 12;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false
    }).formatToParts(d);
    const hourVal = Number(parts.find((p) => p.type === 'hour')?.value);
    if (Number.isFinite(hourVal)) return hourVal % 24;
  } catch {
    // Fallback to UTC+5:30 calculation
  }
  const istMs = d.getTime() + 330 * 60 * 1000;
  return new Date(istMs).getUTCHours();
}

/**
 * Return 'YYYY-MM-DD' in Asia/Kolkata (IST).
 */
export function getISTDateKey(dateInput = new Date()) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch {
    const istDate = new Date(d.getTime() + 330 * 60 * 1000);
    const y = istDate.getUTCFullYear();
    const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Return bilingual IST time-of-day greeting.
 */
export function getISTGreeting(language = 'en', dateInput = new Date()) {
  const hour = getISTHour(dateInput);
  if (hour >= 4 && hour < 12) {
    return language === 'hi' ? 'शुभ प्रभात' : 'Good Morning';
  }
  if (hour >= 12 && hour < 17) {
    return language === 'hi' ? 'शुभ दोपहर' : 'Good Afternoon';
  }
  return language === 'hi' ? 'शुभ संध्या' : 'Good Evening';
}

export function isAttemptCompleted(attempt) {
  if (!attempt) return false;
  const status = String(attempt.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt.completed_at || attempt.submitted_at || attempt.finished_at);
}

function asPercent(value) {
  return value > 0 && value <= 1 ? value * 100 : value;
}

function numberFrom(row, keys, fallback = 0) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null && Number.isFinite(Number(row[key]))) {
      return Number(row[key]);
    }
  }
  return fallback;
}

export function computeAttemptScorePercentage(attempt) {
  for (const key of ['percentage', 'score_percentage', 'percentage_score']) {
    if (attempt?.[key] !== undefined && attempt[key] !== null && Number.isFinite(Number(attempt[key]))) {
      return asPercent(Number(attempt[key]));
    }
  }
  const score = numberFrom(attempt, ['score', 'total_score', 'final_score'], NaN);
  const total = numberFrom(attempt, ['max_score', 'total_marks', 'maximum_marks'], NaN);
  return Number.isFinite(score) && Number.isFinite(total) && total > 0 ? (score / total) * 100 : null;
}

/**
 * Single source of truth for student stats across Dashboard, Header, Profile, and Analytics.
 */
export function computeStudentStats({
  allAttempts = [],
  responses = [],
  profile = null,
  userId = 'guest',
  referenceDate = new Date()
}) {
  const safeAttempts = Array.isArray(allAttempts) ? allAttempts : [];
  const safeResponses = Array.isArray(responses) ? responses : [];

  const completedAttempts = safeAttempts.filter(isAttemptCompleted);
  const testsAttempted = completedAttempts.length;

  // Accuracy calculation: prefer response-level truth, fall back to attempt aggregates
  const answeredResponses = safeResponses.filter(
    (r) => r?.selected_option !== null && r?.selected_option !== undefined && r?.selected_option !== ''
  );
  const correctResponses = answeredResponses.filter(
    (r) => r?.is_correct === true || r?.correct === true || r?.was_correct === true
  );

  let accuracy = 0;
  if (answeredResponses.length > 0) {
    accuracy = (correctResponses.length / answeredResponses.length) * 100;
  } else {
    const totalAttemptedQ = completedAttempts.reduce(
      (sum, a) => sum + Math.max(0, Number(a?.attempted_count || 0)),
      0
    );
    const totalCorrectQ = completedAttempts.reduce(
      (sum, a) => sum + Math.max(0, Number(a?.correct_count || 0)),
      0
    );
    if (totalAttemptedQ > 0) {
      accuracy = (totalCorrectQ / totalAttemptedQ) * 100;
    } else {
      const storedAcc = completedAttempts
        .map((a) => numberFrom(a, ['accuracy_percentage', 'accuracy'], NaN))
        .filter((v) => Number.isFinite(v) && v >= 0);
      if (storedAcc.length > 0) {
        accuracy = storedAcc.reduce((sum, v) => sum + asPercent(v), 0) / storedAcc.length;
      }
    }
  }
  accuracy = Math.max(0, Math.min(100, accuracy));

  const scorePercentages = completedAttempts
    .map(computeAttemptScorePercentage)
    .filter((v) => v !== null);
  const averageScore = scorePercentages.length > 0
    ? scorePercentages.reduce((sum, v) => sum + v, 0) / scorePercentages.length
    : 0;

  // Daily goal progress in IST
  const todayKey = getISTDateKey(referenceDate);
  let todayQuestionsSolved = 0;
  for (const attempt of safeAttempts) {
    const attemptDate = attempt?.completed_at || attempt?.submitted_at || attempt?.started_at || attempt?.created_at;
    if (attemptDate && getISTDateKey(attemptDate) === todayKey) {
      todayQuestionsSolved += getAnsweredQuestionCount(attempt);
    }
  }

  // Unified streak calculation
  const streakData = syncAttemptsWithStreak(userId || 'guest', safeAttempts, profile);

  return {
    allAttempts: safeAttempts,
    completedAttempts,
    responses: safeResponses,
    testsAttempted,
    accuracy,
    averageScore,
    todayQuestionsSolved,
    streakData,
    currentStreak: Number(streakData?.currentStreak || 0)
  };
}
