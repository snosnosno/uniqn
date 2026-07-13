-- 방어심화 2종 — 유저플로우 감사 LOW 후속 (2026-07-12)
--
-- [1] 정산 완료 건 커스텀 정산 설정 동결 (P1#6 의 DB 계층)
-- 문제
--   P1#6(f329a923e)은 앱 레이어(SettlementRepository)에서 정산 완료 건의
--   커스텀 급여설정 수정을 AlreadySettledError 로 차단했다. 그러나 wl_update
--   RLS 는 payroll_status 를 보지 않으므로, 인가된 매니저(owner/워크스페이스
--   멤버/협업자)가 PostgREST 직접 PATCH 로 완료 건의 custom_salary_info /
--   custom_allowances / custom_tax_settings 를 여전히 변경할 수 있었다
--   (P1 보안리뷰 LOW). 표시액은 payroll_amount 동결(P0#2)이라 안전하지만
--   재정산·감사 시 입력값과 결과의 정합이 깨진다.
-- 수정
--   protect_work_log_payroll_columns 트리거(prod 본문 실측 md5 bc2fd088… 기반)에
--   "OLD.payroll_status='completed' 이면 custom_* 변경 금지" 블록을 추가한다.
--   admin/employer 조기 허용보다 앞에 두어 역할 무관 적용. service_role
--   (레거시 GUC + 모던 JWT 클레임 양쪽)만 예외.
-- P0#1 교훈 준수 (QR 무회귀)
--   이 트리거는 SECURITY DEFINER 라 process_qr_checkin_atomically(SECDEF RPC)
--   내부에서도 스태프 JWT 를 본다. QR 출퇴근은 check_in_ts/check_out_ts/status 만
--   변경하고 custom_* 를 건드리지 않으므로 IS DISTINCT FROM 조건에 걸리지 않는다.
--   회귀 고정: process_qr_checkin_atomically.test.sql · qr_checkin_time_clamp.test.sql
-- 잔여 (의도적 허용)
--   employer 가 payroll_status 를 completed→pending 으로 되돌린 뒤 수정하는
--   2단계 경로는 허용한다 — 조용한 변조를 막고 명시적 정산 취소를 강제하는
--   것이 목적이다(상태 전이는 가시적 이벤트).
--
-- [2] 미승인 대회 공고 조기지원 직접 INSERT 차단 (P0#4 의 DB 계층)
-- 문제
--   P0#4(d0cf940b1)는 앱 레이어(applyToJobV2, E6080)에서 미승인 대회 지원을
--   차단했지만, applications INSERT RLS(app_insert)는 applicant_id=자기 자신만
--   검사한다. 스태프가 자기 JWT 로 PostgREST 직접 INSERT 하면 미승인 대회에
--   조기 지원이 가능했다(P0-D 보안리뷰 LOW).
-- 수정
--   BEFORE INSERT 트리거로 대회 공고(posting_type='tournament')는
--   tournament_config->>'approvalStatus'='approved' 일 때만 지원을 허용한다.
--   approvalStatus/config 부재(NULL)도 차단 — 앱 SSOT(isTournamentApprovalBlocked,
--   fail-closed)와 동일 계약. 비-tournament 는 항상 통과.
--   ※ NULL 안전: IS DISTINCT FROM 사용 (pitfall_plpgsql_null_through_regex_fail_open)
-- 잔여 (별도 트랙)
--   취소된 지원을 UPDATE(cancelled→applied)로 재활성화하는 경로는 이 게이트
--   범위 밖 — applications 상태 전이 전반의 직접 PATCH 계약은 별도 설계 필요.
--
-- 회귀 고정: supabase/tests/worklog_settled_custom_lock.test.sql (6 케이스)
--            supabase/tests/applications_tournament_approval_gate.test.sql (4 케이스)

-- ============================================================================
-- [1] protect_work_log_payroll_columns — 정산 완료 건 custom_* 동결 추가
-- ============================================================================

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

-- ============================================================================
-- [2] applications — 미승인 대회 지원 게이트 (BEFORE INSERT)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_application_tournament_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_posting_type public.posting_type;
  v_approval text;
BEGIN
  -- 서버 사이드(service_role) 경유는 신뢰 — 레거시 GUC + 모던 JWT 양쪽 인식
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT jp.posting_type, jp.tournament_config ->> 'approvalStatus'
    INTO v_posting_type, v_approval
    FROM public.job_postings jp
   WHERE jp.id = NEW.job_posting_id;

  -- 공고 미존재는 FK 제약이 처리 → 통과
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 대회 공고는 approvalStatus='approved' 일 때만 지원 허용.
  -- NULL(config/키 부재)도 차단 — 앱 isTournamentApprovalBlocked 와 동일한 fail-closed.
  IF v_posting_type = 'tournament' AND v_approval IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'tournament_not_approved'
      USING ERRCODE = '42501',
            DETAIL  = '승인되지 않은 대회 공고에는 지원할 수 없습니다.';
  END IF;

  RETURN NEW;
END;
$function$;

-- 신규 함수 anon default-grant 함정 방어 (pitfall_supabase_new_function_anon_default_grant)
-- 트리거 함수(RETURNS trigger)는 RPC 로 직접 호출할 수 없으나 명시 회수로 고정.
REVOKE ALL ON FUNCTION public.check_application_tournament_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS applications_tournament_approval_gate ON public.applications;
CREATE TRIGGER applications_tournament_approval_gate
  BEFORE INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.check_application_tournament_approval();

COMMENT ON TRIGGER applications_tournament_approval_gate ON public.applications IS
  '미승인 대회 공고 지원 차단(fail-closed). 앱 applyToJobV2 E6080 게이트의 DB 방어심화. '
  'service_role 은 예외. 2026-07-12 유저플로우 감사 LOW 후속.';
