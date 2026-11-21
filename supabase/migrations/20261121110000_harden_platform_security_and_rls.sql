-- Migration: 20261121110000_harden_platform_security_and_rls.sql
-- Description: Critical security hardening for public launch:
-- 1. Prevent privilege escalation on profiles (block self-assignment of 'admin' / 'super_admin' role).
-- 2. Drop dangerous 'Authenticated manage tests' policy on tests table.
-- 3. Lock down platform_settings to prevent unauthorized snooping on support chats and internal configs.
-- 4. Restrict test_attempts mutations so students cannot directly overwrite scores or delete attempts.

-- ==============================================================================
-- 1. PREVENT PROFILE PRIVILEGE ESCALATION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If role is being changed:
  IF (NEW.role IS DISTINCT FROM OLD.role) THEN
    -- Only allow role modification if caller is postgres/service_role or an existing admin
    IF NOT (
      current_user IN ('postgres', 'service_role')
      OR public.is_admin_user()
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;

  -- If account_status is being changed (e.g. self-unbanning):
  IF (NEW.account_status IS DISTINCT FROM OLD.account_status) THEN
    IF NOT (
      current_user IN ('postgres', 'service_role')
      OR public.is_admin_user()
    ) THEN
      NEW.account_status := OLD.account_status;
    END IF;
  END IF;

  -- Ensure updated_at timestamp
  NEW.updated_at := pg_catalog.now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();


-- ==============================================================================
-- 2. REMOVE DANGEROUS PERMISSIONS ON TESTS TABLE
-- ==============================================================================

-- Drop the overly permissive 'ALL true' policy on tests
DROP POLICY IF EXISTS "Authenticated manage tests" ON public.tests;

-- Ensure standard policies on tests
DROP POLICY IF EXISTS "Admins manage tests" ON public.tests;
CREATE POLICY "Admins manage tests"
  ON public.tests FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Published tests are readable" ON public.tests;
CREATE POLICY "Published tests are readable"
  ON public.tests FOR SELECT
  USING (
    status = ANY (ARRAY['published'::text, 'live'::text, 'available'::text])
    OR public.is_admin_user()
  );


-- ==============================================================================
-- 3. HARDEN PLATFORM_SETTINGS (PREVENT PRIVATE SUPPORT CHAT LEAKS)
-- ==============================================================================

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Anyone can read safe platform settings" ON public.platform_settings;

CREATE POLICY "Anyone can read safe platform settings"
  ON public.platform_settings FOR SELECT
  USING (
    coalesce(key, setting_key) IN (
      'guest_demo_enabled',
      'general',
      'coins_config',
      'payment_config',
      'coin_redemption_config',
      'global_pricing_enabled',
      'toolbox_pricing',
      'coupon_codes',
      'referral_program_config',
      'referral_enabled',
      'referrer_reward_coins',
      'referred_reward_coins',
      'test_coin_reward_slabs',
      'full_pass_config',
      'study_toolbox_config',
      'ai_tutor_config'
    )
    OR (
      auth.uid() IS NOT NULL
      AND (
        coalesce(key, setting_key) = ('support_chat:' || auth.uid()::text)
        OR public.is_admin_user()
      )
    )
  );


-- ==============================================================================
-- 4. HARDEN TEST_ATTEMPTS (PREVENT DIRECT MUTATIONS BY STUDENTS)
-- ==============================================================================

-- Remove overly broad ALL permission for users on test_attempts
DROP POLICY IF EXISTS "Users access own attempts or admin all" ON public.test_attempts;
DROP POLICY IF EXISTS "Students can view their own attempts" ON public.test_attempts;

-- Students may only read their own attempts; all modifications MUST use the security definer RPCs
CREATE POLICY "Students can view their own attempts"
  ON public.test_attempts FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_admin_user()
  );

-- Admins retain full management over test_attempts
DROP POLICY IF EXISTS "Admins manage test attempts" ON public.test_attempts;
CREATE POLICY "Admins manage test attempts"
  ON public.test_attempts FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
