-- Draft Migration: RPC for securely ensuring/generating a student referral code
-- Timestamp: 20261114020000
-- NOTE: DO NOT apply automatically. Apply manually via Supabase dashboard when approved.

CREATE OR REPLACE FUNCTION public.ensure_user_referral_code(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_existing_code text;
  v_candidate_code text;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_collision boolean;
  v_attempt integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Check if user already has a referral code
  SELECT referral_code INTO v_existing_code
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_existing_code IS NOT NULL AND trim(v_existing_code) <> '' THEN
    RETURN v_existing_code;
  END IF;

  -- 2. Generate unique code
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 10 THEN
      RETURN NULL;
    END IF;

    v_candidate_code := 'ZYV' ||
      substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
      substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
      substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);

    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE referral_code = v_candidate_code
    ) INTO v_collision;

    IF NOT v_collision THEN
      EXIT;
    END IF;
  END LOOP;

  -- 3. Update profile with newly generated code
  UPDATE public.profiles
  SET referral_code = v_candidate_code
  WHERE id = v_user_id;

  RETURN v_candidate_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_referral_code(uuid) TO authenticated;
