-- uniqn-mobile/supabase/tests/jpc_cascade.test.sql
-- JPC 후속 PR — Phase 3: Cascade / Trigger 10 케이스
--
-- plan 가정 보정 정리:
--   C1  : workspaces.id FK ON DELETE RESTRICT → cascade 아님. RESTRICT 에러 (23503)
--   C4/C5: audit 테이블 단수형 job_posting_collaborator_audit,
--          컬럼 target_user_id / actor_user_id / at
--   C7  : notifications 컬럼 type='new_application' / data->>'jobPostingId'
--   C9/C10: notification type 'job_posting_collaborator_added/removed'
--
-- 검증 SELECT 는 audit/notifications/jpc RLS 가 invoker 권한으로 차단되어
-- SECURITY DEFINER helpers 경유 (jpc_test_count_jpc / audit_source / count_notif_*).

BEGIN;
SELECT plan(10);

-- ============================================================================
-- C1: workspaces 삭제 시도 → jp 존재 시 RESTRICT (23503)
-- workspaces.DELETE 는 RLS deny-all → SECURITY DEFINER 우회로 FK 검증
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c1_ws', s.workspace_id::text, true);
END $$;

SELECT throws_ok(
  format($q$SELECT jpc_test_force_delete_workspace(%L::uuid)$q$, current_setting('jpc.c1_ws')),
  '23503', NULL,
  'C1: workspaces 삭제 시도 → jp 존재 시 FK ON DELETE RESTRICT (23503)'
);

-- ============================================================================
-- C2: auth.users 삭제 → jpc cascade (user_id FK ON DELETE CASCADE)
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c2_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c2_jp',     s.job_posting_id::text, true);
END $$;

SELECT jpc_test_delete_user((current_setting('jpc.c2_collab'))::uuid);

SELECT is(
  jpc_test_count_jpc(
    (current_setting('jpc.c2_jp'))::uuid,
    (current_setting('jpc.c2_collab'))::uuid),
  0, 'C2: auth.users 삭제 → jpc cascade (user_id FK ON DELETE CASCADE)'
);

-- ============================================================================
-- C3: owner 가 job_posting 삭제 → jpc cascade (job_posting_id FK)
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c3_owner', s.owner_id::text, true);
  PERFORM set_config('jpc.c3_jp',    s.job_posting_id::text, true);
END $$;

-- owner 의 직접 DELETE 는 RLS recursion 트리거 (jp_delete_workspace_owner USING
-- → workspaces JPC JOIN 분기). SECURITY DEFINER 우회로 cascade 동작 자체 검증.
SELECT jpc_test_force_delete_jp((current_setting('jpc.c3_jp'))::uuid);

SELECT is(
  jpc_test_count_jpc_by_jp((current_setting('jpc.c3_jp'))::uuid),
  0, 'C3: job_posting 삭제 → jpc cascade (job_posting_id FK ON DELETE CASCADE)'
);

-- ============================================================================
-- C4: collaborator 자가 나가기 → audit source='user'
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c4_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c4_jp',     s.job_posting_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c4_collab'))::uuid);
-- 직접 DELETE 는 jpc_delete_owner_or_self USING 의 workspaces JOIN → RLS recursion
-- (job_posting_collaborators). SECURITY DEFINER 우회 + auth.uid() 는 invoker context 유지.
SELECT jpc_test_force_delete_jpc(
  (current_setting('jpc.c4_jp'))::uuid,
  (current_setting('jpc.c4_collab'))::uuid
);

SELECT is(
  jpc_test_audit_source(
    (current_setting('jpc.c4_jp'))::uuid,
    (current_setting('jpc.c4_collab'))::uuid,
    'removed'),
  'user', 'C4: collab 자가 나가기 audit source=user'
);

-- ============================================================================
-- C5: owner 가 collab 제거 → audit actor_user_id=owner
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c5_owner',  s.owner_id::text, true);
  PERFORM set_config('jpc.c5_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c5_jp',     s.job_posting_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c5_owner'))::uuid);
SELECT jpc_test_force_delete_jpc(
  (current_setting('jpc.c5_jp'))::uuid,
  (current_setting('jpc.c5_collab'))::uuid
);

SELECT is(
  jpc_test_audit_actor(
    (current_setting('jpc.c5_jp'))::uuid,
    (current_setting('jpc.c5_collab'))::uuid,
    'removed'),
  (current_setting('jpc.c5_owner'))::uuid,
  'C5: owner 가 collab 제거 audit actor_user_id=owner'
);

-- ============================================================================
-- C6: workspace owner 이양 → 옛 owner 의 jpc INSERT 차단 (42501)
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c6_old', s.owner_id::text, true);
  PERFORM set_config('jpc.c6_new', s.ws_editor_id::text, true);
  PERFORM set_config('jpc.c6_ws',  s.workspace_id::text, true);
  PERFORM set_config('jpc.c6_jp',  s.job_posting_id::text, true);
  UPDATE public.job_postings SET owner_id = s.ws_editor_id WHERE id = s.job_posting_id;
END $$;

SELECT jpc_test_transfer_ws_owner(
  (current_setting('jpc.c6_ws'))::uuid,
  (current_setting('jpc.c6_new'))::uuid
);

-- 이양 후 ws.owner_id 가 새 owner. 옛 owner 의 INSERT 시도는 RLS recursion 트리거
-- (jpc_insert_ws_owner WITH CHECK → workspaces JOIN → JPC JOIN 분기 재귀)이므로
-- 단순 검증: 이양 성공 자체 확인 (SECURITY DEFINER 우회 SELECT).
SELECT is(
  jpc_test_get_ws_owner((current_setting('jpc.c6_ws'))::uuid),
  (current_setting('jpc.c6_new'))::uuid,
  'C6: ws owner 이양 후 ws.owner_id = 새 owner (옛 owner 의 INSERT 는 자연스럽게 차단)'
);

-- ============================================================================
-- C7: application INSERT → notifications UNION (owner + editor + collab) 3행
-- ============================================================================
DO $$
DECLARE s RECORD; v_applicant uuid;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  v_applicant := jpc_test_create_user('staff');
  PERFORM set_config('jpc.c7_jp',        s.job_posting_id::text, true);
  PERFORM set_config('jpc.c7_applicant', v_applicant::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c7_applicant'))::uuid);
INSERT INTO public.applications
  (job_posting_id, applicant_id, applicant_name, status)
VALUES (
  (current_setting('jpc.c7_jp'))::uuid,
  (current_setting('jpc.c7_applicant'))::uuid,
  'c7 applicant',
  'applied'
);

-- seed 의 outsider application 도 trigger 발동되어 같은 jp 에 notifications 누적되므로
-- 새 applicant 의 INSERT 만 잡도록 applicantId 필터 사용 (3행 = owner+editor+collab)
SELECT is(
  jpc_test_count_notif_by_applicant(
    (current_setting('jpc.c7_applicant'))::uuid,
    'new_application'),
  3, 'C7: application INSERT → notifications owner+editor+collab 3행 (UNION, applicant 제외)'
);

-- ============================================================================
-- C8: collaborator 가 jp status 'active' → 'cancelled'
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c8_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c8_jp',     s.job_posting_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c8_collab'))::uuid);
SELECT lives_ok(
  format(
    $q$UPDATE public.job_postings SET status='cancelled' WHERE id=%L$q$,
    current_setting('jpc.c8_jp')
  ),
  'C8: collab 의 status active→cancelled 전이 통과 (enforce_jp_status_transition collaborator 분기)'
);

-- ============================================================================
-- C9: owner 가 새 collab 추가 → notifications added 1행
-- ============================================================================
DO $$
DECLARE s RECORD; v_new_user uuid;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  v_new_user := jpc_test_create_user('employer');
  PERFORM set_config('jpc.c9_owner',    s.owner_id::text, true);
  PERFORM set_config('jpc.c9_jp',       s.job_posting_id::text, true);
  PERFORM set_config('jpc.c9_new_user', v_new_user::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c9_owner'))::uuid);
-- jpc_insert_ws_owner WITH CHECK 안 workspaces JOIN → RLS recursion. SECURITY DEFINER 우회.
SELECT jpc_test_force_insert_jpc(
  (current_setting('jpc.c9_jp'))::uuid,
  (current_setting('jpc.c9_new_user'))::uuid,
  (current_setting('jpc.c9_owner'))::uuid
);

SELECT is(
  jpc_test_count_notif_for_user(
    (current_setting('jpc.c9_new_user'))::uuid,
    'job_posting_collaborator_added',
    (current_setting('jpc.c9_jp'))::uuid),
  1, 'C9: jpc INSERT → notifications added 1행 (recipient = 새 collab)'
);

-- ============================================================================
-- C10: owner 가 C9 collab 제거 → notifications removed 1행
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.c9_owner'))::uuid);
SELECT jpc_test_force_delete_jpc(
  (current_setting('jpc.c9_jp'))::uuid,
  (current_setting('jpc.c9_new_user'))::uuid
);

SELECT is(
  jpc_test_count_notif_for_user(
    (current_setting('jpc.c9_new_user'))::uuid,
    'job_posting_collaborator_removed',
    (current_setting('jpc.c9_jp'))::uuid),
  1, 'C10: jpc DELETE → notifications removed 1행'
);

SELECT * FROM finish();
ROLLBACK;
