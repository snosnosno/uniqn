-- =============================================================================
-- Migration: RLS 성능 최적화 + FK 인덱스 추가
--
-- Supabase Performance Advisor 지적 사항 수정 (2026-04-16):
-- 1. auth_rls_initplan WARN: auth.uid()/auth.jwt() 호출을 (select ...) 로 래핑
--    → row마다 재평가되던 것을 쿼리당 1회 평가로 최적화
-- 2. multiple_permissive_policies WARN: SELECT 정책 2개 → OR 조건 1개로 통합
-- 3. unindexed_foreign_keys INFO: reviewed_by, supersedes_id FK 인덱스 추가
-- =============================================================================

-- =============================================================================
-- employer_applications RLS 정책 재작성
-- =============================================================================

DROP POLICY IF EXISTS "employer_applications_select_own"   ON public.employer_applications;
DROP POLICY IF EXISTS "employer_applications_admin_select" ON public.employer_applications;

-- 두 정책을 OR 조건 1개로 통합 + (select ...) 래핑으로 initplan 방지
CREATE POLICY "employer_applications_select"
  ON public.employer_applications
  FOR SELECT
  USING (
    (select auth.uid()) = user_id
    OR (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

-- =============================================================================
-- fcm_tokens RLS 정책 재작성
-- =============================================================================

DROP POLICY IF EXISTS "fcm_tokens_select_own"   ON public.fcm_tokens;
DROP POLICY IF EXISTS "fcm_tokens_admin_select" ON public.fcm_tokens;
DROP POLICY IF EXISTS "fcm_tokens_insert_own"   ON public.fcm_tokens;
DROP POLICY IF EXISTS "fcm_tokens_update_own"   ON public.fcm_tokens;
DROP POLICY IF EXISTS "fcm_tokens_delete_own"   ON public.fcm_tokens;

-- SELECT: own + admin 통합
CREATE POLICY "fcm_tokens_select"
  ON public.fcm_tokens
  FOR SELECT
  USING (
    (select auth.uid()) = user_id
    OR (select (auth.jwt() -> 'app_metadata' ->> 'role')) = 'admin'
  );

-- INSERT: (select auth.uid()) 래핑
CREATE POLICY "fcm_tokens_insert_own"
  ON public.fcm_tokens
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE: (select auth.uid()) 래핑
CREATE POLICY "fcm_tokens_update_own"
  ON public.fcm_tokens
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- DELETE: (select auth.uid()) 래핑
CREATE POLICY "fcm_tokens_delete_own"
  ON public.fcm_tokens
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- =============================================================================
-- employer_applications FK 인덱스 추가 (unindexed_foreign_keys INFO)
-- =============================================================================

-- reviewed_by → users(id) FK 커버 인덱스
CREATE INDEX IF NOT EXISTS idx_employer_applications_reviewed_by
  ON public.employer_applications(reviewed_by);

-- supersedes_id → employer_applications(id) FK 커버 인덱스
CREATE INDEX IF NOT EXISTS idx_employer_applications_supersedes_id
  ON public.employer_applications(supersedes_id);
