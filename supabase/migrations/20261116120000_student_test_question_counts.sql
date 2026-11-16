-- Expose published test question counts without exposing question links or answer data.
CREATE OR REPLACE FUNCTION public.get_published_test_question_counts(p_test_ids UUID[])
RETURNS TABLE (test_id UUID, question_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.id, COUNT(tq.id)::BIGINT
  FROM public.tests AS t
  LEFT JOIN public.test_questions AS tq ON tq.test_id = t.id
  WHERE t.id = ANY(COALESCE(p_test_ids, ARRAY[]::UUID[]))
    AND lower(COALESCE(t.status, '')) IN ('published', 'live', 'available')
  GROUP BY t.id;
$$;

REVOKE ALL ON FUNCTION public.get_published_test_question_counts(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_published_test_question_counts(UUID[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
