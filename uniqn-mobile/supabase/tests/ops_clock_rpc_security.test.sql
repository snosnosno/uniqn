-- ops 1c 권한 하드닝: 클럭/블라인드 RPC 5종 anon REVOKE/authenticated GRANT,
--   트리거함수 3종 anon REVOKE, publication 3테이블 등록.
-- 패턴: ops_rpc_security.test.sql(EXECUTE 권한) + ops_tables_seats_rls.test.sql.
BEGIN;
SELECT plan(16);

-- ─── 클럭/블라인드 변이 RPC 5종: anon EXECUTE 없음 / authenticated 있음 ───
SELECT ok(NOT has_function_privilege('anon', 'public.ops_set_blind_levels(uuid,uuid,jsonb)', 'EXECUTE'),
  'anon cannot EXECUTE ops_set_blind_levels');
SELECT ok(has_function_privilege('authenticated', 'public.ops_set_blind_levels(uuid,uuid,jsonb)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_set_blind_levels');

SELECT ok(NOT has_function_privilege('anon', 'public.ops_clock_start(uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE ops_clock_start');
SELECT ok(has_function_privilege('authenticated', 'public.ops_clock_start(uuid,uuid)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_clock_start');

SELECT ok(NOT has_function_privilege('anon', 'public.ops_clock_pause(uuid,uuid)', 'EXECUTE'),
  'anon cannot EXECUTE ops_clock_pause');
SELECT ok(has_function_privilege('authenticated', 'public.ops_clock_pause(uuid,uuid)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_clock_pause');

SELECT ok(NOT has_function_privilege('anon', 'public.ops_clock_set_level(uuid,uuid,integer)', 'EXECUTE'),
  'anon cannot EXECUTE ops_clock_set_level');
SELECT ok(has_function_privilege('authenticated', 'public.ops_clock_set_level(uuid,uuid,integer)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_clock_set_level');

SELECT ok(NOT has_function_privilege('anon', 'public.ops_clock_adjust(uuid,uuid,integer)', 'EXECUTE'),
  'anon cannot EXECUTE ops_clock_adjust');
SELECT ok(has_function_privilege('authenticated', 'public.ops_clock_adjust(uuid,uuid,integer)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_clock_adjust');

-- ─── 트리거 함수 3종: anon EXECUTE 없음(SECDEF advisor 적발 차단) ───
SELECT ok(NOT has_function_privilege('anon', 'public.fn_ops_recompute_live_stats(uuid)', 'EXECUTE'),
  'anon cannot EXECUTE fn_ops_recompute_live_stats');
SELECT ok(NOT has_function_privilege('anon', 'public.fn_ops_live_stats_recompute_trigger()', 'EXECUTE'),
  'anon cannot EXECUTE fn_ops_live_stats_recompute_trigger');
SELECT ok(NOT has_function_privilege('anon', 'public.fn_ops_init_derived_rows()', 'EXECUTE'),
  'anon cannot EXECUTE fn_ops_init_derived_rows');

-- ─── Realtime publication: 3테이블 등록 ───
SELECT ok(EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                    AND schemaname = 'public' AND tablename = 'ops_blind_levels'),
  'ops_blind_levels in supabase_realtime publication');
SELECT ok(EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                    AND schemaname = 'public' AND tablename = 'ops_clock'),
  'ops_clock in supabase_realtime publication');
SELECT ok(EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
                    AND schemaname = 'public' AND tablename = 'ops_live_stats'),
  'ops_live_stats in supabase_realtime publication');

SELECT * FROM finish();
ROLLBACK;
