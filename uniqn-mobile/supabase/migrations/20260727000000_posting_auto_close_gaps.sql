-- ============================================================
-- 공고 자동 마감 사각지대 정리 (2026-07-27)
--
-- 배경: 20260726120000_sync_last_work_date 로 날짜 기반 자동 마감이 되살아난 뒤
--   (07-27 00:17 KST 첫 실행에서 16건 closed) 전 구간을 재점검하며 나온 잔여 결함 4종.
--
--   1) 유령 크론 — `retry-failed-counter-ops` 가 30일간 120/120 전량 실패.
--      대상 컬럼 `users.unread_notification_count` 가 실재하지 않는다(미읽음 수는
--      Edge Function 이 별도 계산). 6시간마다 에러만 쌓는 잔재라 제거한다.
--
--   2) 마감돼도 미확정 지원(applied)이 그대로 남는다 — 지원자는 '대기중' 상태로
--      결과를 영영 받지 못한다. 자동 마감에 한해 rejected 로 종결한다.
--      (수동 마감은 제외 — reopen 경로가 있어 사장이 되돌릴 수 있다)
--
--   3) 고정(fixed) 공고 만료 사각지대 — 신규 고정 공고는 `fixed_config` 가 NULL 이라
--      `expiresAt IS NOT NULL` 가드를 통과하지 못하고, 날짜 크론의 posting_type
--      대상에도 없어 **어떤 경로로도 마감되지 않는다**. 클라이언트 writer 추가
--      (serialization.buildFixedConfig)와 별개로, 서버에도 created_at + 7일 fallback 을 둔다.
--
--   4) 처리 건수 관측 부재 — `cron.job_run_details.return_message` 는 SELECT 반환 행 수라
--      항상 "1 row" 다. writer 가 또 끊겨 0건을 처리해도 로그상 정상으로 보인다.
--      실행마다(0건 포함) action_logs 에 처리 건수를 남긴다.
--
--   5) '공고 수정' 알림이 한 번도 나가지 못했다 — `text[] || 'literal'` 타입 해석 오류로
--      항상 예외가 나고 핸들러가 삼켰다(prod job_updated 누적 0건). 복구하되 status 는
--      변경필드에서 제외한다(capacity_full 자동 전이 알림 폭탄 방지). 상세는 7번 섹션.
--
-- ⚠️ 함수 카운트: +2 (fn_expire_pending_applications_on_close · fn_log_scheduled_close)
--    → 181 → 183. parity_baseline_guard 단언 리터럴 + PARITY_EXPECT_FUNCS 마커 동시 갱신됨.
--    정책 카운트는 불변(테이블·RLS 미변경 — action_logs 재사용).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 유령 크론 제거
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE WARNING '[posting_auto_close_gaps] pg_cron 미설치 — unschedule skip';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-failed-counter-ops') THEN
    PERFORM cron.unschedule('retry-failed-counter-ops');
    RAISE NOTICE '[posting_auto_close_gaps] retry-failed-counter-ops unscheduled';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. 자동 마감 시 미확정 지원 종결
--
-- `AFTER UPDATE OF status` 를 쓰지 않는 이유: `UPDATE OF` 는 문장에 명시된 컬럼
-- 기준이라, BEFORE 트리거(fn_fixed_posting_expired)가 값을 closed 로 뒤집는 경로에서는
-- 발동하지 않는다. WHEN 절로 실제 값 전이를 본다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_expire_pending_applications_on_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rejected_count integer;
BEGIN
  -- 자동 마감만 대상. 수동 마감('manual')은 reopen 으로 되돌릴 수 있어 건드리지 않는다.
  IF COALESCE(NEW.closed_reason, '') NOT IN ('expired', 'expired_by_work_date') THEN
    RETURN NULL;
  END IF;

  WITH rejected AS (
    UPDATE public.applications
    SET
      status = 'rejected',
      rejection_reason = CASE NEW.closed_reason
        WHEN 'expired_by_work_date' THEN '공고 자동 마감 (근무일 경과)'
        ELSE '공고 자동 마감 (모집 기간 만료)'
      END,
      -- 알림 억제 키 — notify_on_application_update 가 이 값으로 시스템 거절을 식별한다.
      processed_by = 'system:auto_close',
      processed_at = now(),
      updated_at = now()
    WHERE job_posting_id = NEW.id
      AND status = 'applied'
    RETURNING id
  )
  SELECT count(*) INTO v_rejected_count FROM rejected;

  IF v_rejected_count > 0 THEN
    RAISE NOTICE '[expire_pending_applications] posting % — rejected % applications',
      NEW.id, v_rejected_count;
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- 지원 종결 실패가 공고 마감 자체를 되돌리면 안 된다.
  RAISE WARNING '[expire_pending_applications] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS tr_expire_pending_applications ON public.job_postings;
CREATE TRIGGER tr_expire_pending_applications
  AFTER UPDATE ON public.job_postings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'closed')
  EXECUTE FUNCTION public.fn_expire_pending_applications_on_close();

-- ------------------------------------------------------------
-- 3. 시스템 자동 거절은 '지원 거절' 알림을 보내지 않는다
--
-- 자동 마감 시 지원자는 이미 job_closed('공고 마감 안내') 알림을 받는다.
-- 여기에 '지원 거절'까지 겹치면 사장이 거절한 것처럼 읽힌다.
-- 변경점은 rejected 블록의 processed_by 가드 한 줄뿐 — 나머지는 기존 정의 그대로.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_application_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_job_title text;
  v_owner_id uuid;
  v_label text;
  v_old_cancel_status text;
  v_new_cancel_status text;
  v_rejection_reason text;
BEGIN
  -- 변경 감지: status 또는 cancellation_request.status
  v_old_cancel_status := OLD.cancellation_request ->> 'status';
  v_new_cancel_status := NEW.cancellation_request ->> 'status';

  IF OLD.status = NEW.status
     AND v_old_cancel_status IS NOT DISTINCT FROM v_new_cancel_status THEN
    RETURN NEW;
  END IF;

  -- 공고 정보 조회
  SELECT title, owner_id INTO v_job_title, v_owner_id
  FROM public.job_postings
  WHERE id = NEW.job_posting_id;

  v_label := CASE
    WHEN v_job_title IS NULL OR v_job_title = '' THEN '해당 공고'
    ELSE format('''%s''', v_job_title)
  END;

  -- ============ status 전환 ============
  -- (이 함수는 applications 트리거다 — job_postings 쪽 notify_on_job_posting_update 와 별개)

  -- applied → confirmed: 지원 확정 (high priority)
  IF OLD.status = 'applied' AND NEW.status = 'confirmed' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'application_confirmed',
      '지원 확정',
      format('%s 지원이 확정되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  -- → cancelled (cancellation_request 승인 외): 확정 취소
  IF OLD.status <> NEW.status
     AND NEW.status = 'cancelled'
     AND COALESCE(v_new_cancel_status, '') <> 'approved' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'confirmation_cancelled',
      '확정 취소',
      format('%s 확정이 취소되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- → rejected: 지원 거절
  -- 단, 자동 마감이 종결한 건(processed_by='system:auto_close')은 제외한다 —
  -- 같은 트랜잭션에서 job_closed 알림이 이미 나간다(중복·오해 방지).
  IF OLD.status <> NEW.status
     AND NEW.status = 'rejected'
     AND COALESCE(NEW.processed_by, '') <> 'system:auto_close' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'application_rejected',
      '지원 거절',
      format('%s 지원이 거절되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- ============ cancellation_request 전환 ============

  -- → approved: 취소 요청 승인
  IF v_old_cancel_status IS DISTINCT FROM v_new_cancel_status
     AND v_new_cancel_status = 'approved' THEN
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'cancellation_approved',
      '취소 요청 승인',
      format('%s 취소 요청이 승인되었습니다.', v_label),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'senderId', v_owner_id
      ),
      'normal'
    );
  END IF;

  -- → rejected: 취소 요청 거절 (high priority — 출근 의무)
  IF v_old_cancel_status IS DISTINCT FROM v_new_cancel_status
     AND v_new_cancel_status = 'rejected' THEN
    v_rejection_reason := NEW.cancellation_request ->> 'rejectionReason';
    INSERT INTO public.notifications (
      recipient_id, type, title, body, link, data, priority
    ) VALUES (
      NEW.applicant_id,
      'cancellation_rejected',
      '취소 요청 거절',
      format(
        '%s 취소 요청이 거절되었습니다.%s',
        v_label,
        CASE WHEN v_rejection_reason IS NULL OR v_rejection_reason = ''
             THEN ''
             ELSE ' 사유: ' || v_rejection_reason
        END
      ),
      '/schedule',
      jsonb_build_object(
        'applicationId', NEW.id,
        'jobPostingId', NEW.job_posting_id,
        'jobPostingTitle', COALESCE(v_job_title, ''),
        'rejectionReason', COALESCE(v_rejection_reason, ''),
        'senderId', v_owner_id
      ),
      'high'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_application_update] failed for application % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- 4. 처리 건수 관측 헬퍼 — 실행마다(0건 포함) action_logs 에 기록
--
-- `cron.job_run_details.return_message` 는 SELECT 반환 행 수라 항상 "1 row" 다.
-- writer 가 또 끊겨 0건을 처리해도 로그상 정상으로 보이므로, 건수를 직접 남긴다.
-- 기록 실패가 마감 자체를 되돌리면 안 되므로 예외를 삼킨다.
-- 새 테이블을 만들지 않는 이유: RLS 정책 카운트를 건드리지 않기 위해서다
-- (action_logs 는 이미 감사 로그 용도로 존재).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_log_scheduled_close(
  p_job_name text,
  p_closed_count integer,
  p_cutoff date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.action_logs (user_id, action, metadata)
  VALUES (
    NULL,
    'cron.' || p_job_name,
    jsonb_build_object(
      'closedCount', p_closed_count,
      'cutoff', p_cutoff,
      'ranAt', now()
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[log_scheduled_close] %(%) 기록 실패 — %', p_job_name, p_closed_count, SQLERRM;
END;
$function$;

-- ------------------------------------------------------------
-- 5. 고정 공고 만료 fallback — expiresAt 이 없으면 created_at + 7일
--
-- FIXED_POSTING_DURATION_DAYS = 7 (클라이언트 계약과 동일 값).
-- 기존 `fixed_config IS NOT NULL` 조건을 제거해 config 자체가 NULL 인 행도 대상에 넣는다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_expire_fixed_postings_batch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.job_postings
    SET
      status = 'closed',
      closed_at = now(),
      closed_reason = 'expired',
      updated_at = now()
    WHERE posting_type = 'fixed'
      AND status IN ('active', 'capacity_full')
      AND (
        -- 정상 경로: 명시된 만료 시각
        (
          (fixed_config ->> 'expiresAt') IS NOT NULL
          AND (fixed_config ->> 'expiresAt')::timestamptz < now()
        )
        -- fallback: 만료 시각이 없는 공고(구 writer 부재분)는 생성 + 7일
        OR (
          (fixed_config ->> 'expiresAt') IS NULL
          AND created_at IS NOT NULL
          AND created_at + interval '7 days' < now()
        )
      )
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  PERFORM public.fn_log_scheduled_close('expire_fixed_postings', v_updated_count, NULL);

  RETURN v_updated_count;
END;
$function$;

-- ------------------------------------------------------------
-- 6. 날짜 기반 마감 — 처리 건수 기록 추가 (마감 조건 자체는 불변)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_expire_by_last_work_date()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_cutoff date;
  v_updated_count integer;
BEGIN
  v_cutoff := ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date;

  WITH expired AS (
    UPDATE public.job_postings
    SET
      status = 'closed',
      closed_at = now(),
      closed_reason = 'expired_by_work_date',
      updated_at = now()
    WHERE posting_type IN ('regular', 'urgent', 'tournament')
      AND status IN ('active', 'capacity_full')
      AND last_work_date IS NOT NULL
      AND last_work_date <= v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  PERFORM public.fn_log_scheduled_close('expire_by_last_work_date', v_updated_count, v_cutoff);

  RETURN v_updated_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_log_scheduled_close(text, integer, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_expire_pending_applications_on_close() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 7. '공고 수정' 알림이 한 번도 나가지 못하던 결함 복구
--
-- `v_changed_fields := v_changed_fields || 'title'` 에서 PostgreSQL 은
-- `anyarray || anyarray` 를 골라 미지정 리터럴 'title' 을 배열 리터럴로 파싱하려 든다
-- → `malformed array literal: "title"` 로 **항상** 실패했다. EXCEPTION 핸들러가 이를
-- 삼켜 조용히 사라졌고, prod 의 job_updated 알림은 누적 0건이다(2026-07-27 실측).
-- pgTAP 로그에 이 WARNING 이 전 스위트에 걸쳐 찍히고 있었다.
--
-- ⚠️ 복구하면서 status 를 변경필드 목록에서 뺀다:
--   여기까지 오는 status 전이는 cancelled/closed 가 아닌 것들뿐인데, 그 대부분이
--   좌석 트리거의 active ↔ capacity_full 자동 전이다. 그대로 복구하면 좌석이
--   찼다 빌 때마다 지원자 전원에게 '공고 수정' 알림이 나간다.
--   cancelled/closed 는 위 분기에서 전용 알림으로 이미 처리된다.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_job_posting_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_changed_fields text[] := ARRAY[]::text[];
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

    v_notif_type := 'job_updated';
    v_notif_title := '📝 공고 수정 안내';
    v_notif_body := format(
      '''%s'' 공고가 수정되었습니다. 변경 내용을 확인하세요.',
      COALESCE(NEW.title, '공고')
    );
    v_notif_link := format('/jobs/%s', NEW.id);
    v_notif_priority := 'normal';
    v_notif_data := jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'changedFields', array_to_string(v_changed_fields, ', '),
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

-- ------------------------------------------------------------
-- 8. 잔여 백필 — 이미 자동 마감된 공고에 남아 있는 미확정 지원 종결
--
-- 트리거는 앞으로의 전이만 잡는다. 07-26 크론이 닫은 공고에 남은 applied 건은
-- 여기서 같은 규칙으로 종결한다(알림은 억제 키로 발송되지 않는다).
-- ------------------------------------------------------------
UPDATE public.applications a
SET
  status = 'rejected',
  rejection_reason = CASE j.closed_reason
    WHEN 'expired_by_work_date' THEN '공고 자동 마감 (근무일 경과)'
    ELSE '공고 자동 마감 (모집 기간 만료)'
  END,
  processed_by = 'system:auto_close',
  processed_at = now(),
  updated_at = now()
FROM public.job_postings j
WHERE j.id = a.job_posting_id
  AND a.status = 'applied'
  AND j.status = 'closed'
  AND j.closed_reason IN ('expired', 'expired_by_work_date');
