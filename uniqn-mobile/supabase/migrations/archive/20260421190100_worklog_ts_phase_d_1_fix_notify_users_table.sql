-- Phase D.1 fix-up: notify_on_work_log_checkinout_update users 컬럼 수정
-- 직전 migration 에서 user_profiles / full_name 로 잘못 참조했던 부분을 public.users + nickname/name 으로 교정.
-- DB state 는 이미 execute_sql 로 교정됨. 이 migration 은 record 정합성 유지용.

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
  'check_in_ts/check_out_ts null→non-null 전환 시 스태프+구인자 알림 (Phase D.1 fix-up: public.users nickname/name).';
