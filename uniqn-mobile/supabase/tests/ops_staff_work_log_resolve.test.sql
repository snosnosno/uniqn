-- ops 결함 ⑦-2 — ops_resolve_staff_work_logs 해석기 계약 핀
--
-- 설계: docs/planning/2026-08-08-ops-attendance-writeback-design.md
-- 패턴: ops_staff_link_import.test.sql(work_logs/staff 유저 시드 형태),
--       ops_rpc_security.test.sql(액터 위조·비멤버 가드).
--
-- 이 파일이 지키는 것 — 전부 "조용히 틀리는" 종류라 핀이 없으면 못 잡는다:
--   · 함정 6(카디널리티): source_work_log_id 는 스태프당 **최신 날짜 1건**이다. 운영일 행을
--     집어야 하는데 최신 행을 집으면 다일 공고에서 틀린 날짜에 시각이 박힌다.
--   · 함정 7(취소 행): update_work_log_slot 은 취소 행에도 시각 컬럼을 쓴다. 해석기가
--     후보에서 빼는 것이 **유일한 방어선**이다.
--   · 함정 5(권한 축): ops 축(is_ops_member) ≠ 공고 축. 합치면 정산 권한 경계가 무너진다.
--   · ambiguous fail-closed: work_logs 에 (공고,스태프,날짜) UNIQUE 가 없다.
--
-- ⚠️ 단언은 전부 **SECDEF 함수의 반환행**에서 한다 — RLS 테이블을 직접 세면 "0건" 이
--    "안 보인다" 일 수 있어 vacuous pass 가 된다.

BEGIN;
SELECT plan(19);

DO $$
DECLARE
  s            RECORD;
  v_alt        uuid := gen_random_uuid();   -- 대회 owner 이지만 공고 워크스페이스 밖
  v_jp         uuid := gen_random_uuid();
  v_t          uuid := gen_random_uuid();   -- 주 시나리오 대회 (event_date 있음)
  v_t_alt      uuid := gen_random_uuid();   -- 권한 경계용 (owner = v_alt)
  v_t_nopost   uuid := gen_random_uuid();   -- 공고 미연결
  v_ok         uuid := gen_random_uuid();
  v_multi      uuid := gen_random_uuid();
  v_cxl        uuid := gen_random_uuid();
  v_settled    uuid := gen_random_uuid();
  v_manual     uuid := gen_random_uuid();
  v_day        date := current_date + 10;   -- 대회 운영일
  v_day2       date := current_date + 12;   -- 🔴 더 나중 날짜 = import 가 붙드는 행
  v_wl_ok      uuid;
  v_wl_decoy   uuid;
BEGIN
  PERFORM set_config('role', 'postgres', true);
  SELECT * INTO s FROM ops_test_seed();

  PERFORM set_config('r.owner',    s.owner_id::text,     true);
  PERFORM set_config('r.member',   s.member_id::text,    true);
  PERFORM set_config('r.outsider', s.outsider_id::text,  true);
  PERFORM set_config('r.t_nodate', s.tournament_id::text, true);  -- 시드 대회는 event_date NULL
  PERFORM set_config('r.alt',      v_alt::text,          true);
  PERFORM set_config('r.t',        v_t::text,            true);
  PERFORM set_config('r.t_alt',    v_t_alt::text,        true);
  PERFORM set_config('r.t_nopost', v_t_nopost::text,     true);
  PERFORM set_config('r.ok',       v_ok::text,           true);
  PERFORM set_config('r.multi',    v_multi::text,        true);
  PERFORM set_config('r.cxl',      v_cxl::text,          true);
  PERFORM set_config('r.settled',  v_settled::text,      true);
  PERFORM set_config('r.manual',   v_manual::text,       true);

  -- ── 공고: 시드 workspace 소속(= owner/member 접근 가능) ────────────────────
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  ) VALUES (
    v_jp, s.owner_id, 'ops owner', s.workspace_id, 'ops resolve test posting', 'active', 'regular',
    v_day::text, ARRAY[v_day::text, v_day2::text], 5, 0, 0, 3, '+82101111130', now(), now()
  );

  -- ── 대회 3종 ──────────────────────────────────────────────────────────────
  INSERT INTO public.ops_tournaments (id, owner_id, job_posting_id, name, game_type,
                                      starting_chips, registration_open, next_entry_seq, event_date)
  VALUES (v_t, s.owner_id, v_jp, 'ops resolve cup', 'NLH', 30000, true, 0, v_day);

  -- 권한 경계용: 같은 공고를 보지만 owner 가 워크스페이스 밖이다.
  -- (실사용에서는 링크 후 공고 접근권이 회수된 드리프트가 이 모양이 된다.)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (v_alt, 'ops_resolve_alt_' || v_alt || '@test.local',
          '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_alt, (SELECT email FROM auth.users WHERE id = v_alt), 'ops resolve alt',
          'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.ops_tournaments (id, owner_id, job_posting_id, name, game_type,
                                      starting_chips, registration_open, next_entry_seq, event_date)
  VALUES (v_t_alt, v_alt, v_jp, 'ops resolve alt cup', 'NLH', 30000, true, 0, v_day);

  INSERT INTO public.ops_tournaments (id, owner_id, job_posting_id, name, game_type,
                                      starting_chips, registration_open, next_entry_seq, event_date)
  VALUES (v_t_nopost, s.owner_id, NULL, 'ops resolve nopost cup', 'NLH', 30000, true, 0, v_day);

  -- ── 스태프 유저 5인 ───────────────────────────────────────────────────────
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (v_ok,      'ops_rs_ok_'      || v_ok      || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_multi,   'ops_rs_multi_'   || v_multi   || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_cxl,     'ops_rs_cxl_'     || v_cxl     || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_settled, 'ops_rs_settled_' || v_settled || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_manual,  'ops_rs_manual_'  || v_manual  || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'ops resolve staff', 'staff'::user_role, true, now(), now()
  FROM auth.users WHERE id IN (v_ok, v_multi, v_cxl, v_settled, v_manual)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  -- ── work_logs ─────────────────────────────────────────────────────────────
  -- (가) ok: 운영일 1건 + 🔴 **더 나중 날짜 미끼 1건**.
  --      import 의 DISTINCT ON ... ORDER BY date DESC 는 미끼(v_day2)를 붙든다.
  --      해석기가 운영일(v_day) 행을 집는지가 함정 6 의 핀이다.
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, staff_name, role, status,
                                owner_id, created_at, updated_at)
  VALUES (v_ok, v_jp, v_day::text, '정상A', 'dealer', 'scheduled', s.owner_id, now(), now())
  RETURNING id INTO v_wl_ok;

  INSERT INTO public.work_logs (staff_id, job_posting_id, date, staff_name, role, status,
                                owner_id, created_at, updated_at)
  VALUES (v_ok, v_jp, v_day2::text, '정상A', 'dealer', 'scheduled', s.owner_id, now(), now())
  RETURNING id INTO v_wl_decoy;

  PERFORM set_config('r.wl_ok',    v_wl_ok::text,    true);
  PERFORM set_config('r.wl_decoy', v_wl_decoy::text, true);

  -- (나) multi: 같은 날 살아있는 2건 → ambiguous
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, staff_name, role, status,
                                owner_id, created_at, updated_at)
  VALUES (v_multi, v_jp, v_day::text, '중복B', 'dealer', 'scheduled', s.owner_id, now(), now()),
         (v_multi, v_jp, v_day::text, '중복B', 'floor',  'scheduled', s.owner_id, now(), now());

  -- (다) cxl: 같은 날 후보는 있으나 전부 취소/노쇼 → cancelled (not_linked 와 구분)
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, staff_name, role, status,
                                owner_id, created_at, updated_at)
  VALUES (v_cxl, v_jp, v_day::text, '취소C', 'dealer', 'cancelled', s.owner_id, now(), now()),
         (v_cxl, v_jp, v_day::text, '취소C', 'dealer', 'no_show',   s.owner_id, now(), now());

  -- (라) settled: 정산 완료 — 해석은 되지만 쓰면 ALREADY_SETTLED
  INSERT INTO public.work_logs (staff_id, job_posting_id, date, staff_name, role, status,
                                check_in_ts, check_out_ts, payroll_status,
                                owner_id, created_at, updated_at)
  VALUES (v_settled, v_jp, v_day::text, '정산D', 'dealer', 'checked_out',
          now() - interval '9 hours', now() - interval '1 hours', 'completed',
          s.owner_id, now(), now());

  -- (마) manual: work_log 자체가 없다 → not_linked

  -- ── ops_staff: 5인 전원. ok 의 source_work_log_id 는 **미끼**를 가리킨다(import 재현) ──
  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source, source_work_log_id)
  VALUES
    (v_t, v_ok,      'dealer', '정상A', 'snapshot_import', v_wl_decoy),
    (v_t, v_multi,   'dealer', '중복B', 'snapshot_import', NULL),
    (v_t, v_cxl,     'dealer', '취소C', 'snapshot_import', NULL),
    (v_t, v_settled, 'dealer', '정산D', 'snapshot_import', NULL),
    (v_t, v_manual,  'dealer', '수동E', 'manual',          NULL);

  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source, source_work_log_id)
  VALUES (v_t_alt, v_ok, 'dealer', '정상A', 'snapshot_import', NULL);

  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source, source_work_log_id)
  VALUES (v_t_nopost, v_ok, 'dealer', '정상A', 'manual', NULL);

  -- ⚠️ ops_test_seed() 는 ops_staff 를 만들지 않는다. 시드 대회(event_date NULL)에도 한 명을
  --    넣어야 no_event_date 를 **관측**할 수 있다 — 스태프가 0명이면 함수는 0행을 돌려주고
  --    `SELECT DISTINCT reason` 이 NULL 이 되어 단언이 공허해진다(vacuous pass 방지).
  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source, source_work_log_id)
  VALUES ((SELECT id FROM public.ops_tournaments WHERE id = s.tournament_id),
          v_ok, 'dealer', '정상A', 'manual', NULL);
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- owner 시점
-- ════════════════════════════════════════════════════════════════════════════
SELECT ops_test_set_user(current_setting('r.owner')::uuid);

-- 1~3) 정상 해석
SELECT is(
  (SELECT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.ok')::uuid),
  'ok', '운영일에 살아있는 행이 1건이면 ok');

-- 🔴 함정 6 핀 — source_work_log_id(미끼, 더 나중 날짜)가 아니라 운영일 행을 집는다.
SELECT is(
  (SELECT work_log_id FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.ok')::uuid),
  current_setting('r.wl_ok')::uuid,
  '🔴 해석은 event_date 행을 집는다 — source_work_log_id(최신 날짜 미끼)가 아니다 (함정 6)');

SELECT is(
  (SELECT write_allowed FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.ok')::uuid),
  true, '공고 owner 는 write_allowed');

-- 4~5) ambiguous fail-closed
SELECT is(
  (SELECT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.multi')::uuid),
  'ambiguous', '같은 날 살아있는 행이 2건이면 ambiguous (UNIQUE 제약이 없다)');

SELECT ok(
  (SELECT work_log_id IS NULL FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.multi')::uuid),
  '🔴 ambiguous 는 임의로 1건을 고르지 않는다 (fail-closed)');

-- 6~7) 🔴 함정 7 핀 — 취소/노쇼는 후보에서 빠진다
SELECT is(
  (SELECT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.cxl')::uuid),
  'cancelled', '후보가 전부 취소/노쇼면 cancelled (not_linked 와 구분)');

SELECT ok(
  (SELECT work_log_id IS NULL FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.cxl')::uuid),
  '🔴 취소 행은 work_log_id 로 새어나오지 않는다 — update_work_log_slot 은 취소 행에도 '
  '시각을 쓰므로 여기가 유일한 방어선이다 (함정 7)');

-- 8~9) settled — 해석은 되지만 쓰기는 서버가 막는다
SELECT is(
  (SELECT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.settled')::uuid),
  'settled', 'payroll_status=completed 는 settled 로 미리 알린다');

SELECT ok(
  (SELECT work_log_id IS NOT NULL FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.settled')::uuid),
  'settled 여도 해석 자체는 성공한다 (행 표시는 되어야 한다)');

-- 10) not_linked
SELECT is(
  (SELECT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)
   WHERE staff_id = current_setting('r.manual')::uuid),
  'not_linked', '수동 추가 스태프는 대응 work_log 가 없어 not_linked');

-- 11) 해석 실패해도 행이 사라지지 않는다 (화면이 스태프를 잃으면 안 된다)
SELECT is(
  (SELECT count(*)::int FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.owner')::uuid)),
  5, '해석 실패 사유와 무관하게 ops_staff 전원이 반환된다');

-- 12) event_date 없음 (컬럼이 nullable 이다)
SELECT is(
  (SELECT DISTINCT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t_nodate')::uuid, current_setting('r.owner')::uuid)),
  'no_event_date', 'event_date 가 NULL 이면 no_event_date 로 fail-closed');

-- 13) 공고 미연결
SELECT is(
  (SELECT DISTINCT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t_nopost')::uuid, current_setting('r.owner')::uuid)),
  'no_posting', '공고 미연결 대회는 no_posting');

-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 함정 5 — 권한 축이 두 개다. ops 멤버라고 공고 축을 통과시키지 않는다.
-- ════════════════════════════════════════════════════════════════════════════
SELECT ops_test_set_user(current_setting('r.alt')::uuid);

-- 14) 입장은 된다 (대회 owner 이므로 is_ops_member = true)
SELECT is(
  (SELECT count(*)::int FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t_alt')::uuid, current_setting('r.alt')::uuid)),
  1, '대회 owner 는 ops 축으로 입장한다');

-- 15) 해석 자체는 성공한다 — 해석과 권한은 직교한다
SELECT is(
  (SELECT reason FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t_alt')::uuid, current_setting('r.alt')::uuid)),
  'ok', '해석과 권한은 직교 — 행은 정상 해석된다');

-- 16) 🔴 그러나 쓰기는 막힌다. 이것이 정산 권한 경계다.
SELECT is(
  (SELECT write_allowed FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t_alt')::uuid, current_setting('r.alt')::uuid)),
  false,
  '🔴 대회 owner 라도 공고 워크스페이스 밖이면 write_allowed=false — '
  'ops 축으로 완화하면 정산 권한 경계가 무너진다 (함정 5)');

-- ════════════════════════════════════════════════════════════════════════════
-- workspace 멤버 / 가드
-- ════════════════════════════════════════════════════════════════════════════
SELECT ops_test_set_user(current_setting('r.member')::uuid);

-- 17) workspace editor 는 공고 축을 통과한다
SELECT is(
  (SELECT write_allowed FROM public.ops_resolve_staff_work_logs(
     current_setting('r.t')::uuid, current_setting('r.member')::uuid)
   WHERE staff_id = current_setting('r.ok')::uuid),
  true, 'workspace 멤버는 공고 축을 통과해 write_allowed');

-- 18) 액터 위조 거부
SELECT throws_like(
  format('SELECT * FROM public.ops_resolve_staff_work_logs(%L, %L)',
         current_setting('r.t'), current_setting('r.owner')),
  '%PERMISSION_DENIED%',
  '다른 사람 id 를 actor 로 넣으면 거부한다');

-- 19) 비멤버 거부
SELECT ops_test_set_user(current_setting('r.outsider')::uuid);
SELECT throws_like(
  format('SELECT * FROM public.ops_resolve_staff_work_logs(%L, %L)',
         current_setting('r.t'), current_setting('r.outsider')),
  '%PERMISSION_DENIED%',
  'ops 비멤버는 입장부터 거부한다');

SELECT * FROM finish();
ROLLBACK;
