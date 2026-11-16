-- Limit student accounts to two active Supabase Auth sessions.
-- Enforced at token issuance by the Supabase Custom Access Token Hook.

CREATE TABLE IF NOT EXISTS public.user_auth_devices (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  device_label text NOT NULL DEFAULT 'Signed-in device',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);

ALTER TABLE public.user_auth_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_auth_devices FROM anon, authenticated, public, supabase_auth_admin;

-- Keep the two most recently used existing sessions when this is first enabled.
WITH ranked_sessions AS (
  SELECT
    s.user_id,
    s.id AS session_id,
    row_number() OVER (
      PARTITION BY s.user_id
      ORDER BY coalesce(s.refreshed_at, s.updated_at, s.created_at) DESC, s.id
    ) AS session_rank
  FROM auth.sessions AS s
  LEFT JOIN public.profiles AS p ON p.id = s.user_id
  WHERE coalesce(lower(trim(p.role)), 'student') NOT IN ('admin', 'super_admin')
)
INSERT INTO public.user_auth_devices (user_id, session_id, device_label)
SELECT user_id, session_id, 'Existing device'
FROM ranked_sessions
WHERE session_rank <= 2
ON CONFLICT (user_id, session_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_two_device_limit(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := nullif(event->>'user_id', '')::uuid;
  v_session_id uuid := nullif(event->'claims'->>'session_id', '')::uuid;
  v_device_count integer;
  v_is_admin boolean;
BEGIN
  IF v_user_id IS NULL OR v_session_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'A valid sign-in session could not be confirmed. Please sign in again.'
      )
    );
  END IF;

  -- Admin access must remain available even if a student device cap is reached.
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = v_user_id
      AND lower(trim(p.role)) IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN event;
  END IF;

  -- Serialize concurrent sign-ins so two simultaneous requests cannot take a third slot.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 184736));

  -- Remove device slots for sessions that have been signed out or revoked.
  DELETE FROM public.user_auth_devices AS d
  WHERE d.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM auth.sessions AS s
      WHERE s.id = d.session_id AND s.user_id = d.user_id
    );

  -- Token refreshes for an already registered device keep the same slot.
  UPDATE public.user_auth_devices
  SET last_seen_at = now()
  WHERE user_id = v_user_id AND session_id = v_session_id;

  IF FOUND THEN
    RETURN event;
  END IF;

  SELECT count(*) INTO v_device_count
  FROM public.user_auth_devices
  WHERE user_id = v_user_id;

  IF v_device_count >= 2 THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This account is already signed in on two devices. Sign out from another device, then try again.'
      )
    );
  END IF;

  INSERT INTO public.user_auth_devices (user_id, session_id)
  VALUES (v_user_id, v_session_id)
  ON CONFLICT (user_id, session_id) DO UPDATE SET last_seen_at = now();

  RETURN event;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_two_device_limit(jsonb) FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.enforce_two_device_limit(jsonb) TO supabase_auth_admin;

COMMENT ON FUNCTION public.enforce_two_device_limit(jsonb) IS
  'Supabase Custom Access Token Hook: allows at most two active sessions per student account.';
