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
- `SalaryType`은 기존 `'hourly'|'daily'|'monthly'|'other'` 사용 — **monthly 기존재, 스키마 변경 불필요**. **협의(`other`)도 신규 작성에서 선택 가능**(2026-07-14 사용자 결정, 설계 §3 개정) — 금액 없이 `{ type: 'other', amount: 0 }`로 발행. 문서 게이트 `salaryInfoSchema.amount: z.number().min(0)`(jobPosting.schema.ts:51-53)이 허용함을 실측, 레거시도 동일 패턴(SalarySection.tsx:65 `amount: type === 'other' ? 0 : ...`).
- **"모든 역할 동일 급여" 토글 유지 + OFF 경로 완성**(2026-07-14 사용자 결정): 토글 OFF(by_role) 시 역할별 급여 입력 UI(Task 8)와 `roleCatalog[].salary` 매핑(Task 4)을 구현한다. 리뷰 실측: 초안의 OFF 경로는 역할별 급여를 만들지 않는 no-op이었음.
- **세금 기본값 = 미설정(세금 없음)**(2026-07-14 사용자 결정 — 레거시 패리티): 신규 공고는 `taxSettings` 없이 발행, TaxSheet를 열면 3.3%를 제안값으로 시드.
- 복지 시맨틱: 기존 `Allowances` 그대로 — `-1`(=`PROVIDED_FLAG`, `@/utils/settlement`)=제공(체크만), `>0`=금액, `undefined`=없음. **서버 변경 없음**.
- 중첩 RN Modal 금지: 시트는 `SheetModal`(overlay 슬롯) + `TimeWheelPicker`의 `embedded` 패턴 준수 (`src/components/weeklyGrid/EditSlotSheet.tsx:305` 참고). **RegionSelectModal·ActionSheet·DatePickerModal은 전부 ui/Modal(RN Modal) 기반이므로 SheetModal 내부에서 열기 금지**(리뷰 실측 — Task 6·8에서 인라인 대체 확정).
- **RHF×zod 타입 계약(스파이크 실측 확정)**: `zodResolver`는 `Resolver<z.input, any, z.output>`을 반환하므로 폼은 **3제네릭** `useForm<OrderSheetFormValues, unknown, OrderSheetValues>`로 선언한다. 폼 상태·행 메타·시트는 `OrderSheetFormValues`(=z.input — 장소 null 허용, default 필드 optional), `handleSubmit` 콜백·매퍼 입력은 `OrderSheetValues`(=z.output — 장소 non-null, default 채움). 단일 제네릭 `useForm<z.infer<...>>`는 **컴파일 불가**(zod 4.3.6 × resolvers 5.2.2 × RHF 7.71.2 tsc 실측). `.refine((v) => v !== null)`의 TS 추론 프레디킷이 output에서 null을 제거하는 것은 의도된 동작.
- **UI 공통 체크리스트(전 시트·행·완료화면 적용, 리뷰 M1~M4·L5)**: ①상태색 텍스트 다크 변형 필수(`text-warning-700 dark:text-warning-300` · `text-error-500 dark:text-error-400` · `text-success-600 dark:text-success-400`) ②선택 컨트롤은 `accessibilityRole="radio"|"checkbox"` + `accessibilityState={{ selected|checked }}` — 하우스 패턴 `TaxSettingsEditor.tsx:206-214` ③터치 타깃 44pt(`min-h-[44px] min-w-[44px]` 또는 hitSlop — 스테퍼·삭제 버튼) ④아이콘은 `@/components/icons` Lucide만(`−`/`＋`/`›`/`✓` 텍스트 글리프 금지 — Plus/Minus/ChevronRight/Check/Trash 아이콘) ⑤`autoFocus` 금지(impeccable rule 20) ⑥하단 고정 바는 `border-t border-secondary-100 dark:border-surface-overlay` 경계 추가.
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
- Create: `uniqn-mobile/supabase/migrations/20260714000000_job_postings_conditions.sql` (⚠️ supabase 디렉토리는 레포 루트가 아니라 `uniqn-mobile/` 하위 — 실측 확정)
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

`jobPostingDocumentSchema`(:473-514, `.strict()`는 :511 실측)의 필드 목록에 `conditions: postingConditionsSchema.optional(),` 추가 (questions 필드 다음). strict 스키마라 이 한 줄이 없으면 insert가 죽는다(`assertCanonical` → BusinessError).

> ⚠️ 읽기측 엄격성 트레이드오프(보안 리뷰): `parseJobPostingDocument`는 읽기에도 같은 스키마를 쓰므로 conditions는 유일하게 읽기에서도 xss·max50 검증되는 필드가 된다. 신규 필드라 기존 데이터 위험은 없어 수용하되, 향후 다른 표면(admin 툴 등)이 규격 밖 값을 쓰면 공고 전체 read-null(#146 클래스) — read 관용(위반 시 필드 strip) 검토를 후속 백로그로 남긴다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx jest src/schemas/__tests__/jobPosting.schema.test.ts --silent`
Expected: PASS (기존 케이스 포함 전건).

- [ ] **Step 5: 마이그레이션 파일 작성** — `uniqn-mobile/supabase/migrations/20260714000000_job_postings_conditions.sql`:

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
git add uniqn-mobile/src/types/jobPosting.ts uniqn-mobile/src/schemas/jobPosting.schema.ts uniqn-mobile/src/schemas/__tests__/jobPosting.schema.test.ts uniqn-mobile/supabase/migrations/20260714000000_job_postings_conditions.sql
git commit -m "feat(job-posting): 모집 조건(복장·경력) 타입·zod 계약·마이그레이션 추가"
```

---

### Task 2: 직렬화·어댑터·리포지토리에 conditions 통과 (own-property 가드, 9개 지점)

새 필드가 draft→document→**DB행→entity**→draft 왕복에서 살아남게 한다. **#194(region 유실)의 교훈**: 매퍼·리포지토리는 전부 화이트리스트 방식이라 **9개 지점(쓰기 4·읽기 3·수정 2)** 전부에 명시적으로 넣어야 하고, patch 병합은 own-property 가드를 써야 "필드 없음"과 "undefined로 지우기"가 구분된다.

> ⚠️ 리뷰 실측(CRITICAL): 초안의 4지점만 반영하면 **쓰기는 성공하지만 모든 읽기(SELECT·Realtime)에서 conditions가 조용히 증발**한다 — `TABLE_COLUMNS` SELECT 화이트리스트(`JobPostingRepositoryHelpers.ts:17`)가 컬럼을 아예 조회하지 않고, `toJobPosting`(:40)이 미등록 키를 버리며, `deserializeJobPostingDocument`(serialization.ts:381) 조립부에도 없기 때문. INSERT만은 동적 조립(`toSnakeCase(removeUndefined(serialized))`, JobPostingRepository.ts:427-433)이라 통과한다.

**Files:**
- Modify: `src/domains/job-posting/serialization.ts` (`serializeJobPostingV3` :264, `toCreateJobPostingInput` :344, `deserializeJobPostingDocument` :381)
- Modify: `src/repositories/supabase/JobPostingRepositoryHelpers.ts` (`TABLE_COLUMNS` :17 — SELECT 화이트리스트)
- Modify: `src/utils/job-posting/draftAdapter.ts` (`draftToCreateJobPostingInput` :506, `draftToUpdateJobPostingInput` :589, `jobPostingToDraft` :705)
- Modify: `src/types/jobPostingDraft.ts` (JobPostingDraft에 필드 추가)
- Modify: `src/types/jobTemplate.ts` (`JobPostingTemplateData`, `extractTemplateData` :109, `templateToDraft` :147)
- Test: `src/domains/job-posting/__tests__/serialization.conditions.test.ts` (신규)

**Interfaces:**
- Consumes: Task 1의 `PostingConditions`, `postingConditionsSchema`.
- Produces: `JobPostingDraft.conditions?: PostingConditions`, `JobPostingTemplateData.conditions?: PostingConditions` — Task 4 매퍼가 사용.

- [ ] **Step 1: 실패하는 왕복 테스트 작성** — `src/domains/job-posting/__tests__/serialization.conditions.test.ts`:

기존 `serialization.region.test.ts`의 픽스처 구성 방식을 그대로 따라(동일 헬퍼/최소 input 재사용) 작성:

```ts
import { serializeJobPostingV3, deserializeJobPostingDocument, toCreateJobPostingInput } from '../serialization';
import { draftToCreateJobPostingInput, jobPostingToDraft } from '@/utils/job-posting/draftAdapter';
import { TABLE_COLUMNS } from '@/repositories/supabase/JobPostingRepositoryHelpers';
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

  it('읽기 방향: document→deserialize→entity→수정 base에서 conditions가 보존된다', () => {
    const input = draftToCreateJobPostingInput(draftWithConditions);
    const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
    const entity = deserializeJobPostingDocument({ ...doc, id: 'p1' });
    expect(entity.conditions).toEqual(draftWithConditions.conditions); // ⑥ 읽기 조립부
    expect(toCreateJobPostingInput(entity).conditions).toEqual(draftWithConditions.conditions); // ⑦ 수정 base
    expect(jobPostingToDraft(entity).conditions).toEqual(draftWithConditions.conditions); // edit 진입
  });

  it('TABLE_COLUMNS SELECT 화이트리스트에 conditions가 등록된다 (읽기 증발 가드)', () => {
    expect(TABLE_COLUMNS.split(',')).toContain('conditions');
  });
});
```

(`serializeJobPostingV3`의 실제 두 번째 인자 시그니처는 파일에서 확인 후 맞출 것 — 옵션 객체 형태가 다르면 기존 테스트 파일의 호출 형태를 복사.)

- [ ] **Step 2: 실패 확인**

Run: `npx jest serialization.conditions --silent`
Expected: FAIL — `input.conditions` undefined.

- [ ] **Step 3: 통과 구현 (9개 지점 — 쓰기 4·읽기 3·수정 2)**

1. `src/types/jobPostingDraft.ts` — `JobPostingDraft`에 `conditions?: PostingConditions;` 추가 (`questions` 다음), import 추가.
2. `draftAdapter.ts`의 `draftToCreateJobPostingInput`(:506) — 반환 객체 조립부에 조건부 스프레드 추가:

```ts
...(draft.conditions !== undefined ? { conditions: draft.conditions } : {}),
```

3. `draftAdapter.ts`의 `jobPostingToDraft`(:705) — 역방향에도 동일 패턴:

```ts
...(posting.conditions !== undefined ? { conditions: posting.conditions } : {}),
```

4. `serialization.ts`의 `serializeJobPostingV3` — document 조립부에 **venueId와 동일한 current 폴백 패턴**(:296-305 실물 참조 — 편집·정산 재직렬화 경로에서 보존):

```ts
...(input.conditions !== undefined
  ? { conditions: input.conditions }
  : current?.conditions !== undefined
    ? { conditions: current.conditions }
    : {}),
```

`JobPostingDocumentV3` 타입(`src/types/jobPosting.ts:140`)에 `conditions?: PostingConditions;` 추가.
5. `src/types/jobTemplate.ts` — `JobPostingTemplateData`에 `conditions?: PostingConditions;` 추가. `extractTemplateData`(:109)와 `templateToDraft`(:147)에 동일 조건부 스프레드 (템플릿 저장/복원 시 조건 보존).
6. **[읽기]** `serialization.ts`의 `deserializeJobPostingDocument`(:381) — 반환 조립부(:429-)에 `...(document.conditions !== undefined ? { conditions: document.conditions } : {})` 추가. 엔티티 타입 필드는 Task 1에서 완료. **이게 빠지면 상세·프리셋·edit 전부에서 conditions가 항상 undefined**(쓰기만 되고 아무도 못 읽는 필드).
7. **[수정 base]** `serialization.ts`의 `toCreateJobPostingInput`(:344-357) — 명시 목록에 동일 조건부 스프레드. 빠지면 `mergeJobPostingInput` 기반 수정·정산설정 변경 1회에 conditions가 조용히 소실.
8. **[수정 patch]** `draftAdapter.ts`의 `draftToUpdateJobPostingInput`(:589-601) — updateInput 조립부에 동일 조건부 스프레드 (레거시 edit 폼이 키오스크 공고를 수정해도 계약상 보존).
9. **[SELECT]** `JobPostingRepositoryHelpers.ts:17` `TABLE_COLUMNS` 문자열에 `conditions` 추가(알파벳 순서 유지 — `compensation` 다음). `ALLOWED_CAMEL_COLUMNS`는 자동 파생이라 별도 수정 불필요.

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

`AllowanceInput.tsx` 상단 렌더의 섹션 제목 텍스트 "수당" 계열 문자열(:39 "추가 수당 (선택)")을 "복지"로 변경 (`grep -n "수당" src/components/employer/job-form/sections/SalarySection/*.tsx`로 표시 문자열만 — 변수·주석의 도메인 용어는 유지 가능).

> 스코프 노트(리뷰 LOW): 정산·스태프 표면(AllowanceEditor·SettlementTab·InfoTab 등)의 "수당" 표기는 이번 슬라이스 제외 — 용어 통일은 후속 백로그.

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
- Consumes: `JobPostingDraft`(+conditions), `templateToDraft`, `draftToCreateJobPostingInput`, `GridPrefillParams`(타입만 — buildGridPrefillDraft는 경유하지 않고 직접 조립), `DEFAULT_SLOT_START_TIME`(`@/domains/weeklyGrid`), `generateId`, `PROVIDED_FLAG`.
- Produces (이후 UI 태스크 전부가 사용):

```ts
export type OrderSheetFormValues = z.input<typeof orderSheetValuesSchema>;  // 폼 상태 (장소 null 허용, default 필드 optional)
export type OrderSheetValues = z.output<typeof orderSheetValuesSchema>;    // 제출 결과 (검증 통과 — 장소 non-null, default 채움)
export function initialOrderSheetValues(): OrderSheetFormValues;            // 초기 주문서 SSOT — INITIAL_JOB_POSTING_DRAFT 경유 금지(by_role·09:00 기본슬롯 유입 차단, 리뷰 실측)
export function valuesToDraft(values: OrderSheetValues): JobPostingDraft;
export function draftToValues(draft: JobPostingDraft): OrderSheetFormValues; // dated 전용 — fixed거나 날짜별 시간대 상이하면 throw(조용한 평탄화 금지, 프리셋이 try/catch 스킵)
export function templateToValues(template: JobPostingTemplate): OrderSheetFormValues; // 날짜 비움
export function gridParamsToValues(params: GridPrefillParams): OrderSheetFormValues;  // 정규화(비-UUID venueId drop, count 1..99 클램프) + 직접 조립
export function valuesToCreateInput(values: OrderSheetValues): CreateJobPostingInput;
export const DEFAULT_SALARY_BY_TYPE = { hourly: 20000, daily: 200000, monthly: 2500000 } as const; // 협의(other)는 기본값 없음(amount 0)
export const HOURLY_STEP = 1000;
```

- [ ] **Step 1: 스키마 작성** — `src/schemas/orderSheet.schema.ts`:

```ts
import { z } from 'zod';
import { xssValidation } from '@/utils/security';
import { isRegionSlug } from '@/constants/regions';
import { PROVIDED_FLAG } from '@/utils/settlement';
import { preQuestionsArraySchema } from '@/schemas/preQuestion.schema';
import type { TaxSettings } from '@/types/jobPosting';

const safeText = (max: number) =>
  z.string().max(max).refine(xssValidation, { message: '위험한 문자열이 포함되어 있습니다' });

// 협의(other) 선택 가능(2026-07-14 결정) — { type: 'other', amount: 0 }로 발행.
// 문서 게이트 salaryInfoSchema.amount: min(0)이 허용함을 실측(jobPosting.schema.ts:51-53).
export const orderSheetSalarySchema = z
  .object({
    type: z.enum(['hourly', 'daily', 'monthly', 'other']),
    amount: z.number().int().min(0),
  })
  .superRefine((s, ctx) => {
    if (s.type !== 'other' && s.amount <= 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: '급여를 입력해주세요' });
    }
  });

export const orderSheetRoleSchema = z.object({
  role: z.enum(['dealer', 'floor', 'serving', 'manager', 'staff', 'other']),
  customRole: safeText(20).optional(),
  count: z.number().int().min(1).max(99),
});

// useSameSalary=false일 때 역할별 급여(2026-07-14 결정) — roleCatalog[].salary의 캐리어
export const orderSheetRoleSalarySchema = z.object({
  role: z.enum(['dealer', 'floor', 'serving', 'manager', 'staff', 'other']),
  customRole: safeText(20).optional(),
  salary: orderSheetSalarySchema,
});

export const orderSheetTimeSlotSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '출근 시간을 선택해주세요'),
  roles: z.array(orderSheetRoleSchema).min(1, '역할을 추가해주세요'),
});

export const orderSheetLocationSchema = z.object({
  name: safeText(50).min(1, '장소를 선택해주세요'),
  address: safeText(200).optional(),
  district: safeText(50).optional(),
  region: z.string().refine((s) => isRegionSlug(s), '지역 값이 올바르지 않습니다').optional(),
  detailedAddress: safeText(200).optional(),
});

export const orderSheetConditionsSchema = z.object({
  dressCode: safeText(50).optional(),
  experience: safeText(50).optional(),
});

// 복지: 기존 Allowances 시맨틱을 타입으로 인코딩(리뷰 CRITICAL 반영) —
// 보장시간=시간값(0 이상, 문서 게이트 min(0)과 정합·PROVIDED_FLAG 금지), 나머지 3종=-1(제공) 또는 양수 금액
export const orderSheetAllowancesSchema = z.object({
  guaranteedHours: z.number().int().min(0).optional(),
  meal: z.union([z.literal(PROVIDED_FLAG), z.number().int().positive()]).optional(),
  transportation: z.union([z.literal(PROVIDED_FLAG), z.number().int().positive()]).optional(),
  accommodation: z.union([z.literal(PROVIDED_FLAG), z.number().int().positive()]).optional(),
});

export const orderSheetValuesSchema = z.object({
  postingType: z.enum(['regular', 'urgent']),
  title: safeText(25).min(1, '제목을 입력해주세요'),
  // ⚠️ 아래 refine의 TS 추론 프레디킷이 z.output에서 null을 제거한다(의도된 동작 — 매퍼가 가드 없이 소비)
  location: orderSheetLocationSchema.nullable().refine((v) => v !== null, '장소를 선택해주세요'),
  contactPhone: safeText(20).min(1, '연락처를 입력해주세요'),
  description: safeText(500).default(''),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, '날짜를 선택해주세요'),
  timeSlots: z.array(orderSheetTimeSlotSchema).min(1, '시간대를 추가해주세요'),
  salary: orderSheetSalarySchema,
  useSameSalary: z.boolean().default(true),
  roleSalaries: z.array(orderSheetRoleSalarySchema).default([]),
  allowances: orderSheetAllowancesSchema.default({}),
  taxSettings: z.custom<TaxSettings>().optional(),
  conditions: orderSheetConditionsSchema.default({}),
  usesPreQuestions: z.boolean().default(false),
  // 기존 preQuestion 스키마 재사용(question xss·max10 확보) + 레거시 라이브 게이트(validation.ts:154-159)의
  // options xss 검사를 UI측에서 승계(문서 스키마엔 없음 — 회귀 방지, 보안 리뷰 MEDIUM).
  // ⚠️ 문서 스키마(preQuestion.schema.ts:35)를 조이는 건 금지 — 읽기 공용이라 기존 prod 문서 read-null 위험.
  preQuestions: preQuestionsArraySchema
    .superRefine((qs, ctx) => {
      qs.forEach((q, i) =>
        q.options?.forEach((opt, j) => {
          if (opt.trim() && !xssValidation(opt)) {
            ctx.addIssue({ code: 'custom', path: [i, 'options', j], message: '위험한 문자가 포함되어 있습니다' });
          }
        })
      );
    })
    .default([]),
  venueId: z.string().uuid().optional(),
});

export type OrderSheetFormValues = z.input<typeof orderSheetValuesSchema>;
export type OrderSheetValues = z.output<typeof orderSheetValuesSchema>;
```

- [ ] **Step 2: 실패하는 매퍼 테스트 작성** — `src/utils/order-sheet/__tests__/mappers.test.ts`:

```ts
import {
  valuesToDraft, draftToValues, templateToValues, gridParamsToValues,
  valuesToCreateInput, initialOrderSheetValues, DEFAULT_SALARY_BY_TYPE,
} from '../mappers';
import { buildCreateJobPostingInput } from '@/utils/job-posting/submission';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { JobPostingFormData } from '@/types/jobPostingForm';

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
  roleSalaries: [],
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
  it('useSameSalary=false면 mode=by_role + roleCatalog에 역할별 급여가 실린다 (2026-07-14 결정)', () => {
    const byRole: OrderSheetValues = {
      ...baseValues,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 25000 } },
        { role: 'serving', salary: { type: 'other', amount: 0 } }, // 역할별 협의도 가능
      ],
    };
    const draft = valuesToDraft(byRole);
    expect(draft.compensation.mode).toBe('by_role');
    expect(draft.roleCatalog.find((r) => r.role === 'dealer')?.salary).toEqual({ type: 'hourly', amount: 25000 });
    expect(draft.roleCatalog.find((r) => r.role === 'serving')?.salary).toEqual({ type: 'other', amount: 0 });
  });
  it('협의(other) 급여는 amount 0으로 발행된다', () => {
    const draft = valuesToDraft({ ...baseValues, salary: { type: 'other', amount: 0 } });
    expect(draft.compensation.defaultSalary).toEqual({ type: 'other', amount: 0 });
  });
  it('날짜별 requirements가 슬롯 배열 참조를 공유하지 않고 slot/role에 id가 부여된다 (gridPrefill 관례)', () => {
    const draft = valuesToDraft(baseValues);
    if (draft.schedule.kind !== 'dated') return;
    expect(draft.schedule.requirements[0]?.timeSlots).not.toBe(draft.schedule.requirements[1]?.timeSlots);
    expect(draft.schedule.requirements[0]?.timeSlots[0]?.id).toBeTruthy();
  });
});

describe('draftToValues ↔ valuesToDraft 왕복', () => {
  it('values→draft→values가 동치다 (values에는 id가 없어 draft에서 생성된 slot/role id는 왕복에 영향 없음)', () => {
    const roundTrip = draftToValues(valuesToDraft(baseValues));
    expect(roundTrip).toEqual(baseValues);
  });
  it('fixed 스케줄 draft는 throw한다 (키오스크 범위 밖)', () => {
    const fixedDraft = { ...INITIAL_JOB_POSTING_DRAFT, schedule: { kind: 'fixed' as const, requirements: [] } };
    expect(() => draftToValues(fixedDraft)).toThrow();
  });
  it('날짜별 시간대가 상이한 draft는 throw한다 (조용한 평탄화 금지 — 프리셋에서 스킵, 리뷰 M8)', () => {
    const base = valuesToDraft(baseValues);
    if (base.schedule.kind !== 'dated') return;
    const heterogeneous = {
      ...base,
      schedule: {
        ...base.schedule,
        requirements: [
          { date: '2026-07-14', timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 1 }] }] },
          { date: '2026-07-15', timeSlots: [{ startTime: '21:00', roles: [{ role: 'dealer' as const, count: 1 }] }] },
        ],
      },
    };
    expect(() => draftToValues(heterogeneous)).toThrow();
  });
  it("레거시 협의(other) 공고는 협의로 유지된다 (2026-07-14 결정 — hourly 강제 변환 금지)", () => {
    const draft = valuesToDraft({ ...baseValues, salary: { type: 'other', amount: 0 } });
    expect(draftToValues(draft).salary).toEqual({ type: 'other', amount: 0 });
  });
});

describe('신·구 동등성 (레거시 폼 경로 대비)', () => {
  // ⚠️ 동어반복 금지(리뷰 HIGH): buildCreateJobPostingInput(draft)는 draftToCreateJobPostingInput을
  // 그대로 부르므로 valuesToDraft 결과를 넣어 비교하면 같은 함수를 두 번 부르는 것이다.
  // 반드시 JobPostingFormData(레거시 폼 표현) 픽스처를 경유해 비교한다.
  it('같은 입력 의도의 레거시 formData와 CreateJobPostingInput이 동등하다', () => {
    // 기존 draftAdapter 테스트의 JobPostingFormData 픽스처를 복사해 baseValues와 같은 의도
    // (단일 시간대 19:00·딜러2+서빙1·shared 시급 20,000·복지 동일)로 구성한다.
    const legacyFormData = {/* draftAdapter.test.ts 픽스처 참조 */} as unknown as JobPostingFormData;
    const legacy = buildCreateJobPostingInput(legacyFormData);
    const kiosk = valuesToCreateInput(baseValues);
    expect(kiosk.compensation).toEqual(legacy.compensation);
    expect(kiosk.schedule.requirements).toEqual(legacy.schedule.requirements); // id 등 생성 필드는 normalize 후 비교
    expect(kiosk.roleCatalog).toEqual(legacy.roleCatalog);
  });
});

describe('gridParamsToValues (정규화 + 직접 조립 — INITIAL 경유 금지)', () => {
  it('venueId·date·count가 주문서 값으로 흡수된다', () => {
    const values = gridParamsToValues({ venueId: '00000000-0000-4000-8000-000000000001', date: '2026-07-20', count: 3 });
    expect(values.venueId).toBe('00000000-0000-4000-8000-000000000001');
    expect(values.dates).toEqual(['2026-07-20']);
    expect(values.timeSlots?.[0]?.roles?.[0]).toMatchObject({ role: 'dealer', count: 3 });
    expect(values.useSameSalary).toBe(true); // INITIAL의 by_role 유입 차단 확인
  });
  it('비정상 파라미터는 정규화된다 (비-UUID venueId drop, count 1..99 클램프 — 보안 리뷰)', () => {
    expect('venueId' in gridParamsToValues({ venueId: 'not-a-uuid', date: '2026-07-20' })).toBe(false);
    expect(gridParamsToValues({ date: '2026-07-20', count: 500 }).timeSlots?.[0]?.roles?.[0]?.count).toBe(99);
  });
  it('파라미터 없으면 initialOrderSheetValues와 동일 (venueId 키 부재 무회귀 계약)', () => {
    expect(gridParamsToValues({})).toEqual(initialOrderSheetValues());
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
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { CreateJobPostingInput, PostingRoleCatalogEntry, PostingTimeSlot, SalaryInfo } from '@/types/jobPosting';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import type { JobPostingTemplate } from '@/types/jobTemplate';
import { templateToDraft } from '@/types/jobTemplate';
import { draftToCreateJobPostingInput } from '@/utils/job-posting/draftAdapter';
import type { GridPrefillParams } from '@/utils/job-posting/gridPrefill';
import { DEFAULT_SLOT_START_TIME } from '@/domains/weeklyGrid';
import { generateId } from '@/utils/generateId';

export const DEFAULT_SALARY_BY_TYPE = { hourly: 20000, daily: 200000, monthly: 2500000 } as const;
export const HOURLY_STEP = 1000;

/** 초기 주문서 SSOT — INITIAL_JOB_POSTING_DRAFT 경유 금지(by_role·09:00 기본슬롯 유입, 리뷰 실측). */
export function initialOrderSheetValues(): OrderSheetFormValues {
  return {
    postingType: 'regular',
    title: '',
    location: null,
    contactPhone: '', // create.tsx가 프로필 phone으로 덮어씀 (Task 5 Step 6)
    description: '',
    dates: [],
    timeSlots: [],
    salary: { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly },
    useSameSalary: true,
    roleSalaries: [],
    allowances: {},
    conditions: {},
    usesPreQuestions: false,
    preQuestions: [],
  };
}

/** 날짜별 requirements가 참조를 공유하지 않도록 호출마다 새 슬롯 생성 + id 부여 (gridPrefill.ts 관례). */
function toPostingTimeSlots(values: OrderSheetValues): PostingTimeSlot[] {
  return values.timeSlots.map((slot) => ({
    id: generateId(),
    startTime: slot.startTime,
    roles: slot.roles.map((r) => ({
      id: generateId(),
      role: r.role,
      ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
      count: r.count,
    })),
  }));
}

const roleKey = (role: string, customRole?: string) => (role === 'other' ? `other:${customRole ?? ''}` : role);

function toRoleCatalog(values: OrderSheetValues): PostingRoleCatalogEntry[] {
  const salaryByRole = new Map<string, SalaryInfo>(
    values.useSameSalary ? [] : values.roleSalaries.map((rs) => [roleKey(rs.role, rs.customRole), rs.salary])
  );
  const seen = new Map<string, PostingRoleCatalogEntry>();
  for (const slot of values.timeSlots) {
    for (const r of slot.roles) {
      const key = roleKey(r.role, r.customRole);
      if (!seen.has(key)) {
        const salary = salaryByRole.get(key);
        seen.set(key, {
          role: r.role,
          ...(r.role === 'other' && r.customRole !== undefined ? { customRole: r.customRole } : {}),
          ...(salary !== undefined ? { salary } : {}),
        });
      }
    }
  }
  return [...seen.values()];
}

export function valuesToDraft(values: OrderSheetValues): JobPostingDraft {
  // 직접 조립(스프레드 없음) — JobPostingDraft 필수 필드는 TS가 강제, INITIAL 오염 원천 차단
  return {
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
      requirements: values.dates.map((date) => ({ date, timeSlots: toPostingTimeSlots(values) })),
      templateTimeSlots: toPostingTimeSlots(values),
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

/** 왕복 비교용 — draft 슬롯의 생성 id를 벗겨 구조만 비교한다. */
const stripSlotIds = (slots: PostingTimeSlot[]) =>
  slots.map((s) => ({
    startTime: s.startTime,
    roles: s.roles.map((r) => ({ role: r.role, ...(r.customRole !== undefined ? { customRole: r.customRole } : {}), count: r.count })),
  }));

export function draftToValues(draft: JobPostingDraft): OrderSheetFormValues {
  if (draft.schedule.kind !== 'dated') {
    throw new Error('주문서는 dated 스케줄(지원·급구)만 지원합니다');
  }
  // 날짜별 시간대가 상이하면 조용한 평탄화 대신 throw(리뷰 M8) — 호출부(프리셋)가 try/catch로 스킵
  const reqs = draft.schedule.requirements;
  const canonical = JSON.stringify(stripSlotIds(reqs[0]?.timeSlots ?? []));
  if (reqs.some((r) => JSON.stringify(stripSlotIds(r.timeSlots)) !== canonical)) {
    throw new Error('날짜별 시간대가 서로 달라 주문서로 표현할 수 없습니다');
  }
  const firstSlots = reqs[0]?.timeSlots ?? draft.schedule.templateTimeSlots ?? [];
  // 역할별 급여(by_role) 복원 — hourly 강제 변환 금지, 협의(other)는 그대로 유지(2026-07-14 결정)
  const roleSalaries = draft.roleCatalog
    .filter((r): r is PostingRoleCatalogEntry & { salary: SalaryInfo } => r.salary !== undefined)
    .map((r) => ({ role: r.role, ...(r.customRole !== undefined ? { customRole: r.customRole } : {}), salary: r.salary }));
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
    salary: draft.compensation.defaultSalary
      ?? roleSalaries[0]?.salary
      ?? { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly },
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

export function templateToValues(template: JobPostingTemplate): OrderSheetFormValues {
  const values = draftToValues(templateToDraft(template));
  return { ...values, dates: [] };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 그리드 프리필 — 파라미터 정규화(보안 리뷰: 비-UUID venueId drop, count 1..99 클램프) 후 직접 조립. */
export function gridParamsToValues(params: GridPrefillParams): OrderSheetFormValues {
  const base = initialOrderSheetValues();
  const venueId = params.venueId && UUID_RE.test(params.venueId) ? params.venueId : undefined;
  const count = Math.min(99, Math.max(1, Math.trunc(params.count ?? 1)));
  const hasDate = typeof params.date === 'string' && DATE_RE.test(params.date);
  if (venueId === undefined && !hasDate) return base; // 일반 생성 — venueId 키 부재 무회귀
  return {
    ...base,
    ...(venueId !== undefined ? { venueId } : {}),
    ...(hasDate
      ? {
          dates: [params.date as string],
          timeSlots: [{ startTime: DEFAULT_SLOT_START_TIME, roles: [{ role: 'dealer' as const, count }] }],
        }
      : {}),
  };
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
// orderRowMeta.ts — 폼 상태(OrderSheetFormValues = z.input)를 소비한다
export type OrderRowKey =
  | 'title' | 'place' | 'contact' | 'description'
  | 'dates' | 'time' | 'roles'
  | 'salary' | 'welfare' | 'tax'
  | 'conditions' | 'preQuestions';
export interface OrderRowState { label: string; value: string; unset: boolean; optional: boolean; }
export function getRowState(values: OrderSheetFormValues, key: OrderRowKey): OrderRowState;
export function firstUnsetRow(values: OrderSheetFormValues): OrderRowKey | null;  // 필수 행만, 그룹 순서대로
export function rowKeyForErrorField(field: string): OrderRowKey | null; // RHF errors 키 → 행 매핑 (에러 배지·시트 유도)
export const ORDER_GROUPS: ReadonlyArray<{ title: string; rows: OrderRowKey[] }>;
// OrderSheetScreen.tsx
export function OrderSheetScreen(props: {
  initialValues: OrderSheetFormValues;
  onSubmit: (values: OrderSheetValues) => Promise<void>; // handleSubmit 콜백 = z.output
  isSubmitting: boolean;
  onSwitchToLegacyForm: (type: 'fixed' | 'tournament') => void;
}): React.JSX.Element;
```

> **행 unset 시맨틱(리뷰 H5 근본 수정)**: `firstUnsetRow`의 판정은 zod 통과 가능성과 정렬돼야 한다 — 어긋나면 "라벨은 '이대로 등록'인데 눌러도 무반응"인 죽은 버튼이 생긴다. 최소 계약: `time`은 **모든** 슬롯의 startTime이 유효해야 set(하나라도 빈 값이면 unset), `roles`는 **모든** 슬롯에 역할이 1개 이상이어야 set, `salary`는 협의(other)면 set·그 외 amount>0, by_role이면 고유 역할 전부에 급여가 있어야 set. 그래도 남는 "값은 있는데 invalid" 케이스(XSS 문자열 등)는 OrderSheetScreen의 onInvalid 폴백이 처리한다.

- [ ] **Step 1: 실패하는 orderRowMeta 테스트 작성** — `__tests__/orderRowMeta.test.ts`:

```ts
import { getRowState, firstUnsetRow, ORDER_GROUPS } from '../orderRowMeta';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const emptyValues: OrderSheetFormValues = {
  postingType: 'regular', title: '', location: null, contactPhone: '010-1234-5678',
  description: '', dates: [], timeSlots: [], salary: { type: 'hourly', amount: 0 },
  useSameSalary: true, roleSalaries: [], allowances: {}, conditions: {}, usesPreQuestions: false, preQuestions: [],
};
const filled: OrderSheetFormValues = {
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
  it('빈 startTime 슬롯이 하나라도 있으면 time 행은 unset (죽은 등록버튼 방지 — H5)', () => {
    const partial = { ...filled, timeSlots: [...(filled.timeSlots ?? []), { startTime: '', roles: [{ role: 'dealer' as const, count: 1 }] }] };
    expect(getRowState(partial, 'time').unset).toBe(true);
  });
  it('역할 없는 슬롯이 하나라도 있으면 roles 행은 unset', () => {
    const partial = { ...filled, timeSlots: [...(filled.timeSlots ?? []), { startTime: '21:00', roles: [] }] };
    expect(getRowState(partial, 'roles').unset).toBe(true);
  });
  it("협의(other) 급여는 '협의'로 표기되고 unset=false", () => {
    const s = getRowState({ ...filled, salary: { type: 'other', amount: 0 } }, 'salary');
    expect(s.unset).toBe(false);
    expect(s.value).toBe('협의');
  });
  it('by_role인데 급여 없는 역할이 있으면 salary 행은 unset', () => {
    const byRole = { ...filled, useSameSalary: false, roleSalaries: [] };
    expect(getRowState(byRole, 'salary').unset).toBe(true);
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
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';
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

/** RHF errors의 최상위 필드 → 행 매핑 (에러 배지·onInvalid 시트 유도용) */
const ERROR_FIELD_TO_ROW: Record<string, OrderRowKey> = {
  title: 'title', location: 'place', contactPhone: 'contact', description: 'description',
  dates: 'dates', timeSlots: 'time', salary: 'salary', roleSalaries: 'salary',
  allowances: 'welfare', taxSettings: 'tax', conditions: 'conditions', preQuestions: 'preQuestions',
};
export function rowKeyForErrorField(field: string): OrderRowKey | null {
  return ERROR_FIELD_TO_ROW[field] ?? null;
}

const SALARY_TYPE_LABEL = { hourly: '시급', daily: '일급', monthly: '월급', other: '협의' } as const;
const WELFARE_LABEL = { guaranteedHours: '보장시간', meal: '식사', transportation: '교통', accommodation: '숙소' } as const;
const START_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const roleName = (role: string, customRole?: string) =>
  role === 'other' ? (customRole ?? '기타') : (STAFF_ROLES.find((r) => r.key === role)?.name ?? role);
const roleKey = (role: string, customRole?: string) => (role === 'other' ? `other:${customRole ?? ''}` : role);

const salaryLabel = (s: { type: keyof typeof SALARY_TYPE_LABEL; amount: number }) =>
  s.type === 'other' ? '협의' : `${SALARY_TYPE_LABEL[s.type]} ${s.amount.toLocaleString()}원`;

function summarizeRoles(values: OrderSheetFormValues): string {
  const totals = new Map<string, number>();
  for (const slot of values.timeSlots ?? []) {
    for (const r of slot.roles) {
      const name = roleName(r.role, r.customRole);
      totals.set(name, (totals.get(name) ?? 0) + r.count);
    }
  }
  return [...totals.entries()].map(([name, count]) => `${name} ${count}`).join(' · ');
}

function summarizeWelfare(values: OrderSheetFormValues): string {
  const parts = Object.entries(values.allowances ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const label = WELFARE_LABEL[k as keyof typeof WELFARE_LABEL] ?? k;
      if (k === 'guaranteedHours') return `${label} ${Number(v)}시간`;
      return v === PROVIDED_FLAG ? label : `${label} ${Number(v).toLocaleString()}`;
    });
  return parts.length > 0 ? parts.join(' · ') : '없음';
}

// FormValues(z.input)는 default 필드가 optional — 전 케이스에서 ?? 폴백으로 소비한다.
export function getRowState(values: OrderSheetFormValues, key: OrderRowKey): OrderRowState {
  switch (key) {
    case 'title':
      return { label: '제목', value: values.title, unset: values.title.length === 0, optional: false };
    case 'place':
      return { label: '장소', value: values.location?.name ?? '', unset: values.location == null, optional: false };
    case 'contact':
      return { label: '연락처', value: values.contactPhone, unset: values.contactPhone.length === 0, optional: false };
    case 'description':
      return { label: '설명', value: (values.description ?? '') || '없음', unset: false, optional: true };
    case 'dates':
      return { label: '날짜', value: values.dates.join(', '), unset: values.dates.length === 0, optional: false };
    case 'time': {
      // H5 근본 수정: 모든 슬롯의 startTime이 유효해야 set — 하나라도 빈 값이면 unset (zod와 정렬)
      const slots = values.timeSlots ?? [];
      const allValid = slots.length > 0 && slots.every((s) => START_TIME_RE.test(s.startTime));
      const starts = slots.map((s) => s.startTime).filter((t) => START_TIME_RE.test(t));
      return { label: '시간', value: allValid ? `출근 ${starts.join(' · ')}` : '', unset: !allValid, optional: false };
    }
    case 'roles': {
      // 모든 슬롯에 역할 1개 이상이어야 set (zod min(1)과 정렬)
      const slots = values.timeSlots ?? [];
      const allHaveRoles = slots.length > 0 && slots.every((s) => s.roles.length > 0);
      return { label: '역할', value: allHaveRoles ? summarizeRoles(values) : '', unset: !allHaveRoles, optional: false };
    }
    case 'salary': {
      const useSame = values.useSameSalary ?? true;
      if (!useSame) {
        // by_role: 시간대의 고유 역할 전부에 급여가 있어야 set (2026-07-14 결정)
        const roleSalaries = values.roleSalaries ?? [];
        const salaryByRole = new Map(roleSalaries.map((rs) => [roleKey(rs.role, rs.customRole), rs.salary]));
        const uniqueRoles = new Map<string, { role: string; customRole?: string }>();
        for (const slot of values.timeSlots ?? [])
          for (const r of slot.roles) uniqueRoles.set(roleKey(r.role, r.customRole), r);
        const covered = uniqueRoles.size > 0 && [...uniqueRoles.keys()].every((k) => {
          const s = salaryByRole.get(k);
          return s !== undefined && (s.type === 'other' || s.amount > 0);
        });
        const summary = [...uniqueRoles.values()]
          .map((r) => {
            const s = salaryByRole.get(roleKey(r.role, r.customRole));
            return `${roleName(r.role, r.customRole)} ${s ? (s.type === 'other' ? '협의' : s.amount.toLocaleString()) : '미정'}`;
          })
          .join(' · ');
        return { label: '급여', value: covered ? summary : '', unset: !covered, optional: false };
      }
      const { type, amount } = values.salary;
      const set = type === 'other' || amount > 0;
      return { label: '급여', value: set ? salaryLabel(values.salary) : '', unset: !set, optional: false };
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
      const c = values.conditions ?? {};
      const parts = [c.dressCode, c.experience].filter(Boolean);
      return { label: '조건', value: parts.length > 0 ? parts.join(' · ') : '없음', unset: false, optional: true };
    }
    case 'preQuestions': {
      const qs = values.preQuestions ?? [];
      return {
        label: '사전질문',
        value: (values.usesPreQuestions ?? false) && qs.length > 0 ? `${qs.length}개` : '없음',
        unset: false, optional: true,
      };
    }
  }
}

export function firstUnsetRow(values: OrderSheetFormValues): OrderRowKey | null {
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
            className={`flex-1 items-center justify-center py-2 min-h-[44px] rounded-lg ${selected ? 'bg-primary-100 border border-primary-500' : 'active:opacity-80'}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`공고 유형 ${POSTING_TYPE_INFO[t].label}`}
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
import { ChevronRightIcon } from '@/components/icons';
import type { OrderRowState } from './orderRowMeta';

export function OrderRow({ state, error, onPress, testID }: {
  state: OrderRowState; error?: string; onPress: () => void; testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 min-h-[44px] border-b border-secondary-100 dark:border-surface-overlay last:border-b-0 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={`${state.label} ${state.unset ? '미설정' : state.value}${error ? `, 오류: ${error}` : ''}`}
      testID={testID}
    >
      <Text className="w-16 text-xs text-content-secondary font-sans">{state.label}</Text>
      {state.unset ? (
        <View className="px-2 py-0.5 rounded-full bg-warning-100">
          <Text className="text-[11px] font-sans-medium text-warning-700 dark:text-warning-300">미설정</Text>
        </View>
      ) : (
        <Text
          className={`flex-1 text-sm font-sans-medium ${state.value === '없음' ? 'text-content-muted' : 'text-content-primary'}`}
          numberOfLines={1}
        >
          {state.value}
        </Text>
      )}
      {error ? <Text className="text-[11px] text-error-500 dark:text-error-400 font-sans mr-1">{error}</Text> : null}
      <ChevronRightIcon size={16} className="text-content-muted" />
    </Pressable>
  );
}
```

(`ChevronRightIcon` 등 아이콘 컴포넌트의 실제 export명·props는 `@/components/icons` index에서 확인해 맞춘다 — RegionSelectModal.tsx:4가 CheckIcon을 쓰는 패턴 참조. 배경 `bg-warning-100`·`bg-primary-100` 계열은 rgba 알파 틴트라 다크에서도 성립(tailwind.config 실측) — 텍스트 색만 다크 변형 필수.)

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
import {
  orderSheetValuesSchema,
  type OrderSheetFormValues,
  type OrderSheetValues,
} from '@/schemas/orderSheet.schema';
import { ORDER_GROUPS, firstUnsetRow, getRowState, rowKeyForErrorField, type OrderRowKey } from './orderRowMeta';
import { OrderGroup } from './OrderGroup';
import { OrderRow } from './OrderRow';
import { TypeSegment } from './TypeSegment';
import type { PostingType } from '@/types/jobPosting';

export interface OrderSheetScreenProps {
  initialValues: OrderSheetFormValues;
  onSubmit: (values: OrderSheetValues) => Promise<void>;
  isSubmitting: boolean;
  onSwitchToLegacyForm: (type: 'fixed' | 'tournament') => void;
  headerSlot?: React.ReactNode; // Task 9 프리셋 캐러셀 자리
}

export function OrderSheetScreen({ initialValues, onSubmit, isSubmitting, onSwitchToLegacyForm, headerSlot }: OrderSheetScreenProps) {
  // 3제네릭 필수(Global Constraints·스파이크 실측): 폼 상태=z.input, handleSubmit 콜백=z.output
  const form = useForm<OrderSheetFormValues, unknown, OrderSheetValues>({
    resolver: zodResolver(orderSheetValuesSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  });
  const values = form.watch();
  const { errors } = form.formState;
  const [activeSheet, setActiveSheet] = useState<OrderRowKey | null>(null);

  /** 행 키 → RHF 첫 에러 메시지 (행 에러 배지 배선 — 리뷰 H5/설계 스펙 "행 단위 에러 배지") */
  const rowError = useCallback((key: OrderRowKey): string | undefined => {
    const entry = Object.entries(errors).find(([field]) => rowKeyForErrorField(field) === key);
    const err = entry?.[1] as { message?: string } | undefined;
    return typeof err?.message === 'string' ? err.message : undefined;
  }, [errors]);

  const handleTypeChange = useCallback((t: PostingType) => {
    if (t === 'fixed' || t === 'tournament') {
      onSwitchToLegacyForm(t); // dirty 확인 다이얼로그는 create.tsx(Step 6)에서 처리
      return;
    }
    form.setValue('postingType', t, { shouldDirty: true });
  }, [form, onSwitchToLegacyForm]);

  const handleSubmitPress = form.handleSubmit(
    (valid) => onSubmit(valid),
    (submitErrors) => {
      // 1순위: 미설정 행 순차 유도. 2순위(값은 있는데 invalid — XSS 문자열·프리필 이상치): 첫 에러 행 시트 열기.
      // 3순위: 매핑 실패 시 토스트 폴백 — "버튼이 아무 반응 없는" 죽은 상태 금지(리뷰 H5·보안 4).
      const next = firstUnsetRow(values)
        ?? Object.keys(submitErrors).map(rowKeyForErrorField).find((k): k is OrderRowKey => k !== null)
        ?? null;
      if (next !== null) {
        setActiveSheet(next);
        return;
      }
      // 기존 토스트 유틸 사용 (create.tsx의 addToast 패턴 grep 후 동일 경로로)
      // addToast({ type: 'error', message: '입력값을 확인해주세요' });
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
                error={rowError(key)}
                onPress={() => setActiveSheet(key)}
                testID={`order-sheet-row-${key}`}
              />
            ))}
          </OrderGroup>
        ))}
      </ScrollView>
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-surface-page border-t border-secondary-100 dark:border-surface-overlay">
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

// 주문서 초기값: 그리드 프리필 흡수(정규화 내장) + 프로필 연락처 프리필(리뷰 H4 — "재공고 타이핑 0")
const initialValues = useMemo(
  () => ({
    ...gridParamsToValues({ venueId, date: prefillDate, count: prefillCount }),
    contactPhone: user?.phone ?? '',
  }),
  [venueId, prefillDate, prefillCount, user?.phone]
);

const handleOrderSheetSubmit = useCallback(async (values: OrderSheetValues) => {
  try {
    const input = valuesToCreateInput(values);
    const created = await createJobPosting.mutateAsync({ input });
    setIsDirty(false);
    // 성공 네비게이션은 Task 10에서 완료 화면으로 교체 — 그 전까지 기존 로직 유지
    if (venueId && router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)/employer');
  } catch (error) {
    // 기존 create.tsx handleSubmit(:80-104)과 동일 — unhandled rejection 금지(리뷰 MEDIUM)
    logger.error('주문서 공고 등록 실패:', toError(error));
  }
}, [createJobPosting, venueId, router]);

const handleSwitchToLegacyForm = useCallback((t: 'fixed' | 'tournament') => {
  // 주문서 입력이 있으면 무경고 소실 금지(리뷰 M7) — 확인 후 전환
  const doSwitch = () => { setLegacyType(t); updateFormData({ postingType: t }); };
  if (isDirty) {
    Alert.alert('작성 중인 내용이 있어요', '고정·대회 공고는 상세 폼에서 작성해요. 지금까지 입력한 내용은 사라져요.', [
      { text: '취소', style: 'cancel' },
      { text: '전환', style: 'destructive', onPress: doSwitch },
    ]);
  } else {
    doSwitch();
  }
}, [isDirty, updateFormData]);

if (!isLegacyForm) {
  return (
    <OrderSheetScreen
      initialValues={initialValues}
      onSubmit={handleOrderSheetSubmit}
      isSubmitting={createJobPosting.isPending}
      onSwitchToLegacyForm={handleSwitchToLegacyForm}
    />
  );
}
// 이하 기존 JobPostingScrollForm 렌더 (고정·대회 전용) — postingType 초기값을 legacyType으로.
// 복귀 경로(리뷰 M7): 레거시 폼의 타입 선택이 regular/urgent로 바뀌면 setLegacyType(null)로 주문서 복귀
// (기존 formData.postingType 변경 지점에 연결 — JobPostingScrollForm이 쓰는 updateFormData 경유 확인).
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
        value={text} onChangeText={setText} maxLength={25}
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

- [ ] **Step 2: PlaceSheet** — 최근 장소 리스트 + 새 장소 입력 + **지역 선택 인라인**(3단 모드):

> ⚠️ **RegionSelectModal 사용 금지(리뷰 CRITICAL C1 — 실측 확정)**: RegionSelectModal은 `@/components/ui/Modal`(RN Modal) 기반이라 SheetModal(RN Modal) 안에서 열면 중첩 Modal iOS 터치먹통(#186/#188)이 정확히 재발한다. embedded 모드도 없어 "문제 시 overlay 이동"이 불가능 — 처음부터 시트 내부 `mode: 'region'`으로 지역 리스트를 **인라인 렌더**한다. 데이터 소스는 RegionSelectModal과 동일한 `REGION_GROUPS`/`REGIONS_BY_GROUP`(`@/constants/regions`) — 렌더 로직은 RegionSelectModal.tsx:77-85를 참조해 복사.

```tsx
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { CheckIcon } from '@/components/icons';
import { REGION_GROUPS, REGIONS_BY_GROUP } from '@/constants/regions';
import type { PostingLocation } from '@/types/jobPosting';

export function PlaceSheet({ visible, value, recentLocations, onConfirm, onClose }: {
  visible: boolean; value: PostingLocation | null; recentLocations: PostingLocation[];
  onConfirm: (next: PostingLocation) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<'list' | 'new' | 'region'>('list');
  const [draft, setDraft] = useState<PostingLocation>({ name: '' });
  useEffect(() => { if (visible) { setMode(recentLocations.length > 0 ? 'list' : 'new'); setDraft(value ?? { name: '' }); } }, [visible, value, recentLocations.length]);

  return (
    <SheetModal visible={visible} onClose={onClose}
      title={mode === 'region' ? '지역 선택' : '어디서 일하나요?'}
      footer={mode === 'new'
        ? <Button onPress={() => { onConfirm(draft); onClose(); }} disabled={draft.name.trim().length === 0}>확인</Button>
        : undefined}>
      {mode === 'list' && (
        <View className="gap-2">
          {recentLocations.map((loc) => (
            <Pressable key={`${loc.name}:${loc.address ?? ''}`} onPress={() => { onConfirm(loc); onClose(); }}
              className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] active:opacity-80">
              <Text className="text-sm font-sans-medium text-content-primary">{loc.name}</Text>
              {loc.address ? <Text className="text-xs text-content-muted font-sans">{loc.address}</Text> : null}
            </Pressable>
          ))}
          <Pressable onPress={() => setMode('new')}
            className="rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-4 py-3 min-h-[44px] items-center active:opacity-80">
            <Text className="text-sm text-content-secondary font-sans">＋ 새 장소 입력</Text>
          </Pressable>
        </View>
      )}
      {mode === 'new' && (
        <View className="gap-2">
          {recentLocations.length > 0 && (
            <Pressable onPress={() => setMode('list')} className="min-h-[44px] justify-center active:opacity-80"
              accessibilityRole="button" accessibilityLabel="최근 장소 목록으로 돌아가기">
              <Text className="text-xs text-content-secondary font-sans">‹ 최근 장소에서 선택</Text>
            </Pressable>
          )}
          <TextInput value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} maxLength={50}
            placeholder="장소명 (예: 라운더스 홀덤펍)" testID="order-sheet-place-name"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary" />
          <TextInput value={draft.address ?? ''} onChangeText={(address) => setDraft((d) => ({ ...d, address }))} maxLength={200}
            placeholder="주소"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary" />
          <Pressable onPress={() => setMode('region')}
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] active:opacity-80"
            accessibilityRole="button">
            <Text className="text-sm text-content-primary font-sans">{draft.region ? `지역: ${draft.region}` : '지역 선택 (선택)'}</Text>
          </Pressable>
        </View>
      )}
      {mode === 'region' && (
        <View className="gap-3">
          {REGION_GROUPS.map((group) => (
            <View key={group}>
              <Text className="text-xs font-sans-bold text-content-secondary mb-1.5">{group}</Text>
              <View className="flex-row flex-wrap gap-2">
                {REGIONS_BY_GROUP[group].map((r) => {
                  const selected = draft.region === r.slug;
                  return (
                    <Pressable key={r.slug}
                      onPress={() => { setDraft((d) => ({ ...d, region: r.slug })); setMode('new'); }}
                      className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${selected ? 'border-primary-500 bg-primary-100' : 'border-secondary-200 dark:border-surface-overlay'} active:opacity-80`}
                      accessibilityRole="radio" accessibilityState={{ selected }}>
                      <View className="flex-row items-center gap-1">
                        {selected ? <CheckIcon size={14} className="text-primary-600 dark:text-primary-400" /> : null}
                        <Text className={`text-sm font-sans-medium ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'}`}>{r.name}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </SheetModal>
  );
}
```

`recentLocations`는 부모가 계산: 템플릿들의 `templateData.location` + 현재 값 — 중복 제거(name+address 키). `RegionOption`의 실제 필드명(slug/name)은 `@/constants/regions`에서 확인해 맞춘다. 참고(보안 리뷰 LOW): 제출 시 `toCanonicalLocation`(serialization.ts:89-103)이 `district ?? address` 우선순위로 흡수하므로 PlaceSheet는 district를 수집하지 않는다 — 프리셋 로드로 district가 있는 location이 들어오면 address보다 district가 우선 표시됨을 인지.

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
- Create: `sheets/TimeSlotsSheet.tsx`, `sheets/RolesSheet.tsx` (DateSheet는 별도 파일 불필요 — DatePickerModal 직접 렌더)
- Modify: `src/components/employer/job-form/modals/DatePickerModal.tsx` (additive `initialSelectedDates` prop — 아래 Step 1)
- Modify: `OrderSheetScreen.tsx` (장착)

**Interfaces:**
- Consumes: `DatePickerModal`(기존 — visible/onClose/onSelectDates/postingType/existingDates), `TimeWheelPicker`(기존 — embedded), `STAFF_ROLES`.
- Produces: `OrderSheetValues['timeSlots']` 편집 계약 — RolesSheet는 `slotIndex`를 받아 해당 슬롯의 roles만 편집.

- [ ] **Step 1: 날짜 — DatePickerModal에 `initialSelectedDates` prop 추가 후 직접 렌더**

> ⚠️ 리뷰 HIGH(H1 — 실측 확정): DatePickerModal은 **추가 전용** 시맨틱이다 — `remainingSlots = maxDates - existingDates.length`(:65), `existingDates`는 `disabledDates`(선택 불가)로 들어가고(:236) `selectedDates`는 빈 배열로 시작, `onSelectDates`는 새로 고른 날짜만 반환한다. 계획 초안처럼 `existingDates={values.dates}`로 열면 ①기존 날짜 재선택 불가 → 확인 시 기존 선택 전부 유실 ②이미 maxDates(지원·급구 7일)를 채웠으면 remainingSlots=0 → **날짜를 바꿀 방법이 없는 데드엔드**.

수정: DatePickerModal에 **additive optional prop** `initialSelectedDates?: string[]`를 추가한다 — 전달되면 `selectedDates` 초기 상태를 이 값으로 시드(재선택·해제 가능)하고 remainingSlots 계산은 `maxDates - (existingDates.length)` 그대로(기존 호출부 무회귀 — prop 미전달 시 동작 동일). 주문서에서는:

```tsx
{activeSheet === 'dates' && (
  <DatePickerModal visible onClose={() => setActiveSheet(null)}
    postingType={values.postingType} existingDates={[]}
    initialSelectedDates={values.dates}
    onSelectDates={(dates) => {
      form.setValue('dates', dates, { shouldDirty: true, shouldValidate: true });
      setActiveSheet(null);
    }} />
)}
```

스펙 확정: **달력만** — 퀵칩·부가 UI 추가하지 않는다. (서술 정정 — 리뷰 M5: GroupingConfirmModal은 DatePickerModal 내부가 아니라 DateRequirementsSection.tsx:304 소관이다. 주문서는 전 날짜 동일 시간대 모델이라 그룹화 확인 플로우는 **이번 슬라이스 의도적 제외** — totalPositions는 역할별 peak 방식(stats.ts)이라 수치 영향 없음, 연속기간 그룹 표시만 다름.)

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
              <Text className="flex-1 text-sm font-sans-medium text-content-primary">{label(r)}</Text>
              {/* 추가된 역할 행에도 ±1 스테퍼 — 스펙 §3 "역할별 인원 스테퍼"(리뷰 M6: 삭제 후 재추가 강요 금지) */}
              <View className="flex-row items-center gap-1">
                <Pressable onPress={() => setRoles((prev) => prev.map((x, idx) => (idx === i ? { ...x, count: Math.max(1, x.count - 1) } : x)))}
                  className="w-11 h-11 items-center justify-center active:opacity-80" accessibilityRole="button" accessibilityLabel={`${label(r)} 인원 줄이기`}>
                  <MinusIcon size={16} className="text-content-primary" />
                </Pressable>
                <Text className="text-sm font-sans-bold text-content-primary w-8 text-center">{r.count}명</Text>
                <Pressable onPress={() => setRoles((prev) => prev.map((x, idx) => (idx === i ? { ...x, count: Math.min(99, x.count + 1) } : x)))}
                  className="w-11 h-11 items-center justify-center active:opacity-80" accessibilityRole="button" accessibilityLabel={`${label(r)} 인원 늘리기`}>
                  <PlusIcon size={16} className="text-content-primary" />
                </Pressable>
                <Pressable onPress={() => setRoles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="w-11 h-11 items-center justify-center active:opacity-80" accessibilityRole="button" accessibilityLabel={`${label(r)} 삭제`}>
                  <TrashIcon size={16} className="text-content-muted" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </SheetModal>
  );
}
```

(Minus/Plus/Trash 아이콘의 실제 export명은 `@/components/icons`에서 확인 — 없으면 존재하는 동등 아이콘으로 대체. 상단 "추가 전" 스테퍼(`w-9 h-9`)도 UI 공통 체크리스트에 따라 44pt로 키우고 글리프를 아이콘으로 교체한다.)

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

- [ ] **Step 1: SalarySheet** — 세그먼트(시급/일급/월급/**협의**) + 시급만 ±1,000 스테퍼, 일급·월급은 기본값+직접입력, **동일급여 OFF 시 역할별 급여 입력**(2026-07-14 사용자 결정 2건 반영):

```tsx
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { DEFAULT_SALARY_BY_TYPE, HOURLY_STEP } from '@/utils/order-sheet/mappers';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Salary = OrderSheetValues['salary'];
type RoleSalaries = OrderSheetValues['roleSalaries'];
const TYPE_LABELS = [
  { type: 'hourly', label: '시급' }, { type: 'daily', label: '일급' },
  { type: 'monthly', label: '월급' }, { type: 'other', label: '협의' },
] as const;

export function SalarySheet({ visible, value, useSameSalary, roleSalaries, uniqueRoles, onConfirm, onClose }: {
  visible: boolean; value: Salary; useSameSalary: boolean;
  roleSalaries: RoleSalaries;
  uniqueRoles: Array<{ role: RoleSalaries[number]['role']; customRole?: string; label: string }>; // 부모가 timeSlots에서 유도
  onConfirm: (next: { salary: Salary; useSameSalary: boolean; roleSalaries: RoleSalaries }) => void; onClose: () => void;
}) {
  const [salary, setSalary] = useState<Salary>(value.amount > 0 || value.type === 'other' ? value : { type: 'hourly', amount: DEFAULT_SALARY_BY_TYPE.hourly });
  const [same, setSame] = useState(useSameSalary);
  const [perRole, setPerRole] = useState<RoleSalaries>(roleSalaries);
  const [directInput, setDirectInput] = useState(false);

  const switchType = (type: Salary['type']) => {
    // 협의(other)는 금액 없음 — { type: 'other', amount: 0 } (문서 게이트 min(0) 허용 실측)
    setSalary({ type, amount: type === 'other' ? 0 : DEFAULT_SALARY_BY_TYPE[type] });
    setDirectInput(type !== 'hourly' ? false : directInput);
  };

  const perRoleValid = uniqueRoles.every((u) => {
    const s = perRole.find((p) => p.role === u.role && p.customRole === u.customRole)?.salary;
    return s !== undefined && (s.type === 'other' || s.amount > 0);
  });
  const confirmDisabled = same ? salary.type !== 'other' && salary.amount <= 0 : !perRoleValid;

  return (
    <SheetModal visible={visible} onClose={onClose} title="급여"
      footer={<Button onPress={() => { onConfirm({ salary, useSameSalary: same, roleSalaries: same ? [] : perRole }); onClose(); }} disabled={confirmDisabled}>확인</Button>}>
      <View className="flex-row gap-1 p-1 rounded-xl bg-surface-card border border-secondary-200 dark:border-surface-overlay mb-3">
        {TYPE_LABELS.map(({ type, label }) => (
          <Pressable key={type} onPress={() => switchType(type)}
            className={`flex-1 items-center justify-center py-2 min-h-[44px] rounded-lg ${salary.type === type ? 'bg-primary-100 border border-primary-500' : 'active:opacity-80'}`}
            accessibilityRole="radio" accessibilityState={{ selected: salary.type === type }}>
            <Text className={`text-sm font-sans-medium ${salary.type === type ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-700 dark:text-secondary-300'}`}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {salary.type === 'other' ? (
        <View className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-2">
          <Text className="text-sm text-content-secondary font-sans">급여는 지원자와 협의로 결정해요 — 금액 없이 등록돼요</Text>
        </View>
      ) : salary.type === 'hourly' && !directInput ? (
        <View className="flex-row items-center justify-between rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-2 mb-2">
          <Pressable onPress={() => setSalary((s) => ({ ...s, amount: Math.max(HOURLY_STEP, s.amount - HOURLY_STEP) }))}
            className="w-11 h-11 items-center justify-center active:opacity-80" testID="order-sheet-salary-minus"
            accessibilityRole="button" accessibilityLabel="시급 1,000원 내리기">
            <MinusIcon size={20} className="text-content-primary" />
          </Pressable>
          <Text className="text-lg font-sans-bold text-content-primary">{salary.amount.toLocaleString()}<Text className="text-xs text-content-muted"> 원</Text></Text>
          <Pressable onPress={() => setSalary((s) => ({ ...s, amount: s.amount + HOURLY_STEP }))}
            className="w-11 h-11 items-center justify-center active:opacity-80" testID="order-sheet-salary-plus"
            accessibilityRole="button" accessibilityLabel="시급 1,000원 올리기">
            <PlusIcon size={20} className="text-content-primary" />
          </Pressable>
        </View>
      ) : (
        <TextInput
          value={salary.amount > 0 ? String(salary.amount) : ''} keyboardType="number-pad"
          onChangeText={(t) => setSalary((s) => ({ ...s, amount: Number.parseInt(t.replace(/[^0-9]/g, ''), 10) || 0 }))}
          placeholder={`기본값 ${DEFAULT_SALARY_BY_TYPE[salary.type as 'hourly' | 'daily' | 'monthly'].toLocaleString()}원`}
          className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 mb-2 text-content-primary" />
      )}
      {salary.type === 'hourly' && (
        <Pressable onPress={() => setDirectInput((v) => !v)} className="mb-3 min-h-[44px] justify-center active:opacity-80" accessibilityRole="button">
          <Text className="text-xs text-content-secondary font-sans">{directInput ? '스테퍼로 조절 (±1,000원)' : '직접 입력'}</Text>
        </Pressable>
      )}
      <Pressable onPress={() => setSame((v) => !v)}
        className={`flex-row items-center gap-2 rounded-xl border px-4 py-3 min-h-[44px] ${same ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 dark:border-surface-overlay'} active:opacity-80`}
        accessibilityRole="checkbox" accessibilityState={{ checked: same }}>
        <Text className="text-sm font-sans-medium text-content-primary">모든 역할 동일 급여</Text>
      </Pressable>
      {!same && (
        <View className="mt-3 gap-2">
          {/* 역할별 급여(2026-07-14 결정) — 타입은 공통 세그먼트를 따르고 금액만 역할별 입력. */}
          {uniqueRoles.map((u) => {
            const entry = perRole.find((p) => p.role === u.role && p.customRole === u.customRole);
            const setRoleAmount = (t: string) => {
              const amount = Number.parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
              setPerRole((prev) => [
                ...prev.filter((p) => !(p.role === u.role && p.customRole === u.customRole)),
                { role: u.role, ...(u.customRole !== undefined ? { customRole: u.customRole } : {}),
                  salary: { type: salary.type, amount: salary.type === 'other' ? 0 : amount } },
              ]);
            };
            return (
              <View key={`${u.role}:${u.customRole ?? ''}`} className="flex-row items-center gap-3 rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-2.5">
                <Text className="flex-1 text-sm font-sans-medium text-content-primary">{u.label}</Text>
                {salary.type === 'other' ? (
                  <Text className="text-sm text-content-muted font-sans">협의</Text>
                ) : (
                  <TextInput value={entry && entry.salary.amount > 0 ? String(entry.salary.amount) : ''}
                    onChangeText={setRoleAmount} keyboardType="number-pad" placeholder="금액"
                    className="w-28 rounded-lg border border-secondary-200 dark:border-surface-overlay px-2 py-1.5 text-right text-sm text-content-primary" />
                )}
              </View>
            );
          })}
        </View>
      )}
    </SheetModal>
  );
}
```

부모(OrderSheetScreen) 배선: `uniqueRoles`는 `values.timeSlots`의 역할을 roleKey 기준 중복 제거해 전달(라벨은 orderRowMeta의 roleName 재사용). 확정 시 `form.setValue('salary', next.salary)` + `form.setValue('useSameSalary', next.useSameSalary)` + `form.setValue('roleSalaries', next.roleSalaries)` (전부 `{ shouldDirty: true, shouldValidate: true }`). 역할이 아직 없는 상태에서 토글 OFF면 "역할을 먼저 추가해주세요" 안내 텍스트를 목록 자리에 표시.

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
  // ⚠️ 리뷰 CRITICAL: 키별 분기 필수 — guaranteedHours에 PROVIDED_FLAG(-1) 폴백을 쓰면
  // 문서 게이트 min(0)(jobPosting.schema.ts:58)이 reject해 등록 자체가 죽는다.
  // 또 '0' 입력이 제공(-1)으로 둔갑하는 시맨틱 플립 금지(보안 리뷰). zod측 가드는 Task 4
  // orderSheetAllowancesSchema가 담당 — 여기는 UX 시맨틱만.
  const setAmount = (key: keyof Welfare, text: string) =>
    setWelfare((prev) => {
      const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
      if (key === 'guaranteedHours') {
        // 시간값: 빈/무효 입력은 기본 4시간, 0 입력은 체크 해제와 동일(키 삭제)
        if (Number.isNaN(parsed)) return { ...prev, guaranteedHours: 4 };
        if (parsed <= 0) { const next = { ...prev }; delete next.guaranteedHours; return next; }
        return { ...prev, guaranteedHours: parsed };
      }
      // 금액 3종: 빈/0 입력 = 금액 없는 '제공' 체크(PROVIDED_FLAG)
      return { ...prev, [key]: Number.isNaN(parsed) || parsed <= 0 ? PROVIDED_FLAG : parsed };
    });

  return (
    <SheetModal visible={visible} onClose={onClose} title="복지 (선택)"
      footer={<Button onPress={() => { onConfirm(welfare); onClose(); }}>확인</Button>}>
      <View className="gap-2">
        {ITEMS.map(({ key, label }) => {
          const v = welfare[key];
          const checked = v !== undefined;
          return (
            <View key={key} className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${checked ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 dark:border-surface-overlay bg-surface-card'}`}>
              <Pressable onPress={() => toggle(key)} className="flex-row items-center gap-3 flex-1 min-h-[44px] active:opacity-80"
                accessibilityRole="checkbox" accessibilityState={{ checked }} testID={`order-sheet-welfare-${key}`}>
                <View className={`w-5 h-5 rounded-md border ${checked ? 'bg-primary-500 border-primary-500' : 'border-secondary-300 dark:border-surface-overlay'}`} />
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

> 세금 기본값 확정(2026-07-14 사용자 결정): 공고 기본은 **세금 미설정('세금 없음' 표시)** — 레거시 패리티, 실수로 원천징수가 붙는 금전 사고 방지. TaxSheet를 열면 3.3%가 **제안값**으로 시드되고, [확인]을 눌러야만 반영된다(닫기만 하면 미설정 유지). 시트를 열고 바로 확인하면 3.3%가 되는 것은 의도된 제안 동작 — 확인 버튼 위에 현재 선택값이 명확히 보이는 TaxSettingsEditor 인라인 라디오라 오조작 위험 낮음.

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

- [ ] **Step 5: PreQuestionsSheet** — QuestionCard 패턴 동형 구현 (임베드 금지):

> ⚠️ 리뷰 CRITICAL(C2 — 실측 확정): `PreQuestionsSection`은 내부에서 `ActionSheet`(답변유형 선택, :160)를 쓰고 ActionSheet는 ui/Modal(RN Modal) 기반(ActionSheet.tsx:65)이다. SheetModal 안에 임베드하면 중첩 Modal iOS 터치먹통 재발 — **임베드 옵션 폐기**.

`PreQuestionsSection` 내부의 QuestionCard 패턴을 복사해 `sheets/PreQuestionsSheet.tsx`에 질문 목록+추가를 동형 구현하되(최대 10개 제한 유지 — zod `preQuestionsArraySchema.max(10)`이 게이트), **답변유형 선택은 ActionSheet 대신 인라인 라디오 3버튼**(단답/장문/선택형 — `accessibilityRole="radio"`+selected state, TaxSettingsEditor:198-230 세그먼트 패턴)으로 구현한다. SheetModal은 `fullHeight`. select 유형의 options 입력은 Task 4 스키마의 superRefine(options xss)이 검증한다.

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
- Produces: `PresetCarousel({ presets, onSelect, onSavePress })` — preset = `{ id: string; title: string; subtitle: string; values: OrderSheetFormValues }`. `onSavePress`는 "+저장" 카드(스펙 §2 캐러셀 3요소 — 리뷰 M5로 누락 복원).

- [ ] **Step 1: "마지막 공고" 데이터 소스 — `useMyJobPostings` 훅 사용 (실측 확정)**

`useMyJobPostings()`가 `src/hooks/useJobManagement.ts:71`에 **이미 존재**한다(리뷰 실측 — 대체 쿼리 코드 불필요). 이 훅으로 내 공고 목록에서 최신 1건을 가져와 `buildJobPostingDraft`(=`jobPostingToDraft` thin wrapper, submission.ts:41)→`draftToValues`→`{...values, dates: []}`로 "마지막 공고" 프리셋을 만든다. 훅의 정렬·최신 1건 파라미터는 훅 시그니처를 열어 맞춘다.

(**fixed/tournament 공고와 날짜별 시간대가 상이한 공고는 프리셋에서 제외** — `draftToValues`가 둘 다 throw하므로 try/catch로 스킵. Task 4 계약.)

- [ ] **Step 2: PresetCarousel 구현**

```tsx
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

export interface OrderSheetPreset { id: string; title: string; subtitle: string; values: OrderSheetFormValues; }

export function PresetCarousel({ presets, onSelect, onSavePress }: {
  presets: OrderSheetPreset[]; onSelect: (preset: OrderSheetPreset) => void; onSavePress: () => void;
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
          className="min-w-[130px] min-h-[44px] rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-3 py-2.5 active:opacity-80"
          accessibilityRole="button" accessibilityLabel={`프리셋 ${p.title} 적용`}
          testID={`order-sheet-preset-${p.id}`}>
          <Text className="text-xs font-sans-bold text-content-primary" numberOfLines={1}>{p.title}</Text>
          <Text className="text-[11px] text-content-muted font-sans" numberOfLines={1}>{p.subtitle}</Text>
        </Pressable>
      ))}
      {/* "+저장" 카드 — 스펙 §2 캐러셀 3요소(리뷰 M5 복원): 현재 주문서 구성을 템플릿으로 저장 */}
      <Pressable onPress={onSavePress}
        className="min-w-[72px] min-h-[44px] rounded-xl border border-dashed border-secondary-300 dark:border-surface-overlay px-3 py-2.5 items-center justify-center active:opacity-80"
        accessibilityRole="button" accessibilityLabel="현재 구성을 프리셋으로 저장"
        testID="order-sheet-preset-save">
        <Text className="text-xs text-content-secondary font-sans">＋ 저장</Text>
      </Pressable>
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

"+저장" 카드(`onSavePress`)는 `templateManager.openTemplateModal()` + 기존 `TemplateModal` 배선으로 연결 — 현재 폼 values의 `valuesToDraft` 결과를 저장 대상으로 전달(현재 create.tsx가 쓰는 배선 재사용).

> ⚠️ 실측 함정(리뷰): `handleSaveTemplate(draft)`는 내부 `templateName`(별도 state)이 비어 있으면 **조용히 no-op**한다(useTemplateManager.ts:167-172). 직접 호출 금지 — 반드시 이름 입력이 있는 `openTemplateModal`+`TemplateModal` 경유로 저장한다.

- [ ] **Step 4: 첫 등록 프리셋 저장 제안** — 완료 화면(Task 10)에서: `templateManager.templates.length === 0`이면 "이 구성을 프리셋으로 저장하면 다음엔 2탭이면 끝나요" 배너 + 저장 버튼(**openTemplateModal 경유** — 위 함정 참조). Task 10에서 함께 구현하므로 여기서는 호출 계약만 만들어 둔다(등록 직전 values를 create-success로 전달).

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
- Consumes: `useCreateJobPosting` 반환값 — **실측 확정**: `CreateJobPostingResult { id: string; jobPosting: JobPosting }`(IJobPostingRepository.ts:60-63, repository→service→훅 통과 확인) — `created.id` 바로 사용. 공유는 `useShare().shareJobById(jobId)`(useShare.ts:39) — **id만으로 내부에서 상세 조회 후 공유하는 함수가 이미 있음**(실측) — 별도 상세 훅 로드 불필요.
- Produces: 라우트 `/(employer)/my-postings/create-success?id=<uuid>`.

- [ ] **Step 1: create-success 화면 구현**

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { CheckIcon } from '@/components/icons';

export default function CreateSuccessScreen() {
  const { id, title, summary, suggestPreset } = useLocalSearchParams<{
    id: string; title?: string; summary?: string; suggestPreset?: string;
  }>();
  const postingId = Array.isArray(id) ? id[0] : id;

  return (
    <View className="flex-1 bg-surface-page px-5 justify-center">
      <View className="items-center mb-6">
        <View className="w-14 h-14 rounded-full bg-success-100 items-center justify-center mb-3">
          <CheckIcon size={28} className="text-success-600 dark:text-success-400" />
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

공유 버튼: `useShare().shareJobById(postingId)`를 그대로 호출하는 "카카오톡으로 공유" 버튼을 최상단에 추가한다(실측 — id만으로 내부 조회+공유, `isSharing`으로 로딩 disabled). `Button`의 `variant` prop은 실재 확인됨(Button.tsx:24-44).

프리셋 저장 배너의 [저장] 버튼: `useTemplateManager().openTemplateModal` + `TemplateModal` 재사용 — create.tsx에서 이미 쓰는 배선을 이 화면에도 추가하되, 저장할 draft는 `useLocalSearchParams`로 넘기기엔 크므로 **createJobPosting 성공 시 zustand 없이 모듈 레벨 1회성 캐시**(`src/utils/order-sheet/lastSubmitted.ts` — `export let lastSubmittedDraft: JobPostingDraft | null` + setter)로 전달한다.

- [ ] **Step 2: create.tsx 성공 분기 교체**

```tsx
// Task 5의 try/catch + logger 골격 유지 — 성공 분기만 교체
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
      id: created.id, // CreateJobPostingResult { id, jobPosting } — 실측 확정
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

- [ ] **Step 1: e2e create 경로 갱신 — 대상 3케이스 (리뷰 실측)**

`employer-posting-crud.spec.ts`에서 갱신 대상은 1구간이 아니라 **3케이스**다(리뷰 실측 — 라인은 재확인):
1. `:122 부근` required controls 케이스 — 주문서 행 testID(`order-sheet-row-*`) 기준으로 교체.
2. `:133 부근` empty submit 케이스 — 주문서에선 빈 제출 시 **첫 미설정 행 시트가 열리는** 동작으로 단언 변경(제출 차단 텍스트 아님).
3. `:142 부근` title cap 케이스 — `job-posting-title-input` → `order-sheet-title-input`으로 교체.

생성 해피패스: `order-sheet-row-title` 탭 → 입력 → 확인 → `order-sheet-row-place` → … → `job-posting-create-submit` 탭 → create-success 확인(`create-success-view` 존재 단언) → 공고 보기. 고정(fixed) 생성 케이스가 스펙에 있으면 `order-sheet-type-fixed` 탭 → 기존 폼 진입 후 기존 시나리오 유지. (`ui-components.spec.ts:159`도 create에 진입하지만 방어적 작성(isVisible().catch)이라 무수정 — 실행으로 확인만.)

- [ ] **Step 2: 로컬 e2e 스모크**

Run: `node scripts/run-e2e.js` (실측 — package.json `e2e` 스크립트가 raw playwright가 아니라 이 러너를 경유. 단일 스펙 필터 인자는 스크립트를 열어 확인)
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

1. `20260714000000_job_postings_conditions.sql` prod 적용 — `mcp__supabase__apply_migration`. **파리티 가드 무해 실측 확정**(DB 리뷰): `parity_baseline_guard.test.sql` 7단언은 함수 카운트 163·정책 카운트 104·gen-1 부활·SECDEF pg_temp만 검사하고 **테이블/컬럼은 세지 않음**. CI parity-smoke도 동일(주 1회 schedule 전용, PR 게이트 아님) — 기대값 갱신 불필요, pgTAP 실행으로 재확인만. ⚠️ PR 직전 master 재통합 시 `20260714*` 타임스탬프 중복 여부 확인 — 충돌 시 이쪽(나중 머지)이 늦은 타임스탬프로 `git mv`(내용 무변경, wiki `decisions/migration-timestamp-collision`).
2. push / PR 생성 (명시 요청 시).
3. OTA 출하 — JS-only이므로 가능. **직전 origin/master 재fetch+ff 필수**(메모리 `feedback_ota_refetch_local_tree_before_update`).
4. 실기기 QA: 주문서 시트 iOS 터치 확인 — PlaceSheet 인라인 지역 모드(RegionSelectModal 미사용으로 설계 변경됨), TimeSlotsSheet 안 TimeWheelPicker embedded(overlay 슬롯), DatePickerModal 단독 오픈.
