-- ops RPC 보안: anon REVOKE / authenticated GRANT / actor 바인딩 / registration_closed.
BEGIN;
SELECT plan(11);

-- EXECUTE 권한: anon 없음, authenticated 있음 (fixture 가 함수 GRANT 안 하므로 마이그 상태 유지).
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_register_participant(uuid,uuid,text,text,text,integer)', 'EXECUTE'),
  'anon cannot EXECUTE ops_register_participant');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_register_participant(uuid,uuid,text,text,text,integer)', 'EXECUTE'),
  'authenticated retains EXECUTE on ops_register_participant');

-- 1f M4: 신규/재생성 변이 RPC 3종도 anon 거부 / authenticated 보유 (마이그 20260704100300).
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_bust_participant(uuid,uuid,uuid)', 'EXECUTE'),
  '1f: anon cannot EXECUTE ops_bust_participant(v2 3인자)');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_bust_participant(uuid,uuid,uuid)', 'EXECUTE'),
  '1f: authenticated retains EXECUTE on ops_bust_participant');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_undo_bust(uuid,uuid)', 'EXECUTE'),
  '1f: anon cannot EXECUTE ops_undo_bust');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_undo_bust(uuid,uuid)', 'EXECUTE'),
  '1f: authenticated retains EXECUTE on ops_undo_bust');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_correct_participant_prize(uuid,uuid,integer,text)', 'EXECUTE'),
  '1f: anon cannot EXECUTE ops_correct_participant_prize');
SELECT ok(
  has_function_privilege('authenticated', 'public.ops_correct_participant_prize(uuid,uuid,integer,text)', 'EXECUTE'),
  '1f: authenticated retains EXECUTE on ops_correct_participant_prize');

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

-- owner 본인 명의 등록: 성공, entry_number 2 (시드가 1 점유 + next_entry_seq=1).
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(
  (public.ops_register_participant(
     (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
     'RPC Player', NULL, NULL, NULL) ->> 'entry_number')::int,
  2, 'owner self-actor registers -> entry_number 2');

-- 위조 actor: member 가 owner 명의로 호출 -> PERMISSION_DENIED (P0001).
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_register_participant(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       'Forged', NULL, NULL, NULL) $$,
  'P0001', NULL, 'forged actor (caller<>p_actor) blocked');

-- 등록 마감 후 등록 시도 -> REGISTRATION_CLOSED (P0001).
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
BEGIN
  PERFORM public.ops_toggle_registration(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, false);
END $$;
SELECT throws_ok(
  $$ SELECT public.ops_register_participant(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       'Closed', NULL, NULL, NULL) $$,
  'P0001', NULL, 'registration closed blocks new entry');

SELECT * FROM finish();
ROLLBACK;
