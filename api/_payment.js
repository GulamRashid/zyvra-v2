import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

export function sendJson(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(payload));
}

export function readBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new Error('Request body must be valid JSON.');
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

export function getPaymentServices(req) {
  const authorization = req.headers.authorization || '';
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) throw new Error('Sign in before starting checkout.');

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!url || !anonKey) throw new Error('Supabase server configuration is incomplete.');
  if (!keyId || !keySecret) throw new Error('Razorpay server configuration is incomplete.');

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return { accessToken, supabase, razorpay };
}

export async function requireUser(supabase, accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) throw new Error('Your sign-in session is invalid or expired.');
  return data.user;
}
