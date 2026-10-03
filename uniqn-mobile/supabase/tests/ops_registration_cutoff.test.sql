-- ops 레이트 등록 자동 마감(마이그 20261004100000): 설정 RPC 권한·검증 · 자동 전환 시 마감 · 수동 전환 시 마감 ·
--   수동으로 다시 열면 설정 해제 · 마감 뒤 등록 거부 · 아무도 시계를 안 따라잡은 상태의 등록 거부 · 구조 축소 시 설정 해제.
BEGIN;
SELECT plan(24);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

CREATE FUNCTION pg_temp.tid() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.tournament_id')::uuid $$;
CREATE FUNCTION pg_temp.owner() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.owner_id')::uuid $$;
CREATE FUNCTION pg_temp.is_open() RETURNS boolean LANGUAGE sql AS
  $$ SELECT registration_open FROM public.ops_tournaments WHERE id = pg_temp.tid() $$;
CREATE FUNCTION pg_temp.cutoff() RETURNS int LANGUAGE sql AS
  $$ SELECT registration_close_after_sort FROM public.ops_tournaments WHERE id = pg_temp.tid() $$;
CREATE FUNCTION pg_temp.rewind(p_sort int, p_sec int) RETURNS void LANGUAGE sql AS
  $$ UPDATE public.ops_clock
        SET current_level_sort = p_sort, is_running = true, paused_remaining_sec = NULL,
            level_started_at = now() - make_interval(secs => p_sec)
      WHERE tournament_id = pg_temp.tid() $$;

-- ─── (1~2) 권한 ───
SELECT ok(NOT has_function_privilege('anon', 'public.ops_set_registration_cutoff(uuid,uuid,integer)', 'EXECUTE'),
  'anon 은 ops_set_registration_cutoff 를 실행할 수 없다');
SELECT ok(has_function_privilege('authenticated', 'public.ops_set_registration_cutoff(uuid,uuid,integer)', 'EXECUTE'),
  'authenticated 는 ops_set_registration_cutoff 를 실행할 수 있다');

-- 3레벨(레벨 1 · 브레이크 · 레벨 2), 각 600초
SELECT ops_test_set_user(pg_temp.owner());
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":1,"big_blind":0,"duration_sec":600,"is_break":true},
    {"level":2,"big_blind":400,"duration_sec":600}]'::jsonb);
SELECT public.ops_clock_start(pg_temp.tid(), pg_temp.owner());

-- ─── (3~6) 설정: 저장 · 이벤트 · 없는 레벨 거부 · 비멤버 거부 ───
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 2);
SELECT is(pg_temp.cutoff(), 2, '브레이크(sort 2) 종료 시 마감으로 설정');
SELECT is(
  (SELECT payload->>'action' || '|' || (payload->>'after_sort')
     FROM public.ops_events WHERE tournament_id = pg_temp.tid() AND type = 'registration_toggled'
    ORDER BY seq DESC LIMIT 1),
  'cutoff_set|2', '설정 이벤트 기록');
SELECT throws_ok(
  $$ SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 99) $$,
  'P0001', NULL, '없는 레벨(sort=99)은 거부');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_set_registration_cutoff(pg_temp.tid(), (current_setting('ops.outsider_id'))::uuid, 1) $$,
  'P0001', NULL, '대회 멤버가 아니면 설정 거부');

-- ─── (7~8) 레벨 1 → 브레이크: 아직 기준(2)을 넘지 않았다 → 열려 있음 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 610);
SELECT ops_test_set_user(pg_temp.owner());
SELECT public.ops_clock_sync(pg_temp.tid(), pg_temp.owner());
SELECT is((SELECT current_level_sort FROM public.ops_clock WHERE tournament_id = pg_temp.tid()), 2,
  '브레이크로 자동 전환');
SELECT is(pg_temp.is_open(), true, '기준 레벨이 끝나기 전에는 등록이 열려 있다');

-- ─── (9~12) 브레이크 종료 → 레벨 2 로 자동 전환되는 순간 마감 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(2, 605);
SELECT ops_test_set_user(pg_temp.owner());
SELECT public.ops_clock_sync(pg_temp.tid(), pg_temp.owner());
SELECT is(pg_temp.is_open(), false, '브레이크가 끝나 넘어가면 등록이 자동으로 닫힌다');
SELECT is(pg_temp.cutoff(), 2, '자동 마감 뒤에도 설정값은 남는다(화면이 "자동 마감됨"을 보여 준다)');
SELECT is(
  (SELECT (payload->>'open') || '|' || (payload->>'auto') || '|' || (payload->>'after_sort') || '|' || COALESCE(actor_id::text, 'NULL')
     FROM public.ops_events WHERE tournament_id = pg_temp.tid() AND type = 'registration_toggled'
    ORDER BY seq DESC LIMIT 1),
  'false|true|2|NULL', '자동 마감 이벤트 — auto=true, actor 없음');
SELECT throws_ok(
  $$ SELECT public.ops_register_participant(pg_temp.tid(), pg_temp.owner(), '늦은사람', NULL, NULL, NULL) $$,
  'P0001', NULL, '자동 마감 뒤 등록은 REGISTRATION_CLOSED');

-- ─── (13~15) 수동으로 다시 열면 자동 설정 해제 → 이후 전환에도 다시 닫히지 않는다 ───
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true);
SELECT is(pg_temp.is_open(), true, '수동으로 다시 열림');
SELECT is(pg_temp.cutoff(), NULL, '수동으로 열면 자동 마감 설정이 해제된다');
SELECT is(
  (SELECT (payload->>'cutoff_cleared')
     FROM public.ops_events WHERE tournament_id = pg_temp.tid() AND type = 'registration_toggled'
    ORDER BY seq DESC LIMIT 1),
  'true', '다시 연 이벤트에 설정 해제가 남는다');

-- ─── (16) 이미 지난 레벨은 기준으로 잡을 수 없다 ───
SELECT throws_ok(
  $$ SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 1) $$,
  'P0001', NULL, '현재 레벨 3 에서 sort 1 은 이미 지난 레벨 — 거부');

-- ─── (17~19) 수동으로 넘겨도 마감된다 ───
SELECT public.ops_clock_set_level(pg_temp.tid(), pg_temp.owner(), 1);
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 1);
SELECT is(pg_temp.is_open(), true, '설정 직후에는 열려 있다');
SELECT public.ops_clock_set_level(pg_temp.tid(), pg_temp.owner(), 2);
SELECT is(pg_temp.is_open(), false, '운영자가 "다음"으로 넘겨도 기준을 넘으면 닫힌다');
SELECT is(
  (SELECT (payload->>'auto') || '|' || (actor_id = pg_temp.owner())::text
     FROM public.ops_events WHERE tournament_id = pg_temp.tid() AND type = 'registration_toggled'
    ORDER BY seq DESC LIMIT 1),
  'true|true', '수동 전환으로 닫힌 이벤트는 넘긴 사람이 actor');

-- ─── (20~21) 수동 마감은 설정을 건드리지 않는다 ───
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true);   -- 설정 해제
SELECT public.ops_clock_set_level(pg_temp.tid(), pg_temp.owner(), 1);
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 2);
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), false);
SELECT is(pg_temp.is_open(), false, '수동 마감');
SELECT is(pg_temp.cutoff(), 2, '수동으로 닫을 때는 자동 설정을 지우지 않는다');

-- ─── (22) 아무 화면도 시계를 따라잡지 않았어도, 기준 레벨이 끝난 뒤의 등록은 거부된다 ───
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true);   -- 설정 해제 + 열림
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 1);
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 700);
SELECT ops_test_set_user(pg_temp.owner());
SELECT throws_ok(
  $$ SELECT public.ops_register_participant(pg_temp.tid(), pg_temp.owner(), '늦은사람2', NULL, NULL, NULL) $$,
  'P0001', NULL, '시계를 아무도 안 따라잡았어도 등록 RPC 가 스스로 따라잡아 거부한다');

-- ─── (23~24) 블라인드 구조를 줄여 기준 순번이 사라지면 설정을 지운다 / 남아 있으면 유지 ───
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 3);
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":3,"big_blind":600,"duration_sec":600},
    {"level":4,"big_blind":800,"duration_sec":600}]'::jsonb);
SELECT is(pg_temp.cutoff(), 3, '기준 순번이 구조 안에 남아 있으면 설정 유지');
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600}]'::jsonb);
SELECT is(pg_temp.cutoff(), NULL, '구조를 2레벨로 줄이면 sort 3 기준은 해제된다');

SELECT * FROM finish();
ROLLBACK;
