import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReferralCode } from '../src/lib/referrals.js';

test('generateReferralCode: format and character set constraints', () => {
  const code = generateReferralCode();
  assert.ok(code.startsWith('ZYV'), 'Referral code must start with ZYV prefix');
  assert.equal(code.length, 6, 'Total code length must be exactly 6 characters');
  assert.match(code, /^ZYV[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/, 'Suffix must only use safe characters (no 0, 1, I, O)');
});

test('generateReferralCode [ANALYSIS]: high collision probability with 3 random characters', () => {
  const generatedCodes = new Set();
  const sampleSize = 1000;
  let collisions = 0;

  for (let i = 0; i < sampleSize; i++) {
    const code = generateReferralCode();
    if (generatedCodes.has(code)) {
      collisions++;
    } else {
      generatedCodes.add(code);
    }
  }

  // Total possible permutations: 30^3 = 27,000.
  // With 1,000 samples, by birthday paradox: E[collisions] ≈ 1000^2 / (2 * 27000) ≈ 18.5
  // This verifies our finding that 3 random characters has high collision probability.
  assert.ok(collisions > 0, `Expected collisions in 1,000 samples with 30^3 space. Found: ${collisions} collisions`);
});

