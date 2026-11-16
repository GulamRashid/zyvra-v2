-- Repair submitted quiz review payloads, peer comparison, and per-question timing.

-- Keep the established grading logic and wrap it to persist the timing data already
-- submitted by the quiz client.
ALTER FUNCTION public.submit_test_attempt(uuid, jsonb)
  RENAME TO submit_test_attempt_scoring_base;

REVOKE ALL ON FUNCTION public.submit_test_attempt_scoring_base(uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_test_attempt(p_attempt_id uuid, p_responses jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_result jsonb;
  v_time_spent integer := 0;
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

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb)
  TO anon, authenticated, service_role;

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
  v_solutions jsonb := '[]'::jsonb;
  v_total_questions integer := 0;
  v_accuracy numeric := 0;
  v_total_attempts integer := 1;
  v_avg_peer_score numeric := 0;
  v_percentile numeric := 100;
  v_score_diff numeric := 0;
  v_is_admin boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  SELECT coalesce(lower(trim(role)) IN ('admin', 'super_admin'), false)
  INTO v_is_admin
  FROM public.profiles
  WHERE id = v_user_id;
  v_is_admin := coalesce(v_is_admin, false);

  SELECT a.* INTO v_attempt
  FROM public.test_attempts AS a
  WHERE a.id = p_attempt_id AND (a.user_id = v_user_id OR v_is_admin);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Test attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(coalesce(v_attempt.status, '')) NOT IN ('submitted', 'completed', 'graded', 'finished')
     AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Results are available only after the attempt is submitted.' USING ERRCODE = 'P0001';
  END IF;

  SELECT t.* INTO v_test FROM public.tests AS t WHERE t.id = v_attempt.test_id;

  -- Some older rows store the question UUID in test_questions.id instead of
  -- question_id. Resolve either form, then pair responses against both IDs.
  SELECT coalesce(jsonb_agg(
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
        WHEN nullif(r.selected_option, '') IS NOT NULL THEN jsonb_build_array(r.selected_option)
        ELSE '[]'::jsonb
      END,
      'correct_answer', CASE
        WHEN jsonb_typeof(to_jsonb(q)->'correct_answers') = 'array'
             AND jsonb_array_length(to_jsonb(q)->'correct_answers') > 0
          THEN to_jsonb(q)->'correct_answers'->>0
        ELSE q.correct_answer
      END,
      'is_correct', coalesce(r.is_correct, false),
      'marks_obtained', coalesce(r.marks_obtained, 0),
      'time_spent_seconds', coalesce(r.time_spent_seconds, 0)
    ) ORDER BY tq.display_order, tq.id
  ), '[]'::jsonb)
  INTO v_solutions
  FROM public.test_questions AS tq
  JOIN LATERAL (
    SELECT question.*
    FROM public.questions AS question
    WHERE question.id = tq.question_id OR question.id = tq.id
    ORDER BY CASE WHEN question.id = tq.question_id THEN 0 ELSE 1 END
    LIMIT 1
  ) AS q ON true
  LEFT JOIN LATERAL (
    SELECT response.*
    FROM public.test_responses AS response
    WHERE response.attempt_id = p_attempt_id
      AND (response.question_id = tq.question_id OR response.question_id = tq.id OR response.question_id = q.id)
    LIMIT 1
  ) AS r ON true
  WHERE tq.test_id = v_attempt.test_id
    AND lower(coalesce(q.status, 'published')) = 'published';

  v_total_questions := greatest(
    coalesce(nullif(v_attempt.total_questions, 0), jsonb_array_length(v_solutions)),
    jsonb_array_length(v_solutions)
  );

  IF coalesce(v_attempt.attempted_count, 0) > 0 THEN
    v_accuracy := round(coalesce(v_attempt.correct_count, 0) * 100.0 / v_attempt.attempted_count, 2);
  END IF;

  -- Compare against each other student's latest completed attempt. Repeated
  -- attempts by the current student and peers do not inflate the population.
  WITH latest_attempt_per_student AS (
    SELECT DISTINCT ON (a.user_id) a.user_id, coalesce(a.score, 0) AS score
    FROM public.test_attempts AS a
    WHERE a.test_id = v_attempt.test_id
      AND lower(coalesce(a.status, '')) IN ('submitted', 'completed', 'graded', 'finished')
    ORDER BY a.user_id, coalesce(a.submitted_at, a.completed_at, a.created_at) DESC, a.created_at DESC
  ), peers AS (
    SELECT score FROM latest_attempt_per_student WHERE user_id <> v_attempt.user_id
  )
  SELECT count(*)::integer,
         coalesce(round(avg(score)::numeric, 1), coalesce(v_attempt.score, 0)),
         CASE WHEN count(*) > 0
           THEN round((count(*) FILTER (WHERE score <= coalesce(v_attempt.score, 0))::numeric / count(*)::numeric) * 100.0, 1)
           ELSE 100
         END
  INTO v_total_attempts, v_avg_peer_score, v_percentile
  FROM peers;

  v_total_attempts := coalesce(v_total_attempts, 0) + 1;
  v_score_diff := round((coalesce(v_attempt.score, 0) - coalesce(v_avg_peer_score, v_attempt.score))::numeric, 1);

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', v_attempt.test_id,
    'test_title', coalesce(v_test.title, 'Test Result'),
    'score', coalesce(v_attempt.score, 0),
    'total_marks', coalesce(nullif(v_attempt.max_score, 0), v_attempt.total_marks, 0),
    'percentage', coalesce(v_attempt.percentage, 0),
    'accuracy_percentage', v_accuracy,
    'total_questions', v_total_questions,
    'attempted_count', coalesce(v_attempt.attempted_count, 0),
    'correct_count', coalesce(v_attempt.correct_count, 0),
    'incorrect_count', coalesce(v_attempt.incorrect_count, 0),
    'unattempted_count', greatest(v_total_questions - coalesce(v_attempt.attempted_count, 0), 0),
    'skipped_with_e_count', coalesce(v_attempt.skipped_with_e_count, 0),
    'blank_penalty_count', coalesce(v_attempt.blank_penalty_count, 0),
    'time_spent_seconds', coalesce(v_attempt.time_spent_seconds, 0),
    'coins_awarded', coalesce(v_attempt.coins_awarded, 0),
    'peer_stats', jsonb_build_object(
      'total_attempts', v_total_attempts,
      'average_score', v_avg_peer_score,
      'percentile', v_percentile,
      'score_diff', v_score_diff
    ),
    'solutions', v_solutions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_attempt_result(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_test_attempt_result(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_test_peer_benchmarks(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.get_test_attempt_result(p_attempt_id);
  RETURN coalesce(v_result->'peer_stats', '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_test_peer_benchmarks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_test_peer_benchmarks(uuid) TO authenticated, service_role;
