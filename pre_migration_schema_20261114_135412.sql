


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_adjust_user_coins"("p_target_user_id" "uuid", "p_amount" integer, "p_action" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_new_bal INT;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Only super admins can adjust user wallets';
  END IF;

  IF p_action = 'credit' THEN
    UPDATE public.coin_wallets 
    SET balance = balance + p_amount,
        total_earned = total_earned + p_amount,
        updated_at = NOW()
    WHERE user_id = p_target_user_id
    RETURNING balance INTO v_new_bal;
  ELSIF p_action = 'debit' THEN
    UPDATE public.coin_wallets 
    SET balance = GREATEST(0, balance - p_amount),
        total_spent = total_spent + p_amount,
        updated_at = NOW()
    WHERE user_id = p_target_user_id
    RETURNING balance INTO v_new_bal;
  ELSE
    RAISE EXCEPTION 'Action must be credit or debit';
  END IF;

  INSERT INTO public.coin_ledger (
    user_id, amount, tx_type, source, reason, balance_after
  ) VALUES (
    p_target_user_id, p_amount, p_action, 'admin_adjustment', p_reason, v_new_bal
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_bal);
END;
$$;


ALTER FUNCTION "public"."admin_adjust_user_coins"("p_target_user_id" "uuid", "p_amount" integer, "p_action" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_grant_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only administrators can manually grant content access.';
  END IF;

  INSERT INTO public.user_access (
    user_id,
    item_type,
    item_id,
    status,
    is_active,
    granted_by,
    reason,
    starts_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_item_type,
    p_item_id::text,
    'active',
    true,
    auth.uid(),
    p_reason,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET
    status = 'active',
    is_active = true,
    reason = COALESCE(p_reason, user_access.reason),
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."admin_grant_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_grant_user_access"("p_target_user_id" "uuid", "p_item_type" "text", "p_item_id" "uuid", "p_duration_days" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_expires_at TIMESTAMPTZ := NULL;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Super Admin role required.';
  END IF;

  IF p_item_type NOT IN ('exam', 'folder', 'chapter') THEN
    RAISE EXCEPTION 'Invalid item type.';
  END IF;

  IF p_duration_days IS NOT NULL AND p_duration_days > 0 THEN
    v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;
  END IF;

  INSERT INTO public.user_access (
    user_id, item_type, item_id, grant_source, expires_at, status
  ) VALUES (
    p_target_user_id, p_item_type, p_item_id, 'admin_override', v_expires_at, 'active'
  ) ON CONFLICT (user_id, item_type, item_id) DO UPDATE SET
    status = 'active',
    expires_at = EXCLUDED.expires_at,
    grant_source = 'admin_override';

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'item_id', p_item_id);
END;
$$;


ALTER FUNCTION "public"."admin_grant_user_access"("p_target_user_id" "uuid", "p_item_type" "text", "p_item_id" "uuid", "p_duration_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Super Admin role required.';
  END IF;

  IF p_new_role NOT IN ('student', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role specified.';
  END IF;

  UPDATE public.profiles 
  SET role = p_new_role, updated_at = NOW()
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'new_role', p_new_role);
END;
$$;


ALTER FUNCTION "public"."admin_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_clean_type TEXT := lower(trim(p_item_type));
  v_uuid UUID;
  v_exam RECORD;
  v_has_access BOOLEAN := false;
BEGIN
  IF p_item_id IS NULL OR p_item_id = '' THEN
    RETURN false;
  END IF;

  -- Try converting item_id to UUID
  BEGIN
    v_uuid := p_item_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_uuid := NULL;
  END;

  -- 1. EXAM ACCESS
  IF v_clean_type = 'exam' THEN
    IF v_uuid IS NOT NULL THEN
      SELECT access_mode, price INTO v_exam FROM public.exams WHERE id = v_uuid;
      -- Free exam
      IF FOUND AND (v_exam.access_mode = 'free' OR v_exam.price IS NULL OR v_exam.price <= 0) THEN
        RETURN true;
      END IF;
    END IF;

    -- Check user purchase
    IF p_user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_access ua
        WHERE ua.user_id = p_user_id
          AND ua.item_type = 'exam'
          AND ua.item_id::text = p_item_id
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
      ) INTO v_has_access;

      RETURN v_has_access;
    END IF;

    RETURN false;

  -- 2. FOLDER ACCESS (Hierarchical)
  ELSIF v_clean_type = 'folder' THEN
    IF v_uuid IS NOT NULL THEN
      RETURN public.user_has_folder_access(p_user_id, v_uuid);
    END IF;
    RETURN false;

  -- 3. CHAPTER ACCESS (Hierarchical)
  ELSIF v_clean_type = 'chapter' THEN
    IF v_uuid IS NOT NULL THEN
      RETURN public.user_has_chapter_access(p_user_id, v_uuid);
    END IF;
    RETURN false;

  -- 4. OTHER ENTITLEMENTS (Tools, general passes, combo keys)
  ELSE
    IF p_user_id IS NULL THEN
      RETURN false;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = v_clean_type
        AND ua.item_id::text = p_item_id
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_access;

    RETURN v_has_access;
  END IF;
END;
$$;


ALTER FUNCTION "public"."check_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_referral_code"("p_ref_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."claim_referral_code"("p_ref_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_successful_checkout"("p_order_id" "uuid", "p_razorpay_payment_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID;
BEGIN
  SELECT * INTO v_order FROM public.payment_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'captured' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already processed');
  END IF;

  v_user_id := v_order.user_id;

  -- Update Order
  UPDATE public.payment_orders SET
    status = 'captured',
    razorpay_payment_id = p_razorpay_payment_id,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Deduct redeemed coins from wallet
  IF v_order.coins_redeemed > 0 THEN
    UPDATE public.coin_wallets 
    SET balance = balance - v_order.coins_redeemed,
        total_spent = total_spent + v_order.coins_redeemed,
        updated_at = NOW()
    WHERE user_id = v_user_id;

    INSERT INTO public.coin_ledger (
      user_id, amount, tx_type, source, reason, reference_id, balance_after
    ) VALUES (
      v_user_id, v_order.coins_redeemed, 'debit', 'checkout_discount',
      'Discount on ' || v_order.item_title,
      p_order_id::text,
      (SELECT balance FROM public.coin_wallets WHERE user_id = v_user_id)
    );
  END IF;

  -- Grant Access
  INSERT INTO public.user_access (
    user_id, item_type, item_id, order_id, grant_source
  ) VALUES (
    v_user_id, v_order.order_type, v_order.item_id, p_order_id, 'purchase'
  ) ON CONFLICT (user_id, item_type, item_id) DO UPDATE SET
    status = 'active',
    expires_at = NULL;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;


ALTER FUNCTION "public"."complete_successful_checkout"("p_order_id" "uuid", "p_razorpay_payment_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_successful_checkout"("p_order_id" "text", "p_payment_id" "text", "p_payment_signature" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_secret text;
  v_gateway_order_id text;
  v_expected_signature text;
  v_item_type text;
  v_item_id text;
  v_coins_to_deduct integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE id::text = p_order_id
     OR gateway_order_id = p_order_id
     OR razorpay_order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found.');
  END IF;
  IF v_order.user_id IS NULL OR v_order.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Payment order ownership could not be verified.' USING ERRCODE = '42501';
  END IF;
  IF lower(coalesce(v_order.status, '')) = 'paid' THEN
    RETURN jsonb_build_object('success', true, 'already_fulfilled', true);
  END IF;
  IF p_payment_id IS NULL OR p_payment_signature IS NULL THEN
    RAISE EXCEPTION 'Payment verification data is incomplete.' USING ERRCODE = '22023';
  END IF;

  v_gateway_order_id := coalesce(v_order.razorpay_order_id, v_order.gateway_order_id);
  v_secret := current_setting('app.razorpay_key_secret', true);
  IF v_gateway_order_id IS NULL OR v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'Payment verification is not configured.' USING ERRCODE = '38000';
  END IF;

  v_expected_signature := encode(
    hmac(v_gateway_order_id || '|' || p_payment_id, v_secret, 'sha256'),
    'hex'
  );
  IF lower(v_expected_signature) <> lower(trim(p_payment_signature)) THEN
    RAISE EXCEPTION 'Payment signature verification failed.' USING ERRCODE = '28000';
  END IF;

  UPDATE public.payment_orders
  SET status = 'paid',
      gateway_payment_id = coalesce(p_payment_id, gateway_payment_id),
      razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id),
      payment_signature = p_payment_signature,
      razorpay_signature = p_payment_signature,
      amount_paid = coalesce(final_amount, amount, 0),
      updated_at = now()
  WHERE id = v_order.id;

  v_item_type := CASE
    WHEN lower(coalesce(v_order.item_type, v_order.order_type, '')) IN ('exam', 'folder', 'chapter')
      THEN lower(coalesce(v_order.item_type, v_order.order_type))
    ELSE 'folder'
  END;
  v_item_id := v_order.item_id::text;

  INSERT INTO public.user_access (
    user_id, item_type, item_id, grant_source, status, is_active, starts_at, created_at, updated_at
  )
  VALUES (
    v_order.user_id, v_item_type, v_item_id, 'purchase', 'active', true, now(), now(), now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET status = 'active', is_active = true, updated_at = now();

  v_coins_to_deduct := greatest(coalesce(v_order.coins_redeemed, v_order.coins_used, 0), 0);
  IF v_coins_to_deduct > 0 THEN
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_order.user_id, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.coin_wallets
    SET balance = greatest(0, balance - v_coins_to_deduct), updated_at = now()
    WHERE user_id = v_order.user_id;

    INSERT INTO public.coin_ledger (
      user_id, amount, transaction_type, reason, description, created_at
    )
    VALUES (
      v_order.user_id, -v_coins_to_deduct, 'redeem',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_item_type),
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_item_type), now()
    );

    INSERT INTO public.coin_transactions (
      user_id, amount, type, transaction_type, reason, description, reference_id, created_at
    )
    VALUES (
      v_order.user_id, -v_coins_to_deduct, 'redeem', 'redeem',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_item_type),
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_item_type),
      v_order.id::text, now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Payment verified and access entitlement granted.');
END;
$$;


ALTER FUNCTION "public"."complete_successful_checkout"("p_order_id" "text", "p_payment_id" "text", "p_payment_signature" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "text", "p_coins_to_redeem" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id UUID;
  v_clean_type TEXT;
  v_base_price NUMERIC(10, 2) := 0;
  v_item_title TEXT := '';
  v_coins_per_rupee NUMERIC := 10;
  v_max_discount_pct NUMERIC := 20;
  v_wallet_balance INTEGER := 0;
  v_max_coins INTEGER := 0;
  v_coins_used INTEGER := 0;
  v_discount NUMERIC(10, 2) := 0;
  v_payable NUMERIC(10, 2) := 0;
  v_amount_paise BIGINT := 0;
  v_order_id UUID;
  v_conf JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean_type := lower(trim(p_item_type));
  IF v_clean_type NOT IN ('folder', 'chapter', 'exam') THEN
    RAISE EXCEPTION 'Invalid item_type: %', p_item_type;
  END IF;

  -- 1. Fetch authoritative base price and title
  IF v_clean_type = 'folder' THEN
    SELECT COALESCE(price, 0), COALESCE(title, '') INTO v_base_price, v_item_title FROM public.folders WHERE id = p_item_id::UUID;
  ELSIF v_clean_type = 'chapter' THEN
    SELECT COALESCE(price, 0), COALESCE(title, '') INTO v_base_price, v_item_title FROM public.chapters WHERE id = p_item_id::UUID;
  ELSIF v_clean_type = 'exam' THEN
    SELECT COALESCE(price, 0), COALESCE(title, '') INTO v_base_price, v_item_title FROM public.exams WHERE id = p_item_id::UUID;
  END IF;

  IF v_base_price <= 0 THEN
    RAISE EXCEPTION 'Item has no price or is free';
  END IF;

  -- 2. Read redemption config
  SELECT COALESCE(setting_value, value) INTO v_conf
  FROM public.platform_settings
  WHERE setting_key = 'coin_redemption_config' OR key = 'coin_redemption_config'
  LIMIT 1;

  IF v_conf IS NOT NULL THEN
    v_coins_per_rupee := COALESCE((v_conf->>'coins_per_rupee')::NUMERIC, 10);
    v_max_discount_pct := COALESCE((v_conf->>'max_discount_percent')::NUMERIC, 20);
  END IF;

  -- 3. Calculate coin discount
  SELECT COALESCE(balance, 0) INTO v_wallet_balance
  FROM public.coin_wallets
  WHERE user_id = v_user_id;

  v_max_coins := LEAST(
    v_wallet_balance,
    FLOOR(v_base_price * (v_max_discount_pct / 100.0) * v_coins_per_rupee)::INTEGER
  );

  IF p_coins_to_redeem > 0 AND v_max_coins > 0 THEN
    v_coins_used := LEAST(p_coins_to_redeem, v_max_coins);
    v_discount := ROUND((v_coins_used::NUMERIC / v_coins_per_rupee), 2);
    v_discount := LEAST(v_base_price, v_discount);
  ELSE
    v_coins_used := 0;
    v_discount := 0;
  END IF;

  v_payable := GREATEST(0, v_base_price - v_discount);
  v_amount_paise := ROUND(v_payable * 100)::BIGINT;

  -- 4. Create internal payment order with ALL columns populated
  INSERT INTO public.payment_orders (
    user_id,
    order_type,
    item_type,
    item_id,
    item_title,
    tier,
    base_amount,
    base_price,
    coins_used,
    coins_redeemed,
    discount_amount,
    final_amount,
    amount,
    amount_paise,
    status,
    currency
  )
  VALUES (
    v_user_id,
    v_clean_type,
    v_clean_type,
    p_item_id,
    v_item_title,
    v_clean_type,
    v_base_price,
    v_base_price,
    v_coins_used,
    v_coins_used,
    v_discount,
    v_payable,
    v_payable,
    v_amount_paise,
    'created',
    'INR'
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order_id,
      'order_type', v_clean_type,
      'item_type', v_clean_type,
      'item_id', p_item_id,
      'item_title', v_item_title,
      'base_amount', v_base_price,
      'base_price', v_base_price,
      'coins_used', v_coins_used,
      'discount', v_discount,
      'discount_amount', v_discount,
      'final_amount', v_payable,
      'amount', v_payable,
      'amount_paise', v_amount_paise,
      'currency', 'INR',
      'status', 'created'
    )
  );
END;
$$;


ALTER FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "text", "p_coins_to_redeem" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "uuid", "p_redeem_coins" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item_title TEXT := '';
  v_base_price NUMERIC(10, 2) := 0.00;
  v_coins_balance INT := 0;
  v_coin_config JSONB;
  v_coins_per_rupee INT := 10;
  v_max_discount_pct NUMERIC := 20;
  v_coin_enabled BOOLEAN := TRUE;
  v_max_allowed_discount NUMERIC(10, 2) := 0.00;
  v_coin_discount NUMERIC(10, 2) := 0.00;
  v_coins_to_redeem INT := 0;
  v_final_amount NUMERIC(10, 2) := 0.00;
  v_order_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create an order';
  END IF;

  -- 1. Fetch Item Title and Base Price
  IF p_item_type = 'chapter' THEN
    SELECT title, COALESCE(custom_price, 0.00) INTO v_item_title, v_base_price 
    FROM public.chapters WHERE id = p_item_id;
  ELSIF p_item_type = 'folder' THEN
    SELECT title, COALESCE(base_price, 0.00) INTO v_item_title, v_base_price 
    FROM public.folders WHERE id = p_item_id;
  ELSIF p_item_type = 'exam' THEN
    SELECT title INTO v_item_title FROM public.exams WHERE id = p_item_id;
    v_base_price := 499.00; -- Default Exam Pass price
  ELSE
    RAISE EXCEPTION 'Invalid item type: %', p_item_type;
  END IF;

  IF v_base_price <= 0 THEN
    RAISE EXCEPTION 'Item is free or does not require purchase';
  END IF;

  -- 2. Process Coin Redemption if enabled
  IF p_redeem_coins THEN
    SELECT balance INTO v_coins_balance 
    FROM public.coin_wallets WHERE user_id = v_user_id;
    v_coins_balance := COALESCE(v_coins_balance, 0);

    SELECT setting_value INTO v_coin_config 
    FROM public.platform_settings WHERE setting_key = 'coin_redemption_config';

    IF v_coin_config IS NOT NULL THEN
      v_coins_per_rupee := COALESCE((v_coin_config->>'coins_per_rupee')::INT, 10);
      v_max_discount_pct := COALESCE((v_coin_config->>'max_discount_percent')::NUMERIC, 20);
      v_coin_enabled := COALESCE((v_coin_config->>'is_enabled')::BOOLEAN, TRUE);
    END IF;

    IF v_coin_enabled AND v_coins_balance > 0 THEN
      v_max_allowed_discount := ROUND((v_base_price * (v_max_discount_pct / 100.0)), 2);
      v_coin_discount := ROUND((v_coins_balance::NUMERIC / v_coins_per_rupee), 2);
      
      IF v_coin_discount > v_max_allowed_discount THEN
        v_coin_discount := v_max_allowed_discount;
      END IF;

      v_coins_to_redeem := CEIL(v_coin_discount * v_coins_per_rupee);
    END IF;
  END IF;

  v_final_amount := v_base_price - v_coin_discount;
  IF v_final_amount < 0 THEN v_final_amount := 0.00; END IF;

  -- 3. Create Order
  INSERT INTO public.payment_orders (
    user_id, order_type, item_id, item_title, base_amount,
    coin_discount, coins_redeemed, final_amount, status
  ) VALUES (
    v_user_id, p_item_type, p_item_id, v_item_title, v_base_price,
    v_coin_discount, v_coins_to_redeem, v_final_amount, 'created'
  ) RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'item_title', v_item_title,
    'base_amount', v_base_price,
    'coin_discount', v_coin_discount,
    'coins_redeemed', v_coins_to_redeem,
    'final_amount', v_final_amount,
    'amount_paise', (v_final_amount * 100)::INT
  );
END;
$$;


ALTER FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "uuid", "p_redeem_coins" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_live_test_questions"("p_test_id" "uuid", "p_attempt_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_is_admin boolean := false;
  v_questions jsonb;
  v_include_solutions boolean := false;
BEGIN
  -- Check if caller is admin
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_user_id AND lower(trim(p.role)) IN ('admin', 'super_admin')
    ) INTO v_is_admin;
  END IF;

  IF v_is_admin THEN
    v_include_solutions := true;
  ELSIF p_attempt_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    SELECT a.* INTO v_attempt
    FROM public.test_attempts AS a
    WHERE a.id = p_attempt_id
      AND a.test_id = p_test_id
      AND a.user_id = v_user_id
    FOR SHARE;

    IF FOUND AND lower(coalesce(v_attempt.status, '')) IN ('completed', 'submitted') THEN
      v_include_solutions := true;
    END IF;
  END IF;

  -- Notice: We deliberately do NOT bulk-include solutions for in-progress tests,
  -- even in immediate solution mode, to prevent exam cheating.
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_id', q.id,
        'test_question_id', tq.id,
        'display_order', tq.display_order,
        'marks', tq.marks,
        'question_text', q.question_text,
        'question_text_hi', q.question_text_hi,
        'options', q.options,
        'options_hi', q.options_hi,
        'subject', q.subject,
        'topic', q.topic,
        'tags', q.tags,
        'difficulty', q.difficulty,
        'question_type', q.question_type,
        'correct_answer', CASE 
          WHEN v_include_solutions THEN q.correct_answer 
          ELSE NULL 
        END,
        'explanation', CASE 
          WHEN v_include_solutions THEN q.explanation 
          ELSE NULL 
        END,
        'explanation_hi', CASE 
          WHEN v_include_solutions THEN q.explanation_hi 
          ELSE NULL 
        END,
        'distractor_notes', CASE 
          WHEN v_include_solutions THEN q.distractor_notes 
          ELSE NULL 
        END,
        'distractor_notes_hi', CASE 
          WHEN v_include_solutions THEN q.distractor_notes_hi 
          ELSE NULL 
        END
      ) ORDER BY tq.display_order, tq.id
    ),
    '[]'::jsonb
  )
  INTO v_questions
  FROM public.test_questions AS tq
  JOIN public.questions AS q ON (q.id = tq.question_id OR q.id = tq.id)
  WHERE tq.test_id = p_test_id
    AND lower(coalesce(q.status, 'published')) = 'published';

  RETURN jsonb_build_object('questions', v_questions);
END;
$$;


ALTER FUNCTION "public"."get_live_test_questions"("p_test_id" "uuid", "p_attempt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_practice_questions"("p_chapter_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH RECURSIVE folder_tree AS (
    SELECT f.id, f.parent_folder_id, f.price, f.exam_id
    FROM public.chapters c
    JOIN public.folders f ON f.id = c.folder_id
    WHERE c.id = p_chapter_id
    UNION ALL
    SELECT parent.id, parent.parent_folder_id, parent.price, parent.exam_id
    FROM public.folders parent
    JOIN folder_tree child ON child.parent_folder_id = parent.id
  ),
  access_context AS (
    SELECT
      EXISTS (
        SELECT 1
        FROM public.chapters c
        WHERE c.id = p_chapter_id
          AND lower(coalesce(c.access_mode, 'inherit')) IN ('paid-own', 'paid_own')
          AND coalesce(c.price, 0) > 0
      )
      OR EXISTS (
        SELECT 1
        FROM folder_tree
        WHERE coalesce(price, 0) > 0
      )
      OR EXISTS (
        SELECT 1
        FROM public.exams e
        JOIN folder_tree ft ON ft.exam_id = e.id
        WHERE coalesce(e.price, 0) > 0
           OR lower(coalesce(e.access_mode, '')) IN ('paid-own', 'paid_own')
      ) AS access_required
  )
  SELECT jsonb_build_object(
    'questions',
    coalesce(jsonb_agg(to_jsonb(question_rows) ORDER BY question_rows.display_order, question_rows.id), '[]'::jsonb)
  )
  FROM (
    SELECT DISTINCT
      q.id,
      q.question_text,
      q.question_text_hi,
      q.options,
      q.subject,
      q.topic,
      q.tags,
      q.difficulty,
      coalesce(tq.display_order, 0) AS display_order
    FROM public.questions q
    LEFT JOIN public.test_questions tq ON tq.question_id = q.id
    LEFT JOIN public.tests t ON t.id = tq.test_id
    WHERE q.status = 'published'
      AND (q.chapter_id = p_chapter_id OR (
        t.chapter_id = p_chapter_id
        AND t.status IN ('published', 'live', 'available')
      ))
      AND (
        NOT (SELECT access_required FROM access_context)
        OR EXISTS (
          SELECT 1
          FROM public.user_access ua
          WHERE ua.user_id = auth.uid()
            AND coalesce(ua.is_active, false) = true
            AND lower(coalesce(ua.status, 'active')) = 'active'
            AND (
              (ua.item_type = 'chapter' AND ua.item_id::text = p_chapter_id::text)
              OR (ua.item_type = 'folder' AND EXISTS (
                SELECT 1 FROM folder_tree ft WHERE ft.id::text = ua.item_id::text
              ))
              OR (ua.item_type = 'exam' AND EXISTS (
                SELECT 1 FROM folder_tree ft WHERE ft.exam_id::text = ua.item_id::text
              ))
            )
        )
      )
  ) AS question_rows;
$$;


ALTER FUNCTION "public"."get_practice_questions"("p_chapter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_published_question_metadata"("p_question_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "subject" "text", "topic" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT q.id, q.subject, q.topic
  FROM public.questions q
  WHERE auth.uid() IS NOT NULL
    AND q.status IN ('published', 'active', 'live', 'available')
    AND q.id = ANY(COALESCE(p_question_ids, ARRAY[]::UUID[]));
$$;


ALTER FUNCTION "public"."get_published_question_metadata"("p_question_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_single_question_feedback"("p_test_id" "uuid", "p_question_id" "uuid", "p_selected_option" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_attempt public.test_attempts%ROWTYPE;
  v_solution_mode text;
  v_question public.questions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE test_id = p_test_id
    AND user_id = auth.uid()
    AND lower(coalesce(status, '')) IN ('started', 'in_progress', 'in progress', 'pending')
    AND completed_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'An active test attempt is required.');
  END IF;

  SELECT lower(coalesce(solution_mode, '')) INTO v_solution_mode
  FROM public.tests
  WHERE id = p_test_id;
  IF v_solution_mode <> 'immediate' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'This test does not support immediate feedback.');
  END IF;
  IF p_selected_option IS NULL OR trim(p_selected_option) = '' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Must select an option before viewing feedback.');
  END IF;

  SELECT q.* INTO v_question
  FROM public.questions q
  JOIN public.test_questions tq ON tq.question_id = q.id
  WHERE tq.test_id = p_test_id AND q.id = p_question_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Question not found in test.');
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'question_id', v_question.id,
    'correct_answer', v_question.correct_answer,
    'explanation', v_question.explanation,
    'distractor_notes', v_question.distractor_notes
  );
END;
$$;


ALTER FUNCTION "public"."get_single_question_feedback"("p_test_id" "uuid", "p_question_id" "uuid", "p_selected_option" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_test_attempt_result"("p_attempt_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_test public.tests%ROWTYPE;
  v_solutions jsonb;
  v_positive_score numeric := 0;
  v_negative_deductions numeric := 0;
  v_blank_deductions numeric := 0;
  v_accuracy numeric := 0;
  v_percentage numeric := 0;
  v_coins integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT a.* INTO v_attempt
  FROM public.test_attempts AS a
  WHERE a.id = p_attempt_id AND a.user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_attempt.status, '')) NOT IN ('submitted', 'completed', 'graded', 'finished') THEN
    RAISE EXCEPTION 'Results are available after the attempt is submitted.' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.* INTO v_test FROM public.tests AS t WHERE t.id = v_attempt.test_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'question', jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'question_text_hi', q.question_text_hi,
          'options', q.options,
          'subject', q.subject,
          'topic', q.topic,
          'explanation', q.explanation,
          'explanation_hi', q.explanation_hi
        ),
        'student_selected', CASE
          WHEN coalesce(cardinality(r.selected_answers), 0) > 0 THEN to_jsonb(r.selected_answers)
          ELSE '[]'::jsonb
        END,
        'correct_answer', CASE
          WHEN jsonb_typeof(to_jsonb(q)->'correct_answers') = 'array' THEN
            CASE
              WHEN jsonb_array_length(to_jsonb(q)->'correct_answers') > 0
                THEN to_jsonb(q)->'correct_answers'
              WHEN q.correct_answer IS NOT NULL
                THEN jsonb_build_array(q.correct_answer)
              ELSE '[]'::jsonb
            END
          WHEN q.correct_answer IS NOT NULL THEN jsonb_build_array(q.correct_answer)
          ELSE '[]'::jsonb
        END,
        'is_correct', coalesce(r.is_correct, false),
        'explanation', jsonb_build_object('en', q.explanation, 'hi', q.explanation_hi),
        'distractor_notes', q.distractor_notes,
        'marks_obtained', coalesce(r.marks_obtained, 0),
        'blank_penalty_amount', CASE
          WHEN coalesce(cardinality(r.selected_answers), 0) = 0 AND coalesce(r.marks_obtained, 0) < 0
            THEN abs(r.marks_obtained)
          ELSE 0
        END
      ) ORDER BY tq.display_order, tq.id
    ),
    '[]'::jsonb
  )
  INTO v_solutions
  FROM public.test_questions AS tq
  JOIN public.questions AS q ON q.id = tq.question_id
  LEFT JOIN public.test_responses AS r
    ON r.attempt_id = p_attempt_id AND r.question_id = tq.question_id
  WHERE tq.test_id = v_attempt.test_id;

  SELECT
    coalesce(sum(CASE WHEN r.is_correct THEN greatest(coalesce(r.marks_obtained, 0), 0) ELSE 0 END), 0),
    coalesce(abs(sum(CASE WHEN coalesce(cardinality(r.selected_answers), 0) > 0 AND NOT coalesce(r.is_correct, false) AND r.marks_obtained < 0 THEN r.marks_obtained ELSE 0 END)), 0),
    coalesce(abs(sum(CASE WHEN coalesce(cardinality(r.selected_answers), 0) = 0 AND r.marks_obtained < 0 THEN r.marks_obtained ELSE 0 END)), 0)
  INTO v_positive_score, v_negative_deductions, v_blank_deductions
  FROM public.test_responses AS r
  WHERE r.attempt_id = p_attempt_id;

  IF coalesce(v_attempt.attempted_count, 0) > 0 THEN
    v_accuracy := round(v_attempt.correct_count * 100.0 / v_attempt.attempted_count, 2);
  END IF;
  v_percentage := coalesce(v_attempt.percentage, 0);
  v_coins := coalesce(v_attempt.coins_awarded, 0);

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', v_attempt.test_id,
    'test_title', v_test.title,
    'score', coalesce(v_attempt.score, 0),
    'total_marks', coalesce(v_attempt.max_score, 0),
    'percentage', v_percentage,
    'accuracy_percentage', v_accuracy,
    'positive_score', v_positive_score,
    'negative_deductions', v_negative_deductions,
    'blank_penalty_deductions', v_blank_deductions,
    'blank_penalty_count', coalesce(v_attempt.blank_penalty_count, 0),
    'total_questions', coalesce(v_attempt.total_questions, 0),
    'attempted_count', coalesce(v_attempt.attempted_count, 0),
    'correct_count', coalesce(v_attempt.correct_count, 0),
    'incorrect_count', coalesce(v_attempt.incorrect_count, 0),
    'scorecard', jsonb_build_object(
      'score', coalesce(v_attempt.score, 0),
      'total_marks', coalesce(v_attempt.max_score, 0),
      'percentage', v_percentage,
      'accuracy_percentage', v_accuracy,
      'positive_score', v_positive_score,
      'negative_deductions', v_negative_deductions,
      'blank_penalty_deductions', v_blank_deductions,
      'blank_penalty_count', coalesce(v_attempt.blank_penalty_count, 0)
    ),
    'solutions', v_solutions,
    'coins_earned', v_coins,
    'coin_reward_enabled', coalesce(v_test.coin_reward_enabled, false),
    'is_first_attempt', coalesce(v_attempt.attempt_number, 1) = 1,
    'qualified_for_coin_reward', v_coins > 0
  );
END;
$$;


ALTER FUNCTION "public"."get_test_attempt_result"("p_attempt_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL
  );

  INSERT INTO public.coin_wallets (user_id, balance, total_earned)
  VALUES (NEW.id, 20, 20);

  INSERT INTO public.coin_ledger (user_id, amount, tx_type, source, reason, balance_after)
  VALUES (NEW.id, 20, 'credit', 'welcome_bonus', 'Welcome to Zyvra Bonus Coins', 20);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND lower(trim(role)) IN ('admin', 'super_admin')
  );
$$;


ALTER FUNCTION "public"."is_admin_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_test_attempt_progress"("p_attempt_id" "uuid", "p_status" "text", "p_remaining_seconds" integer, "p_current_question_index" integer, "p_state_json" "jsonb", "p_violation_count" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_attempt public.test_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE id = p_attempt_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;
  IF lower(coalesce(v_attempt.status, '')) IN ('completed', 'submitted') THEN
    RETURN jsonb_build_object('attempt_id', p_attempt_id, 'status', v_attempt.status);
  END IF;
  IF lower(coalesce(p_status, '')) NOT IN ('in_progress', 'paused') THEN
    RAISE EXCEPTION 'Invalid attempt progress status.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.test_attempts
  SET status = p_status,
      remaining_seconds = greatest(coalesce(p_remaining_seconds, remaining_seconds, 0), 0),
      current_question_index = greatest(coalesce(p_current_question_index, 0), 0),
      state_json = coalesce(p_state_json, '{}'::jsonb) || jsonb_build_object(
        'violationCount', greatest(coalesce(p_violation_count, 0), 0)
      ),
      paused_at = CASE WHEN p_status = 'paused' THEN now() ELSE paused_at END,
      updated_at = now()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object('attempt_id', p_attempt_id, 'status', p_status);
END;
$$;


ALTER FUNCTION "public"."save_test_attempt_progress"("p_attempt_id" "uuid", "p_status" "text", "p_remaining_seconds" integer, "p_current_question_index" integer, "p_state_json" "jsonb", "p_violation_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_content_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_content_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_test_attempt"("p_test_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user_id uuid;
    v_attempt record;
BEGIN
    -- Logged-in user ki ID get karein
    v_user_id := auth.uid();

    -- Naya attempt insert karein
    INSERT INTO public.test_attempts (test_id, user_id, started_at, status)
    VALUES (p_test_id, v_user_id, now(), 'in_progress')
    RETURNING * INTO v_attempt;

    -- Attempt object return karein
    RETURN row_to_json(v_attempt);
END;
$$;


ALTER FUNCTION "public"."start_test_attempt"("p_test_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_test_attempt"("p_attempt_id" "uuid", "p_responses" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_test public.tests%ROWTYPE;
  v_row record;
  v_pattern text;
  v_selected text;
  v_is_correct boolean;
  v_question_marks numeric;
  v_negative_marks numeric;
  v_blank_penalty numeric;
  v_marks_obtained numeric;
  v_score numeric := 0;
  v_max_score numeric := 0;
  v_positive_score numeric := 0;
  v_negative_deductions numeric := 0;
  v_blank_deductions numeric := 0;
  v_total_count integer := 0;
  v_attempted_count integer := 0;
  v_correct_count integer := 0;
  v_incorrect_count integer := 0;
  v_blank_count integer := 0;
  v_blank_penalty_count integer := 0;
  v_time_spent integer := 0;
  v_percentage numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF jsonb_typeof(p_responses) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Responses must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  SELECT a.* INTO v_attempt
  FROM public.test_attempts AS a
  WHERE a.id = p_attempt_id AND a.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_attempt.status, '')) = 'completed' THEN
    RETURN jsonb_build_object(
      'attempt_id', v_attempt.id,
      'status', v_attempt.status
    );
  END IF;

  IF lower(coalesce(v_attempt.status, '')) NOT IN
     ('started', 'in_progress', 'in progress', 'pending') THEN
    RAISE EXCEPTION 'This test attempt cannot be submitted.' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.* INTO v_test
  FROM public.tests AS t
  WHERE t.id = v_attempt.test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test configuration not found.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_responses) AS submitted(question_id uuid)
    WHERE submitted.question_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.test_questions AS tq
         WHERE tq.test_id = v_attempt.test_id
           AND (tq.question_id = submitted.question_id OR tq.id = submitted.question_id)
       )
  ) THEN
    RAISE EXCEPTION 'A response references a question outside this test.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT submitted.question_id
    FROM jsonb_to_recordset(p_responses) AS submitted(question_id uuid)
    GROUP BY submitted.question_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate question responses are not allowed.' USING ERRCODE = '22023';
  END IF;

  v_pattern := lower(coalesce(
    v_test.pattern,
    v_test.pattern_type,
    v_test.question_pattern,
    ''
  ));
  v_blank_penalty := greatest(coalesce(
    v_test.mandatory_option_e_penalty,
    v_test.unattempted_e_penalty,
    v_test.blank_penalty,
    v_test.option_e_penalty,
    0
  ), 0);
  v_negative_marks := greatest(coalesce(v_test.negative_marks, 0), 0);

  DELETE FROM public.test_responses AS r
  WHERE r.attempt_id = p_attempt_id;

  FOR v_row IN
    SELECT
      tq.question_id,
      coalesce(tq.marks, v_test.positive_marks, 1)::numeric AS question_marks,
      CASE
        WHEN jsonb_typeof(to_jsonb(q)->'correct_answers') = 'array'
             AND jsonb_array_length(to_jsonb(q)->'correct_answers') > 0
          THEN to_jsonb(q)->'correct_answers'
        WHEN q.correct_answer IS NOT NULL
          THEN jsonb_build_array(q.correct_answer)
        ELSE '[]'::jsonb
      END AS answer_keys,
      submitted.selected_option,
      coalesce(submitted.marked_for_review, false) AS marked_for_review,
      CASE
        WHEN jsonb_typeof(q.options) = 'array'
          THEN jsonb_array_length(q.options)
        WHEN jsonb_typeof(q.options) = 'object'
          THEN (
            SELECT count(*)::integer
            FROM jsonb_object_keys(q.options) AS option_key(key)
            WHERE upper(option_key.key) IN ('A', 'B', 'C', 'D', 'E')
          )
        ELSE coalesce(v_test.options_count, 0)
      END AS option_count
    FROM public.test_questions AS tq
    JOIN public.questions AS q ON (q.id = tq.question_id OR q.id = tq.id)
    LEFT JOIN LATERAL (
      SELECT
        upper(nullif(btrim(response.selected_option), '')) AS selected_option,
        response.marked_for_review
      FROM jsonb_to_recordset(p_responses) AS response(
        question_id uuid,
        selected_option text,
        marked_for_review boolean
      )
      WHERE response.question_id = tq.question_id OR response.question_id = tq.id
      LIMIT 1
    ) AS submitted ON true
    WHERE tq.test_id = v_attempt.test_id
    ORDER BY tq.display_order, tq.id
  LOOP
    v_total_count := v_total_count + 1;
    v_question_marks := greatest(coalesce(v_row.question_marks, 0), 0);
    v_max_score := v_max_score + v_question_marks;
    v_selected := v_row.selected_option;

    IF v_selected IS NOT NULL AND (
      v_selected NOT IN ('A', 'B', 'C', 'D', 'E')
      OR (v_row.option_count > 0
          AND ascii(v_selected) - ascii('A') + 1 > v_row.option_count)
    ) THEN
      RAISE EXCEPTION 'Invalid selected option for question %.', v_row.question_id USING ERRCODE = '22023';
    END IF;

    IF v_selected IS NULL THEN
      v_blank_count := v_blank_count + 1;
      v_is_correct := false;

      IF v_pattern IN (
        'bpsc-mandatory-e',
        'bpsc_mandatory_e',
        'mandatory-e',
        'mandatory_option_e'
      ) THEN
        v_marks_obtained := -v_blank_penalty;
        IF v_blank_penalty > 0 THEN
          v_blank_penalty_count := v_blank_penalty_count + 1;
          v_blank_deductions := v_blank_deductions + v_blank_penalty;
        END IF;
      ELSE
        v_marks_obtained := 0;
      END IF;
    ELSE
      v_attempted_count := v_attempted_count + 1;

      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_row.answer_keys) AS answer_key(value)
        WHERE upper(btrim(answer_key.value)) = v_selected
      )
      INTO v_is_correct;

      IF v_is_correct THEN
        v_correct_count := v_correct_count + 1;
        v_marks_obtained := v_question_marks;
        v_positive_score := v_positive_score + v_marks_obtained;
      ELSE
        v_incorrect_count := v_incorrect_count + 1;
        v_marks_obtained := -v_negative_marks;
        v_negative_deductions := v_negative_deductions + v_negative_marks;
      END IF;
    END IF;

    v_score := v_score + v_marks_obtained;

    INSERT INTO public.test_responses (
      attempt_id,
      question_id,
      selected_answers,
      is_marked_for_review,
      is_correct,
      marks_obtained
    )
    VALUES (
      p_attempt_id,
      v_row.question_id,
      CASE
        WHEN v_selected IS NULL THEN ARRAY[]::text[]
        ELSE ARRAY[v_selected]::text[]
      END,
      v_row.marked_for_review,
      v_is_correct,
      v_marks_obtained
    );
  END LOOP;

  IF v_total_count = 0 THEN
    RAISE EXCEPTION 'This test has no published questions to submit.' USING ERRCODE = 'P0001';
  END IF;

  IF v_max_score > 0 THEN
    v_percentage := round(v_score * 100 / v_max_score, 2);
  END IF;

  IF v_attempt.started_at IS NOT NULL THEN
    v_time_spent := greatest(
      floor(extract(epoch FROM (now() - v_attempt.started_at)))::integer,
      0
    );
  END IF;

  UPDATE public.test_attempts AS a
  SET status = 'completed',
      submitted_at = now(),
      completed_at = now(),
      time_spent_seconds = v_time_spent,
      total_questions = v_total_count,
      attempted_count = v_attempted_count,
      correct_count = v_correct_count,
      incorrect_count = v_incorrect_count,
      skipped_with_e_count = v_blank_count,
      blank_penalty_count = v_blank_penalty_count,
      score = v_score,
      max_score = v_max_score,
      total_score = v_score,
      total_marks = v_max_score,
      percentage = v_percentage,
      coins_awarded = coalesce(a.coins_awarded, 0),
      updated_at = now()
  WHERE a.id = p_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', p_attempt_id,
    'status', 'completed',
    'score', v_score,
    'max_score', v_max_score,
    'total_score', v_score,
    'total_marks', v_max_score,
    'percentage', v_percentage,
    'positive_score', v_positive_score,
    'negative_deductions', v_negative_deductions,
    'blank_penalty_deductions', v_blank_deductions,
    'coins_awarded', coalesce(v_attempt.coins_awarded, 0)
  );
END;
$$;


ALTER FUNCTION "public"."submit_test_attempt"("p_attempt_id" "uuid", "p_responses" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_folder_parent_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.parent_folder_id IS NOT NULL AND NEW.parent_id IS NULL THEN
    NEW.parent_id := NEW.parent_folder_id;
  ELSIF NEW.parent_id IS NOT NULL AND NEW.parent_folder_id IS NULL THEN
    NEW.parent_folder_id := NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_folder_parent_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_chapter_access"("p_user_id" "uuid", "p_chapter_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_chapter RECORD;
  v_has_direct BOOLEAN := false;
  v_folder RECORD;
BEGIN
  IF p_chapter_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, folder_id, access_mode, price, status
  INTO v_chapter
  FROM public.chapters
  WHERE id = p_chapter_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. Free chapter
  IF v_chapter.access_mode = 'free' OR (v_chapter.access_mode IN ('paid_own', 'paid-own') AND COALESCE(v_chapter.price, 0) <= 0) THEN
    RETURN true;
  END IF;

  -- 2. Directly purchased by user
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = 'chapter'
        AND ua.item_id::text = p_chapter_id::text
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_direct;

    IF v_has_direct THEN
      RETURN true;
    END IF;

    -- Also check if user holds an exam pass for the chapter's parent exam
    IF v_chapter.folder_id IS NOT NULL THEN
      SELECT exam_id INTO v_folder FROM public.folders WHERE id = v_chapter.folder_id;
      IF v_folder.exam_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.user_access ua
          WHERE ua.user_id = p_user_id
            AND ua.item_type = 'exam'
            AND ua.item_id::text = v_folder.exam_id::text
            AND (ua.is_active IS NULL OR ua.is_active = true)
            AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
            AND (ua.expires_at IS NULL OR ua.expires_at > now())
        ) INTO v_has_direct;

        IF v_has_direct THEN
          RETURN true;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3. Check hierarchical folder access for the parent folder
  IF v_chapter.folder_id IS NOT NULL THEN
    RETURN public.user_has_folder_access(p_user_id, v_chapter.folder_id);
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."user_has_chapter_access"("p_user_id" "uuid", "p_chapter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_folder_access"("p_user_id" "uuid", "p_folder_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_folder RECORD;
  v_has_entitlement BOOLEAN := false;
  v_effective_amount NUMERIC := 0;
BEGIN
  IF p_folder_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, exam_id, COALESCE(parent_folder_id, parent_id) AS parent_folder_id, pricing_mode, price, status
  INTO v_folder
  FROM public.folders
  WHERE id = p_folder_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If user is authenticated, check for active entitlement on this folder, any ancestor folder, or parent exam
  IF p_user_id IS NOT NULL THEN
    -- Check parent exam purchase first
    IF v_folder.exam_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_access ua
        WHERE ua.user_id = p_user_id
          AND ua.item_type = 'exam'
          AND ua.item_id::text = v_folder.exam_id::text
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
      ) INTO v_has_entitlement;

      IF v_has_entitlement THEN
        RETURN true;
      END IF;
    END IF;

    -- Check folder and all ancestor folders using WITH RECURSIVE
    WITH RECURSIVE folder_chain AS (
      SELECT
        id,
        COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
        pricing_mode,
        price,
        1 AS depth
      FROM public.folders
      WHERE id = p_folder_id

      UNION ALL

      SELECT
        f.id,
        COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
        f.pricing_mode,
        f.price,
        fc.depth + 1
      FROM public.folders f
      JOIN folder_chain fc ON f.id = fc.parent_folder_id
    )
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN folder_chain fc ON ua.item_id::text = fc.id::text
      WHERE ua.user_id = p_user_id
        AND ua.item_type = 'folder'
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_entitlement;

    IF v_has_entitlement THEN
      RETURN true;
    END IF;
  END IF;

  -- Check effective pricing: Is this folder effectively free?
  WITH RECURSIVE folder_pricing_chain AS (
    SELECT
      id,
      COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
      pricing_mode,
      price,
      1 AS depth
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT
      f.id,
      COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
      f.pricing_mode,
      f.price,
      fpc.depth + 1
    FROM public.folders f
    JOIN folder_pricing_chain fpc ON f.id = fpc.parent_folder_id
    WHERE fpc.pricing_mode IN ('inherit', 'inherit-parent', 'inherit_parent')
  )
  SELECT
    CASE
      WHEN pricing_mode = 'free' THEN 0
      WHEN pricing_mode IN ('paid_own', 'paid-own') THEN COALESCE(price, 0)
      ELSE 0
    END INTO v_effective_amount
  FROM folder_pricing_chain
  WHERE pricing_mode IN ('free', 'paid_own', 'paid-own')
     OR parent_folder_id IS NULL
  ORDER BY depth ASC
  LIMIT 1;

  IF COALESCE(v_effective_amount, 0) <= 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."user_has_folder_access"("p_user_id" "uuid", "p_folder_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "target_entity" "text" NOT NULL,
    "target_id" "text",
    "reason" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chapter_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chapter_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "resource_type" "text" DEFAULT 'pdf'::"text",
    "file_url" "text" NOT NULL,
    "file_size_kb" integer DEFAULT 0,
    "page_count" integer DEFAULT 1,
    "is_downloadable" boolean DEFAULT false,
    "is_free_preview" boolean DEFAULT false,
    "display_order" integer DEFAULT 1,
    "status" "text" DEFAULT 'published'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "file_size" "text",
    CONSTRAINT "chapter_resources_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['pdf'::"text", 'formula_sheet'::"text", 'revision_sheet'::"text", 'notes'::"text", 'PDF'::"text", 'Formula Sheet'::"text", 'Revision Sheet'::"text", 'Notes'::"text", 'doc'::"text", 'document'::"text", 'video'::"text", 'link'::"text"]))),
    CONSTRAINT "chapter_resources_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."chapter_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chapters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "folder_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "estimated_study_time_mins" integer DEFAULT 45,
    "display_order" integer DEFAULT 0,
    "status" "text" DEFAULT 'published'::"text",
    "access_mode" "text" DEFAULT 'inherit_folder'::"text",
    "custom_price" numeric(10,2) DEFAULT 0.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estimated_study_time_minutes" integer DEFAULT 20,
    "price" numeric(10,2),
    CONSTRAINT "chapters_access_mode_check" CHECK (("access_mode" = ANY (ARRAY['free'::"text", 'paid_own'::"text", 'inherit'::"text"]))),
    CONSTRAINT "chapters_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."chapters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coin_ledger" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "tx_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "reference_id" "text",
    "balance_after" integer NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coin_ledger_source_check" CHECK (("source" = ANY (ARRAY['test_percentage_reward'::"text", 'purchase_bonus'::"text", 'checkout_redemption'::"text", 'refund_reversal'::"text", 'admin_adjustment'::"text", 'welcome_bonus'::"text"]))),
    CONSTRAINT "coin_ledger_tx_type_check" CHECK (("tx_type" = ANY (ARRAY['credit'::"text", 'debit'::"text"])))
);


ALTER TABLE "public"."coin_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coin_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "transaction_type" "text" DEFAULT 'credit'::"text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coin_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coin_wallets" (
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "total_earned" integer DEFAULT 0 NOT NULL,
    "total_redeemed" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_spent" integer DEFAULT 0,
    CONSTRAINT "coin_wallets_balance_check" CHECK (("balance" >= 0))
);


ALTER TABLE "public"."coin_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."exams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon_name" "text" DEFAULT 'GraduationCap'::"text",
    "status" "text" DEFAULT 'published'::"text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "access_mode" "text" DEFAULT 'free'::"text",
    "pass_price" numeric DEFAULT 0,
    "icon" "text" DEFAULT 'BookOpen'::"text",
    "price" numeric(10,2),
    CONSTRAINT "exams_access_mode_check" CHECK (("access_mode" = ANY (ARRAY['free'::"text", 'paid_own'::"text"]))),
    CONSTRAINT "exams_price_check" CHECK ((("price" IS NULL) OR ("price" >= (0)::numeric))),
    CONSTRAINT "exams_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."exams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "exam_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon_name" "text" DEFAULT 'Folder'::"text",
    "display_order" integer DEFAULT 0,
    "status" "text" DEFAULT 'published'::"text",
    "pricing_mode" "text" DEFAULT 'free'::"text",
    "base_price" numeric(10,2) DEFAULT 0.00,
    "effective_price" numeric(10,2) DEFAULT 0.00,
    "allow_tests" boolean DEFAULT true,
    "allow_practice" boolean DEFAULT true,
    "allow_notes" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_folder_id" "uuid",
    "price" numeric(10,2),
    CONSTRAINT "folders_pricing_mode_check" CHECK (("pricing_mode" = ANY (ARRAY['free'::"text", 'paid_own'::"text", 'inherit'::"text"]))),
    CONSTRAINT "folders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "order_type" "text" DEFAULT 'direct'::"text",
    "item_id" "text" NOT NULL,
    "item_title" "text",
    "base_amount" numeric(10,2) DEFAULT 0,
    "coin_discount" numeric(10,2) DEFAULT 0.00,
    "coins_redeemed" integer DEFAULT 0,
    "final_amount" numeric(10,2) DEFAULT 0,
    "currency" "text" DEFAULT 'INR'::"text",
    "razorpay_order_id" "text",
    "razorpay_payment_id" "text",
    "status" "text" DEFAULT 'created'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_paise" bigint DEFAULT 0 NOT NULL,
    "gateway_order_id" "text",
    "gateway_payment_id" "text",
    "payment_signature" "text",
    "item_type" "text",
    "tier" "text" DEFAULT 'standard'::"text",
    "base_price" numeric DEFAULT 0,
    "coins_used" integer DEFAULT 0,
    "discount_amount" numeric DEFAULT 0,
    "razorpay_signature" "text",
    "item_name" "text",
    "amount_before_discount" numeric(10,2) DEFAULT 0,
    "coin_discount_amount" numeric(10,2) DEFAULT 0,
    "amount_paid" numeric(10,2) DEFAULT 0,
    CONSTRAINT "payment_orders_order_type_check" CHECK (("order_type" = ANY (ARRAY['exam'::"text", 'folder'::"text", 'chapter'::"text"]))),
    CONSTRAINT "payment_orders_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'captured'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payment_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "value" "jsonb",
    "key" "text"
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT 'Zyvra Aspirant'::"text",
    "email" "text",
    "mobile" "text",
    "email_verified" boolean DEFAULT false,
    "mobile_verified" boolean DEFAULT false,
    "avatar_url" "text",
    "preferred_language" "text" DEFAULT 'hi'::"text",
    "theme" "text" DEFAULT 'dark'::"text",
    "target_exams" "text"[] DEFAULT ARRAY['BPSC'::"text", 'SSC'::"text", 'CTET'::"text"],
    "role" "text" DEFAULT 'student'::"text",
    "account_status" "text" DEFAULT 'active'::"text",
    "daily_goal_type" "text" DEFAULT 'questions'::"text",
    "daily_goal_target" integer DEFAULT 20,
    "daily_goal_progress" integer DEFAULT 0,
    "current_streak" integer DEFAULT 0,
    "last_active_date" "date",
    "onboarding_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "referral_code" "text",
    CONSTRAINT "profiles_account_status_check" CHECK (("account_status" = ANY (ARRAY['active'::"text", 'restricted'::"text", 'blocked'::"text", 'deletion_pending'::"text"]))),
    CONSTRAINT "profiles_daily_goal_type_check" CHECK (("daily_goal_type" = ANY (ARRAY['questions'::"text", 'minutes'::"text", 'tests'::"text"]))),
    CONSTRAINT "profiles_preferred_language_check" CHECK (("preferred_language" = ANY (ARRAY['hi'::"text", 'en'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'super_admin'::"text", 'admin'::"text", 'content_manager'::"text", 'question_editor'::"text", 'exam_manager'::"text", 'finance_manager'::"text", 'support_agent'::"text", 'analyst'::"text"]))),
    CONSTRAINT "profiles_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chapter_id" "uuid",
    "question_text" "text" NOT NULL,
    "question_type" "text" DEFAULT 'single_mcq'::"text",
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "correct_answers" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "explanation" "text",
    "option_explanations" "jsonb" DEFAULT '{}'::"jsonb",
    "subject" "text",
    "topic" "text",
    "difficulty" "text" DEFAULT 'medium'::"text",
    "language" "text" DEFAULT 'hi'::"text",
    "status" "text" DEFAULT 'published'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "distractor_notes" "text",
    "tags" "text"[],
    "question_text_hi" "text",
    "explanation_hi" "text",
    "distractor_notes_hi" "text",
    "options_hi" "jsonb",
    "correct_answer" "text",
    "usage_scope" "text" DEFAULT 'both'::"text" NOT NULL,
    CONSTRAINT "questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "questions_language_check" CHECK (("language" = ANY (ARRAY['hi'::"text", 'en'::"text"]))),
    CONSTRAINT "questions_question_type_check" CHECK (("question_type" = ANY (ARRAY['single_mcq'::"text", 'multiple_select'::"text", 'true_false'::"text", 'numerical'::"text", 'passage'::"text"]))),
    CONSTRAINT "questions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'review'::"text", 'published'::"text", 'archived'::"text"]))),
    CONSTRAINT "questions_usage_scope_check" CHECK (("usage_scope" = ANY (ARRAY['both'::"text", 'practice_only'::"text", 'test_only'::"text"])))
);


ALTER TABLE "public"."questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "referred_id" "uuid" NOT NULL,
    "referrer_coins_awarded" integer DEFAULT 50 NOT NULL,
    "referred_coins_awarded" integer DEFAULT 20 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_bookmarks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "chapter_id" "uuid",
    "resource_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "student_bookmarks_item_type_check" CHECK (("item_type" = ANY (ARRAY['chapter'::"text", 'resource'::"text", 'question'::"text"])))
);


ALTER TABLE "public"."student_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "plan_id" "text" DEFAULT 'free'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_attempts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "submitted_at" timestamp with time zone,
    "time_spent_seconds" integer DEFAULT 0,
    "total_questions" integer DEFAULT 0,
    "attempted_count" integer DEFAULT 0,
    "correct_count" integer DEFAULT 0,
    "incorrect_count" integer DEFAULT 0,
    "skipped_with_e_count" integer DEFAULT 0,
    "blank_penalty_count" integer DEFAULT 0,
    "score" numeric(6,2) DEFAULT 0.00,
    "max_score" numeric(6,2) DEFAULT 0.00,
    "percentage" numeric(5,2) DEFAULT 0.00,
    "coins_awarded" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "remaining_seconds" integer,
    "current_question_index" integer DEFAULT 0,
    "state_json" "jsonb" DEFAULT '{}'::"jsonb",
    "paused_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "answers" "jsonb" DEFAULT '{}'::"jsonb",
    "completed_at" timestamp with time zone,
    "total_score" numeric,
    "total_marks" numeric,
    CONSTRAINT "test_attempts_status_check" CHECK (("status" = ANY (ARRAY['in_progress'::"text", 'completed'::"text", 'abandoned'::"text"])))
);


ALTER TABLE "public"."test_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "test_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "display_order" integer DEFAULT 1,
    "marks" numeric(4,2) DEFAULT 1.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."test_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."test_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "attempt_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "selected_answers" "text"[] DEFAULT ARRAY[]::"text"[],
    "is_marked_for_review" boolean DEFAULT false,
    "is_correct" boolean,
    "marks_obtained" numeric(4,2) DEFAULT 0.00,
    "time_spent_seconds" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."test_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "folder_id" "uuid",
    "chapter_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "instructions" "text",
    "pattern_type" "text" DEFAULT 'bpsc_mandatory_e_penalty'::"text",
    "options_count" integer DEFAULT 5,
    "positive_marks" numeric(4,2) DEFAULT 1.00,
    "negative_marks" numeric(4,2) DEFAULT 0.33,
    "unattempted_e_penalty" numeric(4,2) DEFAULT 0.33,
    "duration_mins" integer DEFAULT 60,
    "attempt_limit" integer DEFAULT 3,
    "is_free" boolean DEFAULT true,
    "coin_reward_enabled" boolean DEFAULT true,
    "status" "text" DEFAULT 'published'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "duration_minutes" integer DEFAULT 60,
    "duration" integer DEFAULT 60,
    "unattempted_penalty" numeric DEFAULT 0.25,
    "blank_penalty" numeric DEFAULT 0.25,
    "question_pattern" "text" DEFAULT 'bpsc_mandatory_option_e'::"text",
    "pattern" "text" DEFAULT 'bpsc_mandatory_option_e'::"text",
    "rewards_enabled" boolean DEFAULT true,
    "availability" "text" DEFAULT 'draft'::"text",
    "total_marks" numeric DEFAULT 0,
    "passing_marks" numeric DEFAULT 0,
    "mandatory_option_e_penalty" numeric DEFAULT 0.25,
    "option_e_penalty" numeric DEFAULT 0.25,
    "solution_mode" "text" DEFAULT 'after_submit'::"text",
    CONSTRAINT "tests_options_count_check" CHECK (("options_count" = ANY (ARRAY[4, 5]))),
    CONSTRAINT "tests_pattern_type_check" CHECK (("pattern_type" = ANY (ARRAY['standard_4_opt'::"text", 'bpsc_classic_5_opt'::"text", 'bpsc_mandatory_e_penalty'::"text"]))),
    CONSTRAINT "tests_solution_mode_check" CHECK (("solution_mode" = ANY (ARRAY['after_submit'::"text", 'immediate'::"text"]))),
    CONSTRAINT "tests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_access" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "text" NOT NULL,
    "order_id" "uuid",
    "grant_source" "text" DEFAULT 'purchase'::"text",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"(),
    "granted_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_access_grant_source_check" CHECK (("grant_source" = ANY (ARRAY['purchase'::"text", 'admin_override'::"text", 'free_promo'::"text", 'bundle'::"text"]))),
    CONSTRAINT "user_access_item_type_check" CHECK (("item_type" = ANY (ARRAY['exam'::"text", 'folder'::"text", 'chapter'::"text"]))),
    CONSTRAINT "user_access_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."user_access" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."chapter_resources"
    ADD CONSTRAINT "chapter_resources_display_order_nonnegative" CHECK (("display_order" >= 0)) NOT VALID;



ALTER TABLE "public"."chapter_resources"
    ADD CONSTRAINT "chapter_resources_page_count_positive" CHECK ((("page_count" IS NULL) OR ("page_count" > 0))) NOT VALID;



ALTER TABLE ONLY "public"."chapter_resources"
    ADD CONSTRAINT "chapter_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."chapter_resources"
    ADD CONSTRAINT "chapter_resources_status_allowed" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'unpublished'::"text", 'archived'::"text", 'active'::"text", 'live'::"text", 'available'::"text"]))) NOT VALID;



ALTER TABLE "public"."chapters"
    ADD CONSTRAINT "chapters_display_order_nonnegative" CHECK (("display_order" >= 0)) NOT VALID;



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_folder_id_slug_key" UNIQUE ("folder_id", "slug");



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."chapters"
    ADD CONSTRAINT "chapters_price_nonnegative" CHECK ((("price" IS NULL) OR ("price" >= (0)::numeric))) NOT VALID;



ALTER TABLE "public"."chapters"
    ADD CONSTRAINT "chapters_status_allowed" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'unpublished'::"text", 'archived'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"]))) NOT VALID;



ALTER TABLE "public"."chapters"
    ADD CONSTRAINT "chapters_study_time_positive" CHECK (("estimated_study_time_minutes" > 0)) NOT VALID;



ALTER TABLE ONLY "public"."coin_ledger"
    ADD CONSTRAINT "coin_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coin_wallets"
    ADD CONSTRAINT "coin_wallets_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."coin_wallets"
    ADD CONSTRAINT "coin_wallets_user_id_key" UNIQUE ("user_id");



ALTER TABLE "public"."exams"
    ADD CONSTRAINT "exams_display_order_nonnegative" CHECK (("display_order" >= 0)) NOT VALID;



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exams"
    ADD CONSTRAINT "exams_slug_key" UNIQUE ("slug");



ALTER TABLE "public"."exams"
    ADD CONSTRAINT "exams_status_allowed" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'unpublished'::"text", 'archived'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"]))) NOT VALID;



ALTER TABLE "public"."folders"
    ADD CONSTRAINT "folders_display_order_nonnegative" CHECK (("display_order" >= 0)) NOT VALID;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_exam_id_parent_id_slug_key" UNIQUE ("exam_id", "parent_id", "slug");



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."folders"
    ADD CONSTRAINT "folders_price_nonnegative" CHECK ((("price" IS NULL) OR ("price" >= (0)::numeric))) NOT VALID;



ALTER TABLE "public"."folders"
    ADD CONSTRAINT "folders_status_allowed" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'unpublished'::"text", 'archived'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_razorpay_order_id_key" UNIQUE ("razorpay_order_id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_key_unique" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("setting_key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referral_code_unique" UNIQUE ("referral_code");



ALTER TABLE "public"."questions"
    ADD CONSTRAINT "questions_difficulty_allowed" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."questions"
    ADD CONSTRAINT "questions_status_allowed" CHECK (("status" = ANY (ARRAY['draft'::"text", 'review'::"text", 'published'::"text", 'unpublished'::"text", 'archived'::"text", 'active'::"text", 'live'::"text", 'available'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referred_id_key" UNIQUE ("referred_id");



ALTER TABLE ONLY "public"."student_bookmarks"
    ADD CONSTRAINT "student_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_bookmarks"
    ADD CONSTRAINT "student_bookmarks_user_id_item_type_item_id_key" UNIQUE ("user_id", "item_type", "item_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_attempts"
    ADD CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."test_questions"
    ADD CONSTRAINT "test_questions_display_order_nonnegative" CHECK (("display_order" >= 0)) NOT VALID;



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_test_id_question_id_key" UNIQUE ("test_id", "question_id");



ALTER TABLE ONLY "public"."test_responses"
    ADD CONSTRAINT "test_responses_attempt_id_question_id_key" UNIQUE ("attempt_id", "question_id");



ALTER TABLE ONLY "public"."test_responses"
    ADD CONSTRAINT "test_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_attempt_limit_positive" CHECK (("attempt_limit" > 0)) NOT VALID;



ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_duration_positive" CHECK (("duration_minutes" > 0)) NOT VALID;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_folder_id_slug_key" UNIQUE ("folder_id", "slug");



ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_negative_marks_nonnegative" CHECK (("negative_marks" >= (0)::numeric)) NOT VALID;



ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_option_e_penalty_nonnegative" CHECK (("mandatory_option_e_penalty" >= (0)::numeric)) NOT VALID;



ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_pattern_allowed" CHECK (("pattern" = ANY (ARRAY['standard-4'::"text", 'bpsc-classic-5'::"text", 'bpsc-mandatory-e'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_positive_marks_positive" CHECK (("positive_marks" > (0)::numeric)) NOT VALID;



ALTER TABLE "public"."tests"
    ADD CONSTRAINT "tests_status_allowed" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'scheduled'::"text", 'paused'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'archived'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."user_access"
    ADD CONSTRAINT "user_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_access"
    ADD CONSTRAINT "user_access_user_id_item_type_item_id_key" UNIQUE ("user_id", "item_type", "item_id");



ALTER TABLE ONLY "public"."user_access"
    ADD CONSTRAINT "user_access_user_item_unique" UNIQUE ("user_id", "item_type", "item_id");



CREATE INDEX "idx_chapter_resources_chapter_order" ON "public"."chapter_resources" USING "btree" ("chapter_id", "display_order");



CREATE INDEX "idx_chapters_folder_order" ON "public"."chapters" USING "btree" ("folder_id", "display_order");



CREATE INDEX "idx_folders_exam_order" ON "public"."folders" USING "btree" ("exam_id", "display_order");



CREATE INDEX "idx_folders_parent" ON "public"."folders" USING "btree" ("parent_folder_id");



CREATE INDEX "idx_payment_orders_gateway_order" ON "public"."payment_orders" USING "btree" ("gateway_order_id");



CREATE INDEX "idx_payment_orders_user_created" ON "public"."payment_orders" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_profiles_referral_code" ON "public"."profiles" USING "btree" ("referral_code");



CREATE INDEX "idx_questions_chapter_status" ON "public"."questions" USING "btree" ("chapter_id", "status");



CREATE INDEX "idx_referrals_referred_id" ON "public"."referrals" USING "btree" ("referred_id");



CREATE INDEX "idx_referrals_referrer_id" ON "public"."referrals" USING "btree" ("referrer_id");



CREATE INDEX "idx_student_bookmarks_user_chapter" ON "public"."student_bookmarks" USING "btree" ("user_id", "chapter_id");



CREATE INDEX "idx_student_bookmarks_user_resource" ON "public"."student_bookmarks" USING "btree" ("user_id", "resource_id");



CREATE INDEX "idx_test_questions_question" ON "public"."test_questions" USING "btree" ("question_id");



CREATE INDEX "idx_test_questions_test_order" ON "public"."test_questions" USING "btree" ("test_id", "display_order");



CREATE INDEX "idx_tests_chapter_status" ON "public"."tests" USING "btree" ("chapter_id", "status");



CREATE INDEX "idx_user_access_lookup" ON "public"."user_access" USING "btree" ("user_id", "item_type", "item_id", "is_active", "status");



CREATE OR REPLACE TRIGGER "chapter_resources_set_updated_at" BEFORE UPDATE ON "public"."chapter_resources" FOR EACH ROW EXECUTE FUNCTION "public"."set_content_updated_at"();



CREATE OR REPLACE TRIGGER "chapters_set_updated_at" BEFORE UPDATE ON "public"."chapters" FOR EACH ROW EXECUTE FUNCTION "public"."set_content_updated_at"();



CREATE OR REPLACE TRIGGER "exams_set_updated_at" BEFORE UPDATE ON "public"."exams" FOR EACH ROW EXECUTE FUNCTION "public"."set_content_updated_at"();



CREATE OR REPLACE TRIGGER "folders_set_updated_at" BEFORE UPDATE ON "public"."folders" FOR EACH ROW EXECUTE FUNCTION "public"."set_content_updated_at"();



CREATE OR REPLACE TRIGGER "questions_set_updated_at" BEFORE UPDATE ON "public"."questions" FOR EACH ROW EXECUTE FUNCTION "public"."set_content_updated_at"();



CREATE OR REPLACE TRIGGER "test_questions_set_updated_at" BEFORE UPDATE ON "public"."test_questions" FOR EACH ROW EXECUTE FUNCTION "public"."set_content_updated_at"();



CREATE OR REPLACE TRIGGER "tests_set_updated_at" BEFORE UPDATE ON "public"."tests" FOR EACH ROW EXECUTE FUNCTION "public"."set_content_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_folder_parent_id" BEFORE INSERT OR UPDATE ON "public"."folders" FOR EACH ROW EXECUTE FUNCTION "public"."sync_folder_parent_id"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."chapter_resources"
    ADD CONSTRAINT "chapter_resources_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chapters"
    ADD CONSTRAINT "chapters_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coin_ledger"
    ADD CONSTRAINT "coin_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."coin_ledger"
    ADD CONSTRAINT "coin_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coin_transactions"
    ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coin_wallets"
    ADD CONSTRAINT "coin_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE NOT VALID;



ALTER TABLE ONLY "public"."folders"
    ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_orders"
    ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."questions"
    ADD CONSTRAINT "questions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_bookmarks"
    ADD CONSTRAINT "student_bookmarks_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_bookmarks"
    ADD CONSTRAINT "student_bookmarks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "public"."chapter_resources"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_bookmarks"
    ADD CONSTRAINT "student_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_attempts"
    ADD CONSTRAINT "test_attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_attempts"
    ADD CONSTRAINT "test_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_questions"
    ADD CONSTRAINT "test_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_responses"
    ADD CONSTRAINT "test_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."test_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_responses"
    ADD CONSTRAINT "test_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tests"
    ADD CONSTRAINT "tests_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_access"
    ADD CONSTRAINT "user_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_access"
    ADD CONSTRAINT "user_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can read profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin_user"());



CREATE POLICY "Admins can update platform settings" ON "public"."platform_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view all referrals" ON "public"."referrals" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins full access to chapters" ON "public"."chapters" USING ("public"."is_admin_user"());



CREATE POLICY "Admins full access to exams" ON "public"."exams" USING ("public"."is_admin_user"());



CREATE POLICY "Admins full access to folders" ON "public"."folders" USING ("public"."is_admin_user"());



CREATE POLICY "Admins manage all bookmarks" ON "public"."student_bookmarks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage chapter resources" ON "public"."chapter_resources" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage chapters" ON "public"."chapters" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage exams" ON "public"."exams" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage folders" ON "public"."folders" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage payment orders" ON "public"."payment_orders" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage questions" ON "public"."questions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage resources" ON "public"."chapter_resources" USING ("public"."is_admin_user"());



CREATE POLICY "Admins manage test attempts" ON "public"."test_attempts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage test questions" ON "public"."test_questions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage tests" ON "public"."tests" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins manage user_access" ON "public"."user_access" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "Admins read questions" ON "public"."questions" FOR SELECT TO "authenticated" USING ("public"."is_admin_user"());



CREATE POLICY "Admins read test questions" ON "public"."test_questions" FOR SELECT TO "authenticated" USING ("public"."is_admin_user"());



CREATE POLICY "Anyone can read platform settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Authenticated manage questions" ON "public"."questions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated manage test_questions" ON "public"."test_questions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated manage tests" ON "public"."tests" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can insert referrals" ON "public"."referrals" FOR INSERT WITH CHECK ((("auth"."uid"() = "referred_id") OR ("auth"."uid"() = "referrer_id")));



CREATE POLICY "Only admins can update platform settings" ON "public"."platform_settings" USING ("public"."is_admin_user"());



CREATE POLICY "Only admins can view and insert audit logs" ON "public"."audit_logs" USING ("public"."is_admin_user"());



CREATE POLICY "Public can view published chapters" ON "public"."chapters" FOR SELECT USING ((("status" = 'published'::"text") OR "public"."is_admin_user"()));



CREATE POLICY "Public can view published exams" ON "public"."exams" FOR SELECT USING ((("status" = 'published'::"text") OR "public"."is_admin_user"()));



CREATE POLICY "Public can view published folders" ON "public"."folders" FOR SELECT USING ((("status" = 'published'::"text") OR "public"."is_admin_user"()));



CREATE POLICY "Public read published resources" ON "public"."chapter_resources" FOR SELECT USING ((("status" = 'published'::"text") OR "public"."is_admin_user"()));



CREATE POLICY "Public read questions" ON "public"."questions" FOR SELECT USING (true);



CREATE POLICY "Public read subscriptions" ON "public"."subscriptions" FOR SELECT USING (true);



CREATE POLICY "Public read test questions map" ON "public"."test_questions" FOR SELECT USING (true);



CREATE POLICY "Published chapter resources are readable" ON "public"."chapter_resources" FOR SELECT TO "authenticated", "anon" USING ((("status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."chapters" "c"
  WHERE (("c"."id" = "chapter_resources"."chapter_id") AND ("c"."status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"])))))));



CREATE POLICY "Published chapters are readable" ON "public"."chapters" FOR SELECT TO "authenticated", "anon" USING ((("status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"])) AND (EXISTS ( SELECT 1
   FROM ("public"."folders" "f"
     JOIN "public"."exams" "e" ON (("e"."id" = "f"."exam_id")))
  WHERE (("f"."id" = "chapters"."folder_id") AND ("f"."status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"])) AND ("e"."status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"])))))));



CREATE POLICY "Published exams are readable" ON "public"."exams" FOR SELECT TO "authenticated", "anon" USING (("status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"])));



CREATE POLICY "Published folders are readable" ON "public"."folders" FOR SELECT TO "authenticated", "anon" USING ((("status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."exams" "e"
  WHERE (("e"."id" = "folders"."exam_id") AND ("e"."status" = ANY (ARRAY['published'::"text", 'active'::"text", 'live'::"text", 'available'::"text", 'coming-soon'::"text", 'coming_soon'::"text"])))))));



CREATE POLICY "Published tests are readable" ON "public"."tests" FOR SELECT TO "authenticated", "anon" USING ((("status" = ANY (ARRAY['published'::"text", 'live'::"text", 'available'::"text"])) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))))));



CREATE POLICY "Questions in published tests are readable" ON "public"."test_questions" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."tests" "t"
  WHERE (("t"."id" = "test_questions"."test_id") AND ("t"."status" = ANY (ARRAY['published'::"text", 'live'::"text", 'available'::"text"]))))));



CREATE POLICY "Students can view their own attempts" ON "public"."test_attempts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Students manage own bookmarks" ON "public"."student_bookmarks" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users access own attempts or admin all" ON "public"."test_attempts" USING ((("auth"."uid"() = "user_id") OR "public"."is_admin_user"()));



CREATE POLICY "Users access own responses or admin all" ON "public"."test_responses" USING ((EXISTS ( SELECT 1
   FROM "public"."test_attempts" "a"
  WHERE (("a"."id" = "test_responses"."attempt_id") AND (("a"."user_id" = "auth"."uid"()) OR "public"."is_admin_user"())))));



CREATE POLICY "Users can read own coin ledger" ON "public"."coin_ledger" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own coin transactions" ON "public"."coin_transactions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own coin wallet" ON "public"."coin_wallets" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own basic profile" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR "public"."is_admin_user"()));



CREATE POLICY "Users can update own safe profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile or admins view all" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_admin_user"()));



CREATE POLICY "Users can view their own referrals" ON "public"."referrals" FOR SELECT USING ((("auth"."uid"() = "referrer_id") OR ("auth"."uid"() = "referred_id")));



CREATE POLICY "Users insert own pending orders" ON "public"."payment_orders" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (("status" IS NULL) OR ("status" = 'pending'::"text"))));



CREATE POLICY "Users read own payment orders" ON "public"."payment_orders" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read own user_access" ON "public"."user_access" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users view own coin ledger or admins view all" ON "public"."coin_ledger" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin_user"()));



CREATE POLICY "Users view own wallet or admins view all" ON "public"."coin_wallets" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_admin_user"()));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapter_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chapters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coin_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coin_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coin_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_access" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_adjust_user_coins"("p_target_user_id" "uuid", "p_amount" integer, "p_action" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_adjust_user_coins"("p_target_user_id" "uuid", "p_amount" integer, "p_action" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_adjust_user_coins"("p_target_user_id" "uuid", "p_amount" integer, "p_action" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_grant_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_grant_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_grant_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_grant_user_access"("p_target_user_id" "uuid", "p_item_type" "text", "p_item_id" "uuid", "p_duration_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."admin_grant_user_access"("p_target_user_id" "uuid", "p_item_type" "text", "p_item_id" "uuid", "p_duration_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_grant_user_access"("p_target_user_id" "uuid", "p_item_type" "text", "p_item_id" "uuid", "p_duration_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."admin_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."admin_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_user_role"("p_target_user_id" "uuid", "p_new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_access"("p_user_id" "uuid", "p_item_type" "text", "p_item_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_referral_code"("p_ref_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_referral_code"("p_ref_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_referral_code"("p_ref_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_successful_checkout"("p_order_id" "uuid", "p_razorpay_payment_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_successful_checkout"("p_order_id" "uuid", "p_razorpay_payment_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_successful_checkout"("p_order_id" "uuid", "p_razorpay_payment_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_successful_checkout"("p_order_id" "text", "p_payment_id" "text", "p_payment_signature" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."complete_successful_checkout"("p_order_id" "text", "p_payment_id" "text", "p_payment_signature" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "text", "p_coins_to_redeem" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "text", "p_coins_to_redeem" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "text", "p_coins_to_redeem" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "uuid", "p_redeem_coins" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "uuid", "p_redeem_coins" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_checkout_order"("p_item_type" "text", "p_item_id" "uuid", "p_redeem_coins" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_live_test_questions"("p_test_id" "uuid", "p_attempt_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_live_test_questions"("p_test_id" "uuid", "p_attempt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_live_test_questions"("p_test_id" "uuid", "p_attempt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_practice_questions"("p_chapter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_practice_questions"("p_chapter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_practice_questions"("p_chapter_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_published_question_metadata"("p_question_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_published_question_metadata"("p_question_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_published_question_metadata"("p_question_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_single_question_feedback"("p_test_id" "uuid", "p_question_id" "uuid", "p_selected_option" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_single_question_feedback"("p_test_id" "uuid", "p_question_id" "uuid", "p_selected_option" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_test_attempt_result"("p_attempt_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_test_attempt_result"("p_attempt_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_test_attempt_result"("p_attempt_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."save_test_attempt_progress"("p_attempt_id" "uuid", "p_status" "text", "p_remaining_seconds" integer, "p_current_question_index" integer, "p_state_json" "jsonb", "p_violation_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."save_test_attempt_progress"("p_attempt_id" "uuid", "p_status" "text", "p_remaining_seconds" integer, "p_current_question_index" integer, "p_state_json" "jsonb", "p_violation_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_test_attempt_progress"("p_attempt_id" "uuid", "p_status" "text", "p_remaining_seconds" integer, "p_current_question_index" integer, "p_state_json" "jsonb", "p_violation_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_content_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_content_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_content_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."start_test_attempt"("p_test_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."start_test_attempt"("p_test_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_test_attempt"("p_test_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_test_attempt"("p_attempt_id" "uuid", "p_responses" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_test_attempt"("p_attempt_id" "uuid", "p_responses" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_test_attempt"("p_attempt_id" "uuid", "p_responses" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_test_attempt"("p_attempt_id" "uuid", "p_responses" "jsonb") TO "anon";



GRANT ALL ON FUNCTION "public"."sync_folder_parent_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_folder_parent_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_folder_parent_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_chapter_access"("p_user_id" "uuid", "p_chapter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_chapter_access"("p_user_id" "uuid", "p_chapter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_chapter_access"("p_user_id" "uuid", "p_chapter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_folder_access"("p_user_id" "uuid", "p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_folder_access"("p_user_id" "uuid", "p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_folder_access"("p_user_id" "uuid", "p_folder_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."chapter_resources" TO "anon";
GRANT ALL ON TABLE "public"."chapter_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."chapter_resources" TO "service_role";



GRANT ALL ON TABLE "public"."chapters" TO "anon";
GRANT ALL ON TABLE "public"."chapters" TO "authenticated";
GRANT ALL ON TABLE "public"."chapters" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coin_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."coin_ledger" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coin_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."coin_transactions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."coin_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."coin_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."exams" TO "anon";
GRANT ALL ON TABLE "public"."exams" TO "authenticated";
GRANT ALL ON TABLE "public"."exams" TO "service_role";



GRANT ALL ON TABLE "public"."folders" TO "anon";
GRANT ALL ON TABLE "public"."folders" TO "authenticated";
GRANT ALL ON TABLE "public"."folders" TO "service_role";



GRANT ALL ON TABLE "public"."payment_orders" TO "anon";
GRANT ALL ON TABLE "public"."payment_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_orders" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT UPDATE("full_name") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("preferred_language") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("theme") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("target_exams") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("daily_goal_target") ON TABLE "public"."profiles" TO "authenticated";



GRANT UPDATE("onboarding_completed") ON TABLE "public"."profiles" TO "authenticated";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."questions" TO "anon";
GRANT ALL ON TABLE "public"."questions" TO "authenticated";
GRANT ALL ON TABLE "public"."questions" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."student_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."student_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."student_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."test_attempts" TO "anon";
GRANT ALL ON TABLE "public"."test_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."test_attempts" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."test_questions" TO "anon";
GRANT ALL ON TABLE "public"."test_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."test_questions" TO "service_role";



GRANT ALL ON TABLE "public"."test_responses" TO "anon";
GRANT ALL ON TABLE "public"."test_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."test_responses" TO "service_role";



GRANT ALL ON TABLE "public"."tests" TO "anon";
GRANT ALL ON TABLE "public"."tests" TO "authenticated";
GRANT ALL ON TABLE "public"."tests" TO "service_role";



GRANT ALL ON TABLE "public"."user_access" TO "anon";
GRANT ALL ON TABLE "public"."user_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_access" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







