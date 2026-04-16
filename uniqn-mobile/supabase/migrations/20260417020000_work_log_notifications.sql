-- =============================================================================
-- Migration: WorkLog 도메인 알림 트리거 (Firebase 마이그레이션)
-- =============================================================================
-- 목적:
--   Firebase Functions의 work_log 관련 알림을 PostgreSQL trigger로 재구현.
--
-- 매핑:
--   onScheduleCreated (Firestore onCreate workLogs)          → notify_on_work_log_insert
--   onScheduleCancelled (Firestore onUpdate status)          → notify_on_work_log_update (status case)
--   onWorkTimeChanged (Firestore subcollection onCreate)     → notify_on_work_log_update (time case)
--   onSettlementCompleted (Firestore onUpdate payrollStatus) → notify_on_work_log_update (payroll case)
--   onNegativeSettlement (Firestore onUpdate flag)           → notify_on_work_log_update (negative case)
--
-- 제외 (Service 레이어에서 처리):
--   onCheckInOut, onNoShow
--   → check_in_time, no_show_at이 jsonb라 SQL로 파싱이 취약. Phase 2-bis 참조.
--
-- Firestore 주의사항:
--   - onWorkTimeChanged는 원래 subcollection INSERT. Supabase는 work_logs.modification_history
--     jsonb 배열에 push하는 구조이므로 UPDATE로 감지.
-- =============================================================================

-- ============================================================
-- 1. work_logs INSERT: 신규 근무 배정 알림 (→ staff)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_work_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_when text;
  v_label text;
BEGIN
  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  v_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당'
    ELSE format('''%s''', v_job_title)
  END;

  v_when := COALESCE(NEW.date, '예정된 일정')
          || CASE WHEN NEW.time_slot IS NOT NULL AND NEW.time_slot <> ''
                  THEN format(' (%s)', NEW.time_slot)
                  ELSE '' END;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.staff_id,
    'schedule_created',
    '새 근무 배정',
    format('%s 근무가 %s에 배정되었습니다.', v_label, v_when),
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_insert] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS work_log_notify_insert ON public.work_logs;
CREATE TRIGGER work_log_notify_insert
AFTER INSERT ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_work_log_insert();


-- ============================================================
-- 2. work_logs UPDATE: 상태/시간/정산 변경 통합 알림
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_work_log_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

DROP TRIGGER IF EXISTS work_log_notify_update ON public.work_logs;
CREATE TRIGGER work_log_notify_update
AFTER UPDATE ON public.work_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_work_log_update();

COMMENT ON FUNCTION public.notify_on_work_log_insert() IS
  'work_logs INSERT 시 staff에게 새 근무 배정 알림 (Firebase onScheduleCreated 대체)';
COMMENT ON FUNCTION public.notify_on_work_log_update() IS
  'work_logs UPDATE 시 4가지 알림 통합 처리: 취소(schedule_cancelled), 시간변경(schedule_change), 정산완료(settlement_completed), 음수정산(negative_settlement_alert). Firebase onScheduleCancelled / onWorkTimeChanged / onSettlementCompleted / onNegativeSettlement 대체.';
