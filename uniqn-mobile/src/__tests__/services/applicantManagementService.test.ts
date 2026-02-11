/**
 * UNIQN Mobile - Applicant Management Service Tests
 *
 * @description Unit tests for applicant management service (employer)
 * @version 2.0.0 - Repository 패턴 기반
 */

import { createMockApplication, resetCounters } from '../mocks/factories';

// ============================================================================
// Mock Repository
// ============================================================================

const mockFindByJobPostingWithStats = jest.fn();
const mockGetById = jest.fn();
const mockRejectWithTransaction = jest.fn();
const mockMarkAsRead = jest.fn();
const mockVerifyOwnership = jest.fn();
const mockSubscribeByJobPosting = jest.fn();

jest.mock('@/repositories', () => ({
  applicationRepository: {
    findByJobPostingWithStats: (...args: unknown[]) => mockFindByJobPostingWithStats(...args),
    getById: (...args: unknown[]) => mockGetById(...args),
    rejectWithTransaction: (...args: unknown[]) => mockRejectWithTransaction(...args),
    markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
    subscribeByJobPosting: (...args: unknown[]) => mockSubscribeByJobPosting(...args),
  },
  jobPostingRepository: {
    verifyOwnership: (...args: unknown[]) => mockVerifyOwnership(...args),
  },
}));

// ============================================================================
// Mock confirmApplicationWithHistory
// ============================================================================

const mockConfirmApplicationWithHistory = jest.fn();

jest.mock('@/services/applicationHistoryService', () => ({
  confirmApplicationWithHistory: (...args: unknown[]) =>
    mockConfirmApplicationWithHistory(...args),
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

jest.mock('@/errors', () => {
  class BusinessError extends Error {
    public userMessage: string;
    public code: string;
    public category = 'business';
    public severity = 'medium';
    public isRetryable = false;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'BusinessError';
      this.code = code;
      this.userMessage = message;
    }
  }
  class PermissionError extends Error {
    public userMessage: string;
    public code: string;
    public category = 'permission';
    public severity = 'medium';
    public isRetryable = false;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'PermissionError';
      this.code = code;
      this.userMessage = message;
    }
  }
  class ValidationError extends Error {
    public userMessage: string;
    public code: string;
    public category = 'validation';
    public severity = 'low';
    public isRetryable = false;
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'ValidationError';
      this.code = code;
      this.userMessage = message;
    }
  }
  class MaxCapacityReachedError extends Error {
    public userMessage: string;
    public jobPostingId: string;
    public maxCapacity: number;
    public currentCount: number;
    public category = 'business';
    public severity = 'medium';
    public isRetryable = false;
    constructor(params: {
      userMessage: string;
      jobPostingId: string;
      maxCapacity: number;
      currentCount: number;
    }) {
      super(params.userMessage);
      this.name = 'MaxCapacityReachedError';
      this.userMessage = params.userMessage;
      this.jobPostingId = params.jobPostingId;
      this.maxCapacity = params.maxCapacity;
      this.currentCount = params.currentCount;
    }
  }

  return {
    mapFirebaseError: (error: Error) => error,
    isAppError: (error: unknown) =>
      error instanceof BusinessError ||
      error instanceof PermissionError ||
      error instanceof ValidationError ||
      error instanceof MaxCapacityReachedError,
    ERROR_CODES: {
      FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
      FIREBASE_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6042',
    },
    BusinessError,
    PermissionError,
    ValidationError,
    MaxCapacityReachedError,
  };
});

jest.mock('@/constants/statusConfig', () => ({
  STATUS_TO_STATS_KEY: {
    applied: 'applied',
    pending: 'pending',
    confirmed: 'confirmed',
    rejected: 'rejected',
    cancelled: 'cancelled',
    completed: 'completed',
    cancellation_pending: 'cancellationPending',
  },
}));

// Import after mocks
import {
  getApplicantsByJobPosting,
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  markApplicationAsRead,
  getApplicantStatsByRole,
} from '@/services/applicantManagementService';

// ============================================================================
// Test Utilities
// ============================================================================

function createMockApplicationWithDetails(overrides: Record<string, unknown> = {}) {
  const baseApplication = createMockApplication();
  const defaultAssignments = [
    { dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] },
  ];
  return {
    ...baseApplication,
    id: baseApplication.id,
    jobPostingId: 'job-1',
    applicantId: 'staff-1',
    applicantName: '홍길동',
    applicantEmail: 'hong@example.com',
    assignments: defaultAssignments,
    status: 'applied' as const,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('applicantManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
  });

  // ==========================================================================
  // getApplicantsByJobPosting
  // ==========================================================================

  describe('getApplicantsByJobPosting', () => {
    it('should return applicants list with stats', async () => {
      const applicant1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });
      const applicant2 = createMockApplicationWithDetails({
        id: 'app-2',
        status: 'confirmed',
      });

      mockFindByJobPostingWithStats.mockResolvedValue({
        applications: [applicant1, applicant2],
        stats: {
          total: 2,
          applied: 1,
          pending: 0,
          confirmed: 1,
          rejected: 0,
          cancelled: 0,
          completed: 0,
          cancellationPending: 0,
        },
      });

      const result = await getApplicantsByJobPosting('job-1', 'employer-1');

      expect(result.applicants).toHaveLength(2);
      expect(result.stats.total).toBe(2);
      expect(result.stats.applied).toBe(1);
      expect(result.stats.confirmed).toBe(1);
      expect(mockFindByJobPostingWithStats).toHaveBeenCalledWith('job-1', 'employer-1', undefined);
    });

    it('should throw error for non-existent job posting', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockFindByJobPostingWithStats.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        })
      );

      await expect(getApplicantsByJobPosting('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockFindByJobPostingWithStats.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 조회할 수 있습니다',
        })
      );

      await expect(getApplicantsByJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '본인의 공고만 조회할 수 있습니다'
      );
    });

    it('should filter by status', async () => {
      const applicant1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockFindByJobPostingWithStats.mockResolvedValue({
        applications: [applicant1],
        stats: {
          total: 1,
          applied: 1,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          cancelled: 0,
          completed: 0,
          cancellationPending: 0,
        },
      });

      const result = await getApplicantsByJobPosting('job-1', 'employer-1', 'applied');

      expect(result.applicants).toHaveLength(1);
      expect(result.applicants[0].status).toBe('applied');
      expect(mockFindByJobPostingWithStats).toHaveBeenCalledWith('job-1', 'employer-1', 'applied');
    });
  });

  // ==========================================================================
  // confirmApplication
  // ==========================================================================

  describe('confirmApplication', () => {
    it('should confirm an application and create work log', async () => {
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
        assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] }],
      });

      mockGetById.mockResolvedValue(application);

      mockConfirmApplicationWithHistory.mockResolvedValue({
        applicationId: 'app-1',
        workLogIds: ['worklog-new'],
        message: '지원이 확정되었습니다',
      });

      const result = await confirmApplication({ applicationId: 'app-1' }, 'employer-1');

      expect(result.applicationId).toBe('app-1');
      expect(result.workLogId).toBeDefined();
      expect(result.message).toContain('확정');
    });

    it('should throw error for already confirmed application', async () => {
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'confirmed',
      });

      mockGetById.mockResolvedValue(application);

      const { ValidationError, ERROR_CODES } = jest.requireMock('@/errors');
      mockConfirmApplicationWithHistory.mockRejectedValue(
        new ValidationError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 확정된 지원입니다',
        })
      );

      await expect(confirmApplication({ applicationId: 'app-1' }, 'employer-1')).rejects.toThrow(
        '이미 확정된 지원입니다'
      );
    });

    it('should throw MaxCapacityReachedError when positions are full', async () => {
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockGetById.mockResolvedValue(application);

      const { MaxCapacityReachedError } = jest.requireMock('@/errors');
      mockConfirmApplicationWithHistory.mockRejectedValue(
        new MaxCapacityReachedError({
          userMessage: '모집 인원이 마감되었습니다',
          jobPostingId: 'job-1',
          maxCapacity: 5,
          currentCount: 5,
        })
      );

      await expect(confirmApplication({ applicationId: 'app-1' }, 'employer-1')).rejects.toThrow(
        '모집 인원이 마감되었습니다'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockGetById.mockResolvedValue(application);

      const { ValidationError } = jest.requireMock('@/errors');
      mockConfirmApplicationWithHistory.mockRejectedValue(
        new ValidationError('E5001', {
          userMessage: '본인의 공고만 관리할 수 있습니다',
        })
      );

      await expect(confirmApplication({ applicationId: 'app-1' }, 'employer-1')).rejects.toThrow(
        '본인의 공고만 관리할 수 있습니다'
      );
    });
  });

  // ==========================================================================
  // rejectApplication
  // ==========================================================================

  describe('rejectApplication', () => {
    it('should reject an application', async () => {
      mockRejectWithTransaction.mockResolvedValue(undefined);

      await expect(
        rejectApplication({ applicationId: 'app-1', reason: '부적합' }, 'employer-1')
      ).resolves.not.toThrow();

      expect(mockRejectWithTransaction).toHaveBeenCalledWith(
        { applicationId: 'app-1', reason: '부적합' },
        'employer-1'
      );
    });

    it('should throw error for already confirmed application', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockRejectWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 확정된 지원은 거절할 수 없습니다',
        })
      );

      await expect(rejectApplication({ applicationId: 'app-1' }, 'employer-1')).rejects.toThrow(
        '이미 확정된 지원은 거절할 수 없습니다'
      );
    });

    it('should throw error for already rejected application', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockRejectWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 거절된 지원입니다',
        })
      );

      await expect(rejectApplication({ applicationId: 'app-1' }, 'employer-1')).rejects.toThrow(
        '이미 거절된 지원입니다'
      );
    });
  });

  // ==========================================================================
  // bulkConfirmApplications
  // ==========================================================================

  describe('bulkConfirmApplications', () => {
    it('should confirm multiple applications', async () => {
      const application1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });
      const application2 = createMockApplicationWithDetails({
        id: 'app-2',
        status: 'applied',
      });

      mockGetById
        .mockResolvedValueOnce(application1)
        .mockResolvedValueOnce(application2);

      mockConfirmApplicationWithHistory
        .mockResolvedValueOnce({
          applicationId: 'app-1',
          workLogIds: ['worklog-1'],
          message: '지원이 확정되었습니다',
        })
        .mockResolvedValueOnce({
          applicationId: 'app-2',
          workLogIds: ['worklog-2'],
          message: '지원이 확정되었습니다',
        });

      const result = await bulkConfirmApplications(['app-1', 'app-2'], 'employer-1');

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.workLogIds).toHaveLength(2);
    });

    it('should handle partial failures', async () => {
      const application1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });
      const application2 = createMockApplicationWithDetails({
        id: 'app-2',
        status: 'confirmed',
      });

      mockGetById
        .mockResolvedValueOnce(application1)
        .mockResolvedValueOnce(application2);

      const { ValidationError } = jest.requireMock('@/errors');

      mockConfirmApplicationWithHistory
        .mockResolvedValueOnce({
          applicationId: 'app-1',
          workLogIds: ['worklog-1'],
          message: '지원이 확정되었습니다',
        })
        .mockRejectedValueOnce(
          new ValidationError('E6042', {
            userMessage: '이미 확정된 지원입니다',
          })
        );

      const result = await bulkConfirmApplications(['app-1', 'app-2'], 'employer-1');

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failedIds).toContain('app-2');
    });
  });

  // ==========================================================================
  // markApplicationAsRead
  // ==========================================================================

  describe('markApplicationAsRead', () => {
    it('should mark an application as read', async () => {
      mockMarkAsRead.mockResolvedValue(undefined);

      await expect(markApplicationAsRead('app-1', 'employer-1')).resolves.not.toThrow();

      expect(mockMarkAsRead).toHaveBeenCalledWith('app-1', 'employer-1');
    });

    it('should throw error for non-existent application', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockMarkAsRead.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 지원입니다',
        })
      );

      await expect(markApplicationAsRead('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 지원입니다'
      );
    });
  });

  // ==========================================================================
  // getApplicantStatsByRole
  // ==========================================================================

  describe('getApplicantStatsByRole', () => {
    it('should return stats grouped by role', async () => {
      const applicant1 = createMockApplicationWithDetails({
        id: 'app-1',
        assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] }],
        status: 'confirmed',
      });
      const applicant2 = createMockApplicationWithDetails({
        id: 'app-2',
        assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['dealer'] }],
        status: 'applied',
      });
      const applicant3 = createMockApplicationWithDetails({
        id: 'app-3',
        assignments: [{ dates: ['2024-01-15'], timeSlot: '14:00~22:00', roleIds: ['manager'] }],
        status: 'applied',
      });

      mockFindByJobPostingWithStats.mockResolvedValue({
        applications: [applicant1, applicant2, applicant3],
        stats: {
          total: 3,
          applied: 2,
          pending: 0,
          confirmed: 1,
          rejected: 0,
          cancelled: 0,
          completed: 0,
          cancellationPending: 0,
        },
      });

      const result = await getApplicantStatsByRole('job-1', 'employer-1');

      expect(result.dealer).toBeDefined();
      expect(result.dealer.total).toBe(2);
      expect(result.dealer.confirmed).toBe(1);
      expect(result.dealer.applied).toBe(1);

      expect(result.manager).toBeDefined();
      expect(result.manager.total).toBe(1);
      expect(result.manager.applied).toBe(1);
    });
  });
});
