function isComplete(attempt) {
  const status = String(attempt?.status || '').toLowerCase();
  return ['completed', 'submitted', 'graded', 'finished'].includes(status)
    || Boolean(attempt?.completed_at || attempt?.submitted_at || attempt?.finished_at);
}

function isResumable(attempt) {
  const status = String(attempt?.status || '').toLowerCase();
  return !isComplete(attempt)
    && (['in_progress', 'paused', 'started'].includes(status)
      || Boolean(attempt?.state_json || attempt?.answers || attempt?.responses));
}

function getAccuracy(attempt) {
  const percentage = Number(attempt?.percentage ?? attempt?.accuracy_percentage ?? attempt?.accuracy);
  if (Number.isFinite(percentage)) return percentage <= 1 ? percentage * 100 : percentage;

  const score = Number(attempt?.score ?? attempt?.total_score ?? attempt?.final_score);
  const total = Number(attempt?.total_questions ?? attempt?.total_marks ?? attempt?.maximum_marks);
  return Number.isFinite(score) && Number.isFinite(total) && total > 0 ? (score / total) * 100 : null;
}

function recommendationFor(test, chapter, kind, attempt = null) {
  if (!test?.id) return null;
  return {
    kind,
    test,
    attempt,
    chapter,
    title: test.title || 'Practice test',
    chapterTitle: chapter?.title || 'Practice',
    durationMinutes: Number(test.duration_minutes) || 60,
    path: `/quiz/${test.id}`
  };
}

/**
 * Rules: resume an active attempt first; otherwise practice the weakest
 * attempted chapter; then continue the most recent chapter; then use the
 * first available test. Return null when no test data is available.
 */
export function getRecommendedPractice({ attempts = [], tests = [], chapters = [] } = {}) {
  const availableTests = tests.filter((test) => ['published', 'live', 'available'].includes(String(test?.status || '').toLowerCase()));
  if (!availableTests.length) return null;

  const testById = new Map(availableTests.map((test) => [test.id, test]));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const orderedAttempts = [...attempts].sort((left, right) => (
    new Date(right?.created_at || right?.updated_at || 0).getTime()
    - new Date(left?.created_at || left?.updated_at || 0).getTime()
  ));
  const activeAttempt = orderedAttempts.find((attempt) => isResumable(attempt) && testById.has(attempt.test_id));

  if (activeAttempt) {
    const test = testById.get(activeAttempt.test_id);
    return recommendationFor(test, chapterById.get(test.chapter_id), 'resume', activeAttempt);
  }

  const attemptedTestIds = new Set(orderedAttempts.map((attempt) => attempt.test_id).filter(Boolean));
  const chapterStats = new Map();
  orderedAttempts.filter(isComplete).forEach((attempt) => {
    const test = testById.get(attempt.test_id);
    if (!test?.chapter_id) return;
    const accuracy = getAccuracy(attempt);
    if (accuracy === null) return;
    const current = chapterStats.get(test.chapter_id) || { total: 0, accuracy: 0 };
    current.total += 1;
    current.accuracy += accuracy;
    chapterStats.set(test.chapter_id, current);
  });

  const weakestChapterIds = [...chapterStats.entries()]
    .sort((left, right) => (left[1].accuracy / left[1].total) - (right[1].accuracy / right[1].total))
    .map(([chapterId]) => chapterId);

  for (const chapterId of weakestChapterIds) {
    const nextTest = availableTests.find((test) => test.chapter_id === chapterId && !attemptedTestIds.has(test.id));
    if (nextTest) return recommendationFor(nextTest, chapterById.get(chapterId), 'practice');
  }

  const recentAttempt = orderedAttempts.find((attempt) => {
    const test = testById.get(attempt.test_id);
    return isComplete(attempt) && test?.chapter_id;
  });
  const recentTest = recentAttempt ? testById.get(recentAttempt.test_id) : null;
  if (recentTest) {
    const nextTest = availableTests.find((test) => test.chapter_id === recentTest.chapter_id && !attemptedTestIds.has(test.id));
    if (nextTest) return recommendationFor(nextTest, chapterById.get(recentTest.chapter_id), 'recent');
  }

  return recommendationFor(availableTests[0], chapterById.get(availableTests[0].chapter_id), 'first');
}
