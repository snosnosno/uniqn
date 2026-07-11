-- AD-001: 심사용 pending employer_application 시드
-- 기존 pending 1건은 admin 본인(c5084e30) → 심사 시나리오 시 admin 자기 자신 처리 위험
-- 별도 staff 계정(d4444444)의 pending row 추가

-- Part 1: auth.users (새 staff 계정)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'd4444444-4444-4444-d444-444444444444',
  'authenticated', 'authenticated',
  'pending-employer-staff@uniqn.app',
  crypt('Review2026!', gen_salt('bf')),
  NOW(), '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
  '{"name":"심사용 미인증 구인자"}'::jsonb,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

-- Part 2: auth.identities (email provider 로그인)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
) VALUES (
  gen_random_uuid(),
  'd4444444-4444-4444-d444-444444444444',
  '{"sub":"d4444444-4444-4444-d444-444444444444","email":"pending-employer-staff@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  'd4444444-4444-4444-d444-444444444444',
  NOW(), NOW(), NOW()
) ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING;

-- Part 3: public.users (role='staff', employer 신청 대기 상태)
INSERT INTO public.users (
  id, email, name, role, phone, created_at, updated_at
) VALUES (
  'd4444444-4444-4444-d444-444444444444',
  'pending-employer-staff@uniqn.app',
  '심사용 미인증 구인자',
  'staff',
  '+821044440004',
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  updated_at = NOW();

-- Part 4: employer_applications (status=pending)
INSERT INTO public.employer_applications (
  user_id, status, submitted_at, agreements_snapshot, created_at
) VALUES (
  'd4444444-4444-4444-d444-444444444444',
  'pending',
  NOW(),
  '{"_seeded":true,"applied_as":"employer"}'::jsonb,
  NOW()
) ON CONFLICT DO NOTHING;
