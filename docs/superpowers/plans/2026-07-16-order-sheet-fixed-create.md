# 고정(fixed) 생성 주문서화 — S2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정(fixed) 공고 생성을 레거시 상세폼이 아니라 주문서(order-sheet) 키오스크 내부에서 처리한다 — 새 "근무조건" 시트로 주 출근일수·출근시간·협의를 입력받고, 기존 역할·급여·조건·사전질문 행은 공유한다.

**Architecture:** 고정은 지원/급구/대회(dated)와 스케줄 구조가 다르다(날짜 없음, `schedule.kind==='fixed'`). 주문서 폼 스키마에 `postingType='fixed'`와 신규 `fixedSchedule` 필드를 추가하고, 최상위 `superRefine`이 `postingType`↔스케줄 표현 정합을 강제한다("discriminated union"의 실체 = superRefine 게이트, 폼은 평탄 유지 → RHF 3제네릭 보존). 매퍼(`valuesToDraft`/`draftToValues`)에 fixed 분기를 추가하되 **쓰기 경로는 SP1 synthetic requirement**(`requirements:[{date:null,timeSlots:[{startTime,roles}]}]`)를 재사용한다. **서버·직렬화·마이그레이션 변경 0** — `daysPerWeek`/`startTime`/`isStartTimeNegotiable`는 이미 도메인 타입(`PostingFixedSchedule`)·strict 스키마(`jobPosting.schema.ts:233-241`)·직렬화(`serialization.ts:244-248,428-444`)·`schedule` JSONB 컬럼에 존재하며 레거시 고정 공고가 오늘도 왕복한다. S2는 순수하게 **주문서 폼 계약 + 매퍼 + UI** 계층 작업이다.

**Tech Stack:** React Native 0.83 / Expo 55 / TypeScript strict / react-hook-form 7 (3제네릭 zodResolver) / zod 4 / NativeWind 4 / Jest + @testing-library/react-native.

---

## 설계 근거 · 정련 (착수 전 필독)

- **설계 SSOT:** `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md` — §3.1(스케줄 discriminated union), §3.2(매퍼), §4(근무조건 시트), §6 S2, §7(함정), §8(검증).
- 이 계획은 **S2(고정 생성)만** 다룬다. S3(전 타입 편집)·S4(레거시 은퇴)는 별도 계획 — 손대지 말 것.

### 🔑 설계 확정 #1 — fixed 역할 캐리어 = `fixedSchedule.roles` (SSOT 정련)

SSOT §3.1은 `fixedSchedule { daysPerWeek, startTime, isStartTimeNegotiable }`(3필드)로 적었으나 **역할(roles)이 폼 어디에 실리는지**는 미명시("역할·급여 이하 공유"). 실측 결론: **`fixedSchedule`에 `roles`를 추가**해 4필드로 확정한다.

- **기각한 대안 — scheduleGroups 재사용(단일 synthetic 그룹에 roles)**: `orderSheetScheduleGroupSchema` → `orderSheetTimeSlotSchema.startTime`은 필수 `HH:MM` 정규식이다. 고정의 시간은 **협의 시 비어 있음**이 정상이므로, scheduleGroups로 역할을 나르면 이 정규식을 만족시키려 startTime을 억지로 채우거나 dated 스키마를 약화시켜야 한다(회귀 위험). 배제.
- **채택 근거**: 레거시 고정 모델이 이미 역할을 **평탄 배열**(`formData.roles`, `buildFixedDraft`가 매핑)로 다룬다. `fixedSchedule.roles`는 이 시맨틱과 1:1이고, dated 스키마를 건드리지 않으며, 왕복(own-property)이 단일 필드로 닫힌다. 급여 시트의 `uniqueRoles`·`syncRoleSalariesForRoles`는 역할 참조 리스트만 받으므로 fixed-aware 소스 전환이 소규모다.

### 🔑 설계 확정 #2 — 스케줄 표현 분기 = postingType superRefine 게이트

- `scheduleGroups`는 `.min(1)` → `.default([])`로 완화(빈 배열 허용). "dated면 그룹 ≥1" 강제는 최상위 `superRefine`으로 이관.
- `fixedSchedule`는 `.optional()`. fixed면 present 강제, dated면 무시.
- **불변식(handleTypeChange가 유지)**: `postingType==='fixed'` ⇔ `scheduleGroups:[]` + `fixedSchedule` present. dated ⇔ `scheduleGroups:[…]` + `fixedSchedule` undefined. 이유: 배열 원소 스키마(`orderSheetScheduleGroupSchema`)는 superRefine과 무관하게 **모든 원소에 실행**되므로, fixed에 잔여 그룹이 있으면 `dates.min(1)`이 fixed 제출을 깨뜨린다 → fixed 전환 시 반드시 `scheduleGroups:[]`.

---

## Global Constraints

모든 태스크에 암묵 적용 (CLAUDE.md·전역 규칙에서 verbatim):

- **언어**: 모든 주석·커밋 메시지·UI 문구는 **한글**. 기술 식별자만 원문.
- **로깅**: `logger.info()`/`logger.error()` — `console.log()` 금지(앱 런타임).
- **다크모드**: 모든 신규 UI에 `dark:` 토큰 적용.
- **경로**: `@/` 절대 경로. 시스템 절대경로 금지.
- **알림**: `toast`(`addToast`)/`Alert.alert()` — 단순 `alert()` 금지.
- **필드명**: camelCase.
- **아이콘**: `@/components/icons`에서만 import. Lucide stroke 2.0. **이모지 상태표시 금지**(impeccable §14). 허용 size: 14/16/18/20/24/28/32.
- **폼 계약**: `useForm<z.input, unknown, z.output>` **3제네릭** 유지. union 도입해도 z.input/z.output 2형 불변.
- **불변식 승계**: `guaranteedHours` PROVIDED_FLAG(-1) 금지(문서게이트 `min(0)` reject). zodResolver 3제네릭.
- **서버 무변경**: S2는 마이그레이션·RLS·Edge Function·직렬화(`serialization.ts`/`jobPosting.schema.ts`) 변경 **0**. JSON-only → OTA 가능.
- **커밋**: `<type>(<scope>): <한글>` — 예: `feat(jobs): …(S2)`. 리뷰 디스패치된 커밋은 amend 금지(append 커밋).
- **검증 게이트**: 작업 디렉토리 `uniqn-mobile/`. `npm run quality`(tsc+eslint+prettier) + 관련 `npx jest` 통과가 완료 조건. jest 경로에 괄호(`app/(employer)/…`)가 있으면 Windows 매칭 0건 → 괄호 없는 부분경로(예: `my-postings`)로 실행.
- **커밋 직전 브랜치 재확인**: `git branch --show-current` = `docs/order-sheet-unification-design`. 단일트리 동시세션이 master로 되돌린 실증 있음 — master 직접 커밋 금지.
- **에이전트 디스패치 금지사항**: `mcp__supabase__*` 직접 호출 · 기존 마이그레이션 수정 · PROD 우회 · 범위 밖 리팩터 금지.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `uniqn-mobile/src/schemas/orderSheet.schema.ts` | 주문서 폼 계약 | Modify — enum+`fixedSchedule`+superRefine 분기 |
| `uniqn-mobile/src/utils/order-sheet/mappers.ts` | 값↔draft 왕복 | Modify — fixed 분기(valuesToDraft·draftToValues)+역할 접근자 |
| `uniqn-mobile/src/utils/job-posting/draftAdapter.ts` | draft↔input | Modify — `buildFixedSyntheticRequirement` export |
| `uniqn-mobile/src/types/jobTemplate.ts` | 템플릿 변환 | Modify — 인라인 synthetic 중복을 공유 헬퍼로(SP1 후속 TODO) |
| `uniqn-mobile/src/components/employer/order-sheet/orderRowMeta.ts` | 행 메타 | Modify — `workConditions` 키+fixed 섹션+fixed 역할/급여 소스 |
| `uniqn-mobile/src/components/employer/order-sheet/sheets/WorkConditionSheet.tsx` | 근무조건 시트 | **Create** |
| `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` | 주문서 화면 | Modify — fixed 렌더·handleTypeChange·uniqueRoles·시트 배선 |
| `uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx` | 유형 세그먼트 | Modify — value prop 4종 |
| `uniqn-mobile/app/(employer)/my-postings/create.tsx` | 생성 진입 | Modify — fixed 완료 요약·프리셋 무회귀 |
| (테스트) mappers.test / orderSheet.schema.test / orderRowMeta.test / WorkConditionSheet.test / OrderSheetScreen.fixed.test | | Create/Modify |

---

## Task 1: 스키마 — fixed enum + `fixedSchedule` union 게이트 (데이터 계층)

주문서 폼이 고정을 값으로 받고, superRefine이 fixed↔dated 정합을 강제한다. 이 태스크만으로 "fixed 폼 값 검증"이 성립한다(UI·매퍼는 후속).

**Files:**
- Modify: `uniqn-mobile/src/schemas/orderSheet.schema.ts`
- Test: `uniqn-mobile/src/schemas/__tests__/orderSheet.schema.test.ts` (없으면 Create)

**Interfaces:**
- Produces: `orderSheetFixedScheduleSchema`(z.object). `orderSheetValuesSchema`의 `postingType`이 `'regular'|'urgent'|'tournament'|'fixed'`, 신규 `fixedSchedule?: { daysPerWeek:number; startTime?:string; isStartTimeNegotiable:boolean; roles: {role,customRole?,count}[] }`(z.output), `scheduleGroups` 기본 `[]`.
- Consumes(후속 태스크): `OrderSheetFormValues['fixedSchedule']`, `OrderSheetValues['fixedSchedule']`.

- [ ] **Step 1: 실패하는 테스트 작성**

`orderSheet.schema.test.ts` 하단에 추가(파일 없으면 새로 만들고 `import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';`):

```ts
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';

const baseFixed = {
  postingType: 'fixed' as const,
  title: '주말 고정 딜러',
  location: { name: '강남 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [],
  fixedSchedule: {
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [{ role: 'dealer' as const, count: 3 }],
  },
  salary: { type: 'daily' as const, amount: 200000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

describe('주문서 스키마 — fixed union 게이트 (S2)', () => {
  it('유효한 고정 공고를 통과시킨다', () => {
    expect(orderSheetValuesSchema.safeParse(baseFixed).success).toBe(true);
  });

  it('fixedSchedule 부재면 fixed 제출을 거부한다', () => {
    const { fixedSchedule, ...noFixed } = baseFixed;
    expect(orderSheetValuesSchema.safeParse(noFixed).success).toBe(false);
  });

  it('역할이 없으면 거부한다(roles min 1)', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      fixedSchedule: { ...baseFixed.fixedSchedule, roles: [] },
    });
    expect(r.success).toBe(false);
  });

  it('협의가 아니면서 출근시간이 없으면 거부한다', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      fixedSchedule: { daysPerWeek: 5, isStartTimeNegotiable: false, roles: baseFixed.fixedSchedule.roles },
    });
    expect(r.success).toBe(false);
  });

  it('협의면 출근시간 없이도 통과한다', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      fixedSchedule: { daysPerWeek: 0, isStartTimeNegotiable: true, roles: baseFixed.fixedSchedule.roles },
    });
    expect(r.success).toBe(true);
  });

  it('by_role일 때 fixedSchedule.roles를 급여 커버 게이트로 검사한다', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      useSameSalary: false,
      roleSalaries: [], // dealer 미커버
    });
    expect(r.success).toBe(false);
  });

  it('dated(지원)는 여전히 scheduleGroups ≥1을 요구한다(무회귀)', () => {
    const r = orderSheetValuesSchema.safeParse({
      ...baseFixed,
      postingType: 'regular',
      fixedSchedule: undefined,
      scheduleGroups: [],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/schemas/__tests__/orderSheet.schema.test.ts -t "fixed union"`
Expected: FAIL — `postingType` enum이 'fixed' 거부, `fixedSchedule` 미존재.

- [ ] **Step 3: fixed 스키마 요소 추가**

`orderSheet.schema.ts` — `orderSheetTimeSlotSchema` 정의 부근(라인 49 이후)에 시간 정규식 상수와 fixed 스키마 추가:

```ts
const START_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 고정(fixed) 근무조건(S2) — 날짜 축이 없는 상시 반복 근무. 역할은 평탄 배열(레거시 formData.roles 시맨틱).
 * startTime은 협의(isStartTimeNegotiable)면 부재 허용, 아니면 필수(superRefine).
 * daysPerWeek 0 = 협의(레거시 DAYS_OPTIONS와 동일).
 */
export const orderSheetFixedScheduleSchema = z
  .object({
    daysPerWeek: z.number().int().min(0).max(7),
    startTime: z.string().regex(START_TIME_RE, '출근 시간을 선택해주세요').optional(),
    isStartTimeNegotiable: z.boolean().default(false),
    roles: z.array(orderSheetRoleSchema).min(1, '역할을 추가해주세요'),
  })
  .superRefine((fs, ctx) => {
    if (!fs.isStartTimeNegotiable && !fs.startTime) {
      ctx.addIssue({ code: 'custom', path: ['startTime'], message: '출근 시간을 선택해주세요' });
    }
  });
```

- [ ] **Step 4: enum 확장 + 필드 추가 + scheduleGroups 완화**

`orderSheet.schema.ts:104` enum:

```ts
    postingType: z.enum(['regular', 'urgent', 'tournament', 'fixed']),
```

`orderSheet.schema.ts:110` — `scheduleGroups`의 `.min(1)` 제거(빈 배열 허용, 게이트는 superRefine 이관):

```ts
    scheduleGroups: z.array(orderSheetScheduleGroupSchema).default([]),
    // 고정(fixed) 근무조건 — dated면 undefined, fixed면 present(superRefine 강제). scheduleGroups와 상호배타.
    fixedSchedule: orderSheetFixedScheduleSchema.optional(),
```

- [ ] **Step 5: 최상위 superRefine에 fixed/dated 분기**

`orderSheet.schema.ts:141` superRefine 본문 **맨 앞**에 fixed 게이트를 두고, 기존 dated 로직(날짜 중복·maxDates·by_role 커버)은 dated 분기로 감싼다:

```ts
  .superRefine((v, ctx) => {
    // ── 급여 by_role 커버 게이트(공유) — 소스만 타입별로 다르다 ──
    const keyOf = (role: string, customRole?: string) =>
      role === 'other' ? `other:${customRole ?? ''}` : role;
    const coverByRole = (roleKeys: Set<string>) => {
      if (v.useSameSalary || roleKeys.size === 0) return;
      const salaryByRole = new Map(
        v.roleSalaries.map((rs) => [keyOf(rs.role, rs.customRole), rs.salary] as const)
      );
      const allCovered = [...roleKeys].every((k) => {
        const s = salaryByRole.get(k);
        return s !== undefined && (s.type === 'other' || s.amount > 0);
      });
      if (!allCovered) {
        ctx.addIssue({ code: 'custom', path: ['roleSalaries'], message: '역할별 급여를 모두 입력해주세요' });
      }
    };

    // ── 고정(fixed) 분기 ──
    if (v.postingType === 'fixed') {
      if (v.fixedSchedule === undefined) {
        ctx.addIssue({ code: 'custom', path: ['fixedSchedule'], message: '근무조건을 입력해주세요' });
        return;
      }
      const fixedKeys = new Set<string>();
      for (const r of v.fixedSchedule.roles) fixedKeys.add(keyOf(r.role, r.customRole));
      coverByRole(fixedKeys);
      return;
    }

    // ── dated(지원·급구·대회) 분기 ── (기존 로직 유지 + scheduleGroups 비어있음 게이트)
    if (v.scheduleGroups.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['scheduleGroups'], message: '날짜를 선택해주세요' });
      return;
    }
    const seenDates = new Set<string>();
    v.scheduleGroups.forEach((g, gi) => {
      let flagged = false;
      for (const d of g.dates) {
        if (seenDates.has(d)) {
          if (!flagged) {
            ctx.addIssue({
              code: 'custom',
              path: ['scheduleGroups', gi, 'dates'],
              message: '이미 다른 일정에 포함된 날짜예요',
            });
            flagged = true;
          }
        } else {
          seenDates.add(d);
        }
      }
    });
    const maxDates = DATE_CONSTRAINTS[v.postingType].maxDates;
    if (seenDates.size > maxDates) {
      ctx.addIssue({
        code: 'custom',
        path: ['scheduleGroups'],
        message: `날짜는 최대 ${maxDates}개까지 선택할 수 있어요`,
      });
    }
    const uniqueKeys = new Set<string>();
    for (const g of v.scheduleGroups)
      for (const slot of g.timeSlots)
        for (const r of slot.roles) uniqueKeys.add(keyOf(r.role, r.customRole));
    coverByRole(uniqueKeys);
  });
```

> 주의: 위는 기존 superRefine을 **완전 대체**한다. 기존 dated 로직(중복·maxDates·by_role)이 그대로 dated 분기로 이동했는지 라인 대조. `coverByRole`가 `uniqueKeys.size===0` skip(Eng-M5)·other 협의 커버 인정 등 기존 계약을 보존하는지 확인.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/schemas/__tests__/orderSheet.schema.test.ts`
Expected: PASS (7 케이스).

- [ ] **Step 7: 기존 매퍼/행메타 스위트 무회귀 확인**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet src/components/employer/order-sheet`
Expected: PASS. ⚠️ `scheduleGroups.min(1)` → superRefine 이관으로 dated 빈 그룹 에러 **경로/메시지가 동일**(`scheduleGroups`)한지, errorRowTargets 폴백(dates,0)이 그대로 작동하는지 확인. 실패 케이스는 Task 4 전이라 일부 fixed 관련은 아직 미구현 — 여기선 **기존(dated) 케이스 무회귀만** 판정.

- [ ] **Step 8: 커밋**

```bash
git add uniqn-mobile/src/schemas/orderSheet.schema.ts uniqn-mobile/src/schemas/__tests__/orderSheet.schema.test.ts
git commit -m "feat(jobs): 주문서 스키마 fixed union 게이트 — fixedSchedule + superRefine 분기(S2)"
```

---

## Task 2: 매퍼 — valuesToDraft/draftToValues fixed 분기 + 공유 역할 접근자 (데이터 계층)

fixed 폼 값이 fixed draft로 조립되고(쓰기), fixed draft/posting이 fixed 폼 값으로 복원된다(읽기·프리셋). `valuesToCreateInput`은 기존 `draftToCreateJobPostingInput`(이미 fixed-aware)을 재사용하므로 자동 성립한다.

**Files:**
- Modify: `uniqn-mobile/src/utils/order-sheet/mappers.ts`
- Modify: `uniqn-mobile/src/utils/job-posting/draftAdapter.ts` (export만)
- Test: `uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts`

**Interfaces:**
- Consumes: `buildFixedSyntheticRequirement`(draftAdapter, export 필요), `PostingSlotRoleRequirement`(`@/types/jobPosting`).
- Produces: `valuesToDraft`가 fixed면 `schedule.kind==='fixed'` draft 반환. `draftToValues`가 fixed draft를 `{postingType:'fixed', scheduleGroups:[], fixedSchedule:{…}}`로 복원. `collectFormRoles(values)` 내부 헬퍼(fixed→fixedSchedule.roles, dated→scheduleGroups 슬롯 역할).

- [ ] **Step 1: `buildFixedSyntheticRequirement` export**

`draftAdapter.ts:296` — `function buildFixedSyntheticRequirement` 앞에 `export` 추가:

```ts
export function buildFixedSyntheticRequirement(
  roles: PostingSlotRoleRequirement[],
  startTime?: string
): PostingDateRequirement {
```

(본문 불변. `PostingDateRequirement`/`PostingSlotRoleRequirement` import는 draftAdapter에 이미 존재.)

- [ ] **Step 2: 실패하는 테스트 작성**

`mappers.test.ts` 하단에 추가:

```ts
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';

describe('고정(fixed) 매퍼 왕복 (S2)', () => {
  const fixedValues = orderSheetValuesSchema.parse({
    postingType: 'fixed',
    title: '주말 고정 딜러',
    location: { name: '강남 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
    contactPhone: '010-1234-5678',
    description: '',
    scheduleGroups: [],
    fixedSchedule: { daysPerWeek: 5, startTime: '19:00', isStartTimeNegotiable: false, roles: [{ role: 'dealer', count: 3 }] },
    salary: { type: 'daily', amount: 200000 },
    useSameSalary: true,
    roleSalaries: [],
    allowances: {},
    conditions: {},
    usesPreQuestions: false,
    preQuestions: [],
  });

  it('valuesToDraft가 fixed 스케줄을 조립한다(date:null synthetic)', () => {
    const draft = valuesToDraft(fixedValues);
    expect(draft.postingType).toBe('fixed');
    expect(draft.schedule.kind).toBe('fixed');
    if (draft.schedule.kind !== 'fixed') throw new Error('kind');
    expect(draft.schedule.daysPerWeek).toBe(5);
    expect(draft.schedule.startTime).toBe('19:00');
    expect(draft.schedule.requirements[0]?.date).toBeNull();
    expect(draft.schedule.requirements[0]?.timeSlots[0]?.roles).toHaveLength(1);
  });

  it('draftToValues가 fixed draft를 폼 값으로 복원한다(왕복 own-property)', () => {
    const draft = valuesToDraft(fixedValues);
    const back = draftToValues(draft);
    expect(back.postingType).toBe('fixed');
    expect(back.scheduleGroups).toEqual([]);
    expect(back.fixedSchedule?.daysPerWeek).toBe(5);
    expect(back.fixedSchedule?.startTime).toBe('19:00');
    expect(back.fixedSchedule?.isStartTimeNegotiable).toBe(false);
    expect(back.fixedSchedule?.roles).toEqual([{ role: 'dealer', count: 3 }]);
  });

  it('협의 고정(startTime 없음)도 왕복 보존한다', () => {
    const negotiable = orderSheetValuesSchema.parse({
      ...fixedValues,
      fixedSchedule: { daysPerWeek: 0, isStartTimeNegotiable: true, roles: [{ role: 'dealer', count: 2 }] },
    });
    const back = draftToValues(valuesToDraft(negotiable));
    expect(back.fixedSchedule?.isStartTimeNegotiable).toBe(true);
    expect(back.fixedSchedule?.startTime).toBeUndefined();
    expect(back.fixedSchedule?.daysPerWeek).toBe(0);
  });

  it('valuesToCreateInput(fixed)이 레거시 draftToCreateJobPostingInput과 등가 스케줄을 낸다', () => {
    const input = valuesToCreateInput(fixedValues);
    expect(input.postingType).toBe('fixed');
    expect(input.schedule.kind).toBe('fixed');
    if (input.schedule.kind !== 'fixed') throw new Error('kind');
    expect(input.schedule.daysPerWeek).toBe(5);
    expect(input.schedule.requirements).toHaveLength(1);
    expect(input.schedule.requirements[0]?.date).toBeNull();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts -t "고정"`
Expected: FAIL — `valuesToDraft`가 항상 dated 조립, `draftToValues`가 kind!=='dated' throw.

- [ ] **Step 4: 공유 역할 접근자 추가**

`mappers.ts` — `allGroupTimeSlots`(라인 67) 부근에 추가. fixed/dated 공용 역할 소스:

```ts
type FormRole = { role: OrderSheetValues['fixedSchedule'] extends infer F
  ? never : never };
```

(위 유사코드는 사용하지 말 것 — 아래 실코드를 사용.) 실제 추가:

```ts
type OrderSheetFixedSchedule = NonNullable<OrderSheetValues['fixedSchedule']>;
type FormRoleRef = OrderSheetFixedSchedule['roles'][number];

/** fixed/dated 공용 역할 목록 — roleCatalog·급여 파생의 단일 소스(S2). */
function collectFormRoles(values: OrderSheetValues): FormRoleRef[] {
  if (values.postingType === 'fixed' && values.fixedSchedule) {
    return values.fixedSchedule.roles;
  }
  return allGroupTimeSlots(values).flatMap((slot) => slot.roles);
}
```

그리고 `toRoleCatalog`(라인 74)와 `resolveDefaultSalary`(라인 110)의 역할 순회 소스를 `collectFormRoles(values)`로 교체:
- `toRoleCatalog`: `for (const slot of allGroupTimeSlots(values)) for (const r of slot.roles)` → `for (const r of collectFormRoles(values))`.
- `resolveDefaultSalary`: `for (const slot of allGroupTimeSlots(values)) for (const r of slot.roles) activeKeys.add(...)` → `for (const r of collectFormRoles(values)) activeKeys.add(...)`.

(dated 동작은 불변 — collectFormRoles가 dated에서 기존 flatMap과 동일 결과.)

- [ ] **Step 5: `valuesToDraft` fixed 분기**

`mappers.ts:127` `valuesToDraft` — 함수 시작부에 fixed 조기 분기 추가(dated 조립 전):

```ts
export function valuesToDraft(values: OrderSheetValues): JobPostingDraft {
  const compensation = {
    mode: values.useSameSalary ? ('shared' as const) : ('by_role' as const),
    defaultSalary: resolveDefaultSalary(values),
    ...(Object.keys(values.allowances).length > 0 ? { allowances: values.allowances } : {}),
    ...(values.taxSettings !== undefined ? { taxSettings: values.taxSettings } : {}),
  };
  const common = {
    postingType: values.postingType,
    title: values.title,
    description: values.description,
    location: values.location,
    contactPhone: values.contactPhone,
    tags: [] as string[],
    ...(values.venueId !== undefined ? { venueId: values.venueId } : {}),
    roleCatalog: toRoleCatalog(values),
    compensation,
    questions: { items: values.usesPreQuestions ? values.preQuestions : [] },
    ...(values.conditions.dressCode !== undefined || values.conditions.experience !== undefined
      ? { conditions: values.conditions }
      : {}),
  };

  if (values.postingType === 'fixed' && values.fixedSchedule) {
    const fs = values.fixedSchedule;
    const roles = fs.roles.map((r) => ({
      role: r.role,
      ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    }));
    return {
      ...common,
      schedule: {
        kind: 'fixed',
        daysPerWeek: fs.daysPerWeek,
        ...(fs.startTime ? { startTime: fs.startTime } : {}),
        isStartTimeNegotiable: fs.isStartTimeNegotiable,
        requirements: [buildFixedSyntheticRequirement(roles, fs.startTime)],
      },
    };
  }

  // ── dated 조립(기존) ──
  const requirements = values.scheduleGroups
    .flatMap((g) => …); // 기존 라인 131-139 그대로
  const allDates = […]; // 기존 라인 140 그대로
  return {
    ...common,
    schedule: { kind: 'dated', primaryDate: allDates[0] ?? '', allDates, requirements, templateTimeSlots: toPostingTimeSlots(values.scheduleGroups[0]?.timeSlots ?? []) },
  };
}
```

> 리팩터 주의: 기존 `valuesToDraft`의 직접조립 객체(라인 143-169)를 `common` + schedule 분리로 재구성한다. dated 반환 필드가 **바이트 동일**한지(roleCatalog/compensation/questions/conditions 순서·조건부 키) 대조. `import { buildFixedSyntheticRequirement } from '@/utils/job-posting/draftAdapter';` 추가.

- [ ] **Step 6: `draftToValues` fixed 분기 (throw 대체)**

`mappers.ts:204` `draftToValues` — 라인 205-207 throw를 fixed 복원으로 대체. 함수 시작부:

```ts
export function draftToValues(draft: JobPostingDraft): OrderSheetFormValues {
  if (draft.schedule.kind === 'fixed') {
    const sched = draft.schedule;
    const slotRoles = sched.requirements[0]?.timeSlots[0]?.roles ?? [];
    const roleSalaries =
      draft.compensation.mode === 'by_role'
        ? draft.roleCatalog
            .filter((r): r is PostingRoleCatalogEntry & { salary: SalaryInfo } => r.salary !== undefined)
            .map((r) => ({ role: r.role, ...(r.customRole !== undefined ? { customRole: r.customRole } : {}), salary: r.salary }))
        : [];
    return {
      postingType: 'fixed',
      title: draft.title,
      location: draft.location,
      contactPhone: draft.contactPhone,
      description: draft.description,
      scheduleGroups: [],
      fixedSchedule: {
        daysPerWeek: sched.daysPerWeek ?? 0,
        ...(sched.startTime ? { startTime: sched.startTime } : {}),
        isStartTimeNegotiable: sched.isStartTimeNegotiable ?? false,
        roles: slotRoles.map((r) => ({
          role: r.role ?? 'dealer',
          ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
          count: r.count,
        })),
      },
      salary: draft.compensation.defaultSalary ??
        roleSalaries[0]?.salary ?? { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly },
      useSameSalary: draft.compensation.mode === 'shared',
      roleSalaries,
      allowances: { ...(draft.compensation.allowances ?? {}) },
      ...(draft.compensation.taxSettings !== undefined ? { taxSettings: draft.compensation.taxSettings } : {}),
      conditions: { ...(draft.conditions ?? {}) },
      usesPreQuestions: draft.questions.items.length > 0,
      preQuestions: [...draft.questions.items],
      ...(draft.venueId !== undefined ? { venueId: draft.venueId } : {}),
    };
  }
  // ── dated 복원(기존 라인 208-298) ──
  …
}
```

> 주의: dated 분기는 기존 로직 그대로. fixed 분기의 급여 복원 로직(roleSalaries·salary·useSameSalary)은 dated 말미(라인 265-289)와 **동일 계약**이므로 그대로 미러링했는지 확인. `draft.postingType==='fixed'`이므로 dated 말미의 `postingType: draft.postingType === 'fixed' ? 'regular' …`(S1 잔재) 폴백은 이제 fixed에서 도달 불가 — 그대로 두되(dated 전용) 주석 갱신 가능.

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts`
Expected: PASS (기존 dated 케이스 전부 + 신규 fixed 4).

- [ ] **Step 8: 왕복 own-property Red-Green 확인(#194 재발 클래스)**

`draftToValues` fixed 분기에서 `daysPerWeek: sched.daysPerWeek ?? 0` 줄을 임시로 삭제(또는 `daysPerWeek: 0` 하드코딩)한 뒤:
Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts -t "왕복 own-property"`
Expected: FAIL (received 0, expected 5) — 테스트가 필드 증발을 실제로 잡는다는 증거. 확인 후 복원 → PASS.

- [ ] **Step 9: 커밋**

```bash
git add uniqn-mobile/src/utils/order-sheet/mappers.ts uniqn-mobile/src/utils/job-posting/draftAdapter.ts uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts
git commit -m "feat(jobs): 주문서 fixed 매퍼 왕복 — valuesToDraft/draftToValues fixed 분기(S2)"
```

---

## Task 3: SP1 헬퍼 통합 — templateToDraft 인라인 중복 제거 (리팩터)

`templateToDraft`의 fixed 인라인 synthetic requirement 조립(명시적 `TODO(SP1 후속)`)을 공유 `buildFixedSyntheticRequirement`로 통합한다. 기존 회귀 테스트가 가드한다.

**Files:**
- Modify: `uniqn-mobile/src/types/jobTemplate.ts:179-221`
- Test(가드): `uniqn-mobile/src/types/__tests__/jobTemplate.test.ts`, `uniqn-mobile/src/domains/job-posting/__tests__/sp1Equivalence.test.ts`

**Interfaces:**
- Consumes: `buildFixedSyntheticRequirement`(Task 2에서 export됨).

- [ ] **Step 1: 가드 테스트 현재 GREEN 확인(기준선)**

Run: `cd uniqn-mobile && npx jest src/types/__tests__/jobTemplate.test.ts src/domains/job-posting/__tests__/sp1Equivalence.test.ts`
Expected: PASS — 리팩터 전 기준선. (협의 출근시간 round-trip 케이스 포함.)

- [ ] **Step 2: 인라인 중복을 공유 헬퍼로 치환**

`jobTemplate.ts` — 상단 import에 `import { buildFixedSyntheticRequirement } from '@/utils/job-posting/draftAdapter';` 추가. `templateToDraft` fixed 분기(라인 179-221)의 `requirements: [ { date:null, timeSlots:[{ …, roles: sourceRoles.map(...) }] } ]` 인라인 블록을 교체:

```ts
        return {
          kind: 'fixed' as const,
          daysPerWeek: legacyFixed.daysPerWeek,
          ...(legacyFixed.startTime ? { startTime: legacyFixed.startTime } : {}),
          ...(legacyFixed.isStartTimeNegotiable !== undefined
            ? { isStartTimeNegotiable: legacyFixed.isStartTimeNegotiable }
            : {}),
          requirements: [
            buildFixedSyntheticRequirement(
              sourceRoles.map((role) => ({ ...role })),
              legacyFixed.startTime
            ),
          ],
        };
```

> ⚠️ 순환 import 확인: `jobTemplate.ts` → `draftAdapter.ts`. `mappers.ts`(라인 16-17)가 이미 `jobTemplate`·`draftAdapter` 둘 다 import하므로 방향성 확인. `draftAdapter`가 `jobTemplate`을 import하지 않는지 grep으로 검증(순환이면 헬퍼를 의존성 0 모듈로 이동). `buildFixedSyntheticRequirement`는 순수 함수 — 필요 시 `@/utils/job-posting/fixedSchedule.ts` 신규 모듈로 추출해 양쪽이 import.

- [ ] **Step 3: 가드 테스트 무회귀 확인**

Run: `cd uniqn-mobile && npx jest src/types/__tests__/jobTemplate.test.ts src/domains/job-posting/__tests__/sp1Equivalence.test.ts src/domains/job-posting/__tests__/serialization.fixed.test.ts`
Expected: PASS — synthetic 구조(date:null·timeSlots[0].roles)·불변식 보존.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/types/jobTemplate.ts
git commit -m "refactor(jobs): fixed synthetic requirement 공유 헬퍼 통합 — templateToDraft 인라인 중복 제거(S2)"
```

---

## Task 4: orderRowMeta — fixed 섹션 + workConditions 행 상태 (순수 로직)

고정 공고용 섹션 구성("근무조건" + 역할)과 행 상태를 정의한다. 급여 커버·역할 요약이 fixed에선 `fixedSchedule.roles`를 읽도록 fixed-aware 소스로 전환한다.

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/orderRowMeta.ts`
- Test: `uniqn-mobile/src/components/employer/order-sheet/__tests__/orderRowMeta.fixed.test.ts` (Create)

**Interfaces:**
- Produces: `OrderRowKey`에 `'workConditions'` 추가. `orderGroupsFor(postingType)` → fixed면 근무조건 섹션 섹션리스트, 아니면 기존 `ORDER_GROUPS`. `getRowState`가 `'workConditions'` 케이스 + fixed 역할/급여 소스. `firstUnsetRow`/`errorRowTargets` fixed-aware.

- [ ] **Step 1: 실패하는 테스트 작성**

`orderRowMeta.fixed.test.ts` (Create):

```ts
import { getRowState, firstUnsetRow, orderGroupsFor } from '../orderRowMeta';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const fixedComplete: OrderSheetFormValues = {
  postingType: 'fixed',
  title: '주말 고정 딜러',
  location: { name: '강남 홀덤펍', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [],
  fixedSchedule: { daysPerWeek: 5, startTime: '19:00', isStartTimeNegotiable: false, roles: [{ role: 'dealer', count: 3 }] },
  salary: { type: 'daily', amount: 200000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

describe('orderRowMeta — fixed(S2)', () => {
  it('fixed 섹션은 근무조건·역할 행을 포함하고 날짜/시간 행이 없다', () => {
    const groups = orderGroupsFor('fixed');
    const rows = groups.flatMap((g) => g.rows);
    expect(rows).toContain('workConditions');
    expect(rows).toContain('roles');
    expect(rows).not.toContain('dates');
    expect(rows).not.toContain('time');
  });

  it('완성된 고정은 workConditions/roles/salary가 모두 set이다', () => {
    expect(getRowState(fixedComplete, 'workConditions').unset).toBe(false);
    expect(getRowState(fixedComplete, 'roles').unset).toBe(false);
    expect(getRowState(fixedComplete, 'salary').unset).toBe(false);
    expect(firstUnsetRow(fixedComplete)).toBeNull();
  });

  it('협의 미설정 + 출근시간 없음이면 workConditions가 unset이다', () => {
    const v = { ...fixedComplete, fixedSchedule: { daysPerWeek: 5, isStartTimeNegotiable: false, roles: fixedComplete.fixedSchedule!.roles } };
    expect(getRowState(v, 'workConditions').unset).toBe(true);
  });

  it('협의면 출근시간 없이도 workConditions가 set이다', () => {
    const v = { ...fixedComplete, fixedSchedule: { daysPerWeek: 0, isStartTimeNegotiable: true, roles: fixedComplete.fixedSchedule!.roles } };
    expect(getRowState(v, 'workConditions').unset).toBe(false);
  });

  it('역할 없으면 roles가 unset이다', () => {
    const v = { ...fixedComplete, fixedSchedule: { ...fixedComplete.fixedSchedule!, roles: [] } };
    expect(getRowState(v, 'roles').unset).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest orderRowMeta.fixed.test.ts`
Expected: FAIL — `orderGroupsFor`/`workConditions` 미존재.

- [ ] **Step 3: OrderRowKey + 섹션 셀렉터**

`orderRowMeta.ts:12` `OrderRowKey`에 `| 'workConditions'` 추가.

`ORDER_GROUPS`(라인 39-45) 아래에 fixed 섹션 + 셀렉터 추가:

```ts
export const FIXED_ORDER_GROUPS = [
  { title: '기본 정보', rows: ['title', 'place', 'contact', 'description'] },
  { title: '근무조건', rows: ['workConditions', 'roles'] },
  { title: '급여', rows: ['salary', 'welfare', 'tax'] },
  { title: '조건', rows: ['conditions'] },
  { title: '사전질문', rows: ['preQuestions'] },
] as const satisfies readonly { title: string; rows: readonly OrderRowKey[] }[];

/** postingType별 섹션 구성 — fixed는 날짜·시간 대신 근무조건 행. */
export function orderGroupsFor(postingType: OrderSheetFormValues['postingType']) {
  return postingType === 'fixed' ? FIXED_ORDER_GROUPS : ORDER_GROUPS;
}
```

- [ ] **Step 4: fixed 역할 소스 + getRowState 분기**

`orderRowMeta.ts` — `allSlots`(라인 257) 부근에 fixed-aware 역할 참조 추가:

```ts
type FixedRoles = NonNullable<OrderSheetFormValues['fixedSchedule']>['roles'];

/** fixed/dated 공용 고유역할 소스 — 급여 커버·역할 요약(S2). */
function formRoleList(values: OrderSheetFormValues): { role: string; customRole?: string; count: number }[] {
  if (values.postingType === 'fixed') {
    return (values.fixedSchedule?.roles ?? []) as FixedRoles;
  }
  return allSlots(values).flatMap((s) => s.roles);
}
```

`getRowState`(라인 290) — 새 `workConditions` 케이스 추가(switch 내부, 예: `conditions` 앞):

```ts
    case 'workConditions': {
      const fs = values.fixedSchedule;
      const negotiable = fs?.isStartTimeNegotiable ?? false;
      const timeSet = negotiable || (!!fs?.startTime && START_TIME_RE.test(fs.startTime));
      const daysLabel = fs === undefined ? '' : fs.daysPerWeek === 0 ? '주 협의' : `주 ${fs.daysPerWeek}일`;
      const timeLabel = fs === undefined ? '' : negotiable ? '출근 협의' : `출근 ${fs.startTime}`;
      return {
        label: '근무조건',
        value: fs !== undefined && timeSet ? `${daysLabel} · ${timeLabel}` : '',
        unset: fs === undefined || !timeSet,
        optional: false,
      };
    }
```

`getRowState`의 `'roles'` 케이스(라인 349)와 `'salary'` by_role 케이스(라인 360-386)를 fixed-aware로:
- `'roles'`: fixed면 `values.fixedSchedule?.roles`를 소스로 unset/summary 판정. dated면 기존 그룹 슬롯 로직. 분기:
```ts
    case 'roles': {
      if (values.postingType === 'fixed') {
        const roles = values.fixedSchedule?.roles ?? [];
        return { label: '역할', value: roles.length > 0 ? summarizeRolesFlat(roles) : '', unset: roles.length === 0, optional: false };
      }
      // 기존 dated 그룹 로직 …
    }
```
  (헬퍼 `summarizeRolesFlat(roles)` = `summarizeRoles`가 슬롯이 아닌 역할배열을 받도록, 또는 `roles`를 단일 슬롯으로 감싸 재사용: `summarizeRoles([{ startTime: '', roles }])`.)
- `'salary'` by_role: `uniqueRoles` 파생 소스를 `for (const slot of allSlots(values)) for (const r of slot.roles)` → `for (const r of formRoleList(values))`로 교체(양 타입 공용).

- [ ] **Step 5: firstUnsetRow / errorRowTargets fixed-aware**

`firstUnsetRow`(라인 435): 섹션 리스트를 `orderGroupsFor(values.postingType)`로, 그룹 순회는 fixed면 단일(groupIndex 0)만:

```ts
export function firstUnsetRow(values: OrderSheetFormValues): OrderRowTarget | null {
  const isFixed = values.postingType === 'fixed';
  const groupCount = isFixed ? 1 : Math.max(1, (values.scheduleGroups ?? []).length);
  for (const section of orderGroupsFor(values.postingType)) {
    const isSchedule = section.title === '일정 · 모집';
    const groupIndexes = isSchedule ? [...Array(groupCount).keys()] : [0];
    for (const groupIndex of groupIndexes) {
      for (const key of section.rows) {
        const state = getRowState(values, key, groupIndex);
        if (!state.optional && state.unset) return { key, groupIndex };
      }
    }
  }
  return null;
}
```

`errorRowTargets`(라인 72): `ERROR_FIELD_TO_ROW`에 `fixedSchedule: 'workConditions'` 추가. fixed 폼은 `scheduleGroups` 에러가 없으므로(빈 배열) 기존 sg 처리는 무해. `fixedSchedule.roles` min(1) 에러는 `fixedSchedule` 최상위 에러로 와 `workConditions` 행으로 흐름 — 단, roles 에러는 '역할' 행이 더 정확하므로 매핑 정련: `fixedSchedule` 에러 객체에 `roles` 키가 있으면 `'roles'`, `startTime`/`daysPerWeek`면 `'workConditions'`로 분기(경로 워커 소규모 추가). 최소 구현: `fixedSchedule` → `'workConditions'` 폴백 + roles 세분화는 선택.

- [ ] **Step 6: 테스트 통과 + 무회귀**

Run: `cd uniqn-mobile && npx jest orderRowMeta`
Expected: PASS (fixed 신규 + 기존 dated 무회귀).

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/src/components/employer/order-sheet/orderRowMeta.ts uniqn-mobile/src/components/employer/order-sheet/__tests__/orderRowMeta.fixed.test.ts
git commit -m "feat(jobs): 주문서 fixed 행 메타 — 근무조건 섹션·workConditions 행 상태(S2)"
```

---

## Task 5: WorkConditionSheet 컴포넌트 (신규 UI)

주 출근일수 칩(0=협의~7) + 출근시간 휠(TimeWheelPicker overlay) + 협의 토글 + 게시기간 7일 안내를 담은 시트. 레거시 `FixedSchedule`(ScheduleSection.tsx:127-230)의 시맨틱을 주문서 시트 관례(SheetModal + overlay wheel)로 재현한다.

**Files:**
- Create: `uniqn-mobile/src/components/employer/order-sheet/sheets/WorkConditionSheet.tsx`
- Test: `uniqn-mobile/src/components/employer/order-sheet/sheets/__tests__/WorkConditionSheet.test.tsx` (Create)

**Interfaces:**
- Consumes: `SheetModal`(`@/components/ui/SheetModal`), `Button`(`@/components/ui/Button`), `TimeWheelPicker`(`@/components/ui/TimeWheelPicker`), `CheckIcon`(`@/components/icons`).
- Produces: `WorkConditionSheet({ visible, value, onConfirm, onClose })` where `value: { daysPerWeek: number; startTime?: string; isStartTimeNegotiable: boolean }`, `onConfirm(next: same)`.

- [ ] **Step 1: 실패하는 테스트 작성**

`WorkConditionSheet.test.tsx` — 렌더 + 칩/토글 상호작용. (동일 디렉토리 기존 시트 테스트가 없으면 `@testing-library/react-native` 기본 렌더 + toast/theme 모킹은 다른 order-sheet 시트 테스트 셋업 참조.)

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { WorkConditionSheet } from '../WorkConditionSheet';

describe('WorkConditionSheet (S2)', () => {
  const base = { daysPerWeek: 5, startTime: '19:00', isStartTimeNegotiable: false };

  it('확인 시 현재 값을 onConfirm으로 넘긴다', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <WorkConditionSheet visible value={base} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ daysPerWeek: 5, startTime: '19:00', isStartTimeNegotiable: false }));
  });

  it('협의 토글 시 출근시간 피커가 숨는다', () => {
    const { getByTestId, queryByTestId } = render(
      <WorkConditionSheet visible value={base} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByTestId('work-condition-time')).toBeTruthy();
    fireEvent.press(getByTestId('work-condition-negotiable'));
    expect(queryByTestId('work-condition-time')).toBeNull();
  });

  it('주 출근일수 칩 선택이 반영된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <WorkConditionSheet visible value={base} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('work-condition-days-3'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ daysPerWeek: 3 }));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest WorkConditionSheet.test.tsx`
Expected: FAIL — 컴포넌트 미존재.

- [ ] **Step 3: WorkConditionSheet 구현**

`WorkConditionSheet.tsx` (Create) — SheetModal + overlay wheel(TimeSlotsSheet 관례) + 칩/토글(FixedSchedule 시맨틱):

```tsx
/**
 * WorkConditionSheet — 근무조건 시트 (주문서 고정 공고, S2)
 *
 * @description 주 출근일수 칩(0=협의)·출근시간 휠(TimeWheelPicker embedded overlay)·협의 토글.
 * 레거시 FixedSchedule(ScheduleSection) 시맨틱을 주문서 시트 관례로 재현 — 중첩 Modal 없음(#186/#243).
 * 게시기간 7일 자동 안내를 상단에 노출한다.
 */
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import { CheckIcon } from '@/components/icons';

export interface WorkConditionValue {
  daysPerWeek: number;
  startTime?: string;
  isStartTimeNegotiable: boolean;
}
export interface WorkConditionSheetProps {
  visible: boolean;
  value: WorkConditionValue;
  onConfirm: (next: WorkConditionValue) => void;
  onClose: () => void;
}

const DAYS_OPTIONS = [
  { value: 0, label: '협의' },
  { value: 1, label: '1일' },
  { value: 2, label: '2일' },
  { value: 3, label: '3일' },
  { value: 4, label: '4일' },
  { value: 5, label: '5일' },
  { value: 6, label: '6일' },
  { value: 7, label: '7일' },
];
const DEFAULT_START = '19:00';
const toTimeValue = (s?: string): TimeValue => {
  const [hour = 19, minute = 0] = (s ?? DEFAULT_START).split(':').map(Number);
  return { hour, minute };
};
const toStartTime = (t: TimeValue) =>
  `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

export function WorkConditionSheet({ visible, value, onConfirm, onClose }: WorkConditionSheetProps) {
  const [daysPerWeek, setDaysPerWeek] = useState(value.daysPerWeek);
  const [startTime, setStartTime] = useState<string | undefined>(value.startTime);
  const [negotiable, setNegotiable] = useState(value.isStartTimeNegotiable);
  const [pickerOpen, setPickerOpen] = useState(false);

  const toggleNegotiable = () => {
    setNegotiable((prev) => {
      const next = !prev;
      if (next) setStartTime(undefined); // 협의로 전환 시 시간 초기화(레거시 동일)
      return next;
    });
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="근무조건"
      footer={
        <Button
          onPress={() => {
            onConfirm({ daysPerWeek, isStartTimeNegotiable: negotiable, ...(negotiable ? {} : startTime ? { startTime } : {}) });
            onClose();
          }}
        >
          확인
        </Button>
      }
      overlay={
        pickerOpen ? (
          <TimeWheelPicker
            visible
            embedded
            title="출근 시간"
            value={toTimeValue(startTime)}
            minuteInterval={5}
            onConfirm={(t) => { setStartTime(toStartTime(t)); setPickerOpen(false); }}
            onClose={() => setPickerOpen(false)}
          />
        ) : undefined
      }
    >
      <View className="px-4 pt-3 pb-2 gap-4">
        {/* 게시기간 안내 — 카드 틴트(impeccable §14 border-l 금지) */}
        <View className="rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-3.5 py-3">
          <Text className="text-xs font-sans text-content-secondary leading-5 dark:leading-[1.125rem]">
            고정 공고는 상시 반복 근무예요. 게시 기간은 7일이며, 만료 후 재등록할 수 있어요.
          </Text>
        </View>

        {/* 주 출근일수 */}
        <View className="gap-2">
          <Text className="text-sm font-sans-medium text-content-secondary">주 출근일수</Text>
          <View className="flex-row flex-wrap gap-2">
            {DAYS_OPTIONS.map((o) => {
              const selected = daysPerWeek === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setDaysPerWeek(o.value)}
                  testID={`work-condition-days-${o.value}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`px-4 py-2 min-h-[44px] justify-center rounded-lg border ${
                    selected
                      ? 'border-primary-500 bg-primary-100 dark:border-primary-400 dark:bg-primary-900/30'
                      : 'border-secondary-200 dark:border-surface-overlay'
                  } active:opacity-80`}
                >
                  <Text className={`text-sm font-sans-medium ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'}`}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 출근 시간 + 협의 토글 */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-sans-medium text-content-secondary">출근 시간</Text>
            <Pressable
              onPress={toggleNegotiable}
              testID="work-condition-negotiable"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: negotiable }}
              className="flex-row items-center min-h-[44px] active:opacity-80"
              hitSlop={8}
            >
              <View className={`w-5 h-5 rounded border items-center justify-center mr-1.5 ${negotiable ? 'bg-primary-600 border-primary-600' : 'bg-surface-card border-secondary-300 dark:border-surface-overlay'}`}>
                {negotiable && <CheckIcon size={14} color="#FFFFFF" />}
              </View>
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">협의</Text>
            </Pressable>
          </View>
          {negotiable ? (
            <View className="rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-3">
              <Text className="text-center text-sm text-content-secondary font-sans">출근 시간은 협의 후 결정돼요</Text>
            </View>
          ) : (
            <Pressable
              onPress={() => setPickerOpen(true)}
              testID="work-condition-time"
              accessibilityRole="button"
              accessibilityLabel={`출근 시간 ${startTime ?? '미설정'} 변경`}
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
            >
              <Text className="text-base font-sans-bold text-content-primary">출근 {startTime ?? '--:--'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SheetModal>
  );
}
```

> 확인: `TimeWheelPicker` props 시그니처(`visible, embedded, title, value:TimeValue, minuteInterval, onConfirm, onClose`)는 `TimeSlotsSheet.tsx:74-85` 실사용과 동일. `SheetModal` overlay 슬롯 관례 동일. impeccable §14(이모지 금지)·§5(44px)·§21(pressed) 준수.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest WorkConditionSheet.test.tsx`
Expected: PASS (3 케이스).

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/employer/order-sheet/sheets/WorkConditionSheet.tsx uniqn-mobile/src/components/employer/order-sheet/sheets/__tests__/WorkConditionSheet.test.tsx
git commit -m "feat(jobs): 주문서 근무조건 시트 신규 — 주N일·출근시간 휠·협의 토글(S2)"
```

---

## Task 6: OrderSheetScreen — fixed 렌더 배선 (UI)

고정 세그먼트가 레거시로 튕기지 않고 주문서 내부에서 근무조건 섹션으로 처리된다. TypeSegment·섹션 렌더·시트 배선·uniqueRoles·submitLabel을 fixed-aware로.

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx`
- Modify: `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx`
- Test: `uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.fixed.test.tsx` (Create)

**Interfaces:**
- Consumes: `orderGroupsFor`(Task 4), `WorkConditionSheet`(Task 5), `syncRoleSalariesForRoles`(roleSalaries).
- Produces: `handleTypeChange('fixed')`가 레거시 위임 대신 내부 전환(`postingType='fixed'` + `scheduleGroups:[]` + `fixedSchedule` 초기화). fixed면 `orderGroupsFor('fixed')` 렌더 + `activeSheet` 에 `'workConditions'`/`'roles'`(fixed) 케이스.

- [ ] **Step 1: 실패하는 테스트 작성**

`OrderSheetScreen.fixed.test.tsx` — S1의 `OrderSheetScreen.tournament.test.tsx` 렌더 셋업 재사용:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
// 참고: tournament 테스트와 동일한 상위 모킹(toast·icons 등) 재사용.

describe('OrderSheetScreen — 고정 유형(S2)', () => {
  const baseProps = { initialValues: initialOrderSheetValues(), onSubmit: jest.fn(), isSubmitting: false, myPhone: '010-0000-0000' };

  it('고정 세그먼트 선택 시 레거시로 이탈하지 않는다', () => {
    const onSwitchToLegacyForm = jest.fn();
    const { getByTestId } = render(<OrderSheetScreen {...baseProps} onSwitchToLegacyForm={onSwitchToLegacyForm} />);
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    expect(onSwitchToLegacyForm).not.toHaveBeenCalled();
    expect(getByTestId('order-sheet-type-fixed').props.accessibilityState.selected).toBe(true);
  });

  it('고정 선택 시 근무조건 행이 보이고 날짜 행이 없다', () => {
    const { getByTestId, queryByTestId } = render(<OrderSheetScreen {...baseProps} onSwitchToLegacyForm={jest.fn()} />);
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    expect(getByTestId('order-sheet-row-workConditions')).toBeTruthy();
    expect(queryByTestId('order-sheet-row-dates')).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest OrderSheetScreen.fixed.test.tsx`
Expected: FAIL — fixed가 레거시 위임, workConditions 행 미존재.

- [ ] **Step 3: TypeSegment value prop 확장**

`TypeSegment.tsx` — `value` prop 타입을 `'regular' | 'urgent' | 'tournament' | 'fixed'`로. (S1이 tournament까지 확장했으므로 fixed만 추가. `order-sheet-type-fixed` testID는 이미 4버튼 렌더에 존재 — Explore 확인.)

- [ ] **Step 4: handleTypeChange 내부 전환 + fixed 초기화**

`OrderSheetScreen.tsx:398` `handleTypeChange` — fixed 레거시 위임 제거, 내부 전환:

```tsx
  const handleTypeChange = useCallback(
    (t: PostingType) => {
      if (t === 'fixed') {
        form.setValue('postingType', 'fixed', { shouldDirty: true });
        form.setValue('scheduleGroups', [], { shouldDirty: true, shouldValidate: true });
        if (form.getValues().fixedSchedule === undefined) {
          // 레거시 전환 기본값과 정합(daysPerWeek 5). 역할은 사용자가 근무조건/역할 시트에서 추가.
          form.setValue('fixedSchedule', { daysPerWeek: 5, isStartTimeNegotiable: false, roles: [] }, { shouldDirty: true, shouldValidate: true });
        }
        return;
      }
      // dated 복귀 — fixedSchedule 정리, 빈 그룹 복원(스키마 원소검증 회피)
      form.setValue('postingType', t, { shouldDirty: true });
      form.setValue('fixedSchedule', undefined, { shouldDirty: true, shouldValidate: true });
      if ((form.getValues().scheduleGroups ?? []).length === 0) {
        form.setValue('scheduleGroups', [{ dates: [], timeSlots: [], grouped: false }], { shouldDirty: true, shouldValidate: true });
      }
    },
    [form]
  );
```

> `onSwitchToLegacyForm`은 이제 호출되지 않는다(대회=S1·고정=S2 모두 내부화). prop은 S4까지 유지(create.tsx가 계속 전달) — 미호출은 의도된 데드(주석 명시).

- [ ] **Step 5: fixed uniqueRoles 소스 + 섹션 렌더**

`OrderSheetScreen.tsx` `uniqueRoles` useMemo(라인 150): fixed면 `values.fixedSchedule?.roles`에서 파생. 분기 추가:

```tsx
  const uniqueRoles = useMemo<UniqueRole[]>(() => {
    const seen = new Map<string, UniqueRole>();
    const src = values.postingType === 'fixed'
      ? (values.fixedSchedule?.roles ?? [])
      : scheduleGroups.flatMap((g) => g.timeSlots ?? []).flatMap((s) => s.roles);
    for (const r of src) {
      const key = r.role === 'other' ? `other:${r.customRole ?? ''}` : r.role;
      if (!seen.has(key)) seen.set(key, { role: r.role, ...(r.customRole !== undefined ? { customRole: r.customRole } : {}), label: roleName(r.role, r.customRole) });
    }
    return [...seen.values()];
  }, [values.postingType, values.fixedSchedule, scheduleGroups]);
```

섹션 렌더(라인 475 `ORDER_GROUPS.map`): `orderGroupsFor(values.postingType).map`으로 교체. fixed는 '일정 · 모집' 섹션이 없으므로 기존 다중그룹 특수 분기(`section.title === '일정 · 모집'`)를 타지 않고 일반 행 렌더 경로로 흐른다. '근무조건' 섹션의 `workConditions`/`roles` 행은 일반 `OrderRow` + `handleRowPress`로 처리.

- [ ] **Step 6: activeSheet에 workConditions + fixed roles 배선**

`ActiveSheet` 타입에 `'workConditions'` 허용(문자열 키). `handleRowPress`(라인 219): fixed의 `'roles'`는 그룹 슬롯이 아니라 단일 fixedSchedule.roles 편집이므로 분기:

```tsx
      if (key === 'roles') {
        if (form.getValues().postingType === 'fixed') { setActiveSheet('fixedRoles'); return; }
        // 기존 dated 그룹 로직 …
      }
      if (key === 'workConditions') { setActiveSheet('workConditions'); return; }
```

시트 렌더(라인 595+ 시트 블록 영역)에 두 시트 추가:

```tsx
      {activeSheet === 'workConditions' && values.fixedSchedule && (
        <WorkConditionSheet
          visible
          value={{ daysPerWeek: values.fixedSchedule.daysPerWeek, ...(values.fixedSchedule.startTime ? { startTime: values.fixedSchedule.startTime } : {}), isStartTimeNegotiable: values.fixedSchedule.isStartTimeNegotiable ?? false }}
          onConfirm={(next) =>
            form.setValue('fixedSchedule', { ...form.getValues().fixedSchedule!, ...next }, { shouldDirty: true, shouldValidate: true })
          }
          onClose={() => setActiveSheet(null)}
        />
      )}
      {activeSheet === 'fixedRoles' && values.fixedSchedule && (
        <RolesSheet
          visible
          value={values.fixedSchedule.roles}
          onConfirm={(next) => {
            const fs = form.getValues().fixedSchedule!;
            form.setValue('fixedSchedule', { ...fs, roles: next }, { shouldDirty: true, shouldValidate: true });
            // 역할 확정 시 급여 자동 프리필(dated applyRoleSalarySync 대칭) — by_role만.
            const cur = form.getValues();
            if (!(cur.useSameSalary ?? false)) {
              const synced = syncRoleSalariesForRoles(next, cur.roleSalaries ?? [], cur.salary.type);
              if (synced !== (cur.roleSalaries ?? [])) form.setValue('roleSalaries', synced, { shouldDirty: true, shouldValidate: true });
            }
          }}
          onClose={() => setActiveSheet(null)}
        />
      )}
```

`ActiveSheet` union에 `'fixedRoles'`도 추가. import: `WorkConditionSheet`, `syncRoleSalariesForRoles`.

- [ ] **Step 7: submitLabel fixed**

`submitLabel`(라인 430): fixed는 대회가 아니므로 기존 `'이대로 등록'` 유지(별도 분기 불필요). `firstUnsetRow`가 fixed-aware(Task 4)이므로 유도 라벨도 자동 정합. 단 유도 라벨의 `isScheduleRow`(dates/time/roles) 접두는 fixed 다중그룹이 없어 무해.

- [ ] **Step 8: 테스트 통과 + 무회귀**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet`
Expected: PASS (fixed 신규 + tournament(S1) + presets 등 기존 무회귀).

- [ ] **Step 9: 커밋**

```bash
git add uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.fixed.test.tsx
git commit -m "feat(jobs): 고정 유형 주문서 내부 처리 — 근무조건/역할 시트 배선(S2)"
```

---

## Task 7: create.tsx — fixed 완료 요약 + 프리셋 무회귀 (통합)

고정 공고 등록 완료 요약과 프리셋 경로가 fixed에서도 정상 동작한다. 서버·라우팅 변경 없음.

**Files:**
- Modify: `uniqn-mobile/app/(employer)/my-postings/create.tsx`
- Modify: `uniqn-mobile/src/utils/order-sheet/mappers.ts` (`primaryScheduleInfo` fixed-safe)
- Test: `uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts` (primaryScheduleInfo fixed 케이스)

**Interfaces:**
- Produces: `primaryScheduleInfo(fixed)` → totalDates 0 안전(크래시 없음). create.tsx 완료 요약이 fixed면 "주 N일 · 출근 …" 조립.

- [ ] **Step 1: primaryScheduleInfo fixed-safe 테스트 + 구현**

`mappers.test.ts`에 fixed 케이스: `primaryScheduleInfo(fixedValues)`가 `{ totalDates: 0 }`(primaryDate/startTime 없음) 반환하고 throw하지 않는지. `primaryScheduleInfo`(라인 314)는 이미 `values.scheduleGroups`만 읽어 fixed(빈 배열)에서 `{ totalDates: 0 }` 반환 — **크래시 없음**. 테스트로 고정만 하고 구현 변경은 불필요(확인 후 생략 가능).

- [ ] **Step 2: create.tsx 완료 요약 fixed 분기**

`create.tsx:236-244` summary 조립 — fixed면 근무조건 요약으로:

```tsx
          const summary =
            values.postingType === 'fixed' && values.fixedSchedule
              ? [
                  values.fixedSchedule.daysPerWeek === 0 ? '주 협의' : `주 ${values.fixedSchedule.daysPerWeek}일`,
                  values.fixedSchedule.isStartTimeNegotiable ? '출근 협의' : values.fixedSchedule.startTime ? `출근 ${values.fixedSchedule.startTime}` : null,
                ].filter(Boolean).join(' · ')
              : (() => {
                  const { primaryDate, startTime, totalDates } = primaryScheduleInfo(values);
                  return [
                    primaryDate ? `${formatShortDate(primaryDate)}${totalDates > 1 ? ` 외 ${totalDates - 1}일` : ''}` : null,
                    startTime ? `출근 ${startTime}` : null,
                  ].filter(Boolean).join(' · ');
                })();
```

(`pending`은 fixed에서 `'0'` — 대회 아님. 기존 `values.postingType === 'tournament' ? '1' : '0'` 그대로.)

- [ ] **Step 3: 프리셋 무회귀 확인**

`create.tsx:98-130` 프리셋 조립 — fixed last-posting/템플릿은 이제 `draftToValues`가 throw하지 않아 프리셋에 **포함**된다(try/catch는 방어로 유지). fixed 프리셋 적용 시 `scheduleGroups:[]`·`fixedSchedule` 보존 확인. `handleApplyPreset`(OrderSheetScreen)의 `syncRoleSalaries((v.scheduleGroups ?? []).flatMap(...))`는 fixed에서 빈 배열 → roleSalaries 미변경(무해). fixed 프리셋의 by_role 역할급여는 `preset.values.roleSalaries`로 이미 복원됨. **동작 확인만**(코드 변경 없을 수 있음).

- [ ] **Step 4: 게이트**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet && npm run quality`
Expected: PASS + exit 0.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/app/(employer)/my-postings/create.tsx uniqn-mobile/src/utils/order-sheet/mappers.ts uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts
git commit -m "feat(jobs): 고정 공고 완료 요약·프리셋 무회귀(S2)"
```

---

## Task 8: S2 통합 검증 (품질 게이트 + 등가성 + 수동 QA)

전체 게이트로 회귀 없음을 확인하고, 신·구 등가성과 실기기 QA 체크리스트를 남긴다.

**Files:** 없음 (검증 전용).

- [ ] **Step 1: 타입·린트·포맷 게이트**

Run: `cd uniqn-mobile && npm run quality`
Expected: exit 0. 특히 `OrderSheetFormValues['fixedSchedule']` 옵셔널 접근, `handleTypeChange` 내로잉, `orderGroupsFor` 반환 타입, `valuesToDraft`/`draftToValues` fixed 분기의 z.input/z.output 정합이 tsc 통과.

- [ ] **Step 2: order-sheet 전 스위트 실행**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet src/components/employer/order-sheet src/schemas/__tests__/orderSheet.schema.test.ts src/types/__tests__/jobTemplate.test.ts src/domains/job-posting/__tests__/sp1Equivalence.test.ts`
Expected: PASS (신규 fixed + 기존 무회귀).

- [ ] **Step 3: 신·구 등가성 게이트 (핵심)**

주문서 fixed create input == 레거시 fixed create input을 실측 확인. `mappers.test.ts`에 등가 케이스(있으면 재확인): 동일 근무조건(daysPerWeek/startTime/roles/salary)에서 `valuesToCreateInput(fixedValues).schedule`가 레거시 `draftToCreateJobPostingInput(formDataToDraft(equivFormData)).schedule`와 구조 동등(id 제외). 무마이그 확정 = `PostingFixedSchedule` shape(daysPerWeek/startTime/isStartTimeNegotiable/requirements[{date:null}])가 기존 strict 스키마(`jobPosting.schema.ts:233-241`)를 만족 — **서버 무변경 재확인**.
Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts -t "등가"`
Expected: PASS.

- [ ] **Step 4: 전체 브랜치 리뷰 (fable / 폴백 opus)**

`superpowers:requesting-code-review` 또는 code-reviewer(model fable, 한도 시 opus)로 S2 diff 전체 리뷰. 금지사항 프롬프트 명시. CRITICAL/HIGH 반영 후 append 커밋(디스패치된 커밋 amend 금지).

- [ ] **Step 5: 수동 QA 체크리스트 (실기기 — 사용자 게이트)**

문서화(별도 실행 아님, S2 출하 전 사용자 수행):
- [ ] 주문서 진입 → 유형 '고정' → 레거시 폼 튕김 없이 근무조건 섹션 노출.
- [ ] 근무조건 시트: 주 출근일수 칩 선택 · 출근시간 휠 · 협의 토글(협의 시 시간 숨김·저장 후 "출근 협의" 표시).
- [ ] 역할 시트에서 딜러 3 추가 → 급여 시트 by_role 기본값 자동 프리필.
- [ ] '이대로 등록' → 완료화면 "주 N일 · 출근 HH:MM" 요약(대회 승인 문구 없음).
- [ ] 등록된 고정 공고가 목록/상세에서 정상 표시(daysPerWeek/startTime/isStartTimeNegotiable 증발 없음 — 왕복 무결).
- [ ] 지원/급구/대회 생성 무회귀 · 고정↔지원 유형 전환 무손실.
- [ ] (편집) 고정 공고 편집은 아직 레거시(S3 전까지 무회귀).

- [ ] **Step 6: (커밋 없음) 검증 결과 보고**

`npm run quality` exit 코드 + jest 통과 수를 이 세션 도구 결과로 보고. 실패 시 해당 태스크로 복귀.

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: 설계 §3.1(union 게이트)→Task1 · §3.2(매퍼 fixed·SP1 헬퍼 통합)→Task2/3 · §4(근무조건 시트·섹션 스왑)→Task4/5/6 · §6 S2(9지점 왕복)→Task1-2(주문서 폼 필드 왕복) + Task2 Step8(own-property red-green). 편집(S3)·레거시 은퇴(S4)는 범위 밖(의도된 경계).
- **9지점 재해석**: 설계 §7의 "9지점 왕복"은 **DB/직렬화 지점이 아니라 주문서 폼 `fixedSchedule` 필드의 매퍼 왕복**을 가리킨다 — DB 계층(TABLE_COLUMNS·deserialize·strict 스키마·serialize·template)은 `daysPerWeek/startTime/isStartTimeNegotiable`를 이미 왕복하며 `schedule` JSONB에 캡슐화(레거시 고정 공고가 오늘 동작하는 증거). 따라서 S2 서버 무변경. own-property 가드는 주문서 매퍼(Task2 Step8)에 배치.
- **Placeholder 스캔**: 모든 코드 스텝에 실제 코드·정확 경로·실행 명령·기대 출력. Task2 Step4의 첫 `type FormRole` 유사코드는 "사용 금지" 명시 후 실코드 제공. Task6 Step5-6은 기존 라인 참조 + 신규 분기 실코드.
- **타입 일관성**: `postingType` 확장값 4종이 schema(Task1)·mappers(Task2)·orderRowMeta(Task4)·TypeSegment/OrderSheetScreen(Task6) 일치. `fixedSchedule` shape(daysPerWeek:number, startTime?:string, isStartTimeNegotiable:boolean, roles:[]) 가 스키마 정의(Task1)와 소비처(Task2/4/6) 전반 동일. `WorkConditionValue`(Task5)는 roles 제외(시트는 근무조건만) — OrderSheetScreen이 roles를 별도 RolesSheet로 관리.
- **미확정/위임**: fixed 편집 승인상태·전 타입 하이드레이션은 S3. `onSwitchToLegacyForm` 미호출 데드 prop·create.tsx 레거시 분기 데드는 S4 정리(주석으로 의도 명시).
