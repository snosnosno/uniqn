-- 20260419131630_seed_app_review_accounts.sql
-- 앱 심사용 데모 계정 3종 (staff / employer / admin) 시드.
-- 공고/지원/근무로그 등 시나리오 데이터는 Playwright 자동화로 별도 생성.
--
-- 멱등성: ON CONFLICT DO NOTHING / DO UPDATE (재실행 안전).
--
-- ROLLBACK (수동):
--   DELETE FROM auth.users WHERE id IN (
--     'a1111111-1111-4111-a111-111111111111',
--     'b2222222-2222-4222-b222-222222222222',
--     'c3333333-3333-4333-c333-333333333333'
--   );
--   -- CASCADE로 public.users 자동 정리.

-- =========================================================================
-- Part 1: auth.users (3건)
-- =========================================================================
-- NULL 가능 토큰 컬럼은 반드시 빈 문자열로 채울 것 (GoTrue NOT NULL 함정).
-- raw_app_meta_data.role 은 RLS 정책의 (auth.jwt() -> 'app_metadata' ->> 'role') 참조에 사용됨.

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
    'a1111111-1111-4111-a111-111111111111',
    'authenticated',
    'authenticated',
    'review-staff@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
    '{"name":"심사용 스태프"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b2222222-2222-4222-b222-222222222222',
    'authenticated',
    'authenticated',
    'review-employer@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"employer"}'::jsonb,
    '{"name":"심사용 구인자"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c3333333-3333-4333-c333-333333333333',
    'authenticated',
    'authenticated',
    'review-admin@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    '{"name":"심사용 관리자"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 2: auth.identities (3건)
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
    'a1111111-1111-4111-a111-111111111111',
    '{"sub":"a1111111-1111-4111-a111-111111111111","email":"review-staff@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    'a1111111-1111-4111-a111-111111111111',
    NOW(), NOW(), NOW()
  ),
  (
    gen_random_uuid(),
    'b2222222-2222-4222-b222-222222222222',
    '{"sub":"b2222222-2222-4222-b222-222222222222","email":"review-employer@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    'b2222222-2222-4222-b222-222222222222',
    NOW(), NOW(), NOW()
  ),
  (
    gen_random_uuid(),
    'c3333333-3333-4333-c333-333333333333',
    '{"sub":"c3333333-3333-4333-c333-333333333333","email":"review-admin@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    'c3333333-3333-4333-c333-333333333333',
    NOW(), NOW(), NOW()
  )
ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING;

-- =========================================================================
-- Part 3: public.users UPSERT
-- =========================================================================
-- handle_new_user 트리거가 auth.users INSERT 시 name='' 으로 자동 생성한 row 를 실제 값으로 갱신.

INSERT INTO public.users (
  id,
  email,
  name,
  role,
  phone,
  created_at,
  updated_at
) VALUES
  (
    'a1111111-1111-4111-a111-111111111111',
    'review-staff@uniqn.app',
    '심사용 스태프',
    'staff',
    '+821011110001',
    NOW(),
    NOW()
  ),
  (
    'b2222222-2222-4222-b222-222222222222',
    'review-employer@uniqn.app',
    '심사용 구인자',
    'employer',
    '+821022220002',
    NOW(),
    NOW()
  ),
  (
    'c3333333-3333-4333-c333-333333333333',
    'review-admin@uniqn.app',
    '심사용 관리자',
    'admin',
    '+821033330003',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  updated_at = NOW();
