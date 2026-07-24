-- uniqn-mobile/supabase/tests/update_user_role_notify.test.sql
-- update_user_role 관리자 role 변경 알림 회귀 (2026-07-25) — 마이그 20260725180000
-- 배경: 관리자가 role을 직접 변경해도 대상 유저에게 아무 신호가 없어 JWT/프로필이 stale로 남음(PR#322와 동일 계열).
--       RPC에 notifications INSERT를 추가해 푸시 수신 시 클라이언트가 refreshProfile(세션 재발급)하도록 한다.
-- 검증: (1) admin 변경 성공 previous_role 반환 (2) users.role 갱신 (3) role_changed 알림 1건
--       (4) 알림 필드(category/priority/link) (5) 동일 role no-op 시 알림 미발생
--       (6) 비admin FORBIDDEN (7) 실패 호출은 알림 미증가
-- 안전: BEGIN/ROLLBACK + 마커 이메일(__sql_fixture_uurn_*@test.local)

BEGIN;
SELECT plan(7);

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
  ('admin',   gen_random_uuid()),
  ('target',  gen_random_uuid()),
  ('outsider', gen_random_uuid());

DO $$
DECLARE
  v_admin uuid := (SELECT id FROM _ids WHERE k = 'admin');
  v_target uuid := (SELECT id FROM _ids WHERE k = 'target');
  v_outsider uuid := (SELECT id FROM _ids WHERE k = 'outsider');
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_admin,    '__sql_fixture_uurn_admin@test.local',    'authenticated', 'authenticated', '', '{"role":"admin"}'::jsonb, '{"name":"UURN_ADMIN"}'::jsonb, now(), now()),
    (v_target,   '__sql_fixture_uurn_target@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"UURN_TARGET"}'::jsonb, now(), now()),
    (v_outsider, '__sql_fixture_uurn_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb, '{"name":"UURN_OUT"}'::jsonb, now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_admin,    '__sql_fixture_uurn_admin@test.local',    'UURN_ADMIN',  'admin'::user_role, true, now(), now()),
    (v_target,   '__sql_fixture_uurn_target@test.local',   'UURN_TARGET', 'staff'::user_role, true, now(), now()),
    (v_outsider, '__sql_fixture_uurn_outsider@test.local', 'UURN_OUT',    'staff'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

-- (1) admin 호출 성공 + previous_role 반환
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'admin'), 'admin');
SELECT is(
  (public.update_user_role((SELECT id FROM _ids WHERE k = 'target'), 'employer')) ->> 'previous_role',
  'staff',
  'admin role 변경 성공 시 previous_role 반환'
);

-- (2) users.role 갱신
SELECT is(
  (SELECT role::text FROM public.users WHERE id = (SELECT id FROM _ids WHERE k = 'target')),
  'employer',
  '대상 유저 role이 employer로 갱신'
);

-- (3) 대상 유저에게 role_changed 알림 1건
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (SELECT id FROM _ids WHERE k = 'target') AND type = 'role_changed'),
  1,
  'role 변경 시 대상 유저에게 role_changed 알림 1건 INSERT'
);

-- (4) 알림 필드 — category/priority/link (푸시 탭 시 설정 화면 랜딩)
SELECT is(
  (SELECT category || '|' || priority || '|' || link FROM public.notifications
    WHERE recipient_id = (SELECT id FROM _ids WHERE k = 'target') AND type = 'role_changed' LIMIT 1),
  'system|high|/settings',
  'role_changed 알림 category=system, priority=high, link=/settings'
);

-- (5) 동일 role no-op — 알림 미발생 (count 그대로 1)
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'admin'), 'admin');
PREPARE _noop AS SELECT public.update_user_role((SELECT id FROM _ids WHERE k = 'target'), 'employer');
EXECUTE _noop;
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (SELECT id FROM _ids WHERE k = 'target') AND type = 'role_changed'),
  1,
  '동일 role no-op 시 알림 미발생'
);

-- (6) 비admin 호출 FORBIDDEN
SELECT t_set_user((SELECT id FROM _ids WHERE k = 'outsider'));
SELECT throws_like(
  $q$ SELECT public.update_user_role((SELECT id FROM _ids WHERE k = 'target'), 'staff') $q$,
  'FORBIDDEN%',
  '비admin 호출은 FORBIDDEN'
);

-- (7) 실패 호출은 알림 미증가
SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE recipient_id = (SELECT id FROM _ids WHERE k = 'target') AND type = 'role_changed'),
  1,
  'FORBIDDEN 실패 호출은 알림 미증가'
);

SELECT * FROM finish();
ROLLBACK;
