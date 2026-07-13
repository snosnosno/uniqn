// src/repositories/supabase/__tests__/JobPostingRepository.userMessage.i18n.test.ts
// P1#12: 마감/재오픈/삭제/수정 경로 BusinessError userMessage 가 한글로 노출되는지 잠금.
// 회귀 방지 — 영문 문구가 다시 유입되면 실패한다.
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
          return {
            eq: (...b: unknown[]) => {
              mockEq(...b);
              return Promise.resolve({ error: null });
            },
          };
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

// load*Access 는 supabase/parse 의존이라 stub 로 상태만 주입한다.
const mockLoadMutate = jest.fn();
const mockLoadDelete = jest.fn();
jest.mock('../JobPostingRepositoryHelpers', () => ({
  ...jest.requireActual('../JobPostingRepositoryHelpers'),
  loadAndVerifyMutateAccess: (...args: unknown[]) => mockLoadMutate(...args),
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
  mockLoadMutate.mockReset();
  mockLoadDelete.mockReset();
});

describe('JobPosting BusinessError userMessage 한글화 (P1#12)', () => {
  const repo = new SupabaseJobPostingRepository();

  it('마감: 이미 마감된 공고면 한글 userMessage', async () => {
    mockLoadMutate.mockResolvedValue({ ownerId: OWNER, status: 'closed' });

    await expect(repo.closeWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '이미 마감된 공고입니다.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('재오픈: 이미 진행 중인 공고면 한글 userMessage', async () => {
    mockLoadMutate.mockResolvedValue({ ownerId: OWNER, status: 'active' });

    await expect(repo.reopenWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '이미 진행 중인 공고입니다.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('재오픈: 취소된 공고는 재오픈 불가 한글 userMessage', async () => {
    mockLoadMutate.mockResolvedValue({ ownerId: OWNER, status: 'cancelled' });

    await expect(repo.reopenWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '취소된 공고는 재오픈할 수 없습니다. 새 공고를 작성해 주세요.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('삭제: 확정 인원이 있으면 한글 userMessage', async () => {
    mockLoadDelete.mockResolvedValue({ ownerId: OWNER, filledPositions: 2 });

    await expect(repo.deleteWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '확정된 지원자가 있는 공고는 삭제할 수 없습니다. 대신 마감해 주세요.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('수정: 확정 인원이 있는데 일정/역할 변경 시 한글 userMessage', async () => {
    mockLoadMutate.mockResolvedValue({
      ownerId: OWNER,
      filledPositions: 1,
      roleCatalog: [],
    });

    await expect(
      repo.updateWithTransaction(
        POSTING,
        // 일정 변경을 시도해 확정 후 변경 차단 분기를 트리거한다.
        { schedule: {} } as never,
        OWNER
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '확정된 지원자가 있어 일정이나 역할을 변경할 수 없습니다.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
