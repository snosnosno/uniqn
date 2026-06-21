// src/repositories/supabase/__tests__/JobPostingRepository.cancel.test.ts
// deleteWithTransaction이 status='cancelled' 직접 UPDATE를 수행하는지 검증.
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { ERROR_CODES } from '@/errors/AppError';

const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        update: (...a: unknown[]) => {
          mockUpdate(...a);
          return { eq: (...b: unknown[]) => { mockEq(...b); return Promise.resolve({ error: null }); } };
        },
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        rpc: jest.fn(),
        channel: jest.fn(),
      };
    },
    rpc: jest.fn(),
    channel: jest.fn(),
  },
}));

// loadAndVerifyDeleteAccess는 supabase/parse 의존이라 stub
const mockLoadDelete = jest.fn();
jest.mock('../JobPostingRepositoryHelpers', () => ({
  ...jest.requireActual('../JobPostingRepositoryHelpers'),
  loadAndVerifyDeleteAccess: (...args: unknown[]) => mockLoadDelete(...args),
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
  mockFrom.mockClear();
  mockUpdate.mockClear();
  mockEq.mockClear();
  mockLoadDelete.mockReset();
  mockLoadDelete.mockResolvedValue({ ownerId: OWNER, filledPositions: 0 });
});

describe('deleteWithTransaction → 직접 status=cancelled UPDATE', () => {
  const repo = new SupabaseJobPostingRepository();

  it('취소 시 job_postings 테이블에 status=cancelled UPDATE 수행', async () => {
    await repo.deleteWithTransaction(POSTING, OWNER);

    expect(mockFrom).toHaveBeenCalledWith('job_postings');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    );
    expect(mockEq).toHaveBeenCalledWith('id', POSTING);
  });

  it('확정 인원(filledPositions>0)이면 UPDATE 미호출 + BusinessError', async () => {
    mockLoadDelete.mockResolvedValue({ ownerId: OWNER, filledPositions: 2 });

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('정상 취소 시 undefined 반환(void)', async () => {
    await expect(repo.deleteWithTransaction(POSTING, OWNER)).resolves.toBeUndefined();
  });
});
