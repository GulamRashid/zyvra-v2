-- Align the content catalogue, chapter resources, question bank, and test
-- authoring tables with the fields used by the Zyvra admin and student apps.
-- Existing rows are preserved; constraints are added NOT VALID so legacy rows
-- can be audited separately while new writes are checked immediately.

CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'BookOpen',
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL,
  parent_folder_id UUID,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  allow_tests BOOLEAN NOT NULL DEFAULT TRUE,
  allow_practice BOOLEAN NOT NULL DEFAULT TRUE,
  allow_notes BOOLEAN NOT NULL DEFAULT TRUE,
  pricing_mode TEXT NOT NULL DEFAULT 'free',
  price NUMERIC(10, 2),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  estimated_study_time_minutes INTEGER NOT NULL DEFAULT 20,
  access_mode TEXT NOT NULL DEFAULT 'inherit-parent',
  price NUMERIC(10, 2),
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chapter_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'PDF',
  file_url TEXT NOT NULL,
  file_size TEXT,
  page_count INTEGER,
  is_downloadable BOOLEAN NOT NULL DEFAULT FALSE,
  is_free_preview BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  question_text TEXT NOT NULL,
  question_text_hi TEXT,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL DEFAULT 'A',
  explanation TEXT,
  distractor_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  subject TEXT NOT NULL,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  instructions TEXT,
  pattern TEXT NOT NULL DEFAULT 'standard-4',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  attempt_limit INTEGER NOT NULL DEFAULT 1,
  positive_marks NUMERIC(8, 2) NOT NULL DEFAULT 1,
  negative_marks NUMERIC(8, 2) NOT NULL DEFAULT 0.25,
  mandatory_option_e_penalty NUMERIC(8, 2) NOT NULL DEFAULT 0.25,
  coin_reward_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL,
  question_id UUID NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'BookOpen',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS exam_id UUID,
  ADD COLUMN IF NOT EXISTS parent_folder_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS allow_tests BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_practice BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_notes BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS folder_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS estimated_study_time_minutes INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT 'inherit-parent',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.chapter_resources
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS chapter_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_size TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS is_downloadable BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_free_preview BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS chapter_id UUID,
  ADD COLUMN IF NOT EXISTS question_text TEXT,
  ADD COLUMN IF NOT EXISTS question_text_hi TEXT,
  ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correct_answer TEXT DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS distractor_notes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS chapter_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS pattern TEXT DEFAULT 'standard-4',
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS attempt_limit INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS positive_marks NUMERIC(8, 2) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(8, 2) DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS mandatory_option_e_penalty NUMERIC(8, 2) DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS coin_reward_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.test_questions
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS test_id UUID,
  ADD COLUMN IF NOT EXISTS question_id UUID,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
DECLARE
  v_table_name TEXT;
  v_id_type TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['exams', 'folders', 'chapters', 'chapter_resources', 'questions', 'tests', 'test_questions']
  LOOP
    SELECT c.udt_name INTO v_id_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_table_name
      AND c.column_name = 'id';
    IF v_id_type IS DISTINCT FROM 'uuid' THEN
      RAISE EXCEPTION 'public.% must use a UUID id column before applying the Zyvra content schema migration (found %).', v_table_name, COALESCE(v_id_type, 'missing');
    END IF;
    EXECUTE format('UPDATE public.%I SET id = gen_random_uuid() WHERE id IS NULL', v_table_name);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL, ALTER COLUMN created_at SET DEFAULT now(), ALTER COLUMN updated_at SET DEFAULT now()',
      v_table_name
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['exams', 'folders', 'chapters', 'chapter_resources', 'questions', 'tests', 'test_questions']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format('public.%I', v_table_name)::regclass
        AND contype = 'p'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', v_table_name, v_table_name || '_pkey');
    END IF;
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_folders_exam_order ON public.folders (exam_id, display_order);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON public.folders (parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_chapters_folder_order ON public.chapters (folder_id, display_order);
CREATE INDEX IF NOT EXISTS idx_chapter_resources_chapter_order ON public.chapter_resources (chapter_id, display_order);
CREATE INDEX IF NOT EXISTS idx_questions_chapter_status ON public.questions (chapter_id, status);
CREATE INDEX IF NOT EXISTS idx_tests_chapter_status ON public.tests (chapter_id, status);
CREATE INDEX IF NOT EXISTS idx_test_questions_test_order ON public.test_questions (test_id, display_order);
CREATE INDEX IF NOT EXISTS idx_test_questions_question ON public.test_questions (question_id);

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT * FROM (VALUES
      ('folders', 'folders_exam_id_fkey', 'FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE'),
      ('folders', 'folders_parent_folder_id_fkey', 'FOREIGN KEY (parent_folder_id) REFERENCES public.folders(id) ON DELETE CASCADE'),
      ('chapters', 'chapters_folder_id_fkey', 'FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE CASCADE'),
      ('chapter_resources', 'chapter_resources_chapter_id_fkey', 'FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE'),
      ('questions', 'questions_chapter_id_fkey', 'FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE'),
      ('tests', 'tests_chapter_id_fkey', 'FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE'),
      ('test_questions', 'test_questions_test_id_fkey', 'FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE'),
      ('test_questions', 'test_questions_question_id_fkey', 'FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE')
    ) AS definitions(table_name, constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format('public.%I', constraint_record.table_name)::regclass
        AND conname = constraint_record.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I %s NOT VALID',
        constraint_record.table_name,
        constraint_record.constraint_name,
        constraint_record.definition
      );
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT * FROM (VALUES
      ('exams', 'exams_display_order_nonnegative', 'CHECK (display_order >= 0)'),
      ('exams', 'exams_status_allowed', 'CHECK (status IN (''draft'', ''published'', ''unpublished'', ''archived'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon''))'),
      ('folders', 'folders_display_order_nonnegative', 'CHECK (display_order >= 0)'),
      ('folders', 'folders_price_nonnegative', 'CHECK (price IS NULL OR price >= 0)'),
      ('folders', 'folders_pricing_mode_allowed', 'CHECK (pricing_mode IN (''free'', ''paid-own'', ''inherit-parent''))'),
      ('folders', 'folders_status_allowed', 'CHECK (status IN (''draft'', ''published'', ''unpublished'', ''archived'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon''))'),
      ('chapters', 'chapters_display_order_nonnegative', 'CHECK (display_order >= 0)'),
      ('chapters', 'chapters_study_time_positive', 'CHECK (estimated_study_time_minutes > 0)'),
      ('chapters', 'chapters_price_nonnegative', 'CHECK (price IS NULL OR price >= 0)'),
      ('chapters', 'chapters_access_mode_allowed', 'CHECK (access_mode IN (''free'', ''paid-own'', ''inherit-parent''))'),
      ('chapters', 'chapters_status_allowed', 'CHECK (status IN (''draft'', ''published'', ''unpublished'', ''archived'', ''active'', ''live'', ''available'', ''coming-soon'', ''coming_soon''))'),
      ('chapter_resources', 'chapter_resources_display_order_nonnegative', 'CHECK (display_order >= 0)'),
      ('chapter_resources', 'chapter_resources_page_count_positive', 'CHECK (page_count IS NULL OR page_count > 0)'),
      ('chapter_resources', 'chapter_resources_status_allowed', 'CHECK (status IN (''draft'', ''published'', ''unpublished'', ''archived'', ''active'', ''live'', ''available''))'),
      ('questions', 'questions_difficulty_allowed', 'CHECK (difficulty IN (''easy'', ''medium'', ''hard''))'),
      ('questions', 'questions_status_allowed', 'CHECK (status IN (''draft'', ''review'', ''published'', ''unpublished'', ''archived'', ''active'', ''live'', ''available''))'),
      ('tests', 'tests_duration_positive', 'CHECK (duration_minutes > 0)'),
      ('tests', 'tests_attempt_limit_positive', 'CHECK (attempt_limit > 0)'),
      ('tests', 'tests_positive_marks_positive', 'CHECK (positive_marks > 0)'),
      ('tests', 'tests_negative_marks_nonnegative', 'CHECK (negative_marks >= 0)'),
      ('tests', 'tests_option_e_penalty_nonnegative', 'CHECK (mandatory_option_e_penalty >= 0)'),
      ('tests', 'tests_pattern_allowed', 'CHECK (pattern IN (''standard-4'', ''bpsc-classic-5'', ''bpsc-mandatory-e''))'),
      ('tests', 'tests_status_allowed', 'CHECK (status IN (''draft'', ''published'', ''scheduled'', ''paused'', ''active'', ''live'', ''available'', ''archived''))'),
      ('test_questions', 'test_questions_display_order_nonnegative', 'CHECK (display_order >= 0)')
    ) AS definitions(table_name, constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format('public.%I', constraint_record.table_name)::regclass
        AND conname = constraint_record.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I %s NOT VALID',
        constraint_record.table_name,
        constraint_record.constraint_name,
        constraint_record.definition
      );
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.set_content_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['exams', 'folders', 'chapters', 'chapter_resources', 'questions', 'tests', 'test_questions']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_table_name || '_set_updated_at', v_table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_content_updated_at()',
      v_table_name || '_set_updated_at',
      v_table_name
    );
  END LOOP;
END
$$;

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published exams are readable" ON public.exams;
CREATE POLICY "Published exams are readable"
  ON public.exams FOR SELECT TO anon, authenticated
  USING (status IN ('published', 'active', 'live', 'available', 'coming-soon', 'coming_soon'));
DROP POLICY IF EXISTS "Admins manage exams" ON public.exams;
CREATE POLICY "Admins manage exams"
  ON public.exams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Published folders are readable" ON public.folders;
CREATE POLICY "Published folders are readable"
  ON public.folders FOR SELECT TO anon, authenticated
  USING (
    status IN ('published', 'active', 'live', 'available', 'coming-soon', 'coming_soon')
    AND EXISTS (
      SELECT 1 FROM public.exams e
      WHERE e.id = folders.exam_id
        AND e.status IN ('published', 'active', 'live', 'available', 'coming-soon', 'coming_soon')
    )
  );
DROP POLICY IF EXISTS "Admins manage folders" ON public.folders;
CREATE POLICY "Admins manage folders"
  ON public.folders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Published chapters are readable" ON public.chapters;
CREATE POLICY "Published chapters are readable"
  ON public.chapters FOR SELECT TO anon, authenticated
  USING (
    status IN ('published', 'active', 'live', 'available', 'coming-soon', 'coming_soon')
    AND EXISTS (
      SELECT 1
      FROM public.folders f
      JOIN public.exams e ON e.id = f.exam_id
      WHERE f.id = chapters.folder_id
        AND f.status IN ('published', 'active', 'live', 'available', 'coming-soon', 'coming_soon')
        AND e.status IN ('published', 'active', 'live', 'available', 'coming-soon', 'coming_soon')
    )
  );
DROP POLICY IF EXISTS "Admins manage chapters" ON public.chapters;
CREATE POLICY "Admins manage chapters"
  ON public.chapters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Published chapter resources are readable" ON public.chapter_resources;
CREATE POLICY "Published chapter resources are readable"
  ON public.chapter_resources FOR SELECT TO anon, authenticated
  USING (
    status IN ('published', 'active', 'live', 'available')
    AND EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = chapter_resources.chapter_id
        AND c.status IN ('published', 'active', 'live', 'available', 'coming-soon', 'coming_soon')
    )
  );
DROP POLICY IF EXISTS "Admins manage chapter resources" ON public.chapter_resources;
CREATE POLICY "Admins manage chapter resources"
  ON public.chapter_resources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Published questions are readable" ON public.questions;
DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;
CREATE POLICY "Admins manage questions"
  ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Published tests are readable" ON public.tests;
CREATE POLICY "Published tests are readable"
  ON public.tests FOR SELECT TO anon, authenticated
  USING (
    status IN ('published', 'live', 'available')
    AND EXISTS (
      SELECT 1 FROM public.chapters c
      WHERE c.id = tests.chapter_id
        AND c.status IN ('published', 'live', 'available')
    )
  );
DROP POLICY IF EXISTS "Admins manage tests" ON public.tests;
CREATE POLICY "Admins manage tests"
  ON public.tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Questions in published tests are readable" ON public.test_questions;
CREATE POLICY "Questions in published tests are readable"
  ON public.test_questions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_questions.test_id AND t.status IN ('published', 'live', 'available')));
DROP POLICY IF EXISTS "Admins manage test questions" ON public.test_questions;
CREATE POLICY "Admins manage test questions"
  ON public.test_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

CREATE OR REPLACE FUNCTION public.get_published_question_metadata(p_question_ids UUID[])
RETURNS TABLE (id UUID, subject TEXT, topic TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT q.id, q.subject, q.topic
  FROM public.questions q
  WHERE auth.uid() IS NOT NULL
    AND q.status IN ('published', 'active', 'live', 'available')
    AND q.id = ANY(COALESCE(p_question_ids, ARRAY[]::UUID[]));
$$;

REVOKE ALL ON FUNCTION public.get_published_question_metadata(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_published_question_metadata(UUID[]) TO authenticated;

GRANT SELECT ON public.exams, public.folders, public.chapters, public.chapter_resources, public.questions, public.tests, public.test_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exams, public.folders, public.chapters, public.chapter_resources, public.questions, public.tests, public.test_questions TO authenticated;

NOTIFY pgrst, 'reload schema';
