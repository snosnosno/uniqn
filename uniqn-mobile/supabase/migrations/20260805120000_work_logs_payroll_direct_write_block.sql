-- ============================================================
-- L1 3단계 — work_logs payroll 컬럼 직접 UPDATE 차단
--
-- #402(정산 확정·일괄 RPC 화)가 남긴 마지막 조각이다.
-- 도입 마이그(20260802161000_settle_work_log_rpcs.sql:24-26)가 건 조건:
--   "PR 머지 → 웹 배포 + OTA → 롤아웃 확인 → 그때 차단"
-- 2026-08-05 에 웹 배포(CF `5ad8038e`)와 OTA(그룹 `1aa49947…`, runtime 1.0.5,
-- 커밋 725168dd2)를 마쳤다. 이 마이그가 그 "그때"다.
--
-- ------------------------------------------------------------
-- 🔴 오해 정정 — 차단이 "없던" 게 아니라 "구멍이 있던" 것이다
-- ------------------------------------------------------------
-- prod 실측 결과 `protect_work_log_payroll`(BEFORE UPDATE, 함수
-- `protect_work_log_payroll_columns()`)가 **이미 존재**한다. 다만 게이트가
-- **앱 역할** 축이라 다음과 같다:
--   · service_role                → **레거시 GUC `request.jwt.claim.role` 이 세팅될 때만** 통과.
--     모던 PostgREST 는 단수 per-claim GUC 를 없애고 `request.jwt.claims`(JSON) 만 세팅하므로,
--     그 경우 v_role='' 이 되어 staff 분기('staff_cannot_modify_payroll_fields')로 떨어진다.
--     (리뷰 지적 — prod GUC 를 실측하지는 않았다. 현재 실害 0: supabase/functions·functions·
--      scripts 전수 grep 결과 payroll writer 0건.)
--   · payroll_status='completed' 건의 custom_* → 역할 무관 동결
--   · app_metadata.role IN (admin, employer) → **무조건 RETURN NEW**  ← 구멍
--   · staff / 기타                → payroll 4컬럼 변경 시 차단(이미 막혀 있었다)
--
-- 즉 **구인자·관리자는 지금도 raw PostgREST PATCH 로 payroll 을 직접 쓸 수 있다.**
-- 정산 금액·상태는 RPC(`settle_work_log` / `bulk_settle_work_logs` /
-- `set_work_log_payroll_status`)가 서버에서 재계산·검증하는데, 직접 경로가 열려 있으면
-- 그 검증을 통째로 우회한다(클라가 보낸 금액이 그대로 박힌다).
--
-- ------------------------------------------------------------
-- 🔴 왜 기존 함수를 고치지 않고 트리거를 하나 더 얹는가
-- ------------------------------------------------------------
-- `protect_work_log_payroll_columns()` 는 **SECURITY DEFINER** 다.
-- SECDEF 함수 안에서 `current_user` 는 definer(postgres)로 바뀌므로,
-- P5(20260802120000)가 실증한 **채널 판별**이 그 함수 안에서는 성립하지 않는다
--   · 직접 PostgREST PATCH → current_user = 'authenticated'
--   · SECDEF RPC 경유      → current_user = 'postgres' (definer)
-- 기존 함수를 INVOKER 로 되돌리는 편법은 그 함수가 지금 지키고 있는
-- custom_* 동결·staff 차단의 의미까지 흔든다. 그래서 P5 의
-- `fn_work_logs_pin_identity` 선례 그대로 **non-SECDEF 트리거를 별도로** 얹는다.
-- (두 BEFORE 트리거는 이름 알파벳 순으로 발화한다 — protect_… → tr_… 순.
--  어느 쪽이 먼저 RAISE 해도 결과는 같다.)
--
-- ------------------------------------------------------------
-- 설계 근거 (P5 가 로컬에서 실증한 것을 그대로 승계)
-- ------------------------------------------------------------
--   · `BEFORE UPDATE OF <컬럼>` 은 SET 절에 그 컬럼이 없으면 **발화하지 않는다**
--     → payroll 을 건드리지 않는 정상 경로(출퇴근·메모·커스텀 정산)에 오버헤드 0.
--   · 그러나 SET 절에 **동일한 값**으로 실리기만 해도 발화한다
--     → `IS DISTINCT FROM` 가드가 없으면 객체를 통째로 보내는 호출이 오탐으로 죽는다.
--   · SECDEF 함수 내부의 UPDATE 도 트리거는 발화한다 → 예외 조건이 트리거 안에 있어야 한다.
--   · 데니리스트를 쓰는 이유: service_role·postgres·supabase_admin 경로가 소유자 이름과
--     무관하게 열려 있어 allow-list 보다 안전하다.
--
-- 통과해야 하는 정당 writer (prod 실측 — 셋 다 SECURITY DEFINER, owner=postgres):
--   · set_work_log_payroll_status  · settle_work_log  · bulk_settle_work_logs
--   → 내부에서 current_user='postgres' 이므로 데니리스트에 걸리지 않는다.
--   · cron·psql 직접 접속은 postgres 라 통과한다. Edge Function(service_role)은 **이 트리거는**
--     통과하지만 위에 적은 대로 기존 트리거에 걸릴 수 있다 — payroll writer 가 생기면 먼저 확인할 것.
--
-- 클라 영향 (2026-08-05 실측):
--   · 살아있는 정산 경로는 **전부 RPC** 이고 진입점은 셋이다:
--       ① `settle_work_log`        ← useSettleWorkLog      (venue-settlements.tsx:83)
--       ② `bulk_settle_work_logs`  ← useBulkSettlement     (venue-settlements.tsx:84)
--       ③ `set_work_log_payroll_status` ← settlementMutation.ts:184
--            → SettlementRepository.updatePayrollStatusWithTransaction (:568,587)
--   · 직접 UPDATE 경로(`workLogService.updatePayrollStatus` →
--     `WorkLogRepositoryTransactions.updatePayrollStatusTransaction`)는 **UI 소비자 0건**
--     = 죽은 회로. 같은 PR 에서 삭제한다(서버가 막는 순간 "되살아나면 즉사"하는 지뢰가 되므로).
--   · 따라서 이 차단으로 **현재 빌드는 깨지지 않는다.** 깨지는 건 payroll 을 직접 쓰던
--     구 빌드뿐이고, 지금은 베타 기간이라 허용 범위다(사용자 결정 2026-08-05).
--
-- 🔴 이 핀은 UPDATE 전용이다 — INSERT 면이 지금 안전한 이유는 `work_logs` 에 INSERT 정책이
--    아예 없기 때문이다(`work_logs_insert_owner_or_admin` 은 20260712010100:95-96 에서 DROP).
--    누군가 work_logs INSERT 정책을 추가하면 클라가 payroll_status='completed' + 임의
--    payroll_amount 인 행을 **처음부터** 만들 수 있고 이 핀은 아무것도 막지 못한다.
--    INSERT 정책을 되살릴 때는 BEFORE INSERT 짝을 반드시 함께 넣어라.
--
-- 파리티: 함수 +1 (PARITY_EXPECT_FUNCS 199 → 200). 정책 111 불변(RLS 미변경).
-- ============================================================

-- ------------------------------------------------------------
-- payroll 4컬럼을 RPC 전용으로 고정
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_work_logs_pin_payroll()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- 값이 실제로 바뀌지 않으면 통과 — 객체를 통째로 보내는 호출의 오탐을 막는다.
  IF NEW.payroll_status IS NOT DISTINCT FROM OLD.payroll_status
     AND NEW.payroll_amount IS NOT DISTINCT FROM OLD.payroll_amount
     AND NEW.payroll_date IS NOT DISTINCT FROM OLD.payroll_date
     AND NEW.payroll_notes IS NOT DISTINCT FROM OLD.payroll_notes THEN
    RETURN NEW;
  END IF;

  -- 채널 판별: 직접 PostgREST PATCH 만 차단하고 SECDEF RPC·service_role 은 통과시킨다.
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'WORK_LOG_PAYROLL_RPC_ONLY: 정산 컬럼은 직접 변경할 수 없습니다 (정산 RPC 전용)'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_work_logs_pin_payroll() IS
  'work_logs 의 payroll_status / payroll_amount / payroll_date / payroll_notes 를 정산 RPC 전용으로 '
  '고정한다(감사 L1 3단계). 기존 protect_work_log_payroll 은 앱 역할 축이라 admin·employer 를 '
  '무조건 통과시켜, 구인자가 raw PostgREST PATCH 로 서버 금액 재계산을 우회할 수 있었다. '
  '이 트리거는 non-SECDEF 라 current_user 가 호출 채널을 그대로 보여준다 — 직접 PATCH 는 '
  'authenticated 라 차단되고, SECDEF RPC 경유는 definer(postgres) 라 통과한다. '
  '값이 실제로 바뀌지 않으면(IS NOT DISTINCT FROM) 통과시켜 전체 객체 전송의 오탐을 피한다.';

-- 트리거 함수는 직접 호출 대상이 아니다. prod 하드닝 관례(20260731090000)와 정합.
-- (트리거 발화는 호출자 EXECUTE 권한과 무관하다 — 권한 검사는 CREATE TRIGGER 시점에 끝난다.)
REVOKE EXECUTE ON FUNCTION public.fn_work_logs_pin_payroll() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_work_logs_pin_payroll ON public.work_logs;
CREATE TRIGGER tr_work_logs_pin_payroll
  BEFORE UPDATE OF payroll_status, payroll_amount, payroll_date, payroll_notes ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_work_logs_pin_payroll();
