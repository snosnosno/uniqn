# 01. 아키텍처 설계

> **마지막 업데이트**: 2026년 2월

## 전체 아키텍처 (7단계 레이어)

```
┌─────────────────────────────────────────────────────────────────┐
│                        UNIQN Mobile App                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Presentation Layer                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │ app/    │  │Components│  │  Modals │  │   UI    │    │   │
│  │  │ (68개)  │  │ (245개) │  │         │  │         │    │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │   │
│  └───────┼────────────┼────────────┼────────────┼──────────┘   │
│          │            │            │            │               │
│  ┌───────┴────────────┴────────────┴────────────┴──────────┐   │
│  │                      Hooks Layer (49개)                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│   │
│  │  │ useAuth  │  │ useJobs  │  │useSchedule│  │useSettle ││   │
│  │  │ +Guard   │  │ +Detail  │  │ (8함수)  │  │ (10함수) ││   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘│   │
│  └───────┼─────────────┼─────────────┼─────────────┼───────┘   │
│          │             │             │             │            │
│  ┌───────┴─────────────┴─────────────┴─────────────┴────────┐  │
│  │                    State Layer                            │  │
│  │  ┌────────────────┐  ┌────────────────────────────┐      │  │
│  │  │ Zustand (8개)  │  │  TanStack Query (14도메인)  │      │  │
│  │  │ auth, theme,   │  │  Query Keys 중앙 관리      │      │  │
│  │  │ toast, modal.. │  │  캐싱 정책 적용            │      │  │
│  │  └────────┬───────┘  └────────────┬───────────────┘      │  │
│  └───────────┼───────────────────────┼───────────────────────┘  │
│              │                       │                          │
│  ┌───────────┴───────────────────────┴──────────────────────┐  │
│  │                   Shared Layer (26개)                     │  │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌──────────┐ │  │
│  │  │IdNormalizer│ │RoleResolver│ │StatusMapper│ │TimeNorm │ │  │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └────┬─────┘ │  │
│  └────────┼─────────────┼─────────────┼────────────┼────────┘  │
│           │             │             │            │            │
│  ┌────────┴─────────────┴─────────────┴────────────┴────────┐  │
│  │                   Service Layer (43개)                    │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │  │
│  │  │  Auth   │  │   Job   │  │Schedule │  │Settlement│     │  │
│  │  │ Service │  │ Service │  │ Service │  │ Service │     │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘     │  │
│  └───────┼────────────┼────────────┼────────────┼───────────┘  │
│          │            │            │            │               │
│  ┌───────┴────────────┴────────────┴────────────┴───────────┐  │
│  │                  Repository Layer (22개)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ Application │  │ JobPosting  │  │  WorkLog    │      │  │
│  │  │ Repository  │  │ Repository  │  │ Repository  │      │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │  │
│  └─────────┼────────────────┼────────────────┼──────────────┘  │
│            │                │                │                  │
│  ┌─────────┴────────────────┴────────────────┴──────────────┐  │
│  │              Firebase Layer (Web SDK 12.6.0)              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │   Auth   │  │ Firestore│  │ Storage  │  │ Functions│ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Domains Layer (비즈니스 로직 분리 - 14개 파일)

```
domains/
├── index.ts                      # 배럴 export
├── application/                  # 지원 상태 관리
│   ├── ApplicationStatusMachine.ts  # 상태 전이 로직
│   ├── ApplicationValidator.ts      # 지원 검증
│   └── index.ts
├── job/                          # 공고 도메인
│   └── index.ts
├── schedule/                     # 스케줄 도메인
│   ├── ScheduleMerger.ts         # WorkLogs + Applications 병합
│   ├── ScheduleConverter.ts      # 데이터 변환
│   ├── WorkLogCreator.ts         # 근무기록 생성
│   └── index.ts
├── settlement/                   # 정산 도메인
│   ├── SettlementCalculator.ts   # 정산 계산
│   ├── SettlementCache.ts        # 캐싱 로직
│   ├── TaxCalculator.ts          # 세금 계산
│   └── index.ts
└── staff/                        # 스태프 도메인
    └── index.ts
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

## 의존성 규칙 (현재 구현)

```
┌──────────────────────────────────────────────────────┐
│                   Presentation                        │
│  (app/, components/)                                  │
│         │                                             │
│         ▼                                             │
│        Hooks (49개) ◄────────────────────────────┐   │
│         │                                        │   │
│         ▼                                        │   │
│       Stores (8개) ◄────── TanStack Query        │   │
│         │                        │               │   │
│         ▼                        ▼               │   │
│        Shared (26개) ◄─────────────────────────  │   │
│  (IdNormalizer, RoleResolver, StatusMapper...)   │   │
│         │                        │               │   │
│         ▼                        ▼               │   │
│       Services (43개) ─────► Domains (14개)      │   │
│         │                                        │   │
│         ▼                                        │   │
│    Repositories (22개)                           │   │
│         │                                        │   │
│         ▼                                        │   │
│       Firebase Layer (Web SDK)                   │   │
│         │                                        │   │
│         ▼                                        │   │
│    Types, Schemas, Utils, Errors ────────────────┘   │
│    (모든 레이어에서 사용 가능)                         │
└──────────────────────────────────────────────────────┘

의존성 규칙:
✅ 상위 레이어 → 하위 레이어 의존 가능
✅ 같은 레이어 내 의존 가능
❌ 하위 레이어 → 상위 레이어 의존 금지
❌ Presentation → Firebase 직접 호출 금지
❌ Hooks → Firebase 직접 호출 금지
❌ Service → Firebase 직접 호출 금지 (Repository 통해서만)
```

### Repository 패턴 (현재 구현)
```typescript
// 인터페이스 정의 (repositories/interfaces/)
interface IApplicationRepository {
  findByJobPosting(jobId: string): Promise<Application[]>;
  findByUser(userId: string): Promise<Application[]>;
  create(data: CreateApplicationDTO): Promise<Application>;
  updateStatus(id: string, status: ApplicationStatus): Promise<void>;
  delete(id: string): Promise<void>;
}

// Firebase 구현체 (repositories/firebase/)
class ApplicationRepository implements IApplicationRepository {
  // Firestore Modular API 사용
}

// 사용 규칙
✅ Service → Repository → Firebase (권장)
❌ Service → Firebase 직접 호출 (금지)
❌ Hooks → Firebase 직접 호출 (금지)
```

### 구현된 Repository 목록 (22개: 인터페이스 11 + 구현체 11)
| Repository | 담당 컬렉션 | 주요 메서드 |
|------------|-----------|------------|
| AdminRepository | users (관리) | findAll, updateRole, ban |
| AnnouncementRepository | announcements | findAll, create, update, delete |
| ApplicationRepository | applications | findByJobPosting, findByUser, create, updateStatus |
| ConfirmedStaffRepository | confirmedStaff | findByJobPosting, findByDate |
| EventQRRepository | eventQR | create, validate, findCurrent |
| JobPostingRepository | jobPostings | findActive, findByEmployer, create, update |
| NotificationRepository | notifications | findByUser, markAsRead, create |
| ReportRepository | reports | create, findByTarget, updateStatus |
| SettlementRepository | settlements | findByJobPosting, create, updateStatus |
| UserRepository | users | findById, updateProfile, delete |
| WorkLogRepository | workLogs | findBySchedule, checkIn, checkOut |

**인터페이스 (11개)**: `repositories/interfaces/`
**Firebase 구현체 (11개)**: `repositories/firebase/`

---

## Provider 구조 (현재 구현 - 5단계)

### 기존 웹앱 (문제점)
```tsx
// ❌ 8단계 중첩 - 복잡하고 디버깅 어려움
<ErrorBoundary>
  <FirebaseErrorBoundary>
    <QueryClientProvider>
      <ThemeProvider>
        <AuthProvider>
          <MaintenanceModeCheck>
            <CapacitorInitializer>
              <UnifiedDataInitializer>
                <TournamentProvider>
                  <App />
                </TournamentProvider>
              </UnifiedDataInitializer>
            </CapacitorInitializer>
          </MaintenanceModeCheck>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </FirebaseErrorBoundary>
</ErrorBoundary>
```

### 현재 구현 (React Native)
```tsx
// ✅ 5단계로 최적화 - app/_layout.tsx 실제 구조
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <BottomSheetModalProvider>
        <AppContent />
        {/* 전역 UI 매니저들 */}
        <ModalManager />
        <ToastManager />
        <InAppMessageManager />
        <OfflineBanner />
      </BottomSheetModalProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>

function AppContent() {
  // Zustand로 상태 관리 (Provider 불필요)
  const isReady = useAppInitialize();  // Firebase 인증 초기화

  // 전역 훅들
  useAuthGuard();                      // 권한 가드
  useNotificationHandler();            // 푸시 알림 처리
  useDeepLinkSetup();                  // 딥링크 설정

  if (!isReady) return <SplashScreen />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

### Provider 제거 및 대체
| 기존 Provider | 대체 방안 |
|--------------|----------|
| AuthProvider | `useAuthStore` (Zustand + MMKV persist) |
| ThemeProvider | `useThemeStore` (Zustand + NativeWind colorScheme) |
| NotificationProvider | `useNotificationStore` (Zustand) |
| TournamentProvider | 제외 (Phase 2) |
| UnifiedDataInitializer | `useAppInitialize` 훅 |

### Zustand 스토어 목록 (8개)
| 스토어 | 역할 | persist |
|--------|------|---------|
| `authStore` | 인증 상태, user, profile, isAdmin/isEmployer 플래그 | MMKV |
| `themeStore` | 테마 (light/dark/system), NativeWind 연동 | MMKV |
| `toastStore` | Toast 알림 (최대 3개), 자동 제거 | - |
| `modalStore` | 모달 스택 관리, showAlert/showConfirm | - |
| `notificationStore` | 알림 목록, unreadCount, 필터 | MMKV |
| `inAppMessageStore` | 우선순위 큐, 세션당 1회 표시 | MMKV |
| `bookmarkStore` | 북마크 저장/삭제 | MMKV |
| `tabFiltersStore` | 탭별 필터 상태 유지 | - |

### 전역 UI 매니저
| 매니저 | 역할 |
|--------|------|
| `ModalManager` | Zustand 기반 모달 스택 관리 |
| `ToastManager` | 최대 3개 동시 표시, 자동 제거 |
| `InAppMessageManager` | 우선순위 큐 기반 인앱 메시지 |
| `OfflineBanner` | 네트워크 상태 표시 |

---

## 에러 처리 전략 (8개 파일)

### 에러 시스템 구조
```
src/errors/                    # 8개 파일
├── AppError.ts               # 기본 에러 클래스 (code, category, severity)
├── BusinessErrors.ts         # 비즈니스 로직 에러 (20+ 클래스)
├── NotificationErrors.ts     # 알림 관련 에러
├── errorUtils.ts             # 에러 유틸리티
├── firebaseErrorMapper.ts    # Firebase 에러 → AppError 변환
├── guardErrors.ts            # 가드 에러
├── serviceErrorHandler.ts    # 서비스 레이어 에러 처리
└── index.ts                  # 배럴 export

src/shared/errors/            # 2개 파일
├── hookErrorHandler.ts       # 훅 레이어 에러 처리
└── index.ts
```

### 에러 계층
```typescript
// src/errors/AppError.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,           // E1001, E6002 등
    public category: ErrorCategory,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public userMessage: string,    // 사용자 친화적 메시지 (한글)
    public isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 에러 코드 체계
E1xxx: 네트워크 (OFFLINE, TIMEOUT, SERVER_UNREACHABLE)
E2xxx: 인증 (INVALID_CREDENTIALS, TOKEN_EXPIRED, TOO_MANY_REQUESTS)
E3xxx: 검증 (REQUIRED, FORMAT, SCHEMA)
E4xxx: Firebase (PERMISSION_DENIED, DOCUMENT_NOT_FOUND)
E5xxx: 보안 (XSS_DETECTED, UNAUTHORIZED_ACCESS)
E6xxx: 비즈니스 (ALREADY_APPLIED, MAX_CAPACITY, INVALID_QR 등)
E7xxx: 알 수 없는 에러

// src/errors/BusinessErrors.ts - 20+ 에러 클래스
export class AlreadyAppliedError extends AppError { ... }
export class ApplicationClosedError extends AppError { ... }
export class MaxCapacityReachedError extends AppError { ... }
export class AlreadyCheckedInError extends AppError { ... }
export class InvalidQRCodeError extends AppError { ... }
export class ExpiredQRCodeError extends AppError { ... }
export class AlreadySettledError extends AppError { ... }
// ... 등
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
