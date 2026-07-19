-- uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql
-- job_postings RLS 매트릭스 (4 페르소나 × 4 작업 = 16 케이스)
--
-- 정책 분석 (pg_policies 직접 조회):
--   SELECT: job_postings_select_all (USING true) → 모든 인증 사용자 ALLOW
--           추가 jp_select / jp_select_managed 정책도 OR 결합되어 효과 동일
--   INSERT: prod 실측(2026-07-12, baseline 파리티) — 정책 2개 결합:
--           · jp_insert (PERMISSIVE, WITH CHECK get_my_role() = ANY('{admin,employer}'))
--             = 앱-역할 게이트. get_my_role() = auth.jwt()->'app_metadata'->>'role'.
--           · jp_container_no_direct_insert (RESTRICTIVE, status <> 'container')
--           ⇒ employer/admin + 비컨테이너만 ALLOW. 구세대 '의도적 느슨
--           (auth.uid() IS NOT NULL)' 정책은 로컬 전용 잔상이며 prod엔 부재.
--   UPDATE: owner_or_admin OR ws_member OR is_posting_collaborator → owner/editor/collab ALLOW, outsider DENY
--   DELETE: owner_or_admin OR ws.owner → seed 의 owner 만 ALLOW (jp.owner=v_owner=ws.owner)
--
-- plan 가정 보정 사항 (file 도입부):
--   · SELECT outsider: plan=DENY(0) → 실제=ALLOW(1)
--   · INSERT: employer 3(owner/editor/collaborator) ALLOW / staff outsider 1 DENY(42501)
--   · UPDATE/DELETE: plan 가정 정확

BEGIN;
SELECT plan(16);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('jpc.jp_id',       s.job_posting_id::text, true);
  PERFORM set_config('jpc.ws_id',       s.workspace_id::text, true);
END $$;

-- ============================================================================
-- SELECT (4 케이스) — job_postings_select_all USING true 로 모든 인증 ALLOW
-- 정책 의도: 공개 공고 목록 누구나 조회 가능 (status 필터 등은 jp_select 가 OR 결합)
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
  1, 'job_postings SELECT: owner sees 1'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
  1, 'job_postings SELECT: ws_editor sees 1'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
  1, 'job_postings SELECT: collaborator sees 1'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
  1, 'job_postings SELECT: outsider sees 1 (USING true)'
);

-- ============================================================================
-- INSERT (4 케이스) — prod 실측(2026-07-19, PR#267 하드닝 반영):
--   PERMISSIVE jp_insert WITH CHECK:
--     get_my_role() = ANY('{admin,employer}')            ← 앱-역할 게이트
--     AND (owner_id = auth.uid() OR get_my_role()='admin') ← PR#267 [M-1] owner 바인딩
--   RESTRICTIVE jp_container_no_direct_insert: status <> 'container' (active라 항상 통과)
-- get_my_role() = auth.jwt()->'app_metadata'->>'role' (plural claims 만 읽음).
-- auth.uid() 는 singular GUC(request.jwt.claim.sub)를 먼저 읽고 plural 은 fallback.
--   ⇒ 두 GUC 를 함께 갱신하는 jpc_test_set_user_with_role() 경유 필수.
--     plural 만 인라인 주입하면 직전 케이스가 남긴 singular 가 살아남아 auth.uid() 가
--     outsider 를 반환 → 역할 게이트는 통과하는데 owner 바인딩만 깨져 42501.
--     (실증: 07-17~19 master db-tests red 3건의 원인. prod 결함 아님)
-- 페르소나 앱-역할(픽스처 jpc_test_seed): owner/editor/collaborator=employer, outsider=staff.
--   ⇒ employer 3 ALLOW / staff outsider 1 DENY(42501).
-- ============================================================================

-- owner (employer) → ALLOW
SELECT jpc_test_set_user_with_role((current_setting('jpc.owner_id'))::uuid, 'employer');
SELECT lives_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.owner_id'))::uuid, 'o', (current_setting('jpc.ws_id'))::uuid, 'p1', 'active', 'regular',
            (current_date+1)::text, ARRAY[(current_date+1)::text], 1, 0, 0, 3, '+82101234567')$$,
  'job_postings INSERT: owner (employer 역할 게이트 통과)'
);

-- ws_editor (employer) → ALLOW
SELECT jpc_test_set_user_with_role((current_setting('jpc.editor_id'))::uuid, 'employer');
SELECT lives_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.editor_id'))::uuid, 'e', (current_setting('jpc.ws_id'))::uuid, 'p2', 'active', 'regular',
            (current_date+1)::text, ARRAY[(current_date+1)::text], 1, 0, 0, 3, '+82101234567')$$,
  'job_postings INSERT: ws_editor (employer 역할 게이트 통과)'
);

-- collaborator (employer) → ALLOW. 페르소나명은 공고 관계일 뿐, 앱-역할은 employer라
-- 순수 역할 게이트를 통과한다(구세대 계약처럼 workspace 관계를 보지 않음).
SELECT jpc_test_set_user_with_role((current_setting('jpc.collab_id'))::uuid, 'employer');
SELECT lives_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.collab_id'))::uuid, 'c', (current_setting('jpc.ws_id'))::uuid, 'p3', 'active', 'regular',
            (current_date+1)::text, ARRAY[(current_date+1)::text], 1, 0, 0, 3, '+82101234567')$$,
  'job_postings INSERT: collaborator (employer-tier 역할 게이트 통과)'
);

-- outsider (staff) → DENY 42501. get_my_role()=staff 라 jp_insert 역할 게이트 실패.
SELECT jpc_test_set_user_with_role((current_setting('jpc.outsider_id'))::uuid, 'staff');
SELECT throws_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.outsider_id'))::uuid, 'x', (current_setting('jpc.ws_id'))::uuid, 'p4', 'active', 'regular',
            (current_date+1)::text, ARRAY[(current_date+1)::text], 1, 0, 0, 3, '+82101234567')$$,
  '42501', NULL,
  'job_postings INSERT: outsider 차단 (staff 역할, prod 역할 게이트 실패)'
);

-- ============================================================================
-- UPDATE (4 케이스) — owner_or_admin OR ws_member OR is_posting_collaborator
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-owner' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'job_postings UPDATE: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-editor' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'job_postings UPDATE: ws_editor (workspace member)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-collab' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'job_postings UPDATE: collaborator (is_posting_collaborator)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-outsider' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 0, 'job_postings UPDATE: outsider denied');

-- ============================================================================
-- DELETE (4 케이스) — C2 fix 후 cycle 해소 (PR #91, 20260515100000) 로 invoker
-- 직접 DELETE 검증 가능 (editor/collab/outsider 3 case = RLS 차단으로 0 rows).
-- 정책: job_postings_delete_owner_or_admin OR jp_delete_workspace_owner
--      = (jp.owner = self) OR (ws.owner = self) OR is_admin
-- seed: jp.owner = ws.owner = v_owner → owner 만 ALLOW
--
-- owner case 는 jpc_test_seed 의 applications/work_logs/event_qr_codes
-- (FK ON DELETE NO ACTION) 로 인해 invoker 직접 DELETE 시 23503 발생.
-- jpc_check_can_delete_jp 로 정책 동등 평가 유지 (cascade utility).
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (DELETE FROM public.job_postings WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'job_postings DELETE: ws_editor denied (ws.owner 아님)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (DELETE FROM public.job_postings WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'job_postings DELETE: collaborator denied (D2: 풀 관리권만)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (DELETE FROM public.job_postings WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'job_postings DELETE: outsider denied');

SELECT is(
  public.jpc_check_can_delete_jp((current_setting('jpc.owner_id'))::uuid, (current_setting('jpc.jp_id'))::uuid),
  true, 'job_postings DELETE: owner (jp.owner + ws.owner; FK cascade utility 로 SECDEF 유지)'
);

SELECT * FROM finish();
ROLLBACK;
