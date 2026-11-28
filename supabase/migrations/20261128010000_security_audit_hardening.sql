-- Security Audit Hardening (28 Nov 2026):
-- 1. Move ai_tutor_config.apiKey out of publicly-readable platform_settings into server-only ai_tutor_secret_config.
-- 2. Fix ensure_user_referral_code IDOR so users can only generate/read their own referral code.
-- 3. Revoke EXECUTE from PUBLIC/anon on admin-only SECURITY DEFINER RPCs.
-- 4. Remove direct student INSERT policy on public.referrals (all claims must go through claim_referral_code / API).

DO $$
DECLARE
  v_ai_cfg jsonb;
  v_api_key text;
BEGIN
  SELECT coalesce(setting_value, value)
  INTO v_ai_cfg
  FROM public.platform_settings
  WHERE setting_key = 'ai_tutor_config' OR key = 'ai_tutor_config'
  LIMIT 1;

  IF v_ai_cfg IS NOT NULL AND v_ai_cfg ? 'apiKey' THEN
    v_api_key := nullif(trim(v_ai_cfg->>'apiKey'), '');
    IF v_api_key IS NOT NULL THEN
      INSERT INTO public.platform_settings (key, setting_key, value, setting_value, updated_at)
      VALUES (
        'ai_tutor_secret_config',
        'ai_tutor_secret_config',
        jsonb_build_object('apiKey', v_api_key),
        jsonb_build_object('apiKey', v_api_key),
        now()
      )
      ON CONFLICT (setting_key) DO UPDATE
      SET value = jsonb_build_object('apiKey', v_api_key),
          setting_value = jsonb_build_object('apiKey', v_api_key),
          updated_at = now();
    END IF;

    UPDATE public.platform_settings
    SET value = CASE WHEN value IS NOT NULL THEN value - 'apiKey' ELSE NULL END,
        setting_value = CASE WHEN setting_value IS NOT NULL THEN setting_value - 'apiKey' ELSE NULL END,
        updated_at = now()
    WHERE setting_key = 'ai_tutor_config' OR key = 'ai_tutor_config';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_user_referral_code(p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user_id uuid := coalesce(p_user_id, v_caller);
  v_existing_code text;
  v_candidate_code text;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_collision boolean;
  v_attempt integer := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '28000';
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_caller AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Access denied.' USING ERRCODE = '42501';
  END IF;

  SELECT referral_code INTO v_existing_code
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_existing_code IS NOT NULL AND trim(v_existing_code) <> '' THEN
    RETURN upper(trim(v_existing_code));
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      v_candidate_code := 'ZYV' ||
        substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
        substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
        substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
        substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      EXIT;
    END IF;

    v_candidate_code := 'ZYV' ||
      substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
      substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
      substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);

    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE upper(trim(referral_code)) = v_candidate_code
    ) INTO v_collision;

    IF NOT v_collision THEN
      EXIT;
    END IF;
  END LOOP;

  UPDATE public.profiles
  SET referral_code = v_candidate_code
  WHERE id = v_user_id;

  RETURN v_candidate_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_user_access(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_user_access(uuid, text, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_user_coins(uuid, integer, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_access(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_access(uuid, text, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_adjust_user_coins(uuid, integer, text, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can insert referrals" ON public.referrals;
