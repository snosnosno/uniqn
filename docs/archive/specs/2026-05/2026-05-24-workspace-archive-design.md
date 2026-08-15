# 워크스페이스 아카이브(소프트 삭제) 설계

> 작성일: 2026-05-24
> 상태: 설계 승인 대기
> 관련: `2026-05-09-workspace-tab-migration-design.md`, `2026-05-11-job-posting-collaborators-design.md`

## 1. 배경 & 문제

employer는 워크스페이스를 **최대 10개**까지 가질 수 있으나(`WORKSPACE_LIMITS.MAX_PER_OWNER = 10`, RLS `workspaces_insert_employer_with_cap`), **삭제·정리할 방법이 전혀 없다**. 잘못 만들었거나 더 이상 쓰지 않는 워크스페이스도 10개 한도를 영구히 차지한다.

### 왜 hard-delete가 아닌가

`job_postings.workspace_id`는 `ON DELETE RESTRICT`로 워크스페이스를 참조한다(`20260430010350_job_postings_add_workspace_id.sql`, M3에서 `NOT NULL`). 공고를 가진 워크스페이스를 강제로 hard-delete하려면 공고를 함께 지워야 하는데, `applications` / `work_logs`(정산 payroll 포함) / `event_qr_codes` / `reviews`가 모두 `job_postings ON DELETE CASCADE`로 연결되어 있어 **연쇄 데이터 참사**가 발생한다. 따라서 **아카이브(소프트 삭제)** 방식을 채택한다.

## 2. 목표 / 비목표

**목표**
- owner가 워크스페이스를 아카이브하여 switcher·설정에서 숨기고 **cap 슬롯을 즉시 회수**한다.
- 아카이브는 **되돌릴 수 있다**(복원).
- 공고·지원·근무기록·정산 등 **모든 연결 데이터는 100% 보존**된다.

**비목표**
- 영구 삭제(hard-delete)는 본 설계 범위 밖(추후 별도 판단).
- 크로스 디바이스 실시간 동기화는 선택적(YAGNI). 아카이브를 트리거한 본인 클라이언트는 query invalidate로 즉시 반영.

## 3. 핵심 결정 (확정)

| # | 결정 | 값 |
|---|------|-----|
| D1 | 삭제 방식 | **아카이브(소프트 삭제)** — `archived_at` 컬럼 |
| D2 | 진행공고 있을 때 | **차단 + 안내** (자동 마감 안 함) |
| D3 | "진행 중" 차단 기준 status | **`active` + `approved` + `pending`** |
| D4 | 권한 | **owner 전용** (RPC + RLS 강제) |
| D5 | cap 집계 | **아카이브된 것 제외** |
| D6 | 복원 | 가능, 단 복원 시 **cap 재검사** |
| D7 | 마지막 워크스페이스 아카이브 | **허용** (이후 공고 생성 시 자동 생성 fallback이 수용) |
| D8 | 보관함 UI | **별도 화면** (`workspace/archived.tsx`) |

## 4. 데이터 모델

```sql
ALTER TABLE public.workspaces
  ADD COLUMN archived_at timestamptz NULL;  -- NULL = 활성, 값 있으면 아카이브됨

COMMENT ON COLUMN public.workspaces.archived_at IS
  '소프트 삭제 마커. NULL=활성. 값 있으면 switcher/list/cap 에서 제외. owner 가 복원 가능.';

-- cap / list_my_workspaces 핫패스용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_active
  ON public.workspaces(owner_id) WHERE archived_at IS NULL;
```

- `archived_at` 단일 컬럼만 추가. owner = 항상 아카이브 주체이므로 `archived_by` 불필요.
- `workspace_members` / `workspace_invitations` / `job_postings`는 **삭제·변경하지 않음**. 전부 보존, 단지 숨김.

## 5. Cap 집계에서 아카이브 제외

10개 한도 검사 **2곳**을 `AND archived_at IS NULL`로 수정:

1. RLS `workspaces_insert_employer_with_cap` (`20260430010400_workspace_rls_policies.sql:27`)
   ```sql
   AND (SELECT count(*) FROM public.workspaces
        WHERE owner_id = (SELECT auth.uid()) AND archived_at IS NULL) < 10
   ```
2. `create_workspace` RPC 내부 cap 검사 (`20260514030000_workspace_create_workspace_rpc.sql`) — 동일 조건 추가.

→ 아카이브 즉시 슬롯이 비어 새 워크스페이스 생성 가능.

## 6. 가시성

- `list_my_workspaces` RPC (`20260514040000`)에 `AND w.archived_at IS NULL` 필터 추가. owner·editor 양쪽 switcher/설정에서 자동으로 사라진다.
- `workspaces` SELECT RLS(`workspaces_select_owner_or_member`)는 **변경하지 않는다**. owner는 복원·공고 FK 무결성을 위해 아카이브된 워크스페이스도 조회 가능해야 한다. 가시성 필터링은 list RPC 레이어에서만 수행.
- 아카이브된 워크스페이스의 (종료된) 공고는 active 워크스페이스 기준으로 동작하는 my-postings 목록에 노출되지 않으며, 복원 시 다시 나타난다.

## 7. RPC

기존 invitation RPC 패턴 준수: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp`, `auth.uid()` 확인, owner 검증, 멱등, `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated`.

### 7.1 `archive_workspace(p_workspace_id uuid) RETURNS void`

```
1. v_caller := auth.uid(); NULL → RAISE 'AUTH_REQUIRED' (42501)
2. SELECT owner_id, archived_at INTO v_owner, v_archived
     FROM workspaces WHERE id = p_workspace_id FOR UPDATE
   없음 → RAISE 'WORKSPACE_NOT_FOUND' (P0002)
3. v_owner != v_caller → RAISE 'PERMISSION_DENIED' (42501)
4. v_archived IS NOT NULL → return (멱등)
5. 진행공고 검사:
     SELECT count(*) FROM job_postings
     WHERE workspace_id = p_workspace_id
       AND status IN ('active','approved','pending')
   > 0 → RAISE 'WORKSPACE_HAS_ACTIVE_POSTINGS:%' (개수, P0001)
6. UPDATE workspaces SET archived_at = now() WHERE id = p_workspace_id
```

### 7.2 `restore_workspace(p_workspace_id uuid) RETURNS void`

```
1. auth 확인 (AUTH_REQUIRED)
2. SELECT owner_id, archived_at INTO ... FOR UPDATE
   없음 → WORKSPACE_NOT_FOUND
3. owner 검증 (PERMISSION_DENIED)
4. archived_at IS NULL → return (멱등 — 이미 활성)
5. cap 재검사:
     SELECT count(*) FROM workspaces
     WHERE owner_id = v_caller AND archived_at IS NULL
   >= 10 → RAISE 'WORKSPACE_CAP_REACHED' (P0001)
6. UPDATE workspaces SET archived_at = NULL WHERE id = p_workspace_id
```

> `archived_at` UPDATE는 `fn_workspaces_set_updated_at` BEFORE UPDATE 트리거로 `updated_at`도 함께 갱신된다.

## 8. 활성 워크스페이스 전환

현재 active 워크스페이스를 아카이브하면 → `list_my_workspaces`에서 빠짐 → 기존 `useActiveWorkspace`의 orphan self-heal이 자동으로 다른 워크스페이스를 활성화한다(추가 코드 불필요). 마지막 워크스페이스를 아카이브하면 active 0개가 되며, 설정 화면은 기존 "워크스페이스가 없어요" empty state를 표시한다. 이후 공고 생성 시 `workspaceService.getDefaultWorkspaceIdForOwner`의 자동 생성 fallback이 새 워크스페이스를 만든다.

## 9. 클라이언트 (Presentation → Hooks → Service → Repository)

| 계층 | 파일 | 추가 |
|------|------|------|
| Repository | `WorkspaceRepository.ts` | `archiveViaRpc(id)`, `restoreViaRpc(id)`, `findArchivedByOwner(ownerId)` |
| Service | `workspaceService.ts` | `archiveWorkspace({workspaceId})`, `restoreWorkspace({workspaceId})`, `listArchivedWorkspaces(ownerId)` (입력 zod 검증) |
| Hooks | `hooks/workspace/` | `useArchiveWorkspace`, `useRestoreWorkspace`, `useArchivedWorkspaces` (TanStack mutation/query + invalidate `workspaces.*`) |
| Type | `types/workspace.ts` | `Workspace.archivedAt: string \| null` |
| Schema | `workspace.schema.ts` | `archiveWorkspaceSchema` / `restoreWorkspaceSchema` (`workspaceId: uuid`) |
| Errors | `errors/workspace.ts` | `WORKSPACE_HAS_ACTIVE_POSTINGS` 코드 + `mapWorkspaceRpcError`에 매핑 |

- Repository INSERT/UPDATE는 RPC 경유(아키텍처 규칙). `findArchivedByOwner`는 읽기 전용 SELECT(`archived_at IS NOT NULL` + `owner_id` 매칭) — RLS가 owner 조회 허용.
- `findAllByMember` 매핑에 `archivedAt` 추가(snake→camel).

## 10. UI

### 10.1 설정 화면 (`app/(employer)/workspace/index.tsx`)
- owner 전용, 화면 하단에 **"이 워크스페이스 보관"** 액션 + **"보관함"** 진입 링크.
- 되돌릴 수 있으므로 error-red 대신 차분한 destructive 스타일(secondary/ghost + warning 톤). 라벨 구체화(impeccable 룰 11).
- `showConfirm`(web/native 호환) → "'{이름}' 워크스페이스를 보관할까요? 공고와 기록은 보존되며 보관함에서 복원할 수 있어요."
- 진행공고 차단 시 토스트(룰 10 공식): "진행 중인 공고 N건을 먼저 마감해주세요."
- 아카이브 성공 시 success 토스트 + active 워크스페이스 자동 전환.

### 10.2 보관함 화면 (신규 `app/(employer)/workspace/archived.tsx`)
- 아카이브된 워크스페이스 목록(`useArchivedWorkspaces`), 각 항목에 이름·보관일·**"복원"** 버튼.
- 복원 시 cap(10) 초과면 차단 토스트: "활성 워크스페이스가 10개예요. 하나를 보관한 뒤 복원해주세요."
- 빈 상태: "보관한 워크스페이스가 없어요" (impeccable 룰 9).
- StackHeader title="보관함", dark: 토큰 적용.

## 11. 에러 처리

`errors/workspace.ts`의 `WORKSPACE_ERROR_CODES`(E6080~)에 추가하고 `mapWorkspaceRpcError`가 RPC 예외명을 도메인 에러로 변환:

| RPC 예외 | 도메인 코드 | userMessage |
|----------|-------------|-------------|
| `AUTH_REQUIRED` | AUTH | (기존) |
| `PERMISSION_DENIED` | 권한 | "이 워크스페이스의 소유자만 보관할 수 있어요." |
| `WORKSPACE_NOT_FOUND` | 비즈 | "워크스페이스를 찾을 수 없어요." |
| `WORKSPACE_HAS_ACTIVE_POSTINGS:N` | 비즈 | "진행 중인 공고 N건을 먼저 마감해주세요." |
| `WORKSPACE_CAP_REACHED` | 비즈 | "활성 워크스페이스가 10개예요. 하나를 보관한 뒤 복원해주세요." |

## 12. 테스트

**pgTAP** (`supabase/tests/workspace_archive.test.sql`)
- archive: 진행공고(active/approved/pending) 있으면 차단 / 종료공고(closed/cancelled/expired/rejected/draft)만 있으면 성공
- archive: non-owner 차단(PERMISSION_DENIED), 멱등(이미 아카이브)
- cap: 아카이브된 워크스페이스가 `create_workspace`/INSERT cap에서 제외됨
- restore: 활성 10개 시 차단(WORKSPACE_CAP_REACHED), 9개면 성공, 멱등(이미 활성)
- list_my_workspaces: 아카이브된 것 미노출

**Unit (Jest)**
- `workspaceService` archive/restore/listArchived: zod 검증, RPC 호출 위임
- `WorkspaceRepository` 매핑(`archivedAt` snake→camel)
- `mapWorkspaceRpcError`: `WORKSPACE_HAS_ACTIVE_POSTINGS:N` 파싱 + userMessage

**E2E**: 현재 러너 리소스 경합으로 비결정적 timeout 이슈(메모리 기록)가 있어 본 작업에서는 제외. unit + pgTAP 집중.

## 13. 마이그레이션 순서 (MCP `apply_migration`)

1. `..._workspace_add_archived_at.sql` — 컬럼 + 인덱스 + 코멘트
2. `..._workspace_archive_cap_exclusion.sql` — RLS cap + `create_workspace` RPC cap에 `archived_at IS NULL`
3. `..._workspace_list_exclude_archived.sql` — `list_my_workspaces`에 필터
4. `..._workspace_archive_restore_rpcs.sql` — `archive_workspace` / `restore_workspace`
5. `..._workspace_archive_pgtap.sql` (또는 tests 디렉터리) — pgTAP

> 마이그레이션은 MCP `apply_migration` 전용(`supabase db push` 금지). 기존 마이그레이션 파일 수정 금지 — RPC는 `CREATE OR REPLACE`로 신규 파일에서 재정의.

## 14. 리스크 & 완화

| 리스크 | 완화 |
|--------|------|
| `list_my_workspaces` 필터 누락 시 아카이브된 게 switcher에 남음 | pgTAP에서 명시 검증 |
| RLS SELECT를 건드려 JPC recursion(42P17) 재발 | SELECT RLS는 **변경하지 않음**. archive 필터는 RPC에서만 |
| 복원 시 cap 우회 | restore RPC에 cap 재검사 명시 |
| 진행공고 status 집합 오판 | `active`+`approved`+`pending` 확정(D3). draft는 미게시라 미포함 |
