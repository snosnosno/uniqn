-- uniqn-mobile/supabase/tests/jpc_event_qr_codes_rls.test.sql
-- JPC 후속 PR — Task 2.5: event_qr_codes RLS 매트릭스 (16 케이스)
--
-- ============================================================================
-- ⚠️ 부분 SECURITY GAP INVARIANT — 이 파일은 *현재 정책 계약* 을 잠근다
-- ============================================================================
-- prod 실측(2026-07-12, baseline 파리티): INSERT 갭은 이미 닫혔고(본인 행만 허용),
-- UPDATE/DELETE 의 workspace_member 분기 갭은 아직 남아 있다. 매트릭스는
-- SELECT 4/4 ALLOW · INSERT 3 DENY + 1 ALLOW · UPDATE 4/4 ALLOW · DELETE 4/4 ALLOW.
-- 향후 UPDATE/DELETE tightening 시 일부 케이스가 DENY 로 flip 되어야 하며, 그때까지
-- 본 파일 변경은 regression 으로 오인 가능 — 변경 사유를 PR 에 명시 필수.
--
-- 정책 상세:
--   1. INSERT: `qr_insert` (WITH CHECK auth.uid()=user_id) 단일 정책 — 본인 명의 행만.
--      구세대 `event_qr_codes_insert_authenticated`(auth.uid() IS NOT NULL) 는 prod 부재
--      (로컬 전용 잔상). 실제 QR 발급 경로는 SECDEF RPC. ⇒ 타인 명의 INSERT 는 DENY(42501).
--   2. UPDATE/DELETE: `qr_update/qr_delete` USING (user_id=self OR is_workspace_member
--      OR is_posting_collaborator) — workspace_member 분기가 너무 넓어 ws_editor 가
--      모든 jp 의 QR 을 변경 가능 (의도 불명, 갭 잔존).
--
-- 후속 tightening 후보 (별도 PR):
--   - `qr_update/qr_delete` 의 workspace_member 분기 좁히기 (owner 만 또는 jp.owner_id=self)
--
-- 정책 분석 (prod 실측 기준 매트릭스):
--   SELECT  : qr_select USING (user_id=self OR jp.owner=self
--             OR is_workspace_member OR is_posting_collaborator)
--             → 4/4 ALLOW
--   INSERT  : qr_insert WITH CHECK (auth.uid()=user_id) → 본인 명의만.
--             owner/editor/collaborator 가 타인(outsider) 명의 삽입 → 3 DENY(42501),
--             outsider 본인 명의 → 1 ALLOW.
--   UPDATE  : qr_update — 4/4 ALLOW ← SECURITY GAP(잔존). tightening 시 일부 케이스 flip.
--   DELETE  : qr_delete — 4/4 ALLOW ← SECURITY GAP(잔존). tightening 시 일부 케이스 flip.
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
-- INSERT (4 케이스) — prod 실측(2026-07-12, baseline 파리티):
--   qr_insert WITH CHECK (auth.uid()=user_id) — 본인 명의 행만 허용.
-- owner/editor/collaborator 는 outsider 명의로 삽입 시도 → DENY(42501),
-- outsider 는 본인(user_id=self) 명의 → ALLOW. (실제 발급 경로는 SECDEF RPC)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.event_qr_codes
         (job_posting_id, user_id, type, code, work_date, is_active)
       VALUES (%L, %L, 'checkIn', encode(gen_random_bytes(16),'hex'),
               (current_date + 7)::text, true)$q$,
    current_setting('jpc.jp_id'),
    current_setting('jpc.outsider_id')
  ),
  '42501', NULL,
  'event_qr_codes INSERT: owner 타인명의 차단 (user_id!=self, qr_insert)'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.event_qr_codes
         (job_posting_id, user_id, type, code, work_date, is_active)
       VALUES (%L, %L, 'checkIn', encode(gen_random_bytes(16),'hex'),
               (current_date + 8)::text, true)$q$,
    current_setting('jpc.jp_id'),
    current_setting('jpc.outsider_id')
  ),
  '42501', NULL,
  'event_qr_codes INSERT: ws_editor 타인명의 차단 (user_id!=self)'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  format(
    $q$INSERT INTO public.event_qr_codes
         (job_posting_id, user_id, type, code, work_date, is_active)
       VALUES (%L, %L, 'checkIn', encode(gen_random_bytes(16),'hex'),
               (current_date + 9)::text, true)$q$,
    current_setting('jpc.jp_id'),
    current_setting('jpc.outsider_id')
  ),
  '42501', NULL,
  'event_qr_codes INSERT: collaborator 타인명의 차단 (user_id!=self)'
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
  'event_qr_codes INSERT: outsider 본인명의 ALLOW (user_id=self)'
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
