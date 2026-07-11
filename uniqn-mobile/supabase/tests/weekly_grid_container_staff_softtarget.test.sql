-- ============================================================
-- 주간 배치 그리드 — Phase 3 컨테이너 카운터 분기 + soft-target 쓰기 (R1/E7/E5/S2)
-- ============================================================
-- 검증:
--   1. add_direct_staff 가 컨테이너에 work_log 생성(컨테이너 배치 허용)
--   2. R1: 컨테이너 add 후 filled_positions 불변(0) — chk_container_no_filled 위반 없음
--   3. E7: 컨테이너 remove 후 filled_positions 불변(0) — add 와 대칭 skip
--   4. 무회귀: 일반(비컨테이너) 공고 add 후 filled +1
--   5. 무회귀: 일반 공고 remove 후 filled -1
--   6. E5: set_venue_soft_target 날짜키 YYYY-MM-DD 정규화(2026-7-5 → 2026-07-05)
--   7. set_venue_soft_target count=0 → softTargets 키 제거
--   8. set_venue_soft_target 음수 count 거부
--   9. 무회귀: 일반 공고 정원도달(total=1) → capacity_full
--  10. 무회귀: 정원 해제(remove) → active 재개방
--  11. 3a deny: 무관 사용자(jwt sub=타 uuid) add_direct_staff → PERMISSION_DENIED
--  12. 3a deny: 무관 사용자 set_venue_soft_target → PERMISSION_DENIED
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_wgst_*@test.local)
-- 참고: anon REVOKE(S2)는 has_function_privilege 로 별도 실측(마이그 적용 검증 단계).
-- ============================================================

BEGIN;
SELECT plan(12);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_container uuid;
  v_normal uuid := gen_random_uuid();
  v_cap uuid := gen_random_uuid();
  v_d text := '2026-07-01';
  v_add jsonb;
  v_wl_container uuid;
  v_wl_normal uuid;
  v_wl_cap uuid;
  v_filled int;
  v_cnt int;
  v_neg_rejected boolean := false;
  v_deny_add boolean := false;
  v_deny_st boolean := false;
BEGIN
  -- 0. seed: owner(employer) + staff + workspace(owner 소유)
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wgst_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"WGST_OWNER"}'::jsonb, now(), now()),
    (v_staff, '__sql_fixture_wgst_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"WGST_STAFF"}'::jsonb, now(), now());
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wgst_owner@test.local', 'WGST_OWNER', 'employer'::user_role, true, now(), now()),
    (v_staff, '__sql_fixture_wgst_staff@test.local', 'WGST_STAFF', 'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  -- 무관 사용자(workspace 비멤버, 비콜라보, 비owner, 비admin) — 3a deny-case 용
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_outsider, '__sql_fixture_wgst_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"WGST_OUTSIDER"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_outsider, '__sql_fixture_wgst_outsider@test.local', 'WGST_OUTSIDER', 'staff'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_wgst_ws', v_owner, now(), now());

  -- 인증 컨텍스트 = owner (SECDEF 함수의 auth.uid())
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- 컨테이너(멱등 RPC) + 일반 active 공고(total=2) 생성
  v_container := (public.get_or_create_venue_container(v_ws, '운영처ST', 'dated') ->> 'containerId')::uuid;
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_normal, v_owner, v_ws, '__sql_fixture_wgst_normal', 'active'::posting_status, 'regular'::posting_type, 2, 0, now(), now());

  -- (1/2) 컨테이너 add: work_log 생성 + filled 0 유지(CHECK 위반 없음)
  v_add := public.add_direct_staff(
    v_container, v_staff,
    jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '18:00', 'role', 'dealer'))
  );
  v_wl_container := (v_add->'workLogIds'->>0)::uuid;
  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_container;
  SELECT count(*) INTO v_cnt FROM public.work_logs
   WHERE job_posting_id = v_container AND date = v_d AND status NOT IN ('cancelled', 'no_show');
  INSERT INTO _t VALUES ('add_container_filled', v_filled::text), ('add_container_wlcount', v_cnt::text);

  -- (3) 컨테이너 remove: filled 0 유지(E7 대칭)
  PERFORM public.remove_direct_staff(v_wl_container);
  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_container;
  INSERT INTO _t VALUES ('rm_container_filled', v_filled::text);

  -- (4/5) 일반 공고: filled +1 → -1 (무회귀)
  v_add := public.add_direct_staff(
    v_normal, v_staff,
    jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '18:00', 'role', 'dealer'))
  );
  v_wl_normal := (v_add->'workLogIds'->>0)::uuid;
  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_normal;
  INSERT INTO _t VALUES ('normal_filled_after_add', v_filled::text);
  PERFORM public.remove_direct_staff(v_wl_normal);
  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_normal;
  INSERT INTO _t VALUES ('normal_filled_after_rm', v_filled::text);

  -- (6) soft target 쓰기 + 날짜키 정규화: 2026-7-5(비패딩) → 2026-07-05
  PERFORM public.set_venue_soft_target(v_container, '2026-07-01', 3);
  PERFORM public.set_venue_soft_target(v_container, '2026-7-5', 4);
  INSERT INTO _t
    SELECT 'st_0705', (schedule->'softTargets'->>'2026-07-05') FROM public.job_postings WHERE id = v_container;

  -- (7) count=0 → 키 제거
  PERFORM public.set_venue_soft_target(v_container, '2026-07-01', 0);
  INSERT INTO _t
    SELECT 'st_0701_present', (schedule->'softTargets' ? '2026-07-01')::text FROM public.job_postings WHERE id = v_container;

  -- (8) 음수 거부
  BEGIN
    PERFORM public.set_venue_soft_target(v_container, '2026-07-02', -1);
  EXCEPTION WHEN others THEN v_neg_rejected := true;
  END;
  INSERT INTO _t VALUES ('st_neg_rejected', v_neg_rejected::text);

  -- (9/10) capacity_full↔active 전이 무회귀(일반 공고 total=1)
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_cap, v_owner, v_ws, '__sql_fixture_wgst_cap', 'active'::posting_status, 'regular'::posting_type, 1, 0, now(), now());
  v_add := public.add_direct_staff(
    v_cap, v_staff,
    jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '18:00', 'role', 'dealer'))
  );
  v_wl_cap := (v_add->'workLogIds'->>0)::uuid;
  INSERT INTO _t SELECT 'cap_full', status::text FROM public.job_postings WHERE id = v_cap;
  PERFORM public.remove_direct_staff(v_wl_cap);
  INSERT INTO _t SELECT 'cap_reopen', status::text FROM public.job_postings WHERE id = v_cap;

  -- (11/12) 3a deny-case: 무관 사용자(jwt sub=outsider) PERMISSION_DENIED
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.add_direct_staff(
      v_normal, v_staff,
      jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '18:00', 'role', 'dealer'))
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny_add := true; END IF;
  END;
  INSERT INTO _t VALUES ('deny_add', v_deny_add::text);
  BEGIN
    PERFORM public.set_venue_soft_target(v_container, v_d, 3);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny_st := true; END IF;
  END;
  INSERT INTO _t VALUES ('deny_st', v_deny_st::text);
END $$;

SELECT is((SELECT v FROM _t WHERE k = 'add_container_wlcount'), '1',
  'add_direct_staff: 컨테이너에 work_log 생성(배치 허용)');
SELECT is((SELECT v FROM _t WHERE k = 'add_container_filled'), '0',
  'R1: 컨테이너 add 후 filled_positions 불변(0) — chk_container_no_filled 위반 없음');
SELECT is((SELECT v FROM _t WHERE k = 'rm_container_filled'), '0',
  'E7: 컨테이너 remove 후 filled_positions 불변(0) — add 와 대칭 skip');
SELECT is((SELECT v FROM _t WHERE k = 'normal_filled_after_add'), '1',
  '무회귀: 일반 공고 add 후 filled +1');
SELECT is((SELECT v FROM _t WHERE k = 'normal_filled_after_rm'), '0',
  '무회귀: 일반 공고 remove 후 filled -1');
SELECT is((SELECT v FROM _t WHERE k = 'st_0705'), '4',
  'E5: set_venue_soft_target 날짜키 정규화(2026-7-5 → 2026-07-05)=4');
SELECT is((SELECT v FROM _t WHERE k = 'st_0701_present'), 'false',
  'count=0 → softTargets 키 제거');
SELECT is((SELECT v FROM _t WHERE k = 'st_neg_rejected'), 'true',
  '음수 count 거부');
SELECT is((SELECT v FROM _t WHERE k = 'cap_full'), 'capacity_full',
  '무회귀: 일반 공고 정원도달(total=1) → capacity_full');
SELECT is((SELECT v FROM _t WHERE k = 'cap_reopen'), 'active',
  '무회귀: 정원 해제(remove) → active 재개방');
SELECT is((SELECT v FROM _t WHERE k = 'deny_add'), 'true',
  '3a deny: 무관 사용자 add_direct_staff → PERMISSION_DENIED');
SELECT is((SELECT v FROM _t WHERE k = 'deny_st'), 'true',
  '3a deny: 무관 사용자 set_venue_soft_target → PERMISSION_DENIED');

SELECT * FROM finish();
ROLLBACK;
