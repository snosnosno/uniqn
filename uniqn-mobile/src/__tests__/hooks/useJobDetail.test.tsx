import { renderHook } from '@testing-library/react-native';
import { ERROR_CODES } from '@/errors/AppError';
import type { JobPosting } from '@/types';

import { useJobDetail } from '@/hooks/useJobDetail';

const mockGetCriticalOfflineCache = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRefetch = jest.fn();
const mockRemoveCriticalOfflineCache = jest.fn();
const mockSetCriticalOfflineCache = jest.fn();
const mockUseQuery = jest.fn();
let mockUser: { uid: string } | null = { uid: 'user-1' };

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: Record<string, unknown>) => mockUseQuery(options),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: true,
    isOffline: false,
    isChecking: false,
    connectionType: 'wifi',
    isInternetReachable: true,
    lastChecked: null,
    details: null,
    checkConnection: jest.fn(),
  }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: { uid: string } | null }) => unknown) => {
    const state = { user: mockUser };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/services', () => ({
  getJobPostingById: jest.fn(),
}));

jest.mock('@/services/offline/criticalOfflineCache', () => ({
  getCriticalOfflineCache: (...args: unknown[]) => mockGetCriticalOfflineCache(...args),
  removeCriticalOfflineCache: (...args: unknown[]) => mockRemoveCriticalOfflineCache(...args),
  setCriticalOfflineCache: (...args: unknown[]) => mockSetCriticalOfflineCache(...args),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    jobPostings: {
      detail: (id: string) => ['jobPostings', 'detail', id],
    },
  },
  cachingPolicies: {
    standard: 300000,
  },
}));

function createMockJobPosting(id: string): JobPosting {
  return {
    id,
    title: `Job ${id}`,
    status: 'active',
    postingType: 'regular',
    workDate: '2025-02-01',
    timeSlot: '10:00 - 18:00',
    location: 'Seoul',
    roles: ['dealer'],
  } as unknown as JobPosting;
}

describe('useJobDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { uid: 'user-1' };
    mockUseQuery.mockReturnValue({
      data: null,
      isFetched: true,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('does not fall back to cached data when the live query resolves to null', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });

    const { result } = renderHook(() => useJobDetail('job-1'));

    expect(result.current.job).toBeNull();
  });

  it('removes stale cached detail when the live query resolves to null', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });

    renderHook(() => useJobDetail('job-1'));

    expect(mockRemoveCriticalOfflineCache).toHaveBeenCalledWith('jobPostings:detail:user-1:job-1');
  });

  it('removes stale cached detail when the live query fails with a permission error', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });
    mockUseQuery.mockReturnValue({
      data: undefined,
      isFetched: true,
      isLoading: false,
      isRefetching: false,
      error: {
        __isAppError: true,
        code: ERROR_CODES.INFRA_PERMISSION_DENIED,
        category: 'permission',
      },
      refetch: mockRefetch,
    });

    renderHook(() => useJobDetail('job-1'));

    expect(mockRemoveCriticalOfflineCache).toHaveBeenCalledWith('jobPostings:detail:user-1:job-1');
  });

  it('keeps cached detail when the live query fails with a retryable network error', () => {
    mockGetCriticalOfflineCache.mockReturnValue({
      data: createMockJobPosting('cached-job'),
    });
    mockUseQuery.mockReturnValue({
      data: undefined,
      isFetched: true,
      isLoading: false,
      isRefetching: false,
      error: {
        __isAppError: true,
        code: 'E1004',
        category: 'network',
      },
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useJobDetail('job-1'));

    expect(mockRemoveCriticalOfflineCache).not.toHaveBeenCalled();
    expect(result.current.job).toBeNull();
  });

  it('uses a user-scoped query key so account switches do not reuse prior memory cache', () => {
    mockGetCriticalOfflineCache.mockReturnValue(null);
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const userScope = options.queryKey[3];

      if (userScope === 'user-1') {
        return {
          data: createMockJobPosting('user-1-job'),
          isFetched: true,
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: mockRefetch,
        };
      }

      return {
        data: undefined,
        isFetched: false,
        isLoading: true,
        isRefetching: false,
        error: null,
        refetch: mockRefetch,
      };
    });

    const firstRender = renderHook(() => useJobDetail('job-1'));

    expect(firstRender.result.current.job?.id).toBe('user-1-job');
    expect(mockUseQuery).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        queryKey: ['jobPostings', 'detail', 'job-1', 'user-1'],
      })
    );

    mockUser = { uid: 'user-2' };

    const secondRender = renderHook(() => useJobDetail('job-1'));

    expect(secondRender.result.current.job).toBeNull();
    expect(secondRender.result.current.isLoading).toBe(true);
    expect(mockUseQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        queryKey: ['jobPostings', 'detail', 'job-1', 'user-2'],
      })
    );
  });
});
