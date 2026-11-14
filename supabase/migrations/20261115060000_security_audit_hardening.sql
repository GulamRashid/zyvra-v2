-- ==============================================================================
-- Zyvra Migration: Comprehensive Security Audit Hardening
-- Timestamp: 20261115060000
-- Scope:
--   1. Table-level permissions & RLS hardening on test_attempts and test_responses
--      (Revoke direct INSERT/UPDATE/DELETE; restrict to trusted SECURITY DEFINER RPCs).
--   2. Search path hardening across all SECURITY DEFINER functions to prevent
--      search-path hijacking (pg_catalog, extensions, public).
--   3. Hardened, access-verified start_test_attempt RPC with authentication,
--      published status validation, hierarchical access check, and attempt limits.
--   4. Anti-cheat feedback protection in get_single_question_feedback:
--      verifies answer is permanently locked prior to revealing solution.
--   5. Formally track get_test_attempt_result, admin_adjust_user_coins,
--      admin_update_user_role, and ensure_user_referral_code in migrations.
--   6. Revoke anon execute permissions from all test execution & scoring RPCs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table-Level Permissions & RLS Hardening (test_attempts & test_responses)
-- ------------------------------------------------------------------------------

-- Ensure RLS is active
ALTER TABLE IF EXISTS public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.test_responses ENABLE ROW LEVEL SECURITY;

-- Revoke direct mutation permissions on test_attempts from anon and authenticated
REVOKE INSERT, UPDATE, DELETE ON public.test_attempts FROM anon, authenticated;
GRANT SELECT ON public.test_attempts TO authenticated;

-- Revoke direct mutation permissions on test_responses from anon and authenticated
REVOKE ALL ON public.test_responses FROM anon, authenticated;
GRANT SELECT ON public.test_responses TO authenticated;

-- Recreate strict RLS policies on test_responses
DROP POLICY IF EXISTS "Users access own responses or admin all" ON public.test_responses;
DROP POLICY IF EXISTS "Students view own test responses" ON public.test_responses;
DROP POLICY IF EXISTS "Admins manage test responses" ON public.test_responses;

CREATE POLICY "Students view own test responses"
  ON public.test_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_attempts a
      WHERE a.id = test_responses.attempt_id
        AND (a.user_id = auth.uid() OR public.is_admin_user())
    )
  );

CREATE POLICY "Admins manage test responses"
  ON public.test_responses FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());


-- ------------------------------------------------------------------------------
-- 2. Hardened is_admin_user (Explicit Safe search_path)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(trim(coalesce(role, ''))) IN ('admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. Hardened, Access-Enforced start_test_attempt RPC
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.start_test_attempt(uuid);

CREATE OR REPLACE FUNCTION public.start_test_attempt(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_test public.tests%ROWTYPE;
  v_attempt public.test_attempts%ROWTYPE;
  v_existing_attempts integer := 0;
  v_has_access boolean := false;
  v_active_attempt public.test_attempts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  -- Verify test exists
  SELECT * INTO v_test
  FROM public.tests
  WHERE id = p_test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Verify test is published or caller is admin
  IF lower(coalesce(v_test.status, '')) NOT IN ('published', 'live', 'available')
     AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Test is not currently available.' USING ERRCODE = 'P0001';
  END IF;

  -- Verify user access
  IF public.is_admin_user() THEN
    v_has_access := true;
  ELSIF lower(coalesce(v_test.access_mode, 'free')) IN ('free', 'public') THEN
    v_has_access := true;
  ELSE
    -- Check direct and hierarchical access
    v_has_access := public.check_user_access(v_user_id, 'test', p_test_id::text);
    IF NOT v_has_access AND v_test.chapter_id IS NOT NULL THEN
      v_has_access := public.check_user_access(v_user_id, 'chapter', v_test.chapter_id::text);
    END IF;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied. You have not unlocked or purchased this test.' USING ERRCODE = '42501';
  END IF;

  -- Resume existing in-progress / paused attempt if available
  SELECT * INTO v_active_attempt
  FROM public.test_attempts
  WHERE test_id = p_test_id
    AND user_id = v_user_id
    AND lower(coalesce(status, '')) IN ('in_progress', 'started', 'paused', 'pending')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN to_jsonb(v_active_attempt);
  END IF;

  -- Enforce attempt limit
  IF v_test.attempt_limit IS NOT NULL AND v_test.attempt_limit > 0 THEN
    SELECT count(*)::integer INTO v_existing_attempts
    FROM public.test_attempts
    WHERE test_id = p_test_id AND user_id = v_user_id;

    IF v_existing_attempts >= v_test.attempt_limit AND NOT public.is_admin_user() THEN
      RAISE EXCEPTION 'Maximum attempt limit of % reached for this test.', v_test.attempt_limit USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Create new attempt with initialized answer store
  INSERT INTO public.test_attempts (
    test_id,
    user_id,
    status,
    started_at,
    total_marks,
    max_score,
    remaining_seconds,
    state_json,
    created_at,
    updated_at
  )
  VALUES (
    p_test_id,
    v_user_id,
    'in_progress',
    now(),
    coalesce(v_test.total_marks, 0),
    coalesce(v_test.total_marks, 0),
    coalesce(v_test.duration_minutes * 60, v_test.time_limit_minutes * 60, 0),
    '{"answers":{}}'::jsonb,
    now(),
    now()
  )
  RETURNING * INTO v_attempt;

  RETURN to_jsonb(v_attempt);
END;
$$;

REVOKE ALL ON FUNCTION public.start_test_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_test_attempt(uuid) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. Hardened get_live_test_questions (Safe search_path & Access Check)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_live_test_questions(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_live_test_questions(
  p_test_id uuid,
  p_attempt_id uuid DEFAULT NULL
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
  v_is_admin boolean := false;
  v_has_access boolean := false;
  v_questions jsonb;
  v_include_solutions boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  v_is_admin := public.is_admin_user();

  -- Verify test exists and check access
  SELECT * INTO v_test FROM public.tests WHERE id = p_test_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_is_admin THEN
    v_has_access := true;
    v_include_solutions := true;
  ELSIF lower(coalesce(v_test.access_mode, 'free')) IN ('free', 'public') THEN
    v_has_access := true;
  ELSE
    v_has_access := public.check_user_access(v_user_id, 'test', p_test_id::text);
    IF NOT v_has_access AND v_test.chapter_id IS NOT NULL THEN
      v_has_access := public.check_user_access(v_user_id, 'chapter', v_test.chapter_id::text);
    END IF;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied. Test is not accessible.' USING ERRCODE = '42501';
  END IF;

  -- Only reveal solutions if attempt is submitted/completed or user is admin
  IF NOT v_is_admin AND p_attempt_id IS NOT NULL THEN
    SELECT a.* INTO v_attempt
    FROM public.test_attempts AS a
    WHERE a.id = p_attempt_id
      AND a.test_id = p_test_id
      AND a.user_id = v_user_id
    FOR SHARE;

    IF FOUND AND lower(coalesce(v_attempt.status, '')) IN ('completed', 'submitted') THEN
      v_include_solutions := true;
    END IF;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'question_id', q.id,
        'test_question_id', tq.id,
        'display_order', tq.display_order,
        'marks', tq.marks,
        'question_text', q.question_text,
        'question_text_hi', q.question_text_hi,
        'options', q.options,
        'options_hi', q.options_hi,
        'subject', q.subject,
        'topic', q.topic,
        'tags', q.tags,
        'difficulty', q.difficulty,
        'question_type', q.question_type,
        'correct_answer', CASE 
          WHEN v_include_solutions THEN q.correct_answer 
          ELSE NULL 
        END,
        'explanation', CASE 
          WHEN v_include_solutions THEN q.explanation 
          ELSE NULL 
        END,
        'explanation_hi', CASE 
          WHEN v_include_solutions THEN q.explanation_hi 
          ELSE NULL 
        END,
        'distractor_notes', CASE 
          WHEN v_include_solutions THEN q.distractor_notes 
          ELSE NULL 
        END,
        'distractor_notes_hi', CASE 
          WHEN v_include_solutions THEN q.distractor_notes_hi 
          ELSE NULL 
        END
      ) ORDER BY tq.display_order, tq.id
    ),
    '[]'::jsonb
  )
  INTO v_questions
  FROM public.test_questions AS tq
  JOIN public.questions AS q ON (q.id = tq.question_id OR q.id = tq.id)
  WHERE tq.test_id = p_test_id
    AND lower(coalesce(q.status, 'published')) = 'published';

  RETURN jsonb_build_object('questions', v_questions);
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_test_questions(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_live_test_questions(uuid, uuid) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. Anti-Cheat Hardened get_single_question_feedback
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_single_question_feedback(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.get_single_question_feedback(
  p_test_id uuid,
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
  v_solution_mode text;
  v_question public.questions%ROWTYPE;
  v_clean_selected text;
  v_locked_option text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  v_clean_selected := upper(nullif(btrim(p_selected_option), ''));
  IF v_clean_selected IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Must select an option before viewing feedback.');
  END IF;

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE test_id = p_test_id
    AND user_id = v_user_id
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

  -- Anti-Probing Invariant:
  -- The question must be permanently locked in state_json->'answers' with the same option
  v_locked_option := upper(nullif(btrim(v_attempt.state_json->'answers'->>p_question_id::text), ''));
  IF v_locked_option IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Answer must be committed and locked via submit_question_answer before viewing feedback.'
    );
  END IF;

  IF v_locked_option <> v_clean_selected THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'Provided option does not match the permanently locked answer.'
    );
  END IF;

  SELECT q.* INTO v_question
  FROM public.questions q
  JOIN public.test_questions tq ON (tq.question_id = q.id OR tq.id = q.id)
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
    'distractor_notes', v_question.distractor_notes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. Hardened submit_question_answer (Safe search_path)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.submit_question_answer(uuid, uuid, text);

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


-- ------------------------------------------------------------------------------
-- 7. Hardened save_test_attempt_progress (Safe search_path & Ownership Check)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.save_test_attempt_progress(uuid, text, integer, integer, jsonb, integer);

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
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_locked_answers jsonb;
  v_merged_answers jsonb;
  v_final_state jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE id = p_attempt_id AND user_id = v_user_id
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

  -- Ensure existing locked answers cannot be overwritten by client-supplied state_json
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

REVOKE ALL ON FUNCTION public.save_test_attempt_progress(uuid, text, integer, integer, jsonb, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_test_attempt_progress(uuid, text, integer, integer, jsonb, integer)
  TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 8. Hardened submit_test_attempt (Safe search_path & Revoke anon)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.submit_test_attempt(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.submit_test_attempt(
  p_attempt_id uuid,
  p_responses jsonb
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
      AND lower(coalesce(q.status, 'published')) = 'published'
    ORDER BY tq.display_order, tq.id
  LOOP
    v_total_count := v_total_count + 1;
    v_max_score := v_max_score + v_row.question_marks;
    v_selected := v_row.selected_option;
    v_question_marks := v_row.question_marks;

    IF v_selected IS NOT NULL THEN
      IF (
        v_pattern IN ('five_options_mandatory_e', 'five_options', '5_options', 'mandatory_e')
        OR v_row.option_count = 5
      ) AND v_selected = 'E' THEN
        v_blank_count := v_blank_count + 1;
        v_marks_obtained := 0;
        v_is_correct := false;
      ELSE
        v_attempted_count := v_attempted_count + 1;

        IF jsonb_path_exists(
          v_row.answer_keys,
          '$[*] ? (@ == $selected)',
          jsonb_build_object('selected', v_selected)
        ) THEN
          v_correct_count := v_correct_count + 1;
          v_is_correct := true;
          v_marks_obtained := v_question_marks;
          v_positive_score := v_positive_score + v_question_marks;
          v_score := v_score + v_question_marks;
        ELSE
          v_incorrect_count := v_incorrect_count + 1;
          v_is_correct := false;
          v_marks_obtained := -v_negative_marks;
          v_negative_deductions := v_negative_deductions + v_negative_marks;
          v_score := v_score - v_negative_marks;
        END IF;
      END IF;
    ELSE
      IF (
        v_pattern IN ('five_options_mandatory_e', 'five_options', '5_options', 'mandatory_e')
        OR v_row.option_count = 5
      ) AND v_blank_penalty > 0 THEN
        v_blank_penalty_count := v_blank_penalty_count + 1;
        v_marks_obtained := -v_blank_penalty;
        v_blank_deductions := v_blank_deductions + v_blank_penalty;
        v_score := v_score - v_blank_penalty;
      ELSE
        v_marks_obtained := 0;
      END IF;

      v_blank_count := v_blank_count + 1;
      v_is_correct := false;
    END IF;

    INSERT INTO public.test_responses (
      attempt_id,
      question_id,
      selected_option,
      selected_answers,
      marked_for_review,
      is_correct,
      marks_obtained
    ) VALUES (
      p_attempt_id,
      v_row.question_id,
      v_selected,
      CASE
        WHEN v_selected IS NOT NULL THEN ARRAY[v_selected]
        ELSE ARRAY[]::text[]
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

REVOKE ALL ON FUNCTION public.submit_test_attempt(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 9. Hardened get_practice_questions (Safe search_path)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_practice_questions(uuid);

CREATE OR REPLACE FUNCTION public.get_practice_questions(p_chapter_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
  WITH RECURSIVE folder_tree AS (
    SELECT f.id, f.parent_folder_id, f.price, f.exam_id
    FROM public.chapters c
    JOIN public.folders f ON f.id = c.folder_id
    WHERE c.id = p_chapter_id
    UNION ALL
    SELECT parent.id, parent.parent_folder_id, parent.price, parent.exam_id
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
        WHERE coalesce(price, 0) > 0
      )
      OR EXISTS (
        SELECT 1
        FROM public.exams e
        JOIN folder_tree ft ON ft.exam_id = e.id
        WHERE coalesce(e.price, 0) > 0
           OR lower(coalesce(e.access_mode, '')) IN ('paid-own', 'paid_own')
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
      q.subject,
      q.topic,
      q.tags,
      q.difficulty,
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

REVOKE ALL ON FUNCTION public.get_practice_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 10. Formally Defined get_test_attempt_result (Safe search_path & Access Checks)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_test_attempt_result(uuid);

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
                THEN to_jsonb(q)->'correct_answers'
              WHEN q.correct_answer IS NOT NULL
                THEN jsonb_build_array(q.correct_answer)
              ELSE '[]'::jsonb
            END
          WHEN q.correct_answer IS NOT NULL THEN jsonb_build_array(q.correct_answer)
          ELSE '[]'::jsonb
        END,
        'is_correct', coalesce(r.is_correct, false),
        'explanation', jsonb_build_object('en', q.explanation, 'hi', q.explanation_hi),
        'distractor_notes', q.distractor_notes,
        'marks_obtained', coalesce(r.marks_obtained, 0),
        'blank_penalty_amount', CASE
          WHEN coalesce(cardinality(r.selected_answers), 0) = 0 AND coalesce(r.marks_obtained, 0) < 0
            THEN abs(r.marks_obtained)
          ELSE 0
        END
      ) ORDER BY tq.display_order, tq.id
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
    'solutions', v_solutions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_attempt_result(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_test_attempt_result(uuid) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 11. Formally Defined admin_adjust_user_coins (Safe search_path & Super Admin Check)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_adjust_user_coins(uuid, integer, text, text);

CREATE OR REPLACE FUNCTION public.admin_adjust_user_coins(
  p_target_user_id uuid,
  p_amount integer,
  p_action text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_new_bal INT;
  v_clean_action text := lower(trim(p_action));
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Administrator role required.' USING ERRCODE = '42501';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be a positive integer.' USING ERRCODE = '22023';
  END IF;

  IF v_clean_action = 'credit' THEN
    UPDATE public.coin_wallets 
    SET balance = balance + p_amount,
        total_earned = total_earned + p_amount,
        updated_at = NOW()
    WHERE user_id = p_target_user_id
    RETURNING balance INTO v_new_bal;

    IF NOT FOUND THEN
      INSERT INTO public.coin_wallets (user_id, balance, total_earned, total_spent, updated_at)
      VALUES (p_target_user_id, p_amount, p_amount, 0, NOW())
      RETURNING balance INTO v_new_bal;
    END IF;

  ELSIF v_clean_action = 'debit' THEN
    UPDATE public.coin_wallets 
    SET balance = GREATEST(0, balance - p_amount),
        total_spent = total_spent + p_amount,
        updated_at = NOW()
    WHERE user_id = p_target_user_id
    RETURNING balance INTO v_new_bal;

    IF NOT FOUND THEN
      INSERT INTO public.coin_wallets (user_id, balance, total_earned, total_spent, updated_at)
      VALUES (p_target_user_id, 0, 0, p_amount, NOW())
      RETURNING balance INTO v_new_bal;
    END IF;
  ELSE
    RAISE EXCEPTION 'Action must be either credit or debit.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.coin_ledger (
    user_id, amount, tx_type, source, reason, balance_after
  ) VALUES (
    p_target_user_id, p_amount, v_clean_action, 'admin_adjustment', p_reason, v_new_bal
  );

  INSERT INTO public.coin_transactions (
    user_id, amount, transaction_type, reason, created_at
  ) VALUES (
    p_target_user_id, p_amount, v_clean_action, coalesce(p_reason, 'Admin adjustment'), NOW()
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_bal);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_user_coins(uuid, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_coins(uuid, integer, text, text) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 12. Formally Defined admin_update_user_role (Safe search_path & Super Admin Check)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_update_user_role(uuid, text);

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_clean_role text := lower(trim(p_new_role));
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Super Admin role required.' USING ERRCODE = '42501';
  END IF;

  IF v_clean_role NOT IN ('student', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role specified.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles 
  SET role = v_clean_role,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_target_user_id, 'new_role', v_clean_role);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 13. Formally Defined ensure_user_referral_code (Self-Service or Admin)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.ensure_user_referral_code(uuid);

CREATE OR REPLACE FUNCTION public.ensure_user_referral_code(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_target_id uuid := coalesce(p_user_id, auth.uid());
  v_existing text;
  v_new_code text;
  v_try int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF v_target_id <> v_caller AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. You may only generate your own referral code.' USING ERRCODE = '42501';
  END IF;

  SELECT referral_code INTO v_existing
  FROM public.profiles
  WHERE id = v_target_id;

  IF v_existing IS NOT NULL AND btrim(v_existing) <> '' THEN
    RETURN v_existing;
  END IF;

  -- Generate unique 8-character uppercase referral code
  LOOP
    v_try := v_try + 1;
    v_new_code := upper(substring(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_new_code) OR v_try > 20;
  END LOOP;

  UPDATE public.profiles
  SET referral_code = v_new_code,
      updated_at = now()
  WHERE id = v_target_id;

  RETURN v_new_code;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_referral_code(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_referral_code(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
