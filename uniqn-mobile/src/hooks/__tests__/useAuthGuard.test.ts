import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuthGuard } from '@/hooks/useAuthGuard';

const mockReplace = jest.fn();

type MockSearchParams = Record<string, string | undefined>;

type MockAuthState = {
  isLoading: boolean;
  profile: {
    role?: 'staff' | 'employer' | 'admin' | null;
    socialProvider?: 'apple' | null;
    phoneVerified?: boolean | null;
    profileCompleted?: boolean | null;
  } | null;
  user: { uid: string } | null;
};

let mockPathname = '/';
let mockSegments: string[] = [];
let mockSearchParams: MockSearchParams = {};

const mockAuthState: MockAuthState = {
  isLoading: false,
  profile: null,
  user: null,
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
    mockAuthState.user = { uid: 'staff-1' };
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
    mockAuthState.user = { uid: 'staff-1' };
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
});
