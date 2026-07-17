-- ============================================================
-- 좌석 기준: fn_recalc_total_and_capacity capacity_full 자동 전이 테스트
-- ============================================================
-- 목적: 좌석(work_logs) 충족 시 active→capacity_full 자동 마감,
--       빈 좌석 생기면 capacity_full→active 자동 복귀를 검증.
--       closed/draft 는 좌석 변화와 무관하게 status 불변(의도 보존).
--
-- 좌석 기준 전환(2026-07-17):
--   filled 는 work_logs 좌석 트리거(fn_sync_filled_positions_seat)가,
--   전이는 job_postings BEFORE 트리거(fn_recalc_total_and_capacity)가 담당한다.
--   따라서 fixture 는 applications 가 아니라 work_logs INSERT/DELETE 로 filled 를 움직이고,
--   total 은 서버가 schedule 좌석합으로 재계산하므로 각 공고에 dealer×1 schedule(=total 1)을 부여한다.
--
-- 시나리오:
--   S1. active, total=1 → work_log 1건 INSERT → filled=1, status=capacity_full
--   S2. capacity_full → work_log DELETE → filled=0, status=active 복귀
--   S3. closed(manual) → work_log 변화(up/down) → status=closed 불변
--   S4. closed(expired) → work_log 변화 → status=closed 불변
--   S5. draft → work_log 변화 → status=draft 불변
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_cf_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();

  v_jp_s1 uuid := gen_random_uuid(); v_wl_s1 uuid := gen_random_uuid();
  v_jp_s2 uuid := gen_random_uuid(); v_wl_s2 uuid := gen_random_uuid();
  v_jp_s3 uuid := gen_random_uuid(); v_wl_s3 uuid := gen_random_uuid();
  v_jp_s4 uuid := gen_random_uuid(); v_wl_s4 uuid := gen_random_uuid();
  v_jp_s5 uuid := gen_random_uuid(); v_wl_s5 uuid := gen_random_uuid();

  v_status text; v_filled int;
  -- dealer×1 schedule → 서버 재계산 total = 1
  v_sched jsonb := jsonb_build_object('kind','dated','requirements', jsonb_build_array(
    jsonb_build_object('date','2026-07-01','timeSlots', jsonb_build_array(
      jsonb_build_object('startTime','19:00','roles', jsonb_build_array(
        jsonb_build_object('role','dealer','count',1)))))));
BEGIN
  -- 0. seed users + workspace
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id, '__sql_fixture_cf_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"CF_OWNER"}'::jsonb, now(), now()),
    (v_staff_id, '__sql_fixture_cf_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"CF_STAFF"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_cf_ws', v_owner_id, now(), now());

  -- ============================================================
  -- S1: active total=1 → work_log INSERT → capacity_full
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at)
  VALUES (v_jp_s1, v_owner_id, v_workspace_id, '__sql_fixture: cf s1', 1, 0, 'active', v_sched, now(), now());
  INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, time_slot, status, role, created_at, updated_at)
  VALUES (v_wl_s1, v_staff_id, v_jp_s1, '2026-07-01', '19:00', 'scheduled', 'dealer', now(), now());

  SELECT status::text, filled_positions INTO v_status, v_filled FROM public.job_postings WHERE id = v_jp_s1;
  IF v_status != 'capacity_full' THEN RAISE EXCEPTION 'S1 status: expected capacity_full, got %', v_status; END IF;
  IF v_filled != 1 THEN RAISE EXCEPTION 'S1 filled: expected 1, got %', v_filled; END IF;

  -- ============================================================
  -- S2: capacity_full → work_log DELETE → active 복귀
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at)
  VALUES (v_jp_s2, v_owner_id, v_workspace_id, '__sql_fixture: cf s2', 1, 0, 'active', v_sched, now(), now());
  INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, time_slot, status, role, created_at, updated_at)
  VALUES (v_wl_s2, v_staff_id, v_jp_s2, '2026-07-01', '19:00', 'scheduled', 'dealer', now(), now());
  -- 여기서 jp_s2 는 seat/ BEFORE 트리거로 capacity_full 이어야 함 (precondition)
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s2;
  IF v_status != 'capacity_full' THEN RAISE EXCEPTION 'S2 precondition: expected capacity_full, got %', v_status; END IF;
  -- 좌석 감소
  DELETE FROM public.work_logs WHERE id = v_wl_s2;
  SELECT status::text, filled_positions INTO v_status, v_filled FROM public.job_postings WHERE id = v_jp_s2;
  IF v_status != 'active' THEN RAISE EXCEPTION 'S2 status: expected active (복귀), got %', v_status; END IF;
  IF v_filled != 0 THEN RAISE EXCEPTION 'S2 filled: expected 0, got %', v_filled; END IF;

  -- ============================================================
  -- S3: closed(manual) → work_log up/down → closed 불변
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, closed_reason, schedule, created_at, updated_at)
  VALUES (v_jp_s3, v_owner_id, v_workspace_id, '__sql_fixture: cf s3', 1, 0, 'closed', 'manual', v_sched, now(), now());
  INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, time_slot, status, role, created_at, updated_at)
  VALUES (v_wl_s3, v_staff_id, v_jp_s3, '2026-07-01', '19:00', 'scheduled', 'dealer', now(), now());
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s3;
  IF v_status != 'closed' THEN RAISE EXCEPTION 'S3 status(after fill): expected closed, got %', v_status; END IF;
  DELETE FROM public.work_logs WHERE id = v_wl_s3;
  SELECT status::text, filled_positions INTO v_status, v_filled FROM public.job_postings WHERE id = v_jp_s3;
  IF v_status != 'closed' THEN RAISE EXCEPTION 'S3 status(after remove): expected closed, got %', v_status; END IF;
  IF v_filled != 0 THEN RAISE EXCEPTION 'S3 filled: expected 0, got %', v_filled; END IF;

  -- ============================================================
  -- S4: closed(expired) → work_log up → closed 불변
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, closed_reason, schedule, created_at, updated_at)
  VALUES (v_jp_s4, v_owner_id, v_workspace_id, '__sql_fixture: cf s4', 1, 0, 'closed', 'expired', v_sched, now(), now());
  INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, time_slot, status, role, created_at, updated_at)
  VALUES (v_wl_s4, v_staff_id, v_jp_s4, '2026-07-01', '19:00', 'scheduled', 'dealer', now(), now());
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s4;
  IF v_status != 'closed' THEN RAISE EXCEPTION 'S4 status: expected closed (expired 불변), got %', v_status; END IF;

  -- ============================================================
  -- S5: draft → work_log up → draft 불변
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at)
  VALUES (v_jp_s5, v_owner_id, v_workspace_id, '__sql_fixture: cf s5', 1, 0, 'draft', v_sched, now(), now());
  INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, time_slot, status, role, created_at, updated_at)
  VALUES (v_wl_s5, v_staff_id, v_jp_s5, '2026-07-01', '19:00', 'scheduled', 'dealer', now(), now());
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s5;
  IF v_status != 'draft' THEN RAISE EXCEPTION 'S5 status: expected draft (불변), got %', v_status; END IF;

  -- Cleanup (역순)
  DELETE FROM public.work_logs WHERE job_posting_id IN (v_jp_s1, v_jp_s2, v_jp_s3, v_jp_s4, v_jp_s5);
  DELETE FROM public.job_postings WHERE id IN (v_jp_s1, v_jp_s2, v_jp_s3, v_jp_s4, v_jp_s5);
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  DELETE FROM public.workspaces WHERE owner_id IN (v_owner_id, v_staff_id);
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id);
END $$;

SELECT pass('CAPACITY_FULL_TRANSITION_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
