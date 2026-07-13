-- 공고 워크스페이스 협업 편집 (PR #5 — M3 RLS 정리)
-- workspace_id NOT NULL 이 된 후, 기존 owner_id 기반 jp_update / jp_delete 가 redundant.
-- workspace 정책에 admin 분기 추가 → 단일 정책으로 통합.
-- supabase advisors 0006 multiple_permissive_policies WARN 해소.

-- ============================================================
-- 1. UPDATE 정책 통합 — workspace member OR admin
-- ============================================================
DROP POLICY IF EXISTS jp_update ON public.job_postings;
DROP POLICY IF EXISTS jp_update_workspace_member ON public.job_postings;

CREATE POLICY jp_update_workspace_member
  ON public.job_postings FOR UPDATE TO authenticated
  USING (
    public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- ============================================================
-- 2. DELETE 정책 통합 — workspace owner OR admin
-- ============================================================
DROP POLICY IF EXISTS jp_delete ON public.job_postings;
DROP POLICY IF EXISTS jp_delete_workspace_owner ON public.job_postings;

CREATE POLICY jp_delete_workspace_owner
  ON public.job_postings FOR DELETE TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_admin())
  );

-- jp_select 는 owner_id 참조를 그대로 유지 (M4 RENAME 후속 PR 에서 정리).
-- jp_insert 는 변경 없음 (employer/admin role 체크).
