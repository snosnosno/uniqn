-- uniqn-mobile/supabase/migrations/20260813100000_worklog_settled_no_show_lock.sql
-- 정산 완료 근무의 노쇼 전환 동결 — 단방향 비대칭 종료 (감사 3-2 / 2026-08-13)
--
-- 결함:
--   `markAsNoShow` 는 정산 잠금 없이 raw UPDATE 로 `status='no_show'` 를 썼다.
--   대칭 지점인 `cancelNoShow` 는 `BUSINESS_ALREADY_SETTLED` 로 거부하는데
--   반대 방향만 열려 있던 **단방향 비대칭**이다.
--
-- 사용자 영향:
--   ① '지급 완료 + 노쇼' 모순 행이 DB 에 쌓인다.
--   ② 스태프 월 수입 합계는 `completed` 만 합산하므로(scheduleService)
--      **이미 지급한 급여가 통계에서 사라진다**.
--
-- 왜 서버까지 막는가:
--   같은 잠금을 서버 3경로가 이미 갖고 있다 — QR 출근 clamp(20260711030100:66),
--   status 화이트리스트(20260727160000:70), 퇴근 시각 검증(20260807180000:351).
--   전부 `payroll_status='completed'` 를 차단하는데 노쇼 정본 경로만 비어 있었다.
--   이 비대칭 자체가 결함의 증거였고, 여기서 DB 계층을 닫아 방어를 균질화한다.
--
-- 범위를 `no_show` 로 좁힌 이유 (의도적):
--   `payroll_status='completed' AND status 변경` 전체를 막으면 정산 되돌리기 등
--   정당한 전이까지 걸린다. 감사가 지목한 손실 경로는 no_show 하나이므로
--   그 하나만 막는다. 정산 되돌리기(payroll_status 를 함께 바꾸는 UPDATE)는
--   `NEW.payroll_status IS NOT DISTINCT FROM OLD.payroll_status` 조건으로 통과시킨다.
--
-- 구현 선택:
--   신규 함수·신규 트리거를 만들지 않고 기존 `protect_work_log_payroll_columns()` 를
--   CREATE OR REPLACE 로 확장한다.
--     · 트리거는 이미 `BEFORE UPDATE`(컬럼 OF 목록 없음)로 전 UPDATE 에서 발화 중이라
--       추가 오버헤드가 0 이고 배선 변경도 불필요하다.
--     · 함수 수가 늘지 않아 파리티 마커(208/110)를 건드리지 않는다.
--
-- 배치 위치:
--   custom_* 동결 블록 **직후**, app_metadata 역할 조기 RETURN(admin/employer) **앞**.
--   역할 게이트 뒤에 넣으면 employer 가 그대로 빠져나가 무의미해진다.
--
-- 에러 규약:
--   `ALREADY_SETTLED:` 접두사 — 기존 정산 잠금 메시지 관용구
--   (20260806140000 / WorkLogRepositoryVenue) 와 같은 형태를 쓴다.
--
-- 회귀 고정: supabase/tests/worklog_settled_no_show_lock.test.sql (5 케이스)

CREATE OR REPLACE FUNCTION public.protect_work_log_payroll_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
BEGIN
  -- service_role (Postgres role)은 모든 변경 허용 (서버 사이드 RPC/Edge Function)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- [2026-07-12 방어심화] 정산 완료 건의 커스텀 정산 설정 동결 — 역할 무관.
  -- 앱 레이어(AlreadySettledError)의 DB 계층 짝. service_role(모던 JWT)만 예외.
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND OLD.payroll_status = 'completed'
     AND ((OLD.custom_salary_info  IS DISTINCT FROM NEW.custom_salary_info)
       OR (OLD.custom_allowances   IS DISTINCT FROM NEW.custom_allowances)
       OR (OLD.custom_tax_settings IS DISTINCT FROM NEW.custom_tax_settings)) THEN
    RAISE EXCEPTION 'settled_work_log_custom_fields_locked'
      USING ERRCODE = '42501',
            DETAIL  = '정산 완료된 근무기록의 custom_salary_info / custom_allowances / custom_tax_settings 는 변경할 수 없습니다. 정산 상태를 되돌린 후 수정하세요.';
  END IF;

  -- [2026-08-13 감사 3-2] 정산 완료 건의 노쇼 전환 동결 — 역할 무관.
  -- '지급 완료 + 노쇼' 모순 행을 막는다(수입 합산이 completed 만 세므로 지급액이 증발).
  -- 정산을 함께 되돌리는 UPDATE 는 통과시킨다 — 탈출 경로(되돌린 뒤 노쇼)를 남긴다.
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND OLD.payroll_status = 'completed'
     AND NEW.payroll_status IS NOT DISTINCT FROM OLD.payroll_status
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'no_show' THEN
    RAISE EXCEPTION 'ALREADY_SETTLED: 정산이 완료된 근무는 노쇼로 변경할 수 없습니다. 정산을 되돌린 후 다시 시도하세요.'
      USING ERRCODE = '42501'; -- insufficient_privilege
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
$function$;

COMMENT ON FUNCTION public.protect_work_log_payroll_columns() IS
  'work_logs BEFORE UPDATE 가드 — staff 의 payroll_* 직접 변경 차단 + 정산 완료 건의 custom_* 동결(20260712010000) + 정산 완료 건의 no_show 전환 차단(20260813100000, 감사 3-2).';
