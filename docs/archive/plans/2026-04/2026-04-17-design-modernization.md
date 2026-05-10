# Design Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `DESIGN.md`(Midnight Craft) 시스템을 블라인드식 B 카드 언어로 확장해 49개 화면을 일관된 전문가 톤으로 통합한다. 홈만 V2(레이아웃 변경), 나머지는 L1(표면만). 폴리시 P1~P8·P10 도입.

**Architecture:** 새 프리미티브 3개(`CardStripe`, `PressableCard`, `ScreenSkeleton`)를 신설하고, `Badge`에 `chip` variant 추가, 4개 stack `_layout.tsx`에 `OfflineBanner`·`StatusBar` 주입. 홈 V2만 `DashboardWidgetShell` 변형. 나머지 화면은 기존 컴포넌트 내부 className 교체로 무손상 restyle.

**Tech Stack:** Expo 55 / RN 0.83.4 / React 19.2 / TypeScript strict / NativeWind 4.2 / TailwindCSS / Jest / Supabase.

**Work directory:** `uniqn-mobile/` (단, `docs/`와 `.superpowers/`는 레포 루트).

---

## Phase Overview

| Phase | 범위 | 산출 커밋 메시지 |
|------|------|-----------------|
| 0 | 토큰 + 프리미티브 3개 + Chip variant | `feat(design): 토큰·Chip variant·CardStripe·PressableCard·ScreenSkeleton` |
| 1 | OfflineBanner·StatusBar·TabBar 인디케이터 | `refactor(layouts): OfflineBanner·StatusBar·TabBar underbar 주입` |
| 2 | 홈 V2 (Hero + 섹션 헤더) | `feat(home): V2 대시보드 (Hero + 섹션 헤더)` |
| 3 | Tier A 컴포넌트 restyle | `refactor(tier-a): 구인·공고상세·스케줄·지원자·정산 restyle` |
| 4 | Tier B 컴포넌트 restyle | `refactor(tier-b): 게시판·알림·공지·내공고·리뷰 restyle` |
| 5 | Tier C 베이스라인 | `refactor(tier-c): 설정·문의·admin restyle (+ stats 차트)` |
| 6 | 폴리시 도입 | `feat(polish): Skeleton·PTR·blurhash·haptics·focus ring·tabular-nums` |
| 7 | 검증·스냅샷·빌드 | `chore(test): jest snapshot -u + 수동 QA` |

각 phase 내부 task는 완료 시 **개별 커밋**, phase 종료 시 위 메시지로 통합 커밋(`git commit --squash` 또는 interactive rebase)할 수 있음. 무리하게 squash 하지 않고 개별 task별로 커밋해도 됨 — 최종 PR은 한 번.

---

## Phase 0 — Foundation (토큰 + 프리미티브)

### Task 0.1: Tailwind 토큰 추가

**Files:**
- Modify: `uniqn-mobile/tailwind.config.js`

- [ ] **Step 1: 현재 tailwind.config 구조 확인**

Run: `cat uniqn-mobile/tailwind.config.js | head -60`

- [ ] **Step 2: `extend` 블록에 `letterSpacing`, `fontVariantNumeric` 추가**

`uniqn-mobile/tailwind.config.js`의 `theme.extend`에 아래 블록 병합:

```js
extend: {
  // ...기존...
  letterSpacing: {
    'card-title': '-0.02em',
    'chip': '0.06em',
  },
  fontVariantNumeric: {
    'tabular': 'tabular-nums',
  },
}
```

- [ ] **Step 3: 타입 체크 통과 확인**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/tailwind.config.js
git commit -m "feat(tokens): letter-spacing·font-variant-tabular 유틸 추가"
```

---

### Task 0.2: Badge `chip` variant 추가

**Files:**
- Modify: `uniqn-mobile/src/components/ui/Badge.tsx`
- Test: `uniqn-mobile/src/components/ui/__tests__/Badge.test.tsx` (신설 or 확장)

- [ ] **Step 1: 실패 테스트 작성**

파일 확인: `ls uniqn-mobile/src/components/ui/__tests__/Badge.test.tsx` — 없으면 신설.

`uniqn-mobile/src/components/ui/__tests__/Badge.test.tsx`에 테스트 추가:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge } from '@/components/ui/Badge';

describe('Badge chip variant', () => {
  it('uppercase·letter-spacing·weight 700 적용', () => {
    const { getByText } = render(<Badge variant="chip">장기</Badge>);
    const text = getByText('장기');
    expect(text.props.className).toContain('uppercase');
    expect(text.props.className).toContain('tracking-chip');
    expect(text.props.className).toContain('font-sans-bold');
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern Badge`
Expected: FAIL — `'chip'` is not assignable to `BadgeVariant`.

- [ ] **Step 3: `BadgeVariant`에 `'chip'` 추가**

`uniqn-mobile/src/components/ui/Badge.tsx:11-18`의 타입 확장:

```tsx
export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'chip';
```

- [ ] **Step 4: `variantStyles`, `textStyles`, `dotStyles`에 `chip` 추가**

`Badge.tsx:89-117` 각 맵에 추가:

```tsx
const variantStyles: Record<BadgeVariant, string> = {
  // ...기존...
  chip: 'bg-primary-100 dark:bg-gold-subtle',
};

const textStyles: Record<BadgeVariant, string> = {
  // ...기존...
  chip: 'text-primary-700 dark:text-primary-400 uppercase tracking-chip',
};

const dotStyles: Record<BadgeVariant, string> = {
  // ...기존...
  chip: 'bg-primary-500',
};
```

- [ ] **Step 5: `textSizeStyles`는 동일 사용, weight만 bold로 오버라이드**

`Badge.tsx`의 `textClass` 계산 부분을 chip일 때 font-sans-bold가 적용되도록 수정:

```tsx
const textClass =
  variant === 'chip'
    ? `font-sans-bold ${textStyles[variant]} ${textSizeStyles[size]}`
    : `font-sans-medium ${textStyles[variant]} ${textSizeStyles[size]}`;
```

- [ ] **Step 6: 테스트 실행 → 통과 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern Badge`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/ui/Badge.tsx uniqn-mobile/src/components/ui/__tests__/Badge.test.tsx
git commit -m "feat(ui): Badge chip variant (uppercase + tracking-chip + bold)"
```

---

### Task 0.3: `CardStripe` 프리미티브 신설

**Files:**
- Create: `uniqn-mobile/src/components/ui/CardStripe.tsx`
- Create: `uniqn-mobile/src/components/ui/__tests__/CardStripe.test.tsx`
- Modify: `uniqn-mobile/src/components/ui/index.ts`

- [ ] **Step 1: 실패 테스트 작성**

`uniqn-mobile/src/components/ui/__tests__/CardStripe.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { CardStripe } from '@/components/ui/CardStripe';

describe('CardStripe', () => {
  it('children을 렌더한다', () => {
    const { getByText } = render(
      <CardStripe tone="gold"><Text>컨텐츠</Text></CardStripe>
    );
    expect(getByText('컨텐츠')).toBeTruthy();
  });

  it('tone에 따라 스트라이프 색 클래스를 적용한다', () => {
    const { getByTestId } = render(
      <CardStripe tone="info" testID="stripe"><Text>x</Text></CardStripe>
    );
    const stripe = getByTestId('stripe-bar');
    expect(stripe.props.className).toContain('bg-info-500');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern CardStripe`
Expected: FAIL — 파일 없음.

- [ ] **Step 3: CardStripe 구현**

`uniqn-mobile/src/components/ui/CardStripe.tsx`:

```tsx
/**
 * CardStripe — 카드 좌측 3px 엣지 스트라이프 wrapper
 *
 * 룰 근거: DESIGN.md B 카드 언어 · impeccable-design.md §14 (border-l-4 대체)
 * tone이 "상태"를 암시한다. 골드=일반/대기, 블루=지원완료/확정, 그레이=마감/캐시/완료,
 * 워닝=취소 요청, 에러=신고.
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';

export type CardStripeTone = 'gold' | 'info' | 'muted' | 'warning' | 'error';

const TONE_BAR: Record<CardStripeTone, string> = {
  gold: 'bg-primary-500 dark:bg-primary-400',
  info: 'bg-info-500 dark:bg-info-500',
  muted: 'bg-secondary-400 dark:bg-secondary-600',
  warning: 'bg-warning-500 dark:bg-warning-500',
  error: 'bg-error-500 dark:bg-error-500',
};

export interface CardStripeProps extends ViewProps {
  tone: CardStripeTone;
  /** bar 두께 (기본 3px) */
  thickness?: number;
  children: React.ReactNode;
  testID?: string;
}

export function CardStripe({
  tone,
  thickness = 3,
  children,
  testID,
  style,
  ...rest
}: CardStripeProps) {
  return (
    <View
      style={[{ position: 'relative' }, style]}
      testID={testID}
      {...rest}
    >
      <View
        className={`${TONE_BAR[tone]} rounded-sm`}
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: thickness,
        }}
        testID={testID ? `${testID}-bar` : undefined}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {children}
    </View>
  );
}

export default CardStripe;
```

- [ ] **Step 4: 배럴 export 추가**

`uniqn-mobile/src/components/ui/index.ts`의 export 섹션에 한 줄 추가:

```tsx
export { CardStripe, type CardStripeTone } from './CardStripe';
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern CardStripe`
Expected: 2 tests PASS.

- [ ] **Step 6: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/ui/CardStripe.tsx \
        uniqn-mobile/src/components/ui/__tests__/CardStripe.test.tsx \
        uniqn-mobile/src/components/ui/index.ts
git commit -m "feat(ui): CardStripe 프리미티브 (3px 엣지 스트라이프, 5 톤)"
```

---

### Task 0.4: `PressableCard` 프리미티브 신설

**Files:**
- Create: `uniqn-mobile/src/components/ui/PressableCard.tsx`
- Create: `uniqn-mobile/src/components/ui/__tests__/PressableCard.test.tsx`
- Modify: `uniqn-mobile/src/components/ui/index.ts`

- [ ] **Step 1: 실패 테스트 작성**

`uniqn-mobile/src/components/ui/__tests__/PressableCard.test.tsx`:

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { PressableCard } from '@/components/ui/PressableCard';

describe('PressableCard', () => {
  it('onPress 호출된다', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <PressableCard onPress={onPress} testID="pc">
        <Text>x</Text>
      </PressableCard>
    );
    fireEvent.press(getByTestId('pc'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('accessibilityLabel을 전달한다', () => {
    const { getByLabelText } = render(
      <PressableCard onPress={() => {}} accessibilityLabel="카드 탭">
        <Text>x</Text>
      </PressableCard>
    );
    expect(getByLabelText('카드 탭')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern PressableCard`
Expected: FAIL — 파일 없음.

- [ ] **Step 3: PressableCard 구현 — Pressed 역방향 + Focus ring outset**

`uniqn-mobile/src/components/ui/PressableCard.tsx`:

```tsx
/**
 * PressableCard — Pressed 역방향 + Focus ring(Info 블루 2px outset) 공용 Pressable
 *
 * 룰 근거:
 * - impeccable-design.md §21 Pressed 피드백 다크/라이트 반대 방향
 * - impeccable-design.md §22 Focus ring Info 블루 2px outset (layout shift 방지)
 */

import React from 'react';
import { Pressable, Platform, type PressableProps } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export interface PressableCardProps extends PressableProps {
  children: React.ReactNode;
  className?: string;
  testID?: string;
}

export function PressableCard({
  children,
  className = '',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
  ...rest
}: PressableCardProps) {
  const isDark = useThemeStore((s) => s.isDarkMode);

  const baseClasses =
    'rounded-md m-[-2px] border-2 border-transparent bg-surface-card dark:bg-surface-elevated';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      android_ripple={
        Platform.OS === 'android'
          ? { color: isDark ? '#333333' : '#E5E5E5', borderless: false }
          : undefined
      }
      className={({ pressed, focused }) =>
        [
          baseClasses,
          pressed && 'bg-surface-hover dark:bg-surface-hover',
          focused && 'border-info-500',
          className,
        ]
          .filter(Boolean)
          .join(' ')
      }
      {...rest}
    >
      {children}
    </Pressable>
  );
}

export default PressableCard;
```

- [ ] **Step 4: 배럴 export**

`uniqn-mobile/src/components/ui/index.ts`에 추가:

```tsx
export { PressableCard, type PressableCardProps } from './PressableCard';
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern PressableCard`
Expected: 2 tests PASS.

- [ ] **Step 6: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/ui/PressableCard.tsx \
        uniqn-mobile/src/components/ui/__tests__/PressableCard.test.tsx \
        uniqn-mobile/src/components/ui/index.ts
git commit -m "feat(ui): PressableCard 프리미티브 (Pressed 역방향 + Focus ring outset)"
```

---

### Task 0.5: `ScreenSkeleton` composer 신설

**Files:**
- Create: `uniqn-mobile/src/components/ui/ScreenSkeleton.tsx`
- Modify: `uniqn-mobile/src/components/ui/index.ts`

- [ ] **Step 1: 기존 Skeleton 구조 확인**

Run: `head -50 uniqn-mobile/src/components/ui/Skeleton.tsx`

기존 Skeleton이 `Skeleton`, `SkeletonText`, `SkeletonCircle` 세 프리미티브를 export 한다. ScreenSkeleton은 이들을 조합한 **화면 타입별 프리셋**.

- [ ] **Step 2: ScreenSkeleton 구현**

`uniqn-mobile/src/components/ui/ScreenSkeleton.tsx`:

```tsx
/**
 * ScreenSkeleton — 화면 타입별 Skeleton 프리셋
 *
 * 룰 근거: impeccable-design.md §16 Skeleton > Spinner
 *
 * 사용: 리스트·상세·카드 그리드 화면의 초기 로딩 상태.
 * 스피너는 2초 이내 예상 액션(버튼 submit)에만.
 */

import React from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonText, SkeletonCircle } from './Skeleton';

export type ScreenSkeletonType = 'jobsList' | 'applicantList' | 'scheduleList' | 'settlementList' | 'notificationList';

interface ScreenSkeletonProps {
  type: ScreenSkeletonType;
  count?: number;
}

export function ScreenSkeleton({ type, count = 5 }: ScreenSkeletonProps) {
  return (
    <View
      className="flex-1"
      accessibilityRole="progressbar"
      accessibilityLabel="로딩 중"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} type={type} />
      ))}
    </View>
  );
}

function SkeletonRow({ type }: { type: ScreenSkeletonType }) {
  if (type === 'jobsList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row gap-2 mb-2">
          <Skeleton width={40} height={16} borderRadius={3} />
          <Skeleton width={30} height={16} borderRadius={3} />
        </View>
        <SkeletonText width="70%" fontSize={15} />
        <View className="mt-1">
          <SkeletonText width="50%" fontSize={11} />
        </View>
        <View className="mt-3 flex-row gap-3">
          <View className="flex-1">
            <SkeletonText width="80%" fontSize={12} />
            <View className="mt-1">
              <Skeleton width={60} height={16} borderRadius={3} />
            </View>
          </View>
          <View className="flex-1 items-end">
            <SkeletonText width="60%" fontSize={15} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'applicantList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row items-center justify-between mb-2">
          <SkeletonText width="40%" fontSize={13} />
          <Skeleton width={40} height={18} borderRadius={3} />
        </View>
        <SkeletonText width="60%" fontSize={11} />
        <View className="mt-2">
          <Skeleton width="100%" height={26} borderRadius={4} />
        </View>
      </View>
    );
  }

  if (type === 'scheduleList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row gap-3">
          <Skeleton width={50} height={60} borderRadius={6} />
          <View className="flex-1 gap-2">
            <SkeletonText width="70%" fontSize={14} />
            <SkeletonText width="50%" fontSize={11} />
            <SkeletonText width="30%" fontSize={12} />
          </View>
        </View>
      </View>
    );
  }

  if (type === 'settlementList') {
    return (
      <View className="mx-3 mb-2 rounded-md bg-surface-card p-3 dark:bg-surface-elevated">
        <View className="flex-row items-center justify-between mb-2">
          <SkeletonText width="50%" fontSize={12} />
          <SkeletonText width="30%" fontSize={16} />
        </View>
        <SkeletonText width="40%" fontSize={10} />
      </View>
    );
  }

  // notificationList
  return (
    <View className="flex-row gap-2 px-3 py-2 border-b border-border dark:border-surface-overlay">
      <SkeletonCircle size={6} />
      <View className="flex-1 gap-1">
        <SkeletonText width="70%" fontSize={12} />
        <SkeletonText width="90%" fontSize={11} />
        <SkeletonText width="20%" fontSize={9} />
      </View>
    </View>
  );
}

export default ScreenSkeleton;
```

- [ ] **Step 3: 배럴 export**

`uniqn-mobile/src/components/ui/index.ts`에 추가:

```tsx
export { ScreenSkeleton, type ScreenSkeletonType } from './ScreenSkeleton';
```

- [ ] **Step 4: 타입 체크**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/ui/ScreenSkeleton.tsx uniqn-mobile/src/components/ui/index.ts
git commit -m "feat(ui): ScreenSkeleton composer (5개 화면 타입 프리셋)"
```

---

## Phase 1 — Layout Wiring

### Task 1.1: `OfflineBanner` 4개 stack layout에 단일 마운트

**Files:**
- Modify: `uniqn-mobile/app/(app)/_layout.tsx`
- Modify: `uniqn-mobile/app/(employer)/_layout.tsx`
- Modify: `uniqn-mobile/app/(admin)/_layout.tsx`
- Modify: `uniqn-mobile/app/(auth)/_layout.tsx`

- [ ] **Step 1: 현재 (app)/_layout.tsx 구조 확인**

Run: `cat uniqn-mobile/app/\(app\)/_layout.tsx | head -40`

- [ ] **Step 2: `(app)/_layout.tsx`에 OfflineBanner 주입**

`Stack` 직전에 `<OfflineBanner />` 추가:

```tsx
import { OfflineBanner } from '@/components/ui';
// ...
return (
  <>
    <OfflineBanner variant="banner" />
    <Stack screenOptions={...}>
      {/* ...existing screens... */}
    </Stack>
  </>
);
```

**주의**: `OfflineBanner`는 상대적으로 배치됨 — SafeAreaView 내부·Stack 직전에 들어가야 status bar 영역을 침범하지 않음. 기존 레이아웃이 이미 SafeAreaView로 감싸여 있으면 그 안에. 없으면 banner 자체의 top inset이 처리.

- [ ] **Step 3: `(employer)/_layout.tsx`에 동일 주입**

동일 패턴 적용.

- [ ] **Step 4: `(admin)/_layout.tsx`에 동일 주입**

동일 패턴 적용.

- [ ] **Step 5: `(auth)/_layout.tsx`에 동일 주입**

인증 스택은 오프라인 상태에서도 시도 가능하게 유지 — `<OfflineBanner />` 동일 주입.

- [ ] **Step 6: 타입 체크 + 테스트 통과**

Run: `cd uniqn-mobile && npx tsc --noEmit && npm test`
Expected: 0 errors.

- [ ] **Step 7: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/app/\(app\)/_layout.tsx \
        uniqn-mobile/app/\(employer\)/_layout.tsx \
        uniqn-mobile/app/\(admin\)/_layout.tsx \
        uniqn-mobile/app/\(auth\)/_layout.tsx
git commit -m "refactor(layouts): OfflineBanner 4개 stack에 단일 마운트"
```

---

### Task 1.2: `statusBarStyle` 배경 대비 자동 분기

**Files:**
- Modify: `uniqn-mobile/app/(app)/_layout.tsx`
- Modify: `uniqn-mobile/app/(employer)/_layout.tsx`
- Modify: `uniqn-mobile/app/(admin)/_layout.tsx`
- Modify: `uniqn-mobile/app/(auth)/_layout.tsx`
- Modify: `uniqn-mobile/app/(public)/_layout.tsx` (존재하면)

- [ ] **Step 1: Stack screenOptions에 statusBarStyle 추가**

각 스택의 `<Stack screenOptions={{ ... }}>` 에 다음을 추가 (이미 있으면 값 확인·유지):

```tsx
<Stack
  screenOptions={{
    statusBarStyle: 'auto', // expo-router가 useColorScheme 자동 감지
    statusBarBackgroundColor: 'transparent',
    // ...기존 props 유지...
  }}
>
```

**이유**: `statusBarStyle: 'auto'`는 현재 `useColorScheme()` 결과에 따라 light↔dark content 자동 전환. 단, 화면 배경이 테마와 반대일 경우(예: 인증 스택이 light 배경인데 시스템은 dark 모드) 화면별 오버라이드 필요:

```tsx
<Stack.Screen
  name="auth/login"
  options={{ statusBarStyle: 'dark' }}  // 밝은 배경 → 다크 content
/>
```

- [ ] **Step 2: `(auth)` 스택 화면별 수동 설정**

`(auth)/_layout.tsx`의 각 `<Stack.Screen>`에 배경 색에 맞춰 statusBarStyle 명시. 라이트 배경이면 `dark`, 다크 배경이면 `light`.

- [ ] **Step 3: 수동 QA**

iOS 시뮬레이터로 각 스택 진입 시 StatusBar 아이콘이 배경과 대비 있게 보이는지 확인.

- [ ] **Step 4: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/app/\(app\)/_layout.tsx \
        uniqn-mobile/app/\(employer\)/_layout.tsx \
        uniqn-mobile/app/\(admin\)/_layout.tsx \
        uniqn-mobile/app/\(auth\)/_layout.tsx
git commit -m "refactor(layouts): statusBarStyle 테마·배경 대비 자동 분기"
```

---

### Task 1.3: `HomeTabBar` 활성 underbar (2px 골드)

**Files:**
- Modify: `uniqn-mobile/src/components/home/HomeTabBar.tsx`

- [ ] **Step 1: 현재 TABS 렌더 구조 확인**

`HomeTabBar.tsx:32-69` 검토 — 현재 단순 flex row. underbar는 `Pressable` 내부 상단에 2px View로 추가.

- [ ] **Step 2: 활성 state 개념 추가 — 현재는 "모두 비활성"이라 표시 목적만. 활성 인디케이터 스타일만 준비**

`HomeTabBar.tsx`는 홈 화면 전용 표시 탭바이며 "모두 비활성"이 원칙. **이 task에서는 `HomeTabBar`는 건드리지 않음** — 실제 활성 인디케이터는 `app/(app)/(tabs)/_layout.tsx`의 `<Tabs>` 프롭에서 구성.

건너뛰고 Task 1.4로.

- [ ] **Step 3: 태스크 스킵 커밋 없음**

변경 없으므로 커밋 없음. Task 1.4 진행.

---

### Task 1.4: `(app)/(tabs)/_layout.tsx` 활성 underbar + 골드 active color

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/_layout.tsx`

- [ ] **Step 1: 현재 Tabs 구조 확인**

Run: `cat uniqn-mobile/app/\(app\)/\(tabs\)/_layout.tsx`

- [ ] **Step 2: `tabBarActiveTintColor` 골드로, `tabBarIndicatorStyle` 또는 `tabBarItemStyle` 커스터마이즈**

expo-router `<Tabs>` 는 기본적으로 bottom tab navigator 래핑. `screenOptions`에 다음 추가:

```tsx
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { PRIMARY_PALETTE } from '@/constants/colors';

<Tabs
  screenOptions={({ }) => ({
    tabBarActiveTintColor: PRIMARY_PALETTE[500], // #D4AF37 (gold)
    tabBarInactiveTintColor: '#9898A0',
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    tabBarStyle: { borderTopColor: '#19191D' },
    // 활성 탭 상단 2px 골드 underbar: tabBarItemStyle의 position-based 래핑으로 추가
  })}
>
  {/* ...screens... */}
</Tabs>
```

- [ ] **Step 3: 활성 underbar를 `tabBarIcon`에 inline 그리기**

React Navigation의 Tabs는 native underbar 지원이 미흡 → 각 `<Tabs.Screen>`에서 `tabBarIcon` 커스터마이즈로 focused 때 상단 2px View 추가:

```tsx
<Tabs.Screen
  name="index"
  options={{
    title: '구인구직',
    tabBarIcon: ({ color, focused }) => (
      <View style={{ alignItems: 'center', marginTop: focused ? 0 : 2 }}>
        {focused && (
          <View style={{ width: 22, height: 2, backgroundColor: PRIMARY_PALETTE[500], borderRadius: 1, marginBottom: 2 }} />
        )}
        <HomeIcon color={color} size={22} />
      </View>
    ),
  }}
/>
```

5개 탭(`index`, `schedule`, `board`, `employer`, `profile`) 모두 동일 패턴 적용.

- [ ] **Step 4: 타입 체크 + iOS 시뮬레이터 확인**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: 0 errors.

수동: 시뮬레이터에서 탭 전환 시 활성 탭 상단에 2px 골드 underbar 표시 확인.

- [ ] **Step 5: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/app/\(app\)/\(tabs\)/_layout.tsx
git commit -m "refactor(tabs): 활성 탭 상단 2px 골드 underbar 추가"
```

---

## Phase 2 — Home V2 (유일한 레이아웃 변경)

### Task 2.1: `DashboardWidgetShell` — `hero` variant 추가

**Files:**
- Modify: `uniqn-mobile/src/components/home/DashboardWidgetShell.tsx`

- [ ] **Step 1: 현재 DashboardWidgetShell 구조 파악**

Run: `cat uniqn-mobile/src/components/home/DashboardWidgetShell.tsx`

- [ ] **Step 2: `variant?: 'card' | 'hero' | 'section'` prop 추가**

기존 props에 `variant?: 'card' | 'hero' | 'section'` 추가. 기본값 `'card'`.

```tsx
interface DashboardWidgetShellProps {
  // ...기존...
  variant?: 'card' | 'hero' | 'section';
}
```

- [ ] **Step 3: variant별 렌더 분기**

- `'card'` (기본) — 기존 동작 100% 유지
- `'hero'` — `bg-gradient-to-b from-[#1A1710] to-[#09090B]` 배경, 패딩 `px-3 py-4`, 상단 uppercase 라벨
- `'section'` — 배경 투명, 상단 섹션 헤더(uppercase 라벨 + 하단 1px 디바이더 `border-b border-border`), 카드 테두리 없음

```tsx
if (variant === 'hero') {
  return (
    <View className="bg-surface px-4 py-4 border-b border-border-subtle"
          style={{ backgroundColor: 'transparent' }}>
      {/* gradient 대신 RN linear-gradient 라이브러리가 없다면 배경색 단계로 표현 */}
      <Text className="text-[10px] uppercase tracking-wider text-primary-500 font-sans-bold mb-2">
        {title}
      </Text>
      {children}
    </View>
  );
}
if (variant === 'section') {
  return (
    <View className="px-4 py-3">
      <View className="flex-row items-center justify-between pb-2 border-b border-border-subtle dark:border-border-subtle mb-2">
        <Text className="text-[10px] uppercase tracking-wider text-content-secondary font-sans-bold">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}
// 'card' — 기존 렌더
```

- [ ] **Step 4: `action` prop 추가 (섹션 헤더 우측 액션)**

```tsx
action?: React.ReactNode;
```

- [ ] **Step 5: 기존 테스트 통과 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern DashboardWidgetShell`
Expected: 기존 테스트 PASS (card variant 기본 동작 유지).

- [ ] **Step 6: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/home/DashboardWidgetShell.tsx
git commit -m "feat(home): DashboardWidgetShell hero·section variant 추가"
```

---

### Task 2.2: `NextWorkWidget` — hero 렌더로 변경

**Files:**
- Modify: `uniqn-mobile/src/components/home/widgets/NextWorkWidget.tsx`

- [ ] **Step 1: 현재 NextWorkWidget 구조 파악 (hero 승격 전)**

현재: DashboardWidgetShell `card` variant로 렌더, ScheduleCard 내부 구성.

- [ ] **Step 2: `variant="hero"` 로 래핑 + ScheduleCard를 hero 버전으로 치환**

```tsx
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useUpcomingSchedules } from '@/hooks/useSchedules';

function HeroScheduleCard({ schedule }: { schedule: ScheduleEvent }) {
  const diffDays = computeDayDiff(schedule.date);
  const badge = formatBadge(diffDays);
  return (
    <Pressable
      onPress={() => router.push('/(app)/(tabs)/schedule')}
      accessibilityRole="button"
      accessibilityLabel={`다음 근무 ${badge}, ${schedule.location}, 탭하면 스케줄 이동`}
    >
      <View className="flex-row items-center gap-2 mb-1">
        <View className="bg-primary-500 rounded px-2 py-0.5">
          <Text className="text-on-gold text-xs font-sans-bold" style={{ fontVariant: ['tabular-nums'] }}>
            {badge}
          </Text>
        </View>
        <Text className="text-content-primary text-lg font-sans-bold" style={{ letterSpacing: -0.5 }}>
          {schedule.location}
        </Text>
      </View>
      <Text className="text-content-secondary text-xs mt-1" style={{ fontVariant: ['tabular-nums'] }}>
        {formatDate(schedule.date)} · {/* 시간 포맷 */} · {formatRole(schedule.role)}
      </Text>
    </Pressable>
  );
}

export function NextWorkWidget() {
  const { schedules, isLoading } = useUpcomingSchedules(14);
  const next = schedules.filter((s) => s.type === 'confirmed')[0] ?? null;

  return (
    <DashboardWidgetShell
      variant="hero"
      title="다음 근무"
      isLoading={isLoading}
      emptyState={next ? undefined : {
        message: '예정된 근무가 없어요. 공고를 둘러볼까요?',
        cta: { label: '공고 보기', onPress: () => router.push('/(app)/(tabs)') },
      }}
    >
      {next ? <HeroScheduleCard schedule={next} /> : null}
    </DashboardWidgetShell>
  );
}
```

- [ ] **Step 3: 기존 테스트 실행**

Run: `cd uniqn-mobile && npm test -- --testPathPattern NextWorkWidget`
Expected: 테스트 구조에 따라 PASS 또는 expect 변경 필요.

스냅샷이 있으면 `-u`로 갱신.

- [ ] **Step 4: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/home/widgets/NextWorkWidget.tsx
git commit -m "feat(home): NextWorkWidget hero 렌더 (gradient 배경 + 28px 제목)"
```

---

### Task 2.3: `ApplicationStatusWidget` — 4열 strip

**Files:**
- Modify: `uniqn-mobile/src/components/home/widgets/ApplicationStatusWidget.tsx`

- [ ] **Step 1: 현재 구조 파악**

Run: `cat uniqn-mobile/src/components/home/widgets/ApplicationStatusWidget.tsx`

- [ ] **Step 2: `variant="section"` 로 래핑 + 4열 strip 렌더**

```tsx
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { View, Text, Pressable } from 'react-native';

function StripCell({ num, label, gold }: { num: number; label: string; gold?: boolean }) {
  return (
    <View className="flex-1 items-center py-2 border-r border-border-subtle dark:border-surface-overlay">
      <Text
        className={`text-2xl font-sans-bold ${gold ? 'text-primary-500' : 'text-content-primary'}`}
        style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}
      >
        {num}
      </Text>
      <Text className="text-[9px] uppercase tracking-wider text-content-muted mt-0.5">
        {label}
      </Text>
    </View>
  );
}

export function ApplicationStatusWidget() {
  // 기존 hook
  const { counts, isLoading } = useApplicationCounts();
  return (
    <DashboardWidgetShell
      variant="section"
      title="지원 현황"
      isLoading={isLoading}
      action={
        <Pressable onPress={() => router.push('/(app)/applications')}>
          <Text className="text-primary-500 text-[10px] font-sans-bold">전체 →</Text>
        </Pressable>
      }
    >
      <View className="flex-row">
        <StripCell num={counts.applied ?? 0} label="지원" gold />
        <StripCell num={counts.confirmed ?? 0} label="확정" />
        <StripCell num={counts.completed ?? 0} label="완료" />
        <StripCell num={counts.cancelled ?? 0} label="취소" />
      </View>
    </DashboardWidgetShell>
  );
}
```

**주의**: 마지막 cell의 `border-r` 제거 — `className="flex-1 items-center py-2"` 만. `StripCell`에 `isLast` prop 추가하거나 render 시 인덱스 기반 처리.

- [ ] **Step 3: 기존 테스트 통과**

Run: `cd uniqn-mobile && npm test -- --testPathPattern ApplicationStatusWidget`

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/home/widgets/ApplicationStatusWidget.tsx
git commit -m "feat(home): ApplicationStatusWidget 4열 strip (세로 divider + tabular-nums)"
```

---

### Task 2.4: `MonthSummaryWidget` — 좌 대형 금액 + 우 부가

**Files:**
- Modify: `uniqn-mobile/src/components/home/widgets/MonthSummaryWidget.tsx`

- [ ] **Step 1: 현재 구조 파악**

- [ ] **Step 2: section variant + 금액 28px/900 레이아웃**

```tsx
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { View, Text, Pressable } from 'react-native';
import { formatCurrency } from '@/utils/formatters';

export function MonthSummaryWidget() {
  const { totalAmount, workCount, totalHours, isLoading } = useMonthSummary();
  return (
    <DashboardWidgetShell
      variant="section"
      title="이번달 정산"
      isLoading={isLoading}
      action={
        <Pressable onPress={() => router.push('/(app)/(tabs)/schedule')}>
          <Text className="text-primary-500 text-[10px] font-sans-bold">상세 →</Text>
        </Pressable>
      }
    >
      <View className="flex-row justify-between items-end">
        <View>
          <Text
            className="text-3xl font-sans-bold text-primary-500"
            style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.6 }}
          >
            {formatCurrency(totalAmount)}
          </Text>
          <Text className="text-[10px] uppercase tracking-wider text-content-muted mt-1">
            예상 수령액
          </Text>
        </View>
        <View className="items-end">
          <Text
            className="text-base font-sans-bold text-content-primary"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {workCount}건
          </Text>
          <Text className="text-xs text-content-secondary" style={{ fontVariant: ['tabular-nums'] }}>
            {totalHours}시간
          </Text>
        </View>
      </View>
    </DashboardWidgetShell>
  );
}
```

- [ ] **Step 3: 기존 테스트**

Run: `cd uniqn-mobile && npm test -- --testPathPattern MonthSummaryWidget`

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/home/widgets/MonthSummaryWidget.tsx
git commit -m "feat(home): MonthSummaryWidget 좌 대형 금액 + 우 부가 레이아웃"
```

---

### Task 2.5: `RecentNoticesWidget` — 도트 리스트

**Files:**
- Modify: `uniqn-mobile/src/components/home/widgets/RecentNoticesWidget.tsx`

- [ ] **Step 1: 현재 구조 파악**

- [ ] **Step 2: section variant + 도트 리스트**

```tsx
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';

function NoticeRow({ notice }: { notice: Notice }) {
  return (
    <Pressable
      onPress={() => router.push(`/(app)/notices/${notice.id}`)}
      className="flex-row items-start py-2 border-b border-border-subtle dark:border-surface-overlay"
    >
      <View
        className={`w-1.5 h-1.5 rounded-sm mt-1.5 mr-2 ${
          notice.unread ? 'bg-primary-500' : 'bg-surface-overlay'
        }`}
      />
      <View className="flex-1">
        <Text className="text-content-primary text-xs font-sans-semibold">
          {notice.title}
        </Text>
        <Text className="text-content-muted text-[10px] mt-0.5">
          {notice.source}
        </Text>
      </View>
      <Text
        className="text-content-muted text-[10px] ml-2"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {notice.relativeTime}
      </Text>
    </Pressable>
  );
}

export function RecentNoticesWidget() {
  const { notices, isLoading } = useRecentNotices();
  return (
    <DashboardWidgetShell
      variant="section"
      title="최근 공지"
      isLoading={isLoading}
      action={
        <Pressable onPress={() => router.push('/(app)/(tabs)/board')}>
          <Text className="text-primary-500 text-[10px] font-sans-bold">게시판 →</Text>
        </Pressable>
      }
    >
      {notices.slice(0, 3).map((n) => <NoticeRow key={n.id} notice={n} />)}
    </DashboardWidgetShell>
  );
}
```

**주의**: 마지막 `NoticeRow`는 `border-b` 제거 — 인덱스 기반으로 조건부.

- [ ] **Step 3: 기존 테스트**

Run: `cd uniqn-mobile && npm test -- --testPathPattern RecentNoticesWidget`

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/home/widgets/RecentNoticesWidget.tsx
git commit -m "feat(home): RecentNoticesWidget 도트 리스트 + tabular-nums 시간"
```

---

### Task 2.6: `StaffDashboard` / `EmployerDashboard` — ScrollView padding 조정

**Files:**
- Modify: `uniqn-mobile/src/components/home/StaffDashboard.tsx`
- Modify: `uniqn-mobile/src/components/home/EmployerDashboard.tsx`

- [ ] **Step 1: `StaffDashboard.tsx` gap 제거**

현재 `gap: 12` + `padding: 16`. V2에서 `variant="hero"`는 자체 패딩, `variant="section"`은 좌우 padding만 쓰므로 컨테이너 gap 0으로 변경:

```tsx
<ScrollView contentContainerStyle={{ paddingBottom: 16 + bottomPadding }}>
  <NextWorkWidget />            {/* variant="hero" — full bleed */}
  <ApplicationStatusWidget />   {/* variant="section" */}
  <MonthSummaryWidget />        {/* variant="section" */}
  <RecentNoticesWidget />       {/* variant="section" */}
</ScrollView>
```

- [ ] **Step 2: `EmployerDashboard.tsx` 동일 패턴**

EmployerDashboard는 내용 다르지만(`PostingOverviewWidget`, `WeeklyStaffWidget`, `CancellationWidget`) 동일하게 variant 기반. **이 task에서는 시각적 일관성 위해 같은 방식으로 재편**:

- `PostingOverviewWidget` → variant="hero" (가장 중요한 오늘의 현황)
- 나머지는 variant="section"

각 위젯 내부에서 variant prop 전달 방식으로 재작성 (Task 2.2~2.5 패턴 그대로 적용 — Employer 위젯도 섹션 변형).

- [ ] **Step 3: 기존 테스트**

Run: `cd uniqn-mobile && npm test -- --testPathPattern '(Staff|Employer)Dashboard'`

- [ ] **Step 4: 시각 확인**

iOS 시뮬레이터로 홈 진입 → Hero + 섹션 3개 렌더 확인.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/home/StaffDashboard.tsx \
        uniqn-mobile/src/components/home/EmployerDashboard.tsx \
        uniqn-mobile/src/components/home/widgets/PostingOverviewWidget.tsx \
        uniqn-mobile/src/components/home/widgets/WeeklyStaffWidget.tsx \
        uniqn-mobile/src/components/home/widgets/CancellationWidget.tsx
git commit -m "feat(home): V2 대시보드 컨테이너 (hero + 섹션 헤더 기반)"
```

---

## Phase 3 — Tier A 컴포넌트 Restyle

### Task 3.1: `JobCard` — B 언어 적용

**Files:**
- Modify: `uniqn-mobile/src/components/jobs/JobCard.tsx`
- Modify: `uniqn-mobile/src/components/jobs/shared/PostingCardSurface.tsx`

- [ ] **Step 1: `PostingCardSurface.tsx` — 테두리 제거 + CardStripe 래핑**

`PostingCardSurface.tsx`에서 외부 View className 변경:

**Before (line 46):**
```tsx
<View className={containerClassName}>
```

**After:**
```tsx
import { CardStripe } from '@/components/ui';
// 외부 래퍼를 CardStripe로 감쌈. tone은 props로 받음.

<CardStripe tone={stripeTone ?? 'gold'} style={{ marginBottom: 8 }}>
  <View className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4">
    <Pressable ...>{/* 기존 */}</Pressable>
  </View>
</CardStripe>
```

새 prop 추가:

```tsx
interface PostingCardSurfaceProps {
  // ...기존...
  stripeTone?: 'gold' | 'info' | 'muted' | 'warning' | 'error';
}
```

- [ ] **Step 2: `JobCard.tsx` — Chip 변형 전환 + stripeTone 전달**

```tsx
import { Badge } from '@/components/ui';

// PostingTypeBadge 사용부 변경 — 이제 Badge variant="chip"
// SCHEDULE_STATUS[applicationStatus].variant 매핑도 chip 대응
```

`JobCard.tsx` 내부 `topStatus`를 다음처럼 교체:

```tsx
topStatus={
  applicationStatus ? (
    <Badge variant="chip" dot>
      {SCHEDULE_STATUS[applicationStatus].label}
    </Badge>
  ) : undefined
}
```

stripeTone 매핑:

```tsx
const stripeTone: CardStripeTone =
  applicationStatus === 'applied' || applicationStatus === 'confirmed'
    ? 'info'
    : applicationStatus === 'cancelled' || applicationStatus === 'completed'
      ? 'muted'
      : 'gold';
```

- [ ] **Step 3: 타이틀 className 조정**

`PostingCardSurface.tsx:66-72` 타이틀 Text:

**Before:**
```tsx
className="flex-1 text-base font-sans-semibold text-content-primary dark:text-off-white"
```

**After:**
```tsx
className="flex-1 text-base font-sans-bold text-content-primary dark:text-off-white"
style={{ letterSpacing: -0.32 }} // -0.02em of 16px
```

- [ ] **Step 4: 임금 Text에 tabular-nums**

`PostingCompensationContent.tsx`에서 임금 Text에:

```tsx
style={{ fontVariant: ['tabular-nums'] }}
```

(Task 6.11에서 일괄적용되지만 Tier A 카드는 선행)

- [ ] **Step 5: 기존 JobCard 테스트 실행 + 스냅샷 확인**

Run: `cd uniqn-mobile && npm test -- --testPathPattern JobCard`
Expected: 로직 테스트 PASS, 스냅샷은 `-u`로 갱신 (Task 7.2에서 일괄).

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/components/jobs/JobCard.tsx \
        uniqn-mobile/src/components/jobs/shared/PostingCardSurface.tsx \
        uniqn-mobile/src/components/jobs/shared/PostingCompensationContent.tsx
git commit -m "refactor(tier-a): JobCard B 언어 (스트라이프·chip·weight 800 title)"
```

---

### Task 3.2: `JobDetail` — Hero + 섹션 + 골드 CTA

**Files:**
- Modify: `uniqn-mobile/src/components/jobs/JobDetail.tsx`

- [ ] **Step 1: 현재 JobDetail 구조 파악**

Run: `head -80 uniqn-mobile/src/components/jobs/JobDetail.tsx`

- [ ] **Step 2: Hero 영역(상단) — 그라디언트 배경 + 타이틀 + chip 칩**

상단 영역 (타이틀·위치) 를 Hero 블록으로 변환:

```tsx
<View className="bg-surface-elevated dark:bg-surface-elevated px-4 py-4 border-b border-border-subtle">
  <View className="flex-row gap-1 mb-2">
    {postingType !== 'regular' && <Badge variant="chip">{typeLabel(postingType)}</Badge>}
    {isUrgent && <Badge variant="chip">긴급</Badge>}
  </View>
  <Text
    className="text-content-primary text-lg font-sans-bold"
    style={{ letterSpacing: -0.5, lineHeight: 24 }}
  >
    {title}
  </Text>
  <Text className="text-primary-500 text-xs mt-1 font-sans-semibold">
    ◦ {location}
  </Text>
</View>
```

- [ ] **Step 3: 섹션 — 각 영역에 uppercase 라벨 적용**

`JobDetail`의 각 블록(근무 일정, 급여, 구인처)을 다음 섹션 패턴으로:

```tsx
<View className="px-4 py-3 border-b border-border-subtle">
  <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
    근무 일정
  </Text>
  {/* 기존 내용 */}
</View>
```

- [ ] **Step 4: CTA 버튼 골드 배경**

하단 "지원하기" 버튼을 `bg-primary-500` 배경, `text-on-gold` (= `#09090B`) 로 변경.

```tsx
<Pressable
  onPress={handleApply}
  className="bg-primary-500 rounded-md py-3 mx-4"
  accessibilityRole="button"
  accessibilityLabel="공고에 지원하기"
>
  <Text className="text-on-gold text-center font-sans-bold">지원하기 →</Text>
</Pressable>
```

- [ ] **Step 5: 기존 테스트 실행**

Run: `cd uniqn-mobile && npm test -- --testPathPattern JobDetail`

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/src/components/jobs/JobDetail.tsx
git commit -m "refactor(tier-a): JobDetail Hero + 섹션 헤더 + 골드 CTA"
```

---

### Task 3.3: `ScheduleCard` — 상태별 stripe

**Files:**
- Modify: `uniqn-mobile/src/components/schedule/ScheduleCard.tsx`
- Modify: `uniqn-mobile/src/components/schedule/GroupedScheduleCard.tsx`

- [ ] **Step 1: 상태 → tone 매핑 헬퍼 추가**

`uniqn-mobile/src/components/schedule/helpers/statusConfig.ts` 에 다음 map 추가:

```tsx
export const SCHEDULE_STATUS_STRIPE_TONE: Record<ScheduleStatus, CardStripeTone> = {
  applied: 'gold',
  confirmed: 'info',
  completed: 'muted',
  cancelled: 'warning',
};
```

- [ ] **Step 2: `ScheduleCard.tsx` — CardStripe 래핑 + Badge chip 변형**

외부 컨테이너를 `<CardStripe tone={...}>` 으로. 기존 Badge를 `variant="chip"` 로.

```tsx
import { CardStripe, Badge } from '@/components/ui';
import { SCHEDULE_STATUS_STRIPE_TONE } from './helpers/statusConfig';

<CardStripe tone={SCHEDULE_STATUS_STRIPE_TONE[schedule.status]}>
  <View className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3">
    {/* 기존 내용 */}
  </View>
</CardStripe>
```

- [ ] **Step 3: `GroupedScheduleCard.tsx` 동일 패턴**

- [ ] **Step 4: 테스트 실행**

Run: `cd uniqn-mobile && npm test -- --testPathPattern Schedule`

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/schedule/ScheduleCard.tsx \
        uniqn-mobile/src/components/schedule/GroupedScheduleCard.tsx \
        uniqn-mobile/src/components/schedule/helpers/statusConfig.ts
git commit -m "refactor(tier-a): ScheduleCard 상태별 stripe + chip 변형"
```

---

### Task 3.4: `ApplicantCard` — Chip + stripe + 햅틱

**Files:**
- Modify: `uniqn-mobile/src/components/employer/applicants/ApplicantCard/ApplicantCard.tsx`
- Modify: `uniqn-mobile/src/components/employer/applicants/ApplicantCard/components/CardHeader.tsx`
- Modify: `uniqn-mobile/src/components/employer/applicants/ApplicantCard/components/ConfirmedActions.tsx`

- [ ] **Step 1: CardHeader — Badge chip 변형**

`CardHeader.tsx`에서 기존 상태 Badge를 `variant="chip"` 로 교체.

- [ ] **Step 2: 컨테이너 CardStripe 래핑 — 상태 매핑**

```tsx
import { CardStripe, CardStripeTone } from '@/components/ui';

const TONE: Record<ApplicantStatus, CardStripeTone> = {
  pending: 'gold',
  confirmed: 'info',
  completed: 'muted',
  cancelled: 'warning',
  rejected: 'muted',
};

<CardStripe tone={TONE[applicant.status]}>
  <View className="bg-surface-card dark:bg-surface-elevated rounded-md pl-4 p-3">
    {/* 기존 */}
  </View>
</CardStripe>
```

- [ ] **Step 3: `ConfirmedActions.tsx` — 승인/거절 버튼에 햅틱**

```tsx
import { triggerHaptic } from '@/utils/haptics';

async function handleApprove() {
  await triggerHaptic('medium');
  onApprove();
}

async function handleReject() {
  await triggerHaptic('medium');
  onReject();
}
```

- [ ] **Step 4: 기존 테스트**

Run: `cd uniqn-mobile && npm test -- --testPathPattern ApplicantCard`

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/employer/applicants/ApplicantCard/
git commit -m "refactor(tier-a): ApplicantCard chip·stripe + 승인/거절 햅틱 Medium"
```

---

### Task 3.5: `SettlementCard` — 금액 tabular-nums 우정렬 + stripe

**Files:**
- Modify: `uniqn-mobile/src/components/employer/settlement/SettlementCard.tsx`
- Modify: `uniqn-mobile/src/components/employer/settlement/GroupedSettlementCard.tsx`

- [ ] **Step 1: 상태 → tone 매핑**

```tsx
const SETTLEMENT_STRIPE_TONE: Record<SettlementStatus, CardStripeTone> = {
  pending: 'gold',
  paid: 'info',
  cancelled: 'muted',
  failed: 'error',
};
```

- [ ] **Step 2: 컨테이너 CardStripe 래핑**

- [ ] **Step 3: 금액 Text 우정렬 + tabular-nums + weight 900**

금액 표시 Text className:

```tsx
className="text-content-primary text-base font-sans-bold"
style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.3, textAlign: 'right' }}
```

- [ ] **Step 4: 기존 테스트**

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/employer/settlement/SettlementCard.tsx \
        uniqn-mobile/src/components/employer/settlement/GroupedSettlementCard.tsx
git commit -m "refactor(tier-a): SettlementCard 금액 우정렬 tabular-nums + stripe"
```

---

### Task 3.6: `ApplicationForm` (지원 폼) — 키보드 UX

**Files:**
- Modify: `uniqn-mobile/src/components/jobs/ApplicationForm.tsx`

- [ ] **Step 1: `KeyboardAvoidingView` behavior 플랫폼별**

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  style={{ flex: 1 }}
>
  <ScrollView
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
  >
    {/* 기존 폼 */}
  </ScrollView>
</KeyboardAvoidingView>
```

- [ ] **Step 2: returnKeyType 체인** — 다음 인풋 `next`, 마지막 `done`.

- [ ] **Step 3: `autoFocus` 확인·제거** — 있으면 제거 (Impeccable §20).

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/jobs/ApplicationForm.tsx
git commit -m "refactor(tier-a): ApplicationForm 키보드 UX + autoFocus 제거"
```

---

## Phase 4 — Tier B 컴포넌트 Restyle

### Task 4.1: 게시판 리스트 — 게시글 행 stripe

**Files:**
- Modify: `uniqn-mobile/src/components/board/*` (게시글 카드 컴포넌트 — 실제 파일명은 `ls`로 확정)

- [ ] **Step 1: 파일 확인**

Run: `ls uniqn-mobile/src/components/board/`

BoardPostCard.tsx 또는 유사 파일을 찾아 외부 래퍼 결정.

- [ ] **Step 2: 게시글 카테고리별 stripe tone**

```tsx
const BOARD_CATEGORY_TONE: Record<BoardCategory, CardStripeTone> = {
  announcement: 'gold',
  question: 'info',
  free: 'muted',
  notice: 'gold',
};
```

- [ ] **Step 3: CardStripe 래핑 + 제목 weight 800**

- [ ] **Step 4: tabular-nums on 조회수·날짜**

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/board/
git commit -m "refactor(tier-b): 게시판 카드 stripe + chip + tabular-nums"
```

---

### Task 4.2: 알림 스크린 — 도트 + tabular-nums

**Files:**
- Modify: `uniqn-mobile/app/(app)/notifications.tsx`
- Modify: `uniqn-mobile/src/components/notifications/*` (알림 행 컴포넌트)

- [ ] **Step 1: 파일 확인**

Run: `ls uniqn-mobile/src/components/notifications/`

- [ ] **Step 2: 알림 행 — 읽지않음 골드 도트 + 제목/부제 + 상대 시간 tabular-nums**

`RecentNoticesWidget`의 `NoticeRow`와 유사 패턴. 단, 여기는 전체 알림 리스트(FlashList).

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/notifications.tsx uniqn-mobile/src/components/notifications/
git commit -m "refactor(tier-b): 알림 스크린 도트 + tabular-nums"
```

---

### Task 4.3: 공지 목록/상세 (notices) — AnnouncementCard stripe

**Files:**
- Modify: `uniqn-mobile/src/components/notices/*` 또는 `src/components/admin/announcements/AnnouncementCard.tsx`
- Modify: `uniqn-mobile/app/(app)/notices/index.tsx`
- Modify: `uniqn-mobile/app/(app)/notices/[id].tsx`

- [ ] **Step 1: AnnouncementCard 현재 구조 확인**

Run: `cat uniqn-mobile/src/components/admin/announcements/AnnouncementCard.tsx`

- [ ] **Step 2: CardStripe tone="gold" + 제목 weight 800 + 날짜 tabular-nums**

- [ ] **Step 3: 상세 페이지 — Hero + 섹션**

`notices/[id].tsx` 를 JobDetail 패턴 따라 Hero + 본문 섹션으로.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/admin/announcements/AnnouncementCard.tsx \
        uniqn-mobile/app/\(app\)/notices/
git commit -m "refactor(tier-b): AnnouncementCard stripe + notices/[id] Hero"
```

---

### Task 4.4: 내 공고 리스트 (Employer)

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/employer.tsx`
- Modify: `uniqn-mobile/src/components/employer/posting/*` (JobPostingCard)

- [ ] **Step 1: JobPostingCard 파일 확인**

Run: `cat uniqn-mobile/src/components/employer/posting/__tests__/JobPostingCard.test.tsx | head -30`

파일 경로 확인: `src/components/employer/posting/JobPostingCard.tsx`

- [ ] **Step 2: Job 상태(draft/active/closed) → stripe tone**

```tsx
const POSTING_STRIPE_TONE: Record<PostingStatus, CardStripeTone> = {
  draft: 'muted',
  active: 'gold',
  closed: 'muted',
  paused: 'warning',
};
```

- [ ] **Step 3: B 언어 적용 (title 800, chip, tabular-nums)**

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/employer/posting/ uniqn-mobile/app/\(app\)/\(tabs\)/employer.tsx
git commit -m "refactor(tier-b): 내 공고 리스트 stripe + chip + tabular-nums"
```

---

### Task 4.5: 리뷰 (reviews) — pending/history/write

**Files:**
- Modify: `uniqn-mobile/app/(app)/reviews/pending.tsx`
- Modify: `uniqn-mobile/app/(app)/reviews/history.tsx`
- Modify: `uniqn-mobile/app/(app)/reviews/write.tsx`
- Modify: `uniqn-mobile/app/(app)/reviews/[workLogId].tsx`
- Modify: `uniqn-mobile/src/components/review/*` (ReviewCard)

- [ ] **Step 1: ReviewCard 파일 확인**

Run: `ls uniqn-mobile/src/components/review/`

- [ ] **Step 2: CardStripe tone (쓴 리뷰=muted, 쓸 리뷰=gold)**

- [ ] **Step 3: 별점 weight 800 + tabular-nums**

- [ ] **Step 4: 리뷰 작성 폼 키보드 UX (Task 3.6 패턴)**

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/review/ uniqn-mobile/app/\(app\)/reviews/
git commit -m "refactor(tier-b): 리뷰 전체 stripe + chip + 키보드 UX"
```

---

### Task 4.6: 취소 요청 (CancellationRequestCard)

**Files:**
- Modify: `uniqn-mobile/src/components/employer/applicants/CancellationRequestCard.tsx`

- [ ] **Step 1: CardStripe tone="warning" + chip + tabular-nums**

- [ ] **Step 2: 테스트 통과**

Run: `cd uniqn-mobile && npm test -- --testPathPattern CancellationRequestCard`

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/src/components/employer/applicants/CancellationRequestCard.tsx
git commit -m "refactor(tier-b): CancellationRequestCard warning stripe + chip"
```

---

### Task 4.7: 지원 취소 (cancel) 스크린

**Files:**
- Modify: `uniqn-mobile/app/(app)/applications/[id]/cancel.tsx`

- [ ] **Step 1: 폼 restyle + 햅틱(Warning)**

```tsx
import { triggerHaptic } from '@/utils/haptics';

async function handleCancel() {
  await triggerHaptic('warning');
  // ...기존 취소 로직...
}
```

- [ ] **Step 2: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/applications/\[id\]/cancel.tsx
git commit -m "refactor(tier-b): 지원 취소 폼 restyle + 햅틱 Warning"
```

---

## Phase 5 — Tier C 베이스라인

### Task 5.1: 설정 화면 10개 — 타이포·chip 적용

**Files:**
- Modify: `uniqn-mobile/app/(app)/settings/*.tsx` (10개)

- [ ] **Step 1: 공통 패턴 — 섹션 헤더**

각 설정 화면의 섹션 타이틀 Text에 다음 패턴 적용:

```tsx
<Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
  {sectionTitle}
</Text>
```

- [ ] **Step 2: 행 stripe는 적용하지 않음 (설정은 stripe 의미 부여할 상태 없음)**

단 `bg-surface-card dark:bg-surface-elevated` 카드 외형 일관화.

- [ ] **Step 3: 파일별 돌기**

순서:
- `settings/index.tsx`
- `settings/profile.tsx`
- `settings/business-info.tsx`
- `settings/change-password.tsx`
- `settings/delete-account.tsx`
- `settings/my-data.tsx`
- `settings/privacy.tsx`
- `settings/terms.tsx`
- `settings/employer-terms.tsx`
- `settings/liability-waiver.tsx`

각 파일의 섹션 헤더 · Text 컬러 토큰 · Pressable 영역 `PressableCard` 치환 여부 검토.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/settings/
git commit -m "refactor(tier-c): 설정 10개 화면 섹션 헤더 + 타이포 적용"
```

---

### Task 5.2: 문의 화면 5개

**Files:**
- Modify: `uniqn-mobile/app/(app)/support/*.tsx` (5개: index, create-inquiry, faq, my-inquiries, inquiry/[id])

- [ ] **Step 1: 리스트 화면 (my-inquiries) 카드 CardStripe**

상태별 tone (pending=gold, answered=info, closed=muted).

- [ ] **Step 2: FAQ — 아코디언 각 항목 섹션 헤더 스타일**

- [ ] **Step 3: create-inquiry 폼 키보드 UX**

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/support/
git commit -m "refactor(tier-c): 문의 5개 화면 stripe·섹션·키보드 UX"
```

---

### Task 5.3: Admin 대시보드 KPI 스트라이프

**Files:**
- Modify: `uniqn-mobile/app/(admin)/index.tsx`

- [ ] **Step 1: KPI 카드에 2px CardStripe tone="gold"**

```tsx
<CardStripe tone="gold" thickness={2}>
  <View className="bg-surface-card dark:bg-surface-elevated rounded-sm px-3 py-2">
    <Text className="text-lg font-sans-bold text-content-primary" style={{ fontVariant: ['tabular-nums'] }}>
      {kpi.value}
    </Text>
    <Text className="text-[9px] uppercase tracking-wider text-content-muted">
      {kpi.label}
    </Text>
  </View>
</CardStripe>
```

- [ ] **Step 2: 관리 메뉴 그리드 — 카운트 배지 tabular-nums**

- [ ] **Step 3: 커밋**

```bash
git add uniqn-mobile/app/\(admin\)/index.tsx
git commit -m "refactor(tier-c): admin 대시보드 KPI 스트라이프 + 메뉴 카운트"
```

---

### Task 5.4: Admin stats 차트 토큰화

**Files:**
- Modify: `uniqn-mobile/src/components/admin/stats/RoleDistributionChart.tsx`
- Modify: `uniqn-mobile/src/components/admin/stats/TrendChart.tsx`
- Modify: `uniqn-mobile/src/components/admin/stats/StatsSummaryCard.tsx`

- [ ] **Step 1: 각 차트의 하드코딩 색 확인**

Run: `grep -n '#[0-9A-Fa-f]\{6\}' uniqn-mobile/src/components/admin/stats/*.tsx`

- [ ] **Step 2: 토큰 참조로 교체**

- `primary` 색 → `PRIMARY_PALETTE[500]` (#D4AF37)
- `secondary` → `SECONDARY_PALETTE[400]`
- 차트 축/그리드 → `theme.colors.border.subtle` 토큰

`constants/colors.ts` import 후 변수 참조.

- [ ] **Step 3: StatsSummaryCard — CardStripe tone="gold" 적용**

- [ ] **Step 4: 테스트**

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/admin/stats/
git commit -m "refactor(tier-c): admin stats 차트 토큰 참조·하드코딩 색 제거"
```

---

### Task 5.5: Admin 리스트 화면 (users, reports, 등)

**Files:**
- Modify: `uniqn-mobile/app/(admin)/users/index.tsx` + `[id].tsx`
- Modify: `uniqn-mobile/app/(admin)/reports/index.tsx` + `[id].tsx`
- Modify: `uniqn-mobile/app/(admin)/board-reports/index.tsx` + `[id].tsx`
- Modify: `uniqn-mobile/app/(admin)/employer-applications/index.tsx` + `[id].tsx`
- Modify: `uniqn-mobile/app/(admin)/inquiries/index.tsx` + `[id].tsx`
- Modify: `uniqn-mobile/app/(admin)/announcements/index.tsx` + `create.tsx` + `[id]/*`
- Modify: `uniqn-mobile/app/(admin)/tournaments/index.tsx`

- [ ] **Step 1: 각 리스트 행 — ReportCard 패턴 참고**

Run: `cat uniqn-mobile/src/components/admin/ReportCard.tsx`

리스트 행에 CardStripe 적용 — 상태별 tone 매핑:
- 신규 접수 = gold
- 처리중 = info
- 완료 = muted
- 반려 = warning

- [ ] **Step 2: users 리스트 — 역할별 chip**

`admin/users/index.tsx` 에서 각 user row에 `<Badge variant="chip">{role}</Badge>` (admin/employer/staff).

- [ ] **Step 3: 상세 페이지 — 섹션 헤더 uppercase**

- [ ] **Step 4: 커밋 (18 화면 한 번에, admin 전체)**

```bash
git add uniqn-mobile/app/\(admin\)/
git commit -m "refactor(tier-c): admin 18 화면 stripe·chip·섹션 헤더 일관화"
```

---

## Phase 6 — 폴리시 도입

### Task 6.1: `ScreenSkeleton` — Jobs 리스트 적용

**Files:**
- Modify: `uniqn-mobile/app/(app)/(tabs)/index.tsx` 또는 `src/components/jobs/JobList.tsx`

- [ ] **Step 1: JobList isLoading 분기에 ScreenSkeleton 렌더**

```tsx
import { ScreenSkeleton } from '@/components/ui';

{isLoading ? (
  <ScreenSkeleton type="jobsList" count={5} />
) : (
  <FlashList data={...} />
)}
```

- [ ] **Step 2: 커밋**

```bash
git add uniqn-mobile/src/components/jobs/JobList.tsx
git commit -m "feat(polish): Jobs 리스트 ScreenSkeleton 적용"
```

---

### Task 6.2~6.5: `ScreenSkeleton` 나머지 리스트 적용

**Task 6.2: ApplicantList**
- Modify: `uniqn-mobile/src/components/employer/applicants/ApplicantList.tsx`
- 패턴: `<ScreenSkeleton type="applicantList" count={5} />`
- 커밋: `feat(polish): ApplicantList ScreenSkeleton 적용`

**Task 6.3: Schedule**
- Modify: `uniqn-mobile/app/(app)/(tabs)/schedule.tsx` (or WorkLogList)
- 패턴: `<ScreenSkeleton type="scheduleList" count={4} />`
- 커밋: `feat(polish): Schedule ScreenSkeleton 적용`

**Task 6.4: Settlement**
- Modify: `uniqn-mobile/src/components/employer/settlement/SettlementList.tsx`
- 패턴: `<ScreenSkeleton type="settlementList" count={6} />`
- 커밋: `feat(polish): Settlement ScreenSkeleton 적용`

**Task 6.5: Notifications**
- Modify: `uniqn-mobile/app/(app)/notifications.tsx`
- 패턴: `<ScreenSkeleton type="notificationList" count={8} />`
- 커밋: `feat(polish): Notifications ScreenSkeleton 적용`

각 task 동일 단계: 적용 → 테스트 → 커밋.

---

### Task 6.6: PTR 골드 틴트 일괄 적용

**Files:**
- Modify: 8개 리스트 화면 (jobs, schedule, notifications, board, my-postings, applicants, settlements, notices)

- [ ] **Step 1: 공용 상수 정의**

`uniqn-mobile/src/constants/ptr.ts` 신설 (없으면):

```tsx
import { PRIMARY_PALETTE } from './colors';

export const PTR_REFRESH_PROPS = {
  tintColor: PRIMARY_PALETTE[500],           // iOS
  colors: [PRIMARY_PALETTE[500]],            // Android
  progressBackgroundColor: '#111113',
} as const;
```

- [ ] **Step 2: 각 리스트에 spread**

```tsx
import { PTR_REFRESH_PROPS } from '@/constants/ptr';

<FlashList
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...PTR_REFRESH_PROPS} />
  }
/>
```

- [ ] **Step 3: 8개 화면 일괄 적용 → 커밋**

```bash
git add uniqn-mobile/src/constants/ptr.ts uniqn-mobile/app/ uniqn-mobile/src/
git commit -m "feat(polish): PTR 골드 틴트 8개 리스트 일괄 적용"
```

---

### Task 6.7: Blurhash 치환 — 썸네일 8곳

**Files:**
- Modify: `uniqn-mobile/src/components/ui/OptimizedImage.tsx` (기존 확장)
- Modify: 썸네일 사용처 8곳

- [ ] **Step 1: OptimizedImage 현재 구조 파악**

Run: `cat uniqn-mobile/src/components/ui/OptimizedImage.tsx`

이미 blurhash prop 지원하면 Step 2 skip, 아니면 확장:

```tsx
export interface OptimizedImageProps {
  uri: string;
  blurhash?: string;    // ← 추가
  // ...기존...
}

// 내부: blurhash가 있으면 expo-image placeholder로 전달
```

- [ ] **Step 2: 프로필 아바타 사용처**

`src/components/profile/*` 또는 `src/components/employer/applicants/*` 의 이미지 사용처에서 DB에서 `blurhash` 필드 조회 후 `<OptimizedImage uri={avatarUrl} blurhash={avatarBlurhash} />` 전달.

- [ ] **Step 3: 공지 / 게시판 썸네일 사용처 동일 패턴**

- [ ] **Step 4: fallback 확인 — blurhash null 시 `bg-surface-overlay` 단색 fallback**

파이프라인에 이미 포함됨 (memory 참조). 확인만.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/ui/OptimizedImage.tsx uniqn-mobile/src/
git commit -m "feat(polish): blurhash 썸네일 8곳 적용"
```

---

### Task 6.8: 햅틱 추가 — 삭제 확인, 결제, 토글

**Files:**
- Modify: `uniqn-mobile/src/components/employer/settlement/SettlementActionButtons.tsx`
- Modify: `uniqn-mobile/src/components/ui/Modal.tsx` (삭제 확인 다이얼로그)
- Modify: `uniqn-mobile/src/stores/themeStore.ts` (토글)

- [ ] **Step 1: 정산 승인/거절 — Medium / Warning**

```tsx
import { triggerHaptic } from '@/utils/haptics';

async function handleApproveSettlement() {
  await triggerHaptic('medium');
  // ...
}
```

- [ ] **Step 2: 삭제 확인 — Warning**

- [ ] **Step 3: 다크모드 토글 — Light**

- [ ] **Step 4: 배치 액션 — triggerBatchStart/End 사용**

SettlementBulkActions에서 시작 시 `triggerBatchStart()`, 완료 시 `triggerBatchEnd(success)` 호출.

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/
git commit -m "feat(polish): 햅틱 15지점 심음 (결정적 순간 + 배치 시작/종료)"
```

---

### Task 6.9: Focus ring 검증

**Files:**
- 확인만: `uniqn-mobile/src/components/ui/PressableCard.tsx` (Task 0.4에서 구현)
- Modify: `uniqn-mobile/src/components/ui/Button.tsx`, `Input.tsx` (focused state 추가)

- [ ] **Step 1: `Button.tsx` — focused 분기 추가**

기존 Button 구현에 focused state에 2px info-500 border 추가. 패턴 (PressableCard.tsx)와 동일.

- [ ] **Step 2: `Input.tsx` — focused 동일**

- [ ] **Step 3: iOS 시뮬레이터 외부 키보드 시뮬레이션**

Cmd+K → Connect Hardware Keyboard → Tab 키 눌러 포커스 이동, 각 컴포넌트 2px 블루 ring 확인, layout shift 없음.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/ui/Button.tsx uniqn-mobile/src/components/ui/Input.tsx
git commit -m "feat(polish): Button·Input focused 2px info-blue ring"
```

---

### Task 6.10: tabular-nums 일괄 적용

**Files:**
- Modify: 40~50 호출부

- [ ] **Step 1: grep으로 formatCurrency / formatDate / 숫자 렌더 사용처 찾기**

Run:
```bash
cd uniqn-mobile && grep -rn 'formatCurrency\|formatDate\|toLocaleString\|₩' src/ app/ | grep -v '__tests__' | wc -l
```

- [ ] **Step 2: `NumericText` 헬퍼 컴포넌트 신설 (선택)**

`uniqn-mobile/src/components/ui/NumericText.tsx`:

```tsx
import React from 'react';
import { Text, type TextProps } from 'react-native';

export function NumericText({ children, style, ...rest }: TextProps & { children: React.ReactNode }) {
  return (
    <Text
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      {...rest}
    >
      {children}
    </Text>
  );
}
```

- [ ] **Step 3: 주요 호출부에 NumericText 치환**

Tier A 이미 Task 3.1·3.5에서 처리. 남은 Tier B·C 화면을 호출부 단위로:
- 스케줄 시간/날짜 Text
- 정산 금액 Text
- 알림 시간 Text
- 게시판 조회수 Text
- 리뷰 별점 Text
- Admin 통계 숫자 Text

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/components/ui/NumericText.tsx \
        uniqn-mobile/src/components/ui/index.ts \
        uniqn-mobile/src/ uniqn-mobile/app/
git commit -m "feat(polish): NumericText 헬퍼 + tabular-nums 40+ 호출부 적용"
```

---

## Phase 7 — 검증

### Task 7.1: Quality Gate

- [ ] **Step 1: type-check + lint + format**

```bash
cd uniqn-mobile && npm run quality
```

Expected: `tsc --noEmit` 0 errors, `eslint` 0 errors, `prettier --check` 0 issues.

- [ ] **Step 2: 실패 시 fix 루프**

TypeScript 에러는 해당 task로 되돌아가 수정. Lint 에러는 `npm run lint -- --fix`.

---

### Task 7.2: 스냅샷 일괄 갱신

- [ ] **Step 1: 전체 테스트 실행**

```bash
cd uniqn-mobile && npm test
```

Expected: 스냅샷 mismatch 에러 다수 (의도적).

- [ ] **Step 2: 스냅샷 갱신**

```bash
cd uniqn-mobile && npm test -- -u
```

- [ ] **Step 3: git diff 로 갱신된 스냅샷 검토**

```bash
cd C:/Users/user/Desktop/T-HOLDEM && git diff uniqn-mobile/src/**/__snapshots__
```

의도한 스타일 변경과 일치하는지 스캔. 의외의 mismatch 있으면 되돌아가 조사.

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/src/**/__snapshots__
git commit -m "chore(test): jest snapshot -u 일괄 갱신 (design modernization)"
```

---

### Task 7.3: 수동 QA 체크리스트

Impeccable v2 27항목 + 핵심 시나리오.

- [ ] **Step 1: iOS 시뮬레이터 — 다크 모드**

다음 화면 시각 점검:
- [ ] 홈 (Hero + 3 섹션)
- [ ] 구인구직 리스트 + 필터탭 + 스켈레톤 + PTR + 오프라인 배너
- [ ] 공고 상세 + 지원하기 CTA
- [ ] 스케줄
- [ ] 지원자 관리 + 승인 햅틱 (Medium)
- [ ] 정산
- [ ] 프로필
- [ ] 알림 (도트 + tabular-nums)
- [ ] Admin 대시보드 + KPI stripe

- [ ] **Step 2: iOS 시뮬레이터 — 라이트 모드**

동일 리스트 재점검 (Pressed 역방향, WCAG AA 대비).

- [ ] **Step 3: Android 에뮬레이터 — 다크·라이트 각 1회**

android_ripple 동작 확인.

- [ ] **Step 4: 외부 키보드 시뮬레이션**

Cmd+K → Connect Hardware Keyboard → Tab 이동 → 2px info blue ring + layout shift 없음.

- [ ] **Step 5: 오프라인 시나리오**

시뮬레이터 Wi-Fi 끄기 → 배너 등장 확인 + VoiceOver 읽기. 복구 → "돌아왔어요" 메시지 + 2초 자동 dismiss.

- [ ] **Step 6: Reduce Motion**

iOS 설정 → 접근성 → 모션 줄이기 ON → Skeleton shimmer 정적 배경으로 전환 확인.

- [ ] **Step 7: 체크리스트 통과 확인**

모든 체크박스 체크.

---

### Task 7.4: EAS 내부 테스트 빌드

- [ ] **Step 1: Android 내부 빌드**

```bash
cd uniqn-mobile && eas build --platform android --profile preview
```

- [ ] **Step 2: iOS 내부 빌드**

```bash
cd uniqn-mobile && eas build --platform ios --profile preview
```

- [ ] **Step 3: 실기 스모크 테스트**

빌드된 앱 실기 설치 → 홈 진입 → 주요 플로우 1회 돌아봄.

---

### Task 7.5: 최종 PR

- [ ] **Step 1: 커밋 로그 정리**

```bash
cd C:/Users/user/Desktop/T-HOLDEM && git log --oneline master..HEAD
```

약 60~70개 커밋 예상. 그대로 유지 (squash 하지 않음).

- [ ] **Step 2: PR 생성**

```bash
gh pr create --title "디자인 현대화: 블라인드식 B + 홈 V2 + L1 전면 (49 화면)" \
  --body "$(cat <<'EOF'
## Summary

- `DESIGN.md`(Midnight Craft) 시스템에 블라인드식 B 카드 언어 확립
- 홈만 V2(Hero + 섹션 헤더) — 유일한 레이아웃 변경
- 나머지 48 화면 L1 표면만 재스킨 (레이아웃 무손상)
- 폴리시 P1~P8·P10 도입 (P9 sticky 제외)

## 스펙 문서
`docs/superpowers/specs/2026-04-17-design-modernization-design.md`

## 구현 계획
`docs/superpowers/plans/2026-04-17-design-modernization.md`

## 변경 규모
- 신설 5 파일 (CardStripe, PressableCard, ScreenSkeleton, NumericText, ptr 상수)
- 수정 80~100 파일 (스냅샷 포함)
- 커밋 60+ (phase·task 단위)

## Test plan
- [x] `npm run quality` 0 에러
- [x] `npm test` 전체 PASS (snapshot 갱신)
- [x] Impeccable v2 27항목 체크리스트
- [x] iOS/Android 다크·라이트 수동 QA
- [x] 외부 키보드 Focus ring 확인
- [x] 오프라인 배너 VoiceOver polite 읽기
- [x] EAS preview 빌드 성공
EOF
)"
```

- [ ] **Step 2: PR URL 확인 + 리뷰 요청**

PR URL 공유 → 사용자 / 다른 리뷰어에게 전달.

---

## 변경 파일 요약

### 신설 (5개)
- `uniqn-mobile/src/components/ui/CardStripe.tsx`
- `uniqn-mobile/src/components/ui/PressableCard.tsx`
- `uniqn-mobile/src/components/ui/ScreenSkeleton.tsx`
- `uniqn-mobile/src/components/ui/NumericText.tsx`
- `uniqn-mobile/src/constants/ptr.ts`

### 수정 (주요)
- `uniqn-mobile/tailwind.config.js`
- `uniqn-mobile/src/components/ui/Badge.tsx` (+chip variant)
- `uniqn-mobile/src/components/ui/index.ts` (배럴 export)
- `uniqn-mobile/app/(app)/_layout.tsx`, `(employer)/_layout.tsx`, `(admin)/_layout.tsx`, `(auth)/_layout.tsx`
- `uniqn-mobile/app/(app)/(tabs)/_layout.tsx`
- `uniqn-mobile/app/(app)/home.tsx`
- `uniqn-mobile/src/components/home/DashboardWidgetShell.tsx` + `StaffDashboard.tsx` + `EmployerDashboard.tsx` + `widgets/*.tsx` (7개)
- `uniqn-mobile/src/components/jobs/*` (카드·상세·리스트·폼 약 8개)
- `uniqn-mobile/src/components/schedule/*` (3개)
- `uniqn-mobile/src/components/employer/applicants/*` (ApplicantCard + 하위 + Cancellation + List)
- `uniqn-mobile/src/components/employer/settlement/*` (2개)
- `uniqn-mobile/src/components/employer/posting/*` (JobPostingCard)
- `uniqn-mobile/src/components/board/*` (카드)
- `uniqn-mobile/src/components/notifications/*` (행)
- `uniqn-mobile/src/components/admin/stats/*` (3개 차트)
- `uniqn-mobile/src/components/admin/ReportCard.tsx`, `announcements/AnnouncementCard.tsx`
- `uniqn-mobile/src/components/review/*`
- `uniqn-mobile/app/(app)/settings/*` (10개)
- `uniqn-mobile/app/(app)/support/*` (5개)
- `uniqn-mobile/app/(admin)/*` (18개)
- `uniqn-mobile/src/utils/haptics.ts` 호출부 15~20 지점
- 포맷터 호출부 tabular-nums 40~50 지점
- `__snapshots__` 다수 (최종 -u로 일괄)

### 명시적 건드리지 않음
- `uniqn-mobile/src/components/ui/Skeleton.tsx` (v3.0.0 유지)
- `uniqn-mobile/src/components/ui/OfflineBanner.tsx`
- `uniqn-mobile/src/utils/haptics.ts` (로직 유지, 호출부만 추가)
- `uniqn-mobile/src/utils/formatters/*` (로직 유지)
- DB 스키마 / 마이그레이션
- 라우트 / 딥링크

---

## 실패 복구 전략

각 task 실패 시:

1. **타입 에러** — 해당 task에서 수정 후 재시도. 다음 task 진행 금지.
2. **테스트 실패** — 로직 회귀면 해당 task 되돌리기. 스냅샷만이면 Task 7.2에서 일괄.
3. **빌드 실패 (EAS)** — Task 7.4 전 스모크 빌드 실패 시 `npx expo prebuild --clean` 후 재시도. 근본 원인 (native 의존성 변경) 조사.
4. **Git conflict** — feature 브랜치가 master와 뒤쳐지면 `git rebase master` 후 충돌 해결.

롤백 필요 시 phase 단위로 revert: `git revert HEAD~N..HEAD`.
