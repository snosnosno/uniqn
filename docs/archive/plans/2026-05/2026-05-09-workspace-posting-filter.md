# Workspace Posting Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Active workspace 단위로 employer 의 공고 관리 흐름을 분리하고, cancellation/리뷰 헬퍼가 워크스페이스 멤버를 차단하지 않도록 한다.

**Architecture:** (a) `JobPostingRepository.getManagedJobPostings` 가 `workspace_id` 필터를 받고, `useMyJobPostings` 가 `useActiveWorkspace` 의 id 를 query key + queryFn 인자로 주입한다 — Switcher 변경 시 React Query 가 자동 re-fetch. (b) `loadAndVerifyJobPostingOwner` 가 owner 외에 `is_workspace_member` / `is_admin` RPC 분기를 추가해 6+ employer 흐름(취소 검토, 거절, 읽음, 확정, 확정취소, 지원자 목록)이 워크스페이스 멤버 + admin 까지 호환된다.

**Tech Stack:** TypeScript 5.x · React 19.2 · Expo 55 · TanStack Query 5 · Supabase JS · Zustand · NativeWind 4.2 · Jest

---

## Context — 검증된 Root Causes (2026-05-09 dogfooding)

1. **`JobPostingRepository.getManagedJobPostings` 가 workspace_id 필터 미적용** (line 305-319). 주석은 "RLS 가 좁힌다"고 적혀 있으나 jp_select RLS 의 첫 분기 `status IN ('approved','active','closed')` 가 **모든 인증 사용자에게 active 공고 SELECT 허용**(staff 검색용). 결과: employer A 의 my-postings 에 employer B 의 active 공고 통합 노출.

2. **`useMyJobPostings` query key 에 `activeWorkspaceId` 미포함** (`useJobManagement.ts:45-63`). Switcher 가 `setActiveWorkspaceId` 호출해도 query key 가 안 바뀌어 re-fetch 트리거 안 됨.

3. **`loadAndVerifyJobPostingOwner` 가 owner-only 체크** (`ApplicationRepositoryHelpers.ts:156-168`). Phase 2A 에서 applications/job_postings RLS 는 owner OR workspace_member OR admin 으로 풀렸지만 클라이언트 헬퍼는 그대로 차단 → 부분 마이그레이션 상태. 6+ 흐름 영향: `getCancellationRequests`, `rejectWithTransaction`, `markAsRead`, `findByJobPostingWithStats`, `confirmWithHistoryTransaction`, `cancelConfirmationTransaction`.

**Out of scope (별도 plan):**
- Phase 3 (RLS jp_select 분리 — Task 5 follow-up section) — eng-review 필요.
- Phase 4 (applications/work_logs/event_qr_codes/settlement/schedule 같은 패턴 audit — Task 6 follow-up section).
- `JobPostingRepository.loadAndVerifyOwner` (write-side: update/close/reopen/delete/settlement) — 따로 검토. 본 plan 은 read + cancellation 흐름만.

---

## File Structure

**Modify:**
- `uniqn-mobile/src/repositories/interfaces/IJobPostingRepository.ts` — interface 시그니처에 `workspaceId?` 추가 (line 140 근처).
- `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts` — `getManagedJobPostings` 에 `workspaceId?` 파라미터 + `eq('workspace_id', ...)` 적용 (line 305-319).
- `uniqn-mobile/src/services/jobs/jobService.ts` — `getMyJobPostings` options 에 `workspaceId?` 추가, repo 호출 두 군데 모두 pass-through (line 229-254).
- `uniqn-mobile/src/hooks/useJobManagement.ts` — `getMyJobPostingsQueryKey` 시그니처 확장 + `useMyJobPostings` 가 `useActiveWorkspace` 사용 (line 45-63).
- `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryHelpers.ts` — `loadAndVerifyJobPostingOwner` 가 `is_workspace_member` + `is_admin` RPC 분기 추가 (line 156-168).

**Modify (tests):**
- `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts` — workspaceId 필터 회귀 테스트 추가.
- `uniqn-mobile/src/services/jobs/__tests__/jobService.test.ts` — workspaceId pass-through 테스트 추가.
- `uniqn-mobile/src/__tests__/hooks/useJobManagement.test.ts` — activeWorkspace 의존성 테스트 추가.

**Create (tests):**
- `uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepositoryHelpers.workspace.test.ts` — `loadAndVerifyJobPostingOwner` 4 역할(owner/member/admin/외부인) 테스트.

---

## Phase 1 — Workspace-Aware Managed Listing (P0)

### Task 1A: Repository getManagedJobPostings 에 workspaceId 옵션 추가

**Files:**
- Modify: `uniqn-mobile/src/repositories/interfaces/IJobPostingRepository.ts:140`
- Modify: `uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:305-319`
- Modify (test): `uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts`

- [ ] **Step 1: Failing 테스트 추가 — workspaceId 인자 시 .eq('workspace_id', ...) 호출 검증**

`uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts` 의 `describe('JobPostingRepository.getManagedJobPostings — Phase 2A editor contract', ...)` 블록 끝에 `it` 추가:

```ts
it('Phase 2A.후속 — workspaceId 가 주어지면 .eq("workspace_id", id) 를 호출한다', async () => {
  await repo.getManagedJobPostings('active', 'ws-abc-123');

  expect(eqSpy).toHaveBeenCalledWith('status', 'active');
  expect(eqSpy).toHaveBeenCalledWith('workspace_id', 'ws-abc-123');
});

it('Phase 2A.후속 — workspaceId 가 undefined 이면 workspace_id 필터를 추가하지 않는다', async () => {
  await repo.getManagedJobPostings('active');

  const workspaceCall = eqSpy.mock.calls.find((c) => c[0] === 'workspace_id');
  expect(workspaceCall).toBeUndefined();
});
```

> 참고: `eqSpy` 는 기존 테스트의 supabase chain mock 패턴. 같은 파일의 기존 `it` 들이 어떻게 spy 를 설정하는지 보고 동일 패턴 재사용. 새 mock 만들지 말 것.

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts -t "Phase 2A.후속" --no-coverage
```

기대: 새로 추가한 2개 케이스 모두 FAIL — `workspaceId` 시그니처가 아직 없음.

- [ ] **Step 3: Interface 시그니처 확장**

`uniqn-mobile/src/repositories/interfaces/IJobPostingRepository.ts:140`:

```ts
// Before
getManagedJobPostings(status?: JobPostingStatus): Promise<JobPosting[]>;

// After
getManagedJobPostings(status?: JobPostingStatus, workspaceId?: string): Promise<JobPosting[]>;
```

- [ ] **Step 4: Repository 구현 확장**

`uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts:305-319` 전체 교체:

```ts
/**
 * Phase 2A — 호출자가 owner 또는 워크스페이스 멤버인 모든 공고 조회.
 *
 * RLS jp_select 가 `owner_id = auth.uid() OR is_workspace_member(workspace_id, auth.uid())`
 * 분기를 제공하지만, jp_select 의 첫 분기 `status IN ('approved','active','closed')`
 * 가 모든 인증 사용자에게 공개 공고 SELECT 권한을 주므로 employer my-postings 흐름은
 * 클라이언트에서 workspace_id 로 명시적으로 좁혀야 한다 (Phase 2A.후속 — 2026-05-09).
 */
async getManagedJobPostings(
  status?: JobPostingStatus,
  workspaceId?: string,
): Promise<JobPosting[]> {
  try {
    logger.info('관리 가능 공고 조회', { status, workspaceId });
    let query = supabase.from(TABLE).select(TABLE_COLUMNS);
    if (status) query = query.eq('status', status);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) handleSupabaseError(error, { operation: '관리 가능 공고 조회', table: TABLE });
    const items = rowsToJobPostings((data ?? []) as Record<string, unknown>[]);
    logger.info('관리 가능 공고 조회 완료', { count: items.length });
    return items;
  } catch (error) {
    rethrowOrHandle(error, '관리 가능 공고 조회', { status, workspaceId });
  }
}
```

- [ ] **Step 5: 테스트 실행 → PASS 확인**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts --no-coverage
```

기대: 신규 2개 + 기존 케이스 모두 PASS.

- [ ] **Step 6: 타입 체크 — 의존자 누락 확인**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

기대: 0 errors. (`getManagedJobPostings` 호출자가 시그니처 변화로 깨지지 않음 — `workspaceId` optional.)

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/src/repositories/interfaces/IJobPostingRepository.ts \
        uniqn-mobile/src/repositories/supabase/JobPostingRepository.ts \
        uniqn-mobile/src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts
git commit -m "feat(workspace): JobPostingRepository.getManagedJobPostings workspaceId 필터 — Phase 2A.후속"
```

---

### Task 1B: jobService.getMyJobPostings 가 workspaceId pass-through

**Files:**
- Modify: `uniqn-mobile/src/services/jobs/jobService.ts:229-254`
- Modify (test): `uniqn-mobile/src/services/jobs/__tests__/jobService.test.ts`

- [ ] **Step 1: Failing 테스트 추가 — options.workspaceId 가 repo 두 호출 모두에 전달되는지**

`uniqn-mobile/src/services/jobs/__tests__/jobService.test.ts` 의 `getMyJobPostings` describe 블록 끝에:

```ts
it('Phase 2A.후속 — workspaceId 옵션을 active/closed 두 호출 모두에 전달한다', async () => {
  mockRepo.getManagedJobPostings.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

  await getMyJobPostings('user-1', { workspaceId: 'ws-abc-123' });

  expect(mockRepo.getManagedJobPostings).toHaveBeenCalledTimes(2);
  expect(mockRepo.getManagedJobPostings).toHaveBeenNthCalledWith(1, 'active', 'ws-abc-123');
  expect(mockRepo.getManagedJobPostings).toHaveBeenNthCalledWith(2, 'closed', 'ws-abc-123');
});

it('Phase 2A.후속 — workspaceId 미지정 시 두 번째 인자는 undefined 로 전달된다', async () => {
  mockRepo.getManagedJobPostings.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

  await getMyJobPostings('user-1');

  expect(mockRepo.getManagedJobPostings).toHaveBeenNthCalledWith(1, 'active', undefined);
  expect(mockRepo.getManagedJobPostings).toHaveBeenNthCalledWith(2, 'closed', undefined);
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd uniqn-mobile && npx jest src/services/jobs/__tests__/jobService.test.ts -t "Phase 2A.후속" --no-coverage
```

기대: 두 케이스 모두 FAIL.

- [ ] **Step 3: Service 시그니처 확장**

`uniqn-mobile/src/services/jobs/jobService.ts:229-254` 전체 교체:

```ts
/**
 * 내 공고 목록 조회 (구인자용)
 *
 * Phase 2A.후속 (2026-05-09) — active workspace 단위로 좁힌다. workspaceId 미지정
 * 시 RLS 가 허용하는 범위 전체(소유 + 멤버 워크스페이스 합산)가 반환되며 이는
 * Switcher 도입 전 레거시 호출자 호환을 위해서만 유지한다.
 */
export async function getMyJobPostings(
  ownerId: string,
  options?: { status?: JobPosting['status']; includeAll?: boolean; workspaceId?: string }
): Promise<JobPosting[]> {
  try {
    const { status, includeAll = true, workspaceId } = options || {};
    logger.info('관리 가능 공고 목록 조회', { ownerId, status, includeAll, workspaceId });

    if (includeAll && !status) {
      const results = await Promise.all([
        jobPostingRepository.getManagedJobPostings(STATUS.JOB_POSTING.ACTIVE, workspaceId),
        jobPostingRepository.getManagedJobPostings(STATUS.JOB_POSTING.CLOSED, workspaceId),
      ]);
      return [...results[0], ...results[1]];
    }

    return jobPostingRepository.getManagedJobPostings(
      status || STATUS.JOB_POSTING.ACTIVE,
      workspaceId,
    );
  } catch (error) {
    throw handleServiceError(error, {
      operation: '관리 가능 공고 조회',
      component: 'jobService',
      context: { ownerId, workspaceId },
    });
  }
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd uniqn-mobile && npx jest src/services/jobs/__tests__/jobService.test.ts --no-coverage
```

기대: 신규 2개 + 기존 케이스 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/services/jobs/jobService.ts \
        uniqn-mobile/src/services/jobs/__tests__/jobService.test.ts
git commit -m "feat(workspace): jobService.getMyJobPostings workspaceId pass-through — Phase 2A.후속"
```

---

### Task 1C: useMyJobPostings hook 이 activeWorkspace 의존

**Files:**
- Modify: `uniqn-mobile/src/hooks/useJobManagement.ts:45-63`
- Modify (test): `uniqn-mobile/src/__tests__/hooks/useJobManagement.test.ts`

- [ ] **Step 1: Failing 테스트 추가 — activeWorkspace 변경 시 query key 변동**

`uniqn-mobile/src/__tests__/hooks/useJobManagement.test.ts` 상단에 `useActiveWorkspace` mock 추가:

```ts
jest.mock('@/hooks/workspace/useActiveWorkspace', () => ({
  useActiveWorkspace: jest.fn(),
}));
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
const mockUseActiveWorkspace = useActiveWorkspace as jest.MockedFunction<typeof useActiveWorkspace>;
```

`describe('useMyJobPostings', ...)` 블록에 케이스 3개:

```ts
it('Phase 2A.후속 — activeWorkspace 가 없으면 query 가 disabled 다', () => {
  mockUseActiveWorkspace.mockReturnValue({
    activeWorkspace: undefined,
    workspaces: [],
    isLoading: false,
    setActiveWorkspaceId: jest.fn(),
  });
  const { result } = renderHook(() => useMyJobPostings(), { wrapper });

  expect(result.current.fetchStatus).toBe('idle'); // enabled=false 일 때 fetchStatus=idle
});

it('Phase 2A.후속 — activeWorkspace.id 가 query key 에 포함된다', () => {
  mockUseActiveWorkspace.mockReturnValue({
    activeWorkspace: { id: 'ws-abc', name: 'Test', ownerId: 'u1', memberCount: 1 } as any,
    workspaces: [],
    isLoading: false,
    setActiveWorkspaceId: jest.fn(),
  });
  const { result } = renderHook(() => useMyJobPostings(), { wrapper });

  // queryClient 의 query 목록에서 key 확인
  const queries = queryClient.getQueryCache().findAll();
  const myPostingsQuery = queries.find((q) =>
    Array.isArray(q.queryKey) && q.queryKey.includes('myPostings')
  );
  expect(myPostingsQuery?.queryKey).toEqual(
    expect.arrayContaining(['ws-abc'])
  );
});

it('Phase 2A.후속 — getMyJobPostings 호출 시 workspaceId 옵션이 전달된다', async () => {
  const getMyJobPostingsSpy = jest.spyOn(servicesModule, 'getMyJobPostings').mockResolvedValue([]);
  mockUseActiveWorkspace.mockReturnValue({
    activeWorkspace: { id: 'ws-abc', name: 'Test', ownerId: 'u1', memberCount: 1 } as any,
    workspaces: [],
    isLoading: false,
    setActiveWorkspaceId: jest.fn(),
  });
  renderHook(() => useMyJobPostings(), { wrapper });

  await waitFor(() => {
    expect(getMyJobPostingsSpy).toHaveBeenCalledWith('user-1-uid', { workspaceId: 'ws-abc' });
  });
});
```

> 참고: `wrapper`, `queryClient`, `servicesModule` 은 같은 파일의 기존 setup 에서 가져옴. 새 import 만들 때 기존 패턴 재사용.

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd uniqn-mobile && npx jest src/__tests__/hooks/useJobManagement.test.ts -t "Phase 2A.후속" --no-coverage
```

기대: 3 케이스 모두 FAIL.

- [ ] **Step 3: Hook 구현 변경**

`uniqn-mobile/src/hooks/useJobManagement.ts` 상단 import 추가:

```ts
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
```

`uniqn-mobile/src/hooks/useJobManagement.ts:45-63` 전체 교체:

```ts
function getMyJobPostingsQueryKey(userId?: string, workspaceId?: string) {
  return [
    ...queryKeys.jobManagement.myPostings(),
    userId ?? 'anonymous',
    workspaceId ?? 'no-workspace',
  ] as const;
}

function getMyJobPostingStatsQueryKey(userId?: string) {
  return [...queryKeys.jobManagement.stats(), userId ?? 'anonymous'] as const;
}

export function useMyJobPostings() {
  const { user } = useAuthStore();
  const { activeWorkspace } = useActiveWorkspace();
  const myPostingsQueryKey = getMyJobPostingsQueryKey(user?.uid, activeWorkspace?.id);

  return useQuery({
    queryKey: myPostingsQueryKey,
    queryFn: () => getMyJobPostings(user!.uid, { workspaceId: activeWorkspace!.id }),
    enabled: !!user && !!activeWorkspace?.id,
    staleTime: cachingPolicies.frequent,
  });
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd uniqn-mobile && npx jest src/__tests__/hooks/useJobManagement.test.ts --no-coverage
```

기대: 신규 3개 + 기존 케이스 모두 PASS.

- [ ] **Step 5: Widget 사이드 회귀 테스트 — 기존 mocking 보강 필요 여부 확인**

```bash
cd uniqn-mobile && npx jest src/components/home/widgets/__tests__ --no-coverage
```

기대: PASS. 만약 `useMyJobPostings` 의 `useActiveWorkspace` mock 미설정으로 깨지면, 각 widget 테스트 (`CancellationWidget.test.tsx`, `WeeklyStaffWidget.test.tsx`, `PostingOverviewWidget.test.tsx`) 의 `beforeEach` 에 다음 mock 추가:

```ts
jest.mock('@/hooks/workspace/useActiveWorkspace', () => ({
  useActiveWorkspace: () => ({
    activeWorkspace: { id: 'ws-test', name: 'Test', ownerId: 'u1', memberCount: 1 },
    workspaces: [],
    isLoading: false,
    setActiveWorkspaceId: jest.fn(),
  }),
}));
```

각 깨진 widget 파일에 동일하게 추가하고 다시 jest 실행 → PASS 까지 반복.

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/hooks/useJobManagement.ts \
        uniqn-mobile/src/__tests__/hooks/useJobManagement.test.ts \
        uniqn-mobile/src/components/home/widgets/__tests__/CancellationWidget.test.tsx \
        uniqn-mobile/src/components/home/widgets/__tests__/WeeklyStaffWidget.test.tsx \
        uniqn-mobile/src/components/home/widgets/__tests__/PostingOverviewWidget.test.tsx
git commit -m "feat(workspace): useMyJobPostings 가 activeWorkspace 의존 — Phase 2A.후속"
```

(깨지지 않은 widget 테스트 파일은 add 대상 제외.)

---

### Task 1D: dogfooding 검증 (Phase 1 마무리)

**Files:** (변경 없음 — 검증만)

- [ ] **Step 1: dev 서버 시작**

```bash
cd uniqn-mobile && npm run web
```

별도 터미널 유지. localhost dev 는 production Supabase 가리키므로 review-employer 의 기존 워크스페이스 + 공고 "234" 그대로 사용 가능.

- [ ] **Step 2: review-employer 두 번째 워크스페이스 생성 (테스트 데이터 분리용)**

브라우저에서 review-employer 로그인 → `/employer/workspace` → "워크스페이스 만들기" → 이름 "검증용 빈 워크스페이스".

- [ ] **Step 3: 첫 번째 워크스페이스(공고 "234" 보유)로 전환 → 내공고 탭**

기대: 공고 "234" 1건 표시.

- [ ] **Step 4: Switcher 로 두 번째 워크스페이스("검증용 빈 워크스페이스") 전환 → 내공고 탭**

기대: 공고 0건. 빈 상태 메시지.

- [ ] **Step 5: review-admin 으로 로그인 → 내공고 탭**

기대: review-admin 본인이 만든 공고만 표시 (review-employer 의 "234" 비노출).

- [ ] **Step 6: 검증 결과 commit message 에 evidence 첨부 — Phase 1 종합 PR 본문에 4 케이스 결과 표 작성 (실제 커밋은 Phase 2 후 한꺼번에)**

검증 표 형식:

| 시나리오 | Before | After |
|----------|--------|-------|
| review-employer / WS1(공고 보유) | 공고 1 | 공고 1 ✅ |
| review-employer / WS2(빈) | 공고 1 (잘못) | 공고 0 ✅ |
| review-admin / 본인 WS | review-employer 공고 노출 (잘못) | 본인 공고만 ✅ |

---

## Phase 2 — Cancellation 워크스페이스 멤버 호환 (P0)

### Task 2A: loadAndVerifyJobPostingOwner 가 workspace member + admin 분기 추가

**Files:**
- Modify: `uniqn-mobile/src/repositories/supabase/ApplicationRepositoryHelpers.ts:156-168`
- Create: `uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepositoryHelpers.workspace.test.ts`

- [ ] **Step 1: 신규 테스트 파일 — 4 역할 시나리오**

`uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepositoryHelpers.workspace.test.ts`:

```ts
/**
 * Phase 2A.후속 — loadAndVerifyJobPostingOwner workspace member + admin 호환
 */
import { loadAndVerifyJobPostingOwner } from '../ApplicationRepositoryHelpers';
import { supabase } from '@/lib/supabase';
import { PermissionError } from '@/errors';
import type { JobPosting } from '@/types';

jest.mock('@/lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const fakePosting: JobPosting = {
  id: 'jp-1',
  ownerId: 'owner-uid',
  workspaceId: 'ws-1',
  title: '234',
  status: 'active',
} as JobPosting;

describe('loadAndVerifyJobPostingOwner — workspace member + admin', () => {
  let fromSpy: jest.Mock;
  let rpcSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    fromSpy = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: 'jp-1',
              owner_id: 'owner-uid',
              workspace_id: 'ws-1',
              title: '234',
              status: 'active',
              schedule: { kind: 'fixed', dates: ['2026-05-09'] },
              schema_version: 3,
              role_catalog: [],
              compensation: { type: 'daily', amount: 100000 },
              total_positions: 1,
              filled_positions: 0,
              stats: {},
              tags: [],
              role_keys: [],
              created_at: '2026-05-09T00:00:00Z',
              updated_at: '2026-05-09T00:00:00Z',
              work_date: '2026-05-09',
            },
            error: null,
          }),
        }),
      }),
    });
    rpcSpy = jest.fn();
    (mockSupabase.from as any) = fromSpy;
    (mockSupabase.rpc as any) = rpcSpy;
  });

  it('owner 본인 호출 시 통과 (RPC 호출 없음)', async () => {
    const result = await loadAndVerifyJobPostingOwner('jp-1', 'owner-uid', '취소 요청 목록 조회');

    expect(result.id).toBe('jp-1');
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('워크스페이스 멤버 호출 시 통과 (is_workspace_member=true)', async () => {
    rpcSpy.mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    const result = await loadAndVerifyJobPostingOwner('jp-1', 'member-uid', '취소 요청 목록 조회');

    expect(result.id).toBe('jp-1');
    expect(rpcSpy).toHaveBeenCalledWith('is_workspace_member', {
      _workspace_id: 'ws-1',
      _user_id: 'member-uid',
    });
  });

  it('admin 호출 시 통과 (is_workspace_member=false 인데 is_admin=true)', async () => {
    rpcSpy.mockImplementation((fn: string) => {
      if (fn === 'is_workspace_member') return Promise.resolve({ data: false, error: null });
      if (fn === 'is_admin') return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: false, error: null });
    });

    const result = await loadAndVerifyJobPostingOwner('jp-1', 'admin-uid', '취소 요청 목록 조회');

    expect(result.id).toBe('jp-1');
  });

  it('외부인 호출 시 PermissionError', async () => {
    rpcSpy.mockResolvedValue({ data: false, error: null });

    await expect(
      loadAndVerifyJobPostingOwner('jp-1', 'stranger-uid', '취소 요청 목록 조회')
    ).rejects.toThrow(PermissionError);
  });

  it('is_workspace_member RPC 에러 시 handleSupabaseError', async () => {
    rpcSpy.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc error', code: 'PGRST000' },
    });

    await expect(
      loadAndVerifyJobPostingOwner('jp-1', 'member-uid', '취소 요청 목록 조회')
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 → FAIL 확인**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ApplicationRepositoryHelpers.workspace.test.ts --no-coverage
```

기대: 5 케이스 중 외부인 케이스만 PASS (현재 owner-only 코드가 PermissionError 던짐), 나머지 4 FAIL.

- [ ] **Step 3: 헬퍼 구현 확장**

`uniqn-mobile/src/repositories/supabase/ApplicationRepositoryHelpers.ts:156-168` 전체 교체:

```ts
/**
 * 공고를 로드하고 호출자가 관리 권한을 가졌는지 확인.
 *
 * Phase 2A.후속 (2026-05-09) — owner 외에 워크스페이스 멤버 + admin 도 통과.
 * Phase 2A 에서 applications/job_postings RLS 가 workspace_member 분기로 풀렸으나
 * 클라이언트 헬퍼는 owner-only 였던 부분 마이그레이션을 일치시킨다.
 *
 * 호출 비용: 본인 owner 면 RPC 0회, 멤버면 1회, admin 이면 2회. 권한 에러 흐름은
 * cancellation/리뷰 같은 흔하지 않은 employer-side 액션이라 허용 가능.
 */
export async function loadAndVerifyJobPostingOwner(
  jobPostingId: string,
  callerId: string,
  operation: string
): Promise<JobPosting> {
  const jobData = await loadJobPosting(jobPostingId);

  // 1) owner 본인
  if (jobData.ownerId === callerId) return jobData;

  // 2) 워크스페이스 멤버 (Phase 2A backend 와 일관)
  const memberResult = await supabase.rpc('is_workspace_member', {
    _workspace_id: jobData.workspaceId,
    _user_id: callerId,
  });
  if (memberResult.error) {
    handleSupabaseError(memberResult.error, { operation, table: TABLES.JOB_POSTINGS });
  }
  if (memberResult.data === true) return jobData;

  // 3) admin
  const adminResult = await supabase.rpc('is_admin');
  if (adminResult.error) {
    handleSupabaseError(adminResult.error, { operation, table: TABLES.JOB_POSTINGS });
  }
  if (adminResult.data === true) return jobData;

  throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
    userMessage: `워크스페이스 멤버만 관리할 수 있습니다: ${operation}`,
  });
}
```

- [ ] **Step 4: 테스트 실행 → PASS 확인**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ApplicationRepositoryHelpers.workspace.test.ts --no-coverage
```

기대: 5 케이스 모두 PASS.

- [ ] **Step 5: 헬퍼 사용처 회귀 테스트**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__ --no-coverage
```

기대: ApplicationRepository 관련 모든 테스트 PASS. 만약 owner-only 가정으로 작성된 케이스가 깨지면 mock 에 `rpc` 가 false 반환하도록 보강.

- [ ] **Step 6: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

기대: 0 errors.

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/src/repositories/supabase/ApplicationRepositoryHelpers.ts \
        uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepositoryHelpers.workspace.test.ts
git commit -m "feat(workspace): loadAndVerifyJobPostingOwner workspace_member+admin 분기 — Phase 2A.후속"
```

---

### Task 2B: cancellation/리뷰 흐름 회귀 테스트

**Files:** (변경 없음 — 기존 테스트 보강)

- [ ] **Step 1: ApplicationRepository 테스트의 mock supabase 가 새 RPC 호출을 무시하지 않는지 확인**

```bash
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ApplicationRepository --no-coverage
cd uniqn-mobile && npx jest src/repositories/supabase/__tests__/ApplicationRepositoryTransactions --no-coverage
```

기대: PASS. 만약 owner-only 테스트가 새 RPC 흐름으로 깨지면 각 테스트의 supabase mock 에 `rpc: jest.fn().mockResolvedValue({ data: false, error: null })` 추가.

- [ ] **Step 2: 깨진 테스트의 mock 보강**

각 영향받은 테스트 파일에서 supabase mock 패턴을 다음으로 표준화:

```ts
const mockSupabase = {
  from: jest.fn(/* 기존 chain */),
  rpc: jest.fn().mockResolvedValue({ data: false, error: null }),
};
```

owner-only 케이스에서는 `from` 만 사용 → `rpc` 가 호출되지 않으므로 영향 없음. 권한 거부 케이스(callerId !== ownerId)는 이제 `rpc` 호출 시 false 받고 PermissionError 던짐.

- [ ] **Step 3: 전체 jest 실행 → 회귀 없음 확인**

```bash
cd uniqn-mobile && npx jest --no-coverage
```

기대: 전체 PASS. 깨진 테스트 있으면 위 mock 패턴으로 보강 후 재실행.

- [ ] **Step 4: 영향받은 테스트만 따로 commit (Task 2A 와 분리)**

```bash
git add uniqn-mobile/src/repositories/supabase/__tests__/ApplicationRepository*.test.ts
git commit -m "test(workspace): ApplicationRepository 테스트 mock 에 rpc 추가 — Phase 2A.후속"
```

---

### Task 2C: dogfooding 검증 (Phase 2 마무리)

**Files:** (변경 없음 — 검증만)

- [ ] **Step 1: review-admin 으로 review-employer 의 공고 "234" 진입**

브라우저에서 review-admin 로그인 → admin 페이지에서 공고 검색 → 공고 "234" 진입.

- [ ] **Step 2: 취소 요청 검토 시도**

기대: PermissionError 안 뜨고 정상 조회. (admin 분기 통과)

- [ ] **Step 3: review-employer 외 워크스페이스 멤버 계정으로도 동일 시도**

워크스페이스 멤버 추가 후 해당 멤버 로그인 → 공고 "234" 진입 → 취소 요청 검토.

기대: 정상 조회 (workspace_member 분기 통과).

- [ ] **Step 4: 외부인(어떤 워크스페이스에도 속하지 않은 staff)이 직접 URL 진입 시도**

기대: PermissionError "워크스페이스 멤버만 관리할 수 있습니다".

- [ ] **Step 5: 결과 표 작성 — Phase 2 PR 본문**

| 호출자 | Before | After |
|--------|--------|-------|
| owner 본인 | OK | OK ✅ |
| 워크스페이스 멤버 | PermissionError | OK ✅ |
| admin | PermissionError | OK ✅ |
| 외부인 | PermissionError | PermissionError ✅ |

---

## Phase 1+2 PR 통합

- [ ] **Step 1: 전체 type check + jest**

```bash
cd uniqn-mobile && npm run quality && npx jest --no-coverage
```

기대: 모두 PASS.

- [ ] **Step 2: PR 생성**

```bash
git push -u origin <branch-name>
gh pr create --title "fix(workspace): active workspace 별 공고 분리 + cancellation 멤버 호환 — Phase 2A.후속" --body "$(cat <<'EOF'
## Summary
- 사용자 dogfooding(2026-05-09)에서 발견한 3가지 워크스페이스 누출 버그 해결
- `getManagedJobPostings(workspaceId)` 옵션 + `useMyJobPostings` 가 activeWorkspace 의존
- `loadAndVerifyJobPostingOwner` 가 owner OR workspace_member OR admin 분기로 확장 — cancellation/리뷰/거절/읽음/확정/확정취소 6+ 흐름 동시 해결

## Background
Phase 2A backend(applications/job_postings RLS) 가 workspace_member 분기까지 풀었으나 클라이언트 헬퍼는 owner-only → 부분 마이그레이션 상태. 본 PR 이 일치시킴.

## Test plan
- [ ] type-check + jest 전체 PASS
- [ ] dogfooding (Task 1D + 2C 표 첨부)
- [ ] Phase 2A backend 가 영향 없음 확인 (RLS 변경 없음)

## Out of scope
- RLS jp_select 분리 (Task 5 follow-up — 별도 plan + eng-review 필요)
- 다른 화면 audit (Task 6 follow-up)
- write-side `JobPostingRepository.loadAndVerifyOwner` (update/close/reopen/delete) — write-side 도 동일 패턴 적용 필요하지만 본 PR scope 밖

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 5 (Follow-up) — RLS jp_select 분리

> 별도 plan + `/plan-eng-review` 필요. 본 plan 의 Phase 1 클라이언트 필터링은 비즈니스 요구사항(워크스페이스별 분리)이라 영구 보존, 본 task 는 보안 경계 강화(클라이언트 필터에 의존하지 않도록).

**Sketch:**
- 옵션 A: View 분리 — `job_postings_search` (active/approved/closed 공개) vs `job_postings_managed` (owner/member/admin).
- 옵션 B (권장): SECURITY DEFINER RPC `list_managed_postings(p_workspace_id, p_status)` 추가 + jp_select 정책의 첫 분기(`status IN (...)`) 를 별도 search-only 정책으로 분리. PR #69, #70 패턴 일관.
- migration 필요: `apply_migration` MCP, jest 4 역할 테스트.

**진입 조건:** Phase 1+2 머지 후, eng-review 통과한 spec.

---

## Task 6 (Follow-up) — 다른 화면 audit

> 별도 plan. Phase 1+2 머지 후 진행.

**Audit 대상:**

| 영역 | hook | repo 메서드 | 현재 workspace 인지 |
|------|------|-------------|---------------------|
| applications | `useMyApplications`, `useApplicationsByJobPosting` | `ApplicationRepository.getList` 등 | 미점검 |
| work_logs | `useWorkLogsByJobPosting` 등 | `WorkLogRepository` | Phase 3B 완료(backend), client 미점검 |
| event_qr_codes | (해당 hook) | `EventQrRepository` | Phase 3C 완료(backend), client 미점검 |
| settlement | `useSettlements` | `settlementQuery.ts` | 미점검 |
| schedule | `useScheduleCalendar` 등 | `ScheduleRepository` | 미점검 |

각 hook 이 query key 에 `activeWorkspaceId` 포함하는지, repo 가 `workspaceId` 옵션을 받는지 점검. 누락된 곳은 Task 1A~1C 패턴 그대로 복제.

---

## Self-Review Checklist

- [x] Phase 1 (workspace 필터) — Task 1A/1B/1C/1D 로 커버
- [x] Phase 2 (cancellation 멤버 호환) — Task 2A/2B/2C 로 커버
- [x] 모든 step 에 실제 코드 + 명령 + 기대 출력 포함 — placeholder 없음
- [x] 함수 시그니처 일관성: `getManagedJobPostings(status?, workspaceId?)`, `getMyJobPostings(ownerId, options?)`, `loadAndVerifyJobPostingOwner(jobPostingId, callerId, operation)` — Task 1A → 1B → 1C → 2A 순서로 의존성 일치
- [x] `is_workspace_member` 인자 이름 `_workspace_id`, `_user_id` — production DB pg_proc 결과와 일치
- [x] CLAUDE.md 커밋 컨벤션(`<type>(<scope>): <한글>`) 준수
- [x] Phase 3, 4 는 follow-up section 으로 분리 — scope creep 방지
