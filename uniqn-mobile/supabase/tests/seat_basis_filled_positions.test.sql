-- ============================================================
-- seat basis filled/total positions 회귀 테스트 (2026-07-17 좌석 기준 통일)
-- 사용법: psql "$SUPABASE_DB_URL" -f supabase/tests/seat_basis_filled_positions.test.sql
--
-- 시나리오(픽스처): owner 1 · staff 4 · 공고 1(2026-07-14~15 grouped, 19:00 dealer 3/일)
--   좌석 total = 3+3 = 6. job_postings INSERT 시 total_positions 는 의도적으로 틀린 값(1)을
--   넣어 BEFORE 트리거의 서버 재계산(=6)을 검증한다. + 컨테이너 1(filled 불변 검증).
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_seat_*@test.local) + 임시 uuid.
-- 하네스: work_schedule_container_staff_softtarget 과 동형(CREATE TEMP TABLE _t + DO block + is()).
-- ============================================================
BEGIN;
SELECT plan(11);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff1 uuid := gen_random_uuid();
  v_staff2 uuid := gen_random_uuid();
  v_staff3 uuid := gen_random_uuid();
  v_staff4 uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_job uuid := gen_random_uuid();
  v_container uuid := gen_random_uuid();
  v_app1 uuid := gen_random_uuid();
  v_schedule jsonb;
  v_flat jsonb;
  v_v3 jsonb;
  v_history jsonb;
  v_res jsonb;
BEGIN
  -- ---- seed: auth.users → public.users → workspace ----
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,  '__sql_fixture_seat_owner@test.local',  '{"role":"employer"}'::jsonb, '{"name":"SEAT_OWNER"}'::jsonb,  now(), now()),
    (v_staff1, '__sql_fixture_seat_staff1@test.local', '{"role":"staff"}'::jsonb,    '{"name":"SEAT_S1"}'::jsonb,     now(), now()),
    (v_staff2, '__sql_fixture_seat_staff2@test.local', '{"role":"staff"}'::jsonb,    '{"name":"SEAT_S2"}'::jsonb,     now(), now()),
    (v_staff3, '__sql_fixture_seat_staff3@test.local', '{"role":"staff"}'::jsonb,    '{"name":"SEAT_S3"}'::jsonb,     now(), now()),
    (v_staff4, '__sql_fixture_seat_staff4@test.local', '{"role":"staff"}'::jsonb,    '{"name":"SEAT_S4"}'::jsonb,     now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_owner THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner, v_staff1, v_staff2, v_staff3, v_staff4)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_seat_ws', v_owner, now(), now());

  v_schedule := jsonb_build_object(
    'kind', 'dated',
    'requirements', jsonb_build_array(
      jsonb_build_object('date','2026-07-14','isGrouped',true,'timeSlots',
        jsonb_build_array(jsonb_build_object('startTime','19:00','roles',
          jsonb_build_array(jsonb_build_object('role','dealer','count',3))))),
      jsonb_build_object('date','2026-07-15','isGrouped',true,'timeSlots',
        jsonb_build_array(jsonb_build_object('startTime','19:00','roles',
          jsonb_build_array(jsonb_build_object('role','dealer','count',3)))))
    )
  );

  -- total_positions 는 의도적으로 틀린 값(1) → BEFORE 트리거 재계산(=6) 검증
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at
  ) VALUES (
    v_job, v_owner, v_ws, '__sql_fixture: seat basis', 1, 0, 'active', v_schedule, now(), now()
  );
  INSERT INTO _t VALUES ('t1_total', (SELECT total_positions FROM public.job_postings WHERE id = v_job)::text);

  -- 컨테이너(T8 용) — BEFORE 트리거가 total=0, seat 트리거 SKIP
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at
  ) VALUES (
    v_container, v_owner, v_ws, '__sql_fixture: seat container', 0, 0, 'container'::posting_status,
    jsonb_build_object('kind','dated','requirements','[]'::jsonb), now(), now()
  );

  -- ---- staff1: 14·15일 모두 지원→확정(confirm_application flat 2건) ----
  v_v3 := jsonb_build_array(jsonb_build_object(
    'roleIds', jsonb_build_array('dealer'),
    'dates', jsonb_build_array('2026-07-14','2026-07-15'),
    'isGrouped', true, 'timeSlot', '19:00', 'groupId', 'g1'));
  v_flat := jsonb_build_array(
    jsonb_build_object('groupId','g1','date','2026-07-14','timeSlot','19:00','role','dealer'),
    jsonb_build_object('groupId','g1','date','2026-07-15','timeSlot','19:00','role','dealer'));
  v_history := jsonb_build_array(jsonb_build_object(
    'assignments', v_v3, 'confirmed_at', now()::text, 'cancelled_at', NULL));

  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, assignments, created_at, updated_at)
  VALUES (v_app1, v_job, v_staff1, 'SEAT_S1', 'applied', v_v3, now(), now());

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  v_res := public.confirm_application(v_app1, v_owner, v_flat, NULL, v_history, NULL, false, v_v3);
  INSERT INTO _t VALUES ('t2_filled', (SELECT filled_positions FROM public.job_postings WHERE id = v_job)::text);
  INSERT INTO _t VALUES ('t3_stats', (SELECT stats->>'filledPositions' FROM public.job_postings WHERE id = v_job));

  -- ---- add_direct_staff: staff2 를 14일 추가 → filled = 3 ----
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  PERFORM public.add_direct_staff(v_job, v_staff2,
    jsonb_build_array(jsonb_build_object('date','2026-07-14','timeSlot','19:00','role','dealer')));
  INSERT INTO _t VALUES ('t4_filled', (SELECT filled_positions FROM public.job_postings WHERE id = v_job)::text);

  -- ---- 같은 staff2 를 15일 추가(2번째 호출) → filled = 4 (구 person basis 는 3 유지) ----
  PERFORM public.add_direct_staff(v_job, v_staff2,
    jsonb_build_array(jsonb_build_object('date','2026-07-15','timeSlot','19:00','role','dealer')));
  INSERT INTO _t VALUES ('t5_filled', (SELECT filled_positions FROM public.job_postings WHERE id = v_job)::text);

  -- ---- 전 좌석 충족: 14일 staff4 + 15일 staff3 → filled 6, capacity_full ----
  PERFORM public.add_direct_staff(v_job, v_staff4,
    jsonb_build_array(jsonb_build_object('date','2026-07-14','timeSlot','19:00','role','dealer')));
  -- 여기서 filled=5, total=6 → 아직 active 여야 함(그 전까진 active 유지)
  INSERT INTO _t VALUES ('t6_pre_status', (SELECT status::text FROM public.job_postings WHERE id = v_job));
  PERFORM public.add_direct_staff(v_job, v_staff3,
    jsonb_build_array(jsonb_build_object('date','2026-07-15','timeSlot','19:00','role','dealer')));
  INSERT INTO _t VALUES ('t6_status', (SELECT status::text FROM public.job_postings WHERE id = v_job));

  -- ---- cancel_application_atomically(staff1, employer_initiates) → 좌석 2 감소 = 4, active 복귀 ----
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);
  v_res := public.cancel_application_atomically(v_app1, 'employer_initiates', v_owner, '구인자 해제');
  INSERT INTO _t VALUES ('t7_return', (v_res->>'new_filled_positions'));
  INSERT INTO _t VALUES ('t7a_filled', (SELECT filled_positions FROM public.job_postings WHERE id = v_job)::text);
  INSERT INTO _t VALUES ('t7b_status', (SELECT status::text FROM public.job_postings WHERE id = v_job));

  -- ---- 컨테이너 공고에 add_direct_staff → filled 0 유지 ----
  PERFORM public.add_direct_staff(v_container, v_staff2,
    jsonb_build_array(jsonb_build_object('date','2026-07-14','timeSlot','19:00','role','dealer')));
  INSERT INTO _t VALUES ('t8_filled', (SELECT filled_positions FROM public.job_postings WHERE id = v_container)::text);
END $$;

-- T1. BEFORE 트리거: INSERT 시 total_positions 재계산 = 6 (클라 값 1 무시)
SELECT is((SELECT v FROM _t WHERE k = 't1_total'), '6',
  'T1: INSERT 시 서버가 좌석합 6으로 재계산');
-- T2. 같은 사람 2일 확정 = 좌석 2 (구 person basis 면 1)
SELECT is((SELECT v FROM _t WHERE k = 't2_filled'), '2',
  'T2: 같은 사람 2일 확정 = 좌석 2');
-- T3. stats.filledPositions 미러 = 2
SELECT is((SELECT v FROM _t WHERE k = 't3_stats'), '2',
  'T3: stats.filledPositions 미러 = 2');
-- T4. 직접추가 1좌석 = 3
SELECT is((SELECT v FROM _t WHERE k = 't4_filled'), '3',
  'T4: 직접추가 1좌석 = 3');
-- T5. 같은 스태프 2번째 좌석도 카운트 = 4 (person basis 는 3 유지 — red-green 핵심)
SELECT is((SELECT v FROM _t WHERE k = 't5_filled'), '4',
  'T5: 같은 스태프 2번째 좌석도 카운트 = 4');
-- T6a. 5/6 좌석에서는 아직 active (그 전까진 active 유지)
SELECT is((SELECT v FROM _t WHERE k = 't6_pre_status'), 'active',
  'T6a: 5/6 좌석에서는 아직 active');
-- T6b. 전 좌석 충족(6/6) 시에만 capacity_full
SELECT is((SELECT v FROM _t WHERE k = 't6_status'), 'capacity_full',
  'T6b: 전 좌석 충족 시에만 capacity_full');
-- T7-return. RPC 반환 new_filled_positions = 4 (DELETE-먼저 재배열 검증)
SELECT is((SELECT v FROM _t WHERE k = 't7_return'), '4',
  'T7-return: 취소 RPC 반환 new_filled_positions = 4 (DELETE-먼저 재배열)');
-- T7a/b. 취소로 좌석 2 감소 = 4 + capacity_full → active 자동 복귀
SELECT is((SELECT v FROM _t WHERE k = 't7a_filled'), '4',
  'T7a: 취소로 좌석 2 감소 = 4');
SELECT is((SELECT v FROM _t WHERE k = 't7b_status'), 'active',
  'T7b: capacity_full → active 자동 복귀');
-- T8. 컨테이너 공고에 add_direct_staff → filled 0 유지 (seat 트리거 SKIP)
SELECT is((SELECT v FROM _t WHERE k = 't8_filled'), '0',
  'T8: 컨테이너 filled 불변(0)');

SELECT * FROM finish();
ROLLBACK;
