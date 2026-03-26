import { renderHook } from '@testing-library/react-native';
import { useGivenReviews, usePendingReviews, useReceivedReviews } from '../useReviews';

const mockUseQuery = jest.fn();
const mockUseInfiniteQuery = jest.fn();
const mockProfile = { uid: 'user-1', role: 'staff' };
const mockGetByDateRange = jest.fn();
const mockGetUndatedByStaffId = jest.fn();
const mockGetCompletedByOwnerId = jest.fn();
const mockGetUndatedCompletedByOwnerId = jest.fn();

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
    getByDateRange: (...args: unknown[]) => mockGetByDateRange(...args),
    getUndatedByStaffId: (...args: unknown[]) => mockGetUndatedByStaffId(...args),
    getCompletedByOwnerId: (...args: unknown[]) => mockGetCompletedByOwnerId(...args),
    getUndatedCompletedByOwnerId: (...args: unknown[]) => mockGetUndatedCompletedByOwnerId(...args),
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
    mockProfile.uid = 'user-1';
    mockProfile.role = 'staff';
    mockGetByDateRange.mockResolvedValue([]);
    mockGetUndatedByStaffId.mockResolvedValue([]);
    mockGetCompletedByOwnerId.mockResolvedValue([]);
    mockGetUndatedCompletedByOwnerId.mockResolvedValue([]);

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

  afterEach(() => {
    jest.useRealTimers();
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

    expect(queryKeys).toContainEqual([
      'reviews',
      'pending',
      'user-1',
      'staff-worklogs',
      '2026-04-01',
      '2026-04-08',
    ]);
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

  it('loads staff pending reviews from the review deadline date range and merges undated fixed work logs', async () => {
    mockGetByDateRange.mockResolvedValue([
      { id: 'dated-review', ownerId: 'owner-1', jobPostingId: 'job-1' },
    ]);
    mockGetUndatedByStaffId.mockResolvedValue([
      { id: 'undated-review', ownerId: 'owner-2', jobPostingId: 'job-2', date: '' },
    ]);

    renderHook(() => usePendingReviews());

    const staffQueryOptions = mockUseQuery.mock.calls
      .map(([options]) => options)
      .find((options) => options.queryKey.includes('staff-worklogs'));

    const result = await staffQueryOptions.queryFn();

    expect(mockGetByDateRange).toHaveBeenCalledWith('user-1', '2026-04-01', '2026-04-08');
    expect(mockGetUndatedByStaffId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      { id: 'dated-review', ownerId: 'owner-1', jobPostingId: 'job-1' },
      { id: 'undated-review', ownerId: 'owner-2', jobPostingId: 'job-2', date: '' },
    ]);
  });

  it('loads employer pending reviews from the review deadline date range and merges undated fixed work logs', async () => {
    mockProfile.role = 'employer';
    mockGetCompletedByOwnerId.mockResolvedValue([
      { id: 'dated-owner-review', ownerId: 'user-1', staffId: 'staff-2', jobPostingId: 'job-1' },
    ]);
    mockGetUndatedCompletedByOwnerId.mockResolvedValue([
      {
        id: 'undated-owner-review',
        ownerId: 'user-1',
        staffId: 'staff-3',
        jobPostingId: 'job-2',
        date: '',
      },
    ]);

    renderHook(() => usePendingReviews());

    const employerQueryOptions = mockUseQuery.mock.calls
      .map(([options]) => options)
      .find((options) => options.queryKey.includes('employer'));

    expect(employerQueryOptions.queryKey).toEqual([
      'reviews',
      'pending',
      'user-1',
      'employer',
      '2026-04-01',
      '2026-04-08',
    ]);

    const result = await employerQueryOptions.queryFn();

    expect(mockGetCompletedByOwnerId).toHaveBeenCalledWith('user-1', {
      start: '2026-04-01',
      end: '2026-04-08',
    });
    expect(mockGetUndatedCompletedByOwnerId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      { id: 'dated-owner-review', ownerId: 'user-1', staffId: 'staff-2', jobPostingId: 'job-1' },
      {
        id: 'undated-owner-review',
        ownerId: 'user-1',
        staffId: 'staff-3',
        jobPostingId: 'job-2',
        date: '',
      },
    ]);
  });
});
