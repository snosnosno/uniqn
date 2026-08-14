# C2 — jp_delete_workspace_owner RLS recursion 정책 재설계

> **Status**: PLAN (Phase 1~3 investigate 완료, Phase 4 implementation 대기 — **다음 세션 첫 액션**)
> **Base**: master (현재 HEAD `d4879dce4` — PR #90 squash merge 후 동기화 완료)
> **Branch (예정)**: `feat/rls-jp-delete-recursion-fix`
> **선결 조건**: ~~PR #89 (worktree-feat+job-posting-collaborators-tests) master 머지~~ ✅ **PR #90 머지 완료** (2026-05-13, 실제 PR 번호는 #90 — 메모리의 #89 는 추측치)
> **작성**: 2026-05-12, /investigate 세션 / **갱신**: 2026-05-13 PR #90 머지 직후

## 1. 요약

`job_postings` 에 대한 직접 `DELETE` 호출 시 PostgreSQL 이 `42P17 infinite recursion` 을 발생시킨다. cycle 의 root cause 는 `workspaces_select_owner_or_member` 정책 (PR #88 에서 갱신, `20260515030000_jpc_extend_existing_rls.sql`) USING 절 안의 JPC JOIN inline 분기:

```sql
OR EXISTS(
  SELECT 1 FROM public.job_postings jp
  JOIN public.job_posting_collaborators jpc ON jpc.job_posting_id = jp.id
  WHERE jp.workspace_id = workspaces.id
    AND jpc.user_id = (SELECT auth.uid())
)
```

해당 inline SELECT 가 `job_postings` SELECT RLS 정책 평가를 재진입시키고, PostgreSQL cycle 감지가 차단한다. `jp_delete_workspace_owner` USING 안의 `SELECT FROM workspaces` 가 trigger entry point.

**확정 증거**: 커밋 `51910c648` 메시지 — "직접 DELETE 는 ... job_postings SELECT RLS 의 infinite recursion (42P17) 으로 검증 불가."

## 2. 사용자 영향 (current code)

| 경로 | 직접 DELETE? | 영향 |
|---|---|---|
| Client (`JobPostingRepository`) | ❌ soft-delete (`status='cancelled' UPDATE`) | 영향 없음 |
| `enforce_jp_status_transition` trigger | (RLS 우회, SECURITY DEFINER) | 영향 없음 |
| E2E cleanup | ✅ `adminClient` (service_role, RLS 우회) | 영향 없음 |
| Admin RPC | (SECURITY DEFINER) | 영향 없음 |
| 미래 hard-delete 추가 시 | ⚠️ | 회귀 발생 |

**현재 사용자 보고 path: 없음**. fix 가치: (1) test infra 정직성 (PR #89 helper drift 제거), (2) defense-in-depth, (3) Supabase advisor 가능성.

## 3. Fix 전략 — Option C (Targeted)

`workspaces_select_owner_or_member` 의 JPC JOIN 분기를 SECURITY DEFINER 함수 `is_workspace_jpc_member()` 로 격리. 정책 자체는 동일한 boolean OR 구조 유지.

### 3.1 마이그레이션 SQL

파일: `uniqn-mobile/supabase/migrations/{timestamp}_fix_workspaces_select_jpc_recursion.sql`

```sql
-- C2 fix — workspaces_select_owner_or_member 의 JPC JOIN 분기를
-- SECURITY DEFINER 함수로 격리하여 PostgreSQL RLS cycle 가드 회피.
--
-- Root cause: 본 정책 USING 안의 `EXISTS(SELECT FROM job_postings jp JOIN jpc ...)` 가
-- workspaces SELECT 평가 도중 jp SELECT 정책 평가를 재진입시켜 42P17 발생.
-- 직접 발현: job_postings DELETE (jp_delete_workspace_owner USING SELECT FROM workspaces).
--
-- 메모리 룰:
--   pitfall_rls_with_check_self_select_recursion — plpgsql SECURITY DEFINER 필수
--   feedback_staging_dryrun_ddl_only_insufficient — 함수 호출 검증 포함
--   feedback_supabase_migration_workflow — MCP apply_migration 전용

-- ── 1. 새 헬퍼 ────────────────────────────────────────────────
-- SQL 함수가 아닌 plpgsql 선택 이유: SQL 함수는 inline 가능성이 있어
-- SECURITY DEFINER 가 무효화될 수 있다 (PostgreSQL 버전 의존). plpgsql 은 절대 inline 안 됨.
CREATE OR REPLACE FUNCTION public.is_workspace_jpc_member(
  _workspace_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM public.job_postings jp
    JOIN public.job_posting_collaborators jpc
      ON jpc.job_posting_id = jp.id
    WHERE jp.workspace_id = _workspace_id
      AND jpc.user_id = _user_id
  ) INTO v_exists;
  RETURN v_exists;
END;
$$;

COMMENT ON FUNCTION public.is_workspace_jpc_member IS
  'workspaces SELECT RLS 의 JPC JOIN 분기를 SECURITY DEFINER 로 격리. '
  'PostgreSQL RLS cycle 가드 회피 (42P17). C2 fix.';

REVOKE EXECUTE ON FUNCTION public.is_workspace_jpc_member(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_workspace_jpc_member(uuid, uuid) TO authenticated;

-- ── 2. workspaces_select_owner_or_member 재정의 ──────────────
DROP POLICY IF EXISTS "workspaces_select_owner_or_member" ON public.workspaces;
CREATE POLICY "workspaces_select_owner_or_member"
  ON public.workspaces FOR SELECT
  USING (
    public.is_workspace_member(id, (SELECT auth.uid()))
    OR public.is_workspace_jpc_member(id, (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- ── 3. (no-op) jp_delete_workspace_owner / jpc_insert_ws_owner / jpc_delete_owner_or_self
-- 손대지 않음. workspaces SELECT 가 cycle-free 가 되면 자동 해소.
```

### 3.2 자동 해소되는 다른 정책 (변경 없이)

| 정책 | inline workspaces 사용 | C2 fix 후 |
|---|---|---|
| `jp_delete_workspace_owner` (DELETE jp) | `IN (SELECT id FROM workspaces WHERE owner_id=uid)` | 해소 ✓ |
| `jpc_insert_ws_owner` (INSERT jpc) | `JOIN workspaces w ... WHERE w.owner_id=uid` | 해소 ✓ |
| `jpc_delete_owner_or_self` (DELETE jpc) | `JOIN workspaces w ... WHERE w.owner_id=uid` | 해소 ✓ |
| `workspace_invitations_select_relevant` (SELECT) | `IN (SELECT id FROM workspaces WHERE owner_id=uid)` | SELECT-only, 처음부터 cycle 없음 |

## 4. 검증 기준 (NOT optional)

### 4.1 Schema validation
`feedback_staging_dryrun_ddl_only_insufficient` 룰 적용:
```sql
-- DDL apply 후 함수 lazy-compile 검증
SELECT * FROM public.is_workspace_jpc_member(
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid
) LIMIT 0;
-- expected: PASS (column/type mismatch 없음)
```

### 4.2 Cycle 해소 dry-run
`pitfall_rls_dynamic_verification_sparse_data` 룰 적용 — matching row count 사전 측정:
```sql
BEGIN;
-- 사전 측정: 실제 owner-of-workspace 의 jp 1+ 존재 확인
SELECT count(*)
  FROM public.job_postings jp
  JOIN public.workspaces w ON w.id = jp.workspace_id
  WHERE w.owner_id = '<test_owner_uid>'::uuid
    AND jp.status = 'active';
-- expected: count >= 1 (sparse data 회피)

-- 실제 DELETE 시도 (invoker 권한, owner 페르소나)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"<test_owner_uid>","app_metadata":{"role":"employer"}}';
DELETE FROM public.job_postings WHERE id = '<test_jp_id>'::uuid;
-- expected: success (이전: 42P17)

-- cascade 동작 확인
SELECT count(*) FROM public.applications WHERE job_posting_id = '<test_jp_id>'::uuid;
-- expected: 0 (cascade)
ROLLBACK;
```

### 4.3 RLS 매트릭스 helper 우회 제거 검증
PR #89 의 SECURITY DEFINER 우회 helper 가 invoker 권한 직접 호출로 되돌릴 수 있는가:

대상 helpers (PR #89 머지 후 확인):
- `jpc_check_can_delete_jp` (jp DELETE 매트릭스 우회)
- 그 외 `jpc_test_force_*` helper (jpc INSERT/DELETE 매트릭스 우회 가능성)

검증:
1. PR #89 의 `jpc_helpers.sql` 에서 우회 helper 정의 읽기
2. fix 적용 후 6 매트릭스 파일에서 우회 helper 호출 → invoker 권한 직접 호출로 교체
3. 6 매트릭스 (workspaces / job_postings / applications / work_logs / event_qr_codes / jpc) 16/16 통과 확인
4. 모두 통과: C2 fix 검증 완료, 우회 helper 정의 제거 (별도 cleanup commit)
5. 일부 실패: B 옵션 (broad fix) 필요 신호 — 본 plan 재검토

### 4.4 Prod apply
- `mcp__supabase__apply_migration` 전용 (`feedback_supabase_migration_workflow`)
- `supabase db push` 금지
- 파일명 timestamp 와 prod registry timestamp 불일치는 무해
- staging dry-run → prod apply → 4.1~4.3 prod 재검증

## 5. Scope guard

- **변경 금지**:
  - `mcp__supabase__*` 으로 PR #89 와 무관한 prod 변경
  - 기존 마이그레이션 본문 수정 (새 마이그레이션만)
  - test infra 코드 (PR #89 머지 전 — PR #89 머지 후 별도 cleanup commit)
  - (employer) 라우트, 비-RLS src 코드
- **허용**:
  - `uniqn-mobile/supabase/migrations/` 새 파일 1개
  - (PR #89 머지 후) `uniqn-mobile/supabase/tests/` 6 매트릭스 파일의 helper 호출 → invoker 직접 호출 교체

## 6. PR scope

- **본 PR**: `is_workspace_jpc_member` 함수 + `workspaces_select_owner_or_member` 재정의 1 마이그레이션
- **후속 PR (선택)**: PR #89 매트릭스의 SECURITY DEFINER 우회 helper 제거 + invoker 직접 호출로 복원

## 7. 시작 trigger

~~PR #89 머지 후~~ ✅ **PR #90 머지 완료 (2026-05-13, `d4879dce4`)**. 즉시 시작 가능:

1. ~~`git pull origin master`~~ ✅ 완료 (master HEAD `d4879dce4`)
2. `git checkout -b feat/rls-jp-delete-recursion-fix`
3. (선택) `/guard` 로 `uniqn-mobile/supabase/migrations/` scope lock
4. 본 plan 의 §3.1 마이그레이션 작성
5. §4.1~4.4 검증 순차 실행
6. `/commit` → `/pr`

## 8. 본 PR 머지 후 추가 follow-up PRs (별도)

**(a) Schema drift fix — 6 disabled SQL tests** (PR #90 의 .test.sql.disabled 복원):
- `cancel_application_atomically`, `cancel_application_expired_guard`, `cancel_application_race`,
  `person_basis_filled_positions`, `process_qr_checkin_atomically`, `total_positions_backfill`
- 필요 fix: work_logs.check_in_time 컬럼명 갱신 (메모리 project_worklog_timestamptz_migration),
  staff_role vs user_role enum 분리, cancel_application_expired_guard S2 RPC 동작 변경 재검증
- 직전 두 commit (ac1de1149 workspace_id, bf0b122a9 public.users INSERT) 의 부분 fix 보존됨

**(b) event_qr_codes DELETE 4 case 디버그** (PR #90 의 plan(12) fallback 복원):
- 가설: SAVEPOINT + ROLLBACK TO 의 set_config local interaction, 또는 WITH d AS (DELETE...) SELECT is() 패턴의 silent drop
- 해결: SAVEPOINT 없이 4 qr_id row 시드 (jpc_seed_extra_qr 같은 helper 추가)
- plan(12) → plan(16) 복원

**(c) [본 plan] C2 — jp_delete_workspace_owner RLS recursion fix** (가장 우선)
- 본 plan §3.1~4.4 진행
- 완료 후 PR #90 의 SECURITY DEFINER 우회 helper (jpc_check_can_delete_jp 등) 가
  invoker 직접 호출로 복원 가능한지 §4.3 검증

## 8. 참조 메모리

- `pitfall_rls_with_check_self_select_recursion` — plpgsql SECURITY DEFINER 필수 패턴
- `feedback_staging_dryrun_ddl_only_insufficient` — 함수 호출 검증
- `feedback_supabase_migration_workflow` — MCP apply_migration 전용
- `pitfall_rls_dynamic_verification_sparse_data` — matching row count 사전 측정
- `pitfall_local_supabase_helper_drift` — 로컬 supabase 부팅 drift (검증 시 prod 경유 권장)
- (신규) `pitfall_rls_jpc_recursion_widespread` — 본 세션 작성
