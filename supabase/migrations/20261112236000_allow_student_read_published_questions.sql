-- ==============================================================================
-- Zyvra Migration: Allow Student Read Access on Published Questions & Test Questions
-- Timestamp: 20261112236000
-- Enables authenticated & anon students to read published questions and test questions
-- for Practice Mode and Test Mode (immediate solution mode feedback).
-- ==============================================================================

-- 1. Published questions read policy
DROP POLICY IF EXISTS "Published questions are readable" ON public.questions;
CREATE POLICY "Published questions are readable"
  ON public.questions FOR SELECT TO anon, authenticated
  USING (
    status IN ('published', 'active', 'live', 'available')
    OR status IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- 2. Published test questions read policy
DROP POLICY IF EXISTS "Published test questions are readable" ON public.test_questions;
CREATE POLICY "Published test questions are readable"
  ON public.test_questions FOR SELECT TO anon, authenticated
  USING (true);

-- 3. Ensure SELECT grants for anon and authenticated
GRANT SELECT ON public.questions TO anon, authenticated;
GRANT SELECT ON public.test_questions TO anon, authenticated;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
