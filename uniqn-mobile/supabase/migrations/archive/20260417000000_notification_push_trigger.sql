-- =============================================================================
-- Migration: notifications INSERT → send-push-notification Edge Function 트리거
-- =============================================================================
-- 목적: public.notifications 테이블에 행이 INSERT되면 자동으로
--       send-push-notification Edge Function을 호출하여 Expo Push를 발송.
--
-- 의존:
--   - pg_net extension (HTTP 요청용)
--   - vault 시크릿: 'supabase_url', 'service_role_key'
--     (이미 20260414130000_setup_outbox_cron.sql에서 등록됨)
--
-- 철학:
--   - fire-and-forget: 푸시 발송 실패는 알림 INSERT를 막지 않음
--     (EXCEPTION WHEN OTHERS로 트리거 자체는 항상 성공)
--   - 알림 로직(INSERT)과 발송 로직(Edge Function) 완전 분리
--   - **statement-level trigger** (REFERENCING NEW TABLE) — 1 INSERT 문 당
--     1 HTTP 호출로 배치 처리. 브로드캐스트(관리자 N명, 지원자 N명) 시
--     pg_net 큐 폭증 방지.
--
-- 검증:
--   INSERT INTO notifications (recipient_id, type, title, body, priority)
--   VALUES ('<user-uuid>', 'test', 'Test', 'Hello', 'high');
--
--   -- pg_net 요청 로그 확인
--   SELECT id, status_code, content::text FROM net._http_response
--   ORDER BY created DESC LIMIT 5;
--
-- 롤백:
--   DROP TRIGGER IF EXISTS on_notification_created_send_push ON public.notifications;
--   DROP FUNCTION IF EXISTS public.trigger_send_push_notification();
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 배포 시점 vault 시크릿 존재 여부 assert (fail-fast)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_url') THEN
    RAISE EXCEPTION 'vault secret "supabase_url" not registered. Run: SELECT vault.create_secret(''https://<project>.supabase.co'', ''supabase_url'');';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key') THEN
    RAISE EXCEPTION 'vault secret "service_role_key" not registered. Run: SELECT vault.create_secret(''<service-role-key>'', ''service_role_key'');';
  END IF;
END $$;


CREATE OR REPLACE FUNCTION public.trigger_send_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_ids uuid[];
BEGIN
  -- REFERENCING NEW TABLE 로부터 모든 INSERT row id 수집
  SELECT array_agg(id) INTO v_ids
  FROM new_rows
  WHERE recipient_id IS NOT NULL;

  -- 유효한 recipient 없으면 skip
  IF v_ids IS NULL OR array_length(v_ids, 1) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING '[send-push-trigger] vault secrets missing — skip % notifications', array_length(v_ids, 1);
    RETURN NULL;
  END IF;

  -- Edge Function 배치 호출 (fire-and-forget, 1 INSERT 문 = 1 HTTP post)
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_role_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('notificationIds', to_jsonb(v_ids)),
    timeout_milliseconds := 5000
  );

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[send-push-trigger] failed for batch of % notifications — %',
    COALESCE(array_length(v_ids, 1), 0), SQLERRM;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.trigger_send_push_notification() IS
  'notifications INSERT statement 단위로 배치 HTTP 호출 (send-push-notification Edge Function). 실패는 INSERT 성공에 영향 없음.';

DROP TRIGGER IF EXISTS on_notification_created_send_push ON public.notifications;

-- statement-level trigger — REFERENCING NEW TABLE은 AFTER + FOR EACH STATEMENT 전용
CREATE TRIGGER on_notification_created_send_push
AFTER INSERT ON public.notifications
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_send_push_notification();

COMMENT ON TRIGGER on_notification_created_send_push ON public.notifications IS
  'Phase 1: statement-level trigger — 1 INSERT 당 1 HTTP 호출. 배치 공지(관리자/지원자 N명) 효율 극대화.';
