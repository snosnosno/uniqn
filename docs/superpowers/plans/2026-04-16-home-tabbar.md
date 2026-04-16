# 홈 화면 하단 탭바 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면(`app/(app)/home.tsx`) 하단에 5개 탭(구인구직/내 스케줄/게시판/내 공고/프로필)으로 이동하는 표시 전용 탭바를 추가하고, 헤더 타이틀을 "홈"으로 표시하며 QR 버튼을 노출한다.

**Architecture:** 홈은 스택 스크린 그대로 유지하고, 기존 `(tabs)/_layout.tsx`의 `<Tabs>` 로직은 재사용 불가하므로 커스텀 `HomeTabBar` 컴포넌트 신규 작성. 모든 탭은 비활성 색상 고정이고, 탭 press 시 `router.push`로 해당 탭 화면으로 이동한다. 대시보드 `ScrollView`에 `bottomPadding` prop을 추가해 마지막 카드가 탭바에 가려지지 않도록 한다.

**Tech Stack:** React Native 0.83.4, Expo Router, NativeWind 4.2, expo-router `router.push`, `react-native-safe-area-context`, Jest + @testing-library/react-native

**Spec:** `docs/superpowers/specs/2026-04-16-home-tabbar-design.md`

---

## 파일 변경 맵

**신규**
- `uniqn-mobile/src/components/home/HomeTabBar.tsx` — 표시 전용 탭바 (5개 탭, router.push)
- `uniqn-mobile/src/components/home/__tests__/HomeTabBar.test.tsx` — 탭별 라우팅 검증

**수정**
- `uniqn-mobile/app/(app)/home.tsx` — TabHeader props 변경 + HomeTabBar 렌더 + bottomPadding 전달
- `uniqn-mobile/src/components/home/StaffDashboard.tsx` — `bottomPadding?: number` prop 추가
- `uniqn-mobile/src/components/home/EmployerDashboard.tsx` — `bottomPadding?: number` prop 추가

---

## Task 1: `HomeTabBar` 컴포넌트 — 실패 테스트 먼저

**Files:**
- Create: `uniqn-mobile/src/components/home/__tests__/HomeTabBar.test.tsx`

- [ ] **Step 1: 테스트 파일 작성 (5개 탭 라우팅 검증)**

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HomeTabBar } from '../HomeTabBar';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

jest.mock('@/components/icons', () => ({
  HomeIcon: () => null,
  CalendarIcon: () => null,
  MessageIcon: () => null,
  BriefcaseIcon: () => null,
  UserIcon: () => null,
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('HomeTabBar', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('구인구직 탭 press → /(app)/(tabs)로 이동', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('구인구직 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)');
  });

  it('내 스케줄 탭 press → /(app)/(tabs)/schedule', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('내 스케줄 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/schedule');
  });

  it('게시판 탭 press → /(app)/(tabs)/board', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('게시판 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/board');
  });

  it('내 공고 탭 press → /(app)/(tabs)/employer', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('내 공고 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/employer');
  });

  it('프로필 탭 press → /(app)/(tabs)/profile', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    fireEvent.press(getByLabelText('프로필 탭으로 이동'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/(tabs)/profile');
  });

  it('5개 탭이 모두 렌더된다', () => {
    const { getByLabelText } = render(<HomeTabBar />);
    expect(getByLabelText('구인구직 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('내 스케줄 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('게시판 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('내 공고 탭으로 이동')).toBeTruthy();
    expect(getByLabelText('프로필 탭으로 이동')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (컴포넌트 미존재)**

Run:
```bash
cd uniqn-mobile && npx jest src/components/home/__tests__/HomeTabBar.test.tsx
```

Expected: FAIL with "Cannot find module '../HomeTabBar'"

---

## Task 2: `HomeTabBar` 컴포넌트 구현 — 최소 구현으로 Green

**Files:**
- Create: `uniqn-mobile/src/components/home/HomeTabBar.tsx`

- [ ] **Step 1: 컴포넌트 구현**

```tsx
/**
 * HomeTabBar — 홈 화면 하단 표시 전용 탭바
 *
 * 홈은 (tabs)/ 밖의 스택 스크린이라 expo-router <Tabs>를 재사용 불가.
 * 시각은 기존 탭바와 동일, 상태는 모두 비활성(홈은 탭이 아님).
 * 탭 press 시 router.push로 해당 탭 화면으로 이동.
 */

import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, CalendarIcon, MessageIcon, BriefcaseIcon, UserIcon } from '@/components/icons';
import { LAYOUT } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';

type TabItem = {
  label: string;
  route: string;
  Icon: React.ComponentType<{ color: string; size: number }>;
};

const TABS: TabItem[] = [
  { label: '구인구직', route: '/(app)/(tabs)', Icon: HomeIcon },
  { label: '내 스케줄', route: '/(app)/(tabs)/schedule', Icon: CalendarIcon },
  { label: '게시판', route: '/(app)/(tabs)/board', Icon: MessageIcon },
  { label: '내 공고', route: '/(app)/(tabs)/employer', Icon: BriefcaseIcon },
  { label: '프로필', route: '/(app)/(tabs)/profile', Icon: UserIcon },
];

export function HomeTabBar() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const insets = useSafeAreaInsets();
  const bg = getLayoutColor(isDark, 'tabBarBg');
  const border = getLayoutColor(isDark, 'tabBarBorder');
  const inactive = getLayoutColor(isDark, 'tabBarInactive');

  return (
    <View
      style={{
        flexDirection: 'row',
        height: LAYOUT.TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: bg,
        borderTopWidth: 1,
        borderTopColor: border,
      }}
    >
      {TABS.map(({ label, route, Icon }) => (
        <Pressable
          key={route}
          onPress={() => router.push(route)}
          accessibilityRole="button"
          accessibilityLabel={`${label} 탭으로 이동`}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
          hitSlop={4}
        >
          <Icon color={inactive} size={24} />
          <Text style={{ color: inactive, fontSize: 11, fontWeight: '600' }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default HomeTabBar;
```

- [ ] **Step 2: 테스트 실행 → 전부 Pass 확인**

Run:
```bash
cd uniqn-mobile && npx jest src/components/home/__tests__/HomeTabBar.test.tsx
```

Expected: PASS (6 tests)

- [ ] **Step 3: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/home/HomeTabBar.tsx uniqn-mobile/src/components/home/__tests__/HomeTabBar.test.tsx
git commit -m "feat(mobile): 홈 하단 탭바 컴포넌트 HomeTabBar 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Dashboard 컴포넌트에 `bottomPadding` prop 추가

**Files:**
- Modify: `uniqn-mobile/src/components/home/StaffDashboard.tsx`
- Modify: `uniqn-mobile/src/components/home/EmployerDashboard.tsx`

- [ ] **Step 1: StaffDashboard 수정**

Replace the full contents of `uniqn-mobile/src/components/home/StaffDashboard.tsx` with:

```tsx
import React from 'react';
import { ScrollView } from 'react-native';
import { NextWorkWidget } from '@/components/home/widgets/NextWorkWidget';
import { ApplicationStatusWidget } from '@/components/home/widgets/ApplicationStatusWidget';
import { MonthSummaryWidget } from '@/components/home/widgets/MonthSummaryWidget';
import { RecentNoticesWidget } from '@/components/home/widgets/RecentNoticesWidget';

interface StaffDashboardProps {
  bottomPadding?: number;
}

export function StaffDashboard({ bottomPadding = 0 }: StaffDashboardProps) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 16 + bottomPadding }}
    >
      <NextWorkWidget />
      <ApplicationStatusWidget />
      <MonthSummaryWidget />
      <RecentNoticesWidget />
    </ScrollView>
  );
}
```

- [ ] **Step 2: EmployerDashboard 수정**

Replace the full contents of `uniqn-mobile/src/components/home/EmployerDashboard.tsx` with:

```tsx
import React from 'react';
import { ScrollView } from 'react-native';
import { WeeklyStaffWidget } from '@/components/home/widgets/WeeklyStaffWidget';
import { PostingOverviewWidget } from '@/components/home/widgets/PostingOverviewWidget';
import { CancellationWidget } from '@/components/home/widgets/CancellationWidget';
import { RecentNoticesWidget } from '@/components/home/widgets/RecentNoticesWidget';

interface EmployerDashboardProps {
  bottomPadding?: number;
}

export function EmployerDashboard({ bottomPadding = 0 }: EmployerDashboardProps) {
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 16 + bottomPadding }}
    >
      <WeeklyStaffWidget />
      <PostingOverviewWidget />
      <CancellationWidget />
      <RecentNoticesWidget />
    </ScrollView>
  );
}
```

- [ ] **Step 3: 기존 StaffDashboard 테스트 실행 → 통과 확인 (회귀 없음)**

Run:
```bash
cd uniqn-mobile && npx jest src/components/home/__tests__/StaffDashboard.test.tsx
```

Expected: PASS (기존 테스트가 `<StaffDashboard />`를 props 없이 호출하므로 기본값 0으로 동작)

- [ ] **Step 4: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/src/components/home/StaffDashboard.tsx uniqn-mobile/src/components/home/EmployerDashboard.tsx
git commit -m "feat(mobile): StaffDashboard/EmployerDashboard에 bottomPadding prop 추가

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `home.tsx`에 HomeTabBar 통합 + 헤더 props 업데이트

**Files:**
- Modify: `uniqn-mobile/app/(app)/home.tsx`

- [ ] **Step 1: home.tsx 수정**

Replace the full contents of `uniqn-mobile/app/(app)/home.tsx` with:

```tsx
/**
 * HomeDashboard — 앱 진입 후 메인 화면
 *
 * employer는 employer/staff 뷰 전환 토글 제공.
 * staff 전용 사용자는 StaffDashboard 고정.
 * 홈은 탭이 아니지만 하단에 표시 전용 HomeTabBar를 렌더하여 탭 화면으로 이동 가능.
 */

import React, { useEffect, useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { Loading } from '@/components/ui';
import { TabHeader } from '@/components/headers';
import { StaffDashboard } from '@/components/home/StaffDashboard';
import { EmployerDashboard } from '@/components/home/EmployerDashboard';
import { DashboardViewToggle } from '@/components/home/DashboardViewToggle';
import { HomeTabBar } from '@/components/home/HomeTabBar';
import { LAYOUT } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function HomeDashboard() {
  const { isLoading, isEmployer } = useAuth();
  const canToggle = isEmployer;
  const [view, setView] = useState<'staff' | 'employer'>('staff');

  useEffect(() => {
    if (!isLoading) {
      setView(isEmployer ? 'employer' : 'staff');
    }
  }, [isLoading, isEmployer]);

  const isDark = useThemeStore((state) => state.isDarkMode);
  const bgColor = getLayoutColor(isDark, 'content');
  const insets = useSafeAreaInsets();
  const bottomPadding = LAYOUT.TAB_BAR_HEIGHT + insets.bottom;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
        <TabHeader title="홈" showQR={true} />
        <Loading variant="layout" />
        <HomeTabBar />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }} edges={['top']}>
      <TabHeader title="홈" showQR={true} />
      {canToggle && (
        <DashboardViewToggle value={view} onChange={(v) => setView(v as 'staff' | 'employer')} />
      )}
      {view === 'employer' ? (
        <EmployerDashboard bottomPadding={bottomPadding} />
      ) : (
        <StaffDashboard bottomPadding={bottomPadding} />
      )}
      <HomeTabBar />
    </SafeAreaView>
  );
}
```

변경 요약:
- `TabHeader`: `title=""` → `title="홈"`, `showQR={false}` → `showQR={true}` (로딩/정상 둘 다)
- `useSafeAreaInsets` import 및 `bottomPadding` 계산
- `<StaffDashboard bottomPadding={bottomPadding} />` / `<EmployerDashboard bottomPadding={bottomPadding} />` prop 전달
- `<HomeTabBar />` 렌더 (로딩/정상 둘 다)
- `SafeAreaView edges={['top']}` 명시 (하단은 탭바가 담당)

- [ ] **Step 2: 타입체크 실행**

Run:
```bash
cd uniqn-mobile && npm run type-check
```

Expected: 0 errors

- [ ] **Step 3: 전체 품질 검증**

Run:
```bash
cd uniqn-mobile && npm run quality
```

Expected: PASS (typecheck + lint + format:check 모두 통과)

- [ ] **Step 4: 관련 테스트 실행**

Run:
```bash
cd uniqn-mobile && npx jest src/components/home/__tests__ src/components/headers/__tests__
```

Expected: 모든 테스트 PASS (HomeTabBar 6 + StaffDashboard 1 + TabHeader 등 기존 테스트)

- [ ] **Step 5: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/app/\(app\)/home.tsx
git commit -m "feat(mobile): 홈 화면 하단 탭바 + 헤더 타이틀 '홈' + QR 노출

- HomeTabBar 렌더로 홈에서 5개 탭 화면으로 이동 가능
- TabHeader title='홈', showQR=true로 변경
- StaffDashboard/EmployerDashboard에 bottomPadding 전달

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 수동 QA 체크리스트

**Files:** 없음 (실기기 검증)

- [ ] **Step 1: 개발 서버 실행**

Run:
```bash
cd uniqn-mobile && npm start
```

- [ ] **Step 2: 홈 화면 진입 후 아래 항목 확인**

- [ ] 하단 탭바 5개(구인구직/내 스케줄/게시판/내 공고/프로필) 모두 보임, 전부 inactive 색상
- [ ] 헤더 왼쪽 "홈" 타이틀 표시
- [ ] 헤더 우측 QR 아이콘 + 알림 아이콘 노출
- [ ] 대시보드 스크롤 시 마지막 카드가 탭바에 가리지 않음
- [ ] 각 탭 press → 해당 화면 진입 → 뒤로가기로 홈 복귀 정상
- [ ] QR 아이콘 press → QR 화면 정상 진입
- [ ] 다크/라이트 모드 전환 시 탭바 색상(배경/경계선/아이콘/텍스트) 올바르게 전환
- [ ] SafeArea 하단 여백이 iOS 홈 인디케이터/안드로이드 제스처 영역과 겹치지 않음

- [ ] **Step 3: QA 통과 시 완료 보고**

---

## Self-Review 결과

**Spec 커버리지 확인:**
- ✅ 신규 `HomeTabBar` 컴포넌트 → Task 1~2
- ✅ `home.tsx` 헤더 title="홈" 변경 → Task 4
- ✅ `home.tsx` showQR=true 변경 → Task 4
- ✅ HomeTabBar 통합 → Task 4
- ✅ Dashboard bottomPadding prop → Task 3
- ✅ 5개 탭 router.push 동작 → Task 1 테스트 + Task 2 구현
- ✅ 다크/라이트 토큰 (`tabBarBg`/`tabBarBorder`/`tabBarInactive`) → Task 2
- ✅ 접근성 라벨 → Task 2
- ✅ 단위 테스트 5 케이스 → Task 1 (실제론 6 케이스로 더 많음)
- ✅ `npm run quality` 검증 → Task 4 Step 3
- ✅ 수동 QA → Task 5

**타입 일관성:**
- `bottomPadding?: number` — StaffDashboard, EmployerDashboard에서 동일 이름/타입
- `HomeTabBar` — props 없음으로 일관
- `router.push(route)` — 모든 탭에서 동일 시그니처

**Placeholder 없음 확인:** TBD/TODO/implement later 등 키워드 없음
