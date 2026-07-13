-- 공고 워크스페이스 협업 편집 (PR #2 — pg_cron expiry)
-- KST 자정 (00:05) 일 1회 expire_pending_workspace_invitations 호출

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-pending-workspace-invitations-daily'
  ) THEN
    PERFORM cron.schedule(
      'expire-pending-workspace-invitations-daily',
      '5 15 * * *',  -- 15:05 UTC = 00:05 KST 다음 날
      $cron$ SELECT public.expire_pending_workspace_invitations(); $cron$
    );
  END IF;
END$$;
