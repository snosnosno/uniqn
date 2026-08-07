-- ============================================================
-- 정원 0 fail-closed — `v_capacity = 0` 이 "정원 미상=통과"에서 "자리 없음=거부"로
--
-- 마이그레이션: 20260804140000_capacity_zero_fail_closed.sql
-- 선행: R0(20260803120000) confirm_application · 3-C(20260804120000) 정원 이동
--
-- ── 무엇을 지키는 테스트인가 ─────────────────────────────────
-- `confirm_application` 의 정원 가드는 `IF v_capacity > 0 AND ...` 였다. 0 을 "정원 미상"으로
-- 보고 **통째로 건너뛴다.** 그런데 0 이 되는 원인은 하나가 아니었고, 처방이 서로 다르다:
--
--   A. 역할 객체가 레거시 `headcount` 만 가짐 → `v_capacity` 는 `count` 만 읽어서 0.
--      🔴 **순수 버그다** — `_total_positions_from_schedule`(20260718000000:24)은
--         `COALESCE(count, headcount, 0)` 로 센다. 같은 원문을 두 함수가 다르게 읽었다.
--   B. 원문에 그 (날짜, 슬롯, 역할) 자체가 없음 → 진짜 **"정원 미상"**.
--   C. 원문에 `count: 0` 이 명시됨 → 진짜 **"자리 없음"**.
--
-- 이 마이그는 A 를 고치고 C 를 거부로 바꾼다. **B 는 그대로 통과시킨다**(로그만) —
-- 레거시 공고·키 드리프트에서 정상 확정이 막히는 쪽이 더 비싸다는 판단이다.
--
-- 🔴 **6번이 이 마이그의 본체다.** 3-C 가 출발지 정원을 0 으로 만들 때 역할 항목을
--    지우면 C 가 B 로 바뀌어 가드를 다시 빠져나간다. 항목을 `count: 0` 으로 남겨야
--    C 경로로 닫힌다 — 설계 §10-7 미확정 1번의 결론을 뒤집는 것이 이 테스트다.
--
-- ⚠️ `confirm_application` 은 actor 를 `request.jwt.claims` 의 sub 로 검사한다(#195 가드).
-- ⚠️ RPC 호출은 DO 블록에서 끝내고 결과는 GUC 로 넘긴다(볼라틸 함수 평가 순서 미보장).
-- ============================================================
BEGIN;
SELECT plan(8);

DO $$
DECLARE
  s            RECORD;
  v_owner      uuid;
  v_ws         uuid;
  v_jp_head    uuid := gen_random_uuid();   -- A: headcount 전용
  v_jp_zero    uuid := gen_random_uuid();   -- C: count 0 명시
  v_jp_nomatch uuid := gen_random_uuid();   -- B: 축 미매칭
  v_st         uuid[] := ARRAY[]::uuid[];
  v_app        uuid[] := ARRAY[]::uuid[];
  v_id         uuid;
  i            int;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  v_owner := s.owner_id;
  v_ws    := s.workspace_id;

  PERFORM set_config('czf.owner', v_owner::text, true);

  -- 스태프 5명. ⚠️ public.users.id 는 auth.users(id) FK 라 auth 쪽을 먼저 만든다.
  FOR i IN 1..5 LOOP
    v_st := v_st || gen_random_uuid();
  END LOOP;

  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  SELECT u, 'czf_' || u || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  FROM unnest(v_st) u;

  INSERT INTO public.users (id, email, name, role, is_active, identity_verified, created_at, updated_at)
  SELECT id, email, 'czf staff', 'staff'::user_role, true, true, now(), now()
  FROM auth.users WHERE id = ANY (v_st)
  ON CONFLICT (id) DO UPDATE SET is_active = true, identity_verified = true;

  -- A) headcount 전용 — 정원 1 인데 count 키가 없다
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at)
  VALUES (v_jp_head, v_owner, v_ws, '__sql_fixture: czf headcount', 1, 0, 'active',
    jsonb_build_object('kind', 'dated', 'requirements', jsonb_build_array(jsonb_build_object(
      'date', '2026-09-10',
      'timeSlots', jsonb_build_array(jsonb_build_object(
        'startTime', '18:00',
        'roles', jsonb_build_array(jsonb_build_object('role', 'dealer', 'headcount', 1))))))),
    now(), now());

  -- C) count 0 명시 — 자리가 없다
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at)
  VALUES (v_jp_zero, v_owner, v_ws, '__sql_fixture: czf zero', 0, 0, 'active',
    jsonb_build_object('kind', 'dated', 'requirements', jsonb_build_array(jsonb_build_object(
      'date', '2026-09-10',
      'timeSlots', jsonb_build_array(jsonb_build_object(
        'startTime', '18:00',
        'roles', jsonb_build_array(jsonb_build_object('role', 'dealer', 'count', 0))))))),
    now(), now());

  -- B) 축 미매칭 — 원문은 floor 만 모집하는데 dealer 를 확정하려 한다
  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, schedule, created_at, updated_at)
  VALUES (v_jp_nomatch, v_owner, v_ws, '__sql_fixture: czf nomatch', 2, 0, 'active',
    jsonb_build_object('kind', 'dated', 'requirements', jsonb_build_array(jsonb_build_object(
      'date', '2026-09-10',
      'timeSlots', jsonb_build_array(jsonb_build_object(
        'startTime', '18:00',
        'roles', jsonb_build_array(jsonb_build_object('role', 'floor', 'count', 2))))))),
    now(), now());

  -- 지원서: head 2건(1건은 정원 내, 1건은 초과) · zero 1건 · nomatch 1건
  FOR i IN 1..4 LOOP
    v_id := gen_random_uuid();
    INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
    VALUES (v_id,
            CASE WHEN i <= 2 THEN v_jp_head WHEN i = 3 THEN v_jp_zero ELSE v_jp_nomatch END,
            v_st[i], 'CZF' || i, 'applied', now(), now());
    v_app := v_app || v_id;
  END LOOP;

  PERFORM set_config('czf.jp_head',    v_jp_head::text,    true);
  PERFORM set_config('czf.jp_zero',    v_jp_zero::text,    true);
  PERFORM set_config('czf.jp_nomatch', v_jp_nomatch::text, true);
  PERFORM set_config('czf.app1', v_app[1]::text, true);
  PERFORM set_config('czf.app2', v_app[2]::text, true);
  PERFORM set_config('czf.app3', v_app[3]::text, true);
  PERFORM set_config('czf.app4', v_app[4]::text, true);
END $$;

-- ── A. 레거시 headcount 전용 ────────────────────────────────
-- 1) 정원 1 안쪽 첫 확정은 통과해야 한다(가드가 과하게 닫히면 안 된다).
DO $$
DECLARE v_err text := '(none)';
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', current_setting('czf.owner'), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.confirm_application(
      (current_setting('czf.app1'))::uuid, (current_setting('czf.owner'))::uuid,
      jsonb_build_array(jsonb_build_object('date', '2026-09-10', 'timeSlot', '18:00', 'role', 'dealer')));
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('czf.err1', v_err, true);
END $$;

SELECT is(current_setting('czf.err1'), '(none)',
  '1. headcount 전용 역할에서도 정원 안쪽 확정은 통과한다');

-- 2) 🔴 정원 1 을 넘는 두 번째 확정은 거부되어야 한다.
--    `count` 만 읽으면 v_capacity=0 → 가드 스킵 → 통과해 버린다(현행 결함).
DO $$
DECLARE v_err text := '(none)';
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', current_setting('czf.owner'), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.confirm_application(
      (current_setting('czf.app2'))::uuid, (current_setting('czf.owner'))::uuid,
      jsonb_build_array(jsonb_build_object('date', '2026-09-10', 'timeSlot', '18:00', 'role', 'dealer')));
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('czf.err2', v_err, true);
END $$;

SELECT ok(current_setting('czf.err2') LIKE '%MAX_CAPACITY_REACHED%',
  '2. 🔴 headcount 전용 역할의 정원 초과가 거부된다 (count 만 읽으면 통과해 버린다)');

-- ── C. count: 0 명시 ────────────────────────────────────────
-- 3) 🔴 자리가 0 이면 첫 확정부터 거부되어야 한다.
DO $$
DECLARE v_err text := '(none)';
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', current_setting('czf.owner'), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.confirm_application(
      (current_setting('czf.app3'))::uuid, (current_setting('czf.owner'))::uuid,
      jsonb_build_array(jsonb_build_object('date', '2026-09-10', 'timeSlot', '18:00', 'role', 'dealer')));
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('czf.err3', v_err, true);
END $$;

SELECT ok(current_setting('czf.err3') LIKE '%MAX_CAPACITY_REACHED%',
  '3. 🔴 원문 정원이 0 이면 확정이 거부된다 (자리 없음 ≠ 정원 미상)');

-- ── B. 축 미매칭 → 회귀 방지: 여전히 통과한다 ───────────────
-- 4) 원문에 없는 역할은 "정원 미상"이라 막지 않는다. 이걸 닫으면 레거시 공고·키 드리프트에서
--    정상 확정이 거부된다 — 의도적으로 열어 둔다.
DO $$
DECLARE v_err text := '(none)';
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', current_setting('czf.owner'), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.confirm_application(
      (current_setting('czf.app4'))::uuid, (current_setting('czf.owner'))::uuid,
      jsonb_build_array(jsonb_build_object('date', '2026-09-10', 'timeSlot', '18:00', 'role', 'dealer')));
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM;
  END;
  PERFORM set_config('czf.err4', v_err, true);
END $$;

SELECT is(current_setting('czf.err4'), '(none)',
  '4. 축 미매칭(원문에 없는 역할)은 여전히 통과한다 — 정원 미상은 거부하지 않는다');

-- ── 3-C 정원 이동: 출발지 0 이어도 항목을 남긴다 ────────────
-- 5) 🔴 전원을 옮겨 출발지가 0 이 되어도 역할 항목이 사라지지 않는다.
SELECT is(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-10","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"dealer","count":3}]},
        {"startTime":"19:00","roles":[{"role":"dealer","count":1}]}]}]}'::jsonb AS sched)
   SELECT COALESCE(
     (SELECT (r->>'count')
        FROM s,
             LATERAL jsonb_array_elements(
               public._posting_schedule_move_capacity(
                 sched, '2026-09-10', 'dealer', '18:00', '19:00', '19:00', 3)->'requirements') req,
             LATERAL jsonb_array_elements(req->'timeSlots') ts,
             LATERAL jsonb_array_elements(ts->'roles') r
       WHERE public._posting_schedule_slot_key(ts) = '18:00'
         AND public._posting_role_key(r->>'role', r->>'customRole') = 'dealer'),
     '(항목이 사라짐)')),
  '0',
  '5. 🔴 출발지 정원이 0 이 되어도 역할 항목이 count:0 으로 남는다');

-- 6) 🔴 **이 마이그의 본체** — 전원을 옮긴 뒤 출발지 슬롯 재확정이 거부된다.
--    항목을 지우면 축 미매칭(B)이 되어 다시 통과해 버린다. 5번과 짝이다.
SELECT ok(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-10","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"dealer","count":3}]},
        {"startTime":"19:00","roles":[{"role":"dealer","count":1}]}]}]}'::jsonb AS sched),
        moved AS (SELECT public._posting_schedule_move_capacity(
                    sched, '2026-09-10', 'dealer', '18:00', '19:00', '19:00', 3) AS sched FROM s)
   SELECT public._posting_schedule_role_count(sched, '2026-09-10', '18:00', 'dealer') IS NOT DISTINCT FROM 0
   FROM moved),
  '6. 🔴 이동 후 출발지 정원 조회가 NULL(미상) 이 아니라 0(자리 없음) 을 낸다');

-- 7) 정원 총합은 여전히 보존된다 — count:0 을 남겨도 total_positions 는 변하지 않는다.
SELECT is(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-10","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"dealer","count":3}]},
        {"startTime":"19:00","roles":[{"role":"dealer","count":1}]}]}]}'::jsonb AS sched)
   SELECT public._total_positions_from_schedule(sched)::text || '->' ||
          public._total_positions_from_schedule(
            public._posting_schedule_move_capacity(
              sched, '2026-09-10', 'dealer', '18:00', '19:00', '19:00', 3))::text
   FROM s),
  '4->4',
  '7. 출발지에 count:0 을 남겨도 정원 총합이 보존된다');

-- 8) 레거시 headcount 역할도 0 이 될 때 키를 유지한 채 남는다(새 count 키를 만들지 않는다).
SELECT is(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-10","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"dealer","headcount":2}]},
        {"startTime":"19:00","roles":[{"role":"dealer","headcount":1}]}]}]}'::jsonb AS sched)
   SELECT string_agg(kv.key, ',' ORDER BY kv.key) || '=' || COALESCE(
            (SELECT r2->>'headcount'
               FROM s,
                    LATERAL jsonb_array_elements(
                      public._posting_schedule_move_capacity(
                        sched, '2026-09-10', 'dealer', '18:00', '19:00', '19:00', 2)->'requirements') req2,
                    LATERAL jsonb_array_elements(req2->'timeSlots') ts2,
                    LATERAL jsonb_array_elements(ts2->'roles') r2
              WHERE public._posting_schedule_slot_key(ts2) = '18:00'), '(없음)')
   FROM s,
        LATERAL jsonb_array_elements(
          public._posting_schedule_move_capacity(
            sched, '2026-09-10', 'dealer', '18:00', '19:00', '19:00', 2)->'requirements') req,
        LATERAL jsonb_array_elements(req->'timeSlots') ts,
        LATERAL jsonb_array_elements(ts->'roles') r,
        LATERAL jsonb_each(r) kv
   WHERE public._posting_schedule_slot_key(ts) = '18:00'),
  'headcount,role=0',
  '8. 레거시 headcount 역할도 0 이 될 때 키를 유지한 채 남는다');

SELECT * FROM finish();
ROLLBACK;
