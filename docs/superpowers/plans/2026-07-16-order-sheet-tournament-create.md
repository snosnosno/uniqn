# 대회(tournament) 생성 주문서화 — S1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대회(tournament) 공고 생성을 레거시 상세폼이 아니라 주문서(order-sheet) 키오스크 내부에서 처리한다.

**Architecture:** 대회는 지원/급구와 스케줄 구조(dated)가 동일하다. `orderSheet.schema`의 `postingType` enum에 `'tournament'`를 추가하면 날짜 상한(30일)·forward 매핑이 자동 성립한다. 핵심 위험 2개를 함께 잡는다 — (1) `mappers.ts:278`이 대회를 조용히 `regular`로 뭉개는 silent-coercion 버그, (2) `OrderSheetScreen.handleTypeChange`가 대회를 레거시 폼으로 튕겨내는 이탈 로직. 쓰기 경로(Service→Repository→Supabase)와 서버 스키마는 **무변경** — Repository가 `postingType==='tournament'`이면 승인 config(`approvalStatus=PENDING`)를 자동 주입한다.

**Tech Stack:** React Native 0.83 / Expo 55 / TypeScript strict / react-hook-form 7 (3제네릭 zodResolver) / zod 4 / NativeWind 4 / Jest + @testing-library/react-native.

## 설계 근거

- 설계 SSOT: `docs/planning/2026-07-16-order-sheet-unification-all-types-design.md` (§5 대회 승인 처리, §6 슬라이스 S1).
- 이 계획은 **S1(대회 생성)만** 다룬다. S2(고정 생성)·S3(전 타입 편집)·S4(레거시 은퇴)는 각자 별도 계획으로 착수한다.
- S1 완료 후 상태: 대회 생성=주문서, 대회 편집=레거시(지원/급구와 동일 패턴) → 독립 출하 가능.

## Global Constraints

모든 태스크에 암묵 적용 (CLAUDE.md·전역 규칙에서 verbatim):

- **언어**: 모든 주석·커밋 메시지·UI 문구는 **한글**. 기술 식별자만 원문.
- **로깅**: `logger.info()`/`logger.error()` — `console.log()` 금지(앱 런타임).
- **다크모드**: 모든 신규 UI에 `dark:` 토큰 적용.
- **경로**: `@/` 절대 경로. 시스템 절대경로 금지.
- **알림**: `toast`(`addToast`)/`Alert.alert()` — 단순 `alert()` 금지.
- **필드명**: camelCase.
- **아이콘**: `@/components/icons`에서만 import. Lucide stroke 2.0. **이모지 상태표시 금지**(impeccable §14).
- **폼 계약**: `useForm<z.input, unknown, z.output>` **3제네릭** 유지. 스키마 z.input/z.output 2형 불변.
- **서버 무변경**: S1은 마이그레이션·RLS·Edge Function 변경 **0**. 승인 워크플로우는 기존 `JobPostingRepository`가 소유(폼 입력 없음).
- **커밋**: `<type>(<scope>): <한글>` — feat/fix/refactor/test/docs. 예: `feat(jobs): ...`.
- **검증 게이트**: 작업 디렉토리 `uniqn-mobile/`. `npm run quality`(tsc+eslint+prettier) + `npm test` 통과가 완료 조건.

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `uniqn-mobile/src/schemas/orderSheet.schema.ts` | 주문서 폼 계약 | Modify:104 — enum에 `'tournament'` |
| `uniqn-mobile/src/utils/order-sheet/mappers.ts` | 값↔draft 왕복 | Modify:278 — silent-coercion 제거 |
| `uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx` | 유형 세그먼트 | Modify:8-14 — value prop 확장 |
| `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` | 주문서 화면 | Modify:398-407(handleTypeChange), :459(배너 삽입), :429-445(제출 라벨) |
| `uniqn-mobile/app/(employer)/my-postings/create.tsx` | 생성 진입 | Modify:215-259 — 완료화면 `pending` 파라미터 |
| `uniqn-mobile/app/(employer)/my-postings/create-success.tsx` | 완료 화면 | Modify — 대회 승인 안내 문구 |
| `uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts` | 매퍼 테스트 | Modify — 대회 왕복 케이스 |
| `uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.tournament.test.tsx` | 화면 테스트 | Create |
| `uniqn-mobile/app/(employer)/my-postings/__tests__/create-success.tournament.test.tsx` | 완료화면 테스트 | Create |

---

## Task 1: 스키마 enum 확장 + 대회 왕복 보존 (데이터 계층)

주문서가 대회를 값으로 받고, 매퍼가 대회 정체성을 왕복 내내 보존하도록 한다. 이 태스크만으로 "대회 draft→values→create input"이 대회로 유지된다(Repository 승인 주입 조건 성립).

**Files:**
- Modify: `uniqn-mobile/src/schemas/orderSheet.schema.ts:104`
- Modify: `uniqn-mobile/src/utils/order-sheet/mappers.ts:278`
- Test: `uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts`

**Interfaces:**
- Consumes: `baseValues: OrderSheetValues`, `singleGroup(...)` (기존 mappers.test.ts / orderSheetTestHelpers).
- Produces: `orderSheetValuesSchema` z.input/z.output의 `postingType`이 `'regular' | 'urgent' | 'tournament'`. `valuesToDraft`/`draftToValues`/`valuesToCreateInput`이 `'tournament'`을 보존.

- [ ] **Step 1: 실패하는 테스트 작성**

`mappers.test.ts` 하단에 추가 (기존 `baseValues` 재사용):

```ts
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';

describe('대회(tournament) 왕복 보존 (S1)', () => {
  const tournamentValues: OrderSheetValues = {
    ...baseValues,
    postingType: 'tournament',
    title: 'WSOP 서울 딜러 모집',
  };

  it('valuesToDraft가 tournament를 보존한다', () => {
    expect(valuesToDraft(tournamentValues).postingType).toBe('tournament');
  });

  it('draftToValues가 tournament를 regular로 뭉개지 않는다 (silent-coercion 회귀)', () => {
    const draft = valuesToDraft(tournamentValues);
    expect(draftToValues(draft).postingType).toBe('tournament');
  });

  it('valuesToCreateInput이 tournament를 보존한다 (Repository 승인 config 주입 조건)', () => {
    expect(valuesToCreateInput(tournamentValues).postingType).toBe('tournament');
  });

  it('스키마가 tournament + 30일을 허용하고 31일을 거부한다', () => {
    const dates = (n: number) =>
      Array.from({ length: n }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const withDates = (n: number) => ({
      ...tournamentValues,
      scheduleGroups: [
        { dates: dates(n), timeSlots: baseSlots, grouped: false },
      ],
    });
    expect(orderSheetValuesSchema.safeParse(withDates(30)).success).toBe(true);
    expect(orderSheetValuesSchema.safeParse(withDates(31)).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts -t "대회"`
Expected: FAIL — `postingType` enum이 `'tournament'`을 거부(safeParse 실패), 그리고 `draftToValues`가 `'regular'` 반환.

- [ ] **Step 3: 스키마 enum 확장**

`orderSheet.schema.ts:104`:

```ts
    postingType: z.enum(['regular', 'urgent', 'tournament']),
```

(참고: 라인 163의 `DATE_CONSTRAINTS[v.postingType].maxDates`는 이미 `tournament: 30`을 정의하므로 30일 상한이 자동 반영된다 — `constants/jobPosting.ts:32-35`.)

- [ ] **Step 4: 매퍼 silent-coercion 제거**

`mappers.ts:278` — 현재 `postingType: draft.postingType === 'urgent' ? 'urgent' : 'regular',` 를 교체:

```ts
    // fixed는 line 205에서 이미 throw(kind!=='dated') — 여기 도달하는 postingType은 regular|urgent|tournament.
    // fixed 분기는 도달 불가지만 TS 망라성을 위해 남긴다(S2에서 fixed 지원 시 제거).
    postingType: draft.postingType === 'fixed' ? 'regular' : draft.postingType,
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts -t "대회"`
Expected: PASS (4 케이스).

- [ ] **Step 6: silent-coercion Red-Green 회귀 확인**

`mappers.ts:278`을 임시로 `postingType: draft.postingType === 'urgent' ? 'urgent' : 'regular',` 로 되돌린 뒤:
Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts -t "silent-coercion"`
Expected: FAIL (received `'regular'`, expected `'tournament'`) — 테스트가 버그를 실제로 잡는다는 증거.
확인 후 Step 4의 수정으로 복원하고 재실행 → PASS.

- [ ] **Step 7: 전체 매퍼 스위트 무회귀 확인**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts`
Expected: PASS (기존 케이스 전부 + 신규 4).

- [ ] **Step 8: 커밋**

```bash
git add uniqn-mobile/src/schemas/orderSheet.schema.ts uniqn-mobile/src/utils/order-sheet/mappers.ts uniqn-mobile/src/utils/order-sheet/__tests__/mappers.test.ts
git commit -m "feat(jobs): 주문서 대회 타입 왕복 보존 — enum 확장 + silent-coercion 제거(S1)"
```

---

## Task 2: 유형 세그먼트 — 대회는 주문서 내부, 고정만 레거시

대회 세그먼트를 누르면 레거시로 튕기지 않고 주문서 안에서 `postingType='tournament'`로 전환된다. 고정은 S2까지 레거시 유지.

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx:8-14`
- Modify: `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx:398-407`
- Test: `uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.tournament.test.tsx` (Create)

**Interfaces:**
- Consumes: Task 1의 확장된 `postingType` 타입. `OrderSheetScreen` props(`initialValues`, `onSubmit`, `onSwitchToLegacyForm`, `myPhone`, `isSubmitting`).
- Produces: `handleTypeChange`가 `'fixed'`만 `onSwitchToLegacyForm`으로 위임하고 `'regular'|'urgent'|'tournament'`은 `form.setValue('postingType', …)`.

- [ ] **Step 1: 실패하는 테스트 작성**

`OrderSheetScreen.tournament.test.tsx` (Create). **같은 디렉토리 `OrderSheetScreen.presets.test.tsx`의 렌더 셋업·모킹(import·jest.mock·render 헬퍼)을 그대로 따른다** — 아래는 케이스 본문:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OrderSheetScreen } from '../OrderSheetScreen';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';

// 참고: presets 테스트와 동일한 상위 모킹(toast·icons 등)을 재사용한다.

describe('OrderSheetScreen — 대회 유형 전환 (S1)', () => {
  const baseProps = {
    initialValues: initialOrderSheetValues(),
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
  };

  it('대회 세그먼트 선택 시 레거시로 이탈하지 않는다', () => {
    const onSwitchToLegacyForm = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={onSwitchToLegacyForm} />
    );
    fireEvent.press(getByTestId('order-sheet-type-tournament'));
    expect(onSwitchToLegacyForm).not.toHaveBeenCalled();
    expect(getByTestId('order-sheet-type-tournament').props.accessibilityState.selected).toBe(true);
  });

  it('고정 세그먼트는 아직 레거시로 위임한다', () => {
    const onSwitchToLegacyForm = jest.fn();
    const { getByTestId } = render(
      <OrderSheetScreen {...baseProps} onSwitchToLegacyForm={onSwitchToLegacyForm} />
    );
    fireEvent.press(getByTestId('order-sheet-type-fixed'));
    expect(onSwitchToLegacyForm).toHaveBeenCalledWith('fixed');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest OrderSheetScreen.tournament.test.tsx`
Expected: FAIL — 현재 `handleTypeChange`가 tournament도 `onSwitchToLegacyForm` 호출(첫 케이스 실패). 또한 `TypeSegment` value prop 타입 오류로 tsc 실패 가능.

- [ ] **Step 3: TypeSegment value prop 확장**

`TypeSegment.tsx:8-14`:

```tsx
export function TypeSegment({
  value,
  onChange,
}: {
  value: 'regular' | 'urgent' | 'tournament';
  onChange: (t: PostingType) => void;
}) {
```

- [ ] **Step 4: handleTypeChange — 고정만 이탈**

`OrderSheetScreen.tsx:398-407`:

```tsx
  const handleTypeChange = useCallback(
    (t: PostingType) => {
      if (t === 'fixed') {
        onSwitchToLegacyForm(t); // 고정은 아직 레거시(S2에서 주문서 이관). dirty 확인은 create.tsx.
        return;
      }
      // 여기서 t는 regular|urgent|tournament (TS 내로잉)
      form.setValue('postingType', t, { shouldDirty: true });
    },
    [form, onSwitchToLegacyForm]
  );
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest OrderSheetScreen.tournament.test.tsx`
Expected: PASS (2 케이스).

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/components/employer/order-sheet/TypeSegment.tsx uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.tournament.test.tsx
git commit -m "feat(jobs): 대회 유형은 주문서 내부 처리 — 세그먼트 이탈 로직 고정 전용화(S1)"
```

---

## Task 3: 대회 안내 배너 + 제출 버튼 라벨 '승인 요청'

대회 선택 시 승인 안내를 노출하고 제출 버튼을 "승인 요청하기"로 바꾼다(레거시 폼 패리티).

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx` (배너 삽입 :459 직후, submitLabel :429-445)
- Test: `uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.tournament.test.tsx` (확장)

**Interfaces:**
- Consumes: `values.postingType`(라인 458에서 접근 중), `InformationCircleIcon`(`@/components/icons`).
- Produces: `testID="order-sheet-tournament-notice"` 배너, tournament + 전 행 설정 시 submitLabel `'승인 요청하기'`.

- [ ] **Step 1: 실패하는 테스트 작성**

`OrderSheetScreen.tournament.test.tsx`에 추가. 전 행이 채워진 완성 대회 initialValues로 렌더:

```tsx
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const completeTournamentValues: OrderSheetFormValues = {
  postingType: 'tournament',
  title: 'WSOP 서울 딜러',
  location: { name: '강남 홀덤펍', address: '서울 강남구', region: 'seoul-gangnam' },
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [
    { dates: ['2026-08-01'], timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 3 }] }], grouped: false },
  ],
  salary: { type: 'daily', amount: 200000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};

describe('OrderSheetScreen — 대회 안내·제출 라벨 (S1)', () => {
  const props = {
    onSubmit: jest.fn(),
    isSubmitting: false,
    myPhone: '010-0000-0000',
    onSwitchToLegacyForm: jest.fn(),
  };

  it('대회 선택 시 승인 안내 배너를 노출한다', () => {
    const { getByTestId } = render(
      <OrderSheetScreen {...props} initialValues={completeTournamentValues} />
    );
    expect(getByTestId('order-sheet-tournament-notice')).toBeTruthy();
  });

  it('지원 유형에서는 배너가 없다', () => {
    const { queryByTestId } = render(
      <OrderSheetScreen {...props} initialValues={initialOrderSheetValues()} />
    );
    expect(queryByTestId('order-sheet-tournament-notice')).toBeNull();
  });

  it('완성된 대회는 제출 라벨이 "승인 요청하기"다', () => {
    const { getByText } = render(
      <OrderSheetScreen {...props} initialValues={completeTournamentValues} />
    );
    expect(getByText('승인 요청하기')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest OrderSheetScreen.tournament.test.tsx -t "안내"`
Expected: FAIL — 배너 testID 없음, 라벨 '이대로 등록'.

- [ ] **Step 3: 배너 삽입**

`OrderSheetScreen.tsx` — 상단 import에 `InformationCircleIcon` 추가(기존 icons import 라인에 병합). 라인 459(`</View>` — TypeSegment 래퍼) 직후, `ORDER_GROUPS.map` 직전에 삽입:

```tsx
        {values.postingType === 'tournament' ? (
          <View
            className="flex-row items-start gap-2 mb-3 rounded-xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-3.5 py-3"
            accessibilityRole="alert"
            testID="order-sheet-tournament-notice"
          >
            <InformationCircleIcon size={18} />
            <Text className="flex-1 text-xs font-sans text-content-secondary leading-5 dark:leading-[1.125rem]">
              대회 공고는 관리자 승인 후 게시돼요. 승인까지 1~2 영업일이 걸릴 수 있어요.
            </Text>
          </View>
        ) : null}
```

(`Text`/`View`는 이미 import됨 — OrderSheetScreen 상단 확인. impeccable §14: 이모지 대신 Lucide 아이콘 사용.)

- [ ] **Step 4: 제출 라벨 분기**

`OrderSheetScreen.tsx:429-431` — `submitLabel` IIFE 시작부:

```tsx
  const submitLabel = (() => {
    if (unsetTarget === null) {
      return values.postingType === 'tournament' ? '승인 요청하기' : '이대로 등록';
    }
```

(나머지 미설정 행 유도 로직은 불변.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest OrderSheetScreen.tournament.test.tsx`
Expected: PASS (5 케이스 — Task 2의 2 + Task 3의 3).

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/components/employer/order-sheet/OrderSheetScreen.tsx uniqn-mobile/src/components/employer/order-sheet/__tests__/OrderSheetScreen.tournament.test.tsx
git commit -m "feat(jobs): 대회 승인 안내 배너 + 제출 라벨 '승인 요청하기'(S1)"
```

---

## Task 4: 완료 화면 대회 승인 안내

대회 등록 완료 화면에서 "승인 후 게시" 안내를 보여준다.

**Files:**
- Modify: `uniqn-mobile/app/(employer)/my-postings/create.tsx:215-259`
- Modify: `uniqn-mobile/app/(employer)/my-postings/create-success.tsx`
- Test: `uniqn-mobile/app/(employer)/my-postings/__tests__/create-success.tournament.test.tsx` (Create)

**Interfaces:**
- Consumes: `values.postingType`(handleOrderSheetSubmit 내), `useLocalSearchParams` `pending` 파라미터.
- Produces: create-success가 `pending==='1'`이면 승인 안내 문구를 렌더.

- [ ] **Step 1: 실패하는 테스트 작성**

`create-success.tournament.test.tsx` (Create). expo-router 파라미터를 모킹해 렌더:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import CreateSuccessScreen from '../create-success';

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/hooks/useShare', () => ({ useShare: () => ({ shareJobById: jest.fn(), isSharing: false }) }));
jest.mock('@/hooks/useTemplateManager', () => ({
  useTemplateManager: () => ({ templates: [], isTemplateModalOpen: false, handleSaveTemplate: jest.fn() }),
}));
jest.mock('@/utils/order-sheet/lastSubmitted', () => ({
  getLastSubmittedDraft: () => null,
  clearLastSubmittedDraft: jest.fn(),
}));

describe('CreateSuccessScreen — 대회 승인 안내 (S1)', () => {
  afterEach(() => { for (const k of Object.keys(mockParams)) delete mockParams[k]; });

  it('pending=1이면 승인 안내 문구를 보여준다', () => {
    Object.assign(mockParams, { id: 'p1', title: '대회 딜러', pending: '1' });
    const { getByText } = render(<CreateSuccessScreen />);
    expect(getByText('관리자 승인 후 게시돼요 (1~2 영업일)')).toBeTruthy();
  });

  it('pending이 없으면 기본 안내 문구를 보여준다', () => {
    Object.assign(mockParams, { id: 'p1', title: '주말 딜러' });
    const { getByText } = render(<CreateSuccessScreen />);
    expect(getByText('지원자가 생기면 바로 알려드릴게요')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npx jest create-success.tournament.test.tsx`
Expected: FAIL — 첫 케이스가 승인 문구를 못 찾음(현재 항상 기본 문구).

- [ ] **Step 3: create-success.tsx — pending 파라미터 렌더**

`create-success.tsx:23-32` params 타입에 `pending` 추가 + 파생:

```tsx
  const params = useLocalSearchParams<{
    id?: string | string[];
    title?: string | string[];
    summary?: string | string[];
    suggestPreset?: string | string[];
    pending?: string | string[];
  }>();
  const postingId = first(params.id);
  const title = first(params.title);
  const summary = first(params.summary);
  const suggestPreset = first(params.suggestPreset) === '1';
  const pending = first(params.pending) === '1';
  const hasPostingId = !!postingId;
```

`create-success.tsx:75-77` 서브헤더 문구 분기:

```tsx
          <Text className="text-sm text-content-secondary font-sans mt-1.5 text-center">
            {pending ? '관리자 승인 후 게시돼요 (1~2 영업일)' : '지원자가 생기면 바로 알려드릴게요'}
          </Text>
```

- [ ] **Step 4: create.tsx — pending 파라미터 전달**

`create.tsx:239-247` success 화면 navigate params에 `pending` 추가:

```tsx
          router.replace({
            pathname: '/(employer)/my-postings/create-success',
            params: {
              id: created.id,
              title: values.title,
              summary,
              suggestPreset: templateManager.templates.length === 0 ? '1' : '0',
              pending: values.postingType === 'tournament' ? '1' : '0',
            },
          });
```

그리고 `create.tsx:223-225` venueId 조기 복귀 분기의 토스트도 대회 안내로 분기:

```tsx
        if (venueId && router.canGoBack()) {
          addToast({
            type: 'success',
            message:
              values.postingType === 'tournament'
                ? '공고가 등록됐어요. 관리자 승인 후 게시돼요.'
                : '공고가 등록되었습니다.',
          });
          router.back();
        }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd uniqn-mobile && npx jest create-success.tournament.test.tsx`
Expected: PASS (2 케이스).

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/app/(employer)/my-postings/create-success.tsx uniqn-mobile/app/(employer)/my-postings/create.tsx uniqn-mobile/app/(employer)/my-postings/__tests__/create-success.tournament.test.tsx
git commit -m "feat(jobs): 대회 등록 완료화면·토스트 승인 안내 분기(S1)"
```

---

## Task 5: S1 통합 검증 (품질 게이트 + 수동 QA)

전체 게이트를 돌려 회귀 없음을 확인하고 실기기 QA 체크리스트를 남긴다.

**Files:** 없음 (검증 전용).

- [ ] **Step 1: 타입·린트·포맷 게이트**

Run: `cd uniqn-mobile && npm run quality`
Expected: exit 0 (tsc 0 errors · eslint 0 · prettier clean). 특히 `TypeSegment` value 타입·`handleTypeChange` 내로잉·`draftToValues` 반환 타입이 tsc를 통과하는지 확인.

- [ ] **Step 2: 관련 스위트 전체 실행**

Run: `cd uniqn-mobile && npx jest src/utils/order-sheet src/components/employer/order-sheet app/(employer)/my-postings`
Expected: PASS (신규 케이스 + 기존 order-sheet 스위트 무회귀).

- [ ] **Step 3: 대회 create input 계약 스팟체크**

주문서 대회 제출이 Repository 승인 주입 조건(`input.postingType === 'tournament'`)을 실제로 만족하는지 재확인 — Task 1 Step 1의 `valuesToCreateInput` 케이스가 이를 커버함을 로그로 확인:
Run: `cd uniqn-mobile && npx jest src/utils/order-sheet/__tests__/mappers.test.ts -t "Repository 승인"`
Expected: PASS (postingType 'tournament' 보존).

- [ ] **Step 4: 수동 QA 체크리스트 (실기기 — 사용자 게이트)**

다음을 문서화(별도 실행 아님, S1 출하 전 사용자 수행):
- [ ] 주문서 진입 → 유형 '대회' 탭 → 레거시 폼으로 튕기지 않고 승인 배너 노출.
- [ ] 대회 공고 전 행 작성 → 제출 버튼 '승인 요청하기' → 등록 → 완료화면 "관리자 승인 후 게시돼요".
- [ ] 등록된 대회가 관리자 승인 전 검색 비노출(`approvalStatus=PENDING` 실제 주입 확인).
- [ ] 유형 '고정' 탭 → 기존처럼 레거시 상세폼 전환(S2 전까지 무회귀).
- [ ] 지원/급구 생성 무회귀(기존 플로우).

- [ ] **Step 5: (커밋 없음) 검증 결과 보고**

`npm run quality` exit 코드와 jest 통과 수를 이 세션 도구 결과로 보고. 실패 시 해당 태스크로 복귀.

---

## Self-Review (작성자 점검)

- **Spec 커버리지**: 설계 §5 생성 경로(승인 자동 주입·토스트·버튼 라벨·배너) → Task 1/3/4. §6 S1(enum·silent-coercion·이탈 로직) → Task 1/2. 편집(§5)·고정(§6 S2)은 S1 범위 밖(별도 계획) — 의도된 경계.
- **Placeholder 스캔**: 모든 코드 스텝에 실제 코드·정확 경로·실행 명령·기대 출력 포함. TBD 없음.
- **타입 일관성**: `postingType` 확장값 `'regular'|'urgent'|'tournament'`이 schema(Task1)·TypeSegment(Task2)·mappers(Task1) 전반 일치. `draftToValues`의 `'fixed'→'regular'` 폴백은 도달 불가 가드(주석 명시).
- **미확정 1건**: 대회 **편집** 시 승인상태 보존은 S3 범위 — 이 계획(S1 생성)에는 편집 경로 없음. 설계문서 §5 각주 유지.
