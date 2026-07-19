# 자정 넘는 근무시간 근본 처리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱 전체에서 "종료 ≤ 시작 → 익일" 근무시간을 하나의 파서·하나의 표시·하나의 계산으로 통일하고, 화면별로 갈라진 3가지 상반된 모델을 제거한다.

**Architecture:** 이미 존재하는 SSOT(`parseTimeSlotToDate` + `WorkTimeDisplay.isEndNextDay`)를 유지하고, 그 위에 화면 공용 순수 헬퍼 `deriveOvernightPreview`를 얹어 입력 화면(근무표·정산)이 같은 익일 판정·프리뷰를 쓰게 한다. SSOT를 우회/재구현하던 표시 화면 3곳을 SSOT 소비로 교정한다. DB·서버 RPC는 손대지 않는다(클라이언트 전용).

**Tech Stack:** TypeScript strict, React Native / Expo, Jest + @testing-library/react-native, NativeWind.

## Global Constraints

- 모든 UI 문자열·주석·커밋 메시지는 **한글**. (CLAUDE.md)
- 근무시간 **표시는 반드시 `WorkTimeDisplay` 경유** — 직접 포맷 금지. (wiki `decisions/worktime-ssot`)
- 익일 파싱 규칙의 단일 소스는 `parseTimeSlotToDate`(`src/utils/date/ranges.ts:139-142`) — 재구현 금지.
- 해석 규칙: `종료 < 시작 → 익일(+1일)`, `종료 == 시작 → 검증 오류`. 24시간 근무 해석 없음.
- **DB 마이그레이션·서버 RPC 변경 없음.** `work_logs.date`/`time_slot`(text) 스키마 불변, 정규화는 클라이언트 책임.
- 날짜 귀속은 **시작일 기준** 현행 유지 (그리드 셀 분할 비목표).
- `console.log` 금지(앱 런타임) — 필요 시 `logger`.
- 불변성 준수(스프레드로 새 객체, 원본 mutate 금지).
- 커밋 컨벤션: `<type>(<scope>): <한글>` (feat/fix/refactor/test).

---

## File Structure

**신규**
- `src/shared/time/overnightPreview.ts` — 화면 공용 순수 헬퍼(익일 판정 + duration 프리뷰). 입력 UI 전용 파생.
- `src/shared/time/__tests__/overnightPreview.test.ts` — 헬퍼 단위 테스트.

**수정**
- `src/shared/time/TimeNormalizer.ts:68-71` — `calculateDurationInHours` 자정 보정 내재화.
- `src/shared/time/index.ts` — `deriveOvernightPreview` 배럴 export(존재 시).
- `src/components/weeklyGrid/EditSlotSheet.tsx` — 익일 프리뷰 + `end==start` 오류 + 저장 가드.
- `src/components/employer/settlement/WorkTimeEditor.tsx` — 차단 검증 제거 → 자동 익일 + 프리뷰.
- `src/components/schedule/ScheduleDetailSheet.tsx:179` — SSOT 경유 + 익일 라벨.
- `src/components/employer/settlement/SettlementDetailModal/WorkTimeSection.tsx:59-60,109-115` — `isOvernight` 재구현 삭제 → `isEndNextDay`.
- `src/components/schedule/GroupedScheduleCard.tsx:167-172` — SSOT 경유 라벨.
- `src/components/weeklyGrid/AddSlotSheet.tsx` + `addSlotPayload.ts` — 자유 텍스트 시간대 → 구조화 입력(P2).
- `src/domains/weeklyGrid/slotEdit.ts:206-221` — 충돌 감지 구간 겹침(P2).

각 Task는 독립 커밋. Task 1은 나머지의 토대이므로 먼저.

---

### Task 1: 공용 익일 프리뷰 헬퍼

**Files:**
- Create: `src/shared/time/overnightPreview.ts`
- Test: `src/shared/time/__tests__/overnightPreview.test.ts`
- Modify: `src/shared/time/index.ts` (배럴 export)

**Interfaces:**
- Produces: `deriveOvernightPreview(startTime: string, endTime: string): OvernightPreview`
  - `OvernightPreview = { valid: boolean; isNextDay: boolean; isEqual: boolean; durationMinutes: number; durationLabel: string }`
  - `startTime`/`endTime`은 `"HH:mm"`(hour 0~47 허용; 24+ 는 익일로 정규화). start는 당일(0~23) 기준.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/shared/time/__tests__/overnightPreview.test.ts
import { deriveOvernightPreview } from '../overnightPreview';

describe('deriveOvernightPreview', () => {
  it('종료가 시작보다 이르면 익일로 해석하고 duration을 넘겨 계산한다', () => {
    const r = deriveOvernightPreview('18:00', '02:00');
    expect(r.valid).toBe(true);
    expect(r.isNextDay).toBe(true);
    expect(r.isEqual).toBe(false);
    expect(r.durationMinutes).toBe(8 * 60);
    expect(r.durationLabel).toBe('8시간');
  });

  it('같은 날 정상 구간은 익일이 아니다', () => {
    const r = deriveOvernightPreview('09:00', '17:30');
    expect(r.isNextDay).toBe(false);
    expect(r.durationMinutes).toBe(8 * 60 + 30);
    expect(r.durationLabel).toBe('8시간 30분');
  });

  it('시작과 종료가 같으면 isEqual=true(검증 오류 대상)', () => {
    const r = deriveOvernightPreview('18:00', '18:00');
    expect(r.isEqual).toBe(true);
  });

  it('24+ 표기(25:00)는 이미 익일로 본다', () => {
    const r = deriveOvernightPreview('18:00', '25:00');
    expect(r.isNextDay).toBe(true);
    expect(r.durationMinutes).toBe(7 * 60);
  });

  it('형식이 잘못되면 valid=false', () => {
    expect(deriveOvernightPreview('보류', '02:00').valid).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/shared/time/__tests__/overnightPreview.test.ts`
Expected: FAIL — "Cannot find module '../overnightPreview'"

- [ ] **Step 3: 헬퍼 구현**

```typescript
// src/shared/time/overnightPreview.ts
/**
 * 입력 화면(근무표·정산)이 공유하는 익일 판정 + duration 프리뷰 순수 헬퍼.
 * 저장/표시의 진실 소스는 여전히 parseTimeSlotToDate + WorkTimeDisplay 다.
 * 이 헬퍼는 "입력 중"에 익일 여부·근무시간을 즉시 보여주기 위한 파생만 담당한다.
 */
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const MINUTES_PER_DAY = 24 * 60;

export interface OvernightPreview {
  valid: boolean;
  isNextDay: boolean;
  /** 시작 == 종료(같은 시각). 검증 오류 대상 — 24시간 근무 해석 안 함. */
  isEqual: boolean;
  durationMinutes: number;
  durationLabel: string;
}

const INVALID: OvernightPreview = {
  valid: false,
  isNextDay: false,
  isEqual: false,
  durationMinutes: 0,
  durationLabel: '-',
};

function parseMinutes(time: string): number | null {
  const m = time.match(TIME_RE);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 47 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function minutesToLabel(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  if (minutes > 0) return `${minutes}분`;
  return '-';
}

export function deriveOvernightPreview(startTime: string, endTime: string): OvernightPreview {
  const start = parseMinutes(startTime);
  const end = parseMinutes(endTime);
  if (start === null || end === null) return INVALID;

  const isEqual = end < MINUTES_PER_DAY && end === start;

  let endEffective = end;
  let isNextDay = false;
  if (end >= MINUTES_PER_DAY) {
    // 24+ 표기 = 이미 익일
    isNextDay = true;
  } else if (end <= start) {
    endEffective = end + MINUTES_PER_DAY;
    isNextDay = true;
  }

  const durationMinutes = endEffective - start;
  return {
    valid: true,
    isNextDay,
    isEqual,
    durationMinutes,
    durationLabel: minutesToLabel(durationMinutes),
  };
}
```

- [ ] **Step 4: 배럴 export 추가**

`src/shared/time/index.ts`에 아래 줄 추가(파일에 다른 export 패턴을 따를 것):

```typescript
export { deriveOvernightPreview, type OvernightPreview } from './overnightPreview';
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/shared/time/__tests__/overnightPreview.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/shared/time/overnightPreview.ts uniqn-mobile/src/shared/time/__tests__/overnightPreview.test.ts uniqn-mobile/src/shared/time/index.ts
git commit -m "feat(time): 익일 근무시간 공용 프리뷰 헬퍼 추가"
```

---

### Task 2: TimeNormalizer 자정 보정 내재화

**Files:**
- Modify: `src/shared/time/TimeNormalizer.ts:68-71`
- Test: `src/shared/time/__tests__/TimeNormalizer.overnight.test.ts` (신규)

**Interfaces:**
- Consumes: 없음. `calculateDurationInHours(start: Date, end: Date): number` 시그니처 유지.
- Produces: 동일 시그니처, `end < start`일 때 +24h 보정된 양수 시간 반환.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/shared/time/__tests__/TimeNormalizer.overnight.test.ts
import { TimeNormalizer } from '../TimeNormalizer';

describe('TimeNormalizer.calculateDurationInHours 자정 보정', () => {
  it('같은 날 종료가 시작보다 이르면 +24h 보정한다', () => {
    const start = new Date(2026, 6, 17, 18, 0, 0); // 18:00
    const end = new Date(2026, 6, 17, 2, 0, 0); // 같은 날 02:00 (익일 미보정 Date)
    expect(TimeNormalizer.calculateDurationInHours(start, end)).toBe(8);
  });

  it('정상 구간은 그대로 계산한다', () => {
    const start = new Date(2026, 6, 17, 9, 0, 0);
    const end = new Date(2026, 6, 17, 17, 0, 0);
    expect(TimeNormalizer.calculateDurationInHours(start, end)).toBe(8);
  });

  it('이미 익일로 보정된 Date(다음날 02:00)도 8시간', () => {
    const start = new Date(2026, 6, 17, 18, 0, 0);
    const end = new Date(2026, 6, 18, 2, 0, 0);
    expect(TimeNormalizer.calculateDurationInHours(start, end)).toBe(8);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/shared/time/__tests__/TimeNormalizer.overnight.test.ts`
Expected: FAIL — 첫 케이스가 -16(또는 0으로 클램프)로 8 불일치

- [ ] **Step 3: 구현 수정**

`src/shared/time/TimeNormalizer.ts:68-71` 을 아래로 교체:

```typescript
  static calculateDurationInHours(start: Date, end: Date): number {
    let diffMs = end.getTime() - start.getTime();
    // 종료가 시작보다 이르면 자정을 넘긴 것으로 보고 +24h 보정.
    // (실제 timestamptz 경로는 end>start 라 무영향 — 순수 HH:mm 경로 회귀 방어)
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    return Math.max(0, diffMs) / (1000 * 60 * 60);
  }
```

- [ ] **Step 4: 테스트 통과 + 기존 회귀 확인**

Run: `cd uniqn-mobile && npx jest src/shared/time/__tests__/ src/domains/__tests__/SettlementCalculator.test.ts`
Expected: PASS (신규 3 + 기존 SettlementCalculator/WorkTimeDisplay 회귀 유지)

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/shared/time/TimeNormalizer.ts uniqn-mobile/src/shared/time/__tests__/TimeNormalizer.overnight.test.ts
git commit -m "fix(time): calculateDurationInHours 자정 보정 내재화"
```

---

### Task 3: EditSlotSheet — 익일 프리뷰 + end==start 오류 + 저장 가드

**Files:**
- Modify: `src/components/weeklyGrid/EditSlotSheet.tsx`
- Test: `src/components/weeklyGrid/__tests__/EditSlotSheet.overnight.test.tsx` (신규)

**Interfaces:**
- Consumes: `deriveOvernightPreview` (Task 1).
- Produces: 없음(화면 내부 동작).

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/components/weeklyGrid/__tests__/EditSlotSheet.overnight.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EditSlotSheet } from '../EditSlotSheet';

// updateSlot mutate 감시
const mutate = jest.fn();
jest.mock('@/hooks/weeklyGrid', () => ({
  useUpdateSlot: () => ({ mutate, isPending: false }),
  useDeleteSlot: () => ({ mutate: jest.fn(), isPending: false }),
}));

const baseSlot = {
  workLogId: 'wl1',
  staffId: 's1',
  jobPostingId: 'jp1',
  role: 'dealer',
  timeSlot: '18:00 - 02:00',
  color: null,
  notes: '',
  staffName: '김하나',
};

function renderSheet(overrides = {}) {
  return render(
    <EditSlotSheet
      visible
      onClose={jest.fn()}
      slot={{ ...baseSlot, ...overrides }}
      date="2026-07-17"
    />
  );
}

describe('EditSlotSheet 자정 처리', () => {
  it('18:00~02:00 슬롯이면 익일 프리뷰(총 8시간)를 보여준다', () => {
    const { getByText } = renderSheet();
    expect(getByText(/익일/)).toBeTruthy();
    expect(getByText(/8시간/)).toBeTruthy();
  });

  it('시작과 종료가 같으면 저장이 비활성화되고 오류 안내가 뜬다', () => {
    const { getByText, queryByText } = renderSheet({ timeSlot: '18:00 - 18:00' });
    expect(getByText(/시작과 종료 시간이 같아요/)).toBeTruthy();
    // 저장 버튼 비활성(눌러도 mutate 미호출)
    fireEvent.press(getByText('저장'));
    expect(mutate).not.toHaveBeenCalled();
    expect(queryByText(/익일/)).toBeNull();
  });
});
```

> 참고: 위 mock 경로(`@/hooks/weeklyGrid`)와 slot 필드는 기존 `EditSlotSheet.test.tsx`의 mock 방식에 맞춰 조정할 것(그 파일을 먼저 열어 동일 패턴 사용).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/EditSlotSheet.overnight.test.tsx`
Expected: FAIL — 익일/오류 문구 없음

- [ ] **Step 3: import + 프리뷰 계산 추가**

`EditSlotSheet.tsx` 상단 import에 추가:

```typescript
import { deriveOvernightPreview } from '@/shared/time';
```

`conflicts` useMemo(178행) 아래에 프리뷰 계산 추가:

```typescript
  // 입력 중 익일 여부·근무시간 프리뷰(SSOT 파생). end==start 는 저장 차단.
  const timePreview = useMemo(
    () => deriveOvernightPreview(startTime, endTime),
    [startTime, endTime]
  );
```

- [ ] **Step 4: 프리뷰 UI 추가**

본문에서 두 `TimeTriggerField`(시작/종료) 아래에 다음 블록을 삽입:

```tsx
      {timePreview.isEqual ? (
        <View className="mt-2 flex-row items-center rounded-lg bg-error-50 p-3 dark:bg-error-900/20">
          <AlertCircleIcon size={16} color="#DC2626" />
          <Text className="ml-2 font-sans text-sm text-error-600 dark:text-error-400">
            시작과 종료 시간이 같아요. 다시 확인해주세요.
          </Text>
        </View>
      ) : (
        <View className="mt-2 flex-row items-center justify-between rounded-lg bg-surface-page p-3 dark:bg-surface">
          <Text className="font-sans text-sm text-content-muted dark:text-secondary-400">
            {timePreview.isNextDay ? `익일 ${endTime} 종료` : '당일 근무'}
          </Text>
          <Text className="font-display text-base text-primary-600 dark:text-primary-400">
            총 {timePreview.durationLabel}
          </Text>
        </View>
      )}
```

> `AlertCircleIcon`이 아직 import 안 됐으면 `@/components/icons`에서 추가.

- [ ] **Step 5: 저장 가드 추가**

`handleSave`(202행) 진입부에 가드 추가:

```typescript
  const handleSave = () => {
    if (!slot) return;
    if (timePreview.isEqual) return; // 시작==종료는 저장 불가
    // ...기존 updateSlot.mutate...
```

그리고 footer 저장 버튼(276행 근처 `Button variant` 저장)에 `disabled={isBusy || timePreview.isEqual}` 추가.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/EditSlotSheet.overnight.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/src/components/weeklyGrid/EditSlotSheet.tsx uniqn-mobile/src/components/weeklyGrid/__tests__/EditSlotSheet.overnight.test.tsx
git commit -m "feat(grid): 슬롯 편집 익일 프리뷰 + 시작==종료 저장 차단"
```

---

### Task 4: WorkTimeEditor — 차단 검증 제거 → 자동 익일 + 프리뷰

**Files:**
- Modify: `src/components/employer/settlement/WorkTimeEditor.tsx:224-235, 400-427`
- Test: `src/components/employer/settlement/__tests__/WorkTimeEditor.overnight.test.tsx` (신규) 또는 기존 테스트 확장

**Interfaces:**
- Consumes: `deriveOvernightPreview` (Task 1).
- Produces: 없음.

> 결정(스펙 R2 조정): 12h 초과 확인은 **인라인 강조 배너(비차단)**로 구현한다. 중첩 RN Modal 터치 먹통 함정(memory)과 `confirmAction` 시그니처 미검증 리스크를 피하기 위함. 차단형 다이얼로그는 후속(별도 Task, confirmAction 실측 후)으로 남긴다.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/components/employer/settlement/__tests__/WorkTimeEditor.overnight.test.tsx
// (기존 WorkTimeEditor 렌더 헬퍼/모킹을 재사용하되, 아래 동작을 검증)
// 1) 출근 18:00 / 퇴근 02:00(0~23 입력)이면 '익일' 라벨 + '8시간' 표시, 저장 활성
// 2) '퇴근 시간이 출근보다 빨라요' 오류 문구가 더 이상 나오지 않는다
// 3) 12시간 초과(예: 18:00~07:00=13h)면 '근무 시간이 길어요' 강조 배너 표시(저장은 여전히 가능)
```

> 기존 `WorkTimeEditor`는 부모에서 `startTime`/`endTime`(Date)·`startTimeStr`/`endTimeStr`("HH:mm")를 관리한다. 테스트는 기존 `__tests__/timeEditorUtils.test.ts`의 렌더 셋업이 아니라 컴포넌트 렌더가 필요하므로, 같은 폴더의 기존 컴포넌트 테스트가 있으면 그 셋업을 복제할 것. 없으면 최소 props로 렌더.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/settlement/__tests__/WorkTimeEditor.overnight.test.tsx`
Expected: FAIL

- [ ] **Step 3: import + 프리뷰 계산**

`WorkTimeEditor.tsx` import에 추가:

```typescript
import { deriveOvernightPreview } from '@/shared/time';
```

`isValidTimeOrder`(231-235행) 을 프리뷰 기반으로 교체:

```typescript
  // 입력 중 익일 판정 + 근무시간 프리뷰. 종료<시작은 자동 익일(오류 아님), 종료==시작만 차단.
  const timePreview = useMemo(() => {
    if (isStartTimeUndefined || isEndTimeUndefined || !startTimeStr || !endTimeStr) {
      return null;
    }
    return deriveOvernightPreview(startTimeStr, endTimeStr);
  }, [startTimeStr, endTimeStr, isStartTimeUndefined, isEndTimeUndefined]);

  // 시작==종료만 순서 오류. (기존 endTime>startTime 차단 규칙 폐기)
  const isValidTimeOrder = useMemo(() => {
    if (!timePreview) return true;
    return !timePreview.isEqual;
  }, [timePreview]);

  // 12시간 초과 여부(비차단 강조).
  const isLongShift = useMemo(
    () => !!timePreview && timePreview.valid && timePreview.durationMinutes > 12 * 60,
    [timePreview]
  );
```

- [ ] **Step 4: 경고/프리뷰 UI 교체**

기존 "시간 순서 경고" 블록(410-417행)을 아래로 교체:

```tsx
            {/* 시작==종료 오류 */}
            {timePreview?.isEqual ? (
              <View className="mb-4 flex-row items-center rounded-lg bg-error-50 p-3 dark:bg-error-900/20">
                <AlertCircleIcon size={16} color="#DC2626" />
                <Text className="ml-2 font-sans text-sm text-error-600 dark:text-error-400">
                  출근과 퇴근 시간이 같아요. 다시 확인해주세요.
                </Text>
              </View>
            ) : null}

            {/* 익일 안내 */}
            {timePreview && !timePreview.isEqual && timePreview.isNextDay ? (
              <View className="mb-4 flex-row items-center rounded-lg bg-info-50 p-3 dark:bg-info-900/20">
                <AlertCircleIcon size={16} color="#2563EB" />
                <Text className="ml-2 font-sans text-sm text-info-600 dark:text-info-400">
                  익일 {endTimeStr} 퇴근으로 계산돼요.
                </Text>
              </View>
            ) : null}

            {/* 장시간 근무 강조(비차단) */}
            {isLongShift ? (
              <View className="mb-4 flex-row items-center rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20">
                <AlertCircleIcon size={16} color="#A16207" />
                <Text className="ml-2 font-sans text-sm text-warning-700 dark:text-warning-400">
                  근무 시간이 {timePreview?.durationLabel}이에요. 맞는지 확인해주세요.
                </Text>
              </View>
            ) : null}
```

시간 선택 안내 문구(404-406행)의 "(24시 이상 = 다음날 새벽)"을 "(퇴근이 이르면 자동으로 익일로 계산돼요)"로 교체.

- [ ] **Step 5: 총 근무시간 표시를 프리뷰와 정합**

근무 시간 표시(420-427행)의 `{duration}`은 유지하되, `duration` 계산이 `parseTimeInput`(24+ Date) 경로라 이미 익일 반영됨을 확인. 만약 `calculateDuration`이 "시간 오류"를 반환하는 경로가 남아 있으면 `timePreview.durationLabel` 우선 사용:

```tsx
                {timePreview && !timePreview.isEqual ? timePreview.durationLabel : duration}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/settlement/`
Expected: PASS (신규 + 기존 timeEditorUtils 회귀). 기존 "24+ 강제" 문구 테스트가 있으면 Task 요건에 맞춰 문구 갱신.

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/src/components/employer/settlement/WorkTimeEditor.tsx uniqn-mobile/src/components/employer/settlement/__tests__/WorkTimeEditor.overnight.test.tsx
git commit -m "feat(settlement): 근무시간 수정 자동 익일 판정 + 장시간 강조(차단 검증 제거)"
```

---

### Task 5: ScheduleDetailSheet — SSOT 경유 + 익일 라벨

**Files:**
- Modify: `src/components/schedule/ScheduleDetailSheet.tsx:179`
- Test: `src/components/schedule/__tests__/ScheduleDetailSheet.overnight.test.tsx` (신규)

**Interfaces:**
- Consumes: `WorkTimeDisplay.getDisplayInfo`.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// 18:00~02:00 이벤트(익일) 렌더 시 "18:00 – 익일 02:00" 형태로 익일 라벨이 보이는지 검증.
// 기존 ScheduleDetailSheet 테스트 셋업이 있으면 복제.
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/schedule/__tests__/ScheduleDetailSheet.overnight.test.tsx`
Expected: FAIL — "익일" 미표시

- [ ] **Step 3: 179행 직접 포맷을 SSOT 경유로 교체**

기존:
```tsx
{`${formatTime(start)} - ${formatTime(end)}`}
```
교체:
```tsx
{(() => {
  const info = WorkTimeDisplay.getDisplayInfo({
    startTime: start,
    endTime: end,
  });
  return info.isEndNextDay
    ? `${info.scheduledStart} – 익일 ${info.scheduledEnd}`
    : `${info.scheduledStart} – ${info.scheduledEnd}`;
})()}
```

> `WorkTimeDisplay` import 추가(`@/shared/time`). `start`/`end`가 Date면 그대로, 문자열/timeSlot이면 `getDisplayInfo`의 해당 필드로 전달. 실제 소스 형태에 맞춰 `WorkTimeSource` 필드 선택.

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/schedule/__tests__/ScheduleDetailSheet.overnight.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/schedule/ScheduleDetailSheet.tsx uniqn-mobile/src/components/schedule/__tests__/ScheduleDetailSheet.overnight.test.tsx
git commit -m "fix(schedule): 스케줄 상세 시간 표시 SSOT 경유 + 익일 라벨"
```

---

### Task 6: WorkTimeSection — isOvernight 재구현 삭제 → isEndNextDay

**Files:**
- Modify: `src/components/employer/settlement/SettlementDetailModal/WorkTimeSection.tsx:59-60,109-115`
- Test: `src/components/employer/settlement/SettlementDetailModal/__tests__/WorkTimeSection.test.tsx` (신규/확장 — 현재 커버리지 0)

**Interfaces:**
- Consumes: `WorkTimeDisplay.getDisplayInfo(...).isEndNextDay`.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// 18:00 출근 / 익일 02:00 퇴근 데이터로 렌더 시 "익일" 배지가 보이는지.
// 정상 구간(09:00~17:00)에서는 익일 배지가 없어야 함.
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/settlement/SettlementDetailModal/__tests__/WorkTimeSection.test.tsx`
Expected: FAIL (테스트 자체가 신규거나 배지 판정 불일치)

- [ ] **Step 3: isOvernight 독립 계산 제거**

59-60행의 `const isOvernight = effectiveEnd.toDateString() !== effectiveStart.toDateString();` 제거하고, 상단에서 `WorkTimeDisplay.getDisplayInfo`로부터 `isEndNextDay`를 받아 사용:

```typescript
const workTimeInfo = WorkTimeDisplay.getDisplayInfo({
  checkInTime: /* 기존 effectiveStart 소스 */,
  checkOutTime: /* 기존 effectiveEnd 소스 */,
});
const isOvernight = workTimeInfo.isEndNextDay;
```

109-115행에서 배지 표시 조건은 `isOvernight` 그대로 사용(값 소스만 SSOT로 교체).

> `WorkTimeDisplay` import 추가. 기존 `effectiveStart/effectiveEnd`를 `getDisplayInfo`에 넘길 소스 필드로 매핑(actual이면 checkIn/checkOutTime, scheduled면 startTime/endTime 또는 timeSlot+date).

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/employer/settlement/SettlementDetailModal/`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/employer/settlement/SettlementDetailModal/WorkTimeSection.tsx uniqn-mobile/src/components/employer/settlement/SettlementDetailModal/__tests__/WorkTimeSection.test.tsx
git commit -m "refactor(settlement): WorkTimeSection 익일 판정 SSOT 통합 + 테스트 신설"
```

---

### Task 7: GroupedScheduleCard — SSOT 경유 라벨

**Files:**
- Modify: `src/components/schedule/GroupedScheduleCard.tsx:167-172`
- Test: `src/components/schedule/__tests__/GroupedScheduleCard.overnight.test.tsx` (신규)

**Interfaces:**
- Consumes: `WorkTimeDisplay.getDisplayInfo(...)`.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// group.timeSlot='18:00 - 02:00' 렌더 시 "익일 02:00"이 보이는지.
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/schedule/__tests__/GroupedScheduleCard.overnight.test.tsx`
Expected: FAIL

- [ ] **Step 3: 167-172행 timeSlot 원문 렌더를 SSOT 라벨로 교체**

```tsx
{(() => {
  const info = WorkTimeDisplay.getDisplayInfo({
    timeSlot: group.timeSlot,
    date: group.date,
  });
  if (!info.rawTimeSlot) return group.timeSlot;
  return info.isEndNextDay
    ? `${info.scheduledStart} – 익일 ${info.scheduledEnd}`
    : `${info.scheduledStart} – ${info.scheduledEnd}`;
})()}
```

> `group.date`가 없으면 `getDisplayInfo`에 넘길 수 있는 날짜 소스를 확인. 날짜 없이도 `parseTimeSlotToDate`가 시간만으로 익일 판정하도록 빈 문자열 폴백 확인(SSOT 동작 유지).

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/schedule/__tests__/GroupedScheduleCard.overnight.test.tsx`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/schedule/GroupedScheduleCard.tsx uniqn-mobile/src/components/schedule/__tests__/GroupedScheduleCard.overnight.test.tsx
git commit -m "fix(schedule): 그룹 카드 시간 라벨 SSOT 경유 익일 표기"
```

---

### Task 8 (P2): AddSlotSheet — 자유 텍스트 시간대 → 구조화 입력

**Files:**
- Modify: `src/components/weeklyGrid/AddSlotSheet.tsx:386-391`, `src/components/weeklyGrid/addSlotPayload.ts:74-81`
- Test: `src/components/weeklyGrid/__tests__/addSlotPayload.overnight.test.ts` (신규)

**Interfaces:**
- Consumes: `deriveOvernightPreview`, `composeTimeSlot`(slotEdit).
- Produces: payload `timeSlot`이 항상 `"HH:mm - HH:mm"` 정규 형식.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// addSlotPayload가 시작/종료 구조화 입력을 받아 'HH:mm - HH:mm'을 만들고,
// 형식 위반("자정넘음")은 거부하는지 검증.
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/__tests__/addSlotPayload.overnight.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

AddSlotSheet의 자유 텍스트 Input(386-391)을 EditSlotSheet과 동일한 `TimeTriggerField` 2개(시작/종료) + `deriveOvernightPreview` 프리뷰로 교체. `addSlotPayload.ts`는 startTime/endTime을 받아 `composeTimeSlot`으로 조합하고, `TIME_RE` 형식 검증 실패 시 기존 `requireValue` 패턴으로 오류 반환.

> 상세 코드는 Task 3(EditSlotSheet)의 TimeTriggerField·프리뷰 블록을 그대로 재사용. AddSlotSheet의 기존 3모드(풀 꽂기/전화검색/공고열기) 레이아웃은 유지하고 "시간대(선택)" 필드만 교체.

- [ ] **Step 4: 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/weeklyGrid/`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/weeklyGrid/AddSlotSheet.tsx uniqn-mobile/src/components/weeklyGrid/addSlotPayload.ts uniqn-mobile/src/components/weeklyGrid/__tests__/addSlotPayload.overnight.test.ts
git commit -m "feat(grid): 인원 추가 시간대 구조화 입력 + 형식 검증"
```

---

### Task 9 (P2): detectSlotConflicts — 구간 겹침 감지

**Files:**
- Modify: `src/domains/weeklyGrid/slotEdit.ts:206-221`
- Test: `src/domains/weeklyGrid/__tests__/slotEdit.overnight.test.ts` (신규)

**Interfaces:**
- Consumes: `deriveOvernightPreview` 또는 `parseTimeSlotToDate`.
- Produces: `detectSlotConflicts` 시그니처 유지, `reason`에 `'overlap'` 추가.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
import { detectSlotConflicts } from '../slotEdit';

it('같은 스태프의 자정 넘는 구간이 실제로 겹치면 충돌로 표시한다', () => {
  const target = { workLogId: 'a', staffId: 's1', timeSlot: '18:00 - 02:00' };
  const siblings = [{ workLogId: 'b', staffId: 's1', timeSlot: '23:00 - 06:00' }];
  const conflicts = detectSlotConflicts(target, siblings);
  expect(conflicts).toHaveLength(1);
});

it('겹치지 않는 구간은 충돌 아님', () => {
  const target = { workLogId: 'a', staffId: 's1', timeSlot: '10:00 - 14:00' };
  const siblings = [{ workLogId: 'b', staffId: 's1', timeSlot: '18:00 - 02:00' }];
  expect(detectSlotConflicts(target, siblings)).toHaveLength(0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd uniqn-mobile && npx jest src/domains/weeklyGrid/__tests__/slotEdit.overnight.test.ts`
Expected: FAIL — 시작시각만 비교라 겹침 미감지

- [ ] **Step 3: 구간 겹침으로 확장**

`detectSlotConflicts`를 시작/종료를 분(minute) 절대구간(자정 넘으면 +1440)으로 환산해 `[startA,endA)`와 `[startB,endB)`의 겹침 판정으로 교체. `parseTimeSlotParts` + `deriveOvernightPreview`로 각 슬롯의 `[startMin, startMin+durationMinutes)` 구간을 구하고 표준 겹침식 `aStart < bEnd && bStart < aEnd` 적용. `reason`은 `'overlap'`으로. staffId 누락/미파싱이면 기존대로 빈 배열.

- [ ] **Step 4: 통과 + 기존 slotEdit 테스트 회귀**

Run: `cd uniqn-mobile && npx jest src/domains/weeklyGrid/`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/domains/weeklyGrid/slotEdit.ts uniqn-mobile/src/domains/weeklyGrid/__tests__/slotEdit.overnight.test.ts
git commit -m "feat(grid): 슬롯 충돌 감지를 구간 겹침으로 확장(자정 포함)"
```

---

### Task 10: 전체 검증 + 문서 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-07-17-overnight-worktime-design.md` (구현 반영 노트)

- [ ] **Step 1: 타입·린트·전체 테스트**

Run: `cd uniqn-mobile && npm run quality && npx jest src/shared/time src/components/weeklyGrid src/components/employer/settlement src/components/schedule src/domains/weeklyGrid`
Expected: type-check 0 error, lint 0 error, 전체 관련 테스트 PASS

- [ ] **Step 2: Red-Green 회귀 스팟체크(우회 3곳)**

`ScheduleDetailSheet`/`WorkTimeSection`/`GroupedScheduleCard` 각 신규 테스트에서 SSOT 라인을 임시 원복 → 테스트 FAIL 확인 → 복구 → PASS 확인(테스트가 실제로 익일 라벨을 잡는지 검증).

- [ ] **Step 3: 스펙 문서에 "구현 반영" 섹션 추가 후 커밋**

```bash
git add docs/superpowers/specs/2026-07-17-overnight-worktime-design.md
git commit -m "docs: 자정 근무시간 구현 반영 노트 추가"
```

---

## Self-Review

**Spec coverage:**
- R1(종료<시작→익일, ==오류) → Task 1(헬퍼), Task 3/4(오류 UI). ✓
- R2(입력 UX 통일, 0~23 유지, 24+ 별칭, 프리뷰) → Task 3, 4, 8. 12h 확인은 비차단 배너로 조정(Task 4 명시). ✓(조정 문서화됨)
- R3(표시 SSOT 단일) → Task 5, 6, 7. ✓
- R4(파생 방어 내재화) → Task 2. ✓
- R5(DB 불변) → 전 Task DB 미변경. ✓
- R6(충돌 구간화) → Task 9. ✓
- 테스트 계획(§6) → 각 Task 테스트 + Task 10. ✓

**Placeholder scan:** 코드 스텝은 실제 코드 포함. UI 화면(4·5·6·7·8)의 일부는 "기존 소스 필드에 매핑" 지시가 있으나, 이는 각 화면의 데이터 형태가 파일별로 달라 실측 매핑이 필요한 지점 — 해당 파일을 열어 확인하도록 명시. 순수 로직(Task 1·2·9)은 완전한 코드.

**Type consistency:** `deriveOvernightPreview(start,end): OvernightPreview` 시그니처가 Task 1 정의와 Task 3·4·8 소비에서 일치. `OvernightPreview` 필드(valid/isNextDay/isEqual/durationMinutes/durationLabel) 전 Task 동일 사용. `WorkTimeDisplay.getDisplayInfo(...).isEndNextDay`가 Task 5·6·7에서 일관.

**주의(실행 시):** Task 4·5·6은 부모가 넘기는 시간 데이터 형태(Date vs "HH:mm" vs timeSlot+date)를 파일을 열어 확인 후 `WorkTimeSource` 필드에 매핑할 것. 이 매핑이 유일한 실측 의존 지점.
