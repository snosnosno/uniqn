# 근무표 반복 배치 액션 제거 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 근무표(주간 배치 그리드)에서 "일정이 반복된다"고 가정한 도구 3종(지난주 복사 · 출근 확인 요청 · 이번 달 같은 요일 전체 적용)과 진입 라벨의 시점 표현을 제거하고, 그로 인해 죽는 코드를 연쇄 정리한다.

**Architecture:** 순수 삭제 작업. 새 추상화·리팩터링 없음. 상위(화면) → 하위(컴포넌트) → 라벨 → 죽은 심볼 순으로 소비처를 먼저 끊고 마지막에 정의를 지운다. 레포지토리 계층(`weeklyGridRepository.setVenueSoftTarget`, `workLogRepository.getByVenueSpanInRange`, `jobPostingRepository.getVenueContainerById`)은 **무변경** — 셋 다 삭제 대상 밖 소비처(단건 저장 / 정산 조회 / `useGridSummary`)를 그대로 갖고 있음을 grep으로 실측했다.

**Tech Stack:** Expo 55 / React Native 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / TanStack Query / Jest + @testing-library/react-native / knip

**설계 문서:** `docs/superpowers/specs/2026-07-22-grid-remove-repeat-actions-design.md`

## Global Constraints

- 작업 디렉토리: `uniqn-mobile/`. 워크트리 `C:\Users\user\Desktop\T-HOLDEM-grid`, 브랜치 `refactor/grid-remove-repeat-actions`.
- 모든 주석·커밋 메시지·문서는 **한글**.
- 커밋 형식: `<type>(<scope>): <한글 설명>` — 이 작업은 전부 `refactor(grid):` 또는 `test(grid):`.
- 경로는 `@/` 절대 경로 (시스템 절대 경로 금지).
- **보존(절대 건드리지 말 것)** — 설계 §3 비목표:
  - `weeklyGrid/` 디렉토리명, `weekly_grid_enabled` 플래그, `/employer/weekly-grid` 라우트 (플래그 prod ON — 이름 바꾸면 화면이 꺼진다)
  - `src/utils/deepLinkRouteParser.ts`의 `weekly-grid` 케이스 (기기에 이미 도착한 알림의 착지 경로)
  - 하루 단위 "필요 인원" 단건 입력·저장 경로 (`useSetVenueSoftTarget`, `gridWriteService.setVenueSoftTarget`, `weeklyGridRepository.setVenueSoftTarget`)
  - `src/utils/confirmAction.ts` 자체 (다른 화면들이 쓴다 — VenueDayPanel의 **import 만** 제거)
- **레포지토리 계층 무변경.** `src/repositories/**` 파일은 이 계획에서 단 한 줄도 수정하지 않는다.
- knip 래칫 기준선: 이 브랜치 시작 시점 실측 **2200** (`npx knip --reporter json` 집계). `package.json`의 `knip:gate`가 `--max-issues=2200`. Task 4에서 새 실측치로 낮춘다.

---

## File Structure

**수정:**
- `app/(employer)/weekly-grid.tsx` — 상단 액션 행 + 두 핸들러 + 관련 import 제거 (Task 1)
- `src/components/weeklyGrid/VenueDayPanel.tsx` — 요일 반복 체크박스 + 벌크 분기 제거 (Task 2)
- `app/(app)/(tabs)/employer.tsx:362` — 라벨 문자열 (Task 3)
- `src/services/weeklyGrid/gridWriteService.ts` — `setVenueSoftTargetBulk` 함수만 제거, 파일 유지 (Task 4)
- `src/hooks/weeklyGrid/index.ts`, `src/domains/weeklyGrid/index.ts` — barrel export 정리 (Task 4)
- `package.json` — `knip:gate` 임계값 (Task 4)

**신규:**
- `app/(employer)/__tests__/weekly-grid.actions-removed.test.tsx` — 액션 행 미존재 회귀 가드 (Task 1)

**전면 재작성:**
- `src/components/weeklyGrid/__tests__/VenueDayPanel.test.tsx` — 벌크 분기 검증 → 단건 저장 단일 경로 검증 (Task 2)

**삭제(Task 4):**
| 파일 | 동반 테스트 |
|---|---|
| `src/hooks/weeklyGrid/useCopyLastWeek.ts` | (없음) |
| `src/services/weeklyGrid/copyLastWeekService.ts` | `src/services/weeklyGrid/__tests__/copyLastWeekService.test.ts` |
| `src/domains/weeklyGrid/copyLastWeek.ts` | `src/domains/weeklyGrid/__tests__/copyLastWeek.test.ts` |
| `src/hooks/weeklyGrid/useNotifyWeeklyBatchConfirm.ts` | (없음) |
| `src/services/weeklyGrid/weeklyBatchNotificationService.ts` | `src/services/weeklyGrid/__tests__/weeklyBatchNotificationService.test.ts` |
| `src/domains/weeklyGrid/weeklyBatchNotification.ts` | `src/domains/weeklyGrid/__tests__/weeklyBatchNotification.test.ts` |
| `src/domains/weeklyGrid/weekRange.ts` | `src/domains/weeklyGrid/__tests__/weekRange.test.ts` |
| `src/hooks/weeklyGrid/useSetVenueSoftTargetBulk.ts` | `src/hooks/weeklyGrid/__tests__/useSetVenueSoftTargetBulk.test.tsx` |
| `src/domains/weeklyGrid/weekdayDates.ts` | `src/domains/weeklyGrid/__tests__/weekdayDates.test.ts` |
| (함수만) `gridWriteService.setVenueSoftTargetBulk` | `src/services/weeklyGrid/__tests__/gridWriteService.test.ts` (전체 — 이 파일은 벌크만 검증한다) |

---

## Task 1: 상단 액션 행 제거 (Slice 1)

**Files:**
- Test: `app/(employer)/__tests__/weekly-grid.actions-removed.test.tsx` (신규 — 디렉토리도 신규)
- Modify: `app/(employer)/weekly-grid.tsx` (import `:29`, `:34-36`, `:49-50`, `:53`, `:55`; 핸들러 `:142-152`, `:167-204`; JSX `:317-352`)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `weekly-grid.tsx`가 더 이상 `useCopyLastWeek` / `useNotifyWeeklyBatchConfirm` / `getWeekRange` / `useToastStore` / `Button` / `CopyIcon` / `BellIcon`을 참조하지 않는 상태. Task 4가 이 심볼들의 정의를 지울 수 있게 된다.

**배경:** 이 화면에는 지금까지 스크린 레벨 테스트가 없었다. 신규 테스트는 `app/(app)/settings/__tests__/settings.collab-removed.test.tsx`의 "제거 회귀 가드" 패턴을 그대로 따른다 — 대조군 단언(화면이 실제로 렌더됐다는 증거) + 제거 단언.

- [ ] **Step 1: 실패하는 테스트 작성**

디렉토리를 만들고 파일을 생성한다:

```bash
mkdir -p "app/(employer)/__tests__"
```

`app/(employer)/__tests__/weekly-grid.actions-removed.test.tsx`:

```tsx
/**
 * 근무표 화면 — 반복 전제 상단 액션 행 제거 회귀 가드
 *
 * "지난주 복사"·"출근 확인 요청"은 일정이 주 단위로 반복된다는 가정 위에 서 있던 벌크 수단이다.
 * 사장의 실제 패턴(매번 필요 인원이 다름)과 어긋나 제거했고, 이 테스트는 재유입을 막는다.
 * 대조군(월 네비게이션)을 함께 단언해 "화면이 안 그려져서 통과"하는 vacuous green 을 배제한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import WeeklyGridScreen from '../weekly-grid';

// 전역 setup 의 @tanstack/react-query 목은 requireActual 확산이라 useQueryClient 가 실물이다
// (QueryClientProvider 없으면 throw). 이 화면은 useQueryClient 만 쓰므로 파일 목으로 대체한다.
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// 무거운 자식들은 전부 null — 이 테스트의 관심사는 화면 자신이 그리는 액션 행뿐이다.
jest.mock('@/components/headers', () => ({ StackHeader: () => null }));
jest.mock('@/components/jobs/DateCalendar/CalendarGrid', () => ({ CalendarGrid: () => null }));
jest.mock('@/components/weeklyGrid', () => ({
  VenueSelector: () => null,
  VenueDayPanel: () => null,
  VenueCreateSheet: () => null,
  GridBadgeLegend: () => null,
}));
jest.mock('@/components/ui', () => ({
  Loading: () => null,
  EmptyState: () => null,
  ErrorState: () => null,
}));
jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
  ChevronRightIcon: () => null,
  MapPinIcon: () => null,
  CopyIcon: () => null,
  BellIcon: () => null,
}));

// 플래그 ON — OFF 면 Redirect 로 화면이 통째로 사라져 단언이 vacuous 해진다.
jest.mock('@/hooks', () => ({
  useWeeklyGridEnabled: () => ({ enabled: true, isLoading: false }),
}));

jest.mock('@/hooks/workspace', () => ({
  useActiveWorkspace: () => ({
    workspaces: [{ id: 'ws-1', name: '팀' }],
    activeWorkspace: { id: 'ws-1', name: '팀' },
    setActiveWorkspaceId: jest.fn(),
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useEnsureDefaultWorkspace: () => ({ isCreating: false, retry: jest.fn() }),
}));

// 운영처 1개 + 요약 성공 → hasVenue=true 경로(ScrollView 본문)가 렌더된다.
jest.mock('@/hooks/weeklyGrid', () => ({
  useVenueContainers: () => ({ data: [{ id: 'v1', name: '지점' }], isLoading: false, isSuccess: true }),
  useGridSummary: () => ({
    data: {},
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useEnsureDefaultVenue: () => ({ isCreating: false }),
  // 제거 전 코드가 호출하는 두 변이 훅 — 이게 없으면 RED 가 "크래시로 인한 실패"가 돼 무의미해진다.
  useCopyLastWeek: () => ({ mutate: jest.fn(), isPending: false }),
  useNotifyWeeklyBatchConfirm: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

describe('근무표 화면 — 반복 전제 액션 행 제거', () => {
  it('지난주 복사·출근 확인 요청 버튼과 "대상 주" 표기가 렌더되지 않는다', () => {
    const { queryByText, queryByLabelText } = render(<WeeklyGridScreen />);

    // 대조군 — 화면 본문이 실제로 렌더됐다는 증거(월 네비게이션은 그대로 남는다).
    expect(queryByLabelText('이전 달')).not.toBeNull();
    expect(queryByLabelText('다음 달')).not.toBeNull();

    // 핵심 단언 — 반복 전제 액션 3요소(버튼 2개 + 대상 주 라벨)가 사라져야 한다.
    expect(queryByText('지난주 복사')).toBeNull();
    expect(queryByText('출근 확인 요청')).toBeNull();
    expect(queryByLabelText('지난주 배치를 이번 주로 복사')).toBeNull();
    expect(queryByLabelText('이번 주 출근 확인 요청 보내기')).toBeNull();
    expect(queryByText(/대상 주/)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인**

Run: `cd uniqn-mobile && npx jest "app/(employer)/__tests__/weekly-grid.actions-removed.test.tsx"`

Expected: FAIL — 대조군 2건은 통과하고, `expect(queryByText('지난주 복사')).toBeNull()` 부터 `Expected: null / Received: <Text ...>` 로 깨진다.
(만약 대조군에서 먼저 깨지면 목 설정 문제다. 화면이 안 그려진 상태의 "제거 통과"는 vacuous 이므로 **반드시** 대조군을 먼저 초록으로 만든 뒤 진행할 것.)

- [ ] **Step 3: JSX 액션 행 블록 제거**

`app/(employer)/weekly-grid.tsx`에서 아래 블록(월 네비게이션 `</View>` 직후 ~ 월 그리드 주석 직전)을 통째로 삭제한다:

```tsx
          {/* P5: 주간 배치 액션 — 지난주 복사 / 이번 주 배치 확인 알림(플래그 뒤라 OFF면 미노출) */}
          <View className="border-b border-divider px-4 py-2">
            {/* P0-4: 두 액션이 어느 주를 대상으로 하는지 상시 표기(weekRange SSOT) */}
            <Text
              className="mb-1 text-xs text-content-secondary font-sans"
              accessibilityLabel={`주간 액션 대상 주 ${weekRange.rangeLabel}`}
            >
              대상 주 · {weekRange.rangeLabel}
            </Text>
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onPress={handleCopyLastWeek}
                loading={copyLastWeek.isPending}
                disabled={copyLastWeek.isPending || notifyConfirm.isPending}
                icon={<CopyIcon size={16} color={SECONDARY_PALETTE[500]} />}
                className="flex-1"
                accessibilityLabel="지난주 배치를 이번 주로 복사"
              >
                지난주 복사
              </Button>
              <Button
                variant="outline"
                size="sm"
                onPress={handleNotifyConfirm}
                loading={notifyConfirm.isPending}
                disabled={copyLastWeek.isPending || notifyConfirm.isPending}
                icon={<BellIcon size={16} color={SECONDARY_PALETTE[500]} />}
                className="flex-1"
                accessibilityLabel="이번 주 출근 확인 요청 보내기"
              >
                출근 확인 요청
              </Button>
            </View>
          </View>
```

ScrollView 구조는 유지한다: 월 네비 → (여기 있던 블록 삭제) → 월 그리드 → 범례 → 요약 에러 → 날짜 패널.

- [ ] **Step 4: 핸들러와 훅 호출 제거**

같은 파일에서 `handleCopyLastWeek`(`:167-182`)와 `handleNotifyConfirm`(`:184-204`) `useCallback` 두 개를 통째로 삭제한다. 이어서 아래 블록:

```tsx
  // ── P5: 주간 배치 액션(지난주 복사 / 이번 주 배치 확인 알림) ──────────────────
  // 화면 전체가 weekly_grid_enabled 플래그 뒤(OFF면 Redirect)이므로 버튼도 플래그 OFF 시 미노출.
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);
  const toastInfo = useToastStore((s) => s.info);

  const copyLastWeek = useCopyLastWeek();
  const notifyConfirm = useNotifyWeeklyBatchConfirm();

  // 선택일이 속한 주(월~일) — 복사/알림/화면 표기가 공유하는 SSOT(P0-4).
  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);

  // 당겨서 새로고침 — 단일 ScrollView 전환(P1-3)으로 리스트 RefreshControl 이 사라진 것을 화면
```

을 아래로 교체한다 (당겨서 새로고침 주석과 그 아래 코드는 **남긴다**):

```tsx
  // 당겨서 새로고침 — 단일 ScrollView 전환(P1-3)으로 리스트 RefreshControl 이 사라진 것을 화면
```

- [ ] **Step 5: 죽은 import 제거**

같은 파일 상단에서 아래 4곳을 정리한다.

(1) `Button` import 줄 삭제 (`:29`):

```tsx
import { Button } from '@/components/ui/Button';
```

(2) 아이콘 import에서 `CopyIcon`·`BellIcon` 제거 — 아래를

```tsx
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  CopyIcon,
  BellIcon,
} from '@/components/icons';
```

이렇게:

```tsx
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from '@/components/icons';
```

(3) weeklyGrid 훅 import에서 두 변이 훅 제거 — 아래를

```tsx
import {
  useGridSummary,
  useVenueContainers,
  useCopyLastWeek,
  useNotifyWeeklyBatchConfirm,
  useEnsureDefaultVenue,
} from '@/hooks/weeklyGrid';
import { computeDayCell, getWeekRange, type GridDayCell } from '@/domains/weeklyGrid';
import { toDateString } from '@/utils/date';
import { useToastStore } from '@/stores/toastStore';
```

이렇게 (`getWeekRange`와 `useToastStore` import도 함께 제거, `toDateString`은 `densifyMonthCells`가 계속 쓰므로 유지):

```tsx
import { useGridSummary, useVenueContainers, useEnsureDefaultVenue } from '@/hooks/weeklyGrid';
import { computeDayCell, type GridDayCell } from '@/domains/weeklyGrid';
import { toDateString } from '@/utils/date';
```

(4) 파일 최상단 JSDoc은 그대로 둔다 — 화면의 역할 설명이지 삭제 대상 기능 설명이 아니다.

- [ ] **Step 6: 테스트 목에서 죽은 훅 제거**

이제 화면이 두 변이 훅을 호출하지 않으므로 테스트 목도 실물과 맞춘다. `weekly-grid.actions-removed.test.tsx`의 `@/hooks/weeklyGrid` 목에서 아래 3줄을 삭제한다:

```tsx
  // 제거 전 코드가 호출하는 두 변이 훅 — 이게 없으면 RED 가 "크래시로 인한 실패"가 돼 무의미해진다.
  useCopyLastWeek: () => ({ mutate: jest.fn(), isPending: false }),
  useNotifyWeeklyBatchConfirm: () => ({ mutate: jest.fn(), isPending: false }),
```

그리고 `@/stores/toastStore` 목 블록 전체도 삭제한다 (화면이 더 이상 토스트를 쓰지 않는다):

```tsx
jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest "app/(employer)/__tests__/weekly-grid.actions-removed.test.tsx"`

Expected: PASS — `Tests: 1 passed`.

- [ ] **Step 8: 타입 체크**

Run: `cd uniqn-mobile && npx tsc --noEmit`

Expected: exit 0, 출력 없음. (미사용 import를 남겼다면 여기서 잡힌다.)

- [ ] **Step 9: 커밋**

```bash
git add "uniqn-mobile/app/(employer)/weekly-grid.tsx" "uniqn-mobile/app/(employer)/__tests__/weekly-grid.actions-removed.test.tsx"
git commit -m "refactor(grid): 근무표 상단 반복 전제 액션 행 제거

지난주 복사·출근 확인 요청은 일정이 주 단위로 반복된다는 가정 위에 있었으나
사장의 실제 패턴(매번 필요 인원이 다름)과 어긋난다. 액션 행 제거로 월 달력
요일 헤더 겹침 증상도 함께 사라진다. 재유입 방지 회귀 가드 테스트 추가."
```

---

## Task 2: 요일 반복 체크박스 + 벌크 분기 제거 (Slice 2)

**Files:**
- Test: `src/components/weeklyGrid/__tests__/VenueDayPanel.test.tsx` (전면 재작성)
- Modify: `src/components/weeklyGrid/VenueDayPanel.tsx` (import `:18-19`, `:22`, `:31-32`, `:35-44`; state `:129`, `:132`; 핸들러 `:147-207`; JSX `:301`, `:308-316`)

**Interfaces:**
- Consumes: 없음 (Task 1과 독립 — 파일이 겹치지 않는다)
- Produces: `VenueDayPanel`이 `useSetVenueSoftTargetBulk` / `getSameWeekdayDatesInMonth`를 참조하지 않는 상태. `handleSaveTarget`은 단건 `setSoftTarget.mutate({ venueId, date, count })` 단일 경로.

- [ ] **Step 1: 실패하는 테스트 작성 (파일 전면 교체)**

`src/components/weeklyGrid/__tests__/VenueDayPanel.test.tsx` 전체를 아래 내용으로 덮어쓴다:

```tsx
/**
 * VenueDayPanel — 필요 인원 저장의 단일(단건) 경로 검증 + 요일 반복 제거 회귀 가드
 *
 * "이번 달 같은 요일 전체 적용"은 매주 같은 요일에 같은 인원이 필요하다는 가정 위에 있던
 * 벌크 수단이라 제거했다. 저장 경로는 이제 단건 하나뿐이다:
 *  - 저장 → useSetVenueSoftTarget(단건) 1회 호출, 확인 다이얼로그 없음.
 *  - 체크박스·벌크 훅 재유입 금지(회귀 가드).
 *  - 잘못된 입력은 저장 전에 에러 토스트로 차단.
 *
 * 변이/조회 훅과 자식 시트는 목(경로만 검증), Input/Button 은 실물로 두어 실제 사용자 입력
 * 경로(목표 입력·저장 탭)를 그대로 태운다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { VenueDayPanel } from '../VenueDayPanel';
import { useSetVenueSoftTarget, useVenueDaySlots } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';
import { confirmAction } from '@/utils/confirmAction';

// 변이/조회 훅 목(경로 검증용) — 이 컴포넌트가 쓰는 두 훅만 대체.
jest.mock('@/hooks/weeklyGrid', () => ({
  useSetVenueSoftTarget: jest.fn(),
  useVenueDaySlots: jest.fn(),
}));

jest.mock('@/stores/toastStore', () => ({ useToastStore: jest.fn() }));
jest.mock('@/stores/authStore', () => ({ useUser: jest.fn(() => ({ uid: 'u1' })) }));

// 확인 다이얼로그가 다시 배선되면 잡아내기 위한 목(호출 0 을 단언한다).
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));

// 자식 시트/상세는 이 테스트 관심 밖 — null 컴포넌트로 대체(무거운 의존 차단).
jest.mock('../VenueDayDetail', () => ({ VenueDayDetail: () => null }));
jest.mock('../AddSlotSheet', () => ({ AddSlotSheet: () => null }));
jest.mock('../EditSlotSheet', () => ({ EditSlotSheet: () => null }));

const mockUseSingle = useSetVenueSoftTarget as unknown as jest.Mock;
const mockUseDaySlots = useVenueDaySlots as unknown as jest.Mock;
const mockUseToast = useToastStore as unknown as jest.Mock;
const mockConfirmAction = confirmAction as unknown as jest.Mock;

// 테스트 간 참조 가능하도록 모듈 스코프 스파이 선언(useSetVenueSoftTarget.test.tsx 패턴).
const singleMutate = jest.fn();
const toastSuccessSpy = jest.fn();
const toastErrorSpy = jest.fn();

beforeEach(() => {
  singleMutate.mockReset();
  toastSuccessSpy.mockReset();
  toastErrorSpy.mockReset();
  mockConfirmAction.mockReset();

  mockUseSingle.mockReturnValue({ mutate: singleMutate, isPending: false });
  mockUseDaySlots.mockReturnValue({ data: [] });
  // 셀렉터(s) 가 success/error 를 꺼내므로 안정적인 스파이를 반환(VenueCreateSheet.test.tsx 패턴).
  mockUseToast.mockImplementation((sel: (s: object) => unknown) =>
    sel({ success: toastSuccessSpy, error: toastErrorSpy, info: jest.fn() })
  );
});

function renderPanel(date = '2026-07-05') {
  return render(<VenueDayPanel venueId="v1" date={date} dateLabel="7월 5일 (일)" />);
}

it('저장 시 단건 mutate 만 호출하고 확인 다이얼로그는 뜨지 않는다', () => {
  const { getByLabelText } = renderPanel();

  fireEvent.changeText(getByLabelText('이 날 필요 인원'), '5');
  fireEvent.press(getByLabelText('필요 인원 저장'));

  expect(singleMutate).toHaveBeenCalledTimes(1);
  // E5: write 경계에서 날짜키 정규화(toDateString) — venueId/date/count 매핑 검증.
  expect(singleMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', date: '2026-07-05', count: 5 });
  expect(mockConfirmAction).not.toHaveBeenCalled();
});

it('요일 반복 체크박스가 렌더되지 않는다(반복 전제 벌크 재유입 금지)', () => {
  const { queryByLabelText, queryByText, getByLabelText } = renderPanel();

  // 대조군 — 패널 본문이 실제로 렌더됐다는 증거.
  expect(getByLabelText('이 날 필요 인원')).not.toBeNull();

  expect(queryByLabelText('이번 달 같은 요일 전체 적용')).toBeNull();
  expect(queryByText('이번 달 같은 요일 전체 적용')).toBeNull();
});

it('상한(99) 초과 입력은 클램프된 값으로 저장한다', () => {
  const { getByLabelText } = renderPanel();

  fireEvent.changeText(getByLabelText('이 날 필요 인원'), '997');
  fireEvent.press(getByLabelText('필요 인원 저장'));

  expect(singleMutate).toHaveBeenCalledTimes(1);
  expect(singleMutate.mock.calls[0][0]).toEqual({ venueId: 'v1', date: '2026-07-05', count: 99 });
});
```

- [ ] **Step 2: 테스트를 실행해 실패를 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/VenueDayPanel.test.tsx`

Expected: FAIL — 2번째 테스트("요일 반복 체크박스가 렌더되지 않는다")가 `Expected: null / Received: <View accessibilityLabel="이번 달 같은 요일 전체 적용" ...>` 로 깨진다. 1·3번째는 이미 통과할 수 있다(단건 경로는 제거 전에도 기본 경로였다) — 그래도 무방하다. **2번째가 반드시 빨간색이어야** 이 태스크가 실제로 무언가를 지운다는 증거가 된다.

- [ ] **Step 3: 체크박스 JSX와 벌크 분기 제거**

`src/components/weeklyGrid/VenueDayPanel.tsx`에서 체크박스 블록을 삭제한다:

```tsx
      {/* 요일 반복 토글: on 이면 저장이 이번 달 같은 요일 전체에 목표 인원을 적용 */}
      <View className="px-4 pt-2">
        <Checkbox
          checked={repeatWeekday}
          onChange={setRepeatWeekday}
          label="이번 달 같은 요일 전체 적용"
          size="sm"
        />
      </View>
```

저장 버튼의 `loading` prop에서 벌크 pending 을 제거한다 — 아래를

```tsx
          loading={setSoftTarget.isPending || setSoftTargetBulk.isPending}
```

이렇게:

```tsx
          loading={setSoftTarget.isPending}
```

- [ ] **Step 4: 핸들러를 단건 경로로 축약**

`handleSaveTarget` 전체(`:147-207`)를 아래로 교체한다:

```tsx
  const handleSaveTarget = useCallback(() => {
    if (!targetValid) {
      toastError('필요 인원은 0 이상의 숫자로 입력해주세요.');
      return;
    }
    setSoftTarget.mutate(
      // E5: write 경계에서 날짜키 정규화(레포도 재정규화하나 클라단 일관성 보장).
      { venueId, date: toDateString(date), count: parsedTarget },
      {
        onSuccess: () => toastSuccess('필요 인원을 저장했어요.'),
        onError: () => toastError('필요 인원 저장에 실패했어요. 잠시 후 다시 시도해주세요.'),
      }
    );
  }, [targetValid, parsedTarget, setSoftTarget, venueId, date, toastSuccess, toastError]);
```

이어서 벌크 훅/토글 state 두 줄과 그 주석을 삭제한다:

```tsx
  const setSoftTargetBulk = useSetVenueSoftTargetBulk();

  // "이번 달 같은 요일 전체 적용" 토글(기본 off). on 이면 저장이 요일 반복 벌크 경로를 탄다.
  const [repeatWeekday, setRepeatWeekday] = useState(false);
```

(바로 위의 `const setSoftTarget = useSetVenueSoftTarget();` 은 **남긴다**.)

- [ ] **Step 5: 죽은 import 제거**

같은 파일 상단에서:

(1) date-fns 두 줄 삭제 (`format`은 벌크 분기의 요일 라벨 전용이었다):

```tsx
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
```

(2) `Checkbox` import 삭제:

```tsx
import { Checkbox } from '@/components/ui/Checkbox';
```

(3) 날짜 유틸 import 축약 — 아래를

```tsx
import { toDateString, parseDateString, getTodayString } from '@/utils/date';
import { confirmAction } from '@/utils/confirmAction';
```

이렇게 (`confirmAction` 모듈 자체는 다른 화면들이 쓰므로 **파일은 그대로 두고 import만** 제거):

```tsx
import { toDateString } from '@/utils/date';
```

(4) 훅/도메인 import 축약 — 아래를

```tsx
import {
  useSetVenueSoftTarget,
  useSetVenueSoftTargetBulk,
  useVenueDaySlots,
} from '@/hooks/weeklyGrid';
import {
  computeShortage,
  getSameWeekdayDatesInMonth,
  type GridDayCell,
} from '@/domains/weeklyGrid';
```

이렇게:

```tsx
import { useSetVenueSoftTarget, useVenueDaySlots } from '@/hooks/weeklyGrid';
import { computeShortage, type GridDayCell } from '@/domains/weeklyGrid';
```

(5) 파일 최상단 JSDoc의 소프트타깃 설명 줄은 단건 저장을 서술하고 있으므로 그대로 둔다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/VenueDayPanel.test.tsx`

Expected: PASS — `Tests: 3 passed`.

- [ ] **Step 7: 타입 체크**

Run: `cd uniqn-mobile && npx tsc --noEmit`

Expected: exit 0, 출력 없음.

- [ ] **Step 8: 커밋**

```bash
git add uniqn-mobile/src/components/weeklyGrid/VenueDayPanel.tsx uniqn-mobile/src/components/weeklyGrid/__tests__/VenueDayPanel.test.tsx
git commit -m "refactor(grid): 필요 인원 요일 반복 벌크 적용 제거

'이번 달 같은 요일 전체 적용'은 매주 같은 요일에 같은 인원이 필요하다는
가정 위의 벌크 수단이었다. 저장 경로를 단건 하나로 축약하고, 체크박스
재유입을 막는 회귀 가드로 테스트를 교체."
```

---

## Task 3: 진입 라벨 교정 (Slice 3)

**Files:**
- Modify: `app/(app)/(tabs)/employer.tsx:362`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (문자열 상수 1건)

**테스트 관련 의도적 판단:** 이 태스크에는 새 단위 테스트를 추가하지 않는다. 대상은 무거운 탭 화면(`employer.tsx`) 깊숙한 곳의 JSX 문자열 리터럴 1개이고, 이를 렌더로 잡으려면 전체 화면 목 하네스가 필요한데 그 비용이 가드 가치를 넘는다(기존 `employer.workspaceMenu.test.tsx`도 전체 화면이 아니라 `WorkspaceHeaderAction` 서브 export 만 렌더한다). 대신 **grep 이 검증 증거**다 — Step 2가 그 게이트다.

- [ ] **Step 1: 라벨 문자열 교체**

`app/(app)/(tabs)/employer.tsx:362` — 아래를

```tsx
            <Text className="ml-2 font-sans-semibold text-content-primary">이번 주 근무표</Text>
```

이렇게:

```tsx
            <Text className="ml-2 font-sans-semibold text-content-primary">근무표</Text>
```

(같은 블록 `:359`의 `accessibilityLabel="근무표 열기"` 는 이미 올바르므로 건드리지 않는다.)

- [ ] **Step 2: 사용자 노출 문자열 전수 확인**

Run:
```bash
cd uniqn-mobile && grep -rn --include=*.tsx "이번 주 근무표\|지난주 복사\|출근 확인 요청\|이번 달 같은 요일 전체 적용" app src
```

Expected: 출력 0줄 (exit code 1). 한 줄이라도 나오면 Task 1/2가 덜 끝난 것이다.

- [ ] **Step 3: 타입 체크**

Run: `cd uniqn-mobile && npx tsc --noEmit`

Expected: exit 0, 출력 없음.

- [ ] **Step 4: 커밋**

```bash
git add "uniqn-mobile/app/(app)/(tabs)/employer.tsx"
git commit -m "refactor(grid): 근무표 진입 라벨에서 시점 표현 제거

화면은 월 달력인데 진입 버튼만 '이번 주'라 불렀다. '이번 주 근무표' → '근무표'."
```

---

## Task 4: 죽은 코드 연쇄 정리 + knip 래칫 (Slice 4)

**Files:**
- Delete: 아래 Step 1의 18개 파일
- Modify: `src/services/weeklyGrid/gridWriteService.ts` (`:20-37` 함수 제거)
- Modify: `src/hooks/weeklyGrid/index.ts`, `src/domains/weeklyGrid/index.ts` (barrel export 정리)
- Modify: `package.json` (`knip:gate` 임계값)

**Interfaces:**
- Consumes: Task 1·2가 만든 상태 — `weekly-grid.tsx`·`VenueDayPanel.tsx`가 삭제 대상 심볼을 더 이상 참조하지 않음.
- Produces: 없음 (마지막 태스크)

**삭제 프로토콜(wiki `sources/codebase-cleanup-2026-07`):** "호출 0" 은 눈대중이 아니라 전수 grep 으로 확정한다. Step 1이 그 게이트다.

- [ ] **Step 1: 전수 grep 으로 호출 0 확정**

Run:
```bash
cd uniqn-mobile && for s in useCopyLastWeek copyLastWeek useNotifyWeeklyBatchConfirm notifyWeeklyBatchConfirm buildWeeklyBatchConfirmNotification getWeekRange useSetVenueSoftTargetBulk setVenueSoftTargetBulk getSameWeekdayDatesInMonth buildCopyLastWeekPayload shiftDateByDays toLastWeekDate toThisWeekDate COPY_LAST_WEEK_SHIFT_DAYS WEEKLY_GRID_NOTIFICATION_LINK WEEKLY_BATCH_CONFIRM_TYPE; do
  echo "=== $s ===";
  grep -rn --include=*.ts --include=*.tsx "$s" src app e2e | grep -v "/__tests__/" | grep -v "^src/domains/weeklyGrid/copyLastWeek.ts\|^src/domains/weeklyGrid/weeklyBatchNotification.ts\|^src/domains/weeklyGrid/weekRange.ts\|^src/domains/weeklyGrid/weekdayDates.ts\|^src/hooks/weeklyGrid/useCopyLastWeek.ts\|^src/hooks/weeklyGrid/useNotifyWeeklyBatchConfirm.ts\|^src/hooks/weeklyGrid/useSetVenueSoftTargetBulk.ts\|^src/services/weeklyGrid/copyLastWeekService.ts\|^src/services/weeklyGrid/weeklyBatchNotificationService.ts";
done
```

Expected: 남는 참조는 **barrel(`src/hooks/weeklyGrid/index.ts`, `src/domains/weeklyGrid/index.ts`)과 `src/services/weeklyGrid/gridWriteService.ts` 뿐**이어야 한다 (셋 다 이 태스크에서 정리한다). 그 외 파일이 하나라도 나오면 **삭제를 멈추고** 그 소비처를 먼저 처리할 것.

- [ ] **Step 2: 파일 삭제**

```bash
cd uniqn-mobile && git rm \
  src/hooks/weeklyGrid/useCopyLastWeek.ts \
  src/hooks/weeklyGrid/useNotifyWeeklyBatchConfirm.ts \
  src/hooks/weeklyGrid/useSetVenueSoftTargetBulk.ts \
  src/hooks/weeklyGrid/__tests__/useSetVenueSoftTargetBulk.test.tsx \
  src/services/weeklyGrid/copyLastWeekService.ts \
  src/services/weeklyGrid/weeklyBatchNotificationService.ts \
  src/services/weeklyGrid/__tests__/copyLastWeekService.test.ts \
  src/services/weeklyGrid/__tests__/weeklyBatchNotificationService.test.ts \
  src/services/weeklyGrid/__tests__/gridWriteService.test.ts \
  src/domains/weeklyGrid/copyLastWeek.ts \
  src/domains/weeklyGrid/weeklyBatchNotification.ts \
  src/domains/weeklyGrid/weekRange.ts \
  src/domains/weeklyGrid/weekdayDates.ts \
  src/domains/weeklyGrid/__tests__/copyLastWeek.test.ts \
  src/domains/weeklyGrid/__tests__/weeklyBatchNotification.test.ts \
  src/domains/weeklyGrid/__tests__/weekRange.test.ts \
  src/domains/weeklyGrid/__tests__/weekdayDates.test.ts
```

`gridWriteService.test.ts`를 통째로 지우는 이유: 이 파일은 `describe('gridWriteService.setVenueSoftTargetBulk')` 하나뿐이고 나머지 서비스 경로(updateSlot/deleteSlot/createVenueContainer)는 파일 헤더가 밝히듯 다른 테스트가 담당한다.

- [ ] **Step 3: `gridWriteService`에서 벌크 함수 제거**

`src/services/weeklyGrid/gridWriteService.ts`에서 아래 블록(`:20-37`)을 통째로 삭제한다:

```ts
/**
 * 운영처 목표인원(soft-target) 벌크 저장 — "이번 달 같은 요일 전체 적용"용(P1-5).
 *
 * dates 를 순차(for..of await)로 setVenueSoftTarget 에 위임한다. 병렬이 아닌 순차인 이유:
 * 대상들이 같은 컨테이너의 schedule.softTargets(JSONB)를 읽고-쓰기(RMW)하므로, 동시쓰기하면
 * last-write-wins 로 일부 날짜가 유실될 수 있다. 순차면 각 RPC 가 직전 결과 위에 누적된다.
 * 부분 실패 후 재시도도 안전하다 — RPC(set_venue_soft_target)가 date 키 단위 멱등 RMW 라
 * 이미 반영된 날짜는 동일 count 로 다시 덮어써도 결과가 같다.
 */
export async function setVenueSoftTargetBulk(
  venueId: string,
  dates: readonly string[],
  count: number
): Promise<void> {
  for (const date of dates) {
    await weeklyGridRepository.setVenueSoftTarget(venueId, date, count);
  }
}
```

바로 위의 `setVenueSoftTarget`(단건)과 아래의 `updateSlot`/`deleteSlot`/`createVenueContainer`는 **전부 남긴다**. `weeklyGridRepository` import 도 단건 함수가 계속 쓰므로 남긴다.

- [ ] **Step 4: 훅 barrel 정리**

`src/hooks/weeklyGrid/index.ts` 전체를 아래로 교체한다:

```ts
/**
 * weeklyGrid 훅 배럴 — 주간 배치 그리드 읽기 훅.
 */
export { useGridSummary } from './useGridSummary';
export { useVenueDaySlots } from './useVenueDaySlots';
export { useVenueContainers } from './useVenueContainers';
export { useSetVenueSoftTarget, type SetVenueSoftTargetVars } from './useSetVenueSoftTarget';
export { useUpdateSlot, type UpdateSlotVars } from './useUpdateSlot';
export { useDeleteSlot } from './useDeleteSlot';
export { useCreateVenueContainer } from './useCreateVenueContainer';
export { useEnsureDefaultVenue, type EnsureDefaultVenueInput } from './useEnsureDefaultVenue';
```

- [ ] **Step 5: 도메인 barrel 정리**

`src/domains/weeklyGrid/index.ts`에서 4개 export 블록을 삭제한다.

(1) `:25` 삭제:

```ts
export { getWeekRange, type WeekRange } from './weekRange';
```

(2) `:27` 삭제:

```ts
export { getSameWeekdayDatesInMonth } from './weekdayDates';
```

(3) `:40-47` 삭제:

```ts
export {
  COPY_LAST_WEEK_SHIFT_DAYS,
  shiftDateByDays,
  toLastWeekDate,
  toThisWeekDate,
  buildCopyLastWeekPayload,
  type CopyLastWeekGroup,
} from './copyLastWeek';
```

(4) `:71-77` 삭제 (파일 끝 블록):

```ts
export {
  buildWeeklyBatchConfirmNotification,
  WEEKLY_GRID_NOTIFICATION_LINK,
  WEEKLY_BATCH_CONFIRM_TYPE,
  type WeeklyBatchConfirmInput,
  type WeeklyBatchNotificationPayload,
} from './weeklyBatchNotification';
```

남는 export: `softTargets` · `gridSlotState` · `gridBadgeMeta` · `venueContainer` · `weeklyGridFlag` · `buildGridCells` · `slotEdit` 7블록.

- [ ] **Step 6: 타입 체크 — dangling import 부재 증명**

Run: `cd uniqn-mobile && npx tsc --noEmit`

Expected: exit 0, 출력 없음. (삭제한 파일을 누가 아직 import 하면 `Cannot find module` 로 여기서 터진다.)

- [ ] **Step 7: 린트**

Run: `cd uniqn-mobile && npx eslint . --ext .js,.jsx,.ts,.tsx`

Expected: exit 0, 0 errors.

- [ ] **Step 8: 전체 테스트 스위트**

Run: `cd uniqn-mobile && npx jest`

Expected: 전 스위트 통과. 삭제한 심볼을 참조하는 잔존 테스트가 있으면 여기서 `Cannot find module` 로 잡힌다. 실패가 나오면 그 테스트가 (a) 삭제 대상 동반 테스트인데 안 지워졌는지 (b) 무관한 기존 red 인지 구분해 보고할 것 — 무관한 red 라면 `git stash` 없이 `git log` 로 이전 상태 확인 후 baseline 으로 기록한다.

- [ ] **Step 9: knip 재실행 + 새 래칫 값 측정**

Run:
```bash
cd uniqn-mobile && npx knip --no-progress --reporter json > ../knip-after.json 2>&1 && node -e "
const d=require('../knip-after.json').issues;
let total=0; for(const f of d){ for(const v of Object.values(f)){ if(Array.isArray(v)) total+=v.length; } }
console.log('total issues =', total);
"
```

Expected: `total issues = N` — 브랜치 시작 기준선 **2200** 보다 작아야 한다. 특히 기준선에 있던 `useSetVenueSoftTargetBulk|default  src/hooks/weeklyGrid/useSetVenueSoftTargetBulk.ts` 항목이 사라져야 한다. 값이 줄지 않았다면 삭제가 실제로 반영되지 않은 것이므로 멈추고 원인을 조사할 것.

- [ ] **Step 10: knip 래칫 갱신**

`package.json:16` 의 값을 Step 9에서 측정한 `N` 으로 낮춘다 — 아래를

```json
    "knip:gate": "knip --max-issues=2200",
```

이렇게 (`N` = Step 9 실측치):

```json
    "knip:gate": "knip --max-issues=N",
```

그리고 게이트가 실제로 통과하는지 확인한다:

Run: `cd uniqn-mobile && npm run knip:gate`

Expected: exit 0.

- [ ] **Step 11: 임시 산출물 정리**

```bash
rm -f knip-after.json
```

(레포 루트에 쓴 측정 파일 — 커밋에 섞이면 안 된다. `git status` 로 미추적 파일이 없는지 확인할 것.)

- [ ] **Step 12: 커밋**

```bash
git add -A uniqn-mobile
git commit -m "refactor(grid): 반복 배치 제거로 죽은 코드 연쇄 정리 + knip 래칫 갱신

지난주 복사(도메인·서비스·훅), 출근 확인 알림(도메인·서비스·훅), 주 범위
계산(weekRange), 요일 반복 벌크(훅·서비스 함수·weekdayDates)를 동반 테스트와
함께 삭제하고 barrel 을 정리했다. 레포지토리 계층은 무변경 — 세 메서드 모두
삭제 대상 밖 소비처(단건 저장·정산 조회·useGridSummary)를 유지한다.
딥링크 weekly-grid 케이스는 기존 알림 착지 경로라 보존."
```

---

## 최종 검증 게이트 (설계 §7)

Task 4 완료 후 전체를 한 번에 다시 돌려 증거를 남긴다.

- [ ] **Step 1: 품질 게이트 일괄 실행**

Run: `cd uniqn-mobile && npm run quality`

Expected: type-check + lint + format:check 전부 통과 (exit 0).

- [ ] **Step 2: 그리드 관련 테스트 재확인**

Run: `cd uniqn-mobile && npx jest weeklyGrid weekly-grid`

Expected: 전 스위트 통과, 삭제된 테스트 파일 미실행.

- [ ] **Step 3: 보존 대상 실재 확인 (오삭제 방지)**

Run:
```bash
cd uniqn-mobile && grep -rn "weekly-grid" src/utils/deepLinkRouteParser.ts && grep -n "weekly_grid_enabled" src/config/featureFlags.ts && ls "app/(employer)/weekly-grid.tsx" && grep -n "setVenueSoftTarget\b" src/services/weeklyGrid/gridWriteService.ts
```

Expected: 네 항목 모두 히트 — 딥링크 케이스·플래그·라우트 파일·단건 저장 함수가 살아 있어야 한다.

- [ ] **Step 4: 화면 회귀 (사용자 수동 QA — 자동화 불가)**

근무표 진입 → 지점 선택 → 월 달력 → 날짜 탭 → 배치 패널: 필요 인원 저장/인원 추가/부족 공고 진입이 정상인지 실기기에서 확인. 이 항목은 코드 게이트로 대체 불가하며, 미완이면 **미완이라고 보고**한다.

---

## 리스크와 완화 (설계 §9)

| 리스크 | 이 계획에서의 완화 |
|---|---|
| 삭제 심볼의 숨은 소비처 | Task 4 Step 1 전수 grep 게이트 — barrel/gridWriteService 외 히트 시 삭제 중단 |
| 딥링크/플래그/라우트 오삭제 | 최종 게이트 Step 3 실재 확인 |
| 남은 테스트가 삭제 심볼 참조 | Task 4 Step 6(tsc) + Step 8(전체 jest) |
| `confirmAction` 오삭제 | Task 2 Step 5에서 **import 만** 제거, 모듈 파일은 무변경 |
| 벌크 제거가 단건 저장까지 끊음 | Task 2 Step 1의 첫·셋째 테스트가 단건 경로를 명시 검증 |
| vacuous green (화면 미렌더로 "제거됨" 통과) | Task 1·2 테스트 모두 대조군 단언 포함 |

## 범위 밖 (설계 §8 — 건드리지 않음)

- UI 겹침 근본 메커니즘 조사 (증상만 해소)
- 지점 급여 상속 결함 (`FALLBACK_SETTLEMENT_CONTEXT` ₩15,000)
- 필요 인원 하향 불가 (`buildGridCells.ts:37` `Math.max`)
