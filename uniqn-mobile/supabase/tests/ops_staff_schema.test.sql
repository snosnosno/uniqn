-- ops 1e M1 스키마+RLS 검증: ops_staff 테이블 구조·enum 7값·배정 백스톱(uq_ops_tables_assigned_staff)·
--   SELECT-only RLS(owner/workspace멤버 보임·outsider/anon 0행)·authenticated 직접 DML 거부.
-- 패턴: ops_1c_tables_rls.test.sql(RLS enabled+forced 직접 pg_class 조회, postgres 역할 우회 시드,
--   INSERT=throws_ok/UPDATE·DELETE=예외흡수 후 불변 단언), ops_tables_seats_rls.test.sql(멤버십 RLS 3분기).
-- ⚠️ enum_has_labels 목록은 SELECT enum_range(NULL::public.ops_event_type) 실측(db:reset 직후) 값 그대로 —
--   1f 가 추가한 prize_structure_set/player_bust_undone/prize_corrected 포함, 하드코딩 추측 아님.
BEGIN;
SELECT plan(16);

-- ─── (1) 테이블/컬럼/인덱스 구조 ───
SELECT has_table('public', 'ops_staff', 'ops_staff 존재');
SELECT col_is_pk('public', 'ops_staff', 'id', 'PK=id');
SELECT col_not_null('public', 'ops_staff', 'staff_name', '이름 스냅샷 NOT NULL');
SELECT col_type_is('public', 'ops_staff', 'role', 'staff_role', 'role은 staff_role enum');
SELECT has_index('public', 'ops_staff', 'ops_staff_tournament_id_staff_id_key',
  'UNIQUE(tournament_id, staff_id) 인덱스 존재');
SELECT has_index('public', 'ops_tables', 'uq_ops_tables_assigned_staff',
  'ops_tables 배정 백스톱 partial UNIQUE 존재');

-- ─── (2) enum 7값 추가 (기존 21값 + 신규 7값 = 28값, enum_range 리셋후 실측 기반) ───
SELECT enum_has_labels('public', 'ops_event_type', ARRAY[
  'tournament_created', 'tournament_status_changed', 'registration_toggled',
  'player_registered', 'player_checked_in', 'player_rebuy', 'player_addon',
  'player_busted', 'player_reentered', 'player_moved', 'seat_freed',
  'table_added', 'table_closed', 'table_redraw', 'prize_assigned',
  'level_play', 'level_pause', 'level_set', 'prize_structure_set',
  'player_bust_undone', 'prize_corrected',
  'posting_linked', 'posting_unlinked', 'staff_imported', 'staff_added',
  'staff_removed', 'table_staff_assigned', 'table_staff_unassigned',
  -- S1(20260717090000): C6 모니터 구성 + C4 상금 지급 마킹
  'monitor_config_set', 'prize_paid', 'prize_paid_undone'
], 'ops_event_type 31값(기존 28 + S1 신규 3)');

-- ─── (3) RLS enabled+forced (ops_1c_tables_rls.test.sql 관례 — pg_class 직접 조회) ───
SELECT ok(
  (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.ops_staff'::regclass),
  'ops_staff RLS enabled+forced');

-- ─── (4) 배정 백스톱 partial UNIQUE 실동작 검증(구조뿐 아니라 실제 강제력) ───
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM ops_test_seed();
  PERFORM set_config('ops.owner_id',      s.owner_id::text,      true);
  PERFORM set_config('ops.member_id',     s.member_id::text,     true);
  PERFORM set_config('ops.outsider_id',   s.outsider_id::text,   true);
  PERFORM set_config('ops.tournament_id', s.tournament_id::text, true);
  PERFORM set_config('ops.table_id',      s.table_id::text,      true);

  -- postgres 역할로 직접 배정(ops_tables DML 은 authenticated REVOKE 대상) — 시드 테이블에 outsider 배정.
  PERFORM set_config('role', 'postgres', true);
  UPDATE public.ops_tables SET assigned_staff_id = s.outsider_id
    WHERE id = s.table_id;

  -- ops_staff 시드 1행(postgres 직접 INSERT — 쓰기는 SECDEF RPC 전용이라 authenticated 는 불가)
  INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source)
  VALUES (s.tournament_id, s.outsider_id, 'dealer', 'Seed Dealer', 'manual');
END $$;

SELECT throws_ok(
  $$ INSERT INTO public.ops_tables (tournament_id, table_no, assigned_staff_id)
     VALUES ((current_setting('ops.tournament_id'))::uuid, 99, (current_setting('ops.outsider_id'))::uuid) $$,
  '23505', NULL,
  '배정 백스톱: 동일 대회 내 동일 staff 중복 테이블 배정 INSERT 거부(partial UNIQUE)');

-- ─── (5) RLS SELECT: owner/workspace멤버 보임, outsider/anon 0행 ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  1, 'owner sees ops_staff row');

SELECT ops_test_set_user((current_setting('ops.member_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  1, 'workspace member sees ops_staff row');

SELECT ops_test_set_user((current_setting('ops.outsider_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  0, 'outsider sees no ops_staff row');

-- anon: 실패(예외) 또는 0행 — 둘 다 흡수해 0으로 정규화 후 단일 단언
DO $$
DECLARE v_count int;
BEGIN
  PERFORM set_config('role', 'anon', true);
  SELECT count(*) INTO v_count FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid;
  PERFORM set_config('ops.anon_count', v_count::text, true);
EXCEPTION WHEN insufficient_privilege THEN
  PERFORM set_config('ops.anon_count', '0', true);
END $$;
SELECT is(current_setting('ops.anon_count')::int, 0, 'anon SELECT 실패 또는 0행');

-- ─── (6) authenticated 직접 DML 거부 ───
SELECT ops_test_set_user((current_setting('ops.owner_id'))::uuid);
SELECT throws_ok(
  $$ INSERT INTO public.ops_staff (tournament_id, staff_id, role, staff_name, source)
     VALUES ((current_setting('ops.tournament_id'))::uuid, (current_setting('ops.member_id'))::uuid, 'floor', 'Forged Staff', 'manual') $$,
  '42501', NULL, 'authenticated direct INSERT ops_staff rejected (RLS 정책부재+REVOKE)');

DO $$
BEGIN
  UPDATE public.ops_staff SET staff_name = 'Hacked Name'
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
SELECT is(
  (SELECT staff_name FROM public.ops_staff WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  'Seed Dealer', 'authenticated cannot mutate ops_staff (staff_name unchanged)');

DO $$
BEGIN
  DELETE FROM public.ops_staff
    WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid;
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
SELECT is(
  (SELECT count(*)::int FROM public.ops_staff WHERE tournament_id = (current_setting('ops.tournament_id'))::uuid),
  1, 'authenticated cannot DELETE ops_staff (row preserved)');

SELECT * FROM finish();
ROLLBACK;
