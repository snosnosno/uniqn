import { requestCancellation, reviewCancellationRequest } from '../applicationService';
import { logger } from '@/utils/logger';
import type { BoardJobSummary } from '@/types/board';

const mockRequestCancellationWithTransaction = jest.fn();
const mockReviewCancellationWithTransaction = jest.fn();
const mockCreateSubstitutePost = jest.fn();
const mockArchiveSubstitutePostByLinkedPosting = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    getByApplicantId: jest.fn(),
    getById: jest.fn(),
    cancelWithTransaction: jest.fn(),
    hasApplied: jest.fn(),
    getStatsByApplicantId: jest.fn(),
    requestCancellationWithTransaction: (...args: unknown[]) =>
      mockRequestCancellationWithTransaction(...args),
    reviewCancellationWithTransaction: (...args: unknown[]) =>
      mockReviewCancellationWithTransaction(...args),
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
  archiveSubstitutePostByLinkedPosting: (...args: unknown[]) =>
    mockArchiveSubstitutePostByLinkedPosting(...args),
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
    // logger.warn이 non-blocking 실패를 기록했는지 확인
    expect(logger.warn).toHaveBeenCalledTimes(1);
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

describe('reviewCancellationRequest archive path', () => {
  const { applicationRepository } = jest.requireMock('@/repositories');

  beforeEach(() => {
    jest.clearAllMocks();
    mockReviewCancellationWithTransaction.mockResolvedValue(undefined);
    mockArchiveSubstitutePostByLinkedPosting.mockResolvedValue(undefined);
    (applicationRepository.getById as jest.Mock).mockResolvedValue({
      jobPostingId: 'job-123',
      applicantId: 'staff-1',
    });
  });

  it('should call archiveSubstitutePostByLinkedPosting with correct ids when approved is false', async () => {
    await reviewCancellationRequest(
      {
        applicationId: 'app-1',
        approved: false,
        rejectionReason: '사유가 불충분합니다.',
      },
      'employer-1'
    );

    expect(mockArchiveSubstitutePostByLinkedPosting).toHaveBeenCalledTimes(1);
    expect(mockArchiveSubstitutePostByLinkedPosting).toHaveBeenCalledWith('job-123', 'staff-1');
  });

  it('should also call archiveSubstitutePostByLinkedPosting when approved is true', async () => {
    await reviewCancellationRequest(
      {
        applicationId: 'app-1',
        approved: true,
      },
      'employer-1'
    );

    expect(mockArchiveSubstitutePostByLinkedPosting).toHaveBeenCalledTimes(1);
    expect(mockArchiveSubstitutePostByLinkedPosting).toHaveBeenCalledWith('job-123', 'staff-1');
  });

  it('should still resolve when archiveSubstitutePostByLinkedPosting throws (best-effort)', async () => {
    mockArchiveSubstitutePostByLinkedPosting.mockRejectedValue(new Error('Archive error'));

    await expect(
      reviewCancellationRequest(
        {
          applicationId: 'app-1',
          approved: true,
        },
        'employer-1'
      )
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
