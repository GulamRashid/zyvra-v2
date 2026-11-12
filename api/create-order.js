import { getPaymentServices, readBody, requireUser, sendJson } from './_payment.js';

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
    if (!itemType || !itemId || !Number.isSafeInteger(coinsToRedeem) || coinsToRedeem < 0) {
      return sendJson(res, 400, { error: 'A valid item and coin redemption amount are required.' });
    }

    const { accessToken, supabase, supabaseAdmin, razorpay, keyId } = getPaymentServices(req);
    const user = await requireUser(supabase, accessToken);

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
      console.warn('create_checkout_order RPC failed or unavailable, engaging server-side fallback:', rpcError?.message || rpcError);

      // Server-side fallback using supabaseAdmin
      let basePrice = 0;
      let itemTitle = '';
      if (itemType === 'folder') {
        const { data: folder, error: fErr } = await supabaseAdmin
          .from('folders')
          .select('id, price, title')
          .eq('id', itemId)
          .maybeSingle();
        if (fErr || !folder) throw new Error(fErr?.message || `Folder not found: ${itemId}`);
        basePrice = Number(folder.price || 0);
        itemTitle = folder.title || '';
      } else if (itemType === 'chapter') {
        const { data: chapter, error: cErr } = await supabaseAdmin
          .from('chapters')
          .select('id, price, title')
          .eq('id', itemId)
          .maybeSingle();
        if (cErr || !chapter) throw new Error(cErr?.message || `Chapter not found: ${itemId}`);
        basePrice = Number(chapter.price || 0);
        itemTitle = chapter.title || '';
      } else if (itemType === 'exam') {
        const { data: exam, error: eErr } = await supabaseAdmin
          .from('exams')
          .select('id, price, title')
          .eq('id', itemId)
          .maybeSingle();
        if (eErr || !exam) throw new Error(eErr?.message || `Exam not found: ${itemId}`);
        basePrice = Number(exam.price || 0);
        itemTitle = exam.title || '';
      } else {
        basePrice = 49.00;
      }

      if (basePrice <= 0) {
        throw new Error('This item has no price or is free.');
      }

      let coinsPerRupee = 10;
      let maxDiscountPct = 20;
      try {
        const { data: confRow } = await supabaseAdmin
          .from('platform_settings')
          .select('*')
          .or('setting_key.eq.coin_redemption_config,key.eq.coin_redemption_config')
          .maybeSingle();
        const confVal = confRow?.setting_value || confRow?.value;
        if (confVal) {
          coinsPerRupee = Number(confVal.coins_per_rupee || 10);
          maxDiscountPct = Number(confVal.max_discount_percent || 20);
        }
      } catch (_) {}

      let walletBalance = 0;
      try {
        const { data: wallet } = await supabaseAdmin
          .from('coin_wallets')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle();
        walletBalance = Math.max(0, Math.floor(Number(wallet?.balance || 0)));
      } catch (_) {}

      const maxCoins = Math.min(walletBalance, Math.floor(basePrice * (maxDiscountPct / 100) * coinsPerRupee));
      const coinsUsed = coinsToRedeem > 0 && maxCoins > 0 ? Math.min(coinsToRedeem, maxCoins) : 0;
      const discount = coinsUsed > 0 ? Math.min(basePrice, Math.round((coinsUsed / coinsPerRupee) * 100) / 100) : 0;
      const payable = Math.max(0, basePrice - discount);
      amountPaise = Math.round(payable * 100);

      const { data: insertedOrder, error: insErr } = await supabaseAdmin
        .from('payment_orders')
        .insert({
          user_id: user.id,
          item_type: itemType,
          item_id: String(itemId),
          item_title: itemTitle || null,
          base_price: basePrice,
          coins_used: coinsUsed,
          discount_amount: discount,
          final_amount: payable,
          amount: payable,
          amount_paise: amountPaise,
          coins_redeemed: coinsUsed,
          status: 'created',
          currency: 'INR'
        })
        .select('id')
        .single();

      if (insErr || !insertedOrder) {
        throw insErr || new Error('Failed to create payment order record in database.');
      }
      internalOrderId = insertedOrder.id;
    }

    if (!internalOrderId || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      throw new Error('The payment service returned an invalid order.');
    }
    if (amountPaise !== Math.round(requestedAmount * 100)) {
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
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
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
