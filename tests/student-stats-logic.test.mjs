import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  computeStudentStats,
  getISTDateKey,
  getISTGreeting,
  getISTHour,
  isAttemptCompleted
} from '../src/lib/studentStats.js';
import { resolveBoosterTrack } from '../src/lib/boosterTrack.js';

test('getISTHour & getISTGreeting: uses Asia/Kolkata (IST) regardless of UTC', () => {
  // 03:00 UTC = 08:30 IST -> Good Morning
  const morningUTC = new Date('2026-11-27T03:00:00Z');
  assert.equal(getISTHour(morningUTC), 8);
  assert.equal(getISTGreeting('en', morningUTC), 'Good Morning');
  assert.equal(getISTGreeting('hi', morningUTC), 'शुभ प्रभात');

  // 08:00 UTC = 13:30 IST -> Good Afternoon
  const afternoonUTC = new Date('2026-11-27T08:00:00Z');
  assert.equal(getISTHour(afternoonUTC), 13);
  assert.equal(getISTGreeting('en', afternoonUTC), 'Good Afternoon');

  // 14:00 UTC = 19:30 IST -> Good Evening
  const eveningUTC = new Date('2026-11-27T14:00:00Z');
  assert.equal(getISTHour(eveningUTC), 19);
  assert.equal(getISTGreeting('en', eveningUTC), 'Good Evening');
  assert.equal(getISTGreeting('hi', eveningUTC), 'शुभ संध्या');

  // 20:00 UTC = 01:30 IST next day -> Good Evening (not Morning)
  const lateNightUTC = new Date('2026-11-27T20:00:00Z');
  assert.equal(getISTHour(lateNightUTC), 1);
  assert.equal(getISTGreeting('en', lateNightUTC), 'Good Evening');
  assert.equal(getISTDateKey(lateNightUTC), '2026-11-28');
});

test('computeStudentStats: filters only completed attempts and computes unified accuracy', () => {
  const attempts = [
    { id: 'a1', status: 'completed', completed_at: '2026-11-27T06:00:00Z', score: 8, total_marks: 10, attempted_count: 10, correct_count: 8 },
    { id: 'a2', status: 'in_progress', started_at: '2026-11-27T07:00:00Z', score: 0, total_marks: 10 }
  ];
  const responses = [
    { attempt_id: 'a1', selected_option: 'A', is_correct: true },
    { attempt_id: 'a1', selected_option: 'B', is_correct: true },
    { attempt_id: 'a1', selected_option: 'C', is_correct: false },
    { attempt_id: 'a1', selected_option: null, is_correct: false }
  ];

  assert.equal(isAttemptCompleted(attempts[0]), true);
  assert.equal(isAttemptCompleted(attempts[1]), false);

  const stats = computeStudentStats({
    allAttempts: attempts,
    responses,
    profile: { current_streak: 4, last_active_date: '2026-11-27' },
    userId: 'user-1',
    referenceDate: new Date('2026-11-27T10:00:00Z')
  });

  assert.equal(stats.testsAttempted, 1);
  // 2 correct out of 3 answered = 66.666...%
  assert.ok(Math.abs(stats.accuracy - (200 / 3)) < 0.01);
  assert.equal(stats.currentStreak, 4);
});

test('Aggregate analytics with 12 completed attempts never renders dash and booster track is deterministic', () => {
  const analyticsSrc = fs.readFileSync(new URL('../src/pages/student/StudentAnalytics.jsx', import.meta.url), 'utf8');
  assert.equal(/stats\.completedAttempts\.length\s*>\s*0/.test(analyticsSrc), true);
  assert.equal(/[^.]completedAttempts\s*>\s*0/.test(analyticsSrc), false);

  const attempts = Array.from({ length: 12 }, (_, idx) => ({
    id: `att-${idx + 1}`,
    status: 'completed',
    completed_at: `2026-11-28T0${idx % 9}:00:00Z`,
    score: 12,
    max_score: 20,
    percentage: 60,
    attempted_count: 20,
    correct_count: 12
  }));
  const stats = computeStudentStats({ allAttempts: attempts, responses: [], profile: null, userId: 'u-12' });
  assert.equal(stats.completedAttempts.length, 12);
  assert.equal(stats.accuracy, 60);
  assert.equal(stats.averageScore, 60);

  const mem = new Map();
  const mockStorage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, String(v))
  };
  const fixedProfile = { target_exams: ['BPSC', 'SSC', 'CTET'] };
  const first = resolveBoosterTrack({ profile: fixedProfile, dynamicExams: [{ title: 'NCERT' }], userId: 'u-12', storage: mockStorage });
  const beforeProfileReload = resolveBoosterTrack({ profile: null, dynamicExams: [{ title: 'NCERT' }], userId: 'u-12', storage: mockStorage });
  const third = resolveBoosterTrack({ profile: fixedProfile, dynamicExams: [{ title: 'SSC' }], userId: 'u-12', storage: mockStorage });
  assert.equal(first, 'BPSC & PCS');
  assert.equal(beforeProfileReload, 'BPSC & PCS');
  assert.equal(third, 'BPSC & PCS');
});
