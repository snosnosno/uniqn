-- ============================================================
-- 공고그리드 + 주문서 보안 하드닝 회귀 (2026-07-17)
-- 마이그: 20260717093000_grid_order_sheet_security_hardening.sql
-- ============================================================
-- 검증:
--   [HIGH-1] orphan 공고(owner_id=NULL) + 무관 사용자
--     1. add_direct_staff → PERMISSION_DENIED (fail-open 차단)
--     2. remove_direct_staff → PERMISSION_DENIED
--     3. set_venue_soft_target → PERMISSION_DENIED
--     4. 무회귀: 정상 공고 + owner add → filled +1 (게이트 오차단 없음)
--   [HIGH-2] 대회 승인 권한
--     5. employer(비admin) INSERT tournament approved → 차단
--     6. employer INSERT tournament pending → 허용(정상 생성 무회귀)
--     7. admin INSERT tournament approved → 허용
--     8. service(auth.uid()=NULL, Edge Function) pending→approved UPDATE → 허용
--   [M-2] XSS 서버 경계
--     9. work_logs INSERT notes='<script>' → 차단
--    10. job_postings INSERT contact_phone='javascript:...' → 차단
--   [M-1] 구조: jp_insert 정책에 owner_id 바인딩 존재
--    11. jp_insert WITH CHECK 에 owner_id 참조 존재
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_gosh_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(11);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_normal uuid := gen_random_uuid();
  v_container uuid;
  v_d text := '2026-07-01';
  v_add jsonb;
  v_wl_normal uuid;
  v_filled int;
  v_deny_add boolean := false;
  v_deny_rm boolean := false;
  v_deny_st boolean := false;
  v_h2_emp_approved_blocked boolean := false;
  v_h2_emp_pending_ok boolean := false;
  v_h2_admin_approved_ok boolean := false;
  v_h2_service_ok boolean := false;
  v_m2_wl_blocked boolean := false;
  v_m2_jp_blocked boolean := false;
  v_tid uuid;
BEGIN
  -- ── seed: owner(employer) + staff + outsider + admin + workspace ──
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_gosh_owner@test.local',    'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"GOSH_OWNER"}'::jsonb, now(), now()),
    (v_staff,    '__sql_fixture_gosh_staff@test.local',    'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"GOSH_STAFF"}'::jsonb, now(), now()),
    (v_outsider, '__sql_fixture_gosh_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"GOSH_OUT"}'::jsonb,   now(), now()),
    (v_admin,    '__sql_fixture_gosh_admin@test.local',    'authenticated', 'authenticated', '', '{"role":"admin"}'::jsonb,    '{"name":"GOSH_ADMIN"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_gosh_owner@test.local',    'GOSH_OWNER', 'employer'::user_role, true, now(), now()),
    (v_staff,    '__sql_fixture_gosh_staff@test.local',    'GOSH_STAFF', 'staff'::user_role,    true, now(), now()),
    (v_outsider, '__sql_fixture_gosh_outsider@test.local', 'GOSH_OUT',   'staff'::user_role,    true, now(), now()),
    (v_admin,    '__sql_fixture_gosh_admin@test.local',    'GOSH_ADMIN', 'admin'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_gosh_ws', v_owner, now(), now());

  -- 인증 컨텍스트 = owner
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- 정상 공고 + 컨테이너 생성
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, created_at, updated_at)
  VALUES (v_normal, v_owner, v_ws, '__sql_fixture_gosh_normal', 'active'::posting_status, 'regular'::posting_type, 5, 0, now(), now());
  v_container := (public.get_or_create_venue_container(v_ws, '운영처GOSH', 'dated') ->> 'containerId')::uuid;

  -- (4) 무회귀: owner add → filled +1, work_log 캡처(remove 테스트용)
  v_add := public.add_direct_staff(
    v_normal, v_staff,
    jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '18:00', 'role', 'dealer'))
  );
  v_wl_normal := (v_add->'workLogIds'->>0)::uuid;
  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_normal;
  INSERT INTO _t VALUES ('reg_owner_add_filled', v_filled::text);

  -- ── HIGH-1: 두 공고를 orphan(owner_id=NULL)으로 만든다 ──
  UPDATE public.job_postings SET owner_id = NULL WHERE id IN (v_normal, v_container);

  -- 인증 컨텍스트 = 무관 사용자(비멤버·비콜라보·비owner·비admin)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);

  -- (1) orphan add → PERMISSION_DENIED
  BEGIN
    PERFORM public.add_direct_staff(
      v_normal, v_staff,
      jsonb_build_array(jsonb_build_object('date', v_d, 'timeSlot', '19:00', 'role', 'dealer'))
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny_add := true; END IF;
  END;
  INSERT INTO _t VALUES ('h1_deny_add', v_deny_add::text);

  -- (2) orphan remove → PERMISSION_DENIED
  BEGIN
    PERFORM public.remove_direct_staff(v_wl_normal);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny_rm := true; END IF;
  END;
  INSERT INTO _t VALUES ('h1_deny_rm', v_deny_rm::text);

  -- (3) orphan set_venue_soft_target → PERMISSION_DENIED
  BEGIN
    PERFORM public.set_venue_soft_target(v_container, v_d, 3);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny_st := true; END IF;
  END;
  INSERT INTO _t VALUES ('h1_deny_st', v_deny_st::text);

  -- ── HIGH-2: 대회 승인 권한 ──
  -- (5) employer(비admin) INSERT tournament approved → 차단
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated', 'app_metadata', json_build_object('role','employer'))::text, true);
  BEGIN
    v_tid := gen_random_uuid();
    INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, tournament_config, created_at, updated_at)
    VALUES (v_tid, v_owner, v_ws, '__gosh_t_approved', 'active'::posting_status, 'tournament'::posting_type, 1, 0, '{"approvalStatus":"approved"}'::jsonb, now(), now());
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'tournament_approval_admin_only%' THEN v_h2_emp_approved_blocked := true; END IF;
  END;
  INSERT INTO _t VALUES ('h2_emp_approved_blocked', v_h2_emp_approved_blocked::text);

  -- (6) employer INSERT tournament pending → 허용(무회귀)
  BEGIN
    v_tid := gen_random_uuid();
    INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, tournament_config, created_at, updated_at)
    VALUES (v_tid, v_owner, v_ws, '__gosh_t_pending', 'active'::posting_status, 'tournament'::posting_type, 1, 0, '{"approvalStatus":"pending"}'::jsonb, now(), now());
    v_h2_emp_pending_ok := true;
  EXCEPTION WHEN others THEN v_h2_emp_pending_ok := false;
  END;
  INSERT INTO _t VALUES ('h2_emp_pending_ok', v_h2_emp_pending_ok::text);

  -- (8) service(auth.uid()=NULL, Edge Function 경로) pending→approved UPDATE → 허용
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    UPDATE public.job_postings SET tournament_config = '{"approvalStatus":"approved"}'::jsonb WHERE id = v_tid;
    v_h2_service_ok := true;
  EXCEPTION WHEN others THEN v_h2_service_ok := false;
  END;
  INSERT INTO _t VALUES ('h2_service_ok', v_h2_service_ok::text);

  -- (7) admin INSERT tournament approved → 허용
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'app_metadata', json_build_object('role','admin'))::text, true);
  BEGIN
    v_tid := gen_random_uuid();
    INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, tournament_config, created_at, updated_at)
    VALUES (v_tid, v_admin, v_ws, '__gosh_t_admin', 'active'::posting_status, 'tournament'::posting_type, 1, 0, '{"approvalStatus":"approved"}'::jsonb, now(), now());
    v_h2_admin_approved_ok := true;
  EXCEPTION WHEN others THEN v_h2_admin_approved_ok := false;
  END;
  INSERT INTO _t VALUES ('h2_admin_approved_ok', v_h2_admin_approved_ok::text);

  -- ── M-2: XSS 서버 경계 ──
  -- (9) work_logs INSERT notes='<script>' → 차단
  BEGIN
    INSERT INTO public.work_logs (id, job_posting_id, staff_id, date, notes, created_at, updated_at)
    VALUES (gen_random_uuid(), v_normal, v_staff, v_d, '<script>alert(1)</script>', now(), now());
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'XSS%' THEN v_m2_wl_blocked := true; END IF;
  END;
  INSERT INTO _t VALUES ('m2_wl_blocked', v_m2_wl_blocked::text);

  -- (10) job_postings INSERT contact_phone='javascript:...' → 차단
  BEGIN
    INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, total_positions, filled_positions, contact_phone, created_at, updated_at)
    VALUES (gen_random_uuid(), v_admin, v_ws, '__gosh_xss_phone', 'active'::posting_status, 'regular'::posting_type, 1, 0, 'javascript:alert(1)', now(), now());
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'XSS%' THEN v_m2_jp_blocked := true; END IF;
  END;
  INSERT INTO _t VALUES ('m2_jp_blocked', v_m2_jp_blocked::text);
END $$;

-- HIGH-1
SELECT is((SELECT v FROM _t WHERE k='reg_owner_add_filled'), '1',
  '[HIGH-1 무회귀] 정상 공고 owner add → filled +1 (게이트 오차단 없음)');
SELECT is((SELECT v FROM _t WHERE k='h1_deny_add'), 'true',
  '[HIGH-1] orphan(owner_id=NULL) + 무관자 add_direct_staff → PERMISSION_DENIED');
SELECT is((SELECT v FROM _t WHERE k='h1_deny_rm'), 'true',
  '[HIGH-1] orphan + 무관자 remove_direct_staff → PERMISSION_DENIED');
SELECT is((SELECT v FROM _t WHERE k='h1_deny_st'), 'true',
  '[HIGH-1] orphan + 무관자 set_venue_soft_target → PERMISSION_DENIED');
-- HIGH-2
SELECT is((SELECT v FROM _t WHERE k='h2_emp_approved_blocked'), 'true',
  '[HIGH-2] employer(비admin) INSERT tournament approved → 차단');
SELECT is((SELECT v FROM _t WHERE k='h2_emp_pending_ok'), 'true',
  '[HIGH-2 무회귀] employer INSERT tournament pending → 허용');
SELECT is((SELECT v FROM _t WHERE k='h2_service_ok'), 'true',
  '[HIGH-2 무회귀] service(auth.uid()=NULL) pending→approved UPDATE → 허용(Edge Function 경로)');
SELECT is((SELECT v FROM _t WHERE k='h2_admin_approved_ok'), 'true',
  '[HIGH-2] admin INSERT tournament approved → 허용');
-- M-2
SELECT is((SELECT v FROM _t WHERE k='m2_wl_blocked'), 'true',
  '[M-2] work_logs notes=<script> → XSS 차단');
SELECT is((SELECT v FROM _t WHERE k='m2_jp_blocked'), 'true',
  '[M-2] job_postings contact_phone=javascript: → XSS 차단');
-- M-1 구조
SELECT is(
  (SELECT count(*)::text FROM pg_policies
    WHERE tablename='job_postings' AND policyname='jp_insert' AND with_check LIKE '%owner_id%'),
  '1',
  '[M-1 구조] jp_insert WITH CHECK 에 owner_id 바인딩 존재');

SELECT * FROM finish();
ROLLBACK;
