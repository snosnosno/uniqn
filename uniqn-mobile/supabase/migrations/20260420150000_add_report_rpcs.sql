-- ============================================================
-- 양방향 신고 RPC 2종 추가 — create_report / review_report
-- ============================================================
-- 배경: Firebase → Supabase 이전(2026-04-11) 시 RPC 2개가 누락되어
--       src/repositories/supabase/ReportRepository.ts 의 runRpc 호출이
--       schema cache miss(404)로 실패. 모든 신고 제출/처리 경로 차단.
--
-- 설계:
--  · SECURITY DEFINER + search_path='public' (기존 update_user_role 패턴)
--  · 비즈니스 예외는 RAISE EXCEPTION USING ERRCODE='P0001' + 메시지 prefix
--    (Repository catch 에서 prefix 매칭 → AppError 변환)
--  · 알림은 기존 AFTER INSERT 트리거 notify_on_report_insert 가 자동 발동
-- ============================================================

-- ------------------------------------------------------------
-- 1) create_report
-- ------------------------------------------------------------
-- Repository.ts:createWithTransaction 가 호출하는 파라미터 순서/이름 준수
-- 중복 신고 방지 윈도우: 24시간 (reporter_id + target_id + job_posting_id + type)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_report(
  p_type                text,
  p_reporter_type       text,
  p_reporter_id         uuid,
  p_reporter_name       text,
  p_target_id           uuid,
  p_target_name         text,
  p_job_posting_id      uuid,
  p_job_posting_title   text,
  p_description         text,
  p_evidence_urls       text[],
  p_severity            public.report_severity,
  p_work_log_id         uuid  DEFAULT NULL,
  p_work_date           text  DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_report_id           uuid;
  v_existing_report_id  uuid;
BEGIN
  -- 1. 호출자 신원 검증 (다른 사용자 명의 신고 방지)
  IF auth.uid() IS DISTINCT FROM p_reporter_id THEN
    RAISE EXCEPTION 'FORBIDDEN: 본인 계정으로만 신고할 수 있습니다 (auth.uid=%, p_reporter_id=%)',
      auth.uid(), p_reporter_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. 본인 신고 차단 (클라이언트 사전 체크와 이중 안전망)
  IF p_reporter_id = p_target_id THEN
    RAISE EXCEPTION 'CANNOT_REPORT_SELF: 본인을 신고할 수 없습니다'
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. 신고자 유형 검증
  IF p_reporter_type NOT IN ('employer', 'employee') THEN
    RAISE EXCEPTION 'INVALID_REPORTER_TYPE: 유효하지 않은 신고자 유형 (%)', p_reporter_type
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. 24시간 내 중복 신고 검사
  SELECT id INTO v_existing_report_id
    FROM public.reports
    WHERE reporter_id     = p_reporter_id
      AND target_id       = p_target_id
      AND job_posting_id  = p_job_posting_id
      AND type            = p_type
      AND created_at      > now() - interval '24 hours'
    LIMIT 1;

  IF v_existing_report_id IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_REPORT: 24시간 내 동일 건을 이미 신고했습니다 (existing=%)',
      v_existing_report_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. INSERT (AFTER INSERT trigger notify_on_report_insert 자동 발동)
  INSERT INTO public.reports (
    type,
    reporter_type,
    reporter_id,
    reporter_name,
    target_id,
    target_name,
    job_posting_id,
    job_posting_title,
    work_log_id,
    work_date,
    description,
    evidence_urls,
    severity,
    status
  )
  VALUES (
    p_type,
    p_reporter_type,
    p_reporter_id,
    p_reporter_name,
    p_target_id,
    p_target_name,
    p_job_posting_id,
    NULLIF(p_job_posting_title, ''),
    p_work_log_id,
    p_work_date,
    p_description,
    COALESCE(p_evidence_urls, ARRAY[]::text[]),
    p_severity,
    'pending'
  )
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('report_id', v_report_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_report(
  text, text, uuid, text, uuid, text, uuid, text, text, text[],
  public.report_severity, uuid, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_report(
  text, text, uuid, text, uuid, text, uuid, text, text, text[],
  public.report_severity, uuid, text
) TO authenticated;

COMMENT ON FUNCTION public.create_report(
  text, text, uuid, text, uuid, text, uuid, text, text, text[],
  public.report_severity, uuid, text
) IS
  '양방향 신고 생성 RPC. auth.uid 일치 검증, 본인/중복(24h) 차단, reports INSERT. '
  'AFTER INSERT 트리거가 관리자 알림 자동 생성. jsonb { report_id: uuid } 반환.';

-- ------------------------------------------------------------
-- 2) review_report
-- ------------------------------------------------------------
-- 관리자 전용 신고 처리 RPC. pending → reviewed/resolved/dismissed 전이.
-- Repository.ts:reviewWithTransaction 이 호출.
-- reports.reviewer_id 컬럼이 text 타입이라 p_reviewer_id(uuid) → text cast 필요.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_report(
  p_report_id       uuid,
  p_status          text,
  p_reviewer_id     uuid,
  p_reviewer_notes  text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller_role     text;
  v_current_status  text;
BEGIN
  -- 1. 관리자 JWT 검증 (app_metadata.role = 'admin')
  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: admin 권한이 필요합니다 (caller role: %)',
      COALESCE(v_caller_role, 'null')
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. 상태 값 화이트리스트
  IF p_status NOT IN ('pending', 'reviewed', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 유효하지 않은 상태 값 (%)', p_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. 대상 신고 조회 + 잠금
  SELECT status INTO v_current_status
    FROM public.reports
    WHERE id = p_report_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_FOUND: 신고를 찾을 수 없습니다 (%)', p_report_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. 상태 전이 검증 (pending 인 건만 처리 가능)
  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'REPORT_ALREADY_REVIEWED: 이미 처리된 신고입니다 (status=%)',
      v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. UPDATE
  UPDATE public.reports
    SET status         = p_status,
        reviewer_id    = p_reviewer_id::text,
        reviewer_notes = NULLIF(p_reviewer_notes, ''),
        reviewed_at    = now(),
        updated_at     = now()
    WHERE id = p_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_report(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_report(uuid, text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.review_report(uuid, text, uuid, text) IS
  '관리자 전용 신고 처리 RPC. app_metadata.role=admin 필요. pending 상태의 신고만 처리 가능. '
  'status/reviewer_id/reviewer_notes/reviewed_at 갱신. 이미 처리된 건은 REPORT_ALREADY_REVIEWED.';
