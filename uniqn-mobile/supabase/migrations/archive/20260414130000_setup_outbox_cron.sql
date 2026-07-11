-- ============================================================
-- T-B11: sync-schedule-board-outbox pg_cron 스케줄링
-- ============================================================
-- 목적: schedule_board_sync_outbox 테이블의 pending 행을 처리하기 위해
--       sync-schedule-board-outbox Edge Function을 1분마다 자동 호출.
--
-- 의존:
--   - pg_cron extension (Supabase Dashboard > Database > Extensions에서 활성화)
--   - pg_net extension (HTTP 요청용)
--   - vault에 'supabase_url', 'service_role_key' 시크릿 등록 필요
--
-- 사전 작업 (Supabase Studio SQL Editor에서 1회 실행):
--   SELECT vault.create_secret('https://YOUR-PROJECT.supabase.co', 'supabase_url');
--   SELECT vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');
--
-- 검증:
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'sync-schedule-board-outbox';
--   SELECT runid, status, return_message FROM cron.job_run_details
--     WHERE jobname = 'sync-schedule-board-outbox' ORDER BY start_time DESC LIMIT 5;
--
-- 참조: docs/superpowers/plans/2026-04-14-outbox-completion.md (Task 1)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 동명 job이 있다면 제거 (마이그레이션 재실행 안전성)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-schedule-board-outbox') THEN
    PERFORM cron.unschedule('sync-schedule-board-outbox');
  END IF;
END $$;

-- 매 분 Edge Function 호출
-- pg_cron 표준 5-field 스케줄 사용 (분 단위, Supabase 모든 버전 호환)
SELECT cron.schedule(
  'sync-schedule-board-outbox',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/sync-schedule-board-outbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);

COMMENT ON EXTENSION pg_cron IS 'sync-schedule-board-outbox Edge Function 스케줄링용 (T-B11)';
