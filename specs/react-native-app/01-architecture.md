# 01. 아키텍처 설계

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNIQN Mobile App                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Presentation Layer                    │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │ Screens │  │  Modals │  │  Forms  │  │   UI    │    │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │   │
│  └───────┼────────────┼────────────┼────────────┼──────────┘   │
│          │            │            │            │               │
│  ┌───────┴────────────┴────────────┴────────────┴──────────┐   │
│  │                      Hooks Layer                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ useAuth  │  │ useJobs  │  │useSchedule│  ...        │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘              │   │
│  └───────┼─────────────┼─────────────┼─────────────────────┘   │
│          │             │             │                          │
│  ┌───────┴─────────────┴─────────────┴─────────────────────┐   │
│  │                    State Layer                           │   │
│  │  ┌────────────────┐  ┌────────────────────────────┐     │   │
│  │  │  Zustand Store │  │    TanStack Query Cache    │     │   │
│  │  │  (Client State)│  │      (Server State)        │     │   │
│  │  └────────┬───────┘  └────────────┬───────────────┘     │   │
│  └───────────┼───────────────────────┼──────────────────────┘   │
│              │                       │                          │
│  ┌───────────┴───────────────────────┴──────────────────────┐   │
│  │                    Service Layer                          │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │   │
│  │  │  Auth   │  │   Job   │  │Schedule │  │  Admin  │     │   │
│  │  │ Service │  │ Service │  │ Service │  │ Service │     │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘     │   │
│  └───────┼────────────┼────────────┼────────────┼───────────┘   │
│          │            │            │            │               │
│  ┌───────┴────────────┴────────────┴────────────┴───────────┐   │
│  │                    Firebase Layer                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │   │
│  │  │   Auth   │  │ Firestore│  │ Storage  │               │   │
│  │  └──────────┘  └──────────┘  └──────────┘               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 레이어별 책임

### 1. Presentation Layer
```typescript
// 역할: UI 렌더링, 사용자 입력 처리
// 규칙:
// - 비즈니스 로직 금지
// - 직접 Firebase 호출 금지
// - Hooks를 통해서만 데이터 접근

// 예시: JobCard.tsx
export function JobCard({ job, onPress }: JobCardProps) {
  // ✅ UI 로직만
  return (
    <Pressable onPress={() => onPress(job.id)}>
      <Text>{job.title}</Text>
    </Pressable>
  );
}
```

### 2. Hooks Layer
```typescript
// 역할: 상태와 서비스 연결, 로딩/에러 상태 관리
// 규칙:
// - 화면별 커스텀 훅 제공
// - 복잡한 로직은 Service로 위임
// - 캐싱 전략 적용

// 예시: useJobPostings.ts
export function useJobPostings(filters: JobFilters) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['jobPostings', filters],
    queryFn: () => jobPostingService.getFiltered(filters),
    staleTime: 5 * 60 * 1000, // 5분
  });

  return { jobs: data ?? [], isLoading, error };
}
```

### 3. State Layer
```typescript
// Zustand: 클라이언트 전용 상태
// - 테마 설정
// - 사용자 세션
// - UI 상태 (모달, 토스트)

// TanStack Query: 서버 상태
// - 구인공고 목록
// - 스케줄 데이터
// - 알림 목록
```

### 4. Service Layer
```typescript
// 역할: 비즈니스 로직, Firebase 호출
// 규칙:
// - 순수 함수 또는 클래스
// - 단일 책임 원칙
// - 에러 처리 표준화

// 예시: jobPostingService.ts
export const jobPostingService = {
  async getFiltered(filters: JobFilters): Promise<JobPosting[]> {
    const constraints = buildQueryConstraints(filters);
    const snapshot = await getDocs(query(
      collection(db, 'jobPostings'),
      ...constraints
    ));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as JobPosting[];
  },
};
```

---

## 디렉토리 규칙

### 명명 규칙
```
파일명:
├── 컴포넌트: PascalCase.tsx (JobCard.tsx)
├── 훅: camelCase.ts (useJobPostings.ts)
├── 서비스: camelCase.ts (jobPostingService.ts)
├── 타입: camelCase.ts (jobPosting.ts)
├── 유틸리티: camelCase.ts (formatters.ts)
└── 상수: camelCase.ts (colors.ts)

폴더명:
├── 모두 kebab-case (job-posting/)
└── 라우트 그룹: (parentheses) ((tabs)/)
```

### Import 순서
```typescript
// 1. React/React Native
import { useState, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';

// 2. 외부 라이브러리
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. 내부 모듈 (절대 경로)
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { jobPostingService } from '@/services/job';

// 4. 타입
import type { JobPosting } from '@/types';

// 5. 상대 경로 (같은 기능 내)
import { JobCardSkeleton } from './JobCardSkeleton';
```

---

## 의존성 규칙

```
┌─────────────────────────────────────────────┐
│              Presentation                    │
│  (components, screens)                       │
│         │                                    │
│         ▼                                    │
│        Hooks ◄──────────────────────────┐   │
│         │                               │   │
│         ▼                               │   │
│       Stores ◄────── Services           │   │
│         │               │               │   │
│         ▼               ▼               │   │
│              Firebase/API               │   │
│                   │                     │   │
│                   ▼                     │   │
│           Types, Schemas, Utils ────────┘   │
│           (모든 레이어에서 사용 가능)         │
└─────────────────────────────────────────────┘

규칙:
✅ 상위 레이어 → 하위 레이어 의존 가능
✅ 같은 레이어 내 의존 가능
❌ 하위 레이어 → 상위 레이어 의존 금지
❌ Presentation → Firebase 직접 호출 금지
```

---

## Provider 구조 (단순화)

### 기존 (문제점)
```tsx
// ❌ 8단계 중첩 - 복잡하고 디버깅 어려움
<ErrorBoundary>
  <FirebaseErrorBoundary>
    <QueryClientProvider>
      <ThemeProvider>
        <AuthProvider>
          <ChipProvider>
            <MaintenanceModeCheck>
              <CapacitorInitializer>
                <UnifiedDataInitializer>
                  <TournamentProvider>
                    <App />
                  </TournamentProvider>
                </UnifiedDataInitializer>
              </CapacitorInitializer>
            </MaintenanceModeCheck>
          </ChipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </FirebaseErrorBoundary>
</ErrorBoundary>
```

### 개선 (React Native)
```tsx
// ✅ 3단계로 단순화
// app/_layout.tsx
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppContent />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

function AppContent() {
  // Zustand로 테마, 인증 상태 관리 (Provider 불필요)
  const theme = useThemeStore((s) => s.theme);
  const isReady = useAppInitialize(); // 초기화 훅

  if (!isReady) return <SplashScreen />;

  return (
    <ThemeProvider value={theme}>
      <Stack />
      <ModalManager />
      <ToastManager />
    </ThemeProvider>
  );
}
```

### Provider 제거 방안
| 기존 Provider | 대체 방안 |
|--------------|----------|
| AuthProvider | `useAuthStore` (Zustand) |
| ThemeProvider | `useThemeStore` (Zustand) |
| ChipProvider | `useChipStore` (Zustand) |
| TournamentProvider | 제외 (Phase 2) |
| UnifiedDataInitializer | `useAppInitialize` 훅 |

---

## 에러 처리 전략

### 에러 계층
```typescript
// src/utils/errors.ts

// 기본 앱 에러
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string, // 사용자에게 보여줄 메시지
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 인증 에러
export class AuthError extends AppError {
  constructor(code: string, userMessage: string) {
    super(`Auth Error: ${code}`, code, userMessage);
    this.name = 'AuthError';
  }
}

// 권한 에러
export class PermissionError extends AppError {
  constructor(action: string) {
    super(
      `Permission denied: ${action}`,
      'PERMISSION_DENIED',
      '이 작업을 수행할 권한이 없습니다.'
    );
    this.name = 'PermissionError';
  }
}

// 네트워크 에러
export class NetworkError extends AppError {
  constructor() {
    super(
      'Network unavailable',
      'NETWORK_ERROR',
      '네트워크 연결을 확인해주세요.'
    );
    this.name = 'NetworkError';
  }
}
```

### 에러 처리 흐름
```typescript
// Service Layer: 에러 발생 및 변환
async function applyToJob(jobId: string) {
  try {
    await jobPostingService.apply(jobId);
  } catch (error) {
    if (error instanceof FirebaseError) {
      throw new AppError(
        error.message,
        error.code,
        getFirebaseErrorMessage(error.code)
      );
    }
    throw error;
  }
}

// Hooks Layer: 에러 상태 관리
function useApplyJob() {
  const mutation = useMutation({
    mutationFn: applyToJob,
    onError: (error: AppError) => {
      useToastStore.getState().show({
        type: 'error',
        message: error.userMessage,
      });
    },
  });
  return mutation;
}

// Presentation Layer: 에러 표시
function ApplyButton({ jobId }: { jobId: string }) {
  const { mutate, isPending, error } = useApplyJob();

  return (
    <Button
      onPress={() => mutate(jobId)}
      loading={isPending}
    >
      지원하기
    </Button>
  );
}
```

---

## 성능 최적화 전략

### 1. 리스트 가상화
```typescript
// FlashList 사용 (FlatList 대체)
import { FlashList } from '@shopify/flash-list';

function JobList({ jobs }: { jobs: JobPosting[] }) {
  return (
    <FlashList
      data={jobs}
      renderItem={({ item }) => <JobCard job={item} />}
      estimatedItemSize={120} // 예상 아이템 높이
      keyExtractor={(item) => item.id}
    />
  );
}
```

### 2. 이미지 최적화
```typescript
// expo-image 사용
import { Image } from 'expo-image';

function ProfileImage({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: 100, height: 100 }}
      placeholder={blurhash} // 블러 해시
      transition={200}
      cachePolicy="memory-disk"
    />
  );
}
```

### 3. 메모이제이션
```typescript
// 컴포넌트 메모이제이션
const JobCard = memo(function JobCard({ job }: JobCardProps) {
  return <View>...</View>;
});

// 콜백 메모이제이션
const handlePress = useCallback(() => {
  navigation.navigate('JobDetail', { id: job.id });
}, [job.id, navigation]);

// 계산값 메모이제이션
const filteredJobs = useMemo(() =>
  jobs.filter(job => job.status === 'active'),
  [jobs]
);
```

### 4. 번들 최적화
```javascript
// metro.config.js
module.exports = {
  transformer: {
    minifierConfig: {
      compress: {
        drop_console: true, // 프로덕션에서 console 제거
      },
    },
  },
};
```

---

## 플랫폼 레이어 (React Native Web)

> 상세 내용은 [21-react-native-web.md](./21-react-native-web.md) 참조

### 단일 코드베이스 전략

```
┌─────────────────────────────────────────────────────────────────┐
│                   React Native + Expo                           │
│  ┌─────────────┬─────────────┬─────────────┐                   │
│  │     iOS     │   Android   │     Web     │                   │
│  │   (Native)  │  (Native)   │ (RN Web)    │                   │
│  └──────┬──────┴──────┬──────┴──────┬──────┘                   │
│         │             │             │                           │
│  ┌──────┴─────────────┴─────────────┴──────┐                   │
│  │           공유 비즈니스 로직              │  (~95%)          │
│  │     (Services, Hooks, Stores, Utils)     │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                 │
│  ┌──────────────────────────────────────────┐                   │
│  │           플랫폼별 분기 코드              │  (~5%)           │
│  │     (Platform.OS, *.web.tsx 파일)        │                   │
│  └──────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 플랫폼 분기 패턴

```typescript
// 방법 1: 파일 기반 분기
src/components/
├── Button.tsx        // 기본 (iOS/Android)
├── Button.web.tsx    // 웹 전용
└── index.ts          // 자동 선택

// 방법 2: 조건부 분기
import { Platform } from 'react-native';

export function CameraScanner() {
  if (Platform.OS === 'web') {
    return <WebQRScanner />;  // 웹: navigator.mediaDevices
  }
  return <NativeCamera />;    // 네이티브: expo-camera
}
```

### 플랫폼별 차이점

| 기능 | iOS/Android | Web |
|------|-------------|-----|
| **스토리지** | expo-secure-store | localStorage (암호화 없음) |
| **푸시 알림** | FCM + APNS | 미지원 (인앱 알림) |
| **카메라/QR** | expo-camera | navigator.mediaDevices |
| **햅틱** | expo-haptics | 미지원 |
| **생체 인증** | expo-local-authentication | 미지원 |

---

## 테스트 전략

> 상세 내용은 [13-testing-strategy.md](./13-testing-strategy.md) 참조

### 테스트 레벨
```
┌─────────────────────────────────────────────┐
│         E2E Tests                           │
│    - Maestro (iOS/Android)                  │
│    - Playwright (Web)                       │
│    - 10-20개 시나리오                        │
├─────────────────────────────────────────────┤
│       Integration Tests (Jest)              │
│    - 훅 + 서비스 통합                        │
│    - 50-100개 테스트                         │
├─────────────────────────────────────────────┤
│         Unit Tests (Jest)                   │
│    - 유틸리티, 서비스                         │
│    - 200+ 테스트                             │
└─────────────────────────────────────────────┘
```

### 테스트 대상
| 레이어 | 테스트 방식 | 우선순위 |
|--------|------------|----------|
| Utils | Unit Test | P0 |
| Services | Unit Test | P0 |
| Schemas | Unit Test | P0 |
| Hooks | Integration Test | P1 |
| Screens | Snapshot Test | P2 |
| User Flow | E2E Test (Maestro + Playwright) | P1 |
