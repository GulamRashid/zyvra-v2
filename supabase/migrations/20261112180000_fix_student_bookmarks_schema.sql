-- ==============================================================================
-- Migration: Fix student_bookmarks Schema & Access Policies
-- Timestamp: 20261112180000
-- Safely adds chapter_id and resource_id to public.student_bookmarks if missing,
-- and ensures authenticated users have full access to manage their own bookmarks.
-- ==============================================================================

-- 1. Create table if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.student_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.chapter_resources(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Safely add columns if table existed without them
ALTER TABLE public.student_bookmarks
  ADD COLUMN IF NOT EXISTS chapter_id UUID REFERENCES public.chapters(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES public.chapter_resources(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user_chapter
  ON public.student_bookmarks (user_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_student_bookmarks_user_resource
  ON public.student_bookmarks (user_id, resource_id);

-- 4. Row Level Security policies
ALTER TABLE public.student_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage own bookmarks" ON public.student_bookmarks;
CREATE POLICY "Students manage own bookmarks"
  ON public.student_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all bookmarks" ON public.student_bookmarks;
CREATE POLICY "Admins manage all bookmarks"
  ON public.student_bookmarks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

GRANT ALL ON public.student_bookmarks TO authenticated;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
