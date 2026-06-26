-- 좌석 이동(ops_move_seat) + 비우기(ops_free_seat).
-- assign s1 → move s1→s2(s1 빈·s2 점유) → free s2 → free s2 재시도(SEAT_NOT_OCCUPIED).
BEGIN;
SELECT plan(5);

DO $$ DECLARE s RECORD; BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.p',  s.participant_id::text, true);
  PERFORM set_config('ops.s1', s.seat1_id::text, true);
  PERFORM set_config('ops.s2', s.seat2_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- setup: 시드 참가자를 s1 에 배정(이동/비우기의 전제).
SELECT public.ops_assign_seat(
  (current_setting('ops.s1'))::uuid, (current_setting('ops.p'))::uuid, (current_setting('ops.owner_id'))::uuid);

-- 1) 이동 성공
SELECT lives_ok($$ SELECT public.ops_move_seat(
  (current_setting('ops.s1'))::uuid, (current_setting('ops.s2'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'move s1 -> s2 succeeds');

-- 2) s1 빈 좌석
SELECT is(
  (SELECT participant_id FROM public.ops_seats WHERE id = (current_setting('ops.s1'))::uuid),
  NULL::uuid, 's1 is empty after move');

-- 3) s2 가 참가자 점유
SELECT is(
  (SELECT participant_id FROM public.ops_seats WHERE id = (current_setting('ops.s2'))::uuid),
  (current_setting('ops.p'))::uuid, 's2 is occupied by participant after move');

-- 4) 비우기 성공
SELECT lives_ok($$ SELECT public.ops_free_seat(
  (current_setting('ops.s2'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'free s2 succeeds');

-- 5) 이미 빈 좌석 재-비우기 → SEAT_NOT_OCCUPIED (P0001)
SELECT throws_ok($$ SELECT public.ops_free_seat(
  (current_setting('ops.s2'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'free already-empty seat rejected (SEAT_NOT_OCCUPIED)');

SELECT * FROM finish();
ROLLBACK;
