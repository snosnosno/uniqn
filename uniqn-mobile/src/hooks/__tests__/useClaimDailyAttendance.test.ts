/**
 * useClaimDailyAttendance 훅 단위 테스트
 *
 * STEP 0 확인 결과:
 *  - useToastStore: @/stores/toastStore (또는 @/stores 인덱스)
 *  - addToast 시그니처: addToast({ type, message }) — ToastType: success|error|warning|info
 *  - queryKeys.wallet.summary(uid) 존재 확인 (queryClient.ts:565)
 *  - walletService.claimDailyAttendance @/services/wallet 인덱스 re-export 확인
 *  - useAuth user?.uid 필드 확인
 */

import { useClaimDailyAttendance } from '../useClaimDailyAttendance';
import { queryKeys } from '@/lib/queryClient';

const mockUseMutation = jest.fn();
const mockInvalidate = jest.fn();
const mockClaim = jest.fn();
const mockAddToast = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: (opts: unknown) => mockUseMutation(opts),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/services/wallet', () => ({
  claimDailyAttendance: (...a: unknown[]) => mockClaim(...a),
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'user-1' } }) }));
jest.mock('@/stores/toastStore', () => ({
  useToastStore: () => ({ addToast: mockAddToast }),
}));

// queryClient.ts는 QueryCache/MutationCache 생성자를 사용하므로 모킹 필요
jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    wallet: {
      all: ['wallet'],
      summary: (uid?: string) => ['wallet', 'summary', uid ?? 'me'],
    },
  },
}));

describe('useClaimDailyAttendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  it('mutationFn은 walletService.claimDailyAttendance를 호출한다', async () => {
    useClaimDailyAttendance();
    const opts = mockUseMutation.mock.calls[0][0];
    await opts.mutationFn();
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('claimed 성공 시 wallet.summary 키를 invalidate하고 성공 토스트', () => {
    useClaimDailyAttendance();
    const opts = mockUseMutation.mock.calls[0][0];
    opts.onSuccess({ status: 'claimed', amount: 1, expiresAt: '2026-08-29T00:00:00Z' });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: queryKeys.wallet.summary('user-1') });
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('already_claimed 시 info 토스트, invalidate 안 함', () => {
    useClaimDailyAttendance();
    const opts = mockUseMutation.mock.calls[0][0];
    opts.onSuccess({ status: 'already_claimed' });
    expect(mockAddToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
    expect(mockInvalidate).not.toHaveBeenCalled();
  });
});
