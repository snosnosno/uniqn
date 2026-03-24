import { renderHook } from '@testing-library/react-native';
import { useTournamentApproval } from '@/hooks/useTournamentApproval';

const mockGetPending = jest.fn();
const mockGetMyPending = jest.fn();
const mockUseQuery = jest.fn();
const mockUser = { uid: 'employer-1' };
const mockAuthState: { user: { uid: string } | null; isAdmin: boolean } = {
  user: mockUser,
  isAdmin: false,
};

jest.mock('@/services/admin', () => ({
  tournamentApprovalService: {
    getPending: (...args: unknown[]) => mockGetPending(...args),
    getMyPending: (...args: unknown[]) => mockGetMyPending(...args),
    approve: jest.fn(),
    reject: jest.fn(),
    resubmit: jest.fn(),
    getById: jest.fn(),
    getByStatus: jest.fn(),
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/shared/errors', () => ({
  extractErrorMessage: jest.fn((_error: unknown, fallback: string) => fallback),
}));

jest.mock('@/constants', () => ({
  STATUS: {
    TOURNAMENT: {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
    },
  },
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    tournaments: {
      all: ['tournaments'],
      pending: () => ['tournaments', 'pending'],
      approved: () => ['tournaments', 'approved'],
      rejected: () => ['tournaments', 'rejected'],
      detail: (id: string) => ['tournaments', 'detail', id],
      myPending: (userId?: string) =>
        userId === undefined ? ['tournaments', 'myPending'] : ['tournaments', 'myPending', userId],
    },
  },
  cachingPolicies: {
    frequent: 2 * 60 * 1000,
    standard: 5 * 60 * 1000,
  },
  invalidateQueries: {
    tournamentApproval: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

describe('useTournamentApproval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = mockUser;
    mockAuthState.isAdmin = false;
    mockUseQuery.mockImplementation((_options: { enabled?: boolean }) => ({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    }));
  });

  it('should scope employer pending queries by user', async () => {
    renderHook(() => useTournamentApproval());

    const queryOptions = mockUseQuery.mock.calls
      .map((call) => call[0] as { queryKey: string[]; queryFn: () => Promise<unknown> })
      .find((options) => options.queryKey.includes('myPending'));

    expect(queryOptions?.queryKey).toEqual(['tournaments', 'myPending', 'employer-1']);

    await queryOptions?.queryFn();

    expect(mockGetMyPending).toHaveBeenCalledWith('employer-1');
  });

  it('should disable employer pending query for admins', () => {
    mockAuthState.isAdmin = true;

    renderHook(() => useTournamentApproval());

    const queryOptions = mockUseQuery.mock.calls
      .map((call) => call[0] as { queryKey: string[]; enabled?: boolean })
      .find((options) => options.queryKey.includes('myPending'));

    expect(queryOptions?.enabled).toBe(false);
  });
});
