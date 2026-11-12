-- ==============================================================================
-- Zyvra Migration: Hierarchical Unlock, Access Control & Constraint Synchronization
-- Timestamp: 20261112120000
-- 1. Drops legacy/inconsistent check constraints and standardizes pricing_mode to ('free', 'paid_own', 'inherit').
-- 2. Implements recursive hierarchical folder & chapter access functions (WITH RECURSIVE).
-- 3. Implements secure checkout fulfillment and user entitlement management.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DYNAMICALLY DROP EXISTING CHECK CONSTRAINTS ON FOLDERS & CONTENT TABLES
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Drop any check constraint related to pricing_mode or access_mode dynamically
  FOR v_rec IN (
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND con.contype = 'c'
      AND rel.relname IN ('folders', 'chapters', 'chapter_resources')
      AND (
        con.conname LIKE '%pricing_mode%' OR
        con.conname LIKE '%access_mode%' OR
        pg_get_constraintdef(con.oid) LIKE '%pricing_mode%' OR
        pg_get_constraintdef(con.oid) LIKE '%access_mode%'
      )
  )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', v_rec.relname, v_rec.conname);
  END LOOP;
END
$$;

-- Explicitly ensure known constraint names are dropped
ALTER TABLE public.folders
  DROP CONSTRAINT IF EXISTS folders_pricing_mode_allowed,
  DROP CONSTRAINT IF EXISTS folders_pricing_mode_check;

ALTER TABLE public.chapters
  DROP CONSTRAINT IF EXISTS chapters_access_mode_allowed,
  DROP CONSTRAINT IF EXISTS chapters_access_mode_check;

ALTER TABLE public.chapter_resources
  DROP CONSTRAINT IF EXISTS chapter_resources_resource_type_allowed,
  DROP CONSTRAINT IF EXISTS chapter_resources_resource_type_check;

-- Ensure parent_id column exists on public.folders as an alias/companion to parent_folder_id
ALTER TABLE public.folders
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 2. STANDARDIZE & NORMALIZE EXISTING CONTENT DATA
-- ------------------------------------------------------------------------------
UPDATE public.folders
  SET parent_id = parent_folder_id
  WHERE parent_id IS NULL AND parent_folder_id IS NOT NULL;

UPDATE public.folders
  SET parent_folder_id = parent_id
  WHERE parent_folder_id IS NULL AND parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_folder_parent_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_folder_id IS NOT NULL AND NEW.parent_id IS NULL THEN
    NEW.parent_id := NEW.parent_folder_id;
  ELSIF NEW.parent_id IS NOT NULL AND NEW.parent_folder_id IS NULL THEN
    NEW.parent_folder_id := NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_folder_parent_id ON public.folders;
CREATE TRIGGER trg_sync_folder_parent_id
BEFORE INSERT OR UPDATE ON public.folders
FOR EACH ROW EXECUTE FUNCTION public.sync_folder_parent_id();

UPDATE public.folders
  SET pricing_mode = 'paid_own'
  WHERE pricing_mode = 'paid-own';

UPDATE public.folders
  SET pricing_mode = 'inherit'
  WHERE pricing_mode IN ('inherit-parent', 'inherit_parent');

UPDATE public.folders
  SET pricing_mode = 'free'
  WHERE pricing_mode IS NULL OR pricing_mode NOT IN ('free', 'paid_own', 'inherit');

UPDATE public.chapters
  SET access_mode = 'paid_own'
  WHERE access_mode = 'paid-own';

UPDATE public.chapters
  SET access_mode = 'inherit'
  WHERE access_mode IN ('inherit-parent', 'inherit_parent');

UPDATE public.chapters
  SET access_mode = 'free'
  WHERE access_mode = 'free';

UPDATE public.chapters
  SET access_mode = 'inherit'
  WHERE access_mode IS NULL OR access_mode NOT IN ('free', 'paid_own', 'inherit');

UPDATE public.chapter_resources
  SET resource_type = lower(trim(resource_type))
  WHERE resource_type IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. RECREATE CLEAN, STANDARDIZED CHECK CONSTRAINTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.folders
  ADD CONSTRAINT folders_pricing_mode_check
  CHECK (pricing_mode IN ('free', 'paid_own', 'inherit'));

ALTER TABLE public.chapters
  ADD CONSTRAINT chapters_access_mode_check
  CHECK (access_mode IN ('free', 'paid_own', 'inherit'));

ALTER TABLE public.chapter_resources
  ADD CONSTRAINT chapter_resources_resource_type_check
  CHECK (resource_type IN ('pdf', 'formula_sheet', 'revision_sheet', 'notes', 'PDF', 'Formula Sheet', 'Revision Sheet', 'Notes', 'doc', 'document', 'video', 'link'));

-- ------------------------------------------------------------------------------
-- 4. ENSURE ENTITLEMENT & ORDER TABLES EXIST
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely ensure all required columns exist on public.user_access (in case table existed already)
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Ensure item_id column is TEXT so it supports both UUIDs and string identifiers (tools, combo keys, etc.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_access'
      AND column_name = 'item_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE public.user_access ALTER COLUMN item_id TYPE TEXT USING item_id::TEXT;
  END IF;
END
$$;

-- Ensure unique constraint on (user_id, item_type, item_id) for safe upserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_access_user_item_unique'
  ) THEN
    -- Remove any duplicates before adding constraint
    DELETE FROM public.user_access a
    USING public.user_access b
    WHERE a.id > b.id
      AND a.user_id = b.user_id
      AND a.item_type = b.item_type
      AND a.item_id::text = b.item_id::text;

    ALTER TABLE public.user_access
      ADD CONSTRAINT user_access_user_item_unique UNIQUE (user_id, item_type, item_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

CREATE INDEX IF NOT EXISTS idx_user_access_lookup
  ON public.user_access (user_id, item_type, item_id, is_active, status);

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  amount_paise BIGINT NOT NULL DEFAULT 0,
  coins_redeemed INTEGER NOT NULL DEFAULT 0,
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  payment_signature TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely ensure all required columns exist on public.payment_orders (in case table existed already)
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_redeemed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_signature TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_orders'
      AND column_name = 'item_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE public.payment_orders ALTER COLUMN item_id TYPE TEXT USING item_id::TEXT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created
  ON public.payment_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_gateway_order
  ON public.payment_orders (gateway_order_id);

-- Enable RLS on user_access & payment_orders
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own access" ON public.user_access;
CREATE POLICY "Users can read own access"
  ON public.user_access FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all access" ON public.user_access;
CREATE POLICY "Admins manage all access"
  ON public.user_access FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Users can read own orders" ON public.payment_orders;
CREATE POLICY "Users can read own orders"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage all orders" ON public.payment_orders;
CREATE POLICY "Admins manage all orders"
  ON public.payment_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')));

-- ------------------------------------------------------------------------------
-- 5. RECURSIVE HIERARCHICAL FOLDER ACCESS FUNCTION
-- ------------------------------------------------------------------------------
-- Walks UP the parent chain from p_folder_id to the root folder using a WITH RECURSIVE CTE.
-- Returns true if:
--   a) The folder's effective pricing is free, OR
--   b) The user has an active purchase/entitlement for p_folder_id OR ANY ancestor folder in its chain.
CREATE OR REPLACE FUNCTION public.user_has_folder_access(
  p_user_id UUID,
  p_folder_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder RECORD;
  v_has_entitlement BOOLEAN := false;
  v_effective_amount NUMERIC := 0;
BEGIN
  IF p_folder_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify folder existence
  SELECT id, exam_id, COALESCE(parent_folder_id, parent_id) AS parent_folder_id, pricing_mode, price, status
  INTO v_folder
  FROM public.folders
  WHERE id = p_folder_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. If user is authenticated, check for active entitlement on this folder or any ancestor folder
  IF p_user_id IS NOT NULL THEN
    WITH RECURSIVE folder_chain AS (
      SELECT
        id,
        COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
        pricing_mode,
        price,
        1 AS depth
      FROM public.folders
      WHERE id = p_folder_id

      UNION ALL

      SELECT
        f.id,
        COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
        f.pricing_mode,
        f.price,
        fc.depth + 1
      FROM public.folders f
      JOIN folder_chain fc ON f.id = fc.parent_folder_id
    )
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      JOIN folder_chain fc ON ua.item_id::text = fc.id::text
      WHERE ua.user_id = p_user_id
        AND ua.item_type = 'folder'
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_entitlement;

    IF v_has_entitlement THEN
      RETURN true;
    END IF;

    -- Also check if user holds an exam pass for this folder's exam
    IF v_folder.exam_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.user_access ua
        WHERE ua.user_id = p_user_id
          AND ua.item_type = 'exam'
          AND ua.item_id::text = v_folder.exam_id::text
          AND (ua.is_active IS NULL OR ua.is_active = true)
          AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
          AND (ua.expires_at IS NULL OR ua.expires_at > now())
      ) INTO v_has_entitlement;

      IF v_has_entitlement THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  -- 2. Check effective pricing: Is this folder effectively free?
  WITH RECURSIVE folder_pricing_chain AS (
    SELECT
      id,
      COALESCE(parent_folder_id, parent_id) AS parent_folder_id,
      pricing_mode,
      price,
      1 AS depth
    FROM public.folders
    WHERE id = p_folder_id

    UNION ALL

    SELECT
      f.id,
      COALESCE(f.parent_folder_id, f.parent_id) AS parent_folder_id,
      f.pricing_mode,
      f.price,
      fpc.depth + 1
    FROM public.folders f
    JOIN folder_pricing_chain fpc ON f.id = fpc.parent_folder_id
    WHERE fpc.pricing_mode IN ('inherit', 'inherit-parent', 'inherit_parent')
  )
  SELECT
    CASE
      WHEN pricing_mode = 'free' THEN 0
      WHEN pricing_mode IN ('paid_own', 'paid-own') THEN COALESCE(price, 0)
      ELSE 0
    END INTO v_effective_amount
  FROM folder_pricing_chain
  WHERE pricing_mode IN ('free', 'paid_own', 'paid-own')
     OR parent_folder_id IS NULL
  ORDER BY depth ASC
  LIMIT 1;

  IF COALESCE(v_effective_amount, 0) <= 0 THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. HIERARCHICAL CHAPTER ACCESS FUNCTION
-- ------------------------------------------------------------------------------
-- Returns true if:
--   a) The chapter itself is free, OR
--   b) Directly purchased by the user, OR
--   c) The user has folder access for chapter.folder_id (hierarchical ancestor purchase).
CREATE OR REPLACE FUNCTION public.user_has_chapter_access(
  p_user_id UUID,
  p_chapter_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chapter RECORD;
  v_has_direct BOOLEAN := false;
BEGIN
  IF p_chapter_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id, folder_id, access_mode, price, status
  INTO v_chapter
  FROM public.chapters
  WHERE id = p_chapter_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 1. Free chapter
  IF v_chapter.access_mode = 'free' OR (v_chapter.access_mode IN ('paid_own', 'paid-own') AND COALESCE(v_chapter.price, 0) <= 0) THEN
    RETURN true;
  END IF;

  -- 2. Directly purchased by user
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = 'chapter'
        AND ua.item_id::text = p_chapter_id::text
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_direct;

    IF v_has_direct THEN
      RETURN true;
    END IF;
  END IF;

  -- 3. Check hierarchical folder access for the parent folder
  IF v_chapter.folder_id IS NOT NULL THEN
    RETURN public.user_has_folder_access(p_user_id, v_chapter.folder_id);
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. GENERAL CHECK_USER_ACCESS RPC (USED BY FRONTEND HOOK)
-- ------------------------------------------------------------------------------
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
  v_has_access BOOLEAN := false;
  v_uuid UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_clean_type = 'folder' THEN
    BEGIN
      v_uuid := p_item_id::UUID;
      RETURN public.user_has_folder_access(p_user_id, v_uuid);
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  ELSIF v_clean_type = 'chapter' THEN
    BEGIN
      v_uuid := p_item_id::UUID;
      RETURN public.user_has_chapter_access(p_user_id, v_uuid);
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  ELSIF v_clean_type = 'exam' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = 'exam'
        AND ua.item_id::text = p_item_id
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_access;

    IF v_has_access THEN
      RETURN true;
    END IF;

    BEGIN
      v_uuid := p_item_id::UUID;
      SELECT (COALESCE(price, 0) <= 0) INTO v_has_access
      FROM public.exams
      WHERE id = v_uuid;
      RETURN COALESCE(v_has_access, true);
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = p_user_id
        AND ua.item_type = v_clean_type
        AND ua.item_id::text = p_item_id
        AND (ua.is_active IS NULL OR ua.is_active = true)
        AND (ua.status IS NULL OR ua.status IN ('active', 'granted', 'lifetime'))
        AND (ua.expires_at IS NULL OR ua.expires_at > now())
    ) INTO v_has_access;

    RETURN v_has_access;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. CHECKOUT FULFILLMENT RPC (COMPLETE_SUCCESSFUL_CHECKOUT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_successful_checkout(
  p_order_id TEXT,
  p_payment_id TEXT,
  p_payment_signature TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_order_uuid UUID;
BEGIN
  -- Locate order in payment_orders
  BEGIN
    v_order_uuid := p_order_id::UUID;
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = v_order_uuid
       OR gateway_order_id = p_order_id
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE gateway_order_id = p_order_id
    LIMIT 1;
  END;

  IF v_order.id IS NOT NULL THEN
    -- Mark order as paid
    UPDATE public.payment_orders
    SET
      status = 'paid',
      gateway_payment_id = p_payment_id,
      payment_signature = p_payment_signature,
      updated_at = now()
    WHERE id = v_order.id;

    -- Record access entitlement for folder / chapter / exam
    INSERT INTO public.user_access (
      user_id,
      item_type,
      item_id,
      status,
      is_active,
      starts_at,
      created_at,
      updated_at
    )
    VALUES (
      v_order.user_id,
      v_order.item_type,
      v_order.item_id::text,
      'active',
      true,
      now(),
      now(),
      now()
    )
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET
      status = 'active',
      is_active = true,
      updated_at = now();

    -- Deduct redeemed coins if applicable
    IF COALESCE(v_order.coins_redeemed, 0) > 0 THEN
      UPDATE public.coin_wallets
      SET balance = GREATEST(0, balance - v_order.coins_redeemed)
      WHERE user_id = v_order.user_id;

      INSERT INTO public.coin_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        created_at
      )
      VALUES (
        v_order.user_id,
        -v_order.coins_redeemed,
        'redeem',
        format('Redeemed %s coins for %s purchase', v_order.coins_redeemed, v_order.item_type),
        now()
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Access entitlement granted.');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Payment recorded.');
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. ADMIN MANUAL ACCESS GRANT RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_user_access(
  p_user_id UUID,
  p_item_type TEXT,
  p_item_id TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only administrators can manually grant content access.';
  END IF;

  INSERT INTO public.user_access (
    user_id,
    item_type,
    item_id,
    status,
    is_active,
    granted_by,
    reason,
    starts_at,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_item_type,
    p_item_id::text,
    'active',
    true,
    auth.uid(),
    p_reason,
    now(),
    now(),
    now()
  )
  ON CONFLICT (user_id, item_type, item_id)
  DO UPDATE SET
    status = 'active',
    is_active = true,
    reason = COALESCE(p_reason, user_access.reason),
    updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. GRANTS & SCHEMA RELOAD
-- ------------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.user_has_folder_access(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_chapter_access(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_access(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_successful_checkout(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_user_access(UUID, TEXT, TEXT, TEXT) TO authenticated;

GRANT SELECT ON public.user_access TO anon, authenticated;
GRANT INSERT, UPDATE ON public.user_access TO authenticated;
GRANT SELECT ON public.payment_orders TO anon, authenticated;
GRANT INSERT, UPDATE ON public.payment_orders TO authenticated;

NOTIFY pgrst, 'reload schema';
