-- ============================================================
-- T-B4: cancel_application_atomically expired 재오픈 가드 테스트
-- ============================================================
-- 목적: closed_reason이 'expired' / 'expired_by_work_date'인 공고는
--       취소 승인 후에도 closed 상태를 유지해야 함을 검증.
--       일반 closed 공고(closed_reason = 'manual' 등)는 재오픈됨을 함께 검증.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cancel_application_expired_guard.test.sql
--   기대 결과: 마지막에 'EXPIRED_GUARD_TEST_PASSED' 1행 반환, 에러 0건
--
-- 안전장치:
--   - 전체 실행이 BEGIN/ROLLBACK으로 래핑되어 assertion 실패 시에도 fixture 잔류 없음
--   - 마커 이메일(__sql_fixture_eg_*@test.local)로 production에서도 격리 가능
--   - auth.users INSERT 시 handle_new_user 트리거가 public.users 자동 생성
--   - 종료 직전 cleanup: applications → job_postings → auth.users 역순
--   - ROLLBACK이 최종 안전망이므로 cleanup 실패 시에도 데이터 잔류 없음
--
-- 시나리오:
--   S1. closed_reason = 'manual' 공고 → 취소 승인 시 'active'로 재오픈
--   S2. closed_reason = 'expired' 공고 → 취소 승인 시 'closed' 유지
--   S3. closed_reason = 'expired_by_work_date' 공고 → 취소 승인 시 'closed' 유지
--
-- 스키마 의존:
--   - public.users(id, email, name NOT NULL, role) ← auth.users FK
--   - applications(applicant_name NOT NULL)
--   - job_postings(title NOT NULL, closed_reason text)
--   - work_logs(staff_id, job_posting_id, date, role NOT NULL)
-- ============================================================
-- pgTAP wrap: pg_prove 호환을 위해 plan 추가 (BEGIN/ROLLBACK 은 기존 유지).
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();

  -- S1: manual closed
  v_job_manual_id  uuid := gen_random_uuid();
  v_app_manual_id  uuid := gen_random_uuid();

  -- S2: expired
  v_job_expired_id uuid := gen_random_uuid();
  v_app_expired_id uuid := gen_random_uuid();

  -- S3: expired_by_work_date
  v_job_expired_wd_id uuid := gen_random_uuid();
  v_app_expired_wd_id uuid := gen_random_uuid();

  v_result jsonb;
BEGIN
  -- ============================================================
  -- 0. auth.users seed (트리거가 public.users 자동 생성)
  -- ============================================================
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id, '__sql_fixture_eg_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"EG_OWNER"}'::jsonb, now(), now()),
    (v_staff_id, '__sql_fixture_eg_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"EG_STAFF"}'::jsonb, now(), now());

  -- public.users 명시 INSERT (handle_new_user 트리거 CI 미작동 대비)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- workspace seed (job_postings.workspace_id NOT NULL 충족 — PR #88 schema 변경)
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_eg_ws', v_owner_id, now(), now());

  -- ============================================================
  -- S1 fixture: closed + closed_reason = 'manual', filled=1, total=3
  -- ============================================================
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, closed_reason, created_at, updated_at
  )
  VALUES (v_job_manual_id, v_owner_id, v_workspace_id, '__sql_fixture: manual closed', 3, 1, 'closed', 'manual', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, cancellation_request, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_manual_id, v_job_manual_id, v_staff_id, 'EG_STAFF', 'cancellation_pending',
    jsonb_build_object('status', 'pending', 'requested_at', now()::text, 'reason', '스태프 요청'),
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-10'))),
      'cancelled_at', NULL,
      'confirmed_at', now()::text
    )),
    now(), now()
  );

  -- ============================================================
  -- S2 fixture: closed + closed_reason = 'expired', filled=1, total=3
  -- ============================================================
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, closed_reason, created_at, updated_at
  )
  VALUES (v_job_expired_id, v_owner_id, v_workspace_id, '__sql_fixture: expired closed', 3, 1, 'closed', 'expired', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, cancellation_request, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_expired_id, v_job_expired_id, v_staff_id, 'EG_STAFF', 'cancellation_pending',
    jsonb_build_object('status', 'pending', 'requested_at', now()::text, 'reason', '스태프 요청'),
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-11'))),
      'cancelled_at', NULL,
      'confirmed_at', now()::text
    )),
    now(), now()
  );

  -- ============================================================
  -- S3 fixture: closed + closed_reason = 'expired_by_work_date', filled=1, total=3
  -- ============================================================
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, closed_reason, created_at, updated_at
  )
  VALUES (v_job_expired_wd_id, v_owner_id, v_workspace_id, '__sql_fixture: expired_by_work_date closed', 3, 1, 'closed', 'expired_by_work_date', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, cancellation_request, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_expired_wd_id, v_job_expired_wd_id, v_staff_id, 'EG_STAFF', 'cancellation_pending',
    jsonb_build_object('status', 'pending', 'requested_at', now()::text, 'reason', '스태프 요청'),
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-12'))),
      'cancelled_at', NULL,
      'confirmed_at', now()::text
    )),
    now(), now()
  );

  -- ============================================================
  -- 시나리오 1: closed_reason = 'manual' → 취소 승인 후 'active'로 재오픈
  -- ============================================================
  v_result := public.cancel_application_atomically(v_app_manual_id, 'staff_approves_cancel_request', v_owner_id);
  IF NOT ((v_result->>'success')::bool) THEN
    RAISE EXCEPTION 'S1 RPC fail: %', v_result;
  END IF;
  IF v_result->>'new_status' != 'cancelled' THEN
    RAISE EXCEPTION 'S1 application status: expected cancelled, got %', v_result->>'new_status';
  END IF;
  IF (SELECT status::text FROM public.job_postings WHERE id = v_job_manual_id) != 'active' THEN
    RAISE EXCEPTION 'S1 job_posting status: expected active, got %',
      (SELECT status::text FROM public.job_postings WHERE id = v_job_manual_id);
  END IF;
  IF (SELECT filled_positions FROM public.job_postings WHERE id = v_job_manual_id) != 0 THEN
    RAISE EXCEPTION 'S1 filled_positions: expected 0, got %',
      (SELECT filled_positions FROM public.job_postings WHERE id = v_job_manual_id);
  END IF;

  -- ============================================================
  -- 시나리오 2: closed_reason = 'expired' → 취소 승인 후 'closed' 유지
  -- ============================================================
  v_result := public.cancel_application_atomically(v_app_expired_id, 'staff_approves_cancel_request', v_owner_id);
  IF NOT ((v_result->>'success')::bool) THEN
    RAISE EXCEPTION 'S2 RPC fail: %', v_result;
  END IF;
  IF v_result->>'new_status' != 'cancelled' THEN
    RAISE EXCEPTION 'S2 application status: expected cancelled, got %', v_result->>'new_status';
  END IF;
  IF (SELECT status::text FROM public.job_postings WHERE id = v_job_expired_id) != 'closed' THEN
    RAISE EXCEPTION 'S2 job_posting status: expected closed (expired guard), got %',
      (SELECT status::text FROM public.job_postings WHERE id = v_job_expired_id);
  END IF;
  IF (SELECT filled_positions FROM public.job_postings WHERE id = v_job_expired_id) != 0 THEN
    RAISE EXCEPTION 'S2 filled_positions: expected 0, got %',
      (SELECT filled_positions FROM public.job_postings WHERE id = v_job_expired_id);
  END IF;

  -- ============================================================
  -- 시나리오 3: closed_reason = 'expired_by_work_date' → 취소 승인 후 'closed' 유지
  -- ============================================================
  v_result := public.cancel_application_atomically(v_app_expired_wd_id, 'staff_approves_cancel_request', v_owner_id);
  IF NOT ((v_result->>'success')::bool) THEN
    RAISE EXCEPTION 'S3 RPC fail: %', v_result;
  END IF;
  IF v_result->>'new_status' != 'cancelled' THEN
    RAISE EXCEPTION 'S3 application status: expected cancelled, got %', v_result->>'new_status';
  END IF;
  IF (SELECT status::text FROM public.job_postings WHERE id = v_job_expired_wd_id) != 'closed' THEN
    RAISE EXCEPTION 'S3 job_posting status: expected closed (expired_by_work_date guard), got %',
      (SELECT status::text FROM public.job_postings WHERE id = v_job_expired_wd_id);
  END IF;
  IF (SELECT filled_positions FROM public.job_postings WHERE id = v_job_expired_wd_id) != 0 THEN
    RAISE EXCEPTION 'S3 filled_positions: expected 0, got %',
      (SELECT filled_positions FROM public.job_postings WHERE id = v_job_expired_wd_id);
  END IF;

  -- ============================================================
  -- Cleanup (역순)
  -- ============================================================
  DELETE FROM public.applications WHERE id IN (v_app_manual_id, v_app_expired_id, v_app_expired_wd_id);
  DELETE FROM public.job_postings WHERE id IN (v_job_manual_id, v_job_expired_id, v_job_expired_wd_id);
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id);
END $$;

SELECT pass('EXPIRED_GUARD_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
