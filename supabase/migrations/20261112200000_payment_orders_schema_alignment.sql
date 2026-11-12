-- Align checkout tables with the payment API while preserving legacy RPC columns.
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS item_title text,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS base_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_order_id text,
  ADD COLUMN IF NOT EXISTS gateway_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_signature text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz DEFAULT now();

-- Practice keeps chapter questions in the question bank when their chapter is deleted.
ALTER TABLE public.questions
  ALTER COLUMN chapter_id DROP NOT NULL;

DROP POLICY IF EXISTS "Published questions are readable" ON public.questions;
CREATE POLICY "Published questions are readable"
  ON public.questions FOR SELECT TO anon, authenticated
  USING (status = 'published');
GRANT SELECT ON public.questions TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
