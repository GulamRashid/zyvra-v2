-- Remove legacy policies that expose question content or allow students to
-- mutate the question bank. Admin writes remain available through the existing
-- admin-only RLS policies; student flows use the secured RPCs.

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage questions" ON public.questions;
DROP POLICY IF EXISTS "Public read questions" ON public.questions;
DROP POLICY IF EXISTS "Published questions are readable" ON public.questions;

DROP POLICY IF EXISTS "Authenticated manage test_questions" ON public.test_questions;
DROP POLICY IF EXISTS "Public read test questions map" ON public.test_questions;
DROP POLICY IF EXISTS "Published test questions are readable" ON public.test_questions;
DROP POLICY IF EXISTS "Questions in published tests are readable" ON public.test_questions;

-- Keep the table privileges needed by the admin console. RLS limits these
-- operations to admins, and the remaining SELECT policies are admin-only.
REVOKE ALL PRIVILEGES ON TABLE public.questions, public.test_questions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questions, public.test_questions TO authenticated;
