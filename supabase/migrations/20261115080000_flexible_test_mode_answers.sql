-- Migration: 20261115080000_flexible_test_mode_answers.sql
-- Enables changing and clearing answers in Test/Exam mode while strictly preserving permanent locks in Practice Mode.
-- Also adds authoritative peer benchmark statistics and tags to test attempt results.

-- 1. Upgrade submit_question_answer
CREATE OR REPLACE FUNCTION public.submit_question_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_test public.tests%ROWTYPE;
  v_question public.questions%ROWTYPE;
  v_existing_answers jsonb;
  v_existing_option text;
  v_clean_selected text;
  v_solution_mode text;
  v_is_correct boolean := false;
  v_correct_answer text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  -- Acquire exclusive row lock on test_attempt
  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE id = p_attempt_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Test attempt not found.'
    );
  END IF;

  IF lower(coalesce(v_attempt.status, '')) IN ('completed', 'submitted') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Cannot submit answers to a completed test.'
    );
  END IF;

  -- Verify question belongs to test
  IF NOT EXISTS (
    SELECT 1 FROM public.test_questions tq
    WHERE tq.test_id = v_attempt.test_id
      AND (tq.question_id = p_question_id OR tq.id = p_question_id)
  ) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Question does not belong to this test.'
    );
  END IF;

  SELECT * INTO v_test
  FROM public.tests
  WHERE id = v_attempt.test_id;

  v_solution_mode := lower(coalesce(v_test.solution_mode, ''));

  -- Extract existing answers map
  v_existing_answers := coalesce(v_attempt.state_json->'answers', '{}'::jsonb);
  v_existing_option := upper(nullif(btrim(v_existing_answers->>p_question_id::text), ''));

  v_clean_selected := upper(nullif(btrim(p_selected_option), ''));

  -- HANDLING NULL / CLEAR RESPONSE:
  IF v_clean_selected IS NULL THEN
    IF v_solution_mode = 'immediate' THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'error', 'Cannot clear answers in Practice Mode.'
      );
    ELSE
      -- In Test/Exam Mode: remove key from answers map
      v_existing_answers := v_existing_answers - p_question_id::text;
      UPDATE public.test_attempts
      SET state_json = jsonb_set(
        coalesce(state_json, '{}'::jsonb),
        '{answers}',
        v_existing_answers
      ),
      updated_at = clock_timestamp()
      WHERE id = p_attempt_id;

      RETURN jsonb_build_object(
        'allowed', true,
        'cleared', true,
        'question_id', p_question_id
      );
    END IF;
  END IF;

  -- Fetch question details
  SELECT q.* INTO v_question
  FROM public.questions q
  WHERE q.id = p_question_id
  LIMIT 1;

  v_correct_answer := upper(nullif(btrim(v_question.correct_answer), ''));
  v_is_correct := (v_clean_selected = v_correct_answer);

  -- Check if already answered
  IF v_existing_option IS NOT NULL THEN
    -- If same answer: idempotent success
    IF v_existing_option = v_clean_selected THEN
      IF v_solution_mode = 'immediate' THEN
        RETURN jsonb_build_object(
          'allowed', true,
          'locked', true,
          'idempotent', true,
          'question_id', p_question_id,
          'selected_option', v_clean_selected,
          'correct_answer', v_question.correct_answer,
          'explanation', v_question.explanation,
          'distractor_notes', v_question.distractor_notes,
          'is_correct', v_is_correct
        );
      ELSE
        RETURN jsonb_build_object(
          'allowed', true,
          'locked', false,
          'idempotent', true,
          'question_id', p_question_id,
          'selected_option', v_clean_selected
        );
      END IF;
    ELSE
      -- Different answer:
      IF v_solution_mode = 'immediate' THEN
        -- Practice Mode: strictly rejected
        RETURN jsonb_build_object(
          'allowed', false,
          'locked', true,
          'error', 'Answer is permanently locked and cannot be modified.',
          'locked_option', v_existing_option
        );
      ELSE
        -- Test / Exam Mode: allow updating selection
        v_existing_answers := jsonb_set(
          v_existing_answers,
          ARRAY[p_question_id::text],
          to_jsonb(v_clean_selected)
        );

        UPDATE public.test_attempts
        SET state_json = jsonb_set(
          coalesce(state_json, '{}'::jsonb),
          '{answers}',
          v_existing_answers
        ),
        updated_at = clock_timestamp()
        WHERE id = p_attempt_id;

        RETURN jsonb_build_object(
          'allowed', true,
          'locked', false,
          'updated', true,
          'question_id', p_question_id,
          'selected_option', v_clean_selected
        );
      END IF;
    END IF;
  END IF;

  -- First-time answering
  v_existing_answers := jsonb_set(
    v_existing_answers,
    ARRAY[p_question_id::text],
    to_jsonb(v_clean_selected)
  );

  UPDATE public.test_attempts
  SET state_json = jsonb_set(
    coalesce(state_json, '{}'::jsonb),
    '{answers}',
    v_existing_answers
  ),
  updated_at = clock_timestamp()
  WHERE id = p_attempt_id;

  IF v_solution_mode = 'immediate' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'locked', true,
      'question_id', p_question_id,
      'selected_option', v_clean_selected,
      'correct_answer', v_question.correct_answer,
      'explanation', v_question.explanation,
      'distractor_notes', v_question.distractor_notes,
      'is_correct', v_is_correct
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', true,
      'locked', false,
      'question_id', p_question_id,
      'selected_option', v_clean_selected
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_question_answer(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_question_answer(uuid, uuid, text) TO authenticated, service_role;


-- 2. Peer Benchmarking RPC
CREATE OR REPLACE FUNCTION public.get_test_peer_benchmarks(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_total_attempts integer := 0;
  v_avg_score numeric := 0;
  v_below_count integer := 0;
  v_percentile numeric := 100;
  v_score_diff numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE id = p_attempt_id AND (user_id = v_user_id OR public.is_admin_user());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT
    count(*)::integer,
    coalesce(round(avg(score)::numeric, 1), 0),
    count(*) FILTER (WHERE score < coalesce(v_attempt.score, 0))::integer
  INTO v_total_attempts, v_avg_score, v_below_count
  FROM public.test_attempts
  WHERE test_id = v_attempt.test_id
    AND lower(coalesce(status, '')) IN ('submitted', 'completed', 'graded', 'finished');

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


-- 3. Upgrade get_test_attempt_result to return tags and peer_stats
CREATE OR REPLACE FUNCTION public.get_test_attempt_result(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT a.* INTO v_attempt
  FROM public.test_attempts AS a
  WHERE a.id = p_attempt_id
    AND (a.user_id = v_user_id OR public.is_admin_user());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_attempt.status, '')) NOT IN ('submitted', 'completed', 'graded', 'finished')
     AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Results are available only after the attempt is submitted.' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.* INTO v_test FROM public.tests AS t WHERE t.id = v_attempt.test_id;

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

  SELECT
    coalesce(sum(CASE WHEN r.is_correct THEN greatest(coalesce(r.marks_obtained, 0), 0) ELSE 0 END), 0),
    coalesce(abs(sum(CASE WHEN coalesce(cardinality(r.selected_answers), 0) > 0 AND NOT coalesce(r.is_correct, false) AND r.marks_obtained < 0 THEN r.marks_obtained ELSE 0 END)), 0),
    coalesce(abs(sum(CASE WHEN coalesce(cardinality(r.selected_answers), 0) = 0 AND r.marks_obtained < 0 THEN r.marks_obtained ELSE 0 END)), 0)
  INTO v_positive_score, v_negative_deductions, v_blank_deductions
  FROM public.test_responses AS r
  WHERE r.attempt_id = p_attempt_id;

  IF coalesce(v_attempt.attempted_count, 0) > 0 THEN
    v_accuracy := round(v_attempt.correct_count * 100.0 / v_attempt.attempted_count, 2);
  END IF;
  v_percentage := coalesce(v_attempt.percentage, 0);
  v_coins := coalesce(v_attempt.coins_awarded, 0);

  -- Compute Peer Benchmarks
  SELECT
    count(*)::integer,
    coalesce(round(avg(score)::numeric, 1), 0),
    count(*) FILTER (WHERE score < coalesce(v_attempt.score, 0))::integer
  INTO v_total_peer_attempts, v_avg_peer_score, v_below_count
  FROM public.test_attempts
  WHERE test_id = v_attempt.test_id
    AND lower(coalesce(status, '')) IN ('submitted', 'completed', 'graded', 'finished');

  IF v_total_peer_attempts > 1 THEN
    v_peer_percentile := round((v_below_count::numeric / (v_total_peer_attempts - 1)::numeric) * 100.0, 1);
  ELSE
    v_peer_percentile := 100;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', v_attempt.test_id,
    'test_title', v_test.title,
    'score', coalesce(v_attempt.score, 0),
    'total_marks', coalesce(v_attempt.max_score, 0),
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
    'solutions', v_solutions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_attempt_result(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_test_attempt_result(uuid) TO authenticated, service_role;
