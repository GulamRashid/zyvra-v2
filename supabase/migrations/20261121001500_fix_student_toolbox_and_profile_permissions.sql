-- Migration: Fix student_toolbox_data RLS policies and table permissions for profiles
-- Ensures authenticated students can save their notebook, flashcards, mistake vault, and profile settings

GRANT UPDATE ON TABLE public.profiles TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_toolbox_data' AND policyname = 'Students insert their own toolbox data'
  ) THEN
    CREATE POLICY "Students insert their own toolbox data" 
    ON public.student_toolbox_data 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'student_toolbox_data' AND policyname = 'Students update their own toolbox data'
  ) THEN
    CREATE POLICY "Students update their own toolbox data" 
    ON public.student_toolbox_data 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
