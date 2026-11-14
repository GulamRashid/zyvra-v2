import {
  getPaymentAdminClient,
  getPaymentServices,
  parseRequestBody,
  readBody,
  requireUser,
  sanitizeErrorMessage,
  sendJson
} from './_payment.js';

const SUPPORTED_ITEM_TYPES = new Set(['folder', 'chapter', 'exam']);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    } catch (parseErr) {
      body = readBody(req);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return respond(400, { error: 'Request body must be a JSON object.' });
    }

    // 2. Authentication Verification: Validates Bearer token & active user session
    const { accessToken, supabase, razorpay, keyId } = getPaymentServices(req);
    const user = await requireUser(supabase, accessToken);

    // 3. Handle Order Cancellation Action
    if (body.action === 'cancel') {
      const orderIdToCancel = typeof body.orderId === 'string' ? body.orderId.trim() : '';
      if (!orderIdToCancel || !UUID_REGEX.test(orderIdToCancel)) {
        return respond(400, { error: 'A valid order ID is required for cancellation.' });
      }
      const { data: cancelData, error: cancelError } = await supabase.rpc('cancel_checkout_order', {
        p_order_id: orderIdToCancel
      });
      if (cancelError) {
        console.error('cancel_checkout_order failed:', cancelError);
        return respond(400, { error: 'Unable to cancel payment order.' });
      }
      const cancelResult = Array.isArray(cancelData) ? cancelData[0] : cancelData;
      if (!cancelResult?.success) {
        return respond(400, { error: cancelResult?.error || 'Unable to cancel payment order.' });
      }
      return respond(200, { success: true, result: cancelResult });
    }

    // 4. Input Validation for Order Creation
    const requestedAmount = Number(body.amount);
    const itemType = typeof body.itemType === 'string' ? body.itemType.toLowerCase().trim() : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
    const coinsToRedeem = Number(body.coinsToRedeem || 0);

    if (
      !Number.isFinite(requestedAmount) ||
      requestedAmount <= 0 ||
      !Number.isSafeInteger(Math.round(requestedAmount * 100))
    ) {
      return respond(400, { error: 'A valid payment amount is required.' });
    }

    if (
      !SUPPORTED_ITEM_TYPES.has(itemType) ||
      !itemId ||
      itemId.length > 128 ||
      !Number.isSafeInteger(coinsToRedeem) ||
      coinsToRedeem < 0 ||
      coinsToRedeem > 2147483647
    ) {
      return respond(400, { error: 'A valid item and coin redemption amount are required.' });
    }

    const expectedPaise = Math.round(requestedAmount * 100);
    const supabaseAdminClient = getPaymentAdminClient();

    // 5. Existing In-Flight Order Check (Deduplication & Safety)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: existingOrders, error: ordersError } = await supabaseAdminClient
      .from('payment_orders')
      .select('id, user_id, amount_paise, coins_redeemed, coins_used, razorpay_order_id, gateway_order_id, status, created_at')
      .eq('user_id', user.id)
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .in('status', ['created', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (ordersError) {
      console.warn('Existing orders lookup warning:', ordersError.message);
    }

    const activeOrder = existingOrders?.[0];
    const existingGatewayOrderId = activeOrder?.razorpay_order_id || activeOrder?.gateway_order_id;

    if (activeOrder && existingGatewayOrderId) {
      try {
        const rzpOrder = await razorpay.orders.fetch(existingGatewayOrderId);

        // Case 1: Razorpay order is marked paid
        if (rzpOrder?.status === 'paid') {
          let capturedPayment = null;
          try {
            const payments = await razorpay.orders.fetchPayments(existingGatewayOrderId);
            capturedPayment = payments?.items?.find((p) => p.status === 'captured') || null;
          } catch (_) {}

          if (capturedPayment) {
            await supabaseAdminClient.rpc('complete_successful_checkout_webhook', {
              p_internal_order_id: activeOrder.id,
              p_gateway_order_id: existingGatewayOrderId,
              p_payment_id: capturedPayment.id,
              p_amount_paise: Number(capturedPayment.amount),
              p_currency: capturedPayment.currency || 'INR'
            });

            return respond(200, {
              already_paid: true,
              id: activeOrder.id,
              orderId: activeOrder.id,
              razorpay_order_id: existingGatewayOrderId,
              amount: activeOrder.amount_paise,
              amount_paise: activeOrder.amount_paise,
              currency: 'INR',
              keyId,
              message: 'Payment already completed. Access has been unlocked.'
            });
          }
        }

        // Case 2: In-flight payment attempts (e.g. UPI collect or 3DS challenge in progress)
        if (rzpOrder?.status === 'attempted') {
          let capturedPayment = null;
          try {
            const payments = await razorpay.orders.fetchPayments(existingGatewayOrderId);
            capturedPayment = payments?.items?.find((p) => p.status === 'captured') || null;
          } catch (_) {}

          if (capturedPayment) {
            await supabaseAdminClient.rpc('complete_successful_checkout_webhook', {
              p_internal_order_id: activeOrder.id,
              p_gateway_order_id: existingGatewayOrderId,
              p_payment_id: capturedPayment.id,
              p_amount_paise: Number(capturedPayment.amount),
              p_currency: capturedPayment.currency || 'INR'
            });

            return respond(200, {
              already_paid: true,
              id: activeOrder.id,
              orderId: activeOrder.id,
              razorpay_order_id: existingGatewayOrderId,
              amount: activeOrder.amount_paise,
              amount_paise: activeOrder.amount_paise,
              currency: 'INR',
              keyId,
              message: 'Payment completed. Access has been unlocked.'
            });
          }

          // Payment attempt is in progress and not captured yet.
          // Retain coin reservation! Do NOT cancel or supersede without confirmation.
          const coinsMatch = Number(activeOrder.coins_redeemed ?? activeOrder.coins_used ?? 0) === coinsToRedeem;
          const amountMatch = Number(activeOrder.amount_paise) === expectedPaise;
          if (coinsMatch && amountMatch) {
            return respond(200, {
              id: activeOrder.id,
              orderId: activeOrder.id,
              razorpay_order_id: existingGatewayOrderId,
              amount: activeOrder.amount_paise,
              amount_paise: activeOrder.amount_paise,
              currency: 'INR',
              keyId
            });
          }

          // Parameters changed while an attempt is live; do not cancel or release coins
          return respond(409, {
            error: 'A payment attempt is currently processing for this item. Please wait a few moments or complete your open checkout.'
          });
        }

        // Case 3: Order is created (zero payment attempts made).
        const coinsMatch = Number(activeOrder.coins_redeemed ?? activeOrder.coins_used ?? 0) === coinsToRedeem;
        const amountMatch = Number(activeOrder.amount_paise) === expectedPaise;
        const isFresh = activeOrder.created_at >= thirtyMinutesAgo;

        if (coinsMatch && amountMatch && isFresh) {
          return respond(200, {
            id: activeOrder.id,
            orderId: activeOrder.id,
            razorpay_order_id: existingGatewayOrderId,
            amount: activeOrder.amount_paise,
            amount_paise: activeOrder.amount_paise,
            currency: 'INR',
            keyId
          });
        }

        // Case 4: Parameters changed or order is older than 30m, and Razorpay confirms ZERO attempts were made.
        // It is now safe to cancel prior order to release reserved coins for the new order.
        try {
          await supabaseAdminClient.rpc('cancel_checkout_order', { p_order_id: activeOrder.id });
        } catch (_) {}
      } catch (rzpErr) {
        console.warn('Could not inspect existing Razorpay order:', rzpErr?.message);
      }
    } else if (activeOrder && !existingGatewayOrderId) {
      try {
        await supabaseAdminClient.rpc('cancel_checkout_order', { p_order_id: activeOrder.id });
      } catch (_) {}
    }

    let internalOrderId = null;
    let razorpayOrderId = null;
    let amountPaise = null;

    // Authoritative commerce RPC creates the internal order and enforces pricing rules
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
    if (Math.abs(amountPaise - expectedPaise) > 1) {
      return respond(409, { error: 'The server price changed. Reopen checkout to review the latest total.' });
    }

    if (!razorpayOrderId) {
      const receiptCode = String(internalOrderId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
      const razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: `ord_${receiptCode}`
      });
      razorpayOrderId = razorpayOrder.id;

      // Attach the generated gateway order ID via authoritative service-role RPC
      const { data: attachData, error: attachError } = await supabaseAdminClient.rpc('attach_checkout_gateway_order', {
        p_order_id: internalOrderId,
        p_gateway_order_id: razorpayOrderId
      });

      if (attachError) {
        console.error('attach_checkout_gateway_order RPC failed:', {
          code: attachError.code,
          message: attachError.message,
          internalOrderId,
          razorpayOrderId
        });
        try {
          await supabaseAdminClient.rpc('cancel_checkout_order', { p_order_id: internalOrderId });
        } catch (_) {}
        throw new Error('Unable to link the payment order. Please try checking out again.');
      }

      let attachResult = Array.isArray(attachData) ? attachData[0] : attachData;
      if (typeof attachResult === 'string') {
        try { attachResult = JSON.parse(attachResult); } catch (_) {}
      }

      if (!attachResult?.success) {
        console.error('attach_checkout_gateway_order rejected:', attachResult?.error);
        try {
          await supabaseAdminClient.rpc('cancel_checkout_order', { p_order_id: internalOrderId });
        } catch (_) {}
        throw new Error(attachResult?.error || 'Payment gateway order attachment failed.');
      }
    } else {
      const razorpayOrder = await razorpay.orders.fetch(razorpayOrderId);
      if (Number(razorpayOrder.amount) !== amountPaise || razorpayOrder.currency !== 'INR') {
        throw new Error('The payment order does not match the confirmed checkout amount.');
      }
    }

    return respond(200, {
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
    const rawMessage =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      (typeof error === 'string' ? error : 'Unable to create payment order.');
    const sanitizedMessage = sanitizeErrorMessage(rawMessage, 'Unable to create payment order. Please try again.');
    const status = error?.statusCode || (/sign in|session is invalid/i.test(rawMessage) ? 401 : 400);
    return respond(status, { error: sanitizedMessage });
  }
}
