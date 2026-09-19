-- ops 결함③ — ops_update_participant · ops_delete_participant · ops_set_tournament_archived.
--   actor 가드 · 비멤버 · 미존재 · 값 검증 · XSS 서버 재판정 · 멱등 no-op ·
--   삭제 게이트(상태·이력·좌석) · 삭제 시 entries/prize_pool 감소 실측 ·
--   아카이브 왕복 + active 거부 · anon REVOKE.
-- [가드] SET CONSTRAINTS ALL IMMEDIATE 없이는 live_stats DEFERRED 트리거가 ROLLBACK 으로 끝나
--   "entries 감소" 단언이 빈 통과한다(ops_live_stats_deferred.test.sql 규율).
-- [가드] 최신 이벤트 선별은 seq DESC(전순서 키) — created_at 은 txn 시작 고정이라 동률 시 비결정.
-- [가드] RLS 테이블의 "0건"은 "안 보인다"일 수 있다 — 단언은 모두 owner 세션에서 한다.
BEGIN;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT plan(30);

DO $$
DECLARE s RECORD; player_ids uuid[];
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text, true);
  PERFORM set_config('ops.member_id',   s.member_id::text, true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text, true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);  -- active
  PERFORM set_config('ops.seat1',       s.seat1_id::text, true);
  player_ids := public.ops_test_seed_players(s.tournament_id, 4);
  PERFORM set_config('ops.p1', player_ids[1]::text, true);  -- checked_in, 이력 0 → 삭제 대상
  PERFORM set_config('ops.p2', player_ids[2]::text, true);  -- checked_in + 리바이 1 → 이력 게이트
  PERFORM set_config('ops.p3', player_ids[3]::text, true);  -- checked_in + 좌석 → 좌석 게이트
  PERFORM set_config('ops.p4', player_ids[4]::text, true);  -- 정정 대상
END $$;

DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_participants SET status = 'checked_in'
   WHERE id IN ((current_setting('ops.p1'))::uuid, (current_setting('ops.p2'))::uuid,
                (current_setting('ops.p3'))::uuid);
  UPDATE public.ops_participants SET rebuys = 1 WHERE id = (current_setting('ops.p2'))::uuid;
  UPDATE public.ops_seats SET participant_id = (current_setting('ops.p3'))::uuid
   WHERE id = (current_setting('ops.seat1'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ══════════════ 1) ops_update_participant ══════════════
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_ok(                                                            -- [1]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 'X') $$,
  'P0001', NULL, '정정: actor 가드 — 명의 위조 거부');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [2]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.outsider_id'))::uuid, 'X') $$,
  'PERMISSION_DENIED%', '정정: 비멤버 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

SELECT throws_like(                                                          -- [3]
  $$ SELECT public.ops_update_participant('00000000-0000-0000-0000-0000000000ff'::uuid,
       (current_setting('ops.owner_id'))::uuid, 'X') $$,
  'PARTICIPANT_NOT_FOUND%', '정정: 미존재 참가자 거부');
SELECT throws_like(                                                          -- [4]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.owner_id'))::uuid, '   ') $$,
  'PARTICIPANT_NAME_INVALID%', '정정: 공백뿐인 이름 거부(trim 후 판정)');
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.owner_id'))::uuid, repeat('가', 101)) $$,
  'PARTICIPANT_NAME_INVALID%', '정정: 이름 101자 거부');
SELECT throws_like(                                                          -- [6]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 'ok', repeat('a', 51)) $$,
  'PARTICIPANT_NATIONALITY_INVALID%', '정정: 국적 51자 거부');
SELECT throws_like(                                                          -- [7]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 'ok', NULL, repeat('9', 31)) $$,
  'PARTICIPANT_PHONE_INVALID%', '정정: 연락처 31자 거부');
-- XSS 는 서버가 재판정한다 — ops_participants 에는 트리거 계층이 없어 RPC 직접 호출에 뚫린다.
SELECT throws_like(                                                          -- [8]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.owner_id'))::uuid, '<script>alert(1)</script>') $$,
  'PARTICIPANT_TEXT_INVALID%', '정정: 이름 XSS 서버 거부');
SELECT throws_like(                                                          -- [9]
  $$ SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
       (current_setting('ops.owner_id'))::uuid, 'ok', 'KR', '<iframe src=x>') $$,
  'PARTICIPANT_TEXT_INVALID%', '정정: 연락처 XSS 도 서버 거부(세 필드 전부 검사)');

DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
    (current_setting('ops.owner_id'))::uuid, '  정정된 이름  ', 'KR', '010-1234-5678') INTO r;
  PERFORM set_config('ops.upd_changed', (r->>'changed'), true);
END $$;
SELECT is(                                                                   -- [10]
  (SELECT name FROM public.ops_participants WHERE id = (current_setting('ops.p4'))::uuid),
  '정정된 이름', '정정: 이름 반영 + 앞뒤 공백 trim');
SELECT is(                                                                   -- [11]
  (SELECT nationality FROM public.ops_participants WHERE id = (current_setting('ops.p4'))::uuid),
  'KR', '정정: 국적 반영');
SELECT is(current_setting('ops.upd_changed'), 'true', '정정: changed=true');  -- [12]
SELECT is(                                                                   -- [13]
  (SELECT payload->>'name_after' FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_updated'
    ORDER BY seq DESC LIMIT 1),
  '정정된 이름', 'player_updated payload.name_after(원장 레벨)');
SELECT isnt(                                                                 -- [14]
  (SELECT payload->>'name_before' FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_updated'
    ORDER BY seq DESC LIMIT 1),
  NULL, 'player_updated 는 name_before 도 남긴다(정정 분쟁의 유일 근거)');

-- 국적을 NULL 로 = 지우기
DO $$ BEGIN
  PERFORM public.ops_update_participant((current_setting('ops.p4'))::uuid,
    (current_setting('ops.owner_id'))::uuid, '정정된 이름', NULL, '010-1234-5678');
END $$;
SELECT is(                                                                   -- [15]
  (SELECT nationality FROM public.ops_participants WHERE id = (current_setting('ops.p4'))::uuid),
  NULL, '정정: NULL 은 "지우기"다(변경 없음이 아니다)');

-- 멱등 no-op — 프리필 폼의 무변경 저장
DO $$
DECLARE v_cnt int; r jsonb;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_updated';
  PERFORM set_config('ops.upd_evt_before', v_cnt::text, true);
  SELECT public.ops_update_participant((current_setting('ops.p4'))::uuid,
    (current_setting('ops.owner_id'))::uuid, '정정된 이름', NULL, '010-1234-5678') INTO r;
  PERFORM set_config('ops.noop_changed', COALESCE(r->>'changed', '<missing>'), true);
  PERFORM set_config('ops.noop_name',    COALESCE(r->>'name', '<missing>'), true);
END $$;
SELECT is(                                                                   -- [16]
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_updated'),
  (current_setting('ops.upd_evt_before'))::int, '정정: 무변경 저장은 이벤트 0행');
SELECT is(current_setting('ops.noop_changed'), 'false', '정정: no-op 은 changed=false'); -- [17]
SELECT is(current_setting('ops.noop_name'), '정정된 이름',                    -- [18]
  '정정: no-op 반환에도 name 포함(클라 zod 필수 키)');

-- ══════════════ 2) ops_delete_participant ══════════════
SELECT throws_like(                                                          -- [19]
  $$ SELECT public.ops_delete_participant((current_setting('ops.seed_pid'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'PARTICIPANT_NOT_REMOVABLE%', '삭제: active 참가자 거부(탈락 경로 보호)');
SELECT throws_like(                                                          -- [20]
  $$ SELECT public.ops_delete_participant((current_setting('ops.p2'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'PARTICIPANT_HAS_HISTORY%', '삭제: 리바이 이력 있으면 거부');
SELECT throws_like(                                                          -- [21]
  $$ SELECT public.ops_delete_participant((current_setting('ops.p3'))::uuid,
       (current_setting('ops.owner_id'))::uuid) $$,
  'PARTICIPANT_SEATED%', '삭제: 좌석 점유 시 거부(조용한 FK SET NULL 방지)');
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [22]
  $$ SELECT public.ops_delete_participant((current_setting('ops.p1'))::uuid,
       (current_setting('ops.outsider_id'))::uuid) $$,
  'PERMISSION_DENIED%', '삭제: 비멤버 거부');
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- 주 경로: 이력 0 인 checked_in 삭제 → entries·prize_pool 감소
DO $$
DECLARE r jsonb; v_entries int; v_pool bigint;
BEGIN
  SELECT entries, prize_pool INTO v_entries, v_pool FROM public.ops_live_stats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid;
  PERFORM set_config('ops.entries_before', v_entries::text, true);
  PERFORM set_config('ops.pool_before',    v_pool::text, true);
  SELECT public.ops_delete_participant((current_setting('ops.p1'))::uuid,
    (current_setting('ops.owner_id'))::uuid) INTO r;
  PERFORM set_config('ops.del_entry_no', (r->>'entry_number'), true);
END $$;
SELECT is(                                                                   -- [23]
  (SELECT count(*)::int FROM public.ops_participants
    WHERE id = (current_setting('ops.p1'))::uuid),
  0, '삭제: 행이 사라진다');
SELECT is(                                                                   -- [24]
  (SELECT entries FROM public.ops_live_stats
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  (current_setting('ops.entries_before'))::int - 1,
  '삭제: live_stats.entries -1 (AFTER DELETE 트리거 자동 재계산)');
-- 🔑 이게 이 RPC 의 존재 이유다 — 오등록이 운영자 화면의 상금 풀을 부풀리던 것을 되돌린다.
SELECT is(                                                                   -- [25]
  (SELECT prize_pool FROM public.ops_live_stats
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  (current_setting('ops.pool_before'))::bigint - 50000,
  '삭제: prize_pool 이 buy_in_cost(50000) 만큼 줄어든다');
SELECT is(                                                                   -- [26]
  (SELECT payload->>'name' FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'player_deleted'
    ORDER BY seq DESC LIMIT 1),
  (SELECT 'P' || (current_setting('ops.del_entry_no'))),
  'player_deleted 는 삭제 전 스냅샷을 남긴다(행이 없어진 뒤 유일한 영구 기록)');

-- ══════════════ 3) ops_set_tournament_archived ══════════════
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_set_tournament_archived((current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid, true) INTO r;
  PERFORM set_config('ops.arch_changed', (r->>'changed'), true);
END $$;
SELECT isnt(                                                                 -- [27]
  (SELECT archived_at FROM public.ops_tournaments
    WHERE id = (current_setting('ops.t_id'))::uuid),
  NULL, '아카이브: upcoming 대회 보관 성공(archived_at 기록)');
-- 복원 → 다시 NULL. status 는 건드리지 않는다(직교).
DO $$ BEGIN
  PERFORM public.ops_set_tournament_archived((current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid, false);
END $$;
-- ⚠️ `archived_at::text || '|' || status` 로 묶지 말 것 — NULL 연결은 전체가 NULL 이 되어
--    함수가 정상이어도 단언이 깨진다(실제로 한 번 밟았다). COALESCE 로 NULL 을 문자로 고정한다.
SELECT is(                                                                   -- [28]
  (SELECT COALESCE(archived_at::text, 'NULL') || '|' || status::text
     FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  'NULL|upcoming', '아카이브: 복원 시 archived_at=NULL · status 는 원래대로(직교)');
-- active 대회 보관 거부 — 진행 중인 대회를 목록에서 치우는 것은 사고다.
DO $$ BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tournaments SET status = 'active'
   WHERE id = (current_setting('ops.t_id'))::uuid;
END $$;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [29]
  $$ SELECT public.ops_set_tournament_archived((current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid, true) $$,
  'TOURNAMENT_ACTIVE%', '아카이브: 진행 중(active) 대회 보관 거부');

-- ══════════════ 권한: anon REVOKE (=2 불변 계약) ══════════════
SELECT ok(                                                                   -- [30]
  NOT has_function_privilege('anon', 'public.ops_update_participant(uuid,uuid,text,text,text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.ops_delete_participant(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.ops_set_tournament_archived(uuid,uuid,boolean)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.ops_update_participant(uuid,uuid,text,text,text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.ops_delete_participant(uuid,uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.ops_set_tournament_archived(uuid,uuid,boolean)', 'EXECUTE'),
  '3종 모두 anon EXECUTE 불가 / authenticated 가능');

SELECT * FROM finish();
ROLLBACK;
