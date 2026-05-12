-- uniqn-mobile/supabase/tests/jpc_workspaces_rls.test.sql
-- workspaces 5 테이블 × 4 페르소나 × 4 작업 매트릭스의 1/5
-- 메모리 학습: pitfall_rls_violation_multi_cause_mapping — multi-cause 가능
--             pitfall_rls_dynamic_verification_sparse_data — matching row count 사전 측정 필수

BEGIN;
SELECT plan(16);

-- ============================================================================
-- Seed (모든 테스트 공통)
-- ============================================================================
DO $$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('jpc.ws_id',       s.workspace_id::text, true);
END $$;

-- ============================================================================
-- SELECT (4 케이스)
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  1, 'workspaces SELECT: owner sees 1 row'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  1, 'workspaces SELECT: ws_editor sees 1 row'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  1, 'workspaces SELECT: collaborator sees 1 row (via JP JOIN)'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  0, 'workspaces SELECT: outsider sees 0 rows'
);

-- ============================================================================
-- INSERT (4 케이스) — production code path = create_workspace SECURITY DEFINER RPC.
-- 직접 INSERT 는 workspaces_insert_employer_with_cap WITH CHECK 의 self-SELECT
-- recursion (메모리: pitfall_rls_with_check_self_select_recursion) 로 prod 에서도
-- 사용 안 됨 (defense-in-depth). 매트릭스는 RPC 호출 결과 검증.
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT lives_ok(
  $rpc$ SELECT public.create_workspace('test owner ws') $rpc$,
  'workspaces INSERT (RPC): owner (employer) can create new ws'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT lives_ok(
  $rpc$ SELECT public.create_workspace('test editor ws') $rpc$,
  'workspaces INSERT (RPC): ws_editor (employer) can create new ws'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT lives_ok(
  $rpc$ SELECT public.create_workspace('test collab ws') $rpc$,
  'workspaces INSERT (RPC): collaborator (employer) can create new ws'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT throws_ok(
  $rpc$ SELECT public.create_workspace('test outsider ws') $rpc$,
  'P0001', 'PERMISSION_DENIED',
  'workspaces INSERT (RPC): outsider (staff) denied with PERMISSION_DENIED'
);

-- ============================================================================
-- UPDATE (4 케이스) — owner 만 자기 ws 수정 가능
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by owner'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 1, 'workspaces UPDATE: owner can update own ws');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by editor'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 0, 'workspaces UPDATE: ws_editor denied (0 affected)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by collab'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 0, 'workspaces UPDATE: collaborator denied (0 affected)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by outsider'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 0, 'workspaces UPDATE: outsider denied (0 affected)');

-- ============================================================================
-- DELETE (4 케이스) — owner 만
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 0, 'workspaces DELETE: ws_editor denied');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 0, 'workspaces DELETE: collaborator denied');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 0, 'workspaces DELETE: outsider denied');

-- workspaces 에 DELETE 정책 없음 (010400 line 37: "DELETE 정책 없음 — Phase 2 deferred")
-- → 모든 페르소나 deny-all. owner 도 0 affected.
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 0, 'workspaces DELETE: owner denied (no DELETE policy)');

SELECT * FROM finish();
ROLLBACK;
