-- uniqn-mobile/supabase/tests/jpc_work_logs_rls.test.sql
-- JPC 후속 PR — Task 2.4: work_logs RLS 매트릭스 (16 케이스)
--
-- 정책 (plan 가정 보정):
--   SELECT  : wl_select USING (staff=self OR owner=self OR jp.id IN
--             (jp WHERE is_workspace_member OR is_posting_collaborator))
--             → 4/4 ALLOW
--   INSERT  : 정책 부재 = deny-all → 4/4 DENY
--             ※ 2026-07-12 prod 파리티: work_logs_insert_owner_or_admin 은
--               레포 전용 잔재였다(prod 실측: work_logs 정책 = wl_select/wl_update
--               2개뿐, 앱의 클라이언트 직접 INSERT 0건 — 생성은 SECDEF RPC 경유).
--               마이그 20260712010100 이 드롭. 이전 "owner ALLOW" 단언은 레포
--               전용 정책을 고정하던 것 — prod 스냅샷 스택에서는 원래 실패했다.
--   UPDATE  : wl_update USING (owner=self OR jp.id IN
--             (jp WHERE is_workspace_member OR is_posting_collaborator))
--             → owner/ws_editor/collaborator ALLOW, staff 본인 DENY
--             ※ 2026-07-10 유저플로우 감사 P0#1: staff_id 자기행 분기 제거.
--               스태프가 자기 정산 입력값(check_in_ts/custom_*)을 직접 PATCH 하던
--               경로였다. QR 출퇴근은 SECURITY DEFINER RPC 라 영향 없음.
--               상세: supabase/tests/wl_update_staff_self_revoke.test.sql
--   DELETE  : 정책 부재 = deny-all → 4/4 DENY (work_logs_delete_admin 도
--             레포 전용 잔재 — 마이그 20260712010100 이 드롭, prod 파리티)

BEGIN;
SELECT plan(16);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,        true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text,    true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,     true);
  PERFORM set_config('jpc.jp_id',       s.job_posting_id::text,  true);
  PERFORM set_config('jpc.app_id',      s.application_id::text,  true);
  PERFORM set_config('jpc.wl_id',       s.work_log_id::text,     true);
END $$;

-- ============================================================================
-- SELECT (4 케이스) — 모두 ALLOW
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.work_logs
    WHERE id = (current_setting('jpc.wl_id'))::uuid),
  1, 'work_logs SELECT: owner (owner_id=self)'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.work_logs
    WHERE id = (current_setting('jpc.wl_id'))::uuid),
  1, 'work_logs SELECT: ws_editor (is_workspace_member)'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.work_logs
    WHERE id = (current_setting('jpc.wl_id'))::uuid),
  1, 'work_logs SELECT: collaborator (is_posting_collaborator)'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.work_logs
    WHERE id = (current_setting('jpc.wl_id'))::uuid),
  1, 'work_logs SELECT: staff 본인 (staff_id=self)'
);

-- ============================================================================
-- INSERT (4 케이스) — 정책 부재 = 4/4 DENY (prod 파리티, 2026-07-12)
-- 생성 경로는 SECURITY DEFINER RPC 전용 — 클라이언트 직접 INSERT 는 owner 도 차단
-- ============================================================================

-- owner 가 자기 owner_id 로 INSERT → DENY (정책 부재)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.work_logs
         (application_id, staff_id, job_posting_id, owner_id, date, status, role)
       VALUES (%L, %L, %L, %L, current_date + 3, 'scheduled', 'staff')$q$,
    current_setting('jpc.app_id'),
    current_setting('jpc.outsider_id'),
    current_setting('jpc.jp_id'),
    current_setting('jpc.owner_id')
  ),
  '42501', NULL,
  'work_logs INSERT: owner 도 차단 (정책 부재 deny-all, prod 파리티)'
);

-- ws_editor 가 owner_id=owner 로 INSERT → DENY (42501)
SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.work_logs
         (application_id, staff_id, job_posting_id, owner_id, date, status, role)
       VALUES (%L, %L, %L, %L, current_date + 4, 'scheduled', 'staff')$q$,
    current_setting('jpc.app_id'),
    current_setting('jpc.outsider_id'),
    current_setting('jpc.jp_id'),
    current_setting('jpc.owner_id')
  ),
  '42501', NULL,
  'work_logs INSERT: ws_editor 차단 (owner_id != self, admin 아님)'
);

-- collaborator 가 owner_id=owner 로 INSERT → DENY (42501)
SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.work_logs
         (application_id, staff_id, job_posting_id, owner_id, date, status, role)
       VALUES (%L, %L, %L, %L, current_date + 5, 'scheduled', 'staff')$q$,
    current_setting('jpc.app_id'),
    current_setting('jpc.outsider_id'),
    current_setting('jpc.jp_id'),
    current_setting('jpc.owner_id')
  ),
  '42501', NULL,
  'work_logs INSERT: collaborator 차단 (owner_id != self, admin 아님)'
);

-- outsider 가 owner_id=owner 로 INSERT → DENY (42501)
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.work_logs
         (application_id, staff_id, job_posting_id, owner_id, date, status, role)
       VALUES (%L, %L, %L, %L, current_date + 6, 'scheduled', 'staff')$q$,
    current_setting('jpc.app_id'),
    current_setting('jpc.outsider_id'),
    current_setting('jpc.jp_id'),
    current_setting('jpc.owner_id')
  ),
  '42501', NULL,
  'work_logs INSERT: staff 본인 차단 (owner_id != self, admin 아님)'
);

-- ============================================================================
-- UPDATE (4 케이스) — 모두 ALLOW (wl_update USING)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (
  UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now()
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1, 'work_logs UPDATE: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (
  UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now()
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1, 'work_logs UPDATE: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (
  UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now()
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1, 'work_logs UPDATE: collaborator');

-- staff 본인은 DENY — 자기 정산 입력값 직접 조작 차단 (감사 P0#1)
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (
  UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now()
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 0, 'work_logs UPDATE: staff 본인 DENY');

-- ============================================================================
-- DELETE (4 케이스) — 모두 DENY (work_logs_delete_admin 만, admin 아님)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH d AS (
  DELETE FROM public.work_logs
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: owner DENY');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (
  DELETE FROM public.work_logs
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: ws_editor DENY');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (
  DELETE FROM public.work_logs
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: collaborator DENY');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (
  DELETE FROM public.work_logs
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: staff 본인 DENY');

SELECT * FROM finish();
ROLLBACK;
