-- work_logs timestamptz 전환 Phase C (후속 리팩토링 #5)
-- 목표: process_qr_checkin_atomically 를 check_in_ts/check_out_ts dual-write 로 전환
-- + duration 계산을 timestamptz 직접 사용 (jsonb 추출 로직 제거)
-- 기존 jsonb 컬럼도 계속 씀 (Phase D 전까지 reader 호환)

CREATE OR REPLACE FUNCTION public.process_qr_checkin_atomically(
  p_work_log_id uuid,
  p_staff_id uuid,
  p_job_posting_id uuid,
  p_action text,
  p_check_time timestamptz DEFAULT now(),
  p_expected_date text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_work_log work_logs%ROWTYPE;
  v_job_posting_status text;
  v_now text := to_char(p_check_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_work_duration numeric := 0;
  v_duration_minutes numeric;
BEGIN
  -- 1. Lock work_log row
  SELECT * INTO v_work_log
  FROM work_logs
  WHERE id = p_work_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found');
  END IF;

  -- 2. Lock job_posting row
  SELECT status INTO v_job_posting_status
  FROM job_postings
  WHERE id = p_job_posting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

  -- 3. Defensive validations
  IF v_work_log.staff_id IS DISTINCT FROM p_staff_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'staff_id_mismatch');
  END IF;

  IF v_work_log.job_posting_id IS DISTINCT FROM p_job_posting_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_id_mismatch');
  END IF;

  IF p_expected_date IS NOT NULL
     AND COALESCE(v_work_log.is_fixed_posting, false) = false
     AND v_work_log.date IS DISTINCT FROM p_expected_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'date_mismatch');
  END IF;

  IF v_job_posting_status::text != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;

  IF v_work_log.payroll_status::text = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  -- 4. Action-specific processing
  IF p_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_checked_in');
    END IF;

    -- Phase C: dual-write jsonb + timestamptz. Phase D 에서 jsonb 열 제거 예정.
    UPDATE work_logs SET
      status = 'checked_in',
      check_in_time = to_jsonb(v_now),
      check_in_ts = p_check_time,
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkIn',
      'check_in_time', v_now,
      'work_duration', 0
    );

  ELSIF p_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_checked_in');
    END IF;

    -- Phase C: duration 계산을 check_in_ts (timestamptz) 직접 사용 — jsonb 추출 제거.
    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;

    UPDATE work_logs SET
      status = 'checked_out',
      check_out_time = to_jsonb(v_now),
      check_out_ts = p_check_time,
      work_duration = v_work_duration,
      updated_at = p_check_time
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkOut',
      'check_out_time', v_now,
      'work_duration', v_work_duration
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$$;

COMMENT ON FUNCTION public.process_qr_checkin_atomically(
  uuid, uuid, uuid, text, timestamptz, text
) IS 'QR check-in/check-out SELECT FOR UPDATE 단일 트랜잭션 처리. Phase C: check_in_ts/check_out_ts dual-write + duration 계산 timestamptz 직접 사용. Phase D 에서 jsonb 컬럼 제거 예정.';
