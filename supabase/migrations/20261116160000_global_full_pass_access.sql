-- Global Full Pass entitlement. The common access RPC is used by the student
-- content catalogue and Toolbox, so one active grant covers current and future
-- paid items without expanding a static list of folders/chapters.
CREATE OR REPLACE FUNCTION public.check_user_access(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_type TEXT := lower(trim(p_item_type));
  v_uuid UUID;
  v_exam RECORD;
  v_has_access BOOLEAN := false;
BEGIN
  IF p_item_id IS NULL OR p_item_id = '' THEN RETURN false; END IF;

  -- A valid global pass includes paid content added after its purchase.
  IF p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_access ua
    WHERE ua.user_id = p_user_id AND ua.item_type = 'full_pass' AND ua.item_id = 'global'
      AND (ua.is_active IS NULL OR ua.is_active = true)
      AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
      AND (ua.expires_at IS NULL OR ua.expires_at > now())
  ) THEN RETURN true; END IF;

  BEGIN v_uuid := p_item_id::UUID; EXCEPTION WHEN OTHERS THEN v_uuid := NULL; END;
  IF v_clean_type = 'exam' THEN
    IF v_uuid IS NOT NULL THEN
      SELECT access_mode, price INTO v_exam FROM public.exams WHERE id = v_uuid;
      IF FOUND AND (v_exam.access_mode = 'free' OR v_exam.price IS NULL OR v_exam.price <= 0) THEN RETURN true; END IF;
    END IF;
    IF p_user_id IS NULL THEN RETURN false; END IF;
    SELECT EXISTS (SELECT 1 FROM public.user_access ua WHERE ua.user_id = p_user_id AND ua.item_type = 'exam' AND ua.item_id::text = p_item_id
      AND (ua.is_active IS NULL OR ua.is_active = true) AND (ua.status IS NULL OR ua.status IN ('active','granted','lifetime')) AND (ua.expires_at IS NULL OR ua.expires_at > now())) INTO v_has_access;
    RETURN v_has_access;
  ELSIF v_clean_type = 'folder' THEN
    IF v_uuid IS NULL THEN RETURN false; END IF;
    RETURN public.user_has_folder_access(p_user_id, v_uuid);
  ELSIF v_clean_type = 'chapter' THEN
    IF v_uuid IS NULL THEN RETURN false; END IF;
    RETURN public.user_has_chapter_access(p_user_id, v_uuid);
  END IF;
  IF p_user_id IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_access ua WHERE ua.user_id = p_user_id AND ua.item_type = v_clean_type AND ua.item_id::text = p_item_id
    AND (ua.is_active IS NULL OR ua.is_active = true) AND (ua.status IS NULL OR ua.status IN ('active','granted','lifetime')) AND (ua.expires_at IS NULL OR ua.expires_at > now())) INTO v_has_access;
  RETURN v_has_access;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_access(UUID, TEXT, TEXT) TO anon, authenticated;
