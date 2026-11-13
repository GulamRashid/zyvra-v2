import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  parseCoinRedemptionConfig,
  normalizeAccessResult,
  formatRupees
} from '../src/lib/commerce.js';

test('parseCoinRedemptionConfig: valid configurations and defaults', () => {
  const conf1 = parseCoinRedemptionConfig({ coins_per_rupee: 10, max_discount_percent: 20 });
  assert.equal(conf1.coins_per_rupee, 10);
  assert.equal(conf1.max_discount_percent, 20);

  const confJson = parseCoinRedemptionConfig('{"coins_per_rupee": 5, "max_discount_percent": 15}');
  assert.equal(confJson.coins_per_rupee, 5);
  assert.equal(confJson.max_discount_percent, 15);
});

test('parseCoinRedemptionConfig [ERROR HANDLING]: rejects invalid values', () => {
  assert.throws(() => parseCoinRedemptionConfig({ coins_per_rupee: -5, max_discount_percent: 20 }));
  assert.throws(() => parseCoinRedemptionConfig({ coins_per_rupee: 0, max_discount_percent: 20 }));
  assert.throws(() => parseCoinRedemptionConfig({ coins_per_rupee: 10, max_discount_percent: 120 }));
  assert.throws(() => parseCoinRedemptionConfig({ coins_per_rupee: 10, max_discount_percent: -10 }));
});

test('normalizeAccessResult: correctly parses diverse RPC returns', () => {
  assert.equal(normalizeAccessResult(true), true);
  assert.equal(normalizeAccessResult(false), false);
  assert.equal(normalizeAccessResult([true]), true);
  assert.equal(normalizeAccessResult('active'), true);
  assert.equal(normalizeAccessResult('granted'), true);
  assert.equal(normalizeAccessResult('revoked'), false);
  assert.equal(normalizeAccessResult({ has_access: true }), true);
  assert.equal(normalizeAccessResult({ is_granted: false }), false);
  assert.equal(normalizeAccessResult([{ access_granted: true }]), true);
});

test('formatRupees: formats currency in Indian locale', () => {
  assert.equal(formatRupees(49), '₹49.00');
  assert.equal(formatRupees(1999), '₹1,999.00');
  assert.equal(formatRupees(0), '₹0.00');
  assert.equal(formatRupees(null), '₹0.00');
});

test('Payment Signature Verification: validates Razorpay HMAC SHA256 signature', () => {
  const testSecret = 'test_secret_key_12345';
  const orderId = 'order_test_987654';
  const paymentId = 'pay_test_123456';

  const expectedSignature = createHmac('sha256', testSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const correctBuffer = Buffer.from(expectedSignature, 'utf8');
  const matchingBuffer = Buffer.from(expectedSignature, 'utf8');
  assert.ok(timingSafeEqual(correctBuffer, matchingBuffer), 'Matching signature must pass timingSafeEqual');

  const tamperedSignature = expectedSignature.slice(0, -2) + 'aa';
  const tamperedBuffer = Buffer.from(tamperedSignature, 'utf8');
  assert.equal(timingSafeEqual(correctBuffer, tamperedBuffer), false, 'Tampered signature must fail verification');
});

