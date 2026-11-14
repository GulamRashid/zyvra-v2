-- Migration: Dedicated service-role RPC to attach Razorpay gateway order ID
-- Encapsulates payment_orders mutation within an authoritative SECURITY DEFINER RPC,
-- avoiding direct PostgREST table updates while preserving strict table-level ACL lockdowns.

CREATE OR REPLACE FUNCTION public.attach_checkout_gateway_order(
  p_order_id UUID,
  p_gateway_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_clean_gateway_id TEXT := btrim(coalesce(p_gateway_order_id, ''));
  v_order public.payment_orders%ROWTYPE;
BEGIN
  -- Strict caller verification: service_role only
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Validate gateway order format (Razorpay order prefix and characters)
  IF v_clean_gateway_id = '' OR NOT (v_clean_gateway_id ~ '^order_[A-Za-z0-9_-]+$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid gateway order identifier format.'
    );
  END IF;

  -- Lock and fetch matching internal order
  SELECT *
  INTO v_order
  FROM public.payment_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment order not found.'
    );
  END IF;

  -- Only allow attachment for orders currently in 'created' status
  IF lower(coalesce(v_order.status, '')) <> 'created' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot attach gateway order to order with status %s.', coalesce(v_order.status, 'unknown'))
    );
  END IF;

  -- Check existing gateway order ID: if already attached with the same ID, treat as idempotent success
  IF nullif(btrim(coalesce(v_order.razorpay_order_id, '')), '') IS NOT NULL
     OR nullif(btrim(coalesce(v_order.gateway_order_id, '')), '') IS NOT NULL THEN
    IF coalesce(v_order.razorpay_order_id, v_order.gateway_order_id) = v_clean_gateway_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_attached', true,
        'order_id', v_order.id,
        'gateway_order_id', v_clean_gateway_id
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Order is already associated with a different gateway order ID.'
      );
    END IF;
  END IF;

  -- Ensure this gateway order ID is not already bound to another internal order
  IF EXISTS (
    SELECT 1
    FROM public.payment_orders
    WHERE id <> p_order_id
      AND (
        razorpay_order_id = v_clean_gateway_id
        OR gateway_order_id = v_clean_gateway_id
      )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Gateway order ID is already bound to another payment order.'
    );
  END IF;

  -- Perform the privileged atomic update
  UPDATE public.payment_orders
  SET razorpay_order_id = v_clean_gateway_id,
      gateway_order_id = v_clean_gateway_id,
      updated_at = pg_catalog.now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'gateway_order_id', v_clean_gateway_id
  );
END;
$$;

-- Enforce function ownership and strict access permissions
ALTER FUNCTION public.attach_checkout_gateway_order(UUID, TEXT) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.attach_checkout_gateway_order(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_checkout_gateway_order(UUID, TEXT) TO service_role;
