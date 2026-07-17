-- ============================================================
-- grid-auto-sync Task 1 — get_venue_grid_summary.required_count 파생
-- ============================================================
-- 검증 계약:
--   1. 반환 계약: 함수 시그니처에 required_count 열 존재
--   2. dated 스팬 공고 requirements 날짜별 Σ count 파생:
--        8/10 딜러 2 + 플로어 1 = 3
--   3. fixed(date=null) 스케줄은 required_count 파생 제외 → 0
-- 좌석 규약: SUM of (roles[].count) across role entries (peak MAX 아님), dated only.
-- 안전: 단일 BEGIN/ROLLBACK + 마커 이메일. 데이터 의존 값은 _g 임시테이블로
--   캡처(RED 시 미존재 열은 undefined_column 예외로 잡아 트랜잭션 중단 없이
--   깨끗한 not ok 산출).
-- ============================================================
BEGIN;
SELECT plan(3);

CREATE TEMP TABLE _g (k text PRIMARY KEY, v int);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_cA    uuid;                        -- dated 컨테이너
  v_cB    uuid;                        -- fixed-only 컨테이너
  v_spanA uuid := gen_random_uuid();   -- dated 스팬 공고
  v_spanB uuid := gen_random_uuid();   -- fixed 스팬 공고
  v_req3     int := -1;
  v_reqfixed int := -1;
BEGIN
  -- baseline(2026-07-12): raw_app_meta_data.role 를 public.users role 과 일치시켜
  --   prevent_role_escalation 트리거의 ON CONFLICT role 변경 거부를 회피.
  INSERT INTO auth.users (id,email,aud,role,encrypted_password,raw_app_meta_data,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_gas_owner@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now()),
    (v_staff,'__sql_fixture_gas_staff@test.local','authenticated','authenticated','','{"role":"staff"}'::jsonb,now(),now());
  INSERT INTO public.users (id,email,name,role,is_active,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_gas_owner@test.local','GAS_OWNER','employer',true,now(),now()),
    (v_staff,'__sql_fixture_gas_staff@test.local','GAS_STAFF','staff',true,now(),now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id,name,owner_id,created_at,updated_at) VALUES (v_ws,'__sql_fixture_gas_ws',v_owner,now(),now());

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- 두 개의 운영처 컨테이너 (title+kind 조합이 달라 uniq_venue_container 충돌 없음)
  v_cA := (public.get_or_create_venue_container(v_ws, '운영처GAS_A', 'dated') ->> 'containerId')::uuid;
  v_cB := (public.get_or_create_venue_container(v_ws, '운영처GAS_B', 'fixed') ->> 'containerId')::uuid;

  -- dated 스팬 공고: 8/10 딜러 2 + 플로어 1 (total_positions 는 seat BEFORE 트리거가 재계산)
  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,schedule,created_at,updated_at)
  VALUES (
    v_spanA, v_owner, v_ws, '__sql_fixture_gas_dated', 'active'::posting_status, 'regular'::posting_type, v_cA,
    '{"kind":"dated","requirements":[{"date":"2026-08-10","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":2},{"role":"floor","count":1}]}]}]}'::jsonb,
    now(), now()
  );

  -- fixed 스팬 공고: date=null → required 파생에서 제외되어야 함 (count 5 가 새면 회귀)
  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,schedule,created_at,updated_at)
  VALUES (
    v_spanB, v_owner, v_ws, '__sql_fixture_gas_fixed', 'active'::posting_status, 'regular'::posting_type, v_cB,
    '{"kind":"fixed","requirements":[{"date":null,"timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":5}]}]}]}'::jsonb,
    now(), now()
  );

  -- fixed 컨테이너에 근무 로그 1건 → staffed 비어있지 않게(FULL OUTER JOIN 실 행에서 required_count=0 확인)
  INSERT INTO public.work_logs (staff_id,job_posting_id,date,status,role) VALUES
    (v_staff, v_spanB, '2026-08-15', 'scheduled'::work_log_status, 'dealer'::staff_role);

  -- 데이터 의존 값 캡처 (RED: required_count 열 미존재 → undefined_column → sentinel -1)
  BEGIN
    SELECT required_count INTO v_req3
    FROM public.get_venue_grid_summary(v_cA, '2026-08-01', '2026-08-31')
    WHERE d = '2026-08-10';
  EXCEPTION WHEN undefined_column THEN v_req3 := -1;
  END;

  BEGIN
    SELECT COALESCE(SUM(required_count), 0)::int INTO v_reqfixed
    FROM public.get_venue_grid_summary(v_cB, '2026-08-01', '2026-08-31');
  EXCEPTION WHEN undefined_column THEN v_reqfixed := -1;
  END;

  INSERT INTO _g VALUES ('req3', v_req3), ('reqfixed', v_reqfixed);
END $$;

-- 1) 반환 계약: 시그니처에 required_count 열 포함 (데이터 무관 introspection)
SELECT ok(
  pg_get_function_result('public.get_venue_grid_summary(uuid,text,text)'::regprocedure) LIKE '%required_count%',
  'get_venue_grid_summary 반환 계약에 required_count 열 포함'
);

-- 2) dated requirements 날짜별 Σ count 파생
SELECT is((SELECT v FROM _g WHERE k = 'req3'), 3, 'dated 공고 requirements 날짜별 Σ count 파생 = 3 (딜러2+플로어1)');

-- 3) fixed(date=null) 스케줄 제외
SELECT is((SELECT v FROM _g WHERE k = 'reqfixed'), 0, 'fixed(date=null) 스케줄은 required_count 파생 제외 → 0');

SELECT * FROM finish();
ROLLBACK;
