-- Migration: Release stale checkout reservations, allow order cancellation, and safely reconcile payments
-- 1. Adds 'cancelled' to payment_orders status check constraint.
-- 2. Updates create_checkout_order: expires stale orders (>30m) and sums active reserved coins.
-- 3. Creates cancel_checkout_order RPC allowing authenticated users to safely cancel unfulfilled orders.
-- 4. Updates fulfill_checkout_order_atomic to RECONCILE authentic captured payments even if an order was tentatively cancelled or expired.

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

-- Update create_checkout_order
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

  -- Expire any abandoned orders for this user older than 30 minutes to release unspent coins safely
  UPDATE public.payment_orders
  SET status = 'expired',
      updated_at = pg_catalog.now()
  WHERE user_id = v_user_id
    AND status IN ('created', 'pending')
    AND created_at < (pg_catalog.now() - INTERVAL '30 minutes');

  -- Sum reserved coins strictly from active, non-expired, non-cancelled orders within the 30-minute window
  SELECT coalesce(sum(greatest(coins_redeemed, 0)), 0)::INTEGER
  INTO v_reserved_coins
  FROM public.payment_orders
  WHERE user_id = v_user_id
    AND status IN ('created', 'pending')
    AND created_at >= (pg_catalog.now() - INTERVAL '30 minutes')
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

-- Create cancel_checkout_order RPC
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

-- Update fulfill_checkout_order_atomic to safely RECONCILE authentic payments
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
  v_new_balance INTEGER;
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

  v_was_cancelled_or_expired := lower(coalesce(v_order.status, '')) IN ('expired', 'cancelled');

  -- SAFE RECONCILIATION:
  -- If order was marked expired or cancelled, reject ONLY IF fresh trusted payment evidence is missing.
  -- If fresh trusted payment evidence is present (verified payment ID, amount, currency), RECONCILE to paid!
  IF v_was_cancelled_or_expired AND NOT v_has_fresh_payment_evidence THEN
    RETURN jsonb_build_object(
      'success', false,
      'is_cancelled', lower(v_order.status) = 'cancelled',
      'is_expired', lower(v_order.status) = 'expired',
      'error', 'Unverified request cannot fulfill an expired or cancelled order.'
    );
  END IF;

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

  UPDATE public.payment_orders
  SET status = 'paid',
      gateway_payment_id = btrim(p_payment_id),
      razorpay_payment_id = btrim(p_payment_id),
      amount_paid = coalesce(final_amount, amount, 0),
      updated_at = pg_catalog.now()
  WHERE id = v_order.id;

  INSERT INTO public.user_access (
    user_id, item_type, item_id, order_id, grant_source, status, is_active, starts_at, created_at, updated_at
  )
  VALUES (
    v_order.user_id, v_item_type, v_order.item_id::TEXT, v_order.id, 'purchase', 'active', true,
    pg_catalog.now(), pg_catalog.now(), pg_catalog.now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET status = 'active', is_active = true, updated_at = pg_catalog.now();

  v_coins_to_deduct := greatest(coalesce(v_order.coins_redeemed, v_order.coins_used, 0), 0);
  IF v_coins_to_deduct > 0 THEN
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_order.user_id, 0, pg_catalog.now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.coin_wallets
    SET balance = greatest(0, balance - v_coins_to_deduct),
        total_redeemed = coalesce(total_redeemed, 0) + v_coins_to_deduct,
        total_spent = coalesce(total_spent, 0) + v_coins_to_deduct,
        updated_at = pg_catalog.now()
    WHERE user_id = v_order.user_id
    RETURNING balance INTO v_new_balance;

    INSERT INTO public.coin_ledger (
      user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at
    )
    VALUES (
      v_order.user_id, v_coins_to_deduct, 'debit', 'checkout_redemption',
      format('Redeemed %s coins for %s purchase%s', v_coins_to_deduct, v_item_type, CASE WHEN v_was_cancelled_or_expired THEN ' (reconciled)' ELSE '' END),
      v_order.id::TEXT,
      coalesce(v_new_balance, 0),
      pg_catalog.now()
    );

    INSERT INTO public.coin_transactions (
      user_id, amount, transaction_type, description, created_at
    )
    VALUES (
      v_order.user_id, -v_coins_to_deduct, 'debit',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_item_type),
      pg_catalog.now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fulfilled', true,
    'reconciled', v_was_cancelled_or_expired,
    'order_id', v_order.id,
    'coins_deducted', v_coins_to_deduct
  );
END;
$$;

ALTER FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;

-- Update complete_successful_checkout to pass amount and currency for safe reconciliation
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
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_secret TEXT;
  v_gateway_order_id TEXT;
  v_expected_signature TEXT;
  v_is_server BOOLEAN := auth.role() = 'service_role';
  v_amount_paise BIGINT;
  v_currency TEXT;
BEGIN
  IF NOT v_is_server AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_order
  FROM public.payment_orders
  WHERE id::text = p_order_id
     OR gateway_order_id = p_order_id
     OR razorpay_order_id = p_order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found.');
  END IF;

  IF NOT v_is_server AND v_order.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Payment order ownership could not be verified.' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(p_payment_id), '') IS NULL OR nullif(btrim(p_payment_signature), '') IS NULL THEN
    RAISE EXCEPTION 'Payment verification data is incomplete.' USING ERRCODE = '22023';
  END IF;

  v_gateway_order_id := coalesce(
    nullif(btrim(v_order.razorpay_order_id), ''),
    nullif(btrim(v_order.gateway_order_id), '')
  );

  v_secret := current_setting('app.razorpay_key_secret', true);
  IF v_secret IS NOT NULL AND v_secret <> '' THEN
    v_expected_signature := encode(
      hmac(v_gateway_order_id || '|' || btrim(p_payment_id), v_secret, 'sha256'),
      'hex'
    );
    IF lower(v_expected_signature) <> lower(btrim(p_payment_signature)) THEN
      RAISE EXCEPTION 'Payment signature verification failed.' USING ERRCODE = '28000';
    END IF;
  ELSIF NOT v_is_server THEN
    RAISE EXCEPTION 'Direct client-side verification is disabled. Verification must be performed via server API.'
      USING ERRCODE = '38000';
  END IF;

  v_amount_paise := coalesce(
    nullif(v_order.amount_paise, 0),
    round(coalesce(v_order.final_amount, v_order.amount, 0) * 100)::BIGINT
  );
  v_currency := coalesce(nullif(btrim(v_order.currency), ''), 'INR');

  RETURN public.fulfill_checkout_order_atomic(
    v_order.id::TEXT,
    v_gateway_order_id,
    btrim(p_payment_id),
    v_amount_paise,
    v_currency
  );
END;
$$;

ALTER FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO authenticated, service_role;
