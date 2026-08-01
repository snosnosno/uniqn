-- ============================================================
-- 감사 후속 P5 — L1(1/2): 정산 상태 변경·되돌리기 RPC 화
--
-- 감사 L1 원문:
--   "정산 확정·되돌리기가 RPC 없이 클라 직접 .update() — status 게이트·되돌리기 사유
--    필수가 서버에 없다. CLAUDE.md '정산=RPC 필수' 규약 위반"
--   (prod 에 `%settle%` 함수 0개 실측)
--
-- 이 마이그가 덮는 범위와 덮지 않는 범위를 먼저 명확히 한다.
--
-- ✅ 덮는 것 — `updatePayrollStatusWithTransaction`(SettlementRepository.ts:612-676)
--    · 지급 완료 되돌리기의 **사유 필수**가 클라에만 있었다 → 서버로 이전
--    · select→update 사이 TOCTOU 와 settlement_modification_history 의
--      read-modify-write **Lost Update**(잠금·버전 컬럼 없음) → 단일 문장 + FOR UPDATE 로 해소
--    · 권한 판정이 클라 왕복 3~5회 → 서버 1회
--
-- ❌ 덮지 않는 것 — 정산 **확정**(settleWorkLogWithTransaction)·**일괄**(bulkSettlement)
--    이유는 금액이다. 확정은 `SettlementCalculator`(361줄)가 계산한 값을 저장하는데,
--    그 계산기는 현재 **4갈래로 발산한 병렬 구현**이고(과거 실제 발산 이력 있음),
--    로컬 타임존 의존(`new Date(1970,0,1,h,m)`)·이중 반올림 불일치·JS falsy 대 SQL 3값 논리
--    같은 의미론 차이가 있어 PL/pgSQL 포팅이 곧 금액 드리프트 위험이다.
--    🔴 그리고 더 중요한 것: 계산을 포팅하지 않은 채 확정만 RPC 로 옮기면
--       **서버가 클라의 금액을 그대로 받게 되어 지금 있는 canonical 재계산 방어가 오히려 사라진다.**
--       즉 확정의 반쪽 전환은 개선이 아니라 퇴행이다. 확정은 계산 포팅과 한 묶음이어야 한다.
--
-- ⚠️ 이 RPC 만으로는 raw PostgREST 직접 UPDATE 를 막지 못한다.
--    work_logs 의 `wl_update` 정책은 WITH CHECK 이 NULL 이라 USING 을 재사용하고,
--    기존 `protect_work_log_payroll_columns` 는 app_metadata.role 이 admin/employer 면
--    early RETURN 이라 payroll 컬럼을 통과시킨다(prod prosrc 실측).
--    직접 경로 차단은 확정까지 전환된 **뒤**라야 넣을 수 있다 — 지금 넣으면
--    아직 전환되지 않은 확정·일괄 경로가 즉시 죽는다. 후속 묶음으로 남긴다.
--
-- 계약 제약 (P2 #397 이 방금 세운 것 — 반드시 지켜야 한다):
--   `notify_on_work_log_update` 의 Case 3-B 가 되돌리기 알림을 보낼 때
--   settlement_modification_history 배열의 **마지막 항목**에서
--   `type = 'payroll_status_revert'` AND `previousStatus = 'completed'` 를 확인하고
--   `reason` 을 본문에 싣는다(20260802093000...sql:328-344).
--   → 아래 jsonb_build_object 의 키 이름·값 형태가 그 계약과 정확히 일치해야 하며,
--     어긋나면 알림이 사유 없이 나가거나 아예 Case 를 못 탄다.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_work_log_payroll_status(
  p_work_log_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_wl       record;
  v_job      record;
  v_now      timestamptz := now();
  v_status   payroll_status;
  v_reason   text;
  v_is_revert boolean;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- enum 캐스팅을 직접 하면 22P02 가 그대로 새어나가 사용자에게 설명할 수 없다.
  -- 화이트리스트로 먼저 걸러 앱이 매핑할 수 있는 코드를 던진다.
  IF p_status IS NULL OR p_status NOT IN ('pending', 'completed', 'failed') THEN
    RAISE EXCEPTION 'INVALID_INPUT: 알 수 없는 정산 상태입니다: %', COALESCE(p_status, '(null)');
  END IF;
  v_status := p_status::payroll_status;

  -- 🔑 FOR UPDATE — 이 잠금이 이 마이그의 본체다.
  -- 클라 구현은 select 로 이력을 읽고 나중에 update 로 통째 덮어써서, 동시에 두 요청이
  -- 들어오면 나중 쓰기가 앞의 이력 항목을 조용히 지웠다(Lost Update).
  SELECT * INTO v_wl FROM public.work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: %', p_work_log_id;
  END IF;

  SELECT * INTO v_job FROM public.job_postings WHERE id = v_wl.job_posting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_wl.job_posting_id;
  END IF;

  -- 권한 술어는 클라 validateWorkLogOwnership 과 동일한 의미다:
  -- owner 는 workspace 유무와 무관하게 통과(레거시 행 포함), 비-owner 만 멤버십·협업자 판정.
  IF NOT (
    COALESCE(v_job.owner_id = v_actor, false)
    OR COALESCE(public.is_workspace_member(v_job.workspace_id, v_actor), false)
    OR COALESCE(public.is_posting_collaborator(v_job.id, v_actor), false)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산 상태를 변경할 수 있습니다';
  END IF;

  v_is_revert := (v_wl.payroll_status = 'completed' AND v_status <> 'completed');

  -- 지급 완료 되돌리기는 금전 상태를 역행시키는 조작이라 사유·감사 이력을 서버가 강제한다.
  -- 검증 규약은 클라 assertWorkTimeReason 과 동일(200자 상한 + XSS 패턴).
  IF v_is_revert THEN
    v_reason := btrim(COALESCE(p_reason, ''));
    IF v_reason = '' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 지급 완료를 취소하려면 사유를 입력해주세요.';
    END IF;
    IF length(v_reason) > 200 THEN
      RAISE EXCEPTION 'INVALID_INPUT: 수정 사유는 200자 이하여야 합니다';
    END IF;
    -- check_xss_fields 트리거와 같은 패턴을 쓴다(단일 소스가 없어 값으로 맞춘다).
    IF v_reason ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
      RAISE EXCEPTION 'INVALID_INPUT: 수정 사유에 허용되지 않는 문자가 포함되어 있습니다';
    END IF;
  END IF;

  UPDATE public.work_logs SET
    payroll_status = v_status,
    -- 완료로 갈 때만 지급일을 찍고, 되돌릴 때는 지운다(더 이상 유효하지 않다).
    -- 그 외 전이는 기존 값을 보존한다 — 클라 구현과 동일한 의미.
    payroll_date = CASE
      WHEN v_status = 'completed' THEN v_now
      WHEN v_is_revert            THEN NULL
      ELSE payroll_date
    END,
    -- 동결 표시액(payroll_amount)은 되돌려도 남긴다. shouldUseFrozenPayrollAmount 가
    -- 완료 상태에서만 쓰므로 표시에 새지 않고, '얼마를 완료로 찍었었는지'는 이의 처리에 필요하다.
    settlement_modification_history = CASE
      WHEN v_is_revert THEN
        (CASE WHEN jsonb_typeof(settlement_modification_history) = 'array'
              THEN settlement_modification_history
              ELSE '[]'::jsonb END)
        || jsonb_build_array(jsonb_build_object(
             'type',           'payroll_status_revert',
             'previousStatus', 'completed',
             'newStatus',      v_status::text,
             'reason',         v_reason,
             'modifiedBy',     v_actor,
             'modifiedAt',     to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
           ))
      ELSE settlement_modification_history
    END,
    updated_at = v_now
  WHERE id = p_work_log_id;

  RETURN jsonb_build_object(
    'success',       true,
    'workLogId',     p_work_log_id,
    'payrollStatus', v_status::text,
    'reverted',      v_is_revert
  );
END;
$$;

COMMENT ON FUNCTION public.set_work_log_payroll_status(uuid, text, text) IS
  '정산 상태 변경 + 지급완료 되돌리기(감사 L1). 되돌리기 사유 필수·XSS·200자 상한을 서버에서 강제하고, '
  'FOR UPDATE 로 settlement_modification_history 의 Lost Update 를 막는다. '
  '이력 항목 형태는 notify_on_work_log_update Case 3-B 의 읽기 계약과 일치해야 한다.';

REVOKE ALL ON FUNCTION public.set_work_log_payroll_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_work_log_payroll_status(uuid, text, text) TO authenticated;
