-- ops 레이트 등록 자동 마감(마이그 20261004100000): 설정 RPC 권한·검증 · 자동 전환 시 마감 · 수동 전환 시 마감 ·
--   수동으로 다시 열면 설정 해제 · 마감 뒤 등록 거부 · 아무도 시계를 안 따라잡은 상태의 등록 거부 · 구조 축소 시 설정 해제.
-- 마이그 20261010100000: 행에 prev_sort 를 실으면 기준이 순번이 아니라 그 레벨을 따라간다(28~33) ·
--   해제를 반환값으로 알린다 · 옮겨진 기준이 마지막 순번이면 해제 · 시계가 옮겨진 기준을 이미 넘어 있으면 즉시 마감(34~38).
BEGIN;
SELECT plan(38);

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
SELECT throws_like(
  $$ SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 99) $$,
  'OPS_INVALID_LEVEL%', '없는 레벨(sort=99)은 거부');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_set_registration_cutoff(pg_temp.tid(), (current_setting('ops.outsider_id'))::uuid, 1) $$,
  'PERMISSION_DENIED%', '대회 멤버가 아니면 설정 거부');

-- ─── (7~8) 레벨 1 → 브레이크: 아직 기준(2)을 넘지 않았다 → 열려 있음 ───
SELECT set_config('role', 'postgres', true);
SELECT pg_temp.rewind(1, 610);
SELECT ops_test_set_user(pg_temp.owner());
-- 이미 열려 있는데 "열기"가 또 온 것(연타·다른 기기의 중복 요청)은 설정을 지우지 않는다.
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true);
SELECT is(pg_temp.cutoff(), 2, '열린 상태에서 다시 열기 → 자동 마감 설정 유지');
SELECT throws_like(
  $$ SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 3) $$,
  'OPS_INVALID_LEVEL%', '마지막 레벨(sort 3)은 기준이 될 수 없다 — 넘어갈 곳이 없어 발동하지 않는다');
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
SELECT throws_like(
  $$ SELECT public.ops_register_participant(pg_temp.tid(), pg_temp.owner(), '늦은사람', NULL, NULL, NULL) $$,
  'REGISTRATION_CLOSED%', '자동 마감 뒤 등록은 REGISTRATION_CLOSED');

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
SELECT throws_like(
  $$ SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 1) $$,
  'OPS_INVALID_LEVEL%', '현재 레벨 3 에서 sort 1 은 이미 지난 레벨 — 거부');

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
SELECT throws_like(
  $$ SELECT public.ops_register_participant(pg_temp.tid(), pg_temp.owner(), '늦은사람2', NULL, NULL, NULL) $$,
  'REGISTRATION_CLOSED%', '시계를 아무도 안 따라잡았어도 등록 RPC 가 스스로 따라잡아 거부한다');

-- ─── (25~27) 블라인드 구조가 바뀌어 기준 순번이 사라지거나 마지막이 되면 설정을 지운다 / 중간에 남으면 유지 ───
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":3,"big_blind":600,"duration_sec":600},
    {"level":4,"big_blind":800,"duration_sec":600}]'::jsonb);
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 3);
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":3,"big_blind":600,"duration_sec":600},
    {"level":4,"big_blind":800,"duration_sec":600},
    {"level":5,"big_blind":1000,"duration_sec":600}]'::jsonb);
SELECT is(pg_temp.cutoff(), 3, '기준 순번이 구조 중간에 남아 있으면 설정 유지');
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":3,"big_blind":600,"duration_sec":600}]'::jsonb);
SELECT is(pg_temp.cutoff(), NULL, '구조를 3레벨로 줄여 기준(sort 3)이 마지막이 되면 해제된다');
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 2);
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600}]'::jsonb);
SELECT is(pg_temp.cutoff(), NULL, '구조를 1레벨로 줄여 기준 순번이 사라져도 해제된다');

-- ─── (28~33) prev_sort 따라가기(마이그 20261010100000) — 기준은 순번이 아니라 "그 레벨"이다 ───
-- [L1, L2, 휴식, L3, L4] · 기준 = 휴식(sort 3)
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":2,"big_blind":0,"duration_sec":600,"is_break":true},
    {"level":3,"big_blind":600,"duration_sec":600},
    {"level":4,"big_blind":800,"duration_sec":600}]'::jsonb);
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 3);
-- 앞의 L1 을 지운다 → 휴식은 sort 2 가 된다. 기준도 2 로 따라와야 한다(순번 유지였다면 L3 을 가리킨다).
SELECT is(
  (public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
    '[{"level":2,"big_blind":400,"duration_sec":600,"prev_sort":2},
      {"level":2,"big_blind":0,"duration_sec":600,"is_break":true,"prev_sort":3},
      {"level":3,"big_blind":600,"duration_sec":600,"prev_sort":4},
      {"level":4,"big_blind":800,"duration_sec":600,"prev_sort":5}]'::jsonb)->>'cutoff_sort')::int,
  2, '앞 레벨을 지우면 반환 cutoff_sort 가 기준 레벨의 새 순번');
SELECT is(pg_temp.cutoff(), 2, '기준이 그 레벨(휴식)을 따라 sort 3 → 2 로 옮겨진다');
SELECT is(
  (SELECT is_break FROM public.ops_blind_levels WHERE tournament_id = pg_temp.tid() AND sort = pg_temp.cutoff()),
  true, '옮겨진 기준 순번이 여전히 휴식을 가리킨다');
-- 기준 앞에 새 레벨을 끼운다(prev_sort null) → 휴식은 sort 3 으로 밀린다.
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600,"prev_sort":null},
    {"level":2,"big_blind":400,"duration_sec":600,"prev_sort":1},
    {"level":2,"big_blind":0,"duration_sec":600,"is_break":true,"prev_sort":2},
    {"level":3,"big_blind":600,"duration_sec":600,"prev_sort":3},
    {"level":4,"big_blind":800,"duration_sec":600,"prev_sort":4}]'::jsonb);
SELECT is(pg_temp.cutoff(), 3, '기준 앞에 레벨을 끼우면 기준이 sort 2 → 3 으로 따라간다');
-- 기준이던 레벨 자체를 지운다 → 설정 해제(다른 레벨로 조용히 넘어가지 않는다).
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600,"prev_sort":1},
    {"level":2,"big_blind":400,"duration_sec":600,"prev_sort":2},
    {"level":3,"big_blind":600,"duration_sec":600,"prev_sort":4},
    {"level":4,"big_blind":800,"duration_sec":600,"prev_sort":5}]'::jsonb);
SELECT is(pg_temp.cutoff(), NULL, '기준이던 레벨을 지우면 자동 마감 설정이 해제된다');
-- 프리셋으로 통째 교체(모든 행 prev_sort null) → 옛 기준은 새 구조에 없다 → 해제.
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 2);
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":100,"duration_sec":900,"prev_sort":null},
    {"level":2,"big_blind":200,"duration_sec":900,"prev_sort":null},
    {"level":3,"big_blind":300,"duration_sec":900,"prev_sort":null}]'::jsonb);
SELECT is(pg_temp.cutoff(), NULL, '프리셋으로 통째 교체하면(전 행 prev_sort null) 설정이 해제된다');

-- ─── (34) 해제는 반환값으로 알린다 — 화면이 운영자에게 경고한다 ───
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 2);
SELECT is(
  (public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
    '[{"level":1,"big_blind":100,"duration_sec":900,"prev_sort":1},
      {"level":3,"big_blind":300,"duration_sec":900,"prev_sort":3},
      {"level":4,"big_blind":400,"duration_sec":900,"prev_sort":null}]'::jsonb)->>'cutoff_cleared')::boolean,
  true, '기준 레벨이 지워져 설정이 해제되면 cutoff_cleared=true');

-- ─── (35) 옮겨진 기준이 마지막 순번이 되면 해제(넘어갈 곳이 없다) ───
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 2);
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":100,"duration_sec":900,"prev_sort":1},
    {"level":3,"big_blind":300,"duration_sec":900,"prev_sort":2}]'::jsonb);
SELECT is(pg_temp.cutoff(), NULL, '기준 뒤의 레벨을 다 지워 기준이 마지막 순번이 되면 해제된다');

-- ─── (36~38) 시계가 옮겨진 기준을 이미 넘어 있으면 그 자리에서 마감 ───
-- [L1, L2, 휴식, L3, L4] · 기준 = 휴식(3) · 시계도 휴식(3). L1 을 지우면 기준은 2, 시계는 순번 3(=L3) — 휴식은 지나갔다.
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":1,"big_blind":200,"duration_sec":600},
    {"level":2,"big_blind":400,"duration_sec":600},
    {"level":2,"big_blind":0,"duration_sec":600,"is_break":true},
    {"level":3,"big_blind":600,"duration_sec":600},
    {"level":4,"big_blind":800,"duration_sec":600}]'::jsonb);
SELECT public.ops_clock_set_level(pg_temp.tid(), pg_temp.owner(), 3);
-- 등록은 (24)에서 자동 마감된 채다 — 다시 연 뒤(설정 해제됨) 기준을 건다.
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true);
SELECT public.ops_set_registration_cutoff(pg_temp.tid(), pg_temp.owner(), 3);
SELECT is(pg_temp.is_open(), true, '전제: 기준 레벨(휴식) 진행 중에는 등록이 열려 있다');
SELECT public.ops_set_blind_levels(pg_temp.tid(), pg_temp.owner(),
  '[{"level":2,"big_blind":400,"duration_sec":600,"prev_sort":2},
    {"level":2,"big_blind":0,"duration_sec":600,"is_break":true,"prev_sort":3},
    {"level":3,"big_blind":600,"duration_sec":600,"prev_sort":4},
    {"level":4,"big_blind":800,"duration_sec":600,"prev_sort":5}]'::jsonb);
SELECT is(
  (SELECT current_level_sort FROM public.ops_clock WHERE tournament_id = pg_temp.tid()) || '|' || pg_temp.cutoff(),
  '3|2', '시계는 순번 3 에 남고(이제 L3) 기준은 휴식을 따라 2 로 — 시계가 기준을 넘었다');
SELECT is(pg_temp.is_open(), false, '시계가 옮겨진 기준을 이미 넘어 있으면 저장하는 순간 등록을 닫는다');

SELECT * FROM finish();
ROLLBACK;
