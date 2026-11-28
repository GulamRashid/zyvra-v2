/* global process, Response, fetch, console */
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getPaymentAdminClient, parseRequestBody, sanitizeErrorMessage, sendJson } from './_payment.js';

const PHONE_RATE_WINDOW_MS = 15 * 60_000;
const PHONE_RATE_MAX = 10;
const phoneRateBuckets = new Map();

function isPhoneRateLimited(key) {
  const now = Date.now();
  const entries = (phoneRateBuckets.get(key) || []).filter((ts) => now - ts < PHONE_RATE_WINDOW_MS);
  if (entries.length >= PHONE_RATE_MAX) {
    phoneRateBuckets.set(key, entries);
    return true;
  }
  entries.push(now);
  phoneRateBuckets.set(key, entries);
  return false;
}

export async function handlePhoneLogin(req, res) {
  const isWebStandard = typeof res === 'undefined' || typeof res?.status !== 'function';
  const respond = (status, payload) => {
    if (isWebStandard) {
      return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    sendJson(res, status, payload);
  };

  const method = req?.method || 'POST';
  if (method !== 'POST') {
    if (isWebStandard) {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', Allow: 'POST' }
      });
    }
    if (typeof res?.setHeader === 'function') res.setHeader('Allow', 'POST');
    return respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const body = await parseRequestBody(req);
    const idToken = String(body.idToken || '').trim();
    const providedMobile = String(body.mobile || '').replace(/\D/g, '').slice(-10);
    const clientIp = (
      (typeof req?.headers?.get === 'function' ? req.headers.get('x-forwarded-for') : req?.headers?.['x-forwarded-for']) ||
      'unknown'
    ).split(',')[0].trim();

    if (isPhoneRateLimited(`ip:${clientIp}`) || (providedMobile && isPhoneRateLimited(`mob:${providedMobile}`))) {
      return respond(429, { error: 'Too many login attempts. Please try again in 15 minutes.' });
    }

    if (!idToken) {
      return respond(400, { error: 'Phone verification token is required.' });
    }

    // Authoritative Google token verification
    const apiKey = (process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBJRvoM-gVYz3MTHG48WvENU-iwqMpDrow').trim();
    const googleRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    const googleData = await googleRes.json().catch(() => null);
    const googleUser = googleData?.users?.[0];

    if (!googleRes.ok || !googleUser?.phoneNumber) {
      return respond(401, { error: 'Phone verification failed or expired. Please request a new OTP.' });
    }

    const verifiedPhone = googleUser.phoneNumber; // e.g. "+919876543210"
    const cleanMobile = verifiedPhone.replace(/\D/g, '').slice(-10);

    if (providedMobile && cleanMobile !== providedMobile) {
      return respond(400, { error: 'Phone number mismatch.' });
    }

    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!url || !anonKey || !serviceRoleKey) {
      return respond(500, { error: 'Supabase server configuration is missing.' });
    }

    const supabaseAdmin = getPaymentAdminClient();
    const supabaseAnon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const syntheticEmail = `phone_91${cleanMobile}@phone.zyvra.me`;
    const deterministicPassword = createHmac('sha256', serviceRoleKey)
      .update(`zyvra_phone_${cleanMobile}`)
      .digest('hex');

    // Attempt sign-in first
    let { data: signInData } = await supabaseAnon.auth.signInWithPassword({
      email: syntheticEmail,
      password: deterministicPassword
    });

    let session = signInData?.session || null;
    let isNewUser = false;

    if (!session) {
      // User doesn't exist yet, create with pre-confirmed status
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        password: deterministicPassword,
        email_confirm: true,
        phone: verifiedPhone,
        phone_confirm: true,
        user_metadata: {
          full_name: `Student ${cleanMobile.slice(-4)}`,
          mobile: cleanMobile,
          auth_provider: 'phone_otp'
        }
      });

      if (createError && !createError.message.includes('already registered')) {
        console.error('User creation failed:', createError);
        return respond(500, { error: 'Unable to initialize student account.' });
      }

      isNewUser = true;
      const userId = createData?.user?.id;

      if (userId) {
        // Ensure profile row
        await supabaseAdmin.from('profiles').upsert({
          id: userId,
          email: syntheticEmail,
          mobile: cleanMobile,
          full_name: `Student ${cleanMobile.slice(-4)}`,
          mobile_verified: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        // Ensure wallet (only if not already exists to prevent resetting student balance)
        const { data: existingWallet } = await supabaseAdmin
          .from('coin_wallets')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (!existingWallet) {
          await supabaseAdmin.from('coin_wallets').insert({
            user_id: userId,
            balance: 0,
            updated_at: new Date().toISOString()
          });
        }
      }

      // Sign in now that user is created
      const { data: nextSignIn, error: nextSignInError } = await supabaseAnon.auth.signInWithPassword({
        email: syntheticEmail,
        password: deterministicPassword
      });

      if (nextSignInError || !nextSignIn?.session) {
        console.error('Next sign in error:', nextSignInError);
        return respond(500, { error: 'Account created, but sign in failed. Please try again.' });
      }

      session = nextSignIn.session;
    }

    // Ensure mobile is set on profiles table
    if (session?.user?.id) {
      await supabaseAdmin.from('profiles').update({
        mobile: cleanMobile,
        mobile_verified: true,
        updated_at: new Date().toISOString()
      }).eq('id', session.user.id);
    }

    return respond(200, {
      success: true,
      session,
      isNewUser,
      mobile: cleanMobile
    });
  } catch (error) {
    console.error('Unhandled phone login error:', error);
    const sanitized = sanitizeErrorMessage(error, 'An unexpected error occurred during phone verification.');
    return respond(500, { error: sanitized });
  }
}

export default async function handler(req, res) {
  return handlePhoneLogin(req, res);
}

export async function POST(req) {
  return handlePhoneLogin(req);
}
