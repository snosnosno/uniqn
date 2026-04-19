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
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd4444444-4444-4444-d444-444444444444',
    'authenticated',
    'authenticated',
    'review-applicant@uniqn.app',
    crypt('Review2026!', gen_salt('bf')),
    NOW(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
    '{"name":"심사용 신청자"}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- 1-B. auth.identities 4건
-- ON CONFLICT: identities_provider_id_provider_unique (provider_id, provider)
-- NOTE: provider_id must be the user UUID (not email) for GoTrue email provider sign-in to work.
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
  ),
  (
    gen_random_uuid(),
    'd4444444-4444-4444-d444-444444444444',
    '{"sub":"d4444444-4444-4444-d444-444444444444","email":"review-applicant@uniqn.app","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    'd4444444-4444-4444-d444-444444444444',
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
-- 앱 런타임이 생성하는 정확한 shape 복제 (serialization.ts + draftAdapter.ts).
--
-- 핵심 조건 (일별 탭 필터가 공고를 찾으려면 모두 만족해야 함):
--   1. schedule.kind = 'dated' (fixed 공고가 아님)
--   2. schedule.requirements[].date 배열에 모든 근무 날짜 존재 (YYYY-MM-DD)
--   3. schedule.allDates = requirements[].date 과 동일한 배열
--   4. schedule.primaryDate = requirements[0].date
--   5. work_dates (text[]) 컬럼도 동일한 날짜 배열로 유지 (DB 검색 최적화)
--
-- 참고: jsonb 컬럼(location/schedule/role_catalog/compensation/questions/stats)은
--   camelCase 유지. toSnakeCase는 top-level 컬럼명만 변환한다.

INSERT INTO public.job_postings (
  id, schema_version, owner_id, owner_name, title, description,
  location, schedule, work_date, work_dates, last_work_date,
  role_keys, total_positions, filled_positions, view_count,
  role_catalog, compensation, questions, stats,
  status, posting_type, contact_phone, tags,
  created_at, updated_at
) VALUES
  -- 공고 1: 강남 포커룸 주말 스태프 (7/14일 후, 일요일 기준)
  (
    '10000001-0000-4000-a000-000000000001',
    3,
    'b2222222-2222-4222-b222-222222222222',
    '심사용 구인자',
    '강남 포커룸 주말 스태프',
    '주말 야간 딜러/플로어 모집. 경력 무관, 친절 교육 제공.',
    jsonb_build_object('name', '강남 포커룸', 'district', '서울 강남구 역삼동'),
    jsonb_build_object(
      'kind', 'dated',
      'primaryDate', to_char((NOW() + INTERVAL '7 days')::date, 'YYYY-MM-DD'),
      'allDates', jsonb_build_array(
        to_char((NOW() + INTERVAL '7 days')::date, 'YYYY-MM-DD'),
        to_char((NOW() + INTERVAL '14 days')::date, 'YYYY-MM-DD')
      ),
      'requirements', jsonb_build_array(
        jsonb_build_object(
          'date', to_char((NOW() + INTERVAL '7 days')::date, 'YYYY-MM-DD'),
          'timeSlots', jsonb_build_array(
            jsonb_build_object(
              'startTime', '19:00',
              'roles', jsonb_build_array(
                jsonb_build_object('role', 'dealer', 'count', 3, 'filled', 0),
                jsonb_build_object('role', 'floor',  'count', 2, 'filled', 0)
              )
            )
          )
        ),
        jsonb_build_object(
          'date', to_char((NOW() + INTERVAL '14 days')::date, 'YYYY-MM-DD'),
          'timeSlots', jsonb_build_array(
            jsonb_build_object(
              'startTime', '19:00',
              'roles', jsonb_build_array(
                jsonb_build_object('role', 'dealer', 'count', 3, 'filled', 0),
                jsonb_build_object('role', 'floor',  'count', 2, 'filled', 0)
              )
            )
          )
        )
      )
    ),
    to_char((NOW() + INTERVAL '7 days')::date, 'YYYY-MM-DD'),
    ARRAY[
      to_char((NOW() + INTERVAL '7 days')::date, 'YYYY-MM-DD'),
      to_char((NOW() + INTERVAL '14 days')::date, 'YYYY-MM-DD')
    ],
    (NOW() + INTERVAL '14 days')::date,
    ARRAY['dealer', 'floor'],
    5, 0, 0,
    jsonb_build_array(
      jsonb_build_object('role', 'dealer', 'salary', jsonb_build_object('type', 'hourly', 'amount', 25000)),
      jsonb_build_object('role', 'floor',  'salary', jsonb_build_object('type', 'hourly', 'amount', 25000))
    ),
    jsonb_build_object('mode', 'shared', 'defaultSalary', jsonb_build_object('type', 'hourly', 'amount', 25000)),
    jsonb_build_object('items', jsonb_build_array()),
    jsonb_build_object(
      'totalApplicants', 0, 'activeApplicants', 0,
      'confirmedApplicants', 0, 'cancellationPendingApplicants', 0,
      'filledPositions', 0
    ),
    'active', 'regular', '+82-2-1234-5678', ARRAY[]::text[],
    NOW(), NOW()
  ),
  -- 공고 2: 분당 포커룸 평일 딜러 (2/5일 후 — 마감 임박)
  (
    '10000002-0000-4000-a000-000000000002',
    3,
    'b2222222-2222-4222-b222-222222222222',
    '심사용 구인자',
    '분당 포커룸 평일 딜러',
    '평일 저녁 딜러 급구. 마감 임박.',
    jsonb_build_object('name', '분당 포커룸', 'district', '경기 성남시 분당구'),
    jsonb_build_object(
      'kind', 'dated',
      'primaryDate', to_char((NOW() + INTERVAL '2 days')::date, 'YYYY-MM-DD'),
      'allDates', jsonb_build_array(
        to_char((NOW() + INTERVAL '2 days')::date, 'YYYY-MM-DD'),
        to_char((NOW() + INTERVAL '5 days')::date, 'YYYY-MM-DD')
      ),
      'requirements', jsonb_build_array(
        jsonb_build_object(
          'date', to_char((NOW() + INTERVAL '2 days')::date, 'YYYY-MM-DD'),
          'timeSlots', jsonb_build_array(
            jsonb_build_object(
              'startTime', '18:00',
              'roles', jsonb_build_array(
                jsonb_build_object('role', 'dealer', 'count', 2, 'filled', 0)
              )
            )
          )
        ),
        jsonb_build_object(
          'date', to_char((NOW() + INTERVAL '5 days')::date, 'YYYY-MM-DD'),
          'timeSlots', jsonb_build_array(
            jsonb_build_object(
              'startTime', '18:00',
              'roles', jsonb_build_array(
                jsonb_build_object('role', 'dealer', 'count', 2, 'filled', 0)
              )
            )
          )
        )
      )
    ),
    to_char((NOW() + INTERVAL '2 days')::date, 'YYYY-MM-DD'),
    ARRAY[
      to_char((NOW() + INTERVAL '2 days')::date, 'YYYY-MM-DD'),
      to_char((NOW() + INTERVAL '5 days')::date, 'YYYY-MM-DD')
    ],
    (NOW() + INTERVAL '5 days')::date,
    ARRAY['dealer'],
    2, 0, 0,
    jsonb_build_array(
      jsonb_build_object('role', 'dealer', 'salary', jsonb_build_object('type', 'hourly', 'amount', 22000))
    ),
    jsonb_build_object('mode', 'shared', 'defaultSalary', jsonb_build_object('type', 'hourly', 'amount', 22000)),
    jsonb_build_object('items', jsonb_build_array()),
    jsonb_build_object(
      'totalApplicants', 0, 'activeApplicants', 0,
      'confirmedApplicants', 0, 'cancellationPendingApplicants', 0,
      'filledPositions', 0
    ),
    'active', 'regular', '+82-2-5678-1234', ARRAY[]::text[],
    NOW(), NOW()
  ),
  -- 공고 3: 홍대 포커룸 단기 알바 (1일 전 마감, closed)
  (
    '10000003-0000-4000-a000-000000000003',
    3,
    'b2222222-2222-4222-b222-222222222222',
    '심사용 구인자',
    '홍대 포커룸 단기 알바',
    '주말 단기 모집 (마감).',
    jsonb_build_object('name', '홍대 포커룸', 'district', '서울 마포구 서교동'),
    jsonb_build_object(
      'kind', 'dated',
      'primaryDate', to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'),
      'allDates', jsonb_build_array(
        to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD')
      ),
      'requirements', jsonb_build_array(
        jsonb_build_object(
          'date', to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'),
          'timeSlots', jsonb_build_array(
            jsonb_build_object(
              'startTime', '20:00',
              'roles', jsonb_build_array(
                jsonb_build_object('role', 'floor', 'count', 2, 'filled', 2)
              )
            )
          )
        )
      )
    ),
    to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD'),
    ARRAY[to_char((NOW() - INTERVAL '1 day')::date, 'YYYY-MM-DD')],
    (NOW() - INTERVAL '1 day')::date,
    ARRAY['floor'],
    2, 2, 0,
    jsonb_build_array(
      jsonb_build_object('role', 'floor', 'salary', jsonb_build_object('type', 'hourly', 'amount', 20000))
    ),
    jsonb_build_object('mode', 'shared', 'defaultSalary', jsonb_build_object('type', 'hourly', 'amount', 20000)),
    jsonb_build_object('items', jsonb_build_array()),
    jsonb_build_object(
      'totalApplicants', 0, 'activeApplicants', 0,
      'confirmedApplicants', 0, 'cancellationPendingApplicants', 0,
      'filledPositions', 2
    ),
    'closed', 'regular', '+82-2-9876-5432', ARRAY[]::text[],
    NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Part 3b: applications (공고 수명주기 데모 — 6건)
-- =========================================================================
-- 실제 컬럼: applicant_name (text NOT NULL)
-- status enum: applied/confirmed/rejected/cancelled/completed/cancellation_pending
-- UNIQUE 제약: (job_posting_id, applicant_id) — 같은 (공고, 지원자) 조합 1회
--
-- 데모 매트릭스:
--   posting1 강남 active  — staff:applied,    applicant:applied    (다중 대기)
--   posting2 분당 active  — staff:confirmed,  applicant:confirmed  (다중 확정)
--   posting3 홍대 closed  — staff:completed,  applicant:completed  (마감 + 완료)

INSERT INTO public.applications (
  id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at
) VALUES
  -- posting1 강남: staff 지원 (대기)
  (
    '20000001-0000-4000-a000-000000000001',
    '10000001-0000-4000-a000-000000000001',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'applied',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  -- posting2 분당: staff 확정
  (
    '20000002-0000-4000-a000-000000000002',
    '10000002-0000-4000-a000-000000000002',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'confirmed',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '1 day'
  ),
  -- posting1 강남: applicant 지원 (대기)
  (
    '20000003-0000-4000-a000-000000000003',
    '10000001-0000-4000-a000-000000000001',
    'd4444444-4444-4444-d444-444444444444',
    '심사용 신청자',
    'applied',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  -- posting2 분당: applicant 확정
  (
    '20000004-0000-4000-a000-000000000004',
    '10000002-0000-4000-a000-000000000002',
    'd4444444-4444-4444-d444-444444444444',
    '심사용 신청자',
    'confirmed',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  -- posting3 홍대: staff 근무 완료
  (
    '20000005-0000-4000-a000-000000000005',
    '10000003-0000-4000-a000-000000000003',
    'a1111111-1111-4111-a111-111111111111',
    '심사용 스태프',
    'completed',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '1 day'
  ),
  -- posting3 홍대: applicant 근무 완료
  (
    '20000006-0000-4000-a000-000000000006',
    '10000003-0000-4000-a000-000000000003',
    'd4444444-4444-4444-d444-444444444444',
    '심사용 신청자',
    'completed',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- posting stats 보정 — applications 상태 집계와 동기화
-- 트리거 없이 직접 INSERT 하므로 stats jsonb + filled_positions 는 수동 갱신 필수.
UPDATE public.job_postings
SET stats = jsonb_build_object(
  'totalApplicants', 2, 'activeApplicants', 2,
  'confirmedApplicants', 0, 'cancellationPendingApplicants', 0,
  'filledPositions', 0
)
WHERE id = '10000001-0000-4000-a000-000000000001';

UPDATE public.job_postings
SET
  stats = jsonb_build_object(
    'totalApplicants', 2, 'activeApplicants', 2,
    'confirmedApplicants', 2, 'cancellationPendingApplicants', 0,
    'filledPositions', 2
  ),
  filled_positions = 2
WHERE id = '10000002-0000-4000-a000-000000000002';

UPDATE public.job_postings
SET stats = jsonb_build_object(
  'totalApplicants', 2, 'activeApplicants', 0,
  'confirmedApplicants', 0, 'cancellationPendingApplicants', 0,
  'filledPositions', 2
)
WHERE id = '10000003-0000-4000-a000-000000000003';

-- =========================================================================
-- Part 3c: work_logs (근무 + 정산 데모 — 5건)
-- =========================================================================
-- 실제 컬럼: staff_id (uuid NOT NULL), job_posting_id (uuid NOT NULL),
--   date (text NOT NULL, YYYY-MM-DD), role (staff_role NOT NULL, default 'staff')
--   check_in_time / check_out_time (jsonb, nullable)
-- payroll_status enum: pending / completed / failed (processing 없음)
--
-- 데모 매트릭스:
--   WL1 staff@posting2   — 4일 전 checked_out, 정산 completed 120000원 (과거 완료)
--   WL2 staff@posting1   — 3일 후 scheduled                           (미래 예정)
--   WL3 staff@posting3   — 1일 전 checked_out, 정산 completed  80000원 (홍대 마감)
--   WL4 applicant@posting3 — 1일 전 checked_out, 정산 pending  80000원 (정산 대기)
--   WL5 applicant@posting2 — 2일 후 scheduled                          (미래 예정)

INSERT INTO public.work_logs (
  id, staff_id, job_posting_id, application_id,
  date, role, status,
  check_in_time, check_out_time,
  payroll_status, payroll_amount, payroll_date,
  created_at, updated_at
) VALUES
  -- WL1: staff@posting2, 4일 전 완료, 정산 완료
  (
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
  -- WL2: staff@posting1, 3일 후 예정
  (
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
  ),
  -- WL3: staff@posting3 (홍대 마감), 1일 전 완료, 정산 완료
  (
    '30000003-0000-4000-a000-000000000003',
    'a1111111-1111-4111-a111-111111111111',
    '10000003-0000-4000-a000-000000000003',
    '20000005-0000-4000-a000-000000000005',
    (NOW() - INTERVAL '1 day')::date::text,
    'staff',
    'checked_out',
    jsonb_build_object('at', (NOW() - INTERVAL '1 day 4 hours')::text),
    jsonb_build_object('at', (NOW() - INTERVAL '1 day')::text),
    'completed',
    80000,
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '12 hours'
  ),
  -- WL4: applicant@posting3 (홍대 마감), 1일 전 완료, 정산 대기
  (
    '30000004-0000-4000-a000-000000000004',
    'd4444444-4444-4444-d444-444444444444',
    '10000003-0000-4000-a000-000000000003',
    '20000006-0000-4000-a000-000000000006',
    (NOW() - INTERVAL '1 day')::date::text,
    'staff',
    'checked_out',
    jsonb_build_object('at', (NOW() - INTERVAL '1 day 4 hours')::text),
    jsonb_build_object('at', (NOW() - INTERVAL '1 day')::text),
    'pending',
    80000,
    NULL,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  -- WL5: applicant@posting2, 2일 후 예정
  (
    '30000005-0000-4000-a000-000000000005',
    'd4444444-4444-4444-d444-444444444444',
    '10000002-0000-4000-a000-000000000002',
    '20000004-0000-4000-a000-000000000004',
    (NOW() + INTERVAL '2 days')::date::text,
    'staff',
    'scheduled',
    NULL,
    NULL,
    'pending',
    NULL,
    NULL,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
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
