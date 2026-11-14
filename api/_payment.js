import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

const SENSITIVE_TECHNICAL_PATTERN = /secret|bearer|service_role|key_secret|token|password|supabase_url|syntax error|relation .* does not exist|column .* does not exist|violates .* constraint|duplicate key|PL\/pgSQL|node:internal/i;

export function sanitizeErrorMessage(error, fallback = 'Unable to process request.') {
  const msg =
    typeof error?.message === 'string'
      ? error.message.trim()
      : typeof error === 'string'
        ? error.trim()
        : '';
  if (!msg) return fallback;
  if (SENSITIVE_TECHNICAL_PATTERN.test(msg)) {
    return fallback;
  }
  return msg;
}

export function sendJson(res, status, payload) {
  if (!res) return;
  if (typeof res.status === 'function') {
    res.status(status);
  } else {
    res.statusCode = status;
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  if (typeof res.json === 'function') {
    res.json(payload);
  } else if (typeof res.send === 'function') {
    res.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  } else if (typeof res.end === 'function') {
    res.end(JSON.stringify(payload));
  }
}

export async function parseRequestBody(req) {
  // Support for Web Standard Request
  if (req && typeof req.text === 'function') {
    try {
      const text = await req.text();
      if (!text || !text.trim()) return {};
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error('Request body must be a JSON object.');
    } catch (err) {
      const error = new Error('Request body must be valid JSON.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Node (req.body already read or parsed)
  if (typeof req?.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error('Request body must be a JSON object.');
    } catch (err) {
      const error = new Error('Request body must be valid JSON.');
      error.statusCode = 400;
      throw error;
    }
  }

  if (req?.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }

  return {};
}

export function readBody(req) {
  if (typeof req?.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      return {};
    } catch {
      const error = new Error('Request body must be valid JSON.');
      error.statusCode = 400;
      throw error;
    }
  }
  return req?.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
}

export function getPaymentServices(req) {
  const authorization =
    (typeof req?.headers?.get === 'function' ? req.headers.get('authorization') : null) ||
    req?.headers?.authorization ||
    req?.headers?.Authorization ||
    '';
  const accessToken = authorization.trim().match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!accessToken) {
    const error = new Error('Sign in before starting checkout.');
    error.statusCode = 401;
    throw error;
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const keyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!url || !anonKey) {
    const error = new Error('Supabase server configuration is incomplete.');
    error.statusCode = 500;
    throw error;
  }
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay server configuration is incomplete.');
    error.statusCode = 500;
    throw error;
  }

  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
  const supabaseAdmin = serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;
  const razorpay = getRazorpayClient();
  return { accessToken, supabase, supabaseAdmin, hasServiceRole: Boolean(serviceRoleKey), razorpay, keyId, keySecret };
}

export function getRazorpayClient() {
  const keyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || '').trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay server configuration is incomplete.');
    error.statusCode = 500;
    throw error;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function getPaymentAdminClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) {
    const error = new Error('Supabase server configuration is incomplete.');
    error.statusCode = 500;
    throw error;
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function requireUser(supabase, accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    const err = new Error('Your sign-in session is invalid or expired.');
    err.statusCode = 401;
    throw err;
  }
  return data.user;
}
