-- ==============================================================================
-- Zyvra Migration: Ensure test_attempts answers column and update policies
-- Timestamp: 20261112190000
-- ==============================================================================

ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;

-- Ensure RLS allows students to update their own in_progress / paused attempts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'test_attempts' AND policyname = 'Students can update their own in-progress attempts'
  ) THEN
    CREATE POLICY "Students can update their own in-progress attempts"
      ON public.test_attempts
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
