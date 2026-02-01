# 03. 상태 관리 전략

> **마지막 업데이트**: 2026년 2월

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
│  │   Zustand Stores (8개)  │  │   TanStack Query        │  │
│  │    (Client State)       │  │   (Server State)        │  │
│  ├─────────────────────────┤  ├─────────────────────────┤  │
│  │ • authStore             │  │ • jobPostings           │  │
│  │ • themeStore            │  │ • applications          │  │
│  │ • toastStore            │  │ • schedules             │  │
│  │ • modalStore            │  │ • workLogs              │  │
│  │ • notificationStore     │  │ • notifications         │  │
│  │ • inAppMessageStore     │  │ • settlements           │  │
│  │ • bookmarkStore         │  │ • confirmedStaff        │  │
│  │ • tabFiltersStore       │  │ • templates             │  │
│  │                         │  │ • eventQR               │  │
│  │                         │  │ • admin (users, reports)│  │
│  │                         │  │ • tournaments           │  │
│  │                         │  │ • announcements         │  │
│  │                         │  │ • inquiries             │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│                                                             │
│  책임 분리:                                                  │
│  • Zustand: UI 상태, 세션 데이터, 사용자 설정 (MMKV 영구저장)│
│  • Query: 서버 데이터 캐싱, 동기화, 무효화 (16개 도메인)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Zustand Stores (8개 - 현재 구현)

### 스토어 목록 요약
| 스토어 | 용도 | 영구저장 |
|--------|------|----------|
| authStore | 인증 상태, 프로필, 역할 플래그 | MMKV |
| themeStore | 테마 (light/dark/system) | MMKV |
| toastStore | Toast 알림 (최대 3개) | - |
| modalStore | 모달 스택 관리 | - |
| notificationStore | 알림, 카테고리별 필터 | MMKV |
| inAppMessageStore | 우선순위 큐 기반 메시지 | MMKV |
| bookmarkStore | 북마크/즐겨찾기 | MMKV |
| tabFiltersStore | 탭별 필터 상태 | MMKV |

### 1. authStore - 인증 상태
```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { RoleResolver } from '@/shared/role';
import type { UserRole, UserProfile } from '@/types';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  // 상태
  user: AuthUser | null;
  profile: UserProfile | null;
  status: AuthStatus;
  isInitialized: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // 계산된 값 (profile.role에서 계산)
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isEmployer: boolean;
  isStaff: boolean;

  // 액션
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  initialize: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  reset: () => void;
  clearAuthState: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      profile: null,
      status: 'idle',
      isInitialized: false,
      error: null,
      _hasHydrated: false,
      isAuthenticated: false,
      isLoading: false,
      isAdmin: false,
      isEmployer: false,
      isStaff: false,

      // Firebase User -> AuthUser 변환 및 저장
      setUser: (firebaseUser) => {
        if (!firebaseUser) {
          set({
            user: null,
            status: 'unauthenticated',
            isAuthenticated: false,
            isAdmin: false,
            isEmployer: false,
            isStaff: false,
          });
          return;
        }

        const authUser: AuthUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          phoneNumber: firebaseUser.phoneNumber,
        };

        set({
          user: authUser,
          status: 'authenticated',
          isAuthenticated: true,
          error: null,
        });
      },

      // 프로필 설정 (RoleResolver로 역할 플래그 계산)
      setProfile: (profile) => {
        if (!profile) {
          set({
            profile: null,
            isAdmin: false,
            isEmployer: false,
            isStaff: false,
          });
          return;
        }

        // RoleResolver로 역할 플래그 계산 (이원화 해결)
        const roleFlags = RoleResolver.computeRoleFlags(profile.role);

        set({
          profile,
          ...roleFlags,
        });
      },

      setStatus: (status) => {
        set({
          status,
          isLoading: status === 'loading',
        });
      },

      setError: (error) => set({ error }),
      setInitialized: (initialized) => set({ isInitialized: initialized }),
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),

      initialize: async () => {
        const state = get();
        if (state.user) {
          set({
            status: 'authenticated',
            isAuthenticated: true,
            isInitialized: true,
          });
        } else {
          set({
            status: 'unauthenticated',
            isAuthenticated: false,
            isInitialized: true,
          });
        }
      },

      checkAuthState: async () => {
        const state = get();
        if (!state.isInitialized) {
          await get().initialize();
        }
      },

      reset: () => set({
        user: null,
        profile: null,
        status: 'idle',
        isInitialized: false,
        error: null,
        _hasHydrated: false,
        isAuthenticated: false,
        isLoading: false,
        isAdmin: false,
        isEmployer: false,
        isStaff: false,
      }),

      // 자동 로그인 비활성화 시 UI 상태만 초기화
      clearAuthState: () => set({
        user: null,
        profile: null,
        status: 'unauthenticated',
        isAuthenticated: false,
        isAdmin: false,
        isEmployer: false,
        isStaff: false,
        isInitialized: true,
        error: null,
      }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        isInitialized: state.isInitialized,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);

        // 복원된 profile 기반으로 역할 플래그 재계산
        if (state?.profile) {
          const roleFlags = RoleResolver.computeRoleFlags(state.profile.role);
          queueMicrotask(() => {
            useAuthStore.setState({
              ...roleFlags,
              isAuthenticated: !!state.user,
            });
          });
        }
      },
    }
  )
);

// ============================================================================
// Selectors (성능 최적화)
// ============================================================================

export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectIsAdmin = (state: AuthState) => state.isAdmin;
export const selectIsEmployer = (state: AuthState) => state.isEmployer;
export const selectIsStaff = (state: AuthState) => state.isStaff;
export const selectAuthStatus = (state: AuthState) => state.status;
export const selectHasHydrated = (state: AuthState) => state._hasHydrated;

// ============================================================================
// Utility Hooks
// ============================================================================

export const useIsAuthenticated = () => useAuthStore(selectIsAuthenticated);
export const useUser = () => useAuthStore(selectUser);
export const useProfile = () => useAuthStore(selectProfile);

/** 역할 기반 권한 체크 */
export const useHasRole = (requiredRole: UserRole) => {
  const profile = useAuthStore(selectProfile);
  if (!profile) return false;
  return RoleResolver.hasPermission(profile.role, requiredRole);
};

/** 권한 확인 유틸리티 함수 (훅 외부에서 사용) */
export function hasPermission(
  userRole: UserRole | string | null | undefined,
  requiredRole: UserRole
): boolean {
  return RoleResolver.hasPermission(userRole, requiredRole);
}

/** Hydration 완료 대기 유틸리티 */
export async function waitForHydration(timeout = 5000): Promise<boolean> {
  if (useAuthStore.getState()._hasHydrated) return true;

  return new Promise<boolean>((resolve) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      resolve(false);
    }, timeout);

    const unsubscribe = useAuthStore.subscribe((state) => {
      if (state._hasHydrated) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(true);
      }
    });
  });
}
```

### 2. themeStore - 테마 상태
```typescript
// src/stores/themeStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { Appearance, ColorSchemeName } from 'react-native';
import { colorScheme as nativeWindColorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDarkMode: boolean;
  _hasHydrated: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

const getSystemDarkMode = (): boolean => {
  return Appearance.getColorScheme() === 'dark';
};

const computeIsDarkMode = (mode: ThemeMode): boolean => {
  if (mode === 'system') return getSystemDarkMode();
  return mode === 'dark';
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      isDarkMode: getSystemDarkMode(),
      _hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),

      setTheme: (mode) => {
        nativeWindColorScheme.set(mode);
        set({
          mode,
          isDarkMode: computeIsDarkMode(mode),
        });
      },

      toggleTheme: () => {
        const currentMode = get().mode;
        let newMode: ThemeMode;

        if (currentMode === 'system') {
          newMode = getSystemDarkMode() ? 'light' : 'dark';
        } else {
          newMode = currentMode === 'light' ? 'dark' : 'light';
        }

        nativeWindColorScheme.set(newMode);
        set({
          mode: newMode,
          isDarkMode: computeIsDarkMode(newMode),
        });
      },
    }),
    {
      name: 'uniqn-theme',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const isDark = computeIsDarkMode(state.mode);
          const effectiveMode = state.mode === 'system'
            ? (isDark ? 'dark' : 'light')
            : state.mode;
          nativeWindColorScheme.set(effectiveMode);

          queueMicrotask(() => {
            useThemeStore.setState({ isDarkMode: isDark });
          });
          state.setHasHydrated(true);
        }
      },
    }
  )
);

// 시스템 테마 변경 리스너
Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const state = useThemeStore.getState();
  if (state.mode === 'system') {
    nativeWindColorScheme.set(colorScheme || 'light');
    useThemeStore.setState({ isDarkMode: colorScheme === 'dark' });
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
    const newToast: Toast = { id, duration: 3000, ...toast };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (newToast.duration) {
      setTimeout(() => get().hide(id), newToast.duration);
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

type ModalType = 'confirm' | 'alert' | 'bottom-sheet' | 'full-screen' | 'custom';

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
  show: (config: Omit<ModalConfig, 'id'>) => string;
  hide: (id?: string) => void;
  hideAll: () => void;
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

### 5. tabFiltersStore - 탭별 필터 상태
```typescript
// src/stores/tabFiltersStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import type { PostingType, ApplicationStatus } from '@/types';

// 구인구직 탭 필터
export interface JobTabFilters {
  postingType: PostingType | 'all';
  region: string | null;
  role: string | null;
  searchQuery: string;
  sortBy: 'newest' | 'deadline' | 'salary';
}

// 내 공고 탭 필터 (구인자용)
export interface EmployerTabFilters {
  status: 'all' | 'active' | 'closed';
}

// 스케줄 탭 필터
export interface ScheduleTabFilters {
  viewMode: 'calendar' | 'list';
  status: ApplicationStatus | 'all';
}

interface TabFiltersState {
  jobFilters: JobTabFilters;
  employerFilters: EmployerTabFilters;
  scheduleFilters: ScheduleTabFilters;

  setJobFilter: <K extends keyof JobTabFilters>(key: K, value: JobTabFilters[K]) => void;
  setJobFilters: (filters: Partial<JobTabFilters>) => void;
  resetJobFilters: () => void;

  setEmployerFilter: <K extends keyof EmployerTabFilters>(key: K, value: EmployerTabFilters[K]) => void;
  resetEmployerFilters: () => void;

  setScheduleFilter: <K extends keyof ScheduleTabFilters>(key: K, value: ScheduleTabFilters[K]) => void;
  resetScheduleFilters: () => void;

  resetAllFilters: () => void;
}

const DEFAULT_JOB_FILTERS: JobTabFilters = {
  postingType: 'all',
  region: null,
  role: null,
  searchQuery: '',
  sortBy: 'newest',
};

const DEFAULT_EMPLOYER_FILTERS: EmployerTabFilters = { status: 'all' };
const DEFAULT_SCHEDULE_FILTERS: ScheduleTabFilters = { viewMode: 'calendar', status: 'all' };

export const useTabFiltersStore = create<TabFiltersState>()(
  persist(
    (set) => ({
      jobFilters: { ...DEFAULT_JOB_FILTERS },
      employerFilters: { ...DEFAULT_EMPLOYER_FILTERS },
      scheduleFilters: { ...DEFAULT_SCHEDULE_FILTERS },

      setJobFilter: (key, value) => {
        set((state) => ({
          jobFilters: { ...state.jobFilters, [key]: value },
        }));
      },

      setJobFilters: (filters) => {
        set((state) => ({
          jobFilters: { ...state.jobFilters, ...filters },
        }));
      },

      resetJobFilters: () => set({ jobFilters: { ...DEFAULT_JOB_FILTERS } }),

      setEmployerFilter: (key, value) => {
        set((state) => ({
          employerFilters: { ...state.employerFilters, [key]: value },
        }));
      },

      resetEmployerFilters: () => set({ employerFilters: { ...DEFAULT_EMPLOYER_FILTERS } }),

      setScheduleFilter: (key, value) => {
        set((state) => ({
          scheduleFilters: { ...state.scheduleFilters, [key]: value },
        }));
      },

      resetScheduleFilters: () => set({ scheduleFilters: { ...DEFAULT_SCHEDULE_FILTERS } }),

      resetAllFilters: () => set({
        jobFilters: { ...DEFAULT_JOB_FILTERS },
        employerFilters: { ...DEFAULT_EMPLOYER_FILTERS },
        scheduleFilters: { ...DEFAULT_SCHEDULE_FILTERS },
      }),
    }),
    {
      name: 'uniqn-tab-filters',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        jobFilters: { ...state.jobFilters, searchQuery: '' },
        employerFilters: state.employerFilters,
        scheduleFilters: state.scheduleFilters,
      }),
    }
  )
);

// Selector Hooks
export const useJobFilters = () => useTabFiltersStore((state) => state.jobFilters);
export const useEmployerFilters = () => useTabFiltersStore((state) => state.employerFilters);
export const useScheduleFilters = () => useTabFiltersStore((state) => state.scheduleFilters);
```

### 6. notificationStore - 알림 상태
```typescript
// src/stores/notificationStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';

interface NotificationState {
  notifications: NotificationData[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
  lastFetchedAt: number | null;
  settings: NotificationSettings;
  filter: NotificationFilter;
  unreadByCategory: Record<string, number>;

  // 기본 액션
  setNotifications: (notifications: NotificationData[]) => void;
  addNotification: (notification: NotificationData) => void;
  addNotifications: (notifications: NotificationData[]) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // 읽음 처리
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  markCategoryAsRead: (category: string) => void;

  // 설정/필터
  setSettings: (settings: NotificationSettings) => void;
  setFilter: (filter: NotificationFilter) => void;
  clearFilter: () => void;

  // 상태 관리
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;

  // 유틸리티
  getFilteredNotifications: () => NotificationData[];
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // ... 구현 (증분 계산으로 성능 최적화)
    }),
    {
      name: 'notification-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        settings: state.settings,
        lastFetchedAt: state.lastFetchedAt,
        cachedNotifications: state.notifications.slice(0, 50),
      }),
    }
  )
);

// Selectors & Utility Hooks
export const useUnreadCount = () => useNotificationStore((state) => state.unreadCount);
export const useNotifications = () => useNotificationStore((state) => state.notifications);
export const useNotificationSettings = () => useNotificationStore((state) => state.settings);
```

---

## TanStack Query 설정

### Query Client 설정
```typescript
// src/lib/queryClient.ts
import { QueryClient, QueryCache, MutationCache, onlineManager } from '@tanstack/react-query';
import { Platform, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { normalizeError, isRetryableError, requiresReauthentication } from '@/errors';

// ============================================================================
// 오프라인 지원
// ============================================================================

export function initializeQueryListeners(): () => void {
  const subscriptions: (() => void)[] = [];

  // 웹 환경: navigator.onLine 사용
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const handleOnline = () => onlineManager.setOnline(true);
    const handleOffline = () => onlineManager.setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    onlineManager.setOnline(navigator.onLine);

    subscriptions.push(() => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  }

  // 네이티브 환경: NetInfo 연동
  if (Platform.OS !== 'web') {
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      onlineManager.setOnline(isOnline);
    });
    subscriptions.push(unsubscribeNetInfo);

    const appStateSubscription = AppState.addEventListener('change', () => {});
    subscriptions.push(() => appStateSubscription.remove());
  }

  return () => subscriptions.forEach((unsub) => unsub());
}

// ============================================================================
// 재시도 로직 (카테고리별 조건)
// ============================================================================

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;

  const appError = normalizeError(error);

  // 인증/권한/검증/비즈니스 에러는 재시도 안 함
  if (requiresReauthentication(appError)) return false;
  if (appError.category === 'permission') return false;
  if (appError.category === 'validation') return false;
  if (appError.category === 'business') return false;

  return isRetryableError(appError);
}

function getRetryDelay(attemptIndex: number): number {
  const baseDelay = 1000;
  const maxDelay = 30000;
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptIndex), maxDelay);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return exponentialDelay + jitter;
}

// ============================================================================
// Query/Mutation Cache 에러 핸들러
// ============================================================================

const queryCache = new QueryCache({
  onError: (error, query) => {
    const appError = normalizeError(error);
    logger.error('Query error', appError, { queryKey: query.queryKey });

    if (requiresReauthentication(appError)) {
      logger.warn('Authentication required');
    }
  },
});

const mutationCache = new MutationCache({
  onError: (error, _variables, _context, mutation) => {
    const appError = normalizeError(error);
    logger.error('Mutation error', appError, { mutationKey: mutation.options.mutationKey });
  },
});

// ============================================================================
// Query Client
// ============================================================================

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5분
      gcTime: 10 * 60 * 1000,         // 10분
      retry: shouldRetry,
      retryDelay: getRetryDelay,
      refetchOnWindowFocus: false,    // 모바일에서는 불필요
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: false,                   // 중복 생성 방지
      networkMode: 'offlineFirst',
    },
  },
});
```

### Query Keys 중앙 관리 (16개 도메인)
```typescript
// src/lib/queryClient.ts
export const queryKeys = {
  // 사용자
  user: {
    all: ['user'] as const,
    current: () => [...queryKeys.user.all, 'current'] as const,
    profile: (uid: string) => [...queryKeys.user.all, 'profile', uid] as const,
  },

  // 구인공고
  jobPostings: {
    all: ['jobPostings'] as const,
    lists: () => [...queryKeys.jobPostings.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.jobPostings.all, 'list', filters] as const,
    details: () => [...queryKeys.jobPostings.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobPostings.all, 'detail', id] as const,
    mine: () => [...queryKeys.jobPostings.all, 'mine'] as const,
  },

  // 지원서
  applications: {
    all: ['applications'] as const,
    lists: () => [...queryKeys.applications.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.applications.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.applications.all, 'detail', id] as const,
    mine: () => [...queryKeys.applications.all, 'mine'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.applications.all, 'byJobPosting', jobPostingId] as const,
  },

  // 스케줄
  schedules: {
    all: ['schedules'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.schedules.all, 'list', filters] as const,
    mine: () => [...queryKeys.schedules.all, 'mine'] as const,
    byDate: (date: string) => [...queryKeys.schedules.all, 'byDate', date] as const,
    byMonth: (year: number, month: number) =>
      [...queryKeys.schedules.all, 'byMonth', year, month] as const,
  },

  // 근무 기록
  workLogs: {
    all: ['workLogs'] as const,
    mine: () => [...queryKeys.workLogs.all, 'mine'] as const,
    byDate: (date: string) => [...queryKeys.workLogs.all, 'byDate', date] as const,
    bySchedule: (scheduleId: string) =>
      [...queryKeys.workLogs.all, 'bySchedule', scheduleId] as const,
  },

  // 알림
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: <T extends object>(filters: T) =>
      [...queryKeys.notifications.all, 'list', filters] as const,
    unread: () => [...queryKeys.notifications.all, 'unread'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unreadCount'] as const,
    settings: () => [...queryKeys.notifications.all, 'settings'] as const,
    permission: () => [...queryKeys.notifications.all, 'permission'] as const,
  },

  // 설정
  settings: {
    all: ['settings'] as const,
    user: () => [...queryKeys.settings.all, 'user'] as const,
    notification: () => [...queryKeys.settings.all, 'notification'] as const,
  },

  // ============================================================================
  // 구인자용 Query Keys
  // ============================================================================

  // 공고 관리
  jobManagement: {
    all: ['jobManagement'] as const,
    myPostings: () => [...queryKeys.jobManagement.all, 'myPostings'] as const,
    stats: () => [...queryKeys.jobManagement.all, 'stats'] as const,
  },

  // 공고 템플릿
  templates: {
    all: ['templates'] as const,
    list: () => [...queryKeys.templates.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.templates.all, 'detail', id] as const,
  },

  // 지원자 관리
  applicantManagement: {
    all: ['applicantManagement'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'byJobPosting', jobPostingId] as const,
    stats: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'stats', jobPostingId] as const,
    cancellationRequests: (jobPostingId: string) =>
      [...queryKeys.applicantManagement.all, 'cancellationRequests', jobPostingId] as const,
    canConvertToStaff: (applicationId: string) =>
      [...queryKeys.applicantManagement.all, 'canConvertToStaff', applicationId] as const,
  },

  // 정산
  settlement: {
    all: ['settlement'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.settlement.all, 'byJobPosting', jobPostingId] as const,
    summary: (jobPostingId: string) =>
      [...queryKeys.settlement.all, 'summary', jobPostingId] as const,
    mySummary: () => [...queryKeys.settlement.all, 'mySummary'] as const,
    calculation: (workLogId: string) =>
      [...queryKeys.settlement.all, 'calculation', workLogId] as const,
  },

  // 확정 스태프
  confirmedStaff: {
    all: ['confirmedStaff'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.confirmedStaff.all, 'byJobPosting', jobPostingId] as const,
    byDate: (jobPostingId: string, date: string) =>
      [...queryKeys.confirmedStaff.all, 'byDate', jobPostingId, date] as const,
    detail: (workLogId: string) =>
      [...queryKeys.confirmedStaff.all, 'detail', workLogId] as const,
    grouped: (jobPostingId: string) =>
      [...queryKeys.confirmedStaff.all, 'grouped', jobPostingId] as const,
  },

  // 이벤트 QR
  eventQR: {
    all: ['eventQR'] as const,
    current: (jobPostingId: string, date: string, action: 'checkIn' | 'checkOut') =>
      [...queryKeys.eventQR.all, 'current', jobPostingId, date, action] as const,
    history: (jobPostingId: string) =>
      [...queryKeys.eventQR.all, 'history', jobPostingId] as const,
  },

  // 신고
  reports: {
    all: ['reports'] as const,
    byJobPosting: (jobPostingId: string) =>
      [...queryKeys.reports.all, 'byJobPosting', jobPostingId] as const,
    byStaff: (staffId: string) =>
      [...queryKeys.reports.all, 'byStaff', staffId] as const,
    detail: (reportId: string) =>
      [...queryKeys.reports.all, 'detail', reportId] as const,
    myReports: () => [...queryKeys.reports.all, 'myReports'] as const,
  },

  // ============================================================================
  // 관리자용 Query Keys
  // ============================================================================

  // 대시보드
  admin: {
    all: ['admin'] as const,
    dashboard: () => [...queryKeys.admin.all, 'dashboard'] as const,
    users: (filters: Record<string, unknown>) =>
      [...queryKeys.admin.all, 'users', filters] as const,
    userDetail: (userId: string) =>
      [...queryKeys.admin.all, 'userDetail', userId] as const,
    metrics: () => [...queryKeys.admin.all, 'metrics'] as const,
  },

  // 대회공고 승인
  tournaments: {
    all: ['tournaments'] as const,
    pending: () => [...queryKeys.tournaments.all, 'pending'] as const,
    approved: () => [...queryKeys.tournaments.all, 'approved'] as const,
    rejected: () => [...queryKeys.tournaments.all, 'rejected'] as const,
    detail: (id: string) => [...queryKeys.tournaments.all, 'detail', id] as const,
    myPending: () => [...queryKeys.tournaments.all, 'myPending'] as const,
  },

  // 공지사항
  announcements: {
    all: ['announcements'] as const,
    published: (filters?: Record<string, unknown>) =>
      [...queryKeys.announcements.all, 'published', filters] as const,
    adminList: (filters?: Record<string, unknown>) =>
      [...queryKeys.announcements.all, 'admin', filters] as const,
    detail: (id: string) => [...queryKeys.announcements.all, 'detail', id] as const,
    unreadCount: () => [...queryKeys.announcements.all, 'unreadCount'] as const,
  },

  // 문의
  inquiries: {
    all: ['inquiries'] as const,
    mine: (userId?: string) => [...queryKeys.inquiries.all, 'mine', userId] as const,
    adminList: (filters?: Record<string, unknown>) =>
      [...queryKeys.inquiries.all, 'admin', filters] as const,
    detail: (id: string) => [...queryKeys.inquiries.all, 'detail', id] as const,
    unansweredCount: () => [...queryKeys.inquiries.all, 'unansweredCount'] as const,
    faq: (category?: string) => ['faq', category] as const,
  },
} as const;
```

### 캐싱 정책
```typescript
// src/lib/queryClient.ts

/**
 * 데이터 특성에 따른 staleTime 정책
 */
export const cachingPolicies = {
  /** 실시간 데이터 - 항상 fresh 체크 (settlement, workLogs) */
  realtime: 0,
  /** 자주 변경되는 데이터 - 2분 (schedules) */
  frequent: 2 * 60 * 1000,
  /** 보통 빈도 - 5분 (기본값: jobPostings, applications) */
  standard: 5 * 60 * 1000,
  /** 드물게 변경 - 30분 (settings, user profile) */
  stable: 30 * 60 * 1000,
  /** 오프라인 우선 - 무제한 */
  offlineFirst: Infinity,
} as const;

/**
 * 쿼리 도메인별 권장 캐싱 설정
 */
export const queryCachingOptions = {
  schedules: { staleTime: cachingPolicies.frequent, gcTime: 5 * 60 * 1000 },
  settlement: { staleTime: cachingPolicies.realtime, gcTime: 2 * 60 * 1000 },
  workLogs: { staleTime: cachingPolicies.realtime, gcTime: 2 * 60 * 1000 },
  jobPostings: { staleTime: cachingPolicies.standard, gcTime: 10 * 60 * 1000 },
  applications: { staleTime: cachingPolicies.standard, gcTime: 10 * 60 * 1000 },
  notifications: { staleTime: cachingPolicies.realtime, gcTime: 5 * 60 * 1000 },
  confirmedStaff: { staleTime: cachingPolicies.frequent, gcTime: 5 * 60 * 1000 },
  settings: { staleTime: cachingPolicies.stable, gcTime: 60 * 60 * 1000 },
  user: { staleTime: cachingPolicies.stable, gcTime: 60 * 60 * 1000 },
} as const;
```

### 캐시 무효화 유틸리티
```typescript
// src/lib/queryClient.ts

export const invalidateQueries = {
  jobPostings: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all }),
  applications: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
  schedules: () => queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
  workLogs: () => queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all }),
  notifications: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  user: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.all }),
  confirmedStaff: () => queryClient.invalidateQueries({ queryKey: queryKeys.confirmedStaff.all }),
  eventQR: () => queryClient.invalidateQueries({ queryKey: queryKeys.eventQR.all }),
  reports: () => queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
  settlement: () => queryClient.invalidateQueries({ queryKey: queryKeys.settlement.all }),
  tournaments: () => queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all }),
  announcements: () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all }),

  /** 스태프 관리 관련 모든 쿼리 무효화 */
  staffManagement: (jobPostingId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.confirmedStaff.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settlement.byJobPosting(jobPostingId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
  },

  /** 대회공고 승인 후 관련 데이터 무효화 */
  tournamentApproval: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.all });
  },

  all: () => queryClient.invalidateQueries(),
};

/**
 * 관계 기반 캐시 무효화
 */
export const invalidationGraph: Record<string, string[]> = {
  workLogs: ['schedules'],
  applications: ['schedules'],
};

export async function invalidateRelated(primaryKey: keyof typeof invalidationGraph): Promise<void> {
  const primaryInvalidate = invalidateQueries[primaryKey as keyof typeof invalidateQueries];
  if (typeof primaryInvalidate === 'function') {
    await primaryInvalidate();
  }

  const relatedKeys = invalidationGraph[primaryKey] || [];
  for (const relatedKey of relatedKeys) {
    const relatedInvalidate = invalidateQueries[relatedKey as keyof typeof invalidateQueries];
    if (typeof relatedInvalidate === 'function') {
      await relatedInvalidate();
    }
  }
}
```

---

## Query Hooks 사용 예시

### 구인공고 조회
```typescript
// src/hooks/useJobPostings.ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';
import { jobService } from '@/services/jobService';
import { useTabFiltersStore } from '@/stores/tabFiltersStore';
import { toast } from '@/stores/toastStore';

// 무한 스크롤 목록 조회
export function useJobPostings() {
  const filters = useTabFiltersStore((s) => s.jobFilters);

  return useInfiniteQuery({
    queryKey: queryKeys.jobPostings.list(filters),
    queryFn: ({ pageParam }) => jobService.getFiltered(filters, pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    ...queryCachingOptions.jobPostings,
  });
}

// 상세 조회
export function useJobPosting(id: string) {
  return useQuery({
    queryKey: queryKeys.jobPostings.detail(id),
    queryFn: () => jobService.getById(id),
    enabled: !!id,
    ...queryCachingOptions.jobPostings,
  });
}

// 지원하기 (Optimistic Update)
export function useApplyJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, data }) => jobService.apply(jobId, data),

    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobPostings.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.mine() });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });
      toast.success('지원이 완료되었습니다');
    },

    onError: (error: Error) => {
      toast.error(error.message || '지원에 실패했습니다');
    },
  });
}
```

### 스케줄 조회
```typescript
// src/hooks/useSchedules.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';
import { scheduleService } from '@/services/scheduleService';

export function useMySchedule() {
  return useQuery({
    queryKey: queryKeys.schedules.mine(),
    queryFn: () => scheduleService.getMySchedule(),
    ...queryCachingOptions.schedules,
  });
}

export function useSchedulesByMonth(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.schedules.byMonth(year, month),
    queryFn: () => scheduleService.getByMonth(year, month),
    ...queryCachingOptions.schedules,
  });
}
```

### 알림 조회
```typescript
// src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, queryCachingOptions } from '@/lib/queryClient';
import { notificationService } from '@/services/notificationService';

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.list({}),
    queryFn: () => notificationService.getAll(),
    ...queryCachingOptions.notifications,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30 * 1000, // 30초마다 갱신
    ...queryCachingOptions.notifications,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
```

---

## 실시간 데이터 (Firebase Subscription)

### RealtimeManager 활용
```typescript
// src/shared/realtime/RealtimeManager.ts
// 중앙화된 실시간 구독 관리

// Query Client와 연동하여 실시간 데이터를 캐시에 반영
RealtimeManager.subscribe('notifications', userId, (data) => {
  queryClient.setQueryData(queryKeys.notifications.list({}), data);
});

// 네트워크 상태 변경 시 자동 재연결
RealtimeManager.onNetworkReconnect();
RealtimeManager.onNetworkDisconnect();
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
    useAuthStore.getState().setUser(userCredential.user);
    useAuthStore.getState().setProfile(userData);

    // 네비게이션은 useAuthGuard에서 자동 처리
  } catch (error) {
    useAuthStore.getState().setError(getErrorMessage(error));
  }
};

// 2. 앱 초기화 시 (useAppInitialize)
// persist 미들웨어가 MMKV에서 자동 복원
// onRehydrateStorage에서 역할 플래그 재계산
```

### 구인공고 지원 플로우
```typescript
function JobDetailScreen({ id }: { id: string }) {
  // 1. 공고 데이터 조회 (Query)
  const { data: job, isLoading } = useJobPosting(id);

  // 2. 지원 mutation
  const applyMutation = useApplyJob();

  // 3. 모달 상태 (Zustand)
  const { confirm } = useModalStore();

  const handleApply = () => {
    confirm({
      title: '지원 확인',
      message: `${job?.title}에 지원하시겠습니까?`,
      onConfirm: async () => {
        await applyMutation.mutateAsync({ jobId: id, data: {} });
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
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
      setNetworkType(state.type);
    });

    return unsubscribe;
  }, []);

  return { isOnline, networkType };
}
```

### networkMode: 'offlineFirst' 동작
- 오프라인 시 캐시된 데이터 즉시 반환
- 온라인 복귀 시 백그라운드에서 리페치
- Mutation은 온라인 복귀 후 실행

---

*마지막 업데이트: 2026-02-02*
*Zustand 버전: 5.0.9*
*TanStack Query 버전: 5.90.12*
