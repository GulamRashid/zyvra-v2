-- ==============================================================================
-- Zyvra Migration: Allow payment_orders and user_access serverless checkout RLS
-- Timestamp: 20261112230000
-- Enables anon & authenticated serverless endpoints to insert/update checkout orders
-- and fulfill user access when service role key falls back to anon or authenticated JWT.
-- ==============================================================================

-- 1. Ensure tables exist
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ensure RLS is active
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

-- 3. Payment Orders RLS Policies for checkout creation & verification
DROP POLICY IF EXISTS "Allow checkout creation of payment orders" ON public.payment_orders;
CREATE POLICY "Allow checkout creation of payment orders"
  ON public.payment_orders FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow checkout updates to payment orders" ON public.payment_orders;
CREATE POLICY "Allow checkout updates to payment orders"
  ON public.payment_orders FOR UPDATE TO anon, authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow checkout reads of payment orders" ON public.payment_orders;
CREATE POLICY "Allow checkout reads of payment orders"
  ON public.payment_orders FOR SELECT TO anon, authenticated
  USING (user_id IS NOT NULL);

-- 4. User Access RLS Policies for entitlement fulfillment & checking
DROP POLICY IF EXISTS "Allow granting of user access" ON public.user_access;
CREATE POLICY "Allow granting of user access"
  ON public.user_access FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow updating user access" ON public.user_access;
CREATE POLICY "Allow updating user access"
  ON public.user_access FOR UPDATE TO anon, authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

DROP POLICY IF EXISTS "Allow reading user access" ON public.user_access;
CREATE POLICY "Allow reading user access"
  ON public.user_access FOR SELECT TO anon, authenticated
  USING (user_id IS NOT NULL);

-- 5. Table Grants
GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_access TO anon, authenticated;

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
