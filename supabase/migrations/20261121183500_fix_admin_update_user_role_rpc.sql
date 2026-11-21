-- Migration: Fix admin_update_user_role RPC parameters
-- Aligns RPC signature with UserManager client calls: (p_user_id uuid, p_role text, p_reason text)

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id uuid,
  p_role text,
  p_reason text DEFAULT 'Role updated by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_clean_role text := lower(trim(p_role));
  v_old_role text;
  v_actor_id uuid := auth.uid();
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied. Administrator role required.' USING ERRCODE = '42501';
  END IF;

  IF v_clean_role NOT IN ('student', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid role specified: %', v_clean_role USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Safety check: prevent removing the last super_admin
  IF v_old_role = 'super_admin' AND v_clean_role != 'super_admin' THEN
    IF (SELECT count(*) FROM public.profiles WHERE role = 'super_admin') <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the only super_admin. Create or assign another super_admin first.' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.profiles 
  SET role = v_clean_role,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Audit log entry
  BEGIN
    INSERT INTO public.audit_logs (
      actor_id, actor_role, action, target_entity, target_id, reason, old_value, new_value, created_at
    ) VALUES (
      v_actor_id, 'admin', 'update_role', 'profiles', p_user_id::text, coalesce(nullif(trim(p_reason), ''), 'Role updated by admin'),
      jsonb_build_object('role', v_old_role),
      jsonb_build_object('role', v_clean_role),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'new_role', v_clean_role, 'old_role', v_old_role);
END;
$$;

-- Alias/fallback for legacy callers
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
  RETURN public.admin_update_user_role(p_target_user_id, p_new_role, 'Role updated by admin');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated, service_role;
