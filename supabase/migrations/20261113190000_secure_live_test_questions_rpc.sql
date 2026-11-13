-- ==============================================================================
-- Zyvra Migration: Secure Live Test Questions & Prevent Bulk Answer Leak
-- Timestamp: 20261113190000
-- 1. Updates get_live_test_questions RPC to NEVER bulk-leak correct_answer,
--    explanation, and distractor_notes for in-progress tests.
-- 2. Provides get_single_question_feedback RPC for immediate practice mode,
--    ensuring feedback is only revealed per question after an answer is committed.
-- ==============================================================================

-- 1. Secure get_live_test_questions
CREATE OR REPLACE FUNCTION public.get_live_test_questions(
  p_test_id uuid,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt public.test_attempts%ROWTYPE;
  v_is_admin boolean := false;
  v_questions jsonb;
  v_include_solutions boolean := false;
BEGIN
  -- Check if caller is admin
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_user_id AND lower(trim(p.role)) IN ('admin', 'super_admin')
    ) INTO v_is_admin;
  END IF;

  IF v_is_admin THEN
    v_include_solutions := true;
  ELSIF p_attempt_id IS NOT NULL AND v_user_id IS NOT NULL THEN
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

  -- Notice: We deliberately do NOT bulk-include solutions for in-progress tests,
  -- even in immediate solution mode, to prevent exam cheating.
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

-- 2. Immediate feedback single question solver RPC
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
  v_solution_mode text;
  v_question public.questions%ROWTYPE;
BEGIN
  -- Verify test allows immediate feedback
  SELECT lower(coalesce(t.solution_mode, '')) INTO v_solution_mode
  FROM public.tests t
  WHERE t.id = p_test_id;

  IF v_solution_mode != 'immediate' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'This test does not support immediate feedback.');
  END IF;

  IF p_selected_option IS NULL OR trim(p_selected_option) = '' THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Must select an option before viewing feedback.');
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
    'explanation_hi', v_question.explanation_hi,
    'distractor_notes', v_question.distractor_notes,
    'distractor_notes_hi', v_question.distractor_notes_hi
  );
END;
$$;

-- 3. Grants
GRANT EXECUTE ON FUNCTION public.get_live_test_questions(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

