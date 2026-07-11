-- =============================================================================
-- baseline 플랫폼 glue — auth 트리거 / storage / realtime publication / cron
-- =============================================================================
-- prod↔repo 파리티 baseline squash(2026-07-11)의 3/4 파일.
--
-- 왜 필요한가: 2)의 public 스키마 덤프에는 다음이 담기지 않는다.
--   - auth.users에 걸린 트리거(트리거는 auth 스키마 테이블 소속)
--   - storage.buckets 행 / storage.objects RLS 정책 (대시보드에서 생성된 prod 산물,
--     구 마이그레이션에도 없었음 — 이번에 처음 코드화)
--   - supabase_realtime publication 테이블 등록 (publication은 전역 오브젝트)
--   - pg_cron 잡 등록 (cron 스키마)
--
-- 전부 2026-07-11 prod 라이브 실측(pg_trigger/pg_policies/storage.buckets/
-- pg_publication_tables/cron.job)을 그대로 재기술한 것. prod에는 repair로 기록만 한다.
--
-- 주의(함정 메모리): storage.objects에는 DROP POLICY 권한 함정이 있어
--   IF NOT EXISTS 검사 후 CREATE POLICY만 수행한다(pitfall_supabase_storage_drop_policy).

-- -----------------------------------------------------------------------------
-- 1. auth.users 트리거 — 신규가입 시 public.users 자동 생성 (prod 실측 정의)
--    로컬 스택에 그동안 부재했던 트리거(PR #90에서 관찰된 "미발동"의 실체 = 미생성).
--    직접 auth.users INSERT 시드에도 발동하므로 4) 데이터 시드는 이를 전제로 작성됨.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '[baseline_glue] auth.users 트리거 생성 권한 없음 — skip (hosted 환경?)';
END $$;

-- -----------------------------------------------------------------------------
-- 2. storage 버킷 11종 (prod storage.buckets 실측)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
    ('announcements',       'announcements',       true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
    ('boards',              'boards',              false, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
    ('chat',                'chat',                false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']),
    ('exports',             'exports',             false, 52428800, ARRAY['application/json','text/csv','application/zip']),
    ('id-verification',     'id-verification',     false, 10485760, ARRAY['image/jpeg','image/png']),
    ('inquiry-attachments', 'inquiry-attachments', false, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
    ('job-postings',        'job-postings',        false, 10485760, ARRAY['image/jpeg','image/png','image/webp']),
    ('profile-images',      'profile-images',      true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
    ('qr-codes',            'qr-codes',            false, 1048576,  ARRAY['image/png','image/svg+xml']),
    ('receipts',            'receipts',            false, 10485760, ARRAY['application/pdf','image/jpeg','image/png']),
    ('temp',                'temp',                false, 20971520, NULL)
  ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
EXCEPTION
  WHEN undefined_table THEN
    RAISE WARNING '[baseline_glue] storage.buckets 부재 — skip';
END $$;

-- -----------------------------------------------------------------------------
-- 3. storage.objects RLS 정책 32종 (prod pg_policies 실측 원문)
--    함수 참조는 public. 으로 명시 한정(파싱 시점 search_path 비의존).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('announcements_storage_delete','DELETE','((bucket_id = ''announcements''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('announcements_storage_insert','INSERT',NULL,'((bucket_id = ''announcements''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))'),
      ('announcements_storage_update','UPDATE','((bucket_id = ''announcements''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('boards_storage_delete','DELETE','((bucket_id = ''boards''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',NULL),
      ('boards_storage_insert','INSERT',NULL,'((bucket_id = ''boards''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('boards_storage_select','SELECT','(bucket_id = ''boards''::text)',NULL),
      ('boards_storage_update','UPDATE','((bucket_id = ''boards''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',NULL),
      ('chat_storage_delete','DELETE','(bucket_id = ''chat''::text)',NULL),
      ('chat_storage_insert','INSERT',NULL,'(bucket_id = ''chat''::text)'),
      ('chat_storage_select','SELECT','(bucket_id = ''chat''::text)',NULL),
      ('chat_storage_update','UPDATE','(bucket_id = ''chat''::text)',NULL),
      ('exports_select','SELECT','((bucket_id = ''exports''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',NULL),
      ('id_verification_delete','DELETE','((bucket_id = ''id-verification''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('id_verification_insert','INSERT',NULL,'((bucket_id = ''id-verification''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('id_verification_select','SELECT','((bucket_id = ''id-verification''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('inquiry_attachments_delete_own_or_admin','DELETE','((bucket_id = ''inquiry-attachments''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('inquiry_attachments_insert_own','INSERT',NULL,'((bucket_id = ''inquiry-attachments''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('inquiry_attachments_select_own_or_admin','SELECT','((bucket_id = ''inquiry-attachments''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('job_postings_storage_delete','DELETE','((bucket_id = ''job-postings''::text) AND public.is_employer_or_admin())',NULL),
      ('job_postings_storage_insert','INSERT',NULL,'((bucket_id = ''job-postings''::text) AND public.is_employer_or_admin())'),
      ('job_postings_storage_select','SELECT','(bucket_id = ''job-postings''::text)',NULL),
      ('job_postings_storage_update','UPDATE','((bucket_id = ''job-postings''::text) AND public.is_employer_or_admin())',NULL),
      ('profile_images_delete','DELETE','((bucket_id = ''profile-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',NULL),
      ('profile_images_insert','INSERT',NULL,'((bucket_id = ''profile-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('profile_images_update','UPDATE','((bucket_id = ''profile-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',NULL),
      ('qr_codes_delete','DELETE','((bucket_id = ''qr-codes''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('qr_codes_insert','INSERT',NULL,'((bucket_id = ''qr-codes''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('qr_codes_select','SELECT','((bucket_id = ''qr-codes''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('receipts_select','SELECT','((bucket_id = ''receipts''::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin()))',NULL),
      ('temp_delete','DELETE','((bucket_id = ''temp''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',NULL),
      ('temp_insert','INSERT',NULL,'((bucket_id = ''temp''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))'),
      ('temp_select','SELECT','((bucket_id = ''temp''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',NULL)
    ) AS t(polname, cmd, qual, with_check)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = p.polname
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR %s TO authenticated %s %s',
        p.polname,
        p.cmd,
        COALESCE('USING (' || p.qual || ')', ''),
        COALESCE('WITH CHECK (' || p.with_check || ')', '')
      );
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_table OR insufficient_privilege THEN
    RAISE WARNING '[baseline_glue] storage.objects 정책 생성 불가 — skip (%)', SQLERRM;
END $$;

-- -----------------------------------------------------------------------------
-- 4. realtime publication 16테이블 (prod pg_publication_tables 실측)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'applications','work_logs','notifications','board_posts','board_comments',
    'notification_counters','workspace_members','job_posting_collaborators',
    'ops_tournaments','ops_participants','ops_tables','ops_seats',
    'ops_blind_levels','ops_clock','ops_live_stats','ops_staff'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN
    RAISE WARNING '[baseline_glue] supabase_realtime publication 부재 — skip';
END $$;

-- -----------------------------------------------------------------------------
-- 5. pg_cron 잡 11종 (prod cron.job 실측 — cron.schedule은 jobname 기준 upsert)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE WARNING '[baseline_glue] pg_cron 미설치 — cron 잡 등록 skip';
    RETURN;
  END IF;

  PERFORM cron.schedule('cleanup-expired-fcm-tokens', '3 18 * * *',
    'SELECT public.fn_cleanup_expired_fcm_tokens();');
  PERFORM cron.schedule('cleanup-expired-tokens', '0 18 * * *',
    'DELETE FROM public.rate_limits WHERE expires_at < now()');
  PERFORM cron.schedule('cleanup-rate-limits', '7 15 * * *',
    'SELECT public.fn_cleanup_rate_limits();');
  PERFORM cron.schedule('expire-by-last-work-date', '17 15 * * *',
    'SELECT public.fn_expire_by_last_work_date();');
  PERFORM cron.schedule('expire-fixed-postings', '11 * * * *',
    'SELECT public.fn_expire_fixed_postings_batch();');
  PERFORM cron.schedule('expire-pending-workspace-invitations-daily', '5 15 * * *',
    ' SELECT public.expire_pending_workspace_invitations(); ');
  PERFORM cron.schedule('send-review-reminders', '3 1 * * *',
    'SELECT public.fn_send_review_reminders();');
  PERFORM cron.schedule('retry-failed-counter-ops', '0 */6 * * *',
    $job$UPDATE public.users u
    SET unread_notification_count = sub.actual_count
    FROM (
      SELECT recipient_id, COUNT(*) AS actual_count
      FROM public.notifications
      WHERE is_read = false
      GROUP BY recipient_id
    ) sub
    WHERE u.id = sub.recipient_id
      AND u.unread_notification_count != sub.actual_count$job$);
  PERFORM cron.schedule('sync-schedule-board-outbox', '* * * * *',
    $job$
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
  $job$);
  PERFORM cron.schedule('process-scheduled-deletions', '13 17 * * *',
    $job$
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
  $job$);
  PERFORM cron.schedule('cleanup-orphan-accounts', '23 17 * * 6',
    $job$
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
  $job$);
END $$;
