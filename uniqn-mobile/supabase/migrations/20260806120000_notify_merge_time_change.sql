-- 알림 병합 — 한 번의 저장 = 한 통
--
-- 근거: docs/planning/2026-08-06-work-time-editing-unification-plan.md Task 1.
--
-- ── 무엇이 문제인가 ──────────────────────────────────────────────────────────
-- notify_on_work_log_update 의 Case 2(이력 기반 근무 시간 변경, modification_history
-- 배열 길이 증가로 판정)와 Case 2-B(출근 예정 시각, time_slot 컬럼 변경으로 판정)는
-- **독립 IF 블록**이고 사이에 early return 이 없다(RETURN NEW 는 함수 말미).
-- 지금까지는 두 Case 를 함께 트리거하는 쓰기 경로가 없어 드러나지 않았지만,
-- 근무 시간 편집 통일 이후 update_work_log_slot 이 예정(time_slot)과
-- 실적(check_in_ts + modification_history)을 **한 UPDATE** 로 바꾼다.
-- 그러면 구인자가 시트에서 저장 버튼을 한 번 누를 때 스태프 폰에 schedule_change
-- 알림이 2통 간다.
--
-- ── 어떻게 고치는가 ──────────────────────────────────────────────────────────
-- Case 2 가 발송하는 그 한 통에 출근 예정 변경까지 실어 보내고, Case 2-B 는 그때 침묵한다.
-- 알림을 지우는 게 아니라 **흡수**한다 — 병합된 한 통은 두 통이 하던 말의 합집합이다:
--   · 이력 기반 시작/종료 변경 문구 (Case 2 원래 내용)
--   · '출근 예정 A → B' 문구        (Case 2-B 가 하던 말)
--   · '어려우시면 취소를 요청할 수 있어요.' 안내 (Case 2-B 가 조건부로 붙이던 말)
--   · data.previousTimeSlot / data.applicationId (Case 2-B 가 싣던 키 — 병합될 때만)
--
-- 구현은 두 Case 가 공유하는 판정·문구를 **한 번만** 계산해 위로 끌어올리는 방식이다.
-- 새 변수 `v_slot_change_notifiable` 이 그 판정을 담는다:
--   v_slot_change_notifiable := (OLD.time_slot IS DISTINCT FROM NEW.time_slot)
--                               AND NEW.status <> 'cancelled'
-- 이는 **기존 Case 2-B 의 IF 조건 그대로**다. 그래서
--   · Case 2 는 "Case 2-B 가 말했을 상황에서만" 예정 문구를 덧붙이고
--   · Case 2-B 는 "Case 2 가 그 말을 대신 하지 않은 경우에만" 발송한다
--     (= v_modification_count_after <= v_modification_count_before,
--        Case 2 의 발화 조건 `after > before` 의 정확한 부정)
-- 두 축이 정확히 상보라 어떤 UPDATE 에서도 예정 변경은 **정확히 한 번** 통지된다.
--
-- 🔴 브리프 초안에서 바꾼 것 3가지 (근거를 남긴다):
--  (1) 병합 문구에 `NEW.status <> 'cancelled'` 게이트를 넣었다. 초안은
--      `OLD.time_slot IS DISTINCT FROM NEW.time_slot` 만 봤는데, 그러면 취소와 시각 변경이
--      한 UPDATE 로 오는 경우(worklog_time_slot_change_notify.test.sql T2 가 고정한 형태)
--      Case 2-B 는 침묵하는데 Case 2 가 대신 말해버려 Case 1('근무 취소')과 중복이 된다.
--      "Case 2-B 가 말했을 내용만 대신 싣는다"는 불변식을 지키려면 조건이 같아야 한다.
--  (2) 문구를 만들 때 초안의 2분기(미정/원문) CASE 대신 Case 2-B 의 3분기 라벨
--      (미정 / 협의 / 원문)을 재사용한다. 초안대로면 병합된 알림에서만 'NEGOTIABLE' 이
--      한글로 번역되지 않고 새어나간다.
--  (3) 취소 안내(v_cancel_hint)와 data 의 previousTimeSlot·applicationId 도 함께 옮긴다.
--      초안은 본문 문구만 옮겨 Case 2-B 가 하던 나머지 말이 조용히 사라졌다.
--      ⚠️ senderId 는 옮기지 않는다 — Case 2 는 v_owner_id, Case 2-B 는
--         COALESCE(NEW.edited_by, v_owner_id) 로 서로 다른데, 기존 키의 **값 의미**를
--         바꾸는 것은 이 태스크의 범위 밖이고 병합되지 않는 Case 2 에도 영향을 준다.
--         (소비처 실측: src·app·e2e 에서 schedule_change 의 senderId·previousTimeSlot 을
--          읽는 코드는 0곳. 알림 본문도 정규화 대상이 아니다 —
--          notificationMessageNormalizer 는 제목·본문이 비었거나 영문일 때만 개입한다.)
--
-- ── 형식 규율 ────────────────────────────────────────────────────────────────
--  * DROP + CREATE 가 아니라 CREATE OR REPLACE 다. DROP 하면 20260731090000 이 회수한
--    PUBLIC EXECUTE 권한이 기본값으로 되살아난다.
--  * 🔴 재정의 베이스는 20260802093000_notify_settlement_revert_and_cancel_hint_gate.sql
--    의 함수 본문이다. prod pg_proc 실측과 대조 확인했다 —
--    md5(replace(pg_get_functiondef(oid), chr(13), '')) = 4bed6dd1f2908bff7b2a825392d6a02a
--    로 레포 적용본과 완전 일치하며, 그 뒤 얹힌 하드닝은 없다.
--    (⚠️ chr(13) 제거 없이 비교하면 CRLF 때문에 전부 가짜 불일치로 보인다.)
--  * CREATE OR REPLACE 의 SET 절은 proconfig 를 통째로 갈아치우므로 pg_temp 를 반드시 유지한다.
--    회귀 가드: supabase/tests/parity_baseline_guard.test.sql ·
--    notify_work_log_contract.test.sql · worklog_time_slot_change_notify.test.sql T6.
--  * 함수 신설·삭제 없음 → 파리티 200 / 111 불변.

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
  v_slot_change_notifiable boolean;
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

  -- ===== 출근 예정 시각(time_slot) 변경 — 공통 판정·문구 (Case 2 병합 · Case 2-B 공용) =====
  -- [병합, 2026-08-06] 이 블록은 Case 2-B 안에 있던 계산을 통째로 끌어올린 것이다.
  -- 판정식은 **기존 Case 2-B 의 IF 조건 그대로**다 — 취소된 근무는 Case 1 이 이미
  -- 통지했으므로 여기서도, 병합된 Case 2 에서도 말하지 않는다.
  v_slot_change_notifiable := OLD.time_slot IS DISTINCT FROM NEW.time_slot
                              AND NEW.status <> 'cancelled';
  v_cancel_hint := '';

  IF v_slot_change_notifiable THEN
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

    -- [병합, 2026-08-06] 같은 UPDATE 에서 출근 예정 시각도 바뀌었으면 이 한 통에 함께 싣는다.
    -- 아래 Case 2-B 는 그때 침묵한다 — 저장 한 번에 스태프 폰으로 2통이 가지 않게.
    -- 화살표는 Case 2-B 원문과 같은 '→' 를 쓴다(이력 문구의 '->' 와 섞이지만, 스태프가
    -- 이미 받아 온 출근 예정 알림과 같은 모양이어야 같은 종류의 말로 읽힌다).
    IF v_slot_change_notifiable THEN
      v_time_change_parts := array_append(
        v_time_change_parts,
        format('출근 예정 %s → %s', v_prev_slot_label, v_next_slot_label)
      );
    END IF;

    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.staff_id,
      'schedule_change',
      '근무 시간 변경',
      -- v_cancel_hint 는 앞에 공백을 달고 오거나 빈 문자열이다 —
      -- 병합이 아닌 경우 본문은 기존과 바이트 단위로 동일하다.
      format(
        '%s 시간이 변경되었습니다: %s%s',
        v_label,
        array_to_string(v_time_change_parts, ', '),
        v_cancel_hint
      ),
      '/schedule',
      jsonb_build_object(
        'workLogId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'date', COALESCE(NEW.date, ''),
        'timeSlot', COALESCE(NEW.time_slot, ''),
        'senderId', v_owner_id
      )
      -- [병합] Case 2-B 만 싣던 키는 실제로 병합될 때만 붙인다. 무조건 붙이면
      -- 예정이 안 바뀐 알림에도 previousTimeSlot 이 현재값과 같은 값으로 들어가
      -- '이전 값'이라는 이름이 거짓말이 된다.
      || CASE WHEN v_slot_change_notifiable
              THEN jsonb_build_object(
                     'previousTimeSlot', COALESCE(OLD.time_slot, ''),
                     'applicationId', NEW.application_id
                   )
              ELSE '{}'::jsonb
         END,
      'high'
    );
  END IF;

  -- ============ Case 2-B: 출근 예정 시각(time_slot) 변경 ============
  -- Case 2 와 달리 이력 배열이 아니라 컬럼 변경 자체를 본다. updateSlot 경로가 여기 걸린다.
  -- 취소된 근무는 Case 1 이 이미 통지했으므로 중복 발송하지 않는다
  -- (그 조건은 위 v_slot_change_notifiable 에 그대로 들어 있다).
  --
  -- [병합, 2026-08-06] 둘째 조건이 병합 가드다. `after > before` 는 Case 2 의 발화 조건이므로
  -- 그 부정(`after <= before`)은 "Case 2 가 이 UPDATE 에서 발송하지 않았다"와 정확히 같다.
  -- Case 2 가 발송했다면 그 한 통에 출근 예정 변경이 이미 실려 있다.
  IF v_slot_change_notifiable
     AND v_modification_count_after <= v_modification_count_before THEN

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
    --    (Case 2 의 modification_history 에도 같은 가드를 얹었다 — 그쪽이 상류라 더 위험하다.)
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

-- CREATE OR REPLACE 는 코멘트를 보존하므로 병합 규칙을 덧붙여 갱신한다.
COMMENT ON FUNCTION public.notify_on_work_log_update() IS
  'work_logs UPDATE 시 6가지 알림 통합 처리: 취소 / 이력 기반 근무시간 변경 / 출근 예정 시각(time_slot) 변경 / 정산 완료 / 지급 완료 되돌리기 / 음수 정산 admin broadcast. '
  '이력 기반 변경과 출근 예정 시각 변경이 같은 UPDATE 에서 동시에 성립하면 앞의 한 통에 병합해 싣고 뒤는 침묵한다(저장 한 번 = 알림 한 통).';
