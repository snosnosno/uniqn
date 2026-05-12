-- uniqn-mobile/supabase/tests/jpc_applications_rls.test.sql
-- JPC 후속 PR — Task 2.3: applications RLS 매트릭스 (16 케이스)
--
-- 정책 (plan 가정 보정):
--   SELECT  : app_select USING (applicant_id=self OR jp.owner_id=self
--             OR is_workspace_member(jp.workspace_id,self)
--             OR is_posting_collaborator(jp.id,self)) → owner/editor/collab/outsider 4/4 ALLOW
--   INSERT  : app_insert + applications_insert_applicant WITH CHECK (applicant_id=self)
--             → 본인 명의만 ALLOW, 남의 명의 DENY
--   UPDATE  : app_update USING (SELECT 와 동형) → 4/4 ALLOW (WITH CHECK 없음 — 컬럼 무관)
--   DELETE  : applications_delete_admin (is_admin) + applications_delete_own
--             (applicant_id=self AND status IN ('applied','cancelled'))
--             → owner/editor/collab DENY, outsider (status='applied') ALLOW
--
-- plan 매트릭스 vs 실제 보정: DELETE 4번째 (outsider) DENY → ALLOW 반전 (1 case)

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
  PERFORM set_config('jpc.ws_id',       s.workspace_id::text,    true);
  PERFORM set_config('jpc.jp_id',       s.job_posting_id::text,  true);
  PERFORM set_config('jpc.app_id',      s.application_id::text,  true);
END $$;

-- ============================================================================
-- SELECT (4 케이스) — 모두 ALLOW
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.applications
    WHERE id = (current_setting('jpc.app_id'))::uuid),
  1, 'applications SELECT: owner (jp.owner_id=self)'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.applications
    WHERE id = (current_setting('jpc.app_id'))::uuid),
  1, 'applications SELECT: ws_editor (is_workspace_member)'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.applications
    WHERE id = (current_setting('jpc.app_id'))::uuid),
  1, 'applications SELECT: collaborator (is_posting_collaborator)'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.applications
    WHERE id = (current_setting('jpc.app_id'))::uuid),
  1, 'applications SELECT: applicant 본인 (applicant_id=self)'
);

-- ============================================================================
-- INSERT (4 케이스) — applicant_id=self 만 ALLOW
-- jp2 별도 시드 (UNIQUE(job_posting_id, applicant_id) 회피)
-- 메모리: pitfall_set_config_role_not_role_switch — SECURITY DEFINER 우회
-- ============================================================================

DO $$
DECLARE v_jp2 uuid;
BEGIN
  v_jp2 := jpc_seed_extra_jp(
    (current_setting('jpc.ws_id'))::uuid,
    (current_setting('jpc.owner_id'))::uuid
  );
  PERFORM set_config('jpc.jp2_id', v_jp2::text, true);
END $$;

-- outsider 본인 명의 jp2 에 INSERT → ALLOW
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT lives_ok(
  format(
    $q$INSERT INTO public.applications
         (job_posting_id, applicant_id, applicant_name, status)
       VALUES (%L, %L, 'me', 'applied')$q$,
    current_setting('jpc.jp2_id'),
    current_setting('jpc.outsider_id')
  ),
  'applications INSERT: outsider 본인 명의 (applicant_id=self) ALLOW'
);

-- collaborator 가 outsider 명의로 INSERT → DENY (42501)
SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.applications
         (job_posting_id, applicant_id, applicant_name, status)
       VALUES (%L, %L, 'x', 'applied')$q$,
    current_setting('jpc.jp2_id'),
    current_setting('jpc.outsider_id')
  ),
  '42501', NULL,
  'applications INSERT: collaborator 가 남의 명의로 INSERT 차단'
);

-- ws_editor 가 outsider 명의로 INSERT → DENY (42501)
SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.applications
         (job_posting_id, applicant_id, applicant_name, status)
       VALUES (%L, %L, 'x', 'applied')$q$,
    current_setting('jpc.jp2_id'),
    current_setting('jpc.outsider_id')
  ),
  '42501', NULL,
  'applications INSERT: ws_editor 가 남의 명의로 INSERT 차단'
);

-- owner 가 outsider 명의로 INSERT → DENY (42501)
-- (실제 채용 흐름은 apply RPC + SECURITY DEFINER 경유. 직접 INSERT 는 차단)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.applications
         (job_posting_id, applicant_id, applicant_name, status)
       VALUES (%L, %L, 'x', 'applied')$q$,
    current_setting('jpc.jp2_id'),
    current_setting('jpc.outsider_id')
  ),
  '42501', NULL,
  'applications INSERT: owner 가 남의 명의로 INSERT 차단 (apply RPC 만 가능)'
);

-- ============================================================================
-- UPDATE (4 케이스) — 모두 ALLOW (USING-only, WITH CHECK 없음)
-- status 가 아닌 applicant_name 컬럼 변경 (DELETE 케이스의 status 필터 보호)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (
  UPDATE public.applications
     SET applicant_name = 'updated_by_owner'
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'applications UPDATE: owner (jp.owner_id=self) ALLOW');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (
  UPDATE public.applications
     SET applicant_name = 'updated_by_editor'
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'applications UPDATE: ws_editor (is_workspace_member) ALLOW');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (
  UPDATE public.applications
     SET applicant_name = 'updated_by_collab'
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'applications UPDATE: collaborator (is_posting_collaborator) ALLOW');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (
  UPDATE public.applications
     SET applicant_name = 'updated_by_self'
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM u), 1,
  'applications UPDATE: applicant 본인 (applicant_id=self) ALLOW');

-- ============================================================================
-- DELETE (4 케이스) — plan 가정 보정:
--   owner/editor/collab → DENY (정책 미적용)
--   outsider 본인 (status='applied') → ALLOW (applications_delete_own)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH d AS (
  DELETE FROM public.applications
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 0,
  'applications DELETE: owner DENY (admin/own 정책 미해당)');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (
  DELETE FROM public.applications
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 0,
  'applications DELETE: ws_editor DENY (admin/own 정책 미해당)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (
  DELETE FROM public.applications
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 0,
  'applications DELETE: collaborator DENY (admin/own 정책 미해당)');

-- outsider = applicant 본인 + status='applied' → applications_delete_own ALLOW
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (
  DELETE FROM public.applications
   WHERE id = (current_setting('jpc.app_id'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'applications DELETE: applicant 본인 (status=applied) ALLOW (applications_delete_own)');

SELECT * FROM finish();
ROLLBACK;
