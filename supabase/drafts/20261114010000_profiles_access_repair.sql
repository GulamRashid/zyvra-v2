-- Repair authenticated profile access for the existing profiles schema.
-- Apply manually in Supabase; this migration is intentionally not applied by the app.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (full_name, target_exams, daily_goal_target, theme, preferred_language)
  ON TABLE public.profiles TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can read profiles" ON public.profiles;
CREATE POLICY "Admins can read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Users can update own safe profile" ON public.profiles;
CREATE POLICY "Users can update own safe profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
