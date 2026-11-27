-- Global admin toggle for Test Completion Coins (default OFF).
-- Referral coins remain completely separate and unaffected.

INSERT INTO public.platform_settings (key, setting_key, value, setting_value, updated_at)
VALUES (
  'test_completion_coins_enabled',
  'test_completion_coins_enabled',
  'false'::jsonb,
  'false'::jsonb,
  now()
)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.submit_test_attempt(p_attempt_id uuid, p_responses jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_result jsonb;
  v_time_spent integer := 0;
  v_attempt public.test_attempts%ROWTYPE;
  v_test public.tests%ROWTYPE;
  v_coins_awarded integer := 0;
  v_new_balance numeric := 0;
  v_reward_desc text;
  v_setting_raw jsonb;
  v_global_test_coins_enabled boolean := false;
BEGIN
  v_result := public.submit_test_attempt_scoring_base(p_attempt_id, p_responses);

  UPDATE public.test_responses AS r
  SET time_spent_seconds = least(greatest(coalesce(submitted.time_spent_seconds, 0), 0), 3600)
  FROM jsonb_to_recordset(p_responses) AS submitted(question_id uuid, time_spent_seconds integer)
  JOIN public.test_questions AS tq
    ON tq.test_id = (SELECT a.test_id FROM public.test_attempts AS a WHERE a.id = p_attempt_id)
   AND (submitted.question_id = tq.question_id OR submitted.question_id = tq.id)
  WHERE r.attempt_id = p_attempt_id
    AND (r.question_id = tq.question_id OR r.question_id = submitted.question_id);

  SELECT least(coalesce(sum(greatest(coalesce(time_spent_seconds, 0), 0)), 0), 86400)::integer
  INTO v_time_spent
  FROM public.test_responses
  WHERE attempt_id = p_attempt_id;

  UPDATE public.test_attempts
  SET time_spent_seconds = greatest(coalesce(time_spent_seconds, 0), v_time_spent),
      updated_at = now()
  WHERE id = p_attempt_id;

  SELECT * INTO v_attempt FROM public.test_attempts WHERE id = p_attempt_id;
  SELECT * INTO v_test FROM public.tests WHERE id = v_attempt.test_id;

  -- Check global admin toggle (defaults to OFF / false when absent)
  SELECT coalesce(setting_value, value)
  INTO v_setting_raw
  FROM public.platform_settings
  WHERE setting_key = 'test_completion_coins_enabled'
     OR key = 'test_completion_coins_enabled'
  LIMIT 1;

  IF jsonb_typeof(v_setting_raw) = 'boolean' THEN
    v_global_test_coins_enabled := (v_setting_raw)::boolean;
  ELSIF jsonb_typeof(v_setting_raw) = 'object' AND v_setting_raw ? 'enabled' THEN
    v_global_test_coins_enabled := coalesce((v_setting_raw->>'enabled')::boolean, false);
  ELSIF jsonb_typeof(v_setting_raw) = 'string' THEN
    v_global_test_coins_enabled := lower(trim(both '"' from v_setting_raw::text)) = 'true';
  ELSE
    v_global_test_coins_enabled := false;
  END IF;

  v_coins_awarded := coalesce(v_attempt.coins_awarded, 0);

  IF v_global_test_coins_enabled = true
     AND v_attempt.user_id IS NOT NULL
     AND coalesce(v_test.coin_reward_enabled, true) = true
     AND v_coins_awarded = 0 THEN
    v_coins_awarded := CASE WHEN coalesce(v_attempt.percentage, 0) >= 70 THEN 15 ELSE 10 END;
    v_reward_desc := 'Test completion reward: ' || coalesce(v_test.title, 'Practice Test') || ' (' || round(coalesce(v_attempt.percentage, 0))::text || '%)';

    UPDATE public.test_attempts
    SET coins_awarded = v_coins_awarded,
        updated_at = now()
    WHERE id = p_attempt_id
      AND coalesce(coins_awarded, 0) = 0;

    IF FOUND THEN
      INSERT INTO public.coin_wallets (user_id, balance, total_earned, updated_at)
      VALUES (v_attempt.user_id, v_coins_awarded, v_coins_awarded, now())
      ON CONFLICT (user_id) DO UPDATE
      SET balance = public.coin_wallets.balance + v_coins_awarded,
          total_earned = coalesce(public.coin_wallets.total_earned, 0) + v_coins_awarded,
          updated_at = now()
      RETURNING balance INTO v_new_balance;

      INSERT INTO public.coin_ledger (
        user_id, amount, tx_type, source, reason, reference_id, balance_after, created_at
      )
      VALUES (
        v_attempt.user_id,
        v_coins_awarded,
        'credit',
        'test_completion',
        v_reward_desc,
        p_attempt_id::text,
        v_new_balance,
        now()
      );

      INSERT INTO public.coin_transactions (
        user_id, amount, transaction_type, description, created_at
      )
      VALUES (
        v_attempt.user_id,
        v_coins_awarded,
        'credit',
        v_reward_desc,
        now()
      );
    ELSE
      SELECT coalesce(coins_awarded, 0) INTO v_coins_awarded FROM public.test_attempts WHERE id = p_attempt_id;
    END IF;
  END IF;

  RETURN v_result || jsonb_build_object('coins_awarded', v_coins_awarded);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb)
  TO anon, authenticated, service_role;
