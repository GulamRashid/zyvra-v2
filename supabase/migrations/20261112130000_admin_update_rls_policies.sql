-- Zyvra Migration: Comprehensive RLS UPDATE/ALL Policies for Admin Content Operations
-- Timestamp: 20261112130000
-- Ensures authenticated administrators can perform full INSERT, UPDATE, and DELETE operations
-- on exams, folders, chapters, chapter_resources, questions, and tests via both profiles table
-- and auth.jwt() claims.

-- 1. EXAMS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage exams" ON public.exams;
CREATE POLICY "Admins manage exams"
  ON public.exams FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  );

-- 2. FOLDERS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage folders" ON public.folders;
CREATE POLICY "Admins manage folders"
  ON public.folders FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  );

-- 3. CHAPTERS
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage chapters" ON public.chapters;
CREATE POLICY "Admins manage chapters"
  ON public.chapters FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  );

-- 4. CHAPTER_RESOURCES
ALTER TABLE public.chapter_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage chapter resources" ON public.chapter_resources;
CREATE POLICY "Admins manage chapter resources"
  ON public.chapter_resources FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  );

-- 5. QUESTIONS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;
CREATE POLICY "Admins manage questions"
  ON public.questions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  );

-- 6. TESTS & TEST_QUESTIONS
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage tests" ON public.tests;
CREATE POLICY "Admins manage tests"
  ON public.tests FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  );

ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage test questions" ON public.test_questions;
CREATE POLICY "Admins manage test questions"
  ON public.test_questions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN ('admin', 'super_admin'))
    OR lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
    OR lower(coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')) IN ('admin', 'super_admin')
  );

-- 7. ENSURE FULL DML GRANTS FOR AUTHENTICATED USERS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams, public.folders, public.chapters, public.chapter_resources, public.questions, public.tests, public.test_questions TO authenticated;

-- 8. SIGNAL POSTGREST SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
