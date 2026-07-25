-- uniqn-mobile/supabase/tests/employer_app_identity_gate.test.sql
-- 구인자 신청/승인 본인인증 서버 게이트 회귀 (2026-07-25) — 마이그 20260725190000
-- 배경: approve_employer_application·register_as_employer가 users.identity_verified를
--   검사하지 않아, 클라이언트 버튼 게이트만으로 미인증 신청자가 employer 권한을
--   획득 가능했다(애플로그인 세션 [HIGH] 본인인증 서버 게이트 부재와 동일 계열).
-- 검증: (1) 미인증 신청자 승인 차단 (2) 차단 시 신청 pending 유지 (3) 차단 시 role 유지
--       (4) identity_verified NULL도 차단(fail-closed) (5) 인증 신청자 승인 성공
--       (6) 승인 후 role=employer (7) 미인증 유저 신청 생성 차단 (8) 인증 유저 신청 생성 성공
-- 안전: BEGIN/ROLLBACK + 마커 이메일(__sql_fixture_eaig_*@test.local)

BEGIN;
SELECT plan(8);

-- JWT 주입 헬퍼 — singular+plural 동시 설정(wiki jpc-rls-stale-guc: plural 단독 주입 금지)
CREATE OR REPLACE FUNCTION t_set_user(p_user_id uuid, p_app_role text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_claims jsonb := jsonb_build_object('sub', p_user_id, 'role', 'authenticated');
BEGIN
  IF p_app_role IS NOT NULL THEN
    v_claims := v_claims || jsonb_build_object('app_metadata', jsonb_build_object('role', p_app_role));
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', v_claims::text, true);
END;
$$;

CREATE TEMP TABLE _ids (k text PRIMARY KEY, id uuid);
INSERT INTO _ids VALUES
  ('admin',       gen_random_uuid()),
  ('unverified',  gen_random_uuid()),
  ('nullverified', gen_random_uuid()),
  ('verified',    gen_random_uuid()),
  ('registrant',  gen_random_uuid()),
  ('app_unverified',  gen_random_uuid()),
  ('app_nullverified', gen_random_uuid()),
  ('app_verified',    gen_random_uuid());

DO $$
DECLARE
  v_admin uuid := (SELECT id FROM _ids WHERE k = 'admin');
  v_unv uuid := (SELECT id FROM _ids WHERE k = 'unverified');
  v_nul uuid := (SELECT id FROM _ids WHERE k = 'nullverified');
  v_ver uuid := (SELECT id FROM _ids WHERE k = 'verified');
  v_reg uuid := (SELECT id FROM _ids WHERE k = 'registrant');
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_admin, '__sql_fixture_eaig_admin@test.local', 'authenticated', 'authenticated', '', '{"role":"admin"}'::jsonb, '{"name":"EAIG_ADMIN"}'::jsonb, now(), now()),
    (v_unv,   '__sql_fixture_eaig_unv@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"EAIG_UNV"}'::jsonb,   now(), now()),
    (v_nul,   '__sql_fixture_eaig_nul@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"EAIG_NUL"}'::jsonb,   now(), now()),
    (v_ver,   '__sql_fixture_eaig_ver@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"EAIG_VER"}'::jsonb,   now(), now()),
    (v_reg,   '__sql_fixture_eaig_reg@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"EAIG_REG"}'::jsonb,   now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, identity_verified, created_at, updated_at)
  VALUES
    (v_admin, '__sql_fixture_eaig_admin@test.local', 'EAIG_ADMIN', 'admin'::user_role, true, true,  now(), now()),
    (v_unv,   '__sql_fixture_eaig_unv@test.local',   'EAIG_UNV',   'staff'::user_role, true, false, now(), now()),
    (v_nul,   '__sql_fixture_eaig_nul@test.local',   'EAIG_NUL',   'staff'::user_role, true, NULL,  now(), now()),
    (v_ver,   '__sql_fixture_eaig_ver@test.local',   'EAIG_VER',   'staff'::user_role, true, true,  now(), now()),
    (v_reg,   '__sql_fixture_eaig_reg@test.local',   'EAIG_REG',   'staff'::user_role, true, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, identity_verified = EXCLUDED.identity_verified;
  INSERT INTO public.employer_applications (id, user_id, status, submitted_at, agreements_snapshot, created_at)
  VALUES
    ((SELECT id FROM _ids WHERE k = 'app_unverified'),  v_unv, 'pending', now(), '{}'::jsonb, now()),
    ((SELECT id FROM _ids WHERE k = 'app_nullverified'), v_nul, 'pending', now(), '{}'::jsonb, now()),
    ((SELECT id FROM _ids WHERE k = 'app_verified'),    v_ver, 'pending', now(), '{}'::jsonb, now());
END;
$$;

-- (1) 미인증(false) 신청자 승인 → 차단
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'admin'), 'admin');
SELECT throws_like(
  $q$ SELECT public.approve_employer_application((SELECT id FROM _ids WHERE k = 'app_unverified')) $q$,
  'EMPLOYER_APP_IDENTITY_NOT_VERIFIED%',
  '미인증 신청자 승인은 EMPLOYER_APP_IDENTITY_NOT_VERIFIED로 차단'
);

-- (2) 차단된 신청은 pending 유지
SELECT is(
  (SELECT status FROM public.employer_applications WHERE id = (SELECT id FROM _ids WHERE k = 'app_unverified')),
  'pending',
  '차단된 신청은 pending 유지'
);

-- (3) 차단된 신청자 role은 staff 유지
SELECT is(
  (SELECT role::text FROM public.users WHERE id = (SELECT id FROM _ids WHERE k = 'unverified')),
  'staff',
  '차단된 신청자 role은 staff 유지'
);

-- (4) identity_verified NULL도 차단 (fail-closed)
SELECT throws_like(
  $q$ SELECT public.approve_employer_application((SELECT id FROM _ids WHERE k = 'app_nullverified')) $q$,
  'EMPLOYER_APP_IDENTITY_NOT_VERIFIED%',
  'identity_verified NULL도 차단 (fail-closed)'
);

-- (5) 인증된 신청자 승인 성공
SELECT is(
  (public.approve_employer_application((SELECT id FROM _ids WHERE k = 'app_verified'))) ->> 'success',
  'true',
  '인증된 신청자 승인 성공'
);

-- (6) 승인 후 role=employer
SELECT is(
  (SELECT role::text FROM public.users WHERE id = (SELECT id FROM _ids WHERE k = 'verified')),
  'employer',
  '승인 후 role=employer'
);

-- (7) 미인증 유저의 신청 생성 차단
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'registrant'));
SELECT throws_like(
  $q$ SELECT public.register_as_employer('{}'::jsonb, NULL) $q$,
  'EMPLOYER_APP_IDENTITY_NOT_VERIFIED%',
  '미인증 유저의 register_as_employer 차단'
);

-- (8) 인증 유저의 신청 생성 성공
-- identity_verified 세팅은 admin JWT로 수행 (20260725200000 컬럼 가드 트리거가 셀프 변경 차단)
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'admin'), 'admin');
UPDATE public.users SET identity_verified = true WHERE id = (SELECT id FROM _ids WHERE k = 'registrant');
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'registrant'));
SELECT is(
  (public.register_as_employer('{}'::jsonb, NULL)) ->> 'success',
  'true',
  '인증 유저의 register_as_employer 성공'
);

SELECT * FROM finish();
ROLLBACK;
