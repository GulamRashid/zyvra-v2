SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict h8E70AdJIOBjkJQi4lNa6PVhjD5ba1dNWBa55e01ve2Afzswu4jzHnyYwy4P7VP

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: postgres
--

INSERT INTO "supabase_migrations"."schema_migrations" ("version", "statements", "name") VALUES
	('20261111', '{"-- Migration: Add onboarding_completed column to profiles table
-- Ensures profiles track whether a user has finished or dismissed the onboarding flow

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE"}', 'add_onboarding_completed_to_profiles'),
	('20261111123456', '{"-- Migration: Referral system & Platform Settings (referrals table, referral_code on profiles, platform_settings)

-- 1. Ensure platform_settings table exists
CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key TEXT PRIMARY KEY,
  key TEXT,
  setting_value JSONB,
  updated_at TIMESTAMPTZ DEFAULT timezone(''utc''::text, now())
)","-- Ensure both key and setting_key columns exist alongside setting_value and updated_at
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS setting_key TEXT","ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS key TEXT","ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS setting_value JSONB","ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone(''utc''::text, now())","-- Sync existing values so key is populated from setting_key
UPDATE public.platform_settings SET key = setting_key WHERE key IS NULL AND setting_key IS NOT NULL","-- Safe block: Add unique constraint on platform_settings(key) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = ''platform_settings_key_unique''
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE c.relname = ''platform_settings'' AND a.attname = ''key'' AND (i.indisunique OR i.indisprimary)
  ) THEN
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);
  END IF;
END $$","-- 2. Add referral_code column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT","-- Safe block: Add unique constraint on profiles(referral_code) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = ''profiles_referral_code_unique''
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE c.relname = ''profiles'' AND a.attname = ''referral_code'' AND (i.indisunique OR i.indisprimary)
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_unique UNIQUE (referral_code);
  END IF;
END $$","CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code)","-- 3. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_coins_awarded INTEGER NOT NULL DEFAULT 50,
  referred_coins_awarded INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone(''utc''::text, now())
)","CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id)","CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id)","-- 4. Enable RLS and configure policies
-- platform_settings RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Anyone can read platform settings\" ON public.platform_settings","CREATE POLICY \"Anyone can read platform settings\"
  ON public.platform_settings FOR SELECT
  USING (true)","DROP POLICY IF EXISTS \"Admins can update platform settings\" ON public.platform_settings","CREATE POLICY \"Admins can update platform settings\"
  ON public.platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = ''admin''
    )
  )","-- referrals RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Users can view their own referrals\" ON public.referrals","CREATE POLICY \"Users can view their own referrals\"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id)","DROP POLICY IF EXISTS \"Admins can view all referrals\" ON public.referrals","CREATE POLICY \"Admins can view all referrals\"
  ON public.referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = ''admin''
    )
  )","DROP POLICY IF EXISTS \"Authenticated users can insert referrals\" ON public.referrals","CREATE POLICY \"Authenticated users can insert referrals\"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_id OR auth.uid() = referrer_id)","-- 5. Seed default platform settings with ON CONFLICT (setting_key) DO UPDATE
INSERT INTO public.platform_settings (setting_key, key, setting_value)
VALUES 
  (''referral_program_config'', ''referral_program_config'', ''{\"referral_enabled\": true, \"referrer_reward_coins\": 50, \"referred_reward_coins\": 20}''::jsonb),
  (''referral_enabled'', ''referral_enabled'', ''true''::jsonb),
  (''referrer_reward_coins'', ''referrer_reward_coins'', ''50''::jsonb),
  (''referred_reward_coins'', ''referred_reward_coins'', ''20''::jsonb)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value, key = EXCLUDED.key, updated_at = now()"}', 'referral_system'),
	('20261111204600', '{"-- Align the content catalogue, chapter resources, question bank, and test
-- authoring tables with the fields used by the Zyvra admin and student apps.
-- Existing rows are preserved; constraints are added NOT VALID so legacy rows
-- can be audited separately while new writes are checked immediately.

CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT ''BookOpen'',
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT ''draft'',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  parent_folder_id UUID,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  allow_tests BOOLEAN NOT NULL DEFAULT TRUE,
  allow_practice BOOLEAN NOT NULL DEFAULT TRUE,
  allow_notes BOOLEAN NOT NULL DEFAULT TRUE,
  pricing_mode TEXT NOT NULL DEFAULT ''free'',
  price NUMERIC(10, 2),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT ''draft'',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  estimated_study_time_minutes INTEGER NOT NULL DEFAULT 20,
  access_mode TEXT NOT NULL DEFAULT ''inherit-parent'',
  price NUMERIC(10, 2),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT ''draft'',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.chapter_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT ''PDF'',
  file_url TEXT NOT NULL,
  file_size TEXT,
  page_count INTEGER,
  is_downloadable BOOLEAN NOT NULL DEFAULT FALSE,
  is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT ''published'',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  question_text_hi TEXT,
  options JSONB NOT NULL DEFAULT ''[]''::jsonb,
  correct_answer TEXT NOT NULL DEFAULT ''A'',
  explanation TEXT,
  distractor_notes JSONB NOT NULL DEFAULT ''{}''::jsonb,
  subject TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT ''medium'',
  tags JSONB NOT NULL DEFAULT ''[]''::jsonb,
  status TEXT NOT NULL DEFAULT ''draft'',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  instructions TEXT,
  pattern TEXT NOT NULL DEFAULT ''standard-4'',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  attempt_limit INTEGER NOT NULL DEFAULT 1,
  positive_marks NUMERIC(8, 2) NOT NULL DEFAULT 1,
  negative_marks NUMERIC(8, 2) NOT NULL DEFAULT 0.25,
  mandatory_option_e_penalty NUMERIC(8, 2) NOT NULL DEFAULT 0.25,
  coin_reward_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT ''draft'',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL,
  question_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT ''BookOpen'',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''draft'',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS exam_id UUID,
  ADD COLUMN IF NOT EXISTS parent_folder_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS allow_tests BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_practice BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_notes BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT ''free'',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''draft'',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS folder_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS estimated_study_time_minutes INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT ''inherit-parent'',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''draft'',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","ALTER TABLE public.chapter_resources
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS chapter_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT ''PDF'',
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_size TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''published'',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS chapter_id UUID,
  ADD COLUMN IF NOT EXISTS question_text TEXT,
  ADD COLUMN IF NOT EXISTS question_text_hi TEXT,
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT ''[]''::jsonb,
  ADD COLUMN IF NOT EXISTS correct_answer TEXT DEFAULT ''A'',
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS distractor_notes JSONB DEFAULT ''{}''::jsonb,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT ''medium'',
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT ''[]''::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''draft'',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS chapter_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS pattern TEXT DEFAULT ''standard-4'',
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS attempt_limit INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS positive_marks NUMERIC(8, 2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(8, 2) DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS mandatory_option_e_penalty NUMERIC(8, 2) DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS coin_reward_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''draft'',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","ALTER TABLE public.test_questions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS test_id UUID,
  ADD COLUMN IF NOT EXISTS question_id UUID,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","DO $$
DECLARE
  v_table_name TEXT;
  v_id_type TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[''exams'', ''folders'', ''chapters'', ''chapter_resources'', ''questions'', ''tests'', ''test_questions'']
  LOOP
    SELECT c.udt_name INTO v_id_type
    FROM information_schema.columns c
    WHERE c.table_schema = ''public''
      AND c.table_name = v_table_name
      AND c.column_name = ''id'';
    IF v_id_type IS DISTINCT FROM ''uuid'' THEN
      RAISE EXCEPTION ''public.% must use a UUID id column before applying the Zyvra content schema migration (found %).'', v_table_name, COALESCE(v_id_type, ''missing'');
    END IF;
    EXECUTE format(''UPDATE public.%I SET id = gen_random_uuid() WHERE id IS NULL'', v_table_name);
    EXECUTE format(
      ''ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL, ALTER COLUMN created_at SET DEFAULT now(), ALTER COLUMN updated_at SET DEFAULT now()'',
      v_table_name
    );
  END LOOP;
END
$$","DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[''exams'', ''folders'', ''chapters'', ''chapter_resources'', ''questions'', ''tests'', ''test_questions'']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format(''public.%I'', v_table_name)::regclass
        AND contype = ''p''
    ) THEN
      EXECUTE format(''ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)'', v_table_name, v_table_name || ''_pkey'');
    END IF;
  END LOOP;
END
$$","CREATE INDEX IF NOT EXISTS idx_folders_exam_order ON public.folders (exam_id, display_order)","CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders (parent_folder_id)","CREATE INDEX IF NOT EXISTS idx_chapters_folder_order ON public.chapters (folder_id, display_order)","CREATE INDEX IF NOT EXISTS idx_chapter_resources_chapter_order ON public.chapter_resources (chapter_id, display_order)","CREATE INDEX IF NOT EXISTS idx_questions_chapter_status ON public.questions (chapter_id, status)","CREATE INDEX IF NOT EXISTS idx_tests_chapter_status ON public.tests (chapter_id, status)","CREATE INDEX IF NOT EXISTS idx_test_questions_test_order ON public.test_questions (test_id, display_order)","CREATE INDEX IF NOT EXISTS idx_test_questions_question ON public.test_questions (question_id)","DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT * FROM (VALUES
      (''folders'', ''folders_exam_id_fkey'', ''FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE''),
      (''folders'', ''folders_parent_folder_id_fkey'', ''FOREIGN KEY (parent_folder_id) REFERENCES public.folders(id) ON DELETE CASCADE''),
      (''chapters'', ''chapters_folder_id_fkey'', ''FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE''),
      (''chapter_resources'', ''chapter_resources_chapter_id_fkey'', ''FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE''),
      (''questions'', ''questions_chapter_id_fkey'', ''FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE''),
      (''tests'', ''tests_chapter_id_fkey'', ''FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE''),
      (''test_questions'', ''test_questions_test_id_fkey'', ''FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE''),
      (''test_questions'', ''test_questions_question_id_fkey'', ''FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE'')
    ) AS definitions(table_name, constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format(''public.%I'', constraint_record.table_name)::regclass
        AND conname = constraint_record.constraint_name
    ) THEN
      EXECUTE format(
        ''ALTER TABLE public.%I ADD CONSTRAINT %I %s NOT VALID'',
        constraint_record.table_name,
        constraint_record.constraint_name,
        constraint_record.definition
      );
    END IF;
  END LOOP;
END
$$","DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT * FROM (VALUES
      (''exams'', ''exams_display_order_nonnegative'', ''CHECK (display_order >= 0)''),
      (''exams'', ''exams_status_allowed'', ''CHECK (status IN (''''draft'''', ''''published'''', ''''unpublished'''', ''''archived'''', ''''active'''', ''''live'''', ''''available'''', ''''coming-soon'''', ''''coming_soon''''))''),
      (''folders'', ''folders_display_order_nonnegative'', ''CHECK (display_order >= 0)''),
      (''folders'', ''folders_price_nonnegative'', ''CHECK (price IS NULL OR price >= 0)''),
      (''folders'', ''folders_pricing_mode_allowed'', ''CHECK (pricing_mode IN (''''free'''', ''''paid-own'''', ''''inherit-parent''''))''),
      (''folders'', ''folders_status_allowed'', ''CHECK (status IN (''''draft'''', ''''published'''', ''''unpublished'''', ''''archived'''', ''''active'''', ''''live'''', ''''available'''', ''''coming-soon'''', ''''coming_soon''''))''),
      (''chapters'', ''chapters_display_order_nonnegative'', ''CHECK (display_order >= 0)''),
      (''chapters'', ''chapters_study_time_positive'', ''CHECK (estimated_study_time_minutes > 0)''),
      (''chapters'', ''chapters_price_nonnegative'', ''CHECK (price IS NULL OR price >= 0)''),
      (''chapters'', ''chapters_access_mode_allowed'', ''CHECK (access_mode IN (''''free'''', ''''paid-own'''', ''''inherit-parent''''))''),
      (''chapters'', ''chapters_status_allowed'', ''CHECK (status IN (''''draft'''', ''''published'''', ''''unpublished'''', ''''archived'''', ''''active'''', ''''live'''', ''''available'''', ''''coming-soon'''', ''''coming_soon''''))''),
      (''chapter_resources'', ''chapter_resources_display_order_nonnegative'', ''CHECK (display_order >= 0)''),
      (''chapter_resources'', ''chapter_resources_page_count_positive'', ''CHECK (page_count IS NULL OR page_count > 0)''),
      (''chapter_resources'', ''chapter_resources_status_allowed'', ''CHECK (status IN (''''draft'''', ''''published'''', ''''unpublished'''', ''''archived'''', ''''active'''', ''''live'''', ''''available''''))''),
      (''questions'', ''questions_difficulty_allowed'', ''CHECK (difficulty IN (''''easy'''', ''''medium'''', ''''hard''''))''),
      (''questions'', ''questions_status_allowed'', ''CHECK (status IN (''''draft'''', ''''review'''', ''''published'''', ''''unpublished'''', ''''archived'''', ''''active'''', ''''live'''', ''''available''''))''),
      (''tests'', ''tests_duration_positive'', ''CHECK (duration_minutes > 0)''),
      (''tests'', ''tests_attempt_limit_positive'', ''CHECK (attempt_limit > 0)''),
      (''tests'', ''tests_positive_marks_positive'', ''CHECK (positive_marks > 0)''),
      (''tests'', ''tests_negative_marks_nonnegative'', ''CHECK (negative_marks >= 0)''),
      (''tests'', ''tests_option_e_penalty_nonnegative'', ''CHECK (mandatory_option_e_penalty >= 0)''),
      (''tests'', ''tests_pattern_allowed'', ''CHECK (pattern IN (''''standard-4'''', ''''bpsc-classic-5'''', ''''bpsc-mandatory-e''''))''),
      (''tests'', ''tests_status_allowed'', ''CHECK (status IN (''''draft'''', ''''published'''', ''''scheduled'''', ''''paused'''', ''''active'''', ''''live'''', ''''available'''', ''''archived''''))''),
      (''test_questions'', ''test_questions_display_order_nonnegative'', ''CHECK (display_order >= 0)'')
    ) AS definitions(table_name, constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format(''public.%I'', constraint_record.table_name)::regclass
        AND conname = constraint_record.constraint_name
    ) THEN
      EXECUTE format(
        ''ALTER TABLE public.%I ADD CONSTRAINT %I %s NOT VALID'',
        constraint_record.table_name,
        constraint_record.constraint_name,
        constraint_record.definition
      );
    END IF;
  END LOOP;
END
$$","CREATE OR REPLACE FUNCTION public.set_content_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$","DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[''exams'', ''folders'', ''chapters'', ''chapter_resources'', ''questions'', ''tests'', ''test_questions'']
  LOOP
    EXECUTE format(''DROP TRIGGER IF EXISTS %I ON public.%I'', v_table_name || ''_set_updated_at'', v_table_name);
    EXECUTE format(
      ''CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_content_updated_at()'',
      v_table_name || ''_set_updated_at'',
      v_table_name
    );
  END LOOP;
END
$$","ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY","ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY","ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY","ALTER TABLE public.chapter_resources ENABLE ROW LEVEL SECURITY","ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY","ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY","ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Published exams are readable\" ON public.exams","CREATE POLICY \"Published exams are readable\"
  ON public.exams FOR SELECT TO anon, authenticated
  USING (status IN (''published'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon''))","DROP POLICY IF EXISTS \"Admins manage exams\" ON public.exams","CREATE POLICY \"Admins manage exams\"
  ON public.exams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Published folders are readable\" ON public.folders","CREATE POLICY \"Published folders are readable\"
  ON public.folders FOR SELECT TO anon, authenticated
  USING (
    status IN (''published'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon'')
    AND EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = folders.exam_id
        AND e.status IN (''published'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon'')
    )
  )","DROP POLICY IF EXISTS \"Admins manage folders\" ON public.folders","CREATE POLICY \"Admins manage folders\"
  ON public.folders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Published chapters are readable\" ON public.chapters","CREATE POLICY \"Published chapters are readable\"
  ON public.chapters FOR SELECT TO anon, authenticated
  USING (
    status IN (''published'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon'')
    AND EXISTS (
      SELECT 1
      FROM public.folders f
      JOIN public.exams e ON e.id = f.exam_id
      WHERE f.id = chapters.folder_id
        AND f.status IN (''published'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon'')
        AND e.status IN (''published'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon'')
    )
  )","DROP POLICY IF EXISTS \"Admins manage chapters\" ON public.chapters","CREATE POLICY \"Admins manage chapters\"
  ON public.chapters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Published chapter resources are readable\" ON public.chapter_resources","CREATE POLICY \"Published chapter resources are readable\"
  ON public.chapter_resources FOR SELECT TO anon, authenticated
  USING (
    status IN (''published'', ''active'', ''live'', ''available'')
    AND EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = chapter_resources.chapter_id
        AND c.status IN (''published'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon'')
    )
  )","DROP POLICY IF EXISTS \"Admins manage chapter resources\" ON public.chapter_resources","CREATE POLICY \"Admins manage chapter resources\"
  ON public.chapter_resources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Published questions are readable\" ON public.questions","DROP POLICY IF EXISTS \"Admins manage questions\" ON public.questions","CREATE POLICY \"Admins manage questions\"
  ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Published tests are readable\" ON public.tests","CREATE POLICY \"Published tests are readable\"
  ON public.tests FOR SELECT TO anon, authenticated
  USING (
    status IN (''published'', ''live'', ''available'')
    AND EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = tests.chapter_id
        AND c.status IN (''published'', ''live'', ''available'')
    )
  )","DROP POLICY IF EXISTS \"Admins manage tests\" ON public.tests","CREATE POLICY \"Admins manage tests\"
  ON public.tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Questions in published tests are readable\" ON public.test_questions","CREATE POLICY \"Questions in published tests are readable\"
  ON public.test_questions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_questions.test_id AND t.status IN (''published'', ''live'', ''available'')))","DROP POLICY IF EXISTS \"Admins manage test questions\" ON public.test_questions","CREATE POLICY \"Admins manage test questions\"
  ON public.test_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","CREATE OR REPLACE FUNCTION public.get_published_question_metadata(p_question_ids UUID[])
RETURNS TABLE (id UUID, subject TEXT, topic TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''''
AS $$
  SELECT q.id, q.subject, q.topic
  FROM public.questions q
  WHERE auth.uid() IS NOT NULL
    AND q.status IN (''published'', ''active'', ''live'', ''available'')
    AND q.id = ANY(COALESCE(p_question_ids, ARRAY[]::UUID[]));
$$","REVOKE ALL ON FUNCTION public.get_published_question_metadata(UUID[]) FROM PUBLIC, anon","GRANT EXECUTE ON FUNCTION public.get_published_question_metadata(UUID[]) TO authenticated","GRANT SELECT ON public.exams, public.folders, public.chapters, public.chapter_resources, public.questions, public.tests, public.test_questions TO anon, authenticated","GRANT INSERT, UPDATE, DELETE ON public.exams, public.folders, public.chapters, public.chapter_resources, public.questions, public.tests, public.test_questions TO authenticated","NOTIFY pgrst, ''reload schema''"}', 'master_content_schema'),
	('20261112120000', '{"-- ==============================================================================
-- Zyvra Migration: Hierarchical Unlock, Access Control & Constraint Synchronization
-- Timestamp: 20261112120000
-- 1. Drops legacy/inconsistent check constraints and standardizes pricing_mode to (''free'', ''paid_own'', ''inherit'').
-- 2. Implements recursive hierarchical folder & chapter access functions (WITH RECURSIVE).
-- 3. Implements secure checkout fulfillment and user entitlement management.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DYNAMICALLY DROP EXISTING CHECK CONSTRAINTS ON FOLDERS & CONTENT TABLES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Drop any check constraint related to pricing_mode or access_mode dynamically
  FOR v_rec IN (
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = ''public''
      AND con.contype = ''c''
      AND rel.relname IN (''folders'', ''chapters'', ''chapter_resources'')
      AND (
        con.conname LIKE ''%pricing_mode%'' OR
        con.conname LIKE ''%access_mode%'' OR
        pg_get_constraintdef(con.oid) LIKE ''%pricing_mode%'' OR
        pg_get_constraintdef(con.oid) LIKE ''%access_mode%''
      )
  )
  LOOP
    EXECUTE format(''ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I'', v_rec.relname, v_rec.conname);
  END LOOP;
END
$$","-- Explicitly ensure known constraint names are dropped
ALTER TABLE public.folders
  DROP CONSTRAINT IF EXISTS folders_pricing_mode_allowed,
  DROP CONSTRAINT IF EXISTS folders_pricing_mode_check","ALTER TABLE public.chapters
  DROP CONSTRAINT IF EXISTS chapters_access_mode_allowed,
  DROP CONSTRAINT IF EXISTS chapters_access_mode_check","ALTER TABLE public.chapter_resources
  DROP CONSTRAINT IF EXISTS chapter_resources_resource_type_allowed,
  DROP CONSTRAINT IF EXISTS chapter_resources_resource_type_check","-- Ensure parent_id column exists on public.folders as an alias/companion to parent_folder_id
ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE","-- ------------------------------------------------------------------------------
-- 2. STANDARDIZE & NORMALIZE EXISTING CONTENT DATA
-- ------------------------------------------------------------------------------
UPDATE public.folders
  SET parent_id = parent_folder_id
  WHERE parent_id IS NULL AND parent_folder_id IS NOT NULL","UPDATE public.folders
  SET parent_folder_id = parent_id
  WHERE parent_folder_id IS NULL AND parent_id IS NOT NULL","CREATE OR REPLACE FUNCTION public.sync_folder_parent_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_folder_id IS NOT NULL AND NEW.parent_id IS NULL THEN
    NEW.parent_id := NEW.parent_folder_id;
  ELSIF NEW.parent_id IS NOT NULL AND NEW.parent_folder_id IS NULL THEN
    NEW.parent_folder_id := NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$","DROP TRIGGER IF EXISTS trg_sync_folder_parent_id ON public.folders","CREATE TRIGGER trg_sync_folder_parent_id
BEFORE INSERT OR UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.sync_folder_parent_id()","UPDATE public.folders
  SET pricing_mode = ''paid_own''
  WHERE pricing_mode = ''paid-own''","UPDATE public.folders
  SET pricing_mode = ''inherit''
  WHERE pricing_mode IN (''inherit-parent'', ''inherit_parent'')","UPDATE public.folders
  SET pricing_mode = ''free''
  WHERE pricing_mode IS NULL OR pricing_mode NOT IN (''free'', ''paid_own'', ''inherit'')","UPDATE public.chapters
  SET access_mode = ''paid_own''
  WHERE access_mode = ''paid-own''","UPDATE public.chapters
  SET access_mode = ''inherit''
  WHERE access_mode IN (''inherit-parent'', ''inherit_parent'')","UPDATE public.chapters
  SET access_mode = ''free''
  WHERE access_mode = ''free''","UPDATE public.chapters
  SET access_mode = ''inherit''
  WHERE access_mode IS NULL OR access_mode NOT IN (''free'', ''paid_own'', ''inherit'')","UPDATE public.chapter_resources
  SET resource_type = lower(trim(resource_type))
  WHERE resource_type IS NOT NULL","-- ------------------------------------------------------------------------------
-- 3. RECREATE CLEAN, STANDARDIZED CHECK CONSTRAINTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.folders
  ADD CONSTRAINT folders_pricing_mode_check
  CHECK (pricing_mode IN (''free'', ''paid_own'', ''inherit''))","ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_access_mode_check
  CHECK (access_mode IN (''free'', ''paid_own'', ''inherit''))","ALTER TABLE public.chapter_resources
  ADD CONSTRAINT chapter_resources_resource_type_check
  CHECK (resource_type IN (''pdf'', ''formula_sheet'', ''revision_sheet'', ''notes'', ''PDF'', ''Formula Sheet'', ''Revision Sheet'', ''Notes'', ''doc'', ''document'', ''video'', ''link''))","-- ------------------------------------------------------------------------------
-- 4. ENSURE ENTITLEMENT & ORDER TABLES EXIST
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT ''active'',
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- Safely ensure all required columns exist on public.user_access (in case table existed already)
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT ''active'',
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()","-- Ensure item_id column is TEXT so it supports both UUIDs and string identifiers (tools, combo keys, etc.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ''public''
      AND table_name = ''user_access''
      AND column_name = ''item_id''
      AND udt_name = ''uuid''
  ) THEN
    ALTER TABLE public.user_access ALTER COLUMN item_id TYPE TEXT USING item_id::TEXT;
  END IF;
END
$$","-- Ensure unique constraint on (user_id, item_type, item_id) for safe upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = ''user_access_user_item_unique''
  ) THEN
    -- Remove any duplicates before adding constraint
    DELETE FROM public.user_access a
    USING public.user_access b
    WHERE a.id > b.id
      AND a.user_id = b.user_id
      AND a.item_type = b.item_type
      AND a.item_id::text = b.item_id::text;

    ALTER TABLE public.user_access
      ADD CONSTRAINT user_access_user_item_unique UNIQUE (user_id, item_type, item_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$","CREATE INDEX IF NOT EXISTS idx_user_access_lookup
  ON public.user_access (user_id, item_type, item_id, is_active, status)","CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  amount_paise BIGINT NOT NULL DEFAULT 0,
  coins_redeemed INTEGER NOT NULL DEFAULT 0,
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  payment_signature TEXT,
  status TEXT NOT NULL DEFAULT ''created'',
  currency TEXT NOT NULL DEFAULT ''INR'',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- Safely ensure all required columns exist on public.payment_orders (in case table existed already)
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_redeemed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_signature TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT ''created'',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT ''INR'',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()","DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = ''public''
      AND table_name = ''payment_orders''
      AND column_name = ''item_id''
      AND udt_name = ''uuid''
  ) THEN
    ALTER TABLE public.payment_orders ALTER COLUMN item_id TYPE TEXT USING item_id::TEXT;
  END IF;
END
$$","CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created
  ON public.payment_orders (user_id, created_at DESC)","CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway_order
  ON public.payment_orders (gateway_order_id)","-- Enable RLS on user_access & payment_orders
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY","ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Users can read own access\" ON public.user_access","CREATE POLICY \"Users can read own access\"
  ON public.user_access FOR SELECT TO authenticated
  USING (user_id = auth.uid())","DROP POLICY IF EXISTS \"Admins manage all access\" ON public.user_access","CREATE POLICY \"Admins manage all access\"
  ON public.user_access FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Users can read own orders\" ON public.payment_orders","CREATE POLICY \"Users can read own orders\"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid())","DROP POLICY IF EXISTS \"Admins manage all orders\" ON public.payment_orders","CREATE POLICY \"Admins manage all orders\"
  ON public.payment_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","-- ------------------------------------------------------------------------------
-- 5. RECURSIVE HIERARCHICAL FOLDER ACCESS FUNCTION
-- ------------------------------------------------------------------------------
-- Walks UP the parent chain from p_folder_id to the root folder using a WITH RECURSIVE CTE.
-- Returns true if:
--   a) The folder''s effective pricing is free, OR
--   b) The user has an active purchase/entitlement for p_folder_id OR ANY ancestor folder in its chain.
CREATE OR REPLACE FUNCTION public.user_has_folder_access(
  p_user_id UUID,
  p_folder_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder RECORD;
  v_has_entitlement BOOLEAN := false;
  v_effective_amount NUMERIC := 0;
BEGIN
  IF p_folder_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify folder existence
  SELECT id, exam_id, COALESCE(parent_folder_id, parent_id) AS parent_folder_id, pricing_mode, price, status
  INTO v_folder
  FROM public.folders
  WHERE id = p_folder_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. If user is authenticated, check for active entitlement on this folder or any ancestor folder
  IF p_user_id IS NOT NULL THEN
    WITH RECURSIVE folder_chain AS (
      SELECT
        id,
        COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
        pricing_mode,
        price,
        1 AS depth
      FROM public.folders
      WHERE id = p_folder_id

      UNION ALL

      SELECT
        f.id,
        COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
        f.pricing_mode,
        f.price,
        fc.depth + 1
      FROM public.folders f
      JOIN folder_chain fc ON f.id = fc.parent_folder_id
    )
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN folder_chain fc ON ua.item_id::text = fc.id::text
      WHERE ua.user_id = p_user_id
        AND ua.item_type = ''folder''
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_entitlement;

    IF v_has_entitlement THEN
      RETURN true;
    END IF;

    -- Also check if user holds an exam pass for this folder''s exam
    IF v_folder.exam_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_access ua
        WHERE ua.user_id = p_user_id
          AND ua.item_type = ''exam''
          AND ua.item_id::text = v_folder.exam_id::text
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
      ) INTO v_has_entitlement;

      IF v_has_entitlement THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  -- 2. Check effective pricing: Is this folder effectively free?
  WITH RECURSIVE folder_pricing_chain AS (
    SELECT
      id,
      COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
      pricing_mode,
      price,
      1 AS depth
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT
      f.id,
      COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
      f.pricing_mode,
      f.price,
      fpc.depth + 1
    FROM public.folders f
    JOIN folder_pricing_chain fpc ON f.id = fpc.parent_folder_id
    WHERE fpc.pricing_mode IN (''inherit'', ''inherit-parent'', ''inherit_parent'')
  )
  SELECT
    CASE
      WHEN pricing_mode = ''free'' THEN 0
      WHEN pricing_mode IN (''paid_own'', ''paid-own'') THEN COALESCE(price, 0)
      ELSE 0
    END INTO v_effective_amount
  FROM folder_pricing_chain
  WHERE pricing_mode IN (''free'', ''paid_own'', ''paid-own'')
     OR parent_folder_id IS NULL
  ORDER BY depth ASC
  LIMIT 1;

  IF COALESCE(v_effective_amount, 0) <= 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$","-- ------------------------------------------------------------------------------
-- 6. HIERARCHICAL CHAPTER ACCESS FUNCTION
-- ------------------------------------------------------------------------------
-- Returns true if:
--   a) The chapter itself is free, OR
--   b) Directly purchased by the user, OR
--   c) The user has folder access for chapter.folder_id (hierarchical ancestor purchase).
CREATE OR REPLACE FUNCTION public.user_has_chapter_access(
  p_user_id UUID,
  p_chapter_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter RECORD;
  v_has_direct BOOLEAN := false;
BEGIN
  IF p_chapter_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, folder_id, access_mode, price, status
  INTO v_chapter
  FROM public.chapters
  WHERE id = p_chapter_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. Free chapter
  IF v_chapter.access_mode = ''free'' OR (v_chapter.access_mode IN (''paid_own'', ''paid-own'') AND COALESCE(v_chapter.price, 0) <= 0) THEN
    RETURN true;
  END IF;

  -- 2. Directly purchased by user
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = ''chapter''
        AND ua.item_id::text = p_chapter_id::text
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_direct;

    IF v_has_direct THEN
      RETURN true;
    END IF;
  END IF;

  -- 3. Check hierarchical folder access for the parent folder
  IF v_chapter.folder_id IS NOT NULL THEN
    RETURN public.user_has_folder_access(p_user_id, v_chapter.folder_id);
  END IF;

  RETURN false;
END;
$$","-- ------------------------------------------------------------------------------
-- 7. GENERAL CHECK_USER_ACCESS RPC (USED BY FRONTEND HOOK)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_access(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_type TEXT := lower(trim(p_item_type));
  v_has_access BOOLEAN := false;
  v_uuid UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_clean_type = ''folder'' THEN
    BEGIN
      v_uuid := p_item_id::UUID;
      RETURN public.user_has_folder_access(p_user_id, v_uuid);
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  ELSIF v_clean_type = ''chapter'' THEN
    BEGIN
      v_uuid := p_item_id::UUID;
      RETURN public.user_has_chapter_access(p_user_id, v_uuid);
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  ELSIF v_clean_type = ''exam'' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = ''exam''
        AND ua.item_id::text = p_item_id
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_access;

    IF v_has_access THEN
      RETURN true;
    END IF;

    BEGIN
      v_uuid := p_item_id::UUID;
      SELECT (COALESCE(price, 0) <= 0) INTO v_has_access
      FROM public.exams
      WHERE id = v_uuid;
      RETURN COALESCE(v_has_access, true);
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = v_clean_type
        AND ua.item_id::text = p_item_id
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_access;

    RETURN v_has_access;
  END IF;
END;
$$","-- ------------------------------------------------------------------------------
-- 8. CHECKOUT FULFILLMENT RPC (COMPLETE_SUCCESSFUL_CHECKOUT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_payment_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_order_uuid UUID;
BEGIN
  -- Locate order in payment_orders
  BEGIN
    v_order_uuid := p_order_id::UUID;
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = v_order_uuid
       OR gateway_order_id = p_order_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE gateway_order_id = p_order_id
    LIMIT 1;
  END;

  IF v_order.id IS NOT NULL THEN
    -- Mark order as paid
    UPDATE public.payment_orders
    SET
      status = ''paid'',
      gateway_payment_id = p_payment_id,
      payment_signature = p_payment_signature,
      updated_at = now()
    WHERE id = v_order.id;

    -- Record access entitlement for folder / chapter / exam
    INSERT INTO public.user_access (
      user_id,
      item_type,
      item_id,
      status,
      is_active,
      starts_at,
      created_at,
      updated_at
    )
    VALUES (
      v_order.user_id,
      v_order.item_type,
      v_order.item_id::text,
      ''active'',
      true,
      now(),
      now(),
      now()
    )
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET
      status = ''active'',
      is_active = true,
      updated_at = now();

    -- Deduct redeemed coins if applicable
    IF COALESCE(v_order.coins_redeemed, 0) > 0 THEN
      UPDATE public.coin_wallets
      SET balance = GREATEST(0, balance - v_order.coins_redeemed)
      WHERE user_id = v_order.user_id;

      INSERT INTO public.coin_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        created_at
      )
      VALUES (
        v_order.user_id,
        -v_order.coins_redeemed,
        ''redeem'',
        format(''Redeemed %s coins for %s purchase'', v_order.coins_redeemed, v_order.item_type),
        now()
      );
    END IF;

    RETURN jsonb_build_object(''success'', true, ''message'', ''Access entitlement granted.'');
  END IF;

  RETURN jsonb_build_object(''success'', true, ''message'', ''Payment recorded.'');
END;
$$","-- ------------------------------------------------------------------------------
-- 9. ADMIN MANUAL ACCESS GRANT RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_user_access(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN (''admin'', ''super_admin'')
  ) THEN
    RAISE EXCEPTION ''Only administrators can manually grant content access.'';
  END IF;

  INSERT INTO public.user_access (
    user_id,
    item_type,
    item_id,
    status,
    is_active,
    granted_by,
    reason,
    starts_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_item_type,
    p_item_id::text,
    ''active'',
    true,
    auth.uid(),
    p_reason,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET
    status = ''active'',
    is_active = true,
    reason = COALESCE(p_reason, user_access.reason),
    updated_at = now();

  RETURN jsonb_build_object(''success'', true);
END;
$$","-- ------------------------------------------------------------------------------
-- 10. GRANTS & SCHEMA RELOAD
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.user_has_folder_access(UUID, UUID) TO anon, authenticated","GRANT EXECUTE ON FUNCTION public.user_has_chapter_access(UUID, UUID) TO anon, authenticated","GRANT EXECUTE ON FUNCTION public.check_user_access(UUID, TEXT, TEXT) TO anon, authenticated","GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO anon, authenticated","GRANT EXECUTE ON FUNCTION public.admin_grant_user_access(UUID, TEXT, TEXT, TEXT) TO authenticated","GRANT SELECT ON public.user_access TO anon, authenticated","GRANT INSERT, UPDATE ON public.user_access TO authenticated","GRANT SELECT ON public.payment_orders TO anon, authenticated","GRANT INSERT, UPDATE ON public.payment_orders TO authenticated","NOTIFY pgrst, ''reload schema''"}', 'hierarchical_unlock_and_constraints'),
	('20261112130000', '{"-- Zyvra Migration: Comprehensive RLS UPDATE/ALL Policies for Admin Content Operations
-- Timestamp: 20261112130000
-- Ensures authenticated administrators can perform full INSERT, UPDATE, and DELETE operations
-- on exams, folders, chapters, chapter_resources, questions, and tests via both profiles table
-- and auth.jwt() claims.

-- 1. EXAMS
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Admins manage exams\" ON public.exams","CREATE POLICY \"Admins manage exams\"
  ON public.exams FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )","-- 2. FOLDERS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Admins manage folders\" ON public.folders","CREATE POLICY \"Admins manage folders\"
  ON public.folders FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )","-- 3. CHAPTERS
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Admins manage chapters\" ON public.chapters","CREATE POLICY \"Admins manage chapters\"
  ON public.chapters FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )","-- 4. CHAPTER_RESOURCES
ALTER TABLE public.chapter_resources ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Admins manage chapter resources\" ON public.chapter_resources","CREATE POLICY \"Admins manage chapter resources\"
  ON public.chapter_resources FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )","-- 5. QUESTIONS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Admins manage questions\" ON public.questions","CREATE POLICY \"Admins manage questions\"
  ON public.questions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )","-- 6. TESTS & TEST_QUESTIONS
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Admins manage tests\" ON public.tests","CREATE POLICY \"Admins manage tests\"
  ON public.tests FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )","ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Admins manage test questions\" ON public.test_questions","CREATE POLICY \"Admins manage test questions\"
  ON public.test_questions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(trim(p.role)) IN (''admin'', ''super_admin''))
    OR lower(coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
    OR lower(coalesce(auth.jwt() -> ''user_metadata'' ->> ''role'', '''')) IN (''admin'', ''super_admin'')
  )","-- 7. ENSURE FULL DML GRANTS FOR AUTHENTICATED USERS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams, public.folders, public.chapters, public.chapter_resources, public.questions, public.tests, public.test_questions TO authenticated","-- 8. SIGNAL POSTGREST SCHEMA RELOAD
NOTIFY pgrst, ''reload schema''"}', 'admin_update_rls_policies'),
	('20261112150000', '{"-- Migration: Add pause, resume and CBT state columns to test_attempts
ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''in_progress'',
  ADD COLUMN IF NOT EXISTS remaining_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state_json JSONB DEFAULT ''{}''::jsonb,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","-- Ensure RLS allows students to update their own in_progress/paused attempts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = ''test_attempts'' AND policyname = ''Students can update their own in-progress attempts''
  ) THEN
    CREATE POLICY \"Students can update their own in-progress attempts\"
      ON public.test_attempts
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$"}', 'test_attempts_pause_resume'),
	('20261112160000', '{"-- ==============================================================================
-- Zyvra Migration: Canonical Access Check RPC, Exam Pricing & Solution Mode
-- Timestamp: 20261112160000
-- 1. Drops ALL overloaded versions of check_user_access and defines ONE canonical RPC.
-- 2. Adds access_mode and price to public.exams for root exam bundle pricing.
-- 3. Adds solution_mode to public.tests for immediate vs after_submit answer revelation.
-- 4. Ensures clean admin DELETE RLS policies on exams, folders, chapters, tests, questions.
-- ==============================================================================

-- 1. DROP ALL OVERLOADED check_user_access FUNCTIONS DYNAMICALLY
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN (
    SELECT p.oid::regprocedure AS proc_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = ''public''
      AND p.proname = ''check_user_access''
  )
  LOOP
    EXECUTE ''DROP FUNCTION '' || v_rec.proc_name;
  END LOOP;
END
$$","-- Explicit drops as an extra safeguard
DROP FUNCTION IF EXISTS public.check_user_access(uuid, text, text)","DROP FUNCTION IF EXISTS public.check_user_access(uuid, text, uuid)","-- 2. ADD PRICING COLUMNS TO public.exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT ''free'',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2)","-- Normalize legacy or null exam pricing
UPDATE public.exams
  SET access_mode = ''free''
  WHERE access_mode IS NULL OR access_mode NOT IN (''free'', ''paid_own'')","ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_access_mode_check","ALTER TABLE public.exams
  ADD CONSTRAINT exams_access_mode_check CHECK (access_mode IN (''free'', ''paid_own''))","ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_price_check","ALTER TABLE public.exams
  ADD CONSTRAINT exams_price_check CHECK (price IS NULL OR price >= 0)","-- 3. ADD solution_mode TO public.tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS solution_mode TEXT DEFAULT ''after_submit''","UPDATE public.tests
  SET solution_mode = ''after_submit''
  WHERE solution_mode IS NULL OR solution_mode NOT IN (''after_submit'', ''immediate'')","ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_solution_mode_check","ALTER TABLE public.tests
  ADD CONSTRAINT tests_solution_mode_check CHECK (solution_mode IN (''after_submit'', ''immediate''))","-- 4. ENSURE USER ACCESS & ENTITLEMENT TABLES EXIST
CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT ''active'',
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- Ensure unique constraint on (user_id, item_type, item_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = ''user_access_user_item_unique''
  ) THEN
    ALTER TABLE public.user_access
      ADD CONSTRAINT user_access_user_item_unique UNIQUE (user_id, item_type, item_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$","-- 5. RECURSIVE FOLDER ACCESS FUNCTION
CREATE OR REPLACE FUNCTION public.user_has_folder_access(
  p_user_id UUID,
  p_folder_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder RECORD;
  v_has_entitlement BOOLEAN := false;
  v_effective_amount NUMERIC := 0;
BEGIN
  IF p_folder_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, exam_id, COALESCE(parent_folder_id, parent_id) AS parent_folder_id, pricing_mode, price, status
  INTO v_folder
  FROM public.folders
  WHERE id = p_folder_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If user is authenticated, check for active entitlement on this folder, any ancestor folder, or parent exam
  IF p_user_id IS NOT NULL THEN
    -- Check parent exam purchase first
    IF v_folder.exam_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_access ua
        WHERE ua.user_id = p_user_id
          AND ua.item_type = ''exam''
          AND ua.item_id::text = v_folder.exam_id::text
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
      ) INTO v_has_entitlement;

      IF v_has_entitlement THEN
        RETURN true;
      END IF;
    END IF;

    -- Check folder and all ancestor folders using WITH RECURSIVE
    WITH RECURSIVE folder_chain AS (
      SELECT
        id,
        COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
        pricing_mode,
        price,
        1 AS depth
      FROM public.folders
      WHERE id = p_folder_id

      UNION ALL

      SELECT
        f.id,
        COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
        f.pricing_mode,
        f.price,
        fc.depth + 1
      FROM public.folders f
      JOIN folder_chain fc ON f.id = fc.parent_folder_id
    )
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN folder_chain fc ON ua.item_id::text = fc.id::text
      WHERE ua.user_id = p_user_id
        AND ua.item_type = ''folder''
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_entitlement;

    IF v_has_entitlement THEN
      RETURN true;
    END IF;
  END IF;

  -- Check effective pricing: Is this folder effectively free?
  WITH RECURSIVE folder_pricing_chain AS (
    SELECT
      id,
      COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
      pricing_mode,
      price,
      1 AS depth
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT
      f.id,
      COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
      f.pricing_mode,
      f.price,
      fpc.depth + 1
    FROM public.folders f
    JOIN folder_pricing_chain fpc ON f.id = fpc.parent_folder_id
    WHERE fpc.pricing_mode IN (''inherit'', ''inherit-parent'', ''inherit_parent'')
  )
  SELECT
    CASE
      WHEN pricing_mode = ''free'' THEN 0
      WHEN pricing_mode IN (''paid_own'', ''paid-own'') THEN COALESCE(price, 0)
      ELSE 0
    END INTO v_effective_amount
  FROM folder_pricing_chain
  WHERE pricing_mode IN (''free'', ''paid_own'', ''paid-own'')
     OR parent_folder_id IS NULL
  ORDER BY depth ASC
  LIMIT 1;

  IF COALESCE(v_effective_amount, 0) <= 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$","-- 6. HIERARCHICAL CHAPTER ACCESS FUNCTION
CREATE OR REPLACE FUNCTION public.user_has_chapter_access(
  p_user_id UUID,
  p_chapter_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter RECORD;
  v_has_direct BOOLEAN := false;
  v_folder RECORD;
BEGIN
  IF p_chapter_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, folder_id, access_mode, price, status
  INTO v_chapter
  FROM public.chapters
  WHERE id = p_chapter_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. Free chapter
  IF v_chapter.access_mode = ''free'' OR (v_chapter.access_mode IN (''paid_own'', ''paid-own'') AND COALESCE(v_chapter.price, 0) <= 0) THEN
    RETURN true;
  END IF;

  -- 2. Directly purchased by user
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = ''chapter''
        AND ua.item_id::text = p_chapter_id::text
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_direct;

    IF v_has_direct THEN
      RETURN true;
    END IF;

    -- Also check if user holds an exam pass for the chapter''s parent exam
    IF v_chapter.folder_id IS NOT NULL THEN
      SELECT exam_id INTO v_folder FROM public.folders WHERE id = v_chapter.folder_id;
      IF v_folder.exam_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.user_access ua
          WHERE ua.user_id = p_user_id
            AND ua.item_type = ''exam''
            AND ua.item_id::text = v_folder.exam_id::text
            AND (ua.is_active IS NULL OR ua.is_active = true)
            AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
            AND (ua.expires_at IS NULL OR ua.expires_at > now())
        ) INTO v_has_direct;

        IF v_has_direct THEN
          RETURN true;
        END IF;
      END IF;
    END IF;
  END IF;

  -- 3. Check hierarchical folder access for the parent folder
  IF v_chapter.folder_id IS NOT NULL THEN
    RETURN public.user_has_folder_access(p_user_id, v_chapter.folder_id);
  END IF;

  RETURN false;
END;
$$","-- 7. RECREATE ONE CANONICAL check_user_access RPC
CREATE OR REPLACE FUNCTION public.check_user_access(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_type TEXT := lower(trim(p_item_type));
  v_uuid UUID;
  v_exam RECORD;
  v_has_access BOOLEAN := false;
BEGIN
  IF p_item_id IS NULL OR p_item_id = '''' THEN
    RETURN false;
  END IF;

  -- Try converting item_id to UUID
  BEGIN
    v_uuid := p_item_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_uuid := NULL;
  END;

  -- 1. EXAM ACCESS
  IF v_clean_type = ''exam'' THEN
    IF v_uuid IS NOT NULL THEN
      SELECT access_mode, price INTO v_exam FROM public.exams WHERE id = v_uuid;
      -- Free exam
      IF FOUND AND (v_exam.access_mode = ''free'' OR v_exam.price IS NULL OR v_exam.price <= 0) THEN
        RETURN true;
      END IF;
    END IF;

    -- Check user purchase
    IF p_user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_access ua
        WHERE ua.user_id = p_user_id
          AND ua.item_type = ''exam''
          AND ua.item_id::text = p_item_id
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
      ) INTO v_has_access;

      RETURN v_has_access;
    END IF;

    RETURN false;

  -- 2. FOLDER ACCESS (Hierarchical)
  ELSIF v_clean_type = ''folder'' THEN
    IF v_uuid IS NOT NULL THEN
      RETURN public.user_has_folder_access(p_user_id, v_uuid);
    END IF;
    RETURN false;

  -- 3. CHAPTER ACCESS (Hierarchical)
  ELSIF v_clean_type = ''chapter'' THEN
    IF v_uuid IS NOT NULL THEN
      RETURN public.user_has_chapter_access(p_user_id, v_uuid);
    END IF;
    RETURN false;

  -- 4. OTHER ENTITLEMENTS (Tools, general passes, combo keys)
  ELSE
    IF p_user_id IS NULL THEN
      RETURN false;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = v_clean_type
        AND ua.item_id::text = p_item_id
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN (''active'', ''granted'', ''lifetime''))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_access;

    RETURN v_has_access;
  END IF;
END;
$$","-- 8. PERMISSIVE ADMIN RLS AND GRANTS TO PREVENT DELETION BLOCKING
DROP POLICY IF EXISTS \"Admins manage exams\" ON public.exams","CREATE POLICY \"Admins manage exams\" ON public.exams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Admins manage folders\" ON public.folders","CREATE POLICY \"Admins manage folders\" ON public.folders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Admins manage chapters\" ON public.chapters","CREATE POLICY \"Admins manage chapters\" ON public.chapters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Admins manage tests\" ON public.tests","CREATE POLICY \"Admins manage tests\" ON public.tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Admins manage questions\" ON public.questions","CREATE POLICY \"Admins manage questions\" ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Admins manage test questions\" ON public.test_questions","CREATE POLICY \"Admins manage test questions\" ON public.test_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated","GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated","GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated","GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated","GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated","GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_questions TO authenticated","GRANT EXECUTE ON FUNCTION public.check_user_access(UUID, TEXT, TEXT) TO anon, authenticated","GRANT EXECUTE ON FUNCTION public.user_has_folder_access(UUID, UUID) TO anon, authenticated","GRANT EXECUTE ON FUNCTION public.user_has_chapter_access(UUID, UUID) TO anon, authenticated","-- 9. NOTIFY POSTGREST SCHEMA RELOAD
NOTIFY pgrst, ''reload schema''"}', 'fix_check_access_and_exam_pricing'),
	('20261112230000', '{"-- ==============================================================================
-- Zyvra Migration: Allow payment_orders and user_access serverless checkout RLS
-- Timestamp: 20261112230000
-- Enables anon & authenticated serverless endpoints to insert/update checkout orders
-- and fulfill user access when service role key falls back to anon or authenticated JWT.
-- ==============================================================================

-- 1. Ensure tables exist
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- 2. Ensure RLS is active
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY","ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY","-- 3. Payment Orders RLS Policies for checkout creation & verification
DROP POLICY IF EXISTS \"Allow checkout creation of payment orders\" ON public.payment_orders","CREATE POLICY \"Allow checkout creation of payment orders\"
  ON public.payment_orders FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NOT NULL)","DROP POLICY IF EXISTS \"Allow checkout updates to payment orders\" ON public.payment_orders","CREATE POLICY \"Allow checkout updates to payment orders\"
  ON public.payment_orders FOR UPDATE TO anon, authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL)","DROP POLICY IF EXISTS \"Allow checkout reads of payment orders\" ON public.payment_orders","CREATE POLICY \"Allow checkout reads of payment orders\"
  ON public.payment_orders FOR SELECT TO anon, authenticated
  USING (user_id IS NOT NULL)","-- 4. User Access RLS Policies for entitlement fulfillment & checking
DROP POLICY IF EXISTS \"Allow granting of user access\" ON public.user_access","CREATE POLICY \"Allow granting of user access\"
  ON public.user_access FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NOT NULL)","DROP POLICY IF EXISTS \"Allow updating user access\" ON public.user_access","CREATE POLICY \"Allow updating user access\"
  ON public.user_access FOR UPDATE TO anon, authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL)","DROP POLICY IF EXISTS \"Allow reading user access\" ON public.user_access","CREATE POLICY \"Allow reading user access\"
  ON public.user_access FOR SELECT TO anon, authenticated
  USING (user_id IS NOT NULL)","-- 5. Table Grants
GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO anon, authenticated","GRANT SELECT, INSERT, UPDATE ON public.user_access TO anon, authenticated","-- 6. Reload schema
NOTIFY pgrst, ''reload schema''"}', 'allow_payment_orders_and_access_serverless_rls'),
	('20261112170000', '{"-- ==============================================================================
-- Migration: Test Deletion Cascades & Admin RLS Integrity
-- Timestamp: 20261112170000
-- Ensures foreign keys referencing public.tests(id) cascade on delete,
-- and admins have full DELETE / ALL permissions on tests, test_questions, and test_attempts.
-- ==============================================================================

-- 1. Ensure test_questions has ON DELETE CASCADE on test_id
DO $$
DECLARE
  v_con_name TEXT;
BEGIN
  FOR v_con_name IN (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = ''public''
      AND rel.relname = ''test_questions''
      AND con.contype = ''f''
      AND (
        con.conname LIKE ''%test_id%'' OR
        pg_get_constraintdef(con.oid) LIKE ''%REFERENCES public.tests%''
      )
  )
  LOOP
    EXECUTE format(''ALTER TABLE public.test_questions DROP CONSTRAINT IF EXISTS %I'', v_con_name);
  END LOOP;

  ALTER TABLE public.test_questions
    ADD CONSTRAINT test_questions_test_id_fkey
    FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
END
$$","-- 2. Ensure test_attempts (if exists) has ON DELETE CASCADE on test_id
DO $$
DECLARE
  v_con_name TEXT;
  v_table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ''public'' AND c.relname = ''test_attempts''
  ) INTO v_table_exists;

  IF v_table_exists THEN
    FOR v_con_name IN (
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = ''public''
        AND rel.relname = ''test_attempts''
        AND con.contype = ''f''
        AND (
          con.conname LIKE ''%test_id%'' OR
          pg_get_constraintdef(con.oid) LIKE ''%REFERENCES public.tests%''
        )
    )
    LOOP
      EXECUTE format(''ALTER TABLE public.test_attempts DROP CONSTRAINT IF EXISTS %I'', v_con_name);
    END LOOP;

    ALTER TABLE public.test_attempts
      ADD CONSTRAINT test_attempts_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
  END IF;
END
$$","-- 3. Ensure comprehensive Admin RLS policies (FOR ALL including DELETE)
DROP POLICY IF EXISTS \"Admins manage tests\" ON public.tests","CREATE POLICY \"Admins manage tests\"
  ON public.tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DROP POLICY IF EXISTS \"Admins manage test questions\" ON public.test_questions","CREATE POLICY \"Admins manage test questions\"
  ON public.test_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ''public'' AND c.relname = ''test_attempts''
  ) THEN
    EXECUTE ''DROP POLICY IF EXISTS \"Admins manage test attempts\" ON public.test_attempts'';
    EXECUTE ''CREATE POLICY \"Admins manage test attempts\" ON public.test_attempts FOR ALL TO authenticated '' ||
            ''USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''''admin'''', ''''super_admin''''))) '' ||
            ''WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''''admin'''', ''''super_admin'''')))'';
    EXECUTE ''GRANT ALL ON public.test_attempts TO authenticated'';
  END IF;
END
$$","GRANT ALL ON public.tests, public.test_questions TO authenticated","-- 4. Reload PostgREST schema cache
NOTIFY pgrst, ''reload schema''"}', 'test_deletion_cascades_and_rls'),
	('20261112180000', '{"-- ==============================================================================
-- Migration: Fix student_bookmarks Schema & Access Policies
-- Timestamp: 20261112180000
-- Safely adds chapter_id and resource_id to public.student_bookmarks if missing,
-- and ensures authenticated users have full access to manage their own bookmarks.
-- ==============================================================================

-- 1. Create table if it doesn''t already exist
CREATE TABLE IF NOT EXISTS public.student_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.chapter_resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- 2. Safely add columns if table existed without them
ALTER TABLE public.student_bookmarks
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.chapter_resources(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()","-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user_chapter
  ON public.student_bookmarks (user_id, chapter_id)","CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user_resource
  ON public.student_bookmarks (user_id, resource_id)","-- 4. Row Level Security policies
ALTER TABLE public.student_bookmarks ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Students manage own bookmarks\" ON public.student_bookmarks","CREATE POLICY \"Students manage own bookmarks\"
  ON public.student_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid())","DROP POLICY IF EXISTS \"Admins manage all bookmarks\" ON public.student_bookmarks","CREATE POLICY \"Admins manage all bookmarks\"
  ON public.student_bookmarks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","GRANT ALL ON public.student_bookmarks TO authenticated","-- 5. Reload PostgREST schema cache
NOTIFY pgrst, ''reload schema''"}', 'fix_student_bookmarks_schema'),
	('20261112190000', '{"-- ==============================================================================
-- Zyvra Migration: Ensure test_attempts answers column and update policies
-- Timestamp: 20261112190000
-- ==============================================================================

ALTER TABLE public.test_attempts
  ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT ''{}''::jsonb","-- Ensure RLS allows students to update their own in_progress / paused attempts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = ''test_attempts'' AND policyname = ''Students can update their own in-progress attempts''
  ) THEN
    CREATE POLICY \"Students can update their own in-progress attempts\"
      ON public.test_attempts
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$","NOTIFY pgrst, ''reload schema''"}', 'dual_persistence_and_order_fallback'),
	('20261112200000', '{"-- Align checkout tables with the payment API while preserving legacy RPC columns.
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS item_title text,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS base_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT ''INR'',
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT ''created'',
  ADD COLUMN IF NOT EXISTS amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_redeemed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_order_id text,
  ADD COLUMN IF NOT EXISTS gateway_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_signature text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()","ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz DEFAULT now()","-- Practice keeps chapter questions in the question bank when their chapter is deleted.
ALTER TABLE public.questions
  ALTER COLUMN chapter_id DROP NOT NULL","DROP POLICY IF EXISTS \"Published questions are readable\" ON public.questions","CREATE POLICY \"Published questions are readable\"
  ON public.questions FOR SELECT TO anon, authenticated
  USING (status = ''published'')","GRANT SELECT ON public.questions TO anon, authenticated","NOTIFY pgrst, ''reload schema''"}', 'payment_orders_schema_alignment'),
	('20261112210000', '{"ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS usage_scope text NOT NULL DEFAULT ''both''","UPDATE public.questions
SET usage_scope = ''both''
WHERE usage_scope IS NULL","ALTER TABLE public.questions
  ALTER COLUMN usage_scope SET DEFAULT ''both'',
  ALTER COLUMN usage_scope SET NOT NULL","DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = ''questions_usage_scope_check''
      AND conrelid = ''public.questions''::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_usage_scope_check
      CHECK (usage_scope IN (''both'', ''practice_only'', ''test_only''));
  END IF;
END
$$","ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Users can insert own payment orders\" ON public.payment_orders","CREATE POLICY \"Users can insert own payment orders\"
  ON public.payment_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id)","DROP POLICY IF EXISTS \"Users can view own payment orders\" ON public.payment_orders","CREATE POLICY \"Users can view own payment orders\"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id)","DROP POLICY IF EXISTS \"Users can update own payment orders\" ON public.payment_orders","CREATE POLICY \"Users can update own payment orders\"
  ON public.payment_orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id)","ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Users can view own user access\" ON public.user_access","CREATE POLICY \"Users can view own user access\"
  ON public.user_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id)","GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO authenticated","GRANT SELECT ON public.user_access TO authenticated","NOTIFY pgrst, ''reload schema''"}', 'question_usage_scope_and_payment_rls'),
	('20261112220000', '{"-- ==============================================================================
-- Zyvra Migration: Fix payment_orders and user_access schema alignment
-- Timestamp: 20261112220000
-- ==============================================================================

-- 1. Ensure public.payment_orders table exists
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- 2. Safely add all required payment_orders columns
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS item_title text,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS base_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT ''INR'',
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT ''created'',
  ADD COLUMN IF NOT EXISTS amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paise bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_redeemed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_order_id text,
  ADD COLUMN IF NOT EXISTS gateway_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_signature text","-- 3. Ensure public.user_access table exists
CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- 4. Safely ensure required user_access columns exist
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS granted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text DEFAULT ''active'',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz","-- 5. Row Level Security and Grants
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY","ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Users can view own payment orders\" ON public.payment_orders","CREATE POLICY \"Users can view own payment orders\"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id)","DROP POLICY IF EXISTS \"Users can insert own payment orders\" ON public.payment_orders","CREATE POLICY \"Users can insert own payment orders\"
  ON public.payment_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id)","DROP POLICY IF EXISTS \"Users can update own payment orders\" ON public.payment_orders","CREATE POLICY \"Users can update own payment orders\"
  ON public.payment_orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id)","DROP POLICY IF EXISTS \"Users can view own user access\" ON public.user_access","CREATE POLICY \"Users can view own user access\"
  ON public.user_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id)","GRANT SELECT, INSERT, UPDATE ON public.payment_orders TO authenticated","GRANT SELECT, INSERT, UPDATE ON public.user_access TO authenticated","-- 6. Reload PostgREST schema cache
NOTIFY pgrst, ''reload schema''"}', 'fix_payment_orders_schema_and_user_access'),
	('20261112233000', '{"-- ==============================================================================
-- Zyvra Migration: Fix payment_orders order_type and base_amount not-null constraints
-- Timestamp: 20261112233000
-- ==============================================================================

-- 1. Ensure all payment_orders columns exist
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS order_type TEXT,
  ADD COLUMN IF NOT EXISTS item_type TEXT,
  ADD COLUMN IF NOT EXISTS item_id TEXT,
  ADD COLUMN IF NOT EXISTS item_title TEXT,
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT,
  ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_before_discount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coin_discount_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coin_discount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_redeemed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT ''created'',
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT ''INR''","-- 2. Drop NOT NULL constraints and set safe defaults on all pricing/metadata columns
DO $$
BEGIN
  -- base_amount
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN base_amount DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN base_amount SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- base_price
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN base_price DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN base_price SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- discount_amount
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN discount_amount DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN discount_amount SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- final_amount
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN final_amount DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN final_amount SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- coins_used
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN coins_used DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN coins_used SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- coins_redeemed
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN coins_redeemed DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN coins_redeemed SET DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- order_type
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN order_type DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN order_type SET DEFAULT ''direct'';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- tier
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN tier DROP NOT NULL;
    ALTER TABLE public.payment_orders ALTER COLUMN tier SET DEFAULT ''standard'';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- item_title
  BEGIN
    ALTER TABLE public.payment_orders ALTER COLUMN item_title DROP NOT NULL;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$","-- 3. Backfill any existing nulls
UPDATE public.payment_orders
  SET order_type = COALESCE(order_type, item_type, ''direct''),
      base_amount = COALESCE(base_amount, base_price, amount, 0),
      base_price = COALESCE(base_price, base_amount, amount, 0),
      discount_amount = COALESCE(discount_amount, 0),
      final_amount = COALESCE(final_amount, amount, 0),
      coins_used = COALESCE(coins_used, coins_redeemed, 0),
      coins_redeemed = COALESCE(coins_redeemed, coins_used, 0),
      tier = COALESCE(tier, item_type, ''standard''),
      currency = COALESCE(currency, ''INR''),
      status = COALESCE(status, ''created'')
  WHERE base_amount IS NULL
     OR base_price IS NULL
     OR order_type IS NULL
     OR final_amount IS NULL
     OR discount_amount IS NULL","-- 4. Update create_checkout_order RPC to populate all required columns
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_item_type TEXT,
  p_item_id TEXT,
  p_coins_to_redeem INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_clean_type TEXT;
  v_base_price NUMERIC(10, 2) := 0;
  v_item_title TEXT := '''';
  v_coins_per_rupee NUMERIC := 10;
  v_max_discount_pct NUMERIC := 20;
  v_wallet_balance INTEGER := 0;
  v_max_coins INTEGER := 0;
  v_coins_used INTEGER := 0;
  v_discount NUMERIC(10, 2) := 0;
  v_payable NUMERIC(10, 2) := 0;
  v_amount_paise BIGINT := 0;
  v_order_id UUID;
  v_conf JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION ''Not authenticated'';
  END IF;

  v_clean_type := lower(trim(p_item_type));
  IF v_clean_type NOT IN (''folder'', ''chapter'', ''exam'') THEN
    RAISE EXCEPTION ''Invalid item_type: %'', p_item_type;
  END IF;

  -- 1. Fetch authoritative base price and title
  IF v_clean_type = ''folder'' THEN
    SELECT COALESCE(price, 0), COALESCE(title, '''') INTO v_base_price, v_item_title FROM public.folders WHERE id = p_item_id::UUID;
  ELSIF v_clean_type = ''chapter'' THEN
    SELECT COALESCE(price, 0), COALESCE(title, '''') INTO v_base_price, v_item_title FROM public.chapters WHERE id = p_item_id::UUID;
  ELSIF v_clean_type = ''exam'' THEN
    SELECT COALESCE(price, 0), COALESCE(title, '''') INTO v_base_price, v_item_title FROM public.exams WHERE id = p_item_id::UUID;
  END IF;

  IF v_base_price <= 0 THEN
    RAISE EXCEPTION ''Item has no price or is free'';
  END IF;

  -- 2. Read redemption config
  SELECT COALESCE(setting_value, value) INTO v_conf
  FROM public.platform_settings
  WHERE setting_key = ''coin_redemption_config'' OR key = ''coin_redemption_config''
  LIMIT 1;

  IF v_conf IS NOT NULL THEN
    v_coins_per_rupee := COALESCE((v_conf->>''coins_per_rupee'')::NUMERIC, 10);
    v_max_discount_pct := COALESCE((v_conf->>''max_discount_percent'')::NUMERIC, 20);
  END IF;

  -- 3. Calculate coin discount
  SELECT COALESCE(balance, 0) INTO v_wallet_balance
  FROM public.coin_wallets
  WHERE user_id = v_user_id;

  v_max_coins := LEAST(
    v_wallet_balance,
    FLOOR(v_base_price * (v_max_discount_pct / 100.0) * v_coins_per_rupee)::INTEGER
  );

  IF p_coins_to_redeem > 0 AND v_max_coins > 0 THEN
    v_coins_used := LEAST(p_coins_to_redeem, v_max_coins);
    v_discount := ROUND((v_coins_used::NUMERIC / v_coins_per_rupee), 2);
    v_discount := LEAST(v_base_price, v_discount);
  ELSE
    v_coins_used := 0;
    v_discount := 0;
  END IF;

  v_payable := GREATEST(0, v_base_price - v_discount);
  v_amount_paise := ROUND(v_payable * 100)::BIGINT;

  -- 4. Create internal payment order with ALL columns populated
  INSERT INTO public.payment_orders (
    user_id,
    order_type,
    item_type,
    item_id,
    item_title,
    tier,
    base_amount,
    base_price,
    coins_used,
    coins_redeemed,
    discount_amount,
    final_amount,
    amount,
    amount_paise,
    status,
    currency
  )
  VALUES (
    v_user_id,
    v_clean_type,
    v_clean_type,
    p_item_id,
    v_item_title,
    v_clean_type,
    v_base_price,
    v_base_price,
    v_coins_used,
    v_coins_used,
    v_discount,
    v_payable,
    v_payable,
    v_amount_paise,
    ''created'',
    ''INR''
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    ''order'', jsonb_build_object(
      ''id'', v_order_id,
      ''order_type'', v_clean_type,
      ''item_type'', v_clean_type,
      ''item_id'', p_item_id,
      ''item_title'', v_item_title,
      ''base_amount'', v_base_price,
      ''base_price'', v_base_price,
      ''coins_used'', v_coins_used,
      ''discount'', v_discount,
      ''discount_amount'', v_discount,
      ''final_amount'', v_payable,
      ''amount'', v_payable,
      ''amount_paise'', v_amount_paise,
      ''currency'', ''INR'',
      ''status'', ''created''
    )
  );
END;
$$","NOTIFY pgrst, ''reload schema''"}', 'fix_payment_orders_order_type_constraint'),
	('20261112235000', '{"-- ==============================================================================
-- Zyvra Migration: Idempotent Payment Fulfillment & Complete Checkout Hardening
-- Timestamp: 20261112235000
-- 1. Ensures coin_wallets, coin_ledger, and coin_transactions tables exist with RLS
-- 2. Updates complete_successful_checkout RPC with strict idempotency (no double coin deduction)
-- 3. Matches orders by internal UUID, razorpay_order_id, or gateway_order_id
-- 4. Grants active entitlement in public.user_access
-- 5. Deducts coins safely and logs to coin_ledger & coin_transactions
-- ==============================================================================

-- 1. Ensure coin_wallets, coin_ledger, and coin_transactions exist before configuring policies
CREATE TABLE IF NOT EXISTS public.coin_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = ''coin_wallets_user_id_key''
  ) THEN
    ALTER TABLE public.coin_wallets ADD CONSTRAINT coin_wallets_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$","CREATE TABLE IF NOT EXISTS public.coin_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL DEFAULT ''credit'',
  reason TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL DEFAULT ''credit'',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)","-- 2. Enable RLS and setup user self-service read policies
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY","ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY","ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Users can read own coin wallet\" ON public.coin_wallets","CREATE POLICY \"Users can read own coin wallet\"
  ON public.coin_wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid())","DROP POLICY IF EXISTS \"Users can read own coin ledger\" ON public.coin_ledger","CREATE POLICY \"Users can read own coin ledger\"
  ON public.coin_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid())","DROP POLICY IF EXISTS \"Users can read own coin transactions\" ON public.coin_transactions","CREATE POLICY \"Users can read own coin transactions\"
  ON public.coin_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid())","GRANT SELECT ON public.coin_wallets TO anon, authenticated","GRANT SELECT ON public.coin_ledger TO anon, authenticated","GRANT SELECT ON public.coin_transactions TO anon, authenticated","-- 3. IDEMPOTENT complete_successful_checkout RPC
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_payment_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_order_uuid UUID;
  v_coins_to_deduct INTEGER := 0;
BEGIN
  -- Locate order in payment_orders by UUID, razorpay_order_id, or gateway_order_id
  BEGIN
    v_order_uuid := p_order_id::UUID;
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = v_order_uuid
       OR gateway_order_id = p_order_id
       OR razorpay_order_id = p_order_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE gateway_order_id = p_order_id
       OR razorpay_order_id = p_order_id
    LIMIT 1;
  END;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Payment order not found.'');
  END IF;

  -- Idempotency Check: If already paid, do not deduct coins again, just ensure user_access
  IF v_order.status = ''paid'' THEN
    INSERT INTO public.user_access (
      user_id,
      item_type,
      item_id,
      status,
      is_active,
      starts_at,
      created_at,
      updated_at
    )
    VALUES (
      v_order.user_id,
      COALESCE(v_order.item_type, v_order.order_type, ''folder''),
      v_order.item_id::text,
      ''active'',
      true,
      now(),
      now(),
      now()
    )
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET
      status = ''active'',
      is_active = true,
      updated_at = now();

    RETURN jsonb_build_object(
      ''success'', true,
      ''already_fulfilled'', true,
      ''message'', ''Payment already verified and access is active.''
    );
  END IF;

  -- Mark payment_order as paid
  UPDATE public.payment_orders
  SET
    status = ''paid'',
    gateway_payment_id = COALESCE(p_payment_id, gateway_payment_id),
    razorpay_payment_id = COALESCE(p_payment_id, razorpay_payment_id),
    payment_signature = COALESCE(p_payment_signature, payment_signature),
    razorpay_signature = COALESCE(p_payment_signature, razorpay_signature),
    amount_paid = COALESCE(final_amount, amount, 0),
    updated_at = now()
  WHERE id = v_order.id;

  -- Upsert active entitlement into user_access
  INSERT INTO public.user_access (
    user_id,
    item_type,
    item_id,
    status,
    is_active,
    starts_at,
    created_at,
    updated_at
  )
  VALUES (
    v_order.user_id,
    COALESCE(v_order.item_type, v_order.order_type, ''folder''),
    v_order.item_id::text,
    ''active'',
    true,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET
    status = ''active'',
    is_active = true,
    updated_at = now();

  -- Deduct redeemed coins safely from wallet and record ledger entry
  v_coins_to_deduct := COALESCE(v_order.coins_redeemed, v_order.coins_used, 0);
  IF v_coins_to_deduct > 0 THEN
    UPDATE public.coin_wallets
    SET
      balance = GREATEST(0, balance - v_coins_to_deduct),
      updated_at = now()
    WHERE user_id = v_order.user_id;

    INSERT INTO public.coin_ledger (
      user_id,
      amount,
      transaction_type,
      reason,
      description,
      created_at
    )
    VALUES (
      v_order.user_id,
      -v_coins_to_deduct,
      ''redeem'',
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, COALESCE(v_order.item_type, v_order.order_type, ''content'')),
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, COALESCE(v_order.item_type, v_order.order_type, ''content'')),
      now()
    );

    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      transaction_type,
      description,
      created_at
    )
    VALUES (
      v_order.user_id,
      -v_coins_to_deduct,
      ''redeem'',
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, COALESCE(v_order.item_type, v_order.order_type, ''content'')),
      now()
    );
  END IF;

  RETURN jsonb_build_object(''success'', true, ''message'', ''Payment verified and access entitlement granted.'');
END;
$$","-- 4. RPC Grants
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO anon, authenticated","-- 5. Notify PostgREST schema reload
NOTIFY pgrst, ''reload schema''"}', 'idempotent_complete_successful_checkout'),
	('20261112236000', '{"-- ==============================================================================
-- Zyvra Migration: Allow Student Read Access on Published Questions & Test Questions
-- Timestamp: 20261112236000
-- Enables authenticated & anon students to read published questions and test questions
-- for Practice Mode and Test Mode (immediate solution mode feedback).
-- ==============================================================================

-- 1. Published questions read policy
DROP POLICY IF EXISTS \"Published questions are readable\" ON public.questions","CREATE POLICY \"Published questions are readable\"
  ON public.questions FOR SELECT TO anon, authenticated
  USING (
    status IN (''published'', ''active'', ''live'', ''available'')
    OR status IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')
    )
  )","-- 2. Published test questions read policy
DROP POLICY IF EXISTS \"Published test questions are readable\" ON public.test_questions","CREATE POLICY \"Published test questions are readable\"
  ON public.test_questions FOR SELECT TO anon, authenticated
  USING (true)","-- 3. Ensure SELECT grants for anon and authenticated
GRANT SELECT ON public.questions TO anon, authenticated","GRANT SELECT ON public.test_questions TO anon, authenticated","-- 4. Reload PostgREST schema cache
NOTIFY pgrst, ''reload schema''"}', 'allow_student_read_published_questions'),
	('20261112237000', '{"-- ==============================================================================
-- Fix get_live_test_questions RPC functions to include correct_answer & explanations
-- in immediate solution mode, and ensure execute permissions for anon & authenticated.
-- ==============================================================================

-- 1. Drop existing functions to allow altering output signatures cleanly
DROP FUNCTION IF EXISTS public.get_live_test_questions(uuid)","DROP FUNCTION IF EXISTS public.get_live_test_questions(uuid, uuid)","-- 2. get_live_test_questions(p_test_id uuid, p_attempt_id uuid)
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
  -- Look up test''s solution_mode
  SELECT lower(coalesce(t.solution_mode, '''')) INTO v_solution_mode
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

    IF FOUND AND lower(coalesce(v_attempt.status, '''')) IN (''completed'', ''submitted'') THEN
      v_include_solutions := true;
    END IF;
  END IF;

  -- Immediate feedback mode always includes answers & explanations for active practice/test
  IF v_solution_mode = ''immediate'' THEN
    v_include_solutions := true;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        ''id'', q.id,
        ''question_id'', q.id,
        ''test_question_id'', tq.id,
        ''display_order'', tq.display_order,
        ''marks'', tq.marks,
        ''question_text'', q.question_text,
        ''question_text_hi'', q.question_text_hi,
        ''options'', q.options,
        ''options_hi'', q.options_hi,
        ''subject'', q.subject,
        ''topic'', q.topic,
        ''tags'', q.tags,
        ''difficulty'', q.difficulty,
        ''question_type'', q.question_type,
        ''correct_answer'', CASE 
          WHEN v_include_solutions THEN q.correct_answer 
          ELSE NULL 
        END,
        ''explanation'', CASE 
          WHEN v_include_solutions THEN q.explanation 
          ELSE NULL 
        END,
        ''explanation_hi'', CASE 
          WHEN v_include_solutions THEN q.explanation_hi 
          ELSE NULL 
        END,
        ''distractor_notes'', CASE 
          WHEN v_include_solutions THEN q.distractor_notes 
          ELSE NULL 
        END,
        ''distractor_notes_hi'', CASE 
          WHEN v_include_solutions THEN q.distractor_notes_hi 
          ELSE NULL 
        END
      ) ORDER BY tq.display_order, tq.id
    ),
    ''[]''::jsonb
  )
  INTO v_questions
  FROM public.test_questions AS tq
  JOIN public.questions AS q ON (q.id = tq.question_id OR q.id = tq.id)
  WHERE tq.test_id = p_test_id
    AND lower(coalesce(q.status, ''published'')) = ''published'';

  RETURN jsonb_build_object(''questions'', v_questions);
END;
$$","-- 3. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_live_test_questions(uuid, uuid) TO anon, authenticated, service_role","-- 4. Ensure published questions and test_questions remain readable by anon & authenticated
GRANT SELECT ON public.questions TO anon, authenticated","GRANT SELECT ON public.test_questions TO anon, authenticated"}', 'fix_get_live_test_questions_rpc'),
	('20261112239000', '{"-- ==============================================================================
-- System-Wide Database Refinements & Security Hardening
-- 1. RLS Hardening: Lock down payment_orders, user_access, and coin tables.
-- 2. Schema Compatibility: Ensure test_attempts has completed_at, total_score, total_marks.
-- 3. Tests Visibility: Allow published standalone and chapter-linked tests to be read.
-- 4. RPC Hardening: Idempotent, transaction-safe complete_successful_checkout with strict rollback.
-- ==============================================================================

-- 1. Schema Compatibility for test_attempts
ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ","ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS total_score NUMERIC","ALTER TABLE public.test_attempts ADD COLUMN IF NOT EXISTS total_marks NUMERIC","UPDATE public.test_attempts
SET completed_at = submitted_at
WHERE completed_at IS NULL AND submitted_at IS NOT NULL","UPDATE public.test_attempts
SET total_score = score
WHERE total_score IS NULL AND score IS NOT NULL","UPDATE public.test_attempts
SET total_marks = max_score
WHERE total_marks IS NULL AND max_score IS NOT NULL","-- 2. Update submit_test_attempt to also update completed_at
CREATE OR REPLACE FUNCTION public.submit_test_attempt(
  p_attempt_id uuid,
  p_responses jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    RAISE EXCEPTION ''Authentication required.'' USING ERRCODE = ''28000'';
  END IF;

  IF jsonb_typeof(p_responses) IS DISTINCT FROM ''array'' THEN
    RAISE EXCEPTION ''Responses must be a JSON array.'' USING ERRCODE = ''22023'';
  END IF;

  SELECT a.* INTO v_attempt
  FROM public.test_attempts AS a
  WHERE a.id = p_attempt_id AND a.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Test attempt not found.'' USING ERRCODE = ''P0002'';
  END IF;

  IF lower(coalesce(v_attempt.status, '''')) = ''completed'' THEN
    RETURN jsonb_build_object(
      ''attempt_id'', v_attempt.id,
      ''status'', v_attempt.status
    );
  END IF;

  IF lower(coalesce(v_attempt.status, '''')) NOT IN
     (''started'', ''in_progress'', ''in progress'', ''pending'') THEN
    RAISE EXCEPTION ''This test attempt cannot be submitted.'' USING ERRCODE = ''P0001'';
  END IF;

  SELECT t.* INTO v_test
  FROM public.tests AS t
  WHERE t.id = v_attempt.test_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Test configuration not found.'' USING ERRCODE = ''P0002'';
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
    RAISE EXCEPTION ''A response references a question outside this test.'' USING ERRCODE = ''22023'';
  END IF;

  IF EXISTS (
    SELECT submitted.question_id
    FROM jsonb_to_recordset(p_responses) AS submitted(question_id uuid)
    GROUP BY submitted.question_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION ''Duplicate question responses are not allowed.'' USING ERRCODE = ''22023'';
  END IF;

  v_pattern := lower(coalesce(
    v_test.pattern,
    v_test.pattern_type,
    v_test.question_pattern,
    ''''
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
        WHEN jsonb_typeof(to_jsonb(q)->''correct_answers'') = ''array''
             AND jsonb_array_length(to_jsonb(q)->''correct_answers'') > 0
          THEN to_jsonb(q)->''correct_answers''
        WHEN q.correct_answer IS NOT NULL
          THEN jsonb_build_array(q.correct_answer)
        ELSE ''[]''::jsonb
      END AS answer_keys,
      submitted.selected_option,
      coalesce(submitted.marked_for_review, false) AS marked_for_review,
      CASE
        WHEN jsonb_typeof(q.options) = ''array''
          THEN jsonb_array_length(q.options)
        WHEN jsonb_typeof(q.options) = ''object''
          THEN (
            SELECT count(*)::integer
            FROM jsonb_object_keys(q.options) AS option_key(key)
            WHERE upper(option_key.key) IN (''A'', ''B'', ''C'', ''D'', ''E'')
          )
        ELSE coalesce(v_test.options_count, 0)
      END AS option_count
    FROM public.test_questions AS tq
    JOIN public.questions AS q ON (q.id = tq.question_id OR q.id = tq.id)
    LEFT JOIN LATERAL (
      SELECT
        upper(nullif(btrim(response.selected_option), '''')) AS selected_option,
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
    ORDER BY tq.display_order, tq.id
  LOOP
    v_total_count := v_total_count + 1;
    v_question_marks := greatest(coalesce(v_row.question_marks, 0), 0);
    v_max_score := v_max_score + v_question_marks;
    v_selected := v_row.selected_option;

    IF v_selected IS NOT NULL AND (
      v_selected NOT IN (''A'', ''B'', ''C'', ''D'', ''E'')
      OR (v_row.option_count > 0
          AND ascii(v_selected) - ascii(''A'') + 1 > v_row.option_count)
    ) THEN
      RAISE EXCEPTION ''Invalid selected option for question %.'', v_row.question_id USING ERRCODE = ''22023'';
    END IF;

    IF v_selected IS NULL THEN
      v_blank_count := v_blank_count + 1;
      v_is_correct := false;

      IF v_pattern IN (
        ''bpsc-mandatory-e'',
        ''bpsc_mandatory_e'',
        ''mandatory-e'',
        ''mandatory_option_e''
      ) THEN
        v_marks_obtained := -v_blank_penalty;
        IF v_blank_penalty > 0 THEN
          v_blank_penalty_count := v_blank_penalty_count + 1;
          v_blank_deductions := v_blank_deductions + v_blank_penalty;
        END IF;
      ELSE
        v_marks_obtained := 0;
      END IF;
    ELSE
      v_attempted_count := v_attempted_count + 1;

      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_row.answer_keys) AS answer_key(value)
        WHERE upper(btrim(answer_key.value)) = v_selected
      )
      INTO v_is_correct;

      IF v_is_correct THEN
        v_correct_count := v_correct_count + 1;
        v_marks_obtained := v_question_marks;
        v_positive_score := v_positive_score + v_marks_obtained;
      ELSE
        v_incorrect_count := v_incorrect_count + 1;
        v_marks_obtained := -v_negative_marks;
        v_negative_deductions := v_negative_deductions + v_negative_marks;
      END IF;
    END IF;

    v_score := v_score + v_marks_obtained;

    INSERT INTO public.test_responses (
      attempt_id,
      question_id,
      selected_answers,
      is_marked_for_review,
      is_correct,
      marks_obtained
    )
    VALUES (
      p_attempt_id,
      v_row.question_id,
      CASE
        WHEN v_selected IS NULL THEN ARRAY[]::text[]
        ELSE ARRAY[v_selected]::text[]
      END,
      v_row.marked_for_review,
      v_is_correct,
      v_marks_obtained
    );
  END LOOP;

  IF v_total_count = 0 THEN
    RAISE EXCEPTION ''This test has no published questions to submit.'' USING ERRCODE = ''P0001'';
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
  SET status = ''completed'',
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
    ''attempt_id'', p_attempt_id,
    ''status'', ''completed'',
    ''score'', v_score,
    ''max_score'', v_max_score,
    ''total_score'', v_score,
    ''total_marks'', v_max_score,
    ''percentage'', v_percentage,
    ''positive_score'', v_positive_score,
    ''negative_deductions'', v_negative_deductions,
    ''blank_penalty_deductions'', v_blank_deductions,
    ''coins_awarded'', coalesce(v_attempt.coins_awarded, 0)
  );
END;
$$","GRANT EXECUTE ON FUNCTION public.submit_test_attempt(uuid, jsonb) TO anon, authenticated, service_role","-- 3. Hardened, Idempotent complete_successful_checkout RPC
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_payment_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_order_uuid UUID;
  v_coins_to_deduct INTEGER := 0;
  v_resolved_item_type TEXT;
  v_resolved_item_id TEXT;
BEGIN
  -- 1. Locate order by UUID or gateway/razorpay ID
  BEGIN
    v_order_uuid := p_order_id::UUID;
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = v_order_uuid
       OR gateway_order_id = p_order_id
       OR razorpay_order_id = p_order_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE gateway_order_id = p_order_id
       OR razorpay_order_id = p_order_id
    LIMIT 1;
  END;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Payment order not found.'');
  END IF;

  -- Normalize item_type to satisfy user_access constraint (''exam'', ''folder'', ''chapter'')
  v_resolved_item_type := CASE 
    WHEN lower(COALESCE(v_order.item_type, v_order.order_type, '''')) IN (''exam'', ''folder'', ''chapter'') 
      THEN lower(COALESCE(v_order.item_type, v_order.order_type))
    ELSE ''folder''
  END;
  v_resolved_item_id := v_order.item_id::text;

  -- 2. Idempotency Check: If already marked paid, return success without re-deducting coins
  IF v_order.status = ''paid'' THEN
    INSERT INTO public.user_access (
      user_id,
      item_type,
      item_id,
      grant_source,
      status,
      is_active,
      starts_at,
      created_at,
      updated_at
    )
    VALUES (
      v_order.user_id,
      v_resolved_item_type,
      v_resolved_item_id,
      ''purchase'',
      ''active'',
      true,
      now(),
      now(),
      now()
    )
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET
      status = ''active'',
      is_active = true,
      updated_at = now();

    RETURN jsonb_build_object(
      ''success'', true,
      ''already_fulfilled'', true,
      ''message'', ''Payment already verified and access entitlement is active.''
    );
  END IF;

  -- 3. Mark payment_order as paid
  UPDATE public.payment_orders
  SET
    status = ''paid'',
    gateway_payment_id = COALESCE(p_payment_id, gateway_payment_id),
    razorpay_payment_id = COALESCE(p_payment_id, razorpay_payment_id),
    payment_signature = COALESCE(p_payment_signature, payment_signature),
    razorpay_signature = COALESCE(p_payment_signature, razorpay_signature),
    amount_paid = COALESCE(final_amount, amount, 0),
    updated_at = now()
  WHERE id = v_order.id;

  -- 4. Upsert active entitlement into user_access
  INSERT INTO public.user_access (
    user_id,
    item_type,
    item_id,
    grant_source,
    status,
    is_active,
    starts_at,
    created_at,
    updated_at
  )
  VALUES (
    v_order.user_id,
    v_resolved_item_type,
    v_resolved_item_id,
    ''purchase'',
    ''active'',
    true,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET
    status = ''active'',
    is_active = true,
    updated_at = now();

  -- 5. Deduct redeemed coins safely from wallet and record ledger entry
  v_coins_to_deduct := COALESCE(v_order.coins_redeemed, v_order.coins_used, 0);
  IF v_coins_to_deduct > 0 THEN
    -- Ensure wallet exists
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_order.user_id, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.coin_wallets
    SET
      balance = GREATEST(0, balance - v_coins_to_deduct),
      updated_at = now()
    WHERE user_id = v_order.user_id;

    INSERT INTO public.coin_ledger (
      user_id,
      amount,
      transaction_type,
      reason,
      description,
      created_at
    )
    VALUES (
      v_order.user_id,
      -v_coins_to_deduct,
      ''redeem'',
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_resolved_item_type),
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_resolved_item_type),
      now()
    );

    INSERT INTO public.coin_transactions (
      user_id,
      amount,
      type,
      transaction_type,
      reason,
      description,
      reference_id,
      created_at
    )
    VALUES (
      v_order.user_id,
      -v_coins_to_deduct,
      ''redeem'',
      ''redeem'',
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_resolved_item_type),
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_resolved_item_type),
      v_order.id::text,
      now()
    );
  END IF;

  RETURN jsonb_build_object(''success'', true, ''message'', ''Payment verified and access entitlement granted.'');
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$","GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO anon, authenticated, service_role","-- 4. RLS Hardening: payment_orders
DROP POLICY IF EXISTS \"Allow checkout updates to payment orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Allow checkout reads of payment orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Users can view own payment orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Users can update own payment orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Allow checkout creation of payment orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Allow checkout order insert\" ON public.payment_orders","DROP POLICY IF EXISTS \"Users insert own orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Users can read own orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Users read own payment orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Admins manage all orders\" ON public.payment_orders","DROP POLICY IF EXISTS \"Admins manage payment orders\" ON public.payment_orders","CREATE POLICY \"Admins manage payment orders\"
  ON public.payment_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","CREATE POLICY \"Users read own payment orders\"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid())","CREATE POLICY \"Users insert own pending orders\"
  ON public.payment_orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (status IS NULL OR status = ''pending''))","-- 5. RLS Hardening: user_access
DROP POLICY IF EXISTS \"Allow granting of user access\" ON public.user_access","DROP POLICY IF EXISTS \"Allow reading user access\" ON public.user_access","DROP POLICY IF EXISTS \"Allow updating user access\" ON public.user_access","DROP POLICY IF EXISTS \"Allow user_access insert and update\" ON public.user_access","DROP POLICY IF EXISTS \"Users can read own access\" ON public.user_access","DROP POLICY IF EXISTS \"Users can view own user access\" ON public.user_access","DROP POLICY IF EXISTS \"Users read own access grants\" ON public.user_access","DROP POLICY IF EXISTS \"Admins manage all access\" ON public.user_access","DROP POLICY IF EXISTS \"Admins manage all access grants\" ON public.user_access","DROP POLICY IF EXISTS \"Admins manage user_access\" ON public.user_access","CREATE POLICY \"Admins manage user_access\"
  ON public.user_access FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))","CREATE POLICY \"Users read own user_access\"
  ON public.user_access FOR SELECT TO authenticated
  USING (user_id = auth.uid())","-- 6. Tests Visibility: ensure standalone and chapter-linked published tests are readable
DROP POLICY IF EXISTS \"Published tests are readable\" ON public.tests","DROP POLICY IF EXISTS \"Public read published tests\" ON public.tests","CREATE POLICY \"Published tests are readable\"
  ON public.tests FOR SELECT TO anon, authenticated
  USING (
    status IN (''published'', ''live'', ''available'')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin''))
  )","GRANT SELECT ON public.tests TO anon, authenticated","GRANT SELECT ON public.payment_orders TO authenticated","GRANT SELECT ON public.user_access TO authenticated"}', 'system_wide_refinements'),
	('20261113190000', '{"-- ==============================================================================
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
      WHERE p.id = v_user_id AND lower(trim(p.role)) IN (''admin'', ''super_admin'')
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

    IF FOUND AND lower(coalesce(v_attempt.status, '''')) IN (''completed'', ''submitted'') THEN
      v_include_solutions := true;
    END IF;
  END IF;

  -- Notice: We deliberately do NOT bulk-include solutions for in-progress tests,
  -- even in immediate solution mode, to prevent exam cheating.
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        ''id'', q.id,
        ''question_id'', q.id,
        ''test_question_id'', tq.id,
        ''display_order'', tq.display_order,
        ''marks'', tq.marks,
        ''question_text'', q.question_text,
        ''question_text_hi'', q.question_text_hi,
        ''options'', q.options,
        ''options_hi'', q.options_hi,
        ''subject'', q.subject,
        ''topic'', q.topic,
        ''tags'', q.tags,
        ''difficulty'', q.difficulty,
        ''question_type'', q.question_type,
        ''correct_answer'', CASE 
          WHEN v_include_solutions THEN q.correct_answer 
          ELSE NULL 
        END,
        ''explanation'', CASE 
          WHEN v_include_solutions THEN q.explanation 
          ELSE NULL 
        END,
        ''explanation_hi'', CASE 
          WHEN v_include_solutions THEN q.explanation_hi 
          ELSE NULL 
        END,
        ''distractor_notes'', CASE 
          WHEN v_include_solutions THEN q.distractor_notes 
          ELSE NULL 
        END,
        ''distractor_notes_hi'', CASE 
          WHEN v_include_solutions THEN q.distractor_notes_hi 
          ELSE NULL 
        END
      ) ORDER BY tq.display_order, tq.id
    ),
    ''[]''::jsonb
  )
  INTO v_questions
  FROM public.test_questions AS tq
  JOIN public.questions AS q ON (q.id = tq.question_id OR q.id = tq.id)
  WHERE tq.test_id = p_test_id
    AND lower(coalesce(q.status, ''published'')) = ''published'';

  RETURN jsonb_build_object(''questions'', v_questions);
END;
$$","-- 2. Immediate feedback single question solver RPC
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
  SELECT lower(coalesce(t.solution_mode, '''')) INTO v_solution_mode
  FROM public.tests t
  WHERE t.id = p_test_id;

  IF v_solution_mode != ''immediate'' THEN
    RETURN jsonb_build_object(''allowed'', false, ''error'', ''This test does not support immediate feedback.'');
  END IF;

  IF p_selected_option IS NULL OR trim(p_selected_option) = '''' THEN
    RETURN jsonb_build_object(''allowed'', false, ''error'', ''Must select an option before viewing feedback.'');
  END IF;

  SELECT q.* INTO v_question
  FROM public.questions q
  JOIN public.test_questions tq ON (tq.question_id = q.id OR tq.id = q.id)
  WHERE tq.test_id = p_test_id AND q.id = p_question_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(''allowed'', false, ''error'', ''Question not found in test.'');
  END IF;

  RETURN jsonb_build_object(
    ''allowed'', true,
    ''question_id'', v_question.id,
    ''correct_answer'', v_question.correct_answer,
    ''explanation'', v_question.explanation,
    ''explanation_hi'', v_question.explanation_hi,
    ''distractor_notes'', v_question.distractor_notes,
    ''distractor_notes_hi'', v_question.distractor_notes_hi
  );
END;
$$","-- 3. Grants
GRANT EXECUTE ON FUNCTION public.get_live_test_questions(uuid, uuid) TO anon, authenticated, service_role","GRANT EXECUTE ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) TO anon, authenticated, service_role","NOTIFY pgrst, ''reload schema''"}', 'secure_live_test_questions_rpc'),
	('20261113200000', '{"-- ==============================================================================
-- Zyvra Migration: Atomic Referral Claim RPC
-- Timestamp: 20261113200000
-- Eliminates TOCTOU race conditions and non-atomic wallet updates by executing
-- referral verification, ledger logging, and wallet increments in a single ACID transaction.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.claim_referral_code(
  p_ref_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_code text := upper(trim(p_ref_code));
  v_referrer_id uuid;
  v_referrer_coins integer := 50;
  v_referred_coins integer := 20;
  v_referral_enabled boolean := true;
  v_config_row record;
  v_new_referral_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Authentication required.'');
  END IF;

  IF v_clean_code IS NULL OR v_clean_code = '''' THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Invalid referral code.'');
  END IF;

  -- 1. Check platform settings for referral configuration
  SELECT setting_value INTO v_config_row
  FROM public.platform_settings
  WHERE setting_key = ''referral_program_config'' OR key = ''referral_program_config''
  LIMIT 1;

  IF v_config_row.setting_value IS NOT NULL THEN
    v_referral_enabled := coalesce((v_config_row.setting_value->>''referral_enabled'')::boolean, true);
    v_referrer_coins := coalesce((v_config_row.setting_value->>''referrer_reward_coins'')::integer, 50);
    v_referred_coins := coalesce((v_config_row.setting_value->>''referred_reward_coins'')::integer, 20);
  END IF;

  IF NOT v_referral_enabled THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Referral program is currently paused.'');
  END IF;

  -- 2. Find referrer by referral code
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE upper(trim(referral_code)) = v_clean_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Referral code not found.'');
  END IF;

  IF v_referrer_id = v_user_id THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''You cannot refer yourself.'');
  END IF;

  -- 3. Check if current user was already referred
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_user_id) THEN
    RETURN jsonb_build_object(''success'', false, ''already_referred'', true, ''error'', ''Referral already claimed.'');
  END IF;

  -- 4. Insert referral record with ON CONFLICT guard
  INSERT INTO public.referrals (
    referrer_id,
    referred_id,
    referrer_coins_awarded,
    referred_coins_awarded,
    created_at
  )
  VALUES (
    v_referrer_id,
    v_user_id,
    v_referrer_coins,
    v_referred_coins,
    now()
  )
  ON CONFLICT (referred_id) DO NOTHING
  RETURNING id INTO v_new_referral_id;

  IF v_new_referral_id IS NULL THEN
    RETURN jsonb_build_object(''success'', false, ''already_referred'', true, ''error'', ''Referral already claimed.'');
  END IF;

  -- 5. Atomically credit Referrer wallet
  INSERT INTO public.coin_wallets (user_id, balance, updated_at)
  VALUES (v_referrer_id, v_referrer_coins, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = coin_wallets.balance + v_referrer_coins,
      updated_at = now();

  INSERT INTO public.coin_ledger (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_referrer_id, v_referrer_coins, ''credit'', ''Referral reward: invited a student'', now());

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_referrer_id, v_referrer_coins, ''credit'', ''Referral reward: invited a student'', now());

  -- 6. Atomically credit Referred New Student wallet
  INSERT INTO public.coin_wallets (user_id, balance, updated_at)
  VALUES (v_user_id, v_referred_coins, now())
  ON CONFLICT (user_id) DO UPDATE
  SET balance = coin_wallets.balance + v_referred_coins,
      updated_at = now();

  INSERT INTO public.coin_ledger (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_user_id, v_referred_coins, ''credit'', ''Referral bonus: joined with invite code'', now());

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, reason, created_at)
  VALUES (v_user_id, v_referred_coins, ''credit'', ''Referral bonus: joined with invite code'', now());

  RETURN jsonb_build_object(
    ''success'', true,
    ''referrer_coins'', v_referrer_coins,
    ''referred_coins'', v_referred_coins,
    ''message'', ''Referral bonus credited successfully.''
  );
END;
$$","GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated","NOTIFY pgrst, ''reload schema''"}', 'atomic_referral_award_rpc'),
	('20261113210000', '{"-- Security hardening for student data access, attempt progress, scoring inputs,
-- and Razorpay fulfillment. Sensitive writes remain server-side only.

CREATE EXTENSION IF NOT EXISTS pgcrypto","CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND lower(trim(role)) IN (''admin'', ''super_admin'')
  );
$$","REVOKE ALL ON FUNCTION public.is_admin_user() FROM public","GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated","-- Profiles: students may read their own profile and update only safe profile fields.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Users can read own profile\" ON public.profiles","DROP POLICY IF EXISTS \"Admins can read profiles\" ON public.profiles","DROP POLICY IF EXISTS \"Users can update own safe profile\" ON public.profiles","CREATE POLICY \"Users can read own profile\"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid())","CREATE POLICY \"Admins can read profiles\"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin_user())","CREATE POLICY \"Users can update own safe profile\"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid())","REVOKE ALL ON public.profiles FROM anon","REVOKE INSERT, DELETE ON public.profiles FROM authenticated","REVOKE UPDATE ON public.profiles FROM authenticated","GRANT SELECT ON public.profiles TO authenticated","GRANT UPDATE (full_name, target_exams, daily_goal_target, theme) ON public.profiles TO authenticated","-- Questions and links must be accessed through answer-filtering RPCs, not direct selects.
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY","ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Published questions are readable\" ON public.questions","DROP POLICY IF EXISTS \"Published test questions are readable\" ON public.test_questions","DROP POLICY IF EXISTS \"Admins read questions\" ON public.questions","DROP POLICY IF EXISTS \"Admins read test questions\" ON public.test_questions","CREATE POLICY \"Admins read questions\"
  ON public.questions FOR SELECT TO authenticated
  USING (public.is_admin_user())","CREATE POLICY \"Admins read test questions\"
  ON public.test_questions FOR SELECT TO authenticated
  USING (public.is_admin_user())","REVOKE SELECT ON public.questions, public.test_questions FROM anon, authenticated","GRANT SELECT ON public.questions, public.test_questions TO authenticated","-- Attempts: clients can read their own attempt, but only RPCs may mutate progress/results.
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY","DROP POLICY IF EXISTS \"Students can update their own in-progress attempts\" ON public.test_attempts","DROP POLICY IF EXISTS \"Students can view their own attempts\" ON public.test_attempts","CREATE POLICY \"Students can view their own attempts\"
  ON public.test_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid())","REVOKE INSERT, UPDATE, DELETE ON public.test_attempts FROM anon, authenticated","GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_attempts TO authenticated","-- Coin balances and ledgers are read-only to students; all writes use trusted RPCs.
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY","ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY","ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY","REVOKE ALL ON public.coin_wallets, public.coin_ledger, public.coin_transactions FROM anon","REVOKE INSERT, UPDATE, DELETE ON public.coin_wallets, public.coin_ledger, public.coin_transactions FROM authenticated","GRANT SELECT ON public.coin_wallets, public.coin_ledger, public.coin_transactions TO authenticated","-- Secure progress writer used by LiveQuiz pause/background sync.
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
SET search_path = public
AS $$
DECLARE
  v_attempt public.test_attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE id = p_attempt_id AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION ''Test attempt not found.'' USING ERRCODE = ''P0002'';
  END IF;
  IF lower(coalesce(v_attempt.status, '''')) IN (''completed'', ''submitted'') THEN
    RETURN jsonb_build_object(''attempt_id'', p_attempt_id, ''status'', v_attempt.status);
  END IF;
  IF lower(coalesce(p_status, '''')) NOT IN (''in_progress'', ''paused'') THEN
    RAISE EXCEPTION ''Invalid attempt progress status.'' USING ERRCODE = ''22023'';
  END IF;

  UPDATE public.test_attempts
  SET status = p_status,
      remaining_seconds = greatest(coalesce(p_remaining_seconds, remaining_seconds, 0), 0),
      current_question_index = greatest(coalesce(p_current_question_index, 0), 0),
      state_json = coalesce(p_state_json, ''{}''::jsonb) || jsonb_build_object(
        ''violationCount'', greatest(coalesce(p_violation_count, 0), 0)
      ),
      paused_at = CASE WHEN p_status = ''paused'' THEN now() ELSE paused_at END,
      updated_at = now()
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(''attempt_id'', p_attempt_id, ''status'', p_status);
END;
$$","GRANT EXECUTE ON FUNCTION public.save_test_attempt_progress(uuid, text, integer, integer, jsonb, integer)
  TO authenticated","-- Answer-free practice payload. This replaces direct student question selects.
CREATE OR REPLACE FUNCTION public.get_practice_questions(p_chapter_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
          AND lower(coalesce(c.access_mode, ''inherit'')) IN (''paid-own'', ''paid_own'')
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
           OR lower(coalesce(e.access_mode, '''')) IN (''paid-own'', ''paid_own'')
      ) AS access_required
  )
  SELECT jsonb_build_object(
    ''questions'',
    coalesce(jsonb_agg(to_jsonb(question_rows) ORDER BY question_rows.display_order, question_rows.id), ''[]''::jsonb)
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
    WHERE q.status = ''published''
      AND (q.chapter_id = p_chapter_id OR (
        t.chapter_id = p_chapter_id
        AND t.status IN (''published'', ''live'', ''available'')
      ))
      AND (
        NOT (SELECT access_required FROM access_context)
        OR EXISTS (
          SELECT 1
          FROM public.user_access ua
          WHERE ua.user_id = auth.uid()
            AND coalesce(ua.is_active, false) = true
            AND lower(coalesce(ua.status, ''active'')) = ''active''
            AND (
              (ua.item_type = ''chapter'' AND ua.item_id::text = p_chapter_id::text)
              OR (ua.item_type = ''folder'' AND EXISTS (
                SELECT 1 FROM folder_tree ft WHERE ft.id::text = ua.item_id::text
              ))
              OR (ua.item_type = ''exam'' AND EXISTS (
                SELECT 1 FROM folder_tree ft WHERE ft.exam_id::text = ua.item_id::text
              ))
            )
        )
      )
  ) AS question_rows;
$$","GRANT EXECUTE ON FUNCTION public.get_practice_questions(uuid) TO authenticated","-- Immediate feedback is limited to the authenticated owner of an active attempt.
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
  v_attempt public.test_attempts%ROWTYPE;
  v_solution_mode text;
  v_question public.questions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION ''Authentication required.'' USING ERRCODE = ''28000'';
  END IF;

  SELECT * INTO v_attempt
  FROM public.test_attempts
  WHERE test_id = p_test_id
    AND user_id = auth.uid()
    AND lower(coalesce(status, '''')) IN (''started'', ''in_progress'', ''in progress'', ''pending'')
    AND completed_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''allowed'', false, ''error'', ''An active test attempt is required.'');
  END IF;

  SELECT lower(coalesce(solution_mode, '''')) INTO v_solution_mode
  FROM public.tests
  WHERE id = p_test_id;
  IF v_solution_mode <> ''immediate'' THEN
    RETURN jsonb_build_object(''allowed'', false, ''error'', ''This test does not support immediate feedback.'');
  END IF;
  IF p_selected_option IS NULL OR trim(p_selected_option) = '''' THEN
    RETURN jsonb_build_object(''allowed'', false, ''error'', ''Must select an option before viewing feedback.'');
  END IF;

  SELECT q.* INTO v_question
  FROM public.questions q
  JOIN public.test_questions tq ON tq.question_id = q.id
  WHERE tq.test_id = p_test_id AND q.id = p_question_id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(''allowed'', false, ''error'', ''Question not found in test.'');
  END IF;

  RETURN jsonb_build_object(
    ''allowed'', true,
    ''question_id'', v_question.id,
    ''correct_answer'', v_question.correct_answer,
    ''explanation'', v_question.explanation,
    ''distractor_notes'', v_question.distractor_notes
  );
END;
$$","REVOKE ALL ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) FROM anon","GRANT EXECUTE ON FUNCTION public.get_single_question_feedback(uuid, uuid, text) TO authenticated","-- Payment fulfillment must be authenticated, owned, and cryptographically verified.
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id text,
  p_payment_id text,
  p_payment_signature text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_secret text;
  v_gateway_order_id text;
  v_expected_signature text;
  v_item_type text;
  v_item_id text;
  v_coins_to_deduct integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION ''Authentication required.'' USING ERRCODE = ''28000'';
  END IF;

  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE id::text = p_order_id
     OR gateway_order_id = p_order_id
     OR razorpay_order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(''success'', false, ''error'', ''Payment order not found.'');
  END IF;
  IF v_order.user_id IS NULL OR v_order.user_id <> auth.uid() THEN
    RAISE EXCEPTION ''Payment order ownership could not be verified.'' USING ERRCODE = ''42501'';
  END IF;
  IF lower(coalesce(v_order.status, '''')) = ''paid'' THEN
    RETURN jsonb_build_object(''success'', true, ''already_fulfilled'', true);
  END IF;
  IF p_payment_id IS NULL OR p_payment_signature IS NULL THEN
    RAISE EXCEPTION ''Payment verification data is incomplete.'' USING ERRCODE = ''22023'';
  END IF;

  v_gateway_order_id := coalesce(v_order.razorpay_order_id, v_order.gateway_order_id);
  v_secret := current_setting(''app.razorpay_key_secret'', true);
  IF v_gateway_order_id IS NULL OR v_secret IS NULL OR v_secret = '''' THEN
    RAISE EXCEPTION ''Payment verification is not configured.'' USING ERRCODE = ''38000'';
  END IF;

  v_expected_signature := encode(
    hmac(v_gateway_order_id || ''|'' || p_payment_id, v_secret, ''sha256''),
    ''hex''
  );
  IF lower(v_expected_signature) <> lower(trim(p_payment_signature)) THEN
    RAISE EXCEPTION ''Payment signature verification failed.'' USING ERRCODE = ''28000'';
  END IF;

  UPDATE public.payment_orders
  SET status = ''paid'',
      gateway_payment_id = coalesce(p_payment_id, gateway_payment_id),
      razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id),
      payment_signature = p_payment_signature,
      razorpay_signature = p_payment_signature,
      amount_paid = coalesce(final_amount, amount, 0),
      updated_at = now()
  WHERE id = v_order.id;

  v_item_type := CASE
    WHEN lower(coalesce(v_order.item_type, v_order.order_type, '''')) IN (''exam'', ''folder'', ''chapter'')
      THEN lower(coalesce(v_order.item_type, v_order.order_type))
    ELSE ''folder''
  END;
  v_item_id := v_order.item_id::text;

  INSERT INTO public.user_access (
    user_id, item_type, item_id, grant_source, status, is_active, starts_at, created_at, updated_at
  )
  VALUES (
    v_order.user_id, v_item_type, v_item_id, ''purchase'', ''active'', true, now(), now(), now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET status = ''active'', is_active = true, updated_at = now();

  v_coins_to_deduct := greatest(coalesce(v_order.coins_redeemed, v_order.coins_used, 0), 0);
  IF v_coins_to_deduct > 0 THEN
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_order.user_id, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.coin_wallets
    SET balance = greatest(0, balance - v_coins_to_deduct), updated_at = now()
    WHERE user_id = v_order.user_id;

    INSERT INTO public.coin_ledger (
      user_id, amount, transaction_type, reason, description, created_at
    )
    VALUES (
      v_order.user_id, -v_coins_to_deduct, ''redeem'',
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_item_type),
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_item_type), now()
    );

    INSERT INTO public.coin_transactions (
      user_id, amount, type, transaction_type, reason, description, reference_id, created_at
    )
    VALUES (
      v_order.user_id, -v_coins_to_deduct, ''redeem'', ''redeem'',
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_item_type),
      format(''Redeemed %s coins for %s purchase'', v_coins_to_deduct, v_item_type),
      v_order.id::text, now()
    );
  END IF;

  RETURN jsonb_build_object(''success'', true, ''message'', ''Payment verified and access entitlement granted.'');
END;
$$","REVOKE ALL ON FUNCTION public.complete_successful_checkout(text, text, text) FROM anon","REVOKE ALL ON FUNCTION public.complete_successful_checkout(text, text, text) FROM authenticated","GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(text, text, text) TO authenticated","NOTIFY pgrst, ''reload schema''"}', 'security_rls_and_anti_cheat_hardening');


--
-- PostgreSQL database dump complete
--

-- \unrestrict h8E70AdJIOBjkJQi4lNa6PVhjD5ba1dNWBa55e01ve2Afzswu4jzHnyYwy4P7VP

RESET ALL;
