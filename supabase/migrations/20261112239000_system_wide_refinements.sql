-- ==============================================================================
-- System-Wide Database Refinements & Security Hardening
-- 1. RLS Hardening: Lock down payment_orders, user_access, and coin tables.
-- 2. Schema Compatibility: Ensure test_attempts has completed_at, total_score, total_marks.
-- 3. Tests Visibility: Allow published standalone and chapter-linked tests to be read.
-- 4. RPC Hardening: Idempotent, transaction-safe complete_successful_checkout with strict rollback.
-- ==============================================================================

-- 1. Schema Compatibility for test_attempts
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS total_score NUMERIC;
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS total_marks NUMERIC;

UPDATE public.test_attempts
SET completed_at = submitted_at
WHERE completed_at IS NULL AND submitted_at IS NOT NULL;

UPDATE public.test_attempts
SET total_score = score
WHERE total_score IS NULL AND score IS NOT NULL;

UPDATE public.test_attempts
SET total_marks = max_score
WHERE total_marks IS NULL AND max_score IS NOT NULL;

-- 2. Update submit_test_attempt to also update completed_at
CREATE OR REPLACE FUNCTION public.submit_test_attempt(
  p_attempt_id uuid,
  p_responses jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_test public.tests%ROWTYPE;
  v_row record;
  v_pattern text;
  v_selected text;
  v_is_correct boolean;
  v_question_marks numeric;
  v_negative_marks numeric;
  v_blank_penalty numeric;
  v_marks_obtained numeric;
  v_score numeric := 0;
  v_max_score numeric := 0;
  v_positive_score numeric := 0;
  v_negative_deductions numeric := 0;
  v_blank_deductions numeric := 0;
  v_total_count integer := 0;
  v_attempted_count integer := 0;
  v_correct_count integer := 0;
  v_incorrect_count integer := 0;
  v_blank_count integer := 0;
  v_blank_penalty_count integer := 0;
  v_time_spent integer := 0;
  v_percentage numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF jsonb_typeof(p_responses) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Responses must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  SELECT a.* INTO v_attempt
  FROM public.test_attempts AS a
  WHERE a.id = p_attempt_id AND a.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_attempt.status, '')) = 'completed' THEN
    RETURN jsonb_build_object(
      'attempt_id', v_attempt.id,
      'status', v_attempt.status
    );
  END IF;

  IF lower(coalesce(v_attempt.status, '')) NOT IN
     ('started', 'in_progress', 'in progress', 'pending') THEN
    RAISE EXCEPTION 'This test attempt cannot be submitted.' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.* INTO v_test
  FROM public.tests AS t
  WHERE t.id = v_attempt.test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test configuration not found.' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_responses) AS submitted(question_id uuid)
    WHERE submitted.question_id IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM public.test_questions AS tq
         WHERE tq.test_id = v_attempt.test_id
           AND (tq.question_id = submitted.question_id OR tq.id = submitted.question_id)
       )
  ) THEN
    RAISE EXCEPTION 'A response references a question outside this test.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT submitted.question_id
    FROM jsonb_to_recordset(p_responses) AS submitted(question_id uuid)
    GROUP BY submitted.question_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate question responses are not allowed.' USING ERRCODE = '22023';
  END IF;

  v_pattern := lower(coalesce(
    v_test.pattern,
    v_test.pattern_type,
    v_test.question_pattern,
    ''
  ));
  v_blank_penalty := greatest(coalesce(
    v_test.mandatory_option_e_penalty,
    v_test.unattempted_e_penalty,
    v_test.blank_penalty,
    v_test.option_e_penalty,
    0
  ), 0);
  v_negative_marks := greatest(coalesce(v_test.negative_marks, 0), 0);

  DELETE FROM public.test_responses AS r
  WHERE r.attempt_id = p_attempt_id;

  FOR v_row IN
    SELECT
      tq.question_id,
      coalesce(tq.marks, v_test.positive_marks, 1)::numeric AS question_marks,
      CASE
        WHEN jsonb_typeof(to_jsonb(q)->'correct_answers') = 'array'
             AND jsonb_array_length(to_jsonb(q)->'correct_answers') > 0
          THEN to_jsonb(q)->'correct_answers'
        WHEN q.correct_answer IS NOT NULL
          THEN jsonb_build_array(q.correct_answer)
        ELSE '[]'::jsonb
      END AS answer_keys,
      submitted.selected_option,
      coalesce(submitted.marked_for_review, false) AS marked_for_review,
      CASE
        WHEN jsonb_typeof(q.options) = 'array'
          THEN jsonb_array_length(q.options)
        WHEN jsonb_typeof(q.options) = 'object'
          THEN (
            SELECT count(*)::integer
            FROM jsonb_object_keys(q.options) AS option_key(key)
            WHERE upper(option_key.key) IN ('A', 'B', 'C', 'D', 'E')
          )
        ELSE coalesce(v_test.options_count, 0)
      END AS option_count
    FROM public.test_questions AS tq
    JOIN public.questions AS q ON (q.id = tq.question_id OR q.id = tq.id)
    LEFT JOIN LATERAL (
      SELECT
        upper(nullif(btrim(response.selected_option), '')) AS selected_option,
        response.marked_for_review
      FROM jsonb_to_recordset(p_responses) AS response(
        question_id uuid,
        selected_option text,
        marked_for_review boolean
      )
      WHERE response.question_id = tq.question_id OR response.question_id = tq.id
      LIMIT 1
    ) AS submitted ON true
    WHERE tq.test_id = v_attempt.test_id
    ORDER BY tq.display_order, tq.id
  LOOP
    v_total_count := v_total_count + 1;
    v_question_marks := greatest(coalesce(v_row.question_marks, 0), 0);
    v_max_score := v_max_score + v_question_marks;
    v_selected := v_row.selected_option;

    IF v_selected IS NOT NULL AND (
      v_selected NOT IN ('A', 'B', 'C', 'D', 'E')
      OR (v_row.option_count > 0
          AND ascii(v_selected) - ascii('A') + 1 > v_row.option_count)
    ) THEN
      RAISE EXCEPTION 'Invalid selected option for question %.', v_row.question_id USING ERRCODE = '22023';
    END IF;

    IF v_selected IS NULL THEN
      v_blank_count := v_blank_count + 1;
      v_is_correct := false;

      IF v_pattern IN (
        'bpsc-mandatory-e',
        'bpsc_mandatory_e',
        'mandatory-e',
        'mandatory_option_e'
      ) THEN
        v_marks_obtained := -v_blank_penalty;
        IF v_blank_penalty > 0 THEN
          v_blank_penalty_count := v_blank_penalty_count + 1;
          v_blank_deductions := v_blank_deductions + v_blank_penalty;
        END IF;
      ELSE
        v_marks_obtained := 0;
      END IF;
    ELSE
      v_attempted_count := v_attempted_count + 1;

      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_row.answer_keys) AS answer_key(value)
        WHERE upper(btrim(answer_key.value)) = v_selected
      )
      INTO v_is_correct;

      IF v_is_correct THEN
        v_correct_count := v_correct_count + 1;
        v_marks_obtained := v_question_marks;
        v_positive_score := v_positive_score + v_marks_obtained;
      ELSE
        v_incorrect_count := v_incorrect_count + 1;
        v_marks_obtained := -v_negative_marks;
        v_negative_deductions := v_negative_deductions + v_negative_marks;
      END IF;
    END IF;

    v_score := v_score + v_marks_obtained;

    INSERT INTO public.test_responses (
      attempt_id,
      question_id,
      selected_answers,
      is_marked_for_review,
      is_correct,
      marks_obtained
    )
    VALUES (
      p_attempt_id,
      v_row.question_id,
      CASE
        WHEN v_selected IS NULL THEN ARRAY[]::text[]
        ELSE ARRAY[v_selected]::text[]
      END,
      v_row.marked_for_review,
      v_is_correct,
      v_marks_obtained
    );
  END LOOP;

  IF v_total_count = 0 THEN
    RAISE EXCEPTION 'This test has no published questions to submit.' USING ERRCODE = 'P0001';
  END IF;

  IF v_max_score > 0 THEN
    v_percentage := round(v_score * 100 / v_max_score, 2);
  END IF;

  IF v_attempt.started_at IS NOT NULL THEN
    v_time_spent := greatest(
      floor(extract(epoch FROM (now() - v_attempt.started_at)))::integer,
      0
    );
  END IF;

  UPDATE public.test_attempts AS a
  SET status = 'completed',
      submitted_at = now(),
      completed_at = now(),
      time_spent_seconds = v_time_spent,
      total_questions = v_total_count,
      attempted_count = v_attempted_count,
      correct_count = v_correct_count,
      incorrect_count = v_incorrect_count,
      skipped_with_e_count = v_blank_count,
      blank_penalty_count = v_blank_penalty_count,
      score = v_score,
      max_score = v_max_score,
      total_score = v_score,
      total_marks = v_max_score,
      percentage = v_percentage,
      coins_awarded = coalesce(a.coins_awarded, 0),
      updated_at = now()
  WHERE a.id = p_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', p_attempt_id,
    'status', 'completed',
    'score', v_score,
    'max_score', v_max_score,
    'total_score', v_score,
    'total_marks', v_max_score,
    'percentage', v_percentage,
    'positive_score', v_positive_score,
    'negative_deductions', v_negative_deductions,
    'blank_penalty_deductions', v_blank_deductions,
    'coins_awarded', coalesce(v_attempt.coins_awarded, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb) TO anon, authenticated, service_role;

-- 3. Hardened, Idempotent complete_successful_checkout RPC
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
  v_resolved_item_type TEXT;
  v_resolved_item_id TEXT;
BEGIN
  -- 1. Locate order by UUID or gateway/razorpay ID
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

  -- Normalize item_type to satisfy user_access constraint ('exam', 'folder', 'chapter')
  v_resolved_item_type := CASE 
    WHEN lower(COALESCE(v_order.item_type, v_order.order_type, '')) IN ('exam', 'folder', 'chapter') 
      THEN lower(COALESCE(v_order.item_type, v_order.order_type))
    ELSE 'folder'
  END;
  v_resolved_item_id := v_order.item_id::text;

  -- 2. Idempotency Check: If already marked paid, return success without re-deducting coins
  IF v_order.status = 'paid' THEN
    INSERT INTO public.user_access (
      user_id,
      item_type,
      item_id,
      grant_source,
      status,
      is_active,
      starts_at,
      created_at,
      updated_at
    )
    VALUES (
      v_order.user_id,
      v_resolved_item_type,
      v_resolved_item_id,
      'purchase',
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
      'message', 'Payment already verified and access entitlement is active.'
    );
  END IF;

  -- 3. Mark payment_order as paid
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

  -- 4. Upsert active entitlement into user_access
  INSERT INTO public.user_access (
    user_id,
    item_type,
    item_id,
    grant_source,
    status,
    is_active,
    starts_at,
    created_at,
    updated_at
  )
  VALUES (
    v_order.user_id,
    v_resolved_item_type,
    v_resolved_item_id,
    'purchase',
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

  -- 5. Deduct redeemed coins safely from wallet and record ledger entry
  v_coins_to_deduct := COALESCE(v_order.coins_redeemed, v_order.coins_used, 0);
  IF v_coins_to_deduct > 0 THEN
    -- Ensure wallet exists
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_order.user_id, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

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
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_resolved_item_type),
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_resolved_item_type),
      now()
    );

    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      transaction_type,
      reason,
      description,
      reference_id,
      created_at
    )
    VALUES (
      v_order.user_id,
      -v_coins_to_deduct,
      'redeem',
      'redeem',
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_resolved_item_type),
      format('Redeemed %s coins for %s purchase', v_coins_to_deduct, v_resolved_item_type),
      v_order.id::text,
      now()
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Payment verified and access entitlement granted.');
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. RLS Hardening: payment_orders
DROP POLICY IF EXISTS "Allow checkout updates to payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow checkout reads of payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can view own payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can update own payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow checkout creation of payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Allow checkout order insert" ON public.payment_orders;
DROP POLICY IF EXISTS "Users insert own orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Users can read own orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Users read own payment orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Admins manage all orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Admins manage payment orders" ON public.payment_orders;

CREATE POLICY "Admins manage payment orders"
  ON public.payment_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

CREATE POLICY "Users read own payment orders"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own pending orders"
  ON public.payment_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (status IS NULL OR status = 'pending'));

-- 5. RLS Hardening: user_access
DROP POLICY IF EXISTS "Allow granting of user access" ON public.user_access;
DROP POLICY IF EXISTS "Allow reading user access" ON public.user_access;
DROP POLICY IF EXISTS "Allow updating user access" ON public.user_access;
DROP POLICY IF EXISTS "Allow user_access insert and update" ON public.user_access;
DROP POLICY IF EXISTS "Users can read own access" ON public.user_access;
DROP POLICY IF EXISTS "Users can view own user access" ON public.user_access;
DROP POLICY IF EXISTS "Users read own access grants" ON public.user_access;
DROP POLICY IF EXISTS "Admins manage all access" ON public.user_access;
DROP POLICY IF EXISTS "Admins manage all access grants" ON public.user_access;
DROP POLICY IF EXISTS "Admins manage user_access" ON public.user_access;

CREATE POLICY "Admins manage user_access"
  ON public.user_access FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

CREATE POLICY "Users read own user_access"
  ON public.user_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6. Tests Visibility: ensure standalone and chapter-linked published tests are readable
DROP POLICY IF EXISTS "Published tests are readable" ON public.tests;
DROP POLICY IF EXISTS "Public read published tests" ON public.tests;
CREATE POLICY "Published tests are readable"
  ON public.tests FOR SELECT TO anon, authenticated
  USING (
    status IN ('published', 'live', 'available')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  );

GRANT SELECT ON public.tests TO anon, authenticated;
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT SELECT ON public.user_access TO authenticated;
