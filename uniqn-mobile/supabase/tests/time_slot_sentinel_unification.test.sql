-- ============================================================
-- R0 — 시간 '미정' 표현 통일 회귀 테스트
-- 마이그레이션: 20260803120000_time_slot_sentinel_unification.sql
--
-- 🔴 **핵심 단언은 6·7번(정원 키 분열 회귀 차단)이다.**
--    전환 전에는 고정공고의 정원 키가 두 갈래였다:
--      공고 측  : `WHEN v_is_fixed THEN 'NEGOTIABLE'`
--      지원서 측: `_posting_slot_key(클라가 보낸 값)`  — 'NEGOTIABLE'만 자기 자신이 키
--    클라가 '미정'/NULL 을 보내면 두 키가 갈리고, 정원 조회가 0행 → `v_capacity`=0 →
--    가드가 `IF v_capacity > 0 AND ...` 라 **통째로 건너뛰어 무제한 초과 배정**이 열린다.
--    7번은 "정원 1명인 슬롯에 2번째 확정이 거부되는가"를 본다 — 두 키가 다시 갈리면 red 다.
--
-- 🔑 red-green 확인법(둘 중 아무거나 되돌리면 7번이 red):
--    ① `_posting_slot_key` 의 `'NEGOTIABLE'` 흡수를 빼면 → 지원서 측 키가 다시 갈린다
--    ② 정원 CASE 의 `WHEN v_is_fixed THEN '미정'` 을 `'NEGOTIABLE'` 로 되돌리면 → 공고 측이 갈린다
--
-- ⚠️ RPC 호출과 결과 조회를 한 SELECT 에 섞지 않는다(볼라틸 평가 순서 미보장, #407 선례).
--    호출은 DO 블록/독립 SELECT 로 끝내고, 읽기는 `SET LOCAL ROLE postgres` 로 되돌린 뒤 한다.
-- ============================================================
BEGIN;
SELECT plan(18);

-- ── 픽스처 ───────────────────────────────────────────────────
-- 고정공고(kind='fixed', 시각 없는 슬롯 = '협의') 1개 + 일반 공고 1개.
-- 고정공고의 requirements 는 date 키가 없어 정원 조회가 'FIXED_SCHEDULE' 로 접힌다
-- (`COALESCE(req->>'date', 'FIXED_SCHEDULE') = v_rec.a_date`) — 배정 date 도 같은 값을 쓴다.
DO $$
DECLARE
  v_owner    uuid := gen_random_uuid();
  v_ws       uuid;
  v_jp_fixed uuid;
  v_jp_norm  uuid;
  -- 확정 대상 지원자들 (applications 는 (공고,지원자) 유일 — 갈래마다 새 사람)
  v_s_neg    uuid := gen_random_uuid();   -- 'NEGOTIABLE' 로 확정
  v_s_tba    uuid := gen_random_uuid();   -- '미정' 으로 확정 (정원 초과 대상)
  v_s_range  uuid := gen_random_uuid();   -- 범위형 '18:30 - 03:00'
  v_s_pad    uuid := gen_random_uuid();   -- 0패딩 대상 '9:00'
  v_s_direct uuid := gen_random_uuid();   -- add_direct_staff 대상
  -- 0패딩 정원 갈래: 공고 슬롯이 '09:00' 인데 클라가 '9:00' 을 보내는 경우
  v_jp_pad   uuid;
  v_s_p1     uuid := gen_random_uuid();
  v_s_p2     uuid := gen_random_uuid();
  -- 알림 갈래
  v_s_confirmed uuid := gen_random_uuid();  -- 확정 지원자
  v_s_applied   uuid := gen_random_uuid();  -- 미확정 지원자
  v_s_onlywl    uuid := gen_random_uuid();  -- 지원서 없이 근무표 직접 배치
  v_s_both      uuid := gen_random_uuid();  -- 지원서 + 직접배치 동시 보유(중복 발송 검사)
  v_app_conf uuid := gen_random_uuid();
BEGIN
  -- ⚠️ 역할은 auth.users 의 app_metadata 로 정한다 — public.users.role 을 나중에 바꾸면
  --    `prevent_role_self_escalation` 이 ROLE_CHANGE_DENIED 로 막는다(전용 API 전용 경로).
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (v_owner, '__r0_owner@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  SELECT u, '__r0_' || u || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  FROM unnest(ARRAY[v_s_neg, v_s_tba, v_s_range, v_s_pad, v_s_direct, v_s_p1, v_s_p2,
                    v_s_confirmed, v_s_applied, v_s_onlywl, v_s_both]) u;

  -- ⚠️ handle_new_user 트리거가 public.users 행을 이미 만들었다 — 여기는 신설이 아니라
  --    **덮어쓰기**다. role 은 건드리지 않는다(위 가드 때문에).
  UPDATE public.users SET is_active = true, identity_verified = true, name = '__r0_fixture'
   WHERE id = ANY (ARRAY[v_owner, v_s_neg, v_s_tba, v_s_range, v_s_pad, v_s_direct, v_s_p1, v_s_p2,
                         v_s_confirmed, v_s_applied, v_s_onlywl, v_s_both]);

  INSERT INTO public.workspaces (name, owner_id) VALUES ('__r0_ws', v_owner) RETURNING id INTO v_ws;

  -- 고정공고: 시각 없는 슬롯 1개 × dealer 1명 = 정원 1
  INSERT INTO public.job_postings (title, workspace_id, owner_id, status, schedule)
  VALUES ('__r0_fixed', v_ws, v_owner, 'active'::posting_status,
    jsonb_build_object(
      'kind', 'fixed',
      'requirements', jsonb_build_array(
        jsonb_build_object('timeSlots', jsonb_build_array(
          jsonb_build_object('roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 1)))))))
  ) RETURNING id INTO v_jp_fixed;

  -- 일반 공고: 정규화·알림 갈래용(정원 넉넉히)
  INSERT INTO public.job_postings (title, workspace_id, owner_id, status, schedule)
  VALUES ('__r0_normal', v_ws, v_owner, 'active'::posting_status,
    jsonb_build_object(
      'kind', 'regular',
      'requirements', jsonb_build_array(
        jsonb_build_object('date', '2026-09-01', 'timeSlots', jsonb_build_array(
          jsonb_build_object('startTime', '18:30', 'roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 9)))))))
  ) RETURNING id INTO v_jp_norm;

  -- 0패딩 공고: 슬롯 시각이 '09:00'(정본형), dealer 정원 1
  INSERT INTO public.job_postings (title, workspace_id, owner_id, status, schedule)
  VALUES ('__r0_pad', v_ws, v_owner, 'active'::posting_status,
    jsonb_build_object(
      'kind', 'regular',
      'requirements', jsonb_build_array(
        jsonb_build_object('date', '2026-09-02', 'timeSlots', jsonb_build_array(
          jsonb_build_object('startTime', '09:00', 'roles', jsonb_build_array(
            jsonb_build_object('role', 'dealer', 'count', 1)))))))
  ) RETURNING id INTO v_jp_pad;

  -- 지원서 (전부 default 'applied')
  INSERT INTO public.applications (applicant_id, job_posting_id, applicant_name) VALUES
    (v_s_p1,    v_jp_pad,   '__r0_p1'),
    (v_s_p2,    v_jp_pad,   '__r0_p2'),
    (v_s_neg,   v_jp_fixed, '__r0_neg'),
    (v_s_tba,   v_jp_fixed, '__r0_tba'),
    (v_s_range, v_jp_norm,  '__r0_range'),
    (v_s_pad,   v_jp_norm,  '__r0_pad'),
    (v_s_applied, v_jp_norm, '__r0_applied'),
    (v_s_both,  v_jp_norm,  '__r0_both');
  INSERT INTO public.applications (id, applicant_id, job_posting_id, applicant_name)
    VALUES (v_app_conf, v_s_confirmed, v_jp_norm, '__r0_confirmed');

  PERFORM set_config('r0.owner',    v_owner::text,    true);
  PERFORM set_config('r0.jp_fixed', v_jp_fixed::text, true);
  PERFORM set_config('r0.jp_norm',  v_jp_norm::text,  true);
  PERFORM set_config('r0.s_neg',    v_s_neg::text,    true);
  PERFORM set_config('r0.s_tba',    v_s_tba::text,    true);
  PERFORM set_config('r0.s_range',  v_s_range::text,  true);
  PERFORM set_config('r0.s_pad',    v_s_pad::text,    true);
  PERFORM set_config('r0.s_direct', v_s_direct::text, true);
  PERFORM set_config('r0.s_conf',   v_s_confirmed::text, true);
  PERFORM set_config('r0.s_appl',   v_s_applied::text,   true);
  PERFORM set_config('r0.s_onlywl', v_s_onlywl::text,    true);
  PERFORM set_config('r0.s_both',   v_s_both::text,      true);
  PERFORM set_config('r0.app_conf', v_app_conf::text,    true);

  -- 지원서 id 를 확정 호출에 쓰기 위해 조회해 둔다
  PERFORM set_config('r0.app_neg',
    (SELECT id FROM public.applications WHERE applicant_id = v_s_neg   AND job_posting_id = v_jp_fixed)::text, true);
  PERFORM set_config('r0.app_tba',
    (SELECT id FROM public.applications WHERE applicant_id = v_s_tba   AND job_posting_id = v_jp_fixed)::text, true);
  PERFORM set_config('r0.app_range',
    (SELECT id FROM public.applications WHERE applicant_id = v_s_range AND job_posting_id = v_jp_norm)::text, true);
  PERFORM set_config('r0.app_pad',
    (SELECT id FROM public.applications WHERE applicant_id = v_s_pad   AND job_posting_id = v_jp_norm)::text, true);
  PERFORM set_config('r0.app_p1',
    (SELECT id FROM public.applications WHERE applicant_id = v_s_p1    AND job_posting_id = v_jp_pad)::text, true);
  PERFORM set_config('r0.app_p2',
    (SELECT id FROM public.applications WHERE applicant_id = v_s_p2    AND job_posting_id = v_jp_pad)::text, true);
END $$;


-- ── 1~5. 헬퍼 계약 ───────────────────────────────────────────
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = '_normalize_time_slot'),
  'p_raw text',
  '1. _normalize_time_slot(text) 시그니처가 고정돼 있다');

SELECT is(
  public._posting_slot_key('NEGOTIABLE'),
  '미정',
  E'2. \U0001F534 _posting_slot_key 가 \'NEGOTIABLE\' 을 \'미정\' 으로 흡수한다 (키 분열의 절반 해소)');

SELECT ok(
  public._normalize_time_slot(NULL)         IS NULL
  AND public._normalize_time_slot('')       IS NULL
  AND public._normalize_time_slot('   ')    IS NULL
  AND public._normalize_time_slot('미정')    IS NULL
  AND public._normalize_time_slot('NEGOTIABLE') IS NULL,
  '3. 미정 센티널 5형태가 전부 NULL 하나로 수렴한다');

SELECT ok(
  public._normalize_time_slot('18:30')          = '18:30'
  AND public._normalize_time_slot('9:00')       = '09:00'
  AND public._normalize_time_slot('18:30 - 03:00') = '18:30'
  AND public._normalize_time_slot('17:00~00:00')   = '17:00',
  '4. 시각은 0패딩 ''HH:mm'', 범위형은 시작시각만 남는다');

-- 🔑 특히 구분자로 시작하는 가비지('-', '- 18:00', '~18:00')를 조심한다. 선두 세그먼트만 보고
--    판정하면 head 가 '' 이라 '미정'(NULL)으로 삼켜져, CHECK 이 23514 로 잡던 값이 조용히
--    통과한다(fail-closed → fail-open). 이 단언이 그 회귀를 막는다.
SELECT ok(
  public._normalize_time_slot('24:00') = '24:00'
  AND public._normalize_time_slot('아무말') = '아무말'
  AND public._normalize_time_slot('-') = '-'
  AND public._normalize_time_slot('- 18:00') = '- 18:00'
  AND public._normalize_time_slot('~18:00') = '~18:00',
  '5. 해석 불가 값은 원문 그대로 통과한다 (기존 CHECK 이 계속 잡도록 — 방어 제거 금지)');


-- ── 6~7. 🔴 정원 키 분열 회귀 차단 (이 테스트의 본체) ────────
SELECT jpc_test_set_user((current_setting('r0.owner'))::uuid);

SELECT lives_ok(
  format($q$SELECT public.confirm_application(%L::uuid, %L::uuid,
            '[{"date":"FIXED_SCHEDULE","timeSlot":"NEGOTIABLE","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.app_neg'), current_setting('r0.owner')),
  E'6. 고정공고에서 구클라 값(\'NEGOTIABLE\')으로 1명 확정된다 (하위호환 — 흡수지 에러가 아니다)');

SELECT throws_like(
  format($q$SELECT public.confirm_application(%L::uuid, %L::uuid,
            '[{"date":"FIXED_SCHEDULE","timeSlot":"미정","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.app_tba'), current_setting('r0.owner')),
  '%MAX_CAPACITY_REACHED%',
  E'7. \U0001F534 정원 1명 슬롯에 신클라 값(\'미정\')으로 2번째 확정 시 거부된다 — 두 센티널이 같은 슬롯 키로 접힌다');

-- 7-B. 같은 교정이 `add_direct_staff` 에도 들어갔는데, 7번은 `confirm_application` 만 겨냥한다.
--      아래 10번(add_direct_staff)은 **일반 공고**라 `WHEN v_is_fixed` 분기에 도달조차 하지 않는다 —
--      즉 add_direct_staff 쪽 정원 CASE 를 'NEGOTIABLE' 로 되돌려도 아무 테스트도 red 가 안 됐다.
--      고정공고 정원이 이미 1/1 로 찬 상태(6번)에서 직접 배치를 시도해 그 분기를 실제로 태운다.
SELECT throws_like(
  format($q$SELECT public.add_direct_staff(%L::uuid, %L::uuid,
            '[{"date":"FIXED_SCHEDULE","timeSlot":"미정","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.jp_fixed'), current_setting('r0.s_direct')),
  '%MAX_CAPACITY_REACHED%',
  E'7-B. \U0001F534 add_direct_staff 도 고정공고 정원 키를 같은 값으로 접는다 (7번이 못 덮는 두 번째 경로)');


-- ── 8~10. INSERT 시점 정규화 ─────────────────────────────────
SELECT lives_ok(
  format($q$SELECT public.confirm_application(%L::uuid, %L::uuid,
            '[{"date":"2026-09-01","timeSlot":"18:30 - 03:00","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.app_range'), current_setting('r0.owner')),
  '8. 레거시 범위형 timeSlot 으로도 확정이 성공한다 (23514 로 죽지 않는다)');

SELECT lives_ok(
  format($q$SELECT public.confirm_application(%L::uuid, %L::uuid,
            '[{"date":"2026-09-01","timeSlot":"9:00","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.app_pad'), current_setting('r0.owner')),
  '9. 0패딩되지 않은 시각으로도 확정이 성공한다');

SELECT lives_ok(
  format($q$SELECT public.add_direct_staff(%L::uuid, %L::uuid,
            '[{"date":"2026-09-01","timeSlot":"미정","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.jp_norm'), current_setting('r0.s_direct')),
  '10. add_direct_staff 도 센티널을 흡수한다');

-- 🔴 9-B·9-C: 정규화가 **저장만** 하고 정원 프로브는 원문으로 하면, 비패딩 시각이 조용히
--    정원을 우회한다. R0 이전엔 같은 입력이 CHECK 위반(23514)으로 시끄럽게 죽어 우연히 막혔으므로,
--    "저장을 성공시키는" 이 PR 이 프로브까지 맞추지 않으면 fail-closed 가 fail-open 으로 뒤집힌다.
--    정원 키를 `_posting_slot_key(_normalize_time_slot(...))` 로 되돌리면 9-C 만 red 가 된다.
SELECT lives_ok(
  format($q$SELECT public.confirm_application(%L::uuid, %L::uuid,
            '[{"date":"2026-09-02","timeSlot":"09:00","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.app_p1'), current_setting('r0.owner')),
  E'9-B. 정원 1명인 \'09:00\' 슬롯을 정본형으로 채운다');

SELECT throws_like(
  format($q$SELECT public.confirm_application(%L::uuid, %L::uuid,
            '[{"date":"2026-09-02","timeSlot":"9:00","role":"dealer"}]'::jsonb)$q$,
         current_setting('r0.app_p2'), current_setting('r0.owner')),
  '%MAX_CAPACITY_REACHED%',
  E'9-C. \U0001F534 비패딩 시각(\'9:00\')도 같은 슬롯으로 접혀 정원 가드에 걸린다 (조용한 우회 차단)');

SET LOCAL ROLE postgres;

-- ⚠️ `created_at` 으로 정렬하면 안 된다 — 전부 같은 트랜잭션의 `now()` 라 값이 동률이고
--    string_agg 의 순서가 비결정이 되어 계약상 flaky 하다. 명시 서수로 고정한다.
SELECT is(
  (SELECT string_agg(t.label, ' ' ORDER BY t.ord)
   FROM (
     SELECT
       CASE wl.staff_id::text
         WHEN current_setting('r0.s_neg')   THEN 1
         WHEN current_setting('r0.s_range') THEN 2
         WHEN current_setting('r0.s_pad')   THEN 3
         ELSE 4 END AS ord,
       CASE wl.staff_id::text
         WHEN current_setting('r0.s_neg')   THEN 'neg='
         WHEN current_setting('r0.s_range') THEN 'range='
         WHEN current_setting('r0.s_pad')   THEN 'pad='
         ELSE 'direct=' END
       || COALESCE(wl.time_slot, '<NULL>') AS label
     FROM public.work_logs wl
     WHERE wl.staff_id::text IN (current_setting('r0.s_neg'), current_setting('r0.s_range'),
                                 current_setting('r0.s_pad'), current_setting('r0.s_direct'))
   ) t),
  'neg=<NULL> range=18:30 pad=09:00 direct=<NULL>',
  E'11. \U0001F534 저장된 time_slot 이 정본화됐다 — 센티널→NULL · 범위형→시작시각 · 0패딩');


-- ── 12~14. 공고 변경 알림 분리 + 직접배치 스태프 수신 ────────
DO $$
DECLARE
  v_jp   uuid := (current_setting('r0.jp_norm'))::uuid;
  v_own  uuid := (current_setting('r0.owner'))::uuid;
BEGIN
  -- 확정 지원자 1명 만들기(트리거 경유 없이 상태만 세팅 — 알림 분기 입력만 필요하다)
  UPDATE public.applications SET status = 'confirmed'::application_status
   WHERE id = (current_setting('r0.app_conf'))::uuid;

  -- 지원서 없이 근무표에만 있는 스태프 + 지원서와 근무표를 동시에 가진 스태프
  INSERT INTO public.work_logs (staff_id, job_posting_id, application_id, owner_id,
                                date, time_slot, status, role, created_at, updated_at)
  VALUES
    ((current_setting('r0.s_onlywl'))::uuid, v_jp, NULL, v_own, '2026-09-01', '18:30', 'scheduled', 'dealer', now(), now()),
    ((current_setting('r0.s_both'))::uuid,   v_jp, NULL, v_own, '2026-09-01', '18:30', 'scheduled', 'dealer', now(), now());

  -- 이 시점까지의 알림은 전부 버린다 — 다음 UPDATE 가 만든 것만 본다.
  DELETE FROM public.notifications;

  -- 근무일(schedule) 변경 → v_date_changed = true
  UPDATE public.job_postings
     SET schedule = jsonb_set(schedule, '{requirements,0,timeSlots,0,startTime}', '"20:00"'::jsonb)
   WHERE id = v_jp;
END $$;

-- [3-C] 세 번째 축(`바뀌지 않습니다` 부재)은 20260804130000 의 문구 중립화 회귀 가드다.
--       update_posting_slot_time 이 확정 시각을 실제로 옮기므로 그 단언은 거짓이 될 수 있다.
SELECT is(
  (SELECT n.link || ' | ' || (n.body LIKE '%근무표에서 확인해 주세요.')::text
                 || ' | ' || (n.body LIKE '%바뀌지 않습니다%')::text
   FROM public.notifications n
   WHERE n.recipient_id::text = current_setting('r0.s_conf') AND n.type = 'job_updated'),
  '/schedule | true | false',
  '12. 확정 지원자는 /schedule 로 보내고 중립 안내만 받는다 — "바뀌지 않습니다" 단언은 제거됐다');

SELECT is(
  (SELECT n.link || ' | ' || (n.body LIKE '%근무표에서 확인해 주세요.')::text
   FROM public.notifications n
   WHERE n.recipient_id::text = current_setting('r0.s_appl') AND n.type = 'job_updated'),
  '/jobs/' || current_setting('r0.jp_norm') || ' | false',
  '13. 미확정 지원자는 기존대로 공고 링크와 원문을 받는다 (확대 없음)');

SELECT is(
  (SELECT count(*)::int || '/' || count(DISTINCT n.recipient_id)::int
   FROM public.notifications n
   WHERE n.type = 'job_updated'
     AND n.recipient_id::text IN (current_setting('r0.s_onlywl'), current_setting('r0.s_both'))),
  '2/2',
  E'14. \U0001F534 지원서 없이 근무표에만 있는 스태프도 알림을 받고, 지원서+근무표 동시 보유자에게 중복 발송되지 않는다');


-- ── 15. 재정의가 되돌린 하드닝이 없는가 ──────────────────────
SELECT is(
  (SELECT string_agg(p.proname || '=' || array_to_string(p.proconfig, ';'), ' | ' ORDER BY p.proname)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('_normalize_time_slot', '_posting_slot_key',
                       'add_direct_staff', 'confirm_application', 'notify_on_job_posting_update')),
  '_normalize_time_slot=search_path=pg_catalog, pg_temp'
  || ' | _posting_slot_key=search_path=pg_catalog, pg_temp'
  || ' | add_direct_staff=search_path=public, extensions, pg_temp'
  || ' | confirm_application=search_path=public, pg_temp'
  || ' | notify_on_job_posting_update=search_path=public, extensions, pg_temp',
  '15. CREATE OR REPLACE 가 함수별로 다른 search_path 하드닝을 그대로 보존했다 (SET 절은 proconfig 를 통째 교체한다)');

SELECT * FROM finish();
ROLLBACK;
