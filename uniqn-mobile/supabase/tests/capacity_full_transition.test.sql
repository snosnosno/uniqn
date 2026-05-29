-- ============================================================
-- M2: fn_update_job_posting_stats capacity_full 자동 전이 테스트
-- ============================================================
-- 목적: 인원 정원 도달 시 active→capacity_full 자동 마감,
--       빈자리 생기면 capacity_full→active 자동 복귀를 검증.
--       closed/draft 는 filled 변화와 무관하게 status 불변(의도 보존).
--
-- 트리거 상호작용 주의(pitfall_denormalized_counter_drift):
--   applications INSERT(confirmed) → trigger filled +1
--   applications UPDATE(confirmed→cancelled) → trigger filled -1
--   → 따라서 fixture 의 jp.filled_positions 는 0 으로 두고 trigger 가 채우게 한다.
--
-- 시나리오:
--   S1. active, total=1 → confirmed 1건 INSERT → filled=1, status=capacity_full
--   S2. capacity_full → 1건 cancel(confirmed→cancelled) → filled=0, status=active 복귀
--   S3. closed(manual) → filled 변화(up/down) → status=closed 불변
--   S4. closed(expired) → filled 변화 → status=closed 불변
--   S5. draft → filled 변화 → status=draft 불변
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

  v_jp_s1 uuid := gen_random_uuid(); v_app_s1 uuid := gen_random_uuid();
  v_jp_s2 uuid := gen_random_uuid(); v_app_s2 uuid := gen_random_uuid();
  v_jp_s3 uuid := gen_random_uuid(); v_app_s3 uuid := gen_random_uuid();
  v_jp_s4 uuid := gen_random_uuid(); v_app_s4 uuid := gen_random_uuid();
  v_jp_s5 uuid := gen_random_uuid(); v_app_s5 uuid := gen_random_uuid();

  v_status text; v_filled int;
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
  -- S1: active total=1 → confirmed INSERT → capacity_full
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at)
  VALUES (v_jp_s1, v_owner_id, v_workspace_id, '__sql_fixture: cf s1', 1, 0, 'active', now(), now());
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_app_s1, v_jp_s1, v_staff_id, 'CF_STAFF', 'confirmed', now(), now());

  SELECT status::text, filled_positions INTO v_status, v_filled FROM public.job_postings WHERE id = v_jp_s1;
  IF v_status != 'capacity_full' THEN RAISE EXCEPTION 'S1 status: expected capacity_full, got %', v_status; END IF;
  IF v_filled != 1 THEN RAISE EXCEPTION 'S1 filled: expected 1, got %', v_filled; END IF;

  -- ============================================================
  -- S2: capacity_full → cancel(confirmed→cancelled) → active 복귀
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at)
  VALUES (v_jp_s2, v_owner_id, v_workspace_id, '__sql_fixture: cf s2', 1, 0, 'active', now(), now());
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_app_s2, v_jp_s2, v_staff_id, 'CF_STAFF', 'confirmed', now(), now());
  -- 여기서 jp_s2 는 trigger 로 capacity_full 이어야 함 (precondition)
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s2;
  IF v_status != 'capacity_full' THEN RAISE EXCEPTION 'S2 precondition: expected capacity_full, got %', v_status; END IF;
  -- cancel
  UPDATE public.applications SET status = 'cancelled' WHERE id = v_app_s2;
  SELECT status::text, filled_positions INTO v_status, v_filled FROM public.job_postings WHERE id = v_jp_s2;
  IF v_status != 'active' THEN RAISE EXCEPTION 'S2 status: expected active (복귀), got %', v_status; END IF;
  IF v_filled != 0 THEN RAISE EXCEPTION 'S2 filled: expected 0, got %', v_filled; END IF;

  -- ============================================================
  -- S3: closed(manual) → filled up/down → closed 불변
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, closed_reason, created_at, updated_at)
  VALUES (v_jp_s3, v_owner_id, v_workspace_id, '__sql_fixture: cf s3', 1, 0, 'closed', 'manual', now(), now());
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_app_s3, v_jp_s3, v_staff_id, 'CF_STAFF', 'confirmed', now(), now());
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s3;
  IF v_status != 'closed' THEN RAISE EXCEPTION 'S3 status(after fill): expected closed, got %', v_status; END IF;
  UPDATE public.applications SET status = 'cancelled' WHERE id = v_app_s3;
  SELECT status::text, filled_positions INTO v_status, v_filled FROM public.job_postings WHERE id = v_jp_s3;
  IF v_status != 'closed' THEN RAISE EXCEPTION 'S3 status(after cancel): expected closed, got %', v_status; END IF;
  IF v_filled != 0 THEN RAISE EXCEPTION 'S3 filled: expected 0, got %', v_filled; END IF;

  -- ============================================================
  -- S4: closed(expired) → filled up → closed 불변
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, closed_reason, created_at, updated_at)
  VALUES (v_jp_s4, v_owner_id, v_workspace_id, '__sql_fixture: cf s4', 1, 0, 'closed', 'expired', now(), now());
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_app_s4, v_jp_s4, v_staff_id, 'CF_STAFF', 'confirmed', now(), now());
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s4;
  IF v_status != 'closed' THEN RAISE EXCEPTION 'S4 status: expected closed (expired 불변), got %', v_status; END IF;

  -- ============================================================
  -- S5: draft → filled up → draft 불변
  -- ============================================================
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at)
  VALUES (v_jp_s5, v_owner_id, v_workspace_id, '__sql_fixture: cf s5', 1, 0, 'draft', now(), now());
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_app_s5, v_jp_s5, v_staff_id, 'CF_STAFF', 'confirmed', now(), now());
  SELECT status::text INTO v_status FROM public.job_postings WHERE id = v_jp_s5;
  IF v_status != 'draft' THEN RAISE EXCEPTION 'S5 status: expected draft (불변), got %', v_status; END IF;

  -- Cleanup (역순)
  DELETE FROM public.applications WHERE id IN (v_app_s1, v_app_s2, v_app_s3, v_app_s4, v_app_s5);
  DELETE FROM public.job_postings WHERE id IN (v_jp_s1, v_jp_s2, v_jp_s3, v_jp_s4, v_jp_s5);
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id);
END $$;

SELECT pass('CAPACITY_FULL_TRANSITION_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
