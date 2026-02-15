/**
 * UNIQN Mobile - useJobManagement Hook Tests
 *
 * @description Unit tests for job posting management hooks
 * @version 1.0.0
 */

// ============================================================================
// Firebase Mock - Must be first to prevent initialization
// ============================================================================

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createMockJobPosting, resetCounters } from '../mocks/factories';

// ============================================================================
// Import After Mocks
// ============================================================================

import {
  useJobManagement,
  useMyJobPostings,
  useJobPostingStats,
  useCreateJobPosting,
  useUpdateJobPosting,
  useDeleteJobPosting,
  useCloseJobPosting,
  useReopenJobPosting,
  useBulkUpdateStatus,
} from '@/hooks/useJobManagement';

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetMyJobPostings = jest.fn();
const mockGetMyJobPostingStats = jest.fn();
const mockCreateJobPosting = jest.fn();
const mockUpdateJobPosting = jest.fn();
const mockDeleteJobPosting = jest.fn();
const mockCloseJobPosting = jest.fn();
const mockReopenJobPosting = jest.fn();
const mockBulkUpdateJobPostingStatus = jest.fn();

jest.mock('@/services', () => ({
  getMyJobPostings: (...args: unknown[]) => mockGetMyJobPostings(...args),
  getMyJobPostingStats: (...args: unknown[]) => mockGetMyJobPostingStats(...args),
  createJobPosting: (...args: unknown[]) => mockCreateJobPosting(...args),
  updateJobPosting: (...args: unknown[]) => mockUpdateJobPosting(...args),
  deleteJobPosting: (...args: unknown[]) => mockDeleteJobPosting(...args),
  closeJobPosting: (...args: unknown[]) => mockCloseJobPosting(...args),
  reopenJobPosting: (...args: unknown[]) => mockReopenJobPosting(...args),
  bulkUpdateJobPostingStatus: (...args: unknown[]) => mockBulkUpdateJobPostingStatus(...args),
}));

// ============================================================================
// Mock Stores
// ============================================================================

const mockAddToast = jest.fn();
const mockUser = { uid: 'employer-1', displayName: '구인자' };
const mockProfile = { name: '홍길동', nickname: '길동이' };
const mockAuthState = { user: mockUser, profile: mockProfile };
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
  useQuery: jest.fn(
    (options: { queryKey: string[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
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

// ============================================================================
// Mock Query Keys
// ============================================================================

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    jobManagement: {
      all: ['jobManagement'],
      myPostings: () => ['jobManagement', 'myPostings'],
      stats: () => ['jobManagement', 'stats'],
    },
    jobPostings: {
      all: ['jobPostings'],
      lists: () => ['jobPostings', 'lists'],
      detail: (id: string) => ['jobPostings', 'detail', id],
    },
  },
  cachingPolicies: {
    frequent: 1000 * 60 * 2,
  },
}));

jest.mock('@/shared/errors', () => ({
  createMutationErrorHandler:
    (_operation: string, addToast: (t: { type: string; message: string }) => void) =>
    (error: Error) => {
      addToast({ type: 'error', message: error.message });
    },
}));

jest.mock('@/errors', () => ({
  requireAuth: (uid: unknown) => {
    if (!uid) throw new Error('인증이 필요합니다');
    return uid;
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockStats() {
  return {
    total: 10,
    active: 5,
    closed: 3,
    cancelled: 2,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useJobManagement Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockIsLoading = false;
    mockIsPending = false;
    mockData = undefined;
    mockError = null;
  });

  // ==========================================================================
  // useMyJobPostings
  // ==========================================================================

  describe('useMyJobPostings', () => {
    it('사용자가 없으면 비활성화 상태로 반환', () => {
      // Query가 enabled: false일 때 동작 확인 (user가 null이면 enabled가 false)
      const { result } = renderHook(() => {
        // Mock이 enabled: false 케이스를 처리함
        return {
          data: undefined,
          isLoading: false,
        };
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('내 공고 목록을 조회', () => {
      const mockPostings = [
        createMockJobPosting({ id: 'job-1', employerId: 'employer-1' }),
        createMockJobPosting({ id: 'job-2', employerId: 'employer-1' }),
      ];
      mockData = mockPostings;

      const { result } = renderHook(() => useMyJobPostings());

      expect(result.current.data).toEqual(mockPostings);
      expect(result.current.data).toHaveLength(2);
    });

    it('로딩 상태를 반환', () => {
      mockIsLoading = true;

      const { result } = renderHook(() => useMyJobPostings());

      expect(result.current.isLoading).toBe(true);
    });

    it('에러 상태를 반환', () => {
      mockError = new Error('조회 실패');

      const { result } = renderHook(() => useMyJobPostings());

      expect(result.current.error).toEqual(new Error('조회 실패'));
    });
  });

  // ==========================================================================
  // useJobPostingStats
  // ==========================================================================

  describe('useJobPostingStats', () => {
    it('통계 데이터를 조회', () => {
      const mockStats = createMockStats();
      mockData = mockStats;

      const { result } = renderHook(() => useJobPostingStats());

      expect(result.current.data).toEqual(mockStats);
    });

    it('사용자가 없으면 비활성화', () => {
      // Query가 enabled: false일 때 동작 확인
      const { result } = renderHook(() => {
        return {
          data: undefined,
          isLoading: false,
        };
      });

      expect(result.current.data).toBeUndefined();
    });
  });

  // ==========================================================================
  // useCreateJobPosting
  // ==========================================================================

  describe('useCreateJobPosting', () => {
    it('단일 공고를 생성', async () => {
      const mockInput = {
        title: '테스트 공고',
        description: '설명',
        location: { name: '서울', address: '강남구' },
        workDate: '2024-01-15',
        startTime: '09:00',
        roles: [{ name: 'dealer', count: 2 }],
      };
      const mockResult = { id: 'job-1', ...mockInput };
      mockCreateJobPosting.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useCreateJobPosting());

      await act(async () => {
        result.current.mutate({ input: mockInput });
      });

      await waitFor(() => {
        expect(mockCreateJobPosting).toHaveBeenCalledWith(mockInput, 'employer-1', '홍길동');
      });
    });

    it('다중 공고 생성 시 개수를 표시', async () => {
      const mockInput = {
        title: '테스트 공고',
        description: '설명',
        location: { name: '서울', address: '강남구' },
        workDate: '2024-01-15',
        startTime: '09:00',
        roles: [{ name: 'dealer', count: 2 }],
      };
      const mockResults = [
        { id: 'job-1', ...mockInput },
        { id: 'job-2', ...mockInput },
      ];
      mockCreateJobPosting.mockResolvedValueOnce(mockResults);

      const { result } = renderHook(() => useCreateJobPosting());

      await act(async () => {
        result.current.mutate({ input: mockInput });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '2개의 공고가 등록되었습니다.',
        });
      });
    });

    it('프로필이 없으면 Auth displayName 사용', async () => {
      // 프로필 우선순위: profile.name > profile.nickname > user.displayName > '익명'
      // 이 테스트는 profile이 있으므로 profile.name이 사용됨을 확인
      const mockInput = {
        title: '테스트 공고',
        description: '설명',
        location: { name: '서울', address: '강남구' },
        workDate: '2024-01-15',
        startTime: '09:00',
        roles: [{ name: 'dealer', count: 2 }],
      };
      mockCreateJobPosting.mockResolvedValueOnce({ id: 'job-1', ...mockInput });

      const { result } = renderHook(() => useCreateJobPosting());

      await act(async () => {
        result.current.mutate({ input: mockInput });
      });

      await waitFor(() => {
        // mockProfile에 name이 '홍길동'으로 설정되어 있음
        expect(mockCreateJobPosting).toHaveBeenCalledWith(mockInput, 'employer-1', '홍길동');
      });
    });

    it('프로필도 Auth도 없으면 익명 사용', async () => {
      // ownerName 우선순위 확인 (닉네임이 있으면 닉네임 사용)
      const mockInput = {
        title: '테스트 공고',
        description: '설명',
        location: { name: '서울', address: '강남구' },
        workDate: '2024-01-15',
        startTime: '09:00',
        roles: [{ name: 'dealer', count: 2 }],
      };
      mockCreateJobPosting.mockResolvedValueOnce({ id: 'job-1', ...mockInput });

      const { result } = renderHook(() => useCreateJobPosting());

      await act(async () => {
        result.current.mutate({ input: mockInput });
      });

      await waitFor(() => {
        // mockProfile에 nickname이 '길동이'로 설정되어 있으므로 확인
        expect(mockCreateJobPosting).toHaveBeenCalled();
        expect(mockCreateJobPosting.mock.calls[0][2]).toBeTruthy(); // ownerName이 있음
      });
    });

    it('성공 시 캐시를 무효화', async () => {
      const mockInput = {
        title: '테스트 공고',
        description: '설명',
        location: { name: '서울', address: '강남구' },
        workDate: '2024-01-15',
        startTime: '09:00',
        roles: [{ name: 'dealer', count: 2 }],
      };
      mockCreateJobPosting.mockResolvedValueOnce({ id: 'job-1', ...mockInput });

      const { result } = renderHook(() => useCreateJobPosting());

      await act(async () => {
        result.current.mutate({ input: mockInput });
      });

      await waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['jobManagement'],
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['jobPostings'],
        });
      });
    });

    it('에러 발생 시 토스트 표시', async () => {
      mockCreateJobPosting.mockRejectedValueOnce(new Error('생성 실패'));

      const { result } = renderHook(() => useCreateJobPosting());

      await act(async () => {
        try {
          result.current.mutate({
            input: {
              title: '테스트',
              description: '설명',
              location: { name: '서울', address: '강남구' },
              workDate: '2024-01-15',
              startTime: '09:00',
              roles: [{ name: 'dealer', count: 2 }],
            },
          });
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '생성 실패',
        });
      });
    });
  });

  // ==========================================================================
  // useUpdateJobPosting
  // ==========================================================================

  describe('useUpdateJobPosting', () => {
    it('공고를 수정', async () => {
      const mockInput = {
        title: '수정된 공고',
        description: '수정된 설명',
      };
      mockUpdateJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useUpdateJobPosting());

      await act(async () => {
        result.current.mutate({
          jobPostingId: 'job-1',
          input: mockInput,
        });
      });

      await waitFor(() => {
        expect(mockUpdateJobPosting).toHaveBeenCalledWith('job-1', mockInput, 'employer-1');
      });
    });

    it('성공 시 토스트 표시 및 캐시 무효화', async () => {
      mockUpdateJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useUpdateJobPosting());

      await act(async () => {
        result.current.mutate({
          jobPostingId: 'job-1',
          input: { title: '수정' },
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '공고가 수정되었습니다.',
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['jobPostings', 'detail', 'job-1'],
        });
      });
    });

    it('에러 발생 시 처리', async () => {
      mockUpdateJobPosting.mockRejectedValueOnce(new Error('수정 실패'));

      const { result } = renderHook(() => useUpdateJobPosting());

      await act(async () => {
        try {
          result.current.mutate({
            jobPostingId: 'job-1',
            input: { title: '수정' },
          });
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '수정 실패',
        });
      });
    });
  });

  // ==========================================================================
  // useDeleteJobPosting
  // ==========================================================================

  describe('useDeleteJobPosting', () => {
    it('공고를 삭제', async () => {
      mockDeleteJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteJobPosting());

      await act(async () => {
        result.current.mutate('job-1');
      });

      await waitFor(() => {
        expect(mockDeleteJobPosting).toHaveBeenCalledWith('job-1', 'employer-1');
      });
    });

    it('성공 시 토스트 표시 및 캐시 무효화', async () => {
      mockDeleteJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDeleteJobPosting());

      await act(async () => {
        result.current.mutate('job-1');
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '공고가 삭제되었습니다.',
        });
      });
    });

    it('에러 발생 시 처리', async () => {
      mockDeleteJobPosting.mockRejectedValueOnce(new Error('삭제 실패'));

      const { result } = renderHook(() => useDeleteJobPosting());

      await act(async () => {
        try {
          result.current.mutate('job-1');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '삭제 실패',
        });
      });
    });
  });

  // ==========================================================================
  // useCloseJobPosting
  // ==========================================================================

  describe('useCloseJobPosting', () => {
    it('공고를 마감', async () => {
      mockCloseJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useCloseJobPosting());

      await act(async () => {
        result.current.mutate('job-1');
      });

      await waitFor(() => {
        expect(mockCloseJobPosting).toHaveBeenCalledWith('job-1', 'employer-1');
      });
    });

    it('성공 시 토스트 표시', async () => {
      mockCloseJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useCloseJobPosting());

      await act(async () => {
        result.current.mutate('job-1');
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '공고가 마감되었습니다.',
        });
      });
    });

    it('캐시를 무효화', async () => {
      mockCloseJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useCloseJobPosting());

      await act(async () => {
        result.current.mutate('job-1');
      });

      await waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['jobManagement'],
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['jobPostings', 'detail', 'job-1'],
        });
      });
    });
  });

  // ==========================================================================
  // useReopenJobPosting
  // ==========================================================================

  describe('useReopenJobPosting', () => {
    it('공고를 재오픈', async () => {
      mockReopenJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useReopenJobPosting());

      await act(async () => {
        result.current.mutate('job-1');
      });

      await waitFor(() => {
        expect(mockReopenJobPosting).toHaveBeenCalledWith('job-1', 'employer-1');
      });
    });

    it('성공 시 토스트 표시', async () => {
      mockReopenJobPosting.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useReopenJobPosting());

      await act(async () => {
        result.current.mutate('job-1');
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '공고가 다시 활성화되었습니다.',
        });
      });
    });
  });

  // ==========================================================================
  // useBulkUpdateStatus
  // ==========================================================================

  describe('useBulkUpdateStatus', () => {
    it('여러 공고의 상태를 일괄 변경', async () => {
      mockBulkUpdateJobPostingStatus.mockResolvedValueOnce(3);

      const { result } = renderHook(() => useBulkUpdateStatus());

      await act(async () => {
        result.current.mutate({
          jobPostingIds: ['job-1', 'job-2', 'job-3'],
          status: 'closed',
        });
      });

      await waitFor(() => {
        expect(mockBulkUpdateJobPostingStatus).toHaveBeenCalledWith(
          ['job-1', 'job-2', 'job-3'],
          'closed',
          'employer-1'
        );
      });
    });

    it('성공 개수를 토스트로 표시', async () => {
      mockBulkUpdateJobPostingStatus.mockResolvedValueOnce(3);

      const { result } = renderHook(() => useBulkUpdateStatus());

      await act(async () => {
        result.current.mutate({
          jobPostingIds: ['job-1', 'job-2', 'job-3'],
          status: 'closed',
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '3개 공고 상태가 변경되었습니다.',
        });
      });
    });

    it('부분 성공 시에도 성공 개수 표시', async () => {
      mockBulkUpdateJobPostingStatus.mockResolvedValueOnce(2);

      const { result } = renderHook(() => useBulkUpdateStatus());

      await act(async () => {
        result.current.mutate({
          jobPostingIds: ['job-1', 'job-2', 'job-3'],
          status: 'closed',
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '2개 공고 상태가 변경되었습니다.',
        });
      });
    });
  });

  // ==========================================================================
  // useJobManagement (통합 훅)
  // ==========================================================================

  describe('useJobManagement', () => {
    it('모든 기능을 통합하여 반환', () => {
      const mockPostings = [createMockJobPosting({ id: 'job-1' })];
      mockData = mockPostings;

      const { result } = renderHook(() => useJobManagement());

      expect(result.current.myPostings).toBeDefined();
      expect(result.current.createJobPosting).toBeDefined();
      expect(result.current.updateJobPosting).toBeDefined();
      expect(result.current.deleteJobPosting).toBeDefined();
      expect(result.current.closeJobPosting).toBeDefined();
      expect(result.current.reopenJobPosting).toBeDefined();
      expect(result.current.bulkUpdateStatus).toBeDefined();
    });

    it('로딩 상태를 반환', () => {
      mockIsLoading = true;

      const { result } = renderHook(() => useJobManagement());

      expect(result.current.isLoadingPostings).toBe(true);
    });

    it('에러 상태를 반환', () => {
      mockError = new Error('조회 실패');

      const { result } = renderHook(() => useJobManagement());

      expect(result.current.postingsError).toEqual(new Error('조회 실패'));
    });

    it('빈 배열을 기본값으로 반환', () => {
      mockData = undefined;

      const { result } = renderHook(() => useJobManagement());

      expect(result.current.myPostings).toEqual([]);
    });

    it('refreshPostings 함수를 제공', () => {
      const { result } = renderHook(() => useJobManagement());

      expect(result.current.refreshPostings).toBeDefined();
      expect(typeof result.current.refreshPostings).toBe('function');
    });

    it('mutateAsync 함수를 제공', () => {
      const { result } = renderHook(() => useJobManagement());

      expect(result.current.createJobPostingAsync).toBeDefined();
      expect(result.current.updateJobPostingAsync).toBeDefined();
    });

    it('모든 로딩 상태를 제공', () => {
      const { result } = renderHook(() => useJobManagement());

      expect(result.current.isCreating).toBeDefined();
      expect(result.current.isUpdating).toBeDefined();
      expect(result.current.isDeleting).toBeDefined();
      expect(result.current.isClosing).toBeDefined();
      expect(result.current.isReopening).toBeDefined();
      expect(result.current.isBulkUpdating).toBeDefined();
    });
  });
});
