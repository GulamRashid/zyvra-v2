-- Migration: 20261115090000_fix_student_results_and_referral_reward.sql
-- 1. Fix get_test_attempt_result and get_test_peer_benchmarks for regular student accounts
-- 2. Award referral bonus coins to referrer when an invited friend completes a paid course purchase

-- ==============================================================================
-- 1. SECURE & RESILIENT get_test_attempt_result RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_test_attempt_result(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_test public.tests%ROWTYPE;
  v_solutions jsonb;
  v_positive_score numeric := 0;
  v_negative_deductions numeric := 0;
  v_blank_deductions numeric := 0;
  v_accuracy numeric := 0;
  v_percentage numeric := 0;
  v_coins integer := 0;
  v_total_peer_attempts integer := 0;
  v_avg_peer_score numeric := 0;
  v_below_count integer := 0;
  v_peer_percentile numeric := 100;
  v_is_admin boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  -- Safe admin check without failing if profiles row is missing
  BEGIN
    SELECT coalesce(
      (lower(trim(coalesce(role, ''))) IN ('admin', 'super_admin')),
      false
    ) INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;
  v_is_admin := coalesce(v_is_admin, false);

  -- Fetch attempt: allow if owned by caller OR if caller is admin
  SELECT a.* INTO v_attempt
  FROM public.test_attempts AS a
  WHERE a.id = p_attempt_id
    AND (a.user_id = v_user_id OR v_is_admin);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Fetch associated test metadata
  SELECT t.* INTO v_test FROM public.tests AS t WHERE t.id = v_attempt.test_id;

  -- Build solutions array safely
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id', q.id,
        'question', jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'question_text_hi', q.question_text_hi,
          'options', q.options,
          'subject', q.subject,
          'topic', q.topic,
          'tags', q.tags,
          'explanation', q.explanation,
          'explanation_hi', q.explanation_hi
        ),
        'student_selected', CASE
          WHEN coalesce(cardinality(r.selected_answers), 0) > 0 THEN to_jsonb(r.selected_answers)
          ELSE '[]'::jsonb
        END,
        'correct_answer', CASE
          WHEN jsonb_typeof(to_jsonb(q)->'correct_answers') = 'array' THEN
            CASE
              WHEN jsonb_array_length(to_jsonb(q)->'correct_answers') > 0
                THEN to_jsonb(q)->'correct_answers'->>0
              ELSE q.correct_answer
            END
          ELSE q.correct_answer
        END,
        'is_correct', coalesce(r.is_correct, false),
        'marks_obtained', coalesce(r.marks_obtained, 0),
        'time_spent_seconds', coalesce(r.time_spent_seconds, 0)
      )
      ORDER BY coalesce(tq.sequence_order, 9999), tq.id
    ),
    '[]'::jsonb
  )
  INTO v_solutions
  FROM public.test_questions AS tq
  JOIN public.questions AS q ON q.id = tq.question_id
  LEFT JOIN public.test_responses AS r
    ON r.attempt_id = p_attempt_id AND r.question_id = tq.question_id
  WHERE tq.test_id = v_attempt.test_id;

  -- Calculate score deductions safely
  SELECT
    coalesce(sum(CASE WHEN r.is_correct THEN greatest(coalesce(r.marks_obtained, 0), 0) ELSE 0 END), 0),
    coalesce(abs(sum(CASE WHEN coalesce(cardinality(r.selected_answers), 0) > 0 AND NOT coalesce(r.is_correct, false) AND r.marks_obtained < 0 THEN r.marks_obtained ELSE 0 END)), 0),
    coalesce(abs(sum(CASE WHEN coalesce(cardinality(r.selected_answers), 0) = 0 AND r.marks_obtained < 0 THEN r.marks_obtained ELSE 0 END)), 0)
  INTO v_positive_score, v_negative_deductions, v_blank_deductions
  FROM public.test_responses AS r
  WHERE r.attempt_id = p_attempt_id;

  IF coalesce(v_attempt.attempted_count, 0) > 0 THEN
    v_accuracy := round(coalesce(v_attempt.correct_count, 0) * 100.0 / v_attempt.attempted_count, 2);
  END IF;
  v_percentage := coalesce(v_attempt.percentage, 0);
  v_coins := coalesce(v_attempt.coins_awarded, 0);

  -- Compute Peer Benchmarks safely (handles 0 or 1 peer without division by zero or errors)
  BEGIN
    SELECT
      count(*)::integer,
      coalesce(round(avg(score)::numeric, 1), 0),
      count(*) FILTER (WHERE score < coalesce(v_attempt.score, 0))::integer
    INTO v_total_peer_attempts, v_avg_peer_score, v_below_count
    FROM public.test_attempts
    WHERE test_id = v_attempt.test_id
      AND lower(coalesce(status, '')) IN ('submitted', 'completed', 'graded', 'finished');
  EXCEPTION WHEN OTHERS THEN
    v_total_peer_attempts := 1;
    v_avg_peer_score := coalesce(v_attempt.score, 0);
    v_below_count := 0;
  END;

  v_total_peer_attempts := coalesce(v_total_peer_attempts, 1);
  v_avg_peer_score := coalesce(v_avg_peer_score, coalesce(v_attempt.score, 0));
  v_below_count := coalesce(v_below_count, 0);

  IF v_total_peer_attempts > 1 THEN
    v_peer_percentile := round((v_below_count::numeric / (v_total_peer_attempts - 1)::numeric) * 100.0, 1);
  ELSE
    v_peer_percentile := 100;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', v_attempt.test_id,
    'test_title', coalesce(v_test.title, 'Test Result'),
    'score', coalesce(v_attempt.score, 0),
    'total_marks', coalesce(v_attempt.max_score, v_attempt.total_marks, 0),
    'percentage', v_percentage,
    'accuracy_percentage', v_accuracy,
    'positive_score', v_positive_score,
    'negative_deductions', v_negative_deductions,
    'blank_deductions', v_blank_deductions,
    'total_questions', coalesce(v_attempt.total_questions, 0),
    'attempted_count', coalesce(v_attempt.attempted_count, 0),
    'correct_count', coalesce(v_attempt.correct_count, 0),
    'incorrect_count', coalesce(v_attempt.incorrect_count, 0),
    'skipped_with_e_count', coalesce(v_attempt.skipped_with_e_count, 0),
    'blank_penalty_count', coalesce(v_attempt.blank_penalty_count, 0),
    'time_spent_seconds', coalesce(v_attempt.time_spent_seconds, 0),
    'coins_awarded', v_coins,
    'peer_stats', jsonb_build_object(
      'total_attempts', v_total_peer_attempts,
      'average_score', v_avg_peer_score,
      'percentile', v_peer_percentile,
      'score_diff', round((coalesce(v_attempt.score, 0) - v_avg_peer_score)::numeric, 1)
    ),
    'solutions', coalesce(v_solutions, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_attempt_result(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_test_attempt_result(uuid) TO authenticated, service_role;


-- ==============================================================================
-- 2. SECURE & RESILIENT get_test_peer_benchmarks RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_test_peer_benchmarks(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_total_attempts integer := 0;
  v_avg_score numeric := 0;
  v_below_count integer := 0;
  v_percentile numeric := 100;
  v_score_diff numeric := 0;
  v_is_admin boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  BEGIN
    SELECT coalesce(
      (lower(trim(coalesce(role, ''))) IN ('admin', 'super_admin')),
      false
    ) INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;
  v_is_admin := coalesce(v_is_admin, false);

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE id = p_attempt_id AND (user_id = v_user_id OR v_is_admin);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'total_attempts', 1,
      'average_score', 0,
      'percentile', 100,
      'score_diff', 0
    );
  END IF;

  BEGIN
    SELECT
      count(*)::integer,
      coalesce(round(avg(score)::numeric, 1), 0),
      count(*) FILTER (WHERE score < coalesce(v_attempt.score, 0))::integer
    INTO v_total_attempts, v_avg_score, v_below_count
    FROM public.test_attempts
    WHERE test_id = v_attempt.test_id
      AND lower(coalesce(status, '')) IN ('submitted', 'completed', 'graded', 'finished');
  EXCEPTION WHEN OTHERS THEN
    v_total_attempts := 1;
    v_avg_score := coalesce(v_attempt.score, 0);
    v_below_count := 0;
  END;

  v_total_attempts := coalesce(v_total_attempts, 1);
  v_avg_score := coalesce(v_avg_score, coalesce(v_attempt.score, 0));
  v_below_count := coalesce(v_below_count, 0);

  IF v_total_attempts > 1 THEN
    v_percentile := round((v_below_count::numeric / (v_total_attempts - 1)::numeric) * 100.0, 1);
  ELSE
    v_percentile := 100;
  END IF;

  v_score_diff := round((coalesce(v_attempt.score, 0) - v_avg_score)::numeric, 1);

  RETURN jsonb_build_object(
    'total_attempts', v_total_attempts,
    'average_score', v_avg_score,
    'percentile', v_percentile,
    'score_diff', v_score_diff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_peer_benchmarks(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_test_peer_benchmarks(uuid) TO authenticated, service_role;


-- ==============================================================================
-- 3. AWARD REFERRAL BONUS COINS ON PAID COURSE PURCHASE
-- ==============================================================================
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
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_item_type TEXT;
  v_stored_payment_id TEXT;
  v_was_cancelled_or_expired BOOLEAN := false;
  v_coins_to_deduct INTEGER := 0;
  v_current_balance INTEGER := 0;
  v_actual_deducted INTEGER := 0;
  v_shortfall INTEGER := 0;
  v_new_balance INTEGER := 0;
  v_referral RECORD;
  v_ref_bonus INTEGER := 50;
  v_referrer_balance INTEGER := 0;
BEGIN
  -- Strict validation of required payment identity arguments
  IF nullif(btrim(p_internal_order_id), '') IS NULL
     OR nullif(btrim(p_gateway_order_id), '') IS NULL
     OR nullif(btrim(p_payment_id), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order ID, gateway order ID, and payment ID are strictly required.');
  END IF;

  -- Acquire exclusive row lock on payment_order
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE id::TEXT = btrim(p_internal_order_id)
     OR gateway_order_id = btrim(p_gateway_order_id)
     OR razorpay_order_id = btrim(p_gateway_order_id)
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment order not found.');
  END IF;

  -- Normalize item type
  v_item_type := lower(btrim(coalesce(v_order.item_type, v_order.order_type, 'folder')));
  IF v_item_type = 'course' THEN
    v_item_type := 'folder';
  END IF;

  -- Check if already fulfilled
  IF lower(coalesce(v_order.status, '')) = 'paid' THEN
    v_stored_payment_id := nullif(btrim(coalesce(v_order.gateway_payment_id, v_order.razorpay_payment_id, '')), '');
    IF v_stored_payment_id IS NULL THEN
      UPDATE public.payment_orders
      SET gateway_payment_id = btrim(p_payment_id),
          razorpay_payment_id = btrim(p_payment_id),
          updated_at = now()
      WHERE id = v_order.id;
    END IF;

    INSERT INTO public.user_access (
      user_id, item_type, item_id, order_id, grant_source, status, is_active, starts_at, created_at, updated_at
    )
    VALUES (
      v_order.user_id, v_item_type, v_order.item_id::TEXT, v_order.id, 'purchase', 'active', true,
      now(), now(), now()
    )
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET status = 'active', is_active = true, updated_at = now();

    RETURN jsonb_build_object(
      'success', true,
      'already_fulfilled', true
    );
  END IF;

  -- Transition order to paid
  UPDATE public.payment_orders
  SET status = 'paid',
      gateway_payment_id = btrim(p_payment_id),
      razorpay_payment_id = btrim(p_payment_id),
      amount_paid = coalesce(final_amount, amount, 0),
      updated_at = now()
  WHERE id = v_order.id;

  -- Grant active access entitlement
  INSERT INTO public.user_access (
    user_id, item_type, item_id, order_id, grant_source, status, is_active, starts_at, created_at, updated_at
  )
  VALUES (
    v_order.user_id, v_item_type, v_order.item_id::TEXT, v_order.id, 'purchase', 'active', true,
    now(), now(), now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET status = 'active', is_active = true, updated_at = now();

  -- Mathematical Coin Deduction for buyer (if coins were redeemed)
  v_coins_to_deduct := greatest(coalesce(v_order.coins_redeemed, v_order.coins_used, 0), 0);
  IF v_coins_to_deduct > 0 THEN
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_order.user_id, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT coalesce(balance, 0)::INTEGER
    INTO v_current_balance
    FROM public.coin_wallets
    WHERE user_id = v_order.user_id
    FOR UPDATE;

    v_actual_deducted := least(v_current_balance, v_coins_to_deduct);
    v_shortfall := v_coins_to_deduct - v_actual_deducted;

    IF v_actual_deducted > 0 THEN
      UPDATE public.coin_wallets
      SET balance = balance - v_actual_deducted,
          total_redeemed = coalesce(total_redeemed, 0) + v_actual_deducted,
          total_spent = coalesce(total_spent, 0) + v_actual_deducted,
          updated_at = now()
      WHERE user_id = v_order.user_id
      RETURNING balance INTO v_new_balance;

      INSERT INTO public.coin_ledger (
        user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at
      )
      VALUES (
        v_order.user_id, v_actual_deducted, 'debit', 'checkout_redemption',
        format('Redeemed %s coins for %s purchase', v_actual_deducted, v_item_type),
        v_order.id::TEXT,
        v_new_balance,
        now()
      );

      INSERT INTO public.coin_transactions (
        user_id, amount, transaction_type, description, created_at
      )
      VALUES (
        v_order.user_id, -v_actual_deducted, 'debit',
        format('Redeemed %s coins for %s purchase', v_actual_deducted, v_item_type),
        now()
      );
    END IF;
  END IF;

  -- REFERRAL REWARD CREDIT:
  -- If this is a paid purchase (amount > 0), check if the buyer was referred by someone.
  -- Atomically and idempotently credit 50 Zyvra Coins to the referrer's wallet.
  IF coalesce(v_order.amount, v_order.final_amount, 0) > 0 THEN
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE referred_id = v_order.user_id
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND v_referral.referrer_id IS NOT NULL THEN
      -- Idempotency Check: verify reward has not already been credited for this order
      IF NOT EXISTS (
        SELECT 1 FROM public.coin_transactions
        WHERE user_id = v_referral.referrer_id
          AND transaction_type = 'credit'
          AND description LIKE '%' || v_order.id::text || '%'
      ) AND NOT EXISTS (
        SELECT 1 FROM public.coin_ledger
        WHERE user_id = v_referral.referrer_id
          AND reference_id = v_order.id::text
          AND source = 'referral_purchase_reward'
      ) THEN
        -- Ensure referrer wallet exists
        INSERT INTO public.coin_wallets (user_id, balance, total_earned, updated_at)
        VALUES (v_referral.referrer_id, v_ref_bonus, v_ref_bonus, now())
        ON CONFLICT (user_id) DO UPDATE
        SET balance = coin_wallets.balance + v_ref_bonus,
            total_earned = coalesce(coin_wallets.total_earned, 0) + v_ref_bonus,
            updated_at = now()
        RETURNING balance INTO v_referrer_balance;

        -- Record ledger credit
        INSERT INTO public.coin_ledger (
          user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at
        )
        VALUES (
          v_referral.referrer_id,
          v_ref_bonus,
          'credit',
          'referral_purchase_reward',
          format('Referral bonus: invited friend purchased course (Order: %s)', v_order.id::text),
          v_order.id::text,
          v_referrer_balance,
          now()
        );

        -- Record coin transaction
        INSERT INTO public.coin_transactions (
          user_id, amount, transaction_type, description, created_at
        )
        VALUES (
          v_referral.referrer_id,
          v_ref_bonus,
          'credit',
          format('Referral bonus: invited friend purchased course (Order: %s)', v_order.id::text),
          now()
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fulfilled', true,
    'order_id', v_order.id,
    'coins_deducted', v_actual_deducted,
    'coins_shortfall', v_shortfall
  );
END;
$$;

ALTER FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_checkout_order_atomic(TEXT, TEXT, TEXT, BIGINT, TEXT) TO service_role;
