-- ops_tables/ops_seats SELECT-only RLS + 좌석 변이 RPC 의 anon REVOKE / authenticated GRANT.
-- 패턴: ops_tables_rls.test.sql(멤버십 RLS) + ops_rpc_security.test.sql(EXECUTE 권한).
BEGIN;
SELECT plan(11);

-- ─── EXECUTE 권한: anon 회수 / authenticated 유지 (fixture 가 함수 GRANT 안 하므로 마이그 상태 유지) ───
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_add_table(uuid, uuid, integer, text, ops_table_lock_type, integer)', 'EXECUTE'),
  'anon cannot EXECUTE ops_add_table');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_add_table(uuid, uuid, integer, text, ops_table_lock_type, integer)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_add_table');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_move_seat(uuid, uuid, uuid)', 'EXECUTE'),
  'anon cannot EXECUTE ops_move_seat');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_move_seat(uuid, uuid, uuid)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_move_seat');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_redraw_waitlist_fill(uuid, uuid, jsonb)', 'EXECUTE'),
  'anon cannot EXECUTE ops_redraw_waitlist_fill');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_redraw_waitlist_fill(uuid, uuid, jsonb)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_redraw_waitlist_fill');

-- ─── SELECT-only RLS: owner/멤버는 보이고, outsider 는 0 ───
DO $$ DECLARE s RECORD; BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

-- owner: 테이블 1 + 좌석 2 모두 보임
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_tables WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  1, 'owner sees own table');
SELECT is((SELECT count(*)::int FROM public.ops_seats WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  2, 'owner sees own seats');

-- workspace 멤버: 연결 공고 워크스페이스 멤버라 좌석 보임 (is_ops_member -> is_workspace_member)
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_seats WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  2, 'workspace member sees seats');

-- outsider: 테이블/좌석 모두 0
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.ops_tables WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  0, 'outsider sees no tables');
SELECT is((SELECT count(*)::int FROM public.ops_seats WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  0, 'outsider sees no seats');

SELECT * FROM finish();
ROLLBACK;
