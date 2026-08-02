-- ============================================================
-- update_work_log_slot RPC — 슬롯 편집이 work_logs 와 applications.assignments 를 함께 갱신
--
-- 마이그레이션: 20260802180000_update_work_log_slot_rpc.sql
--
-- 무엇을 지키는 테스트인가:
--   전환 전 `WorkLogRepositoryVenue.updateSlot` 은 `work_logs` 의 `time_slot`·`role` 만 UPDATE 해
--   `applications.assignments[]` 를 낡은 채 두었다(두 원천 표류). 세션 E(#404)는 병합 키를
--   FK 2단계로 바꿔 화면 증상만 막았고 원천 불일치는 남았다. 이 RPC 가 그 원인을 없앤다.
--
-- 🔴 **핵심 단언은 9~12번(multi-date 오염 차단)이다.**
--    한 원소가 dates:[d1,d2,d3] 를 덮는데 d2 만 편집하면서 그 원소의 timeSlot 을 제자리에서
--    바꾸면 d1·d3 까지 조용히 바뀐다. 분할을 빼고 제자리 갱신으로 되돌리면 9번이 red 가 된다.
--    그리고 조각의 `groupId` 를 새로 발급하면 11번이 red 가 된다 —
--    `work_logs.assignment_group_id` 와 어긋나 세션 E 가 세운 병합 링크가 다시 깨지기 때문이다.
--
-- ⚠️ 42501 단독 단언 금지(선례): 권한 거부는 `throws_like '%PERMISSION_DENIED%'` 로 본다.
--    SQLSTATE 만 보면 무관한 트리거가 낸 42501 로도 green 이 되어 red-스왑이 안 잡힌다.
--
-- 🔑 `protect_work_log_payroll_columns` 는 payroll 컬럼이 바뀔 때만 발화한다(prosrc 실측).
--    이 RPC 는 payroll 을 건드리지 않으므로 app_metadata.role 과 무관하게 통과한다 —
--    그래서 여기서는 `jpc_test_set_user()` 로 충분하다(정산 RPC 테스트와 다른 점).
--
-- ⚠️ RPC 호출과 그 결과 조회를 **한 SELECT 안에 섞지 않는다.** 볼라틸 함수와 스칼라 서브쿼리의
--    평가 순서는 보장되지 않아 "호출 전 상태"를 읽고도 green 이 될 수 있다. 호출은 DO 블록에서
--    먼저 끝내고 반환값을 GUC 로 넘긴다.
-- ============================================================
BEGIN;
SELECT plan(27);

DO $$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('uws.owner_id',  s.owner_id::text,        true);
  PERFORM set_config('uws.collab_id', s.collaborator_id::text, true);
  PERFORM set_config('uws.out_id',    s.outsider_id::text,     true);
  PERFORM set_config('uws.jp_id',     s.job_posting_id::text,  true);
END $$;

-- 픽스처. 시드의 지원서/근무기록은 assignments 가 비어 있어 이 테스트의 갈래를 못 만든다 —
-- 갈래별로 지원서·근무기록 쌍을 직접 세운다(전부 postgres 컨텍스트라 RLS 무관).
--
-- ⚠️ `applications_job_posting_id_applicant_id_key` 가 (공고, 지원자) 유일성을 강제한다.
--    시드가 이미 outsider 의 지원서를 하나 만들어 두므로 갈래마다 **지원자를 새로 만든다**.
--    공고는 시드 것을 그대로 쓴다 — 협업자 권한 분기(7번)가 그 공고에만 등록돼 있기 때문이다.
DO $$
DECLARE
  v_jp  uuid := (current_setting('uws.jp_id'))::uuid;
  v_own uuid := (current_setting('uws.owner_id'))::uuid;
  v_app_multi uuid := gen_random_uuid();
  v_app_one   uuid := gen_random_uuid();
  v_app_dup   uuid := gen_random_uuid();
  v_app_cust  uuid := gen_random_uuid();
  v_app_mr    uuid := gen_random_uuid();
  v_u_multi   uuid := gen_random_uuid();
  v_u_one     uuid := gen_random_uuid();
  v_u_dup     uuid := gen_random_uuid();
  v_u_cust    uuid := gen_random_uuid();
  v_u_direct  uuid := gen_random_uuid();
  v_u_mr      uuid := gen_random_uuid();
  v_wl_d2     uuid := gen_random_uuid();
  v_wl_one    uuid := gen_random_uuid();
  v_wl_dup    uuid := gen_random_uuid();
  v_wl_cust   uuid := gen_random_uuid();
  v_wl_direct uuid := gen_random_uuid();
  v_wl_mr     uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  SELECT u, 'uws_' || u || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  FROM unnest(ARRAY[v_u_multi, v_u_one, v_u_dup, v_u_cust, v_u_direct, v_u_mr]) u;

  INSERT INTO public.users (id, email, name, role, is_active, identity_verified, created_at, updated_at)
  SELECT id, email, 'uws applicant', 'staff'::user_role, true, true, now(), now()
  FROM auth.users WHERE id IN (v_u_multi, v_u_one, v_u_dup, v_u_cust, v_u_direct, v_u_mr)
  ON CONFLICT (id) DO UPDATE SET is_active = true, identity_verified = true;

  PERFORM set_config('uws.app_multi', v_app_multi::text, true);
  PERFORM set_config('uws.app_one',   v_app_one::text,   true);
  PERFORM set_config('uws.app_dup',   v_app_dup::text,   true);
  PERFORM set_config('uws.app_cust',  v_app_cust::text,  true);
  PERFORM set_config('uws.wl_d2',     v_wl_d2::text,     true);
  PERFORM set_config('uws.wl_one',    v_wl_one::text,    true);
  PERFORM set_config('uws.wl_dup',    v_wl_dup::text,    true);
  PERFORM set_config('uws.wl_cust',   v_wl_cust::text,   true);
  PERFORM set_config('uws.wl_direct', v_wl_direct::text, true);
  PERFORM set_config('uws.app_mr',    v_app_mr::text,    true);
  PERFORM set_config('uws.wl_mr',     v_wl_mr::text,     true);

  INSERT INTO public.applications (id, job_posting_id, applicant_id, applicant_name, status,
                                   assignments, created_at, updated_at)
  VALUES
    -- ① 연속 3일을 한 원소가 덮는다(그룹 지원). 편집 대상은 가운데 날(2026-09-02)뿐이다.
    (v_app_multi, v_jp, v_u_multi, 'multi', 'confirmed',
     '[{"dates":["2026-09-01","2026-09-02","2026-09-03"],"roleIds":["dealer"],
        "timeSlot":"19:00","isGrouped":true,"groupId":"grp-multi","checkMethod":"group",
        "duration":{"type":"consecutive","startDate":"2026-09-01","endDate":"2026-09-03"}}]'::jsonb,
     now(), now()),
    -- ② 1×1 (프로덕션의 실제 형태 — createSimpleAssignment 산출물)
    (v_app_one, v_jp, v_u_one, 'one', 'confirmed',
     '[{"dates":["2026-09-10"],"roleIds":["dealer"],"timeSlot":"19:00",
        "isGrouped":false,"groupId":"grp-one","checkMethod":"individual"}]'::jsonb,
     now(), now()),
    -- ③ roleIds 가 다중집합(같은 역할 2명 요청) — 어느 사람의 셀인지 못 가린다
    (v_app_dup, v_jp, v_u_dup, 'dup', 'confirmed',
     '[{"dates":["2026-09-20"],"roleIds":["dealer","dealer"],"timeSlot":"19:00",
        "isGrouped":false,"groupId":"grp-dup","checkMethod":"individual"}]'::jsonb,
     now(), now()),
    -- ④ 커스텀 역할명이 roleIds 에 들어간 형태(normalizeAssignmentRole 의 역상).
    --    게다가 timeSlot 이 이미 표류해 있다 — 자가 치유 대상.
    (v_app_cust, v_jp, v_u_cust, 'cust', 'confirmed',
     '[{"dates":["2026-09-25"],"roleIds":["바리스타"],"timeSlot":"18:00",
        "isGrouped":false,"groupId":"grp-cust","checkMethod":"individual"}]'::jsonb,
     now(), now()),
    -- ⑤ 한 원소가 **서로 다른 역할 2종**을 덮는다. 이것만이 분할의 B 조각
    --    (같은 날 × 나머지 역할)을 실행시킨다 — 위 네 픽스처는 전부 A 또는 C 만 탄다.
    (v_app_mr, v_jp, v_u_mr, 'mr', 'confirmed',
     '[{"dates":["2026-09-15"],"roleIds":["dealer","floor"],"timeSlot":"19:00",
        "isGrouped":false,"groupId":"grp-mr","checkMethod":"individual"}]'::jsonb,
     now(), now());

  INSERT INTO public.work_logs (id, application_id, assignment_group_id, staff_id, job_posting_id,
                                owner_id, date, status, role, custom_role, time_slot,
                                created_at, updated_at)
  VALUES
    (v_wl_d2,  v_app_multi, 'grp-multi', v_u_multi, v_jp, v_own, '2026-09-02', 'scheduled', 'dealer', NULL, '19:00', now(), now()),
    (v_wl_one, v_app_one,   'grp-one',   v_u_one, v_jp, v_own, '2026-09-10', 'scheduled', 'dealer', NULL, '19:00', now(), now()),
    (v_wl_dup, v_app_dup,   'grp-dup',   v_u_dup, v_jp, v_own, '2026-09-20', 'scheduled', 'dealer', NULL, '19:00', now(), now()),
    -- 커스텀 역할 행: 역할 키는 'other:바리스타' 다. time_slot 은 지원서와 이미 어긋나 있다.
    (v_wl_cust, v_app_cust, 'grp-cust',  v_u_cust, v_jp, v_own, '2026-09-25', 'scheduled', 'other', '바리스타', '20:30', now(), now()),
    -- 다역할 원소의 dealer 셀. floor 셀은 work_log 없이 지원서에만 있다(형제 역할).
    (v_wl_mr,  v_app_mr,   'grp-mr',    v_u_mr, v_jp, v_own, '2026-09-15', 'scheduled', 'dealer', NULL, '19:00', now(), now()),
    -- 🔑 add_direct_staff 산 행의 형태: application_id 가 NULL 이라 동기화 상대가 아예 없다.
    (v_wl_direct, NULL, NULL, v_u_direct, v_jp, v_own, '2026-09-30', 'scheduled', 'floor', NULL, '17:00', now(), now());
END $$;

-- 1. 시그니처 고정
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_work_log_slot'),
  'p_work_log_id uuid, p_patch jsonb',
  'update_work_log_slot 시그니처가 고정돼 있다');

-- 2. anon 은 실행 불가 / authenticated 는 가능
SELECT ok(
  NOT has_function_privilege('anon', 'public.update_work_log_slot(uuid, jsonb)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.update_work_log_slot(uuid, jsonb)', 'EXECUTE'),
  'anon EXECUTE 없음 / authenticated EXECUTE 있음');

-- ── 여기부터 공고 소유자 컨텍스트 ─────────────────────────────
SELECT jpc_test_set_user((current_setting('uws.owner_id'))::uuid);

-- 3. 미지의 키는 거부한다. 조용히 무시하면 표기 드리프트가 "저장했는데 안 바뀐다"가 된다.
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"start_time":"20:00"}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '%INVALID_INPUT%',
  '허용 목록에 없는 패치 키는 거부한다 (snake_case 드리프트 차단)');

-- 4. 폐지된 범위 문자열은 형식 단계에서 끊는다(§K 정본은 단일 시각)
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"startTime":"18:00 - 02:00"}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '%INVALID_INPUT%',
  '범위 문자열은 거부한다');

-- 5. enum 밖 역할은 22P02 가 새기 전에 앱이 매핑할 수 있는 코드로 거부한다
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"staffRole":"bogus"}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '%INVALID_INPUT%',
  '알 수 없는 역할은 거부한다');

-- 6. 🔴 인가 — SECDEF 라 RLS 가 적용되지 않는다. 함수 안의 술어가 유일한 관문이다.
--    RLS wl_update 를 그대로 재현했으므로 공고와 무관한 사용자는 거부돼야 한다.
--    (이 사용자는 지원자 본인이라 wl_select 로 읽을 수는 있지만 wl_update 대상은 아니다.)
SELECT jpc_test_set_user((current_setting('uws.out_id'))::uuid);
SELECT throws_like(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"memo":"무관한 사용자"}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '%PERMISSION_DENIED%',
  '공고와 무관한 사용자는 슬롯을 수정할 수 없다 (SECDEF 라 RLS 가 못 막는 자리)');

-- 7. 협업자는 통과한다(RLS wl_update 의 is_posting_collaborator 분기를 그대로 재현했는가)
SELECT jpc_test_set_user((current_setting('uws.collab_id'))::uuid);
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"memo":"협업자 메모"}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '공고 협업자는 슬롯을 수정할 수 있다');

SELECT jpc_test_set_user((current_setting('uws.owner_id'))::uuid);

-- ── 🔴 핵심: multi-date 원소 오염 차단 (8~12) ────────────────
-- 8. 가운데 날(2026-09-02)만 21:00 으로 편집한다.
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"startTime":"21:00"}'::jsonb)$q$,
         current_setting('uws.wl_d2')),
  '연속일 그룹의 가운데 날 편집이 성공한다');

-- 9. 🔑 이 단언이 이 마이그의 본체다 — 편집하지 않은 날들은 **원래 시각을 유지**해야 한다.
--    분할을 빼고 원소를 제자리 갱신하면 여기가 red 가 된다(9/1·9/3 이 21:00 으로 끌려간다).
SELECT is(
  (SELECT (e->>'timeSlot') || '|' || (e->'dates')::text
   FROM public.applications a,
        LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_multi'))::uuid
     AND e->'dates' @> '["2026-09-01"]'::jsonb),
  '19:00|["2026-09-01", "2026-09-03"]',
  '편집하지 않은 날(9/1·9/3)은 원래 시각 19:00 을 유지하고 한 원소로 남는다');

-- 10. 편집된 셀만 떼어져 새 시각을 갖는다
SELECT is(
  (SELECT (e->>'timeSlot') || '|' || (e->'dates')::text || '|' || (e->>'isGrouped')
   FROM public.applications a,
        LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_multi'))::uuid
     AND e->'dates' @> '["2026-09-02"]'::jsonb),
  '21:00|["2026-09-02"]|false',
  '편집된 날(9/2)만 21:00 으로 분리되고 단일 날짜라 isGrouped=false 다');

-- 11. 🔑 조각의 groupId 는 **원본 유지**여야 한다. 새로 발급하면
--     work_logs.assignment_group_id 와 어긋나 세션 E 의 병합 링크가 다시 깨진다.
SELECT is(
  (SELECT count(DISTINCT e->>'groupId')::int::text || '|' || max(e->>'groupId')
   FROM public.applications a, LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_multi'))::uuid),
  '1|grp-multi',
  '분할된 조각 전부가 원본 groupId 를 유지한다 (병합 링크 보존)');

-- 12. 분할로 dates 가 달라진 조각에는 기간 정보를 남기지 않는다(더 이상 사실이 아니다)
SELECT is(
  (SELECT count(*)::int
   FROM public.applications a, LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_multi'))::uuid AND e ? 'duration'),
  0,
  'dates 가 달라진 조각에서 stale 한 duration 은 제거된다');

-- ── 1×1 경로(프로덕션 실제 형태) ─────────────────────────────
-- 13. 0패딩 정규화 — '9:05' 를 그대로 저장하면 _posting_slot_key 가 '09:05' 와 다른 슬롯으로 가른다
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"startTime":"9:05","staffRole":"floor"}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '무패딩 시각 + 역할 변경 저장이 성공한다');

-- 14.
SELECT is(
  (SELECT time_slot || '|' || role::text FROM public.work_logs
   WHERE id = (current_setting('uws.wl_one'))::uuid),
  '09:05|floor',
  'work_logs 에 0패딩 정규화된 시각과 새 역할이 반영된다');

-- 15. 같은 저장 한 번으로 assignments 의 시각·역할이 함께 수렴한다(표류 제거)
SELECT is(
  (SELECT (e->>'timeSlot') || '|' || (e->'roleIds')::text
   FROM public.applications a, LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_one'))::uuid),
  '09:05|["floor"]',
  'assignments 의 timeSlot·roleIds 가 work_logs 와 같은 값으로 수렴한다');

-- 16. GRID-1 — 시간 축을 안 보내면 기존 시각을 덮어쓰지 않는다
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"memo":"메모만 수정"}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '시간 키 없는 부분 저장이 성공한다');

-- 17.
SELECT is(
  (SELECT time_slot || '|' || notes FROM public.work_logs
   WHERE id = (current_setting('uws.wl_one'))::uuid),
  '09:05|메모만 수정',
  '시간 축을 안 보내면 기존 time_slot 이 보존된다 (GRID-1 회귀 가드)');

-- 18. 🔴 미정 — work_logs 는 NULL 로 비우지만 assignments 에는 **JSON null 을 쓰면 안 된다.**
--     zod assignmentInnerSchema 의 `timeSlot: z.string()` 이 널을 금지하고,
--     파싱이 깨지면 지원서 레코드가 통째로 증발한다(A2 사고 선례).
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"timeUndecided":true}'::jsonb)$q$,
         current_setting('uws.wl_one')),
  '미정 저장이 성공한다');

-- 19.
SELECT is(
  (SELECT (w.time_slot IS NULL)::text || '|' || jsonb_typeof(e->'timeSlot') || '|' || (e->>'timeSlot')
   FROM public.work_logs w, public.applications a,
        LATERAL jsonb_array_elements(a.assignments) e
   WHERE w.id = (current_setting('uws.wl_one'))::uuid
     AND a.id = (current_setting('uws.app_one'))::uuid),
  'true|string|미정',
  '미정이면 work_logs 는 NULL 이지만 assignments 는 문자열 ''미정'' 이다 (zod 널 금지)');

-- ── 커스텀 역할 + 자가 치유 ──────────────────────────────────
-- 20. roleIds 의 커스텀 역할명('바리스타')은 work_logs 의 role='other'/custom_role='바리스타' 와
--     같은 역할 키('other:바리스타')로 맞물려야 매칭된다. 시간 축을 안 보내도 이미 표류해 있던
--     timeSlot 이 work_logs 값으로 수렴한다(자가 치유).
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"memo":"커스텀 역할"}'::jsonb)$q$,
         current_setting('uws.wl_cust')),
  '커스텀 역할 슬롯의 저장이 성공한다');

-- 21.
SELECT is(
  (SELECT (e->>'timeSlot') || '|' || (e->'roleIds')::text
   FROM public.applications a, LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_cust'))::uuid),
  '20:30|["바리스타"]',
  '커스텀 역할이 역할 키로 매칭되고 표류해 있던 timeSlot 이 수렴한다');

-- ── 모호하면 손대지 않는다 ───────────────────────────────────
-- ⚠️ RPC 호출을 DO 블록에서 먼저 끝내고 반환값만 넘긴다(평가 순서 함정 회피).
DO $$
BEGIN
  PERFORM set_config('uws.res_dup',
    public.update_work_log_slot((current_setting('uws.wl_dup'))::uuid,
                                '{"startTime":"22:00"}'::jsonb)::text, true);
  PERFORM set_config('uws.res_direct',
    public.update_work_log_slot((current_setting('uws.wl_direct'))::uuid,
                                '{"startTime":"18:30"}'::jsonb)::text, true);
END $$;

-- 22. roleIds 다중집합(같은 역할 2명) — 어느 사람의 셀인지 못 가리므로 동기화를 건너뛴다.
--     work_logs 는 갱신되고 assignments 는 **한 글자도 안 바뀐다**.
SELECT is(
  ((current_setting('uws.res_dup'))::jsonb ->> 'assignmentSynced')
  || '|' ||
  (SELECT w.time_slot FROM public.work_logs w WHERE w.id = (current_setting('uws.wl_dup'))::uuid)
  || '|' ||
  (SELECT (a.assignments -> 0 ->> 'timeSlot') FROM public.applications a
    WHERE a.id = (current_setting('uws.app_dup'))::uuid),
  'false|22:00|19:00',
  '역할이 다중집합이면 work_logs 만 갱신하고 assignments 는 그대로 둔다 (모호 → skip)');

-- 23. application_id 가 NULL 인 행(add_direct_staff 산출물)은 동기화 상대가 없다.
SELECT is(
  ((current_setting('uws.res_direct'))::jsonb ->> 'assignmentSyncReason')
  || '|' ||
  (SELECT w.time_slot FROM public.work_logs w WHERE w.id = (current_setting('uws.wl_direct'))::uuid),
  'no_application|18:30',
  'application_id 가 없는 행은 work_logs 만 갱신하고 이유를 반환한다');

-- ── 다역할 원소 — 분할의 B 조각(같은 날 × 나머지 역할) ──────
-- 🔑 리뷰(fable)가 짚은 구멍이다: 위 픽스처는 전부 roleIds 가 1종이라
--    `v_rest_roles` 조립과 B 조각 생성이 **한 번도 실행되지 않았다.**
--    B 가 회귀하면 형제 역할의 배정이 assignments 에서 조용히 증발하는데도 green 이었다.
-- 24.
SELECT lives_ok(
  format($q$SELECT public.update_work_log_slot(%L::uuid, '{"startTime":"23:00"}'::jsonb)$q$,
         current_setting('uws.wl_mr')),
  '다역할 원소에서 한 역할만 편집하는 저장이 성공한다');

-- 25. B 조각 — 편집하지 않은 형제 역할(floor)은 **원래 시각을 유지**해야 한다.
SELECT is(
  (SELECT (e->>'timeSlot') || '|' || (e->'roleIds')::text || '|' || (e->>'groupId')
   FROM public.applications a, LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_mr'))::uuid
     AND e->'roleIds' @> '["floor"]'::jsonb),
  '19:00|["floor"]|grp-mr',
  '형제 역할(floor)은 19:00 을 유지하고 groupId 도 보존된다');

-- 26. C 조각 — 편집한 역할(dealer)만 새 시각을 갖는다.
SELECT is(
  (SELECT (e->>'timeSlot') || '|' || (e->'roleIds')::text || '|' || (e->>'groupId')
   FROM public.applications a, LATERAL jsonb_array_elements(a.assignments) e
   WHERE a.id = (current_setting('uws.app_mr'))::uuid
     AND e->'roleIds' @> '["dealer"]'::jsonb),
  '23:00|["dealer"]|grp-mr',
  '편집한 역할(dealer)만 23:00 으로 분리된다');

-- 27. 🔴 전수 가드 — 이 세션이 건드린 어느 지원서에도 **JSON null 이 실리지 않아야** 한다.
--     zod 는 `timeSlot: z.string()` 이라 널 하나가 지원서 레코드를 통째로 증발시킨다(A2 선례).
--     19번은 미정 갈래 하나만 보지만 이건 모든 갈래의 모든 키를 본다.
SELECT is(
  (SELECT count(*)::int
   FROM public.applications a,
        LATERAL jsonb_array_elements(COALESCE(a.assignments, '[]'::jsonb)) e,
        LATERAL jsonb_each(e) kv
   WHERE a.job_posting_id = (current_setting('uws.jp_id'))::uuid
     AND jsonb_typeof(kv.value) = 'null'),
  0,
  '갱신된 assignments 어느 키에도 JSON null 이 실리지 않는다 (zod 널 금지)');

SELECT * FROM finish();
ROLLBACK;
