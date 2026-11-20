-- Migration: 20261120220000_device_session_takeover_and_permission_grants.sql
-- 1. Grant execute on is_admin_user to anon & authenticated so public tables with RLS don't fail for visitors.
-- 2. Provide evict_oldest_device_session RPC for seamless multi-device takeover when 2-device limit is reached.

-- 1. Grant execute on is_admin_user
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_user'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated, service_role;
  END IF;
END $$;

-- 2. Device Session Eviction RPC
CREATE OR REPLACE FUNCTION public.evict_oldest_device_session(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_oldest_session_id uuid;
  v_clean_email text := lower(trim(p_email));
BEGIN
  IF v_clean_email IS NULL OR v_clean_email = '' OR p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email and password are required.');
  END IF;

  -- Verify user identity strictly via pgcrypto
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_clean_email
    AND encrypted_password = crypt(p_password, encrypted_password);

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email or password.');
  END IF;

  -- Advisory lock to prevent race conditions during session eviction
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 184736));

  -- Clean up any dead sessions first
  DELETE FROM public.user_auth_devices AS d
  WHERE d.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM auth.sessions AS s
      WHERE s.id = d.session_id AND s.user_id = d.user_id
    );

  -- Find the oldest active device session
  SELECT session_id INTO v_oldest_session_id
  FROM public.user_auth_devices
  WHERE user_id = v_user_id
  ORDER BY last_seen_at ASC, created_at ASC
  LIMIT 1;

  IF v_oldest_session_id IS NOT NULL THEN
    -- Delete from auth.sessions (logs out the older device immediately)
    DELETE FROM auth.sessions WHERE id = v_oldest_session_id;
    -- Delete from user_auth_devices slot
    DELETE FROM public.user_auth_devices WHERE session_id = v_oldest_session_id;
  ELSE
    -- Fallback: evict oldest session from auth.sessions directly
    DELETE FROM auth.sessions
    WHERE id = (
      SELECT id FROM auth.sessions
      WHERE user_id = v_user_id
      ORDER BY coalesce(refreshed_at, updated_at, created_at) ASC
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Oldest device session was successfully terminated.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evict_oldest_device_session(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.evict_oldest_device_session(text, text) TO anon, authenticated, service_role;
