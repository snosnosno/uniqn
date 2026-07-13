-- Phase 3C — event_qr_codes RLS 워크스페이스 멤버 분기
--
-- editor 가 공유 공고의 출퇴근 QR 코드를 SELECT / UPDATE / DELETE 할 수 있도록
-- 정책에 is_workspace_member 분기 추가. 기존 user_id / owner 분기 보존.
--
-- INSERT 정책 (qr_insert) 은 의도적으로 변경 안 함 — QR 코드 생성은 owner 본인의
-- 책임으로 유지 (editor 가 공유 공고 출퇴근 관리 시 owner 가 미리 생성한 코드를
-- 사용). 향후 editor 도 INSERT 필요 시 별도 migration 으로 확장.
--
-- DOWN script (rollback) — 별도 migration 으로 적용:
-- DROP POLICY IF EXISTS qr_select ON public.event_qr_codes;
-- CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT TO public
--   USING (
--     user_id = (SELECT auth.uid())
--     OR (job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = (SELECT auth.uid())))
--     OR ((SELECT get_my_role()) = 'admin')
--   );
-- DROP POLICY IF EXISTS qr_update ON public.event_qr_codes;
-- CREATE POLICY qr_update ON public.event_qr_codes FOR UPDATE TO public
--   USING ((SELECT auth.uid()) = user_id);
-- DROP POLICY IF EXISTS qr_delete ON public.event_qr_codes;
-- CREATE POLICY qr_delete ON public.event_qr_codes FOR DELETE TO public
--   USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS qr_select ON public.event_qr_codes;
CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT TO public
  USING (
    user_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );

DROP POLICY IF EXISTS qr_update ON public.event_qr_codes;
CREATE POLICY qr_update ON public.event_qr_codes FOR UPDATE TO public
  USING (
    user_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );

DROP POLICY IF EXISTS qr_delete ON public.event_qr_codes;
CREATE POLICY qr_delete ON public.event_qr_codes FOR DELETE TO public
  USING (
    user_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );
