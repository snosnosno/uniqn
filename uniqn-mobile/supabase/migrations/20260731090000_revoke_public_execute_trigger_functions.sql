-- 트리거 전용 SECURITY DEFINER 함수의 PUBLIC EXECUTE 회수 + 순수 헬퍼 search_path 고정
--
-- 배경
--   Supabase 어드바이저가 트리거 함수 33개를 `/rest/v1/rpc/<name>` 로 anon 이 호출 가능하다고
--   경고했다(anon_security_definer_function_executable). 실측한 ACL 은 `=X/postgres` 로,
--   grant 주체가 anon 이 아니라 **PUBLIC** 이다. 따라서 `REVOKE ... FROM anon` 만으로는
--   PUBLIC 경유 권한이 남아 회수가 무효가 된다. PUBLIC 을 함께 회수해야 한다.
--
-- 안전성 근거
--   1. 트리거 함수는 테이블 소유자 권한으로 실행되므로 role 의 EXECUTE 권한과 무관하다.
--      회수해도 트리거는 그대로 동작한다.
--   2. 같은 성격의 SECDEF 트리거 함수 16개(fn_ops_*, notify_on_workspace_invitation_insert,
--      prevent_identity_flag_self_update 등)는 이미 PUBLIC/anon 이 회수된 상태다.
--      즉 프로젝트가 이미 확립한 패턴이고 초기 33개만 누락돼 있었다.
--   3. service_role / postgres 의 EXECUTE 는 유지한다(Edge Function·마이그레이션 경로).

DO $$
DECLARE
  v_fn text;
  v_targets text[] := ARRAY[
    'enforce_jp_status_transition',
    'fn_board_comment_count_sync',
    'fn_fixed_posting_expired',
    'fn_notification_delete_decrement',
    'fn_notification_insert_increment',
    'fn_notification_read_decrement',
    'fn_notify_cancellation_request',
    'fn_notify_tournament_approval',
    'fn_sync_application_completion',
    'fn_update_job_posting_stats',
    'handle_new_user',
    'increment_unread_counter',
    'log_collaborator_audit',
    'notify_on_application_insert',
    'notify_on_application_update',
    'notify_on_board_comment_insert',
    'notify_on_board_post_update',
    'notify_on_collaborator_added',
    'notify_on_collaborator_removed',
    'notify_on_inquiry_insert',
    'notify_on_job_posting_insert',
    'notify_on_job_posting_owner_expired',
    'notify_on_job_posting_update',
    'notify_on_report_insert',
    'notify_on_review_insert',
    'notify_on_work_log_checkinout_update',
    'notify_on_work_log_insert',
    'notify_on_work_log_no_show_update',
    'notify_on_work_log_update',
    'prevent_role_self_escalation',
    'protect_work_log_payroll_columns',
    'sync_user_role_to_app_metadata',
    'trigger_send_push_notification'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_targets LOOP
    -- 대상은 전부 무인자(zero-arg) 트리거 함수다. 반환형이 trigger 인지 재확인해
    -- 동명의 일반 RPC 를 실수로 잠그지 않도록 방어한다.
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_type t ON t.oid = p.prorettype
      WHERE n.nspname = 'public'
        AND p.proname = v_fn
        AND p.pronargs = 0
        AND t.typname = 'trigger'
    ) THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated',
        v_fn
      );
    ELSE
      RAISE WARNING '트리거 함수 아님 또는 미존재 — 건너뜀: public.%()', v_fn;
    END IF;
  END LOOP;
END $$;

-- search_path 고정 (function_search_path_mutable 2건)
--   둘 다 SECURITY INVOKER 이고 본문이 btrim / regexp_split_to_array 뿐인 순수 문자열 함수라
--   참조하는 스키마 객체가 없다. search_path 부여가 동작을 바꿀 수 없다.
ALTER FUNCTION public._posting_slot_key(text) SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public._posting_role_key(text, text) SET search_path = pg_catalog, pg_temp;
