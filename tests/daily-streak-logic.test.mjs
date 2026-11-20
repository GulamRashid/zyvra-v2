import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toLocalDateString,
  calculateStreakData,
  STREAK_MILESTONES
} from '../src/lib/streak.js';

test('toLocalDateString: handles dates, timestamps, and invalid inputs', () => {
  const d = new Date(2026, 10, 20); // 2026-11-20
  assert.equal(toLocalDateString(d), '2026-11-20');
  assert.equal(toLocalDateString(null), null);
  assert.equal(toLocalDateString('invalid-date'), null);
});

test('calculateStreakData: empty dates array yields 0 streak', () => {
  const ref = new Date('2026-11-20T12:00:00');
  const res = calculateStreakData([], ref);

  assert.equal(res.currentStreak, 0);
  assert.equal(res.longestStreak, 0);
  assert.equal(res.isActiveToday, false);
  assert.equal(res.wasActiveYesterday, false);
  assert.equal(res.streakAtRisk, false);
  assert.equal(res.totalActiveDays, 0);
});

test('calculateStreakData: activity today starts a 1-day active streak', () => {
  const ref = new Date('2026-11-20T12:00:00');
  const res = calculateStreakData(['2026-11-20'], ref);

  assert.equal(res.currentStreak, 1);
  assert.equal(res.longestStreak, 1);
  assert.equal(res.isActiveToday, true);
  assert.equal(res.wasActiveYesterday, false);
  assert.equal(res.streakAtRisk, false);
  assert.equal(res.totalActiveDays, 1);
  assert.match(res.motivationalMessageHi, /आज की पढ़ाई पूरी हुई/);
});

test('calculateStreakData: activity yesterday preserves streak as pending today (NO instant zero reset)', () => {
  const ref = new Date('2026-11-20T09:00:00'); // Morning of Nov 20, haven't studied yet today
  // Studied Nov 17, 18, 19
  const res = calculateStreakData(['2026-11-17', '2026-11-18', '2026-11-19'], ref);

  assert.equal(res.currentStreak, 3);
  assert.equal(res.longestStreak, 3);
  assert.equal(res.isActiveToday, false);
  assert.equal(res.wasActiveYesterday, true);
  assert.equal(res.streakAtRisk, true);
  assert.match(res.motivationalMessageEn, /Keep your 3-day streak alive/);
  assert.match(res.motivationalMessageHi, /अपनी 3-दिन की स्ट्रीक/);
});

test('calculateStreakData: activity completed today extends preserved streak', () => {
  const ref = new Date('2026-11-20T18:00:00');
  // Studied Nov 17, 18, 19 AND completed a session today Nov 20
  const res = calculateStreakData(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'], ref);

  assert.equal(res.currentStreak, 4);
  assert.equal(res.longestStreak, 4);
  assert.equal(res.isActiveToday, true);
  assert.equal(res.wasActiveYesterday, true);
  assert.equal(res.streakAtRisk, false);
  assert.match(res.motivationalMessageHi, /लगातार 4 दिन से पढ़ रहे हैं/);
});

test('calculateStreakData: missed yesterday and today resets current streak to 0, preserves longest', () => {
  const ref = new Date('2026-11-20T12:00:00');
  // Studied Nov 10, 11, 12, 13, 14 (5 consecutive days), then stopped
  const res = calculateStreakData(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'], ref);

  assert.equal(res.currentStreak, 0);
  assert.equal(res.longestStreak, 5);
  assert.equal(res.isActiveToday, false);
  assert.equal(res.wasActiveYesterday, false);
  assert.equal(res.streakAtRisk, false);
  assert.equal(res.totalActiveDays, 5);
  assert.match(res.motivationalMessageHi, /नई अध्ययन स्ट्रीक शुरू करें/);
});

test('calculateStreakData: 7-day rolling window generates accurate day status', () => {
  const ref = new Date('2026-11-20T12:00:00'); // Friday
  const dates = ['2026-11-18', '2026-11-19', '2026-11-20'];
  const res = calculateStreakData(dates, ref);

  assert.equal(res.last7Days.length, 7);
  // Last element should be today (Nov 20)
  const todayEntry = res.last7Days[6];
  assert.equal(todayEntry.date, '2026-11-20');
  assert.equal(todayEntry.isToday, true);
  assert.equal(todayEntry.studied, true);

  // Yesterday (Nov 19)
  assert.equal(res.last7Days[5].studied, true);
  // Day before yesterday (Nov 18)
  assert.equal(res.last7Days[4].studied, true);
  // 3 days ago (Nov 17)
  assert.equal(res.last7Days[3].studied, false);
});

test('calculateStreakData: milestone calculation and progress percentage', () => {
  const ref = new Date('2026-11-20T12:00:00');
  // 5-day streak
  const dates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];
  const res = calculateStreakData(dates, ref);

  assert.equal(res.currentStreak, 5);
  // 3-day milestone unlocked
  assert.equal(res.milestones[0].unlocked, true); // 3 days
  // 7-day milestone not unlocked yet
  assert.equal(res.milestones[1].unlocked, false); // 7 days
  assert.equal(res.nextMilestone.days, 7);
  // Progress between 3 and 7: (5 - 3) / (7 - 3) = 2 / 4 = 50%
  assert.equal(res.milestonePercent, 50);
});
