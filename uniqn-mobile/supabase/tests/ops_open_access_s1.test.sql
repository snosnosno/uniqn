-- ops 전면 개방 S1: monitor_config(C6) · nextBreak/payouts 스냅샷(C1) · 복제(A4) · 상금 지급(C4)
-- · 공개뷰 신고(B2) · 퍼널 이벤트(D1) — 권한 격리 + anon-executable =2 계약 + 동작 검증.
-- 패턴: ops_monitor_snapshot.test.sql(seed·set_user·role 전환), ops_staff_security.test.sql(=2 카운트).
BEGIN;
SELECT plan(60);

-- ─── 시드 ───
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',       s.owner_id::text,       true);
  PERFORM set_config('ops.member_id',      s.member_id::text,      true);
  PERFORM set_config('ops.outsider_id',    s.outsider_id::text,    true);
  PERFORM set_config('ops.tournament_id',  s.tournament_id::text,  true);
  PERFORM set_config('ops.participant_id', s.participant_id::text, true);
END $$;

-- 블라인드 구조(브레이크 포함) + 클럭 앵커 + 상금 6단계 시드 (postgres 권한)
DO $$
DECLARE t uuid := (current_setting('ops.tournament_id'))::uuid;
BEGIN
  INSERT INTO public.ops_blind_levels (tournament_id, level, small_blind, big_blind, ante, duration_sec, is_break, sort)
  VALUES
    (t, 1, 100, 200, 0, 600, false, 1),
    (t, 2, 200, 400, 0, 900, false, 2),
    (t, 3,   0,   0, 0, 300, true,  3),
    (t, 4, 300, 600, 600, 900, false, 4);
  UPDATE public.ops_clock
     SET current_level_sort = 1, level_started_at = now(), is_running = true
   WHERE tournament_id = t;
  INSERT INTO public.ops_prizes (tournament_id, rank, amount)
  VALUES (t, 1, 5000000), (t, 2, 3000000), (t, 3, 2000000),
         (t, 4, 1000000), (t, 5, 500000), (t, 6, 300000);
  -- 플레이어 뷰 접근용 view_token (48자)
  UPDATE public.ops_participants
     SET view_token = repeat('p', 48)
   WHERE id = (current_setting('ops.participant_id'))::uuid;
END $$;

-- ─── (1~6) 신규 RPC 권한 격리 ───
SELECT ok(NOT has_function_privilege('anon', 'public.ops_set_monitor_config(uuid,uuid,jsonb)', 'EXECUTE'),
  'anon CANNOT EXECUTE ops_set_monitor_config');
SELECT ok(has_function_privilege('authenticated', 'public.ops_set_monitor_config(uuid,uuid,jsonb)', 'EXECUTE'),
  'authenticated CAN EXECUTE ops_set_monitor_config');
SELECT ok(NOT has_function_privilege('anon', 'public.ops_duplicate_tournament(uuid,uuid,text,date)', 'EXECUTE'),
  'anon CANNOT EXECUTE ops_duplicate_tournament');
SELECT ok(has_function_privilege('authenticated', 'public.ops_duplicate_tournament(uuid,uuid,text,date)', 'EXECUTE'),
  'authenticated CAN EXECUTE ops_duplicate_tournament');
SELECT ok(NOT has_function_privilege('anon', 'public.ops_set_prize_paid(uuid,uuid,boolean)', 'EXECUTE'),
  'anon CANNOT EXECUTE ops_set_prize_paid');
SELECT ok(has_function_privilege('authenticated', 'public.ops_set_prize_paid(uuid,uuid,boolean)', 'EXECUTE'),
  'authenticated CAN EXECUTE ops_set_prize_paid');

-- ─── (7~8) anon-executable ops SECDEF =2 불변 계약 ───
SELECT is(
  (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'ops\_%' AND p.proname NOT LIKE 'ops\_test\_%'
      AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  2, 'S1 이후에도 anon-executable ops SECDEF 총량=2');
SELECT is(
  ARRAY(SELECT p.proname::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'ops\_%' AND p.proname NOT LIKE 'ops\_test\_%'
      AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE') ORDER BY 1),
  ARRAY['ops_get_monitor_snapshot', 'ops_get_player_view']::text[],
  'S1 이후에도 anon-executable 집합 = {monitor, player} 정확 일치');

-- ─── (9~18) ops_set_monitor_config: 검증·권한 ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(
  (public.ops_set_monitor_config(
     (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
     '{"v":1,"preset":"full","slots":["players","totalChips","avgStack","regStatus","nextBreak"]}'::jsonb)
   -> 'monitor_config' ->> 'preset'),
  'full', 'owner 유효 구성 저장 → preset=full 반환');
SELECT is(
  (SELECT monitor_config->'slots'->>0 FROM public.ops_tournaments
    WHERE id = (current_setting('ops.tournament_id'))::uuid),
  'players', '저장된 slots[0]=players');
SELECT throws_ok(
  $$ SELECT public.ops_set_monitor_config(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       '{"v":1,"preset":"diagonal","slots":[null,null,null,null,null]}'::jsonb) $$,
  'P0001', NULL, '알 수 없는 preset 거부');
SELECT throws_ok(
  $$ SELECT public.ops_set_monitor_config(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       '{"v":1,"preset":"full","slots":["players",null,null,null]}'::jsonb) $$,
  'P0001', NULL, 'slots 길이 5 위반 거부');
SELECT throws_ok(
  $$ SELECT public.ops_set_monitor_config(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       '{"v":1,"preset":"full","slots":["hackerModule",null,null,null,null]}'::jsonb) $$,
  'P0001', NULL, '화이트리스트 밖 모듈 id 거부');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_set_monitor_config(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.member_id'))::uuid,
       '{"v":1,"preset":"classic","slots":[null,null,null,null,null]}'::jsonb) $$,
  'P0001', NULL, '워크스페이스 멤버여도 owner 아니면 거부(owner 전용)');
SELECT throws_ok(
  $$ SELECT public.ops_set_monitor_config(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
       '{"v":1,"preset":"classic","slots":[null,null,null,null,null]}'::jsonb) $$,
  'P0001', NULL, '위조 actor(member→owner 명의) 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$ BEGIN
  PERFORM public.ops_set_monitor_config(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid, NULL);
END $$;
SELECT ok(
  (SELECT monitor_config IS NULL FROM public.ops_tournaments
    WHERE id = (current_setting('ops.tournament_id'))::uuid),
  'NULL 구성 = 기본값 복귀(컬럼 NULL)');
SELECT is(
  (public.ops_set_monitor_config(
     (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
     '{"v":1,"preset":"mirror","slots":["players","entries","avgStack","prizePool","nextBreak"],"evil":"x"}'::jsonb)
   -> 'monitor_config' ->> 'preset'),
  'mirror', '스냅샷 검증용 최종 구성 저장(preset=mirror, evil 키 포함 입력)');

-- ─── (19~28) 스냅샷 확장: monitorConfig · nextBreak · payouts (+플레이어 뷰 동일 소스) ───
DO $$
DECLARE v text;
BEGIN
  v := public.ops_rotate_monitor_token(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid) ->> 'monitorToken';
  PERFORM set_config('ops.tok', v, true);
END $$;
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'monitorConfig' ->> 'preset'),
  'mirror', 'snapshot: monitorConfig 반환');
SELECT ok(
  NOT ((public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'monitorConfig') ? 'evil'),
  'snapshot: 저장 단계에서 미지 키 제거 확인(evil 미노출)');
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'nextBreak' ->> 'secondsFromLevelStart')::int,
  1500, 'snapshot: 다음 브레이크까지 누적 초 = 600+900 (레벨1 시작 앵커)');
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'nextBreak' ->> 'level')::int,
  3, 'snapshot: 다음 브레이크 레벨 = 3');
SELECT is(
  jsonb_array_length(public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'payouts'),
  5, 'snapshot: payouts 상위 5개만(6단계 중)');
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'payouts' -> 0 ->> 'position')::int,
  1, 'snapshot: payouts[0].position = 1');
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'payouts' -> 0 ->> 'amount')::int,
  5000000, 'snapshot: payouts[0].amount = 1위 상금');
SELECT is(
  (public.ops_get_player_view(repeat('p', 48)) -> 'nextBreak' ->> 'secondsFromLevelStart')::int,
  1500, 'player view: nextBreak 동일 값(표면별 드리프트 0 — 동일 데이터 소스)');
-- 브레이크 진행 중이면 nextBreak 는 "다음" 브레이크(없으면 null) — 현재 레벨 isBreak 로 클라가 휴식 표시
SELECT set_config('role', 'postgres', true);
UPDATE public.ops_clock SET current_level_sort = 3
 WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid;
SELECT ok(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'nextBreak') = 'null'::jsonb,
  'snapshot: 브레이크 이후 추가 브레이크 없음 → nextBreak null');
SELECT is(
  (public.ops_get_monitor_snapshot(current_setting('ops.tok')) -> 'currentLevel' ->> 'isBreak'),
  'true', 'snapshot: 현재 레벨 isBreak=true (휴식 중 신호)');

-- ─── (29~38) ops_duplicate_tournament ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  r := public.ops_duplicate_tournament(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid);
  PERFORM set_config('ops.dup_id', r ->> 'tournament_id', true);
  PERFORM set_config('ops.dup_levels', r ->> 'levels_copied', true);
END $$;
SELECT is((current_setting('ops.dup_levels'))::int, 4, '복제: levels_copied=4');
SELECT is(
  (SELECT name FROM public.ops_tournaments WHERE id = (current_setting('ops.dup_id'))::uuid),
  'ops test cup', '복제: 이름 미지정 시 원본 이름 유지');
SELECT is(
  (SELECT monitor_config ->> 'preset' FROM public.ops_tournaments
    WHERE id = (current_setting('ops.dup_id'))::uuid),
  'mirror', '복제: monitor_config 복사(C6-⑥)');
SELECT ok(
  (SELECT job_posting_id IS NULL AND monitor_token IS NULL
          AND status = 'upcoming' AND registration_open
     FROM public.ops_tournaments WHERE id = (current_setting('ops.dup_id'))::uuid),
  '복제: 공고 연결/모니터 토큰 미복사 + upcoming + 등록 오픈');
SELECT is(
  (SELECT count(*)::int FROM public.ops_blind_levels
    WHERE tournament_id = (current_setting('ops.dup_id'))::uuid),
  4, '복제: 블라인드 구조 4행 복사');
SELECT ok(
  EXISTS (SELECT 1 FROM public.ops_clock WHERE tournament_id = (current_setting('ops.dup_id'))::uuid)
  AND EXISTS (SELECT 1 FROM public.ops_live_stats WHERE tournament_id = (current_setting('ops.dup_id'))::uuid),
  '복제: 클럭/스탯 파생 행 자동 생성(트리거)');
DO $$
DECLARE r jsonb;
BEGIN
  r := public.ops_duplicate_tournament(
    (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid,
    '아침 복제', current_date);
  PERFORM set_config('ops.dup2_id', r ->> 'tournament_id', true);
END $$;
SELECT is(
  (SELECT name FROM public.ops_tournaments WHERE id = (current_setting('ops.dup2_id'))::uuid),
  '아침 복제', '복제: 이름 지정 시 지정 이름');
SELECT ok(
  (SELECT event_date = current_date FROM public.ops_tournaments
    WHERE id = (current_setting('ops.dup2_id'))::uuid),
  '복제: event_date 지정값 반영');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_duplicate_tournament(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.member_id'))::uuid) $$,
  'P0001', NULL, '복제: 워크스페이스 멤버여도 owner 아니면 거부');
SELECT throws_ok(
  $$ SELECT public.ops_duplicate_tournament(
       (current_setting('ops.tournament_id'))::uuid, (current_setting('ops.owner_id'))::uuid) $$,
  'P0001', NULL, '복제: 위조 actor 거부');

-- ─── (39~48) ops_set_prize_paid ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_set_prize_paid(
       (current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid, true) $$,
  'P0001', NULL, '상금 미배정 참가자 지급 마킹 거부');
SELECT set_config('role', 'postgres', true);
UPDATE public.ops_participants
   SET prize_amount = 100000, finish_position = 1
 WHERE id = (current_setting('ops.participant_id'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT ok(
  (public.ops_set_prize_paid(
     (current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid, true)
   ->> 'prize_paid_at') IS NOT NULL,
  '지급 마킹 → prize_paid_at 반환');
SELECT ok(
  (SELECT prize_paid_at IS NOT NULL FROM public.ops_participants
    WHERE id = (current_setting('ops.participant_id'))::uuid),
  '지급 마킹 → 행 영속');
SELECT is(
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid AND type = 'prize_paid'),
  1, 'prize_paid 이벤트 1건 append');
SELECT lives_ok(
  $$ SELECT public.ops_set_prize_paid(
       (current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid, true) $$,
  '멱등: 이미 지급 상태 재호출 no-op');
SELECT is(
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid AND type = 'prize_paid'),
  1, '멱등: 중복 이벤트 없음');
DO $$ BEGIN
  PERFORM public.ops_set_prize_paid(
    (current_setting('ops.participant_id'))::uuid, (current_setting('ops.owner_id'))::uuid, false);
END $$;
SELECT ok(
  (SELECT prize_paid_at IS NULL FROM public.ops_participants
    WHERE id = (current_setting('ops.participant_id'))::uuid),
  'undo → prize_paid_at NULL 복귀');
SELECT is(
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid AND type = 'prize_paid_undone'),
  1, 'prize_paid_undone 이벤트 1건 append');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_ok(
  $$ SELECT public.ops_set_prize_paid(
       (current_setting('ops.participant_id'))::uuid, (current_setting('ops.outsider_id'))::uuid, true) $$,
  'P0001', NULL, '비멤버(outsider) 지급 마킹 거부');
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT lives_ok(
  $$ SELECT public.ops_set_prize_paid(
       (current_setting('ops.participant_id'))::uuid, (current_setting('ops.member_id'))::uuid, true) $$,
  '워크스페이스 멤버는 지급 마킹 가능(is_ops_member)');

-- ─── (49~55) ops_public_reports: 익명 신고 + rate limit ───
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('role', 'anon', true);
SELECT lives_ok(
  $$ INSERT INTO public.ops_public_reports (token_kind, token, reason, details)
     VALUES ('monitor', current_setting('ops.tok'), 'gambling', '수상한 대회') $$,
  'anon 신고 접수(유효 모니터 토큰)');
SELECT set_config('role', 'postgres', true);
SELECT ok(
  (SELECT tournament_id = (current_setting('ops.tournament_id'))::uuid
          AND reporter_id IS NULL
          AND token = left(current_setting('ops.tok'), 8)
     FROM public.ops_public_reports LIMIT 1),
  '신고 행 캐노니컬: 대회 바인딩 + reporter NULL + 토큰 8자 절단'
);
SELECT set_config('role', 'anon', true);
SELECT throws_ok(
  $$ INSERT INTO public.ops_public_reports (token_kind, token, reason)
     VALUES ('monitor', repeat('x', 48), 'gambling') $$,
  'P0001', NULL, '무효 토큰 신고 거부');
SELECT throws_ok(
  $$ INSERT INTO public.ops_public_reports (token_kind, token, reason)
     VALUES ('monitor', current_setting('ops.tok'), 'spam_reason') $$,
  '23514', NULL, '사유 택소노미 밖 거부(CHECK)');
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..4 LOOP
    INSERT INTO public.ops_public_reports (token_kind, token, reason)
    VALUES ('monitor', current_setting('ops.tok'), 'other');
  END LOOP;
END $$;
SELECT throws_ok(
  $$ INSERT INTO public.ops_public_reports (token_kind, token, reason)
     VALUES ('monitor', current_setting('ops.tok'), 'other') $$,
  'P0001', NULL, '재신고 rate limit: 대회당 시간당 5건 초과 거부');
SELECT set_config('role', 'postgres', true);
SELECT is(
  (SELECT count(*)::int FROM public.ops_public_reports
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  5, 'rate limit 직전까지 5건 접수됨');
SELECT set_config('role', 'anon', true);
SELECT is(
  (SELECT count(*)::int FROM public.ops_public_reports),
  0, 'anon 은 신고 내역 조회 불가(RLS admin 전용)');

-- ─── (56~61) analytics_events: 퍼널 계측 가드 ───
SELECT lives_ok(
  $$ INSERT INTO public.analytics_events (event, props)
     VALUES ('ops_public_view_opened', jsonb_build_object('tk', left(current_setting('ops.tok'), 8))) $$,
  'anon 공개뷰 열람 이벤트 기록');
SELECT throws_ok(
  $$ INSERT INTO public.analytics_events (event, props)
     VALUES ('ops_hub_entered', '{"tk":"abcd1234"}'::jsonb) $$,
  '42501', NULL, 'anon 은 공개뷰 열람 외 이벤트 불가(RLS)');
SELECT throws_ok(
  $$ INSERT INTO public.analytics_events (event, props)
     VALUES ('ops_public_view_opened', '{}'::jsonb) $$,
  'P0001', NULL, 'anon 이벤트에 토큰 prefix 없으면 거부(트리거)');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT lives_ok(
  $$ INSERT INTO public.analytics_events (event, user_id, props)
     VALUES ('ops_hub_entered', (current_setting('ops.outsider_id'))::uuid, '{}'::jsonb) $$,
  '인증 사용자 이벤트 기록(위조 user_id 는 트리거가 교정)');
SELECT set_config('role', 'postgres', true);
SELECT is(
  (SELECT user_id FROM public.analytics_events WHERE event = 'ops_hub_entered' LIMIT 1),
  (current_setting('ops.owner_id'))::uuid,
  '위조 user_id(outsider) → auth.uid()(owner) 로 교정 저장');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.analytics_events),
  0, '비-admin 은 이벤트 조회 불가(RLS admin 전용)');

SELECT * FROM finish();
ROLLBACK;
