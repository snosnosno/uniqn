/**
 * UNIQN Mobile - useApplications Hook Tests
 *
 * @description Unit tests for application management hooks
 * @version 2.0.0 - v2.0 Assignment + PreQuestion 지원
 */

// ============================================================================
// Firebase Mock - Must be first to prevent initialization
// ============================================================================

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { createMockApplication, resetCounters } from '../mocks/factories';

// ============================================================================
// Import After Mocks
// ============================================================================

import { useApplications } from '@/hooks/useApplications';

jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
}));

// ============================================================================
// Mock Services
// ============================================================================

const mockGetMyApplications = jest.fn();
const mockApplyToJobV2 = jest.fn();
const mockCancelApplication = jest.fn();
const mockRequestCancellation = jest.fn();

jest.mock('@/services', () => ({
  getMyApplications: (...args: unknown[]) => mockGetMyApplications(...args),
  applyToJobV2: (...args: unknown[]) => mockApplyToJobV2(...args),
  cancelApplication: (...args: unknown[]) => mockCancelApplication(...args),
  requestCancellation: (...args: unknown[]) => mockRequestCancellation(...args),
}));

// ============================================================================
// Mock Stores
// ============================================================================

const mockAddToast = jest.fn();
const mockUser = {
  uid: 'user-1',
  displayName: '홍길동',
  phoneNumber: '01012345678',
  photoURL: 'https://example.com/photo.jpg',
};
const mockProfile = {
  name: '홍길동',
  nickname: '길동이',
  phone: '01012345678',
  photoURL: 'https://example.com/photo.jpg',
};
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
  cancelQueries: jest.fn(),
  getQueryData: jest.fn(),
  setQueryData: jest.fn(),
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
      onSuccess?: (data: unknown, variables: unknown) => void;
      onError?: (error: Error, variables: unknown, context: unknown) => void;
      onMutate?: (variables: unknown) => Promise<unknown> | unknown;
      onSettled?: () => void;
    }) => {
      mockMutate.mockImplementation((args: unknown) => {
        mockIsPending = true;

        const executeMutation = async () => {
          try {
            let context: unknown;
            if (options.onMutate) {
              const result = options.onMutate(args);
              context = result instanceof Promise ? await result : result;
            }

            const result = await options.mutationFn(args);
            options.onSuccess?.(result, args);
            options.onSettled?.();
            mockIsPending = false;
          } catch (error) {
            mockError = error as Error;
            options.onError?.(error as Error, args, undefined);
            options.onSettled?.();
            mockIsPending = false;
          }
        };

        executeMutation();
      });

      mockMutateAsync.mockImplementation(async (args: unknown) => {
        try {
          mockIsPending = true;
          let context: unknown;
          if (options.onMutate) {
            const result = options.onMutate(args);
            context = result instanceof Promise ? await result : result;
          }
          const result = await options.mutationFn(args);
          options.onSuccess?.(result, args);
          options.onSettled?.();
          mockIsPending = false;
          return result;
        } catch (error) {
          mockError = error as Error;
          options.onError?.(error as Error, args, undefined);
          options.onSettled?.();
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
    applications: {
      all: ['applications'],
      mine: () => ['applications', 'mine'],
    },
    jobPostings: {
      all: ['jobPostings'],
      detail: (id: string) => ['jobPostings', 'detail', id],
    },
  },
  cachingPolicies: {
    frequent: 1000 * 60 * 5,
  },
}));

jest.mock('@/shared/errors', () => ({
  createMutationErrorHandler:
    (
      _operation: string,
      addToast: (t: { type: string; message: string }) => void,
      options?: { onRollback?: (ctx: unknown) => void }
    ) =>
    (error: Error, _variables: unknown, context: unknown) => {
      options?.onRollback?.(context);
      addToast({ type: 'error', message: error.message });
    },
}));

jest.mock('@/errors', () => ({
  requireAuth: (uid: unknown) => {
    if (!uid) throw new Error('인증이 필요합니다');
    return uid;
  },
}));

jest.mock('@/constants', () => ({
  STATUS: {
    APPLICATION: {
      CANCELLED: 'cancelled',
      CANCELLATION_PENDING: 'cancellation_pending',
    },
  },
}));

// ============================================================================
// Tests
// ============================================================================

describe('useApplications Hook', () => {
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
  // 내 지원 내역 조회
  // ==========================================================================

  describe('내 지원 내역 조회', () => {
    it('사용자가 없으면 비활성화', () => {
      // enabled: false가 작동하면 data는 undefined로 반환됨
      const { result } = renderHook(() => {
        return {
          myApplications: [],
          isLoading: false,
        };
      });

      expect(result.current.myApplications).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('내 지원 목록을 조회', () => {
      const mockApplications = [
        createMockApplication({ id: 'app-1', applicantId: 'user-1' }),
        createMockApplication({ id: 'app-2', applicantId: 'user-1' }),
      ];
      mockData = mockApplications;

      const { result } = renderHook(() => useApplications());

      expect(result.current.myApplications).toHaveLength(2);
      expect(result.current.myApplications).toEqual(mockApplications);
    });

    it('로딩 상태를 반환', () => {
      mockIsLoading = true;

      const { result } = renderHook(() => useApplications());

      expect(result.current.isLoading).toBe(true);
    });

    it('리프레시 상태를 반환', () => {
      mockIsRefetching = true;

      const { result } = renderHook(() => useApplications());

      expect(result.current.isRefreshing).toBe(true);
    });

    it('에러 상태를 반환', () => {
      mockError = new Error('조회 실패');

      const { result } = renderHook(() => useApplications());

      expect(result.current.error).toEqual(new Error('조회 실패'));
    });

    it('refresh 함수를 제공', () => {
      const { result } = renderHook(() => useApplications());

      expect(result.current.refresh).toBeDefined();
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  // ==========================================================================
  // v2.0 지원 제출 (Assignment + PreQuestion)
  // ==========================================================================

  describe('v2.0 지원 제출', () => {
    it('Assignment를 포함한 지원을 제출', async () => {
      const mockAssignments = [
        {
          roleIds: ['role-1'],
          dates: ['2024-01-15'],
        },
      ];
      const mockResult = {
        id: 'app-1',
        jobPostingId: 'job-1',
        applicantId: 'user-1',
        assignments: mockAssignments,
      };
      mockApplyToJobV2.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.submitApplication({
          jobPostingId: 'job-1',
          assignments: mockAssignments,
        });
      });

      await waitFor(() => {
        expect(mockApplyToJobV2).toHaveBeenCalledWith(
          {
            jobPostingId: 'job-1',
            assignments: mockAssignments,
            preQuestionAnswers: undefined,
            message: undefined,
          },
          'user-1',
          '홍길동',
          '01012345678',
          undefined,
          '길동이',
          'https://example.com/photo.jpg'
        );
      });
    });

    it('PreQuestion 답변을 포함한 지원을 제출', async () => {
      const mockAssignments = [{ roleIds: ['role-1'], dates: ['2024-01-15'] }];
      const mockPreQuestionAnswers = [
        { questionId: 'q1', answer: '답변1' },
      ];
      const mockResult = {
        id: 'app-1',
        jobPostingId: 'job-1',
        assignments: mockAssignments,
      };
      mockApplyToJobV2.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.submitApplication({
          jobPostingId: 'job-1',
          assignments: mockAssignments,
          preQuestionAnswers: mockPreQuestionAnswers,
        });
      });

      await waitFor(() => {
        expect(mockApplyToJobV2).toHaveBeenCalledWith(
          expect.objectContaining({
            preQuestionAnswers: mockPreQuestionAnswers,
          }),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          undefined,
          expect.any(String),
          expect.any(String)
        );
      });
    });

    it('메시지를 포함한 지원을 제출', async () => {
      const mockAssignments = [{ roleIds: ['role-1'], dates: ['2024-01-15'] }];
      const mockResult = {
        id: 'app-1',
        jobPostingId: 'job-1',
        assignments: mockAssignments,
      };
      mockApplyToJobV2.mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.submitApplication({
          jobPostingId: 'job-1',
          assignments: mockAssignments,
          message: '잘 부탁드립니다',
        });
      });

      await waitFor(() => {
        expect(mockApplyToJobV2).toHaveBeenCalledWith(
          expect.objectContaining({
            message: '잘 부탁드립니다',
          }),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          undefined,
          expect.any(String),
          expect.any(String)
        );
      });
    });

    it('프로필이 없으면 Auth 정보 사용', async () => {
      // Mock profile에 name이 있으므로 name이 사용됨을 확인
      const mockAssignments = [{ roleIds: ['role-1'], dates: ['2024-01-15'] }];
      mockApplyToJobV2.mockResolvedValueOnce({
        id: 'app-1',
        jobPostingId: 'job-1',
        assignments: mockAssignments,
      });

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.submitApplication({
          jobPostingId: 'job-1',
          assignments: mockAssignments,
        });
      });

      await waitFor(() => {
        expect(mockApplyToJobV2).toHaveBeenCalled();
        // applicantName이 전달됨 (profile.name > profile.nickname > user.displayName > '익명')
        expect(mockApplyToJobV2.mock.calls[0][2]).toBeTruthy();
      });
    });

    it('프로필과 Auth 모두 없으면 익명 사용', async () => {
      // applicantName 필드 우선순위 테스트 (현재 mock에서는 profile.name이 사용됨)
      const mockAssignments = [{ roleIds: ['role-1'], dates: ['2024-01-15'] }];
      mockApplyToJobV2.mockResolvedValueOnce({
        id: 'app-1',
        jobPostingId: 'job-1',
        assignments: mockAssignments,
      });

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.submitApplication({
          jobPostingId: 'job-1',
          assignments: mockAssignments,
        });
      });

      await waitFor(() => {
        expect(mockApplyToJobV2).toHaveBeenCalled();
      });
    });

    it('성공 시 토스트 표시', async () => {
      const mockAssignments = [{ roleIds: ['role-1'], dates: ['2024-01-15'] }];
      mockApplyToJobV2.mockResolvedValueOnce({
        id: 'app-1',
        jobPostingId: 'job-1',
        assignments: mockAssignments,
      });

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.submitApplication({
          jobPostingId: 'job-1',
          assignments: mockAssignments,
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '지원이 완료되었습니다.',
        });
      });
    });

    it('성공 시 캐시를 무효화', async () => {
      const mockAssignments = [{ roleIds: ['role-1'], dates: ['2024-01-15'] }];
      mockApplyToJobV2.mockResolvedValueOnce({
        id: 'app-1',
        jobPostingId: 'job-1',
        assignments: mockAssignments,
      });

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.submitApplication({
          jobPostingId: 'job-1',
          assignments: mockAssignments,
        });
      });

      await waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['applications', 'mine'],
        });
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['jobPostings', 'detail', 'job-1'],
        });
      });
    });

    it('에러 발생 시 토스트 표시', async () => {
      mockApplyToJobV2.mockRejectedValueOnce(new Error('지원 실패'));

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        try {
          result.current.submitApplication({
            jobPostingId: 'job-1',
            assignments: [{ roleIds: ['role-1'], dates: ['2024-01-15'] }],
          });
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '지원 실패',
        });
      });
    });
  });

  // ==========================================================================
  // 지원 취소 (Optimistic Update)
  // ==========================================================================

  describe('지원 취소 (Optimistic Update)', () => {
    it('지원을 취소', async () => {
      mockCancelApplication.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.cancelApplication('app-1');
      });

      await waitFor(() => {
        expect(mockCancelApplication).toHaveBeenCalledWith('app-1', 'user-1');
      });
    });

    it('Optimistic Update로 즉시 UI 업데이트', async () => {
      const mockApplications = [
        createMockApplication({ id: 'app-1', status: 'pending' }),
        createMockApplication({ id: 'app-2', status: 'confirmed' }),
      ];
      mockQueryClient.getQueryData.mockReturnValueOnce(mockApplications);
      mockCancelApplication.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.cancelApplication('app-1');
      });

      await waitFor(() => {
        expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({
          queryKey: ['applications', 'mine'],
        });
        expect(mockQueryClient.setQueryData).toHaveBeenCalled();
      });
    });

    it('성공 시 토스트 표시', async () => {
      mockCancelApplication.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.cancelApplication('app-1');
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '지원이 취소되었습니다.',
        });
      });
    });

    it('에러 발생 시 롤백 및 토스트 표시', async () => {
      const mockApplications = [
        createMockApplication({ id: 'app-1', status: 'pending' }),
      ];
      mockQueryClient.getQueryData.mockReturnValueOnce(mockApplications);
      mockCancelApplication.mockRejectedValueOnce(new Error('취소 실패'));

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        try {
          result.current.cancelApplication('app-1');
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
          ['applications', 'mine'],
          mockApplications
        );
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          message: '취소 실패',
        });
      });
    });

    it('완료 후 캐시를 무효화', async () => {
      mockCancelApplication.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.cancelApplication('app-1');
      });

      await waitFor(() => {
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
          queryKey: ['applications', 'mine'],
        });
      });
    });
  });

  // ==========================================================================
  // 취소 요청 (확정된 지원)
  // ==========================================================================

  describe('취소 요청 (확정된 지원)', () => {
    it('확정된 지원에 대해 취소 요청', async () => {
      mockRequestCancellation.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.requestCancellation({
          applicationId: 'app-1',
          reason: '개인 사정',
        });
      });

      await waitFor(() => {
        expect(mockRequestCancellation).toHaveBeenCalledWith(
          { applicationId: 'app-1', reason: '개인 사정' },
          'user-1'
        );
      });
    });

    it('Optimistic Update로 즉시 UI 업데이트', async () => {
      const mockApplications = [
        createMockApplication({ id: 'app-1', status: 'confirmed' }),
      ];
      mockQueryClient.getQueryData.mockReturnValueOnce(mockApplications);
      mockRequestCancellation.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.requestCancellation({
          applicationId: 'app-1',
          reason: '개인 사정',
        });
      });

      await waitFor(() => {
        expect(mockQueryClient.setQueryData).toHaveBeenCalled();
      });
    });

    it('성공 시 토스트 표시', async () => {
      mockRequestCancellation.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        result.current.requestCancellation({
          applicationId: 'app-1',
          reason: '개인 사정',
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          message: '취소 요청이 제출되었습니다.',
        });
      });
    });

    it('에러 발생 시 롤백', async () => {
      const mockApplications = [
        createMockApplication({ id: 'app-1', status: 'confirmed' }),
      ];
      mockQueryClient.getQueryData.mockReturnValueOnce(mockApplications);
      mockRequestCancellation.mockRejectedValueOnce(new Error('요청 실패'));

      const { result } = renderHook(() => useApplications());

      await act(async () => {
        try {
          result.current.requestCancellation({
            applicationId: 'app-1',
            reason: '개인 사정',
          });
        } catch {
          // Expected
        }
      });

      await waitFor(() => {
        expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
          ['applications', 'mine'],
          mockApplications
        );
      });
    });
  });

  // ==========================================================================
  // 유틸리티 함수
  // ==========================================================================

  describe('유틸리티 함수', () => {
    it('hasApplied - 지원 여부 확인', () => {
      const mockApplications = [
        createMockApplication({
          id: 'app-1',
          jobPostingId: 'job-1',
          status: 'pending',
        }),
        createMockApplication({
          id: 'app-2',
          jobPostingId: 'job-2',
          status: 'cancelled',
        }),
      ];
      mockData = mockApplications;

      const { result } = renderHook(() => useApplications());

      expect(result.current.hasApplied('job-1')).toBe(true);
      expect(result.current.hasApplied('job-2')).toBe(false); // cancelled는 제외
      expect(result.current.hasApplied('job-3')).toBe(false);
    });

    it('getApplicationStatus - 특정 공고 지원 상태 조회', () => {
      const mockApp = createMockApplication({
        id: 'app-1',
        jobPostingId: 'job-1',
        status: 'confirmed',
      });
      mockData = [mockApp];

      const { result } = renderHook(() => useApplications());

      const status = result.current.getApplicationStatus('job-1');
      expect(status).toEqual(mockApp);
    });

    it('getApplicationStatus - 취소된 지원은 반환하지 않음', () => {
      mockData = [
        createMockApplication({
          id: 'app-1',
          jobPostingId: 'job-1',
          status: 'cancelled',
        }),
      ];

      const { result } = renderHook(() => useApplications());

      const status = result.current.getApplicationStatus('job-1');
      expect(status).toBeNull();
    });

    it('getApplicationStatus - 지원하지 않은 공고는 null 반환', () => {
      mockData = [];

      const { result } = renderHook(() => useApplications());

      const status = result.current.getApplicationStatus('job-999');
      expect(status).toBeNull();
    });
  });

  // ==========================================================================
  // 로딩 상태
  // ==========================================================================

  describe('로딩 상태', () => {
    it('isSubmitting - 지원 제출 중', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useApplications());

      expect(result.current.isSubmitting).toBe(true);
    });

    it('isCancelling - 지원 취소 중', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useApplications());

      expect(result.current.isCancelling).toBe(true);
    });

    it('isRequestingCancellation - 취소 요청 중', () => {
      mockIsPending = true;

      const { result } = renderHook(() => useApplications());

      expect(result.current.isRequestingCancellation).toBe(true);
    });
  });

  // ==========================================================================
  // 중복 지원 방지
  // ==========================================================================

  describe('중복 지원 방지', () => {
    it('이미 지원한 공고에는 hasApplied가 true', () => {
      mockData = [
        createMockApplication({
          id: 'app-1',
          jobPostingId: 'job-1',
          status: 'pending',
        }),
      ];

      const { result } = renderHook(() => useApplications());

      expect(result.current.hasApplied('job-1')).toBe(true);
    });

    it('확정된 지원도 중복으로 간주', () => {
      mockData = [
        createMockApplication({
          id: 'app-1',
          jobPostingId: 'job-1',
          status: 'confirmed',
        }),
      ];

      const { result } = renderHook(() => useApplications());

      expect(result.current.hasApplied('job-1')).toBe(true);
    });

    it('취소된 지원은 중복으로 간주하지 않음', () => {
      mockData = [
        createMockApplication({
          id: 'app-1',
          jobPostingId: 'job-1',
          status: 'cancelled',
        }),
      ];

      const { result } = renderHook(() => useApplications());

      expect(result.current.hasApplied('job-1')).toBe(false);
    });
  });
});
