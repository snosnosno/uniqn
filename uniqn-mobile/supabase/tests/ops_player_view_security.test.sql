-- ops claim 토큰 분리: 하이재킹 차단(view_token 단독 claim 불가) + NULL fail-closed + 오라클 회피 + PII 차단.
BEGIN;
SELECT plan(39);

-- ── 설정: 참가자 A(PII 부여) + 참가자 B(cross-token) ──
DO $$
DECLARE s RECORD; v_b uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',       s.owner_id::text,       true);
  PERFORM set_config('ops.member_id',      s.member_id::text,      true);
  PERFORM set_config('ops.outsider_id',    s.outsider_id::text,    true);
  PERFORM set_config('ops.tournament_id',  s.tournament_id::text,  true);
  PERFORM set_config('ops.participant_id', s.participant_id::text, true);
  UPDATE public.ops_participants SET phone='010-1111-1111', nationality='KR', note='PII_NOTE_SECRET'
    WHERE id = s.participant_id;
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips, phone, nationality)
    VALUES (v_b, s.tournament_id, 2, 'Player B', 'active', 50000, '010-2222-2222', 'US');
  PERFORM set_config('ops.pb_id', v_b::text, true);
END $$;

-- ── (1~7) 권한 격리 ──
SELECT ok(has_function_privilege('anon','public.ops_get_player_view(text)','EXECUTE'),
  'anon CAN player_view (공개)');
SELECT ok(NOT has_function_privilege('anon','public.ops_issue_player_credentials(uuid,uuid)','EXECUTE'),
  'anon CANNOT issue_player_credentials');
SELECT ok(NOT has_function_privilege('anon','public.ops_claim_participant(text,text,uuid)','EXECUTE'),
  'anon CANNOT claim_participant');
SELECT ok(has_function_privilege('authenticated','public.ops_get_player_view(text)','EXECUTE'),
  'authenticated CAN player_view');
SELECT ok(has_function_privilege('authenticated','public.ops_issue_player_credentials(uuid,uuid)','EXECUTE'),
  'authenticated CAN issue');
SELECT ok(has_function_privilege('authenticated','public.ops_claim_participant(text,text,uuid)','EXECUTE'),
  'authenticated CAN claim');
-- 구 시그니처 제거 확인(오버로딩 우회 차단)
SELECT ok(to_regprocedure('public.ops_claim_participant(text,uuid)') IS NULL,
  '구 2-인자 claim 시그니처 제거됨');
SELECT ok(NOT has_function_privilege('anon','public.ops_unclaim_participant(uuid,uuid)','EXECUTE'),
  'anon CANNOT unclaim');

-- ── (9~11) issue (운영자) — view_token + PIN 발급/로테이트 ──
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.ops_issue_player_credentials((current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.viewA', r->>'viewToken', true);
  PERFORM set_config('ops.pinA',  r->>'claimPin',  true);
  r := public.ops_issue_player_credentials((current_setting('ops.pb_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.viewB', r->>'viewToken', true);
  PERFORM set_config('ops.pinB',  r->>'claimPin',  true);
END $$;
SELECT is(char_length(current_setting('ops.viewA')), 48, 'viewToken = 48자 hex');
SELECT matches(current_setting('ops.pinA'), '^[0-9A-HJKMNP-TV-Z]{8}$', 'claimPin = 8자 base32');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_issue_player_credentials((current_setting('ops.participant_id'))::uuid, (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'issue: 비멤버 거부');

-- ── (11~19) player_view (anon) — 본인 + cross-token + PII/token 차단 ──
SELECT set_config('role','anon', true);
SELECT is((public.ops_get_player_view(current_setting('ops.viewA')) -> 'me' ->> 'name'), 'Seed Player',
  'player_view(viewA): 본인 이름');
SELECT is((public.ops_get_player_view(current_setting('ops.viewB')) -> 'me' ->> 'name'), 'Player B',
  'player_view(viewB): 본인 이름');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%Player B%',
  'cross-token: viewA에 타참가자 이름 없음');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%010-1111-1111%',
  'PII 차단: 본인 phone 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%nationality%',
  'PII 차단: nationality 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%' || current_setting('ops.viewA') || '%',
  'token 차단: view_token 에코 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%claim_pin%'
       AND public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%' || current_setting('ops.pinA') || '%',
  'token 차단: claim_pin/PIN 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%playerUserId%'
       AND public.ops_get_player_view(current_setting('ops.viewA'))::text NOT LIKE '%PII_NOTE_SECRET%',
  'PII 차단: player_user_id/note 미반환');
SELECT throws_ok($$ SELECT public.ops_get_player_view(NULL) $$, 'P0001', NULL, 'player_view: NULL 거부');

-- ── (19b~19c) 1f: me.knockouts 노출(기본 0) + 비-바운티 bountyAccrued null ──
-- (신필드는 int/null — phone/nationality/note/player_user_id/claim_pin 화이트리스트 부재 단언 무영향)
SELECT is((public.ops_get_player_view(current_setting('ops.viewA')) -> 'me' ->> 'knockouts')::int, 0,
  '1f: me.knockouts=0');
SELECT ok((public.ops_get_player_view(current_setting('ops.viewA')) -> 'me' -> 'bountyAccrued') = 'null'::jsonb,
  '1f: 비-바운티 bountyAccrued null');

-- (19d) 1f 후속: bounty>0 & KO>0 곱셈분기 커버(기존 null분기만 → 곱셈분기 추가). net-zero(단언 후 원복).
SELECT set_config('role','postgres', true);
UPDATE public.ops_tournaments  SET bounty_cost = 10000 WHERE id = (current_setting('ops.tournament_id'))::uuid;
UPDATE public.ops_participants SET knockouts   = 3     WHERE id = (current_setting('ops.participant_id'))::uuid;
SELECT set_config('role','anon', true);
SELECT is((public.ops_get_player_view(current_setting('ops.viewA')) -> 'me' ->> 'bountyAccrued')::bigint, 30000::bigint,
  '1f 후속: bountyAccrued = knockouts(3) × bounty_cost(10000) = 30000 (곱셈분기 커버)');
SELECT set_config('role','postgres', true);
UPDATE public.ops_tournaments  SET bounty_cost = NULL WHERE id = (current_setting('ops.tournament_id'))::uuid;
UPDATE public.ops_participants SET knockouts   = 0    WHERE id = (current_setting('ops.participant_id'))::uuid;
SELECT set_config('role','anon', true);

-- ── (20~24) claim 하이재킹 차단 + NULL fail-closed (핵심 회귀) ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
-- view_token만 보유 + 오답 PIN → 거부, 바인딩 안됨
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), '00000000', (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: 오답 PIN 거부(하이재킹 차단)');
-- NULL PIN fail-closed
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), NULL, (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: NULL PIN 거부(fail-closed)');
-- 빈문자/공백/7자
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), '       ', (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: 공백 PIN 거부');
-- 위 시도들 후에도 player_user_id NULL 유지(바인딩 안됨)
SELECT set_config('role','postgres', true);
SELECT is((SELECT player_user_id FROM public.ops_participants WHERE id=(current_setting('ops.participant_id'))::uuid),
  NULL, '오답/NULL claim 후 바인딩 안됨(player_user_id NULL)');
-- 오라클 회피: 미발급(pin_hash NULL) 참가자 B는 issue됨 → 미발급 케이스 별도 생성
DO $$
DECLARE v_c uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips, view_token)
    VALUES (v_c, (current_setting('ops.tournament_id'))::uuid, 3, 'Player C', 'active', 1000,
            encode(gen_random_bytes(24),'hex'));  -- view_token 있으나 claim_pin_hash NULL
  PERFORM set_config('ops.viewC', (SELECT view_token FROM public.ops_participants WHERE id=v_c), true);
END $$;
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewC'), '00000000', (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'claim: 미발급(pin_hash NULL)도 PIN_INVALID(오라클 회피)');

-- ── (25~29) 정상 claim + 멱등 + already_claimed + auth.uid ──
SELECT is(
  (public.ops_claim_participant(current_setting('ops.viewA'), current_setting('ops.pinA'), (current_setting('ops.outsider_id'))::uuid) ->> 'claimed'),
  'true', 'claim: 올바른 PIN으로 바인딩 성공');
SELECT set_config('role','postgres', true);
SELECT is((SELECT player_user_id FROM public.ops_participants WHERE id=(current_setting('ops.participant_id'))::uuid),
  (current_setting('ops.outsider_id'))::uuid, 'claim: player_user_id 바인딩 영속');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT is(
  (public.ops_claim_participant(current_setting('ops.viewA'), current_setting('ops.pinA'), (current_setting('ops.outsider_id'))::uuid) ->> 'noop'),
  'true', 'claim: 본인 재호출 멱등(noop)');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewA'), current_setting('ops.pinA'), (current_setting('ops.member_id'))::uuid) $$,
  '%OPS_CLAIM_ALREADY_CLAIMED%', 'claim: 타계정 바인딩된 참가자 재클레임 거부');
SELECT throws_ok(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewB'), current_setting('ops.pinB'), (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'claim: auth.uid≠user_id 거부');

-- ── (30~31) 재발급(rotate) — 구 PIN 무효 + unclaim 후 재클레임 ──
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.ops_issue_player_credentials((current_setting('ops.pb_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.pinB2', r->>'claimPin', true);
END $$;
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.viewB'), current_setting('ops.pinB'), (current_setting('ops.outsider_id'))::uuid) $$,
  '%OPS_CLAIM_PIN_INVALID%', 'rotate: 재발급 후 구 PIN 무효');
SELECT is(
  (public.ops_claim_participant(current_setting('ops.viewB'), current_setting('ops.pinB2'), (current_setting('ops.outsider_id'))::uuid) ->> 'claimed'),
  'true', 'rotate: 새 PIN으로 claim 성공');

-- ── (32~35) unclaim 복구 경로 ──
-- A 는 앞 테스트(26~30)에서 outsider_id 에 바인딩된 상태
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_unclaim_participant((current_setting('ops.participant_id'))::uuid, (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'unclaim: 비멤버 거부(outsider 는 운영자 아님)');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(
  (public.ops_unclaim_participant((current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid) ->> 'unclaimed'),
  'true', 'unclaim: owner 복구 성공');
SELECT set_config('role','postgres', true);
SELECT is(
  (SELECT player_user_id FROM public.ops_participants WHERE id=(current_setting('ops.participant_id'))::uuid),
  NULL, 'unclaim 후 player_user_id NULL 확인');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT is(
  (public.ops_claim_participant(current_setting('ops.viewA'), current_setting('ops.pinA'), (current_setting('ops.member_id'))::uuid) ->> 'claimed'),
  'true', 'unclaim 후 member 재클레임 성공');

SELECT * FROM finish();
ROLLBACK;
