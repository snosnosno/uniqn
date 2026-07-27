import {
  cancelApplication,
  getApplicationById,
  getApplicationStats,
  getCancellationRequests,
  getMyApplications,
  hasAppliedToJob,
  requestCancellation,
  reviewCancellationRequest,
} from '../applicationService';

const mockGetByApplicantId = jest.fn();
const mockGetById = jest.fn();
const mockCancelWithTransaction = jest.fn();
const mockHasApplied = jest.fn();
const mockGetStatsByApplicantId = jest.fn();
const mockRequestCancellationWithTransaction = jest.fn();
const mockReviewCancellationWithTransaction = jest.fn();
const mockGetCancellationRequests = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    getByApplicantId: (...args: unknown[]) => mockGetByApplicantId(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    cancelWithTransaction: (...args: unknown[]) => mockCancelWithTransaction(...args),
    hasApplied: (...args: unknown[]) => mockHasApplied(...args),
    getStatsByApplicantId: (...args: unknown[]) => mockGetStatsByApplicantId(...args),
    requestCancellationWithTransaction: (...args: unknown[]) =>
      mockRequestCancellationWithTransaction(...args),
    reviewCancellationWithTransaction: (...args: unknown[]) =>
      mockReviewCancellationWithTransaction(...args),
    getCancellationRequests: (...args: unknown[]) => mockGetCancellationRequests(...args),
  },
}));

jest.mock('@/services/boardService', () => ({
  createSubstitutePost: jest.fn().mockResolvedValue('mock-post-id'),
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

describe('applicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyApplications', () => {
    it('returns an empty array when there are no applications', async () => {
      mockGetByApplicantId.mockResolvedValue([]);

      const result = await getMyApplications('user-1');

      expect(result).toEqual([]);
      expect(mockGetByApplicantId).toHaveBeenCalledWith('user-1');
    });

    it('returns applications with job data when available', async () => {
      mockGetByApplicantId.mockResolvedValue([
        {
          id: 'app-1',
          applicantId: 'user-1',
          jobPostingId: 'job-1',
          status: 'applied',
          jobPosting: {
            title: 'Test posting',
            location: 'Seoul',
          },
        },
      ]);

      const result = await getMyApplications('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]?.jobPosting?.title).toBe('Test posting');
    });
  });

  describe('getApplicationById', () => {
    it('returns null when the application is missing', async () => {
      mockGetById.mockResolvedValue(null);

      await expect(getApplicationById('missing')).resolves.toBeNull();
    });
  });

  describe('cancelApplication', () => {
    it('delegates cancellation to the repository', async () => {
      mockCancelWithTransaction.mockResolvedValue(undefined);

      await expect(cancelApplication('job-1_user-1', 'user-1')).resolves.toBeUndefined();
      expect(mockCancelWithTransaction).toHaveBeenCalledWith('job-1_user-1', 'user-1');
    });
  });

  describe('hasAppliedToJob', () => {
    it('returns false when repository access fails', async () => {
      mockHasApplied.mockRejectedValue(new Error('Firestore error'));

      await expect(hasAppliedToJob('job-1', 'user-1')).resolves.toBe(false);
    });
  });

  describe('getApplicationStats', () => {
    it('returns status counts from the repository', async () => {
      mockGetStatsByApplicantId.mockResolvedValue({
        applied: 2,
        confirmed: 1,
        rejected: 0,
        cancelled: 1,
        completed: 0,
        cancellation_pending: 0,
      });

      const result = await getApplicationStats('user-1');

      expect(result.applied).toBe(2);
      expect(result.confirmed).toBe(1);
      expect(result.cancelled).toBe(1);
    });
  });

  describe('requestCancellation', () => {
    it('validates and forwards a safe cancellation request', async () => {
      mockRequestCancellationWithTransaction.mockResolvedValue(undefined);

      await expect(
        requestCancellation(
          { applicationId: 'app-1', reason: 'Need to cancel due to illness' },
          'user-1'
        )
      ).resolves.toEqual({ substitutePost: 'skipped' });

      // W1-10(CANCEL-12): 필드 생략 = 게시하지 않음. 대타 구인 글은 실명 전체공개라
      // 사용자가 명시적으로 켠 경우에만 올린다.
      expect(mockRequestCancellationWithTransaction).toHaveBeenCalledWith(
        {
          applicationId: 'app-1',
          reason: 'Need to cancel due to illness',
          wantsSubstitutePost: false,
        },
        'user-1'
      );
    });

    it('rejects unsafe cancellation input before the repository call', async () => {
      await expect(
        requestCancellation(
          { applicationId: 'app-1', reason: '<script>alert(1)</script>' },
          'user-1'
        )
      ).rejects.toThrow();

      expect(mockRequestCancellationWithTransaction).not.toHaveBeenCalled();
    });
  });

  describe('reviewCancellationRequest', () => {
    it('validates and forwards a rejection review', async () => {
      mockReviewCancellationWithTransaction.mockResolvedValue(undefined);

      await expect(
        reviewCancellationRequest(
          {
            applicationId: 'app-1',
            approved: false,
            rejectionReason: 'Replacement is not available',
          },
          'owner-1'
        )
      ).resolves.toBeUndefined();

      expect(mockReviewCancellationWithTransaction).toHaveBeenCalledWith(
        {
          applicationId: 'app-1',
          approved: false,
          rejectionReason: 'Replacement is not available',
        },
        'owner-1'
      );
    });

    it('rejects invalid review input before the repository call', async () => {
      await expect(
        reviewCancellationRequest(
          {
            applicationId: 'app-1',
            approved: false,
            rejectionReason: 'no',
          },
          'owner-1'
        )
      ).rejects.toThrow();

      expect(mockReviewCancellationWithTransaction).not.toHaveBeenCalled();
    });
  });

  describe('getCancellationRequests', () => {
    it('loads pending cancellation requests for the owner', async () => {
      mockGetCancellationRequests.mockResolvedValue([
        {
          id: 'app-1',
          jobPostingId: 'job-1',
          applicantId: 'staff-1',
          applicantName: 'Applicant',
          status: 'cancellation_pending',
          assignments: [],
        },
      ]);

      const result = await getCancellationRequests('job-1', 'owner-1');

      expect(result).toHaveLength(1);
      expect(mockGetCancellationRequests).toHaveBeenCalledWith('job-1', 'owner-1');
    });
  });
});
