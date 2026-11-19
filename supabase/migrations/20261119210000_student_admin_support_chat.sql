-- Migration: 20261119210000_student_admin_support_chat.sql
-- Real-time Support Chat between Students and Admin

CREATE TABLE IF NOT EXISTS public.support_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  last_message TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unread_admin_count INTEGER NOT NULL DEFAULT 0,
  unread_user_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_threads_user_id_key'
  ) THEN
    ALTER TABLE public.support_threads ADD CONSTRAINT support_threads_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL DEFAULT 'user',
  sender_name TEXT,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread_id ON public.support_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_support_threads_updated_at ON public.support_threads(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

-- RLS policies for support_threads
DROP POLICY IF EXISTS "Users and admins can view support threads" ON public.support_threads;
CREATE POLICY "Users and admins can view support threads" ON public.support_threads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Users and admins can insert support threads" ON public.support_threads;
CREATE POLICY "Users and admins can insert support threads" ON public.support_threads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

DROP POLICY IF EXISTS "Users and admins can update support threads" ON public.support_threads;
CREATE POLICY "Users and admins can update support threads" ON public.support_threads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user())
  WITH CHECK (user_id = auth.uid() OR public.is_admin_user());

-- RLS policies for support_messages
DROP POLICY IF EXISTS "Users and admins can view support messages" ON public.support_messages;
CREATE POLICY "Users and admins can view support messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user() OR
    EXISTS (
      SELECT 1 FROM public.support_threads
      WHERE support_threads.id = support_messages.thread_id AND support_threads.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users and admins can insert support messages" ON public.support_messages;
CREATE POLICY "Users and admins can insert support messages" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user() OR
    (
      sender_role = 'user' AND
      EXISTS (
        SELECT 1 FROM public.support_threads
        WHERE support_threads.id = support_messages.thread_id AND support_threads.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Admins can update support messages" ON public.support_messages;
CREATE POLICY "Admins can update support messages" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin_user());

-- Add to Realtime Publication if supported
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
