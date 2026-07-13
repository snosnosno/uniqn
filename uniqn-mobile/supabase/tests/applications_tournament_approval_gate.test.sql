-- uniqn-mobile/supabase/tests/applications_tournament_approval_gate.test.sql
-- 미승인 대회 공고 조기지원 직접 INSERT 차단 — 방어심화 (2026-07-12)
--
-- 계약 (마이그 20260712010000, 트리거 applications_tournament_approval_gate):
--   posting_type='tournament' 이면 tournament_config->>'approvalStatus'='approved'
--   일 때만 지원 INSERT 허용. approvalStatus/config 부재(NULL)도 차단(fail-closed)
--   — 앱 isTournamentApprovalBlocked SSOT 와 동일. 비-tournament 는 항상 통과.
--   RLS(app_insert)는 applicant_id=자기 자신만 검사하므로 이 게이트가 없으면
--   스태프가 자기 JWT 의 PostgREST 직접 INSERT 로 미승인 대회에 조기 지원 가능.

BEGIN;
SELECT plan(4);

DO $$
DECLARE
  s RECORD;
  v_tourn_pending  uuid := gen_random_uuid();
  v_tourn_approved uuid := gen_random_uuid();
  v_tourn_noconfig uuid := gen_random_uuid();
  v_jp2 uuid;
  v_work_date date := current_date + 20;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('t.staff_id', s.outsider_id::text, true);

  -- 대회 공고 3종 (postgres 시드 — RLS/게이트 무관)
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, tournament_config, created_at, updated_at
  )
  VALUES
    (v_tourn_pending, s.owner_id, 'jpc owner', s.workspace_id, '대회-미승인', 'active', 'tournament',
     v_work_date::text, ARRAY[v_work_date::text], 5, 0, 0, 3, '+82103333331',
     '{"approvalStatus":"pending"}'::jsonb, now(), now()),
    (v_tourn_approved, s.owner_id, 'jpc owner', s.workspace_id, '대회-승인', 'active', 'tournament',
     v_work_date::text, ARRAY[v_work_date::text], 5, 0, 0, 3, '+82103333332',
     '{"approvalStatus":"approved"}'::jsonb, now(), now()),
    (v_tourn_noconfig, s.owner_id, 'jpc owner', s.workspace_id, '대회-config없음', 'active', 'tournament',
     v_work_date::text, ARRAY[v_work_date::text], 5, 0, 0, 3, '+82103333333',
     NULL, now(), now());

  PERFORM set_config('t.jp_pending',  v_tourn_pending::text,  true);
  PERFORM set_config('t.jp_approved', v_tourn_approved::text, true);
  PERFORM set_config('t.jp_noconfig', v_tourn_noconfig::text, true);

  -- 일반 공고 (기존 경로 무회귀용 — seed 의 jp 에는 이미 지원돼 있어 별도 생성)
  v_jp2 := jpc_seed_extra_jp(s.workspace_id, s.owner_id);
  PERFORM set_config('t.jp_regular', v_jp2::text, true);
END $$;

-- ============================================================================
-- 스태프 자기 JWT 직접 INSERT (RLS app_insert 는 통과하는 조건)
-- ============================================================================

SELECT jpc_test_set_user((current_setting('t.staff_id'))::uuid);

-- 미승인 대회 → DENY 42501
SELECT throws_ok(
  format(
    $q$INSERT INTO public.applications
         (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), %L, %L, 'gate test', 'applied', now(), now())$q$,
    current_setting('t.jp_pending'), current_setting('t.staff_id')
  ),
  '42501', NULL,
  'applications INSERT: 미승인 대회(approvalStatus=pending) DENY'
);

-- config 부재 대회 → DENY 42501 (fail-closed)
SELECT throws_ok(
  format(
    $q$INSERT INTO public.applications
         (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), %L, %L, 'gate test', 'applied', now(), now())$q$,
    current_setting('t.jp_noconfig'), current_setting('t.staff_id')
  ),
  '42501', NULL,
  'applications INSERT: tournament_config 부재 DENY (fail-closed)'
);

-- 승인된 대회 → ALLOW
SELECT lives_ok(
  format(
    $q$INSERT INTO public.applications
         (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), %L, %L, 'gate test', 'applied', now(), now())$q$,
    current_setting('t.jp_approved'), current_setting('t.staff_id')
  ),
  'applications INSERT: 승인된 대회(approvalStatus=approved) ALLOW'
);

-- 일반 공고 → ALLOW (기존 지원 경로 무회귀)
SELECT lives_ok(
  format(
    $q$INSERT INTO public.applications
         (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), %L, %L, 'gate test', 'applied', now(), now())$q$,
    current_setting('t.jp_regular'), current_setting('t.staff_id')
  ),
  'applications INSERT: 일반(regular) 공고 ALLOW (무회귀)'
);

SELECT * FROM finish();
ROLLBACK;
