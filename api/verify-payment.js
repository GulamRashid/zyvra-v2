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

    const { accessToken, supabase, supabaseAdmin, keySecret } = getPaymentServices(req);
    const user = await requireUser(supabase, accessToken);
    const secret = (process.env.RAZORPAY_KEY_SECRET || keySecret || '').trim();
    if (!secret) {
      return sendJson(res, 500, { success: false, error: 'Razorpay secret key is not configured.' });
    }

    const cleanOrderId = String(razorpayOrderId).trim();
    const cleanPaymentId = String(paymentId).trim();
    const cleanSignature = String(signature).trim();
    const cleanInternalId = String(internalOrderId).trim();

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

    let fulfilled = false;

    // 1. Primary fulfillment: RPC call using admin or authenticated Supabase client
    try {
      const clientForRpc = supabaseAdmin || supabase;
      const { data, error } = await clientForRpc.rpc('complete_successful_checkout', {
        p_order_id: cleanInternalId,
        p_payment_id: cleanPaymentId,
        p_payment_signature: cleanSignature
      });

      if (!error) {
        let result = Array.isArray(data) ? data[0] : data;
        if (typeof result === 'string') {
          try { result = JSON.parse(result); } catch (_) {}
        }
        if (
          result === true ||
          result?.success === true ||
          (typeof result === 'string' && ['success', 'paid', 'completed'].includes(result.toLowerCase()))
        ) {
          fulfilled = true;
        }
      } else {
        console.warn('complete_successful_checkout RPC returned error, engaging server fallback:', error.message || error);
      }
    } catch (rpcErr) {
      console.warn('complete_successful_checkout RPC threw error, engaging server fallback:', rpcErr?.message || rpcErr);
    }

    // 2. Secondary fallback: Direct authoritative database fulfillment via supabaseAdmin
    if (!fulfilled && supabaseAdmin) {
      try {
        let order = null;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanInternalId);
        if (isUuid) {
          const { data: o } = await supabaseAdmin
            .from('payment_orders')
            .select('*')
            .eq('id', cleanInternalId)
            .maybeSingle();
          order = o;
        }
        if (!order) {
          const { data: o } = await supabaseAdmin
            .from('payment_orders')
            .select('*')
            .or(`razorpay_order_id.eq.${cleanOrderId},gateway_order_id.eq.${cleanOrderId}`)
            .maybeSingle();
          order = o;
        }

        if (order) {
          const targetUserId = order.user_id || user.id;
          const itemType = order.item_type || order.order_type || 'folder';
          const itemId = String(order.item_id);

          if (order.status === 'paid') {
            // Already paid idempotency check
            fulfilled = true;
          } else {
            // Update order status to paid
            await supabaseAdmin
              .from('payment_orders')
              .update({
                status: 'paid',
                razorpay_payment_id: cleanPaymentId,
                gateway_payment_id: cleanPaymentId,
                razorpay_signature: cleanSignature,
                payment_signature: cleanSignature,
                amount_paid: Number(order.final_amount || order.amount || 0),
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id);

            // Grant active entitlement in user_access
            await supabaseAdmin
              .from('user_access')
              .upsert({
                user_id: targetUserId,
                item_type: itemType,
                item_id: itemId,
                status: 'active',
                is_active: true,
                starts_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, { onConflict: 'user_id,item_type,item_id' });

            // Safely deduct coins from wallet and record transaction
            const coinsRedeemed = Number(order.coins_redeemed || order.coins_used || 0);
            if (coinsRedeemed > 0) {
              const { data: wallet } = await supabaseAdmin
                .from('coin_wallets')
                .select('balance')
                .eq('user_id', targetUserId)
                .maybeSingle();

              const currentBal = Math.max(0, Math.floor(Number(wallet?.balance || 0)));
              const newBal = Math.max(0, currentBal - coinsRedeemed);

              await supabaseAdmin
                .from('coin_wallets')
                .upsert({
                  user_id: targetUserId,
                  balance: newBal,
                  updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

              const desc = `Redeemed ${coinsRedeemed} coins for ${itemType} purchase`;
              try {
                await supabaseAdmin
                  .from('coin_ledger')
                  .insert({
                    user_id: targetUserId,
                    amount: -coinsRedeemed,
                    transaction_type: 'redeem',
                    reason: desc,
                    description: desc,
                    created_at: new Date().toISOString()
                  });
              } catch (_) {}

              try {
                await supabaseAdmin
                  .from('coin_transactions')
                  .insert({
                    user_id: targetUserId,
                    amount: -coinsRedeemed,
                    transaction_type: 'redeem',
                    description: desc,
                    created_at: new Date().toISOString()
                  });
              } catch (_) {}
            }

            fulfilled = true;
          }
        }
      } catch (fallbackErr) {
        console.error('Authoritative verification fallback error:', fallbackErr);
      }
    }

    if (!fulfilled) {
      return sendJson(res, 400, {
        success: false,
        error: 'The payment could not be confirmed in the database. Please contact support with your payment ID.'
      });
    }

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('Unable to verify checkout payment:', error);
    const message = error instanceof Error ? error.message : 'Unable to verify payment.';
    const status = /sign in|session is invalid/i.test(message) ? 401 : 400;
    return sendJson(res, status, { success: false, error: message });
  }
}
