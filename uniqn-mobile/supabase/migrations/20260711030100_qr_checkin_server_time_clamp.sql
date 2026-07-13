-- =============================================================================
-- QR 출퇴근 시각 서버 클램프 — process_qr_checkin_atomically
-- =============================================================================
-- 배경: 유저플로우 감사(2026-07-10) P1#7 / 클러스터 C.
--   RPC 가 클라이언트가 보낸 p_check_time(디바이스 시각)을 그대로
--   check_in_ts/check_out_ts 에 기록한다. 디바이스 시계 조작으로 근무시간
--   (= 정산액)을 부풀릴 수 있다.
--
-- 변경:
--   p_check_time 이 NULL 이거나 서버 now() 와 5분(300초) 초과로 어긋나면
--   서버 now() 로 대체(클램프). 미세 편차는 사용자가 화면에서 본 시각과의
--   일관성을 위해 허용한다.
--   클라 호출부 실측(2026-07-11): eventQRService 가 스캔 즉시 new Date() 로
--   호출하며 오프라인 큐 재전송 경로 없음 → 정상 클라는 클램프에 걸리지 않는다.
--
-- 원본: 2026-07-11 prod pg_get_functiondef 실측 본문(md5 82c6e81b...).
--   클램프 외 인가·상태머신·duration 계산·clocked_out_raw 보존 로직 무변경.
--   v_now 파생만 DECLARE 초기화 → 클램프 후 대입으로 이동.
-- =============================================================================

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
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN RETURN jsonb_build_object('success', false, 'error', 'already_checked_in'); END IF;
    UPDATE work_logs SET status = 'checked_in', check_in_ts = v_check_time, updated_at = v_check_time WHERE id = p_work_log_id;
    RETURN jsonb_build_object('success', true, 'action', 'checkIn', 'check_in_time', v_now, 'work_duration', 0);
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
