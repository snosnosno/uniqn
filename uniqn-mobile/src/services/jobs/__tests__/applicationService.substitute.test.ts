import { requestCancellation } from '../applicationService';
import type { BoardJobSummary } from '@/types/board';

const mockRequestCancellationWithTransaction = jest.fn();
const mockCreateSubstitutePost = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    getByApplicantId: jest.fn(),
    getById: jest.fn(),
    cancelWithTransaction: jest.fn(),
    hasApplied: jest.fn(),
    getStatsByApplicantId: jest.fn(),
    requestCancellationWithTransaction: (...args: unknown[]) =>
      mockRequestCancellationWithTransaction(...args),
    reviewCancellationWithTransaction: jest.fn(),
    getCancellationRequests: jest.fn(),
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

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
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

// Mock boardService with a dynamic import mock
jest.mock('@/services/boardService', () => ({
  createSubstitutePost: (...args: unknown[]) => mockCreateSubstitutePost(...args),
}));

function makeJobSummary(overrides: Partial<BoardJobSummary> = {}): BoardJobSummary {
  return {
    jobPostingId: 'job-123',
    title: '강남 홀덤펍 딜러',
    workDate: '2026-04-20',
    locationName: '강남구',
    compensationLabel: '시급 15,000원',
    ...overrides,
  };
}

describe('requestCancellation with substitute post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestCancellationWithTransaction.mockResolvedValue(undefined);
    mockCreateSubstitutePost.mockResolvedValue('sub-post-id');
  });

  it('should call createSubstitutePost when wantsSubstitutePost is true and context provided', async () => {
    const jobSummary = makeJobSummary();
    const applicantContext = {
      name: '홍길동',
      role: 'staff' as const,
      jobSummary,
    };

    await requestCancellation(
      {
        applicationId: 'app-1',
        reason: '갑자기 몸이 아파서 출근이 어렵습니다.',
        wantsSubstitutePost: true,
      },
      'staff-1',
      applicantContext
    );

    expect(mockCreateSubstitutePost).toHaveBeenCalledTimes(1);
    expect(mockCreateSubstitutePost).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: 'staff-1',
        authorName: '홍길동',
        authorRole: 'staff',
        applicationId: 'app-1',
        jobSummary,
        reason: '갑자기 몸이 아파서 출근이 어렵습니다.',
      })
    );
  });

  it('should NOT call createSubstitutePost when wantsSubstitutePost is false', async () => {
    const jobSummary = makeJobSummary();
    const applicantContext = {
      name: '홍길동',
      role: 'staff' as const,
      jobSummary,
    };

    await requestCancellation(
      { applicationId: 'app-1', reason: '개인 사정으로 취소합니다.', wantsSubstitutePost: false },
      'staff-1',
      applicantContext
    );

    expect(mockCreateSubstitutePost).not.toHaveBeenCalled();
  });

  it('should NOT call createSubstitutePost when applicantContext is not provided', async () => {
    await requestCancellation(
      { applicationId: 'app-1', reason: '개인 사정으로 취소합니다.', wantsSubstitutePost: true },
      'staff-1'
    );

    expect(mockCreateSubstitutePost).not.toHaveBeenCalled();
  });

  it('should still succeed when substitute post creation fails (best-effort)', async () => {
    mockCreateSubstitutePost.mockRejectedValue(new Error('Board service error'));
    const jobSummary = makeJobSummary();
    const applicantContext = {
      name: '홍길동',
      role: 'staff' as const,
      jobSummary,
    };

    await expect(
      requestCancellation(
        {
          applicationId: 'app-1',
          reason: '갑자기 몸이 아파서 출근이 어렵습니다.',
          wantsSubstitutePost: true,
        },
        'staff-1',
        applicantContext
      )
    ).resolves.toBeUndefined();

    // Cancellation still succeeded despite substitute post failure
    expect(mockRequestCancellationWithTransaction).toHaveBeenCalledTimes(1);
  });

  it('should call cancellation transaction even when wantsSubstitutePost is true', async () => {
    const jobSummary = makeJobSummary();
    const applicantContext = {
      name: '홍길동',
      role: 'staff' as const,
      jobSummary,
    };

    await requestCancellation(
      {
        applicationId: 'app-2',
        reason: '개인 사정이 생겨서 취소합니다.',
        wantsSubstitutePost: true,
      },
      'staff-2',
      applicantContext
    );

    expect(mockRequestCancellationWithTransaction).toHaveBeenCalledTimes(1);
  });
});
