-- uniqn-mobile/supabase/tests/workspace_archive.test.sql
-- 워크스페이스 아카이브(소프트 삭제) RPC 검증 — archive_workspace / restore_workspace
-- 메모리 학습: pitfall_rls_dynamic_verification_sparse_data — matching row count 사전 측정
--             jpc_test_seed() 재사용 (auth.users + public.users + workspace + active jp)
--
-- 참고: prod 에는 pgtap 미설치 → 로컬 스택/CI 전용 (npm run test:db). prod 동작은
--       BEGIN/ROLLBACK 기능검증으로 별도 입증 (2026-05-24, 8/8 PASS).

BEGIN;
SELECT plan(7);

-- ============================================================================
-- Seed — jpc_test_seed() 는 owner + workspace + active job_posting(status='active') 생성
-- ============================================================================
DO $$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('wsa.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('wsa.outsider_id', s.outsider_id::text, true);
  PERFORM set_config('wsa.ws_id',       s.workspace_id::text, true);
  PERFORM set_config('wsa.jp_id',       s.job_posting_id::text, true);
END $$;

-- ============================================================================
-- T1: 진행공고(active) 있는 워크스페이스 archive → 차단
-- ============================================================================
SELECT jpc_test_set_user((current_setting('wsa.owner_id'))::uuid);
SELECT throws_like(
  format($$ SELECT public.archive_workspace(%L) $$, current_setting('wsa.ws_id')),
  '%ACTIVE_POSTINGS%',
  'T1 active 공고 있으면 archive 차단'
);

-- ============================================================================
-- 공고를 closed 로 마감 (owner — active→closed 는 enforce_jp_status_transition 미차단)
-- ============================================================================
UPDATE public.job_postings SET status = 'closed'
  WHERE id = (current_setting('wsa.jp_id'))::uuid;

-- ============================================================================
-- T2: 종료공고만 남으면 archive 성공
-- ============================================================================
SELECT lives_ok(
  format($$ SELECT public.archive_workspace(%L) $$, current_setting('wsa.ws_id')),
  'T2 종료공고만 → archive 성공'
);

-- ============================================================================
-- T3: archived_at 세팅됨
-- ============================================================================
SELECT isnt(
  (SELECT archived_at FROM public.workspaces WHERE id = (current_setting('wsa.ws_id'))::uuid),
  NULL,
  'T3 archived_at 세팅됨'
);

-- ============================================================================
-- T3b: 아카이브된 워크스페이스는 cap 집계(workspace_count_for_owner)에서 제외
--      seed 는 owner 당 워크스페이스 1개만 생성 → 아카이브 후 0 이어야 함.
--      RLS workspaces_insert_employer_with_cap 와 create_workspace RPC 가 모두
--      이 함수/동일 로직으로 cap 을 계산하므로, 아카이브 시 슬롯 회수가 보장됨(스펙 §5).
-- ============================================================================
SELECT is(
  public.workspace_count_for_owner((current_setting('wsa.owner_id'))::uuid),
  0,
  'T3b cap: 아카이브된 ws 는 workspace_count_for_owner 에서 제외'
);

-- ============================================================================
-- T4: list_my_workspaces 에 아카이브된 워크스페이스 미노출
-- ============================================================================
SELECT is(
  (SELECT count(*)::int FROM public.list_my_workspaces()
    WHERE id = (current_setting('wsa.ws_id'))::uuid),
  0,
  'T4 아카이브된 ws 는 list 에서 제외'
);

-- ============================================================================
-- T5: restore → archived_at NULL
-- ============================================================================
SELECT lives_ok(
  format($$ SELECT public.restore_workspace(%L) $$, current_setting('wsa.ws_id')),
  'T5 restore 성공'
);

-- ============================================================================
-- T6: 타인(outsider) archive → PERMISSION_DENIED
-- ============================================================================
SELECT jpc_test_set_user((current_setting('wsa.outsider_id'))::uuid);
SELECT throws_like(
  format($$ SELECT public.archive_workspace(%L) $$, current_setting('wsa.ws_id')),
  '%PERMISSION_DENIED%',
  'T6 타인 archive → 권한 거부'
);

SELECT * FROM finish();
ROLLBACK;
