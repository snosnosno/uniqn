-- ============================================================
-- 주간 배치 그리드 — 컨테이너 fail-closed 누수 감사 + 핵심 불변식 (Phase 1)
-- ============================================================
-- 검증:
--   1. E3 get_or_create_venue_container 멱등 — 2회 호출 → 동일 containerId(race 방지)
--   2. 컨테이너 shape — status=container, total_positions=0, venue_id=self, kind=dated, softTargets={}
--   3. E1 venue 스팬 COUNT — 컨테이너 + 그 venue 의 open 공고 work_logs 합산(cancelled 제외)
--   4. E1 근거 — 단일 컨테이너만 보면 open 공고 인원이 silent 누락됨
--   5. R2 통계 누수 차단 — get_job_posting_stats total 에 컨테이너 미포함
--   6. R2 공개 RLS 누수 차단 — 외부인(authenticated)은 컨테이너를 RLS 로 볼 수 없음
--   7. R2 쓰기 fail-closed — 멤버(authenticated)도 컨테이너를 직접 INSERT 할 수 없음(SECDEF RPC 전용)
--   8. R2 쓰기 fail-closed — 멤버(authenticated)도 기존 컨테이너를 직접 UPDATE 할 수 없음
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_wg_*@test.local)
-- ============================================================

BEGIN;
SELECT plan(8);

CREATE TEMP TABLE _wg (k text PRIMARY KEY, v text);

-- 시드 + SECDEF 호출(owner 인증) + 집계 계산을 한 DO 블록에서 수행, 결과를 _wg 에 적재.
DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_c1 uuid; v_c2 uuid;
  v_open uuid := gen_random_uuid();
  v_d text := '2026-07-01';
  v_venue_count int; v_single_count int;
  v_stats_total bigint;
  v_shape boolean;
BEGIN
  -- 0. seed: owner(employer) + staff + workspace(owner 소유)
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wg_owner@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"WG_OWNER"}'::jsonb, now(), now()),
    (v_staff, '__sql_fixture_wg_staff@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"WG_STAFF"}'::jsonb, now(), now());
  -- baseline(2026-07-12): on_auth_user_created 트리거 공존(선점 행/기본 워크스페이스 정리)
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner, '__sql_fixture_wg_owner@test.local', 'WG_OWNER', 'employer'::user_role, true, now(), now()),
    (v_staff, '__sql_fixture_wg_staff@test.local', 'WG_STAFF', 'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_wg_ws', v_owner, now(), now());

  -- 인증 컨텍스트 = owner (SECDEF 함수의 auth.uid())
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- (1) E3 멱등: 2회 호출 → 동일 containerId
  v_c1 := (public.get_or_create_venue_container(v_ws, '운영처A', 'dated') ->> 'containerId')::uuid;
  v_c2 := (public.get_or_create_venue_container(v_ws, '운영처A', 'dated') ->> 'containerId')::uuid;
  INSERT INTO _wg VALUES ('idempotent', (v_c1 = v_c2 AND v_c1 IS NOT NULL)::text);

  -- (2) shape
  SELECT (status = 'container'
          AND total_positions = 0
          AND venue_id = id
          AND schedule ->> 'kind' = 'dated'
          AND schedule -> 'softTargets' = '{}'::jsonb)
    INTO v_shape FROM public.job_postings WHERE id = v_c1;
  INSERT INTO _wg VALUES ('shape', v_shape::text);

  -- open 공고: 같은 venue 를 가리킴(confirm_application 으로 유입되는 인원의 anchor)
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, venue_id, total_positions, created_at, updated_at)
  VALUES (v_open, v_owner, v_ws, '__sql_fixture_wg_open', 'active'::posting_status, 'regular'::posting_type, v_c1, 1, now(), now());

  -- work_logs: 컨테이너 2(scheduled) + open 1(scheduled) + 컨테이너 1(cancelled, 집계 제외)
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role) VALUES
    (v_staff, v_c1,   v_d, 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c1,   v_d, 'scheduled'::work_log_status, 'floor'::staff_role),
    (v_staff, v_open, v_d, 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_c1,   v_d, 'cancelled'::work_log_status, 'dealer'::staff_role);

  -- (3) E1 venue 스팬 COUNT = 3
  SELECT count(*) INTO v_venue_count FROM public.work_logs
   WHERE job_posting_id IN (SELECT id FROM public.job_postings WHERE venue_id = v_c1 OR id = v_c1)
     AND date = v_d AND status NOT IN ('cancelled', 'no_show');
  INSERT INTO _wg VALUES ('venue_count', v_venue_count::text);

  -- (4) E1 근거: 단일 컨테이너만 = 2 (open 공고 1 누락)
  SELECT count(*) INTO v_single_count FROM public.work_logs
   WHERE job_posting_id = v_c1 AND date = v_d AND status NOT IN ('cancelled', 'no_show');
  INSERT INTO _wg VALUES ('single_count', v_single_count::text);

  -- (5) R2 통계 누수 차단: owner 의 통계 total 은 컨테이너 제외(open 공고 1만)
  SELECT total INTO v_stats_total FROM public.get_job_posting_stats(v_owner);
  INSERT INTO _wg VALUES ('stats_total', v_stats_total::text);

  -- 쓰기측 테스트(7/8)용 id 보관
  INSERT INTO _wg VALUES ('owner', v_owner::text), ('ws', v_ws::text), ('container', v_c1::text);
END $$;

-- (6) R2 공개 RLS 누수 차단: 외부인(authenticated, 비owner/비멤버)은 컨테이너 미가시.
DO $$
DECLARE v_cnt int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_cnt FROM public.job_postings WHERE status = 'container';
  SET LOCAL ROLE postgres;
  INSERT INTO _wg VALUES ('rls_stranger', v_cnt::text);
END $$;

-- (7/8) R2 쓰기 fail-closed: 워크스페이스 멤버(owner)조차 컨테이너를 직접 INSERT/UPDATE 불가.
-- 컨테이너 쓰기는 SECDEF RPC 전용(restrictive 정책). owner 컨텍스트(멤버)로 시도해도 차단되어야 함.
DO $$
DECLARE
  v_owner uuid; v_ws uuid; v_c1 uuid;
  v_ins_blocked boolean := false;
  v_upd_blocked boolean := false;
BEGIN
  SELECT v::uuid INTO v_owner FROM _wg WHERE k = 'owner';
  SELECT v::uuid INTO v_ws FROM _wg WHERE k = 'ws';
  SELECT v::uuid INTO v_c1 FROM _wg WHERE k = 'container';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- 직접 INSERT 컨테이너 → restrictive WITH CHECK 로 RLS 위반(42501)
  BEGIN
    INSERT INTO public.job_postings (workspace_id, owner_id, title, status, posting_type)
    VALUES (v_ws, v_owner, '__sql_fixture_wg_hack', 'container'::posting_status, 'regular'::posting_type);
  EXCEPTION WHEN insufficient_privilege THEN v_ins_blocked := true;
  END;

  -- 기존 컨테이너 직접 UPDATE → restrictive USING(status<>container) 로 0행(미가시) 또는 위반
  BEGIN
    UPDATE public.job_postings SET title = '__sql_fixture_wg_tamper' WHERE id = v_c1;
    IF NOT FOUND THEN v_upd_blocked := true; END IF;
  EXCEPTION WHEN insufficient_privilege THEN v_upd_blocked := true;
  END;

  SET LOCAL ROLE postgres;
  INSERT INTO _wg VALUES ('ins_blocked', v_ins_blocked::text), ('upd_blocked', v_upd_blocked::text);
END $$;

SELECT ok((SELECT v FROM _wg WHERE k = 'idempotent') = 'true',
  'E3: get_or_create_venue_container 멱등 — 2회 호출 동일 containerId');
SELECT ok((SELECT v FROM _wg WHERE k = 'shape') = 'true',
  '컨테이너 shape: status=container, total=0, venue_id=self, kind=dated, softTargets={}');
SELECT is((SELECT v FROM _wg WHERE k = 'venue_count'), '3',
  'E1: venue 스팬 COUNT = 컨테이너2 + open공고1 (cancelled 제외)');
SELECT is((SELECT v FROM _wg WHERE k = 'single_count'), '2',
  'E1 근거: 단일 컨테이너만 보면 open공고 인원 누락(2)');
SELECT is((SELECT v FROM _wg WHERE k = 'stats_total'), '1',
  'R2: get_job_posting_stats total 은 컨테이너 제외(open공고 1만)');
SELECT is((SELECT v FROM _wg WHERE k = 'rls_stranger'), '0',
  'R2: 외부인(authenticated)은 컨테이너를 RLS 로 볼 수 없다');
SELECT is((SELECT v FROM _wg WHERE k = 'ins_blocked'), 'true',
  'R2: 멤버도 컨테이너 직접 INSERT 불가(SECDEF RPC 전용)');
SELECT is((SELECT v FROM _wg WHERE k = 'upd_blocked'), 'true',
  'R2: 멤버도 기존 컨테이너 직접 UPDATE 불가');

SELECT * FROM finish();
ROLLBACK;
