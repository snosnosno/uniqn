/**
 * UNIQN Mobile - Jest Setup
 *
 * @description Global test setup and mocks
 * @version 3.0.0 - Supabase/Expo mocks (Firebase removed)
 */

/* eslint-disable no-undef */

// ============================================================================
// Expo Linking Mock (MUST be before any service imports)
// deepLinkService 초기화 문제 해결
// ============================================================================
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path) => `uniqn://${path || ''}`),
  useURL: jest.fn(() => null),
  parse: jest.fn((_url) => ({ path: '', queryParams: {} })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  removeEventListener: jest.fn(),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openURL: jest.fn(() => Promise.resolve()),
  openSettings: jest.fn(() => Promise.resolve()),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { isConnectionExpensive: false },
    })
  ),
  configure: jest.fn(),
  useNetInfo: jest.fn(() => ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: { isConnectionExpensive: false },
  })),
  NetInfoStateType: {
    unknown: 'unknown',
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    ethernet: 'ethernet',
    wimax: 'wimax',
    vpn: 'vpn',
    other: 'other',
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      supabaseUrl: 'https://test-project.supabase.co',
      supabaseAnonKey: 'test-anon-key',
    },
  },
}));

// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  usePathname: () => '/',
  // useFocusEffect: 테스트에서는 항상 포커스 상태로 간주 — 콜백을 즉시 실행하지 않는 no-op
  // (블러/언마운트 정리는 각 컴포넌트의 useEffect 클린업이 담당)
  useFocusEffect: jest.fn(),
  Link: 'Link',
  Redirect: 'Redirect',
  Stack: {
    Screen: 'Stack.Screen',
  },
  Tabs: {
    Screen: 'Tabs.Screen',
  },
}));

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
require('react-native-reanimated').setUpTests();

// react-native-safe-area-context: useSafeAreaInsets 훅은 SafeAreaProvider 없으면 throw
// ('No safe area value available'). 컴포넌트(SafeAreaProvider/SafeAreaView/initialWindowMetrics)는
// 실제 구현을 유지(requireActual)하고 훅만 0 인셋으로 오버라이드 — provider 미래핑 렌더 전역 안전화.
// 자체 jest.mock 을 둔 파일(HomeTabBar 등)은 그 파일 목이 우선한다.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// Mock NativeWind
jest.mock('nativewind', () => ({
  colorScheme: {
    set: jest.fn(),
  },
  styled: (component) => component,
  useColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
}));

// ============================================================================
// Supabase Mock
// ============================================================================
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
      refreshSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: null }) },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((cb) => {
        cb?.('SUBSCRIBED');
        return {};
      }),
    })),
    removeChannel: jest.fn(),
  },
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    error: null,
  })),
}));

// Mock @sentry/react-native (간소화)
jest.mock('@sentry/react-native', () => {
  const noop = jest.fn();
  const noopWithCallback = jest.fn(
    (cb) => cb && cb({ setTag: noop, setLevel: noop, setExtra: noop, setContext: noop })
  );
  return {
    init: noop,
    wrap: jest.fn((component) => component),
    withScope: noopWithCallback,
    captureException: noop,
    captureMessage: noop,
    addBreadcrumb: noop,
    setTag: noop,
    setUser: noop,
    setExtra: noop,
    setContext: noop,
    startTransaction: jest.fn(() => ({ finish: noop, setTag: noop, setData: noop })),
    ReactNativeTracing: noop,
    ReactNavigationInstrumentation: noop,
  };
});

// Mock zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (config) => config,
  createJSONStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

// Suppress console warnings in tests
const originalWarn = console.warn;
const originalError = console.error;

function requireIfLoaded(modulePath) {
  try {
    const resolvedPath = require.resolve(modulePath);
    if (!require.cache[resolvedPath]) {
      return null;
    }

    return require(modulePath);
  } catch {
    return null;
  }
}

beforeAll(() => {
  console.warn = (...args) => {
    if (
      args[0]?.includes?.('Animated') ||
      args[0]?.includes?.('NativeWind') ||
      args[0]?.includes?.('deprecated')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (args[0]?.includes?.('Warning:') || args[0]?.includes?.('act()')) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterEach(() => {
  try {
    const networkStateModule = requireIfLoaded('@/services/offline/networkState');
    networkStateModule?.resetNetworkStateForTests?.();
  } catch {
    // networkState를 사용하지 않는 테스트 환경에서는 무시합니다.
  }

  try {
    const realtimeModule = requireIfLoaded('@/shared/realtime');
    const stats = realtimeModule?.RealtimeManager?.getStats?.();
    if (stats?.activeCount > 0) {
      realtimeModule.RealtimeManager.unsubscribeAll();
    }
    realtimeModule?.RealtimeManager?.onNetworkReconnect?.();
  } catch {
    // RealtimeManager를 사용하지 않는 테스트 환경에서는 무시합니다.
  }

  try {
    const queryClientModule = requireIfLoaded('@/lib/queryClient');
    queryClientModule?.queryClient?.clear?.();
  } catch {
    // queryClient를 사용하지 않는 테스트 환경에서는 무시합니다.
  }

  try {
    const sessionModule = requireIfLoaded('@/services/observability/sessionService');
    sessionModule?.sessionService?.cleanup?.();
  } catch {
    // sessionService를 사용하지 않는 테스트 환경에서는 무시합니다.
  }

  try {
    const tokenRefreshModule = requireIfLoaded('@/services/observability/tokenRefreshService');
    tokenRefreshModule?.stop?.();
    const tokenRefreshState = tokenRefreshModule?.getState?.();
    const hasResidualTokenRefreshState =
      tokenRefreshState?.lastRefreshAt !== null ||
      tokenRefreshState?.failureCount !== 0 ||
      tokenRefreshState?.nextRetryAt !== null ||
      tokenRefreshState?.isRefreshing === true ||
      tokenRefreshState?.nextScheduledAt !== null;

    if (hasResidualTokenRefreshState) {
      tokenRefreshModule?.resetState?.();
    }
  } catch {
    // tokenRefreshService를 사용하지 않는 테스트 환경에서는 무시합니다.
  }

  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Global test utilities (별도 파일에서 로드)
global.testUtils = require('./src/__tests__/testUtils');
