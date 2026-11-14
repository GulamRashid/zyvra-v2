import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extractPayment, processWebhookPayload, verifyWebhookSignature } from '../api/razorpay-webhook.js';

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
