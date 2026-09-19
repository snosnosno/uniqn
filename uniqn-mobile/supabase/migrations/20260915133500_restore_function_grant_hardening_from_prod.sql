-- ============================================================
-- 함수 EXECUTE 권한 하드닝 복원 — 레포 체인을 prod 실태에 맞춘다
-- 2026-09-15
-- ============================================================
--
-- 무엇이 문제였나 — **운영 DB 는 안전한데 레포만 안전하지 않다**
--
--   `npm run db:reset` 으로 레포 마이그 체인을 처음부터 적용하면, prod 보다 훨씬 열린
--   DB 가 만들어진다. 2026-09-15 실측:
--
--     anon 이 EXECUTE 할 수 있는 public 함수
--       prod  :  26개
--       레포  : 108개   ← 82개 초과
--
--   초과분에는 이런 것들이 있었다:
--     `permanently_delete_user(uuid)` · `update_user_role(uuid,text)` ·
--     `approve_employer_application(uuid)` · `register_as_employer(jsonb,text)` ·
--     `remove_workspace_member(uuid,uuid)` · `create_workspace(text)` ·
--     ops_* 대회 운영 쓰기 RPC 35종(참가자 등록·탈락·좌석 배정·블라인드 조작 등)
--
--   **로그인하지 않은 사용자가 계정을 지우고 역할을 바꿀 수 있는 상태다.** prod 는 그렇지
--   않다 — 어느 시점에 REVOKE 가 적용됐지만 그 마이그레이션이 레포에 남지 않았다.
--   (2026-07-10 Tier-3 하드닝 `20260710000300` 이 대표적이다. `tier3_bc_visibility_and_
--   batch_revoke.test.sql` 이 그 결과를 단언하는데, 정작 그 마이그 파일이 체인에 없다.)
--
--   그래서 이 드리프트는 **prod 를 보는 한 영원히 안 보인다.** 새 환경(스테이징·재해복구·
--   신규 개발자 로컬)을 레포로 세우는 순간에만 드러난다.
--
-- 무엇을 바꾸나 — **권한만.** 함수 본문·시그니처·RLS 정책은 건드리지 않는다.
--   ① anon 허용 목록(26개) 밖의 모든 public 함수에서 anon EXECUTE 회수
--   ② prod 가 authenticated 에게도 닫아둔 배치/카운터/레이트리밋 함수에서 authenticated 회수
--
--   두 단계 모두 **카탈로그를 훑어 처리한다** — 이름을 하드코딩하면 오버로드를 놓치고,
--   앞으로 추가되는 함수에는 규칙이 걸리지 않는다. 이미 회수된 prod 에서는 아무 것도
--   하지 않는다(멱등).
--
-- ⚠️ anon 허용 26개는 **prod 실측값을 그대로 옮긴 것**이지 새로 고른 게 아니다.
--    트리거 함수(`check_xss_fields` 등)가 섞여 있는 것도 prod 그대로다 — 트리거 리턴
--    타입 함수는 직접 호출이 언어 차원에서 거부되므로 무해하고, 여기서 목록을 '정리'하면
--    prod 와 또 갈라진다. 정리는 별도 작업으로.
-- ============================================================

-- ─── ① anon EXECUTE 회수 ────────────────────────────────────────────────────
DO $revoke_anon$
DECLARE
  -- 2026-09-15 prod 실측 = anon 이 EXECUTE 할 수 있는 public 함수 전체(26개).
  -- 늘리려면 여기와 함께 anon 계약을 단언하는 pgTAP(anon_rpc_security_hardening,
  -- ops_open_access_s1, anon_rate_limit_phone_revoke)도 같이 고쳐야 한다.
  k_allow CONSTANT text[] := ARRAY[
    '_build_schedule_board_body', '_fmt_worklog_time', '_format_compensation_label',
    '_normalize_time_slot', '_posting_role_key', '_posting_slot_key',
    '_total_positions_from_schedule',
    'check_email_exists', 'check_nickname_exists', 'check_xss_fields',
    'enforce_board_comment_parent_integrity', 'enforce_board_comment_pin_invariants',
    'enforce_board_comment_update_scope',
    'fn_recalc_total_and_capacity', 'fn_sync_last_work_date',
    'get_my_role', 'get_posting_filled_counts', 'get_regular_posting_date_counts',
    'increment_announcement_view_count', 'increment_view_count',
    'is_admin', 'is_employer_or_admin', 'list_my_workspaces',
    'ops_get_monitor_snapshot', 'ops_get_player_view', 'update_updated_at'
  ];
  v_fn      record;
  v_revoked int := 0;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT (p.proname = ANY (k_allow))
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    -- anon 은 PUBLIC 의 멤버다. PUBLIC 을 남겨두면 anon 회수가 무효가 되므로 함께 끊는다.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_fn.sig);
    v_revoked := v_revoked + 1;
  END LOOP;

  RAISE NOTICE '[20260915133500] anon EXECUTE 회수: %건 (prod 기대값 0 = 이미 안전)', v_revoked;
END
$revoke_anon$;

-- ─── ② authenticated EXECUTE 회수 (배치·카운터·레이트리밋) ──────────────────
-- 사용자가 직접 부를 이유가 없는 서버 전용 함수들이다. prod 는 이미 닫혀 있고
-- 앱은 정상 동작한다 — 즉 회수해도 깨지는 기능이 없다는 것이 운영으로 증명돼 있다.
-- 목록은 2026-07-10 Tier-3 하드닝이 다루던 9개 + prod 가 같은 이유로 닫아둔 레이트리밋 3종.
DO $revoke_auth$
DECLARE
  -- 2026-09-15 prod 실측 = authenticated 가 EXECUTE 할 수 **없는** public 함수 전체(77개).
  -- 손으로 고른 목록이 아니라 운영 DB 를 그대로 옮긴 것이다. 대부분 트리거 함수이고
  -- (트리거 리턴 타입은 직접 호출이 언어 차원에서 거부되므로 무해하지만 prod 와 맞춘다),
  -- 나머지는 배치·카운터·레이트리밋 같은 서버 전용 함수다.
  --   · Tier-3(20260710000300) 9개  → tier3_bc_visibility_and_batch_revoke.test.sql 계약
  --   · 레이트리밋 3종             → anon_rate_limit_phone_revoke.test.sql 계약
  --   · fn_ops_* 6종               → ops_live_stats_deferred / ops_clock_rpc_security 계약
  k_deny CONSTANT text[] := ARRAY[
    'check_application_tournament_approval', 'check_ip_rate_limit', 'check_rate_limit',
    'check_user_rate_limit', 'decrement_unread_counter', 'derive_region_slug',
    'enforce_jp_status_transition', 'enforce_tournament_approval_authority',
    'enforce_work_log_checkout_after_checkin', 'enforce_work_log_payroll_owner',
    'enqueue_schedule_board_sync_on_expiration', 'expire_pending_workspace_invitations',
    'fn_board_comment_count_sync', 'fn_cleanup_expired_fcm_tokens', 'fn_cleanup_rate_limits',
    'fn_expire_by_last_work_date', 'fn_expire_fixed_postings_batch',
    'fn_expire_pending_applications_on_close', 'fn_fixed_posting_expired',
    'fn_jpc_role_change_audit', 'fn_jpc_role_update_guard', 'fn_log_scheduled_close',
    'fn_notification_delete_decrement', 'fn_notification_read_decrement',
    'fn_notify_cancellation_request', 'fn_notify_posting_capacity_gap',
    'fn_notify_tournament_approval', 'fn_ops_events_append_only', 'fn_ops_init_derived_rows',
    'fn_ops_live_stats_recompute_trigger', 'fn_ops_live_stats_recompute_trigger_tournaments',
    'fn_ops_recompute_live_stats', 'fn_ops_set_updated_at', 'fn_reports_pin_identity',
    'fn_send_review_reminders', 'fn_sync_application_completion',
    'fn_sync_workspace_member_count', 'fn_update_job_posting_stats',
    'fn_work_logs_pin_identity', 'fn_work_logs_pin_payroll', 'fn_work_logs_pin_posting_id',
    'fn_workspaces_set_updated_at', 'get_unread_notification_count', 'handle_new_user',
    'increment_unread_counter', 'log_collaborator_audit',
    'normalize_work_log_attendance_quarter_hour', 'notify_employer_application_change',
    'notify_on_application_insert', 'notify_on_application_update',
    'notify_on_board_comment_insert', 'notify_on_board_post_update',
    'notify_on_collaborator_added', 'notify_on_collaborator_removed',
    'notify_on_inquiry_insert', 'notify_on_job_posting_insert',
    'notify_on_job_posting_owner_expired', 'notify_on_job_posting_update',
    'notify_on_ops_staff_insert', 'notify_on_report_insert', 'notify_on_report_review',
    'notify_on_review_insert', 'notify_on_work_log_checkinout_update',
    'notify_on_work_log_insert', 'notify_on_work_log_no_show_update',
    'notify_on_work_log_update', 'notify_on_workspace_invitation_insert',
    'prevent_role_self_escalation', 'protect_work_log_payroll_columns',
    'protect_work_log_qr_scan_timestamps', 'recompute_work_log_duration',
    'remove_direct_staff', 'reset_unread_counter', 'sync_schedule_board',
    'sync_schedule_board_legacy', 'sync_user_role_to_app_metadata',
    'trigger_send_push_notification'
  ];
  v_fn      record;
  v_revoked int := 0;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (k_deny)
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_fn.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_fn.sig);
    v_revoked := v_revoked + 1;
  END LOOP;

  RAISE NOTICE '[20260915133500] authenticated EXECUTE 회수: %건 (prod 기대값 0)', v_revoked;
END
$revoke_auth$;

-- ============================================================
-- 적용 직후 자기 검증
-- ============================================================
-- 루프가 조용히 0건을 돌고 끝나는 경우(패턴 오타·스키마 오인)와, 회수가 과하게 번져
-- 앱을 죽이는 경우를 **둘 다** 잡는다. prod-migrate 는 --single-transaction +
-- ON_ERROR_STOP=1 이라 여기서 던지면 위 회수까지 통째로 롤백된다.
DO $verify$
DECLARE
  v_anon_cnt int;
  v_anon     text[];
  v_leftover text[];
  v_broken   text[];
BEGIN
  SELECT count(*)::int, array_agg(p.proname ORDER BY p.proname)
    INTO v_anon_cnt, v_anon
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_anon_cnt <> 26 THEN
    RAISE EXCEPTION 'anon EXECUTE 가능 public 함수가 26개가 아니라 %개다: %', v_anon_cnt, v_anon;
  END IF;

  -- 위험 함수가 anon 에 남아 있지 않은지 이름으로 한 번 더 못 박는다.
  SELECT array_agg(p.proname ORDER BY p.proname) INTO v_leftover
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY['permanently_delete_user','update_user_role',
                               'approve_employer_application','register_as_employer',
                               'remove_workspace_member','create_workspace'])
    AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF v_leftover IS NOT NULL THEN
    RAISE EXCEPTION '계정·권한 함수가 아직 anon 에 열려 있다: %', v_leftover;
  END IF;

  -- 반대 방향 — 사용자가 실제로 쓰는 RPC 의 authenticated 가 끊기지 않았는지.
  -- 끊기면 화면이 조용히 권한 에러만 낸다.
  SELECT array_agg(p.proname ORDER BY p.proname) INTO v_broken
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY (ARRAY['settle_work_log','bulk_settle_work_logs','confirm_application',
                               'apply_with_capacity_check','cancel_application_atomically',
                               'get_venue_day_slots','update_work_log_slot',
                               'ops_get_monitor_snapshot','create_review'])
    AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_broken IS NOT NULL THEN
    RAISE EXCEPTION '사용 중인 RPC 의 authenticated EXECUTE 가 끊겼다 — 회수가 과했다: %', v_broken;
  END IF;

  -- authenticated 축도 prod 실측값으로 못 박는다. 회수가 **덜** 되면 위 anon 검사는
  -- 통과하므로 여기서 따로 잡지 않으면 조용히 지나간다.
  SELECT count(*)::int INTO v_anon_cnt
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE');

  IF v_anon_cnt <> 77 THEN
    RAISE EXCEPTION 'authenticated 가 EXECUTE 못 하는 public 함수가 77개가 아니라 %개다 (prod 실측 77)', v_anon_cnt;
  END IF;

  RAISE NOTICE '[20260915133500] 계약 확인됨 — anon EXECUTE = 26, authenticated 거부 = 77, 위험 함수 노출 0, 사용 RPC 유실 0';
END
$verify$;
