-- uniqn-mobile/supabase/tests/parity_pin_write_grants.test.sql
-- 파리티 고정 + anon write grant 회수 회귀 (2026-07-12, 마이그 20260712010100)
--
-- 고정하는 계약:
--   [1] applications 트리거 3종 존재 (updated_at / xss_check 파리티 + 승인 게이트)
--   [2] 레포 전용 느슨 정책 부재 (notifications_insert_service,
--       work_logs_insert_owner_or_admin, work_logs_delete_admin,
--       work_logs_update_involved)
--   [3] anon 은 notifications/applications/work_logs 에 write 권한 없음
--   [4] users.nickname UNIQUE 제약 존재 (prod 파리티)
--   [5] protect_work_log_payroll_columns 에 settled lock 존재 (본문 카나리)
--
-- ※ 로컬 픽스처(jpc_helpers.sql)의 블랭킷 GRANT 는 동일 REVOKE 를 미러하므로
--   test:db:helpers 재실행 후에도 [3] 이 유지된다.

BEGIN;
SELECT plan(9);

-- [1] 트리거 존재
SELECT has_trigger('public', 'applications', 'applications_updated_at',
  'applications_updated_at 트리거 존재 (prod 파리티)');
SELECT has_trigger('public', 'applications', 'applications_xss_check',
  'applications_xss_check 트리거 존재 (prod 파리티)');
SELECT has_trigger('public', 'applications', 'applications_tournament_approval_gate',
  'applications_tournament_approval_gate 트리거 존재 (방어심화)');

-- [2] 레포 전용 느슨 정책 부재
SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('notifications_insert_service',
                         'work_logs_insert_owner_or_admin',
                         'work_logs_delete_admin',
                         'work_logs_update_involved')),
  0, '레포 전용 느슨 정책 4종 부재 (prod 파리티)'
);

-- [3] anon write 권한 회수 (INSERT/UPDATE/DELETE 모두 false)
SELECT is(
  (SELECT bool_or(has_table_privilege('anon', 'public.notifications', p))
     FROM unnest(ARRAY['INSERT','UPDATE','DELETE']) AS p),
  false, 'anon 은 notifications 에 write 권한 없음'
);
SELECT is(
  (SELECT bool_or(has_table_privilege('anon', 'public.applications', p))
     FROM unnest(ARRAY['INSERT','UPDATE','DELETE']) AS p),
  false, 'anon 은 applications 에 write 권한 없음'
);
SELECT is(
  (SELECT bool_or(has_table_privilege('anon', 'public.work_logs', p))
     FROM unnest(ARRAY['INSERT','UPDATE','DELETE']) AS p),
  false, 'anon 은 work_logs 에 write 권한 없음'
);

-- [4] users.nickname UNIQUE (prod 파리티)
SELECT is(
  (SELECT count(*)::int FROM pg_constraint
    WHERE conname = 'users_nickname_key'
      AND conrelid = 'public.users'::regclass),
  1, 'users_nickname_key UNIQUE 제약 존재 (prod 파리티)'
);

-- [5] settled lock 본문 카나리
SELECT is(
  (SELECT count(*)::int FROM pg_proc
    WHERE proname = 'protect_work_log_payroll_columns'
      AND prosrc LIKE '%settled_work_log_custom_fields_locked%'),
  1, 'protect_work_log_payroll_columns 에 settled lock 블록 존재'
);

SELECT * FROM finish();
ROLLBACK;
