-- Migration: Add pause, resume and CBT state columns to test_attempts
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure RLS allows students to update their own in_progress/paused attempts
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
