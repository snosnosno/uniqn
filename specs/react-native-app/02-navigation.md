# 02. 네비게이션 구조 설계

## 네비게이션 라이브러리

**선택: Expo Router v3** (파일 기반 라우팅)

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
app/
├── _layout.tsx                 # 루트 레이아웃
├── index.tsx                   # 시작점 (리다이렉트)
├── +not-found.tsx              # 404 페이지
│
├── (public)/                   # 🌐 비로그인 접근 가능 (Guest)
│   ├── _layout.tsx
│   └── jobs/
│       └── index.tsx           # 공고 목록 (미리보기)
│
├── (auth)/                     # 🔓 인증 화면
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── signup.tsx
│   ├── forgot-password.tsx
│   ├── consent.tsx
│   └── legal/
│       ├── terms.tsx
│       └── privacy.tsx
│
├── (app)/                      # 🔐 로그인 필수 (Staff 이상)
│   ├── _layout.tsx
│   │
│   ├── (tabs)/                 # 📱 하단 탭
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # 구인구직 (홈, 검색/필터 포함)
│   │   ├── schedule.tsx        # 내 스케줄
│   │   ├── qr.tsx              # QR 코드 (출퇴근)
│   │   └── profile.tsx         # 프로필
│   │
│   ├── jobs/                   # 구인구직 상세
│   │   ├── [id].tsx            # 공고 상세 보기 (로그인 필수)
│   │   └── apply/[id].tsx      # 지원하기
│   │
│   ├── schedule/               # 스케줄 상세
│   │   └── [id].tsx            # 스케줄 상세
│   │
│   ├── notifications.tsx       # 알림 목록
│   │
│   ├── settings/               # 설정
│   │   ├── index.tsx           # 설정 메인
│   │   ├── security.tsx        # 보안 설정
│   │   ├── notifications.tsx   # 알림 설정
│   │   └── account.tsx         # 계정 관리
│   │
│   └── support.tsx             # 고객센터
│
├── (employer)/                 # 🏢 구인자 전용 (Employer 이상)
│   ├── _layout.tsx
│   │
│   ├── job-posting/
│   │   ├── index.tsx           # 내 공고 목록
│   │   ├── create.tsx          # 공고 작성
│   │   └── [id]/
│   │       ├── index.tsx       # 공고 상세/수정
│   │       ├── applicants.tsx  # 지원자 관리
│   │       ├── staff.tsx       # 확정 스태프
│   │       ├── shifts.tsx      # 시프트 관리
│   │       └── payroll.tsx     # 정산
│   │
│   └── announcements.tsx       # 공지 발송
│
└── (admin)/                    # 👑 관리자 전용
    ├── _layout.tsx
    ├── users.tsx               # 사용자 관리
    ├── inquiries.tsx           # 문의 관리
    └── approvals.tsx           # 승인 관리
```

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
│  Screen  │                │   홈    │ ─────▶ 검색/필터/상세 가능
└────┬─────┘                └─────────┘
     │
     │ 미인증 (guest)
     ▼
┌─────────────────────────────────────┐
│     (public) 공고 목록               │
│     - 목록만 조회 가능               │
│     - 검색/필터/상세보기 불가         │
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
│           동의 확인                  │
│   (필수 동의 미완료 시)              │
└─────────────────┬───────────────────┘
                  │
                  ▼
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
│  (모달/시트) │                                     │
└──────┬──────┘                                     │
       │                                            │
       │ 지원하기                                    │
       ▼                                            │
┌─────────────┐     성공     ┌─────────────┐       │
│  지원 확인   │ ──────────▶ │  지원 완료   │───────┘
│    모달     │              │   토스트     │
└─────────────┘              └─────────────┘
```

### 3. 공고 관리 플로우 (Employer)
```
┌─────────────────────────────────────────────────────────────┐
│                   공고 관리 플로우                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────┐
│  내 공고    │
│   목록      │
└──────┬──────┘
       │
       ├──────────────────────────────┐
       │ 새 공고                       │ 기존 공고 선택
       ▼                              ▼
┌─────────────┐                ┌─────────────┐
│  공고 작성   │                │  공고 상세   │
│   (Full)    │                │   관리      │
└──────┬──────┘                └──────┬──────┘
       │                              │
       │                              ├───────────────────────┐
       │                              │                       │
       │                              ▼                       ▼
       │                       ┌─────────────┐        ┌─────────────┐
       │                       │  지원자 탭   │        │  확정 탭    │
       │                       └──────┬──────┘        └──────┬──────┘
       │                              │                       │
       │                              ▼                       ▼
       │                       ┌─────────────┐        ┌─────────────┐
       │                       │  확정/거절   │        │  시프트 탭  │
       │                       │   액션      │        └──────┬──────┘
       │                       └─────────────┘               │
       │                                                     ▼
       │                                              ┌─────────────┐
       │                                              │  정산 탭    │
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

### 루트 레이아웃
```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppInitialize } from '@/hooks/useAppInitialize';
import { ModalManager } from '@/components/ui/ModalManager';
import { ToastManager } from '@/components/ui/ToastManager';
import { queryClient } from '@/lib/queryClient';

export default function RootLayout() {
  const { isReady, initialRoute } = useAppInitialize();

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
          initialRouteName={initialRoute}
        >
          <Stack.Screen name="(public)" />   {/* Guest 접근 가능 */}
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />       {/* Staff 이상 */}
          <Stack.Screen name="(employer)" />  {/* Employer 이상 */}
          <Stack.Screen name="(admin)" />     {/* Admin만 */}
        </Stack>
        <ModalManager />
        <ToastManager />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
```

### Public 레이아웃 (Guest 접근 가능)
```tsx
// app/(public)/_layout.tsx
import { Stack } from 'expo-router';
import { GuestJobListHeader } from '@/components/guest/GuestJobListHeader';

/**
 * Guest(비로그인) 사용자가 접근 가능한 공개 영역
 * - 공고 목록만 조회 가능 (검색/필터/상세보기 불가)
 */
export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        animation: 'fade',
      }}
    >
      <Stack.Screen
        name="jobs/index"
        options={{
          title: '구인구직',
          header: () => <GuestJobListHeader />,
        }}
      />
    </Stack>
  );
}
```

### 인증 그룹 레이아웃
```tsx
// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // 이미 인증된 경우 앱으로 리다이렉트
  if (isAuthenticated) {
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
      <Stack.Screen
        name="consent"
        options={{
          gestureEnabled: false, // 뒤로가기 방지
        }}
      />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/privacy" />
    </Stack>
  );
}
```

### 메인 앱 레이아웃
```tsx
// app/(app)/_layout.tsx
import { Stack } from 'expo-router';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function AppLayout() {
  const { isReady, shouldRedirect } = useAuthGuard();

  if (!isReady) return <LoadingScreen />;
  if (shouldRedirect) return <Redirect href="/(auth)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="notifications"
        options={{
          presentation: 'card',
          headerShown: true,
          title: '알림',
        }}
      />
      <Stack.Screen name="settings" />
      <Stack.Screen name="support" />
      <Stack.Screen name="jobs/[id]" />
      <Stack.Screen name="schedule/[id]" />
    </Stack>
  );
}
```

### 탭 레이아웃
```tsx
// app/(app)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { colors } from '@/constants/colors';
import {
  HomeIcon,
  CalendarIcon,
  QrCodeIcon,
  UserIcon,
} from '@/components/icons';

export default function TabLayout() {
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[600],
        tabBarInactiveTintColor: isDark ? colors.gray[400] : colors.gray[500],
        tabBarStyle: {
          backgroundColor: isDark ? colors.gray[900] : colors.white,
          borderTopColor: isDark ? colors.gray[800] : colors.gray[200],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '구인구직',
          tabBarIcon: ({ color, size }) => (
            <HomeIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '내 스케줄',
          tabBarIcon: ({ color, size }) => (
            <CalendarIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          title: 'QR',
          tabBarIcon: ({ color, size }) => (
            <QrCodeIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color, size }) => (
            <UserIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### 구인자(Employer) 레이아웃
```tsx
// app/(employer)/_layout.tsx
import { Stack, Redirect } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Employer(구인자) 전용 레이아웃
 * - staff 권한에서 employer로 업그레이드 필요
 * - 공고 작성/관리, 지원자 확정/거절, 정산 기능
 */
export default function EmployerLayout() {
  const { isEmployer, isLoading } = usePermissions();

  if (isLoading) return <LoadingScreen />;
  if (!isEmployer) return <Redirect href="/(app)/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
      }}
    >
      <Stack.Screen
        name="job-posting/index"
        options={{ title: '내 공고 관리' }}
      />
      <Stack.Screen
        name="job-posting/create"
        options={{ title: '새 공고 작성' }}
      />
      <Stack.Screen
        name="job-posting/[id]/index"
        options={{ title: '공고 상세' }}
      />
      <Stack.Screen
        name="job-posting/[id]/applicants"
        options={{ title: '지원자 관리' }}
      />
      <Stack.Screen
        name="job-posting/[id]/staff"
        options={{ title: '확정 스태프' }}
      />
      <Stack.Screen
        name="job-posting/[id]/shifts"
        options={{ title: '시프트 관리' }}
      />
      <Stack.Screen
        name="job-posting/[id]/payroll"
        options={{ title: '정산' }}
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
  const role = useAuthStore((s) => s.user?.role);

  if (role !== 'admin') {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: '뒤로',
      }}
    >
      <Stack.Screen name="users" options={{ title: '사용자 관리' }} />
      <Stack.Screen name="inquiries" options={{ title: '문의 관리' }} />
      <Stack.Screen name="approvals" options={{ title: '승인 관리' }} />
    </Stack>
  );
}
```

---

## 네비게이션 가드

### useAuthGuard 훅
```typescript
// src/hooks/useAuthGuard.ts
import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

/**
 * 권한 기반 네비게이션 가드
 *
 * 권한 체계:
 * - guest (비로그인): role === null → (public) 영역만 접근
 * - staff (기본 가입자): (app) 영역 접근
 * - employer (구인자): (employer) 영역 접근
 * - admin: 모든 영역 접근
 */
export function useAuthGuard() {
  const segments = useSegments();
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const currentSegment = segments[0];
    const inPublicGroup = currentSegment === '(public)';
    const inAuthGroup = currentSegment === '(auth)';
    const inProtectedGroup = ['(app)', '(employer)', '(admin)'].includes(currentSegment);

    // Guest (비로그인) 상태
    if (!isAuthenticated) {
      if (inProtectedGroup) {
        // 보호된 영역 접근 시도 → 공개 영역으로
        router.replace('/(public)/jobs');
      }
      setIsReady(true);
      return;
    }

    // 인증된 상태에서 인증/공개 영역 접근
    if (isAuthenticated && (inAuthGroup || inPublicGroup)) {
      if (!user?.consentCompleted) {
        router.replace('/(auth)/consent');
      } else if (!user?.profileCompleted) {
        router.replace('/(app)/(tabs)/profile');
      } else {
        router.replace('/(app)/(tabs)');
      }
    }

    setIsReady(true);
  }, [isAuthenticated, isLoading, segments, user]);

  return {
    isReady,
    shouldRedirect: !isAuthenticated,
    isGuest: !isAuthenticated,
  };
}
```

### usePermissions 훅
```typescript
// src/hooks/usePermissions.ts
import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * 역할 타입 정의
 * - guest는 role이 null (비로그인 상태)
 */
type UserRole = 'staff' | 'employer' | 'admin';

/**
 * 역할 계층 (높을수록 상위 권한)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,     // 시스템 관리자
  employer: 50,   // 구인자 (공고 관리)
  staff: 10,      // 기본 가입자 (지원, 출퇴근)
  // guest: 0     // 비로그인 (role === null)
};

export function usePermissions() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const role = user?.role as UserRole | null;

  const permissions = useMemo(() => {
    // Guest (비로그인) - 공고 목록만 조회 가능
    if (!isAuthenticated || role === null) {
      return {
        isGuest: true,
        isStaff: false,
        isEmployer: false,
        isAdmin: false,
        canViewJobList: true,    // 목록 조회만 가능
        canSearchJobs: false,    // 검색 불가
        canFilterJobs: false,    // 필터 불가
        canViewJobDetail: false, // 상세보기 불가
        canApplyToJob: false,
        canCheckIn: false,
        canCheckOut: false,
        canViewSchedule: false,
        canCreateJobPosting: false,
        canManageApplicants: false,
        canSettlePayment: false,
        canManageUsers: false,
        canViewAdminPanel: false,
      };
    }

    const level = ROLE_HIERARCHY[role] ?? 0;

    return {
      // 역할 플래그
      isGuest: false,
      isStaff: level >= ROLE_HIERARCHY.staff,
      isEmployer: level >= ROLE_HIERARCHY.employer,
      isAdmin: role === 'admin',

      // Staff 권한 (로그인 사용자 기본)
      canViewJobList: true,
      canSearchJobs: true,
      canFilterJobs: true,
      canViewJobDetail: true,
      canApplyToJob: level >= ROLE_HIERARCHY.staff,
      canCheckIn: level >= ROLE_HIERARCHY.staff,
      canCheckOut: level >= ROLE_HIERARCHY.staff,
      canViewSchedule: level >= ROLE_HIERARCHY.staff,

      // Employer 권한
      canCreateJobPosting: level >= ROLE_HIERARCHY.employer,
      canManageApplicants: level >= ROLE_HIERARCHY.employer,
      canSettlePayment: level >= ROLE_HIERARCHY.employer,

      // Admin 권한
      canManageUsers: role === 'admin',
      canViewAdminPanel: role === 'admin',

      // 리소스별 권한 체크
      canEditJobPosting: (creatorId: string) =>
        role === 'admin' || user?.uid === creatorId,
      canManageJobApplicants: (creatorId: string) =>
        level >= ROLE_HIERARCHY.employer &&
        (role === 'admin' || user?.uid === creatorId),
    };
  }, [role, user?.uid, isAuthenticated]);

  return { ...permissions, isLoading, role };
}
```

### 로그인 유도 컴포넌트
```typescript
// src/components/guest/LoginPrompt.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LockClosedIcon } from '@/components/icons';

interface LoginPromptProps {
  message?: string;
  actionLabel?: string;
}

/**
 * Guest 사용자에게 로그인 유도하는 컴포넌트
 * 검색, 필터, 상세보기 등 로그인 필요 기능에서 사용
 */
export function LoginPrompt({
  message = '이 기능을 사용하려면 로그인이 필요합니다',
  actionLabel = '로그인하기',
}: LoginPromptProps) {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <LockClosedIcon className="w-16 h-16 text-gray-400 mb-4" />
      <Text className="text-gray-600 dark:text-gray-400 text-center mb-6">
        {message}
      </Text>
      <TouchableOpacity
        className="bg-primary-600 px-6 py-3 rounded-lg"
        onPress={() => router.push('/(auth)/login')}
      >
        <Text className="text-white font-semibold">{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 딥 링크 설정

> **상세 가이드**: [17-deep-linking.md](./17-deep-linking.md) 참조
> - Universal Links (iOS) / App Links (Android) 상세 설정
> - 알림 탭 처리
> - 공유 기능 구현
> - 웹 플랫폼 지원

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
uniqn://schedule/[id]                 → /(app)/schedule/[id]
uniqn://notifications                 → /(app)/notifications
uniqn://profile                       → /(app)/(tabs)/profile
uniqn://settings                      → /(app)/settings
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
  toApply: (id: string) => router.push(`/(app)/jobs/apply/${id}`),

  // 스케줄
  toSchedule: () => router.push('/(app)/(tabs)/schedule'),
  toScheduleDetail: (id: string) => router.push(`/(app)/schedule/${id}`),

  // 프로필
  toProfile: () => router.push('/(app)/(tabs)/profile'),

  // 설정
  toSettings: () => router.push('/(app)/settings'),
  toSecuritySettings: () => router.push('/(app)/settings/security'),

  // 알림
  toNotifications: () => router.push('/(app)/notifications'),

  // 공고 관리 (Employer)
  toMyJobPostings: () => router.push('/(employer)/job-posting'),
  toCreateJobPosting: () => router.push('/(employer)/job-posting/create'),
  toJobPostingDetail: (id: string) =>
    router.push(`/(employer)/job-posting/${id}`),
  toApplicants: (id: string) =>
    router.push(`/(employer)/job-posting/${id}/applicants`),

  // 관리자
  toAdminUsers: () => router.push('/(admin)/users'),
  toAdminInquiries: () => router.push('/(admin)/inquiries'),

  // 인증
  toLogin: () => router.replace('/(auth)/login'),
  toSignup: () => router.push('/(auth)/signup'),

  // 뒤로가기
  back: () => router.back(),
  canGoBack: () => router.canGoBack(),
};
```
