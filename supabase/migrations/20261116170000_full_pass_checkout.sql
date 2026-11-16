-- Add administrator-priced Full Pass and Toolbox purchases to the existing
-- server-priced checkout and grant pipeline. Client supplied prices are ignored.
DO $$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.create_checkout_order(text,text,integer)'::regprocedure) INTO v_def;
  v_old := $old$IF v_clean_type NOT IN ('folder', 'chapter', 'exam') THEN$old$;
  v_new := $new$IF v_clean_type NOT IN ('folder', 'chapter', 'exam', 'tool', 'toolbox_combo', 'full_pass') THEN$new$;
  IF position(v_old in v_def) > 0 THEN
    v_def := replace(v_def, v_old, v_new);
  ELSIF position(v_new in v_def) = 0 THEN
    RAISE EXCEPTION 'Could not safely extend checkout item types';
  END IF;

  v_old := $old$  IF v_clean_type = 'folder' THEN$old$;
  v_new := $new$  IF v_clean_type IN ('full_pass', 'tool', 'toolbox_combo') THEN
    IF v_clean_type = 'full_pass' AND p_item_id <> 'global' THEN RAISE EXCEPTION 'Invalid Full Pass item'; END IF;
    IF v_clean_type = 'toolbox_combo' AND p_item_id <> 'all-tools' THEN RAISE EXCEPTION 'Invalid Toolbox bundle item'; END IF;
    IF v_clean_type = 'tool' AND p_item_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' THEN RAISE EXCEPTION 'Invalid Toolbox item'; END IF;
    IF v_clean_type = 'full_pass' THEN
      SELECT coalesce(((coalesce(setting_value, value)->>'price')::numeric), 0), 'Zyvra Full Pass'
        INTO v_base_price, v_item_title
        FROM public.platform_settings
        WHERE setting_key = 'full_pass_config' OR key = 'full_pass_config'
        LIMIT 1;
    ELSIF v_clean_type = 'toolbox_combo' THEN
      SELECT coalesce(((coalesce(setting_value, value)->'combo'->>'price')::numeric), 0), 'Toolbox: All Tools'
        INTO v_base_price, v_item_title
        FROM public.platform_settings
        WHERE setting_key = 'toolbox_pricing' OR key = 'toolbox_pricing'
        LIMIT 1;
    ELSE
      SELECT coalesce(((coalesce(setting_value, value)->'tools'->p_item_id->>'price')::numeric), 0), 'Toolbox: ' || p_item_id
        INTO v_base_price, v_item_title
        FROM public.platform_settings
        WHERE setting_key = 'toolbox_pricing' OR key = 'toolbox_pricing'
        LIMIT 1;
    END IF;
    IF v_base_price <= 0 THEN RAISE EXCEPTION 'This item is not currently available for purchase'; END IF;
  ELSIF v_clean_type = 'folder' THEN$new$;
  IF position(v_old in v_def) > 0 THEN
    v_def := replace(v_def, v_old, v_new);
  ELSIF position($branch$IF v_clean_type IN ('full_pass', 'tool', 'toolbox_combo') THEN$branch$ in v_def) = 0 THEN
    RAISE EXCEPTION 'Could not safely add Full Pass and Toolbox pricing';
  END IF;
  EXECUTE v_def;
END $$;

-- Put the configured validity on successful pass/tool grants. Existing course
-- purchases retain their non-expiring semantics. Retry reconciliation refreshes
-- expiry only for pass/tool grants.
DO $$
DECLARE
  v_def text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.fulfill_checkout_order_atomic(text,text,text,bigint,text)'::regprocedure) INTO v_def;
  v_old := 'starts_at, created_at, updated_at';
  IF length(v_def) - length(replace(v_def, v_old, '')) = 2 * length(v_old) THEN
    v_def := replace(v_def, v_old, 'starts_at, expires_at, created_at, updated_at');
  ELSIF length(v_def) - length(replace(v_def, 'starts_at, expires_at, created_at, updated_at', '')) <> 2 * length('starts_at, expires_at, created_at, updated_at') THEN
    RAISE EXCEPTION 'Unexpected checkout fulfillment grant layout';
  END IF;

  v_old := $old$true,
      now(), now(), now()$old$;
  v_new := $new$true,
      now(), CASE
        WHEN v_item_type = 'full_pass' THEN now() + make_interval(days => least(3650, greatest(1, coalesce((SELECT ((coalesce(setting_value, value)->>'validity_days')::integer) FROM public.platform_settings WHERE setting_key = 'full_pass_config' OR key = 'full_pass_config' LIMIT 1), 365))))
        WHEN v_item_type = 'tool' THEN now() + make_interval(days => least(3650, greatest(1, coalesce((SELECT ((coalesce(setting_value, value)->'tools'->v_order.item_id::text->>'validity_days')::integer) FROM public.platform_settings WHERE setting_key = 'toolbox_pricing' OR key = 'toolbox_pricing' LIMIT 1), 30))))
        WHEN v_item_type = 'toolbox_combo' THEN now() + make_interval(days => least(3650, greatest(1, coalesce((SELECT ((coalesce(setting_value, value)->'combo'->>'validity_days')::integer) FROM public.platform_settings WHERE setting_key = 'toolbox_pricing' OR key = 'toolbox_pricing' LIMIT 1), 30))))
        ELSE NULL END, now(), now()$new$;
  IF regexp_count(v_def, 'true,[[:space:]]+now\(\), now\(\), now\(\)') = 2 THEN
    v_new := replace(v_new, E'\n      ', E'\n    ');
    v_def := regexp_replace(v_def, 'true,[[:space:]]+now\(\), now\(\), now\(\)', v_new, 'g');
  ELSIF regexp_count(v_def, 'true,[[:space:]]+now\(\), CASE[[:space:]]+WHEN v_item_type = ''full_pass''') <> 2 THEN
    RAISE EXCEPTION 'Could not safely apply purchase validity';
  END IF;

  v_old := $old$DO UPDATE SET status = 'active', is_active = true, updated_at = now();$old$;
  v_new := $new$DO UPDATE SET status = 'active', is_active = true,
      expires_at = CASE WHEN v_item_type IN ('full_pass', 'tool', 'toolbox_combo') THEN EXCLUDED.expires_at ELSE public.user_access.expires_at END,
      updated_at = now();$new$;
  IF length(v_def) - length(replace(v_def, v_old, '')) = 2 * length(v_old) THEN
    v_def := replace(v_def, v_old, v_new);
  ELSIF length(v_def) - length(replace(v_def, 'expires_at = CASE WHEN v_item_type IN', '')) <> length('expires_at = CASE WHEN v_item_type IN') THEN
    RAISE EXCEPTION 'Could not safely preserve entitlement validity on retries';
  END IF;
  EXECUTE v_def;
END $$;

-- Expand any existing payment order type constraint without changing old rows.
DO $$
DECLARE c record; v_column text;
BEGIN
  SELECT conname, pg_get_constraintdef(oid) AS def INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.user_access'::regclass AND conname = 'user_access_item_type_check' AND contype = 'c';
  IF FOUND AND (c.def NOT ILIKE '%full_pass%' OR c.def NOT ILIKE '%toolbox_combo%' OR c.def NOT ILIKE '%tool%') THEN
    ALTER TABLE public.user_access DROP CONSTRAINT user_access_item_type_check;
    ALTER TABLE public.user_access ADD CONSTRAINT user_access_item_type_check
      CHECK (item_type IN ('exam', 'folder', 'chapter', 'tool', 'toolbox_combo', 'full_pass')) NOT VALID;
    ALTER TABLE public.user_access VALIDATE CONSTRAINT user_access_item_type_check;
  END IF;

  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.payment_orders'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) ILIKE '%item_type%' OR pg_get_constraintdef(oid) ILIKE '%order_type%')
  LOOP
    IF c.def ILIKE '%folder%' AND c.def ILIKE '%chapter%' AND c.def ILIKE '%exam%'
      AND (c.def NOT ILIKE '%full_pass%' OR c.def NOT ILIKE '%toolbox_combo%' OR c.def NOT ILIKE '%tool%') THEN
      v_column := CASE WHEN c.def ILIKE '%order_type%' THEN 'order_type' ELSE 'item_type' END;
      EXECUTE format('ALTER TABLE public.payment_orders DROP CONSTRAINT %I', c.conname);
      EXECUTE format('ALTER TABLE public.payment_orders ADD CONSTRAINT %I CHECK (%I IN (''folder'', ''chapter'', ''exam'', ''tool'', ''toolbox_combo'', ''full_pass'')) NOT VALID', c.conname, v_column);
      EXECUTE format('ALTER TABLE public.payment_orders VALIDATE CONSTRAINT %I', c.conname);
    END IF;
  END LOOP;
END $$;
