import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { CreateJobPostingInput, UpdateJobPostingInput } from '@/types';
import {
  useCreateJobPosting,
  useMyJobPostings,
  useUpdateJobPosting,
} from '@/hooks/useJobManagement';

const mockGetMyJobPostings = jest.fn();
const mockCreateJobPosting = jest.fn();
const mockUpdateJobPosting = jest.fn();
const mockInvalidateQueries = jest.fn();
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
    cancelQueries: jest.fn(),
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
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
              roles: [{ role: 'dealer', count: 2, filled: 0 }],
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
    ]);
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
    expect(mockAddToast).toHaveBeenCalledWith({
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
});
