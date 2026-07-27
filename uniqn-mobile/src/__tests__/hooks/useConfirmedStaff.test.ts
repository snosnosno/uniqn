import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ConfirmedStaff, ConfirmedStaffGroup, ConfirmedStaffStats } from '@/types';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';

const mockGetConfirmedStaff = jest.fn();
const mockGetConfirmedStaffByDate = jest.fn();
const mockAddDirectStaff = jest.fn();
const mockUpdateStaffRole = jest.fn();
const mockUpdateConfirmedStaffWorkTime = jest.fn();
const mockCancelConfirmedStaffConfirmation = jest.fn();
const mockMarkAsNoShow = jest.fn();
const mockCancelNoShow = jest.fn();
const mockUpdateStaffStatus = jest.fn();
const mockSubscribeToConfirmedStaff = jest.fn();
const mockAddToast = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockRefetch = jest.fn();
const mockInvalidateStaffManagement = jest.fn();
const mockInvalidateJobPostings = jest.fn();
const mockCancelQueries = jest.fn();
const mockGetQueryData = jest.fn();
const mockSetQueryData = jest.fn();
const mockInvalidateQueriesClient = jest.fn();

let mockData: unknown;
let mockError: Error | null;
let mockIsLoading: boolean;
let mockIsRefetching: boolean;
let mockPendingStates = [false, false, false, false, false];

jest.mock('@/services', () => ({
  getConfirmedStaff: (...args: unknown[]) => mockGetConfirmedStaff(...args),
  getConfirmedStaffByDate: (...args: unknown[]) => mockGetConfirmedStaffByDate(...args),
  addDirectStaff: (...args: unknown[]) => mockAddDirectStaff(...args),
  updateStaffRole: (...args: unknown[]) => mockUpdateStaffRole(...args),
  updateConfirmedStaffWorkTime: (...args: unknown[]) => mockUpdateConfirmedStaffWorkTime(...args),
  cancelConfirmedStaffConfirmation: (...args: unknown[]) =>
    mockCancelConfirmedStaffConfirmation(...args),
  markAsNoShow: (...args: unknown[]) => mockMarkAsNoShow(...args),
  cancelNoShow: (...args: unknown[]) => mockCancelNoShow(...args),
  updateStaffStatus: (...args: unknown[]) => mockUpdateStaffStatus(...args),
  subscribeToConfirmedStaff: (...args: unknown[]) => mockSubscribeToConfirmedStaff(...args),
}));

jest.mock('@/shared/errors/hookErrorHandler', () => ({
  createMutationErrorHandler:
    (
      _context: string,
      addToast: (payload: { type: string; message: string }) => void,
      options?: { onRollback?: (ctx: unknown) => void }
    ) =>
    (error: Error, _variables?: unknown, mutationContext?: unknown) => {
      if (options?.onRollback && mutationContext) {
        options.onRollback(mutationContext);
      }
      addToast({ type: 'error', message: error.message });
    },
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: { user: { uid: string } }) => unknown) => {
    const state = { user: { uid: 'employer-1' } };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/stores/toastStore', () => ({
  useToastStore: (selector?: (state: { addToast: typeof mockAddToast }) => unknown) => {
    const state = { addToast: mockAddToast };
    return selector ? selector(state) : state;
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    confirmedStaff: {
      byJobPosting: (id: string) => ['confirmedStaff', 'byJobPosting', id],
      byDate: (id: string, date: string) => ['confirmedStaff', 'byDate', id, date],
    },
    workSchedule: {
      all: ['workSchedule'],
    },
  },
  cachingPolicies: {
    frequent: 5 * 60 * 1000,
  },
  invalidateQueries: {
    staffManagement: (...args: unknown[]) => mockInvalidateStaffManagement(...args),
    jobPostings: (...args: unknown[]) => mockInvalidateJobPostings(...args),
  },
}));

jest.mock('@tanstack/react-query', () => {
  let mutationIndex = 0;

  return {
    useQuery: jest.fn((options: { enabled?: boolean; queryFn: () => Promise<unknown> }) => {
      if (options.enabled === false) {
        return {
          data: undefined,
          isLoading: false,
          isRefetching: false,
          error: null,
          refetch: mockRefetch,
        };
      }

      void Promise.resolve().then(() => options.queryFn());

      return {
        data: mockData,
        isLoading: mockIsLoading,
        isRefetching: mockIsRefetching,
        error: mockError,
        refetch: mockRefetch,
      };
    }),
    useMutation: jest.fn(
      (options: {
        mutationFn: (...args: unknown[]) => Promise<unknown>;
        onSuccess?: (data: unknown) => void;
        onError?: (error: Error, variables?: unknown, context?: unknown) => void;
      }) => {
        const currentIndex = mutationIndex++;

        return {
          mutate: (variables: unknown) => {
            Promise.resolve(options.mutationFn(variables))
              .then((result) => {
                options.onSuccess?.(result);
              })
              .catch((error: Error) => {
                options.onError?.(error, variables, undefined);
              });
          },
          mutateAsync: (variables: unknown) =>
            Promise.resolve(options.mutationFn(variables))
              .then((result) => {
                options.onSuccess?.(result);
                return result;
              })
              .catch((error: Error) => {
                options.onError?.(error, variables, undefined);
                throw error;
              }),
          isPending: mockPendingStates[currentIndex] ?? false,
        };
      }
    ),
    useQueryClient: () => ({
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
      invalidateQueries: mockInvalidateQueriesClient,
    }),
  };
});

function createMockConfirmedStaff(overrides: Partial<ConfirmedStaff> = {}): ConfirmedStaff {
  return {
    id: 'worklog-1',
    staffId: 'staff-1',
    staffName: 'Staff One',
    role: 'dealer',
    date: '2025-01-20',
    timeSlot: '09:00-18:00',
    status: 'scheduled',
    checkInTime: null,
    checkOutTime: null,
    ...overrides,
  };
}

function createMockGroup(staff: ConfirmedStaff[]): ConfirmedStaffGroup {
  return {
    date: '2025-01-20',
    formattedDate: '2025-01-20',
    staff,
    isToday: false,
    isPast: false,
    stats: {
      total: staff.length,
      checkedIn: 0,
      completed: 0,
      noShow: 0,
    },
  };
}

function createMockStats(): ConfirmedStaffStats {
  return {
    total: 1,
    scheduled: 1,
    checkedIn: 0,
    checkedOut: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    settled: 0,
  };
}

describe('useConfirmedStaff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockData = undefined;
    mockError = null;
    mockIsLoading = false;
    mockIsRefetching = false;
    mockPendingStates = [false, false, false, false, false];
  });

  it('returns fetched confirmed staff data', () => {
    const staff = [createMockConfirmedStaff()];
    const grouped = [createMockGroup(staff)];
    const stats = createMockStats();
    mockData = { staff, grouped, stats };

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    expect(result.current.staff).toEqual(staff);
    expect(result.current.grouped).toEqual(grouped);
    expect(result.current.stats).toEqual(stats);
  });

  it('fetches confirmed staff by date when date option is set', async () => {
    mockGetConfirmedStaffByDate.mockResolvedValue([createMockConfirmedStaff()]);

    renderHook(() => useConfirmedStaff('job-1', { date: '2025-01-20' }));

    await waitFor(() => {
      expect(mockGetConfirmedStaffByDate).toHaveBeenCalledWith('job-1', '2025-01-20');
    });
  });

  it('refreshes query in non-realtime mode', () => {
    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.refresh();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('subscribes in realtime mode and applies updates', async () => {
    let onUpdate:
      | ((result: {
          staff: ConfirmedStaff[];
          grouped: ConfirmedStaffGroup[];
          stats: ConfirmedStaffStats;
        }) => void)
      | undefined;

    mockSubscribeToConfirmedStaff.mockImplementation(
      (_jobPostingId: string, callbacks: { onUpdate: typeof onUpdate }) => {
        onUpdate = callbacks.onUpdate;
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

    act(() => {
      onUpdate?.({
        staff: [createMockConfirmedStaff()],
        grouped: [createMockGroup([createMockConfirmedStaff()])],
        stats: createMockStats(),
      });
    });

    await waitFor(() => {
      expect(result.current.staff).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('changes role with fallback changedBy', async () => {
    mockUpdateStaffRole.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.changeRole({
        workLogId: 'worklog-1',
        newRole: 'floor',
        reason: 'Role update',
      });
    });

    await waitFor(() => {
      expect(mockUpdateStaffRole).toHaveBeenCalledWith({
        workLogId: 'worklog-1',
        newRole: 'floor',
        reason: 'Role update',
        changedBy: 'employer-1',
      });
      expect(mockInvalidateStaffManagement).toHaveBeenCalledWith('job-1');
    });
  });

  it('updates work time with fallback modifiedBy', async () => {
    mockUpdateConfirmedStaffWorkTime.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.updateWorkTime({
        workLogId: 'worklog-1',
        checkInTime: new Date('2025-01-20T09:00:00Z'),
        checkOutTime: new Date('2025-01-20T18:00:00Z'),
        reason: 'Time correction',
      });
    });

    await waitFor(() => {
      expect(mockUpdateConfirmedStaffWorkTime).toHaveBeenCalledWith({
        workLogId: 'worklog-1',
        checkInTime: new Date('2025-01-20T09:00:00Z'),
        checkOutTime: new Date('2025-01-20T18:00:00Z'),
        reason: 'Time correction',
        modifiedBy: 'employer-1',
      });
    });
  });

  it('removes confirmed staff through confirmation cancellation', async () => {
    mockCancelConfirmedStaffConfirmation.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.removeStaff({
        workLogId: 'worklog-1',
        jobPostingId: 'job-1',
        staffId: 'staff-1',
        date: '2025-01-20',
        reason: 'Release slot',
      });
    });

    await waitFor(() => {
      expect(mockCancelConfirmedStaffConfirmation).toHaveBeenCalledWith({
        workLogId: 'worklog-1',
        jobPostingId: 'job-1',
        staffId: 'staff-1',
        date: '2025-01-20',
        reason: 'Release slot',
      });
    });
  });

  it('marks no-show through canonical mutation', async () => {
    mockMarkAsNoShow.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.setNoShow('worklog-1', 'No arrival');
    });

    await waitFor(() => {
      expect(mockMarkAsNoShow).toHaveBeenCalledWith('worklog-1', 'No arrival');
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '노쇼 처리되었습니다.',
      });
    });
  });

  it('cancels no-show through canonical mutation and invalidates staff management cache', async () => {
    mockCancelNoShow.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.cancelNoShow('worklog-1');
    });

    await waitFor(() => {
      expect(mockCancelNoShow).toHaveBeenCalledWith('worklog-1');
      expect(mockInvalidateStaffManagement).toHaveBeenCalledWith('job-1');
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '노쇼가 취소되었습니다.',
      });
    });
  });

  it('surfaces the server-specific rejection message when no-show cancellation fails', async () => {
    mockCancelNoShow.mockRejectedValue(
      new Error('이미 정산이 완료된 근무 기록은 노쇼를 취소할 수 없습니다.')
    );

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.cancelNoShow('worklog-1');
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'error',
        message: '이미 정산이 완료된 근무 기록은 노쇼를 취소할 수 없습니다.',
      });
    });
  });

  it('changes staff status through manual mutation path', async () => {
    mockUpdateStaffStatus.mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    act(() => {
      result.current.changeStatus('worklog-1', 'completed');
    });

    await waitFor(() => {
      expect(mockUpdateStaffStatus).toHaveBeenCalledWith('worklog-1', 'completed');
      expect(mockInvalidateStaffManagement).toHaveBeenCalledWith('job-1');
      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'success',
        message: '상태가 변경되었습니다.',
      });
    });
  });

  it('adds direct staff and invalidates staff, jobPostings, and workSchedule caches (W-1)', async () => {
    mockAddDirectStaff.mockResolvedValue(['worklog-new']);

    const { result } = renderHook(() => useConfirmedStaff('job-1'));

    await act(async () => {
      await result.current.addStaff({
        jobPostingId: 'job-1',
        staffId: 'staff-1',
        assignments: [{ date: '2026-07-05', role: 'dealer' }],
      });
    });

    expect(mockAddDirectStaff).toHaveBeenCalled();
    expect(mockInvalidateStaffManagement).toHaveBeenCalledWith('job-1');
    expect(mockInvalidateJobPostings).toHaveBeenCalled();
    // W-1: 스태프탭 직접추가가 근무표에 즉시 반영되도록 workSchedule 캐시 무효화
    expect(mockInvalidateQueriesClient).toHaveBeenCalledWith({ queryKey: ['workSchedule'] });
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: '스태프가 추가되었습니다.',
    });
  });
  // --- realtime 계약 (STAFF-1 CRITICAL · STAFF-11) ---------------------------
  // useQuery 가 `enabled: !realtime` 로 영구 disabled 라, 이 모드에서는 훅이 자체 상태로
  // error·isRefreshing 을 만들어야 한다. 예전엔 그게 없어 구독이 죽어도 error=null +
  // isLoading=true 로 굳었고(무한 스피너), 화면의 ErrorState 는 도달 불가한 죽은 코드였다.

  it('realtime 구독이 실패하면 error 를 노출하고 로딩을 끝낸다 (무한 스피너 방지)', async () => {
    let onError: ((error: Error) => void) | undefined;
    mockSubscribeToConfirmedStaff.mockImplementation(
      (_jobPostingId: string, callbacks: { onError: typeof onError }) => {
        onError = callbacks.onError;
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    act(() => {
      onError?.(new Error('subscription dead'));
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error?.message).toBe('subscription dead');
    expect(result.current.isLoading).toBe(false);
  });

  it('realtime 모드에서도 refresh 가 실제로 조회를 호출한다 (no-op 아님)', async () => {
    mockSubscribeToConfirmedStaff.mockImplementation(() => jest.fn());
    mockRefetch.mockResolvedValue({ data: undefined, error: null });

    const { result } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

    await act(async () => {
      result.current.refresh();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('realtime 새로고침 결과가 화면 데이터에 반영된다', async () => {
    mockSubscribeToConfirmedStaff.mockImplementation(() => jest.fn());
    const refreshed = {
      staff: [createMockConfirmedStaff()],
      grouped: [],
      stats: { total: 1, checkedIn: 0, checkedOut: 0, noShow: 0 },
    };
    mockRefetch.mockResolvedValue({ data: refreshed, error: null });

    const { result } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.staff).toHaveLength(1);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('구독이 성공하면 이전 에러가 해소된다', async () => {
    let onUpdate: ((result: unknown) => void) | undefined;
    let onError: ((error: Error) => void) | undefined;
    mockSubscribeToConfirmedStaff.mockImplementation(
      (
        _jobPostingId: string,
        callbacks: { onUpdate: typeof onUpdate; onError: typeof onError }
      ) => {
        onUpdate = callbacks.onUpdate;
        onError = callbacks.onError;
        return jest.fn();
      }
    );

    const { result } = renderHook(() => useConfirmedStaff('job-1', { realtime: true }));

    act(() => {
      onError?.(new Error('temporary'));
    });
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    act(() => {
      onUpdate?.({
        staff: [createMockConfirmedStaff()],
        grouped: [],
        stats: { total: 1, checkedIn: 0, checkedOut: 0, noShow: 0 },
      });
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    expect(result.current.staff).toHaveLength(1);
  });
});
