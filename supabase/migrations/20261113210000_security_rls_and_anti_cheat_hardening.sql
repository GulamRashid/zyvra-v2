-- Security hardening for student data access, attempt progress, scoring inputs,
-- and Razorpay fulfillment. Sensitive writes remain server-side only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND lower(trim(role)) IN ('admin', 'super_admin')
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Profiles: students may read their own profile and update only safe profile fields.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own safe profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Admins can read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin_user());
CREATE POLICY "Users can update own safe profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
REVOKE ALL ON public.profiles FROM anon;
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone, target_exams, daily_goal_target, theme, language) ON public.profiles TO authenticated;

-- Questions and links must be accessed through answer-filtering RPCs, not direct selects.
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Published questions are readable" ON public.questions;
DROP POLICY IF EXISTS "Published test questions are readable" ON public.test_questions;
DROP POLICY IF EXISTS "Admins read questions" ON public.questions;
DROP POLICY IF EXISTS "Admins read test questions" ON public.test_questions;
CREATE POLICY "Admins read questions"
  ON public.questions FOR SELECT TO authenticated
  USING (public.is_admin_user());
CREATE POLICY "Admins read test questions"
  ON public.test_questions FOR SELECT TO authenticated
  USING (public.is_admin_user());
REVOKE SELECT ON public.questions, public.test_questions FROM anon, authenticated;
GRANT SELECT ON public.questions, public.test_questions TO authenticated;

-- Attempts: clients can read their own attempt, but only RPCs may mutate progress/results.
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can update their own in-progress attempts" ON public.test_attempts;
DROP POLICY IF EXISTS "Students can view their own attempts" ON public.test_attempts;
CREATE POLICY "Students can view their own attempts"
  ON public.test_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.test_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts TO authenticated;

-- Coin balances and ledgers are read-only to students; all writes use trusted RPCs.
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coin_wallets, public.coin_ledger, public.coin_transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.coin_wallets, public.coin_ledger, public.coin_transactions FROM authenticated;
GRANT SELECT ON public.coin_wallets, public.coin_ledger, public.coin_transactions TO authenticated;

-- Secure progress writer used by LiveQuiz pause/background sync.
CREATE OR REPLACE FUNCTION public.save_test_attempt_progress(
  p_attempt_id uuid,
  p_status text,
  p_remaining_seconds integer,
  p_current_question_index integer,
  p_state_json jsonb,
  p_violation_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.save_test_attempt_progress(uuid, text, integer, integer, jsonb, integer)
  TO authenticated;

-- Answer-free practice payload. This replaces direct student question selects.
CREATE OR REPLACE FUNCTION public.get_practice_questions(p_chapter_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE folder_tree AS (
    SELECT f.id, f.parent_folder_id, f.pricing_mode, f.price, f.exam_id
    FROM public.chapters c
    JOIN public.folders f ON f.id = c.folder_id
    WHERE c.id = p_chapter_id
    UNION ALL
    SELECT parent.id, parent.parent_folder_id, parent.pricing_mode, parent.price, parent.exam_id
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
        WHERE lower(coalesce(pricing_mode, 'inherit')) IN ('paid-own', 'paid_own')
          AND coalesce(price, 0) > 0
      )
      OR EXISTS (
        SELECT 1
        FROM public.exams e
        JOIN folder_tree ft ON ft.exam_id = e.id
        WHERE coalesce(e.price, 0) > 0
           OR lower(coalesce(e.access_mode, '')) IN ('paid-own', 'paid_own')
           OR lower(coalesce(e.pricing_mode, '')) IN ('paid-own', 'paid_own')
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
      q.options_hi,
      q.subject,
      q.topic,
      q.tags,
      q.difficulty,
      q.question_type,
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

GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid) TO authenticated;

-- Immediate feedback is limited to the authenticated owner of an active attempt.
CREATE OR REPLACE FUNCTION public.get_single_question_feedback(
  p_test_id uuid,
  p_question_id uuid,
  p_selected_option text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    'explanation_hi', v_question.explanation_hi,
    'distractor_notes', v_question.distractor_notes,
    'distractor_notes_hi', v_question.distractor_notes_hi
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) TO authenticated;

-- Payment fulfillment must be authenticated, owned, and cryptographically verified.
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id text,
  p_payment_id text,
  p_payment_signature text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.complete_successful_checkout(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.complete_successful_checkout(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
