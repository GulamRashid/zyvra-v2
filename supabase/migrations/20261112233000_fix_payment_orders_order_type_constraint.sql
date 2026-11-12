-- ==============================================================================
-- Zyvra Migration: Fix payment_orders order_type not-null constraint
-- Timestamp: 20261112233000
-- ==============================================================================

-- 1. Ensure order_type column exists
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT;

-- 2. Drop NOT NULL constraint on order_type if present so future inserts never fail
ALTER TABLE public.payment_orders
  ALTER COLUMN order_type DROP NOT NULL;

-- 3. Set a safe DEFAULT value on order_type
ALTER TABLE public.payment_orders
  ALTER COLUMN order_type SET DEFAULT 'direct';

-- 4. Backfill any existing nulls
UPDATE public.payment_orders
  SET order_type = COALESCE(order_type, item_type, 'direct')
  WHERE order_type IS NULL;

-- 5. Update create_checkout_order RPC to populate both order_type and item_type
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

  -- 1. Fetch authoritative base price
  IF v_clean_type = 'folder' THEN
    SELECT COALESCE(price, 0) INTO v_base_price FROM public.folders WHERE id = p_item_id::UUID;
  ELSIF v_clean_type = 'chapter' THEN
    SELECT COALESCE(price, 0) INTO v_base_price FROM public.chapters WHERE id = p_item_id::UUID;
  ELSIF v_clean_type = 'exam' THEN
    SELECT COALESCE(price, 0) INTO v_base_price FROM public.exams WHERE id = p_item_id::UUID;
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

  -- 4. Create internal payment order with BOTH order_type and item_type populated
  INSERT INTO public.payment_orders (
    user_id,
    order_type,
    item_type,
    item_id,
    amount,
    amount_paise,
    coins_redeemed,
    status,
    currency
  )
  VALUES (
    v_user_id,
    v_clean_type,
    v_clean_type,
    p_item_id,
    v_payable,
    v_amount_paise,
    v_coins_used,
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
      'base_price', v_base_price,
      'coins_used', v_coins_used,
      'discount', v_discount,
      'amount', v_payable,
      'amount_paise', v_amount_paise,
      'currency', 'INR',
      'status', 'created'
    )
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
