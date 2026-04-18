# 앱 심사용 테스트 계정 + 데모 데이터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App Store / Google Play 심사 제출용 데모 계정 3종(staff/employer/admin)과 핵심 기능 데모 데이터를 단일 마이그레이션으로 시드하고, 심사 제출용 문서를 생성한다.

**Architecture:** Supabase 마이그레이션 1개에 4부 구조(auth → public.users → 데모 데이터 → 멱등성)로 시드. 모든 ID는 deterministic UUID, 시간 기반 데이터는 `NOW() + interval`로 동적 계산. 심사 제출용 문서는 한/영 병기.

**Tech Stack:** Supabase (auth + PostgreSQL), MCP `apply_migration` (메모리 룰), 기존 `e2e/scripts/seedSupabase.ts` 검증 스크립트 패턴.

**Spec:** `docs/superpowers/specs/2026-04-19-app-review-test-accounts-design.md`

---

## 고정 UUID (전체 작업에서 공유)

```
staff_user_id     = 'a1111111-1111-4111-a111-111111111111'
employer_user_id  = 'b2222222-2222-4222-b222-222222222222'
admin_user_id     = 'c3333333-3333-4333-c333-333333333333'
extra_applicant_id= 'd4444444-4444-4444-d444-444444444444'  -- employer_application 신청자

posting_active_id     = '10000001-0000-4000-a000-000000000001'  -- 강남
posting_urgent_id     = '10000002-0000-4000-a000-000000000002'  -- 분당
posting_closed_id     = '10000003-0000-4000-a000-000000000003'  -- 홍대

application_pending_id   = '20000001-0000-4000-a000-000000000001'
application_confirmed_id = '20000002-0000-4000-a000-000000000002'

worklog_past_id   = '30000001-0000-4000-a000-000000000001'
worklog_future_id = '30000002-0000-4000-a000-000000000002'

board_post_staff_id     = '40000001-0000-4000-a000-000000000001'
board_post_employer_id  = '40000002-0000-4000-a000-000000000002'

template_weekend_id     = '50000001-0000-4000-a000-000000000001'
employer_application_id = '60000001-0000-4000-a000-000000000001'
```

> 댓글/알림은 동일 prefix(70000001…, 80000001…)로 확장.

---

## File Structure

| 파일 | 작업 | 책임 |
|------|------|------|
| `uniqn-mobile/supabase/migrations/20260419HHMMSS_seed_app_review_accounts.sql` | 신규 | 4부 구조 시드 마이그레이션 |
| `docs/app-review/review-test-accounts.md` | 신규 | 심사 제출용 데모 가이드 (한/영) |
| `uniqn-mobile/e2e/scripts/seedSupabase.ts` | 수정 | `SUPABASE_QA_ACCOUNTS`에 review-* 3개 추가 |

---

## Task 1: 스키마 조사 (read-only)

**Files:** 없음

**목적:** 마이그레이션 작성 전 9개 테이블의 컬럼/제약/트리거를 정확히 파악한다.

- [ ] **Step 1.1: 핵심 테이블 컬럼 조회**

Run:
```
mcp__supabase__list_tables schemas=["public"]
```
Expected: `users`, `job_postings`, `applications`, `work_logs`, `board_posts`, `board_comments`, `notifications`, `job_posting_templates`, `employer_applications` 9개 테이블.

각 테이블의 컬럼명/타입/NOT NULL/DEFAULT 메모.

- [ ] **Step 1.2: 트리거 동작 확인**

Run:
```
mcp__supabase__execute_sql query="SELECT event_object_table, trigger_name, action_statement FROM information_schema.triggers WHERE event_object_schema='public' ORDER BY event_object_table"
```
판단 기록:
```
[ ] application confirmed → work_log: 트리거 자동 / 직접 INSERT
[ ] work_log checked_out → payroll: 트리거 자동 / 직접 INSERT
[ ] application/work_log → notifications: 트리거 자동 + 보조 / 보조만
```

- [ ] **Step 1.3: auth.users / auth.identities NOT NULL 컬럼**

Run:
```
mcp__supabase__execute_sql query="SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='auth' AND table_name IN ('users','identities') ORDER BY table_name, ordinal_position"
```

- [ ] **Step 1.4: handle_new_user 트리거 확인**

Run:
```
mcp__supabase__execute_sql query="SELECT prosrc FROM pg_proc WHERE proname='handle_new_user'"
```
auth.users INSERT 시 public.users 자동 생성 여부 확인 → public.users는 UPSERT.

- [ ] **Step 1.5: plan 파일 하단 "스키마 조사 결과" 섹션에 결과 inline 기록**

커밋 없음 (read-only).

---

## Task 2: 마이그레이션 파일 작성

**Files:**
- Create: `uniqn-mobile/supabase/migrations/20260419HHMMSS_seed_app_review_accounts.sql` (`HHMMSS`는 작성 시점의 시각)

- [ ] **Step 2.1: 파일 헤더 + 롤백 주석**

```sql
-- 20260419HHMMSS_seed_app_review_accounts.sql
-- 앱 심사용 데모 계정 3종 + 핵심 기능 데모 데이터 시드.
-- 멱등성: 모든 INSERT는 ON CONFLICT DO NOTHING (재실행 안전).
-- 시간 데이터: NOW() + interval 으로 동적 계산.
--
-- ROLLBACK (수동):
--   DELETE FROM auth.users WHERE id IN (
--     'a1111111-1111-4111-a111-111111111111',
--     'b2222222-2222-4222-b222-222222222222',
--     'c3333333-3333-4333-c333-333333333333',
--     'd4444444-4444-4444-d444-444444444444'
--   );
--   -- CASCADE로 public.users, applications, work_logs 등 자동 정리
```

- [ ] **Step 2.2: Part 1 — auth.users + auth.identities 4건**

```sql
-- =========================================================================
-- Part 1: auth.users + auth.identities
-- =========================================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000',
   'a1111111-1111-4111-a111-111111111111',
   'authenticated', 'authenticated',
   'review-staff@uniqn.app',
   crypt('Review2026!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
   '{"name":"심사용 스태프"}'::jsonb,
   NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000',
   'b2222222-2222-4222-b222-222222222222',
   'authenticated', 'authenticated',
   'review-employer@uniqn.app',
   crypt('Review2026!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"],"role":"employer"}'::jsonb,
   '{"name":"심사용 구인자"}'::jsonb,
   NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000',
   'c3333333-3333-4333-c333-333333333333',
   'authenticated', 'authenticated',
   'review-admin@uniqn.app',
   crypt('Review2026!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
   '{"name":"심사용 관리자"}'::jsonb,
   NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000',
   'd4444444-4444-4444-d444-444444444444',
   'authenticated', 'authenticated',
   'review-applicant@uniqn.app',
   crypt('Review2026!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"],"role":"staff"}'::jsonb,
   '{"name":"심사용 신청자"}'::jsonb,
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  created_at, updated_at, last_sign_in_at
) VALUES
  (gen_random_uuid(), 'a1111111-1111-4111-a111-111111111111',
   '{"sub":"a1111111-1111-4111-a111-111111111111","email":"review-staff@uniqn.app","email_verified":true}'::jsonb,
   'email', 'review-staff@uniqn.app', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'b2222222-2222-4222-b222-222222222222',
   '{"sub":"b2222222-2222-4222-b222-222222222222","email":"review-employer@uniqn.app","email_verified":true}'::jsonb,
   'email', 'review-employer@uniqn.app', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'c3333333-3333-4333-c333-333333333333',
   '{"sub":"c3333333-3333-4333-c333-333333333333","email":"review-admin@uniqn.app","email_verified":true}'::jsonb,
   'email', 'review-admin@uniqn.app', NOW(), NOW(), NOW()),
  (gen_random_uuid(), 'd4444444-4444-4444-d444-444444444444',
   '{"sub":"d4444444-4444-4444-d444-444444444444","email":"review-applicant@uniqn.app","email_verified":true}'::jsonb,
   'email', 'review-applicant@uniqn.app', NOW(), NOW(), NOW())
ON CONFLICT (provider, provider_id) DO NOTHING;
```

> Task 1.3 결과로 `auth.identities`의 unique 제약이 다르면(예: `(provider, id)`) ON CONFLICT 절 수정.

- [ ] **Step 2.3: Part 2 — public.users UPSERT**

```sql
-- =========================================================================
-- Part 2: public.users (handle_new_user 트리거 자동 생성 row 갱신)
-- =========================================================================

INSERT INTO public.users (id, email, name, role, phone_number, created_at, updated_at)
VALUES
  ('a1111111-1111-4111-a111-111111111111', 'review-staff@uniqn.app',
   '심사용 스태프', 'staff', '+821011110001', NOW(), NOW()),
  ('b2222222-2222-4222-b222-222222222222', 'review-employer@uniqn.app',
   '심사용 구인자', 'employer', '+821022220002', NOW(), NOW()),
  ('c3333333-3333-4333-c333-333333333333', 'review-admin@uniqn.app',
   '심사용 관리자', 'admin', '+821033330003', NOW(), NOW()),
  ('d4444444-4444-4444-d444-444444444444', 'review-applicant@uniqn.app',
   '심사용 신청자', 'staff', '+821044440004', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  phone_number = EXCLUDED.phone_number,
  updated_at = NOW();
```

> Task 1.1 결과로 컬럼명이 다르면(예: `display_name`) 수정.

- [ ] **Step 2.4: Part 3a — job_postings 3건**

```sql
-- =========================================================================
-- Part 3a: job_postings (employer 소유)
-- =========================================================================

INSERT INTO public.job_postings (
  id, employer_id, title, description, location,
  start_date, end_date, recruit_count, status,
  created_at, updated_at
) VALUES
  ('10000001-0000-4000-a000-000000000001',
   'b2222222-2222-4222-b222-222222222222',
   '강남 포커룸 주말 스태프',
   '주말 야간 딜러/플로어 모집. 경력 무관, 친절 교육 제공.',
   '서울 강남구 역삼동',
   (NOW() + INTERVAL '7 days')::date,
   (NOW() + INTERVAL '14 days')::date,
   3, 'active', NOW(), NOW()),
  ('10000002-0000-4000-a000-000000000002',
   'b2222222-2222-4222-b222-222222222222',
   '분당 포커룸 평일 딜러',
   '평일 저녁 딜러 급구. 마감 임박.',
   '경기 성남시 분당구',
   (NOW() + INTERVAL '2 days')::date,
   (NOW() + INTERVAL '5 days')::date,
   2, 'active', NOW(), NOW()),
  ('10000003-0000-4000-a000-000000000003',
   'b2222222-2222-4222-b222-222222222222',
   '홍대 포커룸 단기 알바',
   '주말 단기 모집 (마감).',
   '서울 마포구 서교동',
   (NOW() - INTERVAL '14 days')::date,
   (NOW() - INTERVAL '7 days')::date,
   2, 'closed', NOW() - INTERVAL '20 days', NOW() - INTERVAL '7 days')
ON CONFLICT (id) DO NOTHING;
```

> Task 1.1 결과로 컬럼명/enum 값 다르면(예: `recruit_count` → `total_positions`) 수정.

- [ ] **Step 2.5: Part 3b — applications 2건**

```sql
-- =========================================================================
-- Part 3b: applications (staff → posting1: pending, posting2: confirmed)
-- =========================================================================

INSERT INTO public.applications (
  id, job_posting_id, applicant_id, status,
  applied_at, created_at, updated_at
) VALUES
  ('20000001-0000-4000-a000-000000000001',
   '10000001-0000-4000-a000-000000000001',
   'a1111111-1111-4111-a111-111111111111',
   'pending',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('20000002-0000-4000-a000-000000000002',
   '10000002-0000-4000-a000-000000000002',
   'a1111111-1111-4111-a111-111111111111',
   'confirmed',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
```

> Task 1.2 결과로 confirmed → work_log 자동 생성 트리거 있으면 Step 2.6 Case A, 없으면 Case B.

- [ ] **Step 2.6: Part 3c — work_logs 2건 (트리거에 따라 분기)**

**Case A: 트리거가 work_log 자동 생성**
```sql
UPDATE public.work_logs
SET status = 'checked_out',
    check_in_at  = NOW() - INTERVAL '4 days 8 hours',
    check_out_at = NOW() - INTERVAL '4 days',
    updated_at = NOW()
WHERE application_id = '20000002-0000-4000-a000-000000000002'
  AND check_in_at IS NULL;

INSERT INTO public.work_logs (
  id, application_id, employer_id, staff_id,
  scheduled_start_at, scheduled_end_at, status,
  created_at, updated_at
) VALUES
  ('30000002-0000-4000-a000-000000000002',
   '20000002-0000-4000-a000-000000000002',
   'b2222222-2222-4222-b222-222222222222',
   'a1111111-1111-4111-a111-111111111111',
   NOW() + INTERVAL '3 days 18 hours',
   NOW() + INTERVAL '3 days 26 hours',
   'scheduled', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

**Case B: 트리거 없음 → 직접 INSERT 2건**
```sql
INSERT INTO public.work_logs (
  id, application_id, employer_id, staff_id,
  scheduled_start_at, scheduled_end_at,
  check_in_at, check_out_at, status,
  created_at, updated_at
) VALUES
  ('30000001-0000-4000-a000-000000000001',
   '20000002-0000-4000-a000-000000000002',
   'b2222222-2222-4222-b222-222222222222',
   'a1111111-1111-4111-a111-111111111111',
   NOW() - INTERVAL '4 days 8 hours',
   NOW() - INTERVAL '4 days',
   NOW() - INTERVAL '4 days 8 hours',
   NOW() - INTERVAL '4 days',
   'checked_out',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),
  ('30000002-0000-4000-a000-000000000002',
   '20000002-0000-4000-a000-000000000002',
   'b2222222-2222-4222-b222-222222222222',
   'a1111111-1111-4111-a111-111111111111',
   NOW() + INTERVAL '3 days 18 hours',
   NOW() + INTERVAL '3 days 26 hours',
   NULL, NULL, 'scheduled', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

> 컬럼명(`staff_id` vs `worker_id`, `check_in_at` vs `checked_in_at`)은 실제 스키마에 맞춤.

- [ ] **Step 2.7: Part 3d — board_posts + board_comments**

```sql
-- =========================================================================
-- Part 3d: board_posts (2) + board_comments (4)
-- =========================================================================

INSERT INTO public.board_posts (
  id, author_id, title, body, created_at, updated_at
) VALUES
  ('40000001-0000-4000-a000-000000000001',
   'a1111111-1111-4111-a111-111111111111',
   '포커룸 첫 출근 후기',
   '강남점에서 첫 근무하고 왔어요. 분위기 좋고 팀원들도 친절합니다.',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('40000002-0000-4000-a000-000000000002',
   'b2222222-2222-4222-b222-222222222222',
   '강남 포커룸 정기 채용 안내',
   '매주 주말 스태프 모집 중입니다. 자세한 사항은 공고 참고.',
   NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.board_comments (
  id, post_id, author_id, body, created_at, updated_at
) VALUES
  ('70000001-0000-4000-a000-000000000001',
   '40000001-0000-4000-a000-000000000001',
   'b2222222-2222-4222-b222-222222222222',
   '수고하셨어요! 다음에도 함께해요.',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('70000001-0000-4000-a000-000000000002',
   '40000001-0000-4000-a000-000000000001',
   'a1111111-1111-4111-a111-111111111111',
   '감사합니다 :)',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('70000002-0000-4000-a000-000000000001',
   '40000002-0000-4000-a000-000000000002',
   'a1111111-1111-4111-a111-111111111111',
   '다음 주말 신청합니다!',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('70000002-0000-4000-a000-000000000002',
   '40000002-0000-4000-a000-000000000002',
   'd4444444-4444-4444-d444-444444444444',
   '신규 신청 가능한가요?',
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days')
ON CONFLICT (id) DO NOTHING;
```

> 테이블명/추가 NOT NULL 컬럼(`parent_comment_id` 등)은 실제 스키마에 맞춤.

- [ ] **Step 2.8: Part 3e — notifications + templates + employer_applications**

```sql
-- =========================================================================
-- Part 3e: notifications (9) + job_posting_templates (1) + employer_applications (1)
-- =========================================================================

INSERT INTO public.notifications (id, user_id, type, title, body, read_at, created_at)
VALUES
  -- staff 3건
  ('80000001-0000-4000-a000-000000000001',
   'a1111111-1111-4111-a111-111111111111',
   'application_confirmed', '지원 확정',
   '"분당 포커룸 평일 딜러" 공고에 확정되었습니다.',
   NULL, NOW() - INTERVAL '1 day'),
  ('80000001-0000-4000-a000-000000000002',
   'a1111111-1111-4111-a111-111111111111',
   'new_job_posting', '새 공고 등록',
   '"강남 포커룸 주말 스태프" 공고가 새로 등록되었습니다.',
   NULL, NOW() - INTERVAL '6 hours'),
  ('80000001-0000-4000-a000-000000000003',
   'a1111111-1111-4111-a111-111111111111',
   'board_comment', '게시글 댓글',
   '심사용 구인자님이 회원님의 게시글에 댓글을 남겼습니다.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 days'),
  -- employer 3건
  ('80000002-0000-4000-a000-000000000001',
   'b2222222-2222-4222-b222-222222222222',
   'new_application', '새 지원자',
   '"강남 포커룸 주말 스태프" 공고에 새 지원이 접수되었습니다.',
   NULL, NOW() - INTERVAL '2 days'),
  ('80000002-0000-4000-a000-000000000002',
   'b2222222-2222-4222-b222-222222222222',
   'work_log_completed', '근무 완료',
   '심사용 스태프님이 근무를 완료했습니다.',
   NULL, NOW() - INTERVAL '4 days'),
  ('80000002-0000-4000-a000-000000000003',
   'b2222222-2222-4222-b222-222222222222',
   'payroll_created', '정산 생성',
   '4일 전 근무에 대한 정산이 생성되었습니다.',
   NULL, NOW() - INTERVAL '4 days'),
  -- admin 3건
  ('80000003-0000-4000-a000-000000000001',
   'c3333333-3333-4333-c333-333333333333',
   'employer_application_pending', '신규 employer 신청',
   '심사용 신청자님이 employer 권한을 요청했습니다.',
   NULL, NOW() - INTERVAL '3 days'),
  ('80000003-0000-4000-a000-000000000002',
   'c3333333-3333-4333-c333-333333333333',
   'system', '시스템 점검 안내',
   '주간 정기 점검이 예정되어 있습니다.',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 days'),
  ('80000003-0000-4000-a000-000000000003',
   'c3333333-3333-4333-c333-333333333333',
   'system', '대시보드 업데이트',
   '관리자 대시보드에 신규 통계 위젯이 추가되었습니다.',
   NULL, NOW() - INTERVAL '12 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.job_posting_templates (
  id, user_id, name, description, template_data,
  usage_count, created_at, updated_at
) VALUES
  ('50000001-0000-4000-a000-000000000001',
   'b2222222-2222-4222-b222-222222222222',
   '주말 스태프 모집 템플릿',
   '주말 야간 딜러/플로어 모집용 기본 템플릿',
   '{"title":"주말 스태프 모집","recruit_count":3,"location":"서울 강남구"}'::jsonb,
   2, NOW() - INTERVAL '10 days', NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.employer_applications (
  id, applicant_id, business_name, business_number, phone_number,
  status, created_at, updated_at
) VALUES
  ('60000001-0000-4000-a000-000000000001',
   'd4444444-4444-4444-d444-444444444444',
   '심사용 신규 사업장',
   '123-45-67890',
   '+821044440004',
   'pending', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;
```

> Task 1.1 결과로 `notifications.type` enum 값 / `job_posting_templates` / `employer_applications` 컬럼명 다르면 수정.

- [ ] **Step 2.9: 커밋 (apply 전)**

```bash
git add uniqn-mobile/supabase/migrations/20260419HHMMSS_seed_app_review_accounts.sql
git commit -m "feat(supabase): 앱 심사용 계정 + 데모 데이터 시드 마이그레이션 추가"
```

---

## Task 3: 마이그레이션 적용

- [ ] **Step 3.1: MCP apply_migration 실행**

Run:
```
mcp__supabase__apply_migration name=seed_app_review_accounts query=<Step 2의 전체 SQL>
```
Expected: `success: true`.

> 메모리 룰: `supabase db push` 금지.

- [ ] **Step 3.2: 적용 확인**

Run:
```
mcp__supabase__list_migrations
```
Expected: 최신 항목에 `seed_app_review_accounts`.

- [ ] **Step 3.3: 실패 시 롤백 + 재시도**

```
mcp__supabase__execute_sql query="DELETE FROM auth.users WHERE id IN ('a1111111-1111-4111-a111-111111111111','b2222222-2222-4222-b222-222222222222','c3333333-3333-4333-c333-333333333333','d4444444-4444-4444-d444-444444444444')"
```
SQL 수정 후 Step 3.1 재시도.

---

## Task 4: 검증

- [ ] **Step 4.1: 4개 계정 확인**

Run:
```
mcp__supabase__execute_sql query="SELECT id, email, raw_app_meta_data->>'role' AS role FROM auth.users WHERE email LIKE 'review-%@uniqn.app' ORDER BY email"
```
Expected: 4행.

- [ ] **Step 4.2: 데모 데이터 카운트**

Run:
```
mcp__supabase__execute_sql query="
SELECT 'job_postings' AS tbl, COUNT(*) AS n FROM public.job_postings WHERE id::text LIKE '1000000_-%'
UNION ALL SELECT 'applications', COUNT(*) FROM public.applications WHERE id::text LIKE '2000000_-%'
UNION ALL SELECT 'work_logs', COUNT(*) FROM public.work_logs WHERE id::text LIKE '3000000_-%'
UNION ALL SELECT 'board_posts', COUNT(*) FROM public.board_posts WHERE id::text LIKE '4000000_-%'
UNION ALL SELECT 'board_comments', COUNT(*) FROM public.board_comments WHERE id::text LIKE '7000000_-%'
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications WHERE id::text LIKE '8000000_-%'
UNION ALL SELECT 'templates', COUNT(*) FROM public.job_posting_templates WHERE id::text LIKE '5000000_-%'
UNION ALL SELECT 'employer_applications', COUNT(*) FROM public.employer_applications WHERE id::text LIKE '6000000_-%'
"
```
Expected: postings=3, applications=2, work_logs=2, posts=2, comments=4, notifications=9, templates=1, employer_applications=1.

- [ ] **Step 4.3: e2e seedSupabase.ts에 review-* 추가**

Edit `uniqn-mobile/e2e/scripts/seedSupabase.ts:43-47`:
```ts
const SUPABASE_QA_ACCOUNTS: QaAccount[] = [
  { label: 'staff', email: 'qa-staff@uniqn.test', password: 'TestPass1!', role: 'staff' },
  { label: 'employer', email: 'qa-employer@uniqn.test', password: 'TestPass1!', role: 'employer' },
  { label: 'admin', email: 'qa-admin@uniqn.test', password: 'TestPass1!', role: 'admin' },
  { label: 'review-staff', email: 'review-staff@uniqn.app', password: 'Review2026!', role: 'staff' },
  { label: 'review-employer', email: 'review-employer@uniqn.app', password: 'Review2026!', role: 'employer' },
  { label: 'review-admin', email: 'review-admin@uniqn.app', password: 'Review2026!', role: 'admin' },
];
```

Run:
```bash
cd uniqn-mobile && npx ts-node e2e/scripts/seedSupabase.ts
```
Expected: 6개 모두 `[OK]`.

- [ ] **Step 4.4: 커밋**

```bash
git add uniqn-mobile/e2e/scripts/seedSupabase.ts
git commit -m "test(e2e): review-* 계정 검증 흐름 추가"
```

---

## Task 5: 심사 제출용 문서 작성

- [ ] **Step 5.1: 디렉토리 + 문서 작성**

```bash
mkdir -p docs/app-review
```

`docs/app-review/review-test-accounts.md`:

````markdown
# 앱 심사용 테스트 계정 안내

> App Store Connect / Google Play Console 심사 제출 시 이 문서의 정보를 "심사 메모"란에 첨부.

## 한국어

### 계정 정보
| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 스태프 | review-staff@uniqn.app | Review2026! |
| 구인자 | review-employer@uniqn.app | Review2026! |
| 관리자 | review-admin@uniqn.app | Review2026! |

### 데모 시나리오

**1) 스태프 (review-staff)**
1. 로그인 → "강남 포커룸 주말 스태프" 공고 확인
2. 공고 상세 → "지원하기"
3. 마이페이지 → "내 지원" 탭에서 확정/대기 상태 확인
4. 게시판 → "포커룸 첫 출근 후기" 글에 댓글 작성

**2) 구인자 (review-employer)**
1. 로그인 → 공고 관리에서 모집중 공고 2개 확인
2. "강남 포커룸 주말 스태프" → 지원자 목록 → 승인/거절
3. 정산 탭 → 4일 전 근무 1건 정산 내역 확인
4. 공고 작성 → 템플릿 "주말 스태프 모집 템플릿" 불러오기

**3) 관리자 (review-admin)**
1. 로그인 → 관리자 대시보드 진입
2. "신규 employer 신청" 알림 → 심사용 신청자 승인/거절
3. 통계 → 전체 카운트 확인

### 주의 사항
- 모든 데이터는 데모용. 실제 결제/정산 발생하지 않음
- 테스트 결제는 Apple/Google 샌드박스 계정 필요 (해당 시)

---

## English

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Staff | review-staff@uniqn.app | Review2026! |
| Employer | review-employer@uniqn.app | Review2026! |
| Admin | review-admin@uniqn.app | Review2026! |

### Demo Scenarios

**1) Staff (review-staff)**
1. Sign in → check posting "강남 포커룸 주말 스태프"
2. Posting detail → tap "Apply"
3. My Page → "My Applications" tab
4. Board → leave a comment on "포커룸 첫 출근 후기"

**2) Employer (review-employer)**
1. Sign in → "Postings" tab → 2 active postings
2. "강남 포커룸 주말 스태프" → applicant list → approve/reject
3. "Payroll" tab → 1 settlement from 4 days ago
4. Create posting → load "주말 스태프 모집 템플릿"

**3) Admin (review-admin)**
1. Sign in → admin dashboard
2. "New employer application" → approve/reject
3. Stats → total counts

### Notes
- All data is for demo; no real payment/settlement occurs
- Test payments require Apple/Google sandbox accounts (if applicable)
````

- [ ] **Step 5.2: 커밋**

```bash
git add docs/app-review/review-test-accounts.md
git commit -m "docs(app-review): 심사 제출용 테스트 계정 안내 문서 추가"
```

---

## Task 6: 최종 검증 + Git 정리

- [ ] **Step 6.1: 최종 카운트 재확인** — Task 4.2 SQL 재실행
- [ ] **Step 6.2: Git 상태 확인** — `git log --oneline -5`로 3개 커밋 추가 확인
- [ ] **Step 6.3: 사용자 보고**
  - 마이그레이션 적용 ✓
  - 4개 계정 생성 ✓
  - 데모 데이터 7종 시드 ✓ (각 카운트 명시)
  - 심사 제출 문서: `docs/app-review/review-test-accounts.md` (한/영)
  - 다음 단계: App Store Connect / Google Play Console에 정보 등록

---

## 스키마 조사 결과 (Task 1 산출물 — 2026-04-19 완료)

### public.users 컬럼
- id (uuid, PK, NOT NULL)
- email (text, NOT NULL)
- name (text, NOT NULL)  ← handle_new_user 트리거가 COALESCE 처리
- nickname (text, nullable, UNIQUE)
- phone (text, nullable, UNIQUE)  ← **plan의 `phone_number`와 다름 → `phone` 사용**
- role (user_role enum, NOT NULL, default 'staff')  ← enum: admin/employer/staff
- photo_url (text, nullable)
- phone_verified (boolean, nullable, default false)
- identity_verified (boolean, nullable, default false)
- gender (text, nullable, CHECK IN ['male','female'])
- birth_date (text, nullable)
- region (text, nullable)
- experience_years (int, nullable)
- career / note (text, nullable)
- terms_agreed / privacy_agreed / marketing_agreed (bool, nullable, default false)
- bubble_score (jsonb, nullable, default {score:50,...})
- status (text, nullable, default 'active')
- profile_completed / is_active (bool, nullable)
- fcm_tokens (jsonb, nullable, default {})
- created_at / updated_at (timestamptz, nullable, default now())

### public.job_postings 컬럼
- id (uuid, PK, NOT NULL, default gen_random_uuid())
- schema_version (int, nullable, default 3)
- title (text, NOT NULL)
- description (text, nullable)
- status (posting_status enum, NOT NULL, default 'draft')  ← enum: draft/pending/approved/active/closed/cancelled/expired/rejected
- owner_id (uuid, nullable)  ← **plan의 `employer_id`와 다름 → `owner_id` 사용**
- owner_name (text, nullable)
- posting_type (posting_type enum, nullable, default 'regular')
- work_date (text, nullable)
- work_dates (text[], nullable)
- last_work_date (date, nullable)
- role_keys (text[], nullable)
- total_positions (int, nullable, default 0)  ← **plan의 `recruit_count`와 다름 → `total_positions` 사용**
- filled_positions (int, nullable, default 0)
- view_count (int, nullable, default 0)
- stats (jsonb, nullable)
- location (jsonb, NOT NULL, default {})  ← **plan의 `location text`와 다름 → jsonb**
- schedule (jsonb, NOT NULL, default {})
- role_catalog / compensation / questions (jsonb, nullable)
- contact_phone (text, nullable)
- closed_at (timestamptz, nullable)
- created_at / updated_at (timestamptz, nullable, default now())

### public.applications 컬럼
- id (uuid, PK, NOT NULL, default gen_random_uuid())
- applicant_id (uuid, NOT NULL)
- job_posting_id (uuid, NOT NULL)
- status (application_status enum, NOT NULL, default 'applied')  ← enum: applied/confirmed/rejected/cancelled/completed/cancellation_pending
- applicant_name (text, NOT NULL)  ← **시드 시 필수 제공 필요**
- applicant_phone / applicant_email / applicant_nickname / applicant_photo_url (text, nullable)
- applicant_role (staff_role enum, nullable)
- job_posting_title / job_posting_date / recruitment_type (text, nullable)
- message (text, nullable)
- assignments / confirmation_history (jsonb, nullable)
- processed_by / processed_at / confirmed_at / cancelled_at (nullable)
- is_read (bool, nullable, default false)
- created_at / updated_at (timestamptz, nullable, default now())
- **plan의 `applied_at` 컬럼 없음 → 삭제**

### public.work_logs 컬럼
- id (uuid, PK, NOT NULL, default gen_random_uuid())
- staff_id (uuid, NOT NULL)  ← **plan과 동일**
- job_posting_id (uuid, NOT NULL)  ← **plan의 `employer_id` 없음 → 사용 불가**
- application_id (uuid, nullable)
- date (text, NOT NULL)  ← **YYYY-MM-DD 문자열, NOT NULL**
- status (work_log_status enum, NOT NULL, default 'scheduled')  ← enum: scheduled/checked_in/checked_out/completed/cancelled/no_show
- role (staff_role enum, NOT NULL, default 'staff')  ← **NOT NULL 주의**
- check_in_time / check_out_time (jsonb, nullable)  ← **timestamptz 아님, jsonb**
- payroll_status (payroll_status enum, nullable, default 'pending')  ← enum: pending/completed/failed
- payroll_amount (numeric, nullable)
- payroll_date (timestamptz, nullable)
- staff_name / staff_nickname / staff_photo_url (text, nullable)
- time_slot (text, nullable)
- owner_id (uuid, nullable)
- created_at / updated_at (timestamptz, nullable, default now())
- **plan의 `employer_id`, `scheduled_start_at`, `scheduled_end_at`, `check_in_at`, `check_out_at` 모두 없음**

### public.board_posts 컬럼
- id (text, PK, NOT NULL, default gen_random_uuid()::text)  ← **uuid가 아닌 text**
- board_type (board_type enum, NOT NULL, default 'free')
- source (text, nullable, default 'board')
- title (text, NOT NULL)
- body (text, NOT NULL)
- author_id (uuid, nullable)
- author_name (text, NOT NULL)  ← **시드 시 필수**
- author_role (text, NOT NULL)  ← **시드 시 필수**
- visibility (text, nullable, default 'public')
- status (text, nullable, default 'active')
- like_count / dislike_count / comment_count / view_count (int, nullable, default 0)
- image_attachments (jsonb, nullable, default [])
- created_at / updated_at (timestamptz, nullable, default now())

### public.board_comments 컬럼
- id (uuid, PK, NOT NULL, default gen_random_uuid())
- post_id (text, NOT NULL)  ← **board_posts.id가 text이므로 text FK**
- parent_comment_id (uuid, nullable)
- body (text, NOT NULL)
- author_id (uuid, nullable)
- author_name (text, NOT NULL)  ← **시드 시 필수**
- author_role (text, NOT NULL)  ← **시드 시 필수**
- mentioned_user_ids (text[], nullable, default {})
- reaction_counts (jsonb, nullable, default {})
- is_pinned (bool, nullable, default false)
- status (text, nullable, default 'active')
- created_at / updated_at (timestamptz, nullable, default now())
- **XSS 트리거 존재** — INSERT/UPDATE 시 body 검사

### public.notifications 컬럼
- id (uuid, PK, NOT NULL, default gen_random_uuid())
- recipient_id (uuid, NOT NULL)  ← **plan의 `user_id`와 다름 → `recipient_id` 사용**
- type (text, NOT NULL)
- category (notification_category enum, nullable)
- title (text, NOT NULL)
- body (text, NOT NULL)
- link (text, nullable)
- data (jsonb, nullable)
- is_read (bool, nullable, default false)
- priority (text, nullable, default 'normal')
- read_at (timestamptz, nullable)
- created_at (timestamptz, nullable, default now())
- **updated_at 없음** (plan과 다름)
- **on_notification_created, on_notification_created_send_push 트리거** — INSERT 시 push 발화

### public.job_posting_templates 컬럼
- id (uuid, PK, NOT NULL, default gen_random_uuid())
- user_id (uuid, NOT NULL)
- name (text, NOT NULL)
- template_data (jsonb, NOT NULL, default {})
- usage_count (int, NOT NULL, default 0)
- description (text, nullable)
- created_at / updated_at (timestamptz, nullable, default now())
- **plan과 일치** (description 컬럼 2026-04-18 추가 확인됨)

### public.employer_applications 컬럼
- id (uuid, PK, NOT NULL, default gen_random_uuid())
- user_id (uuid, NOT NULL)  ← **plan의 `applicant_id`와 다름 → `user_id` 사용**
- status (text, NOT NULL)  ← enum 아님, text. 값: pending/approved/rejected
- submitted_at (timestamptz, NOT NULL, default now())
- reviewed_at / reviewed_by (nullable)
- rejection_reason / rejection_category (text, nullable)
- agreements_snapshot (jsonb, NOT NULL)  ← **NOT NULL, 기본값 없음 → 시드 시 제공 필수**
- supersedes_id (uuid, nullable)
- created_at (timestamptz, nullable, default now())
- **plan의 `business_name`, `business_number`, `phone_number` 컬럼 없음 → agreements_snapshot jsonb에 포함**

---

### 트리거 동작 결정

- **application confirmed → work_log 자동 생성: 아니오** → Step 2.6 **Case B** 적용 (직접 INSERT 2건)
  - `tr_sync_application_completion`은 work_log→application 방향 (역방향)
  - application INSERT/UPDATE 시 work_log 자동 생성 트리거 없음

- **work_log checked_out → payroll 자동 생성: 아니오** → 별도 payroll 테이블 없음
  - payroll은 work_log 내 `payroll_status/payroll_amount/payroll_date` 컬럼으로 인라인 관리
  - `protect_work_log_payroll_columns` 트리거: staff는 payroll 컬럼 직접 변경 불가 (service_role은 허용)

- **application/work_log INSERT → notifications 자동 발화: 예**
  - applications INSERT → `application_notify_insert` (notify_on_application_insert) → employer에게 notification INSERT
  - applications UPDATE → `application_notify_update` (notify_on_application_update) → 상태별 분기
  - work_logs INSERT → `work_log_notify_insert` (notify_on_work_log_insert) → staff에게 근무 배정 notification INSERT
  - work_logs INSERT → `tr_notify_schedule_created` (fn_notify_schedule_created) 중복 트리거도 존재
  - **결론: notifications 시드 시 applications/work_logs INSERT가 자동으로 notifications를 발생시킴**
  - **→ notifications 직접 시드 9건 추가 시 중복 발생 가능. 단, 마이그레이션 실행 컨텍스트(service_role)이고 시드 notifications는 다른 type으로 삽입하므로 기능상 무해. notifications 9건 그대로 시드.**

### auth.identities 제약

- PK: `PRIMARY KEY (id)` (id는 uuid, default gen_random_uuid())
- UNIQUE: `UNIQUE (provider_id, provider)` ← 제약명 `identities_provider_id_provider_unique`
- **ON CONFLICT 절 수정**: plan의 `ON CONFLICT (provider, provider_id)` → `ON CONFLICT (provider_id, provider)` 순서 변경 필요
  - 단, ON CONFLICT 절에는 컬럼 순서가 실제 constraint 정의와 일치해야 함
  - 안전한 대안: `ON CONFLICT ON CONSTRAINT identities_provider_id_provider_unique DO NOTHING`

### handle_new_user 트리거

- 존재: `INSERT INTO public.users (id, email, name, role) VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(meta->>'name',''), COALESCE(role::user_role,'staff'))`
- **결론**: auth.users INSERT 시 public.users 자동 생성됨 → Step 2.3 UPSERT (ON CONFLICT DO UPDATE) 사용
- `name` 컬럼: handle_new_user가 빈 문자열('')로 채우므로, UPSERT로 실제 이름으로 갱신 필요
- `phone` 컬럼: handle_new_user가 INSERT하지 않으므로, UPSERT 시 phone 업데이트로 추가 가능

### 컬럼명 차이 요약 (Task 2에서 수정 필요)

| plan 컬럼명 | 실제 컬럼명 | 테이블 |
|------------|------------|--------|
| `phone_number` | `phone` | public.users |
| `employer_id` | `owner_id` | job_postings |
| `recruit_count` | `total_positions` | job_postings |
| `location` (text) | `location` (jsonb) | job_postings |
| `start_date/end_date` | 없음 (work_date/work_dates/last_work_date) | job_postings |
| `applied_at` | 없음 | applications |
| `employer_id` | 없음 (`owner_id`는 job_postings에) | work_logs |
| `scheduled_start_at/end_at` | 없음 (date text + time_slot text) | work_logs |
| `check_in_at/check_out_at` | `check_in_time/check_out_time` (jsonb) | work_logs |
| `user_id` | `recipient_id` | notifications |
| `applicant_id` | `user_id` | employer_applications |
| `business_name/number/phone_number` | 없음 (agreements_snapshot jsonb) | employer_applications |
