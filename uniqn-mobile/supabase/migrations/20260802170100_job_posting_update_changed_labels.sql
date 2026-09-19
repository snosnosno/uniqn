-- ============================================================
-- 공고 수정 알림에 "무엇이 바뀌었는지" 싣기 (notify_on_job_posting_update 재정의)
--
-- 배경
--   현행 본문은 어떤 수정이든 똑같이 "'제목' 공고가 수정되었습니다. 변경 내용을 확인하세요."
--   한 문장이다. 지원자는 **일당이 깎인 건지 오타를 고친 건지 구분할 수 없다.**
--   상세로 들어가도 대조가 불가능하다 — 공고에는 변경 이력이 없어 '수정 전' 값이 어디에도 없다.
--   `data.changedFields` 를 이미 싣고 있지만 클라이언트에서 읽는 코드는 0건이라
--   사실상 아무 데도 도달하지 못한다.
--
--   ⚠️ 지금 고쳐야 하는 이유: 이 알림은 `text[] || 'literal'` 타입 해석 오류
--   (`malformed array literal`)로 **한 번도 나가지 못했고** EXCEPTION 핸들러가 그것을 삼켰다.
--   20260727000000_posting_auto_close_gaps.sql §7 이 `array_append` 로 복구했으므로
--   **이제부터 실제로 발송되기 시작한다.** 첫 발송이 나가기 전에 문구를 고친다.
--
-- 이 마이그레이션이 바꾸는 것
--   - 수정 분기에서 영어 키(`v_changed_fields`)와 **한글 라벨(`v_changed_labels`)을 병행 적립**한다.
--   - 본문 맨 앞에 라벨을 넣는다 — 알림 목록에서 body 는 2줄로 잘리므로,
--     공고 제목이 길면 뒤쪽이 통째로 사라진다. 중요한 정보를 앞에 둔다.
--   - 라벨 순서는 **중요도순**(급여 → 근무일 → 근무 장소 → 모집 역할 → 공고 유형 → 제목).
--     `DISTINCT`/`ORDER BY` 는 쓰지 않는다 — 가나다순으로 재정렬돼 중요도가 뒤집힌다.
--     중복은 적립 시점에 OR 로 합쳐 원천 차단한다(work_date·work_dates·schedule → '근무일' 1개).
--
-- 이 마이그레이션이 **바꾸지 않는 것** (한 글자도 손대지 않았다)
--   - 1) status → 'cancelled' 취소 알림 분기
--   - 2) status → 'closed' 마감 알림 분기
--   - status 를 변경필드에서 제외하는 결정(좌석 트리거의 active ↔ capacity_full 자동 전이가
--     지원자 전원에게 '공고 수정' 알림 폭탄을 만드는 것을 막는다 — 20260727000000 §7 참조)
--   - 수신자 집합(confirmed/applied/cancellation_pending 지원자)
--   - `data.changedFields`(영어 키, 적립 순서 포함) — 소비처가 0건이지만 계약은 유지한다.
--
-- ⚠️ 함수 카운트 불변 — CREATE OR REPLACE 재정의다(신설 아님).
--    DROP FUNCTION 금지: 20260731090000 이 회수한 PUBLIC EXECUTE 가 기본 GRANT 로 되살아난다.
--    search_path 헤더는 현행 정의(20260727000000 §7)를 그대로 복사했다 — pg_temp 포함.
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
  END IF;

  -- 해당 공고에 지원한 활성 지원자 전원에게 알림 INSERT
  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  )
  SELECT DISTINCT
    a.applicant_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    v_notif_link,
    v_notif_data,
    v_notif_priority
  FROM public.applications a
  WHERE a.job_posting_id = NEW.id
    AND a.status IN ('confirmed', 'applied', 'cancellation_pending');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_update] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.notify_on_job_posting_update() IS
  'job_postings UPDATE 시 지원자에게 수정/마감/취소 알림. 수정 알림 본문은 변경된 항목의 한글 라벨을 '
  '중요도순(급여·근무일·근무 장소·모집 역할·공고 유형·제목)으로 문장 맨 앞에 싣는다. '
  'status 는 변경필드에서 의도적으로 제외(capacity_full 자동 전이 알림 폭탄 방지).';

-- CREATE OR REPLACE 는 기존 ACL 을 보존하지만, 20260731090000 의 회수 상태를
-- 명시적으로 재확인한다(트리거 함수는 소유자 권한으로 실행되므로 동작에 영향 없음).
REVOKE ALL ON FUNCTION public.notify_on_job_posting_update() FROM PUBLIC, anon, authenticated;
