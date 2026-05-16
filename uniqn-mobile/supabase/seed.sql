-- ============================================================================
-- UNIQN E2E 테스트용 QA 계정 시드
-- ============================================================================
-- 사용처: `supabase start` 직후 자동 적용 (CI: .github/workflows/e2e.yml)
-- 멱등성: 모든 INSERT는 ON CONFLICT DO NOTHING — 재실행 안전
--
-- 주의:
--   1. auth.users INSERT 후 sync_user_role_to_app_metadata 트리거가
--      app_metadata.role을 자동 동기화 (public.users INSERT 시점)
--   2. auth.identities는 이메일 로그인을 위해 필수
--   3. pgcrypto 확장은 Supabase 기본 활성화 (gen_salt, crypt 사용 가능)
-- ============================================================================

-- pgcrypto 확장 보장 (Supabase는 기본 활성화이지만 안전)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. auth.users — 이메일/비밀번호 자격 증명
-- ============================================================================

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES
  (
    '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'qa-staff@uniqn.test',
    crypt('TestPass1!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
    '{"name":"QA스태프"}'::jsonb,
    false,
    '',
    '',
    '',
    ''
  ),
  (
    '9cf771e9-0e67-413d-8395-5b1d573ae64d'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'qa-employer@uniqn.test',
    crypt('TestPass1!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"],"role":"employer"}'::jsonb,
    '{"name":"QA구인자"}'::jsonb,
    false,
    '',
    '',
    '',
    ''
  ),
  (
    '95337a77-9700-427e-8ff3-bc7a14abb90e'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'qa-admin@uniqn.test',
    crypt('TestPass1!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    '{"name":"QA관리자"}'::jsonb,
    false,
    '',
    '',
    '',
    ''
  ),
  -- PR #88 follow-up: 공고별 협업자 페르소나 (role=employer, 자기 workspace 없음)
  (
    'c1a2b3c4-d5e6-4f7a-8b9c-d0e1f2a3b4c5'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'qa-collaborator@uniqn.test',
    crypt('TestPass1!', gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"],"role":"employer"}'::jsonb,
    '{"name":"QA협업자"}'::jsonb,
    false,
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. auth.identities — 이메일 provider 레코드 (Supabase 로그인 필수)
-- ============================================================================
-- provider_id = email (Supabase v2.x 스키마)
-- identity_data.sub = user uuid (필수)
-- id 컬럼은 v2.x에서 별도 PK (gen_random_uuid)

INSERT INTO auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    gen_random_uuid(),
    'qa-staff@uniqn.test',
    '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8'::uuid,
    jsonb_build_object(
      'sub', '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8',
      'email', 'qa-staff@uniqn.test',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'qa-employer@uniqn.test',
    '9cf771e9-0e67-413d-8395-5b1d573ae64d'::uuid,
    jsonb_build_object(
      'sub', '9cf771e9-0e67-413d-8395-5b1d573ae64d',
      'email', 'qa-employer@uniqn.test',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'qa-admin@uniqn.test',
    '95337a77-9700-427e-8ff3-bc7a14abb90e'::uuid,
    jsonb_build_object(
      'sub', '95337a77-9700-427e-8ff3-bc7a14abb90e',
      'email', 'qa-admin@uniqn.test',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'qa-collaborator@uniqn.test',
    'c1a2b3c4-d5e6-4f7a-8b9c-d0e1f2a3b4c5'::uuid,
    jsonb_build_object(
      'sub', 'c1a2b3c4-d5e6-4f7a-8b9c-d0e1f2a3b4c5',
      'email', 'qa-collaborator@uniqn.test',
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  )
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ============================================================================
-- 3. public.users — 앱 프로필
-- ============================================================================
-- INSERT 시 on_public_user_created_sync_role 트리거가
-- auth.users.raw_app_meta_data.role을 자동 갱신함.

INSERT INTO public.users (
  id,
  email,
  name,
  nickname,
  role,
  status,
  is_active,
  phone,
  phone_verified,
  profile_completed,
  terms_agreed,
  privacy_agreed,
  marketing_agreed,
  identity_verified,
  identity_verified_at,
  created_at,
  updated_at
)
VALUES
  (
    '4365e1ad-c9fb-416f-addb-d1b18b2a5ec8'::uuid,
    'qa-staff@uniqn.test',
    'QA스태프',
    'qa-staff',
    'staff',
    'active',
    true,
    '+82101234567',
    true,
    true,
    true,
    true,
    false,
    true,
    now(),
    now(),
    now()
  ),
  (
    '9cf771e9-0e67-413d-8395-5b1d573ae64d'::uuid,
    'qa-employer@uniqn.test',
    'QA구인자',
    'qa-employer',
    'employer',
    'active',
    true,
    '+82109876543',
    true,
    true,
    true,
    true,
    false,
    true,
    now(),
    now(),
    now()
  ),
  (
    '95337a77-9700-427e-8ff3-bc7a14abb90e'::uuid,
    'qa-admin@uniqn.test',
    'QA관리자',
    'qa-admin',
    'admin',
    'active',
    true,
    '+82105555555',
    true,
    true,
    true,
    true,
    false,
    true,
    now(),
    now(),
    now()
  ),
  (
    'c1a2b3c4-d5e6-4f7a-8b9c-d0e1f2a3b4c5'::uuid,
    'qa-collaborator@uniqn.test',
    'QA협업자',
    'qa-collaborator',
    'employer',
    'active',
    true,
    '+82107777777',
    true,
    true,
    true,
    true,
    false,
    true,
    now(),
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;
