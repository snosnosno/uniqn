# ops 운영 콘솔 레이아웃 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ops 대회 상세(`app/(ops)/tournaments/[id].tsx`)를 상시 클럭 스트립 + 기본 현황 + 폰 5탭/태블릿 사이드바 반응형 셸로 재배치하고, 이동·탈락을 참가·테이블 공용 액션시트로 통합한다.

**Architecture:** 탭 콘텐츠 컴포넌트(`PlayersTab`·`TablesTab`·`BlindLevelsTab`·`StaffTab`·`HistoryTab`·`PayoutsTab`)는 내부 불변. 바꾸는 것은 `[id].tsx`의 셸 레이아웃뿐이다. 신규 프레젠테이션 컴포넌트가 기존 훅을 그대로 구독하므로 **신규 RPC·마이그레이션 0**.

**Tech Stack:** Expo RN 0.83 · React 19 · TS strict · NativeWind 4 · TanStack Query · `@gorhom/bottom-sheet`(SelectBottomSheet/SheetModal) · Jest + @testing-library/react-native.

**설계 근거:** `docs/superpowers/specs/2026-07-23-ops-console-layout-redesign-design.md` (결정 L1~L8).

## Global Constraints

- 모든 주석·커밋·문서 **한글**. 코드 식별자만 원문.
- 다크모드 `dark:` 항상 적용. 라이트 단독 금지.
- 경로 `@/` 절대 경로. 시스템 절대경로 금지.
- 로깅 `logger.info()` — `console.log()` 금지(앱 런타임).
- 확인 다이얼로그 `confirmAction()` / 안내 `showAlert()` / 알림 `toast.*` — `Alert.alert()` 직접 호출 금지(웹 no-op).
- 필드명 camelCase. 리스트 대형=FlashList / 소형=FlatList.
- 단독 버튼 터치타깃 ≥44px(`min-h-[44px]`), 세그먼트 내부는 40px 허용.
- 반응형 분기 상수는 **기존** `ANDROID_COMPLIANCE.LARGE_SCREEN_MIN_WIDTH_DP`(=600, `src/constants/index.ts:92`) 재사용 — 신규 상수 금지.
- 탭 콘텐츠 컴포넌트 내부 로직·props·권한 분기 **변경 금지**.
- 완료 대회 표시: 착수 전 `git status`로 병렬세션 미커밋 확인, 있으면 워크트리 격리.
- 완료 주장 전 `npm run quality`(tsc+eslint+prettier) + 관련 Jest 실행 증거.

---

### Task 1: `useOpsConsoleLayout` — 600dp 반응형 분기 훅

**Files:**
- Create: `src/hooks/ops/useOpsConsoleLayout.ts`
- Modify: `src/hooks/ops/index.ts` (배럴 export 추가)
- Test: `src/hooks/ops/__tests__/useOpsConsoleLayout.test.ts`

**Interfaces:**
- Consumes: `ANDROID_COMPLIANCE.LARGE_SCREEN_MIN_WIDTH_DP` from `@/constants`, `useWindowDimensions` from `react-native`.
- Produces: `useOpsConsoleLayout(): { isWide: boolean; width: number }` — `isWide = width >= 600`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/hooks/ops/__tests__/useOpsConsoleLayout.test.ts
import { renderHook } from '@testing-library/react-native';

let mockWidth = 390;
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: mockWidth, height: 800, scale: 2, fontScale: 1 }),
}));

import { useOpsConsoleLayout } from '../useOpsConsoleLayout';

describe('useOpsConsoleLayout', () => {
  it('폰 폭(390)에서 isWide=false', () => {
    mockWidth = 390;
    const { result } = renderHook(() => useOpsConsoleLayout());
    expect(result.current.isWide).toBe(false);
    expect(result.current.width).toBe(390);
  });

  it('600dp 경계에서 isWide=true', () => {
    mockWidth = 600;
    const { result } = renderHook(() => useOpsConsoleLayout());
    expect(result.current.isWide).toBe(true);
  });

  it('태블릿 폭(834)에서 isWide=true', () => {
    mockWidth = 834;
    const { result } = renderHook(() => useOpsConsoleLayout());
    expect(result.current.isWide).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/hooks/ops/__tests__/useOpsConsoleLayout.test.ts`
Expected: FAIL — "Cannot find module '../useOpsConsoleLayout'"

- [ ] **Step 3: 최소 구현**

```ts
// src/hooks/ops/useOpsConsoleLayout.ts
/** ops 운영 콘솔 반응형 분기(L4·L8). 600dp 이상 = 태블릿 사이드바 레이아웃. */
import { useWindowDimensions } from 'react-native';
import { ANDROID_COMPLIANCE } from '@/constants';

export interface OpsConsoleLayout {
  isWide: boolean;
  width: number;
}

export function useOpsConsoleLayout(): OpsConsoleLayout {
  const { width } = useWindowDimensions();
  return {
    width,
    isWide: width >= ANDROID_COMPLIANCE.LARGE_SCREEN_MIN_WIDTH_DP,
  };
}
```

- [ ] **Step 4: 배럴 등록**

`src/hooks/ops/index.ts` 끝에 추가:

```ts
export { useOpsConsoleLayout } from './useOpsConsoleLayout';
```

- [ ] **Step 5: 통과 확인**

Run: `npx jest src/hooks/ops/__tests__/useOpsConsoleLayout.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/hooks/ops/useOpsConsoleLayout.ts src/hooks/ops/index.ts src/hooks/ops/__tests__/useOpsConsoleLayout.test.ts
git commit -m "feat(ops): 운영 콘솔 600dp 반응형 분기 훅 추가"
```

---

### Task 2: `OpsSummaryStrip` — 상시 한 줄 요약(L1)

**Files:**
- Create: `src/components/ops/OpsSummaryStrip.tsx`
- Modify: `src/components/ops/index.ts`
- Test: `src/components/ops/__tests__/OpsSummaryStrip.test.tsx`

**Interfaces:**
- Consumes: `useOpsLiveStats(tournamentId)` from `@/hooks/ops` → `{ stats }` (`stats.playing`, `stats.entries`, `stats.averageStackBb`).
- Produces: `OpsSummaryStrip({ tournamentId: string; onPress?: () => void })`.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/components/ops/__tests__/OpsSummaryStrip.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { useOpsLiveStats } from '@/hooks/ops';
import { OpsSummaryStrip } from '../OpsSummaryStrip';

jest.mock('@/hooks/ops', () => ({ useOpsLiveStats: jest.fn() }));

describe('OpsSummaryStrip', () => {
  it('PLAYING·ENTRY·AVG BB 를 한 줄로 표시', () => {
    (useOpsLiveStats as jest.Mock).mockReturnValue({
      stats: { playing: 9, entries: 57, averageStackBb: 19 },
    });
    const { getByText } = render(<OpsSummaryStrip tournamentId="t1" />);
    expect(getByText(/9/)).toBeTruthy();
    expect(getByText(/57/)).toBeTruthy();
    expect(getByText(/19/)).toBeTruthy();
  });

  it('탭하면 onPress 호출(현황 점프)', () => {
    (useOpsLiveStats as jest.Mock).mockReturnValue({
      stats: { playing: 0, entries: 0, averageStackBb: 0 },
    });
    const onPress = jest.fn();
    const { getByRole } = render(<OpsSummaryStrip tournamentId="t1" onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/components/ops/__tests__/OpsSummaryStrip.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현**

```tsx
// src/components/ops/OpsSummaryStrip.tsx
/** 상시 한 줄 요약(L1). ops_live_stats 구독. 탭 → 현황 탭 점프. */
import { Pressable, Text, View } from 'react-native';
import { useOpsLiveStats } from '@/hooks/ops';

interface OpsSummaryStripProps {
  tournamentId: string;
  onPress?: () => void;
}

export function OpsSummaryStrip({ tournamentId, onPress }: OpsSummaryStripProps) {
  const { stats } = useOpsLiveStats(tournamentId);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="대회 현황 요약"
      className="flex-row items-center justify-center gap-2 border-b border-gray-200 px-3 py-2 active:bg-gray-50 dark:border-gray-700 dark:active:bg-gray-800"
    >
      <Text className="text-xs text-secondary-500 dark:text-secondary-400">
        <Text className="font-sans-semibold text-content-primary dark:text-off-white">
          {stats?.playing ?? 0}
        </Text>{' '}
        PLAYING · {' '}
        <Text className="font-sans-semibold text-content-primary dark:text-off-white">
          {stats?.entries ?? 0}
        </Text>{' '}
        ENTRY · AVG{' '}
        <Text className="font-sans-semibold text-content-primary dark:text-off-white">
          {stats?.averageStackBb ?? 0}
        </Text>
        BB
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: 배럴 등록**

`src/components/ops/index.ts`에 추가:

```ts
export { OpsSummaryStrip } from './OpsSummaryStrip';
```

- [ ] **Step 5: 통과 확인**

Run: `npx jest src/components/ops/__tests__/OpsSummaryStrip.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ops/OpsSummaryStrip.tsx src/components/ops/index.ts src/components/ops/__tests__/OpsSummaryStrip.test.tsx
git commit -m "feat(ops): 상시 요약 스트립(OpsSummaryStrip) 추가"
```

---

### Task 3: `OpsClockStrip` + `OpsClockControlSheet` — 상시 클럭(L1)

**Files:**
- Create: `src/components/ops/OpsClockStrip.tsx`
- Create: `src/components/ops/OpsClockControlSheet.tsx`
- Modify: `src/components/ops/index.ts`
- Test: `src/components/ops/__tests__/OpsClockStrip.test.tsx`

**Interfaces:**
- Consumes: `useOpsClock(tournamentId)` → `{ clock, currentLevel, remainingSec, levelMissing }`; 기존 `ClockControl` 컴포넌트(시트 본문 재사용).
- Produces:
  - `OpsClockStrip({ tournamentId: string })` — 축약 표시 + 탭 시 내부 시트 open.
  - `OpsClockControlSheet({ tournamentId: string; visible: boolean; onClose: () => void; onNavigateToLevels: () => void })`.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/components/ops/__tests__/OpsClockStrip.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { useOpsClock } from '@/hooks/ops';
import { OpsClockStrip } from '../OpsClockStrip';

jest.mock('@/hooks/ops', () => ({
  useOpsClock: jest.fn(),
  useOpsBlindLevels: jest.fn(() => ({ blindLevels: [] })),
}));
// 시트 본문은 무거운 의존(ClockControl) → 가벼운 스텁
jest.mock('../OpsClockControlSheet', () => ({
  OpsClockControlSheet: ({ visible }: { visible: boolean }) =>
    visible ? require('react-native').Text({ children: 'SHEET_OPEN' }) : null,
}));

describe('OpsClockStrip', () => {
  it('레벨·남은시간 표시(MM:SS)', () => {
    (useOpsClock as jest.Mock).mockReturnValue({
      clock: { levelStartedAt: null, isRunning: false },
      currentLevel: { level: 19, smallBlind: 5000, bigBlind: 10000, ante: 10000 },
      remainingSec: 493,
      levelMissing: false,
    });
    const { getByText } = render(<OpsClockStrip tournamentId="t1" />);
    expect(getByText(/LV 19|LEVEL 19/)).toBeTruthy();
    expect(getByText('08:13')).toBeTruthy();
  });

  it('탭하면 제어 시트 open', () => {
    (useOpsClock as jest.Mock).mockReturnValue({
      clock: { isRunning: false },
      currentLevel: { level: 1, smallBlind: 100, bigBlind: 200, ante: 200 },
      remainingSec: 60,
      levelMissing: false,
    });
    const { getByRole, getByText } = render(<OpsClockStrip tournamentId="t1" />);
    fireEvent.press(getByRole('button'));
    expect(getByText('SHEET_OPEN')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/components/ops/__tests__/OpsClockStrip.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 시트 구현(ClockControl 래핑)**

```tsx
// src/components/ops/OpsClockControlSheet.tsx
/** 클럭 제어 시트(L1). 기존 ClockControl 을 SheetModal 로 감싼다. */
import { SheetModal } from '@/components/ui';
import { ClockControl } from './ClockControl';

interface OpsClockControlSheetProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
  onNavigateToLevels: () => void;
}

export function OpsClockControlSheet({
  tournamentId,
  visible,
  onClose,
  onNavigateToLevels,
}: OpsClockControlSheetProps) {
  return (
    <SheetModal visible={visible} onClose={onClose} title="클럭 제어">
      <ClockControl
        tournamentId={tournamentId}
        onNavigateToLevels={() => {
          onClose();
          onNavigateToLevels();
        }}
      />
    </SheetModal>
  );
}
```

> 주의: `SheetModal`의 실제 props(`visible`/`isVisible`, `title` 지원 여부)를 `src/components/ui/SheetModal.tsx`에서 확인하고 시그니처를 맞춘다. 다르면 해당 파일의 props에 맞춰 조정(예: `isVisible`).

- [ ] **Step 4: 스트립 구현**

```tsx
// src/components/ops/OpsClockStrip.tsx
/** 상시 클럭 스트립(L1). 축약 표시 + 탭 시 제어 시트. 모든 탭 위에 고정. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useOpsClock } from '@/hooks/ops';
import { formatNumber as fmt } from '@/utils/formatters/currency';
import { OpsClockControlSheet } from './OpsClockControlSheet';

interface OpsClockStripProps {
  tournamentId: string;
  onNavigateToLevels: () => void;
}

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function OpsClockStrip({ tournamentId, onNavigateToLevels }: OpsClockStripProps) {
  const { currentLevel, remainingSec } = useOpsClock(tournamentId);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="클럭 제어 열기"
        className="border-b border-gray-200 px-4 py-3 active:bg-gray-50 dark:border-gray-700 dark:active:bg-gray-800"
      >
        <View className="flex-row items-baseline justify-between">
          <Text className="font-sans-semibold text-xs text-gold">
            LEVEL {currentLevel?.level ?? '—'}
          </Text>
          <Text className="text-2xl font-sans-bold text-content-primary dark:text-off-white">
            {mmss(remainingSec ?? 0)}
          </Text>
        </View>
        <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
          {currentLevel
            ? `${fmt(currentLevel.smallBlind)} / ${fmt(currentLevel.bigBlind)} · ante ${fmt(currentLevel.ante)}`
            : '블라인드 미설정'}
        </Text>
      </Pressable>
      <OpsClockControlSheet
        tournamentId={tournamentId}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onNavigateToLevels={onNavigateToLevels}
      />
    </>
  );
}
```

- [ ] **Step 5: 배럴 등록**

```ts
export { OpsClockStrip } from './OpsClockStrip';
export { OpsClockControlSheet } from './OpsClockControlSheet';
```

- [ ] **Step 6: 통과 확인**

Run: `npx jest src/components/ops/__tests__/OpsClockStrip.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: 커밋**

```bash
git add src/components/ops/OpsClockStrip.tsx src/components/ops/OpsClockControlSheet.tsx src/components/ops/index.ts src/components/ops/__tests__/OpsClockStrip.test.tsx
git commit -m "feat(ops): 상시 클럭 스트립 + 제어 시트 추가"
```

---

### Task 4: `OpsStatusTab` — 현황 탭 콘텐츠 추출(클럭 제외)

**Files:**
- Create: `src/components/ops/OpsStatusTab.tsx`
- Modify: `src/components/ops/index.ts`
- Test: `src/components/ops/__tests__/OpsStatusTab.test.tsx`

**Interfaces:**
- Consumes: `useToggleRegistration`, `useSetTournamentStatus` from `@/hooks/ops`; `LiveStatsPanel`, `MonitorLinkButton`, `MonitorConfigCard`, `TournamentResultCard`.
- Produces: `OpsStatusTab({ tournament: OpsTournament })`.

이 태스크는 현재 `[id].tsx:118-179`의 status 탭 JSX를 **클럭(`ClockControl`)만 빼고** 옮긴다(클럭은 이제 상시 스트립).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/components/ops/__tests__/OpsStatusTab.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { useToggleRegistration, useSetTournamentStatus } from '@/hooks/ops';
import { OpsStatusTab } from '../OpsStatusTab';

jest.mock('@/hooks/ops', () => ({
  useToggleRegistration: jest.fn(() => ({ mutate: jest.fn() })),
  useSetTournamentStatus: jest.fn(() => ({ mutate: jest.fn() })),
}));
jest.mock('../LiveStatsPanel', () => ({ LiveStatsPanel: () => null }));
jest.mock('../MonitorLinkButton', () => ({ MonitorLinkButton: () => null }));
jest.mock('../MonitorConfigCard', () => ({ MonitorConfigCard: () => null }));
jest.mock('../TournamentResultCard', () => ({ TournamentResultCard: () => require('react-native').Text({ children: '결과카드' }) }));

const base = { id: 't1', name: 'T', status: 'active', registrationOpen: true, monitorToken: 'm', monitorConfig: null } as any;

describe('OpsStatusTab', () => {
  it('진행 중: 등록 토글 노출(클럭 없음)', () => {
    const { getByText, queryByText } = render(<OpsStatusTab tournament={base} />);
    expect(getByText(/등록/)).toBeTruthy();
    expect(queryByText('결과카드')).toBeNull();
  });

  it('완료: 결과카드 노출 + 등록 토글 숨김(H7)', () => {
    const { getByText, queryByText } = render(
      <OpsStatusTab tournament={{ ...base, status: 'completed' }} />
    );
    expect(getByText('결과카드')).toBeTruthy();
    expect(queryByText('열림 (마감하기)')).toBeNull();
  });

  it('등록 토글 탭 → toggleMut.mutate(반대값)', () => {
    const mutate = jest.fn();
    (useToggleRegistration as jest.Mock).mockReturnValue({ mutate });
    const { getByText } = render(<OpsStatusTab tournament={base} />);
    fireEvent.press(getByText('열림 (마감하기)'));
    expect(mutate).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/components/ops/__tests__/OpsStatusTab.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현(기존 status JSX 이전, 클럭 제거)**

```tsx
// src/components/ops/OpsStatusTab.tsx
/** 현황 탭(L2). 기존 [id].tsx status 탭에서 클럭을 뺀 나머지: 통계·등록토글·상태·모니터. */
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useToggleRegistration, useSetTournamentStatus } from '@/hooks/ops';
import { LiveStatsPanel } from './LiveStatsPanel';
import { MonitorLinkButton } from './MonitorLinkButton';
import { MonitorConfigCard } from './MonitorConfigCard';
import { TournamentResultCard } from './TournamentResultCard';
import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

interface OpsStatusTabProps {
  tournament: OpsTournament;
}

export function OpsStatusTab({ tournament }: OpsStatusTabProps) {
  const tournamentId = tournament.id;
  const toggleMut = useToggleRegistration(tournamentId);
  const statusMut = useSetTournamentStatus(tournamentId);
  const isCompleted = tournament.status === 'completed';

  const nextStatusActions: { label: string; to: OpsTournamentStatus }[] =
    tournament.status === 'upcoming'
      ? [{ label: '대회 시작', to: 'active' }]
      : tournament.status === 'active'
        ? [{ label: '대회 종료', to: 'completed' }]
        : [];

  return (
    <ScrollView
      className="flex-1 px-3"
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {isCompleted && (
        <View className="mb-2">
          <TournamentResultCard tournament={tournament} />
        </View>
      )}

      <LiveStatsPanel tournamentId={tournamentId} />
      <MonitorLinkButton tournamentId={tournamentId} monitorToken={tournament.monitorToken} />
      <MonitorConfigCard tournamentId={tournamentId} monitorConfig={tournament.monitorConfig} />

      {!isCompleted && (
        <View className="mx-1 mt-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <Text className="text-content-primary dark:text-off-white">등록(SUBSCRIPTIONS)</Text>
          <Pressable
            onPress={() => toggleMut.mutate(!tournament.registrationOpen)}
            accessibilityRole="button"
            className={`rounded-md px-3 py-1.5 active:opacity-70 ${tournament.registrationOpen ? 'bg-green-600' : 'bg-gray-400 dark:bg-gray-600'}`}
          >
            <Text className="font-sans-semibold text-sm text-white">
              {tournament.registrationOpen ? '열림 (마감하기)' : '마감 (열기)'}
            </Text>
          </Pressable>
        </View>
      )}

      <View className="mx-1 mt-2 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <Text className="text-content-primary dark:text-off-white">상태: {tournament.status}</Text>
        <View className="flex-row gap-2">
          {nextStatusActions.map((a) => (
            <Pressable
              key={a.to}
              onPress={() => statusMut.mutate(a.to)}
              accessibilityRole="button"
              className="rounded-md bg-primary-600 px-3 py-1.5 active:opacity-70"
            >
              <Text className="font-sans-semibold text-sm text-white">{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 4: 배럴 등록**

```ts
export { OpsStatusTab } from './OpsStatusTab';
```

- [ ] **Step 5: 통과 확인**

Run: `npx jest src/components/ops/__tests__/OpsStatusTab.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ops/OpsStatusTab.tsx src/components/ops/index.ts src/components/ops/__tests__/OpsStatusTab.test.tsx
git commit -m "feat(ops): 현황 탭 콘텐츠 추출(OpsStatusTab, 클럭 분리)"
```

---

### Task 5: `OpsConsoleShell` — 반응형 셸(탭바·⋯·FAB·사이드바)

**Files:**
- Create: `src/components/ops/OpsConsoleShell.tsx`
- Modify: `src/components/ops/index.ts`
- Test: `src/components/ops/__tests__/OpsConsoleShell.test.tsx`

**Interfaces:**
- Consumes: `useOpsConsoleLayout()` (Task 1), `OpsClockStrip` (Task 3), `OpsSummaryStrip` (Task 2).
- Produces: `OpsConsoleShell` — 아래 props. 활성 탭 콘텐츠는 `children`이 아니라 `renderTab(tabKey)` 콜백으로 주입(부모가 탭별 컴포넌트 매핑).

```ts
export type OpsTabKey = 'status' | 'tables' | 'players' | 'levels' | 'staff' | 'payouts' | 'history';
interface OpsConsoleShellProps {
  tournamentId: string;
  isCompleted: boolean;
  playersCount: number;
  staffCount: number;
  activeTab: OpsTabKey;
  onTabChange: (t: OpsTabKey) => void;
  renderTab: (t: OpsTabKey) => React.ReactNode;
  fab?: React.ReactNode;
}
```

- 폰 상시 탭 = `['status','tables','players','levels','staff']`, 오버플로 = `['payouts','history']`(헤더 ⋯ 메뉴, `showAlert`/`SelectBottomSheet`로 선택).
- 태블릿(`isWide`) = 7탭 전부 한 줄 + 좌측 사이드바(클럭/요약 세로).
- 탭 라벨: status='현황' tables='테이블' players=`참가 ${playersCount}` levels='블라인드' staff=`스태프 ${staffCount}` payouts='상금' history='이력'.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// src/components/ops/__tests__/OpsConsoleShell.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useOpsConsoleLayout } from '@/hooks/ops';
import { OpsConsoleShell } from '../OpsConsoleShell';

jest.mock('@/hooks/ops', () => ({ useOpsConsoleLayout: jest.fn() }));
jest.mock('../OpsClockStrip', () => ({ OpsClockStrip: () => require('react-native').Text({ children: 'CLOCK' }) }));
jest.mock('../OpsSummaryStrip', () => ({ OpsSummaryStrip: () => require('react-native').Text({ children: 'SUMMARY' }) }));

const baseProps = {
  tournamentId: 't1', isCompleted: false, playersCount: 57, staffCount: 4,
  activeTab: 'status' as const, onTabChange: jest.fn(),
  renderTab: (t: string) => <Text>TAB:{t}</Text>, fab: <Text>FAB</Text>,
};

describe('OpsConsoleShell', () => {
  it('폰: 5탭 상시 노출 + 클럭/요약 스트립', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: false, width: 390 });
    const { getByText, queryByText } = render(<OpsConsoleShell {...baseProps} />);
    expect(getByText('CLOCK')).toBeTruthy();
    expect(getByText('SUMMARY')).toBeTruthy();
    expect(getByText('현황')).toBeTruthy();
    expect(getByText('참가 57')).toBeTruthy();
    // 상금/이력은 상시 탭바에 없음(⋯ 오버플로)
    expect(queryByText('상금')).toBeNull();
  });

  it('폰: 탭 누르면 onTabChange', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: false, width: 390 });
    const onTabChange = jest.fn();
    const { getByText } = render(<OpsConsoleShell {...baseProps} onTabChange={onTabChange} />);
    fireEvent.press(getByText('테이블'));
    expect(onTabChange).toHaveBeenCalledWith('tables');
  });

  it('태블릿: 7탭 전부 노출', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: true, width: 834 });
    const { getByText } = render(<OpsConsoleShell {...baseProps} />);
    expect(getByText('상금')).toBeTruthy();
    expect(getByText('이력')).toBeTruthy();
  });

  it('활성 탭 콘텐츠 렌더', () => {
    (useOpsConsoleLayout as jest.Mock).mockReturnValue({ isWide: false, width: 390 });
    const { getByText } = render(<OpsConsoleShell {...baseProps} activeTab="players" />);
    expect(getByText('TAB:players')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/components/ops/__tests__/OpsConsoleShell.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```tsx
// src/components/ops/OpsConsoleShell.tsx
/** ops 운영 콘솔 반응형 셸(L1·L3·L4). 폰=상단 스트립+5탭+⋯, 태블릿=좌측 사이드바+7탭. */
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SelectBottomSheet } from '@/components/ui';
import { useOpsConsoleLayout } from '@/hooks/ops';
import { OpsClockStrip } from './OpsClockStrip';
import { OpsSummaryStrip } from './OpsSummaryStrip';

export type OpsTabKey =
  | 'status' | 'tables' | 'players' | 'levels' | 'staff' | 'payouts' | 'history';

interface OpsConsoleShellProps {
  tournamentId: string;
  isCompleted: boolean;
  playersCount: number;
  staffCount: number;
  activeTab: OpsTabKey;
  onTabChange: (t: OpsTabKey) => void;
  renderTab: (t: OpsTabKey) => React.ReactNode;
  fab?: React.ReactNode;
}

const PHONE_TABS: OpsTabKey[] = ['status', 'tables', 'players', 'levels', 'staff'];
const OVERFLOW_TABS: OpsTabKey[] = ['payouts', 'history'];
const ALL_TABS: OpsTabKey[] = [...PHONE_TABS, ...OVERFLOW_TABS];

function labelOf(t: OpsTabKey, players: number, staff: number): string {
  switch (t) {
    case 'status': return '현황';
    case 'tables': return '테이블';
    case 'players': return `참가 ${players}`;
    case 'levels': return '블라인드';
    case 'staff': return `스태프 ${staff}`;
    case 'payouts': return '상금';
    case 'history': return '이력';
  }
}

export function OpsConsoleShell({
  tournamentId, isCompleted, playersCount, staffCount,
  activeTab, onTabChange, renderTab, fab,
}: OpsConsoleShellProps) {
  const { isWide } = useOpsConsoleLayout();

  const overflowOptions = useMemo(
    () => OVERFLOW_TABS.map((t) => ({ label: labelOf(t, playersCount, staffCount), value: t })),
    [playersCount, staffCount]
  );

  const Tab = ({ t, dim }: { t: OpsTabKey; dim?: boolean }) => (
    <Pressable
      onPress={() => onTabChange(t)}
      accessibilityRole="button"
      className={`flex-1 items-center rounded-md py-2 ${activeTab === t ? 'bg-white dark:bg-gray-700' : ''}`}
    >
      <Text
        numberOfLines={1}
        className={`text-xs ${activeTab === t ? 'font-sans-semibold text-content-primary' : dim ? 'text-secondary-400 dark:text-secondary-600' : 'text-secondary-500 dark:text-secondary-400'}`}
      >
        {labelOf(t, playersCount, staffCount)}
      </Text>
    </Pressable>
  );

  // 태블릿: 좌측 사이드바(클럭/요약) + 우측 7탭
  if (isWide) {
    return (
      <View className="flex-1 flex-row">
        <View className="w-60 border-r border-gray-200 dark:border-gray-700">
          {!isCompleted && <OpsClockStrip tournamentId={tournamentId} onNavigateToLevels={() => onTabChange('levels')} />}
          <OpsSummaryStrip tournamentId={tournamentId} onPress={() => onTabChange('status')} />
        </View>
        <View className="flex-1">
          <View className="mx-3 mb-2 mt-2 flex-row rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {ALL_TABS.map((t) => (
              <Tab key={t} t={t} dim={OVERFLOW_TABS.includes(t)} />
            ))}
          </View>
          <View className="flex-1">{renderTab(activeTab)}</View>
          {fab}
        </View>
      </View>
    );
  }

  // 폰: 상단 스트립 + 5탭 + ⋯
  const isOverflowActive = OVERFLOW_TABS.includes(activeTab);
  return (
    <View className="flex-1">
      {!isCompleted && <OpsClockStrip tournamentId={tournamentId} onNavigateToLevels={() => onTabChange('levels')} />}
      <OpsSummaryStrip tournamentId={tournamentId} onPress={() => onTabChange('status')} />
      <View className="mx-4 mb-2 mt-1 flex-row items-center rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {PHONE_TABS.map((t) => (
          <Tab key={t} t={t} />
        ))}
        <SelectBottomSheet
          trigger={
            <View className={`items-center rounded-md px-2 py-2 ${isOverflowActive ? 'bg-white dark:bg-gray-700' : ''}`}>
              <Text className={`text-base ${isOverflowActive ? 'text-gold' : 'text-secondary-500 dark:text-secondary-400'}`}>⋯</Text>
            </View>
          }
          title="더 보기"
          options={overflowOptions}
          onSelect={(v) => onTabChange(v as OpsTabKey)}
        />
      </View>
      <View className="flex-1">{renderTab(activeTab)}</View>
      {fab}
    </View>
  );
}
```

> 주의: `SelectBottomSheet`의 실제 API(`trigger`/`options`/`onSelect` vs `value`/`onValueChange`)를 `src/components/ui`에서 확인하고 맞춘다. `trigger` 패턴이 없으면 `⋯` Pressable + 별도 `visible` state로 여는 형태로 조정.

- [ ] **Step 4: 배럴 등록**

```ts
export { OpsConsoleShell, type OpsTabKey } from './OpsConsoleShell';
```

- [ ] **Step 5: 통과 확인**

Run: `npx jest src/components/ops/__tests__/OpsConsoleShell.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/components/ops/OpsConsoleShell.tsx src/components/ops/index.ts src/components/ops/__tests__/OpsConsoleShell.test.tsx
git commit -m "feat(ops): 반응형 콘솔 셸(폰 5탭+⋯ / 태블릿 사이드바 7탭)"
```

---

### Task 6: `[id].tsx` 셸 채택 — 기본 현황 + 탭 매핑

**Files:**
- Modify: `app/(ops)/tournaments/[id].tsx` (전면 축소)
- Test: `app/(ops)/tournaments/__tests__/OpsTournamentDetailScreen.test.tsx` (신규 or 기존 확장)

**Interfaces:**
- Consumes: `OpsConsoleShell`, `OpsStatusTab`, 기존 탭 컴포넌트들, `useOpsTournament`·`useOpsParticipants`·`useOpsStaff`.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// app/(ops)/tournaments/__tests__/OpsTournamentDetailScreen.test.tsx
import { render } from '@testing-library/react-native';
import { useOpsTournament, useOpsParticipants, useOpsStaff } from '@/hooks/ops';
import OpsTournamentDetailScreen from '../[id]';

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 't1' }) }));
jest.mock('@/hooks/ops', () => ({
  useOpsTournament: jest.fn(),
  useOpsParticipants: jest.fn(() => ({ participants: [], isLoading: false })),
  useOpsStaff: jest.fn(() => ({ data: [] })),
}));
// 셸은 렌더 확인만 — 활성 탭 라벨 스텁
jest.mock('@/components/ops', () => ({
  OpsConsoleShell: ({ activeTab }: { activeTab: string }) =>
    require('react-native').Text({ children: `SHELL:${activeTab}` }),
  OpsStatusTab: () => null, PlayersTab: () => null, TablesTab: () => null,
  BlindLevelsTab: () => null, StaffTab: () => null, HistoryTab: () => null, PayoutsTab: () => null,
}));

describe('OpsTournamentDetailScreen', () => {
  it('기본 진입 탭 = status(현황)', () => {
    (useOpsTournament as jest.Mock).mockReturnValue({
      tournament: { id: 't1', name: 'T', status: 'active' }, isLoading: false,
    });
    const { getByText } = render(<OpsTournamentDetailScreen />);
    expect(getByText('SHELL:status')).toBeTruthy();
  });

  it('대회 없음 → 접근 안내', () => {
    (useOpsTournament as jest.Mock).mockReturnValue({ tournament: null, isLoading: false });
    const { getByText } = render(<OpsTournamentDetailScreen />);
    expect(getByText(/접근 권한/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest "app/(ops)/tournaments/__tests__/OpsTournamentDetailScreen.test.tsx"`
Expected: FAIL — 기본 탭이 아직 'players'

- [ ] **Step 3: `[id].tsx` 재작성**

```tsx
// app/(ops)/tournaments/[id].tsx
/** ops 대회 상세 — OpsConsoleShell 반응형 셸. 기본 진입 = 현황(L2). RLS 단일 진실. */
import { useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import {
  OpsConsoleShell, type OpsTabKey, OpsStatusTab,
  PlayersTab, TablesTab, BlindLevelsTab, StaffTab, HistoryTab, PayoutsTab,
} from '@/components/ops';
import { useOpsTournament, useOpsParticipants, useOpsStaff } from '@/hooks/ops';

export default function OpsTournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = id ?? '';
  const { tournament, isLoading } = useOpsTournament(tournamentId);
  const { participants, isLoading: participantsLoading } = useOpsParticipants(tournamentId);
  const { data: staffRoster } = useOpsStaff(tournamentId);
  const [tab, setTab] = useState<OpsTabKey>('status');

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-page dark:bg-surface">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="대회" fallbackHref="/(ops)/tournaments" />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-secondary-500 dark:text-secondary-400">
            대회를 찾을 수 없거나 접근 권한이 없습니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderTab = (t: OpsTabKey) => {
    switch (t) {
      case 'status': return <OpsStatusTab tournament={tournament} />;
      case 'players': return <PlayersTab tournament={tournament} participants={participants} isLoading={participantsLoading} />;
      case 'tables': return <TablesTab tournamentId={tournamentId} />;
      case 'levels': return <BlindLevelsTab tournamentId={tournamentId} />;
      case 'staff': return <StaffTab tournamentId={tournamentId} tournament={tournament} />;
      case 'history': return <HistoryTab tournamentId={tournamentId} />;
      case 'payouts': return <PayoutsTab tournament={tournament} />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title={tournament.name} fallbackHref="/(ops)/tournaments" />
      <OpsConsoleShell
        tournamentId={tournamentId}
        isCompleted={tournament.status === 'completed'}
        playersCount={participants.length}
        staffCount={staffRoster?.length ?? 0}
        activeTab={tab}
        onTabChange={setTab}
        renderTab={renderTab}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx jest "app/(ops)/tournaments/__tests__/OpsTournamentDetailScreen.test.tsx"`
Expected: PASS (2 tests)

- [ ] **Step 5: 전체 타입/린트**

Run: `npm run quality`
Expected: exit 0 (0 errors)

- [ ] **Step 6: 커밋**

```bash
git add "app/(ops)/tournaments/[id].tsx" "app/(ops)/tournaments/__tests__/OpsTournamentDetailScreen.test.tsx"
git commit -m "feat(ops): 대회 상세를 반응형 셸로 전환(기본 현황 진입)"
```

---

### Task 7: `OpsParticipantActionSheet` — 참가·좌석 공용 액션시트(L5·L6)

**Files:**
- Create: `src/components/ops/OpsParticipantActionSheet.tsx`
- Modify: `src/components/ops/PlayersTab.tsx` (행 인라인 버튼 → 시트 트리거)
- Modify: `src/components/ops/TablesTab.tsx` (좌석 탭 → 시트 open)
- Modify: `src/components/ops/index.ts`
- Test: `src/components/ops/__tests__/OpsParticipantActionSheet.test.tsx`

**Interfaces:**
- Consumes: `useAddRebuy`, `useAddAddon`, `useBustParticipant`, `useReenterParticipant`, `useUndoBust`, `useMoveSeat`, `useFreeSeat` from `@/hooks/ops`.
- Produces:
  ```ts
  interface OpsParticipantActionSheetProps {
    tournament: OpsTournament;
    participant: OpsParticipant | null;   // null = 닫힘
    onClose: () => void;
    onOpenPayouts?: () => void;            // ITM bust 후 상금 화면 링크
  }
  ```
  액션시트는 status별 액션 노출(active=리바이/애드온/자리이동/좌석비우기/탈락, busted=재진입/탈락취소). 탈락은 **하단 격리 구역(red)**.

> 이 태스크가 최대 리스크. 기존 PlayersTab의 `handleBustPress`(바운티=탈락자 지정 피커, 비바운티=confirmAction) 로직을 시트로 이관하되 **동작 등가**를 테스트로 고정한다.

- [ ] **Step 1: 실패 테스트 작성 (액션시트 단독)**

```tsx
// src/components/ops/__tests__/OpsParticipantActionSheet.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { useBustParticipant, useAddRebuy, useReenterParticipant } from '@/hooks/ops';
import { OpsParticipantActionSheet } from '../OpsParticipantActionSheet';

jest.mock('@/hooks/ops', () => ({
  useAddRebuy: jest.fn(() => ({ mutate: jest.fn() })),
  useAddAddon: jest.fn(() => ({ mutate: jest.fn() })),
  useBustParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useReenterParticipant: jest.fn(() => ({ mutate: jest.fn() })),
  useUndoBust: jest.fn(() => ({ mutate: jest.fn() })),
  useMoveSeat: jest.fn(() => ({ mutate: jest.fn() })),
  useFreeSeat: jest.fn(() => ({ mutate: jest.fn() })),
}));

const tournament = { id: 't1', status: 'active', bountyCost: null } as any;
const active = { id: 'p1', name: 'Shimizu', status: 'active', chips: 480000 } as any;
const busted = { id: 'p2', name: 'Hsieh', status: 'busted', finishPosition: 11 } as any;

describe('OpsParticipantActionSheet', () => {
  it('active: 리바이/애드온/탈락 노출, 탈락은 격리 구역', () => {
    const { getByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    expect(getByText('리바이')).toBeTruthy();
    expect(getByText('애드온')).toBeTruthy();
    expect(getByText('탈락 처리')).toBeTruthy();
  });

  it('비바운티 탈락 → confirmAction 경유 후 mutate', () => {
    const mutate = jest.fn();
    (useBustParticipant as jest.Mock).mockReturnValue({ mutate });
    // confirmAction 은 즉시 onConfirm 실행하도록 모킹
    jest.spyOn(require('@/utils/dialog'), 'confirmAction').mockImplementation((o: any) => o.onConfirm());
    const { getByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={active} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('탈락 처리'));
    expect(mutate).toHaveBeenCalledWith('p1');
  });

  it('busted: 재진입/탈락취소 노출(리바이 없음)', () => {
    const { getByText, queryByText } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={busted} onClose={jest.fn()} />
    );
    expect(getByText('재진입')).toBeTruthy();
    expect(getByText('탈락 취소')).toBeTruthy();
    expect(queryByText('리바이')).toBeNull();
  });

  it('participant=null 이면 아무것도 렌더 안 함', () => {
    const { toJSON } = render(
      <OpsParticipantActionSheet tournament={tournament} participant={null} onClose={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/components/ops/__tests__/OpsParticipantActionSheet.test.tsx`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 액션시트 구현**

`PlayersTab.tsx`의 현행 `handleBustPress`(바운티 분기·eliminator picker)와 각 mutate 호출을 이 컴포넌트로 이관. 아래는 골격 — 바운티 eliminator picker(`SelectBottomSheet`)는 기존 PlayersTab 구현(`:289-300`)을 그대로 옮긴다.

```tsx
// src/components/ops/OpsParticipantActionSheet.tsx
/** 참가자 액션시트(L5·L6). 참가 행·테이블 좌석 공용. 탈락은 하단 격리. */
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui';
import { confirmAction } from '@/utils/dialog';
import {
  useAddRebuy, useAddAddon, useBustParticipant,
  useReenterParticipant, useUndoBust, useFreeSeat,
} from '@/hooks/ops';
import type { OpsParticipant, OpsTournament } from '@/types/ops';

interface OpsParticipantActionSheetProps {
  tournament: OpsTournament;
  participant: OpsParticipant | null;
  onClose: () => void;
  onOpenPayouts?: () => void;
}

export function OpsParticipantActionSheet({
  tournament, participant, onClose, onOpenPayouts,
}: OpsParticipantActionSheetProps) {
  const tournamentId = tournament.id;
  const rebuyMut = useAddRebuy(tournamentId);
  const addonMut = useAddAddon(tournamentId);
  const bustMut = useBustParticipant(tournamentId);
  const reenterMut = useReenterParticipant(tournamentId);
  const undoMut = useUndoBust(tournamentId);
  const freeMut = useFreeSeat(tournamentId);

  if (!participant) return null;
  const p = participant;

  const handleBust = () => {
    // 비바운티: 확인 다이얼로그. (바운티: eliminator picker — PlayersTab 기존 로직 이관)
    confirmAction({
      title: '탈락 처리',
      message: `${p.name} 님을 탈락 처리할까요?`,
      confirmText: '탈락 처리',
      destructive: true,
      onConfirm: () => {
        bustMut.mutate(p.id);
        onClose();
      },
    });
  };

  const ActionBtn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-[44px] flex-1 items-center justify-center rounded-md bg-gray-100 active:opacity-70 dark:bg-gray-800"
    >
      <Text className="text-sm text-content-primary dark:text-off-white">{label}</Text>
    </Pressable>
  );

  return (
    <SheetModal visible={!!participant} onClose={onClose} title={`#${p.entryNumber ?? ''} ${p.name}`}>
      <View className="gap-2 p-2">
        {p.status === 'active' && (
          <>
            <View className="flex-row gap-2">
              <ActionBtn label="리바이" onPress={() => { rebuyMut.mutate(p.id); onClose(); }} />
              <ActionBtn label="애드온" onPress={() => { addonMut.mutate(p.id); onClose(); }} />
            </View>
            <View className="flex-row gap-2">
              <ActionBtn label="좌석 비우기" onPress={() => { freeMut.mutate(p.id); onClose(); }} />
            </View>
            {/* 파괴적 액션 격리 구역(L6) */}
            <View className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
              <Pressable
                onPress={handleBust}
                accessibilityRole="button"
                className="min-h-[44px] items-center justify-center rounded-md border border-error-500 active:opacity-70 dark:border-error-400"
              >
                <Text className="font-sans-semibold text-error-600 dark:text-error-400">탈락 처리</Text>
              </Pressable>
            </View>
          </>
        )}
        {p.status === 'busted' && (
          <View className="flex-row gap-2">
            <ActionBtn label="재진입" onPress={() => { reenterMut.mutate(p.id); onClose(); }} />
            <ActionBtn
              label="탈락 취소"
              onPress={() =>
                confirmAction({
                  title: '탈락 취소',
                  message: `${p.name} 님의 탈락을 취소할까요?\n칩과 좌석이 복원됩니다.`,
                  confirmText: '탈락 취소',
                  destructive: true,
                  onConfirm: () => { undoMut.mutate(p.id); onClose(); },
                })
              }
            />
          </View>
        )}
        {p.status === 'busted' && p.prizeAmount != null && onOpenPayouts && (
          <Pressable
            onPress={() => { onClose(); onOpenPayouts(); }}
            accessibilityRole="button"
            className="mt-1 items-center rounded-md border border-gold py-2 active:opacity-70"
          >
            <Text className="text-sm font-sans-semibold text-gold">상금 화면 보기 →</Text>
          </Pressable>
        )}
      </View>
    </SheetModal>
  );
}
```

> 주의: `confirmAction` 경로는 `@/utils/dialog` 여부를 확인(프로젝트에 따라 `@/utils/alert` 등). eliminator picker(바운티)·PlayerClaimButton 재배치는 PlayersTab에서 이관하며 기존 문구/인자 그대로 유지.

- [ ] **Step 4: 통과 확인 (시트 단독)**

Run: `npx jest src/components/ops/__tests__/OpsParticipantActionSheet.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: PlayersTab 배선 — 행 탭 → 시트**

`PlayersTab.tsx`에서 행 인라인 버튼(리바이/애드온/탈락/재진입/탈락취소)을 제거하고, 행을 `Pressable`로 감싸 `setSheetParticipant(item)` → `<OpsParticipantActionSheet participant={sheetParticipant} .../>` 렌더. 기존 PlayersTab 테스트(`PlayersTab.test.tsx` 있으면)의 행 액션 단언을 시트 경유로 갱신.

- [ ] **Step 6: TablesTab 배선 — 좌석 탭 → 시트**

`TablesTab.tsx`의 `onSeatPress(seat)`에서 `seat.participantId`가 있으면 해당 participant를 찾아 `setSheetParticipant`. moveMode 진행 중이면 기존 이동 로직 우선(등가 유지).

- [ ] **Step 7: 배럴 + 전체 검증**

```ts
export { OpsParticipantActionSheet } from './OpsParticipantActionSheet';
```

Run: `npx jest src/components/ops/__tests__/ && npm run quality`
Expected: 관련 스위트 PASS, quality exit 0

- [ ] **Step 8: 커밋**

```bash
git add src/components/ops/OpsParticipantActionSheet.tsx src/components/ops/PlayersTab.tsx src/components/ops/TablesTab.tsx src/components/ops/index.ts src/components/ops/__tests__/OpsParticipantActionSheet.test.tsx
git commit -m "feat(ops): 참가·좌석 공용 액션시트 통합(탈락 격리·ITM 상금 링크)"
```

---

## Self-Review 결과 (작성자 점검)

- **Spec 커버리지**: L1(클럭 스트립 T3·요약 T2)·L2(기본 현황 T6)·L3(5탭+⋯ T5)·L4(태블릿 사이드바 T5)·L5(공용 액션시트 T7)·L6(탈락 격리 T7)·L7(FAB 등록 — PlayersTab 기존 FAB 유지, 셸 `fab` 슬롯)·L8(600 분기 T1) 전부 태스크 존재.
- **미커버 주의**: L7의 FAB '등록'은 기존 PlayersTab 내부 등록 폼/FAB를 그대로 두고 셸 `fab` 슬롯은 옵션으로 남김 — 현행 인라인 등록 흐름을 유지하되, 인라인 폼이 리스트를 밀지 않도록 시트화하는 개선은 **후속**(스펙 L7의 "인라인→시트"는 별도 소규모 태스크로 분리 가능). 실행 시 PlayersTab 등록 UI 확인 후 결정.
- **타입 일관성**: `OpsTabKey`(T5 정의)를 T6에서 동일 import. `OpsParticipantActionSheetProps`의 `participant: OpsParticipant | null` 일관.
- **불확실 지점(실행 시 코드 확인 필수)**: `SheetModal`/`SelectBottomSheet` 실제 props, `confirmAction` import 경로, `useOpsClock`의 `currentLevel`/`remainingSec` 필드명, `averageStackBb` 존재 여부. 각 태스크에 주의 노트로 명시.

## 실행 순서 의존성

T1 → T2 → T3 → T4 → T5(T1~T3 소비) → T6(T5·T4 소비) → T7(독립성 높음, T6 후 배선). T1~T4는 상호 독립이라 병렬 가능.
