-- Perf: wrap auth.jwt() in (select ...) so RLS evaluates it once per query (initplan)
-- instead of once per row. Semantics unchanged. Supabase advisor lint 0003_auth_rls_initplan.
--
-- Flagged policies (auth.jwt() re-evaluated per row):
--   - public.wallet_ledger.ledger_admin_select (USING)
--   - public.wallets.wallet_admin_all (USING + WITH CHECK)
-- The *_self_select policies already use (select auth.uid()) and are not affected.

alter policy ledger_admin_select on public.wallet_ledger
  using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);

alter policy wallet_admin_all on public.wallets
  using ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
  with check ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text);
