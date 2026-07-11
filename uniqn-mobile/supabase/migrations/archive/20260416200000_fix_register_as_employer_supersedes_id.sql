-- =============================================================================
-- Migration: register_as_employer — 재신청 시 supersedes_id 연결
--
-- 기존: supersedes_id가 항상 NULL
-- 수정: 거부된 직전 신청이 있으면 supersedes_id로 연결
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

  -- 신청 INSERT (supersedes_id 포함)
  INSERT INTO employer_applications (
    user_id,
    status,
    submitted_at,
    agreements_snapshot,
    supersedes_id,
    created_at
  ) VALUES (
    auth.uid(),
    'pending',
    v_now,
    COALESCE(p_employer_agreements, '{}'::JSONB),
    v_supersedes,   -- NULL이면 첫 신청, UUID이면 재신청 체인
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

REVOKE ALL ON FUNCTION public.register_as_employer(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_as_employer(JSONB) TO authenticated;
