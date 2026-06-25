-- ============================================================
-- create_review RPC + (work_log_id, reviewer_type) UNIQUE 회귀 테스트
-- ============================================================
-- 목적: 평점 복구(Task 1) — 쓰기 경로(create_review SECURITY DEFINER RPC)와
--       멱등 제약을 검증한다. prod 의 reviews 0행 회귀(쓰기 RPC 부재 42883)를 가드.
--
-- 자기완결(self-contained): seed 헬퍼(jpc_test_seed)는 random uuid 를 생성하므로
--   상위 어서션이 참조할 수 없다. 따라서 FK 체인을 고정 로컬 uuid 로 직접 시드한다.
--   순서: auth.users → public.users → workspaces → job_postings → applications → work_logs.
--   (패턴 출처: supabase/tests/cancel_application_atomically.test.sql)
--
-- 호출자 바인딩: create_review 는 auth.uid()=reviewer 를 강제하므로
--   request.jwt.claims.sub 를 reviewer(staff) 로 주입한다.
--
-- bubble_score: reviewee 를 default(score 50) 로 두고 positive 리뷰 1건 후
--   score 51.0 / totalReviewCount 1 / positiveCount 1 을 검증(점수식 SSOT = src/types/review.ts).
--
-- 안전: BEGIN/ROLLBACK 으로 격리.
-- ============================================================

BEGIN;
SELECT plan(12);

-- ── 고정 로컬 uuid (자기완결 시드) ──────────────────────────────────────────
--   reviewer  = staff  (applications.applicant_id, work_logs.staff_id)
--   reviewee  = employer/owner (workspaces.owner_id, job_postings.owner_id, work_logs.owner_id)
DO $$
BEGIN
  -- auth.users (handle_new_user 트리거가 public.users 자동 생성 가능)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001', 'review_test_staff@test.local',    '{"role":"staff"}'::jsonb,    '{"name":"리뷰어"}'::jsonb, now(), now()),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'review_test_employer@test.local', '{"role":"employer"}'::jsonb, '{"name":"대상자"}'::jsonb, now(), now());

  -- public.users 명시 INSERT (CI 트리거 미작동 대비). bubble_score 미지정 → 컬럼 DEFAULT(score 50).
  INSERT INTO public.users (id, email, name, role, is_active, created_at, updated_at)
  VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001', 'review_test_staff@test.local',    '리뷰어',  'staff'::user_role,    true, now(), now()),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'review_test_employer@test.local', '대상자',  'employer'::user_role, true, now(), now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES ('cccccccc-0000-4000-8000-000000000003', 'review test ws', 'bbbbbbbb-0000-4000-8000-000000000002', now(), now());

  INSERT INTO public.job_postings (
    id, owner_id, workspace_id, title, total_positions, filled_positions, status, created_at, updated_at
  )
  VALUES (
    'dddddddd-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000002',
    'cccccccc-0000-4000-8000-000000000003', 'review test posting', 3, 0, 'active', now(), now()
  );

  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at
  )
  VALUES (
    'eeeeeeee-0000-4000-8000-000000000005', 'dddddddd-0000-4000-8000-000000000004',
    'aaaaaaaa-0000-4000-8000-000000000001', '리뷰어', 'applied', now(), now()
  );

  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, owner_id, date, status, role, created_at, updated_at
  )
  VALUES (
    'ffffffff-0000-4000-8000-000000000006', 'eeeeeeee-0000-4000-8000-000000000005',
    'aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000004',
    'bbbbbbbb-0000-4000-8000-000000000002', '2026-06-20', 'scheduled', 'staff', now(), now()
  );
END $$;

-- 호출자 바인딩: reviewer(staff) 로 행세
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);

-- (1) 함수 존재
SELECT has_function('public', 'create_review', 'create_review RPC 존재');

-- (2) anon 실행 불가 (보안 하드닝: SECDEF RPC 는 anon REVOKE)
SELECT ok(
  NOT has_function_privilege('anon',
    'public.create_review(uuid,uuid,text,text,uuid,text,text,uuid,text,public.review_sentiment,text[],text)',
    'EXECUTE'),
  'anon 은 create_review 실행 불가');

-- (3) 신규 작성 → 예외 없이 성공
SELECT lives_ok($$
  SELECT public.create_review(
    'ffffffff-0000-4000-8000-000000000006'::uuid, -- work_log_id
    'dddddddd-0000-4000-8000-000000000004'::uuid, -- job_posting_id
    'review test posting', '2026-06-20',
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid, '리뷰어',  -- reviewer (staff)
    'staff',
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid, '대상자',  -- reviewee (employer)
    'positive'::public.review_sentiment, ARRAY['punctual'], NULL)
$$, '신규 리뷰 작성 성공');

-- (4) reviews 1행 생성
SELECT is(
  (SELECT count(*)::int FROM public.reviews WHERE work_log_id = 'ffffffff-0000-4000-8000-000000000006'),
  1, 'reviews 1행 생성');

-- (5) 피평가자 bubble_score score 50→51 (positive +1)
SELECT is(
  (SELECT (bubble_score->>'score')::numeric FROM public.users WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  51.0, '버블점수 50→51(positive +1.0)');

-- (6) totalReviewCount 0→1
SELECT is(
  (SELECT (bubble_score->>'totalReviewCount')::int FROM public.users WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  1, 'totalReviewCount 0→1');

-- (7) positiveCount 0→1
SELECT is(
  (SELECT (bubble_score->>'positiveCount')::int FROM public.users WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  1, 'positiveCount 0→1');

-- (8) 동일 (work_log, reviewer_type) 재호출 멱등 — 중복/점수 재반영 없음
SELECT public.create_review(
  'ffffffff-0000-4000-8000-000000000006'::uuid, 'dddddddd-0000-4000-8000-000000000004'::uuid,
  'review test posting', '2026-06-20',
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid, '리뷰어', 'staff',
  'bbbbbbbb-0000-4000-8000-000000000002'::uuid, '대상자',
  'positive'::public.review_sentiment, ARRAY['punctual'], NULL) AS reidempotent_id;
SELECT is(
  (SELECT count(*)::int FROM public.reviews WHERE work_log_id = 'ffffffff-0000-4000-8000-000000000006'),
  1, '재호출 멱등(중복 미생성)');

-- (9) 멱등 점수 불변 — 재호출 후에도 score 51.0 유지 (early-RETURN 의 무-이중가산 보장)
SELECT is(
  (SELECT (bubble_score->>'score')::numeric FROM public.users WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  51.0, '재호출 후 score 51.0 유지(이중 가산 없음)');

-- (10) 멱등 카운트 불변 — totalReviewCount 1 유지
SELECT is(
  (SELECT (bubble_score->>'totalReviewCount')::int FROM public.users WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  1, '재호출 후 totalReviewCount 1 유지');

-- (11) unauthorized_reviewer 가드: auth.uid() != p_reviewer_id → 거부
--   jwt sub 를 reviewer 가 아닌 타인(reviewee)으로 위조. 가드가 INSERT 전에 발동.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-0000-4000-8000-000000000002', 'role', 'authenticated')::text, true);
SELECT throws_ok($$
  SELECT public.create_review(
    'ffffffff-0000-4000-8000-000000000006'::uuid, 'dddddddd-0000-4000-8000-000000000004'::uuid,
    'review test posting', '2026-06-20',
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid, '리뷰어', 'staff',
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid, '대상자',
    'positive'::public.review_sentiment, ARRAY['punctual'], NULL)
$$, 'P0001', 'unauthorized_reviewer', 'unauthorized_reviewer: 비-reviewer 호출 거부');

-- jwt 복귀: 실제 reviewer(staff) — 이후 auth 가드 통과 보장
SELECT set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-4000-8000-000000000001', 'role', 'authenticated')::text, true);

-- (12) invalid_reviewer_type 가드: auth 통과(sub=reviewer) 후 type='admin' → 거부
SELECT throws_ok($$
  SELECT public.create_review(
    'ffffffff-0000-4000-8000-000000000006'::uuid, 'dddddddd-0000-4000-8000-000000000004'::uuid,
    'review test posting', '2026-06-20',
    'aaaaaaaa-0000-4000-8000-000000000001'::uuid, '리뷰어', 'admin',
    'bbbbbbbb-0000-4000-8000-000000000002'::uuid, '대상자',
    'positive'::public.review_sentiment, ARRAY['punctual'], NULL)
$$, 'P0001', 'invalid_reviewer_type', 'invalid_reviewer_type: employer/staff 외 거부');

SELECT * FROM finish();
ROLLBACK;
