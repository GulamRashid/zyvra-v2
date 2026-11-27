-- Phase 4: Admin Roles & Permissions, Audit Log, and Support Ticket Integrity

-- 1. Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor_id
  ON public.admin_audit_logs (actor_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'editor', 'support_agent')
    )
  );

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin', 'editor', 'support_agent')
    )
  );

-- 2. Allow editor and support_agent roles in profiles.role check constraint if present
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'profiles'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('student', 'admin', 'super_admin', 'editor', 'support_agent'));
  END IF;
END $$;

-- 3. Seed default role permissions matrix in platform_settings
INSERT INTO public.platform_settings (key, setting_key, value, setting_value, updated_at)
VALUES (
  'admin_role_permissions',
  'admin_role_permissions',
  '{
    "super_admin": {
      "label": "Super Admin",
      "can_manage_content": true,
      "can_manage_tests": true,
      "can_manage_users": true,
      "can_manage_orders": true,
      "can_manage_coins": true,
      "can_manage_settings": true,
      "can_manage_support": true,
      "can_manage_roles": true
    },
    "admin": {
      "label": "Admin",
      "can_manage_content": true,
      "can_manage_tests": true,
      "can_manage_users": true,
      "can_manage_orders": true,
      "can_manage_coins": true,
      "can_manage_settings": true,
      "can_manage_support": true,
      "can_manage_roles": false
    },
    "editor": {
      "label": "Content Editor",
      "can_manage_content": true,
      "can_manage_tests": true,
      "can_manage_users": false,
      "can_manage_orders": false,
      "can_manage_coins": false,
      "can_manage_settings": false,
      "can_manage_support": false,
      "can_manage_roles": false
    },
    "support_agent": {
      "label": "Support Agent",
      "can_manage_content": false,
      "can_manage_tests": false,
      "can_manage_users": true,
      "can_manage_orders": false,
      "can_manage_coins": false,
      "can_manage_settings": false,
      "can_manage_support": true,
      "can_manage_roles": false
    }
  }'::jsonb,
  '{
    "super_admin": {
      "label": "Super Admin",
      "can_manage_content": true,
      "can_manage_tests": true,
      "can_manage_users": true,
      "can_manage_orders": true,
      "can_manage_coins": true,
      "can_manage_settings": true,
      "can_manage_support": true,
      "can_manage_roles": true
    },
    "admin": {
      "label": "Admin",
      "can_manage_content": true,
      "can_manage_tests": true,
      "can_manage_users": true,
      "can_manage_orders": true,
      "can_manage_coins": true,
      "can_manage_settings": true,
      "can_manage_support": true,
      "can_manage_roles": false
    },
    "editor": {
      "label": "Content Editor",
      "can_manage_content": true,
      "can_manage_tests": true,
      "can_manage_users": false,
      "can_manage_orders": false,
      "can_manage_coins": false,
      "can_manage_settings": false,
      "can_manage_support": false,
      "can_manage_roles": false
    },
    "support_agent": {
      "label": "Support Agent",
      "can_manage_content": false,
      "can_manage_tests": false,
      "can_manage_users": true,
      "can_manage_orders": false,
      "can_manage_coins": false,
      "can_manage_settings": false,
      "can_manage_support": true,
      "can_manage_roles": false
    }
  }'::jsonb,
  now()
)
ON CONFLICT (setting_key) DO NOTHING;
