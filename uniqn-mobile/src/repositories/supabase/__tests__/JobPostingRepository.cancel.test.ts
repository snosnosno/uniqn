// src/repositories/supabase/__tests__/JobPostingRepository.cancel.test.ts
// M4: deleteWithTransaction 이 취소+환불을 단일 원자 RPC(cancel_job_posting_with_refund_atomically)로
//     호출하고, RPC 실패를 swallow 하지 않고 표면화하는지 검증.
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { ERROR_CODES } from '@/errors/AppError';

const mockCancel = jest.fn();
jest.mock('@/repositories/supabase/WalletRepository', () => ({
  WalletRepository: {
    cancelJobPostingWithRefund: (...args: unknown[]) => mockCancel(...args),
  },
}));

// loadAndVerifyDeleteAccess 는 supabase/parse 의존이라 stub (권한 검증은 별도 테스트가 커버)
const mockLoadDelete = jest.fn();
jest.mock('../JobPostingRepositoryHelpers', () => ({
  ...jest.requireActual('../JobPostingRepositoryHelpers'),
  loadAndVerifyDeleteAccess: (...args: unknown[]) => mockLoadDelete(...args),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn() },
}));
jest.mock('@/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const OWNER = '11111111-1111-4111-8111-111111111111';
const POSTING = '55555555-5555-4555-8555-555555555555';

beforeEach(() => {
  mockCancel.mockReset();
  mockLoadDelete.mockReset();
  mockLoadDelete.mockResolvedValue({ ownerId: OWNER, filledPositions: 0 });
});

describe('deleteWithTransaction → M3 단일 취소+환불 RPC', () => {
  const repo = new SupabaseJobPostingRepository();

  it('취소 시 cancel RPC를 (postingId, ownerId)로 정확히 1회 호출', async () => {
    mockCancel.mockResolvedValue({
      success: true,
      refund: { success: true, refunded_diamonds: 0, refunded_hearts: 0 },
    });

    await repo.deleteWithTransaction(POSTING, OWNER);

    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith(POSTING, OWNER);
  });

  it('RPC success:false → BusinessError throw (swallow 제거 — 부분실패 표면화)', async () => {
    mockCancel.mockResolvedValue({ success: false, error: 'unauthorized' });

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
    });
  });

  it('확정 인원(filledPositions>0)이면 취소 RPC 미호출 + BusinessError', async () => {
    mockLoadDelete.mockResolvedValue({ ownerId: OWNER, filledPositions: 2 });

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
    });
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('멱등 취소(idempotent:true)도 정상 완료(throw 없음)', async () => {
    mockCancel.mockResolvedValue({ success: true, idempotent: true });

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).resolves.toBeUndefined();
  });
});
