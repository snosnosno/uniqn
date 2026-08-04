-- ============================================================
-- 공고 수정 알림 — 계약 보유자 분기 문구 중립화 (3-C 후속)
-- ============================================================
--
-- 배경: `notify_on_job_posting_update` 는 근무일 축이 바뀌면 계약 보유자(확정 지원자 +
--   직접 배치 스태프)에게 별도 문구를 보내고 `/schedule` 로 안내한다(R0 = 20260803120000:576-583).
--   그 문장은 **"이미 확정된 내 근무 시간은 바뀌지 않습니다"** 였다.
--
--   이 단언은 3-C 이전에는 참이었다. "공고=광고, work_logs=계약"이라 공고 원문 수정이
--   확정된 근무 시각을 건드릴 수 없었기 때문이다.
--
-- 🔴 3-C(`update_posting_slot_time`)가 그 전제를 깼다.
--   3-C 는 work_logs 의 시각을 옮기면서 공고 원문 정원도 함께 옮긴다(설계 §10-3).
--   `schedule` jsonb 가 달라지므로 `v_date_changed` 가 참이 되고(:520-523), 옮겨진 당사자는
--   같은 순간에 정반대인 두 통을 받는다:
--
--     ① `schedule_change`  "출근 예정 시간이 변경되었습니다: 18:00 → 09:00"   (Case 2-B, #382)
--     ② `job_updated`      "… 이미 확정된 내 근무 시간은 바뀌지 않습니다"      (이 함수)
--
-- 해결: **문구만 중립화한다.** 거짓이 될 수 있는 단언을 지우고, 어느 경우에도 참인
--   안내(근무표에서 확인)만 남긴다. 분기 조건·수신자·링크·우선순위·데이터는 전부 불변이다.
--
--     변경 전: ' 이미 확정된 내 근무 시간은 바뀌지 않습니다 — 근무표에서 확인해 주세요.'
--     변경 후: ' 확정된 내 근무 시간은 근무표에서 확인해 주세요.'
--
--   🔑 왜 이 방식인가 (기각한 대안 2종)
--   - **그대로 두기**: 옮겨진 사람에게 거짓 문장이 계속 나간다. 시간·출근에 닿는 오정보라 기각.
--   - **3-C 실행 중 ② 억제(GUC 플래그)**: 검증된 알림 경로에 새 분기를 넣는 일이고,
--     같은 공고의 **미확정 지원자**가 자리 축소를 모르게 된다(설계 §10-4 가 억제를 기각한 이유).
--   문구 중립화는 로직을 건드리지 않으면서 3-C 뿐 아니라 앞으로 `schedule` 을 바꾸는
--   **모든 경로**에서 거짓 단언을 없앤다.
--
-- 본문은 `20260803120000_time_slot_sentinel_unification.sql:430-644`(가장 최근 정의)를
-- 그대로 옮기고 위 한 문장만 교체했다. 함수 시그니처가 같으므로 파리티 함수 수는 불변(199).
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
  v_changed_labels text[] := ARRAY[]::text[];
  v_date_changed boolean;
  v_last_label text;
  v_last_char_code int;
  v_josa text;
  v_status_transitioned boolean;
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
  v_notif_link text;
  v_notif_priority text;
  v_notif_data jsonb;
  -- [R0] 계약 보유자(확정 지원자 + 직접배치 스태프) 전용 문구·목적지.
  --      NULL 이면 분리하지 않고 전원이 같은 알림을 받는다(기존 동작).
  v_contract_body text;
  v_contract_link text;
BEGIN
  v_status_transitioned := OLD.status IS DISTINCT FROM NEW.status;

  -- 1) status → 'cancelled' 전환: 공고 취소 알림 (high)
  IF v_status_transitioned AND NEW.status = 'cancelled' THEN
    v_notif_type := 'job_cancelled';
    v_notif_title := '🚫 공고 취소';
    v_notif_body := format('''%s''가 취소되었습니다.', COALESCE(NEW.title, '공고'));
    v_notif_link := '/schedule';
    v_notif_priority := 'high';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'senderId', NEW.owner_id
    );

  -- 2) status → 'closed' 전환: 공고 마감 알림 (normal)
  ELSIF v_status_transitioned AND NEW.status = 'closed' THEN
    v_notif_type := 'job_closed';
    v_notif_title := '📋 공고 마감 안내';
    v_notif_body := format('''%s''가 마감되었습니다.', COALESCE(NEW.title, '공고'));
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'senderId', NEW.owner_id
    );

  -- 3) 기타 필드 변경: 공고 수정 알림 (normal)
  ELSE
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_changed_fields := array_append(v_changed_fields, 'title');
    END IF;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      v_changed_fields := array_append(v_changed_fields, 'location');
    END IF;
    IF OLD.work_date IS DISTINCT FROM NEW.work_date THEN
      v_changed_fields := array_append(v_changed_fields, 'workDate');
    END IF;
    IF OLD.work_dates IS DISTINCT FROM NEW.work_dates THEN
      v_changed_fields := array_append(v_changed_fields, 'workDates');
    END IF;
    IF OLD.schedule IS DISTINCT FROM NEW.schedule THEN
      v_changed_fields := array_append(v_changed_fields, 'schedule');
    END IF;
    IF OLD.compensation IS DISTINCT FROM NEW.compensation THEN
      v_changed_fields := array_append(v_changed_fields, 'compensation');
    END IF;
    IF OLD.role_catalog IS DISTINCT FROM NEW.role_catalog THEN
      v_changed_fields := array_append(v_changed_fields, 'roleCatalog');
    END IF;
    IF OLD.posting_type IS DISTINCT FROM NEW.posting_type THEN
      v_changed_fields := array_append(v_changed_fields, 'postingType');
    END IF;
    -- status 는 의도적으로 제외 (위 ⚠️ 참조 — capacity_full 자동 전이 알림 폭탄 방지)

    IF array_length(v_changed_fields, 1) IS NULL THEN
      RETURN NEW;
    END IF;

    -- ---- 한글 라벨 적립 (중요도순) ----
    -- 지원자 입장에서 "출근 여부를 다시 판단해야 하는가"가 중요도의 기준이다.
    -- 급여·근무일이 최상단, 단순 표기 변경인 제목이 최하단.
    -- 중복 가드: 날짜 축 3개(work_date/work_dates/schedule)는 OR 로 합쳐 '근무일' 1개만 적립한다.
    -- (DISTINCT 를 쓰면 가나다순으로 재정렬돼 중요도 순서가 무너진다)
    v_date_changed :=
      (OLD.work_date IS DISTINCT FROM NEW.work_date)
      OR (OLD.work_dates IS DISTINCT FROM NEW.work_dates)
      OR (OLD.schedule IS DISTINCT FROM NEW.schedule);

    IF OLD.compensation IS DISTINCT FROM NEW.compensation THEN
      v_changed_labels := array_append(v_changed_labels, '급여');
    END IF;
    IF v_date_changed THEN
      v_changed_labels := array_append(v_changed_labels, '근무일');
    END IF;
    IF OLD.location IS DISTINCT FROM NEW.location THEN
      v_changed_labels := array_append(v_changed_labels, '근무 장소');
    END IF;
    IF OLD.role_catalog IS DISTINCT FROM NEW.role_catalog THEN
      v_changed_labels := array_append(v_changed_labels, '모집 역할');
    END IF;
    IF OLD.posting_type IS DISTINCT FROM NEW.posting_type THEN
      v_changed_labels := array_append(v_changed_labels, '공고 유형');
    END IF;
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      v_changed_labels := array_append(v_changed_labels, '제목');
    END IF;

    -- ---- 조사(이/가) 결정 ----
    -- 마지막 라벨의 받침 유무로 고른다. '급여가 / 근무일이' 처럼 자연스러워야
    -- 알림이 기계가 쓴 문장으로 읽히지 않는다.
    -- 한글 음절 영역(U+AC00~U+D7A3)에서 (코드 - 0xAC00) % 28 = 0 이면 종성 없음.
    v_last_label := v_changed_labels[array_length(v_changed_labels, 1)];
    v_last_char_code := ascii(right(v_last_label, 1));
    IF v_last_char_code BETWEEN 44032 AND 55203
       AND (v_last_char_code - 44032) % 28 = 0 THEN
      v_josa := '가';
    ELSE
      v_josa := '이';
    END IF;

    v_notif_type := 'job_updated';
    v_notif_title := '📝 공고 수정 안내';
    -- 라벨을 문장 맨 앞에 둔다 — 목록에서 body 가 2줄로 잘려도 무엇이 바뀌었는지는 남는다.
    v_notif_body := format(
      '%s%s 변경되었습니다. ''%s'' 공고를 확인해 주세요.',
      array_to_string(v_changed_labels, '·'),
      v_josa,
      COALESCE(NEW.title, '공고')
    );
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'changedFields', array_to_string(v_changed_fields, ', '),
      'changedLabels', array_to_string(v_changed_labels, '·'),
      'senderId', NEW.owner_id
    );

    -- [R0] 근무일·시간 축이 바뀐 경우에만 계약 보유자를 분리한다.
    --      공고는 광고이고 확정된 근무 시간의 정본은 work_logs 다 — 공고 링크로 보내면
    --      "내 시간이 바뀌었나?"를 확인할 수 없는 곳으로 보내는 셈이다.
    -- [3-C] 문구 중립화: 예전엔 "바뀌지 않습니다"라고 단언했으나, update_posting_slot_time 이
    --      work_logs 시각과 공고 정원을 함께 옮기면서 그 단언이 거짓이 될 수 있게 됐다.
    --      확정 시각이 바뀐 사람은 별도로 schedule_change 알림을 받으므로, 여기서는
    --      "근무표를 보라"는 안내만 남긴다 — 어느 경우에도 참인 문장이다.
    IF v_date_changed THEN
      v_contract_body := v_notif_body
        || ' 확정된 내 근무 시간은 근무표에서 확인해 주세요.';
      v_contract_link := '/schedule';
    END IF;
  END IF;

  -- 수신자 = 활성 지원자 ∪ 직접 배치 스태프. recipient_id 기준으로 1건만 발송한다.
  WITH recipients AS (
    -- 🔑 `cancellation_pending` 도 계약 보유자다 — 확정 뒤 취소를 **요청**한 상태일 뿐
    --    승인 전까지 work_logs 는 살아 있다. 광고 문구를 보내면 이 분리의 취지와 어긋난다.
    SELECT a.applicant_id AS recipient_id,
           bool_or(a.status IN ('confirmed', 'cancellation_pending')) AS is_contracted
    FROM public.applications a
    WHERE a.job_posting_id = NEW.id
      AND a.status IN ('confirmed', 'applied', 'cancellation_pending')
    GROUP BY a.applicant_id

    UNION ALL

    -- [R0] 지원서 없이 근무표에 직접 배치된 스태프(application_id IS NULL).
    --      취소·무단결근 행은 제외 — 이미 계약이 끝난 사람이다.
    SELECT wl.staff_id, true
    FROM public.work_logs wl
    WHERE wl.job_posting_id = NEW.id
      AND wl.application_id IS NULL
      AND wl.status NOT IN ('cancelled', 'no_show')
  ),
  merged AS (
    SELECT recipient_id, bool_or(is_contracted) AS is_contracted
    FROM recipients
    WHERE recipient_id IS NOT NULL
    GROUP BY recipient_id
  )
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT
    m.recipient_id,
    v_notif_type,
    v_notif_title,
    CASE WHEN m.is_contracted AND v_contract_body IS NOT NULL
         THEN v_contract_body ELSE v_notif_body END,
    CASE WHEN m.is_contracted AND v_contract_link IS NOT NULL
         THEN v_contract_link ELSE v_notif_link END,
    v_notif_data,
    v_notif_priority
  FROM merged m;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_update] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.notify_on_job_posting_update() IS
  'job_postings UPDATE 시 지원자에게 수정/마감/취소 알림. 수정 알림 본문은 변경된 항목의 한글 라벨을 '
  '중요도순(급여·근무일·근무 장소·모집 역할·공고 유형·제목)으로 문장 맨 앞에 싣는다. '
  'status 는 변경필드에서 의도적으로 제외(capacity_full 자동 전이 알림 폭탄 방지). '
  '[R0] 수신자에 직접 배치 스태프(application_id NULL) 포함 + 근무일 변경 시 계약 보유자는 /schedule 로 분리.';

-- CREATE OR REPLACE 는 기존 ACL 을 보존하지만, `20260731090000_revoke_public_execute_trigger_functions.sql`
-- (prod 기록명 `20260730174805`)의 회수 상태를 명시적으로 재확인한다
-- (트리거 함수는 소유자 권한으로 실행되므로 동작에 영향 없음).
REVOKE ALL ON FUNCTION public.notify_on_job_posting_update() FROM PUBLIC, anon, authenticated;
