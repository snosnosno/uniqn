-- 기존 RLS 정책 OR 확장 — Phase 2
-- 플랜: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Task 2.1~2.5)
-- Audit 결과 (commit 37fcc06c7): 5 테이블 12 정책 + workspaces SELECT
--
-- 변경 정책 목록 (audit 확정):
-- - workspaces:    workspaces_select_owner_or_member
-- - job_postings:  jp_select_managed, jp_update_workspace_member
-- - applications:  app_select, app_update
-- - work_logs:     wl_select, wl_update  (정산은 payroll 필드 — 자동 포함)
-- - event_qr_codes: qr_select, qr_update, qr_delete (Spec 누락 보정)

-- ============================================================================
-- 1. workspaces — useSharedJobPostings JOIN 용 (Codex outside-voice fix)
-- ============================================================================
DROP POLICY IF EXISTS "workspaces_select_owner_or_member" ON public.workspaces;
CREATE POLICY "workspaces_select_owner_or_member"
  ON public.workspaces FOR SELECT
  USING (
    public.is_workspace_member(id, (SELECT auth.uid()))
    OR EXISTS(
      SELECT 1 FROM public.job_postings jp
      JOIN public.job_posting_collaborators jpc ON jpc.job_posting_id = jp.id
      WHERE jp.workspace_id = workspaces.id
        AND jpc.user_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_admin())
  );

-- ============================================================================
-- 2. job_postings — jp_select_managed, jp_update_workspace_member
-- ============================================================================
DROP POLICY IF EXISTS "jp_select_managed" ON public.job_postings;
CREATE POLICY "jp_select_managed"
  ON public.job_postings FOR SELECT
  USING (
    (owner_id = (SELECT auth.uid()))
    OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR public.is_posting_collaborator(id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "jp_update_workspace_member" ON public.job_postings;
CREATE POLICY "jp_update_workspace_member"
  ON public.job_postings FOR UPDATE
  USING (
    public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- ============================================================================
-- 3. applications — app_select, app_update
-- ============================================================================
DROP POLICY IF EXISTS "app_select" ON public.applications;
CREATE POLICY "app_select"
  ON public.applications FOR SELECT
  USING (
    (applicant_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );

DROP POLICY IF EXISTS "app_update" ON public.applications;
CREATE POLICY "app_update"
  ON public.applications FOR UPDATE
  USING (
    (applicant_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );

-- ============================================================================
-- 4. work_logs — wl_select, wl_update (정산 payroll 필드 자동 포함)
-- ============================================================================
DROP POLICY IF EXISTS "wl_select" ON public.work_logs;
CREATE POLICY "wl_select"
  ON public.work_logs FOR SELECT
  USING (
    (staff_id = (SELECT auth.uid()))
    OR (owner_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );

DROP POLICY IF EXISTS "wl_update" ON public.work_logs;
CREATE POLICY "wl_update"
  ON public.work_logs FOR UPDATE
  USING (
    (staff_id = (SELECT auth.uid()))
    OR (owner_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );

-- ============================================================================
-- 5. event_qr_codes — qr_select, qr_update, qr_delete (Spec 누락 보정)
-- ============================================================================
DROP POLICY IF EXISTS "qr_select" ON public.event_qr_codes;
CREATE POLICY "qr_select"
  ON public.event_qr_codes FOR SELECT
  USING (
    (user_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );

DROP POLICY IF EXISTS "qr_update" ON public.event_qr_codes;
CREATE POLICY "qr_update"
  ON public.event_qr_codes FOR UPDATE
  USING (
    (user_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );

DROP POLICY IF EXISTS "qr_delete" ON public.event_qr_codes;
CREATE POLICY "qr_delete"
  ON public.event_qr_codes FOR DELETE
  USING (
    (user_id = (SELECT auth.uid()))
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE public.is_workspace_member(workspace_id, (SELECT auth.uid()))
        OR public.is_posting_collaborator(id, (SELECT auth.uid()))
    ))
  );
