-- ==============================================================================
-- Zyvra Migration: Allow students to update mobile and avatar, and support checkout coupons
-- Timestamp: 20261118120000
-- ==============================================================================

-- 1. Extend column-level update privileges for profiles so users can update their
-- full name, mobile number, avatar URL, and target exams safely.
GRANT UPDATE (full_name, mobile, avatar_url, target_exams, daily_goal_target, theme)
  ON public.profiles TO authenticated;

-- 2. Add coupon_code and coupon_discount columns to payment_orders if not present
ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric DEFAULT 0;
