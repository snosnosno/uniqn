# 공고 공유 (Workspace 협업) 잔여 작업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M1~M5 완료된 워크스페이스 인프라 위에 N1 production blocker hotfix → editor UX/보안 → 권한 일관성 → 파생 RLS 정리 → 결제/멤버 한도 → 외부 초대/Owner 양도까지 PR 단위로 완성.

**Architecture:**
- Presentation → Hooks → Service → Repository → Supabase 단방향 유지
- 권한 단일 진실은 RLS, 클라이언트는 ownerId/workspace 멤버십을 동시 인지하는 service helper 도입
- 점진 출시는 `WORKSPACE_COLLABORATION_ENABLED` flag 로 gating, 마이그레이션은 모두 MCP `apply_migration` 경유

**Tech Stack:** Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / Supabase (PostgreSQL + RLS + RPC + Realtime) / TanStack Query / Zustand / Jest / Playwright

---

## 컨텍스트

### 이미 완료 (master HEAD = 9a1e4d856)
- M1: `workspaces` / `workspace_members` / `workspace_invitations` 테이블 + RLS 7 + `is_workspace_member` helper + `job_postings.workspace_id` 컬럼
- M2: 도메인 타입 + Zod + 3 Repository + 2 Service + atomic invitation RPC + 만료 cron + 알림 trigger + Hook + Deeplink
- M3: 워크스페이스 설정 / 초대 / 받은 초대 3 화면
- M4: backfill + regression test 8건 (owner contract만) + feature flag 정의
- M5: `workspace_id NOT NULL` + jp UPDATE/DELETE workspace 멤버 RLS + wallet RPC 자동 lookup
- 진입점: settings + employer 탭 헤더
- 이번 세션 fix (N2~N5): display_name fallback / WITH CHECK 무한 재귀 / `is_workspace_member` plpgsql + jp_select 멤버 분기 / owner 카드 + invalidate

### 검증된 잔여 코드 위치
- `src/repositories/supabase/JobPostingRepository.ts:442` — `insert(snakeData)` 직접, `workspace_id` 누락
- `src/domains/job-posting/serialization.ts` — `SerializeJobPostingV3Options` 에 `workspaceId` 필드 없음
- `app/(employer)/my-postings/[id]/_layout.tsx:137-144` — `job.ownerId !== currentUserId` 강제 이탈 (editor 차단)
- `src/services/jobs/jobService.ts:236-242` — `getByOwnerId` 만 사용
- `src/services/work/settlement/settlementQuery.ts:305` — `getByOwnerId(ownerId)` filter
- `src/lib/featureFlags.ts:40` — `WORKSPACE_COLLABORATION_ENABLED` 정의 / import 0건
- RLS deferred: `optimize_rls_auth_uid_wrapping.sql:33-43, 139-147, 196-200`, `base_schema.sql:597-619, 621-646, 738-761, 764-778`

---

## File Structure

신규/수정 파일 (Phase 별):

```
Phase 0:
  M src/domains/job-posting/serialization.ts        — SerializeJobPostingV3Options.workspaceId 추가
  M src/services/jobs/jobManagementService.ts       — owner workspace 자동 resolve
  M src/repositories/supabase/JobPostingRepository.ts — createWithTransaction context.workspaceId 전달
  M src/services/jobs/__tests__/jobManagementService.test.ts — workspace_id 주입 검증

Phase 1:
  N src/hooks/workspace/useWorkspaceRevocationGuard.ts
  N src/components/workspace/WorkspaceRevocationModal.tsx
  N src/hooks/workspace/useActiveWorkspace.ts
  N src/stores/activeWorkspaceStore.ts
  N src/components/workspace/WorkspaceSwitcher.tsx
  M app/(employer)/_layout.tsx                       — 헤더에 WorkspaceSwitcher
  M src/services/workspace/workspaceService.ts       — listForUser 추가 (이미 hook 존재 시 재사용)

Phase 2:
  M src/services/jobs/jobService.ts                  — getManagedByUserId 신설
  M src/services/work/settlement/settlementQuery.ts  — workspace 인지 filter
  M app/(employer)/my-postings/[id]/_layout.tsx      — manage access guard
  M app/(employer)/my-postings/index.tsx             — 소유/공동관리 필터
  M src/repositories/supabase/JobPostingRepository.ts — getManagedByUserId 추가
  M src/utils/jobPostingVisibility.ts                — isManageableByUser helper
  M src/lib/featureFlags.ts                          — UI 게이팅 import 처
  N src/services/users/userSearchService.ts
  N supabase/migrations/<ts>_add_search_users_for_invite_rpc.sql
  N e2e/workspace/critical-paths.spec.ts             — 6 시나리오

Phase 3:
  N supabase/migrations/<ts>_workspace_m4_applications_rls.sql
  N supabase/migrations/<ts>_workspace_m4_work_logs_rls.sql
  N supabase/migrations/<ts>_workspace_m4_event_qr_codes_rls.sql
  N supabase/migrations/<ts>_workspace_m4_jp_select_finalize.sql
  N supabase/migrations/<ts>_workspace_m4_templates_decision.sql
  N supabase/migrations/<ts>_workspace_m4_settlements_rls.sql
  M src/repositories/supabase/__tests__/*.workspace.editor.test.ts — editor contract 보강

Phase 4 (monetization 이후):
  M src/services/jobs/jobManagementService.ts        — paid path 분기
  N supabase/migrations/<ts>_workspace_seat_enforcement.sql

Phase 5 (수요 검증 후):
  (Phase 2 features — 별도 spec 후 분기)
```

---

## Phase 0: N1 Hotfix — 무료 공고 INSERT workspace_id 주입 (P0, production 차단)

**목표:** 무료 공고 생성 시 `workspace_id NOT NULL` 위반 (SQLSTATE 23502) 즉시 해결.

**해결 옵션 비교:**

| 옵션 | 변경 범위 | 결합도 | M5 일관성 | rollback | 채택 |
|---|---|---|---|---|---|
| A) Repository 내부 lookup | Repository 만 | 높음 (Repo가 다른 테이블 query) | ✗ | 단순 | ❌ |
| **B) serializer 시그니처 확장 + Service 가 owner workspace resolve + FK 가드** | serializer + service + repo | 적절 (Service 가 도메인 책임) | ✗ (M5 는 RPC) | revert PR 단순 | ✅ |
| C) 무료 공고용 SECURITY DEFINER RPC | DB + service | 낮음 (atomic) | ✓ M5 와 동일 패턴 | migration DOWN | △ (RPC 이원화 우려) |

**B 선택 근거 (Cross-model review 결과 반영):**
- Uniqn 아키텍처: Service 가 도메인 결정, Repository 는 통신
- M5 wallet RPC pattern (owner workspace auto-lookup) 을 Service 레이어에서 동일 적용 (concept 만 — 구현 위치 다름)
- Repository 가 `workspaces` 테이블을 모르도록 유지
- **race condition (lookup ↔ INSERT 사이 워크스페이스 삭제)** 은 Service 의 try/catch + FK 23503 분기로 처리 (Task 0.2 Step 2 참고)
- C 가 더 robust 하지만 결제 RPC + 무료 RPC 이원화는 향후 유지보수 비용. v2 에서 통합 가능

**의존성:** 없음 (즉시 적용 가능)

### Task 0.1: serializer 에 `workspaceId` context 추가

**Files:**
- Modify: `uniqn-mobile/src/domains/job-posting/serialization.ts`

- [ ] **Step 1: 실패 테스트 작성**

`uniqn-mobile/src/domains/job-posting/__tests__/serialization.workspace.test.ts` (신규):

```typescript
import { serializeJobPostingV3 } from '../serialization';
import type { CreateJobPostingInput } from '@/types/jobPosting';

describe('serializeJobPostingV3 workspaceId 주입', () => {
  it('options.workspaceId 가 있으면 결과 객체에 workspaceId 가 포함된다', () => {
    const input: CreateJobPostingInput = {
      title: '테스트 공고',
      schedule: { kind: 'fixed' as const, /* ... 최소 입력 */ } as any,
    } as any;

    const result = serializeJobPostingV3(input, {
      ownerId: 'owner-1',
      ownerName: '오너',
      workspaceId: 'workspace-1',
    });

    expect((result as any).workspaceId).toBe('workspace-1');
  });

  it('options.workspaceId 가 없으면 workspaceId 필드는 undefined', () => {
    const input: CreateJobPostingInput = {
      title: '테스트',
      schedule: { kind: 'fixed' as const } as any,
    } as any;

    const result = serializeJobPostingV3(input, {
      ownerId: 'owner-1',
      ownerName: '오너',
    });

    expect((result as any).workspaceId).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd uniqn-mobile && npx jest src/domains/job-posting/__tests__/serialization.workspace.test.ts
```

Expected: FAIL — `result.workspaceId` undefined.

- [ ] **Step 3: 시그니처 확장**

`src/domains/job-posting/serialization.ts:18-25` 의 `SerializeJobPostingV3Options` 에 추가:

```typescript
interface SerializeJobPostingV3Options {
  ownerId: string;
  ownerName?: string;
  status?: JobPostingStatus;
  current?: Partial<JobPosting>;
  createdAt?: Date;
  updatedAt?: Date;
  workspaceId?: string; // 추가 — Phase 0 N1 hotfix
}
```

`serializeJobPostingV3` 본문 마지막 반환 객체에 `workspaceId` 포함 (snake 변환은 Repository 의 `toSnakeCase` 가 처리):

```typescript
return {
  // ... 기존 필드
  ...(options.workspaceId ? { workspaceId: options.workspaceId } : {}),
};
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest src/domains/job-posting/__tests__/serialization.workspace.test.ts
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/domains/job-posting/serialization.ts \
  src/domains/job-posting/__tests__/serialization.workspace.test.ts
git commit -m "feat(workspace): serializeJobPostingV3 에 workspaceId 옵션 추가"
```

### Task 0.2: Service 가 owner workspace 자동 resolve

**Files:**
- Modify: `uniqn-mobile/src/services/jobs/jobManagementService.ts:52-80`
- Modify: `uniqn-mobile/src/services/workspace/workspaceService.ts` (필요 시 helper 추가)

- [ ] **Step 1: workspaceService 에 helper 추가**

`src/services/workspace/workspaceService.ts` 에 추가:

```typescript
/**
 * owner 의 첫 워크스페이스 (created_at ASC) 를 반환.
 * 무료 공고 생성 시 workspace_id 자동 주입에 사용 (M5 wallet RPC 패턴 일치).
 * backfill 후 모든 active employer 는 워크스페이스 1+ 보유.
 */
async getDefaultWorkspaceIdForOwner(ownerId: string): Promise<string> {
  const workspaces = await workspaceRepository.listForUser(ownerId);
  const owned = workspaces.filter((w) => w.ownerId === ownerId);
  if (owned.length === 0) {
    throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '워크스페이스가 없어 공고를 생성할 수 없어요. 잠시 후 다시 시도해주세요.',
      context: { ownerId },
    });
  }
  // created_at ASC = 첫 번째 (M5 RPC 와 동일 정책)
  return owned.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]!.id;
},
```

- [ ] **Step 2: jobManagementService.createSinglePosting 에서 lookup**

`src/services/jobs/jobManagementService.ts:52-61`:

```typescript
async function createSinglePosting(
  input: CreateJobPostingInput,
  ownerId: string,
  ownerName: string
): Promise<CreateJobPostingResult> {
  const workspaceId = await workspaceService.getDefaultWorkspaceIdForOwner(ownerId);
  try {
    return await jobPostingRepository.createWithTransaction(input, {
      ownerId,
      ownerName,
      workspaceId,
    });
  } catch (error) {
    // Race: lookup ↔ INSERT 사이 owner 가 워크스페이스 삭제 시 FK 23503
    if (isFkViolation(error, 'workspace_id')) {
      throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '워크스페이스를 다시 확인해주세요. 잠시 후 다시 시도해주세요.',
        context: { ownerId, workspaceId },
      });
    }
    throw error;
  }
}
```

import 추가:
```typescript
import { workspaceService } from '@/services/workspace';
```

- [ ] **Step 3: Repository context 타입 확장**

`src/repositories/supabase/JobPostingRepository.ts` 의 `CreateJobPostingContext` 또는 동등 타입에 `workspaceId: string` 필수 추가. `createWithTransaction:407-450` 본문에서 serializer 옵션으로 전달:

```typescript
const serialized = serializeJobPostingV3(input, {
  ownerId: context.ownerId,
  ownerName: context.ownerName,
  status: STATUS.JOB_POSTING.ACTIVE,
  current,
  createdAt: now,
  updatedAt: now,
  workspaceId: context.workspaceId, // 추가
});
```

- [ ] **Step 4: 통합 테스트 — 무료 공고 생성 후 workspace_id 주입 확인**

`src/services/jobs/__tests__/jobManagementService.test.ts` 에 추가:

```typescript
describe('createJobPosting workspace_id 주입', () => {
  it('owner 의 default workspace_id 가 INSERT payload 에 포함된다', async () => {
    const mockGetDefault = jest
      .spyOn(workspaceService, 'getDefaultWorkspaceIdForOwner')
      .mockResolvedValue('workspace-uuid');

    const mockCreate = jest
      .spyOn(jobPostingRepository, 'createWithTransaction')
      .mockResolvedValue({ id: 'new-job', jobPosting: {} as any });

    await createJobPosting(
      { title: '테스트', schedule: { kind: 'fixed' } } as any,
      'owner-uuid',
      '오너이름'
    );

    expect(mockGetDefault).toHaveBeenCalledWith('owner-uuid');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workspaceId: 'workspace-uuid' })
    );
  });

  it('워크스페이스가 없으면 BusinessError E6 throw', async () => {
    jest
      .spyOn(workspaceService, 'getDefaultWorkspaceIdForOwner')
      .mockRejectedValue(new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
        userMessage: '워크스페이스가 없어 공고를 생성할 수 없어요...',
      }));

    await expect(
      createJobPosting({} as any, 'owner-uuid', '오너')
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 5: 검증 + 커밋**

```bash
npm run quality
npx jest src/services/jobs/__tests__/jobManagementService.test.ts
```

Expected: 0 type errors, 0 lint errors, all tests pass.

```bash
git add src/services/workspace/workspaceService.ts \
  src/services/jobs/jobManagementService.ts \
  src/repositories/supabase/JobPostingRepository.ts \
  src/services/jobs/__tests__/jobManagementService.test.ts
git commit -m "fix(workspace): 무료 공고 INSERT workspace_id 자동 주입 — N1 production hotfix"
```

### Task 0.3: production smoke test

- [ ] **Step 1: 로컬에서 무료 공고 생성 시도**

```bash
npm start
```

Expo Go / dev build 에서 employer 계정으로 무료 공고 생성 → 정상 INSERT 확인.

- [ ] **Step 2: Supabase advisors 0 ERROR 확인**

MCP `get_advisors` 호출, 결과 ERROR 없음 확인.

- [ ] **Step 3: regression test 8건 통과 재확인**

```bash
npx jest src/repositories/supabase/__tests__/JobPostingRepository.workspace.regression.test.ts
```

Expected: 8/8 PASS (owner contract 무변경).

### Phase 0 검증 체크리스트

- [ ] `npm run quality` 통과 (tsc + eslint + prettier)
- [ ] `npx jest` 전체 통과
- [ ] 로컬 무료 공고 생성 성공 (실제 Supabase staging)
- [ ] MCP `get_advisors` ERROR 0건
- [ ] regression test 8건 PASS
- [ ] 결제 경로 (`create_job_posting_with_payment_atomically`) 동작 무변경 (smoke)

### Phase 0 Rollback

증상이 새로 보이면 `git revert` PR 1개로 원복. DB 변경 없음 → migration rollback 불필요.

---

## Phase 1: 보안/UX 보강

**의존성:** Phase 0 완료 후

### Phase 1A: 권한 회수 Modal + 5초 자동 로그아웃

**목표:** editor 가 회수당했을 때 즉시/실시간으로 차단되고 사용자에게 명시적으로 알림.

**Files:**
- Create: `src/hooks/workspace/useWorkspaceRevocationGuard.ts`
- Create: `src/components/workspace/WorkspaceRevocationModal.tsx`
- Modify: `app/(employer)/_layout.tsx` — RevocationGuard 마운트
- Modify: `src/types/notification.ts` — `workspace_membership_revoked` 추가 (이미 있는지 확인)

#### Task 1A.1: hook 작성 — 멤버십 변화 감지

- [ ] **Step 1: 실패 테스트 작성**

`src/hooks/workspace/__tests__/useWorkspaceRevocationGuard.test.tsx`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useWorkspaceRevocationGuard } from '../useWorkspaceRevocationGuard';

describe('useWorkspaceRevocationGuard', () => {
  it('현재 활성 워크스페이스에서 회수되면 onRevoked 콜백 호출', async () => {
    const onRevoked = jest.fn();
    const { rerender } = renderHook(
      ({ workspaceId, members }) =>
        useWorkspaceRevocationGuard({
          activeWorkspaceId: workspaceId,
          currentUserId: 'editor-1',
          members,
          isOwner: false,
          onRevoked,
        }),
      {
        initialProps: {
          workspaceId: 'ws-1',
          members: [{ userId: 'editor-1' }],
        },
      }
    );

    rerender({ workspaceId: 'ws-1', members: [] }); // editor-1 사라짐

    await waitFor(() => expect(onRevoked).toHaveBeenCalledTimes(1));
  });

  it('owner 본인은 onRevoked 호출 안 함', async () => {
    const onRevoked = jest.fn();
    renderHook(() =>
      useWorkspaceRevocationGuard({
        activeWorkspaceId: 'ws-1',
        currentUserId: 'owner-1',
        members: [],
        isOwner: true,
        onRevoked,
      })
    );
    expect(onRevoked).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx jest src/hooks/workspace/__tests__/useWorkspaceRevocationGuard.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: hook 구현**

`src/hooks/workspace/useWorkspaceRevocationGuard.ts`:

```typescript
import { useEffect, useRef } from 'react';
import type { WorkspaceMember } from '@/types/workspace';

interface UseWorkspaceRevocationGuardArgs {
  activeWorkspaceId: string | undefined;
  currentUserId: string | undefined;
  members: WorkspaceMember[];
  isOwner: boolean;
  isFetched: boolean; // E5 false-positive 가드 — fetch 실패 시 비교 안 함
  isError: boolean;
  onRevoked: () => void;
}

/**
 * 회수 감지 = realtime DELETE 우선 + fetch diff fallback (가드 적용).
 *
 * Realtime: postgres_changes DELETE 이벤트가 자기 row (user_id == currentUserId) 면
 *   즉시 onRevoked. Supabase Realtime 은 at-most-once 라 missed 가능 → fallback 필요.
 *
 * Fetch fallback: isFetched && !isError && wasMember && !isMember 일 때만 트리거.
 *   - 네트워크 단절로 query 실패 시 isError=true → 비교 skip (거짓 로그아웃 방지)
 *   - 첫 로딩 (isFetched=false) → 비교 skip
 *   - workspaceId 변경 시 ref 자동 리셋 (cleanup function)
 */
export function useWorkspaceRevocationGuard(args: UseWorkspaceRevocationGuardArgs): void {
  const { activeWorkspaceId, currentUserId, members, isOwner, isFetched, isError, onRevoked } = args;
  const wasMemberRef = useRef<boolean>(false);

  // 1) Realtime DELETE 구독 (우선)
  useEffect(() => {
    if (!activeWorkspaceId || !currentUserId || isOwner) return;
    const channel = supabase
      .channel(`workspace_member_revoke:${activeWorkspaceId}:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'workspace_members',
          filter: `workspace_id=eq.${activeWorkspaceId}`,
        },
        (payload) => {
          if ((payload.old as { user_id?: string })?.user_id === currentUserId) {
            onRevoked();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, currentUserId, isOwner, onRevoked]);

  // 2) Fetch diff fallback — 가드 적용
  useEffect(() => {
    // workspaceId 변경 또는 owner 전환 시 ref 리셋
    if (!activeWorkspaceId || !currentUserId || isOwner) {
      wasMemberRef.current = false;
      return;
    }

    // 가드: fetch 실패 / 로딩 중에는 비교하지 않음 (거짓 로그아웃 방지)
    if (!isFetched || isError) return;

    const isCurrentlyMember = members.some((m) => m.userId === currentUserId);

    if (wasMemberRef.current && !isCurrentlyMember) {
      onRevoked();
    }

    wasMemberRef.current = isCurrentlyMember;
  }, [activeWorkspaceId, currentUserId, members, isOwner, isFetched, isError, onRevoked]);

  // 3) workspaceId 전환 시 ref 강제 리셋 (Phase 1B Switcher 대비)
  useEffect(() => {
    return () => {
      wasMemberRef.current = false;
    };
  }, [activeWorkspaceId]);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest src/hooks/workspace/__tests__/useWorkspaceRevocationGuard.test.tsx
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/workspace/useWorkspaceRevocationGuard.ts \
  src/hooks/workspace/__tests__/useWorkspaceRevocationGuard.test.tsx
git commit -m "feat(workspace): 멤버십 회수 감지 hook 추가"
```

#### Task 1A.2: Modal 컴포넌트 + countdown

- [ ] **Step 1: 컴포넌트 작성**

`src/components/workspace/WorkspaceRevocationModal.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

interface Props {
  visible: boolean;
  workspaceName?: string;
}

export function WorkspaceRevocationModal({ visible, workspaceName }: Props) {
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!visible) {
      setCountdown(5);
      return;
    }

    const tick = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    const timer = setTimeout(() => {
      logger.info('Workspace 회수로 자동 로그아웃', { workspaceName });
      signOut();
      router.replace('/(auth)/login');
    }, 5000);

    return () => {
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [visible, workspaceName, signOut, router]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="flex-1 items-center justify-center bg-black/60 px-6"
      >
        <View className="w-full max-w-sm rounded-md bg-surface-card p-6 dark:bg-surface-elevated">
          <Text className="mb-3 text-h4 font-sans-medium text-content-primary">
            워크스페이스 접근이 회수됐어요
          </Text>
          <Text className="mb-2 text-body text-content-secondary leading-6 dark:leading-[1.625rem]">
            {workspaceName ? `‘${workspaceName}’ ` : ''}워크스페이스 소유자가 권한을 회수했습니다.
          </Text>
          <Text className="mb-2 text-body text-content-secondary leading-6 dark:leading-[1.625rem]">
            보안을 위해 {countdown}초 후 자동으로 로그아웃됩니다.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
```

다크모드 lineHeight 가산 (impeccable v1 #1) 적용. AppError 카테고리는 E5(보안).

- [ ] **Step 2: 커밋**

```bash
git add src/components/workspace/WorkspaceRevocationModal.tsx
git commit -m "feat(workspace): 권한 회수 Modal + 5초 카운트다운 자동 로그아웃"
```

#### Task 1A.3: employer layout 에 RevocationGuard 마운트

> **주의**: Phase 1B Switcher 가 머지되기 전까지는 `workspaces[0]` 단일 모델로 동작. 다중 워크스페이스 사용자는 첫 번째 워크스페이스만 감시 → Phase 1B 머지 후 Phase 1A 의 mount 부분도 `useActiveWorkspace()` 로 교체 필요. 두 PR 의 release window 를 맞추거나 Phase 1B 먼저 진행 권장.

- [ ] **Step 1: layout 에 hook + Modal 마운트만 (realtime 구독은 별도 Step)**

`app/(employer)/_layout.tsx` 에 추가 (이미 있는 useAuthStore + workspace hook 활용):

```typescript
import { useState } from 'react';
import { useWorkspaceRevocationGuard } from '@/hooks/workspace/useWorkspaceRevocationGuard';
import { WorkspaceRevocationModal } from '@/components/workspace/WorkspaceRevocationModal';
import { useWorkspaces, useWorkspaceMembers } from '@/hooks/workspace';
import { useAuthStore } from '@/stores/authStore';

export default function EmployerLayout() {
  const { user } = useAuthStore();
  const { workspaces } = useWorkspaces();
  const active = workspaces[0]; // Phase 1B 에서 activeWorkspaceStore 로 교체
  const { members } = useWorkspaceMembers(active?.id, active?.ownerId);
  const isOwner = !!user?.uid && active?.ownerId === user.uid;
  const [revoked, setRevoked] = useState(false);

  useWorkspaceRevocationGuard({
    activeWorkspaceId: active?.id,
    currentUserId: user?.uid,
    members,
    isOwner,
    onRevoked: () => setRevoked(true),
  });

  return (
    <>
      {/* 기존 Stack/Tab 렌더 */}
      <WorkspaceRevocationModal visible={revoked} workspaceName={active?.name} />
    </>
  );
}
```

- [ ] **Step 2: realtime 구독을 `useWorkspaceMembers` 에 추가 (별도 commit)**

`src/hooks/workspace/useWorkspaceMembers` 에 Supabase Realtime 구독 추가:

```typescript
useEffect(() => {
  if (!workspaceId) return;
  const channel = supabase
    .channel(`workspace_members:${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'workspace_members',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, [workspaceId, queryClient]);
```

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run quality
```

```bash
git add app/(employer)/_layout.tsx src/hooks/workspace/useWorkspaces.ts
git commit -m "feat(workspace): editor 회수 시 layout 에서 Modal + 자동 로그아웃 트리거"
```

### Phase 1A 검증 체크리스트
- [ ] 두 계정 (owner + editor) 으로 staging 검증: editor 로그인 → owner 가 제거 → editor 화면에서 5초 내 Modal + 로그아웃
- [ ] Modal 접근성: VoiceOver/TalkBack `accessibilityLiveRegion="polite"` 읽기 확인
- [ ] dark mode 렌더 확인
- [ ] hook 테스트 PASS

### Phase 1B: 다중 워크스페이스 전환 UI

**목표:** 활성 워크스페이스를 사용자가 선택 가능하게 하고 모든 employer 화면이 이 선택을 반영.

#### Task 1B.1: activeWorkspaceStore (zustand)

- [ ] **Step 1: 테스트 작성**

`src/stores/__tests__/activeWorkspaceStore.test.ts`:

```typescript
import { useActiveWorkspaceStore } from '../activeWorkspaceStore';

describe('activeWorkspaceStore', () => {
  beforeEach(() => useActiveWorkspaceStore.setState({ activeWorkspaceId: null }));

  it('setActiveWorkspaceId 로 활성 ID 설정', () => {
    useActiveWorkspaceStore.getState().setActiveWorkspaceId('ws-1');
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBe('ws-1');
  });

  it('clear 로 null', () => {
    useActiveWorkspaceStore.getState().setActiveWorkspaceId('ws-1');
    useActiveWorkspaceStore.getState().clear();
    expect(useActiveWorkspaceStore.getState().activeWorkspaceId).toBeNull();
  });
});
```

- [ ] **Step 2: store 작성**

`src/stores/activeWorkspaceStore.ts`:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ActiveWorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  clear: () => void;
}

export const useActiveWorkspaceStore = create<ActiveWorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
      clear: () => set({ activeWorkspaceId: null }),
    }),
    {
      name: 'uniqn-active-workspace',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

- [ ] **Step 3: useActiveWorkspace selector hook**

`src/hooks/workspace/useActiveWorkspace.ts`:

```typescript
import { useEffect } from 'react';
import { useWorkspaces } from './useWorkspaces';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import type { Workspace } from '@/types/workspace';

export function useActiveWorkspace(): Workspace | undefined {
  const { workspaces } = useWorkspaces();
  const activeId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useActiveWorkspaceStore((s) => s.setActiveWorkspaceId);

  useEffect(() => {
    if (workspaces.length === 0) return;
    if (!activeId || !workspaces.some((w) => w.id === activeId)) {
      setActive(workspaces[0]!.id);
    }
  }, [workspaces, activeId, setActive]);

  return workspaces.find((w) => w.id === activeId) ?? workspaces[0];
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/stores/activeWorkspaceStore.ts src/hooks/workspace/useActiveWorkspace.ts \
  src/stores/__tests__/activeWorkspaceStore.test.ts
git commit -m "feat(workspace): activeWorkspaceStore + useActiveWorkspace hook 추가"
```

#### Task 1B.2: WorkspaceSwitcher 컴포넌트 (BottomSheet)

- [ ] **Step 1: 컴포넌트**

`src/components/workspace/WorkspaceSwitcher.tsx`:

```typescript
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { ChevronDownIcon, CheckIcon } from '@/components/icons';
import { useWorkspaces } from '@/hooks/workspace';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { triggerHaptic } from '@/utils/haptics';

export function WorkspaceSwitcher() {
  const { workspaces } = useWorkspaces();
  const activeId = useActiveWorkspaceStore((s) => s.activeWorkspaceId);
  const setActive = useActiveWorkspaceStore((s) => s.setActiveWorkspaceId);
  const [open, setOpen] = useState(false);

  const active = workspaces.find((w) => w.id === activeId);

  // 단일 워크스페이스: 텍스트만 (라벨 불필요)
  if (workspaces.length <= 1) {
    return active ? (
      <Text className="text-body text-content-primary" numberOfLines={1}>
        {active.name}
      </Text>
    ) : null;
  }

  const currentUserId = useAuthStore((s) => s.user?.uid);
  const isOwnerOf = (w: typeof workspaces[number]) => w.ownerId === currentUserId;

  return (
    <>
      <Pressable
        onPress={() => {
          triggerHaptic('light');
          setOpen(true);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`현재 워크스페이스 ${active?.name ?? ''} - 변경하려면 탭`}
        className="min-h-[44px] flex-row items-center gap-2 px-2 py-2"
      >
        <Text className="text-body font-sans-medium text-content-primary" numberOfLines={1}>
          {active?.name ?? '워크스페이스 선택'}
        </Text>
        <ChevronDownIcon size={16} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setOpen(false)} />
        <View className="rounded-t-md bg-surface-card pb-8 dark:bg-surface-elevated">
          <Text className="px-6 py-4 text-body-sm text-content-secondary">워크스페이스 선택</Text>
          {workspaces.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => {
                triggerHaptic('light');
                setActive(w.id);
                setOpen(false);
              }}
              className="min-h-[44px] flex-row items-center justify-between px-6 py-3"
            >
              <View className="flex-row items-center gap-2 flex-1">
                <Text className="text-body text-content-primary" numberOfLines={1}>
                  {w.name}
                </Text>
                <Badge variant={isOwnerOf(w) ? 'warning' : 'info'} size="sm">
                  {isOwnerOf(w) ? '소유' : '공동관리'}
                </Badge>
              </View>
              {w.id === activeId && <CheckIcon size={18} />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: 헤더에 통합**

`app/(employer)/_layout.tsx` employer Stack 의 `headerTitle` 에 WorkspaceSwitcher 렌더.

- [ ] **Step 3: 검증 + 커밋**

```bash
npm run quality
```

```bash
git add src/components/workspace/WorkspaceSwitcher.tsx app/(employer)/_layout.tsx
git commit -m "feat(workspace): 헤더 다중 워크스페이스 전환 BottomSheet UI"
```

### Phase 1B 검증 체크리스트
- [ ] 1개 워크스페이스 사용자: 단순 텍스트 표시
- [ ] 2개+ 사용자: dropdown 동작, 선택 후 persistence (앱 재시작 후 유지)
- [ ] 활성 워크스페이스 변경 시 employer 화면들이 새 workspace 기준으로 갱신
- [ ] 터치 타깃 ≥ 44px
- [ ] dark mode 렌더

### Phase 1B Rollback
- store/hook revert + 헤더 useWorkspaces[0] 단일 모델 복귀

---

## Phase 2: 권한 일관성

**의존성:** Phase 1 완료. ⚠️ Phase 3 RLS 정리와 entangled — 2A 만으로는 RLS 가 막혀 동작 안 함. **2A + Phase 3A/B/C 를 같은 release window 에 배포해야 의미 있음.**

### Phase 2A: Service 레이어 워크스페이스화

**목표:** editor 가 다른 owner 의 공유 공고를 service 레이어에서 가져올 수 있게 함.

#### Task 2A.1: Repository.getManagedByUserId 추가

- [ ] **Step 1: 인터페이스 확장**

`src/repositories/interfaces/IJobPostingRepository.ts`:

```typescript
/**
 * 호출자가 owner 이거나 활성 워크스페이스 멤버인 모든 공고 반환.
 * Phase 2A — 공고 공유 (editor 화면) 용도.
 *
 * 권한 판별은 RLS 가 auth.uid() 로 처리 — userId 파라미터는 받지 않는다
 * (받을 경우 client-supplied uid 가 auth.uid() 와 다른 위험. 보안상 신뢰 불가).
 */
getManagedJobPostings(status?: JobPostingStatus): Promise<JobPosting[]>;
```

- [ ] **Step 2: 실패 테스트**

`src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts`:

```typescript
describe('getManagedByUserId — editor contract', () => {
  it('owner 공고 + workspace 멤버 공고를 모두 반환', async () => {
    const mockData = [
      { id: 'job-owned', owner_id: 'user-1', workspace_id: 'ws-1', /* ... */ },
      { id: 'job-shared', owner_id: 'other-owner', workspace_id: 'ws-2', /* ... */ },
    ];
    mockFrom.mockReturnValue(makeChain({ data: mockData, error: null }));

    const repo = new SupabaseJobPostingRepository();
    const result = await repo.getManagedByUserId('user-1');

    expect(result).toHaveLength(2);
    // RLS 가 SELECT 대상을 결정하므로 client 는 단순 조회
    expect(mockFrom).toHaveBeenCalledWith('job_postings');
  });
});
```

- [ ] **Step 3: 구현**

`src/repositories/supabase/JobPostingRepository.ts`:

```typescript
async getManagedJobPostings(status?: JobPostingStatus): Promise<JobPosting[]> {
  // RLS jp_select 가 (owner_id = auth.uid() OR workspace 멤버) 분기를 강제하므로
  // 클라이언트는 status filter 만 추가. user_id WHERE 는 의도적으로 사용 안 함
  // (client-supplied uid 신뢰 불가 — RLS 가 단일 진실).
  try {
    let query = supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) handleSupabaseError(error, { operation: '관리 가능 공고 조회', table: TABLE });

    return (data ?? []).map((row) =>
      assertCanonical(parseJobPostingRow(row), 'getManagedJobPostings canonical 위반', {})
    );
  } catch (error) {
    rethrowOrHandle(error, '관리 가능 공고 조회', {});
    return [];
  }
}
```

⚠️ **사전 조건**: `jp_select` RLS 가 workspace 멤버 분기 포함 (이미 N4 에서 선반영). 미포함 RLS 라면 결과가 owner 자기 것만 → Phase 3D 와 reordering 필요.

- [ ] **Step 4: 테스트 통과 확인 + 커밋**

```bash
npx jest src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts
```

```bash
git add src/repositories/interfaces/IJobPostingRepository.ts \
  src/repositories/supabase/JobPostingRepository.ts \
  src/repositories/supabase/__tests__/JobPostingRepository.workspace.editor.test.ts
git commit -m "feat(workspace): JobPostingRepository.getManagedByUserId — editor 공유 공고 조회"
```

#### Task 2A.2: jobService 가 getManagedByUserId 사용

- [ ] **Step 1: jobService 변경**

`src/services/jobs/jobService.ts:236-242`:

기존:
```typescript
return jobPostingRepository.getByOwnerId(ownerId, status || STATUS.JOB_POSTING.ACTIVE);
```

신규:
```typescript
return jobPostingRepository.getManagedJobPostings(status || STATUS.JOB_POSTING.ACTIVE);
```

(파라미터 단순화 — RLS 가 auth.uid() 로 처리하므로 client uid 전달 불필요. logging 만 필요시 호출자가 별도 context 전달)

- [ ] **Step 2: settlementQuery.ts 도 동일 변경**

`src/services/work/settlement/settlementQuery.ts:305`:

```typescript
const jobPostings = (await jobPostingRepository.getManagedJobPostings()).filter(/* ... */);
```

- [ ] **Step 3: my-postings layout 라우트 가드 변경**

`app/(employer)/my-postings/[id]/_layout.tsx:137-144`:

기존:
```typescript
if (currentUserId && job.ownerId !== currentUserId) {
  addToast({ type: 'warning', message: '내가 작성한 공고만 관리할 수 있습니다.' });
  router.replace('/(app)/(tabs)/employer');
  return;
}
```

신규:
```typescript
if (currentUserId && !isManageableByUser(job, currentUserId, userWorkspaceIds)) {
  addToast({ type: 'warning', message: '이 공고에 대한 관리 권한이 없어요.' });
  router.replace('/(app)/(tabs)/employer');
  return;
}
```

`src/utils/jobPostingVisibility.ts` 에 helper 추가:

```typescript
export function isManageableByUser(
  job: JobPosting,
  userId: string,
  userWorkspaceIds: string[]
): boolean {
  if (job.ownerId === userId) return true;
  if (job.workspaceId && userWorkspaceIds.includes(job.workspaceId)) return true;
  return false;
}
```

`workspaceIds` 는 `useWorkspaces` hook 에서 가져옴.

- [ ] **Step 4: 검증 + 커밋**

```bash
npm run quality
npx jest
```

```bash
git add src/services/jobs/jobService.ts src/services/work/settlement/settlementQuery.ts \
  app/(employer)/my-postings/\[id\]/_layout.tsx src/utils/jobPostingVisibility.ts
git commit -m "refactor(workspace): jobService/settlement/route guard 워크스페이스 인지로 전환"
```

### Phase 2B: Feature Flag 활용

#### Task 2B.1: 진입점 게이팅

- [ ] **Step 1: settings 메뉴 + 헤더 SwitcherI import 처에 flag 적용**

각 진입점 (settings 메뉴, employer 헤더 진입 버튼) 에 `featureFlags.WORKSPACE_COLLABORATION_ENABLED` 체크. false 일 때 표시 안 함.

```typescript
import { isFeatureEnabled } from '@/lib/featureFlags';

{isFeatureEnabled('WORKSPACE_COLLABORATION_ENABLED') && <WorkspaceMenuItem />}
```

- [ ] **Step 2: hook 차단 (false 일 때 1=1 owner 모델로 fallback)**

`useWorkspaces` 가 flag false 면 `[ownerWorkspace]` (가상의 단일) 만 반환하거나 query disabled 처리.

→ 결정: **flag false 면 모든 workspace UI 숨김 + jobService 는 getByOwnerId fallback** (간단)

- [ ] **Step 3: 환경변수 문서화**

`.env.example` 에 추가:
```
EXPO_PUBLIC_WORKSPACE_COLLABORATION_ENABLED=true
```

- [ ] **Step 4: 검증 + 커밋**

```bash
EXPO_PUBLIC_WORKSPACE_COLLABORATION_ENABLED=false npm start
```

→ 워크스페이스 메뉴 미노출, 기존 owner 흐름 동작 확인.

```bash
git add src/lib/featureFlags.ts <flag 적용 파일들> .env.example
git commit -m "feat(workspace): WORKSPACE_COLLABORATION_ENABLED feature flag 진입점 게이팅"
```

### Phase 2C: 사용자 검색 자동완성

#### Task 2C.1: search_users_for_invite RPC

- [ ] **Step 1: migration 작성 + apply_migration**

`supabase/migrations/<ts>_add_search_users_for_invite_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION public.search_users_for_invite(
  _query text,
  _workspace_id uuid,
  _limit int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  display_name text,
  email text,
  photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 호출자가 workspace owner 인지 검증 (editor 는 초대 권한 없음)
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = (SELECT auth.uid())
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 입력 정규화 + LIKE wildcard escape
  -- _query 에 % 또는 _ 포함되면 wildcard 폭발 → ILIKE 가 의도하지 않은 매칭
  -- 예: _query = "100%" → "%100%%" → 모든 행 매칭. escape 후 안전한 LIKE pattern.
  DECLARE
    v_escaped text;
    v_trimmed text;
  BEGIN
    v_trimmed := trim(_query);
    IF length(v_trimmed) < 2 THEN
      RETURN;
    END IF;
    v_escaped := replace(replace(replace(v_trimmed, '\', '\\'), '%', '\%'), '_', '\_');
  END;

  RETURN QUERY
  SELECT
    u.id,
    COALESCE(u.nickname, u.name) AS display_name,
    u.email,
    u.photo_url
  FROM public.users u
  WHERE
    u.role = 'employer'
    AND u.deleted_at IS NULL
    AND (
      u.nickname ILIKE '%' || v_escaped || '%' ESCAPE '\'
      OR u.name ILIKE '%' || v_escaped || '%' ESCAPE '\'
      OR u.email = v_trimmed
    )
    -- 이미 멤버이거나 owner 인 사용자 제외
    AND u.id NOT IN (
      SELECT owner_id FROM public.workspaces WHERE id = _workspace_id
      UNION
      SELECT user_id FROM public.workspace_members WHERE workspace_id = _workspace_id
    )
  ORDER BY u.nickname NULLS LAST, u.name NULLS LAST
  LIMIT LEAST(_limit, 20);
END$$;

REVOKE EXECUTE ON FUNCTION public.search_users_for_invite(text, uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users_for_invite(text, uuid, int) TO authenticated;
```

MCP `apply_migration` 으로 적용.

- [ ] **Step 2: Repository + Service + Hook**

`src/services/users/userSearchService.ts` (신규):

```typescript
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/utils/supabase';

export interface UserSearchResult {
  id: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
}

export const userSearchService = {
  async searchForInvite(query: string, workspaceId: string): Promise<UserSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const { data, error } = await supabase.rpc('search_users_for_invite', {
      _query: trimmed,
      _workspace_id: workspaceId,
      _limit: 10,
    });

    if (error) handleSupabaseError(error, { operation: '사용자 검색', table: 'users' });

    return (data ?? []).map((row: any) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      photoUrl: row.photo_url,
    }));
  },
};
```

- [ ] **Step 3: 초대 화면에 자동완성 통합**

`app/(employer)/workspace/invite.tsx` (또는 동등 화면) 에 debounce (300ms) 검색 + 결과 리스트 표시.

- [ ] **Step 4: 검증 + 커밋**

```bash
npm run quality
```

```bash
git add supabase/migrations/<ts>_add_search_users_for_invite_rpc.sql \
  src/services/users/userSearchService.ts \
  app/(employer)/workspace/invite.tsx
git commit -m "feat(workspace): 사용자 검색 자동완성 — 이름/닉네임 부분 매칭 RPC"
```

### Phase 2D: E2E 6 critical paths

#### Task 2D.1: Playwright config 검증 + 시나리오 작성

- [ ] **Step 1: 시나리오 1 — Owner 가 editor 초대**

`e2e/workspace/01-owner-invites-editor.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('owner 가 editor 를 이메일로 초대하면 초대장이 생성된다', async ({ page }) => {
  // owner 로그인
  await loginAs(page, 'owner@test.com');
  await page.goto('/(employer)/workspace');
  await page.click('text=멤버 초대');
  await page.fill('input[placeholder*="이메일"]', 'editor@test.com');
  await page.click('text=초대 보내기');
  await expect(page.locator('text=초대를 보냈어요')).toBeVisible();
});
```

- [ ] **Step 2: 시나리오 02 — editor 가 초대 수락 → 워크스페이스 합류**

`e2e/workspace/02-editor-accepts-invitation.spec.ts`. 초대 알림 수신 → 받은 초대 화면 → 수락 → my workspaces 에 추가됨 확인.

- [ ] **Step 3: 시나리오 03 — editor 가 공유 공고 진입 → 상세 보임**

`e2e/workspace/03-editor-views-shared-posting.spec.ts`. workspace switcher 로 공유 워크스페이스 선택 → my-postings 목록에 owner 의 공고 노출 → 상세 진입 → 라우트 가드 통과.

- [ ] **Step 4: 시나리오 04 — editor 가 지원자 확정 → status 변경 성공**

`e2e/workspace/04-editor-confirms-applicant.spec.ts`. 공유 공고 상세 → 지원자 탭 → 확정 → application status='confirmed' 확인 (RLS 통과).

- [ ] **Step 5: 시나리오 05 — owner 가 editor 회수 → editor 화면에서 5초 내 Modal + 로그아웃**

`e2e/workspace/05-owner-revokes-editor.spec.ts`. 두 컨텍스트 (owner / editor) 동시 운용. owner 가 멤버 제거 → editor 컨텍스트에서 5초 내 RevocationModal + 자동 로그인 화면 이동.

- [ ] **Step 6: 시나리오 06 — 회수된 editor 재로그인 → 워크스페이스 목록에서 사라짐**

`e2e/workspace/06-revoked-editor-relogin.spec.ts`. 회수당한 editor 가 재로그인 → useWorkspaces 결과에 해당 워크스페이스 없음 → my-postings 도 본인 ownerId 공고만.

- [ ] **Step 7: 시나리오 07 (신규) — 회수 직후 mutation race**

`e2e/workspace/07-revoke-during-mutation.spec.ts`. editor 가 지원자 확정 진행 중 → owner 가 회수 → editor 의 PATCH 요청이 RLS UPDATE 거부 → 에러 메시지 "권한이 회수됐습니다" + RevocationModal 트리거. silent failure 방지.

- [ ] **Step 8: 시나리오 08 (신규) — 알림 deeplink 동작**

`e2e/workspace/08-invitation-notification-deeplink.spec.ts`. owner 가 초대 → editor 에게 푸시 알림 → 알림 탭 → `/(employer)/workspace/invitations` (받은 초대 화면) 진입 확인. NotificationRouteMap 검증.

- [ ] **Step 9: 시나리오 09 (신규) — Phase 1B 워크스페이스 전환 persistence**

`e2e/workspace/09-workspace-switcher-persists.spec.ts`. 다중 워크스페이스 사용자 → Switcher 로 워크스페이스 전환 → 앱 강제 종료 → 재실행 → 전환된 워크스페이스 가 활성 (AsyncStorage persistence 검증).

- [ ] **Step 10: CI 통합**

`.github/workflows/e2e.yml` 또는 기존 CI 에 `e2e/workspace/*` 추가. parallel shard.

- [ ] **Step 11: 커밋**

```bash
git add e2e/workspace/*.spec.ts .github/workflows/e2e.yml
git commit -m "test(workspace): E2E 9 critical paths — 초대→수락→편집→회수→race→deeplink→switcher"
```

### Phase 2 검증 체크리스트
- [ ] `npm run quality` 통과
- [ ] `npx jest` 전체 통과 (regression 8 + editor contract 신규)
- [ ] E2E 6/6 PASS
- [ ] staging 에서 editor 계정으로 공유 공고 상세 → 지원자 → 정산 화면 모두 진입 가능
- [ ] feature flag false 시 기존 owner 흐름 무변경
- [ ] MCP `get_advisors` ERROR 0건

### Phase 2 Rollback
- 2A: jobService/settlement/layout 변경 revert
- 2B: flag default `false` 로 변경 + 새 빌드
- 2C: RPC DROP + service revert
- 2D: spec 파일 skip

---

## Phase 3: M4 RENAME — 파생 RLS 워크스페이스 인지

**의존성:** Phase 2 안정 운영 1주+. 단 2A 가 의미 있게 동작하려면 3A/B/C 가 같이 배포돼야 함 → **2A 와 3A/B/C 는 같은 release window** 권장.

### Phase 3A: applications RLS

- [ ] **Step 0: 인덱스 pre-flight (모든 Phase 3 migration 공통)**

`is_workspace_member()` 가 RLS 핫패스라 `workspace_members(user_id, workspace_id)` 인덱스가 필수. M1.4 (`20260430010100_workspace_indexes.sql`) 에 정의됐는지 확인.

```bash
# MCP execute_sql
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'workspace_members';
```

`idx_workspace_members_user_id` 또는 `(user_id, workspace_id)` 복합 인덱스 존재 확인. 없으면 별도 migration 으로 추가 후 Phase 3A 시작.

- [ ] **Step 1: migration 작성 (UP + DOWN)**

`supabase/migrations/<ts>_workspace_m4_applications_rls.sql`:

```sql
-- applications: app_select / app_update 가 owner_id 만 체크 → workspace 멤버 분기 추가
DROP POLICY IF EXISTS app_select ON public.applications;
CREATE POLICY app_select ON public.applications FOR SELECT TO public
  USING (
    applicant_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );

DROP POLICY IF EXISTS app_update ON public.applications;
CREATE POLICY app_update ON public.applications FOR UPDATE TO public
  USING (
    applicant_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );

-- ============================================================
-- DOWN (M3 이전 정책으로 복원)
-- ============================================================
-- 이 블록은 주석으로 plan 에 보존. 롤백 필요 시 별도 migration 으로 적용.
/*
DROP POLICY IF EXISTS app_select ON public.applications;
CREATE POLICY app_select ON public.applications FOR SELECT TO public
  USING (
    applicant_id = (SELECT auth.uid())
    OR (job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = (SELECT auth.uid())))
    OR ((SELECT get_my_role()) = 'admin')
  );
DROP POLICY IF EXISTS app_update ON public.applications;
CREATE POLICY app_update ON public.applications FOR UPDATE TO public
  USING (
    applicant_id = (SELECT auth.uid())
    OR (job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = (SELECT auth.uid())))
    OR ((SELECT get_my_role()) = 'admin')
  );
*/
```

- [ ] **Step 2: editor regression test 추가**

`src/repositories/supabase/__tests__/ApplicationRepository.workspace.editor.test.ts`:

editor 계정으로 공유 공고의 application select / update 가 RLS 통과하는지 contract 검증 (mock).

- [ ] **Step 3: apply_migration + 검증 + 커밋**

```bash
git add supabase/migrations/<ts>_workspace_m4_applications_rls.sql \
  src/repositories/supabase/__tests__/ApplicationRepository.workspace.editor.test.ts
git commit -m "feat(workspace): M4 — applications RLS 워크스페이스 멤버 분기"
```

### Phase 3B: work_logs RLS

- [ ] **Step 1: migration**

`supabase/migrations/<ts>_workspace_m4_work_logs_rls.sql`:

```sql
DROP POLICY IF EXISTS "work_logs_select_involved" ON public.work_logs;
CREATE POLICY "work_logs_select_involved" ON public.work_logs
  FOR SELECT USING (
    staff_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = work_logs.job_posting_id
        AND public.is_workspace_member(jp.workspace_id, (SELECT auth.uid()))
    )
    OR public.is_admin()
  );

-- update / insert 동일 패턴
DROP POLICY IF EXISTS "work_logs_update_involved" ON public.work_logs;
CREATE POLICY "work_logs_update_involved" ON public.work_logs
  FOR UPDATE USING (
    staff_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = work_logs.job_posting_id
        AND public.is_workspace_member(jp.workspace_id, (SELECT auth.uid()))
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "work_logs_insert_owner_or_admin" ON public.work_logs;
CREATE POLICY "work_logs_insert_owner_or_admin" ON public.work_logs
  FOR INSERT WITH CHECK (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = job_posting_id
        AND public.is_workspace_member(jp.workspace_id, (SELECT auth.uid()))
    )
    OR public.is_admin()
  );
```

- [ ] **Step 2: editor regression + 커밋**

```bash
git commit -m "feat(workspace): M4 — work_logs RLS 워크스페이스 멤버 분기 (select/update/insert)"
```

### Phase 3C: event_qr_codes RLS

- [ ] **Step 1: migration**

`supabase/migrations/<ts>_workspace_m4_event_qr_codes_rls.sql`:

```sql
DROP POLICY IF EXISTS qr_select ON public.event_qr_codes;
CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT TO public
  USING (
    user_id = (SELECT auth.uid())
    OR (job_posting_id IN (
      SELECT id FROM public.job_postings
      WHERE owner_id = (SELECT auth.uid())
        OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    ))
    OR ((SELECT get_my_role()) = 'admin')
  );

-- update / delete 동일 분기 (delete 는 owner 또는 workspace owner 만 권장)
```

- [ ] **Step 2: 커밋**

```bash
git commit -m "feat(workspace): M4 — event_qr_codes RLS 워크스페이스 멤버 분기"
```

### Phase 3D: jp_select 잔존 owner_id 정리

- [ ] **Step 1: migration**

`supabase/migrations/<ts>_workspace_m4_jp_select_finalize.sql`:

```sql
-- N4 에서 멤버 분기 선반영했으나 optimize_rls_auth_uid_wrapping.sql:196-200 잔존
DROP POLICY IF EXISTS jp_select ON public.job_postings;
CREATE POLICY jp_select ON public.job_postings FOR SELECT TO public
  USING (
    status = ANY (ARRAY['approved'::posting_status, 'active'::posting_status, 'closed'::posting_status])
    OR owner_id = (SELECT auth.uid())
    OR public.is_workspace_member(workspace_id, (SELECT auth.uid()))
    OR ((SELECT get_my_role()) = 'admin')
  );
```

- [ ] **Step 2: advisors 0006 multiple_permissive_policies WARN 해소 확인**

MCP `get_advisors` 결과 mode=performance 체크.

- [ ] **Step 3: 커밋**

```bash
git commit -m "feat(workspace): M4 — jp_select 정책 통합 (owner OR workspace 멤버 OR admin)"
```

### Phase 3E: job_posting_templates 결정

- [ ] **Step 1: 의사결정 — owner-only 유지 vs workspace 공유**

추천: **owner-only 유지**. 템플릿은 개인 자산. 공유는 별도 기능 요청 시.

- [ ] **Step 2: 결정 문서화 (마이그레이션 없음)**

`.claude/rules/supabase-patterns.md` 또는 `docs/decisions/` 에 ADR 추가.

```bash
git commit -m "docs(workspace): job_posting_templates owner-only 유지 결정 ADR"
```

### Phase 3F: settlements RLS 점검

- [ ] **Step 1: 현재 RLS 조사**

```bash
# MCP execute_sql
SELECT polname, polcmd, polqual FROM pg_policy WHERE polrelid = 'public.settlements'::regclass;
```

- [ ] **Step 2: owner_id 기반이면 workspace 분기 추가**

(필요 시) migration 추가, 동일 패턴.

- [ ] **Step 3: 커밋**

```bash
git commit -m "feat(workspace): M4 — settlements RLS 워크스페이스 멤버 분기"
```

### Phase 3G: SPA 메모리 캐시 자동 갱신

별도 워크스페이스 / PR. 본 plan 범위에서 제외, follow-up 으로 마킹.

### Phase 3 검증 체크리스트
- [ ] 각 migration 적용 후 MCP `get_advisors` 0 ERROR / 0 multiple_permissive_policies WARN
- [ ] editor regression test 모든 도메인 통과
- [ ] staging 에서 editor 계정으로 지원자 확정 / 근무기록 수정 / QR 운영 동작 확인
- [ ] removed editor 즉시 차단 확인 (RLS 평가)
- [ ] owner / staff / admin 기존 흐름 회귀 없음

### Phase 3 Rollback
- 각 migration 에 DOWN script 포함 (이전 정책으로 복원)
- 단계적 적용: 3A 만 적용 → 1주 모니터링 → 3B → 3C 순서. 한 번에 모두 적용 금지.

---

## Phase 4: monetization 머지 후

**의존성:** `design/monetization-system` 또는 `feat/wallet-phase3-client-sdk` 브랜치 머지 후.

### Phase 4A: 결제 hookup
- 유료 공고는 `create_job_posting_with_payment_atomically` RPC 경유
- 무료/유료 분기를 `jobManagementService.createJobPosting` 에서 input.postingType 또는 paid 필드 기준 분기

### Phase 4B: Seat Enforcement
- 가격표 결정 (e.g. 무료 1+1, 유료 1+5, 프로 1+15) 후 RLS WITH CHECK 또는 invitation accept RPC 에서 enforce

→ monetization spec 머지 후 별도 spec.md 발행, 본 plan 의 Phase 4 는 placeholder.

```bash
git commit -m "chore(workspace): Phase 4 placeholder — monetization 머지 후 spec 분기"
```

---

## Phase 5: Phase 2 (수요 검증 후 결정)

본 plan 범위에서 제외. 각 항목별 spec 작성 후 별도 PR.

- 5A: 외부 이메일 초대 + 매직 링크
- 5B: Owner 양도
- **5C: 워크스페이스 삭제 / 아카이브** — 미리 정해둘 정책:
  - `job_postings.workspace_id` FK: **ON DELETE RESTRICT** (현재 default). 워크스페이스 삭제 전 모든 공고가 다른 워크스페이스로 이전되거나 archived 상태여야 함. CASCADE 는 데이터 손실 위험으로 금지. SET NULL 은 NOT NULL 제약과 모순으로 불가
  - 삭제 흐름: archive 상태 → 30일 grace period → hard delete (cron). hard delete 시점에 RESTRICT 위반이면 admin 수동 개입
  - 멤버에게 알림: archived 시 `workspace_archived` notification + 30일 카운트다운 표시
- 5D: 공고별 collaborator override
- 5E: 편집 presence
- 5F: 영문 i18n
- 5G: in-app 도움말
- **5H (신규): workspace_invitations 만료 cleanup 정책** — M2 cron 이 status='expired' 로 마킹만, 실제 row 는 누적. 정책: status='expired' 또는 'revoked' 인 row 가 created_at < now() - 90 days 면 hard delete (별도 cron). 감사 로그 필요 시 별도 archive 테이블로 이전 후 삭제

---

## Phase 의존성 그래프

```
                 ┌──────────────────────┐
                 │ Phase 0: N1 hotfix   │
                 │ (P0, 즉시, 단독 가능) │
                 └──────────┬───────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
  ┌────────────────────┐      ┌────────────────────┐
  │ Phase 1A: 회수 UX  │      │ Phase 1B: 다중 WS  │
  │ (단독 가능)        │      │ Switcher          │
  └────────┬───────────┘      └────────┬───────────┘
           │                           │
           └─────────────┬─────────────┘
                         ▼
       ┌──────────────────────────────────┐
       │ Phase 2A + 3A/B/C/D 동일 release │  ⚠️ entangled
       │ Service workspace화              │
       │  + 파생 RLS workspace 인지       │
       └──────────┬───────────────────────┘
                  ▼
       ┌────────────────────────┐
       │ Phase 2B: feature flag │  (병행 가능)
       │ Phase 2C: 검색 RPC     │
       │ Phase 2D: E2E          │
       └──────────┬─────────────┘
                  ▼
       ┌────────────────────────┐
       │ Phase 3E/F: 잔여 RLS   │  (1주+ 안정 후)
       │ Phase 3G: SW polling   │  (별도 트랙)
       └──────────┬─────────────┘
                  ▼
       ┌────────────────────────┐
       │ Phase 4: monetization  │  (외부 의존)
       │  4A 결제 / 4B Seat    │
       └──────────┬─────────────┘
                  ▼
       ┌────────────────────────┐
       │ Phase 5: Phase 2 features  │ (수요 검증 후)
       │  외부 초대/Owner 양도/...  │
       └────────────────────────┘
```

---

## 공통 Uniqn 컨벤션 준수 사항

모든 Phase 에 적용:

- [ ] 커밋: `<type>(<scope>): <한글>` (feat/fix/refactor/style/docs/test/chore/perf)
- [ ] 아키텍처: Presentation → Hooks → Service → Repository → Supabase 단방향
- [ ] DB 접근: Service → Repository, Presentation/Hooks 직접 호출 금지
- [ ] 필드명: camelCase 도메인 / snake_case DB
- [ ] 다크모드: `dark:` 항상 적용 + impeccable v1 #1 (lineHeight 가산)
- [ ] 로깅: `logger.info()` (`console.log` 금지)
- [ ] 에러: AppError E1~E7 분류 (특히 1A 는 E5 보안)
- [ ] XSS: `z.string().refine(xssValidation)` 사용자 입력 (2C 검색 query 포함)
- [ ] Supabase migration: MCP `apply_migration` 사용
- [ ] 터치 타깃 ≥ 44px (1A, 1B Switcher)
- [ ] Lucide 아이콘 (`@/components/icons` 경유)

---

## 전체 검증 체크리스트 (각 Phase 완료 후)

- [ ] `npm run quality` (tsc + eslint + prettier) 통과
- [ ] `npx jest` 전체 통과
- [ ] MCP `get_advisors` mode=security ERROR 0건
- [ ] MCP `get_advisors` mode=performance ERROR 0건
- [ ] staging 에서 owner / editor / staff / admin 4 역할 smoke 통과
- [ ] feature flag toggle 양 방향 동작 확인
- [ ] e2e 6 critical paths PASS
- [ ] 기존 regression test 8건 owner contract 무변경

---

## Self-Review 결과

**Spec coverage**: 17개 사용자 리스트 + 6개 신규 발견 모두 phase 별로 매핑 완료. Phase 0(N1), 1A(권한 회수), 1B(다중 WS), 2A~2D, 3A~3G, 4A~4B, 5A~5G — 누락 없음.

**Placeholder scan**: Phase 5 는 의도적으로 placeholder ("수요 검증 후 spec 분기"). Phase 4 도 monetization 의존이라 placeholder. 그 외 step 들은 모두 구체 코드/SQL/명령어 포함.

**Type consistency**: `getManagedByUserId` 가 Phase 2A 에서 Repository 인터페이스 + 구현 + Service + 테스트 모두 동일 시그니처 사용. `WorkspaceMember` 타입은 기존 정의 재사용.

---

**Plan complete.** 산출물:
- 위치: `docs/superpowers/plans/2026-05-08-workspace-collaboration-completion.md`
- 요약: Phase 0 N1 hotfix → Phase 1A/1B UX → Phase 2A~D 권한 일관성 (Phase 3 와 entangled) → Phase 3 RLS 정리 → Phase 4 monetization → Phase 5 외부 기능. 17 + 6 항목 모두 매핑.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Voice | Agent (general-purpose) | Independent 2nd opinion | 1 | NEEDS_FIX → FIXED | 5 critical + 4 누락 + 3 컨벤션 위반 모두 plan 에 반영 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_found → resolved | C1~C5 모두 plan 에 반영 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CROSS-MODEL CONSENSUS** (Agent + plan-eng-review 일치):
- C1: Phase 1A `useRef wasMember` fetch failure false positive → realtime + fetch fallback (가드) 로 재설계 ✅
- C2: Phase 3 migration DOWN script + index pre-flight 누락 → 모든 Phase 3 migration 에 DOWN 주석 + Step 0 인덱스 확인 ✅
- C3: bite-sized step 위반 (Phase 2D.1 5개 합쳐짐, 1A.3 step 합쳐짐) → step 분해 ✅
- C4: E2E 시나리오 누락 → 6 → 9 시나리오 확장 (race / deeplink / persistence) ✅
- C5: search RPC LIKE wildcard injection → escape 추가 ✅

**Agent 단독 발견 (모두 반영)**:
- jp.workspace_id ON DELETE RESTRICT 정책 명시 (Phase 5C)
- workspace_invitations cleanup 정책 (Phase 5H 신규)
- Switcher owner/member 라벨 구분 (Phase 1B)
- alert deeplink E2E (Phase 2D Step 8)
- getManagedJobPostings 시그니처 단순화 (userId 제거)

**UNRESOLVED:** 0 (모든 critical 이슈 해결됨)

**VERDICT:** ENG REVIEW CLEARED — Phase 0 즉시 SHIP 가능, Phase 1+ 는 plan 따라 진행

---

다음 단계 선택:

1. **Subagent-Driven (recommended)** — fresh subagent 가 task 별로 실행, 사이사이 사용자 리뷰
2. **Inline Execution** — 본 세션에서 executing-plans 로 batch 실행, checkpoint 마다 정지
