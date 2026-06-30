# 운영처 생성 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 주간 배치 그리드에서 운영처(venue 컨테이너)를 생성할 수 있게 한다(현재 생성 UI 부재로 기능 전체가 막다른 길 — 출하 차단 결함).

**Architecture:** 백엔드(RPC `get_or_create_venue_container` + repository `getOrCreateVenueContainer` + 이름 XSS 검증)는 이미 완성. 본 작업은 **UI 배선만** 추가한다: Hook→Service→Repository 아키텍처를 따라 `gridWriteService.createVenueContainer` + `useCreateVenueContainer` 변이 훅을 추가하고, 전용 `VenueCreateSheet`(SheetModal)와 두 진입점(빈 상태 버튼 / 선택기 "+ 운영처 추가")을 붙인다.

**Tech Stack:** React Native(Expo) · TypeScript(strict) · NativeWind · TanStack Query(useMutation) · Jest + @testing-library/react-native · Supabase RPC.

## Global Constraints

- 언어: 주석·커밋·UI 카피 **한글**.
- 아키텍처: 그리드 **쓰기 변이는 Repository 직접호출 금지** — `gridWriteService`(Service) 경유 필수.
- 변이 훅은 **mutation only** — 토스트/낙관 UI는 호출부(컴포넌트) 책임.
- v1 범위: **생성만, 이름만, `kind='dated'` 고정**. 이름변경/삭제·kind 토글·기간(period)은 범위 밖.
- 이름 XSS 검증(S1)·워크스페이스 권한 게이트·get-or-create 멱등은 **레포/RPC 경계가 담당**(클라에서 중복 검증하지 않음).
- 다크모드: 색상은 토큰 리터럴 클래스(`text-content-*`, `border-primary-*` 등), 동적 className 금지.
- onSuccess 무효화 키: `queryKeys.weeklyGrid.all`(prefix 일괄, 기존 그리드 변이 훅과 일관).
- 커밋 메시지 끝: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 테스트 실행: `npx jest <패턴>` · 최종 게이트 `npm run quality`(작업 디렉토리 `uniqn-mobile/`).

---

### Task 1: Service + 생성 변이 훅 (`useCreateVenueContainer`)

**Files:**
- Modify: `uniqn-mobile/src/services/weeklyGrid/gridWriteService.ts`
- Create: `uniqn-mobile/src/hooks/weeklyGrid/useCreateVenueContainer.ts`
- Modify: `uniqn-mobile/src/hooks/weeklyGrid/index.ts` (배럴 export)
- Test: `uniqn-mobile/src/hooks/weeklyGrid/__tests__/useCreateVenueContainer.test.ts`

**Interfaces:**
- Consumes: `jobPostingRepository.getOrCreateVenueContainer(workspaceId: string, options: { name: string; kind: string; period?: string }): Promise<VenueContainer>` (from `@/repositories`), `queryKeys.weeklyGrid.all` (from `@/lib/queryClient`).
- Produces:
  - `createVenueContainer(workspaceId: string, name: string): Promise<VenueContainer>` (gridWriteService).
  - `useCreateVenueContainer(workspaceId: string | undefined)` → TanStack mutation. `mutate(name: string, { onSuccess?: (c: VenueContainer) => void; onError?: (e: unknown) => void })`. `isPending: boolean`.
  - `VenueContainer` type (from `@/domains/weeklyGrid`): `{ id: string; name: string; workspaceId: string; ownerId: string | null; venueId: string | null; kind: string; softTargets: Record<string, number> }`.

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/hooks/weeklyGrid/__tests__/useCreateVenueContainer.test.ts`:

```tsx
/**
 * useCreateVenueContainer — 운영처 컨테이너 생성 변이 훅 테스트
 *
 * (1) 이름을 kind='dated' 로 레포 getOrCreateVenueContainer 에 위임,
 * (2) 성공 시 weeklyGrid 쿼리 일괄 invalidate, (3) workspaceId 부재 시 레포 미호출+에러.
 * 토스트는 호출부 책임이라 훅에서 검증하지 않는다(mutation only).
 */
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { jobPostingRepository } from '@/repositories';
import { useCreateVenueContainer } from '../useCreateVenueContainer';

jest.mock('@tanstack/react-query', () => jest.requireActual('@tanstack/react-query'));

jest.mock('@/repositories', () => ({
  jobPostingRepository: { getOrCreateVenueContainer: jest.fn() },
}));

// gridWriteService 가 모듈 로드 시 import 하는 sibling 레포 — 실제 supabase 체인 로드 회피용 스텁.
jest.mock('@/repositories/weeklyGrid', () => ({ weeklyGridRepository: {} }));

const mockCreate = jobPostingRepository.getOrCreateVenueContainer as jest.Mock;

const FAKE_VENUE = {
  id: 'venue-1',
  name: '강남 홀덤펍',
  workspaceId: 'ws-1',
  ownerId: 'owner-1',
  venueId: 'venue-1',
  kind: 'dated',
  softTargets: {},
};

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useCreateVenueContainer', () => {
  beforeEach(() => mockCreate.mockReset());

  it('이름을 kind=dated 로 레포에 위임', async () => {
    mockCreate.mockResolvedValueOnce(FAKE_VENUE);
    const client = createClient();
    const { result } = renderHook(() => useCreateVenueContainer('ws-1'), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('강남 홀덤펍');
    });

    expect(mockCreate).toHaveBeenCalledWith('ws-1', { name: '강남 홀덤펍', kind: 'dated' });
  });

  it('성공 시 weeklyGrid 관련 쿼리를 일괄 invalidate', async () => {
    mockCreate.mockResolvedValueOnce(FAKE_VENUE);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateVenueContainer('ws-1'), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('강남 홀덤펍');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.weeklyGrid.all });
  });

  it('workspaceId 부재 시 레포 미호출 + 에러', async () => {
    const client = createClient();
    const { result } = renderHook(() => useCreateVenueContainer(undefined), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('강남 홀덤펍').catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest useCreateVenueContainer`
Expected: FAIL — `Cannot find module '../useCreateVenueContainer'`.

- [ ] **Step 3: Add the service function**

Modify `uniqn-mobile/src/services/weeklyGrid/gridWriteService.ts` — add import + function (after the existing `updateSlot`):

```ts
import { jobPostingRepository } from '@/repositories';
import type { VenueContainer } from '@/domains/weeklyGrid';
```

```ts
/**
 * 운영처 컨테이너 생성(get-or-create, 멱등). 이름 XSS 검증(S1)·워크스페이스 권한 게이트는
 * 레포/RPC 경계가 담당. v1 은 kind='dated' 고정(날짜 기반 그리드 전제).
 */
export function createVenueContainer(workspaceId: string, name: string): Promise<VenueContainer> {
  return jobPostingRepository.getOrCreateVenueContainer(workspaceId, { name, kind: 'dated' });
}
```

- [ ] **Step 4: Create the hook**

Create `uniqn-mobile/src/hooks/weeklyGrid/useCreateVenueContainer.ts`:

```ts
/**
 * useCreateVenueContainer — 운영처 컨테이너 생성 변이 훅(TanStack useMutation).
 *
 * mutationFn 은 Service(gridWriteService.createVenueContainer) 경유(아키텍처 Hook→Service→Repository).
 * 이름 XSS 검증(S1)·워크스페이스 권한 게이트·get-or-create 멱등은 레포/RPC 경계가 담당.
 * onSuccess: weeklyGrid prefix 일괄 invalidate → useVenueContainers(목록) 재조회.
 * 토스트/낙관 UI 는 호출부 책임(훅은 변이만). workspaceId 부재 시 변이는 거부(레포 미호출).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { createVenueContainer } from '@/services/weeklyGrid/gridWriteService';

export function useCreateVenueContainer(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      if (!workspaceId) {
        return Promise.reject(new Error('WORKSPACE_REQUIRED'));
      }
      return createVenueContainer(workspaceId, name);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.weeklyGrid.all });
    },
  });
}

export default useCreateVenueContainer;
```

- [ ] **Step 5: Export the hook from the barrel**

Modify `uniqn-mobile/src/hooks/weeklyGrid/index.ts` — add:

```ts
export { useCreateVenueContainer } from './useCreateVenueContainer';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest useCreateVenueContainer`
Expected: PASS (3 passed).

- [ ] **Step 7: Commit**

```bash
git add uniqn-mobile/src/services/weeklyGrid/gridWriteService.ts \
        uniqn-mobile/src/hooks/weeklyGrid/useCreateVenueContainer.ts \
        uniqn-mobile/src/hooks/weeklyGrid/index.ts \
        uniqn-mobile/src/hooks/weeklyGrid/__tests__/useCreateVenueContainer.test.ts
git commit -m "feat(grid): 운영처 생성 변이 훅 + Service 경계(useCreateVenueContainer)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 운영처 생성 시트 (`VenueCreateSheet`)

**Files:**
- Create: `uniqn-mobile/src/components/weeklyGrid/VenueCreateSheet.tsx`
- Modify: `uniqn-mobile/src/components/weeklyGrid/index.ts` (배럴 export)
- Test: `uniqn-mobile/src/components/weeklyGrid/__tests__/VenueCreateSheet.test.tsx`

**Interfaces:**
- Consumes: `useCreateVenueContainer(workspaceId)` (Task 1), `SheetModal` (`@/components/ui/SheetModal`), `Input` (`@/components/ui/Input`), `Button` (`@/components/ui/Button`), `useToastStore` (`@/stores/toastStore`, selector `s.success`/`s.error`), `isAppError` (`@/errors`).
- Produces: `VenueCreateSheet` 컴포넌트. Props: `{ visible: boolean; workspaceId: string | undefined; onClose: () => void; onCreated: (container: VenueContainer) => void }`. 제출 버튼 a11y 라벨 = `"운영처 만들기"`, 이름 입력 라벨 = `"운영처 이름"`.

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/components/weeklyGrid/__tests__/VenueCreateSheet.test.tsx`:

```tsx
/**
 * VenueCreateSheet — 운영처 생성 시트 테스트
 *
 * SheetModal(reanimated)은 가벼운 children+footer 렌더로 모킹하고, 변이 훅을 모킹해
 * (1) 이름 입력 후 제출이 trim 된 이름으로 mutate 호출, (2) 빈 이름은 제출 비활성을 검증한다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueCreateSheet } from '../VenueCreateSheet';
import { useCreateVenueContainer } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';

// 무거운 의존(SheetModal=RNModal+reanimated) 모킹: visible 일 때 children+footer 만 렌더
jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

jest.mock('@/hooks/weeklyGrid', () => ({ useCreateVenueContainer: jest.fn() }));
jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));

const mockUseCreate = useCreateVenueContainer as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;

beforeEach(() => {
  mockUseToast.mockImplementation((sel: any) =>
    sel({ success: jest.fn(), error: jest.fn(), info: jest.fn() })
  );
});

it('이름 입력 후 제출 시 trim 된 이름으로 mutate 호출', () => {
  const mutate = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={jest.fn()} />
  );

  fireEvent.changeText(getByLabelText('운영처 이름'), '  강남 홀덤펍  ');
  fireEvent.press(getByLabelText('운영처 만들기'));

  expect(mutate).toHaveBeenCalledTimes(1);
  expect(mutate.mock.calls[0][0]).toBe('강남 홀덤펍');
});

it('빈 이름이면 제출 버튼 비활성(미호출)', () => {
  const mutate = jest.fn();
  mockUseCreate.mockReturnValue({ mutate, isPending: false });

  const { getByLabelText } = render(
    <VenueCreateSheet visible workspaceId="ws-1" onClose={jest.fn()} onCreated={jest.fn()} />
  );

  fireEvent.press(getByLabelText('운영처 만들기'));
  expect(mutate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest VenueCreateSheet`
Expected: FAIL — `Cannot find module '../VenueCreateSheet'`.

- [ ] **Step 3: Create the component**

Create `uniqn-mobile/src/components/weeklyGrid/VenueCreateSheet.tsx`:

```tsx
/**
 * VenueCreateSheet — 운영처(컨테이너) 생성 시트.
 *
 * 빈 상태 버튼 / 선택기 "+ 운영처 추가" 두 진입점이 공유하는 단일 컴포넌트.
 * v1: 이름만 입력(kind='dated' 고정). 제출 → useCreateVenueContainer → get-or-create(멱등).
 * 성공 시 onCreated(c) + 닫기. 토스트는 이 컴포넌트(호출부) 책임. 닫힐 때 입력 초기화.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import { useCreateVenueContainer } from '@/hooks/weeklyGrid';
import { isAppError } from '@/errors';
import type { VenueContainer } from '@/domains/weeklyGrid';

export interface VenueCreateSheetProps {
  visible: boolean;
  workspaceId: string | undefined;
  onClose: () => void;
  onCreated: (container: VenueContainer) => void;
}

export function VenueCreateSheet({
  visible,
  workspaceId,
  onClose,
  onCreated,
}: VenueCreateSheetProps) {
  const [name, setName] = useState('');
  const create = useCreateVenueContainer(workspaceId);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  // 닫힐 때 입력 초기화(재오픈 시 이전 값 잔존 방지).
  useEffect(() => {
    if (!visible) setName('');
  }, [visible]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !!workspaceId && !create.isPending;

  const handleSubmit = useCallback(() => {
    const value = name.trim();
    if (!value || !workspaceId || create.isPending) return;
    create.mutate(value, {
      onSuccess: (container) => {
        toastSuccess('운영처를 만들었어요.');
        onCreated(container);
      },
      onError: (err) => {
        const msg =
          isAppError(err) && err.userMessage ? err.userMessage : '운영처 생성에 실패했어요.';
        toastError(msg);
      },
    });
  }, [name, workspaceId, create, toastSuccess, toastError, onCreated]);

  const footer = (
    <View className="flex-row gap-2 p-4">
      <Button variant="outline" onPress={onClose} className="flex-1" accessibilityLabel="취소">
        취소
      </Button>
      <Button
        variant="primary"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={create.isPending}
        className="flex-1"
        accessibilityLabel="운영처 만들기"
      >
        만들기
      </Button>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="운영처 만들기"
      isLoading={create.isPending}
      footer={footer}
    >
      <View className="p-5">
        <Input
          label="운영처 이름"
          value={name}
          onChangeText={setName}
          placeholder="예: 강남 홀덤펍"
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          maxLength={40}
        />
      </View>
    </SheetModal>
  );
}

export default VenueCreateSheet;
```

- [ ] **Step 4: Export from the barrel**

Modify `uniqn-mobile/src/components/weeklyGrid/index.ts` — add (alongside existing exports):

```ts
export { VenueCreateSheet } from './VenueCreateSheet';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest VenueCreateSheet`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/src/components/weeklyGrid/VenueCreateSheet.tsx \
        uniqn-mobile/src/components/weeklyGrid/index.ts \
        uniqn-mobile/src/components/weeklyGrid/__tests__/VenueCreateSheet.test.tsx
git commit -m "feat(grid): 운영처 생성 시트 VenueCreateSheet(이름 입력·SheetModal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 선택기 "+ 운영처 추가" 진입점 (`VenueSelector`)

**Files:**
- Modify: `uniqn-mobile/src/components/weeklyGrid/VenueSelector.tsx`
- Test: `uniqn-mobile/src/components/weeklyGrid/__tests__/VenueSelector.test.tsx`

**Interfaces:**
- Consumes: 기존 `VenueSelectorProps` + 신규 `onAddVenue?: () => void`.
- Produces: `onAddVenue` 제공 시 운영처 칩 줄 끝(0개일 때는 "없어요" 텍스트 옆)에 a11y 라벨 `"운영처 추가"` 버튼 노출. 누르면 `onAddVenue()` 호출.

- [ ] **Step 1: Write the failing test**

Create `uniqn-mobile/src/components/weeklyGrid/__tests__/VenueSelector.test.tsx`:

```tsx
/**
 * VenueSelector — "+ 운영처 추가" 진입점 테스트
 *
 * onAddVenue 제공 시 운영처 0개/N개 모두에서 "운영처 추가" 버튼이 노출되고
 * 누르면 콜백이 호출되는지 검증(순수 표현 컴포넌트).
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueSelector } from '../VenueSelector';

const NOOP = () => {};

function renderSelector(overrides: Partial<React.ComponentProps<typeof VenueSelector>> = {}) {
  return render(
    <VenueSelector
      workspaces={[{ id: 'ws-1', name: '워크스페이스' } as never]}
      activeWorkspaceId="ws-1"
      onSelectWorkspace={NOOP}
      containers={[]}
      selectedVenueId={null}
      onSelectVenue={NOOP}
      {...overrides}
    />
  );
}

it('운영처 0개에서도 onAddVenue 제공 시 추가 버튼 노출 + 콜백 호출', () => {
  const onAddVenue = jest.fn();
  const { getByLabelText } = renderSelector({ onAddVenue });
  fireEvent.press(getByLabelText('운영처 추가'));
  expect(onAddVenue).toHaveBeenCalledTimes(1);
});

it('onAddVenue 미제공 시 추가 버튼 미노출', () => {
  const { queryByLabelText } = renderSelector();
  expect(queryByLabelText('운영처 추가')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd uniqn-mobile && npx jest VenueSelector`
Expected: FAIL — `Unable to find ... "운영처 추가"`.

- [ ] **Step 3: Add `onAddVenue` to props**

Modify `uniqn-mobile/src/components/weeklyGrid/VenueSelector.tsx` — extend the props interface:

```ts
export interface VenueSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | undefined;
  onSelectWorkspace: (id: string) => void;
  containers: VenueContainer[];
  selectedVenueId: string | null;
  onSelectVenue: (id: string) => void;
  isLoadingContainers?: boolean;
  /** 제공 시 운영처 칩 줄에 "+ 운영처 추가" 진입점 노출. */
  onAddVenue?: () => void;
}
```

And add `onAddVenue` to the destructured params:

```ts
export function VenueSelector({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  containers,
  selectedVenueId,
  onSelectVenue,
  isLoadingContainers = false,
  onAddVenue,
}: VenueSelectorProps) {
```

- [ ] **Step 4: Replace the venue-section render branch**

In `VenueSelector.tsx`, replace the whole `{isLoadingContainers ? (...) : containers.length === 0 ? (...) : (...)}` block (the loading / empty / chips ternary under the `운영처` label) with a single ScrollView that always appends the add affordance:

```tsx
      {isLoadingContainers ? (
        <View className="h-10 flex-row items-center">
          <ActivityIndicator size="small" />
          <Text className="ml-2 text-sm text-content-secondary">운영처 불러오는 중…</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8, alignItems: 'center' }}
        >
          {containers.length === 0 ? (
            <View className="mr-2 h-10 justify-center">
              <Text className="text-sm text-content-secondary">
                이 워크스페이스에 등록된 운영처가 없어요
              </Text>
            </View>
          ) : (
            containers.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={c.id === selectedVenueId}
                onPress={handleSelectVenue(c.id)}
                a11yLabel={`운영처 ${c.name}`}
              />
            ))
          )}
          {onAddVenue ? (
            <Pressable
              onPress={onAddVenue}
              accessibilityRole="button"
              accessibilityLabel="운영처 추가"
              className="min-h-[40px] flex-row items-center justify-center rounded-full border border-dashed border-primary-400 px-4 py-2"
            >
              <Text className="text-sm font-sans-medium text-primary-500">+ 운영처 추가</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd uniqn-mobile && npx jest VenueSelector`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add uniqn-mobile/src/components/weeklyGrid/VenueSelector.tsx \
        uniqn-mobile/src/components/weeklyGrid/__tests__/VenueSelector.test.tsx
git commit -m "feat(grid): 운영처 선택기에 '+ 운영처 추가' 진입점(onAddVenue)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 그리드 화면 배선 + 품질 게이트 (`weekly-grid.tsx`)

**Files:**
- Modify: `uniqn-mobile/app/(employer)/weekly-grid.tsx`

**Interfaces:**
- Consumes: `VenueCreateSheet` (Task 2), `VenueSelector onAddVenue` (Task 3). 화면이 두 진입점(빈 상태 버튼 / 선택기 칩)에서 동일한 `VenueCreateSheet` 를 열고, 생성 성공 시 새 운영처를 선택한다.
- Produces: 화면 통합(신규 인터페이스 없음). 본 작업으로 운영처 0개 워크스페이스에서 그리드가 막다른 길이 아니게 된다.

- [ ] **Step 1: Import the sheet**

Modify `uniqn-mobile/app/(employer)/weekly-grid.tsx` — extend the weeklyGrid components import (line 37):

```ts
import { VenueSelector, VenueDayPanel, VenueCreateSheet } from '@/components/weeklyGrid';
```

- [ ] **Step 2: Add sheet visibility state**

After the `selectedDate` state (line 91), add:

```ts
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
```

- [ ] **Step 3: Wire the VenueSelector "+ 추가" entry point**

In the `<VenueSelector ... />` usage (around line 184-192), add the `onAddVenue` prop:

```tsx
      <VenueSelector
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspace?.id}
        onSelectWorkspace={setActiveWorkspaceId}
        containers={containers}
        selectedVenueId={selectedVenueId}
        onSelectVenue={setSelectedVenueId}
        isLoadingContainers={wsLoading || containersQuery.isLoading}
        onAddVenue={() => setCreateSheetVisible(true)}
      />
```

- [ ] **Step 4: Wire the empty-state button**

In the empty-state `<EmptyState ... />` (around line 200-204), add `actionLabel` + `onAction`:

```tsx
            <EmptyState
              icon={<MapPinIcon size={48} color={SECONDARY_PALETTE[400]} />}
              title="운영처가 없어요"
              description="이 워크스페이스에 운영처(상시 배치 장소)를 먼저 만들어주세요."
              actionLabel="운영처 만들기"
              onAction={() => setCreateSheetVisible(true)}
            />
```

- [ ] **Step 5: Render the sheet**

Immediately before the closing `</SafeAreaView>` (line 297), add:

```tsx
      <VenueCreateSheet
        visible={createSheetVisible}
        workspaceId={activeWorkspace?.id}
        onClose={() => setCreateSheetVisible(false)}
        onCreated={(container) => {
          setSelectedVenueId(container.id);
          setCreateSheetVisible(false);
        }}
      />
```

- [ ] **Step 6: Type-check + lint + format gate**

Run: `cd uniqn-mobile && npm run quality`
Expected: EXIT 0 (tsc 0 errors, eslint 0 errors, prettier clean). If prettier flags formatting, run `npx prettier --write` on the changed files and re-run.

- [ ] **Step 7: Run the full weeklyGrid test suite**

Run: `cd uniqn-mobile && npx jest weeklyGrid`
Expected: PASS — existing grid suites + new `useCreateVenueContainer`, `VenueCreateSheet`, `VenueSelector` tests all green.

- [ ] **Step 8: Commit**

```bash
git add "uniqn-mobile/app/(employer)/weekly-grid.tsx"
git commit -m "feat(grid): 운영처 생성 진입점 배선 — 빈상태 버튼 + 선택기 '+ 추가'

운영처 0개 워크스페이스에서 그리드 막다른 길 해소(QA 적발 출하차단 결함).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 검증 (전체 완료 후)

- [ ] `cd uniqn-mobile && npm run quality` — EXIT 0.
- [ ] `cd uniqn-mobile && npx jest weeklyGrid` — 신규 3 테스트 포함 전부 PASS.
- [ ] 수동(웹 dev 빌드, 로컬 플래그 ON): 운영처 0개 → 빈 상태 "운영처 만들기"/선택기 "+ 운영처 추가" → 이름 입력 → 만들기 → 새 운영처 자동 선택 + 그리드 진입. 같은 이름 재생성 시 중복 안 생김(멱등). 빈 이름 제출 비활성. 다크모드 색상 정상.

## 범위 밖 (후속 — 본 계획에서 구현하지 않음)

- 운영처 이름변경 / 삭제(soft delete).
- kind 토글(상시/대회) · 대회 기간(period) 입력.
- 운영처 정렬/검색.
