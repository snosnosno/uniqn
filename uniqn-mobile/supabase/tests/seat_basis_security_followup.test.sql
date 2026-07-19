-- ============================================================
-- 좌석 기준 후속 보안 하드닝 회귀 테스트 (독립 리뷰 P1·P2)
-- 대상 마이그: 20260718000100_seat_basis_security_hardening_followup.sql
-- 사용법: psql "$SUPABASE_DB_URL" -f supabase/tests/seat_basis_security_followup.test.sql
--
-- P1: work_logs.job_posting_id 재지정 차단(42501) + 피해자 filled 오염 방지.
-- P2: confirm_application 고아 공고(owner_id NULL)에서 비멤버 fail-closed(PERMISSION_DENIED).
--     (교정 전이면 NULL=attacker → NULL → RAISE 미발화로 통과 = red. 교정 후 차단 = green.)
-- 안전: BEGIN/ROLLBACK + 마커 이메일 + 임시 uuid.
-- ============================================================
BEGIN;
SELECT plan(3);

CREATE TEMP TABLE _t (k text PRIMARY KEY, v text);

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_attacker uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_ws uuid := gen_random_uuid();
  v_p1 uuid := gen_random_uuid();      -- 공격자 소유 work_log 가 붙은 공고
  v_victim uuid := gen_random_uuid();  -- 피해자 공고(재지정 대상)
  v_orphan uuid := gen_random_uuid();  -- owner_id NULL 고아 공고
  v_wl uuid := gen_random_uuid();
  v_app uuid := gen_random_uuid();
  v_sched jsonb := jsonb_build_object('kind','dated','requirements',
    jsonb_build_array(jsonb_build_object('date','2026-07-14','timeSlots',
      jsonb_build_array(jsonb_build_object('startTime','19:00','roles',
        jsonb_build_array(jsonb_build_object('role','dealer','count',3)))))));
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner,    '__sql_fixture_secfu_owner@test.local',    '{"role":"employer"}'::jsonb, '{"name":"O"}'::jsonb, now(), now()),
    (v_attacker, '__sql_fixture_secfu_attacker@test.local', '{"role":"employer"}'::jsonb, '{"name":"A"}'::jsonb, now(), now()),
    (v_staff,    '__sql_fixture_secfu_staff@test.local',    '{"role":"staff"}'::jsonb,    '{"name":"S"}'::jsonb, now(), now());

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'fixture',
    CASE WHEN id = v_staff THEN 'staff'::user_role ELSE 'employer'::user_role END,
    true, now(), now()
  FROM auth.users WHERE id IN (v_owner, v_attacker, v_staff)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, '__sql_fixture_secfu_ws', v_owner, now(), now());

  -- 공고 3종(공격자 소유 p1 · 피해자 victim · 고아 orphan[owner NULL])
  INSERT INTO public.job_postings (id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at)
  VALUES
    (v_p1,     v_attacker, v_ws, '__fixture p1',     3, 0, 'active', v_sched, now(), now()),
    (v_victim, v_owner,    v_ws, '__fixture victim', 3, 0, 'active', v_sched, now(), now()),
    (v_orphan, NULL,       v_ws, '__fixture orphan', 3, 0, 'active', v_sched, now(), now());

  -- 공격자 소유 공고 p1 에 scheduled work_log 1건(seat 트리거 → p1 filled +1)
  INSERT INTO public.work_logs (id, staff_id, job_posting_id, date, time_slot, role, owner_id, status, created_at, updated_at)
  VALUES (v_wl, v_staff, v_p1, '2026-07-14', '19:00', 'dealer'::staff_role, v_attacker, 'scheduled', now(), now());

  -- 고아 공고에 applied 지원서(P2 confirm 대상)
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, assignments, created_at, updated_at)
  VALUES (v_app, v_orphan, v_staff, 'S', 'applied', '[]'::jsonb, now(), now());

  INSERT INTO _t VALUES
    ('victim', v_victim::text), ('wl', v_wl::text),
    ('app', v_app::text), ('attacker', v_attacker::text),
    ('victim_filled_before', (SELECT filled_positions FROM public.job_postings WHERE id = v_victim)::text);
END $$;

-- P1a. work_log 의 job_posting_id 를 피해자 공고로 재지정 → 42501 차단
SELECT throws_like(
  'UPDATE public.work_logs SET job_posting_id = '''
    || (SELECT v FROM _t WHERE k='victim') || '''::uuid, status = ''scheduled'' WHERE id = '''
    || (SELECT v FROM _t WHERE k='wl') || '''::uuid',
  '%WORK_LOG_POSTING_IMMUTABLE%',
  'P1a: work_logs.job_posting_id 재지정 차단(교차 테넌트 filled 오염 방지)');

-- P1b. 차단 후 피해자 filled 불변(오염 미발생)
SELECT is(
  (SELECT filled_positions FROM public.job_postings WHERE id = (SELECT v FROM _t WHERE k='victim')::uuid)::text,
  (SELECT v FROM _t WHERE k='victim_filled_before'),
  'P1b: 재지정 차단으로 피해자 filled 불변');

-- P2. 고아 공고(owner_id NULL) 에서 비멤버(attacker) confirm → fail-closed(PERMISSION_DENIED)
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT v FROM _t WHERE k='attacker'), 'role', 'authenticated')::text, true);
SELECT throws_like(
  'SELECT public.confirm_application('''
    || (SELECT v FROM _t WHERE k='app') || '''::uuid, '''
    || (SELECT v FROM _t WHERE k='attacker') || '''::uuid, ''[]''::jsonb)',
  '%PERMISSION_DENIED%',
  'P2: 고아 공고 owner_id NULL fail-closed (비멤버 confirm 차단)');

SELECT * FROM finish();
ROLLBACK;
