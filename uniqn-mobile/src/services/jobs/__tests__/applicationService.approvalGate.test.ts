/**
 * UNIQN Mobile - 지원 서비스 대회 승인 게이트 테스트
 *
 * @description applyToJobV2 가 미승인 대회 공고 지원을 BusinessError 로 차단하는지 검증
 *   (P0#4 승인 게이트 우회 — 지원 경로가 핵심 방어선)
 */

import { applyToJobV2 } from '../applicationService';
import { ERROR_CODES, isBusinessError } from '@/errors';
import type { CreateApplicationInput } from '@/types';

const mockApplyWithTransaction = jest.fn();
const mockGetById = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    applyWithTransaction: (...args: unknown[]) => mockApplyWithTransaction(...args),
  },
  jobPostingRepository: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    appError: jest.fn(),
  },
}));

// AppError 체인 보존 — 실제 handleServiceError 와 동일하게 BusinessError 를 그대로 통과시킨다.
jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
  handleErrorWithDefault: jest.fn((_error: unknown, defaultValue: unknown) => defaultValue),
}));

jest.mock('@/services/observability', () => ({
  trackJobApply: jest.fn(),
  trackEvent: jest.fn(),
  startApiTrace: jest.fn(() => ({
    putAttribute: jest.fn(),
    stop: jest.fn(),
  })),
}));

function makeInput(jobPostingId = 'job-1'): CreateApplicationInput {
  return {
    jobPostingId,
    assignments: [],
    provisionConsentAt: '2026-07-11T00:00:00.000Z',
    provisionConsentVersion: 'v1-2026-05-13',
  };
}

const APPLICANT = ['user-1', '지원자'] as const;

describe('applyToJobV2 — 대회 승인 게이트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplyWithTransaction.mockResolvedValue({
      id: 'app-1',
      jobPostingTitle: '테스트 공고',
      assignments: [],
    });
  });

  it('미승인(pending) 대회 공고 지원은 BusinessError 로 차단되고 트랜잭션은 실행되지 않는다', async () => {
    mockGetById.mockResolvedValue({
      id: 'job-1',
      postingType: 'tournament',
      tournamentConfig: { approvalStatus: 'pending' },
    });

    await expect(applyToJobV2(makeInput(), ...APPLICANT)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_TOURNAMENT_NOT_APPROVED,
    });
    expect(mockApplyWithTransaction).not.toHaveBeenCalled();
  });

  it('차단 에러는 한글 안내 메시지를 가진 BusinessError 다', async () => {
    mockGetById.mockResolvedValue({
      id: 'job-1',
      postingType: 'tournament',
      tournamentConfig: { approvalStatus: 'pending' },
    });

    expect.assertions(2);
    try {
      await applyToJobV2(makeInput(), ...APPLICANT);
    } catch (error) {
      expect(isBusinessError(error)).toBe(true);
      expect((error as { userMessage: string }).userMessage).toBe(
        '승인 대기 중인 대회 공고에는 지원할 수 없습니다.'
      );
    }
  });

  it('거절(rejected) 대회 공고 지원은 차단된다', async () => {
    mockGetById.mockResolvedValue({
      id: 'job-1',
      postingType: 'tournament',
      tournamentConfig: { approvalStatus: 'rejected' },
    });

    await expect(applyToJobV2(makeInput(), ...APPLICANT)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_TOURNAMENT_NOT_APPROVED,
    });
    expect(mockApplyWithTransaction).not.toHaveBeenCalled();
  });

  it('approvalStatus 누락 대회 공고 지원은 fail-closed 로 차단된다', async () => {
    mockGetById.mockResolvedValue({
      id: 'job-1',
      postingType: 'tournament',
      tournamentConfig: {},
    });

    await expect(applyToJobV2(makeInput(), ...APPLICANT)).rejects.toMatchObject({
      code: ERROR_CODES.BUSINESS_TOURNAMENT_NOT_APPROVED,
    });
    expect(mockApplyWithTransaction).not.toHaveBeenCalled();
  });

  it('승인(approved) 대회 공고 지원은 통과해 트랜잭션이 실행된다', async () => {
    mockGetById.mockResolvedValue({
      id: 'job-1',
      postingType: 'tournament',
      tournamentConfig: { approvalStatus: 'approved' },
    });

    const result = await applyToJobV2(makeInput(), ...APPLICANT);

    expect(result.id).toBe('app-1');
    expect(mockApplyWithTransaction).toHaveBeenCalledTimes(1);
  });

  it('일반(regular) 공고 지원은 승인 게이트와 무관하게 통과한다', async () => {
    mockGetById.mockResolvedValue({
      id: 'job-1',
      postingType: 'regular',
    });

    const result = await applyToJobV2(makeInput(), ...APPLICANT);

    expect(result.id).toBe('app-1');
    expect(mockApplyWithTransaction).toHaveBeenCalledTimes(1);
  });

  it('공고를 찾지 못하면 게이트는 크래시하지 않고 트랜잭션 not-found 경로로 위임한다', async () => {
    mockGetById.mockResolvedValue(null);

    const result = await applyToJobV2(makeInput(), ...APPLICANT);

    expect(result.id).toBe('app-1');
    expect(mockApplyWithTransaction).toHaveBeenCalledTimes(1);
  });
});
