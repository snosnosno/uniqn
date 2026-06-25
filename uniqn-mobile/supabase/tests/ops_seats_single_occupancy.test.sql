-- 좌석 단일점유: 한 참가자는 대회내 최대 1좌석 (partial UNIQUE + ops_assign_seat 명시검증).
-- assign 성공 후 (a) 같은 참가자 두번째 좌석 거부, (b) 점유 좌석 재배정 거부.
BEGIN;
SELECT plan(3);

DO $$ DECLARE s RECORD; BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id', s.owner_id::text, true);
  PERFORM set_config('ops.p',  s.participant_id::text, true);
  PERFORM set_config('ops.s1', s.seat1_id::text, true);
  PERFORM set_config('ops.s2', s.seat2_id::text, true);
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- 첫 배정 성공
SELECT lives_ok($$ SELECT public.ops_assign_seat(
  (current_setting('ops.s1'))::uuid, (current_setting('ops.p'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'assign seat 1 succeeds');

-- 같은 참가자 두번째 좌석 → PARTICIPANT_ALREADY_SEATED (P0001)
SELECT throws_ok($$ SELECT public.ops_assign_seat(
  (current_setting('ops.s2'))::uuid, (current_setting('ops.p'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'same participant cannot take a second seat');

-- 점유 좌석에 재배정(시드 참가자 1명뿐이라 self 재시도로 대체) → SEAT_TAKEN (P0001)
SELECT throws_ok($$ SELECT public.ops_assign_seat(
  (current_setting('ops.s1'))::uuid, (current_setting('ops.p'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'occupied seat rejects assign');

SELECT * FROM finish();
ROLLBACK;
