import { isPublished, sortContentItems } from './content.js';
import { computeAttemptScorePercentage, isAttemptCompleted } from './studentStats.js';

export const SYLLABUS_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  WEAK: 'weak'
};

export const SYLLABUS_DONE_THRESHOLD = 70;
export const SYLLABUS_WEAK_SCORE_THRESHOLD = 50;
export const SYLLABUS_WEAK_MISTAKE_THRESHOLD = 3;

export function isPyqFolderOrTitle(text) {
  const s = String(text || '').toLowerCase();
  return s.includes('pyq') || s.includes('previous year') || s.includes('पूर्व वर्ष') || s.includes('विगत वर्ष');
}

function getAttemptTimestamp(attempt) {
  const raw = attempt?.completed_at || attempt?.submitted_at || attempt?.finished_at || attempt?.updated_at || attempt?.created_at;
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

export function countChapterMistakes(chapter, chapterTests = [], mistakes = [], subjectTitle = '') {
  if (!Array.isArray(mistakes) || mistakes.length === 0) return 0;
  const testIds = new Set(chapterTests.map((t) => String(t.id)));
  const testTitles = new Set(chapterTests.map((t) => normalizeText(t.title)).filter(Boolean));
  const chapterTitleNorm = normalizeText(chapter?.title);
  const subjectTitleNorm = normalizeText(subjectTitle);

  return mistakes.reduce((count, item) => {
    if (!item || typeof item !== 'object') return count;
    if (item.chapterId && String(item.chapterId) === String(chapter?.id)) return count + 1;
    if (item.testId && testIds.has(String(item.testId))) return count + 1;
    const itemTestTitle = normalizeText(item.testTitle);
    if (itemTestTitle && testTitles.has(itemTestTitle)) return count + 1;
    const itemTopic = normalizeText(item.topic);
    if (itemTopic && chapterTitleNorm && (itemTopic.includes(chapterTitleNorm) || chapterTitleNorm.includes(itemTopic))) {
      return count + 1;
    }
    if (itemTopic && subjectTitleNorm && chapterTitleNorm && itemTopic === `${subjectTitleNorm}: ${chapterTitleNorm}`) {
      return count + 1;
    }
    return count;
  }, 0);
}

export function computeChapterStatus({
  chapter,
  chapterTests = [],
  questionCounts = {},
  attempts = [],
  mistakes = [],
  subjectTitle = '',
  isPyq = false
}) {
  const validTests = sortContentItems(chapterTests).filter((t) => isPublished(t));
  const totalQuestions = validTests.reduce((sum, t) => {
    const qCount = questionCounts[t.id] !== undefined ? Number(questionCounts[t.id]) : Number(t.question_count || 0);
    return sum + Math.max(0, Number.isFinite(qCount) ? qCount : 0);
  }, 0);

  const isComingSoon = validTests.length === 0 || totalQuestions === 0;
  const primaryTest = validTests.find((t) => {
    const qCount = questionCounts[t.id] !== undefined ? Number(questionCounts[t.id]) : Number(t.question_count || 0);
    return qCount > 0;
  }) || validTests[0] || null;

  const testIdSet = new Set(validTests.map((t) => t.id));
  const chapterAttempts = (attempts || [])
    .filter((a) => testIdSet.has(a.test_id))
    .slice()
    .sort((a, b) => getAttemptTimestamp(b) - getAttemptTimestamp(a));

  const completedAttempts = chapterAttempts.filter(isAttemptCompleted);
  const completedPercents = completedAttempts
    .map(computeAttemptScorePercentage)
    .filter((v) => v !== null && Number.isFinite(v));
  const allAttemptPercents = chapterAttempts
    .map(computeAttemptScorePercentage)
    .filter((v) => v !== null && Number.isFinite(v));

  const bestScore = completedPercents.length > 0
    ? Math.max(...completedPercents)
    : (chapterAttempts.length > 0 ? (allAttemptPercents.length > 0 ? Math.max(...allAttemptPercents) : 0) : null);
  const latestScore = completedAttempts.length > 0 ? computeAttemptScorePercentage(completedAttempts[0]) : null;
  const hasPassed = completedPercents.some((pct) => pct >= SYLLABUS_DONE_THRESHOLD);
  const mistakeCount = countChapterMistakes(chapter, validTests, mistakes, subjectTitle);

  let status = SYLLABUS_STATUS.NOT_STARTED;
  if (chapterAttempts.length === 0) {
    status = SYLLABUS_STATUS.NOT_STARTED;
  } else if ((latestScore !== null && latestScore < SYLLABUS_WEAK_SCORE_THRESHOLD) || mistakeCount >= SYLLABUS_WEAK_MISTAKE_THRESHOLD) {
    status = SYLLABUS_STATUS.WEAK;
  } else if (hasPassed) {
    status = SYLLABUS_STATUS.DONE;
  } else {
    status = SYLLABUS_STATUS.IN_PROGRESS;
  }

  const lastAttempt = chapterAttempts[0] || null;
  const lastAttemptedAt = lastAttempt
    ? (lastAttempt.completed_at || lastAttempt.submitted_at || lastAttempt.created_at || null)
    : null;

  return {
    chapterId: chapter.id,
    title: chapter.title || 'Untitled Chapter',
    slug: chapter.slug || chapter.id,
    folderId: chapter.folder_id,
    status,
    bestScore: bestScore !== null ? Math.max(0, Math.round(bestScore)) : null,
    latestScore: latestScore !== null ? Math.max(0, Math.round(latestScore)) : null,
    attemptsCount: chapterAttempts.length,
    completedCount: completedAttempts.length,
    lastAttemptedAt,
    mistakeCount,
    primaryTestId: primaryTest?.id || null,
    testsCount: validTests.length,
    totalQuestions,
    isComingSoon,
    isPyq: Boolean(isPyq || isPyqFolderOrTitle(chapter.title))
  };
}

export function computeSyllabusProgress({
  exams = [],
  folders = [],
  chapters = [],
  tests = [],
  questionCounts = {},
  allAttempts = [],
  mistakes = []
}) {
  const publishedExams = sortContentItems(exams).filter(isPublished);
  const publishedFolders = sortContentItems(folders).filter(isPublished);
  const publishedChapters = sortContentItems(chapters).filter(isPublished);
  const publishedTests = (tests || []).filter(isPublished);

  const folderById = new Map(publishedFolders.map((f) => [f.id, f]));
  const testsByChapterId = new Map();
  publishedTests.forEach((t) => {
    if (!t.chapter_id) return;
    const list = testsByChapterId.get(t.chapter_id) || [];
    list.push(t);
    testsByChapterId.set(t.chapter_id, list);
  });

  const getFolderChain = (folderId) => {
    const chain = [];
    const seen = new Set();
    let cur = folderById.get(folderId);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      const pid = cur.parent_folder_id || cur.parent_id;
      cur = pid ? folderById.get(pid) : null;
    }
    return chain;
  };

  const examProgressList = publishedExams.map((exam) => {
    const examFolders = publishedFolders.filter((f) => f.exam_id === exam.id);
    const examFolderIdSet = new Set(examFolders.map((f) => f.id));
    const examChapters = publishedChapters.filter((c) => examFolderIdSet.has(c.folder_id));

    const subjectGroupsMap = new Map();
    examChapters.forEach((chapter) => {
      const chain = getFolderChain(chapter.folder_id);
      const rootFolder = chain[0] || folderById.get(chapter.folder_id);
      const leafFolder = chain[chain.length - 1] || rootFolder;
      const subjectKey = leafFolder?.id || 'general';
      const subjectTitle = chain.length >= 2
        ? `${leafFolder.title} — ${rootFolder.title}`
        : (leafFolder?.title || 'General');
      const folderIsPyq = chain.some((f) => isPyqFolderOrTitle(f.title));

      if (!subjectGroupsMap.has(subjectKey)) {
        subjectGroupsMap.set(subjectKey, {
          id: subjectKey,
          title: subjectTitle,
          rootTitle: rootFolder?.title || subjectTitle,
          isPyq: folderIsPyq,
          displayOrder: leafFolder?.display_order ?? 999,
          chapters: []
        });
      }

      const chapterTests = testsByChapterId.get(chapter.id) || [];
      const progress = computeChapterStatus({
        chapter,
        chapterTests,
        questionCounts,
        attempts: allAttempts,
        mistakes,
        subjectTitle: leafFolder?.title || subjectTitle,
        isPyq: folderIsPyq
      });

      subjectGroupsMap.get(subjectKey).chapters.push(progress);
    });

    const subjects = Array.from(subjectGroupsMap.values()).map((subj) => {
      const realChapters = subj.chapters.filter((c) => !c.isComingSoon);
      const doneCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.DONE).length;
      const weakCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.WEAK).length;
      const inProgressCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.IN_PROGRESS).length;
      const notStartedCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.NOT_STARTED).length;
      const comingSoonCount = subj.chapters.filter((c) => c.isComingSoon).length;
      return {
        ...subj,
        totalChapters: realChapters.length,
        comingSoonCount,
        doneCount,
        weakCount,
        inProgressCount,
        notStartedCount
      };
    });

    const allExamChapters = subjects.flatMap((s) => s.chapters);
    const realChapters = allExamChapters.filter((c) => !c.isComingSoon);
    const comingSoonCount = allExamChapters.filter((c) => c.isComingSoon).length;
    const doneCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.DONE).length;
    const weakCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.WEAK).length;
    const inProgressCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.IN_PROGRESS).length;
    const notStartedCount = realChapters.filter((c) => c.status === SYLLABUS_STATUS.NOT_STARTED).length;
    const attemptedChaptersCount = realChapters.filter((c) => c.attemptsCount > 0).length;

    return {
      examId: exam.id,
      slug: exam.slug || exam.id,
      title: exam.title,
      description: exam.description || '',
      subjects,
      totalChapters: realChapters.length,
      comingSoonCount,
      doneCount,
      weakCount,
      inProgressCount,
      notStartedCount,
      attemptedChaptersCount,
      progressPercent: realChapters.length > 0 && attemptedChaptersCount > 0
        ? Math.round((doneCount / realChapters.length) * 100)
        : null
    };
  });

  // Determine single "next best chapter": first Weak -> else first In Progress -> else first Not Started
  let nextBestChapter = null;
  const activePool = [];
  examProgressList.forEach((exam) => {
    exam.subjects.forEach((subj) => {
      subj.chapters.forEach((ch) => {
        if (!ch.isComingSoon && ch.primaryTestId) {
          activePool.push({ exam, subject: subj, chapter: ch });
        }
      });
    });
  });

  const firstWeak = activePool.find((x) => x.chapter.status === SYLLABUS_STATUS.WEAK);
  const firstInProgress = activePool.find((x) => x.chapter.status === SYLLABUS_STATUS.IN_PROGRESS);
  const firstNotStarted = activePool.find((x) => x.chapter.status === SYLLABUS_STATUS.NOT_STARTED);
  const chosen = firstWeak || firstInProgress || firstNotStarted || null;

  if (chosen) {
    const { exam, subject, chapter } = chosen;
    const isWeak = chapter.status === SYLLABUS_STATUS.WEAK;
    const isInProgress = chapter.status === SYLLABUS_STATUS.IN_PROGRESS;
    nextBestChapter = {
      examId: exam.examId,
      examTitle: exam.title,
      examSlug: exam.slug,
      subjectTitle: subject.title,
      chapter,
      actionLabelEn: isWeak ? 'Revise weak topics' : isInProgress ? 'Continue' : 'Start',
      actionLabelHi: isWeak ? 'कमज़ोर विषय दोहराएं' : isInProgress ? 'जारी रखें' : 'शुरू करें',
      targetPath: `/quiz/${chapter.primaryTestId}${(chapter.completedCount || 0) > 0 ? '?reattempt=1' : ''}`
    };
  }

  return {
    exams: examProgressList,
    nextBestChapter
  };
}
