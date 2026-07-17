# 오프라인 UI 교체 구현 계획 (OfflineBanner → OfflineStatusBar 승격)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전역 오프라인 표시를 빨간 레이아웃-푸시 배너에서 §25 스펙 패시브 오버레이 상태바로 교체하고, 구 OfflineBanner를 완전 삭제한다.

**Architecture:** 이미 구현된 `OfflineStatusBar`(absolute 오버레이, 슬라이드 인/아웃)를 §25 마감(복구 시 success 톤 + Wifi 아이콘 + exit 애니메이션 실동작)까지 완성한 뒤 루트 레이아웃에 마운트하고, `OfflineBanner` 3변형과 E2E 재시도 시나리오를 제거한다. 서버 무변경.

**Tech Stack:** Expo RN 0.83 / react-native-reanimated / NativeWind / Jest(@testing-library/react-native) / Playwright

**Spec:** `docs/superpowers/specs/2026-07-16-offline-ui-redesign-design.md`

## Global Constraints

- 모든 주석·커밋 메시지 **한글** (CLAUDE.md)
- 커밋 형식: `<type>(<scope>): <한글>` — 이 작업은 `feat(ui)` / `refactor(ui)` / `test(e2e)`
- 아이콘은 `@/components/icons` 경유만 (lucide 직접 import ESLint 차단)
- `console.log` 금지 (앱 런타임)
- 앱 코드 경로 alias `@/` 사용, 시스템 절대경로 금지
- 작업 디렉토리: `uniqn-mobile/` (jest·quality 명령 실행 위치)
- 스펙 대비 추가 1건(승인된 의도 이행): 현재 컴포넌트는 `phase==='hidden'` 즉시 `return null`이라 exit 225ms 애니메이션이 죽어 있음 → 언마운트를 EXIT_MS만큼 지연시켜 §25 "exit 225ms" 실동작화

---

### Task 1: OfflineStatusBar §25 마감 — success 톤 + Wifi 아이콘 + exit 애니메이션 (TDD)

**Files:**
- Modify: `uniqn-mobile/src/components/ui/OfflineStatusBar.tsx`
- Test: `uniqn-mobile/src/components/ui/__tests__/OfflineStatusBar.test.tsx`

**Interfaces:**
- Consumes: `getNetworkState`/`subscribeToNetworkState` (`@/services/offline/networkState`), `WifiIcon`/`WifiOff` (`@/components/icons` — 이미 export됨, index.tsx:256-257)
- Produces: `OfflineStatusBar(): React.ReactElement | null` — props 없음, `testID="offline-status-bar"` 유지 (Task 2·3이 의존)

- [ ] **Step 1: 실패하는 테스트 추가/수정**

`OfflineStatusBar.test.tsx`에 다음을 적용:

1) 파일 상단 import에 `StyleSheet` 추가 + nativewind 모킹(컬러스킴 결정성) + 아이콘 import:

```tsx
import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { OfflineStatusBar } from '../OfflineStatusBar';
import { WifiIcon, WifiOff } from '@/components/icons';

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
```

2) 기존 `auto-dismisses the reconnect message after 2s` 테스트의 마지막 검증을 exit 지연 반영으로 **수정**:

```tsx
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    // exit 애니메이션(225ms) 동안은 아직 렌더 유지
    expect(queryByTestId('offline-status-bar')).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(225);
    });
    expect(queryByTestId('offline-status-bar')).toBeNull();
    jest.useRealTimers();
```

3) describe 블록 끝에 신규 테스트 3개 추가:

```tsx
  it('오프라인 배너는 warning 톤 배경으로 렌더된다', () => {
    mockIsOnline = false;
    const { getByTestId, UNSAFE_queryAllByType } = render(<OfflineStatusBar />);
    const flat = StyleSheet.flatten(getByTestId('offline-status-bar').props.style);
    expect(flat.backgroundColor).toBe('rgba(161,98,7,0.15)'); // light warning subtle
    expect(UNSAFE_queryAllByType(WifiOff)).toHaveLength(1);
    expect(UNSAFE_queryAllByType(WifiIcon)).toHaveLength(0);
  });

  it('복구 배너는 success 톤 배경 + Wifi 아이콘으로 렌더된다', () => {
    mockIsOnline = true;
    const { getByTestId, UNSAFE_queryAllByType } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      triggerNetworkChange(true);
    });

    const flat = StyleSheet.flatten(getByTestId('offline-status-bar').props.style);
    expect(flat.backgroundColor).toBe('rgba(22,163,74,0.15)'); // light success subtle
    expect(UNSAFE_queryAllByType(WifiIcon)).toHaveLength(1);
    expect(UNSAFE_queryAllByType(WifiOff)).toHaveLength(0);
  });

  it('exit 애니메이션 동안에도 복구 라벨과 success 톤을 유지한다', () => {
    jest.useFakeTimers();
    mockIsOnline = true;
    const { getByTestId } = render(<OfflineStatusBar />);

    act(() => {
      triggerNetworkChange(false);
    });
    act(() => {
      triggerNetworkChange(true);
    });
    act(() => {
      jest.advanceTimersByTime(2000); // dismiss 발동 → exit 구간 진입
    });

    const bar = getByTestId('offline-status-bar');
    expect(bar.props.accessibilityLabel).toBe('온라인으로 돌아왔어요');
    expect(StyleSheet.flatten(bar.props.style).backgroundColor).toBe('rgba(22,163,74,0.15)');
    jest.useRealTimers();
  });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd uniqn-mobile && npx jest src/components/ui/__tests__/OfflineStatusBar.test.tsx --silent`
Expected: FAIL — 신규 3개(배경색이 기존 단일 warning 토큰이라 불일치, WifiIcon 부재) + 수정한 auto-dismiss 1개(즉시 null이라 exit 구간 검증 실패)

- [ ] **Step 3: 구현 — OfflineStatusBar.tsx 수정**

`OfflineStatusBar.tsx`를 다음 최종본으로 교체 (주석 포함, `useReduceMotion` 함수는 기존 그대로 유지):

```tsx
/**
 * OfflineStatusBar — impeccable v2 §25 스펙 준수 상단 상태바
 *
 * 목적:
 * - 네트워크 끊김 진입 시 상단에서 슬라이드-인, warning 틴트로 "오프라인 상태입니다"
 * - 복구 순간 "온라인으로 돌아왔어요"(success 톤 + Wifi 아이콘) 2초 표시 후 자동 dismiss
 * - 사용자 액션 없음(dismiss 버튼·retry 없음). 네트워크 복구는 NetInfo 자동 감지 +
 *   재연결 시 쿼리 자동 refetch(AuthenticatedRuntime)가 담당.
 *
 * 디자인 spec:
 * - height 40px, safe-area-top 아래
 * - offline: warning subtle / reconnected: success subtle (각 0.15 알파)
 * - 좌측 아이콘 16px(offline=WifiOff / reconnected=Wifi), 14px/500 텍스트, gap-2
 * - entrance 300ms ease-out / exit 225ms ease-in(75% 규칙) — 언마운트는 exit 완료 후
 * - reduce motion 시 opacity fade 만, translate 생략
 *
 * 접근성: `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` —
 * VoiceOver/TalkBack 이 등장 시 자동으로 읽음. 2초 dismiss 전 읽기 완료 보장.
 */

import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WifiIcon, WifiOff } from '@/components/icons';
import {
  getNetworkState,
  subscribeToNetworkState,
  type NetworkState,
} from '@/services/offline/networkState';

type BannerPhase = 'hidden' | 'offline' | 'reconnected';

const BANNER_HEIGHT = 40;
const RECONNECT_DISMISS_MS = 2000;
const ENTRANCE_MS = 300;
const EXIT_MS = 225; // 75% of entrance (impeccable v1 §8)

const TOKENS = {
  dark: {
    offline: { bg: 'rgba(212,160,23,0.15)', icon: '#D4A017' }, // warning subtle
    reconnected: { bg: 'rgba(34,197,94,0.15)', icon: '#22C55E' }, // success subtle
    text: '#F0F0F2', // content-primary dark
  },
  light: {
    offline: { bg: 'rgba(161,98,7,0.15)', icon: '#A16207' },
    reconnected: { bg: 'rgba(22,163,74,0.15)', icon: '#16A34A' },
    text: '#09090B', // content-primary light
  },
} as const;

function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setEnabled(v);
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      if (mounted) setEnabled(v);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return enabled;
}

export function OfflineStatusBar(): React.ReactElement | null {
  const [, setNetworkState] = useState<NetworkState>(() => getNetworkState());
  const [phase, setPhase] = useState<BannerPhase>(() =>
    getNetworkState().isOffline ? 'offline' : 'hidden'
  );
  // exit 애니메이션 동안 렌더를 유지하기 위한 지연 언마운트 플래그
  const [rendered, setRendered] = useState<boolean>(() => getNetworkState().isOffline);
  const prevOnlineRef = useRef<boolean>(getNetworkState().isOnline);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const palette = colorScheme === 'dark' ? TOKENS.dark : TOKENS.light;

  // 실제 transform + opacity
  const translateY = useSharedValue(-BANNER_HEIGHT);
  const opacity = useSharedValue(0);

  // 네트워크 상태 구독
  useEffect(() => {
    const apply = () => {
      const next = getNetworkState();
      setNetworkState(next);

      const wasOnline = prevOnlineRef.current;
      prevOnlineRef.current = next.isOnline;

      if (!next.isOnline) {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
        setPhase('offline');
        return;
      }

      // 온라인 상태 — 방금 복구된 경우 2초 배너
      if (!wasOnline) {
        setPhase('reconnected');
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => {
          setPhase('hidden');
          dismissTimerRef.current = null;
        }, RECONNECT_DISMISS_MS);
      }
    };

    // 첫 마운트 시 현재 상태 반영
    apply();
    const unsub = subscribeToNetworkState(apply);
    return () => {
      unsub();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // 애니메이션 + 지연 언마운트 (exit 225ms 완료 후 실제 제거)
  useEffect(() => {
    const show = phase !== 'hidden';
    const duration = show ? ENTRANCE_MS : EXIT_MS;
    const easing = show ? Easing.out(Easing.quad) : Easing.in(Easing.quad);

    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = show ? 1 : 0;
    } else {
      translateY.value = withTiming(show ? 0 : -BANNER_HEIGHT, { duration, easing });
      opacity.value = withTiming(show ? 1 : 0, { duration, easing });
    }

    if (show) {
      setRendered(true);
      return;
    }
    const unmountTimer = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(unmountTimer);
  }, [phase, reduceMotion, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!rendered) return null;

  // 'hidden'(exit 구간)은 reconnected 다음에만 오므로 reconnected 표기 유지
  const isOfflinePhase = phase === 'offline';
  const phaseTokens = isOfflinePhase ? palette.offline : palette.reconnected;
  const label = isOfflinePhase ? '오프라인 상태입니다' : '온라인으로 돌아왔어요';
  const PhaseIcon = isOfflinePhase ? WifiOff : WifiIcon;

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      pointerEvents="none"
      testID="offline-status-bar"
      style={[
        {
          position: 'absolute',
          top: insets.top,
          left: 0,
          right: 0,
          height: BANNER_HEIGHT,
          backgroundColor: phaseTokens.bg,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      <PhaseIcon size={16} color={phaseTokens.icon} />
      <Text
        numberOfLines={1}
        style={{
          color: palette.text,
          fontSize: 14,
          fontWeight: '500',
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
```

- [ ] **Step 4: 테스트 실행 — 전부 통과 확인**

Run: `cd uniqn-mobile && npx jest src/components/ui/__tests__/OfflineStatusBar.test.tsx --silent`
Expected: PASS — 10 tests (기존 7 중 1 수정 + 신규 3)

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/src/components/ui/OfflineStatusBar.tsx uniqn-mobile/src/components/ui/__tests__/OfflineStatusBar.test.tsx
git commit -m "feat(ui): OfflineStatusBar §25 마감 — 복구 success 톤·Wifi 아이콘·exit 애니메이션 실동작"
```

---

### Task 2: 전역 마운트 교체 + OfflineBanner 완전 삭제

**Files:**
- Modify: `uniqn-mobile/app/_layout.tsx:23,178`
- Modify: `uniqn-mobile/src/components/ui/index.ts:183`
- Delete: `uniqn-mobile/src/components/ui/OfflineBanner.tsx`

**Interfaces:**
- Consumes: `OfflineStatusBar` (Task 1, `@/components/ui` barrel의 기존 export `index.ts:118`)
- Produces: 루트 레이아웃에서 전역 오프라인 오버레이. `OfflineBanner` 심볼은 코드베이스에서 소멸(Task 3의 E2E 스펙 참조만 잔존 허용)

- [ ] **Step 1: `app/_layout.tsx` 수정**

import 블록(19-26행)에서 `OfflineBanner,`를 `OfflineStatusBar,`로 교체:

```tsx
import {
  ErrorState,
  Loading,
  ModalManager,
  OfflineStatusBar,
  ScreenErrorBoundary,
  ToastManager,
} from '@/components/ui';
```

`MainNavigator`의 178행 `<OfflineBanner variant="banner" />`를 **삭제**하고, 오버레이 스태킹이 명확하도록 `<ModalManager />` 뒤(199행)에 마운트:

```tsx
      <ToastManager />
      <ModalManager />
      <OfflineStatusBar />
    </View>
```

- [ ] **Step 2: barrel export 제거**

`src/components/ui/index.ts:183`의 다음 줄 삭제:

```ts
export { OfflineBanner, type OfflineBannerProps } from './OfflineBanner';
```

- [ ] **Step 3: 컴포넌트 파일 삭제**

```bash
git rm uniqn-mobile/src/components/ui/OfflineBanner.tsx
```

- [ ] **Step 4: 잔존 참조 검증**

Run: `cd uniqn-mobile && grep -rn "OfflineBanner" src/ app/ --include="*.ts" --include="*.tsx"`
Expected: **0건** (e2e/는 Task 3에서 처리하므로 이 grep 범위에서 제외됨)

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: exit 0, 에러 0

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/app/_layout.tsx uniqn-mobile/src/components/ui/index.ts
git commit -m "refactor(ui): 전역 오프라인 표시를 OfflineStatusBar 오버레이로 교체 — OfflineBanner 3변형 삭제"
```

---

### Task 3: E2E 스펙 재작성 — 패시브 상태바 기준

**Files:**
- Modify: `uniqn-mobile/e2e/tests/p4-stretch/offline-network.spec.ts`

**Interfaces:**
- Consumes: `testID="offline-status-bar"`(RN-web에서 `data-testid`로 매핑), 라벨 텍스트 `오프라인 상태입니다` / `온라인으로 돌아왔어요` (Task 1)
- Produces: 4개 → 3개 테스트 (재시도 버튼 시나리오 삭제, 복구 배너 auto-dismiss 검증 추가, 느린 네트워크 테스트 유지)

- [ ] **Step 1: 스펙 파일 전체를 다음으로 교체**

기존 `waitForAppReady` 헬퍼와 느린 네트워크 테스트(126-164행)는 그대로 유지하고, 상단 주석과 앞의 3개 테스트를 아래로 교체:

```ts
/**
 * P4 오프라인/네트워크 테스트 (3 tests)
 * 프로젝트: chromium (staff storageState)
 *
 * networkState 싱글톤은 웹에서 window online/offline 이벤트를 감지.
 * OfflineStatusBar(패시브 오버레이)는 루트 레이아웃(_layout.tsx)에서 렌더링됨.
 * 재시도 버튼 없음 — NetInfo 자동 감지 + 재연결 자동 refetch가 복구를 담당.
 */
import { test, expect } from '../../fixtures/base.fixture';

/**
 * 앱이 완전히 초기화될 때까지 대기 (useAppInitialize + 라우트 렌더링)
 * OfflineStatusBar의 networkState 구독이 등록된 상태를 보장
 */
async function waitForAppReady(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  // 앱 초기화 완료 대기 — body에 콘텐츠가 렌더링될 때까지
  await page.waitForTimeout(5_000);
}

async function goOffline(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('offline'));
  });
}

async function goOnline(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event('online'));
  });
}

test.describe('오프라인 & 네트워크', () => {
  test('네트워크 차단 → 오프라인 상태바 표시', async ({ page }) => {
    await waitForAppReady(page);

    await goOffline(page);

    // networkState → OfflineStatusBar 렌더링 대기
    const statusBar = page.getByTestId('offline-status-bar');
    await expect(statusBar).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('오프라인 상태입니다')).toBeVisible();

    // 복구 (다음 테스트 오염 방지)
    await goOnline(page);
  });

  test('네트워크 복구 → 복구 배너 표시 후 자동 dismiss', async ({ page }) => {
    await waitForAppReady(page);

    await goOffline(page);
    await expect(page.getByTestId('offline-status-bar')).toBeVisible({ timeout: 5_000 });

    await goOnline(page);

    // 복구 순간 success 배너로 교체
    await expect(page.getByText('온라인으로 돌아왔어요')).toBeVisible({ timeout: 5_000 });

    // 2초 auto-dismiss + 225ms exit 후 완전히 사라짐
    await expect(page.getByTestId('offline-status-bar')).toBeHidden({ timeout: 6_000 });
  });

  // ⬇ 기존 '느린 네트워크 → 로딩 인디케이터 표시' 테스트는 그대로 유지
```

(파일 끝의 느린 네트워크 테스트와 `});` 닫힘은 기존 코드 그대로 둔다.)

- [ ] **Step 2: 린트/타입 검증**

Run: `cd uniqn-mobile && npx eslint e2e/tests/p4-stretch/offline-network.spec.ts && npx tsc --noEmit`
Expected: 둘 다 exit 0

E2E 실행 자체는 러너 가용 시(웹 dev 서버 필요) — 스펙의 검증 게이트 명시대로 이 계획의 필수 게이트 아님.

- [ ] **Step 3: 잔존 참조 최종 확인**

Run: `cd uniqn-mobile && grep -rn "OfflineBanner\|인터넷 연결이 끊어졌습니다\|재시도" e2e/ src/ app/ --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: OfflineBanner/구 문구 관련 0건 (무관한 '재시도' 문구가 다른 화면에 있으면 해당 건은 무시 — OfflineBanner 유래인지 파일 경로로 판단)

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/e2e/tests/p4-stretch/offline-network.spec.ts
git commit -m "test(e2e): 오프라인 시나리오를 패시브 상태바 기준으로 재작성 — 재시도 버튼 검증 삭제"
```

---

### Task 4: 통합 게이트

**Files:** (변경 없음 — 검증 전용)

- [ ] **Step 1: 품질 게이트**

Run: `cd uniqn-mobile && npm run quality`
Expected: type-check + lint + format:check 모두 exit 0

- [ ] **Step 2: 초점 테스트 스위트**

Run: `cd uniqn-mobile && npx jest src/components/ui/__tests__/OfflineStatusBar.test.tsx --silent`
Expected: 10 passed

- [ ] **Step 3: (메인 세션 전용) 세션 메모리 갱신**

`~/.claude/projects/.../memory/project_offline_ui_decision.md`를 이번 결정(OfflineStatusBar 전역 승격·OfflineBanner 삭제·2026-07-16)으로 갱신. 서브에이전트가 아닌 메인 세션이 수행.
