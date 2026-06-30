-- ops_reseat_participants pgTAP 검증:
--   ① actor 가드(위조/비멤버), ② 구조 무효(빈배정/중복참가자/중복좌석),
--   ③ 목표 closed 좌석, ④ completed 대회, ⑤ TOCTOU bust, ⑥ 소스 보호(잠금 테이블),
--   ⑦ TOCTOU 외부인, ⑧ 랜덤 재배치(착석수·busted제외), ⑨ 칩 균형,
--   ⑩ derangement(p_a@s1↔p_c@s2) 23505 미발생(RED-GREEN), ⑪ checked_in 승급,
--   ⑫ live_stats 정합, ⑬ 이벤트 4건 append
-- 시드: active 참가자를 좌석에 직접 착석(postgres role) + chips 차등(4000/3000/2000/1000)
--       checked_in 1명(미착석) + busted 1명 + 잠금 테이블 참가자 1명
-- 적대검증 핵심: derangement lives_ok(전원비우기→앉히기로 partial UNIQUE 무위반)
-- ⚠️INSUFFICIENT_SEATS pgTAP 단언 금지(RPC가 raise 안 함 — jest 전담)
-- plan(N) = 실제 SELECT 단언 수와 정확히 일치(불일치 시 pgTAP fail).
BEGIN;
SELECT plan(19);

-- ── 시드 ────────────────────────────────────────────────────────────────────
-- ops_test_seed: owner(employer)·member(employer)·outsider(staff)·tournament(upcoming)·
--               participant 1명(active,30000,미착석)·tbl1(open/none)·s1,s2(NULL)
-- 추가: tbl2(open/none,s3/s4/s5)·tbl_cl(closed,s_cl)·tbl_lk(open/locked,s_lk,p_lk)
--       p_a(active,4000)@s1·p_b(active,3000)@s2·p_c(active,2000)@s3·p_d(active,1000)@s4
--       p_ci(checked_in,500,미착석)·p_bk(busted,0)
DO $$
DECLARE
  s        RECORD;
  v_tbl2   uuid := gen_random_uuid();
  v_tbl_cl uuid := gen_random_uuid();
  v_tbl_lk uuid := gen_random_uuid();
  v_s3     uuid := gen_random_uuid();
  v_s4     uuid := gen_random_uuid();
  v_s5     uuid := gen_random_uuid();
  v_s_cl   uuid := gen_random_uuid();
  v_s_lk   uuid := gen_random_uuid();
  v_p_a    uuid := gen_random_uuid();
  v_p_b    uuid := gen_random_uuid();
  v_p_c    uuid := gen_random_uuid();
  v_p_d    uuid := gen_random_uuid();
  v_p_ci   uuid := gen_random_uuid();
  v_p_bk   uuid := gen_random_uuid();
  v_p_lk   uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM ops_test_seed();

  PERFORM set_config('ops.owner_id',    s.owner_id::text,       true);
  PERFORM set_config('ops.member_id',   s.member_id::text,      true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text,    true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text,  true);
  PERFORM set_config('ops.seed_pid',    s.participant_id::text, true);
  PERFORM set_config('ops.tbl1',        s.table_id::text,       true);
  PERFORM set_config('ops.s1',          s.seat1_id::text,       true);
  PERFORM set_config('ops.s2',          s.seat2_id::text,       true);
  PERFORM set_config('ops.tbl2',        v_tbl2::text,           true);
  PERFORM set_config('ops.s3',          v_s3::text,             true);
  PERFORM set_config('ops.s4',          v_s4::text,             true);
  PERFORM set_config('ops.s5',          v_s5::text,             true);
  PERFORM set_config('ops.s_cl',        v_s_cl::text,           true);
  PERFORM set_config('ops.s_lk',        v_s_lk::text,           true);
  PERFORM set_config('ops.p_a',         v_p_a::text,            true);
  PERFORM set_config('ops.p_b',         v_p_b::text,            true);
  PERFORM set_config('ops.p_c',         v_p_c::text,            true);
  PERFORM set_config('ops.p_d',         v_p_d::text,            true);
  PERFORM set_config('ops.p_ci',        v_p_ci::text,           true);
  PERFORM set_config('ops.p_bk',        v_p_bk::text,           true);
  PERFORM set_config('ops.p_lk',        v_p_lk::text,           true);

  -- 대회 active 전환(bust/reseat 모두 active 대회 필요)
  UPDATE public.ops_tournaments SET status = 'active' WHERE id = s.tournament_id;

  -- tbl2: open/none, 좌석 s3(no.1)/s4(no.2)/s5(no.3)
  INSERT INTO public.ops_tables (id, tournament_id, table_no, status, lock_type)
  VALUES (v_tbl2, s.tournament_id, 2, 'open', 'none');
  INSERT INTO public.ops_seats (id, tournament_id, table_id, table_no, seat_no)
  VALUES (v_s3, s.tournament_id, v_tbl2, 2, 1),
         (v_s4, s.tournament_id, v_tbl2, 2, 2),
         (v_s5, s.tournament_id, v_tbl2, 2, 3);

  -- tbl_cl: closed 테이블(목표좌석 가드 test용)
  INSERT INTO public.ops_tables (id, tournament_id, table_no, status, lock_type)
  VALUES (v_tbl_cl, s.tournament_id, 3, 'closed', 'none');
  INSERT INTO public.ops_seats (id, tournament_id, table_id, table_no, seat_no)
  VALUES (v_s_cl, s.tournament_id, v_tbl_cl, 3, 1);

  -- tbl_lk: open/locked + 참가자 p_lk 착석(소스 보호 가드 test용)
  INSERT INTO public.ops_tables (id, tournament_id, table_no, status, lock_type)
  VALUES (v_tbl_lk, s.tournament_id, 4, 'open', 'locked');
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p_lk, s.tournament_id, 2, 'P_LK', 'active', 100);
  INSERT INTO public.ops_seats (id, tournament_id, table_id, table_no, seat_no, participant_id)
  VALUES (v_s_lk, s.tournament_id, v_tbl_lk, 4, 1, v_p_lk);

  -- active 참가자 4명(chips 차등) — 좌석에 직접 착석(partial UNIQUE 검증을 위해 필수)
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p_a, s.tournament_id, 3, 'PA', 'active', 4000),
         (v_p_b, s.tournament_id, 4, 'PB', 'active', 3000),
         (v_p_c, s.tournament_id, 5, 'PC', 'active', 2000),
         (v_p_d, s.tournament_id, 6, 'PD', 'active', 1000);
  -- checked_in 참가자 (미착석 — 재배치 후 active 승급 검증)
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p_ci, s.tournament_id, 7, 'PCI', 'checked_in', 500);
  -- busted 참가자 (풀 제외 검증)
  INSERT INTO public.ops_participants (id, tournament_id, entry_number, name, status, chips)
  VALUES (v_p_bk, s.tournament_id, 8, 'PBK', 'busted', 0);

  -- 직접 착석: p_a@s1, p_b@s2, p_c@s3, p_d@s4 (postgres role, REVOKE 우회)
  UPDATE public.ops_seats SET participant_id = v_p_a WHERE id = s.seat1_id;
  UPDATE public.ops_seats SET participant_id = v_p_b WHERE id = s.seat2_id;
  UPDATE public.ops_seats SET participant_id = v_p_c WHERE id = v_s3;
  UPDATE public.ops_seats SET participant_id = v_p_d WHERE id = v_s4;
  -- s5=NULL(p_ci 배정용)·s_cl=NULL(목표 closed test용)·s_lk=p_lk(소스보호 test용)
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── A. actor 가드 ─────────────────────────────────────────────────────────────
-- [1] actor 위조: member 가 owner 명의로 호출 → auth.uid() IS DISTINCT FROM p_actor_id → P0001
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(jsonb_build_object('participant_id',%L,'seat_id',%L)),
    'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_a'),  current_setting('ops.s3')),
  '%PERMISSION_DENIED%',
  'actor 위조: member→owner 명의 거부 (PERMISSION_DENIED)');          -- [1]

-- [2] 비멤버 outsider: 본인 명의라도 is_ops_member=false → P0001
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(jsonb_build_object('participant_id',%L,'seat_id',%L)),
    'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.outsider_id'),
    current_setting('ops.p_a'),  current_setting('ops.s3')),
  '%PERMISSION_DENIED%',
  '비멤버 outsider 거부 (PERMISSION_DENIED)');                          -- [2]

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── B. 구조 무효 ──────────────────────────────────────────────────────────────
-- [3] 빈 배정 배열 '[]'
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(%L::uuid,%L::uuid,'[]'::jsonb,'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id')),
  '%SEAT_ASSIGNMENT_INVALID%',
  '빈 배정 배열 거부 (SEAT_ASSIGNMENT_INVALID)');                        -- [3]

-- [4] 중복 참가자(p_a 두 번)
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(
      jsonb_build_object('participant_id',%L,'seat_id',%L),
      jsonb_build_object('participant_id',%L,'seat_id',%L)
    ), 'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_a'),  current_setting('ops.s3'),
    current_setting('ops.p_a'),  current_setting('ops.s4')),  -- p_a 중복
  '%SEAT_ASSIGNMENT_INVALID%',
  '중복 참가자 거부 (SEAT_ASSIGNMENT_INVALID)');                          -- [4]

-- [5] 중복 좌석(s3 두 번)
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(
      jsonb_build_object('participant_id',%L,'seat_id',%L),
      jsonb_build_object('participant_id',%L,'seat_id',%L)
    ), 'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_a'),  current_setting('ops.s3'),
    current_setting('ops.p_b'),  current_setting('ops.s3')),  -- s3 중복
  '%SEAT_ASSIGNMENT_INVALID%',
  '중복 좌석 거부 (SEAT_ASSIGNMENT_INVALID)');                            -- [5]

-- ── C. 목표 closed 좌석 → TABLE_NOT_OPEN ─────────────────────────────────────
-- [6] s_cl 은 tbl_cl(status='closed') 소속 → step7b TABLE_NOT_OPEN
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(jsonb_build_object('participant_id',%L,'seat_id',%L)),
    'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_a'),  current_setting('ops.s_cl')),
  '%TABLE_NOT_OPEN%',
  '닫힌 테이블 목표 좌석 거부 (TABLE_NOT_OPEN)');                        -- [6]

-- ── D. completed 대회 → INVALID_STATUS ──────────────────────────────────────
-- [7] 임시 tournament completed 전환 → 테스트 후 복구
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_tournaments SET status = 'completed'
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(jsonb_build_object('participant_id',%L,'seat_id',%L)),
    'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_a'),  current_setting('ops.s3')),
  '%INVALID_STATUS%',
  '종료 대회 재배치 거부 (INVALID_STATUS)');                              -- [7]
-- 복구: tournament → active
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_tournaments SET status = 'active'
  WHERE id = (current_setting('ops.t_id'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── E. TOCTOU: 동시 bust → PARTICIPANT_NOT_ACTIVE ────────────────────────────
-- [8] p_d 임시 bust → 배정에 포함 시도 → step6 PARTICIPANT_NOT_ACTIVE → 복구
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_participants SET status = 'busted'
  WHERE id = (current_setting('ops.p_d'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(
      jsonb_build_object('participant_id',%L,'seat_id',%L),
      jsonb_build_object('participant_id',%L,'seat_id',%L)
    ), 'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_a'),  current_setting('ops.s3'),
    current_setting('ops.p_d'),  current_setting('ops.s4')),  -- p_d busted
  '%PARTICIPANT_NOT_ACTIVE%',
  'TOCTOU: 동시 bust 참가자 배정 거부 (PARTICIPANT_NOT_ACTIVE)');        -- [8]
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_participants SET status = 'active'
  WHERE id = (current_setting('ops.p_d'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── F. 소스 보호: 잠금 테이블 점유자 풀 포함 → SEAT_ASSIGNMENT_INVALID ─────────
-- [9] p_lk 는 tbl_lk(open/locked) 의 s_lk 점유 → step8 소스 가드 발동
--     목표: s5(open/none, NULL) → step7 통과 후 step8 에서 거부
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(jsonb_build_object('participant_id',%L,'seat_id',%L)),
    'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_lk'),  current_setting('ops.s5')),
  '%SEAT_ASSIGNMENT_INVALID%',
  '소스 보호: 잠금 테이블 참가자 재배치 풀 포함 거부 (SEAT_ASSIGNMENT_INVALID)'); -- [9]

-- ── G. TOCTOU: 외부인 목표좌석 점유 → SEAT_VERSION_CONFLICT ──────────────────
-- [10] seed_pid(풀 외부) 를 s5 에 임시 착석 → p_a→s5 시도 → step7c SEAT_VERSION_CONFLICT
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_seats SET participant_id = (current_setting('ops.seed_pid'))::uuid
  WHERE id = (current_setting('ops.s5'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(
  format($$ SELECT public.ops_reseat_participants(
    %L::uuid, %L::uuid,
    jsonb_build_array(jsonb_build_object('participant_id',%L,'seat_id',%L)),
    'random_draw') $$,
    current_setting('ops.t_id'), current_setting('ops.owner_id'),
    current_setting('ops.p_a'),   current_setting('ops.s5')),  -- s5 = 외부인
  '%SEAT_VERSION_CONFLICT%',
  'TOCTOU: 외부인 목표좌석 점유 거부 (SEAT_VERSION_CONFLICT)');           -- [10]
-- 복구: s5 → NULL
DO $$ BEGIN PERFORM set_config('role', 'postgres', true); END $$;
UPDATE public.ops_seats SET participant_id = NULL
  WHERE id = (current_setting('ops.s5'))::uuid;
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── H. 랜덤 재배치(derangement: 4명 교차 이동) ──────────────────────────────
-- 현 상태: s1→p_a, s2→p_b, s3→p_c, s4→p_d, s5→NULL
-- 배정: p_a→s3, p_b→s4, p_c→s1, p_d→s2 (각자 다른 좌석으로 교차)
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_reseat_participants(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    jsonb_build_array(
      jsonb_build_object('participant_id', current_setting('ops.p_a'), 'seat_id', current_setting('ops.s3')),
      jsonb_build_object('participant_id', current_setting('ops.p_b'), 'seat_id', current_setting('ops.s4')),
      jsonb_build_object('participant_id', current_setting('ops.p_c'), 'seat_id', current_setting('ops.s1')),
      jsonb_build_object('participant_id', current_setting('ops.p_d'), 'seat_id', current_setting('ops.s2'))
    ), 'random_draw') INTO r;
END $$;
-- 이후 상태: s1→p_c, s2→p_d, s3→p_a, s4→p_b, s5→NULL

-- [11] 4명 각 1좌석 착석·중복 좌석 없음
SELECT is(
  (SELECT count(*) FROM public.ops_seats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid
     AND participant_id = ANY(ARRAY[
       (current_setting('ops.p_a'))::uuid, (current_setting('ops.p_b'))::uuid,
       (current_setting('ops.p_c'))::uuid, (current_setting('ops.p_d'))::uuid
     ])),
  4::bigint,
  '랜덤 재배치: 4명 각 1좌석 착석·중복없음');                              -- [11]

-- [12] busted 참가자 좌석 없음
SELECT is(
  (SELECT count(*) FROM public.ops_seats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid
     AND participant_id = (current_setting('ops.p_bk'))::uuid),
  0::bigint,
  '랜덤 재배치: busted 참가자 좌석 없음(풀 제외)');                         -- [12]

-- ── I. 칩 균형(스네이크 배정) ─────────────────────────────────────────────────
-- 현 상태: s1→p_c, s2→p_d, s3→p_a, s4→p_b
-- 스네이크: p_a(4000)→tbl1, p_b(3000)→tbl2, p_c(2000)→tbl1, p_d(1000)→tbl2
-- 명시 배정: p_a→s1, p_c→s2(tbl1: 6000), p_b→s3, p_d→s4(tbl2: 4000)
-- 편차=2000 ≤ 최대스택(4000)
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_reseat_participants(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    jsonb_build_array(
      jsonb_build_object('participant_id', current_setting('ops.p_a'), 'seat_id', current_setting('ops.s1')),
      jsonb_build_object('participant_id', current_setting('ops.p_c'), 'seat_id', current_setting('ops.s2')),
      jsonb_build_object('participant_id', current_setting('ops.p_b'), 'seat_id', current_setting('ops.s3')),
      jsonb_build_object('participant_id', current_setting('ops.p_d'), 'seat_id', current_setting('ops.s4'))
    ), 'chip_draft') INTO r;
END $$;
-- 이후 상태: s1→p_a, s2→p_c, s3→p_b, s4→p_d

-- [13] 칩 균형: |tbl1합 - tbl2합| ≤ 최대스택(스네이크 분배 결과 적용 검증)
SELECT is(
  abs(
    COALESCE((SELECT sum(p.chips) FROM public.ops_participants p
               JOIN public.ops_seats s ON s.participant_id = p.id
              WHERE s.tournament_id = (current_setting('ops.t_id'))::uuid
                AND s.table_id = (current_setting('ops.tbl1'))::uuid), 0)
    -
    COALESCE((SELECT sum(p.chips) FROM public.ops_participants p
               JOIN public.ops_seats s ON s.participant_id = p.id
              WHERE s.tournament_id = (current_setting('ops.t_id'))::uuid
                AND s.table_id = (current_setting('ops.tbl2'))::uuid), 0)
  ) <= COALESCE((SELECT max(chips) FROM public.ops_participants
                  WHERE tournament_id = (current_setting('ops.t_id'))::uuid
                    AND status = 'active'), 0),
  true,
  '칩 균형: tbl1(p_a+p_c=6000)-tbl2(p_b+p_d=4000) 편차=2000 ≤ max_chip(4000)'); -- [13]

-- ── J. derangement RED-GREEN(전원비우기→앉히기로 partial UNIQUE 미위반) ────────
-- 현 상태: s1→p_a, s2→p_c, s3→p_b, s4→p_d
-- 배정: p_a↔p_c 교차(s1↔s2 swap) — step9 vacate 없으면 23505 발생해야 함(RED).
-- GREEN: ops_reseat_participants 의 step9 전원비우기로 23505 미발생 확인(lives_ok).
-- ⚠️RED 검증(별도 수행): ops_reseat_no_vacate_test(step9 제거 임시 함수)로 23505 확인 후 DROP.
SELECT lives_ok(
  $TEST$
  DO $$
  DECLARE r jsonb;
  BEGIN
    SELECT public.ops_reseat_participants(
      (current_setting('ops.t_id'))::uuid,
      (current_setting('ops.owner_id'))::uuid,
      jsonb_build_array(
        jsonb_build_object('participant_id', current_setting('ops.p_a'), 'seat_id', current_setting('ops.s2')),
        jsonb_build_object('participant_id', current_setting('ops.p_c'), 'seat_id', current_setting('ops.s1')),
        jsonb_build_object('participant_id', current_setting('ops.p_b'), 'seat_id', current_setting('ops.s3')),
        jsonb_build_object('participant_id', current_setting('ops.p_d'), 'seat_id', current_setting('ops.s4'))
      ), 'random_draw') INTO r;
  END $$
  $TEST$,
  'derangement(s1↔s2 교차): 전원비우기→앉히기로 23505 미발생(GREEN)');   -- [14]
-- 이후 상태: s1→p_c, s2→p_a, s3→p_b, s4→p_d

-- ── K. checked_in 승급: p_ci 포함 배정 → active 전환 ─────────────────────────
-- 현 상태: s1→p_c, s2→p_a, s3→p_b, s4→p_d, s5→NULL, p_ci=checked_in
-- 배정: 4명+p_ci(checked_in)→s5 포함 전원 5명
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_reseat_participants(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    jsonb_build_array(
      jsonb_build_object('participant_id', current_setting('ops.p_a'),  'seat_id', current_setting('ops.s2')),
      jsonb_build_object('participant_id', current_setting('ops.p_b'),  'seat_id', current_setting('ops.s3')),
      jsonb_build_object('participant_id', current_setting('ops.p_c'),  'seat_id', current_setting('ops.s1')),
      jsonb_build_object('participant_id', current_setting('ops.p_d'),  'seat_id', current_setting('ops.s4')),
      jsonb_build_object('participant_id', current_setting('ops.p_ci'), 'seat_id', current_setting('ops.s5'))
    ), 'chip_draft') INTO r;
  PERFORM set_config('ops.r_seated', (r->>'seated')::text, true);
END $$;

-- [15] p_ci checked_in → active 승급(step11 결과)
SELECT is(
  (SELECT status::text FROM public.ops_participants
   WHERE id = (current_setting('ops.p_ci'))::uuid),
  'active',
  'checked_in → active 승급: p_ci.status=active');                      -- [15]

-- [16] p_a(active) 상태 불변
SELECT is(
  (SELECT status::text FROM public.ops_participants
   WHERE id = (current_setting('ops.p_a'))::uuid),
  'active',
  'active 참가자 상태 불변: p_a.status=active');                          -- [16]

-- ── L. live_stats 정합(트리거 자동 재계산) ───────────────────────────────────
-- active 참가자: seed_p(30000)+p_a(4000)+p_b(3000)+p_c(2000)+p_d(1000)+p_ci(500)+p_lk(100)=7
-- total_chips = 30000+4000+3000+2000+1000+500+100 = 40600

-- [17] live_stats.playing = 7
SELECT is(
  (SELECT playing FROM public.ops_live_stats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  7,
  'live_stats.playing=7: p_ci 승급 후 active 7명(seed·p_a·p_b·p_c·p_d·p_ci·p_lk)'); -- [17]

-- [18] live_stats.total_chips = 40600
SELECT is(
  (SELECT total_chips FROM public.ops_live_stats
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  40600::bigint,
  'live_stats.total_chips=40600: 재배치 후 칩합 정합');                    -- [18]

-- ── M. 이벤트 append-only 정합 ────────────────────────────────────────────────
-- table_redraw 이벤트: test H(random_draw) + I(chip_draft) + J(random_draw) + K(chip_draft) = 4건

-- [19] table_redraw 이벤트 4건 append
SELECT is(
  (SELECT count(*)::int FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid
     AND type = 'table_redraw'),
  4,
  'table_redraw 이벤트 4건 append(랜덤·칩드래프트·derangement·checked_in 승급 각 1건)'); -- [19]

SELECT * FROM finish();
ROLLBACK;
