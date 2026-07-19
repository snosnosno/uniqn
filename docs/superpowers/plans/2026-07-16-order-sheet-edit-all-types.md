# S3 — 전 타입 편집 주문서화 구현 계획 (2026-07-16)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고 편집(`edit.tsx`)을 전 타입(지원·급구·대회·고정) 주문서(`OrderSheetScreen`) 단일 경로로 이관하고, 주문서 값 → 수정 입력 매퍼(`valuesToUpdateInput`)를 레거시와 등가로 신설하며, 대회 편집 시 `approvalStatus`를 보존한다(설계 확정 ⑥).

**Architecture:** 주문서 UI → orderSheet.schema → mappers(`valuesToUpdateInput` 신설 — 레거시 `draftToUpdateJobPostingInput` 위임으로 신·구 등가성 구조 보장) → `useUpdateJobPosting` → Service → Repository → Supabase. 서버 무변경(마이그·RLS·EF·직렬화 0 — JSON-only OTA 유지).

**Tech Stack:** Expo 55 / RN 0.83 / React 19 / TS strict / RHF+zodResolver 3제네릭 / Jest + @testing-library/react-native

**설계 SSOT:** `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md` §2·§5·§6-3·§7·§8

## Global Constraints

- 한글(주석·커밋·문구) · `logger`(console.log 금지) · `dark:` 항상(라인하이트 다크 가산 — 감산 역전 금지) · `@/` 절대경로 · toast/Alert · camelCase
- 아이콘 `@/components/icons` stroke 2.0 · 커밋 `<type>(<scope>): 한글`
- zodResolver 3제네릭 `useForm<z.input, unknown, z.output>` 유지
- `guaranteedHours` PROVIDED_FLAG(-1) 금지
- **서버 무변경**: `supabase/`·`functions/`·`src/domains/job-posting/serialization.ts` 산출 계약 변경 0. update 경로가 서버 함수를 요구하면 STOP 후 사용자 보고
- 작업 디렉토리 `uniqn-mobile/`. 커밋 직전마다 `git branch --show-current` == `docs/order-sheet-unification-design` 재확인(병렬 세션이 워킹트리를 master로 되돌린 실증 있음). 리베이스·리셋·amend 금지, append 커밋만
- S4 범위(레거시 제거) 침범 금지 — `JobPostingScrollForm`·`draftAdapter`·create.tsx 사문 분기는 그대로 둔다

## 실측 근거 (계획의 전제 — 구현자가 재확인할 앵커)

| 사실 | 위치 |
|---|---|
| `valuesToCreateInput = draftToCreateJobPostingInput(valuesToDraft(values))` 위임 | `src/utils/order-sheet/mappers.ts:503-505` |
| `draftToUpdateJobPostingInput(draft, {hasConfirmedApplicants})` — true면 schedule·conditions 제외한 축소 payload | `src/utils/job-posting/draftAdapter.ts:581-623` |
| `UpdateJobPostingInput = Partial<JobPostingInput> & {status?}` — **tournamentConfig 필드 없음**(타입 계약) | `src/types/jobPosting.ts:249-269` |
| update 직렬화가 `current?.tournamentConfig`를 그대로 보존 | `src/domains/job-posting/serialization.ts:375-377` |
| 서버: filledPositions>0 + schedule/roleCatalog identity 변경 시 BusinessError | `src/repositories/supabase/JobPostingRepository.ts:531-539` |
| identity 비교는 역할 키 집합만(급여 무관 — 급여 행은 잠그지 않는다) | `src/repositories/supabase/JobPostingRepositorySettlement.ts:54-64` |
| `draftToValues` 전 타입 하이드레이션 완료(fixed 조기 분기·dated 그룹핑·tournament 보존) | `src/utils/order-sheet/mappers.ts:246-401` |
| 레거시 편집: 타입 변경 불가(`PostingTypeSelector disabled={isEdit}`) | `src/components/employer/job-form/sections/BasicInfoSection.tsx:147-151` |
| `useUpdateJobPosting` onSuccess가 성공 토스트+쿼리 무효화 발행(레거시 화면은 중복 발행 중) | `src/hooks/useJobManagement.ts:138-165` |
| OrderSheetScreen `presets` prop 생략 시 캐러셀 미노출 | `OrderSheetScreen.tsx:554-560` |
| 레거시 edit 화면: useJobDetail → buildJobPostingDraft → buildUpdateJobPostingInput → mutateAsync → router.back() | `app/(employer)/my-postings/[id]/edit.tsx` |

---

### Task 1: `valuesToUpdateInput` 신설 + 신·구 등가성·축소 payload 게이트

**Files:**
- Modify: `uniqn-mobile/src/utils/order-sheet/mappers.ts` (valuesToCreateInput 바로 아래)
- Test: `uniqn-mobile/src/utils/order-sheet/__tests__/mappers.update.test.ts` (신규 — mappers.test.ts가 850라인+라 분리)

**Interfaces:**
- Consumes: `valuesToDraft(values: OrderSheetValues): JobPostingDraft`(기존), `draftToUpdateJobPostingInput(draft, options?: {hasConfirmedApplicants?: boolean}): UpdateJobPostingInput`(레거시, draftAdapter)
- Produces: `valuesToUpdateInput(values: OrderSheetValues, options?: {hasConfirmedApplicants?: boolean}): UpdateJobPostingInput` — Task 4의 edit.tsx가 소비

- [ ] **Step 1: 실패하는 테스트 작성**

`uniqn-mobile/src/utils/order-sheet/__tests__/mappers.update.test.ts`:

```ts
/**
 * valuesToUpdateInput(S3) — 주문서 값 → 공고 수정 입력.
 * 신·구 등가성 게이트: 레거시 draftToUpdateJobPostingInput 산출과 타입별 동등(위임 계약 고정).
 * 축소 payload: hasConfirmedApplicants=true면 schedule·conditions 제외(레거시 계약 그대로).
 * 승인 무접촉: 어떤 타입에서도 tournamentConfig own-property를 만들지 않는다(설계 확정 ⑥).
 */
import { valuesToDraft, valuesToUpdateInput } from '../mappers';
import { draftToUpdateJobPostingInput } from '@/utils/job-posting/draftAdapter';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import { singleGroup } from './orderSheetTestHelpers';

const stripIds = (obj: unknown): unknown =>
  JSON.parse(JSON.stringify(obj, (key, value) => (key === 'id' ? undefined : value)));

const baseSlots: OrderSheetValues['scheduleGroups'][number]['timeSlots'] = [
  {
    startTime: '19:00',
    roles: [
      { role: 'dealer', count: 2 },
      { role: 'serving', count: 1 },
    ],
  },
];

const datedValues: OrderSheetValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: singleGroup(['2026-07-20', '2026-07-21'], baseSlots),
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: { meal: -1 },
  conditions: { dressCode: '검정셔츠/슬랙스' },
  usesPreQuestions: false,
  preQuestions: [],
};

const tournamentValues: OrderSheetValues = {
  ...datedValues,
  postingType: 'tournament',
  title: 'WSOP 서울 딜러',
  salary: { type: 'daily', amount: 200000 },
};

const fixedValues: OrderSheetValues = {
  ...datedValues,
  postingType: 'fixed',
  title: '상시 딜러 모집',
  scheduleGroups: [],
  fixedSchedule: {
    daysPerWeek: 5,
    startTime: '19:00',
    isStartTimeNegotiable: false,
    roles: [{ role: 'dealer', count: 2 }],
  },
};

describe('valuesToUpdateInput — 신·구 등가성(타입별)', () => {
  it.each([
    ['regular(dated)', datedValues],
    ['tournament', tournamentValues],
    ['fixed', fixedValues],
  ])('%s: 레거시 draftToUpdateJobPostingInput 산출과 동등하다', (_label, values) => {
    const legacy = draftToUpdateJobPostingInput(valuesToDraft(values));
    expect(stripIds(valuesToUpdateInput(values))).toEqual(stripIds(legacy));
  });

  it('tournament: postingType이 보존된다(silent-coercion 재발 금지)', () => {
    expect(valuesToUpdateInput(tournamentValues).postingType).toBe('tournament');
  });

  it('fixed: schedule.kind=fixed + date:null synthetic requirement를 낸다(SP1 불변식)', () => {
    const input = valuesToUpdateInput(fixedValues);
    expect(input.schedule?.kind).toBe('fixed');
    if (input.schedule?.kind !== 'fixed') throw new Error('kind');
    expect(input.schedule.requirements).toHaveLength(1);
    expect(input.schedule.requirements[0]?.date).toBeNull();
  });
});

describe('valuesToUpdateInput — 확정 지원자 축소 payload(레거시 계약 계승)', () => {
  it('hasConfirmedApplicants=true면 schedule·conditions 키 자체가 없다', () => {
    const input = valuesToUpdateInput(datedValues, { hasConfirmedApplicants: true });
    expect('schedule' in input).toBe(false);
    expect('conditions' in input).toBe(false);
    // 나머지 편집 가능 필드는 유지(급여·질문·카탈로그 — 서버 identity 가드와 대칭)
    expect(input.compensation).toBeDefined();
    expect(input.roleCatalog).toBeDefined();
    expect(input.title).toBe('주말 딜러 구합니다');
  });

  it('기본(false)이면 schedule을 포함한다', () => {
    const input = valuesToUpdateInput(datedValues);
    expect(input.schedule?.kind).toBe('dated');
  });
});

describe('valuesToUpdateInput — 대회 승인 무접촉(설계 확정 ⑥)', () => {
  it.each([
    ['regular', datedValues],
    ['tournament', tournamentValues],
    ['fixed', fixedValues],
  ])('%s: tournamentConfig own-property를 만들지 않는다', (_label, values) => {
    expect('tournamentConfig' in valuesToUpdateInput(values)).toBe(false);
    expect(
      'tournamentConfig' in valuesToUpdateInput(values, { hasConfirmedApplicants: true })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인 (RED)**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.update.test.ts --silent`
Expected: FAIL — `valuesToUpdateInput`이 `../mappers`에 없어 TS/모듈 에러

- [ ] **Step 3: 최소 구현**

`uniqn-mobile/src/utils/order-sheet/mappers.ts` — `valuesToCreateInput`(503-505) 바로 아래에 추가. import 문에 `draftToUpdateJobPostingInput`(from `@/utils/job-posting/draftAdapter` — 기존 draftAdapter import 라인에 합류)과 `UpdateJobPostingInput` 타입(from `@/types/jobPosting` — 기존 타입 import 라인에 합류)을 추가한다.

```ts
/**
 * 주문서 값 → 공고 수정 입력(S3). 레거시 draftToUpdateJobPostingInput에 위임해
 * 신·구 등가성이 구조적으로 성립한다(valuesToCreateInput과 동형 패턴).
 * hasConfirmedApplicants=true면 레거시 계약 그대로 schedule·conditions를 제외한 축소
 * payload(서버 updateWithTransaction의 filledPositions 가드와 대칭)를 만든다.
 * tournamentConfig는 UpdateJobPostingInput 타입에 없어 이 경로가 승인 상태를 만질 수
 * 없다(설계 확정 ⑥ — update 직렬화가 current에서 보존, serialization.ts tournament 분기).
 */
export function valuesToUpdateInput(
  values: OrderSheetValues,
  options?: { hasConfirmedApplicants?: boolean }
): UpdateJobPostingInput {
  return draftToUpdateJobPostingInput(valuesToDraft(values), options);
}
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.update.test.ts --silent`
Expected: PASS (8 tests)

- [ ] **Step 5: 기존 매퍼 스위트 무회귀 확인**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet --silent`
Expected: 전 스위트 PASS

- [ ] **Step 6: 커밋** (직전 `git branch --show-current` 확인)

```bash
git add uniqn-mobile/src/utils/order-sheet/mappers.ts uniqn-mobile/src/utils/order-sheet/__tests__/mappers.update.test.ts
git commit -m "feat(jobs): 주문서 수정 매퍼 valuesToUpdateInput 신설 — 신·구 등가성·축소 payload 게이트(S3)"
```

---

### Task 2: 대회 편집 승인상태 보존 — merge+serialize 통합 회귀

**Files:**
- Test: `uniqn-mobile/src/domains/job-posting/__tests__/serialization.tournament.test.ts` (신규)

**Interfaces:**
- Consumes: `mergeJobPostingInput(current: JobPosting, patch: UpdateJobPostingInput): CreateJobPostingInput`, `serializeJobPostingV3(input, {ownerId, ownerName, status?, current?, createdAt?, updatedAt?})`, `deserializeJobPostingDocument(doc)` (모두 `src/domains/job-posting/serialization.ts` 기존), Task 1의 `valuesToUpdateInput`
- Produces: 회귀 테스트만(프로덕션 코드 무변경 — 보존은 이미 serialization.ts:375-377이 구현)

- [ ] **Step 1: 회귀 테스트 작성**

`uniqn-mobile/src/domains/job-posting/__tests__/serialization.tournament.test.ts`:

```ts
/**
 * 대회 편집 승인상태 보존(S3 — 설계 확정 ⑥) 통합 회귀.
 * update 경로(merge→serialize)가 current의 tournamentConfig를 그대로 보존해
 * 승인된(approved) 대회 수정이 pending 리셋을 유발하지 않음을 고정한다.
 * 보존 구현: serialization.ts update 조립부의 tournament 분기(current?.tournamentConfig 복사).
 * red-green: 해당 분기를 임시 무력화하면 이 스위트가 FAIL해야 한다(Task 5에서 실측).
 */
import {
  deserializeJobPostingDocument,
  mergeJobPostingInput,
  serializeJobPostingV3,
} from '../serialization';
import {
  draftToCreateJobPostingInput,
  jobPostingToDraft,
} from '@/utils/job-posting/draftAdapter';
import { draftToValues, valuesToUpdateInput } from '@/utils/order-sheet/mappers';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { TournamentConfig } from '@/types/postingConfig';

const submittedAt = new Date('2026-07-10T09:00:00+09:00');
const approvedConfig: TournamentConfig = {
  approvalStatus: 'approved',
  submittedAt,
  approvedBy: 'admin-1',
  approvedAt: new Date('2026-07-11T10:00:00+09:00'),
};

/** approved 대회 엔티티 구성 — create 직렬화 → 문서에 승인 config 부여 → 역직렬화 */
function buildApprovedTournament() {
  const input = draftToCreateJobPostingInput({
    ...INITIAL_JOB_POSTING_DRAFT,
    postingType: 'tournament',
    title: 'WSOP 서울 딜러',
    location: { name: '강남 홀덤펍', address: '서울 강남구' },
  });
  const doc = serializeJobPostingV3(input, { ownerId: 'u1', ownerName: 't' });
  return deserializeJobPostingDocument({
    ...doc,
    id: 'p1',
    tournamentConfig: approvedConfig,
  });
}

describe('대회 편집 — approvalStatus 보존(merge→serialize 통합)', () => {
  it('부분 patch(제목 수정)로도 approved config가 그대로 보존된다', () => {
    const entity = buildApprovedTournament();
    const merged = mergeJobPostingInput(entity, { title: '수정된 대회 제목' });
    const updated = serializeJobPostingV3(merged, {
      ownerId: entity.ownerId,
      ownerName: entity.ownerName,
      status: entity.status,
      current: entity,
      createdAt: entity.createdAt,
      updatedAt: new Date('2026-07-16T12:00:00+09:00'),
    });
    expect(updated.tournamentConfig?.approvalStatus).toBe('approved');
    expect(updated.tournamentConfig?.submittedAt).toEqual(submittedAt);
    expect(updated.title).toBe('수정된 대회 제목');
  });

  it('주문서 편집 전체 payload(valuesToUpdateInput)로도 approved가 보존된다', () => {
    const entity = buildApprovedTournament();
    // 편집 하이드레이션 → 재제출 시뮬레이션. draftToValues는 z.input을 반환하지만
    // 왕복 정규형 동등(기존 mappers 왕복 게이트)이 성립해 z.output으로 안전 단언.
    const values = draftToValues(jobPostingToDraft(entity)) as OrderSheetValues;
    const patch = valuesToUpdateInput({ ...values, title: '주문서에서 수정' });
    expect('tournamentConfig' in patch).toBe(false);
    const merged = mergeJobPostingInput(entity, patch);
    const updated = serializeJobPostingV3(merged, {
      ownerId: entity.ownerId,
      ownerName: entity.ownerName,
      status: entity.status,
      current: entity,
      createdAt: entity.createdAt,
      updatedAt: new Date('2026-07-16T12:00:00+09:00'),
    });
    expect(updated.tournamentConfig?.approvalStatus).toBe('approved');
    expect(updated.title).toBe('주문서에서 수정');
  });

  it('pending 대회 편집도 pending 그대로다(재제출 트리거 없음)', () => {
    const entity = buildApprovedTournament();
    const pendingEntity = {
      ...entity,
      tournamentConfig: { approvalStatus: 'pending' as const, submittedAt },
    };
    const merged = mergeJobPostingInput(pendingEntity, { title: '수정' });
    const updated = serializeJobPostingV3(merged, {
      ownerId: pendingEntity.ownerId,
      ownerName: pendingEntity.ownerName,
      status: pendingEntity.status,
      current: pendingEntity,
      createdAt: pendingEntity.createdAt,
      updatedAt: new Date('2026-07-16T12:00:00+09:00'),
    });
    expect(updated.tournamentConfig?.approvalStatus).toBe('pending');
    expect(updated.tournamentConfig?.resubmittedAt).toBeUndefined();
  });
});
```

⚠️ 구현 시 실측 보정 허용 지점: `deserializeJobPostingDocument`가 문서의 Date 필드를 변환하는 방식(문자열↔Date)에 따라 `submittedAt` 동등 비교를 `toEqual(submittedAt)` 대신 ISO 문자열 비교로 조정할 수 있다. **어서션의 의미(approvalStatus·submittedAt 보존)는 바꾸지 말 것.**

- [ ] **Step 2: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/domains/job-posting/__tests__/serialization.tournament.test.ts --silent`
Expected: PASS (3 tests) — 보존은 기존 구현이므로 즉시 GREEN이 정상. **테스트 자체의 유효성(RED 가능성)은 Task 5의 red-green 실측이 증명한다.**

- [ ] **Step 3: 커밋** (직전 `git branch --show-current` 확인)

```bash
git add uniqn-mobile/src/domains/job-posting/__tests__/serialization.tournament.test.ts
git commit -m "test(jobs): 대회 편집 승인상태 보존 회귀 — merge+serialize 통합(S3)"
```

---

### Task 3: 주문서 편집 모드 — TypeSegment 잠금·수정 라벨·일정 잠금

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx` (disabled prop)
- Modify: `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` (mode·scheduleLocked props + 분기)
- Test: `uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx` (신규)

**Interfaces:**
- Consumes: 기존 OrderSheetScreen 내부(handleTypeChange·handleRowPress·handleDeleteGroup·handleAddSchedule·submitLabel·대회 배너)
- Produces: `OrderSheetScreenProps`에 `mode?: 'create' | 'edit'`(기본 'create'), `scheduleLocked?: boolean`(기본 false) 추가, `onSwitchToLegacyForm` **optional화**(`onSwitchToLegacyForm?:` — 사문 prop을 edit.tsx가 넘기지 않도록. create.tsx는 무변경, S4에서 prop째 제거), `TypeSegment`에 `disabled?: boolean`. Task 4의 edit.tsx가 소비.

**UX 결정(레거시 계약 계승 근거):**
- 타입 세그먼트: 편집 중 변경 불가(레거시 `PostingTypeSelector disabled={isEdit}` 계승). 시각은 비선택 항목 opacity-40 + `accessibilityState.disabled`.
- 대회 생성 배너("승인까지 1~2 영업일")·'승인 요청하기' 라벨은 **생성 전용** — 편집은 승인상태 보존(⑥)이므로 배너 숨김 + '이대로 수정' 라벨.
- scheduleLocked(확정 지원자): 일정·역할 행(dated: dates/time/roles, fixed: workConditions/roles) 탭 시 warning 토스트 + 상단 잠금 배너. 그룹 삭제·'＋ 일정 추가'도 가드. **급여 행은 열어둔다**(서버 identity 가드는 역할 키 집합만 비교 — 급여 무관 실측).
- 편집 하단: 좌 ghost '템플릿 저장'(onSaveTemplate 있을 때) + 우 primary(레거시 편집 하단 2버튼 패턴 계승 — 기능 소실 방지). testID는 레거시 계승 `job-posting-edit-submit`.

- [ ] **Step 1: 실패하는 테스트 작성**

`uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx`:

```tsx
/**
 * OrderSheetScreen 편집 모드(S3) — 타입 세그먼트 잠금·수정 라벨·대회 배너 숨김·일정 잠금.
 * SheetModal은 children+footer 렌더로 모킹(reanimated 배제) — tournament 테스트와 동일 스캐폴딩.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

jest.mock('@/components/ui/SheetModal', () => {
  const { View, Text } = require('react-native');
  return {
    SheetModal: ({ visible, title, children, footer }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

// 전 행이 채워진 완성 폼 — firstUnsetRow가 null이 되어 submitLabel이 모드 라벨로 해석된다.
const completeValues: OrderSheetFormValues = {
  postingType: 'regular',
  title: '주말 딜러 구합니다',
  location: { name: '라운더스 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [
    {
      dates: ['2026-07-20'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

const completeTournamentValues: OrderSheetFormValues = {
  ...completeValues,
  postingType: 'tournament',
  title: 'WSOP 서울 딜러',
};

const baseProps = {
  onSubmit: jest.fn(),
  isSubmitting: false,
  myPhone: '010-0000-0000',
};

describe('OrderSheetScreen — 편집 모드(S3)', () => {
  it('mode=edit면 타입 세그먼트가 잠긴다(탭해도 전환 없음 + disabled 상태)', () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeValues} />
    );
    const fixedTab = getByTestId('order-sheet-type-fixed');
    expect(fixedTab.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(fixedTab);
    expect(getByTestId('order-sheet-type-regular').props.accessibilityState.selected).toBe(true);
  });

  it('mode=edit 완성 폼의 제출 라벨은 "이대로 수정"이다(대회 포함 — 승인상태 보존 ⑥)', () => {
    const { getByText } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeTournamentValues} />
    );
    expect(getByText('이대로 수정')).toBeTruthy();
  });

  it('mode=edit면 대회 생성 배너(승인 1~2 영업일)를 숨긴다', () => {
    const { queryByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeTournamentValues} />
    );
    expect(queryByTestId('order-sheet-tournament-notice')).toBeNull();
  });

  it('mode=edit 제출 버튼 testID는 레거시 계승(job-posting-edit-submit)', () => {
    const { getByTestId, queryByTestId } = render(
      <OrderSheetScreen {...baseProps} mode="edit" initialValues={completeValues} />
    );
    expect(getByTestId('job-posting-edit-submit')).toBeTruthy();
    expect(queryByTestId('job-posting-create-submit')).toBeNull();
  });

  it('mode 기본값(create)은 기존 계약 무회귀 — 등록 라벨·create testID', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen {...baseProps} initialValues={completeValues} />
    );
    expect(getByTestId('job-posting-create-submit')).toBeTruthy();
    expect(getByText('이대로 등록')).toBeTruthy();
  });
});

describe('OrderSheetScreen — 일정 잠금(scheduleLocked, 확정 지원자)', () => {
  it('잠금 배너를 노출한다', () => {
    const { getByTestId } = render(
      <OrderSheetScreen
        {...baseProps}
        mode="edit"
        scheduleLocked
        initialValues={completeValues}
      />
    );
    expect(getByTestId('order-sheet-schedule-locked-notice')).toBeTruthy();
  });

  it('일정 행 탭 시 시트가 열리지 않는다', () => {
    const { getByTestId, queryByText } = render(
      <OrderSheetScreen
        {...baseProps}
        mode="edit"
        scheduleLocked
        initialValues={completeValues}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-dates'));
    // 날짜 시트(SheetModal title '날짜 선택')가 열리지 않음 — 잠금 토스트만
    expect(queryByText('날짜 선택')).toBeNull();
  });

  it('제목 등 비일정 행은 잠기지 않는다', () => {
    const { getByTestId, getByText } = render(
      <OrderSheetScreen
        {...baseProps}
        mode="edit"
        scheduleLocked
        initialValues={completeValues}
      />
    );
    fireEvent.press(getByTestId('order-sheet-row-title'));
    expect(getByText('제목')).toBeTruthy();
  });
});
```

⚠️ 구현 시 실측 보정 허용 지점: 날짜 시트의 실제 SheetModal title 문자열('날짜 선택')과 제목 시트 title('제목')은 기존 ScheduleDatesSheet/TitleSheet 구현에서 실측해 맞춘다. **어서션 의미(잠금 행은 시트 미오픈, 비잠금 행은 오픈)는 유지.**

- [ ] **Step 2: 테스트 실패 확인 (RED)**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx --silent`
Expected: FAIL — `mode`/`scheduleLocked` prop 부재(TS 에러) 또는 disabled/라벨 어서션 실패

- [ ] **Step 3: TypeSegment disabled 구현**

`TypeSegment.tsx` 교체:

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { POSTING_TYPE_INFO } from '@/types/jobPostingForm';
import type { PostingType } from '@/types/jobPosting';

const TYPES: PostingType[] = ['regular', 'urgent', 'fixed', 'tournament'];

export function TypeSegment({
  value,
  onChange,
  disabled = false,
}: {
  value: 'regular' | 'urgent' | 'tournament' | 'fixed';
  onChange: (t: PostingType) => void;
  /** 편집 모드 잠금(S3) — 레거시 PostingTypeSelector disabled={isEdit} 계약 계승 */
  disabled?: boolean;
}) {
  return (
    <View className="flex-row gap-1 p-1 rounded-xl bg-surface-card border border-secondary-200 dark:border-surface-overlay">
      {TYPES.map((t) => {
        const selected = t === value;
        return (
          <Pressable
            key={t}
            disabled={disabled}
            onPress={() => onChange(t)}
            className={`flex-1 items-center justify-center py-2 min-h-[44px] rounded-lg ${
              selected ? 'bg-primary-100 border border-primary-500' : 'active:opacity-80'
            } ${disabled && !selected ? 'opacity-40' : ''}`}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`공고 유형 ${POSTING_TYPE_INFO[t].label}`}
            testID={`order-sheet-type-${t}`}
          >
            <Text
              className={`text-sm font-sans-medium ${
                selected
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-secondary-700 dark:text-secondary-300'
              }`}
            >
              {POSTING_TYPE_INFO[t].label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: OrderSheetScreen mode/scheduleLocked 구현**

`OrderSheetScreen.tsx` 변경점(기존 구조 유지, 삽입 위주):

1. props 인터페이스(90-107)에 추가 + `onSwitchToLegacyForm` optional화:

```ts
  /**
   * 레거시 폼 위임 콜백 — 대회(S1)·고정(S2) 모두 주문서 내부 처리로 이관돼 더 이상 호출되지 않는다.
   * create.tsx가 계속 전달하므로 계약은 유지하고(optional — 편집 화면은 미전달), 소비는 하지 않는다. S4에서 제거 예정.
   */
  onSwitchToLegacyForm?: (type: 'fixed' | 'tournament') => void;
  /** 편집 모드(S3) — 타입 세그먼트 잠금·'이대로 수정' 라벨·대회 생성 배너 숨김(승인상태 보존 ⑥) */
  mode?: 'create' | 'edit';
  /** 확정 지원자 존재(S3) — 일정·역할 행 잠금. 서버 updateWithTransaction 가드와 대칭(급여는 열어둠) */
  scheduleLocked?: boolean;
```

구조분해에 `mode = 'create'`, `scheduleLocked = false` 추가.

2. 일정 잠금 가드 — `handleRowPress` 정의 직전에 삽입, `handleRowPress` 본문 첫 줄에서 호출:

```ts
  // 확정 지원자 일정 잠금(S3) — 서버 BusinessError(일정/역할 변경 불가)를 UI에서 선제 안내.
  // 급여 행은 잠그지 않는다(identity 비교는 역할 키 집합만 — 금액 수정은 서버 허용 실측).
  const LOCKED_ROW_KEYS: ReadonlySet<OrderRowKey> = useMemo(
    () => new Set<OrderRowKey>(['dates', 'time', 'roles', 'workConditions']),
    []
  );
  const guardScheduleLock = useCallback(
    (key?: OrderRowKey): boolean => {
      if (!scheduleLocked) return false;
      if (key !== undefined && !LOCKED_ROW_KEYS.has(key)) return false;
      addToast({
        type: 'warning',
        message: '확정된 지원자가 있어 일정과 역할은 수정할 수 없어요.',
      });
      return true;
    },
    [scheduleLocked, LOCKED_ROW_KEYS, addToast]
  );
```

`handleRowPress(key, groupIndex)` 본문 최상단: `if (guardScheduleLock(key)) return;`
`handleDeleteGroup` 본문 최상단: `if (guardScheduleLock()) return;`
`handleAddSchedule` 본문 최상단: `if (guardScheduleLock()) return;`
(slotRoles 등 일정 파생 시트 진입점이 handleRowPress를 우회하는 곳이 있으면 동일 가드 — 구현 시 진입점 전수 확인)

3. 대회 배너 분기(565): `values.postingType === 'tournament' ? (` → `values.postingType === 'tournament' && mode !== 'edit' ? (`

4. 잠금 배너 — TypeSegment 블록(561-563) 바로 아래 삽입:

```tsx
        {scheduleLocked ? (
          <View
            className="flex-row items-start gap-2 mb-3 rounded-xl bg-surface-card border border-warning-200 dark:border-warning-800 px-3.5 py-3"
            accessibilityRole="alert"
            testID="order-sheet-schedule-locked-notice"
          >
            <InformationCircleIcon size={18} />
            <Text className="flex-1 text-xs font-sans text-content-secondary leading-[1.125rem] dark:leading-5">
              확정된 지원자가 있어 일정과 역할 정보는 수정할 수 없어요.
            </Text>
          </View>
        ) : null}
```

5. TypeSegment(562): `<TypeSegment value={values.postingType} onChange={handleTypeChange} disabled={mode === 'edit'} />`

6. submitLabel(532-534):

```ts
    if (unsetTarget === null) {
      if (mode === 'edit') return '이대로 수정'; // 대회 포함 — 편집은 승인상태 보존(⑥), 재승인 요청 아님
      return values.postingType === 'tournament' ? '승인 요청하기' : '이대로 등록';
    }
```

7. 하단 제출부(688-697) — 편집 모드 템플릿 저장 ghost 버튼(레거시 편집 하단 패턴 계승):

```tsx
      <View className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 bg-surface-page border-t border-secondary-100 dark:border-surface-overlay">
        <View className="flex-row items-center gap-2">
          {mode === 'edit' && onSaveTemplate !== undefined ? (
            <Button
              variant="ghost"
              onPress={handleSavePreset}
              disabled={isSubmitting}
              accessibilityLabel="템플릿으로 저장"
              testID="order-sheet-edit-save-template"
            >
              템플릿 저장
            </Button>
          ) : null}
          <View className="flex-1">
            <Button
              onPress={handleSubmitPress}
              disabled={isSubmitting}
              loading={isSubmitting}
              testID={mode === 'edit' ? 'job-posting-edit-submit' : 'job-posting-create-submit'}
            >
              {submitLabel}
            </Button>
          </View>
        </View>
      </View>
```

(Button ghost variant의 children 처리 형태는 기존 `@/components` Button 실측에 맞춘다 — create.tsx 레거시 하단은 `<Text>` 래핑 사용. 시각 규격: min-h 44px 유지, impeccable §4·§5.)

- [ ] **Step 5: 테스트 통과 확인 (GREEN)**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx --silent`
Expected: PASS (8 tests)

- [ ] **Step 6: 기존 주문서 스위트 무회귀 확인 (create 모드 기본값 계약)**

Run: `cd uniqn-mobile && npx jest src/components/employer/order-sheet --silent`
Expected: 전 스위트 PASS

- [ ] **Step 7: 커밋** (직전 `git branch --show-current` 확인)

```bash
git add uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.edit.test.tsx
git commit -m "feat(jobs): 주문서 편집 모드 — 타입 세그먼트 잠금·수정 라벨·일정 잠금(S3)"
```

---

### Task 4: `edit.tsx` 전 타입 주문서 배선 — 레거시 섹션 폼 대체

**Files:**
- Modify: `uniqn-mobile/app/(employer)/my-postings/[id]/edit.tsx` (전면 교체)

**Interfaces:**
- Consumes: Task 1 `valuesToUpdateInput(values, {hasConfirmedApplicants})`, Task 3 `OrderSheetScreen({mode:'edit', scheduleLocked, onSaveTemplate, ...})`, 기존 `useJobDetail`·`useUpdateJobPosting`·`useTemplateManager`·`buildJobPostingDraft`·`draftToValues`·`formValuesToDraft`·`isEmployerManageablePosting`·`useJobDetailContext`(`./_layout`)
- Produces: 화면 라우트(외부 소비자 없음)

**설계 결정(근거):**
- 성공·실패 토스트는 `useUpdateJobPosting`(onSuccess/onError)에 위임 — 레거시 화면의 중복 발행(훅+화면 동일 문구 2회) 해소. catch는 `logger`만(unhandled rejection 금지).
- 편집 완료 → `router.back()`(레거시 동일) — 완료 화면·공유 CTA 없음이므로 "승인 대기 대회 공유 유도 금지" 원칙 자동 충족.
- 하이드레이션 실패(손상 데이터 throw)는 에러 화면으로 — 프리셋의 try/catch 방어(create.tsx:98)와 동형.
- 레거시 `allowScheduleFallback`(빈 일정 경고)은 주문서에선 불필요 — `draftToValues`가 빈 requirements를 allDates+templateTimeSlots 단일 그룹으로 복원하고, 그래도 비면 zod 제출 게이트가 날짜 선택을 유도한다.
- region 없는 레거시 공고: 로드는 관용(z.input), 제출 시 스키마가 지역 선택 유도 — 스키마 주석의 의도된 동작.

- [ ] **Step 1: edit.tsx 교체**

```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Loading } from '@/components';
import { StackHeader } from '@/components/headers';
import { OrderSheetScreen } from '@/components/employer/order-sheet/OrderSheetScreen';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { useAuth } from '@/hooks/useAuth';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useUpdateJobPosting } from '@/hooks/useJobManagement';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { buildJobPostingDraft } from '@/utils/job-posting/submission';
import { isEmployerManageablePosting } from '@/utils/jobPostingVisibility';
import {
  draftToValues,
  formValuesToDraft,
  valuesToUpdateInput,
} from '@/utils/order-sheet/mappers';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { JobPostingDraft } from '@/types/jobPostingDraft';

/**
 * 공고 수정(S3) — 전 타입(지원·급구·대회·고정) 주문서 단일 경로.
 * 레거시 섹션 폼(JobPostingScrollForm 계열)은 S4 은퇴 전까지 코드로만 병존(이 화면은 미사용).
 * 대회 편집은 approvalStatus 보존(설계 확정 ⑥) — valuesToUpdateInput이 tournamentConfig를
 * 만질 수 없고(타입 계약), update 직렬화가 current에서 보존한다.
 */
export default function EditJobPostingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { addToast } = useToastStore();

  const { job: existingJob, isLoading: isJobLoading, error: jobError } = useJobDetail(id || '');
  const { job: contextJob, isFixed: contextIsFixed, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${id ?? ''}`;
  const headerJobTitle = existingJob?.title ?? contextJob?.title ?? null;
  const headerTitleSuffix = <JobTitleSuffix jobTitle={headerJobTitle} />;
  const headerRightAction = !contextIsFixed ? <HeaderQRAction onPress={handleShowQR} /> : null;

  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChangesGuard(isDirty);

  const updateJobPosting = useUpdateJobPosting();
  const templateManager = useTemplateManager();

  const isManageable = existingJob ? isEmployerManageablePosting(existingJob) : true;
  const hasConfirmedApplicants = (existingJob?.filledPositions ?? 0) > 0;

  // 진입 안내 — 저장 후 쿼리 무효화로 existingJob이 갱신돼도 재발행 금지(1회 가드)
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!existingJob || notifiedRef.current) return;
    notifiedRef.current = true;
    if (!isEmployerManageablePosting(existingJob)) {
      addToast({ type: 'warning', message: '지원하지 않는 공고 형식입니다.' });
      router.replace('/(app)/(tabs)/employer');
      return;
    }
    if ((existingJob.filledPositions ?? 0) > 0) {
      addToast({
        type: 'warning',
        message: '확정된 지원자가 있어 일정과 역할 정보 수정이 제한됩니다.',
      });
    }
  }, [existingJob, addToast, router]);

  // 편집 하이드레이션 — draftToValues는 전 타입 복원(S1 dated 그룹핑·S2 fixed·대회 보존).
  // RHF defaultValues는 첫 마운트만 소비하므로 existingJob 갱신에 따른 재계산은 무해.
  const initialValues = useMemo<OrderSheetFormValues | null>(() => {
    if (!existingJob || !isEmployerManageablePosting(existingJob)) return null;
    try {
      return draftToValues(buildJobPostingDraft(existingJob));
    } catch (error) {
      // 복원 불가 형상(손상 데이터) — 프리셋 방어(create.tsx)와 동형. 아래 에러 화면으로 유도.
      logger.error('공고 편집 하이드레이션 실패', toError(error), { jobPostingId: id });
      return null;
    }
  }, [existingJob, id]);

  const handleSubmit = useCallback(
    async (values: OrderSheetValues) => {
      if (!id) return;
      try {
        const input = valuesToUpdateInput(values, { hasConfirmedApplicants });
        await updateJobPosting.mutateAsync({ jobPostingId: id, input });
        setIsDirty(false);
        // 성공·실패 토스트는 useUpdateJobPosting(onSuccess/onError)가 담당 — 화면 중복 발행 제거.
        router.back();
      } catch (error) {
        logger.error('주문서 공고 수정 실패', toError(error), { jobPostingId: id });
      }
    },
    [id, hasConfirmedApplicants, updateJobPosting, router]
  );

  // 템플릿 저장 — create.tsx와 동일 굳힘 패턴.
  // ⚠️ handleSaveTemplate 직접 호출 금지: templateName이 비면 조용한 no-op(useTemplateManager) →
  //    반드시 openTemplateModal + TemplateModal 경유로 저장한다.
  const [orderSheetSaveDraft, setOrderSheetSaveDraft] = useState<JobPostingDraft | null>(null);
  const handleOrderSheetSaveTemplate = useCallback(
    (values: OrderSheetFormValues) => {
      setOrderSheetSaveDraft(formValuesToDraft(values));
      templateManager.openTemplateModal();
    },
    [templateManager]
  );
  const handleSaveOrderSheetTemplate = useCallback(async () => {
    if (!orderSheetSaveDraft) return;
    await templateManager.handleSaveTemplate(orderSheetSaveDraft);
  }, [templateManager, orderSheetSaveDraft]);

  if (isJobLoading || (existingJob && !isManageable)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="공고 수정"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-content-secondary font-sans">공고 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (jobError || !existingJob || initialValues === null) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="공고 수정"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
            공고를 불러올 수 없습니다
          </Text>
          <Text className="mb-4 text-center text-content-secondary font-sans">
            {jobError?.message || '공고 정보를 찾을 수 없습니다.'}
          </Text>
          <Button variant="primary" onPress={() => router.back()}>
            <Text className="font-sans-semibold text-content-onGold">돌아가기</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader
        title="공고 수정"
        titleSuffix={headerTitleSuffix}
        fallbackHref={headerBackHref}
        rightAction={headerRightAction}
      />
      <OrderSheetScreen
        mode="edit"
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isSubmitting={updateJobPosting.isPending}
        onDirtyChange={setIsDirty}
        myPhone={profile?.phone ?? ''}
        scheduleLocked={hasConfirmedApplicants}
        onSaveTemplate={handleOrderSheetSaveTemplate}
      />
      {/* 템플릿 이름 입력 모달 — 주문서 시트 닫힘 상태에서만 열려 중첩 RN Modal(#244) 위험 없음 */}
      {templateManager.isTemplateModalOpen ? (
        <TemplateModal
          visible={templateManager.isTemplateModalOpen}
          onClose={templateManager.closeTemplateModal}
          templateName={templateManager.templateName}
          templateDescription={templateManager.templateDescription}
          onTemplateNameChange={templateManager.setTemplateName}
          onTemplateDescriptionChange={templateManager.setTemplateDescription}
          onSave={handleSaveOrderSheetTemplate}
          isSaving={templateManager.isSavingTemplate}
        />
      ) : null}
    </SafeAreaView>
  );
}
```

(교체로 사라지는 레거시 import — `KeyboardAvoidingView`·job-form 섹션들·`useUnsavedChangesGuard` 외 검증 유틸·`draftToFormData`·`patchJobPostingDraft`·`buildUpdateJobPostingInput` — 은 이 파일에서만 제거. **모듈 자체는 S4까지 존치.**)

- [ ] **Step 2: 타입·린트 게이트**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: exit 0 (에러 0)

Run: `cd uniqn-mobile && npx eslint "app/(employer)/my-postings/[id]/edit.tsx"`
Expected: 에러 0

- [ ] **Step 3: 초점 스위트 무회귀**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet src/components/employer/order-sheet src/domains/job-posting src/utils/job-posting --silent`
Expected: 전 스위트 PASS

- [ ] **Step 4: 커밋** (직전 `git branch --show-current` 확인)

```bash
git add "uniqn-mobile/app/(employer)/my-postings/[id]/edit.tsx"
git commit -m "feat(jobs): 공고 수정 화면 전 타입 주문서 배선 — 레거시 섹션 폼 대체(S3)"
```

---

### Task 5: 최종 검증 — red-green 실측·quality·서버 무변경

**Files:** (프로덕션 코드 무변경 — 검증 전용. red-green 중 임시 변형은 반드시 원복)

- [ ] **Step 1: 승인 보존 red-green 실측**

1. `src/domains/job-posting/serialization.ts`의 update 조립부 tournament 분기(§실측 근거 표의 375-377행 — `...(postingType === 'tournament' && current?.tournamentConfig ? { tournamentConfig: current.tournamentConfig } : {})`)를 임시로 `...({})`로 변형.
2. Run: `cd uniqn-mobile && npx jest src/domains/job-posting/__tests__/serialization.tournament.test.ts --silent`
   Expected: **FAIL**(3건 전부 또는 approvalStatus 어서션) — 테스트가 결함을 실제로 잡음을 증명.
3. 변형 원복(정확히 원문 복원 — `git diff`로 serialization.ts 무변경 확인).
4. 동일 명령 재실행 → Expected: PASS.

- [ ] **Step 2: 전체 quality 게이트**

Run: `cd uniqn-mobile && npm run quality`
Expected: exit 0 (type-check + lint + format:check 모두 통과)

- [ ] **Step 3: 초점 테스트 최종 실행 + 수치 기록**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet src/components/employer/order-sheet src/domains/job-posting src/utils/job-posting app --silent`
Expected: 전 스위트 PASS — 보고서에 스위트/테스트 수 기록

- [ ] **Step 4: 서버 무변경 확인**

Run: `git diff master...HEAD --stat -- supabase/ functions/ uniqn-mobile/supabase/`
Expected: 출력 없음(0 파일). `src/domains/job-posting/serialization.ts`도 diff 없음 확인.

- [ ] **Step 5: 최종 보고**

증거(테스트 수·quality exit code·red-green 실측·서버 무변경)와 함께 S3 완료 보고. push/PR/OTA는 사용자 명시 요청 시에만.

---

## Self-Review 기록

- **스펙 커버리지**: 설계 §6-3(S3) 3요소 — `valuesToUpdateInput` 신설(Task 1)·대회 승인상태 보존(Task 1 무접촉 + Task 2 통합 회귀 + Task 5 red-green)·`edit.tsx` 전 타입 배선(Task 3+4). 핸드오프 재점검 항목 — 매퍼 하드닝 불변식(fixed→scheduleGroups:[], dated→fixedSchedule 미포함)은 기존 `draftToValues` 구현이 유지(실측 246-401행: fixed 분기 `scheduleGroups: []`, dated 분기 fixedSchedule 미포함)하며 Task 1 등가성 테스트가 전 타입 왕복을 재고정. 편집 완료 동선 공유 CTA 금지 — `router.back()`으로 자동 충족(Task 4 설계 결정 명시).
- **placeholder 스캔**: "구현 시 실측 보정 허용 지점" 2곳(Task 2 Date 비교·Task 3 시트 title 문자열)은 어서션 의미 고정 + 보정 범위 한정으로 placeholder 아님. 나머지 코드 블록 전부 실코드.
- **타입 일관성**: `valuesToUpdateInput(values, options?)` — Task 1 정의·Task 2/4 소비 시그니처 일치. `mode`/`scheduleLocked` — Task 3 정의·Task 4 소비 일치. `onSwitchToLegacyForm` optional화로 Task 4가 미전달해도 타입 성립.
