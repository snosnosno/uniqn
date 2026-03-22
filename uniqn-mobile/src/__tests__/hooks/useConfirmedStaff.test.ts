import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ConfirmedStaff, ConfirmedStaffGroup, ConfirmedStaffStats } from '@/types';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';

const mockGetConfirmedStaff = jest.fn();
const mockGetConfirmedStaffByDate = jest.fn();
const mockUpdateStaffRole = jest.fn();
const mockUpdateConfirmedStaffWorkTime = jest.fn();
const mockCancelConfirmedStaffConfirmation = jest.fn();
const mockMarkAsNoShow = jest.fn();
const mockSubscribeToConfirmedStaff = jest.fn();
const mockAddToast = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockRefetch = jest.fn();
const mockInvalidateStaffManagement = jest.fn();
const mockCancelQueries = jest.fn();
const mockGetQueryData = jest.fn();
const mockSetQueryData = jest.fn();

let mockData: unknown;
let mockError: Error | null;
let mockIsLoading: boolean;
let mockIsRefetching: boolean;
let mockPendingStates = [false, false, false, false];

jest.mock('@/services', () => ({
  getConfirmedStaff: (...args: unknown[]) => mockGetConfirmedStaff(...args),
  getConfirmedStaffByDate: (...args: unknown[]) => mockGetConfirmedStaffByDate(...args),
  updateStaffRole: (...args: unknown[]) => mockUpdateStaffRole(...args),
  updateConfirmedStaffWorkTime: (...args: unknown[]) => mockUpdateConfirmedStaffWorkTime(...args),
  cancelConfirmedStaffConfirmation: (...args: unknown[]) =>
    mockCancelConfirmedStaffConfirmation(...args),
  markAsNoShow: (...args: unknown[]) => mockMarkAsNoShow(...args),
  subscribeToConfirmedStaff: (...args: unknown[]) => mockSubscribeToConfirmedStaff(...args),
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
  },
  cachingPolicies: {
    frequent: 5 * 60 * 1000,
  },
  invalidateQueries: {
    staffManagement: (...args: unknown[]) => mockInvalidateStaffManagement(...args),
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
          isPending: mockPendingStates[currentIndex] ?? false,
        };
      }
    ),
    useQueryClient: () => ({
      cancelQueries: mockCancelQueries,
      getQueryData: mockGetQueryData,
      setQueryData: mockSetQueryData,
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
    mockPendingStates = [false, false, false, false];
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
    });
  });
});
