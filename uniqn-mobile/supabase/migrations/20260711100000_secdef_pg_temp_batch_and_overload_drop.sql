-- =============================================================================
-- SECDEF search_path pg_temp 일괄 보정(62) + decrement_unread_counter(uuid) 잉여 오버로드 제거
-- =============================================================================
-- 2026-07-10 RLS/SECDEF 감사 후속 ③-B + 정합화 계획 §3-c. baseline(20260710000002) 위 첫 정규 마이그.
--
-- 1) pg_temp 보정 [LOW, 실질 악용 ~0]
--    SECURITY DEFINER 함수의 search_path 에 pg_temp 미명시 시 temp-table shadowing 이론 벡터.
--    (Supabase PostgREST 에는 authenticated 의 CREATE TEMP 채널이 없어 실질 악용 ~0 — 감사 §2-c)
--    본문 무변경: ALTER FUNCTION ... SET search_path 만 수행(ACL·볼라틸리티·정의 보존).
--    각 함수의 기존 search_path 값을 그대로 두고 말미에 pg_temp 만 추가
--    (2026-07-12 prod pg_proc.proconfig 실측으로 기계 생성 — 수기 작성 아님).
--
-- 2) 오버로드 제거 [42725 모호성 해소]
--    prod 에 decrement_unread_counter(uuid) / (uuid,integer) 2종 공존.
--    호출부 전수 실측: 앱/edge 는 2-인자 named-param 호출 1곳뿐(supabase/functions/
--    decrement-unread-counter), prod 함수 본문 내 참조 0건 → (uuid) 는 dead + 공격표면.
--    두 오버로드 모두 2026-07-10 authenticated 회수 완료 상태라 클라 표면 무변경.
--
-- 적용: prod = MCP apply_migration + red-green / 로컬 = db reset (baseline 직후 실행).
-- 회귀 가드: supabase/tests/parity_baseline_guard.test.sql (함수 162·pg_temp 누락 0 단언).

-- -----------------------------------------------------------------------------
-- 1. 잉여 오버로드 제거
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.decrement_unread_counter(uuid);

-- -----------------------------------------------------------------------------
-- 2. pg_temp 일괄 보정 (62함수, 기존 search_path 보존)
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.approve_employer_application(p_app_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.cancel_application_atomically(p_application_id uuid, p_actor_type text, p_actor_id uuid, p_cancel_reason text, p_rejection_reason text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_email_exists(p_email text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_ip_rate_limit(p_ip text, p_max_requests integer, p_window_seconds integer) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.check_nickname_exists(p_nickname text, p_exclude_uid uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_phone_exists(p_phone text) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.check_user_rate_limit(p_user_id uuid, p_operation text, p_max_requests integer, p_window_seconds integer) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.confirm_application(p_application_id uuid, p_owner_id uuid, p_assignments jsonb, p_original_application jsonb, p_confirmation_history jsonb, p_notes text, p_is_fixed_posting boolean, p_assignments_v3 jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_report(p_type text, p_reporter_type text, p_reporter_id uuid, p_reporter_name text, p_target_id uuid, p_target_name text, p_job_posting_id uuid, p_job_posting_title text, p_description text, p_evidence_urls text[], p_severity report_severity, p_work_log_id uuid, p_work_date text) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_review(p_work_log_id uuid, p_job_posting_id uuid, p_job_posting_title text, p_work_date text, p_reviewer_id uuid, p_reviewer_name text, p_reviewer_type text, p_reviewee_id uuid, p_reviewee_name text, p_sentiment review_sentiment, p_tags text[], p_comment text) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_board_comment_count_sync() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_cleanup_expired_fcm_tokens() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.fn_cleanup_rate_limits() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.fn_expire_by_last_work_date() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.fn_expire_fixed_postings_batch() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.fn_notification_delete_decrement() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_notification_insert_increment() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_notification_read_decrement() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_notify_inquiry_created() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_notify_tournament_approval() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.fn_send_review_reminders() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.fn_update_job_posting_stats() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_latest_employer_application(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_unread_notification_count(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_board_post_view_count(p_post_id text) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_unread_counter() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid) SET search_path = '', pg_temp;
ALTER FUNCTION public.log_collaborator_audit() SET search_path = '', pg_temp;
ALTER FUNCTION public.notify_employer_application_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_application_insert() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_application_update() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_board_comment_insert() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_board_post_update() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_collaborator_added() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_collaborator_removed() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_inquiry_insert() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_job_posting_insert() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_job_posting_owner_expired() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_job_posting_update() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_report_insert() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_review_insert() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_work_log_checkinout_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_work_log_insert() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_work_log_no_show_update() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.notify_on_work_log_update() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.permanently_delete_user(p_user_id uuid) SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.protect_work_log_payroll_columns() SET search_path = public, pg_temp;
ALTER FUNCTION public.register_as_employer(p_employer_agreements jsonb, p_intro text) SET search_path = public, pg_temp;
ALTER FUNCTION public.reject_employer_application(p_app_id uuid, p_reason text, p_category text) SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_unread_counter(p_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.review_report(p_report_id uuid, p_status text, p_reviewer_id uuid, p_reviewer_notes text) SET search_path = public, pg_temp;
ALTER FUNCTION public.rls_auto_enable() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.search_users_by_phone(p_phone text) SET search_path = public, pg_temp;
ALTER FUNCTION public.search_users_for_collaborator_invite(p_job_posting_id uuid, p_email_query text) SET search_path = '', pg_temp;
ALTER FUNCTION public.sync_schedule_board(p_job_posting_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_user_role_to_app_metadata() SET search_path = public, pg_temp;
ALTER FUNCTION public.toggle_board_post_vote(p_post_id text, p_user_id uuid, p_vote_type text) SET search_path = public, pg_temp;
ALTER FUNCTION public.toggle_comment_reaction(p_post_id uuid, p_comment_id uuid, p_user_id uuid, p_reaction_type text) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_send_push_notification() SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.update_user_role(p_user_id uuid, p_new_role text) SET search_path = public, pg_temp;
