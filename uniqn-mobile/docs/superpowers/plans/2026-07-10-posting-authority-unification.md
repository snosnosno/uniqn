# 공고 권한 판정 통합 (postingAuthority) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서로 다른 규칙을 가진 4개의 소유권 판정 함수를 단일 `postingAuthority` 모듈로 통합하고, 소유권 검증이 아예 없던 2개 쓰기 경로에 가드를 추가해, 앱레이어 권한을 prod RLS와 일치시킨다.

**Architecture:** `resolvePostingAuthority()`가 (공고 owner / 워크스페이스 멤버 / 공고 협업자) 세 플래그를 반환하고, `canManagePosting()`이 역량을 판정한다. owner면 RPC 0회(short-circuit), 아니면 최대 2회. 기존 리포지토리 가드들은 자체 판정식을 버리고 이 모듈을 호출한다.

**Tech Stack:** TypeScript strict, Supabase JS RPC (`is_workspace_member`, `is_posting_collaborator`, `is_admin`), Jest.

## Global Constraints

- 모든 주석·커밋 메시지·에러 문구는 **한글**.
- `logger.info()` 사용, `console.log()` 금지.
- 경로는 `@/` 절대 경로.
- 불변성: 객체 변형 금지, 스프레드로 새 객체 생성.
- 에러는 `src/errors`의 `AppError` 계열 (`PermissionError`, `BusinessError`) + `ERROR_CODES`.
- **admin은 mutate/근무기록 쓰기에서 계속 거부한다.** 이유: 후속 RLS(`wl_update`)에 admin 분기가 없어 UPDATE가 0행 silent no-op이 되고 caller가 false success를 인식한다 (PR3-A.2, `JobPostingRepositoryHelpers.ts:105-109` 주석). 이 결정을 지우지 말 것.
- **`loadAndVerifyDeleteAccess`는 이번 범위 밖.** delete 매트릭스(owner|admin)는 그대로 둔다.
- **`changedBy`/`modifiedBy`를 인가 주체로 쓰지 말 것.** `changedBy`는 `?? 'system'` 폴백이 있는 감사(audit) 필드다. 별도 `actorId`를 서비스에서 `requireCurrentUser()`로 채운다.

### prod RLS 실측값 (2026-07-10, 이 계획의 근거)

| 대상                  | 정책                                              | USING                                                                                         |
| --------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `job_postings` UPDATE | `jp_update_workspace_member` (PERMISSIVE)         | `is_workspace_member(workspace_id, uid) OR is_posting_collaborator(id, uid) OR is_admin()`    |
| `job_postings` UPDATE | `jp_container_no_direct_update` (**RESTRICTIVE**) | `status <> 'container'`                                                                       |
| `work_logs` UPDATE    | `wl_update` (PERMISSIVE)                          | `owner_id = uid OR is_workspace_member(...) OR is_posting_collaborator(...)` — **admin 없음** |

RPC 실행 권한: `is_workspace_member`·`is_posting_collaborator` 는 `authenticated` EXECUTE ✅ / `anon` ❌. `is_admin` 은 둘 다 ✅. **마이그레이션 불필요.**

---

## File Structure

| 파일                                                                                          | 책임                                                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Create** `src/repositories/supabase/postingAuthority.ts`                                    | 권한 플래그 해석 + 역량 판정. 이 슬라이스의 단일 진실원                               |
| **Create** `src/repositories/supabase/__tests__/postingAuthority.test.ts`                     | 해석기·역량 단위 테스트                                                               |
| **Modify** `src/repositories/supabase/JobPostingRepositoryHelpers.ts:115-154`                 | `loadAndVerifyMutateAccess` → 해석기 사용 (협업자 추가)                               |
| **Modify** `src/repositories/supabase/SettlementRepository.ts:574-639, 362`                   | `validateWorkLogOwnership` + bulk 인라인 체크 → 해석기 사용                           |
| **Modify** `src/repositories/supabase/ConfirmedStaffRepository.ts:179-203, 258-351`           | `verifyJobPostingOwnership` → 해석기 사용 + `updateRole`/`updateWorkTime`에 가드 신설 |
| **Modify** `src/repositories/interfaces/IConfirmedStaffRepository.ts:5-19`                    | `UpdateRoleContext`·`UpdateConfirmedStaffWorkTimeContext`에 `actorId: string` 추가    |
| **Modify** `src/services/work/confirmedStaffService.ts:119-146`                               | `actorId`를 `requireCurrentUser()`로 채워 전달                                        |
| **Modify** `src/repositories/supabase/__tests__/JobPostingRepository.write.workspace.test.ts` | 협업자 통과 케이스 추가 (admin 거부·member delete 거부 단언은 **유지**)               |
| **Modify** `src/repositories/supabase/__tests__/SettlementRepository.bulk.test.ts`            | ownerId 단순비교 → 권한 기반                                                          |
| **Modify** `src/services/work/__tests__/settlementService.test.ts`                            | "P0 hotfix shim" owner-only 시나리오에 member/협업자 케이스 추가                      |

---

## Task 1: postingAuthority 모듈

**Files:**

- Create: `src/repositories/supabase/postingAuthority.ts`
- Test: `src/repositories/supabase/__tests__/postingAuthority.test.ts`

**Interfaces:**

- Consumes: `supabase` from `@/lib/supabase`, `handleSupabaseError` from `@/utils/supabase`
- Produces:
  - `interface PostingAuthority { isPostingOwner: boolean; isWorkspaceMember: boolean; isPostingCollaborator: boolean }`
  - `resolvePostingAuthority(input: ResolveAuthorityInput): Promise<PostingAuthority>`
  - `interface ResolveAuthorityInput { jobPostingId: string; workspaceId: string; postingOwnerId: string; actorId: string; operation: string }`
  - `canManagePosting(a: PostingAuthority): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/repositories/supabase/__tests__/postingAuthority.test.ts`:

```typescript
import {
  resolvePostingAuthority,
  canManagePosting,
} from '@/repositories/supabase/postingAuthority';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const rpc = supabase.rpc as jest.Mock;
const base = {
  jobPostingId: 'jp-1',
  workspaceId: 'ws-1',
  postingOwnerId: 'owner-1',
  actorId: 'owner-1',
  operation: '공고 수정',
};

beforeEach(() => rpc.mockReset());

describe('resolvePostingAuthority', () => {
  it('공고 owner 면 RPC 를 한 번도 호출하지 않는다', async () => {
    const a = await resolvePostingAuthority(base);
    expect(a).toEqual({
      isPostingOwner: true,
      isWorkspaceMember: false,
      isPostingCollaborator: false,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('워크스페이스 멤버면 협업자 RPC 는 호출하지 않는다', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const a = await resolvePostingAuthority({ ...base, actorId: 'member-1' });
    expect(a.isWorkspaceMember).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('is_workspace_member', {
      _workspace_id: 'ws-1',
      _user_id: 'member-1',
    });
  });

  it('멤버가 아니면 공고 협업자를 확인한다', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const a = await resolvePostingAuthority({ ...base, actorId: 'collab-1' });
    expect(a.isPostingCollaborator).toBe(true);
    expect(rpc).toHaveBeenNthCalledWith(2, 'is_posting_collaborator', {
      p_posting_id: 'jp-1',
      p_user_id: 'collab-1',
    });
  });

  it('셋 다 아니면 모든 플래그가 false 다', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    const a = await resolvePostingAuthority({ ...base, actorId: 'outsider-1' });
    expect(canManagePosting(a)).toBe(false);
  });
});

describe('canManagePosting', () => {
  it.each([
    [{ isPostingOwner: true, isWorkspaceMember: false, isPostingCollaborator: false }, true],
    [{ isPostingOwner: false, isWorkspaceMember: true, isPostingCollaborator: false }, true],
    [{ isPostingOwner: false, isWorkspaceMember: false, isPostingCollaborator: true }, true],
    [{ isPostingOwner: false, isWorkspaceMember: false, isPostingCollaborator: false }, false],
  ])('%o → %s', (authority, expected) => {
    expect(canManagePosting(authority)).toBe(expected);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/repositories/supabase/__tests__/postingAuthority.test.ts`
Expected: FAIL — `Cannot find module '@/repositories/supabase/postingAuthority'`

- [ ] **Step 3: 최소 구현**

`src/repositories/supabase/postingAuthority.ts`:

```typescript
/**
 * UNIQN Mobile — 공고 권한(authority) 단일 판정
 *
 * @description 공고/근무기록 쓰기 권한을 한 곳에서 판정한다.
 * prod RLS 실측(2026-07-10)과 앱레이어를 일치시킨다.
 *
 *   job_postings UPDATE : is_workspace_member OR is_posting_collaborator OR is_admin
 *   work_logs    UPDATE : owner_id OR is_workspace_member OR is_posting_collaborator (admin 없음)
 *
 * admin 은 이 모듈이 다루지 않는다. 호출부가 명시적으로 거부한다(PR3-A.2):
 * 후속 RLS 에 admin 분기가 없어 UPDATE 가 0행 silent no-op 이 되고
 * caller 가 false success 를 인식하기 때문이다.
 *
 * 호출 비용: owner 면 RPC 0회, 멤버면 1회, 협업자/외부인이면 2회.
 */
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/utils/supabase';

const TABLE = 'job_postings';

export interface PostingAuthority {
  isPostingOwner: boolean;
  isWorkspaceMember: boolean;
  isPostingCollaborator: boolean;
}

export interface ResolveAuthorityInput {
  jobPostingId: string;
  workspaceId: string;
  postingOwnerId: string;
  actorId: string;
  operation: string;
}

export async function resolvePostingAuthority(
  input: ResolveAuthorityInput
): Promise<PostingAuthority> {
  const { jobPostingId, workspaceId, postingOwnerId, actorId, operation } = input;

  if (postingOwnerId === actorId) {
    return { isPostingOwner: true, isWorkspaceMember: false, isPostingCollaborator: false };
  }

  const memberResult = await supabase.rpc('is_workspace_member', {
    _workspace_id: workspaceId,
    _user_id: actorId,
  });
  if (memberResult.error) handleSupabaseError(memberResult.error, { operation, table: TABLE });
  if (memberResult.data === true) {
    return { isPostingOwner: false, isWorkspaceMember: true, isPostingCollaborator: false };
  }

  const collaboratorResult = await supabase.rpc('is_posting_collaborator', {
    p_posting_id: jobPostingId,
    p_user_id: actorId,
  });
  if (collaboratorResult.error) {
    handleSupabaseError(collaboratorResult.error, { operation, table: TABLE });
  }

  return {
    isPostingOwner: false,
    isWorkspaceMember: false,
    isPostingCollaborator: collaboratorResult.data === true,
  };
}

/** 공고 수정·마감·재오픈·정산설정 및 근무기록 쓰기 역량. admin 은 포함하지 않는다. */
export function canManagePosting(authority: PostingAuthority): boolean {
  return authority.isPostingOwner || authority.isWorkspaceMember || authority.isPostingCollaborator;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/repositories/supabase/__tests__/postingAuthority.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/repositories/supabase/postingAuthority.ts src/repositories/supabase/__tests__/postingAuthority.test.ts
git commit -m "feat(auth): 공고 권한 단일 판정 모듈 postingAuthority 신설"
```

---

## Task 2: JobPostingRepositoryHelpers — 협업자 허용

**Files:**

- Modify: `src/repositories/supabase/JobPostingRepositoryHelpers.ts:115-154`
- Test: `src/repositories/supabase/__tests__/JobPostingRepository.write.workspace.test.ts`

**Interfaces:**

- Consumes: `resolvePostingAuthority`, `canManagePosting` (Task 1)
- Produces: 동작 변경만. 시그니처 불변 — `loadAndVerifyMutateAccess(jobPostingId, callerId, operation): Promise<JobPosting>`

**주의:** `workspaceId`가 없는 레거시 row는 **해석기 호출 전에** 기존처럼 즉시 거부한다. jpc 협업자 추가는 워크스페이스 owner만 가능하므로(`jpc_insert_ws_owner`) 레거시 row에는 협업자가 존재할 수 없다. 순서를 바꾸면 기존 레거시 테스트가 깨진다.

- [ ] **Step 1: 실패하는 테스트 추가**

`JobPostingRepository.write.workspace.test.ts`에 추가:

```typescript
it('공고 협업자의 close 호출은 통과한다 (JPC — RLS jp_update_workspace_member 와 일치)', async () => {
  rpcMock.mockResolvedValueOnce({ data: false, error: null }); // is_workspace_member
  rpcMock.mockResolvedValueOnce({ data: true, error: null }); // is_posting_collaborator

  await expect(repository.closeWithTransaction('jp-1', 'collab-1', '마감')).resolves.not.toThrow();

  expect(rpcMock).toHaveBeenNthCalledWith(2, 'is_posting_collaborator', {
    p_posting_id: 'jp-1',
    p_user_id: 'collab-1',
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/repositories/supabase/__tests__/JobPostingRepository.write.workspace.test.ts -t '공고 협업자'`
Expected: FAIL — `is_admin` 이 두 번째로 호출되어 PermissionError

- [ ] **Step 3: 구현**

`JobPostingRepositoryHelpers.ts` — import 추가:

```typescript
import { resolvePostingAuthority, canManagePosting } from './postingAuthority';
```

`loadAndVerifyMutateAccess` 본문(115-154)을 교체:

```typescript
export async function loadAndVerifyMutateAccess(
  jobPostingId: string,
  callerId: string,
  operation: string
): Promise<JobPosting> {
  const jobPosting = await loadJobPostingForVerify(jobPostingId, operation);
  if (jobPosting.ownerId === callerId) return jobPosting;

  // workspaceId 없는 레거시 row 방어. 협업자(JPC)는 워크스페이스 owner 만 추가할 수 있어
  // 레거시 row 에는 존재할 수 없다 — 해석기 호출 전에 즉시 거부한다.
  if (!jobPosting.workspaceId) {
    throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: `공고에 워크스페이스가 지정되지 않았습니다: ${operation}`,
    });
  }

  const authority = await resolvePostingAuthority({
    jobPostingId,
    workspaceId: jobPosting.workspaceId,
    postingOwnerId: jobPosting.ownerId,
    actorId: callerId,
    operation,
  });
  if (canManagePosting(authority)) return jobPosting;

  // PR3-A.2: admin 분기 silent no-op 차단. admin write 는 SECURITY DEFINER RPC 경유.
  const adminResult = await supabase.rpc('is_admin');
  if (adminResult.error) {
    handleSupabaseError(adminResult.error, { operation, table: TABLE });
  }
  if (adminResult.data === true) {
    throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: `admin 직접 수정은 허용되지 않습니다. admin 전용 RPC 를 사용하세요: ${operation}`,
    });
  }

  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `워크스페이스 멤버 또는 공고 협업자만 수행할 수 있습니다: ${operation}`,
  });
}
```

`@see` 주석 블록(100-113)의 "호출 비용" 줄을 갱신:

```
 * 호출 비용: owner 본인이면 RPC 0회, 멤버면 1회, 협업자면 2회, admin/외부인이면 3회 (둘 다 throw).
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/repositories/supabase/__tests__/JobPostingRepository.write.workspace.test.ts`
Expected: PASS — 신규 협업자 케이스 포함, **admin 거부·member delete 거부 단언도 그대로 통과**

- [ ] **Step 5: 커밋**

```bash
git add src/repositories/supabase/JobPostingRepositoryHelpers.ts src/repositories/supabase/__tests__/JobPostingRepository.write.workspace.test.ts
git commit -m "fix(auth): 공고 mutate 가드가 공고 협업자를 인식하도록 통합"
```

---

## Task 3: SettlementRepository — 정산 쓰기 권한 통합

**Files:**

- Modify: `src/repositories/supabase/SettlementRepository.ts:574-639` (`validateWorkLogOwnership`), `:294-441` (bulk 인라인 체크 `:362`)
- Test: `src/repositories/supabase/__tests__/SettlementRepository.bulk.test.ts`

**Interfaces:**

- Consumes: `resolvePostingAuthority`, `canManagePosting` (Task 1)
- Produces: `validateWorkLogOwnership(workLogId, actorId, operationMessage)` — 파라미터명만 `ownerId` → `actorId`. 반환 `WorkLogOwnershipResult` 불변.

**사전 확인 (Step 0):** `JOB_POSTING_COLUMNS` 상수에 `workspace_id`가 포함되어 있는지 확인한다. 없으면 추가한다 — 없으면 `toJobPosting()`이 `workspaceId`를 `undefined`로 만들어 해석기가 터진다.

Run: `grep -n "JOB_POSTING_COLUMNS" src/repositories/supabase/SettlementRepository.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`SettlementRepository.bulk.test.ts`에 추가:

```typescript
it('워크스페이스 멤버의 일괄정산은 스킵되지 않는다', async () => {
  rpcMock.mockResolvedValue({ data: true, error: null }); // is_workspace_member
  const result = await repository.bulkSettlementWithTransaction(['wl-1'], 'member-1');
  expect(result.results[0]).toMatchObject({ success: true });
});

it('외부인의 일괄정산은 스킵된다', async () => {
  rpcMock.mockResolvedValueOnce({ data: false, error: null }); // is_workspace_member
  rpcMock.mockResolvedValueOnce({ data: false, error: null }); // is_posting_collaborator
  const result = await repository.bulkSettlementWithTransaction(['wl-1'], 'outsider-1');
  expect(result.results[0]).toMatchObject({ success: false, message: '권한이 없는 공고입니다' });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/repositories/supabase/__tests__/SettlementRepository.bulk.test.ts`
Expected: FAIL — 멤버가 `본인의 공고가 아닙니다`로 스킵됨

- [ ] **Step 3: 구현**

`SettlementRepository.ts` — import 추가:

```typescript
import { resolvePostingAuthority, canManagePosting } from './postingAuthority';
```

`validateWorkLogOwnership`의 소유권 비교(632-636)를 교체:

```typescript
if (!jobPosting.workspaceId) {
  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `공고에 워크스페이스가 지정되지 않았습니다: ${operationMessage}`,
  });
}

const authority = await resolvePostingAuthority({
  jobPostingId: jobPosting.id,
  workspaceId: jobPosting.workspaceId,
  postingOwnerId: jobPosting.ownerId,
  actorId,
  operation: operationMessage,
});

if (!canManagePosting(authority)) {
  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `권한이 있는 공고의 근무 기록만 ${operationMessage}할 수 있습니다`,
  });
}
```

`bulkSettlementWithTransaction`의 인라인 체크(362)를 교체. **공고 단위로 권한을 캐시해 N+1 RPC를 피한다**:

```typescript
// 공고별 권한 캐시 — 같은 공고의 근무기록 N건에 RPC 를 N번 부르지 않는다.
const authorityCache = new Map<string, boolean>();

const canManage = async (jobPosting: JobPosting): Promise<boolean> => {
  const cached = authorityCache.get(jobPosting.id);
  if (cached !== undefined) return cached;
  if (!jobPosting.workspaceId) {
    authorityCache.set(jobPosting.id, false);
    return false;
  }
  const authority = await resolvePostingAuthority({
    jobPostingId: jobPosting.id,
    workspaceId: jobPosting.workspaceId,
    postingOwnerId: jobPosting.ownerId,
    actorId,
    operation: '일괄 정산',
  });
  const allowed = canManagePosting(authority);
  authorityCache.set(jobPosting.id, allowed);
  return allowed;
};
```

그리고 362행의 `if (!jobPosting || jobPosting.ownerId !== ownerId)` 를:

```typescript
if (!jobPosting || !(await canManage(jobPosting))) {
  results.push({ workLogId, success: false, message: '권한이 없는 공고입니다' });
  continue;
}
```

파라미터명 `ownerId` → `actorId` 로 일괄 변경 (`validateWorkLogOwnership`, `bulkSettlementWithTransaction` 및 그 호출부).

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/repositories/supabase/__tests__/SettlementRepository`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/repositories/supabase/SettlementRepository.ts src/repositories/supabase/__tests__/SettlementRepository.bulk.test.ts
git commit -m "fix(auth): 정산 쓰기 가드를 워크스페이스 멤버·협업자까지 통합"
```

---

## Task 4: ConfirmedStaffRepository — 가드 통합 + 무검증 2경로에 가드 신설

**Files:**

- Modify: `src/repositories/interfaces/IConfirmedStaffRepository.ts:5-19`
- Modify: `src/repositories/supabase/ConfirmedStaffRepository.ts:179-203, 258-299, 301-351`
- Modify: `src/services/work/confirmedStaffService.ts:119-146`
- Test: `src/repositories/supabase/__tests__/ConfirmedStaffRepository.authority.test.ts` (신규)

**Interfaces:**

- Consumes: `resolvePostingAuthority`, `canManagePosting` (Task 1)
- Produces:
  - `UpdateRoleContext` 에 `actorId: string`, `jobPostingId: string` 추가
  - `UpdateConfirmedStaffWorkTimeContext` 에 `actorId: string`, `jobPostingId: string` 추가
  - `verifyPostingAuthority(jobPostingId, actorId, operation): Promise<void>` (모듈 내부, `verifyJobPostingOwnership` 대체)

**주의:** `updateRole`/`updateWorkTime`은 `workLogId`만 받는다. 가드에 `jobPostingId`가 필요하므로 `loadWorkLog()`로 조회한 workLog에서 꺼낸다 — 컨텍스트에 추가하지 말 것 (클라이언트가 임의 `jobPostingId`를 넣으면 다른 공고 권한으로 우회 가능).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/repositories/supabase/__tests__/ConfirmedStaffRepository.authority.test.ts`:

```typescript
it('협업자의 노쇼 처리는 통과한다', async () => {
  rpcMock.mockResolvedValueOnce({ data: false, error: null }); // is_workspace_member
  rpcMock.mockResolvedValueOnce({ data: true, error: null }); // is_posting_collaborator
  await expect(
    repository.markAsNoShow({ workLogId: 'wl-1', ownerId: 'collab-1', reason: '무단결근' })
  ).resolves.not.toThrow();
});

it('외부인의 역할 변경은 SECURITY_UNAUTHORIZED_ACCESS 로 거부된다', async () => {
  rpcMock.mockResolvedValueOnce({ data: false, error: null });
  rpcMock.mockResolvedValueOnce({ data: false, error: null });
  await expect(
    repository.updateRoleWithTransaction({
      workLogId: 'wl-1',
      newRole: 'dealer',
      isStandardRole: true,
      reason: '변경',
      changedBy: 'outsider-1',
      actorId: 'outsider-1',
    })
  ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS });
});

it('외부인의 근무시간 수정은 SECURITY_UNAUTHORIZED_ACCESS 로 거부된다', async () => {
  rpcMock.mockResolvedValueOnce({ data: false, error: null });
  rpcMock.mockResolvedValueOnce({ data: false, error: null });
  await expect(
    repository.updateWorkTimeWithTransaction({
      workLogId: 'wl-1',
      checkInTime: new Date(),
      checkOutTime: null,
      reason: '정정',
      modifiedBy: 'outsider-1',
      actorId: 'outsider-1',
    })
  ).rejects.toMatchObject({ code: ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/repositories/supabase/__tests__/ConfirmedStaffRepository.authority.test.ts`
Expected: FAIL — 역할변경/시간수정은 가드가 없어 통과해버림, 협업자 노쇼는 거부됨

- [ ] **Step 3: 구현**

`IConfirmedStaffRepository.ts`:

```typescript
export interface UpdateRoleContext {
  workLogId: string;
  newRole: string;
  isStandardRole: boolean;
  reason: string;
  /** 감사 기록용 (폴백 'system' 존재). 인가에 사용하지 말 것 */
  changedBy: string;
  /** 인가 주체. 서비스 레이어가 requireCurrentUser() 로 채운다 */
  actorId: string;
}

export interface UpdateConfirmedStaffWorkTimeContext {
  workLogId: string;
  checkInTime: Date | null;
  checkOutTime: Date | null;
  reason: string;
  modifiedBy: string;
  /** 인가 주체. 서비스 레이어가 requireCurrentUser() 로 채운다 */
  actorId: string;
}
```

`ConfirmedStaffRepository.ts` — `verifyJobPostingOwnership`(179-203)을 교체:

```typescript
/**
 * 공고 권한 검증 헬퍼 — prod RLS wl_update(owner | ws member | posting collaborator) 와 일치.
 * admin 은 통과시키지 않는다: wl_update 에 admin 분기가 없어 UPDATE 가 0행 silent no-op 이 된다.
 */
async function verifyPostingAuthority(
  jobPostingId: string,
  actorId: string,
  operation: string
): Promise<void> {
  const { data: jobData, error: jobError } = await supabase
    .from('job_postings')
    .select('id, owner_id, workspace_id')
    .eq('id', jobPostingId)
    .maybeSingle();

  if (jobError) handleSupabaseError(jobError, { operation, table: 'job_postings' });

  if (!jobData) {
    throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다.',
    });
  }

  const row = jobData as Record<string, unknown>;
  const workspaceId = row.workspace_id as string | null;
  if (!workspaceId) {
    throw new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '공고에 워크스페이스가 지정되지 않았습니다.',
    });
  }

  const authority = await resolvePostingAuthority({
    jobPostingId,
    workspaceId,
    postingOwnerId: row.owner_id as string,
    actorId,
    operation,
  });

  if (!canManagePosting(authority)) {
    throw new BusinessError(ERROR_CODES.SECURITY_UNAUTHORIZED_ACCESS, {
      userMessage: '이 공고에 대한 권한이 없습니다.',
    });
  }
}
```

기존 `verifyJobPostingOwnership(jobPostingId, ownerId, op)` 호출부 2곳(`markAsNoShow:368`, `updateStatus:405`)을 `verifyPostingAuthority(jobPostingId, context.ownerId, op)` 로 변경.

`updateRoleWithTransaction` — `loadWorkLog` 직후 가드 삽입 (263행 다음):

```typescript
// 1. 현재 WorkLog 조회
const workLog = await loadWorkLog(context.workLogId, '스태프 역할 변경');

// 1-1. 권한 검증 — workLog 에서 얻은 jobPostingId 로만 판정한다.
//      클라이언트가 넘긴 jobPostingId 를 신뢰하면 타 공고 권한으로 우회 가능.
await verifyPostingAuthority(workLog.jobPostingId, context.actorId, '스태프 역할 변경');
```

`updateWorkTimeWithTransaction` — 동일하게 `loadWorkLog` 직후 삽입:

```typescript
await verifyPostingAuthority(workLog.jobPostingId, context.actorId, '근무 시간 수정');
```

`confirmedStaffService.ts` — 두 호출부에 `actorId` 주입:

```typescript
// updateStaffRole (119 근처)
const actorId = (await requireCurrentUser()).id;
await confirmedStaffRepository.updateRoleWithTransaction({
  workLogId: input.workLogId,
  newRole: input.newRole,
  isStandardRole: input.isStandardRole,
  reason: input.reason,
  changedBy: input.changedBy ?? 'system',
  actorId,
});

// updateWorkTime (133-146)
const actorId = (await requireCurrentUser()).id;
const modifiedBy = input.modifiedBy ?? actorId;
await confirmedStaffRepository.updateWorkTimeWithTransaction({
  workLogId: input.workLogId,
  checkInTime: input.checkInTime,
  checkOutTime: input.checkOutTime,
  reason: input.reason,
  modifiedBy,
  actorId,
});
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest src/repositories/supabase/__tests__/ConfirmedStaffRepository src/services/work/__tests__/confirmedStaffService`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/repositories/interfaces/IConfirmedStaffRepository.ts src/repositories/supabase/ConfirmedStaffRepository.ts src/services/work/confirmedStaffService.ts src/repositories/supabase/__tests__/ConfirmedStaffRepository.authority.test.ts
git commit -m "fix(auth): 확정스태프 쓰기 4경로 권한 통합 — 역할변경·시간수정 무검증 해소"
```

---

## Task 5: 테스트 사각지대 제거 (hotfix shim)

**Files:**

- Modify: `src/services/work/__tests__/settlementService.test.ts`
- Modify: `src/services/jobs/__tests__/applicantManagementService.integration.test.ts`

**배경:** 두 파일은 주석에 스스로 "P0 hotfix shim — 기존 owner-only 경로만 mirror"라고 적어놨다. 실제 헬퍼는 이미 member/admin을 허용하는데 테스트는 owner-only만 본다. 통합 후에도 통과하지만 **member/협업자 회귀를 못 잡는다.**

- [ ] **Step 1: 각 파일의 `unauthorized owner` 테스트 옆에 케이스 추가**

```typescript
it('워크스페이스 멤버는 통과한다 (owner-only 가정 폐기)', async () => {
  rpcMock.mockResolvedValueOnce({ data: true, error: null });
  await expect(getWorkLogsByJobPosting('jp-1', 'member-1')).resolves.toBeDefined();
});

it('공고 협업자는 통과한다', async () => {
  rpcMock.mockResolvedValueOnce({ data: false, error: null });
  rpcMock.mockResolvedValueOnce({ data: true, error: null });
  await expect(getWorkLogsByJobPosting('jp-1', 'collab-1')).resolves.toBeDefined();
});
```

- [ ] **Step 2: 각 파일 상단의 "P0 hotfix shim" 주석 삭제** (더 이상 사실이 아니다)

- [ ] **Step 3: 실행**

Run: `npx jest src/services/work/__tests__/settlementService.test.ts src/services/jobs/__tests__/applicantManagementService.integration.test.ts`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add src/services/work/__tests__/settlementService.test.ts src/services/jobs/__tests__/applicantManagementService.integration.test.ts
git commit -m "test(auth): owner-only shim 시나리오에 멤버·협업자 케이스 추가"
```

---

## Task 6: 전체 검증

- [ ] **Step 1: 타입·린트·포맷**

Run: `npm run quality`
Expected: exit 0

- [ ] **Step 2: 전체 테스트**

Run: `npm test`
Expected: 0 failures. 실패 스위트가 있으면 **테스트를 고치지 말고 구현을 의심하라** — 단, 아래 두 단언은 의도적으로 유지되어야 한다:

- `admin 호출은 PermissionError로 거절된다 (PR3-A.2 silent no-op 차단)`
- `워크스페이스 멤버의 delete 호출은 PermissionError (member 차단)`

- [ ] **Step 3: pgTAP 회귀 (RLS 무변경 확인)**

Run: `npx supabase test db`
Expected: `Result: PASS` — 이 슬라이스는 DB를 바꾸지 않으므로 pgTAP가 그대로 통과해야 한다.

- [ ] **Step 4: 리뷰 에이전트 2종 병렬 디스패치**

`code-reviewer` + `security-reviewer` 를 한 메시지에 병렬 디스패치. 프롬프트에 금지사항 명시(파일 수정 금지·`mcp__supabase__*` 금지·PROD 우회 금지). CRITICAL/HIGH 는 수정, MEDIUM 은 가능하면 수정.

- [ ] **Step 5: 감사 문서·메모리 갱신 후 커밋**

`docs/analysis/2026-07-10-userflow-audit.md` 의 클러스터 A 5건을 완료로 표시하고, 잔여 1건(`staff-role-collaborator-locked-out`, `app/(employer)/_layout.tsx:90` 라우트 role 게이트)을 후속으로 남긴다.

---

## 범위 밖 (명시)

- `loadAndVerifyDeleteAccess` — delete 매트릭스(owner|admin) 유지. RLS는 워크스페이스 owner를 보는데 앱은 공고 owner를 본다는 미세 발산이 남는다.
- `app/(employer)/_layout.tsx:90` 의 `useHasRole('employer')` 게이트 — staff-role 협업자가 조용히 튕겨나가는 문제. **제품 결정**(staff-role 사용자에게 employer 화면을 보여줄 것인가)이 필요해 별도 슬라이스.
- `addDirectStaff` / `removeDirectStaff` — 서버 RPC가 자체 판정. 이번 범위 밖.
