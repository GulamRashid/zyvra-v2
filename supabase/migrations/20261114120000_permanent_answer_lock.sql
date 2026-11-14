-- Migration: 20261114120000_permanent_answer_lock.sql
-- Enforces permanent first-selection answer locking, idempotency, and anti-tamper protections.

-- 1. RPC: submit_question_answer
-- Safely records and permanently locks an answer for a question in a test attempt.
-- Idempotent: Repeated submissions with the same answer succeed without error.
-- Conflict: Submissions with a different answer are rejected.
CREATE OR REPLACE FUNCTION public.submit_question_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_option text
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

  v_clean_selected := upper(nullif(btrim(p_selected_option), ''));
  IF v_clean_selected IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'A valid selected option is required.'
    );
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

  -- Extract existing answers map
  v_existing_answers := coalesce(v_attempt.state_json->'answers', '{}'::jsonb);
  v_existing_option := upper(nullif(btrim(v_existing_answers->>p_question_id::text), ''));

  SELECT * INTO v_test
  FROM public.tests
  WHERE id = v_attempt.test_id;

  v_solution_mode := lower(coalesce(v_test.solution_mode, ''));

  -- Fetch question details
  SELECT q.* INTO v_question
  FROM public.questions q
  WHERE q.id = p_question_id
  LIMIT 1;

  v_correct_answer := upper(nullif(btrim(v_question.correct_answer), ''));
  v_is_correct := (v_clean_selected = v_correct_answer);

  -- Check if already locked
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
          'locked', true,
          'idempotent', true,
          'question_id', p_question_id,
          'selected_option', v_clean_selected
        );
      END IF;
    ELSE
      -- Different answer on an already locked question is strictly rejected
      RETURN jsonb_build_object(
        'allowed', false,
        'locked', true,
        'error', 'Answer is permanently locked and cannot be modified.',
        'locked_option', v_existing_option
      );
    END IF;
  END IF;

  -- Lock the new answer in state_json->'answers'
  v_existing_answers := jsonb_set(
    v_existing_answers,
    ARRAY[p_question_id::text],
    to_jsonb(v_clean_selected),
    true
  );

  UPDATE public.test_attempts
  SET state_json = jsonb_set(coalesce(state_json, '{}'::jsonb), '{answers}', v_existing_answers, true),
      updated_at = now()
  WHERE id = p_attempt_id;

  IF v_solution_mode = 'immediate' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'locked', true,
      'idempotent', false,
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
      'locked', true,
      'idempotent', false,
      'question_id', p_question_id,
      'selected_option', v_clean_selected
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_question_answer(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_question_answer(uuid, uuid, text) TO authenticated, service_role;


-- 2. Update save_test_attempt_progress to preserve permanently locked answers
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
  v_locked_answers jsonb;
  v_merged_answers jsonb;
  v_final_state jsonb;
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

  -- Ensure existing locked answers cannot be modified or cleared by incoming state_json
  v_locked_answers := coalesce(v_attempt.state_json->'answers', '{}'::jsonb);
  v_merged_answers := coalesce(p_state_json->'answers', '{}'::jsonb) || v_locked_answers;

  v_final_state := coalesce(p_state_json, '{}'::jsonb);
  v_final_state := jsonb_set(v_final_state, '{answers}', v_merged_answers, true);
  v_final_state := v_final_state || jsonb_build_object(
    'violationCount', greatest(coalesce(p_violation_count, 0), 0)
  );

  UPDATE public.test_attempts
  SET status = p_status,
      remaining_seconds = greatest(coalesce(p_remaining_seconds, remaining_seconds, 0), 0),
      current_question_index = greatest(coalesce(p_current_question_index, 0), 0),
      state_json = v_final_state,
      paused_at = CASE WHEN p_status = 'paused' THEN now() ELSE paused_at END,
      updated_at = now()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object('attempt_id', p_attempt_id, 'status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_test_attempt_progress(uuid, text, integer, integer, jsonb, integer)
  TO authenticated, service_role;
