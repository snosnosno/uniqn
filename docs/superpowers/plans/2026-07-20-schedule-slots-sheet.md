# 시간·역할 통합 시트 (ScheduleSlotsSheet) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고작성 주문서의 시간 시트와 역할 시트를 하나로 합치고, 역할 추가를 1탭 + 인원 숫자 직접 입력으로 줄인다.

**Architecture:** `RoleCountEditor`(역할·인원 순수 편집기)를 먼저 만들어 고정(fixed) 경로의 `RolesSheet`에 먼저 꽂아 검증한 뒤, `SlotCard`(아코디언 카드) → `ScheduleSlotsSheet`(통합 시트) 순으로 쌓아 올린다. 마지막에 `OrderSheetScreen`을 배선하면서 `TimeSlotsSheet`와 #244 지연 스왑 인프라를 삭제한다. 아래에서 위로 쌓으므로 각 단계가 독립적으로 테스트 가능하다.

**Tech Stack:** React Native 0.83 / React 19.2 / TypeScript strict / NativeWind 4.2 / react-hook-form + zod / Jest + @testing-library/react-native

**설계 문서:** `docs/superpowers/specs/2026-07-20-schedule-slots-sheet-design.md`

## Global Constraints

- 모든 주석·커밋 메시지·사용자 노출 문구는 **한글**. 영어 금지 (코드 식별자 제외).
- 경로는 `@/` 절대 경로. 시스템 절대 경로 금지.
- 필드명 camelCase. `console.log()` 금지 — 필요 시 `logger.info()`.
- 다크모드 `dark:` 항상 병기.
- **불변성**: 기존 객체·배열을 변형하지 않는다. 항상 spread로 새 값을 만든다.
- 터치 타깃 최소 44px (`min-h-[44px]` 또는 `w-11 h-11`).
- 아이콘은 `@/components/icons`에서만 import (`lucide-react-native` 직접 import는 ESLint 차단).
- 중첩 `Modal` 금지 — 시트 위 오버레이는 `SheetModal`의 `overlay` prop 사용 (#186/#243).
- 인원(`count`)은 정수 **1~99** — `orderSheetRoleSchema`(`src/schemas/orderSheet.schema.ts:36`)와 동일.
- 커스텀 역할명(`customRole`)은 **20자** — `safeText(20)`.
- 애니메이션: 진입 300ms / 종료 225ms(75%). 감소 판정은 `AccessibilityInfo.isReduceMotionEnabled()` (프로젝트 기존 패턴: `src/components/ui/Skeleton.tsx:68`, `src/components/ui/OfflineStatusBar.tsx:69`).
- `STAFF_ROLES`의 `staff` 한글명은 **'직원'** (`src/constants/jobPosting.ts:71`). '스태프'가 아니다.
- 검증 명령: `npm run quality` (type-check + lint + format:check), `npm test`. 작업 디렉토리는 `uniqn-mobile/`.

---

## 파일 구조

| 파일 | 책임 | 상태 |
|---|---|---|
| `src/components/employer/order-sheet/sheets/RoleCountEditor.tsx` | 역할 배열 하나를 편집(칩 토글·기타 직접입력·인원 조정). 시트/슬롯/고정 여부를 모름 | 신규 |
| `src/components/employer/order-sheet/sheets/SlotCard.tsx` | 슬롯 1개의 펼침/접힘 표시 — 시간 트리거·삭제·역할 편집기 배치 | 신규 |
| `src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx` | 슬롯 배열 소유, 아코디언 활성 인덱스, 시간 휠 overlay 호스팅, confirm 배출 | 신규 |
| `src/components/employer/order-sheet/sheets/RolesSheet.tsx` | `RoleCountEditor`를 감싸는 얇은 시트 (고정 타입 전용) | 축소 |
| `src/components/employer/order-sheet/sheets/TimeSlotsSheet.tsx` | — | **삭제** |
| `src/components/employer/order-sheet/OrderSheetScreen.tsx` | 행 진입 배선, 시트 렌더, 폼 반영 | 수정 |

의존 방향은 한 방향이다: `ScheduleSlotsSheet` → `SlotCard` → `RoleCountEditor`. 역방향 참조 없음.

---

### Task 1: RoleCountEditor — 칩 토글 + 인원 스테퍼

**Files:**
- Create: `src/components/employer/order-sheet/sheets/RoleCountEditor.tsx`
- Test: `src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx`

**Interfaces:**
- Consumes: `STAFF_ROLES` (`@/constants/jobPosting`), `MinusIcon`/`PlusIcon`/`TrashIcon` (`@/components/icons`), `OrderSheetValues` (`@/schemas/orderSheet.schema`)
- Produces:
  - `RoleCountEditorProps { roles: SlotRoles; onChange: (next: SlotRoles) => void }`
  - `RoleCountEditor(props): JSX.Element` — controlled 컴포넌트, 내부에 roles 상태를 두지 않음
  - `roleLabel(r: SlotRoles[number]): string` — named export, Task 5에서 재사용
  - `SlotRoles` 타입 = `OrderSheetValues['scheduleGroups'][number]['timeSlots'][number]['roles']`
  - testID: `order-role-chip-{key}` (5종), `order-role-item-{i}`, `order-role-count-minus-{i}`, `order-role-count-plus-{i}`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx`:

```tsx
/**
 * RoleCountEditor — 역할·인원 편집기 테스트 (칩 토글 + 스테퍼)
 *
 * controlled 컴포넌트이므로 Harness 로 state 를 쥐고 dump 로 결과를 검증한다.
 * 검증: (1) 칩 탭=1명 추가, (2) 재탭=해제, (3) 스테퍼 ±, (4) 하한 1, (5) 해제 후 인원 복원, (6) 삭제.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { RoleCountEditor } from '../RoleCountEditor';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type SlotRoles = OrderSheetValues['scheduleGroups'][number]['timeSlots'][number]['roles'];

function Harness({ initial = [] as SlotRoles }) {
  const [roles, setRoles] = useState<SlotRoles>(initial);
  return (
    <>
      <RoleCountEditor roles={roles} onChange={setRoles} />
      <Text testID="dump">{JSON.stringify(roles)}</Text>
    </>
  );
}

const dump = (getByTestId: (id: string) => { props: { children: string } }) =>
  JSON.parse(getByTestId('dump').props.children) as SlotRoles;

describe('RoleCountEditor — 칩 토글', () => {
  it('딜러 칩 탭 → 1명으로 추가된다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 1 }]);
  });

  it('선택된 칩 재탭 → 해제된다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    expect(dump(getByTestId)).toEqual([]);
  });

  it("'기타'는 토글 칩으로 노출되지 않는다 (＋ 직접 입력 액션으로 분리)", () => {
    const { queryByTestId } = render(<Harness />);
    expect(queryByTestId('order-role-chip-other')).toBeNull();
  });

  it('직원 칩 라벨은 "직원" (스태프 아님)', () => {
    const { getByText } = render(<Harness />);
    expect(getByText('직원')).toBeTruthy();
  });

  it('스테퍼 + → 인원 증가', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 2 }]);
  });

  it('스테퍼 − 는 1 밑으로 내려가지 않는다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    fireEvent.press(getByTestId('order-role-count-minus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 1 }]);
  });

  it('스테퍼 + 는 99를 넘지 않는다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 99 }]} />);
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 99 }]);
  });

  it('칩 해제 후 재선택 → 직전 인원이 복원된다 (오조작 복구)', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 12 }]} />);
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 해제
    expect(dump(getByTestId)).toEqual([]);
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 재선택
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 12 }]);
  });

  it('삭제 버튼 → 해당 행 제거', () => {
    const { getByTestId, getByLabelText } = render(
      <Harness
        initial={[
          { role: 'dealer', count: 2 },
          { role: 'floor', count: 1 },
        ]}
      />
    );
    fireEvent.press(getByLabelText('딜러 삭제'));
    expect(dump(getByTestId)).toEqual([{ role: 'floor', count: 1 }]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx`
Expected: FAIL — `Cannot find module '../RoleCountEditor'`

- [ ] **Step 3: 최소 구현**

`src/components/employer/order-sheet/sheets/RoleCountEditor.tsx`:

```tsx
/**
 * RoleCountEditor — 역할·인원 편집기 (공용)
 *
 * @description 날짜형(ScheduleSlotsSheet 슬롯)과 고정(RolesSheet)이 공유하는 controlled 편집기.
 * 일반 역할 5종은 칩 토글(탭=1명 추가, 재탭=해제)이지만 '기타'는 토글하지 않는다 —
 * 이름이 다른 커스텀 역할을 여러 개 담을 수 있어야 하므로 "＋ 직접 입력" 액션으로 분리한다(설계 §4.1).
 * 시트·슬롯·고정 여부를 모르며 roles/onChange 만 받는다.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { STAFF_ROLES } from '@/constants/jobPosting';
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { roleName } from '../orderRowMeta';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

export type SlotRoles =
  OrderSheetValues['scheduleGroups'][number]['timeSlots'][number]['roles'];
type RoleKey = SlotRoles[number]['role'];
type ToggleRoleKey = Exclude<RoleKey, 'other'>;

const MIN_COUNT = 1;
const MAX_COUNT = 99;
const clampCount = (n: number) => Math.min(MAX_COUNT, Math.max(MIN_COUNT, n));

/** 토글 대상 = '기타'를 제외한 5종. '기타'는 직접입력 액션으로 분리(§4.1) */
const TOGGLE_ROLES = STAFF_ROLES.filter((r) => r.key !== 'other');

/**
 * 역할 표시명 — orderRowMeta.roleName(orderRowMeta.ts:297) 재사용.
 * 구 RolesSheet 는 같은 로직을 로컬로 재정의했는데, 그 중복을 여기서 끝낸다.
 */
export const roleLabel = (r: SlotRoles[number]) => roleName(r.role, r.customRole);

export interface RoleCountEditorProps {
  roles: SlotRoles;
  onChange: (next: SlotRoles) => void;
}

export function RoleCountEditor({ roles, onChange }: RoleCountEditorProps) {
  // 칩 해제 시 인원 기억 — 실수로 껐다 켰을 때 "딜러 12명"이 1명으로 리셋되지 않게 한다(§4.2).
  // 폼이 아니라 컴포넌트 로컬 state — 시트를 닫으면 사라진다.
  const [lastCount, setLastCount] = useState<Partial<Record<ToggleRoleKey, number>>>({});

  const toggleRole = (key: ToggleRoleKey) => {
    const found = roles.find((r) => r.role === key);
    if (found) {
      setLastCount((prev) => ({ ...prev, [key]: found.count }));
      onChange(roles.filter((r) => r.role !== key));
      return;
    }
    onChange([...roles, { role: key, count: lastCount[key] ?? MIN_COUNT }]);
  };

  const setCountAt = (i: number, next: number) =>
    onChange(roles.map((r, idx) => (idx === i ? { ...r, count: clampCount(next) } : r)));

  const removeAt = (i: number) => {
    const target = roles[i];
    if (target && target.role !== 'other') {
      setLastCount((prev) => ({ ...prev, [target.role]: target.count }));
    }
    onChange(roles.filter((_, idx) => idx !== i));
  };

  return (
    <View>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {TOGGLE_ROLES.map((r) => {
          const checked = roles.some((x) => x.role === r.key);
          return (
            <Pressable
              key={r.key}
              onPress={() => toggleRole(r.key as ToggleRoleKey)}
              testID={`order-role-chip-${r.key}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={r.name}
              className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${
                checked
                  ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay'
              } active:opacity-80`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  checked ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'
                }`}
              >
                {r.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {roles.length > 0 && (
        <View className="gap-1.5">
          {roles.map((r, i) => (
            <View
              key={`${r.role}-${r.customRole ?? ''}-${i}`}
              testID={`order-role-item-${i}`}
              className="flex-row items-center justify-between rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-2.5"
            >
              <Text
                className="flex-1 text-sm font-sans-medium text-content-primary"
                numberOfLines={1}
              >
                {roleLabel(r)}
              </Text>
              <View className="flex-row items-center gap-1">
                <Pressable
                  onPress={() => setCountAt(i, r.count - 1)}
                  testID={`order-role-count-minus-${i}`}
                  className="w-11 h-11 items-center justify-center active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`${roleLabel(r)} 인원 줄이기`}
                >
                  <MinusIcon size={16} />
                </Pressable>
                <Text className="text-sm font-sans-bold text-content-primary w-10 text-center">
                  {r.count}명
                </Text>
                <Pressable
                  onPress={() => setCountAt(i, r.count + 1)}
                  testID={`order-role-count-plus-${i}`}
                  className="w-11 h-11 items-center justify-center active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`${roleLabel(r)} 인원 늘리기`}
                >
                  <PlusIcon size={16} />
                </Pressable>
                <Pressable
                  onPress={() => removeAt(i)}
                  className="w-11 h-11 items-center justify-center active:opacity-80"
                  accessibilityRole="button"
                  accessibilityLabel={`${roleLabel(r)} 삭제`}
                >
                  <TrashIcon size={16} />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx`
Expected: PASS — 9 tests passed

- [ ] **Step 5: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/RoleCountEditor.tsx src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx
git commit -m "feat(order-sheet): RoleCountEditor 칩 토글 + 인원 스테퍼

역할 추가 3단계(칩 → 사전 스테퍼 → 추가 버튼)를 칩 1탭으로 축소.
칩 해제 시 직전 인원을 기억해 재선택 시 복원한다(오조작 복구)."
```

---

### Task 2: RoleCountEditor — '기타' 직접 입력

'기타'를 칩 토글로 만들면 커스텀 역할이 1개로 제한되어 기능이 축소된다(현행 `RolesSheet.tsx:52-56`은 이름이 다르면 여러 개 담는다). 그래서 별도 액션으로 남긴다.

**Files:**
- Modify: `src/components/employer/order-sheet/sheets/RoleCountEditor.tsx`
- Test: `src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx` (describe 블록 추가)

**Interfaces:**
- Consumes: Task 1의 `RoleCountEditor`, `useThemeStore` (`@/stores/themeStore`), `SECONDARY_PALETTE` (`@/constants/colors`)
- Produces: testID `order-role-custom-open` (입력 열기), `order-sheet-role-custom` (TextInput), `order-role-add` (추가 확정)

- [ ] **Step 1: 실패하는 테스트 추가**

`__tests__/RoleCountEditor.test.tsx` 하단에 append:

```tsx
describe('RoleCountEditor — 기타 직접 입력', () => {
  it('＋ 직접 입력 → 이름 입력 → 추가 시 other+customRole 로 담긴다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '  칩카운터  ');
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([{ role: 'other', customRole: '칩카운터', count: 1 }]);
  });

  it('이름이 다른 커스텀 역할을 여러 개 담을 수 있다 (기능 보존)', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '칩카운터');
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '안내');
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([
      { role: 'other', customRole: '칩카운터', count: 1 },
      { role: 'other', customRole: '안내', count: 1 },
    ]);
  });

  it('이름이 비면 추가되지 않는다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([]);
  });

  it('같은 이름을 다시 추가하면 중복 행이 생기지 않는다', () => {
    const { getByTestId } = render(
      <Harness initial={[{ role: 'other', customRole: '칩카운터', count: 3 }]} />
    );
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '칩카운터');
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([{ role: 'other', customRole: '칩카운터', count: 3 }]);
  });

  it('커스텀 역할도 스테퍼로 인원 조정된다', () => {
    const { getByTestId } = render(
      <Harness initial={[{ role: 'other', customRole: '칩카운터', count: 1 }]} />
    );
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'other', customRole: '칩카운터', count: 2 }]);
  });

  // roleLabel 의 'other' 분기(= roleName 위임의 핵심 갈래) 직접 커버.
  // Task 1 리뷰 지적: 이 분기가 레포 어디에서도 단언되지 않고 있었다.
  it("커스텀 역할은 이름이 그대로 표시된다 (roleLabel 'other' 분기)", () => {
    const { getByText, getByLabelText } = render(
      <Harness initial={[{ role: 'other', customRole: '칩카운터', count: 1 }]} />
    );
    expect(getByText('칩카운터')).toBeTruthy();
    expect(getByLabelText('칩카운터 인원 늘리기')).toBeTruthy();
  });

  it("customRole 이 없는 'other' 는 '기타'로 표시된다", () => {
    const { getByText } = render(<Harness initial={[{ role: 'other', count: 1 }]} />);
    expect(getByText('기타')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx -t "기타 직접 입력"`
Expected: FAIL — `Unable to find an element with testID: order-role-custom-open`

- [ ] **Step 3: 구현 — import 추가**

`RoleCountEditor.tsx` 상단 import를 다음으로 교체:

```tsx
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { STAFF_ROLES } from '@/constants/jobPosting';
import { MinusIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { roleName } from '../orderRowMeta';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
```

⚠️ `roleName` 줄을 빠뜨리지 말 것 — `roleLabel`이 이 함수에 위임한다.

- [ ] **Step 4: 구현 — state와 핸들러 추가**

`const [lastCount, setLastCount] = useState...` 바로 아래에 추가:

```tsx
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  /** 커스텀 역할 추가 — 같은 이름이 이미 있으면 기존 행을 유지(중복 행 방지, 현행 시맨틱 승계) */
  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const exists = roles.some((r) => r.role === 'other' && r.customRole === name);
    if (!exists) {
      onChange([...roles, { role: 'other', customRole: name, count: MIN_COUNT }]);
    }
    setCustomName('');
    setCustomOpen(false);
  };
```

- [ ] **Step 5: 구현 — 칩 목록 뒤에 직접입력 UI 추가**

칩 `</View>`(`flex-row flex-wrap gap-2 mb-3` 닫는 태그) **안쪽 맨 끝**, `TOGGLE_ROLES.map(...)` 뒤에 추가:

```tsx
        <Pressable
          onPress={() => setCustomOpen((v) => !v)}
          testID="order-role-custom-open"
          accessibilityRole="button"
          accessibilityLabel="역할 직접 입력"
          className="px-3.5 py-2 min-h-[44px] justify-center rounded-full border border-dashed border-secondary-300 dark:border-surface-overlay active:opacity-80"
        >
          <Text className="text-sm font-sans-medium text-content-secondary">＋ 직접 입력</Text>
        </Pressable>
```

그리고 칩 컨테이너 `</View>` **바깥**, 역할 행 목록 **앞**에 추가:

```tsx
      {customOpen && (
        <View className="mb-3 gap-2">
          <TextInput
            value={customName}
            onChangeText={setCustomName}
            maxLength={20}
            placeholder="역할 이름 직접 입력 (예: 칩카운터)"
            placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
            testID="order-sheet-role-custom"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
          />
          <Pressable
            onPress={addCustom}
            disabled={customName.trim().length === 0}
            testID="order-role-add"
            accessibilityRole="button"
            accessibilityLabel="입력한 역할 추가"
            className={`min-h-[44px] items-center justify-center rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 active:opacity-80 ${
              customName.trim().length === 0 ? 'opacity-40' : ''
            }`}
          >
            <Text className="text-sm text-content-secondary font-sans">이 역할 추가</Text>
          </Pressable>
        </View>
      )}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx`
Expected: PASS — 16 tests passed (기존 9 + 신규 7)

- [ ] **Step 7: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/RoleCountEditor.tsx src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx
git commit -m "feat(order-sheet): RoleCountEditor 기타 역할 직접 입력

'기타'를 칩 토글로 만들면 커스텀 역할이 1개로 제한되므로
＋ 직접 입력 액션으로 분리 — 이름이 다르면 여러 개 담긴다."
```

---

### Task 3: RoleCountEditor — 인원 숫자 직접 입력

인원 12명을 + 11번으로 만드는 건 고문이다. 숫자를 탭하면 키패드로 직접 입력한다.

**Files:**
- Modify: `src/components/employer/order-sheet/sheets/RoleCountEditor.tsx`
- Test: `src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx` (describe 블록 추가)

**Interfaces:**
- Produces: testID `order-role-count-input-{i}` — `keyboardType="number-pad"`, blur 시 1~99 clamp, 빈값이면 직전 값 복구

- [ ] **Step 1: 실패하는 테스트 추가**

`__tests__/RoleCountEditor.test.tsx` 하단에 append:

```tsx
describe('RoleCountEditor — 인원 숫자 직접 입력', () => {
  it('숫자 입력 후 blur → 값이 반영된다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '12');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 12 }]);
  });

  it('99 초과 입력 → 99로 clamp', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '99');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 99 }]);
  });

  it('빈 문자열로 blur → 직전 값이 복구된다 (0명 저장 방지)', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 5 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 5 }]);
  });

  it('0 입력 → 직전 값이 복구된다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 5 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '0');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 5 }]);
  });

  it('숫자가 아닌 문자는 무시된다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '1a2');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 12 }]);
  });

  // Minor-2 회귀 가드 — 칩 해제로 기억된 인원이 범위 밖이어도 재선택 시 clamp 되어야 한다.
  // (레거시 draft 의 count=150 같은 값이 하이드레이션으로 흘러들어오는 경로)
  it('범위 밖 인원을 기억했다가 재선택하면 99로 clamp 된다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 150 }]} />);
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 해제 → lastCount=150 기억
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 재선택 → clamp
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 99 }]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx -t "숫자 직접 입력"`
Expected: FAIL — `Unable to find an element with testID: order-role-count-input-0`

- [ ] **Step 3: Task 1 리뷰 Minor 2건 동시 처리 (clamp 일관성)**

Task 1 리뷰가 clamp 관련 결함 2건을 지적했다. 숫자 입력을 붙이면 노출 반경이 커지므로 여기서 함께 고친다.

**Minor-1 — clamp 경계에서 no-op `onChange`**: count=1에서 −, count=99에서 + 를 눌러도 매번 새 배열을 emit해 부모의 `form.setValue(..., { shouldValidate: true })`가 폼 전체 zod 재검증을 돌린다. `setCountAt`을 다음으로 교체:

```tsx
  const setCountAt = (i: number, next: number) => {
    const clamped = clampCount(next);
    if (clamped === roles[i]?.count) return; // 경계 탭 no-op — 불필요한 재검증 차단
    onChange(roles.map((r, idx) => (idx === i ? { ...r, count: clamped } : r)));
  };
```

**Minor-2 — 추가·복원 경로가 clamp를 안 탄다**: `lastCount[key] ?? MIN_COUNT`는 `??`라서 0을 통과시키고, 레거시 draft의 범위 밖 값(150 등)도 그대로 흘린다. `toggleRole`의 추가 분기를 다음으로 교체:

```tsx
    onChange([...roles, { role: key, count: clampCount(lastCount[key] ?? MIN_COUNT) }]);
```

- [ ] **Step 4: 구현 — 편집 상태 추가**

`const [customName, setCustomName] = useState('');` 아래에 추가:

```tsx
  // 편집 중 raw 문자열 — 중간 상태("1")를 즉시 clamp 하면 두 자리 입력이 불가능해진다.
  // 한 번에 한 입력만 포커스되므로 단일 슬롯으로 충분하다.
  const [editing, setEditing] = useState<{ index: number; text: string } | null>(null);

  const commitEditing = (i: number) => {
    const parsed = Number.parseInt(editing?.text ?? '', 10);
    // 빈값·0·NaN 은 직전 값 유지 — 0명 저장 방지(§4.3)
    if (Number.isFinite(parsed) && parsed >= MIN_COUNT) setCountAt(i, parsed);
    setEditing(null);
  };
```

- [ ] **Step 5: 구현 — 인원 Text를 TextInput으로 교체**

역할 행의 다음 블록을

```tsx
                <Text className="text-sm font-sans-bold text-content-primary w-10 text-center">
                  {r.count}명
                </Text>
```

다음으로 교체:

```tsx
                <TextInput
                  value={editing?.index === i ? editing.text : String(r.count)}
                  onFocus={() => setEditing({ index: i, text: String(r.count) })}
                  onChangeText={(t) =>
                    setEditing({ index: i, text: t.replace(/[^0-9]/g, '').slice(0, 2) })
                  }
                  onBlur={() => commitEditing(i)}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  testID={`order-role-count-input-${i}`}
                  accessibilityLabel={`${roleLabel(r)} 인원, 숫자 직접 입력`}
                  className="w-10 h-11 text-center text-sm font-sans-bold text-content-primary"
                />
```

`autoFocus`는 쓰지 않는다 — 사용자가 숫자를 탭했을 때만 포커스된다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx`
Expected: PASS — 19 tests passed

- [ ] **Step 7: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/RoleCountEditor.tsx src/components/employer/order-sheet/sheets/__tests__/RoleCountEditor.test.tsx
git commit -m "feat(order-sheet): 인원 숫자 직접 입력 (1~99 clamp)

12명을 + 11번으로 만들지 않도록 숫자 탭 시 키패드 입력.
편집 중에는 raw 문자열을 유지하고 blur 시 clamp — 빈값·0은 직전 값 복구."
```

---

### Task 4: RolesSheet를 RoleCountEditor 껍데기로 축소

고정(fixed) 경로를 먼저 새 편집기로 옮겨, 통합 시트를 만들기 전에 편집기가 실제 시트 안에서 동작하는지 확인한다.

**Files:**
- Modify: `src/components/employer/order-sheet/sheets/RolesSheet.tsx` (222줄 → 약 40줄)
- Test: `src/components/employer/order-sheet/sheets/__tests__/RolesSheet.test.tsx` (전면 재작성)

**Interfaces:**
- Consumes: `RoleCountEditor`, `SlotRoles` (Task 1)
- Produces: `RolesSheetProps`는 **변경 없음** — `{ visible, value, onConfirm, onClose }`. `OrderSheetScreen`의 `fixedRoles` 배선(`OrderSheetScreen.tsx:834-855`)은 손대지 않는다.

- [ ] **Step 1: 테스트 재작성**

`__tests__/RolesSheet.test.tsx` 전체를 다음으로 교체:

```tsx
/**
 * RolesSheet — 고정(fixed) 역할 시트 테스트
 *
 * RoleCountEditor 를 감싸는 얇은 껍데기가 되었으므로, 시트 계약(확인=onConfirm+onClose,
 * 빈 목록이면 확인 비활성)만 검증한다. 편집 동작 자체는 RoleCountEditor.test.tsx 담당.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { RolesSheet } from '../RolesSheet';

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

describe('RolesSheet', () => {
  it('칩으로 역할 선택 후 확인 → onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={onClose} />
    );
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'dealer', count: 1 }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('빈 목록이면 확인 비활성 (onConfirm 미호출)', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('초기 value 를 시드로 받아 편집한다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet
        visible
        value={[{ role: 'dealer', count: 2 }]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([{ role: 'dealer', count: 3 }]);
  });

  it('커스텀 역할도 확인 시 그대로 배출된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <RolesSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '칩카운터');
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { role: 'other', customRole: '칩카운터', count: 1 },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RolesSheet.test.tsx`
Expected: FAIL — `Unable to find an element with testID: order-role-custom-open` (현행 RolesSheet에는 없는 testID)

- [ ] **Step 3: RolesSheet 축소**

`src/components/employer/order-sheet/sheets/RolesSheet.tsx` 전체를 다음으로 교체:

```tsx
/**
 * RolesSheet — 고정(fixed) 역할 시트
 *
 * @description 편집 UI는 RoleCountEditor 가 전담하고 이 시트는 SheetModal 껍데기 + 확인 계약만 갖는다.
 * 날짜형(dated)은 ScheduleSlotsSheet 가 같은 편집기를 슬롯 카드 안에 인라인으로 쓴다 —
 * 두 경로의 역할 입력 방식이 자동으로 일치한다.
 * onConfirm 으로 흘려보내면 부모가 form.setValue 로 zod safeText(customRole XSS·max20) 경계를 태운다.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { RoleCountEditor, type SlotRoles } from './RoleCountEditor';

export interface RolesSheetProps {
  visible: boolean;
  value: SlotRoles;
  onConfirm: (next: SlotRoles) => void;
  onClose: () => void;
}

export function RolesSheet({ visible, value, onConfirm, onClose }: RolesSheetProps) {
  const [roles, setRoles] = useState<SlotRoles>(value);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="어떤 역할이 필요하세요?"
      footer={
        <Button
          onPress={() => {
            onConfirm(roles);
            onClose();
          }}
          disabled={roles.length === 0}
        >
          확인
        </Button>
      }
    >
      <View className="px-4 pt-3 pb-2">
        <RoleCountEditor roles={roles} onChange={setRoles} />
      </View>
    </SheetModal>
  );
}
```

- [ ] **Step 4: `'명'` 단위 라벨 복원 (Task 3 리뷰 이월)**

Task 3에서 인원 표시를 `<Text>{r.count}명</Text>`에서 `TextInput`으로 교체하면서 **'명' 단위가 사라졌다**. 구 `RolesSheet.tsx:194-196`은 지금도 `{r.count}명`을 렌더하므로, 이 태스크가 그 인라인 블록을 `RoleCountEditor`로 교체하는 순간 **눈에 보이는 UI 회귀**가 된다. 그래서 여기서 복원한다.

`RoleCountEditor.tsx`의 인원 `TextInput` **바로 뒤**에 형제로 추가 (기존 `RolesSheet.tsx:142` 패턴 승계):

```tsx
                <Text className="text-xs text-content-muted font-sans">명</Text>
```

`TextInput`의 `w-10 h-11 text-center`는 그대로 두고 옆에 붙이기만 한다 — 폭 제약을 건드리지 말 것.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/RolesSheet.test.tsx`
Expected: PASS — 4 tests passed

- [ ] **Step 6: 칩 시맨틱 변경의 하류 테스트 갱신 (2파일)**

Task 1 리뷰 지적 — `order-role-chip-*`를 **라디오(칩 선택 → "이 역할 추가" 버튼)** 전제로 누르는 기존 테스트가 두 파일에 있다. 칩이 "1탭 = 즉시 추가"로 바뀌므로 **이 태스크에서 깨진다**(Task 8이 아니다).

| 파일 | 알려진 사용처 |
|---|---|
| `src/components/employer/order-sheet/__tests__/OrderSheetScreen.fixed.test.tsx` | `:99`, `:121` |
| `src/components/employer/order-sheet/__tests__/OrderSheetScreen.salarySync.test.tsx` | `:85`, `:108` |

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.fixed.test.tsx src/components/employer/order-sheet/__tests__/OrderSheetScreen.salarySync.test.tsx`

실패하는 곳마다 다음 변환을 적용한다:
- `order-role-chip-{key}` 탭 **후** `order-role-add` 탭으로 역할을 추가하던 시퀀스 → `order-role-chip-{key}` 탭 **1회**로 축약 (`order-role-add`는 이제 '기타 직접 입력' 전용이다)
- 상단 사전 스테퍼(`order-role-count-plus` — 인덱스 없음)로 인원을 올리던 것 → 행 스테퍼(`order-role-count-plus-0`)로 교체
- '기타' 커스텀 역할 추가는 `order-role-custom-open` → `order-sheet-role-custom` 입력 → `order-role-add` 순서로 교체

**단언의 의도는 바꾸지 말 것** — 이 두 테스트는 각각 고정 타입 역할 반영과 역할별 급여 동기화를 지키는 것이지 칩 조작 방식을 지키는 게 아니다. 최종 `onConfirm`/`roleSalaries` 기대값이 달라진다면 그건 회귀이므로 테스트가 아니라 구현을 의심하라.

Expected: 두 파일 모두 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/RolesSheet.tsx src/components/employer/order-sheet/sheets/__tests__/RolesSheet.test.tsx src/components/employer/order-sheet/__tests__/OrderSheetScreen.fixed.test.tsx
git commit -m "refactor(order-sheet): RolesSheet를 RoleCountEditor 껍데기로 축소

222줄 → 40줄. 고정(fixed) 경로가 새 편집기를 먼저 쓰게 해
통합 시트를 만들기 전에 실제 시트 안에서의 동작을 확인한다."
```

---

### Task 5: SlotCard — 아코디언 카드

**Files:**
- Create: `src/components/employer/order-sheet/sheets/SlotCard.tsx`
- Test: `src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx`

**Interfaces:**
- Consumes: `RoleCountEditor`, `roleLabel`, `SlotRoles` (Task 1), `ChevronRightIcon` (`@/components/icons`)
- Produces:
  ```ts
  interface SlotCardProps {
    slot: { startTime: string; roles: SlotRoles };
    index: number;
    expanded: boolean;
    removable: boolean;
    onExpand: () => void;
    onPressTime: () => void;
    onChangeRoles: (next: SlotRoles) => void;
    onRemove: () => void;
  }
  ```
  testID: `order-time-roles-{i}` (접힘 카드 = 펼침 트리거), `order-time-start-{i}` (시간 트리거), `order-time-remove-{i}` (삭제)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx`:

```tsx
/**
 * SlotCard — 슬롯 카드 테스트 (아코디언 펼침/접힘)
 *
 * 검증: (1) 접힘=요약만, (2) 접힘 탭=onExpand, (3) 펼침=시간 트리거+역할 편집기,
 * (4) 삭제 버튼 노출 조건, (5) 요약은 한글 라벨.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { SlotCard } from '../SlotCard';

const baseProps = {
  index: 0,
  removable: false,
  onExpand: jest.fn(),
  onPressTime: jest.fn(),
  onChangeRoles: jest.fn(),
  onRemove: jest.fn(),
};

describe('SlotCard', () => {
  it('접힘 상태는 요약만 보이고 역할 편집기는 렌더되지 않는다', () => {
    const { getByText, queryByTestId } = render(
      <SlotCard
        {...baseProps}
        expanded={false}
        slot={{ startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] }}
      />
    );
    expect(getByText('22:00 · 딜러 1명')).toBeTruthy();
    expect(queryByTestId('order-role-chip-dealer')).toBeNull();
  });

  it('접힘 카드 탭 → onExpand 호출', () => {
    const onExpand = jest.fn();
    const { getByTestId } = render(
      <SlotCard
        {...baseProps}
        onExpand={onExpand}
        expanded={false}
        slot={{ startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] }}
      />
    );
    fireEvent.press(getByTestId('order-time-roles-0'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('펼침 상태는 시간 트리거와 역할 편집기를 렌더한다', () => {
    const { getByTestId, getByText } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('시간 미설정이면 --:-- 로 표시', () => {
    const { getByText } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '', roles: [] }} />
    );
    expect(getByText('출근 --:--')).toBeTruthy();
  });

  it('시간 트리거 탭 → onPressTime 호출', () => {
    const onPressTime = jest.fn();
    const { getByTestId } = render(
      <SlotCard
        {...baseProps}
        onPressTime={onPressTime}
        expanded
        slot={{ startTime: '19:00', roles: [] }}
      />
    );
    fireEvent.press(getByTestId('order-time-start-0'));
    expect(onPressTime).toHaveBeenCalledTimes(1);
  });

  it('removable=false 면 삭제 버튼이 없다', () => {
    const { queryByTestId } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(queryByTestId('order-time-remove-0')).toBeNull();
  });

  it('removable=true 면 삭제 버튼 탭 시 onRemove 호출', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(
      <SlotCard
        {...baseProps}
        removable
        onRemove={onRemove}
        expanded
        slot={{ startTime: '19:00', roles: [] }}
      />
    );
    fireEvent.press(getByTestId('order-time-remove-0'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('접힘 요약은 한글 라벨 — raw key(dealer) 노출 금지', () => {
    const { getByText, queryByText } = render(
      <SlotCard
        {...baseProps}
        expanded={false}
        slot={{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }}
      />
    );
    expect(getByText('19:00 · 딜러 2명')).toBeTruthy();
    expect(queryByText('19:00 · dealer 2명')).toBeNull();
  });

  it('역할이 없으면 접힘 요약에 안내 문구', () => {
    const { getByText } = render(
      <SlotCard {...baseProps} expanded={false} slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(getByText('19:00 · 역할 미설정')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx`
Expected: FAIL — `Cannot find module '../SlotCard'`

- [ ] **Step 3: 구현**

`src/components/employer/order-sheet/sheets/SlotCard.tsx`:

```tsx
/**
 * SlotCard — 슬롯 1개(출근 시간 + 역할)의 아코디언 카드
 *
 * @description 펼침이면 시간 트리거·삭제·RoleCountEditor 를 렌더하고, 접힘이면 한 줄 요약만 렌더한다.
 * 접힘 시 편집기를 아예 마운트하지 않으므로 여러 카드가 있어도 역할 testID 가 충돌하지 않는다.
 * 활성 인덱스는 부모(ScheduleSlotsSheet)가 소유한다 — 이 컴포넌트는 상태를 갖지 않는다.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRightIcon } from '@/components/icons';
import { RoleCountEditor, roleLabel, type SlotRoles } from './RoleCountEditor';

export interface SlotCardProps {
  slot: { startTime: string; roles: SlotRoles };
  index: number;
  expanded: boolean;
  /** 슬롯이 2개 이상일 때만 true — 마지막 슬롯은 삭제 불가 */
  removable: boolean;
  onExpand: () => void;
  onPressTime: () => void;
  onChangeRoles: (next: SlotRoles) => void;
  onRemove: () => void;
}

/** 접힘 요약 — 한글 라벨 사용(raw key "dealer" 노출 금지) */
const summarize = (slot: SlotCardProps['slot']) => {
  const time = slot.startTime || '--:--';
  const roles =
    slot.roles.length > 0
      ? slot.roles.map((r) => `${roleLabel(r)} ${r.count}명`).join(' · ')
      : '역할 미설정';
  return `${time} · ${roles}`;
};

export function SlotCard({
  slot,
  index,
  expanded,
  removable,
  onExpand,
  onPressTime,
  onChangeRoles,
  onRemove,
}: SlotCardProps) {
  if (!expanded) {
    return (
      <Pressable
        onPress={onExpand}
        testID={`order-time-roles-${index}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        accessibilityLabel={`${summarize(slot)}, 탭하여 펼치기`}
        className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 active:opacity-80"
      >
        <Text className="flex-1 text-sm font-sans-medium text-content-secondary" numberOfLines={1}>
          {summarize(slot)}
        </Text>
        <ChevronRightIcon size={16} />
      </Pressable>
    );
  }

  return (
    <View
      accessibilityState={{ expanded: true }}
      className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3"
    >
      <View className="flex-row items-center justify-between mb-2">
        <Pressable
          onPress={onPressTime}
          testID={`order-time-start-${index}`}
          accessibilityRole="button"
          accessibilityLabel={`출근 시간 ${slot.startTime || '미설정'} 변경`}
          className="min-h-[44px] justify-center active:opacity-80"
        >
          <Text className="text-base font-sans-bold text-content-primary">
            출근 {slot.startTime || '--:--'}
          </Text>
        </Pressable>
        {removable && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            testID={`order-time-remove-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}번째 시간대 삭제`}
            className="min-h-[44px] px-2 justify-center active:opacity-80"
          >
            <Text className="text-sm text-content-muted font-sans">삭제</Text>
          </Pressable>
        )}
      </View>
      <RoleCountEditor roles={slot.roles} onChange={onChangeRoles} />
    </View>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx`
Expected: PASS — 9 tests passed

- [ ] **Step 5: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/SlotCard.tsx src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx
git commit -m "feat(order-sheet): SlotCard 아코디언 카드

접힘 시 편집기를 마운트하지 않아 여러 카드가 있어도 testID 가 충돌하지 않는다.
활성 인덱스는 부모가 소유 — SlotCard 는 무상태."
```

---

### Task 6: ScheduleSlotsSheet — 통합 시트

**Files:**
- Create: `src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx`
- Test: `src/components/employer/order-sheet/sheets/__tests__/ScheduleSlotsSheet.test.tsx`

**Interfaces:**
- Consumes: `SlotCard` (Task 5), `SheetModal` (`@/components/ui/SheetModal`), `Button` (`@/components/ui/Button`), `TimeWheelPicker`/`TimeValue` (`@/components/ui/TimeWheelPicker`), `PlusIcon` (`@/components/icons`)
- Produces:
  ```ts
  interface ScheduleSlotsSheetProps {
    visible: boolean;
    value: Slots;          // OrderSheetValues['scheduleGroups'][number]['timeSlots']
    onConfirm: (next: Slots) => void;
    onClose: () => void;
  }
  ```
  **`onEditSlotRoles`는 없다** — 역할 편집이 시트 내부로 들어오면서 시트 전환 콜백 자체가 사라진다.
  testID: `order-time-add-slot`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/employer/order-sheet/sheets/__tests__/ScheduleSlotsSheet.test.tsx`:

```tsx
/**
 * ScheduleSlotsSheet — 시간·역할 통합 시트 테스트
 *
 * SheetModal 은 children+footer+overlay 렌더로, TimeWheelPicker 는 확인 스텁으로 모킹(기존 관례 승계).
 * 검증: (1) 빈 값이면 기본 슬롯 1개 펼침, (2) 시트 안에서 시간·역할을 모두 편집,
 * (3) 아코디언 활성 전환, (4) 첫 미완성 슬롯 자동 펼침, (5) 추가/삭제, (6) 확인 배출.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { ScheduleSlotsSheet } from '../ScheduleSlotsSheet';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer, overlay }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, onConfirm }: any) =>
      visible ? (
        <Pressable testID="mock-time-confirm" onPress={() => onConfirm({ hour: 20, minute: 30 })}>
          <Text>MockPicker</Text>
        </Pressable>
      ) : null,
  };
});

describe('ScheduleSlotsSheet', () => {
  it('빈 값이면 기본 슬롯 1개(19:00)가 펼쳐진 채로 시작', () => {
    const { getByText, getByTestId } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('시간과 역할을 같은 시트에서 편집해 확인까지 간다 (통합의 핵심)', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={onConfirm} onClose={onClose} />
    );
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm'));
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '20:30', roles: [{ role: 'dealer', count: 1 }] },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('진입 시 첫 미완성 슬롯이 펼쳐진다 (역할 0개인 두 번째)', () => {
    const { getByText, queryByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByText('출근 22:00')).toBeTruthy();
    expect(queryByText('출근 19:00')).toBeNull(); // 첫 슬롯은 접힘
    expect(getByText('19:00 · 딜러 1명')).toBeTruthy();
  });

  it('모두 완성이면 첫 카드가 펼쳐진다', () => {
    const { getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByText('22:00 · 딜러 1명')).toBeTruthy();
  });

  it('접힌 카드를 탭하면 그 카드가 펼쳐지고 기존 카드는 접힌다', () => {
    const { getByText, getByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-roles-1'));
    expect(getByText('출근 22:00')).toBeTruthy();
    expect(getByText('19:00 · 딜러 1명')).toBeTruthy();
  });

  it('시간대 추가 → 새 카드가 펼쳐지고 직전 카드는 접힌다', () => {
    const { getByText, getByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-add-slot'));
    expect(getByText('출근 --:--')).toBeTruthy();
    expect(getByText('19:00 · 딜러 2명')).toBeTruthy();
  });

  it('새 슬롯은 첫 슬롯의 역할을 깊은복사로 시드받는다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-add-slot'));
    // 새 카드에서 인원을 바꿔도 첫 슬롯이 오염되지 않아야 한다
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] },
      { startTime: '', roles: [{ role: 'dealer', count: 3 }] },
    ]);
  });

  it('슬롯이 1개면 삭제 버튼이 없다', () => {
    const { queryByTestId } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(queryByTestId('order-time-remove-0')).toBeNull();
  });

  it('슬롯 2개에서 펼친 카드를 삭제하면 1개로 줄고 삭제 버튼이 사라진다', () => {
    const { getByTestId, queryByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [] },
          { startTime: '22:00', roles: [] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // 첫 미완성 = index 0 이 펼쳐짐
    fireEvent.press(getByTestId('order-time-remove-0'));
    expect(queryByTestId('order-time-remove-0')).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/ScheduleSlotsSheet.test.tsx`
Expected: FAIL — `Cannot find module '../ScheduleSlotsSheet'`

- [ ] **Step 3: 구현**

`src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx`:

```tsx
/**
 * ScheduleSlotsSheet — 시간·역할 통합 시트 (주문서 일정·모집)
 *
 * @description 구 TimeSlotsSheet + RolesSheet(슬롯용)를 하나로 합친 시트. 슬롯 카드마다
 * 출근 시간과 역할을 같은 화면에서 편집하므로 시트→시트 전환이 없다 — iOS 중첩 Modal
 * 터치 먹통(#244) 회피용 300ms 지연 스왑이 구조적으로 불필요해졌다.
 * 시간 휠은 여전히 SheetModal 의 overlay 슬롯에 embedded 로 얹는다(중첩 Modal 금지 유효, #186/#243).
 * 슬롯이 2개 이상이면 아코디언 — 활성 카드 하나만 펼친다.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { PlusIcon } from '@/components/icons';
import { SlotCard } from './SlotCard';
import type { SlotRoles } from './RoleCountEditor';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Slots = OrderSheetValues['scheduleGroups'][number]['timeSlots'];

const DEFAULT_START = '19:00';

const toTimeValue = (s: string): TimeValue => {
  const [hour = 19, minute = 0] = s.split(':').map(Number);
  return { hour, minute };
};
const toStartTime = (t: TimeValue) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

/** 진입 시 펼칠 카드 — 첫 미완성 슬롯(시간 미설정 또는 역할 0개), 없으면 첫 카드(§5) */
const firstIncompleteIndex = (slots: Slots) => {
  const i = slots.findIndex((s) => !s.startTime || s.roles.length === 0);
  return i >= 0 ? i : 0;
};

export interface ScheduleSlotsSheetProps {
  visible: boolean;
  value: Slots;
  onConfirm: (next: Slots) => void;
  onClose: () => void;
}

export function ScheduleSlotsSheet({
  visible,
  value,
  onConfirm,
  onClose,
}: ScheduleSlotsSheetProps) {
  const [slots, setSlots] = useState<Slots>(
    value.length > 0 ? value : [{ startTime: DEFAULT_START, roles: [] }]
  );
  const [expanded, setExpanded] = useState<number>(() =>
    firstIncompleteIndex(value.length > 0 ? value : [{ startTime: DEFAULT_START, roles: [] }])
  );
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const updateStart = (i: number, t: TimeValue) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, startTime: toStartTime(t) } : s)));

  const updateRoles = (i: number, roles: SlotRoles) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, roles } : s)));

  const addSlot = () => {
    // roles 깊은복사 — 새 슬롯의 역할 편집이 첫 슬롯 roles 를 참조 변형하는 것을 막는다.
    const next: Slots = [
      ...slots,
      { startTime: '', roles: (slots[0]?.roles ?? []).map((r) => ({ ...r })) },
    ];
    setSlots(next);
    setExpanded(next.length - 1);
  };

  const removeSlot = (i: number) => {
    const next = slots.filter((_, idx) => idx !== i);
    setSlots(next);
    setExpanded((cur) =>
      cur > i ? cur - 1 : Math.min(cur, Math.max(0, next.length - 1))
    );
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="시간 · 역할"
      footer={
        <Button
          onPress={() => {
            onConfirm(slots);
            onClose();
          }}
        >
          확인
        </Button>
      }
      overlay={
        pickerIndex !== null ? (
          <TimeWheelPicker
            visible
            embedded
            title="출근 시간"
            value={toTimeValue(slots[pickerIndex]?.startTime ?? DEFAULT_START)}
            minuteInterval={5}
            onConfirm={(t) => {
              updateStart(pickerIndex, t);
              setPickerIndex(null);
            }}
            onClose={() => setPickerIndex(null)}
          />
        ) : undefined
      }
    >
      <View className="gap-2 px-4 pt-3 pb-2">
        {slots.map((slot, i) => (
          <SlotCard
            key={i}
            slot={slot}
            index={i}
            expanded={expanded === i}
            removable={slots.length > 1}
            onExpand={() => setExpanded(i)}
            onPressTime={() => setPickerIndex(i)}
            onChangeRoles={(roles) => updateRoles(i, roles)}
            onRemove={() => removeSlot(i)}
          />
        ))}
        <Pressable
          onPress={addSlot}
          testID="order-time-add-slot"
          accessibilityRole="button"
          accessibilityLabel="시간대 추가"
          className="min-h-[44px] flex-row items-center justify-center gap-1 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 active:opacity-80"
        >
          <PlusIcon size={16} />
          <Text className="text-sm text-content-secondary font-sans">시간대 추가</Text>
        </Pressable>
      </View>
    </SheetModal>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/ScheduleSlotsSheet.test.tsx`
Expected: PASS — 9 tests passed

- [ ] **Step 5: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/ScheduleSlotsSheet.tsx src/components/employer/order-sheet/sheets/__tests__/ScheduleSlotsSheet.test.tsx
git commit -m "feat(order-sheet): ScheduleSlotsSheet 시간·역할 통합 시트

시간과 역할을 한 시트에서 편집 — 시트 전환 콜백(onEditSlotRoles)이 사라진다.
슬롯 2개 이상이면 아코디언, 진입 시 첫 미완성 슬롯을 펼친다."
```

---

### Task 7: 아코디언 전환 애니메이션 + 동작 줄이기

**Files:**
- Modify: `src/components/employer/order-sheet/sheets/SlotCard.tsx`
- Test: `src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx` (describe 블록 추가)

**Interfaces:**
- Consumes: `AccessibilityInfo` (react-native), `Animated`/`FadeIn`/`FadeOut` (react-native-reanimated 4.2.1)
- Produces: 외부 인터페이스 변경 없음 — `SlotCardProps` 그대로

- [ ] **Step 1: 실패하는 테스트 추가**

`__tests__/SlotCard.test.tsx` 상단 import에 `AccessibilityInfo`를 추가하고, 파일 하단에 append:

```tsx
describe('SlotCard — 동작 줄이기', () => {
  afterEach(() => jest.restoreAllMocks());

  it('동작 줄이기 ON 이어도 펼침 내용은 정상 렌더된다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { getByText, findByTestId } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(await findByTestId('order-role-chip-dealer')).toBeTruthy();
    expect(getByText('출근 19:00')).toBeTruthy();
  });

  it('동작 줄이기 OFF 에서도 펼침 내용은 정상 렌더된다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { getByText, findByTestId } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(await findByTestId('order-role-chip-dealer')).toBeTruthy();
    expect(getByText('출근 19:00')).toBeTruthy();
  });
});
```

`__tests__/SlotCard.test.tsx` 최상단 import에 추가:

```tsx
import { AccessibilityInfo } from 'react-native';
```

- [ ] **Step 2: 테스트 실행 (현재는 통과 — 애니메이션 도입 후 회귀 방어용)**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx -t "동작 줄이기"`
Expected: PASS — 2 tests passed. 이 테스트는 Step 3에서 애니메이션을 넣은 뒤에도 통과해야 하는 회귀 가드다.

- [ ] **Step 3: 애니메이션 도입**

`SlotCard.tsx`의 import에 추가:

```tsx
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
```

`React` import를 다음으로 교체:

```tsx
import React, { useEffect, useState } from 'react';
```

`export function SlotCard({...})` 본문 맨 위(`if (!expanded)` 앞)에 추가:

```tsx
  // 동작 줄이기 — 프로젝트 기존 패턴(Skeleton.tsx:68, OfflineStatusBar.tsx:69) 승계.
  // ON 이면 진입/종료 애니메이션 없이 즉시 전환한다.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);
```

펼침 분기의 최상위 `<View ...>` 여는 태그를 다음으로 교체:

```tsx
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(300)}
      exiting={reduceMotion ? undefined : FadeOut.duration(225)}
      accessibilityState={{ expanded: true }}
      className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3"
    >
```

그리고 대응하는 닫는 태그 `</View>`를 `</Animated.View>`로 교체 (펼침 분기의 **최상위** 것만 — 내부 `flex-row` 컨테이너의 `</View>`는 그대로 둔다).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx src/components/employer/order-sheet/sheets/__tests__/ScheduleSlotsSheet.test.tsx`
Expected: PASS — SlotCard 11 tests + ScheduleSlotsSheet 9 tests

reanimated는 `jest.setup.js:109`의 `require('react-native-reanimated').setUpTests()`로 이미 설정돼 있다(실측 확인) — 테스트 파일에 별도 mock을 추가하지 말 것.

- [ ] **Step 5: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/SlotCard.tsx src/components/employer/order-sheet/sheets/__tests__/SlotCard.test.tsx
git commit -m "feat(order-sheet): 아코디언 펼침 애니메이션 + 동작 줄이기 분기

진입 300ms / 종료 225ms(75% 규칙). isReduceMotionEnabled ON 이면 즉시 전환."
```

---

### Task 8: OrderSheetScreen 배선 + #244 지연 스왑 전면 삭제

`switchSheet`의 호출처는 `OrderSheetScreen.tsx:893`과 `:928` **두 곳뿐이고 둘 다 TimeSlotsSheet↔RolesSheet 스왑**이다(실측 완료). 통합 후 호출처가 0이 되므로 `switchSheet`·`pendingSheetRef`·재진입 가드를 전부 삭제한다.

**Files:**
- Modify: `src/components/employer/order-sheet/OrderSheetScreen.tsx`
- Delete: `src/components/employer/order-sheet/sheets/TimeSlotsSheet.tsx`
- Delete: `src/components/employer/order-sheet/sheets/__tests__/TimeSlotsSheet.test.tsx`
- Test: `src/components/employer/order-sheet/__tests__/OrderSheetScreen.timeSlots.test.tsx` (갱신)

**Interfaces:**
- Consumes: `ScheduleSlotsSheet` (Task 6)
- Produces: `SlotsTarget = { key: 'slots'; groupIndex: number }` — `ActiveSheet` 유니언에서 `TimeTarget`·`SlotRolesTarget`을 대체

- [ ] **Step 1: 타입 교체**

`OrderSheetScreen.tsx:62-78`의 타입 블록에서 `TimeTarget`·`SlotRolesTarget` 정의를 삭제하고 다음으로 교체:

```tsx
/** 시간·역할 통합 시트 타깃 — 구 TimeTarget + SlotRolesTarget 을 대체한다(시트 전환이 사라짐). */
type SlotsTarget = { key: 'slots'; groupIndex: number };
```

`ActiveSheet` 유니언의 `| TimeTarget | SlotRolesTarget`을 `| SlotsTarget`으로 교체한다. 위쪽 JSDoc에서 `slotRoles:`로 시작하는 2줄(`fromTimeSheet` 설명)을 삭제한다.

- [ ] **Step 2: 파생 상태 교체**

`OrderSheetScreen.tsx:162-163`의 두 줄

```tsx
  const timeTarget = scheduleTarget?.key === 'time' ? scheduleTarget : null;
  const slotRolesTarget = scheduleTarget?.key === 'slotRoles' ? scheduleTarget : null;
```

을 다음으로 교체:

```tsx
  const slotsTarget = scheduleTarget?.key === 'slots' ? scheduleTarget : null;
```

- [ ] **Step 3: 지연 스왑 인프라 삭제**

`OrderSheetScreen.tsx:136-156`의 다음을 통째로 삭제한다:
- `pendingSheetRef` 선언
- `clearPendingSheet` 선언
- `useEffect(() => clearPendingSheet, [clearPendingSheet]);`
- `switchSheet` 선언
- 위 블록의 설명 주석 2줄

그리고 재진입 가드 2곳을 삭제한다:
- `handleRowPress` 내 `if (pendingSheetRef.current) return;` (현행 287행)
- `handleAddSchedule` 내 `if (pendingSheetRef.current) return;` (현행 368행)

`handleRowPress` 위 주석에서 `switchSheet 지연 전환 창(300ms) 중에는 무시` 문장(현행 283행)도 삭제한다.

import에서 `useRef`와 `SHEET_DISMISS_ANIMATION_MS`가 더 이상 쓰이지 않으면 제거한다 (`useEffect`는 다른 곳에서 쓰일 수 있으니 실측 후 판단).

- [ ] **Step 4: 행 진입 통합**

`handleRowPress`(현행 293-311행)의 `time`/`roles` 분기를 다음으로 교체:

```tsx
      // 시간·역할은 통합 시트 하나로 진입한다(설계 §6). 고정(fixed)은 단일 fixedSchedule.roles
      // 편집이라 전용 시트로 분기하는 기존 동작을 유지한다(S2).
      if (key === 'time' || key === 'roles') {
        if (form.getValues().postingType === 'fixed') {
          seedFixedScheduleIfMissing();
          setActiveSheet('fixedRoles');
          return;
        }
        setActiveSheet({ key: 'slots', groupIndex });
        return;
      }
```

- [ ] **Step 5: 시트 렌더 교체**

`OrderSheetScreen.tsx:877-932`의 `{timeTarget && (...)}`와 `{slotRolesTarget && (...)}` 두 블록을 통째로 다음 하나로 교체:

```tsx
      {slotsTarget && (
        <ScheduleSlotsSheet
          visible
          value={scheduleGroups[slotsTarget.groupIndex]?.timeSlots ?? []}
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
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
```

현행 856-857행의 주석을 다음으로 교체:

```tsx
      {/* 일정·모집 시트 2종(그룹 스코프) — 날짜(달력+세그먼트)·시간역할 통합.
          시트→시트 스왑이 없으므로 #244 지연 전환 인프라가 필요 없다. */}
```

- [ ] **Step 6: import 교체**

`TimeSlotsSheet` import를 삭제하고 `ScheduleSlotsSheet` import를 추가한다:

```tsx
import { ScheduleSlotsSheet } from './sheets/ScheduleSlotsSheet';
```

- [ ] **Step 7: 구 파일 삭제**

```bash
cd uniqn-mobile
rm src/components/employer/order-sheet/sheets/TimeSlotsSheet.tsx
rm src/components/employer/order-sheet/sheets/__tests__/TimeSlotsSheet.test.tsx
```

- [ ] **Step 8: 타입체크로 잔여 참조 확인**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: exit 0. `timeTarget`/`slotRolesTarget`/`TimeSlotsSheet`/`switchSheet`/`pendingSheetRef` 잔여 참조가 있으면 여기서 잡힌다 — 전부 제거한다.

- [ ] **Step 9: 통합 테스트 재작성**

현행 `OrderSheetScreen.timeSlots.test.tsx`는 **6개 테스트 중 4개가 #244 지연 전환 전용**이다 — 우리가 삭제하는 동작을 지키는 테스트라 그대로 두면 반드시 실패한다. 다음과 같이 재작성한다:

| 현행 테스트 | 처리 |
|---|---|
| `roles 행 — 슬롯 복수면 TimeSlotsSheet 진입` | 통합 시트 진입으로 수정 |
| `roles 행 — 슬롯 1개면 역할 시트 직접 진입` | 통합 시트 진입으로 수정 |
| `TimeSlotsSheet→RolesSheet 스왑은 지연 전환` | **삭제** (스왑 자체가 없다) |
| `전환 예약 중 언마운트 → 타이머 정리` | **삭제** (타이머가 없다) |
| `submit 시 역할 미설정이면 역할 시트가 열린다` | **유지** — 기대 문구만 `'어떤 역할이 필요하세요?'` → `'시간 · 역할'` |
| `지연 전환 창 중 다른 행 탭은 무시` | **삭제** (가드가 없다) |

`submit` 라우팅은 `handleRowPress`를 경유하므로(`OrderSheetScreen.tsx:550`) 통합 라우팅을 자동 상속한다 — 구현 변경은 필요 없고 기대 문구만 바뀐다.

파일 전체를 다음으로 교체:

```tsx
/**
 * OrderSheetScreen — 일정·모집 시트 라우팅 테스트
 *
 * 시간·역할이 하나의 시트(ScheduleSlotsSheet)로 통합되어 시트→시트 스왑이 사라졌다.
 * 구 #244 지연 전환(switchSheet) 테스트 4종은 지킬 동작이 없어져 삭제했다.
 * SheetModal 은 children+footer+overlay 렌더로 모킹.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';

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

// DatePickerModal(dates 행)의 Modal/CalendarPicker 스텁 — 실제 렌더 크래시로 어설션이 가려지지 않게.
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

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
};

const withSlots = (slots: { startTime: string; roles: any[] }[]) => ({
  ...initialOrderSheetValues(),
  scheduleGroups: [{ dates: [], timeSlots: slots, grouped: false }],
});

describe('OrderSheetScreen — 일정·모집 라우팅', () => {
  it('역할 행 — 슬롯 1개면 통합 시트에서 시간과 역할을 함께 보여준다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([{ startTime: '19:00', roles: [] }])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('시간 · 역할')).toBeTruthy();
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('시간 행도 같은 통합 시트를 연다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([{ startTime: '19:00', roles: [] }])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-time'));
    expect(getByText('시간 · 역할')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('슬롯 복수면 첫 미완성 슬롯이 펼쳐지고 나머지는 접힌다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={withSlots([
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '21:00', roles: [] },
        ])}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    expect(getByText('출근 21:00')).toBeTruthy(); // 미완성 = 펼침
    expect(getByText('19:00 · 딜러 1명')).toBeTruthy(); // 완성 = 접힘 요약
  });

  it('submit 시 역할 미설정이면 통합 시트가 열린다 (H5 죽은 버튼 방지)', async () => {
    const { getByTestId, findByText } = render(
      <OrderSheetScreen
        {...baseProps}
        initialValues={{
          ...initialOrderSheetValues(),
          title: '주말 딜러 구합니다',
          location: { name: '강남 홀덤펍', region: '서울 강남구' },
          contactPhone: '010-1234-5678',
          scheduleGroups: [
            // 역할만 미설정 → firstUnsetRow={roles, 0} → handleRowPress 경유(OrderSheetScreen.tsx:550)
            {
              dates: ['2026-07-14'],
              timeSlots: [{ startTime: '19:00', roles: [] }],
              grouped: false,
            },
          ],
        }}
      />
    );
    fireEvent.press(getByTestId('job-posting-create-submit'));
    expect(await findByText('시간 · 역할')).toBeTruthy();
  });
});
```

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.timeSlots.test.tsx`
Expected: PASS — 4 tests passed

`SHEET_DISMISS_ANIMATION_MS` import가 이 파일에서 사라졌다. `@/constants/animation`의 해당 상수가 다른 곳에서도 안 쓰이면 knip이 Task 9에서 잡아낸다 — 그때 판단한다(다른 시트에서 쓰고 있을 수 있으므로 지금 삭제하지 말 것).

- [ ] **Step 10: 고정 경로 역할 반영 커버리지 보강 (Task 4 리뷰 이월)**

Task 4 리뷰가 **선재 커버리지 갭**을 찾았다: `OrderSheetScreen.tsx:843`의 `{ ...fs, roles: next }`를 `{ ...fs }`로 바꿔도 `OrderSheetScreen.fixed.test.tsx`가 **전부 통과한다**. 토스트가 `syncRoleSalariesForRoles(next, ...)`로 `next`를 폼 경유 없이 직접 받기 때문에, 이 테스트는 "고정 타입 역할이 실제로 폼에 반영되는가"를 한 번도 검증한 적이 없다. (리뷰어가 base 커밋에 같은 변이를 재생해 **이번 작업이 깎은 게 아님**을 확인했다.)

dated 경로는 같은 변이에서 red가 되므로 비대칭이다. 지금 `OrderSheetScreen`을 손보는 김에 메운다.

`OrderSheetScreen.fixed.test.tsx`에 폼 값 기반 단언을 추가한다 — 역할 확인 후 **주문서 본화면의 역할 행 요약**에 그 역할이 나타나는지 본다(토스트가 아니라 폼을 경유한 경로를 지난다):

```tsx
  it('고정 타입 역할 확인 → 폼에 반영되어 역할 행 요약에 나타난다', async () => {
    const { getByTestId, getByText, findByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={fixedInitialValues()} />
    );
    fireEvent.press(getByTestId('order-sheet-row-roles'));
    fireEvent.press(getByTestId('order-role-chip-floor'));
    fireEvent.press(getByText('확인'));
    // 토스트가 아니라 form.setValue 를 경유한 요약이어야 한다 — :843 의 roles: next 를 지운 변이에서 red 가 된다
    expect(await findByText(/플로어/)).toBeTruthy();
  });
```

`fixedInitialValues()`는 그 파일에 이미 있는 고정 타입 시드 헬퍼를 쓴다(이름이 다르면 실측해서 맞출 것).

**이 테스트가 실효한지 반드시 Red-Green 으로 확인하라**: `:843`을 `{ ...fs }`로 임시 변경 → 이 테스트만 red → 복원 → green. red 가 안 되면 여전히 토스트 경로를 타고 있는 것이므로 단언을 폼 경유로 다시 잡아라.

- [ ] **Step 11: 급여 동기화 회귀 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.salarySync.test.tsx`
Expected: PASS — `applyRoleSalarySync` 호출이 2회에서 1회로 줄었지만 최종 `roleSalaries` 결과는 같아야 한다. 실패하면 동기화가 실제로 누락된 것이므로 테스트가 아니라 구현을 고친다.

- [ ] **Step 12: 커밋**

```bash
git add -A src/components/employer/order-sheet/
git commit -m "refactor(order-sheet): 시간·역할 통합 시트 배선 + #244 지연 스왑 삭제

'시간'/'역할' 행이 같은 ScheduleSlotsSheet 를 연다. 주문서 본화면 3행과
확정 지원자 잠금(LOCKED_ROW_KEYS)은 행 키 기준이라 그대로 동작한다.

switchSheet 호출처가 0이 되어 pendingSheetRef·재진입 가드까지 전면 삭제.
applyRoleSalarySync 이중 호출도 confirm 1회로 수렴.

TimeSlotsSheet 삭제 (기능은 ScheduleSlotsSheet 로 이관)."
```

---

### Task 9: 전체 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트**

Run: `cd uniqn-mobile && npm test`
Expected: 0 failures. 실패 목록을 그대로 읽고, 통합으로 깨진 것인지 원래 깨져 있던 것인지 `git stash` 없이 판단이 안 되면 `git log`로 직전 상태를 확인한다.

- [ ] **Step 2: 품질 게이트**

Run: `cd uniqn-mobile && npm run quality`
Expected: exit 0 (type-check + lint + format:check 전부 통과)

- [ ] **Step 3: 죽은 코드 확인**

Run: `cd uniqn-mobile && npx knip`
Expected: 미사용 export 래칫이 **2214를 초과하지 않을 것**. `TimeSlotsSheet` 삭제로 오히려 줄어야 정상이다. 늘었다면 `RoleCountEditor`에서 export했지만 아무도 안 쓰는 심볼이 있는지 확인한다.

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "chore(order-sheet): 시간·역할 통합 검증 통과

npm test 0 failures / npm run quality exit 0 / knip 래칫 유지."
```

- [ ] **Step 5: 실기기 QA 항목 인계**

다음은 자동 테스트로 덮을 수 없다 — 사용자에게 인계한다:

1. iOS에서 인원 숫자를 탭했을 때 키패드가 시트 콘텐츠를 가리지 않는가 (`SheetModal`의 `KeyboardAvoidingView` 실동작)
2. 아코디언 펼침 직후 역할 칩·스테퍼 터치가 먹는가 (#186/#243 재발 확인)
3. 시간 휠 overlay가 통합 시트 안에서 정상 동작하는가
4. 설정 > 손쉬운 사용 > 동작 줄이기 ON 상태에서 펼침이 즉시 전환되는가
5. 고정(fixed) 공고에서 역할 시트가 새 칩 토글 방식으로 정상 동작하는가

---

## 완료 기준

- [ ] `npm test` 0 failures
- [ ] `npm run quality` exit 0
- [ ] `switchSheet`·`pendingSheetRef`·`TimeSlotsSheet` 잔여 참조 0 (`grep -rn "switchSheet\|pendingSheetRef\|TimeSlotsSheet" src/` 결과 없음)
- [ ] 주문서 본화면은 여전히 날짜/시간/역할 3행
- [ ] 폼 스키마·DB·Edge Function 변경 0
