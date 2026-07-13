-- public.update_user_role(p_user_id uuid, p_new_role text)
-- 관리자가 사용자 역할을 변경하는 RPC.
-- · admin만 호출 가능 (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
-- · 자기 자신 강등 차단 (본인 id 호출 금지)
-- · 대상 사용자 존재 확인 + FOR UPDATE 락
-- · 이전 역할 반환 → 클라이언트에서 감사 로그로 사용
-- · 역할 변경 시 on_public_user_role_changed 트리거가 app_metadata.role 자동 동기화
--   (20260412082628_sync_user_role_to_app_metadata.sql)

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text;
  v_previous_role text;
  v_new_role public.user_role;
BEGIN
  -- 1. 호출자 admin 검증
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: admin 권한이 필요합니다 (caller role: %)', COALESCE(v_caller_role, 'null');
  END IF;

  -- 2. 자기 자신 역할 변경 차단 (admin 자가강등 방지)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'INVALID_TARGET: 자신의 역할은 변경할 수 없습니다';
  END IF;

  -- 3. 입력 role enum 캐스팅 (잘못된 값이면 invalid_text_representation 에러)
  BEGIN
    v_new_role := p_new_role::public.user_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'INVALID_ROLE: 유효하지 않은 역할 값 (%)', p_new_role;
  END;

  -- 4. 대상 사용자 조회 + 잠금
  SELECT role::text INTO v_previous_role
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: 대상 사용자를 찾을 수 없습니다 (%)', p_user_id;
  END IF;

  -- 5. 동일 역할이면 no-op (트리거 불필요한 JWT 갱신 방지)
  IF v_previous_role = p_new_role THEN
    RETURN jsonb_build_object('previous_role', v_previous_role);
  END IF;

  -- 6. 역할 변경 (on_public_user_role_changed 트리거가 app_metadata 동기화)
  UPDATE public.users
    SET role = v_new_role,
        updated_at = now()
    WHERE id = p_user_id;

  RETURN jsonb_build_object('previous_role', v_previous_role);
END;
$$;

REVOKE ALL ON FUNCTION public.update_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_user_role(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.update_user_role(uuid, text) IS
  '관리자 전용 사용자 역할 변경 RPC. app_metadata.role=admin 필요. 자기 자신 대상 금지. previous_role 반환.';
