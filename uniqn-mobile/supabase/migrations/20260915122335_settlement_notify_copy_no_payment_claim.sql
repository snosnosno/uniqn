-- ============================================================
-- 정산 알림 문구 — 앱이 송금했다고 말하지 않는다 (구인자 IA 웨이브 후속)
-- 2026-09-15
-- ============================================================
--
-- 무엇이 문제였나
--   스태프가 받던 문구는 `정산이 완료되었습니다. 지급액: 500,000원` 이었다. 받는 사람은
--   이것을 "돈이 들어왔다/들어온다"는 보증으로 읽는다. **앱은 돈을 보내지 않는다.**
--   앱이 하는 일은 근무 시간으로 금액을 확정해 기록하는 것까지고, 실제 지급은 사장과
--   스태프가 따로 정한 방법으로 이루어진다. 구인자 IA 웨이브(#492)가 구인자 화면에서
--   `지급 대기 / 지급 완료` 상태와 지급 버튼을 걷어낸 것도 같은 이유였는데, 스태프에게
--   나가는 이 문구만 옛 모델을 그대로 말하고 있었다.
--
-- 무엇을 바꾸나 — **문구 문자열뿐이다.**
--   `정산 완료`        → `정산 금액 확정`
--   `지급 완료 취소`   → `정산 금액 확정 취소`
--   본문은 확정 사실 + 지급이 앱 밖에서 이루어진다는 사실을 함께 말한다.
--
-- 무엇을 바꾸지 않나 (일부러)
--   - `notification_type` 값(`settlement_completed` / `settlement_reverted`) — 클라 라우팅·
--     아이콘·카테고리·우선순위가 전부 이 값을 키로 쓴다. 바꾸면 구버전 앱에서 알림이
--     미분류로 떨어진다.
--   - `data` jsonb 키(`payrollAmount` 등), `link`, `priority`, 수신자, 발화 조건.
--   - Case 3 지연 스위치(`uniqn.defer_settlement_notify`)와 일괄 경로의 배치 구조.
--   - `bulk_settle_work_logs` 의 항목별 결과 라벨 `'message', '정산 완료'` — 사용자 대면
--     알림이 아니라 부분 성공 집계용 내부 값이다(formatBulkSettlementFailures 소비).
--
-- 🔑 정본이 셋이다 — 하나만 고치면 조용히 갈라진다
--   ① 트리거 Case 3   ② 트리거 Case 3-B   ③ bulk_settle_work_logs 의 배치 INSERT
--   ①과 ③은 **내용이 같아야 한다**(원래 계약). `push_batching.test.sql` 은 건수·우선순위만
--   보고 문구는 보지 않으므로, 갈라져도 테스트는 초록이다. 이 파일은 셋을 한 번에 바꾼다.
--   클라 사본 2곳(notificationTemplates.ts · notificationMessageNormalizer.ts)도 같은
--   커밋에서 맞췄다.
--
-- 적용 근거: 이 파일의 두 함수 본문은 20260809150000 의 정의를 스크립트로 그대로 옮기고
--   위 문자열만 치환한 것이다. 치환 직전 prod 실측으로 드리프트가 없음을 확인했다 —
--   prosrc md5 notify=ff9ad72c95fe3614579f5a824d5fb5c6(15,429자) /
--   bulk=19910ad0dc84fb2b8b88c82f606ace54(4,177자) 가 레포 정의와 일치했다.
-- ============================================================

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
      '정산 금액 확정',
      CASE WHEN v_job_title IS NULL OR v_job_title = ''
           THEN format('정산 금액이 %s원으로 확정되었습니다. 실제 지급은 사장님과 정한 방법으로 이루어집니다.', v_amount_label)
           ELSE format('''%s'' 정산 금액이 %s원으로 확정되었습니다. 실제 지급은 사장님과 정한 방법으로 이루어집니다.', v_job_title, v_amount_label)
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
      '정산 금액 확정 취소',
      CASE WHEN v_job_title IS NULL OR v_job_title = ''
           THEN format('정산 금액 확정(%s원)이 취소되어 정산 대기로 되돌아갔습니다.%s',
                       v_amount_label, v_revert_reason_suffix)
           ELSE format('''%s'' 정산 금액 확정(%s원)이 취소되어 정산 대기로 되돌아갔습니다.%s',
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
      '정산 금액 확정',
      CASE WHEN jp.title IS NULL OR jp.title = ''
           THEN format('정산 금액이 %s원으로 확정되었습니다. 실제 지급은 사장님과 정한 방법으로 이루어집니다.',
                       to_char(COALESCE(wl.payroll_amount, 0), 'FM999,999,999,999'))
           ELSE format('''%s'' 정산 금액이 %s원으로 확정되었습니다. 실제 지급은 사장님과 정한 방법으로 이루어집니다.',
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

-- `COMMENT ON FUNCTION` 은 이 파일에서 **재기술하지 않는다.** 코멘트는 함수 본문(prosrc)과
-- 별개로 `pg_description` 에 살고 `CREATE OR REPLACE FUNCTION` 이 지우지 않으므로,
-- 20260809150000 이 심어둔 두 코멘트가 그대로 남는다. 그 코멘트가 쓰는 `정산 완료` ·
-- `지급 완료 되돌리기` 는 사용자 문구가 아니라 **트리거 케이스의 식별자**라, 이번 문구 교체
-- 뒤에도 여전히 사실과 부합한다.

-- ============================================================
-- 적용 직후 자기 검증 — 권한·보안 속성이 보존됐는가
-- ============================================================
-- `CREATE OR REPLACE FUNCTION` 은 소유자·ACL·SECURITY 속성을 보존한다(문서화된 동작)라서
-- 이 파일에는 REVOKE/GRANT 를 다시 쓰지 않았다. 문제는 **보존이 깨져도 조용하다**는 것이다.
--   · authenticated 의 EXECUTE 가 사라지면 → 일괄 정산이 통째로 막힌다
--   · PUBLIC/anon 에 열리면 → 로그인 없이 남의 정산을 확정할 수 있다
-- 둘 다 다음 사람이 화면을 눌러보기 전까지 아무도 모른다. 그래서 여기서 깨뜨린다.
--
-- 🔑 안전망이 하나 더 있다(리뷰에서 지목): `supabase/tests/settlement_settle_rpcs.test.sql:103-106`
--    이 `bulk_settle_work_logs` 의 anon EXECUTE 없음 / authenticated EXECUTE 있음을 이미
--    매 DB Tests 마다 단언한다. 아래 블록은 **적용 시점에 즉시** 터지게 하는 쪽이고, pgTAP 는
--    CI 에서 잡는 쪽이다. 시그니처·리턴타입이 원본과 같아 OID 가 유지되므로(진짜 '교체')
--    ACL 보존은 문서화된 동작이지만, 조용히 깨지는 축이라 둘 다 둔다.
--
-- 기대값은 2026-09-15 prod 실측이다:
--   bulk_settle_work_logs     postgres=X | authenticated=X | service_role=X
--   notify_on_work_log_update postgres=X | service_role=X            (트리거 함수 — 직접 호출 없음)
DO $verify$
DECLARE
  v_oid     oid;
  v_acl     text;
  v_secdef  boolean;
  v_config  text[];
BEGIN
  -- ── bulk_settle_work_logs(uuid[], text) ──────────────────────────────────
  -- 🔑 시그니처를 못 박아 조회한다. `WHERE proname = '…'` 로 찾으면 나중에 같은 이름의
  --    오버로드가 생겼을 때 `SELECT INTO` 가 (STRICT 가 없으므로) 순서 보장 없이 첫 행만
  --    보고 **엉뚱한 오버로드의 권한을 검증하고 통과한다.** 지금은 오버로드가 없지만
  --    (실측 확인) 조용히 무력화될 길을 열어둘 이유가 없다.
  --    `to_regprocedure` 는 없으면 RAISE 대신 NULL 을 주므로 우리 문구로 실패할 수 있다.
  v_oid := to_regprocedure('public.bulk_settle_work_logs(uuid[], text)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'bulk_settle_work_logs(uuid[], text) 가 없다 — CREATE OR REPLACE 가 적용되지 않았다';
  END IF;

  SELECT array_to_string(p.proacl, ' | '), p.prosecdef, p.proconfig
    INTO v_acl, v_secdef, v_config
  FROM pg_proc p WHERE p.oid = v_oid;

  -- 🔴 proacl 이 NULL 이면 "권한을 한 번도 명시하지 않은 기본 상태" = **PUBLIC 에 EXECUTE 가
  --    열려 있다**는 뜻이다. 가장 나쁜 상태인데 NULL 이라 아래 어떤 LIKE 에도 안 걸린다.
  --    (첫 판에서는 COALESCE 로 '(default: PUBLIC EXECUTE)' 라는 읽기 좋은 문자열로 바꿨는데,
  --     그 sentinel 이 세 패턴 중 어디에도 매칭되지 않아 **읽기 좋게 만든 것이 가드를
  --     무력화했다**. 리뷰에서 지목돼 실측으로 확인했다.)
  IF v_acl IS NULL THEN
    RAISE EXCEPTION 'bulk_settle_work_logs: proacl 이 기본값(NULL)으로 되돌아갔다 — PUBLIC 에 EXECUTE 가 열렸다';
  END IF;

  IF v_acl NOT LIKE '%authenticated=X%' THEN
    RAISE EXCEPTION 'bulk_settle_work_logs: authenticated EXECUTE 유실 — %', v_acl;
  END IF;
  -- proacl 에서 PUBLIC 은 grantee 가 빈 문자열(`=X/postgres`)로 나타난다. 배열 맨 앞이면
  -- `=%`, 중간·끝이면 앞에 반드시 `| ` 가 붙으므로 두 패턴이 세 위치를 모두 덮는다.
  IF v_acl LIKE '=%' OR v_acl LIKE '%| =%' OR v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'bulk_settle_work_logs: PUBLIC/anon 에 열렸다 — %', v_acl;
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'bulk_settle_work_logs: SECURITY DEFINER 유실';
  END IF;
  IF v_config IS NULL OR NOT (v_config @> ARRAY['search_path=public, pg_temp']) THEN
    RAISE EXCEPTION 'bulk_settle_work_logs: search_path 고정 유실 — %', v_config;
  END IF;

  -- ── notify_on_work_log_update() ──────────────────────────────────────────
  -- ⚠️ 이 함수는 `RETURNS trigger` 라 Postgres 가 트리거 발화 밖의 직접 호출을 언어 차원에서
  --    거부한다 — EXECUTE 가 PUBLIC 에 열려도 공격 경로가 아니다. 그래도 같은 가드를 두는 건
  --    "권한이 기본값으로 되돌아갔다"가 **다른 것도 되돌아갔다는 신호**이기 때문이다.
  v_oid := to_regprocedure('public.notify_on_work_log_update()');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'notify_on_work_log_update() 가 없다 — CREATE OR REPLACE 가 적용되지 않았다';
  END IF;

  SELECT array_to_string(p.proacl, ' | '), p.prosecdef, p.proconfig
    INTO v_acl, v_secdef, v_config
  FROM pg_proc p WHERE p.oid = v_oid;

  IF v_acl IS NULL THEN
    RAISE EXCEPTION 'notify_on_work_log_update: proacl 이 기본값(NULL)으로 되돌아갔다 — PUBLIC 에 EXECUTE 가 열렸다';
  END IF;
  IF v_acl LIKE '=%' OR v_acl LIKE '%| =%' OR v_acl LIKE '%anon=%' THEN
    RAISE EXCEPTION 'notify_on_work_log_update: PUBLIC/anon 에 열렸다 — %', v_acl;
  END IF;
  IF v_secdef IS NOT TRUE THEN
    RAISE EXCEPTION 'notify_on_work_log_update: SECURITY DEFINER 유실';
  END IF;
  IF v_config IS NULL OR NOT (v_config @> ARRAY['search_path=public, extensions, pg_temp']) THEN
    RAISE EXCEPTION 'notify_on_work_log_update: search_path 고정 유실 — %', v_config;
  END IF;

  -- ── 트리거가 여전히 이 함수에 붙어 있는가 (문구만 바꿨으니 붙어 있어야 한다) ──
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgfoid = v_oid AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'notify_on_work_log_update 에 붙은 트리거가 없다 — 알림이 전부 멈춘다';
  END IF;

  RAISE NOTICE '[20260915122335] 권한·보안·트리거 보존 확인됨';
END
$verify$;
