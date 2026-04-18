-- 20260419031905_seed_app_review_accounts.sql
-- 앱 심사용 데모 계정 3종 + 핵심 기능 데모 데이터 시드.
-- 멱등성: 모든 INSERT는 ON CONFLICT DO NOTHING / DO UPDATE (재실행 안전).
-- 시간 데이터: NOW() + interval 으로 동적 계산.
--
-- ROLLBACK (수동):
--   DELETE FROM auth.users WHERE id IN (
--     'a1111111-1111-4111-a111-111111111111',
--     'b2222222-2222-4222-b222-222222222222',
--     'c3333333-3333-4333-c333-333333333333',
--     'd4444444-4444-4444-d444-444444444444'
--   );
--   -- CASCADE로 public.users 자동 정리.
--   -- 나머지 데모 데이터는 아래 PREFIX로 개별 삭제 가능:
--   --   job_postings: id LIKE '10000001-%' 등
--   --   board_posts: id LIKE '40000001-%' (text PK) 등

-- =========================================================================
-- Part 1: auth.users + auth.identities (4건)
-- =========================================================================

-- 1-A. auth.users 4건
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
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
    '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
    '{"name":"심사용 관리자"}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd4444444-4444-4444-d444-444444444444',
    'authenticated',
    'authenticated',
    'review-applicant@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
    '{"name":"심사용 신청자"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 1-B. auth.identities 4건
-- ON CONFLICT: identities_provider_id_provider_unique (provider_id, provider)
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
    '{"sub":"a1111111-1111-4111-a111-111111111111","email":"review-staff@uniqn.app","email_verified":true}'::jsonb,
    'email',
    'review-staff@uniqn.app',
    NOW(), NOW(), NOW()
  ),
  (
    gen_random_uuid(),
    'b2222222-2222-4222-b222-222222222222',
    '{"sub":"b2222222-2222-4222-b222-222222222222","email":"review-employer@uniqn.app","email_verified":true}'::jsonb,
    'email',
    'review-employer@uniqn.app',
    NOW(), NOW(), NOW()
  ),
  (
    gen_random_uuid(),
    'c3333333-3333-4333-c333-333333333333',
    '{"sub":"c3333333-3333-4333-c333-333333333333","email":"review-admin@uniqn.app","email_verified":true}'::jsonb,
    'email',
    'review-admin@uniqn.app',
    NOW(), NOW(), NOW()
  ),
  (
    gen_random_uuid(),
    'd4444444-4444-4444-d444-444444444444',
    '{"sub":"d4444444-4444-4444-d444-444444444444","email":"review-applicant@uniqn.app","email_verified":true}'::jsonb,
    'email',
    'review-applicant@uniqn.app',
    NOW(), NOW(), NOW()
  )
ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING;

-- =========================================================================
-- Part 2: public.users UPSERT (handle_new_user 트리거 자동 생성 row 갱신)
-- =========================================================================
-- handle_new_user가 auth.users INSERT 시 name='' 으로 public.users를 자동 생성함.
-- UPSERT로 실제 이름/역할/phone 등을 덮어씀.

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
  ),
  (
    'd4444444-4444-4444-d444-444444444444',
    'review-applicant@uniqn.app',
    '심사용 신청자',
    'staff',
    '+821044440004',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  role       = EXCLUDED.role,
  phone      = EXCLUDED.phone,
  updated_at = NOW();

-- =========================================================================
-- Part 3a: job_postings (employer 소유 — 3건)
-- =========================================================================
-- 실제 컬럼: owner_id (uuid), total_positions (int), location (jsonb NOT NULL)
-- work_dates (text[]), last_work_date (date)
-- start_date/end_date 컬럼 없음 → work_dates 배열로 대체

INSERT INTO public.job_postings (
  id,
  owner_id,
  title,
  description,
  location,
  schedule,
  work_dates,
  last_work_date,
  total_positions,
  status,
  created_at,
  updated_at
) VALUES
  (
    '10000001-0000-4000-a000-000000000001',
    'b2222222-2222-4222-b222-222222222222',
    '강남 포커룸 주말 스태프',
    '주말 야간 딜러/플로어 모집. 경력 무관, 친절 교육 제공.',
    jsonb_build_object('address', '서울 강남구 역삼동', 'lat', 37.5012, 'lng', 127.0396),
    '{}'::jsonb,
    ARRAY[
      (NOW() + INTERVAL '7 days')::date::text,
      (NOW() + INTERVAL '14 days')::date::text
    ],
    (NOW() + INTERVAL '14 days')::date,
    3,
    'active',
    NOW(),
    NOW()
  ),
  (
    '10000002-0000-4000-a000-000000000002',
    'b2222222-2222-4222-b222-222222222222',
    '분당 포커룸 평일 딜러',
    '평일 저녁 딜러 급구. 마감 임박.',
    jsonb_build_object('address', '경기 성남시 분당구', 'lat', 37.3595, 'lng', 127.1050),
    '{}'::jsonb,
    ARRAY[
      (NOW() + INTERVAL '2 days')::date::text,
      (NOW() + INTERVAL '5 days')::date::text
    ],
    (NOW() + INTERVAL '5 days')::date,
    2,
    'active',
    NOW(),
    NOW()
  ),
  (
    '10000003-0000-4000-a000-000000000003',
    'b2222222-2222-4222-b222-222222222222',
    '홍대 포커룸 단기 알바',
    '주말 단기 모집 (마감).',
    jsonb_build_object('address', '서울 마포구 서교동', 'lat', 37.5536, 'lng', 126.9229),
    '{}'::jsonb,
    ARRAY[
      (NOW() - INTERVAL '14 days')::date::text,
      (NOW() - INTERVAL '7 days')::date::text
    ],
    (NOW() - INTERVAL '7 days')::date,
    2,
    'closed',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '7 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 3b: applications (staff → posting1: applied, posting2: confirmed — 2건)
-- =========================================================================
-- 실제 컬럼: applicant_name (text NOT NULL), applied_at 없음
-- status enum: applied/confirmed/rejected/cancelled/completed/cancellation_pending
-- 'pending' 없음 → 'applied' 사용

INSERT INTO public.applications (
  id,
  job_posting_id,
  applicant_id,
  applicant_name,
  status,
  created_at,
  updated_at
) VALUES
  (
    '20000001-0000-4000-a000-000000000001',
    '10000001-0000-4000-a000-000000000001',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'applied',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '20000002-0000-4000-a000-000000000002',
    '10000002-0000-4000-a000-000000000002',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'confirmed',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 3c: work_logs (Case B — 트리거 없음, 직접 INSERT 2건)
-- =========================================================================
-- 실제 컬럼: staff_id (uuid NOT NULL), job_posting_id (uuid NOT NULL),
--   date (text NOT NULL, YYYY-MM-DD), role (staff_role NOT NULL, default 'staff')
--   check_in_time / check_out_time (jsonb, nullable)
--   payroll_status / payroll_amount / payroll_date (nullable)
-- employer_id, scheduled_start_at/end_at, check_in_at/check_out_at 컬럼 없음.

INSERT INTO public.work_logs (
  id,
  staff_id,
  job_posting_id,
  application_id,
  date,
  role,
  status,
  check_in_time,
  check_out_time,
  payroll_status,
  payroll_amount,
  payroll_date,
  created_at,
  updated_at
) VALUES
  (
    -- 과거 근무 (4일 전, 완료)
    '30000001-0000-4000-a000-000000000001',
    'a1111111-1111-4111-a111-111111111111',
    '10000002-0000-4000-a000-000000000002',
    '20000002-0000-4000-a000-000000000002',
    (NOW() - INTERVAL '4 days')::date::text,
    'staff',
    'checked_out',
    jsonb_build_object('at', (NOW() - INTERVAL '4 days 8 hours')::text),
    jsonb_build_object('at', (NOW() - INTERVAL '4 days')::text),
    'completed',
    120000,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    -- 미래 근무 (3일 후, 예정)
    '30000002-0000-4000-a000-000000000002',
    'a1111111-1111-4111-a111-111111111111',
    '10000001-0000-4000-a000-000000000001',
    NULL,
    (NOW() + INTERVAL '3 days')::date::text,
    'staff',
    'scheduled',
    NULL,
    NULL,
    'pending',
    NULL,
    NULL,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 3d: board_posts (2건) + board_comments (4건)
-- =========================================================================
-- board_posts.id는 text (uuid가 아님)
-- author_name, author_role, body는 NOT NULL

INSERT INTO public.board_posts (
  id,
  board_type,
  title,
  body,
  author_id,
  author_name,
  author_role,
  created_at,
  updated_at
) VALUES
  (
    '40000001-0000-4000-a000-000000000001',
    'free',
    '포커룸 첫 출근 후기',
    '강남점에서 첫 근무하고 왔어요. 분위기 좋고 팀원들도 친절합니다.',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'staff',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '40000002-0000-4000-a000-000000000002',
    'free',
    '강남 포커룸 정기 채용 안내',
    '매주 주말 스태프 모집 중입니다. 자세한 사항은 공고 참고.',
    'b2222222-2222-4222-b222-222222222222',
    '심사용 구인자',
    'employer',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days'
  )
ON CONFLICT (id) DO NOTHING;

-- board_comments.id는 uuid (board_posts.id와 달리 uuid PK)
-- post_id는 text (board_posts.id FK)
-- author_name, author_role, body는 NOT NULL

INSERT INTO public.board_comments (
  id,
  post_id,
  author_id,
  author_name,
  author_role,
  body,
  created_at,
  updated_at
) VALUES
  (
    '70000001-0000-4000-a000-000000000001',
    '40000001-0000-4000-a000-000000000001',
    'b2222222-2222-4222-b222-222222222222',
    '심사용 구인자',
    'employer',
    '수고하셨어요! 다음에도 함께해요.',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '70000001-0000-4000-a000-000000000002',
    '40000001-0000-4000-a000-000000000001',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'staff',
    '감사합니다 :)',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '70000002-0000-4000-a000-000000000001',
    '40000002-0000-4000-a000-000000000002',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'staff',
    '다음 주말 신청합니다!',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '70000002-0000-4000-a000-000000000002',
    '40000002-0000-4000-a000-000000000002',
    'd4444444-4444-4444-d444-444444444444',
    '심사용 신청자',
    'staff',
    '신규 신청 가능한가요?',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 3e: notifications (9건)
-- =========================================================================
-- 실제 컬럼: recipient_id (uuid NOT NULL) — plan의 user_id와 다름
-- updated_at 컬럼 없음 (created_at만 있음)
-- 트리거 주의: applications/work_logs INSERT 시 자동 notifications 발화됨.
--   이 9건은 시드용 추가 notifications이며 타입이 달라 기능상 무해.

INSERT INTO public.notifications (
  id,
  recipient_id,
  type,
  title,
  body,
  read_at,
  created_at
) VALUES
  -- staff 3건
  (
    '80000001-0000-4000-a000-000000000001',
    'a1111111-1111-4111-a111-111111111111',
    'application_confirmed',
    '지원 확정',
    '"분당 포커룸 평일 딜러" 공고에 확정되었습니다.',
    NULL,
    NOW() - INTERVAL '1 day'
  ),
  (
    '80000001-0000-4000-a000-000000000002',
    'a1111111-1111-4111-a111-111111111111',
    'new_job_posting',
    '새 공고 등록',
    '"강남 포커룸 주말 스태프" 공고가 새로 등록되었습니다.',
    NULL,
    NOW() - INTERVAL '6 hours'
  ),
  (
    '80000001-0000-4000-a000-000000000003',
    'a1111111-1111-4111-a111-111111111111',
    'board_comment',
    '게시글 댓글',
    '심사용 구인자님이 회원님의 게시글에 댓글을 남겼습니다.',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '2 days'
  ),
  -- employer 3건
  (
    '80000002-0000-4000-a000-000000000001',
    'b2222222-2222-4222-b222-222222222222',
    'new_application',
    '새 지원자',
    '"강남 포커룸 주말 스태프" 공고에 새 지원이 접수되었습니다.',
    NULL,
    NOW() - INTERVAL '2 days'
  ),
  (
    '80000002-0000-4000-a000-000000000002',
    'b2222222-2222-4222-b222-222222222222',
    'work_log_completed',
    '근무 완료',
    '심사용 스태프님이 근무를 완료했습니다.',
    NULL,
    NOW() - INTERVAL '4 days'
  ),
  (
    '80000002-0000-4000-a000-000000000003',
    'b2222222-2222-4222-b222-222222222222',
    'payroll_created',
    '정산 생성',
    '4일 전 근무에 대한 정산이 생성되었습니다.',
    NULL,
    NOW() - INTERVAL '4 days'
  ),
  -- admin 3건
  (
    '80000003-0000-4000-a000-000000000001',
    'c3333333-3333-4333-c333-333333333333',
    'employer_application_pending',
    '신규 employer 신청',
    '심사용 신청자님이 employer 권한을 요청했습니다.',
    NULL,
    NOW() - INTERVAL '3 days'
  ),
  (
    '80000003-0000-4000-a000-000000000002',
    'c3333333-3333-4333-c333-333333333333',
    'system',
    '시스템 점검 안내',
    '주간 정기 점검이 예정되어 있습니다.',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '5 days'
  ),
  (
    '80000003-0000-4000-a000-000000000003',
    'c3333333-3333-4333-c333-333333333333',
    'system',
    '대시보드 업데이트',
    '관리자 대시보드에 신규 통계 위젯이 추가되었습니다.',
    NULL,
    NOW() - INTERVAL '12 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 3f: job_posting_templates (1건)
-- =========================================================================
-- 실제 컬럼: user_id (NOT NULL), name (NOT NULL), template_data (jsonb NOT NULL),
--   usage_count (int NOT NULL), description (nullable, 2026-04-18 추가)

INSERT INTO public.job_posting_templates (
  id,
  user_id,
  name,
  description,
  template_data,
  usage_count,
  created_at,
  updated_at
) VALUES
  (
    '50000001-0000-4000-a000-000000000001',
    'b2222222-2222-4222-b222-222222222222',
    '주말 스태프 모집 템플릿',
    '주말 야간 딜러/플로어 모집용 기본 템플릿',
    '{"title":"주말 스태프 모집","total_positions":3,"location":{"address":"서울 강남구"}}'::jsonb,
    2,
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 3g: employer_applications (1건)
-- =========================================================================
-- 실제 컬럼: user_id (uuid NOT NULL) — plan의 applicant_id와 다름
--   agreements_snapshot (jsonb NOT NULL, 기본값 없음) — 필수 제공
--   submitted_at (timestamptz NOT NULL, default now())
-- business_name/number/phone_number 컬럼 없음 → agreements_snapshot에 포함

INSERT INTO public.employer_applications (
  id,
  user_id,
  status,
  agreements_snapshot,
  submitted_at,
  created_at
) VALUES
  (
    '60000001-0000-4000-a000-000000000001',
    'd4444444-4444-4444-d444-444444444444',
    'pending',
    jsonb_build_object(
      'terms', true,
      'privacy', true,
      'business_name', '심사용 신규 사업장',
      'business_number', '123-45-67890',
      'phone', '+821044440004'
    ),
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 4: 멱등성 확인 주석
-- =========================================================================
-- 이 파일은 재실행 안전:
--   - auth.users: ON CONFLICT (id) DO NOTHING
--   - auth.identities: ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING
--   - public.users: ON CONFLICT (id) DO UPDATE SET (이름/역할/phone 갱신)
--   - 나머지 모든 테이블: ON CONFLICT (id) DO NOTHING
--
-- 트리거 부작용 (재실행 시 중복 생성 가능):
--   - applications INSERT → employer에게 notification 자동 발화
--   - work_logs INSERT → staff에게 schedule notification 자동 발화
--   - notifications INSERT → push 알림 발화 (on_notification_created_send_push)
--   → ON CONFLICT DO NOTHING으로 두 번째 실행 시 INSERT 자체가 스킵되므로 트리거도 발화 안 됨.
--
-- ROLLBACK (수동):
--   DELETE FROM auth.users WHERE id IN (
--     'a1111111-1111-4111-a111-111111111111',
--     'b2222222-2222-4222-b222-222222222222',
--     'c3333333-3333-4333-c333-333333333333',
--     'd4444444-4444-4444-d444-444444444444'
--   );
