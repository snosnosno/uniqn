// src/repositories/supabase/__tests__/JobPostingRepository.fixedExpiry.test.ts
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
const mockLoadRoleKeys = jest.fn();
jest.mock('../JobPostingRepositoryHelpers', () => ({
  ...jest.requireActual('../JobPostingRepositoryHelpers'),
  loadAndVerifyMutateAccess: (...args: unknown[]) => mockLoadMutate(...args),
  loadAndVerifyDeleteAccess: (...args: unknown[]) => mockLoadDelete(...args),
  loadActiveWorkLogRoleKeys: (...args: unknown[]) => mockLoadRoleKeys(...args),
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
  mockLoadRoleKeys.mockReset();
  mockLoadRoleKeys.mockResolvedValue(new Set<string>());
});

/**
 * 고정 공고 게시 기간 — 재오픈·연장은 만료 시각을 "지금부터 7일"로 다시 잡아야 한다.
 * 상태만 active 로 돌리면 만료 크론(매시 11분)이 과거 expiresAt 을 보고 1시간 안에 다시 닫는다.
 */
const NOW = new Date('2026-09-27T05:00:00.000Z');
const SEVEN_DAYS_LATER = '2026-10-04T05:00:00.000Z';

const fixedPosting = (status: string) => ({
  ownerId: OWNER,
  status,
  schedule: { kind: 'fixed' },
  totalPositions: 2,
  filledPositions: 0,
  fixedConfig: {
    durationDays: 7,
    createdAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-09-08T00:00:00.000Z',
  },
});

describe('고정 공고 게시 기간 — 재오픈·연장', () => {
  const repo = new SupabaseJobPostingRepository();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('재오픈: 고정 공고는 상태와 함께 만료 시각을 지금부터 7일로 다시 잡는다', async () => {
    mockLoadMutate.mockResolvedValue(fixedPosting('closed'));

    await repo.reopenWithTransaction(POSTING, OWNER);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0];
    expect(payload.status).toBe('active');
    expect(payload.fixed_config).toEqual({
      durationDays: 7,
      createdAt: '2026-09-01T00:00:00.000Z',
      expiresAt: SEVEN_DAYS_LATER,
    });
  });

  it('재오픈: 고정 공고가 아니면 fixed_config 를 건드리지 않는다', async () => {
    mockLoadMutate.mockResolvedValue({
      ownerId: OWNER,
      status: 'closed',
      schedule: { kind: 'dated' },
    });

    await repo.reopenWithTransaction(POSTING, OWNER);

    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('fixed_config');
  });

  it.each(['active', 'capacity_full'])(
    '연장: %s 고정 공고는 만료만 7일 뒤로(상태 불변)',
    async (status) => {
      mockLoadMutate.mockResolvedValue(fixedPosting(status));

      await repo.extendFixedPostingWithTransaction(POSTING, OWNER);

      const payload = mockUpdate.mock.calls[0][0];
      expect(payload).not.toHaveProperty('status');
      expect(payload.fixed_config.expiresAt).toBe(SEVEN_DAYS_LATER);
      expect(mockEq).toHaveBeenCalledWith('id', POSTING);
    }
  );

  it('연장: 고정 공고가 아니면 한글 userMessage 로 거절', async () => {
    mockLoadMutate.mockResolvedValue({
      ownerId: OWNER,
      status: 'active',
      schedule: { kind: 'dated' },
    });

    await expect(repo.extendFixedPostingWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '고정 공고만 게시 기간을 연장할 수 있어요.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('연장: 마감된 공고는 재오픈으로 안내하고 쓰지 않는다', async () => {
    mockLoadMutate.mockResolvedValue(fixedPosting('closed'));

    await expect(repo.extendFixedPostingWithTransaction(POSTING, OWNER)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_INVALID_STATE,
      userMessage: '마감된 공고는 재오픈하면 7일 동안 다시 게시돼요.',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
