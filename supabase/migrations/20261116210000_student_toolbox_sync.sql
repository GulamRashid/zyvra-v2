-- Per-student Toolbox state. The browser keeps a local copy for offline use;
-- this row lets the same student's notes, targets and timer follow their account.
CREATE TABLE IF NOT EXISTS public.student_toolbox_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_toolbox_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read their own toolbox data" ON public.student_toolbox_data;
CREATE POLICY "Students read their own toolbox data"
  ON public.student_toolbox_data FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.student_toolbox_data TO authenticated;

CREATE OR REPLACE FUNCTION public.save_student_toolbox_data(p_key TEXT, p_value JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_key NOT IN ('sticky-notes', 'daily-targets', 'exam-countdown', 'pomodoro', 'flashcards', 'mistakes') THEN
    RAISE EXCEPTION 'Invalid Toolbox data key';
  END IF;
  IF p_value IS NULL OR octet_length(p_value::text) > 250000 THEN
    RAISE EXCEPTION 'Toolbox data is invalid or too large';
  END IF;

  INSERT INTO public.student_toolbox_data(user_id, data, updated_at)
  VALUES (v_user_id, jsonb_build_object(p_key, p_value), now())
  ON CONFLICT (user_id) DO UPDATE
    SET data = jsonb_set(coalesce(student_toolbox_data.data, '{}'::jsonb), ARRAY[p_key], p_value, true),
        updated_at = now();
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_student_toolbox_data(TEXT, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.save_student_toolbox_data(TEXT, JSONB) FROM PUBLIC, anon;
