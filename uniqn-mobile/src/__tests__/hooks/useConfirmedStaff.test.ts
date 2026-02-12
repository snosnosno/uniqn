/**
 * UNIQN Mobile - useConfirmedStaff Hook Tests
 *
 * @description Unit tests for confirmed staff management hooks
 * @version 1.0.0
 */

// ============================================================================
// Firebase Mock - Must be first to prevent initialization
// ============================================================================

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { resetCounters } from '../mocks/factories';

// ============================================================================
// Import After Mocks
// ============================================================================

import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import type {
  ConfirmedStaff,
  ConfirmedStaffGroup,
  ConfirmedStaffStats,
} from '@/types';

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetConfirmedStaff = jest.fn();
const mockGetConfirmedStaffByDate = jest.fn();
const mockUpdateStaffRole = jest.fn();
const mockUpdateConfirmedStaffWorkTime = jest.fn();
const mockDeleteConfirmedStaff = jest.fn();
const mockMarkAsNoShow = jest.fn();
const mockUpdateStaffStatus = jest.fn();
const mockSubscribeToConfirmedStaff = jest.fn();

jest.mock('@/services', () => ({
  getConfirmedStaff: (...args: unknown[]) => mockGetConfirmedStaff(...args),
  getConfirmedStaffByDate: (...args: unknown[]) => mockGetConfirmedStaffByDate(...args),
  updateStaffRole: (...args: unknown[]) => mockUpdateStaffRole(...args),
  updateConfirmedStaffWorkTime: (...args: unknown[]) =>
    mockUpdateConfirmedStaffWorkTime(...args),
  deleteConfirmedStaff: (...args: unknown[]) => mockDeleteConfirmedStaff(...args),
  markAsNoShow: (...args: unknown[]) => mockMarkAsNoShow(...args),
  updateStaffStatus: (...args: unknown[]) => mockUpdateStaffStatus(...args),
  subscribeToConfirmedStaff: (...args: unknown[]) => mockSubscribeToConfirmedStaff(...args),
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

const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// ============================================================================
// Mock Errors
// ============================================================================

jest.mock('@/errors', () => ({
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
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
let mockIsRefetching = false;
let mockData: unknown = undefined;
let mockError: Error | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(
    (options: { queryKey: string[]; queryFn: () => Promise<unknown>; enabled?: boolean }) => {
      if (options.enabled === false) {
        return {
          data: undefined,
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: mockRefetch,
        };
      }
      return {
        data: mockData,
        isLoading: mockIsLoading,
        isRefetching: mockIsRefetching,
        error: mockError,
        refetch: mockRefetch,
      };
    }
  ),
  useMutation: jest.fn(
    (options: {
      mutationFn: (...args: unknown[]) => Promise<unknown>;
      onSuccess?: (data: unknown) => void;
      onError?: (error: Error) => void;
    }) => {
      mockMutate.mockImplementation((args: unknown) => {
        mockIsPending = true;
        options
          .mutationFn(args)
          .then((result) => {
            options.onSuccess?.(result);
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
          options.onSuccess?.(result);
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

const mockInvalidateStaffManagement = jest.fn();

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    confirmedStaff: {
      all: ['confirmedStaff'],
      byJobPosting: (id: string) => ['confirmedStaff', 'byJobPosting', id],
      byDate: (id: string, date: string) => ['confirmedStaff', 'byDate', id, date],
    },
  },
  cachingPolicies: {
    frequent: 1000 * 60 * 5,
  },
  invalidateQueries: {
    staffManagement: (...args: unknown[]) => mockInvalidateStaffManagement(...args),
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockConfirmedStaff(overrides: Partial<ConfirmedStaff> = {}): ConfirmedStaff {
  return {
    id: 'staff-1',
    workLogId: 'worklog-1',
    staffId: 'user-1',
    staffName: '홍길동',
    jobPostingId: 'job-1',
    role: 'dealer',
    date: '2024-01-15',
    startTime: '09:00',
    endTime: '18:00',
    status: 'scheduled',
    checkInTime: null,
    checkOutTime: null,
    confirmedAt: '2024-01-10T12:00:00Z',
    confirmedBy: 'employer-1',
    ...overrides,
  };
}

function createMockStats(): ConfirmedStaffStats {
  return {
    total: 10,
    scheduled: 5,
    checkedIn: 2,
    checkedOut: 1,
    completed: 1,
    cancelled: 1,
    noShow: 0,
    settled: 0,
  };
}

function createMockGroup(): ConfirmedStaffGroup {
  return {
    date: '2024-01-15',
    staff: [createMockConfirmedStaff()],
    count: 1,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useConfirmedStaff Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
    mockIsLoading = false;
    mockIsPending = false;
    mockIsRefetching = false;
    mockData = undefined;
    mockError = null;
  });

  // ==========================================================================
  // 확정 스태프 조회
  // ==========================================================================

  describe('확정 스태프 조회', () => {
    it('공고별 확정 스태프 목록을 조회', () => {
      const mockStaff = [createMockConfirmedStaff()];
      const mockGroups = [createMockGroup()];
      const mockStats = createMockStats();
      mockData = {
        staff: mockStaff,
        grouped: mockGroups,
        stats: mockStats,
      };

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.staff).toEqual(mockStaff);
      expect(result.current.grouped).toEqual(mockGroups);
      expect(result.current.stats).toEqual(mockStats);
    });

    it('특정 날짜만 조회', async () => {
      const mockStaff = [
        createMockConfirmedStaff({ date: '2024-01-15' }),
      ];
      mockGetConfirmedStaffByDate.mockResolvedValueOnce(mockStaff);
      mockData = {
        staff: mockStaff,
        grouped: [],
        stats: createMockStats(),
      };

      renderHook(() => useConfirmedStaff('job-1', { date: '2024-01-15' }));

      await waitFor(() => {
        expect(mockGetConfirmedStaffByDate).toHaveBeenCalledWith('job-1', '2024-01-15');
      });
    });

    it('로딩 상태를 반환', () => {
      mockIsLoading = true;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isLoading).toBe(true);
    });

    it('리프레시 상태를 반환', () => {
      mockIsRefetching = true;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isRefreshing).toBe(true);
    });

    it('에러 상태를 반환', () => {
      mockError = new Error('조회 실패');

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.error).toEqual(new Error('조회 실패'));
    });

    it('빈 데이터의 기본값을 반환', () => {
      mockData = undefined;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.staff).toEqual([]);
      expect(result.current.grouped).toEqual([]);
      expect(result.current.stats).toEqual({
        total: 0,
        scheduled: 0,
        checkedIn: 0,
        checkedOut: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        settled: 0,
      });
    });
  });

  // ==========================================================================
  // 실시간 구독
  // ==========================================================================

  describe('실시간 구독', () => {
    it('realtime 옵션으로 실시간 구독 시작', () => {
      const mockUnsubscribe = jest.fn();
      mockSubscribeToConfirmedStaff.mockReturnValueOnce(mockUnsubscribe);

      renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

      expect(mockSubscribeToConfirmedStaff).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({
          onUpdate: expect.any(Function),
          onError: expect.any(Function),
        })
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '확정 스태프 실시간 구독 시작',
        { jobPostingId: 'job-1' }
      );
    });

    it('언마운트 시 실시간 구독 해제', () => {
      const mockUnsubscribe = jest.fn();
      mockSubscribeToConfirmedStaff.mockReturnValueOnce(mockUnsubscribe);

      const { unmount } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('실시간 에러 발생 시 토스트 표시', () => {
      const mockUnsubscribe = jest.fn();
      let errorCallback: ((error: Error) => void) | undefined;

      mockSubscribeToConfirmedStaff.mockImplementation((_jobPostingId, callbacks) => {
        errorCallback = callbacks.onError;
        return mockUnsubscribe;
      });

      renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

      act(() => {
        errorCallback?.(new Error('구독 에러'));
      });

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '스태프 데이터 동기화 중 오류가 발생했습니다.',
      });
    });

    it('realtime 모드에서는 수동 리프레시 불필요', () => {
      const mockUnsubscribe = jest.fn();
      mockSubscribeToConfirmedStaff.mockReturnValueOnce(mockUnsubscribe);

      const { result } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

      act(() => {
        result.current.refresh();
      });

      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 역할 변경
  // ==========================================================================

  describe('역할 변경', () => {
    it('스태프 역할을 변경', async () => {
      mockUpdateStaffRole.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.changeRole({
          workLogId: 'worklog-1',
          newRole: 'floor',
        });
      });

      await waitFor(() => {
        expect(mockUpdateStaffRole).toHaveBeenCalledWith({
          workLogId: 'worklog-1',
          newRole: 'floor',
          changedBy: 'employer-1',
        });
      });
    });

    it('changedBy가 제공되면 사용', async () => {
      mockUpdateStaffRole.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.changeRole({
          workLogId: 'worklog-1',
          newRole: 'floor',
          changedBy: 'admin-1',
        });
      });

      await waitFor(() => {
        expect(mockUpdateStaffRole).toHaveBeenCalledWith(
          expect.objectContaining({
            changedBy: 'admin-1',
          })
        );
      });
    });

    it('성공 시 토스트 표시 및 캐시 무효화', async () => {
      mockUpdateStaffRole.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.changeRole({
          workLogId: 'worklog-1',
          newRole: 'floor',
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '역할이 변경되었습니다.',
        });
        expect(mockInvalidateStaffManagement).toHaveBeenCalledWith('job-1');
      });
    });

    it('에러 발생 시 토스트 표시', async () => {
      mockUpdateStaffRole.mockRejectedValueOnce(new Error('변경 실패'));

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        try {
          result.current.changeRole({
            workLogId: 'worklog-1',
            newRole: 'floor',
          });
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '역할 변경에 실패했습니다.',
        });
      });
    });

    it('로딩 상태를 반환', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isChangingRole).toBe(true);
    });
  });

  // ==========================================================================
  // 근무 시간 수정
  // ==========================================================================

  describe('근무 시간 수정', () => {
    it('근무 시간을 수정', async () => {
      mockUpdateConfirmedStaffWorkTime.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.updateWorkTime({
          workLogId: 'worklog-1',
          checkInTime: new Date('2024-01-15T09:00:00'),
          checkOutTime: new Date('2024-01-15T18:00:00'),
        });
      });

      await waitFor(() => {
        expect(mockUpdateConfirmedStaffWorkTime).toHaveBeenCalledWith({
          workLogId: 'worklog-1',
          checkInTime: new Date('2024-01-15T09:00:00'),
          checkOutTime: new Date('2024-01-15T18:00:00'),
          modifiedBy: 'employer-1',
        });
      });
    });

    it('성공 시 토스트 표시', async () => {
      mockUpdateConfirmedStaffWorkTime.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.updateWorkTime({
          workLogId: 'worklog-1',
          checkInTime: new Date('2024-01-15T09:00:00'),
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '근무 시간이 수정되었습니다.',
        });
      });
    });

    it('에러 발생 시 토스트 표시', async () => {
      mockUpdateConfirmedStaffWorkTime.mockRejectedValueOnce(new Error('수정 실패'));

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        try {
          result.current.updateWorkTime({
            workLogId: 'worklog-1',
            checkInTime: new Date(),
          });
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '근무 시간 수정에 실패했습니다.',
        });
      });
    });

    it('로딩 상태를 반환', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isUpdatingTime).toBe(true);
    });
  });

  // ==========================================================================
  // 스태프 삭제
  // ==========================================================================

  describe('스태프 삭제', () => {
    it('확정 스태프를 삭제', async () => {
      mockDeleteConfirmedStaff.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.removeStaff({
          workLogId: 'worklog-1',
          reason: '개인 사정',
        });
      });

      await waitFor(() => {
        expect(mockDeleteConfirmedStaff).toHaveBeenCalledWith({
          workLogId: 'worklog-1',
          reason: '개인 사정',
        });
      });
    });

    it('성공 시 토스트 표시', async () => {
      mockDeleteConfirmedStaff.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.removeStaff({
          workLogId: 'worklog-1',
          reason: '개인 사정',
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '스태프가 삭제되었습니다.',
        });
      });
    });

    it('에러 발생 시 토스트 표시', async () => {
      mockDeleteConfirmedStaff.mockRejectedValueOnce(new Error('삭제 실패'));

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        try {
          result.current.removeStaff({
            workLogId: 'worklog-1',
          });
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '스태프 삭제에 실패했습니다.',
        });
      });
    });

    it('로딩 상태를 반환', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isRemoving).toBe(true);
    });
  });

  // ==========================================================================
  // 노쇼 처리
  // ==========================================================================

  describe('노쇼 처리', () => {
    it('스태프를 노쇼 처리', async () => {
      mockMarkAsNoShow.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.setNoShow('worklog-1', '연락 두절');
      });

      await waitFor(() => {
        expect(mockMarkAsNoShow).toHaveBeenCalledWith('worklog-1', '연락 두절');
      });
    });

    it('사유 없이 노쇼 처리', async () => {
      mockMarkAsNoShow.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.setNoShow('worklog-1');
      });

      await waitFor(() => {
        expect(mockMarkAsNoShow).toHaveBeenCalledWith('worklog-1', undefined);
      });
    });

    it('성공 시 토스트 표시', async () => {
      mockMarkAsNoShow.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        result.current.setNoShow('worklog-1');
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '노쇼 처리되었습니다.',
        });
      });
    });

    it('에러 발생 시 토스트 표시', async () => {
      mockMarkAsNoShow.mockRejectedValueOnce(new Error('처리 실패'));

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        try {
          result.current.setNoShow('worklog-1');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '노쇼 처리에 실패했습니다.',
        });
      });
    });

    it('로딩 상태를 반환', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isSettingNoShow).toBe(true);
    });
  });

  // ==========================================================================
  // 상태 변경
  // ==========================================================================

  describe('상태 변경', () => {
    it('스태프 상태를 변경', async () => {
      mockUpdateStaffStatus.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        await result.current.changeStatus('worklog-1', 'completed');
      });

      expect(mockUpdateStaffStatus).toHaveBeenCalledWith('worklog-1', 'completed');
    });

    it('성공 시 토스트 표시', async () => {
      mockUpdateStaffStatus.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await act(async () => {
        await result.current.changeStatus('worklog-1', 'completed');
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '상태가 변경되었습니다.',
        });
      });
    });

    it('에러 발생 시 에러를 throw', async () => {
      mockUpdateStaffStatus.mockRejectedValueOnce(new Error('변경 실패'));

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      await expect(
        act(async () => {
          await result.current.changeStatus('worklog-1', 'completed');
        })
      ).rejects.toThrow('변경 실패');
    });

    it('로딩 상태를 반환', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isChangingStatus).toBe(true);
    });
  });

  // ==========================================================================
  // refresh 기능
  // ==========================================================================

  describe('refresh 기능', () => {
    it('refresh 호출 시 refetch 실행', () => {
      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      act(() => {
        result.current.refresh();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('realtime 모드에서는 refresh 무시', () => {
      const mockUnsubscribe = jest.fn();
      mockSubscribeToConfirmedStaff.mockReturnValueOnce(mockUnsubscribe);

      const { result } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

      act(() => {
        result.current.refresh();
      });

      expect(mockRefetch).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 통합 테스트
  // ==========================================================================

  describe('통합 테스트', () => {
    it('모든 action 함수를 제공', () => {
      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.changeRole).toBeDefined();
      expect(result.current.updateWorkTime).toBeDefined();
      expect(result.current.removeStaff).toBeDefined();
      expect(result.current.setNoShow).toBeDefined();
      expect(result.current.changeStatus).toBeDefined();
    });

    it('모든 로딩 상태를 제공', () => {
      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.isChangingRole).toBeDefined();
      expect(result.current.isUpdatingTime).toBeDefined();
      expect(result.current.isRemoving).toBeDefined();
      expect(result.current.isSettingNoShow).toBeDefined();
      expect(result.current.isChangingStatus).toBeDefined();
    });

    it('모든 데이터를 제공', () => {
      const { result } = renderHook(() => useConfirmedStaff('job-1'));

      expect(result.current.staff).toBeDefined();
      expect(result.current.grouped).toBeDefined();
      expect(result.current.stats).toBeDefined();
      expect(result.current.isLoading).toBeDefined();
      expect(result.current.error).toBeDefined();
      expect(result.current.refresh).toBeDefined();
      expect(result.current.isRefreshing).toBeDefined();
    });
  });
});
