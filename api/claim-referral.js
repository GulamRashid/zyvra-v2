/* global process, Response, console */
import { createClient } from '@supabase/supabase-js';
import { getPaymentAdminClient, parseRequestBody, sanitizeErrorMessage, sendJson } from './_payment.js';

const REFERRAL_RATE_WINDOW_MS = 15 * 60_000;
const REFERRAL_RATE_MAX = 10;
const referralRateBuckets = new Map();

function isReferralRateLimited(userId) {
  const now = Date.now();
  const entries = (referralRateBuckets.get(userId) || []).filter((ts) => now - ts < REFERRAL_RATE_WINDOW_MS);
  if (entries.length >= REFERRAL_RATE_MAX) {
    referralRateBuckets.set(userId, entries);
    return true;
  }
  entries.push(now);
  referralRateBuckets.set(userId, entries);
  return false;
}

function getBearerToken(req) {
  const authorization =
    (typeof req?.headers?.get === 'function' ? req.headers.get('authorization') : null) ||
    req?.headers?.authorization ||
    req?.headers?.Authorization ||
    '';
  return authorization.trim().match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

export async function handleClaimReferral(req, res) {
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
    return respond(405, { error: 'Method Not Allowed' });
  }

  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return respond(401, { error: 'Authentication required to claim referral.' });
    }

    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!url || !anonKey) {
      return respond(500, { error: 'Supabase configuration is missing.' });
    }

    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });

    const { data: userData, error: userError } = await client.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return respond(401, { error: 'Session is invalid or expired.' });
    }

    const user = userData.user;
    if (isReferralRateLimited(user.id)) {
      return respond(429, { success: false, error: 'Too many referral attempts. Please try again later.' });
    }
    const body = await parseRequestBody(req);
    const cleanCode = String(body.referral_code || '').trim().toUpperCase();

    if (!cleanCode) {
      return respond(400, { error: 'Referral code is required.' });
    }

    const adminClient = getPaymentAdminClient();

    // 1. Try claim_referral_code RPC via authenticated client first
    const rpcRes = await client.rpc('claim_referral_code', { p_ref_code: cleanCode });
    if (!rpcRes.error && rpcRes.data) {
      return respond(rpcRes.data.success ? 200 : 400, rpcRes.data);
    }

    // 2. Server-side atomic fallback using admin client
    // Find referrer
    const { data: referrer } = await adminClient
      .from('profiles')
      .select('id, referral_code')
      .ilike('referral_code', cleanCode)
      .maybeSingle();

    if (!referrer) {
      return respond(404, { success: false, error: 'Referral code not found.' });
    }

    if (referrer.id === user.id) {
      return respond(400, { success: false, error: 'You cannot refer yourself.' });
    }

    // Check if already claimed
    const { data: existingClaim } = await adminClient
      .from('referrals')
      .select('id')
      .eq('referred_id', user.id)
      .maybeSingle();

    if (existingClaim) {
      return respond(400, { success: false, already_referred: true, error: 'Referral already claimed.' });
    }

    let referrerCoins = 50;
    let referredCoins = 20;

    try {
      const { data: settingData } = await adminClient
        .from('platform_settings')
        .select('value, setting_value')
        .or('key.eq.referral_program_config,setting_key.eq.referral_program_config')
        .limit(1)
        .maybeSingle();

      const config = settingData?.setting_value || settingData?.value;
      if (config && typeof config === 'object') {
        if (config.referral_enabled === false) {
          return respond(400, { success: false, error: 'Referral program is currently paused.' });
        }
        if (typeof config.referrer_reward_coins === 'number' && config.referrer_reward_coins > 0) {
          referrerCoins = Number(config.referrer_reward_coins);
        }
        if (typeof config.referred_reward_coins === 'number' && config.referred_reward_coins > 0) {
          referredCoins = Number(config.referred_reward_coins);
        }
      }
    } catch (confErr) {
      console.warn('Could not read referral settings, using defaults (50/20):', confErr);
    }

    // Insert referral record
    const { error: insertErr } = await adminClient
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: user.id,
        referrer_coins_awarded: referrerCoins,
        referred_coins_awarded: referredCoins
      });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return respond(400, { success: false, already_referred: true, error: 'Referral already claimed.' });
      }
      throw insertErr;
    }

    // Credit referrer
    const { data: refWallet } = await adminClient
      .from('coin_wallets')
      .select('balance')
      .eq('user_id', referrer.id)
      .maybeSingle();

    const newRefBal = (Number(refWallet?.balance) || 0) + referrerCoins;
    await adminClient
      .from('coin_wallets')
      .upsert({ user_id: referrer.id, balance: newRefBal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    await adminClient.from('coin_ledger').insert({
      user_id: referrer.id,
      amount: referrerCoins,
      transaction_type: 'credit',
      reason: 'Referral reward: invited a student',
      description: `Referral bonus for inviting a student`
    }).catch(() => {});

    await adminClient.from('coin_transactions').insert({
      user_id: referrer.id,
      amount: referrerCoins,
      transaction_type: 'credit',
      reason: 'Referral reward: invited a student'
    }).catch(() => {});

    // Credit referred student
    const { data: myWallet } = await adminClient
      .from('coin_wallets')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle();

    const newMyBal = (Number(myWallet?.balance) || 0) + referredCoins;
    await adminClient
      .from('coin_wallets')
      .upsert({ user_id: user.id, balance: newMyBal, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    await adminClient.from('coin_ledger').insert({
      user_id: user.id,
      amount: referredCoins,
      transaction_type: 'credit',
      reason: 'Referral bonus: joined with invite code',
      description: `Welcome bonus for using referral code ${cleanCode}`
    }).catch(() => {});

    await adminClient.from('coin_transactions').insert({
      user_id: user.id,
      amount: referredCoins,
      transaction_type: 'credit',
      reason: 'Referral bonus: joined with invite code'
    }).catch(() => {});

    return respond(200, {
      success: true,
      referrer_coins: referrerCoins,
      referred_coins: referredCoins,
      message: 'Referral bonus credited successfully.'
    });
  } catch (error) {
    console.error('Unhandled claim-referral error:', error);
    const sanitized = sanitizeErrorMessage(error, 'An unexpected error occurred while processing referral.');
    return respond(500, { error: sanitized });
  }
}

export default async function handler(req, res) {
  return handleClaimReferral(req, res);
}

export async function POST(req) {
  return handleClaimReferral(req);
}
