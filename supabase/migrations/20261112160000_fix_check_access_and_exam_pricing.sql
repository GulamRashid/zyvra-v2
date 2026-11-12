-- ==============================================================================
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
    WHERE n.nspname = 'public'
      AND p.proname = 'check_user_access'
  )
  LOOP
    EXECUTE 'DROP FUNCTION ' || v_rec.proc_name;
  END LOOP;
END
$$;

-- Explicit drops as an extra safeguard
DROP FUNCTION IF EXISTS public.check_user_access(uuid, text, text);
DROP FUNCTION IF EXISTS public.check_user_access(uuid, text, uuid);

-- 2. ADD PRICING COLUMNS TO public.exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);

-- Normalize legacy or null exam pricing
UPDATE public.exams
  SET access_mode = 'free'
  WHERE access_mode IS NULL OR access_mode NOT IN ('free', 'paid_own');

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_access_mode_check;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_access_mode_check CHECK (access_mode IN ('free', 'paid_own'));

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_price_check;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_price_check CHECK (price IS NULL OR price >= 0);

-- 3. ADD solution_mode TO public.tests
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS solution_mode TEXT DEFAULT 'after_submit';

UPDATE public.tests
  SET solution_mode = 'after_submit'
  WHERE solution_mode IS NULL OR solution_mode NOT IN ('after_submit', 'immediate');

ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_solution_mode_check;
ALTER TABLE public.tests
  ADD CONSTRAINT tests_solution_mode_check CHECK (solution_mode IN ('after_submit', 'immediate'));

-- 4. ENSURE USER ACCESS & ENTITLEMENT TABLES EXIST
CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure unique constraint on (user_id, item_type, item_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_access_user_item_unique'
  ) THEN
    ALTER TABLE public.user_access
      ADD CONSTRAINT user_access_user_item_unique UNIQUE (user_id, item_type, item_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

-- 5. RECURSIVE FOLDER ACCESS FUNCTION
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
          AND ua.item_type = 'exam'
          AND ua.item_id::text = v_folder.exam_id::text
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
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
        AND ua.item_type = 'folder'
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
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
    WHERE fpc.pricing_mode IN ('inherit', 'inherit-parent', 'inherit_parent')
  )
  SELECT
    CASE
      WHEN pricing_mode = 'free' THEN 0
      WHEN pricing_mode IN ('paid_own', 'paid-own') THEN COALESCE(price, 0)
      ELSE 0
    END INTO v_effective_amount
  FROM folder_pricing_chain
  WHERE pricing_mode IN ('free', 'paid_own', 'paid-own')
     OR parent_folder_id IS NULL
  ORDER BY depth ASC
  LIMIT 1;

  IF COALESCE(v_effective_amount, 0) <= 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 6. HIERARCHICAL CHAPTER ACCESS FUNCTION
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
  IF v_chapter.access_mode = 'free' OR (v_chapter.access_mode IN ('paid_own', 'paid-own') AND COALESCE(v_chapter.price, 0) <= 0) THEN
    RETURN true;
  END IF;

  -- 2. Directly purchased by user
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = 'chapter'
        AND ua.item_id::text = p_chapter_id::text
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_direct;

    IF v_has_direct THEN
      RETURN true;
    END IF;

    -- Also check if user holds an exam pass for the chapter's parent exam
    IF v_chapter.folder_id IS NOT NULL THEN
      SELECT exam_id INTO v_folder FROM public.folders WHERE id = v_chapter.folder_id;
      IF v_folder.exam_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1
          FROM public.user_access ua
          WHERE ua.user_id = p_user_id
            AND ua.item_type = 'exam'
            AND ua.item_id::text = v_folder.exam_id::text
            AND (ua.is_active IS NULL OR ua.is_active = true)
            AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
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
$$;

-- 7. RECREATE ONE CANONICAL check_user_access RPC
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
  IF p_item_id IS NULL OR p_item_id = '' THEN
    RETURN false;
  END IF;

  -- Try converting item_id to UUID
  BEGIN
    v_uuid := p_item_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_uuid := NULL;
  END;

  -- 1. EXAM ACCESS
  IF v_clean_type = 'exam' THEN
    IF v_uuid IS NOT NULL THEN
      SELECT access_mode, price INTO v_exam FROM public.exams WHERE id = v_uuid;
      -- Free exam
      IF FOUND AND (v_exam.access_mode = 'free' OR v_exam.price IS NULL OR v_exam.price <= 0) THEN
        RETURN true;
      END IF;
    END IF;

    -- Check user purchase
    IF p_user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_access ua
        WHERE ua.user_id = p_user_id
          AND ua.item_type = 'exam'
          AND ua.item_id::text = p_item_id
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
      ) INTO v_has_access;

      RETURN v_has_access;
    END IF;

    RETURN false;

  -- 2. FOLDER ACCESS (Hierarchical)
  ELSIF v_clean_type = 'folder' THEN
    IF v_uuid IS NOT NULL THEN
      RETURN public.user_has_folder_access(p_user_id, v_uuid);
    END IF;
    RETURN false;

  -- 3. CHAPTER ACCESS (Hierarchical)
  ELSIF v_clean_type = 'chapter' THEN
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
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_access;

    RETURN v_has_access;
  END IF;
END;
$$;

-- 8. PERMISSIVE ADMIN RLS AND GRANTS TO PREVENT DELETION BLOCKING
DROP POLICY IF EXISTS "Admins manage exams" ON public.exams;
CREATE POLICY "Admins manage exams" ON public.exams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins manage folders" ON public.folders;
CREATE POLICY "Admins manage folders" ON public.folders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins manage chapters" ON public.chapters;
CREATE POLICY "Admins manage chapters" ON public.chapters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins manage tests" ON public.tests;
CREATE POLICY "Admins manage tests" ON public.tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins manage questions" ON public.questions;
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins manage test questions" ON public.test_questions;
CREATE POLICY "Admins manage test questions" ON public.test_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_questions TO authenticated;

GRANT EXECUTE ON FUNCTION public.check_user_access(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_folder_access(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_chapter_access(UUID, UUID) TO anon, authenticated;

-- 9. NOTIFY POSTGREST SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
