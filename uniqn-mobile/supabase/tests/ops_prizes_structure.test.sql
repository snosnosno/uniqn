-- ops_prizes_structure pgTAP 검증:
--   ① replace-all: 재설정 시 기존 행 삭제+신규(count 일치, 옛 rank 부재 SELECT).
--   ② 중복 rank → PRIZE_STRUCTURE_INVALID.
--   ③ amount 0/음수 → PRIZE_STRUCTURE_INVALID.
--   ④ completed 대회 → INVALID_STATUS.
--   ⑤ RLS SELECT: owner=보임/outsider=0행.
--   ⑥ anon EXECUTE 거부.
--   ⑦ actor 가드 2종(위조 member·비멤버 outsider) → PERMISSION_DENIED.
--   [NEW] NULL rank·NULL amount → PRIZE_STRUCTURE_INVALID (NULL-가드 보완).
--   [NEW] 비-숫자/소수 rank("abc"/1.5)·SQL NULL p_prizes → PRIZE_STRUCTURE_INVALID
--         (캐스트 전 정규식 선검증 — raw 22P02 누출·silent clear 차단, golden #6).
-- 패턴: ops_bust_participant.test.sql·ops_reenter_participant.test.sql
--   (set_config 보관·throws_like 게이트별 메시지·postgres 역할 전환).
-- ⚠️ 시드 주의: ops_test_seed 기본 status='upcoming'.
--    set_prize_structure 는 upcoming/active 둘 다 허용(completed만 거부).
--    completed 시나리오(④)는 별도 대회를 postgres 역할로 직접 INSERT.

BEGIN;
SELECT plan(15);

-- ── 시드 ──────────────────────────────────────────────────────────────────────
-- ops_test_seed: owner·member·outsider·tournament(upcoming)·participant 1명.
-- t2: completed 대회 (④ 시나리오 전용 — postgres 역할로 직접 INSERT).
DO $$
DECLARE
  s           RECORD;
  v_t2        uuid := gen_random_uuid();
  v_t2_jp     uuid := gen_random_uuid();
  v_work_date date := current_date + 14;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',    s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',   s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id', s.outsider_id::text,   true);
  PERFORM set_config('ops.t_id',        s.tournament_id::text, true);

  -- ④ 시나리오용: completed 대회 수동 시드 (postgres 역할에서 직접 INSERT)
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  ) VALUES (
    v_t2_jp, s.owner_id, 'ops owner', s.workspace_id,
    'completed prize cup', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text], 2, 0, 0, 3, '+82101111113', now(), now()
  );
  INSERT INTO public.ops_tournaments (
    id, owner_id, job_posting_id, name, game_type, starting_chips,
    registration_open, next_entry_seq, status
  ) VALUES (
    v_t2, s.owner_id, v_t2_jp, 'completed prize cup', 'NLH', 30000, false, 1, 'completed'
  );
  PERFORM set_config('ops.t2_id', v_t2::text, true);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── ⑦ actor 가드 ─────────────────────────────────────────────────────────────
-- 가드①: 위조 actor — member 가 owner 명의로 호출 → auth.uid() IS DISTINCT FROM p_actor_id → PERMISSION_DENIED
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_like(                                                          -- [1]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":1,"amount":100}]'::jsonb) $$,
  '%PERMISSION_DENIED%',
  '⑦ actor 가드: member→owner 명의 위조 거부 (PERMISSION_DENIED)');

-- 가드②: 비멤버 outsider — 본인 명의라도 is_ops_member=false → PERMISSION_DENIED
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [2]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.outsider_id'))::uuid,
       '[{"rank":1,"amount":100}]'::jsonb) $$,
  '%PERMISSION_DENIED%',
  '⑦ actor 가드: 비멤버 outsider 거부 (PERMISSION_DENIED)');

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

-- ── ① replace-all ────────────────────────────────────────────────────────────
-- 초기 설정: rank 1-3 (3개)
SELECT public.ops_set_prize_structure(
  (current_setting('ops.t_id'))::uuid,
  (current_setting('ops.owner_id'))::uuid,
  '[{"rank":1,"amount":100000},{"rank":2,"amount":50000},{"rank":3,"amount":25000}]'::jsonb);

-- 재설정: rank 1-2 만 (rank 3 제거) — replace-all 동작 검증
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_set_prize_structure(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    '[{"rank":1,"amount":200000},{"rank":2,"amount":100000}]'::jsonb) INTO r;
  PERFORM set_config('ops.r_count', (r->>'count'), true);
END $$;

SELECT is(current_setting('ops.r_count')::int, 2,                           -- [3]
  '① replace-all: 재설정 반환값 count=2 (rank 1·2만 유지)');

SELECT is(                                                                   -- [4]
  (SELECT count(*)::int FROM public.ops_prizes
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND rank = 3),
  0,
  '① replace-all: 옛 rank 3 부재 (replace-all 로 삭제됨)');

-- ── ② 중복 rank ──────────────────────────────────────────────────────────────
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":1,"amount":100},{"rank":1,"amount":50}]'::jsonb) $$,
  '%PRIZE_STRUCTURE_INVALID%',
  '② 중복 rank 1 → PRIZE_STRUCTURE_INVALID');

-- ── ③ amount 0 ────────────────────────────────────────────────────────────────
SELECT throws_like(                                                          -- [6]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":1,"amount":0}]'::jsonb) $$,
  '%PRIZE_STRUCTURE_INVALID%',
  '③ amount 0 → PRIZE_STRUCTURE_INVALID');

-- ── [NEW] NULL-가드: NULL rank ────────────────────────────────────────────────
-- 현재 RPC 는 NULL rank 가 FILTER 를 우회하지만 count<>distinct 로 우연히 잡힘 → 이미 PASS 가능.
-- 명시 NULL IS NULL 가드 추가 후에도 동일 동작을 보장(회귀 방지).
SELECT throws_like(                                                          -- [7]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":null,"amount":100}]'::jsonb) $$,
  '%PRIZE_STRUCTURE_INVALID%',
  '[NEW] NULL rank → PRIZE_STRUCTURE_INVALID (NULL-가드)');

-- ── [NEW] NULL-가드: NULL amount ──────────────────────────────────────────────
-- 현재 RPC: NULL < 1 = NULL → FILTER 미포함 → v_bad=0 → 검증 통과 → INSERT 23502 (NOT NULL 위반).
-- 수정 후: (e->>'amount') IS NULL 명시 가드 → PRIZE_STRUCTURE_INVALID 발화.
SELECT throws_like(                                                          -- [8]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":1,"amount":null}]'::jsonb) $$,
  '%PRIZE_STRUCTURE_INVALID%',
  '[NEW] NULL amount → PRIZE_STRUCTURE_INVALID (NULL-가드)');

-- ── [NEW] 신뢰경계: 비-숫자 rank (캐스트 전 정규식 선검증 — raw 22P02 누출 차단) ──
-- 수정 전: count(DISTINCT (e->>'rank')::int) 가 'abc'::int 강제 → raw 22P02(메시지에 PRIZE_STRUCTURE_INVALID 없음=RED).
-- 수정 후: 정규식 선검증이 친절 PRIZE_STRUCTURE_INVALID 발화(GREEN).
SELECT throws_like(                                                          -- [9]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":"abc","amount":100}]'::jsonb) $$,
  '%PRIZE_STRUCTURE_INVALID%',
  '[NEW] 비-숫자 rank "abc" → PRIZE_STRUCTURE_INVALID (22P02 누출 차단)');

-- ── [NEW] 신뢰경계: 소수 rank (1.5::int 도 22P02) ─────────────────────────────
SELECT throws_like(                                                          -- [10]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":1.5,"amount":100}]'::jsonb) $$,
  '%PRIZE_STRUCTURE_INVALID%',
  '[NEW] 소수 rank 1.5 → PRIZE_STRUCTURE_INVALID (22P02 누출 차단)');

-- ── [NEW] 신뢰경계: SQL NULL p_prizes (array 가드 우회 silent clear 차단) ──────
SELECT throws_like(                                                          -- [11]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       NULL::jsonb) $$,
  '%PRIZE_STRUCTURE_INVALID%',
  '[NEW] NULL p_prizes → PRIZE_STRUCTURE_INVALID (silent clear 차단)');

-- ── ④ completed 대회 ─────────────────────────────────────────────────────────
SELECT throws_like(                                                          -- [12]
  $$ SELECT public.ops_set_prize_structure(
       (current_setting('ops.t2_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       '[{"rank":1,"amount":100}]'::jsonb) $$,
  '%INVALID_STATUS%',
  '④ completed 대회 → INVALID_STATUS');

-- ── ⑤ RLS SELECT ─────────────────────────────────────────────────────────────
-- ②③[NEW] 는 예외→ops_prizes 미변경; 현재 상태: rank 1·2 (replace-all 재설정 후 2개)
SELECT is(                                                                   -- [13]
  (SELECT count(*)::int FROM public.ops_prizes
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  2,
  '⑤ RLS SELECT: owner 2개 행 보임 (rank 1·2)');

-- outsider: is_ops_member=false → 0행
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT is(                                                                   -- [14]
  (SELECT count(*)::int FROM public.ops_prizes
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  0,
  '⑤ RLS SELECT: outsider 0행 (is_ops_member=false)');

-- ── ⑥ anon EXECUTE 거부 ──────────────────────────────────────────────────────
SELECT ok(                                                                   -- [15]
  NOT has_function_privilege('anon', 'public.ops_set_prize_structure(uuid,uuid,jsonb)', 'EXECUTE'),
  '⑥ anon set_prize_structure EXECUTE 거부');

SELECT * FROM finish();
ROLLBACK;
