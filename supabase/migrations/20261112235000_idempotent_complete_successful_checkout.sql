-- ==============================================================================
-- Zyvra Migration: Idempotent Payment Fulfillment & Complete Checkout Hardening
-- Timestamp: 20261112235000
-- 1. Ensures coin_wallets, coin_ledger, and coin_transactions tables exist with RLS
-- 2. Updates complete_successful_checkout RPC with strict idempotency (no double coin deduction)
-- 3. Matches orders by internal UUID, razorpay_order_id, or gateway_order_id
-- 4. Grants active entitlement in public.user_access
-- 5. Deducts coins safely and logs to coin_ledger & coin_transactions
-- ==============================================================================

-- 1. Ensure coin_wallets, coin_ledger, and coin_transactions exist before configuring policies
CREATE TABLE IF NOT EXISTS public.coin_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coin_wallets_user_id_key'
  ) THEN
    ALTER TABLE public.coin_wallets ADD CONSTRAINT coin_wallets_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL DEFAULT 'credit',
  reason TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL DEFAULT 'credit',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS and setup user self-service read policies
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own coin wallet" ON public.coin_wallets;
CREATE POLICY "Users can read own coin wallet"
  ON public.coin_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own coin ledger" ON public.coin_ledger;
CREATE POLICY "Users can read own coin ledger"
  ON public.coin_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own coin transactions" ON public.coin_transactions;
CREATE POLICY "Users can read own coin transactions"
  ON public.coin_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.coin_wallets TO anon, authenticated;
GRANT SELECT ON public.coin_ledger TO anon, authenticated;
GRANT SELECT ON public.coin_transactions TO anon, authenticated;

-- 3. IDEMPOTENT complete_successful_checkout RPC
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_payment_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_order_uuid UUID;
  v_coins_to_deduct INTEGER := 0;
BEGIN
  -- Locate order in payment_orders by UUID, razorpay_order_id, or gateway_order_id
  BEGIN
    v_order_uuid := p_order_id::UUID;
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = v_order_uuid
       OR gateway_order_id = p_order_id
       OR razorpay_order_id = p_order_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE gateway_order_id = p_order_id
       OR razorpay_order_id = p_order_id
    LIMIT 1;
  END;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found.');
  END IF;

  -- Idempotency Check: If already paid, do not deduct coins again, just ensure user_access
  IF v_order.status = 'paid' THEN
    INSERT INTO public.user_access (
      user_id,
      item_type,
      item_id,
      status,
      is_active,
      starts_at,
      created_at,
      updated_at
    )
    VALUES (
      v_order.user_id,
      COALESCE(v_order.item_type, v_order.order_type, 'folder'),
      v_order.item_id::text,
      'active',
      true,
      now(),
      now(),
      now()
    )
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET
      status = 'active',
      is_active = true,
      updated_at = now();

    RETURN jsonb_build_object(
      'success', true,
      'already_fulfilled', true,
      'message', 'Payment already verified and access is active.'
    );
  END IF;

  -- Mark payment_order as paid
  UPDATE public.payment_orders
  SET
    status = 'paid',
    gateway_payment_id = COALESCE(p_payment_id, gateway_payment_id),
    razorpay_payment_id = COALESCE(p_payment_id, razorpay_payment_id),
    payment_signature = COALESCE(p_payment_signature, payment_signature),
    razorpay_signature = COALESCE(p_payment_signature, razorpay_signature),
    amount_paid = COALESCE(final_amount, amount, 0),
    updated_at = now()
  WHERE id = v_order.id;

  -- Upsert active entitlement into user_access
  INSERT INTO public.user_access (
    user_id,
    item_type,
    item_id,
    status,
    is_active,
    starts_at,
    created_at,
    updated_at
  )
  VALUES (
    v_order.user_id,
    COALESCE(v_order.item_type, v_order.order_type, 'folder'),
    v_order.item_id::text,
    'active',
    true,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET
    status = 'active',
    is_active = true,
    updated_at = now();

  -- Deduct redeemed coins safely from wallet and record ledger entry
  v_coins_to_deduct := COALESCE(v_order.coins_redeemed, v_order.coins_used, 0);
  IF v_coins_to_deduct > 0 THEN
    UPDATE public.coin_wallets
    SET
      balance = GREATEST(0, balance - v_coins_to_deduct),
      updated_at = now()
    WHERE user_id = v_order.user_id;

    INSERT INTO public.coin_ledger (
      user_id,
      amount,
      transaction_type,
      reason,
      description,
      created_at
    )
    VALUES (
      v_order.user_id,
      -v_coins_to_deduct,
      'redeem',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, COALESCE(v_order.item_type, v_order.order_type, 'content')),
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, COALESCE(v_order.item_type, v_order.order_type, 'content')),
      now()
    );

    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      transaction_type,
      description,
      created_at
    )
    VALUES (
      v_order.user_id,
      -v_coins_to_deduct,
      'redeem',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, COALESCE(v_order.item_type, v_order.order_type, 'content')),
      now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Payment verified and access entitlement granted.');
END;
$$;

-- 4. RPC Grants
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 5. Notify PostgREST schema reload
NOTIFY pgrst, 'reload schema';

