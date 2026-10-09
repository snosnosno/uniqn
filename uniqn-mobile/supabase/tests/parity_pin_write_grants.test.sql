-- uniqn-mobile/supabase/tests/parity_pin_write_grants.test.sql
-- 파리티 고정 + anon write grant 회수 회귀 (2026-07-12, 마이그 20260712010100)
--
-- 고정하는 계약:
--   [1] applications 트리거 3종 존재 (updated_at / xss_check 파리티 + 승인 게이트)
--   [2] 레포 전용 느슨 정책 부재 (notifications_insert_service,
--       work_logs_insert_owner_or_admin, work_logs_delete_admin,
--       work_logs_update_involved)
--   [3] users.nickname UNIQUE 제약 존재 (prod 파리티)
--   [4] protect_work_log_payroll_columns 에 settled lock 존재 (본문 카나리)
--   [5] 같은 함수에 정산 완료 건의 no_show 전환 차단 블록 존재 (20260813100000, 본문 카나리)
--
-- ※ anon write 회수(마이그 20260712010100)는 여기서 검증하지 않는다 —
--   테스트 스택(jpc_helpers.sql)은 RLS 매트릭스 검증을 위해 anon 에 blanket GRANT 를
--   의도적으로 부여하므로(wiki decisions/test-db-grants), grant 부재 단언이 하네스
--   설계와 충돌한다. anon write 회수는 defense-in-depth 이고 RLS 가 실제 보안
--   경계다 — prod 실측으로 검증했다(감사 §11).

BEGIN;
SELECT plan(7);

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

-- [3] users.nickname UNIQUE (prod 파리티)
SELECT is(
  (SELECT count(*)::int FROM pg_constraint
    WHERE conname = 'users_nickname_key'
      AND conrelid = 'public.users'::regclass),
  1, 'users_nickname_key UNIQUE 제약 존재 (prod 파리티)'
);

-- [4] settled lock 본문 카나리
SELECT is(
  (SELECT count(*)::int FROM pg_proc
    WHERE proname = 'protect_work_log_payroll_columns'
      AND prosrc LIKE '%settled_work_log_custom_fields_locked%'),
  1, 'protect_work_log_payroll_columns 에 settled lock 블록 존재'
);

-- [5] 정산 완료 건의 no_show 전환 차단 본문 카나리 (20260813100000, 감사 3-2)
--     이 함수는 CREATE OR REPLACE 로 여러 번 확장됐다. 뒤 마이그가 옛 본문을 복사해 덮으면 이 블록이
--     통째로 사라져도 함수 개수(파리티)는 그대로다 — 본문 문자열로 고정한다.
--     축이 둘이다(status · no_show_at): 앱은 no_show_at 유무로 노쇼를 판정하므로 둘 다 있어야 한다.
SELECT is(
  (SELECT count(*)::int FROM pg_proc
    WHERE proname = 'protect_work_log_payroll_columns'
      AND prosrc LIKE '%ALREADY_SETTLED: 정산이 완료된 근무는 노쇼로 변경할 수 없습니다%'
      AND prosrc LIKE '%NEW.no_show_at IS DISTINCT FROM OLD.no_show_at%'),
  1, 'protect_work_log_payroll_columns 에 settled no_show 차단 블록 존재(status·no_show_at 두 축)'
);

SELECT * FROM finish();
ROLLBACK;
