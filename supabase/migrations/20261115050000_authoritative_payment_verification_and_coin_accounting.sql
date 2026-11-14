-- Migration: 20261115050000_authoritative_payment_verification_and_coin_accounting.sql
-- Description: Establishes authoritative payment evidence verification, mathematical coin accounting,
-- safe order expiration (preserving in-flight gateway orders), and strict service-role fulfillment.

-- 1. Ensure status check constraint includes all valid order states
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_orders_status_check'
      AND conrelid = 'public.payment_orders'::regclass
  ) THEN
    ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_status_check;
  END IF;

  ALTER TABLE public.payment_orders
    ADD CONSTRAINT payment_orders_status_check
    CHECK (status = ANY (ARRAY[
      'created'::text,
      'pending'::text,
      'paid'::text,
      'captured'::text,
      'failed'::text,
      'refunded'::text,
      'expired'::text,
      'cancelled'::text
    ]));
END $$;

-- 2. Update create_checkout_order with SAFE order expiration and in-flight reservation retention
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_item_type TEXT,
  p_item_id TEXT,
  p_coins_to_redeem INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_clean_type TEXT := lower(btrim(p_item_type));
  v_base_price NUMERIC(10, 2) := 0;
  v_item_title TEXT := '';
  v_coins_per_rupee NUMERIC := 10;
  v_max_discount_pct NUMERIC := 20;
  v_wallet_balance INTEGER := 0;
  v_reserved_coins INTEGER := 0;
  v_max_coins INTEGER := 0;
  v_coins_used INTEGER := 0;
  v_discount NUMERIC(10, 2) := 0;
  v_payable NUMERIC(10, 2) := 0;
  v_amount_paise BIGINT := 0;
  v_order_id UUID;
  v_conf JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_clean_type NOT IN ('folder', 'chapter', 'exam') THEN
    RAISE EXCEPTION 'Invalid item_type: %', p_item_type;
  END IF;
  IF coalesce(p_coins_to_redeem, 0) < 0 THEN
    RAISE EXCEPTION 'Coin redemption cannot be negative';
  END IF;

  IF v_clean_type = 'folder' THEN
    SELECT coalesce(price, effective_price, base_price, 0), coalesce(title, '')
    INTO v_base_price, v_item_title
    FROM public.folders
    WHERE id = p_item_id::UUID;
  ELSIF v_clean_type = 'chapter' THEN
    SELECT coalesce(price, custom_price, 0), coalesce(title, '')
    INTO v_base_price, v_item_title
    FROM public.chapters
    WHERE id = p_item_id::UUID;
  ELSE
    SELECT coalesce(price, pass_price, 0), coalesce(title, '')
    INTO v_base_price, v_item_title
    FROM public.exams
    WHERE id = p_item_id::UUID;
  END IF;

  IF v_base_price <= 0 THEN
    RAISE EXCEPTION 'Item has no price or is free';
  END IF;

  SELECT coalesce(setting_value, value)
  INTO v_conf
  FROM public.platform_settings
  WHERE setting_key = 'coin_redemption_config'
     OR key = 'coin_redemption_config'
  LIMIT 1;

  IF v_conf IS NOT NULL THEN
    v_coins_per_rupee := coalesce((v_conf->>'coins_per_rupee')::NUMERIC, 10);
    v_max_discount_pct := coalesce((v_conf->>'max_discount_percent')::NUMERIC, 20);
  END IF;

  INSERT INTO public.coin_wallets (user_id, balance, updated_at)
  VALUES (v_user_id, 0, pg_catalog.now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT coalesce(balance, 0)::INTEGER
  INTO v_wallet_balance
  FROM public.coin_wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- SAFE EXPIRATION:
  -- Only expire truly abandoned unattempted orders older than 30 minutes that have NO gateway order ID.
  -- Orders with a gateway order ID or in 'pending' state must NEVER be blindly expired in PostgreSQL.
  UPDATE public.payment_orders
  SET status = 'expired',
      updated_at = pg_catalog.now()
  WHERE user_id = v_user_id
    AND status = 'created'
    AND razorpay_order_id IS NULL
    AND gateway_order_id IS NULL
    AND created_at < (pg_catalog.now() - INTERVAL '30 minutes');

  -- Sum reserved coins:
  -- Counts coins from unfulfilled orders within the active 30-minute window, OR any in-flight order
  -- that has a linked gateway order ID (regardless of age, until gateway confirms failure/cancellation).
  SELECT coalesce(sum(greatest(coins_redeemed, 0)), 0)::INTEGER
  INTO v_reserved_coins
  FROM public.payment_orders
  WHERE user_id = v_user_id
    AND status IN ('created', 'pending')
    AND (
      created_at >= (pg_catalog.now() - INTERVAL '30 minutes')
      OR razorpay_order_id IS NOT NULL
      OR gateway_order_id IS NOT NULL
    )
    AND coins_redeemed > 0;

  v_wallet_balance := greatest(v_wallet_balance - v_reserved_coins, 0);
  v_max_coins := least(
    v_wallet_balance,
    floor(v_base_price * (v_max_discount_pct / 100.0) * v_coins_per_rupee)::INTEGER
  );

  IF p_coins_to_redeem > 0 AND v_max_coins > 0 THEN
    v_coins_used := least(p_coins_to_redeem, v_max_coins);
    v_discount := round((v_coins_used::NUMERIC / v_coins_per_rupee), 2);
    v_discount := least(v_base_price, v_discount);
  END IF;

  v_payable := greatest(0, v_base_price - v_discount);
  v_amount_paise := round(v_payable * 100)::BIGINT;

  INSERT INTO public.payment_orders (
    user_id, order_type, item_type, item_id, item_title, tier,
    base_amount, base_price, coins_used, coins_redeemed,
    discount_amount, final_amount, amount, amount_paise, status, currency
  )
  VALUES (
    v_user_id, v_clean_type, v_clean_type, p_item_id, v_item_title, v_clean_type,
    v_base_price, v_base_price, v_coins_used, v_coins_used,
    v_discount, v_payable, v_payable, v_amount_paise, 'created', 'INR'
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

-- 2b. cancel_checkout_order RPC
CREATE OR REPLACE FUNCTION public.cancel_checkout_order(
  p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_server BOOLEAN := auth.role() = 'service_role';
  v_order public.payment_orders%ROWTYPE;
  v_lock_key BIGINT;
BEGIN
  IF nullif(btrim(coalesce(p_order_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order ID is required.');
  END IF;

  IF NOT v_is_server AND v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_lock_key := ('x' || substr(md5(btrim(p_order_id)), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT *
  INTO v_order
  FROM public.payment_orders
  WHERE id::text = btrim(p_order_id)
     OR gateway_order_id = btrim(p_order_id)
     OR razorpay_order_id = btrim(p_order_id)
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found.');
  END IF;

  -- Ensure caller owns the order unless service_role
  IF NOT v_is_server AND v_order.user_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order ownership could not be verified.');
  END IF;

  -- Never cancel an order that is already paid or captured
  IF lower(coalesce(v_order.status, '')) IN ('paid', 'captured') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel an order that is already paid.');
  END IF;

  -- Idempotent return if already cancelled or expired
  IF lower(coalesce(v_order.status, '')) IN ('cancelled', 'expired') THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true, 'status', v_order.status);
  END IF;

  UPDATE public.payment_orders
  SET status = 'cancelled',
      updated_at = pg_catalog.now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object('success', true, 'cancelled', true, 'order_id', v_order.id);
END;
$$;

ALTER FUNCTION public.cancel_checkout_order(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cancel_checkout_order(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_checkout_order(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_checkout_order(TEXT) TO authenticated, service_role;

-- 3. Update fulfill_checkout_order_atomic with strict mathematical coin accounting
CREATE OR REPLACE FUNCTION public.fulfill_checkout_order_atomic(
  p_internal_order_id TEXT,
  p_gateway_order_id TEXT,
  p_payment_id TEXT,
  p_amount_paise BIGINT DEFAULT NULL,
  p_currency TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_stored_payment_id TEXT;
  v_stored_gateway_order_id TEXT;
  v_item_type TEXT;
  v_has_fresh_payment_evidence BOOLEAN := p_amount_paise IS NOT NULL AND p_currency IS NOT NULL;
  v_expected_amount BIGINT;
  v_coins_to_deduct INTEGER := 0;
  v_current_balance INTEGER := 0;
  v_actual_deducted INTEGER := 0;
  v_shortfall INTEGER := 0;
  v_new_balance INTEGER := 0;
  v_lock_order_key BIGINT;
  v_lock_payment_key BIGINT;
  v_was_cancelled_or_expired BOOLEAN := false;
BEGIN
  IF nullif(btrim(coalesce(p_internal_order_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Internal order ID is required.');
  END IF;

  IF nullif(btrim(coalesce(p_payment_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment ID is required.');
  END IF;

  -- Transaction-level advisory locking for order and payment concurrency
  v_lock_order_key := ('x' || substr(md5(p_internal_order_id), 1, 16))::bit(64)::bigint;
  v_lock_payment_key := ('x' || substr(md5(btrim(p_payment_id)), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_order_key);
  PERFORM pg_advisory_xact_lock(v_lock_payment_key);

  SELECT *
  INTO v_order
  FROM public.payment_orders
  WHERE id::text = p_internal_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found.');
  END IF;

  v_was_cancelled_or_expired := lower(coalesce(v_order.status, '')) IN ('expired', 'cancelled', 'failed');

  -- AUTHENTIC EVIDENCE REQUIREMENT:
  -- If order was marked expired, cancelled, or failed, fulfill ONLY IF verified payment evidence is supplied.
  IF v_was_cancelled_or_expired AND NOT v_has_fresh_payment_evidence THEN
    RETURN jsonb_build_object(
      'success', false,
      'is_cancelled', lower(v_order.status) = 'cancelled',
      'is_expired', lower(v_order.status) = 'expired',
      'error', 'Unverified request cannot fulfill an expired or cancelled order.'
    );
  END IF;

  -- Ensure gateway order ID uniqueness across orders
  IF EXISTS (
    SELECT 1
    FROM public.payment_orders other_order
    WHERE other_order.id <> v_order.id
      AND (
        nullif(btrim(other_order.gateway_order_id), '') = btrim(p_gateway_order_id)
        OR nullif(btrim(other_order.razorpay_order_id), '') = btrim(p_gateway_order_id)
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gateway order ID is already bound to another payment order.');
  END IF;

  -- Ensure payment ID uniqueness across orders
  IF EXISTS (
    SELECT 1
    FROM public.payment_orders other_order
    WHERE other_order.id <> v_order.id
      AND (
        nullif(btrim(other_order.gateway_payment_id), '') = btrim(p_payment_id)
        OR nullif(btrim(other_order.razorpay_payment_id), '') = btrim(p_payment_id)
      )
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment ID is already bound to another payment order.');
  END IF;

  IF nullif(btrim(v_order.gateway_order_id), '') IS NOT NULL
     AND nullif(btrim(v_order.razorpay_order_id), '') IS NOT NULL
     AND nullif(btrim(v_order.gateway_order_id), '') IS DISTINCT FROM nullif(btrim(v_order.razorpay_order_id), '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stored gateway order IDs conflict.');
  END IF;

  v_stored_gateway_order_id := coalesce(
    nullif(btrim(v_order.razorpay_order_id), ''),
    nullif(btrim(v_order.gateway_order_id), '')
  );
  IF v_stored_gateway_order_id IS NULL
     OR nullif(btrim(coalesce(p_gateway_order_id, '')), '') IS NULL
     OR (
       nullif(btrim(v_order.razorpay_order_id), '') IS NOT NULL
       AND nullif(btrim(v_order.razorpay_order_id), '') IS DISTINCT FROM btrim(p_gateway_order_id)
     )
     OR (
       nullif(btrim(v_order.gateway_order_id), '') IS NOT NULL
       AND nullif(btrim(v_order.gateway_order_id), '') IS DISTINCT FROM btrim(p_gateway_order_id)
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order association could not be verified.');
  END IF;

  -- Validate amount and currency against expected values
  IF v_has_fresh_payment_evidence THEN
    v_expected_amount := coalesce(
      nullif(v_order.amount_paise, 0),
      round(coalesce(v_order.final_amount, v_order.amount, 0) * 100)::BIGINT
    );

    IF v_expected_amount <= 0
       OR v_expected_amount <> p_amount_paise
       OR upper(coalesce(v_order.currency, 'INR')) <> upper(btrim(coalesce(p_currency, ''))) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Payment amount or currency validation failed.');
    END IF;
  END IF;

  v_item_type := CASE
    WHEN lower(coalesce(v_order.item_type, v_order.order_type, '')) IN ('exam', 'folder', 'chapter')
      THEN lower(coalesce(v_order.item_type, v_order.order_type))
    ELSE 'folder'
  END;

  -- IDEMPOTENCY: Already paid orders return immediately without double coin deduction
  IF lower(coalesce(v_order.status, '')) = 'paid' THEN
    v_stored_payment_id := coalesce(
      nullif(btrim(v_order.razorpay_payment_id), ''),
      nullif(btrim(v_order.gateway_payment_id), '')
    );

    IF v_stored_payment_id IS NULL THEN
      IF NOT v_has_fresh_payment_evidence THEN
        RETURN jsonb_build_object(
          'success', false,
          'needs_reconciliation', true,
          'error', 'Legacy paid order requires trusted payment evidence.'
        );
      END IF;

      UPDATE public.payment_orders
      SET gateway_payment_id = p_payment_id,
          razorpay_payment_id = p_payment_id,
          updated_at = pg_catalog.now()
      WHERE id = v_order.id;
    ELSIF v_stored_payment_id IS DISTINCT FROM btrim(p_payment_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'A different payment is already recorded.');
    END IF;

    INSERT INTO public.user_access (
      user_id, item_type, item_id, order_id, grant_source, status, is_active, starts_at, created_at, updated_at
    )
    VALUES (
      v_order.user_id, v_item_type, v_order.item_id::TEXT, v_order.id, 'purchase', 'active', true,
      pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
    )
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET status = 'active', is_active = true, updated_at = pg_catalog.now();

    RETURN jsonb_build_object(
      'success', true,
      'already_fulfilled', true,
      'reconciled_legacy_order', v_stored_payment_id IS NULL
    );
  END IF;

  -- Transition order to paid
  UPDATE public.payment_orders
  SET status = 'paid',
      gateway_payment_id = btrim(p_payment_id),
      razorpay_payment_id = btrim(p_payment_id),
      amount_paid = coalesce(final_amount, amount, 0),
      updated_at = pg_catalog.now()
  WHERE id = v_order.id;

  -- Grant active access entitlement
  INSERT INTO public.user_access (
    user_id, item_type, item_id, order_id, grant_source, status, is_active, starts_at, created_at, updated_at
  )
  VALUES (
    v_order.user_id, v_item_type, v_order.item_id::TEXT, v_order.id, 'purchase', 'active', true,
    pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET status = 'active', is_active = true, updated_at = pg_catalog.now();

  -- MATHEMATICAL COIN ACCOUNTING:
  -- Wallet balance must mathematically match ledger debits. Never clamp deduction to 0 while claiming full debit.
  v_coins_to_deduct := greatest(coalesce(v_order.coins_redeemed, v_order.coins_used, 0), 0);
  IF v_coins_to_deduct > 0 THEN
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_order.user_id, 0, pg_catalog.now())
    ON CONFLICT (user_id) DO NOTHING;

    -- Explicit row lock on user's wallet
    SELECT coalesce(balance, 0)::INTEGER
    INTO v_current_balance
    FROM public.coin_wallets
    WHERE user_id = v_order.user_id
    FOR UPDATE;

    -- Actual deductible coins strictly clamped to available balance
    v_actual_deducted := least(v_current_balance, v_coins_to_deduct);
    v_shortfall := v_coins_to_deduct - v_actual_deducted;

    IF v_actual_deducted > 0 THEN
      UPDATE public.coin_wallets
      SET balance = balance - v_actual_deducted,
          total_redeemed = coalesce(total_redeemed, 0) + v_actual_deducted,
          total_spent = coalesce(total_spent, 0) + v_actual_deducted,
          updated_at = pg_catalog.now()
      WHERE user_id = v_order.user_id
      RETURNING balance INTO v_new_balance;

      -- Exact mathematical ledger record: balance_before - v_actual_deducted == balance_after
      INSERT INTO public.coin_ledger (
        user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at
      )
      VALUES (
        v_order.user_id, v_actual_deducted, 'debit', 'checkout_redemption',
        format('Redeemed %s coins for %s purchase%s', v_actual_deducted, v_item_type, CASE WHEN v_was_cancelled_or_expired THEN ' (reconciled)' ELSE '' END),
        v_order.id::TEXT,
        v_new_balance,
        pg_catalog.now()
      );

      INSERT INTO public.coin_transactions (
        user_id, amount, transaction_type, description, created_at
      )
      VALUES (
        v_order.user_id, -v_actual_deducted, 'debit',
        format('Redeemed %s coins for %s purchase', v_actual_deducted, v_item_type),
        pg_catalog.now()
      );
    ELSE
      v_new_balance := v_current_balance;
    END IF;

    -- If reserved coins were no longer available (e.g. spent during delayed gateway capture),
    -- record an explicit non-balance-altering audit adjustment entry so ledger is transparent.
    IF v_shortfall > 0 THEN
      INSERT INTO public.coin_ledger (
        user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at
      )
      VALUES (
        v_order.user_id, 0, 'adjustment', 'reconciliation_shortfall',
        format('Late payment reconciliation coin shortfall: %s coins could not be deducted (requested: %s, actual deducted: %s)', v_shortfall, v_coins_to_deduct, v_actual_deducted),
        v_order.id::TEXT,
        v_new_balance,
        pg_catalog.now()
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fulfilled', true,
    'reconciled', v_was_cancelled_or_expired,
    'order_id', v_order.id,
    'coins_deducted', v_actual_deducted,
    'coins_shortfall', v_shortfall
  );
END;
$$;

ALTER FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;

-- 4. Update complete_successful_checkout_webhook RPC
CREATE OR REPLACE FUNCTION public.complete_successful_checkout_webhook(
  p_internal_order_id TEXT,
  p_gateway_order_id TEXT,
  p_payment_id TEXT,
  p_amount_paise BIGINT,
  p_currency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Webhook fulfillment is server-only.' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(p_internal_order_id), '') IS NULL
     OR nullif(btrim(p_gateway_order_id), '') IS NULL
     OR nullif(btrim(p_payment_id), '') IS NULL
     OR p_amount_paise IS NULL
     OR p_amount_paise <= 0
     OR upper(btrim(coalesce(p_currency, ''))) <> 'INR' THEN
    RAISE EXCEPTION 'Webhook payment data is invalid.' USING ERRCODE = '22023';
  END IF;

  RETURN public.fulfill_checkout_order_atomic(
    p_internal_order_id,
    p_gateway_order_id,
    p_payment_id,
    p_amount_paise,
    p_currency
  );
END;
$$;

ALTER FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;

-- 5. Lock down legacy complete_successful_checkout to prevent client-side bypass without gateway proof
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_payment_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
  -- Direct client-side complete_successful_checkout is deprecated and disabled.
  -- Verification must be performed via server API (/api/verify-payment or /api/razorpay-webhook)
  -- which authoritatively verifies payment entity status with Razorpay before fulfillment.
  RAISE EXCEPTION 'Direct database verification is disabled. Payments must be verified via server API.'
    USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO service_role;

-- 6. Coin Shortfall Audit Visibility and Protection
-- Ensure RLS on coin_ledger protects internal shortfall records from student access
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own coin ledger" ON public.coin_ledger;
CREATE POLICY "Users can read own coin ledger"
  ON public.coin_ledger FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND (
      coalesce(source, '') <> 'reconciliation_shortfall'
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
      )
    )
  );

-- Create secure administrative shortfall audit view
CREATE OR REPLACE VIEW public.admin_coin_shortfall_audit_view
WITH (security_barrier = true)
AS
SELECT
  l.id AS ledger_id,
  l.user_id,
  p.full_name AS user_name,
  p.email AS user_email,
  l.amount AS logged_amount,
  l.source,
  l.reason,
  l.reference_id AS order_id,
  l.balance_after,
  l.created_at,
  o.amount_paise,
  o.currency,
  o.gateway_order_id,
  o.gateway_payment_id,
  o.coins_redeemed AS requested_coins,
  o.status AS order_status
FROM public.coin_ledger l
LEFT JOIN public.profiles p ON p.id = l.user_id
LEFT JOIN public.payment_orders o ON o.id::TEXT = l.reference_id
WHERE l.source = 'reconciliation_shortfall'
   OR (l.tx_type = 'adjustment' AND l.reason ILIKE '%shortfall%');

ALTER VIEW public.admin_coin_shortfall_audit_view OWNER TO postgres;
REVOKE ALL ON public.admin_coin_shortfall_audit_view FROM PUBLIC;
REVOKE ALL ON public.admin_coin_shortfall_audit_view FROM anon;
REVOKE ALL ON public.admin_coin_shortfall_audit_view FROM authenticated;
GRANT SELECT ON public.admin_coin_shortfall_audit_view TO service_role;

-- Secure Admin RPC to query shortfalls
CREATE OR REPLACE FUNCTION public.get_admin_coin_shortfall_audit(p_limit INTEGER DEFAULT 100, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  ledger_id UUID,
  user_id UUID,
  amount NUMERIC,
  source TEXT,
  reason TEXT,
  order_id TEXT,
  balance_after NUMERIC,
  created_at TIMESTAMPTZ,
  order_status TEXT,
  gateway_order_id TEXT,
  gateway_payment_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Administrative role required.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    l.id AS ledger_id,
    l.user_id,
    l.amount::NUMERIC,
    l.source,
    l.reason,
    l.reference_id AS order_id,
    l.balance_after::NUMERIC,
    l.created_at,
    o.status AS order_status,
    o.gateway_order_id,
    o.gateway_payment_id
  FROM public.coin_ledger l
  LEFT JOIN public.payment_orders o ON o.id::TEXT = l.reference_id
  WHERE l.source = 'reconciliation_shortfall'
     OR (l.tx_type = 'adjustment' AND l.reason ILIKE '%shortfall%')
  ORDER BY l.created_at DESC
  LIMIT coalesce(p_limit, 100)
  OFFSET coalesce(p_offset, 0);
END;
$$;

ALTER FUNCTION public.get_admin_coin_shortfall_audit(INTEGER, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_admin_coin_shortfall_audit(INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_coin_shortfall_audit(INTEGER, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_coin_shortfall_audit(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_coin_shortfall_audit(INTEGER, INTEGER) TO service_role;
