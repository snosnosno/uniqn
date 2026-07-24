# 주문서 미설정 항목 연쇄 입력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고작성 주문서에서 미설정 항목의 `확인`을 누르면 목록으로 돌아가지 않고 다음 미설정 항목 시트로 바로 이어지게 한다.

**Architecture:** `OrderSheetScreen`이 시트 확인 시 다음 미설정 행을 계산해 지연 스왑(`SHEET_CHAIN_SWAP_MS`)으로 다음 시트를 연다. 전환 연출(제자리 fade + 백드롭 인수인계)은 React Context로 `SheetModal`에만 전달하므로 **시트 컴포넌트 12개는 무수정**이다. 순회는 `orderRowMeta`의 순수 함수로 분리해 단위 테스트한다.

**Tech Stack:** React Native 0.83 / React 19 / TypeScript strict / react-hook-form + zod / react-native-reanimated / Jest + @testing-library/react-native

**설계 문서:** `docs/superpowers/specs/2026-07-23-order-sheet-unset-chain-design.md`

## Global Constraints

- 모든 주석·커밋 메시지·문서는 **한글**. 코드 식별자·라이브러리명만 원문 유지.
- 작업 디렉토리는 `uniqn-mobile/`. 모든 상대 경로는 그 기준.
- 경로는 `@/` 절대 경로만 사용. 시스템 절대 경로 금지.
- 앱 런타임 코드에 `console.log()` 금지 (`logger.info()` 사용). 이 계획의 코드에는 로깅이 없다.
- 필드명 camelCase.
- 커밋 형식: `<type>(<scope>): <한글 설명>` — 여기서는 `feat(order-sheet)` / `refactor(order-sheet)` / `feat(ui)`.
- 다크모드 `dark:` 항상 병기.
- 브랜치: `feat/order-sheet-unset-chain` (이미 생성됨, 스펙 커밋 `1809176be` 위에 쌓는다).
- 시트 컴포넌트 12개(`src/components/employer/order-sheet/sheets/*.tsx`)는 **이 계획에서 수정하지 않는다.**
- 진행 표시(`3/6`)는 **범위 밖** — 구현하지 말 것.
- 화면 진입 시 자동 시트 오픈은 **범위 밖** — 구현하지 말 것.

## 사전 확인 사항 (실측 완료 — 구현 시 전제로 삼을 것)

1. **시트는 exit 애니메이션을 타지 않는다.** `OrderSheetScreen`은 `{activeSheet === 'title' && <TitleSheet visible ... />}` 형태로 조건부 렌더하고 `visible`은 상수 `true`다. `activeSheet`가 바뀌면 컴포넌트가 통째로 언마운트되므로 `SheetModal`의 exit 애니메이션(`visible=false` 분기)은 실행되지 않고 즉시 사라진다. → 연쇄 전환에서 **exit 연출을 만들 필요가 없고**, 대기 시간은 순수하게 iOS 네이티브 모달 present/dismiss 경합 회피용이다.
2. **`ScheduleDatesSheet`는 `SheetModal`을 쓰지 않는다.** `DatePickerModal`(`@/components/ui/Modal`) 래핑이다. 따라서 Context 기반 전환 연출은 날짜 시트에 적용되지 않는다 — 날짜 시트로 들어가고 나오는 전환은 기존 연출 그대로다. 이는 설계에서 수용한 절충이다.
3. **모든 시트는 확인 버튼에서 `onConfirm(...)` 직후 `onClose()`를 호출한다** (예: `sheets/TitleSheet.tsx:41-44`). 따라서 `onClose`가 `setActiveSheet(null)`을 담당하고, 연쇄 예약은 `onConfirm` 안에서 이뤄진다.

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `src/components/employer/order-sheet/orderRowMeta.ts` | 행 순서 순회 순수 함수 — `orderedRowTargets`, `nextUnsetRowAfter` 추가 | 수정 |
| `src/components/employer/order-sheet/__tests__/orderRowMeta.chain.test.ts` | 위 두 함수 단위 테스트 | 신규 |
| `src/components/employer/order-sheet/OrderSheetScreen.tsx` | 연쇄 판정·예약·실행, 딤 레이어, Context Provider | 수정 |
| `src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx` | 연쇄 통합 테스트 | 신규 |
| `src/components/ui/SheetChainContext.tsx` | 연쇄 전환 상태 Context (~25줄) | 신규 |
| `src/components/ui/SheetModal.tsx` | Context 소비 — 제자리 fade 진입, 백드롭 즉시, `onShow` 통지 | 수정 |
| `src/constants/animation.ts` | `SHEET_CHAIN_SWAP_MS` 추가 | 수정 |

---

### Task 1: 행 순회 순수 함수 (`nextUnsetRowAfter`)

연쇄는 "전역 첫 미설정 행"이 아니라 **현재 행 다음부터** 찾아야 한다. `firstUnsetRow`를 그대로 쓰면 급여 행을 확인했을 때 앞쪽의 미설정 제목으로 되돌아가 사용자가 뒤로 끌려가는 느낌을 받는다. 한 바퀴 돌아 제자리로 오면 `null`을 반환해 연쇄를 끝낸다.

**Files:**
- Modify: `src/components/employer/order-sheet/orderRowMeta.ts` (기존 `firstUnsetRow`는 `orderedRowTargets` 위로 재작성)
- Test: `src/components/employer/order-sheet/__tests__/orderRowMeta.chain.test.ts` (신규)

**Interfaces:**
- Consumes: 기존 `getRowState(values, key, groupIndex)`, `orderGroupsFor(postingType)`, `OrderRowTarget`, `OrderSheetFormValues`
- Produces:
  - `export function orderedRowTargets(values: OrderSheetFormValues): OrderRowTarget[]` — 화면에 보이는 순서대로의 전체 행 타깃 목록(일정 섹션은 그룹 수만큼 반복)
  - `export function nextUnsetRowAfter(values: OrderSheetFormValues, current: OrderRowTarget): OrderRowTarget | null` — `current` 다음 위치부터 순환 순회하며 첫 필수 미설정 행. 없으면 `null`
  - 기존 `firstUnsetRow(values)`는 시그니처·동작 그대로 유지 (하단 CTA 라벨이 계속 쓴다)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/employer/order-sheet/__tests__/orderRowMeta.chain.test.ts` 생성:

```ts
/**
 * orderRowMeta — 연쇄 입력용 행 순회(orderedRowTargets · nextUnsetRowAfter) 단위 테스트
 *
 * 연쇄는 "전역 첫 미설정"이 아니라 "현재 다음부터 순환"이어야 한다 — 아니면 뒤쪽 행을
 * 확정했을 때 앞쪽 미설정 행으로 되돌아가 사용자가 끌려가는 느낌을 받는다.
 */
import { orderedRowTargets, nextUnsetRowAfter, firstUnsetRow } from '../orderRowMeta';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

/** 필수 항목이 전부 채워진 dated 폼 — 개별 테스트가 필요한 곳만 비운다 */
const filled = (): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러 구합니다',
  location: { name: '강남 홀덤펍', region: '서울' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    {
      dates: ['2026-07-24'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  useSameSalary: true,
  salary: { type: 'hourly', amount: 15000 },
});

describe('orderedRowTargets', () => {
  it('기본정보 4행 → 일정·모집 3행 → 급여 3행 → 조건 → 사전질문 순서로 나열한다', () => {
    const targets = orderedRowTargets(filled());
    expect(targets.map((t) => t.key)).toEqual([
      'title',
      'place',
      'contact',
      'description',
      'dates',
      'time',
      'roles',
      'salary',
      'welfare',
      'tax',
      'conditions',
      'preQuestions',
    ]);
  });

  it('일정 그룹이 2개면 일정·모집 3행이 그룹별로 반복된다', () => {
    const base = filled();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [...(base.scheduleGroups ?? []), { dates: [], timeSlots: [], grouped: false }],
    };
    const schedule = orderedRowTargets(values).filter((t) =>
      ['dates', 'time', 'roles'].includes(t.key)
    );
    expect(schedule).toEqual([
      { key: 'dates', groupIndex: 0 },
      { key: 'time', groupIndex: 0 },
      { key: 'roles', groupIndex: 0 },
      { key: 'dates', groupIndex: 1 },
      { key: 'time', groupIndex: 1 },
      { key: 'roles', groupIndex: 1 },
    ]);
  });

  it('고정(fixed) 타입은 날짜·시간 대신 근무조건 행을 낸다', () => {
    const values: OrderSheetFormValues = {
      ...initialOrderSheetValues(),
      postingType: 'fixed',
      scheduleGroups: [],
      fixedSchedule: { daysPerWeek: 5, isStartTimeNegotiable: true, roles: [] },
    };
    const keys = orderedRowTargets(values).map((t) => t.key);
    expect(keys).toContain('workConditions');
    expect(keys).not.toContain('dates');
    expect(keys).not.toContain('time');
  });
});

describe('nextUnsetRowAfter', () => {
  it('현재 행 다음의 미설정 행을 반환한다', () => {
    const values: OrderSheetFormValues = { ...filled(), contactPhone: '' };
    expect(nextUnsetRowAfter(values, { key: 'title', groupIndex: 0 })).toEqual({
      key: 'contact',
      groupIndex: 0,
    });
  });

  it('선택 항목(설명·복지·세금·조건·사전질문)은 건너뛴다', () => {
    const values: OrderSheetFormValues = { ...filled(), salary: { type: 'hourly', amount: 0 } };
    // description 은 optional 이라 건너뛰고 salary 로 간다
    expect(nextUnsetRowAfter(values, { key: 'contact', groupIndex: 0 })).toEqual({
      key: 'salary',
      groupIndex: 0,
    });
  });

  it('현재 행 뒤에 없으면 앞쪽으로 순환해서 찾는다', () => {
    const values: OrderSheetFormValues = { ...filled(), title: '' };
    expect(nextUnsetRowAfter(values, { key: 'salary', groupIndex: 0 })).toEqual({
      key: 'title',
      groupIndex: 0,
    });
  });

  it('미설정 행이 현재 행 하나뿐이면 null 을 반환한다 (연쇄 루프 차단)', () => {
    const values: OrderSheetFormValues = { ...filled(), salary: { type: 'hourly', amount: 0 } };
    expect(nextUnsetRowAfter(values, { key: 'salary', groupIndex: 0 })).toBeNull();
  });

  it('미설정 행이 하나도 없으면 null 을 반환한다', () => {
    expect(nextUnsetRowAfter(filled(), { key: 'title', groupIndex: 0 })).toBeNull();
  });

  it('일정 그룹 스코프 — 그룹0 역할 다음은 그룹1 날짜다', () => {
    const base = filled();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [...(base.scheduleGroups ?? []), { dates: [], timeSlots: [], grouped: false }],
    };
    expect(nextUnsetRowAfter(values, { key: 'roles', groupIndex: 0 })).toEqual({
      key: 'dates',
      groupIndex: 1,
    });
  });

  it('목록에 없는 current 가 들어와도 앞에서부터 훑어 첫 미설정 행을 낸다', () => {
    const values: OrderSheetFormValues = { ...filled(), title: '' };
    // fixed 전용 키를 dated 폼에 넣은 방어 케이스
    expect(nextUnsetRowAfter(values, { key: 'workConditions', groupIndex: 0 })).toEqual({
      key: 'title',
      groupIndex: 0,
    });
  });

  it('firstUnsetRow 는 기존 동작(전역 첫 미설정)을 유지한다', () => {
    const values: OrderSheetFormValues = { ...filled(), title: '', contactPhone: '' };
    expect(firstUnsetRow(values)).toEqual({ key: 'title', groupIndex: 0 });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/orderRowMeta.chain.test.ts
```

Expected: FAIL — `orderedRowTargets is not a function`, `nextUnsetRowAfter is not a function`

- [ ] **Step 3: `orderRowMeta.ts`에 순회 함수 추가**

`src/components/employer/order-sheet/orderRowMeta.ts` 맨 아래의 기존 `firstUnsetRow`(현재 520~539행)를 아래 3개 함수로 교체한다:

```ts
/**
 * 화면에 보이는 순서대로의 전체 행 타깃 목록 — 일정·모집 섹션은 그룹 수만큼 반복한다.
 * firstUnsetRow / nextUnsetRowAfter 의 공통 순회 소스(DRY).
 */
export function orderedRowTargets(values: OrderSheetFormValues): OrderRowTarget[] {
  const isFixed = values.postingType === 'fixed';
  // fixed 는 날짜 축이 없어 단일 그룹(index 0)만 순회 — dated 는 그룹 수만큼 일정·모집 반복(S1)
  const groupCount = isFixed ? 1 : Math.max(1, (values.scheduleGroups ?? []).length);
  const targets: OrderRowTarget[] = [];
  for (const section of orderGroupsFor(values.postingType)) {
    const isSchedule = section.title === '일정 · 모집';
    const groupIndexes = isSchedule ? [...Array(groupCount).keys()] : [0];
    for (const groupIndex of groupIndexes) {
      for (const key of section.rows) {
        targets.push({ key, groupIndex });
      }
    }
  }
  return targets;
}

/** 해당 타깃이 "채워야 하는데 비어 있는" 상태인지 */
function isUnsetTarget(values: OrderSheetFormValues, target: OrderRowTarget): boolean {
  const state = getRowState(values, target.key, target.groupIndex);
  return !state.optional && state.unset;
}

/**
 * 첫 미설정 행 타깃 — 일정·모집 섹션은 그룹 순회(그룹0 dates→time→roles → 그룹1 …).
 * 제출 유도(H5)와 에러 배지가 같은 타깃을 흘려받는다(리뷰 Design-M3).
 */
export function firstUnsetRow(values: OrderSheetFormValues): OrderRowTarget | null {
  return orderedRowTargets(values).find((t) => isUnsetTarget(values, t)) ?? null;
}

/**
 * 연쇄 입력용 — current 다음 위치부터 순환 순회하며 첫 미설정 행을 낸다.
 *
 * 전역 첫 미설정(firstUnsetRow)을 쓰면 뒤쪽 행을 확정했을 때 앞쪽 미설정 행으로 되돌아가
 * 사용자가 끌려가는 느낌을 받는다. 한 바퀴 돌아 current 로 돌아오면 null 을 반환해
 * 연쇄를 끝낸다 — current 가 확인 후에도 여전히 unset 인 경우(금액 0 확인 등)의
 * 무한 재오픈을 구조적으로 차단한다.
 *
 * current 가 목록에 없으면(타입 전환 등으로 행 구성이 바뀐 경우) 앞에서부터 훑는다.
 */
export function nextUnsetRowAfter(
  values: OrderSheetFormValues,
  current: OrderRowTarget
): OrderRowTarget | null {
  const targets = orderedRowTargets(values);
  const currentIndex = targets.findIndex(
    (t) => t.key === current.key && t.groupIndex === current.groupIndex
  );
  const start = currentIndex + 1; // 못 찾으면 -1 → 0 부터 = 앞에서부터 훑기
  for (let offset = 0; offset < targets.length; offset += 1) {
    const target = targets[(start + offset) % targets.length];
    if (target === undefined) continue;
    if (currentIndex >= 0 && (start + offset) % targets.length === currentIndex) break;
    if (isUnsetTarget(values, target)) return target;
  }
  return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/orderRowMeta.chain.test.ts
```

Expected: PASS — 10 tests

> 일정 그룹 스코프 연쇄는 순수 함수 레벨에서 검증한다(위 "그룹0 역할 다음은 그룹1 날짜"). 통합 레벨에서는 `ScheduleSlotsSheet` 두 개가 같은 제목이라 어느 그룹인지 단언할 수단이 없어, 그룹 순회 로직을 `nextUnsetRowAfter`에 몰아두고 여기서 잠근다.

- [ ] **Step 5: 기존 `orderRowMeta` 테스트 회귀 확인**

`firstUnsetRow`를 재작성했으므로 기존 단위 테스트가 그대로 통과해야 한다.

```bash
cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/orderRowMeta
```

Expected: PASS — `orderRowMeta.test.ts` · `orderRowMeta.fixed.test.ts` · `orderRowMeta.chain.test.ts` 전부 통과, 실패 0

- [ ] **Step 6: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

Expected: 에러 0

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/src/components/employer/order-sheet/orderRowMeta.ts uniqn-mobile/src/components/employer/order-sheet/__tests__/orderRowMeta.chain.test.ts
git commit -m "feat(order-sheet): 연쇄 입력용 행 순회 함수 — orderedRowTargets · nextUnsetRowAfter

- current 다음부터 순환 순회 — 뒤쪽 행 확정 시 앞쪽으로 끌려가지 않게
- 한 바퀴 돌아 제자리면 null — 확인 후에도 unset 인 행의 무한 재오픈 구조적 차단
- firstUnsetRow 를 공통 순회 위로 재작성(동작 동일)"
```

---

### Task 2: 연쇄 라우팅 배선

`OrderSheetScreen`에 무장(arm) 판정 · 지연 스왑 · 확인 훅을 넣는다. 이 태스크까지는 **전환 연출을 건드리지 않는다** — 기존 slide 애니메이션 그대로 동작하고, 연쇄가 실제로 이어지는지만 검증한다.

**Files:**
- Modify: `src/constants/animation.ts`
- Modify: `src/components/employer/order-sheet/OrderSheetScreen.tsx`
- Test: `src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx` (신규)

**Interfaces:**
- Consumes: Task 1의 `nextUnsetRowAfter(values, current)`, 기존 `getRowState`, `handleRowPress`
- Produces:
  - `export const SHEET_CHAIN_SWAP_MS = 180` (`@/constants/animation`)
  - `OrderSheetScreen` 내부 함수 `openRow(key, groupIndex)` — 라우팅 + 무장 판정 (연쇄와 사용자 탭이 공유)
  - `OrderSheetScreen` 내부 함수 `confirmRow(target)` — 각 시트 `onConfirm` 끝에서 호출

- [ ] **Step 1: 상수 추가**

`src/constants/animation.ts` 맨 아래에 추가:

```ts
/**
 * 주문서 연쇄 입력에서 시트→시트 전환 대기 시간 (ms).
 *
 * 두 네이티브 Modal 을 겹쳐 present 하면 iOS 터치 라우팅이 깨지므로, 이전 시트를 먼저
 * 언마운트한 뒤 이 시간만큼 기다렸다가 다음 시트를 마운트한다.
 *
 * SHEET_DISMISS_ANIMATION_MS(300) 보다 짧은 이유: 주문서 시트는 조건부 렌더라
 * exit 애니메이션을 타지 않고 즉시 언마운트된다(visible 이 false 로 내려가지 않음).
 * 따라서 이 값은 시각 애니메이션 대기가 아니라 네이티브 dismiss 커밋 여유분이다.
 *
 * ⚠️ iOS 실기기 QA 대상 — 전환 중 터치가 먹지 않으면 300 으로 올릴 것.
 */
export const SHEET_CHAIN_SWAP_MS = 180;
```

- [ ] **Step 2: 실패하는 통합 테스트 작성**

`src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx` 생성:

```tsx
/**
 * OrderSheetScreen — 미설정 항목 연쇄 입력 테스트
 *
 * (1) 미설정 행 확인 → 대기 후 다음 미설정 시트 자동 오픈,
 * (2) 대조군: 이미 채워진 행 확인 → 연쇄 없음,
 * (3) 마지막 미설정 항목 확인 → 시트 없음 + CTA '이대로 등록',
 * (4) X 로 닫으면 연쇄 중단, (5) 대기 중 사용자 행 탭이 예약을 이긴다.
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import { SHEET_CHAIN_SWAP_MS } from '@/constants/animation';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const mockAddToast = jest.fn();
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer, overlay }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});
jest.mock('@/components/ui/Modal', () => {
  const { View } = require('react-native');
  return {
    Modal: ({ visible, children, footer }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});
jest.mock('@/components/ui/CalendarPicker', () => ({ CalendarPicker: () => null }));

const baseProps = { onSubmit: jest.fn(), isSubmitting: false };

/** 제목만 비어 있고 나머지 필수는 전부 채워진 폼 */
const onlyTitleMissing = (): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '',
  location: { name: '강남 홀덤펍', region: '서울' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    {
      dates: ['2026-07-24'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  useSameSalary: true,
  salary: { type: 'hourly', amount: 15000 },
});

/** 제목·연락처가 비어 있는 폼 — 연쇄 2스텝 검증용 */
const titleAndContactMissing = (): OrderSheetFormValues => ({
  ...onlyTitleMissing(),
  contactPhone: '',
});

const advanceSwap = async () => {
  await act(async () => {
    jest.advanceTimersByTime(SHEET_CHAIN_SWAP_MS);
    await Promise.resolve();
  });
};

describe('OrderSheetScreen — 미설정 항목 연쇄 입력', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAddToast.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('미설정 제목을 확인하면 대기 후 다음 미설정 항목(연락처) 시트가 열린다', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // 대기 전에는 다음 시트가 아직 없다
    expect(queryByText('연락처')).toBeNull();

    await advanceSwap();

    expect(getByText('연락처')).toBeTruthy();
  });

  it('대조군 — 이미 채워진 행을 확인하면 연쇄가 일어나지 않는다', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{ ...titleAndContactMissing(), title: '기존 제목' }}
      />
    );

    fireEvent.press(getByTestId('order-sheet-row-title')); // 이미 채워진 행
    fireEvent.press(getByText('확인'));

    await advanceSwap();

    expect(queryByText('연락처')).toBeNull();
  });

  it('마지막 미설정 항목을 확인하면 시트가 닫히고 CTA 가 이대로 등록으로 바뀐다', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={onlyTitleMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    await advanceSwap();

    expect(queryByText('공고 제목')).toBeNull();
    expect(getByText('이대로 등록')).toBeTruthy();
  });

  it('확인 없이 닫기로 나가면 연쇄가 일어나지 않는다', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.press(getByText('닫기'));

    await advanceSwap();

    expect(queryByText('연락처')).toBeNull();
  });

  it('대기 중 사용자가 다른 행을 탭하면 예약을 취소하고 그 행이 즉시 열린다', async () => {
    const { getByTestId, getByText, queryByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // 대기 창 안에서 사용자가 급여 행을 직접 탭
    fireEvent.press(getByTestId('order-sheet-row-salary'));
    expect(getByText('급여')).toBeTruthy();

    await advanceSwap();

    // 예약됐던 연락처 시트가 급여 시트를 갈아치우지 않는다
    expect(queryByText('연락처')).toBeNull();
    expect(getByText('급여')).toBeTruthy();
  });

  it('대기 중 언마운트되어도 예약 타이머가 정리된다', async () => {
    const { getByTestId, getByText, unmount } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    unmount();

    // 타이머가 남아 있으면 언마운트된 트리에 setState 하여 경고가 난다
    await act(async () => {
      jest.advanceTimersByTime(SHEET_CHAIN_SWAP_MS * 2);
      await Promise.resolve();
    });
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx
```

Expected: FAIL — 첫 테스트에서 `Unable to find an element with text: 연락처` (연쇄가 아직 없음)

- [ ] **Step 4: `OrderSheetScreen`에 연쇄 상태 추가**

`OrderSheetScreen.tsx` 상단 import에 추가:

```ts
import { SHEET_CHAIN_SWAP_MS } from '@/constants/animation';
```

`orderRowMeta` import 블록(현재 13~24행)에 `nextUnsetRowAfter`를 추가한다:

```ts
import {
  errorMessageForRow,
  errorRowTargets,
  firstUnsetRow,
  getRowState,
  nextUnsetRowAfter,
  orderGroupsFor,
  roleName,
  summarizeGroupDates,
  summarizeTotalRoles,
  type OrderRowKey,
  type OrderRowTarget,
} from './orderRowMeta';
```

`const [salaryConfirmed, setSalaryConfirmed] = useState(false);` 바로 아래에 연쇄 상태를 추가:

```tsx
  // 연쇄 입력(미설정 항목 이어가기) 상태.
  // chainArmedRef: 이 시트를 "미설정 행"으로 열었는가 — 이미 채워진 행 수정은 연쇄하지 않는다.
  // pendingSwapRef: 지연 스왑 예약. 두 네이티브 Modal 겹침 회피용 대기(#244 패턴 승계).
  const chainArmedRef = useRef(false);
  const pendingSwapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPendingSwap = useCallback(() => {
    if (pendingSwapRef.current !== null) {
      clearTimeout(pendingSwapRef.current);
      pendingSwapRef.current = null;
    }
  }, []);
  useEffect(() => clearPendingSwap, [clearPendingSwap]);
```

- [ ] **Step 5: `handleRowPress`를 `openRow` + `handleRowPress`로 분리**

기존 `handleRowPress`(현재 251~281행)를 아래로 교체한다. 본문 라우팅 로직은 그대로 옮기고, 앞에 무장 판정만 붙인다.

```tsx
  /**
   * 행 → 시트 라우팅 + 연쇄 무장 판정. 사용자 탭과 연쇄 예약이 공유하는 단일 진입점.
   * 무장 = 지금 여는 행이 "필수인데 비어 있음" — 이미 채워진 행 수정은 확인 시 목록으로 복귀한다.
   *
   * 행 탭 라우팅(그룹 스코프) — dates는 단일 그룹=whole(세그먼트)·다그룹=edit(헤더 재편집),
   * 시간·역할은 통합 시트 하나로 진입(설계 §6).
   */
  const openRow = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      if (guardScheduleLock(key)) return;
      const current = form.getValues();
      const state = getRowState(current, key, groupIndex);
      chainArmedRef.current = !state.optional && state.unset;
      const groups = current.scheduleGroups ?? [];
      if (key === 'dates') {
        setActiveSheet({ key: 'dates', groupIndex, mode: groups.length > 1 ? 'edit' : 'whole' });
        return;
      }
      // 시간·역할은 통합 시트 하나로 진입한다(설계 §6). 고정(fixed)은 단일 fixedSchedule.roles
      // 편집이라 전용 시트로 분기하는 기존 동작을 유지한다(S2).
      if (key === 'time' || key === 'roles') {
        if (current.postingType === 'fixed') {
          seedFixedScheduleIfMissing();
          setActiveSheet('fixedRoles');
          return;
        }
        setActiveSheet({ key: 'slots', groupIndex });
        return;
      }
      if (key === 'workConditions') {
        // 방어(H5·전체리뷰 P4): fixedSchedule 부재 상태로 진입해도 시트가 열리도록 시드 —
        // 렌더 게이트(activeSheet==='workConditions' && values.fixedSchedule)와 정합.
        seedFixedScheduleIfMissing();
        setActiveSheet('workConditions');
        return;
      }
      // 나머지는 행 키 그대로 시트 오픈.
      setActiveSheet(key);
    },
    [form, seedFixedScheduleIfMissing, guardScheduleLock]
  );

  /**
   * 사용자가 직접 행을 탭한 경로. 연쇄 예약이 대기 중이면 취소한다 —
   * 사용자의 명시적 선택이 자동 예약을 이긴다(#244 의 "무시" 가드와 반대 방향:
   * 그쪽은 시트가 떠 있는 상태의 오탭 방지였고, 여기는 시트가 없는 대기 창이라
   * 탭을 막으면 사용자가 180ms 동안 아무것도 못 누르는 죽은 구간이 된다).
   */
  const handleRowPress = useCallback(
    (key: OrderRowKey, groupIndex = 0) => {
      clearPendingSwap();
      openRow(key, groupIndex);
    },
    [clearPendingSwap, openRow]
  );
```

- [ ] **Step 6: 연쇄 예약 함수 추가**

`handleRowPress` 바로 아래에 추가:

```tsx
  /**
   * 시트 확인 후 다음 미설정 항목으로 이어간다.
   * 무장되지 않았으면(이미 채워진 행 수정) 아무것도 하지 않고 목록으로 돌아간다.
   *
   * 시트가 onConfirm 직후 onClose 로 activeSheet 를 null 로 내리므로 여기서 닫지 않는다.
   * ⚠️ 호출 순서: onConfirm(폼 반영 → confirmRow) → onClose(무장 해제). confirmRow 를
   *    onClose 뒤로 옮기면 무장이 이미 꺼져 연쇄가 침묵으로 죽는다.
   */
  const confirmRow = useCallback(
    (target: OrderRowTarget) => {
      if (!chainArmedRef.current) return;
      chainArmedRef.current = false;
      // setValue 직후라 watch 값은 아직 옛것 — getValues 로 최신 폼을 읽는다
      const next = nextUnsetRowAfter(form.getValues(), target);
      if (next === null) return;
      pendingSwapRef.current = setTimeout(() => {
        pendingSwapRef.current = null;
        openRow(next.key, next.groupIndex);
      }, SHEET_CHAIN_SWAP_MS);
    },
    [form, openRow]
  );
```

- [ ] **Step 7: `handleAddSchedule` 무장 + 시트 닫기 시 무장 해제**

`handleAddSchedule`(현재 324~328행)을 교체한다 — 새 그룹은 정의상 미설정이므로 무장한다:

```tsx
  const handleAddSchedule = useCallback(() => {
    if (guardScheduleLock()) return;
    clearPendingSwap();
    const groups = form.getValues().scheduleGroups ?? [];
    chainArmedRef.current = true; // 새 그룹은 정의상 미설정 — 날짜 확정 후 시간·역할로 이어간다
    setActiveSheet({ key: 'dates', groupIndex: groups.length, mode: 'add' });
  }, [form, guardScheduleLock, clearPendingSwap]);
```

시트 닫기 공용 핸들러를 `confirmRow` 아래에 추가한다:

```tsx
  /** 시트 닫기 — X·백드롭으로 나가면 연쇄를 끊는다(확인 경로는 이미 confirmRow 가 소비 후 해제). */
  const closeSheet = useCallback(() => {
    chainArmedRef.current = false;
    setActiveSheet(null);
  }, []);
```

- [ ] **Step 8: 시트 12개의 `onClose`·`onConfirm`에 배선**

`OrderSheetScreen.tsx`의 JSX 시트 블록(현재 719~925행)에서:

1. **모든 `onClose={() => setActiveSheet(null)}`를 `onClose={closeSheet}`로 교체** (10곳: title · place · contact · description · workConditions · fixedRoles · salary · welfare · tax · conditions · preQuestions)
2. **각 `onConfirm` 끝에 `confirmRow({ key, groupIndex })` 호출 추가**

각 시트의 타깃 키 대응표 (이 표대로 정확히 배선할 것):

| 시트 | `confirmRow` 인자 |
|---|---|
| `TitleSheet` | `{ key: 'title', groupIndex: 0 }` |
| `PlaceSheet` | `{ key: 'place', groupIndex: 0 }` |
| `ContactSheet` | `{ key: 'contact', groupIndex: 0 }` |
| `DescriptionSheet` | `{ key: 'description', groupIndex: 0 }` |
| `WorkConditionSheet` | `{ key: 'workConditions', groupIndex: 0 }` |
| `RolesSheet`(fixedRoles) | `{ key: 'roles', groupIndex: 0 }` |
| `ScheduleDatesSheet` | `{ key: 'dates', groupIndex: datesTarget.groupIndex }` |
| `ScheduleSlotsSheet` | `{ key: 'roles', groupIndex: slotsTarget.groupIndex }` |
| `SalarySheet` | `{ key: 'salary', groupIndex: 0 }` |
| `WelfareSheet` | `{ key: 'welfare', groupIndex: 0 }` |
| `TaxSheet` | `{ key: 'tax', groupIndex: 0 }` |
| `ConditionsSheet` | `{ key: 'conditions', groupIndex: 0 }` |
| `PreQuestionsSheet` | `{ key: 'preQuestions', groupIndex: 0 }` |

`ScheduleSlotsSheet`가 `'roles'`인 이유: 시간·역할 통합 시트는 `time`과 `roles` 두 행을 함께 확정하므로, 순회상 **뒤에 오는** `roles`를 기준으로 삼아야 다음이 급여로 넘어간다. `time`을 쓰면 방금 채운 `roles`가 다시 잡힌다.

예시 — `TitleSheet` (현재 720~728행):

```tsx
      {activeSheet === 'title' && (
        <TitleSheet
          visible
          value={values.title}
          recentTitles={recentTitles}
          onConfirm={(v) => {
            form.setValue('title', v, { shouldDirty: true, shouldValidate: true });
            confirmRow({ key: 'title', groupIndex: 0 });
          }}
          onClose={closeSheet}
        />
      )}
```

예시 — `ScheduleDatesSheet` (현재 815~833행). 이 시트는 `onConfirm` 안에서 직접 `setActiveSheet(null)`을 호출하는데, 그 자리를 `closeSheet`로 바꾸면 무장이 꺼져 연쇄가 죽는다. **`setActiveSheet(null)`을 그대로 두고 `confirmRow`를 그 뒤에 붙인다**:

```tsx
          onConfirm={({ dates, segment }) => {
            handleDatesConfirm(datesTarget, dates, segment);
            setActiveSheet(null);
            confirmRow({ key: 'dates', groupIndex: datesTarget.groupIndex });
          }}
          onClose={closeSheet}
```

예시 — `ScheduleSlotsSheet` (현재 834~852행):

```tsx
          onConfirm={(next) => {
            const nextGroups = scheduleGroups.map((g, i) =>
              i === slotsTarget.groupIndex ? { ...g, timeSlots: next } : g
            );
            form.setValue('scheduleGroups', nextGroups, {
              shouldDirty: true,
              shouldValidate: true,
            });
            // 시간·역할이 한 번에 확정되므로 역할별 급여 동기화도 여기 1회로 수렴한다
            // (구 TimeSlotsSheet/RolesSheet 이중 호출 제거).
            applyRoleSalarySync(nextGroups);
            confirmRow({ key: 'roles', groupIndex: slotsTarget.groupIndex });
          }}
          onClose={closeSheet}
```

- [ ] **Step 9: `handleSubmitPress`의 CTA 경로 확인**

`handleSubmitPress`(현재 495~512행)는 `handleRowPress(next.key, next.groupIndex)`를 호출한다. `handleRowPress`가 이제 무장까지 하므로 **수정 불필요**하다. 코드를 읽고 그대로인지만 확인한다.

- [ ] **Step 10: 신규 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx
```

Expected: PASS — 6 tests

- [ ] **Step 11: 주문서 기존 스위트 전체 회귀**

연쇄 도입으로 기존 테스트가 깨질 수 있는 지점이 실제로 있다. 아래를 **모두** 돌린다:

```bash
cd uniqn-mobile && npx jest src/components/employer/order-sheet 'app/(employer)/my-postings'
```

Expected: 실패 0.

실패 시 원인은 다음 중 하나다 — 원인별 대응:

| 증상 | 원인 | 대응 |
|---|---|---|
| `확인` 텍스트가 2개 이상 매치 | 예약 타이머가 fake timer 없이 실제로 발화해 다음 시트가 함께 마운트됨 | 해당 테스트에 `jest.useFakeTimers()` 추가 |
| `act(...)` 경고 | 타이머 발화가 act 밖 | `await act(async () => { jest.advanceTimersByTime(SHEET_CHAIN_SWAP_MS); })` 삽입 |
| 확인 후 열려야 할 시트가 안 열림 | `confirmRow`를 `onClose` 뒤에 배선함 | Step 8 표대로 `onConfirm` 안, `onClose` **앞**으로 이동 |

⚠️ **기존 테스트의 단언을 약화시켜 통과시키지 말 것.** 연쇄로 인해 시트가 하나 더 뜬 것이라면 테스트에 타이머 제어를 추가하는 것이 옳고, 단언을 지우는 것은 회귀를 숨기는 것이다.

- [ ] **Step 12: 타입 체크**

```bash
cd uniqn-mobile && npx tsc --noEmit
```

Expected: 에러 0

- [ ] **Step 13: 커밋**

```bash
git add uniqn-mobile/src/constants/animation.ts uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx uniqn-mobile/src/components/employer/order-sheet/__tests__/
git commit -m "feat(order-sheet): 미설정 항목 연쇄 입력 — 확인 시 다음 미설정 시트로 이어가기

- openRow/handleRowPress 분리: 무장 판정은 공유, 예약 취소는 사용자 탭 경로만
- confirmRow — 무장된 행 확인 시 nextUnsetRowAfter 로 다음 시트 예약(SHEET_CHAIN_SWAP_MS)
- 대기 중 사용자 행 탭이 예약을 이긴다(180ms 죽은 구간 방지)
- closeSheet — X/백드롭 이탈 시 연쇄 중단
- 언마운트 시 예약 타이머 정리"
```

---

### Task 3: 전환 연출 — 번쩍임 제거

연쇄 전환 창(180ms) 동안 어떤 모달도 없어 밝은 주문서 목록이 노출된다. 딤 레이어로 백드롭을 인수인계하고, 다음 시트는 제자리에서 fade-in 시켜 "시트가 자리를 지킨 채 내용만 갈리는" 느낌을 만든다.

**Files:**
- Create: `src/components/ui/SheetChainContext.tsx`
- Modify: `src/components/ui/SheetModal.tsx`
- Modify: `src/components/employer/order-sheet/OrderSheetScreen.tsx`
- Test: `src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx` (Task 2 파일에 추가)

**Interfaces:**
- Consumes: Task 2의 `confirmRow`, `openRow`, `pendingSwapRef`
- Produces:
  - `export interface SheetChainValue { entering: boolean; onEntered: () => void }`
  - `export const SheetChainContext: React.Context<SheetChainValue | null>`
  - `export function useSheetChain(): SheetChainValue | null`
  - `SheetModal`은 마운트 시점의 `entering`을 ref로 고정해 진입 연출을 분기하고, 표시 완료 시 `onEntered()`를 호출한다.

- [ ] **Step 1: Context 파일 생성**

`src/components/ui/SheetChainContext.tsx`:

```tsx
/**
 * SheetChainContext — 주문서 연쇄 입력의 시트 전환 연출 신호
 *
 * @description 연쇄로 열리는 시트는 아래에서 슬라이드하지 않고 제자리에서 fade-in 해야
 * "시트가 자리를 지킨 채 내용만 갈린다"는 느낌이 난다. 이 신호를 시트 컴포넌트 12개에
 * prop 으로 흘리면 계약이 12곳으로 번지므로, SheetModal 이 직접 읽는 Context 로 둔다.
 * 기본값 null = 연쇄 아님 → 앱 전역의 다른 SheetModal 사용처는 동작이 바뀌지 않는다.
 */
import { createContext, useContext } from 'react';

export interface SheetChainValue {
  /** 지금 마운트되는 시트가 연쇄로 열린 것인가 */
  entering: boolean;
  /** 시트가 화면에 올라온 시점 통지 — 호출부가 딤 레이어를 걷는다 */
  onEntered: () => void;
}

export const SheetChainContext = createContext<SheetChainValue | null>(null);

export function useSheetChain(): SheetChainValue | null {
  return useContext(SheetChainContext);
}
```

- [ ] **Step 2: `SheetModal` 네이티브 경로에 진입 연출 분기 추가**

`src/components/ui/SheetModal.tsx` import에 추가:

```ts
import { useSheetChain } from '@/components/ui/SheetChainContext';
```

`NativeSheetModal` 안, `const insets = useSafeAreaInsets();` 아래에 추가:

```tsx
  // 연쇄 진입(주문서 미설정 항목 이어가기) — 마운트 시점 값을 고정한다.
  // 이후 Context 가 바뀌어도 이미 시작한 연출을 갈아치우지 않기 위함.
  const chain = useSheetChain();
  const isChainEntryRef = useRef(chain?.entering === true);
  const chainOnEnteredRef = useRef(chain?.onEntered);
  chainOnEnteredRef.current = chain?.onEntered;
```

공유값 초기화(현재 242~243행)를 교체:

```tsx
  const fadeOpacity = useSharedValue(0);
  // 연쇄 진입은 아래에서 올라오지 않고 제자리에서 나타난다(슬라이드 이동 없음)
  const translateY = useSharedValue(isChainEntryRef.current ? 0 : windowHeight);
  const contentOpacity = useSharedValue(isChainEntryRef.current ? 0 : 1);
```

진입 애니메이션 분기(현재 272~277행의 `if (visible) { ... }` 블록)를 교체:

```tsx
    if (visible) {
      if (isChainEntryRef.current) {
        // 백드롭은 즉시 불투명 — 호출부가 같은 농도의 딤을 이미 깔아 두어 이음매가 없다.
        fadeOpacity.value = 1;
        contentOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });
        return;
      }
      fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
```

⚠️ `useEffect` 의존성 배열에 `contentOpacity`를 추가할 것 (현재 285행):

```tsx
  }, [visible, fadeOpacity, translateY, contentOpacity, windowHeight]);
```

콘텐츠 애니메이션 스타일(현재 306~308행)에 opacity 추가:

```tsx
  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: contentOpacity.value,
  }));
```

`RNModal`(현재 311~317행)에 `onShow` 추가:

```tsx
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
      onShow={() => chainOnEnteredRef.current?.()}
      statusBarTranslucent
    >
```

- [ ] **Step 3: `SheetModal` 웹 경로에도 동일 신호 배선**

`WebSheetModal`은 `onShow`가 없으므로 표시 전환 시점에 직접 호출한다. import는 Step 2에서 이미 추가됐다.

`WebSheetModal` 함수 본문 맨 위(`const { isDarkMode } = useThemeStore();` 아래)에 추가:

```tsx
  const chain = useSheetChain();
  const chainOnEnteredRef = useRef(chain?.onEntered);
  chainOnEnteredRef.current = chain?.onEntered;
```

표시 effect(현재 87~113행)의 `requestAnimationFrame(() => setIsAnimating(true));`를 교체:

```tsx
      requestAnimationFrame(() => {
        setIsAnimating(true);
        chainOnEnteredRef.current?.();
      });
```

웹은 CSS transition 경로라 제자리 fade 분기를 별도로 두지 않는다 — 딤 인수인계만으로 번쩍임이 해소된다(웹 QA 항목).

- [ ] **Step 4: `OrderSheetScreen`에 Provider + 딤 레이어**

`OrderSheetScreen.tsx` import에 추가:

```ts
import { SheetChainContext, type SheetChainValue } from '@/components/ui/SheetChainContext';
```

Task 2에서 추가한 연쇄 상태 블록에 표시 상태를 추가한다:

```tsx
  // 전환 창 동안 화면을 어둡게 유지 — 시트가 사라진 순간 밝은 목록이 번쩍이는 것을 막는다.
  // 다음 시트의 백드롭과 같은 농도(black/50)라 인수인계에 이음매가 없다.
  const [chainSwapping, setChainSwapping] = useState(false);
```

`clearPendingSwap`을 교체 (딤도 함께 걷는다):

```tsx
  const clearPendingSwap = useCallback(() => {
    if (pendingSwapRef.current !== null) {
      clearTimeout(pendingSwapRef.current);
      pendingSwapRef.current = null;
    }
    setChainSwapping(false);
  }, []);
```

`confirmRow`의 예약 부분에 `setChainSwapping(true)`를 추가:

```tsx
      const next = nextUnsetRowAfter(form.getValues(), target);
      if (next === null) return;
      setChainSwapping(true);
      pendingSwapRef.current = setTimeout(() => {
        pendingSwapRef.current = null;
        openRow(next.key, next.groupIndex);
      }, SHEET_CHAIN_SWAP_MS);
```

Context 값을 만든다 (`confirmRow` 아래):

```tsx
  // 시트가 화면에 올라오면 딤을 걷는다 — 백드롭과 딤이 겹쳐 이중으로 어두워지는 프레임을 최소화.
  const handleChainEntered = useCallback(() => setChainSwapping(false), []);
  const chainValue = useMemo<SheetChainValue>(
    () => ({ entering: chainSwapping, onEntered: handleChainEntered }),
    [chainSwapping, handleChainEntered]
  );
```

`return`문의 루트 `<View className="flex-1 bg-surface-page">`를 Provider로 감싸고, 딤 레이어를 **하단 CTA 뒤(시트 블록 앞)** 에 넣는다. 딤은 형제 중 나중에 렌더돼야 위에 깔린다:

```tsx
  return (
    <SheetChainContext.Provider value={chainValue}>
      <View className="flex-1 bg-surface-page">
        {/* ... 기존 ScrollView, 하단 CTA 그대로 ... */}

        {/* 연쇄 전환 딤 — 시트가 잠깐 사라지는 구간에서 밝은 목록이 번쩍이는 것을 막는다.
            다음 시트 백드롭과 같은 black/50. pointerEvents none 이라 터치를 막지 않는다.
            ⚠️ StackHeader 는 이 컴포넌트 밖이라 상단 헤더 띠는 덮이지 않는다(실기기 QA 항목). */}
        {chainSwapping ? (
          <View
            className="absolute top-0 left-0 right-0 bottom-0 bg-black/50 dark:bg-black/50"
            pointerEvents="none"
            testID="order-sheet-chain-scrim"
          />
        ) : null}

        {/* ... 기존 시트 블록 그대로 ... */}
      </View>
    </SheetChainContext.Provider>
  );
```

- [ ] **Step 5: 딤 레이어 테스트 추가**

`OrderSheetScreen.chain.test.tsx`의 `describe` 안에 추가한다. 이 파일의 `SheetModal` 목킹은 Context를 소비하지 않으므로 `onEntered`가 호출되지 않는다 — 목킹을 Context 소비형으로 바꾼다. 파일 상단의 `jest.mock('@/components/ui/SheetModal', ...)`를 교체:

```tsx
jest.mock('@/components/ui/SheetModal', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const { useSheetChain } = require('@/components/ui/SheetChainContext');
  return {
    SheetModal: ({ visible, title, children, footer, overlay }: any) => {
      const chain = useSheetChain();
      // 실제 SheetModal 의 onShow 계약 재현 — 마운트 시 1회 통지
      React.useEffect(() => {
        if (visible) chain?.onEntered();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null;
    },
  };
});
```

테스트 2개 추가:

```tsx
  it('전환 대기 동안 딤이 깔리고, 다음 시트가 올라오면 걷힌다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={titleAndContactMissing()} />
    );

    expect(queryByTestId('order-sheet-chain-scrim')).toBeNull();

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    // 대기 중에는 딤이 화면을 덮고 있다
    expect(getByTestId('order-sheet-chain-scrim')).toBeTruthy();

    await advanceSwap();

    expect(queryByTestId('order-sheet-chain-scrim')).toBeNull();
  });

  it('연쇄가 끝나면(다음 미설정 없음) 딤이 깔리지 않는다', async () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} initialValues={onlyTitleMissing()} />
    );

    fireEvent.press(getByTestId('order-sheet-row-title'));
    fireEvent.changeText(getByTestId('order-sheet-title-input'), '주말 딜러 구합니다');
    fireEvent.press(getByText('확인'));

    expect(queryByTestId('order-sheet-chain-scrim')).toBeNull();
  });
```

- [ ] **Step 6: 테스트 실행**

```bash
cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx
```

Expected: PASS — 8 tests

- [ ] **Step 7: `SheetModal` 사용처 전역 회귀**

`SheetModal`은 앱 전역에서 쓰인다. Context 기본값 `null`이라 동작이 바뀌지 않아야 한다.

```bash
cd uniqn-mobile && npx jest --testPathPattern "(SheetModal|order-sheet|schedule|jobs)" 2>&1 | tail -20
```

Expected: 실패 0

- [ ] **Step 8: 순환 import 확인**

`SheetModal`(`components/ui/`)이 `SheetChainContext`(`components/employer/order-sheet/`)를 import하므로 방향이 역전됐다. `SheetChainContext`는 `react`만 import하는 리프 모듈이라 순환은 생기지 않지만, 실제로 확인한다:

```bash
cd uniqn-mobile && npx madge --circular --extensions ts,tsx src/components/ui/SheetModal.tsx 2>/dev/null || echo "madge 없음 — 수동 확인: SheetChainContext.tsx 의 import 가 react 뿐인지 볼 것"
```

Expected: 순환 없음. `madge`가 없으면 `SheetChainContext.tsx`가 `react` 외에 아무것도 import하지 않는지 눈으로 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add uniqn-mobile/src/components/ui/SheetChainContext.tsx uniqn-mobile/src/components/ui/SheetModal.tsx uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.chain.test.tsx
git commit -m "feat(ui): 주문서 연쇄 전환 연출 — 딤 인수인계 + 제자리 fade 진입

- SheetChainContext: 연쇄 신호를 SheetModal 이 직접 읽어 시트 12개 계약 오염 없음
- 연쇄 진입은 슬라이드 대신 제자리 fade(160ms), 백드롭은 즉시 불투명
- 전환 대기 동안 OrderSheetScreen 이 같은 농도 딤 유지 → 밝은 목록 번쩍임 제거
- onShow/rAF 로 시트 등장 시점에 딤 해제 (이중 어두워짐 프레임 최소화)"
```

---

### Task 4: 품질 게이트 + 문서

**Files:**
- Modify: `wiki/log.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 전체 품질 게이트**

```bash
cd uniqn-mobile && npm run quality
```

Expected: type-check · lint · format:check 전부 통과. 실패 시 해당 항목만 고치고 재실행.

- [ ] **Step 2: 전체 테스트**

```bash
cd uniqn-mobile && npm test 2>&1 | tail -20
```

Expected: 실패 0. 실패가 있으면 Task 2 Step 11의 대응표를 따른다.

- [ ] **Step 3: 죽은 코드 래칫 확인**

`orderRowMeta`에 export를 2개 늘렸으므로 래칫이 흔들릴 수 있다.

```bash
cd uniqn-mobile && npx knip 2>&1 | tail -10
```

Expected: 신규 export가 미사용으로 잡히지 않아야 한다(`orderedRowTargets`는 테스트에서만 쓰이므로 잡힐 수 있음 — 그 경우 `nextUnsetRowAfter` 내부 전용으로 바꾸고 export를 제거한 뒤 테스트를 `nextUnsetRowAfter` 기준으로 재작성한다).

- [ ] **Step 4: `wiki/log.md` 항목 추가**

파일 맨 위 형식(`## [날짜] 제목`)을 따라 최근 항목 위에 추가:

```markdown
## [2026-07-23] 주문서 미설정 항목 연쇄 입력

공고작성 주문서에서 미설정 항목 확인 시 다음 미설정 시트로 이어지게 했다.
순회는 `nextUnsetRowAfter`(현재 다음부터 순환, 제자리 복귀 시 종료)로 분리해
무한 재오픈을 구조적으로 차단했다. 전환 연출은 `SheetChainContext`로
`SheetModal`에만 전달해 시트 컴포넌트 12개를 건드리지 않았다.

핵심 함정: 주문서 시트는 조건부 렌더라 `visible=false` 경로를 타지 않고 즉시
언마운트된다 — exit 애니메이션이 없으므로 전환 대기는 시각 대기가 아니라
iOS 네이티브 모달 경합 회피용이다.
```

- [ ] **Step 5: `CHANGELOG.md` 항목 추가**

`Unreleased` 섹션의 `### Added`에 한 줄 추가 (섹션이 없으면 형식에 맞춰 생성):

```markdown
- 공고작성 주문서 — 미설정 항목 확인 시 다음 미설정 항목으로 자동 이어짐
```

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/wiki/log.md CHANGELOG.md 2>/dev/null || git add wiki/log.md CHANGELOG.md
git commit -m "docs(order-sheet): 미설정 항목 연쇄 입력 변경 이력 기록"
```

---

## 완료 후 사용자 게이트 (구현자가 수행하지 않음 — 보고만)

아래는 실기기가 필요해 코드 작업으로 닫을 수 없다. 완료 보고에 **미검증 항목으로 명시**할 것.

- [ ] **iOS 실기기**: 연쇄 전환 후 다음 시트의 터치가 정상 동작 (`SHEET_CHAIN_SWAP_MS = 180` 검증). 먹통이면 300으로 상향
- [ ] **iOS/Android 실기기**: 전환 중 밝은 목록 번쩍임 없음 · 이중 어두워짐(75% 농도) 프레임 없음
- [ ] **iOS/Android 실기기**: 상단 `StackHeader` 띠가 전환 중 잠깐 밝아지는지 — 거슬리면 딤을 레이아웃 루트로 승격
- [ ] **Android 실기기**: 키보드가 열린 시트(제목·연락처)에서 확인 시 전환 정상 (`ModalKeyboardAvoider` 상호작용)
- [ ] **웹**: `WebSheetModal` CSS transition 경로에서 딤 인수인계 확인
- [ ] **동작 줄이기(Reduce Motion)** 설정에서 전환이 fade만 남는지 확인
- [ ] 날짜 시트(`DatePickerModal` 경로)로 들어가고 나오는 전환은 연출이 적용되지 않음 — 체감상 수용 가능한지 확인
