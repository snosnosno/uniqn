-- ============================================================
-- 개인 정산 설정 저장 RPC 화 — 감사 S-D (2026-08-07)
--
-- #402(정산 확정·일괄·상태변경 RPC 화)가 남긴 마지막 클라이언트 다단계 뮤테이션이다.
-- SettlementRepository.updateWorkLogCustomSettlement 는 지금까지 이렇게 동작했다:
--
--   ① select(work_log)          — 소유권 + payroll_status 확인
--   ② select(job_posting)       — 소유권 확인
--   ③ 클라에서 이력 배열을 읽어 새 항목을 append
--   ④ update(work_logs) 통째 덮어쓰기
--
-- ------------------------------------------------------------
-- 🔴 이 마이그가 실제로 고치는 것 — 이력 jsonb Lost Update
-- ------------------------------------------------------------
-- ③④가 read-modify-write 인데 잠금이 없다. 두 요청이 겹치면 이렇게 된다:
--
--   T1: select → history=[A]          T2: select → history=[A]
--   T1: update → history=[A,B]
--                                     T2: update → history=[A,C]   ← B 가 사라진다
--
-- 에러는 나지 않는다. **앞 이력 항목이 조용히 지워진다.** 정산 수정 이력은 금액 분쟁 시
-- "누가 언제 얼마로 바꿨나"의 유일한 근거이므로, 조용한 유실은 금전 사고의 증거를 지우는 것과 같다.
--
-- 형제 경로는 이미 닫혀 있었다:
--   · work_logs.modification_history  → #424 가 update_work_log_slot 으로 이관 (FOR UPDATE + 단일 문장)
--   · settlement_modification_history 의 **되돌리기** 항목 → set_work_log_payroll_status
--     (20260802161000:397 이 "FOR UPDATE 로 Lost Update 를 막는다"고 선언)
-- 즉 같은 컬럼에 쓰는 세 경로 중 **이 하나만** 잠금 없이 남아 있었다.
--
-- 해법은 형제와 동일하다 — FOR UPDATE 로 행을 잡고, append 를 **UPDATE 문 안에서** 수행한다.
-- 클라가 배열을 통째로 보내지 않으므로 읽은 뒤 벌어진 일을 덮어쓸 수 없다.
--
-- ------------------------------------------------------------
-- 부수 효과: 서버가 인가·동결·이력 기록자를 재판정한다
-- ------------------------------------------------------------
--   · 소유권 판정을 서버가 다시 한다 (형제 RPC 3종과 **같은 술어**를 쓴다 — 갈라지지 않게)
--   · 정산 완료 건 동결(AlreadySettledError)이 서버 계층에도 선다.
--     ⚠️ 트리거 protect_work_log_payroll_columns 가 이미 42501 로 막고 있으나, 그건
--        'settled_work_log_custom_fields_locked' 라는 **내부 문구**라 사용자에게 그대로 노출된다.
--        RPC 가 먼저 ALREADY_SETTLED 로 접어 클라 에러 매핑이 성립하게 한다(방어 2중, 의도적).
--   · modifiedBy 를 **클라 값이 아니라 auth.uid()** 로 박는다. 지금까지는 서비스 계층이
--     세션에서 채워 넣었지만, 그건 클라가 보내는 값이므로 서버 재판정이 없었다.
--   · modifiedAt 도 서버 시각으로 덮는다 — 기기 시계에 이력 순서가 좌우되지 않게.
--
-- ------------------------------------------------------------
-- 🔴 이 마이그가 **하지 않는** 것 — 쓰기 채널 핀
-- ------------------------------------------------------------
-- custom_* 컬럼에 `tr_work_logs_pin_payroll` 같은 채널 핀을 걸지 **않는다.** 두 가지 이유다:
--
--   1) 기존 pgTAP 계약이 깨진다. worklog_settled_custom_lock.test.sql 케이스 3 이
--      "미정산 건의 custom_* 직접 변경은 employer 에게 열려 있다"를 lives_ok 로 고정한다.
--      핀을 걸면 그 단언이 red 가 되는데, 이는 회귀가 아니라 계약 전환이므로 R4 와 함께
--      한 묶음으로 뒤집어야 한다.
--   2) 핀·REVOKE 는 **롤아웃 확인이 선행 조건**이다(20260802180000:50-53 이 못박은 순서:
--      머지 → 배포+OTA → 롤아웃 확인 → 그 다음). 전환되지 않은 구 빌드가 직접 UPDATE 로
--      저장하고 있는 동안 채널을 좁히면 그 빌드가 즉시 42501 로 죽는다.
--      현재 채택률 계기판이 없어 그 게이트를 채울 수 없다(#407 REVOKE 가 막혀 있는 것과 같은 병목).
--
-- 따라서 이 마이그는 **정문을 만드는** 단계이고, 뒷문을 잠그는 것은 R4 의 몫이다.
-- Lost Update 는 그와 무관하게 지금 닫힌다 — 클라가 새 정문을 쓰는 순간부터.
--
-- ------------------------------------------------------------
-- 파리티
-- ------------------------------------------------------------
-- 신규 함수 1개 → 200 → **201**. 정책 변경 0 → 111 불변.
--
-- 회귀 고정: supabase/tests/settlement_custom_rpc.test.sql (신규)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_work_log_custom_settlement(
  p_work_log_id        uuid,
  p_custom_salary_info jsonb,
  p_custom_tax_settings jsonb,
  p_modification_entry jsonb,
  p_custom_allowances  jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor  uuid := auth.uid();
  v_wl     record;
  v_job    record;
  v_now    timestamptz := now();
  v_entry  jsonb;
  v_reason text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- ----------------------------------------------------------
  -- 입력 형태 검증 — 형제 RPC 와 달리 여기 인자는 전부 jsonb 라 타입이 계약이다.
  -- jsonb_typeof 로 접어 두지 않으면 배열·스칼라가 컬럼에 그대로 들어가고,
  -- 그 뒤 fn_settlement_amount 가 그 값을 읽을 때에야 터진다(원인에서 먼 실패).
  -- ----------------------------------------------------------
  IF p_custom_salary_info IS NULL OR jsonb_typeof(p_custom_salary_info) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 급여 설정 형식이 올바르지 않습니다';
  END IF;

  IF p_custom_tax_settings IS NULL OR jsonb_typeof(p_custom_tax_settings) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 세금 설정 형식이 올바르지 않습니다';
  END IF;

  -- 수당은 미설정(NULL)이 정상이다 — 공고 기본 수당을 그대로 쓰는 경우.
  IF p_custom_allowances IS NOT NULL AND jsonb_typeof(p_custom_allowances) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 수당 설정 형식이 올바르지 않습니다';
  END IF;

  IF p_modification_entry IS NULL OR jsonb_typeof(p_modification_entry) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 수정 이력 형식이 올바르지 않습니다';
  END IF;

  -- 사유 검증. 형제 함수(set_work_log_payroll_status 의 p_reason)와 **같은 값**으로 맞춘다
  -- — 200자 상한 + XSS 패턴. 단일 소스가 없어 값으로 동기화하는 것은 그 함수의 선례를 따른 것이다.
  -- work_logs_xss_check 트리거는 ('notes','custom_role') 만 커버해서 이 jsonb 에는 서버 계층이 없다.
  v_reason := btrim(COALESCE(p_modification_entry ->> 'reason', ''));
  IF length(v_reason) > 200 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 수정 사유는 200자 이하여야 합니다';
  END IF;
  IF v_reason ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
    RAISE EXCEPTION 'INVALID_INPUT: 수정 사유에 허용되지 않는 문자가 포함되어 있습니다';
  END IF;

  -- ----------------------------------------------------------
  -- 🔑 FOR UPDATE — 이 잠금이 이 함수의 본체다.
  -- 이력 append 가 read-modify-write 이므로, 이 잠금 없이는 아래 UPDATE 가 단일 문장이어도
  -- "확인 → 쓰기" 사이가 벌어진다. 형제 set_work_log_payroll_status 와 같은 규약.
  -- ----------------------------------------------------------
  SELECT * INTO v_wl FROM public.work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: 근무 기록을 찾을 수 없습니다';
  END IF;

  SELECT * INTO v_job FROM public.job_postings WHERE id = v_wl.job_posting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: 공고를 찾을 수 없습니다';
  END IF;

  -- 형제 RPC 3종(settle_work_log / bulk_settle_work_logs / set_work_log_payroll_status)과
  -- **글자 그대로 같은 술어**다. 인가 규칙이 함수마다 갈라지면 한쪽만 넓어져도 알아채지 못한다.
  IF NOT (
    COALESCE(v_job.owner_id = v_actor, false)
    OR COALESCE(public.is_workspace_member(v_job.workspace_id, v_actor), false)
    OR COALESCE(public.is_posting_collaborator(v_job.id, v_actor), false)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산 설정을 수정할 수 있습니다';
  END IF;

  -- 정산 완료 건 동결. payroll_status 는 NOT NULL 이 아니므로 3값 논리를 COALESCE 로 닫는다
  -- (COALESCE 없이 비교하면 NULL 인 미정산 건이 NULL 을 반환해 IF 를 빠져나가는 게 아니라
  --  fail-open 처럼 보이는 코드가 된다 — 형제 함수의 주석과 같은 이유).
  IF COALESCE(v_wl.payroll_status = 'completed', false) THEN
    RAISE EXCEPTION 'ALREADY_SETTLED: 정산이 완료된 근무 기록은 정산 설정을 수정할 수 없습니다';
  END IF;

  -- ----------------------------------------------------------
  -- 이력 항목 정규화 — 기록자·시각은 서버가 박는다.
  -- 클라가 보낸 modifiedBy/modifiedAt 을 덮어쓰는 이유: 전자는 인가 주체와 어긋날 수 있고
  -- (지금까지 서비스 계층이 세션에서 채웠지만 그것도 클라가 보내는 값이다),
  -- 후자는 기기 시계에 이력 **순서**가 좌우되기 때문이다.
  -- 나머지 키(reason·newSalaryInfo·previousAllowances…)는 그대로 보존한다.
  -- ----------------------------------------------------------
  v_entry := p_modification_entry
    || jsonb_build_object(
         'modifiedBy', v_actor,
         'modifiedAt', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       );

  UPDATE public.work_logs SET
    custom_salary_info  = p_custom_salary_info,
    custom_allowances   = p_custom_allowances,
    custom_tax_settings = p_custom_tax_settings,
    -- 🔑 append 를 UPDATE 문 안에서 한다 — 클라가 읽은 배열을 통째로 돌려보내지 않으므로
    --    그 사이 다른 트랜잭션이 넣은 항목을 덮어쓸 수 없다.
    --    오염(비배열)이면 빈 배열로 접는다. 리포지토리의 zod 폴백과 같은 판단이며,
    --    여기서 throw 하면 오염된 행이 영구히 편집 불가가 된다.
    settlement_modification_history = (
      CASE WHEN jsonb_typeof(settlement_modification_history) = 'array'
           THEN settlement_modification_history
           ELSE '[]'::jsonb END
    ) || jsonb_build_array(v_entry),
    updated_at = v_now
  WHERE id = p_work_log_id;

  RETURN jsonb_build_object(
    'success',      true,
    'workLogId',    p_work_log_id,
    'historyCount', (
      SELECT jsonb_array_length(
        CASE WHEN jsonb_typeof(settlement_modification_history) = 'array'
             THEN settlement_modification_history
             ELSE '[]'::jsonb END
      )
      FROM public.work_logs WHERE id = p_work_log_id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.update_work_log_custom_settlement(uuid, jsonb, jsonb, jsonb, jsonb) IS
  '개인 정산 설정(급여/수당/세금) 저장 — 감사 S-D. 클라이언트 read-modify-write 를 대체한다. '
  'FOR UPDATE + UPDATE 문 내부 append 로 settlement_modification_history 의 Lost Update 를 막는다 '
  '(형제: set_work_log_payroll_status 의 되돌리기 항목, update_work_log_slot 의 modification_history). '
  '인가 술어는 settle_work_log 와 글자 그대로 동일. modifiedBy/modifiedAt 은 서버가 재판정한다. '
  '⚠️ custom_* 직접 UPDATE 는 아직 열려 있다 — 채널 핀·REVOKE 는 롤아웃 확인이 선행 조건이라 R4 의 몫이다.';

REVOKE ALL ON FUNCTION public.update_work_log_custom_settlement(uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_work_log_custom_settlement(uuid, jsonb, jsonb, jsonb, jsonb) TO authenticated;
