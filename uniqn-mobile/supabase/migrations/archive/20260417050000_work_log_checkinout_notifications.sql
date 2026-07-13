-- =============================================================================
-- Migration: WorkLog 출퇴근/노쇼 알림 트리거 (Phase 2-bis)
-- =============================================================================
-- 목적:
--   onCheckInOut, onNoShow를 PostgreSQL trigger로 재구현.
--   check_in_time / check_out_time / no_show_at은 jsonb 컬럼이지만 ISO 문자열을
--   그대로 저장하므로 null → non-null 전환 감지로 동등 구현 가능.
--
-- 매핑:
--   onCheckInOut (Firestore onUpdate workLogs)
--     → notify_on_work_log_checkinout_update
--        - check_in_time null → non-null: staff + employer 양쪽 알림
--        - check_out_time null → non-null: staff + employer 양쪽 + 양쪽에 review_request
--   onNoShow (Firestore onUpdate workLogs)
--     → notify_on_work_log_no_show_update
--        - no_show_at null → non-null: employer 'no_show_alert' (urgent)
--
-- 정책:
--   - 기존 notify_on_work_log_update 트리거와 독립. 같은 AFTER UPDATE에 별도 등록.
--   - jsonb 파싱: (col #>> '{}') 또는 col ->> 없이 jsonb value의 text 캐스팅.
--     저장 값이 "2026-04-17T..." 형태의 문자열이므로 jsonb_typeof로 안전 추출.
-- =============================================================================

-- ============================================================
-- 헬퍼: jsonb 타임스탬프 → HH:MM 문자열 (Asia/Seoul)
-- ============================================================
-- STABLE: Asia/Seoul 타임존 변환이 tzdata / 서버 설정에 의존하므로
-- IMMUTABLE 부적절. 트리거 호출마다 재평가 허용.
CREATE OR REPLACE FUNCTION public._fmt_worklog_time(v jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
  v_text text;
  v_ts timestamptz;
BEGIN
  IF v IS NULL THEN
    RETURN '';
  END IF;

  -- jsonb string → plain text
  IF jsonb_typeof(v) = 'string' THEN
    v_text := v #>> '{}';
  ELSE
    RETURN '';
  END IF;

  BEGIN
    v_ts := v_text::timestamptz;
    RETURN to_char(v_ts AT TIME ZONE 'Asia/Seoul', 'HH24:MI');
  EXCEPTION WHEN OTHERS THEN
    RETURN v_text;  -- 캐스팅 실패 시 원본 반환
  END;
END;
$$;


-- ============================================================
-- 1. work_logs UPDATE: check_in_time / check_out_time 전환 알림
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_work_log_checkinout_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_did_check_in boolean;
  v_did_check_out boolean;
  v_job_title text;
  v_owner_id uuid;
  v_staff_name text;
  v_job_label text;
  v_check_in_display text;
  v_check_out_display text;
  v_base_data jsonb;
BEGIN
  v_did_check_in := OLD.check_in_time IS NULL AND NEW.check_in_time IS NOT NULL;
  v_did_check_out := OLD.check_out_time IS NULL AND NEW.check_out_time IS NOT NULL;

  IF NOT v_did_check_in AND NOT v_did_check_out THEN
    RETURN NEW;
  END IF;

  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  SELECT COALESCE(NULLIF(nickname, ''), NULLIF(name, ''), '스태프')
    INTO v_staff_name
  FROM public.users
  WHERE id = NEW.staff_id;
  v_staff_name := COALESCE(v_staff_name, '스태프');

  v_job_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당 근무'
    ELSE format('''%s''', v_job_title)
  END;

  v_base_data := jsonb_build_object(
    'workLogId', NEW.id,
    'jobPostingId', NEW.job_posting_id,
    'jobPostingTitle', COALESCE(v_job_title, ''),
    'date', COALESCE(NEW.date, '')
  );

  -- ============ 출근 ============
  IF v_did_check_in THEN
    v_check_in_display := public._fmt_worklog_time(NEW.check_in_time);

    -- 스태프: 출근 확인
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'check_in_confirmed',
      '출근 확인',
      format('%s 출근이 %s에 기록되었습니다.', v_job_label, v_check_in_display),
      '/schedule',
      v_base_data || jsonb_build_object('checkTime', v_check_in_display),
      'normal'
    );

    -- 구인자: 출근 알림
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id, type, title, body, link, data, priority
      ) VALUES (
        v_owner_id,
        'staff_checked_in',
        '출근 알림',
        format('%s님이 %s에 출근했습니다.', v_staff_name, v_check_in_display),
        format('/employer/applicants/%s', NEW.job_posting_id),
        v_base_data || jsonb_build_object(
          'staffId', NEW.staff_id,
          'staffName', v_staff_name,
          'checkTime', v_check_in_display,
          'senderId', NEW.staff_id
        ),
        'normal'
      );
    END IF;
  END IF;

  -- ============ 퇴근 ============
  IF v_did_check_out THEN
    v_check_out_display := public._fmt_worklog_time(NEW.check_out_time);

    -- 스태프: 퇴근 확인
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'check_out_confirmed',
      '퇴근 확인',
      format('%s 퇴근이 %s에 기록되었습니다.', v_job_label, v_check_out_display),
      '/schedule',
      v_base_data || jsonb_build_object('checkTime', v_check_out_display),
      'normal'
    );

    -- 구인자: 퇴근 알림
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id, type, title, body, link, data, priority
      ) VALUES (
        v_owner_id,
        'staff_checked_out',
        '퇴근 알림',
        format('%s님이 %s에 퇴근했습니다.', v_staff_name, v_check_out_display),
        format('/employer/applicants/%s', NEW.job_posting_id),
        v_base_data || jsonb_build_object(
          'staffId', NEW.staff_id,
          'staffName', v_staff_name,
          'checkTime', v_check_out_display,
          'senderId', NEW.staff_id
        ),
        'normal'
      );
    END IF;

    -- 스태프: 평가 요청
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'review_request',
      '평가 요청',
      format('%s 근무가 완료되었습니다. 평가를 남겨주세요.', v_job_label),
      format('/reviews/%s', NEW.id),
      v_base_data,
      'normal'
    );

    -- 구인자: 평가 요청
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id, type, title, body, link, data, priority
      ) VALUES (
        v_owner_id,
        'review_request',
        '평가 요청',
        format('%s 근무가 완료되었습니다. %s님에 대한 평가를 남겨주세요.', v_job_label, v_staff_name),
        format('/reviews/%s', NEW.id),
        v_base_data || jsonb_build_object(
          'staffName', v_staff_name,
          'senderId', NEW.staff_id
        ),
        'normal'
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_checkinout_update] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_log_notify_checkinout_update ON public.work_logs;
CREATE TRIGGER work_log_notify_checkinout_update
AFTER UPDATE ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_work_log_checkinout_update();


-- ============================================================
-- 2. work_logs UPDATE: no_show_at 전환 → 구인자 urgent 알림
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_work_log_no_show_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_staff_name text;
BEGIN
  -- null → non-null 전환만 처리
  IF OLD.no_show_at IS NOT NULL OR NEW.no_show_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(nickname, ''), NULLIF(name, ''), '스태프')
    INTO v_staff_name
  FROM public.users
  WHERE id = NEW.staff_id;
  v_staff_name := COALESCE(v_staff_name, '스태프');

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    v_owner_id,
    'no_show_alert',
    '노쇼 알림',
    CASE
      WHEN v_job_title IS NULL OR v_job_title = ''
        THEN format('%s님이 노쇼 처리되었습니다.', v_staff_name)
      ELSE format('%s님이 ''%s'' 근무에서 노쇼 처리되었습니다.', v_staff_name, v_job_title)
    END,
    format('/employer/applicants/%s', NEW.job_posting_id),
    jsonb_build_object(
      'workLogId', NEW.id,
      'jobPostingId', NEW.job_posting_id,
      'jobPostingTitle', COALESCE(v_job_title, ''),
      'staffId', NEW.staff_id,
      'staffName', v_staff_name,
      'date', COALESCE(NEW.date, ''),
      'senderId', NEW.staff_id
    ),
    'urgent'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_no_show_update] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_log_notify_no_show_update ON public.work_logs;
CREATE TRIGGER work_log_notify_no_show_update
AFTER UPDATE ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_work_log_no_show_update();


COMMENT ON FUNCTION public._fmt_worklog_time(jsonb) IS
  'work_logs.check_in_time 등 jsonb ISO 문자열을 Asia/Seoul HH:MM으로 포맷. 실패 시 원본 반환.';
COMMENT ON FUNCTION public.notify_on_work_log_checkinout_update() IS
  'check_in_time / check_out_time 전환 시 스태프+구인자에게 알림 (Firebase onCheckInOut 대체). 퇴근 시 review_request도 발송.';
COMMENT ON FUNCTION public.notify_on_work_log_no_show_update() IS
  'no_show_at 전환 시 구인자에게 urgent 알림 (Firebase onNoShow 대체)';
