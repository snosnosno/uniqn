-- ============================================================
-- 협업자 tier 별 알림 수신 범위 회귀 가드 (S3-4 보정, 마이그 20260813170000)
-- ============================================================
-- 🚨 이 파일이 지키는 것은 **호출 축**이다.
--   S3-4 는 `is_posting_collaborator()` 의 의미를 manager 전용으로 바꿔 쓰기 게이트 19곳을
--   한 번에 좁혔다. 그런데 **알림 팬아웃 2종은 그 헬퍼를 거치지 않는다** —
--   `job_posting_collaborators` 를 직접 읽어 role 무관하게 전량에게 보냈다.
--   결과: viewer 가 "취소 요청을 처리하라"·"지원자를 확정하라" 는 알림을 받고,
--   눌러 들어가면 **처리 버튼이 없는 화면**을 만난다(막다른 길).
--
--   권한을 tier 로 나누면 세어야 할 축이 셋이다 — **가시성 · 쓰기 · 호출(알림)**.
--   jpc_role_tiers 가 앞의 둘을 지키고, 이 파일이 셋째를 지킨다.
--
-- 🔑 viewer 의 **가시성은 줄이지 않는다.** 여기서 확인하는 것은 "부르지 않는다" 뿐이다.
--   viewer 가 지원자·근무기록을 볼 수 있다는 단언은 jpc_role_tiers E4 가 이미 갖고 있다.
--
-- 시나리오:
--   N1. 새 지원 알림 — owner·manager 는 받고 🔒 viewer 는 못 받는다
--   N2. 취소 요청 알림 — owner·manager 는 받고 🔒 viewer 는 못 받는다
--   N3. 🔒 구조 단언 — jpc 를 role 조건 없이 읽는 함수가 새로 생기지 않았다
--       (마이그의 인라인 스모크는 적용 시점 1회뿐이라 여기서 영속화한다)
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_jns_*@test.local)
-- 선행: npm run test:db:helpers
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
  v_app          uuid;

  v_owner_n   int;
  v_manager_n int;
  v_viewer_n  int;
  v_leaky     text;
BEGIN
  -- ------------------------------------------------------------
  -- 0. seed
  -- ------------------------------------------------------------
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u.id, u.email, 'authenticated', 'authenticated', '', u.meta, '{"name":"JNS"}'::jsonb, now(), now()
  FROM (VALUES
    (v_owner_id,   '__sql_fixture_jns_owner@test.local',   '{"role":"employer"}'::jsonb),
    (v_manager_id, '__sql_fixture_jns_manager@test.local', '{"role":"employer"}'::jsonb),
    (v_viewer_id,  '__sql_fixture_jns_viewer@test.local',  '{"role":"employer"}'::jsonb),
    (v_staff_id,   '__sql_fixture_jns_staff@test.local',   '{"role":"staff"}'::jsonb)
  ) AS u(id, email, meta);

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN (raw_app_meta_data ->> 'role') = 'employer' THEN 'employer'::user_role ELSE 'staff'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_workspace_id, '__sql_fixture_jns_ws', v_owner_id, now(), now());

  INSERT INTO public.job_postings (id, title, workspace_id, owner_id, status, schedule, created_at, updated_at)
  VALUES (v_jp, '__sql_fixture_jns_jp', v_workspace_id, v_owner_id, 'active'::posting_status,
    jsonb_build_object('kind','dated','requirements','[]'::jsonb), now(), now());

  -- 같은 공고에 manager 1 · viewer 1
  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by, role)
  VALUES (v_jp, v_manager_id, v_owner_id, 'manager'),
         (v_jp, v_viewer_id,  v_owner_id, 'viewer');

  -- ------------------------------------------------------------
  -- N1. 새 지원 알림 — viewer 는 확정 권한이 없으므로 부르지 않는다
  -- ------------------------------------------------------------
  INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_jp, v_staff_id, 'JNS_STAFF', 'applied'::application_status, now(), now())
  RETURNING id INTO v_app;

  SELECT
    count(*) FILTER (WHERE recipient_id = v_owner_id),
    count(*) FILTER (WHERE recipient_id = v_manager_id),
    count(*) FILTER (WHERE recipient_id = v_viewer_id)
    INTO v_owner_n, v_manager_n, v_viewer_n
    FROM public.notifications
   WHERE type = 'new_application'
     AND (data ->> 'jobPostingId') = v_jp::text;

  IF v_owner_n = 0 THEN
    RAISE EXCEPTION 'N1 fail: owner 가 새 지원 알림을 못 받았다 — 팬아웃 자체가 깨졌다';
  END IF;
  IF v_manager_n = 0 THEN
    RAISE EXCEPTION 'N1 fail: manager 가 새 지원 알림을 못 받았다 — 너무 좁혔다';
  END IF;
  IF v_viewer_n <> 0 THEN
    RAISE EXCEPTION
      'N1 fail: viewer 가 새 지원 알림을 %건 받았다 — 확정할 수 없는 사람을 부르면 막다른 길이 된다', v_viewer_n;
  END IF;

  -- ------------------------------------------------------------
  -- N2. 취소 요청 알림 — viewer 는 승인·거절 권한이 없으므로 부르지 않는다
  -- ------------------------------------------------------------
  UPDATE public.applications
     SET status = 'cancellation_pending'::application_status, updated_at = now()
   WHERE id = v_app;

  SELECT
    count(*) FILTER (WHERE recipient_id = v_owner_id),
    count(*) FILTER (WHERE recipient_id = v_manager_id),
    count(*) FILTER (WHERE recipient_id = v_viewer_id)
    INTO v_owner_n, v_manager_n, v_viewer_n
    FROM public.notifications
   WHERE type = 'cancellation_requested'
     AND (data ->> 'jobPostingId') = v_jp::text;

  IF v_owner_n = 0 THEN
    RAISE EXCEPTION 'N2 fail: owner 가 취소 요청 알림을 못 받았다 — 팬아웃 자체가 깨졌다';
  END IF;
  IF v_manager_n = 0 THEN
    RAISE EXCEPTION 'N2 fail: manager 가 취소 요청 알림을 못 받았다 — 너무 좁혔다';
  END IF;
  IF v_viewer_n <> 0 THEN
    RAISE EXCEPTION
      'N2 fail: viewer 가 취소 요청 알림을 %건 받았다 — 처리할 수 없는 사람을 부르면 막다른 길이 된다', v_viewer_n;
  END IF;

  -- ------------------------------------------------------------
  -- N3. 🔒 구조 단언 — 헬퍼를 안 거치고 jpc 를 읽는 새 경로가 생겼는가
  -- ------------------------------------------------------------
  -- S3-4 의 설계는 "쓰기는 전부 헬퍼를 지난다" 는 전제 위에 서 있다. 그 전제를 비켜 가는
  -- 직접 참조가 이번 결함의 원인이었으므로, 새로 생기면 여기서 사람이 보게 만든다.
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_leaky
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosrc LIKE '%job_posting_collaborators%'
     AND p.prosrc NOT LIKE '%role%'
     AND p.proname NOT LIKE 'jpc_test_%'
     AND p.proname NOT IN (
       'is_posting_collaborator',       -- 이미 role = 'manager' 로 좁다
       'is_posting_collaborator_any',   -- 읽기 가시성 전용(의도적으로 tier 무관)
       'is_workspace_jpc_member'        -- workspaces 가시성 — viewer 도 보여야 한다
     );

  IF v_leaky IS NOT NULL THEN
    RAISE EXCEPTION
      'N3 fail: job_posting_collaborators 를 role 조건 없이 읽는 함수가 있다: % — 가시성/쓰기/호출 중 어느 축인지 판정할 것',
      v_leaky;
  END IF;

  -- ------------------------------------------------------------
  -- Cleanup
  -- ------------------------------------------------------------
  DELETE FROM public.notifications
   WHERE recipient_id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id);
  DELETE FROM public.job_posting_collaborator_audit WHERE job_posting_id = v_jp;
  DELETE FROM public.job_posting_collaborators WHERE job_posting_id = v_jp;
  DELETE FROM public.applications WHERE job_posting_id = v_jp;
  DELETE FROM public.work_logs WHERE job_posting_id = v_jp;
  DELETE FROM public.job_postings WHERE id = v_jp;
  DELETE FROM public.workspaces WHERE id = v_workspace_id;
  DELETE FROM public.workspaces WHERE owner_id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id);
  DELETE FROM public.users WHERE id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id);
  DELETE FROM auth.users WHERE id IN (v_owner_id, v_manager_id, v_viewer_id, v_staff_id);
END $$;

SELECT pass('JPC_NOTIFICATION_SCOPE_TEST_PASSED');
SELECT * FROM finish();
ROLLBACK;
