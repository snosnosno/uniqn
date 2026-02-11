/**
 * UNIQN Mobile - Application Service Tests
 *
 * @description 지원 서비스 테스트 (Repository 패턴 기반)
 * @version 2.0.0
 */

import {
  getMyApplications,
  getApplicationById,
  cancelApplication,
  hasAppliedToJob,
  getApplicationStats,
} from '../applicationService';

// ============================================================================
// Mock Repository
// ============================================================================

const mockGetByApplicantId = jest.fn();
const mockGetById = jest.fn();
const mockCancelWithTransaction = jest.fn();
const mockHasApplied = jest.fn();
const mockGetStatsByApplicantId = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    getByApplicantId: (...args: unknown[]) => mockGetByApplicantId(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    cancelWithTransaction: (...args: unknown[]) => mockCancelWithTransaction(...args),
    hasApplied: (...args: unknown[]) => mockHasApplied(...args),
    getStatsByApplicantId: (...args: unknown[]) => mockGetStatsByApplicantId(...args),
  },
}));

// ============================================================================
// Mock Dependencies
// ============================================================================

jest.mock('@/lib/firebase', () => ({
  db: {},
  getFirebaseDb: () => ({}),
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

jest.mock('../analyticsService', () => ({
  trackJobApply: jest.fn(),
  trackEvent: jest.fn(),
}));

jest.mock('../performanceService', () => ({
  startApiTrace: jest.fn(() => ({
    putAttribute: jest.fn(),
    stop: jest.fn(),
  })),
}));

// ============================================================================
// Tests
// ============================================================================

describe('ApplicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyApplications', () => {
    const applicantId = 'user-1';

    it('should return empty array when no applications', async () => {
      mockGetByApplicantId.mockResolvedValue([]);

      const result = await getMyApplications(applicantId);

      expect(result).toEqual([]);
      expect(mockGetByApplicantId).toHaveBeenCalledWith(applicantId);
    });

    it('should return applications with job data', async () => {
      mockGetByApplicantId.mockResolvedValue([
        {
          id: 'app-1',
          applicantId,
          jobPostingId: 'job-1',
          status: 'applied',
          jobPosting: {
            title: '테스트 공고',
            location: '서울',
          },
        },
      ]);

      const result = await getMyApplications(applicantId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('app-1');
      expect(result[0].jobPosting).toBeDefined();
    });

    it('should return applications without job data when job not found', async () => {
      mockGetByApplicantId.mockResolvedValue([
        {
          id: 'app-1',
          applicantId,
          jobPostingId: 'job-1',
          status: 'applied',
          jobPosting: undefined,
        },
      ]);

      const result = await getMyApplications(applicantId);

      expect(result).toHaveLength(1);
      expect(result[0].jobPosting).toBeUndefined();
    });
  });

  describe('getApplicationById', () => {
    it('should return null when application not found', async () => {
      mockGetById.mockResolvedValue(null);

      const result = await getApplicationById('non-existent');

      expect(result).toBeNull();
    });

    it('should return application with job data', async () => {
      mockGetById.mockResolvedValue({
        id: 'app-1',
        applicantId: 'user-1',
        jobPostingId: 'job-1',
        status: 'applied',
        jobPosting: {
          title: '테스트 공고',
        },
      });

      const result = await getApplicationById('app-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('app-1');
      expect(result?.jobPosting?.title).toBe('테스트 공고');
    });
  });

  describe('cancelApplication', () => {
    const applicationId = 'job-1_user-1';
    const applicantId = 'user-1';

    it('should cancel application successfully', async () => {
      mockCancelWithTransaction.mockResolvedValue(undefined);

      await expect(cancelApplication(applicationId, applicantId)).resolves.not.toThrow();

      expect(mockCancelWithTransaction).toHaveBeenCalledWith(applicationId, applicantId);
    });

    it('should throw error when application not found', async () => {
      mockCancelWithTransaction.mockRejectedValue(
        new Error('존재하지 않는 지원입니다')
      );

      await expect(cancelApplication(applicationId, applicantId)).rejects.toThrow();
    });

    it('should throw error when not the applicant', async () => {
      mockCancelWithTransaction.mockRejectedValue(
        new Error('본인의 지원만 취소할 수 있습니다')
      );

      await expect(cancelApplication(applicationId, applicantId)).rejects.toThrow();
    });

    it('should throw error when already cancelled', async () => {
      mockCancelWithTransaction.mockRejectedValue(
        new Error('이미 취소된 지원입니다')
      );

      await expect(cancelApplication(applicationId, applicantId)).rejects.toThrow();
    });

    it('should throw error when confirmed', async () => {
      mockCancelWithTransaction.mockRejectedValue(
        new Error('확정된 지원은 취소할 수 없습니다')
      );

      await expect(cancelApplication(applicationId, applicantId)).rejects.toThrow();
    });
  });

  describe('hasAppliedToJob', () => {
    it('should return false when not applied', async () => {
      mockHasApplied.mockResolvedValue(false);

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return true when applied', async () => {
      mockHasApplied.mockResolvedValue(true);

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when cancelled', async () => {
      mockHasApplied.mockResolvedValue(false);

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockHasApplied.mockRejectedValue(new Error('Firestore error'));

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getApplicationStats', () => {
    const applicantId = 'user-1';

    it('should return zero counts when no applications', async () => {
      mockGetStatsByApplicantId.mockResolvedValue({
        applied: 0,
        pending: 0,
        confirmed: 0,
        rejected: 0,
        cancelled: 0,
        cancellation_requested: 0,
      });

      const result = await getApplicationStats(applicantId);

      expect(result.applied).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.cancelled).toBe(0);
    });

    it('should count applications by status', async () => {
      mockGetStatsByApplicantId.mockResolvedValue({
        applied: 2,
        pending: 0,
        confirmed: 1,
        rejected: 0,
        cancelled: 1,
        cancellation_requested: 0,
      });

      const result = await getApplicationStats(applicantId);

      expect(result.applied).toBe(2);
      expect(result.confirmed).toBe(1);
      expect(result.cancelled).toBe(1);
    });
  });
});
