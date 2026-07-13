-- =============================================================================
-- Migration: Code Review 지적 사항 수정
--
-- 1. [C2] employer_applications (user_id) WHERE status='pending' partial unique index
--    → 동시 reapplication race condition 차단 (DB 레벨 제약)
-- 2. [I2] RPC self-approve 체크 null-safe 변환
--    → v_app.user_id = auth.uid() → IS NOT DISTINCT FROM
-- 3. [I3] notify_employer_application_change 트리거 함수 REVOKE FROM PUBLIC
-- =============================================================================

-- =============================================================================
-- 1. Partial Unique Index — pending 동시 신청 차단
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_employer_applications_pending
  ON public.employer_applications (user_id)
  WHERE status = 'pending';

COMMENT ON INDEX public.uq_employer_applications_pending IS
  '동일 유저 pending 신청 1개만 허용 (동시 요청 race condition 차단). RPC의 EXISTS 체크는 앱 레벨, 이 index는 DB 레벨 최종 방어선.';

-- =============================================================================
-- 2. RPC null-safe self-approve 체크
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

  SELECT * INTO v_app FROM employer_applications WHERE id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYER_APP_NOT_FOUND: 신청 내역을 찾을 수 없습니다';
  END IF;

  -- self-approve 방지 (null-safe: IS NOT DISTINCT FROM)
  IF v_app.user_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'EMPLOYER_APP_SELF_APPROVE: 본인 신청을 직접 처리할 수 없습니다';
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

REVOKE ALL ON FUNCTION public.approve_employer_application(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_employer_application(UUID) TO authenticated;


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
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: 관리자 권한이 필요합니다';
  END IF;

  SELECT * INTO v_app FROM employer_applications WHERE id = p_app_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYER_APP_NOT_FOUND: 신청 내역을 찾을 수 없습니다';
  END IF;

  -- self-approve 방지 (null-safe)
  IF v_app.user_id IS NOT DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'EMPLOYER_APP_SELF_APPROVE: 본인 신청을 직접 처리할 수 없습니다';
  END IF;

  IF p_category IS NOT NULL AND p_category NOT IN ('duplicate', 'dummy', 'identity_mismatch', 'other') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: 유효하지 않은 rejection_category: %', p_category;
  END IF;

  UPDATE employer_applications
  SET
    status = 'rejected', reviewed_at = v_now, reviewed_by = auth.uid(),
    rejection_reason = p_reason, rejection_category = p_category
  WHERE id = p_app_id AND status = 'pending';

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  IF v_affected = 0 THEN
    RAISE EXCEPTION 'EMPLOYER_APP_ALREADY_PROCESSED: 이미 처리된 신청입니다';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'applicationId', p_app_id,
    'userId', v_app.user_id, 'reviewedAt', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_employer_application(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_employer_application(UUID, TEXT, TEXT) TO authenticated;

-- =============================================================================
-- 3. Trigger function REVOKE (defense in depth)
--
-- 트리거 함수는 SECURITY DEFINER로 trigger 기작에서 호출되므로 caller 권한 불필요.
-- Supabase 기본 grant (anon/authenticated/service_role)까지 모두 제거하여
-- 직접 호출 경로를 완전히 차단한다. 트리거는 PostgreSQL 내부 기작으로 grant와 무관.
-- =============================================================================

REVOKE ALL ON FUNCTION public.notify_employer_application_change()
  FROM PUBLIC, anon, authenticated, service_role;
