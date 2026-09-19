-- ============================================================
-- update_posting_slot_time RPC (3-C 공고 시간 변경)
--
-- 마이그레이션: 20260804120000_update_posting_slot_time_rpc.sql
-- 설계: docs/planning/2026-08-03-3c-posting-time-change-design.md §10
--
-- 무엇을 지키는 테스트인가:
--   🔴 **25번이 이 마이그의 본체다.** 공고 원문 정원을 함께 옮기지 않으면 출발지 슬롯의
--      정원이 남아 같은 자리에 인원을 더 확정할 수 있다(설계 §10-2).
--      정원 이동(`_posting_schedule_move_capacity` 호출)을 빼고 돌리면 25번이 red 가 된다 —
--      18:00 딜러 정원이 5 로 남아 `confirm_application` 이 통과해 버린다.
--      🔑 **부분 이동**으로 검사하는 이유: 이 테스트를 쓸 당시 가드가 `IF v_capacity > 0 AND ...`
--         라 전원을 옮겨 정원이 0 이 되면 통째로 건너뛰었고(20260803120000:215),
--         그 상태로는 정원 이동의 효과를 증명할 수 없었다.
--         ⚠️ 20260804140000 이 가드를 `IS NOT NULL` 로 바꿔 0 도 거부하게 됐지만,
--            부분 이동은 "옮긴 만큼만 줄었다"를 직접 보여주므로 그대로 둔다.
--   🔴 5~8번은 대상 축 검증이다. 축 밖 id 를 하나라도 받아들이면 한 슬롯이 둘로 갈라지고
--      일부에게만 알림이 나간다(무증상).
--   🔴 21번은 취소자 침묵이다. 소프트 취소 필터를 빼면 취소된 인원에게 알림이 간다.
--
-- ⚠️ **알림 단언 전에 `RESET ROLE` 이 필요하다.** `jpc_test_set_user` 는 role 을
--    `authenticated` 로 바꾸고 `jpc_test_clear_user` 는 **role 을 되돌리지 않는다**
--    (jpc_helpers.sql:194-201 주석). 구인자 컨텍스트로 `notifications` 를 읽으면 RLS 가
--    수신자(스태프) 행을 통째로 가려 "알림 0건"으로 보인다 — 코드 결함이 아니라 관측 실패다.
-- ⚠️ 42501 단독 단언 금지(선례): 권한 거부는 `throws_like '%PERMISSION_DENIED%'` 로 본다.
-- ⚠️ RPC 호출과 결과 조회를 한 SELECT 에 섞지 않는다 — 볼라틸 함수와 스칼라 서브쿼리의
--    평가 순서는 보장되지 않는다. 호출은 DO 블록에서 끝내고 반환값을 GUC 로 넘긴다.
-- ============================================================
BEGIN;
SELECT plan(38);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('ups.owner_id',  s.owner_id::text,        true);
  PERFORM set_config('ups.collab_id', s.collaborator_id::text, true);
  PERFORM set_config('ups.out_id',    s.outsider_id::text,     true);
  PERFORM set_config('ups.ws_id',     s.workspace_id::text,    true);
  PERFORM set_config('ups.jp_id',     s.job_posting_id::text,  true);
END $$;

-- ── 픽스처 ──────────────────────────────────────────────────
-- 공고 원문(2026-09-05): 18:00 딜러 5 · 18:00 플로어 1 · 19:00 딜러 3 · 20:00 딜러 1
--                (09-06): 18:00 딜러 2                       → 총합 12
--
-- 18:00 딜러 활성 인원 5명(a·b·c·m·direct) 중
--   · c 는 10번(협업자 권한)에서 19:00 으로
--   · a·b·m 은 본 이동에서 09:00 으로
--   · direct 1명이 18:00 에 **남는다** → 정원 1 / 배치 1 → 25번이 성립한다.
--
-- ⚠️ 총합 12 > 활성 work_logs 9 여야 한다. 좌석 트리거가 filled 를 올리는데 filled >= total
--    이면 fn_recalc_total_and_capacity 가 status 를 capacity_full 로 뒤집어 15번이 무의미해진다.
DO $$
DECLARE
  v_jp  uuid := (current_setting('ups.jp_id'))::uuid;
  v_own uuid := (current_setting('ups.owner_id'))::uuid;
  v_ws  uuid := (current_setting('ups.ws_id'))::uuid;
  v_u   uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                        gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                        gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_app uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                        gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                        gen_random_uuid(), gen_random_uuid()];
  v_wl  uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                        gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                        gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_cont    uuid := gen_random_uuid();
  v_wl_cont uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  SELECT u, 'ups_' || u || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  FROM unnest(v_u) u;

  INSERT INTO public.users (id, email, name, role, is_active, identity_verified, created_at, updated_at)
  SELECT id, email, 'ups staff', 'staff'::user_role, true, true, now(), now()
  FROM auth.users WHERE id = ANY (v_u)
  ON CONFLICT (id) DO UPDATE SET is_active = true, identity_verified = true;

  UPDATE public.job_postings SET schedule = '{
    "kind": "dated",
    "primaryDate": "2026-09-05",
    "allDates": ["2026-09-05", "2026-09-06"],
    "requirements": [
      {"date": "2026-09-05", "timeSlots": [
        {"id":"ts-18","startTime": "18:00", "roles": [
          {"role": "dealer", "count": 5}, {"role": "floor", "count": 1}]},
        {"id":"ts-19","startTime": "19:00", "roles": [{"role": "dealer", "count": 3}]},
        {"id":"ts-20","startTime": "20:00", "roles": [{"role": "dealer", "count": 1}]}
      ]},
      {"date": "2026-09-06", "timeSlots": [
        {"id":"ts-d6","startTime": "18:00", "roles": [{"role": "dealer", "count": 2}]}
      ]}
    ]}'::jsonb
  WHERE id = v_jp;

  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status,
                                   assignments, created_at, updated_at)
  VALUES
    (v_app[1], v_jp, v_u[1], 'a', 'confirmed',
     '[{"dates":["2026-09-05"],"roleIds":["dealer"],"timeSlot":"18:00","isGrouped":false,"groupId":"g-a"}]'::jsonb, now(), now()),
    (v_app[2], v_jp, v_u[2], 'b', 'confirmed',
     '[{"dates":["2026-09-05"],"roleIds":["dealer"],"timeSlot":"18:00","isGrouped":false,"groupId":"g-b"}]'::jsonb, now(), now()),
    (v_app[3], v_jp, v_u[3], 'c', 'confirmed',
     '[{"dates":["2026-09-05"],"roleIds":["dealer"],"timeSlot":"18:00","isGrouped":false,"groupId":"g-c"}]'::jsonb, now(), now()),
    -- m: 한 원소가 dates:[09-04, 09-05, 09-07] 을 덮는다. 09-05 만 옮겨야 한다(셀 분해 회귀 가드).
    (v_app[4], v_jp, v_u[4], 'm', 'confirmed',
     '[{"dates":["2026-09-04","2026-09-05","2026-09-07"],"roleIds":["dealer"],"timeSlot":"18:00",
        "isGrouped":true,"groupId":"g-m","duration":{"type":"consecutive"}}]'::jsonb, now(), now()),
    (v_app[5], v_jp, v_u[5], 'x', 'confirmed',
     '[{"dates":["2026-09-05"],"roleIds":["dealer"],"timeSlot":"18:00","isGrouped":false,"groupId":"g-x"}]'::jsonb, now(), now()),
    (v_app[6], v_jp, v_u[6], 'f', 'confirmed',
     '[{"dates":["2026-09-05"],"roleIds":["floor"],"timeSlot":"18:00","isGrouped":false,"groupId":"g-f"}]'::jsonb, now(), now()),
    (v_app[7], v_jp, v_u[7], 'dest', 'confirmed',
     '[{"dates":["2026-09-05"],"roleIds":["dealer"],"timeSlot":"19:00","isGrouped":false,"groupId":"g-dest"}]'::jsonb, now(), now()),
    -- adj: 개별 조정으로 20:00 이 된 사람. 18:00 후보에 **없어야** 한다(설계 §10-1).
    (v_app[8], v_jp, v_u[8], 'adj', 'confirmed',
     '[{"dates":["2026-09-05"],"roleIds":["dealer"],"timeSlot":"20:00","isGrouped":false,"groupId":"g-adj"}]'::jsonb, now(), now());

  INSERT INTO public.work_logs (id, application_id, assignment_group_id, staff_id, job_posting_id,
                                owner_id, date, status, role, custom_role, time_slot, created_at, updated_at)
  VALUES
    (v_wl[1], v_app[1], 'g-a',    v_u[1], v_jp, v_own, '2026-09-05', 'scheduled', 'dealer', NULL, '18:00', now(), now()),
    (v_wl[2], v_app[2], 'g-b',    v_u[2], v_jp, v_own, '2026-09-05', 'scheduled', 'dealer', NULL, '18:00', now(), now()),
    (v_wl[3], v_app[3], 'g-c',    v_u[3], v_jp, v_own, '2026-09-05', 'scheduled', 'dealer', NULL, '18:00', now(), now()),
    (v_wl[4], v_app[4], 'g-m',    v_u[4], v_jp, v_own, '2026-09-05', 'scheduled', 'dealer', NULL, '18:00', now(), now()),
    -- 취소된 행: 축 후보에서 빠지고 알림도 받지 않아야 한다.
    (v_wl[5], v_app[5], 'g-x',    v_u[5], v_jp, v_own, '2026-09-05', 'cancelled', 'dealer', NULL, '18:00', now(), now()),
    -- 같은 시각 다른 역할: 축이 역할까지 보는지 확인한다.
    (v_wl[6], v_app[6], 'g-f',    v_u[6], v_jp, v_own, '2026-09-05', 'scheduled', 'floor',  NULL, '18:00', now(), now()),
    -- 목적지에 이미 있던 사람: 손대지 않아야 한다.
    (v_wl[7], v_app[7], 'g-dest', v_u[7], v_jp, v_own, '2026-09-05', 'scheduled', 'dealer', NULL, '19:00', now(), now()),
    -- 개별 조정된 사람
    (v_wl[8], v_app[8], 'g-adj',  v_u[8], v_jp, v_own, '2026-09-05', 'scheduled', 'dealer', NULL, '20:00', now(), now()),
    -- add_direct_staff 산 행: application_id 가 NULL 이라 동기화 상대가 없다. 18:00 에 남는다.
    (v_wl[9], NULL,     NULL,     v_u[9], v_jp, v_own, '2026-09-05', 'scheduled', 'dealer', NULL, '18:00', now(), now());

  -- 컨테이너 공고(근무표 직접 배치) — 모집 요건이 없어 정원 이동 대상이 아니다.
  INSERT INTO public.job_postings (id, owner_id, owner_name, workspace_id, title, status, posting_type,
                                   work_date, work_dates, total_positions, filled_positions, view_count,
                                   schema_version, contact_phone, created_at, updated_at)
  VALUES (v_cont, v_own, 'ups owner', v_ws, 'ups container', 'container', 'regular',
          '2026-09-05', ARRAY['2026-09-05'], 0, 0, 0, 3, '+82103333333', now(), now());
  INSERT INTO public.work_logs (id, application_id, staff_id, job_posting_id, owner_id, date,
                                status, role, time_slot, created_at, updated_at)
  VALUES (v_wl_cont, NULL, v_u[1], v_cont, v_own, '2026-09-05', 'scheduled', 'dealer', '18:00', now(), now());

  PERFORM set_config('ups.wl_a',    v_wl[1]::text,  true);
  PERFORM set_config('ups.wl_b',    v_wl[2]::text,  true);
  PERFORM set_config('ups.wl_c',    v_wl[3]::text,  true);
  PERFORM set_config('ups.wl_m',    v_wl[4]::text,  true);
  PERFORM set_config('ups.wl_x',    v_wl[5]::text,  true);
  PERFORM set_config('ups.wl_f',    v_wl[6]::text,  true);
  PERFORM set_config('ups.wl_dest', v_wl[7]::text,  true);
  PERFORM set_config('ups.wl_adj',  v_wl[8]::text,  true);
  PERFORM set_config('ups.wl_dir',  v_wl[9]::text,  true);
  PERFORM set_config('ups.app_m',   v_app[4]::text, true);
  PERFORM set_config('ups.u_a',     v_u[1]::text,   true);
  PERFORM set_config('ups.u_x',     v_u[5]::text,   true);
  PERFORM set_config('ups.u_dest',  v_u[7]::text,   true);
  PERFORM set_config('ups.cont_id', v_cont::text,   true);
  PERFORM set_config('ups.wl_cont', v_wl_cont::text, true);
END $$;

-- 1. 시그니처 고정
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_posting_slot_time'),
  'p_job_posting_id uuid, p_date text, p_role_key text, p_from_slot_key text, p_work_log_ids uuid[], p_patch jsonb',
  'update_posting_slot_time 시그니처가 고정돼 있다');

-- 2. anon 은 실행 불가 / authenticated 는 가능
SELECT ok(
  NOT has_function_privilege('anon', 'public.update_posting_slot_time(uuid, text, text, text, uuid[], jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.update_posting_slot_time(uuid, text, text, text, uuid[], jsonb)', 'EXECUTE'),
  'anon EXECUTE 없음 / authenticated EXECUTE 있음');

SELECT jpc_test_set_user((current_setting('ups.owner_id'))::uuid);

-- 3. 미지의 키는 거부한다(단건 RPC 와 같은 계약)
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid], '{"staffRole":"floor"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_a')),
  '%INVALID_INPUT%',
  '전체 축은 시간만 받는다 — 역할 패치는 거부한다');

-- 4. 폐지된 범위 문자열은 형식 단계에서 끊는다
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid], '{"startTime":"19:00 - 02:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_a')),
  '%INVALID_INPUT%',
  '범위 문자열은 거부한다');

-- ── 🔴 대상 축 검증 (5~8) ────────────────────────────────────
-- 5. 다른 역할(floor)이 섞이면 전체 거부
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid, %L::uuid], '{"startTime":"19:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_a'), current_setting('ups.wl_f')),
  '%SLOT_MISMATCH%',
  '역할이 다른 대상이 섞이면 전체를 거부한다');

-- 6. 다른 시각(20:00 — 개별 조정된 사람)이 섞이면 전체 거부.
--    🔑 설계 §10-1: 개별 조정된 인원은 이미 자기 시각 그룹으로 옮겨가 있다.
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid, %L::uuid], '{"startTime":"19:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_a'), current_setting('ups.wl_adj')),
  '%SLOT_MISMATCH%',
  '개별 조정으로 다른 시각이 된 대상은 이 슬롯 축에 없다');

-- 7. 🔴 취소된 행이 섞이면 전체 거부(소프트 취소 필터)
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid, %L::uuid], '{"startTime":"19:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_a'), current_setting('ups.wl_x')),
  '%SLOT_MISMATCH%',
  '취소된 인원은 축에서 빠진다 (소프트 취소 필터)');

-- 8. 중복 id 는 거부한다 — 같은 행을 두 번 세면 정원 이동 수가 실제보다 커진다
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid, %L::uuid], '{"startTime":"19:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_a'), current_setting('ups.wl_a')),
  '%INVALID_INPUT%',
  '중복된 대상은 거부한다 (정원 이동 수 오염 차단)');

-- 9. 🔴 인가 — SECDEF 라 RLS 가 못 막는 자리. 무관한 사용자는 거부돼야 한다.
SELECT jpc_test_set_user((current_setting('ups.out_id'))::uuid);
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid], '{"startTime":"19:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_a')),
  '%PERMISSION_DENIED%',
  '공고와 무관한 사용자는 슬롯 시간을 바꿀 수 없다');

-- 10. 협업자는 통과한다(jp_update ∩ wl_update 의 collaborator 분기). c 를 19:00 으로.
SELECT jpc_test_set_user((current_setting('ups.collab_id'))::uuid);
SELECT lives_ok(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','18:00',
              ARRAY[%L::uuid], '{"startTime":"19:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_c')),
  '공고 협업자는 슬롯 시간을 바꿀 수 있다');

SELECT jpc_test_set_user((current_setting('ups.owner_id'))::uuid);

-- ── 본 이동: a·b·m 3명을 18:00 → 09:00 (direct 1명은 18:00 에 남는다) ──
DO $$
DECLARE v jsonb;
BEGIN
  v := public.update_posting_slot_time(
         (current_setting('ups.jp_id'))::uuid, '2026-09-05', 'dealer', '18:00',
         ARRAY[(current_setting('ups.wl_a'))::uuid, (current_setting('ups.wl_b'))::uuid,
               (current_setting('ups.wl_m'))::uuid],
         '{"startTime":"9:00"}'::jsonb);
  PERFORM set_config('ups.res', v::text, true);
END $$;

-- 11. 반환값 집계 — 부분 성공을 숨기지 않는다
SELECT is(
  (SELECT (r->>'total') || '|' || (r->>'updated') || '|' || (r->>'assignmentSynced')
       || '|' || (r->>'toSlotKey') || '|' || jsonb_array_length(r->'skipped')::text
       || '|' || COALESCE(r->>'capacitySkipReason', 'none')
   FROM (SELECT (current_setting('ups.res'))::jsonb AS r) t),
  '3|3|3|09:00|0|none',
  '반환값이 요청·이동·동기화 건수와 0패딩된 목적지 키를 정확히 보고한다');

-- 12. 0패딩 정규화 — '9:00' 을 그대로 두면 공고 원문 키와 work_logs 키가 영영 안 만난다
SELECT is(
  (SELECT string_agg(DISTINCT time_slot, ',' ORDER BY time_slot) FROM public.work_logs
   WHERE id IN ((current_setting('ups.wl_a'))::uuid, (current_setting('ups.wl_b'))::uuid,
                (current_setting('ups.wl_m'))::uuid)),
  '09:00',
  '옮긴 3명의 time_slot 이 0패딩된 09:00 으로 저장된다');

-- 13. 선택하지 않은 대상은 불변 — floor·취소자·개별조정자·직접배치
SELECT is(
  (SELECT (SELECT time_slot FROM public.work_logs WHERE id = (current_setting('ups.wl_f'))::uuid)
       || '|' || (SELECT time_slot FROM public.work_logs WHERE id = (current_setting('ups.wl_x'))::uuid)
       || '|' || (SELECT time_slot FROM public.work_logs WHERE id = (current_setting('ups.wl_adj'))::uuid)
       || '|' || (SELECT time_slot FROM public.work_logs WHERE id = (current_setting('ups.wl_dir'))::uuid)),
  '18:00|18:00|20:00|18:00',
  '고르지 않은 대상(다른 역할·취소자·개별 조정자·직접 배치)은 손대지 않는다');

-- 14. 목적지에 이미 있던 사람도 손대지 않는다
SELECT is(
  (SELECT time_slot FROM public.work_logs WHERE id = (current_setting('ups.wl_dest'))::uuid),
  '19:00',
  '목적지 슬롯에 이미 있던 인원은 그대로 둔다');

-- ── 🔴 공고 원문 정원 이동 (15~19) ───────────────────────────
-- 15. 총합 보존 → total_positions 불변 · status 전이 없음
SELECT is(
  (SELECT total_positions::text || '|' || status::text FROM public.job_postings
   WHERE id = (current_setting('ups.jp_id'))::uuid),
  '12|active',
  '정원을 옮기기만 하므로 total_positions 총합과 status 가 불변이다');

-- 16. 출발지 18:00 딜러 = 5 − 1(협업자가 옮긴 c) − 3 = 1
SELECT is(
  (SELECT public._posting_schedule_role_count(schedule, '2026-09-05', '18:00', 'dealer')
   FROM public.job_postings WHERE id = (current_setting('ups.jp_id'))::uuid),
  1,
  '출발지 정원이 옮긴 인원수만큼 줄어든다');

-- 17. 기존 목적지 19:00 딜러 = 3 + 1(c) = 4 — 있는 슬롯에는 더하기만 한다
SELECT is(
  (SELECT public._posting_schedule_role_count(schedule, '2026-09-05', '19:00', 'dealer')
   FROM public.job_postings WHERE id = (current_setting('ups.jp_id'))::uuid),
  4,
  '이미 있는 목적지 슬롯에는 정원을 더한다');

-- 18. 원문에 없던 09:00 슬롯이 신설되고 정원 3 을 갖는다
SELECT is(
  (SELECT public._posting_schedule_role_count(schedule, '2026-09-05', '09:00', 'dealer')
   FROM public.job_postings WHERE id = (current_setting('ups.jp_id'))::uuid),
  3,
  '원문에 없던 목적지 슬롯은 신설되어 정원을 넘겨받는다');

-- 19. 🔴 zod 계약 — 신설 슬롯에 JSON null 이 없어야 한다(customRole:null 이면 공고가 통째로 증발)
SELECT is(
  (SELECT count(*)::int
   FROM public.job_postings jp,
        LATERAL jsonb_array_elements(jp.schedule->'requirements') req,
        LATERAL jsonb_array_elements(req->'timeSlots') ts,
        LATERAL jsonb_array_elements(ts->'roles') r,
        LATERAL jsonb_each(r) kv
   WHERE jp.id = (current_setting('ups.jp_id'))::uuid
     AND jsonb_typeof(kv.value) = 'null'),
  0,
  '신설된 슬롯·역할에 JSON null 이 없다 (strict zod 계약 보존)');

-- 20. 🔴 셀 분해 — m 의 원소가 [09-04, 09-05, 09-07] 을 덮는데 09-05 만 옮겨야 한다
SELECT is(
  (SELECT string_agg(e->>'timeSlot' || '@' || (e->'dates')::text, ' / ' ORDER BY e->>'timeSlot')
   FROM public.applications a, LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('ups.app_m'))::uuid),
  '09:00@["2026-09-05"] / 18:00@["2026-09-04", "2026-09-07"]',
  '편집한 날만 분리되고 나머지 날은 원래 시각을 유지한다 (#407 셀 분해 상속)');

-- ── 알림 (21~23) ────────────────────────────────────────────
-- ⚠️ notifications 는 수신자만 읽을 수 있다. 구인자 컨텍스트로 읽으면 RLS 가 전부 가린다.
SELECT jpc_test_clear_user();
RESET ROLE;

-- 21. 🔴 취소자에게는 알림이 가지 않는다
SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = (current_setting('ups.u_x'))::uuid AND type = 'schedule_change'),
  0,
  '취소된 인원에게는 시각 변경 알림이 가지 않는다');

-- 22. 옮겨진 사람은 각자 자기 것 1건만 받는다(알림 폭풍이 아니다)
SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id = (current_setting('ups.u_a'))::uuid AND type = 'schedule_change'
     AND data->>'workLogId' = current_setting('ups.wl_a')),
  1,
  '옮겨진 인원은 자기 근무에 대한 알림 1건을 받는다');

-- 23. 알림 본문에 이전값 → 이후값이 실린다(Case 2-B 상속)
SELECT ok(
  (SELECT body FROM public.notifications
   WHERE recipient_id = (current_setting('ups.u_a'))::uuid AND type = 'schedule_change'
     AND data->>'workLogId' = current_setting('ups.wl_a')) LIKE '%18:00 → 09:00%',
  '알림 본문에 이전 시각과 새 시각이 함께 실린다');

-- ── 정원 이동을 건너뛰는 갈래 (24) ───────────────────────────
SELECT jpc_test_set_user((current_setting('ups.owner_id'))::uuid);

-- 24. 컨테이너 공고 — 모집 요건이 없다. work_logs 는 옮기고 정원 이동만 건너뛴다.
DO $$
DECLARE v jsonb;
BEGIN
  v := public.update_posting_slot_time(
         (current_setting('ups.cont_id'))::uuid, '2026-09-05', 'dealer', '18:00',
         ARRAY[(current_setting('ups.wl_cont'))::uuid], '{"startTime":"21:00"}'::jsonb);
  PERFORM set_config('ups.res_cont', v::text, true);
END $$;

SELECT is(
  (SELECT (r->>'updated') || '|' || (r->>'capacitySkipReason') || '|' || COALESCE(r->>'capacityMoved', 'null')
   FROM (SELECT (current_setting('ups.res_cont'))::jsonb AS r) t),
  '1|container_posting|null',
  '컨테이너 공고는 근무 시각만 옮기고 정원 이동은 사유와 함께 건너뛴다');

-- ── 🔴 25: 이 마이그의 본체 — 출발지 정원 재개방 차단 ────────
-- 18:00 딜러: 정원 1(이동 후) / 배치 1(direct). 여기에 1명을 더 확정하려 하면 2 > 1 로 막혀야 한다.
-- 정원 이동을 빼면 정원이 5 로 남아 1 + 1 ≤ 5 가 통과한다 → 이 테스트가 red 가 된다.
SELECT jpc_test_clear_user();
RESET ROLE;

DO $$
DECLARE
  v_u   uuid := gen_random_uuid();
  v_app uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (v_u, 'ups_new_' || v_u || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  INSERT INTO public.users (id, email, name, role, is_active, identity_verified, created_at, updated_at)
  VALUES (v_u, 'ups_new_' || v_u || '@test.local', 'newbie', 'staff'::user_role, true, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET is_active = true, identity_verified = true;
  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
  VALUES (v_app, (current_setting('ups.jp_id'))::uuid, v_u, 'newbie', 'applied', now(), now());
  PERFORM set_config('ups.app_new', v_app::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('ups.owner_id'))::uuid);

DO $$
DECLARE v_err text := '(no error)';
BEGIN
  BEGIN
    PERFORM public.confirm_application(
      (current_setting('ups.app_new'))::uuid,
      (current_setting('ups.owner_id'))::uuid,
      '[{"date":"2026-09-05","timeSlot":"18:00","role":"dealer"}]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  PERFORM set_config('ups.confirm_err', v_err, true);
END $$;

SELECT ok(
  current_setting('ups.confirm_err') LIKE '%MAX_CAPACITY_REACHED%',
  '🔴 정원을 함께 옮겼으므로 출발지 슬롯의 신규 확정이 정원 초과로 막힌다 (재개방 차단)');

-- 26. 정원이 0 이 되어도 역할 항목을 **남긴다**. floor 1명(정원 1)을 전부 옮긴다.
--     ⚠️ 계약이 뒤집힌 지점이다(20260804140000). 원래는 "지운다"였고 근거는
--        "남겨도 `v_capacity > 0` 가드는 똑같이 스킵되므로 보안 차이가 없다"였다.
--        그 가드가 `IS NOT NULL` 로 바뀌면서 근거가 무효가 됐다 —
--        지우면 축 미매칭(정원 미상) → 확정 통과 / 남기면 count:0(자리 없음) → 확정 거부.
--     이 단언이 지키는 나머지 두 축(같은 슬롯의 다른 역할·목적지 슬롯 보존)은 그대로다.
DO $$
BEGIN
  PERFORM public.update_posting_slot_time(
    (current_setting('ups.jp_id'))::uuid, '2026-09-05', 'floor', '18:00',
    ARRAY[(current_setting('ups.wl_f'))::uuid], '{"startTime":"22:00"}'::jsonb);
END $$;

SELECT is(
  (SELECT COALESCE(public._posting_schedule_role_count(schedule, '2026-09-05', '18:00', 'floor')::text, 'gone')
       || '|' || public._posting_schedule_role_count(schedule, '2026-09-05', '18:00', 'dealer')::text
       || '|' || public._posting_schedule_role_count(schedule, '2026-09-05', '22:00', 'floor')::text
   FROM public.job_postings WHERE id = (current_setting('ups.jp_id'))::uuid),
  '0|1|1',
  '정원이 0 이 된 역할은 count:0 으로 남고, 같은 슬롯의 다른 역할과 목적지 슬롯도 보존된다');

-- 27. 🔴 고정공고 — 스키마가 요건 1개·슬롯 1개만 허용하므로 원문을 건드리면 안 된다
DO $$
DECLARE v jsonb;
BEGIN
  UPDATE public.job_postings SET schedule = '{
    "kind": "fixed", "daysPerWeek": 3,
    "requirements": [{"date": null, "timeSlots": [
      {"isTimeToBeAnnounced": true, "roles": [{"role": "dealer", "count": 2}]}]}]}'::jsonb
  WHERE id = (current_setting('ups.jp_id'))::uuid;

  v := public.update_posting_slot_time(
         (current_setting('ups.jp_id'))::uuid, '2026-09-05', 'dealer', '18:00',
         ARRAY[(current_setting('ups.wl_dir'))::uuid], '{"startTime":"23:00"}'::jsonb);
  PERFORM set_config('ups.res_fixed', v::text, true);
END $$;

SELECT is(
  (SELECT (r->>'updated') || '|' || (r->>'capacitySkipReason')
   FROM (SELECT (current_setting('ups.res_fixed'))::jsonb AS r) t)
  || '|' || (SELECT jsonb_array_length(schedule->'requirements')::text || ':' ||
                    jsonb_array_length(schedule->'requirements'->0->'timeSlots')::text
             FROM public.job_postings WHERE id = (current_setting('ups.jp_id'))::uuid),
  '1|fixed_schedule|1:1',
  '고정공고는 정원 이동을 건너뛰고 요건 1개·슬롯 1개 구조가 보존된다');

-- ── 계약 잡동사니 (28~32) ────────────────────────────────────
-- 28. 같은 시간으로의 이동은 거부한다(무의미한 알림 발송 차단)
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','20:00',
              ARRAY[%L::uuid], '{"startTime":"20:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_adj')),
  '%INVALID_INPUT%',
  '출발지와 같은 시간으로의 이동은 거부한다');

-- 29. 시간 축을 아예 안 보내면 거부한다(단건 RPC 의 GRID-1 과 달리 여기선 시간이 목적이다)
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','20:00',
              ARRAY[%L::uuid], '{}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_adj')),
  '%INVALID_INPUT%',
  '시간을 지정하지 않으면 거부한다');

-- 30. 빈 대상 배열은 거부한다
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','dealer','20:00',
              ARRAY[]::uuid[], '{"startTime":"22:00"}'::jsonb)$q$,
         current_setting('ups.jp_id')),
  '%INVALID_INPUT%',
  '대상을 하나도 고르지 않으면 거부한다');

-- 31. 미정 센티널 — timeUndecided 가 startTime 보다 우선하고 슬롯 키가 '미정' 으로 접힌다
DO $$
BEGIN
  PERFORM public.update_posting_slot_time(
    (current_setting('ups.jp_id'))::uuid, '2026-09-05', 'dealer', '20:00',
    ARRAY[(current_setting('ups.wl_adj'))::uuid],
    '{"timeUndecided":true,"startTime":"23:00"}'::jsonb);
END $$;

SELECT is(
  (SELECT COALESCE(time_slot, '(null)') || '|' || public._posting_slot_key(time_slot)
   FROM public.work_logs WHERE id = (current_setting('ups.wl_adj'))::uuid),
  '(null)|미정',
  'timeUndecided 가 startTime 보다 우선하고 슬롯 키는 미정으로 접힌다');

-- 32. SECDEF search_path 에 pg_temp 가 보존돼 있다
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
         unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c
    WHERE n.nspname = 'public' AND p.proname = 'update_posting_slot_time'
      AND c LIKE 'search_path=%' AND c ILIKE '%pg_temp%'),
  'SECDEF search_path 에 pg_temp 가 포함돼 있다');

-- 33. 🔴 레거시 `headcount` 역할에서도 총합이 보존된다.
--     `_total_positions_from_schedule`(20260718000000:24)이 COALESCE(count, headcount, 0) 로
--     세므로, `count` 로만 읽고 쓰면 headcount-only 역할이 0 으로 보여 조용히 지워지고
--     총합이 깨진다 → total_positions 변동 → capacity_full 자동 전이까지 연쇄한다.
SELECT is(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-05","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"dealer","headcount":5}]},
        {"startTime":"19:00","roles":[{"role":"dealer","headcount":4}]}]}]}'::jsonb AS sched)
   SELECT public._total_positions_from_schedule(sched)::text || '->' ||
          public._total_positions_from_schedule(
            public._posting_schedule_move_capacity(
              sched, '2026-09-05', 'dealer', '18:00', '19:00', '19:00', 3))::text
   FROM s),
  '9->9',
  'headcount 만 있는 레거시 역할에서도 정원 총합이 보존된다');

-- 34. 되돌려 쓰는 키가 원래 키를 유지한다 — 새로 count 를 만들면 COALESCE 우선순위가 뒤집힌다.
SELECT is(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-05","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"dealer","headcount":5}]}]}]}'::jsonb AS sched)
   SELECT string_agg(kv.key, ',' ORDER BY kv.key)
   FROM s,
        LATERAL jsonb_array_elements(
          public._posting_schedule_move_capacity(
            sched, '2026-09-05', 'dealer', '18:00', '19:00', '19:00', 3)->'requirements') req,
        LATERAL jsonb_array_elements(req->'timeSlots') ts,
        LATERAL jsonb_array_elements(ts->'roles') r,
        LATERAL jsonb_each(r) kv
   WHERE public._posting_schedule_slot_key(ts) = '18:00'),
  'headcount,role',
  '레거시 역할은 headcount 키를 유지한 채 값만 줄어든다 (count 키를 새로 만들지 않는다)');

-- 35. 🔴 초과 배정 슬롯(배치 > 원문 정원)에서도 총합이 보존된다.
--     `GREATEST(count - n, 0)` 로 깎으면서 목적지에 n 전액을 더하면 총합이 **는다** —
--     실측 3 → 6. total_positions 가 늘면 capacity_full 공고가 active 로 되돌아간다.
--     옮길 양을 출발지가 실제로 가진 만큼으로 먼저 clamp 해야 한다.
SELECT is(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-05","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"dealer","count":2}]},
        {"startTime":"19:00","roles":[{"role":"dealer","count":1}]}]}]}'::jsonb AS sched)
   SELECT public._total_positions_from_schedule(sched)::text || '->' ||
          public._total_positions_from_schedule(
            public._posting_schedule_move_capacity(
              sched, '2026-09-05', 'dealer', '18:00', '19:00', '19:00', 5))::text
   FROM s),
  '3->3',
  '배치가 원문 정원을 넘는 슬롯을 옮겨도 정원 총합이 늘지 않는다');

-- 36. 옮길 정원이 아예 없으면 원문을 건드리지 않는다(무의미한 UPDATE·알림 방지)
SELECT is(
  (WITH s AS (SELECT '{"kind":"dated","requirements":[{"date":"2026-09-05","timeSlots":[
        {"startTime":"18:00","roles":[{"role":"floor","count":2}]}]}]}'::jsonb AS sched)
   SELECT (public._posting_schedule_move_capacity(
             sched, '2026-09-05', 'dealer', '18:00', '19:00', '19:00', 3) = sched)::text
   FROM s),
  'true',
  '출발지에 그 역할 정원이 없으면 공고 원문을 그대로 둔다');

-- ── 🔴 권한 축소 방향 회귀 가드 (37~38) ─────────────────────
-- 교집합(워크스페이스 멤버 ∪ 협업자) 밖은 전부 거부돼야 한다. SECDEF 라 RLS 가 못 막는 자리다.
-- 37. work_logs.owner_id 만 가진 사람은 거부된다 — 그 사람은 공고 원문을 고칠 권한이 없다.
--     (wl_update 에는 owner 분기가 있지만 jp_update 에는 없다 → 교집합에서 탈락)
-- ⚠️ 픽스처는 postgres 로 돌아가야 한다. `jpc_test_clear_user` 는 JWT 만 지우고
--    role 은 `authenticated` 로 남겨 두므로(jpc_helpers.sql:194-201) auth.users INSERT 가 막힌다.
SELECT jpc_test_clear_user();
RESET ROLE;

DO $$
DECLARE
  v_u  uuid := gen_random_uuid();
  v_wl uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (v_u, 'ups_owner_only_' || v_u || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb,
          now(), now(), '', '', '', '');
  INSERT INTO public.users (id, email, name, role, is_active, identity_verified, created_at, updated_at)
  VALUES (v_u, 'ups_owner_only_' || v_u || '@test.local', 'owner only', 'employer'::user_role,
          true, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET is_active = true;
  -- 🔑 기존 행의 owner_id 를 바꿀 수는 없다 — 신원 고정 트리거(20260802120000 `fn_work_logs_pin_identity`)가
  --    소유 이전을 막는다(의도된 보호). 그래서 **처음부터** 이 사람이 owner 인 행을 새로 만든다.
  --    워크스페이스 멤버도 협업자도 아니고, 오직 그 근무 기록의 owner 이기만 하다.
  INSERT INTO public.work_logs (id, application_id, staff_id, job_posting_id, owner_id, date,
                                status, role, time_slot, created_at, updated_at)
  VALUES (v_wl, NULL, v_u, (current_setting('ups.jp_id'))::uuid, v_u, '2026-09-05',
          'scheduled', 'serving', '13:00', now(), now());
  PERFORM set_config('ups.u_owner_only',  v_u::text,  true);
  PERFORM set_config('ups.wl_owner_only', v_wl::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('ups.u_owner_only'))::uuid);
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','serving','13:00',
              ARRAY[%L::uuid], '{"startTime":"21:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_owner_only')),
  '%PERMISSION_DENIED%',
  'work_logs owner 만으로는 공고 시간을 바꿀 수 없다 (jp_update 에 owner 분기가 없다)');

-- 38. 🔴 다른 공고의 work_log 를 끼워 넣어도 전체 거부된다(IDOR 차단).
--     축 검증이 집합 크기가 아니라 **행별 전축 AND** 라 타 공고 행은 애초에 카운트되지 않는다.
SELECT jpc_test_set_user((current_setting('ups.owner_id'))::uuid);
SELECT throws_like(
  format($q$SELECT public.update_posting_slot_time(%L::uuid,'2026-09-05','serving','13:00',
              ARRAY[%L::uuid, %L::uuid], '{"startTime":"21:00"}'::jsonb)$q$,
         current_setting('ups.jp_id'), current_setting('ups.wl_owner_only'), current_setting('ups.wl_cont')),
  '%SLOT_MISMATCH%',
  '다른 공고의 근무 기록을 끼워 넣으면 전체를 거부한다 (IDOR 차단)');

SELECT * FROM finish();
ROLLBACK;
