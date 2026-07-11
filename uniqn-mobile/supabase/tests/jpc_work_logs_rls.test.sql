-- uniqn-mobile/supabase/tests/jpc_work_logs_rls.test.sql
-- JPC 후속 PR — Task 2.4: work_logs RLS 매트릭스 (16 케이스)
--
-- 정책 (prod 실측 2026-07-12, baseline 파리티):
--   SELECT  : wl_select USING (staff=self OR owner=self OR jp.id IN
--             (jp WHERE is_workspace_member OR is_posting_collaborator))
--             → 4/4 ALLOW
--   INSERT  : 정책 부재 = deny-all → 4/4 DENY(42501). 쓰기는 SECDEF RPC 전용(prod 계약).
--             (구세대 work_logs_insert_owner_or_admin 은 prod 부재 — 로컬 전용 잔상.)
--   UPDATE  : wl_update USING (owner=self OR jp workspace_member OR posting_collaborator)
--             → owner/editor/collaborator ALLOW, staff outsider DENY. SELECT 와 달리
--             staff 분기 없음(자기행 UPDATE 회수, prod P0#1 2026-07).
--   DELETE  : 정책 부재 = deny-all → 4/4 DENY (0 rows).

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
-- INSERT (4 케이스) — prod 실측(2026-07-12, baseline 파리티): INSERT 정책 부재.
-- work_logs 쓰기는 SECDEF RPC 전용이라 직접 INSERT 는 owner 포함 전 역할 DENY(42501).
-- ============================================================================

-- owner 가 자기 owner_id 로 INSERT → DENY (INSERT 정책 부재)
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
  'work_logs INSERT: owner 차단 (INSERT 정책 부재 — RPC 전용)'
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
-- UPDATE (4 케이스) — owner/editor/collaborator ALLOW, staff outsider DENY(0 rows).
-- wl_update USING 에 staff 분기 없음(prod P0#1 자기행 UPDATE 회수, 2026-07).
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

-- staff 자기행 UPDATE 는 prod 에서 회수됨(P0#1, 2026-07): wl_update USING 에 staff 분기 없음.
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (
  UPDATE public.work_logs SET status = 'checked_in', check_in_ts = now()
   WHERE id = (current_setting('jpc.wl_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 0, 'work_logs UPDATE: staff 본인 차단 (자기행 UPDATE 회수)');

-- ============================================================================
-- DELETE (4 케이스) — 모두 DENY (prod 실측: DELETE 정책 부재 = deny-all, 0 rows).
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
