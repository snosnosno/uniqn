# JPC 후속 테스트 인프라 구현 플랜 (PR #88 follow-up)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #88 (`f6e13c2a9` — job_posting_collaborators) 의 deferred 후속 작업. pg_prove 기반 RLS 매트릭스 80 케이스 + cascade/trigger 10 케이스 + Repository/Hook Jest + E2E smoke 3 + CI 통합을 단일 PR 로 출하한다.

**Architecture:**
- **SQL 레이어**: 신규 pgTAP 기반 테스트 (`supabase/tests/jpc_*.test.sql`). Supabase CLI 가 번들하는 pgTAP/pg_prove 사용. 기존 DO$$ 패턴은 그대로 두고, 새 테스트만 pgTAP 도입.
- **TS 레이어**: 기존 jest-expo preset 위에 Repository(`__tests__/`) + Hook(`__tests__/`) 신규 파일 추가. Supabase 클라이언트 mock 패턴은 기존 `JobPostingRepository.workspace.editor.test.ts` 답습.
- **E2E 레이어**: 기존 Playwright 인프라(`uniqn-mobile/e2e/`) 위에 p1-important 3 specs 추가. `helpers/supabase-admin.ts` 의 service_role 시딩 패턴 그대로 사용.
- **CI 레이어**: 신규 `db-tests.yml` workflow (pg_prove 전용). 기존 `e2e.yml` 패턴 답습 (supabase/setup-cli@v1 → supabase start → supabase test db → supabase stop).

**Tech Stack:** pgTAP (Supabase 번들), pg_prove (Supabase CLI 내장 `supabase test db`), Jest 29 + jest-expo, TanStack Query mock, Playwright, supabase/setup-cli@v1.

---

## File Structure

### 신규 파일

| 경로 | 책임 |
|---|---|
| `uniqn-mobile/supabase/tests/jpc_helpers.sql` | pgTAP 헬퍼 — 4 페르소나 셋업 + JWT 클레임 스위치 |
| `uniqn-mobile/supabase/tests/jpc_workspaces_rls.test.sql` | workspaces 4×4=16 케이스 |
| `uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql` | job_postings 4×4=16 케이스 |
| `uniqn-mobile/supabase/tests/jpc_applications_rls.test.sql` | applications 4×4=16 케이스 |
| `uniqn-mobile/supabase/tests/jpc_work_logs_rls.test.sql` | work_logs 4×4=16 케이스 |
| `uniqn-mobile/supabase/tests/jpc_event_qr_codes_rls.test.sql` | event_qr_codes 4×4=16 케이스 |
| `uniqn-mobile/supabase/tests/jpc_cascade.test.sql` | cascade/trigger 10 케이스 |
| `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingCollaboratorRepository.test.ts` | Repository 단위 테스트 |
| `uniqn-mobile/src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx` | Hook 테스트 (TanStack + Realtime mock) |
| `uniqn-mobile/src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx` | Hook 테스트 |
| `uniqn-mobile/e2e/tests/p1-important/employer-collaborator-add.spec.ts` | E2E: owner 가 collaborator 추가 |
| `uniqn-mobile/e2e/tests/p1-important/collaborator-shared-postings.spec.ts` | E2E: collaborator 시점 공유받은 공고 표시 |
| `uniqn-mobile/e2e/tests/p1-important/collaborator-self-leave.spec.ts` | E2E: collaborator 자가 나가기 |
| `.github/workflows/db-tests.yml` | pg_prove CI |

### 수정 파일

| 경로 | 변경 |
|---|---|
| `uniqn-mobile/e2e/helpers/supabase-admin.ts` | `SUPABASE_QA_ACCOUNTS.collaborator` 추가 (선택) |
| `uniqn-mobile/package.json` | `npm run test:db` 스크립트 추가 |

---

## 사전 작업 (Pre-Task)

### Pre-1: 워크트리 진입 + 의존성 설치

- [ ] **Step 1: superpowers:using-git-worktrees 로 워크트리 생성**

브랜치명 `feat/job-posting-collaborators-tests`, base `origin/master` (PR #88 머지 SHA `f6e13c2a9` 포함).

- [ ] **Step 2: node_modules 설치 (background)**

```powershell
cd uniqn-mobile
npm install --no-audit --no-fund
```

`run_in_background: true` 권장. 다른 작업과 병행.

- [ ] **Step 3: Supabase CLI 확인**

```bash
supabase --version
```

기대: `2.x.x` 이상. 없으면 `npm install -g supabase` 또는 `scoop install supabase`.

- [ ] **Step 4: 로컬 Supabase 부팅**

```bash
cd uniqn-mobile
supabase start
```

기대: API/DB/Studio URL 출력. 마이그레이션 자동 적용 (20260515000000~080000 포함).

- [ ] **Step 5: pgTAP 확장 확인**

```bash
supabase db inspect --schema extensions
```

`pgtap` 가 활성화되어야 함. 누락 시 별도 마이그레이션 추가 필요.

```sql
-- 만약 pgtap 미설치라면:
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
```

- [ ] **Step 6: 커밋**

워크트리 진입 + 환경 확인은 커밋 불필요. Step 7 부터 코드 변경 시작.

---

## Phase 1: pgTAP 헬퍼 + 인프라

### Task 1.1: pgTAP 헬퍼 작성

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_helpers.sql`

**의도:** 4 페르소나(owner / ws_editor / collaborator / outsider) seed + JWT 클레임 스위치 + cleanup 패턴을 함수로 표준화. 80 + 10 케이스에서 재사용.

- [ ] **Step 1: 헬퍼 SQL 작성**

```sql
-- uniqn-mobile/supabase/tests/jpc_helpers.sql
-- pgTAP RLS 테스트 헬퍼 — JPC 후속 PR
-- 메모리 학습: pitfall_rls_dynamic_verification_sparse_data — matching row count 사전 측정 필수
--             pitfall_test_seed_zod_schema_first — JSONB raw INSERT 함정 회피

-- ============================================================================
-- 4 페르소나 + 리소스 셋업 (트랜잭션 안에서만 호출, ROLLBACK 로 정리)
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_test_seed()
RETURNS TABLE (
  owner_id        uuid,
  ws_editor_id    uuid,
  collaborator_id uuid,
  outsider_id     uuid,
  workspace_id    uuid,
  job_posting_id  uuid,
  application_id  uuid,
  work_log_id     uuid,
  qr_code_id      uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner       uuid := gen_random_uuid();
  v_editor      uuid := gen_random_uuid();
  v_collab      uuid := gen_random_uuid();
  v_outsider    uuid := gen_random_uuid();
  v_ws          uuid := gen_random_uuid();
  v_jp          uuid := gen_random_uuid();
  v_app         uuid := gen_random_uuid();
  v_wl          uuid := gen_random_uuid();
  v_qr          uuid := gen_random_uuid();
  v_work_date   date := current_date + 14;
BEGIN
  -- auth.users (메모리: pitfall_supabase_auth_users_seed — NULL 토큰 회피)
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (v_owner,    'jpc_owner_'    || v_owner    || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_editor,   'jpc_editor_'   || v_editor   || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_collab,   'jpc_collab_'   || v_collab   || '@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''),
    (v_outsider, 'jpc_outsider_' || v_outsider || '@test.local', '{"role":"staff"}'::jsonb,    '{}'::jsonb, now(), now(), '', '', '', '');

  -- public.users 동기화 (실제 트리거가 처리하지만 안전하게 명시)
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  SELECT id, email, 'jpc test', now(), now() FROM auth.users WHERE id IN (v_owner, v_editor, v_collab, v_outsider)
  ON CONFLICT (id) DO NOTHING;

  -- workspace + 멤버
  INSERT INTO public.workspaces (id, name, owner_id, created_at, updated_at)
  VALUES (v_ws, 'jpc test ws', v_owner, now(), now());

  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (v_ws, v_editor, 'editor', now());

  -- job_posting
  INSERT INTO public.job_postings (
    id, owner_id, owner_name, workspace_id, title, status, posting_type,
    work_date, work_dates, total_positions, filled_positions, view_count,
    schema_version, contact_phone, created_at, updated_at
  )
  VALUES (
    v_jp, v_owner, 'jpc owner', v_ws, 'jpc test posting', 'active', 'regular',
    v_work_date, ARRAY[v_work_date], 3, 0, 0, 3, '+82101111111', now(), now()
  );

  -- collaborator 등록
  INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
  VALUES (v_jp, v_collab, v_owner);

  -- application (outsider 가 지원)
  INSERT INTO public.applications (
    id, job_posting_id, applicant_id, applicant_name, status, created_at, updated_at
  )
  VALUES (v_app, v_jp, v_outsider, 'outsider applicant', 'applied', now(), now());

  -- work_log
  INSERT INTO public.work_logs (
    id, application_id, staff_id, job_posting_id, owner_id, date, status, role, created_at, updated_at
  )
  VALUES (v_wl, v_app, v_outsider, v_jp, v_owner, v_work_date, 'scheduled', 'staff', now(), now());

  -- event_qr_code (staff 본인 발급 가정)
  INSERT INTO public.event_qr_codes (
    id, job_posting_id, user_id, qr_token, expires_at, created_at
  )
  VALUES (v_qr, v_jp, v_outsider, encode(gen_random_bytes(16), 'hex'), now() + interval '1 day', now());

  RETURN QUERY SELECT v_owner, v_editor, v_collab, v_outsider, v_ws, v_jp, v_app, v_wl, v_qr;
END;
$$;

-- ============================================================================
-- JWT 클레임 스위치 — Supabase RLS 의 (SELECT auth.uid()) 가 읽는 컨텍스트
-- ============================================================================

CREATE OR REPLACE FUNCTION jpc_test_set_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION jpc_test_set_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
END;
$$;
```

- [ ] **Step 2: 헬퍼 실행 검증 (단독 호출)**

```bash
cd uniqn-mobile
supabase db execute --file supabase/tests/jpc_helpers.sql
```

기대: `CREATE FUNCTION` × 3, 에러 0건. 헬퍼는 `pg_proc` 에 영구 등록 (test 파일에서 `\i jpc_helpers.sql` 대신 함수로 호출).

- [ ] **Step 3: smoke check — seed + role 스위치**

```sql
-- 임시 검증 (다음 명령으로 확인 후 정상이면 진행)
BEGIN;
SELECT * FROM jpc_test_seed();
SELECT jpc_test_set_user('<owner-id-from-above>');
SELECT (SELECT auth.uid()) AS uid;  -- owner_id 와 일치해야 함
ROLLBACK;
```

기대: `auth.uid()` 가 seed 의 owner_id 와 일치. 일치하지 않으면 JWT 클레임 셋업 재검토.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/supabase/tests/jpc_helpers.sql
git commit -m "test(jpc): pgTAP RLS 헬퍼 — 4 페르소나 seed + JWT 클레임 스위치"
```

---

## Phase 2: RLS 매트릭스 (80 케이스)

> **Why 80**: 5 테이블 × 4 페르소나 × 4 작업 (SELECT/INSERT/UPDATE/DELETE). 각 (테이블, 작업, 페르소나) 조합은 명확한 expected (ALLOW/DENY) 가 있다.

> **공통 패턴**: 모든 테스트 파일은 다음 골격을 따른다. 페르소나 별로 RLS 통과 행 수를 `is(count, ...)` 또는 `lives_ok(...)` / `throws_ok(...)` 로 검증.

### Task 2.1: workspaces RLS 매트릭스 (16 케이스)

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_workspaces_rls.test.sql`

**기대 매트릭스** (실제 정책: `workspaces_select_owner_or_member`, INSERT/UPDATE/DELETE 는 owner-only 표준 정책):

| 작업 | owner | ws_editor | collaborator | outsider |
|---|---|---|---|---|
| SELECT | ALLOW (1) | ALLOW (1) | ALLOW (1) — JPC ↔ workspace JOIN | DENY (0) |
| INSERT | ALLOW (별도 ws) | DENY | DENY | DENY |
| UPDATE | ALLOW | DENY | DENY | DENY |
| DELETE | ALLOW | DENY | DENY | DENY |

- [ ] **Step 1: 실패하는 매트릭스 테스트 작성**

```sql
-- uniqn-mobile/supabase/tests/jpc_workspaces_rls.test.sql
-- workspaces 5 테이블 × 4 페르소나 × 4 작업 매트릭스의 1/5

BEGIN;
SELECT plan(16);

-- ============================================================================
-- Seed (모든 테스트 공통)
-- ============================================================================
DO $$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('jpc.ws_id',       s.workspace_id::text, true);
END $$;

-- ============================================================================
-- SELECT (4 케이스)
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  1, 'workspaces SELECT: owner sees 1 row'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  1, 'workspaces SELECT: ws_editor sees 1 row'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  1, 'workspaces SELECT: collaborator sees 1 row (via JP JOIN)'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid),
  0, 'workspaces SELECT: outsider sees 0 rows'
);

-- ============================================================================
-- INSERT (4 케이스) — owner 만 자기 명의로 새 ws 생성 가능
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT lives_ok(
  $insert$ INSERT INTO public.workspaces (name, owner_id) VALUES ('test owner ws', (current_setting('jpc.owner_id'))::uuid) $insert$,
  'workspaces INSERT: owner can create own ws'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT throws_ok(
  $insert$ INSERT INTO public.workspaces (name, owner_id) VALUES ('test editor ws', (current_setting('jpc.editor_id'))::uuid) $insert$,
  '42501', NULL, 'workspaces INSERT: ws_editor denied for new ws (no ws_create policy)'
);
-- 실제 정책에 따라 42501 vs new row violates RLS — adjust based on policy
-- 메모리 학습: pitfall_rls_violation_multi_cause_mapping — multi-cause 가능

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  $insert$ INSERT INTO public.workspaces (name, owner_id) VALUES ('test collab ws', (current_setting('jpc.collab_id'))::uuid) $insert$,
  '42501', NULL, 'workspaces INSERT: collaborator denied'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT throws_ok(
  $insert$ INSERT INTO public.workspaces (name, owner_id) VALUES ('test outsider ws', (current_setting('jpc.outsider_id'))::uuid) $insert$,
  '42501', NULL, 'workspaces INSERT: outsider denied'
);

-- ============================================================================
-- UPDATE (4 케이스) — owner 만 자기 ws 수정 가능
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by owner'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 1, 'workspaces UPDATE: owner can update own ws');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by editor'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 0, 'workspaces UPDATE: ws_editor denied (0 affected)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by collab'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 0, 'workspaces UPDATE: collaborator denied (0 affected)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH upd AS (
  UPDATE public.workspaces SET name = 'updated by outsider'
  WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM upd), 0, 'workspaces UPDATE: outsider denied (0 affected)');

-- ============================================================================
-- DELETE (4 케이스) — owner 만
-- ============================================================================
SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 0, 'workspaces DELETE: ws_editor denied');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 0, 'workspaces DELETE: collaborator denied');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 0, 'workspaces DELETE: outsider denied');

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH del AS (
  DELETE FROM public.workspaces WHERE id = (current_setting('jpc.ws_id'))::uuid RETURNING 1
)
SELECT is((SELECT count(*)::int FROM del), 1, 'workspaces DELETE: owner can delete');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: 실행 → 어떤 결과든 plan(16) 출력 확인**

```bash
cd uniqn-mobile
supabase test db
```

기대: `tests/jpc_workspaces_rls.test.sql ... ok` 또는 일부 실패 (정확한 에러코드/카운트 확인). 정책에 따라 `42501` vs `RLS violation` 코드를 보정.

- [ ] **Step 3: 실패 케이스 디버깅 (정책 실제 동작 확인)**

```sql
-- 실제 ws_id 매칭 행 사전 측정 (메모리: pitfall_rls_dynamic_verification_sparse_data)
SELECT count(*) FROM public.workspaces WHERE id = '<known-ws-id>';
-- → matching row count > 0 임을 사전 확인 후, RLS 차단 검증
```

플랜이 가정한 정책과 실제 정책이 다르면 expected 값을 보정 (예: `INSERT` 가 0 affected vs throws).

- [ ] **Step 4: 매트릭스 16/16 통과 확인**

```bash
supabase test db --tests tests/jpc_workspaces_rls.test.sql
```

기대: `1..16` + `ok 16` + `# All tests successful`.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/supabase/tests/jpc_workspaces_rls.test.sql
git commit -m "test(jpc): workspaces RLS 매트릭스 16 케이스 (4 페르소나 × 4 작업)"
```

### Task 2.2: job_postings RLS 매트릭스 (16 케이스)

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql`

**기대 매트릭스** (실제 정책: `jp_select_managed`, `jp_update_workspace_member`, INSERT 별도 RPC, DELETE owner-only 또는 ws_member):

| 작업 | owner | ws_editor | collaborator | outsider |
|---|---|---|---|---|
| SELECT | ALLOW | ALLOW | ALLOW (helper) | DENY |
| INSERT | ALLOW | ALLOW (ws_member) | DENY | DENY |
| UPDATE | ALLOW | ALLOW (member) | ALLOW (collab) | DENY |
| DELETE | ALLOW | ALLOW (ws_member) | DENY (D2: 풀 관리권만, ws 자체 삭제는 owner) | DENY |

> **Note**: 실제 INSERT 정책은 `create_job_posting_atomically` RPC 안에서만 작동. 직접 INSERT 는 RLS 차단. 따라서 INSERT 케이스는 raw SQL 대신 RPC 호출로 검증.

- [ ] **Step 1: 매트릭스 SQL 작성**

```sql
-- uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql
BEGIN;
SELECT plan(16);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('jpc.jp_id',       s.job_posting_id::text, true);
END $$;

-- SELECT (4 케이스)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
          1, 'job_postings SELECT: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
          1, 'job_postings SELECT: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
          1, 'job_postings SELECT: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.job_postings WHERE id = (current_setting('jpc.jp_id'))::uuid),
          0, 'job_postings SELECT: outsider denied');

-- INSERT (4 케이스) — 직접 INSERT (RPC 미경유, RLS 직접 검증)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT lives_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.owner_id'))::uuid, 'o', (current_setting('jpc.ws_id'))::uuid, 'p1', 'active', 'regular',
            current_date+1, ARRAY[current_date+1], 1, 0, 0, 3, '+82101234567')$$,
  'job_postings INSERT: owner'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
-- editor 가 workspace_id 의 멤버이고 owner_id = self → 통과 기대 (실제 정책 확인 후 조정)
SELECT lives_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.editor_id'))::uuid, 'e', (current_setting('jpc.ws_id'))::uuid, 'p2', 'active', 'regular',
            current_date+1, ARRAY[current_date+1], 1, 0, 0, 3, '+82101234567')$$,
  'job_postings INSERT: ws_editor (workspace 멤버)'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.collab_id'))::uuid, 'c', (current_setting('jpc.ws_id'))::uuid, 'p3', 'active', 'regular',
            current_date+1, ARRAY[current_date+1], 1, 0, 0, 3, '+82101234567')$$,
  '42501', NULL, 'job_postings INSERT: collaborator denied (D2 풀 관리권만, 신규 생성 불가)'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.job_postings (owner_id, owner_name, workspace_id, title, status, posting_type,
                                     work_date, work_dates, total_positions, filled_positions, view_count,
                                     schema_version, contact_phone)
    VALUES ((current_setting('jpc.outsider_id'))::uuid, 'x', (current_setting('jpc.ws_id'))::uuid, 'p4', 'active', 'regular',
            current_date+1, ARRAY[current_date+1], 1, 0, 0, 3, '+82101234567')$$,
  '42501', NULL, 'job_postings INSERT: outsider denied'
);

-- UPDATE (4 케이스)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-owner' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'job_postings UPDATE: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-editor' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'job_postings UPDATE: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-collab' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'job_postings UPDATE: collaborator (D2 풀 관리권)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (UPDATE public.job_postings SET title='u-outsider' WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 0, 'job_postings UPDATE: outsider denied');

-- DELETE (4 케이스) — 실제 정책 확인 후 expected 보정
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (DELETE FROM public.job_postings WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'job_postings DELETE: outsider denied');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (DELETE FROM public.job_postings WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'job_postings DELETE: collaborator denied (자기 풀 관리만, ws 자체 삭제는 owner)');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (DELETE FROM public.job_postings WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 1, 'job_postings DELETE: ws_editor (workspace member)');
-- ws_editor 도 멤버라면 DELETE 가능 — 실제 정책 확인하여 0 vs 1 보정

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH d AS (DELETE FROM public.job_postings WHERE id=(current_setting('jpc.jp_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 1, 'job_postings DELETE: owner');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: 매트릭스 실행 + expected 보정**

```bash
supabase test db --tests tests/jpc_job_postings_rls.test.sql
```

실제 정책과 expected 가 다르면 정책 SQL 을 다시 확인:

```bash
git show origin/master:uniqn-mobile/supabase/migrations/20260515030000_jpc_extend_existing_rls.sql
```

`jp_select_managed`, `jp_update_workspace_member` 의 USING / WITH CHECK 조건을 읽고 expected 보정.

- [ ] **Step 3: 16/16 통과 확인**

```bash
supabase test db --tests tests/jpc_job_postings_rls.test.sql
# 기대: ok 16
```

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql
git commit -m "test(jpc): job_postings RLS 매트릭스 16 케이스"
```

### Task 2.3: applications RLS 매트릭스 (16 케이스)

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_applications_rls.test.sql`

**기대 매트릭스**:

| 작업 | owner | ws_editor | collaborator | outsider (=지원자 본인) |
|---|---|---|---|---|
| SELECT | ALLOW (jp owner) | ALLOW (ws member) | ALLOW (helper) | ALLOW (applicant_id = self) |
| INSERT | ALLOW (자기 명의로 새 지원 가능 — staff role) | DENY | DENY | ALLOW (applicant_id = self) |
| UPDATE | ALLOW | ALLOW | ALLOW | ALLOW (자기 지원 수정/취소) |
| DELETE | DENY (DELETE 정책 미정의 — soft cancel) | DENY | DENY | DENY |

> **주의**: applications.DELETE 는 정책 미정의 (모든 권한 DENY). cancel 은 `cancel_application_atomically` RPC + status='cancelled' 로 처리.

- [ ] **Step 1: 매트릭스 SQL 작성**

```sql
-- uniqn-mobile/supabase/tests/jpc_applications_rls.test.sql
BEGIN;
SELECT plan(16);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('jpc.jp_id',       s.job_posting_id::text, true);
  PERFORM set_config('jpc.app_id',      s.application_id::text, true);
END $$;

-- SELECT (4 케이스) — 모두 ALLOW (applicant 본인 OR JP 관리자)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.applications WHERE id = (current_setting('jpc.app_id'))::uuid),
          1, 'applications SELECT: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.applications WHERE id = (current_setting('jpc.app_id'))::uuid),
          1, 'applications SELECT: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.applications WHERE id = (current_setting('jpc.app_id'))::uuid),
          1, 'applications SELECT: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.applications WHERE id = (current_setting('jpc.app_id'))::uuid),
          1, 'applications SELECT: applicant 본인');

-- INSERT (4 케이스) — applicant_id = self 만 ALLOW
-- outsider 가 자기 명의로 새 지원 (같은 jp 에 또 지원 — UNIQUE 위반 회피용 다른 jp 필요)
-- 단순화를 위해 별도 jp 사전 생성 또는 다른 user 로 INSERT
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
-- 이미 지원한 jp 에 또 지원 → UNIQUE 위반 (RLS 통과 후 무결성 에러) — 두 가지 모두 throws_ok 패스
-- 깔끔하게 별도 jp 시드해서 검증
DO $$
DECLARE v_jp2 uuid := gen_random_uuid();
BEGIN
  -- service_role 로 jp2 생성 (RLS 우회용)
  PERFORM set_config('role', 'service_role', true);
  INSERT INTO public.job_postings (id, owner_id, owner_name, workspace_id, title, status, posting_type,
                                   work_date, work_dates, total_positions, filled_positions, view_count,
                                   schema_version, contact_phone)
  VALUES (v_jp2, (current_setting('jpc.owner_id'))::uuid, 'o2', (current_setting('jpc.ws_id'))::uuid,
          'jp2', 'active', 'regular', current_date+2, ARRAY[current_date+2], 1, 0, 0, 3, '+82109999999');
  PERFORM set_config('jpc.jp2_id', v_jp2::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT lives_ok(
  $$INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status)
    VALUES ((current_setting('jpc.jp2_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid, 'me', 'applied')$$,
  'applications INSERT: outsider 본인 지원 (applicant_id=self)'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status)
    VALUES ((current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid, 'x', 'applied')$$,
  '42501', NULL, 'applications INSERT: collaborator 가 남의 지원 INSERT 차단'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status)
    VALUES ((current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid, 'x', 'applied')$$,
  '42501', NULL, 'applications INSERT: ws_editor 가 남의 지원 INSERT 차단'
);

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status)
    VALUES ((current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid, 'x', 'applied')$$,
  '42501', NULL, 'applications INSERT: owner 가 남의 지원 INSERT 차단 (apply RPC 만 가능)'
);

-- UPDATE (4 케이스) — JP 관리자 OR 본인
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (UPDATE public.applications SET status='confirmed' WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'applications UPDATE: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (UPDATE public.applications SET status='confirmed' WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'applications UPDATE: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (UPDATE public.applications SET status='confirmed' WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'applications UPDATE: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (UPDATE public.applications SET status='confirmed' WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'applications UPDATE: applicant 본인');

-- DELETE (4 케이스) — 모두 DENY (정책 미정의 = 차단)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH d AS (DELETE FROM public.applications WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'applications DELETE: owner (정책 미정의)');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (DELETE FROM public.applications WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'applications DELETE: ws_editor (정책 미정의)');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (DELETE FROM public.applications WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'applications DELETE: collaborator (정책 미정의)');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (DELETE FROM public.applications WHERE id=(current_setting('jpc.app_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'applications DELETE: applicant 본인 (정책 미정의)');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: 실행 + 16/16 통과**

```bash
supabase test db --tests tests/jpc_applications_rls.test.sql
```

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/supabase/tests/jpc_applications_rls.test.sql
git commit -m "test(jpc): applications RLS 매트릭스 16 케이스"
```

### Task 2.4: work_logs RLS 매트릭스 (16 케이스)

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_work_logs_rls.test.sql`

**기대 매트릭스**:

| 작업 | owner | ws_editor | collaborator | outsider (=staff 본인) |
|---|---|---|---|---|
| SELECT | ALLOW (owner_id = self) | ALLOW (ws member) | ALLOW (helper) | ALLOW (staff_id = self) |
| INSERT | service_role 만 (RPC) — 모두 DENY | DENY | DENY | DENY |
| UPDATE | ALLOW | ALLOW | ALLOW | ALLOW (자기 체크인 시간) |
| DELETE | DENY (정책 미정의) | DENY | DENY | DENY |

- [ ] **Step 1: 매트릭스 SQL 작성** (Task 2.3 과 동일 패턴, 테이블/컬럼만 교체)

```sql
-- uniqn-mobile/supabase/tests/jpc_work_logs_rls.test.sql
BEGIN;
SELECT plan(16);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('jpc.wl_id',       s.work_log_id::text, true);
  PERFORM set_config('jpc.jp_id',       s.job_posting_id::text, true);
  PERFORM set_config('jpc.app_id',      s.application_id::text, true);
END $$;

-- SELECT (4 케이스)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid),
          1, 'work_logs SELECT: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid),
          1, 'work_logs SELECT: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid),
          1, 'work_logs SELECT: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid),
          1, 'work_logs SELECT: staff 본인');

-- INSERT (4 케이스) — 모두 DENY (RPC 만 가능, 정책 미정의)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.work_logs (application_id, staff_id, job_posting_id, owner_id, date, status, role)
    VALUES ((current_setting('jpc.app_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid,
            (current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.owner_id'))::uuid,
            current_date+3, 'scheduled', 'staff')$$,
  '42501', NULL, 'work_logs INSERT: owner denied (RPC 전용)'
);

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.work_logs (application_id, staff_id, job_posting_id, owner_id, date, status, role)
    VALUES ((current_setting('jpc.app_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid,
            (current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.owner_id'))::uuid,
            current_date+3, 'scheduled', 'staff')$$,
  '42501', NULL, 'work_logs INSERT: ws_editor denied'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.work_logs (application_id, staff_id, job_posting_id, owner_id, date, status, role)
    VALUES ((current_setting('jpc.app_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid,
            (current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.owner_id'))::uuid,
            current_date+3, 'scheduled', 'staff')$$,
  '42501', NULL, 'work_logs INSERT: collaborator denied'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.work_logs (application_id, staff_id, job_posting_id, owner_id, date, status, role)
    VALUES ((current_setting('jpc.app_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid,
            (current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.owner_id'))::uuid,
            current_date+3, 'scheduled', 'staff')$$,
  '42501', NULL, 'work_logs INSERT: staff denied'
);

-- UPDATE (4 케이스) — 모두 ALLOW
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (UPDATE public.work_logs SET status='checked_in' WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'work_logs UPDATE: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (UPDATE public.work_logs SET status='checked_in' WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'work_logs UPDATE: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (UPDATE public.work_logs SET status='checked_in' WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'work_logs UPDATE: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (UPDATE public.work_logs SET status='checked_in' WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'work_logs UPDATE: staff 본인');

-- DELETE (4 케이스) — 모두 DENY
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH d AS (DELETE FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH d AS (DELETE FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH d AS (DELETE FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (DELETE FROM public.work_logs WHERE id=(current_setting('jpc.wl_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 0, 'work_logs DELETE: staff 본인');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: 실행 + 16/16 통과**

```bash
supabase test db --tests tests/jpc_work_logs_rls.test.sql
```

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/supabase/tests/jpc_work_logs_rls.test.sql
git commit -m "test(jpc): work_logs RLS 매트릭스 16 케이스"
```

### Task 2.5: event_qr_codes RLS 매트릭스 (16 케이스)

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_event_qr_codes_rls.test.sql`

**기대 매트릭스**:

| 작업 | owner | ws_editor | collaborator | outsider (=user_id 본인) |
|---|---|---|---|---|
| SELECT | ALLOW (jp 경유) | ALLOW (jp 경유) | ALLOW (helper) | ALLOW (user_id = self) |
| INSERT | DENY (RPC 만) | DENY | DENY | ALLOW (자기 QR 생성) — 또는 RPC 기반이면 모두 DENY |
| UPDATE | ALLOW (jp 경유) | ALLOW | ALLOW (helper) | ALLOW (user_id=self) |
| DELETE | ALLOW (qr_delete 정책 — jp 관리자) | ALLOW | ALLOW | ALLOW (자기 QR 삭제) |

> 실제 `qr_select`, `qr_update`, `qr_delete` 정책 (마이그레이션 0030) 참조. INSERT 정책이 별도 존재하면 그것을 기준으로 보정.

- [ ] **Step 1: 정책 확인**

```bash
git show origin/master:uniqn-mobile/supabase/migrations/20260515030000_jpc_extend_existing_rls.sql | grep -A 10 "qr_"
```

`qr_select`, `qr_update`, `qr_delete` 의 USING 조건 확인 후 expected 보정.

- [ ] **Step 2: 매트릭스 SQL 작성** (Task 2.4 와 동일 패턴, qr_token 컬럼 사용)

```sql
-- uniqn-mobile/supabase/tests/jpc_event_qr_codes_rls.test.sql
BEGIN;
SELECT plan(16);

DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id',    s.owner_id::text,    true);
  PERFORM set_config('jpc.editor_id',   s.ws_editor_id::text, true);
  PERFORM set_config('jpc.collab_id',   s.collaborator_id::text, true);
  PERFORM set_config('jpc.outsider_id', s.outsider_id::text,  true);
  PERFORM set_config('jpc.qr_id',       s.qr_code_id::text, true);
  PERFORM set_config('jpc.jp_id',       s.job_posting_id::text, true);
END $$;

-- SELECT (4 케이스)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.event_qr_codes WHERE id=(current_setting('jpc.qr_id'))::uuid),
          1, 'event_qr_codes SELECT: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.event_qr_codes WHERE id=(current_setting('jpc.qr_id'))::uuid),
          1, 'event_qr_codes SELECT: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.event_qr_codes WHERE id=(current_setting('jpc.qr_id'))::uuid),
          1, 'event_qr_codes SELECT: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
SELECT is((SELECT count(*)::int FROM public.event_qr_codes WHERE id=(current_setting('jpc.qr_id'))::uuid),
          1, 'event_qr_codes SELECT: user 본인');

-- INSERT (4 케이스) — 실제 정책 따라 보정
-- 예시: user_id = self 만 ALLOW (또는 모두 DENY 가능)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.event_qr_codes (job_posting_id, user_id, qr_token, expires_at)
    VALUES ((current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.owner_id'))::uuid, 'qr-owner', now()+interval '1 day')$$,
  '42501', NULL, 'event_qr_codes INSERT: owner denied (정책 미정의 가정)'
);
-- ↑ 실제 정책 확인 후 lives_ok / throws_ok 보정

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.event_qr_codes (job_posting_id, user_id, qr_token, expires_at)
    VALUES ((current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.editor_id'))::uuid, 'qr-editor', now()+interval '1 day')$$,
  '42501', NULL, 'event_qr_codes INSERT: ws_editor denied'
);

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.event_qr_codes (job_posting_id, user_id, qr_token, expires_at)
    VALUES ((current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.collab_id'))::uuid, 'qr-collab', now()+interval '1 day')$$,
  '42501', NULL, 'event_qr_codes INSERT: collaborator denied'
);

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
-- outsider (=user_id 본인) — 정책에 따라 ALLOW 가능
SELECT lives_ok(
  $$INSERT INTO public.event_qr_codes (job_posting_id, user_id, qr_token, expires_at)
    VALUES ((current_setting('jpc.jp_id'))::uuid, (current_setting('jpc.outsider_id'))::uuid, 'qr-self-' || gen_random_uuid()::text, now()+interval '1 day')$$,
  'event_qr_codes INSERT: user 본인 자기 QR 생성'
);
-- ↑ 정책 미정의면 throws_ok 로 변경

-- UPDATE (4 케이스)
SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
WITH u AS (UPDATE public.event_qr_codes SET qr_token='upd-owner' WHERE id=(current_setting('jpc.qr_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'event_qr_codes UPDATE: owner');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
WITH u AS (UPDATE public.event_qr_codes SET qr_token='upd-editor' WHERE id=(current_setting('jpc.qr_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'event_qr_codes UPDATE: ws_editor');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
WITH u AS (UPDATE public.event_qr_codes SET qr_token='upd-collab' WHERE id=(current_setting('jpc.qr_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'event_qr_codes UPDATE: collaborator');

SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH u AS (UPDATE public.event_qr_codes SET qr_token='upd-self' WHERE id=(current_setting('jpc.qr_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM u), 1, 'event_qr_codes UPDATE: user 본인');

-- DELETE (4 케이스) — qr_delete 정책 사용
SELECT jpc_test_set_user((current_setting('jpc.outsider_id'))::uuid);
WITH d AS (DELETE FROM public.event_qr_codes WHERE id=(current_setting('jpc.qr_id'))::uuid RETURNING 1)
SELECT is((SELECT count(*)::int FROM d), 1, 'event_qr_codes DELETE: user 본인');

SELECT jpc_test_set_user((current_setting('jpc.collab_id'))::uuid);
-- 이미 삭제됨 → seed 재실행 또는 별도 qr 생성. 단순화를 위해 별도 BEGIN/ROLLBACK 으로 분리 가능.
-- 여기서는 row 없음 → 0 affected 가 expected (실제 정책 검증은 별도 qr 시드 필요)
SELECT pass('event_qr_codes DELETE: collaborator (별도 qr 시드 필요 — 추후 보정)');

SELECT jpc_test_set_user((current_setting('jpc.editor_id'))::uuid);
SELECT pass('event_qr_codes DELETE: ws_editor (별도 qr 시드 필요)');

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
SELECT pass('event_qr_codes DELETE: owner (별도 qr 시드 필요)');

SELECT * FROM finish();
ROLLBACK;
```

> **Step 2 보정 노트**: DELETE 케이스는 이미 삭제된 행이라 0 affected 가 가짜 PASS 가 됨. Step 3 에서 4 페르소나용 QR 4 개를 사전 시드하도록 헬퍼 수정 (예: `jpc_test_seed_qr_per_persona()` 추가).

- [ ] **Step 3: DELETE 케이스 보정 (별도 QR 4개 시드)**

`jpc_helpers.sql` 에 추가 또는 test 내 BEGIN-ROLLBACK 분리:

```sql
-- 옵션 A: helpers.sql 에 4 페르소나용 QR 시드 함수 추가
CREATE OR REPLACE FUNCTION jpc_test_seed_qrs(
  p_jp_id uuid, p_users uuid[]
) RETURNS uuid[]
LANGUAGE plpgsql AS $$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_uid uuid;
  v_qid uuid;
BEGIN
  FOREACH v_uid IN ARRAY p_users LOOP
    v_qid := gen_random_uuid();
    INSERT INTO public.event_qr_codes (id, job_posting_id, user_id, qr_token, expires_at)
    VALUES (v_qid, p_jp_id, v_uid, 'qr-' || v_qid::text, now()+interval '1 day');
    v_ids := array_append(v_ids, v_qid);
  END LOOP;
  RETURN v_ids;
END;
$$;
```

이후 test 에서 `SELECT jpc_test_seed_qrs(...)` 호출 후 각 페르소나별 자기 QR 에 DELETE 시도.

- [ ] **Step 4: 16/16 통과**

```bash
supabase test db --tests tests/jpc_event_qr_codes_rls.test.sql
```

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/supabase/tests/jpc_event_qr_codes_rls.test.sql uniqn-mobile/supabase/tests/jpc_helpers.sql
git commit -m "test(jpc): event_qr_codes RLS 매트릭스 16 케이스 + per-persona QR 시드 헬퍼"
```

---

## Phase 3: Cascade / Trigger 시나리오 (10 케이스)

### Task 3.1: Cascade 테스트 작성

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_cascade.test.sql`

**10 케이스 목록**:

| # | 시나리오 | expected |
|---|---|---|
| C1 | workspace 삭제 → 공고 cascade → jpc cascade | jpc count = 0 |
| C2 | user 삭제 (auth.users DELETE) → jpc.user_id cascade | jpc count -= N |
| C3 | job_posting 삭제 → jpc cascade | jpc count = 0 |
| C4 | collaborator 자가 나가기 → audit log source='user', user_id 일치 | log row + source |
| C5 | workspace owner 가 collaborator 제거 → audit log source='user', removed_by 일치 | log row + removed_by |
| C6 | workspace owner 이양 (workspaces.owner_id UPDATE) → 옛 owner INSERT 차단, 새 owner INSERT 통과 | RLS 동작 |
| C7 | application INSERT → notification_outbox 가 아닌 `notifications` 테이블에 owner + ws_editor + collaborator UNION 발송 | notifications count + recipient_ids |
| C8 | enforce_jp_status_transition — collaborator 가 'active' → 'cancelled' 통과 | UPDATE 성공 |
| C9 | jpc INSERT 트리거 → notifications 에 added 알림 1행 | recipient = user_id |
| C10 | jpc DELETE 트리거 → notifications 에 removed 알림 1행 | recipient = user_id |

- [ ] **Step 1: cascade 테스트 SQL 작성**

```sql
-- uniqn-mobile/supabase/tests/jpc_cascade.test.sql
BEGIN;
SELECT plan(10);

-- ============================================================================
-- C1: workspace 삭제 → 공고 cascade → jpc cascade
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.owner_id', s.owner_id::text, true);
  PERFORM set_config('jpc.ws_id',    s.workspace_id::text, true);
  PERFORM set_config('jpc.jp_id',    s.job_posting_id::text, true);
  PERFORM set_config('jpc.collab_id', s.collaborator_id::text, true);
END $$;

-- 시드 검증 (pitfall_rls_dynamic_verification_sparse_data)
SELECT is(
  (SELECT count(*)::int FROM public.job_posting_collaborators WHERE job_posting_id=(current_setting('jpc.jp_id'))::uuid),
  1, 'C1 pre: jpc 1행 시드 확인'
);

SELECT jpc_test_set_user((current_setting('jpc.owner_id'))::uuid);
DELETE FROM public.workspaces WHERE id=(current_setting('jpc.ws_id'))::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.job_posting_collaborators WHERE job_posting_id=(current_setting('jpc.jp_id'))::uuid),
  0, 'C1: workspace 삭제 → jpc cascade'
);

-- ============================================================================
-- C2: user 삭제 → jpc.user_id cascade
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c2_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c2_jp',     s.job_posting_id::text, true);
END $$;

SELECT is(
  (SELECT count(*)::int FROM public.job_posting_collaborators
   WHERE user_id=(current_setting('jpc.c2_collab'))::uuid),
  1, 'C2 pre: jpc 1행'
);

PERFORM set_config('role', 'service_role', true);
DELETE FROM auth.users WHERE id=(current_setting('jpc.c2_collab'))::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.job_posting_collaborators
   WHERE user_id=(current_setting('jpc.c2_collab'))::uuid),
  0, 'C2: auth.users 삭제 → jpc cascade'
);

-- ============================================================================
-- C3: job_posting 삭제 → jpc cascade
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c3_jp', s.job_posting_id::text, true);
  PERFORM set_config('jpc.c3_owner', s.owner_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c3_owner'))::uuid);
DELETE FROM public.job_postings WHERE id=(current_setting('jpc.c3_jp'))::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.job_posting_collaborators WHERE job_posting_id=(current_setting('jpc.c3_jp'))::uuid),
  0, 'C3: job_posting 삭제 → jpc cascade'
);

-- ============================================================================
-- C4: collaborator 자가 나가기 → audit log source='user'
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c4_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c4_jp', s.job_posting_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c4_collab'))::uuid);
DELETE FROM public.job_posting_collaborators
WHERE job_posting_id=(current_setting('jpc.c4_jp'))::uuid
  AND user_id=(current_setting('jpc.c4_collab'))::uuid;

SELECT is(
  (SELECT source FROM public.job_posting_collaborators_audit
   WHERE job_posting_id=(current_setting('jpc.c4_jp'))::uuid
     AND user_id=(current_setting('jpc.c4_collab'))::uuid
     AND action='removed'
   ORDER BY occurred_at DESC LIMIT 1),
  'user', 'C4: 자가 나가기 audit log source=user'
);

-- ============================================================================
-- C5: workspace owner 가 제거 → audit log source='user' + removed_by=owner
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c5_owner', s.owner_id::text, true);
  PERFORM set_config('jpc.c5_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c5_jp', s.job_posting_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c5_owner'))::uuid);
DELETE FROM public.job_posting_collaborators
WHERE job_posting_id=(current_setting('jpc.c5_jp'))::uuid
  AND user_id=(current_setting('jpc.c5_collab'))::uuid;

SELECT is(
  (SELECT removed_by FROM public.job_posting_collaborators_audit
   WHERE job_posting_id=(current_setting('jpc.c5_jp'))::uuid
     AND user_id=(current_setting('jpc.c5_collab'))::uuid
     AND action='removed'
   ORDER BY occurred_at DESC LIMIT 1),
  (current_setting('jpc.c5_owner'))::uuid,
  'C5: owner 제거 audit log removed_by=owner'
);

-- ============================================================================
-- C6: workspace owner 이양 (UPDATE owner_id) → RLS 권한 이동
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c6_old_owner', s.owner_id::text, true);
  PERFORM set_config('jpc.c6_new_owner', s.ws_editor_id::text, true);
  PERFORM set_config('jpc.c6_ws', s.workspace_id::text, true);
  PERFORM set_config('jpc.c6_jp', s.job_posting_id::text, true);
END $$;

-- service_role 로 owner 이양 (workspaces.owner_id UPDATE 정책에 따라 owner 만 가능 가정)
PERFORM set_config('role', 'service_role', true);
UPDATE public.workspaces SET owner_id=(current_setting('jpc.c6_new_owner'))::uuid
WHERE id=(current_setting('jpc.c6_ws'))::uuid;

-- 옛 owner: jpc INSERT 차단
SELECT jpc_test_set_user((current_setting('jpc.c6_old_owner'))::uuid);
SELECT throws_ok(
  $$INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
    VALUES ((current_setting('jpc.c6_jp'))::uuid,
            (SELECT gen_random_uuid()),
            (current_setting('jpc.c6_old_owner'))::uuid)$$,
  '42501', NULL, 'C6: owner 이양 후 옛 owner INSERT 차단'
);

-- ============================================================================
-- C7: application INSERT → notifications UNION (owner + ws_editor + collaborator)
-- ============================================================================
DO $$
DECLARE s RECORD; v_app uuid;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c7_owner',   s.owner_id::text, true);
  PERFORM set_config('jpc.c7_editor',  s.ws_editor_id::text, true);
  PERFORM set_config('jpc.c7_collab',  s.collaborator_id::text, true);
  PERFORM set_config('jpc.c7_jp',      s.job_posting_id::text, true);
  -- 새 applicant + 새 application
  v_app := gen_random_uuid();
  PERFORM set_config('role', 'service_role', true);
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (gen_random_uuid(), 'c7_applicant_'||v_app||'@test.local', '{"role":"staff"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '')
  RETURNING id INTO v_app;
  PERFORM set_config('jpc.c7_applicant', v_app::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c7_applicant'))::uuid);
INSERT INTO public.applications (job_posting_id, applicant_id, applicant_name, status)
VALUES ((current_setting('jpc.c7_jp'))::uuid, (current_setting('jpc.c7_applicant'))::uuid, 'c7', 'applied');

-- notifications 에 owner + editor + collaborator 3행 발송 기대
SELECT is(
  (SELECT count(*)::int FROM public.notifications n
   WHERE n.recipient_id IN (
     (current_setting('jpc.c7_owner'))::uuid,
     (current_setting('jpc.c7_editor'))::uuid,
     (current_setting('jpc.c7_collab'))::uuid)
   AND n.related_resource_id::text = (current_setting('jpc.c7_jp'))),
  3, 'C7: application INSERT → owner + editor + collab 알림 UNION'
);

-- ============================================================================
-- C8: enforce_jp_status_transition — collaborator 가 cancel 가능
-- ============================================================================
DO $$
DECLARE s RECORD;
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('jpc.c8_collab', s.collaborator_id::text, true);
  PERFORM set_config('jpc.c8_jp', s.job_posting_id::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c8_collab'))::uuid);
SELECT lives_ok(
  $$UPDATE public.job_postings SET status='cancelled' WHERE id=(current_setting('jpc.c8_jp'))::uuid$$,
  'C8: collaborator status active→cancelled 통과 (enforce_jp_status_transition 분기)'
);

-- ============================================================================
-- C9: jpc INSERT → notifications added
-- ============================================================================
DO $$
DECLARE s RECORD; v_new_user uuid := gen_random_uuid();
BEGIN
  SELECT * INTO s FROM jpc_test_seed();
  PERFORM set_config('role', 'service_role', true);
  INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES (v_new_user, 'c9_new_'||v_new_user||'@test.local', '{"role":"employer"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
  INSERT INTO public.users (id, email, name) VALUES (v_new_user, 'c9_new@test.local', 'c9') ON CONFLICT DO NOTHING;
  PERFORM set_config('jpc.c9_owner', s.owner_id::text, true);
  PERFORM set_config('jpc.c9_jp', s.job_posting_id::text, true);
  PERFORM set_config('jpc.c9_new_user', v_new_user::text, true);
END $$;

SELECT jpc_test_set_user((current_setting('jpc.c9_owner'))::uuid);
INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
VALUES ((current_setting('jpc.c9_jp'))::uuid, (current_setting('jpc.c9_new_user'))::uuid, (current_setting('jpc.c9_owner'))::uuid);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id=(current_setting('jpc.c9_new_user'))::uuid
     AND notification_type IN ('collaborator_added','job_posting_collaborator_added')),
  1, 'C9: jpc INSERT → added 알림 1행 (recipient = 새 collaborator)'
);

-- ============================================================================
-- C10: jpc DELETE → notifications removed
-- ============================================================================
-- C9 에서 추가한 collaborator 를 owner 가 제거
SELECT jpc_test_set_user((current_setting('jpc.c9_owner'))::uuid);
DELETE FROM public.job_posting_collaborators
WHERE job_posting_id=(current_setting('jpc.c9_jp'))::uuid
  AND user_id=(current_setting('jpc.c9_new_user'))::uuid;

SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE recipient_id=(current_setting('jpc.c9_new_user'))::uuid
     AND notification_type IN ('collaborator_removed','job_posting_collaborator_removed')),
  1, 'C10: jpc DELETE → removed 알림 1행'
);

SELECT * FROM finish();
ROLLBACK;
```

> **주의**: `notifications` 테이블 컬럼명 (`recipient_id`, `notification_type`, `related_resource_id`) 은 실제 스키마와 다를 수 있음 — Step 2 에서 보정. 메모리: `pitfall_notification_outbox_misnomer` 참고.

- [ ] **Step 2: 실제 스키마 확인**

```bash
git show origin/master:uniqn-mobile/supabase/migrations/20260515050000_jpc_notification_triggers.sql | head -80
```

`notifications` 테이블의 실제 컬럼명 + trigger 함수 이름 확인 후 expected 보정.

- [ ] **Step 3: 10/10 통과**

```bash
supabase test db --tests tests/jpc_cascade.test.sql
```

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/supabase/tests/jpc_cascade.test.sql
git commit -m "test(jpc): cascade + trigger 10 케이스 (workspace/user/jp 삭제, owner 이양, alert UNION, status transition)"
```

---

## Phase 4: Repository Jest 테스트

### Task 4.1: JobPostingCollaboratorRepository.test.ts

**Files:**
- Create: `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingCollaboratorRepository.test.ts`

**대상**: `findByJobPostingWithUser`, `findSharedJobPostingsForUser`, `add`, `remove`, `searchByEmail`.

**모킹 전략**: `@/lib/supabase` 의 `supabase` 객체를 jest.mock 으로 대체. 기존 패턴은 `ApplicationRepositoryHelpers.workspace.test.ts` 참고.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// uniqn-mobile/src/repositories/supabase/__tests__/JobPostingCollaboratorRepository.test.ts
/**
 * JobPostingCollaboratorRepository unit tests
 * Repository 는 RLS 의존 — 여기서는 Supabase 응답 매핑 + 에러 분기만 검증
 */

import { SupabaseJobPostingCollaboratorRepository } from '../JobPostingCollaboratorRepository';
import { supabase } from '@/lib/supabase';
import { BusinessError } from '@/errors';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('SupabaseJobPostingCollaboratorRepository', () => {
  let repo: SupabaseJobPostingCollaboratorRepository;

  beforeEach(() => {
    repo = new SupabaseJobPostingCollaboratorRepository();
    jest.clearAllMocks();
  });

  describe('findByJobPostingWithUser', () => {
    it('snake_case 응답을 camelCase 로 매핑한다', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'jpc-1',
            job_posting_id: 'jp-1',
            user_id: 'user-1',
            added_by: 'owner-1',
            added_at: '2026-05-12T00:00:00Z',
            users: {
              nickname: '협업자',
              name: null,
              email: 'collab@test.local',
              photo_url: null,
            },
          },
        ],
        error: null,
      });
      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      } as never);

      const result = await repo.findByJobPostingWithUser('jp-1');

      expect(result).toEqual([
        {
          id: 'jpc-1',
          jobPostingId: 'jp-1',
          userId: 'user-1',
          addedBy: 'owner-1',
          addedAt: '2026-05-12T00:00:00Z',
          displayName: '협업자',
          email: 'collab@test.local',
          photoUrl: null,
        },
      ]);
    });

    it('빈 응답 시 빈 배열을 반환한다', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as never);

      const result = await repo.findByJobPostingWithUser('jp-empty');
      expect(result).toEqual([]);
    });
  });

  describe('add', () => {
    it('UNIQUE 충돌 시 BusinessError 친절 메시지를 던진다', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate' },
        }),
      } as never);

      await expect(repo.add('jp-1', 'user-1', 'owner-1')).rejects.toMatchObject({
        userMessage: '이미 협업 중인 사용자입니다',
      });
    });

    it('CHECK 위반 시 자가 추가 친절 메시지를 던진다', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23514', message: 'check violation' },
        }),
      } as never);

      await expect(repo.add('jp-1', 'owner-1', 'owner-1')).rejects.toMatchObject({
        userMessage: '본인은 협업자로 추가할 수 없습니다',
      });
    });

    it('성공 시 camelCase 객체를 반환한다', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'jpc-new',
            job_posting_id: 'jp-1',
            user_id: 'user-1',
            added_by: 'owner-1',
            added_at: '2026-05-12T00:00:00Z',
          },
          error: null,
        }),
      } as never);

      const result = await repo.add('jp-1', 'user-1', 'owner-1');
      expect(result).toEqual({
        id: 'jpc-new',
        jobPostingId: 'jp-1',
        userId: 'user-1',
        addedBy: 'owner-1',
        addedAt: '2026-05-12T00:00:00Z',
      });
    });
  });

  describe('searchByEmail', () => {
    it('RPC 결과를 status 분류한다 — self / workspace_member / already_collaborator / addable', async () => {
      // RPC 호출
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: [
          { id: 'me', email: 'me@test.local', nickname: 'me', name: null, photo_url: null },
          { id: 'member-1', email: 'm1@test.local', nickname: 'm1', name: null, photo_url: null },
          { id: 'collab-1', email: 'c1@test.local', nickname: 'c1', name: null, photo_url: null },
          { id: 'add-1', email: 'a1@test.local', nickname: 'a1', name: null, photo_url: null },
        ],
        error: null,
      });

      // auth.getUser → self = 'me'
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'me' } },
      });

      // jp_posting.workspace_id
      const fromMock = jest.fn((table: string) => {
        if (table === 'job_postings') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { workspace_id: 'ws-1' }, error: null,
            }),
          };
        }
        if (table === 'job_posting_collaborators') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ user_id: 'collab-1' }], error: null,
            }),
          };
        }
        if (table === 'workspace_members') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ user_id: 'member-1' }], error: null,
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { owner_id: 'someone' }, error: null,
            }),
          };
        }
        return {} as never;
      });
      mockSupabase.from = fromMock as never;

      const result = await repo.searchByEmail('jp-1', 'test');

      expect(result).toEqual([
        { userId: 'me', displayName: 'me', email: 'me@test.local', photoUrl: null, status: 'self' },
        { userId: 'member-1', displayName: 'm1', email: 'm1@test.local', photoUrl: null, status: 'workspace_member' },
        { userId: 'collab-1', displayName: 'c1', email: 'c1@test.local', photoUrl: null, status: 'already_collaborator' },
        { userId: 'add-1', displayName: 'a1', email: 'a1@test.local', photoUrl: null, status: 'addable' },
      ]);
    });

    it('RPC 빈 결과 시 빈 배열을 반환한다', async () => {
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: [], error: null });

      const result = await repo.searchByEmail('jp-1', 'nomatch');
      expect(result).toEqual([]);
    });
  });

  describe('findSharedJobPostingsForUser', () => {
    it('JOIN 응답을 SharedJobPosting 로 매핑한다', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              added_at: '2026-05-12T00:00:00Z',
              job_postings: {
                id: 'jp-1',
                title: '공유 공고',
                workspace_id: 'ws-1',
                workspaces: { id: 'ws-1', name: '워크스페이스' },
              },
            },
          ],
          error: null,
        }),
      } as never);

      const result = await repo.findSharedJobPostingsForUser('user-1');
      expect(result).toEqual([
        {
          jobPostingId: 'jp-1',
          jobPostingTitle: '공유 공고',
          workspaceId: 'ws-1',
          workspaceName: '워크스페이스',
          addedAt: '2026-05-12T00:00:00Z',
        },
      ]);
    });

    it('job_postings 가 null 인 행을 필터링한다 (RLS 차단)', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [{ added_at: '2026-05-12', job_postings: null }],
          error: null,
        }),
      } as never);

      const result = await repo.findSharedJobPostingsForUser('user-1');
      expect(result).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 (FAIL 기대 — 모듈 import 정상이지만 mock 설정 검증)**

```bash
cd uniqn-mobile
npx jest src/repositories/supabase/__tests__/JobPostingCollaboratorRepository.test.ts
```

기대: PASS (이미 구현된 Repository 검증). 일부 실패 시 mock 체이닝 (`select().eq().order()`) 조정.

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/__tests__/JobPostingCollaboratorRepository.test.ts
git commit -m "test(jpc): JobPostingCollaboratorRepository — 매핑 + 에러 분기 + searchByEmail 분류"
```

---

## Phase 5: Hook Jest 테스트

### Task 5.1: useJobPostingCollaborators.test.tsx

**Files:**
- Create: `uniqn-mobile/src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx`

**대상**: TanStack Query mutation 흐름 + Realtime 구독 + leaveSelf cleanup.

- [ ] **Step 1: 테스트 작성**

```typescript
// uniqn-mobile/src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useJobPostingCollaborators, useCollaboratorCandidates } from '../useJobPostingCollaborators';
import { collaboratorService } from '@/services/jobs/collaboratorService';

jest.mock('@/services/jobs/collaboratorService', () => ({
  collaboratorService: {
    listForJobPosting: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    leaveSelf: jest.fn(),
    searchCandidates: jest.fn(),
  },
}));

jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: jest.fn(() => () => undefined),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: { getState: () => ({ success: jest.fn(), error: jest.fn() }) },
}));

jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useJobPostingCollaborators', () => {
  beforeEach(() => jest.clearAllMocks());

  it('jobPostingId 가 있으면 collaborator 목록을 fetch 한다', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([
      { id: 'jpc-1', userId: 'u1', displayName: 'collab1', email: 'c1@test.local' },
    ]);

    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.collaborators).toHaveLength(1);
    expect(collaboratorService.listForJobPosting).toHaveBeenCalledWith('jp-1');
  });

  it('jobPostingId 가 undefined 면 fetch 하지 않는다', async () => {
    const { result } = renderHook(() => useJobPostingCollaborators(undefined), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.listForJobPosting).not.toHaveBeenCalled();
  });

  it('add mutation 후 invalidate 한다', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([]);
    (collaboratorService.add as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.add('user-2'));

    expect(collaboratorService.add).toHaveBeenCalledWith({ jobPostingId: 'jp-1', userId: 'user-2' });
  });

  it('leaveSelf 후 cleanup invalidate + removeQueries 호출', async () => {
    (collaboratorService.listForJobPosting as jest.Mock).mockResolvedValue([]);
    (collaboratorService.leaveSelf as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useJobPostingCollaborators('jp-1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.leaveSelf());

    expect(collaboratorService.leaveSelf).toHaveBeenCalledWith('jp-1');
  });
});

describe('useCollaboratorCandidates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('email query 가 3자 미만이면 fetch 하지 않는다', async () => {
    (collaboratorService.searchCandidates as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useCollaboratorCandidates('jp-1', 'ab'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.searchCandidates).not.toHaveBeenCalled();
  });

  it('email query 3자 이상이면 fetch 한다', async () => {
    (collaboratorService.searchCandidates as jest.Mock).mockResolvedValue([
      { userId: 'u1', email: 'abc@test.local', status: 'addable' },
    ]);

    const { result } = renderHook(() => useCollaboratorCandidates('jp-1', 'abc'), { wrapper });
    await waitFor(() => expect(result.current.candidates).toHaveLength(1));
    expect(collaboratorService.searchCandidates).toHaveBeenCalledWith({
      jobPostingId: 'jp-1', emailQuery: 'abc',
    });
  });
});
```

- [ ] **Step 2: 실행 + PASS**

```bash
npx jest src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx
```

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx
git commit -m "test(jpc): useJobPostingCollaborators — query/mutation/realtime/leaveSelf"
```

### Task 5.2: useSharedJobPostings.test.tsx

**Files:**
- Create: `uniqn-mobile/src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx`

- [ ] **Step 1: 테스트 작성**

```typescript
// uniqn-mobile/src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useSharedJobPostings } from '../useSharedJobPostings';
import { collaboratorService } from '@/services/jobs/collaboratorService';
import { useAuthStore } from '@/stores/authStore';

jest.mock('@/services/jobs/collaboratorService', () => ({
  collaboratorService: { listSharedJobPostings: jest.fn() },
}));

jest.mock('@/utils/supabase', () => ({
  createRealtimeSubscription: jest.fn(() => () => undefined),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useSharedJobPostings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('userId 있을 때 shared postings fetch', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: { uid: 'user-1' } });
    (collaboratorService.listSharedJobPostings as jest.Mock).mockResolvedValue([
      { jobPostingId: 'jp-1', jobPostingTitle: '공유 공고', workspaceId: 'ws-1', workspaceName: 'WS', addedAt: '2026-05-12' },
    ]);

    const { result } = renderHook(() => useSharedJobPostings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sharedPostings).toHaveLength(1);
  });

  it('익명 (user null) 이면 fetch 하지 않는다', async () => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({ user: null });

    const { result } = renderHook(() => useSharedJobPostings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(collaboratorService.listSharedJobPostings).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실행 + PASS**

```bash
npx jest src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx
```

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx
git commit -m "test(jpc): useSharedJobPostings — 익명 가드 + Realtime 구독"
```

---

## Phase 6: E2E Smoke (3 specs)

### Task 6.1: QA 계정 추가 (선택 — collaborator 페르소나)

**Files:**
- Modify: `uniqn-mobile/e2e/helpers/supabase-admin.ts`

기존 SUPABASE_QA_ACCOUNTS 에 `collaborator` 페르소나가 없다면 추가. 있다면 Step 1 건너뜀.

- [ ] **Step 1: 헬퍼 확인**

```bash
grep -n "SUPABASE_QA_ACCOUNTS" uniqn-mobile/e2e/helpers/supabase-admin.ts
```

`collaborator` 키가 있는지 확인. 없으면:

```typescript
export const SUPABASE_QA_ACCOUNTS = {
  // ... 기존
  collaborator: {
    id: '<uuid-prefilled-in-supabase-seed>',
    email: 'qa-collaborator@uniqn.app',
    password: 'TestPassword123!',
    name: 'QA Collaborator',
  },
};
```

- [ ] **Step 2: 시드 SQL 또는 seed.sql 에 collaborator user 추가**

```bash
# uniqn-mobile/supabase/seed.sql 또는 별도 e2e 시드 스크립트
```

- [ ] **Step 3: 커밋 (변경 있을 때만)**

```bash
git add uniqn-mobile/e2e/helpers/supabase-admin.ts uniqn-mobile/supabase/seed.sql
git commit -m "test(e2e): QA collaborator 페르소나 추가"
```

### Task 6.2: employer-collaborator-add.spec.ts

**Files:**
- Create: `uniqn-mobile/e2e/tests/p1-important/employer-collaborator-add.spec.ts`

**시나리오**:
1. employer (workspace owner) 로 로그인
2. 자기 공고 상세 진입
3. "협업자 관리" 모달 열기
4. 이메일 검색 → collaborator 후보 선택 → 추가
5. 모달 닫힘 + 헤더 아바타 +1 확인

- [ ] **Step 1: spec 작성**

```typescript
// uniqn-mobile/e2e/tests/p1-important/employer-collaborator-add.spec.ts
import { expect, test } from '@playwright/test';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';

test.describe('Employer Collaborator Add', () => {
  let jobPostingId: string;

  test.beforeEach(async () => {
    const admin = getAdminClient();
    if (!admin) throw new Error('service role key missing');

    // seed a fresh posting owned by qa-employer
    const workDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await admin.from('job_postings').insert({
      title: 'e2e collab add posting',
      status: 'active',
      owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
      owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
      posting_type: 'regular',
      work_date: workDate,
      work_dates: [workDate],
      total_positions: 2,
      filled_positions: 0,
      view_count: 0,
      schema_version: 3,
      contact_phone: '+82109999999',
    }).select('id').single();
    if (error) throw error;
    jobPostingId = data.id;
  });

  test.afterEach(async () => {
    const admin = getAdminClient();
    if (admin && jobPostingId) {
      await admin.from('job_postings').delete().eq('id', jobPostingId);
    }
  });

  test('employer 가 collaborator 를 추가하면 헤더 아바타가 +1 된다', async ({ page }) => {
    // 1) 로그인
    await page.goto('/auth/login');
    await page.getByLabel(/이메일/).fill(SUPABASE_QA_ACCOUNTS.employer.email);
    await page.getByLabel(/비밀번호/).fill(SUPABASE_QA_ACCOUNTS.employer.password);
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(/\/employer/);

    // 2) 공고 상세
    await page.goto(`/employer/job-posting/${jobPostingId}`);
    await page.waitForLoadState('networkidle');

    // 3) 협업자 관리 버튼
    await page.getByRole('button', { name: /협업자 관리/ }).click();
    await page.waitForSelector('text=/협업자 추가/', { timeout: 5_000 });

    // 4) 이메일 검색 + 후보 선택
    await page.getByPlaceholder(/이메일/).fill(SUPABASE_QA_ACCOUNTS.collaborator.email.slice(0, 6));
    await page.waitForSelector(`text=${SUPABASE_QA_ACCOUNTS.collaborator.email}`, { timeout: 5_000 });
    await page.getByText(SUPABASE_QA_ACCOUNTS.collaborator.email).click();
    await page.getByRole('button', { name: /추가/ }).click();

    // 5) 헤더 아바타 +1 (모달 닫힘 후)
    await page.waitForSelector('text=/협업자 추가/', { state: 'hidden', timeout: 5_000 });
    const avatarBadge = page.locator('[data-testid="collaborator-avatar-badge"]');
    await expect(avatarBadge).toContainText('1');
  });
});
```

> **Step 1 보정 노트**: `data-testid="collaborator-avatar-badge"` 가 실제 UI 에 있는지 확인 필요. 없으면 `app/(employer)/job-posting/[id].tsx` 또는 관련 컴포넌트에 추가하는 작업이 선행.

- [ ] **Step 2: 컴포넌트 testID 확인 + 보정**

```bash
grep -r "collaborator-avatar-badge\|협업자 관리" uniqn-mobile/app uniqn-mobile/src/components --include="*.tsx"
```

testID 가 없으면 해당 컴포넌트에 `testID="collaborator-avatar-badge"` 추가. 추가만 하고 별도 commit.

- [ ] **Step 3: 로컬 E2E 실행**

```bash
cd uniqn-mobile
npm run e2e -- tests/p1-important/employer-collaborator-add.spec.ts
```

기대: PASS.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/e2e/tests/p1-important/employer-collaborator-add.spec.ts uniqn-mobile/src/components  # testID 변경 있으면
git commit -m "test(e2e): employer collaborator 추가 → 헤더 아바타 +1"
```

### Task 6.3: collaborator-shared-postings.spec.ts

**Files:**
- Create: `uniqn-mobile/e2e/tests/p1-important/collaborator-shared-postings.spec.ts`

**시나리오**:
1. service_role 로 사전 시드: collaborator 가 jpc 등록된 상태
2. collaborator 로 로그인
3. my-postings (또는 employer 탭) 진입
4. "공유받은 공고" 섹션 + 해당 공고 보임

- [ ] **Step 1: spec 작성**

```typescript
// uniqn-mobile/e2e/tests/p1-important/collaborator-shared-postings.spec.ts
import { expect, test } from '@playwright/test';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';

test.describe('Collaborator Shared Postings', () => {
  let jobPostingId: string;

  test.beforeEach(async () => {
    const admin = getAdminClient();
    if (!admin) throw new Error('service role key missing');

    const workDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: jp, error: jpErr } = await admin.from('job_postings').insert({
      title: 'e2e shared posting',
      status: 'active',
      owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
      owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
      posting_type: 'regular',
      work_date: workDate,
      work_dates: [workDate],
      total_positions: 2,
      filled_positions: 0,
      view_count: 0,
      schema_version: 3,
      contact_phone: '+82109999999',
    }).select('id').single();
    if (jpErr) throw jpErr;
    jobPostingId = jp.id;

    const { error: jpcErr } = await admin.from('job_posting_collaborators').insert({
      job_posting_id: jobPostingId,
      user_id: SUPABASE_QA_ACCOUNTS.collaborator.id,
      added_by: SUPABASE_QA_ACCOUNTS.employer.id,
    });
    if (jpcErr) throw jpcErr;
  });

  test.afterEach(async () => {
    const admin = getAdminClient();
    if (admin && jobPostingId) {
      await admin.from('job_postings').delete().eq('id', jobPostingId);
    }
  });

  test('collaborator 시점 my-postings 에 "공유받은 공고" 섹션 + 해당 공고 표시', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/이메일/).fill(SUPABASE_QA_ACCOUNTS.collaborator.email);
    await page.getByLabel(/비밀번호/).fill(SUPABASE_QA_ACCOUNTS.collaborator.password);
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(/\/(employer|app)/);

    await page.goto('/employer/my-postings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/공유받은 공고/)).toBeVisible();
    await expect(page.getByText('e2e shared posting')).toBeVisible();
  });
});
```

- [ ] **Step 2: 라우트 확인**

```bash
grep -r "공유받은 공고\|sharedPostings" uniqn-mobile/app uniqn-mobile/src/components --include="*.tsx" | head
```

실제 라우트 (`/employer/my-postings` vs `/(employer)/my-postings`) 확인.

- [ ] **Step 3: 실행 + 커밋**

```bash
npm run e2e -- tests/p1-important/collaborator-shared-postings.spec.ts
git add uniqn-mobile/e2e/tests/p1-important/collaborator-shared-postings.spec.ts
git commit -m "test(e2e): collaborator 공유받은 공고 섹션 표시"
```

### Task 6.4: collaborator-self-leave.spec.ts

**Files:**
- Create: `uniqn-mobile/e2e/tests/p1-important/collaborator-self-leave.spec.ts`

**시나리오**:
1. 사전 시드: collaborator 가 jpc 등록
2. collaborator 로 로그인 + 공고 상세 진입
3. "관리에서 나가기" 버튼 클릭 → 확인
4. 모달 닫힘 + my-postings 리스트에서 해당 공고 제거

- [ ] **Step 1: spec 작성**

```typescript
// uniqn-mobile/e2e/tests/p1-important/collaborator-self-leave.spec.ts
import { expect, test } from '@playwright/test';
import { getAdminClient, SUPABASE_QA_ACCOUNTS } from '../../helpers/supabase-admin';

test.describe('Collaborator Self Leave', () => {
  let jobPostingId: string;

  test.beforeEach(async () => {
    const admin = getAdminClient();
    if (!admin) throw new Error('service role key missing');

    const workDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: jp } = await admin.from('job_postings').insert({
      title: 'e2e self leave posting',
      status: 'active',
      owner_id: SUPABASE_QA_ACCOUNTS.employer.id,
      owner_name: SUPABASE_QA_ACCOUNTS.employer.name,
      posting_type: 'regular',
      work_date: workDate,
      work_dates: [workDate],
      total_positions: 2,
      filled_positions: 0,
      view_count: 0,
      schema_version: 3,
      contact_phone: '+82109999999',
    }).select('id').single();
    if (!jp) throw new Error('seed fail');
    jobPostingId = jp.id;

    await admin.from('job_posting_collaborators').insert({
      job_posting_id: jobPostingId,
      user_id: SUPABASE_QA_ACCOUNTS.collaborator.id,
      added_by: SUPABASE_QA_ACCOUNTS.employer.id,
    });
  });

  test.afterEach(async () => {
    const admin = getAdminClient();
    if (admin && jobPostingId) {
      await admin.from('job_postings').delete().eq('id', jobPostingId);
    }
  });

  test('collaborator 가 자가 나가기 → my-postings 에서 제거', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/이메일/).fill(SUPABASE_QA_ACCOUNTS.collaborator.email);
    await page.getByLabel(/비밀번호/).fill(SUPABASE_QA_ACCOUNTS.collaborator.password);
    await page.getByRole('button', { name: /로그인/ }).click();
    await page.waitForURL(/\/(employer|app)/);

    await page.goto(`/employer/job-posting/${jobPostingId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /관리에서 나가기|나가기/ }).click();
    await page.getByRole('button', { name: /확인|나가기/ }).last().click();

    await page.waitForURL(/\/my-postings|\/employer/);
    await page.goto('/employer/my-postings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('e2e self leave posting')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: UI 텍스트 확인 + 보정**

```bash
grep -r "관리에서 나가기\|나가기" uniqn-mobile/app uniqn-mobile/src/components --include="*.tsx" | head
```

- [ ] **Step 3: 실행 + 커밋**

```bash
npm run e2e -- tests/p1-important/collaborator-self-leave.spec.ts
git add uniqn-mobile/e2e/tests/p1-important/collaborator-self-leave.spec.ts
git commit -m "test(e2e): collaborator 자가 나가기 → my-postings 제거"
```

---

## Phase 7: CI workflow 통합

### Task 7.1: db-tests.yml workflow 추가

**Files:**
- Create: `.github/workflows/db-tests.yml`

**의도**: PR 머지 전 `supabase test db` 자동 실행. 기존 e2e.yml 의 supabase 셋업 패턴 재사용.

- [ ] **Step 1: workflow 작성**

```yaml
# .github/workflows/db-tests.yml
name: DB Tests (pg_prove)

on:
  pull_request:
    branches: [main, master, develop]
    paths:
      - 'uniqn-mobile/supabase/**'
      - '.github/workflows/db-tests.yml'
  push:
    branches: [main, master, develop]
    paths:
      - 'uniqn-mobile/supabase/**'
      - '.github/workflows/db-tests.yml'

defaults:
  run:
    working-directory: uniqn-mobile

jobs:
  db-tests:
    name: DB Tests (pg_prove)
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start local Supabase
        run: supabase start

      - name: Run pg_prove tests
        run: supabase test db

      - name: Stop local Supabase
        if: always()
        run: supabase stop --no-backup || true
```

- [ ] **Step 2: package.json 스크립트 추가**

```json
{
  "scripts": {
    "test:db": "supabase test db"
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add .github/workflows/db-tests.yml uniqn-mobile/package.json
git commit -m "ci(jpc): pg_prove workflow + npm run test:db 스크립트"
```

### Task 7.2: ci.yml 에 Repository/Hook Jest 단계 추가 (이미 통합되어 있을 수 있음 — 확인 후 보정)

**Files:**
- Modify: `.github/workflows/ci.yml` (필요 시)

- [ ] **Step 1: 기존 CI 확인**

```bash
grep -n "jest\|test" .github/workflows/ci.yml
```

이미 `npm test` 가 있으면 자동으로 신규 테스트 포함. 없으면 새 step 추가:

```yaml
  unit-tests:
    name: Unit Tests (Jest)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: uniqn-mobile/package-lock.json
      - run: npm ci
      - run: npm test
```

- [ ] **Step 2: 커밋 (변경 있을 때)**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(jpc): unit tests job 추가 (없을 때만)"
```

---

## Phase 8: 최종 검증 + PR

### Task 8.1: 전체 검증

- [ ] **Step 1: 모든 SQL 테스트 통과**

```bash
cd uniqn-mobile
supabase test db
```

기대: `tests/jpc_*.test.sql ... ok`, 90/90 (80 매트릭스 + 10 cascade).

- [ ] **Step 2: 모든 Jest 테스트 통과**

```bash
npm test -- --testPathPattern='(JobPostingCollaboratorRepository|useJobPostingCollaborators|useSharedJobPostings)'
```

기대: 모든 신규 테스트 PASS, 기존 테스트도 영향 없음 확인.

- [ ] **Step 3: 전체 npm test 회귀 확인**

```bash
npm test
```

기대: 기존 테스트 모두 PASS, 신규 PASS, 0 failures.

- [ ] **Step 4: E2E 로컬 실행 (3 specs)**

```bash
npm run e2e -- tests/p1-important/employer-collaborator-add.spec.ts tests/p1-important/collaborator-shared-postings.spec.ts tests/p1-important/collaborator-self-leave.spec.ts
```

기대: 3/3 PASS.

- [ ] **Step 5: 품질 게이트**

```bash
npm run quality
```

기대: type-check + lint + format:check 0 errors.

- [ ] **Step 6: 메모리 학습 적용 확인**

체크리스트:
- [ ] `pitfall_test_seed_zod_schema_first` — JSONB 시드 시 schema 우회 회피 (jpc_helpers.sql 에서 raw INSERT 시 정상)
- [ ] `pitfall_rls_dynamic_verification_sparse_data` — matching row count 사전 측정 (각 test 의 "pre" assertion)
- [ ] `pitfall_users_rls_cross_lookup` — searchByEmail Repository 가 RPC 사용 (test 도 RPC mock)
- [ ] `feedback_staging_dryrun_ddl_only_insufficient` — RPC 호출 검증 포함 (cascade 테스트 C8)

### Task 8.2: PR 생성

- [ ] **Step 1: branch push**

```bash
git push -u origin feat/job-posting-collaborators-tests
```

- [ ] **Step 2: gh pr create**

```bash
gh pr create --title "test(jpc): RLS 매트릭스 80 + cascade 10 + Repo/Hook/E2E + pg_prove CI" --body "$(cat <<'EOF'
## Summary

PR #88 (`f6e13c2a9` — job_posting_collaborators) 의 deferred 후속 PR. 4 스코프 + CI 통합:

- **Scope 1**: pg_prove RLS 매트릭스 80 케이스 (5 테이블 × 4 페르소나 × 4 작업)
- **Scope 2**: cascade + trigger 10 케이스 (workspace/user/jp 삭제, owner 이양, alert UNION, status transition, jpc INSERT/DELETE 알림)
- **Scope 3**: Repository + Hook Jest (5 + 2 파일)
- **Scope 4**: E2E smoke 3 specs (employer add / collaborator shared / self leave)
- **CI**: `db-tests.yml` 신규 workflow + `npm run test:db` 스크립트

## Test plan

- [ ] `supabase test db` → 90/90 PASS
- [ ] `npm test` → 신규 Repository + Hook 테스트 PASS, 기존 회귀 없음
- [ ] `npm run e2e -- tests/p1-important/employer-collaborator-add.spec.ts tests/p1-important/collaborator-shared-postings.spec.ts tests/p1-important/collaborator-self-leave.spec.ts` → 3/3 PASS
- [ ] `npm run quality` → type-check + lint + format 0 errors
- [ ] CI workflow `DB Tests (pg_prove)` 신규 노드 통과

## NOT in scope (다음 PR 후보)

- Storage bucket RLS (이력서 첨부 체계 미확정)
- 협업자 권한 차등 (manager/viewer) — MVP D2 결정대로 풀 관리권만 유지
- Realtime 구독 통합 테스트 (현재는 mock 처리)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: PR URL 확인**

- [ ] **Step 4: 메모리 업데이트 (이번 PR 머지 후 별도 세션)**

`project_job_posting_collaborators_plan.md` 의 "NOT in scope" 에서 pg_prove RLS 매트릭스, Hook/Repository/UI 테스트 항목 제거.

---

## Self-Review Checklist

- [x] **Spec coverage**: 4 스코프 모두 task 로 매핑 (Phase 2~7). CI 통합 (Phase 7). PR 생성 (Phase 8).
- [x] **Placeholder scan**: TBD/TODO 0건. expected 값 보정 안내는 "정책 확인 후 보정" 명시.
- [x] **Type consistency**: `jpc_test_seed()` RETURNS TABLE 컬럼명 + `current_setting('jpc.*')` 키 일관성 확인.
- [x] **Memory pitfall 적용**: 8개 메모리 학습 → test 안에 반영 (pre-count 측정, multi-cause 메시지, JSONB 회피, RPC 검증).

### 가정한 부분 (실행 시 보정 필요)

1. **pgTAP 확장 자동 활성화**: Supabase 로컬 스택이 pgtap 을 번들한다고 가정. 미설치 시 Pre-1 Step 5 보정.
2. **RLS 정책 expected**: 일부 INSERT/DELETE 케이스의 expected (ALLOW vs DENY) 는 실제 정책을 따라 보정. Step 2 디버깅 단계에 명시.
3. **UI testID**: `data-testid="collaborator-avatar-badge"` 미존재 가능 — Task 6.2 Step 2 에서 추가.
4. **QA collaborator 페르소나**: 기존 SUPABASE_QA_ACCOUNTS 에 없으면 Task 6.1 에서 추가.
5. **notifications 컬럼명**: `recipient_id`, `notification_type` 가정 — Task 3.1 Step 2 에서 실제 스키마 확인.

### 실행 권장 순서

1. **Pre-1** (워크트리 + supabase start)
2. **Phase 1** (헬퍼) — 1 회 커밋
3. **Phase 2** (5 × 16 매트릭스) — 5 회 커밋, 각 task 별로
4. **Phase 3** (cascade) — 1 회 커밋
5. **Phase 4-5** (Jest) — 3 회 커밋
6. **Phase 6** (E2E) — 3-4 회 커밋
7. **Phase 7** (CI) — 1-2 회 커밋
8. **Phase 8** (PR) — 1 회 push + PR

예상 커밋 수: 14-17 개. 예상 진행 시간: 일관된 컨텍스트 가정 시 4-6 시간 (디버깅 포함).
