import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuthGuard } from '@/hooks/useAuthGuard';

const mockReplace = jest.fn();
const mockCheckAuthState = jest.fn().mockResolvedValue(undefined);

type MockSearchParams = Record<string, string | undefined>;

type MockProfile = {
  role?: 'staff' | 'employer' | 'admin' | null;
  socialProvider?: 'apple' | null;
  phoneVerified?: boolean | null;
  profileCompleted?: boolean | null;
};

type MockUser = {
  uid: string;
  email?: string | null;
  phoneNumber?: string | null;
  providerIds?: string[];
};

type MockAuthState = {
  isLoading: boolean;
  profile: MockProfile | null;
  user: MockUser | null;
  checkAuthState: () => Promise<void>;
};

let mockPathname = '/';
let mockSegments: string[] = [];
let mockSearchParams: MockSearchParams = {};

const mockAuthState: MockAuthState = {
  isLoading: false,
  profile: null,
  user: null,
  checkAuthState: mockCheckAuthState,
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
  useSegments: () => mockSegments,
  useGlobalSearchParams: () => mockSearchParams,
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: MockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
  selectIsLoading: (state: MockAuthState) => state.isLoading,
  selectProfile: (state: MockAuthState) => state.profile,
}));

jest.mock('@/shared/role', () => ({
  RoleResolver: {
    hasPermission: jest.fn(() => true),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function resetMocks(): void {
  mockReplace.mockReset();
  mockCheckAuthState.mockReset().mockResolvedValue(undefined);
  mockPathname = '/';
  mockSegments = [];
  mockSearchParams = {};
  mockAuthState.isLoading = false;
  mockAuthState.profile = null;
  mockAuthState.user = null;
}

describe('useAuthGuard', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('preserves the protected route when redirecting unauthenticated users to login', async () => {
    mockPathname = '/jobs/123/apply';
    mockSegments = ['(app)', 'jobs', '123', 'apply'];

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/(auth)/login?redirect=%2F(app)%2Fjobs%2F123%2Fapply'
      );
    });
  });

  it('preserves the protected route when incomplete profiles are redirected to profile setup', async () => {
    mockPathname = '/jobs/123/apply';
    mockSegments = ['(app)', 'jobs', '123', 'apply'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: false,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/(app)/profile-setup?redirect=%2F(app)%2Fjobs%2F123%2Fapply'
      );
    });
  });

  it('honors a validated auth-route redirect for already authenticated users', async () => {
    mockPathname = '/login';
    mockSegments = ['(auth)', 'login'];
    mockSearchParams = {
      redirect: '/(app)/jobs/123/apply',
    };
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/jobs/123/apply');
    });
  });

  it('redirects authenticated users away from the public jobs entry route', async () => {
    mockPathname = '/jobs';
    mockSegments = ['(public)', 'jobs'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
    });
  });

  it('redirects authenticated users away from the public jobs alias route', async () => {
    mockPathname = '/jobs';
    mockSegments = ['jobs'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
    });
  });

  it('redirects guest users away from the legacy public jobs alias route', async () => {
    mockPathname = '/jobs';
    mockSegments = ['jobs'];

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('redirects guest users away from the public jobs group route', async () => {
    mockPathname = '/jobs';
    mockSegments = ['(public)', 'jobs'];

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  it('reconciles authenticated users on legacy public jobs routes while profile hydration is pending', async () => {
    mockPathname = '/jobs';
    mockSegments = ['jobs'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockCheckAuthState).toHaveBeenCalledTimes(1);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not treat missing-email sessions as phone-only without phone provider metadata', async () => {
    mockPathname = '/jobs';
    mockSegments = ['jobs'];
    mockAuthState.user = {
      uid: 'ambiguous-user',
      email: null,
      phoneNumber: '+821012345678',
      providerIds: ['apple.com'],
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockCheckAuthState).toHaveBeenCalledTimes(1);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects authenticated users away from the public job detail alias route', async () => {
    mockPathname = '/jobs/123';
    mockSegments = ['jobs', '123'];
    mockAuthState.user = { uid: 'employer-1', email: 'employer@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'employer',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/jobs/123');
    });
  });

  it('reconciles authenticated users on public job detail while profile hydration is pending', async () => {
    mockPathname = '/jobs/123';
    mockSegments = ['jobs', '123'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockCheckAuthState).toHaveBeenCalledTimes(1);
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps the target detail route when onboarding is still required from a public alias', async () => {
    mockPathname = '/jobs/123';
    mockSegments = ['jobs', '123'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: 'apple',
      phoneVerified: false,
      profileCompleted: false,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/(auth)/signup?mode=social&redirect=%2F(app)%2Fjobs%2F123'
      );
    });
  });

  it('keeps the target detail route when profile setup is still required from a public alias', async () => {
    mockPathname = '/jobs/123';
    mockSegments = ['jobs', '123'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: false,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/(app)/profile-setup?redirect=%2F(app)%2Fjobs%2F123'
      );
    });
  });

  it('redirects phone-only signup sessions to signup while preserving protected redirects', async () => {
    mockPathname = '/jobs/123/apply';
    mockSegments = ['(app)', 'jobs', '123', 'apply'];
    mockAuthState.user = {
      uid: 'phone-only-1',
      email: null,
      phoneNumber: '+821012345678',
      providerIds: ['phone'],
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        '/(auth)/signup?redirect=%2F(app)%2Fjobs%2F123%2Fapply'
      );
    });
  });

  it('redirects phone-only signup sessions from shared job detail to signup with the app detail target', async () => {
    mockPathname = '/jobs/123';
    mockSegments = ['jobs', '123'];
    mockAuthState.user = {
      uid: 'phone-only-1',
      email: null,
      phoneNumber: '+821012345678',
      providerIds: ['phone'],
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/signup?redirect=%2F(app)%2Fjobs%2F123');
    });
  });

  // PR #120/#122 + 2026-05-19 회귀 가드:
  //   - 기존: app/index.tsx (SplashScreen) 가 URL '/' 점유 → HomeTabBar push
  //     `/(app)/(tabs)` → URL '/' group erasure → SplashScreen redirect loop
  //   - Fix: app/index.tsx 제거 + useAuthGuard 에 uid-ref 기반 one-shot
  //     initial entry redirect 추가. URL '/' 가 (app)/(tabs)/index.tsx 로 직결.
  //   - 회귀 가드 1: 첫 mount 시 URL '/' 에서 entry route 가 (tabs) 가 아니면
  //     redirect 발동 (e.g., staff w/ home_dashboard_enabled → /home)
  it('redirects authenticated staff users to home on initial mount at root URL', async () => {
    mockPathname = '/';
    mockSegments = [];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
    });
  });

  // 회귀 가드 2: 동일 uid 에 대해 initial redirect 후 root URL 재진입 (HomeTabBar
  // push 시뮬레이션) 시 re-redirect 안 됨. uid-ref 가 이미 set 되어 있어 effect
  // 가 early-return.
  it('does not re-redirect on subsequent navigation back to root URL for the same uid', async () => {
    mockPathname = '/';
    mockSegments = [];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    const { rerender } = renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
    });

    mockReplace.mockClear();

    // HomeTabBar push → URL '/' 재진입, segments 는 (app)(tabs) 로 결정됨
    mockPathname = '/';
    mockSegments = ['(app)', '(tabs)'];
    rerender(undefined);

    // give effect time to potentially fire
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // 회귀 가드 3: logout 후 다른 uid 로 login 시 initial redirect 재발동.
  it('re-fires initial entry redirect when uid changes (logout → login flow)', async () => {
    mockPathname = '/';
    mockSegments = [];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    const { rerender } = renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
    });

    mockReplace.mockClear();

    // Logout: user/profile cleared, ref 가 null 로 reset
    mockAuthState.user = null;
    mockAuthState.profile = null;
    rerender(undefined);

    // Login as different uid
    mockAuthState.user = { uid: 'staff-2', email: 'staff2@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };
    rerender(undefined);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/home');
    });
  });

  it('normalizes phone-only sessions off the social signup flow', async () => {
    mockPathname = '/signup';
    mockSegments = ['(auth)', 'signup'];
    mockSearchParams = {
      mode: 'social',
      redirect: '/(app)/jobs/123',
    };
    mockAuthState.user = {
      uid: 'phone-only-1',
      email: null,
      phoneNumber: '+821012345678',
      providerIds: ['phone'],
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/signup?redirect=%2F(app)%2Fjobs%2F123');
    });
  });
});
