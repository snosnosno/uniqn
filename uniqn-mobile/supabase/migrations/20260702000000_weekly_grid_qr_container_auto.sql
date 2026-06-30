-- 주간 배치 그리드 — QR 체크인 트리밍: 컨테이너 공고 허용 + auto 분기 + 원본보존 (S5/R4)
--
-- 배경: process_qr_checkin_atomically 는 status='active' 공고만 허용했다. 주간 배치 그리드의
--   숨김 컨테이너 공고(status='container')에 직접 배치된 work_log 도 QR 출퇴근이 가능해야 한다.
--
-- 라이브 본문(pg_get_functiondef = 20260621090100_bind_mutation_rpcs_to_auth_uid.sql 와 동일)을
--   verbatim 보존하고, 아래 4가지만 변경한다:
--   (1) p_action='auto' 분기: 현재 work_log.status='checked_in' 이면 checkOut, 아니면 checkIn 도출.
--   (2) status 가드 완화: status<>active 차단 → status NOT IN ('active','container') 차단(컨테이너 허용).
--   (3) checkOut 원본보존: clocked_out_raw 는 현재 NULL 일 때만 세팅(덮어쓰기 금지),
--       end_time_source 를 'qr' 로 기록.
--   (4) 그 외 속성 100% 보존: 호출자 바인딩(auth.uid()=p_staff_id OR is_admin), FOR UPDATE,
--       staff_id/job_posting_id/date mismatch 가드, payroll already_settled 가드, 중복/음수 duration
--       방어, SECDEF, search_path=public,extensions,pg_temp(pg_temp 마스킹 차단 하드닝), anon REVOKE.
--
-- is_active 계정가드 메모(S5): 라이브 QR 함수에는 users.is_active 계정가드가 없다
--   (20260415120000 이 추가했으나 20260621090100 이 caller-binding 도입 시 QR 함수에서만 누락됨;
--    cancel/confirm 에는 잔존). 본 마이그는 라이브 본문을 보존하므로 계정가드를 추가/제거하지 않으며,
--   QR 경로의 계정식별 강제는 caller-binding(auth.uid() = p_staff_id) 으로 그대로 유지된다.
--   컨테이너/auto 신규 경로도 동일 caller-binding 을 통과해야 하므로 우회 없음.

CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(p_work_log_id uuid, p_staff_id uuid, p_job_posting_id uuid, p_action text, p_check_time timestamp with time zone DEFAULT now(), p_expected_date text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting_status text;
  v_now text := to_char(p_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_work_duration numeric := 0;
  v_duration_minutes numeric;
  v_action text;
BEGIN
  -- [보안] 호출자 바인딩: 직원 본인 셀프 체크인만(또는 admin). (라이브 보존)
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_staff_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_work_log FROM work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found'); END IF;

  SELECT status INTO v_job_posting_status FROM job_postings WHERE id = p_job_posting_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found'); END IF;

  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch'); END IF;
  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch'); END IF;
  IF p_expected_date IS NOT NULL AND COALESCE(v_work_log.is_fixed_posting, false) = false AND v_work_log.date IS DISTINCT FROM p_expected_date THEN RETURN jsonb_build_object('success', false, 'error', 'date_mismatch'); END IF;
  -- (2) status 가드 완화: 컨테이너(주간 배치 숨김 공고) 도 허용
  IF v_job_posting_status::text NOT IN ('active', 'container') THEN RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive'); END IF;
  IF v_work_log.payroll_status::text = 'completed' THEN RETURN jsonb_build_object('success', false, 'error', 'already_settled'); END IF;

  -- (1) auto 분기: 현재 상태가 checked_in 이면 checkOut, 아니면 checkIn 으로 도출
  v_action := p_action;
  IF v_action = 'auto' THEN
    IF v_work_log.status::text = 'checked_in' THEN
      v_action := 'checkOut';
    ELSE
      v_action := 'checkIn';
    END IF;
  END IF;

  IF v_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN RETURN jsonb_build_object('success', false, 'error', 'already_checked_in'); END IF;
    UPDATE work_logs SET status = 'checked_in', check_in_ts = p_check_time, updated_at = p_check_time WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkIn', 'check_in_time', v_now, 'work_duration', 0);
  ELSIF v_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN RETURN jsonb_build_object('success', false, 'error', 'not_checked_in'); END IF;
    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;
    -- (3) 원본보존: clocked_out_raw 는 NULL 일 때만 세팅(덮어쓰기 금지), end_time_source='qr'
    UPDATE work_logs SET
      status = 'checked_out',
      check_out_ts = p_check_time,
      clocked_out_raw = COALESCE(v_work_log.clocked_out_raw, p_check_time),
      end_time_source = 'qr',
      work_duration = v_work_duration,
      updated_at = p_check_time
    WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkOut', 'check_out_time', v_now, 'work_duration', v_work_duration);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$function$;

-- 권한 불변 보장(S2): anon REVOKE + authenticated GRANT (라이브와 동일, 명시 재선언)
REVOKE ALL ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) IS
  'QR check-in/out 원자화 RPC. 라이브 본문 보존 + 컨테이너 공고 허용 + auto 분기 + clocked_out_raw 원본보존/end_time_source=qr (주간 배치 그리드 S5/R4).';
