-- 20260520205822_seed_review_collaborator_account.sql
-- E2E 협업자 페르소나용 두 번째 employer 계정 시드 (review-collaborator).
-- 공고별 협업자 공유(PR #88) 테스트: review-employer 공고에 협업자로 추가되는 별도 employer.
--
-- 주의: 20260419131630_seed_app_review_accounts.sql 와 달리 public.users.role 을
-- 직접 UPDATE 하지 않는다. 그 사이 prevent_role_escalation 트리거가 추가되어
-- 비-admin 의 role 변경을 차단하기 때문. 대신 raw_app_meta_data.role='employer' 를
-- 신뢰하고 handle_new_user 트리거가 role=employer + default workspace 를 자동 생성하게 한다.
-- (신규 uid 직접 INSERT 는 app_metadata 를 strip 하지 않으므로 handle_new_user 가 정상 인식.)
--
-- 멱등성: ON CONFLICT DO NOTHING / DO UPDATE (재실행 안전).
--
-- ROLLBACK (수동):
--   DELETE FROM auth.users WHERE id = 'e5555555-5555-4555-a555-555555555555';
--   -- CASCADE로 public.users / workspaces 자동 정리.

-- =========================================================================
-- Part 1: auth.users
-- =========================================================================
-- NULL 가능 토큰 컬럼은 반드시 빈 문자열로 채울 것 (GoTrue NOT NULL 함정).
-- raw_app_meta_data.role 은 handle_new_user 가 public.users.role 결정에 사용 +
-- RLS 정책의 (auth.jwt() -> 'app_metadata' ->> 'role') 참조에 사용됨.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_token_current,
  reauthentication_token,
  phone_change,
  phone_change_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'e5555555-5555-4555-a555-555555555555',
    'authenticated',
    'authenticated',
    'review-collaborator@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"employer"}'::jsonb,
    '{"name":"심사용 협업자"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 2: auth.identities
-- =========================================================================
-- provider_id 는 반드시 user UUID 여야 GoTrue email provider 로그인이 통과.
-- identity_data.sub 도 동일하게 UUID.

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
) VALUES
  (
    gen_random_uuid(),
    'e5555555-5555-4555-a555-555555555555',
    '{"sub":"e5555555-5555-4555-a555-555555555555","email":"review-collaborator@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    'e5555555-5555-4555-a555-555555555555',
    NOW(), NOW(), NOW()
  )
ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING;

-- =========================================================================
-- Part 3: public.users phone 보강
-- =========================================================================
-- role/name 은 handle_new_user 가 이미 설정(employer / 심사용 협업자). phone 만 추가.
-- role 변경이 없으므로 prevent_role_escalation 트리거를 건드리지 않는다.

UPDATE public.users
  SET phone = '+821055550005', updated_at = NOW()
  WHERE id = 'e5555555-5555-4555-a555-555555555555';
