-- =============================================================================
-- update_user_role: 관리자 role 직접 변경 시 대상 유저 알림 발송
-- =============================================================================
-- 배경: 관리자가 update_user_role RPC로 role을 변경해도 대상 유저에게 아무 신호가
--   가지 않아, 대상 기기의 JWT(app_metadata.role)·프로필 캐시가 최대 1시간 stale로
--   남는다(PR#322 구인자 승인 경로와 동일 계열 결함). 구인자 승인은
--   employer_applications 트리거가 알림을 쏘지만, 관리자 직접 변경 경로에는
--   관찰 가능한 상태 변화 자체가 없었다.
-- 해결: role이 실제로 변경된 경우에만 대상 유저에게 role_changed 알림을 INSERT.
--   클라이언트는 푸시 수신/탭 시 maybeRefreshProfileForNotification →
--   authStore.refreshProfile()(세션 재발급+프로필 재조회)로 즉시 동기화한다.
-- 주의: no-op(동일 role)·실패 경로에서는 알림을 발송하지 않는다.
--   CREATE OR REPLACE는 기존 ACL(anon REVOKE 상태)·owner를 보존한다.

CREATE OR REPLACE FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
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

  -- 5. 동일 역할이면 no-op (트리거 불필요한 JWT 갱신·알림 방지)
  IF v_previous_role = p_new_role THEN
    RETURN jsonb_build_object('previous_role', v_previous_role);
  END IF;

  -- 6. 역할 변경 (on_public_user_role_changed 트리거가 app_metadata 동기화)
  UPDATE public.users
    SET role = v_new_role,
        updated_at = now()
    WHERE id = p_user_id;

  -- 7. 대상 유저 알림 — 푸시 수신 시 클라이언트가 refreshProfile(세션 재발급)로
  --    JWT role을 즉시 동기화한다 (PR#322 패턴 재사용)
  INSERT INTO public.notifications (recipient_id, type, category, title, body, link, is_read, priority, created_at)
  VALUES (
    p_user_id,
    'role_changed',
    'system',
    '계정 권한 변경',
    '계정 권한이 ''' ||
      CASE p_new_role
        WHEN 'admin' THEN '관리자'
        WHEN 'employer' THEN '구인자'
        WHEN 'staff' THEN '스태프'
        ELSE p_new_role  -- enum 신규 값 추가 시 오표기 대신 원문 표기
      END || ''' 역할로 변경되었습니다.',
    '/settings',
    false,
    'high',
    now()
  );

  RETURN jsonb_build_object('previous_role', v_previous_role);
END;
$$;
