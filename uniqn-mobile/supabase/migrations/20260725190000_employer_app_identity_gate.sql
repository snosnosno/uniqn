-- =============================================================================
-- 구인자 신청/승인 본인인증 서버 게이트
-- =============================================================================
-- 배경: register_as_employer(신청 생성)·approve_employer_application(승인)이
--   users.identity_verified를 검사하지 않아, 클라이언트 버튼 게이트
--   (employer-register.tsx canSubmit)만으로는 RPC 직접 호출 시 미인증 사용자가
--   employer 권한을 획득할 수 있었다. 관리자 승인 화면도 미인증 경고를 "표시"만
--   할 뿐 승인을 차단하지 않았다.
-- 해결: 두 RPC 모두에 identity_verified 서버 게이트 추가.
--   - fail-closed: NULL도 차단 (IS DISTINCT FROM true) — decisions/secdef-hardening
--   - 에러 prefix EMPLOYER_APP_IDENTITY_NOT_VERIFIED → 클라 mapRpcError 매핑
--   - CREATE OR REPLACE: 기존 ACL·owner 보존, 함수 개수 불변(parity 가드 무관)
--   - search_path: 20260711100000 ALTER(30·79행)로 이미 (public, pg_temp) 적용된 상태 —
--     본 재정의는 그 유효값을 함수 본문 정의에도 동일하게 명시(동작 변화 없음)

-- 1) 신청 생성 게이트 — 미인증 사용자는 신청 자체를 차단 (조기 실패)
CREATE OR REPLACE FUNCTION public.register_as_employer(p_employer_agreements jsonb DEFAULT NULL::jsonb, p_intro text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user         RECORD;
  v_app_id       UUID;
  v_supersedes   UUID;
  v_now          TIMESTAMPTZ := now();
BEGIN
  -- 현재 사용자 조회
  SELECT * INTO v_user FROM users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: 사용자를 찾을 수 없습니다';
  END IF;

  -- staff → employer 신청만 허용 (admin 상승 차단)
  IF v_user.role != 'staff' THEN
    RAISE EXCEPTION 'INVALID_ROLE_TRANSITION: 현재 역할 %, staff만 구인자 신청 가능', v_user.role;
  END IF;

  -- 본인인증 서버 게이트 (fail-closed: NULL도 차단)
  IF v_user.identity_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'EMPLOYER_APP_IDENTITY_NOT_VERIFIED: 본인인증 완료 후 구인자 신청이 가능합니다';
  END IF;

  -- 동일 유저 pending 중복 신청 차단
  IF EXISTS (
    SELECT 1 FROM employer_applications
    WHERE user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'EMPLOYER_APP_PENDING_EXISTS: 이미 심사 중인 신청이 있습니다';
  END IF;

  -- 재신청 체인: 직전 거부된 신청 ID 조회
  SELECT id INTO v_supersedes
  FROM employer_applications
  WHERE user_id = auth.uid()
    AND status = 'rejected'
  ORDER BY created_at DESC
  LIMIT 1;

  -- 신청 INSERT (intro + supersedes_id 포함)
  INSERT INTO employer_applications (
    user_id,
    status,
    submitted_at,
    agreements_snapshot,
    intro,
    supersedes_id,
    created_at
  ) VALUES (
    auth.uid(),
    'pending',
    v_now,
    COALESCE(p_employer_agreements, '{}'::JSONB),
    p_intro,
    v_supersedes,
    v_now
  )
  RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success',       true,
    'applicationId', v_app_id,
    'status',        'pending',
    'submittedAt',   v_now,
    'supersedesId',  v_supersedes
  );
END;
$$;

-- 2) 승인 게이트 — 최종 권한 부여 시점 재검증 (신청 후 인증 상태가 바뀐 경우 방어)
CREATE OR REPLACE FUNCTION public.approve_employer_application(p_app_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_app      RECORD;
  v_verified BOOLEAN;
  v_affected INT;
  v_now      TIMESTAMPTZ := now();
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 관리자 권한이 필요합니다';
  END IF;

  SELECT * INTO v_app FROM employer_applications WHERE id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYER_APP_NOT_FOUND: 신청 내역을 찾을 수 없습니다';
  END IF;

  IF v_app.user_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'EMPLOYER_APP_SELF_APPROVE: 본인 신청을 직접 처리할 수 없습니다';
  END IF;

  -- 본인인증 서버 게이트 (fail-closed: NULL도 차단)
  SELECT identity_verified INTO v_verified FROM users WHERE id = v_app.user_id;
  IF v_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'EMPLOYER_APP_IDENTITY_NOT_VERIFIED: 본인인증이 완료되지 않은 신청자는 승인할 수 없습니다';
  END IF;

  UPDATE employer_applications
  SET status = 'approved', reviewed_at = v_now, reviewed_by = auth.uid()
  WHERE id = p_app_id AND status = 'pending';

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'EMPLOYER_APP_ALREADY_PROCESSED: 이미 처리된 신청입니다';
  END IF;

  UPDATE users
  SET role = 'employer', employer_registered_at = v_now, updated_at = v_now
  WHERE id = v_app.user_id;

  RETURN jsonb_build_object(
    'success', true, 'applicationId', p_app_id,
    'userId', v_app.user_id, 'reviewedAt', v_now
  );
END;
$$;
