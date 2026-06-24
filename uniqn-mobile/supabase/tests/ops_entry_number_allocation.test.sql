-- entry_number 할당: 순차 monotonic gap-free + UNIQUE(tournament_id, entry_number) 충돌 거부.
-- 주의(D4): pgTAP 는 단일 트랜잭션 → 실제 동시성(FOR UPDATE 직렬화)은 코드리뷰 대상.
--           여기선 (a) 순차 할당이 단조 증가 + 무결손, (b) 중복 entry# 거부(23505) 를 검증.
BEGIN;
SELECT plan(3);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- 시드가 entry 1 점유 + next_entry_seq=1 → 다음 할당 2, 3.
SELECT is(
  (public.ops_register_participant((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, 'A', NULL, NULL, NULL) ->> 'entry_number')::int,
  2, 'first allocation -> entry_number 2');
SELECT is(
  (public.ops_register_participant((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, 'B', NULL, NULL, NULL) ->> 'entry_number')::int,
  3, 'second allocation -> entry_number 3 (monotonic gap-free)');

-- 중복 (tournament_id, entry_number) 직접 INSERT → 23505 (RLS 우회 위해 postgres 로 원복).
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
SELECT throws_ok(
  $$ INSERT INTO public.ops_participants (tournament_id, entry_number, name, status, chips)
     VALUES ((current_setting('ops.tournament_id'))::uuid, 2, 'dup', 'active', 0) $$,
  '23505', NULL, 'duplicate (tournament_id, entry_number) rejected by UNIQUE');

SELECT * FROM finish();
ROLLBACK;
