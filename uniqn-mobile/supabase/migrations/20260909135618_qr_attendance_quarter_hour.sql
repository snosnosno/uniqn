-- QR 출퇴근 시각 단순화
--
-- 원칙
-- 1. 신뢰 기준은 클라이언트 시각이 아니라 DB 서버의 clock_timestamp()다.
-- 2. 출근 적용 시각은 max(관리자 설정 시작시각, 실제 스캔시각)를 15분 단위로 올림한다.
-- 3. 퇴근 적용 시각은 실제 스캔시각을 15분 단위로 올림한다.
-- 4. 이의 제기와 관리자 정정을 위해 실제 스캔시각은 별도 컬럼에 보존한다.
--
-- 배포 호환성 때문에 기존 함수 시그니처는 당분간 유지한다. 새 앱은
-- process_posting_qr_attendance에서 서버가 action/date를 판별하며 클라이언트 시각은 받지 않는다.

ALTER TABLE public.work_logs
  ADD COLUMN IF NOT EXISTS check_in_scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_out_scanned_at timestamptz;

COMMENT ON COLUMN public.work_logs.check_in_scanned_at IS
  'QR 출근을 DB가 수신한 원본 서버 시각. 관리자 수정과 무관하게 보존한다.';
COMMENT ON COLUMN public.work_logs.check_out_scanned_at IS
  'QR 퇴근을 DB가 수신한 원본 서버 시각. 관리자 수정과 무관하게 보존한다.';

-- 원본 시각은 SECURITY DEFINER QR RPC(소유자 권한) 또는 서버 서비스 역할만 쓸 수 있다.
-- 일반 사용자가 PostgREST UPDATE로 감사 원본을 덮는 경로를 차단한다.
CREATE OR REPLACE FUNCTION public.protect_work_log_qr_scan_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role') THEN
    IF TG_OP = 'INSERT'
       AND (NEW.check_in_scanned_at IS NOT NULL OR NEW.check_out_scanned_at IS NOT NULL) THEN
      RAISE EXCEPTION 'QR_SCAN_TIMESTAMP_IMMUTABLE: 원본 QR 스캔시각은 수정할 수 없습니다';
    END IF;
    IF TG_OP = 'UPDATE'
       AND (NEW.check_in_scanned_at IS DISTINCT FROM OLD.check_in_scanned_at
         OR NEW.check_out_scanned_at IS DISTINCT FROM OLD.check_out_scanned_at) THEN
      RAISE EXCEPTION 'QR_SCAN_TIMESTAMP_IMMUTABLE: 원본 QR 스캔시각은 수정할 수 없습니다';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.protect_work_log_qr_scan_timestamps() OWNER TO postgres;

DROP TRIGGER IF EXISTS work_logs_protect_qr_scan_timestamps ON public.work_logs;
CREATE TRIGGER work_logs_protect_qr_scan_timestamps
BEFORE UPDATE OF check_in_scanned_at, check_out_scanned_at ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.protect_work_log_qr_scan_timestamps();

DROP TRIGGER IF EXISTS work_logs_protect_qr_scan_timestamps_insert ON public.work_logs;
CREATE TRIGGER work_logs_protect_qr_scan_timestamps_insert
BEFORE INSERT ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.protect_work_log_qr_scan_timestamps();

REVOKE ALL ON FUNCTION public.protect_work_log_qr_scan_timestamps()
  FROM PUBLIC, anon, authenticated;

-- QR뿐 아니라 관리자 수정·상태 변경 등 모든 쓰기 경로의 적용 시각을 같은 규칙으로 묶는다.
-- 기존 비정렬 값은 다른 필드를 고칠 때 건드리지 않고, 해당 시각이 새로 바뀔 때만 정규화한다.
CREATE OR REPLACE FUNCTION public.normalize_work_log_attendance_quarter_hour()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.check_in_ts IS NOT NULL THEN
    NEW.check_in_ts := to_timestamp(
      (ceil(EXTRACT(EPOCH FROM NEW.check_in_ts)::numeric / 900) * 900)::double precision
    );
  END IF;
  IF TG_OP = 'INSERT' AND NEW.check_out_ts IS NOT NULL THEN
    NEW.check_out_ts := to_timestamp(
      (ceil(EXTRACT(EPOCH FROM NEW.check_out_ts)::numeric / 900) * 900)::double precision
    );
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.check_in_ts IS DISTINCT FROM OLD.check_in_ts
     AND NEW.check_in_ts IS NOT NULL THEN
    NEW.check_in_ts := to_timestamp(
      (ceil(EXTRACT(EPOCH FROM NEW.check_in_ts)::numeric / 900) * 900)::double precision
    );
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.check_out_ts IS DISTINCT FROM OLD.check_out_ts
     AND NEW.check_out_ts IS NOT NULL THEN
    NEW.check_out_ts := to_timestamp(
      (ceil(EXTRACT(EPOCH FROM NEW.check_out_ts)::numeric / 900) * 900)::double precision
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS work_logs_attendance_quarter_hour ON public.work_logs;
CREATE TRIGGER work_logs_attendance_quarter_hour
BEFORE UPDATE OF check_in_ts, check_out_ts ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.normalize_work_log_attendance_quarter_hour();

DROP TRIGGER IF EXISTS work_logs_attendance_quarter_hour_insert ON public.work_logs;
CREATE TRIGGER work_logs_attendance_quarter_hour_insert
BEFORE INSERT ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.normalize_work_log_attendance_quarter_hour();

ALTER FUNCTION public.normalize_work_log_attendance_quarter_hour() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.normalize_work_log_attendance_quarter_hour()
  FROM PUBLIC, anon, authenticated;

-- 적용 시각이 바뀌면 저장형 파생값도 같은 행의 최종(15분 정규화) 값으로 다시 계산한다.
-- 트리거 이름을 zz_로 두어 같은 BEFORE 시점의 quarter-hour 트리거 뒤에 실행되게 한다.
CREATE OR REPLACE FUNCTION public.recompute_work_log_duration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.work_duration := CASE
    WHEN NEW.check_in_ts IS NULL OR NEW.check_out_ts IS NULL THEN NULL
    WHEN NEW.check_out_ts <= NEW.check_in_ts THEN 0
    ELSE round((extract(epoch FROM (NEW.check_out_ts - NEW.check_in_ts)) / 3600)::numeric, 2)
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS zz_work_logs_recompute_duration ON public.work_logs;
CREATE TRIGGER zz_work_logs_recompute_duration
BEFORE INSERT OR UPDATE OF check_in_ts, check_out_ts ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.recompute_work_log_duration();

ALTER FUNCTION public.recompute_work_log_duration() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.recompute_work_log_duration()
  FROM PUBLIC, anon, authenticated;

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
  v_scanned_at timestamptz := clock_timestamp();
  v_scheduled_start timestamptz;
  v_schedule_date text;
  v_base_time timestamptz;
  v_applied_time timestamptz;
  v_work_duration numeric := 0;
  v_was_no_show boolean := false;
  v_duration_minutes numeric;
  v_action text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_staff_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_work_log
  FROM public.work_logs
  WHERE id = p_work_log_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found');
  END IF;

  SELECT status INTO v_job_posting_status
  FROM public.job_postings
  WHERE id = p_job_posting_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;

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
  IF v_job_posting_status::text NOT IN ('active', 'container') THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;
  IF v_work_log.payroll_status::text = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  -- 구버전 앱의 auto 호출만 호환한다. 새 앱은 사용자가 출근/퇴근을 먼저 고른다.
  v_action := p_action;
  IF v_action = 'auto' THEN
    v_action := CASE
      WHEN v_work_log.status::text = 'checked_in' THEN 'checkOut'
      ELSE 'checkIn'
    END;
  END IF;

  IF v_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_checked_in');
    END IF;
    IF v_work_log.status::text = 'cancelled' THEN
      RETURN jsonb_build_object('success', false, 'error', 'work_log_cancelled');
    END IF;
    IF v_work_log.status::text = 'completed' THEN
      RETURN jsonb_build_object('success', false, 'error', 'work_log_completed');
    END IF;
    IF v_work_log.status::text NOT IN ('scheduled', 'no_show') THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_status_for_checkin');
    END IF;

    -- 일반 공고는 work_logs.date, 고정 공고는 스캔 당일(한국시각)과 time_slot의 첫 HH:mm을
    -- 관리자 설정 시작시각으로 본다. 레거시 비정상 값은 스캔시각만 사용한다.
    v_schedule_date := CASE
      WHEN v_work_log.date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN v_work_log.date
      ELSE to_char(v_scanned_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')
    END;
    IF v_work_log.time_slot ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]' THEN
      BEGIN
        v_scheduled_start :=
          (v_schedule_date || ' ' || left(v_work_log.time_slot, 5))::timestamp
          AT TIME ZONE 'Asia/Seoul';
      EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
        v_scheduled_start := NULL;
      END;
    END IF;

    v_base_time := CASE
      WHEN v_scheduled_start IS NULL THEN v_scanned_at
      ELSE GREATEST(v_scheduled_start, v_scanned_at)
    END;
    v_applied_time := to_timestamp(
      (ceil(EXTRACT(EPOCH FROM v_base_time)::numeric / 900) * 900)::double precision
    );
    v_was_no_show := (v_work_log.status::text = 'no_show');

    UPDATE public.work_logs SET
      status = 'checked_in',
      check_in_scanned_at = v_scanned_at,
      check_in_ts = v_applied_time,
      updated_at = v_scanned_at,
      modification_history = CASE
        WHEN v_was_no_show THEN COALESCE(modification_history, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'type', 'no_show_recovered_by_qr',
            'previousStatus', 'no_show',
            'newStatus', 'checked_in',
            'reason', 'QR 출근 스캔으로 노쇼가 해제되었습니다',
            'modifiedBy', p_staff_id,
            'modifiedAt', v_scanned_at
          )
        )
        ELSE modification_history
      END
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkIn',
      'scanned_at', v_scanned_at,
      'applied_time', v_applied_time,
      'check_in_time', v_applied_time,
      'work_duration', 0,
      'no_show_recovered', v_was_no_show
    );

  ELSIF v_action = 'checkOut' THEN
    IF v_work_log.status::text != 'checked_in' THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_checked_in');
    END IF;

    v_applied_time := to_timestamp(
      (ceil(EXTRACT(EPOCH FROM v_scanned_at)::numeric / 900) * 900)::double precision
    );

    IF v_work_log.check_in_ts IS NOT NULL AND v_applied_time <= v_work_log.check_in_ts THEN
      RETURN jsonb_build_object('success', false, 'error', 'checkout_too_early');
    END IF;

    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (v_applied_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;

    UPDATE public.work_logs SET
      status = 'checked_out',
      check_out_scanned_at = v_scanned_at,
      check_out_ts = v_applied_time,
      clocked_out_raw = v_scanned_at,
      end_time_source = 'qr',
      work_duration = v_work_duration,
      updated_at = v_scanned_at
    WHERE id = p_work_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'checkOut',
      'scanned_at', v_scanned_at,
      'applied_time', v_applied_time,
      'check_out_time', v_applied_time,
      'work_duration', v_work_duration,
      'requires_review', v_work_log.check_in_ts IS NULL OR v_applied_time <= v_work_log.check_in_ts
    );
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_action');
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text) IS
  '공고 QR 출퇴근 원자 처리. 원본 서버 스캔시각을 보존하고 적용 시각은 15분 단위로 올림한다.';

REVOKE ALL ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_qr_checkin_atomically(uuid, uuid, uuid, text, timestamptz, text)
  TO authenticated, service_role;

-- 자동 판별 QR의 조회 경로. 공고+스태프에서 출근 중 기록을 먼저 찾고, 없으면 서버 KST
-- 시각 기준 허용 창 안의 날짜별 근무를 찾는다. 앱 시계나 앱이 고른 action/date를 신뢰하지 않는다.
CREATE INDEX IF NOT EXISTS idx_work_logs_qr_attendance_lookup
  ON public.work_logs (job_posting_id, staff_id, status, date);

-- 새 쓰기부터는 15분 정규화 뒤에도 퇴근이 출근보다 반드시 늦어야 한다.
-- NOT VALID는 과거 오염 행 때문에 배포가 막히는 것을 피하면서 신규/수정 행은 즉시 보호한다.
ALTER TABLE public.work_logs
  ADD CONSTRAINT work_logs_checkout_after_checkin
  CHECK (check_out_ts IS NULL OR check_in_ts IS NULL OR check_out_ts > check_in_ts)
  NOT VALID;

CREATE OR REPLACE FUNCTION public.process_posting_qr_attendance(
  p_job_posting_id uuid,
  p_staff_id uuid,
  p_selected_work_log_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_scanned_at timestamptz := clock_timestamp();
  v_today text := to_char(v_scanned_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD');
  v_yesterday text := to_char(
    (v_scanned_at AT TIME ZONE 'Asia/Seoul') - interval '1 day',
    'YYYY-MM-DD'
  );
  v_posting_status text;
  v_candidate_count integer;
  v_candidates jsonb;
  v_work_log public.work_logs%ROWTYPE;
  v_action text;
  v_schedule_start timestamptz;
  v_applied_time timestamptz;
  v_duration_minutes numeric;
  v_work_duration numeric := 0;
  v_was_no_show boolean := false;
  v_template public.work_logs%ROWTYPE;
  v_occurrence_date text;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_staff_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT jp.status::text INTO v_posting_status
  FROM public.job_postings jp
  WHERE jp.id = p_job_posting_id;
  IF v_posting_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;
  IF v_posting_status NOT IN ('active', 'container') THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;

  -- 동일 사용자·공고의 동시 스캔과 고정 템플릿 occurrence 중복 생성을 직렬화한다.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_job_posting_id::text || ':' || p_staff_id::text, 0)
  );

  -- 고정 공고의 센티널 행은 템플릿으로만 남기고, 허용 창에 들어온 날짜 occurrence를 만든다.
  -- 오늘 01:00에 전날 23:00 근무를 시작하는 야간 사례까지 처리하기 위해 오늘/어제를 모두 본다.
  FOR v_template IN
    SELECT wl.*
    FROM public.work_logs wl
    WHERE wl.job_posting_id = p_job_posting_id
      AND wl.staff_id = p_staff_id
      AND wl.date = 'FIXED_SCHEDULE'
      AND COALESCE(wl.is_fixed_posting, false)
      AND wl.status::text IN ('scheduled', 'no_show')
      AND wl.time_slot ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]'
  LOOP
    FOREACH v_occurrence_date IN ARRAY ARRAY[v_today, v_yesterday]
    LOOP
      v_schedule_start :=
        (v_occurrence_date || ' ' || left(v_template.time_slot, 5))::timestamp
        AT TIME ZONE 'Asia/Seoul';
      IF v_scanned_at BETWEEN v_schedule_start - interval '2 hours'
                          AND v_schedule_start + interval '6 hours'
         AND NOT EXISTS (
           SELECT 1
           FROM public.work_logs occurrence
           WHERE occurrence.job_posting_id = p_job_posting_id
             AND occurrence.staff_id = p_staff_id
             AND occurrence.date = v_occurrence_date
             AND COALESCE(occurrence.is_fixed_posting, false)
             AND occurrence.application_id IS NOT DISTINCT FROM v_template.application_id
             AND occurrence.assignment_group_id IS NOT DISTINCT FROM v_template.assignment_group_id
             AND occurrence.time_slot IS NOT DISTINCT FROM v_template.time_slot
             AND occurrence.role IS NOT DISTINCT FROM v_template.role
             AND occurrence.custom_role IS NOT DISTINCT FROM v_template.custom_role
         ) THEN
        INSERT INTO public.work_logs (
          staff_id, job_posting_id, application_id, assignment_group_id, date,
          is_fixed_posting, staff_name, staff_nickname, staff_photo_url,
          staff_photo_url_blurhash, status, role, custom_role, payroll_status,
          custom_salary_info, custom_allowances, custom_tax_settings, notes,
          time_slot, owner_id, color
        ) VALUES (
          v_template.staff_id, v_template.job_posting_id, v_template.application_id,
          v_template.assignment_group_id, v_occurrence_date, true,
          v_template.staff_name, v_template.staff_nickname, v_template.staff_photo_url,
          v_template.staff_photo_url_blurhash, 'scheduled', v_template.role,
          v_template.custom_role, 'pending', v_template.custom_salary_info,
          v_template.custom_allowances, v_template.custom_tax_settings, v_template.notes,
          v_template.time_slot, v_template.owner_id, v_template.color
        );
      END IF;
    END LOOP;
  END LOOP;

  -- 1순위는 아직 유효한 출근 중 기록. 날짜가 넘어가도 최대 16시간까지 퇴근할 수 있다.
  WITH eligible AS (
    SELECT wl.*
    FROM public.work_logs wl
    WHERE wl.job_posting_id = p_job_posting_id
      AND wl.staff_id = p_staff_id
      AND wl.status::text = 'checked_in'
      AND wl.check_in_ts IS NOT NULL
      AND v_scanned_at >= wl.check_in_ts
      AND v_scanned_at <= wl.check_in_ts + interval '16 hours'
      AND wl.payroll_status::text <> 'completed'
  )
  SELECT count(*), COALESCE(
    jsonb_agg(jsonb_build_object(
      'workLogId', e.id,
      'date', e.date,
      'timeSlot', e.time_slot,
      'role', e.role,
      'customRole', e.custom_role,
      'action', 'checkOut'
    ) ORDER BY e.check_in_ts, e.id),
    '[]'::jsonb
  )
  INTO v_candidate_count, v_candidates
  FROM eligible e;

  IF v_candidate_count > 0 THEN
    v_action := 'checkOut';
  ELSE
    -- 출근은 예정 시작 2시간 전부터 6시간 후까지만 허용한다.
    WITH eligible AS (
      SELECT wl.*,
        ((wl.date || ' ' || left(wl.time_slot, 5))::timestamp AT TIME ZONE 'Asia/Seoul') AS scheduled_start
      FROM public.work_logs wl
      WHERE wl.job_posting_id = p_job_posting_id
        AND wl.staff_id = p_staff_id
        AND wl.date IN (v_today, v_yesterday)
        AND wl.status::text IN ('scheduled', 'no_show')
        AND wl.time_slot ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]'
        AND wl.payroll_status::text <> 'completed'
    ), in_window AS (
      SELECT * FROM eligible e
      WHERE v_scanned_at BETWEEN e.scheduled_start - interval '2 hours'
                              AND e.scheduled_start + interval '6 hours'
    )
    SELECT count(*), COALESCE(
      jsonb_agg(jsonb_build_object(
        'workLogId', e.id,
        'date', e.date,
        'timeSlot', e.time_slot,
        'role', e.role,
        'customRole', e.custom_role,
        'action', 'checkIn'
      ) ORDER BY abs(extract(epoch FROM (v_scanned_at - e.scheduled_start))), e.id),
      '[]'::jsonb
    )
    INTO v_candidate_count, v_candidates
    FROM in_window e;
    v_action := 'checkIn';
  END IF;

  IF v_candidate_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_eligible_work_log');
  END IF;
  IF v_candidate_count > 1 AND p_selected_work_log_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'selection_required',
      'requires_selection', true,
      'candidates', v_candidates
    );
  END IF;

  SELECT wl.* INTO v_work_log
  FROM public.work_logs wl
  WHERE wl.id = COALESCE(
    p_selected_work_log_id,
    (v_candidates -> 0 ->> 'workLogId')::uuid
  )
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_candidates) candidate
      WHERE candidate ->> 'workLogId' = wl.id::text
    )
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_selection');
  END IF;

  IF v_action = 'checkIn' THEN
    v_schedule_start :=
      (v_work_log.date || ' ' || left(v_work_log.time_slot, 5))::timestamp
      AT TIME ZONE 'Asia/Seoul';
    v_applied_time := to_timestamp(
      (ceil(extract(epoch FROM greatest(v_schedule_start, v_scanned_at))::numeric / 900) * 900)::double precision
    );
    v_was_no_show := v_work_log.status::text = 'no_show';

    UPDATE public.work_logs SET
      status = 'checked_in',
      check_in_scanned_at = v_scanned_at,
      check_in_ts = v_applied_time,
      updated_at = v_scanned_at,
      modification_history = CASE WHEN v_was_no_show THEN
        COALESCE(modification_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'type', 'no_show_recovered_by_qr',
          'previousStatus', 'no_show',
          'newStatus', 'checked_in',
          'reason', 'QR 출근 스캔으로 노쇼가 해제되었습니다',
          'modifiedBy', p_staff_id,
          'modifiedAt', v_scanned_at
        )) ELSE modification_history END
    WHERE id = v_work_log.id;
  ELSE
    v_applied_time := to_timestamp(
      (ceil(extract(epoch FROM v_scanned_at)::numeric / 900) * 900)::double precision
    );
    IF v_applied_time <= v_work_log.check_in_ts THEN
      RETURN jsonb_build_object('success', false, 'error', 'checkout_too_early');
    END IF;
    v_duration_minutes := extract(epoch FROM (v_applied_time - v_work_log.check_in_ts)) / 60;
    v_work_duration := round((v_duration_minutes / 60)::numeric * 100) / 100;

    UPDATE public.work_logs SET
      status = 'checked_out',
      check_out_scanned_at = v_scanned_at,
      check_out_ts = v_applied_time,
      end_time_source = 'qr',
      work_duration = v_work_duration,
      updated_at = v_scanned_at
    WHERE id = v_work_log.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'work_log_id', v_work_log.id,
    'assignment_group_id', v_work_log.assignment_group_id,
    'date', v_work_log.date,
    'time_slot', v_work_log.time_slot,
    'action', v_action,
    'scanned_at', v_scanned_at,
    'applied_time', v_applied_time,
    'work_duration', v_work_duration,
    'no_show_recovered', v_was_no_show
  );
END;
$function$;

COMMENT ON FUNCTION public.process_posting_qr_attendance(uuid, uuid, uuid) IS
  '공고별 고정 QR 자동 출퇴근. 서버가 날짜·허용창·현재 상태를 판별하고 다중 후보만 선택 요청한다.';

ALTER FUNCTION public.process_posting_qr_attendance(uuid, uuid, uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.process_posting_qr_attendance(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_posting_qr_attendance(uuid, uuid, uuid)
  TO authenticated, service_role;

-- 기존 원본 퇴근값을 새 정본으로 한 번만 이관한다. clocked_out_raw는 구버전 앱 호환용으로
-- 남겨 두되 새 자동 QR 경로는 check_out_scanned_at만 기록한다.
UPDATE public.work_logs
SET check_out_scanned_at = clocked_out_raw
WHERE check_out_scanned_at IS NULL
  AND clocked_out_raw IS NOT NULL;

COMMENT ON COLUMN public.work_logs.clocked_out_raw IS
  'Deprecated: 구버전 QR 호환 컬럼. 원본 퇴근시각 정본은 check_out_scanned_at.';

-- 관리자 근무표에서도 원본 스캔시각을 볼 수 있도록 read model을 함께 확장한다.
DROP FUNCTION public.get_venue_day_slots(uuid, text);
CREATE FUNCTION public.get_venue_day_slots(p_venue uuid, p_date text)
RETURNS TABLE(
  work_log_id uuid,
  staff_id uuid,
  staff_name text,
  staff_nickname text,
  staff_photo_url text,
  role text,
  custom_role text,
  time_slot text,
  status text,
  job_posting_id uuid,
  is_container boolean,
  color text,
  notes text,
  check_in_ts timestamptz,
  check_out_ts timestamptz,
  payroll_status text,
  date text,
  check_in_scanned_at timestamptz,
  check_out_scanned_at timestamptz,
  modification_history jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ws uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  SELECT jp.workspace_id INTO v_ws
  FROM public.job_postings jp
  WHERE jp.id = p_venue AND jp.status = 'container';
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'VENUE_NOT_FOUND: %', p_venue;
  END IF;
  IF NOT (public.is_workspace_member(v_ws, auth.uid()) OR public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 워크스페이스 권한이 없습니다';
  END IF;

  RETURN QUERY
  SELECT
    wl.id,
    wl.staff_id,
    wl.staff_name,
    wl.staff_nickname,
    wl.staff_photo_url,
    wl.role::text,
    wl.custom_role,
    wl.time_slot,
    wl.status::text,
    wl.job_posting_id,
    wl.job_posting_id = p_venue,
    wl.color,
    wl.notes,
    wl.check_in_ts,
    wl.check_out_ts,
    wl.payroll_status::text,
    wl.date,
    wl.check_in_scanned_at,
    wl.check_out_scanned_at,
    COALESCE(wl.modification_history, '[]'::jsonb)
  FROM public.work_logs wl
  WHERE wl.job_posting_id IN (
      SELECT jp.id FROM public.job_postings jp
      WHERE jp.id IN (SELECT public.venue_span_posting_ids(p_venue))
        AND jp.workspace_id = v_ws
    )
    AND wl.date = p_date
    AND wl.status NOT IN ('cancelled', 'no_show')
  ORDER BY wl.time_slot NULLS LAST, wl.staff_name;
END;
$function$;

ALTER FUNCTION public.get_venue_day_slots(uuid, text) OWNER TO postgres;
COMMENT ON FUNCTION public.get_venue_day_slots(uuid, text) IS
  '운영처 하루 슬롯. 적용 출퇴근, 변경 불가 QR 원본 스캔시각, 관리자 수정 이력을 반환한다.';
REVOKE ALL ON FUNCTION public.get_venue_day_slots(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_day_slots(uuid, text)
  TO authenticated, service_role;
