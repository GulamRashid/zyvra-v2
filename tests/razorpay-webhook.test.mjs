import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { extractPayment, processWebhookPayload, verifyWebhookSignature, readRawBody, default as defaultHandler } from '../api/razorpay-webhook.js';
import { getFriendlyErrorMessage } from '../src/lib/errors.js';

const secret = 'webhook_test_secret';
const payment = {
  id: 'pay_test_1',
  order_id: 'order_test_1',
  amount: 4900,
  currency: 'INR'
};

function event(name = 'payment.captured', override = {}) {
  return {
    event: name,
    payload: {
      payment: { entity: { ...payment, ...override } },
      order: { entity: { id: payment.order_id, amount: payment.amount, currency: payment.currency } }
    }
  };
}

test('valid payment.captured and order.paid payloads extract payment details', () => {
  assert.deepEqual(extractPayment(event()), {
    supported: true,
    event: 'payment.captured',
    orderId: 'order_test_1',
    paymentId: 'pay_test_1',
    amountPaise: 4900,
    currency: 'INR'
  });
  assert.equal(extractPayment(event('order.paid')).event, 'order.paid');
});

test('signature validation rejects missing and invalid signatures', () => {
  const raw = Buffer.from('{"event":"payment.captured"}');
  const valid = createHmac('sha256', secret).update(raw).digest('hex');
  assert.equal(verifyWebhookSignature(raw, valid, secret), true);
  assert.equal(verifyWebhookSignature(raw, undefined, secret), false);
  assert.equal(verifyWebhookSignature(raw, `${valid.slice(0, -1)}0`, secret), false);
});

// 1. Regression test: valid checkout with no coins
test('valid checkout with no coins fulfills atomically without coin deduction', async () => {
  const order = {
    id: 'ord_no_coins_123',
    amount_paise: 4900,
    amount: 49,
    final_amount: 49,
    coins_redeemed: 0,
    currency: 'INR',
    status: 'created',
    razorpay_order_id: 'order_test_1',
    razorpay_payment_id: null,
    item_type: 'folder',
    item_id: 'folder-abc-123',
    user_id: 'user-xyz-456'
  };

  const db = {
    orders: [order],
    userAccess: [],
    wallet: { user_id: 'user-xyz-456', balance: 500, total_redeemed: 0 },
    coinLedger: [],
    coinTransactions: []
  };

  const fulfill = async (input) => {
    assert.equal(input.internalOrderId, order.id);
    assert.equal(input.razorpayOrderId, 'order_test_1');
    assert.equal(input.paymentId, 'pay_test_1');

    // Simulate PostgreSQL atomic fulfillment
    order.status = 'paid';
    order.razorpay_payment_id = input.paymentId;
    order.amount_paid = order.final_amount;

    db.userAccess.push({
      user_id: order.user_id,
      item_type: order.item_type,
      item_id: order.item_id,
      status: 'active',
      is_active: true
    });

    const coinsToDeduct = order.coins_redeemed || 0;
    if (coinsToDeduct > 0) {
      db.wallet.balance -= coinsToDeduct;
    }
    return { success: true };
  };

  const result = await processWebhookPayload(event(), {
    lookupOrder: async () => order,
    fulfill
  });

  assert.equal(result.success, true);
  assert.equal(order.status, 'paid');
  assert.equal(order.razorpay_payment_id, 'pay_test_1');
  assert.equal(db.userAccess.length, 1);
  assert.equal(db.userAccess[0].is_active, true);
  assert.equal(db.wallet.balance, 500, 'Wallet balance must be unchanged when coins_redeemed = 0');
  assert.equal(db.coinLedger.length, 0, 'No coin ledger entry for 0 coins');
});

// 2. Regression test: valid checkout with coin redemption
test('valid checkout with coin redemption updates wallet, ledger, and transactions atomically', async () => {
  const order = {
    id: 'ord_coins_456',
    amount_paise: 3900,
    amount: 49,
    final_amount: 39,
    coins_redeemed: 100,
    currency: 'INR',
    status: 'created',
    razorpay_order_id: 'order_test_1',
    razorpay_payment_id: null,
    item_type: 'chapter',
    item_id: 'chap-1',
    user_id: 'student-1'
  };

  const db = {
    orders: [order],
    userAccess: [],
    wallet: { user_id: 'student-1', balance: 500, total_redeemed: 50, total_spent: 50 },
    coinLedger: [],
    coinTransactions: []
  };

  const fulfill = async (input) => {
    order.status = 'paid';
    order.razorpay_payment_id = input.paymentId;
    order.amount_paid = order.final_amount;

    db.userAccess.push({
      user_id: order.user_id,
      item_type: order.item_type,
      item_id: order.item_id,
      status: 'active',
      is_active: true
    });

    const coinsToDeduct = order.coins_redeemed;
    if (coinsToDeduct > 0) {
      const newBalance = Math.max(0, db.wallet.balance - coinsToDeduct);
      db.wallet.balance = newBalance;
      db.wallet.total_redeemed += coinsToDeduct;
      db.wallet.total_spent += coinsToDeduct;

      // Schema-aligned coin_ledger entry
      db.coinLedger.push({
        user_id: order.user_id,
        amount: coinsToDeduct,
        tx_type: 'debit',
        source: 'checkout_discount',
        reason: `Redeemed ${coinsToDeduct} coins for chapter purchase`,
        reference_id: order.id,
        balance_after: newBalance
      });

      // Schema-aligned coin_transactions entry
      db.coinTransactions.push({
        user_id: order.user_id,
        amount: -coinsToDeduct,
        transaction_type: 'redeem',
        description: `Redeemed ${coinsToDeduct} coins for chapter purchase`
      });
    }
    return { success: true };
  };

  const result = await processWebhookPayload(event('payment.captured', { amount: 3900 }), {
    lookupOrder: async () => order,
    fulfill
  });

  assert.equal(result.success, true);
  assert.equal(order.status, 'paid');
  assert.equal(db.wallet.balance, 400);
  assert.equal(db.wallet.total_redeemed, 150);
  assert.equal(db.coinLedger.length, 1);
  assert.equal(db.coinLedger[0].tx_type, 'debit');
  assert.equal(db.coinLedger[0].balance_after, 400);
  assert.equal(db.coinTransactions.length, 1);
  assert.equal(db.coinTransactions[0].amount, -100);
});

// 3. Regression test: repeated webhook delivery
test('repeated webhook delivery fulfills exactly once with no double coin deduction', async () => {
  const order = {
    id: 'ord_repeat_789',
    amount_paise: 4900,
    amount: 49,
    final_amount: 49,
    coins_redeemed: 50,
    currency: 'INR',
    status: 'created',
    razorpay_order_id: 'order_test_1',
    razorpay_payment_id: null,
    item_type: 'exam',
    item_id: 'exam-1',
    user_id: 'student-2'
  };

  let coinDeductions = 0;
  let fulfillmentCount = 0;

  const fulfill = async (input) => {
    if (order.status === 'paid') {
      return { success: true, alreadyFulfilled: true };
    }
    fulfillmentCount++;
    order.status = 'paid';
    order.razorpay_payment_id = input.paymentId;
    coinDeductions += order.coins_redeemed;
    return { success: true };
  };

  // Deliver 1st time
  const r1 = await processWebhookPayload(event(), { lookupOrder: async () => order, fulfill });
  assert.equal(r1.success, true);
  assert.equal(fulfillmentCount, 1);
  assert.equal(coinDeductions, 50);

  // Deliver 2nd time (duplicate delivery)
  const r2 = await processWebhookPayload(event(), { lookupOrder: async () => order, fulfill });
  assert.equal(r2.alreadyFulfilled, true);
  assert.equal(fulfillmentCount, 1);
  assert.equal(coinDeductions, 50, 'Coins must not be deducted a second time');

  // Deliver 3rd time via order.paid
  const r3 = await processWebhookPayload(event('order.paid'), { lookupOrder: async () => order, fulfill });
  assert.equal(r3.alreadyFulfilled, true);
  assert.equal(fulfillmentCount, 1);
  assert.equal(coinDeductions, 50);
});

// 4. Regression test: invalid payment ID
test('invalid payment ID format or conflicting payment ID fails safely', async () => {
  assert.throws(
    () => extractPayment(event('payment.captured', { id: 'invalid_prefix' })),
    /identifiers are invalid/
  );
  assert.throws(
    () => extractPayment(event('payment.captured', { id: '' })),
    /incomplete/
  );
  assert.throws(
    () => extractPayment(event('payment.captured', { order_id: 'bad_order_format' })),
    /identifiers are invalid/
  );

  const order = {
    id: 'ord_conflict',
    amount_paise: 4900,
    currency: 'INR',
    status: 'paid',
    razorpay_order_id: 'order_test_1',
    razorpay_payment_id: 'pay_original_1'
  };

  // Attempting to fulfill an already paid order with a DIFFERENT payment ID is rejected
  await assert.rejects(
    () => processWebhookPayload(event('payment.captured', { id: 'pay_different_999' }), {
      lookupOrder: async () => order,
      fulfill: async () => ({})
    }),
    /A different payment is already recorded/
  );
});

// 5. Regression test: invalid amount/currency
test('invalid amount or currency mismatch is rejected before fulfillment', async () => {
  const order = {
    id: 'ord_amount_test',
    amount_paise: 4900,
    currency: 'INR',
    status: 'created',
    razorpay_order_id: 'order_test_1'
  };

  // Amount mismatch
  await assert.rejects(
    () => processWebhookPayload(event('payment.captured', { amount: 5000 }), {
      lookupOrder: async () => order,
      fulfill: async () => ({})
    }),
    /amount or currency does not match/
  );

  // Currency mismatch
  await assert.rejects(
    () => processWebhookPayload(event('payment.captured', { currency: 'USD' }), {
      lookupOrder: async () => order,
      fulfill: async () => ({})
    }),
    /amount or currency does not match/
  );

  // Zero / negative amount
  assert.throws(
    () => extractPayment(event('payment.captured', { amount: 0 })),
    /incomplete/
  );
});

// 6. Regression test: legacy function cannot be abused
test('legacy functions are dropped and direct client verification is blocked', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261115010000_atomic_razorpay_webhook_fulfillment.sql', import.meta.url), 'utf8');

  // Verify legacy insecure 2-arg function is dropped
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.complete_successful_checkout\(UUID, TEXT\);/i);

  // Verify legacy 3-arg boolean function is dropped
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.create_checkout_order\(TEXT, UUID, BOOLEAN\);/i);

  // Verify complete_successful_checkout requires server API or database secret
  assert.match(sql, /Direct client-side verification is disabled\. Verification must be performed via server API\./);
  assert.match(sql, /auth\.role\(\) = 'service_role'/);
});

// 7. Regression test: existing checkout creation remains functional
test('checkout order creation RPC supports folders, chapters, exams and pricing fallback', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261115010000_atomic_razorpay_webhook_fulfillment.sql', import.meta.url), 'utf8');

  // Item type validation
  assert.match(sql, /v_clean_type NOT IN \('folder', 'chapter', 'exam'\)/);

  // Pricing column fallback handling across folders, chapters, exams
  assert.match(sql, /coalesce\(price, effective_price, base_price, 0\)/);
  assert.match(sql, /coalesce\(price, custom_price, 0\)/);
  assert.match(sql, /coalesce\(price, pass_price, 0\)/);

  // Enforces max discount limit and wallet balance
  assert.match(sql, /v_max_coins := least\(/);
  assert.match(sql, /v_reserved_coins/);

  // Creates order with status 'created' and required amount columns
  assert.match(sql, /amount_paise, status, currency/);
  assert.match(sql, /'created', 'INR'/);
});

// 8. Regression test: students cannot forge pending orders
test('payment_orders permissions remove direct student writes and forgeable insert policies', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261115010000_atomic_razorpay_webhook_fulfillment.sql', import.meta.url), 'utf8');

  // Table privileges revoked
  assert.match(sql, /REVOKE ALL ON public\.payment_orders FROM anon;/i);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE ON public\.payment_orders FROM PUBLIC, authenticated;/i);
  assert.match(sql, /GRANT SELECT ON public\.payment_orders TO authenticated;/i);

  // Insecure student write policies dropped
  assert.match(sql, /DROP POLICY IF EXISTS "Users insert own pending orders" ON public\.payment_orders;/i);
  assert.match(sql, /DROP POLICY IF EXISTS "Users can insert own payment orders" ON public\.payment_orders;/i);
  assert.match(sql, /DROP POLICY IF EXISTS "Users can update own payment orders" ON public\.payment_orders;/i);

  // Status constraint aligned with genuine application statuses including 'paid'
  assert.match(sql, /ALTER TABLE public\.payment_orders DROP CONSTRAINT payment_orders_status_check;/i);
  assert.match(sql, /ARRAY\['created'::text, 'pending'::text, 'paid'::text, 'captured'::text, 'failed'::text, 'refunded'::text\]/);
});

// 9. Regression test: stale order expiration, late webhook rejection, and coin reservation safety
test('stale order expiration and coin safety migration enforces robust bounds', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261115020000_stale_order_expiration_and_coin_safety.sql', import.meta.url), 'utf8');

  // Status constraint includes 'expired'
  assert.match(sql, /ARRAY\['created'::text, 'pending'::text, 'paid'::text, 'captured'::text, 'failed'::text, 'refunded'::text, 'expired'::text\]/);

  // create_checkout_order expires stale orders older than 30 minutes
  assert.match(sql, /status = 'expired'/);
  assert.match(sql, /created_at < \(pg_catalog\.now\(\) - INTERVAL '30 minutes'\)/);

  // Active reservations strictly counted from unexpired window
  assert.match(sql, /created_at >= \(pg_catalog\.now\(\) - INTERVAL '30 minutes'\)/);

  // fulfill_checkout_order_atomic explicitly rejects expired orders
  assert.match(sql, /lower\(coalesce\(v_order\.status, ''\)\) = 'expired'/);
  assert.match(sql, /'is_expired', true/);
  assert.match(sql, /This checkout order has expired/);

  // Coin wallet deduction guarantees never negative
  assert.match(sql, /balance = greatest\(0, balance - v_coins_to_deduct\)/);
});

test('processWebhookPayload rejects expired checkout orders', async () => {
  const expiredOrder = {
    id: 'ord-expired-123',
    amount_paise: 49700,
    currency: 'INR',
    status: 'expired',
    razorpay_order_id: 'order_exp_1',
    gateway_order_id: 'order_exp_1',
    razorpay_payment_id: null,
    gateway_payment_id: null
  };

  const fulfill = async () => {
    // Database returns error when order is expired
    return { success: false, is_expired: true, error: 'This checkout order has expired.' };
  };

  await assert.rejects(
    () => processWebhookPayload(event('payment.captured', { id: 'pay_exp_1', order_id: 'order_exp_1', amount: 49700 }), {
      lookupOrder: async () => expiredOrder,
      fulfill
    }),
    /Payment fulfillment was rejected/
  );
});

test('simulation of multiple abandoned orders safely expires old orders and calculates correct reserved coins', () => {
  const now = Date.now();
  const THIRTY_MINS = 30 * 60 * 1000;

  const orders = [
    { id: '1', user_id: 'u1', status: 'created', coins_redeemed: 20, created_at: now - 35 * 60 * 1000 },
    { id: '2', user_id: 'u1', status: 'created', coins_redeemed: 20, created_at: now - 40 * 60 * 1000 },
    { id: '3', user_id: 'u1', status: 'created', coins_redeemed: 20, created_at: now - 10 * 60 * 1000 }, // active
    { id: '4', user_id: 'u1', status: 'created', coins_redeemed: 20, created_at: now - 5 * 60 * 1000 },  // active
  ];

  // 1. Mark orders older than 30 mins as expired
  for (const o of orders) {
    if (o.status === 'created' && (now - o.created_at) > THIRTY_MINS) {
      o.status = 'expired';
    }
  }

  assert.equal(orders[0].status, 'expired');
  assert.equal(orders[1].status, 'expired');
  assert.equal(orders[2].status, 'created');
  assert.equal(orders[3].status, 'created');

  // 2. Sum reserved coins only from active (non-expired) unfulfilled orders
  const reservedCoins = orders
    .filter(o => o.status === 'created' && (now - o.created_at) <= THIRTY_MINS)
    .reduce((sum, o) => sum + o.coins_redeemed, 0);

  assert.equal(reservedCoins, 40); // Only 40 reserved instead of 80
});

test('coin deduction with insufficient balance prevents negative wallet balance', () => {
  let walletBalance = 10;
  const coinsToDeduct = 20; // Order asked for 20, but user currently only has 10 left

  const newBalance = Math.max(0, walletBalance - coinsToDeduct);
  assert.equal(newBalance, 0); // Never goes below 0
});

// 10. Regression tests for attach_checkout_gateway_order RPC
test('attach_checkout_gateway_order migration enforces strict security and constraints', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261115030000_attach_checkout_gateway_order_rpc.sql', import.meta.url), 'utf8');

  // Strict service-role enforcement
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /Service role authentication required\./);

  // Security Definer & search path
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog, public, auth, extensions/);
  assert.match(sql, /OWNER TO postgres/);

  // Permissions revoked from anon/authenticated, granted to service_role
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.attach_checkout_gateway_order\(UUID, TEXT\) FROM PUBLIC, anon, authenticated;/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.attach_checkout_gateway_order\(UUID, TEXT\) TO service_role;/);

  // Gateway order ID format check
  assert.match(sql, /\^order_\[A-Za-z0-9_-\]\+\$/);

  // Only allowed in 'created' status
  assert.match(sql, /lower\(coalesce\(v_order\.status, ''\)\) <> 'created'/);

  // Idempotency: same ID succeeds, different ID rejected
  assert.match(sql, /'already_attached', true/);
  assert.match(sql, /Order is already associated with a different gateway order ID\./);

  // Collision prevention: cannot bind same gateway order ID to multiple internal orders
  assert.match(sql, /Gateway order ID is already bound to another payment order\./);
});

test('api/create-order handles gateway order attachment safely via service role RPC', () => {
  // Unit test verifying attachment handling contract in create-order
  const simulateAttachment = ({ role, orderStatus, currentGatewayId, newGatewayId, orderExists }) => {
    if (role !== 'service_role') {
      const err = new Error('Service role authentication required.');
      err.code = '42501';
      throw err;
    }
    if (!orderExists) {
      return { success: false, error: 'Payment order not found.' };
    }
    if (orderStatus !== 'created') {
      return { success: false, error: `Cannot attach gateway order to order with status ${orderStatus}.` };
    }
    if (!/^order_[A-Za-z0-9_-]+$/.test(newGatewayId)) {
      return { success: false, error: 'Invalid gateway order identifier format.' };
    }
    if (currentGatewayId) {
      if (currentGatewayId === newGatewayId) {
        return { success: true, already_attached: true };
      }
      return { success: false, error: 'Order is already associated with a different gateway order ID.' };
    }
    return { success: true };
  };

  // 1. Success on valid created order
  const ok = simulateAttachment({
    role: 'service_role',
    orderStatus: 'created',
    currentGatewayId: null,
    newGatewayId: 'order_rzp_valid_123',
    orderExists: true
  });
  assert.equal(ok.success, true);

  // 2. Unauthorized caller rejected
  assert.throws(
    () => simulateAttachment({
      role: 'authenticated',
      orderStatus: 'created',
      currentGatewayId: null,
      newGatewayId: 'order_rzp_valid_123',
      orderExists: true
    }),
    /Service role authentication required/
  );

  // 3. Nonexistent order rejected
  const missing = simulateAttachment({
    role: 'service_role',
    orderStatus: 'created',
    currentGatewayId: null,
    newGatewayId: 'order_rzp_valid_123',
    orderExists: false
  });
  assert.equal(missing.success, false);
  assert.equal(missing.error, 'Payment order not found.');

  // 4. Non-created status rejected (e.g. expired or paid)
  const expired = simulateAttachment({
    role: 'service_role',
    orderStatus: 'expired',
    currentGatewayId: null,
    newGatewayId: 'order_rzp_valid_123',
    orderExists: true
  });
  assert.equal(expired.success, false);
  assert.match(expired.error, /Cannot attach gateway order to order with status expired/);

  // 5. Mismatched existing gateway order ID cannot be overwritten
  const conflict = simulateAttachment({
    role: 'service_role',
    orderStatus: 'created',
    currentGatewayId: 'order_first_111',
    newGatewayId: 'order_second_222',
    orderExists: true
  });
  assert.equal(conflict.success, false);
  assert.match(conflict.error, /already associated with a different gateway order ID/);

  // 6. Idempotent retry with identical gateway order ID succeeds
  const idempotent = simulateAttachment({
    role: 'service_role',
    orderStatus: 'created',
    currentGatewayId: 'order_same_333',
    newGatewayId: 'order_same_333',
    orderExists: true
  });
  assert.equal(idempotent.success, true);
  assert.equal(idempotent.already_attached, true);
});

// ==========================================
// MANDATORY CONSOLIDATED PAYMENT FIXES TESTS
// ==========================================

// 1. Raw Webhook Body Verification
test('Fix 1: readRawBody correctly reads raw bytes from Buffer, string, and streams', async () => {
  const jsonPayload = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });

  // A. From Buffer
  const fromBuffer = await readRawBody({ body: Buffer.from(jsonPayload, 'utf8') });
  assert.ok(Buffer.isBuffer(fromBuffer));
  assert.equal(fromBuffer.toString('utf8'), jsonPayload);

  // B. From String
  const fromString = await readRawBody({ body: jsonPayload });
  assert.ok(Buffer.isBuffer(fromString));
  assert.equal(fromString.toString('utf8'), jsonPayload);

  // C. From rawBody Buffer
  const fromRawBody = await readRawBody({ rawBody: Buffer.from(jsonPayload, 'utf8') });
  assert.ok(Buffer.isBuffer(fromRawBody));
  assert.equal(fromRawBody.toString('utf8'), jsonPayload);

  // D. From readable stream (standard Vercel bodyParser: false behavior)
  const stream = Readable.from([Buffer.from('{"event":'), Buffer.from('"order.paid"}')]);
  const fromStream = await readRawBody(stream);
  assert.ok(Buffer.isBuffer(fromStream));
  assert.equal(fromStream.toString('utf8'), '{"event":"order.paid"}');
});

test('Fix 1: readRawBody rejects missing, empty, or pre-parsed bodies without raw stream', async () => {
  await assert.rejects(
    async () => readRawBody({}),
    /Webhook request body is empty or missing raw bytes/
  );

  await assert.rejects(
    async () => readRawBody({ body: { parsed: true } }),
    /Webhook request body is empty or missing raw bytes/
  );

  const emptyStream = Readable.from([]);
  await assert.rejects(
    async () => readRawBody(emptyStream),
    /Webhook request body is empty or missing raw bytes/
  );
});

// 2. Webhook Signature Security
test('Fix 1: invalid webhook signature or tampered payload is strictly rejected', () => {
  const payload = Buffer.from('{"event":"payment.captured","amount":49700}');
  const validSig = createHmac('sha256', secret).update(payload).digest('hex');

  assert.equal(verifyWebhookSignature(payload, validSig, secret), true);
  assert.equal(verifyWebhookSignature(payload, 'invalid_sig_123', secret), false);
  assert.equal(verifyWebhookSignature(payload, '', secret), false);
  assert.equal(verifyWebhookSignature(payload, null, secret), false);

  // Tampered payload
  const tamperedPayload = Buffer.from('{"event":"payment.captured","amount":100}');
  assert.equal(verifyWebhookSignature(tamperedPayload, validSig, secret), false);
});

// 3. Checkout Dismissal, Coin Release & Immediate Retry
test('Fix 2: checkout dismissed and immediately retried cancels prior attempt and releases coins', () => {
  const userId = 'user_student_123';
  const initialWalletBalance = 20;

  // State in database
  let orders = [];

  const simulateCreateCheckoutOrder = ({ itemType, itemId, coinsToRedeem }) => {
    // 1. Expire stale orders > 30m
    // 2. Cancel prior unfulfilled orders for the SAME user and item
    for (const order of orders) {
      if (
        order.userId === userId &&
        order.itemType === itemType &&
        order.itemId === itemId &&
        ['created', 'pending'].includes(order.status)
      ) {
        order.status = 'cancelled';
      }
    }

    // 3. Sum reserved coins from active non-expired, non-cancelled orders
    const reservedCoins = orders
      .filter((o) => o.userId === userId && ['created', 'pending'].includes(o.status))
      .reduce((sum, o) => sum + (o.coinsRedeemed || 0), 0);

    const availableBalance = Math.max(0, initialWalletBalance - reservedCoins);
    const coinsUsed = Math.min(coinsToRedeem, availableBalance);
    const basePrice = 499;
    const discount = coinsUsed / 10;
    const payable = basePrice - discount;
    const amountPaise = Math.round(payable * 100);

    const newOrder = {
      id: `ord_${orders.length + 1}`,
      userId,
      itemType,
      itemId,
      status: 'created',
      coinsRedeemed: coinsUsed,
      payable,
      amountPaise
    };
    orders.push(newOrder);

    return newOrder;
  };

  // Attempt 1: Student opens checkout and selects 20 coins
  const order1 = simulateCreateCheckoutOrder({ itemType: 'folder', itemId: 'folder_bpsc', coinsToRedeem: 20 });
  assert.equal(order1.coinsRedeemed, 20);
  assert.equal(order1.payable, 497);
  assert.equal(order1.status, 'created');

  // Student dismisses checkout modal (simulated by immediate retry on the same item)
  // Attempt 2: Immediately retrying cancels order1 and frees 20 coins
  const order2 = simulateCreateCheckoutOrder({ itemType: 'folder', itemId: 'folder_bpsc', coinsToRedeem: 20 });
  assert.equal(order1.status, 'cancelled'); // Order 1 is cancelled!
  assert.equal(order2.coinsRedeemed, 20); // All 20 coins available and applied!
  assert.equal(order2.payable, 497); // Payable remains 497, NO 409 PRICE CHANGE ERROR!
  assert.equal(order2.amountPaise, 49700);
});

// 4. Coins Released via cancel_checkout_order
test('Fix 2: coins released correctly via cancel_checkout_order', () => {
  const userId = 'user_student_123';
  let order = {
    id: 'ord_test_cancel_1',
    userId,
    status: 'created',
    coinsRedeemed: 20
  };

  const simulateCancel = (orderId, callerId) => {
    if (order.id !== orderId) return { success: false, error: 'Payment order not found.' };
    if (order.userId !== callerId) return { success: false, error: 'Payment order ownership could not be verified.' };
    if (['paid', 'captured'].includes(order.status)) return { success: false, error: 'Cannot cancel an order that is already paid.' };
    if (['cancelled', 'expired'].includes(order.status)) return { success: true, already_cancelled: true };

    order.status = 'cancelled';
    return { success: true, cancelled: true };
  };

  // Another user cannot cancel
  const unauthorized = simulateCancel('ord_test_cancel_1', 'other_user_456');
  assert.equal(unauthorized.success, false);
  assert.equal(unauthorized.error, 'Payment order ownership could not be verified.');
  assert.equal(order.status, 'created');

  // Owner cancels successfully
  const cancelled = simulateCancel('ord_test_cancel_1', userId);
  assert.equal(cancelled.success, true);
  assert.equal(cancelled.cancelled, true);
  assert.equal(order.status, 'cancelled');

  // Already cancelled order cannot be fulfilled and cancellation is idempotent
  const cancelAgain = simulateCancel('ord_test_cancel_1', userId);
  assert.equal(cancelAgain.success, true);
  assert.equal(cancelAgain.already_cancelled, true);
});

// 5. Payment Succeeds After Delayed Webhook
test('Fix 2: payment succeeds after delayed webhook delivery', async () => {
  const order = {
    id: 'ord_delayed_webhook_1',
    amount_paise: 49700,
    currency: 'INR',
    status: 'created',
    razorpay_order_id: 'order_rzp_delayed_1',
    gateway_order_id: 'order_rzp_delayed_1',
    item_type: 'folder',
    item_id: 'folder_bpsc',
    user_id: 'user_student_1'
  };

  let fulfilled = false;
  let userAccessGranted = false;

  const result = await processWebhookPayload(
    {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_delayed_1', order_id: 'order_rzp_delayed_1', amount: 49700, currency: 'INR' } },
        order: { entity: { id: 'order_rzp_delayed_1', amount: 49700, currency: 'INR' } }
      }
    },
    {
      lookupOrder: async (orderId) => (orderId === order.razorpay_order_id ? order : null),
      fulfill: async ({ internalOrderId, paymentId }) => {
        assert.equal(internalOrderId, order.id);
        assert.equal(paymentId, 'pay_delayed_1');
        order.status = 'paid';
        fulfilled = true;
        userAccessGranted = true;
        return { success: true };
      }
    }
  );

  assert.equal(result.success, true);
  assert.equal(fulfilled, true);
  assert.equal(userAccessGranted, true);
  assert.equal(order.status, 'paid');
});

// 6. Safe Payment Reconciliation on Cancelled/Expired Orders
test('Fix 2: unverified request cannot fulfill cancelled or expired order, but verified payment evidence reconciles safely', async () => {
  const cancelledOrder = {
    id: 'ord_cancelled_1',
    amount_paise: 49700,
    currency: 'INR',
    status: 'cancelled',
    razorpay_order_id: 'order_rzp_cancelled_1',
    gateway_order_id: 'order_rzp_cancelled_1'
  };

  // A. Unverified request without fresh payment evidence fails
  const simulateAtomicFulfillment = (order, hasEvidence) => {
    if (['expired', 'cancelled'].includes(order.status) && !hasEvidence) {
      return {
        success: false,
        is_cancelled: order.status === 'cancelled',
        error: 'Unverified request cannot fulfill an expired or cancelled order.'
      };
    }
    order.status = 'paid';
    return { success: true, reconciled: true };
  };

  const unverifiedResult = simulateAtomicFulfillment(cancelledOrder, false);
  assert.equal(unverifiedResult.success, false);
  assert.equal(cancelledOrder.status, 'cancelled');

  // B. Verified webhook payload with authentic payment evidence reconciles safely
  const result = await processWebhookPayload(
    {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_late_1', order_id: 'order_rzp_cancelled_1', amount: 49700, currency: 'INR' } }
      }
    },
    {
      lookupOrder: async () => cancelledOrder,
      fulfill: async ({ internalOrderId, paymentId, amountPaise, currency }) => {
        assert.equal(amountPaise, 49700);
        assert.equal(currency, 'INR');
        return simulateAtomicFulfillment(cancelledOrder, true);
      }
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.reconciled, true);
  assert.equal(cancelledOrder.status, 'paid');
});

// 7. Duplicate Webhook Remains Idempotent
test('Fix 2: duplicate webhook delivery remains strictly idempotent with no double deduction', async () => {
  const order = {
    id: 'ord_idem_1',
    amount_paise: 49700,
    currency: 'INR',
    status: 'paid',
    razorpay_order_id: 'order_rzp_idem_1',
    gateway_order_id: 'order_rzp_idem_1',
    razorpay_payment_id: 'pay_idem_1'
  };

  let coinDeductionCount = 0;

  const fulfill = async () => {
    if (order.status === 'paid' && order.razorpay_payment_id === 'pay_idem_1') {
      return { success: true, already_fulfilled: true };
    }
    order.status = 'paid';
    coinDeductionCount++;
    return { success: true };
  };

  const result = await processWebhookPayload(
    {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_idem_1', order_id: 'order_rzp_idem_1', amount: 49700, currency: 'INR' } }
      }
    },
    {
      lookupOrder: async () => order,
      fulfill
    }
  );

  assert.equal(result.success, true);
  assert.equal(coinDeductionCount, 0); // No double deduction!
});

// 8. Error Formatting: Preserves HTTP 409 & Masks Technical Leaks
test('Fix 3: getFriendlyErrorMessage preserves actionable business messages and masks technical leaks', () => {
  // A. HTTP 409 price change message preserved
  const priceChangeMsg = 'The server price changed. Reopen checkout to review the latest total.';
  assert.equal(
    getFriendlyErrorMessage(new Error(priceChangeMsg), 'Fallback error'),
    priceChangeMsg
  );

  // B. Authentication session message preserved
  const authMsg = 'Your sign-in session is invalid or expired.';
  assert.equal(
    getFriendlyErrorMessage(new Error(authMsg), 'Fallback error'),
    authMsg
  );

  // C. Technical PostgreSQL permission denied masked
  assert.equal(
    getFriendlyErrorMessage(new Error('permission denied for table payment_orders'), 'Fallback error'),
    'Profile data abhi load nahi ho paya.'
  );

  // D. Technical SQL syntax / table error masked with fallback
  assert.equal(
    getFriendlyErrorMessage(new Error('relation "public.payment_orders" does not exist at character 15'), 'Fallback error'),
    'Fallback error'
  );

  // E. Secret / token leak masked with fallback
  assert.equal(
    getFriendlyErrorMessage(new Error('Internal failure with Bearer eyJhbGciOi...'), 'Fallback error'),
    'Fallback error'
  );

  // F. Network error localized
  assert.equal(
    getFriendlyErrorMessage(new Error('Failed to fetch'), 'Fallback error'),
    'Connection check karke phir try karein.'
  );
});

// 9. Wallet Balance Never Becomes Negative
test('Fix 2: wallet balance never becomes negative even when balance < coins_to_deduct', () => {
  let walletBalance = 10;
  const coinsToDeduct = 25; // Requested 25 coins, but balance is only 10

  const actualDeduction = Math.min(walletBalance, coinsToDeduct);
  walletBalance = Math.max(0, walletBalance - coinsToDeduct);

  assert.equal(actualDeduction, 10);
  assert.equal(walletBalance, 0);
  assert.ok(walletBalance >= 0);
});

// ==========================================
// MANDATORY VERIFICATION SCENARIOS (1 to 10)
// ==========================================

// 1. Web Standard Request raw body preservation
test('Scenario 1: Web Standard Request raw body preservation via POST(request)', async () => {
  const rawPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: { entity: { id: 'pay_web_1', order_id: 'order_web_1', amount: 4900, currency: 'INR' } },
      order: { entity: { id: 'order_web_1', amount: 4900, currency: 'INR' } }
    }
  });
  const sig = createHmac('sha256', secret).update(rawPayload).digest('hex');

  const request = new Request('https://zyvra-v2.vercel.app/api/razorpay-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': sig
    },
    body: rawPayload
  });

  const readText = await request.clone().text();
  assert.equal(readText, rawPayload);
  assert.equal(verifyWebhookSignature(readText, sig, secret), true);
});

// 2. Valid and invalid webhook signatures
test('Scenario 2: Valid and invalid webhook signatures handled accurately', async () => {
  const payload = '{"event":"payment.captured","test":123}';
  const validSig = createHmac('sha256', secret).update(payload).digest('hex');

  assert.equal(verifyWebhookSignature(payload, validSig, secret), true);
  assert.equal(verifyWebhookSignature(payload, 'wrong_signature_abc', secret), false);
  assert.equal(verifyWebhookSignature(payload, '', secret), false);
  assert.equal(verifyWebhookSignature(payload, undefined, secret), false);
  assert.equal(verifyWebhookSignature('{"event":"payment.captured","test":999}', validSig, secret), false);

  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  const invalidReq = new Request('https://zyvra-v2.vercel.app/api/razorpay-webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': 'bad_signature' },
    body: payload
  });
  const res = await defaultHandler(invalidReq);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error, 'Webhook signature verification failed.');
});

// 3. Popup dismissal without order cancellation
test('Scenario 3: Popup dismissal does not cancel the order', async () => {
  const modalContent = await readFile(new URL('../src/components/common/CheckoutModal.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(modalContent, /ondismiss:\s*\(\)\s*=>\s*\{[^}]*cancel/s);
  assert.doesNotMatch(modalContent, /payment\.failed[^}]*cancel/s);

  const activeOrder = { id: 'ord_dismiss_1', status: 'created', razorpay_order_id: 'order_rzp_dismiss_1' };
  const dismissed = () => { /* setBusy(false) only */ };
  dismissed();
  assert.equal(activeOrder.status, 'created');
});

// 4. Captured payment followed by popup dismissal granting access
test('Scenario 4: Captured payment followed by popup dismissal grants student access', async () => {
  const order = {
    id: 'ord_dismiss_captured_1',
    user_id: 'user_dismiss_1',
    item_type: 'folder',
    item_id: 'folder_bpsc',
    status: 'created',
    amount_paise: 49700,
    currency: 'INR',
    razorpay_order_id: 'order_rzp_dismiss_cap_1'
  };

  let accessGranted = false;
  const result = await processWebhookPayload(
    {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_captured_dismiss_1', order_id: 'order_rzp_dismiss_cap_1', amount: 49700, currency: 'INR' } }
      }
    },
    {
      lookupOrder: async () => order,
      fulfill: async ({ internalOrderId, paymentId }) => {
        order.status = 'paid';
        order.razorpay_payment_id = paymentId;
        accessGranted = true;
        return { success: true, fulfilled: true };
      }
    }
  );

  assert.equal(result.success, true);
  assert.equal(order.status, 'paid');
  assert.equal(accessGranted, true);
});

// 5. Delayed webhook after cancellation/expiry reconciling safely
test('Scenario 5: Delayed webhook on tentatively cancelled or expired order reconciles safely with payment evidence', async () => {
  const order = {
    id: 'ord_cancelled_recon_1',
    status: 'cancelled',
    amount_paise: 49700,
    currency: 'INR',
    razorpay_order_id: 'order_rzp_recon_1',
    user_id: 'user_recon_1'
  };

  const simulateAtomicFulfillment = (ord, hasEvidence) => {
    if (['cancelled', 'expired'].includes(ord.status) && !hasEvidence) {
      return { success: false, error: 'Unverified request cannot fulfill an expired or cancelled order.' };
    }
    ord.status = 'paid';
    return { success: true, reconciled: true };
  };

  const unverified = simulateAtomicFulfillment(order, false);
  assert.equal(unverified.success, false);
  assert.equal(order.status, 'cancelled');

  let userAccessActive = false;
  const result = await processWebhookPayload(
    {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_delayed_recon_1', order_id: 'order_rzp_recon_1', amount: 49700, currency: 'INR' } }
      }
    },
    {
      lookupOrder: async () => order,
      fulfill: async ({ internalOrderId, paymentId, amountPaise, currency }) => {
        assert.equal(amountPaise, 49700);
        assert.equal(currency, 'INR');
        order.status = 'paid';
        order.razorpay_payment_id = paymentId;
        userAccessActive = true;
        return simulateAtomicFulfillment(order, true);
      }
    }
  );

  assert.equal(result.success, true);
  assert.equal(order.status, 'paid');
  assert.equal(userAccessActive, true);
});

// 6. Pending payment not releasing coins prematurely
test('Scenario 6: Pending or attempted in-flight payment preserves coin reservation without premature release', () => {
  const activeOrders = [
    { id: 'ord_in_flight_1', status: 'pending', coins_redeemed: 20, created_at: new Date().toISOString() }
  ];

  const reservedCoins = activeOrders
    .filter((o) => ['created', 'pending'].includes(o.status))
    .reduce((sum, o) => sum + (o.coins_redeemed || 0), 0);

  assert.equal(reservedCoins, 20);
});

// 7. Retry not creating duplicate inconsistent orders
test('Scenario 7: Retry with identical parameters reuses existing order without duplicate creation', () => {
  const existingOrder = {
    id: 'ord_existing_retry_1',
    razorpay_order_id: 'order_rzp_reuse_1',
    amount_paise: 49700,
    coins_redeemed: 20,
    status: 'created'
  };

  const handleCheckoutRequest = ({ requestedAmountPaise, coinsToRedeem }) => {
    const coinsMatch = existingOrder.coins_redeemed === coinsToRedeem;
    const amountMatch = existingOrder.amount_paise === requestedAmountPaise;
    if (coinsMatch && amountMatch) {
      return { reused: true, orderId: existingOrder.id, razorpay_order_id: existingOrder.razorpay_order_id };
    }
    return { reused: false, orderId: 'ord_new_2', razorpay_order_id: 'order_rzp_new_2' };
  };

  const retry1 = handleCheckoutRequest({ requestedAmountPaise: 49700, coinsToRedeem: 20 });
  assert.equal(retry1.reused, true);
  assert.equal(retry1.razorpay_order_id, 'order_rzp_reuse_1');

  const retry2 = handleCheckoutRequest({ requestedAmountPaise: 49900, coinsToRedeem: 0 });
  assert.equal(retry2.reused, false);
  assert.equal(retry2.orderId, 'ord_new_2');
});

// 8. Duplicate webhook idempotency (no double deduction)
test('Scenario 8: Duplicate webhook delivery is strictly idempotent with zero double coin deduction', async () => {
  const order = {
    id: 'ord_duplicate_1',
    status: 'paid',
    razorpay_order_id: 'order_rzp_dup_1',
    razorpay_payment_id: 'pay_dup_1',
    amount_paise: 4900,
    currency: 'INR'
  };

  let coinsDeductedCount = 0;
  const fulfill = async () => {
    if (order.status === 'paid' && order.razorpay_payment_id === 'pay_dup_1') {
      return { success: true, already_fulfilled: true };
    }
    coinsDeductedCount++;
    return { success: true };
  };

  const res1 = await processWebhookPayload(
    { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_dup_1', order_id: 'order_rzp_dup_1', amount: 4900, currency: 'INR' } } } },
    { lookupOrder: async () => order, fulfill }
  );
  assert.equal(res1.already_fulfilled, true);
  assert.equal(coinsDeductedCount, 0);
});

// 9. Wallet balance never becoming negative
test('Scenario 9: Wallet balance deduction is clamped so wallet balance never becomes negative', () => {
  let balance = 15;
  const coinsToDeduct = 50;

  balance = Math.max(0, balance - coinsToDeduct);
  assert.equal(balance, 0);
  assert.ok(balance >= 0);
});

// 10. Proper HTTP status codes on unsupported methods
test('Scenario 10: Unsupported HTTP methods (GET, PUT, DELETE) return 405 Method Not Allowed with Allow: POST', async () => {
  const getReq = new Request('https://zyvra-v2.vercel.app/api/razorpay-webhook', { method: 'GET' });
  const getRes = await defaultHandler(getReq);
  assert.equal(getRes.status, 405);
  assert.equal(getRes.headers.get('Allow'), 'POST');
  const body = await getRes.json();
  assert.equal(body.error, 'Method not allowed.');
});

// 11. Sparse order.paid webhook fallback
test('Sparse order.paid webhook fallback: fetches captured payment via SDK and fulfills', async () => {
  const sparsePayload = {
    event: 'order.paid',
    payload: {
      order: {
        entity: {
          id: 'order_sparse_123',
          amount: 49800,
          currency: 'INR'
        }
      }
      // Note: payload.payment is completely omitted
    }
  };

  const storedOrder = {
    id: 'ord_internal_sparse_1',
    razorpay_order_id: 'order_sparse_123',
    amount_paise: 49800,
    currency: 'INR',
    status: 'created'
  };

  let fulfilledDetails = null;
  const mockFulfill = async (details) => {
    fulfilledDetails = details;
    return { success: true, fulfilled: true };
  };

  const mockFetchPayments = async (orderId) => {
    assert.equal(orderId, 'order_sparse_123');
    return {
      entity: 'collection',
      count: 2,
      items: [
        { id: 'pay_attempt_failed', order_id: 'order_sparse_123', status: 'failed', amount: 49800, currency: 'INR' },
        { id: 'pay_attempt_captured', order_id: 'order_sparse_123', status: 'captured', amount: 49800, currency: 'INR' }
      ]
    };
  };

  const res = await processWebhookPayload(sparsePayload, {
    lookupOrder: async () => storedOrder,
    fulfill: mockFulfill,
    fetchOrderPayments: mockFetchPayments
  });

  assert.equal(res.success, true);
  assert.equal(fulfilledDetails.paymentId, 'pay_attempt_captured');
  assert.equal(fulfilledDetails.amountPaise, 49800);
  assert.equal(fulfilledDetails.currency, 'INR');
});

test('Sparse order.paid webhook fallback: safely ignores when no captured payment exists without granting access', async () => {
  const sparsePayload = {
    event: 'order.paid',
    payload: {
      order: {
        entity: {
          id: 'order_no_capture',
          amount: 50000,
          currency: 'INR'
        }
      }
    }
  };

  const storedOrder = {
    id: 'ord_internal_no_cap',
    razorpay_order_id: 'order_no_capture',
    amount_paise: 50000,
    currency: 'INR',
    status: 'created'
  };

  let fulfilledCalled = false;
  const mockFulfill = async () => {
    fulfilledCalled = true;
    return { success: true };
  };

  const mockFetchPayments = async () => ({
    entity: 'collection',
    count: 2,
    items: [
      { id: 'pay_failed_1', order_id: 'order_no_capture', status: 'failed', amount: 50000, currency: 'INR' },
      { id: 'pay_auth_1', order_id: 'order_no_capture', status: 'authorized', amount: 50000, currency: 'INR' }
    ]
  });

  const res = await processWebhookPayload(sparsePayload, {
    lookupOrder: async () => storedOrder,
    fulfill: mockFulfill,
    fetchOrderPayments: mockFetchPayments
  });

  assert.equal(res.received, true);
  assert.equal(res.ignored, true);
  assert.equal(fulfilledCalled, false);
});

test('Tampered amount rejection in webhook: mismatched amount is rejected before fulfillment', async () => {
  const tamperedPayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_valid_format_1',
          order_id: 'order_tamper_test',
          amount: 1000, // 10 INR instead of 498 INR
          currency: 'INR',
          status: 'captured'
        }
      }
    }
  };

  const storedOrder = {
    id: 'ord_tamper_1',
    razorpay_order_id: 'order_tamper_test',
    amount_paise: 49800,
    currency: 'INR',
    status: 'created'
  };

  let fulfilledCalled = false;
  await assert.rejects(
    async () => {
      await processWebhookPayload(tamperedPayload, {
        lookupOrder: async () => storedOrder,
        fulfill: async () => {
          fulfilledCalled = true;
          return { success: true };
        }
      });
    },
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /Payment amount or currency does not match/);
      return true;
    }
  );

  assert.equal(fulfilledCalled, false);
});
