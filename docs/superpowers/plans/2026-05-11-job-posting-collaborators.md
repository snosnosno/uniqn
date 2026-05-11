# 공고별 협업자 공유 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 워크스페이스의 all-or-nothing 권한 모델에 공고 단위 협업자(collaborator) 권한 입자를 추가. 외부 UNIQN 가입자에게 특정 공고 1개만 풀 위임 가능.

**Architecture:** `job_posting_collaborators` 별도 테이블 신설(Approach A) + 기존 RLS 정책에 OR 추가. 워크스페이스 editor 는 매니저급(전체 자동 접근), 협업자는 해당 공고만 풀 관리권. 즉시 권한 부여 + 푸시 알림 + Realtime + audit log.

**Tech Stack:** Supabase Postgres (RLS, plpgsql triggers, Realtime publication, pg_prove), Expo 55 / React Native 0.83 / TypeScript strict, NativeWind 4.2, TanStack Query, Zod, FlashList.

**Spec:** `docs/superpowers/specs/2026-05-11-job-posting-collaborators-design.md`

**Pre-condition:** PR3-A.2 (admin RLS update/delete split) 머지 완료. 머지 전이라도 Phase 0 audit 까지는 진행 가능.

---

## File Structure

### 신규 (Supabase)
```
supabase/migrations/
  YYYYMMDDHHMMSS_jpc_table_and_helper.sql           # Phase 1
  YYYYMMDDHHMMSS_jpc_audit_log.sql                  # Phase 1
  YYYYMMDDHHMMSS_jpc_self_rls.sql                   # Phase 1
  YYYYMMDDHHMMSS_jpc_extend_existing_rls.sql        # Phase 2
  YYYYMMDDHHMMSS_jpc_notification_triggers.sql      # Phase 3
  YYYYMMDDHHMMSS_jpc_realtime_publication.sql       # Phase 4
supabase/tests/
  jpc_self_rls.test.sql                             # pg_prove
  jpc_extended_rls_matrix.test.sql                  # pg_prove (5 tables × 4 personas × 4 ops)
  jpc_cascade_audit.test.sql                        # pg_prove
```

### 신규 (Client — uniqn-mobile/)
```
src/types/jobPostingCollaborator.ts
src/schemas/jobPostingCollaborator.schema.ts
src/repositories/jobPostingCollaboratorRepository.ts
src/services/job-posting/collaboratorService.ts
src/hooks/job-posting/useJobPostingCollaborators.ts
src/hooks/job-posting/useSharedJobPostings.ts
src/components/job-posting/CollaboratorRow.tsx
src/components/job-posting/CollaboratorList.tsx
src/components/job-posting/CollaboratorSearch.tsx
src/components/job-posting/CollaboratorAvatarStack.tsx
app/(employer)/my-postings/[id]/collaborators.tsx
```

### 수정 (Client)
```
app/(employer)/my-postings/index.tsx       # FlashList sections + 공유받은 공고
app/(employer)/my-postings/[id]/index.tsx  # 헤더에 CollaboratorAvatarStack
src/types/notification.ts                  # 신규 event_type 추가
src/hooks/notification/useDeepLink.ts      # collaborator deep link 처리
```

### 신규 테스트
```
src/services/job-posting/__tests__/collaboratorService.test.ts
src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx
src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx
src/repositories/__tests__/jobPostingCollaboratorRepository.test.ts
```

---

## Phase 0: Audit (pre-migration)

PR3-A.2 머지 후 즉시 시작. 결과를 본 plan 의 § Audit Results 섹션에 기록.

### Task 0.1: FK 참조 테이블 inventory

**Files:**
- Update: `docs/superpowers/plans/2026-05-11-job-posting-collaborators.md` (Audit Results 섹션)

- [ ] **Step 1: pg_constraint 조회**

```sql
-- via mcp__supabase__execute_sql
SELECT
  conrelid::regclass AS referencing_table,
  a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'public.job_postings'::regclass
ORDER BY referencing_table;
```

- [ ] **Step 2: 결과를 § Audit Results 에 기록**
- [ ] **Step 3: 영향 받는 테이블 목록을 RLS 변경 대상에 반영 (Phase 2 task 보강)**

### Task 0.2: 권한 호출면 audit

**Files:**
- Update: `docs/superpowers/plans/2026-05-11-job-posting-collaborators.md`

- [ ] **Step 1: pg_proc 에서 is_workspace_member/owner 호출 함수 조회**

```sql
SELECT n.nspname || '.' || p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.prosrc ILIKE '%is_workspace_member%' OR p.prosrc ILIKE '%is_workspace_owner%'
ORDER BY function_name;
```

- [ ] **Step 2: pg_views 에서 같은 패턴 조회**

```sql
SELECT schemaname || '.' || viewname AS view_name
FROM pg_views
WHERE definition ILIKE '%is_workspace_member%' OR definition ILIKE '%is_workspace_owner%';
```

- [ ] **Step 3: 클라이언트 코드 audit**

```bash
# Grep tool — workspace_id 직접 필터하는 모든 위치
grep -rn "workspace_id" uniqn-mobile/src/repositories/ uniqn-mobile/src/hooks/ uniqn-mobile/src/services/
```

- [ ] **Step 4: 결과를 § Audit Results 에 기록 (collaborator 시 재-검증 필요한 위치 표시)**

### Task 0.3: PR3-A.2 충돌 체크

**Files:**
- Read: `docs/superpowers/plans/2026-05-11-pr3a2-admin-rls-update-delete-split.md`

- [ ] **Step 1: PR3-A.2 가 변경하는 RLS 정책 목록 추출**
- [ ] **Step 2: 본 plan 의 RLS 변경 대상과 교차 비교**
- [ ] **Step 3: 충돌 시 머지 후 재-rebase 메모를 § Audit Results 에 기록**

### Task 0.4: Audit 결과 commit

- [ ] **Step 1: § Audit Results 섹션 완성 확인**
- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-05-11-job-posting-collaborators.md
git commit -m "docs(plan): collaborator audit 결과 기록 (Phase 0)"
```

---

## Phase 1: 신규 테이블 + 헬퍼 + 자체 RLS

### Task 1.1: `job_posting_collaborators` 테이블 + 인덱스

**Files:**
- Create: `supabase/migrations/<timestamp>_jpc_table_and_helper.sql`

- [ ] **Step 1: 마이그레이션 파일 생성 (timestamp = `date +%Y%m%d%H%M%S`)**

- [ ] **Step 2: 본 테이블 + 인덱스 SQL 작성**

```sql
-- supabase/migrations/<ts>_jpc_table_and_helper.sql
CREATE TABLE public.job_posting_collaborators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  added_by        uuid NOT NULL REFERENCES auth.users(id),
  added_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_posting_id, user_id),
  CHECK (user_id != added_by)
);

CREATE INDEX idx_jpc_user_id    ON public.job_posting_collaborators(user_id);
CREATE INDEX idx_jpc_posting_id ON public.job_posting_collaborators(job_posting_id);

ALTER TABLE public.job_posting_collaborators ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: 헬퍼 함수 추가 (같은 파일)**

```sql
CREATE FUNCTION public.is_posting_collaborator(p_posting_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.job_posting_collaborators
    WHERE job_posting_id = p_posting_id AND user_id = p_user_id
  );
$$;
```

- [ ] **Step 4: staging branch 에서 dry-run apply**

`mcp__supabase__create_branch` → `mcp__supabase__apply_migration` (staging branch_id) → `SELECT is_posting_collaborator(gen_random_uuid(), gen_random_uuid()) LIMIT 0` 호출 검증.

- [ ] **Step 5: Prod apply (PR3-A.2 머지 후)**

`mcp__supabase__apply_migration` (prod). 메모리: `supabase db push` 금지.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/<ts>_jpc_table_and_helper.sql
git commit -m "feat(supabase): job_posting_collaborators 테이블 + is_posting_collaborator 헬퍼"
```

### Task 1.2: Audit log 테이블 + 트리거

**Files:**
- Create: `supabase/migrations/<timestamp>_jpc_audit_log.sql`

- [ ] **Step 1: Audit 테이블 SQL 작성**

```sql
CREATE TABLE public.job_posting_collaborator_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id  uuid NOT NULL,
  target_user_id  uuid NOT NULL,
  actor_user_id   uuid,                                     -- NULL 허용 (system/cascade)
  action          text NOT NULL CHECK (action IN ('added','removed')),
  source          text NOT NULL DEFAULT 'user' CHECK (source IN ('user','system','cascade')),
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jpca_posting_id ON public.job_posting_collaborator_audit(job_posting_id, at DESC);
CREATE INDEX idx_jpca_target_id  ON public.job_posting_collaborator_audit(target_user_id, at DESC);

ALTER TABLE public.job_posting_collaborator_audit ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Audit 트리거 함수 작성 (같은 파일)**

```sql
CREATE FUNCTION public.log_collaborator_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_actor uuid;
BEGIN
  v_actor := auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action, source)
    VALUES (NEW.job_posting_id, NEW.user_id, NEW.added_by, 'added',
            CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.job_posting_collaborator_audit
      (job_posting_id, target_user_id, actor_user_id, action, source)
    VALUES (OLD.job_posting_id, OLD.user_id, v_actor, 'removed',
            CASE WHEN v_actor IS NULL THEN 'cascade' ELSE 'user' END);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_jpca_log
  AFTER INSERT OR DELETE ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.log_collaborator_audit();
```

- [ ] **Step 3: Audit 테이블 RLS — workspace owner 만 SELECT**

```sql
CREATE POLICY "audit_select_owner"
  ON public.job_posting_collaborator_audit
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.job_postings jp
      JOIN public.workspaces w ON w.id = jp.workspace_id
      WHERE jp.id = job_posting_collaborator_audit.job_posting_id
        AND w.owner_id = auth.uid()
    )
  );
-- INSERT/UPDATE/DELETE 정책 없음 → 트리거(SECURITY DEFINER)만 쓰기, 사용자 직접 조작 차단
```

- [ ] **Step 4: staging dry-run + prod apply + commit**

```bash
git add supabase/migrations/<ts>_jpc_audit_log.sql
git commit -m "feat(supabase): job_posting_collaborator_audit + AFTER trigger (cascade source 구분)"
```

### Task 1.3: `job_posting_collaborators` 자체 RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_jpc_self_rls.sql`

- [ ] **Step 1: RLS 정책 4종 작성**

```sql
-- SELECT: collaborator 본인
CREATE POLICY "jpc_select_self"
  ON public.job_posting_collaborators FOR SELECT
  USING (user_id = auth.uid());

-- SELECT: workspace 멤버
CREATE POLICY "jpc_select_ws_member"
  ON public.job_posting_collaborators FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND public.is_workspace_member(jp.workspace_id, auth.uid())
    )
  );

-- INSERT: workspace owner 만
CREATE POLICY "jpc_insert_ws_owner"
  ON public.job_posting_collaborators FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND public.is_workspace_owner(jp.workspace_id, auth.uid())
    )
    AND added_by = auth.uid()
  );

-- DELETE: workspace owner 또는 본인
CREATE POLICY "jpc_delete_owner_or_self"
  ON public.job_posting_collaborators FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS(
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND public.is_workspace_owner(jp.workspace_id, auth.uid())
    )
  );
-- UPDATE 정책 없음 → 행 immutable
```

- [ ] **Step 2: staging apply + prod apply + commit**

```bash
git add supabase/migrations/<ts>_jpc_self_rls.sql
git commit -m "feat(supabase): job_posting_collaborators 자체 RLS 4종"
```

### Task 1.4: pg_prove 자체 RLS 테스트

**Files:**
- Create: `supabase/tests/jpc_self_rls.test.sql`

- [ ] **Step 1: 테스트 시드 + 페르소나 4명**

```sql
-- supabase/tests/jpc_self_rls.test.sql
BEGIN;
SELECT plan(16);

-- 페르소나 시드 (ownerA, editorA, collaboratorA, outsiderX)
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'ownerA@test'),
  ('22222222-2222-2222-2222-222222222222', 'editorA@test'),
  ('33333333-3333-3333-3333-333333333333', 'collabA@test'),
  ('44444444-4444-4444-4444-444444444444', 'outsiderX@test');

INSERT INTO public.workspaces (id, owner_id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A 매장');

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');

INSERT INTO public.job_postings (id, workspace_id, title) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '딜러 모집');
```

- [ ] **Step 2: SELECT 정책 4 페르소나 검증 (4 assertions)**

```sql
-- ownerA: 빈 리스트 (collaborator 없음) → 0 rows
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT is(
  (SELECT count(*)::int FROM public.job_posting_collaborators
   WHERE job_posting_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'ownerA: 빈 collaborator 리스트'
);
-- 같은 패턴 editorA / collaboratorA / outsiderX
```

- [ ] **Step 3: INSERT 정책 (owner 만 성공, 나머지 실패)**

```sql
-- ownerA: 성공
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111"}';
SELECT lives_ok(
  $$ INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
     VALUES ('b0000000-0000-0000-0000-000000000001',
             '33333333-3333-3333-3333-333333333333',
             '11111111-1111-1111-1111-111111111111') $$,
  'ownerA: collaborator 추가 성공'
);

-- editorA: 실패 (workspace member 지만 owner 아님)
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222"}';
SELECT throws_ok(
  $$ INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
     VALUES ('b0000000-0000-0000-0000-000000000001',
             '44444444-4444-4444-4444-444444444444',
             '22222222-2222-2222-2222-222222222222') $$,
  'new row violates row-level security policy',
  'editorA: collaborator 추가 차단'
);
```

- [ ] **Step 4: DELETE 정책 (owner 가능, 본인 가능, 다른 사람 불가)**

`SELECT throws_ok` / `SELECT lives_ok` 페르소나별 케이스 작성. 자세한 매트릭스는 spec § 테스트 전략.

- [ ] **Step 5: 자가 추가 차단 CHECK + UNIQUE 충돌 테스트**

```sql
-- 자가 추가
SELECT throws_ok(
  $$ INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
     VALUES ('b0000000-0000-0000-0000-000000000001',
             '11111111-1111-1111-1111-111111111111',
             '11111111-1111-1111-1111-111111111111') $$,
  'check constraint',
  'CHECK 자가 추가 차단'
);
```

- [ ] **Step 6: ROLLBACK + plan 종료**

```sql
SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 7: pg_prove 로컬 실행**

```bash
cd supabase && pg_prove tests/jpc_self_rls.test.sql
```

Expected: All 16 tests pass.

- [ ] **Step 8: Commit**

```bash
git add supabase/tests/jpc_self_rls.test.sql
git commit -m "test(supabase): job_posting_collaborators 자체 RLS pg_prove 16 케이스"
```

---

## Phase 2: 기존 RLS 정책 OR 확장

영향 받는 테이블은 **Phase 0 audit 결과**로 확정. 아래는 spec 의 baseline.

### Task 2.1: `job_postings` SELECT/UPDATE OR

**Files:**
- Create: `supabase/migrations/<timestamp>_jpc_extend_existing_rls.sql`

- [ ] **Step 1: 기존 정책 DROP + 재생성 (OR 추가)**

```sql
-- 기존 정책 이름은 supabase/migrations/20260514010000_workspace_m3_consolidate_jp_rls.sql 참조
DROP POLICY IF EXISTS "jp_select_ws_member"   ON public.job_postings;
DROP POLICY IF EXISTS "jp_update_ws_member"   ON public.job_postings;

CREATE POLICY "jp_select_ws_or_collab"
  ON public.job_postings FOR SELECT
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
    OR public.is_posting_collaborator(id, auth.uid())
  );

CREATE POLICY "jp_update_ws_or_collab"
  ON public.job_postings FOR UPDATE
  USING (
    public.is_workspace_member(workspace_id, auth.uid())
    OR public.is_posting_collaborator(id, auth.uid())
  );
-- DELETE 정책은 변경 없음 (owner 전용 유지)
```

### Task 2.2: `workspaces` SELECT OR (Codex fix)

**Files:**
- Edit: 같은 마이그레이션 파일

- [ ] **Step 1: 기존 workspaces SELECT 정책 DROP + 재생성**

```sql
DROP POLICY IF EXISTS "ws_select_member" ON public.workspaces;

CREATE POLICY "ws_select_member_or_collab_source"
  ON public.workspaces FOR SELECT
  USING (
    public.is_workspace_member(id, auth.uid())
    OR EXISTS(
      SELECT 1 FROM public.job_postings jp
      JOIN public.job_posting_collaborators jpc ON jpc.job_posting_id = jp.id
      WHERE jp.workspace_id = workspaces.id AND jpc.user_id = auth.uid()
    )
  );
```

### Task 2.3~2.6: applications / staff_assignments / work_logs / settlements OR

**Files:**
- Edit: 같은 마이그레이션 파일

- [ ] **Step 1: 각 테이블 SELECT/UPDATE 정책 DROP + 재생성** (4 테이블 × 2 작업 = 8 정책)

각 테이블 패턴 동일 — Phase 0 audit 결과로 정확한 정책명 확정. 예시:

```sql
DROP POLICY IF EXISTS "applications_select_ws_member" ON public.applications;
CREATE POLICY "applications_select_ws_or_collab"
  ON public.applications FOR SELECT
  USING (
    public.is_workspace_member(
      (SELECT workspace_id FROM public.job_postings WHERE id = job_posting_id),
      auth.uid()
    )
    OR public.is_posting_collaborator(job_posting_id, auth.uid())
  );
-- UPDATE 동일 패턴
```

→ work_logs / settlements / staff_assignments 도 동일.

- [ ] **Step 2: staging dry-run — 4 페르소나 시드 + 각 테이블 SELECT 실측**
- [ ] **Step 3: prod apply + commit**

```bash
git add supabase/migrations/<ts>_jpc_extend_existing_rls.sql
git commit -m "feat(supabase): 5개 테이블 + workspaces RLS OR 확장 (collaborator 접근)"
```

### Task 2.7: pg_prove RLS 매트릭스 테스트 (5 테이블 × 4 페르소나 × 4 작업 = 80 케이스)

**Files:**
- Create: `supabase/tests/jpc_extended_rls_matrix.test.sql`

- [ ] **Step 1: 페르소나 + 시나리오 시드 (Task 1.4 와 동일 페르소나 + collaborator 행 추가)**

```sql
INSERT INTO public.job_posting_collaborators (job_posting_id, user_id, added_by)
VALUES ('b0000000-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111');
```

- [ ] **Step 2: 80 case 자동 생성 — plpgsql DO block 으로 loop**

```sql
DO $$
DECLARE
  v_persona text;
  v_uuid uuid;
  v_table text;
  v_op text;
  v_expected boolean;
BEGIN
  FOR v_persona, v_uuid IN VALUES
    ('owner',  '11111111-1111-1111-1111-111111111111'::uuid),
    ('editor', '22222222-2222-2222-2222-222222222222'::uuid),
    ('collab', '33333333-3333-3333-3333-333333333333'::uuid),
    ('out',    '44444444-4444-4444-4444-444444444444'::uuid)
  LOOP
    FOR v_table IN VALUES ('applications'), ('staff_assignments'), ('work_logs'), ('settlements')
    LOOP
      -- v_persona / v_table 별로 SELECT 실측 + assertion
      -- (test framework 호환 위해 PERFORM dynamic SQL 사용)
    END LOOP;
  END LOOP;
END $$;
```

(매트릭스 기대 결과는 spec § 테스트 전략의 표 참조)

- [ ] **Step 3: workspaces SELECT 별도 검증 (Codex fix)**

```sql
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333"}';
SELECT is(
  (SELECT count(*)::int FROM public.workspaces WHERE id = 'a0000000-0000-0000-0000-000000000001'),
  1,
  'collaborator: 출처 워크스페이스 1건 SELECT 가능'
);
```

- [ ] **Step 4: pg_prove 실행 + commit**

```bash
cd supabase && pg_prove tests/jpc_extended_rls_matrix.test.sql
git add supabase/tests/jpc_extended_rls_matrix.test.sql
git commit -m "test(supabase): collaborator RLS 매트릭스 80 케이스 + workspaces SELECT"
```

---

## Phase 3: Notification triggers + 타입

### Task 3.1: 협업자 추가/제거 알림 트리거 (cascade 가드)

**Files:**
- Create: `supabase/migrations/<timestamp>_jpc_notification_triggers.sql`

- [ ] **Step 1: notify_collaborator_added 함수 + 트리거**

```sql
CREATE FUNCTION public.notify_collaborator_added() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL THEN  -- cascade / system: skip
    RETURN NEW;
  END IF;
  INSERT INTO public.notification_outbox (user_id, event_type, payload)
  VALUES (
    NEW.user_id,
    'job_posting_collaborator_added',
    jsonb_build_object(
      'job_posting_id', NEW.job_posting_id,
      'added_by', NEW.added_by,
      'added_at', NEW.added_at
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jpc_added_notify
  AFTER INSERT ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.notify_collaborator_added();
```

- [ ] **Step 2: notify_collaborator_removed 함수 + 트리거 (동일 패턴)**

```sql
CREATE FUNCTION public.notify_collaborator_removed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = OLD.user_id THEN
    -- cascade 또는 본인 발 빼기: skip
    RETURN OLD;
  END IF;
  INSERT INTO public.notification_outbox (user_id, event_type, payload)
  VALUES (
    OLD.user_id,
    'job_posting_collaborator_removed',
    jsonb_build_object('job_posting_id', OLD.job_posting_id)
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_jpc_removed_notify
  AFTER DELETE ON public.job_posting_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.notify_collaborator_removed();
```

### Task 3.2: 신규 지원자 알림 — 수신자 UNION 확장

**Files:**
- Edit: 같은 마이그레이션 파일

- [ ] **Step 1: 기존 application INSERT 트리거 / RPC 위치 확인 (Phase 0 audit 결과)**
- [ ] **Step 2: 수신자 SELECT 에 collaborator UNION 추가**

```sql
-- 기존 함수 재정의 (예시 — 실제 함수명/구조는 audit 결과로 확정)
CREATE OR REPLACE FUNCTION public.fn_application_submitted_notify() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.notification_outbox (user_id, event_type, payload)
  WITH recipients AS (
    SELECT w.owner_id AS user_id
    FROM public.workspaces w
    JOIN public.job_postings jp ON jp.workspace_id = w.id
    WHERE jp.id = NEW.job_posting_id
    UNION
    SELECT wm.user_id
    FROM public.workspace_members wm
    JOIN public.job_postings jp ON jp.workspace_id = wm.workspace_id
    WHERE jp.id = NEW.job_posting_id
    UNION
    SELECT user_id
    FROM public.job_posting_collaborators
    WHERE job_posting_id = NEW.job_posting_id
  )
  SELECT user_id, 'application_submitted',
         jsonb_build_object('application_id', NEW.id, 'job_posting_id', NEW.job_posting_id)
  FROM recipients;
  RETURN NEW;
END;
$$;
```

- [ ] **Step 3: staging branch 에서 RPC 호출 검증 (메모리 학습: lazy 컴파일 방어)**

```sql
SELECT * FROM public.fn_application_submitted_notify() LIMIT 0;
```

- [ ] **Step 4: prod apply + commit**

```bash
git add supabase/migrations/<ts>_jpc_notification_triggers.sql
git commit -m "feat(supabase): collaborator 알림 트리거 + 지원자 알림 수신자 UNION 확장"
```

### Task 3.3: TypeScript notification 타입 추가

**Files:**
- Modify: `uniqn-mobile/src/types/notification.ts`

- [ ] **Step 1: 기존 NotificationEvent union 위치 확인** (Read 로 파일 열기)

- [ ] **Step 2: 신규 두 타입 추가**

```typescript
export type NotificationEvent =
  | /* ... existing ... */
  | {
      type: 'job_posting_collaborator_added';
      job_posting_id: string;
      added_by: string;
      added_at: string;
    }
  | {
      type: 'job_posting_collaborator_removed';
      job_posting_id: string;
    };
```

- [ ] **Step 3: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

Expected: 0 errors related to notification types.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/src/types/notification.ts
git commit -m "feat(types): collaborator added/removed notification event"
```

---

## Phase 4: Realtime publication

### Task 4.1: `supabase_realtime` publication ADD TABLE

**Files:**
- Create: `supabase/migrations/<timestamp>_jpc_realtime_publication.sql`

- [ ] **Step 1: 사전 확인 — 현재 publication 에 등록된 테이블 (메모리 학습: PR #67)**

```sql
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

- [ ] **Step 2: 마이그레이션 작성**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_posting_collaborators;
```

- [ ] **Step 3: staging apply 후 재확인**

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'job_posting_collaborators';
```

Expected: 1 row.

- [ ] **Step 4: prod apply + commit**

```bash
git add supabase/migrations/<ts>_jpc_realtime_publication.sql
git commit -m "feat(supabase): collaborator Realtime publication 등록"
```

---

## Phase 5: Repository + Service + 단위 테스트

### Task 5.1: Repository 작성

**Files:**
- Create: `uniqn-mobile/src/repositories/jobPostingCollaboratorRepository.ts`
- Create: `uniqn-mobile/src/types/jobPostingCollaborator.ts`
- Create: `uniqn-mobile/src/schemas/jobPostingCollaborator.schema.ts`
- Create: `uniqn-mobile/src/repositories/__tests__/jobPostingCollaboratorRepository.test.ts`

- [ ] **Step 1: Type + Zod schema 작성**

```typescript
// src/types/jobPostingCollaborator.ts
export interface JobPostingCollaborator {
  id: string;
  jobPostingId: string;
  userId: string;
  addedBy: string;
  addedAt: Date;
}
```

```typescript
// src/schemas/jobPostingCollaborator.schema.ts
import { z } from 'zod';
import { xssValidation } from './xss';

export const JobPostingCollaboratorSchema = z.object({
  id: z.string().uuid(),
  job_posting_id: z.string().uuid(),
  user_id: z.string().uuid(),
  added_by: z.string().uuid(),
  added_at: z.string(),
});

export const AddCollaboratorInputSchema = z.object({
  jobPostingId: z.string().uuid(),
  email: z.string().email().refine(xssValidation),
});

export type JobPostingCollaboratorRow = z.infer<typeof JobPostingCollaboratorSchema>;
export type AddCollaboratorInput = z.infer<typeof AddCollaboratorInputSchema>;
```

- [ ] **Step 2: Repository 테스트 작성 (TDD — RED)**

```typescript
// src/repositories/__tests__/jobPostingCollaboratorRepository.test.ts
import { jobPostingCollaboratorRepository } from '../jobPostingCollaboratorRepository';
import { mockSupabase } from '@/__mocks__/supabase';

describe('jobPostingCollaboratorRepository', () => {
  it('listByPostingId: snake_case row 을 camelCase JobPostingCollaborator 로 변환', async () => {
    mockSupabase.from('job_posting_collaborators').select.mockResolvedValueOnce({
      data: [{
        id: 'c1', job_posting_id: 'p1', user_id: 'u1',
        added_by: 'o1', added_at: '2026-05-11T00:00:00Z',
      }],
      error: null,
    });
    const result = await jobPostingCollaboratorRepository.listByPostingId('p1');
    expect(result).toEqual([{
      id: 'c1', jobPostingId: 'p1', userId: 'u1',
      addedBy: 'o1', addedAt: new Date('2026-05-11T00:00:00Z'),
    }]);
  });

  it('insert: optimistic 결과 변환', async () => {
    mockSupabase.from('job_posting_collaborators').insert.mockResolvedValueOnce({
      data: { id: 'c1', job_posting_id: 'p1', user_id: 'u1',
              added_by: 'o1', added_at: '2026-05-11T00:00:00Z' },
      error: null,
    });
    const result = await jobPostingCollaboratorRepository.insert('p1', 'u1', 'o1');
    expect(result.id).toBe('c1');
  });

  it('deleteById: error 시 throw', async () => {
    mockSupabase.from('job_posting_collaborators').delete.mockResolvedValueOnce({
      error: { message: 'rls' },
    });
    await expect(jobPostingCollaboratorRepository.deleteById('c1')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test → RED**

```bash
cd uniqn-mobile && npx jest src/repositories/__tests__/jobPostingCollaboratorRepository.test.ts
```

Expected: FAIL (모듈 없음)

- [ ] **Step 4: Repository 구현**

```typescript
// src/repositories/jobPostingCollaboratorRepository.ts
import { supabase } from '@/lib/supabase';
import { JobPostingCollaboratorSchema, type JobPostingCollaboratorRow } from '@/schemas/jobPostingCollaborator.schema';
import type { JobPostingCollaborator } from '@/types/jobPostingCollaborator';

const toCollaborator = (row: JobPostingCollaboratorRow): JobPostingCollaborator => ({
  id: row.id,
  jobPostingId: row.job_posting_id,
  userId: row.user_id,
  addedBy: row.added_by,
  addedAt: new Date(row.added_at),
});

export const jobPostingCollaboratorRepository = {
  async listByPostingId(postingId: string): Promise<JobPostingCollaborator[]> {
    const { data, error } = await supabase
      .from('job_posting_collaborators')
      .select('*')
      .eq('job_posting_id', postingId)
      .order('added_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => toCollaborator(JobPostingCollaboratorSchema.parse(r)));
  },

  async listByUserId(userId: string): Promise<JobPostingCollaborator[]> {
    const { data, error } = await supabase
      .from('job_posting_collaborators')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []).map(r => toCollaborator(JobPostingCollaboratorSchema.parse(r)));
  },

  async insert(postingId: string, userId: string, addedBy: string): Promise<JobPostingCollaborator> {
    const { data, error } = await supabase
      .from('job_posting_collaborators')
      .insert({ job_posting_id: postingId, user_id: userId, added_by: addedBy })
      .select()
      .single();
    if (error) throw error;
    return toCollaborator(JobPostingCollaboratorSchema.parse(data));
  },

  async deleteById(id: string): Promise<void> {
    const { error } = await supabase
      .from('job_posting_collaborators')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
```

- [ ] **Step 5: Run tests → GREEN**

```bash
npx jest src/repositories/__tests__/jobPostingCollaboratorRepository.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/src/types/jobPostingCollaborator.ts \
        uniqn-mobile/src/schemas/jobPostingCollaborator.schema.ts \
        uniqn-mobile/src/repositories/jobPostingCollaboratorRepository.ts \
        uniqn-mobile/src/repositories/__tests__/jobPostingCollaboratorRepository.test.ts
git commit -m "feat(repository): jobPostingCollaboratorRepository + Zod schema + 타입"
```

### Task 5.2: Service 작성 (검증 + 알림 + AppError)

**Files:**
- Create: `uniqn-mobile/src/services/job-posting/collaboratorService.ts`
- Create: `uniqn-mobile/src/services/job-posting/__tests__/collaboratorService.test.ts`

- [ ] **Step 1: Service 테스트 작성 (RED) — 9 케이스**

```typescript
// src/services/job-posting/__tests__/collaboratorService.test.ts
import { collaboratorService } from '../collaboratorService';
import { jobPostingCollaboratorRepository } from '@/repositories/jobPostingCollaboratorRepository';
import { workspaceRepository } from '@/repositories/workspaceRepository';
import { userService } from '@/services/user/userService';
import { AppError } from '@/errors/AppError';

jest.mock('@/repositories/jobPostingCollaboratorRepository');
jest.mock('@/repositories/workspaceRepository');
jest.mock('@/services/user/userService');

describe('collaboratorService.addCollaborator', () => {
  it('자기 자신 추가 → ValidationError (E3)', async () => {
    await expect(
      collaboratorService.addCollaborator({ jobPostingId: 'p1', email: 'me@test' }, 'me-uuid')
    ).rejects.toThrow(/자기 자신/);
  });

  it('UNIQN 미가입 사용자 → NotFoundError', async () => {
    (userService.findByEmail as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      collaboratorService.addCollaborator({ jobPostingId: 'p1', email: 'x@test' }, 'me')
    ).rejects.toThrow(/가입한 사용자/);
  });

  it('이미 workspace member → ConflictError + hint', async () => {
    (userService.findByEmail as jest.Mock).mockResolvedValueOnce({ id: 'u1' });
    (workspaceRepository.isMember as jest.Mock).mockResolvedValueOnce(true);
    await expect(
      collaboratorService.addCollaborator({ jobPostingId: 'p1', email: 'x@test' }, 'me')
    ).rejects.toThrow(/이미 워크스페이스 멤버/);
  });

  it('이미 collaborator → ConflictError', async () => { /* ... */ });

  it('성공 → repository.insert 호출 + outbox INSERT (트리거가 처리)', async () => {
    (userService.findByEmail as jest.Mock).mockResolvedValueOnce({ id: 'u1' });
    (workspaceRepository.isMember as jest.Mock).mockResolvedValueOnce(false);
    (jobPostingCollaboratorRepository.insert as jest.Mock).mockResolvedValueOnce({
      id: 'c1', jobPostingId: 'p1', userId: 'u1', addedBy: 'me', addedAt: new Date(),
    });
    const result = await collaboratorService.addCollaborator(
      { jobPostingId: 'p1', email: 'x@test' }, 'me'
    );
    expect(result.id).toBe('c1');
  });
});

describe('collaboratorService.removeCollaborator', () => {
  it('owner 가 제거 → repository.delete 호출', async () => { /* ... */ });
  it('collaborator 본인 제거 → 성공', async () => { /* ... */ });
  it('다른 collaborator 가 시도 → AuthError (RLS error 변환)', async () => { /* ... */ });
});

describe('collaboratorService.listCollaborators', () => {
  it('workspace 멤버 read-only 조회', async () => { /* ... */ });
});
```

- [ ] **Step 2: RED 확인**

```bash
npx jest src/services/job-posting/__tests__/collaboratorService.test.ts
```

- [ ] **Step 3: Service 구현**

```typescript
// src/services/job-posting/collaboratorService.ts
import { jobPostingCollaboratorRepository } from '@/repositories/jobPostingCollaboratorRepository';
import { workspaceRepository } from '@/repositories/workspaceRepository';
import { userService } from '@/services/user/userService';
import { AppError } from '@/errors/AppError';
import type { AddCollaboratorInput } from '@/schemas/jobPostingCollaborator.schema';

export const collaboratorService = {
  async addCollaborator(input: AddCollaboratorInput, currentUserId: string) {
    const target = await userService.findByEmail(input.email);
    if (!target) {
      throw new AppError('E3', 'UNIQN에 가입한 사용자만 추가할 수 있어요');
    }
    if (target.id === currentUserId) {
      throw new AppError('E3', '자기 자신은 추가할 수 없어요');
    }
    const posting = await jobPostingRepository.findById(input.jobPostingId);
    if (!posting) {
      throw new AppError('E3', '존재하지 않는 공고입니다');
    }
    const isMember = await workspaceRepository.isMember(posting.workspaceId, target.id);
    if (isMember) {
      throw new AppError('E6', '이미 워크스페이스 멤버 — 모든 공고 접근 가능');
    }
    const existing = await jobPostingCollaboratorRepository.listByPostingId(input.jobPostingId);
    if (existing.some(c => c.userId === target.id)) {
      throw new AppError('E6', '이미 협업자입니다');
    }
    return jobPostingCollaboratorRepository.insert(input.jobPostingId, target.id, currentUserId);
  },

  async removeCollaborator(collaboratorId: string) {
    try {
      await jobPostingCollaboratorRepository.deleteById(collaboratorId);
    } catch (e: any) {
      if (e?.message?.includes('row-level security')) {
        throw new AppError('E2', '제거 권한이 없습니다');
      }
      throw e;
    }
  },

  async listCollaborators(jobPostingId: string) {
    return jobPostingCollaboratorRepository.listByPostingId(jobPostingId);
  },
};
```

- [ ] **Step 4: Run → GREEN**

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/services/job-posting/collaboratorService.ts \
        uniqn-mobile/src/services/job-posting/__tests__/collaboratorService.test.ts
git commit -m "feat(service): collaboratorService + 9 단위 테스트"
```

---

## Phase 6: Hooks (TanStack Query + Realtime)

### Task 6.1: `useJobPostingCollaborators` (owner 모달용)

**Files:**
- Create: `uniqn-mobile/src/hooks/job-posting/useJobPostingCollaborators.ts`
- Create: `uniqn-mobile/src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx`

- [ ] **Step 1: 테스트 작성 (RED)**

```typescript
// __tests__/useJobPostingCollaborators.test.tsx
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useJobPostingCollaborators } from '../useJobPostingCollaborators';
import { collaboratorService } from '@/services/job-posting/collaboratorService';
import { wrapper } from '@/__tests__/queryWrapper';

jest.mock('@/services/job-posting/collaboratorService');

it('낙관적 추가 → 실패 시 롤백', async () => {
  (collaboratorService.listCollaborators as jest.Mock).mockResolvedValue([]);
  (collaboratorService.addCollaborator as jest.Mock).mockRejectedValueOnce(new Error('rls'));

  const { result } = renderHook(() => useJobPostingCollaborators('p1'), { wrapper });
  await waitFor(() => expect(result.current.data).toEqual([]));

  await act(async () => {
    try { await result.current.add({ jobPostingId: 'p1', email: 'x@test' }); } catch {}
  });

  expect(result.current.data).toEqual([]);  // 롤백됨
});

it('Realtime INSERT 이벤트 → 캐시에 추가', async () => {
  // mock supabase channel, emit INSERT event, assert cache 갱신
});

it('Realtime DELETE 이벤트 → 캐시에서 제거', async () => { /* ... */ });

it('unmount 시 channel unsubscribe', async () => { /* ... */ });
```

- [ ] **Step 2: Hook 구현**

```typescript
// src/hooks/job-posting/useJobPostingCollaborators.ts
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { collaboratorService } from '@/services/job-posting/collaboratorService';
import type { JobPostingCollaborator } from '@/types/jobPostingCollaborator';

export function useJobPostingCollaborators(jobPostingId: string, currentUserId: string) {
  const qc = useQueryClient();
  const key = ['job-posting-collaborators', jobPostingId];

  const query = useQuery({
    queryKey: key,
    queryFn: () => collaboratorService.listCollaborators(jobPostingId),
    staleTime: 30_000,
  });

  const add = useMutation({
    mutationFn: (input: { jobPostingId: string; email: string }) =>
      collaboratorService.addCollaborator(input, currentUserId),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<JobPostingCollaborator[]>(key) ?? [];
      qc.setQueryData<JobPostingCollaborator[]>(key, [
        ...prev,
        { id: 'optimistic', jobPostingId: input.jobPostingId,
          userId: 'pending', addedBy: currentUserId, addedAt: new Date() },
      ]);
      return { prev };
    },
    onError: (_, __, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: collaboratorService.removeCollaborator,
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`jpc-${jobPostingId}`)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'job_posting_collaborators',
            filter: `job_posting_id=eq.${jobPostingId}` },
          () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobPostingId, qc]);

  return { ...query, add: add.mutateAsync, remove: remove.mutateAsync };
}
```

- [ ] **Step 3: Run → GREEN + commit**

```bash
git add uniqn-mobile/src/hooks/job-posting/useJobPostingCollaborators.ts \
        uniqn-mobile/src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx
git commit -m "feat(hook): useJobPostingCollaborators TanStack Query + Realtime + 낙관적 업데이트"
```

### Task 6.2: `useSharedJobPostings` (collaborator 의 공유받은 공고)

**Files:**
- Create: `uniqn-mobile/src/hooks/job-posting/useSharedJobPostings.ts`
- Create: `uniqn-mobile/src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx`

- [ ] **Step 1: 테스트 작성 (RED)**

```typescript
it('collaborator 인 공고만 반환 + workspace 이름 JOIN', async () => {
  // mock RPC 또는 supabase query
  const { result } = renderHook(() => useSharedJobPostings('user-1'), { wrapper });
  await waitFor(() => {
    expect(result.current.data).toEqual([
      { id: 'p1', title: '딜러', sourceWorkspaceName: 'A 매장', /* ... */ },
    ]);
  });
});

it('빈 결과 → 빈 배열', async () => { /* ... */ });
```

- [ ] **Step 2: Hook 구현**

```typescript
// src/hooks/job-posting/useSharedJobPostings.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface SharedJobPosting {
  id: string;
  title: string;
  sourceWorkspaceName: string;
  // ... 기존 JobPosting 필드
}

export function useSharedJobPostings(userId: string) {
  return useQuery({
    queryKey: ['shared-job-postings', userId],
    queryFn: async () => {
      // RLS OR 가 workspaces SELECT 도 허용하므로 직접 JOIN 가능
      const { data, error } = await supabase
        .from('job_postings')
        .select('*, workspaces!inner(name)')
        .in('id', (
          await supabase.from('job_posting_collaborators')
            .select('job_posting_id').eq('user_id', userId)
        ).data?.map(r => r.job_posting_id) ?? []);
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        sourceWorkspaceName: row.workspaces.name,
      }));
    },
    staleTime: 30_000,
  });
}
```

→ 또는 RPC 함수로 단일 호출 (성능 최적화 시점에 결정).

- [ ] **Step 3: Run → GREEN + commit**

```bash
git add uniqn-mobile/src/hooks/job-posting/useSharedJobPostings.ts \
        uniqn-mobile/src/hooks/job-posting/__tests__/useSharedJobPostings.test.tsx
git commit -m "feat(hook): useSharedJobPostings + workspace 이름 JOIN"
```

---

## Phase 7: UI — Owner 측

### Task 7.1: `CollaboratorRow` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/job-posting/CollaboratorRow.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
// src/components/job-posting/CollaboratorRow.tsx
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import type { JobPostingCollaborator } from '@/types/jobPostingCollaborator';

interface Props {
  collaborator: JobPostingCollaborator & { displayName: string; email: string; avatarUrl?: string };
  canRemove: boolean;
  onRemove?: () => void;
}

export function CollaboratorRow({ collaborator, canRemove, onRemove }: Props) {
  return (
    <View className="flex-row items-center py-3 px-4 bg-surface dark:bg-surface">
      <Image source={collaborator.avatarUrl} className="w-10 h-10 rounded-full bg-content-tertiary" />
      <View className="flex-1 ml-3">
        <Text className="text-content-primary dark:text-content-primary font-medium">
          {collaborator.displayName}
        </Text>
        <Text className="text-content-secondary dark:text-content-secondary text-sm">
          {collaborator.email}
        </Text>
      </View>
      {canRemove && (
        <Pressable onPress={onRemove} className="p-2">
          <Text className="text-error">✕</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Snapshot 또는 가벼운 RNTL 테스트 (선택)**
- [ ] **Step 3: Commit**

```bash
git add uniqn-mobile/src/components/job-posting/CollaboratorRow.tsx
git commit -m "feat(ui): CollaboratorRow — 협업자 1명 행"
```

### Task 7.2: `CollaboratorList` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/job-posting/CollaboratorList.tsx`

- [ ] **Step 1: List + 빈 상태 작성**

```tsx
// src/components/job-posting/CollaboratorList.tsx
import { View, Text, ActivityIndicator } from 'react-native';
import { CollaboratorRow } from './CollaboratorRow';
import type { JobPostingCollaborator } from '@/types/jobPostingCollaborator';

interface Props {
  collaborators: (JobPostingCollaborator & { displayName: string; email: string })[];
  loading: boolean;
  currentUserId: string;
  isOwner: boolean;
  onRemove: (id: string) => void;
}

export function CollaboratorList({ collaborators, loading, currentUserId, isOwner, onRemove }: Props) {
  if (loading) return <ActivityIndicator />;
  if (collaborators.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-content-secondary dark:text-content-secondary">
          아직 협업자가 없어요
        </Text>
      </View>
    );
  }
  return (
    <View>
      <Text className="text-content-secondary dark:text-content-secondary px-4 py-2 text-xs">
        현재 협업자 ({collaborators.length})
      </Text>
      {collaborators.map(c => (
        <CollaboratorRow
          key={c.id}
          collaborator={c}
          canRemove={isOwner || c.userId === currentUserId}
          onRemove={() => onRemove(c.id)}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

### Task 7.3: `CollaboratorSearch` 컴포넌트

**Files:**
- Create: `uniqn-mobile/src/components/job-posting/CollaboratorSearch.tsx`

- [ ] **Step 1: Debounced 검색 + 결과 카드 + 예외 케이스**

```tsx
// 핵심 로직:
// - useDebouncedValue(email, 300)
// - useQuery(['user-search', debouncedEmail])
// - 결과: 자기 자신 제외, 워크스페이스 멤버 hint, collaborator hint, 미가입 안내
// - onAdd: collaboratorService.addCollaborator (낙관적, useJobPostingCollaborators.add 호출)
```

(자세한 코드는 spec § 협업자 관리 화면 참조)

- [ ] **Step 2: Commit**

### Task 7.4: `collaborators.tsx` 라우트 (모달)

**Files:**
- Create: `uniqn-mobile/app/(employer)/my-postings/[id]/collaborators.tsx`

- [ ] **Step 1: 라우트 작성 (Stack `presentation: 'modal'`)**

```tsx
// app/(employer)/my-postings/[id]/collaborators.tsx
import { useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView } from 'react-native';
import { CollaboratorSearch } from '@/components/job-posting/CollaboratorSearch';
import { CollaboratorList } from '@/components/job-posting/CollaboratorList';
import { useJobPostingCollaborators } from '@/hooks/job-posting/useJobPostingCollaborators';
import { useAuth } from '@/hooks/auth/useAuth';

export default function CollaboratorsModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading, add, remove } = useJobPostingCollaborators(id!, user!.id);
  const isOwner = /* check workspace owner */;

  return (
    <ScrollView className="flex-1 bg-bg-primary dark:bg-bg-primary">
      <Text className="text-content-primary dark:text-content-primary text-lg font-bold p-4">
        협업자 관리
      </Text>
      {isOwner && <CollaboratorSearch onAdd={add} jobPostingId={id!} />}
      <CollaboratorList
        collaborators={(data as any) ?? []}
        loading={isLoading}
        currentUserId={user!.id}
        isOwner={isOwner}
        onRemove={remove}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 2: `app/(employer)/my-postings/[id]/_layout.tsx` 에 modal screen 등록**

- [ ] **Step 3: Commit**

```bash
git add uniqn-mobile/app/(employer)/my-postings/[id]/collaborators.tsx \
        uniqn-mobile/app/(employer)/my-postings/[id]/_layout.tsx
git commit -m "feat(ui): collaborators 모달 라우트"
```

### Task 7.5: 공고 상세 헤더에 `CollaboratorAvatarStack` + 공유 관리 버튼

**Files:**
- Create: `uniqn-mobile/src/components/job-posting/CollaboratorAvatarStack.tsx`
- Modify: `uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx`

- [ ] **Step 1: AvatarStack 컴포넌트 작성**

```tsx
// 아바타 3개 + "+N" overflow + "공유 관리" 텍스트
// 0명일 때: "+ 협업자 추가" CTA
// 탭 → router.push('/my-postings/[id]/collaborators')
```

- [ ] **Step 2: 공고 상세 헤더에 삽입 (해당 위치 grep 으로 확정)**

```bash
grep -n "Header\|title" uniqn-mobile/app/\(employer\)/my-postings/\[id\]/index.tsx
```

- [ ] **Step 3: Commit**

### Task 7.6: 공고 목록 카드 인디케이터

**Files:**
- Modify: `uniqn-mobile/app/(employer)/my-postings/index.tsx`

- [ ] **Step 1: 공고 카드에 협업자 수 ≥1 시 `●●● N` 뱃지 추가**
- [ ] **Step 2: 공고 카드 컴포넌트가 별도 파일이면 그곳을 수정**
- [ ] **Step 3: Commit**

---

## Phase 8: UI — 받는 사람 동선

### Task 8.1: `my-postings/index.tsx` FlashList sections

**Files:**
- Modify: `uniqn-mobile/app/(employer)/my-postings/index.tsx`

- [ ] **Step 1: FlashList sections 구조로 변경**

```tsx
// useJobPostings + useSharedJobPostings 둘 다 호출
// FlashList 의 ListHeaderComponent 사용 또는 sections 데이터 구성
//
// 데이터:
// [
//   { type: 'header', title: '내 공고', count: 5 },
//   ...내 공고 카드들,
//   { type: 'header', title: '공유받은 공고', count: 2 },  // 0개일 땐 미렌더
//   ...공유받은 공고 카드들,
// ]
```

- [ ] **Step 2: 공유받은 공고 카드에 🔗 아이콘 + `@박사장님 워크스페이스` 출처 표시**

- [ ] **Step 3: 0개일 때 섹션 헤더 자체 미렌더 검증 (조건부 sections 추가)**

- [ ] **Step 4: 카드 탭 → 공고 상세 진입 (기존 동작)**

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/app/\(employer\)/my-postings/index.tsx
git commit -m "feat(ui): my-postings FlashList sections — 내 공고 / 공유받은 공고 분리"
```

### Task 8.2: 공고 상세 헤더 출처 워크스페이스 표시 (collaborator 시점)

**Files:**
- Modify: `uniqn-mobile/app/(employer)/my-postings/[id]/index.tsx`

- [ ] **Step 1: 현재 사용자가 collaborator 면 헤더에 `🔗 박사장님 워크스페이스의 공고` 표시**
- [ ] **Step 2: workspace owner 와 공고 owner_id 가 다를 때 분기**
- [ ] **Step 3: Commit**

### Task 8.3: Self-remove 후 화면/캐시/Realtime 정리

**Files:**
- Modify: `uniqn-mobile/src/services/job-posting/collaboratorService.ts` (또는 hook 단)
- Modify: `uniqn-mobile/src/hooks/job-posting/useJobPostingCollaborators.ts`

- [ ] **Step 1: Self-remove 시 cleanup 로직 (spec § Self-remove 정리 5단계)**

```typescript
// hook 의 remove mutation onSuccess 에서:
// - queryClient.invalidateQueries(['shared-job-postings'])
// - queryClient.removeQueries(['job-posting', jobPostingId])  // 권한 잃은 캐시 제거
// - 모달이면 닫기 (router.back())
// - 상세 진입 상태였으면 router.replace('/my-postings')
// - Realtime 채널 unsubscribe (useEffect cleanup 이 자동 처리)
```

- [ ] **Step 2: Push deep link 핸들러 — 권한 없는 공고 클릭 시 my-postings 로 fallback**

**Files:**
- Modify: `uniqn-mobile/src/hooks/notification/useDeepLink.ts` (또는 router config)

- [ ] **Step 3: Commit**

```bash
git add uniqn-mobile/src/services/job-posting/collaboratorService.ts \
        uniqn-mobile/src/hooks/job-posting/useJobPostingCollaborators.ts \
        uniqn-mobile/src/hooks/notification/useDeepLink.ts
git commit -m "feat(ui): self-remove 후 캐시/Realtime/네비게이션 cleanup"
```

---

## Phase 9: Push 알림 핸들러

### Task 9.1: Edge Function event_type 처리

**Files:**
- Modify: `uniqn-mobile/supabase/functions/sync-schedule-board-outbox/index.ts` (또는 별도 push function)

- [ ] **Step 1: 신규 event_type 분기 추가 — title/body 매핑**

```typescript
// 이미 outbox → expo push 흐름이 있으므로 event_type 분기에 추가
case 'job_posting_collaborator_added': {
  const { added_by_name, job_posting_title } = payload;
  return {
    title: '🤝 새 공고에 초대받았어요',
    body: `${added_by_name}님이 "${job_posting_title}" 공고 관리에 초대했어요`,
    data: { type: 'collaborator_added', job_posting_id: payload.job_posting_id },
  };
}
case 'job_posting_collaborator_removed': {
  return {
    title: '공고 관리 권한이 종료되었어요',
    body: `${payload.job_posting_title} 공고에서 제외되었어요`,
    data: { type: 'collaborator_removed' },
  };
}
```

- [ ] **Step 2: Edge function 자동 배포 (CI 워크플로우 활용 — 메모리 참조)**
- [ ] **Step 3: Commit**

### Task 9.2: 클라이언트 deep link 핸들러

**Files:**
- Modify: `uniqn-mobile/src/hooks/notification/useDeepLink.ts`

- [ ] **Step 1: 알림 탭 시 라우팅**

```typescript
case 'collaborator_added':
  router.push('/(employer)/my-postings');  // 공유받은 공고 섹션으로
  break;
case 'collaborator_removed':
  router.push('/(employer)/my-postings');
  break;
```

- [ ] **Step 2: 권한 잃은 공고 click → fallback (Task 8.3 의 try-catch)**
- [ ] **Step 3: Commit**

---

## Phase 10: 엣지 케이스 + 통합 테스트

### Task 10.1: Cascade 시나리오 pg_prove 테스트

**Files:**
- Create: `uniqn-mobile/supabase/tests/jpc_cascade_audit.test.sql`

- [ ] **Step 1: 3 시나리오 (workspace 삭제 / user 탈퇴 / 공고 삭제)**

```sql
BEGIN; SELECT plan(6);

-- 시나리오 1: 공고 삭제 → collaborator cascade + audit source='cascade'
INSERT INTO public.job_posting_collaborators (...) VALUES (...);
DELETE FROM public.job_postings WHERE id = '...';
SELECT is(
  (SELECT count(*) FROM public.job_posting_collaborators WHERE job_posting_id = '...'),
  0::bigint, '공고 삭제 시 collaborator cascade'
);
SELECT is(
  (SELECT source FROM public.job_posting_collaborator_audit
   WHERE job_posting_id = '...' AND action = 'removed'),
  'cascade', 'audit source=cascade 기록'
);
-- + 알림 outbox 비어있는지

-- 시나리오 2: user 탈퇴
-- 시나리오 3: workspace 삭제

SELECT * FROM finish(); ROLLBACK;
```

- [ ] **Step 2: Owner 이양 테스트도 같은 파일에 추가**
- [ ] **Step 3: pg_prove 실행 + commit**

### Task 10.2: Hook 엣지 케이스 테스트 (네트워크/UNIQUE/race)

**Files:**
- Modify: `uniqn-mobile/src/hooks/job-posting/__tests__/useJobPostingCollaborators.test.tsx`

- [ ] **Step 1: 테스트 4개 추가 (D12)**

- 네트워크 끊김 → 낙관적 업데이트 후 롤백 + toast
- 푸시 알림 받은 직후 강제 종료 → 재실행 → my-postings 정상 노출 (deep link 큐잉)
- 동시 추가 → UNIQUE 충돌 → ConflictError 친절 메시지
- workspace 이양 후 신규 owner DELETE 권한 (E2E 또는 service test)

- [ ] **Step 2: Run + commit**

### Task 10.3: UI 스모크 테스트 (3 시나리오)

**Files:**
- Create: `uniqn-mobile/src/__tests__/integration/collaborator-flow.test.tsx`

- [ ] **Step 1: 3 시나리오 (spec § 테스트 전략)**
- [ ] **Step 2: Run + commit**

### Task 10.4: 성능 EXPLAIN ANALYZE 측정

**Files:**
- Create: `docs/superpowers/plans/2026-05-11-job-posting-collaborators.md` (§ Performance Results)

- [ ] **Step 1: staging branch 에서 baseline (RLS OR 적용 전) 측정**
- [ ] **Step 2: RLS OR 적용 후 측정 (목록/카운트/feed/UNION trigger)**
- [ ] **Step 3: 결과 표 형태로 plan 에 기록**
- [ ] **Step 4: 미달 시 인덱스 추가 마이그레이션 + 재측정**

### Task 10.5: 푸시 알림 end-to-end 검증

- [ ] **Step 1: staging branch 에서 실제 collaborator 추가 → 트리거 → outbox → edge function → expo push → 디바이스 도착 확인**
- [ ] **Step 2: `mcp__supabase__get_logs` 로 edge function 로그 확인 (메모리 패턴)**
- [ ] **Step 3: cascade 시 알림 안 가는지 확인 (Codex #7 수정 검증)**

### Task 10.6: 최종 quality + PR

- [ ] **Step 1: `cd uniqn-mobile && npm run quality`**

Expected: type-check 0 errors, lint clean, format clean.

- [ ] **Step 2: `npm test` 전체 통과**

- [ ] **Step 3: `/cso` 보안 검사 (RLS + XSS + secrets)**

- [ ] **Step 4: `/review` PR 사전 리뷰**

- [ ] **Step 5: `/pr` 로 PR 생성**

```bash
# /pr skill 호출
```

- [ ] **Step 6: PR 본문에 spec/plan 링크 + Phase별 commits 요약 포함**

---

## § Audit Results (Phase 0 산출물 — 2026-05-12)

> MCP `execute_sql` audit 완료. **prod DB** 기준.

### Task 0.1 — FK 참조 테이블 inventory

`pg_constraint` 조회 결과 — `public.job_postings` 를 FK 로 참조하는 테이블 **7개**:

| referencing_table | column | on_delete | RLS workspace 의존 |
|---|---|---|---|
| `applications` | `job_posting_id` | NO ACTION | ✅ `app_select`/`app_update` (is_workspace_member) |
| `board_memberships` | `job_posting_id` | NO ACTION | ❌ user_id scope only |
| `board_posts` | `linked_job_posting_id` | NO ACTION | ❌ author/visibility scope only |
| `event_qr_codes` | `job_posting_id` | NO ACTION | ✅ `qr_select`/`qr_update`/`qr_delete` (is_workspace_member) |
| `reports` | `job_posting_id` | NO ACTION | ❌ reporter/admin scope only |
| `reviews` | `job_posting_id` | NO ACTION | ❌ reviewer/reviewee/admin scope only |
| `work_logs` | `job_posting_id` | NO ACTION | ✅ `wl_select`/`wl_update` (is_workspace_member) |

**Phase 2 RLS OR 추가 대상 (workspace 의존 3 테이블 + jp 자체 + workspaces)**:
- `job_postings` (jp_select_managed, jp_update_workspace_member)
- `applications` (app_select, app_update)
- `event_qr_codes` (qr_select, qr_update, qr_delete) — **Spec 누락! 추가 필요**
- `work_logs` (wl_select, wl_update)
- `workspaces` (workspaces_select_owner_or_member — useSharedJobPostings JOIN 용)

**Phase 2 OR 추가 제외 (user-scope RLS — collaborator 권한과 무관)**:
- `board_memberships`, `board_posts` (게시판은 공고 종속이 아닌 일반 컨텐츠)
- `reports`, `reviews` (당사자 SoT — collaborator 가 자기 공고 신고/리뷰 조회 권한 없음, 의도된 격리)

**⚠ Spec D2 가정 보정 필요**:
- `staff_assignments` — **테이블 미존재** (spec 추정 오류, applications + work_logs 가 스태프 모델 대체)
- `settlements` — **테이블 미존재** (work_logs.payroll_* 필드에 정산 데이터 저장. SettlementRepository.ts:13 명시. work_logs RLS OR 추가로 정산 권한 자동 부여)
- D2 "스태프/work_logs/settlements" → 실제는 "applications + work_logs + event_qr_codes" 만 해당

**⚠ on_delete=NO ACTION 영향**:
- 공고 삭제 시 cascade 안 됨 — 의도된 정책 (공고가 응시 이력/리뷰를 끌고 가지 않음)
- `job_posting_collaborators` 본 테이블은 spec 대로 `ON DELETE CASCADE` 유지

### Task 0.2 — 권한 호출면 audit

**pg_proc (2건)**:

| function_name | uses | 영향 |
|---|---|---|
| `public.enforce_jp_status_transition` | inline owner check (function 미사용) | ⚠ collaborator status 변경 권한 검증 필요 |
| `public.get_workspace_owner_profile` | calls `is_workspace_member` | ✅ 조회만, collaborator 안 봐도 됨 |

**`enforce_jp_status_transition` 상세 분석 필요** — collaborator 가 공고 status (open/closed) 변경 가능해야 한다면 (D2 풀 관리권), 이 trigger function 안에서도 OR 추가 또는 collaborator 식별 분기 필요. **Phase 2 별도 task 로 분리**.

**pg_views**: 0건 (workspace_id/is_workspace_member 호출 view 없음)

**Client repository workspace_id 명시 필터 (7곳)**:
- `src/repositories/supabase/JobPostingRepository.ts:397` — `if (workspaceId) query = query.eq('workspace_id', workspaceId)` ⚠ collaborator 시점에 workspaceId 미지정으로 호출 (useSharedJobPostings 별도 hook 사용)
- `src/repositories/supabase/WorkLogRepository.ts`
- `src/repositories/supabase/SettlementRepository.ts` ✅ (소스 확인 — `work_logs.payroll_*` 필드만 사용, 별도 `settlements` 테이블 없음. work_logs RLS OR 추가로 자동 적용됨)
- `src/repositories/supabase/WorkspaceRepository.ts`
- `src/repositories/supabase/WorkspaceMemberRepository.ts`
- `src/repositories/supabase/WorkspaceInvitationRepository.ts`
- `src/repositories/supabase/ApplicationRepositoryHelpers.ts`

**Hooks (3건)**:
- `src/hooks/workspace/useWorkspaces.ts`
- `src/hooks/workspace/useWorkspaceRevocationGuard.ts`
- 동 test 1건

→ collaborator 시점에서 본인 workspace 컨텍스트 안에서만 조회되도록 useSharedJobPostings 가 명시적 우회 hook 으로 동작 (spec 설계대로). 기존 hook/repo 는 변경 불필요.

### Task 0.3 — PR3-A.2 충돌 체크

`git show 59b6a8d9b` (머지 완료, master):

**PR3-A.2 변경분**:
- 제거: `app_update`, `qr_update`, `qr_delete`, `wl_update` 의 admin 분기 4건
- 추가: `workspace_members` deny-all 정책 2건
- 변경: `JobPostingRepository.loadAndVerifyMutateAccess` admin 분기 throw

**본 plan Phase 2 OR 추가 대상과 비교**:
- `app_update`: PR3-A.2 admin 제거 → 본 작업 collaborator OR 추가 (**비충돌 — 다른 분기**)
- `qr_update/qr_delete`: PR3-A.2 admin 제거 → 본 작업 collaborator OR 추가 (**비충돌**)
- `wl_update`: PR3-A.2 admin 제거 → 본 작업 collaborator OR 추가 (**비충돌**)
- `app_select`, `qr_select`, `wl_select`, `jp_select_managed`, `jp_update_workspace_member`, `workspaces_select_owner_or_member`: PR3-A.2 미변경 → 본 작업만 변경 (**비충돌**)

**결론**: PR3-A.2 와 본 작업은 정책 분기가 서로 직교 (admin 제거 vs collaborator OR 추가). 마이그레이션 순서 의존성 없음.

### 추가 발견 — Realtime publication 현황

`pg_publication_tables` (supabase_realtime, 2026-05-12):
- 포함: `applications`, `board_comments`, `board_posts`, `notification_counters`, `notifications`, `work_logs`, `workspace_members`
- 미포함: `workspaces`, `job_postings`, `event_qr_codes` 등

**Phase 4 작업** — `ALTER PUBLICATION supabase_realtime ADD TABLE public.job_posting_collaborators` 만 추가 (workspaces / job_postings 변경은 본 작업 범위 외).

### Audit 결론 — Phase 2 변경 대상 확정

| 테이블 | 변경 정책 | 비고 |
|---|---|---|
| workspaces | `workspaces_select_owner_or_member` | useSharedJobPostings JOIN |
| job_postings | `jp_select_managed`, `jp_update_workspace_member` | D2 풀 관리권 |
| applications | `app_select`, `app_update` | 지원자 보기/승인 |
| work_logs | `wl_select`, `wl_update` | 근태 조회/편집 |
| event_qr_codes | `qr_select`, `qr_update`, `qr_delete` | **Spec 누락 — 추가** |
| (function) `enforce_jp_status_transition` | inline owner OR collaborator | **별도 task 로 분리 필요** |

**Spec/Plan 보정 필요 항목** (Option 3 task 4):
1. D2 의 "스태프/settlements" 표현 명확화 (settlements = work_logs.payroll 필드, 별도 테이블 아님)
2. event_qr_codes 추가 (Phase 2 누락)
3. enforce_jp_status_transition 변경 task 신설

## § Performance Results (Task 10.4 산출물)

> Task 10.4 완료 시 채워짐.

```
[목록 조회 — job_postings WHERE workspace_id]
- baseline:  (ms)
- with OR:   (ms)
- regression: (%)

[지원자 카운트]
- baseline:  (ms)
- with OR:   (ms)

[application INSERT trigger UNION]
- baseline:  (ms)
- with collaborator UNION: (ms)
```

---

## Dependencies & Sequencing

```
Phase 0 (audit) ─→ Phase 1 (table) ─→ Phase 2 (existing RLS)
                                          ↓
                          Phase 3 (notify) ─→ Phase 4 (realtime)
                                          ↓
                              Phase 5 (repo+service)
                                          ↓
                              Phase 6 (hooks)
                                          ↓
                          Phase 7 (owner UI) ─→ Phase 8 (receiver UI) ─→ Phase 9 (push handler)
                                          ↓
                              Phase 10 (tests + perf + PR)
```

Sequential — 병렬화 안 함 (각 단계가 이전 단계의 산출물 의존). Phase 7과 8은 병렬 가능하나 같은 파일 (my-postings/[id]/index.tsx) 수정 가능성 있어 순차 권장.

---

## NOT in scope (이미 spec 에 명시, 재인용)

- 수락/거절 단계, 권한 차등 (manager/viewer), 외부 소셜 로그인, 다른 리소스 공유
- Storage RLS, collaborator roster 노출 차단, 알림 mute, RPC-only 단순화
- Workspace owner 이양 흐름 자체 audit (별도 작업)

자세한 사유는 spec § NOT in scope 참조.

---

## Notes for executors

- 각 Phase 끝에서 commit. Phase 단위 PR 머지 가능 (small PR 권장).
- Migration 은 Supabase MCP `apply_migration` 만 사용 (메모리 학습 — `supabase db push` 금지).
- 테스트 데이터: dev 전용 워크스페이스 + 더미 사용자만 사용 (`.env.local` = prod DB 함정).
- staging branch (`mcp__supabase__create_branch`) 권장.
- Korean commit messages, conventional commits 형식 (`feat/fix/refactor/test/docs`).
- 파일 200줄 이하 (golden principle #5), 함수 50줄 이하.
- 다크모드 `dark:` 항상 적용 (CLAUDE.md 규칙).
