# 02. 네비게이션 구조 설계

## 네비게이션 라이브러리

**선택: Expo Router v6** (파일 기반 라우팅)

### 선택 이유
| 장점 | 설명 |
|------|------|
| 파일 기반 라우팅 | Next.js 스타일, 직관적 구조 |
| 타입 안전성 | 자동 타입 생성 |
| Deep Linking | 자동 설정 |
| 웹 지원 | SEO 친화적 URL |
| 공식 지원 | Expo 팀 유지보수 |

---

## 전체 네비게이션 맵

```
app/                               # 총 64개 라우트
├── _layout.tsx                    # 루트 레이아웃 (5단계 Provider)
├── index.tsx                      # 시작점 (스플래시/리다이렉트)
├── +not-found.tsx                 # 404 페이지
│
├── (public)/                      # 🌐 비로그인 접근 가능 (3개)
│   ├── _layout.tsx
│   └── jobs/
│       ├── index.tsx              # 공고 목록 (미리보기)
│       └── [id].tsx               # 공고 상세 (읽기 전용)
│
├── (auth)/                        # 🔓 인증 화면 (4개)
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── signup.tsx
│   └── forgot-password.tsx
│
├── (app)/                         # 🔐 로그인 필수 (33개)
│   ├── _layout.tsx
│   │
│   ├── (tabs)/                    # 📱 하단 탭 (5개 + 레이아웃)
│   │   ├── _layout.tsx
│   │   ├── index.tsx              # 구인구직 (홈)
│   │   ├── schedule.tsx           # 내 스케줄
│   │   ├── qr.tsx                 # QR 코드 (탭바 숨김, 상단 버튼 접근)
│   │   ├── employer.tsx           # 내 공고 (구인자 탭)
│   │   └── profile.tsx            # 프로필
│   │
│   ├── jobs/                      # 구인구직 상세 (3개)
│   │   ├── _layout.tsx
│   │   └── [id]/
│   │       ├── index.tsx          # 공고 상세
│   │       └── apply.tsx          # 지원하기
│   │
│   ├── applications/              # 지원 관리 (2개)
│   │   ├── _layout.tsx
│   │   └── [id]/
│   │       └── cancel.tsx         # 지원 취소
│   │
│   ├── notices/                   # 공지사항 (3개)
│   │   ├── _layout.tsx
│   │   ├── index.tsx              # 공지 목록
│   │   └── [id].tsx               # 공지 상세
│   │
│   ├── notifications.tsx          # 알림 목록
│   │
│   ├── settings/                  # 설정 (10개)
│   │   ├── _layout.tsx
│   │   ├── index.tsx              # 설정 메인
│   │   ├── profile.tsx            # 프로필 수정
│   │   ├── change-password.tsx    # 비밀번호 변경
│   │   ├── delete-account.tsx     # 계정 삭제
│   │   ├── privacy.tsx            # 개인정보처리방침
│   │   ├── terms.tsx              # 이용약관
│   │   ├── employer-terms.tsx     # 구인자 약관
│   │   ├── liability-waiver.tsx   # 면책조항
│   │   └── my-data.tsx            # 내 데이터 관리
│   │
│   ├── support/                   # 고객지원 (6개)
│   │   ├── _layout.tsx
│   │   ├── index.tsx              # 고객지원 메인
│   │   ├── faq.tsx                # FAQ
│   │   ├── create-inquiry.tsx     # 문의 작성
│   │   ├── my-inquiries.tsx       # 내 문의 목록
│   │   └── inquiry/
│   │       └── [id].tsx           # 문의 상세
│   │
│   └── employer-register.tsx      # 구인자 등록
│
├── (employer)/                    # 🏢 구인자 전용 (9개)
│   ├── _layout.tsx
│   └── my-postings/
│       ├── index.tsx              # 내 공고 목록
│       ├── create.tsx             # 공고 작성
│       └── [id]/
│           ├── _layout.tsx
│           ├── index.tsx          # 공고 상세
│           ├── edit.tsx           # 공고 수정
│           ├── applicants.tsx     # 지원자 관리
│           ├── cancellation-requests.tsx  # 취소 요청 관리
│           └── settlements.tsx    # 정산
│
└── (admin)/                       # 👑 관리자 전용 (17개)
    ├── _layout.tsx
    ├── index.tsx                  # 관리자 대시보드
    ├── settings.tsx               # 관리자 설정
    │
    ├── users/                     # 사용자 관리
    │   ├── index.tsx
    │   └── [id].tsx               # 사용자 상세
    │
    ├── announcements/             # 공지 관리
    │   ├── index.tsx
    │   ├── create.tsx
    │   └── [id]/
    │       ├── index.tsx
    │       └── edit.tsx
    │
    ├── inquiries/                 # 문의 관리
    │   ├── index.tsx
    │   └── [id].tsx
    │
    ├── reports/                   # 신고 관리
    │   ├── index.tsx
    │   └── [id].tsx
    │
    ├── tournaments/               # 대회공고 승인
    │   └── index.tsx
    │
    └── stats/                     # 통계
        └── index.tsx
```

---

## 라우트 그룹별 권한

| 그룹 | 권한 | 라우트 수 | 주요 화면 |
|------|------|----------|----------|
| `(public)` | 없음 (Guest) | 3개 | 공고 목록/상세 (읽기 전용) |
| `(auth)` | 없음 (비로그인) | 4개 | 로그인, 회원가입, 비밀번호 찾기 |
| `(app)` | staff+ | 33개 | 탭, 공고 지원, 스케줄, 설정 |
| `(employer)` | employer+ | 9개 | 공고 관리, 지원자 관리, 정산 |
| `(admin)` | admin | 17개 | 사용자/공지/문의/신고/통계 |

**총 64개 라우트** (레이아웃 파일 제외 시 약 50개 화면)

---

## 화면 흐름도

### 1. 인증 플로우 (권한 체계 반영)
```
┌─────────────────────────────────────────────────────────────┐
│                     인증 플로우                              │
│  권한: guest(비로그인) < staff(가입자) < employer < admin    │
└─────────────────────────────────────────────────────────────┘

앱 시작
    │
    ▼
┌─────────┐     인증됨      ┌─────────┐
│  Splash  │ ─────────────▶ │ (tabs)  │
│  Screen  │                │   홈    │ ─────▶ 검색/필터/상세/지원 가능
└────┬─────┘                └─────────┘
     │
     │ 미인증 (guest)
     ▼
┌─────────────────────────────────────┐
│     (public) 공고 목록/상세          │
│     - 목록/상세 조회 가능            │
│     - 검색/필터 가능                 │
│     - 지원하기 불가                  │
└─────────────────┬───────────────────┘
                  │
                  │ 로그인 필요 기능 클릭
                  ▼
┌─────────┐                 ┌─────────┐
│  Login  │ ◀─────────────▶ │ SignUp  │
└────┬────┘                 └────┬────┘
     │                           │
     │ 로그인 성공                │ 회원가입 (→ staff 기본)
     │                           │
     ▼                           ▼
┌─────────────────────────────────────┐
│          프로필 완성 확인            │
│   (필수 정보 미입력 시)              │
└─────────────────┬───────────────────┘
                  │
                  ▼
            ┌─────────┐
            │ (tabs)  │
            │   홈    │ ─────▶ 모든 기능 사용 가능
            └─────────┘
```

### 2. 구인구직 플로우
```
┌─────────────────────────────────────────────────────────────┐
│                   구인구직 플로우                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────┐
│  구인구직    │ ◀──────────────────────────────────┐
│  (탭 홈)    │                                     │
└──────┬──────┘                                     │
       │                                            │
       │ 공고 선택                                   │
       ▼                                            │
┌─────────────┐                                     │
│  공고 상세   │                                     │
│  jobs/[id]  │                                     │
└──────┬──────┘                                     │
       │                                            │
       │ 지원하기                                    │
       ▼                                            │
┌─────────────┐     성공     ┌─────────────┐       │
│  지원 화면   │ ──────────▶ │  지원 완료   │───────┘
│ jobs/[id]/  │              │   토스트     │
│   apply     │              └─────────────┘
└─────────────┘
```

### 3. 공고 관리 플로우 (Employer)
```
┌─────────────────────────────────────────────────────────────┐
│                   공고 관리 플로우                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────┐
│  내 공고 탭  │ ──────▶ (employer)/my-postings
│  (employer)  │
└──────┬──────┘
       │
       ├──────────────────────────────┐
       │ 새 공고                       │ 기존 공고 선택
       ▼                              ▼
┌─────────────┐                ┌─────────────┐
│  공고 작성   │                │  공고 상세   │
│  /create    │                │   /[id]     │
└──────┬──────┘                └──────┬──────┘
       │                              │
       │                              ├───────────────────────┐
       │                              │                       │
       │                              ▼                       ▼
       │                       ┌─────────────┐        ┌─────────────┐
       │                       │  지원자 탭   │        │  수정 탭    │
       │                       │ /applicants │        │   /edit     │
       │                       └──────┬──────┘        └─────────────┘
       │                              │
       │                              ▼
       │                       ┌─────────────┐        ┌─────────────┐
       │                       │  확정/거절   │        │  취소 요청   │
       │                       │   액션      │        │ /cancel...  │
       │                       └─────────────┘        └──────┬──────┘
       │                                                     │
       │                                                     ▼
       │                                              ┌─────────────┐
       │                                              │  정산 탭    │
       │                                              │ /settlements│
       │                                              └─────────────┘
       │
       ▼
┌─────────────┐     승인 대기     ┌─────────────┐
│  작성 완료   │ ───────────────▶ │  승인 대기   │
│             │                  │    상태     │
└─────────────┘                  └─────────────┘
```

---

## 레이아웃 파일 구현

### 루트 레이아웃 (5단계 Provider)
```tsx
// app/_layout.tsx
import '../global.css';
import { useEffect, useRef, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { colorScheme as nativeWindColorScheme } from 'nativewind';
import { queryClient } from '@/lib/queryClient';
import { isWeb } from '@/utils/platform';
import {
  ToastManager,
  ModalManager,
  ErrorState,
  ScreenErrorBoundary,
  InAppMessageManager,
  OfflineBanner,
} from '@/components/ui';
import { useAppInitialize } from '@/hooks/useAppInitialize';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useNavigationTracking } from '@/hooks/useNavigationTracking';
import { useNotificationHandler } from '@/hooks/useNotificationHandler';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useThemeStore } from '@/stores/themeStore';
import { RealtimeManager } from '@/shared/realtime/RealtimeManager';
import * as tokenRefreshService from '@/services/tokenRefreshService';

/**
 * 메인 네비게이터
 * - 초기화 완료 후 렌더링
 * - 전역 훅: useAuthGuard, useNavigationTracking, useNotificationHandler
 */
function MainNavigator() {
  const { mode, isDarkMode } = useThemeStore();
  const isDark = isDarkMode;

  // NativeWind colorScheme 적용
  useEffect(() => {
    const effectiveMode = mode === 'system'
      ? (isDark ? 'dark' : 'light')
      : mode;
    nativeWindColorScheme.set(effectiveMode);
  }, [mode, isDark]);

  useAuthGuard();
  useNavigationTracking();
  useNotificationHandler();

  // 네트워크 상태 연동 (재연결 처리)
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef(isOnline);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!wasOnline && isOnline) {
      RealtimeManager.onNetworkReconnect();
      tokenRefreshService.onNetworkReconnect();
    } else if (wasOnline && !isOnline) {
      RealtimeManager.onNetworkDisconnect();
    }
  }, [isOnline]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner variant="banner" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: isDark ? '#1A1625' : '#f9fafb',
          },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(employer)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <InAppMessageManager />
      <ToastManager />
      <ModalManager />
    </>
  );
}

/**
 * 앱 콘텐츠 - 초기화 상태 관리
 */
function AppContent() {
  const { isInitialized, isLoading, error, retry } = useAppInitialize();

  if (isLoading || !isInitialized) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-surface-dark">
        <ActivityIndicator size="large" color="#A855F7" />
        <Text className="mt-4 text-gray-600 dark:text-gray-400">앱 로딩 중...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-white dark:bg-surface-dark">
        <ErrorState
          error={error}
          title="앱을 불러올 수 없습니다"
          onRetry={retry}
        />
      </View>
    );
  }

  return (
    <ScreenErrorBoundary name="RootLayout">
      <MainNavigator />
    </ScreenErrorBoundary>
  );
}

// 플랫폼별 Provider 선택 (웹에서 BottomSheet 미사용)
function WebSheetProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
const SheetProvider = isWeb ? WebSheetProvider : BottomSheetModalProvider;

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SheetProvider>
            <AppContent />
          </SheetProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

### Provider 구조 (5단계)
```
┌───────────────────────────────────────────────────┐
│ GestureHandlerRootView                            │
│  └─ SafeAreaProvider                              │
│      └─ QueryClientProvider                       │
│          └─ BottomSheetModalProvider (native)     │
│              └─ AppContent                        │
│                  ├─ MainNavigator (Stack)         │
│                  ├─ InAppMessageManager           │
│                  ├─ ToastManager                  │
│                  ├─ ModalManager                  │
│                  └─ OfflineBanner                 │
└───────────────────────────────────────────────────┘
```

### Public 레이아웃 (Guest 접근 가능)
```tsx
// app/(public)/_layout.tsx
import { Stack } from 'expo-router';

/**
 * Guest(비로그인) 사용자가 접근 가능한 공개 영역
 * - 공고 목록/상세 조회 가능
 * - 지원하기 시 로그인 유도
 */
export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="jobs/index" />
      <Stack.Screen name="jobs/[id]" />
    </Stack>
  );
}
```

### 인증 그룹 레이아웃
```tsx
// app/(auth)/_layout.tsx
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const { status } = useAuthStore();

  // 이미 인증된 경우 앱으로 리다이렉트
  if (status === 'authenticated') {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
```

### 메인 앱 레이아웃
```tsx
// app/(app)/_layout.tsx
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner, NetworkErrorBoundary } from '@/components/ui';

export default function AppLayout() {
  const { status } = useAuthStore();

  if (status === 'loading') return <LoadingSpinner />;
  if (status !== 'authenticated') return <Redirect href="/(auth)/login" />;

  return (
    <NetworkErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="jobs" />
        <Stack.Screen name="applications" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="support" />
        <Stack.Screen name="notices" />
        <Stack.Screen name="employer-register" />
      </Stack>
    </NetworkErrorBoundary>
  );
}
```

### 탭 레이아웃 (5개 탭)
```tsx
// app/(app)/(tabs)/_layout.tsx
import { useEffect } from 'react';
import { Tabs, useNavigation } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, CalendarIcon, BriefcaseIcon, UserIcon } from '@/components/icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // 웹에서 탭 전환 시 aria-hidden 포커스 충돌 방지
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const unsubscribe = navigation.addListener('state', () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#A855F7',  // 프리미엄 퍼플
        tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
        tabBarStyle: {
          backgroundColor: isDark ? '#1A1625' : '#ffffff',
          borderTopColor: isDark ? '#2D2438' : '#e5e7eb',
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '구인구직',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '내 스케줄',
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          href: null,  // 탭바에서 숨김 (상단 버튼으로 접근)
        }}
      />
      <Tabs.Screen
        name="employer"
        options={{
          title: '내 공고',
          tabBarIcon: ({ color, size }) => <BriefcaseIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
```

**탭 구성**:
| 탭 | 화면 | 아이콘 | 비고 |
|---|------|-------|------|
| 구인구직 | index.tsx | HomeIcon | 홈 화면 |
| 내 스케줄 | schedule.tsx | CalendarIcon | 확정된 스케줄 |
| QR | qr.tsx | - | `href: null` (탭바 숨김) |
| 내 공고 | employer.tsx | BriefcaseIcon | 구인자 전용 탭 |
| 프로필 | profile.tsx | UserIcon | 사용자 정보 |

### 구인자(Employer) 레이아웃
```tsx
// app/(employer)/_layout.tsx
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui';

export default function EmployerLayout() {
  const { status, isEmployer } = useAuthStore();

  if (status === 'loading') return <LoadingSpinner />;
  if (status !== 'authenticated') return <Redirect href="/(auth)/login" />;
  if (!isEmployer) return <Redirect href="/(app)/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
      }}
    >
      <Stack.Screen
        name="my-postings/index"
        options={{ title: '내 공고 관리' }}
      />
      <Stack.Screen
        name="my-postings/create"
        options={{ title: '새 공고 작성' }}
      />
      <Stack.Screen
        name="my-postings/[id]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
```

### 관리자 레이아웃
```tsx
// app/(admin)/_layout.tsx
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLayout() {
  const { status, isAdmin } = useAuthStore();

  if (status !== 'authenticated' || !isAdmin) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
      }}
    >
      <Stack.Screen name="index" options={{ title: '관리자' }} />
      <Stack.Screen name="users" options={{ title: '사용자 관리' }} />
      <Stack.Screen name="announcements" options={{ title: '공지 관리' }} />
      <Stack.Screen name="inquiries" options={{ title: '문의 관리' }} />
      <Stack.Screen name="reports" options={{ title: '신고 관리' }} />
      <Stack.Screen name="tournaments" options={{ title: '대회공고 승인' }} />
      <Stack.Screen name="stats" options={{ title: '통계' }} />
      <Stack.Screen name="settings" options={{ title: '관리자 설정' }} />
    </Stack>
  );
}
```

---

## 네비게이션 가드

### useAuthGuard 훅
```typescript
// src/hooks/useAuthGuard.ts
import { useEffect, useCallback } from 'react';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

/**
 * 전역 인증 가드
 * - 라우트 그룹별 권한 체크
 * - 자동 리다이렉트
 */
export function useAuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { status, isAdmin, isEmployer, user } = useAuthStore();

  const checkAccess = useCallback(() => {
    if (status === 'loading' || status === 'idle') return;

    const rootSegment = segments[0] as string;
    const isAuthenticated = status === 'authenticated';

    // (public) - 항상 접근 가능
    if (rootSegment === '(public)') return;

    // (auth) - 인증된 사용자는 앱으로 리다이렉트
    if (rootSegment === '(auth)') {
      if (isAuthenticated) {
        router.replace('/(app)/(tabs)');
      }
      return;
    }

    // (app), (employer), (admin) - 인증 필요
    if (!isAuthenticated) {
      logger.info('미인증 접근 시도', { pathname });
      router.replace('/(auth)/login');
      return;
    }

    // (employer) - employer 권한 필요
    if (rootSegment === '(employer)' && !isEmployer) {
      logger.warn('employer 권한 부족', { pathname });
      router.replace('/(app)/(tabs)');
      return;
    }

    // (admin) - admin 권한 필요
    if (rootSegment === '(admin)' && !isAdmin) {
      logger.warn('admin 권한 부족', { pathname });
      router.replace('/(app)/(tabs)');
      return;
    }
  }, [status, segments, pathname, isAdmin, isEmployer, router]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);
}
```

### useHasRole 훅
```typescript
// src/hooks/useHasRole.ts
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  employer: 50,
  manager: 30,
  staff: 10,
  user: 1,
};

/**
 * 특정 역할 이상의 권한 보유 여부 확인
 */
export function useHasRole(requiredRole: UserRole): boolean {
  const { profile } = useAuthStore();

  return useMemo(() => {
    if (!profile?.role) return false;
    const userLevel = ROLE_HIERARCHY[profile.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
    return userLevel >= requiredLevel;
  }, [profile?.role, requiredRole]);
}
```

---

## 딥 링크 설정

> **상세 가이드**: [17-deep-linking.md](./17-deep-linking.md) 참조

### URL 스킴 설정
```json
// app.json
{
  "expo": {
    "scheme": "uniqn",
    "ios": {
      "bundleIdentifier": "com.uniqn.app",
      "associatedDomains": ["applinks:uniqn.app"]
    },
    "android": {
      "package": "com.uniqn.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "uniqn.app",
              "pathPrefix": "/"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### 딥 링크 매핑
```
URL                                    → Screen
────────────────────────────────────────────────────────
uniqn://                              → /(app)/(tabs)
uniqn://jobs                          → /(app)/(tabs)
uniqn://jobs/[id]                     → /(app)/jobs/[id]
uniqn://schedule                      → /(app)/(tabs)/schedule
uniqn://notifications                 → /(app)/notifications
uniqn://profile                       → /(app)/(tabs)/profile
uniqn://settings                      → /(app)/settings
uniqn://employer/postings             → /(employer)/my-postings
uniqn://employer/postings/[id]        → /(employer)/my-postings/[id]
```

---

## 네비게이션 유틸리티

### 타입 안전한 네비게이션
```typescript
// src/utils/navigation.ts
import { router } from 'expo-router';

export const navigation = {
  // 구인구직
  toJobs: () => router.push('/(app)/(tabs)'),
  toJobDetail: (id: string) => router.push(`/(app)/jobs/${id}`),
  toApply: (id: string) => router.push(`/(app)/jobs/${id}/apply`),

  // 스케줄
  toSchedule: () => router.push('/(app)/(tabs)/schedule'),

  // 프로필
  toProfile: () => router.push('/(app)/(tabs)/profile'),
  toEditProfile: () => router.push('/(app)/settings/profile'),

  // 설정
  toSettings: () => router.push('/(app)/settings'),
  toChangePassword: () => router.push('/(app)/settings/change-password'),

  // 알림
  toNotifications: () => router.push('/(app)/notifications'),

  // 고객지원
  toSupport: () => router.push('/(app)/support'),
  toCreateInquiry: () => router.push('/(app)/support/create-inquiry'),

  // 공지사항
  toNotices: () => router.push('/(app)/notices'),
  toNoticeDetail: (id: string) => router.push(`/(app)/notices/${id}`),

  // 공고 관리 (Employer)
  toEmployerTab: () => router.push('/(app)/(tabs)/employer'),
  toMyPostings: () => router.push('/(employer)/my-postings'),
  toCreatePosting: () => router.push('/(employer)/my-postings/create'),
  toPostingDetail: (id: string) =>
    router.push(`/(employer)/my-postings/${id}`),
  toApplicants: (id: string) =>
    router.push(`/(employer)/my-postings/${id}/applicants`),
  toSettlements: (id: string) =>
    router.push(`/(employer)/my-postings/${id}/settlements`),

  // 관리자
  toAdminDashboard: () => router.push('/(admin)'),
  toAdminUsers: () => router.push('/(admin)/users'),
  toAdminAnnouncements: () => router.push('/(admin)/announcements'),
  toAdminInquiries: () => router.push('/(admin)/inquiries'),
  toAdminReports: () => router.push('/(admin)/reports'),
  toAdminTournaments: () => router.push('/(admin)/tournaments'),
  toAdminStats: () => router.push('/(admin)/stats'),

  // 인증
  toLogin: () => router.replace('/(auth)/login'),
  toSignup: () => router.push('/(auth)/signup'),
  toForgotPassword: () => router.push('/(auth)/forgot-password'),

  // Public
  toPublicJobs: () => router.push('/(public)/jobs'),
  toPublicJobDetail: (id: string) => router.push(`/(public)/jobs/${id}`),

  // 뒤로가기
  back: () => router.back(),
  canGoBack: () => router.canGoBack(),
};
```

---

## 라우트별 전역 훅 사용

| 훅 | 위치 | 역할 |
|----|------|------|
| `useAppInitialize` | AppContent | Firebase 초기화, 인증 상태 복원 |
| `useAuthGuard` | MainNavigator | 라우트별 권한 체크, 자동 리다이렉트 |
| `useNavigationTracking` | MainNavigator | Analytics 화면 전환 추적 |
| `useNotificationHandler` | MainNavigator | 푸시 알림 수신 및 딥링크 처리 |
| `useNetworkStatus` | MainNavigator | 네트워크 상태 감지, 재연결 처리 |

---

*마지막 업데이트: 2026-02-01*
*Expo Router 버전: v6.0.19*
*총 라우트 수: 64개*
