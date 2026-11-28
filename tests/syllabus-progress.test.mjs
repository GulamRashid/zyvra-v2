import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SYLLABUS_STATUS,
  computeChapterStatus,
  computeSyllabusProgress
} from '../src/lib/syllabusProgress.js';

const baseChapter = {
  id: 'ch-1',
  title: 'Matter in Our Surroundings',
  slug: 'matter-in-our-surroundings',
  folder_id: 'f-sci',
  status: 'published'
};

const baseTests = [
  { id: 't-1', title: 'Matter Set 1', chapter_id: 'ch-1', status: 'published', question_count: 20 }
];

const baseCounts = { 't-1': 20 };

test('Syllabus status transitions: Not Started -> In Progress -> Done -> Weak on bad re-attempt', () => {
  // 1. Not Started
  const notStarted = computeChapterStatus({
    chapter: baseChapter,
    chapterTests: baseTests,
    questionCounts: baseCounts,
    attempts: [],
    mistakes: []
  });
  assert.equal(notStarted.status, SYLLABUS_STATUS.NOT_STARTED);
  assert.equal(notStarted.bestScore, null);

  // 2. In Progress (started / paused attempt, or score between 50% and 69%)
  const inProgress = computeChapterStatus({
    chapter: baseChapter,
    chapterTests: baseTests,
    questionCounts: baseCounts,
    attempts: [
      { id: 'a-1', test_id: 't-1', status: 'completed', percentage: 60, completed_at: '2026-11-27T10:00:00Z' }
    ],
    mistakes: []
  });
  assert.equal(inProgress.status, SYLLABUS_STATUS.IN_PROGRESS);
  assert.equal(inProgress.bestScore, 60);

  // 3. Done (completed attempt >= 70%)
  const done = computeChapterStatus({
    chapter: baseChapter,
    chapterTests: baseTests,
    questionCounts: baseCounts,
    attempts: [
      { id: 'a-1', test_id: 't-1', status: 'completed', percentage: 60, completed_at: '2026-11-27T10:00:00Z' },
      { id: 'a-2', test_id: 't-1', status: 'completed', percentage: 80, completed_at: '2026-11-27T11:00:00Z' }
    ],
    mistakes: []
  });
  assert.equal(done.status, SYLLABUS_STATUS.DONE);
  assert.equal(done.bestScore, 80);

  // 4. Done -> Weak on bad re-attempt (latest < 50%)
  const weakAfterBadReattempt = computeChapterStatus({
    chapter: baseChapter,
    chapterTests: baseTests,
    questionCounts: baseCounts,
    attempts: [
      { id: 'a-2', test_id: 't-1', status: 'completed', percentage: 80, completed_at: '2026-11-27T11:00:00Z' },
      { id: 'a-3', test_id: 't-1', status: 'completed', percentage: 40, completed_at: '2026-11-27T12:00:00Z' }
    ],
    mistakes: []
  });
  assert.equal(weakAfterBadReattempt.status, SYLLABUS_STATUS.WEAK);
  assert.equal(weakAfterBadReattempt.bestScore, 80);
  assert.equal(weakAfterBadReattempt.latestScore, 40);
});

test('Syllabus status: 3+ mistakes in Mistake Notebook overrides In Progress / Done to Weak', () => {
  const weakByMistakes = computeChapterStatus({
    chapter: baseChapter,
    chapterTests: baseTests,
    questionCounts: baseCounts,
    attempts: [
      { id: 'a-1', test_id: 't-1', status: 'completed', percentage: 75, completed_at: '2026-11-27T10:00:00Z' }
    ],
    mistakes: [
      { id: 'm1', topic: 'Matter in Our Surroundings' },
      { id: 'm2', topic: 'Matter in Our Surroundings' },
      { id: 'm3', testTitle: 'Matter Set 1' }
    ]
  });
  assert.equal(weakByMistakes.status, SYLLABUS_STATUS.WEAK);
  assert.equal(weakByMistakes.mistakeCount, 3);
});

test('Empty (Coming Soon) chapters are excluded from total and progress is deterministic across repeated calls', () => {
  const input = {
    exams: [
      { id: 'ex-1', title: 'NCERT', slug: 'ncert', status: 'published', display_order: 1 },
      { id: 'ex-arch', title: 'BPSC', slug: 'bpsc', status: 'archived', display_order: 2 }
    ],
    folders: [
      { id: 'f-root', exam_id: 'ex-1', title: 'Class 7', status: 'published', display_order: 1 },
      { id: 'f-sci', exam_id: 'ex-1', parent_folder_id: 'f-root', title: 'Science', status: 'published', display_order: 1 }
    ],
    chapters: [
      { id: 'ch-1', folder_id: 'f-sci', title: 'Nutrition in Plants', status: 'published', display_order: 1 },
      { id: 'ch-2', folder_id: 'f-sci', title: 'Nutrition in Animals', status: 'published', display_order: 2 },
      { id: 'ch-empty', folder_id: 'f-sci', title: 'Empty Chapter', status: 'published', display_order: 3 }
    ],
    tests: [
      { id: 't-1', chapter_id: 'ch-1', title: 'Plants Test', status: 'published', question_count: 10 },
      { id: 't-2', chapter_id: 'ch-2', title: 'Animals Test', status: 'published', question_count: 10 },
      { id: 't-empty', chapter_id: 'ch-empty', title: 'Empty Test', status: 'published', question_count: 0 }
    ],
    questionCounts: { 't-1': 10, 't-2': 10, 't-empty': 0 },
    allAttempts: [
      { id: 'a-1', test_id: 't-1', status: 'completed', percentage: 90, completed_at: '2026-11-27T10:00:00Z' }
    ],
    mistakes: []
  };

  const first = computeSyllabusProgress(input);
  const second = computeSyllabusProgress(input);
  assert.deepEqual(first, second);

  // Archived BPSC exam excluded
  assert.equal(first.exams.length, 1);
  const ncert = first.exams[0];
  // Empty chapter excluded from totalChapters (2 real chapters, 1 coming soon)
  assert.equal(ncert.totalChapters, 2);
  assert.equal(ncert.comingSoonCount, 1);
  assert.equal(ncert.doneCount, 1);
  assert.equal(ncert.progressPercent, 50);

  // Next best chapter picks ch-2 (Not Started)
  assert.equal(first.nextBestChapter.chapter.chapterId, 'ch-2');
  assert.equal(first.nextBestChapter.actionLabelEn, 'Start');
});

test('No query selects non-existent tests.price column, loading gates Coming Soon, and header counts equal chapter row sums', () => {
  const filesToCheck = [
    '../src/hooks/useSyllabusProgress.js',
    '../src/pages/student/StudentHome.jsx',
    '../src/pages/student/TestHub.jsx',
    '../src/pages/student/LiveQuiz.jsx',
    '../src/pages/admin/PricingManager.jsx'
  ];
  for (const rel of filesToCheck) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    const matches = src.match(/\.from\(['"]tests['"]\)[\s\S]{0,180}?\.select\([^)]*\)/g) || [];
    for (const m of matches) {
      assert.equal(/\bprice\b/.test(m), false, `Found tests.price select in ${rel}`);
    }
  }

  // Loading gate check: useSyllabusProgress gates on testsLoaded and SyllabusTracker gates on loading/error
  const hookSrc = fs.readFileSync(new URL('../src/hooks/useSyllabusProgress.js', import.meta.url), 'utf8');
  assert.equal(/testsLoaded/.test(hookSrc), true);
  const trackerSrc = fs.readFileSync(new URL('../src/pages/student/SyllabusTracker.jsx', import.meta.url), 'utf8');
  assert.equal(/loading\s*\?\s*\(\s*<LoadingSkeleton/.test(trackerSrc), true);
  assert.equal(/error\s*\?\s*null/.test(trackerSrc), true);

  const result = computeSyllabusProgress({
    exams: [{ id: 'ex-ncert', title: 'NCERT', slug: 'ncert', status: 'published', display_order: 1 }],
    folders: [
      { id: 'f-6', exam_id: 'ex-ncert', title: 'Class 6', status: 'published', display_order: 1 },
      { id: 'f-geo', exam_id: 'ex-ncert', parent_folder_id: 'f-6', title: 'Geography', status: 'published', display_order: 1 },
      { id: 'f-his', exam_id: 'ex-ncert', parent_folder_id: 'f-6', title: 'History', status: 'published', display_order: 2 }
    ],
    chapters: [
      { id: 'ch-geo-1', folder_id: 'f-geo', title: 'Geographical Diversity of India', status: 'published', display_order: 1 },
      { id: 'ch-his-1', folder_id: 'f-his', title: 'Early Humans', status: 'published', display_order: 1 },
      { id: 'ch-his-2', folder_id: 'f-his', title: 'Coming Soon Chapter', status: 'published', display_order: 2 }
    ],
    tests: [
      { id: 't-set-1', chapter_id: 'ch-geo-1', title: 'Set 1', status: 'published', question_count: 20 },
      { id: 't-his-1', chapter_id: 'ch-his-1', title: 'Set 1', status: 'published', question_count: 20 }
    ],
    questionCounts: { 't-set-1': 20, 't-his-1': 20 },
    allAttempts: [
      { id: 'att-1', test_id: 't-set-1', status: 'completed', score: 20, max_score: 20, percentage: 100, completed_at: '2026-11-27T18:00:00Z' }
    ],
    mistakes: []
  });

  const ncert = result.exams[0];
  const allRows = ncert.subjects.flatMap((s) => s.chapters);
  assert.equal(ncert.totalChapters, allRows.filter((c) => !c.isComingSoon).length);
  assert.equal(ncert.comingSoonCount, allRows.filter((c) => c.isComingSoon).length);
  assert.equal(ncert.doneCount, allRows.filter((c) => !c.isComingSoon && c.status === SYLLABUS_STATUS.DONE).length);
  assert.equal(ncert.inProgressCount, allRows.filter((c) => !c.isComingSoon && c.status === SYLLABUS_STATUS.IN_PROGRESS).length);
  assert.equal(ncert.weakCount, allRows.filter((c) => !c.isComingSoon && c.status === SYLLABUS_STATUS.WEAK).length);
  assert.equal(ncert.notStartedCount, allRows.filter((c) => !c.isComingSoon && c.status === SYLLABUS_STATUS.NOT_STARTED).length);
  assert.equal(ncert.doneCount, 1);
  assert.equal(ncert.totalChapters, 2);
  assert.equal(ncert.progressPercent, 50);
  const ch1 = allRows.find((c) => c.chapterId === 'ch-geo-1');
  assert.equal(ch1.status, SYLLABUS_STATUS.DONE);
  assert.equal(ch1.bestScore, 100);
  assert.equal(ch1.isComingSoon, false);
});

test('Negative score clamps bestScore to 0% as Weak, Dashboard renders %, and Next Best Chapter carries ?reattempt=1', () => {
  const result = computeSyllabusProgress({
    exams: [{ id: 'ex-ncert', title: 'NCERT', slug: 'ncert', status: 'published', display_order: 1 }],
    folders: [
      { id: 'f-7', exam_id: 'ex-ncert', title: 'Class 7', status: 'published', display_order: 1 },
      { id: 'f-sci', exam_id: 'ex-ncert', parent_folder_id: 'f-7', title: 'Science', status: 'published', display_order: 1 }
    ],
    chapters: [
      { id: 'ch-12', folder_id: 'f-sci', title: 'Earth, Moon, and the Sun', status: 'published', display_order: 1 }
    ],
    tests: [
      { id: 't-ch12', chapter_id: 'ch-12', title: 'Chapter 12 Test', status: 'published', question_count: 30 }
    ],
    questionCounts: { 't-ch12': 30 },
    allAttempts: [
      { id: 'att-neg', test_id: 't-ch12', status: 'completed', score: -0.66, max_score: 30, percentage: -2.2, completed_at: '2026-11-28T04:00:00Z' }
    ],
    mistakes: []
  });

  const ch12 = result.exams[0].subjects[0].chapters[0];
  assert.equal(ch12.status, SYLLABUS_STATUS.WEAK);
  assert.equal(ch12.bestScore, 0);
  assert.equal(ch12.latestScore, 0);
  assert.equal(result.nextBestChapter.targetPath, '/quiz/t-ch12?reattempt=1');

  const homeSrc = fs.readFileSync(new URL('../src/pages/student/StudentHome.jsx', import.meta.url), 'utf8');
  assert.equal(/primarySyllabusExam\.progressPercent\s*\?\?\s*0\}%/.test(homeSrc), true);
  assert.equal(/chapters with tests done/.test(homeSrc), true);

  const liveQuizSrc = fs.readFileSync(new URL('../src/pages/student/LiveQuiz.jsx', import.meta.url), 'utf8');
  assert.equal(/get\(['"]reattempt['"]\)\s*===\s*['"]1['"]/.test(liveQuizSrc), true);
});
