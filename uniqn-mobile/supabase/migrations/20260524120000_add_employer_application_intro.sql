-- =============================================================================
-- Migration: employer_applications.intro 컬럼 + register_as_employer p_intro
--
-- 구인자 등록 신청 시 "주로 구인하는 지역/매장/대회" 소개글 저장.
-- - intro 컬럼은 nullable (기존 신청 레코드 호환). 필수 여부는 앱 레이어 강제.
-- - 경계 방어용 CHECK: char_length(intro) <= 300
-- - RPC register_as_employer 에 p_intro 파라미터 추가 (인자 개수 변경 → DROP 후 CREATE)
--   기존 supersedes_id 재신청 체인 로직(20260416200000) 보존.
-- =============================================================================

-- 1. intro 컬럼 추가
ALTER TABLE public.employer_applications
  ADD COLUMN IF NOT EXISTS intro text;

ALTER TABLE public.employer_applications
  DROP CONSTRAINT IF EXISTS employer_applications_intro_len_chk;

ALTER TABLE public.employer_applications
  ADD CONSTRAINT employer_applications_intro_len_chk
  CHECK (intro IS NULL OR char_length(intro) <= 300);

-- 2. register_as_employer 재정의 (구 1인자 시그니처 DROP 후 2인자 CREATE)
DROP FUNCTION IF EXISTS public.register_as_employer(JSONB);

CREATE OR REPLACE FUNCTION public.register_as_employer(
  p_employer_agreements JSONB DEFAULT NULL::JSONB,
  p_intro               TEXT  DEFAULT NULL
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

REVOKE ALL ON FUNCTION public.register_as_employer(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_as_employer(JSONB, TEXT) TO authenticated;
