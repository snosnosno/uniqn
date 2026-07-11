-- ============================================================
-- P0-B: cancel_application_atomically(employer_initiates) SQL 회귀 테스트
-- ============================================================
-- 목적: 유저플로우 감사(2026-07-10) 클러스터 B — 구인자 확정해제 경로 신설 검증.
--   마이그레이션 20260711020000_cancel_application_employer_initiates.sql 적용 후
--   수동/CI 실행하여 employer_initiates 분기 동작을 검증한다.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cancel_application_employer_initiates.test.sql
--   기대 결과: 마지막에 'CANCEL_EMPLOYER_TEST_PASSED' 1행 반환, 에러 0건
--
-- 안전장치(cancel_application_atomically.test.sql 하네스와 동일):
--   - 마커 이메일(__sql_fixture_emp_*@test.local)로 production 에서도 격리 가능
--   - public.users 명시 INSERT (handle_new_user 트리거 CI 미작동 대비)
--   - 종료 직전 cleanup: notifications → work_logs → applications → job_postings
--     → workspaces → auth.users 역순
--   - BEGIN/plan/finish/ROLLBACK 로 pg_prove 호환. DO block 내 RAISE EXCEPTION 을 fail 로 잡음
--
-- 시나리오:
--   E1. owner employer_initiates happy: confirmed → applied + 스태프 confirmation_cancelled 1행
--   E4. 멱등: applied 상태 재호출 → success + idempotent
--   E6. 미지원 actor_type → invalid_actor_type
--   E2. 외부인 employer_initiates → unauthorized
--   E3. 스태프 본인 employer_initiates → unauthorized(공고 권한 없음)
--   E7. caller binding: auth.uid != p_actor_id(비admin) → unauthorized
--   E5. staff_initiates 회귀: confirmed → applied 정상(기존 경로 무변경)
--   E8. 고아 공고(owner_id NULL) + 비인가 액터 → unauthorized (NULL fail-open 방어, 보안리뷰 MEDIUM)
--
-- 스키마 의존:
--   - public.users(id, email, name NOT NULL, role) ← auth.users FK
--   - applications(applicant_name NOT NULL)
--   - job_postings(title NOT NULL)
--   - work_logs(staff_id, job_posting_id, date, role NOT NULL)
--   - notifications(recipient_id NOT NULL, type NOT NULL, title/body NOT NULL) ← 스태프 통지
-- ============================================================
BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff_id uuid := gen_random_uuid();
  v_other_user_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app_id uuid := gen_random_uuid();
  v_work_log_id uuid := gen_random_uuid();
  v_result jsonb;
  v_notify_count int;
BEGIN
  -- ============================================================
  -- 0. seed (auth.users → public.users → workspace → posting → application → work_log)
  -- ============================================================
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id,      '__sql_fixture_emp_owner@test.local', '{"role":"employer"}'::jsonb, '{"name":"OWNER"}'::jsonb, now(), now()),
    (v_staff_id,      '__sql_fixture_emp_staff@test.local', '{"role":"staff"}'::jsonb,    '{"name":"STAFF"}'::jsonb, now(), now()),
    (v_other_user_id, '__sql_fixture_emp_other@test.local', '{"role":"staff"}'::jsonb,    '{"name":"OTHER"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_user_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_emp_ws', v_owner_id, now(), now());

  -- filled_positions 는 fn_update_job_posting_stats 트리거가 applications status 로 관리한다.
  -- 0 으로 시드하면 아래 'confirmed' application INSERT 가 트리거를 발화시켜 1 이 된다(수동 세팅 금지).
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (v_job_id, v_owner_id, v_workspace_id, '__sql_fixture: employer cancel', 5, 0, 'active', now(), now());

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, confirmation_history, created_at, updated_at
  )
  VALUES (
    v_app_id, v_job_id, v_staff_id, 'STAFF', 'confirmed',
    jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-01'))),
      'cancelled_at', NULL,
      'confirmed_at', now()::text
    )),
    now(), now()
  );

  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, date, status, role, created_at, updated_at
  )
  VALUES (v_work_log_id, v_app_id, v_staff_id, v_job_id, '2026-05-01', 'scheduled', 'staff', now(), now());

  -- ============================================================
  -- E1: owner employer_initiates happy path (confirmed → applied + 스태프 통지)
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'employer_initiates', v_owner_id, '구인자 해제');
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'E1 fail: %', v_result; END IF;
  IF v_result->>'new_status' != 'applied' THEN RAISE EXCEPTION 'E1 status: %', v_result; END IF;
  IF (SELECT status::text FROM public.applications WHERE id = v_app_id) != 'applied' THEN
    RAISE EXCEPTION 'E1 side: applications.status';
  END IF;
  IF (SELECT filled_positions FROM public.job_postings WHERE id = v_job_id) != 0 THEN
    RAISE EXCEPTION 'E1 side: filled_positions';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work_logs WHERE application_id = v_app_id AND status = 'scheduled') THEN
    RAISE EXCEPTION 'E1 side: scheduled work_logs not deleted';
  END IF;
  -- 스태프에게 confirmation_cancelled 통지 정확히 1행 (employer_initiates 만 통지 INSERT)
  SELECT COUNT(*) INTO v_notify_count
  FROM public.notifications
  WHERE recipient_id = v_staff_id AND type = 'confirmation_cancelled';
  IF v_notify_count != 1 THEN
    RAISE EXCEPTION 'E1 notify: expected 1 confirmation_cancelled for staff, got %', v_notify_count;
  END IF;
  -- senderId 는 실제 행위자(owner) 를 기록
  IF (SELECT data->>'senderId' FROM public.notifications
      WHERE recipient_id = v_staff_id AND type = 'confirmation_cancelled' LIMIT 1) != v_owner_id::text THEN
    RAISE EXCEPTION 'E1 notify: senderId mismatch';
  END IF;

  -- ============================================================
  -- E4: 멱등 (E1 직후 applied 상태 재호출)
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'employer_initiates', v_owner_id);
  IF NOT ((v_result->>'success')::bool AND (v_result->>'idempotent')::bool) THEN
    RAISE EXCEPTION 'E4 fail: %', v_result;
  END IF;
  -- 멱등 경로는 통지를 추가하지 않는다(여전히 1행)
  SELECT COUNT(*) INTO v_notify_count
  FROM public.notifications
  WHERE recipient_id = v_staff_id AND type = 'confirmation_cancelled';
  IF v_notify_count != 1 THEN RAISE EXCEPTION 'E4 notify: idempotent added row, count=%', v_notify_count; END IF;

  -- ============================================================
  -- E6: 미지원 actor_type → invalid_actor_type
  -- ============================================================
  UPDATE public.applications SET status = 'confirmed',
    confirmation_history = jsonb_build_array(jsonb_build_object(
      'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-01'))),
      'cancelled_at', NULL, 'confirmed_at', now()::text))
  WHERE id = v_app_id;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'bogus_actor', v_owner_id);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'invalid_actor_type' THEN
    RAISE EXCEPTION 'E6 fail: %', v_result;
  END IF;

  -- ============================================================
  -- E2: 외부인 employer_initiates → unauthorized (공고 권한 없음)
  -- ============================================================
  -- 외부인이 본인 명의로 인증(caller binding 통과)해도 owner/member/collaborator/admin 아니면 거부.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_user_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'employer_initiates', v_other_user_id);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'unauthorized' THEN
    RAISE EXCEPTION 'E2 fail: %', v_result;
  END IF;

  -- ============================================================
  -- E3: 스태프 본인 employer_initiates → unauthorized (지원자여도 공고 권한 없음)
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'employer_initiates', v_staff_id);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'unauthorized' THEN
    RAISE EXCEPTION 'E3 fail: %', v_result;
  END IF;

  -- ============================================================
  -- E7: caller binding — auth.uid != p_actor_id (비admin) → unauthorized
  -- ============================================================
  -- 외부인 세션이 owner 를 행위자로 위조 → 첫 가드(auth.uid IS DISTINCT FROM p_actor_id)에서 거부.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_user_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'employer_initiates', v_owner_id);
  IF (v_result->>'success')::bool OR v_result->>'error' != 'unauthorized' THEN
    RAISE EXCEPTION 'E7 fail: %', v_result;
  END IF;

  -- ============================================================
  -- E5: staff_initiates 회귀 (기존 경로 무변경: confirmed → applied)
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app_id, 'staff_initiates', v_staff_id, '개인 사정');
  IF NOT ((v_result->>'success')::bool) THEN RAISE EXCEPTION 'E5 fail: %', v_result; END IF;
  IF v_result->>'new_status' != 'applied' THEN RAISE EXCEPTION 'E5 status: %', v_result; END IF;
  IF (SELECT status::text FROM public.applications WHERE id = v_app_id) != 'applied' THEN
    RAISE EXCEPTION 'E5 side: applications.status';
  END IF;
  -- staff_initiates 는 통지를 추가하지 않는다(여전히 E1 의 1행뿐)
  SELECT COUNT(*) INTO v_notify_count
  FROM public.notifications
  WHERE recipient_id = v_staff_id AND type = 'confirmation_cancelled';
  IF v_notify_count != 1 THEN RAISE EXCEPTION 'E5 notify: staff_initiates added row, count=%', v_notify_count; END IF;

  -- ============================================================
  -- E8: 고아 공고(owner_id NULL) — NULL fail-open 방어 (보안리뷰 MEDIUM)
  -- ============================================================
  -- owner_id 는 ON DELETE SET NULL 로 nullable. COALESCE 하드닝 전에는
  -- NULL = actor → NOT(NULL OR false...) = NULL → IF 미발화로 비인가 액터가 통과했다.
  DECLARE
    v_job2_id uuid := gen_random_uuid();
    v_app2_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.job_postings (
      id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
    )
    VALUES (v_job2_id, NULL, v_workspace_id, '__sql_fixture: orphan posting', 5, 0, 'active', now(), now());

    INSERT INTO public.applications (
      id, job_posting_id, applicant_id, applicant_name, status, confirmation_history, created_at, updated_at
    )
    VALUES (
      v_app2_id, v_job2_id, v_staff_id, 'STAFF', 'confirmed',
      jsonb_build_array(jsonb_build_object(
        'assignments', jsonb_build_array(jsonb_build_object('dates', jsonb_build_array('2026-05-02'))),
        'cancelled_at', NULL,
        'confirmed_at', now()::text
      )),
      now(), now()
    );

    -- 외부인(비 owner/멤버/협업자/admin)이 본인 명의로 고아 공고 확정해제 시도 → 거부돼야 함
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other_user_id, 'role', 'authenticated')::text, true);
    v_result := public.cancel_application_atomically(v_app2_id, 'employer_initiates', v_other_user_id);
    IF (v_result->>'success')::bool OR v_result->>'error' != 'unauthorized' THEN
      RAISE EXCEPTION 'E8 fail (orphan posting NULL fail-open): %', v_result;
    END IF;

    DELETE FROM public.applications WHERE id = v_app2_id;
    DELETE FROM public.job_postings WHERE id = v_job2_id;
  END;

  -- ============================================================
  -- Cleanup (역순)
  -- ============================================================
  DELETE FROM public.notifications WHERE recipient_id IN (v_owner_id, v_staff_id, v_other_user_id);
  DELETE FROM public.work_logs WHERE application_id = v_app_id;
  DELETE FROM public.applications WHERE id = v_app_id;
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff_id, v_other_user_id);
END $$;

SELECT pass('CANCEL_EMPLOYER_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
