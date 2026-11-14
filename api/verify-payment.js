import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  getPaymentAdminClient,
  getPaymentServices,
  parseRequestBody,
  readBody,
  requireUser,
  sanitizeErrorMessage,
  sendJson
} from './_payment.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RZP_ORDER_REGEX = /^order_[A-Za-z0-9_-]+$/;
const RZP_PAYMENT_REGEX = /^pay_[A-Za-z0-9_-]+$/;
const HEX_64_REGEX = /^[0-9a-fA-F]{64}$/;

function methodNotAllowedResponse() {
  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
  });
}

export async function POST(request) {
  return handler(request);
}

export async function GET() {
  return methodNotAllowedResponse();
}

export async function PUT() {
  return methodNotAllowedResponse();
}

export async function DELETE() {
  return methodNotAllowedResponse();
}

export async function verifyPaymentOrder({
  orderId,
  razorpayOrderId,
  userId,
  client
}) {
  const { data: order, error: orderError } = await client
    .from('payment_orders')
    .select('id, user_id, razorpay_order_id, gateway_order_id, amount_paise, final_amount, amount, currency, status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) {
    const error = new Error('Payment order not found.');
    error.statusCode = 404;
    throw error;
  }
  if (order.user_id !== userId) {
    const error = new Error('Payment order ownership could not be verified.');
    error.statusCode = 403;
    throw error;
  }
  if (order.razorpay_order_id !== razorpayOrderId && order.gateway_order_id !== razorpayOrderId) {
    const error = new Error('Payment order association could not be verified.');
    error.statusCode = 400;
    throw error;
  }
  return order;
}

export default async function handler(req, res) {
  const isWebStandard = req && typeof req.text === 'function' && !res;

  // 1. HTTP Method Check: Only POST is allowed
  if (req.method !== 'POST') {
    if (isWebStandard) {
      return methodNotAllowedResponse();
    }
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  // Response helper supporting both Web Standard and Node.js runtimes
  const respond = (status, payload) => {
    if (isWebStandard) {
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return sendJson(res, status, payload);
  };

  try {
    let body;
    try {
      body = await parseRequestBody(req);
    } catch {
      body = readBody(req);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return respond(400, { success: false, error: 'Request body must be a JSON object.' });
    }

    const {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      order_id: internalOrderId
    } = body;

    // 2. Strict Input Validation & Format Checks
    if (
      typeof razorpayOrderId !== 'string' || !razorpayOrderId.trim() ||
      typeof paymentId !== 'string' || !paymentId.trim() ||
      typeof signature !== 'string' || !signature.trim() ||
      typeof internalOrderId !== 'string' || !internalOrderId.trim()
    ) {
      return respond(400, { success: false, error: 'Payment verification details are incomplete.' });
    }

    const cleanOrderId = razorpayOrderId.trim();
    const cleanPaymentId = paymentId.trim();
    const cleanSignature = signature.trim();
    const cleanInternalId = internalOrderId.trim();

    if (
      !RZP_ORDER_REGEX.test(cleanOrderId) ||
      !RZP_PAYMENT_REGEX.test(cleanPaymentId) ||
      !HEX_64_REGEX.test(cleanSignature) ||
      !UUID_REGEX.test(cleanInternalId)
    ) {
      return respond(400, { success: false, error: 'Payment verification parameters are invalid.' });
    }

    // 3. User Authentication & Authorization Check
    const { accessToken, supabase, razorpay, keySecret } = getPaymentServices(req);
    const user = await requireUser(supabase, accessToken);
    const adminClient = getPaymentAdminClient();
    const secret = (process.env.RAZORPAY_KEY_SECRET || keySecret || '').trim();

    if (!secret) {
      return respond(500, { success: false, error: 'Razorpay server configuration is incomplete.' });
    }

    // 4. Verify order existence and ownership before signature verification or fulfillment
    const verifiedOrder = await verifyPaymentOrder({
      orderId: cleanInternalId,
      razorpayOrderId: cleanOrderId,
      userId: user.id,
      client: adminClient
    });

    // 5. Cryptographic signature verification of checkout modal parameters
    const expectedSignature = createHmac('sha256', secret)
      .update(`${cleanOrderId}|${cleanPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const suppliedBuffer = Buffer.from(cleanSignature, 'utf8');

    if (
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      return respond(400, { success: false, error: 'Payment signature verification failed.' });
    }

    // 6. Authoritative Gateway Payment Fetch & Status Verification
    let gatewayPayment;
    try {
      gatewayPayment = await razorpay.payments.fetch(cleanPaymentId);
    } catch (fetchErr) {
      console.error('Failed to fetch payment entity from Razorpay:', fetchErr);
      return respond(400, {
        success: false,
        error: 'Unable to verify payment status with payment gateway.'
      });
    }

    if (!gatewayPayment || typeof gatewayPayment !== 'object') {
      return respond(400, { success: false, error: 'Payment record not found on gateway.' });
    }

    // Require payment.status === 'captured'
    if (gatewayPayment.status !== 'captured') {
      console.error('Payment not captured on gateway:', { paymentId: cleanPaymentId, status: gatewayPayment.status });
      return respond(400, {
        success: false,
        error: `Payment is not confirmed as captured (status: ${gatewayPayment.status}). Please try again or contact support.`
      });
    }

    // Verify payment.order_id against the stored Razorpay order ID
    if (gatewayPayment.order_id !== cleanOrderId) {
      return respond(400, {
        success: false,
        error: 'Payment gateway order ID mismatch.'
      });
    }

    // Verify actual captured amount and currency against expected values
    const expectedPaise = Number(
      verifiedOrder.amount_paise ?? Math.round(Number(verifiedOrder.final_amount ?? verifiedOrder.amount) * 100)
    );
    const capturedPaise = Number(gatewayPayment.amount);
    const expectedCurrency = String(verifiedOrder.currency || 'INR').toUpperCase();
    const capturedCurrency = String(gatewayPayment.currency || '').toUpperCase();

    if (!Number.isSafeInteger(capturedPaise) || capturedPaise !== expectedPaise) {
      console.error('Payment amount mismatch:', { expectedPaise, capturedPaise });
      return respond(400, {
        success: false,
        error: 'Captured payment amount does not match order amount.'
      });
    }

    if (capturedCurrency !== expectedCurrency) {
      return respond(400, {
        success: false,
        error: 'Captured payment currency does not match order currency.'
      });
    }

    // 7. Authoritative fulfillment via service-role RPC with genuine gateway captured evidence
    const { data, error } = await adminClient.rpc('complete_successful_checkout_webhook', {
      p_internal_order_id: cleanInternalId,
      p_gateway_order_id: cleanOrderId,
      p_payment_id: cleanPaymentId,
      p_amount_paise: capturedPaise,
      p_currency: capturedCurrency
    });

    if (error) {
      console.error('Checkout fulfillment RPC failed:', error);
      return respond(400, {
        success: false,
        error: 'The payment could not be confirmed in the database. Please contact support with your payment ID.'
      });
    }

    let result = Array.isArray(data) ? data[0] : data;
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch (_) {}
    }

    if (!result?.success) {
      return respond(400, {
        success: false,
        error: result?.error || 'The payment could not be confirmed in the database. Please contact support with your payment ID.'
      });
    }

    return respond(200, {
      success: true,
      alreadyFulfilled: Boolean(result.already_fulfilled),
      reconciled: Boolean(result.reconciled)
    });
  } catch (error) {
    console.error('Unable to verify checkout payment:', error);
    const rawMessage = error instanceof Error ? error.message : 'Unable to verify payment.';
    const sanitizedMessage = sanitizeErrorMessage(rawMessage, 'Unable to verify payment. Please try again.');
    const status = error?.statusCode
      ? error.statusCode
      : (/sign in|session is invalid/i.test(rawMessage) ? 401 : 400);
    return respond(status, { success: false, error: sanitizedMessage });
  }
}
