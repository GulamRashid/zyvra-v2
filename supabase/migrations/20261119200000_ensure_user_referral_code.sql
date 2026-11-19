-- ==============================================================================
-- Zyvra Migration: Ensure Student Referral Code RPC & Backfill
-- Timestamp: 20261119200000
-- ==============================================================================

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

  -- 1. Check if user already has a valid referral code
  SELECT referral_code INTO v_existing_code
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_existing_code IS NOT NULL AND trim(v_existing_code) <> '' THEN
    RETURN upper(trim(v_existing_code));
  END IF;

  -- 2. Generate unique code starting with ZYV
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      -- Fallback to 4 random characters to guarantee uniqueness
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

  -- 3. Update profile with newly generated code
  UPDATE public.profiles
  SET referral_code = v_candidate_code
  WHERE id = v_user_id;

  RETURN v_candidate_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_referral_code(uuid) TO service_role;

-- Backfill referral codes for any existing users who don't have one
DO $$
DECLARE
  r RECORD;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_new_code text;
  v_exists boolean;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL OR trim(referral_code) = '' LOOP
    LOOP
      v_new_code := 'ZYV' ||
        substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
        substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1) ||
        substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
      
      SELECT EXISTS (SELECT 1 FROM public.profiles WHERE upper(trim(referral_code)) = v_new_code) INTO v_exists;
      IF NOT v_exists THEN
        EXIT;
      END IF;
    END LOOP;
    
    UPDATE public.profiles SET referral_code = v_new_code WHERE id = r.id;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
