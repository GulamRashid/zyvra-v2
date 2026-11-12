-- ==============================================================================
-- Zyvra Migration: Fix payment_orders order_type and base_amount not-null constraints
-- Timestamp: 20261112233000
-- ==============================================================================

-- 1. Ensure all payment_orders columns exist
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT,
  ADD COLUMN IF NOT EXISTS item_id TEXT,
  ADD COLUMN IF NOT EXISTS item_title TEXT,
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_before_discount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coin_discount_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coin_discount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_redeemed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

-- 2. Drop NOT NULL constraints and set safe defaults on all pricing/metadata columns
DO $$
BEGIN
  -- base_amount
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN base_amount DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN base_amount SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- base_price
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN base_price DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN base_price SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- discount_amount
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN discount_amount DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN discount_amount SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- final_amount
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN final_amount DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN final_amount SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- coins_used
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN coins_used DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN coins_used SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- coins_redeemed
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN coins_redeemed DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN coins_redeemed SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- order_type
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN order_type DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN order_type SET DEFAULT 'direct';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- tier
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN tier DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN tier SET DEFAULT 'standard';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- item_title
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN item_title DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 3. Backfill any existing nulls
UPDATE public.payment_orders
  SET order_type = COALESCE(order_type, item_type, 'direct'),
      base_amount = COALESCE(base_amount, base_price, amount, 0),
      base_price = COALESCE(base_price, base_amount, amount, 0),
      discount_amount = COALESCE(discount_amount, 0),
      final_amount = COALESCE(final_amount, amount, 0),
      coins_used = COALESCE(coins_used, coins_redeemed, 0),
      coins_redeemed = COALESCE(coins_redeemed, coins_used, 0),
      tier = COALESCE(tier, item_type, 'standard'),
      currency = COALESCE(currency, 'INR'),
      status = COALESCE(status, 'created')
  WHERE base_amount IS NULL
     OR base_price IS NULL
     OR order_type IS NULL
     OR final_amount IS NULL
     OR discount_amount IS NULL;

-- 4. Update create_checkout_order RPC to populate all required columns
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_item_type TEXT,
  p_item_id TEXT,
  p_coins_to_redeem INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

NOTIFY pgrst, 'reload schema';
