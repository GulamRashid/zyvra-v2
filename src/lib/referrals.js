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
      if (!rpcError && rpcCode && String(rpcCode).trim()) {
        return String(rpcCode).trim().toUpperCase();
      }
    } catch {
      // RPC not yet migrated in database
    }

    // 2. Try API fallback via /api/update-profile
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch('/api/update-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ ensure_referral_code: true })
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.referral_code) {
          return String(data.referral_code).trim().toUpperCase();
        }
      }
    } catch (apiErr) {
      console.warn('API ensure_referral_code fallback failed:', apiErr);
    }

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

    let response = null;

    // 1. Try client-side RPC
    try {
      response = await supabase.rpc('claim_referral_code', { p_ref_code: cleanCode });
    } catch (error) {
      console.warn('Referral claim client RPC exception:', error);
      response = null;
    }

    if (response && !response.error && response.data?.success) {
      if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('zyvra:coins-updated'));
      }
      return { ...response.data, retryable: false };
    }

    // If business rejection (self-referral or already referred), don't retry
    if (response?.data?.already_referred || response?.data?.error === 'You cannot refer yourself.') {
      return { ...response.data, retryable: false };
    }

    // 2. Try server-side API endpoint fallback
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (token) {
        const res = await fetch('/api/claim-referral', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ referral_code: cleanCode })
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          if (typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new window.CustomEvent('zyvra:coins-updated'));
          }
          return { ...data, retryable: false };
        } else if (data?.already_referred || data?.error === 'You cannot refer yourself.') {
          return { ...data, retryable: false };
        }
      }
    } catch (apiErr) {
      console.warn('API claim-referral fallback error:', apiErr);
    }

    return response?.data || { success: false, retryable: true };
  } catch (err) {
    console.error('processReferralAward error:', err);
    return { success: false, retryable: true };
  }
}
