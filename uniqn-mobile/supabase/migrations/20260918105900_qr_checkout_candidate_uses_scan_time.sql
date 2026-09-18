-- QR 퇴근 후보 구간의 하한을 "원본 스캔 시각"으로 옮긴다.
--
-- 결함: 20260909135618 의 15분 정규화가 check_in_ts 를 **올림(ceil)** 하므로 출근 직후
--   check_in_ts 는 실제 스캔 시각보다 최대 15분 **미래**다. 그런데 자동 분기의 퇴근 후보
--   조건이 `v_scanned_at BETWEEN wl.check_in_ts AND wl.check_in_ts + 16h` 라서, 그 15분
--   동안 후보가 0건이 되고 checkIn 분기(status in ('scheduled','no_show'))도 0건이라
--   `no_eligible_work_log` 가 반환된다. 즉 스태프는 출근 직후 최대 15분간
--   "잠시 후 다시 시도"가 아니라 **"해당 근무가 없습니다"** 를 본다.
--   `checkout_too_early` 는 p_selected_work_log_id 명시 분기에만 존재해 자동 경로에서
--   사실상 도달 불가였다.
--
-- 원인 정리: `check_in_ts` 는 **정산용 시각**(15분 단위로 반올림된 값)이고,
--   `check_in_scanned_at` 은 **실제로 찍은 시각**이다. 후보 수집("지금 이 사람이 퇴근
--   스캔할 대상이 있는가")은 후자를 기준으로 해야 한다 — 두 용도를 한 컬럼으로 섞은 것이
--   결함의 뿌리다.
--
-- 조치: 후보 구간 하한만 `COALESCE(wl.check_in_scanned_at, wl.check_in_ts)` 로 교체한다.
--   상한(+16h)은 정산 기준 시각을 그대로 쓴다(근무 길이 상한의 의미이므로).
--   QR 이 아닌 수동 출근 행은 check_in_scanned_at 이 NULL 이므로 COALESCE 로 종전 동작을
--   유지한다. 이 한 줄 외에 함수 본문은 20260910123553 과 동일하다.
--
-- `CREATE OR REPLACE FUNCTION` 은 소유자·ACL·SECURITY 속성을 보존하므로 시그니처가 같은
-- 이 교체에는 DROP/재부여가 필요 없다(20260915122335 와 같은 패턴).

CREATE OR REPLACE FUNCTION public.process_posting_qr_attendance(
  p_job_posting_id uuid,
  p_staff_id uuid,
  p_selected_work_log_id uuid DEFAULT NULL,
  p_selection_token uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_scanned_at timestamptz := clock_timestamp();
  v_now timestamptz := v_scanned_at;
  v_today text;
  v_yesterday text;
  v_posting_status text;
  v_candidate_count integer;
  v_candidates jsonb;
  v_work_log public.work_logs%ROWTYPE;
  v_action text;
  v_schedule_start timestamptz;
  v_applied_time timestamptz;
  v_work_duration numeric := 0;
  v_was_no_show boolean := false;
  v_template public.work_logs%ROWTYPE;
  v_occurrence_date text;
  v_selection_token uuid;
BEGIN
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_staff_id AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT jp.status::text INTO v_posting_status
  FROM public.job_postings jp WHERE jp.id = p_job_posting_id;
  IF v_posting_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_not_found');
  END IF;
  IF v_posting_status NOT IN ('active', 'container') THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_job_posting_id::text || ':' || p_staff_id::text, 0)
  );

  IF p_selected_work_log_id IS NOT NULL THEN
    DELETE FROM public.qr_attendance_selections selection_context
    WHERE selection_context.token = p_selection_token
      AND selection_context.job_posting_id = p_job_posting_id
      AND selection_context.staff_id = p_staff_id
      AND selection_context.expires_at >= v_now
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(selection_context.candidates) candidate
        WHERE candidate->>'workLogId' = p_selected_work_log_id::text
      )
    RETURNING selection_context.scanned_at, selection_context.candidates
    INTO v_scanned_at, v_candidates;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_selection');
    END IF;
  END IF;

  v_today := to_char(v_scanned_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD');
  v_yesterday := to_char(
    (v_scanned_at AT TIME ZONE 'Asia/Seoul') - interval '1 day', 'YYYY-MM-DD'
  );

  FOR v_template IN
    SELECT wl.* FROM public.work_logs wl
    WHERE wl.job_posting_id = p_job_posting_id
      AND wl.staff_id = p_staff_id
      AND wl.date = 'FIXED_SCHEDULE'
      AND COALESCE(wl.is_fixed_posting, false)
      AND wl.status::text IN ('scheduled', 'no_show')
      AND wl.time_slot ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]'
  LOOP
    FOREACH v_occurrence_date IN ARRAY ARRAY[v_today, v_yesterday] LOOP
      v_schedule_start :=
        (v_occurrence_date || ' ' || left(v_template.time_slot, 5))::timestamp
        AT TIME ZONE 'Asia/Seoul';
      IF v_scanned_at BETWEEN v_schedule_start - interval '2 hours'
                          AND v_schedule_start + interval '6 hours'
         AND NOT EXISTS (
           SELECT 1 FROM public.work_logs occurrence
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

  IF p_selected_work_log_id IS NULL THEN
    WITH eligible AS (
      SELECT wl.* FROM public.work_logs wl
      WHERE wl.job_posting_id = p_job_posting_id
        AND wl.staff_id = p_staff_id
        AND wl.status::text = 'checked_in'
        AND wl.check_in_ts IS NOT NULL
        AND v_scanned_at BETWEEN COALESCE(wl.check_in_scanned_at, wl.check_in_ts)
                            AND wl.check_in_ts + interval '16 hours'
        AND wl.payroll_status IS DISTINCT FROM 'completed'::public.payroll_status
    )
    SELECT count(*), COALESCE(jsonb_agg(jsonb_build_object(
      'workLogId', e.id, 'date', e.date, 'timeSlot', e.time_slot, 'role', e.role,
      'customRole', e.custom_role, 'action', 'checkOut'
    ) ORDER BY e.check_in_ts, e.id), '[]'::jsonb)
    INTO v_candidate_count, v_candidates FROM eligible e;

    IF v_candidate_count > 0 THEN
      v_action := 'checkOut';
    ELSE
      WITH eligible AS (
        SELECT wl.*,
          ((wl.date || ' ' || left(wl.time_slot, 5))::timestamp AT TIME ZONE 'Asia/Seoul') scheduled_start
        FROM public.work_logs wl
        WHERE wl.job_posting_id = p_job_posting_id
          AND wl.staff_id = p_staff_id
          AND wl.date IN (v_today, v_yesterday)
          AND wl.status::text IN ('scheduled', 'no_show')
          AND wl.time_slot ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]'
          AND wl.payroll_status IS DISTINCT FROM 'completed'::public.payroll_status
      ), in_window AS (
        SELECT * FROM eligible e
        WHERE v_scanned_at BETWEEN e.scheduled_start - interval '2 hours'
                                AND e.scheduled_start + interval '6 hours'
      )
      SELECT count(*), COALESCE(jsonb_agg(jsonb_build_object(
        'workLogId', e.id, 'date', e.date, 'timeSlot', e.time_slot, 'role', e.role,
        'customRole', e.custom_role, 'action', 'checkIn'
      ) ORDER BY abs(extract(epoch FROM (v_scanned_at - e.scheduled_start))), e.id), '[]'::jsonb)
      INTO v_candidate_count, v_candidates FROM in_window e;
      v_action := 'checkIn';
    END IF;

    IF v_candidate_count = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'no_eligible_work_log');
    END IF;
    IF v_candidate_count > 1 THEN
      DELETE FROM public.qr_attendance_selections
      WHERE staff_id = p_staff_id AND job_posting_id = p_job_posting_id;
      INSERT INTO public.qr_attendance_selections (
        job_posting_id, staff_id, scanned_at, candidates, expires_at
      ) VALUES (
        p_job_posting_id, p_staff_id, v_scanned_at, v_candidates, v_now + interval '5 minutes'
      ) RETURNING token INTO v_selection_token;
      RETURN jsonb_build_object(
        'success', false, 'error', 'selection_required', 'requires_selection', true,
        'selection_token', v_selection_token, 'candidates', v_candidates
      );
    END IF;
    p_selected_work_log_id := (v_candidates -> 0 ->> 'workLogId')::uuid;
  END IF;

  SELECT wl.* INTO v_work_log FROM public.work_logs wl
  WHERE wl.id = p_selected_work_log_id
    AND wl.job_posting_id = p_job_posting_id
    AND wl.staff_id = p_staff_id
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_candidates) candidate
      WHERE candidate->>'workLogId' = wl.id::text
    )
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_selection');
  END IF;

  v_action := COALESCE(v_candidates->0->>'action', 'checkIn');
  SELECT candidate->>'action' INTO v_action
  FROM jsonb_array_elements(v_candidates) candidate
  WHERE candidate->>'workLogId' = v_work_log.id::text;

  IF v_action = 'checkIn' THEN
    IF v_work_log.status::text NOT IN ('scheduled', 'no_show') THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_selection');
    END IF;
    v_schedule_start :=
      (v_work_log.date || ' ' || left(v_work_log.time_slot, 5))::timestamp
      AT TIME ZONE 'Asia/Seoul';
    v_applied_time := to_timestamp(
      (ceil(extract(epoch FROM greatest(v_schedule_start, v_scanned_at))::numeric / 900) * 900)::double precision
    );
    v_was_no_show := v_work_log.status::text = 'no_show';
    UPDATE public.work_logs SET
      status = 'checked_in', check_in_scanned_at = v_scanned_at,
      check_in_ts = v_applied_time, updated_at = v_now,
      modification_history = CASE WHEN v_was_no_show THEN
        COALESCE(modification_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'type', 'no_show_recovered_by_qr', 'previousStatus', 'no_show',
          'newStatus', 'checked_in', 'reason', 'QR 출근 스캔으로 노쇼가 해제되었습니다',
          'modifiedBy', p_staff_id, 'modifiedAt', v_now
        )) ELSE modification_history END
    WHERE id = v_work_log.id;
  ELSE
    IF v_work_log.status::text <> 'checked_in' OR v_work_log.check_in_ts IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_selection');
    END IF;
    v_applied_time := to_timestamp(
      (ceil(extract(epoch FROM v_scanned_at)::numeric / 900) * 900)::double precision
    );
    IF v_applied_time <= v_work_log.check_in_ts THEN
      RETURN jsonb_build_object('success', false, 'error', 'checkout_too_early');
    END IF;
    v_work_duration := round(
      (extract(epoch FROM (v_applied_time - v_work_log.check_in_ts)) / 3600)::numeric, 2
    );
    UPDATE public.work_logs SET
      status = 'checked_out', check_out_scanned_at = v_scanned_at,
      check_out_ts = v_applied_time, end_time_source = 'qr',
      work_duration = v_work_duration, updated_at = v_now
    WHERE id = v_work_log.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'work_log_id', v_work_log.id,
    'assignment_group_id', v_work_log.assignment_group_id, 'date', v_work_log.date,
    'time_slot', v_work_log.time_slot, 'action', v_action,
    'scanned_at', v_scanned_at, 'applied_time', v_applied_time,
    'work_duration', v_work_duration, 'no_show_recovered', v_was_no_show
  );
END;
$function$;
