-- ============================================================
-- 감사 push-01 / push-04 / push-02(DB 절반) — 알림·정산 파이프라인 배치화 + 전달 관측
-- 출처: docs/analysis/2026-08-09-full-app-audit-2rounds.md §3 S0-서버
-- ============================================================
--
-- ## push-01 [MEDIUM] 일괄 정산이 건당 푸시 발송을 유발한다
--
-- 사슬(정찰 실측):
--   bulk_settle_work_logs 의 FOREACH → settle_work_log 단건 UPDATE
--     → work_logs ROW 트리거 work_log_notify_update → notifications **단건 INSERT 문**
--     → notifications STATEMENT 트리거 on_notification_created_send_push
--       (REFERENCING NEW TABLE, 문당 net.http_post 1회)
--   푸시 트리거는 **문 단위 배치**로 설계돼 있는데, 위 사슬이 문을 N 개로 쪼개
--   그 배치 이득을 통째로 무효화한다 → 100건 정산 = EF 호출 100회.
--
-- ⚠️ 고칠 수 없는 것: FOREACH 자체. 항목별 서브트랜잭션(BEGIN…EXCEPTION)은
--    "3건 성공 / 2건 실패" 부분성공 UX 계약이고 pgTAP·Jest 가 양쪽에서 고정한다.
--    집합 UPDATE 로 바꾸면 그 계약이 깨진다.
--
-- 그래서 **알림 INSERT 만 뒤로 모은다**:
--   1) 트리거 Case 3(정산 완료)은 `uniqn.defer_settlement_notify='on'` 일 때 건너뛴다
--   2) bulk_settle_work_logs 가 그 GUC 를 트랜잭션 로컬로 켜고, 루프가 끝난 뒤
--      성공 id 전체에 대해 **INSERT … SELECT 한 문**으로 알림을 만든다
--   → 알림 내용·수신자·건수는 전과 동일하고, net.http_post 만 N회 → 1회가 된다.
--
--   🔑 개별 경로(settle_work_log 직접 호출)는 GUC 가 꺼져 있으므로 종전 그대로다.
--   🔑 GUC 는 set_config(..., is_local => true) — 트랜잭션 밖으로 새지 않는다.
--   🔑 staff_id 가 NULL 인 행은 배치 INSERT 에서 제외하고 WARNING 을 남긴다.
--      종전에는 그런 행이 트리거에서 NOT NULL 위반을 내 **그 건의 정산까지 실패**시켰다.
--      배치에서 같은 일이 나면 100건이 통째로 롤백되므로, 정산은 살리고 알림만 건너뛴다.
--
-- ## push-04 [LOW] 음수 정산 admin 브로드캐스트가 개별 INSERT 루프
--
-- Case 4 만 `FOR v_admin_id IN SELECT … LOOP INSERT … END LOOP` 였다.
-- admin N명이면 문이 N개 → 푸시도 N회. `INSERT … SELECT` 한 문으로 바꾼다.
-- 레포 선례: fn_notify_cancellation_request(20260711030000)가 이미 이 형태다.
--
-- 🔑 수신자 필터 결정: **활성 admin 만**.
--    종전에는 `role='admin'` 만 봐서 비활성·정지·탈퇴 계정도 받았다.
--    다만 필터가 수신자를 0명으로 만들면 "음수 정산 경고"가 조용히 사라지므로,
--    0건이면 WARNING 을 남겨 침묵하지 않게 한다.
--
-- ## push-02(DB 절반) [MEDIUM] ticket ok ≠ 전달, 그리고 DB 측 관측이 0
--
-- Expo 는 send 응답으로 **ticket** 만 주고 실제 전달 여부는 **receipt** 로만 알 수 있다.
-- 현재 EF 는 ticket 을 어디에도 저장하지 않아 receipts 폴링이 **구조적으로 불가능**했고,
-- net.http_post 응답도 버려서 DB 쪽에는 관측점이 0이었다.
--   → push_tickets 테이블을 만들어 EF 가 ticket 을 적재하고,
--     poll-push-receipts EF 가 크론으로 영수증을 회수해 결과를 이 테이블에 기록한다.
--
-- RLS: 정책을 하나도 만들지 않고 RLS 만 켠다(deny-all).
--   서비스 계층(EF)은 service_role(BYPASSRLS)로 접근하고, 사용자에게 노출할 이유가 없다.
--   → **public 정책 수 불변**(110). 나중에 admin 조회가 필요해지면 그때 정책을 추가한다.
--
-- ## 파리티
--   함수 208 불변 (전부 CREATE OR REPLACE — 신설 0)
--   정책 110 불변 (push_tickets 는 정책 0개로 RLS 만 켠다)
--
-- ## 회귀 고정
--   supabase/tests/push_batching.test.sql (신설)
--   기존: notify_work_log_contract.test.sql · settlement_settle_rpcs.test.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. notify_on_work_log_update — Case 3 지연 스위치 + Case 4 단문화
--    (본문은 20260806120000 정본을 바이트 그대로 옮기고 두 곳만 고쳤다)
-- ------------------------------------------------------------
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
  v_admin_notified int;
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
  -- push-01: 일괄 정산 중에는 여기서 만들지 않는다. bulk_settle_work_logs 가 루프를 마친 뒤
  --   성공 건 전체를 INSERT … SELECT **한 문**으로 만들어 푸시 트리거의 문 단위 배치를 복원한다.
  --   개별 정산(settle_work_log 직접 호출)은 GUC 가 꺼져 있으므로 종전과 완전히 동일하다.
  --   🔑 `current_setting(..., missing_ok => true)` — 한 번도 설정되지 않은 세션에서 NULL 이 되어야 한다.
  IF OLD.payroll_status IS DISTINCT FROM NEW.payroll_status
     AND NEW.payroll_status = 'completed'
     AND COALESCE(current_setting('uniqn.defer_settlement_notify', true), 'off') <> 'on' THEN
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

  -- ==================== Case 4: 음수 정산 감지 (활성 admin 브로드캐스트) ====================
  -- payroll_amount가 0 이상 → 음수로 변경 시 (또는 최초 음수)
  --
  -- push-04: FOR 루프 + 건당 INSERT → **INSERT … SELECT 한 문**.
  --   문이 N개면 notifications STATEMENT 트리거도 N번 돌아 푸시가 admin 수만큼 갈라진다.
  --   레포 선례: fn_notify_cancellation_request(20260711030000)가 같은 형태다.
  --
  -- 수신자 필터: 종전 `role='admin'` 만 → **활성 계정만**(비활성·정지·탈퇴 제외).
  --   is_active 는 nullable(DEFAULT true), status 는 active/inactive/suspended/deleted 다.
  --   🔑 필터가 수신자를 0명으로 만들면 금전 경고가 조용히 사라지므로 WARNING 을 남긴다.
  IF COALESCE(NEW.payroll_amount, 0) < 0
     AND (OLD.payroll_amount IS NULL OR COALESCE(OLD.payroll_amount, 0) >= 0) THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, data, priority
    )
    SELECT
      u.id,
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
    FROM public.users u
    WHERE u.role = 'admin'
      AND COALESCE(u.is_active, true) = true
      AND COALESCE(u.status, 'active') = 'active';

    GET DIAGNOSTICS v_admin_notified = ROW_COUNT;
    IF v_admin_notified = 0 THEN
      RAISE WARNING '[notify_on_work_log_update] 음수 정산(work_log %)인데 수신 가능한 활성 admin 이 0명이다', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_work_log_update] failed for work_log % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_on_work_log_update() IS
  'work_logs UPDATE 시 6가지 알림 통합 처리: 취소 / 이력 기반 근무시간 변경 / 출근 예정 시각(time_slot) 변경 / 정산 완료 / 지급 완료 되돌리기 / 음수 정산 admin broadcast. '
  '이력 기반 변경과 출근 예정 시각 변경이 같은 UPDATE 에서 동시에 성립하면 앞의 한 통에 병합해 싣고 뒤는 침묵한다(저장 한 번 = 알림 한 통). '
  'push-01: 정산 완료(Case 3)는 GUC uniqn.defer_settlement_notify=on 이면 건너뛴다 — 일괄 정산이 루프 뒤에 한 문으로 모아 만든다. '
  'push-04: 음수 정산 브로드캐스트는 INSERT…SELECT 단문이고 활성 admin 만 수신한다(0명이면 WARNING).';

-- ------------------------------------------------------------
-- 2. bulk_settle_work_logs — 알림을 루프 밖 한 문으로 모은다 (push-01)
--    부분성공 계약(항목별 서브트랜잭션)은 그대로 둔다. 바뀐 것은 알림 생성 시점뿐이다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_settle_work_logs(
  p_work_log_ids uuid[],
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_id          uuid;
  v_res         jsonb;
  v_results     jsonb := '[]'::jsonb;
  v_success     int   := 0;
  v_failed      int   := 0;
  v_total_amt   numeric := 0;
  v_msg         text;
  v_settled_ids uuid[] := ARRAY[]::uuid[];
  v_notified    int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;

  IF p_work_log_ids IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: 정산할 근무 기록이 없습니다';
  END IF;

  -- 100 은 클라의 BATCH_CHUNK_SIZE 와 **같은 값이어야 한다**
  -- (SettlementRepository.ts). 클라는 청크당 이 함수를 1회 부른다.
  -- 전량을 한 번에 보내면 statement_timeout 에 걸려 부분성공이 통째로 사라진다.
  IF array_length(p_work_log_ids, 1) > 100 THEN
    RAISE EXCEPTION 'INVALID_INPUT: 한 번에 정산할 수 있는 근무 기록은 100건까지입니다';
  END IF;

  -- push-01: 루프 동안 Case 3(정산 완료 알림)을 끈다. 트랜잭션 로컬이라 밖으로 새지 않는다.
  PERFORM set_config('uniqn.defer_settlement_notify', 'on', true);

  FOREACH v_id IN ARRAY p_work_log_ids LOOP
    -- 항목별 서브트랜잭션. 부분 성공은 이 UX 의 계약이다 —
    -- all-or-nothing 으로 만들면 "3건 성공 / 2건 실패" 토스트가 성립하지 않는다.
    BEGIN
      v_res := public.settle_work_log(v_id, p_notes);

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'success', true, 'workLogId', v_id,
        'amount',  (v_res ->> 'amount')::numeric,
        'message', '정산 완료'
      ));
      v_success     := v_success + 1;
      v_total_amt   := v_total_amt + (v_res ->> 'amount')::numeric;
      v_settled_ids := v_settled_ids || v_id;

    EXCEPTION WHEN OTHERS THEN
      -- 전환 전 클라 구현이 항목별로 내던 문구를 그대로 보존한다.
      v_msg := CASE
        WHEN SQLERRM LIKE 'WORK_LOG_NOT_FOUND%' THEN '근무 기록을 찾을 수 없습니다'
        WHEN SQLERRM LIKE 'POSTING_NOT_FOUND%'  THEN '권한이 없는 공고입니다'
        WHEN SQLERRM LIKE 'PERMISSION_DENIED%'  THEN '권한이 없는 공고입니다'
        WHEN SQLERRM LIKE 'INVALID_STATUS%'     THEN '출퇴근이 완료되지 않았습니다'
        WHEN SQLERRM LIKE 'ALREADY_SETTLED%'    THEN '이미 정산 완료되었습니다'
        ELSE '정산 업데이트 실패'
      END;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'success', false, 'workLogId', v_id, 'amount', 0, 'message', v_msg
      ));
      v_failed := v_failed + 1;
    END;
  END LOOP;

  -- 스위치를 되돌린다 — 같은 트랜잭션에서 이후 개별 정산이 일어나도 정상 동작해야 한다.
  PERFORM set_config('uniqn.defer_settlement_notify', 'off', true);

  -- push-01 핵심: 성공 건 전체를 **한 문**으로 알린다 → net.http_post 가 N회에서 1회로.
  -- 내용·수신자·건수는 트리거 Case 3 와 동일해야 한다(회귀 고정: push_batching.test.sql).
  IF array_length(v_settled_ids, 1) > 0 THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    )
    SELECT
      wl.staff_id,
      'settlement_completed',
      '정산 완료',
      CASE WHEN jp.title IS NULL OR jp.title = ''
           THEN format('정산이 완료되었습니다. 지급액: %s원',
                       to_char(COALESCE(wl.payroll_amount, 0), 'FM999,999,999,999'))
           ELSE format('''%s'' 정산이 완료되었습니다. 지급액: %s원',
                       jp.title, to_char(COALESCE(wl.payroll_amount, 0), 'FM999,999,999,999'))
      END,
      '/schedule',
      jsonb_build_object(
        'workLogId', wl.id,
        'jobPostingId', wl.job_posting_id,
        'jobPostingTitle', COALESCE(jp.title, ''),
        'date', COALESCE(wl.date, ''),
        'payrollAmount', COALESCE(wl.payroll_amount, 0)::text,
        'payrollDate', COALESCE(wl.payroll_date::text, '')
      ),
      'high'
    FROM public.work_logs wl
    LEFT JOIN public.job_postings jp ON jp.id = wl.job_posting_id
    WHERE wl.id = ANY(v_settled_ids)
      -- recipient_id 는 NOT NULL 이다. 여기서 거르지 않으면 한 건 때문에 배치 전체가 실패한다
      -- (트리거 경로에서는 행별 EXCEPTION 이 삼켜 그 건만 조용히 빠졌다 — 같은 관용도를 지킨다).
      AND wl.staff_id IS NOT NULL;

    GET DIAGNOSTICS v_notified = ROW_COUNT;
    IF v_notified < array_length(v_settled_ids, 1) THEN
      RAISE WARNING '[bulk_settle_work_logs] 정산 %건 중 %건만 알림을 만들었다(staff_id 부재)',
        array_length(v_settled_ids, 1), v_notified;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'totalCount',   array_length(p_work_log_ids, 1),
    'successCount', v_success,
    'failedCount',  v_failed,
    'totalAmount',  v_total_amt,
    -- 입력 순서를 보존한다. formatBulkSettlementFailures 가 결정적 출력을 내려면
    -- 순서가 흔들리면 안 된다.
    'results',      v_results
  );
END;
$fn$;

COMMENT ON FUNCTION public.bulk_settle_work_logs(uuid[], text) IS
  '일괄 정산 확정(감사 L1). 항목별 서브트랜잭션으로 부분 성공 계약을 보존하고 settle_work_log 를 그대로 호출해 권한·상태·금액 규칙을 한 곳에만 둔다. '
  '상한 100 은 클라 BATCH_CHUNK_SIZE 와 같은 값이어야 한다. '
  'push-01: 루프 동안 정산 완료 알림을 끄고(GUC) 루프 뒤 한 문으로 모아 만든다 — 푸시 EF 호출이 N회에서 1회가 된다.';

REVOKE ALL ON FUNCTION public.bulk_settle_work_logs(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_settle_work_logs(uuid[], text) TO authenticated;

-- ------------------------------------------------------------
-- 3. push_tickets — Expo ticket 적재 + receipt 회수 결과 (push-02 DB 절반)
--
-- 왜: Expo 는 send 응답으로 ticket 만 주고 **실제 전달 여부는 receipt 로만** 알 수 있다.
--     지금까지 ticket 을 어디에도 저장하지 않아 receipts 폴링이 구조적으로 불가능했고,
--     net.http_post 응답도 버려서 DB 쪽 관측점이 0이었다. 이 테이블이 그 관측점이다.
--
-- 보존: notification_id 가 NOT NULL + ON DELETE CASCADE 라 notifications 보존 크론
--     (20260809140000 purge-old-notifications)이 지울 때 함께 사라진다 — 별도 정리 크론 불필요.
--
-- RLS: **정책 0개 + RLS 켬** = deny-all. EF 는 service_role(BYPASSRLS)로 접근한다.
--     사용자에게 노출할 이유가 없고, 정책을 안 만들었으므로 파리티 정책 수(110)가 불변이다.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tickets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id    uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  recipient_id       uuid,
  token              text NOT NULL,
  expo_ticket_id     text,
  status             text NOT NULL CHECK (status IN ('ok', 'error')),
  error_code         text,
  error_message      text,
  receipt_status     text CHECK (receipt_status IS NULL OR receipt_status IN ('ok', 'error')),
  receipt_error_code text,
  receipt_checked_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tickets ENABLE ROW LEVEL SECURITY;

-- receipts 폴링이 집는 대상: ticket 이 ok 로 발급됐고 아직 영수증을 못 본 것.
CREATE INDEX IF NOT EXISTS idx_push_tickets_pending_receipt
  ON public.push_tickets (created_at)
  WHERE status = 'ok' AND receipt_checked_at IS NULL;

COMMENT ON TABLE public.push_tickets IS
  'push-02: Expo push ticket 적재 + receipt 회수 결과. ticket ok 는 접수일 뿐 전달 보증이 아니다. '
  'poll-push-receipts EF 가 크론으로 영수증을 회수해 receipt_* 컬럼을 채우고 DeviceNotRegistered 토큰을 정리한다. '
  'RLS 정책 0개(deny-all) — service_role 전용. notifications CASCADE 로 보존기간을 상속한다.';

-- ------------------------------------------------------------
-- 4. receipts 폴링 크론 — 15분마다 poll-push-receipts EF 호출
--    ticket 발급 직후에는 영수증이 준비되지 않는다(Expo 권고: 15분 이상 뒤 조회).
-- ------------------------------------------------------------
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'poll-push-receipts') THEN
    PERFORM cron.unschedule('poll-push-receipts');
  END IF;

  PERFORM cron.schedule(
    'poll-push-receipts',
    '*/15 * * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
               || '/functions/v1/poll-push-receipts',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $cron$
  );
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    RAISE WARNING '[push-02] pg_cron/pg_net 미설치 — receipts 폴링 크론 skip';
END $do$;
