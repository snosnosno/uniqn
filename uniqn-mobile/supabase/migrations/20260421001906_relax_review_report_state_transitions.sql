-- ============================================================
-- review_report 상태 전이 완화 — pending/reviewed → resolved/dismissed
-- ============================================================
-- 배경: 20260420150000_add_report_rpcs.sql 의 review_report 는
--       `v_current_status <> 'pending'` 이면 REPORT_ALREADY_REVIEWED 를
--       던져서 관리자가 `검토 중(reviewed)` 신고를 `처리 완료(resolved)`
--       또는 `기각(dismissed)` 으로 전이시킬 수 없었다.
--
-- 설계:
--  · 전이 허용 매트릭스를 `종결 상태일 때만 차단` 으로 변경
--    - pending   → reviewed/resolved/dismissed : OK
--    - reviewed  → resolved/dismissed          : OK (이번 변경의 핵심)
--    - reviewed  → pending                     : 금지 (역전이)
--    - resolved/dismissed → *                  : 금지 (종결 불변)
--  · reviewer_id / reviewer_notes / reviewed_at 은 마지막 처리자 기준 덮어쓰기
--    (이력 누적은 현 요구사항 범위 밖. 필요 시 별도 감사 테이블 설계)
--  · 기존 함수 시그니처/권한/search_path 유지, CREATE OR REPLACE 로만 교체
-- ============================================================

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

  -- 2. 상태 값 화이트리스트 (pending 은 재전이 대상이 아님 — 역전이 방지)
  IF p_status NOT IN ('reviewed', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 유효하지 않은 처리 상태 (%)', p_status
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

  -- 4. 상태 전이 검증
  --    - 종결(resolved/dismissed) 건은 재처리 불가
  --    - reviewed → pending 역전이 금지 (p_status 화이트리스트로 이미 차단됨)
  IF v_current_status IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'REPORT_ALREADY_REVIEWED: 이미 처리된 신고입니다 (status=%)',
      v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 5. UPDATE (pending/reviewed 모두 여기 도달)
  UPDATE public.reports
    SET status         = p_status,
        reviewer_id    = p_reviewer_id::text,
        reviewer_notes = NULLIF(p_reviewer_notes, ''),
        reviewed_at    = now(),
        updated_at     = now()
    WHERE id = p_report_id;
END;
$$;

COMMENT ON FUNCTION public.review_report(uuid, text, uuid, text) IS
  '관리자 전용 신고 처리 RPC. app_metadata.role=admin 필요. '
  'pending/reviewed → reviewed/resolved/dismissed 전이 허용, '
  '종결(resolved/dismissed) 건은 REPORT_ALREADY_REVIEWED. '
  'reviewer_id/reviewer_notes/reviewed_at 은 마지막 처리 기준 덮어쓰기.';
