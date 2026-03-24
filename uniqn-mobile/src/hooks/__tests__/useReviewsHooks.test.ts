import { renderHook } from '@testing-library/react-native';
import { useGivenReviews, usePendingReviews, useReceivedReviews } from '../useReviews';

const mockUseQuery = jest.fn();
const mockUseInfiniteQuery = jest.fn();
const mockProfile = { uid: 'user-1', role: 'staff' };

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
  useMutation: jest.fn(),
}));

jest.mock('@/hooks/useThrottledCallback', () => ({
  useThrottledCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

jest.mock('@/lib/invalidationStrategy', () => ({
  invalidateRelated: jest.fn(),
}));

jest.mock('@/lib/queryClient', () => ({
  queryCachingOptions: {
    reviews: {
      staleTime: 1000,
      gcTime: 2000,
    },
  },
  queryKeys: {
    reviews: {
      all: ['reviews'],
      byWorkLog: (workLogId: string) => ['reviews', 'byWorkLog', workLogId],
      myGiven: () => ['reviews', 'myGiven'],
      myReceived: () => ['reviews', 'myReceived'],
      pending: () => ['reviews', 'pending'],
    },
  },
}));

jest.mock('@/domains/review', () => ({
  isWithinReviewDeadline: jest.fn(() => true),
  resolveReviewerTypeFromRole: (role?: string) => (role === 'employer' ? 'employer' : 'staff'),
}));

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getByIdBatch: jest.fn(),
  },
  workLogRepository: {
    getByStaffId: jest.fn(),
    getCompletedByOwnerId: jest.fn(),
  },
}));

jest.mock('@/services/reviewService', () => ({
  getReceivedReviews: jest.fn(),
  getGivenReviews: jest.fn(),
  getReviewsWithBlindCheck: jest.fn(),
  createReview: jest.fn(),
}));

jest.mock('@/shared/errors/hookErrorHandler', () => ({
  errorHandlerPresets: {
    review: () => jest.fn(),
  },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { profile: typeof mockProfile }) => unknown) =>
    selector({ profile: mockProfile }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: jest.fn((selector?: (state: { addToast: jest.Mock }) => unknown) => {
    const state = { addToast: jest.fn() };
    return selector ? selector(state) : state;
  }),
}));

describe('useReviews query keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.uid = 'user-1';
    mockProfile.role = 'staff';

    mockUseInfiniteQuery.mockImplementation((options: object) => ({
      data: undefined,
      isLoading: false,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      options,
    }));

    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      if (options.queryKey.includes('staff-worklogs')) {
        return {
          data: [
            {
              id: 'wl-2',
              ownerId: 'owner-1',
              staffId: 'staff-1',
              jobPostingId: 'job-2',
              status: 'checked_out',
              date: '2026-04-01',
              checkOutTime: new Date(),
            },
            {
              id: 'wl-1',
              ownerId: 'owner-1',
              staffId: 'staff-1',
              jobPostingId: 'job-1',
              status: 'checked_out',
              date: '2026-04-01',
              checkOutTime: new Date(),
            },
          ],
          isLoading: false,
        };
      }

      if (options.queryKey.includes('employer')) {
        return {
          data: [],
          isLoading: false,
        };
      }

      if (options.queryKey.includes('jobpostings')) {
        return {
          data: new Map(),
          isLoading: false,
        };
      }

      if (options.queryKey.includes('pending-dedup')) {
        return {
          data: { items: [] },
          isLoading: false,
        };
      }

      return {
        data: [],
        isLoading: false,
      };
    });
  });

  it('scopes received and given review queries by user and page size', () => {
    renderHook(() => useReceivedReviews('staff-1', 10));
    renderHook(() => useGivenReviews('owner-1', 5));

    expect(mockUseInfiniteQuery.mock.calls[0][0].queryKey).toEqual([
      'reviews',
      'myReceived',
      'staff-1',
      10,
    ]);
    expect(mockUseInfiniteQuery.mock.calls[1][0].queryKey).toEqual([
      'reviews',
      'myGiven',
      'owner-1',
      5,
    ]);
  });

  it('scopes pending review queries by the active user and sorted posting ids', () => {
    renderHook(() => usePendingReviews());

    const queryKeys = mockUseQuery.mock.calls.map(([options]) => options.queryKey);

    expect(queryKeys).toContainEqual(['reviews', 'pending', 'user-1', 'staff-worklogs']);
    expect(queryKeys).toContainEqual([
      'reviews',
      'pending',
      'user-1',
      'jobpostings',
      'job-1',
      'job-2',
    ]);
    expect(queryKeys).toContainEqual(['reviews', 'myGiven', 'user-1', 'pending-dedup']);
  });
});
