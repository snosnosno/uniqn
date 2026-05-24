# 워크스페이스 아카이브(소프트 삭제) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** employer가 워크스페이스를 아카이브(소프트 삭제)하여 switcher·cap에서 제외하고, 보관함에서 복원할 수 있게 한다. 공고·지원·정산 데이터는 100% 보존된다.

**Architecture:** `workspaces.archived_at` 컬럼 기반 소프트 삭제. archive/restore는 SECURITY DEFINER RPC(기존 `create_workspace`/invitation RPC 패턴). 진행공고(active/approved/pending) 있으면 archive 차단, 복원 시 cap(10) 재검사. SELECT RLS는 건드리지 않고(JPC recursion 재발 방지) 가시성 필터는 `list_my_workspaces` RPC에서만.

**Tech Stack:** Supabase(Postgres + RLS + plpgsql RPC), pgTAP, TypeScript, TanStack Query, React Native, Jest.

**Spec:** `docs/superpowers/specs/2026-05-24-workspace-archive-design.md`

> ⚠️ **격리**: 작업 시작 전 `git status` 확인. 현재 `uniqn-mobile/app/(app)/employer-register.tsx`에 타 세션의 미커밋 변경이 있으므로, 구현은 **새 git worktree + 브랜치**에서 진행한다(`superpowers:using-git-worktrees`). 스펙은 이미 `feat/workspace-archive`에 커밋됨.

> ⚠️ **마이그레이션 적용**: SQL 파일을 `uniqn-mobile/supabase/migrations/`에 생성하되, **적용은 MCP `apply_migration` 전용**(`supabase db push` 금지). 기존 마이그레이션 파일 수정 금지 — RPC는 신규 파일에서 `CREATE OR REPLACE`. `.env.local`이 prod DB를 가리키므로 dev 서버 = master 코드 + 실제 DB.

---

## File Structure

**DB (신규 마이그레이션 SQL — `uniqn-mobile/supabase/migrations/`)**
- `<ts>_workspace_add_archived_at.sql` — 컬럼 + 부분 인덱스 + 코멘트
- `<ts>_workspace_archive_cap_exclusion.sql` — RLS cap + `create_workspace` RPC cap에 `archived_at IS NULL`
- `<ts>_workspace_list_exclude_archived.sql` — `list_my_workspaces` DROP+recreate (archived_at 컬럼 추가 + 필터)
- `<ts>_workspace_archive_restore_rpcs.sql` — `archive_workspace` / `restore_workspace`
- `uniqn-mobile/supabase/tests/workspace_archive.test.sql` — pgTAP

**클라이언트**
- `src/types/workspace.ts` — `Workspace.archivedAt` 추가
- `src/schemas/workspace.schema.ts` — `archiveWorkspaceSchema` / `restoreWorkspaceSchema`
- `src/lib/queryClient.ts` — `queryKeys.workspaces.archivedForUser`
- `src/errors/workspace.ts` — `WORKSPACE_HAS_ACTIVE_POSTINGS` + 매핑
- `src/repositories/interfaces/IWorkspaceRepository.ts` — 3개 메서드 시그니처
- `src/repositories/supabase/WorkspaceRepository.ts` — 구현 + `COLUMNS`에 `archived_at`
- `src/services/workspace/workspaceService.ts` — archive/restore/listArchived
- `src/hooks/workspace/useWorkspaces.ts` — 3개 훅 (기존 파일에 추가)
- `src/hooks/workspace/index.ts` — barrel export
- `app/(employer)/workspace/archived.tsx` — 보관함 화면 (신규)
- `app/(employer)/workspace/index.tsx` — 아카이브 액션 + 보관함 링크

---

## Task 1: DB — archived_at 컬럼 추가

**Files:**
- Create: `uniqn-mobile/supabase/migrations/<ts>_workspace_add_archived_at.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 워크스페이스 소프트 삭제(아카이브) — archived_at 마커 컬럼
-- NULL = 활성. 값 있으면 switcher/list/cap 에서 제외. owner 가 복원 가능.
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

COMMENT ON COLUMN public.workspaces.archived_at IS
  '소프트 삭제 마커. NULL=활성. 값 있으면 switcher/list/cap 에서 제외. owner 가 복원 가능. 2026-05-24.';

-- cap / list_my_workspaces 핫패스용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_active
  ON public.workspaces(owner_id) WHERE archived_at IS NULL;
```

- [ ] **Step 2: MCP로 적용**

`mcp__supabase__apply_migration` 호출: `name = "workspace_add_archived_at"`, `query =` 위 SQL.
Expected: 성공 (no error).

- [ ] **Step 3: 컬럼 존재 검증**

`mcp__supabase__execute_sql`:
```sql
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='workspaces' AND column_name='archived_at';
```
Expected: 1 row, `is_nullable = YES`.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/supabase/migrations/*_workspace_add_archived_at.sql
git commit -m "feat(workspace): archived_at 컬럼 추가 (소프트 삭제 기반)"
```

---

## Task 2: DB — cap 집계에서 아카이브 제외

목표: 10개 한도 검사 2곳(RLS INSERT 정책 + `create_workspace` RPC)에 `archived_at IS NULL` 추가. 아카이브하면 슬롯이 비어야 한다.

**Files:**
- Create: `uniqn-mobile/supabase/migrations/<ts>_workspace_archive_cap_exclusion.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- cap(10) 집계에서 아카이브된 워크스페이스 제외 — RLS INSERT 정책 + create_workspace RPC

-- 1. RLS INSERT 정책 재정의 (기존 workspaces_insert_employer_with_cap 대체)
DROP POLICY IF EXISTS workspaces_insert_employer_with_cap ON public.workspaces;
CREATE POLICY workspaces_insert_employer_with_cap
  ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND (
      (SELECT (auth.jwt() -> 'app_metadata' ->> 'role')) IN ('employer', 'admin')
    )
    AND (
      SELECT count(*) FROM public.workspaces
      WHERE owner_id = (SELECT auth.uid()) AND archived_at IS NULL
    ) < 10
  );

-- 2. create_workspace RPC cap 검사에 archived_at IS NULL 추가 (CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.create_workspace(p_name TEXT)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid;
  v_role text;
  v_count int;
  v_row public.workspaces%ROWTYPE;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_REQUIRED';
  END IF;

  SELECT role::text INTO v_role
  FROM public.users
  WHERE id = v_uid AND is_active = true;

  IF v_role IS NULL OR v_role NOT IN ('employer', 'admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- cap(10) — 아카이브된 워크스페이스 제외 (2026-05-24)
  SELECT count(*)::int INTO v_count
  FROM public.workspaces
  WHERE owner_id = v_uid AND archived_at IS NULL;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'WORKSPACE_CAP_REACHED';
  END IF;

  INSERT INTO public.workspaces (name, owner_id)
  VALUES (p_name, v_uid)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;
```

> ⚠️ Step 1의 RLS `WITH CHECK` role 조건은 **기존 정책의 role 표현을 그대로 따라야 한다**. 적용 전 `mcp__supabase__execute_sql`로 현재 정책 정의를 확인하고 role 검사 식만 복사할 것:
> ```sql
> SELECT pg_get_expr(polwithcheck, polrelid) FROM pg_policy
> WHERE polname = 'workspaces_insert_employer_with_cap';
> ```
> 위 SQL의 role 식이 실제와 다르면 실제 식 + `archived_at IS NULL` cap 조건만 반영하여 재작성.

- [ ] **Step 2: 현재 RLS 정책 정의 확인** (Step 1 경고 반영)

`mcp__supabase__execute_sql`로 위 `pg_get_expr` 쿼리 실행 → role 식 확인 후 SQL 보정.

- [ ] **Step 3: MCP로 적용**

`apply_migration`: `name = "workspace_archive_cap_exclusion"`.
Expected: 성공.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/supabase/migrations/*_workspace_archive_cap_exclusion.sql
git commit -m "feat(workspace): cap(10) 집계에서 아카이브 워크스페이스 제외"
```

---

## Task 3: DB — list_my_workspaces 아카이브 제외 + archived_at 컬럼 반환

`list_my_workspaces`는 RETURNS TABLE 시그니처가 바뀌므로 **DROP 후 재생성** 필요(CREATE OR REPLACE 불가).

**Files:**
- Create: `uniqn-mobile/supabase/migrations/<ts>_workspace_list_exclude_archived.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- list_my_workspaces: 아카이브된 워크스페이스 제외 + archived_at 컬럼 반환
-- RETURNS TABLE 시그니처 변경 → DROP 후 재생성
DROP FUNCTION IF EXISTS public.list_my_workspaces();

CREATE FUNCTION public.list_my_workspaces()
RETURNS TABLE (
  id uuid,
  name text,
  owner_id uuid,
  member_count int,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.owner_id,
    w.member_count,
    w.created_at,
    w.updated_at,
    w.archived_at
  FROM public.workspaces w
  WHERE
    w.archived_at IS NULL
    AND (
      w.owner_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = w.id AND wm.user_id = v_uid
      )
    )
  ORDER BY w.created_at ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.list_my_workspaces() TO authenticated;

COMMENT ON FUNCTION public.list_my_workspaces() IS
  '현재 사용자가 owner 또는 명시적 member 인 활성(archived_at IS NULL) 워크스페이스만 반환. 2026-05-24 아카이브 제외 + archived_at 컬럼 추가.';
```

- [ ] **Step 2: MCP로 적용**

`apply_migration`: `name = "workspace_list_exclude_archived"`.
Expected: 성공.

- [ ] **Step 3: 시그니처 검증**

`mcp__supabase__execute_sql`:
```sql
SELECT pg_get_function_result(oid) FROM pg_proc WHERE proname = 'list_my_workspaces';
```
Expected: 반환 컬럼에 `archived_at timestamptz` 포함.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/supabase/migrations/*_workspace_list_exclude_archived.sql
git commit -m "feat(workspace): list_my_workspaces 에서 아카이브 제외 + archived_at 반환"
```

---

## Task 4: DB — archive_workspace / restore_workspace RPC

**Files:**
- Create: `uniqn-mobile/supabase/migrations/<ts>_workspace_archive_restore_rpcs.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 워크스페이스 아카이브 / 복원 RPC (owner 전용, SECURITY DEFINER, 멱등)
-- 패턴: 기존 remove_workspace_member RPC 와 동일 (auth → owner 검증 → 멱등 → 작업)

-- 1. archive_workspace — owner 가 아카이브. 진행공고(active/approved/pending) 있으면 차단.
CREATE OR REPLACE FUNCTION public.archive_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_active_count int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id, archived_at INTO v_owner_id, v_archived_at
  FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 이미 아카이브됨 → 멱등 return
  IF v_archived_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- 진행 중 공고 차단 (active / approved / pending)
  SELECT count(*)::int INTO v_active_count
  FROM public.job_postings
  WHERE workspace_id = p_workspace_id
    AND status IN ('active', 'approved', 'pending');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'WORKSPACE_HAS_ACTIVE_POSTINGS:%', v_active_count USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspaces SET archived_at = now() WHERE id = p_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_workspace(uuid) TO authenticated;

-- 2. restore_workspace — owner 가 복원. 활성 워크스페이스 cap(10) 재검사.
CREATE OR REPLACE FUNCTION public.restore_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_owner_id uuid;
  v_archived_at timestamptz;
  v_active_count int;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id, archived_at INTO v_owner_id, v_archived_at
  FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_owner_id != v_caller_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 이미 활성 → 멱등 return
  IF v_archived_at IS NULL THEN
    RETURN;
  END IF;

  -- cap 재검사 — 활성 워크스페이스 10개 이상이면 차단
  SELECT count(*)::int INTO v_active_count
  FROM public.workspaces
  WHERE owner_id = v_caller_id AND archived_at IS NULL;

  IF v_active_count >= 10 THEN
    RAISE EXCEPTION 'WORKSPACE_CAP_REACHED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.workspaces SET archived_at = NULL WHERE id = p_workspace_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_workspace(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_workspace(uuid) TO authenticated;

COMMENT ON FUNCTION public.archive_workspace(uuid) IS
  '워크스페이스 소프트 삭제. owner 전용. 진행공고(active/approved/pending) 있으면 WORKSPACE_HAS_ACTIVE_POSTINGS:N 차단. 멱등. 2026-05-24.';
COMMENT ON FUNCTION public.restore_workspace(uuid) IS
  '워크스페이스 복원. owner 전용. 활성 cap(10) 재검사. 멱등. 2026-05-24.';
```

- [ ] **Step 2: MCP로 적용**

`apply_migration`: `name = "workspace_archive_restore_rpcs"`.
Expected: 성공.

- [ ] **Step 3: 스키마 매치 스모크 검증** (plpgsql lazy 컴파일 우회 — memory: staging_dryrun_ddl_only_insufficient)

`mcp__supabase__execute_sql`:
```sql
SELECT proname FROM pg_proc WHERE proname IN ('archive_workspace','restore_workspace');
```
Expected: 2 rows. (positive 동작 검증은 Task 5 pgTAP에서.)

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/supabase/migrations/*_workspace_archive_restore_rpcs.sql
git commit -m "feat(workspace): archive_workspace / restore_workspace RPC 추가"
```

---

## Task 5: DB — pgTAP 테스트

**Files:**
- Create: `uniqn-mobile/supabase/tests/workspace_archive.test.sql`

> 기존 pgTAP 테스트(`supabase/tests/jpc_*.test.sql`) 패턴을 따른다. 시드는 SECURITY DEFINER helper로 직접 INSERT, `set_config('request.jwt.claims', ...)`로 auth.uid() 시뮬레이션.

- [ ] **Step 1: pgTAP 테스트 작성**

```sql
BEGIN;
SELECT plan(8);

-- ── 시드 ─────────────────────────────────────────────
-- employer 2명 (owner / 타인), workspace 3개, job_postings 다양한 status
INSERT INTO public.users (id, email, name, role, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'arch-owner@uniqn.test', 'Owner', 'employer', true),
  ('a0000000-0000-0000-0000-000000000002', 'arch-other@uniqn.test', 'Other', 'employer', true)
ON CONFLICT (id) DO NOTHING;

-- ws1: 종료 공고만(closed) → 아카이브 가능
-- ws2: active 공고 포함 → 아카이브 차단
-- ws3: 복원 테스트용 (아카이브 상태로 시작)
INSERT INTO public.workspaces (id, name, owner_id, archived_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'WS1', 'a0000000-0000-0000-0000-000000000001', NULL),
  ('b0000000-0000-0000-0000-000000000002', 'WS2', 'a0000000-0000-0000-0000-000000000001', NULL),
  ('b0000000-0000-0000-0000-000000000003', 'WS3', 'a0000000-0000-0000-0000-000000000001', now());

-- job_postings 최소 컬럼 — owner_id, workspace_id, status, title 등 NOT NULL 충족
-- (실제 NOT NULL 컬럼은 적용 전 \d job_postings 로 확인하여 채울 것)
INSERT INTO public.job_postings (id, title, owner_id, workspace_id, status)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'closed job', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'closed'),
  ('c0000000-0000-0000-0000-000000000002', 'active job', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'active');

-- owner 로 인증 컨텍스트 설정
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- T1: 종료공고만 있는 워크스페이스 아카이브 성공
SELECT lives_ok(
  $$ SELECT public.archive_workspace('b0000000-0000-0000-0000-000000000001') $$,
  'T1 종료공고만 → 아카이브 성공'
);

-- T2: archived_at 이 채워짐
SELECT isnt(
  (SELECT archived_at FROM public.workspaces WHERE id='b0000000-0000-0000-0000-000000000001'),
  NULL,
  'T2 archived_at 세팅됨'
);

-- T3: 진행공고(active) 있는 워크스페이스 아카이브 차단
SELECT throws_like(
  $$ SELECT public.archive_workspace('b0000000-0000-0000-0000-000000000002') $$,
  '%WORKSPACE_HAS_ACTIVE_POSTINGS%',
  'T3 active 공고 → 차단'
);

-- T4: 멱등 — 이미 아카이브된 것 재아카이브 성공(no-op)
SELECT lives_ok(
  $$ SELECT public.archive_workspace('b0000000-0000-0000-0000-000000000001') $$,
  'T4 이미 아카이브 → 멱등'
);

-- T5: list_my_workspaces 에 아카이브된 것 미노출 (WS1, WS3 제외 / WS2 만)
SELECT is(
  (SELECT count(*)::int FROM public.list_my_workspaces()),
  1,
  'T5 list 는 활성 1개(WS2)만'
);

-- T6: 복원 성공 (WS3)
SELECT lives_ok(
  $$ SELECT public.restore_workspace('b0000000-0000-0000-0000-000000000003') $$,
  'T6 복원 성공'
);

-- T7: 복원 후 archived_at NULL
SELECT is(
  (SELECT archived_at FROM public.workspaces WHERE id='b0000000-0000-0000-0000-000000000003'),
  NULL,
  'T7 복원 후 archived_at NULL'
);

-- T8: 타인이 아카이브 시도 → PERMISSION_DENIED
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT throws_like(
  $$ SELECT public.archive_workspace('b0000000-0000-0000-0000-000000000002') $$,
  '%PERMISSION_DENIED%',
  'T8 타인 아카이브 → 권한 거부'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: job_postings NOT NULL 컬럼 확인** (시드 보정)

`mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='job_postings' AND is_nullable='NO';
```
누락된 NOT NULL 컬럼이 있으면 Step 1의 job_postings INSERT에 값 추가.

- [ ] **Step 3: pgTAP 실행**

로컬 supabase 스택에서 실행하거나, prod 영향 없는 트랜잭션(BEGIN/ROLLBACK)이므로 `mcp__supabase__execute_sql`로 파일 내용 실행.
Expected: `ok 1` ~ `ok 8`, 실패 0.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/supabase/tests/workspace_archive.test.sql
git commit -m "test(workspace): archive/restore pgTAP 8 케이스"
```

---

## Task 6: 타입 + 스키마 + queryKey

**Files:**
- Modify: `src/types/workspace.ts:16-24`
- Modify: `src/schemas/workspace.schema.ts` (끝에 추가)
- Modify: `src/lib/queryClient.ts:324-336`

- [ ] **Step 1: Workspace 타입에 archivedAt 추가**

`src/types/workspace.ts` `Workspace` 인터페이스 수정:
```typescript
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  /** owner 제외한 editor 수 (UI 에서는 +1 표시) */
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  /** 소프트 삭제 마커. null = 활성. 값 있으면 아카이브됨 (보관함). */
  archivedAt: string | null;
}
```

- [ ] **Step 2: 스키마 추가**

`src/schemas/workspace.schema.ts` 끝에 추가:
```typescript
// ============================================================================
// 아카이브 / 복원 (RPC 입력)
// ============================================================================

export const archiveWorkspaceSchema = z.object({
  workspaceId: z.string().uuid({ message: '올바른 워크스페이스 ID 가 아닙니다' }),
});
export type ArchiveWorkspaceData = z.infer<typeof archiveWorkspaceSchema>;

export const restoreWorkspaceSchema = z.object({
  workspaceId: z.string().uuid({ message: '올바른 워크스페이스 ID 가 아닙니다' }),
});
export type RestoreWorkspaceData = z.infer<typeof restoreWorkspaceSchema>;
```

- [ ] **Step 3: queryKey 추가**

`src/lib/queryClient.ts`의 `workspaces` 블록(라인 324~336)에서 `invitationsReceived` 다음에 추가:
```typescript
    invitationsReceived: (userId: string) =>
      [...queryKeys.workspaces.all, 'invitations', 'received', userId] as const,
    archivedForUser: (userId: string) =>
      [...queryKeys.workspaces.all, 'archived', userId] as const,
```

- [ ] **Step 4: 타입체크**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: 0 errors. (archivedAt가 추가됐으나 rowToWorkspace는 toCamelCase로 자동 매핑, 다른 사용처는 옵셔널 접근 불필요 — 컴파일 통과 확인.)

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/types/workspace.ts uniqn-mobile/src/schemas/workspace.schema.ts uniqn-mobile/src/lib/queryClient.ts
git commit -m "feat(workspace): archivedAt 타입 + archive/restore 스키마 + queryKey"
```

---

## Task 7: 에러 — WORKSPACE_HAS_ACTIVE_POSTINGS + 매핑 (TDD)

**Files:**
- Modify: `src/errors/workspace.ts`
- Test: `src/errors/__tests__/workspace.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/errors/__tests__/workspace.test.ts`에 추가(없으면 파일 생성, 기존 import 패턴 따름):
```typescript
import { mapWorkspaceRpcError, WORKSPACE_ERROR_CODES } from '@/errors/workspace';
import { BusinessError } from '@/errors/AppError';

describe('mapWorkspaceRpcError - 아카이브', () => {
  it('WORKSPACE_HAS_ACTIVE_POSTINGS:3 → 개수 포함 BusinessError', () => {
    const mapped = mapWorkspaceRpcError({ message: 'WORKSPACE_HAS_ACTIVE_POSTINGS:3' });
    expect(mapped).toBeInstanceOf(BusinessError);
    expect(mapped?.code).toBe(WORKSPACE_ERROR_CODES.WORKSPACE_HAS_ACTIVE_POSTINGS);
    expect(mapped?.userMessage).toBe('진행 중인 공고 3건을 먼저 마감해주세요.');
  });

  it('WORKSPACE_CAP_REACHED → cap BusinessError (복원 차단)', () => {
    const mapped = mapWorkspaceRpcError({ message: 'P0001: WORKSPACE_CAP_REACHED' });
    expect(mapped?.code).toBe(WORKSPACE_ERROR_CODES.WORKSPACE_CAP_REACHED);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/errors/__tests__/workspace.test.ts -t "아카이브"`
Expected: FAIL — `WORKSPACE_HAS_ACTIVE_POSTINGS` 코드 미존재.

- [ ] **Step 3: 에러 코드 + 매핑 구현**

`src/errors/workspace.ts` `WORKSPACE_ERROR_CODES`에 추가:
```typescript
  WORKSPACE_INSERT_DENIED: 'E6091',
  WORKSPACE_HAS_ACTIVE_POSTINGS: 'E6092',
} as const;
```

`WORKSPACE_ERROR_USER_MESSAGES`에 추가(CAP_REACHED 메시지 다음):
```typescript
  [WORKSPACE_ERROR_CODES.WORKSPACE_HAS_ACTIVE_POSTINGS]:
    '진행 중인 공고가 있어 보관할 수 없어요. 먼저 공고를 마감해주세요.',
```

`mapWorkspaceRpcError`의 `WORKSPACE_CAP_REACHED` 분기 **앞**에 추가(개수 파싱):
```typescript
  // archive_workspace RPC: 진행공고 차단 — 'WORKSPACE_HAS_ACTIVE_POSTINGS:N' (N = 개수)
  const activePostingsMatch = upper.match(/WORKSPACE_HAS_ACTIVE_POSTINGS:?\s*(\d+)/);
  if (activePostingsMatch) {
    const count = activePostingsMatch[1] ?? '';
    return new BusinessError(WORKSPACE_ERROR_CODES.WORKSPACE_HAS_ACTIVE_POSTINGS, {
      userMessage: `진행 중인 공고 ${count}건을 먼저 마감해주세요.`,
    });
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/errors/__tests__/workspace.test.ts`
Expected: PASS (전체).

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/errors/workspace.ts uniqn-mobile/src/errors/__tests__/workspace.test.ts
git commit -m "feat(workspace): WORKSPACE_HAS_ACTIVE_POSTINGS 에러 코드 + 개수 파싱 매핑"
```

---

## Task 8: Repository — archive/restore/findArchived (TDD)

**Files:**
- Modify: `src/repositories/interfaces/IWorkspaceRepository.ts:17-41`
- Modify: `src/repositories/supabase/WorkspaceRepository.ts`
- Test: `src/repositories/supabase/__tests__/WorkspaceRepository.test.ts`

- [ ] **Step 1: 인터페이스에 메서드 추가**

`IWorkspaceRepository`에 추가:
```typescript
  /**
   * 워크스페이스 아카이브 (RPC archive_workspace 경유 — owner 전용, RPC가 권한/진행공고 체크)
   * @throws AppError E5 권한 / E6092 진행공고 존재
   */
  archiveViaRpc(workspaceId: string): Promise<void>;

  /**
   * 워크스페이스 복원 (RPC restore_workspace 경유 — owner 전용, cap 재검사)
   * @throws AppError E5 권한 / E6090 cap 도달
   */
  restoreViaRpc(workspaceId: string): Promise<void>;

  /** 내가 owner 인 아카이브된 워크스페이스 목록 (보관함). 최근 아카이브순. */
  findArchivedByOwner(ownerId: string): Promise<Workspace[]>;
```

- [ ] **Step 2: 실패 테스트 작성**

`src/repositories/supabase/__tests__/WorkspaceRepository.test.ts`에 추가(없으면 생성, 기존 supabase mock 패턴 따름):
```typescript
import { supabase } from '@/lib/supabase';
import { SupabaseWorkspaceRepository } from '@/repositories/supabase/WorkspaceRepository';
import { BusinessError } from '@/errors/AppError';

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}));

describe('SupabaseWorkspaceRepository - archive/restore', () => {
  const repo = new SupabaseWorkspaceRepository();
  beforeEach(() => jest.clearAllMocks());

  it('archiveViaRpc 는 archive_workspace RPC 를 호출한다', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
    await repo.archiveViaRpc('11111111-1111-1111-1111-111111111111');
    expect(supabase.rpc).toHaveBeenCalledWith('archive_workspace', {
      p_workspace_id: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('archiveViaRpc 는 진행공고 RPC 에러를 BusinessError 로 변환한다', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'WORKSPACE_HAS_ACTIVE_POSTINGS:2' },
    });
    await expect(repo.archiveViaRpc('11111111-1111-1111-1111-111111111111')).rejects.toBeInstanceOf(
      BusinessError
    );
  });

  it('restoreViaRpc 는 restore_workspace RPC 를 호출한다', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
    await repo.restoreViaRpc('11111111-1111-1111-1111-111111111111');
    expect(supabase.rpc).toHaveBeenCalledWith('restore_workspace', {
      p_workspace_id: '11111111-1111-1111-1111-111111111111',
    });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/WorkspaceRepository.test.ts`
Expected: FAIL — `archiveViaRpc` 미존재.

- [ ] **Step 4: 구현**

`WorkspaceRepository.ts` `COLUMNS` 상수에 `archived_at` 추가:
```typescript
const COLUMNS = 'id, name, owner_id, member_count, created_at, updated_at, archived_at' as const;
```

`getOwnerProfile` 메서드 다음, 클래스 닫기 `}` 전에 추가:
```typescript
  async archiveViaRpc(workspaceId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('archive_workspace', { p_workspace_id: workspaceId });
      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '워크스페이스 보관', table: TABLE });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 보관', table: TABLE });
    }
  }

  async restoreViaRpc(workspaceId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('restore_workspace', { p_workspace_id: workspaceId });
      if (error) {
        const mapped = mapWorkspaceRpcError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '워크스페이스 복원', table: TABLE });
      }
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '워크스페이스 복원', table: TABLE });
    }
  }

  async findArchivedByOwner(ownerId: string): Promise<Workspace[]> {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select(COLUMNS)
        .eq('owner_id', ownerId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (error) {
        handleSupabaseError(error, { operation: '보관함 조회', table: TABLE });
      }
      return ((data ?? []) as Record<string, unknown>[]).map(rowToWorkspace);
    } catch (error) {
      if (isAppError(error)) throw error;
      handleSupabaseError(error, { operation: '보관함 조회', table: TABLE });
    }
  }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/WorkspaceRepository.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/src/repositories
git commit -m "feat(workspace): repository archive/restore/findArchived + COLUMNS archived_at"
```

---

## Task 9: Service — archiveWorkspace/restoreWorkspace/listArchivedWorkspaces (TDD)

**Files:**
- Modify: `src/services/workspace/workspaceService.ts`
- Test: `src/services/workspace/__tests__/workspaceService.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`workspaceService.test.ts`에 추가:
```typescript
import { workspaceService } from '@/services/workspace/workspaceService';
import { workspaceRepository } from '@/repositories';
import { ValidationError } from '@/errors';

describe('workspaceService - archive/restore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('archiveWorkspace 는 repository.archiveViaRpc 에 위임한다', async () => {
    const spy = jest.spyOn(workspaceRepository, 'archiveViaRpc').mockResolvedValue(undefined);
    await workspaceService.archiveWorkspace({ workspaceId: '11111111-1111-1111-1111-111111111111' });
    expect(spy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });

  it('archiveWorkspace 는 잘못된 ID 를 ValidationError 로 거부한다', async () => {
    await expect(workspaceService.archiveWorkspace({ workspaceId: 'not-a-uuid' })).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('restoreWorkspace 는 repository.restoreViaRpc 에 위임한다', async () => {
    const spy = jest.spyOn(workspaceRepository, 'restoreViaRpc').mockResolvedValue(undefined);
    await workspaceService.restoreWorkspace({ workspaceId: '11111111-1111-1111-1111-111111111111' });
    expect(spy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });

  it('listArchivedWorkspaces 는 repository.findArchivedByOwner 에 위임한다', async () => {
    const spy = jest.spyOn(workspaceRepository, 'findArchivedByOwner').mockResolvedValue([]);
    await workspaceService.listArchivedWorkspaces('owner-1');
    expect(spy).toHaveBeenCalledWith('owner-1');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/services/workspace/__tests__/workspaceService.test.ts -t "archive/restore"`
Expected: FAIL — 메서드 미존재.

- [ ] **Step 3: 구현**

`workspaceService.ts` import에 스키마 추가:
```typescript
import {
  createWorkspaceSchema,
  updateWorkspaceNameSchema,
  removeWorkspaceMemberSchema,
  archiveWorkspaceSchema,
  restoreWorkspaceSchema,
} from '@/schemas/workspace.schema';
```

`workspaceService` 객체에 `removeMember` 다음 추가:
```typescript
  /**
   * 워크스페이스 아카이브 (owner 만 — RPC 권한 체크).
   * 진행공고(active/approved/pending) 있으면 RPC 가 차단.
   */
  async archiveWorkspace(input: { workspaceId: string }): Promise<void> {
    const parsed = archiveWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '입력값을 확인해주세요',
      });
    }
    await workspaceRepository.archiveViaRpc(parsed.data.workspaceId);
  },

  /**
   * 워크스페이스 복원 (owner 만). 활성 cap(10) 초과 시 RPC 가 차단.
   */
  async restoreWorkspace(input: { workspaceId: string }): Promise<void> {
    const parsed = restoreWorkspaceSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
        userMessage: '입력값을 확인해주세요',
      });
    }
    await workspaceRepository.restoreViaRpc(parsed.data.workspaceId);
  },

  /**
   * 내가 owner 인 아카이브된 워크스페이스 목록 (보관함).
   */
  async listArchivedWorkspaces(ownerId: string): Promise<Workspace[]> {
    return workspaceRepository.findArchivedByOwner(ownerId);
  },
```

> `Workspace`는 이미 import됨(파일 상단 `import type { Workspace, ... }`).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/services/workspace/__tests__/workspaceService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add uniqn-mobile/src/services/workspace
git commit -m "feat(workspace): service archive/restore/listArchived"
```

---

## Task 10: Hooks — useArchiveWorkspace/useRestoreWorkspace/useArchivedWorkspaces

**Files:**
- Modify: `src/hooks/workspace/useWorkspaces.ts` (끝에 추가)
- Modify: `src/hooks/workspace/index.ts`

- [ ] **Step 1: 훅 구현**

`useWorkspaces.ts` import에 `Workspace`가 이미 포함됨. 파일 끝(`useUpdateWorkspaceName` 다음)에 추가:
```typescript
// ============================================================================
// useArchivedWorkspaces — 보관함 (내가 owner 인 아카이브된 워크스페이스)
// ============================================================================

export interface UseArchivedWorkspacesResult {
  archived: Workspace[];
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useArchivedWorkspaces(): UseArchivedWorkspacesResult {
  const { user } = useAuthStore();
  const userId = user?.uid;

  const query = useQuery({
    queryKey: userId
      ? queryKeys.workspaces.archivedForUser(userId)
      : [...queryKeys.workspaces.all, 'archived', 'anonymous'],
    queryFn: () => workspaceService.listArchivedWorkspaces(userId!),
    enabled: !!userId,
    staleTime: cachingPolicies.frequent,
  });

  return {
    archived: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// useArchiveWorkspace / useRestoreWorkspace
// ============================================================================

function useInvalidateWorkspaceLists() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  return () => {
    if (!user?.uid) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.listForUser(user.uid) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.archivedForUser(user.uid) });
  };
}

export function useArchiveWorkspace() {
  const invalidate = useInvalidateWorkspaceLists();
  return useMutation({
    mutationFn: (workspaceId: string) => workspaceService.archiveWorkspace({ workspaceId }),
    onSuccess: invalidate,
  });
}

export function useRestoreWorkspace() {
  const invalidate = useInvalidateWorkspaceLists();
  return useMutation({
    mutationFn: (workspaceId: string) => workspaceService.restoreWorkspace({ workspaceId }),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 2: barrel export 추가**

`src/hooks/workspace/index.ts`의 `useWorkspaces` export 블록에 추가:
```typescript
  useUpdateWorkspaceName,
  useArchivedWorkspaces,
  useArchiveWorkspace,
  useRestoreWorkspace,
  type UseWorkspacesResult,
  type UseWorkspaceMembersResult,
  type UseWorkspaceOwnerProfileResult,
  type UseReceivedInvitationsResult,
  type UseSentInvitationsResult,
  type UseArchivedWorkspacesResult,
} from './useWorkspaces';
```

- [ ] **Step 3: 타입체크**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add uniqn-mobile/src/hooks/workspace
git commit -m "feat(workspace): useArchiveWorkspace/useRestoreWorkspace/useArchivedWorkspaces 훅"
```

---

## Task 11: UI — 보관함 화면

**Files:**
- Create: `app/(employer)/workspace/archived.tsx`

- [ ] **Step 1: 보관함 화면 구현**

`app/(employer)/workspace/archived.tsx`:
```tsx
/**
 * UNIQN Mobile - 워크스페이스 보관함 (아카이브된 워크스페이스 복원)
 *
 * @description owner 가 아카이브한 워크스페이스 목록 + 복원.
 *              복원 시 활성 cap(10) 초과면 RPC 가 차단.
 */

import { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Button, EmptyState, ErrorState } from '@/components/ui';
import { useToastStore } from '@/stores/toastStore';
import { useArchivedWorkspaces, useRestoreWorkspace } from '@/hooks/workspace';
import { logger } from '@/utils/logger';
import { isAppError } from '@/errors';
import { formatRelativeOrAbsolute } from '@/utils/formatters/date';

export default function ArchivedWorkspacesScreen() {
  const { addToast } = useToastStore();
  const { archived, isLoading, error, refetch } = useArchivedWorkspaces();
  const restoreMutation = useRestoreWorkspace();

  const handleRestore = useCallback(
    async (workspaceId: string) => {
      try {
        await restoreMutation.mutateAsync(workspaceId);
        addToast({ type: 'success', message: '워크스페이스를 복원했어요' });
        refetch();
      } catch (err) {
        logger.warn('워크스페이스 복원 실패', { error: String(err) });
        const message =
          isAppError(err) && err.userMessage ? err.userMessage : '복원에 실패했어요';
        addToast({ type: 'error', message });
      }
    },
    [restoreMutation, addToast, refetch]
  );

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="보관함" />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <ErrorState
            title="보관함을 불러올 수 없어요"
            message="네트워크 상태를 확인하고 다시 시도해주세요."
          />
        </View>
      ) : archived.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <EmptyState
            title="보관한 워크스페이스가 없어요"
            description="워크스페이스를 보관하면 여기에서 복원할 수 있어요."
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-4 py-4">
          {archived.map((ws) => (
            <View
              key={ws.id}
              className="mb-2 flex-row items-center rounded-md bg-white p-4 dark:bg-surface-elevated"
            >
              <View className="flex-1">
                <Text className="text-base font-sans-medium text-content-primary" numberOfLines={1}>
                  {ws.name}
                </Text>
                <Text className="mt-1 text-xs text-content-secondary">
                  {ws.archivedAt ? `${formatRelativeOrAbsolute(ws.archivedAt)} 보관` : '보관됨'}
                </Text>
              </View>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => handleRestore(ws.id)}
                loading={restoreMutation.isPending}
              >
                복원
              </Button>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

> ⚠️ Step 2에서 `formatRelativeOrAbsolute` 유틸의 실제 export명을 확인하고 맞춘다(impeccable 룰 19: `src/utils/formatters/date.ts`). 없거나 이름이 다르면 해당 파일의 상대시간 포맷 함수로 교체. 없으면 `new Date(ws.archivedAt).toLocaleDateString('ko-KR')` fallback.

- [ ] **Step 2: 포맷 유틸 확인**

Run: `cd uniqn-mobile && npx grep -r "export" src/utils/formatters/date.ts` (또는 파일 열람)
→ 상대/절대 시간 포맷 함수명 확인 후 Step 1의 import/호출 보정.

- [ ] **Step 3: 타입체크 + 렌더 스모크 테스트**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "uniqn-mobile/app/(employer)/workspace/archived.tsx"
git commit -m "feat(workspace): 보관함 화면 (아카이브 목록 + 복원)"
```

---

## Task 12: UI — 설정 화면 아카이브 액션 + 보관함 링크

**Files:**
- Modify: `app/(employer)/workspace/index.tsx`

- [ ] **Step 1: import + 훅 + 핸들러 추가**

`app/(employer)/workspace/index.tsx` 상단 hooks import에 `useArchiveWorkspace` 추가:
```typescript
import {
  useActiveWorkspace,
  useWorkspaceMembers,
  useWorkspaceOwnerProfile,
  useUpdateWorkspaceName,
  useRemoveWorkspaceMember,
  useCreateWorkspace,
  useWorkspaces,
  useArchiveWorkspace,
} from '@/hooks/workspace';
```

컴포넌트 내 `createMutation` 선언 다음에 추가:
```typescript
  const archiveMutation = useArchiveWorkspace();

  const handleArchive = useCallback(() => {
    if (!activeWorkspace) return;
    showConfirm(
      '워크스페이스 보관',
      `'${activeWorkspace.name}' 워크스페이스를 보관할까요?\n공고와 기록은 보존되며 보관함에서 복원할 수 있어요.`,
      async () => {
        try {
          await archiveMutation.mutateAsync(activeWorkspace.id);
          addToast({ type: 'success', message: '워크스페이스를 보관했어요' });
        } catch (err) {
          logger.warn('워크스페이스 보관 실패', { error: String(err) });
          const message =
            isAppError(err) && err.userMessage ? err.userMessage : '보관에 실패했어요';
          addToast({ type: 'error', message });
        }
      }
    );
  }, [activeWorkspace, archiveMutation, addToast, showConfirm]);
```

- [ ] **Step 2: 멤버 섹션 ScrollView 끝에 owner 전용 위험 구역 추가**

`멤버 섹션` `</View>` 다음, `</ScrollView>` 앞에 추가:
```tsx
        {/* 보관함 + 워크스페이스 보관 (owner 전용) */}
        {isOwner && (
          <View className="mt-8 gap-3 px-4">
            <Pressable
              onPress={() => router.push('/(employer)/workspace/archived')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="보관함 열기"
              className="min-h-[44px] flex-row items-center justify-between rounded-md bg-white px-4 py-3 dark:bg-surface-elevated"
            >
              <Text className="text-sm font-sans-medium text-content-primary">보관함</Text>
              <Text className="text-sm text-content-secondary">보관한 워크스페이스 복원 ›</Text>
            </Pressable>

            <Button
              variant="secondary"
              onPress={handleArchive}
              loading={archiveMutation.isPending}
            >
              이 워크스페이스 보관
            </Button>
          </View>
        )}
```

> `router`, `Pressable`, `Button`, `logger`, `isAppError`는 이미 import됨(파일 상단 확인). `useCallback`도 이미 import됨.

- [ ] **Step 3: 타입체크 + lint**

Run: `cd uniqn-mobile && npx tsc --noEmit && npx eslint "app/(employer)/workspace/index.tsx"`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "uniqn-mobile/app/(employer)/workspace/index.tsx"
git commit -m "feat(workspace): 설정 화면 보관 액션 + 보관함 진입 링크"
```

---

## Task 13: 최종 검증

- [ ] **Step 1: 전체 품질 게이트**

Run: `cd uniqn-mobile && npm run quality`
Expected: type-check + lint + format:check 모두 통과 (0 errors).

- [ ] **Step 2: 관련 단위 테스트 일괄**

Run: `cd uniqn-mobile && npx jest src/errors/__tests__/workspace.test.ts src/repositories/supabase/__tests__/WorkspaceRepository.test.ts src/services/workspace/__tests__/workspaceService.test.ts`
Expected: 전부 PASS.

- [ ] **Step 3: dev 서버 수동 확인** (prod DB 연결 — `.env.local`)

`npm start` → employer 계정 로그인 → 워크스페이스 설정:
1. 종료/draft 공고만 있는(또는 빈) 워크스페이스 "보관" → 성공 토스트 + switcher에서 사라짐
2. active 공고 있는 워크스페이스 "보관" → "진행 중인 공고 N건을 먼저 마감해주세요" 차단
3. 보관함 진입 → 복원 → switcher에 다시 나타남
4. cap 검증: 활성 10개 만든 뒤 보관 → 새 워크스페이스 생성 가능 확인

- [ ] **Step 4: 최종 정리 커밋** (필요 시)

```bash
git add -A
git commit -m "chore(workspace): 아카이브 기능 최종 검증 + 정리"
```

---

## 자가 검토 결과 (Self-Review)

**Spec coverage:** §4 컬럼(T1) / §5 cap(T2) / §6 가시성(T3) / §7 RPC(T4) / §8 active 전환(기존 self-heal — T12 토스트로 커버) / §9 계층(T6~T10) / §10 UI(T11~T12) / §11 에러(T7) / §12 테스트(T5,T7,T8,T9) / §13 마이그레이션 순서(T1→T4 순) — 전부 매핑됨.

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. 마이그레이션 timestamp `<ts>`는 apply_migration의 `name`으로 대체(의도적). RLS role 식·job_postings NOT NULL 컬럼·포맷 유틸명은 "적용 전 확인" 스텝으로 명시(placeholder 아님 — 검증 절차).

**Type consistency:** `archiveViaRpc`/`restoreViaRpc`/`findArchivedByOwner`(인터페이스 T8 ↔ 구현 T8 ↔ 서비스 T9 ↔ 훅 T10) 시그니처 일치. `archivedForUser` queryKey(T6 정의 ↔ T10 사용) 일치. `Workspace.archivedAt`(T6 ↔ T8 매핑 ↔ T11 사용) 일치. `WORKSPACE_HAS_ACTIVE_POSTINGS`(T7 정의 ↔ T8 테스트) 일치.
