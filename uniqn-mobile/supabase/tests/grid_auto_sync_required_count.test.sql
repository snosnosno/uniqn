-- ============================================================
-- grid-auto-sync Task 1 — get_venue_grid_summary.required_count 파생
-- ============================================================
-- 검증 계약:
--   1. 반환 계약: 함수 시그니처에 required_count 열 존재
--   2. dated 스팬 공고 requirements 날짜별 Σ count 파생:
--        8/10 딜러 2 + 플로어 1 = 3
--   3. fixed(date=null) 스케줄은 required_count 파생 제외 → 0
--   4. both-sides 병합: 같은 날짜에 staffed work_log + dated requirements 동시
--        → (headcount, required_count) 가 한 행으로 병합(FULL OUTER JOIN)
--   5. headcount-only 폴백: count 없이 {"role":..,"headcount":N} 역할도
--        seat-basis SSOT 와 동일하게 required_count 에 반영(count→headcount COALESCE).
-- 좌석 규약: SUM(GREATEST(COALESCE(count, headcount, 0), 0)) across role entries,
--   빈 role 스킵 — _total_positions_from_schedule 와 동일. dated only.
-- 안전: 단일 BEGIN/ROLLBACK + 마커 이메일. 데이터 의존 값은 _g 임시테이블로
--   캡처(RED 시 미존재 열은 undefined_column 예외로 잡아 트랜잭션 중단 없이
--   깨끗한 not ok 산출).
-- ============================================================
BEGIN;
SELECT plan(9);

CREATE TEMP TABLE _g (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws    uuid := gen_random_uuid();
  v_cA    uuid;                        -- dated 컨테이너
  v_cB    uuid;                        -- fixed-only 컨테이너
  v_spanA uuid := gen_random_uuid();   -- dated 스팬 공고(8/10 count, 8/11 headcount-only)
  v_spanB uuid := gen_random_uuid();   -- fixed 스팬 공고
  v_req3     int := -1;
  v_reqfixed int := -1;
  v_merge_hc int := -1;
  v_merge_rc int := -1;
  v_req_hconly int := -1;
  v_admin uuid := gen_random_uuid();   -- approved 대회 INSERT 전용(보안 트리거 게이트)
  v_cT    uuid;                        -- 대회 컨테이너
  v_tPend uuid := gen_random_uuid();   -- 승인 대기 대회
  v_tAppr uuid := gen_random_uuid();   -- 승인 완료 대회
  v_tRej  uuid := gen_random_uuid();   -- 승인 거절 대회
  v_tNull uuid := gen_random_uuid();   -- tournament_config 자체가 NULL 인 대회(3값 논리 방어)
  v_req_pending int := -1; v_req_approved int := -1; v_req_rejected int := -1;
  v_req_nullcfg int := -1;
BEGIN
  -- baseline(2026-07-12): raw_app_meta_data.role 를 public.users role 과 일치시켜
  --   prevent_role_escalation 트리거의 ON CONFLICT role 변경 거부를 회피.
  INSERT INTO auth.users (id,email,aud,role,encrypted_password,raw_app_meta_data,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_gas_owner@test.local','authenticated','authenticated','','{"role":"employer"}'::jsonb,now(),now()),
    (v_staff,'__sql_fixture_gas_staff@test.local','authenticated','authenticated','','{"role":"staff"}'::jsonb,now(),now()),
    (v_admin,'__sql_fixture_gas_admin@test.local','authenticated','authenticated','','{"role":"admin"}'::jsonb,now(),now());
  INSERT INTO public.users (id,email,name,role,is_active,created_at,updated_at) VALUES
    (v_owner,'__sql_fixture_gas_owner@test.local','GAS_OWNER','employer',true,now(),now()),
    (v_staff,'__sql_fixture_gas_staff@test.local','GAS_STAFF','staff',true,now(),now()),
    (v_admin,'__sql_fixture_gas_admin@test.local','GAS_ADMIN','admin',true,now(),now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;
  INSERT INTO public.workspaces (id,name,owner_id,created_at,updated_at) VALUES (v_ws,'__sql_fixture_gas_ws',v_owner,now(),now());

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- 두 개의 운영처 컨테이너 (title+kind 조합이 달라 uniq_venue_container 충돌 없음)
  v_cA := (public.get_or_create_venue_container(v_ws, '운영처GAS_A', 'dated') ->> 'containerId')::uuid;
  v_cB := (public.get_or_create_venue_container(v_ws, '운영처GAS_B', 'fixed') ->> 'containerId')::uuid;
  v_cT := (public.get_or_create_venue_container(v_ws, '운영처GAS_T', 'dated') ->> 'containerId')::uuid;

  -- dated 스팬 공고:
  --   8/10 딜러 2 + 플로어 1 (count) → required 3
  --   8/11 딜러 headcount 2 (count 없음) → seat-basis 폴백으로 required 2 여야 함
  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,schedule,created_at,updated_at)
  VALUES (
    v_spanA, v_owner, v_ws, '__sql_fixture_gas_dated', 'active'::posting_status, 'regular'::posting_type, v_cA,
    ('{"kind":"dated","requirements":['
      || '{"date":"2026-08-10","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":2},{"role":"floor","count":1}]}]},'
      || '{"date":"2026-08-11","timeSlots":[{"startTime":"18:00","roles":[{"role":"딜러","headcount":2}]}]}'
      || ']}')::jsonb,
    now(), now()
  );

  -- fixed 스팬 공고: date=null → required 파생에서 제외되어야 함 (count 5 가 새면 회귀)
  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,schedule,created_at,updated_at)
  VALUES (
    v_spanB, v_owner, v_ws, '__sql_fixture_gas_fixed', 'active'::posting_status, 'regular'::posting_type, v_cB,
    '{"kind":"fixed","requirements":[{"date":null,"timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":5}]}]}]}'::jsonb,
    now(), now()
  );

  -- 대회 3건: 승인 대기 / 승인 완료 / 승인 거절 — 같은 컨테이너, 서로 다른 날짜
  --   승인 대기 9/01 딜러 8 → required 8 (산입)
  --   승인 완료 9/02 딜러 5 → required 5 (산입)
  --   승인 거절 9/03 딜러 9 → required 0 (배제) ← 이 케이스가 RED
  --   config NULL 9/04 딜러 4 → required 4 (산입) ← 3값 논리 방어 케이스
  -- pending·rejected·NULL 은 employer 컨텍스트로 통과한다(트리거는 approved 쓰기만 게이트).
  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,tournament_config,schedule,created_at,updated_at)
  VALUES
  (
    v_tPend, v_owner, v_ws, '__sql_fixture_gas_t_pending', 'active'::posting_status, 'tournament'::posting_type, v_cT,
    '{"approvalStatus":"pending"}'::jsonb,
    '{"kind":"dated","requirements":[{"date":"2026-09-01","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":8}]}]}]}'::jsonb,
    now(), now()
  ),
  (
    v_tRej, v_owner, v_ws, '__sql_fixture_gas_t_rejected', 'active'::posting_status, 'tournament'::posting_type, v_cT,
    '{"approvalStatus":"rejected","rejectionReason":"테스트용 거절 사유입니다"}'::jsonb,
    '{"kind":"dated","requirements":[{"date":"2026-09-03","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":9}]}]}]}'::jsonb,
    now(), now()
  ),
  -- tournament_config 컬럼은 nullable + default 없음 + CHECK 없음 → 실제로 NULL 이 존재할 수 있다.
  -- 거절이 아니므로 산입되어야 한다. COALESCE 없는 NOT(...) 은 3값 논리로 이 행을 조용히 배제한다.
  (
    v_tNull, v_owner, v_ws, '__sql_fixture_gas_t_nullcfg', 'active'::posting_status, 'tournament'::posting_type, v_cT,
    NULL,
    '{"kind":"dated","requirements":[{"date":"2026-09-04","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":4}]}]}]}'::jsonb,
    now(), now()
  );

  -- 승인 완료 대회는 admin 컨텍스트로만 INSERT 가능하다.
  -- trg_tournament_approval_authority: approvalStatus='approved' 쓰기는 admin JWT 또는
  -- auth.uid() IS NULL(service/Edge Function) 만 허용 — 보안 하드닝 HIGH-2 불변식.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
                      'app_metadata', json_build_object('role','admin'))::text, true);

  INSERT INTO public.job_postings (id,owner_id,workspace_id,title,status,posting_type,venue_id,tournament_config,schedule,created_at,updated_at)
  VALUES (
    v_tAppr, v_owner, v_ws, '__sql_fixture_gas_t_approved', 'active'::posting_status, 'tournament'::posting_type, v_cT,
    '{"approvalStatus":"approved"}'::jsonb,
    '{"kind":"dated","requirements":[{"date":"2026-09-02","timeSlots":[{"startTime":"18:00","roles":[{"role":"dealer","count":5}]}]}]}'::jsonb,
    now(), now()
  );

  -- 인증 컨텍스트를 owner 로 복원한다. get_venue_grid_summary 가
  -- is_workspace_member(v_ws, auth.uid()) 게이트를 통과해야 아래 캡처가 동작한다.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- 8/10 근무 로그 1건(spanA) → 같은 날짜에 staffed+required 동시(both-sides 병합)
  -- fixed 컨테이너에도 1건 → staffed 비어있지 않게(required_count=0 을 실 행에서 확인)
  INSERT INTO public.work_logs (staff_id,job_posting_id,date,status,role) VALUES
    (v_staff, v_spanA, '2026-08-10', 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_staff, v_spanB, '2026-08-15', 'scheduled'::work_log_status, 'dealer'::staff_role);

  -- 데이터 의존 값 캡처 (RED: required_count 열 미존재 → undefined_column → sentinel -1)
  BEGIN
    SELECT required_count INTO v_req3
    FROM public.get_venue_grid_summary(v_cA, '2026-08-01', '2026-08-31')
    WHERE d = '2026-08-10';
  EXCEPTION WHEN undefined_column THEN v_req3 := -1;
  END;

  BEGIN
    SELECT headcount, required_count INTO v_merge_hc, v_merge_rc
    FROM public.get_venue_grid_summary(v_cA, '2026-08-01', '2026-08-31')
    WHERE d = '2026-08-10';
  EXCEPTION WHEN undefined_column THEN v_merge_hc := -1; v_merge_rc := -1;
  END;

  BEGIN
    SELECT required_count INTO v_req_hconly
    FROM public.get_venue_grid_summary(v_cA, '2026-08-01', '2026-08-31')
    WHERE d = '2026-08-11';
  EXCEPTION WHEN undefined_column THEN v_req_hconly := -1;
  END;

  BEGIN
    SELECT COALESCE(SUM(required_count), 0)::int INTO v_reqfixed
    FROM public.get_venue_grid_summary(v_cB, '2026-08-01', '2026-08-31');
  EXCEPTION WHEN undefined_column THEN v_reqfixed := -1;
  END;

  BEGIN
    SELECT COALESCE(required_count, 0) INTO v_req_pending
    FROM public.get_venue_grid_summary(v_cT, '2026-09-01', '2026-09-30')
    WHERE d = '2026-09-01';
  EXCEPTION WHEN undefined_column THEN v_req_pending := -1;
  END;

  BEGIN
    SELECT COALESCE(required_count, 0) INTO v_req_approved
    FROM public.get_venue_grid_summary(v_cT, '2026-09-01', '2026-09-30')
    WHERE d = '2026-09-02';
  EXCEPTION WHEN undefined_column THEN v_req_approved := -1;
  END;

  -- 거절 대회 날짜는 배제되어 행 자체가 없어야 한다 → NOT FOUND 시 0 유지
  v_req_rejected := 0;
  BEGIN
    SELECT COALESCE(required_count, 0) INTO v_req_rejected
    FROM public.get_venue_grid_summary(v_cT, '2026-09-01', '2026-09-30')
    WHERE d = '2026-09-03';
    IF NOT FOUND THEN v_req_rejected := 0; END IF;
  EXCEPTION WHEN undefined_column THEN v_req_rejected := -1;
  END;

  -- config NULL 대회는 산입되어야 한다. 조용히 배제되면 행이 없어 0 이 되고 9번이 RED.
  v_req_nullcfg := 0;
  BEGIN
    SELECT COALESCE(required_count, 0) INTO v_req_nullcfg
    FROM public.get_venue_grid_summary(v_cT, '2026-09-01', '2026-09-30')
    WHERE d = '2026-09-04';
    IF NOT FOUND THEN v_req_nullcfg := 0; END IF;
  EXCEPTION WHEN undefined_column THEN v_req_nullcfg := -1;
  END;

  INSERT INTO _g VALUES
    ('req3',       v_req3::text),
    ('reqfixed',   v_reqfixed::text),
    ('merge',      v_merge_hc::text || '/' || v_merge_rc::text),
    ('req_hconly', v_req_hconly::text),
    ('req_pending',  v_req_pending::text),
    ('req_approved', v_req_approved::text),
    ('req_rejected', v_req_rejected::text),
    ('req_nullcfg',  v_req_nullcfg::text);
END $$;

-- 1) 반환 계약: 시그니처에 required_count 열 포함 (데이터 무관 introspection)
SELECT ok(
  pg_get_function_result('public.get_venue_grid_summary(uuid,text,text)'::regprocedure) LIKE '%required_count%',
  'get_venue_grid_summary 반환 계약에 required_count 열 포함'
);

-- 2) dated requirements 날짜별 Σ count 파생
SELECT is((SELECT v FROM _g WHERE k = 'req3'), '3', 'dated 공고 requirements 날짜별 Σ count 파생 = 3 (딜러2+플로어1)');

-- 3) fixed(date=null) 스케줄 제외
SELECT is((SELECT v FROM _g WHERE k = 'reqfixed'), '0', 'fixed(date=null) 스케줄은 required_count 파생 제외 → 0');

-- 4) both-sides 병합: 같은 날짜에 staffed(headcount=1) + required(=3) 한 행 병합
SELECT is((SELECT v FROM _g WHERE k = 'merge'), '1/3', 'both-sides 병합: 같은 날짜 headcount=1 + required_count=3 (FULL OUTER JOIN)');

-- 5) headcount-only 폴백: count→headcount COALESCE (seat-basis SSOT 일치)
SELECT is((SELECT v FROM _g WHERE k = 'req_hconly'), '2', 'headcount-only 역할도 required_count 반영 = 2 (count→headcount COALESCE)');

-- 6) 승인 대기 대회는 필요 인원에 산입 (제품 결정: 승인 병목 가시화)
SELECT is((SELECT v FROM _g WHERE k = 'req_pending'), '8', '승인 대기(pending) 대회의 좌석은 required_count 에 산입 = 8');

-- 7) 승인 완료 대회는 필요 인원에 산입
SELECT is((SELECT v FROM _g WHERE k = 'req_approved'), '5', '승인 완료(approved) 대회의 좌석은 required_count 에 산입 = 5');

-- 8) 승인 거절 대회는 배제 — 열리지 않을 대회가 영구 부족분으로 남지 않아야 한다
SELECT is((SELECT v FROM _g WHERE k = 'req_rejected'), '0', '승인 거절(rejected) 대회의 좌석은 required_count 에서 배제 = 0');

-- 9) tournament_config 가 NULL 인 대회는 거절이 아니므로 산입되어야 한다(3값 논리 방어)
SELECT is((SELECT v FROM _g WHERE k = 'req_nullcfg'), '4', 'tournament_config NULL 대회는 required_count 에 산입 = 4 (COALESCE 없으면 NULL 3값 논리로 조용히 배제)');

SELECT * FROM finish();
ROLLBACK;
