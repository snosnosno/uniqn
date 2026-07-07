-- ops 1e M2(전반) — ops_set_tournament_posting(공고 연결/변경/해제) + ops_import_staff_from_posting(확정 스태프 스냅샷 import).
-- 스펙: docs/superpowers/specs/2026-07-06-ops-1e-staff-integration-design.md §5.1 4·5항.
-- 패턴: ops_prizes_structure.test.sql(postgres 역할 직접 시드 + set_config 보관 + throws_like 게이트별 메시지),
--       ops_rpc_security.test.sql(actor 위조/비멤버 가드), ops_staff_schema.test.sql(ops_staff 직접 INSERT 관례),
--       jpc_work_logs_rls.test.sql(work_logs 컬럼 INSERT 형태).
-- ⚠️ import 소스 쿼리는 work_logs 를 job_posting_id + status NOT IN('cancelled','no_show') +
--    DISTINCT ON(staff_id) ORDER BY date DESC, created_at DESC 로 읽는다(§2.2, 읽기 전용).
-- ⚠️ grants(anon REVOKE)는 Task 4 이후 — 이 파일은 postgres/ops_test_set_user(authenticated) 경유만 검증.

BEGIN;
SELECT plan(39);

-- ════════════════════════════════════════════════════════════════════════════
-- 시드 A: [link] 시나리오용 — ops_test_seed 기본(owner/member/outsider/workspace/jp1/tournament)
--   + jp2(같은 workspace, 링크 변경 대상) + foreign_owner/foreign_ws/jp_foreign(접근권 없는 공고).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  s               RECORD;
  v_jp2           uuid := gen_random_uuid();
  v_foreign_owner uuid := gen_random_uuid();
  v_foreign_ws    uuid := gen_random_uuid();
  v_jp_foreign    uuid := gen_random_uuid();
  v_work_date     date := current_date + 14;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',     s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',    s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',  s.outsider_id::text,   true);
  PERFORM set_config('ops.workspace_id', s.workspace_id::text,  true);
  PERFORM set_config('ops.jp1_id',       s.job_posting_id::text, true);
  PERFORM set_config('ops.t_id',         s.tournament_id::text, true);
  PERFORM set_config('ops.jp2_id',       v_jp2::text,           true);
  PERFORM set_config('ops.jp_foreign_id', v_jp_foreign::text,   true);

  -- jp2: 같은 workspace(owner=owner) — 링크 변경 대상(owner 접근권 있음, member 도 워크스페이스 경유 접근 가능).
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  ) VALUES (
    v_jp2, s.owner_id, 'ops owner', s.workspace_id, 'ops link test posting 2', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text], 3, 0, 0, 3, '+82101111112', now(), now()
  );

  -- foreign: 완전히 무관한 owner+workspace+공고 — owner/member 누구도 접근권 없음(POSTING_NOT_FOUND 시나리오).
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (v_foreign_owner, 'ops_foreign_owner_' || v_foreign_owner || '@test.local',
          '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_foreign_owner, (SELECT email FROM auth.users WHERE id = v_foreign_owner), 'ops foreign owner',
          'employer'::user_role, true, now(), now());
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_foreign_ws, 'ops foreign ws', v_foreign_owner, now(), now());
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  ) VALUES (
    v_jp_foreign, v_foreign_owner, 'ops foreign owner', v_foreign_ws, 'ops foreign posting', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text], 3, 0, 0, 3, '+82101111199', now(), now()
  );
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [link] 1) owner가 접근권 있는 공고(jp2)로 연결 변경 → job_posting_id 반영 + posting_linked 이벤트(old/new)
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_set_tournament_posting(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    (current_setting('ops.jp2_id'))::uuid
  ) INTO r;
  PERFORM set_config('ops.r1_jobPostingId', r->>'jobPostingId', true);
END $$;

SELECT is(                                                                   -- [1]
  current_setting('ops.r1_jobPostingId')::uuid, (current_setting('ops.jp2_id'))::uuid,
  '[link] 1) 반환값 jobPostingId=jp2');

SELECT is(                                                                   -- [2]
  (SELECT job_posting_id FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  (current_setting('ops.jp2_id'))::uuid,
  '[link] 1) ops_tournaments.job_posting_id=jp2 반영');

SELECT is(                                                                   -- [3]
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'posting_linked'),
  1, '[link] 1) posting_linked 이벤트 1행');

SELECT is(                                                                   -- [4]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'posting_linked'
    ORDER BY created_at DESC LIMIT 1),
  jsonb_build_object('old_posting_id', (current_setting('ops.jp1_id'))::uuid,
                     'new_posting_id', (current_setting('ops.jp2_id'))::uuid),
  '[link] 1) 이벤트 payload old=jp1/new=jp2');

-- ────────────────────────────────────────────────────────────────────────────
-- [link] 2) 공고-경유 워크스페이스 멤버가 연결 변경 시도 → PERMISSION_DENIED(owner-only)
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT throws_like(                                                          -- [5]
  $$ SELECT public.ops_set_tournament_posting(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.member_id'))::uuid,
       (current_setting('ops.jp1_id'))::uuid) $$,
  '%PERMISSION_DENIED%',
  '[link] 2) 워크스페이스 멤버(owner 아님) 연결 변경 거부');

SELECT is(                                                                   -- [6]
  (SELECT job_posting_id FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  (current_setting('ops.jp2_id'))::uuid,
  '[link] 2) 거부 후 상태 불변(jp2 유지)');

-- ────────────────────────────────────────────────────────────────────────────
-- [link] 3) owner가 접근권 없는 공고(foreign) 연결 → POSTING_NOT_FOUND
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_like(                                                          -- [7]
  $$ SELECT public.ops_set_tournament_posting(
       (current_setting('ops.t_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       (current_setting('ops.jp_foreign_id'))::uuid) $$,
  '%POSTING_NOT_FOUND%',
  '[link] 3) 접근권 없는 공고 연결 거부');

SELECT is(                                                                   -- [8]
  (SELECT job_posting_id FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  (current_setting('ops.jp2_id'))::uuid,
  '[link] 3) 거부 후 상태 불변(jp2 유지)');

-- ────────────────────────────────────────────────────────────────────────────
-- [link] 4) 해제(NULL) → posting_unlinked + 이후 워크스페이스 멤버의 ops_staff SELECT 0행(is_ops_member 축소 실측)
--   준비: ops_staff 수동 시드 1행(postgres 직접 INSERT — 쓰기는 SECDEF RPC 전용이라 링크 상태와 무관하게 시딩).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source)
  VALUES ((current_setting('ops.t_id'))::uuid, (current_setting('ops.outsider_id'))::uuid,
          'dealer', 'RLS Probe Staff', 'manual');
END $$;

SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT is(                                                                   -- [9]
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  1, '[link] 4) 해제 전: 워크스페이스 멤버 ops_staff 1행 보임(jp2 경유)');

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_set_tournament_posting(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    NULL::uuid
  ) INTO r;
  PERFORM set_config('ops.r2_jobPostingId', COALESCE(r->>'jobPostingId', '<NULL>'), true);
END $$;

SELECT is(                                                                   -- [10]
  NULLIF(current_setting('ops.r2_jobPostingId'), '<NULL>')::uuid, NULL::uuid,
  '[link] 4) 해제 반환값 jobPostingId=NULL');

SELECT is(                                                                   -- [11]
  (SELECT job_posting_id FROM public.ops_tournaments WHERE id = (current_setting('ops.t_id'))::uuid),
  NULL::uuid, '[link] 4) ops_tournaments.job_posting_id=NULL 반영');

SELECT is(                                                                   -- [12]
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'posting_unlinked'),
  1, '[link] 4) posting_unlinked 이벤트 1행');

SELECT is(                                                                   -- [13]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type = 'posting_unlinked'
    ORDER BY created_at DESC LIMIT 1),
  jsonb_build_object('old_posting_id', (current_setting('ops.jp2_id'))::uuid, 'new_posting_id', NULL::uuid),
  '[link] 4) 이벤트 payload old=jp2/new=NULL');

SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT is(                                                                   -- [14]
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  0, '[link] 4) 해제 후: 워크스페이스 멤버 ops_staff 0행(is_ops_member 축소)');

SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(                                                                   -- [15]
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.t_id'))::uuid),
  1, '[link] 4) 해제 후에도 owner 는 ops_staff 1행 계속 보임(owner_id 매칭 유지)');

-- ────────────────────────────────────────────────────────────────────────────
-- [link] 5) 동일 값(NULL→NULL) 재설정 → 이벤트 미증가(no-op)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_set_tournament_posting(
    (current_setting('ops.t_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    NULL::uuid
  ) INTO r;
  PERFORM set_config('ops.r3_jobPostingId', COALESCE(r->>'jobPostingId', '<NULL>'), true);
END $$;

SELECT is(                                                                   -- [16]
  NULLIF(current_setting('ops.r3_jobPostingId'), '<NULL>')::uuid, NULL::uuid,
  '[link] 5) no-op 반환값 jobPostingId=NULL');

SELECT is(                                                                   -- [17]
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t_id'))::uuid AND type IN ('posting_linked', 'posting_unlinked')),
  2, '[link] 5) no-op: 링크 이벤트 총계 불변(2 = linked 1 + unlinked 1)');

-- ════════════════════════════════════════════════════════════════════════════
-- 시드 B: [import] 시나리오용 — 별도 대회 t2 + jp3(같은 workspace) + 5인 work_logs
--   (딜러/플로어 confirm 경로, 날짜 상이) + (직접추가 경로 1인) + cancelled 1행 + no_show 1행.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_t2         uuid := gen_random_uuid();
  v_jp3        uuid := gen_random_uuid();
  v_dealer     uuid := gen_random_uuid();
  v_floor      uuid := gen_random_uuid();
  v_direct     uuid := gen_random_uuid();
  v_cancelled  uuid := gen_random_uuid();
  v_noshow     uuid := gen_random_uuid();
  v_owner      uuid := (current_setting('ops.owner_id'))::uuid;
  v_ws         uuid := (current_setting('ops.workspace_id'))::uuid;
  v_work_date  date := current_date + 20;
  v_work_date2 date := current_date + 21;
  v_dealer_wl  uuid;
  v_direct_wl  uuid;
BEGIN
  PERFORM set_config('role', 'postgres', true);

  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  ) VALUES (
    v_jp3, v_owner, 'ops owner', v_ws, 'ops import test posting', 'active', 'regular',
    v_work_date::text, ARRAY[v_work_date::text, v_work_date2::text], 5, 0, 0, 3, '+82101111120', now(), now()
  );

  INSERT INTO public.ops_tournaments (
    id, owner_id, job_posting_id, name, game_type, starting_chips,
    registration_open, next_entry_seq
  ) VALUES (
    v_t2, v_owner, v_jp3, 'ops import cup', 'NLH', 30000, true, 0
  );

  -- 5인 staff 유저(auth.users + public.users)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (v_dealer,    'ops_import_dealer_'    || v_dealer    || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_floor,     'ops_import_floor_'     || v_floor     || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_direct,    'ops_import_direct_'    || v_direct    || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_cancelled, 'ops_import_cancelled_' || v_cancelled || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_noshow,    'ops_import_noshow_'    || v_noshow    || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  SELECT id, email, 'ops import test staff', 'staff'::user_role, true, now(), now()
  FROM auth.users WHERE id IN (v_dealer, v_floor, v_direct, v_cancelled, v_noshow);

  -- confirm 경로: 딜러(work_date) + 플로어(work_date2, 날짜 상이)
  INSERT INTO public.work_logs (
    staff_id, job_posting_id, date, staff_name, staff_nickname, role, custom_role,
    status, owner_id, created_at, updated_at
  ) VALUES (
    v_dealer, v_jp3, v_work_date::text, '딜러A', 'dealerA', 'dealer', NULL,
    'scheduled', v_owner, now() - interval '3 hours', now() - interval '3 hours'
  ) RETURNING id INTO v_dealer_wl;

  INSERT INTO public.work_logs (
    staff_id, job_posting_id, date, staff_name, staff_nickname, role, custom_role,
    status, owner_id, created_at, updated_at
  ) VALUES (
    v_floor, v_jp3, v_work_date2::text, '플로어B', NULL, 'floor', NULL,
    'scheduled', v_owner, now() - interval '2 hours', now() - interval '2 hours'
  );

  -- 직접추가 경로: role='other' + custom_role 스냅샷 검증용(work_date)
  INSERT INTO public.work_logs (
    staff_id, job_posting_id, date, staff_name, staff_nickname, role, custom_role,
    status, owner_id, created_at, updated_at
  ) VALUES (
    v_direct, v_jp3, v_work_date::text, '다이렉트C', 'directC', 'other', '보조스태프',
    'scheduled', v_owner, now() - interval '1 hours', now() - interval '1 hours'
  ) RETURNING id INTO v_direct_wl;

  -- cancelled / no_show — import 제외 대상
  INSERT INTO public.work_logs (
    staff_id, job_posting_id, date, staff_name, role, status, owner_id, created_at, updated_at
  ) VALUES (
    v_cancelled, v_jp3, v_work_date::text, '취소D', 'dealer', 'cancelled', v_owner, now(), now()
  );
  INSERT INTO public.work_logs (
    staff_id, job_posting_id, date, staff_name, role, status, owner_id, created_at, updated_at
  ) VALUES (
    v_noshow, v_jp3, v_work_date::text, '노쇼E', 'dealer', 'no_show', v_owner, now(), now()
  );

  PERFORM set_config('ops.t2_id',        v_t2::text,        true);
  PERFORM set_config('ops.jp3_id',       v_jp3::text,       true);
  PERFORM set_config('ops.dealer_id',    v_dealer::text,    true);
  PERFORM set_config('ops.floor_id',     v_floor::text,     true);
  PERFORM set_config('ops.direct_id',    v_direct::text,    true);
  PERFORM set_config('ops.cancelled_id', v_cancelled::text, true);
  PERFORM set_config('ops.noshow_id',    v_noshow::text,    true);
  PERFORM set_config('ops.work_date',    v_work_date::text, true);
  PERFORM set_config('ops.work_date2',   v_work_date2::text, true);
  PERFORM set_config('ops.dealer_wl_id', v_dealer_wl::text, true);
  PERFORM set_config('ops.direct_wl_id', v_direct_wl::text, true);
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [import] 6) 최초 실행 → imported=3, skipped=0. 이름/role/custom_role/source/source_work_log_id 스냅샷 단언.
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_import_staff_from_posting(
    (current_setting('ops.t2_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    NULL
  ) INTO r;
  PERFORM set_config('ops.r4_imported', (r->>'imported'), true);
  PERFORM set_config('ops.r4_skipped', (r->>'skipped'), true);
END $$;

SELECT is(current_setting('ops.r4_imported')::int, 3, '[import] 6) 최초 실행 imported=3');   -- [18]
SELECT is(current_setting('ops.r4_skipped')::int, 0, '[import] 6) 최초 실행 skipped=0');       -- [19]

SELECT ok(                                                                   -- [20]
  (SELECT staff_name = '딜러A' AND staff_nickname = 'dealerA' AND role = 'dealer'
          AND custom_role IS NULL AND source = 'snapshot_import'
          AND source_work_log_id = (current_setting('ops.dealer_wl_id'))::uuid
   FROM public.ops_staff
   WHERE tournament_id = (current_setting('ops.t2_id'))::uuid
     AND staff_id = (current_setting('ops.dealer_id'))::uuid),
  '[import] 6) 딜러 스냅샷(name/nickname/role/source/source_work_log_id) 정확');

SELECT ok(                                                                   -- [21]
  (SELECT staff_name = '다이렉트C' AND custom_role = '보조스태프' AND role = 'other'
          AND source_work_log_id = (current_setting('ops.direct_wl_id'))::uuid
   FROM public.ops_staff
   WHERE tournament_id = (current_setting('ops.t2_id'))::uuid
     AND staff_id = (current_setting('ops.direct_id'))::uuid),
  '[import] 6) 직접추가 스태프 custom_role 스냅샷(보조스태프) 정확');

SELECT ok(                                                                   -- [22]
  (SELECT role = 'floor' FROM public.ops_staff
   WHERE tournament_id = (current_setting('ops.t2_id'))::uuid
     AND staff_id = (current_setting('ops.floor_id'))::uuid),
  '[import] 6) 플로어 role 스냅샷 정확');

SELECT is(                                                                   -- [23]
  (SELECT count(*)::int FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.t2_id'))::uuid
      AND staff_id = (current_setting('ops.cancelled_id'))::uuid),
  0, '[import] 6) cancelled 스태프 제외');

SELECT is(                                                                   -- [24]
  (SELECT count(*)::int FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.t2_id'))::uuid
      AND staff_id = (current_setting('ops.noshow_id'))::uuid),
  0, '[import] 6) no_show 스태프 제외');

SELECT is(                                                                   -- [25]
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.t2_id'))::uuid),
  3, '[import] 6) ops_staff 총 3행');

SELECT is(                                                                   -- [26]
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t2_id'))::uuid AND type = 'staff_imported'),
  1, '[import] 6) staff_imported 이벤트 1행');

-- ⚠️ 단일 트랜잭션 내 now() 는 트랜잭션 시작 시각에 고정 — 연속 호출 이벤트의 created_at 이 동일해
--   ORDER BY created_at 으로 "최신" 행을 구분할 수 없다. 1차 이벤트 id 를 미리 캡처해 배제 필터로 2차 행을 특정한다.
DO $$
DECLARE v_eid uuid;
BEGIN
  SELECT id INTO v_eid FROM public.ops_events
   WHERE tournament_id = (current_setting('ops.t2_id'))::uuid AND type = 'staff_imported';
  PERFORM set_config('ops.staff_imported_event1_id', v_eid::text, true);
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [import] 7) 2회 실행 → imported=0, skipped=3, 기존 행 불변(멱등) + staff_imported payload.
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_import_staff_from_posting(
    (current_setting('ops.t2_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    NULL
  ) INTO r;
  PERFORM set_config('ops.r5_imported', (r->>'imported'), true);
  PERFORM set_config('ops.r5_skipped', (r->>'skipped'), true);
END $$;

SELECT is(current_setting('ops.r5_imported')::int, 0, '[import] 7) 2회 실행 imported=0');     -- [27]
SELECT is(current_setting('ops.r5_skipped')::int, 3, '[import] 7) 2회 실행 skipped=3');         -- [28]

SELECT is(                                                                   -- [29]
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.t2_id'))::uuid),
  3, '[import] 7) 멱등: ops_staff 총행수 3 유지(중복 없음)');

SELECT is(                                                                   -- [30]
  (SELECT staff_name FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.t2_id'))::uuid
      AND staff_id = (current_setting('ops.dealer_id'))::uuid),
  '딜러A', '[import] 7) 멱등: 기존 딜러 행 불변(덮어쓰기 없음)');

SELECT is(                                                                   -- [31]
  (SELECT count(*)::int FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t2_id'))::uuid AND type = 'staff_imported'),
  2, '[import] 7) staff_imported 이벤트 누적 2행(호출당 1행 append)');

SELECT is(                                                                   -- [32]
  (SELECT payload FROM public.ops_events
    WHERE tournament_id = (current_setting('ops.t2_id'))::uuid AND type = 'staff_imported'
      AND id <> (current_setting('ops.staff_imported_event1_id'))::uuid),
  jsonb_build_object('job_posting_id', (current_setting('ops.jp3_id'))::uuid,
                     'date', NULL::text, 'imported', 0, 'skipped', 3),
  '[import] 7) 이벤트 payload {job_posting_id,date,imported,skipped} 정확(1차 이벤트 id 배제로 2차 특정)');

-- ────────────────────────────────────────────────────────────────────────────
-- [import] 8) p_date='특정일' → 그 날짜 행의 스태프만(이미 전량 import 된 뒤라 skipped 로 후보 축소 확인).
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_import_staff_from_posting(
    (current_setting('ops.t2_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    current_setting('ops.work_date')
  ) INTO r;
  PERFORM set_config('ops.r6_imported', (r->>'imported'), true);
  PERFORM set_config('ops.r6_skipped', (r->>'skipped'), true);
END $$;

SELECT is(current_setting('ops.r6_imported')::int, 0,                        -- [33]
  '[import] 8) 날짜필터(work_date, 2인 매칭) imported=0(이미 import됨)');
SELECT is(current_setting('ops.r6_skipped')::int, 2,                         -- [34]
  '[import] 8) 날짜필터(work_date) skipped=2(딜러+직접추가만, 3 아님 — 필터 실동작)');

DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.ops_import_staff_from_posting(
    (current_setting('ops.t2_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    current_setting('ops.work_date2')
  ) INTO r;
  PERFORM set_config('ops.r7_imported', (r->>'imported'), true);
  PERFORM set_config('ops.r7_skipped', (r->>'skipped'), true);
END $$;

SELECT is(current_setting('ops.r7_imported')::int, 0,                        -- [35]
  '[import] 8) 날짜필터(work_date2) imported=0(이미 import됨)');
SELECT is(current_setting('ops.r7_skipped')::int, 1,                         -- [36]
  '[import] 8) 날짜필터(work_date2) skipped=1(플로어만 매칭 — 필터 실동작)');

-- ────────────────────────────────────────────────────────────────────────────
-- [import] 9) 미연결 대회 → NO_LINKED_POSTING
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM public.ops_set_tournament_posting(
    (current_setting('ops.t2_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    NULL::uuid);
END $$;

SELECT throws_like(                                                          -- [37]
  $$ SELECT public.ops_import_staff_from_posting(
       (current_setting('ops.t2_id'))::uuid,
       (current_setting('ops.owner_id'))::uuid,
       NULL) $$,
  '%NO_LINKED_POSTING%',
  '[import] 9) 미연결 대회 → NO_LINKED_POSTING');

-- ────────────────────────────────────────────────────────────────────────────
-- [import] 10) 비멤버 actor → PERMISSION_DENIED
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT throws_like(                                                          -- [38]
  $$ SELECT public.ops_import_staff_from_posting(
       (current_setting('ops.t2_id'))::uuid,
       (current_setting('ops.outsider_id'))::uuid,
       NULL) $$,
  '%PERMISSION_DENIED%',
  '[import] 10) 비멤버 outsider → PERMISSION_DENIED');

-- ════════════════════════════════════════════════════════════════════════════
-- 시드 C(리뷰 후속 T2-M1) — [import] 최신-role 채택 회귀가드용. 별도 대회 t4 + jp4 +
--   동일 스태프(v_multi)의 work_logs 2행(구 날짜 role='floor' / 신 날짜 role='dealer', 둘 다 활성 status).
-- ⚠️ 기존 [import] 6~8은 스태프별 1행 시드뿐이라 DISTINCT ON(wl.staff_id) ORDER BY wl.staff_id,
--   wl.date DESC, wl.created_at DESC(20260707100100_ops_1e_staff_rpcs.sql:116-123)의 "최신 활동일 채택"
--   로직이 무검증이었다(ASC로 뒤집혀도 imported/skipped 카운트는 그대로라 기존 단언을 통과한다).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_t4        uuid := gen_random_uuid();
  v_jp4       uuid := gen_random_uuid();
  v_multi     uuid := gen_random_uuid();
  v_owner     uuid := (current_setting('ops.owner_id'))::uuid;
  v_ws        uuid := (current_setting('ops.workspace_id'))::uuid;
  v_old_date  date := current_date + 25;
  v_new_date  date := current_date + 26;
BEGIN
  PERFORM set_config('role', 'postgres', true);

  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  ) VALUES (
    v_jp4, v_owner, 'ops owner', v_ws, 'ops import latest-role test posting', 'active', 'regular',
    v_old_date::text, ARRAY[v_old_date::text, v_new_date::text], 1, 0, 0, 3, '+82101111121', now(), now()
  );

  INSERT INTO public.ops_tournaments (
    id, owner_id, job_posting_id, name, game_type, starting_chips,
    registration_open, next_entry_seq
  ) VALUES (
    v_t4, v_owner, v_jp4, 'ops latest-role cup', 'NLH', 30000, true, 0
  );

  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (v_multi, 'ops_import_multi_' || v_multi || '@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb,
          now(), now(), '', '', '', '');

  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES (v_multi, (SELECT email FROM auth.users WHERE id = v_multi), '멀티스태프', 'staff'::user_role, true,
          now(), now());

  -- 구 날짜: role='floor'
  INSERT INTO public.work_logs (
    staff_id, job_posting_id, date, staff_name, role, status, owner_id, created_at, updated_at
  ) VALUES (
    v_multi, v_jp4, v_old_date::text, '멀티스태프', 'floor', 'scheduled', v_owner,
    now() - interval '5 hours', now() - interval '5 hours'
  );

  -- 신 날짜: role='dealer' — 최신 활동일. import 는 이 role 을 채택해야 한다.
  INSERT INTO public.work_logs (
    staff_id, job_posting_id, date, staff_name, role, status, owner_id, created_at, updated_at
  ) VALUES (
    v_multi, v_jp4, v_new_date::text, '멀티스태프', 'dealer', 'scheduled', v_owner,
    now() - interval '4 hours', now() - interval '4 hours'
  );

  PERFORM set_config('ops.t4_id',    v_t4::text,    true);
  PERFORM set_config('ops.multi_id', v_multi::text, true);
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- [import] 11) 동일 스태프 다중 날짜(구=floor/신=dealer) → 최신 활동일(role=dealer) 채택.
-- ────────────────────────────────────────────────────────────────────────────
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);

DO $$
BEGIN
  PERFORM public.ops_import_staff_from_posting(
    (current_setting('ops.t4_id'))::uuid,
    (current_setting('ops.owner_id'))::uuid,
    NULL);
END $$;

SELECT ok(                                                                   -- [39]
  (SELECT role = 'dealer' FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.t4_id'))::uuid
      AND staff_id = (current_setting('ops.multi_id'))::uuid),
  '[import] 11) 동일 스태프 다중 날짜 — 최신 활동일(role=dealer) 채택(ORDER BY date DESC 실동작)');

SELECT * FROM finish();
ROLLBACK;
