-- ============================================================
-- 2026-07-10 Tier-3 하드닝 회귀 가드 (마이그 20260710000300)
--   1) bc_select 가 board_posts.visibility 를 미러(비공개 글 댓글 잠복누수 차단)
--   2) 미사용 배치/카운터 9함수의 authenticated EXECUTE 회수 + service_role 유지
-- prod-only 함수(카운터류)는 존재 가드로 skip. 안전: BEGIN/ROLLBACK.
-- ============================================================
BEGIN;
SELECT plan(3);

-- 1) bc_select visibility 미러
SELECT ok(
  (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
   WHERE polrelid = 'public.board_comments'::regclass AND polname = 'bc_select')
   LIKE '%visibility%',
  'bc_select 가 board_posts.visibility 를 미러한다(비공개 글 댓글 비노출)'
);

-- 2) 배치/카운터 함수: authenticated EXECUTE 0건(존재분 대상)
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = ANY(ARRAY['decrement_unread_counter','reset_unread_counter',
       'get_unread_notification_count','fn_expire_by_last_work_date','fn_expire_fixed_postings_batch',
       'fn_cleanup_expired_fcm_tokens','fn_cleanup_rate_limits','expire_pending_workspace_invitations',
       'fn_send_review_reminders'])
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0,
  '미사용 배치/카운터 함수는 authenticated EXECUTE 가 없다'
);

-- 3) 동일 함수들 service_role 유지(정상 edge/cron 경로 무회귀) — 존재분 전부 유지
SELECT ok(
  (SELECT bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE'))
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = ANY(ARRAY['decrement_unread_counter','reset_unread_counter',
       'get_unread_notification_count','fn_expire_by_last_work_date','fn_expire_fixed_postings_batch',
       'fn_cleanup_expired_fcm_tokens','fn_cleanup_rate_limits','expire_pending_workspace_invitations',
       'fn_send_review_reminders'])),
  'service_role 는 EXECUTE 유지(edge/cron 경로 무회귀)'
);

SELECT * FROM finish();
ROLLBACK;
