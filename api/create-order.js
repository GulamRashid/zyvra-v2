import { getPaymentServices, readBody, requireUser, sendJson } from './_payment.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = readBody(req);
    const requestedAmount = Number(body.amount);
    const itemType = typeof body.itemType === 'string' ? body.itemType : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId : '';
    const coinsToRedeem = Number(body.coinsToRedeem || 0);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isSafeInteger(Math.round(requestedAmount * 100))) {
      return sendJson(res, 400, { error: 'A valid payment amount is required.' });
    }
    if (!itemType || !itemId || !Number.isSafeInteger(coinsToRedeem) || coinsToRedeem < 0) {
      return sendJson(res, 400, { error: 'A valid item and coin redemption amount are required.' });
    }

    const { accessToken, supabase, razorpay } = getPaymentServices(req);
    await requireUser(supabase, accessToken);

    // The authenticated commerce RPC owns authoritative pricing and persists the
    // internal order reference required by the existing entitlement workflow.
    const { data, error } = await supabase.rpc('create_checkout_order', {
      p_item_type: itemType,
      p_item_id: itemId,
      p_coins_to_redeem: coinsToRedeem
    });
    if (error) throw error;
    let responseData = Array.isArray(data) ? data[0] : data;
    if (typeof responseData === 'string') {
      try {
        responseData = JSON.parse(responseData);
      } catch {
        throw new Error('The payment service returned an invalid order response.');
      }
    }
    const order = responseData?.order || responseData;
    const internalOrderId = order?.id || order?.payment_order_id || order?.order_id;
    const razorpayOrderId = order?.razorpay_order_id;
    const amountPaise = Number(order?.amount_paise);
    if (!internalOrderId || !razorpayOrderId || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      throw new Error('The payment service returned an invalid order.');
    }
    if (amountPaise !== Math.round(requestedAmount * 100)) {
      return sendJson(res, 409, { error: 'The server price changed. Reopen checkout to review the latest total.' });
    }

    const razorpayOrder = await razorpay.orders.fetch(razorpayOrderId);
    if (Number(razorpayOrder.amount) !== amountPaise || razorpayOrder.currency !== 'INR') {
      throw new Error('The payment order does not match the confirmed checkout amount.');
    }

    return sendJson(res, 200, {
      id: internalOrderId,
      razorpay_order_id: razorpayOrderId,
      amount: amountPaise,
      amount_paise: amountPaise,
      currency: 'INR'
    });
  } catch (error) {
    console.error('Unable to create checkout order:', error);
    const message = error instanceof Error ? error.message : 'Unable to create payment order.';
    const status = /sign in|session is invalid/i.test(message) ? 401 : 400;
    return sendJson(res, status, { error: message });
  }
}
