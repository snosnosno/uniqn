-- ops 1c-4 플레이어뷰: cross-token 격리 + PII 차단 + claim 1회소비 + 권한(가장 위험 anon 표면).
-- 패턴: ops_monitor_snapshot.test.sql + ops_clock_state.test.sql.
BEGIN;
SELECT plan(32);

-- ── 설정: 시드(참가자 A) + A 에 phone/nationality 부여 + 참가자 B(phone 보유) 생성 ──
DO $$
DECLARE s RECORD; v_b uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',       s.owner_id::text,       true);
  PERFORM set_config('ops.member_id',      s.member_id::text,      true);
  PERFORM set_config('ops.outsider_id',    s.outsider_id::text,    true);
  PERFORM set_config('ops.tournament_id',  s.tournament_id::text,  true);
  PERFORM set_config('ops.participant_id', s.participant_id::text, true);
  -- A 에 PII 부여(차단 단언용), B 생성(cross-token 격리 단언용). A 는 미착석(좌석 NULL 허용).
  UPDATE public.ops_participants SET phone = '010-1111-1111', nationality = 'KR', note = 'PII_NOTE_SECRET'
    WHERE id = s.participant_id;
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips, phone, nationality)
    VALUES (v_b, s.tournament_id, 2, 'Player B', 'active', 50000, '010-2222-2222', 'US');
  PERFORM set_config('ops.pb_id', v_b::text, true);
END $$;

-- ── (1~6) 권한 격리 ──
SELECT ok(has_function_privilege('anon', 'public.ops_get_player_view(text)', 'EXECUTE'),
  'anon CAN player_view (공개)');
SELECT ok(NOT has_function_privilege('anon', 'public.ops_issue_claim_token(uuid,uuid)', 'EXECUTE'),
  'anon CANNOT issue_claim_token (운영자)');
SELECT ok(NOT has_function_privilege('anon', 'public.ops_claim_participant(text,uuid)', 'EXECUTE'),
  'anon CANNOT claim_participant (로그인 필요)');
SELECT ok(has_function_privilege('authenticated', 'public.ops_get_player_view(text)', 'EXECUTE'),
  'authenticated CAN player_view');
SELECT ok(has_function_privilege('authenticated', 'public.ops_issue_claim_token(uuid,uuid)', 'EXECUTE'),
  'authenticated CAN issue_claim_token');
SELECT ok(has_function_privilege('authenticated', 'public.ops_claim_participant(text,uuid)', 'EXECUTE'),
  'authenticated CAN claim_participant');
SELECT ok(NOT has_function_privilege('anon', 'public.ops_unclaim_participant(uuid,uuid)', 'EXECUTE'),
  'anon CANNOT unclaim_participant (운영자)');

-- ── (7~9) issue_claim_token (운영자) ──
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE va text; vb text;
BEGIN
  va := public.ops_issue_claim_token((current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid) ->> 'claimToken';
  vb := public.ops_issue_claim_token((current_setting('ops.pb_id'))::uuid,          (current_setting('ops.owner_id'))::uuid) ->> 'claimToken';
  PERFORM set_config('ops.tokA', va, true);
  PERFORM set_config('ops.tokB', vb, true);
END $$;
SELECT is(char_length(current_setting('ops.tokA')), 48, 'issue 토큰 = 48자 hex');
SELECT is(
  (public.ops_issue_claim_token((current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid) ->> 'claimToken'),
  current_setting('ops.tokA'), 'issue 멱등(기존 토큰 반환)');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_issue_claim_token((current_setting('ops.participant_id'))::uuid, (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'issue: 비멤버(outsider) 거부');

-- ── (10~18) player_view (anon 역할) — 본인 데이터 + cross-token 격리 + PII 차단 ──
SELECT set_config('role', 'anon', true);
SELECT is((public.ops_get_player_view(current_setting('ops.tokA')) -> 'me' ->> 'name'), 'Seed Player',
  'player_view(tokA): 본인 이름');
SELECT is((public.ops_get_player_view(current_setting('ops.tokA')) -> 'me' ->> 'entryNumber')::int, 1,
  'player_view(tokA): 본인 entryNumber');
SELECT is((public.ops_get_player_view(current_setting('ops.tokB')) -> 'me' ->> 'name'), 'Player B',
  'player_view(tokB): 본인 이름');
SELECT ok(public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%Player B%',
  'cross-token 격리: tokA 뷰에 타참가자 이름 없음');
SELECT ok(public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%010-2222-2222%',
  'cross-token 격리: tokA 뷰에 타참가자 phone 없음');
SELECT ok(public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%010-1111-1111%',
  'PII 차단: 본인 phone 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%nationality%',
  'PII 차단: nationality 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%claim%',
  'PII 차단: claim_token 키/값 미반환');
SELECT ok(public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%' || current_setting('ops.tokA') || '%',
  'PII 차단: claim_token 에코 미반환');
SELECT ok(
  public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%playerUserId%'
  AND public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%player_user_id%',
  'PII 차단: player_user_id 미반환(#195 화이트리스트)');
SELECT ok(public.ops_get_player_view(current_setting('ops.tokA'))::text NOT LIKE '%PII_NOTE_SECRET%',
  'PII 차단: note 미반환');

-- ── (19~21) player_view 토큰가드 ──
SELECT throws_ok($$ SELECT public.ops_get_player_view(NULL) $$, 'P0001', NULL, 'player_view: NULL 거부');
SELECT throws_ok($$ SELECT public.ops_get_player_view('short') $$, 'P0001', NULL, 'player_view: 짧은 토큰 거부');
SELECT throws_ok($$ SELECT public.ops_get_player_view(repeat('0', 48)) $$, 'P0001', NULL, 'player_view: 미존재 거부');

-- ── (22~25) claim_participant (authed) ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_claim_participant(current_setting('ops.tokB'), (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, 'claim: 본인 아닌 user_id 거부(auth.uid 불일치)');
SELECT is(
  (public.ops_claim_participant(current_setting('ops.tokA'), (current_setting('ops.outsider_id'))::uuid) ->> 'claimed'),
  'true', 'claim: 본인 토큰으로 바인딩 성공');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_like(
  $$ SELECT public.ops_claim_participant(current_setting('ops.tokA'), (current_setting('ops.member_id'))::uuid) $$,
  '%OPS_CLAIM_ALREADY_CLAIMED%', 'claim: 이미 타계정 바인딩된 참가자 재클레임 거부');
SELECT set_config('role', 'postgres', true);
SELECT is(
  (SELECT player_user_id FROM public.ops_participants WHERE id = (current_setting('ops.participant_id'))::uuid),
  (current_setting('ops.outsider_id'))::uuid, 'claim: player_user_id = 최초 클레임 계정으로 영속');

-- ── (운영자 un-claim 복구 경로 + 재클레임) — 적대리뷰 대응 ──
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_unclaim_participant((current_setting('ops.participant_id'))::uuid, (current_setting('ops.outsider_id'))::uuid) $$,
  'P0001', NULL, 'unclaim: 비멤버(outsider) 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(
  (public.ops_unclaim_participant((current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid) ->> 'unclaimed'),
  'true', 'unclaim: 운영자 바인딩 해제 성공');
SELECT set_config('role', 'postgres', true);
SELECT is(
  (SELECT player_user_id FROM public.ops_participants WHERE id = (current_setting('ops.participant_id'))::uuid),
  NULL, 'unclaim 후 player_user_id NULL(복구 경로)');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT is(
  (public.ops_claim_participant(current_setting('ops.tokA'), (current_setting('ops.member_id'))::uuid) ->> 'claimed'),
  'true', 'unclaim 후 다른 계정 재클레임 성공');

SELECT * FROM finish();
ROLLBACK;
