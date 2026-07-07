-- ops 1e M2(후반) — ops_add_staff(수동 추가) + ops_remove_staff(cascade-clear 삭제) +
--   ops_assign_table_staff(딜러 테이블 배정, move 시맨틱) 검증.
-- 스펙: docs/superpowers/specs/2026-07-06-ops-1e-staff-integration-design.md §5.1 6·7항.
-- 패턴: ops_staff_link_import.test.sql(postgres 역할 직접 시드 + set_config 보관 + throws_like 게이트별 메시지,
--   단일 트랜잭션 now() 고정 → 1차 이벤트 id 배제로 2차 이벤트 특정), ops_staff_schema.test.sql(postgres 직접
--   ops_tables/ops_staff 시드, 백스톱 throws_ok 23505).
-- ⚠️ SEC-1 롤 게이트(적대검증): actor가 대회 owner(is_ops_member=true)라도 role NOT IN('employer','admin')
--   이면 ops_add_staff 는 거부한다(이름 하베스팅 프리미티브 차단 — search_users_by_phone 신뢰경계 일치).
--   membership 게이트(대회 운영 권한 없음)와 다른 메시지이므로 정확 문구로 구분 단언한다.
-- ⚠️ COALESCE(status,'active') 회귀(적대검증 E1/L3-1/F3): status 컬럼은 nullable(기본값 'active') —
--   NULL 인 활성 사용자도 추가 가능해야 한다(strict 비교였다면 누락되는 회귀).
-- ⚠️ grants(anon REVOKE)는 Task 4 이후 — 이 파일은 postgres/ops_test_set_user(authenticated) 경유만 검증.

BEGIN;
SELECT plan(31);

-- ════════════════════════════════════════════════════════════════════════════
-- 시드: ops_test_seed() 기본(owner/member/outsider/tournament/table_id=T1)
--   + 후보 스태프 5인(cand1~5) + SEC-1용 staff 롤 대회장(staff_owner) + 그의 대회(t3)
--   + 메인 대회 2번째 테이블(T2, move 시맨틱용).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  s              RECORD;
  v_cand1        uuid := gen_random_uuid();  -- [add]1 정상 추가(member 액터)
  v_cand2        uuid := gen_random_uuid();  -- [add]2 status=NULL 흡수 + [assign] 로스터 멤버
  v_cand3        uuid := gen_random_uuid();  -- [add]4 is_active=false
  v_cand4        uuid := gen_random_uuid();  -- [remove]7 교차대회 ops_staff 시드 대상
  v_cand5        uuid := gen_random_uuid();  -- [assign]10 로스터 외
  v_staff_owner  uuid := gen_random_uuid();  -- [add]5 SEC-1: staff 롤 대회 owner
  v_t3           uuid := gen_random_uuid();  -- staff_owner 소유 대회(SEC-1 + 교차대회)
  v_t2table      uuid := gen_random_uuid();  -- 메인 대회 T2
BEGIN
  SELECT * INTO s FROM ops_test_seed();

  PERFORM set_config('role', 'postgres', true);

  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (v_cand1,       'ops_ra_cand1_' || v_cand1             || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_cand2,       'ops_ra_cand2_' || v_cand2             || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_cand3,       'ops_ra_cand3_' || v_cand3             || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_cand4,       'ops_ra_cand4_' || v_cand4             || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_cand5,       'ops_ra_cand5_' || v_cand5             || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_staff_owner, 'ops_ra_staffowner_' || v_staff_owner  || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

  -- status: cand1=기본값'active', cand2=NULL(COALESCE 흡수 대상), cand3=is_active false, cand4/cand5/staff_owner=active
  INSERT INTO public.users (id, email, name, nickname, role, is_active, status, created_at, updated_at)
  VALUES
    (v_cand1,       (SELECT email FROM auth.users WHERE id = v_cand1),       '후보스태프1', NULL, 'staff'::user_role, true,  'active', now(), now()),
    (v_cand2,       (SELECT email FROM auth.users WHERE id = v_cand2),       '후보스태프2', NULL, 'staff'::user_role, true,  NULL,     now(), now()),
    (v_cand3,       (SELECT email FROM auth.users WHERE id = v_cand3),       '후보스태프3', NULL, 'staff'::user_role, false, 'active', now(), now()),
    (v_cand4,       (SELECT email FROM auth.users WHERE id = v_cand4),       '후보스태프4', NULL, 'staff'::user_role, true,  'active', now(), now()),
    (v_cand5,       (SELECT email FROM auth.users WHERE id = v_cand5),       '후보스태프5', NULL, 'staff'::user_role, true,  'active', now(), now()),
    (v_staff_owner, (SELECT email FROM auth.users WHERE id = v_staff_owner), '스태프대회장', NULL, 'staff'::user_role, true, 'active', now(), now());

  -- t3: staff 롤 사용자가 owner인 대회 — is_ops_member=true(owner_id 매칭)이지만 role 게이트는 통과 못함(SEC-1).
  INSERT INTO public.ops_tournaments (
    id, owner_id, job_posting_id, name, game_type, starting_chips, registration_open, next_entry_seq
  ) VALUES (
    v_t3, v_staff_owner, NULL, 'staff owner cup', 'NLH', 30000, true, 0
  );

  -- 메인 대회 2번째 테이블(T2) — move 시맨틱(T1→T2 재배정) 검증용.
  INSERT INTO public.ops_tables (id, tournament_id, table_no, status, lock_type)
  VALUES (v_t2table, s.tournament_id, 2, 'open', 'none');

  PERFORM set_config('ops.owner_id',       s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',      s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',    s.outsider_id::text,   true);
  PERFORM set_config('ops.t_id',           s.tournament_id::text, true);
  PERFORM set_config('ops.t1_id',          s.table_id::text,      true);
  PERFORM set_config('ops.t2table_id',     v_t2table::text,       true);
  PERFORM set_config('ops.cand1_id',       v_cand1::text,         true);
  PERFORM set_config('ops.cand2_id',       v_cand2::text,         true);
  PERFORM set_config('ops.cand3_id',       v_cand3::text,         true);
  PERFORM set_config('ops.cand4_id',       v_cand4::text,         true);
  PERFORM set_config('ops.cand5_id',       v_cand5::text,         true);
  PERFORM set_config('ops.staff_owner_id', v_staff_owner::text,   true);
  PERFORM set_config('ops.t3_id',          v_t3::text,            true);
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [add] 1) 워크스페이스 멤버(employer 롤)가 활성 사용자(cand1) 추가
--   → 행 생성(source='manual', 이름 서버측 스냅샷=users.name, role 기본값 dealer) + 'staff_added' 이벤트.
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);

DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_add_staff(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.member_id'))::uuid,
    (current_setting('ops.cand1_id'))::uuid
  ) INTO r;
  PERFORM set_config('ops.r1_opsStaffId', r->>'opsStaffId', true);
END $$;

SELECT is(                                                                   -- [1]
  (SELECT count(*)::int FROM public.ops_staff
    WHERE id = (current_setting('ops.r1_opsStaffId'))::uuid
      AND tournament_id = (current_setting('ops.t_id'))::uuid
      AND staff_id = (current_setting('ops.cand1_id'))::uuid),
  1, '[add] 1) 반환된 opsStaffId로 행 조회 1건(대회/스태프 일치)');

SELECT ok(                                                                   -- [2]
  (SELECT source = 'manual' AND staff_name = '후보스태프1' AND role = 'dealer'
   FROM public.ops_staff WHERE id = (current_setting('ops.r1_opsStaffId'))::uuid),
  '[add] 1) source=manual, staff_name=users.name 스냅샷, role 기본값 dealer');

SELECT is(                                                                   -- [3]
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'staff_added'),
  1, '[add] 1) staff_added 이벤트 1행');

SELECT is(                                                                   -- [4]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'staff_added'),
  jsonb_build_object('staff_id', (current_setting('ops.cand1_id'))::uuid, 'role', 'dealer'),
  '[add] 1) 이벤트 payload {staff_id, role} 정확');

-- ────────────────────────────────────────────────────────────────────────────
-- [add] 2) status=NULL 인 활성 사용자(cand2) 추가 → 성공(COALESCE(status,'active') 흡수 — 적대검증 E1/L3-1/F3 회귀).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_add_staff(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.member_id'))::uuid,
    (current_setting('ops.cand2_id'))::uuid
  ) INTO r;
  PERFORM set_config('ops.cand2_ops_staff_id', r->>'opsStaffId', true);
END $$;

SELECT is(                                                                   -- [5]
  (SELECT count(*)::int FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid
      AND staff_id = (current_setting('ops.cand2_id'))::uuid),
  1, '[add] 2) status=NULL 활성 사용자도 추가 성공(COALESCE 흡수)');

-- ────────────────────────────────────────────────────────────────────────────
-- [add] 3) 동일인(cand1) 재추가 → DUPLICATE_STAFF
-- ────────────────────────────────────────────────────────────────────────────
SELECT throws_like(                                                          -- [6]
  $$ SELECT public.ops_add_staff(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.member_id'))::uuid,
       (current_setting('ops.cand1_id'))::uuid) $$,
  '%DUPLICATE_STAFF%',
  '[add] 3) 동일인 재추가 거부(DUPLICATE_STAFF)');

-- ────────────────────────────────────────────────────────────────────────────
-- [add] 4) 비활성(is_active=false) 대상(cand3) 추가 → STAFF_NOT_FOUND
-- ────────────────────────────────────────────────────────────────────────────
SELECT throws_like(                                                          -- [7]
  $$ SELECT public.ops_add_staff(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.member_id'))::uuid,
       (current_setting('ops.cand3_id'))::uuid) $$,
  '%STAFF_NOT_FOUND%',
  '[add] 4) 비활성 사용자 추가 거부(STAFF_NOT_FOUND)');

-- ────────────────────────────────────────────────────────────────────────────
-- [add] 5) actor가 staff 롤(비 employer/admin)인 대회 owner(t3 소유) → PERMISSION_DENIED
--   (적대검증 SEC-1 — 이름 하베스팅 프리미티브 차단, membership 게이트와 다른 정확 문구로 구분).
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.staff_owner_id'))::uuid);

SELECT throws_like(                                                          -- [8]
  $$ SELECT public.ops_add_staff(
       (current_setting('ops.t3_id'))::uuid,
       (current_setting('ops.staff_owner_id'))::uuid,
       (current_setting('ops.cand4_id'))::uuid) $$,
  '%PERMISSION_DENIED: 스태프 추가 권한이 없습니다%',
  '[add] 5) staff 롤 대회 owner → 롤 게이트로 거부(멤버십 게이트 아님, 정확 문구 단언)');

SELECT is(                                                                   -- [9]
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.t3_id'))::uuid),
  0, '[add] 5) 거부 후 t3 ops_staff 0행(상태 불변)');

-- ════════════════════════════════════════════════════════════════════════════
-- [remove] 준비: postgres 직접 UPDATE로 T1에 cand1 배정 시뮬레이션(cascade-clear 대상 마련).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tables SET assigned_staff_id = (current_setting('ops.cand1_id'))::uuid
   WHERE id = (current_setting('ops.t1_id'))::uuid;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [remove] 6) 배정 중(T1 assigned) 스태프(cand1) 제거
--   → ops_tables.assigned_staff_id NULL 실측 + 'staff_removed' payload cleared_table_ids=[T1].
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_remove_staff(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    (current_setting('ops.r1_opsStaffId'))::uuid
  ) INTO r;
  PERFORM set_config('ops.r6_success', (r->>'success'), true);
  PERFORM set_config('ops.r6_cleared', (r->'clearedTableIds')::text, true);
END $$;

SELECT is(current_setting('ops.r6_success')::boolean, true,                  -- [10]
  '[remove] 6) 반환값 success=true');

SELECT is(                                                                   -- [11]
  current_setting('ops.r6_cleared')::jsonb,
  to_jsonb(ARRAY[(current_setting('ops.t1_id'))::uuid]),
  '[remove] 6) 반환값 clearedTableIds=[T1]');

SELECT is(                                                                   -- [12]
  (SELECT assigned_staff_id FROM public.ops_tables WHERE id = (current_setting('ops.t1_id'))::uuid),
  NULL::uuid, '[remove] 6) T1.assigned_staff_id NULL(cascade-clear 실측)');

SELECT is(                                                                   -- [13]
  (SELECT count(*)::int FROM public.ops_staff WHERE id = (current_setting('ops.r1_opsStaffId'))::uuid),
  0, '[remove] 6) ops_staff 행 삭제됨');

SELECT is(                                                                   -- [14]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'staff_removed'),
  jsonb_build_object('staff_id', (current_setting('ops.cand1_id'))::uuid,
                     'cleared_table_ids', to_jsonb(ARRAY[(current_setting('ops.t1_id'))::uuid])),
  '[remove] 6) staff_removed 이벤트 payload {staff_id, cleared_table_ids} 정확');

-- ────────────────────────────────────────────────────────────────────────────
-- [remove] 7) 타 대회(t3) 소속 ops_staff_id를 메인 대회(t) 컨텍스트로 제거 시도 → STAFF_NOT_FOUND
--   준비: postgres 직접 INSERT로 t3에 ops_staff 1행 시드(cand4).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source)
  VALUES ((current_setting('ops.t3_id'))::uuid, (current_setting('ops.cand4_id'))::uuid,
          'dealer', '후보스태프4', 'manual')
  RETURNING id INTO v_id;
  PERFORM set_config('ops.t3_ops_staff_id', v_id::text, true);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [15]
  $$ SELECT public.ops_remove_staff(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       (current_setting('ops.t3_ops_staff_id'))::uuid) $$,
  '%STAFF_NOT_FOUND%',
  '[remove] 7) 타 대회 ops_staff_id → STAFF_NOT_FOUND');

-- ────────────────────────────────────────────────────────────────────────────
-- [assign] 8) 로스터 멤버(cand2)를 T1에 배정 → assigned_staff_id 반영 + 'table_staff_assigned' 이벤트.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_assign_table_staff(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    (current_setting('ops.t1_id'))::uuid,
    (current_setting('ops.cand2_id'))::uuid
  ) INTO r;
  PERFORM set_config('ops.r8_staffId', COALESCE(r->>'staffId', '<NULL>'), true);
END $$;

SELECT is(                                                                   -- [16]
  NULLIF(current_setting('ops.r8_staffId'), '<NULL>')::uuid,
  (current_setting('ops.cand2_id'))::uuid,
  '[assign] 8) 반환값 staffId=cand2');

SELECT is(                                                                   -- [17]
  (SELECT assigned_staff_id FROM public.ops_tables WHERE id = (current_setting('ops.t1_id'))::uuid),
  (current_setting('ops.cand2_id'))::uuid,
  '[assign] 8) T1.assigned_staff_id=cand2 반영');

SELECT is(                                                                   -- [18]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'table_staff_assigned'),
  jsonb_build_object('table_id', (current_setting('ops.t1_id'))::uuid,
                     'staff_id', (current_setting('ops.cand2_id'))::uuid,
                     'previous_table_id', NULL::uuid, 'replaced_staff_id', NULL::uuid),
  '[assign] 8) table_staff_assigned 이벤트 payload(첫 배정: previous/replaced 모두 NULL) 정확');

-- 1차 table_staff_assigned 이벤트 id 캡처(같은 트랜잭션 내 now() 고정 → 2차 이벤트 특정에 배제 필터 필요).
DO $$
DECLARE v_eid uuid;
BEGIN
  SELECT id INTO v_eid FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'table_staff_assigned';
  PERFORM set_config('ops.table_staff_assigned_event1_id', v_eid::text, true);
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [assign] 9) 같은 스태프(cand2)를 T2로 재배정 → T1 자동 해제 + T2 배정
--   (move 시맨틱, payload previous_table_id=T1).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_assign_table_staff(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    (current_setting('ops.t2table_id'))::uuid,
    (current_setting('ops.cand2_id'))::uuid
  ) INTO r;
  PERFORM set_config('ops.r9_staffId', COALESCE(r->>'staffId', '<NULL>'), true);
END $$;

SELECT is(                                                                   -- [19]
  NULLIF(current_setting('ops.r9_staffId'), '<NULL>')::uuid,
  (current_setting('ops.cand2_id'))::uuid,
  '[assign] 9) 반환값 staffId=cand2(T2)');

SELECT is(                                                                   -- [20]
  (SELECT assigned_staff_id FROM public.ops_tables WHERE id = (current_setting('ops.t1_id'))::uuid),
  NULL::uuid, '[assign] 9) T1 자동 해제(move 시맨틱)');

SELECT is(                                                                   -- [21]
  (SELECT assigned_staff_id FROM public.ops_tables WHERE id = (current_setting('ops.t2table_id'))::uuid),
  (current_setting('ops.cand2_id'))::uuid,
  '[assign] 9) T2.assigned_staff_id=cand2 반영');

SELECT is(                                                                   -- [22]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'table_staff_assigned'
      AND id <> (current_setting('ops.table_staff_assigned_event1_id'))::uuid),
  jsonb_build_object('table_id', (current_setting('ops.t2table_id'))::uuid,
                     'staff_id', (current_setting('ops.cand2_id'))::uuid,
                     'previous_table_id', (current_setting('ops.t1_id'))::uuid,
                     'replaced_staff_id', NULL::uuid),
  '[assign] 9) 2차 이벤트 payload previous_table_id=T1(1차 이벤트 id 배제로 특정)');

-- ────────────────────────────────────────────────────────────────────────────
-- [assign] 10) 로스터 외 사용자(cand5)를 T1에 배정 → STAFF_NOT_IN_ROSTER
-- ────────────────────────────────────────────────────────────────────────────
SELECT throws_like(                                                          -- [23]
  $$ SELECT public.ops_assign_table_staff(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       (current_setting('ops.t1_id'))::uuid,
       (current_setting('ops.cand5_id'))::uuid) $$,
  '%STAFF_NOT_IN_ROSTER%',
  '[assign] 10) 로스터 외 사용자 배정 거부(STAFF_NOT_IN_ROSTER)');

-- ────────────────────────────────────────────────────────────────────────────
-- [assign] 11) T2를 NULL로 해제 → assigned_staff_id NULL + 'table_staff_unassigned'.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_assign_table_staff(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    (current_setting('ops.t2table_id'))::uuid,
    NULL::uuid
  ) INTO r;
  PERFORM set_config('ops.r11_staffId', COALESCE(r->>'staffId', '<NULL>'), true);
END $$;

SELECT is(                                                                   -- [24]
  NULLIF(current_setting('ops.r11_staffId'), '<NULL>')::uuid, NULL::uuid,
  '[assign] 11) 반환값 staffId=NULL(해제)');

SELECT is(                                                                   -- [25]
  (SELECT assigned_staff_id FROM public.ops_tables WHERE id = (current_setting('ops.t2table_id'))::uuid),
  NULL::uuid, '[assign] 11) T2.assigned_staff_id NULL 반영');

SELECT is(                                                                   -- [26]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'table_staff_unassigned'),
  jsonb_build_object('table_id', (current_setting('ops.t2table_id'))::uuid,
                     'staff_id', (current_setting('ops.cand2_id'))::uuid),
  '[assign] 11) table_staff_unassigned 이벤트 payload {table_id, staff_id} 정확');

-- ────────────────────────────────────────────────────────────────────────────
-- [assign] 12) 타 대회(t3) 컨텍스트로 메인 대회 소속 테이블(T1) 배정 시도 → TABLE_NOT_FOUND.
--   staff_owner 는 t3 owner라 멤버십 게이트는 통과(assign RPC는 role 게이트 없음).
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.staff_owner_id'))::uuid);
SELECT throws_like(                                                          -- [27]
  $$ SELECT public.ops_assign_table_staff(
       (current_setting('ops.t3_id'))::uuid,
       (current_setting('ops.staff_owner_id'))::uuid,
       (current_setting('ops.t1_id'))::uuid,
       NULL::uuid) $$,
  '%TABLE_NOT_FOUND%',
  '[assign] 12) 타 대회 컨텍스트의 테이블 조회 실패(TABLE_NOT_FOUND)');

-- ────────────────────────────────────────────────────────────────────────────
-- [assign] 13) (리뷰 후속 T3-M1) 점유 테이블 축출 — 이미 배정된 테이블(T1=cand2)에 다른 로스터
--   멤버(cand5)를 배정 → T1.assigned_staff_id=cand5 + 'table_staff_assigned' 이벤트 payload의
--   replaced_staff_id=cand2(축출된 X). 준비: postgres 직접 INSERT로 cand5를 메인 대회 로스터에 편입
--   (앞선 [assign]10은 cand5가 로스터 밖일 때의 거부만 검증했으므로 순서상 이후 편입해도 회귀 없음) +
--   T1에 cand2 배정.
-- ⚠️ 기존 [assign] 8/9/11 은 전부 빈 테이블 대상이라 v_replaced 가 항상 NULL — replaced_staff_id≠NULL
--   경로(점유 테이블에 다른 딜러가 있던 경우의 교대)가 무검증이었다. 같은 트랜잭션 내 now() 고정이라
--   table_staff_assigned 이벤트 3건(8/9차 + 이번)의 created_at 이 동일 — 기존 2건의 id 를 미리 캡처해
--   배제 필터로 3차 이벤트를 특정한다.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_known_ids uuid[];
BEGIN
  PERFORM set_config('role', 'postgres', true);

  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source)
  VALUES ((current_setting('ops.t_id'))::uuid, (current_setting('ops.cand5_id'))::uuid,
          'floor', '후보스태프5', 'manual');

  UPDATE public.ops_tables SET assigned_staff_id = (current_setting('ops.cand2_id'))::uuid
   WHERE id = (current_setting('ops.t1_id'))::uuid;

  SELECT array_agg(id) INTO v_known_ids FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'table_staff_assigned';
  PERFORM set_config('ops.tsa_known_ids', v_known_ids::text, true);
END $$;

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_assign_table_staff(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    (current_setting('ops.t1_id'))::uuid,
    (current_setting('ops.cand5_id'))::uuid
  ) INTO r;
  PERFORM set_config('ops.r13_staffId', COALESCE(r->>'staffId', '<NULL>'), true);
END $$;

SELECT is(                                                                   -- [28]
  NULLIF(current_setting('ops.r13_staffId'), '<NULL>')::uuid,
  (current_setting('ops.cand5_id'))::uuid,
  '[assign] 13) 점유 테이블 축출: 반환값 staffId=cand5');

SELECT is(                                                                   -- [29]
  (SELECT assigned_staff_id FROM public.ops_tables WHERE id = (current_setting('ops.t1_id'))::uuid),
  (current_setting('ops.cand5_id'))::uuid,
  '[assign] 13) T1.assigned_staff_id=cand5 반영(cand2 축출)');

SELECT is(                                                                   -- [30]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'table_staff_assigned'
      AND id <> ALL((current_setting('ops.tsa_known_ids'))::uuid[])),
  jsonb_build_object('table_id', (current_setting('ops.t1_id'))::uuid,
                     'staff_id', (current_setting('ops.cand5_id'))::uuid,
                     'previous_table_id', NULL::uuid,
                     'replaced_staff_id', (current_setting('ops.cand2_id'))::uuid),
  '[assign] 13) table_staff_assigned 이벤트 payload.replaced_staff_id=cand2(축출된 X) 정확');

-- ────────────────────────────────────────────────────────────────────────────
-- [백스톱] 14) postgres 롤로 두 테이블(T1, T2)에 동일 staff 직접 UPDATE
--   → uq_ops_tables_assigned_staff 위반(23505). RPC move 시맨틱의 최종 방어선 실동작 확인.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tables SET assigned_staff_id = (current_setting('ops.outsider_id'))::uuid
   WHERE id = (current_setting('ops.t1_id'))::uuid;
END $$;

SELECT throws_ok(                                                            -- [31]
  $$ UPDATE public.ops_tables SET assigned_staff_id = (current_setting('ops.outsider_id'))::uuid
      WHERE id = (current_setting('ops.t2table_id'))::uuid $$,
  '23505', NULL,
  '[백스톱] 14) 동일 대회 내 동일 staff 중복 테이블 배정 UPDATE 거부(partial UNIQUE)');

SELECT * FROM finish();
ROLLBACK;
