-- uniqn-mobile/supabase/tests/jpc_event_qr_codes_rls.test.sql
-- JPC 후속 PR — Task 2.5: event_qr_codes RLS 매트릭스 (16 케이스)
--
-- ============================================================================
-- ⚠️ SECURITY GAP INVARIANT — 이 파일은 의도된 정책이 아니라 *현재 갭* 을 잠근다
-- ============================================================================
-- 16/16 ALLOW 는 **정책 갭의 invariant 화** 이며, 향후 tightening 시 일부 케이스가
-- 의도적으로 DENY 로 flip 되어야 한다. 그때까지 본 파일이 변경되면 regression 으로
-- 오인 가능 — 변경 사유를 PR 에 명시 필수.
--
-- 갭 상세:
--   1. INSERT: `event_qr_codes_insert_authenticated` (WITH CHECK auth.uid() IS NOT NULL)
--      + `qr_insert` (WITH CHECK auth.uid()=user_id) 두 permissive 정책이 OR-union
--      → 느슨한 쪽이 이김. ANY authenticated user 가 ANY user_id / ANY job_posting_id 로
--      QR 삽입 가능. **realistic exploit**: outsider 가 owner 의 jp 에 자기 명의 QR 등록.
--   2. UPDATE/DELETE: `qr_update/qr_delete` USING (user_id=self OR is_workspace_member
--      OR is_posting_collaborator) — workspace_member 분기가 너무 넓어 ws_editor 가
--      모든 jp 의 QR 을 변경 가능 (의도 불명).
--
-- 후속 tightening 후보 (별도 PR):
--   - `event_qr_codes_insert_authenticated` 정책 DROP 또는 WITH CHECK 강화 (user_id 검증)
--   - `qr_update/qr_delete` 의 workspace_member 분기 좁히기 (owner 만 또는 jp.owner_id=self)
--
-- 정책 분석 (실제 정책 기준 매트릭스, 갭 invariant):
--   SELECT  : qr_select USING (user_id=self OR jp.owner=self
--             OR is_workspace_member OR is_posting_collaborator)
--             → 4/4 ALLOW
--   INSERT  : OR-union (auth.uid() IS NOT NULL ∪ auth.uid()=user_id) → 4/4 ALLOW
--             ← SECURITY GAP. 후속 tightening 시 outsider 케이스 DENY 로 flip 예상.
--   UPDATE  : qr_update — 4/4 ALLOW ← SECURITY GAP. tightening 시 일부 케이스 flip.
--   DELETE  : qr_delete — 4/4 ALLOW ← SECURITY GAP. tightening 시 일부 케이스 flip.
--
-- DELETE 4 케이스는 SAVEPOINT 로 격리 (같은 row 1건이므로).

BEGIN;
-- plan(16) 복원: DELETE 4 케이스를 4 개 개별 qr_id 시드로 분리하여 SAVEPOINT
-- 패턴 silent drop 회피 (jpc_seed_extra_qr helper 추가, 메모리 권장 옵션 1).
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

  -- DELETE 4 케이스용 추가 qr 시드 (각 페르소나 명의로 1개씩, SAVEPOINT 불필요)
  PERFORM set_config('jpc.qr_id_owner',
    jpc_seed_extra_qr(s.job_posting_id, s.owner_id)::text, true);
  PERFORM set_config('jpc.qr_id_editor',
    jpc_seed_extra_qr(s.job_posting_id, s.ws_editor_id)::text, true);
  PERFORM set_config('jpc.qr_id_collab',
    jpc_seed_extra_qr(s.job_posting_id, s.collaborator_id)::text, true);
  PERFORM set_config('jpc.qr_id_outsider',
    jpc_seed_extra_qr(s.job_posting_id, s.outsider_id)::text, true);
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
-- DELETE (4 케이스) — 4 개 개별 qr_id 시드로 SAVEPOINT 없이 검증
-- ============================================================================
-- 각 페르소나 명의의 qr 를 자기 권한으로 DELETE. 정책 OR 분기 평가:
--   owner    → is_workspace_member (ws.owner=self) ALLOW
--   editor   → is_workspace_member ALLOW
--   collab   → is_posting_collaborator ALLOW
--   outsider → user_id=self ALLOW (qr.user_id = outsider_id)

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id_owner'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: owner ALLOW (is_workspace_member via ws.owner_id)');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id_editor'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: ws_editor ALLOW (is_workspace_member)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id_collab'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: collaborator ALLOW (is_posting_collaborator)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (
  DELETE FROM public.event_qr_codes
   WHERE id = (current_setting('jpc.qr_id_outsider'))::uuid
  RETURNING 1
)
SELECT is((SELECT count(*)::int FROM d), 1,
  'event_qr_codes DELETE: outsider 본인 ALLOW (user_id=self)');

SELECT * FROM finish();
ROLLBACK;
