# 스케줄 스키마 통일 (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `job_postings.schedule` 의 역할/정원 substructure 를 fixed/dated 두 모양에서 단일 경로 `requirements[].timeSlots[].roles[]` 로 통일하고, 모든 fixed 분기(타입/zod/직렬화/생성/표시/stats/정원검증)를 제거하되 사용자 가시 동작은 SP1 전후 동치로 유지한다.

**Architecture:** `kind: 'fixed' | 'dated'` 판별자는 유지(반복근무 vs 날짜지정의 진짜 다른 의미). 통일 대상은 역할이 사는 구조 하나뿐 — fixed 는 `requirements` 1개, `date: null`, `timeSlots` 1개(합성 슬롯)에 역할을 담는다. fixed 메타(`daysPerWeek`/`startTime`/`isStartTimeNegotiable`)는 fixed variant 에 그대로. dead counter(`filled` 필드)는 SP1 에서 제거하지 않고 통일 구조 안에서 무해하게 유지한다(제거는 SP3).

**Tech Stack:** TypeScript strict, Zod discriminated union, Jest, Supabase(PostgreSQL JSONB), MCP `apply_migration`.

---

## File Structure

각 Task 가 만지는 파일과 책임. 모든 경로는 워크트리 루트(`uniqn-mobile\`) 기준 상대표기. 코드 내 import 는 `@/` alias 사용.

| 파일                                                                          | 책임                                                                                                                                      | Task |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `src\types\jobPosting.ts`                                                     | `PostingDateRequirement.date` nullable, `PostingFixedSchedule.requirements` 도입 / `roleRequirements`·`PostingFixedRoleRequirement` 제거  | 1    |
| `src\schemas\jobPosting.schema.ts`                                            | `postingDateRequirementSchema.date` nullable, fixed variant `requirements` + `.refine()` 불변식, `postingFixedRoleRequirementSchema` 제거 | 1    |
| `src\types\jobPostingDraft.ts`                                                | `JobPostingDraftFixedSchedule` 을 `requirements` 기반으로 전환                                                                            | 3    |
| `src\domains\job-posting\serialization.ts`                                    | `normalizeSchedule`/`deserializeJobPostingDocument` fixed → 합성 슬롯 + 역호환 읽기                                                       | 2    |
| `src\utils\job-posting\draftAdapter.ts`                                       | `buildFixedDraft`/`buildFixedFormRoles`/`buildFixedDraftFromPosting`/`draftToCreateJobPostingInput` fixed 분기 → 합성 슬롯                | 3    |
| `src\domains\job-posting\stats.ts`                                            | `calculateFilledPositionsFromSchedule`/`calculateTotalPositionsFromSchedule` fixed 분기 제거 → 단일 순회                                  | 4    |
| `src\domains\job-posting\core.ts`                                             | `getPostingRoleStats`/`getPostingLegacyTimeSlot`/`getPostingRequiredRolesWithCount` fixed 분기 단일 순회로 정리                           | 5    |
| `src\domains\job-posting\selectors.ts`                                        | `selectPostingScheduleDisplay.fixed.roles` 소스를 합성 슬롯에서 읽도록 정렬 (kind 판별 유지)                                              | 5    |
| `src\components\jobs\shared\postingSurfaceModel.ts`                           | `buildPostingScheduleModel` fixed 분기 역할 소스 변경(`fixed.roles`) — 유지하되 정합                                                      | 6    |
| `src\utils\normalizers\scheduleNormalizer.ts`                                 | `normalizeFixedSchedule` 역할 소스를 합성 슬롯으로                                                                                        | 5    |
| `src\utils\normalizers\roleNormalizer.ts`                                     | `normalizeJobRoles` fixed 분기 역할 소스를 합성 슬롯으로                                                                                  | 5    |
| `src\domains\application\DateRequirementUpdater.ts`                           | `updatePostingScheduleFilled` fixed 분기 역할 소스를 합성 슬롯으로 (dead counter 유지, SP3 까지)                                          | 5    |
| `src\domains\application\slotCapacity.ts`                                     | `buildPostingSlotCapacityMap`/`validateAssignmentSlotCapacity` 의 `kind !== 'dated'` 가드 완화 — 합성 슬롯(`date:null`) 키 지원           | 7    |
| `src\repositories\supabase\ApplicationRepositoryTransactions.ts`              | `validateConfirmCapacity` fixed 분기 제거 → 전 경로 `validateAssignmentSlotCapacity`                                                      | 7    |
| `src\types\jobTemplate.ts`                                                    | 템플릿 fixed 스케줄 직렬화/역직렬화 → 합성 슬롯                                                                                           | 3    |
| `supabase\migrations\20260525164354_unify_fixed_schedule_to_requirements.sql` | 멱등 마이그레이션: `roleRequirements` → `requirements` UPDATE + 역변환(down)                                                              | 8    |

> **불변식 (모든 Task 공통)**: fixed schedule 은 `requirements.length === 1 && requirements[0].date === null && requirements[0].timeSlots.length === 1`. 합성 슬롯의 `startTime` 은 fixed `schedule.startTime` 을 그대로 복사, `isTimeToBeAnnounced: false`. 역할 배열은 기존 `roleRequirements` 의 `{role, customRole?, count, filled?}` 를 `PostingSlotRoleRequirement` 로 그대로 옮긴다(추가/소실 없음).

---

## Task 0: `requirement.date` non-null 가정 + `roleRequirements` 사용처 점검 (코드 변경 없음)

이 Task 는 grep 사전조사 결과를 기록만 한다. 발견사항은 아래에 인라인으로 문서화되었고, 후속 Task 가 이를 커버한다.

- [ ] (점검 완료 — 발견사항 아래 기록) 코드 변경/커밋 없음. 본 섹션을 읽고 Task 1~9 의 영향 범위를 숙지한다.

### 발견사항 A — `roleRequirements` (fixed 역할 소스) 를 읽는 비테스트 코드 (전수)

| 파일:라인                                                                | 패턴                                                                                                | 커버 Task |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------- |
| `src\types\jobPosting.ts:117`                                            | `PostingFixedSchedule.roleRequirements?` 정의                                                       | 1 (제거)  |
| `src\types\jobPostingDraft.ts:19`                                        | `JobPostingDraftFixedSchedule.roleRequirements`                                                     | 3         |
| `src\schemas\jobPosting.schema.ts:232`                                   | fixed variant zod `roleRequirements`                                                                | 1         |
| `src\domains\job-posting\serialization.ts:158,334`                       | normalize/deserialize fixed write                                                                   | 2         |
| `src\domains\job-posting\stats.ts:15,49`                                 | filled/total fixed reduce                                                                           | 4         |
| `src\domains\job-posting\core.ts:114,286`                                | `getPostingRoleStats`/`getPostingRequiredRolesWithCount`                                            | 5         |
| `src\utils\job-posting\draftAdapter.ts:285,346,485,572`                  | `buildFixedDraft`/`buildFixedFormRoles`/`draftToCreateJobPostingInput`/`buildFixedDraftFromPosting` | 3         |
| `src\utils\normalizers\scheduleNormalizer.ts:59`                         | `normalizeFixedSchedule`                                                                            | 5         |
| `src\utils\normalizers\roleNormalizer.ts:47`                             | `normalizeJobRoles` fixed                                                                           | 5         |
| `src\domains\application\DateRequirementUpdater.ts:157,183`              | `updatePostingScheduleFilled` fixed (filled 증감, dead counter 유지)                                | 5         |
| `src\repositories\supabase\ApplicationRepositoryTransactions.ts:327,334` | `validateConfirmCapacity` fixed inline cast                                                         | 7         |
| `src\types\jobTemplate.ts:124,164`                                       | 템플릿 fixed 직렬화/역직렬화                                                                        | 3         |

### 발견사항 B — `requirement.date` / `.date` 를 **non-null(string)** 으로 가정하는 사용처

핵심 결론: **위험한 사용처는 없다**. `requirement.date` 를 읽는 코드는 모두 `schedule.kind === 'dated'` 또는 `posting.schedule.kind !== 'dated' → return` 가드 뒤에 있어, fixed 의 `date: null` 에 도달하지 않는다. 통일 후에도 fixed 의 합성 requirement(`date:null`)는 dated 순회 코드로 새지 않는다.

| 파일:라인                                                                                                                                       | 컨텍스트                                                                                     | null 도달 가능?                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------- |
| `src\domains\job-posting\serialization.ts:128,146,177`                                                                                          | `normalizeDatedRequirements` (dated 전용, `.filter(r => r.date)`)                            | No — dated 만                                                                                        |
| `src\domains\job-posting\core.ts:194,220`                                                                                                       | `getPostingDateRequirements`/`createPostingLegacyDateRequirements` (`kind !== 'dated' → []`) | No                                                                                                   |
| `src\domains\job-posting\projections.ts:123`                                                                                                    | `card.dateRequirements.find(r => r.date === date)` (CardDateRequirement, dated 파생)         | No                                                                                                   |
| `src\components\jobs\shared\postingSurfaceModel.ts:191,192,195`                                                                                 | dated 분기 내부(`source.workflow.isFixed` 먼저 return)                                       | No                                                                                                   |
| `src\utils\normalizers\roleNormalizer.ts:90`                                                                                                    | `getRolesForDateAndTime` (`kind !== 'dated' → []`)                                           | No                                                                                                   |
| `src\domains\application\DateRequirementUpdater.ts:210`                                                                                         | `updatePostingScheduleFilled` dated 분기(fixed 분기 먼저 return)                             | No                                                                                                   |
| `src\domains\application\slotCapacity.ts:54,56`                                                                                                 | `buildPostingSlotCapacityMap` (현재 `kind !== 'dated' → 빈 맵`)                              | Task 7 에서 의도적으로 fixed 포함하도록 변경 → `date:null` 키는 빈 문자열로 정규화(아래 Task 7 참조) |
| `src\utils\assignment\selectionUtils.ts:108,111`                                                                                                | `toDateString(requirement.date)` — `DateSpecificRequirement.date`(폼 타입, `string           | Date`) 이며 `PostingDateRequirement` 아님                                                            | N/A (별도 타입) |
| `src\components\jobs\DateRequirementDisplay.tsx`, `GroupedDateRequirementDisplay.tsx`, `DateRequirementsSection.tsx`, `DateRequirementCard.tsx` | `DateSpecificRequirement`(폼 타입) `.date`                                                   | N/A (별도 타입)                                                                                      |
| `src\utils\scheduleGrouping.ts`, `useSchedules.ts`, `WeeklyStaffWidget.tsx` 등 `schedule.date`/`wl.date`                                        | WorkLog/이벤트의 `date` (스케줄 substructure 아님)                                           | N/A                                                                                                  |

### 발견사항 C — 스코프 경계 확인

`src\types\jobPosting.ts` 의 `SupportedReleasePostingSchedule = PostingDatedSchedule`, `isSupportedReleasePosting`(jobPostingVisibility) 는 fixed 를 "미지원 릴리스 워크플로우" 로 차단한다. SP1 은 이 게이트를 **건드리지 않는다**(fixed 공고 가시성 정책 = SP 범위 밖). 따라서 `selectPostingApplicationEligibility` 의 `unsupported_workflow` 분기와 `selectionMode: 'fixed_role'` 은 그대로 유지한다. SP1 은 fixed 의 내부 형태만 바꾼다.

---

## Task 1: 타입 / zod — date nullable + fixed requirements 도입

**Files:**

- Modify: `src\types\jobPosting.ts` (`PostingDateRequirement` 92-96, `PostingFixedRoleRequirement` 98-103, `PostingFixedSchedule` 112-118)
- Modify: `src\schemas\jobPosting.schema.ts` (`postingDateRequirementSchema` 200-206, `postingFixedRoleRequirementSchema` 208-215, `postingScheduleSchema` 217-235)
- Test: `src\schemas\__tests__\jobPosting.schema.test.ts` (fixed 케이스 갱신)

- [ ] **1.1 실패 테스트 작성** — `src\schemas\__tests__\jobPosting.schema.test.ts` 에 fixed 통일 스키마 검증 테스트 추가:

```ts
describe('postingScheduleSchema fixed (통일 구조)', () => {
  const validFixed = {
    kind: 'fixed' as const,
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    requirements: [
      {
        date: null,
        timeSlots: [
          {
            startTime: '19:00',
            isTimeToBeAnnounced: false,
            roles: [{ role: 'dealer', count: 3, filled: 1 }],
          },
        ],
      },
    ],
  };

  it('accepts fixed schedule with requirements[].timeSlots[].roles and date:null', () => {
    const result = createJobPostingSchema.safeParse({
      postingType: 'fixed',
      title: 'Fixed posting',
      location: { name: 'Seoul' },
      schedule: validFixed,
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects fixed schedule when requirements.length !== 1', () => {
    const result = createJobPostingSchema.safeParse({
      postingType: 'fixed',
      title: 'Fixed posting',
      location: { name: 'Seoul' },
      schedule: {
        ...validFixed,
        requirements: [...validFixed.requirements, ...validFixed.requirements],
      },
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects fixed schedule when requirements[0].date is not null', () => {
    const result = createJobPostingSchema.safeParse({
      postingType: 'fixed',
      title: 'Fixed posting',
      location: { name: 'Seoul' },
      schedule: {
        ...validFixed,
        requirements: [{ ...validFixed.requirements[0], date: '2025-05-01' }],
      },
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects legacy roleRequirements key (strict)', () => {
    const result = createJobPostingSchema.safeParse({
      postingType: 'fixed',
      title: 'Fixed posting',
      location: { name: 'Seoul' },
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        roleRequirements: [{ role: 'dealer', count: 3 }],
      },
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **1.2 실패 확인** — `npx jest src/schemas/__tests__/jobPosting.schema.test.ts -t "postingScheduleSchema fixed"` → **Expected: FAIL** (현재 fixed variant 는 `roleRequirements` 만 받고 `requirements` 는 strict 위반; date nullable 미지원).

- [ ] **1.3 타입 수정** — `src\types\jobPosting.ts`:
  - `PostingDateRequirement.date` 를 `string` → `string | null`:

```ts
export interface PostingDateRequirement {
  date: string | null;
  timeSlots: PostingTimeSlot[];
  isGrouped?: boolean;
}
```

- `PostingFixedRoleRequirement` 인터페이스(98-103) **삭제**.
- `PostingFixedSchedule`(112-118) 를 다음으로 교체:

```ts
export interface PostingFixedSchedule {
  kind: 'fixed';
  daysPerWeek?: number;
  startTime?: string;
  isStartTimeNegotiable?: boolean;
  requirements: PostingDateRequirement[];
}
```

- `serialization.ts` import 가 `PostingFixedSchedule` 만 쓰는지 확인(타입 export 제거 영향). `PostingFixedRoleRequirement` 를 import 하던 `jobPostingDraft.ts`/`roleNormalizer.ts`/`scheduleNormalizer.ts` 는 후속 Task 에서 교체되므로 일시적 컴파일 에러는 Task 3/5 에서 해소. (이 Task 의 PASS 기준은 schema test 통과 + schema/types 파일 자체 컴파일.)

- [ ] **1.4 zod 수정** — `src\schemas\jobPosting.schema.ts`:
  - `postingDateRequirementSchema`(200-206) `date` 를 nullable 로:

```ts
const postingDateRequirementSchema = z
  .object({
    date: z.string().nullable(),
    timeSlots: z.array(postingTimeSlotSchema),
    isGrouped: z.boolean().optional(),
  })
  .strict();
```

- `postingFixedRoleRequirementSchema`(208-215) **삭제**.
- fixed variant(226-234) 를 `requirements` + `.refine()` 로 교체:

```ts
  z
    .object({
      kind: z.literal('fixed'),
      daysPerWeek: z.number().optional(),
      startTime: z.string().optional(),
      isStartTimeNegotiable: z.boolean().optional(),
      requirements: z.array(postingDateRequirementSchema),
    })
    .strict()
    .refine(
      (schedule) =>
        schedule.requirements.length === 1 &&
        schedule.requirements[0].date === null &&
        schedule.requirements[0].timeSlots.length === 1,
      { message: 'fixed schedule must have exactly one requirement (date:null) with one timeSlot' }
    ),
```

> 주의: `discriminatedUnion` 멤버에 `.refine()` 를 직접 붙이면 zod 가 거부할 수 있다. 빌드 시 `z.discriminatedUnion('kind', [...])` 가 ZodEffects 멤버를 허용하지 않으면, fixed 불변식을 `postingScheduleSchema` 바깥 `.superRefine` 또는 union 뒤 `.superRefine((data, ctx) => { if (data.kind === 'fixed') { ... } })` 로 옮긴다. **구현 시 먼저 `.refine` 멤버 형태로 시도하고, zod 에러가 나면 union 뒤 superRefine 으로 전환**(둘 다 1.1 테스트를 통과시킨다).

- [ ] **1.5 통과 확인** — `npx jest src/schemas/__tests__/jobPosting.schema.test.ts -t "postingScheduleSchema fixed"` → **Expected: PASS** (4 케이스 모두). 기존 schema test 의 fixed 케이스가 깨지면 새 구조로 갱신한다.

- [ ] **1.6 커밋** — `git add src/types/jobPosting.ts src/schemas/jobPosting.schema.ts src/schemas/__tests__/jobPosting.schema.test.ts && git commit -m "refactor(jobPosting): fixed 스케줄 타입/zod 를 requirements 단일 구조로 통일"`

---

## Task 2: 직렬화 — normalize/deserialize fixed → 합성 슬롯 + 역호환 읽기

**Files:**

- Modify: `src\domains\job-posting\serialization.ts` (`normalizeSchedule` 149-180, `deserializeJobPostingDocument` schedule 분기 323-366)
- Test: `src\domains\job-posting\__tests__\serialization.fixed.test.ts` (신규)

- [ ] **2.1 실패 테스트 작성** — 신규 `src\domains\job-posting\__tests__\serialization.fixed.test.ts`:

```ts
import {
  serializeJobPostingV3,
  deserializeJobPostingDocument,
} from '@/domains/job-posting/serialization';
import type { CreateJobPostingInput, JobPostingDocumentV3 } from '@/types/jobPosting';

const baseInput: Omit<CreateJobPostingInput, 'schedule'> = {
  postingType: 'fixed',
  title: 'Fixed posting',
  location: { name: 'Seoul' },
  roleCatalog: [{ role: 'dealer' }, { role: 'other', customRole: 'VIP Host' }],
  compensation: { mode: 'shared' },
  questions: { items: [] },
};

describe('serialization fixed (통일 구조)', () => {
  it('normalizeSchedule(fixed) produces requirements[0] with date:null and synthetic slot', () => {
    const doc = serializeJobPostingV3(
      {
        ...baseInput,
        schedule: {
          kind: 'fixed',
          daysPerWeek: 5,
          startTime: '19:00',
          isStartTimeNegotiable: false,
          requirements: [
            {
              date: null,
              timeSlots: [
                {
                  startTime: '19:00',
                  isTimeToBeAnnounced: false,
                  roles: [
                    { role: 'dealer', count: 3 },
                    { role: 'other', customRole: 'VIP Host', count: 2 },
                  ],
                },
              ],
            },
          ],
        },
      },
      { ownerId: 'owner-1', workspaceId: '00000000-0000-0000-0000-000000000000' }
    );

    expect(doc.schedule.kind).toBe('fixed');
    const fixed = doc.schedule as Extract<typeof doc.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements).toHaveLength(1);
    expect(fixed.requirements[0].date).toBeNull();
    expect(fixed.requirements[0].timeSlots).toHaveLength(1);
    expect(fixed.requirements[0].timeSlots[0].startTime).toBe('19:00');
    expect(fixed.requirements[0].timeSlots[0].roles).toHaveLength(2);
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
    expect(doc.totalPositions).toBe(5);
  });

  it('deserialize reads legacy roleRequirements docs into synthetic requirements (역호환)', () => {
    const legacyDoc = {
      id: 'job-legacy',
      schemaVersion: 3,
      title: 'Legacy fixed',
      status: 'active',
      ownerId: 'owner-1',
      postingType: 'fixed',
      workDate: '',
      totalPositions: 3,
      filledPositions: 0,
      location: { name: 'Seoul' },
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        startTime: '19:00',
        roleRequirements: [{ role: 'dealer', count: 3, filled: 0 }],
      },
      roleCatalog: [{ role: 'dealer' }],
      compensation: { mode: 'shared' },
      questions: { items: [] },
    } as unknown as JobPostingDocumentV3;

    const posting = deserializeJobPostingDocument(legacyDoc);
    expect(posting.schedule.kind).toBe('fixed');
    const fixed = posting.schedule as Extract<typeof posting.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements).toHaveLength(1);
    expect(fixed.requirements[0].date).toBeNull();
    expect(fixed.requirements[0].timeSlots[0].roles[0]).toMatchObject({ role: 'dealer', count: 3 });
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
  });
});
```

- [ ] **2.2 실패 확인** — `npx jest src/domains/job-posting/__tests__/serialization.fixed.test.ts` → **Expected: FAIL** (현재 `normalizeSchedule` 은 `requirements` 가 아닌 `roleRequirements` 를 출력; deserialize 도 `roleRequirements` 유지).

- [ ] **2.3 구현 — `normalizeSchedule` fixed 분기(149-167) 교체** in `src\domains\job-posting\serialization.ts`. 먼저 공통 합성 헬퍼를 파일 상단(`normalizeDatedRequirements` 위)에 추가:

```ts
function buildFixedSyntheticRequirement(
  schedule: Extract<CreateJobPostingInput['schedule'], { kind: 'fixed' }>
): PostingDateRequirement {
  // 역호환: 새 구조(requirements)와 레거시(roleRequirements) 둘 다 합성 슬롯으로 흡수
  const legacy = schedule as unknown as {
    roleRequirements?: { role?: string; customRole?: string; count: number; filled?: number }[];
    requirements?: PostingDateRequirement[];
  };
  const existingRoles = legacy.requirements?.[0]?.timeSlots?.[0]?.roles;
  const sourceRoles = existingRoles ?? legacy.roleRequirements ?? [];

  return {
    date: null,
    timeSlots: [
      {
        ...(schedule.startTime ? { startTime: schedule.startTime } : {}),
        isTimeToBeAnnounced: false,
        roles: sourceRoles.map((role) => ({
          ...(role.id ? { id: role.id } : {}),
          ...(role.role ? { role: role.role } : {}),
          ...(role.customRole ? { customRole: role.customRole } : {}),
          count: role.count,
          ...(role.filled !== undefined ? { filled: role.filled } : {}),
        })),
      },
    ],
  };
}
```

> 위 `role.id` 참조 대비 `sourceRoles` 타입에 `id?: string` 추가: 위 헬퍼의 `sourceRoles` 요소 타입을 `{ id?: string; role?: string; customRole?: string; count: number; filled?: number }` 로 명시한다.

그리고 fixed 분기를:

```ts
function normalizeSchedule(schedule: CreateJobPostingInput['schedule']): PostingSchedule {
  if (schedule.kind === 'fixed') {
    const fixedSchedule: PostingFixedSchedule = {
      kind: 'fixed',
      ...(schedule.daysPerWeek !== undefined ? { daysPerWeek: schedule.daysPerWeek } : {}),
      ...(schedule.startTime ? { startTime: schedule.startTime } : {}),
      ...(schedule.isStartTimeNegotiable !== undefined
        ? { isStartTimeNegotiable: schedule.isStartTimeNegotiable }
        : {}),
      requirements: [buildFixedSyntheticRequirement(schedule)],
    };

    return fixedSchedule;
  }
  // ... dated 분기 그대로
```

- [ ] **2.4 구현 — `deserializeJobPostingDocument` fixed 분기(323-340) 교체**. `document.schedule.kind === 'fixed'` 케이스를 합성 requirement 로:

```ts
const schedule =
  document.schedule.kind === 'fixed'
    ? ({
        kind: 'fixed' as const,
        ...(document.schedule.daysPerWeek !== undefined
          ? { daysPerWeek: document.schedule.daysPerWeek }
          : {}),
        ...(document.schedule.startTime ? { startTime: document.schedule.startTime } : {}),
        ...(document.schedule.isStartTimeNegotiable !== undefined
          ? { isStartTimeNegotiable: document.schedule.isStartTimeNegotiable }
          : {}),
        requirements: [buildFixedSyntheticRequirement(document.schedule)],
      } satisfies PostingFixedSchedule)
    : {
        // ... dated 분기 그대로 (단 requirement.date 는 그대로 유지)
      };
```

> `buildFixedSyntheticRequirement` 는 새 구조(`requirements`)와 레거시(`roleRequirements`) 둘 다 흡수하므로 deserialize 의 역호환(spec §4.2)이 동시에 충족된다. `document.schedule` 의 타입은 빌드 후 `requirements` 를 갖지만 레거시 row 는 `roleRequirements` 만 가지므로 헬퍼 내부 캐스트로 안전 처리.

- [ ] **2.5 통과 확인** — `npx jest src/domains/job-posting/__tests__/serialization.fixed.test.ts` → **Expected: PASS** (2 케이스). 추가로 `npx jest src/utils/job-posting/__tests__/submission.test.ts` 실행해 회귀 없는지 확인(있으면 fixed 케이스 새 구조로 갱신, Task 3 에서 함께 처리 가능).

- [ ] **2.6 커밋** — `git add src/domains/job-posting/serialization.ts src/domains/job-posting/__tests__/serialization.fixed.test.ts && git commit -m "refactor(jobPosting): fixed 직렬화/역직렬화를 합성 슬롯 + 역호환 읽기로 통일"`

---

## Task 3: 생성/수정 (draftAdapter + jobPostingDraft 타입 + jobTemplate)

**Files:**

- Modify: `src\types\jobPostingDraft.ts` (`JobPostingDraftFixedSchedule` 18-20)
- Modify: `src\utils\job-posting\draftAdapter.ts` (`buildFixedDraft` 275-295, `buildFixedFormRoles` 341-356, `draftToCreateJobPostingInput` fixed 분기 477-491, `buildFixedDraftFromPosting` 560-579)
- Modify: `src\types\jobTemplate.ts` (`extractTemplateData` fixed 120-128, `templateToDraft` fixed 160-167)
- Test: `src\utils\job-posting\__tests__\draftAdapter.test.ts` (fixed 케이스 갱신)

- [ ] **3.1 실패 테스트 작성** — `src\utils\job-posting\__tests__\draftAdapter.test.ts` 에 round-trip 테스트 추가(폼 → draft → CreateInput → 폼 역변환):

```ts
import {
  formDataToDraft,
  draftToFormData,
  draftToCreateJobPostingInput,
} from '@/utils/job-posting/draftAdapter';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';

describe('draftAdapter fixed (통일 구조)', () => {
  const fixedForm = {
    ...INITIAL_JOB_POSTING_FORM_DATA,
    postingType: 'fixed' as const,
    title: 'Fixed posting',
    location: { name: 'Seoul' },
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [
      { name: '딜러', count: 3, isCustom: false },
      { name: 'VIP Host', count: 2, isCustom: true },
    ],
  };

  it('buildFixedDraft stores roles in synthetic requirements[0].timeSlots[0].roles', () => {
    const draft = formDataToDraft(fixedForm);
    expect(draft.schedule.kind).toBe('fixed');
    const fixed = draft.schedule as Extract<typeof draft.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements).toHaveLength(1);
    expect(fixed.requirements[0].date).toBeNull();
    expect(fixed.requirements[0].timeSlots[0].roles.map((r) => r.count).sort()).toEqual([2, 3]);
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
  });

  it('draftToCreateJobPostingInput emits requirements (no roleRequirements key)', () => {
    const input = draftToCreateJobPostingInput(formDataToDraft(fixedForm));
    expect(input.schedule.kind).toBe('fixed');
    const fixed = input.schedule as Extract<typeof input.schedule, { kind: 'fixed' }>;
    expect(fixed.requirements[0].timeSlots[0].roles).toHaveLength(2);
    expect((fixed as { roleRequirements?: unknown }).roleRequirements).toBeUndefined();
  });

  it('round-trips fixed roles back to form (draft -> form)', () => {
    const form = draftToFormData(formDataToDraft(fixedForm));
    expect(form.roles.map((r) => r.count).sort()).toEqual([2, 3]);
    expect(form.daysPerWeek).toBe(5);
    expect(form.startTime).toBe('19:00');
  });
});
```

- [ ] **3.2 실패 확인** — `npx jest src/utils/job-posting/__tests__/draftAdapter.test.ts -t "draftAdapter fixed"` → **Expected: FAIL** (현재 `buildFixedDraft` 은 `roleRequirements` 출력, `JobPostingDraftFixedSchedule` 타입이 `requirements` 미보유).

- [ ] **3.3 구현 — draft 타입** `src\types\jobPostingDraft.ts` 18-20:

```ts
export type JobPostingDraftFixedSchedule = Extract<PostingSchedule, { kind: 'fixed' }>;
```

`PostingFixedRoleRequirement` import(line 6) 제거. `JobPostingDraftFixedSchedule` 가 더는 `roleRequirements` 를 추가하지 않으므로 `PostingSchedule` 의 fixed variant(= `{ kind, daysPerWeek?, startTime?, isStartTimeNegotiable?, requirements }`)를 그대로 쓴다.

- [ ] **3.4 구현 — `buildFixedDraft`(275-295)** in `draftAdapter.ts`. 공통 합성 헬퍼를 파일에 추가 후 사용:

```ts
function buildFixedSyntheticRequirement(roles: PostingSlotRoleRequirement[], startTime?: string) {
  return {
    date: null,
    timeSlots: [
      {
        ...(startTime ? { startTime } : {}),
        isTimeToBeAnnounced: false,
        roles,
      },
    ],
  };
}

function buildFixedDraft(
  formData: JobPostingFormData
): Extract<JobPostingDraft['schedule'], { kind: 'fixed' }> {
  const roles: PostingSlotRoleRequirement[] = (formData.roles ?? []).map((role) => {
    const catalogEntry = toCatalogEntry(role);
    return {
      role: catalogEntry.role,
      ...(catalogEntry.customRole ? { customRole: catalogEntry.customRole } : {}),
      count: role.count,
    };
  });

  return {
    kind: 'fixed',
    daysPerWeek: formData.daysPerWeek,
    ...(formData.startTime ? { startTime: formData.startTime } : {}),
    ...(formData.isStartTimeNegotiable !== undefined
      ? { isStartTimeNegotiable: formData.isStartTimeNegotiable }
      : {}),
    requirements: [buildFixedSyntheticRequirement(roles, formData.startTime)],
  };
}
```

- [ ] **3.5 구현 — `buildFixedFormRoles`(341-356)** — 합성 슬롯에서 역할을 읽도록:

```ts
function buildFixedFormRoles(draft: JobPostingDraft): FormRoleWithCount[] {
  if (draft.schedule.kind !== 'fixed') {
    return [];
  }

  const roles = draft.schedule.requirements[0]?.timeSlots[0]?.roles ?? [];
  return roles.map((requirement) => {
    const catalogEntry = draft.roleCatalog.find(
      (entry) => getRoleKey(entry) === getRoleKey(requirement)
    ) ?? {
      role: requirement.role ?? 'dealer',
      ...(requirement.customRole ? { customRole: requirement.customRole } : {}),
    };

    return toFormRole(catalogEntry, requirement.count);
  });
}
```

- [ ] **3.6 구현 — `draftToCreateJobPostingInput` fixed 분기(477-491)** — `requirements` 출력:

```ts
    schedule:
      draft.schedule.kind === 'fixed'
        ? {
            kind: 'fixed',
            daysPerWeek: draft.schedule.daysPerWeek,
            ...(draft.schedule.startTime ? { startTime: draft.schedule.startTime } : {}),
            ...(draft.schedule.isStartTimeNegotiable !== undefined
              ? { isStartTimeNegotiable: draft.schedule.isStartTimeNegotiable }
              : {}),
            requirements: draft.schedule.requirements.map((requirement) => ({
              date: null,
              timeSlots: requirement.timeSlots.map((slot) => ({
                ...(slot.startTime ? { startTime: slot.startTime } : {}),
                isTimeToBeAnnounced: false,
                roles: slot.roles.map((role) => ({
                  ...(role.id ? { id: role.id } : {}),
                  role: role.role ?? 'dealer',
                  ...(role.customRole ? { customRole: role.customRole } : {}),
                  count: role.count,
                  ...(role.filled !== undefined ? { filled: role.filled } : {}),
                })),
              })),
            })),
          }
        : {
            // ... dated 분기 그대로
          },
```

- [ ] **3.7 구현 — `buildFixedDraftFromPosting`(560-579)** — posting 의 fixed `requirements` 를 draft 로 그대로:

```ts
function buildFixedDraftFromPosting(
  posting: JobPosting
): Extract<JobPostingDraft['schedule'], { kind: 'fixed' }> {
  const fixedSchedule = posting.schedule.kind === 'fixed' ? posting.schedule : undefined;
  const roles = fixedSchedule?.requirements[0]?.timeSlots[0]?.roles ?? [];

  return {
    kind: 'fixed',
    daysPerWeek: fixedSchedule?.daysPerWeek,
    ...(fixedSchedule?.startTime ? { startTime: fixedSchedule.startTime } : {}),
    ...(fixedSchedule?.isStartTimeNegotiable !== undefined
      ? { isStartTimeNegotiable: fixedSchedule.isStartTimeNegotiable }
      : {}),
    requirements: [
      {
        date: null,
        timeSlots: [
          {
            ...(fixedSchedule?.startTime ? { startTime: fixedSchedule.startTime } : {}),
            isTimeToBeAnnounced: false,
            roles: roles.map((role) => ({
              ...(role.id ? { id: role.id } : {}),
              ...(role.role ? { role: role.role } : {}),
              ...(role.customRole ? { customRole: role.customRole } : {}),
              count: role.count,
              ...(role.filled !== undefined ? { filled: role.filled } : {}),
            })),
          },
        ],
      },
    ],
  };
}
```

- [ ] **3.8 구현 — `jobTemplate.ts`** `extractTemplateData`(120-128) 와 `templateToDraft`(160-167) 의 fixed 분기를 `requirements` 매핑으로 교체. `extractTemplateData`:

```ts
    schedule:
      draft.schedule.kind === 'fixed'
        ? {
            ...draft.schedule,
            requirements: draft.schedule.requirements.map((requirement) => ({
              date: null,
              timeSlots: requirement.timeSlots.map((slot) => ({ ...slot, roles: slot.roles.map((role) => ({ ...role })) })),
            })),
          }
        : buildTemplateDatedSchedule(draft),
```

`templateToDraft` fixed 분기도 동일하게 `requirements` 를 복제(레거시 `roleRequirements` 가 templateData 에 남아있으면 `buildFixedSyntheticRequirement` 패턴으로 흡수 — 헬퍼를 jobTemplate 으로 import 하거나 인라인). `PostingSlotRoleRequirement` import 는 유지.

- [ ] **3.9 통과 확인** — `npx jest src/utils/job-posting/__tests__/draftAdapter.test.ts -t "draftAdapter fixed"` → **Expected: PASS** (3 케이스). 추가 `npx jest src/utils/job-posting/__tests__/draftAdapter.test.ts` 전체 실행해 기존 케이스 회귀 갱신.

- [ ] **3.10 커밋** — `git add src/types/jobPostingDraft.ts src/utils/job-posting/draftAdapter.ts src/types/jobTemplate.ts src/utils/job-posting/__tests__/draftAdapter.test.ts && git commit -m "refactor(jobPosting): fixed 생성/수정 draftAdapter·템플릿을 합성 슬롯으로 통일"`

---

## Task 4: stats — fixed 분기 제거, 단일 순회

**Files:**

- Modify: `src\domains\job-posting\stats.ts` (`calculateFilledPositionsFromSchedule` 13-26, `calculateTotalPositionsFromSchedule` 47-75)
- Test: `src\domains\job-posting\__tests__\totalPositions.test.ts` (fixed 케이스 갱신)

- [ ] **4.1 실패 테스트 갱신** — `src\domains\job-posting\__tests__\totalPositions.test.ts` 의 `describe('fixed schedule')`(8-37) 3 케이스를 통일 구조로 교체:

```ts
describe('fixed schedule', () => {
  it('sums roles count in synthetic slot (dealer 2 + floor 1 = 3)', () => {
    const schedule: PostingSchedule = {
      kind: 'fixed',
      requirements: [
        {
          date: null,
          timeSlots: [
            {
              startTime: '19:00',
              isTimeToBeAnnounced: false,
              roles: [
                { role: 'dealer', count: 2 },
                { role: 'floor', count: 1 },
              ],
            },
          ],
        },
      ],
    };
    expect(calculateTotalPositionsFromSchedule(schedule)).toBe(3);
  });

  it('returns 0 when synthetic slot roles is empty', () => {
    const schedule: PostingSchedule = {
      kind: 'fixed',
      requirements: [{ date: null, timeSlots: [{ isTimeToBeAnnounced: false, roles: [] }] }],
    };
    expect(calculateTotalPositionsFromSchedule(schedule)).toBe(0);
  });
});
```

(`roleRequirements undefined` 케이스는 통일 후 타입상 불가하므로 삭제.)

- [ ] **4.2 실패 확인** — `npx jest src/domains/job-posting/__tests__/totalPositions.test.ts -t "fixed schedule"` → **Expected: FAIL** (현재 `calculateTotalPositionsFromSchedule` 의 fixed 분기는 `schedule.roleRequirements` 를 읽음 → 새 구조에서 undefined → 0 반환 오답).

- [ ] **4.3 구현 — `calculateFilledPositionsFromSchedule`(13-26)** — fixed 분기 제거, 단일 순회:

```ts
export function calculateFilledPositionsFromSchedule(schedule: PostingSchedule): number {
  return schedule.requirements.reduce((dateSum, requirement) => {
    return (
      dateSum +
      requirement.timeSlots.reduce((slotSum, slot) => {
        return slotSum + slot.roles.reduce((roleSum, role) => roleSum + (role.filled ?? 0), 0);
      }, 0)
    );
  }, 0);
}
```

- [ ] **4.4 구현 — `calculateTotalPositionsFromSchedule`(47-75)** — fixed 분기(48-50) 제거. 나머지 peak-by-role 순회는 그대로 두되, 함수 시작의 `if (schedule.kind === 'fixed')` 블록만 삭제하고 `schedule.requirements.forEach(...)` 로 직진. fixed 는 슬롯 1개라 peak == role count 합이 자동 성립.

- [ ] **4.5 통과 확인** — `npx jest src/domains/job-posting/__tests__/totalPositions.test.ts` → **Expected: PASS** (fixed 2 + dated 기존 전부).

- [ ] **4.6 커밋** — `git add src/domains/job-posting/stats.ts src/domains/job-posting/__tests__/totalPositions.test.ts && git commit -m "refactor(jobPosting): stats fixed 분기 제거 단일 requirements 순회로 통일"`

---

## Task 5: core + selectors + normalizers + DateRequirementUpdater fixed 분기 정리

**Files:**

- Modify: `src\domains\job-posting\core.ts` (`getPostingRoleStats` 112-150, `getPostingLegacyTimeSlot` 264-279, `getPostingRequiredRolesWithCount` 281-292)
- Modify: `src\domains\job-posting\selectors.ts` (`selectPostingWorkflow` 31-49, `selectPostingScheduleDisplay` 93-121)
- Modify: `src\utils\normalizers\scheduleNormalizer.ts` (`normalizeFixedSchedule` 56-65)
- Modify: `src\utils\normalizers\roleNormalizer.ts` (`normalizeJobRoles` 45-78)
- Modify: `src\domains\application\DateRequirementUpdater.ts` (`updatePostingScheduleFilled` fixed 분기 156-185)
- Test: `src\domains\job-posting\__tests__\workflow.test.ts` (fixed 케이스 갱신)

- [ ] **5.1 실패 테스트 갱신** — `src\domains\job-posting\__tests__\workflow.test.ts` 의 fixed 헬퍼/케이스(64-) 의 `schedule: { kind: 'fixed', ... roleRequirements: [...] }` 를 통일 구조로 교체. 예(line 69+ 의 fixed schedule):

```ts
      schedule: {
        kind: 'fixed',
        daysPerWeek: 5,
        startTime: '19:00',
        isStartTimeNegotiable: false,
        requirements: [
          {
            date: null,
            timeSlots: [
              {
                startTime: '19:00',
                isTimeToBeAnnounced: false,
                roles: [
                  { role: 'dealer', count: 2, filled: 1 },
                  { role: 'floor', count: 1, filled: 1 },
                ],
              },
            ],
          },
        ],
      },
```

추가 단언: `selectPostingWorkflow(posting).usesGroupedDateRanges` 는 fixed 에서 `false`(date:null 은 grouping 대상 아님), `selectPostingScheduleDisplay(posting).fixed.roles` 가 2개 역할을 노출.

- [ ] **5.2 실패 확인** — `npx jest src/domains/job-posting/__tests__/workflow.test.ts` → **Expected: FAIL** (core 의 `getPostingRoleStats`/`getPostingRequiredRolesWithCount` 가 `schedule.roleRequirements` 를 읽어 undefined → 빈 배열).

- [ ] **5.3 구현 — `core.ts getPostingRoleStats`(112-150)** — fixed 분기(113-124) 제거. 함수 전체를 단일 순회로:

```ts
export function getPostingRoleStats(posting: JobPosting): JobRoleStats[] {
  const totals = new Map<string, JobRoleStats>();

  posting.schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        const key = getPostingRoleKey(role);
        const existing = totals.get(key);
        const catalogEntry = posting.roleCatalog.find((entry) => getPostingRoleKey(entry) === key);

        if (existing) {
          existing.count += role.count;
          existing.filled += role.filled ?? 0;
          return;
        }

        totals.set(key, {
          ...toRoleRequirement(role),
          salary: catalogEntry?.salary,
        });
      });
    });
  });

  return Array.from(totals.values());
}
```

> fixed 는 슬롯 1개라 역할별 count 합이 곧 정원 합 — 기존 fixed 분기와 동치.

- [ ] **5.4 구현 — `core.ts getPostingLegacyTimeSlot`(264-279)** — fixed 분기는 `schedule.startTime` 만 읽으므로 그대로 유지(역할 substructure 무관). 변경 없음(확인만).

- [ ] **5.5 구현 — `core.ts getPostingRequiredRolesWithCount`(281-292)** — fixed 의 역할 소스를 합성 슬롯으로:

```ts
export function getPostingRequiredRolesWithCount(posting: JobPosting): RoleWithCount[] | undefined {
  if (posting.schedule.kind !== 'fixed') {
    return undefined;
  }

  const roles = posting.schedule.requirements[0]?.timeSlots[0]?.roles ?? [];
  return roles.map((role) => ({
    role: role.role ?? 'dealer',
    name: role.customRole,
    count: role.count,
    filled: role.filled ?? 0,
  }));
}
```

- [ ] **5.6 구현 — `selectors.ts selectPostingWorkflow`(31-49)** — `isFixed` 판별 유지. `hasGroupedRequirements`(35-37)는 `kind === 'dated'` 가드가 이미 있어 fixed 의 `date:null` requirement 를 보지 않으므로 변경 불필요. `usesGroupedDateRanges` 는 `!isFixed && ...` 라 fixed 에서 false 유지. **변경 없음**(확인만 — 단, dated 분기에서 `requirement.isGrouped` 만 보고 `date !== null` 추가 가드는 불필요: dated requirement 의 date 는 항상 string). `selectPostingScheduleDisplay`(93-121) 의 `fixed.roles = getPostingRequiredRolesWithCount(posting)` 는 5.5 수정으로 자동 정합 — **변경 없음**.

- [ ] **5.7 구현 — `scheduleNormalizer.ts normalizeFixedSchedule`(56-65)** — 합성 슬롯에서 역할 읽기:

```ts
function normalizeFixedSchedule(schedule: PostingFixedSchedule): FixedScheduleInfo {
  const roles = schedule.requirements[0]?.timeSlots[0]?.roles ?? [];
  return createFixedSchedule(
    schedule.daysPerWeek ?? 0,
    roles.map((role) =>
      normalizeRoleWithCount({
        role: role.role ?? 'dealer',
        name: role.customRole,
        count: role.count,
        filled: role.filled ?? 0,
      })
    ),
    {
      startTime: schedule.startTime ?? null,
      isStartTimeNegotiable: schedule.isStartTimeNegotiable,
    }
  );
}
```

`normalizeFixedRole`/`PostingFixedRoleRequirement` import(line 4,47-54) 제거.

- [ ] **5.8 구현 — `roleNormalizer.ts normalizeJobRoles`(45-78)** — fixed 분기(46-48)를 합성 슬롯 순회로. fixed 도 dated 와 동일한 슬롯 순회 로직을 타도록 통일하거나, fixed 전용 짧은 경로:

```ts
export function normalizeJobRoles(job: JobPosting): RoleInfo[] {
  const requirements =
    job.schedule.kind === 'fixed' || job.schedule.kind === 'dated' ? job.schedule.requirements : [];

  if (requirements.length === 0) {
    return [];
  }

  const roleMap = new Map<string, RoleInfo>();
  for (const requirement of requirements) {
    for (const slot of requirement.timeSlots) {
      for (const role of slot.roles) {
        const normalized = normalizePostingSlotRoleRequirement(role);
        const roleKey = getRoleAggregationKey(normalized);
        const existing = roleMap.get(roleKey);
        if (existing) {
          roleMap.set(roleKey, {
            ...existing,
            requiredCount: existing.requiredCount + normalized.requiredCount,
            filledCount: existing.filledCount + normalized.filledCount,
          });
          continue;
        }
        roleMap.set(roleKey, normalized);
      }
    }
  }
  return Array.from(roleMap.values());
}
```

`normalizePostingFixedRoleRequirement`/`PostingFixedRoleRequirement` import(line 3,33-35) 제거.

- [ ] **5.9 구현 — `DateRequirementUpdater.ts updatePostingScheduleFilled`(156-185)** — fixed 분기의 `roleRequirements` 증감을 합성 슬롯 `requirements[0].timeSlots[0].roles` 의 `filled` 증감으로:

```ts
if (schedule.kind === 'fixed') {
  const nextRequirements = schedule.requirements.map((req) => ({
    ...req,
    timeSlots: req.timeSlots.map((ts) => ({ ...ts, roles: ts.roles.map((role) => ({ ...role })) })),
  }));
  const nextRoles = nextRequirements[0]?.timeSlots[0]?.roles ?? [];

  assignments.forEach((assignment) => {
    const targetRole = assignment.roleIds[0];
    if (!targetRole) return;
    const roleRequirement = nextRoles.find((role) => {
      if (role.role === targetRole) return true;
      if (role.role === 'other' && role.customRole === targetRole) return true;
      return false;
    });
    if (!roleRequirement) return;
    const delta = assignment.dates.length || 1;
    const currentFilled = roleRequirement.filled ?? 0;
    roleRequirement.filled =
      operation === 'increment' ? currentFilled + delta : Math.max(0, currentFilled - delta);
  });

  return { ...schedule, requirements: nextRequirements };
}
```

> dead counter(`filled`) 는 SP1 에서 유지하므로 이 함수의 동작 의미는 보존(읽는 곳 없지만 형태만 통일). SP3 에서 제거.

- [ ] **5.10 통과 확인** — `npx jest src/domains/job-posting/__tests__/workflow.test.ts` → **Expected: PASS**. 추가 `npx jest src/utils/normalizers src/domains/application/__tests__/DateRequirementUpdater.test.ts` 실행해 회귀 갱신(기존 fixed 케이스를 통일 구조로 수정).

- [ ] **5.11 커밋** — `git add src/domains/job-posting/core.ts src/domains/job-posting/selectors.ts src/utils/normalizers/scheduleNormalizer.ts src/utils/normalizers/roleNormalizer.ts src/domains/application/DateRequirementUpdater.ts src/domains/job-posting/__tests__/workflow.test.ts && git commit -m "refactor(jobPosting): core·selectors·normalizers fixed 역할 소스를 합성 슬롯으로 통일"`

---

## Task 6: postingSurfaceModel fixed 표시 소스 변경

**Files:**

- Modify: `src\components\jobs\shared\postingSurfaceModel.ts` (`buildPostingScheduleModel` fixed 분기 156-176)
- Test: `src\components\jobs\shared\__tests__\postingSurfaceModel.test.ts` (있으면 fixed 케이스 갱신) + `postingSurfaceModel.filled.test.ts`

- [ ] **6.1 영향 확인** — `buildPostingScheduleModel` 의 fixed 분기(157-175)는 `source.scheduleDisplay.fixed?.roles` 와 `source.requiredRolesWithCount` 에서 역할을 읽는다. 이 두 소스는 모두 `selectPostingScheduleDisplay`(Task 5.6)/`getPostingRequiredRolesWithCount`(Task 5.5)가 채우며, Task 5 이후 이미 합성 슬롯에서 파생된다. 즉 **postingSurfaceModel 자체 코드는 변경 불필요** — fixed 카드 라벨(주N일/시간)과 역할 모델이 그대로 정합한다. 본 Task 는 그 정합을 테스트로 고정한다.

- [ ] **6.2 실패 테스트 작성** — `src\components\jobs\shared\__tests__\postingSurfaceModel.test.ts` 에 fixed 모델 케이스 추가(없으면 신규 파일):

```ts
import { buildPostingScheduleModel } from '@/components/jobs/shared/postingSurfaceModel';

describe('buildPostingScheduleModel fixed (통일 구조)', () => {
  it('builds fixed model from scheduleDisplay.fixed.roles', () => {
    const model = buildPostingScheduleModel({
      workflow: { isFixed: true, usesGroupedDateRanges: false },
      scheduleDisplay: {
        variant: 'fixed',
        dateRequirements: [],
        dateGroups: [],
        workDate: '',
        timeSlot: '19:00~',
        fixed: {
          daysPerWeek: 5,
          startTime: '19:00',
          isStartTimeNegotiable: false,
          roles: [
            { role: 'dealer', count: 3, filled: 1 },
            { role: 'other', name: 'VIP Host', count: 2, filled: 0 },
          ],
        },
      },
    });

    expect(model.variant).toBe('fixed');
    if (model.variant === 'fixed') {
      expect(model.fixed.daysLabel).toBe('주 5일');
      expect(model.fixed.totalCount).toBe(5);
      expect(model.fixed.roles).toHaveLength(2);
    }
  });
});
```

- [ ] **6.3 확인 실행** — `npx jest src/components/jobs/shared/__tests__/postingSurfaceModel.test.ts -t "buildPostingScheduleModel fixed"` → **Expected: PASS** (Task 5 정합 후엔 코드 변경 없이 통과해야 정상). 만약 FAIL 이면 `RoleWithCount` 의 `name`/`role` 키와 `toRoleModels`(304-326) 매핑을 점검해 fixed 분기 역할 키 매핑을 보정한다.

- [ ] **6.4 회귀 확인** — `npx jest src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts` → **Expected: PASS** (filled hydration 은 dated 슬롯 키 기반 — fixed 무영향). 깨지면 fixed 케이스의 `filledCount` 단언을 새 구조 기준으로 갱신.

- [ ] **6.5 커밋** — `git add src/components/jobs/shared/postingSurfaceModel.ts src/components/jobs/shared/__tests__/postingSurfaceModel.test.ts && git commit -m "test(jobPosting): postingSurfaceModel fixed 표시 통일 구조 정합 고정"` (코드 변경이 실제로 없으면 테스트 파일만 커밋)

---

## Task 7: validateConfirmCapacity fixed 분기 제거 + slotCapacity fixed 지원

**Files:**

- Modify: `src\domains\application\slotCapacity.ts` (`buildPostingSlotCapacityMap` 33-69, `validateAssignmentSlotCapacity` 71-90)
- Modify: `src\repositories\supabase\ApplicationRepositoryTransactions.ts` (`validateConfirmCapacity` 309-353)
- Test: `src\domains\application\__tests__\slotCapacity.fixed.test.ts` (신규)

> **핵심 위험(Task 0 발견 B/slotCapacity)**: 현재 `buildPostingSlotCapacityMap` 과 `validateAssignmentSlotCapacity` 는 `posting.schedule.kind !== 'dated'` 이면 즉시 빈 맵/unavailable 을 반환한다. spec §4.6 은 fixed 를 `validateAssignmentSlotCapacity` 로 라우팅하라고 하므로, **이 가드를 `kind === 'dated' || kind === 'fixed'` 둘 다 허용**하도록 완화해야 한다. fixed 합성 슬롯의 `date` 는 `null` 이므로 capacity 키는 `'' (빈 문자열) __ timeSlot __ roleId` 로 정규화한다(요청측 assignment 의 fixed date 표현과 일치시켜야 함 — 아래 7.1 에서 fixed assignment 의 date 값을 확인하고 키 정규화를 맞춘다).

- [ ] **7.1 fixed assignment 형태 사전 확인 (코드 변경 없음)** — fixed 공고 확정 시 `assignmentsToConfirm` 의 `dates`/`timeSlot`/`roleIds` 가 어떻게 채워지는지 `Grep` 으로 확인: `Grep "isFixedPosting|fixed_role|selectionMode" src/domains/application src/hooks/applications`. fixed assignment 의 `dates` 가 `[]` 또는 `['']` 인지, `timeSlot` 이 `FIXED_TIME_MARKER`/`startTime` 인지 기록. 이 값이 capacity 키 정규화의 기준이 된다. 발견 결과를 7.2 키 빌더에 반영.

- [ ] **7.2 실패 테스트 작성** — 신규 `src\domains\application\__tests__\slotCapacity.fixed.test.ts`:

```ts
import { validateAssignmentSlotCapacity } from '@/domains/application/slotCapacity';
import type { Assignment, JobPosting } from '@/types';

function fixedPosting(filled: number): JobPosting {
  return {
    id: 'job-fixed',
    schemaVersion: 3,
    title: 'Fixed',
    status: 'active',
    ownerId: 'owner-1',
    postingType: 'fixed',
    workDate: '',
    totalPositions: 3,
    filledPositions: filled,
    location: { name: 'Seoul' },
    schedule: {
      kind: 'fixed',
      startTime: '19:00',
      requirements: [
        {
          date: null,
          timeSlots: [
            {
              startTime: '19:00',
              isTimeToBeAnnounced: false,
              roles: [{ role: 'dealer', count: 3, filled }],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' }],
    compensation: { mode: 'shared' },
    questions: { items: [] },
  } as unknown as JobPosting;
}

const dealerAssignment: Assignment = {
  // 7.1 에서 확인한 fixed assignment 형태에 맞춤 (date 빈 표현 + roleIds:['dealer'])
  dates: [''],
  timeSlot: '19:00',
  roleIds: ['dealer'],
} as unknown as Assignment;

describe('validateAssignmentSlotCapacity fixed (통일 구조)', () => {
  it('allows confirm when fixed role has remaining capacity', () => {
    const result = validateAssignmentSlotCapacity(fixedPosting(0), [dealerAssignment]);
    expect(result.available).toBe(true);
  });

  it('blocks confirm when fixed role is full', () => {
    const result = validateAssignmentSlotCapacity(fixedPosting(3), [dealerAssignment]);
    expect(result.available).toBe(false);
  });
});
```

> `dates`/`timeSlot` 값은 7.1 실측에 맞춰 조정. 키 정규화(빈 date)는 `getCapacityKey('', start, roleId)` 와 일치해야 한다.

- [ ] **7.3 실패 확인** — `npx jest src/domains/application/__tests__/slotCapacity.fixed.test.ts` → **Expected: FAIL** (현재 `kind !== 'dated'` 가드로 fixed 는 항상 `available:false` 또는 빈 맵 → 첫 케이스 FAIL).

- [ ] **7.4 구현 — `slotCapacity.ts`** 두 함수의 `kind !== 'dated'` 가드를 fixed 포함으로 완화. `buildPostingSlotCapacityMap`(36-38):

```ts
if (posting.schedule.kind !== 'dated' && posting.schedule.kind !== 'fixed') {
  return capacityMap;
}
```

순회는 `posting.schedule.requirements.forEach(...)` 그대로(fixed 도 requirements 보유). 키의 date 는 `requirement.date ?? ''` 로 정규화:

```ts
        const key = getCapacityKey(requirement.date ?? '', slotStartTime, roleId);
        capacityMap.set(key, {
          date: requirement.date ?? '',
          ...
```

`validateAssignmentSlotCapacity`(75-90) 의 동일 가드도 `&& kind !== 'fixed'` 로 완화(early unavailable 제거).

- [ ] **7.5 구현 — `ApplicationRepositoryTransactions.ts validateConfirmCapacity`(309-353)** — fixed 분기(315-343) 제거, 전 경로 단일화:

```ts
function validateConfirmCapacity(
  _isFixedPosting: boolean,
  assignmentsToConfirm: Assignment[],
  jobData: JobPosting,
  applicationData: Application
): void {
  const slotCapacity = validateAssignmentSlotCapacity(jobData, assignmentsToConfirm);
  if (!slotCapacity.available) {
    throw new MaxCapacityReachedError({
      userMessage: '모집 인원이 마감되었습니다.',
      jobPostingId: applicationData.jobPostingId,
    });
  }
}
```

> 호출부 시그니처 유지 위해 `_isFixedPosting` 파라미터는 남겨둔다(호출자 변경 최소화). 미사용이면 `_` prefix 로 lint 회피. `ValidationError`/`ERROR_CODES` import 가 이 파일 다른 곳에서 쓰이지 않으면 제거(quality 단계에서 unused import 확인).

- [ ] **7.6 통과 확인** — `npx jest src/domains/application/__tests__/slotCapacity.fixed.test.ts` → **Expected: PASS** (2 케이스). 추가 `npx jest src/domains/application` 전체로 회귀 확인(dated capacity 테스트 무변).

- [ ] **7.7 커밋** — `git add src/domains/application/slotCapacity.ts src/repositories/supabase/ApplicationRepositoryTransactions.ts src/domains/application/__tests__/slotCapacity.fixed.test.ts && git commit -m "refactor(jobPosting): 확정 정원 가드 fixed 분기 제거 — slotCapacity 단일 경로 + 합성 슬롯 키"`

---

## Task 8: DB 멱등 마이그레이션 — roleRequirements → requirements

**Files:**

- Create: `supabase\migrations\20260525164354_unify_fixed_schedule_to_requirements.sql`

> **적용 규칙**: MCP `mcp__supabase__apply_migration` 으로만 적용. `supabase db push` 금지. 기존 마이그레이션 파일 수정 금지. prod 영향 = fixed 공고 0건 → 0 rows affected(무위험). fresh/staging/미래 시드 대비.

- [ ] **8.1 마이그레이션 파일 작성** — 본문(UP) + 역변환(DOWN) 동봉:

```sql
-- =============================================================================
-- Migration: schedule.roleRequirements -> schedule.requirements (SP1 통일)
--
-- fixed 공고의 역할이 사는 substructure 를 dated 와 동일한
-- requirements[].timeSlots[].roles[] 단일 경로로 통일한다.
-- - schedule ? 'roleRequirements' 인 row 만 대상 (멱등: 키 없으면 no-op).
-- - 합성 변환: requirements = [{ date:null, timeSlots:[{ startTime, isTimeToBeAnnounced:false, roles: <roleRequirements> }] }]
-- - roleRequirements 키 제거.
-- - prod fixed 공고 0건 → 0 rows. fresh/staging/미래 시드 대비.
-- - DOWN: requirements[0].timeSlots[0].roles -> roleRequirements 역변환 (kind=fixed + date:null 인 row 만).
-- =============================================================================

-- UP --------------------------------------------------------------------------
UPDATE public.job_postings
SET schedule = (schedule - 'roleRequirements')
  || jsonb_build_object(
       'requirements',
       jsonb_build_array(
         jsonb_build_object(
           'date', NULL,
           'timeSlots',
           jsonb_build_array(
             jsonb_strip_nulls(
               jsonb_build_object(
                 'startTime', schedule->>'startTime',
                 'isTimeToBeAnnounced', false,
                 'roles', COALESCE(schedule->'roleRequirements', '[]'::jsonb)
               )
             )
           )
         )
       )
     )
WHERE schedule ? 'roleRequirements'
  AND schedule->>'kind' = 'fixed';
```

> `jsonb_strip_nulls` 는 `startTime` 이 없을 때 빈 키를 떨군다. `date: NULL` 은 strip 대상이 아니도록 timeSlots 내부에만 strip 적용(요건: `requirements[0].date` 는 명시적 null 유지). 위 구조에서 `date` 는 바깥 `jsonb_build_object` 에 있어 strip 안 됨 — OK.

- [ ] **8.2 DOWN(역변환) 문서화** — 같은 파일 하단에 주석 블록으로 down 스크립트 동봉(레지스트리는 up-only 이므로 실행은 수동):

```sql
-- DOWN (수동 롤백 — apply_migration 으로 별도 실행) -----------------------------
-- UPDATE public.job_postings
-- SET schedule = (schedule - 'requirements')
--   || jsonb_build_object(
--        'roleRequirements',
--        COALESCE(schedule#>'{requirements,0,timeSlots,0,roles}', '[]'::jsonb)
--      )
-- WHERE schedule->>'kind' = 'fixed'
--   AND schedule ? 'requirements'
--   AND (schedule#>'{requirements,0,date}') = 'null'::jsonb;
```

- [ ] **8.3 RED/GREEN 검증 (execute_sql 롤백 트랜잭션)** — 적용 전, MCP `mcp__supabase__execute_sql` 로 BEGIN/ROLLBACK 안에서 멱등성 + 변환 검증:
  1. **RED**: 임시 fixed row(roleRequirements 형태) INSERT → UP 미적용 상태에서 `schedule ? 'roleRequirements'` = true 확인.
  2. **GREEN**: UP UPDATE 실행 → `schedule ? 'roleRequirements'` = false, `schedule#>'{requirements,0,date}' = 'null'`, `schedule#>'{requirements,0,timeSlots,0,roles}'` 가 원본 역할 배열과 동일 확인.
  3. **멱등**: UP 을 한 번 더 실행 → 0 rows affected.
  4. `ROLLBACK` 으로 임시 row 정리.
     검증 SQL 은 단일 트랜잭션:

```sql
BEGIN;
INSERT INTO public.job_postings (id, schema_version, title, status, owner_id, total_positions, filled_positions, location, schedule, role_catalog, compensation, questions, work_date)
VALUES (gen_random_uuid(), 3, 'mig-test', 'draft', '<existing_owner_uuid>', 3, 0,
        '{"name":"t"}'::jsonb,
        '{"kind":"fixed","startTime":"19:00","roleRequirements":[{"role":"dealer","count":3,"filled":0}]}'::jsonb,
        '[{"role":"dealer"}]'::jsonb, '{"mode":"shared"}'::jsonb, '{"items":[]}'::jsonb, '');
-- RED assertion
SELECT (schedule ? 'roleRequirements') AS has_legacy FROM public.job_postings WHERE title='mig-test';
-- UP
<paste UP UPDATE>;
-- GREEN assertions
SELECT (schedule ? 'roleRequirements') AS still_legacy,
       (schedule#>'{requirements,0,date}') AS date_val,
       (schedule#>'{requirements,0,timeSlots,0,roles}') AS roles
FROM public.job_postings WHERE title='mig-test';
-- idempotency
<paste UP UPDATE>;  -- expect 0 rows
ROLLBACK;
```

> `<existing_owner_uuid>` 는 `SELECT id FROM public.users LIMIT 1` 로 확보. RLS/트리거(prevent_role_escalation 등) 충돌 시 테스트 row 는 status='draft' 로 최소화. **이 검증은 플랜 실행자가 MCP 로 수행하며, 플랜 작성자는 실행하지 않는다.**

- [ ] **8.4 적용** — 검증 통과 후 `mcp__supabase__apply_migration(name='20260525164354_unify_fixed_schedule_to_requirements', query=<UP SQL>)`. prod 결과 0 rows affected 확인(fixed 0건).

- [ ] **8.5 커밋** — `git add supabase/migrations/20260525164354_unify_fixed_schedule_to_requirements.sql && git commit -m "feat(db): fixed schedule roleRequirements→requirements 멱등 마이그레이션 (SP1)"`

---

## Task 9: 동작 동치 통합 검증 + quality 게이트

**Files:**

- Test: `src\domains\job-posting\__tests__\sp1Equivalence.test.ts` (신규, 선택)
- 검증 대상: 전 스위트 + `npm run quality`

- [ ] **9.1 동작 동치 스냅샷 테스트(선택)** — 신규 `src\domains\job-posting\__tests__\sp1Equivalence.test.ts`: 동일 fixed 입력(통일 구조)에 대해 `calculateTotalPositionsFromSchedule`/`calculateFilledPositionsFromSchedule`/`getPostingRoleStats`/`selectPostingScheduleDisplay`/`selectPostingRoleAvailability` 가 기대값과 일치하는지 고정:

```ts
it('fixed posting derives consistent totals/roles/availability', () => {
  const posting = /* createBasePosting fixed 통일 구조, dealer x3 filled1 + VIP x2 filled0 */;
  expect(calculateTotalPositionsFromSchedule(posting.schedule)).toBe(5);
  expect(getPostingRoleStats(posting).map((r) => r.count).sort()).toEqual([2, 3]);
  expect(selectPostingRoleAvailability(posting).totalCount).toBe(5);
  expect(selectPostingScheduleDisplay(posting).variant).toBe('fixed');
});
```

- [ ] **9.2 관련 스위트 전체 실행** — `npx jest src/schemas/__tests__/jobPosting.schema.test.ts src/domains/job-posting src/utils/job-posting src/utils/normalizers src/domains/application src/components/jobs/shared/__tests__/postingSurfaceModel.test.ts src/components/jobs/shared/__tests__/postingSurfaceModel.filled.test.ts src/services/jobs src/services/work` → **Expected: PASS (0 failures)**. 잔존 `roleRequirements` 참조 테스트가 있으면 통일 구조로 갱신.

- [ ] **9.3 잔존 `roleRequirements` grep** — `Grep "roleRequirements" src` → **Expected: 0 matches**(테스트 포함 전부 제거 확인). 남아있으면 해당 Task 로 회귀해 정리.

- [ ] **9.4 quality 게이트** — `npm run quality` (tsc --noEmit + eslint + prettier) → **Expected: exit 0, 0 errors**. unused import(`PostingFixedRoleRequirement`, `ValidationError` 등) 정리.

- [ ] **9.5 전체 jest** — `npm test` → **Expected: 전체 PASS**(0 failures). fixed 미관련 스위트 회귀 없는지 최종 확인.

- [ ] **9.6 커밋** — `git add src/domains/job-posting/__tests__/sp1Equivalence.test.ts && git commit -m "test(jobPosting): SP1 fixed 동작 동치 스냅샷 + 통일 검증"` (동치 테스트를 추가한 경우)

---

## 검증 체크리스트 (완료 전 필수)

- [ ] `Grep "roleRequirements" src` → 0 matches (타입/zod/직렬화/생성/표시/stats/정원/normalizer/template/test 전부)
- [ ] `PostingFixedRoleRequirement` 타입 + `postingFixedRoleRequirementSchema` 삭제됨
- [ ] fixed schedule 의 `requirements[0].date === null` 불변식이 zod 로 강제됨
- [ ] `npm run quality` exit 0
- [ ] `npm test` 0 failures
- [ ] 마이그레이션 멱등(2회 적용 동일) + DOWN 동봉, MCP apply_migration 로만 적용
- [ ] dead counter(`filled` 필드) 제거하지 않음 (SP3 범위)
- [ ] confirm RPC 통합/단일 카운터 미착수 (SP2/SP3 범위)
- [ ] `isSupportedReleasePosting`/fixed 가시성 게이트 미변경

## 리스크 / 완화 (spec §6 매핑)

- **R1 (생성/표시 회귀)**: Task 3·5·6 의 round-trip + 표시 모델 테스트 + Task 9 동치 스냅샷. fixed 공고 수동 QA(생성→카드→상세→확정 1회)는 배포 전 별도 수행.
- **R2 (역호환)**: Task 2 의 `buildFixedSyntheticRequirement` 가 레거시 `roleRequirements` doc 을 deserialize 시 흡수(2.1 두 번째 테스트로 고정).
- **R3 (date:null 누락 분기)**: Task 0 발견 B — 위험 사용처 없음(모두 dated 가드 뒤). slotCapacity 만 의도적 확장(Task 7).
- **R4 (스코프 크립)**: dead counter·confirm RPC·단일 카운터·fixed 가시성은 명시적 제외(검증 체크리스트로 게이트).
