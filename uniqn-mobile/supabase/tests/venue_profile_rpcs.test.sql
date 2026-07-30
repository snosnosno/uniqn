-- ============================================================
-- 지점 프로필 RPC 2종 — update_venue_container / get_my_venue_contexts
-- 마이그: 20260731120000_venue_profile_rpcs.sql (S1 / 묶음 1-B)
-- ============================================================
-- 검증:
--   1  owner 가 이름·장소·연락처·소개를 갱신하면 반환 jsonb 에 반영된다
--   2  DB 에 실제로 저장된다(location jsonb / contact_phone / description)
--   3  NULL 인자 = 미변경 — **1번이 심은 non-null 값 위에서** 확인(신선 행이면 vacuous)
--   4  빈 문자열 = 제거(contact_phone → NULL), 나머지 필드는 불변
--   5  지점명 공백만 → INVALID_INPUT
--   6  지점명 51자 → INVALID_INPUT
--   7  location 미허용 키 → INVALID_INPUT (화이트리스트 fail-closed)
--   8  p_defaults 에 시간 키 → INVALID_INPUT (사용자 결정 4 를 서버가 강제)
--   9  p_defaults 병합이 schedule 형제 키(kind·roleSalaries·softTargets)를 보존한다
--      🔴 kind 는 uniq_venue_container 구성요소 — 소실되면 컨테이너 identity 가 깨진다
--   10 동명 지점으로 rename → 23505 가 INVALID_INPUT 한글 메시지로 변환된다
--   11 워크스페이스 외부인 → PERMISSION_DENIED. **실존 컨테이너 대상**이어야 한다
--      (없는 id 면 VENUE_NOT_FOUND 가 먼저 나와 권한 게이트를 한 번도 안 태운다)
--   12 get_my_venue_contexts: 활성 배치 staff → 1행 + 값 일치
--   13 get_my_venue_contexts: 같은 컨테이너에 cancelled 만 있는 staff → 0행
--      (대조군 = 12번. 필터가 없었다면 매치됐을 구성이어야 vacuous 가 아니다)
--   14 🔴 roleSalaries 가 빈 배열이어도 1행 — 이 RPC 를 별도로 만든 이유.
--      대조군으로 get_my_venue_role_salaries 가 같은 시점에 0행임을 함께 단언한다
--   15 anon EXECUTE 차단 (두 함수 모두)
--
-- 안전: BEGIN/ROLLBACK 래핑 + 마커 이메일(__sql_fixture_vp_*@test.local)
-- JWT 주입은 반드시 jpc_test_set_user 경유 — plural 만 인라인 주입하면 auth.uid() 가
--   직전 사용자로 남는다(fixtures/jpc_helpers.sql:170-178, PR#267 실증)
-- ============================================================

BEGIN;
SELECT plan(15);

CREATE TEMP TABLE _vp (k text PRIMARY KEY, v text);

-- jpc_test_set_user 는 JWT GUC 2종(singular+plural)에 더해 role GUC 까지 'authenticated' 로
-- 바꾼다 — 이건 SET LOCAL ROLE 과 동등해서, 이어지는 픽스처 INSERT 가 work_logs RLS 에 막히고
-- TEMP 테이블 쓰기도 권한 오류가 난다(실측: "new row violates row-level security policy").
-- 이 파일이 검증하는 것은 SECDEF RPC 의 auth.uid() 게이트이지 RLS 가 아니다. 그래서 JWT 주입은
-- 규약대로 헬퍼를 경유하고(singular/plural 불일치 함정 회피), role 만 postgres 로 되돌린다.
CREATE OR REPLACE FUNCTION pg_temp.vp_act_as(p_user uuid) RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM jpc_test_set_user(p_user);
  PERFORM set_config('role', 'postgres', true);
END;
$fn$;

-- ─────────────────────────────────────────────────────────────
-- 시드 + 1~4번(정상 경로) 수행
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_owner    uuid := gen_random_uuid();
  v_staff    uuid := gen_random_uuid();  -- 활성 배치 (12/14번 대조군)
  v_cancel   uuid := gen_random_uuid();  -- 같은 컨테이너, cancelled 만 (13번)
  v_outsider uuid := gen_random_uuid();  -- 워크스페이스 무관 (11번)
  v_ws       uuid := gen_random_uuid();
  v_c1 uuid; v_c2 uuid;
  v_ret jsonb;
  v_d text := '2026-08-01';
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_vp_owner@test.local',    'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"VP_OWNER"}'::jsonb,    now(), now()),
    (v_staff,    '__sql_fixture_vp_staff@test.local',    'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"VP_STAFF"}'::jsonb,    now(), now()),
    (v_cancel,   '__sql_fixture_vp_cancel@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"VP_CANCEL"}'::jsonb,   now(), now()),
    (v_outsider, '__sql_fixture_vp_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"VP_OUTSIDER"}'::jsonb, now(), now());

  -- on_auth_user_created 트리거 공존(선점 행 정리) — failclosed 테스트와 동일 관용구
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_vp_owner@test.local',    'VP_OWNER',    'employer'::user_role, true, now(), now()),
    (v_staff,    '__sql_fixture_vp_staff@test.local',    'VP_STAFF',    'staff'::user_role,    true, now(), now()),
    (v_cancel,   '__sql_fixture_vp_cancel@test.local',   'VP_CANCEL',   'staff'::user_role,    true, now(), now()),
    (v_outsider, '__sql_fixture_vp_outsider@test.local', 'VP_OUTSIDER', 'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_vp_ws', v_owner, now(), now());

  PERFORM pg_temp.vp_act_as(v_owner);

  -- 컨테이너 2개: c1 = 편집 대상, c2 = 동명 충돌(10번) 대상
  v_c1 := (public.get_or_create_venue_container(v_ws, '지점A', 'dated') ->> 'containerId')::uuid;
  v_c2 := (public.get_or_create_venue_container(v_ws, '지점B', 'dated') ->> 'containerId')::uuid;

  -- work_logs: staff = 활성, cancel = 취소만. 둘 다 같은 컨테이너·같은 날짜
  -- (13번이 "필터가 없었다면 매치됐을" 구성이 되도록 staff_id 만 다르게 둔다)
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, status, role) VALUES
    (v_staff,  v_c1, v_d, 'scheduled'::work_log_status, 'dealer'::staff_role),
    (v_cancel, v_c1, v_d, 'cancelled'::work_log_status, 'dealer'::staff_role);

  -- (1) 정상 갱신
  v_ret := public.update_venue_container(
    v_c1,
    p_name          := '홀덤펍 강남점',
    p_location      := '{"name":"강남 홀덤펍","detailedAddress":"3층"}'::jsonb,
    p_contact_phone := '010-1234-5678',
    p_description   := '역삼역 3번 출구 도보 2분'
  );
  INSERT INTO _vp VALUES ('t1_name', v_ret ->> 'name');

  -- (2) 저장 확인
  INSERT INTO _vp
  SELECT 't2_row',
         (jp.location ->> 'name') || '|' || (jp.location ->> 'detailedAddress')
         || '|' || COALESCE(jp.contact_phone, '<null>') || '|' || COALESCE(jp.description, '<null>')
  FROM public.job_postings jp WHERE jp.id = v_c1;

  -- (3) NULL = 미변경 — 위에서 심은 non-null 값 위에서 확인해야 의미가 있다
  PERFORM public.update_venue_container(v_c1);
  INSERT INTO _vp
  SELECT 't3_row',
         jp.title || '|' || (jp.location ->> 'name')
         || '|' || COALESCE(jp.contact_phone, '<null>') || '|' || COALESCE(jp.description, '<null>')
  FROM public.job_postings jp WHERE jp.id = v_c1;

  -- (4) 빈 문자열 = 제거. 연락처만 지우고 나머지는 불변이어야 한다
  PERFORM public.update_venue_container(v_c1, p_contact_phone := '');
  INSERT INTO _vp
  SELECT 't4_row',
         COALESCE(jp.contact_phone, '<null>') || '|' || jp.title || '|' || (jp.location ->> 'name')
  FROM public.job_postings jp WHERE jp.id = v_c1;

  -- (14) 🔴 roleSalaries 를 **아직 넣기 전에** 측정한다 — 이 시점 컨테이너의 단가표는 빈 상태.
  --      contexts 는 1행, role_salaries 는 0행이어야 "LATERAL 회피"가 실증된다.
  PERFORM pg_temp.vp_act_as(v_staff);
  INSERT INTO _vp
  SELECT 't14_pair',
         (SELECT count(*) FROM public.get_my_venue_contexts(ARRAY[v_c1]))::text
         || '/' ||
         (SELECT count(*) FROM public.get_my_venue_role_salaries(ARRAY[v_c1]))::text;

  -- (12) 활성 배치 staff → 1행 + 값 일치
  INSERT INTO _vp
  SELECT 't12_row',
         c.title || '|' || (c.location ->> 'name') || '|' || COALESCE(c.owner_name, '<null>')
  FROM public.get_my_venue_contexts(ARRAY[v_c1]) c;

  -- (13) 같은 컨테이너에 cancelled 만 있는 staff → 0행
  PERFORM pg_temp.vp_act_as(v_cancel);
  INSERT INTO _vp
  SELECT 't13_count', (SELECT count(*) FROM public.get_my_venue_contexts(ARRAY[v_c1]))::text;

  INSERT INTO _vp VALUES
    ('c1', v_c1::text), ('c2', v_c2::text),
    ('owner', v_owner::text), ('outsider', v_outsider::text), ('ws', v_ws::text);
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5~11번(거부 경로 + 형제 키 보존)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_c1 uuid; v_c2 uuid; v_owner uuid; v_outsider uuid;
BEGIN
  SELECT v::uuid INTO v_c1       FROM _vp WHERE k = 'c1';
  SELECT v::uuid INTO v_c2       FROM _vp WHERE k = 'c2';
  SELECT v::uuid INTO v_owner    FROM _vp WHERE k = 'owner';
  SELECT v::uuid INTO v_outsider FROM _vp WHERE k = 'outsider';

  PERFORM pg_temp.vp_act_as(v_owner);

  -- (5) 공백만인 지점명
  BEGIN
    PERFORM public.update_venue_container(v_c1, p_name := '   ');
    INSERT INTO _vp VALUES ('t5', '<no error>');
  EXCEPTION WHEN others THEN INSERT INTO _vp VALUES ('t5', SQLERRM);
  END;

  -- (6) 51자
  BEGIN
    PERFORM public.update_venue_container(v_c1, p_name := repeat('가', 51));
    INSERT INTO _vp VALUES ('t6', '<no error>');
  EXCEPTION WHEN others THEN INSERT INTO _vp VALUES ('t6', SQLERRM);
  END;

  -- (7) location 미허용 키
  BEGIN
    PERFORM public.update_venue_container(v_c1, p_location := '{"latitude":"37.5"}'::jsonb);
    INSERT INTO _vp VALUES ('t7', '<no error>');
  EXCEPTION WHEN others THEN INSERT INTO _vp VALUES ('t7', SQLERRM);
  END;

  -- (8) p_defaults 시간 키 — 결정 4 서버 강제
  BEGIN
    PERFORM public.update_venue_container(v_c1, p_defaults := '{"defaultTime":"18:00"}'::jsonb);
    INSERT INTO _vp VALUES ('t8', '<no error>');
  EXCEPTION WHEN others THEN INSERT INTO _vp VALUES ('t8', SQLERRM);
  END;

  -- (9) 형제 키 보존: 먼저 softTarget·roleSalary 를 심어 대조군을 만든 뒤 p_defaults 병합
  PERFORM public.set_venue_soft_target(v_c1, '2026-08-01', 3);
  PERFORM public.set_venue_role_salary(v_c1, 'dealer', NULL, 'hourly', 20000);
  PERFORM public.update_venue_container(v_c1, p_defaults := '{"roles":["dealer","floor"]}'::jsonb);
  INSERT INTO _vp
  SELECT 't9_row',
         COALESCE(jp.schedule ->> 'kind', '<null>')
         || '|' || COALESCE(jp.schedule -> 'softTargets' ->> '2026-08-01', '<null>')
         || '|' || COALESCE(jsonb_array_length(jp.schedule -> 'roleSalaries')::text, '<null>')
         || '|' || COALESCE(jsonb_array_length(jp.schedule -> 'venueProfile' -> 'roles')::text, '<null>')
  FROM public.job_postings jp WHERE jp.id = v_c1;

  -- (10) 동명 rename → 23505 변환
  BEGIN
    PERFORM public.update_venue_container(v_c1, p_name := '지점B');
    INSERT INTO _vp VALUES ('t10', '<no error>');
  EXCEPTION WHEN others THEN INSERT INTO _vp VALUES ('t10', SQLERRM);
  END;

  -- (11) 외부인 → PERMISSION_DENIED. **실존 컨테이너**를 대상으로 해야 권한 게이트를 탄다
  PERFORM pg_temp.vp_act_as(v_outsider);
  BEGIN
    PERFORM public.update_venue_container(v_c1, p_name := '탈취 시도');
    INSERT INTO _vp VALUES ('t11', '<no error>');
  EXCEPTION WHEN others THEN INSERT INTO _vp VALUES ('t11', SQLERRM);
  END;

  PERFORM jpc_test_clear_user();
END $$;

-- ─────────────────────────────────────────────────────────────
-- 단언
-- ─────────────────────────────────────────────────────────────
SELECT is((SELECT v FROM _vp WHERE k = 't1_name'), '홀덤펍 강남점',
  '1: update_venue_container 반환 jsonb 에 새 지점명이 담긴다');

SELECT is((SELECT v FROM _vp WHERE k = 't2_row'),
  '강남 홀덤펍|3층|010-1234-5678|역삼역 3번 출구 도보 2분',
  '2: location(name/detailedAddress)·contact_phone·description 이 실제로 저장된다');

SELECT is((SELECT v FROM _vp WHERE k = 't3_row'),
  '홀덤펍 강남점|강남 홀덤펍|010-1234-5678|역삼역 3번 출구 도보 2분',
  '3: 인자 전부 NULL = 미변경 (1번이 심은 non-null 값 위에서 확인)');

SELECT is((SELECT v FROM _vp WHERE k = 't4_row'), '<null>|홀덤펍 강남점|강남 홀덤펍',
  '4: 빈 문자열 = 해당 필드만 제거, 나머지는 불변');

SELECT is((SELECT v FROM _vp WHERE k = 't5'), 'INVALID_INPUT: 지점명이 필요합니다',
  '5: 공백만인 지점명 거부');

SELECT is((SELECT v FROM _vp WHERE k = 't6'), 'INVALID_INPUT: 지점명은 50자 이하여야 합니다',
  '6: 51자 지점명 거부');

SELECT is((SELECT v FROM _vp WHERE k = 't7'),
  'INVALID_INPUT: 장소 정보에 허용되지 않는 항목이 있습니다 (latitude)',
  '7: location 키 화이트리스트 fail-closed');

SELECT ok((SELECT v FROM _vp WHERE k = 't8') LIKE 'INVALID_INPUT: 지점 기본값에 허용되지 않는 항목%',
  '8: p_defaults 시간 키 거부 — 기본 근무시간은 지점 설정에 두지 않는다(결정 4)');

SELECT is((SELECT v FROM _vp WHERE k = 't9_row'), 'dated|3|1|2',
  '9: p_defaults 병합이 schedule 형제 키(kind·softTargets·roleSalaries)를 보존한다');

SELECT is((SELECT v FROM _vp WHERE k = 't10'), 'INVALID_INPUT: 같은 이름의 지점이 이미 있습니다',
  '10: uniq_venue_container 23505 → 한글 INVALID_INPUT 으로 변환');

SELECT is((SELECT v FROM _vp WHERE k = 't11'), 'PERMISSION_DENIED: 운영처 관리 권한이 없습니다',
  '11: 워크스페이스 외부인은 실존 컨테이너도 수정 불가');

SELECT is((SELECT v FROM _vp WHERE k = 't12_row'), '홀덤펍 강남점|강남 홀덤펍|VP_OWNER',
  '12: 활성 배치 staff 는 지점 컨텍스트 1행(담당자명은 users.name 폴백)');

SELECT is((SELECT v FROM _vp WHERE k = 't13_count'), '0',
  '13: 같은 컨테이너라도 cancelled 만 남은 staff 는 0행(소프트 취소 필터)');

SELECT is((SELECT v FROM _vp WHERE k = 't14_pair'), '1/0',
  '14: 단가표가 비어도 contexts 는 1행 — role_salaries 는 같은 시점 0행(LATERAL 회피 실증)');

SELECT ok(
  has_function_privilege('anon', 'public.update_venue_container(uuid,text,jsonb,text,text,jsonb)', 'EXECUTE') = false
  AND has_function_privilege('anon', 'public.get_my_venue_contexts(uuid[])', 'EXECUTE') = false,
  '15: anon 은 두 RPC 모두 EXECUTE 불가');

SELECT * FROM finish();
ROLLBACK;
