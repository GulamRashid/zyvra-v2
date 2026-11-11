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
    const code = generateReferralCode();
    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', userId);

    if (error) {
      console.warn('Unable to save generated referral code:', error.message);
      return null;
    }
    return code;
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

    // 1. Check settings
    const settings = await getReferralSettings(supabase);
    if (!settings.enabled) return null;

    // 2. Find referrer
    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id, full_name, email, referral_code')
      .ilike('referral_code', cleanCode)
      .maybeSingle();

    if (referrerError || !referrer || referrer.id === newUserId) {
      return null;
    }

    // 3. Check if referral already recorded
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', newUserId)
      .maybeSingle();

    if (existingReferral) {
      return null; // Already credited
    }

    // 4. Log referral record
    const { data: referralRecord, error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        referrer_coins_awarded: settings.referrerCoins,
        referred_coins_awarded: settings.referredCoins
      })
      .select()
      .maybeSingle();

    if (insertError) {
      console.warn('Could not insert referral row:', insertError.message);
    }

    // 5. Credit coins to both wallets
    // Referrer
    try {
      await creditCoinsToWallet(supabase, referrer.id, settings.referrerCoins, 'Referral reward: invited a student');
    } catch (e) {
      console.warn('Error crediting referrer:', e);
    }

    // New student
    try {
      await creditCoinsToWallet(supabase, newUserId, settings.referredCoins, 'Referral bonus: joined with invite code');
    } catch (e) {
      console.warn('Error crediting referred user:', e);
    }

    return referralRecord || { success: true };
  } catch (err) {
    console.error('processReferralAward error:', err);
    return null;
  }
}

async function creditCoinsToWallet(supabase, userId, amount, reason) {
  if (!supabase || !userId || !amount) return;

  // Try RPC if available
  const { error: rpcError } = await supabase.rpc('admin_adjust_user_coins', {
    p_user_id: userId,
    p_amount: Number(amount),
    p_reason: reason
  });

  if (!rpcError) return;

  // Fallback: direct ledger + wallet update
  try {
    const { data: wallet } = await supabase
      .from('coin_wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    const currentBalance = Number(wallet?.balance || 0);
    const newBalance = currentBalance + Number(amount);

    await supabase.from('coin_wallets').upsert({
      user_id: userId,
      balance: newBalance
    }, { onConflict: 'user_id' });

    await supabase.from('coin_ledger').insert({
      user_id: userId,
      amount: Number(amount),
      transaction_type: 'credit',
      reason
    });
  } catch (fallbackError) {
    console.warn('Direct coin award fallback error:', fallbackError);
  }
}
