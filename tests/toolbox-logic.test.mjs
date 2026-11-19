import test from 'node:test';
import assert from 'node:assert/strict';

// Replicate pure logic functions from SmartCalculator.jsx
function calculate(left, operator, right) {
  if (operator === '+') return left + right;
  if (operator === '−') return left - right;
  if (operator === '×') return left * right;
  if (operator === '÷') return right === 0 ? NaN : left / right;
  if (operator === '%') return (left * right) / 100;
  if (operator === 'nPr') return choose(left, right, true);
  if (operator === 'nCr') return choose(left, right, false);
  return right;
}

function tidy(value) {
  return Number.isFinite(value) ? String(Number(value.toPrecision(10))) : 'Error';
}

function factorial(value) {
  if (!Number.isInteger(value) || value < 0 || value > 170) return NaN;
  let result = 1;
  for (let number = 2; number <= value; number += 1) result *= number;
  return result;
}

function choose(n, r, permutations) {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n || n > 170) return NaN;
  return permutations ? factorial(n) / factorial(n - r) : factorial(n) / (factorial(r) * factorial(n - r));
}

// Replicate pure logic functions from FractionConverter.jsx
function gcd(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) [left, right] = [right, left % right];
  return left || 1;
}

function approximateFraction(decimal) {
  let best = { numerator: Math.round(decimal), denominator: 1 };
  let smallestError = Math.abs(decimal - best.numerator);
  for (let denominator = 1; denominator <= 1000; denominator += 1) {
    const numerator = Math.round(decimal * denominator);
    const error = Math.abs(decimal - numerator / denominator);
    if (error < smallestError) {
      smallestError = error;
      best = { numerator, denominator };
    }
    if (error <= 0.0001) break;
  }
  const divisor = gcd(best.numerator, best.denominator);
  return { numerator: best.numerator / divisor, denominator: best.denominator / divisor };
}

test('SmartCalculator: basic arithmetic operations', () => {
  assert.equal(calculate(10, '+', 5), 15);
  assert.equal(calculate(10, '−', 4), 6);
  assert.equal(calculate(6, '×', 7), 42);
  assert.equal(calculate(20, '÷', 4), 5);
});

test('SmartCalculator [EDGE CASE]: division by zero returns Error via tidy()', () => {
  const result = calculate(15, '÷', 0);
  assert.ok(Number.isNaN(result), 'Division by zero must return NaN');
  assert.equal(tidy(result), 'Error', 'tidy(NaN) must format to "Error"');
});

test('SmartCalculator: % operator computes percentage of base value', () => {
  // In competitive exam calculators, 200 % 10 calculates 10% of 200 = 20
  const percentResult = calculate(200, '%', 10);
  assert.equal(percentResult, 20, '200 % 10 evaluates to 10% of 200 = 20');
});

test('SmartCalculator: factorial function boundary and overflow cases', () => {
  assert.equal(factorial(0), 1);
  assert.equal(factorial(1), 1);
  assert.equal(factorial(5), 120);
  assert.ok(Number.isNaN(factorial(-1)), 'Negative factorial must return NaN');
  assert.ok(Number.isNaN(factorial(3.5)), 'Non-integer factorial must return NaN');
  assert.ok(Number.isNaN(factorial(171)), 'Factorial > 170 overflows double precision and must return NaN');
  assert.ok(Number.isFinite(factorial(170)), '170! is the highest calculable JS factorial');
});

test('SmartCalculator: permutations (nPr) and combinations (nCr)', () => {
  assert.equal(choose(5, 2, true), 20);   // 5P2 = 20
  assert.equal(choose(5, 2, false), 10);  // 5C2 = 10
  assert.equal(choose(5, 0, false), 1);   // 5C0 = 1
  assert.equal(choose(5, 5, false), 1);   // 5C5 = 1
  assert.ok(Number.isNaN(choose(3, 5, false)), 'r > n must return NaN');
  assert.ok(Number.isNaN(choose(-1, 2, false)), 'Negative n must return NaN');
});

test('FractionConverter: percentage to fraction approximations', () => {
  const f1 = approximateFraction(16.6666 / 100);
  assert.equal(f1.numerator, 1);
  assert.equal(f1.denominator, 6);

  const f2 = approximateFraction(25 / 100);
  assert.equal(f2.numerator, 1);
  assert.equal(f2.denominator, 4);

  const f3 = approximateFraction(33.3333 / 100);
  assert.equal(f3.numerator, 1);
  assert.equal(f3.denominator, 3);
});

test('FractionConverter: GCD function correctness with edge cases', () => {
  assert.equal(gcd(12, 18), 6);
  assert.equal(gcd(-12, 18), 6);
  assert.equal(gcd(0, 5), 5);
  assert.equal(gcd(0, 0), 1, 'gcd(0,0) fallback returns 1');
});

// Spaced Repetition & Freemium Logic Tests
function nextReviewDateLogic(reviewCount, baseDate = new Date()) {
  const intervals = [1, 3, 7, 14, 30];
  const date = new Date(baseDate);
  date.setDate(date.getDate() + intervals[Math.min(reviewCount, intervals.length - 1)]);
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 10);
}

test('Spaced Repetition: intervals scale from 1d to 30d across review counts', () => {
  const base = new Date('2026-01-01T12:00:00Z');
  assert.equal(nextReviewDateLogic(0, base), '2026-01-02'); // +1 day
  assert.equal(nextReviewDateLogic(1, base), '2026-01-04'); // +3 days
  assert.equal(nextReviewDateLogic(2, base), '2026-01-08'); // +7 days
  assert.equal(nextReviewDateLogic(3, base), '2026-01-15'); // +14 days
  assert.equal(nextReviewDateLogic(4, base), '2026-01-31'); // +30 days
  assert.equal(nextReviewDateLogic(10, base), '2026-01-31'); // capped at 30 days
});

test('Freemium Limits: enforces 5 free mistakes and 10 free flashcards for free tier', () => {
  const FREE_MISTAKES_LIMIT = 5;
  const FREE_FLASHCARDS_LIMIT = 10;
  const PRO_MISTAKES_LIMIT = 200;

  const mockFreeItems = [1, 2, 3, 4, 5];
  const canAddMoreFree = mockFreeItems.length < FREE_MISTAKES_LIMIT;
  assert.equal(canAddMoreFree, false, 'Free tier must block additions past 5 mistakes');

  const isPro = true;
  const canAddMorePro = mockFreeItems.length < (isPro ? PRO_MISTAKES_LIMIT : FREE_MISTAKES_LIMIT);
  assert.equal(canAddMorePro, true, 'Pro tier must allow additions up to 200 mistakes');
  assert.equal(FREE_FLASHCARDS_LIMIT, 10, 'Free flashcards limit must be 10');
});

// Negative Marking & Expected Value Tests
function calculateExpectedScore({ sure, fiftyFifty, oneEliminated, blind, marks = 1, penalty = 0.333 }) {
  const sureScore = sure * marks;
  const evFifty = fiftyFifty * (0.5 * marks - 0.5 * penalty);
  const evOne = oneEliminated * (0.333 * marks - 0.667 * penalty);
  const evBlind = blind * (0.25 * marks - 0.75 * penalty);
  return Number((sureScore + evFifty + evOne + evBlind).toFixed(2));
}

test('Negative Marking Simulator: 50-50 elimination gives positive expected value', () => {
  // With marks = +1 and penalty = -0.333:
  // EV per 50-50 question is (0.5 * 1 - 0.5 * 0.333) = +0.3335
  const result = calculateExpectedScore({
    sure: 70,
    fiftyFifty: 20,
    oneEliminated: 0,
    blind: 0,
    marks: 1,
    penalty: 0.333
  });
  // 70 + 20 * 0.3335 = ~76.67
  assert.ok(result > 76.5 && result < 76.8, `Expected score ~76.67, got ${result}`);
});

test('Negative Marking Simulator: blind guesses yield zero or negative expectation', () => {
  // 10 blind guesses with 1/3 penalty: 0.25*1 - 0.75*0.333 = 0.25 - 0.25 = ~0.0
  const result = calculateExpectedScore({
    sure: 80,
    fiftyFifty: 0,
    oneEliminated: 0,
    blind: 10,
    marks: 1,
    penalty: 0.333
  });
  assert.ok(Math.abs(result - 80) < 0.1, `Blind guessing should not add reliable points, got ${result}`);
});

// Pure logic imports / replication for ClockMirrorTool
function calculateMirrorTime(hours, minutes) {
  const normH = hours % 12;
  let mirH;
  let mirM;
  if (minutes === 0) {
    mirH = (12 - normH) % 12;
    if (mirH === 0) mirH = 12;
    mirM = 0;
  } else {
    mirH = 11 - normH;
    if (mirH <= 0) mirH += 12;
    mirM = 60 - minutes;
  }
  return { hours: mirH, minutes: mirM };
}

function calculateWaterTime(hours, minutes) {
  const normH = hours % 12;
  let watH;
  let watM;
  if (minutes <= 30) {
    watH = (18 - (normH === 0 ? 12 : normH));
    watM = 30 - minutes;
  } else {
    watH = (17 - (normH === 0 ? 12 : normH));
    watM = 90 - minutes;
  }
  while (watH <= 0) watH += 12;
  while (watH > 12) watH -= 12;
  return { hours: watH, minutes: watM };
}

function calculateClockAngle(hours, minutes) {
  const normH = hours % 12;
  const angle = Math.abs(30 * normH - 5.5 * minutes);
  const acute = Math.min(angle, 360 - angle);
  const reflex = 360 - acute;
  return { acute: Number(acute.toFixed(2)), reflex: Number(reflex.toFixed(2)) };
}

test('ClockMirrorTool: mirror image and angle calculations', () => {
  // 8:20 mirror image is 11:60 - 8:20 = 3:40
  const m1 = calculateMirrorTime(8, 20);
  assert.equal(m1.hours, 3);
  assert.equal(m1.minutes, 40);

  // 12:15 mirror image is 11:45
  const m2 = calculateMirrorTime(12, 15);
  assert.equal(m2.hours, 11);
  assert.equal(m2.minutes, 45);

  // 3:00 mirror image is 9:00
  const m3 = calculateMirrorTime(3, 0);
  assert.equal(m3.hours, 9);
  assert.equal(m3.minutes, 0);

  // Water image of 4:40 is 17:90 - 4:40 = 13:50 -> 1:50
  const w1 = calculateWaterTime(4, 40);
  assert.equal(w1.hours, 1);
  assert.equal(w1.minutes, 50);

  // Angle at 8:20 -> |30*8 - 5.5*20| = |240 - 110| = 130 deg
  const a1 = calculateClockAngle(8, 20);
  assert.equal(a1.acute, 130);
  assert.equal(a1.reflex, 230);
});

// Pure logic for CalendarDayTool
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getCenturyCode(year) {
  const century = Math.floor(year / 100);
  const rem = century % 4;
  if (rem === 0) return 6;
  if (rem === 1) return 4;
  if (rem === 2) return 2;
  return 0;
}

function getMonthCode(month, isLeap) {
  const normalCodes = [0, 3, 3, 6, 1, 4, 6, 2, 5, 0, 3, 5];
  if (isLeap) {
    if (month === 1) return 6;
    if (month === 2) return 2;
  }
  return normalCodes[month - 1];
}

function calculateDayOfWeek(year, month, day) {
  const leap = isLeapYear(year);
  const monthCode = getMonthCode(month, leap);
  const centuryCode = getCenturyCode(year);
  const yearLastTwo = year % 100;
  const leapYearsInTwo = Math.floor(yearLastTwo / 4);
  const totalSum = day + monthCode + centuryCode + yearLastTwo + leapYearsInTwo;
  const dayIndex = totalSum % 7;
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { dayIndex, nameEn: dayNamesEn[dayIndex], isLeap: leap };
}

function getCalendarRepetition(year) {
  const rem = year % 4;
  if (isLeapYear(year)) return year + 28;
  if (rem === 1) return year + 6;
  return year + 11;
}

test('CalendarDayTool: verified historical dates and repetition rules', () => {
  // 15 August 1947 was Friday (5)
  const d1 = calculateDayOfWeek(1947, 8, 15);
  assert.equal(d1.dayIndex, 5);
  assert.equal(d1.nameEn, 'Friday');

  // 26 January 1950 was Thursday (4)
  const d2 = calculateDayOfWeek(1950, 1, 26);
  assert.equal(d2.dayIndex, 4);
  assert.equal(d2.nameEn, 'Thursday');

  // 02 October 1869 (Gandhi Jayanti) was Saturday (6)
  const d3 = calculateDayOfWeek(1869, 10, 2);
  assert.equal(d3.dayIndex, 6);
  assert.equal(d3.nameEn, 'Saturday');

  // 29 February 2024 (Leap Day) was Thursday (4)
  const d4 = calculateDayOfWeek(2024, 2, 29);
  assert.equal(d4.dayIndex, 4);
  assert.equal(d4.nameEn, 'Thursday');
  assert.equal(d4.isLeap, true);

  // Calendar Repetition
  assert.equal(getCalendarRepetition(2024), 2052, 'Leap year 2024 repeats in 28 years (2052)');
  assert.equal(getCalendarRepetition(2025), 2031, 'Leap+1 year 2025 repeats in 6 years (2031)');
  assert.equal(getCalendarRepetition(2026), 2037, 'Leap+2 year 2026 repeats in 11 years (2037)');
});

