-- =============================================================================
-- Migration: RLS JWT 래핑 패턴 수정
--
-- 20260416170000_fix_rls_performance.sql에서 jwt 래핑 패턴이 잘못되어 수정:
-- 기존: (select (auth.jwt() -> 'app_metadata' ->> 'role'))
-- 수정: (select auth.jwt()) -> 'app_metadata' ->> 'role'
--
-- 결과: Supabase Performance Advisor auth_rls_initplan WARN 완전 해소
-- =============================================================================

DROP POLICY IF EXISTS "employer_applications_select" ON public.employer_applications;
CREATE POLICY "employer_applications_select"
  ON public.employer_applications
  FOR SELECT
  USING (
    (select auth.uid()) = user_id
    OR (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "fcm_tokens_select" ON public.fcm_tokens;
CREATE POLICY "fcm_tokens_select"
  ON public.fcm_tokens
  FOR SELECT
  USING (
    (select auth.uid()) = user_id
    OR (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'admin'
  );
