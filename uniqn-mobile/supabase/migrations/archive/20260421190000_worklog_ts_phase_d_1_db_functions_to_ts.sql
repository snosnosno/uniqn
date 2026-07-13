-- work_logs timestamptz 전환 Phase D.1 (비파괴)
-- 목표: jsonb 컬럼에 의존하는 DB 함수를 timestamptz 기반으로 refactor
--       최종 DROP COLUMN 직전까지 dual-state (컬럼은 남아 있지만 함수는 ts 만 사용)
-- 참조: docs/superpowers/plans/2026-04-21-worklog-timestamptz-phase-d.md Task 1

-- 1. _fmt_worklog_time 을 timestamptz 오버로드로 재정의
CREATE OR REPLACE FUNCTION public._fmt_worklog_time(p_ts timestamptz)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = 'public'
AS $$
BEGIN
  IF p_ts IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN to_char(p_ts AT TIME ZONE 'Asia/Seoul', 'HH24:MI');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public._fmt_worklog_time(timestamptz) IS
  'work_logs.check_in_ts 등 timestamptz 를 Asia/Seoul HH:MM 으로 포맷. NULL 입력 → NULL.';

-- 2. notify_on_work_log_checkinout_update 를 check_in_ts/check_out_ts 로 전환
CREATE OR REPLACE FUNCTION public.notify_on_work_log_checkinout_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_did_check_in boolean;
  v_did_check_out boolean;
  v_staff_name text;
  v_employer_id uuid;
  v_job_title text;
  v_job_posting_id uuid;
  v_check_in_display text;
  v_check_out_display text;
  v_base_data jsonb;
BEGIN
  v_did_check_in := OLD.check_in_ts IS NULL AND NEW.check_in_ts IS NOT NULL;
  v_did_check_out := OLD.check_out_ts IS NULL AND NEW.check_out_ts IS NOT NULL;

  IF NOT v_did_check_in AND NOT v_did_check_out THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(nickname, ''), NULLIF(name, ''), '스태프')
    INTO v_staff_name
  FROM public.users
  WHERE id = NEW.staff_id;
  v_staff_name := COALESCE(v_staff_name, '스태프');

  SELECT jp.owner_id, jp.title, jp.id
    INTO v_employer_id, v_job_title, v_job_posting_id
  FROM public.job_postings jp
  WHERE jp.id = NEW.job_posting_id;

  v_base_data := jsonb_build_object(
    'workLogId', NEW.id,
    'staffId', NEW.staff_id,
    'staffName', v_staff_name,
    'jobPostingId', v_job_posting_id,
    'jobPostingTitle', COALESCE(v_job_title, '근무')
  );

  IF v_did_check_in THEN
    v_check_in_display := public._fmt_worklog_time(NEW.check_in_ts);

    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'work_log_check_in',
      '✅ 출근 확인',
      COALESCE(format('%s 출근 처리되었습니다. (%s)', v_job_title, v_check_in_display),
               '출근 처리되었습니다.'),
      format('/schedule/%s', NEW.id),
      v_base_data || jsonb_build_object('checkInTime', NEW.check_in_ts),
      'normal'
    );

    IF v_employer_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'work_log_check_in',
        '✅ 스태프 출근',
        COALESCE(format('%s 님이 %s 에 출근했습니다. (%s)', v_staff_name, v_job_title, v_check_in_display),
                 '스태프가 출근했습니다.'),
        format('/jobs/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkInTime', NEW.check_in_ts),
        'normal'
      );
    END IF;
  END IF;

  IF v_did_check_out THEN
    v_check_out_display := public._fmt_worklog_time(NEW.check_out_ts);

    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'work_log_check_out',
      '🏁 퇴근 확인',
      COALESCE(format('%s 퇴근 처리되었습니다. (%s)', v_job_title, v_check_out_display),
               '퇴근 처리되었습니다.'),
      format('/schedule/%s', NEW.id),
      v_base_data || jsonb_build_object('checkOutTime', NEW.check_out_ts),
      'normal'
    );

    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    VALUES (
      NEW.staff_id,
      'review_request',
      '📝 평가 요청',
      COALESCE(format('%s 근무에 대해 평가해주세요.', v_job_title), '근무 평가를 남겨주세요.'),
      format('/reviews/%s', NEW.id),
      v_base_data || jsonb_build_object('reviewerType', 'staff'),
      'normal'
    );

    IF v_employer_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'work_log_check_out',
        '🏁 스태프 퇴근',
        COALESCE(format('%s 님이 %s 에 퇴근했습니다. (%s)', v_staff_name, v_job_title, v_check_out_display),
                 '스태프가 퇴근했습니다.'),
        format('/jobs/%s', v_job_posting_id),
        v_base_data || jsonb_build_object('checkOutTime', NEW.check_out_ts),
        'normal'
      );

      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_employer_id,
        'review_request',
        '📝 스태프 평가 요청',
        COALESCE(format('%s 근무의 스태프를 평가해주세요.', v_job_title),
                 '스태프 평가를 남겨주세요.'),
        format('/reviews/%s', NEW.id),
        v_base_data || jsonb_build_object('reviewerType', 'employer'),
        'normal'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_work_log_checkinout_update() IS
  'check_in_ts/check_out_ts null→non-null 전환 시 스태프+구인자 알림 (Phase D.1 ts 전환).';

-- 3. work_logs UPDATE trigger 재연결 (UPDATE OF 컬럼도 ts 로 전환)
DROP TRIGGER IF EXISTS tr_notify_work_log_checkinout ON public.work_logs;
CREATE TRIGGER tr_notify_work_log_checkinout
AFTER UPDATE OF check_in_ts, check_out_ts
ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_work_log_checkinout_update();

-- 4. fn_send_review_reminders 를 check_out_ts 기반으로 전환
CREATE OR REPLACE FUNCTION public.fn_send_review_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_inserted integer;
  v_target_start timestamptz;
  v_target_end timestamptz;
BEGIN
  v_target_start := (now() - INTERVAL '5 days')::date;
  v_target_end := v_target_start + INTERVAL '1 day';

  WITH target_work_logs AS (
    SELECT
      wl.id AS work_log_id,
      wl.staff_id,
      wl.job_posting_id,
      jp.title AS job_title,
      jp.owner_id AS employer_id
    FROM public.work_logs wl
    JOIN public.job_postings jp ON jp.id = wl.job_posting_id
    WHERE wl.check_out_ts IS NOT NULL
      AND wl.check_out_ts >= v_target_start
      AND wl.check_out_ts < v_target_end
  ),
  existing_reviews AS (
    SELECT work_log_id, reviewer_type
    FROM public.reviews
    WHERE work_log_id IN (SELECT work_log_id FROM target_work_logs)
  ),
  staff_reminders AS (
    SELECT
      twl.staff_id AS recipient_id,
      'review_reminder'::text AS type,
      '📝 평가 리마인더'::text AS title,
      format('%s 근무에 대한 평가가 아직 작성되지 않았습니다.',
             COALESCE(NULLIF(twl.job_title, ''), '근무')) AS body,
      format('/reviews/%s', twl.work_log_id) AS link,
      jsonb_build_object(
        'workLogId', twl.work_log_id,
        'jobPostingId', twl.job_posting_id,
        'jobPostingTitle', COALESCE(twl.job_title, ''),
        'reviewerType', 'staff'
      ) AS data
    FROM target_work_logs twl
    WHERE twl.staff_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM existing_reviews er
        WHERE er.work_log_id = twl.work_log_id AND er.reviewer_type = 'staff'
      )
  ),
  employer_reminders AS (
    SELECT
      twl.employer_id AS recipient_id,
      'review_reminder'::text AS type,
      '📝 평가 리마인더'::text AS title,
      format('%s 근무의 스태프 평가가 아직 작성되지 않았습니다.',
             COALESCE(NULLIF(twl.job_title, ''), '근무')) AS body,
      format('/reviews/%s', twl.work_log_id) AS link,
      jsonb_build_object(
        'workLogId', twl.work_log_id,
        'jobPostingId', twl.job_posting_id,
        'jobPostingTitle', COALESCE(twl.job_title, ''),
        'reviewerType', 'employer'
      ) AS data
    FROM target_work_logs twl
    WHERE twl.employer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM existing_reviews er
        WHERE er.work_log_id = twl.work_log_id AND er.reviewer_type = 'employer'
      )
  ),
  all_reminders AS (
    SELECT * FROM staff_reminders
    UNION ALL
    SELECT * FROM employer_reminders
  ),
  inserted AS (
    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    SELECT recipient_id, type, title, body, link, data, 'normal'
    FROM all_reminders
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  IF v_inserted > 0 THEN
    RAISE NOTICE '[send_review_reminders] inserted % reminders', v_inserted;
  END IF;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.fn_send_review_reminders() IS
  '퇴근 5일 후 미작성 리뷰 리마인더 발송 (Phase D.1 check_out_ts 기반).';

-- 5. process_qr_checkin_atomically 를 ts-only 로 전환 (jsonb 쓰기 제거)
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
  SELECT * INTO v_work_log
  FROM work_logs
  WHERE id = p_work_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'work_log_not_found');
  END IF;

  SELECT status INTO v_job_posting_status
  FROM job_postings
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

  IF v_job_posting_status::text != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'job_posting_inactive');
  END IF;

  IF v_work_log.payroll_status::text = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  IF p_action = 'checkIn' THEN
    IF v_work_log.status::text IN ('checked_in', 'checked_out') THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_checked_in');
    END IF;

    UPDATE work_logs SET
      status = 'checked_in',
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

    IF v_work_log.check_in_ts IS NOT NULL THEN
      v_duration_minutes := EXTRACT(EPOCH FROM (p_check_time - v_work_log.check_in_ts)) / 60;
      v_work_duration := GREATEST(0, ROUND((v_duration_minutes / 60)::numeric * 100) / 100);
    END IF;

    UPDATE work_logs SET
      status = 'checked_out',
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
) IS 'Phase D.1: ts-only write. jsonb check_in_time/check_out_time 쓰기 제거. Phase D.3 에서 jsonb 컬럼 DROP 예정.';
