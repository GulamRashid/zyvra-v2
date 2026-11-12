-- Zyvra Content Schema: Check Constraints & Enum Synchronization
-- Drops outdated/inconsistent check constraints and recreates synchronized check constraints
-- matching all frontend form payloads across exams, folders, chapters, chapter_resources, questions, and tests.

-- 1. Safely drop all existing check constraints on targeted columns across content tables
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN (
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND con.contype = 'c'
      AND rel.relname IN ('exams', 'folders', 'chapters', 'chapter_resources', 'questions', 'tests', 'test_questions')
      AND (
        con.conname LIKE '%pricing_mode%' OR
        con.conname LIKE '%access_mode%' OR
        con.conname LIKE '%status%' OR
        con.conname LIKE '%difficulty%' OR
        con.conname LIKE '%resource_type%' OR
        con.conname LIKE '%pattern%' OR
        con.conname LIKE '%display_order%' OR
        con.conname LIKE '%price%' OR
        con.conname LIKE '%study_time%' OR
        con.conname LIKE '%estimated_study_time%' OR
        con.conname LIKE '%duration%' OR
        con.conname LIKE '%attempt_limit%' OR
        con.conname LIKE '%positive_marks%' OR
        con.conname LIKE '%negative_marks%' OR
        con.conname LIKE '%penalty%' OR
        con.conname LIKE '%page_count%' OR
        con.conname LIKE '%correct_answer%'
      )
  )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_rec.relname, v_rec.conname);
  END LOOP;
END
$$;

-- 2. Explicitly drop all known legacy and standard constraint names to ensure cleanliness
ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_status_check,
  DROP CONSTRAINT IF EXISTS exams_status_allowed,
  DROP CONSTRAINT IF EXISTS exams_display_order_check,
  DROP CONSTRAINT IF EXISTS exams_display_order_nonnegative;

ALTER TABLE public.folders
  DROP CONSTRAINT IF EXISTS folders_pricing_mode_check,
  DROP CONSTRAINT IF EXISTS folders_pricing_mode_allowed,
  DROP CONSTRAINT IF EXISTS folders_price_check,
  DROP CONSTRAINT IF EXISTS folders_price_nonnegative,
  DROP CONSTRAINT IF EXISTS folders_display_order_check,
  DROP CONSTRAINT IF EXISTS folders_display_order_nonnegative,
  DROP CONSTRAINT IF EXISTS folders_status_check,
  DROP CONSTRAINT IF EXISTS folders_status_allowed;

ALTER TABLE public.chapters
  DROP CONSTRAINT IF EXISTS chapters_access_mode_check,
  DROP CONSTRAINT IF EXISTS chapters_access_mode_allowed,
  DROP CONSTRAINT IF EXISTS chapters_price_check,
  DROP CONSTRAINT IF EXISTS chapters_price_nonnegative,
  DROP CONSTRAINT IF EXISTS chapters_estimated_study_time_minutes_check,
  DROP CONSTRAINT IF EXISTS chapters_study_time_positive,
  DROP CONSTRAINT IF EXISTS chapters_display_order_check,
  DROP CONSTRAINT IF EXISTS chapters_display_order_nonnegative,
  DROP CONSTRAINT IF EXISTS chapters_status_check,
  DROP CONSTRAINT IF EXISTS chapters_status_allowed;

ALTER TABLE public.chapter_resources
  DROP CONSTRAINT IF EXISTS chapter_resources_resource_type_check,
  DROP CONSTRAINT IF EXISTS chapter_resources_resource_type_allowed,
  DROP CONSTRAINT IF EXISTS chapter_resources_status_check,
  DROP CONSTRAINT IF EXISTS chapter_resources_status_allowed,
  DROP CONSTRAINT IF EXISTS chapter_resources_display_order_check,
  DROP CONSTRAINT IF EXISTS chapter_resources_display_order_nonnegative,
  DROP CONSTRAINT IF EXISTS chapter_resources_page_count_check,
  DROP CONSTRAINT IF EXISTS chapter_resources_page_count_positive;

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_difficulty_check,
  DROP CONSTRAINT IF EXISTS questions_difficulty_allowed,
  DROP CONSTRAINT IF EXISTS questions_status_check,
  DROP CONSTRAINT IF EXISTS questions_status_allowed,
  DROP CONSTRAINT IF EXISTS questions_correct_answer_check;

ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_pattern_check,
  DROP CONSTRAINT IF EXISTS tests_pattern_allowed,
  DROP CONSTRAINT IF EXISTS tests_status_check,
  DROP CONSTRAINT IF EXISTS tests_status_allowed,
  DROP CONSTRAINT IF EXISTS tests_duration_check,
  DROP CONSTRAINT IF EXISTS tests_duration_minutes_check,
  DROP CONSTRAINT IF EXISTS tests_duration_positive,
  DROP CONSTRAINT IF EXISTS tests_attempt_limit_check,
  DROP CONSTRAINT IF EXISTS tests_attempt_limit_positive,
  DROP CONSTRAINT IF EXISTS tests_positive_marks_check,
  DROP CONSTRAINT IF EXISTS tests_positive_marks_positive,
  DROP CONSTRAINT IF EXISTS tests_negative_marks_check,
  DROP CONSTRAINT IF EXISTS tests_negative_marks_nonnegative,
  DROP CONSTRAINT IF EXISTS tests_mandatory_option_e_penalty_check,
  DROP CONSTRAINT IF EXISTS tests_option_e_penalty_nonnegative;

ALTER TABLE public.test_questions
  DROP CONSTRAINT IF EXISTS test_questions_display_order_check,
  DROP CONSTRAINT IF EXISTS test_questions_display_order_nonnegative;

-- 3. Normalize legacy values in existing records
UPDATE public.exams
  SET status = lower(trim(status))
  WHERE status IS NOT NULL;

UPDATE public.folders
  SET pricing_mode = 'paid_own'
  WHERE pricing_mode = 'paid-own';

UPDATE public.folders
  SET pricing_mode = 'inherit'
  WHERE pricing_mode IN ('inherit-parent', 'inherit_parent');

UPDATE public.folders
  SET pricing_mode = 'free'
  WHERE pricing_mode IS NULL OR pricing_mode NOT IN ('free', 'paid_own', 'paid-own', 'inherit', 'inherit_parent', 'inherit-parent');

UPDATE public.folders
  SET status = lower(trim(status))
  WHERE status IS NOT NULL;

UPDATE public.chapters
  SET access_mode = 'paid_own'
  WHERE access_mode = 'paid-own';

UPDATE public.chapters
  SET access_mode = 'inherit'
  WHERE access_mode IN ('inherit-parent', 'inherit_parent');

UPDATE public.chapters
  SET access_mode = 'inherit'
  WHERE access_mode IS NULL OR access_mode NOT IN ('free', 'paid_own', 'paid-own', 'inherit', 'inherit_parent', 'inherit-parent');

UPDATE public.chapters
  SET status = lower(trim(status))
  WHERE status IS NOT NULL;

UPDATE public.chapter_resources
  SET status = lower(trim(status))
  WHERE status IS NOT NULL;

UPDATE public.questions
  SET difficulty = lower(trim(difficulty))
  WHERE difficulty IS NOT NULL;

UPDATE public.questions
  SET status = lower(trim(status))
  WHERE status IS NOT NULL;

UPDATE public.questions
  SET correct_answer = upper(trim(correct_answer))
  WHERE correct_answer IS NOT NULL;

UPDATE public.tests
  SET status = lower(trim(status))
  WHERE status IS NOT NULL;

-- 4. Re-apply synchronized, permissive CHECK constraints matching frontend payloads

-- EXAMS
ALTER TABLE public.exams
  ADD CONSTRAINT exams_display_order_check CHECK (display_order >= 0),
  ADD CONSTRAINT exams_status_check CHECK (status IN ('draft', 'published', 'unpublished', 'archived', 'active', 'live', 'available', 'coming-soon', 'coming_soon'));

-- FOLDERS
ALTER TABLE public.folders
  ADD CONSTRAINT folders_display_order_check CHECK (display_order >= 0),
  ADD CONSTRAINT folders_price_check CHECK (price IS NULL OR price >= 0),
  ADD CONSTRAINT folders_pricing_mode_check CHECK (pricing_mode IN ('free', 'paid_own', 'paid-own', 'inherit', 'inherit_parent', 'inherit-parent')),
  ADD CONSTRAINT folders_status_check CHECK (status IN ('draft', 'published', 'unpublished', 'archived', 'active', 'live', 'available', 'coming-soon', 'coming_soon'));

-- CHAPTERS
ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_display_order_check CHECK (display_order >= 0),
  ADD CONSTRAINT chapters_price_check CHECK (price IS NULL OR price >= 0),
  ADD CONSTRAINT chapters_estimated_study_time_minutes_check CHECK (estimated_study_time_minutes > 0),
  ADD CONSTRAINT chapters_access_mode_check CHECK (access_mode IN ('free', 'paid_own', 'paid-own', 'inherit', 'inherit_parent', 'inherit-parent')),
  ADD CONSTRAINT chapters_status_check CHECK (status IN ('draft', 'published', 'unpublished', 'archived', 'active', 'live', 'available', 'coming-soon', 'coming_soon'));

-- CHAPTER_RESOURCES
ALTER TABLE public.chapter_resources
  ADD CONSTRAINT chapter_resources_display_order_check CHECK (display_order >= 0),
  ADD CONSTRAINT chapter_resources_page_count_check CHECK (page_count IS NULL OR page_count > 0),
  ADD CONSTRAINT chapter_resources_resource_type_check CHECK (resource_type IN ('pdf', 'formula_sheet', 'revision_sheet', 'notes', 'PDF', 'Formula Sheet', 'Revision Sheet', 'Notes', 'doc', 'document', 'video', 'link')),
  ADD CONSTRAINT chapter_resources_status_check CHECK (status IN ('draft', 'published', 'unpublished', 'archived', 'active', 'live', 'available'));

-- QUESTIONS
ALTER TABLE public.questions
  ADD CONSTRAINT questions_difficulty_check CHECK (difficulty IN ('easy', 'medium', 'hard')),
  ADD CONSTRAINT questions_status_check CHECK (status IN ('draft', 'review', 'published', 'unpublished', 'archived', 'active', 'live', 'available')),
  ADD CONSTRAINT questions_correct_answer_check CHECK (correct_answer IN ('A', 'B', 'C', 'D', 'E'));

-- TESTS
ALTER TABLE public.tests
  ADD CONSTRAINT tests_duration_minutes_check CHECK (duration_minutes > 0),
  ADD CONSTRAINT tests_attempt_limit_check CHECK (attempt_limit > 0),
  ADD CONSTRAINT tests_positive_marks_check CHECK (positive_marks > 0),
  ADD CONSTRAINT tests_negative_marks_check CHECK (negative_marks >= 0),
  ADD CONSTRAINT tests_mandatory_option_e_penalty_check CHECK (mandatory_option_e_penalty >= 0),
  ADD CONSTRAINT tests_pattern_check CHECK (pattern IN ('standard-4', 'standard_4', 'bpsc-classic-5', 'bpsc_classic_5', 'bpsc-mandatory-e', 'bpsc_mandatory_e')),
  ADD CONSTRAINT tests_status_check CHECK (status IN ('draft', 'published', 'scheduled', 'paused', 'active', 'live', 'available', 'archived', 'unpublished'));

-- TEST_QUESTIONS
ALTER TABLE public.test_questions
  ADD CONSTRAINT test_questions_display_order_check CHECK (display_order >= 0);

-- 5. Signal PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
