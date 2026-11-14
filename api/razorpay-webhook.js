import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPaymentAdminClient, getRazorpayClient, sendJson } from './_payment.js';

export const config = {
  api: { bodyParser: false }
};

const SUPPORTED_EVENTS = new Set(['payment.captured', 'order.paid']);

export function verifyWebhookSignature(rawBody, suppliedSignature, secret) {
  if (typeof suppliedSignature !== 'string' || !suppliedSignature.trim() || !secret) return false;
  const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const expected = createHmac('sha256', secret).update(rawBuffer).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(suppliedSignature.trim(), 'utf8');
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function readRawBody(req) {
  if (Buffer.isBuffer(req?.body)) return req.body;
  if (typeof req?.body === 'string') return Buffer.from(req.body, 'utf8');
  if (Buffer.isBuffer(req?.rawBody)) return req.rawBody;
  if (typeof req?.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');

  // Web Standard Request support
  if (req && typeof req.text === 'function') {
    const text = await req.text();
    if (!text || !text.length) throw new Error('Webhook request body is empty.');
    return Buffer.from(text, 'utf8');
  }

  // Node IncomingMessage stream
  if (req && (typeof req.on === 'function' || req[Symbol.asyncIterator])) {
    const chunks = [];
    if (req[Symbol.asyncIterator]) {
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
      }
    } else {
      await new Promise((resolve, reject) => {
        req.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk));
        req.on('end', resolve);
        req.on('error', reject);
      });
    }
    const raw = Buffer.concat(chunks);
    if (raw.length > 0) return raw;
  }

  throw new Error('Webhook request body is empty or missing raw bytes.');
}

export function extractPayment(payload) {
  const event = payload?.event;
  if (!SUPPORTED_EVENTS.has(event)) return { supported: false };

  const payment = payload?.payload?.payment?.entity;
  const order = payload?.payload?.order?.entity;
  const orderId = payment?.order_id || order?.id;
  const paymentId = payment?.id;
  const amountPaise = Number(payment?.amount ?? order?.amount);
  const currency = payment?.currency || order?.currency;

  if (
    typeof orderId !== 'string' || !orderId.trim() ||
    typeof paymentId !== 'string' || !paymentId.trim() ||
    !Number.isSafeInteger(amountPaise) || amountPaise <= 0 ||
    typeof currency !== 'string' || !currency.trim()
  ) {
    if (event === 'order.paid' && typeof orderId === 'string' && /^order_[A-Za-z0-9_-]+$/.test(orderId.trim())) {
      return {
        supported: true,
        event,
        orderId: orderId.trim(),
        needsPaymentLookup: true,
        amountPaise: Number.isSafeInteger(amountPaise) && amountPaise > 0 ? amountPaise : null,
        currency: typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : null
      };
    }
    throw new Error('Webhook payment details are incomplete.');
  }

  if (!/^order_[A-Za-z0-9_-]+$/.test(orderId.trim()) || !/^pay_[A-Za-z0-9_-]+$/.test(paymentId.trim())) {
    throw new Error('Webhook payment identifiers are invalid.');
  }

  // If event is payment.captured, strictly assert payment.status === 'captured'
  if (event === 'payment.captured' && payment?.status && payment.status !== 'captured') {
    throw new Error(`Webhook payment entity is not captured (status: ${payment.status}).`);
  }

  // If event is order.paid and payment entity status is not captured, fall back to payment lookup
  if (event === 'order.paid' && payment?.status && payment.status !== 'captured') {
    return {
      supported: true,
      event,
      orderId: orderId.trim(),
      needsPaymentLookup: true,
      amountPaise,
      currency: currency.trim().toUpperCase()
    };
  }

  return {
    supported: true,
    event,
    orderId: orderId.trim(),
    paymentId: paymentId.trim(),
    amountPaise,
    currency: currency.trim().toUpperCase()
  };
}

export async function processWebhookPayload(payload, { lookupOrder, fulfill, fetchOrderPayments, razorpayClient }) {
  const payment = extractPayment(payload);
  if (!payment.supported) return { ignored: true };

  const order = await lookupOrder(payment.orderId);
  if (!order) {
    const error = new Error('Payment order not found.');
    error.statusCode = 404;
    throw error;
  }

  const expectedAmount = Number(order.amount_paise);
  const expectedCurrency = String(order.currency || 'INR').toUpperCase();

  // Handle sparse or uncaptured order.paid event by querying authoritative gateway payments
  if (payment.needsPaymentLookup) {
    let rawPayments;
    if (typeof fetchOrderPayments === 'function') {
      rawPayments = await fetchOrderPayments(payment.orderId);
    } else if (razorpayClient?.orders?.fetchPayments) {
      rawPayments = await razorpayClient.orders.fetchPayments(payment.orderId);
    } else {
      const client = getRazorpayClient();
      rawPayments = await client.orders.fetchPayments(payment.orderId);
    }

    const items = Array.isArray(rawPayments)
      ? rawPayments
      : Array.isArray(rawPayments?.items)
        ? rawPayments.items
        : [];

    const capturedPayments = items.filter((p) =>
      p &&
      p.status === 'captured' &&
      p.order_id === payment.orderId &&
      typeof p.id === 'string' &&
      /^pay_[A-Za-z0-9_-]+$/.test(p.id.trim())
    );

    if (capturedPayments.length === 0) {
      // Safely acknowledge without granting access
      return {
        received: true,
        ignored: true,
        reason: 'No captured payment found for order.'
      };
    }

    const matchedPayment = capturedPayments.find((p) =>
      Number(p.amount) === expectedAmount &&
      String(p.currency || 'INR').toUpperCase() === expectedCurrency
    );

    if (!matchedPayment) {
      const error = new Error('Payment amount or currency does not match the payment order.');
      error.statusCode = 409;
      throw error;
    }

    payment.paymentId = matchedPayment.id.trim();
    payment.amountPaise = Number(matchedPayment.amount);
    payment.currency = String(matchedPayment.currency || 'INR').trim().toUpperCase();
  }

  if (!Number.isSafeInteger(expectedAmount) || expectedAmount !== payment.amountPaise || expectedCurrency !== payment.currency) {
    const error = new Error('Payment amount or currency does not match the payment order.');
    error.statusCode = 409;
    throw error;
  }
  if (order.razorpay_order_id !== payment.orderId && order.gateway_order_id !== payment.orderId) {
    const error = new Error('Payment order association could not be verified.');
    error.statusCode = 409;
    throw error;
  }
  if (
    order.status === 'paid' &&
    (order.razorpay_payment_id || order.gateway_payment_id) &&
    order.razorpay_payment_id !== payment.paymentId &&
    order.gateway_payment_id !== payment.paymentId
  ) {
    const error = new Error('A different payment is already recorded for this order.');
    error.statusCode = 409;
    throw error;
  }

  const result = await fulfill({
    internalOrderId: order.id,
    razorpayOrderId: payment.orderId,
    paymentId: payment.paymentId,
    amountPaise: payment.amountPaise,
    currency: payment.currency
  });
  if (result?.success === false) {
    const error = new Error(result.needs_reconciliation
      ? 'This paid order requires trusted payment reconciliation.'
      : 'Payment fulfillment was rejected.');
    error.statusCode = 409;
    throw error;
  }
  return result;
}

export async function processWebhookEvent({ rawBody, signature, secret, supabaseAdmin, fetchOrderPayments, razorpayClient }) {
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    const error = new Error('Webhook signature verification failed.');
    error.statusCode = 401;
    throw error;
  }

  let payload;
  try {
    const rawString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    payload = JSON.parse(rawString);
  } catch (parseErr) {
    const error = new Error('Invalid webhook JSON.');
    error.statusCode = 400;
    throw error;
  }

  return processWebhookPayload(payload, {
    fetchOrderPayments,
    razorpayClient,
    lookupOrder: async (orderId) => {
      const { data: razorpayOrder, error: razorpayError } = await supabaseAdmin
        .from('payment_orders')
        .select('id, amount_paise, currency, status, razorpay_order_id, gateway_order_id, razorpay_payment_id, gateway_payment_id')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();
      if (razorpayError) throw razorpayError;
      if (razorpayOrder) return razorpayOrder;

      const { data: gatewayOrder, error: gatewayError } = await supabaseAdmin
        .from('payment_orders')
        .select('id, amount_paise, currency, status, razorpay_order_id, gateway_order_id, razorpay_payment_id, gateway_payment_id')
        .eq('gateway_order_id', orderId)
        .maybeSingle();
      if (gatewayError) throw gatewayError;
      return gatewayOrder;
    },
    fulfill: async ({ internalOrderId, razorpayOrderId, paymentId, amountPaise, currency }) => {
      const { data, error } = await supabaseAdmin.rpc('complete_successful_checkout_webhook', {
        p_internal_order_id: internalOrderId,
        p_gateway_order_id: razorpayOrderId,
        p_payment_id: paymentId,
        p_amount_paise: amountPaise,
        p_currency: currency
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.success) {
        const err = new Error(result?.error || 'Payment fulfillment was rejected.');
        err.statusCode = 409;
        throw err;
      }
      return {
        success: true,
        alreadyFulfilled: Boolean(result.already_fulfilled),
        reconciled: Boolean(result.reconciled),
        coinsDeducted: result.coins_deducted,
        coinsShortfall: result.coins_shortfall
      };
    }
  });
}

export default async function handler(req, res) {
  // Web Standard Request support
  if (req && typeof req.text === 'function' && !res) {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
      });
    }

    let rawBody;
    try {
      rawBody = await readRawBody(req);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid webhook request body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const signature = req.headers?.get ? req.headers.get('x-razorpay-signature') : req.headers?.['x-razorpay-signature'];
    const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      return new Response(JSON.stringify({ error: 'Webhook signature verification failed.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const supabaseAdmin = getPaymentAdminClient();
      let razorpayClient = null;
      try {
        razorpayClient = getRazorpayClient();
      } catch (_) {}
      const result = await processWebhookEvent({ rawBody, signature, secret, supabaseAdmin, razorpayClient });
      return new Response(JSON.stringify({ received: true, ...(result.ignored ? { ignored: true } : {}) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      return new Response(JSON.stringify({
        error: error?.statusCode ? error.message : 'Webhook processing failed.'
      }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Node (req, res) standard serverless handler
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    console.error('Unable to read Razorpay webhook body:', error);
    return sendJson(res, 400, { error: 'Invalid webhook request body.' });
  }

  const signature = req.headers?.['x-razorpay-signature'] || (req.headers?.get ? req.headers.get('x-razorpay-signature') : null);
  const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return sendJson(res, 401, { error: 'Webhook signature verification failed.' });
  }

  try {
    const supabaseAdmin = getPaymentAdminClient();
    let razorpayClient = null;
    try {
      razorpayClient = getRazorpayClient();
    } catch (_) {}
    const result = await processWebhookEvent({ rawBody, signature, secret, supabaseAdmin, razorpayClient });
    return sendJson(res, 200, { received: true, ...(result.ignored ? { ignored: true } : {}) });
  } catch (error) {
    console.error('Razorpay webhook processing failed:', error);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    return sendJson(res, statusCode, {
      error: error?.statusCode ? error.message : 'Webhook processing failed.'
    });
  }
}
