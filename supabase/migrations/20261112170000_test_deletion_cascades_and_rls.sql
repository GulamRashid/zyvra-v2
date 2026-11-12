-- ==============================================================================
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
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'test_questions'
      AND con.contype = 'f'
      AND (
        con.conname LIKE '%test_id%' OR
        pg_get_constraintdef(con.oid) LIKE '%REFERENCES public.tests%'
      )
  )
  LOOP
    EXECUTE format('ALTER TABLE public.test_questions DROP CONSTRAINT IF EXISTS %I', v_con_name);
  END LOOP;

  ALTER TABLE public.test_questions
    ADD CONSTRAINT test_questions_test_id_fkey
    FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
END
$$;

-- 2. Ensure test_attempts (if exists) has ON DELETE CASCADE on test_id
DO $$
DECLARE
  v_con_name TEXT;
  v_table_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'test_attempts'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    FOR v_con_name IN (
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'test_attempts'
        AND con.contype = 'f'
        AND (
          con.conname LIKE '%test_id%' OR
          pg_get_constraintdef(con.oid) LIKE '%REFERENCES public.tests%'
        )
    )
    LOOP
      EXECUTE format('ALTER TABLE public.test_attempts DROP CONSTRAINT IF EXISTS %I', v_con_name);
    END LOOP;

    ALTER TABLE public.test_attempts
      ADD CONSTRAINT test_attempts_test_id_fkey
      FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 3. Ensure comprehensive Admin RLS policies (FOR ALL including DELETE)
DROP POLICY IF EXISTS "Admins manage tests" ON public.tests;
CREATE POLICY "Admins manage tests"
  ON public.tests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Admins manage test questions" ON public.test_questions;
CREATE POLICY "Admins manage test questions"
  ON public.test_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'test_attempts'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins manage test attempts" ON public.test_attempts';
    EXECUTE 'CREATE POLICY "Admins manage test attempts" ON public.test_attempts FOR ALL TO authenticated ' ||
            'USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin''))) ' ||
            'WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN (''admin'', ''super_admin'')))';
    EXECUTE 'GRANT ALL ON public.test_attempts TO authenticated';
  END IF;
END
$$;

GRANT ALL ON public.tests, public.test_questions TO authenticated;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
