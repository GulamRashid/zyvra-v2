-- ==============================================================================
-- Fix get_live_test_questions RPC functions to include correct_answer & explanations
-- in immediate solution mode, and ensure execute permissions for anon & authenticated.
-- ==============================================================================

-- 1. Drop existing functions to allow altering output signatures cleanly
DROP FUNCTION IF EXISTS public.get_live_test_questions(uuid);
DROP FUNCTION IF EXISTS public.get_live_test_questions(uuid, uuid);

-- 2. get_live_test_questions(p_test_id uuid, p_attempt_id uuid)
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
  v_solution_mode text;
  v_questions jsonb;
  v_include_solutions boolean := false;
BEGIN
  -- Look up test's solution_mode
  SELECT lower(coalesce(t.solution_mode, '')) INTO v_solution_mode
  FROM public.tests t
  WHERE t.id = p_test_id;

  -- If attempt ID is provided, verify attempt ownership if user is logged in
  IF p_attempt_id IS NOT NULL AND v_user_id IS NOT NULL THEN
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

  -- Immediate feedback mode always includes answers & explanations for active practice/test
  IF v_solution_mode = 'immediate' THEN
    v_include_solutions := true;
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

-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_live_test_questions(uuid, uuid) TO anon, authenticated, service_role;

-- 4. Ensure published questions and test_questions remain readable by anon & authenticated
GRANT SELECT ON public.questions TO anon, authenticated;
GRANT SELECT ON public.test_questions TO anon, authenticated;
