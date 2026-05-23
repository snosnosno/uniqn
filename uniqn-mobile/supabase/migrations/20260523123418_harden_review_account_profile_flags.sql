-- 20260523123418_harden_review_account_profile_flags.sql
-- 심사/E2E 계정 4종(review-staff/employer/admin/collaborator)의 프로필 완료 플래그를 보정.
--
-- 배경:
--   20260419131630_seed_app_review_accounts.sql 와 20260520205822_seed_review_collaborator_account.sql
--   는 public.users 에 id/email/name/role/phone 만 채우고
--   phone_verified / identity_verified / profile_completed 는 설정하지 않는다.
--   세 컬럼의 DB 기본값은 false 이므로, 마이그레이션만으로 생성된 row 는 "미완성 프로필" 이 된다.
--   authRedirect.getAuthenticatedEntryRoute() 의 안전망 게이트
--   (phoneVerified !== true && identityVerified === false) 가 발동해 로그인 직후
--   /(auth)/signup 으로 리다이렉트되고, (app)/(employer) e2e 가 전면 실패한다.
--
--   프로덕션에서는 staff/employer/admin 3계정만 수동 UPDATE(2026-05-07)로 보정되어 있고
--   review-collaborator(2026-05-20 시드)는 false/false/false 로 남아 있다. 또한 이 보정이
--   마이그레이션에 없어 fresh 스택/재시드 시 4계정 전부 미완성으로 회귀하는 잠재 부채가 있다.
--
-- 이 마이그레이션은 그 보정을 멱등하게 코드화한다:
--   - fresh 스택: 4계정 모두 완전한 프로필로 완성.
--   - 프로덕션: 이미 완전한 3계정은 WHERE 가드로 no-op, collaborator 1행만 보정.
--   role 은 건드리지 않으므로 role-escalation 가드와 무관하다.
--
-- ROLLBACK (수동, 필요 시):
--   UPDATE public.users
--     SET phone_verified=false, identity_verified=false, identity_verified_at=NULL,
--         identity_provider=NULL, profile_completed=false
--   WHERE id = 'e5555555-5555-4555-a555-555555555555';

UPDATE public.users
  SET
    phone_verified = true,
    identity_verified = true,
    identity_verified_at = COALESCE(identity_verified_at, NOW()),
    identity_provider = COALESCE(identity_provider, 'portone_inicis'),
    profile_completed = true,
    updated_at = NOW()
  WHERE id IN (
    'a1111111-1111-4111-a111-111111111111', -- review-staff
    'b2222222-2222-4222-b222-222222222222', -- review-employer
    'c3333333-3333-4333-c333-333333333333', -- review-admin
    'e5555555-5555-4555-a555-555555555555'  -- review-collaborator
  )
  -- 이미 완전한 row 는 건드리지 않아 프로덕션 데이터 변형/타임스탬프 덮어쓰기 방지
  AND (
    phone_verified IS DISTINCT FROM true
    OR identity_verified IS DISTINCT FROM true
    OR profile_completed IS DISTINCT FROM true
    OR identity_verified_at IS NULL
    OR identity_provider IS NULL
  );
