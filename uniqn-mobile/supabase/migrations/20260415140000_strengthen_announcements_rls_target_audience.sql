-- ============================================================================
-- T-E1 hotfix (REVIEW-2026-04-15): Announcements RLS target_audience 강제
-- ============================================================================
-- 문제:
--   20260413000001_announcements_rls.sql 의 SELECT 정책이
--   target_audience(jsonb) 필터링을 수행하지 않고
--   `status = 'published' OR admin` 만 검사함.
--   따라서 클라이언트 필터(AnnouncementRepository.ts:145-153) 우회 시
--   role-targeted 공지(예: target_audience.roles = ['employer'])가
--   다른 role(staff)에 노출됨 → Information Disclosure (P0).
--
-- 해결:
--   SELECT 정책을 강화하여 DB 레벨에서 target_audience 매칭을 강제.
--   - admin 은 모든 status/모든 audience 조회 가능
--   - 그 외 사용자는 published + audience 일치 시에만 조회 가능
--     · target_audience IS NULL → 'all' 로 간주 (legacy data 호환)
--     · type = 'all' → 모두 허용
--     · type = 'roles' → roles 배열에 현재 사용자의 app_metadata.role 포함 시에만 허용
--
-- 클라이언트 필터 제거: 동일 PR 내 AnnouncementRepository.ts 변경 동반.
--
-- 참조:
--   - docs/qa/2026-04-14/REVIEW-2026-04-15.md (P0 Finding-1)
--   - docs/qa/2026-04-14/team-e-security-rls.md §4.1
--   - JWT 경로: auth.jwt() -> 'app_metadata' ->> 'role'
-- ============================================================================

DROP POLICY IF EXISTS "announcements_select_published" ON public.announcements;

CREATE POLICY "announcements_select_published"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      status = 'published'
      AND (
        target_audience IS NULL
        OR (target_audience->>'type') = 'all'
        OR (
          (target_audience->>'type') = 'roles'
          AND (target_audience->'roles') ? (auth.jwt() -> 'app_metadata' ->> 'role')
        )
      )
    )
  );

COMMENT ON POLICY "announcements_select_published" ON public.announcements IS
  'admin은 전체 / 그 외 사용자는 status=published + target_audience 매칭만. type=roles 일 때 roles 배열에 사용자 role 포함 필수. (T-E1 hotfix 2026-04-15)';
