-- ops 1c-3 모니터: 공개 RPC 권한 격리 + 토큰가드 + 비-PII 투영 + rotate authz.
-- 패턴: ops_clock_state.test.sql(seed·set_user·throws_ok), ops_clock_rpc_security.test.sql(has_function_privilege).
-- ⚠️ ops_get_monitor_snapshot 만 anon-executable(화이트리스트). rotate 는 authed 전용.
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;   -- [1f] DEFERRED live_stats 트리거 즉시 발화(bounty_cost UPDATE → knockout_pool 재계산)
SELECT plan(20);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

-- ─── (1~4) 권한 격리 ───
SELECT ok(has_function_privilege('anon', 'public.ops_get_monitor_snapshot(text)', 'EXECUTE'),
  'anon CAN EXECUTE ops_get_monitor_snapshot (공개 전광판)');
SELECT ok(NOT has_function_privilege('anon', 'public.ops_rotate_monitor_token(uuid,uuid,boolean)', 'EXECUTE'),
  'anon CANNOT EXECUTE ops_rotate_monitor_token (운영자 전용)');
SELECT ok(has_function_privilege('authenticated', 'public.ops_rotate_monitor_token(uuid,uuid,boolean)', 'EXECUTE'),
  'authenticated CAN EXECUTE ops_rotate_monitor_token');
SELECT ok(has_function_privilege('authenticated', 'public.ops_get_monitor_snapshot(text)', 'EXECUTE'),
  'authenticated CAN EXECUTE ops_get_monitor_snapshot');

-- ─── (5~8) rotate: 발급·영속·멱등·force ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE v text;
BEGIN
  v := public.ops_rotate_monitor_token(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid) ->> 'monitorToken';
  PERFORM set_config('ops.tok1', v, true);
END $$;
SELECT is(char_length(current_setting('ops.tok1')), 48, 'rotate 발급 토큰 = 48자 hex(192bit)');
SELECT is(
  (SELECT monitor_token FROM public.ops_tournaments WHERE id = (current_setting('ops.tournament_id'))::uuid),
  current_setting('ops.tok1'), 'monitor_token 행에 영속');

DO $$
DECLARE v text;
BEGIN
  v := public.ops_rotate_monitor_token(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid) ->> 'monitorToken';
  PERFORM set_config('ops.tok2', v, true);
END $$;
SELECT is(current_setting('ops.tok2'), current_setting('ops.tok1'), '멱등: force 없으면 기존 토큰 반환');

DO $$
DECLARE v text;
BEGIN
  v := public.ops_rotate_monitor_token(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, true) ->> 'monitorToken';
  PERFORM set_config('ops.tok3', v, true);
END $$;
SELECT isnt(current_setting('ops.tok3'), current_setting('ops.tok1'), 'force=true: 새 토큰으로 회전');

-- ─── (9~10) rotate authz: 위조 actor·비멤버 거부 ───
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_rotate_monitor_token(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'rotate: 위조 actor(member→owner 명의) 거부');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_rotate_monitor_token(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'rotate: 비멤버(outsider) 거부');

-- ─── (11~13) snapshot 토큰가드 ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_get_monitor_snapshot(NULL) $$,
  'P0001', NULL, 'snapshot: NULL 토큰 거부');
SELECT throws_ok(
  $$ SELECT public.ops_get_monitor_snapshot('short') $$,
  'P0001', NULL, 'snapshot: 짧은 토큰(<32) 거부');
SELECT throws_ok(
  $$ SELECT public.ops_get_monitor_snapshot(repeat('0', 48)) $$,
  'P0001', NULL, 'snapshot: 미존재 토큰 거부(존재 노출 회피)');

-- ─── (14~17) snapshot 유효 + 비-PII 화이트리스트 ───
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok3')) -> 'tournament' ->> 'name'),
  'ops test cup', 'snapshot: 대회명 반환');
SELECT ok(
  public.ops_get_monitor_snapshot(current_setting('ops.tok3'))::text NOT LIKE '%view_token%',
  'snapshot: view_token 미포함');
SELECT ok(
  public.ops_get_monitor_snapshot(current_setting('ops.tok3'))::text NOT LIKE '%phone%',
  'snapshot: phone(PII) 미포함');
SELECT ok(
  public.ops_get_monitor_snapshot(current_setting('ops.tok3'))::text NOT LIKE '%' || current_setting('ops.tok3') || '%',
  'snapshot: monitor_token 에코 미포함');

-- ─── (18) anon 역할 실제 호출 경로 ───
SELECT set_config('role', 'anon', true);
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok3')) -> 'tournament' ->> 'name'),
  'ops test cup', 'anon 역할로 snapshot 호출 성공(공개 전광판 경로)');

-- ─── (19~20) 1f: stats.knockoutPool ───
-- 비-바운티 대회(시드 bounty_cost NULL) → knockoutPool = null (COALESCE 없음 = 클라 카드 숨김 신호)
SELECT ok(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok3'))->'stats'->'knockoutPool') = 'null'::jsonb,
  '1f: 비-바운티 knockoutPool null');
-- bounty_cost 세팅 후 → 집계 반영(entries=1·reentries=0 → total_buyins 1 → 1*10000).
-- 상단 SET CONSTRAINTS ALL IMMEDIATE 로 DEFERRED 트리거 즉시 발화 → live_stats.knockout_pool 재계산.
SELECT set_config('role', 'postgres', true);
UPDATE public.ops_tournaments SET bounty_cost = 10000
  WHERE id = (current_setting('ops.tournament_id'))::uuid;
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok3'))->'stats'->>'knockoutPool')::int, 10000,
  '1f: bounty_cost=10000·entries=1 → knockoutPool=10000');

SELECT * FROM finish();
ROLLBACK;
