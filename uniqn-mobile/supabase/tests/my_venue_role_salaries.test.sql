-- uniqn-mobile/supabase/tests/my_venue_role_salaries.test.sql
-- get_my_venue_role_salaries 회귀 (2026-07-28) — 마이그 20260728185802
--
-- 배경: 이 RPC 는 신설(20260724130000) 이후 pgTAP 커버리지가 0이었다. #357(20260727112025)이
--   remove_direct_staff 를 하드 DELETE → status='cancelled' 소프트 취소로 바꾸면서
--   "work_log 행이 있다 == 지금 배치돼 있다"는 전제가 깨졌고, 근무표에서 빠진 스태프가
--   지점 단가표를 계속 조회하게 됐다. 아래 (2)가 그 회귀를 직접 겨냥한다.
--
-- 검증: (1) 배치된 staff 는 컨테이너 단가표를 읽는다 [양성 대조 — sparse data 공허통과 방지]
--       (2) 소프트 취소된 staff 는 못 읽는다 [회귀 핵심]
--       (3) 배정된 적 없는 무관 staff 는 못 읽는다 [기존 계약]
--       (4) 배정 2건 중 1건만 취소되면 계속 읽는다 [과잉 차단 방지]
--       (5) no_show 배정만 남은 staff 는 못 읽는다
--       (6) 컨테이너가 아닌 일반 공고는 배정이 있어도 안 나온다 [status='container' 절 가드]
-- 안전: BEGIN/ROLLBACK + 마커 이메일(__sql_fixture_mvrs_*@test.local)

BEGIN;
SELECT plan(7);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

-- JWT 주입 헬퍼 — singular+plural 동시 설정(wiki jpc-rls-stale-guc: plural 단독 주입 금지)
CREATE OR REPLACE FUNCTION t_mvrs_set_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true);
END;
$$;

DO $$
DECLARE
  v_owner   uuid := gen_random_uuid();
  v_staff   uuid := gen_random_uuid();  -- (1)(2): 배정 1건 → 취소
  v_staff2  uuid := gen_random_uuid();  -- (4): 배정 2건 → 1건만 취소
  v_noshow  uuid := gen_random_uuid();  -- (5): 배정 1건 → no_show
  v_outsider uuid := gen_random_uuid(); -- (3): 배정 없음
  v_normal_staff uuid := gen_random_uuid(); -- (6): 일반 공고에만 배정
  v_ws uuid := gen_random_uuid();
  v_container uuid;
  v_normal uuid := gen_random_uuid();
  v_wl uuid;
  v_wl_noshow uuid;
  v_res jsonb;
BEGIN
  INSERT INTO auth.users (id, email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,        '__sql_fixture_mvrs_owner@test.local',    'authenticated', 'authenticated', '', '{"role":"employer"}'::jsonb, '{"name":"MVRS_OWNER"}'::jsonb, now(), now()),
    (v_staff,        '__sql_fixture_mvrs_staff@test.local',    'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"MVRS_STAFF"}'::jsonb, now(), now()),
    (v_staff2,       '__sql_fixture_mvrs_staff2@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"MVRS_STAFF2"}'::jsonb, now(), now()),
    (v_noshow,       '__sql_fixture_mvrs_noshow@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"MVRS_NOSHOW"}'::jsonb, now(), now()),
    (v_outsider,     '__sql_fixture_mvrs_outsider@test.local', 'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"MVRS_OUT"}'::jsonb,   now(), now()),
    (v_normal_staff, '__sql_fixture_mvrs_normal@test.local',   'authenticated', 'authenticated', '', '{"role":"staff"}'::jsonb,    '{"name":"MVRS_NORMAL"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    (v_owner,        '__sql_fixture_mvrs_owner@test.local',    'MVRS_OWNER',  'employer'::user_role, true, now(), now()),
    (v_staff,        '__sql_fixture_mvrs_staff@test.local',    'MVRS_STAFF',  'staff'::user_role,    true, now(), now()),
    (v_staff2,       '__sql_fixture_mvrs_staff2@test.local',   'MVRS_STAFF2', 'staff'::user_role,    true, now(), now()),
    (v_noshow,       '__sql_fixture_mvrs_noshow@test.local',   'MVRS_NOSHOW', 'staff'::user_role,    true, now(), now()),
    (v_outsider,     '__sql_fixture_mvrs_outsider@test.local', 'MVRS_OUT',    'staff'::user_role,    true, now(), now()),
    (v_normal_staff, '__sql_fixture_mvrs_normal@test.local',   'MVRS_NORMAL', 'staff'::user_role,    true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_mvrs_ws', v_owner, now(), now());

  PERFORM t_mvrs_set_user(v_owner);
  v_container := (public.get_or_create_venue_container(v_ws, '운영처MVRS', 'dated') ->> 'containerId')::uuid;

  -- 단가표가 비어 있으면 이 RPC 는 무조건 0행이라 모든 단언이 공허 통과한다.
  -- 반드시 엔트리를 먼저 심는다(양성 대조의 전제).
  PERFORM public.set_venue_role_salary(v_container, 'dealer', NULL, 'hourly', 20000);

  -- 일반 공고(비컨테이너) + 동일 단가표 — (6) 검증용. set_venue_role_salary 는 컨테이너 전용이라
  -- schedule 을 직접 심는다.
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, status, posting_type, schedule, created_at, updated_at)
  VALUES (v_normal, v_owner, v_ws, '__sql_fixture_mvrs_normal_posting', 'active'::posting_status, 'regular'::posting_type,
          '{"roleSalaries":[{"role":"dealer","salary":{"type":"hourly","amount":20000}}]}'::jsonb, now(), now());

  -- 배정 생성 (실제 경로: add_direct_staff)
  v_res := public.add_direct_staff(v_container, v_staff,
    '[{"date":"2026-08-10","timeSlot":"18:00","role":"dealer"}]'::jsonb);
  v_wl := ((v_res -> 'workLogIds') ->> 0)::uuid;

  PERFORM public.add_direct_staff(v_container, v_staff2,
    '[{"date":"2026-08-11","timeSlot":"18:00","role":"dealer"},
      {"date":"2026-08-12","timeSlot":"18:00","role":"dealer"}]'::jsonb);

  v_res := public.add_direct_staff(v_container, v_noshow,
    '[{"date":"2026-08-13","timeSlot":"18:00","role":"dealer"}]'::jsonb);
  v_wl_noshow := ((v_res -> 'workLogIds') ->> 0)::uuid;

  PERFORM public.add_direct_staff(v_normal, v_normal_staff,
    '[{"date":"2026-08-14","timeSlot":"18:00","role":"dealer"}]'::jsonb);

  -- (1) 양성 대조 — 배치된 staff 는 읽는다
  PERFORM t_mvrs_set_user(v_staff);
  INSERT INTO _t VALUES ('t1_before',
    (SELECT count(*)::text FROM public.get_my_venue_role_salaries(ARRAY[v_container])));

  -- (3) 무관 staff
  PERFORM t_mvrs_set_user(v_outsider);
  INSERT INTO _t VALUES ('t3_outsider',
    (SELECT count(*)::text FROM public.get_my_venue_role_salaries(ARRAY[v_container])));

  -- (6) 일반 공고는 컨테이너가 아니므로 배정이 있어도 안 나온다
  PERFORM t_mvrs_set_user(v_normal_staff);
  INSERT INTO _t VALUES ('t6_normal',
    (SELECT count(*)::text FROM public.get_my_venue_role_salaries(ARRAY[v_normal])));

  -- 소프트 취소 (실제 경로: remove_direct_staff)
  PERFORM t_mvrs_set_user(v_owner);
  PERFORM public.remove_direct_staff(v_wl);

  -- 픽스처 방어: 소프트 취소가 실제로 행을 남겼는지 확인한다. 하드 DELETE 였다면
  -- (2)는 이 함수와 무관하게 통과해버려 회귀를 못 잡는다.
  INSERT INTO _t VALUES ('t2_row_survived',
    (SELECT (count(*) = 1)::text FROM public.work_logs
      WHERE id = v_wl AND status = 'cancelled'));

  -- (2) 회귀 핵심 — 취소된 staff 는 못 읽는다
  PERFORM t_mvrs_set_user(v_staff);
  INSERT INTO _t VALUES ('t2_after_cancel',
    (SELECT count(*)::text FROM public.get_my_venue_role_salaries(ARRAY[v_container])));

  -- (4) 배정 2건 중 1건만 취소 → 계속 읽는다
  PERFORM t_mvrs_set_user(v_owner);
  PERFORM public.remove_direct_staff(
    (SELECT id FROM public.work_logs
      WHERE job_posting_id = v_container AND staff_id = v_staff2
      ORDER BY date LIMIT 1));
  PERFORM t_mvrs_set_user(v_staff2);
  INSERT INTO _t VALUES ('t4_partial',
    (SELECT count(*)::text FROM public.get_my_venue_role_salaries(ARRAY[v_container])));

  -- (5) no_show 만 남은 staff — remove_direct_staff 는 no_show 를 만들지 않으므로 직접 전이
  UPDATE public.work_logs SET status = 'no_show', updated_at = now() WHERE id = v_wl_noshow;
  PERFORM t_mvrs_set_user(v_noshow);
  INSERT INTO _t VALUES ('t5_no_show',
    (SELECT count(*)::text FROM public.get_my_venue_role_salaries(ARRAY[v_container])));
END;
$$;

SELECT is((SELECT v FROM _t WHERE k = 't1_before'), '1',
  '배치된 staff 는 컨테이너 역할 단가를 읽는다 (양성 대조)');
SELECT is((SELECT v FROM _t WHERE k = 't2_row_survived'), 'true',
  '소프트 취소는 work_log 행을 status=cancelled 로 남긴다 (픽스처 전제)');
SELECT is((SELECT v FROM _t WHERE k = 't2_after_cancel'), '0',
  '소프트 취소된 staff 는 더 이상 단가표를 읽지 못한다');
SELECT is((SELECT v FROM _t WHERE k = 't3_outsider'), '0',
  '배정된 적 없는 staff 는 읽지 못한다');
SELECT is((SELECT v FROM _t WHERE k = 't4_partial'), '1',
  '활성 배정이 하나라도 남으면 계속 읽는다 (과잉 차단 없음)');
SELECT is((SELECT v FROM _t WHERE k = 't5_no_show'), '0',
  'no_show 배정만 남은 staff 는 읽지 못한다');
SELECT is((SELECT v FROM _t WHERE k = 't6_normal'), '0',
  '컨테이너가 아닌 일반 공고는 배정이 있어도 반환되지 않는다');

SELECT * FROM finish();
ROLLBACK;
