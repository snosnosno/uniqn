-- create_workspace RPC
-- Root cause fix: client JWT app_metadata.role 이 stale 일 때 workspaces_insert_employer_with_cap
-- WITH CHECK 가 fail 하여 첫 워크스페이스 생성 차단. SECURITY DEFINER 로 public.users.role 을
-- DB-of-record 로 사용하여 JWT 의존성 제거.
--
-- 호환: 기존 RLS workspaces_insert_employer_with_cap 는 그대로 유지 (defense-in-depth).
--       SECURITY DEFINER 가 RLS 를 우회하므로 클라이언트는 항상 RPC 경유.
--
-- 에러 코드 (RAISE EXCEPTION):
--   AUTH_REQUIRED         — auth.uid() null
--   PERMISSION_DENIED     — public.users.role 이 employer/admin 아님 (또는 비활성)
--   VALIDATION_REQUIRED   — name null/빈 문자열
--   WORKSPACE_CAP_REACHED — owner 가 이미 10 개 워크스페이스 보유

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

  -- DB-of-record (public.users.role) 조회 — JWT staleness 우회
  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS NULL OR v_role NOT IN ('employer', 'admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- cap (10) — workspace_count_for_owner 동일 로직 (RLS 정책과 동기화)
  SELECT count(*)::int INTO v_count
  FROM public.workspaces
  WHERE owner_id = v_uid;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'WORKSPACE_CAP_REACHED';
  END IF;

  -- INSERT (CHECK constraint workspaces_name_length 가 1~50 자 강제)
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (p_name, v_uid)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_workspace(TEXT) IS
  '워크스페이스 생성 RPC. SECURITY DEFINER + public.users.role 조회로 JWT staleness (Edge Function 사후 setRole + refreshSession 누락) 우회. 2026-05-09 root cause fix.';
