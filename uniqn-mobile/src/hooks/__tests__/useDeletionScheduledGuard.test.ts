/**
 * @file useDeletionScheduledGuard — P2 #5 탈퇴 grace period 가드 hook.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDeletionScheduledGuard } from '../useDeletionScheduledGuard';

const mockGetDeletionStatus = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/services/auth/accountDeletionService', () => ({
  getDeletionStatus: (...args: unknown[]) => mockGetDeletionStatus(...args),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const pendingDeletion = {
  userId: 'user-1',
  reason: 'no_longer_needed',
  requestedAt: new Date('2026-05-01T00:00:00Z'),
  scheduledDeletionAt: new Date('2026-05-31T00:00:00Z'),
  status: 'pending' as const,
};

describe('useDeletionScheduledGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('user 없음 → deletion null + getDeletionStatus 호출 안 함', async () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useDeletionScheduledGuard());
    expect(result.current.deletion).toBeNull();
    expect(mockGetDeletionStatus).not.toHaveBeenCalled();
  });

  it('user 있고 pending deletion → deletion 반환', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockGetDeletionStatus.mockResolvedValue(pendingDeletion);
    const { result } = renderHook(() => useDeletionScheduledGuard());
    await waitFor(() => {
      expect(result.current.deletion).toEqual(pendingDeletion);
    });
    expect(mockGetDeletionStatus).toHaveBeenCalledWith('user-1');
  });

  it('cancelled status → deletion null (pending만 노출)', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockGetDeletionStatus.mockResolvedValue({ ...pendingDeletion, status: 'cancelled' });
    const { result } = renderHook(() => useDeletionScheduledGuard());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.deletion).toBeNull();
  });

  it('완료된 deletion → deletion null', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockGetDeletionStatus.mockResolvedValue({ ...pendingDeletion, status: 'completed' });
    const { result } = renderHook(() => useDeletionScheduledGuard());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.deletion).toBeNull();
  });

  it('getDeletionStatus 실패 → silent (deletion null, 모달 표시 안 함)', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockGetDeletionStatus.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useDeletionScheduledGuard());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.deletion).toBeNull();
  });

  it('dismiss 호출 후 같은 user에 대해 deletion null 유지', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockGetDeletionStatus.mockResolvedValue(pendingDeletion);
    const { result } = renderHook(() => useDeletionScheduledGuard());

    await waitFor(() => {
      expect(result.current.deletion).toEqual(pendingDeletion);
    });

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.deletion).toBeNull();
  });

  it('user 변경 시 새로 조회', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user-1' } });
    mockGetDeletionStatus.mockResolvedValue(null);
    const { result, rerender } = renderHook(() => useDeletionScheduledGuard());
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockGetDeletionStatus).toHaveBeenCalledWith('user-1');

    mockUseAuth.mockReturnValue({ user: { uid: 'user-2' } });
    mockGetDeletionStatus.mockResolvedValue(pendingDeletion);
    rerender(undefined);

    await waitFor(() => {
      expect(result.current.deletion).toEqual(pendingDeletion);
    });
    expect(mockGetDeletionStatus).toHaveBeenCalledWith('user-2');
  });
});
