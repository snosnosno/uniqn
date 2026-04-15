-- T-E5: work_logs payroll 컬럼 보호 트리거
-- 목적: staff 권한이 자기 work_log 행의 payroll 관련 컬럼을 직접 UPDATE로 조작하지 못하도록 차단
-- 배경: RLS wl_update 정책은 row 단위 허가만 하고 컬럼 단위 제한이 없음.
--       서비스 레이어(SettlementRepository/WorkLogRepository 등)는 employer/admin 권한으로만 payroll을 변경하지만,
--       staff JWT로 직접 supabase.from('work_logs').update({payroll_status}) 호출이 가능했음.
--
-- 허용: service_role, admin, employer
-- 차단: staff (payroll_amount, payroll_status, payroll_date, payroll_notes 변경 시 예외)
--
-- 참조: docs/qa/2026-04-14 W6.1 보안 강화 백로그

CREATE OR REPLACE FUNCTION public.protect_work_log_payroll_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_role text;
BEGIN
  -- service_role (Postgres role)은 모든 변경 허용 (서버 사이드 RPC/Edge Function)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 앱 권한 (app_metadata.role): admin / employer 허용
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');

  IF v_role IN ('admin', 'employer') THEN
    RETURN NEW;
  END IF;

  -- staff (또는 기타): payroll 관련 컬럼 변경 시 예외 발생
  IF (OLD.payroll_amount IS DISTINCT FROM NEW.payroll_amount)
     OR (OLD.payroll_status IS DISTINCT FROM NEW.payroll_status)
     OR (OLD.payroll_date   IS DISTINCT FROM NEW.payroll_date)
     OR (OLD.payroll_notes  IS DISTINCT FROM NEW.payroll_notes) THEN
    RAISE EXCEPTION 'staff_cannot_modify_payroll_fields'
      USING ERRCODE = '42501', -- insufficient_privilege
            DETAIL  = 'payroll_amount / payroll_status / payroll_date / payroll_notes 컬럼은 staff가 직접 변경할 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_work_log_payroll_columns() IS
  'T-E5: staff 권한의 work_logs payroll 컬럼 직접 수정 차단. employer/admin/service_role은 허용.';

-- 기존 트리거 제거 후 재생성 (idempotent)
DROP TRIGGER IF EXISTS protect_work_log_payroll ON public.work_logs;

CREATE TRIGGER protect_work_log_payroll
  BEFORE UPDATE ON public.work_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_work_log_payroll_columns();
