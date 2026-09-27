// src/repositories/supabase/__tests__/JobPostingRepository.fixedExpiry.test.ts
/**
 * 고정 공고 게시 기간 — 재오픈·연장은 서버 RPC `renew_fixed_posting` 으로 만료를 다시 잡는다.
 *
 * 상태만 active 로 돌리면(옛 방식) BEFORE UPDATE 트리거 tr_fixed_posting_expired 가 옛 expiresAt 을
 * 보고 같은 UPDATE 에서 곧바로 closed 로 되돌린다. 앱이 기기 시각으로 계산해도 시계가 느리면 같다.
 * 그리고 RPC 결과가 비거나(권한 없음) 게시 상태가 아니면(트리거가 닫음) 성공으로 넘기지 않는다.
 */
import { SupabaseJobPostingRepository } from '../JobPostingRepository';
import { ERROR_CODES } from '@/errors/AppError';

const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (...a: unknown[]) => {
        mockUpdate(...a);
        return {
          eq: (...b: unknown[]) => {
            mockEq(...b);
            return Promise.resolve({ error: null });
          },
        };
      },
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: jest.fn(),
  },
}));

const mockLoadMutate = jest.fn();
jest.mock('../JobPostingRepositoryHelpers', () => ({
  ...jest.requireActual('../JobPostingRepositoryHelpers'),
  loadAndVerifyMutateAccess: (...args: unknown[]) => mockLoadMutate(...args),
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

const fixedPosting = (status: string) => ({
  ownerId: OWNER,
  status,
  schedule: { kind: 'fixed' },
  totalPositions: 2,
  filledPositions: 0,
});

const rpcReturns = (rows: unknown[]) => mockRpc.mockResolvedValue({ data: rows, error: null });

beforeEach(() => {
  mockUpdate.mockClear();
  mockEq.mockClear();
  mockRpc.mockReset();
  mockLoadMutate.mockReset();
});

describe('고정 공고 게시 기간 — 재오픈·연장은 서버 RPC', () => {
  const repo = new SupabaseJobPostingRepository();

  it('재오픈: 고정 공고는 테이블을 직접 고치지 않고 RPC(p_reopen=true)로 다시 연다', async () => {
    mockLoadMutate.mockResolvedValue(fixedPosting('closed'));
    rpcReturns([{ result_status: 'active', result_expires_at: '2026-10-04T05:00:00.000Z' }]);

    await repo.reopenWithTransaction(POSTING, OWNER);

    expect(mockRpc).toHaveBeenCalledWith('renew_fixed_posting', {
      p_job_posting_id: POSTING,
      p_reopen: true,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('재오픈: 고정 공고가 아니면 종전대로 상태만 UPDATE 한다(RPC 없음)', async () => {
    mockLoadMutate.mockResolvedValue({
      ownerId: OWNER,
      status: 'closed',
      schedule: { kind: 'dated' },
    });

    await repo.reopenWithTransaction(POSTING, OWNER);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ status: 'active' });
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('fixed_config');
  });

  it('재오픈: RPC 뒤 공고가 닫힌 채면 성공으로 넘기지 않는다', async () => {
    mockLoadMutate.mockResolvedValue(fixedPosting('closed'));
    rpcReturns([{ result_status: 'closed', result_expires_at: '2026-09-01T00:00:00.000Z' }]);

    await expect(repo.reopenWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '공고가 게시 상태로 남지 않았어요. 새로고침 후 다시 시도해 주세요.',
    });
  });

  it.each(['active', 'capacity_full'])(
    '연장: %s 고정 공고는 RPC(p_reopen=false)',
    async (status) => {
      mockLoadMutate.mockResolvedValue(fixedPosting(status));
      rpcReturns([{ result_status: status, result_expires_at: '2026-10-04T05:00:00.000Z' }]);

      await repo.extendFixedPostingWithTransaction(POSTING, OWNER);

      expect(mockRpc).toHaveBeenCalledWith('renew_fixed_posting', {
        p_job_posting_id: POSTING,
        p_reopen: false,
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    }
  );

  it('연장: RPC 가 0행이면(권한 없음·대상 아님) 실패로 알린다', async () => {
    mockLoadMutate.mockResolvedValue(fixedPosting('active'));
    rpcReturns([]);

    await expect(repo.extendFixedPostingWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '공고 게시 기간을 바꾸지 못했어요. 공고 상태를 확인하고 다시 시도해 주세요.',
    });
  });

  it('연장: 고정 공고가 아니면 한글 userMessage 로 거절(RPC 없음)', async () => {
    mockLoadMutate.mockResolvedValue({
      ownerId: OWNER,
      status: 'active',
      schedule: { kind: 'dated' },
    });

    await expect(repo.extendFixedPostingWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '고정 공고만 게시 기간을 연장할 수 있어요.',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('연장: 마감된 공고는 재오픈으로 안내하고 RPC 를 부르지 않는다', async () => {
    mockLoadMutate.mockResolvedValue(fixedPosting('closed'));

    await expect(repo.extendFixedPostingWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '마감된 공고는 재오픈하면 7일 동안 다시 게시돼요.',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
