-- ==============================================================================
-- Zyvra Migration: Atomic Referral Claim RPC
-- Timestamp: 20261113200000
-- Eliminates TOCTOU race conditions and non-atomic wallet updates by executing
-- referral verification, ledger logging, and wallet increments in a single ACID transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.claim_referral_code(
  p_ref_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_code text := upper(trim(p_ref_code));
  v_referrer_id uuid;
  v_referrer_coins integer := 50;
  v_referred_coins integer := 20;
  v_referral_enabled boolean := true;
  v_config_row record;
  v_new_referral_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF v_clean_code IS NULL OR v_clean_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code.');
  END IF;

  -- 1. Check platform settings for referral configuration
  SELECT setting_value INTO v_config_row
  FROM public.platform_settings
  WHERE setting_key = 'referral_program_config' OR key = 'referral_program_config'
  LIMIT 1;

  IF v_config_row.setting_value IS NOT NULL THEN
    v_referral_enabled := coalesce((v_config_row.setting_value->>'referral_enabled')::boolean, true);
    v_referrer_coins := coalesce((v_config_row.setting_value->>'referrer_reward_coins')::integer, 50);
    v_referred_coins := coalesce((v_config_row.setting_value->>'referred_reward_coins')::integer, 20);
  END IF;

  IF NOT v_referral_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral program is currently paused.');
  END IF;

  -- 2. Find referrer by referral code
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(trim(referral_code)) = v_clean_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral code not found.');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot refer yourself.');
  END IF;

  -- 3. Check if current user was already referred
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'already_referred', true, 'error', 'Referral already claimed.');
  END IF;

  -- 4. Insert referral record with ON CONFLICT guard
  INSERT INTO public.referrals (
    referrer_id,
    referred_id,
    referrer_coins_awarded,
    referred_coins_awarded,
    created_at
  )
  VALUES (
    v_referrer_id,
    v_user_id,
    v_referrer_coins,
    v_referred_coins,
    now()
  )
  ON CONFLICT (referred_id) DO NOTHING
  RETURNING id INTO v_new_referral_id;

  IF v_new_referral_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'already_referred', true, 'error', 'Referral already claimed.');
  END IF;

  -- 5. Atomically credit Referrer wallet
  INSERT INTO public.coin_wallets (user_id, balance, updated_at)
  VALUES (v_referrer_id, v_referrer_coins, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = coin_wallets.balance + v_referrer_coins,
      updated_at = now();

  INSERT INTO public.coin_ledger (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_referrer_id, v_referrer_coins, 'credit', 'Referral reward: invited a student', now());

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_referrer_id, v_referrer_coins, 'credit', 'Referral reward: invited a student', now());

  -- 6. Atomically credit Referred New Student wallet
  INSERT INTO public.coin_wallets (user_id, balance, updated_at)
  VALUES (v_user_id, v_referred_coins, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = coin_wallets.balance + v_referred_coins,
      updated_at = now();

  INSERT INTO public.coin_ledger (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_user_id, v_referred_coins, 'credit', 'Referral bonus: joined with invite code', now());

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_user_id, v_referred_coins, 'credit', 'Referral bonus: joined with invite code', now());

  RETURN jsonb_build_object(
    'success', true,
    'referrer_coins', v_referrer_coins,
    'referred_coins', v_referred_coins,
    'message', 'Referral bonus credited successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;
NOTIFY pgrst, 'reload schema';

