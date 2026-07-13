# 공고작성 키오스크 "주문서" 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지원·급구 공고 신규작성을 "주문서" UX(프리셋 채움 + 행 탭 시트)로 전면 대체한다.

**Architecture:** zod 스키마(`OrderSheetValues`)가 UI 경계 검증을 담당하고, 매퍼가 기존 canonical `JobPostingDraft`로 변환해 **기존 제출 경로(useCreateJobPosting → Service → Repository)를 그대로 태운다**. draftAdapter는 삭제하지 않는다(고정·대회·edit이 계속 사용). 유일한 서버 접점은 신규 `conditions` JSONB 컬럼 1개(additive nullable).

**Tech Stack:** Expo 55 / RN 0.83 / TS strict / NativeWind 4.2 / zod 4 / react-hook-form 7.68 + @hookform/resolvers (전부 기설치 — 신규 의존성 0)

**스펙:** `docs/planning/2026-07-14-job-posting-kiosk-order-sheet-design.md` (확정 결정·시트 12종 정의)

## Global Constraints

- 모든 응답·커밋·주석 **한글**. 커밋 형식 `<type>(<scope>): <한글>`.
- 작업 디렉토리: `uniqn-mobile/` (워크트리 `C:\Users\user\Desktop\T-HOLDEM\.claude\worktrees\job-posting-kiosk-ux`). 명령은 전부 `uniqn-mobile/`에서 실행.
- `logger.info()` 사용, `console.log()` 금지. `@/` 절대경로. camelCase. 다크모드 `dark:` 전 표면 필수.
- 사용자 입력 검증: `z.string().refine(xssValidation)` (`@/utils/security`).
- 유형 라벨 **지원/급구/고정/대회** · 수당 → **복지** (용어 확정).
- 급여 기본값: **시급 20,000(±1,000 스테퍼) · 일급 200,000 · 월급 2,500,000** (일급·월급은 기본값+직접입력만).
- `SalaryType`은 기존 `'hourly'|'daily'|'monthly'|'other'` 사용 — **monthly 기존재, 스키마 변경 불필요**. `'other'`는 신규 작성 UI에서 제외하되 읽기 호환 유지.
- 복지 시맨틱: 기존 `Allowances` 그대로 — `-1`(=`PROVIDED_FLAG`, `@/utils/settlement`)=제공(체크만), `>0`=금액, `undefined`=없음. **서버 변경 없음**.
- 중첩 RN Modal 금지: 시트는 `SheetModal`(overlay 슬롯) + `TimeWheelPicker`의 `embedded` 패턴 준수 (`src/components/weeklyGrid/EditSlotSheet.tsx:305` 참고).
- e2e 앵커 `testID="job-posting-create-submit"`은 주문서 등록 버튼이 승계한다.
- 파일 800줄 초과 금지 — 시트는 파일당 1개.
- 각 태스크 종료 시 커밋. 최종 게이트 `npm run quality` + `npx jest` 전체 green.
- 금지: `mcp__supabase__*` 직접 호출(마이그레이션 prod 적용은 배포 게이트에서 별도 수행), 기존 마이그레이션 파일 수정, PROD 우회.

---

### Task 1: `PostingConditions` 타입 + zod 문서 스키마 화이트리스트 + DB 마이그레이션 파일

조건(복장·경력)은 유일한 신규 서버 필드. **실제 쓰기 게이트는 `jobPostingDocumentSchema`(strict)** — 여기 화이트리스트하지 않으면 insert 직전 `assertCanonical`이 reject한다(`createJobPostingSchema`는 죽은 코드 — 손대지 않는다).

**Files:**
- Modify: `src/types/jobPosting.ts` (JobPostingInput ~211행, PostingLocation ~69행 부근)
- Modify: `src/schemas/jobPosting.schema.ts`
- Create: `supabase/migrations/20260714000000_job_postings_conditions.sql`
- Test: `src/schemas/__tests__/jobPosting.schema.test.ts` (기존 파일에 추가)

**Interfaces:**
- Produces: `PostingConditions { dressCode?: string; experience?: string }` — 이후 모든 태스크가 이 이름 사용. `JobPostingInput.conditions?: PostingConditions`, `JobPosting.conditions?: PostingConditions`, zod `postingConditionsSchema`.

- [ ] **Step 1: 실패하는 스키마 테스트 작성** — `src/schemas/__tests__/jobPosting.schema.test.ts`에 추가:

```ts
import { postingConditionsSchema } from '../jobPosting.schema';

describe('postingConditionsSchema (조건: 복장·경력)', () => {
  it('정상 조건을 통과시킨다', () => {
    const r = postingConditionsSchema.safeParse({ dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' });
    expect(r.success).toBe(true);
  });
  it('빈 객체·부분 입력을 허용한다 (선택 필드)', () => {
    expect(postingConditionsSchema.safeParse({}).success).toBe(true);
    expect(postingConditionsSchema.safeParse({ dressCode: '흰셔츠/슬랙스' }).success).toBe(true);
  });
  it('XSS 패턴을 거부한다', () => {
    const r = postingConditionsSchema.safeParse({ dressCode: '<script>alert(1)</script>' });
    expect(r.success).toBe(false);
  });
  it('알 수 없는 키를 거부한다 (strict)', () => {
    expect(postingConditionsSchema.safeParse({ dress: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest src/schemas/__tests__/jobPosting.schema.test.ts -t "조건" --silent`
Expected: FAIL — `postingConditionsSchema` export 없음.

- [ ] **Step 3: 타입 + 스키마 구현**

`src/types/jobPosting.ts` — `PostingRoleCatalogEntry` 위쪽에 추가:

```ts
/** 모집 조건 (복장·경력) — 프리셋 문구 또는 직접 입력 */
export interface PostingConditions {
  dressCode?: string;
  experience?: string;
}
```

`JobPostingInput`(~211행)과 `JobPosting` 엔티티 인터페이스에 각각 `conditions?: PostingConditions;` 필드 추가 (questions 다음 위치).

`src/schemas/jobPosting.schema.ts` — 기존 xssValidation refine 패턴(`:71` title 참조) 그대로:

```ts
export const postingConditionsSchema = z
  .object({
    dressCode: z
      .string()
      .max(50)
      .refine(xssValidation, { message: 'Unsafe text is not allowed' })
      .optional(),
    experience: z
      .string()
      .max(50)
      .refine(xssValidation, { message: 'Unsafe text is not allowed' })
      .optional(),
  })
  .strict();
```

`jobPostingDocumentSchema`(:473-514)의 필드 목록에 `conditions: postingConditionsSchema.optional(),` 추가 (questions 필드 다음). strict 스키마라 이 한 줄이 없으면 insert가 죽는다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest src/schemas/__tests__/jobPosting.schema.test.ts --silent`
Expected: PASS (기존 케이스 포함 전건).

- [ ] **Step 5: 마이그레이션 파일 작성** — `supabase/migrations/20260714000000_job_postings_conditions.sql`:

```sql
-- 공고 모집 조건(복장·경력) — additive nullable, RLS 무변경
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS conditions jsonb;

COMMENT ON COLUMN public.job_postings.conditions IS
  '모집 조건 { dressCode?: string, experience?: string } — 키오스크 주문서에서 작성';
```

⚠️ prod 적용은 이 계획 범위 밖(배포 게이트에서 `mcp__supabase__apply_migration`으로 수행, 메모리 `feedback_supabase_migration_workflow`). 로컬 검증만:

Run: `npm run db:start && npx supabase db reset` (로컬 Docker 스택이 이미 떠 있으면 reset만)
Expected: reset 성공, `conditions` 컬럼 생성. (Docker 미가동 환경이면 이 스텝은 "로컬 스택 부재로 생략"을 커밋 메시지에 명기)

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/types/jobPosting.ts uniqn-mobile/src/schemas/jobPosting.schema.ts uniqn-mobile/src/schemas/__tests__/jobPosting.schema.test.ts supabase/migrations/20260714000000_job_postings_conditions.sql
git commit -m "feat(job-posting): 모집 조건(복장·경력) 타입·zod 계약·마이그레이션 추가"
```

---

### Task 2: 직렬화·어댑터에 conditions 통과 (own-property 가드)

새 필드가 draft→document→entity→draft 왕복에서 살아남게 한다. **#194(region 유실)의 교훈**: 매퍼는 화이트리스트 방식이라 4개 변환 지점 전부에 명시적으로 넣어야 하고, patch 병합은 own-property 가드(`Object.prototype.hasOwnProperty.call`)를 써야 "필드 없음"과 "undefined로 지우기"가 구분된다.

**Files:**
- Modify: `src/domains/job-posting/serialization.ts` (`serializeJobPostingV3` ~264행)
- Modify: `src/utils/job-posting/draftAdapter.ts` (`draftToCreateJobPostingInput` :506, `jobPostingToDraft` :705)
- Modify: `src/types/jobPostingDraft.ts` (JobPostingDraft에 필드 추가)
- Modify: `src/types/jobTemplate.ts` (`JobPostingTemplateData`, `extractTemplateData` :109, `templateToDraft` :147)
- Test: `src/domains/job-posting/__tests__/serialization.conditions.test.ts` (신규)

**Interfaces:**
- Consumes: Task 1의 `PostingConditions`, `postingConditionsSchema`.
- Produces: `JobPostingDraft.conditions?: PostingConditions`, `JobPostingTemplateData.conditions?: PostingConditions` — Task 4 매퍼가 사용.

- [ ] **Step 1: 실패하는 왕복 테스트 작성** — `src/domains/job-posting/__tests__/serialization.conditions.test.ts`:

기존 `serialization.region.test.ts`의 픽스처 구성 방식을 그대로 따라(동일 헬퍼/최소 input 재사용) 작성:

```ts
import { serializeJobPostingV3 } from '../serialization';
import { draftToCreateJobPostingInput, jobPostingToDraft } from '@/utils/job-posting/draftAdapter';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';

describe('conditions 직렬화 왕복', () => {
  const draftWithConditions = {
    ...INITIAL_JOB_POSTING_DRAFT,
    title: '주말 딜러 구합니다',
    location: { name: '라운더스 홀덤펍', address: '서울 강남구' },
    conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' },
  };

  it('draft→input→document에서 conditions가 보존된다', () => {
    const input = draftToCreateJobPostingInput(draftWithConditions);
    expect(input.conditions).toEqual({ dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' });
    const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
    expect(doc.conditions).toEqual({ dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' });
  });

  it('conditions 미설정 draft는 필드 자체가 생기지 않는다 (own-property 가드)', () => {
    const input = draftToCreateJobPostingInput({ ...INITIAL_JOB_POSTING_DRAFT, title: 't', location: { name: 'x' } });
    expect('conditions' in input).toBe(false);
  });
});
```

(`serializeJobPostingV3`의 실제 두 번째 인자 시그니처는 파일에서 확인 후 맞출 것 — 옵션 객체 형태가 다르면 기존 테스트 파일의 호출 형태를 복사.)

- [ ] **Step 2: 실패 확인**

Run: `npx jest serialization.conditions --silent`
Expected: FAIL — `input.conditions` undefined.

- [ ] **Step 3: 통과 구현 (4개 지점)**

1. `src/types/jobPostingDraft.ts` — `JobPostingDraft`에 `conditions?: PostingConditions;` 추가 (`questions` 다음), import 추가.
2. `draftAdapter.ts`의 `draftToCreateJobPostingInput`(:506) — 반환 객체 조립부에 조건부 스프레드 추가:

```ts
...(draft.conditions !== undefined ? { conditions: draft.conditions } : {}),
```

3. `draftAdapter.ts`의 `jobPostingToDraft`(:705) — 역방향에도 동일 패턴:

```ts
...(posting.conditions !== undefined ? { conditions: posting.conditions } : {}),
```

4. `serialization.ts`의 `serializeJobPostingV3` — document 조립부에 동일 조건부 스프레드. document TS 타입(`JobPostingDocumentV3` — `grep -n "JobPostingDocumentV3" src/domains/job-posting/`로 정의 위치 확인)에 `conditions?: PostingConditions;` 추가.
5. `src/types/jobTemplate.ts` — `JobPostingTemplateData`에 `conditions?: PostingConditions;` 추가. `extractTemplateData`(:109)와 `templateToDraft`(:147)에 동일 조건부 스프레드 (템플릿 저장/복원 시 조건 보존).

- [ ] **Step 4: 통과 + 기존 회귀 확인**

Run: `npx jest src/domains/job-posting src/utils/job-posting src/schemas --silent`
Expected: PASS 전건 (기존 serialization/draftAdapter 테스트 무회귀).

- [ ] **Step 5: 커밋**

```bash
git add -A uniqn-mobile/src
git commit -m "feat(job-posting): conditions 직렬화·어댑터·템플릿 왕복 통과 (own-property 가드)"
```

---

### Task 3: 용어 변경 — 지원/급구 라벨 + 복지 라벨

**Files:**
- Modify: `src/types/jobPostingForm.ts:49-73` (`POSTING_TYPE_INFO`)
- Modify: `src/components/employer/job-form/sections/SalarySection/AllowanceInput.tsx` (표시 제목 "수당"→"복지")
- Test: 문자열 참조 grep + 기존 jest

**Interfaces:**
- Produces: regular 라벨 "지원", urgent 라벨 "급구" — 이후 태스크의 세그먼트가 `POSTING_TYPE_INFO[type].label`을 그대로 사용.

- [ ] **Step 1: 라벨 변경**

`POSTING_TYPE_INFO`에서 regular의 `label: '일반'` → `'지원'`, urgent의 `label: '긴급'` → `'급구'`. value enum(`'regular'|'urgent'`)과 서버 값은 불변 — 표시 라벨만.

- [ ] **Step 2: 앱·e2e 전반의 라벨 문자열 의존 확인**

Run: `grep -rn "'일반'\|'긴급'\|\"일반\"\|\"긴급\"" src e2e --include="*.ts" --include="*.tsx" | grep -v node_modules`
각 히트를 열어 **공고 타입 라벨로 쓰인 곳만** 갱신(무관한 "일반" 단어는 건드리지 않음). e2e 스펙(`e2e/tests/p1-important/employer-posting-crud.spec.ts` 등)에서 타입 라벨 텍스트로 셀렉트하는 단언이 있으면 지원/급구로 교체.

- [ ] **Step 3: AllowanceInput 표시 제목 변경**

`AllowanceInput.tsx` 상단 렌더의 섹션 제목 텍스트 "수당" 계열 문자열을 "복지"로 변경 (`grep -n "수당" src/components/employer/job-form/sections/SalarySection/*.tsx`로 표시 문자열만 — 변수·주석의 도메인 용어는 유지 가능).

- [ ] **Step 4: 검증**

Run: `npx jest --silent && npm run type-check`
Expected: 전건 PASS, tsc 0 에러. 스냅샷/문자열 단언 실패가 있으면 라벨 변경 반영으로 갱신.

- [ ] **Step 5: 커밋**

```bash
git add -A uniqn-mobile/src uniqn-mobile/e2e
git commit -m "feat(ux): 공고 타입 라벨 지원·급구 변경 + 수당→복지 표기"
```

---

### Task 4: `OrderSheetValues` zod 스키마 + 매퍼 (신·구 동등성 테스트)

주문서 폼 상태의 계약. RHF가 이 타입을 들고, 매퍼가 canonical draft와 왕복한다.

**Files:**
- Create: `src/schemas/orderSheet.schema.ts`
- Create: `src/utils/order-sheet/mappers.ts`
- Test: `src/utils/order-sheet/__tests__/mappers.test.ts`

**Interfaces:**
- Consumes: `JobPostingDraft`(+conditions), `templateToDraft`, `buildGridPrefillDraft`, `draftToCreateJobPostingInput`, `PROVIDED_FLAG`.
- Produces (이후 UI 태스크 전부가 사용):

```ts
export type OrderSheetValues = z.infer<typeof orderSheetValuesSchema>;
export function valuesToDraft(values: OrderSheetValues): JobPostingDraft;
export function draftToValues(draft: JobPostingDraft): OrderSheetValues;      // dated 전용, fixed면 throw
export function templateToValues(template: JobPostingTemplate): OrderSheetValues; // 날짜 비움
export function gridParamsToValues(params: GridPrefillParams): OrderSheetValues;
export function valuesToCreateInput(values: OrderSheetValues): CreateJobPostingInput;
export const DEFAULT_SALARY_BY_TYPE = { hourly: 20000, daily: 200000, monthly: 2500000 } as const;
export const HOURLY_STEP = 1000;
```

- [ ] **Step 1: 스키마 작성** — `src/schemas/orderSheet.schema.ts`:

```ts
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import type { TaxSettings } from '@/types/jobPosting';
import type { PreQuestion } from '@/types/preQuestion';

const safeText = (max: number) =>
  z.string().max(max).refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

export const orderSheetRoleSchema = z.object({
  role: z.enum(['dealer', 'floor', 'serving', 'manager', 'staff', 'other']),
  customRole: safeText(20).optional(),
  count: z.number().int().min(1).max(99),
});

export const orderSheetTimeSlotSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '출근 시간을 선택해주세요'),
  roles: z.array(orderSheetRoleSchema).min(1, '역할을 추가해주세요'),
});

export const orderSheetLocationSchema = z.object({
  name: safeText(50).min(1, '장소를 선택해주세요'),
  address: safeText(200).optional(),
  district: safeText(50).optional(),
  region: z.string().optional(),
  detailedAddress: safeText(200).optional(),
});

export const orderSheetConditionsSchema = z.object({
  dressCode: safeText(50).optional(),
  experience: safeText(50).optional(),
});

export const orderSheetValuesSchema = z.object({
  postingType: z.enum(['regular', 'urgent']),
  title: safeText(25).min(1, '제목을 입력해주세요'),
  location: orderSheetLocationSchema.nullable().refine((v) => v !== null, '장소를 선택해주세요'),
  contactPhone: safeText(20).min(1, '연락처를 입력해주세요'),
  description: safeText(500).default(''),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, '날짜를 선택해주세요'),
  timeSlots: z.array(orderSheetTimeSlotSchema).min(1, '시간대를 추가해주세요'),
  salary: z.object({
    type: z.enum(['hourly', 'daily', 'monthly']),
    amount: z.number().int().positive('급여를 입력해주세요'),
  }),
  useSameSalary: z.boolean().default(true),
  allowances: z
    .object({
      guaranteedHours: z.number().optional(),
      meal: z.number().optional(),
      transportation: z.number().optional(),
      accommodation: z.number().optional(),
    })
    .default({}),
  taxSettings: z.custom<TaxSettings>().optional(),
  conditions: orderSheetConditionsSchema.default({}),
  usesPreQuestions: z.boolean().default(false),
  preQuestions: z.array(z.custom<PreQuestion>()).default([]),
  venueId: z.string().uuid().optional(),
});

export type OrderSheetValues = z.infer<typeof orderSheetValuesSchema>;
```

- [ ] **Step 2: 실패하는 매퍼 테스트 작성** — `src/utils/order-sheet/__tests__/mappers.test.ts`:

```ts
import {
  valuesToDraft, draftToValues, templateToValues, gridParamsToValues,
  valuesToCreateInput, DEFAULT_SALARY_BY_TYPE,
} from '../mappers';
import { buildCreateJobPostingInput } from '@/utils/job-posting/submission';
import { buildGridPrefillDraft } from '@/utils/job-posting/gridPrefill';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

const baseValues: OrderSheetValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  dates: ['2026-07-14', '2026-07-15'],
  timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }, { role: 'serving', count: 1 }] }],
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  allowances: { meal: -1, transportation: 10000 },
  conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' },
  usesPreQuestions: false,
  preQuestions: [],
};

describe('valuesToDraft', () => {
  it('dated 스케줄을 canonical하게 만든다 (날짜별 requirements, 시간대·역할 보존)', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.schedule.kind).toBe('dated');
    if (draft.schedule.kind !== 'dated') return;
    expect(draft.schedule.allDates).toEqual(['2026-07-14', '2026-07-15']);
    expect(draft.schedule.primaryDate).toBe('2026-07-14');
    expect(draft.schedule.requirements).toHaveLength(2);
    expect(draft.schedule.requirements[0]?.timeSlots[0]?.roles).toEqual([
      { role: 'dealer', count: 2 }, { role: 'serving', count: 1 },
    ]);
  });
  it('동일급여면 compensation.mode=shared + defaultSalary', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.compensation.mode).toBe('shared');
    expect(draft.compensation.defaultSalary).toEqual({ type: 'hourly', amount: 20000 });
  });
  it('roleCatalog는 슬롯 역할의 중복 제거 합집합', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.roleCatalog.map((r) => r.role).sort()).toEqual(['dealer', 'serving']);
  });
  it('conditions·allowances(-1 제공 플래그 포함)를 보존한다', () => {
    const draft = valuesToDraft(baseValues);
    expect(draft.conditions).toEqual(baseValues.conditions);
    expect(draft.compensation.allowances).toEqual({ meal: -1, transportation: 10000 });
  });
});

describe('draftToValues ↔ valuesToDraft 왕복', () => {
  it('values→draft→values가 동치다', () => {
    const roundTrip = draftToValues(valuesToDraft(baseValues));
    expect(roundTrip).toEqual(baseValues);
  });
  it('fixed 스케줄 draft는 throw한다 (키오스크 범위 밖)', () => {
    const fixedDraft = { ...INITIAL_JOB_POSTING_DRAFT, schedule: { kind: 'fixed' as const, requirements: [] } };
    expect(() => draftToValues(fixedDraft)).toThrow();
  });
});

describe('신·구 동등성', () => {
  it('valuesToCreateInput == buildCreateJobPostingInput(valuesToDraft(v))', () => {
    expect(valuesToCreateInput(baseValues)).toEqual(buildCreateJobPostingInput(valuesToDraft(baseValues)));
  });
});

describe('gridParamsToValues', () => {
  it('그리드 프리필 파라미터가 기존 buildGridPrefillDraft 경유로 흡수된다', () => {
    const params = { venueId: '00000000-0000-4000-8000-000000000001', date: '2026-07-20', count: 3 };
    const values = gridParamsToValues(params);
    expect(values.venueId).toBe(params.venueId);
    expect(values.dates).toEqual(['2026-07-20']);
    // 기존 프리필과 동일한 draft가 되는지 (동등성)
    expect(valuesToDraft(values)).toEqual(
      expect.objectContaining({ venueId: params.venueId })
    );
  });
  it('파라미터 없으면 venueId 키 자체가 없다 (#gridPrefill 무회귀 계약)', () => {
    const values = gridParamsToValues({});
    expect('venueId' in valuesToDraft(values) && valuesToDraft(values).venueId !== undefined).toBe(false);
  });
});

describe('templateToValues', () => {
  it('템플릿 로드 시 날짜는 비운다', () => {
    const template = {
      id: 't1', userId: 'u1', name: '주말 딜러', description: null,
      createdAt: null, updatedAt: null, usageCount: 0,
      templateData: { title: '주말 딜러 구합니다', compensation: { mode: 'shared' as const, defaultSalary: { type: 'hourly' as const, amount: 20000 } } },
    };
    const values = templateToValues(template);
    expect(values.dates).toEqual([]);
    expect(values.title).toBe('주말 딜러 구합니다');
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx jest src/utils/order-sheet --silent`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: 매퍼 구현** — `src/utils/order-sheet/mappers.ts`:

```ts
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { CreateJobPostingInput, PostingRoleCatalogEntry, PostingTimeSlot } from '@/types/jobPosting';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { JobPostingTemplate } from '@/types/jobTemplate';
import { templateToDraft } from '@/types/jobTemplate';
import { draftToCreateJobPostingInput } from '@/utils/job-posting/draftAdapter';
import { buildGridPrefillDraft, type GridPrefillParams } from '@/utils/job-posting/gridPrefill';

export const DEFAULT_SALARY_BY_TYPE = { hourly: 20000, daily: 200000, monthly: 2500000 } as const;
export const HOURLY_STEP = 1000;

function toPostingTimeSlots(values: OrderSheetValues): PostingTimeSlot[] {
  return values.timeSlots.map((slot) => ({
    startTime: slot.startTime,
    roles: slot.roles.map((r) => ({
      role: r.role,
      ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    })),
  }));
}

function toRoleCatalog(values: OrderSheetValues): PostingRoleCatalogEntry[] {
  const seen = new Map<string, PostingRoleCatalogEntry>();
  for (const slot of values.timeSlots) {
    for (const r of slot.roles) {
      const key = r.role === 'other' ? `other:${r.customRole ?? ''}` : r.role;
      if (!seen.has(key)) {
        seen.set(key, {
          role: r.role,
          ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
        });
      }
    }
  }
  return [...seen.values()];
}

export function valuesToDraft(values: OrderSheetValues): JobPostingDraft {
  const timeSlots = toPostingTimeSlots(values);
  return {
    ...INITIAL_JOB_POSTING_DRAFT,
    postingType: values.postingType,
    title: values.title,
    description: values.description,
    location: values.location,
    contactPhone: values.contactPhone,
    tags: [],
    ...(values.venueId !== undefined ? { venueId: values.venueId } : {}),
    schedule: {
      kind: 'dated',
      primaryDate: values.dates[0] ?? '',
      allDates: [...values.dates],
      requirements: values.dates.map((date) => ({ date, timeSlots })),
      templateTimeSlots: timeSlots,
    },
    roleCatalog: toRoleCatalog(values),
    compensation: {
      mode: values.useSameSalary ? 'shared' : 'by_role',
      defaultSalary: values.salary,
      ...(Object.keys(values.allowances).length > 0 ? { allowances: values.allowances } : {}),
      ...(values.taxSettings !== undefined ? { taxSettings: values.taxSettings } : {}),
    },
    questions: { items: values.usesPreQuestions ? values.preQuestions : [] },
    ...(values.conditions.dressCode !== undefined || values.conditions.experience !== undefined
      ? { conditions: values.conditions }
      : {}),
  };
}

export function draftToValues(draft: JobPostingDraft): OrderSheetValues {
  if (draft.schedule.kind !== 'dated') {
    throw new Error('주문서는 dated 스케줄(지원·급구)만 지원합니다');
  }
  const firstSlots = draft.schedule.requirements[0]?.timeSlots ?? draft.schedule.templateTimeSlots ?? [];
  const salaryType = draft.compensation.defaultSalary?.type;
  return {
    postingType: draft.postingType === 'urgent' ? 'urgent' : 'regular',
    title: draft.title,
    location: draft.location,
    contactPhone: draft.contactPhone,
    description: draft.description,
    dates: [...draft.schedule.allDates],
    timeSlots: firstSlots.map((slot) => ({
      startTime: slot.startTime ?? '',
      roles: slot.roles.map((r) => ({
        role: r.role ?? 'other',
        ...(r.customRole !== undefined ? { customRole: r.customRole } : {}),
        count: r.count,
      })),
    })),
    salary: {
      type: salaryType === 'daily' || salaryType === 'monthly' ? salaryType : 'hourly',
      amount: draft.compensation.defaultSalary?.amount ?? DEFAULT_SALARY_BY_TYPE.hourly,
    },
    useSameSalary: draft.compensation.mode === 'shared',
    allowances: { ...(draft.compensation.allowances ?? {}) },
    ...(draft.compensation.taxSettings !== undefined ? { taxSettings: draft.compensation.taxSettings } : {}),
    conditions: { ...(draft.conditions ?? {}) },
    usesPreQuestions: draft.questions.items.length > 0,
    preQuestions: [...draft.questions.items],
    ...(draft.venueId !== undefined ? { venueId: draft.venueId } : {}),
  };
}

export function templateToValues(template: JobPostingTemplate): OrderSheetValues {
  const values = draftToValues(templateToDraft(template));
  return { ...values, dates: [] };
}

export function gridParamsToValues(params: GridPrefillParams): OrderSheetValues {
  return draftToValues(buildGridPrefillDraft(params));
}

export function valuesToCreateInput(values: OrderSheetValues): CreateJobPostingInput {
  return draftToCreateJobPostingInput(valuesToDraft(values));
}
```

⚠️ 왕복 테스트가 안 맞으면 **테스트를 완화하지 말고** 매퍼를 고친다. `draftToValues(valuesToDraft(v)) ≠ v`인 필드는 필드별 매핑 누락이다. `templateToDraft`가 legacy 필드를 흡수하며 기본값을 채우는 경우(예: description '' vs undefined)만 normalize를 values 쪽 기본값에 맞춘다.

- [ ] **Step 5: 통과 확인**

Run: `npx jest src/utils/order-sheet --silent`
Expected: PASS 전건.

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/schemas/orderSheet.schema.ts uniqn-mobile/src/utils/order-sheet
git commit -m "feat(order-sheet): OrderSheetValues zod 스키마 + canonical 매퍼 (신구 동등성 테스트)"
```

---

### Task 5: 주문서 행 메타(순수 로직) + 프레임 컴포넌트 + create.tsx 분기

**Files:**
- Create: `src/components/employer/order-sheet/orderRowMeta.ts` (순수 함수 — jest 대상)
- Create: `src/components/employer/order-sheet/OrderRow.tsx`, `OrderGroup.tsx`, `TypeSegment.tsx`
- Create: `src/components/employer/order-sheet/OrderSheetScreen.tsx`
- Modify: `app/(employer)/my-postings/create.tsx`
- Test: `src/components/employer/order-sheet/__tests__/orderRowMeta.test.ts`

**Interfaces:**
- Consumes: Task 4의 `OrderSheetValues`, `orderSheetValuesSchema`, 매퍼들.
- Produces:

```ts
// orderRowMeta.ts
export type OrderRowKey =
  | 'title' | 'place' | 'contact' | 'description'
  | 'dates' | 'time' | 'roles'
  | 'salary' | 'welfare' | 'tax'
  | 'conditions' | 'preQuestions';
export interface OrderRowState { label: string; value: string; unset: boolean; optional: boolean; }
export function getRowState(values: OrderSheetValues, key: OrderRowKey): OrderRowState;
export function firstUnsetRow(values: OrderSheetValues): OrderRowKey | null;  // 필수 행만, 그룹 순서대로
export const ORDER_GROUPS: ReadonlyArray<{ title: string; rows: OrderRowKey[] }>;
// OrderSheetScreen.tsx
export function OrderSheetScreen(props: {
  initialValues: OrderSheetValues;
  onSubmit: (values: OrderSheetValues) => Promise<void>;
  isSubmitting: boolean;
  onSwitchToLegacyForm: (type: 'fixed' | 'tournament') => void;
}): React.JSX.Element;
```

- [ ] **Step 1: 실패하는 orderRowMeta 테스트 작성** — `__tests__/orderRowMeta.test.ts`:

```ts
import { getRowState, firstUnsetRow, ORDER_GROUPS } from '../orderRowMeta';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

const emptyValues: OrderSheetValues = {
  postingType: 'regular', title: '', location: null, contactPhone: '010-1234-5678',
  description: '', dates: [], timeSlots: [], salary: { type: 'hourly', amount: 0 },
  useSameSalary: true, allowances: {}, conditions: {}, usesPreQuestions: false, preQuestions: [],
};
const filled: OrderSheetValues = {
  ...emptyValues, title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍' }, dates: ['2026-07-14'],
  timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
  salary: { type: 'hourly', amount: 20000 },
};

describe('ORDER_GROUPS', () => {
  it('그룹 순서 = 기본정보 → 일정·모집 → 급여 → 조건 → 사전질문', () => {
    expect(ORDER_GROUPS.map((g) => g.title)).toEqual(['기본 정보', '일정 · 모집', '급여', '조건', '사전질문']);
  });
});

describe('getRowState', () => {
  it('필수 미입력 행은 unset=true', () => {
    expect(getRowState(emptyValues, 'title').unset).toBe(true);
    expect(getRowState(emptyValues, 'dates').unset).toBe(true);
  });
  it('선택 행은 값 없어도 unset=false, value="없음"', () => {
    const s = getRowState(emptyValues, 'welfare');
    expect(s.unset).toBe(false);
    expect(s.value).toBe('없음');
    expect(s.optional).toBe(true);
  });
  it('역할 요약은 "딜러 2" 형식으로 합산 표기', () => {
    expect(getRowState(filled, 'roles').value).toBe('딜러 2');
  });
  it('시간 요약은 "출근 19:00"', () => {
    expect(getRowState(filled, 'time').value).toBe('출근 19:00');
  });
  it('연락처는 프로필 프리필이 있으면 unset=false', () => {
    expect(getRowState(emptyValues, 'contact').unset).toBe(false);
  });
});

describe('firstUnsetRow', () => {
  it('빈 값이면 그룹 순서상 첫 필수 행(title)', () => {
    expect(firstUnsetRow(emptyValues)).toBe('title');
  });
  it('전부 채우면 null', () => {
    expect(firstUnsetRow(filled)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx jest orderRowMeta --silent` → FAIL(모듈 없음).

- [ ] **Step 3: orderRowMeta 구현**

```ts
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import { STAFF_ROLES } from '@/constants/jobPosting';
import { PROVIDED_FLAG } from '@/utils/settlement';

export type OrderRowKey =
  | 'title' | 'place' | 'contact' | 'description'
  | 'dates' | 'time' | 'roles'
  | 'salary' | 'welfare' | 'tax'
  | 'conditions' | 'preQuestions';

export interface OrderRowState { label: string; value: string; unset: boolean; optional: boolean; }

export const ORDER_GROUPS = [
  { title: '기본 정보', rows: ['title', 'place', 'contact', 'description'] },
  { title: '일정 · 모집', rows: ['dates', 'time', 'roles'] },
  { title: '급여', rows: ['salary', 'welfare', 'tax'] },
  { title: '조건', rows: ['conditions'] },
  { title: '사전질문', rows: ['preQuestions'] },
] as const satisfies ReadonlyArray<{ title: string; rows: readonly OrderRowKey[] }>;

const SALARY_TYPE_LABEL = { hourly: '시급', daily: '일급', monthly: '월급' } as const;
const WELFARE_LABEL = { guaranteedHours: '보장시간', meal: '식사', transportation: '교통', accommodation: '숙소' } as const;

const roleName = (role: string, customRole?: string) =>
  role === 'other' ? (customRole ?? '기타') : (STAFF_ROLES.find((r) => r.key === role)?.name ?? role);

function summarizeRoles(values: OrderSheetValues): string {
  const totals = new Map<string, number>();
  for (const slot of values.timeSlots) {
    for (const r of slot.roles) {
      const name = roleName(r.role, r.customRole);
      totals.set(name, (totals.get(name) ?? 0) + r.count);
    }
  }
  return [...totals.entries()].map(([name, count]) => `${name} ${count}`).join(' · ');
}

function summarizeWelfare(values: OrderSheetValues): string {
  const parts = Object.entries(values.allowances)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const label = WELFARE_LABEL[k as keyof typeof WELFARE_LABEL] ?? k;
      return v === PROVIDED_FLAG ? label : `${label} ${Number(v).toLocaleString()}`;
    });
  return parts.length > 0 ? parts.join(' · ') : '없음';
}

export function getRowState(values: OrderSheetValues, key: OrderRowKey): OrderRowState {
  switch (key) {
    case 'title':
      return { label: '제목', value: values.title, unset: values.title.length === 0, optional: false };
    case 'place':
      return { label: '장소', value: values.location?.name ?? '', unset: values.location === null, optional: false };
    case 'contact':
      return { label: '연락처', value: values.contactPhone, unset: values.contactPhone.length === 0, optional: false };
    case 'description':
      return { label: '설명', value: values.description || '없음', unset: false, optional: true };
    case 'dates':
      return { label: '날짜', value: values.dates.join(', '), unset: values.dates.length === 0, optional: false };
    case 'time': {
      const starts = values.timeSlots.map((s) => s.startTime).filter(Boolean);
      return { label: '시간', value: starts.length > 0 ? `출근 ${starts.join(' · ')}` : '', unset: starts.length === 0, optional: false };
    }
    case 'roles': {
      const summary = summarizeRoles(values);
      return { label: '역할', value: summary, unset: summary.length === 0, optional: false };
    }
    case 'salary': {
      const { type, amount } = values.salary;
      return {
        label: '급여',
        value: amount > 0 ? `${SALARY_TYPE_LABEL[type]} ${amount.toLocaleString()}원` : '',
        unset: amount <= 0, optional: false,
      };
    }
    case 'welfare':
      return { label: '복지', value: summarizeWelfare(values), unset: false, optional: true };
    case 'tax': {
      const t = values.taxSettings;
      const value = t === undefined || t.type === 'none' ? '세금 없음'
        : t.type === 'rate' ? `원천징수 ${t.value}%` : `정액 ${t.value.toLocaleString()}원`;
      return { label: '세금', value, unset: false, optional: true };
    }
    case 'conditions': {
      const parts = [values.conditions.dressCode, values.conditions.experience].filter(Boolean);
      return { label: '조건', value: parts.length > 0 ? parts.join(' · ') : '없음', unset: false, optional: true };
    }
    case 'preQuestions':
      return {
        label: '사전질문',
        value: values.usesPreQuestions && values.preQuestions.length > 0 ? `${values.preQuestions.length}개` : '없음',
        unset: false, optional: true,
      };
  }
}

export function firstUnsetRow(values: OrderSheetValues): OrderRowKey | null {
  for (const group of ORDER_GROUPS) {
    for (const key of group.rows) {
      const state = getRowState(values, key);
      if (!state.optional && state.unset) return key;
    }
  }
  return null;
}
```

- [ ] **Step 4: 통과 확인** — `npx jest orderRowMeta --silent` → PASS.

- [ ] **Step 5: 프레임 컴포넌트 구현** (스타일은 TaxSettingsEditor.tsx:198-230의 세그먼트 패턴 + `dark:` 필수)

`TypeSegment.tsx` — 4타입 세그먼트, `POSTING_TYPE_INFO[type].label` 사용:

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { POSTING_TYPE_INFO } from '@/types/jobPostingForm';
import type { PostingType } from '@/types/jobPosting';

const TYPES: PostingType[] = ['regular', 'urgent', 'fixed', 'tournament'];

export function TypeSegment({ value, onChange }: { value: 'regular' | 'urgent'; onChange: (t: PostingType) => void }) {
  return (
    <View className="flex-row gap-1 p-1 rounded-xl bg-surface-card border border-secondary-200 dark:border-surface-overlay">
      {TYPES.map((t) => {
        const selected = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            className={`flex-1 items-center py-2 rounded-lg ${selected ? 'bg-primary-100 border border-primary-500' : 'active:opacity-80'}`}
            accessibilityRole="button"
            testID={`order-sheet-type-${t}`}
          >
            <Text className={`text-sm font-sans-medium ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-700 dark:text-secondary-300'}`}>
              {POSTING_TYPE_INFO[t].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

`OrderRow.tsx` — 행 1개(라벨/값/미설정 배지/셰브런):

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { OrderRowState } from './orderRowMeta';

export function OrderRow({ state, error, onPress, testID }: {
  state: OrderRowState; error?: string; onPress: () => void; testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 border-b border-secondary-100 dark:border-surface-overlay last:border-b-0 active:opacity-80"
      accessibilityRole="button"
      testID={testID}
    >
      <Text className="w-16 text-xs text-content-secondary font-sans">{state.label}</Text>
      {state.unset ? (
        <View className="px-2 py-0.5 rounded-full bg-warning-100">
          <Text className="text-[11px] font-sans-medium text-warning-700">미설정</Text>
        </View>
      ) : (
        <Text
          className={`flex-1 text-sm font-sans-medium ${state.value === '없음' ? 'text-content-muted' : 'text-content-primary'}`}
          numberOfLines={1}
        >
          {state.value}
        </Text>
      )}
      {error ? <Text className="text-[11px] text-error-500 font-sans mr-1">{error}</Text> : null}
      <Text className="text-content-muted">›</Text>
    </Pressable>
  );
}
```

(`error` 표기용 시맨틱 컬러 클래스는 프로젝트 기존 error/warning 토큰 클래스명을 grep으로 확인해 맞춘다: `grep -rn "text-error\|text-warning" src/components/ui | head -5`.)

`OrderGroup.tsx` — 그룹 라벨 + 카드:

```tsx
import React from 'react';
import { Text, View } from 'react-native';

export function OrderGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-[11px] font-sans-bold tracking-wide text-content-secondary mb-1.5 ml-1">{title}</Text>
      <View className="rounded-2xl bg-surface-card border border-secondary-100 dark:border-surface-overlay overflow-hidden">
        {children}
      </View>
    </View>
  );
}
```

`OrderSheetScreen.tsx` — RHF 컨테이너. 시트 열림 상태는 `useState<OrderRowKey | null>` 하나로 관리(시트 컴포넌트는 Task 6~8에서 채움 — 이번 태스크에서는 `activeSheet` 스위치만 두고 시트 자리에 `null` 반환 placeholder 없이, 아직 없는 시트는 케이스 자체를 추가하지 않는다):

```tsx
import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { orderSheetValuesSchema, type OrderSheetValues } from '@/schemas/orderSheet.schema';
import { ORDER_GROUPS, firstUnsetRow, getRowState, type OrderRowKey } from './orderRowMeta';
import { OrderGroup } from './OrderGroup';
import { OrderRow } from './OrderRow';
import { TypeSegment } from './TypeSegment';
import type { PostingType } from '@/types/jobPosting';

export interface OrderSheetScreenProps {
  initialValues: OrderSheetValues;
  onSubmit: (values: OrderSheetValues) => Promise<void>;
  isSubmitting: boolean;
  onSwitchToLegacyForm: (type: 'fixed' | 'tournament') => void;
  headerSlot?: React.ReactNode; // Task 9 프리셋 캐러셀 자리
}

export function OrderSheetScreen({ initialValues, onSubmit, isSubmitting, onSwitchToLegacyForm, headerSlot }: OrderSheetScreenProps) {
  const form = useForm<OrderSheetValues>({
    resolver: zodResolver(orderSheetValuesSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });
  const values = form.watch();
  const [activeSheet, setActiveSheet] = useState<OrderRowKey | null>(null);

  const handleTypeChange = useCallback((t: PostingType) => {
    if (t === 'fixed' || t === 'tournament') {
      onSwitchToLegacyForm(t);
      return;
    }
    form.setValue('postingType', t, { shouldDirty: true });
  }, [form, onSwitchToLegacyForm]);

  const handleSubmitPress = form.handleSubmit(
    (valid) => onSubmit(valid),
    () => {
      const next = firstUnsetRow(values);
      if (next !== null) setActiveSheet(next); // 미설정 순차 유도
    }
  );

  const unsetKey = firstUnsetRow(values);
  const submitLabel = unsetKey === null
    ? '이대로 등록'
    : `${getRowState(values, unsetKey).label}부터 ${unsetKey === 'title' ? '입력' : '선택'}하기`;

  return (
    <View className="flex-1 bg-surface-page">
      <ScrollView className="flex-1 px-4 pt-3" contentContainerClassName="pb-28">
        {headerSlot}
        <View className="mb-3"><TypeSegment value={values.postingType} onChange={handleTypeChange} /></View>
        {ORDER_GROUPS.map((group) => (
          <OrderGroup key={group.title} title={group.title}>
            {group.rows.map((key) => (
              <OrderRow
                key={key}
                state={getRowState(values, key)}
                onPress={() => setActiveSheet(key)}
                testID={`order-sheet-row-${key}`}
              />
            ))}
          </OrderGroup>
        ))}
      </ScrollView>
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-surface-page">
        <Button
          onPress={handleSubmitPress}
          disabled={isSubmitting}
          loading={isSubmitting}
          testID="job-posting-create-submit"
        >
          {submitLabel}
        </Button>
      </View>
      {/* 시트들: Task 6~8에서 activeSheet 스위치로 장착 */}
    </View>
  );
}
```

(공용 `Button` 컴포넌트의 실제 props는 `grep -n "interface ButtonProps" src/components/ui/Button.tsx`로 확인해 `loading`/`disabled` 명칭을 맞춘다. 없으면 기존 create 화면의 제출 버튼 마크업을 재사용.)

- [ ] **Step 6: create.tsx 분기 배선** — `app/(employer)/my-postings/create.tsx` 수정:

기존 draft/useState/JobPostingScrollForm 경로는 **유지**하고, 최상단에 모드 분기를 추가한다:

```tsx
// 추가 파라미터: mode=full 이면 기존 상세폼 (주문서 유형 세그먼트에서 고정·대회 선택 시 진입)
const [legacyType, setLegacyType] = useState<'fixed' | 'tournament' | null>(null);
const isLegacyForm = legacyType !== null;

// 주문서 초기값: 그리드 프리필 흡수 (파라미터 없으면 안전 기본값)
const initialValues = useMemo(
  () => gridParamsToValues({ venueId, date: prefillDate, count: prefillCount }),
  [venueId, prefillDate, prefillCount]
);

const handleOrderSheetSubmit = useCallback(async (values: OrderSheetValues) => {
  const input = valuesToCreateInput(values);
  const created = await createJobPosting.mutateAsync({ input });
  setIsDirty(false);
  // 성공 네비게이션은 Task 10에서 완료 화면으로 교체 — 그 전까지 기존 로직 유지
  if (venueId && router.canGoBack()) router.back();
  else router.replace('/(app)/(tabs)/employer');
}, [createJobPosting, venueId, router]);

if (!isLegacyForm) {
  return (
    <OrderSheetScreen
      initialValues={initialValues}
      onSubmit={handleOrderSheetSubmit}
      isSubmitting={createJobPosting.isPending}
      onSwitchToLegacyForm={(t) => { setLegacyType(t); updateFormData({ postingType: t }); }}
    />
  );
}
// 이하 기존 JobPostingScrollForm 렌더 (고정·대회 전용) — postingType 초기값을 legacyType으로
```

에러 토스트·`useUnsavedChangesGuard(isDirty)`는 기존 패턴 그대로 재사용(주문서에서는 `form.formState.isDirty`를 상위로 끌어올려 guard에 연결: `onDirtyChange` 콜백 또는 `useEffect`로 `setIsDirty` 동기화).

- [ ] **Step 7: 검증**

Run: `npm run type-check && npx jest orderRowMeta src/utils/order-sheet --silent`
Expected: tsc 0 에러, jest PASS.
Run: `npx eslint src/components/employer/order-sheet app/\(employer\)/my-postings/create.tsx`
Expected: 0 에러.

- [ ] **Step 8: 커밋**

```bash
git add -A uniqn-mobile/src/components/employer/order-sheet uniqn-mobile/app
git commit -m "feat(order-sheet): 주문서 프레임(세그먼트·그룹·행·순차유도) + create 분기"
```

---

### Task 6: 기본정보 시트 4종 — 제목·장소·연락처·설명

**Files:**
- Create: `src/components/employer/order-sheet/sheets/TitleSheet.tsx`, `PlaceSheet.tsx`, `ContactSheet.tsx`, `DescriptionSheet.tsx`
- Modify: `OrderSheetScreen.tsx` (activeSheet 스위치에 4종 장착)

**Interfaces:**
- Consumes: `SheetModal`(`@/components/ui/SheetModal`), RHF `form`(부모에서 값·setValue 전달).
- Produces — 시트 공통 계약 (이후 시트 전부 동일):

```ts
interface RowSheetProps<T> {
  visible: boolean;
  value: T;
  onConfirm: (next: T) => void; // 부모가 form.setValue(..., { shouldDirty: true, shouldValidate: true })
  onClose: () => void;
}
```

- [ ] **Step 1: TitleSheet** — 텍스트 입력(25자 카운터) + 최근 제목 칩:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';

export function TitleSheet({ visible, value, recentTitles, onConfirm, onClose }: {
  visible: boolean; value: string; recentTitles: string[];
  onConfirm: (next: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => { if (visible) setText(value); }, [visible, value]);
  return (
    <SheetModal visible={visible} onClose={onClose} title="공고 제목"
      footer={<Button onPress={() => { onConfirm(text.trim()); onClose(); }} disabled={text.trim().length === 0}>확인</Button>}>
      <TextInput
        value={text} onChangeText={setText} maxLength={25} autoFocus
        placeholder="예: 주말 딜러 구합니다"
        className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary"
        testID="order-sheet-title-input"
      />
      <Text className="text-xs text-content-muted mt-1 mb-3 text-right font-sans">{text.length}/25</Text>
      {recentTitles.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {recentTitles.map((t) => (
            <Pressable key={t} onPress={() => setText(t)}
              className="px-3 py-1.5 rounded-full border border-secondary-200 dark:border-surface-overlay active:opacity-80">
              <Text className="text-xs text-content-secondary font-sans">{t}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </SheetModal>
  );
}
```

`recentTitles`는 부모(OrderSheetScreen)가 프리셋(Task 9)의 템플릿 title들에서 전달 — Task 9 전까지는 `[]`.

- [ ] **Step 2: PlaceSheet** — 최근 장소 라디오 리스트 + 새 장소 입력 전환:

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { RegionSelectModal } from '@/components/employer/job-form/modals/RegionSelectModal';
import type { PostingLocation } from '@/types/jobPosting';

export function PlaceSheet({ visible, value, recentLocations, onConfirm, onClose }: {
  visible: boolean; value: PostingLocation | null; recentLocations: PostingLocation[];
  onConfirm: (next: PostingLocation) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [draft, setDraft] = useState<PostingLocation>({ name: '' });
  const [showRegion, setShowRegion] = useState(false);
  useEffect(() => { if (visible) { setMode(recentLocations.length > 0 ? 'list' : 'new'); setDraft(value ?? { name: '' }); } }, [visible, value, recentLocations.length]);

  return (
    <SheetModal visible={visible} onClose={onClose} title="어디서 일하나요?"
      footer={mode === 'new'
        ? <Button onPress={() => { onConfirm(draft); onClose(); }} disabled={draft.name.trim().length === 0}>확인</Button>
        : undefined}>
      {mode === 'list' ? (
        <View className="gap-2">
          {recentLocations.map((loc) => (
            <Pressable key={`${loc.name}:${loc.address ?? ''}`} onPress={() => { onConfirm(loc); onClose(); }}
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 active:opacity-80">
              <Text className="text-sm font-sans-medium text-content-primary">{loc.name}</Text>
              {loc.address ? <Text className="text-xs text-content-muted font-sans">{loc.address}</Text> : null}
            </Pressable>
          ))}
          <Pressable onPress={() => setMode('new')}
            className="rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 items-center active:opacity-80">
            <Text className="text-sm text-content-secondary font-sans">＋ 새 장소 입력</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-2">
          <TextInput value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} maxLength={50}
            placeholder="장소명 (예: 라운더스 홀덤펍)" testID="order-sheet-place-name"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary" />
          <TextInput value={draft.address ?? ''} onChangeText={(address) => setDraft((d) => ({ ...d, address }))} maxLength={200}
            placeholder="주소"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary" />
          <Pressable onPress={() => setShowRegion(true)}
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 active:opacity-80">
            <Text className="text-sm text-content-primary font-sans">{draft.region ? `지역: ${draft.region}` : '지역 선택 (선택)'}</Text>
          </Pressable>
        </View>
      )}
      <RegionSelectModal visible={showRegion} onClose={() => setShowRegion(false)}
        selectedSlug={draft.region}
        onSelect={(slug) => { setDraft((d) => ({ ...d, ...(slug !== null ? { region: slug } : {}) })); setShowRegion(false); }} />
    </SheetModal>
  );
}
```

`recentLocations`는 부모가 계산: 템플릿들의 `templateData.location` + 현재 값 — 중복 제거(name+address 키). ⚠️ RegionSelectModal이 자체 RN Modal이면 SheetModal 내 중첩 문제 발생 가능 — 실기기/웹에서 겹침 확인 후 문제 시 SheetModal `overlay` 슬롯으로 이동(TimeWheelPicker embedded와 동일 요령).

- [ ] **Step 3: ContactSheet + DescriptionSheet** — 동일 패턴:

ContactSheet: 라디오 2개(내 프로필 번호 — 부모가 `user.phone` 전달 / 다른 번호 입력 TextInput(전화 keyboardType)). DescriptionSheet: multiline TextInput(500자 카운터) — 두 파일 모두 TitleSheet 골격 복사 후 입력부만 교체(코드 동형이라 생략 없이 각 파일 작성).

- [ ] **Step 4: OrderSheetScreen에 장착**

```tsx
{activeSheet === 'title' && (
  <TitleSheet visible value={values.title} recentTitles={recentTitles}
    onConfirm={(v) => form.setValue('title', v, { shouldDirty: true, shouldValidate: true })}
    onClose={() => setActiveSheet(null)} />
)}
{activeSheet === 'place' && (
  <PlaceSheet visible value={values.location} recentLocations={recentLocations}
    onConfirm={(v) => form.setValue('location', v, { shouldDirty: true, shouldValidate: true })}
    onClose={() => setActiveSheet(null)} />
)}
/* contact, description 동형 */
```

- [ ] **Step 5: 검증 + 커밋**

Run: `npm run type-check && npx eslint src/components/employer/order-sheet`
Expected: 0 에러.

```bash
git add -A uniqn-mobile/src/components/employer/order-sheet
git commit -m "feat(order-sheet): 기본정보 시트 4종 (제목·장소·연락처·설명)"
```

---

### Task 7: 일정·모집 시트 3종 — 날짜·시간(다중 시간대)·역할(다역할+기타 직접입력)

**Files:**
- Create: `sheets/DateSheet.tsx`, `sheets/TimeSlotsSheet.tsx`, `sheets/RolesSheet.tsx`
- Modify: `OrderSheetScreen.tsx` (장착)

**Interfaces:**
- Consumes: `DatePickerModal`(기존 — visible/onClose/onSelectDates/postingType/existingDates), `TimeWheelPicker`(기존 — embedded), `STAFF_ROLES`.
- Produces: `OrderSheetValues['timeSlots']` 편집 계약 — RolesSheet는 `slotIndex`를 받아 해당 슬롯의 roles만 편집.

- [ ] **Step 1: DateSheet — 기존 DatePickerModal 직접 재사용 (래퍼 불필요)**

DatePickerModal은 이미 독립 모달이므로 시트를 새로 만들지 않고 OrderSheetScreen 스위치에서 직접 렌더:

```tsx
{activeSheet === 'dates' && (
  <DatePickerModal visible onClose={() => setActiveSheet(null)}
    postingType={values.postingType} existingDates={values.dates}
    onSelectDates={(dates) => {
      form.setValue('dates', dates, { shouldDirty: true, shouldValidate: true });
      setActiveSheet(null);
    }} />
)}
```

스펙 확정: **달력만** — 퀵칩·부가 UI 추가하지 않는다. 다중 날짜 그룹화 확인(GroupingConfirmModal)은 DatePickerModal 내부 기존 동작 그대로.

- [ ] **Step 2: TimeSlotsSheet — 출근시간 휠 + 시간대 목록 + 추가/삭제**

```tsx
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TimeWheelPicker, type TimeValue } from '@/components/ui/TimeWheelPicker';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Slots = OrderSheetValues['timeSlots'];
const toTimeValue = (s: string): TimeValue => {
  const [hour = 19, minute = 0] = s.split(':').map(Number);
  return { hour, minute };
};
const toStartTime = (t: TimeValue) => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;

export function TimeSlotsSheet({ visible, value, onConfirm, onClose, onEditSlotRoles }: {
  visible: boolean; value: Slots;
  onConfirm: (next: Slots) => void; onClose: () => void;
  onEditSlotRoles: (slotIndex: number) => void; // 슬롯별 역할 편집 → RolesSheet(slotIndex)
}) {
  const [slots, setSlots] = useState<Slots>(value.length > 0 ? value : [{ startTime: '19:00', roles: [] }]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  const updateStart = (i: number, t: TimeValue) =>
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, startTime: toStartTime(t) } : s)));

  return (
    <SheetModal visible={visible} onClose={onClose} title="출근 시간"
      footer={<Button onPress={() => { onConfirm(slots); onClose(); }}>확인</Button>}
      overlay={pickerIndex !== null ? (
        <TimeWheelPicker visible embedded title="출근 시간"
          value={toTimeValue(slots[pickerIndex]?.startTime ?? '19:00')}
          minuteInterval={5}
          onConfirm={(t) => { updateStart(pickerIndex, t); setPickerIndex(null); }}
          onClose={() => setPickerIndex(null)} />
      ) : undefined}>
      <View className="gap-2">
        {slots.map((slot, i) => (
          <View key={i} className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3">
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setPickerIndex(i)} className="active:opacity-80">
                <Text className="text-base font-sans-bold text-content-primary">출근 {slot.startTime || '--:--'}</Text>
              </Pressable>
              {slots.length > 1 && (
                <Pressable onPress={() => setSlots((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Text className="text-content-muted">삭제</Text>
                </Pressable>
              )}
            </View>
            <Pressable onPress={() => { onConfirm(slots); onEditSlotRoles(i); }} className="mt-1 active:opacity-80">
              <Text className="text-xs text-content-secondary font-sans">
                {slot.roles.length > 0 ? slot.roles.map((r) => `${r.role === 'other' ? r.customRole ?? '기타' : r.role} ${r.count}`).join(' · ') : '이 시간대 역할 설정 ›'}
              </Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => setSlots((prev) => [...prev, { startTime: '', roles: prev[0]?.roles ?? [] }])}
          className="rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 items-center active:opacity-80">
          <Text className="text-sm text-content-secondary font-sans">＋ 시간대 추가</Text>
        </Pressable>
      </View>
    </SheetModal>
  );
}
```

- [ ] **Step 3: RolesSheet — 칩 + 기타 직접입력 + 스테퍼 + 다역할 목록**

```tsx
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { STAFF_ROLES } from '@/constants/jobPosting';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type SlotRoles = OrderSheetValues['timeSlots'][number]['roles'];
type RoleKey = SlotRoles[number]['role'];

export function RolesSheet({ visible, value, onConfirm, onClose }: {
  visible: boolean; value: SlotRoles;
  onConfirm: (next: SlotRoles) => void; onClose: () => void;
}) {
  const [roles, setRoles] = useState<SlotRoles>(value);
  const [picking, setPicking] = useState<RoleKey>('dealer');
  const [customName, setCustomName] = useState('');
  const [count, setCount] = useState(1);

  const addCurrent = () => {
    const entry = { role: picking, ...(picking === 'other' ? { customRole: customName.trim() } : {}), count };
    setRoles((prev) => [...prev.filter((r) => !(r.role === entry.role && r.customRole === entry.customRole)), entry]);
    setCount(1); setCustomName('');
  };
  const label = (r: SlotRoles[number]) =>
    r.role === 'other' ? (r.customRole ?? '기타') : (STAFF_ROLES.find((s) => s.key === r.role)?.name ?? r.role);

  return (
    <SheetModal visible={visible} onClose={onClose} title="어떤 역할이 필요하세요?"
      footer={<Button onPress={() => { onConfirm(roles); onClose(); }} disabled={roles.length === 0}>확인</Button>}>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {STAFF_ROLES.map((r) => (
          <Pressable key={r.key} onPress={() => setPicking(r.key as RoleKey)}
            className={`px-3.5 py-2 rounded-full border ${picking === r.key ? 'border-primary-500 bg-primary-100' : 'border-secondary-200 dark:border-surface-overlay'} active:opacity-80`}>
            <Text className={`text-sm font-sans-medium ${picking === r.key ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'}`}>{r.name}</Text>
          </Pressable>
        ))}
      </View>
      {picking === 'other' && (
        <TextInput value={customName} onChangeText={setCustomName} maxLength={20}
          placeholder="역할 이름 직접 입력 (예: 칩카운터)" testID="order-sheet-role-custom"
          className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-3 text-content-primary" />
      )}
      <View className="flex-row items-center justify-between rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-2 mb-3">
        <Pressable onPress={() => setCount((c) => Math.max(1, c - 1))} className="w-9 h-9 items-center justify-center active:opacity-80"><Text className="text-lg text-content-primary">−</Text></Pressable>
        <Text className="text-base font-sans-bold text-content-primary">{count}<Text className="text-xs text-content-muted"> 명</Text></Text>
        <Pressable onPress={() => setCount((c) => Math.min(99, c + 1))} className="w-9 h-9 items-center justify-center active:opacity-80"><Text className="text-lg text-content-primary">＋</Text></Pressable>
      </View>
      <Pressable onPress={addCurrent} disabled={picking === 'other' && customName.trim().length === 0}
        className="rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 items-center mb-3 active:opacity-80">
        <Text className="text-sm text-content-secondary font-sans">＋ 이 역할 추가</Text>
      </Pressable>
      {roles.length > 0 && (
        <View className="gap-1.5">
          {roles.map((r, i) => (
            <View key={i} className="flex-row items-center justify-between rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-2.5">
              <Text className="text-sm font-sans-medium text-content-primary">{label(r)} {r.count}명</Text>
              <Pressable onPress={() => setRoles((prev) => prev.filter((_, idx) => idx !== i))}><Text className="text-content-muted">삭제</Text></Pressable>
            </View>
          ))}
        </View>
      )}
    </SheetModal>
  );
}
```

- [ ] **Step 4: OrderSheetScreen 장착** — `roles` 행은 슬롯 1개면 slot 0 편집, 복수면 TimeSlotsSheet를 연다(슬롯별 역할은 그 안에서 진입). `activeSheet` 상태를 `OrderRowKey | { key: 'slotRoles'; slotIndex: number } | null`로 확장.

- [ ] **Step 5: 검증 + 커밋**

Run: `npm run type-check && npx eslint src/components/employer/order-sheet`
Expected: 0 에러.

```bash
git add -A uniqn-mobile/src/components/employer/order-sheet
git commit -m "feat(order-sheet): 일정·모집 시트 (날짜 달력·다중 시간대·다역할+기타 직접입력)"
```

---

### Task 8: 급여·복지·세금·조건·사전질문 시트 5종

**Files:**
- Create: `sheets/SalarySheet.tsx`, `sheets/WelfareSheet.tsx`, `sheets/TaxSheet.tsx`, `sheets/ConditionsSheet.tsx`, `sheets/PreQuestionsSheet.tsx`
- Modify: `OrderSheetScreen.tsx` (장착)

**Interfaces:**
- Consumes: `DEFAULT_SALARY_BY_TYPE`/`HOURLY_STEP`(Task 4), `PROVIDED_FLAG`(`@/utils/settlement`), `TaxSettingsEditor`(기존), `PreQuestionsSection` 또는 그 내부 패턴, `postingConditionsSchema` 프리셋 문구.
- Produces: 조건 프리셋 상수 `DRESS_CODE_PRESETS = ['검정셔츠/슬랙스', '흰셔츠/슬랙스']`, `EXPERIENCE_PRESETS = ['TDA 숙지자', '6개월 이상']` (ConditionsSheet에서 export — e2e가 문구 참조 가능).

- [ ] **Step 1: SalarySheet** — 세그먼트(시급/일급/월급) + 시급만 ±1,000 스테퍼, 일급·월급은 기본값+직접입력:

```tsx
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { DEFAULT_SALARY_BY_TYPE, HOURLY_STEP } from '@/utils/order-sheet/mappers';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Salary = OrderSheetValues['salary'];
const TYPE_LABELS = [
  { type: 'hourly', label: '시급' }, { type: 'daily', label: '일급' }, { type: 'monthly', label: '월급' },
] as const;

export function SalarySheet({ visible, value, useSameSalary, onConfirm, onClose }: {
  visible: boolean; value: Salary; useSameSalary: boolean;
  onConfirm: (next: { salary: Salary; useSameSalary: boolean }) => void; onClose: () => void;
}) {
  const [salary, setSalary] = useState<Salary>(value.amount > 0 ? value : { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly });
  const [same, setSame] = useState(useSameSalary);
  const [directInput, setDirectInput] = useState(false);

  const switchType = (type: Salary['type']) => {
    setSalary({ type, amount: DEFAULT_SALARY_BY_TYPE[type] });
    setDirectInput(type !== 'hourly' ? false : directInput);
  };

  return (
    <SheetModal visible={visible} onClose={onClose} title="급여"
      footer={<Button onPress={() => { onConfirm({ salary, useSameSalary: same }); onClose(); }} disabled={salary.amount <= 0}>확인</Button>}>
      <View className="flex-row gap-1 p-1 rounded-xl bg-surface-card border border-secondary-200 dark:border-surface-overlay mb-3">
        {TYPE_LABELS.map(({ type, label }) => (
          <Pressable key={type} onPress={() => switchType(type)}
            className={`flex-1 items-center py-2 rounded-lg ${salary.type === type ? 'bg-primary-100 border border-primary-500' : 'active:opacity-80'}`}>
            <Text className={`text-sm font-sans-medium ${salary.type === type ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-700 dark:text-secondary-300'}`}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {salary.type === 'hourly' && !directInput ? (
        <View className="flex-row items-center justify-between rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-2 mb-2">
          <Pressable onPress={() => setSalary((s) => ({ ...s, amount: Math.max(HOURLY_STEP, s.amount - HOURLY_STEP) }))}
            className="w-10 h-10 items-center justify-center active:opacity-80" testID="order-sheet-salary-minus">
            <Text className="text-xl text-content-primary">−</Text>
          </Pressable>
          <Text className="text-lg font-sans-bold text-content-primary">{salary.amount.toLocaleString()}<Text className="text-xs text-content-muted"> 원</Text></Text>
          <Pressable onPress={() => setSalary((s) => ({ ...s, amount: s.amount + HOURLY_STEP }))}
            className="w-10 h-10 items-center justify-center active:opacity-80" testID="order-sheet-salary-plus">
            <Text className="text-xl text-content-primary">＋</Text>
          </Pressable>
        </View>
      ) : (
        <TextInput
          value={salary.amount > 0 ? String(salary.amount) : ''} keyboardType="number-pad"
          onChangeText={(t) => setSalary((s) => ({ ...s, amount: Number.parseInt(t.replace(/[^0-9]/g, ''), 10) || 0 }))}
          placeholder={`기본값 ${DEFAULT_SALARY_BY_TYPE[salary.type].toLocaleString()}원`}
          className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-2 text-content-primary" />
      )}
      {salary.type === 'hourly' && (
        <Pressable onPress={() => setDirectInput((v) => !v)} className="mb-3 active:opacity-80">
          <Text className="text-xs text-content-secondary font-sans">{directInput ? '스테퍼로 조절 (±1,000원)' : '직접 입력'}</Text>
        </Pressable>
      )}
      <Pressable onPress={() => setSame((v) => !v)}
        className={`flex-row items-center gap-2 rounded-xl border px-4 py-3 ${same ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 dark:border-surface-overlay'} active:opacity-80`}>
        <Text className="text-sm font-sans-medium text-content-primary">모든 역할 동일 급여</Text>
      </Pressable>
    </SheetModal>
  );
}
```

- [ ] **Step 2: WelfareSheet** — 4항목 체크 또는 금액 (기존 `Allowances` 시맨틱: `-1`=제공, `>0`=금액):

```tsx
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { PROVIDED_FLAG } from '@/utils/settlement';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Welfare = OrderSheetValues['allowances'];
const ITEMS = [
  { key: 'meal', label: '식사' }, { key: 'transportation', label: '교통' },
  { key: 'guaranteedHours', label: '보장시간' }, { key: 'accommodation', label: '숙소' },
] as const;

export function WelfareSheet({ visible, value, onConfirm, onClose }: {
  visible: boolean; value: Welfare; onConfirm: (next: Welfare) => void; onClose: () => void;
}) {
  const [welfare, setWelfare] = useState<Welfare>(value);
  const toggle = (key: keyof Welfare) =>
    setWelfare((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined) delete next[key];
      else next[key] = key === 'guaranteedHours' ? 4 : PROVIDED_FLAG; // 보장시간은 시간값, 그 외 기본=제공 체크
      return next;
    });
  const setAmount = (key: keyof Welfare, text: string) =>
    setWelfare((prev) => ({ ...prev, [key]: Number.parseInt(text.replace(/[^0-9]/g, ''), 10) || PROVIDED_FLAG }));

  return (
    <SheetModal visible={visible} onClose={onClose} title="복지 (선택)"
      footer={<Button onPress={() => { onConfirm(welfare); onClose(); }}>확인</Button>}>
      <View className="gap-2">
        {ITEMS.map(({ key, label }) => {
          const v = welfare[key];
          const checked = v !== undefined;
          return (
            <View key={key} className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${checked ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 dark:border-surface-overlay bg-surface-card'}`}>
              <Pressable onPress={() => toggle(key)} className="flex-row items-center gap-3 flex-1 active:opacity-80" testID={`order-sheet-welfare-${key}`}>
                <View className={`w-5 h-5 rounded-md border ${checked ? 'bg-primary-500 border-primary-500' : 'border-secondary-300'}`} />
                <Text className="text-sm font-sans-medium text-content-primary">{label}</Text>
              </Pressable>
              {checked && (
                <TextInput
                  value={v !== undefined && v !== PROVIDED_FLAG ? String(v) : ''}
                  onChangeText={(t) => setAmount(key, t)} keyboardType="number-pad"
                  placeholder={key === 'guaranteedHours' ? '시간' : '금액(선택)'}
                  className="w-24 rounded-lg border border-secondary-200 dark:border-surface-overlay px-2 py-1.5 text-right text-sm text-content-primary" />
              )}
            </View>
          );
        })}
      </View>
    </SheetModal>
  );
}
```

- [ ] **Step 3: TaxSheet** — 기존 `TaxSettingsEditor` 래핑(설정 없으면 기본 `{ type: 'rate', value: 3.3 }` 시드):

```tsx
import React, { useState } from 'react';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TaxSettingsEditor } from '@/components/employer/settlement/TaxSettingsEditor';
import type { TaxSettings } from '@/types/jobPosting';

export function TaxSheet({ visible, value, onConfirm, onClose }: {
  visible: boolean; value: TaxSettings | undefined;
  onConfirm: (next: TaxSettings) => void; onClose: () => void;
}) {
  const [settings, setSettings] = useState<TaxSettings>(value ?? { type: 'rate', value: 3.3 });
  return (
    <SheetModal visible={visible} onClose={onClose} title="세금 설정"
      footer={<Button onPress={() => { onConfirm(settings); onClose(); }}>확인</Button>}>
      <TaxSettingsEditor taxSettings={settings} onChange={setSettings} showLabel={false} showPreview={false} />
    </SheetModal>
  );
}
```

- [ ] **Step 4: ConditionsSheet** — 복장·경력 프리셋 칩 + 직접입력:

```tsx
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Conditions = OrderSheetValues['conditions'];
export const DRESS_CODE_PRESETS = ['검정셔츠/슬랙스', '흰셔츠/슬랙스'] as const;
export const EXPERIENCE_PRESETS = ['TDA 숙지자', '6개월 이상'] as const;

function PresetPicker({ label, presets, value, onChange }: {
  label: string; presets: readonly string[]; value: string | undefined; onChange: (v: string | undefined) => void;
}) {
  const isCustom = value !== undefined && !presets.includes(value);
  const [customMode, setCustomMode] = useState(isCustom);
  return (
    <View className="mb-4">
      <Text className="text-xs font-sans-bold text-content-secondary mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {presets.map((p) => (
          <Pressable key={p} onPress={() => { setCustomMode(false); onChange(value === p ? undefined : p); }}
            className={`px-3.5 py-2 rounded-full border ${value === p ? 'border-primary-500 bg-primary-100' : 'border-secondary-200 dark:border-surface-overlay'} active:opacity-80`}>
            <Text className={`text-sm font-sans-medium ${value === p ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'}`}>{p}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setCustomMode(true); onChange(undefined); }}
          className={`px-3.5 py-2 rounded-full border ${customMode ? 'border-primary-500 bg-primary-100' : 'border-secondary-200 dark:border-surface-overlay'} active:opacity-80`}>
          <Text className="text-sm font-sans-medium text-content-secondary">직접 입력</Text>
        </Pressable>
      </View>
      {customMode && (
        <TextInput value={isCustom ? value : ''} onChangeText={(t) => onChange(t.length > 0 ? t : undefined)} maxLength={50}
          placeholder={`${label} 직접 입력`}
          className="mt-2 rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary" />
      )}
    </View>
  );
}

export function ConditionsSheet({ visible, value, onConfirm, onClose }: {
  visible: boolean; value: Conditions; onConfirm: (next: Conditions) => void; onClose: () => void;
}) {
  const [conditions, setConditions] = useState<Conditions>(value);
  return (
    <SheetModal visible={visible} onClose={onClose} title="조건 (선택)"
      footer={<Button onPress={() => { onConfirm(conditions); onClose(); }}>확인</Button>}>
      <PresetPicker label="복장" presets={DRESS_CODE_PRESETS} value={conditions.dressCode}
        onChange={(dressCode) => setConditions((c) => ({ ...c, dressCode }))} />
      <PresetPicker label="경력" presets={EXPERIENCE_PRESETS} value={conditions.experience}
        onChange={(experience) => setConditions((c) => ({ ...c, experience }))} />
    </SheetModal>
  );
}
```

- [ ] **Step 5: PreQuestionsSheet** — 기존 편집 UI 재사용: `PreQuestionsSection`은 `JobPostingFormData` patch 콜백 형태이므로 얇은 어댑터로 감싼다. `PreQuestionsSection`의 props를 열어 확인(`grep -n "interface PreQuestionsSectionProps" src/components/employer/job-form/sections/PreQuestionsSection.tsx`)하고, `{ usesPreQuestions, preQuestions }`만 주고받는 로컬 상태 어댑터로 SheetModal(fullHeight) 안에 임베드한다. props가 섹션 전용이라 어렵면 PreQuestionsSection 내부의 QuestionCard 패턴을 복사해 `sheets/PreQuestionsSheet.tsx`에 질문 목록+추가+ActionSheet(답변유형)를 동형 구현(최대 10개 제한 유지).

- [ ] **Step 6: OrderSheetScreen 장착 + 검증 + 커밋**

`salary` 행 확정 시: `form.setValue('salary', next.salary)` + `form.setValue('useSameSalary', next.useSameSalary)`.

Run: `npm run type-check && npx eslint src/components/employer/order-sheet && npx jest src/utils/order-sheet orderRowMeta --silent`
Expected: 전부 0 에러/PASS.

```bash
git add -A uniqn-mobile/src/components/employer/order-sheet
git commit -m "feat(order-sheet): 급여·복지·세금·조건·사전질문 시트 5종"
```

---

### Task 9: 프리셋 캐러셀 (템플릿 승격 + 마지막 공고) + 첫 등록 프리셋 저장 제안

**Files:**
- Create: `src/components/employer/order-sheet/PresetCarousel.tsx`
- Modify: `OrderSheetScreen.tsx`(headerSlot), `app/(employer)/my-postings/create.tsx`(데이터 배선)

**Interfaces:**
- Consumes: `useTemplateManager`(`templates`, `handleSaveTemplate`), `templateToValues`(Task 4).
- Produces: `PresetCarousel({ presets, activeId, onSelect })` — preset = `{ id: string; title: string; subtitle: string; values: OrderSheetValues }`.

- [ ] **Step 1: "마지막 공고" 데이터 소스 확인**

Run: `grep -rn "useMyJobPostings\|useEmployerJobPostings\|useMyPostings" src/hooks src/components | head -10`
내 공고 목록 훅이 있으면 최신 1건을 가져와 `jobPostingToDraft`→`draftToValues`→`{...values, dates: []}`로 "마지막 공고" 프리셋 생성. **없으면** TanStack Query 읽기 전용 Repository 직접 호출(CLAUDE.md 허용 경로)로 `create.tsx`에 국소 쿼리 추가:

```tsx
const { data: lastPosting } = useQuery({
  queryKey: ['orderSheet', 'lastPosting', user?.uid],
  queryFn: () => jobPostingRepository.findLatestByOwner(user!.uid), // 실제 메서드명은 Repository에서 확인, 없으면 목록 조회 후 첫 건
  enabled: !!user?.uid,
});
```

(Repository에 적합한 단건 조회가 없으면 기존 목록 조회 메서드 + `limit 1` 사용. **fixed/tournament 공고면 프리셋에서 제외** — `draftToValues`가 throw하므로 try/catch로 스킵.)

- [ ] **Step 2: PresetCarousel 구현**

```tsx
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

export interface OrderSheetPreset { id: string; title: string; subtitle: string; values: OrderSheetValues; }

export function PresetCarousel({ presets, onSelect }: {
  presets: OrderSheetPreset[]; onSelect: (preset: OrderSheetPreset) => void;
}) {
  if (presets.length === 0) {
    return (
      <View className="mb-3 rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3">
        <Text className="text-xs text-content-muted font-sans">아직 프리셋이 없어요 — 첫 공고를 등록하면 만들어 드릴게요</Text>
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3" contentContainerClassName="gap-2">
      {presets.map((p) => (
        <Pressable key={p.id} onPress={() => onSelect(p)}
          className="min-w-[130px] rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-3 py-2.5 active:opacity-80"
          testID={`order-sheet-preset-${p.id}`}>
          <Text className="text-xs font-sans-bold text-content-primary" numberOfLines={1}>{p.title}</Text>
          <Text className="text-[11px] text-content-muted font-sans" numberOfLines={1}>{p.subtitle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 3: 배선** — create.tsx에서 presets 조립:

```tsx
const presets: OrderSheetPreset[] = useMemo(() => {
  const out: OrderSheetPreset[] = [];
  if (lastPosting) {
    try {
      const v = draftToValues(buildJobPostingDraft(lastPosting));
      out.push({ id: 'last', title: '⚡ 마지막 공고', subtitle: v.title, values: { ...v, dates: [] } });
    } catch { /* fixed·tournament 등 주문서 밖 공고는 스킵 */ }
  }
  for (const t of templateManager.templates) {
    try { out.push({ id: t.id, title: t.name, subtitle: t.templateData.title ?? '', values: templateToValues(t) }); }
    catch { /* dated 아닌 템플릿 스킵 */ }
  }
  return out;
}, [lastPosting, templateManager.templates]);
```

선택 시 `form.reset(preset.values)` — OrderSheetScreen에 `onApplyPreset` 경유로 전달(RHF `reset`은 컨테이너 내부이므로 headerSlot 대신 `presets` prop으로 넘겨 내부에서 처리해도 됨 — 구현 단순한 쪽 선택). `recentTitles`(Task 6) = `presets.map(p => p.values.title).filter(Boolean)` 중복 제거, `recentLocations` = `presets.map(p => p.values.location).filter(Boolean)` name+address 중복 제거.

- [ ] **Step 4: 첫 등록 프리셋 저장 제안** — 완료 화면(Task 10)에서: `templateManager.templates.length === 0`이면 "이 구성을 프리셋으로 저장하면 다음엔 2탭이면 끝나요" 배너 + 저장 버튼(`templateManager.handleSaveTemplate(valuesToDraft(submittedValues))`). Task 10에서 함께 구현하므로 여기서는 `handleSaveTemplate` 호출 계약만 만들어 둔다(등록 직전 values를 create-success로 전달).

- [ ] **Step 5: 검증 + 커밋**

Run: `npm run type-check && npx eslint src/components/employer/order-sheet app`
Expected: 0 에러.

```bash
git add -A uniqn-mobile/src uniqn-mobile/app
git commit -m "feat(order-sheet): 프리셋 캐러셀 (마지막 공고 + 저장 템플릿, 탭 1번 전체 교체)"
```

---

### Task 10: 완료 화면 (등록 완료 + 공유 + 프리셋 저장 제안) + 성공 네비 교체

**Files:**
- Create: `app/(employer)/my-postings/create-success.tsx`
- Modify: `app/(employer)/my-postings/create.tsx` (성공 분기 교체)

**Interfaces:**
- Consumes: `useCreateJobPosting` 반환값(생성된 공고 — `CreateJobResult`의 실제 shape을 `src/hooks/useJobManagement.ts:96-136`에서 확인해 id 추출), 공유는 기존 `useShare` 훅(`src/hooks/useShare.ts`) — 공고 상세 화면(`my-postings/[id]/index.tsx`)이 쓰는 공유 호출부를 열어 동일하게 사용.
- Produces: 라우트 `/(employer)/my-postings/create-success?id=<uuid>`.

- [ ] **Step 1: create-success 화면 구현**

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/Button';

export default function CreateSuccessScreen() {
  const { id, title, summary, suggestPreset } = useLocalSearchParams<{
    id: string; title?: string; summary?: string; suggestPreset?: string;
  }>();
  const postingId = Array.isArray(id) ? id[0] : id;

  return (
    <View className="flex-1 bg-surface-page px-5 justify-center">
      <View className="items-center mb-6">
        <View className="w-14 h-14 rounded-full bg-success-100 items-center justify-center mb-3">
          <Text className="text-2xl text-success-600">✓</Text>
        </View>
        <Text className="text-lg font-sans-bold text-content-primary">공고가 등록됐어요</Text>
        <Text className="text-sm text-content-secondary font-sans mt-1">지원자가 생기면 바로 알려드릴게요</Text>
      </View>
      {title ? (
        <View className="rounded-2xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-3 mb-4">
          <Text className="text-sm font-sans-bold text-content-primary">{title}</Text>
          {summary ? <Text className="text-xs text-content-muted font-sans mt-0.5">{summary}</Text> : null}
        </View>
      ) : null}
      {suggestPreset === '1' && (
        <View className="rounded-2xl border border-primary-300 bg-primary-50 px-4 py-3 mb-4">
          <Text className="text-xs text-content-primary font-sans">💡 이 구성을 프리셋으로 저장하면 다음엔 2탭이면 끝나요</Text>
        </View>
      )}
      <View className="gap-2">
        <Button onPress={() => router.replace(`/(employer)/my-postings/${postingId}`)} testID="create-success-view">공고 보기</Button>
        <Button variant="secondary" onPress={() => router.replace('/(employer)/my-postings/create')} testID="create-success-again">＋ 하나 더 등록</Button>
      </View>
    </View>
  );
}
```

공유 버튼: 상세 화면의 공유 호출부(`grep -n "useShare\|buildJobShareText" "app/(employer)/my-postings/[id]/index.tsx" src/components -r | head -5`)를 확인해 같은 훅으로 "카카오톡으로 공유" 버튼을 최상단에 추가한다. 공유가 공고 엔티티를 요구하면 상세 데이터 훅(같은 grep으로 확인)을 id로 호출해 로드 후 활성화하고, 로딩 중엔 버튼 disabled. `Button`의 `variant` prop 명칭은 실제 Button 컴포넌트에서 확인해 맞춘다.

프리셋 저장 배너의 [저장] 버튼: `useTemplateManager().openTemplateModal` + `TemplateModal` 재사용 — create.tsx에서 이미 쓰는 배선을 이 화면에도 추가하되, 저장할 draft는 `useLocalSearchParams`로 넘기기엔 크므로 **createJobPosting 성공 시 zustand 없이 모듈 레벨 1회성 캐시**(`src/utils/order-sheet/lastSubmitted.ts` — `export let lastSubmittedDraft: JobPostingDraft | null` + setter)로 전달한다.

- [ ] **Step 2: create.tsx 성공 분기 교체**

```tsx
const created = await createJobPosting.mutateAsync({ input });
setIsDirty(false);
if (venueId && router.canGoBack()) {
  addToast({ type: 'success', message: '공고가 등록되었습니다.' });
  router.back(); // 그리드 동선 무회귀 (기존 유지)
} else {
  setLastSubmittedDraft(valuesToDraft(values));
  router.replace({
    pathname: '/(employer)/my-postings/create-success',
    params: {
      id: created.id, // CreateJobResult에서 실제 필드명 확인
      title: values.title,
      summary: `${values.dates[0] ?? ''} · 출근 ${values.timeSlots[0]?.startTime ?? ''}`,
      suggestPreset: templateManager.templates.length === 0 ? '1' : '0',
    },
  });
}
```

- [ ] **Step 3: 검증 + 커밋**

Run: `npm run type-check && npx eslint app`
Expected: 0 에러.

```bash
git add -A uniqn-mobile/app uniqn-mobile/src
git commit -m "feat(order-sheet): 등록 완료 화면 (공유·공고보기·연속등록·프리셋 저장 제안)"
```

---

### Task 11: e2e 갱신 + 전체 게이트

**Files:**
- Modify: `e2e/tests/p1-important/employer-posting-crud.spec.ts` (create 경로를 주문서 플로우로)
- Test: 전체 스위트

- [ ] **Step 1: e2e create 경로 갱신**

기존 스펙의 공고 생성 구간(폼 섹션 입력)을 주문서 플로우로 교체: `order-sheet-row-title` 탭 → 입력 → 확인 → `order-sheet-row-place` → … → `job-posting-create-submit` 탭 → create-success 확인(`create-success-view` 존재 단언) → 공고 보기. 고정(fixed) 생성 케이스가 스펙에 있으면 `order-sheet-type-fixed` 탭 → 기존 폼 진입 후 기존 시나리오 유지.

- [ ] **Step 2: 로컬 e2e 스모크**

Run: `npx playwright test e2e/tests/p1-important/employer-posting-crud.spec.ts --project=chromium` (프로젝트 러너 설정에 맞춰 — `e2e/README` 또는 package.json scripts에서 실행 명령 확인)
Expected: PASS. (로컬 Supabase 스택 필요 — `npm run db:start` 선행. 로컬에서 실행 불가한 환경이면 CI 결과로 대체하고 그 사실을 커밋 메시지에 명기.)

- [ ] **Step 3: 전체 게이트**

Run: `npm run quality`
Expected: type-check·lint·format 전부 EXIT 0.
Run: `npx jest --silent`
Expected: 전 스위트 PASS (기준: 기존 403 스위트 + 신규 → 실패 0).

- [ ] **Step 4: 커밋**

```bash
git add -A uniqn-mobile/e2e
git commit -m "test(e2e): 공고 생성 플로우를 주문서 UX로 갱신"
```

---

## 계획 밖 (배포 게이트 — 사용자 확인 후 별도 수행)

1. `20260714000000_job_postings_conditions.sql` prod 적용 — `mcp__supabase__apply_migration` (같은 PR에 파리티 가드 기대값 갱신 필요 여부 확인: 컬럼 추가는 함수/정책 카운트 무변경이라 `parity_baseline_guard` 영향 없음 예상, pgTAP 실행으로 실측).
2. push / PR 생성 (명시 요청 시).
3. OTA 출하 — JS-only이므로 가능. **직전 origin/master 재fetch+ff 필수**(메모리 `feedback_ota_refetch_local_tree_before_update`).
4. 실기기 QA: 주문서 시트 중첩(특히 PlaceSheet 안 RegionSelectModal, TimeSlotsSheet 안 TimeWheelPicker embedded) iOS 터치 확인.
