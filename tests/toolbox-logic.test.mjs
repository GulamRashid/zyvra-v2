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

