import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPaymentServices, readBody, requireUser, sendJson } from './_payment.js';

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

    const { accessToken, supabase } = getPaymentServices(req);
    await requireUser(supabase, accessToken);
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const expected = createHmac('sha256', secret).update(`${razorpayOrderId}|${paymentId}`).digest();
    let supplied;
    try {
      supplied = Buffer.from(signature, 'hex');
    } catch {
      supplied = Buffer.alloc(0);
    }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return sendJson(res, 400, { success: false, error: 'Payment signature verification failed.' });
    }

    const { data, error } = await supabase.rpc('complete_successful_checkout', {
      p_order_id: internalOrderId,
      p_payment_id: paymentId,
      p_payment_signature: signature
    });
    if (error) throw error;
    let result = Array.isArray(data) ? data[0] : data;
    if (typeof result === 'string') {
      try {
        result = JSON.parse(result);
      } catch {
        // Plain-text success statuses are also supported by the checkout RPC.
      }
    }
    const confirmed = result === true
      || result?.success === true
      || (typeof result === 'string' && ['success', 'paid', 'completed'].includes(result.toLowerCase()));
    if (!confirmed) {
      return sendJson(res, 400, { success: false, error: result?.message || 'The payment service did not confirm this purchase.' });
    }

    try {
      const { supabaseAdmin } = getPaymentServices(req);
      if (supabaseAdmin) {
        await supabaseAdmin
          .from('payment_orders')
          .update({
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            gateway_payment_id: paymentId,
            payment_signature: signature,
            status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', internalOrderId);
      }
    } catch (_) {}

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('Unable to verify checkout payment:', error);
    const message = error instanceof Error ? error.message : 'Unable to verify payment.';
    const status = /sign in|session is invalid/i.test(message) ? 401 : 400;
    return sendJson(res, status, { success: false, error: message });
  }
}
