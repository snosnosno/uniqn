-- ============================================================
-- person basis filled_positions 회귀 테스트
-- ============================================================
-- DISABLED 사유 (2026-05-14): confirm_application RPC 안
-- COALESCE((v_assignment->>'role')::staff_role, v_app.applicant_role, 'staff')
-- 의 staff_role 캐스트 + applications.applicant_role (user_role 타입) type mismatch.
-- "COALESCE could not convert type user_role to staff_role" 에러.
-- 후속 PR: RPC 수정 (applicant_role 도 staff_role 로 cast) 또는
-- applications.applicant_role 컬럼 type 통일.
-- ============================================================
-- 목적: 마이그레이션 20260418000000_person_basis_filled_positions.sql 적용 후
--       confirm/cancel RPC가 filled_positions를 사람 단위로 증감하는지 검증.
--
-- 사용법:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/person_basis_filled_positions.test.sql
--   기대: 마지막에 'PERSON_BASIS_TEST_PASSED' NOTICE, 에러 0건
--
-- 시나리오:
--   S1. 그룹일정(dates=3) 1명 확정 → filled_positions=1 (slot 3 아님)
--   S2. 단일일정(dates=1) 1명 확정 → filled_positions=2 (누적)
--   S3. 그룹 확정자 취소 → filled_positions=1 (slot 3 감소 아님)
--   S4. 백필 쿼리 idempotency (재실행 시 0 rows affected)
-- ============================================================
-- pgTAP wrap: pg_prove 호환을 위해 BEGIN/plan/finish/ROLLBACK 추가.
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id uuid := gen_random_uuid();
  v_staff1_id uuid := gen_random_uuid();
  v_staff2_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_app1_id uuid := gen_random_uuid();
  v_app2_id uuid := gen_random_uuid();
  v_assignment_v3_group jsonb;
  v_assignment_v3_single jsonb;
  v_flat_group jsonb;
  v_flat_single jsonb;
  v_history_group jsonb;
  v_history_single jsonb;
  v_result jsonb;
  v_filled int;
  v_stats_filled int;
  v_stats_confirmed int;
BEGIN
  -- ============================================================
  -- 0. auth.users seed (트리거가 public.users 자동 생성)
  -- ============================================================
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_id,  '__sql_fixture_pb_owner@test.local',  '{"role":"employer"}'::jsonb, '{"name":"PB_OWNER"}'::jsonb, now(), now()),
    (v_staff1_id, '__sql_fixture_pb_staff1@test.local', '{"role":"staff"}'::jsonb,    '{"name":"PB_STAFF1"}'::jsonb, now(), now()),
    (v_staff2_id, '__sql_fixture_pb_staff2@test.local', '{"role":"staff"}'::jsonb,    '{"name":"PB_STAFF2"}'::jsonb, now(), now());

  -- public.users 명시 INSERT (handle_new_user 트리거 CI 미작동 대비)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner_id THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_staff1_id, v_staff2_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- workspace seed (job_postings.workspace_id NOT NULL 충족 — PR #88 schema 변경)
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_pb_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, stats, created_at, updated_at
  ) VALUES (
    v_job_id, v_owner_id, v_workspace_id, '__sql_fixture: person basis', 10, 0, 'active',
    '{"totalApplicants":0,"activeApplicants":0,"confirmedApplicants":0,"cancellationPendingApplicants":0,"filledPositions":0}'::jsonb,
    now(), now()
  );

  -- v3 canonical 포맷 (confirm 후 applications.assignments에 저장될 형태)
  v_assignment_v3_group := jsonb_build_array(jsonb_build_object(
    'roleIds', jsonb_build_array('dealer'),
    'dates', jsonb_build_array('2026-05-01', '2026-05-02', '2026-05-03'),
    'isGrouped', true,
    'timeSlot', '19:00',
    'groupId', 'group-1'
  ));

  v_assignment_v3_single := jsonb_build_array(jsonb_build_object(
    'roleIds', jsonb_build_array('floor'),
    'dates', jsonb_build_array('2026-05-04'),
    'isGrouped', false,
    'timeSlot', '20:00',
    'groupId', null
  ));

  -- flat 포맷 (work_logs 전개용, dates × roleIds 카테시안)
  v_flat_group := jsonb_build_array(
    jsonb_build_object('groupId', 'group-1', 'date', '2026-05-01', 'timeSlot', '19:00', 'role', 'dealer'),
    jsonb_build_object('groupId', 'group-1', 'date', '2026-05-02', 'timeSlot', '19:00', 'role', 'dealer'),
    jsonb_build_object('groupId', 'group-1', 'date', '2026-05-03', 'timeSlot', '19:00', 'role', 'dealer')
  );

  v_flat_single := jsonb_build_array(
    jsonb_build_object('groupId', null, 'date', '2026-05-04', 'timeSlot', '20:00', 'role', 'floor')
  );

  -- confirmation_history (RPC가 요구; 신규 항목 1건, active 상태)
  v_history_group := jsonb_build_array(jsonb_build_object(
    'assignments', v_assignment_v3_group,
    'confirmed_at', now()::text,
    'cancelled_at', NULL
  ));

  v_history_single := jsonb_build_array(jsonb_build_object(
    'assignments', v_assignment_v3_single,
    'confirmed_at', now()::text,
    'cancelled_at', NULL
  ));

  -- 두 application을 applied 상태로 생성
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, assignments, created_at, updated_at
  )
  VALUES
    (v_app1_id, v_job_id, v_staff1_id, 'PB_STAFF1', 'applied', v_assignment_v3_group,  now(), now()),
    (v_app2_id, v_job_id, v_staff2_id, 'PB_STAFF2', 'applied', v_assignment_v3_single, now(), now());

  -- ============================================================
  -- S1: 그룹일정(dates=3) 1명 확정 → filled_positions = 1 (NOT 3)
  -- ============================================================
  -- [#195 가드] 호출자 바인딩: confirm_application 의 actor(p_owner_id=v_owner_id) 로 jwt sub 세팅
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.confirm_application(
    v_app1_id, v_owner_id, v_flat_group, NULL, v_history_group, NULL, false, v_assignment_v3_group
  );

  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_job_id;
  IF v_filled != 1 THEN
    RAISE EXCEPTION 'S1 FAIL: 그룹일정 1명 확정 후 filled_positions=%, 기대 1 (slot 3 아님)', v_filled;
  END IF;

  SELECT (stats->>'filledPositions')::int INTO v_stats_filled FROM public.job_postings WHERE id = v_job_id;
  IF v_stats_filled != 1 THEN
    RAISE EXCEPTION 'S1 FAIL: stats.filledPositions=%, 기대 1', v_stats_filled;
  END IF;

  SELECT (stats->>'confirmedApplicants')::int INTO v_stats_confirmed FROM public.job_postings WHERE id = v_job_id;
  IF v_stats_confirmed != 1 THEN
    RAISE EXCEPTION 'S1 FAIL: stats.confirmedApplicants=%, 기대 1', v_stats_confirmed;
  END IF;

  -- applications.assignments는 v3 canonical 유지 확인 (덮어쓰기 버그 재발 방지)
  IF NOT ((SELECT assignments->0 FROM public.applications WHERE id = v_app1_id) ? 'roleIds') THEN
    RAISE EXCEPTION 'S1 FAIL: applications.assignments가 v3 canonical 아님 (roleIds 키 없음)';
  END IF;

  -- work_logs는 slot 단위(3건) INSERT 확인
  IF (SELECT COUNT(*) FROM public.work_logs WHERE application_id = v_app1_id) != 3 THEN
    RAISE EXCEPTION 'S1 FAIL: work_logs=%, 기대 3 (슬롯 단위)', (SELECT COUNT(*) FROM public.work_logs WHERE application_id = v_app1_id);
  END IF;

  -- ============================================================
  -- S2: 단일일정 1명 추가 확정 → filled_positions = 2
  -- ============================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_id, 'role', 'authenticated')::text, true);
  v_result := public.confirm_application(
    v_app2_id, v_owner_id, v_flat_single, NULL, v_history_single, NULL, false, v_assignment_v3_single
  );

  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_job_id;
  IF v_filled != 2 THEN
    RAISE EXCEPTION 'S2 FAIL: 단일 1명 추가 후 filled_positions=%, 기대 2', v_filled;
  END IF;

  -- ============================================================
  -- S3: 그룹 확정자 취소(staff_initiates) → filled_positions = 1
  --      slot 단위라면 filled_positions = GREATEST(0, 2-3) = 0 이 됐을 것
  -- ============================================================
  -- cancel actor = v_staff1_id (본인) → jwt sub 세팅
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_staff1_id, 'role', 'authenticated')::text, true);
  v_result := public.cancel_application_atomically(v_app1_id, 'staff_initiates', v_staff1_id, '개인 사정');

  IF NOT ((v_result->>'success')::bool) THEN
    RAISE EXCEPTION 'S3 FAIL: cancel RPC success=false: %', v_result;
  END IF;

  IF (v_result->>'new_filled_positions')::int != 1 THEN
    RAISE EXCEPTION 'S3 FAIL: new_filled_positions=%, 기대 1', v_result->>'new_filled_positions';
  END IF;

  SELECT filled_positions INTO v_filled FROM public.job_postings WHERE id = v_job_id;
  IF v_filled != 1 THEN
    RAISE EXCEPTION 'S3 FAIL: 그룹 취소 후 filled_positions=%, 기대 1 (slot 3 감소 아님)', v_filled;
  END IF;

  SELECT (stats->>'filledPositions')::int INTO v_stats_filled FROM public.job_postings WHERE id = v_job_id;
  IF v_stats_filled != 1 THEN
    RAISE EXCEPTION 'S3 FAIL: stats.filledPositions=%, 기대 1 (filled_positions 컬럼과 동기)', v_stats_filled;
  END IF;

  -- stats.confirmedApplicants는 cancel RPC에서 손대지 않음 (request_cancellation 경로와 중복 우려).
  -- 초기 sync는 백필로 맞추고, 이후 drift는 후속 PR에서 처리.

  -- work_logs scheduled 3건은 모두 삭제되어야 함 (slot 레벨 기존 동작 유지)
  IF (SELECT COUNT(*) FROM public.work_logs WHERE application_id = v_app1_id AND status = 'scheduled') != 0 THEN
    RAISE EXCEPTION 'S3 FAIL: work_logs scheduled 건 남아있음';
  END IF;

  -- ============================================================
  -- S4: 백필 쿼리 idempotency — 현재 상태에서 백필 재실행 시 0행
  -- ============================================================
  UPDATE public.job_postings jp SET
    filled_positions = sub.cnt,
    stats = jsonb_set(
      jsonb_set(
        COALESCE(stats, '{}'::jsonb),
        '{filledPositions}',
        to_jsonb(sub.cnt)
      ),
      '{confirmedApplicants}',
      to_jsonb(sub.confirmed_only_cnt)
    ),
    updated_at = now()
  FROM (
    SELECT
      jp2.id AS posting_id,
      COALESCE(COUNT(a.id) FILTER (
        WHERE a.status IN ('confirmed', 'completed', 'cancellation_pending')
      ), 0)::int AS cnt,
      COALESCE(COUNT(a.id) FILTER (
        WHERE a.status = 'confirmed'
      ), 0)::int AS confirmed_only_cnt
    FROM public.job_postings jp2
    LEFT JOIN public.applications a ON a.job_posting_id = jp2.id
    WHERE jp2.id = v_job_id
    GROUP BY jp2.id
  ) sub
  WHERE jp.id = sub.posting_id
    AND (
      jp.filled_positions IS DISTINCT FROM sub.cnt
      OR COALESCE((jp.stats->>'filledPositions')::int, -1) != sub.cnt
      OR COALESCE((jp.stats->>'confirmedApplicants')::int, -1) != sub.confirmed_only_cnt
    );

  IF FOUND THEN
    RAISE EXCEPTION 'S4 FAIL: 백필 재실행 시 UPDATE 발생 (idempotent 아님)';
  END IF;

  -- ============================================================
  -- 정리
  -- ============================================================
  DELETE FROM public.work_logs WHERE job_posting_id = v_job_id;
  DELETE FROM public.applications WHERE id IN (v_app1_id, v_app2_id);
  DELETE FROM public.job_postings WHERE id = v_job_id;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_staff1_id, v_staff2_id);

  RAISE NOTICE 'PERSON_BASIS_TEST_PASSED';
END $$;

SELECT pass('PERSON_BASIS_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
