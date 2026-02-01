# 03. 상태 관리 전략

> **마지막 업데이트**: 2025년 2월

## 상태 관리 개요

### 기존 웹앱 문제점
```
❌ 3가지 상태 관리 혼용
   - Context API (AuthContext, ThemeContext)
   - Zustand (unifiedDataStore, toastStore, tournamentStore)
   - React Query (서버 데이터)

❌ Provider 8단계 중첩
❌ Context → Zustand 마이그레이션 중간 상태
❌ 불명확한 책임 분리
```

### 현재 구현 구조 (개선 완료)
```
┌─────────────────────────────────────────────────────────────┐
│                    State Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │   Zustand Stores (9개)  │  │   TanStack Query        │  │
│  │    (Client State)       │  │   (Server State)        │  │
│  ├─────────────────────────┤  ├─────────────────────────┤  │
│  │ • authStore (12.8KB)    │  │ • jobPostings           │  │
│  │ • themeStore (5.6KB)    │  │ • applications          │  │
│  │ • toastStore (4.0KB)    │  │ • schedules             │  │
│  │ • modalStore (5.2KB)    │  │ • notifications         │  │
│  │ • notificationStore     │  │ • workLogs              │  │
│  │   (13.8KB)              │  │ • settlements           │  │
│  │ • inAppMessageStore     │  │ • confirmedStaff        │  │
│  │   (6.7KB)               │  │ • templates             │  │
│  │ • bookmarkStore (5.7KB) │  │ • eventQR               │  │
│  │ • tabFiltersStore(5.6KB)│  │ • admin (users, reports)│  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│                                                             │
│  책임 분리:                                                  │
│  • Zustand: UI 상태, 세션 데이터, 사용자 설정 (MMKV 영구저장)│
│  • Query: 서버 데이터 캐싱, 동기화, 무효화 (14개 도메인)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Zustand Stores (9개 - 현재 구현)

### 스토어 목록 요약
| 스토어 | 크기 | 용도 | 영구저장 |
|--------|------|------|----------|
| authStore | 12.8KB | 인증 상태, 프로필 | MMKV |
| themeStore | 5.6KB | 테마 (light/dark/system) | MMKV |
| toastStore | 4.0KB | Toast 알림 (최대 3개) | - |
| modalStore | 5.2KB | 모달 스택 관리 | - |
| notificationStore | 13.8KB | 알림, 카테고리별 필터 | MMKV |
| inAppMessageStore | 6.7KB | 우선순위 큐 기반 메시지 | MMKV |
| bookmarkStore | 5.7KB | 북마크/즐겨찾기 | MMKV |
| tabFiltersStore | 5.6KB | 탭별 필터 상태 | - |

### 1. authStore - 인증 상태 (12.8KB)
```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKVStorage } from '@/lib/mmkvStorage';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  // State
  user: FirebaseUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  error: string | null;
  _hasHydrated: boolean;

  // Computed (프로필에서 직접 계산)
  isAdmin: boolean;
  isEmployer: boolean;
  isStaff: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      profile: null,
      status: 'idle',
      error: null,
      _hasHydrated: false,

      // Computed getters (profile.role에서 직접 계산)
      get isAdmin() { return get().profile?.role === 'admin'; },
      get isEmployer() {
        const role = get().profile?.role;
        return role === 'admin' || role === 'employer';
      },
      get isStaff() {
        const role = get().profile?.role;
        return role === 'admin' || role === 'employer' || role === 'staff';
      },
      get isAuthenticated() { return get().status === 'authenticated'; },
      get isLoading() { return get().status === 'loading'; },

      // Actions
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error }),
      logout: () => set({
        user: null,
        profile: null,
        status: 'unauthenticated',
        error: null,
      }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => MMKVStorage),
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        status: state.status,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
```

### 2. themeStore - 테마 상태
```typescript
// src/stores/themeStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  // State
  mode: ThemeMode;
  isDark: boolean;

  // Actions
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;

  // Internal
  _updateIsDark: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDark: Appearance.getColorScheme() === 'dark',

      setMode: (mode) => {
        set({ mode });
        get()._updateIsDark();
      },

      toggleTheme: () => {
        const newMode = get().isDark ? 'light' : 'dark';
        set({ mode: newMode });
        get()._updateIsDark();
      },

      _updateIsDark: () => {
        const { mode } = get();
        let isDark: boolean;

        if (mode === 'system') {
          isDark = Appearance.getColorScheme() === 'dark';
        } else {
          isDark = mode === 'dark';
        }

        set({ isDark });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        // 복원 후 isDark 업데이트
        state?._updateIsDark();
      },
    }
  )
);

// 시스템 테마 변경 리스너 설정
Appearance.addChangeListener(() => {
  const { mode, _updateIsDark } = useThemeStore.getState();
  if (mode === 'system') {
    _updateIsDark();
  }
});
```

### 3. toastStore - 토스트 알림
```typescript
// src/stores/toastStore.ts
import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  hide: (id: string) => void;
  hideAll: () => void;
}

let toastId = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (toast) => {
    const id = `toast-${++toastId}`;
    const newToast: Toast = {
      id,
      duration: 3000,
      ...toast,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // 자동 제거
    if (newToast.duration) {
      setTimeout(() => {
        get().hide(id);
      }, newToast.duration);
    }

    return id;
  },

  hide: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  hideAll: () => set({ toasts: [] }),
}));

// 편의 함수
export const toast = {
  success: (message: string) =>
    useToastStore.getState().show({ type: 'success', message }),
  error: (message: string) =>
    useToastStore.getState().show({ type: 'error', message }),
  warning: (message: string) =>
    useToastStore.getState().show({ type: 'warning', message }),
  info: (message: string) =>
    useToastStore.getState().show({ type: 'info', message }),
};
```

### 4. modalStore - 모달 관리
```typescript
// src/stores/modalStore.ts
import { create } from 'zustand';
import { ReactNode } from 'react';

type ModalType =
  | 'confirm'
  | 'alert'
  | 'bottom-sheet'
  | 'full-screen'
  | 'custom';

interface ModalConfig {
  id: string;
  type: ModalType;
  title?: string;
  message?: string;
  content?: ReactNode;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  dangerous?: boolean;
  data?: unknown;
}

interface ModalState {
  modals: ModalConfig[];
  activeModal: ModalConfig | null;

  // Actions
  show: (config: Omit<ModalConfig, 'id'>) => string;
  hide: (id?: string) => void;
  hideAll: () => void;

  // 편의 메서드
  confirm: (options: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    dangerous?: boolean;
  }) => void;
  alert: (title: string, message: string) => void;
}

let modalId = 0;

export const useModalStore = create<ModalState>((set, get) => ({
  modals: [],
  activeModal: null,

  show: (config) => {
    const id = `modal-${++modalId}`;
    const modal: ModalConfig = { id, ...config };

    set((state) => ({
      modals: [...state.modals, modal],
      activeModal: modal,
    }));

    return id;
  },

  hide: (id) => {
    set((state) => {
      const targetId = id ?? state.activeModal?.id;
      const newModals = state.modals.filter((m) => m.id !== targetId);
      return {
        modals: newModals,
        activeModal: newModals[newModals.length - 1] ?? null,
      };
    });
  },

  hideAll: () => set({ modals: [], activeModal: null }),

  confirm: ({ title, message, onConfirm, dangerous }) => {
    get().show({
      type: 'confirm',
      title,
      message,
      onConfirm,
      dangerous,
      confirmText: dangerous ? '삭제' : '확인',
      cancelText: '취소',
    });
  },

  alert: (title, message) => {
    get().show({
      type: 'alert',
      title,
      message,
      confirmText: '확인',
    });
  },
}));
```

### 5. filterStore - 필터 상태
```typescript
// src/stores/filterStore.ts
import { create } from 'zustand';

// 구인구직 필터
interface JobFilters {
  location: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  postingType: ('regular' | 'fixed' | 'urgent')[];
  roles: string[];
  searchQuery: string;
}

// 스케줄 필터
interface ScheduleFilters {
  status: ('applied' | 'confirmed' | 'completed' | 'cancelled')[];
  dateFrom: string | null;
  dateTo: string | null;
}

interface FilterState {
  jobFilters: JobFilters;
  scheduleFilters: ScheduleFilters;

  setJobFilters: (filters: Partial<JobFilters>) => void;
  resetJobFilters: () => void;

  setScheduleFilters: (filters: Partial<ScheduleFilters>) => void;
  resetScheduleFilters: () => void;
}

const initialJobFilters: JobFilters = {
  location: [],
  salaryMin: null,
  salaryMax: null,
  dateFrom: null,
  dateTo: null,
  postingType: [],
  roles: [],
  searchQuery: '',
};

const initialScheduleFilters: ScheduleFilters = {
  status: [],
  dateFrom: null,
  dateTo: null,
};

export const useFilterStore = create<FilterState>((set) => ({
  jobFilters: initialJobFilters,
  scheduleFilters: initialScheduleFilters,

  setJobFilters: (filters) =>
    set((state) => ({
      jobFilters: { ...state.jobFilters, ...filters },
    })),

  resetJobFilters: () => set({ jobFilters: initialJobFilters }),

  setScheduleFilters: (filters) =>
    set((state) => ({
      scheduleFilters: { ...state.scheduleFilters, ...filters },
    })),

  resetScheduleFilters: () =>
    set({ scheduleFilters: initialScheduleFilters }),
}));
```

---

## TanStack Query 설정

### Query Client 설정
```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

// 온라인 상태 관리
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 캐시 시간
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분 (구 cacheTime)

      // 재시도
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // 리페치 전략
      refetchOnWindowFocus: false, // 모바일에서는 불필요
      refetchOnReconnect: true,
      refetchOnMount: true,

      // 네트워크 모드
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

// 전역 캐싱 정책 (컬렉션별 최적화)
export const cachingPolicies = {
  // 자주 변경되는 데이터 (실시간성 중요)
  realtime: {
    staleTime: 0,
    gcTime: 5 * 60 * 1000, // 5분
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    examples: ['notifications', 'unreadCount'],
  },

  // 자주 변경되는 데이터 (목록)
  frequent: {
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000, // 10분
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    examples: ['jobPostings.list', 'applications.mine'],
  },

  // 보통 빈도 (상세 정보)
  standard: {
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 30 * 60 * 1000, // 30분
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    examples: ['jobPostings.detail', 'users.profile'],
  },

  // 드물게 변경 (설정, 정적 데이터)
  stable: {
    staleTime: 30 * 60 * 1000, // 30분
    gcTime: 24 * 60 * 60 * 1000, // 24시간
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    examples: ['settings', 'regions', 'roles'],
  },

  // 오프라인 우선 (캐시 최우선)
  offlineFirst: {
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7일
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    networkMode: 'offlineFirst',
    examples: ['mySchedule', 'cachedJobPostings'],
  },
} as const;

// 캐싱 정책 적용 헬퍼
export function getCacheConfig(policy: keyof typeof cachingPolicies) {
  const config = cachingPolicies[policy];
  return {
    staleTime: config.staleTime,
    gcTime: config.gcTime,
    refetchOnMount: config.refetchOnMount,
    refetchOnWindowFocus: config.refetchOnWindowFocus,
    ...(config.networkMode && { networkMode: config.networkMode }),
  };
}

// Query Keys 중앙 관리
export const queryKeys = {
  // 구인공고
  jobPostings: {
    all: ['jobPostings'] as const,
    list: (filters: object) => ['jobPostings', 'list', filters] as const,
    detail: (id: string) => ['jobPostings', 'detail', id] as const,
    mine: () => ['jobPostings', 'mine'] as const,
  },

  // 지원
  applications: {
    all: ['applications'] as const,
    list: (jobId: string) => ['applications', 'list', jobId] as const,
    mine: () => ['applications', 'mine'] as const,
  },

  // 스케줄
  schedules: {
    all: ['schedules'] as const,
    list: (filters: object) => ['schedules', 'list', filters] as const,
    detail: (id: string) => ['schedules', 'detail', id] as const,
  },

  // 알림
  notifications: {
    all: ['notifications'] as const,
    list: (filters?: object) => ['notifications', 'list', filters] as const,
    unreadCount: () => ['notifications', 'unreadCount'] as const,
  },

  // 사용자
  users: {
    all: ['users'] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
    profile: () => ['users', 'profile'] as const,
  },

  // 문의
  inquiries: {
    all: ['inquiries'] as const,
    list: () => ['inquiries', 'list'] as const,
    mine: () => ['inquiries', 'mine'] as const,
  },
};
```

### Query Hooks 예시

#### 구인공고 조회
```typescript
// src/hooks/useJobPostings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { jobPostingService } from '@/services/job/jobPostingService';
import { useFilterStore } from '@/stores/filterStore';
import { toast } from '@/stores/toastStore';
import type { JobPosting, JobFilters } from '@/types';

// 목록 조회
export function useJobPostings() {
  const filters = useFilterStore((s) => s.jobFilters);

  return useQuery({
    queryKey: queryKeys.jobPostings.list(filters),
    queryFn: () => jobPostingService.getFiltered(filters),
    staleTime: 2 * 60 * 1000, // 2분 (목록은 더 자주 갱신)
  });
}

// 상세 조회
export function useJobPosting(id: string) {
  return useQuery({
    queryKey: queryKeys.jobPostings.detail(id),
    queryFn: () => jobPostingService.getById(id),
    enabled: !!id,
  });
}

// 지원하기
export function useApplyJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      jobId,
      data,
    }: {
      jobId: string;
      data: ApplicationData;
    }) => jobPostingService.apply(jobId, data),

    onSuccess: (_, { jobId }) => {
      // 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: queryKeys.jobPostings.detail(jobId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.applications.mine(),
      });

      toast.success('지원이 완료되었습니다');
    },

    onError: (error: Error) => {
      toast.error(error.message || '지원에 실패했습니다');
    },
  });
}
```

#### 스케줄 조회
```typescript
// src/hooks/useSchedule.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { scheduleService } from '@/services/schedule/scheduleService';
import { useFilterStore } from '@/stores/filterStore';

export function useMySchedule() {
  const filters = useFilterStore((s) => s.scheduleFilters);

  return useQuery({
    queryKey: queryKeys.schedules.list(filters),
    queryFn: () => scheduleService.getMySchedule(filters),
  });
}

export function useScheduleDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.schedules.detail(id),
    queryFn: () => scheduleService.getById(id),
    enabled: !!id,
  });
}
```

#### 알림 조회
```typescript
// src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { notificationService } from '@/services/notification/notificationService';

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => notificationService.getAll(),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30 * 1000, // 30초마다 갱신
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });
}
```

---

## 실시간 데이터 (Firebase Subscription)

### useFirestoreSubscription 훅
```typescript
// src/hooks/useFirestoreSubscription.ts
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  onSnapshot,
  QueryConstraint,
} from '@react-native-firebase/firestore';
import { db } from '@/lib/firebase';

interface SubscriptionOptions<T> {
  queryKey: readonly unknown[];
  collectionPath: string;
  constraints?: QueryConstraint[];
  transform?: (data: any) => T;
}

export function useFirestoreSubscription<T>({
  queryKey,
  collectionPath,
  constraints = [],
  transform,
}: SubscriptionOptions<T>) {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const q = query(collection(db, collectionPath), ...constraints);

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const docData = { id: doc.id, ...doc.data() };
          return transform ? transform(docData) : docData;
        });

        // Query Client 캐시 업데이트
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
      }
    );

    return () => {
      unsubscribeRef.current?.();
    };
  }, [collectionPath, JSON.stringify(constraints)]);
}

// 사용 예시
function useRealtimeNotifications() {
  const { user } = useAuthStore();

  useFirestoreSubscription({
    queryKey: queryKeys.notifications.list(),
    collectionPath: `users/${user?.uid}/notifications`,
    constraints: [orderBy('createdAt', 'desc'), limit(50)],
    transform: (doc) => ({
      ...doc,
      createdAt: doc.createdAt?.toDate(),
    }),
  });

  // Query로 데이터 접근
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => [], // 초기값, 실시간 업데이트로 대체됨
    staleTime: Infinity, // 실시간이므로 항상 fresh
  });
}
```

---

## 상태 흐름 예시

### 로그인 플로우
```typescript
// 1. 로그인 화면에서 로그인 시도
const handleLogin = async (email: string, password: string) => {
  try {
    // Firebase Auth 로그인
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    // Firestore에서 사용자 프로필 조회
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    const userData = userDoc.data();

    // Zustand Store 업데이트
    useAuthStore.getState().setUser({
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userData?.displayName,
      role: userData?.role ?? 'user',
      consentCompleted: userData?.consentCompleted ?? false,
      profileCompleted: userData?.profileCompleted ?? false,
    });

    // 네비게이션은 useAuthGuard에서 자동 처리
  } catch (error) {
    useAuthStore.getState().setError(getErrorMessage(error));
  }
};

// 2. 앱 초기화 시 (useAppInitialize)
const useAppInitialize = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // 사용자 데이터 조회 및 Store 업데이트
        const userData = await fetchUserData(firebaseUser.uid);
        useAuthStore.getState().setUser(userData);
      } else {
        useAuthStore.getState().logout();
      }
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  return { isReady };
};
```

### 구인공고 지원 플로우
```typescript
// JobDetailScreen.tsx
function JobDetailScreen({ id }: { id: string }) {
  // 1. 공고 데이터 조회 (Query)
  const { data: job, isLoading } = useJobPosting(id);

  // 2. 지원 mutation
  const applyMutation = useApplyJob();

  // 3. 모달 상태 (Zustand)
  const { show: showModal } = useModalStore();

  const handleApply = () => {
    showModal({
      type: 'confirm',
      title: '지원 확인',
      message: `${job?.title}에 지원하시겠습니까?`,
      onConfirm: async () => {
        await applyMutation.mutateAsync({
          jobId: id,
          data: { /* application data */ },
        });
        // 성공 시 toast는 mutation의 onSuccess에서 처리
      },
    });
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <View>
      <Text>{job?.title}</Text>
      <Button onPress={handleApply} loading={applyMutation.isPending}>
        지원하기
      </Button>
    </View>
  );
}
```

---

## 오프라인 지원

### 오프라인 상태 관리
```typescript
// src/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [networkType, setNetworkType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!state.isConnected);
      setNetworkType(state.type);
    });

    return unsubscribe;
  }, []);

  return { isOnline, networkType };
}
```

### 오프라인 큐 (Mutation)
```typescript
// src/lib/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

interface QueuedMutation {
  id: string;
  type: string;
  data: unknown;
  timestamp: number;
}

const QUEUE_KEY = 'offline-mutation-queue';

export const offlineQueue = {
  add: async (mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) => {
    const queue = await offlineQueue.getAll();
    const newItem: QueuedMutation = {
      ...mutation,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    queue.push(newItem);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  getAll: async (): Promise<QueuedMutation[]> => {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  },

  remove: async (id: string) => {
    const queue = await offlineQueue.getAll();
    const filtered = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },

  clear: async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  // 온라인 복귀 시 큐 처리
  processQueue: async () => {
    const queue = await offlineQueue.getAll();
    for (const item of queue) {
      try {
        await processMutation(item);
        await offlineQueue.remove(item.id);
      } catch (error) {
        console.error('Failed to process queued mutation:', item.id);
      }
    }
  },
};
```
