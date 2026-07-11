-- Phase 3B — work_logs RLS 워크스페이스 멤버 분기
--
-- editor 가 공유 공고의 work_logs 를 SELECT/UPDATE 할 수 있도록 정책에
-- is_workspace_member 분기 추가. 기존 staff_id / owner_id / admin 분기는 보존.
--
-- INSERT/DELETE 정책은 work_logs 에 존재하지 않음 (SECURITY DEFINER trigger 및
-- RPC 가 직접 데이터를 삽입). editor 권한이 영향을 미치지 않음.
--
-- payroll trigger 와의 상호작용:
-- - work_logs UPDATE 시 trigger 가 발동되어 정산 상태를 동기화. owner 가
--   소유한 공고에 한해 수정 권한이 있던 기존 동작을 유지하면서, editor 도
--   동일 권한 범위에서 수정 가능 (정산 흐름 단일성 유지).
--
-- DOWN script (rollback) — 별도 migration 으로 적용:
-- DROP POLICY IF EXISTS wl_select ON public.work_logs;
-- CREATE POLICY wl_select ON public.work_logs FOR SELECT TO public
--   USING (
--     staff_id = (SELECT auth.uid())
--     OR owner_id = (SELECT auth.uid())
--     OR ((SELECT get_my_role()) = 'admin')
--   );
-- DROP POLICY IF EXISTS wl_update ON public.work_logs;
-- CREATE POLICY wl_update ON public.work_logs FOR UPDATE TO public
--   USING (
--     staff_id = (SELECT auth.uid())
--     OR owner_id = (SELECT auth.uid())
--     OR ((SELECT get_my_role()) = 'admin')
--   );

DROP POLICY IF EXISTS wl_select ON public.work_logs;
CREATE POLICY wl_select ON public.work_logs FOR SELECT TO public
  USING (
    staff_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );

DROP POLICY IF EXISTS wl_update ON public.work_logs;
CREATE POLICY wl_update ON public.work_logs FOR UPDATE TO public
  USING (
    staff_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );
