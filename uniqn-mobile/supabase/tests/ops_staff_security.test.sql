-- ops 1e M3 보안 pgTAP: 신규 RPC 5종 anon REVOKE / authenticated GRANT / actor 위조 바인딩 +
--   ops anon-executable SECDEF 카탈로그 총량 불변(=2, monitor/player) + ops_staff Realtime 등록.
-- 스펙: task-4-brief.md(Step 1). 패턴: ops_rpc_security.test.sql(anon/authenticated has_function_privilege +
--   throws_ok actor 위조), ops_player_view_security.test.sql(권한격리 섹션 배치), ops_1f_grants.sql 주석
--   ("anon-executable SECDEF ops = monitor/player 2개 불변 계약").
-- ⚠️ 적대검증 E2/F4: 함수별 anon=false 단언만으로는 "신규 함수 REVOKE 누락"을 못 잡는다(신규 SECDEF 함수는
--   기본적으로 PUBLIC EXECUTE 를 상속하고 anon 도 PUBLIC 의 일부라 자동 상속됨 — pitfall_supabase_new_
--   function_anon_default_grant). 카탈로그 전수 카운트 단언만이 "다음에 추가되는 신규 함수"까지 잡는 유일한
--   회귀 방지책이다(개별 함수명 단언은 그 함수 자체만 커버).
-- ⚠️ ops_test_seed/ops_test_seed_players/ops_test_set_user(fixtures/ops_helpers.sql)는 SECURITY DEFINER +
--   함수 GRANT 없음(fixtures 관례 — "함수 GRANT 금지") → PostgreSQL 기본값(PUBLIC EXECUTE)으로 anon 도
--   상속받는다. prod 마이그레이션에는 미등록(로컬 test DB 전용 fixture)이므로 카운트는 'ops\_test\_%'
--   제외로 실제 운영 RPC만 스코프해야 prod 배포 카탈로그와 동치가 된다.
BEGIN;
SELECT plan(17);

-- ─── (1~5) anon REVOKE: 신규 RPC 5종 ───
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_set_tournament_posting(uuid,uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE ops_set_tournament_posting');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_import_staff_from_posting(uuid,uuid,text)', 'EXECUTE'),
  'anon cannot EXECUTE ops_import_staff_from_posting');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_add_staff(uuid,uuid,uuid,staff_role,text)', 'EXECUTE'),
  'anon cannot EXECUTE ops_add_staff');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_remove_staff(uuid,uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE ops_remove_staff');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_assign_table_staff(uuid,uuid,uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE ops_assign_table_staff');

-- ─── (6~10) authenticated GRANT 유지: 신규 RPC 5종 ───
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_set_tournament_posting(uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_set_tournament_posting');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_import_staff_from_posting(uuid,uuid,text)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_import_staff_from_posting');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_add_staff(uuid,uuid,uuid,staff_role,text)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_add_staff');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_remove_staff(uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_remove_staff');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_assign_table_staff(uuid,uuid,uuid,uuid)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_assign_table_staff');

-- ─── (11) anon-executable SECDEF ops 카탈로그 총량 = 정확히 2(monitor/player) ───
-- 신규 함수가 REVOKE 마이그 없이 추가되면 이 카운트가 즉시 튀어 회귀를 잡는다(개별 함수명 단언과 달리
-- "다음에 추가될 이름 모르는 함수"까지 커버).
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'ops\_%' AND p.proname NOT LIKE 'ops\_test\_%'
      AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  2, 'anon-executable ops SECDEF 총량=2(ops_get_monitor_snapshot/ops_get_player_view만)');

-- ─── (12~16) actor 위조: p_actor_id ≠ auth.uid() 비-admin 호출 → P0001 PERMISSION_DENIED ───
-- 위조 caller=member, p_actor_id=owner(본인 아님). 5종 함수 모두 actor 가드가 본문 최상단 첫 검사라
-- 나머지 인자는 존재 여부와 무관하게 가드에서 즉시 차단된다(더미 값 사용 가능).
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
  PERFORM set_config('ops.table_id',      s.table_id::text,      true);
END $$;

SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);

SELECT throws_ok(
  $$ SELECT public.ops_set_tournament_posting(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, NULL::uuid) $$,
  'P0001', NULL, 'forged actor blocked: ops_set_tournament_posting');

SELECT throws_ok(
  $$ SELECT public.ops_import_staff_from_posting(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, NULL) $$,
  'P0001', NULL, 'forged actor blocked: ops_import_staff_from_posting');

SELECT throws_ok(
  $$ SELECT public.ops_add_staff(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, gen_random_uuid()) $$,
  'P0001', NULL, 'forged actor blocked: ops_add_staff');

SELECT throws_ok(
  $$ SELECT public.ops_remove_staff(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, gen_random_uuid()) $$,
  'P0001', NULL, 'forged actor blocked: ops_remove_staff');

SELECT throws_ok(
  $$ SELECT public.ops_assign_table_staff(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       (current_setting('ops.table_id'))::uuid, NULL::uuid) $$,
  'P0001', NULL, 'forged actor blocked: ops_assign_table_staff');

-- ─── (17) Realtime: ops_staff publication 등록 ───
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ops_staff'),
  'ops_staff registered in supabase_realtime publication');

SELECT * FROM finish();
ROLLBACK;
