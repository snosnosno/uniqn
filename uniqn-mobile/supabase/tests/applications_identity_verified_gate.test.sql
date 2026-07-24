-- uniqn-mobile/supabase/tests/applications_identity_verified_gate.test.sql
-- 본인인증 미완료 사용자 직접 INSERT 차단 (2026-07-25)
--
-- 계약 (마이그 20260725020000, RLS app_insert + is_identity_verified):
--   applications INSERT 는 applicant_id 의 public.users.identity_verified=true 일 때만 허용.
--   RLS(app_insert)가 applicant_id=자기 자신만 검사하던 것을 identity 게이트로 강화 —
--   이 게이트가 없으면 미인증 스태프가 자기 JWT 의 PostgREST 직접 INSERT 로 지원 가능.
--   identity_verified=false/NULL 모두 fail-closed 차단. is_identity_verified 는 SECDEF 로
--   users RLS 를 우회해 with_check 안에서의 재귀/anon poison 을 회피한다.

BEGIN;
SELECT plan(2);

DO $$
DECLARE
  s RECORD;
  v_jp uuid;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  -- 일반 active 공고 (outsider 가 아직 지원하지 않은 새 공고)
  v_jp := jpc_seed_extra_jp(s.workspace_id, s.owner_id);
  PERFORM set_config('t.jp', v_jp::text, true);
  PERFORM set_config('t.staff', s.outsider_id::text, true);
END $$;

-- ============================================================================
-- 1) 본인인증 미완료 스태프 → DENY 42501
-- ============================================================================
-- postgres 롤에서 identity_verified=false 로 세팅 (RLS 무관)
UPDATE public.users SET identity_verified = false
WHERE id = (current_setting('t.staff'))::uuid;

SELECT jpc_test_set_user((current_setting('t.staff'))::uuid);

SELECT throws_ok(
  format(
    $q$INSERT INTO public.applications
         (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), %L, %L, 'identity gate test', 'applied', now(), now())$q$,
    current_setting('t.jp'), current_setting('t.staff')
  ),
  '42501', NULL,
  'applications INSERT: 본인인증 미완료(identity_verified=false) DENY 42501'
);

-- ============================================================================
-- 2) 본인인증 완료 스태프 → ALLOW
-- ============================================================================
-- postgres 롤 복귀 후 identity_verified=true 로 세팅
RESET ROLE;
UPDATE public.users SET identity_verified = true
WHERE id = (current_setting('t.staff'))::uuid;

SELECT jpc_test_set_user((current_setting('t.staff'))::uuid);

SELECT lives_ok(
  format(
    $q$INSERT INTO public.applications
         (id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), %L, %L, 'identity gate test', 'applied', now(), now())$q$,
    current_setting('t.jp'), current_setting('t.staff')
  ),
  'applications INSERT: 본인인증 완료(identity_verified=true) ALLOW'
);

SELECT * FROM finish();
ROLLBACK;
