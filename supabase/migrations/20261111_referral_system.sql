-- Migration: Referral system & Platform Settings (referrals table, referral_code on profiles, platform_settings)

-- 1. Ensure platform_settings table exists
CREATE TABLE IF NOT EXISTS public.platform_settings (
  setting_key TEXT PRIMARY KEY,
  key TEXT,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Ensure both key and setting_key columns exist alongside value and updated_at
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS setting_key TEXT;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS value JSONB;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Sync existing values so key is populated from setting_key
UPDATE public.platform_settings SET key = setting_key WHERE key IS NULL AND setting_key IS NOT NULL;

-- Safe block: Add unique constraint on platform_settings(key) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_key_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE c.relname = 'platform_settings' AND a.attname = 'key' AND (i.indisunique OR i.indisprimary)
  ) THEN
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);
  END IF;
END $$;

-- 2. Add referral_code column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Safe block: Add unique constraint on profiles(referral_code) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_referral_code_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
    WHERE c.relname = 'profiles' AND a.attname = 'referral_code' AND (i.indisunique OR i.indisprimary)
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_unique UNIQUE (referral_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);

-- 3. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  referrer_coins_awarded INTEGER NOT NULL DEFAULT 50,
  referred_coins_awarded INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals(referred_id);

-- 4. Enable RLS and configure policies
-- platform_settings RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- referrals RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own referrals" ON public.referrals;
CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;
CREATE POLICY "Admins can view all referrals"
  ON public.referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert referrals" ON public.referrals;
CREATE POLICY "Authenticated users can insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referred_id OR auth.uid() = referrer_id);

-- 5. Seed default platform settings with ON CONFLICT (setting_key) DO UPDATE
INSERT INTO public.platform_settings (setting_key, key, value)
VALUES 
  ('referral_program_config', 'referral_program_config', '{"referral_enabled": true, "referrer_reward_coins": 50, "referred_reward_coins": 20}'::jsonb),
  ('referral_enabled', 'referral_enabled', 'true'::jsonb),
  ('referrer_reward_coins', 'referrer_reward_coins', '50'::jsonb),
  ('referred_reward_coins', 'referred_reward_coins', '20'::jsonb)
ON CONFLICT (setting_key) DO UPDATE
SET value = EXCLUDED.value, key = EXCLUDED.key, updated_at = now();


