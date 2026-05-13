-- C2 fix — workspaces_select_owner_or_member 의 JPC JOIN 분기를
-- SECURITY DEFINER 함수로 격리하여 PostgreSQL RLS cycle 가드 회피 (42P17).
--
-- Root cause:
--   본 정책 USING 안의 `EXISTS(SELECT FROM job_postings jp JOIN jpc ...)` 가
--   workspaces SELECT 평가 도중 job_postings SELECT 정책 평가를 재진입시켜
--   PostgreSQL cycle 가드(42P17) 트리거.
-- 직접 발현:
--   job_postings DELETE 시 jp_delete_workspace_owner USING 안의
--   `SELECT FROM workspaces WHERE owner_id = uid` 가 entry point.
--
-- 참고:
--   pitfall_rls_with_check_self_select_recursion — plpgsql SECURITY DEFINER 필수
--   pitfall_rls_jpc_recursion_widespread — workspaces SELECT JPC JOIN cycle source
--   feedback_staging_dryrun_ddl_only_insufficient — 함수 호출 검증 포함
--   feedback_supabase_migration_workflow — MCP apply_migration 전용
--
-- Plan: docs/superpowers/plans/2026-05-12-c2-rls-jp-delete-recursion-fix.md

-- ── 1. is_workspace_jpc_member 헬퍼 ────────────────────────────
-- plpgsql 선택 이유: SQL 함수는 inline 가능성이 있어 SECURITY DEFINER 가
-- 무효화될 수 있다 (PostgreSQL 버전 의존). plpgsql 은 절대 inline 안 됨.
CREATE OR REPLACE FUNCTION public.is_workspace_jpc_member(
  _workspace_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.job_postings jp
    JOIN public.job_posting_collaborators jpc
      ON jpc.job_posting_id = jp.id
    WHERE jp.workspace_id = _workspace_id
      AND jpc.user_id = _user_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.is_workspace_jpc_member(uuid, uuid) IS
  'workspaces SELECT RLS 의 JPC JOIN 분기를 SECURITY DEFINER 로 격리. '
  'PostgreSQL RLS cycle 가드 회피 (42P17). C2 fix.';

REVOKE EXECUTE ON FUNCTION public.is_workspace_jpc_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_workspace_jpc_member(uuid, uuid) TO authenticated;

-- ── 2. workspaces_select_owner_or_member 재정의 ──────────────
-- inline JPC JOIN 분기를 새 SECURITY DEFINER 함수 호출로 교체.
-- boolean OR 구조는 동일하게 유지하여 동작 의미 보존.
DROP POLICY IF EXISTS "workspaces_select_owner_or_member" ON public.workspaces;
CREATE POLICY "workspaces_select_owner_or_member"
  ON public.workspaces FOR SELECT
  USING (
    public.is_workspace_member(id, (SELECT auth.uid()))
    OR public.is_workspace_jpc_member(id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- ── 3. (no-op) jp_delete_workspace_owner / jpc_insert_ws_owner / jpc_delete_owner_or_self
-- 손대지 않음. workspaces SELECT 가 cycle-free 가 되면 자동 해소 (plan §3.2 매트릭스).
