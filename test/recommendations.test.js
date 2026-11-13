import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecommendedPractice } from '../src/lib/recommendations.js';

const publishedTests = [
  { id: 'published-1', title: 'Published One', chapter_id: 'chapter-a', status: 'published' },
  { id: 'published-2', title: 'Published Two', chapter_id: 'chapter-a', status: 'published' },
  { id: 'published-3', title: 'Published Three', chapter_id: 'chapter-b', status: 'published' },
  { id: 'published-4', title: 'Published Four', chapter_id: 'chapter-b', status: 'published' }
];

const chapters = [
  { id: 'chapter-a', title: 'Polity' },
  { id: 'chapter-b', title: 'History' }
];

test('ignores a paused attempt whose test is missing or unpublished', () => {
  const recommendation = getRecommendedPractice({
    attempts: [{ test_id: 'missing-test', status: 'paused', updated_at: '2026-01-02T00:00:00Z' }],
    tests: [
      { id: 'unpublished-test', title: 'Draft', chapter_id: 'chapter-a', status: 'draft' },
      ...publishedTests
    ],
    chapters
  });

  assert.equal(recommendation.kind, 'first');
  assert.equal(recommendation.test.id, 'published-1');
});

test('uses the weakest chapter when an attempted result has no percentage', () => {
  const recommendation = getRecommendedPractice({
    attempts: [
      { test_id: 'published-1', status: 'completed', score: null, percentage: null },
      { test_id: 'published-3', status: 'completed', percentage: 80 }
    ],
    tests: publishedTests,
    chapters
  });

  assert.equal(recommendation.kind, 'practice');
  assert.equal(recommendation.chapterTitle, 'History');
  assert.equal(recommendation.test.id, 'published-4');
});

test('falls back to the first available test when all tests are attempted', () => {
  const recommendation = getRecommendedPractice({
    attempts: [
      { test_id: 'published-1', status: 'completed', percentage: 70 },
      { test_id: 'published-2', status: 'completed', percentage: 80 },
      { test_id: 'published-3', status: 'completed', percentage: 90 },
      { test_id: 'published-4', status: 'completed', percentage: 60 }
    ],
    tests: publishedTests,
    chapters
  });

  assert.equal(recommendation.kind, 'first');
  assert.equal(recommendation.test.id, 'published-1');
});

test('returns null when the chapter catalogue is empty and no attempt context exists', () => {
  const recommendation = getRecommendedPractice({
    attempts: [],
    tests: [{ id: 'published-1', title: 'Published One', status: 'published' }],
    chapters: []
  });

  assert.equal(recommendation.kind, 'first');
  assert.equal(recommendation.chapterTitle, 'Practice');
});

test('resumes the latest of multiple paused attempts', () => {
  const recommendation = getRecommendedPractice({
    attempts: [
      { test_id: 'published-1', status: 'paused', updated_at: '2026-01-01T00:00:00Z' },
      { test_id: 'published-3', status: 'paused', updated_at: '2026-01-03T00:00:00Z' }
    ],
    tests: publishedTests,
    chapters
  });

  assert.equal(recommendation.kind, 'resume');
  assert.equal(recommendation.test.id, 'published-3');
});
