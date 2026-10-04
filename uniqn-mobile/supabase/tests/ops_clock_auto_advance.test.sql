-- ops 레벨 자동 전환(마이그 20261004100000): 권한 격리 · 끝난 레벨 따라잡기(앵커 보존) · 여러 레벨 한 번에 ·
--   마지막 레벨 정지 · 일시정지 중 미발동 · 이벤트(actor 없음) · 전광판·플레이어뷰 폴링이 일으키는 전환 · anon=2 계약 ·
--   종료된 대회 미발동 · 익명 유발 이벤트에 기기 이름 없음 · 일시정지·보정이 먼저 따라잡기 · 음수 보정이 레벨을 넘지 않음.
-- 주의: pgTAP 단일 트랜잭션 안에서 now() 는 고정 → "시간이 흐른 상태"는 level_started_at 을 과거로 옮겨 만든다.
BEGIN;
SELECT plan(34);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
  PERFORM set_config('ops.participant_id', s.participant_id::text, true);
END $$;

CREATE FUNCTION pg_temp.tid() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.tournament_id')::uuid $$;
CREATE FUNCTION pg_temp.owner() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.owner_id')::uuid $$;
-- 현재 레벨에서 흐른 초(now() 고정이라 결정적)
CREATE FUNCTION pg_temp.elapsed() RETURNS int LANGUAGE sql AS
  $$ SELECT EXTRACT(EPOCH FROM (now() - level_started_at))::int
       FROM public.ops_clock WHERE tournament_id = pg_temp.tid() $$;
CREATE FUNCTION pg_temp.sort() RETURNS int LANGUAGE sql AS
  $$ SELECT current_level_sort FROM public.ops_clock WHERE tournament_id = pg_temp.tid() $$;
-- 시계를 "sort 레벨이 sec 초 전에 시작된 상태"로 되돌린다(postgres 로 직접 — 시간 경과 모사).
CREATE FUNCTION pg_temp.rewind(p_sort int, p_sec int) RETURNS void LANGUAGE sql AS
  $$ UPDATE public.ops_clock
        SET current_level_sort = p_sort, is_running = true, paused_remaining_sec = NULL,
            level_started_at = now() - make_interval(secs => p_sec)
      WHERE tournament_id = pg_temp.tid() $$;

-- ─── (1~6) 권한 격리 ───
SELECT ok(NOT has_function_privilege('anon', 'public.fn_ops_clock_roll_forward(uuid,boolean)', 'EXECUTE'),
  'anon 은 fn_ops_clock_roll_forward 를 직접 실행할 수 없다');
SELECT ok(NOT has_function_privilege('authenticated', 'public.fn_ops_clock_roll_forward(uuid,boolean)', 'EXECUTE'),
  'authenticated 도 fn_ops_clock_roll_forward 를 직접 실행할 수 없다(멤버 게이트 없는 내부 함수)');
SELECT ok(NOT has_function_privilege('authenticated', 'public.fn_ops_apply_registration_cutoff(uuid,integer,uuid)', 'EXECUTE'),
  'authenticated 는 fn_ops_apply_registration_cutoff 를 직접 실행할 수 없다');
SELECT ok(NOT has_function_privilege('anon', 'public.ops_clock_sync(uuid,uuid)', 'EXECUTE'),
  'anon 은 ops_clock_sync 를 실행할 수 없다');
SELECT ok(has_function_privilege('authenticated', 'public.ops_clock_sync(uuid,uuid)', 'EXECUTE'),
  'authenticated 는 ops_clock_sync 를 실행할 수 있다');
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'ops\_%' AND p.proname NOT LIKE 'ops\_test\_%'
      AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  2, '자동 전환 이후에도 anon-executable ops SECDEF 총량=2');

-- 3레벨(각 600초) + 시작
SELECT ops_test_set_user(pg_temp.owner());
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":3,"big_blind":600,"duration_sec":600}]'::jsonb);
SELECT public.ops_clock_start(pg_temp.tid(), pg_temp.owner());

-- ─── (7~8) 아직 안 끝난 레벨은 건드리지 않는다 ───
SELECT is((public.ops_clock_sync(pg_temp.tid(), pg_temp.owner())->>'advanced')::int, 0,
  '방금 시작한 레벨은 넘어가지 않는다');
SELECT is(pg_temp.sort(), 1, '현재 레벨 = 1 유지');

-- ─── (9~12) 601초 지남 → 레벨 2, 앵커는 "레벨 1 이 끝난 시각"(1초 경과) ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 601);
SELECT ops_test_set_user(pg_temp.owner());
SELECT is((public.ops_clock_sync(pg_temp.tid(), pg_temp.owner())->>'advanced')::int, 1,
  '601초 지난 레벨 1 → 1단계 넘어감');
SELECT is(pg_temp.sort(), 2, '현재 레벨 = 2');
SELECT is(pg_temp.elapsed(), 1, '레벨 2 는 1초 흐른 상태 — 늦게 따라잡아도 시계가 밀리지 않는다');
SELECT is(
  (SELECT (payload->>'action') || '|' || (payload->>'from_sort') || '|' || (payload->>'sort') || '|' || COALESCE(actor_id::text, 'NULL')
     FROM public.ops_events WHERE tournament_id = pg_temp.tid() AND type = 'level_set'
    ORDER BY seq DESC LIMIT 1),
  'auto_advance|1|2|NULL', '자동 전환 이벤트 — action=auto_advance, actor 없음');

-- ─── (13~14) 같은 호출을 다시 해도 또 넘어가지 않는다(멱등) ───
SELECT is((public.ops_clock_sync(pg_temp.tid(), pg_temp.owner())->>'advanced')::int, 0,
  '이미 따라잡은 뒤 재호출 = 0');
SELECT is(pg_temp.sort(), 2, '현재 레벨 = 2 유지');

-- ─── (15~16) 여러 레벨을 한 번에: 레벨 1 에서 1300초 → 레벨 3, 100초 경과 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 1300);
SELECT ops_test_set_user(pg_temp.owner());
SELECT is((public.ops_clock_sync(pg_temp.tid(), pg_temp.owner())->>'advanced')::int, 2,
  '1300초 지남 → 2단계 한 번에');
SELECT is(pg_temp.sort() || '|' || pg_temp.elapsed(), '3|100', '레벨 3, 100초 경과');

-- ─── (17~18) 마지막 레벨은 넘어갈 곳이 없다 — 00:00 에서 멈춘다 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(3, 5000);
SELECT ops_test_set_user(pg_temp.owner());
SELECT is((public.ops_clock_sync(pg_temp.tid(), pg_temp.owner())->>'advanced')::int, 0,
  '마지막 레벨은 시간이 지나도 넘어가지 않는다');
SELECT is(pg_temp.sort(), 3, '현재 레벨 = 3 유지');

-- ─── (19~20) 일시정지 중에는 넘어가지 않는다 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 900);
UPDATE public.ops_clock SET is_running = false, paused_remaining_sec = 0
 WHERE tournament_id = pg_temp.tid();
SELECT ops_test_set_user(pg_temp.owner());
SELECT is((public.ops_clock_sync(pg_temp.tid(), pg_temp.owner())->>'advanced')::int, 0,
  '일시정지 중에는 넘어가지 않는다');
SELECT is(pg_temp.sort(), 1, '현재 레벨 = 1 유지');

-- ─── (21) 권한 없는 사용자는 sync 를 못 부른다 ───
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_clock_sync(pg_temp.tid(), (current_setting('ops.outsider_id'))::uuid) $$,
  'PERMISSION_DENIED%', '대회 멤버가 아니면 ops_clock_sync 거부');

-- ─── (22~24) 전광판 폴링(anon)이 전환을 일으킨다 — 콘솔이 꺼져 있어도 시계가 넘어간다 ───
SELECT ops_test_set_user(pg_temp.owner());
DO $$
BEGIN
  PERFORM set_config('ops.tok',
    public.ops_rotate_monitor_token(pg_temp.tid(), pg_temp.owner()) ->> 'monitorToken', true);
END $$;
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 630);
-- 익명 방문자가 기기 이름 헤더를 실어 보내도(아래 25번 단언) 시스템 이벤트에는 남지 않아야 한다.
SELECT set_config('request.headers',
  json_build_object('x-client-info', 'x; device=' || encode(convert_to('본부 데스크', 'UTF8'), 'base64'))::text, true);
SELECT set_config('role', 'anon', true);
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) #>> '{clock,currentLevelSort}')::int,
  2, 'anon 전광판 스냅샷이 끝난 레벨을 따라잡아 레벨 2 를 돌려준다');
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) #>> '{currentLevel,bigBlind}')::int,
  400, '스냅샷의 현재 블라인드도 레벨 2 것');
SELECT set_config('role', 'postgres', true);
SELECT is(pg_temp.sort() || '|' || pg_temp.elapsed(), '2|30', 'DB 의 시계도 레벨 2, 30초 경과로 옮겨졌다');


-- ─── (25) 익명 폴링이 일으킨 자동 전환 이벤트에는 기기 이름이 붙지 않는다(이력 사칭 방지) ───
SELECT is(
  (SELECT COALESCE(actor_device, 'NULL') || '|' || COALESCE(actor_id::text, 'NULL')
     FROM public.ops_events WHERE tournament_id = pg_temp.tid() AND type = 'level_set'
    ORDER BY seq DESC LIMIT 1),
  'NULL|NULL', 'anon 이 헤더로 보낸 기기 이름은 actor 없는 이벤트에 남지 않는다');
SELECT set_config('request.headers', '', true);

-- ─── (26) 플레이어뷰 폴링(anon)도 전환을 일으킨다 ───
SELECT ops_test_set_user(pg_temp.owner());
DO $$
BEGIN
  PERFORM set_config('ops.view',
    public.ops_issue_player_credentials((current_setting('ops.participant_id'))::uuid, pg_temp.owner())
      ->> 'viewToken', true);
END $$;
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 615);
SELECT set_config('role', 'anon', true);
SELECT is(
  (public.ops_get_player_view(current_setting('ops.view')) #>> '{clock,currentLevelSort}')::int,
  2, 'anon 플레이어뷰도 끝난 레벨을 따라잡아 레벨 2 를 돌려준다');

-- ─── (27~28) 종료된 대회는 넘기지 않는다(종료 뒤에도 시계는 가동 중인 채 남는다) ───
SELECT set_config('role', 'postgres', true);
UPDATE public.ops_tournaments SET status = 'completed' WHERE id = pg_temp.tid();
SELECT pg_temp.rewind(1, 900);
SELECT is(public.fn_ops_clock_roll_forward(pg_temp.tid()), 0, '종료된 대회는 시간이 지나도 넘어가지 않는다');
SELECT is(pg_temp.sort(), 1, '종료된 대회의 현재 레벨 그대로');
UPDATE public.ops_tournaments SET status = 'active' WHERE id = pg_temp.tid();

-- ─── (29~31) 음수 보정은 현재 레벨 밖으로 나가지 못한다 — 잔여 0 까지만, 다음 레벨은 처음부터 ───
SELECT pg_temp.rewind(1, 100);
SELECT ops_test_set_user(pg_temp.owner());
SELECT public.ops_clock_adjust(pg_temp.tid(), pg_temp.owner(), -10000);
SELECT is(pg_temp.sort() || '|' || pg_temp.elapsed(), '1|600',
  '큰 음수 보정 → 레벨 1 잔여 0(경과 600)에서 멈춘다 — 여러 레벨을 건너뛰지 않는다');
SELECT is((public.ops_clock_sync(pg_temp.tid(), pg_temp.owner())->>'advanced')::int, 1,
  '그 뒤 따라잡기는 정확히 1단계');
SELECT is(pg_temp.sort() || '|' || pg_temp.elapsed(), '2|0', '레벨 2 는 처음부터 시작한다');

-- ─── (32) 끝난 레벨 위의 보정은 먼저 넘긴 뒤 새 레벨에 적용된다 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 610);
SELECT ops_test_set_user(pg_temp.owner());
SELECT public.ops_clock_adjust(pg_temp.tid(), pg_temp.owner(), 60);
SELECT is(pg_temp.sort() || '|' || pg_temp.elapsed(), '2|-50',
  '레벨 1 이 10초 전에 끝난 상태에서 +60초 → 레벨 2 로 넘어간 뒤 잔여가 60초 늘어난다');

-- ─── (33~34) 끝난 레벨 위의 일시정지도 먼저 넘긴다 — 잔여 0 으로 굳지 않는다 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 650);
SELECT ops_test_set_user(pg_temp.owner());
SELECT public.ops_clock_pause(pg_temp.tid(), pg_temp.owner());
SELECT is(pg_temp.sort(), 2, '일시정지 전에 레벨 2 로 넘어간다');
SELECT is(
  (SELECT paused_remaining_sec FROM public.ops_clock WHERE tournament_id = pg_temp.tid()),
  550, '레벨 2 의 잔여(600 − 초과 50)로 멈춘다');

SELECT * FROM finish();
ROLLBACK;
