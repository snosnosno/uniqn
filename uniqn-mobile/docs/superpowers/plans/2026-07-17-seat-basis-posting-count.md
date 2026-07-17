# 좌석 기준 인원카운트 통일 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고 인원카운트(정원·확정)를 좌석(seat) 기준으로 단일화 — 정원=모든 날짜×슬롯×역할 인원 총합, 확정=활성 work_logs 행 수.

**Architecture:** 클라 `calculateTotalPositionsFromSchedule`을 peak→합산으로 전환하고, DB의 `filled_positions` 유지 주체를 applications 상태 트리거에서 work_logs 좌석 델타 트리거로 이전한다. capacity_full↔active 전이는 `job_postings` BEFORE 트리거 단일 지점으로 수렴. 그룹 날짜범위 표시는 날짜별 섹션으로 전개해 차원 불일치를 제거한다.

**Tech Stack:** TypeScript(RN/Expo) · Supabase PostgreSQL(plpgsql 트리거/RPC) · jest · pgTAP(로컬 Docker)

**Spec:** `uniqn-mobile/docs/superpowers/specs/2026-07-17-seat-basis-posting-count-design.md` — 작업 전 반드시 읽을 것.

## Global Constraints

- 모든 응답·커밋 메시지·주석은 **한글** (프로젝트 CLAUDE.md).
- 커밋 형식: `<type>(<scope>): <한글>` — feat/fix/refactor/test/docs.
- 작업 디렉토리: `uniqn-mobile/`. 경로 alias `@/` 사용(시스템 절대경로 금지).
- 앱 런타임 로깅은 `logger.*`만 (`console.log` 금지).
- **prod 적용 금지**: `mcp__supabase__*` 직접 호출 금지. 마이그레이션은 파일 작성 + **로컬 Docker 검증까지만**(`npm run db:start` / `npm run db:reset`). prod 적용은 사용자 게이트.
- 기존 마이그레이션 파일 수정 금지 — 신규 파일만 추가.
- DB 신규 함수는 secdef-hardening 준수: `SECURITY DEFINER`면 `SET search_path` 명시, anon EXECUTE REVOKE(위키 `decisions/secdef-hardening`).
- baseline 스키마 = `supabase/migrations/20260710000002_baseline_schema_from_prod.sql` (이하 "baseline"). 함수 원문 복사 출처.

## 파일 구조(전체 지도)

| 구분   | 파일                                                                       | 책임                                                     |
| ------ | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Modify | `src/domains/job-posting/stats.ts`                                         | totalPositions 좌석합 계산                               |
| Modify | `src/domains/job-posting/__tests__/totalPositions.test.ts`                 | 합산 기대로 전환                                         |
| Modify | `src/components/jobs/shared/postingSurfaceModel.ts`                        | 그룹 날짜별 전개 모델(`days`), `sumHydrateForRange` 제거 |
| Modify | `src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts`  | 그룹 일별 hydrate 테스트                                 |
| Modify | `src/components/jobs/shared/PostingScheduleContent.tsx`                    | 그룹 일별 렌더 + 8일↑ 접힘                               |
| Create | `supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql` | 트리거 2종·RPC 3종 재작성·백필                           |
| Create | `supabase/tests/seat_basis_filled_positions.test.sql`                      | pgTAP 좌석 기준 검증                                     |
| Delete | `supabase/tests/person_basis_filled_positions.test.sql`                    | 좌석 기준 테스트로 대체(DISABLED 상태였음)               |
| Modify | `e2e/tests/p2-standard/employer-posting-capacity-recovery.spec.ts`         | 좌석 기준 기대로 정렬                                    |

---

### Task 1: 클라 totalPositions 좌석합 전환

**Files:**

- Modify: `uniqn-mobile/src/domains/job-posting/stats.ts:30-68`
- Test: `uniqn-mobile/src/domains/job-posting/__tests__/totalPositions.test.ts`

**Interfaces:**

- Consumes: 없음(독립).
- Produces: `calculateTotalPositionsFromSchedule(schedule: PostingSchedule): number` — 시그니처 불변, 의미만 peak→합산. Task 4의 SQL `_total_positions_from_schedule`과 **동치**여야 함(빈 role 스킵 + count 음수 방어 + 전체 합).

- [ ] **Step 1: 테스트 기대값을 좌석합으로 수정 (RED 준비)**

`totalPositions.test.ts`에서 다음 기대값을 수정한다(테스트명도 함께 갱신). 파일 상단 주석(4-5행)의 "peak의 합" 설명은 "모든 날짜×슬롯×역할 count의 총합(좌석 기준)"으로 교체.

| 테스트(라인 근처)                        | 기존 기대 | 새 기대 | 새 테스트명                                                    |
| ---------------------------------------- | --------- | ------- | -------------------------------------------------------------- |
| `grouped 3-day dealer x2 every day` (84) | 2         | **6**   | `grouped 3-day dealer x2 every day -> sum 6`                   |
| `non-grouped 3-day dealer x2` (111)      | 2         | **6**   | `non-grouped 3-day dealer x2 -> sum 6`                         |
| `mixed counts across dates` (135)        | 3         | **7**   | `mixed counts: d1,d2 dealer x2 + d3 dealer x3 -> 7`            |
| `multi-role peak sum ... 2 days` (159)   | 4         | **8**   | `multi-role seat sum: (dealer2+floor1+serving1) x 2 days -> 8` |
| `other with customRole` (197)            | 4         | **7**   | 주석 `// translator 2+3 + security 1+1 = 7`                    |
| `other without customRole` (234)         | 3         | **5**   | 주석 `// other(무customRole) 2+3 = 5`                          |
| `same role in two timeSlots` (265)       | 3         | **5**   | `... dealer x2 morning + dealer x3 evening -> 5`               |

불변 유지(수정 금지): fixed 3건(9·31·46행 — 단일 슬롯이라 합=peak 동일), empty requirements 0(73행), empty roles 스킵(284행), count 0/role 누락 스킵(303행, 기대 1 유지).

- [ ] **Step 2: 테스트 실행 — 수정한 7건 FAIL 확인**

```bash
cd uniqn-mobile && npx jest src/domains/job-posting/__tests__/totalPositions.test.ts 2>&1 | tail -20
```

기대: 수정 7건 FAIL(현 구현이 peak 반환), 나머지 PASS.

- [ ] **Step 3: `stats.ts` 구현을 합산으로 교체 (GREEN)**

`stats.ts:30-68`의 `calculateTotalPositionsFromSchedule` 본문을 다음으로 교체(주석 포함). `getRoleKey`(17-28행)는 빈 role 스킵용으로 유지:

```ts
/**
 * 좌석 단위(seat basis) 모집 인원 계산.
 * 모든 날짜 × 타임슬롯 × 역할의 count 총합. 날짜마다 다른 사람을 투입하는
 * 대회 이벤트를 기본 모델로 하며, DB `_total_positions_from_schedule`(트리거
 * 재계산)과 동치 규칙 — 빈 role 스킵, 음수 count 0 처리.
 * (2026-07-17 좌석 기준 통일 설계 — 구 peak(회전 가정) 모델 대체)
 */
export function calculateTotalPositionsFromSchedule(schedule: PostingSchedule): number {
  let total = 0;

  schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        if (getRoleKey(role) === null) {
          return;
        }
        total += Math.max(0, role.count ?? 0);
      });
    });
  });

  return total;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd uniqn-mobile && npx jest src/domains/job-posting/__tests__/totalPositions.test.ts 2>&1 | tail -5
```

기대: 전건 PASS.

- [ ] **Step 5: 파급 스위트 실행 — totalPositions 기대를 가진 다른 테스트 정렬**

```bash
cd uniqn-mobile && npx jest src/domains/job-posting src/utils/job-posting src/schemas 2>&1 | tail -15
```

FAIL이 나오면 **좌석합 기준으로 기대값만** 정렬한다(구현 로직을 되돌리지 말 것). 특히 `sp1Equivalence.test.ts`·`draftAdapter.test.ts`·`submission.test.ts`에 totalPositions 스냅샷/기대가 있으면 합산값으로 수정.

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/domains/job-posting uniqn-mobile/src/utils/job-posting uniqn-mobile/src/schemas
git commit -m "feat(job-posting): totalPositions 좌석합 전환 — peak(회전 가정) 모델 대체"
```

---

### Task 2: 그룹 날짜범위 모델 — 날짜별 전개

**Files:**

- Modify: `uniqn-mobile/src/components/jobs/shared/postingSurfaceModel.ts`
- Test: `uniqn-mobile/src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts`

**Interfaces:**

- Consumes: `extractPostingFilledSubmap` 서브맵(키 `date__slot__role`) — 기존 계약 불변.
- Produces(Task 3이 사용):

```ts
export interface PostingDateSectionDayModel {
  key: string; // `${sectionKey}-${date}`
  date: string; // YYYY-MM-DD
  label: string; // formatDateShortWithDay(date)
  totalCount: number;
  filledCount: number;
  timeSlots: PostingTimeSlotDisplayModel[];
}
// PostingDateSectionDisplayModel 에 추가되는 필드:
//   days?: PostingDateSectionDayModel[]  — 그룹 섹션일 때만 존재(일별 전개)
// 그룹 섹션의 timeSlots = "요약"(role.count = 하루치×일수, role.filled = 일별 합)
// 그룹 섹션의 totalCount/filledCount = days 합계
```

- [ ] **Step 1: 실패 테스트 작성**

`postingSurfaceModel.filled.test.ts`에 그룹 케이스 describe를 추가:

```ts
const groupedSource = {
  workflow: { isFixed: false, usesGroupedDateRanges: true },
  scheduleDisplay: {
    fixed: undefined,
    dateRequirements: [],
    dateGroups: [
      {
        id: 'g1',
        startDate: '2026-07-14',
        endDate: '2026-07-15',
        timeSlots: [
          {
            id: 's1',
            startTime: '19:00',
            isTimeToBeAnnounced: false,
            roles: [{ id: 'r1', role: 'dealer', count: 3, filled: 0 }],
          },
        ],
      },
    ],
  },
} as any;

describe('buildPostingScheduleModel 그룹 날짜별 전개 (좌석 기준)', () => {
  it('그룹 섹션을 days 로 전개하고 일별 filled 를 각 날짜 키로 hydrate 한다', () => {
    const filledCounts = new Map<string, number>([
      ['2026-07-14__19:00__dealer', 3], // 14일 3명 확정
      // 15일은 0명
    ]);
    const model = buildPostingScheduleModel(groupedSource, filledCounts);
    expect(model.variant).toBe('dated');
    const section = (model as any).sections[0];

    // 일별 전개: 2일
    expect(section.days).toHaveLength(2);
    expect(section.days[0].date).toBe('2026-07-14');
    expect(section.days[0].timeSlots[0].roles[0]).toMatchObject({
      count: 3,
      filled: 3,
      isFilled: true,
    });
    expect(section.days[1].date).toBe('2026-07-15');
    expect(section.days[1].timeSlots[0].roles[0]).toMatchObject({
      count: 3,
      filled: 0,
      isFilled: false,
    });

    // 요약(접힘 표시용): count = 하루치3 × 2일 = 6, filled = 3+0
    expect(section.timeSlots[0].roles[0]).toMatchObject({
      count: 6,
      filled: 3,
      isFilled: false,
    });
    expect(section.totalCount).toBe(6);
    expect(section.filledCount).toBe(3);
  });

  it('비그룹 단일날짜 섹션에는 days 가 없다', () => {
    const model = buildPostingScheduleModel(datedSource, new Map());
    expect((model as any).sections[0].days).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실행 — FAIL 확인**

```bash
cd uniqn-mobile && npx jest postingSurfaceModel.filled 2>&1 | tail -15
```

기대: 신규 2건 FAIL(`days` undefined / 요약 count 3≠6), 기존 2건 PASS.

- [ ] **Step 3: 모델 구현**

`postingSurfaceModel.ts` 수정 4곳:

(a) 타입 추가 — `PostingTimeSlotDisplayModel` 아래(75-79행 뒤):

```ts
export interface PostingDateSectionDayModel {
  key: string;
  date: string;
  label: string;
  totalCount: number;
  filledCount: number;
  timeSlots: PostingTimeSlotDisplayModel[];
}
```

`PostingDateSectionDisplayModel`(81-88행)에 필드 추가:

```ts
export interface PostingDateSectionDisplayModel {
  key: string;
  label: string;
  dayCount: number;
  totalCount: number;
  filledCount: number;
  timeSlots: PostingTimeSlotDisplayModel[];
  /** 그룹 날짜범위 섹션일 때만: 날짜별 전개(좌석 기준 단일 소스). */
  days?: PostingDateSectionDayModel[];
}
```

(b) import에 `generateDateRange` 추가(14행): `import { formatDateRangeWithCount, formatDateShortWithDay, generateDateRange, getDayCount } from '@/utils/date';`

(c) `buildDatedScheduleModel`(205-282행) 재작성 — 그룹 분기를 날짜별 전개로:

```ts
function buildDatedScheduleModel(
  source: PostingScheduleSource,
  filledCounts?: Map<string, number>
): Extract<PostingScheduleModel, { variant: 'dated' }> | null {
  const isGrouped =
    source.workflow.usesGroupedDateRanges && source.scheduleDisplay.dateGroups.length > 0;

  const sections = isGrouped
    ? source.scheduleDisplay.dateGroups.map((group) => buildGroupedSection(group, filledCounts))
    : source.scheduleDisplay.dateRequirements.map((requirement, index) =>
        buildSingleDateSection(requirement, index, filledCounts)
      );

  if (sections.length === 0) {
    return null;
  }

  return {
    variant: 'dated',
    usesGroupedRanges: source.workflow.usesGroupedDateRanges,
    sections,
    isPartial: sections.some((section) =>
      section.timeSlots.some((slot) => slot.timeLabel === UNKNOWN_TIME_LABEL)
    ),
  };
}

/** 비그룹 단일 날짜 섹션 — 기존 동작 보존(단일 날짜 키 hydrate). */
function buildSingleDateSection(
  requirement: { date: string; timeSlots: TimeSlotSource[] },
  index: number,
  filledCounts?: Map<string, number>
): PostingDateSectionDisplayModel {
  const key = `${requirement.date}-${index}`;
  const timeSlots = requirement.timeSlots.map((slot, slotIndex) => ({
    key: `${key}-${formatTimeLabel(slot)}-${slotIndex}`,
    timeLabel: formatTimeLabel(slot),
    roles: toRoleModels(slot.roles, {
      date: requirement.date,
      slotKey: slotMatchKey(slot),
      filledCounts,
    }),
  }));

  return {
    key,
    label: formatDateLabel(requirement.date),
    dayCount: 1,
    totalCount: sumSlotCounts(timeSlots, 'count'),
    filledCount: sumSlotCounts(timeSlots, 'filled'),
    timeSlots,
  };
}

/**
 * 그룹 날짜범위 섹션 — 날짜별 전개(좌석 기준).
 * 각 날짜를 자기 날짜 키(`date__slot__role`)로 개별 hydrate 하고,
 * 섹션 요약 timeSlots 는 count=하루치×일수 / filled=일별 합으로 만든다.
 * (구 sumHydrateForRange 범위합산은 count 가 하루치라 6/3 차원 불일치를 냈음 — 제거)
 */
function buildGroupedSection(
  group: {
    id?: string;
    startDate: string;
    endDate: string;
    timeSlots: TimeSlotSource[];
  },
  filledCounts?: Map<string, number>
): PostingDateSectionDisplayModel {
  const sectionKey = group.id || `${group.startDate}-${group.endDate}`;
  const dates = generateDateRange(group.startDate, group.endDate);
  const effectiveDates = dates.length > 0 ? dates : [group.startDate];

  const days: PostingDateSectionDayModel[] = effectiveDates.map((date) => {
    const timeSlots = group.timeSlots.map((slot, slotIndex) => ({
      key: `${sectionKey}-${date}-${formatTimeLabel(slot)}-${slotIndex}`,
      timeLabel: formatTimeLabel(slot),
      roles: toRoleModels(slot.roles, {
        date,
        slotKey: slotMatchKey(slot),
        filledCounts,
      }),
    }));

    return {
      key: `${sectionKey}-${date}`,
      date,
      label: formatDateLabel(date),
      totalCount: sumSlotCounts(timeSlots, 'count'),
      filledCount: sumSlotCounts(timeSlots, 'filled'),
      timeSlots,
    };
  });

  const dayCount = effectiveDates.length;
  // 요약 timeSlots: 슬롯 구조는 하루치와 동일하되 count×일수, filled=일별 합.
  const summaryTimeSlots: PostingTimeSlotDisplayModel[] = group.timeSlots.map((slot, slotIndex) => {
    const timeLabel = formatTimeLabel(slot);
    return {
      key: `${sectionKey}-${timeLabel}-${slotIndex}`,
      timeLabel,
      roles: slot.roles.map((role, roleIndex) => {
        const perDayCount = role.count ?? role.headcount ?? 0;
        const count = perDayCount * dayCount;
        const filled = days.reduce(
          (sum, day) => sum + (day.timeSlots[slotIndex]?.roles[roleIndex]?.filled ?? 0),
          0
        );
        const base = toRoleModels([role])[0]!;
        return { ...base, count, filled, isFilled: count > 0 && filled >= count };
      }),
    };
  });

  return {
    key: sectionKey,
    label:
      dayCount <= 1
        ? formatDateLabel(group.startDate)
        : formatDateRangeWithCount(group.startDate, group.endDate),
    dayCount,
    totalCount: days.reduce((sum, day) => sum + day.totalCount, 0),
    filledCount: days.reduce((sum, day) => sum + day.filledCount, 0),
    timeSlots: summaryTimeSlots,
    days,
  };
}

function sumSlotCounts(
  timeSlots: PostingTimeSlotDisplayModel[],
  field: 'count' | 'filled'
): number {
  return timeSlots.reduce(
    (sum, slot) => sum + slot.roles.reduce((roleSum, role) => roleSum + role[field], 0),
    0
  );
}
```

(d) 삭제: `sumHydrateForRange` 함수(357-375행)와 `RoleHydrateCtx`의 `range` variant(377-383행) — `toRoleModels`(385행)의 ctx 처리에서 `'range' in ctx` 분기 제거:

```ts
type RoleHydrateCtx = { date: string; slotKey: string; filledCounts?: Map<string, number> };

function toRoleModels(
  roles: readonly RoleSource[],
  ctx?: RoleHydrateCtx
): PostingRoleDisplayModel[] {
  return roles.map((role, index) => {
    const label = getRoleDisplayName(role.role || role.name || '', role.customRole);
    const count = role.count ?? role.headcount ?? 0;
    const hydrated = ctx
      ? ctx.filledCounts?.get(`${ctx.date}__${ctx.slotKey}__${roleMatchKey(role)}`)
      : undefined;
    const filled = hydrated ?? role.filled ?? 0;
    const keySource =
      role.role === 'other' && role.customRole
        ? `other:${role.customRole}`
        : role.role || role.name;

    return {
      key: `${keySource || 'role'}-${count}-${index}`,
      label,
      count,
      filled,
      isFilled: count > 0 && filled >= count,
    };
  });
}
```

주의: `generateDateRange`가 `@/utils/date` 배럴에서 export되는지 확인(안 되어 있으면 `@/utils/date/core` 등 실제 위치에서 export 추가 — `GroupedDateRequirementDisplay.tsx:11`이 이미 `@/utils/date`에서 import하므로 존재할 것).

- [ ] **Step 4: 테스트 통과 + 관련 스위트 확인**

```bash
cd uniqn-mobile && npx jest postingSurfaceModel 2>&1 | tail -15
```

기대: `postingSurfaceModel.filled` 신규 포함 전건 PASS. `postingSurfaceModel.hydrate.test.ts`·`postingSurfaceModel.test.ts`(2곳)가 range 합산/그룹 구형 기대로 FAIL하면 **days 전개 기대로 정렬**(예: 그룹 섹션 role.count 기대가 하루치 3이었다면 요약은 6, 일별은 3).

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/jobs/shared
git commit -m "feat(posting-surface): 그룹 날짜범위를 날짜별 섹션으로 전개 — 좌석 기준 hydrate, 범위합산(6/3 불일치) 제거"
```

---

### Task 3: 그룹 일별 렌더 + 8일 이상 접힘

**Files:**

- Modify: `uniqn-mobile/src/components/jobs/shared/PostingScheduleContent.tsx`
- Test: `uniqn-mobile/src/components/jobs/__tests__/PostingSharedContent.test.tsx`(기존 파일에 케이스 추가)

**Interfaces:**

- Consumes: Task 2의 `section.days?: PostingDateSectionDayModel[]`, 요약 `section.timeSlots`.
- Produces: 렌더 규칙 — card는 요약만, detail은 일별 전개(dayCount ≥ 8이면 기본 접힘 + 토글).

- [ ] **Step 1: 실패 테스트 작성**

`PostingSharedContent.test.tsx`에 추가(기존 렌더 헬퍼/모킹 패턴 재사용 — 파일 상단의 기존 arrange 방식을 그대로 따를 것):

```tsx
it('그룹 섹션 detail 렌더는 날짜별 카운트를 표시한다 (14일 3/3, 15일 0/3)', () => {
  const filledCounts = new Map<string, number>([['2026-07-14__19:00__dealer', 3]]);
  render(
    <PostingScheduleContent
      display="detail"
      filledCounts={filledCounts}
      workflow={{ isFixed: false, usesGroupedDateRanges: true } as any}
      scheduleDisplay={
        {
          fixed: undefined,
          dateRequirements: [],
          dateGroups: [
            {
              id: 'g1',
              startDate: '2026-07-14',
              endDate: '2026-07-15',
              timeSlots: [
                {
                  id: 's1',
                  startTime: '19:00',
                  isTimeToBeAnnounced: false,
                  roles: [{ id: 'r1', role: 'dealer', count: 3, filled: 0 }],
                },
              ],
            },
          ],
        } as any
      }
    />
  );
  // 일별 라인 2개 — 요약 6/3 단일 표기가 아니라 날짜별 3/3, 0/3
  expect(screen.getByText(/딜러 3명 \(3\/3\)/)).toBeTruthy();
  expect(screen.getByText(/딜러 3명 \(0\/3\)/)).toBeTruthy();
});

it('그룹 섹션 card 렌더는 요약 좌석합을 표시한다 (딜러 6명 (3/6))', () => {
  const filledCounts = new Map<string, number>([['2026-07-14__19:00__dealer', 3]]);
  render(
    <PostingScheduleContent
      display="card"
      filledCounts={filledCounts}
      workflow={{ isFixed: false, usesGroupedDateRanges: true } as any}
      scheduleDisplay={/* 위와 동일 scheduleDisplay */ undefined as any}
    />
  );
  expect(screen.getByText(/딜러 6명 \(3\/6\)/)).toBeTruthy();
});
```

(두 번째 테스트의 scheduleDisplay는 첫 테스트와 동일 객체를 상수로 추출해 재사용할 것.)

- [ ] **Step 2: 실행 — FAIL 확인**

```bash
cd uniqn-mobile && npx jest PostingSharedContent 2>&1 | tail -10
```

- [ ] **Step 3: 렌더 구현**

`PostingScheduleContent.tsx`의 dated 분기(100-164행) 수정:

```tsx
{schedule.sections.map((section) => {
  const dateRangeText = display === 'card' ? section.label.split('\n')[0] : section.label;
  const showCardDayCount = display === 'card' && section.dayCount > 1;
  // 그룹 섹션: card=요약만, detail=일별 전개(8일↑ 기본 접힘)
  const renderDays = display === 'detail' && section.days && section.days.length > 0;

  return (
    <View
      key={section.key}
      className={
        display === 'card' ? 'mb-3' : 'mb-3 rounded-lg bg-surface-page dark:bg-surface p-3'
      }
    >
      <Text /* 기존 헤더 마크업 유지 */>{dateRangeText}</Text>
      {showCardDayCount ? (
        <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {section.dayCount}일
        </Text>
      ) : null}

      {renderDays ? (
        <GroupedDaysBlock section={section} showFilledCount={showFilledCount} />
      ) : (
        section.timeSlots.map((slot) => (
          /* 기존 slot 렌더 블록 그대로 (126-161행) */
        ))
      )}
    </View>
  );
})}
```

새 서브컴포넌트(파일 하단, `RoleBadge` 위에 추가):

```tsx
const COLLAPSE_THRESHOLD_DAYS = 8;

function GroupedDaysBlock({
  section,
  showFilledCount,
}: {
  section: Extract<PostingScheduleModel, { variant: 'dated' }>['sections'][number];
  showFilledCount: boolean;
}) {
  const days = section.days ?? [];
  const [expanded, setExpanded] = React.useState(days.length < COLLAPSE_THRESHOLD_DAYS);

  if (!expanded) {
    return (
      <View className="ml-2 mt-2">
        {section.timeSlots.map((slot) => (
          <View key={slot.key} className="mt-1">
            <Text className="mb-1 text-sm font-sans-medium text-content-secondary">
              {slot.timeLabel}
            </Text>
            <View className="ml-4 flex-row flex-wrap">
              {slot.roles.map((role) => (
                <RoleBadge key={role.key} role={role} showFilledCount={showFilledCount} />
              ))}
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => setExpanded(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="일별 인원 펼치기"
          className="mt-2 min-h-[44px] justify-center"
        >
          <Text className="text-sm text-primary-600 dark:text-primary-400 font-sans">
            일별 인원 보기 ({days.length}일)
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="ml-2 mt-2 gap-2">
      {days.map((day) => (
        <View key={day.key}>
          <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
            {day.label}
          </Text>
          {day.timeSlots.map((slot) => (
            <View key={slot.key} className="ml-2 mt-1">
              <Text className="mb-1 text-sm font-sans-medium text-content-secondary">
                {slot.timeLabel}
              </Text>
              <View className="ml-4 flex-row flex-wrap">
                {slot.roles.map((role) => (
                  <RoleBadge key={role.key} role={role} showFilledCount={showFilledCount} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
```

import에 `Pressable`·`React`(useState) 추가. card 분기는 무변경(요약 timeSlots가 자동 적용됨 — Task 2가 그룹 섹션 timeSlots를 요약으로 만들었으므로).

- [ ] **Step 4: 테스트 통과 + 컴포넌트 스위트 확인**

```bash
cd uniqn-mobile && npx jest PostingSharedContent PostingCardSurface JobCard JobPostingCard 2>&1 | tail -10
```

기대: 전건 PASS(JobCard/JobPostingCard의 기존 그룹 기대가 있으면 요약/일별 값으로 정렬).

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/jobs
git commit -m "feat(posting-surface): 그룹 일별 카운트 렌더 + 8일 이상 기본 접힘 토글"
```

---

### Task 4: DB — 좌석 트리거·RPC 재작성·백필 (pgTAP 레드-그린)

**Files:**

- Create: `uniqn-mobile/supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql`
- Create: `uniqn-mobile/supabase/tests/seat_basis_filled_positions.test.sql`
- Delete: `uniqn-mobile/supabase/tests/person_basis_filled_positions.test.sql`

**Interfaces:**

- Consumes: baseline의 함수 원문(라인 인용 아래 각 단계).
- Produces:
  - `public._total_positions_from_schedule(p_schedule jsonb) RETURNS int` — 좌석합(빈 role 스킵, 음수 0 방어). 클라 Task 1과 동치.
  - `public.fn_recalc_total_and_capacity()` BEFORE 트리거 — total 재계산 + capacity_full↔active 전이 **단일 지점**.
  - `public.fn_sync_filled_positions_seat()` AFTER 트리거(work_logs) — filled 좌석 델타 **만**.
  - 재작성 RPC: `fn_update_job_posting_stats`(filled 제거) · `add_direct_staff`(사람 게이트 제거) · `remove_direct_staff`(동) · `cancel_application_atomically`(순서 재배열). `confirm_application` 무변경.

- [ ] **Step 1: 사전 확인 — job_postings 기존 트리거와 filled 쓰기 경로 전수 grep**

```bash
cd uniqn-mobile && grep -n "ON public.job_postings" supabase/migrations/20260710000002_baseline_schema_from_prod.sql | grep -i trigger
grep -rn "filled_positions" supabase/migrations/2026071[1-9]* supabase/migrations/2026072* 2>/dev/null
```

목적: ① BEFORE 트리거 이름 충돌 회피 ② baseline 이후 마이그에 filled 증감 경로가 추가됐는지 확인(있으면 이 계획의 재작성 대상에 추가). 결과를 커밋 메시지에 한 줄 기록.

- [ ] **Step 2: pgTAP 테스트 작성 (RED 기준)**

`supabase/tests/seat_basis_filled_positions.test.sql` 신규 작성. 구조는 삭제 예정인 `person_basis_filled_positions.test.sql`의 픽스처 패턴(auth.users seed → public.users → workspace → job_postings → confirm/cancel RPC 호출)을 재사용하되 시나리오를 좌석 기준으로:

```sql
-- ============================================================
-- seat basis filled/total positions 회귀 테스트 (2026-07-17 좌석 기준 통일)
-- 사용법: psql "$SUPABASE_DB_URL" -f supabase/tests/seat_basis_filled_positions.test.sql
-- ============================================================
BEGIN;
SELECT plan(9);

-- 픽스처: owner 1, staff 2, 공고 1(2026-07-14~15 grouped, 19:00 dealer 3/일)
-- person_basis 테스트의 seed 블록(auth.users→public.users→workspaces→job_postings)을
-- 그대로 복사하되 schedule 은 다음으로:
--   {"kind":"dated","requirements":[
--     {"date":"2026-07-14","isGrouped":true,"timeSlots":[{"startTime":"19:00","roles":[{"role":"dealer","count":3}]}]},
--     {"date":"2026-07-15","isGrouped":true,"timeSlots":[{"startTime":"19:00","roles":[{"role":"dealer","count":3}]}]}]}
-- job_postings INSERT 시 total_positions 는 의도적으로 틀린 값(1)을 넣는다
-- → BEFORE 트리거 재계산 검증.

-- T1. BEFORE 트리거: INSERT 시 total_positions 재계산 = 6 (클라 값 1 무시)
SELECT is(
  (SELECT total_positions FROM job_postings WHERE id = :'v_job_id'), 6,
  'T1: INSERT 시 서버가 좌석합 6으로 재계산');

-- T2. staff1 이 14·15일 모두 지원→확정(confirm_application flat 2건)
--     → filled = 2 (좌석. 구 person basis 면 1)
SELECT is((SELECT filled_positions FROM job_postings WHERE id = :'v_job_id'), 2,
  'T2: 같은 사람 2일 확정 = 좌석 2');

-- T3. stats 미러 정합
SELECT is(((SELECT stats->>'filledPositions' FROM job_postings WHERE id = :'v_job_id'))::int, 2,
  'T3: stats.filledPositions 미러 = 2');

-- T4. add_direct_staff 로 staff2 를 14일 추가 → filled = 3
SELECT is((SELECT filled_positions FROM job_postings WHERE id = :'v_job_id'), 3,
  'T4: 직접추가 1좌석 = 3');

-- T5. 같은 staff2 를 15일 추가(2번째 호출) → filled = 4
--     (구 person basis 는 v_already>0 으로 3 유지 — red-green 핵심)
SELECT is((SELECT filled_positions FROM job_postings WHERE id = :'v_job_id'), 4,
  'T5: 같은 스태프 2번째 좌석도 카운트 = 4');

-- T6. 15일 dealer 잔여 1좌석에 staff3 확정 + 14일 잔여 0 →
--     6좌석 모두 채우면 status = capacity_full (그 전까진 active 유지)
--     [14일: staff1+staff2+staff4 = 3 / 15일: staff1+staff2+staff3 = 3]
SELECT is((SELECT status::text FROM job_postings WHERE id = :'v_job_id'), 'capacity_full',
  'T6: 전 좌석 충족 시에만 capacity_full');

-- T7. cancel_application_atomically(staff1, employer_initiates)
--     → 좌석 2 감소 = 4, status active 복귀, 반환 new_filled_positions = 4
--     (반환값 4 검증 = DELETE-먼저 재배열 검증)
SELECT is((SELECT filled_positions FROM job_postings WHERE id = :'v_job_id'), 4,
  'T7a: 취소로 좌석 2 감소');
SELECT is((SELECT status::text FROM job_postings WHERE id = :'v_job_id'), 'active',
  'T7b: capacity_full → active 자동 복귀');
-- (RPC 반환 jsonb 의 new_filled_positions 는 DO 블록에서 캡처해 임시테이블로 전달, is() 로 4 검증)

-- T8. 컨테이너 공고에 add_direct_staff → filled 0 유지
SELECT is((SELECT filled_positions FROM job_postings WHERE id = :'v_container_id'), 0,
  'T8: 컨테이너 filled 불변');

SELECT * FROM finish();
ROLLBACK;
```

작성 시 규칙: ① 픽스처 값 전달은 person_basis 테스트처럼 DO 블록 + 임시테이블(psql 변수 `:'v_job_id'` 문법이 DO 블록과 안 섞이면 `CREATE TEMP TABLE ids AS SELECT ...` 패턴으로 통일) ② confirm RPC 호출은 `p_assignments` flat 배열(각 원소 `{"date","timeSlot":"19:00","role":"dealer"}`) ③ auth.uid() 바인딩이 필요한 RPC는 person_basis 테스트가 쓰는 위장 방식(`set local request.jwt.claims` 또는 SECURITY DEFINER 우회 방식)을 그대로 복사.

- [ ] **Step 3: RED 실측 — 현행 스키마에서 실패 확인**

```bash
cd uniqn-mobile && npm run db:start 2>&1 | tail -3
npm run db:reset 2>&1 | tail -5
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/seat_basis_filled_positions.test.sql 2>&1 | tail -15
```

기대: T1(total=6 아님)·T2(filled=1)·T5(3 유지) 등 **FAIL 다수** — 현행 person basis 실측. (공유 Docker 스택 병렬세션 주의 — MEMORY 규칙: pgTAP 전 스택 상태 재확인.)

- [ ] **Step 4: 마이그레이션 작성**

`supabase/migrations/20260718000000_seat_basis_filled_total_positions.sql` — 아래 순서 그대로 한 파일(단일 트랜잭션):

```sql
-- ============================================================
-- 좌석(seat) 기준 인원카운트 통일 (2026-07-17 설계)
-- total = Σ(날짜×슬롯×역할 count) · filled = 활성 work_logs 행 수
-- 전이 단일 지점 = job_postings BEFORE 트리거
-- 설계: docs/superpowers/specs/2026-07-17-seat-basis-posting-count-design.md
-- ============================================================

-- 1) 좌석합 계산 함수 (클라 calculateTotalPositionsFromSchedule 동치)
CREATE OR REPLACE FUNCTION public._total_positions_from_schedule(p_schedule jsonb)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(SUM(GREATEST(COALESCE((r->>'count')::int, (r->>'headcount')::int, 0), 0)), 0)::int
  FROM jsonb_array_elements(COALESCE(p_schedule->'requirements', '[]'::jsonb)) req
  CROSS JOIN jsonb_array_elements(COALESCE(req->'timeSlots', '[]'::jsonb)) ts
  CROSS JOIN jsonb_array_elements(COALESCE(ts->'roles', '[]'::jsonb)) r
  WHERE COALESCE(NULLIF(btrim(r->>'role'), ''), NULLIF(btrim(r->>'name'), '')) IS NOT NULL;
$$;
COMMENT ON FUNCTION public._total_positions_from_schedule(jsonb) IS
  '좌석 기준 정원: 모든 날짜×슬롯×역할 count 총합. 클라 calculateTotalPositionsFromSchedule 동치(빈 role 스킵·음수 0).';
REVOKE ALL ON FUNCTION public._total_positions_from_schedule(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._total_positions_from_schedule(jsonb) TO authenticated, service_role;

-- 2) BEFORE 트리거: total 재계산 + capacity 전이 단일 지점
CREATE OR REPLACE FUNCTION public.fn_recalc_total_and_capacity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'container'::posting_status THEN
    NEW.total_positions := 0;
    RETURN NEW;  -- filled 는 chk_container_no_filled CHECK + seat 트리거 SKIP 이 보장
  END IF;

  IF TG_OP = 'INSERT' OR NEW.schedule IS DISTINCT FROM OLD.schedule THEN
    NEW.total_positions := public._total_positions_from_schedule(NEW.schedule);
  END IF;

  -- capacity_full <-> active 전이 (다른 상태는 불변; closed 재개는 RPC 소관)
  IF NEW.status = 'active'::posting_status
     AND NEW.total_positions > 0
     AND NEW.filled_positions >= NEW.total_positions THEN
    NEW.status := 'capacity_full'::posting_status;
  ELSIF NEW.status = 'capacity_full'::posting_status
     AND NEW.filled_positions < NEW.total_positions THEN
    NEW.status := 'active'::posting_status;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tr_job_postings_recalc_capacity ON public.job_postings;
CREATE TRIGGER tr_job_postings_recalc_capacity
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION public.fn_recalc_total_and_capacity();

-- 3) work_logs 좌석 델타 트리거 (filled 만 담당 — 전이는 2 가 자동 수행)
CREATE OR REPLACE FUNCTION public.fn_sync_filled_positions_seat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_delta int := 0;
  v_job_posting_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_job_posting_id := NEW.job_posting_id;
    IF NEW.status::text NOT IN ('cancelled', 'no_show') THEN v_delta := 1; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_job_posting_id := OLD.job_posting_id;
    IF OLD.status::text NOT IN ('cancelled', 'no_show') THEN v_delta := -1; END IF;
  ELSE  -- UPDATE OF status
    v_job_posting_id := NEW.job_posting_id;
    v_delta := (CASE WHEN NEW.status::text NOT IN ('cancelled','no_show') THEN 1 ELSE 0 END)
             - (CASE WHEN OLD.status::text NOT IN ('cancelled','no_show') THEN 1 ELSE 0 END);
  END IF;

  IF v_delta = 0 OR v_job_posting_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.job_postings SET
    filled_positions = GREATEST(0, filled_positions + v_delta),
    stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{filledPositions}',
      to_jsonb(GREATEST(0, COALESCE((stats->>'filledPositions')::int, 0) + v_delta))),
    updated_at = now()
  WHERE id = v_job_posting_id
    AND status <> 'container'::posting_status;

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_sync_filled_positions_seat() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS tr_work_logs_seat_filled ON public.work_logs;
CREATE TRIGGER tr_work_logs_seat_filled
  AFTER INSERT OR DELETE OR UPDATE OF status ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_filled_positions_seat();

-- 4) fn_update_job_posting_stats: filled/전이 제거, 사람 지표 4종만 유지
--    (baseline :2717-2818 원문에서 아래 diff 적용)
--    삭제: v_filled_statuses 선언, v_old_filled/v_new_filled/v_filled_delta 선언·계산 3블록,
--          filled_positions SET 절, '{filledPositions}' jsonb_set 절, M2 전이 UPDATE 블록 전체
--    수정: 얼리리턴 조건에서 `AND v_filled_delta = 0` 제거
CREATE OR REPLACE FUNCTION public.fn_update_job_posting_stats() ...
-- (재작성 전문은 baseline 을 열어 위 diff 를 적용해 작성 — 함수 시그니처·트리거 등록 불변)

-- 5) add_direct_staff: 사람단위 게이트 제거 (baseline :638-792 원문에서)
--    삭제: v_already 선언·카운트 SELECT(:725-729), IF v_already = 0 ... END IF 블록 전체(:766-784)
--    유지: 슬롯 정원가드·DUPLICATE_ASSIGNMENT 가드·work_logs INSERT 루프·반환
CREATE OR REPLACE FUNCTION public.add_direct_staff(...) ...
COMMENT ON FUNCTION public.add_direct_staff(uuid, uuid, jsonb) IS
  '지원서 없이 스태프(work_logs) 직접 추가. 정원가드 유지. filled 는 seat 트리거가 좌석 단위 자동 반영(컨테이너 SKIP).';

-- 6) remove_direct_staff: 사람단위 -1 제거 (baseline :8603-8683 원문에서)
--    삭제: filled_positions -1 UPDATE 블록(:8652-8661)과 IF v_remaining = 0 게이트
--          (v_remaining 계산 자체는 반환값 staffRemoved 용으로 유지)
--    교체: 재개 UPDATE(:8663-8674)를 closed 분기만 남김 —
UPDATE job_postings SET status = 'active'::posting_status, updated_at = v_now
WHERE id = v_wl.job_posting_id
  AND filled_positions < total_positions
  AND status = 'closed'
  AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date');
--    (capacity_full → active 는 DELETE 시 seat 트리거 → BEFORE 트리거가 자동)

-- 7) cancel_application_atomically: DELETE-먼저 재배열 (baseline :997-1114 원문에서)
--    기존 :1097-1109 블록을 아래 순서로 교체:
  SELECT COUNT(*)::int INTO v_assignment_count FROM jsonb_array_elements(v_active_confirmation_entry->'assignments') a
  CROSS JOIN LATERAL jsonb_array_elements((a->>'dates')::jsonb) d;
  -- 좌석 감소를 먼저 반영(트리거 발화) — 이후 재개 판정·반환값이 최신 filled 를 본다
  DELETE FROM work_logs WHERE application_id = p_application_id AND status = 'scheduled';
  GET DIAGNOSTICS v_deleted_work_log_count = ROW_COUNT;
  -- capacity_full → active 는 트리거 자동. closed(비만료) 재개만 명시 처리.
  UPDATE job_postings SET status = 'active'::posting_status, updated_at = v_now_ts
  WHERE id = v_job_posting.id
    AND filled_positions < total_positions
    AND status = 'closed'
    AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date');
  SELECT filled_positions INTO v_new_filled FROM job_postings WHERE id = v_job_posting.id;

-- 8) 백필 (트리거 설치 후 같은 트랜잭션): 컨테이너 제외 전 공고 재계산
UPDATE public.job_postings jp SET
  total_positions = public._total_positions_from_schedule(jp.schedule),
  filled_positions = COALESCE(w.cnt, 0),
  stats = jsonb_set(COALESCE(jp.stats, '{}'::jsonb), '{filledPositions}', to_jsonb(COALESCE(w.cnt, 0))),
  updated_at = now()
FROM public.job_postings p
LEFT JOIN (
  SELECT job_posting_id, COUNT(*)::int AS cnt
  FROM public.work_logs
  WHERE status::text NOT IN ('cancelled', 'no_show')
  GROUP BY job_posting_id
) w ON w.job_posting_id = p.id
WHERE jp.id = p.id
  AND jp.status <> 'container'::posting_status;
-- (BEFORE 트리거가 이 UPDATE 에서 capacity_full/active 를 자동 재평가)

-- 9) COMMENT 갱신 (person basis → seat basis)
COMMENT ON FUNCTION public.confirm_application(uuid, uuid, jsonb, jsonb, jsonb, text, boolean, jsonb) IS
  '지원서 확정 RPC. work_logs=flat 전개, filled 는 seat 트리거가 좌석 단위(+N) 자동 반영. 슬롯 정원가드 유지.';
COMMENT ON FUNCTION public.cancel_application_atomically(uuid, text, uuid, text, text) IS
  '지원 취소 원자 RPC. work_logs DELETE → seat 트리거 좌석 감소 → 재개판정·반환 순(재배열). closed(비만료) 재개만 RPC 소관.';
```

주의 3가지: ① 4·5·6·7의 `...` 부분은 **반드시 baseline에서 함수 전문을 복사해 diff를 적용한 완전한 본문**으로 작성(placeholder로 두면 마이그 실패) ② confirm_application의 capacity=0 가드 우회 지점(스펙 리스크)에 `RAISE LOG 'capacity=0 match: posting=% date=% slot=% role=%'` 관측 한 줄을 v_capacity=0 케이스에 추가 ③ Step 1에서 발견된 baseline 이후 filled 경로가 있으면 여기서 함께 재작성.

- [ ] **Step 5: GREEN 실측 — 로컬 reset + pgTAP 전건 통과**

```bash
cd uniqn-mobile && npm run db:reset 2>&1 | tail -5
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/seat_basis_filled_positions.test.sql 2>&1 | tail -15
```

기대: `9/9 ok`(plan 수는 실제 작성 수에 맞춤). 실패 시 마이그 수정 → reset → 재실행(테스트를 약화시키지 말 것).

- [ ] **Step 6: 기존 pgTAP 회귀 확인**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/posting_confirm_cancel_integrity.test.sql 2>&1 | tail -5
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/capacity_full_transition.test.sql 2>&1 | tail -5
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/cancel_application_atomically.test.sql 2>&1 | tail -5
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/tests/weekly_grid_container_staff_softtarget.test.sql 2>&1 | tail -5
```

person basis를 기대하는 단언이 있으면 좌석 기준으로 **기대값을 갱신**(예: capacity_full_transition이 "1명 확정=full"을 기대하면 좌석 수 기준으로 픽스처/기대 수정). `person_basis_filled_positions.test.sql`은 삭제:

```bash
git rm uniqn-mobile/supabase/tests/person_basis_filled_positions.test.sql
```

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/supabase
git commit -m "feat(db): filled/total 좌석 기준 전환 — work_logs seat 트리거·BEFORE 전이 단일화·RPC 3종 재작성·백필 (pgTAP 레드-그린)"
```

---

### Task 5: E2E 정렬 + 전체 품질 게이트

**Files:**

- Modify: `uniqn-mobile/e2e/tests/p2-standard/employer-posting-capacity-recovery.spec.ts`

**Interfaces:**

- Consumes: Task 1~4 전체.
- Produces: 최종 green 상태(quality + jest 전체 + pgTAP).

- [ ] **Step 1: E2E 기대 정렬**

`employer-posting-capacity-recovery.spec.ts`를 읽고 사람 기준 기대(예: "1명 확정 → capacity_full")를 좌석 기준으로 수정 — 공고 픽스처의 총 좌석 수만큼 확정해야 full이 되도록 시나리오 갱신. 시나리오 자체가 단일날짜·단일역할이면 좌석=사람이라 수정 불요할 수 있음 — 그 경우 "좌석 기준에서도 동일 기대"라는 주석만 추가.

- [ ] **Step 2: 전체 jest**

```bash
cd uniqn-mobile && npx jest 2>&1 | tail -8
```

기대: 전 스위트 PASS. FAIL은 좌석 기준 기대 정렬로 해결(구현 되돌리기 금지). 특히 `__tests__/integration/applicationCapacityRace.test.ts`·`slotCapacity.fixed.test.ts`·`workflow.test.ts` 주의.

- [ ] **Step 3: 품질 게이트**

```bash
cd uniqn-mobile && npm run quality 2>&1 | tail -10
```

기대: type-check·lint·format 모두 exit 0.

- [ ] **Step 4: 최종 커밋**

```bash
git add -A uniqn-mobile/e2e uniqn-mobile/src
git commit -m "test(e2e): 정원마감 회복 시나리오 좌석 기준 정렬 + 전체 스위트 green"
```

- [ ] **Step 5: 완료 보고**

보고에 포함: jest 통과 수치, pgTAP ok 수치, quality exit code, **prod 미적용**(마이그는 로컬 검증만 — prod 적용·OTA는 사용자 게이트) 명시.

---

## 계획 자기검토 결과

- 스펙 §3.1(클라)=Task 1·2·3, §3.2(DB)=Task 4, §3.3(백필)=Task 4 Step 4-8, §5(테스트)=Task 2·4·5, 리스크 C1(재배열)=Task 4 Step 4-7, C2(가드 관측)=Task 4 Step 4 주의②, §3.2.6=Task 4 Step 4-2. 갭 없음.
- 30초 지연 무효화·사람수 표시는 스펙 §6 범위 밖 그대로 제외.
- 타입/함수명 교차 확인: `PostingDateSectionDayModel`(Task 2 정의→Task 3 소비), `_total_positions_from_schedule`(Task 4 정의, Task 1과 동치 규칙 명시) 일치.
