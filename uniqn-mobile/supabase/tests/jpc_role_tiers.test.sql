-- ============================================================
-- 협업자 권한 2단 (manager / viewer) 회귀 가드 (S3-4, 마이그 20260813150000)
-- ============================================================
-- 🚨 이 파일이 지키는 것은 **실패의 방향**이다.
--   이 기능의 구현은 `is_posting_collaborator()` 의 의미를 manager 전용으로 바꿔서
--   쓰기 RPC 14종 + 쓰기 RLS 정책 5개를 **한 줄도 안 고치고** 좁힌 것이다.
--   그 설계가 성립하려면 두 가지가 동시에 참이어야 한다:
--     ① 쓰기 경로는 `is_posting_collaborator`(좁은 쪽)를 쓴다
--     ② 읽기 경로는 `is_posting_collaborator_any`(넓은 쪽)를 쓴다
--   ①이 깨지면 **viewer 가 쓰기를 한다**(권한 누수). ②가 깨지면 viewer 가 아무것도 못 본다.
--   둘 다 에러를 내지 않는다 — RLS 는 조용히 행을 감추거나 조용히 허용할 뿐이다.
--
-- 시나리오:
--   E1. 기존/신규 행의 기본 role 은 manager (이 마이그레이션만으로는 동작이 안 바뀐다)
--   E2. manager 는 공고를 수정할 수 있다 (기존 동작 보존)
--   E3. 🔒 viewer 는 공고를 수정할 수 없다
--   E4. viewer 도 공고·지원자·근무기록을 **볼 수는** 있다 (viewer 의 존재 이유)
--   E5. 🔒 viewer 는 쓰기 RPC(add_direct_staff)에서도 막힌다 — RLS 우회 경로 차단
--   E6. role 변경은 workspace owner 만 (협업자 자신은 자기 권한을 못 올린다)
--   E7. 🔒 UPDATE 로 user_id 를 바꿔치기할 수 없다 (트리거 가드)
--   E8. role 변경이 감사 로그에 남는다
--   E9. 🔒 구조 단언 — 쓰기 정책이 _any 를 쓰지 않는다
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_jrt_*@test.local)
-- 선행: npm run test:db:helpers (jpc_test_set_user)
-- ============================================================

BEGIN;
SELECT plan(1);

DO $$
DECLARE
  v_owner_id   uuid := gen_random_uuid();
  v_manager_id uuid := gen_random_uuid();
  v_viewer_id  uuid := gen_random_uuid();
  v_staff_id   uuid := gen_random_uuid();

  v_workspace_id uuid := gen_random_uuid();
  v_jp           uuid := gen_random_uuid();

  v_role     text;
  v_cnt      int;
  v_title    text;
  v_denied   boolean;
  v_leaky    int;
BEGIN
  -- ------------------------------------------------------------
  -- 0. seed
  -- ------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u.id, u.email, 'authenticated', 'authenticated', '', u.meta, '{"name":"JRT"}'::jsonb, now(), now()
  FROM (VALUES
    (v_owner_id,   '__sql_fixture_jrt_owner@test.local',   '{"role":"employer"}'::jsonb),
    (v_manager_id, '__sql_fixture_jrt_manager@test.local', '{"role":"employer"}'::jsonb),
    (v_viewer_id,  '__sql_fixture_jrt_viewer@test.local',  '{"role":"employer"}'::jsonb),
    (v_staff_id,   '__sql_fixture_jrt_staff@test.local',   '{"role":"staff"}'::jsonb)
  ) AS u(id, email, meta);

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN (raw_app_meta_data ->> 'role') = 'employer' THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_jrt_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp, '__sql_fixture_jrt_jp', v_workspace_id, v_owner_id, 'active'::posting_status,
    jsonb_build_object('kind','dated','requirements','[]'::jsonb), now(), now());

  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role, owner_id)
  VALUES (v_staff_id, v_jp, '2026-09-01', 'scheduled'::work_log_status, 'dealer'::staff_role, v_owner_id);

  INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_jp, v_staff_id, 'JRT_STAFF', 'applied'::application_status, now(), now());

  -- ------------------------------------------------------------
  -- E1. 기본값은 manager — 이 마이그레이션만으로는 동작이 안 바뀐다
  -- ------------------------------------------------------------
  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
  VALUES (v_jp, v_manager_id, v_owner_id);

  SELECT role INTO v_role FROM public.job_posting_collaborators
   WHERE job_posting_id = v_jp AND user_id = v_manager_id;

  IF v_role <> 'manager' THEN
    RAISE EXCEPTION 'E1 fail: role 기본값이 % 다 (기대 manager — 기본이 viewer 면 기존 협업자가 전부 권한을 잃는다)', v_role;
  END IF;

  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by, role)
  VALUES (v_jp, v_viewer_id, v_owner_id, 'viewer');

  -- ------------------------------------------------------------
  -- E2. manager 는 공고를 수정할 수 있다
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_manager_id);

  UPDATE public.job_postings SET title = 'JRT_BY_MANAGER' WHERE id = v_jp;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'E2 fail: manager 가 공고를 수정하지 못했다 (기존 협업자 권한이 깨졌다)';
  END IF;

  -- ------------------------------------------------------------
  -- E3. 🔒 viewer 는 공고를 수정할 수 없다
  -- ------------------------------------------------------------
  PERFORM jpc_test_set_user(v_viewer_id);

  UPDATE public.job_postings SET title = 'JRT_BY_VIEWER' WHERE id = v_jp;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'E3 fail: viewer 가 공고를 수정했다 (%행) — 쓰기 정책이 좁은 헬퍼를 안 쓰고 있다', v_cnt;
  END IF;

  -- ------------------------------------------------------------
  -- E4. viewer 도 볼 수는 있어야 한다 (viewer 의 존재 이유)
  -- ------------------------------------------------------------
  SELECT count(*)::int INTO v_cnt FROM public.job_postings WHERE id = v_jp;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'E4 fail: viewer 에게 공고가 안 보인다 — 읽기 정책이 _any 를 안 쓰고 있다';
  END IF;

  SELECT count(*)::int INTO v_cnt FROM public.applications WHERE job_posting_id = v_jp;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'E4 fail: viewer 에게 지원자가 안 보인다 (%건)', v_cnt;
  END IF;

  SELECT count(*)::int INTO v_cnt FROM public.work_logs WHERE job_posting_id = v_jp;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'E4 fail: viewer 에게 근무기록이 안 보인다 (%건)', v_cnt;
  END IF;

  -- ------------------------------------------------------------
  -- E5. 🔒 쓰기 RPC 도 막힌다 (RLS 우회 경로 차단)
  -- ------------------------------------------------------------
  -- SECDEF RPC 는 RLS 를 우회하므로 정책만 좁혀서는 부족하다. 이 RPC 들은 본문에서
  -- is_posting_collaborator() 를 부르는데, 그 함수의 의미가 바뀌어 자동으로 좁혀졌다.
  v_denied := false;
  BEGIN
    PERFORM public.send_job_posting_announcement(v_jp, '침입', 'viewer 가 공지를 보낸다');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%PERMISSION_DENIED%' THEN v_denied := true;
    ELSE RAISE EXCEPTION 'E5 fail: 예상 밖 에러 — %', SQLERRM; END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'E5 fail: viewer 가 쓰기 RPC 를 통과했다 — SECDEF 는 RLS 를 우회하므로 여기서 막지 못하면 정책을 좁힌 의미가 없다';
  END IF;

  -- ------------------------------------------------------------
  -- E6. role 변경은 owner 만 — 협업자가 자기 권한을 못 올린다
  -- ------------------------------------------------------------
  UPDATE public.job_posting_collaborators SET role = 'manager'
   WHERE job_posting_id = v_jp AND user_id = v_viewer_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'E6 fail: viewer 가 스스로를 manager 로 승격했다 — 권한 상승 취약점';
  END IF;

  PERFORM jpc_test_set_user(v_owner_id);

  UPDATE public.job_posting_collaborators SET role = 'manager'
   WHERE job_posting_id = v_jp AND user_id = v_viewer_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'E6 fail: owner 가 role 을 바꾸지 못했다 — 기능 자체가 동작하지 않는다';
  END IF;

  -- ------------------------------------------------------------
  -- E7. 🔒 UPDATE 로 user_id 바꿔치기 금지
  -- ------------------------------------------------------------
  v_denied := false;
  BEGIN
    UPDATE public.job_posting_collaborators SET user_id = v_staff_id
     WHERE job_posting_id = v_jp AND user_id = v_manager_id;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%jpc_update_role_only%' THEN v_denied := true;
    ELSE RAISE EXCEPTION 'E7 fail: 예상 밖 에러 — %', SQLERRM; END IF;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION 'E7 fail: UPDATE 로 user_id 를 바꿨다 — owner 가 임의의 사람을 협업자로 둔갑시킬 수 있다';
  END IF;

  -- ------------------------------------------------------------
  -- E8. role 변경이 감사 로그에 남는다
  -- ------------------------------------------------------------
  RESET ROLE;

  SELECT count(*)::int INTO v_cnt
    FROM public.job_posting_collaborator_audit
   WHERE job_posting_id = v_jp AND target_user_id = v_viewer_id AND action = 'role_changed';
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'E8 fail: role 변경 감사 로그가 %건이다 (기대 1) — 권한이 언제 넓어졌는지 추적할 수 없다', v_cnt;
  END IF;

  -- ------------------------------------------------------------
  -- E9. 🔒 구조 단언 — 쓰기 정책이 넓은 헬퍼를 쓰지 않는다
  -- ------------------------------------------------------------
  SELECT count(*)::int INTO v_leaky
    FROM pg_policies
   WHERE schemaname = 'public'
     AND cmd IN ('UPDATE', 'DELETE', 'INSERT', 'ALL')
     AND coalesce(qual, '') || coalesce(with_check, '') LIKE '%is_posting_collaborator_any%';

  IF v_leaky <> 0 THEN
    RAISE EXCEPTION 'E9 fail: 쓰기 정책 %개가 is_posting_collaborator_any 를 쓴다 — viewer 가 그 경로로 쓰기를 한다', v_leaky;
  END IF;

  -- 반대 방향도 본다: 읽기 정책이 좁은 헬퍼를 쓰면 viewer 가 아무것도 못 본다.
  SELECT count(*)::int INTO v_leaky
    FROM pg_policies
   WHERE schemaname = 'public'
     AND cmd = 'SELECT'
     AND coalesce(qual, '') LIKE '%is_posting_collaborator(%';

  IF v_leaky <> 0 THEN
    RAISE EXCEPTION 'E9 fail: 읽기 정책 %개가 좁은 헬퍼를 쓴다 — viewer 가 그 테이블을 못 본다', v_leaky;
  END IF;

  -- ------------------------------------------------------------
  -- Cleanup
  -- ------------------------------------------------------------
  DELETE FROM public.job_posting_collaborator_audit WHERE job_posting_id = v_jp;
  DELETE FROM public.job_posting_collaborators WHERE job_posting_id = v_jp;
  DELETE FROM public.applications WHERE job_posting_id = v_jp;
  DELETE FROM public.work_logs WHERE job_posting_id = v_jp;
  DELETE FROM public.notifications
   WHERE recipient_id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id);
  DELETE FROM public.job_postings WHERE id = v_jp;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM public.workspaces WHERE owner_id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id);
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id);
END $$;

SELECT pass('JPC_ROLE_TIERS_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
