-- Phase 2 ST-002 / Phase 4 ROOT CAUSE: 레거시 fn_notify_* triggers 제거
-- 신규 notify_on_* triggers (application_notify_*, work_log_notify_*, job_posting_notify_*, board_comment_notify_*)
-- 가 동일 이벤트 커버 → 레거시 trigger만 DROP하여 중복 발행 차단

-- 1) 중복 확인된 legacy triggers DROP (신규가 커버)
DROP TRIGGER IF EXISTS tr_notify_application_submitted ON public.applications;   -- new_application 중복
DROP TRIGGER IF EXISTS tr_notify_application_status ON public.applications;      -- application_confirmed 중복
DROP TRIGGER IF EXISTS tr_notify_schedule_created ON public.work_logs;           -- schedule_created 중복
DROP TRIGGER IF EXISTS tr_notify_posting_closed ON public.job_postings;          -- job_closed 중복
DROP TRIGGER IF EXISTS tr_notify_comment_created ON public.board_comments;       -- comment 중복

-- 함수는 다른 경로 참조 가능성 때문에 유지 (trigger만 detach)

-- 2) 이미 쌓인 중복 알림 dedup (최신 1건만 유지)

WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY recipient_id, data->>'applicationId'
    ORDER BY created_at DESC
  ) AS rn
  FROM public.notifications
  WHERE type IN ('new_application','application_submitted')
    AND data ? 'applicationId'
)
DELETE FROM public.notifications WHERE id IN (SELECT id FROM dup WHERE rn > 1);

WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY recipient_id, data->>'applicationId'
    ORDER BY created_at DESC
  ) AS rn
  FROM public.notifications
  WHERE type IN ('application_confirmed','application_status_changed')
    AND data ? 'applicationId'
)
DELETE FROM public.notifications WHERE id IN (SELECT id FROM dup WHERE rn > 1);

WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY recipient_id, data->>'jobPostingId'
    ORDER BY created_at DESC
  ) AS rn
  FROM public.notifications
  WHERE type IN ('job_closed','job_posting_closed')
    AND data ? 'jobPostingId'
)
DELETE FROM public.notifications WHERE id IN (SELECT id FROM dup WHERE rn > 1);

WITH dup AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY recipient_id, data->>'workLogId'
    ORDER BY created_at DESC
  ) AS rn
  FROM public.notifications
  WHERE type = 'schedule_created'
    AND data ? 'workLogId'
)
DELETE FROM public.notifications WHERE id IN (SELECT id FROM dup WHERE rn > 1);
