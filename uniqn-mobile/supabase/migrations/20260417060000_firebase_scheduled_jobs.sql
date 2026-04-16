-- =============================================================================
-- Migration: Phase 3 — Firebase Scheduled Functions → pg_cron 재구현
-- =============================================================================
-- 목적:
--   Firebase onSchedule 함수들을 pg_cron + SQL Function으로 이전.
--   Auth Admin API가 필요한 2개 함수(scheduledDeletion, cleanupOrphanAccounts)는
--   Phase 4 Edge Function으로 별도 처리.
--
-- 매핑:
--   cleanupExpiredTokens          → cleanup-expired-fcm-tokens (daily 03:03 KST)
--   cleanupRateLimits             → cleanup-rate-limits (daily 00:07 KST)
--   expireFixedPostings           → expire-fixed-postings (hourly)
--   expireByLastWorkDate          → expire-by-last-work-date (daily 00:17 KST)
--   retryFailedCounterOps         → 불필요 (Supabase에서는 SQL 원자 연산 사용)
--   sendReviewReminders           → send-review-reminders (daily 10:03 KST)
--   onFixedPostingExpired (owner) → trigger notify_owner_fixed_expired
--   onWorkDateExpired (owner)     → trigger notify_owner_work_date_expired
--
-- 참조: 20260414130000_setup_outbox_cron.sql (pg_cron 패턴)
--       cron schedule은 UTC 기준. KST = UTC+9. 0/30분 회피로 fleet 경합 최소화.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================
-- SQL Function: 만료 FCM 토큰 정리
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_fcm_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.fcm_tokens
  WHERE last_refreshed_at < now() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    RAISE NOTICE '[cleanup_expired_fcm_tokens] deleted % rows', v_deleted_count;
  END IF;

  RETURN v_deleted_count;
END;
$$;


-- ============================================================
-- SQL Function: 만료 rate_limits 정리
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_cleanup_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.rate_limits
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count > 0 THEN
    RAISE NOTICE '[cleanup_rate_limits] deleted % rows', v_deleted_count;
  END IF;

  RETURN v_deleted_count;
END;
$$;


-- ============================================================
-- SQL Function: 고정 공고 만료 처리
--   postingType='fixed' + status='active' + fixed_config.expiresAt < now()
--   → status='closed', closed_reason='expired'
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_expire_fixed_postings_batch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
      AND status = 'active'
      AND fixed_config IS NOT NULL
      AND (fixed_config ->> 'expiresAt') IS NOT NULL
      AND (fixed_config ->> 'expiresAt')::timestamptz < now()
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  IF v_updated_count > 0 THEN
    RAISE NOTICE '[expire_fixed_postings_batch] closed % postings', v_updated_count;
  END IF;

  RETURN v_updated_count;
END;
$$;


-- ============================================================
-- SQL Function: last_work_date 기준 자동 마감
--   regular/urgent/tournament + status='active' + last_work_date <= (KST today - 2d)
--   → status='closed', closed_reason='expired_by_work_date'
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_expire_by_last_work_date()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cutoff date;
  v_updated_count integer;
BEGIN
  -- KST 오늘 - 2일 기준. Firebase 구현과 동일.
  v_cutoff := ((now() AT TIME ZONE 'Asia/Seoul')::date - INTERVAL '2 days')::date;

  WITH expired AS (
    UPDATE public.job_postings
    SET
      status = 'closed',
      closed_at = now(),
      closed_reason = 'expired_by_work_date',
      updated_at = now()
    WHERE posting_type IN ('regular', 'urgent', 'tournament')
      AND status = 'active'
      AND last_work_date IS NOT NULL
      AND last_work_date <= v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_updated_count FROM expired;

  IF v_updated_count > 0 THEN
    RAISE NOTICE '[expire_by_last_work_date] closed % postings (cutoff=%)', v_updated_count, v_cutoff;
  END IF;

  RETURN v_updated_count;
END;
$$;


-- ============================================================
-- SQL Function: 평가 리마인더 발송
--   5일 전 check_out_time이 기록된 work_logs 중 리뷰 미작성인 쪽에 알림
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_send_review_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_inserted integer;
  v_target_start timestamptz;
  v_target_end timestamptz;
BEGIN
  -- Firebase: 5일 전 00:00~23:59 범위. now() - 5 days로 날짜 구간 계산.
  v_target_start := (now() - INTERVAL '5 days')::date;
  v_target_end := v_target_start + INTERVAL '1 day';

  WITH target_work_logs AS (
    SELECT
      wl.id AS work_log_id,
      wl.staff_id,
      wl.job_posting_id,
      jp.title AS job_title,
      jp.owner_id AS employer_id
    FROM public.work_logs wl
    JOIN public.job_postings jp ON jp.id = wl.job_posting_id
    WHERE wl.check_out_time IS NOT NULL
      AND jsonb_typeof(wl.check_out_time) = 'string'
      AND (wl.check_out_time #>> '{}')::timestamptz >= v_target_start
      AND (wl.check_out_time #>> '{}')::timestamptz < v_target_end
  ),
  -- 리뷰가 이미 있는 (work_log_id, reviewer_type) 집합
  existing_reviews AS (
    SELECT work_log_id, reviewer_type
    FROM public.reviews
    WHERE work_log_id IN (SELECT work_log_id FROM target_work_logs)
  ),
  -- 스태프 측 미작성 리마인더
  staff_reminders AS (
    SELECT
      twl.staff_id AS recipient_id,
      'review_reminder'::text AS type,
      '📝 평가 리마인더'::text AS title,
      format('%s 근무에 대한 평가가 아직 작성되지 않았습니다.', COALESCE(NULLIF(twl.job_title, ''), '근무')) AS body,
      format('/reviews/%s', twl.work_log_id) AS link,
      jsonb_build_object(
        'workLogId', twl.work_log_id,
        'jobPostingId', twl.job_posting_id,
        'jobPostingTitle', COALESCE(twl.job_title, ''),
        'reviewerType', 'staff'
      ) AS data
    FROM target_work_logs twl
    WHERE twl.staff_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM existing_reviews er
        WHERE er.work_log_id = twl.work_log_id
          AND er.reviewer_type = 'staff'
      )
  ),
  -- 구인자 측 미작성 리마인더
  employer_reminders AS (
    SELECT
      twl.employer_id AS recipient_id,
      'review_reminder'::text AS type,
      '📝 평가 리마인더'::text AS title,
      format('%s 근무의 스태프 평가가 아직 작성되지 않았습니다.', COALESCE(NULLIF(twl.job_title, ''), '근무')) AS body,
      format('/reviews/%s', twl.work_log_id) AS link,
      jsonb_build_object(
        'workLogId', twl.work_log_id,
        'jobPostingId', twl.job_posting_id,
        'jobPostingTitle', COALESCE(twl.job_title, ''),
        'reviewerType', 'employer'
      ) AS data
    FROM target_work_logs twl
    WHERE twl.employer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM existing_reviews er
        WHERE er.work_log_id = twl.work_log_id
          AND er.reviewer_type = 'employer'
      )
  ),
  all_reminders AS (
    SELECT * FROM staff_reminders
    UNION ALL
    SELECT * FROM employer_reminders
  ),
  inserted AS (
    INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
    SELECT recipient_id, type, title, body, link, data, 'normal'
    FROM all_reminders
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  IF v_inserted > 0 THEN
    RAISE NOTICE '[send_review_reminders] inserted % reminders', v_inserted;
  END IF;

  RETURN v_inserted;
END;
$$;


-- ============================================================
-- Trigger: 공고 자동 마감 시 작성자 알림
--   Firebase onFixedPostingExpired / onWorkDateExpired 통합
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_job_posting_owner_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_notif_type text;
  v_notif_title text;
  v_notif_body text;
BEGIN
  -- active → closed + closed_reason 조건만 처리
  IF NOT (OLD.status = 'active' AND NEW.status = 'closed') THEN
    RETURN NEW;
  END IF;

  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.closed_reason = 'expired' AND NEW.posting_type = 'fixed' THEN
    v_notif_type := 'fixed_posting_expired';
    v_notif_title := '⏰ 고정 공고 만료';
    v_notif_body := format('''%s'' 고정 공고가 만료되어 자동 마감되었습니다.', COALESCE(NEW.title, '공고'));
  ELSIF NEW.closed_reason = 'expired_by_work_date' THEN
    v_notif_type := 'work_date_expired';
    v_notif_title := '⏰ 공고 자동 마감';
    v_notif_body := format('''%s'' 공고가 근무일 경과로 자동 마감되었습니다.', COALESCE(NEW.title, '공고'));
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, data, priority
  ) VALUES (
    NEW.owner_id,
    v_notif_type,
    v_notif_title,
    v_notif_body,
    format('/jobs/%s', NEW.id),
    jsonb_build_object(
      'jobPostingId', NEW.id,
      'jobPostingTitle', COALESCE(NEW.title, ''),
      'closedReason', NEW.closed_reason,
      'postingType', NEW.posting_type::text
    ),
    'normal'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_on_job_posting_owner_expired] failed for posting % — %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_posting_notify_owner_expired ON public.job_postings;
CREATE TRIGGER job_posting_notify_owner_expired
AFTER UPDATE ON public.job_postings
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_job_posting_owner_expired();


-- ============================================================
-- pg_cron 스케줄 등록
--   cron은 UTC 기준. KST = UTC+9. 0/30 분 회피 (fleet 경합 최소화).
-- ============================================================

-- 기존 동명 job 제거 (재실행 안전성)
DO $$
DECLARE
  v_job text;
BEGIN
  FOR v_job IN
    SELECT jobname FROM cron.job
    WHERE jobname IN (
      'cleanup-expired-fcm-tokens',
      'cleanup-rate-limits',
      'expire-fixed-postings',
      'expire-by-last-work-date',
      'send-review-reminders'
    )
  LOOP
    PERFORM cron.unschedule(v_job);
  END LOOP;
END $$;

-- 만료 FCM 토큰 정리: 매일 18:03 UTC = 03:03 KST
SELECT cron.schedule(
  'cleanup-expired-fcm-tokens',
  '3 18 * * *',
  $$SELECT public.fn_cleanup_expired_fcm_tokens();$$
);

-- rate_limits 정리: 매일 15:07 UTC = 00:07 KST
SELECT cron.schedule(
  'cleanup-rate-limits',
  '7 15 * * *',
  $$SELECT public.fn_cleanup_rate_limits();$$
);

-- 고정 공고 만료: 매 시간 11분 (UTC/KST 동일 분 오프셋)
SELECT cron.schedule(
  'expire-fixed-postings',
  '11 * * * *',
  $$SELECT public.fn_expire_fixed_postings_batch();$$
);

-- 근무일 만료: 매일 15:17 UTC = 00:17 KST
SELECT cron.schedule(
  'expire-by-last-work-date',
  '17 15 * * *',
  $$SELECT public.fn_expire_by_last_work_date();$$
);

-- 평가 리마인더: 매일 01:03 UTC = 10:03 KST
SELECT cron.schedule(
  'send-review-reminders',
  '3 1 * * *',
  $$SELECT public.fn_send_review_reminders();$$
);


COMMENT ON FUNCTION public.fn_cleanup_expired_fcm_tokens() IS
  'fcm_tokens 30일 이상 미갱신 레코드 일괄 삭제 (Firebase cleanupExpiredTokens 대체)';
COMMENT ON FUNCTION public.fn_cleanup_rate_limits() IS
  'rate_limits expires_at 경과 레코드 일괄 삭제 (Firebase cleanupRateLimits 대체)';
COMMENT ON FUNCTION public.fn_expire_fixed_postings_batch() IS
  '고정 공고 fixed_config.expiresAt 경과 시 status=closed (Firebase expireFixedPostings 대체)';
COMMENT ON FUNCTION public.fn_expire_by_last_work_date() IS
  'last_work_date가 KST 오늘-2일보다 이전이면 자동 마감 (Firebase expireByLastWorkDate 대체)';
COMMENT ON FUNCTION public.fn_send_review_reminders() IS
  '5일 전 퇴근했으나 리뷰 미작성인 스태프/구인자에게 리마인더 알림 (Firebase sendReviewReminders 대체)';
COMMENT ON FUNCTION public.notify_on_job_posting_owner_expired() IS
  '공고 자동 마감(expired/expired_by_work_date) 시 작성자에게 알림 (Firebase onFixedPostingExpired + onWorkDateExpired 통합)';


-- =============================================================================
-- 롤백 런북 (Runbook)
-- =============================================================================
-- 긴급 중단 필요 시 Supabase Studio SQL Editor에서 다음 명령 실행:
--
--   SELECT cron.unschedule('cleanup-expired-fcm-tokens');
--   SELECT cron.unschedule('cleanup-rate-limits');
--   SELECT cron.unschedule('expire-fixed-postings');
--   SELECT cron.unschedule('expire-by-last-work-date');
--   SELECT cron.unschedule('send-review-reminders');
--
-- 함수/트리거 원복 (테이블은 유지):
--   DROP TRIGGER IF EXISTS job_posting_notify_owner_expired ON public.job_postings;
--   DROP FUNCTION IF EXISTS public.notify_on_job_posting_owner_expired();
--   DROP FUNCTION IF EXISTS public.fn_cleanup_expired_fcm_tokens();
--   DROP FUNCTION IF EXISTS public.fn_cleanup_rate_limits();
--   DROP FUNCTION IF EXISTS public.fn_expire_fixed_postings_batch();
--   DROP FUNCTION IF EXISTS public.fn_expire_by_last_work_date();
--   DROP FUNCTION IF EXISTS public.fn_send_review_reminders();
--
-- 현재 등록 상태 확인:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%fcm%' OR jobname LIKE 'expire-%' OR jobname LIKE 'cleanup-%' OR jobname LIKE 'send-review%';
-- =============================================================================
