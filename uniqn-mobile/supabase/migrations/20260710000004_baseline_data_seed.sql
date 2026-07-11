-- =============================================================================
-- baseline 데이터 시드 — app_config / e2e·QA 계정 / 심사 시나리오 데이터
-- =============================================================================
-- prod↔repo 파리티 baseline squash(2026-07-11)의 4/4 파일.
--
-- 왜 필요한가: 2)의 baseline 덤프는 --schema-only 라 데이터가 없다. 아카이브된
--   데이터성 마이그레이션(계정 시드 등)이 만들던 행들을 여기로 이관한다.
--   e2e(Playwright)의 TEST_ACCOUNTS 가 review-* 계정 uid 리터럴에 1:1 의존하므로
--   이 파일이 없으면 로그인 기반 e2e 전체가 붕괴한다.
--
-- 구성(원본 마이그레이션의 상대 순서 보존 — 동작 동일성 유지):
--   §1 app_config          ← 20260413000002 + 20260630000300 + prod 실측 최종수렴(8행)
--   §2 employer approved 백필 ← 20260416160000 (원위치 보존: 계정 시드보다 앞 = no-op 동작 유지)
--   §3 review-* 심사계정 3종  ← 20260419131630
--   §4 주말 스태프 템플릿     ← 20260420142758
--   §5 pending employer 계정 ← 20260421010000
--   §6 review-collaborator   ← 20260520205822
--   §7 collaborator public.users ← 20260523203721 (수정: DO NOTHING → DO UPDATE, 사유 §7 주석)
--
-- prod 영향: 없음(전부 멱등 UPSERT — prod에는 이미 존재). repair로 기록만 한다.

-- -----------------------------------------------------------------------------
-- §1 app_config — prod 실측(2026-07-11) 최종 상태 8행
--    ON CONFLICT DO NOTHING: 운영 토글 값을 재시드가 덮어쓰지 않는다(구 시드와 동일 계약).
-- -----------------------------------------------------------------------------
INSERT INTO public.app_config (key, value, description) VALUES
  ('feature_flags', '{}'::jsonb, '기능 플래그'),
  ('force_update_version', '{"ios": "1.0.0", "web": "1.0.0", "android": "1.0.0"}'::jsonb, '강제 업데이트 최소 버전'),
  ('latest_version', '{"ios": "1.0.0", "web": "1.0.0", "android": "1.0.0"}'::jsonb, '각 플랫폼 최신 버전'),
  ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb, '점검 모드'),
  ('orphan_cleanup_state', '{"last_run_at": null, "last_processed_page": 0}'::jsonb, 'cleanup-orphan-accounts 실행 cursor'),
  ('recommended_version', '{"ios": "1.0.0", "web": "1.0.0", "android": "1.0.0"}'::jsonb, '각 플랫폼 권장 업데이트 버전'),
  ('release_notes', '{"ios": "", "web": "", "android": ""}'::jsonb, '각 플랫폼 릴리즈 노트'),
  ('weekly_grid_enabled', '{"enabled": false}'::jsonb, '주간 배치 그리드(홀덤펍 운영 그리드) UI 노출 플래그. {"enabled": bool}. 기본 OFF(출하 전).')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- §2 기존 employer approved 이력 백필 (구 20260416160000 원문)
--    이 시점(계정 시드 전)에는 employer가 없어 신규 환경에서 no-op — 원 동작 보존.
-- -----------------------------------------------------------------------------
INSERT INTO public.employer_applications (
  user_id, status, submitted_at, reviewed_at, reviewed_by,
  rejection_reason, rejection_category, agreements_snapshot, supersedes_id, created_at
)
SELECT
  u.id, 'approved',
  COALESCE(u.employer_registered_at, now()),
  COALESCE(u.employer_registered_at, now()),
  NULL, NULL, NULL,
  CASE
    WHEN u.employer_agreements IS NOT NULL
         AND u.employer_agreements != '{}'::JSONB
         AND u.employer_agreements != 'null'::JSONB
    THEN u.employer_agreements
    ELSE '{"_seeded": true}'::JSONB
  END,
  NULL,
  COALESCE(u.employer_registered_at, now())
FROM public.users u
WHERE u.role = 'employer'
  AND NOT EXISTS (
    SELECT 1 FROM public.employer_applications ea
    WHERE ea.user_id = u.id AND ea.status = 'approved'
  );

-- -----------------------------------------------------------------------------
-- §3 앱 심사용 데모 계정 3종 (구 20260419131630 원문)
--    NULL 가능 토큰 컬럼은 빈 문자열(GoTrue NOT NULL 함정). provider_id = user UUID.
--    on_auth_user_created 트리거(glue §1)가 public.users 행을 선생성하고 Part 3가 UPSERT.
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'a1111111-1111-4111-a111-111111111111',
    'authenticated', 'authenticated',
    'review-staff@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(), '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
    '{"name":"심사용 스태프"}'::jsonb,
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'b2222222-2222-4222-b222-222222222222',
    'authenticated', 'authenticated',
    'review-employer@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(), '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"employer"}'::jsonb,
    '{"name":"심사용 구인자"}'::jsonb,
    NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c3333333-3333-4333-c333-333333333333',
    'authenticated', 'authenticated',
    'review-admin@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(), '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    '{"name":"심사용 관리자"}'::jsonb,
    NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
) VALUES
  (
    gen_random_uuid(),
    'a1111111-1111-4111-a111-111111111111',
    '{"sub":"a1111111-1111-4111-a111-111111111111","email":"review-staff@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email', 'a1111111-1111-4111-a111-111111111111',
    NOW(), NOW(), NOW()
  ),
  (
    gen_random_uuid(),
    'b2222222-2222-4222-b222-222222222222',
    '{"sub":"b2222222-2222-4222-b222-222222222222","email":"review-employer@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email', 'b2222222-2222-4222-b222-222222222222',
    NOW(), NOW(), NOW()
  ),
  (
    gen_random_uuid(),
    'c3333333-3333-4333-c333-333333333333',
    '{"sub":"c3333333-3333-4333-c333-333333333333","email":"review-admin@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email', 'c3333333-3333-4333-c333-333333333333',
    NOW(), NOW(), NOW()
  )
ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING;

INSERT INTO public.users (
  id, email, name, role, phone, created_at, updated_at
) VALUES
  ('a1111111-1111-4111-a111-111111111111', 'review-staff@uniqn.app',    '심사용 스태프', 'staff',    '+821011110001', NOW(), NOW()),
  ('b2222222-2222-4222-b222-222222222222', 'review-employer@uniqn.app', '심사용 구인자', 'employer', '+821022220002', NOW(), NOW()),
  ('c3333333-3333-4333-c333-333333333333', 'review-admin@uniqn.app',    '심사용 관리자', 'admin',    '+821033330003', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- §4 EJ-002 주말 스태프 모집 템플릿 (구 20260420142758 원문 — employer b2222222 소유)
-- -----------------------------------------------------------------------------
INSERT INTO public.job_posting_templates (user_id, name, description, template_data, usage_count)
VALUES (
  'b2222222-2222-4222-b222-222222222222',
  '주말 스태프 모집 템플릿',
  '주말 포커룸 딜러/플로어 모집에 사용하는 기본 템플릿입니다. 날짜만 추가해 바로 게시하세요.',
  jsonb_build_object(
    'postingType', 'regular',
    'title', '주말 포커룸 스태프',
    'description', '주말 스태프 구합니다. 딜러 1명, 플로어 1명. 18:00~23:00 근무.',
    'contactPhone', '010-5550-0002',
    'tags', '[]'::jsonb,
    'roleCatalog', jsonb_build_array(
      jsonb_build_object('role','dealer','salary', jsonb_build_object('type','daily','amount',180000)),
      jsonb_build_object('role','floor','salary', jsonb_build_object('type','daily','amount',180000))
    ),
    'compensation', jsonb_build_object(
      'mode','by_role',
      'allowances', '{}'::jsonb,
      'defaultSalary', jsonb_build_object('type','daily','amount',0)
    ),
    'questions', '[]'::jsonb,
    'schedule', jsonb_build_object(
      'kind','dated',
      'primaryDate','',
      'allDates', '[]'::jsonb,
      'requirements', '[]'::jsonb,
      'templateTimeSlots', '[]'::jsonb
    )
  ),
  0
);

-- -----------------------------------------------------------------------------
-- §5 AD-001 pending employer_application 시드 (구 20260421010000 원문)
-- -----------------------------------------------------------------------------
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

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
) VALUES (
  gen_random_uuid(),
  'd4444444-4444-4444-d444-444444444444',
  '{"sub":"d4444444-4444-4444-d444-444444444444","email":"pending-employer-staff@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
  'email', 'd4444444-4444-4444-d444-444444444444',
  NOW(), NOW(), NOW()
) ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING;

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

INSERT INTO public.employer_applications (
  user_id, status, submitted_at, agreements_snapshot, created_at
) VALUES (
  'd4444444-4444-4444-d444-444444444444',
  'pending',
  NOW(),
  '{"_seeded":true,"applied_as":"employer"}'::jsonb,
  NOW()
) ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- §6 review-collaborator 계정 (구 20260520205822 원문)
--    raw_app_meta_data.role='employer' → on_auth_user_created 가 role/기본 워크스페이스 생성.
-- -----------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'e5555555-5555-4555-a555-555555555555',
  'authenticated', 'authenticated',
  'review-collaborator@uniqn.app',
  crypt('Review2026!', gen_salt('bf')),
  NOW(), '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"],"role":"employer"}'::jsonb,
  '{"name":"심사용 협업자"}'::jsonb,
  NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
) VALUES (
  gen_random_uuid(),
  'e5555555-5555-4555-a555-555555555555',
  '{"sub":"e5555555-5555-4555-a555-555555555555","email":"review-collaborator@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
  'email', 'e5555555-5555-4555-a555-555555555555',
  NOW(), NOW(), NOW()
) ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING;

-- -----------------------------------------------------------------------------
-- §7 collaborator public.users 완전 프로필 고정 (구 20260523203721, DO UPDATE 로 수정)
--    수정 사유: baseline glue 가 on_auth_user_created 트리거를 로컬에도 신설했다(prod 파리티).
--    §6 의 auth.users INSERT 시 트리거가 public.users 행을 기본 플래그(false)로 선생성하므로,
--    원문의 ON CONFLICT DO NOTHING 은 no-op 이 되어 e2e authRedirect 게이트
--    (phone_verified/identity_verified)가 약관 리다이렉트로 빠진다 → DO UPDATE 로 플래그 고정.
--    (prod 는 실제 인증 플로우로 이미 이 값 — 동작 변경 아님.)
-- -----------------------------------------------------------------------------
INSERT INTO public.users (
  id, email, name, role, phone,
  phone_verified, identity_verified, identity_verified_at, identity_provider, profile_completed
) VALUES (
  'e5555555-5555-4555-a555-555555555555',
  'review-collaborator@uniqn.app',
  '심사용 협업자',
  'employer',
  '+821055550005',
  true, true, NOW(), 'portone_inicis', true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  phone_verified = EXCLUDED.phone_verified,
  identity_verified = EXCLUDED.identity_verified,
  identity_verified_at = EXCLUDED.identity_verified_at,
  identity_provider = EXCLUDED.identity_provider,
  profile_completed = EXCLUDED.profile_completed,
  updated_at = NOW();
