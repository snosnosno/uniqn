-- list_my_workspaces RPC
-- 문제: workspaces_select_owner_or_member RLS 의 `OR is_admin()` 으로 admin role 사용자는
-- 모든 워크스페이스를 SELECT 할 수 있음. WorkspaceSwitcher / "내 워크스페이스" 화면이
-- 이를 그대로 노출 → 비-소유 워크스페이스가 "편집자/공동관리" 로 잘못 표시.
--
-- 해결: 명시적 WHERE 로 owner OR 명시적 member 만 반환. RLS USING 은 그대로 유지하여
-- admin global access 는 다른 컨텍스트 (admin 화면) 에서 보존.

CREATE OR REPLACE FUNCTION public.list_my_workspaces()
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  member_count int,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.owner_id,
    w.member_count,
    w.created_at,
    w.updated_at
  FROM public.workspaces w
  WHERE
    w.owner_id = v_uid
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = w.id AND wm.user_id = v_uid
    )
  ORDER BY w.created_at ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_my_workspaces() TO authenticated;

COMMENT ON FUNCTION public.list_my_workspaces() IS
  '현재 사용자가 owner 또는 명시적 member 인 워크스페이스만 반환. admin global RLS 우회 (Switcher / 내 워크스페이스 UI 용). 2026-05-09.';
