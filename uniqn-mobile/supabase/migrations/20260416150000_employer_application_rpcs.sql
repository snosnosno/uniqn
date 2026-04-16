-- =============================================================================
-- Migration: employer_applications RPC 4개
--
-- 1. register_as_employer       — 재작성 (role 변경 → application INSERT)
-- 2. approve_employer_application — admin only, 동시성 + self-approve 방지
-- 3. reject_employer_application  — admin only, 동시성 + self-approve 방지
-- 4. get_latest_employer_application — 최신 신청 1건 조회
--
-- 에러 prefix → AppError 매핑 (src/errors/AppError.ts):
--   UNAUTHORIZED                  → E2012 (AUTH_REQUIRED)
--   EMPLOYER_APP_PENDING_EXISTS   → E6070
--   EMPLOYER_APP_ALREADY_PROCESSED→ E6071
--   EMPLOYER_APP_SELF_APPROVE     → E6072
--   EMPLOYER_APP_NOT_FOUND        → E6073
-- =============================================================================

-- =============================================================================
-- 1. register_as_employer (재작성)
--    기존: users.role = 'employer' 즉시 변경
--    변경: employer_applications INSERT (status='pending')
-- =============================================================================

CREATE OR REPLACE FUNCTION public.register_as_employer(
  p_employer_agreements JSONB DEFAULT NULL::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user    RECORD;
  v_app_id  UUID;
  v_now     TIMESTAMPTZ := now();
BEGIN
  -- 현재 사용자 조회
  SELECT * INTO v_user
    FROM users
    WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: 사용자를 찾을 수 없습니다';
  END IF;

  -- staff → employer 신청만 허용 (admin 상승 차단)
  IF v_user.role != 'staff' THEN
    RAISE EXCEPTION 'INVALID_ROLE_TRANSITION: 현재 역할 %, staff만 구인자 신청 가능', v_user.role;
  END IF;

  -- 동일 유저 pending 중복 신청 차단
  IF EXISTS (
    SELECT 1 FROM employer_applications
    WHERE user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'EMPLOYER_APP_PENDING_EXISTS: 이미 심사 중인 신청이 있습니다';
  END IF;

  -- 신청 INSERT (status='pending', users.role 변경 없음)
  INSERT INTO employer_applications (
    user_id,
    status,
    submitted_at,
    agreements_snapshot,
    created_at
  ) VALUES (
    auth.uid(),
    'pending',
    v_now,
    COALESCE(p_employer_agreements, '{}'::JSONB),
    v_now
  )
  RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success',       true,
    'applicationId', v_app_id,
    'status',        'pending',
    'submittedAt',   v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_as_employer(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_as_employer(JSONB) TO authenticated;


-- =============================================================================
-- 2. approve_employer_application
--    - admin only
--    - self-approve 방지
--    - 동시성 방지: UPDATE WHERE status='pending' + GET DIAGNOSTICS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.approve_employer_application(
  p_app_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app      RECORD;
  v_affected INT;
  v_now      TIMESTAMPTZ := now();
BEGIN
  -- admin 권한 확인
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 관리자 권한이 필요합니다';
  END IF;

  -- 신청 조회
  SELECT * INTO v_app
    FROM employer_applications
    WHERE id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYER_APP_NOT_FOUND: 신청 내역을 찾을 수 없습니다';
  END IF;

  -- self-approve 방지
  IF v_app.user_id = auth.uid() THEN
    RAISE EXCEPTION 'EMPLOYER_APP_SELF_APPROVE: 본인 신청을 직접 처리할 수 없습니다';
  END IF;

  -- 동시성 방지: status='pending' 조건부 UPDATE
  UPDATE employer_applications
  SET
    status      = 'approved',
    reviewed_at = v_now,
    reviewed_by = auth.uid()
  WHERE id = p_app_id
    AND status = 'pending';

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  -- 영향 row 0 = 이미 처리됨 (다른 관리자가 먼저 처리)
  IF v_affected = 0 THEN
    RAISE EXCEPTION 'EMPLOYER_APP_ALREADY_PROCESSED: 이미 처리된 신청입니다';
  END IF;

  -- users.role 업데이트 + employer_registered_at 세팅
  UPDATE users
  SET
    role                  = 'employer',
    employer_registered_at = v_now,
    updated_at            = v_now
  WHERE id = v_app.user_id;

  RETURN jsonb_build_object(
    'success',       true,
    'applicationId', p_app_id,
    'userId',        v_app.user_id,
    'reviewedAt',    v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_employer_application(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_employer_application(UUID) TO authenticated;


-- =============================================================================
-- 3. reject_employer_application
--    - admin only
--    - self-approve 방지
--    - 동시성 방지: approve와 동일 패턴
--    - users.role 변경 없음
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reject_employer_application(
  p_app_id   UUID,
  p_reason   TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_app      RECORD;
  v_affected INT;
  v_now      TIMESTAMPTZ := now();
BEGIN
  -- admin 권한 확인
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 관리자 권한이 필요합니다';
  END IF;

  -- 신청 조회
  SELECT * INTO v_app
    FROM employer_applications
    WHERE id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYER_APP_NOT_FOUND: 신청 내역을 찾을 수 없습니다';
  END IF;

  -- self-approve 방지
  IF v_app.user_id = auth.uid() THEN
    RAISE EXCEPTION 'EMPLOYER_APP_SELF_APPROVE: 본인 신청을 직접 처리할 수 없습니다';
  END IF;

  -- 카테고리 유효성 검사 (NULL은 허용)
  IF p_category IS NOT NULL AND p_category NOT IN ('duplicate', 'dummy', 'identity_mismatch', 'other') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: 유효하지 않은 rejection_category: %', p_category;
  END IF;

  -- 동시성 방지: status='pending' 조건부 UPDATE
  UPDATE employer_applications
  SET
    status             = 'rejected',
    reviewed_at        = v_now,
    reviewed_by        = auth.uid(),
    rejection_reason   = p_reason,
    rejection_category = p_category
  WHERE id = p_app_id
    AND status = 'pending';

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'EMPLOYER_APP_ALREADY_PROCESSED: 이미 처리된 신청입니다';
  END IF;

  -- users.role 변경 없음 (거부 시 유지)

  RETURN jsonb_build_object(
    'success',       true,
    'applicationId', p_app_id,
    'userId',        v_app.user_id,
    'reviewedAt',    v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_employer_application(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_employer_application(UUID, TEXT, TEXT) TO authenticated;


-- =============================================================================
-- 4. get_latest_employer_application
--    - 본인 또는 admin만 조회 가능
--    - ORDER BY created_at DESC LIMIT 1
--    - 신청 없으면 NULL 반환
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_latest_employer_application(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target_user_id UUID;
  v_app            RECORD;
BEGIN
  -- 대상 user_id 결정 (NULL이면 본인)
  v_target_user_id := COALESCE(p_user_id, auth.uid());

  -- 본인 조회이거나 admin인 경우만 허용
  IF v_target_user_id != auth.uid()
     AND (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin'
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 타인의 신청 내역 조회는 관리자만 가능합니다';
  END IF;

  SELECT * INTO v_app
    FROM employer_applications
    WHERE user_id = v_target_user_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id',                  v_app.id,
    'userId',              v_app.user_id,
    'status',              v_app.status,
    'submittedAt',         v_app.submitted_at,
    'reviewedAt',          v_app.reviewed_at,
    'reviewedBy',          v_app.reviewed_by,
    'rejectionReason',     v_app.rejection_reason,
    'rejectionCategory',   v_app.rejection_category,
    'agreementsSnapshot',  v_app.agreements_snapshot,
    'supersedesId',        v_app.supersedes_id,
    'createdAt',           v_app.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_latest_employer_application(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_employer_application(UUID) TO authenticated;
