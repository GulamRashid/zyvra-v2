import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ye sabse zaroori hai: Vercel ka default JSON parser band karta hai
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const buf = await buffer(req);
    const rawBody = buf.toString('utf8');
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload.payment.entity;
      const razorpay_order_id = paymentEntity.order_id;
      const razorpay_payment_id = paymentEntity.id;

      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('razorpay_order_id', razorpay_order_id)
        .single();

      if (order && order.status !== 'paid') {
        await supabaseAdmin
          .from('orders')
          .update({ 
            status: 'paid', 
            razorpay_payment_id: razorpay_payment_id,
            updated_at: new Date().toISOString()
          })
          .eq('razorpay_order_id', razorpay_order_id);

        await supabaseAdmin.rpc('fulfill_order_access', {
          p_user_id: order.user_id,
          p_order_id: order.id,
          p_item_id: order.item_id
        }).catch(() => {});
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[WEBHOOK_ERROR]', err);
    return res.status(500).json({ error: err.message });
  }
}