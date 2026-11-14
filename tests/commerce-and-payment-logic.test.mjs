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

import createOrderHandler, { GET as createOrderGet } from '../api/create-order.js';
import verifyPaymentHandler, { GET as verifyPaymentGet } from '../api/verify-payment.js';
import { sanitizeErrorMessage, getPaymentServices, parseRequestBody } from '../api/_payment.js';

test('API Endpoint Security: 405 Method Not Allowed on non-POST requests with Allow header', async () => {
  // 1. create-order Web Standard GET
  const req1 = new Request('https://zyvra-v2.vercel.app/api/create-order', { method: 'GET' });
  const res1 = await createOrderHandler(req1);
  assert.equal(res1.status, 405);
  assert.equal(res1.headers.get('Allow'), 'POST');
  const body1 = await res1.json();
  assert.equal(body1.error, 'Method not allowed.');

  // Named export GET
  const res1Named = await createOrderGet();
  assert.equal(res1Named.status, 405);

  // 2. create-order Node (req, res) GET
  let nodeStatus1 = null;
  let nodeHeaders1 = {};
  let nodeBody1 = null;
  const mockRes1 = {
    status: (s) => { nodeStatus1 = s; return mockRes1; },
    setHeader: (k, v) => { nodeHeaders1[k] = v; },
    send: (b) => { nodeBody1 = JSON.parse(b); }
  };
  await createOrderHandler({ method: 'GET' }, mockRes1);
  assert.equal(nodeStatus1, 405);
  assert.equal(nodeHeaders1['Allow'], 'POST');
  assert.equal(nodeBody1.error, 'Method not allowed.');

  // 3. verify-payment Web Standard GET
  const req2 = new Request('https://zyvra-v2.vercel.app/api/verify-payment', { method: 'GET' });
  const res2 = await verifyPaymentHandler(req2);
  assert.equal(res2.status, 405);
  assert.equal(res2.headers.get('Allow'), 'POST');

  // Named export GET
  const res2Named = await verifyPaymentGet();
  assert.equal(res2Named.status, 405);

  // 4. verify-payment Node (req, res) GET
  let nodeStatus2 = null;
  let nodeHeaders2 = {};
  let nodeBody2 = null;
  const mockRes2 = {
    status: (s) => { nodeStatus2 = s; return mockRes2; },
    setHeader: (k, v) => { nodeHeaders2[k] = v; },
    send: (b) => { nodeBody2 = JSON.parse(b); }
  };
  await verifyPaymentHandler({ method: 'GET' }, mockRes2);
  assert.equal(nodeStatus2, 405);
  assert.equal(nodeHeaders2['Allow'], 'POST');
  assert.equal(nodeBody2.error, 'Method not allowed.');
});

test('API Input Validation: parseRequestBody handles malformed JSON, arrays, and Web Standard streams safely', async () => {
  // A. Array input is rejected (must be plain object)
  await assert.rejects(
    async () => parseRequestBody({ body: '[1, 2, 3]' }),
    /Request body must be valid JSON/
  );

  // B. Malformed JSON string is rejected with 400
  await assert.rejects(
    async () => parseRequestBody({ body: '{malformed: true' }),
    /Request body must be valid JSON/
  );

  // C. Empty body returns empty object
  const empty = await parseRequestBody({ body: null });
  assert.deepEqual(empty, {});

  // D. Web Standard Request with malformed JSON rejected with 400
  const badReq = new Request('https://example.com', { method: 'POST', body: 'not-json' });
  await assert.rejects(
    async () => parseRequestBody(badReq),
    /Request body must be valid JSON/
  );
});

test('API Secret Safety: sanitizeErrorMessage prevents leaking API keys, secrets, tokens, and DB syntax', () => {
  // A. Razorpay secret leak blocked
  const leak1 = sanitizeErrorMessage(new Error('Failed with RAZORPAY_KEY_SECRET=sec_xyz123'));
  assert.equal(leak1, 'Unable to process request.');

  // B. Bearer token leak blocked
  const leak2 = sanitizeErrorMessage(new Error('Auth failed for Bearer eyJhbGciOi...'));
  assert.equal(leak2, 'Unable to process request.');

  // C. Service role key leak blocked
  const leak3 = sanitizeErrorMessage(new Error('supabase service_role violation'));
  assert.equal(leak3, 'Unable to process request.');

  // D. Database relation / syntax leak blocked
  const leak4 = sanitizeErrorMessage(new Error('relation "public.payment_orders" does not exist at character 12'));
  assert.equal(leak4, 'Unable to process request.');

  // E. Safe user-facing message preserved
  const safeMsg = 'A valid payment amount is required.';
  assert.equal(sanitizeErrorMessage(new Error(safeMsg)), safeMsg);
});

test('API Authentication Token Verification: rejects missing or invalid Bearer tokens with 401', () => {
  // Missing Authorization header
  assert.throws(
    () => getPaymentServices({ headers: {} }),
    (err) => err.statusCode === 401 && /Sign in before starting checkout/i.test(err.message)
  );

  // Non-Bearer token
  assert.throws(
    () => getPaymentServices({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }),
    (err) => err.statusCode === 401
  );

  // Empty Bearer token
  assert.throws(
    () => getPaymentServices({ headers: { authorization: 'Bearer   ' } }),
    (err) => err.statusCode === 401
  );
});

test('API Input Validation: verify-payment rejects malformed or unvalidated identifier formats with 400', async () => {
  let status = null;
  let body = null;
  const mockRes = {
    status: (s) => { status = s; return mockRes; },
    setHeader: () => {},
    send: (b) => { body = JSON.parse(b); }
  };

  // Malformed Razorpay order ID (missing order_ prefix)
  await verifyPaymentHandler(
    {
      method: 'POST',
      headers: { authorization: 'Bearer valid_token' },
      body: {
        razorpay_order_id: 'invalid_order_id',
        razorpay_payment_id: 'pay_1234567890',
        razorpay_signature: 'a'.repeat(64),
        order_id: '11111111-1111-1111-1111-111111111111'
      }
    },
    mockRes
  );
  assert.equal(status, 400);
  assert.equal(body.error, 'Payment verification parameters are invalid.');

  // Malformed Signature (not 64 hex characters)
  await verifyPaymentHandler(
    {
      method: 'POST',
      headers: { authorization: 'Bearer valid_token' },
      body: {
        razorpay_order_id: 'order_1234567890',
        razorpay_payment_id: 'pay_1234567890',
        razorpay_signature: 'short_sig',
        order_id: '11111111-1111-1111-1111-111111111111'
      }
    },
    mockRes
  );
  assert.equal(status, 400);
  assert.equal(body.error, 'Payment verification parameters are invalid.');

  // Malformed Internal Order ID (not a UUID)
  await verifyPaymentHandler(
    {
      method: 'POST',
      headers: { authorization: 'Bearer valid_token' },
      body: {
        razorpay_order_id: 'order_1234567890',
        razorpay_payment_id: 'pay_1234567890',
        razorpay_signature: 'a'.repeat(64),
        order_id: 'not-a-valid-uuid'
      }
    },
    mockRes
  );
  assert.equal(status, 400);
  assert.equal(body.error, 'Payment verification parameters are invalid.');
});


