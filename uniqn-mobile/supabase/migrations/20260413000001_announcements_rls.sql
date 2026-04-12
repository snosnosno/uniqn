-- ============================================================================
-- Announcements 테이블 RLS 정책
-- ============================================================================
-- 문제: announcements 테이블에 RLS가 없어 클라이언트 사이드 필터링에만 의존
-- 참고: app role은 raw_app_meta_data.role에 저장됨
--      (migration 20260412082628_sync_user_role_to_app_metadata.sql 참조)
--      JWT에서는 (auth.jwt() -> 'app_metadata' ->> 'role')로 접근

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자: published 상태 공지 읽기 가능
-- admin: 모든 status 읽기 가능
CREATE POLICY "announcements_select_published"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- admin만 INSERT
CREATE POLICY "announcements_insert_admin"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- admin만 UPDATE
CREATE POLICY "announcements_update_admin"
  ON public.announcements FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- admin만 DELETE
CREATE POLICY "announcements_delete_admin"
  ON public.announcements FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
