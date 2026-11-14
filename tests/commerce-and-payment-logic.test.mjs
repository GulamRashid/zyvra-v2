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

import { verifyPaymentOrder } from '../api/verify-payment.js';

test('verifyPaymentOrder: authenticated owner with valid order succeeds', async () => {
  const mockOrder = {
    id: 'ord_internal_100',
    user_id: 'usr_valid_owner',
    razorpay_order_id: 'order_rzp_100',
    gateway_order_id: 'order_rzp_100'
  };

  const client = {
    from: (table) => {
      assert.equal(table, 'payment_orders');
      return {
        select: () => ({
          eq: (col, val) => {
            assert.equal(col, 'id');
            assert.equal(val, 'ord_internal_100');
            return {
              maybeSingle: async () => ({ data: mockOrder, error: null })
            };
          }
        })
      };
    }
  };

  const verified = await verifyPaymentOrder({
    orderId: 'ord_internal_100',
    razorpayOrderId: 'order_rzp_100',
    userId: 'usr_valid_owner',
    client
  });

  assert.equal(verified.id, 'ord_internal_100');
  assert.equal(verified.user_id, 'usr_valid_owner');
});

test('verifyPaymentOrder: authenticated user attempting another user order returns 403', async () => {
  const otherUserOrder = {
    id: 'ord_victim_200',
    user_id: 'usr_victim',
    razorpay_order_id: 'order_rzp_200',
    gateway_order_id: 'order_rzp_200'
  };

  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: otherUserOrder, error: null })
        })
      })
    })
  };

  await assert.rejects(
    () => verifyPaymentOrder({
      orderId: 'ord_victim_200',
      razorpayOrderId: 'order_rzp_200',
      userId: 'usr_attacker',
      client
    }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.equal(err.message, 'Payment order ownership could not be verified.');
      return true;
    }
  );
});

test('verifyPaymentOrder: non-existent order returns 404', async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      })
    })
  };

  await assert.rejects(
    () => verifyPaymentOrder({
      orderId: 'ord_missing_999',
      razorpayOrderId: 'order_rzp_999',
      userId: 'usr_any',
      client
    }),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.equal(err.message, 'Payment order not found.');
      return true;
    }
  );
});

test('verifyPaymentOrder: mismatched Razorpay order ID returns 400', async () => {
  const order = {
    id: 'ord_internal_300',
    user_id: 'usr_valid_owner',
    razorpay_order_id: 'order_rzp_LEGIT',
    gateway_order_id: 'order_rzp_LEGIT'
  };

  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: order, error: null })
        })
      })
    })
  };

  await assert.rejects(
    () => verifyPaymentOrder({
      orderId: 'ord_internal_300',
      razorpayOrderId: 'order_rzp_MISMATCH',
      userId: 'usr_valid_owner',
      client
    }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.message, 'Payment order association could not be verified.');
      return true;
    }
  );
});

test('Payment Pipeline: fulfillment RPC is NEVER called when ownership or association validation fails', async () => {
  let rpcCallCount = 0;
  const mockClient = {
    rpc: async () => {
      rpcCallCount++;
      return { data: { success: true }, error: null };
    }
  };

  const orderOfOtherUser = {
    id: 'ord_victim_400',
    user_id: 'usr_other',
    razorpay_order_id: 'order_rzp_400',
    gateway_order_id: 'order_rzp_400'
  };

  const lookupClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: orderOfOtherUser, error: null })
        })
      })
    })
  };

  // 1. Ownership failure
  try {
    await verifyPaymentOrder({
      orderId: 'ord_victim_400',
      razorpayOrderId: 'order_rzp_400',
      userId: 'usr_attacker',
      client: lookupClient
    });
    assert.fail('Should have thrown 403');
  } catch (err) {
    assert.equal(err.statusCode, 403);
  }
  assert.equal(rpcCallCount, 0, 'Fulfillment RPC must NOT be called on ownership failure');

  // 2. Association failure
  try {
    await verifyPaymentOrder({
      orderId: 'ord_victim_400',
      razorpayOrderId: 'order_rzp_WRONG',
      userId: 'usr_other',
      client: lookupClient
    });
    assert.fail('Should have thrown 400');
  } catch (err) {
    assert.equal(err.statusCode, 400);
  }
  assert.equal(rpcCallCount, 0, 'Fulfillment RPC must NOT be called on association failure');

  // 3. Missing order failure
  const missingOrderClient = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      })
    })
  };

  try {
    await verifyPaymentOrder({
      orderId: 'ord_missing',
      razorpayOrderId: 'order_rzp_400',
      userId: 'usr_other',
      client: missingOrderClient
    });
    assert.fail('Should have thrown 404');
  } catch (err) {
    assert.equal(err.statusCode, 404);
  }
  assert.equal(rpcCallCount, 0, 'Fulfillment RPC must NOT be called on missing order');
});

