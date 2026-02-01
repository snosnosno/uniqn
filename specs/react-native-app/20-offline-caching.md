# 20. 오프라인 및 캐싱 전략

> **최종 업데이트**: 2026-02-02
> **구현 상태**: v1.0.0 완료 (Phase 2)
> **완성도**: 90%+

## 목차
1. [개요](#1-개요)
2. [네트워크 상태 감지](#2-네트워크-상태-감지)
3. [데이터 캐싱 전략](#3-데이터-캐싱-전략)
4. [로컬 스토리지](#4-로컬-스토리지)
5. [캐시 무효화 전략](#5-캐시-무효화-전략)
6. [Optimistic Updates](#6-optimistic-updates)
7. [동기화 전략](#7-동기화-전략)
8. [플랫폼별 고려사항](#8-플랫폼별-고려사항)
9. [구현 현황](#9-구현-현황)

---

## 1. 개요

### 오프라인 지원 목표

```yaml
목표:
  - 네트워크 없이도 기본 기능 사용 가능
  - 온라인 복귀 시 자동 동기화
  - 사용자에게 투명한 오프라인 경험

지원 범위:
  P0 (완료):
    - 캐시된 공고 목록 조회 ✅
    - 내 스케줄 조회 ✅
    - 프로필 정보 조회 ✅
    - 네트워크 상태 표시 ✅

  P1 (부분 완료):
    - 설정 변경 (캐시 저장) ✅
    - 지원 취소 (오프라인 큐) ⚠️ 미구현

  미지원 (설계상):
    - 새 공고 지원 (서버 검증 필요)
    - QR 출퇴근 (실시간 필요)
    - 결제/정산 (보안상 온라인 필수)
```

### 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  app/_layout.tsx: <OfflineBanner variant="banner" />        │
├─────────────────────────────────────────────────────────────┤
│                    TanStack Query                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ useQuery    │  │ useMutation │  │ queryClient │         │
│  │ 40개 훅     │  │ 15개 훅     │  │ (중앙 관리) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
├─────────┼────────────────┼────────────────┼─────────────────┤
│  ┌──────┴────────────────┴────────────────┴──────┐          │
│  │              Persistence Layer                 │          │
│  │  ┌─────────────┐  ┌─────────────────────┐    │          │
│  │  │    MMKV     │  │   SecureStore       │    │          │
│  │  │  (캐시)     │  │  (인증 토큰)        │    │          │
│  │  └─────────────┘  └─────────────────────┘    │          │
│  └───────────────────────────────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                   Network Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │useNetworkStatus│  │ Firebase   │  │ Realtime   │         │
│  │(NetInfo+Web)│  │ (Backend)  │  │ Manager    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 네트워크 상태 감지

### 구현 위치
- **파일**: `src/hooks/useNetworkStatus.ts`
- **버전**: v2.0.0 (완전 구현)

### 네트워크 상태 타입

```typescript
// src/hooks/useNetworkStatus.ts
interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  isChecking: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  isInternetReachable: boolean | null;
  lastChecked: Date | null;
  details: NetInfoState | null;
}

interface UseNetworkStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
}
```

### 크로스 플랫폼 구현

```typescript
// 네이티브 (iOS/Android)
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
  return () => unsubscribe();
}, []);

// 웹 (React Native Web)
useEffect(() => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true, isOffline: false }));
    const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false, isOffline: true }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}, []);
```

### 오프라인 배너 컴포넌트

**파일**: `src/components/ui/OfflineBanner.tsx`

```typescript
interface OfflineBannerProps {
  variant?: 'banner' | 'toast' | 'fullscreen';
  onReconnect?: () => void;
}

// 3가지 스타일 제공
// - banner: 상단 고정 배너 (기본)
// - toast: 플로팅 토스트
// - fullscreen: 전체 화면 오버레이
```

### Root Layout 통합

```tsx
// app/_layout.tsx (Line 72, 94)
export default function RootLayout() {
  const { isOnline } = useNetworkStatus();

  // 온라인 복귀 시 처리 (Line 79-88)
  useEffect(() => {
    if (!wasOnline && isOnline) {
      RealtimeManager.onNetworkReconnect();
      tokenRefreshService.onNetworkReconnect();
    }
    setWasOnline(isOnline);
  }, [isOnline]);

  return (
    <QueryClientProvider client={queryClient}>
      <BottomSheetModalProvider>
        <AppContent />
        <OfflineBanner variant="banner" />  {/* Line 94 */}
        <ToastManager />
        <ModalManager />
      </BottomSheetModalProvider>
    </QueryClientProvider>
  );
}
```

---

## 3. 데이터 캐싱 전략

### TanStack Query 설정

**파일**: `src/lib/queryClient.ts`

```typescript
// Query Client 기본 설정
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,           // 5분 fresh
      gcTime: 10 * 60 * 1000,              // 10분 캐시 유지
      retry: shouldRetry,                  // 조건부 재시도
      retryDelay: getRetryDelay,           // 지수 백오프
      refetchOnWindowFocus: false,         // 모바일 최적화
      refetchOnReconnect: true,            // 온라인 복귀 시 리페치
      networkMode: 'offlineFirst',         // ⭐ 오프라인 우선
    },
    mutations: {
      retry: false,                        // 뮤테이션 재시도 안 함 (중복 방지)
      networkMode: 'offlineFirst',
    },
  },
});
```

### 재시도 로직

```typescript
// 재시도 가능 에러 판별
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;

  const appError = error instanceof AppError ? error : mapToAppError(error);

  // 재시도 불가 에러
  const nonRetryableCategories = [
    ErrorCategory.AUTH,        // 재로그인 필요
    ErrorCategory.VALIDATION,  // 입력 오류
    ErrorCategory.BUSINESS,    // 비즈니스 로직 (이미 지원함 등)
  ];

  return !nonRetryableCategories.includes(appError.category);
}

// 지수 백오프 + 지터
function getRetryDelay(attemptIndex: number): number {
  const baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
  const jitter = baseDelay * Math.random() * 0.3;
  return baseDelay + jitter;
}
```

### Query Keys 중앙 관리 (14개 도메인)

```typescript
// src/lib/queryClient.ts
export const queryKeys = {
  // 기본
  user: { all: ['user'], current: () => [...queryKeys.user.all, 'current'], profile: (userId: string) => [...queryKeys.user.all, 'profile', userId] },
  jobPostings: { all: ['jobPostings'], lists: () => [...queryKeys.jobPostings.all, 'list'], list: (filters) => [...queryKeys.jobPostings.lists(), filters], details: () => [...queryKeys.jobPostings.all, 'detail'], detail: (id) => [...queryKeys.jobPostings.details(), id], mine: () => [...queryKeys.jobPostings.all, 'mine'] },
  applications: { all: ['applications'], lists: () => [...queryKeys.applications.all, 'list'], list: (filters) => [...queryKeys.applications.lists(), filters], detail: (id) => [...queryKeys.applications.all, 'detail', id], mine: () => [...queryKeys.applications.all, 'mine'], byJobPosting: (jobPostingId) => [...queryKeys.applications.all, 'byJobPosting', jobPostingId] },
  schedules: { all: ['schedules'], list: (filters) => [...queryKeys.schedules.all, 'list', filters], mine: () => [...queryKeys.schedules.all, 'mine'], byDate: (date) => [...queryKeys.schedules.all, 'byDate', date], byMonth: (month) => [...queryKeys.schedules.all, 'byMonth', month] },
  workLogs: { all: ['workLogs'], mine: () => [...queryKeys.workLogs.all, 'mine'], byDate: (date) => [...queryKeys.workLogs.all, 'byDate', date], bySchedule: (scheduleId) => [...queryKeys.workLogs.all, 'bySchedule', scheduleId] },
  notifications: { all: ['notifications'], lists: () => [...queryKeys.notifications.all, 'list'], list: (filters) => [...queryKeys.notifications.lists(), filters], unread: () => [...queryKeys.notifications.all, 'unread'], unreadCount: () => [...queryKeys.notifications.all, 'unreadCount'], settings: () => [...queryKeys.notifications.all, 'settings'] },
  settings: { all: ['settings'], user: (userId) => [...queryKeys.settings.all, 'user', userId], notification: () => [...queryKeys.settings.all, 'notification'] },

  // 구인자용
  jobManagement: { all: ['jobManagement'], myPostings: () => [...queryKeys.jobManagement.all, 'myPostings'], stats: () => [...queryKeys.jobManagement.all, 'stats'] },
  applicantManagement: { all: ['applicantManagement'], byJobPosting: (jobPostingId) => [...queryKeys.applicantManagement.all, 'byJobPosting', jobPostingId], stats: (jobPostingId) => [...queryKeys.applicantManagement.all, 'stats', jobPostingId], cancellationRequests: (jobPostingId) => [...queryKeys.applicantManagement.all, 'cancellationRequests', jobPostingId] },
  settlement: { all: ['settlement'], byJobPosting: (jobPostingId) => [...queryKeys.settlement.all, 'byJobPosting', jobPostingId], summary: (jobPostingId) => [...queryKeys.settlement.all, 'summary', jobPostingId], mySummary: () => [...queryKeys.settlement.all, 'mySummary'], calculation: (params) => [...queryKeys.settlement.all, 'calculation', params] },
  confirmedStaff: { all: ['confirmedStaff'], byJobPosting: (jobPostingId) => [...queryKeys.confirmedStaff.all, 'byJobPosting', jobPostingId], byDate: (date) => [...queryKeys.confirmedStaff.all, 'byDate', date], detail: (id) => [...queryKeys.confirmedStaff.all, 'detail', id], grouped: (jobPostingId) => [...queryKeys.confirmedStaff.all, 'grouped', jobPostingId] },
  templates: { all: ['templates'], list: () => [...queryKeys.templates.all, 'list'], detail: (id) => [...queryKeys.templates.all, 'detail', id] },
  eventQR: { all: ['eventQR'], current: () => [...queryKeys.eventQR.all, 'current'], history: () => [...queryKeys.eventQR.all, 'history'] },
  reports: { all: ['reports'], byJobPosting: (jobPostingId) => [...queryKeys.reports.all, 'byJobPosting', jobPostingId], byStaff: (staffId) => [...queryKeys.reports.all, 'byStaff', staffId] },

  // 관리자용
  admin: { all: ['admin'], dashboard: () => [...queryKeys.admin.all, 'dashboard'], users: () => [...queryKeys.admin.all, 'users'], userDetail: (userId) => [...queryKeys.admin.all, 'user', userId], metrics: () => [...queryKeys.admin.all, 'metrics'] },
  tournaments: { all: ['tournaments'], pending: () => [...queryKeys.tournaments.all, 'pending'], approved: () => [...queryKeys.tournaments.all, 'approved'], rejected: () => [...queryKeys.tournaments.all, 'rejected'], detail: (id) => [...queryKeys.tournaments.all, 'detail', id], myPending: () => [...queryKeys.tournaments.all, 'myPending'] },
  announcements: { all: ['announcements'], published: () => [...queryKeys.announcements.all, 'published'], adminList: () => [...queryKeys.announcements.all, 'adminList'], detail: (id) => [...queryKeys.announcements.all, 'detail', id], unreadCount: () => [...queryKeys.announcements.all, 'unreadCount'] },
};
```

### 캐싱 정책 (5단계)

```typescript
export const cachingPolicies = {
  realtime: 0,                    // settlement, workLogs (실시간 동기)
  frequent: 2 * 60 * 1000,        // schedules (2분)
  standard: 5 * 60 * 1000,        // jobPostings, applications (5분)
  stable: 30 * 60 * 1000,         // settings, profiles (30분)
  offlineFirst: Infinity,         // 오프라인 우선 접근
};
```

---

## 4. 로컬 스토리지

### 3단계 스토리지 아키텍처

```
┌─────────────────────────────────────┐
│ Zustand + React Query (메모리)      │  ← 앱 실행 중
├─────────────────────────────────────┤
│ MMKV (일반) + MMKV (암호화)        │  ← 영구 저장
├─────────────────────────────────────┤
│ expo-secure-store (민감 데이터)     │  ← 키체인/키스토어
└─────────────────────────────────────┘
```

### MMKV 저장소

**파일**: `src/lib/mmkvStorage.ts`

```typescript
// 플랫폼별 구현
// - 네이티브: react-native-mmkv (30배 빠름)
// - 웹: localStorage 폴백
// - Expo Go: 메모리 폴백

export const STORAGE_KEYS = {
  // 인증
  AUTH: 'auth-storage',
  AUTH_TOKEN: 'auth-token',
  REFRESH_TOKEN: 'refresh-token',

  // 사용자 설정
  THEME: 'theme-storage',
  NOTIFICATIONS: 'notification-storage',
  PREFERENCES: 'preferences-storage',

  // 캐시
  JOB_POSTINGS_CACHE: 'job-postings-cache',
  SCHEDULES_CACHE: 'schedules-cache',
  NOTIFICATIONS_CACHE: 'notifications-cache',

  // 임시 데이터
  FORM_DRAFT: 'form-draft',
  SEARCH_HISTORY: 'search-history',
  RECENT_JOBS: 'recent-jobs',
} as const;
```

### SecureStore (민감 데이터)

**파일**: `src/lib/secureStorage.ts`

```typescript
// 플랫폼별 암호화 저장소
// - iOS: 키체인 (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
// - Android: 키스토어
// - Web: localStorage (prefix 사용, 제한적)

// TTL(만료) 지원
await setItem('sessionId', 'xxx', { expiresIn: 3600 }); // 1시간 후 만료

// 네임스페이스별 헬퍼
export const authStorage = {
  setAuthToken: (token: string) => setItem('auth-token', token),
  setRefreshToken: (token: string) => setItem('refresh-token', token),
  clearAll: () => Promise.all([remove('auth-token'), remove('refresh-token')]),
};
```

### 캐시 서비스

**파일**: `src/services/cacheService.ts`

```typescript
// 캐시 통계
getCacheStats(): {
  queryCount: number;        // React Query 캐시 수
  mmkvCacheKeyCount: number; // MMKV 캐시 키 수
  cacheKeys: string[];       // 캐시 가능한 키 목록
}

// 캐시 삭제 (보호된 키 제외)
clearAllCache(options?: { excludeAuth?: boolean }): Promise<{
  queryCleared: boolean;
  mmkvCleared: boolean;
}>

// 부분 삭제
clearSearchHistory(): void
clearJobPostingsCache(): void
clearSchedulesCache(): void
```

---

## 5. 캐시 무효화 전략

**파일**: `src/lib/invalidationStrategy.ts`

### 이벤트 기반 무효화

```typescript
type InvalidationEvent =
  // 지원 관련
  | 'application.create'
  | 'application.cancel'
  | 'application.requestCancellation'
  // 지원자 관리
  | 'applicant.confirm'
  | 'applicant.reject'
  | 'applicant.bulkConfirm'
  // 공고 관리
  | 'jobPosting.create'
  | 'jobPosting.update'
  | 'jobPosting.delete'
  | 'jobPosting.close'
  // 근무 기록
  | 'workLog.checkIn'
  | 'workLog.checkOut'
  // 정산
  | 'settlement.calculate'
  | 'settlement.complete';

// 무효화 그래프
const INVALIDATION_MAP: Record<InvalidationEvent, string[][]> = {
  'application.create': [
    queryKeys.applications.mine(),
    queryKeys.jobPostings.detail('{jobPostingId}'),
    queryKeys.schedules.mine(),
  ],
  'applicant.confirm': [
    queryKeys.applicantManagement.byJobPosting('{jobPostingId}'),
    queryKeys.confirmedStaff.byJobPosting('{jobPostingId}'),
    queryKeys.workLogs.all,
    queryKeys.settlement.byJobPosting('{jobPostingId}'),
    queryKeys.jobPostings.detail('{jobPostingId}'),
  ],
  // ... 16개 이벤트 정의
};
```

### 사용 예시

```typescript
// 뮤테이션에서 사용
const mutation = useMutation({
  mutationFn: applicationService.apply,
  onSuccess: createInvalidationHandler('application.create'),
});

// 수동 호출
import { invalidateRelated } from '@/lib/invalidationStrategy';
invalidateRelated('applicant.confirm', { jobPostingId: 'job123' });
```

---

## 6. Optimistic Updates

### 지원 취소 예시

```typescript
// src/hooks/useApplications.ts
const cancelMutation = useMutation({
  mutationFn: applicationService.cancel,

  onMutate: async ({ applicationId, jobPostingId }) => {
    // 진행 중인 쿼리 취소
    await queryClient.cancelQueries({ queryKey: queryKeys.applications.mine() });

    // 이전 데이터 저장
    const previousApplications = queryClient.getQueryData(queryKeys.applications.mine());

    // 낙관적 업데이트
    queryClient.setQueryData(queryKeys.applications.mine(), (old: Application[]) =>
      old?.map(app =>
        app.id === applicationId
          ? { ...app, status: 'cancelled', cancelledAt: new Date() }
          : app
      )
    );

    return { previousApplications };
  },

  onError: (error, variables, context) => {
    // 롤백
    if (context?.previousApplications) {
      queryClient.setQueryData(queryKeys.applications.mine(), context.previousApplications);
    }
  },

  onSettled: () => {
    invalidateRelated('application.cancel');
  },
});
```

---

## 7. 동기화 전략

### RealtimeManager

**파일**: `src/shared/realtime/RealtimeManager.ts`

```typescript
// Firebase Firestore 실시간 구독 관리
class RealtimeManager {
  private subscriptions: Map<string, Unsubscribe> = new Map();

  // 구독 시작
  subscribe<T>(
    key: string,
    query: Query<T>,
    onData: (data: T[]) => void,
    onError?: (error: Error) => void
  ): void;

  // 구독 해제
  unsubscribe(key: string): void;

  // 모든 구독 해제
  unsubscribeAll(): void;

  // 네트워크 복귀 시 재연결
  onNetworkReconnect(): void {
    // 모든 구독 재시작
    this.subscriptions.forEach((_, key) => {
      this.resubscribe(key);
    });
  }
}
```

### 온라인 복귀 시 동기화

```typescript
// app/_layout.tsx
useEffect(() => {
  if (!wasOnline && isOnline) {
    // 1. 실시간 구독 재연결
    RealtimeManager.onNetworkReconnect();

    // 2. 토큰 갱신
    tokenRefreshService.onNetworkReconnect();

    // 3. 중요 데이터 리페치
    queryClient.invalidateQueries({ queryKey: queryKeys.schedules.mine() });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
  }
  setWasOnline(isOnline);
}, [isOnline]);
```

---

## 8. 플랫폼별 고려사항

### 웹 플랫폼

```typescript
// src/lib/queryClient.ts - 네트워크 리스너 초기화
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const handleOnline = () => {
    onlineManager.setOnline(true);
    logger.info('네트워크 상태 변경: 온라인');
  };
  const handleOffline = () => {
    onlineManager.setOnline(false);
    logger.info('네트워크 상태 변경: 오프라인');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  onlineManager.setOnline(navigator.onLine);
}
```

### 네이티브 플랫폼

```typescript
// 앱 상태 변경 감지 (포그라운드/백그라운드)
const subscription = AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    // 포그라운드 복귀 → 중요 데이터 리페치
    queryClient.refetchQueries({
      queryKey: queryKeys.schedules.mine(),
      type: 'active',
    });
  }
});
```

---

## 9. 구현 현황

### 전체 평가: ✅ 90% 완료

| 기능 | 상태 | 파일 위치 | 비고 |
|------|------|----------|------|
| 네트워크 상태 감지 | ✅ 100% | hooks/useNetworkStatus.ts | NetInfo + navigator.onLine |
| 오프라인 배너 | ✅ 100% | components/ui/OfflineBanner.tsx | 3가지 스타일 |
| MMKV 저장소 | ✅ 100% | lib/mmkvStorage.ts | 암호화, 마이그레이션 포함 |
| SecureStore | ✅ 100% | lib/secureStorage.ts | TTL, iOS/Android 지원 |
| TanStack Query | ✅ 100% | lib/queryClient.ts | offlineFirst 모드 |
| Query Keys | ✅ 100% | lib/queryClient.ts | 14개 도메인 중앙 관리 |
| 캐싱 정책 | ✅ 100% | lib/queryClient.ts | 5단계 정책 |
| 캐시 무효화 | ✅ 100% | lib/invalidationStrategy.ts | 16개 이벤트 |
| 캐시 서비스 | ✅ 100% | services/cacheService.ts | 통계, 삭제 기능 |
| RealtimeManager | ✅ 80% | shared/realtime/RealtimeManager.ts | 기본 구독 관리 |
| **오프라인 큐** | ⚠️ 0% | 미구현 | Phase 3 예정 |
| **충돌 해결** | ⚠️ 0% | 미구현 | Phase 3 예정 |

### 성능 지표

| 지표 | 목표 | 현재 |
|------|------|------|
| MMKV 속도 | AsyncStorage 30배 | ✅ 달성 |
| 첫 로드 | < 2초 | ✅ 달성 |
| 캐시 히트율 | > 80% | ✅ 달성 |
| 오프라인 읽기 | 즉시 | ✅ 달성 |

### 향후 개선 (Phase 3)

1. **오프라인 큐 구현**: 뮤테이션 실패 시 자동 저장 및 온라인 복귀 시 재시도
2. **충돌 해결 전략**: Last-Write-Wins, Field-level Merge, 사용자 선택
3. **데이터 프리페칭**: 중요 데이터 미리 캐싱
4. **백그라운드 동기화**: 앱 백그라운드에서도 주기적 동기화

---

## 관련 문서

- [03-state-management.md](./03-state-management.md) - 상태 관리 전략
- [08-data-flow.md](./08-data-flow.md) - 데이터 흐름 패턴
- [21-react-native-web.md](./21-react-native-web.md) - React Native Web 전략
