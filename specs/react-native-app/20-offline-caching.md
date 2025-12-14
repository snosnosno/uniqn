# 20. 오프라인 및 캐싱 전략

## 목차
1. [개요](#1-개요)
2. [네트워크 상태 감지](#2-네트워크-상태-감지)
3. [데이터 캐싱 전략](#3-데이터-캐싱-전략)
4. [로컬 스토리지](#4-로컬-스토리지)
5. [Optimistic Updates](#5-optimistic-updates)
6. [오프라인 큐](#6-오프라인-큐)
7. [동기화 전략](#7-동기화-전략)
8. [플랫폼별 고려사항](#8-플랫폼별-고려사항)

---

## 1. 개요

### 오프라인 지원 목표

```yaml
목표:
  - 네트워크 없이도 기본 기능 사용 가능
  - 온라인 복귀 시 자동 동기화
  - 사용자에게 투명한 오프라인 경험

지원 범위:
  P0 (필수):
    - 캐시된 공고 목록 조회
    - 내 스케줄 조회
    - 프로필 정보 조회

  P1 (권장):
    - 지원 취소 (오프라인 큐)
    - 설정 변경 (오프라인 큐)

  미지원:
    - 새 공고 지원 (서버 검증 필요)
    - QR 출퇴근 (실시간 필요)
    - 결제/정산 (보안상 온라인 필수)
```

### 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
├─────────────────────────────────────────────────────────────┤
│                    TanStack Query                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Query      │  │  Mutation   │  │  Cache      │         │
│  │  Hooks      │  │  Hooks      │  │  Manager    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
├─────────┼────────────────┼────────────────┼─────────────────┤
│         │                │                │                  │
│  ┌──────┴────────────────┴────────────────┴──────┐          │
│  │              Persistence Layer                 │          │
│  │  ┌─────────────┐  ┌─────────────────────┐    │          │
│  │  │   MMKV      │  │  Offline Queue      │    │          │
│  │  │  (Cache)    │  │  (Pending Actions)  │    │          │
│  │  └─────────────┘  └─────────────────────┘    │          │
│  └───────────────────────────────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                   Network Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  NetInfo    │  │  Firebase   │  │  Sync       │         │
│  │  (Status)   │  │  (Backend)  │  │  Manager    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 네트워크 상태 감지

### NetInfo 설정

```bash
npx expo install @react-native-community/netinfo
```

### 네트워크 상태 훅

```typescript
// src/hooks/useNetworkStatus.ts
import { useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
  isOffline: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
    isOffline: false,
  });

  useEffect(() => {
    // 초기 상태 확인
    NetInfo.fetch().then(handleNetworkChange);

    // 상태 변경 구독
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    return () => unsubscribe();
  }, []);

  const handleNetworkChange = useCallback((state: NetInfoState) => {
    const isOffline = !state.isConnected || state.isInternetReachable === false;

    setStatus({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isWifi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
      isOffline,
    });
  }, []);

  return status;
}

// 웹 플랫폼 대응
export function useNetworkStatusWeb(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isConnected: isOnline,
    isInternetReachable: isOnline,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
    isOffline: !isOnline,
  };
}
```

### 네트워크 상태 Provider

```typescript
// src/providers/NetworkProvider.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import { useNetworkStatus, useNetworkStatusWeb } from '@/hooks/useNetworkStatus';
import { useToastStore } from '@/stores/toastStore';
import { offlineQueueManager } from '@/lib/offlineQueue';

interface NetworkContextValue {
  isOffline: boolean;
  isConnected: boolean;
  networkType: string;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOffline: false,
  isConnected: true,
  networkType: 'unknown',
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const networkStatus = Platform.OS === 'web'
    ? useNetworkStatusWeb()
    : useNetworkStatus();

  const { addToast } = useToastStore();

  // 오프라인 → 온라인 전환 시 동기화
  useEffect(() => {
    if (!networkStatus.isOffline && networkStatus.isConnected) {
      // 오프라인 큐 처리
      offlineQueueManager.processQueue();
    }
  }, [networkStatus.isOffline, networkStatus.isConnected]);

  // 네트워크 상태 변경 알림
  useEffect(() => {
    if (networkStatus.isOffline) {
      addToast({
        type: 'warning',
        message: '오프라인 모드입니다. 일부 기능이 제한됩니다.',
        duration: 5000,
      });
    }
  }, [networkStatus.isOffline]);

  return (
    <NetworkContext.Provider
      value={{
        isOffline: networkStatus.isOffline,
        isConnected: networkStatus.isConnected,
        networkType: networkStatus.type,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
```

### 오프라인 배너 컴포넌트

```typescript
// src/components/OfflineBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useNetwork } from '@/providers/NetworkProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfflineBanner() {
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withTiming(isOffline ? 0 : -50, { duration: 300 }),
        },
      ],
      opacity: withTiming(isOffline ? 1 : 0, { duration: 300 }),
    };
  });

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top },
        animatedStyle,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.text}>오프라인 모드</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f59e0b',
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
```

---

## 3. 데이터 캐싱 전략

### TanStack Query 캐시 설정

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { mmkvStorage } from './storage';

// Query Client 생성
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 캐시 유지 시간: 5분
      staleTime: 5 * 60 * 1000,

      // 가비지 컬렉션 시간: 24시간
      gcTime: 24 * 60 * 60 * 1000,

      // 오프라인 시 캐시 데이터 사용
      networkMode: 'offlineFirst',

      // 재시도 설정
      retry: (failureCount, error: any) => {
        // 네트워크 에러는 3번까지 재시도
        if (error?.message?.includes('Network')) {
          return failureCount < 3;
        }
        // 4xx 에러는 재시도 안함
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // 뮤테이션은 온라인일 때만
      networkMode: 'online',

      retry: 2,
    },
  },
});

// MMKV를 사용한 캐시 영속화
const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => mmkvStorage.getString(key) ?? null,
    setItem: (key, value) => mmkvStorage.set(key, value),
    removeItem: (key) => mmkvStorage.delete(key),
  },
  // 직렬화 최적화
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

// 캐시 영속화 설정
persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24시간
  buster: 'v1', // 캐시 버전
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      // 캐시할 쿼리 필터링
      const cacheableKeys = [
        'jobPostings',
        'mySchedule',
        'profile',
        'notifications',
      ];

      return cacheableKeys.some((key) =>
        query.queryKey[0]?.toString().includes(key)
      );
    },
  },
});
```

### 쿼리별 캐시 전략

```typescript
// src/hooks/queries/useJobPostings.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { jobPostingService } from '@/services/jobPostingService';
import { useNetwork } from '@/providers/NetworkProvider';

interface JobFilters {
  location?: string;
  role?: string;
  date?: string;
}

export function useJobPostings(filters: JobFilters) {
  const { isOffline } = useNetwork();

  return useInfiniteQuery({
    queryKey: ['jobPostings', filters],
    queryFn: async ({ pageParam = null }) => {
      return jobPostingService.getFiltered({
        ...filters,
        cursor: pageParam,
        limit: 20,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,

    // 캐시 설정
    staleTime: isOffline ? Infinity : 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,

    // 오프라인 시 캐시만 사용
    enabled: !isOffline || undefined, // undefined면 캐시 사용

    // 플레이스홀더 데이터 (캐시가 없을 때)
    placeholderData: (previousData) => previousData,
  });
}

// 단일 공고 조회 (캐시 우선)
export function useJobPosting(id: string) {
  const { isOffline } = useNetwork();

  return useQuery({
    queryKey: ['jobPosting', id],
    queryFn: () => jobPostingService.getById(id),

    staleTime: isOffline ? Infinity : 5 * 60 * 1000,

    // 목록 캐시에서 초기 데이터 가져오기
    initialData: () => {
      const cache = queryClient.getQueryData<{ pages: any[] }>(['jobPostings']);
      if (cache?.pages) {
        for (const page of cache.pages) {
          const job = page.items.find((j: any) => j.id === id);
          if (job) return job;
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      return queryClient.getQueryState(['jobPostings'])?.dataUpdatedAt;
    },
  });
}
```

### 내 스케줄 캐싱

```typescript
// src/hooks/queries/useMySchedule.ts
import { useQuery } from '@tanstack/react-query';
import { scheduleService } from '@/services/scheduleService';
import { useAuthStore } from '@/stores/authStore';
import { useNetwork } from '@/providers/NetworkProvider';

export function useMySchedule(month: string) {
  const { user } = useAuthStore();
  const { isOffline } = useNetwork();

  return useQuery({
    queryKey: ['mySchedule', user?.uid, month],
    queryFn: () => scheduleService.getMySchedule(user!.uid, month),

    enabled: !!user?.uid,

    // 스케줄은 더 오래 캐시
    staleTime: isOffline ? Infinity : 10 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7일

    // 백그라운드 리프레시
    refetchOnWindowFocus: !isOffline,
    refetchOnReconnect: true,
  });
}
```

---

## 4. 로컬 스토리지

### MMKV 설정

```bash
npx expo install react-native-mmkv
```

```typescript
// src/lib/storage.ts
import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

// 메인 스토리지
export const mmkvStorage = new MMKV({
  id: 'uniqn-main',
  encryptionKey: __DEV__ ? undefined : 'your-encryption-key',
});

// 캐시 전용 스토리지
export const cacheStorage = new MMKV({
  id: 'uniqn-cache',
});

// 오프라인 큐 스토리지
export const queueStorage = new MMKV({
  id: 'uniqn-queue',
});

// 웹 플랫폼 폴백
class WebStorage {
  private prefix: string;

  constructor(id: string) {
    this.prefix = `uniqn_${id}_`;
  }

  getString(key: string): string | undefined {
    const value = localStorage.getItem(this.prefix + key);
    return value ?? undefined;
  }

  set(key: string, value: string): void {
    localStorage.setItem(this.prefix + key, value);
  }

  delete(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }

  getAllKeys(): string[] {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(this.prefix))
      .map((k) => k.slice(this.prefix.length));
  }

  clearAll(): void {
    this.getAllKeys().forEach((key) => this.delete(key));
  }
}

// 플랫폼별 스토리지
export const storage = Platform.OS === 'web'
  ? new WebStorage('main')
  : mmkvStorage;
```

### 타입 안전한 스토리지 래퍼

```typescript
// src/lib/typedStorage.ts
import { storage } from './storage';

interface StorageSchema {
  // 사용자 설정
  'settings.theme': 'light' | 'dark' | 'system';
  'settings.notifications': boolean;
  'settings.language': 'ko' | 'en';

  // 인증
  'auth.token': string;
  'auth.refreshToken': string;
  'auth.userId': string;

  // 캐시 메타데이터
  'cache.lastSync': number;
  'cache.version': string;

  // 오프라인 큐
  'queue.pending': string; // JSON
}

class TypedStorage {
  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
    const value = storage.getString(key);
    if (value === undefined) return null;

    try {
      return JSON.parse(value) as StorageSchema[K];
    } catch {
      return value as StorageSchema[K];
    }
  }

  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
    const stringValue = typeof value === 'string'
      ? value
      : JSON.stringify(value);
    storage.set(key, stringValue);
  }

  remove<K extends keyof StorageSchema>(key: K): void {
    storage.delete(key);
  }

  // 여러 키 한번에 가져오기
  getMultiple<K extends keyof StorageSchema>(
    keys: K[]
  ): Partial<Pick<StorageSchema, K>> {
    const result: Partial<StorageSchema> = {};

    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        result[key] = value;
      }
    }

    return result as Partial<Pick<StorageSchema, K>>;
  }

  // 캐시 클리어
  clearCache(): void {
    const keys = storage.getAllKeys?.() ?? [];
    keys
      .filter((key) => key.startsWith('cache.'))
      .forEach((key) => storage.delete(key));
  }
}

export const typedStorage = new TypedStorage();
```

---

## 5. Optimistic Updates

### 지원 취소 (Optimistic)

```typescript
// src/hooks/mutations/useCancelApplication.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationService } from '@/services/applicationService';
import { useToastStore } from '@/stores/toastStore';
import { useNetwork } from '@/providers/NetworkProvider';
import { offlineQueueManager } from '@/lib/offlineQueue';

interface CancelParams {
  applicationId: string;
  jobPostingId: string;
}

export function useCancelApplication() {
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const { isOffline } = useNetwork();

  return useMutation({
    mutationFn: async ({ applicationId }: CancelParams) => {
      if (isOffline) {
        // 오프라인이면 큐에 추가
        await offlineQueueManager.addToQueue({
          type: 'CANCEL_APPLICATION',
          payload: { applicationId },
          timestamp: Date.now(),
        });
        return { queued: true };
      }

      return applicationService.cancel(applicationId);
    },

    // Optimistic Update
    onMutate: async ({ applicationId, jobPostingId }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({
        queryKey: ['myApplications']
      });

      // 이전 데이터 저장 (롤백용)
      const previousApplications = queryClient.getQueryData(['myApplications']);

      // 낙관적 업데이트
      queryClient.setQueryData(['myApplications'], (old: any) => {
        if (!old) return old;
        return old.map((app: any) =>
          app.id === applicationId
            ? { ...app, status: 'cancelled', cancelledAt: new Date() }
            : app
        );
      });

      // 공고 지원자 수도 업데이트
      queryClient.setQueryData(['jobPosting', jobPostingId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          currentApplicants: Math.max(0, (old.currentApplicants || 0) - 1),
        };
      });

      return { previousApplications };
    },

    // 에러 시 롤백
    onError: (error, variables, context) => {
      if (context?.previousApplications) {
        queryClient.setQueryData(
          ['myApplications'],
          context.previousApplications
        );
      }

      addToast({
        type: 'error',
        message: '지원 취소에 실패했습니다. 다시 시도해주세요.',
      });
    },

    // 성공 시
    onSuccess: (data) => {
      if (data.queued) {
        addToast({
          type: 'info',
          message: '오프라인 상태입니다. 온라인 복귀 시 처리됩니다.',
        });
      } else {
        addToast({
          type: 'success',
          message: '지원이 취소되었습니다.',
        });
      }
    },

    // 최종 정리
    onSettled: () => {
      // 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['myApplications'] });
    },
  });
}
```

### 프로필 업데이트 (Optimistic)

```typescript
// src/hooks/mutations/useUpdateProfile.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { useAuthStore } from '@/stores/authStore';
import { useNetwork } from '@/providers/NetworkProvider';
import { offlineQueueManager } from '@/lib/offlineQueue';

interface ProfileUpdate {
  displayName?: string;
  phoneNumber?: string;
  introduction?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { isOffline } = useNetwork();

  return useMutation({
    mutationFn: async (data: ProfileUpdate) => {
      if (isOffline) {
        await offlineQueueManager.addToQueue({
          type: 'UPDATE_PROFILE',
          payload: data,
          timestamp: Date.now(),
        });
        return { queued: true, data };
      }

      return profileService.update(user!.uid, data);
    },

    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: ['profile', user?.uid]
      });

      const previousProfile = queryClient.getQueryData(['profile', user?.uid]);

      // 낙관적 업데이트
      queryClient.setQueryData(['profile', user?.uid], (old: any) => ({
        ...old,
        ...newData,
        updatedAt: new Date(),
      }));

      return { previousProfile };
    },

    onError: (error, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(
          ['profile', user?.uid],
          context.previousProfile
        );
      }
    },

    onSettled: () => {
      if (!isOffline) {
        queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
      }
    },
  });
}
```

---

## 6. 오프라인 큐

### 큐 매니저

```typescript
// src/lib/offlineQueue.ts
import { queueStorage } from './storage';
import { applicationService } from '@/services/applicationService';
import { profileService } from '@/services/profileService';
import { analyticsService } from '@/services/analytics/AnalyticsService';

interface QueuedAction {
  id: string;
  type: 'CANCEL_APPLICATION' | 'UPDATE_PROFILE' | 'UPDATE_SETTINGS';
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class OfflineQueueManager {
  private readonly QUEUE_KEY = 'pending_actions';
  private isProcessing = false;

  /**
   * 액션을 큐에 추가
   */
  async addToQueue(action: Omit<QueuedAction, 'id' | 'retryCount' | 'maxRetries'>): Promise<void> {
    const queue = this.getQueue();

    const newAction: QueuedAction = {
      ...action,
      id: `${action.type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      retryCount: 0,
      maxRetries: 3,
    };

    queue.push(newAction);
    this.saveQueue(queue);

    // 분석 이벤트
    await analyticsService.logEvent('offline_action_queued', {
      type: action.type,
      queueSize: queue.length,
    });
  }

  /**
   * 큐 처리 (온라인 복귀 시)
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const queue = this.getQueue();

      if (queue.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[OfflineQueue] Processing ${queue.length} actions`);

      // 시간순으로 정렬 (오래된 것부터)
      queue.sort((a, b) => a.timestamp - b.timestamp);

      const results: { success: string[]; failed: string[] } = {
        success: [],
        failed: [],
      };

      for (const action of queue) {
        try {
          await this.processAction(action);
          results.success.push(action.id);
        } catch (error) {
          console.error(`[OfflineQueue] Failed to process ${action.id}:`, error);

          // 재시도 횟수 증가
          action.retryCount++;

          if (action.retryCount >= action.maxRetries) {
            results.failed.push(action.id);
          }
        }
      }

      // 성공한 액션 제거, 실패한 액션도 제거 (최대 재시도 초과)
      const updatedQueue = queue.filter(
        (action) =>
          !results.success.includes(action.id) &&
          !results.failed.includes(action.id)
      );

      this.saveQueue(updatedQueue);

      // 분석 이벤트
      await analyticsService.logEvent('offline_queue_processed', {
        success: results.success.length,
        failed: results.failed.length,
        remaining: updatedQueue.length,
      });

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 개별 액션 처리
   */
  private async processAction(action: QueuedAction): Promise<void> {
    switch (action.type) {
      case 'CANCEL_APPLICATION':
        await applicationService.cancel(action.payload.applicationId);
        break;

      case 'UPDATE_PROFILE':
        await profileService.update(
          action.payload.userId,
          action.payload.data
        );
        break;

      case 'UPDATE_SETTINGS':
        // 설정 업데이트 로직
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * 큐 조회
   */
  getQueue(): QueuedAction[] {
    const data = queueStorage.getString(this.QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * 큐 저장
   */
  private saveQueue(queue: QueuedAction[]): void {
    queueStorage.set(this.QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * 큐 클리어
   */
  clearQueue(): void {
    queueStorage.delete(this.QUEUE_KEY);
  }

  /**
   * 대기 중인 액션 수
   */
  getPendingCount(): number {
    return this.getQueue().length;
  }

  /**
   * 특정 타입의 대기 액션 확인
   */
  hasPendingAction(type: QueuedAction['type'], payload?: Partial<any>): boolean {
    const queue = this.getQueue();
    return queue.some((action) => {
      if (action.type !== type) return false;
      if (!payload) return true;

      return Object.entries(payload).every(
        ([key, value]) => action.payload[key] === value
      );
    });
  }
}

export const offlineQueueManager = new OfflineQueueManager();
```

### 큐 상태 UI

```typescript
// src/components/OfflineQueueStatus.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { offlineQueueManager } from '@/lib/offlineQueue';
import { useNetwork } from '@/providers/NetworkProvider';

export function OfflineQueueStatus() {
  const { isOffline } = useNetwork();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['offlineQueue', 'count'],
    queryFn: () => offlineQueueManager.getPendingCount(),
    refetchInterval: isOffline ? 5000 : false, // 오프라인일 때만 갱신
  });

  if (pendingCount === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.count}>{pendingCount}</Text>
      </View>
      <Text style={styles.text}>
        대기 중인 작업 {pendingCount}개
      </Text>
      {!isOffline && (
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => offlineQueueManager.processQueue()}
        >
          <Text style={styles.syncText}>지금 동기화</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#f59e0b',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  count: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  text: {
    flex: 1,
    color: '#92400e',
    fontSize: 14,
  },
  syncButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
```

---

## 6.1 충돌 해결 전략 (Conflict Resolution)

### 개요

오프라인에서 동일 데이터를 수정하면 온라인 복귀 시 충돌이 발생할 수 있습니다.

```yaml
충돌 시나리오:
  - 동일 문서 동시 수정 (사용자 A 오프라인 + 사용자 B 온라인)
  - 오프라인 중 서버 데이터 변경
  - 동일 사용자의 다중 기기 동기화

해결 전략:
  기본: Last-Write-Wins (LWW) + Version Vector
  고급: Field-level Merge (필드별 병합)
  사용자 개입: Conflict UI (수동 선택)
```

### Version Vector 기반 충돌 감지

```typescript
// src/lib/conflictResolution.ts
import firestore from '@react-native-firebase/firestore';

interface VersionedDocument {
  id: string;
  _version: number;
  _updatedAt: firestore.Timestamp;
  _updatedBy: string;
  [key: string]: any;
}

interface ConflictResult<T> {
  hasConflict: boolean;
  resolution: 'local' | 'server' | 'merge' | 'manual';
  resolvedData: T;
  conflictDetails?: {
    localVersion: number;
    serverVersion: number;
    conflictingFields: string[];
  };
}

/**
 * 충돌 감지 및 해결
 */
export async function resolveConflict<T extends VersionedDocument>(
  collectionPath: string,
  localData: T,
  strategy: 'lww' | 'field-merge' | 'manual' = 'lww'
): Promise<ConflictResult<T>> {
  // 1. 서버 최신 데이터 조회
  const serverDoc = await firestore()
    .collection(collectionPath)
    .doc(localData.id)
    .get();

  if (!serverDoc.exists) {
    // 서버에 문서 없음 → 로컬 데이터 사용
    return {
      hasConflict: false,
      resolution: 'local',
      resolvedData: localData,
    };
  }

  const serverData = serverDoc.data() as T;

  // 2. 버전 비교
  if (localData._version >= serverData._version) {
    // 로컬이 최신 또는 동일 → 충돌 없음
    return {
      hasConflict: false,
      resolution: 'local',
      resolvedData: localData,
    };
  }

  // 3. 충돌 감지됨 → 전략에 따라 해결
  const conflictingFields = detectConflictingFields(localData, serverData);

  if (conflictingFields.length === 0) {
    // 필드 충돌 없음 → 서버 데이터 + 로컬 변경사항 병합
    return {
      hasConflict: false,
      resolution: 'merge',
      resolvedData: { ...serverData, ...getLocalChanges(localData, serverData) },
    };
  }

  // 4. 전략별 해결
  switch (strategy) {
    case 'lww':
      return resolveLWW(localData, serverData, conflictingFields);

    case 'field-merge':
      return resolveFieldMerge(localData, serverData, conflictingFields);

    case 'manual':
      return {
        hasConflict: true,
        resolution: 'manual',
        resolvedData: serverData,
        conflictDetails: {
          localVersion: localData._version,
          serverVersion: serverData._version,
          conflictingFields,
        },
      };

    default:
      return resolveLWW(localData, serverData, conflictingFields);
  }
}

/**
 * Last-Write-Wins 전략
 */
function resolveLWW<T extends VersionedDocument>(
  localData: T,
  serverData: T,
  conflictingFields: string[]
): ConflictResult<T> {
  const localTime = localData._updatedAt?.toMillis() ?? 0;
  const serverTime = serverData._updatedAt?.toMillis() ?? 0;

  const winner = localTime > serverTime ? 'local' : 'server';
  const resolvedData = winner === 'local' ? localData : serverData;

  return {
    hasConflict: true,
    resolution: winner,
    resolvedData: {
      ...resolvedData,
      _version: Math.max(localData._version, serverData._version) + 1,
    },
    conflictDetails: {
      localVersion: localData._version,
      serverVersion: serverData._version,
      conflictingFields,
    },
  };
}

/**
 * 필드별 병합 전략
 */
function resolveFieldMerge<T extends VersionedDocument>(
  localData: T,
  serverData: T,
  conflictingFields: string[]
): ConflictResult<T> {
  const merged = { ...serverData };

  // 충돌 없는 필드는 로컬 값 사용
  for (const key of Object.keys(localData)) {
    if (!conflictingFields.includes(key) && key !== '_version' && key !== '_updatedAt') {
      merged[key] = localData[key];
    }
  }

  // 충돌 필드는 타임스탬프 기준 최신 값 사용
  for (const field of conflictingFields) {
    const localTime = localData._updatedAt?.toMillis() ?? 0;
    const serverTime = serverData._updatedAt?.toMillis() ?? 0;
    merged[field] = localTime > serverTime ? localData[field] : serverData[field];
  }

  merged._version = Math.max(localData._version, serverData._version) + 1;

  return {
    hasConflict: true,
    resolution: 'merge',
    resolvedData: merged as T,
    conflictDetails: {
      localVersion: localData._version,
      serverVersion: serverData._version,
      conflictingFields,
    },
  };
}

/**
 * 충돌 필드 감지
 */
function detectConflictingFields<T>(local: T, server: T): string[] {
  const conflicts: string[] = [];
  const skipFields = ['_version', '_updatedAt', '_updatedBy', 'id'];

  for (const key of Object.keys(local as object)) {
    if (skipFields.includes(key)) continue;

    if (JSON.stringify(local[key]) !== JSON.stringify(server[key])) {
      conflicts.push(key);
    }
  }

  return conflicts;
}

/**
 * 로컬 변경사항 추출
 */
function getLocalChanges<T>(local: T, server: T): Partial<T> {
  const changes: Partial<T> = {};
  const skipFields = ['_version', '_updatedAt', '_updatedBy', 'id'];

  for (const key of Object.keys(local as object)) {
    if (skipFields.includes(key)) continue;

    if (JSON.stringify(local[key]) !== JSON.stringify(server[key])) {
      changes[key as keyof T] = local[key as keyof T];
    }
  }

  return changes;
}
```

### 향상된 오프라인 큐 (충돌 해결 통합)

```typescript
// src/lib/offlineQueue.ts 업데이트
import { resolveConflict, ConflictResult } from './conflictResolution';

interface QueuedAction {
  id: string;
  type: 'CANCEL_APPLICATION' | 'UPDATE_PROFILE' | 'UPDATE_SETTINGS' | 'UPDATE_DOCUMENT';
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  conflictStrategy: 'lww' | 'field-merge' | 'manual';
  originalData?: any; // 오프라인 시점의 원본 데이터
}

interface ProcessResult {
  success: boolean;
  conflict?: ConflictResult<any>;
  error?: Error;
}

class OfflineQueueManagerV2 {
  private readonly QUEUE_KEY = 'pending_actions_v2';
  private isProcessing = false;
  private conflictCallbacks: Map<string, (conflict: ConflictResult<any>) => Promise<any>> = new Map();

  /**
   * 충돌 해결 콜백 등록
   */
  registerConflictHandler(
    actionType: string,
    handler: (conflict: ConflictResult<any>) => Promise<any>
  ): void {
    this.conflictCallbacks.set(actionType, handler);
  }

  /**
   * 개별 액션 처리 (충돌 해결 포함)
   */
  private async processActionWithConflictResolution(
    action: QueuedAction
  ): Promise<ProcessResult> {
    try {
      // 일반 액션 처리
      if (action.type !== 'UPDATE_DOCUMENT') {
        await this.processSimpleAction(action);
        return { success: true };
      }

      // 문서 업데이트 → 충돌 해결 필요
      const { collectionPath, documentId, data } = action.payload;

      const conflictResult = await resolveConflict(
        collectionPath,
        { id: documentId, ...data, ...action.originalData },
        action.conflictStrategy
      );

      if (!conflictResult.hasConflict) {
        // 충돌 없음 → 바로 저장
        await this.saveDocument(collectionPath, documentId, conflictResult.resolvedData);
        return { success: true };
      }

      if (conflictResult.resolution === 'manual') {
        // 수동 해결 필요 → 콜백 호출
        const handler = this.conflictCallbacks.get(action.type);
        if (handler) {
          const userResolved = await handler(conflictResult);
          await this.saveDocument(collectionPath, documentId, userResolved);
          return { success: true, conflict: conflictResult };
        }
        // 핸들러 없음 → 서버 데이터 유지
        return { success: true, conflict: conflictResult };
      }

      // 자동 해결됨 → 저장
      await this.saveDocument(collectionPath, documentId, conflictResult.resolvedData);
      return { success: true, conflict: conflictResult };

    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  private async saveDocument(
    collectionPath: string,
    documentId: string,
    data: any
  ): Promise<void> {
    await firestore()
      .collection(collectionPath)
      .doc(documentId)
      .set(data, { merge: true });
  }

  private async processSimpleAction(action: QueuedAction): Promise<void> {
    switch (action.type) {
      case 'CANCEL_APPLICATION':
        await applicationService.cancel(action.payload.applicationId);
        break;
      case 'UPDATE_PROFILE':
        await profileService.update(action.payload.userId, action.payload.data);
        break;
      case 'UPDATE_SETTINGS':
        await settingsService.update(action.payload);
        break;
    }
  }

  // ... 기존 메서드들
}

export const offlineQueueManagerV2 = new OfflineQueueManagerV2();
```

### 충돌 해결 UI

```typescript
// src/components/ConflictResolutionModal.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConflictResult } from '@/lib/conflictResolution';

interface ConflictResolutionModalProps {
  visible: boolean;
  conflict: ConflictResult<any>;
  onResolve: (choice: 'local' | 'server' | 'merge') => void;
  onCancel: () => void;
}

export function ConflictResolutionModal({
  visible,
  conflict,
  onResolve,
  onCancel,
}: ConflictResolutionModalProps) {
  if (!conflict.conflictDetails) return null;

  return (
    <Modal visible={visible} onClose={onCancel} title="데이터 충돌 감지">
      <View style={styles.container}>
        <Text style={styles.description}>
          오프라인 중 변경한 데이터가 서버와 충돌합니다.
          어떤 버전을 사용하시겠습니까?
        </Text>

        <Text style={styles.sectionTitle}>충돌 필드:</Text>
        <ScrollView style={styles.fieldList}>
          {conflict.conflictDetails.conflictingFields.map((field) => (
            <View key={field} style={styles.fieldItem}>
              <Text style={styles.fieldName}>{field}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.buttonGroup}>
          <Button
            variant="outline"
            onPress={() => onResolve('local')}
            style={styles.button}
          >
            내 변경사항 사용
          </Button>
          <Button
            variant="outline"
            onPress={() => onResolve('server')}
            style={styles.button}
          >
            서버 버전 사용
          </Button>
          <Button
            variant="primary"
            onPress={() => onResolve('merge')}
            style={styles.button}
          >
            자동 병합
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  description: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  fieldList: { maxHeight: 120, marginBottom: 16 },
  fieldItem: {
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  fieldName: { fontSize: 12, fontWeight: '500', color: '#92400e' },
  buttonGroup: { gap: 8 },
  button: { marginBottom: 8 },
});
```

### 충돌 해결 정책

```yaml
컬렉션별 기본 전략:
  users:
    전략: field-merge
    이유: 프로필 필드별 독립적 수정 가능
    예외: role 필드는 서버 우선

  applications:
    전략: lww
    이유: 상태 전이가 순차적 (pending → confirmed)
    예외: 취소는 항상 허용

  jobPostings:
    전략: server-wins
    이유: 구인자 데이터 일관성 중요

  workLogs:
    전략: manual
    이유: 출퇴근 기록 정확성 필수

  settings:
    전략: field-merge
    이유: 설정 항목별 독립적

충돌 알림:
  자동 해결: 토스트로 "동기화 완료 (충돌 자동 해결)"
  수동 필요: 모달로 선택 요청
  실패: 에러 토스트 + 재시도 버튼
```

---

## 7. 동기화 전략

### 백그라운드 동기화

```typescript
// src/lib/syncManager.ts
import { queryClient } from './queryClient';
import { offlineQueueManager } from './offlineQueue';
import { typedStorage } from './typedStorage';
import { analyticsService } from '@/services/analytics/AnalyticsService';
import { AppState, AppStateStatus } from 'react-native';

class SyncManager {
  private lastSyncTime: number = 0;
  private minSyncInterval = 5 * 60 * 1000; // 5분
  private appStateSubscription: any = null;

  /**
   * 동기화 매니저 초기화
   */
  initialize(): void {
    // 저장된 마지막 동기화 시간 복원
    const savedTime = typedStorage.get('cache.lastSync');
    if (savedTime) {
      this.lastSyncTime = savedTime;
    }

    // 앱 상태 변경 감지
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.appStateSubscription?.remove();
  }

  /**
   * 앱 상태 변경 핸들러
   */
  private async handleAppStateChange(state: AppStateStatus): Promise<void> {
    if (state === 'active') {
      // 앱이 포그라운드로 돌아왔을 때
      await this.syncIfNeeded();
    }
  }

  /**
   * 필요 시 동기화
   */
  async syncIfNeeded(): Promise<void> {
    const now = Date.now();

    if (now - this.lastSyncTime < this.minSyncInterval) {
      console.log('[SyncManager] Skipping sync, too soon');
      return;
    }

    await this.performSync();
  }

  /**
   * 전체 동기화 수행
   */
  async performSync(): Promise<void> {
    console.log('[SyncManager] Starting sync...');
    const startTime = Date.now();

    try {
      // 1. 오프라인 큐 처리
      await offlineQueueManager.processQueue();

      // 2. 주요 데이터 새로고침
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mySchedule'] }),
        queryClient.invalidateQueries({ queryKey: ['myApplications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);

      // 3. 마지막 동기화 시간 저장
      this.lastSyncTime = Date.now();
      typedStorage.set('cache.lastSync', this.lastSyncTime);

      const duration = Date.now() - startTime;
      console.log(`[SyncManager] Sync completed in ${duration}ms`);

      // 분석 이벤트
      await analyticsService.logEvent('sync_completed', {
        duration,
        queueProcessed: offlineQueueManager.getPendingCount() === 0,
      });

    } catch (error) {
      console.error('[SyncManager] Sync failed:', error);

      await analyticsService.logEvent('sync_failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * 강제 동기화
   */
  async forceSync(): Promise<void> {
    this.lastSyncTime = 0; // 인터벌 무시
    await this.performSync();
  }

  /**
   * 마지막 동기화 시간 조회
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime ? new Date(this.lastSyncTime) : null;
  }
}

export const syncManager = new SyncManager();
```

### Pull-to-Refresh 통합

```typescript
// src/components/SyncableList.tsx
import React, { useState, useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNetwork } from '@/providers/NetworkProvider';
import { syncManager } from '@/lib/syncManager';

interface SyncableListProps<T> {
  data: T[];
  renderItem: ({ item }: { item: T }) => React.ReactElement;
  keyExtractor: (item: T) => string;
  onRefresh?: () => Promise<void>;
  estimatedItemSize: number;
  ListEmptyComponent?: React.ComponentType;
  ListHeaderComponent?: React.ComponentType;
}

export function SyncableList<T>({
  data,
  renderItem,
  keyExtractor,
  onRefresh,
  estimatedItemSize,
  ListEmptyComponent,
  ListHeaderComponent,
}: SyncableListProps<T>) {
  const [refreshing, setRefreshing] = useState(false);
  const { isOffline } = useNetwork();

  const handleRefresh = useCallback(async () => {
    if (isOffline) return;

    setRefreshing(true);
    try {
      // 커스텀 리프레시 또는 전체 동기화
      if (onRefresh) {
        await onRefresh();
      } else {
        await syncManager.forceSync();
      }
    } finally {
      setRefreshing(false);
    }
  }, [isOffline, onRefresh]);

  return (
    <FlashList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={estimatedItemSize}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          enabled={!isOffline}
          tintColor={isOffline ? '#9ca3af' : '#3b82f6'}
          title={isOffline ? '오프라인 모드' : '당겨서 새로고침'}
        />
      }
    />
  );
}
```

---

## 8. 플랫폼별 고려사항

### 웹 플랫폼 (React Native Web)

```typescript
// src/lib/storage.web.ts
import { Platform } from 'react-native';

/**
 * 웹에서는 localStorage + IndexedDB 조합 사용
 */

// 작은 데이터: localStorage
export const webStorage = {
  get(key: string): string | null {
    if (Platform.OS !== 'web') return null;
    return localStorage.getItem(`uniqn_${key}`);
  },

  set(key: string, value: string): void {
    if (Platform.OS !== 'web') return;
    localStorage.setItem(`uniqn_${key}`, value);
  },

  remove(key: string): void {
    if (Platform.OS !== 'web') return;
    localStorage.removeItem(`uniqn_${key}`);
  },
};

// 큰 데이터: IndexedDB
class IndexedDBStorage {
  private dbName = 'uniqn-cache';
  private storeName = 'cache';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (Platform.OS !== 'web') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result ?? null);
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

export const indexedDBStorage = new IndexedDBStorage();
```

### Service Worker 캐싱 (PWA)

```typescript
// public/sw.js (웹 전용)
const CACHE_NAME = 'uniqn-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
];

// 설치 시 정적 자산 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  // API 요청
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 성공 응답 캐시
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 오프라인: 캐시된 응답 반환
          return caches.match(event.request);
        })
    );
    return;
  }

  // 정적 자산: 캐시 우선
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
```

---

## 요약

### 오프라인 지원 체크리스트

#### 네트워크 감지
- [x] NetInfo 구독 설정
- [x] 웹 플랫폼 대응 (navigator.onLine)
- [x] 오프라인 배너 UI
- [x] 네트워크 상태 Context

#### 캐싱
- [x] TanStack Query 캐시 설정
- [x] MMKV 영속 스토리지
- [x] 쿼리별 캐시 전략
- [x] 웹 IndexedDB 대응

#### Optimistic Updates
- [x] 지원 취소 optimistic update
- [x] 프로필 업데이트 optimistic update
- [x] 롤백 처리

#### 오프라인 큐
- [x] 큐 매니저 구현
- [x] 액션 타입 정의
- [x] 재시도 로직
- [x] 큐 상태 UI

#### 동기화
- [x] 백그라운드 동기화
- [x] 앱 포그라운드 동기화
- [x] Pull-to-refresh 통합
- [x] 강제 동기화 기능

---

## 관련 문서

- [03-state-management.md](./03-state-management.md) - 상태 관리 전략
- [08-data-flow.md](./08-data-flow.md) - 데이터 흐름 패턴
- [21-react-native-web.md](./21-react-native-web.md) - React Native Web 전략
