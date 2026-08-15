-- ============================================================
-- 지원자 노쇼 이력 집계 RPC 회귀 가드 (S3-3, 마이그 20260813120000)
-- ============================================================
-- 🚨 이 파일이 존재하는 이유
--   이 RPC 는 SECURITY DEFINER 라 **RLS 를 우회한다.** 즉 게이트가 함수 안에만 있고,
--   그 게이트가 느슨해지면 아무 로그도 남기지 않고 남의 노쇼 이력이 새어 나간다.
--   특히 위험한 두 가지:
--     · 권한 체크가 빠지면 아무 employer 나 남의 공고 지원자를 조회할 수 있다.
--     · `applications` 교차 제한이 빠지면 p_staff_ids 에 아무 uuid 나 넣어
--       **임의 사용자의 노쇼 횟수를 열거**할 수 있다(지원한 적 없는 사람까지).
--   둘 다 "에러 없이 성공"하는 형태의 결함이라 테스트 말고는 잡을 방법이 없다.
--
-- 시나리오:
--   B1. owner 가 부르면 노쇼 횟수가 나온다 (status='no_show' 축)
--   B2. no_show_at 만 찍힌 행도 센다 (앱 판정축과 일치)
--   B3. 180일보다 오래된 노쇼는 세지 않는다 (낙인 방지 — 오래된 이력은 잊는다)
--   B4. 🔒 지원한 적 없는 staff_id 는 결과에 없다 (열거 공격 차단)
--   B5. 🔒 무관한 employer 가 부르면 PERMISSION_DENIED
--   B6. 협업자도 부를 수 있다 (지원자 목록이 보이는데 칩만 안 보이면 앞뒤가 안 맞는다)
--   B7. 반환 컬럼은 (staff_id, no_show_count) 둘뿐 — 업장·날짜·사유가 새지 않는다
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_ansc_*@test.local)
-- 선행: npm run test:db:helpers (jpc_test_set_user)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id     uuid := gen_random_uuid();
  v_other_id     uuid := gen_random_uuid();
  v_collab_id    uuid := gen_random_uuid();
  v_staff_a      uuid := gen_random_uuid();  -- 노쇼 2건(각 축 1건) + 오래된 1건
  v_staff_b      uuid := gen_random_uuid();  -- 노쇼 0건
  v_stranger     uuid := gen_random_uuid();  -- 지원한 적 없음 + 노쇼 5건

  v_workspace_id uuid := gen_random_uuid();
  v_jp           uuid := gen_random_uuid();

  v_recent text := to_char(((now() AT TIME ZONE 'Asia/Seoul')::date - 10), 'YYYY-MM-DD');
  v_old    text := to_char(((now() AT TIME ZONE 'Asia/Seoul')::date - 400), 'YYYY-MM-DD');

  v_count int;
  v_rows  int;
  v_cols  int;
  v_denied boolean := false;
BEGIN
  -- ------------------------------------------------------------
  -- 0. seed
  -- ------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u.id, u.email, 'authenticated', 'authenticated', '', u.meta, '{"name":"ANSC"}'::jsonb, now(), now()
  FROM (VALUES
    (v_owner_id,  '__sql_fixture_ansc_owner@test.local',    '{"role":"employer"}'::jsonb),
    (v_other_id,  '__sql_fixture_ansc_other@test.local',    '{"role":"employer"}'::jsonb),
    (v_collab_id, '__sql_fixture_ansc_collab@test.local',   '{"role":"employer"}'::jsonb),
    (v_staff_a,   '__sql_fixture_ansc_staffa@test.local',   '{"role":"staff"}'::jsonb),
    (v_staff_b,   '__sql_fixture_ansc_staffb@test.local',   '{"role":"staff"}'::jsonb),
    (v_stranger,  '__sql_fixture_ansc_stranger@test.local', '{"role":"staff"}'::jsonb)
  ) AS u(id, email, meta);

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN (raw_app_meta_data ->> 'role') = 'employer' THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users
  WHERE id IN (v_owner_id, v_other_id, v_collab_id, v_staff_a, v_staff_b, v_stranger)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_ansc_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp, '__sql_fixture_ansc_jp', v_workspace_id, v_owner_id, 'active'::posting_status,
    jsonb_build_object('kind','dated','requirements','[]'::jsonb), now(), now());

  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
  VALUES (v_jp, v_collab_id, v_owner_id);

  -- 지원: staff_a, staff_b 만. stranger 는 지원하지 않았다.
  INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES
    (v_jp, v_staff_a, 'ANSC_A', 'applied'::application_status, now(), now()),
    (v_jp, v_staff_b, 'ANSC_B', 'applied'::application_status, now(), now());

  -- 노쇼 이력 (다른 공고에서 생긴 것으로 가정 — 같은 공고여도 집계 로직은 동일)
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role, owner_id, no_show_at)
  VALUES
    -- staff_a: status 축 1건
    (v_staff_a, v_jp, v_recent, 'no_show'::work_log_status,   'dealer'::staff_role, v_owner_id, NULL),
    -- staff_a: no_show_at 축 1건 (status 는 scheduled)
    (v_staff_a, v_jp, v_recent, 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id, to_jsonb(now()::text)),
    -- staff_a: 180일 밖 — 세면 안 된다
    (v_staff_a, v_jp, v_old,    'no_show'::work_log_status,   'dealer'::staff_role, v_owner_id, NULL),
    -- staff_b: 노쇼 아님
    (v_staff_b, v_jp, v_recent, 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id, NULL),
    -- stranger: 노쇼 많지만 이 공고에 지원한 적 없다
    (v_stranger, v_jp, v_recent, 'no_show'::work_log_status,  'dealer'::staff_role, v_owner_id, NULL),
    (v_stranger, v_jp, v_recent, 'no_show'::work_log_status,  'dealer'::staff_role, v_owner_id, NULL);

  -- ------------------------------------------------------------
  -- B1/B2/B3. owner 호출 — staff_a 는 정확히 2건 (최근 2건, 오래된 1건 제외)
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_owner_id);

  SELECT no_show_count INTO v_count
    FROM public.get_applicant_no_show_counts(v_jp, ARRAY[v_staff_a, v_staff_b])
   WHERE staff_id = v_staff_a;

  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'B1/B2/B3 fail: staff_a 노쇼가 % 다 (기대 2 — status 축 1 + no_show_at 축 1, 180일 밖 1건은 제외)', coalesce(v_count::text,'(null)');
  END IF;

  -- 노쇼가 없는 지원자도 0 으로 나와야 한다(행이 빠지면 클라가 "미조회"와 구분 못 한다)
  SELECT no_show_count INTO v_count
    FROM public.get_applicant_no_show_counts(v_jp, ARRAY[v_staff_a, v_staff_b])
   WHERE staff_id = v_staff_b;

  IF v_count IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'B1 fail: staff_b 노쇼가 % 다 (기대 0)', coalesce(v_count::text,'(null)');
  END IF;

  -- ------------------------------------------------------------
  -- B4. 🔒 지원한 적 없는 uuid 는 결과에 없다 (열거 차단)
  -- ------------------------------------------------------------
  SELECT count(*)::int INTO v_rows
    FROM public.get_applicant_no_show_counts(v_jp, ARRAY[v_stranger]);

  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'B4 fail: 지원한 적 없는 사용자가 %행 반환됐다 — p_staff_ids 를 그대로 믿으면 임의 사용자의 노쇼 이력을 열거할 수 있다', v_rows;
  END IF;

  -- ------------------------------------------------------------
  -- B7. 반환 컬럼은 2개뿐 (업장·날짜·사유가 새지 않는다)
  -- ------------------------------------------------------------
  SELECT count(*)::int INTO v_cols
    FROM unnest(string_to_array(
      pg_get_function_result('public.get_applicant_no_show_counts(uuid, uuid[])'::regprocedure), ',')) AS x;

  IF v_cols <> 2 THEN
    RAISE EXCEPTION 'B7 fail: 반환 컬럼이 %개다 (기대 2 — staff_id, no_show_count). 업장·날짜·사유를 실으면 이력 확인이 아니라 뒷조사가 된다', v_cols;
  END IF;

  -- ------------------------------------------------------------
  -- B6. 협업자도 호출 가능
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_collab_id);

  SELECT no_show_count INTO v_count
    FROM public.get_applicant_no_show_counts(v_jp, ARRAY[v_staff_a])
   WHERE staff_id = v_staff_a;

  IF v_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'B6 fail: 협업자 호출이 % 를 냈다 (기대 2)', coalesce(v_count::text,'(null)');
  END IF;

  -- ------------------------------------------------------------
  -- B5. 🔒 무관한 employer 는 거부
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_other_id);

  BEGIN
    PERFORM * FROM public.get_applicant_no_show_counts(v_jp, ARRAY[v_staff_a]);
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%PERMISSION_DENIED%' THEN
        v_denied := true;
      ELSE
        RAISE EXCEPTION 'B5 fail: 예상 밖 에러 — %', SQLERRM;
      END IF;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'B5 fail: 무관한 employer 가 남의 공고 지원자 노쇼 이력을 조회했다';
  END IF;

  -- ------------------------------------------------------------
  -- Cleanup (역순)
  -- ------------------------------------------------------------
  -- jpc_test_set_user 는 role 을 authenticated 로 바꾼다 — 그대로 두면 auth.users 정리에서
  -- "permission denied for table users" 로 죽는다. 정리 전에 세션 롤로 돌아온다.
  RESET ROLE;
  DELETE FROM public.work_logs WHERE job_posting_id = v_jp;
  DELETE FROM public.applications WHERE job_posting_id = v_jp;
  DELETE FROM public.job_posting_collaborators WHERE job_posting_id = v_jp;
  DELETE FROM public.notifications WHERE recipient_id IN (v_owner_id, v_other_id, v_collab_id, v_staff_a, v_staff_b, v_stranger);
  DELETE FROM public.job_postings WHERE id = v_jp;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM public.workspaces WHERE owner_id IN (v_owner_id, v_other_id, v_collab_id);
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_other_id, v_collab_id, v_staff_a, v_staff_b, v_stranger);
END $$;

SELECT pass('APPLICANT_NO_SHOW_COUNTS_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
