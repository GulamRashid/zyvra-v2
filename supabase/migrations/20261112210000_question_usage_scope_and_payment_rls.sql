ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS usage_scope text NOT NULL DEFAULT 'both';

UPDATE public.questions
SET usage_scope = 'both'
WHERE usage_scope IS NULL;

ALTER TABLE public.questions
  ALTER COLUMN usage_scope SET DEFAULT 'both',
  ALTER COLUMN usage_scope SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_usage_scope_check'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_usage_scope_check
      CHECK (usage_scope IN ('both', 'practice_only', 'test_only'));
  END IF;
END
$$;

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own payment orders" ON public.payment_orders;
CREATE POLICY "Users can insert own payment orders"
  ON public.payment_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders;
CREATE POLICY "Users can view own payment orders"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders;
CREATE POLICY "Users can update own payment orders"
  ON public.payment_orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user access" ON public.user_access;
CREATE POLICY "Users can view own user access"
  ON public.user_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO authenticated;
GRANT SELECT ON public.user_access TO authenticated;

NOTIFY pgrst, 'reload schema';
