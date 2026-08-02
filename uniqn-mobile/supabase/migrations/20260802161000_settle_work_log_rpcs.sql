-- ============================================================
-- 감사 후속 P5 — L1(2/2) 2단계: 정산 확정·일괄 RPC 화
--
-- 앞 마이그(20260802160000_settlement_amount_calculator.sql)가 계산을 서버로 옮겼으므로
-- 이제 확정을 옮겨도 canonical 재계산 방어가 사라지지 않는다. 두 마이그는 한 묶음이다.
--
-- 이 전환이 실제로 고치는 것 (전환 전 클라 구현 = SettlementRepository.ts:302-637):
--   1) 소유권 select → 상태 확인 → update 사이 TOCTOU. 그 사이 다른 세션이 확정하면
--      "중복 정산 방지" 가드를 통과한 뒤 두 번째 확정이 성사됐다 → FOR UPDATE 로 닫는다.
--   2) 금액이 클라에서 계산돼 payroll_amount 에 실려 갔다 → 서버가 DB 값으로 재계산한다.
--   3) 개별 정산이 왕복 3~5회(work_log select · posting select · 권한 RPC · update)였다 → 1회.
--   4) 일괄은 청크당 (select + select + 권한 RPC×공고수 + update×N) 이었다 → 청크당 1회.
--
-- 🔴 권한 술어는 "행 접근"이 아니라 **"공고 관리 권한"**(job_postings 기준)이다.
--    RLS `wl_update` 의 USING 은 `owner_id = auth.uid()` 도 통과시키는데, work_logs.owner_id 는
--    지점 직속 배치에서 staff 본인일 수 있다. 행 접근으로 쓰면 **staff 가 자기 근무기록에
--    이 RPC 를 불러 셀프 정산**하게 된다. SECDEF 라 RLS 가 뒤를 받쳐주지 않으므로
--    함수 안 술어가 유일한 관문이다. set_work_log_payroll_status 와 동일한 형태를 쓴다.
--
-- ⚠️ SECDEF 라도 `protect_work_log_payroll_columns` 트리거는 우회하지 못한다 —
--    그 트리거는 definer 가 아니라 **호출자의 JWT**(app_metadata.role)를 읽는다.
--    employer/admin 이 아닌 협업자는 RPC 술어를 통과해도 트리거가 막는다(전환 전과 동일한 선재 제약).
--
-- ⚠️ 남는 것(이 마이그가 덮지 않음): payroll 컬럼 **직접 UPDATE 차단**(L1 3단계).
--    확정·일괄이 전환된 지금도 아직 넣으면 안 된다 — 미전환 클라(구 빌드)가 즉시 죽는다.
--    순서: 이 PR 머지 → 웹 배포 + OTA → 롤아웃 확인 → 그때 차단.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 개별 확정
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_work_log(
  p_work_log_id uuid,
  p_notes       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_wl         record;
  v_job        record;
  v_now        timestamptz := now();
  v_is_container boolean;
  v_calc       jsonb;
  v_amount     numeric;
  v_allow_snap jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  -- 🔑 FOR UPDATE — 확정은 금전 기록을 만드는 조작이라 상태 확인과 쓰기 사이가 벌어지면 안 된다.
  SELECT * INTO v_wl FROM public.work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: 근무 기록을 찾을 수 없습니다';
  END IF;

  SELECT * INTO v_job FROM public.job_postings WHERE id = v_wl.job_posting_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: 공고를 찾을 수 없습니다';
  END IF;

  IF NOT (
    COALESCE(v_job.owner_id = v_actor, false)
    OR COALESCE(public.is_workspace_member(v_job.workspace_id, v_actor), false)
    OR COALESCE(public.is_posting_collaborator(v_job.id, v_actor), false)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산할 수 있습니다';
  END IF;

  -- 출퇴근 완료 게이트. 클라 구현과 같은 두 상태만 허용한다.
  IF v_wl.status NOT IN ('checked_out', 'completed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 출퇴근이 완료된 근무 기록만 정산할 수 있습니다';
  END IF;

  -- 중복 정산 방지. payroll_status 는 NOT NULL 이 아니므로 3값 논리를 COALESCE 로 닫는다.
  IF COALESCE(v_wl.payroll_status = 'completed', false) THEN
    RAISE EXCEPTION 'ALREADY_SETTLED: 이미 정산 완료되었습니다';
  END IF;

  v_is_container := (v_job.status::text = 'container');

  -- canonical 금액. 컨테이너는 급여 근거가 schedule.roleSalaries 에 있고 공고 수당·세금 설정이
  -- 아예 없다 — 계산기가 그 분기를 갖고 있으므로 status 를 그대로 넘긴다.
  v_calc := public.fn_settlement_amount(
    v_wl.check_in_ts,
    v_wl.check_out_ts,
    v_wl.role::text,
    v_wl.custom_role,
    v_wl.custom_salary_info,
    v_wl.custom_allowances,
    v_wl.custom_tax_settings,
    v_job.status::text,
    v_job.schedule,
    v_job.role_catalog,
    v_job.compensation
  );
  v_amount := (v_calc ->> 'afterTaxPay')::numeric;

  -- ES-003: 확정 시점에 공고 수당을 스냅샷한다(공고를 나중에 고쳐도 과거 정산이 흔들리지 않게).
  -- ⚠️ 컨테이너는 스냅샷 대상이 아니다 — 클라의 경량 투영이 compensation 을 {} 로 만들어
  --    애초에 스냅샷할 값이 없었다. 그 동작을 그대로 옮긴다.
  v_allow_snap := CASE
    WHEN v_is_container THEN NULL
    WHEN v_wl.custom_allowances IS NOT NULL THEN NULL
    ELSE v_job.compensation -> 'allowances'
  END;

  UPDATE public.work_logs SET
    payroll_status = 'completed',
    payroll_amount = v_amount,
    payroll_date   = v_now,
    -- p_notes 가 NULL 이면 "미지정" 이다(클라의 `notes !== undefined` 와 같은 의미).
    -- 기존 메모를 지우는 경로는 전환 전에도 없었다.
    payroll_notes  = COALESCE(p_notes, payroll_notes),
    custom_allowances = COALESCE(v_allow_snap, custom_allowances),
    updated_at     = v_now
  WHERE id = p_work_log_id;

  RETURN jsonb_build_object(
    'success',   true,
    'workLogId', p_work_log_id,
    'amount',    v_amount,
    'message',   '정산이 완료되었습니다',
    -- 내역은 관측용이다. 클라는 amount 만 쓰지만, 금액이 이상할 때 어느 단계에서
    -- 갈라졌는지(기본급·수당·세금) 로그 한 줄로 알 수 있어야 한다.
    'breakdown', v_calc
  );
END;
$$;

COMMENT ON FUNCTION public.settle_work_log(uuid, text) IS
  '정산 확정(감사 L1). 금액을 서버가 fn_settlement_amount 로 재계산하고 FOR UPDATE 로 TOCTOU·중복 확정을 닫는다. '
  '권한 술어는 job_postings 기준(행 접근으로 쓰면 staff 셀프 정산이 열린다). '
  'SECDEF 라 RLS 를 타지 않으므로 이 함수 안 술어가 유일한 관문이다.';

REVOKE ALL ON FUNCTION public.settle_work_log(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_work_log(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 2. 일괄 확정
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_settle_work_logs(
  p_work_log_ids uuid[],
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_id        uuid;
  v_res       jsonb;
  v_results   jsonb := '[]'::jsonb;
  v_success   int   := 0;
  v_failed    int   := 0;
  v_total_amt numeric := 0;
  v_msg       text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_work_log_ids IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 정산할 근무 기록이 없습니다';
  END IF;

  -- 🔴 100 은 클라의 BATCH_CHUNK_SIZE 와 **같은 값이어야 한다**
  --    (SettlementRepository.ts 의 BATCH_CHUNK_SIZE). 클라는 청크당 이 함수를 1회 부른다.
  --    전량을 한 번에 보내면 statement_timeout 에 걸려 부분성공이 통째로 사라진다.
  --    두 값을 각각 테스트가 고정한다(pgTAP: 101건 거부 / Jest: BATCH_CHUNK_SIZE === 100).
  IF array_length(p_work_log_ids, 1) > 100 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 한 번에 정산할 수 있는 근무 기록은 100건까지입니다';
  END IF;

  FOREACH v_id IN ARRAY p_work_log_ids LOOP
    -- 🔑 항목별 서브트랜잭션. 부분 성공은 이 UX 의 계약이다 —
    --    all-or-nothing 으로 만들면 "3건 성공 / 2건 실패" 토스트가 성립하지 않는다.
    --    앞 항목의 성공 커밋은 뒤 항목의 실패에 영향을 받지 않는다.
    BEGIN
      v_res := public.settle_work_log(v_id, p_notes);

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'success', true, 'workLogId', v_id,
        'amount',  (v_res ->> 'amount')::numeric,
        'message', '정산 완료'
      ));
      v_success   := v_success + 1;
      v_total_amt := v_total_amt + (v_res ->> 'amount')::numeric;

    EXCEPTION WHEN OTHERS THEN
      -- 전환 전 클라 구현이 항목별로 내던 문구를 그대로 보존한다.
      -- 개별 경로(settle_work_log 가 직접 던지는 문구)와 **의도적으로 다르다** —
      -- 일괄은 "왜 이 한 건이 빠졌는지"를 목록에서 읽히게 하는 짧은 표현을 쓴다.
      v_msg := CASE
        WHEN SQLERRM LIKE 'WORK_LOG_NOT_FOUND%' THEN '근무 기록을 찾을 수 없습니다'
        WHEN SQLERRM LIKE 'POSTING_NOT_FOUND%'  THEN '권한이 없는 공고입니다'
        WHEN SQLERRM LIKE 'PERMISSION_DENIED%'  THEN '권한이 없는 공고입니다'
        WHEN SQLERRM LIKE 'INVALID_STATUS%'     THEN '출퇴근이 완료되지 않았습니다'
        WHEN SQLERRM LIKE 'ALREADY_SETTLED%'    THEN '이미 정산 완료되었습니다'
        ELSE '정산 업데이트 실패'
      END;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'success', false, 'workLogId', v_id, 'amount', 0, 'message', v_msg
      ));
      v_failed := v_failed + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'totalCount',   array_length(p_work_log_ids, 1),
    'successCount', v_success,
    'failedCount',  v_failed,
    'totalAmount',  v_total_amt,
    -- 입력 순서를 보존한다. 화면은 순서를 안 보지만, 실패 목록에 이름을 붙이는
    -- formatBulkSettlementFailures 가 결정적 출력을 내려면 순서가 흔들리면 안 된다.
    'results',      v_results
  );
END;
$$;

COMMENT ON FUNCTION public.bulk_settle_work_logs(uuid[], text) IS
  '일괄 정산 확정(감사 L1). 항목별 서브트랜잭션(BEGIN…EXCEPTION)으로 부분 성공 계약을 보존하고 '
  'settle_work_log 를 그대로 호출해 권한·상태·금액 규칙을 한 곳에만 둔다. '
  '상한 100 은 클라 BATCH_CHUNK_SIZE 와 같은 값이어야 한다(청크당 1회 호출).';

REVOKE ALL ON FUNCTION public.bulk_settle_work_logs(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_settle_work_logs(uuid[], text) TO authenticated;

-- ------------------------------------------------------------
-- 3. set_work_log_payroll_status 에서 'completed' 진입을 닫는다
--
-- P5 가 남긴 판단 과제였다: "이 RPC 는 completed 진입도 허용하는데 금액을 쓰지 않는다
-- (payroll_date 만 세팅). 이 경로로 들어가면 **금액 없는 지급완료**가 생긴다."
--
-- 실측으로 결정했다 — 프로덕션 호출부에서 이 RPC 를 'completed' 로 부르는 곳은 **0건**이다.
-- 유일한 호출부는 useStaffSettlementsHandlers.ts 의 되돌리기 핸들러이고 항상 'pending' 이다
-- (useSettlement.ts:351 의 "PENDING 과 COMPLETED 둘뿐" 주석은 stale — 같은 PR 에서 고쳤다).
-- 또한 이 RPC 자체가 아직 배포 전이라(P5 #400 머지, OTA 미실시) 구 빌드 호출자도 없다.
-- 지금이 닫기에 가장 싼 시점이고, 확정은 settle_work_log 가 전담하게 됐다.
-- ------------------------------------------------------------
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
  -- ⚠️ 접두사를 INVALID_INPUT 이 아니라 INVALID_STATUS 로 쓴다 — 클라 매퍼는 INVALID_INPUT 안에서
  --    '사유를 입력' 포함 여부로만 갈라서, 이 케이스가 XSS 분기(보안 코드/severity medium)로
  --    오분류돼 보안 지표를 오염시킨다. 이건 사용자 입력 오류가 아니라 호출 계약 위반이다.
  -- 🔴 'completed' 를 먼저 가른다. 화이트리스트를 앞에 두면 이 분기가 도달 불가능해져
  --    "왜 막혔는지" 대신 "알 수 없는 상태" 라는 엉뚱한 안내가 나간다.
  --    확정은 settle_work_log 가 금액 재계산과 함께 처리한다.
  IF p_status = 'completed' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 지급 완료 처리는 정산 확정으로만 할 수 있습니다';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: 알 수 없는 정산 상태입니다: %', COALESCE(p_status, '(null)');
  END IF;
  v_status := p_status::payroll_status;

  -- 🔑 FOR UPDATE — 이 잠금이 이 함수의 본체다.
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

  -- 권한 술어. ⚠️ 클라 `validateWorkLogOwnership` 과 **동일하지 않다** — 두 곳이 넓어졌고
  -- 둘 다 의식적인 결정이다(둘 다 확대 방향이라 정상 사용자 회귀는 없다):
  --   1) `is_admin()` 추가. 클라 쪽 `postingAuthority.ts` 는 admin 을 **의도적으로 배제**했는데,
  --      이유가 "후속 RLS 에 admin 분기가 없어 UPDATE 가 0행 silent no-op 이 되고 caller 가
  --      false success 를 인식"이었다. 이 함수는 SECDEF 라 RLS 를 타지 않으므로 그 사유가
  --      소멸하고 admin 이 실제로 쓰기를 성사시킨다 — 관리자 지원 업무를 위해 의도적으로 연다.
  --   2) 비-owner 이고 workspace_id 가 NULL 인 레거시 행: 클라는 즉시 거부했지만 여기서는
  --      `is_posting_collaborator` 로 통과할 수 있다.
  IF NOT (
    COALESCE(v_job.owner_id = v_actor, false)
    OR COALESCE(public.is_workspace_member(v_job.workspace_id, v_actor), false)
    OR COALESCE(public.is_posting_collaborator(v_job.id, v_actor), false)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 권한이 있는 공고의 근무 기록만 정산 상태를 변경할 수 있습니다';
  END IF;

  -- ⚠️ payroll_status 는 DEFAULT 'pending' 이지만 NOT NULL 이 **아니다**(baseline 스키마).
  --    NULL 행이면 비교가 NULL 이 되어 v_is_revert 가 NULL 이 되고, 반환 jsonb 의 'reverted' 가
  --    false 가 아니라 null 로 나간다. COALESCE 로 3값 논리를 닫는다.
  -- ⚠️ `v_status <> 'completed'` 는 위 게이트 때문에 **항상 참**이라 관찰 불가능한 방어다.
  --    게이트가 나중에 완화되면 의미가 살아나므로 남겨 둔다.
  v_is_revert := COALESCE(v_wl.payroll_status = 'completed' AND v_status <> 'completed', false);

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
    -- 되돌릴 때는 지급일을 지운다(더 이상 유효하지 않다). 그 외 전이는 기존 값을 보존한다.
    -- (completed 진입 분기는 위에서 차단됐으므로 이 CASE 에 더 이상 존재하지 않는다.)
    payroll_date = CASE WHEN v_is_revert THEN NULL ELSE payroll_date END,
    -- 동결 표시액(payroll_amount)은 되돌려도 남긴다. shouldUseFrozenPayrollAmount 가
    -- 완료 상태에서만 쓰므로 표시에 새지 않고, '얼마를 완료로 찍었었는지'는 이의 처리에 필요하다.
    settlement_modification_history = CASE
      WHEN v_is_revert THEN
        (CASE WHEN jsonb_typeof(settlement_modification_history) = 'array'
              THEN settlement_modification_history
              ELSE '[]'::jsonb END)
        || jsonb_build_array(jsonb_build_object(
             'type',           'payroll_status_revert',
             -- 리터럴 'completed' 를 박지 않고 실제 이전 상태를 쓴다 — 되돌리기 게이트가
             -- 나중에 넓어져도 이력이 사실을 유지한다(현재 게이트에선 항상 'completed').
             'previousStatus', v_wl.payroll_status::text,
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
  '이력 항목 형태는 notify_on_work_log_update Case 3-B 의 읽기 계약과 일치해야 한다. '
  '지급 완료 진입은 금액 없는 완료를 만들어 차단한다 — 확정은 settle_work_log 전담.';

REVOKE ALL ON FUNCTION public.set_work_log_payroll_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_work_log_payroll_status(uuid, text, text) TO authenticated;
