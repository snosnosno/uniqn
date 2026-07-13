-- cap(10) 집계에서 아카이브된 워크스페이스 제외.
-- 계획 대비 수정: RLS 정책(workspaces_insert_employer_with_cap)을 교체하지 않는다.
--   실제 정책은 cap 을 workspace_count_for_owner(owner_id) < 10 함수로 계산하고
--   role 은 get_my_role() 을 사용하므로, 정책을 건드리지 않고 함수만 패치하는 것이 안전.
-- 1) workspace_count_for_owner 함수 → archived_at IS NULL 만 집계 (RLS 경로 cap 제외)
-- 2) create_workspace RPC inline count → archived_at IS NULL (RPC 경로 cap 제외)

CREATE OR REPLACE FUNCTION public.workspace_count_for_owner(_owner_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_count int;
BEGIN
  -- 아카이브된 워크스페이스 제외 (2026-05-24)
  SELECT count(*)::int INTO v_count
  FROM public.workspaces
  WHERE owner_id = _owner_id AND archived_at IS NULL;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_workspace(p_name TEXT)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid;
  v_role text;
  v_count int;
  v_row public.workspaces%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_REQUIRED';
  END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS NULL OR v_role NOT IN ('employer', 'admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- cap(10) — 아카이브된 워크스페이스 제외 (2026-05-24)
  SELECT count(*)::int INTO v_count
  FROM public.workspaces
  WHERE owner_id = v_uid AND archived_at IS NULL;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'WORKSPACE_CAP_REACHED';
  END IF;

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (p_name, v_uid)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;
