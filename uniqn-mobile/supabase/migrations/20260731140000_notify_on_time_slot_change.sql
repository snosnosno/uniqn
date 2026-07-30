-- 출근 예정 시각(time_slot) 변경 알림 배선
--
-- 배경: notify_on_work_log_update 의 Case 2 는 modification_history 배열 길이 증가로만
-- 발화한다. 그런데 출근 "예정" 시각을 바꾸는 유일한 경로인 updateSlot
-- (src/repositories/supabase/WorkLogRepositoryVenue.ts) 은 time_slot 컬럼만 직접 SET 하고
-- 이력 배열을 건드리지 않는다. 결과적으로 구인자가 근무 수정 시트에서 출근 시간을 바꿔도
-- 스태프에게 아무 알림도 가지 않는 무음 변경이 성립했다.
--
-- 해결: 이력 배열을 경유하지 않고 time_slot 변경 자체를 트리거에서 원자적으로 감지한다.
-- 클라이언트가 읽고-쓰는 경합 없이, 앞으로 어떤 경로가 time_slot 을 바꾸더라도 자동 커버된다.
--
-- 설계 메모
--  * modification_history 는 "실제 출퇴근 시각의 사후 수정" 전용이다. 정산 상세 화면
--    (TimeModificationHistory.tsx) 이 이 배열을 그대로 보여주므로 예정 시각 변경을 섞지 않는다.
--  * 알림 타입은 기존 schedule_change 를 재사용한다(카테고리·우선순위·아이콘·라벨 배선 완비).
--  * data.applicationId 를 실어 스케줄 상세 모달로 정밀 착지시킨다 — 그 화면에 취소 요청
--    버튼(ScheduleDetailModal.tsx)이 있다. 무음 변경 금지의 짝은 "거부할 수 있는 경로"다.
--  * DROP + CREATE 가 아니라 CREATE OR REPLACE 다. DROP 하면 20260731090000 이 회수한
--    PUBLIC EXECUTE 권한이 기본값으로 되살아난다.
--  * SECURITY DEFINER 와 SET search_path 는 원본 그대로 보존한다(REPLACE 시 누락되면
--    search_path 방어가 조용히 사라진다).

CREATE OR REPLACE FUNCTION public.notify_on_work_log_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_label text;
  v_when text;
  v_amount_label text;
  v_modification_count_before int;
  v_modification_count_after int;
  v_time_change_parts text[];
  v_latest_mod jsonb;
  v_admin_id uuid;
  v_prev_slot_label text;
  v_next_slot_label text;
BEGIN
  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  v_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당'
    ELSE format('''%s''', v_job_title)
  END;

  -- ==================== Case 1: 근무 취소 ====================
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    v_when := COALESCE(NEW.date, '')
            || CASE WHEN NEW.time_slot IS NOT NULL AND NEW.time_slot <> ''
                    THEN format(' (%s)', NEW.time_slot)
                    ELSE '' END;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'schedule_cancelled',
      '근무 취소',
      CASE WHEN v_when = '' OR v_when = ' '
           THEN format('%s 근무가 취소되었습니다.', v_label)
           ELSE format('%s %s 근무가 취소되었습니다.', v_label, trim(v_when))
      END,
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'role', COALESCE(NEW.role::text, ''),
        'timeSlot', COALESCE(NEW.time_slot, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  -- ==================== Case 2: 근무 시간 변경 ====================
  -- modification_history 배열 길이가 증가하면 시간 수정으로 간주
  v_modification_count_before := COALESCE(jsonb_array_length(OLD.modification_history), 0);
  v_modification_count_after := COALESCE(jsonb_array_length(NEW.modification_history), 0);

  IF v_modification_count_after > v_modification_count_before THEN
    -- 가장 최근 수정 항목 조회
    v_latest_mod := NEW.modification_history -> (v_modification_count_after - 1);
    v_time_change_parts := ARRAY[]::text[];

    IF (v_latest_mod -> 'previousStartTime') IS NOT NULL
       OR (v_latest_mod -> 'newStartTime') IS NOT NULL THEN
      v_time_change_parts := array_append(
        v_time_change_parts,
        format(
          '시작 %s -> %s',
          COALESCE(v_latest_mod ->> 'previousStartTime', ''),
          COALESCE(v_latest_mod ->> 'newStartTime', '')
        )
      );
    END IF;

    IF (v_latest_mod -> 'previousEndTime') IS NOT NULL
       OR (v_latest_mod -> 'newEndTime') IS NOT NULL THEN
      v_time_change_parts := array_append(
        v_time_change_parts,
        format(
          '종료 %s -> %s',
          COALESCE(v_latest_mod ->> 'previousEndTime', ''),
          COALESCE(v_latest_mod ->> 'newEndTime', '')
        )
      );
    END IF;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'schedule_change',
      '근무 시간 변경',
      format(
        '%s 시간이 변경되었습니다: %s',
        v_label,
        array_to_string(v_time_change_parts, ', ')
      ),
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'timeSlot', COALESCE(NEW.time_slot, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  -- ============ Case 2-B: 출근 예정 시각(time_slot) 변경 ============
  -- Case 2 와 달리 이력 배열이 아니라 컬럼 변경 자체를 본다. updateSlot 경로가 여기 걸린다.
  -- 취소된 근무는 Case 1 이 이미 통지했으므로 중복 발송하지 않는다.
  IF OLD.time_slot IS DISTINCT FROM NEW.time_slot
     AND NEW.status <> 'cancelled' THEN

    -- 'NEGOTIABLE'(고정공고 협의)과 미기록(=미정)을 사람이 읽는 말로 바꾼다.
    v_prev_slot_label := CASE
      WHEN OLD.time_slot IS NULL OR OLD.time_slot = '' THEN '미정'
      WHEN OLD.time_slot = 'NEGOTIABLE' THEN '협의'
      ELSE OLD.time_slot
    END;
    v_next_slot_label := CASE
      WHEN NEW.time_slot IS NULL OR NEW.time_slot = '' THEN '미정'
      WHEN NEW.time_slot = 'NEGOTIABLE' THEN '협의'
      ELSE NEW.time_slot
    END;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'schedule_change',
      '출근 예정 시간 변경',
      -- 조사(로/으로)는 앞말 받침에 따라 갈리고 '18:00'·'미정' 이 뒤섞이므로 아예 쓰지 않는다.
      format(
        '%s %s 출근 예정 시간이 변경되었습니다: %s → %s. 어려우시면 취소를 요청할 수 있어요.',
        v_label,
        COALESCE(NEW.date, ''),
        v_prev_slot_label,
        v_next_slot_label
      ),
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'applicationId', NEW.application_id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'timeSlot', COALESCE(NEW.time_slot, ''),
        'previousTimeSlot', COALESCE(OLD.time_slot, ''),
        'senderId', COALESCE(NEW.edited_by, v_owner_id)
      ),
      'high'
    );
  END IF;

  -- ==================== Case 3: 정산 완료 ====================
  IF OLD.payroll_status IS DISTINCT FROM NEW.payroll_status
     AND NEW.payroll_status = 'completed' THEN
    v_amount_label := to_char(COALESCE(NEW.payroll_amount, 0), 'FM999,999,999,999');

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'settlement_completed',
      '정산 완료',
      CASE WHEN v_job_title IS NULL OR v_job_title = ''
           THEN format('정산이 완료되었습니다. 지급액: %s원', v_amount_label)
           ELSE format('''%s'' 정산이 완료되었습니다. 지급액: %s원', v_job_title, v_amount_label)
      END,
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'payrollAmount', COALESCE(NEW.payroll_amount, 0)::text,
        'payrollDate', COALESCE(NEW.payroll_date::text, '')
      ),
      'high'
    );
  END IF;

  -- ==================== Case 4: 음수 정산 감지 (모든 admin에게 broadcast) ====================
  -- payroll_amount가 0 이상 → 음수로 변경 시 (또는 최초 음수)
  IF COALESCE(NEW.payroll_amount, 0) < 0
     AND (OLD.payroll_amount IS NULL OR COALESCE(OLD.payroll_amount, 0) >= 0) THEN
    FOR v_admin_id IN
      SELECT id FROM public.users WHERE role = 'admin'
    LOOP
      INSERT INTO public.notifications (
        recipient_id, type, title, body, data, priority
      ) VALUES (
        v_admin_id,
        'negative_settlement_alert',
        '⚠️ 음수 정산 경고',
        format(
          '%s님의 정산 금액이 %s원입니다. (%s)',
          COALESCE(NEW.staff_nickname, NEW.staff_name, '알 수 없음'),
          to_char(NEW.payroll_amount, 'FM999,999,999,999'),
          COALESCE(v_job_title, '알 수 없음')
        ),
        jsonb_build_object(
          'workLogId', NEW.id,
          'staffId', NEW.staff_id,
          'jobPostingId', NEW.job_posting_id,
          'amount', NEW.payroll_amount::text
        ),
        'urgent'
      );
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_update] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
