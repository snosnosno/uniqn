-- list_my_workspaces: 아카이브된 워크스페이스 제외 + archived_at 컬럼 반환
-- RETURNS TABLE 시그니처 변경 → DROP 후 재생성
DROP FUNCTION IF EXISTS public.list_my_workspaces();

CREATE FUNCTION public.list_my_workspaces()
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  member_count int,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz
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
    w.updated_at,
    w.archived_at
  FROM public.workspaces w
  WHERE
    w.archived_at IS NULL
    AND (
      w.owner_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = w.id AND wm.user_id = v_uid
      )
    )
  ORDER BY w.created_at ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_my_workspaces() TO authenticated;

COMMENT ON FUNCTION public.list_my_workspaces() IS
  '현재 사용자가 owner 또는 명시적 member 인 활성(archived_at IS NULL) 워크스페이스만 반환. 2026-05-24 아카이브 제외 + archived_at 컬럼 추가.';
