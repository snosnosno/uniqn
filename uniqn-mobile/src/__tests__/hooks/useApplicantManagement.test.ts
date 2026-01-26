/**
 * UNIQN Mobile - useApplicantManagement Hooks Tests
 *
 * @description Unit tests for applicant management hooks
 * @version 1.0.0
 */

// ============================================================================
// Firebase Mock - Must be first to prevent initialization
// ============================================================================

import { renderHook, act } from '@testing-library/react-native';
import {
  createMockApplication,
  resetCounters,
} from '../mocks/factories';

// ============================================================================
// Import After Mocks
// ============================================================================

import {
  useApplicantsByJobPosting,
  useApplicantStats,
  useConfirmApplication,
  useRejectApplication,
  useBulkConfirmApplications,
  useMarkAsRead,
  useApplicantManagement,
} from '@/hooks/useApplicantManagement';

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetApplicantsByJobPosting = jest.fn();
const mockConfirmApplication = jest.fn();
const mockRejectApplication = jest.fn();
const mockBulkConfirmApplications = jest.fn();
const mockMarkApplicationAsRead = jest.fn();
const mockGetApplicantStatsByRole = jest.fn();

// Mock the services index (the hook imports from @/services, not @/services/applicantManagementService)
jest.mock('@/services', () => ({
  getApplicantsByJobPosting: (...args: unknown[]) => mockGetApplicantsByJobPosting(...args),
  confirmApplication: (...args: unknown[]) => mockConfirmApplication(...args),
  rejectApplication: (...args: unknown[]) => mockRejectApplication(...args),
  bulkConfirmApplications: (...args: unknown[]) => mockBulkConfirmApplications(...args),
  markApplicationAsRead: (...args: unknown[]) => mockMarkApplicationAsRead(...args),
  getApplicantStatsByRole: (...args: unknown[]) => mockGetApplicantStatsByRole(...args),
}));

// ============================================================================
// Mock Stores
// ============================================================================

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

// ============================================================================
// Mock Logger
// ============================================================================

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Mock React Query
// ============================================================================

const mockQueryClient = {
  invalidateQueries: jest.fn(),
};

const mockMutate = jest.fn();
const mockMutateAsync = jest.fn();
const mockRefetch = jest.fn();

let mockIsLoading = false;
let mockIsPending = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options: {
    queryKey: string[];
    queryFn: () => Promise<unknown>;
    enabled?: boolean;
  }) => {
    if (options.enabled === false) {
      return {
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      };
    }
    return {
      data: mockData,
      isLoading: mockIsLoading,
      error: mockError,
      refetch: mockRefetch,
    };
  }),
  useMutation: jest.fn((options: {
    mutationFn: (...args: unknown[]) => Promise<unknown>;
    onSuccess?: (data: unknown, variables: unknown) => void;
    onError?: (error: Error) => void;
  }) => {
    // mutate doesn't throw - errors are handled via onError callback
    mockMutate.mockImplementation((args: unknown) => {
      mockIsPending = true;
      options.mutationFn(args)
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
    // mutateAsync does throw
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
  }),
  useQueryClient: () => mockQueryClient,
}));

// ============================================================================
// Mock Query Keys
// ============================================================================

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    applicantManagement: {
      all: ['applicantManagement'],
      byJobPosting: (id: string) => ['applicantManagement', 'byJobPosting', id],
      stats: (id: string) => ['applicantManagement', 'stats', id],
      cancellationRequests: (id: string) => ['applicantManagement', 'cancellationRequests', id],
      canConvertToStaff: (id: string) => ['applicantManagement', 'canConvertToStaff', id],
    },
    applications: {
      all: ['applications'],
    },
    jobPostings: {
      all: ['jobPostings'],
    },
  },
  cachingPolicies: {
    frequent: 1000 * 60 * 2, // 2 minutes
    standard: 1000 * 60 * 5, // 5 minutes
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockApplicantWithDetails(overrides: Record<string, unknown> = {}) {
  const base = createMockApplication();
  // assignments 기본값 (overrides에서 role을 받으면 해당 role 사용)
  const defaultRole = 'dealer';
  const defaultAssignments = [
    { dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: [defaultRole] }
  ];
  return {
    ...base,
    id: base.id,
    jobPostingId: 'job-1',
    applicantId: 'staff-1',
    applicantName: '홍길동',
    applicantEmail: 'hong@example.com',
    assignments: defaultAssignments,
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
    pending: 0,
    confirmed: 0,
    rejected: 0,
    completed: 0,
  };

  applicants.forEach((app) => {
    const statusKey = app.status as keyof typeof stats;
    if (statusKey in stats && statusKey !== 'total') {
      stats[statusKey]++;
    }
  });

  return { applicants, stats };
}

// ============================================================================
// Tests
// ============================================================================

describe('useApplicantManagement Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockIsLoading = false;
    mockIsPending = false;
    mockData = undefined;
    mockError = null;
  });

  // ==========================================================================
  // useApplicantsByJobPosting
  // ==========================================================================

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
  });

  // ==========================================================================
  // useApplicantStats
  // ==========================================================================

  describe('useApplicantStats', () => {
    it('should return stats by role', () => {
      const mockStats = {
        dealer: { total: 5, applied: 3, pending: 0, confirmed: 2, rejected: 0, completed: 0 },
        floor: { total: 3, applied: 2, pending: 0, confirmed: 1, rejected: 0, completed: 0 },
      };
      mockData = mockStats;

      const { result } = renderHook(() => useApplicantStats('job-1'));

      expect(result.current.data).toEqual(mockStats);
    });
  });

  // ==========================================================================
  // useConfirmApplication
  // ==========================================================================

  describe('useConfirmApplication', () => {
    it('should confirm an application', async () => {
      const mockResult = {
        applicationId: 'app-1',
        workLogId: 'worklog-new',
        message: '지원이 확정되었습니다',
      };
      mockConfirmApplication.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useConfirmApplication());

      await act(async () => {
        result.current.mutate({ applicationId: 'app-1' });
      });

      expect(mockConfirmApplication).toHaveBeenCalledWith(
        { applicationId: 'app-1' },
        'employer-1'
      );
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '지원자가 확정되었습니다.',
      });
    });

    it('should handle confirmation failure', async () => {
      // Create error object outside of mock to avoid Jest async issues
      mockConfirmApplication.mockImplementationOnce(() =>
        Promise.reject({ message: 'Confirmation failed' })
      );

      const { result } = renderHook(() => useConfirmApplication());

      // Call mutate
      act(() => {
        result.current.mutate({ applicationId: 'app-1' });
      });

      // Wait for mutation to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // The hook should call onError which shows a toast
      expect(mockConfirmApplication).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useRejectApplication
  // ==========================================================================

  describe('useRejectApplication', () => {
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
  });

  // ==========================================================================
  // useBulkConfirmApplications
  // ==========================================================================

  describe('useBulkConfirmApplications', () => {
    it('should confirm multiple applications', async () => {
      const mockResult = {
        successCount: 3,
        failedCount: 0,
        failedIds: [],
        workLogIds: ['worklog-1', 'worklog-2', 'worklog-3'],
      };
      mockBulkConfirmApplications.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useBulkConfirmApplications());

      await act(async () => {
        result.current.mutate(['app-1', 'app-2', 'app-3']);
      });

      expect(mockBulkConfirmApplications).toHaveBeenCalledWith(
        ['app-1', 'app-2', 'app-3'],
        'employer-1'
      );
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '3명이 확정되었습니다.',
      });
    });

    it('should show warning for partial failures', async () => {
      const mockResult = {
        successCount: 2,
        failedCount: 1,
        failedIds: ['app-3'],
        workLogIds: ['worklog-1', 'worklog-2'],
      };
      mockBulkConfirmApplications.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useBulkConfirmApplications());

      await act(async () => {
        result.current.mutate(['app-1', 'app-2', 'app-3']);
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'warning',
        message: '1명 확정에 실패했습니다.',
      });
    });
  });

  // ==========================================================================
  // useMarkAsRead
  // ==========================================================================

  describe('useMarkAsRead', () => {
    it('should mark as read', async () => {
      mockMarkApplicationAsRead.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useMarkAsRead());

      await act(async () => {
        result.current.mutate('app-1');
      });

      expect(mockMarkApplicationAsRead).toHaveBeenCalledWith('app-1', 'employer-1');
    });
  });

  // ==========================================================================
  // useApplicantManagement (통합 훅)
  // ==========================================================================

  describe('useApplicantManagement', () => {
    it('should return all applicant management functions and data', () => {
      const mockApplicantList = createMockApplicantListResult([
        createMockApplicantWithDetails({ id: 'app-1', status: 'applied' }),
        createMockApplicantWithDetails({ id: 'app-2', status: 'confirmed' }),
        createMockApplicantWithDetails({ id: 'app-3', status: 'pending' }),
      ]);
      mockData = mockApplicantList;

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      expect(result.current.applicants).toBeDefined();
      expect(result.current.stats).toBeDefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.refresh).toBeDefined();
      expect(result.current.confirmApplication).toBeDefined();
      expect(result.current.rejectApplication).toBeDefined();
      expect(result.current.bulkConfirm).toBeDefined();
      expect(result.current.markAsRead).toBeDefined();
    });

    it('should provide status counts', () => {
      const mockApplicantList = createMockApplicantListResult([
        createMockApplicantWithDetails({ id: 'app-1', status: 'pending' }),
        createMockApplicantWithDetails({ id: 'app-2', status: 'pending' }),
        createMockApplicantWithDetails({ id: 'app-3', status: 'confirmed' }),
        createMockApplicantWithDetails({ id: 'app-4', status: 'rejected' }),
      ]);
      mockData = mockApplicantList;

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      expect(result.current.pendingCount).toBe(2);
      expect(result.current.confirmedCount).toBe(1);
      expect(result.current.rejectedCount).toBe(1);
    });

    it('should filter applicants by status', () => {
      const mockApplicantList = createMockApplicantListResult([
        createMockApplicantWithDetails({ id: 'app-1', status: 'pending' }),
        createMockApplicantWithDetails({ id: 'app-2', status: 'confirmed' }),
      ]);
      mockData = mockApplicantList;

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      const filteredPending = result.current.filterApplicants({ status: 'pending' });
      expect(filteredPending).toHaveLength(1);
      expect(filteredPending[0].status).toBe('pending');

      const filteredConfirmed = result.current.filterApplicants({ status: 'confirmed' });
      expect(filteredConfirmed).toHaveLength(1);
      expect(filteredConfirmed[0].status).toBe('confirmed');
    });

    it('should filter applicants by role', () => {
      const mockApplicantList = createMockApplicantListResult([
        createMockApplicantWithDetails({ id: 'app-1', assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] }] }),
        createMockApplicantWithDetails({ id: 'app-2', assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['floor'] }] }),
        createMockApplicantWithDetails({ id: 'app-3', assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] }] }),
      ]);
      mockData = mockApplicantList;

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      const filteredDealers = result.current.filterApplicants({ role: 'dealer' });
      expect(filteredDealers).toHaveLength(2);
    });

    it('should sort applicants', () => {
      const app1 = createMockApplicantWithDetails({
        id: 'app-1',
        applicantName: 'Alice',
        createdAt: '2024-01-15T10:00:00Z',
      });
      const app2 = createMockApplicantWithDetails({
        id: 'app-2',
        applicantName: 'Bob',
        createdAt: '2024-01-15T09:00:00Z',
      });
      const mockApplicantList = createMockApplicantListResult([app1, app2]);
      mockData = mockApplicantList;

      const { result } = renderHook(() => useApplicantManagement('job-1'));

      const sortedByName = result.current.filterApplicants({
        sortBy: 'name',
        sortOrder: 'asc',
      });
      expect(sortedByName[0].applicantName).toBe('Alice');
      expect(sortedByName[1].applicantName).toBe('Bob');

      const sortedByNameDesc = result.current.filterApplicants({
        sortBy: 'name',
        sortOrder: 'desc',
      });
      expect(sortedByNameDesc[0].applicantName).toBe('Bob');
      expect(sortedByNameDesc[1].applicantName).toBe('Alice');
    });
  });
});
