-- QR 출근 가드 화이트리스트 전환 (W1-8 / RPC-1)
--
-- 문제: checkIn 가드가 `IN ('checked_in','checked_out')` **블랙리스트**여서
--       no_show / cancelled / completed 가 전부 통과했다. 이 함수는 authenticated 에 GRANT 돼
--       있으므로 클라이언트 방어(selectWorkLogForQR)를 우회한 직접 호출이 가능하고, 노쇼는
--       check_in_ts 를 남기지 않으므로 직접 호출로 checked_in 을 만든 뒤에는 **정상 인앱
--       스캔만으로 퇴근까지 완료**되어 없던 유급 근무가 생긴다. 금전 영향이 있는 서버측 구멍.
--
-- 해결: 화이트리스트로 뒤집는다. 통과 목록 = scheduled, no_show.
--       cancelled / completed / 그 외는 각각 구분된 에러 코드로 거부한다(현장에서 '스캔이
--       안 된다' 가 늘 때 사유가 스태프에게 전달되어야 한다).
--
-- 제품 결정: no_show 는 **구제 경로로 허용**한다(사용자 승인, 2026-07-27). 지각한 스태프가
--       뒤늦게 도착했을 때 사장 개입 없이 출근할 수 있어야 현장이 돌아간다. 대신 되돌린
--       사실을 work_logs.modification_history 에 남겨 정산 이의 처리 때 추적 가능하게 한다.
--       (엄격 차단을 택했다면 노쇼 정정은 구인자의 '노쇼 취소' 경로로만 가능했다.)
--
-- 범위: 함수 정의는 20260711030100 에서 **스크립트로 복사**했고 checkIn 블록만 다르다.
--       checkOut 가드(`!= 'checked_in'`)는 이미 화이트리스트라 무변경.
--       auto 분기도 무변경 — checked_in 이면 checkOut, 아니면 checkIn 이고 위 가드가 받는다.
--
-- 되돌리기: 20260711030100 의 함수 정의를 다시 적용하면 된다.

CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(
  p_work_log_id uuid,
  p_staff_id uuid,
  p_job_posting_id uuid,
  p_action text,
  p_check_time timestamp with time zone DEFAULT now(),
  p_expected_date text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting_status text;
  v_check_time timestamptz;
  v_now text;
  v_work_duration numeric := 0;
  v_was_no_show boolean := false;
  v_duration_minutes numeric;
  v_action text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_staff_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- [P1#7] 클라 시각 클램프: NULL 또는 서버 시각과 5분 초과 편차 → 서버 now() 사용
  v_check_time := CASE
    WHEN p_check_time IS NULL
      OR abs(EXTRACT(EPOCH FROM (p_check_time - now()))) > 300 THEN now()
    ELSE p_check_time
  END;
  v_now := to_char(v_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  SELECT * INTO v_work_log FROM work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found'); END IF;

  SELECT status INTO v_job_posting_status FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch'); END IF;
  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch'); END IF;
  IF p_expected_date IS NOT NULL AND COALESCE(v_work_log.is_fixed_posting, false) = false AND v_work_log.date IS DISTINCT FROM p_expected_date THEN RETURN jsonb_build_object('success', false, 'error', 'date_mismatch'); END IF;
  IF v_job_posting_status::text NOT IN ('active', 'container') THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive'); END IF;
  IF v_work_log.payroll_status::text = 'completed' THEN RETURN jsonb_build_object('success', false, 'error', 'already_settled'); END IF;

  v_action := p_action;
  IF v_action = 'auto' THEN
    IF v_work_log.status::text = 'checked_in' THEN
      v_action := 'checkOut';
    ELSE
      v_action := 'checkIn';
    END IF;
  END IF;

  IF v_action = 'checkIn' THEN
    -- [RPC-1] 화이트리스트 가드. 과거엔 IN ('checked_in','checked_out') 블랙리스트라
    -- no_show / cancelled / completed 가 **전부 통과**했다. 이 함수는 authenticated 에 GRANT 돼
    -- 있어 클라 방어(selectWorkLogForQR)를 우회한 직접 호출이 가능하고, 노쇼는 check_in_ts 를
    -- 남기지 않으므로 직접 호출로 checked_in 을 만든 뒤에는 **정상 인앱 스캔만으로 퇴근까지
    -- 완료**되어 없던 유급 근무가 생겼다(금전 영향).
    --
    -- 거부 사유를 코드로 구분한다 — 현장에서 '스캔이 안 된다' 가 늘 때 무엇이 문제인지
    -- 스태프에게 전달되어야 한다(클라 매핑: WorkLogRepositoryTransactions).
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN RETURN jsonb_build_object('success', false, 'error', 'already_checked_in'); END IF;
    IF v_work_log.status::text = 'cancelled' THEN RETURN jsonb_build_object('success', false, 'error', 'work_log_cancelled'); END IF;
    IF v_work_log.status::text = 'completed' THEN RETURN jsonb_build_object('success', false, 'error', 'work_log_completed'); END IF;
    -- 통과 목록은 scheduled 와 no_show 뿐이다. no_show 는 **구제 경로로 의도적으로 허용**한다 —
    -- 지각한 스태프가 뒤늦게 도착한 경우 사장 개입 없이 출근이 되도록 두되, 되돌린 사실을
    -- modification_history 에 남겨 정산 이의 처리 때 추적할 수 있게 한다.
    IF v_work_log.status::text NOT IN ('scheduled', 'no_show') THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_checkin');
    END IF;

    v_was_no_show := (v_work_log.status::text = 'no_show');

    UPDATE work_logs SET
      status = 'checked_in',
      check_in_ts = v_check_time,
      updated_at = v_check_time,
      modification_history = CASE
        WHEN v_was_no_show THEN COALESCE(modification_history, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'type', 'no_show_recovered_by_qr',
            'previousStatus', 'no_show',
            'newStatus', 'checked_in',
            'reason', 'QR 출근 스캔으로 노쇼가 해제되었습니다',
            'modifiedBy', p_staff_id,
            'modifiedAt', to_char(v_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          ))
        ELSE modification_history
      END
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object('success', true, 'action', 'checkIn', 'check_in_time', v_now,
      'work_duration', 0, 'no_show_recovered', v_was_no_show);
  ELSIF v_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN RETURN jsonb_build_object('success', false, 'error', 'not_checked_in'); END IF;
    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (v_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;
    UPDATE work_logs SET
      status = 'checked_out',
      check_out_ts = v_check_time,
      clocked_out_raw = COALESCE(v_work_log.clocked_out_raw, v_check_time),
      end_time_source = 'qr',
      work_duration = v_work_duration,
      updated_at = v_check_time
    WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkOut', 'check_out_time', v_now, 'work_duration', v_work_duration);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$function$;

-- 권한: 기존 계약 유지(anon 불가). CREATE OR REPLACE 는 ACL 보존하나 명시 고정.
REVOKE ALL ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) TO authenticated, service_role;
