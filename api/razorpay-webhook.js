import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPaymentAdminClient, sendJson } from './_payment.js';

export const config = {
  api: { bodyParser: false }
};

const SUPPORTED_EVENTS = new Set(['payment.captured', 'order.paid']);

export function verifyWebhookSignature(rawBody, suppliedSignature, secret) {
  if (typeof suppliedSignature !== 'string' || !suppliedSignature.trim() || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const suppliedBuffer = Buffer.from(suppliedSignature.trim(), 'utf8');
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body, 'utf8'));
  if (req.body !== undefined) return Promise.reject(new Error('Webhook body must be read as raw bytes.'));

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function extractPayment(payload) {
  const event = payload?.event;
  if (!SUPPORTED_EVENTS.has(event)) return { supported: false };

  const payment = event === 'payment.captured'
    ? payload?.payload?.payment?.entity
    : payload?.payload?.payment?.entity;
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
    throw new Error('Webhook payment details are incomplete.');
  }
  if (!/^order_[A-Za-z0-9_-]+$/.test(orderId.trim()) || !/^pay_[A-Za-z0-9_-]+$/.test(paymentId.trim())) {
    throw new Error('Webhook payment identifiers are invalid.');
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

export async function processWebhookPayload(payload, { lookupOrder, fulfill }) {
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

export default async function handler(req, res) {
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

  const signature = req.headers['x-razorpay-signature'];
  const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return sendJson(res, 401, { error: 'Webhook signature verification failed.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('Malformed Razorpay webhook JSON:', error);
    return sendJson(res, 400, { error: 'Invalid webhook JSON.' });
  }

  try {
    const supabaseAdmin = getPaymentAdminClient();
    const result = await processWebhookPayload(payload, {
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
          const error = new Error('Payment fulfillment was rejected.');
          error.statusCode = 409;
          throw error;
        }
        return { success: true, alreadyFulfilled: Boolean(result.already_fulfilled) };
      }
    });

    return sendJson(res, 200, { received: true, ...(result.ignored ? { ignored: true } : {}) });
  } catch (error) {
    console.error('Razorpay webhook processing failed:', error);
    return sendJson(res, Number.isInteger(error?.statusCode) ? error.statusCode : 500, {
      error: error?.statusCode ? error.message : 'Webhook processing failed.'
    });
  }
}
