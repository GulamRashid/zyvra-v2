import { getPaymentAdminClient, getPaymentServices, readBody, requireUser, sendJson } from './_payment.js';

const SUPPORTED_ITEM_TYPES = new Set(['folder', 'chapter', 'exam']);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = readBody(req);
    const requestedAmount = Number(body.amount);
    const itemType = typeof body.itemType === 'string' ? body.itemType.toLowerCase().trim() : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
    const coinsToRedeem = Number(body.coinsToRedeem || 0);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isSafeInteger(Math.round(requestedAmount * 100))) {
      return sendJson(res, 400, { error: 'A valid payment amount is required.' });
    }
    if (
      !SUPPORTED_ITEM_TYPES.has(itemType) ||
      !itemId ||
      !Number.isSafeInteger(coinsToRedeem) ||
      coinsToRedeem < 0 ||
      coinsToRedeem > 2147483647
    ) {
      return sendJson(res, 400, { error: 'A valid item and coin redemption amount are required.' });
    }

    const { accessToken, supabase, razorpay, keyId } = getPaymentServices(req);
    await requireUser(supabase, accessToken);

    const supabaseAdminClient = getPaymentAdminClient();

    let internalOrderId = null;
    let razorpayOrderId = null;
    let amountPaise = null;

    // The authenticated commerce RPC owns authoritative pricing and persists the
    // internal order reference required by the existing entitlement workflow.
    try {
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
      internalOrderId = order?.id || order?.payment_order_id || order?.order_id;
      razorpayOrderId = order?.razorpay_order_id;
      amountPaise = Number(order?.amount_paise || Math.round(Number(order?.amount) * 100));
    } catch (rpcError) {
      console.error('create_checkout_order RPC failed:', rpcError);
      throw new Error('The payment order service is unavailable. Please try again.');
    }

    if (!internalOrderId || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      throw new Error('The payment service returned an invalid order.');
    }
    if (Math.abs(amountPaise - Math.round(requestedAmount * 100)) > 1) {
      return sendJson(res, 409, { error: 'The server price changed. Reopen checkout to review the latest total.' });
    }

    if (!razorpayOrderId) {
      const receiptCode = String(internalOrderId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
      const razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `ord_${receiptCode}`
      });
      razorpayOrderId = razorpayOrder.id;
      const { data: updatedOrder, error: updateError } = await supabaseAdminClient
        .from('payment_orders')
        .update({
          razorpay_order_id: razorpayOrderId,
          gateway_order_id: razorpayOrderId
        })
        .eq('id', internalOrderId)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updatedOrder) throw new Error('The Razorpay order could not be saved to the payment record.');
    } else {
      const razorpayOrder = await razorpay.orders.fetch(razorpayOrderId);
      if (Number(razorpayOrder.amount) !== amountPaise || razorpayOrder.currency !== 'INR') {
        throw new Error('The payment order does not match the confirmed checkout amount.');
      }
    }

    return sendJson(res, 200, {
      id: internalOrderId,
      orderId: internalOrderId,
      razorpay_order_id: razorpayOrderId,
      amount: amountPaise,
      amount_paise: amountPaise,
      currency: 'INR',
      keyId
    });
  } catch (error) {
    console.error('Unable to create checkout order:', error);
    const message =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      (typeof error === 'string' ? error : 'Unable to create payment order.');
    const status = /sign in|session is invalid/i.test(message) ? 401 : 400;
    return sendJson(res, status, { error: message });
  }
}
