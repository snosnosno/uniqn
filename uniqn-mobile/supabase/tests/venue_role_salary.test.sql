-- uniqn-mobile/supabase/tests/venue_role_salary.test.sql
-- set_venue_role_salary 회귀 (2026-07-23) — 마이그 20260723100000
-- 검증: (1) owner upsert (2) 커스텀 역할 upsert — customRole 단위 구분
--       (3) 같은 역할 재설정 = 교체(중복 없음) (4) 삭제(p_salary_type NULL)
--       (5) 무관 사용자 PERMISSION_DENIED (6) orphan(owner NULL)+무관 → fail-closed
--       (7) '협의(other)' 타입 거부 (8) softTargets 보존
-- 안전: BEGIN/ROLLBACK + 마커 이메일(__sql_fixture_vrs_*@test.local)

BEGIN;
SELECT plan(8);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

-- JWT 주입 헬퍼 — singular+plural 동시 설정(wiki jpc-rls-stale-guc: plural 단독 주입 금지)
CREATE OR REPLACE FUNCTION t_set_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
END;
$$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_container uuid;
  v_res jsonb;
  v_deny boolean := false;
  v_deny_orphan boolean := false;
  v_reject_other boolean := false;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_vrs_owner@test.local',    'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"VRS_OWNER"}'::jsonb, now(), now()),
    (v_outsider, '__sql_fixture_vrs_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"VRS_OUT"}'::jsonb,   now(), now());
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_vrs_owner@test.local',    'VRS_OWNER', 'employer'::user_role, true, now(), now()),
    (v_outsider, '__sql_fixture_vrs_outsider@test.local', 'VRS_OUT',   'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_vrs_ws', v_owner, now(), now());

  PERFORM t_set_user(v_owner);
  v_container := (public.get_or_create_venue_container(v_ws, '운영처VRS', 'dated') ->> 'containerId')::uuid;
  -- softTargets 보존 검증용 선행 데이터
  PERFORM public.set_venue_soft_target(v_container, '2026-08-01', 3);

  -- (1) owner upsert
  v_res := public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 20000);
  INSERT INTO _t VALUES ('t1_dealer', (v_res -> 'roleSalaries' -> 0 -> 'salary' ->> 'amount'));

  -- (2) 커스텀 역할 upsert
  v_res := public.set_venue_role_salary(v_container, 'other', '칩 러너', 'daily', 150000);
  INSERT INTO _t VALUES ('t2_count', jsonb_array_length(v_res -> 'roleSalaries')::text);

  -- (3) 같은 역할 재설정 = 교체
  v_res := public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 22000);
  INSERT INTO _t VALUES ('t3_count', jsonb_array_length(v_res -> 'roleSalaries')::text);

  -- (4) 삭제
  v_res := public.set_venue_role_salary(v_container, 'other', '칩 러너', NULL, NULL);
  INSERT INTO _t VALUES ('t4_count', jsonb_array_length(v_res -> 'roleSalaries')::text);

  -- (7) '협의' 거부
  BEGIN
    PERFORM public.set_venue_role_salary(v_container, 'dealer', NULL, 'other', 0);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'INVALID_INPUT%' THEN v_reject_other := true; END IF;
  END;
  INSERT INTO _t VALUES ('t7_reject_other', v_reject_other::text);

  -- (8) softTargets 보존
  INSERT INTO _t
  SELECT 't8_soft', schedule -> 'softTargets' ->> '2026-08-01'
  FROM public.job_postings WHERE id = v_container;

  -- (5) 무관 사용자 차단
  PERFORM t_set_user(v_outsider);
  BEGIN
    PERFORM public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 9999);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny := true; END IF;
  END;
  INSERT INTO _t VALUES ('t5_deny', v_deny::text);

  -- (6) orphan(owner NULL) fail-closed
  UPDATE public.job_postings SET owner_id = NULL WHERE id = v_container;
  BEGIN
    PERFORM public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 9999);
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE 'PERMISSION_DENIED%' THEN v_deny_orphan := true; END IF;
  END;
  INSERT INTO _t VALUES ('t6_deny_orphan', v_deny_orphan::text);
END;
$$;

SELECT is((SELECT v FROM _t WHERE k = 't1_dealer'), '20000', 'owner 가 dealer 시급을 설정한다');
SELECT is((SELECT v FROM _t WHERE k = 't2_count'), '2', '커스텀 역할이 별도 엔트리로 추가된다');
SELECT is((SELECT v FROM _t WHERE k = 't3_count'), '2', '같은 역할 재설정은 교체(중복 없음)');
SELECT is((SELECT v FROM _t WHERE k = 't4_count'), '1', 'p_salary_type NULL 은 해당 엔트리 삭제');
SELECT is((SELECT v FROM _t WHERE k = 't5_deny'), 'true', '무관 사용자는 PERMISSION_DENIED');
SELECT is((SELECT v FROM _t WHERE k = 't6_deny_orphan'), 'true', 'orphan 컨테이너도 fail-closed');
SELECT is((SELECT v FROM _t WHERE k = 't7_reject_other'), 'true', '협의(other) 타입은 거부');
SELECT is((SELECT v FROM _t WHERE k = 't8_soft'), '3', 'softTargets 는 보존된다');

SELECT * FROM finish();
ROLLBACK;
