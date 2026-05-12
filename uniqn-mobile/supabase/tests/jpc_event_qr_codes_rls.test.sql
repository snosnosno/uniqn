-- uniqn-mobile/supabase/tests/jpc_event_qr_codes_rls.test.sql
-- JPC 후속 PR — Task 2.5: event_qr_codes RLS 매트릭스 (16 케이스)
--
-- 정책 분석 (plan 미독, 실제 정책 기준 매트릭스):
--   SELECT  : qr_select USING (user_id=self OR jp.owner=self
--             OR is_workspace_member OR is_posting_collaborator)
--             → 4/4 ALLOW
--   INSERT  : event_qr_codes_insert_authenticated WITH CHECK
--             (auth.uid() IS NOT NULL) → 4/4 ALLOW (어떤 user_id 든)
--   UPDATE  : qr_update USING (user_id=self OR is_workspace_member
--             OR is_posting_collaborator) → 4/4 ALLOW
--             (owner 는 workspace.owner → is_workspace_member 통과)
--   DELETE  : qr_delete USING (user_id=self OR is_workspace_member
--             OR is_posting_collaborator) → 4/4 ALLOW
--
-- 주의: event_qr_codes 정책이 매우 느슨. PR description 에 후속 tightening
-- 후보로 명시 (예: INSERT 시 user_id 검증, workspace_member 분기 좁히기).
-- DELETE 4 케이스는 SAVEPOINT 로 격리 (같은 row 1건이므로).

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
  PERFORM set_config('jpc.qr_id',       s.qr_code_id::text,      true);
END $$;

-- ============================================================================
-- SELECT (4 케이스) — 모두 ALLOW
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.event_qr_codes
    WHERE id = (current_setting('jpc.qr_id'))::uuid),
  1, 'event_qr_codes SELECT: owner (jp.owner_id=self)'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.event_qr_codes
    WHERE id = (current_setting('jpc.qr_id'))::uuid),
  1, 'event_qr_codes SELECT: ws_editor (is_workspace_member)'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.event_qr_codes
    WHERE id = (current_setting('jpc.qr_id'))::uuid),
  1, 'event_qr_codes SELECT: collaborator (is_posting_collaborator)'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.event_qr_codes
    WHERE id = (current_setting('jpc.qr_id'))::uuid),
  1, 'event_qr_codes SELECT: user_id 본인 (user_id=self)'
);

-- ============================================================================
-- INSERT (4 케이스) — 모두 ALLOW
-- event_qr_codes_insert_authenticated 가 매우 느슨 (auth.uid() IS NOT NULL).
-- UNIQUE 제약 없으므로 4건 INSERT 누적 OK.
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT lives_ok(
  format(
    $q$INSERT INTO public.event_qr_codes
         (job_posting_id, user_id, type, code, work_date, is_active)
       VALUES (%L, %L, 'checkIn', encode(gen_random_bytes(16),'hex'),
               (current_date + 7)::text, true)$q$,
    current_setting('jpc.jp_id'),
    current_setting('jpc.outsider_id')
  ),
  'event_qr_codes INSERT: owner (auth.uid() IS NOT NULL) ALLOW'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT lives_ok(
  format(
    $q$INSERT INTO public.event_qr_codes
         (job_posting_id, user_id, type, code, work_date, is_active)
       VALUES (%L, %L, 'checkIn', encode(gen_random_bytes(16),'hex'),
               (current_date + 8)::text, true)$q$,
    current_setting('jpc.jp_id'),
    current_setting('jpc.outsider_id')
  ),
  'event_qr_codes INSERT: ws_editor ALLOW'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT lives_ok(
  format(
    $q$INSERT INTO public.event_qr_codes
         (job_posting_id, user_id, type, code, work_date, is_active)
       VALUES (%L, %L, 'checkIn', encode(gen_random_bytes(16),'hex'),
               (current_date + 9)::text, true)$q$,
    current_setting('jpc.jp_id'),
    current_setting('jpc.outsider_id')
  ),
  'event_qr_codes INSERT: collaborator ALLOW'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT lives_ok(
  format(
    $q$INSERT INTO public.event_qr_codes
         (job_posting_id, user_id, type, code, work_date, is_active)
       VALUES (%L, %L, 'checkIn', encode(gen_random_bytes(16),'hex'),
               (current_date + 10)::text, true)$q$,
    current_setting('jpc.jp_id'),
    current_setting('jpc.outsider_id')
  ),
  'event_qr_codes INSERT: outsider 본인 ALLOW'
);

-- ============================================================================
-- UPDATE (4 케이스) — 모두 ALLOW (is_active 컬럼 변경)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (
  UPDATE public.event_qr_codes SET is_active = false
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'event_qr_codes UPDATE: owner (is_workspace_member via ws.owner_id)');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (
  UPDATE public.event_qr_codes SET is_active = true
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'event_qr_codes UPDATE: ws_editor (is_workspace_member)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (
  UPDATE public.event_qr_codes SET is_active = false
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'event_qr_codes UPDATE: collaborator (is_posting_collaborator)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (
  UPDATE public.event_qr_codes SET is_active = true
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'event_qr_codes UPDATE: user_id 본인 (user_id=self)');

-- ============================================================================
-- DELETE (4 케이스) — 모두 ALLOW
-- 같은 row 4번 시도 → SAVEPOINT 격리 (각 케이스 후 ROLLBACK TO)
-- ============================================================================

SAVEPOINT sp_delete_owner;
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: owner ALLOW (is_workspace_member via ws.owner_id)');
ROLLBACK TO SAVEPOINT sp_delete_owner;

SAVEPOINT sp_delete_editor;
SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: ws_editor ALLOW (is_workspace_member)');
ROLLBACK TO SAVEPOINT sp_delete_editor;

SAVEPOINT sp_delete_collab;
SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: collaborator ALLOW (is_posting_collaborator)');
ROLLBACK TO SAVEPOINT sp_delete_collab;

SAVEPOINT sp_delete_outsider;
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: outsider 본인 ALLOW (user_id=self)');
ROLLBACK TO SAVEPOINT sp_delete_outsider;

SELECT * FROM finish();
ROLLBACK;
