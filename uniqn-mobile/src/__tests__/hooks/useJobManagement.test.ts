import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { CreateJobPostingInput, UpdateJobPostingInput } from '@/types';
import {
  useCreateJobPosting,
  useBulkUpdateStatus,
  useCloseJobPosting,
  useDeleteJobPosting,
  useMyJobPostings,
  useReopenJobPosting,
  useUpdateJobPosting,
} from '@/hooks/useJobManagement';
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';

jest.mock('@/hooks/workspace/useActiveWorkspace', () => ({
  useActiveWorkspace: jest.fn(),
}));
const mockUseActiveWorkspace = useActiveWorkspace as jest.MockedFunction<typeof useActiveWorkspace>;

const mockGetMyJobPostings = jest.fn();
const mockCreateJobPosting = jest.fn();
const mockUpdateJobPosting = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockCancelQueries = jest.fn();
const mockGetQueryData = jest.fn(() => undefined as unknown);
const mockSetQueryData = jest.fn();
const mockAddToast = jest.fn();

let mockQueryData: unknown;
let mockQueryError: Error | null = null;
let mockQueryLoading = false;

jest.mock('@/services', () => ({
  getMyJobPostings: (...args: unknown[]) => mockGetMyJobPostings(...args),
  createJobPosting: (...args: unknown[]) => mockCreateJobPosting(...args),
  updateJobPosting: (...args: unknown[]) => mockUpdateJobPosting(...args),
  deleteJobPosting: jest.fn(),
  closeJobPosting: jest.fn(),
  reopenJobPosting: jest.fn(),
  getMyJobPostingStats: jest.fn(),
  bulkUpdateJobPostingStatus: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { uid: 'employer-1', displayName: 'Display Name' },
    profile: { name: 'Owner Name', nickname: 'Owner Nick' },
  }),
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({
    addToast: mockAddToast,
  }),
}));

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
    weeklyGrid: {
      all: ['weeklyGrid'],
    },
  },
  cachingPolicies: {
    frequent: 1000,
  },
}));

jest.mock('@/hooks/useJobDetail', () => ({
  getJobDetailQueryKey: (id: string) => ['jobPostings', 'detail', id],
}));

jest.mock('@/hooks/useThrottledCallback', () => ({
  useThrottledCallback: (callback: (...args: unknown[]) => unknown) => callback,
}));

jest.mock('@/shared/errors', () => ({
  createMutationErrorHandler:
    (_operation: string, addToast: (payload: { type: string; message: string }) => void) =>
    (error: Error) => {
      addToast({ type: 'error', message: error.message });
    },
}));

jest.mock('@/errors', () => ({
  requireAuth: (uid: string | undefined) => {
    if (!uid) {
      throw new Error('auth required');
    }
    return uid;
  },
}));

jest.mock('@/services/offline/remoteMutationGuard', () => ({
  requireOnlineForMutation: jest.fn(),
  shouldApplyOptimisticUpdate: jest.fn(() => false),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(
    (_options: { queryFn: () => Promise<unknown>; enabled?: boolean; queryKey: unknown[] }) => ({
      data: mockQueryData,
      isLoading: mockQueryLoading,
      error: mockQueryError,
      refetch: jest.fn(),
    })
  ),
  useMutation: jest.fn(
    (options: {
      mutationFn: (args: unknown) => Promise<unknown>;
      onSuccess?: (data: unknown, variables: unknown) => void;
      onError?: (error: Error) => void;
    }) => ({
      mutate: async (args: unknown) => {
        try {
          const result = await options.mutationFn(args);
          options.onSuccess?.(result, args);
          return result;
        } catch (error) {
          options.onError?.(error as Error);
          throw error;
        }
      },
      mutateAsync: async (args: unknown) => {
        try {
          const result = await options.mutationFn(args);
          options.onSuccess?.(result, args);
          return result;
        } catch (error) {
          options.onError?.(error as Error);
          throw error;
        }
      },
      isPending: false,
      error: null,
      data: undefined,
    })
  ),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    cancelQueries: mockCancelQueries,
    getQueryData: mockGetQueryData,
    setQueryData: mockSetQueryData,
  }),
}));

function createInput(): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: 'Dealer Hiring',
    description: 'Canonical posting',
    location: {
      name: 'Seoul Gangnam',
      address: 'Teheran-ro',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-04-01',
      allDates: ['2026-04-01'],
      requirements: [
        {
          date: '2026-04-01',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 2 }],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' }],
    compensation: { mode: 'shared' },
    questions: { items: [] },
  };
}

describe('useJobManagement hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryData = undefined;
    mockQueryError = null;
    mockQueryLoading = false;
    // Re-set default return values for module-level spies after clearAllMocks
    mockGetQueryData.mockReturnValue(undefined);
    mockUseActiveWorkspace.mockReturnValue({
      activeWorkspace: {
        id: 'ws-default',
        name: 'Default',
        ownerId: 'employer-1',
        memberCount: 1,
      } as any,
      workspaces: [],
      isLoading: false,
      setActiveWorkspaceId: jest.fn(),
    });
  });

  it('returns employer postings from useMyJobPostings', () => {
    mockQueryData = [{ id: 'job-1' }, { id: 'job-2' }];

    const { result } = renderHook(() => useMyJobPostings());

    expect(result.current.data).toEqual([{ id: 'job-1' }, { id: 'job-2' }]);

    const { useQuery } = jest.requireMock('@tanstack/react-query') as {
      useQuery: jest.Mock;
    };

    expect(useQuery.mock.calls[0][0].queryKey).toEqual([
      'jobManagement',
      'myPostings',
      'employer-1',
      'ws-default',
    ]);
  });

  it('Phase 2A.후속 — activeWorkspace 가 없으면 enabled 가 false 다', () => {
    mockUseActiveWorkspace.mockReturnValue({
      activeWorkspace: undefined,
      workspaces: [],
      isLoading: false,
      setActiveWorkspaceId: jest.fn(),
    });

    renderHook(() => useMyJobPostings());

    const { useQuery } = jest.requireMock('@tanstack/react-query') as {
      useQuery: jest.Mock;
    };

    expect(useQuery.mock.calls[0][0].enabled).toBe(false);
  });

  it('Phase 2A.후속 — activeWorkspace.id 가 query key 에 포함된다', () => {
    mockUseActiveWorkspace.mockReturnValue({
      activeWorkspace: { id: 'ws-abc', name: 'Test', ownerId: 'u1', memberCount: 1 } as any,
      workspaces: [],
      isLoading: false,
      setActiveWorkspaceId: jest.fn(),
    });

    renderHook(() => useMyJobPostings());

    const { useQuery } = jest.requireMock('@tanstack/react-query') as {
      useQuery: jest.Mock;
    };

    expect(useQuery.mock.calls[0][0].queryKey).toEqual(
      expect.arrayContaining(['myPostings', 'ws-abc'])
    );
  });

  it('Phase 2A.후속 — getMyJobPostings 호출 시 workspaceId 옵션이 전달된다', async () => {
    mockUseActiveWorkspace.mockReturnValue({
      activeWorkspace: { id: 'ws-abc', name: 'Test', ownerId: 'u1', memberCount: 1 } as any,
      workspaces: [],
      isLoading: false,
      setActiveWorkspaceId: jest.fn(),
    });
    mockGetMyJobPostings.mockResolvedValue([]);

    renderHook(() => useMyJobPostings());

    const { useQuery } = jest.requireMock('@tanstack/react-query') as {
      useQuery: jest.Mock;
    };

    // queryFn を直接呼び出して workspaceId が渡されていることを確認
    await useQuery.mock.calls[0][0].queryFn();

    expect(mockGetMyJobPostings).toHaveBeenCalledWith('employer-1', { workspaceId: 'ws-abc' });
  });

  it('submits canonical create payloads and invalidates posting queries', async () => {
    const input = createInput();
    mockCreateJobPosting.mockResolvedValue({ id: 'job-1', jobPosting: { title: input.title } });

    const { result } = renderHook(() => useCreateJobPosting());

    await act(async () => {
      await result.current.mutateAsync({ input });
    });

    await waitFor(() => {
      expect(mockCreateJobPosting).toHaveBeenCalledWith(input, 'employer-1', 'Owner Name');
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobManagement'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobPostings'] });
    // 그리드 발행 반영(P2-2): weeklyGrid prefix 무효화
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['weeklyGrid'] });
    // 성공 토스트는 호출부(create 화면, postingType별 문구) 담당 — 훅 중복 발송 금지(P2-2 디듑)
    expect(mockAddToast).not.toHaveBeenCalledWith({
      type: 'success',
      message: '공고가 등록되었습니다.',
    });
  });

  it('passes canonical update payloads through useUpdateJobPosting', async () => {
    const input: UpdateJobPostingInput = {
      compensation: {
        mode: 'shared',
        defaultSalary: { type: 'hourly', amount: 20000 },
      },
      questions: { items: [] },
    };
    mockUpdateJobPosting.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateJobPosting());

    await act(async () => {
      await result.current.mutateAsync({
        jobPostingId: 'job-1',
        input,
      });
    });

    await waitFor(() => {
      expect(mockUpdateJobPosting).toHaveBeenCalledWith('job-1', input, 'employer-1');
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobManagement'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['jobPostings', 'detail', 'job-1'],
    });
  });

  it('surfaces create errors through the shared mutation error handler', async () => {
    mockCreateJobPosting.mockRejectedValue(new Error('create failed'));

    const { result } = renderHook(() => useCreateJobPosting());

    await act(async () => {
      await expect(result.current.mutateAsync({ input: createInput() })).rejects.toThrow(
        'create failed'
      );
    });

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      message: 'create failed',
    });
  });

  describe('Phase 2A.후속 — mutation hook query key alignment', () => {
    // Verifies that each mutation hook passes activeWorkspace.id to
    // getMyJobPostingsQueryKey so optimistic updates target the live cache key
    // instead of the ghost key ['jobManagement', 'myPostings', userId, 'no-workspace'].
    //
    // Strategy: capture the `onMutate` closure from useMutation via mockImplementationOnce,
    // then invoke it. The module-level mockCancelQueries spy (already wired into
    // useQueryClient above) records which queryKey was passed.

    beforeEach(() => {
      mockCancelQueries.mockClear();
      mockGetQueryData.mockClear();
      mockSetQueryData.mockClear();
    });

    async function captureAndRunOnMutate(
      hookFn: () => unknown,
      mutateArg: unknown,
      workspaceId: string
    ) {
      mockUseActiveWorkspace.mockReturnValue({
        activeWorkspace: { id: workspaceId, name: 'Test', ownerId: 'u1', memberCount: 1 } as any,
        workspaces: [],
        isLoading: false,
        setActiveWorkspaceId: jest.fn(),
      });

      let capturedOnMutate: ((arg: unknown) => Promise<unknown>) | undefined;

      const { useMutation } = jest.requireMock('@tanstack/react-query') as {
        useMutation: jest.Mock;
      };

      useMutation.mockImplementationOnce(
        (options: { onMutate?: (arg: unknown) => Promise<unknown>; mutationFn: () => void }) => {
          capturedOnMutate = options.onMutate;
          return { mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false, error: null };
        }
      );

      renderHook(hookFn as () => void);

      if (!capturedOnMutate) {
        throw new Error(
          'onMutate was not captured from useMutation — hook may not call useMutation'
        );
      }

      await act(async () => {
        await capturedOnMutate!(mutateArg);
      });

      expect(mockCancelQueries).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining([workspaceId]),
        })
      );
    }

    it('useDeleteJobPosting — onMutate 가 activeWorkspace.id 포함 key 로 cancelQueries 를 호출한다', async () => {
      // useDeleteJobPosting gates cancelQueries on shouldApplyOptimisticUpdate()
      const { shouldApplyOptimisticUpdate } = jest.requireMock(
        '@/services/offline/remoteMutationGuard'
      ) as { shouldApplyOptimisticUpdate: jest.Mock };
      shouldApplyOptimisticUpdate.mockReturnValueOnce(true);

      await captureAndRunOnMutate(() => useDeleteJobPosting(), 'job-del-1', 'ws-delete');
    });

    it('useCloseJobPosting — onMutate 가 activeWorkspace.id 포함 key 로 cancelQueries 를 호출한다', async () => {
      await captureAndRunOnMutate(() => useCloseJobPosting(), 'job-close-1', 'ws-close');
    });

    it('useReopenJobPosting — onMutate 가 activeWorkspace.id 포함 key 로 cancelQueries 를 호출한다', async () => {
      await captureAndRunOnMutate(() => useReopenJobPosting(), 'job-reopen-1', 'ws-reopen');
    });

    it('useBulkUpdateStatus — onMutate 가 activeWorkspace.id 포함 key 로 cancelQueries 를 호출한다', async () => {
      await captureAndRunOnMutate(
        () => useBulkUpdateStatus(),
        { jobPostingIds: ['job-1'], status: 'closed' },
        'ws-bulk'
      );
    });
  });
});
