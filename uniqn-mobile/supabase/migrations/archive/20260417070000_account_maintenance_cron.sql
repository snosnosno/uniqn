-- =============================================================================
-- Migration: Phase 4 — Account 유지보수 Edge Function pg_cron 등록
-- =============================================================================
-- 목적:
--   process-scheduled-deletions + cleanup-orphan-accounts Edge Function을
--   pg_net 경유로 주기 호출.
--
-- 의존:
--   - vault secrets: 'supabase_url', 'service_role_key' (outbox cron과 공유)
--   - process-scheduled-deletions, cleanup-orphan-accounts 배포 완료
--
-- 매핑:
--   processScheduledDeletions       → process-scheduled-deletions (daily 02:13 KST)
--   cleanupOrphanAccountsScheduled  → cleanup-orphan-accounts     (weekly Sun 02:23 KST)
-- =============================================================================

-- 배포 시점 vault 시크릿 존재 확인 (fail-fast)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_url') THEN
    RAISE EXCEPTION 'vault secret "supabase_url" not registered. Run: SELECT vault.create_secret(''https://<project>.supabase.co'', ''supabase_url'');';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key') THEN
    RAISE EXCEPTION 'vault secret "service_role_key" not registered.';
  END IF;
END $$;

-- 기존 동명 job 제거 (재실행 안전성)
DO $$
DECLARE
  v_job text;
BEGIN
  FOR v_job IN
    SELECT jobname FROM cron.job
    WHERE jobname IN ('process-scheduled-deletions', 'cleanup-orphan-accounts')
  LOOP
    PERFORM cron.unschedule(v_job);
  END LOOP;
END $$;

-- 매일 02:13 KST = 17:13 UTC (전날)
SELECT cron.schedule(
  'process-scheduled-deletions',
  '13 17 * * *',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/process-scheduled-deletions',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

-- 매주 일요일 02:23 KST = 일요일 17:23 UTC (전날 토요일)
SELECT cron.schedule(
  'cleanup-orphan-accounts',
  '23 17 * * 6',
  $cron$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/cleanup-orphan-accounts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

COMMENT ON EXTENSION pg_cron IS 'Firebase scheduled functions 이전 포함 (pg_cron outbox + account maintenance)';


-- =============================================================================
-- 롤백 런북
-- =============================================================================
--   SELECT cron.unschedule('process-scheduled-deletions');
--   SELECT cron.unschedule('cleanup-orphan-accounts');
--
-- Edge Function 동결: Supabase Dashboard > Edge Functions > Pause
-- =============================================================================
