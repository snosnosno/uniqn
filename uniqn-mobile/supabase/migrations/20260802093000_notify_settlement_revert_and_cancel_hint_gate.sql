-- 알림 계약 정합 — 되돌리기 알림 신설(M5) + 취소 힌트 조건 정합(M3)
--
-- 근거: docs/analysis/2026-08-01-work-schedule-wave-audit.md §7 P2.
-- 두 결함 모두 같은 트리거 함수(notify_on_work_log_update) 하나에서 나오므로 마이그 1건으로 끝낸다.
--
-- ── M3: '취소를 요청할 수 있어요' 가 버튼 없는 화면을 가리킨다 ────────────────
-- 20260731140000 이 Case 2-B 를 신설하며 163-168줄에 *"그 버튼이 실제로 있을 때만 말한다"* 는
-- 불변식을 주석으로 못박았는데, 정작 조건 집합을 클라의 **진부분집합**으로 잡아 스스로 어겼다.
--
--   클라 실제 렌더 조건 C (src/components/schedule/ScheduleDetailModal.tsx:536-540)
--     = schedule.type = CONFIRMED            -- work_log.status ∈ {scheduled, checked_in}
--     ∧ onRequestCancellation 전달됨          -- app/(app)/(tabs)/schedule.tsx:1179 에서 항상 전달
--     ∧ schedule.applicationId ≠ null        -- work_logs.application_id (ScheduleConverter.ts:192)
--     ∧ ¬schedule.isCancellationPending      -- applications.status = 'cancellation_pending'
--                                               (ScheduleConverter.ts:257 · ScheduleMerger.ts:241-250)
--   기존 트리거 조건 T = (application_id ≠ null) ∧ (status = 'scheduled')
--
--   T ⊄ C — 네 번째 항이 통째로 빠져 있었다. 스태프가 취소를 요청해 심사 대기 중일 때
--   구인자가 출근 예정 시각을 바꾸면, 알림은 "취소를 요청할 수 있어요"라고 말하지만
--   들어간 화면엔 '취소 요청 검토 중' 배지만 있고 버튼은 숨겨져 있다(:383, :539).
--
--   T' = T ∧ ¬(applications.status = 'cancellation_pending') 로 좁혀 T' ⊆ C 를 만든다.
--   status 축 하나만 보는 것이 클라와 **정확히** 같다 — 클라는 StatusMapper.isCancellationPending
--   (cancellation_request jsonb 도 보는 쪽)이 아니라 ScheduleConverter.ts:257 을 탄다.
--   ⚠️ 'checked_in' 은 C 에 있지만 T' 에는 없다. 이는 20260731140000 의 의도적 축소이며
--      (지난 근무의 기록 정정에 취소를 권할 수는 없다) 안전한 방향(말을 덜 한다)이라 유지한다.
--
-- ── M5: 지급 완료 되돌리기가 스태프에게 완전 무음 ────────────────────────────
-- Case 3 은 payroll_status → 'completed' 전이만 통지한다. 역방향 Case 가 없어,
-- 스태프는 "정산이 완료되었습니다. 지급액 500,000원" 알림을 손에 쥔 채 화면만 조용히
-- '정산 대기'로 되돌아가는 것을 본다. 같은 웨이브의 #382 가 "무음 변경은 결함"이라며
-- 시각 변경 알림을 신설했는데 **금전 상태 역행이 시각 변경보다 덜 통지되는** 역전이었다.
--
-- Case 3-B 를 신설한다. 사유는 이미 서버에 있다 —
-- SettlementRepository.ts:637-663 이 되돌리기 시 사유를 필수로 받아
-- settlement_modification_history 에 {type:'payroll_status_revert', previousStatus, newStatus,
-- reason, modifiedBy, modifiedAt} 로 append 한다. 그 배열의 마지막 항목에서 읽어 본문에 싣는다.
-- 앱에서 도달 가능한 되돌리기 경로는 단일 행 UPDATE 하나뿐이라(SettlementRepository.ts:627,
-- 일괄 되돌리기 UI 없음) 이 Case 가 N통을 만들 일은 없다.
-- ⚠️ 다만 `payroll_status` writer 는 SettlementRepository 3곳이 전부가 아니다 — 앱 호출부가
--    0곳인 `WorkLogRepository.ts:634` · `WorkLogRepositoryTransactions.ts:65` 도 이력 append
--    없이 completed→pending 을 쓸 수 있다. Case 3-B 는 컬럼 전이로 판정하므로 그쪽도 잡히고,
--    이력이 없으면 사유 없이 통지된다(무음보다 낫다).
--
-- 🔴 알아둘 것 — M3 는 **계약(T' ⊆ C)** 을 회복하지만, 그 이득이 지금 사용자에게 보이지는 않는다.
--    선재 결함이 하나 더 있다: ScheduleMerger.generateScheduleKey(:187-196)가 병합 키에
--    `timeSlot` 을 넣는데, updateSlot 은 work_logs.time_slot 만 쓰고
--    applications.assignments[].timeSlot 은 그대로 둔다(WorkLogRepositoryVenue.ts:108-122).
--    → 시각을 바꾸는 순간 키가 어긋나 병합이 끊기고, `isCancellationPending` 를 얹는 유일한
--    지점(ScheduleMerger.ts:238-251)이 실행되지 않아 **취소 요청 버튼이 오히려 그대로 보인다.**
--    즉 현재는 "말은 안 하는데 버튼은 있는" 안전한 쪽으로 어긋나 있다. 이 마이그는 서버 계약을
--    바로잡아 두고, 병합 키 수선은 클라 전용이라 별도 PR 로 남긴다(감사 후속 신규 항목).
--
-- ── 형식 규율 ────────────────────────────────────────────────────────────────
--  * DROP + CREATE 가 아니라 CREATE OR REPLACE 다. DROP 하면 20260731090000 이 회수한
--    PUBLIC EXECUTE 권한이 기본값으로 되살아난다.
--  * 🔴 재정의 베이스는 grep 이 아니라 pg_proc 실측으로 확정했다 —
--    prod prosrc md5 = da652c36a22c6262c9249252c4dd9f14 (7811 byte)
--    = 20260731140000_notify_on_time_slot_change.sql 본문 md5 와 정확히 일치.
--    그 뒤 ALTER FUNCTION 으로 얹힌 하드닝은 없다(prod proconfig = public, extensions, pg_temp).
--  * CREATE OR REPLACE 의 SET 절은 proconfig 를 통째로 갈아치우므로 pg_temp 를 반드시 유지한다.
--    회귀 가드: supabase/tests/parity_baseline_guard.test.sql:134.
--  * 함수 신설·삭제 없음 → 파리티 184 / 111 불변.

CREATE OR REPLACE FUNCTION public.notify_on_work_log_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
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
  v_cancel_hint text;
  v_settle_hist_before int;
  v_settle_hist_after int;
  v_latest_revert jsonb;
  v_revert_reason text;
  v_revert_reason_suffix text;
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
  -- ⚠️ [2026-08-02 리뷰 반영] jsonb_typeof 가드 — Case 3-B 와 같은 이유인데 폭발반경이 더 크다.
  --    이 두 줄은 IF 밖·최상단이라 **모든 work_logs UPDATE 에서 무조건 실행**된다. 오염된
  --    modification_history(비배열 jsonb) 한 행이 22023 을 던지면 말미의 EXCEPTION 블록이
  --    BEGIN 전체를 되감아 그 UPDATE 의 알림이 전멸한다 — Case 3-B 에만 가드를 넣으면
  --    상류에서 먼저 죽으므로 그 가드가 무력해진다(리뷰 2인이 각각 실측으로 재현).
  --    NULL 입력은 jsonb_typeof 가 SQL NULL 을 돌려 ELSE 0 → 기존 COALESCE 와 완전 동치다.
  v_modification_count_before := CASE
    WHEN jsonb_typeof(OLD.modification_history) = 'array'
      THEN jsonb_array_length(OLD.modification_history) ELSE 0 END;
  v_modification_count_after := CASE
    WHEN jsonb_typeof(NEW.modification_history) = 'array'
      THEN jsonb_array_length(NEW.modification_history) ELSE 0 END;

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

    -- 🔴 '취소를 요청할 수 있어요' 는 그 버튼이 실제로 있을 때만 말한다.
    -- 스케줄 상세의 취소 요청 버튼(ScheduleDetailModal.tsx:536-540)은 네 조건의 곱이다:
    --   ① schedule.type = CONFIRMED  ② onRequestCancellation 전달  ③ applicationId
    --   ④ !isCancellationPending
    -- ③ 근무표에서 직접 배치한 스태프의 work_log 는 application_id 가 NULL 이다
    --    (add_direct_staff). 그런 사람에게 취소를 권하면 눌러야 할 버튼이 없는 화면으로 보낸다.
    -- ④ [2026-08-02 신설] 이미 취소 요청이 접수돼 심사 중이면(applications.status =
    --    'cancellation_pending') 버튼은 사라지고 '취소 요청 검토 중' 배지만 남는다
    --    (ScheduleDetailModal.tsx:313,383,539). 원래 조건이 ④를 빠뜨려, 트리거가
    --    클라의 진부분집합 조건으로 같은 종류의 거짓말을 하고 있었다(감사 M3).
    --    클라는 applications.status 만 본다(ScheduleConverter.ts:257) — cancellation_request
    --    jsonb 는 그 경로에 없으므로 여기서도 status 축 하나만 대조하는 것이 정확한 일치다.
    -- ① 이미 시작·종료된 근무는 제외한다(status='scheduled' 한정). 'checked_in' 도 클라에선
    --    CONFIRMED 로 접히지만, 지난 근무의 기록 정정에 취소를 권할 수는 없어 의도적으로 좁힌다.
    v_cancel_hint := CASE
      WHEN NEW.application_id IS NOT NULL
       AND NEW.status = 'scheduled'
       AND NOT EXISTS (
             SELECT 1
             FROM public.applications a
             WHERE a.id = NEW.application_id
               AND a.status = 'cancellation_pending'
           )
        THEN ' 어려우시면 취소를 요청할 수 있어요.'
      ELSE ''
    END;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'schedule_change',
      '출근 예정 시간 변경',
        -- 조사(로/으로)는 앞말 받침에 따라 갈리고 '18:00'·'미정' 이 뒤섞이므로 아예 쓰지 않는다.
      format(
        '%s %s 출근 예정 시간이 변경되었습니다: %s → %s.%s',
        v_label,
        COALESCE(NEW.date, ''),
        v_prev_slot_label,
        v_next_slot_label,
        v_cancel_hint
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

  -- ============ Case 3-B: 지급 완료 되돌리기 (금전 상태 역행) ============
  -- Case 3 의 짝. 완료 알림을 받은 사람에게 그 완료가 취소됐다는 말을 반드시 해야 한다 —
  -- 안 하면 손에는 완료 알림만 남고 화면만 조용히 되돌아가 이의 제기 시점을 놓친다(감사 M5).
  -- OLD 가 NULL 이면 '=' 비교가 NULL 이라 IF 는 거짓 — 최초 INSERT 직후 UPDATE 에서 오발화하지 않는다.
  IF OLD.payroll_status = 'completed'
     AND NEW.payroll_status IS DISTINCT FROM OLD.payroll_status THEN

    -- 지급액은 되돌려도 남는다(SettlementRepository.ts:646-648 — '얼마를 완료로 찍었었는지'는
    -- 이의 처리에 필요해 동결 표시액을 지우지 않는다). 완료 알림과 같은 숫자를 보여줘야
    -- 스태프가 두 알림을 같은 건으로 잇는다.
    v_amount_label := to_char(COALESCE(OLD.payroll_amount, NEW.payroll_amount, 0), 'FM999,999,999,999');

    -- 사유는 서버에 이미 있다 — 되돌리기 경로가 사유를 필수로 받아 이 배열에 append 한다.
    -- 이번 UPDATE 에서 실제로 늘어난 항목만 신뢰한다(과거 이력의 사유를 재탕하지 않는다).
    -- ⚠️ 이 텍스트는 사용자 입력이다. 클라가 assertWorkTimeReason 으로 검증하지만 DB 계층엔
    --    강제가 없으므로(work_logs_xss_check 대상은 notes·custom_role 뿐) 길이를 여기서 자른다.
    -- ⚠️ jsonb_array_length 는 배열이 아니면 22023 을 던진다. 이 함수의 EXCEPTION 블록은
    --    BEGIN 전체를 되감으므로, 오염된 jsonb 하나가 Case 1~3 의 알림까지 통째로 삼킨다.
    --    (기존 Case 2 의 modification_history 도 같은 노출을 갖고 있으나 그건 이 PR 범위 밖이다.)
    --    컬럼 default 는 '[]' 이고 클라는 항상 배열을 쓰지만, raw PostgREST 로는 객체도 들어간다.
    v_settle_hist_before := CASE
      WHEN jsonb_typeof(OLD.settlement_modification_history) = 'array'
        THEN jsonb_array_length(OLD.settlement_modification_history) ELSE 0 END;
    v_settle_hist_after := CASE
      WHEN jsonb_typeof(NEW.settlement_modification_history) = 'array'
        THEN jsonb_array_length(NEW.settlement_modification_history) ELSE 0 END;
    v_revert_reason := NULL;

    IF v_settle_hist_after > v_settle_hist_before THEN
      v_latest_revert := NEW.settlement_modification_history -> (v_settle_hist_after - 1);
      IF v_latest_revert ->> 'type' = 'payroll_status_revert'
         AND v_latest_revert ->> 'previousStatus' = 'completed' THEN
        v_revert_reason := NULLIF(btrim(COALESCE(v_latest_revert ->> 'reason', '')), '');
        -- 클라 상한은 200자(workTimeModification.ts:18)라 잘릴 수 있다. 말없이 자르면
        -- 사유가 문장 중간에서 끊긴 것인지 원래 그런 것인지 스태프가 구분할 수 없다.
        IF length(v_revert_reason) > 100 THEN
          v_revert_reason := left(v_revert_reason, 99) || '…';
        END IF;
      END IF;
    END IF;

    v_revert_reason_suffix := CASE
      WHEN v_revert_reason IS NULL THEN ''
      ELSE format(' 사유: %s', v_revert_reason)
    END;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'settlement_reverted',
      '지급 완료 취소',
      CASE WHEN v_job_title IS NULL OR v_job_title = ''
           THEN format('정산 지급 완료가 취소되어 정산 대기로 되돌아갔습니다. 지급액: %s원.%s',
                       v_amount_label, v_revert_reason_suffix)
           ELSE format('''%s'' 정산 지급 완료가 취소되어 정산 대기로 되돌아갔습니다. 지급액: %s원.%s',
                       v_job_title, v_amount_label, v_revert_reason_suffix)
      END,
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'payrollAmount', COALESCE(OLD.payroll_amount, NEW.payroll_amount, 0)::text,
        'previousPayrollStatus', OLD.payroll_status::text,
        'payrollStatus', COALESCE(NEW.payroll_status::text, ''),
        'revertReason', COALESCE(v_revert_reason, ''),
        'senderId', COALESCE(NEW.edited_by, v_owner_id)
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

-- CREATE OR REPLACE 는 코멘트를 보존하므로 '5가지'로 남아 있던 설명을 갱신한다.
COMMENT ON FUNCTION public.notify_on_work_log_update() IS
  'work_logs UPDATE 시 6가지 알림 통합 처리: 취소 / 이력 기반 근무시간 변경 / 출근 예정 시각(time_slot) 변경 / 정산 완료 / 지급 완료 되돌리기 / 음수 정산 admin broadcast';
