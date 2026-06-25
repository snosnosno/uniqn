-- redraw 대기채움(ops_redraw_waitlist_fill) — 좌석별 expected-value TOCTOU + Task2 보안 가드.
--  base : (1) stale expected -> SEAT_VERSION_CONFLICT, (2) matching null -> moved=1.
--  하드닝: (3) 잠긴 테이블 -> TABLE_NOT_OPEN, (4) 타대회 참가자 -> PARTICIPANT_NOT_FOUND,
--          (5) 탈락(busted) 참가자 -> PARTICIPANT_NOT_ACTIVE.  (전부 ERRCODE P0001)
-- 상호간섭 방지: (2) 성공이 s1 을 점유하므로 직후 free 로 비우고 하드닝 진행.
BEGIN;
SELECT plan(5);

DO $$ DECLARE s RECORD; BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text,      true);
  PERFORM set_config('ops.t',        s.tournament_id::text, true);
  PERFORM set_config('ops.p',        s.participant_id::text, true);
  PERFORM set_config('ops.s1',       s.seat1_id::text,      true);
  PERFORM set_config('ops.tbl',      s.table_id::text,      true);
  PERFORM set_config('ops.jp',       s.job_posting_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- 1) stale expected(빈좌석인데 비-NULL 기대) → SEAT_VERSION_CONFLICT
SELECT throws_ok(format($$ SELECT public.ops_redraw_waitlist_fill(%L::uuid, %L::uuid,
  jsonb_build_array(jsonb_build_object('seat_id', %L, 'participant_id', %L, 'expected', %L))) $$,
  current_setting('ops.t'), current_setting('ops.owner_id'),
  current_setting('ops.s1'), current_setting('ops.p'), gen_random_uuid()::text),
  'P0001', NULL, 'stale expected -> SEAT_VERSION_CONFLICT');

-- 2) expected=null(현재 빈좌석과 일치) → 성공, moved=1 (이후 s1 = 시드 참가자)
SELECT is((public.ops_redraw_waitlist_fill(
  (current_setting('ops.t'))::uuid, (current_setting('ops.owner_id'))::uuid,
  jsonb_build_array(jsonb_build_object('seat_id', current_setting('ops.s1'),
    'participant_id', current_setting('ops.p'), 'expected', NULL))) ->> 'moved')::int,
  1, 'matching expected (null) fills 1 seat');

-- s1 다시 비움(하드닝 케이스는 빈 s1 + expected=null 전제).
SELECT public.ops_free_seat((current_setting('ops.s1'))::uuid, (current_setting('ops.owner_id'))::uuid);

-- 3) 잠긴 테이블에 채우기 시도 → TABLE_NOT_OPEN
SELECT public.ops_set_table_lock(
  (current_setting('ops.tbl'))::uuid, (current_setting('ops.owner_id'))::uuid, 'locked');
SELECT throws_like($$ SELECT public.ops_redraw_waitlist_fill(
  (current_setting('ops.t'))::uuid, (current_setting('ops.owner_id'))::uuid,
  jsonb_build_array(jsonb_build_object('seat_id', current_setting('ops.s1'),
    'participant_id', current_setting('ops.p'), 'expected', NULL))) $$,
  '%TABLE_NOT_OPEN%', 'locked table rejects redraw fill (TABLE_NOT_OPEN)');
SELECT public.ops_set_table_lock(
  (current_setting('ops.tbl'))::uuid, (current_setting('ops.owner_id'))::uuid, 'none');

-- 4) 타대회 참가자(cross-tenant) → PARTICIPANT_NOT_FOUND
DO $$
DECLARE v_t2 uuid := gen_random_uuid(); v_p2 uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_tournaments (id, owner_id, job_posting_id, name, game_type, starting_chips,
    registration_open, next_entry_seq, rebuy_chips, addon_chips, buy_in_cost)
  VALUES (v_t2, (current_setting('ops.owner_id'))::uuid, (current_setting('ops.jp'))::uuid,
    'ops cross cup', 'NLH', 30000, true, 1, 30000, 20000, 50000);
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p2, v_t2, 1, 'Foreign Player', 'active', 30000);
  PERFORM set_config('ops.p2', v_p2::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like($$ SELECT public.ops_redraw_waitlist_fill(
  (current_setting('ops.t'))::uuid, (current_setting('ops.owner_id'))::uuid,
  jsonb_build_array(jsonb_build_object('seat_id', current_setting('ops.s1'),
    'participant_id', current_setting('ops.p2'), 'expected', NULL))) $$,
  '%PARTICIPANT_NOT_FOUND%', 'cross-tenant participant rejected (PARTICIPANT_NOT_FOUND)');

-- 5) 탈락(busted) 참가자 → PARTICIPANT_NOT_ACTIVE
DO $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'busted'
    WHERE id = (current_setting('ops.p'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like($$ SELECT public.ops_redraw_waitlist_fill(
  (current_setting('ops.t'))::uuid, (current_setting('ops.owner_id'))::uuid,
  jsonb_build_array(jsonb_build_object('seat_id', current_setting('ops.s1'),
    'participant_id', current_setting('ops.p'), 'expected', NULL))) $$,
  '%PARTICIPANT_NOT_ACTIVE%', 'busted participant rejected (PARTICIPANT_NOT_ACTIVE)');

SELECT * FROM finish();
ROLLBACK;
