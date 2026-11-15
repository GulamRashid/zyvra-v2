-- ==============================================================================
-- DYNAMIC PROMOTIONAL BANNERS, QUESTION OF THE DAY (QotD), AND ASSET STORAGE
-- ==============================================================================

-- 1. Create promotional_banners table
CREATE TABLE IF NOT EXISTS public.promotional_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_text TEXT DEFAULT 'NEW',
  title TEXT NOT NULL,
  subtitle TEXT,
  cta_text TEXT DEFAULT 'Explore Now',
  cta_link TEXT NOT NULL DEFAULT '/explore',
  banner_mode TEXT NOT NULL DEFAULT 'card',
  show_text_overlay BOOLEAN NOT NULL DEFAULT true,
  graphic_type TEXT DEFAULT 'custom',
  preset_icon TEXT DEFAULT 'target',
  custom_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure banner_mode & show_text_overlay exist if table was previously created
ALTER TABLE public.promotional_banners
  ADD COLUMN IF NOT EXISTS banner_mode TEXT NOT NULL DEFAULT 'card';
ALTER TABLE public.promotional_banners
  ADD COLUMN IF NOT EXISTS show_text_overlay BOOLEAN NOT NULL DEFAULT true;

-- Index for ordering active banners
CREATE INDEX IF NOT EXISTS idx_promotional_banners_active_order
ON public.promotional_banners (is_active, display_order ASC, created_at DESC);

-- Enable RLS
ALTER TABLE public.promotional_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public and authenticated can view active banners" ON public.promotional_banners;
CREATE POLICY "Public and authenticated can view active banners"
ON public.promotional_banners FOR SELECT
USING (is_active = true OR public.is_admin_user());

DROP POLICY IF EXISTS "Admins have full access to banners" ON public.promotional_banners;
CREATE POLICY "Admins have full access to banners"
ON public.promotional_banners FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());


-- 2. Create daily_challenges table
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date DATE UNIQUE NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  reward_coins INTEGER NOT NULL DEFAULT 10 CHECK (reward_coins >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_target_date
ON public.daily_challenges (target_date);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view daily challenges" ON public.daily_challenges;
CREATE POLICY "Authenticated can view daily challenges"
ON public.daily_challenges FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins have full access to daily challenges" ON public.daily_challenges;
CREATE POLICY "Admins have full access to daily challenges"
ON public.daily_challenges FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());


-- 3. Create daily_challenge_attempts table
CREATE TABLE IF NOT EXISTS public.daily_challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  coins_awarded INTEGER NOT NULL DEFAULT 0 CHECK (coins_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_challenge_attempts_user_unique UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_challenge_attempts_user
ON public.daily_challenge_attempts (user_id, challenge_id);

ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own daily challenge attempts" ON public.daily_challenge_attempts;
CREATE POLICY "Users can view own daily challenge attempts"
ON public.daily_challenge_attempts FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user());

-- No direct client writes to daily_challenge_attempts (must use secure RPC)
REVOKE INSERT, UPDATE, DELETE ON public.daily_challenge_attempts FROM public, authenticated;


-- 4. Extend folders and exams for custom icon URLs
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS icon_url TEXT;


-- 5. RPC: get_today_daily_challenge()
-- Securely retrieves today's challenge without exposing correct_answer/explanation unless attempted.
CREATE OR REPLACE FUNCTION public.get_today_daily_challenge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_challenge record;
  v_question record;
  v_attempt record;
  v_attempted boolean := false;
BEGIN
  v_user_id := auth.uid();

  -- Fetch today's challenge
  SELECT c.id, c.target_date, c.reward_coins, c.question_id
  INTO v_challenge
  FROM public.daily_challenges c
  WHERE c.target_date = CURRENT_DATE
  LIMIT 1;

  IF v_challenge.id IS NULL THEN
    RETURN jsonb_build_object('has_challenge', false);
  END IF;

  -- Check if user attempted
  IF v_user_id IS NOT NULL THEN
    SELECT a.id, a.selected_option, a.is_correct, a.coins_awarded, a.created_at
    INTO v_attempt
    FROM public.daily_challenge_attempts a
    WHERE a.challenge_id = v_challenge.id AND a.user_id = v_user_id;

    IF v_attempt.id IS NOT NULL THEN
      v_attempted := true;
    END IF;
  END IF;

  -- Fetch question details
  SELECT q.id, q.question_text, q.question_text_hi, q.options, q.subject, q.topic,
         q.correct_answer, q.explanation, q.distractor_notes
  INTO v_question
  FROM public.questions q
  WHERE q.id = v_challenge.question_id;

  IF v_question.id IS NULL THEN
    RETURN jsonb_build_object('has_challenge', false, 'error', 'Question not found');
  END IF;

  -- If user has attempted, return full solution details; otherwise protect answers
  RETURN jsonb_build_object(
    'has_challenge', true,
    'challenge_id', v_challenge.id,
    'target_date', v_challenge.target_date,
    'reward_coins', v_challenge.reward_coins,
    'attempted', v_attempted,
    'attempt', CASE
      WHEN v_attempted THEN jsonb_build_object(
        'selected_option', v_attempt.selected_option,
        'is_correct', v_attempt.is_correct,
        'coins_awarded', v_attempt.coins_awarded,
        'attempted_at', v_attempt.created_at
      )
      ELSE NULL
    END,
    'question', jsonb_build_object(
      'id', v_question.id,
      'question_text', v_question.question_text,
      'question_text_hi', v_question.question_text_hi,
      'options', v_question.options,
      'subject', v_question.subject,
      'topic', v_question.topic,
      'correct_answer', CASE WHEN v_attempted OR public.is_admin_user() THEN v_question.correct_answer ELSE NULL END,
      'explanation', CASE WHEN v_attempted OR public.is_admin_user() THEN v_question.explanation ELSE NULL END,
      'distractor_notes', CASE WHEN v_attempted OR public.is_admin_user() THEN v_question.distractor_notes ELSE NULL END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_today_daily_challenge() FROM public;
GRANT EXECUTE ON FUNCTION public.get_today_daily_challenge() TO authenticated;


-- 6. RPC: submit_daily_challenge()
CREATE OR REPLACE FUNCTION public.submit_daily_challenge(
  p_challenge_id UUID,
  p_selected_option TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_challenge record;
  v_question record;
  v_existing_attempt record;
  v_clean_selected text;
  v_clean_correct text;
  v_is_correct boolean;
  v_coins_to_award integer := 0;
BEGIN
  -- 1. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  IF p_challenge_id IS NULL OR p_selected_option IS NULL OR trim(p_selected_option) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid challenge ID or selected option.');
  END IF;

  -- 2. Fetch challenge
  SELECT id, target_date, question_id, reward_coins
  INTO v_challenge
  FROM public.daily_challenges
  WHERE id = p_challenge_id;

  IF v_challenge.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily challenge not found.');
  END IF;

  -- Only allow current or past active challenges (no future dates)
  IF v_challenge.target_date > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'This challenge is not active yet.');
  END IF;

  -- 3. Duplicate attempt check
  SELECT id, selected_option, is_correct, coins_awarded
  INTO v_existing_attempt
  FROM public.daily_challenge_attempts
  WHERE challenge_id = p_challenge_id AND user_id = v_user_id;

  IF v_existing_attempt.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_attempted', true,
      'is_correct', v_existing_attempt.is_correct,
      'coins_awarded', v_existing_attempt.coins_awarded,
      'error', 'You have already attempted this challenge.'
    );
  END IF;

  -- 4. Fetch question
  SELECT id, correct_answer, explanation, distractor_notes
  INTO v_question
  FROM public.questions
  WHERE id = v_challenge.question_id;

  IF v_question.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge question not found in database.');
  END IF;

  -- Normalize answer comparison (uppercase & trimmed)
  v_clean_selected := upper(trim(p_selected_option));
  v_clean_correct := upper(trim(coalesce(v_question.correct_answer, 'A')));
  v_is_correct := (v_clean_selected = v_clean_correct);

  IF v_is_correct THEN
    v_coins_to_award := coalesce(v_challenge.reward_coins, 10);
  ELSE
    v_coins_to_award := 0;
  END IF;

  -- 5. Insert attempt record atomically
  INSERT INTO public.daily_challenge_attempts (
    challenge_id,
    user_id,
    selected_option,
    is_correct,
    coins_awarded,
    created_at
  ) VALUES (
    p_challenge_id,
    v_user_id,
    p_selected_option,
    v_is_correct,
    v_coins_to_award,
    now()
  );

  -- 6. Credit coins to user wallet and log transaction if correct
  IF v_is_correct AND v_coins_to_award > 0 THEN
    INSERT INTO public.coin_wallets (user_id, balance, updated_at)
    VALUES (v_user_id, v_coins_to_award, now())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = coin_wallets.balance + v_coins_to_award,
        updated_at = now();

    INSERT INTO public.coin_ledger (user_id, amount, transaction_type, reason, description, created_at)
    VALUES (
      v_user_id,
      v_coins_to_award,
      'credit',
      'Daily challenge reward',
      'Reward for Question of the Day (' || v_challenge.target_date || ')',
      now()
    );

    INSERT INTO public.coin_transactions (user_id, amount, transaction_type, reason, description, created_at)
    VALUES (
      v_user_id,
      v_coins_to_award,
      'credit',
      'Daily challenge reward',
      'Reward for Question of the Day (' || v_challenge.target_date || ')',
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'correct_option', v_question.correct_answer,
    'explanation', v_question.explanation,
    'distractor_notes', v_question.distractor_notes,
    'coins_awarded', v_coins_to_award
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_daily_challenge(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_daily_challenge(UUID, TEXT) TO authenticated;


-- 7. Supabase Storage bucket for app assets (banners, icons, PDFs)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('app-assets', 'app-assets', true)
  ON CONFLICT (id) DO UPDATE SET public = true;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Storage bucket RLS policies
DO $$
BEGIN
  -- Anyone can view public app-assets
  DROP POLICY IF EXISTS "Public can view app-assets" ON storage.objects;
  CREATE POLICY "Public can view app-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-assets');

  -- Admins can insert/upload
  DROP POLICY IF EXISTS "Admins can upload app-assets" ON storage.objects;
  CREATE POLICY "Admins can upload app-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'app-assets' AND public.is_admin_user());

  -- Admins can update
  DROP POLICY IF EXISTS "Admins can update app-assets" ON storage.objects;
  CREATE POLICY "Admins can update app-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'app-assets' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'app-assets' AND public.is_admin_user());

  -- Admins can delete
  DROP POLICY IF EXISTS "Admins can delete app-assets" ON storage.objects;
  CREATE POLICY "Admins can delete app-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'app-assets' AND public.is_admin_user());
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
