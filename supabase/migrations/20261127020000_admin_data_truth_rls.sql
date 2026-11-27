-- Admin Data Truth RLS Policies
-- Ensure admins can read all coin_ledger, coin_transactions, coin_wallets, and update email_verified on profiles.

DO $$
BEGIN
  -- coin_ledger admin read
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coin_ledger') THEN
    DROP POLICY IF EXISTS "Admins can read all coin ledger" ON public.coin_ledger;
    CREATE POLICY "Admins can read all coin ledger"
      ON public.coin_ledger FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
        )
      );
  END IF;

  -- coin_transactions admin read
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coin_transactions') THEN
    DROP POLICY IF EXISTS "Admins can read all coin transactions" ON public.coin_transactions;
    CREATE POLICY "Admins can read all coin transactions"
      ON public.coin_transactions FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
        )
      );
  END IF;

  -- coin_wallets admin read
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coin_wallets') THEN
    DROP POLICY IF EXISTS "Admins can read all coin wallets" ON public.coin_wallets;
    CREATE POLICY "Admins can read all coin wallets"
      ON public.coin_wallets FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
        )
      );
  END IF;
END $$;
