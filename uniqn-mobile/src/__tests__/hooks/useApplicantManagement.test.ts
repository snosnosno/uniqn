/**
 * UNIQN Mobile - useApplicantManagement hook tests
 */

import { act, renderHook } from '@testing-library/react-native';
import { ERROR_CODES } from '@/errors';
import { createMockApplication, resetCounters } from '../mocks/factories';
import {
  useApplicantManagement,
  useApplicantsByJobPosting,
  useApplicantStats,
  useCancellationRequests,
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useMarkAsRead,
} from '@/hooks/applicant';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  },
}));

const mockGetApplicantsByJobPosting = jest.fn();
const mockGetCancellationRequests = jest.fn();
const mockReviewCancellationRequest = jest.fn();
const mockConfirmApplication = jest.fn();
const mockRejectApplication = jest.fn();
const mockBulkConfirmApplications = jest.fn();
const mockMarkApplicationAsRead = jest.fn();
const mockGetApplicantStatsByRole = jest.fn();
const mockSubscribeToApplicantsAsync = jest.fn();

jest.mock('@/services', () => ({
  getApplicantsByJobPosting: (...args: unknown[]) => mockGetApplicantsByJobPosting(...args),
  getCancellationRequests: (...args: unknown[]) => mockGetCancellationRequests(...args),
  reviewCancellationRequest: (...args: unknown[]) => mockReviewCancellationRequest(...args),
  confirmApplication: (...args: unknown[]) => mockConfirmApplication(...args),
  rejectApplication: (...args: unknown[]) => mockRejectApplication(...args),
  bulkConfirmApplications: (...args: unknown[]) => mockBulkConfirmApplications(...args),
  markApplicationAsRead: (...args: unknown[]) => mockMarkApplicationAsRead(...args),
  getApplicantStatsByRole: (...args: unknown[]) => mockGetApplicantStatsByRole(...args),
  subscribeToApplicantsAsync: (...args: unknown[]) => mockSubscribeToApplicantsAsync(...args),
}));

const mockAddToast = jest.fn();
const mockUser = { uid: 'employer-1' };
const mockAuthState = { user: mockUser };
const mockToastState = { addToast: mockAddToast };

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState,
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector?: (state: typeof mockToastState) => unknown) =>
    selector ? selector(mockToastState) : mockToastState,
}));

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockQueryClient = {
  invalidateQueries: jest.fn(),
  cancelQueries: jest.fn(),
  getQueriesData: jest.fn(() => []),
  setQueriesData: jest.fn(),
  setQueryData: jest.fn(),
};

const mockMutate = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetch = jest.fn();

let mockIsLoading = false;
let mockIsPending = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;

jest.mock('@tanstack/react-query', () => ({
  onlineManager: {
    setOnline: jest.fn(),
  },
  useQuery: jest.fn(
    (options: { queryKey: string[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      if (options.enabled === false) {
        return {
          data: undefined,
          isLoading: false,
          error: null,
          refetch: mockRefetch,
          isRefetching: false,
          isFetching: false,
        };
      }

      return {
        data: mockData,
        isLoading: mockIsLoading,
        error: mockError,
        refetch: mockRefetch,
        isRefetching: false,
        isFetching: false,
      };
    }
  ),
  useMutation: jest.fn(
    (options: {
      mutationFn: (...args: unknown[]) => Promise<unknown>;
      onSuccess?: (data: unknown, variables: unknown) => void;
      onError?: (error: Error) => void;
    }) => {
      mockMutate.mockImplementation((args: unknown) => {
        mockIsPending = true;
        options
          .mutationFn(args)
          .then((result) => {
            options.onSuccess?.(result, args);
            mockIsPending = false;
          })
          .catch((error) => {
            mockError = error as Error;
            options.onError?.(error as Error);
            mockIsPending = false;
          });
      });

      mockMutateAsync.mockImplementation(async (args: unknown) => {
        try {
          mockIsPending = true;
          const result = await options.mutationFn(args);
          options.onSuccess?.(result, args);
          mockIsPending = false;
          return result;
        } catch (error) {
          mockError = error as Error;
          options.onError?.(error as Error);
          mockIsPending = false;
          throw error;
        }
      });

      return {
        mutate: mockMutate,
        mutateAsync: mockMutateAsync,
        data: mockData,
        isPending: mockIsPending,
        error: mockError,
      };
    }
  ),
  useQueryClient: () => mockQueryClient,
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    applicantManagement: {
      all: ['applicantManagement'],
      byJobPosting: (id: string, ownerId?: string, statusFilterKey = 'all') =>
        ownerId === undefined
          ? ['applicantManagement', 'byJobPosting', id]
          : ['applicantManagement', 'byJobPosting', id, ownerId, statusFilterKey],
      stats: (id: string, ownerId?: string) =>
        ownerId === undefined
          ? ['applicantManagement', 'stats', id]
          : ['applicantManagement', 'stats', id, ownerId],
      cancellationRequests: (id: string, ownerId?: string) =>
        ownerId === undefined
          ? ['applicantManagement', 'cancellationRequests', id]
          : ['applicantManagement', 'cancellationRequests', id, ownerId],
    },
    applications: {
      all: ['applications'],
    },
    jobPostings: {
      all: ['jobPostings'],
    },
  },
  cachingPolicies: {
    frequent: 1000 * 60 * 2,
    standard: 1000 * 60 * 5,
  },
}));

function createMockApplicantWithDetails(overrides: Record<string, unknown> = {}) {
  const base = createMockApplication();
  return {
    ...base,
    id: String(overrides.id ?? base.id),
    jobPostingId: 'job-1',
    applicantId: 'staff-1',
    applicantName: '홍길동',
    applicantEmail: 'hong@example.com',
    assignments: overrides.assignments ?? [
      { dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] },
    ],
    status: 'applied' as const,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockApplicantListResult(applicants = [createMockApplicantWithDetails()]) {
  const stats = {
    total: applicants.length,
    applied: 0,
    confirmed: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    cancellationPending: 0,
  };

  applicants.forEach((applicant) => {
    switch (String(applicant.status)) {
      case 'applied':
        stats.applied++;
        break;
      case 'confirmed':
        stats.confirmed++;
        break;
      case 'rejected':
        stats.rejected++;
        break;
      case 'cancelled':
        stats.cancelled++;
        break;
      case 'completed':
        stats.completed++;
        break;
      case 'cancellation_pending':
        stats.cancellationPending++;
        break;
    }
  });

  return { applicants, stats };
}

describe('useApplicantManagement Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockAuthState.user = mockUser;
    mockIsLoading = false;
    mockIsPending = false;
    mockData = undefined;
    mockError = null;
    mockRefetch.mockReset();
    mockRefetch.mockImplementation(async () => ({ data: mockData }));
  });

  describe('useApplicantsByJobPosting', () => {
    it('should return initial state when disabled', () => {
      const { result } = renderHook(() => useApplicantsByJobPosting(''));

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('should return applicants when enabled', () => {
      const mockApplicants = createMockApplicantListResult([
        createMockApplicantWithDetails({ id: 'app-1' }),
        createMockApplicantWithDetails({ id: 'app-2' }),
      ]);
      mockData = mockApplicants;

      const { result } = renderHook(() => useApplicantsByJobPosting('job-1'));

      expect(result.current.data).toEqual(mockApplicants);
      expect(result.current.data?.applicants).toHaveLength(2);
    });

    it('should fetch fresh applicants when realtime refetch is called', async () => {
      const fetchedApplicants = createMockApplicantListResult([
        createMockApplicantWithDetails({ id: 'app-1', status: 'confirmed' }),
      ]);
      mockSubscribeToApplicantsAsync.mockResolvedValueOnce(jest.fn());
      mockRefetch.mockResolvedValueOnce({ data: fetchedApplicants });

      const { result } = renderHook(() =>
        useApplicantsByJobPosting('job-1', undefined, { realtime: true })
      );

      await act(async () => {
        const response = await result.current.refetch();
        expect(response.data).toEqual(fetchedApplicants);
      });

      expect(result.current.data).toEqual(fetchedApplicants);
      expect(mockSubscribeToApplicantsAsync).toHaveBeenCalledWith(
        'job-1',
        'employer-1',
        expect.objectContaining({
          onUpdate: expect.any(Function),
        })
      );
      expect(mockQueryClient.setQueryData).toHaveBeenCalled();
    });

    it('should clear stale realtime applicants when the job posting changes', async () => {
      const unsubscribe = jest.fn();
      mockSubscribeToApplicantsAsync.mockResolvedValue(unsubscribe);

      const { result, rerender } = renderHook(
        ({ jobPostingId }: { jobPostingId: string }) =>
          useApplicantsByJobPosting(jobPostingId, undefined, { realtime: true }),
        {
          initialProps: { jobPostingId: 'job-1' },
        }
      );

      await act(async () => {
        await Promise.resolve();
      });

      const firstSubscription = mockSubscribeToApplicantsAsync.mock.calls[0]?.[2] as {
        onUpdate: (data: ReturnType<typeof createMockApplicantListResult>) => void;
      };

      act(() => {
        firstSubscription.onUpdate(
          createMockApplicantListResult([createMockApplicantWithDetails({ id: 'app-1' })])
        );
      });

      expect(result.current.data?.applicants[0]?.jobPostingId).toBe('job-1');

      rerender({ jobPostingId: 'job-2' });
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.data).toBeUndefined();
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('derived query hooks', () => {
    it('should scope stats queries by user', () => {
      const { useQuery } = jest.requireMock('@tanstack/react-query') as {
        useQuery: jest.Mock;
      };

      renderHook(() => useApplicantStats('job-1'));
      const queryOptions = useQuery.mock.calls.at(-1)?.[0] as { queryKey: string[] };

      expect(queryOptions.queryKey).toEqual([
        'applicantManagement',
        'stats',
        'job-1',
        'employer-1',
      ]);
    });

    it('should scope cancellation request queries by user', async () => {
      mockData = [createMockApplicantWithDetails({ id: 'app-1', status: 'cancellation_pending' })];

      const { useQuery } = jest.requireMock('@tanstack/react-query') as {
        useQuery: jest.Mock;
      };

      renderHook(() => useCancellationRequests('job-1'));
      const queryOptions = useQuery.mock.calls.at(-1)?.[0] as {
        queryKey: string[];
        queryFn: () => Promise<unknown>;
      };

      expect(queryOptions.queryKey).toEqual([
        'applicantManagement',
        'cancellationRequests',
        'job-1',
        'employer-1',
      ]);

      await queryOptions.queryFn();
      expect(mockGetCancellationRequests).toHaveBeenCalledWith('job-1', 'employer-1');
    });
  });

  describe('mutation hooks', () => {
    it('should confirm an application', async () => {
      mockConfirmApplication.mockResolvedValueOnce({
        applicationId: 'app-1',
        workLogId: 'worklog-1',
        message: '확정되었습니다.',
      });

      const { result } = renderHook(() => useConfirmApplication());

      await act(async () => {
        result.current.mutate({ applicationId: 'app-1' });
      });

      expect(mockConfirmApplication).toHaveBeenCalledWith({ applicationId: 'app-1' }, 'employer-1');
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '지원자가 확정되었습니다.',
      });
    });

    it('should reject an application', async () => {
      mockRejectApplication.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useRejectApplication());

      await act(async () => {
        result.current.mutate({ applicationId: 'app-1', reason: '부적합' });
      });

      expect(mockRejectApplication).toHaveBeenCalledWith(
        { applicationId: 'app-1', reason: '부적합' },
        'employer-1'
      );
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '지원이 거절되었습니다.',
      });
    });

    it('should show warning for partial bulk confirm failures', async () => {
      mockBulkConfirmApplications.mockResolvedValueOnce({
        successCount: 2,
        failedCount: 1,
        failedIds: ['app-3'],
        failed: [{ applicationId: 'app-3', reason: '확정에 실패했습니다.' }],
        workLogIds: ['worklog-1', 'worklog-2'],
      });

      const { result } = renderHook(() => useBulkConfirmApplications());

      await act(async () => {
        result.current.mutate(['app-1', 'app-2', 'app-3']);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'warning',
        message: '1명 확정이 실패했습니다.',
      });
    });

    it('should surface capacity-full reason in bulk confirm warning toast', async () => {
      mockBulkConfirmApplications.mockResolvedValueOnce({
        successCount: 1,
        failedCount: 2,
        failedIds: ['app-2', 'app-3'],
        failed: [
          {
            applicationId: 'app-2',
            code: ERROR_CODES.BUSINESS_MAX_CAPACITY_REACHED,
            reason: '모집 인원이 마감되었습니다.',
          },
          { applicationId: 'app-3', reason: '확정에 실패했습니다.' },
        ],
        workLogIds: ['worklog-1'],
      });

      const { result } = renderHook(() => useBulkConfirmApplications());

      await act(async () => {
        result.current.mutate(['app-1', 'app-2', 'app-3']);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'warning',
        message: '2명 확정 실패 (정원 마감 1명).',
      });
    });

    it('should mark as read', async () => {
      mockMarkApplicationAsRead.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useMarkAsRead());

      await act(async () => {
        result.current.mutate('app-1');
      });

      expect(mockMarkApplicationAsRead).toHaveBeenCalledWith('app-1', 'employer-1');
    });
  });

  describe('useApplicantManagement', () => {
    it('should return all applicant management functions and data', () => {
      mockData = createMockApplicantListResult([
        createMockApplicantWithDetails({ id: 'app-1', status: 'applied' }),
        createMockApplicantWithDetails({ id: 'app-2', status: 'confirmed' }),
      ]);

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      expect(result.current.applicants).toHaveLength(2);
      expect(result.current.stats).toBeDefined();
      expect(result.current.confirmApplication).toBeDefined();
      expect(result.current.rejectApplication).toBeDefined();
      expect(result.current.bulkConfirm).toBeDefined();
      expect(result.current.markAsRead).toBeDefined();
    });

    it('should derive counts, role stats, and cancellation requests from one dataset', () => {
      mockData = createMockApplicantListResult([
        createMockApplicantWithDetails({
          id: 'app-1',
          status: 'applied',
          assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] }],
        }),
        createMockApplicantWithDetails({
          id: 'app-2',
          status: 'confirmed',
          assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] }],
        }),
        createMockApplicantWithDetails({
          id: 'app-3',
          status: 'cancellation_pending',
          assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['floor'] }],
        }),
      ]);

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      expect(result.current.pendingCount).toBe(1);
      expect(result.current.confirmedCount).toBe(1);
      expect(result.current.cancellationPendingCount).toBe(1);
      expect(result.current.statsByRole.dealer.total).toBe(2);
      expect(result.current.statsByRole.floor.cancellationPending).toBe(1);
      expect(result.current.cancellationRequests).toHaveLength(1);
      expect(result.current.cancellationRequests[0].id).toBe('app-3');
    });

    it('should count multi-role applicants under each role (deliberate overcount in role stats)', () => {
      // 딜러+플로어 겸직 지원자 1명 확정 → dealer.confirmed=1 AND floor.confirmed=1
      // overall confirmedCount=1 (사람 수), Σ statsByRole[role].confirmed=2 (역할별 합계)는 의도된 차이
      mockData = createMockApplicantListResult([
        createMockApplicantWithDetails({
          id: 'app-multi',
          status: 'confirmed',
          assignments: [
            { dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer', 'floor'] },
          ],
        }),
      ]);

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      expect(result.current.confirmedCount).toBe(1);
      expect(result.current.statsByRole.dealer.confirmed).toBe(1);
      expect(result.current.statsByRole.floor.confirmed).toBe(1);
      expect(result.current.statsByRole.dealer.total).toBe(1);
      expect(result.current.statsByRole.floor.total).toBe(1);
    });

    it('should dedupe the same role across multiple assignments on a single application', () => {
      // 같은 application이 서로 다른 assignment에서 'dealer' 역할을 2번 가져도 1번만 카운트
      mockData = createMockApplicantListResult([
        createMockApplicantWithDetails({
          id: 'app-dupe-role',
          status: 'confirmed',
          assignments: [
            { dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] },
            { dates: ['2024-01-16'], timeSlot: '14:00~22:00', roleIds: ['dealer'] },
          ],
        }),
      ]);

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      expect(result.current.statsByRole.dealer.confirmed).toBe(1);
      expect(result.current.statsByRole.dealer.total).toBe(1);
    });

    it('should filter and sort applicants', () => {
      mockData = createMockApplicantListResult([
        createMockApplicantWithDetails({
          id: 'app-1',
          applicantName: 'Alice',
          status: 'applied',
          createdAt: '2024-01-15T10:00:00Z',
        }),
        createMockApplicantWithDetails({
          id: 'app-2',
          applicantName: 'Bob',
          status: 'confirmed',
          assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['floor'] }],
          createdAt: '2024-01-15T09:00:00Z',
        }),
      ]);

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      expect(result.current.filterApplicants({ status: 'applied' })).toHaveLength(1);
      expect(result.current.filterApplicants({ role: 'floor' })).toHaveLength(1);

      const sorted = result.current.filterApplicants({ sortBy: 'name', sortOrder: 'asc' });
      expect(sorted[0].applicantName).toBe('Alice');
      expect(sorted[1].applicantName).toBe('Bob');
    });
  });
});
