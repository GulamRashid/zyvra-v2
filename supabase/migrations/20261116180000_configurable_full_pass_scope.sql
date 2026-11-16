-- Limit Full Pass access to the exam bundles and Toolbox groups selected by an
-- administrator. Existing configured passes are initialized with the current
-- published exam catalogue and paid Toolbox groups to preserve existing access;
-- exams added later stay excluded until an administrator selects them.
UPDATE public.platform_settings ps
SET setting_value = coalesce(ps.setting_value, ps.value, '{}'::jsonb)
  || jsonb_build_object(
    'included_exam_ids', CASE
      WHEN coalesce(ps.setting_value, ps.value, '{}'::jsonb) ? 'included_exam_ids'
        THEN coalesce(ps.setting_value, ps.value)->'included_exam_ids'
      ELSE coalesce((SELECT jsonb_agg(e.id::text) FROM public.exams e WHERE e.status IN ('published', 'active', 'live', 'coming-soon', 'coming_soon')), '[]'::jsonb)
    END,
    'included_tool_ids', CASE
      WHEN coalesce(ps.setting_value, ps.value, '{}'::jsonb) ? 'included_tool_ids'
        THEN coalesce(ps.setting_value, ps.value)->'included_tool_ids'
      ELSE coalesce((
        SELECT jsonb_agg(k.key)
        FROM public.platform_settings tools_row,
             LATERAL jsonb_each(coalesce(tools_row.setting_value, tools_row.value)->'tools') k
        WHERE (tools_row.setting_key = 'toolbox_pricing' OR tools_row.key = 'toolbox_pricing')
          AND lower(coalesce(k.value->>'access_type', k.value->>'accessType', '')) IN ('premium', 'paid')
          AND coalesce((k.value->>'price')::numeric, 0) > 0
      ), '[]'::jsonb)
    END
  )
WHERE ps.setting_key = 'full_pass_config' OR ps.key = 'full_pass_config';

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
  v_exam_id UUID;
  v_pass_config JSONB := '{}'::jsonb;
  v_has_pass BOOLEAN := false;
  v_has_access BOOLEAN := false;
BEGIN
  IF p_item_id IS NULL OR p_item_id = '' THEN RETURN false; END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_access ua
      WHERE ua.user_id = p_user_id AND ua.item_type = 'full_pass' AND ua.item_id = 'global'
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_pass;

    IF v_has_pass THEN
      -- This special check reports pass ownership to the purchase UI; actual
      -- content access below is restricted to the selected package contents.
      IF v_clean_type = 'full_pass' AND p_item_id = 'global' THEN RETURN true; END IF;

      SELECT coalesce(setting_value, value, '{}'::jsonb) INTO v_pass_config
      FROM public.platform_settings
      WHERE setting_key = 'full_pass_config' OR key = 'full_pass_config'
      LIMIT 1;

      IF v_clean_type = 'exam' AND coalesce(v_pass_config->'included_exam_ids', '[]'::jsonb) ? p_item_id THEN
        RETURN true;
      ELSIF v_clean_type = 'tool' AND coalesce(v_pass_config->'included_tool_ids', '[]'::jsonb) ? p_item_id THEN
        RETURN true;
      END IF;

      BEGIN v_uuid := p_item_id::UUID; EXCEPTION WHEN OTHERS THEN v_uuid := NULL; END;
      IF v_uuid IS NOT NULL AND v_clean_type IN ('folder', 'chapter') THEN
        IF v_clean_type = 'folder' THEN
          WITH RECURSIVE folder_chain AS (
            SELECT f.id, f.exam_id, coalesce(f.parent_folder_id, f.parent_id) AS parent_id, ARRAY[f.id] AS path
            FROM public.folders f WHERE f.id = v_uuid
            UNION ALL
            SELECT parent.id, parent.exam_id, coalesce(parent.parent_folder_id, parent.parent_id), child.path || parent.id
            FROM public.folders parent JOIN folder_chain child ON parent.id = child.parent_id
            WHERE NOT parent.id = ANY(child.path)
          )
          SELECT fc.exam_id INTO v_exam_id FROM folder_chain fc WHERE fc.exam_id IS NOT NULL LIMIT 1;
        ELSE
          WITH RECURSIVE folder_chain AS (
            SELECT f.id, f.exam_id, coalesce(f.parent_folder_id, f.parent_id) AS parent_id, ARRAY[f.id] AS path
            FROM public.chapters c JOIN public.folders f ON f.id = c.folder_id WHERE c.id = v_uuid
            UNION ALL
            SELECT parent.id, parent.exam_id, coalesce(parent.parent_folder_id, parent.parent_id), child.path || parent.id
            FROM public.folders parent JOIN folder_chain child ON parent.id = child.parent_id
            WHERE NOT parent.id = ANY(child.path)
          )
          SELECT fc.exam_id INTO v_exam_id FROM folder_chain fc WHERE fc.exam_id IS NOT NULL LIMIT 1;
        END IF;
        IF v_exam_id IS NOT NULL AND coalesce(v_pass_config->'included_exam_ids', '[]'::jsonb) ? v_exam_id::text THEN
          RETURN true;
        END IF;
      END IF;
    END IF;
  END IF;

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
