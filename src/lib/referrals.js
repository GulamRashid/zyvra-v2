/**
 * Zyvra "Share & Earn" Referral System
 * Handles unique referral codes, tracking, and coin incentives
 */

export function generateReferralCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let random = '';
  for (let i = 0; i < 3; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ZYV${random}`;
}

export async function getReferralSettings(supabase) {
  if (!supabase) return { enabled: true, referrerCoins: 50, referredCoins: 20 };

  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*');

    if (error && error.code !== 'PGRST116') {
      console.warn('Error loading referral settings:', error.message);
    }

    const settingsMap = {};
    (data || []).forEach((row) => {
      const identifier = row.key || row.setting_key;
      if (identifier) {
        settingsMap[identifier] = row.setting_value !== undefined ? row.setting_value : row.value;
      }
    });

    // Check jsonb config first
    const config = settingsMap.referral_program_config;
    if (config && typeof config === 'object') {
      return {
        enabled: config.referral_enabled !== false,
        referrerCoins: Number(config.referrer_reward_coins ?? 50),
        referredCoins: Number(config.referred_reward_coins ?? 20)
      };
    }

    // Check individual keys
    const enabled = settingsMap.referral_enabled !== undefined ? Boolean(settingsMap.referral_enabled) : true;
    const referrerCoins = Number(settingsMap.referrer_reward_coins || 50);
    const referredCoins = Number(settingsMap.referred_reward_coins || 20);

    return { enabled, referrerCoins, referredCoins };
  } catch (err) {
    console.error('Failed to get referral settings:', err);
    return { enabled: true, referrerCoins: 50, referredCoins: 20 };
  }
}

export async function saveReferralSettings(supabase, { enabled, referrerCoins, referredCoins }) {
  if (!supabase) throw new Error('Supabase client unavailable');

  const config = {
    referral_enabled: Boolean(enabled),
    referrer_reward_coins: Number(referrerCoins),
    referred_reward_coins: Number(referredCoins)
  };

  const rows = [
    { key: 'referral_program_config', setting_key: 'referral_program_config', setting_value: config, value: config },
    { key: 'referral_enabled', setting_key: 'referral_enabled', setting_value: Boolean(enabled), value: Boolean(enabled) },
    { key: 'referrer_reward_coins', setting_key: 'referrer_reward_coins', setting_value: Number(referrerCoins), value: Number(referrerCoins) },
    { key: 'referred_reward_coins', setting_key: 'referred_reward_coins', setting_value: Number(referredCoins), value: Number(referredCoins) }
  ];

  let { error } = await supabase
    .from('platform_settings')
    .upsert(rows, { onConflict: 'setting_key' });

  if (error) {
    const fallback = await supabase
      .from('platform_settings')
      .upsert(rows, { onConflict: 'key' });
    if (fallback.error) throw fallback.error;
  }
  return config;
}

export async function ensureReferralCode(supabase, userId, existingCode = null) {
  if (!supabase || !userId) return existingCode;
  if (existingCode && String(existingCode).trim()) return existingCode;

  try {
    // 1. Try atomic server-side RPC first if available
    try {
      const { data: rpcCode, error: rpcError } = await supabase.rpc('ensure_user_referral_code', {
        p_user_id: userId
      });
      if (!rpcError && rpcCode) {
        return rpcCode;
      }
    } catch {
      // RPC not yet migrated in database
    }

    // 2. Client-side direct UPDATE on profiles.referral_code is not permitted by RLS.
    // Return null safely without throwing or triggering unauthorized database errors.
    console.warn('ensureReferralCode: Server RPC ensure_user_referral_code not yet available. Direct update skipped.');
    return null;
  } catch (err) {
    console.error('ensureReferralCode error:', err);
    return null;
  }
}

export async function processReferralAward(supabase, newUserId, refCode) {
  if (!supabase || !newUserId || !refCode) return null;

  try {
    const cleanCode = String(refCode).trim().toUpperCase();
    if (!cleanCode) return null;

    // Referral awards must be performed atomically by the database RPC. A client-side
    // fallback can split the referral, wallet and ledger writes or award coins twice.
    let response;
    try {
      response = await supabase.rpc('claim_referral_code', { p_ref_code: cleanCode });
    } catch (error) {
      console.warn('Referral claim could not reach the server:', error);
      return { success: false, retryable: true };
    }

    if (response.error) {
      console.warn('Referral claim RPC failed:', response.error.message);
      return { success: false, retryable: true };
    }

    const rpcResult = response.data;
    if (!rpcResult || typeof rpcResult !== 'object') {
      return { success: false, retryable: true };
    }
    if (rpcResult.success) {
      if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('zyvra:coins-updated'));
      }
      return { ...rpcResult, retryable: false };
    }

    // A business rejection (invalid/self/already claimed/paused) is final. An RPC
    // error above is retryable and callers should keep the referral code for later.
    return { ...rpcResult, retryable: false };
  } catch (err) {
    console.error('processReferralAward error:', err);
    return { success: false, retryable: true };
  }
}
