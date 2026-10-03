-- ops 참가자 일괄 등록(마이그 20261004100100): 권한 · 연속 엔트리 번호 · 이벤트 건수 · 빈 값 정규화 ·
--   한 줄 오류 시 전부 취소(원자성) · 상한 200 · 입력 형식 · 등록 마감 · 비멤버 · actor 위조.
BEGIN;
SELECT plan(21);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
END $$;

CREATE FUNCTION pg_temp.tid() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.tournament_id')::uuid $$;
CREATE FUNCTION pg_temp.owner() RETURNS uuid LANGUAGE sql AS
  $$ SELECT current_setting('ops.owner_id')::uuid $$;
CREATE FUNCTION pg_temp.participants() RETURNS int LANGUAGE sql AS
  $$ SELECT count(*)::int FROM public.ops_participants WHERE tournament_id = pg_temp.tid() $$;

-- ─── (1~2) 권한 ───
SELECT ok(NOT has_function_privilege('anon', 'public.ops_register_participants_bulk(uuid,uuid,jsonb,integer)', 'EXECUTE'),
  'anon 은 일괄 등록을 실행할 수 없다');
SELECT ok(has_function_privilege('authenticated', 'public.ops_register_participants_bulk(uuid,uuid,jsonb,integer)', 'EXECUTE'),
  'authenticated 는 일괄 등록을 실행할 수 있다');

-- ─── (3~8) 정상 등록: 시드 참가자 1명(엔트리 1) 뒤에 3명 ───
SELECT ops_test_set_user(pg_temp.owner());
SELECT is(
  (public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(),
     '[{"name":"  가선수 ","phone":"01011112222","nationality":"KR"},
       {"name":"나선수","phone":"","nationality":""},
       {"name":"다선수"}]'::jsonb, 50000) ->> 'count')::int,
  3, '3명 등록');
SELECT is(pg_temp.participants(), 4, '참가자 = 시드 1 + 3');
SELECT is(
  (SELECT string_agg(entry_number::text || ':' || name, ',' ORDER BY entry_number)
     FROM public.ops_participants WHERE tournament_id = pg_temp.tid() AND entry_number > 1),
  '2:가선수,3:나선수,4:다선수', '엔트리 번호는 입력 순서대로 빈틈 없이, 이름은 앞뒤 공백 제거');
SELECT is(
  (SELECT COALESCE(phone, 'NULL') || '|' || COALESCE(nationality, 'NULL')
     FROM public.ops_participants WHERE tournament_id = pg_temp.tid() AND name = '나선수'),
  'NULL|NULL', '빈 문자열 연락처·국적은 NULL 로 저장');
SELECT is(
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = pg_temp.tid() AND type = 'player_registered'),
  3, '참가자마다 이력 1건(단건 등록과 같은 규칙)');
SELECT is(
  (SELECT buy_in_amount FROM public.ops_participants WHERE tournament_id = pg_temp.tid() AND name = '다선수'),
  50000, '바이인 금액이 전원에게 적용');

-- ─── (9~10) 원자성: 둘째 줄 이름이 비면 첫 줄도 들어가지 않는다 ───
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(),
       '[{"name":"라선수"},{"name":"   "},{"name":"마선수"}]'::jsonb, NULL) $$,
  'OPS_BULK_REGISTER_INVALID%', '빈 이름이 섞이면 거부(OPS_BULK_REGISTER_INVALID)');
SELECT is(pg_temp.participants(), 4, '한 줄이라도 틀리면 전부 취소 — 참가자 수 그대로');
SELECT is(
  (SELECT next_entry_seq FROM public.ops_tournaments WHERE id = pg_temp.tid()),
  4, '실패한 일괄 등록은 엔트리 번호도 소모하지 않는다(다음 번호 = 5)');

-- ─── (11~14) 입력 형식·상한 ───
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(), '[]'::jsonb, NULL) $$,
  'OPS_BULK_REGISTER_INVALID%', '빈 배열 거부');
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(), '{"name":"x"}'::jsonb, NULL) $$,
  'OPS_BULK_REGISTER_INVALID%', '배열이 아니면 거부');
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(),
       (SELECT jsonb_agg(jsonb_build_object('name', 'P' || g)) FROM generate_series(1, 201) g), NULL) $$,
  'OPS_BULK_REGISTER_INVALID%', '201명은 상한(200) 초과로 거부');
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(),
       jsonb_build_array(jsonb_build_object('name', repeat('가', 51))), NULL) $$,
  'OPS_BULK_REGISTER_INVALID%', '51자 이름 거부');

SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(), '[1, "문자열"]'::jsonb, NULL) $$,
  'OPS_BULK_REGISTER_INVALID%', '객체가 아닌 원소는 거부(캐스트 오류가 아니라 P0001)');

-- 정확히 200명은 통과한다(상한 경계)
SELECT is(
  (public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(),
     (SELECT jsonb_agg(jsonb_build_object('name', 'B' || g)) FROM generate_series(1, 200) g), NULL) ->> 'count')::int,
  200, '200명은 한 번에 등록된다');
SELECT is(pg_temp.participants(), 204, '참가자 = 4 + 200');

-- ─── 등록 마감 상태에서는 전부 거부 ───
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), false);
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(),
       '[{"name":"바선수"}]'::jsonb, NULL) $$,
  'REGISTRATION_CLOSED%', '등록 마감이면 REGISTRATION_CLOSED');
SELECT public.ops_toggle_registration(pg_temp.tid(), pg_temp.owner(), true);

-- ─── (16~17) 비멤버 · actor 위조 ───
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), (current_setting('ops.outsider_id'))::uuid,
       '[{"name":"사선수"}]'::jsonb, NULL) $$,
  'PERMISSION_DENIED%', '대회 멤버가 아니면 거부');
SELECT throws_like(
  $$ SELECT public.ops_register_participants_bulk(pg_temp.tid(), pg_temp.owner(),
       '[{"name":"아선수"}]'::jsonb, NULL) $$,
  'PERMISSION_DENIED%', '남의 id 를 actor 로 넣으면 거부');

SELECT * FROM finish();
ROLLBACK;
