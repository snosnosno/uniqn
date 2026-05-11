-- Performance advisor 권고 반영 — Phase 10
-- 1. multiple_permissive_policies: jpc SELECT 2개 → 단일 OR 정책으로 통합
-- 2. unindexed_foreign_keys: job_posting_collaborators.added_by 에 인덱스 추가
--
-- 참조: docs/superpowers/plans/2026-05-11-job-posting-collaborators.md (Phase 10)
-- Supabase advisor: 0006_multiple_permissive_policies, 0001_unindexed_foreign_keys

-- ============================================================================
-- 1. SELECT 정책 통합 (jpc_select_self OR jpc_select_ws_member)
-- ============================================================================
DROP POLICY IF EXISTS "jpc_select_self"      ON public.job_posting_collaborators;
DROP POLICY IF EXISTS "jpc_select_ws_member" ON public.job_posting_collaborators;

CREATE POLICY "jpc_select"
  ON public.job_posting_collaborators FOR SELECT
  USING (
    user_id = (SELECT auth.uid())                                         -- collaborator 본인
    OR EXISTS(                                                            -- workspace 멤버 (owner OR editor)
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND public.is_workspace_member(jp.workspace_id, (SELECT auth.uid()))
    )
  );

-- ============================================================================
-- 2. added_by FK 인덱스 추가
-- ============================================================================
CREATE INDEX idx_jpc_added_by ON public.job_posting_collaborators(added_by);
