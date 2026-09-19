import { renderHook } from '@testing-library/react-native';
import { useGivenReviews, usePendingReviews, useReceivedReviews } from '../useReviews';

const mockUseQuery = jest.fn();
const mockUseInfiniteQuery = jest.fn();
const mockProfile = { uid: 'user-1', role: 'staff' };
const mockGetByDateRange = jest.fn();
const mockGetUndatedByStaffId = jest.fn();
const mockGetCompletedByOwnerId = jest.fn();
const mockGetUndatedCompletedByOwnerId = jest.fn();
const mockRefetchStaffWorkLogs = jest.fn();
const mockRefetchEmployerWorkLogs = jest.fn();
const mockRefetchJobPostings = jest.fn();
const mockRefetchGivenReviews = jest.fn();

// 각 내부 쿼리의 실패를 개별로 주입한다 — 훅이 어느 쿼리의 실패를 올리는지(그리고
// 구인자 전용 쿼리를 스태프에게 올리지 않는지) 구분해서 검증하기 위함.
const mockQueryErrors: {
  staff: Error | null;
  employer: Error | null;
  jobPostings: Error | null;
  given: Error | null;
} = { staff: null, employer: null, jobPostings: null, given: null };

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
    mockQueryErrors.staff = null;
    mockQueryErrors.employer = null;
    mockQueryErrors.jobPostings = null;
    mockQueryErrors.given = null;

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
          error: mockQueryErrors.staff,
          refetch: mockRefetchStaffWorkLogs,
        };
      }

      if (options.queryKey.includes('employer')) {
        return {
          data: [],
          isLoading: false,
          error: mockQueryErrors.employer,
          refetch: mockRefetchEmployerWorkLogs,
        };
      }

      if (options.queryKey.includes('jobpostings')) {
        return {
          data: new Map(),
          isLoading: false,
          error: mockQueryErrors.jobPostings,
          refetch: mockRefetchJobPostings,
        };
      }

      if (options.queryKey.includes('pending-dedup')) {
        return {
          data: { items: [] },
          isLoading: false,
          error: mockQueryErrors.given,
          refetch: mockRefetchGivenReviews,
        };
      }

      return {
        data: [],
        isLoading: false,
        error: null,
        refetch: jest.fn(),
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

// 조회가 실패해도 pendingReviews 는 빈 배열이라 화면이 "미작성 없음"으로 위장한다.
// 훅이 실패를 올려주지 않으면 화면은 분기할 것이 없다 — 그래서 error/refetch 가 훅의 계약이다.
describe('usePendingReviews 실패 노출', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
    mockProfile.uid = 'user-1';
    mockProfile.role = 'staff';
    mockQueryErrors.staff = null;
    mockQueryErrors.employer = null;
    mockQueryErrors.jobPostings = null;
    mockQueryErrors.given = null;

    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      if (options.queryKey.includes('staff-worklogs')) {
        return {
          data: [],
          isLoading: false,
          error: mockQueryErrors.staff,
          refetch: mockRefetchStaffWorkLogs,
        };
      }
      if (options.queryKey.includes('employer')) {
        return {
          data: [],
          isLoading: false,
          error: mockQueryErrors.employer,
          refetch: mockRefetchEmployerWorkLogs,
        };
      }
      if (options.queryKey.includes('jobpostings')) {
        return {
          data: new Map(),
          isLoading: false,
          error: mockQueryErrors.jobPostings,
          refetch: mockRefetchJobPostings,
        };
      }
      return {
        data: { items: [] },
        isLoading: false,
        error: mockQueryErrors.given,
        refetch: mockRefetchGivenReviews,
      };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('성공 조회에서는 error 가 null 이다', () => {
    const { result } = renderHook(() => usePendingReviews());

    expect(result.current.error).toBeNull();
  });

  it.each([
    ['staff', 'staff-worklogs 조회 실패'],
    ['jobPostings', '공고 배치 조회 실패'],
    ['given', '작성한 리뷰 조회 실패'],
  ] as const)('%s 쿼리가 실패하면 error 로 올린다', (key, message) => {
    const failure = new Error(message);
    mockQueryErrors[key] = failure;

    const { result } = renderHook(() => usePendingReviews());

    expect(result.current.error).toBe(failure);
  });

  it('스태프에게는 구인자 전용 쿼리의 실패를 올리지 않는다', () => {
    // 구인자 쿼리는 enabled:false 라 스태프 화면에서 실패해도 미작성 목록에 영향이 없다.
    mockQueryErrors.employer = new Error('구인자 근무기록 조회 실패');

    const { result } = renderHook(() => usePendingReviews());

    expect(result.current.error).toBeNull();
  });

  it('구인자에게는 구인자 전용 쿼리의 실패를 올린다', () => {
    mockProfile.role = 'employer';
    const failure = new Error('구인자 근무기록 조회 실패');
    mockQueryErrors.employer = failure;

    const { result } = renderHook(() => usePendingReviews());

    expect(result.current.error).toBe(failure);
  });

  it('refetch 는 미작성 목록을 구성하는 모든 쿼리를 다시 태운다', async () => {
    mockProfile.role = 'employer';
    const { result } = renderHook(() => usePendingReviews());

    await result.current.refetch();

    expect(mockRefetchStaffWorkLogs).toHaveBeenCalled();
    expect(mockRefetchEmployerWorkLogs).toHaveBeenCalled();
    expect(mockRefetchJobPostings).toHaveBeenCalled();
    expect(mockRefetchGivenReviews).toHaveBeenCalled();
  });
});
