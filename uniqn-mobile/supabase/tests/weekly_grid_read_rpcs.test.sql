-- ============================================================
-- 주간 배치 그리드 — Phase 2 읽기 RPC (get_venue_grid_summary / get_venue_day_slots)
-- ============================================================
-- 검증:
--   1. 월 요약 D1: headcount=3(컨테이너2+open1), job_count=1 (cancelled 제외)
--   2. 월 요약 D2: headcount=1, job_count=0
--   3. 하루 슬롯 D1: 3행(컨테이너2+open1, cancelled 제외)
--   4. 권한 게이트: 비멤버는 PERMISSION_DENIED
-- 안전: BEGIN/ROLLBACK + 마커 이메일
-- ============================================================
BEGIN;
SELECT plan(4);

CREATE TEMP TABLE _wr (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_stranger uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_c uuid; v_open uuid := gen_random_uuid();
  v_d1 text := '2026-07-01'; v_d2 text := '2026-07-02';
  v_hc1 int; v_jc1 int; v_hc2 int; v_jc2 int; v_slots1 int;
  v_denied boolean := false;
BEGIN
  -- baseline(2026-07-12): raw_app_meta_data.role 를 아래 public.users upsert role 과 일치시킴
  -- (on_auth_user_created 트리거 선점 행의 role 이 다르면 prevent_role_escalation 트리거가
  -- ON CONFLICT DO UPDATE 의 role 변경을 ROLE_CHANGE_DENIED 로 거부한다).
  INSERT INTO auth.users (id,email,aud,role,encrypted_password,raw_app_meta_data,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_wr_owner@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now()),
    (v_staff,'__sql_fixture_wr_staff@test.local','authenticated','authenticated','','{"role":"staff"}'::jsonb,now(),now()),
    (v_stranger,'__sql_fixture_wr_stranger@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now());
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  INSERT INTO public.users (id,email,name,role,is_active,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_wr_owner@test.local','WR_OWNER','employer',true,now(),now()),
    (v_staff,'__sql_fixture_wr_staff@test.local','WR_STAFF','staff',true,now(),now()),
    (v_stranger,'__sql_fixture_wr_stranger@test.local','WR_STRANGER','employer',true,now(),now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id,name,owner_id,created_at,updated_at) VALUES (v_ws,'__sql_fixture_wr_ws',v_owner,now(),now());

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  v_c := (public.get_or_create_venue_container(v_ws, '운영처WR', 'dated') ->> 'containerId')::uuid;

  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,total_positions,created_at,updated_at)
  VALUES (v_open, v_owner, v_ws, '__sql_fixture_wr_open', 'active'::posting_status, 'regular'::posting_type, v_c, 1, now(), now());

  INSERT INTO public.work_logs (staff_id,job_posting_id,date,status,role) VALUES
    (v_staff, v_c,    v_d1, 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c,    v_d1, 'scheduled'::work_log_status, 'floor'::staff_role),
    (v_staff, v_open, v_d1, 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c,    v_d1, 'cancelled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c,    v_d2, 'scheduled'::work_log_status, 'dealer'::staff_role);

  SELECT headcount, job_count INTO v_hc1, v_jc1 FROM public.get_venue_grid_summary(v_c, v_d1, v_d2) WHERE d = v_d1;
  SELECT headcount, job_count INTO v_hc2, v_jc2 FROM public.get_venue_grid_summary(v_c, v_d1, v_d2) WHERE d = v_d2;
  SELECT count(*) INTO v_slots1 FROM public.get_venue_day_slots(v_c, v_d1);
  INSERT INTO _wr VALUES ('d1', v_hc1||'/'||v_jc1), ('d2', v_hc2||'/'||v_jc2), ('slots1', v_slots1::text);

  -- 권한 게이트: 비멤버(stranger)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_stranger, 'role','authenticated')::text, true);
  BEGIN
    PERFORM public.get_venue_grid_summary(v_c, v_d1, v_d2);
  EXCEPTION WHEN OTHERS THEN v_denied := true;
  END;
  INSERT INTO _wr VALUES ('denied', v_denied::text);
END $$;

SELECT is((SELECT v FROM _wr WHERE k='d1'), '3/1', '월 요약 D1: headcount=3, job_count=1 (cancelled 제외)');
SELECT is((SELECT v FROM _wr WHERE k='d2'), '1/0', '월 요약 D2: headcount=1, job_count=0');
SELECT is((SELECT v FROM _wr WHERE k='slots1'), '3', '하루 슬롯 D1: 3행(컨테이너2+open1)');
SELECT is((SELECT v FROM _wr WHERE k='denied'), 'true', '권한 게이트: 비멤버는 거부');

SELECT * FROM finish();
ROLLBACK;
