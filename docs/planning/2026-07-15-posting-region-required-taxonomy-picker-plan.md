# 공고작성 지역 필수화 + RegionTaxonomyBrowser 공유 추출 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공고작성(주문서) 장소의 지역(region)을 제출 필수로 만들고, 지역 선택 UI를 구인구직 필터(#254)와 동일한 2패널 택소노미 구조(공유 컴포넌트)로 교체한다.

**Architecture:** 필터 `RegionFilterSheet`의 2패널 본문(검색+좌 그룹 사이드바+우 그리드/구 아코디언)을 Modal 비의존·선택모델 비의존 `RegionTaxonomyBrowser`로 추출한다. 필터(멀티 토큰)와 `PlaceSheet` `mode:'region'`(단일 slug)이 같은 본문을 소비한다. 스키마는 z.input 관용·z.output 필수(refine 프레디킷) 관례로 타입 파급 0.

**Tech Stack:** Expo 55 / RN 0.83 / TS strict / NativeWind 4.2 / zod **v4**(4.1.13) / react-hook-form + zodResolver / jest + @testing-library/react-native

**스펙:** `docs/planning/2026-07-15-posting-region-required-taxonomy-picker-design.md` (승인됨)

## Global Constraints

- 모든 응답·커밋 메시지·주석 **한글**. 커밋 형식 `<type>(<scope>): <한글>`.
- 작업 디렉토리 `uniqn-mobile/`. 경로는 `@/` 절대 경로만.
- 다크모드 `dark:` 항상 병기. 앱 런타임 `console.log()` 금지(`logger` 사용 — 이번 변경엔 로깅 불필요).
- zod **v4** — `required_error` 등 v3 파라미터 금지. 메시지는 positional 또는 refine 2번째 인자.
- 불변성: 상태는 항상 새 객체(`{...draft, region}`).
- RN-web 함정: 사이드바 `ScrollView`는 `w-[76px] grow-0 shrink-0` **필수 유지**(#254 실측 — 기본 flexGrow:1이 50/50 폭 분할 유발).
- 중첩 RN Modal 금지(iOS 터치먹통 #186/#243) — 지역 브라우저는 `SheetModal` **인라인** 렌더만.
- jest 실행: `uniqn-mobile/`에서 `npx jest <경로>`. 전체 품질: `npm run quality`.
- 파일당 800줄 이하. 기존 파일의 주석 밀도·네이밍 관례를 따른다.

---

### Task 0: 워크트리 격리 + 설계문서 커밋

master에 다른 세션의 미커밋 wiki 변경이 있으므로(병렬세션 격리 규칙) 새 워크트리+브랜치에서 작업한다.

**Files:**
- 없음 (git 셋업)

- [ ] **Step 1: 워크트리 + 브랜치 생성**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git worktree add ../T-HOLDEM-region-picker -b feat/posting-region-required-picker
```

Expected: `Preparing worktree (new branch 'feat/posting-region-required-picker')`

- [ ] **Step 2: node_modules junction (5분 npm install 절약 — 프로젝트 관례)**

```bash
cmd /c mklink /J "C:\Users\user\Desktop\T-HOLDEM-region-picker\uniqn-mobile\node_modules" "C:\Users\user\Desktop\T-HOLDEM\uniqn-mobile\node_modules"
```

Expected: `Junction created for ...`

- [ ] **Step 3: 설계/계획 문서를 워크트리로 복사 후 커밋**

메인 워크트리의 untracked 문서 2개를 새 워크트리 `docs/planning/`에 복사:
- `2026-07-15-posting-region-required-taxonomy-picker-design.md`
- `2026-07-15-posting-region-required-taxonomy-picker-plan.md`

```bash
cd C:/Users/user/Desktop/T-HOLDEM-region-picker
cp ../T-HOLDEM/docs/planning/2026-07-15-posting-region-required-taxonomy-picker-*.md docs/planning/
git add docs/planning/2026-07-15-posting-region-required-taxonomy-picker-design.md docs/planning/2026-07-15-posting-region-required-taxonomy-picker-plan.md
git commit -m "docs(jobs): 공고작성 지역 필수화 + 택소노미 피커 설계·계획"
```

이후 모든 Task는 `C:/Users/user/Desktop/T-HOLDEM-region-picker/uniqn-mobile`에서 수행.

---

### Task 1: 스키마 — region 런타임 필수화 (z.input 관용 유지)

**Files:**
- Modify: `uniqn-mobile/src/schemas/orderSheet.schema.ts:64-73`
- Test: `uniqn-mobile/src/schemas/__tests__/orderSheet.schema.test.ts`

**Interfaces:**
- Consumes: `isRegionSlug` (`@/constants/regions`) — 기존.
- Produces: `orderSheetLocationSchema` — z.input `region?: string`(불변), **z.output `region: string`**. 실패 메시지: 미선택 `'지역을 선택해주세요'`(path `['location','region']`) · 비정상 slug `'지역 값이 올바르지 않습니다'`. Task 4·5가 이 메시지·경로에 의존.

- [ ] **Step 1: 실패하는 테스트 작성** — `orderSheet.schema.test.ts` 끝에 추가:

```ts
describe('orderSheetValuesSchema — location.region 필수 (2026-07-15)', () => {
  it('region 없는 location은 거부된다 (지역을 선택해주세요, path location.region)', () => {
    const result = orderSheetValuesSchema.safeParse({
      ...validInput,
      location: { name: '라운더스 홀덤펍' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'location.region');
      expect(issue?.message).toBe('지역을 선택해주세요');
    }
  });

  it('유효 slug(구·시 전체·구없는 시)는 통과한다', () => {
    for (const region of ['서울 강남구', '부산', '강원 원주시']) {
      const result = orderSheetValuesSchema.safeParse({
        ...validInput,
        location: { name: '라운더스 홀덤펍', region },
      });
      expect(result.success).toBe(true);
    }
  });

  it('권역 문자열·비정상 값은 거부된다 (지역 값이 올바르지 않습니다)', () => {
    for (const region of ['서울', '경상', '없는지역']) {
      const result = orderSheetValuesSchema.safeParse({
        ...validInput,
        location: { name: '라운더스 홀덤펍', region },
      });
      expect(result.success).toBe(false);
    }
  });
});
```

주의: '서울'은 slug가 아니다(25개 구 flat, `regions.ts:138-140`) — 권역 배제 케이스로 사용. '부산'은 구 보유 시 slug(시 전체), '강원 원주시'는 구 없는 시 slug.

- [ ] **Step 2: 실패 확인**

```bash
npx jest src/schemas/__tests__/orderSheet.schema.test.ts -t "location.region 필수"
```

Expected: FAIL — "region 없는 location은 거부된다"가 실패(현재 optional이라 success=true).

- [ ] **Step 3: 스키마 수정** — `orderSheet.schema.ts`의 `orderSheetLocationSchema`:

```ts
export const orderSheetLocationSchema = z.object({
  name: safeText(50).min(1, '장소를 선택해주세요'),
  address: safeText(200).optional(),
  district: safeText(50).optional(),
  // 지역 필수(2026-07-15) — location nullable 관례와 동형: z.input 은 관용(optional),
  // 아래 refine 프레디킷이 z.output 에서만 undefined 를 제거한다(타입 파급 0 — 레거시
  // region-less draft 는 로드·편집 관용, 제출 시 여기서 거부되어 지역 추가 유도).
  region: z
    .string()
    .refine((s) => isRegionSlug(s), '지역 값이 올바르지 않습니다')
    .optional()
    .refine((v) => v !== undefined, '지역을 선택해주세요'),
  detailedAddress: safeText(200).optional(),
});
```

- [ ] **Step 4: 기존 픽스처에 region 추가** — 같은 테스트 파일 상단 `validInput`(`:19`)과 `unspecifiedSalaryModeInput`(`:30`)의 location을:

```ts
location: { name: '라운더스 홀덤펍', region: '서울 강남구' },
```

- [ ] **Step 5: 스위트 그린 확인**

```bash
npx jest src/schemas/__tests__/orderSheet.schema.test.ts
```

Expected: PASS 전량 (기존 케이스 + 신규 3케이스).

- [ ] **Step 6: 주변 파급 확인** — 주문서 화면·매퍼 테스트가 region 없는 픽스처로 스키마를 태우는 지점 스위프:

```bash
npx jest src/components/employer/order-sheet src/utils/order-sheet
```

실패가 있으면 해당 픽스처 location에 `region: '서울 강남구'`를 추가(검증 완화 금지 — 픽스처만 갱신). PlaceSheet.test.tsx 실패는 Task 4에서 다루므로 여기선 건드리지 않는다(실패 목록만 기록).

- [ ] **Step 7: 커밋**

```bash
git add src/schemas/orderSheet.schema.ts src/schemas/__tests__/orderSheet.schema.test.ts
git commit -m "feat(jobs): 주문서 location.region 제출 필수화 — z.input 관용·z.output 필수"
```

(Step 6에서 고친 픽스처 파일이 있으면 함께 add.)

---

### Task 2: RegionTaxonomyBrowser 추출 (신규 공유 컴포넌트)

**Files:**
- Create: `uniqn-mobile/src/components/region/RegionTaxonomyBrowser.tsx`
- Test: `uniqn-mobile/src/components/region/__tests__/RegionTaxonomyBrowser.test.tsx`

**Interfaces:**
- Consumes: `@/constants/regions`의 `REGION_GROUPS`, `REGIONS_BY_GROUP`, `getRegionChildren`, `getRegionLabel`, `hasRegionChildren`, `searchRegions`, `RegionGroup`, `RegionOption` · `@/stores/themeStore` · `@/constants/colors`.
- Produces: `RegionTaxonomyBrowser` 컴포넌트 + `RegionTaxonomyBrowserProps`. Task 3·4가 소비. **루트는 `flex-1`** — 부모가 높이를 bound해야 한다.

- [ ] **Step 1: 실패하는 테스트 작성** — `RegionTaxonomyBrowser.test.tsx`:

```tsx
/**
 * 지역 택소노미 브라우저 — 선택모델 비의존 공유 본문 검증.
 * 단일선택 하이라이트/픽 · 아코디언 · 시 전체 · 검색 · 그룹전체 슬롯 유무 · a11y role 분기.
 */
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { RegionTaxonomyBrowser } from '../RegionTaxonomyBrowser';

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

describe('RegionTaxonomyBrowser', () => {
  it('단일선택 — 구 칩 픽 시 onPickSlug(slug) 호출, isSelected(slug)만 하이라이트', () => {
    const onPickSlug = jest.fn();
    const { getByText, getByLabelText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={(s) => s === '서울 강남구'}
        onPickSlug={onPickSlug}
      />
    );
    // 기본 그룹 서울 — 구 칩 노출
    fireEvent.press(getByText('강남구'));
    expect(onPickSlug).toHaveBeenCalledWith('서울 강남구');
    // 단일선택 role=radio + selected
    expect(getByLabelText('강남구 지역').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true })
    );
  });

  it('아코디언 — 확장 칩(부산) 탭은 픽이 아니라 펼침, "부산 전체"와 구 칩이 노출된다', () => {
    const onPickSlug = jest.fn();
    const { getByText } = render(
      <RegionTaxonomyBrowser selectionMode="single" isSelected={() => false} onPickSlug={onPickSlug} />
    );
    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산'));
    expect(onPickSlug).not.toHaveBeenCalled(); // 펼침은 픽 아님
    expect(getByText('해운대구')).toBeTruthy();
    fireEvent.press(getByText('부산 전체'));
    expect(onPickSlug).toHaveBeenCalledWith('부산'); // 시 전체 = 시 slug
  });

  it('renderGroupAllRow 미지정이면 그룹전체 행이 없다 (단일선택 권역 배제)', () => {
    const { queryByText, getByText } = render(
      <RegionTaxonomyBrowser selectionMode="single" isSelected={() => false} onPickSlug={jest.fn()} />
    );
    fireEvent.press(getByText('경기'));
    expect(queryByText('경기 전체')).toBeNull();
  });

  it('renderGroupAllRow 지정 시 활성 그룹으로 렌더된다 (멀티 필터 슬롯)', () => {
    const { getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="multi"
        isSelected={() => false}
        onPickSlug={jest.fn()}
        renderGroupAllRow={(group) => <Text>{`${group} 전체 행`}</Text>}
      />
    );
    expect(getByText('서울 전체 행')).toBeTruthy();
  });

  it('검색 — 구 결과에 부모 시를 병기하고, 탭 시 onPickSlug(slug)', () => {
    const onPickSlug = jest.fn();
    const { getByTestId, getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={() => false}
        onPickSlug={onPickSlug}
        searchInputTestID="test-region-search"
      />
    );
    fireEvent.changeText(getByTestId('test-region-search'), '해운대');
    expect(getByText('경상 · 부산')).toBeTruthy();
    fireEvent.press(getByText('해운대구'));
    expect(onPickSlug).toHaveBeenCalledWith('부산 해운대구');
  });

  it('initialGroup 지정 시 해당 그룹으로 시작한다', () => {
    const { getByText } = render(
      <RegionTaxonomyBrowser
        selectionMode="single"
        isSelected={() => false}
        onPickSlug={jest.fn()}
        initialGroup="강원"
      />
    );
    expect(getByText('원주시')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npx jest src/components/region/__tests__/RegionTaxonomyBrowser.test.tsx
```

Expected: FAIL — "Cannot find module '../RegionTaxonomyBrowser'"

- [ ] **Step 3: 컴포넌트 구현** — `RegionTaxonomyBrowser.tsx`. `RegionFilterSheet.tsx`의 본문 로직(칩·확장칩·activeSections·검색)을 **이동**하되 선택모델만 콜백화:

```tsx
/**
 * UNIQN Mobile - 지역 택소노미 브라우저 (공유 본문)
 *
 * @description 2-패널(좌: 그룹 탭 / 우: 칩 그리드 + 구 아코디언) + 검색. Modal 비의존·선택모델
 * 비의존 프레젠테이션 — 하이라이트/픽을 isSelected/onPickSlug 콜백으로 위임한다.
 * 소비처: RegionFilterSheet(멀티 토큰 토글) · PlaceSheet mode:'region'(단일 slug 교체).
 * 그룹 전체("서울 전체")는 renderGroupAllRow 슬롯 — 미지정이면 미노출(단일선택의 권역 배제).
 * 루트는 flex-1: 부모가 높이를 bound 해야 한다.
 */

import { Fragment, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, XMarkIcon } from '@/components/icons';
import { PRIMARY_COLORS, SECONDARY_PALETTE } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
import {
  REGION_GROUPS,
  REGIONS_BY_GROUP,
  getRegionChildren,
  getRegionLabel,
  hasRegionChildren,
  searchRegions,
  type RegionGroup,
  type RegionOption,
} from '@/constants/regions';

export interface RegionTaxonomyBrowserProps {
  /** a11y role 분기 — multi: checkbox/checked, single: radio/selected */
  selectionMode: 'multi' | 'single';
  /** slug 하이라이트 여부 (단일: slug===region / 멀티: pending 포함 여부) */
  isSelected: (slug: string) => boolean;
  /** slug 픽 — 토글/교체 판단은 caller 책임. 그룹 전체는 renderGroupAllRow 가 담당 */
  onPickSlug: (slug: string) => void;
  /** 좌 그룹 탭 배지 개수 (멀티 필터 전용 — 미지정이면 배지 미노출) */
  groupBadgeCount?: (group: RegionGroup) => number;
  /** 우측 상단 '그룹 전체' 행 (멀티 필터 전용 — 미지정이면 권역 선택 불가) */
  renderGroupAllRow?: (group: RegionGroup) => React.ReactNode;
  /** 검색박스 아래 슬롯 (필터 최근/내 지역 바로가기) */
  renderBelowSearch?: (ctx: { isSearching: boolean }) => React.ReactNode;
  initialGroup?: RegionGroup;
  searchInputTestID?: string;
}

/** 선택 체크 골드 — 라이트는 대비 확보용 primary-700 (RegionSelectModal 관례와 동일) */
function useCheckColor(): string {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  return isDarkMode ? PRIMARY_COLORS[500] : PRIMARY_COLORS[700];
}

type SelectableA11y = { role: 'checkbox' | 'radio'; state: (on: boolean) => object };
const a11yFor = (mode: 'multi' | 'single'): SelectableA11y =>
  mode === 'multi'
    ? { role: 'checkbox', state: (on) => ({ checked: on }) }
    : { role: 'radio', state: (on) => ({ selected: on }) };

/** 우측 그리드 칩 — 2열(48%) */
function RegionChip({
  label,
  selected,
  onPress,
  a11y,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  a11y: SelectableA11y;
}) {
  const checkColor = useCheckColor();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={a11y.role}
      accessibilityState={a11y.state(selected)}
      accessibilityLabel={`${label} 지역`}
      className={`min-h-[44px] w-[48%] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
          : 'border-secondary-200 dark:border-surface-overlay'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${
          selected ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? <CheckIcon size={16} color={checkColor} /> : null}
    </Pressable>
  );
}

/**
 * 구(3레벨) 보유 시 칩 — 탭은 선택이 아니라 하위 구 목록 펼침/접힘 토글.
 * 상태 표시: 시 전체 선택 시 selected 스타일, 아니면 선택된 구 개수 배지.
 */
function ExpansionChip({
  label,
  selected,
  childCount,
  expanded,
  onPress,
}: {
  label: string;
  selected: boolean;
  childCount: number;
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${label} 하위 지역 ${expanded ? '접기' : '펼치기'}`}
      className={`min-h-[44px] w-[48%] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
          : 'border-secondary-200 dark:border-surface-overlay'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${
          selected ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-1">
        {!selected && childCount > 0 ? (
          <View className="rounded-full bg-primary-600 px-1.5 dark:bg-primary-700">
            <Text className="font-sans-semibold text-[10px] text-content-onGold">{childCount}</Text>
          </View>
        ) : null}
        {expanded ? (
          <ChevronDownIcon size={16} color={SECONDARY_PALETTE[400]} />
        ) : (
          <ChevronRightIcon size={16} color={SECONDARY_PALETTE[400]} />
        )}
      </View>
    </Pressable>
  );
}

export function RegionTaxonomyBrowser({
  selectionMode,
  isSelected,
  onPickSlug,
  groupBadgeCount,
  renderGroupAllRow,
  renderBelowSearch,
  initialGroup,
  searchInputTestID,
}: RegionTaxonomyBrowserProps) {
  const [searchText, setSearchText] = useState('');
  const [activeGroup, setActiveGroup] = useState<RegionGroup>(initialGroup ?? '서울');
  // 단일 아코디언 — 한 번에 한 시(市)만 펼침. 그룹 전환·검색 진입 시 null 로 리셋.
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  const trimmedSearch = searchText.trim();
  const isSearching = trimmedSearch.length > 0;
  const searchResults = useMemo(() => searchRegions(trimmedSearch), [trimmedSearch]);
  const checkColor = useCheckColor();
  const a11y = a11yFor(selectionMode);

  // 우측 패널 섹션: subGroup(경기 남부/북부) 있으면 소섹션으로 분리
  const activeSections = useMemo(() => {
    // 그리드는 시-레벨(parentSlug 없는)만 — 구는 부모 시의 인라인 확장에서만 렌더(중복 노출 금지).
    const topLevel = REGIONS_BY_GROUP[activeGroup].filter((o) => !o.parentSlug);
    // 단일 시 그룹 승격(인천 케이스): 시-레벨이 정확히 1개이고 구를 보유하면
    // 그 시 칩을 숨기고 children 을 최상위 토글 칩으로 승격(서울 25구와 동형).
    const soleCity = topLevel.length === 1 ? topLevel[0] : undefined;
    const gridOptions =
      soleCity && hasRegionChildren(soleCity.slug) ? [...getRegionChildren(soleCity.slug)] : topLevel;
    const subGroups = Array.from(new Set(gridOptions.map((o) => o.subGroup).filter(Boolean)));
    if (subGroups.length === 0) {
      return [{ title: null as string | null, options: gridOptions }];
    }
    return subGroups.map((sub) => ({
      title: sub as string,
      options: gridOptions.filter((o) => o.subGroup === sub),
    }));
  }, [activeGroup]);

  const renderChip = (option: RegionOption) => (
    <RegionChip
      key={option.slug}
      label={option.label}
      selected={isSelected(option.slug)}
      onPress={() => onPickSlug(option.slug)}
      a11y={a11y}
    />
  );

  // 시(市) 셀 렌더 — 구 없는 항목은 일반 칩, 구 보유 항목은 확장 칩 + 펼침 시 인라인 구 그리드.
  const renderRegionCell = (option: RegionOption) => {
    if (!hasRegionChildren(option.slug)) {
      return renderChip(option);
    }
    const children = getRegionChildren(option.slug);
    const selectedChildCount = children.reduce(
      (n, child) => (isSelected(child.slug) ? n + 1 : n),
      0
    );
    const isExpanded = expandedCity === option.slug;
    const cityAllSelected = isSelected(option.slug);
    return (
      <Fragment key={option.slug}>
        <ExpansionChip
          label={option.label}
          selected={cityAllSelected}
          childCount={selectedChildCount}
          expanded={isExpanded}
          onPress={() => setExpandedCity((cur) => (cur === option.slug ? null : option.slug))}
        />
        {isExpanded ? (
          <View className="w-full rounded-lg bg-surface-card p-3 dark:bg-surface-elevated">
            <View className="flex-row flex-wrap justify-between gap-y-2">
              <RegionChip
                key={`${option.slug}-all`}
                label={`${option.label} 전체`}
                selected={cityAllSelected}
                onPress={() => onPickSlug(option.slug)}
                a11y={a11y}
              />
              {children.map(renderChip)}
            </View>
          </View>
        ) : null}
      </Fragment>
    );
  };

  return (
    <View className="flex-1">
      {/* ① 검색층 */}
      <View className="gap-2 px-4 pb-3 pt-1">
        <View className="min-h-[44px] flex-row items-center gap-2 rounded-lg border border-secondary-300 px-3 dark:border-surface-overlay">
          <SearchIcon size={18} color={SECONDARY_PALETTE[400]} />
          <TextInput
            value={searchText}
            onChangeText={(text) => {
              setSearchText(text);
              if (text.trim().length > 0) setExpandedCity(null);
            }}
            placeholder="지역 검색 (예: 강남, 수원)"
            placeholderTextColor={SECONDARY_PALETTE[400]}
            className="flex-1 py-2 font-sans text-base text-content-primary"
            accessibilityLabel="지역 검색"
            testID={searchInputTestID}
          />
          {isSearching ? (
            <Pressable
              onPress={() => setSearchText('')}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
            >
              <XMarkIcon size={16} color={SECONDARY_PALETTE[400]} />
            </Pressable>
          ) : null}
        </View>
        {renderBelowSearch?.({ isSearching })}
      </View>

      {/* ② 탐색층: 검색 결과(플랫) 또는 2-패널 */}
      {isSearching ? (
        <ScrollView
          className="flex-1 border-t border-secondary-100 dark:border-surface-overlay"
          keyboardShouldPersistTaps="handled"
        >
          {searchResults.length === 0 ? (
            <Text className="px-4 py-6 text-center font-sans text-sm text-content-secondary dark:text-secondary-400">
              &apos;{trimmedSearch}&apos; 지역을 찾지 못했어요. 구/시 이름으로 검색해보세요.
            </Text>
          ) : (
            searchResults.map((option) => {
              const selected = isSelected(option.slug);
              return (
                <Pressable
                  key={option.slug}
                  onPress={() => onPickSlug(option.slug)}
                  accessibilityRole={a11y.role}
                  accessibilityState={a11y.state(selected)}
                  accessibilityLabel={`${option.group} ${option.label} 선택`}
                  className="flex-row items-center justify-between border-b border-secondary-100 px-4 py-3.5 active:opacity-70 dark:border-surface-overlay"
                >
                  <View className="flex-row items-baseline gap-2">
                    <Text className="font-sans text-base text-content-primary">{option.label}</Text>
                    <Text className="font-sans text-xs text-content-muted dark:text-secondary-500">
                      {option.parentSlug
                        ? `${option.group} · ${getRegionLabel(option.parentSlug)}`
                        : option.group}
                    </Text>
                  </View>
                  {selected ? <CheckIcon size={20} color={checkColor} /> : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      ) : (
        <View className="flex-1 flex-row border-t border-secondary-100 dark:border-surface-overlay">
          {/* 좌: 그룹 탭 — 9그룹 세로 스크롤. grow-0/shrink-0 필수: RN-web ScrollView 는
              기본 flexGrow:1 이라 폭 지정이 flex-basis 로만 작동해 남은 공간을 나눠 갖는다(50/50 버그).
              76px = 2글자 라벨+선택 배지+웹 스크롤바까지 줄바꿈 없이 수용하는 최소 폭(실측) */}
          <ScrollView className="w-[76px] grow-0 shrink-0 bg-surface-card dark:bg-surface-elevated">
            {REGION_GROUPS.map((group) => {
              const isActive = group === activeGroup;
              const count = groupBadgeCount?.(group) ?? 0;
              return (
                <Pressable
                  key={group}
                  onPress={() => {
                    setActiveGroup(group);
                    setExpandedCity(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${group} 그룹${count > 0 ? `, ${count}개 선택됨` : ''}`}
                  className={`min-h-[48px] flex-row items-center justify-center gap-1 px-2 ${
                    isActive ? 'bg-surface-page dark:bg-surface' : ''
                  }`}
                >
                  <Text
                    className={`font-sans text-sm ${
                      isActive
                        ? 'font-sans-semibold text-content-primary'
                        : 'text-content-secondary dark:text-secondary-400'
                    }`}
                  >
                    {group}
                  </Text>
                  {count > 0 ? (
                    <View className="rounded-full bg-primary-600 px-1.5 dark:bg-primary-700">
                      <Text className="font-sans-semibold text-[10px] text-content-onGold">
                        {count}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 우: 그룹전체 슬롯 + 칩 그리드 (경기: 남부/북부 소섹션) */}
          <ScrollView className="flex-1 px-3 py-3" keyboardShouldPersistTaps="handled">
            {renderGroupAllRow?.(activeGroup)}
            {activeSections.map((section) => (
              <View key={section.title ?? 'all'} className="mb-2">
                {section.title ? (
                  <Text className="mb-2 font-sans-semibold text-xs text-content-muted dark:text-secondary-400">
                    {section.title}
                  </Text>
                ) : null}
                <View className="flex-row flex-wrap justify-between gap-y-2">
                  {section.options.map(renderRegionCell)}
                </View>
              </View>
            ))}
            <View className="h-4" />
          </ScrollView>
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 4: 테스트 그린 확인**

```bash
npx jest src/components/region/__tests__/RegionTaxonomyBrowser.test.tsx
```

Expected: PASS 6/6.

- [ ] **Step 5: 커밋**

```bash
git add src/components/region/
git commit -m "feat(region): RegionTaxonomyBrowser 공유 본문 추출 — 선택모델 비의존 2패널"
```

---

### Task 3: RegionFilterSheet — 공유 본문 소비 전환 (패리티 게이트)

**Files:**
- Modify: `uniqn-mobile/src/components/jobs/filters/RegionFilterSheet.tsx`
- Test: `uniqn-mobile/src/components/jobs/filters/__tests__/RegionFilterSheet.test.tsx` — **수정 금지**(그린 유지 자체가 패리티 증거)

**Interfaces:**
- Consumes: `RegionTaxonomyBrowser` (Task 2). 기존 `regionSelection` 토큰 유틸(무변경).
- Produces: `RegionFilterSheet` 외부 계약 불변(props·testID·onApply 토큰 동일).

- [ ] **Step 1: SheetBody 본문 교체** — 이동된 코드(RegionChip·ExpansionChip·useCheckColor·activeSections·검색층·2패널)를 삭제하고 browser 소비로 대체. `SheetBody`의 상태에서 `searchText`/`expandedCity` 제거(browser 내부화), `pending`/`showCapNotice`/카운트/바로가기 유지:

```tsx
// import 추가
import { RegionTaxonomyBrowser } from '@/components/region/RegionTaxonomyBrowser';

// SheetBody 반환부 — ①·② 층을 browser 로 대체, ③ 확인층은 기존 그대로 유지
return (
  <View className="-mx-5 -mb-5" style={{ height: sheetHeight }}>
    <RegionTaxonomyBrowser
      selectionMode="multi"
      isSelected={(slug) => pending.includes(slug)}
      onPickSlug={handleToggle}
      groupBadgeCount={(group) => groupCounts[group]}
      initialGroup={(appliedTokens[0] && regionTokenGroup(appliedTokens[0])) || '서울'}
      searchInputTestID="region-filter-search-input"
      renderBelowSearch={({ isSearching }) =>
        !isSearching && shortcuts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {shortcuts.map(({ token, label }) => (
              <ShortcutChip
                key={`shortcut-${token}`}
                label={label}
                selected={pending.includes(token)}
                onPress={() => handleToggle(token)}
              />
            ))}
          </ScrollView>
        ) : null
      }
      renderGroupAllRow={(group) =>
        GROUP_ALL_SUPPORTED.includes(group) ? (
          <Pressable
            onPress={() => handleToggle(groupToken(group))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: pending.includes(groupToken(group)) }}
            accessibilityLabel={`${group} 전체 선택`}
            className={`mb-3 min-h-[44px] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
              pending.includes(groupToken(group))
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-secondary-200 dark:border-surface-overlay'
            }`}
          >
            <Text
              className={`font-sans-semibold text-sm ${
                pending.includes(groupToken(group))
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-content-primary'
              }`}
            >
              {group} 전체
            </Text>
            {pending.includes(groupToken(group)) ? <CheckIcon size={16} color={checkColor} /> : null}
          </Pressable>
        ) : null
      }
    />

    {/* ③ 확인층: 기존 코드 그대로 (cap notice · 선택 트레이 · 초기화 · 적용 버튼) */}
    ...기존 505-567 라인 유지...
  </View>
);
```

주의:
- `useCheckColor`는 browser로 이동 — 필터의 그룹전체/트레이 체크 색은 browser에서 `useCheckColor`를 **named export** 하지 말고, 필터 파일에 동일 4줄 훅을 남겨둔다(그룹전체 행·검색결과 체크는 browser 책임 밖의 ③층/슬롯 소유. 파일 로컬 훅 중복 4줄은 결합보다 싸다).
- `activeGroup` 상태·`regionTokenGroup` 초기화는 browser의 `initialGroup`으로 이관.
- 이동으로 미사용이 된 import(`REGIONS_BY_GROUP`, `getRegionChildren`, `hasRegionChildren`, `searchRegions`, `getRegionLabel`, `Fragment`, `TextInput`, `SearchIcon`, `ChevronDownIcon`, `ChevronRightIcon`, `useWindowDimensions`는 sheetHeight에 여전히 필요 — 확인 후 정리) 제거. lint가 잡는다.

- [ ] **Step 2: 기존 필터 테스트 무수정 그린 (패리티 증거)**

```bash
npx jest src/components/jobs/filters/__tests__/RegionFilterSheet.test.tsx
```

Expected: PASS 전량, **테스트 파일 diff 0**. 실패하면 browser 추출이 동작을 바꾼 것 — 테스트가 아니라 browser/소비부를 고친다.

- [ ] **Step 3: 커밋**

```bash
git add src/components/jobs/filters/RegionFilterSheet.tsx
git commit -m "refactor(jobs): RegionFilterSheet 본문을 RegionTaxonomyBrowser 소비로 전환 — 기존 테스트 무수정 그린"
```

---

### Task 4: PlaceSheet — 2패널 단일선택 + 지역 필수 게이트

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/sheets/PlaceSheet.tsx`
- Test: `uniqn-mobile/src/components/employer/order-sheet/sheets/__tests__/PlaceSheet.test.tsx`

**Interfaces:**
- Consumes: `RegionTaxonomyBrowser`(Task 2) · `getRegionOption`/`getRegionLabel`(`@/constants/regions`).
- Produces: `PlaceSheet` props 계약 불변(`OrderSheetLocation`은 z.input 기준이라 region optional 유지). 동작 변경: 확인 버튼은 `name`+`region` 둘 다 있어야 활성.

- [ ] **Step 1: 테스트 갱신 (RED)** — `PlaceSheet.test.tsx`에서:

(a) 기존 테스트 4·5 교체 및 1·2 갱신 — 전체 교체본:

```tsx
  it('최근 장소(지역 있음) 탭 시 onConfirm + onClose', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const recent = [
      { name: '라운더스 홀덤펍', address: '서울 강남구 역삼동', region: '서울 강남구' },
    ];
    const { getByText } = render(
      <PlaceSheet visible value={null} recentLocations={recent} onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.press(getByText('라운더스 홀덤펍'));
    expect(onConfirm).toHaveBeenCalledWith(recent[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('지역 없는 최근 장소 탭 시 확정하지 않고 지역 선택으로 유도한다 (하위호환 게이트)', () => {
    const onConfirm = jest.fn();
    const recent = [{ name: '옛 홀덤펍', address: '서울 어딘가' }];
    const { getByText, getByTestId } = render(
      <PlaceSheet visible value={null} recentLocations={recent} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.press(getByText('옛 홀덤펍'));
    expect(onConfirm).not.toHaveBeenCalled();
    // region 모드 진입 — 택소노미 브라우저 검색박스 노출
    expect(getByTestId('order-sheet-region-search')).toBeTruthy();
  });

  it('새 장소 — 이름만으로는 확인 비활성, 지역 선택 후 slug 포함 확정 (필수 게이트)', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <PlaceSheet visible value={null} recentLocations={[]} onConfirm={onConfirm} onClose={onClose} />
    );

    fireEvent.changeText(getByTestId('order-sheet-place-name'), '  강남 홀덤펍  ');
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled(); // 지역 미선택 — 비활성

    fireEvent.press(getByText('지역 선택'));
    // 브라우저: 기본 서울 그룹 — 구 칩은 label(강남구), 저장은 slug(서울 강남구)
    fireEvent.press(getByText('강남구'));
    expect(getByText('지역: 강남구')).toBeTruthy(); // new 모드 복귀 + label 요약

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith({ name: '강남 홀덤펍', region: '서울 강남구' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('구 보유 시(부산)는 아코디언 — "부산 전체"(시 slug)도 선택 가능하다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <PlaceSheet visible value={null} recentLocations={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );

    fireEvent.changeText(getByTestId('order-sheet-place-name'), '부산 홀덤펍');
    fireEvent.press(getByText('지역 선택'));
    fireEvent.press(getByText('경상'));
    fireEvent.press(getByText('부산')); // 펼침(픽 아님)
    fireEvent.press(getByText('부산 전체'));
    expect(getByText('지역: 부산')).toBeTruthy();

    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ region: '부산' }));
  });
```

(b) 기존 "선택 안 함" 테스트(112-132행) **삭제** — 필수 계약으로 해제 어포던스 제거.
(c) 기존 테스트 2(47-65행: region 없이 confirm)와 4(83-110행: '지역 선택 (선택)' 라벨) **삭제** — 위 교체본이 커버.
(d) 나머지 테스트(빈 이름 비활성·rising-edge 레이스·XSS)는 유지.

- [ ] **Step 2: 실패 확인**

```bash
npx jest src/components/employer/order-sheet/sheets/__tests__/PlaceSheet.test.tsx
```

Expected: FAIL — '지역 선택' 라벨 부재('지역 선택 (선택)'), region 게이트 부재, `order-sheet-region-search` 부재.

- [ ] **Step 3: PlaceSheet 구현** — 변경 요점 전체:

```tsx
// import 교체: REGION_GROUPS/REGIONS_BY_GROUP → getRegionOption 추가, CheckIcon 제거,
// PRIMARY_COLORS 제거(지역 칩 이동), useWindowDimensions 추가
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { getRegionLabel, getRegionOption } from '@/constants/regions';
import { RegionTaxonomyBrowser } from '@/components/region/RegionTaxonomyBrowser';

// chipClass/chipTextClass 헬퍼 삭제 (region 모드 칩이 browser 로 이동)

export function PlaceSheet({ visible, value, recentLocations, onConfirm, onClose }: PlaceSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const { height: windowHeight } = useWindowDimensions();
  // ... mode/draft/rising-edge effect 기존 유지 ...

  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const nameTrimmed = draft.name.trim();
  const confirmDisabled = nameTrimmed.length === 0 || !draft.region; // 지역 필수(2026-07-15)
  // 브라우저는 flex-1 — SheetModal 인라인이라 명시 높이로 bound(실기기 그라운딩 대상)
  const regionBrowserHeight = Math.min(Math.round(windowHeight * 0.6), 520);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={mode === 'region' ? '지역 선택' : '어디서 일하나요?'}
      footer={
        mode === 'new' ? (
          <View className="gap-2">
            {confirmDisabled ? (
              <Text className="text-center text-xs text-content-muted font-sans">
                장소명과 지역을 입력하면 확인할 수 있어요
              </Text>
            ) : null}
            <Button
              onPress={() => {
                onConfirm({
                  ...draft,
                  name: nameTrimmed,
                  address: draft.address?.trim() || undefined,
                });
                onClose();
              }}
              disabled={confirmDisabled}
            >
              확인
            </Button>
          </View>
        ) : undefined
      }
    >
      {mode === 'list' && (
        <View className="gap-2">
          {recentLocations.map((loc) => (
            <Pressable
              key={`${loc.name}:${loc.address ?? ''}`}
              onPress={() => {
                // 하위호환: region 없는 저장 장소는 조용히 통과시키지 않고 지역 완성 유도
                if (!loc.region) {
                  setDraft({ ...loc });
                  setMode('region');
                  return;
                }
                onConfirm(loc);
                onClose();
              }}
              ...기존 클래스/접근성 유지...
            >
              <Text className="text-sm font-sans-medium text-content-primary">{loc.name}</Text>
              {loc.address ? (
                <Text className="text-xs text-content-muted font-sans">{loc.address}</Text>
              ) : null}
              {!loc.region ? (
                <Text className="text-xs text-content-muted font-sans">지역 미지정 — 탭해서 지역을 골라주세요</Text>
              ) : null}
            </Pressable>
          ))}
          ...새 장소 입력 버튼 기존 유지...
        </View>
      )}

      {mode === 'new' && (
        <View className="gap-2">
          ...최근 장소 복귀·이름·주소 TextInput 기존 유지...
          <Pressable
            onPress={() => setMode('region')}
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="지역 선택"
          >
            <Text className="text-sm text-content-primary font-sans">
              {draft.region ? `지역: ${getRegionLabel(draft.region) ?? draft.region}` : '지역 선택'}
            </Text>
          </Pressable>
        </View>
      )}

      {mode === 'region' && (
        <View className="gap-2" style={{ height: regionBrowserHeight }}>
          {/* 지역 모드 dead-end 방지 — 선택 없이 새 입력으로 복귀 */}
          <Pressable
            onPress={() => setMode('new')}
            className="flex-row items-center gap-1 min-h-[44px] justify-center active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel="지역 선택 취소하고 돌아가기"
          >
            <ChevronLeftIcon size={16} />
            <Text className="text-xs text-content-secondary font-sans">뒤로</Text>
          </Pressable>
          {/* 필터와 동일 2패널 택소노미(#254) — 단일선택: 픽 즉시 확정·복귀. 그룹전체 슬롯
              미지정 = 권역 선택 불가(필수 계약). 중첩 Modal 금지 — 인라인 렌더(#186/#243) */}
          <RegionTaxonomyBrowser
            selectionMode="single"
            isSelected={(slug) => draft.region === slug}
            onPickSlug={(slug) => {
              setDraft((d) => ({ ...d, region: slug }));
              setMode('new');
            }}
            initialGroup={draft.region ? getRegionOption(draft.region)?.group : undefined}
            searchInputTestID="order-sheet-region-search"
          />
        </View>
      )}
    </SheetModal>
  );
}
```

- [ ] **Step 4: 테스트 그린 확인**

```bash
npx jest src/components/employer/order-sheet/sheets/__tests__/PlaceSheet.test.tsx
```

Expected: PASS 전량 (유지 3 + 교체/신규 4).

- [ ] **Step 5: 커밋**

```bash
git add src/components/employer/order-sheet/sheets/PlaceSheet.tsx src/components/employer/order-sheet/sheets/__tests__/PlaceSheet.test.tsx
git commit -m "feat(jobs): 주문서 지역 선택을 2패널 택소노미 단일선택으로 교체 + 필수 게이트"
```

---

### Task 5: orderRowMeta — place 행 unset·에러 정렬 (H5)

**Files:**
- Modify: `uniqn-mobile/src/components/employer/order-sheet/orderRowMeta.ts:292-298` (getRowState place) · `:188-189` (errorMessageForRow)
- Test: `uniqn-mobile/src/components/employer/order-sheet/__tests__/orderRowMeta.test.ts`

**Interfaces:**
- Consumes: `OrderSheetFormValues`(Task 1의 z.input — region optional 그대로).
- Produces: `getRowState(values,'place')` — region 없으면 `unset: true`. `errorMessageForRow(errors,'place',0)` — `errors.location.region.message` 중첩 워킹.

- [ ] **Step 1: 실패하는 테스트 작성** — `orderRowMeta.test.ts`에 추가:

```ts
describe('place 행 — 지역 필수 정렬 (2026-07-15)', () => {
  const baseValues = {
    postingType: 'regular',
    title: '제목',
    location: { name: '라운더스 홀덤펍' },
    contactPhone: '010-1234-5678',
    scheduleGroups: [],
    salary: { type: 'hourly', amount: 0 },
  } as unknown as OrderSheetFormValues;

  it('region 없는 location은 unset (zod 통과 가능성과 정렬 — H5)', () => {
    const state = getRowState(baseValues, 'place');
    expect(state.unset).toBe(true);
  });

  it('region 있는 location은 set', () => {
    const state = getRowState(
      { ...baseValues, location: { name: '라운더스 홀덤펍', region: '서울 강남구' } },
      'place'
    );
    expect(state.unset).toBe(false);
    expect(state.value).toBe('라운더스 홀덤펍');
  });

  it('errors.location.region 중첩 메시지가 place 행 배지로 흐른다', () => {
    const msg = errorMessageForRow(
      { location: { region: { message: '지역을 선택해주세요' } } },
      'place',
      0
    );
    expect(msg).toBe('지역을 선택해주세요');
  });

  it('errors.location 루트 메시지(장소 null)는 기존대로 흐른다', () => {
    const msg = errorMessageForRow({ location: { message: '장소를 선택해주세요' } }, 'place', 0);
    expect(msg).toBe('장소를 선택해주세요');
  });
});
```

(파일 상단 import에 `getRowState`, `errorMessageForRow`, `OrderSheetFormValues` 타입이 이미 있는지 확인, 없으면 추가.)

- [ ] **Step 2: 실패 확인**

```bash
npx jest src/components/employer/order-sheet/__tests__/orderRowMeta.test.ts -t "지역 필수 정렬"
```

Expected: FAIL — unset이 false(현재 `location === null`만 판정), 중첩 메시지 undefined.

- [ ] **Step 3: 구현** — `getRowState` place 케이스:

```ts
    case 'place': {
      const loc = values.location;
      return {
        label: '장소',
        value: loc?.name ?? '',
        // 지역 필수(2026-07-15) — zod 통과 가능성과 정렬(H5): region 없으면 '이대로 등록' 오표기 금지
        unset: loc === null || !loc.region,
        optional: false,
      };
    }
```

`errorMessageForRow` — salary 분기 뒤·generic 폴백 앞에 place 분기 추가:

```ts
  if (key === 'place') {
    // location 중첩(name XSS·region 필수) 에러도 행 배지로 — 루트(null refine) 우선
    const loc = errors['location'] as Record<string, unknown> | undefined;
    return firstMessage(loc, loc?.['region'], loc?.['name'], loc?.['address'], loc?.['detailedAddress']);
  }
```

- [ ] **Step 4: 스위트 그린 확인**

```bash
npx jest src/components/employer/order-sheet/__tests__/orderRowMeta.test.ts
```

Expected: PASS 전량.

- [ ] **Step 5: 커밋**

```bash
git add src/components/employer/order-sheet/orderRowMeta.ts src/components/employer/order-sheet/__tests__/orderRowMeta.test.ts
git commit -m "fix(jobs): 주문서 place 행 unset·에러배지를 지역 필수와 정렬(H5)"
```

---

### Task 6: 전체 검증 스위프 (품질 게이트)

**Files:**
- Modify: 실패 시 발견되는 테스트 픽스처만 (`region: '서울 강남구'` 추가 — 검증 완화 금지)

- [ ] **Step 1: 전체 jest**

```bash
npx jest
```

Expected: 전 스위트 PASS. 실패 시 location 픽스처(region 누락)인지 확인 후 픽스처만 갱신. 원인 불명 실패는 구현 회귀 — 해당 Task로 돌아가 수정.

- [ ] **Step 2: 품질 게이트**

```bash
npm run quality
```

Expected: type-check·lint·format 0 에러. (미사용 import 잔재는 여기서 걸린다 — Task 3 정리 확인.)

- [ ] **Step 3: 커밋 (픽스처 수정이 있었던 경우만)**

```bash
git add -A
git commit -m "test(jobs): 지역 필수화 파급 픽스처 갱신"
```

---

### Task 7: 렌더 그라운딩 (실제 렌더러 관찰 — Exit Proof)

정적 파싱·jest는 관찰이 아니다. 실제 렌더러에서 1회 깨끗한 관찰로 완료를 증명한다.

- [ ] **Step 1: 워크트리에서 웹 렌더 기동** (워크트리 함정 2종 회피 필수)

```bash
cd C:/Users/user/Desktop/T-HOLDEM-region-picker/uniqn-mobile
cp ../../T-HOLDEM/uniqn-mobile/.env.development.local . 2>/dev/null || true
EXPO_ROUTER_APP_ROOT=C:/Users/user/Desktop/T-HOLDEM-region-picker/uniqn-mobile/app npx expo start --web --clear
```

(주의: junction+expo는 `EXPO_ROUTER_APP_ROOT` 절대경로 미지정 시 라우트 0 "Welcome to Expo" 증상 — 프로젝트 실측 함정.)

- [ ] **Step 2: 관찰 체크리스트** — 브라우저(gstack `/browse` 또는 playwright)로 employer 계정 진입 후:

1. 공고작성(주문서) → 장소 행 → 새 장소: 라벨 "지역 선택"(("(선택)" 없음)), 이름만 입력 시 확인 비활성 + 힌트 문구.
2. 지역 선택 진입: **2패널 렌더**(좌 76px 사이드바 / 우 그리드 — 50/50 폭 붕괴 없음), 그룹전체 행 **없음**.
3. 서울 그룹 구 칩 픽 → new 복귀 + "지역: 강남구" 요약 → 확인 활성 → 확정.
4. 경상 → 부산 아코디언 펼침 → "부산 전체" 픽 동작.
5. 검색("수원") → 결과 픽 동작.
6. 구인구직탭 지역 필터: 기존 멀티선택·그룹전체·트레이·적용 카운트 **회귀 0** 관찰.
7. 다크모드 토글 후 2·3 재확인(1회).

- [ ] **Step 3: 관찰 결과 기록** — 스크린샷 또는 관찰 로그를 보고에 첨부. 이상 발견 시 수정 → 재관찰(깨끗한 관찰 1회면 충분, 과잉 재검증 금지).

- [ ] **Step 4: 최종 커밋 정리 + 보고**

```bash
git log --oneline master..HEAD
git diff master --stat
```

보고에 포함: jest 카운트 실측, quality 0 에러, 관찰 체크리스트 결과, (push/PR은 사용자 요청 시만).

---

## Self-Review 결과

- **스펙 커버리지**: 스키마 필수화(Task 1)·공유 추출(Task 2)·필터 패리티(Task 3)·PlaceSheet 단일선택+게이트+하위호환(Task 4)·행 배지/unset 정렬(Task 5)·파급 스위프(Task 6)·렌더 그라운딩(Task 7) — 스펙 전 섹션 대응 확인.
- **타입 일관성**: `RegionTaxonomyBrowserProps`(Task 2 정의)를 Task 3·4가 동일 시그니처로 소비. 스키마 메시지 문자열('지역을 선택해주세요')이 Task 1·5 테스트에서 동일.
- **의도적 미결**: `regionBrowserHeight` 상수(0.6/520)는 Task 7 그라운딩에서 실측 조정 가능 — 플레이스홀더 아님(초기값 명시됨).
