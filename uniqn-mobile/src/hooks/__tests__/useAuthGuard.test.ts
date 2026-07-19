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
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/home-jobs');
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
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/home-jobs');
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

  // PR #120 회귀 가드 (이제 방어용): Jobs 탭을 /home-jobs 로 분리(URL '/' 및 공개 '/jobs'
  // 충돌 해소)한 뒤로는 탭 그룹 진입이 '/(app)/(tabs)/home-jobs' (URL '/home-jobs') 로
  // 귀결(app/(app)/(tabs)/_layout.tsx 의 initialRouteName)되므로 이 시나리오는 자연
  // 발생하지 않는다. 다만 정적 빌드 라우터가 '/'+segments=['(tabs)'] 로 재해석하는
  // 잔여 경로를 대비해 가드는 유지. group segment 가 하나라도 있으면 의도된 in-app
  // 네비게이션이므로 redirect 를 건너뛴다.
  it('does not redirect authenticated users to the jobs tab when navigating into a tabs group at root URL', async () => {
    mockPathname = '/';
    mockSegments = ['(tabs)'];
    mockAuthState.user = { uid: 'staff-1', email: 'staff@example.com', phoneNumber: null };
    mockAuthState.profile = {
      role: 'staff',
      socialProvider: null,
      phoneVerified: true,
      profileCompleted: true,
    };

    renderHook(() => useAuthGuard());

    await waitFor(() => {
      // hook ran (effect synchronously dispatched)
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('still redirects authenticated users to the jobs tab on a true root entry with empty segments', async () => {
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
      expect(mockReplace).toHaveBeenCalledWith('/(app)/(tabs)/home-jobs');
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
