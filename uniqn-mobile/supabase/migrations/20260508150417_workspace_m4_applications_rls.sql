-- Phase 3A — applications RLS 워크스페이스 멤버 분기
--
-- editor 가 공유 공고의 지원자를 SELECT/UPDATE 할 수 있도록 정책에 is_workspace_member
-- 분기 추가. 기존 owner_id / applicant_id / admin 분기는 보존.
--
-- DOWN script (rollback) — 별도 migration 으로 적용:
-- DROP POLICY IF EXISTS app_select ON public.applications;
-- CREATE POLICY app_select ON public.applications FOR SELECT TO public
--   USING (
--     applicant_id = (SELECT auth.uid())
--     OR (job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = (SELECT auth.uid())))
--     OR ((SELECT get_my_role()) = 'admin')
--   );
-- DROP POLICY IF EXISTS app_update ON public.applications;
-- CREATE POLICY app_update ON public.applications FOR UPDATE TO public
--   USING (
--     applicant_id = (SELECT auth.uid())
--     OR (job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = (SELECT auth.uid())))
--     OR ((SELECT get_my_role()) = 'admin')
--   );

DROP POLICY IF EXISTS app_select ON public.applications;
CREATE POLICY app_select ON public.applications FOR SELECT TO public
  USING (
    applicant_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );

DROP POLICY IF EXISTS app_update ON public.applications;
CREATE POLICY app_update ON public.applications FOR UPDATE TO public
  USING (
    applicant_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );
