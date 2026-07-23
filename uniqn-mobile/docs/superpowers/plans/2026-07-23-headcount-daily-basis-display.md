# 인원카운트 표시 통일 (하루 기준 분수 + 자리 총계 병기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 그룹 공고의 카드/상세/지원화면 인원 표시를 "하루 기준 분수(분자=날짜별 확정 max)"로 통일해 `딜러 65명 (0/65)` vs `딜러 5명 (0/5)` 류 화면 간 불일치를 소멸시킨다.

**Architecture:** 표시 계층 전용 변경. `postingSurfaceModel.ts`의 그룹 요약 곱셈(`count=하루×일수`)을 하루 기준으로 바꾸고(분자=일별 max), 지원화면(`AssignmentSelector`)에 확정 집계를 주입하며, 구인자 카드에 자리 총계(`자리 M/T 채움`)를 병기한다. DB·트리거·저장 형식(`schedule.roles[].count`=하루치)은 **절대 불변**.

**Tech Stack:** Expo RN 0.83 / TS strict / NativeWind / Jest + @testing-library/react-native / TanStack Query

**Spec:** `uniqn-mobile/docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md`

## Global Constraints

- 모든 응답·커밋·주석 **한글**. 커밋 형식 `<type>(<scope>): <한글>`.
- 작업 디렉토리 `uniqn-mobile/`. 테스트는 `uniqn-mobile/`에서 `npx jest <경로>`.
- **DB·마이그레이션·트리거·`MAX_CAPACITY_REACHED` 가드·저장 형식 불변** — `get_venue_grid_summary` 등이 `schedule.roles[].count`(하루치)를 SQL에서 직접 파싱한다.
- `schedule.roles[].filled`(SP3 dead counter, 항상 0)는 표시·판정 어디서도 읽지 않는다.
- hydrate 키 계약 불변: 서브맵 키 = `${date}__${slotKey}__${roleKey}` (fixed는 `FIXED_SCHEDULE`/`NEGOTIABLE` 마커, TBA slotKey=`미정`, other 역할=`other:${customRole ?? ''}`).
- 마감이어도 지원 접수 허용(대기 성격). 자동 승계 기능 없음 — "순번대로 자동 배정" 류 문구 금지.
- Immutability(스프레드로 새 객체), `dark:` 클래스 병기, `@/` 절대 경로, `console.log` 금지(`logger`).
- **병렬 세션 존재** — 커밋마다 이 계획이 만든/수정한 파일만 명시적으로 스테이징(`git add <파일>` 개별 지정, `git add -A` 금지).
- 사전 준비: 최신 `origin/master`에서 새 브랜치 `feat/headcount-daily-display` 생성 후 작업. `git status`에 내가 만들지 않은 미커밋 변경이 있으면 워크트리 격리(전역 규칙).

---

### Task 1: 그룹 요약 하루 기준 전환 — 분모=하루 요구, 분자=일별 max

**Files:**

- Modify: `src/components/jobs/shared/postingSurfaceModel.ts:317-335` (`buildGroupedSection` 요약 timeSlots)
- Modify: `src/components/jobs/shared/__tests__/postingSurfaceModel.hydrate.test.ts:100-105` (곱셈 계약 단언 갱신)
- Test: `src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts` (신규)

**Interfaces:**

- Consumes: `buildGroupedSection`의 `days`(날짜별 전개, 각 날짜 filled는 hydrate 맵 단일 소스) — 기존 구조 그대로.
- Produces: 그룹 섹션 `timeSlots[].roles[]`의 `count`=하루 요구(`perDayCount`), `filled`=날짜별 확정의 최대값, `isFilled`=`perDayCount>0 && filled>=perDayCount`. `section.totalCount/filledCount`(자리 총계 = 일별 합)는 **불변** — Task 5가 소비.

- [ ] **Step 1: 실패 테스트 작성** — `src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts` 생성:

```typescript
import { buildPostingScheduleModel } from '@/components/jobs/shared/postingSurfaceModel';

/**
 * 하루 기준 표시 통일(C안) — 그룹 요약의 분모=하루 요구, 분자=날짜별 확정 max.
 * 근거 스펙: docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md §2.2·§5
 */
function makeGroupedSource(days: { date: string; filled: number }[], perDayCount = 5) {
  const startDate = days[0]!.date;
  const endDate = days[days.length - 1]!.date;
  const source = {
    workflow: { isFixed: false, usesGroupedDateRanges: true },
    scheduleDisplay: {
      variant: 'grouped_dates',
      fixed: undefined,
      dateGroups: [
        {
          id: 'g1',
          startDate,
          endDate,
          timeSlots: [
            {
              id: 's1',
              startTime: '18:00',
              roles: [{ role: 'dealer', count: perDayCount, filled: 0 }],
            },
          ],
        },
      ],
      dateRequirements: [],
      workDate: '',
      timeSlot: '',
    },
  } as any;
  const filledCounts = new Map<string, number>(
    days.filter((d) => d.filled > 0).map((d) => [`${d.date}__18:00__dealer`, d.filled])
  );
  return { source, filledCounts };
}

describe('그룹 요약 하루 기준 (분자=max)', () => {
  it('불균등(2,1): 요약 분모=하루 요구 5, 분자=max 2 — 곱셈 없음', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 2 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const role = model.sections[0].timeSlots[0].roles[0];
    expect(role.count).toBe(5); // 현행 10(=5×2)이므로 RED
    expect(role.filled).toBe(2); // 현행 3(=합)이므로 RED
    expect(role.isFilled).toBe(false);
  });

  it('한 날만 만석(5,1): 요약 (5/5) 마감 — 통지원 불가를 정직하게 표시', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 5 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const role = model.sections[0].timeSlots[0].roles[0];
    expect(role.count).toBe(5);
    expect(role.filled).toBe(5);
    expect(role.isFilled).toBe(true);
  });

  it('불변식: 요약 분자 == max(일별 분자), 자리 총계 == Σ(일별)', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 3 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const section = model.sections[0];
    const dailyFilled = section.days.map((day: any) => day.timeSlots[0].roles[0].filled as number);
    expect(section.timeSlots[0].roles[0].filled).toBe(Math.max(...dailyFilled));
    expect(section.filledCount).toBe(dailyFilled.reduce((a: number, b: number) => a + b, 0));
    expect(section.totalCount).toBe(5 * section.dayCount); // 자리 총계 분모 = Σ(일별 분모)
  });

  it('dayCount==1 회귀: 요약 == 일별 (기존 표시 불변)', () => {
    const { source, filledCounts } = makeGroupedSource([{ date: '2026-08-22', filled: 2 }]);
    const model = buildPostingScheduleModel(source, filledCounts) as any;
    const role = model.sections[0].timeSlots[0].roles[0];
    expect(role.count).toBe(5);
    expect(role.filled).toBe(2);
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npx jest src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts`
Expected: FAIL — 첫 테스트 `role.count` 10≠5, `role.filled` 3≠2 (곱셈/합산 현행 동작)

- [ ] **Step 3: 구현** — `postingSurfaceModel.ts` `buildGroupedSection`의 요약 timeSlots 블록(317-335행)을 교체:

```typescript
const dayCount = effectiveDates.length;
// 요약 timeSlots(하루 기준·C안): 분모=하루 요구(perDayCount, 곱셈 금지), 분자=날짜별 확정의 최대값.
// 통지원(그룹 일괄 배정) 전제에서 perDayCount − max(filled_d) 가 실제 추가 수용 인원이므로
// max 가 유일하게 정직한 분자다(합·평균은 이 성질이 없다). 자리 총계는 section.totalCount/filledCount.
const summaryTimeSlots: PostingTimeSlotDisplayModel[] = group.timeSlots.map((slot, slotIndex) => {
  const timeLabel = formatTimeLabel(slot);
  return {
    key: `${sectionKey}-${timeLabel}-${slotIndex}`,
    timeLabel,
    roles: slot.roles.map((role, roleIndex) => {
      const perDayCount = role.count ?? role.headcount ?? 0;
      const filled = days.reduce(
        (max, day) => Math.max(max, day.timeSlots[slotIndex]?.roles[roleIndex]?.filled ?? 0),
        0
      );
      const base = toRoleModels([role])[0]!;
      return {
        ...base,
        count: perDayCount,
        filled,
        isFilled: perDayCount > 0 && filled >= perDayCount,
      };
    }),
  };
});
```

(주의: `const count = perDayCount * dayCount;` 줄이 사라지는 것이 이 작업의 핵심. `dayCount` 변수 자체는 라벨/반환에 계속 쓰이므로 유지.)

- [ ] **Step 4: 기존 곱셈 계약 테스트 갱신** — `postingSurfaceModel.hydrate.test.ts` 100-105행의 grouped 테스트 단언을 하루 기준으로 수정:

```typescript
const role = (model as any).sections[0].timeSlots[0].roles[0];
// 하루 기준(C안): 요약 분모 = 하루치 3 (구 곱셈 3×3=9 폐기), 분자 = 일별 max(1,1,0)=1
expect(role.count).toBe(3);
expect(role.filled).toBe(1);
expect((model as any).sections[0].filledCount).toBe(2); // 자리 총계(Σ일별)는 불변
```

- [ ] **Step 5: GREEN 확인 + 주변 스위트 전수**

Run: `npx jest src/components/jobs/shared/__tests__ src/components/jobs/__tests__/postingSurfaceModel.test.ts`
Expected: PASS. 다른 파일에서 `perDayCount × dayCount` 요약을 단언하는 테스트가 더 실패하면, 각각 하루 기준으로 갱신(갱신 사유를 한 줄 주석으로 남김). 요약이 아닌 **일별(day) 단언은 절대 건드리지 않는다.**

- [ ] **Step 6: Commit**

```bash
git add src/components/jobs/shared/postingSurfaceModel.ts src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts src/components/jobs/shared/__tests__/postingSurfaceModel.hydrate.test.ts
git commit -m "fix(jobs): 그룹 요약 인원을 하루 기준으로 통일 — 분모=하루 요구, 분자=일별 확정 max"
```

---

### Task 2: 시간 슬롯 정렬 — 카드/상세/지원화면 공통 (스크린샷 실측 버그)

실측: 공고 등록 순서대로 `10:00 → 11:00 → 10:30`이 그대로 노출됨. 표시 계층에서 시작시간 오름차순(TBA는 맨 뒤)으로 정렬한다.

**Files:**

- Create: `src/utils/date/timeSlotOrder.ts`
- Modify: `src/utils/date/index.ts` (re-export 추가 — 파일 열어 기존 export 블록에 한 줄 추가)
- Modify: `src/components/jobs/shared/postingSurfaceModel.ts` (`buildGroupedSection`·`buildSingleDateSection`에 정렬 적용)
- Modify: `src/components/jobs/AssignmentSelector/AssignmentSelector.tsx` (지원화면 동일 정렬 — Task 3의 hydratedSchedules 위에 적용)
- Test: `src/utils/date/__tests__/timeSlotOrder.test.ts` (신규)

**Interfaces:**

- Produces: `sortTimeSlotsByStart<T extends { startTime?: string; time?: string; isTimeToBeAnnounced?: boolean }>(slots: readonly T[]): T[]` — 새 배열 반환(불변), 시작시간(`"14:00~22:00"` 범위 문자열이면 앞 시각) 오름차순, TBA(`isTimeToBeAnnounced`)는 항상 뒤. domains 의존 없는 순수 유틸(utils 레이어 순환 방지 — `WorkLogCreator` import 금지).

- [ ] **Step 1: 실패 테스트 작성** — `src/utils/date/__tests__/timeSlotOrder.test.ts`:

```typescript
import { sortTimeSlotsByStart } from '@/utils/date/timeSlotOrder';

describe('sortTimeSlotsByStart', () => {
  it('시작시간 오름차순 정렬 (스크린샷 재현: 10:00, 11:00, 10:30)', () => {
    const slots = [{ startTime: '10:00' }, { startTime: '11:00' }, { startTime: '10:30' }];
    expect(sortTimeSlotsByStart(slots).map((s) => s.startTime)).toEqual([
      '10:00',
      '10:30',
      '11:00',
    ]);
  });

  it('TBA(미정) 슬롯은 항상 맨 뒤, 범위 문자열은 시작시각 기준', () => {
    const slots = [
      { startTime: '', isTimeToBeAnnounced: true },
      { startTime: '14:00~22:00' },
      { startTime: '09:30' },
    ];
    expect(sortTimeSlotsByStart(slots).map((s) => s.isTimeToBeAnnounced ?? false)).toEqual([
      false,
      false,
      true,
    ]);
    expect(sortTimeSlotsByStart(slots)[0]!.startTime).toBe('09:30');
  });

  it('원본 배열을 변형하지 않는다', () => {
    const slots = [{ startTime: '11:00' }, { startTime: '10:00' }];
    const copy = [...slots];
    sortTimeSlotsByStart(slots);
    expect(slots).toEqual(copy);
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npx jest src/utils/date/__tests__/timeSlotOrder.test.ts`
Expected: FAIL — "Cannot find module '@/utils/date/timeSlotOrder'"

- [ ] **Step 3: 구현** — `src/utils/date/timeSlotOrder.ts` 생성:

```typescript
/**
 * 타임 슬롯 표시 정렬 — 시작시간 오름차순, TBA(시간 미정)는 맨 뒤.
 * 공고 등록 순서가 뒤섞여 저장돼도(예: 10:00, 11:00, 10:30) 표시에서 정렬한다.
 * 저장 형식/키 계약은 건드리지 않는 순수 표시 유틸.
 */
interface SortableTimeSlot {
  startTime?: string;
  time?: string;
  isTimeToBeAnnounced?: boolean;
}

const LAST = '99:99';

function startOf(slot: SortableTimeSlot): string {
  // "14:00~22:00" 범위 문자열은 시작 시각만 취한다(hydrate 키 규칙과 동일 방향, domains 의존 없이 자체 파싱)
  const raw = slot.startTime || slot.time || '';
  const match = raw.match(/^\s*(\d{1,2}:\d{2})/);
  return match?.[1]?.padStart(5, '0') ?? LAST;
}

export function sortTimeSlotsByStart<T extends SortableTimeSlot>(slots: readonly T[]): T[] {
  return [...slots].sort((a, b) => {
    if (!!a.isTimeToBeAnnounced !== !!b.isTimeToBeAnnounced) {
      return a.isTimeToBeAnnounced ? 1 : -1;
    }
    return startOf(a).localeCompare(startOf(b));
  });
}
```

`src/utils/date/index.ts`에 추가: `export { sortTimeSlotsByStart } from './timeSlotOrder';`

- [ ] **Step 4: GREEN 확인**

Run: `npx jest src/utils/date/__tests__/timeSlotOrder.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 표시 모델에 적용** — `postingSurfaceModel.ts`:

import 줄에 추가: `import { ..., sortTimeSlotsByStart } from '@/utils/date';`

`buildGroupedSection` 도입부(285행 부근, `const dates = ...` 앞)에 정렬본 도입 후, 함수 내 `group.timeSlots` 참조 3곳(days 매핑·summaryTimeSlots 매핑)을 전부 `orderedTimeSlots`로 교체 — **days와 summary가 같은 정렬 배열을 쓰므로 slotIndex 결합이 유지**된다:

```typescript
const sectionKey = group.id || `${group.startDate}-${group.endDate}`;
// 표시 정렬: 등록 순서가 아닌 시작시간 순(스크린샷 실측 10:00→11:00→10:30 버그).
// days/summary 가 같은 배열을 공유해야 slotIndex 대응이 유지된다.
const orderedTimeSlots = sortTimeSlotsByStart(group.timeSlots);
```

`buildSingleDateSection`도 동일하게 `requirement.timeSlots` → `sortTimeSlotsByStart(requirement.timeSlots)`.

- [ ] **Step 6: 모델 정렬 회귀 테스트 추가** — `postingSurfaceModel.dailyBasis.test.ts`에 추가:

```typescript
it('요약·일별 타임슬롯이 시작시간 순으로 정렬된다 (10:00, 11:00, 10:30 입력)', () => {
  const source = {
    workflow: { isFixed: false, usesGroupedDateRanges: true },
    scheduleDisplay: {
      variant: 'grouped_dates',
      fixed: undefined,
      dateGroups: [
        {
          id: 'g1',
          startDate: '2026-09-10',
          endDate: '2026-09-11',
          timeSlots: [
            { id: 'a', startTime: '10:00', roles: [{ role: 'dealer', count: 5, filled: 0 }] },
            { id: 'b', startTime: '11:00', roles: [{ role: 'dealer', count: 5, filled: 0 }] },
            { id: 'c', startTime: '10:30', roles: [{ role: 'dealer', count: 1, filled: 0 }] },
          ],
        },
      ],
      dateRequirements: [],
      workDate: '',
      timeSlot: '',
    },
  } as any;
  const model = buildPostingScheduleModel(source, undefined) as any;
  expect(model.sections[0].timeSlots.map((s: any) => s.timeLabel)).toEqual([
    '10:00',
    '10:30',
    '11:00',
  ]);
  expect(model.sections[0].days[0].timeSlots.map((s: any) => s.timeLabel)).toEqual([
    '10:00',
    '10:30',
    '11:00',
  ]);
});
```

- [ ] **Step 7: 전체 관련 스위트 GREEN**

Run: `npx jest src/components/jobs/shared/__tests__ src/utils/date/__tests__/timeSlotOrder.test.ts`
Expected: PASS (슬롯 순서를 단언하던 기존 테스트가 있으면 정렬 순으로 갱신)

- [ ] **Step 8: 스펙 반영 + Commit** — 스펙 §6 "바꾸는 것" 목록에 한 줄 추가: `- 타임 슬롯 표시 정렬(시작시간 오름차순, TBA 뒤) — 실기기 스크린샷 실측 버그(10:00→11:00→10:30)`

```bash
git add src/utils/date/timeSlotOrder.ts src/utils/date/index.ts src/utils/date/__tests__/timeSlotOrder.test.ts src/components/jobs/shared/postingSurfaceModel.ts src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts docs/superpowers/specs/2026-07-23-headcount-daily-basis-display-design.md
git commit -m "fix(jobs): 타임 슬롯 표시를 시작시간 순으로 정렬 — 등록 순서 뒤섞임 버그"
```

---

### Task 2b: 일수 인라인 표기 — 날짜와 같은 행에 `· N일` (사용자 결정 2026-07-23)

현행: 카드가 라벨을 `\n`으로 쪼개 날짜 아래 별도 행에 "2일"을 그린다(`PostingScheduleContent.tsx:101-102, 122-126`). 라벨 소스 `formatDateRangeWithCount`(`utils/date/grouping.ts:160-178`)가 `"...범위\n    (2일)"` 2행 문자열을 만드는 게 뿌리. 한 행 `"8/22(토) ~ 8/23(일) · 2일"`로 통일한다 — 카드/상세/지원화면(`selectionUtils.ts:60` 그룹 라벨)이 같은 함수를 쓰므로 한 곳만 고치면 전 화면 정합.

**Files:**

- Modify: `src/utils/date/grouping.ts:160-178` (`formatDateRangeWithCount`)
- Modify: `src/components/jobs/shared/PostingScheduleContent.tsx:100-126` (split·별도 일수 행 제거)
- Test: `src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts` (케이스 추가) + `formatDateRangeWithCount` 기존 테스트 갱신(있는 경우)

**Interfaces:**

- Produces: `formatDateRangeWithCount(startDate, endDate)` — dayCount>1이면 `` `${범위} · ${dayCount}일` `` **단일 행**(개행 없음). 소비처(카드 라벨·상세 라벨·지원화면 그룹 라벨) 자동 정합.

- [ ] **Step 1: 실패 테스트 작성** — `postingSurfaceModel.dailyBasis.test.ts`에 추가:

```typescript
it('그룹 라벨은 한 행 — 날짜 범위와 일수가 같은 행에 표기된다', () => {
  const { source, filledCounts } = makeGroupedSource([
    { date: '2026-08-22', filled: 0 },
    { date: '2026-08-23', filled: 0 },
  ]);
  const model = buildPostingScheduleModel(source, filledCounts) as any;
  expect(model.sections[0].label).not.toContain('\n'); // 현행 "\n    (2일)" 이므로 RED
  expect(model.sections[0].label).toContain('· 2일');
});
```

- [ ] **Step 2: RED 확인**

Run: `npx jest src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts`
Expected: FAIL — 라벨에 `\n` 포함, `· 2일` 미포함

- [ ] **Step 3: 구현** — `grouping.ts` `formatDateRangeWithCount` 반환부 교체:

```typescript
if (dayCount <= 1) {
  return rangeStr;
}

// 일수는 날짜와 같은 행에 표기(사용자 결정 2026-07-23). 구 2행 형식("\n    (N일)")은
// 카드가 split('\n') 후 일수를 별도 행에 다시 그리는 이원화를 낳았다 — 단일 행이 단일 소스.
return `${rangeStr} · ${dayCount}일`;
```

`PostingScheduleContent.tsx` 카드 분기 정리 — 101-102행을:

```typescript
const dateRangeText = section.label; // 단일 행 라벨 — split 불필요
```

로 바꾸고 `showCardDayCount` 변수(102행)와 122-126행의 별도 일수 `<Text>` 블록을 삭제.

- [ ] **Step 4: GREEN + 라벨 소비처 회귀**

Run: `npx jest src/components/jobs src/utils/date src/utils/assignment`
Expected: PASS. `"\n    ("` 형식을 단언하던 기존 테스트가 있으면 `· N일` 단일 행으로 갱신(사유 주석). `grep -r "split('\\\\n')" src/` 로 라벨 split 잔존 소비처 0 확인.

- [ ] **Step 5: Commit**

```bash
git add src/utils/date/grouping.ts src/components/jobs/shared/PostingScheduleContent.tsx src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts
git commit -m "feat(jobs): 일수를 날짜와 같은 행에 표기 — 라벨 단일 행화"
```

---

### Task 3: 지원화면 확정 집계 주입 — (0/N) 고정 해소 + 마감·대기 지원

핵심 결함: `AssignmentSelector`는 `useJobSchedule`(dead counter, `filledCount` 항상 0)만 읽어 마감이 절대 표시되지 않는다. 확정 서브맵을 주입하고, 그룹 표시는 날짜별 max로 승격한다. 동시에 `RoleCheckbox`의 "마감=비활성"을 "마감 표시 + 선택 가능(대기 지원)"으로 바꾼다(스펙 §2.4·§5-5).

**Files:**

- Modify: `src/components/jobs/ApplicationForm.tsx` (필드: `usePostingFilledCounts` 배선, `AssignmentSelector`에 `filledCounts` 전달 — 297행 부근)
- Modify: `src/components/jobs/AssignmentSelector/AssignmentSelector.tsx` (prop 추가 + hydrate + 그룹 max 승격 + 정렬)
- Modify: `src/components/jobs/AssignmentSelector/types.ts` (`AssignmentSelectorProps`에 `filledCounts?: Map<string, number>` 추가)
- Modify: `src/components/jobs/AssignmentSelector/RoleCheckbox.tsx` (마감이어도 선택 가능)
- Test: `src/components/jobs/AssignmentSelector/__tests__/AssignmentSelector.test.tsx` (기존 파일에 케이스 추가)

**Interfaces:**

- Consumes: `extractPostingFilledSubmap(filledAll, postingId)` 서브맵(키 `date__slot__role`), `usePostingFilledCounts(ids)` (`@/hooks/usePostingFilledCounts`), `WorkLogCreator.extractStartTime` (`@/domains/schedule`).
- Produces: `AssignmentSelector`가 `filledCounts?: Map<string, number>`(서브맵)를 받아 각 날짜/그룹 역할의 `filledCount`를 실확정으로 표시. 그룹 역할 `filledCount = max(날짜별)`.

- [ ] **Step 1: 실패 테스트 작성** — 기존 `AssignmentSelector.test.tsx`를 열어 렌더 헬퍼/픽스처 패턴을 파악한 뒤, 같은 패턴으로 케이스 추가(아래는 단언 골격 — 픽스처는 기존 grouped 공고 목 데이터를 재사용하고 `filledCounts`만 주입):

```typescript
describe('확정 집계 주입 (하루 기준·C안)', () => {
  it('그룹 역할이 만석(5/5)이면 마감 배지가 보이고 체크박스는 여전히 선택 가능하다(대기 지원)', () => {
    // grouped 2일(2026-08-22~23), dealer 5명/일 픽스처 + 8/22=5, 8/23=1 확정 주입
    const filledCounts = new Map<string, number>([
      ['2026-08-22__18:00__dealer', 5],
      ['2026-08-23__18:00__dealer', 1],
    ]);
    const { getByText, getByRole } = renderSelector({ filledCounts }); // 기존 렌더 헬퍼에 prop 통과
    expect(getByText(/\(5\/5\)/)).toBeTruthy(); // 분자 = 날짜별 max (합 6 아님)
    expect(getByText('마감')).toBeTruthy();
    const checkbox = getByRole('checkbox');
    expect(checkbox.props.accessibilityState.disabled).toBe(false); // 대기 지원 허용
  });

  it('불균등(2,1)은 (2/5)로 표시되고 마감이 아니다', () => {
    const filledCounts = new Map<string, number>([
      ['2026-08-22__18:00__dealer', 2],
      ['2026-08-23__18:00__dealer', 1],
    ]);
    const { getByText, queryByText } = renderSelector({ filledCounts });
    expect(getByText(/\(2\/5\)/)).toBeTruthy();
    expect(queryByText('마감')).toBeNull();
  });

  it('filledCounts 미주입 시 기존 동작(0/N) 완전 보존', () => {
    const { getByText } = renderSelector({});
    expect(getByText(/\(0\/5\)/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npx jest src/components/jobs/AssignmentSelector/__tests__/AssignmentSelector.test.tsx`
Expected: FAIL — 현행은 filledCounts prop이 없고 항상 (0/5), '마감' 미표시

- [ ] **Step 3: types.ts** — `AssignmentSelectorProps`에 추가:

```typescript
  /**
   * 이 공고의 확정 서브맵(키 `date__slot__role`, extractPostingFilledSubmap 결과).
   * 미주입 시 dead counter(0/N) 기존 동작 보존.
   */
  filledCounts?: Map<string, number>;
```

- [ ] **Step 4: AssignmentSelector 구현** — import에 `WorkLogCreator`(`@/domains/schedule`)·`sortTimeSlotsByStart`(`@/utils/date`) 추가 후, `useJobSchedule` 호출(50행) 아래에 hydrate 계층 삽입:

```typescript
const { datedSchedules, isFixed } = useJobSchedule(jobPosting);
const postingFacts = useMemo(() => buildPostingFacts(jobPosting), [jobPosting]);

// hydrate 키 규칙(서버 _posting_slot_key/_posting_role_key 정합 — postingSurfaceModel과 동일)
const UNKNOWN_TIME_KEY = '미정';
const slotHydrateKey = (slot: TimeSlotInfo): string =>
  slot.isTimeToBeAnnounced
    ? UNKNOWN_TIME_KEY
    : WorkLogCreator.extractStartTime(slot.startTime ?? '') || UNKNOWN_TIME_KEY;
const roleHydrateKey = (role: TimeSlotInfo['roles'][number]): string =>
  role.roleId === 'other' ? `other:${role.customName ?? ''}` : role.roleId;

// 확정 서브맵 주입: dead counter(filledCount=0) 대신 실확정으로 교체(불변 생성).
// 슬롯은 표시 정렬(시작시간 순) 동시 적용 — 카드/상세와 같은 순서.
const hydratedSchedules = useMemo(() => {
  return datedSchedules.map((schedule) => ({
    ...schedule,
    timeSlots: sortTimeSlotsByStart(schedule.timeSlots).map((slot) => ({
      ...slot,
      roles: slot.roles.map((role) => ({
        ...role,
        filledCount:
          filledCounts?.get(`${schedule.date}__${slotHydrateKey(slot)}__${roleHydrateKey(role)}`) ??
          0,
      })),
    })),
  }));
}, [datedSchedules, filledCounts]);
```

기존 `scheduleGroups` useMemo(162-164행)를 교체 — 입력을 `hydratedSchedules`로 바꾸고, 그룹 표시용 filledCount를 날짜별 max로 승격(그룹 통지원 전제: max ≥ 하루 요구 = 통지원 불가 = 마감). 날짜 간 슬롯 순서가 다를 수 있으므로 인덱스가 아닌 **키 매칭**:

```typescript
const scheduleGroups = useMemo(() => {
  const groups = groupDatedSchedules(
    hydratedSchedules,
    groupedRequirements,
    postingFacts.postingType
  );
  return groups.map((group) => ({
    ...group,
    timeSlots: group.timeSlots.map((slot) => ({
      ...slot,
      roles: slot.roles.map((role) => ({
        ...role,
        // 그룹 표시 분자 = 날짜별 확정의 최대값(하루 기준·C안). 합산 금지.
        filledCount: group.dates.reduce((max, schedule) => {
          const daySlot = schedule.timeSlots.find(
            (s) => slotHydrateKey(s) === slotHydrateKey(slot)
          );
          const dayRole = daySlot?.roles.find((r) => roleHydrateKey(r) === roleHydrateKey(role));
          return Math.max(max, dayRole?.filledCount ?? 0);
        }, 0),
      })),
    })),
  }));
}, [hydratedSchedules, groupedRequirements, postingFacts.postingType]);
```

비그룹 렌더(205행 `datedSchedules.map`)도 `hydratedSchedules.map`으로 교체. props 비구조화(42-49행)에 `filledCounts` 추가.

- [ ] **Step 5: RoleCheckbox — 마감 표시 + 선택 가능** — 16행과 접근성만 수정:

```typescript
const roleLabel = getRoleDisplayName(role.roleId, role.customName);
const isFilled = isRoleFilled(role);
// 마감이어도 지원 접수는 허용(대기 성격, 스펙 §2.4) — isFilled 로 비활성화하지 않는다.
// 자동 승계 기능은 없으므로 "자동 배정" 류 문구 금지, 마감 배지만 표시.
const isDisabled = disabled;
```

`Pressable`에 접근성 라벨 추가(스크린리더가 마감·대기 상태를 읽도록):

```typescript
      accessibilityLabel={`${roleLabel} ${role.filledCount}/${role.requiredCount}${isFilled ? ', 마감, 대기 지원 가능' : ''}`}
```

- [ ] **Step 6: ApplicationForm 배선** — import 추가:

```typescript
import { usePostingFilledCounts, extractPostingFilledSubmap } from '@/hooks/usePostingFilledCounts';
```

컴포넌트 본문(다른 훅들 옆)에:

```typescript
// 지원화면 확정 집계 주입 — 미배선 시 항상 (0/N)으로 마감이 보이지 않는 핵심 결함 해소
const { data: filledAll } = usePostingFilledCounts(job?.id ? [job.id] : []);
const applyFilledCounts = useMemo(
  () => extractPostingFilledSubmap(filledAll, job?.id ?? ''),
  [filledAll, job?.id]
);
```

297행 `<AssignmentSelector`에 `filledCounts={applyFilledCounts}` 전달. (`job` 변수명이 다르면 실제 변수명에 맞춘다 — 297-302행에서 `jobPosting={job}` 확인됨.)

- [ ] **Step 7: GREEN 확인 + 기존 스위트**

Run: `npx jest src/components/jobs/AssignmentSelector src/components/jobs/__tests__/ApplicationForm.test.tsx`
Expected: PASS. `ApplicationForm.test.tsx`가 QueryClientProvider 부재로 실패하면 테스트 파일 상단에 목 추가:

```typescript
jest.mock('@/hooks/usePostingFilledCounts', () => ({
  usePostingFilledCounts: () => ({ data: undefined }),
  extractPostingFilledSubmap: () => undefined,
}));
```

- [ ] **Step 8: Commit**

```bash
git add src/components/jobs/ApplicationForm.tsx src/components/jobs/AssignmentSelector/AssignmentSelector.tsx src/components/jobs/AssignmentSelector/types.ts src/components/jobs/AssignmentSelector/RoleCheckbox.tsx src/components/jobs/AssignmentSelector/__tests__/AssignmentSelector.test.tsx src/components/jobs/__tests__/ApplicationForm.test.tsx
git commit -m "fix(jobs): 지원화면에 확정 집계 주입 — 마감 표시(일별 max) + 대기 지원 선택 허용"
```

---

### Task 4: 그룹 경계 통일 — 지원화면 그룹핑에 headcount 반영

카드(`utils/date/grouping.ts:206-210`)는 역할+headcount가 같아야 그룹으로 묶고, 지원화면(`selectionUtils.ts:22-24` `getRoleStructureKey`)은 역할 종류만 비교한다 → 날짜별 인원이 다르면 카드는 쪼개는데 지원화면은 묶는 발산. 지원화면 기준을 카드에 맞춘다(인원 다름 = 다른 그룹).

**Files:**

- Modify: `src/utils/assignment/selectionUtils.ts:22-24`
- Test: `src/utils/assignment/__tests__/selectionUtils.test.ts` (기존 파일 있으면 케이스 추가, 없으면 생성)

**Interfaces:**

- Produces: `areTimeSlotsStructureEqual`이 역할 종류 + `requiredCount`까지 같아야 true. `groupDatedSchedules` 소비처(AssignmentSelector) 동작이 카드 그룹핑과 일치.

- [ ] **Step 1: 실패 테스트 작성** — `src/utils/assignment/__tests__/selectionUtils.test.ts`(기존 파일이 있으면 describe 추가):

```typescript
import { areTimeSlotsStructureEqual } from '@/utils/assignment/selectionUtils';
import type { TimeSlotInfo } from '@/types/unified';

const slot = (requiredCount: number): TimeSlotInfo =>
  ({
    startTime: '18:00',
    roles: [{ roleId: 'dealer', displayName: '딜러', requiredCount, filledCount: 0 }],
  }) as TimeSlotInfo;

describe('그룹 경계 통일 — headcount 반영', () => {
  it('역할이 같아도 인원이 다르면 다른 구조다 (카드 그룹핑 areRolesEqual과 동일 기준)', () => {
    expect(areTimeSlotsStructureEqual([slot(5)], [slot(3)])).toBe(false); // 현행 true라 RED
  });

  it('역할·인원 모두 같으면 같은 구조다 (회귀)', () => {
    expect(areTimeSlotsStructureEqual([slot(5)], [slot(5)])).toBe(true);
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npx jest src/utils/assignment/__tests__/selectionUtils.test.ts`
Expected: FAIL — 첫 케이스 true≠false

- [ ] **Step 3: 구현** — `getRoleStructureKey`에 인원 포함:

```typescript
function getRoleStructureKey(role: TimeSlotInfo['roles'][number]): string {
  // 그룹 경계 = 역할 종류 + 하루 요구 인원. 카드 그룹핑(utils/date/grouping.ts areRolesEqual,
  // headcount 비교)과 단일 기준 — 인원이 다른 날짜를 한 그룹으로 묶으면 하루 기준 분모가 성립하지 않는다.
  const base =
    role.roleId === 'other' && role.customName ? `other:${role.customName}` : role.roleId;
  return `${base}#${role.requiredCount}`;
}
```

- [ ] **Step 4: GREEN + 지원화면 스위트 회귀**

Run: `npx jest src/utils/assignment src/components/jobs/AssignmentSelector`
Expected: PASS (그룹핑 픽스처가 균등 인원 전제라면 영향 없음. 실패 시 픽스처의 의도를 확인하고 — 인원 불균등을 한 그룹으로 단언하는 테스트만 분리 그룹 단언으로 갱신)

- [ ] **Step 5: Commit**

```bash
git add src/utils/assignment/selectionUtils.ts src/utils/assignment/__tests__/selectionUtils.test.ts
git commit -m "fix(jobs): 지원화면 그룹 경계에 인원수 반영 — 카드 그룹핑과 단일 기준"
```

---

### Task 5: 구인자 카드 자리 총계 병기 — `자리 M/T 채움`

구인자 카드에만 그룹(다일) 공고일 때 자리 총계 한 줄을 추가한다. 구직자 카드는 불변. 구인자 상세 `배정 현황 M/T명`(`app/(employer)/my-postings/[id]/index.tsx:472-486`)은 이미 자리 기준이므로 **건드리지 않는다**.

**Files:**

- Modify: `src/components/jobs/shared/postingSurfaceModel.ts` (`computeSeatTotals` export 추가)
- Modify: `src/components/jobs/shared/PostingCardSurface.tsx` (`showSeatTotals` prop + 렌더)
- Modify: `src/components/employer/posting/JobPostingCard.tsx` (`showSeatTotals` 전달)
- Test: `src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts` (케이스 추가)

**Interfaces:**

- Produces: `computeSeatTotals(schedule: PostingScheduleModel): { filled: number; total: number } | null` — dated이고 `dayCount>1` 섹션이 하나라도 있을 때만 값 반환(그 외 null=병기 생략, 스펙 §3). `PostingCardSurface`에 `showSeatTotals?: boolean` prop.

- [ ] **Step 1: 실패 테스트 작성** — `postingSurfaceModel.dailyBasis.test.ts`에 추가 (import에 `computeSeatTotals` 병기):

```typescript
describe('computeSeatTotals — 구인자 자리 총계 병기', () => {
  it('그룹(2일, 5명/일, 확정 2+1): 자리 3/10', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 2 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts);
    expect(computeSeatTotals(model)).toEqual({ filled: 3, total: 10 });
  });

  it('한 날만 만석(5,1): 자리 6/10 — 요약 (5/5) 마감과 함께 8/23 공백이 드러난다', () => {
    const { source, filledCounts } = makeGroupedSource([
      { date: '2026-08-22', filled: 5 },
      { date: '2026-08-23', filled: 1 },
    ]);
    const model = buildPostingScheduleModel(source, filledCounts);
    expect(computeSeatTotals(model)).toEqual({ filled: 6, total: 10 });
  });

  it('단일 날짜(dayCount==1)뿐이면 null — 요약과 동일해 병기 생략', () => {
    const { source, filledCounts } = makeGroupedSource([{ date: '2026-08-22', filled: 2 }]);
    const model = buildPostingScheduleModel(source, filledCounts);
    expect(computeSeatTotals(model)).toBeNull();
  });
});
```

- [ ] **Step 2: RED 확인**

Run: `npx jest src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts`
Expected: FAIL — "computeSeatTotals is not a function" (미export)

- [ ] **Step 3: 구현** — `postingSurfaceModel.ts` 말미에 추가:

```typescript
/**
 * 자리 총계(구인자 병기용) — 분자 = Σ(일별 확정), 분모 = Σ(일별 요구) = 자리 수.
 * dated 이고 다일 그룹(dayCount>1)이 있을 때만 의미가 있다(단일 날짜는 요약과 동일해 생략, 스펙 §3).
 */
export function computeSeatTotals(
  schedule: PostingScheduleModel
): { filled: number; total: number } | null {
  if (schedule.variant !== 'dated') {
    return null;
  }
  if (!schedule.sections.some((section) => section.dayCount > 1)) {
    return null;
  }
  return schedule.sections.reduce(
    (acc, section) => ({
      filled: acc.filled + section.filledCount,
      total: acc.total + section.totalCount,
    }),
    { filled: 0, total: 0 }
  );
}
```

- [ ] **Step 4: GREEN 확인**

Run: `npx jest src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts`
Expected: PASS

- [ ] **Step 5: PostingCardSurface 렌더** — props에 `showSeatTotals?: boolean;` 추가(인터페이스 15-28행 + 비구조화 30-43행), import에 `computeSeatTotals` 추가. 스케줄 컬럼의 `<PostingScheduleContent ... />` 바로 아래(124행 `</View>` 직전)에:

```tsx
{
  showSeatTotals
    ? (() => {
        const seatTotals = computeSeatTotals(schedule);
        return seatTotals && seatTotals.total > 0 ? (
          <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            자리 {seatTotals.filled}/{seatTotals.total} 채움
          </Text>
        ) : null;
      })()
    : null;
}
```

- [ ] **Step 6: JobPostingCard 전달** — `<PostingCardSurface` 호출(75행 부근)에 `showSeatTotals` 한 줄 추가:

```tsx
showSeatTotals;
```

- [ ] **Step 7: 타입·전체 회귀**

Run: `npx tsc --noEmit && npx jest src/components/jobs`
Expected: 타입 에러 0, 관련 스위트 PASS

- [ ] **Step 8: Commit**

```bash
git add src/components/jobs/shared/postingSurfaceModel.ts src/components/jobs/shared/PostingCardSurface.tsx src/components/employer/posting/JobPostingCard.tsx src/components/jobs/shared/__tests__/postingSurfaceModel.dailyBasis.test.ts
git commit -m "feat(employer): 구인자 카드에 자리 총계 병기 — 자리 M/T 채움"
```

---

### Task 6: stale 주석 정정 + 전체 품질 게이트

**Files:**

- Modify: `src/utils/job-posting/dateUtils.ts:214-216` (주석만 — 로직 불변)

**Interfaces:**

- Consumes: 없음. Produces: 없음(주석 전용).

- [ ] **Step 1: 주석 정정** — 214-216행의 stale 설명("사람 단위(person basis)", "역할별 peak의 합")을 자리 기준 실제 의미로 교체:

```typescript
// schedule이 있으면 자리(좌석) 기준으로 total/filled 계산.
// total: stats.ts의 calculateTotalPositionsFromSchedule과 의미 동등 — 자리 총합(날짜×슬롯×역할 요구의 합).
// filled: 트리거가 관리하는 job_postings.filled_positions 컬럼(자리 기준)을 단일 진실원으로 사용.
```

- [ ] **Step 2: 전체 품질 게이트 실행 (완료 증거)**

Run (uniqn-mobile/):

```bash
npm run quality
npx jest src/components/jobs src/utils/date src/utils/assignment
```

Expected: type-check·lint·format 통과, 관련 스위트 전건 PASS. 실패 시 이 계획 범위 내 원인만 수정(범위 밖 기존 실패는 보고만).

- [ ] **Step 3: Commit**

```bash
git add src/utils/job-posting/dateUtils.ts
git commit -m "docs(jobs): getClosingStatus stale 주석 정정 — 자리 기준 명시"
```

---

## 스펙 커버리지 자가 점검 (§7 RED 목록 ↔ 태스크)

| 스펙 §7                                      | 태스크                              |
| -------------------------------------------- | ----------------------------------- |
| 1. 지원화면 5/5 주입 → 마감 + 대기 지원 활성 | Task 3 Step 1                       |
| 2. 불균등(2,1) → 카드 (2/5), 자리 총계 3/10  | Task 1 Step 1 · Task 5 Step 1       |
| 3. 한 날만 만석(5,1) → (5/5) 마감, 자리 6/10 | Task 1 Step 1 · Task 5 Step 1       |
| 4. 요약 == 일별 max 불변식                   | Task 1 Step 1                       |
| 5. 그룹 경계 headcount 반영                  | Task 4                              |
| 6. dayCount==1 회귀                          | Task 1 Step 1 · Task 5 Step 1(null) |
| (추가) 타임 슬롯 정렬 — 스크린샷 실측 버그   | Task 2                              |

**스펙 §8 미검증 가정 해소**: fixed 공고 확정 키는 `FIXED_SCHEDULE__NEGOTIABLE__<role>` 마커로 이미 hydrate됨(기존 테스트 `postingSurfaceModel.hydrate.test.ts:29` 실측) — fixed는 dayCount 개념이 없어 이번 변경 반경 밖(§3 표 그대로 확정). 카드 높이 증가는 구인자 카드 한 줄(text-xs)뿐 — 실기기 QA 항목으로 이관.

**구현하지 않는 것(스펙 정합)**: `formatRoleLine` 문자열 문법은 불변(의미는 모델이 하루 기준으로 교정), `facts.ts` `canApply` 게이트·`ApplicationValidator`는 주입하지 않음(마감 지원 허용 정책, `selectors.ts:83-86` 주석 실측), DB/서버 전부 불변.
