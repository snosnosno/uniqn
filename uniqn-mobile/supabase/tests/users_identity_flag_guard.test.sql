-- uniqn-mobile/supabase/tests/users_identity_flag_guard.test.sql
-- users.identity_verified 셀프 승격 차단 회귀 (2026-07-25) — 마이그 20260725200000
-- 배경: users_update RLS(셀프 UPDATE 허용, WITH CHECK 없음)로 미인증 유저가 자신의
--   identity_verified=true를 직접 써 본인인증 게이트 전체를 우회 가능했다(보안 리뷰 HIGH).
-- 검증: (1) JWT 없음(직접 SQL/service_role 컨텍스트) UPDATE 허용 (2) 셀프 UPDATE 차단
--       (3) 차단 후 값 불변 (4) 셀프 무관 컬럼(name) UPDATE는 허용 (5) admin UPDATE 허용
--       (6) 값 무변경 전체 row 에코 UPDATE 허용
-- 안전: BEGIN/ROLLBACK + 마커 이메일(__sql_fixture_uifg_*@test.local)
-- 주의: (1)은 t_set_user 호출 전(JWT GUC 미설정 상태)에 실행해야 한다.

BEGIN;
SELECT plan(6);

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
  ('admin', gen_random_uuid()),
  ('victim', gen_random_uuid());

DO $$
DECLARE
  v_admin uuid := (SELECT id FROM _ids WHERE k = 'admin');
  v_victim uuid := (SELECT id FROM _ids WHERE k = 'victim');
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_admin,  '__sql_fixture_uifg_admin@test.local',  'authenticated', 'authenticated', '', '{"role":"admin"}'::jsonb, '{"name":"UIFG_ADMIN"}'::jsonb, now(), now()),
    (v_victim, '__sql_fixture_uifg_victim@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"UIFG_VICTIM"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, identity_verified, created_at, updated_at)
  VALUES
    (v_admin,  '__sql_fixture_uifg_admin@test.local',  'UIFG_ADMIN',  'admin'::user_role, true, true,  now(), now()),
    (v_victim, '__sql_fixture_uifg_victim@test.local', 'UIFG_VICTIM', 'staff'::user_role, true, false, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, identity_verified = EXCLUDED.identity_verified;
END;
$$;

-- (1) JWT 없음(직접 SQL·service_role EF 컨텍스트) — 허용
SELECT lives_ok(
  $q$ UPDATE public.users SET identity_verified = true, identity_verified_at = now()
      WHERE id = (SELECT id FROM _ids WHERE k = 'victim') $q$,
  'JWT 없는 컨텍스트(직접 SQL/service_role)는 identity_verified 변경 허용'
);
-- 원상 복구 (여전히 JWT 없음 — 허용 경로)
UPDATE public.users SET identity_verified = false, identity_verified_at = NULL
WHERE id = (SELECT id FROM _ids WHERE k = 'victim');

-- (2) 셀프 승격 시도 — 차단
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'victim'));
SELECT throws_like(
  $q$ UPDATE public.users SET identity_verified = true
      WHERE id = (SELECT id FROM _ids WHERE k = 'victim') $q$,
  'IDENTITY_FLAG_CHANGE_DENIED%',
  '일반 유저 셀프 identity_verified 변경은 차단'
);

-- (3) 차단 후 값 불변
SELECT is(
  (SELECT identity_verified FROM public.users WHERE id = (SELECT id FROM _ids WHERE k = 'victim')),
  false,
  '차단 후 identity_verified=false 불변'
);

-- (4) 무관 컬럼(name) 셀프 UPDATE는 허용 (UPDATE OF 컬럼 한정 — 트리거 미발화)
SELECT lives_ok(
  $q$ UPDATE public.users SET name = 'UIFG_VICTIM2', updated_at = now()
      WHERE id = (SELECT id FROM _ids WHERE k = 'victim') $q$,
  '무관 컬럼 셀프 UPDATE는 정상 동작'
);

-- (5) admin의 타인 identity_verified 변경 — 허용
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'admin'), 'admin');
SELECT lives_ok(
  $q$ UPDATE public.users SET identity_verified = true, identity_verified_at = now()
      WHERE id = (SELECT id FROM _ids WHERE k = 'victim') $q$,
  'admin은 identity_verified 변경 허용'
);

-- (6) 값 무변경 전체 row 에코 UPDATE — 허용 (일반 유저 JWT로도 통과)
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'victim'));
SELECT lives_ok(
  $q$ UPDATE public.users SET identity_verified = identity_verified,
        identity_verified_at = identity_verified_at, updated_at = now()
      WHERE id = (SELECT id FROM _ids WHERE k = 'victim') $q$,
  '값 무변경 에코 UPDATE는 허용'
);

SELECT * FROM finish();
ROLLBACK;
