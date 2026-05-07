-- 공고 워크스페이스 협업 편집 (M1.5) — RLS 정책 7개
-- D2 owner SoT + A4 cap 10 + Architecture A2 (is_workspace_member SECURITY DEFINER)
-- 기존 jp_update / jp_delete RLS와 함께 OR로 결합 (additive — 기존 owner 권한 유지)
-- workspace_members / workspace_invitations 의 INSERT/UPDATE/DELETE는 PR #2 SECURITY DEFINER RPC 전용

-- ========================================
-- workspaces (3 정책)
-- ========================================

-- 1. SELECT — owner이거나 멤버이거나 admin
DROP POLICY IF EXISTS workspaces_select_owner_or_member ON public.workspaces;
CREATE POLICY workspaces_select_owner_or_member
  ON public.workspaces FOR SELECT TO authenticated
  USING (
    public.is_workspace_member(id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- 2. INSERT — employer/admin + 사용자당 최대 10개 cap (Architecture A4)
--   본인이 owner_id 인 경우만, employer/admin 역할만, cap 미도달
DROP POLICY IF EXISTS workspaces_insert_employer_with_cap ON public.workspaces;
CREATE POLICY workspaces_insert_employer_with_cap
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND (SELECT public.get_my_role()) = ANY (ARRAY['employer','admin'])
    AND (SELECT count(*) FROM public.workspaces WHERE owner_id = (SELECT auth.uid())) < 10
  );

-- 3. UPDATE — owner만 (이름 변경 등)
DROP POLICY IF EXISTS workspaces_update_owner ON public.workspaces;
CREATE POLICY workspaces_update_owner
  ON public.workspaces FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- (DELETE 정책 없음 — 워크스페이스 삭제는 Phase 2 deferred)

-- ========================================
-- workspace_members (1 정책 — SELECT만)
-- ========================================
-- INSERT/UPDATE/DELETE는 SECURITY DEFINER RPC 전용 (PR #2)

-- 4. SELECT — 본인 row OR 같은 워크스페이스 멤버 (멤버 목록 화면)
DROP POLICY IF EXISTS workspace_members_select_self_or_workspace ON public.workspace_members;
CREATE POLICY workspace_members_select_self_or_workspace
  ON public.workspace_members FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- ========================================
-- workspace_invitations (1 정책 — SELECT만)
-- ========================================
-- INSERT/UPDATE/DELETE는 SECURITY DEFINER RPC 전용 (PR #2 invite/accept/reject/revoke)

-- 5. SELECT — 본인이 받은 초대 OR 본인이 owner인 워크스페이스 초대
DROP POLICY IF EXISTS workspace_invitations_select_relevant ON public.workspace_invitations;
CREATE POLICY workspace_invitations_select_relevant
  ON public.workspace_invitations FOR SELECT TO authenticated
  USING (
    invitee_user_id = (SELECT auth.uid())
    OR workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_admin())
  );

-- ========================================
-- job_postings (2 정책 추가 — 기존 jp_update/jp_delete 와 OR 결합)
-- ========================================
-- 기존 jp_update: owner_id = auth.uid() OR admin
-- 기존 jp_delete: admin only
-- 본 마이그레이션은 위 둘에 워크스페이스 멤버 / 워크스페이스 owner 경로 추가
-- PR #5 owner_id → created_by rename 시 기존 정책 정리 예정

-- 6. UPDATE — 워크스페이스 멤버 (owner OR editor)
DROP POLICY IF EXISTS jp_update_workspace_member ON public.job_postings;
CREATE POLICY jp_update_workspace_member
  ON public.job_postings FOR UPDATE TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND public.is_workspace_member(workspace_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.is_workspace_member(workspace_id, (SELECT auth.uid()))
  );

-- 7. DELETE — 워크스페이스 owner만 (editor는 삭제 불가)
DROP POLICY IF EXISTS jp_delete_workspace_owner ON public.job_postings;
CREATE POLICY jp_delete_workspace_owner
  ON public.job_postings FOR DELETE TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = (SELECT auth.uid())
    )
  );
