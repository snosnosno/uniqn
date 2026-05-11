-- job_posting_collaborators 자체 RLS — Phase 1.3
-- 플랜: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Task 1.3)
--
-- SELECT: collaborator 본인 OR workspace 멤버
-- INSERT: workspace owner 만 (D6 MVP)
-- DELETE: workspace owner OR 본인 (자기 발 빼기)
-- UPDATE: 정책 없음 — 행 immutable, 변경 시 DELETE + INSERT
--
-- 메모리 학습: pitfall_rls_with_check_self_select_recursion — WITH CHECK 자기 self-SELECT 피함

-- SELECT: collaborator 본인
CREATE POLICY "jpc_select_self"
  ON public.job_posting_collaborators FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- SELECT: workspace 멤버 (owner OR editor)
CREATE POLICY "jpc_select_ws_member"
  ON public.job_posting_collaborators FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND public.is_workspace_member(jp.workspace_id, (SELECT auth.uid()))
    )
  );

-- INSERT: workspace owner 만 (D6 MVP)
CREATE POLICY "jpc_insert_ws_owner"
  ON public.job_posting_collaborators FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.job_postings jp
      JOIN public.workspaces w ON w.id = jp.workspace_id
      WHERE jp.id = job_posting_id
        AND w.owner_id = (SELECT auth.uid())
    )
    AND added_by = (SELECT auth.uid())                          -- 본인이 추가했다고만 기록 가능
  );

-- DELETE: workspace owner 가 제거 OR 본인 나가기 (단일 정책 OR)
CREATE POLICY "jpc_delete_owner_or_self"
  ON public.job_posting_collaborators FOR DELETE
  USING (
    user_id = (SELECT auth.uid())                               -- 본인 나가기
    OR EXISTS(
      SELECT 1 FROM public.job_postings jp
      JOIN public.workspaces w ON w.id = jp.workspace_id
      WHERE jp.id = job_posting_id
        AND w.owner_id = (SELECT auth.uid())                    -- workspace owner 가 제거
    )
  );
