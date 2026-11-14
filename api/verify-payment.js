import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPaymentAdminClient, getPaymentServices, readBody, requireUser, sendJson } from './_payment.js';

export async function verifyPaymentOrder({
  orderId,
  razorpayOrderId,
  userId,
  client
}) {
  const { data: order, error: orderError } = await client
    .from('payment_orders')
    .select('id, user_id, razorpay_order_id, gateway_order_id')
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = readBody(req);
    const { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature, order_id: internalOrderId } = body;
    if (![razorpayOrderId, paymentId, signature, internalOrderId].every((value) => typeof value === 'string' && value.trim())) {
      return sendJson(res, 400, { error: 'Payment verification details are incomplete.' });
    }

    const { accessToken, supabase, keySecret } = getPaymentServices(req);
    const user = await requireUser(supabase, accessToken);
    const adminClient = getPaymentAdminClient();
    const secret = (process.env.RAZORPAY_KEY_SECRET || keySecret || '').trim();
    if (!secret) {
      return sendJson(res, 500, { success: false, error: 'Razorpay secret key is not configured.' });
    }

    const cleanOrderId = String(razorpayOrderId).trim();
    const cleanPaymentId = String(paymentId).trim();
    const cleanSignature = String(signature).trim();
    const cleanInternalId = String(internalOrderId).trim();

    // 1. Fetch order & verify ownership and association server-side before signature verification or fulfillment
    await verifyPaymentOrder({
      orderId: cleanInternalId,
      razorpayOrderId: cleanOrderId,
      userId: user.id,
      client: adminClient
    });

    // 2. Only after these checks may the payment signature verification and fulfillment flow continue
    const expectedSignature = createHmac('sha256', secret)
      .update(`${cleanOrderId}|${cleanPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const suppliedBuffer = Buffer.from(cleanSignature, 'utf8');

    if (
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      return sendJson(res, 400, { success: false, error: 'Payment signature verification failed.' });
    }

    const { data, error } = await adminClient.rpc('complete_successful_checkout', {
      p_order_id: cleanInternalId,
      p_payment_id: cleanPaymentId,
      p_payment_signature: cleanSignature
    });
    if (error) {
      console.error('Checkout fulfillment RPC failed:', error);
      return sendJson(res, 400, {
        success: false,
        error: 'The payment could not be confirmed in the database. Please contact support with your payment ID.'
      });
    }

    let result = Array.isArray(data) ? data[0] : data;
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch (_) {}
    }
    if (!result?.success) {
      return sendJson(res, 400, {
        success: false,
        error: 'The payment could not be confirmed in the database. Please contact support with your payment ID.'
      });
    }

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('Unable to verify checkout payment:', error);
    const message = error instanceof Error ? error.message : 'Unable to verify payment.';
    const status = error?.statusCode
      ? error.statusCode
      : (/sign in|session is invalid/i.test(message) ? 401 : 400);
    return sendJson(res, status, { success: false, error: message });
  }
}
