-- Atomic Razorpay fulfillment and payment-order write hardening.
-- This migration is intentionally non-destructive. Duplicate data stops the
-- migration before any unique index or function change is applied.

DO $$
DECLARE
  v_column TEXT;
  v_has_duplicates BOOLEAN;
  v_user_attnum SMALLINT;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.coin_wallets
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate coin_wallets rows exist; reconcile them before applying this migration.'
      USING ERRCODE = '23505',
            HINT = 'Run SELECT user_id, count(*) FROM public.coin_wallets GROUP BY user_id HAVING count(*) > 1 and reconcile manually.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_access
    GROUP BY user_id, item_type, item_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate user_access rows exist; reconcile them before applying this migration.'
      USING ERRCODE = '23505',
            HINT = 'Run SELECT user_id, item_type, item_id, count(*) FROM public.user_access GROUP BY user_id, item_type, item_id HAVING count(*) > 1 and reconcile manually.';
  END IF;

  FOREACH v_column IN ARRAY ARRAY[
    'gateway_order_id',
    'razorpay_order_id',
    'gateway_payment_id',
    'razorpay_payment_id'
  ] LOOP
    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
         FROM public.payment_orders
         WHERE %1$I IS NOT NULL
           AND btrim(%1$I) <> ''''
         GROUP BY %1$I
         HAVING count(*) > 1
       )',
      v_column
    ) INTO v_has_duplicates;

    IF v_has_duplicates THEN
      RAISE EXCEPTION 'Duplicate non-empty payment_orders.% rows exist; reconcile them before applying this migration.', v_column
        USING ERRCODE = '23505',
              HINT = 'Run SELECT ' || v_column || ', count(*) FROM public.payment_orders WHERE ' || v_column || ' IS NOT NULL GROUP BY ' || v_column || ' HAVING count(*) > 1.';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT payment_id
    FROM (
      SELECT id, nullif(btrim(gateway_payment_id), '') AS payment_id
      FROM public.payment_orders
      UNION ALL
      SELECT id, nullif(btrim(razorpay_payment_id), '') AS payment_id
      FROM public.payment_orders
    ) payments
    WHERE payment_id IS NOT NULL
    GROUP BY payment_id
    HAVING count(DISTINCT id) > 1
  ) THEN
    RAISE EXCEPTION 'A payment ID is associated with multiple payment_orders rows; reconcile it before applying this migration.'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT gateway_order_id
    FROM (
      SELECT id, nullif(btrim(gateway_order_id), '') AS gateway_order_id
      FROM public.payment_orders
      UNION ALL
      SELECT id, nullif(btrim(razorpay_order_id), '') AS gateway_order_id
      FROM public.payment_orders
    ) orders
    WHERE gateway_order_id IS NOT NULL
    GROUP BY gateway_order_id
    HAVING count(DISTINCT id) > 1
  ) THEN
    RAISE EXCEPTION 'A gateway order ID is associated with multiple payment_orders rows; reconcile it before applying this migration.'
      USING ERRCODE = '23505';
  END IF;

  SELECT a.attnum
  INTO v_user_attnum
  FROM pg_catalog.pg_attribute a
  WHERE a.attrelid = 'public.coin_wallets'::regclass
    AND a.attname = 'user_id'
    AND NOT a.attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_index i
    WHERE i.indrelid = 'public.coin_wallets'::regclass
      AND i.indisunique
      AND i.indnkeyatts = 1
      AND i.indkey[0] = v_user_attnum
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX coin_wallets_user_id_unique ON public.coin_wallets (user_id)';
  END IF;
END
$$;

-- Safely align payment_orders status check constraint with all genuine application statuses
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_orders'::regclass
      AND conname = 'payment_orders_status_check'
  ) THEN
    ALTER TABLE public.payment_orders DROP CONSTRAINT payment_orders_status_check;
  END IF;

  ALTER TABLE public.payment_orders
    ADD CONSTRAINT payment_orders_status_check
    CHECK (status = ANY (ARRAY['created'::text, 'pending'::text, 'paid'::text, 'captured'::text, 'failed'::text, 'refunded'::text]));
END $$;

-- Drop insecure and obsolete legacy function overloads before creating new signatures
DROP FUNCTION IF EXISTS public.complete_successful_checkout(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_checkout_order(TEXT, UUID, BOOLEAN);

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_gateway_order_id_unique
  ON public.payment_orders (gateway_order_id)
  WHERE gateway_order_id IS NOT NULL AND btrim(gateway_order_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_razorpay_order_id_unique
  ON public.payment_orders (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL AND btrim(razorpay_order_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_gateway_payment_id_unique
  ON public.payment_orders (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL AND btrim(gateway_payment_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_razorpay_payment_id_unique
  ON public.payment_orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL AND btrim(razorpay_payment_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS user_access_user_item_unique_idx
  ON public.user_access (user_id, item_type, item_id);

CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_item_type TEXT,
  p_item_id TEXT,
  p_coins_to_redeem INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
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

  SELECT coalesce(sum(greatest(coins_redeemed, 0)), 0)::INTEGER
  INTO v_reserved_coins
  FROM public.payment_orders
  WHERE user_id = v_user_id
    AND status IN ('created', 'pending')
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

DROP FUNCTION IF EXISTS public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT);

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
  v_item_type TEXT;
  v_coins_to_deduct INTEGER;
  v_new_balance INTEGER;
  v_expected_amount BIGINT;
  v_stored_gateway_order_id TEXT;
  v_stored_payment_id TEXT;
  v_has_fresh_payment_evidence BOOLEAN := p_amount_paise IS NOT NULL;
BEGIN
  IF nullif(btrim(p_internal_order_id), '') IS NULL
     OR nullif(btrim(p_payment_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment verification data is incomplete.');
  END IF;

  SELECT *
  INTO v_order
  FROM public.payment_orders
  WHERE id::text = p_internal_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found.');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_gateway_order_id), 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_payment_id), 0)
  );

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

    -- Actual live schema for coin_ledger:
    -- (user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at)
    INSERT INTO public.coin_ledger (
      user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at
    )
    VALUES (
      v_order.user_id, v_coins_to_deduct, 'debit', 'checkout_discount',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_item_type),
      v_order.id::TEXT,
      coalesce(v_new_balance, 0),
      pg_catalog.now()
    );

    -- Actual live schema for coin_transactions:
    -- (user_id, amount, transaction_type, description, created_at)
    INSERT INTO public.coin_transactions (
      user_id, amount, transaction_type, description, created_at
    )
    VALUES (
      v_order.user_id, -v_coins_to_deduct, 'redeem',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_item_type),
      pg_catalog.now()
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

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
    -- Direct client-side verification requires database-level HMAC configuration.
    -- When unconfigured, fulfillment is restricted to authorized server-side callers.
    RAISE EXCEPTION 'Direct client-side verification is disabled. Verification must be performed via server API.'
      USING ERRCODE = '38000';
  END IF;

  RETURN public.fulfill_checkout_order_atomic(
    v_order.id::TEXT,
    v_gateway_order_id,
    btrim(p_payment_id)
  );
END;
$$;

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

ALTER FUNCTION public.create_checkout_order(TEXT, TEXT, INTEGER) OWNER TO postgres;
ALTER FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) OWNER TO postgres;
ALTER FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT) OWNER TO postgres;

-- Lock down payment_orders: anon has NO access; students can only SELECT own records; all writes via RPC/admin
REVOKE ALL ON public.payment_orders FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payment_orders FROM PUBLIC, authenticated;
GRANT SELECT ON public.payment_orders TO authenticated;

DROP POLICY IF EXISTS "Users insert own pending orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can insert own payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow checkout creation of payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow checkout updates to payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow checkout order insert" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow checkout order update" ON public.payment_orders;

DROP POLICY IF EXISTS "Admins manage payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Admins manage all orders" ON public.payment_orders;
CREATE POLICY "Admins manage payment orders"
  ON public.payment_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Users read own payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can read own orders" ON public.payment_orders;
CREATE POLICY "Users read own payment orders"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_checkout_order(TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_checkout_order(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout_webhook(TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
