/**
 * UNIQN Mobile - ApplicationRepository 테스트
 *
 * @description Firebase Application Repository 단위 테스트
 */

import { getDoc, getDocs, runTransaction, query } from 'firebase/firestore';
import { FirebaseApplicationRepository } from '../ApplicationRepository';

// ============================================================================
// Mocks
// ============================================================================

// parseApplicationDocument / parseJobPostingDocument mock
jest.mock('@/schemas', () => ({
  parseApplicationDocument: jest.fn((data: Record<string, unknown>) => {
    if (!data || !data.id) return null;
    return data;
  }),
  parseJobPostingDocument: jest.fn((data: Record<string, unknown>) => {
    if (!data || !data.id) return null;
    return data;
  }),
  parseJobPostingDocuments: jest.fn((docs: Record<string, unknown>[]) => docs),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/utils/job-posting/dateUtils', () => ({
  getClosingStatus: jest.fn(() => ({ total: 10, filled: 2 })),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error('서비스 에러');
  }),
}));

jest.mock('@/errors', () => {
  class AppError extends Error {
    code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage || code);
      this.code = code;
      this.name = 'AppError';
    }
  }
  class AlreadyAppliedError extends AppError {
    constructor(options?: Record<string, unknown>) {
      super('E6001', { userMessage: (options?.userMessage as string) || '이미 지원함' });
      this.name = 'AlreadyAppliedError';
    }
  }
  class ApplicationClosedError extends AppError {
    constructor(options?: Record<string, unknown>) {
      super('E6002', { userMessage: (options?.userMessage as string) || '공고 마감' });
      this.name = 'ApplicationClosedError';
    }
  }
  class MaxCapacityReachedError extends AppError {
    constructor(options?: Record<string, unknown>) {
      super('E6003', { userMessage: (options?.userMessage as string) || '정원 초과' });
      this.name = 'MaxCapacityReachedError';
    }
  }
  class ValidationError extends AppError {
    constructor(code: string, options?: { userMessage?: string }) {
      super(code, options);
      this.name = 'ValidationError';
    }
  }
  class BusinessError extends AppError {
    constructor(code: string, options?: { userMessage?: string }) {
      super(code, options);
      this.name = 'BusinessError';
    }
  }
  class PermissionError extends AppError {
    constructor(code: string, options?: { userMessage?: string }) {
      super(code, options);
      this.name = 'PermissionError';
    }
  }

  return {
    AppError,
    AlreadyAppliedError,
    ApplicationClosedError,
    MaxCapacityReachedError,
    ValidationError,
    BusinessError,
    PermissionError,
    ERROR_CODES: {
      VALIDATION_SCHEMA: 'E3003',
      VALIDATION_REQUIRED: 'E3001',
      FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
      FIREBASE_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6010',
      BUSINESS_ALREADY_CANCELLED: 'E6011',
      BUSINESS_CANNOT_CANCEL_CONFIRMED: 'E6012',
      BUSINESS_ALREADY_REQUESTED: 'E6013',
      BUSINESS_PREVIOUSLY_REJECTED: 'E6014',
    },
    toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
    isAppError: (e: unknown) => e instanceof AppError,
    isPermissionError: (e: unknown) => e instanceof PermissionError,
    isAuthError: () => false,
    AuthError: AppError,
  };
});

jest.mock('@/types', () => ({
  isValidAssignment: jest.fn(() => true),
  validateRequiredAnswers: jest.fn(() => true),
}));

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

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    APPLICATIONS: 'applications',
    JOB_POSTINGS: 'jobPostings',
    WORK_LOGS: 'workLogs',
  },
  FIELDS: {
    APPLICATION: {
      jobPostingId: 'jobPostingId',
      applicantId: 'applicantId',
      status: 'status',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    JOB_POSTING: {
      ownerId: 'ownerId',
      status: 'status',
      createdAt: 'createdAt',
    },
    WORK_LOG: {
      staffId: 'staffId',
      jobPostingId: 'jobPostingId',
      date: 'date',
      status: 'status',
    },
  },
  STATUS: {
    APPLICATION: {
      APPLIED: 'applied',
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      COMPLETED: 'completed',
      CANCELLATION_PENDING: 'cancellation_pending',
    },
    JOB_POSTING: {
      ACTIVE: 'active',
      CLOSED: 'closed',
      CANCELLED: 'cancelled',
    },
    WORK_LOG: {
      SCHEDULED: 'scheduled',
      CHECKED_IN: 'checked_in',
    },
    PAYROLL: {
      PENDING: 'pending',
    },
    CANCELLATION_REQUEST: {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
    },
  },
}));

// Mock JobPostingRepository dependency
jest.mock('../JobPostingRepository', () => ({
  FirebaseJobPostingRepository: jest.fn().mockImplementation(() => ({
    getByIdBatch: jest.fn().mockResolvedValue([]),
  })),
}));

// ============================================================================
// Helpers
// ============================================================================

function createMockDocSnap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
    ref: { id, path: `applications/${id}` },
  };
}

function createMockQuerySnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const mockDocs = docs.map((d) => createMockDocSnap(d.id, d.data));
  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (cb: (doc: ReturnType<typeof createMockDocSnap>) => void) => mockDocs.forEach(cb),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FirebaseApplicationRepository', () => {
  let repository: FirebaseApplicationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseApplicationRepository();
  });

  // ==========================================================================
  // getById
  // ==========================================================================
  describe('getById', () => {
    it('should return application with job posting when document exists', async () => {
      const applicationData = {
        id: 'app-1',
        applicantId: 'staff-1',
        jobPostingId: 'job-1',
        status: 'applied',
      };
      const jobData = {
        id: 'job-1',
        title: '테스트 공고',
        status: 'active',
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(createMockDocSnap('app-1', applicationData))
        .mockResolvedValueOnce(createMockDocSnap('job-1', jobData));

      const result = await repository.getById('app-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('app-1');
      expect(result?.jobPosting).toBeDefined();
    });

    it('should return null when application does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('nonexistent', null));

      const result = await repository.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return application without jobPosting when job does not exist', async () => {
      const applicationData = {
        id: 'app-1',
        applicantId: 'staff-1',
        jobPostingId: 'job-999',
        status: 'applied',
      };

      (getDoc as jest.Mock)
        .mockResolvedValueOnce(createMockDocSnap('app-1', applicationData))
        .mockResolvedValueOnce(createMockDocSnap('job-999', null));

      const result = await repository.getById('app-1');

      expect(result).not.toBeNull();
      expect(result?.jobPosting).toBeUndefined();
    });

    it('should throw when Firebase getDoc fails', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firebase error'));

      await expect(repository.getById('app-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getByApplicantId
  // ==========================================================================
  describe('getByApplicantId', () => {
    it('should return empty array when no applications exist', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByApplicantId('staff-1');

      expect(result).toEqual([]);
    });

    it('should return applications with joined job posting data', async () => {
      const applications = [
        {
          id: 'app-1',
          data: { id: 'app-1', applicantId: 'staff-1', jobPostingId: 'job-1', status: 'applied' },
        },
        {
          id: 'app-2',
          data: { id: 'app-2', applicantId: 'staff-1', jobPostingId: 'job-2', status: 'confirmed' },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(applications));

      // Mock the job posting batch retrieval via the internal repository
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { FirebaseJobPostingRepository } = require('../JobPostingRepository');
      FirebaseJobPostingRepository.mockImplementation(() => ({
        getByIdBatch: jest.fn().mockResolvedValue([
          { id: 'job-1', title: '공고 1' },
          { id: 'job-2', title: '공고 2' },
        ]),
      }));

      // Re-create repository to use updated mock
      const repo = new FirebaseApplicationRepository();
      const result = await repo.getByApplicantId('staff-1');

      expect(result).toHaveLength(2);
    });

    it('should throw when getDocs fails', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      await expect(repository.getByApplicantId('staff-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getByJobPostingId
  // ==========================================================================
  describe('getByJobPostingId', () => {
    it('should return applications for the given job posting', async () => {
      const applications = [
        { id: 'app-1', data: { id: 'app-1', jobPostingId: 'job-1', status: 'applied' } },
        { id: 'app-2', data: { id: 'app-2', jobPostingId: 'job-1', status: 'confirmed' } },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(applications));

      const result = await repository.getByJobPostingId('job-1');

      expect(result).toHaveLength(2);
      expect(query).toHaveBeenCalled();
    });

    it('should return empty array when no applications found', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByJobPostingId('job-999');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // hasApplied
  // ==========================================================================
  describe('hasApplied', () => {
    it('should return true when application exists and is not cancelled', async () => {
      const applicationData = {
        id: 'job-1_staff-1',
        applicantId: 'staff-1',
        jobPostingId: 'job-1',
        status: 'applied',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1_staff-1', applicationData));

      const result = await repository.hasApplied('job-1', 'staff-1');

      expect(result).toBe(true);
    });

    it('should return false when application is cancelled', async () => {
      const applicationData = {
        id: 'job-1_staff-1',
        applicantId: 'staff-1',
        jobPostingId: 'job-1',
        status: 'cancelled',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1_staff-1', applicationData));

      const result = await repository.hasApplied('job-1', 'staff-1');

      expect(result).toBe(false);
    });

    it('should return false when application does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1_staff-1', null));

      const result = await repository.hasApplied('job-1', 'staff-1');

      expect(result).toBe(false);
    });

    it('should return false when getDoc fails', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firebase error'));

      const result = await repository.hasApplied('job-1', 'staff-1');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // getByApplicantIdWithStatuses
  // ==========================================================================
  describe('getByApplicantIdWithStatuses', () => {
    it('should return filtered applications by statuses', async () => {
      const applications = [
        { id: 'app-1', data: { id: 'app-1', applicantId: 'staff-1', status: 'applied' } },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(applications));

      const result = await repository.getByApplicantIdWithStatuses('staff-1', [
        'applied',
        'confirmed',
      ]);

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no applications match statuses', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByApplicantIdWithStatuses('staff-1', ['rejected']);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getStatsByApplicantId
  // ==========================================================================
  describe('getStatsByApplicantId', () => {
    it('should return correct stats for applicant', async () => {
      const applications = [
        {
          id: 'app-1',
          data: { id: 'app-1', applicantId: 'staff-1', jobPostingId: 'job-1', status: 'applied' },
        },
        {
          id: 'app-2',
          data: { id: 'app-2', applicantId: 'staff-1', jobPostingId: 'job-2', status: 'confirmed' },
        },
        {
          id: 'app-3',
          data: { id: 'app-3', applicantId: 'staff-1', jobPostingId: 'job-3', status: 'confirmed' },
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap(applications));

      const stats = await repository.getStatsByApplicantId('staff-1');

      expect(stats.applied).toBe(1);
      expect(stats.confirmed).toBe(2);
      expect(stats.rejected).toBe(0);
    });
  });

  // ==========================================================================
  // cancelWithTransaction
  // ==========================================================================
  describe('cancelWithTransaction', () => {
    it('should cancel an applied application', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('app-1', {
            id: 'app-1',
            applicantId: 'staff-1',
            jobPostingId: 'job-1',
            status: 'applied',
          })
        ),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await repository.cancelWithTransaction('app-1', 'staff-1');

      expect(mockTransaction.update).toHaveBeenCalledTimes(2);
    });

    it('should throw when application does not exist', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(createMockDocSnap('app-1', null)),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.cancelWithTransaction('app-1', 'staff-1')).rejects.toThrow();
    });

    it('should throw when applicant is not the owner', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('app-1', {
            id: 'app-1',
            applicantId: 'staff-other',
            jobPostingId: 'job-1',
            status: 'applied',
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.cancelWithTransaction('app-1', 'staff-1')).rejects.toThrow();
    });

    it('should throw when trying to cancel a confirmed application', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('app-1', {
            id: 'app-1',
            applicantId: 'staff-1',
            jobPostingId: 'job-1',
            status: 'confirmed',
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.cancelWithTransaction('app-1', 'staff-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getCancellationRequests
  // ==========================================================================
  describe('getCancellationRequests', () => {
    it('should return cancellation requests for job posting', async () => {
      const jobData = {
        id: 'job-1',
        title: '테스트 공고',
        ownerId: 'employer-1',
        status: 'active',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1', jobData));
      (getDocs as jest.Mock).mockResolvedValue(
        createMockQuerySnap([
          {
            id: 'app-1',
            data: {
              id: 'app-1',
              status: 'cancellation_pending',
              jobPostingId: 'job-1',
              cancellationRequest: { status: 'pending', reason: '개인 사유' },
            },
          },
        ])
      );

      const result = await repository.getCancellationRequests('job-1', 'employer-1');

      expect(result).toHaveLength(1);
    });

    it('should throw PermissionError when not the owner', async () => {
      const jobData = {
        id: 'job-1',
        title: '테스트 공고',
        ownerId: 'employer-1',
        status: 'active',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1', jobData));

      await expect(
        repository.getCancellationRequests('job-1', 'another-employer')
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // findByJobPostingWithStats
  // ==========================================================================
  describe('findByJobPostingWithStats', () => {
    it('should return applications and stats for job posting', async () => {
      const jobData = {
        id: 'job-1',
        title: '테스트 공고',
        ownerId: 'employer-1',
        status: 'active',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1', jobData));

      const applicationDocs = [
        {
          id: 'app-1',
          data: () => ({ id: 'app-1', status: 'applied', jobPostingId: 'job-1' }),
        },
        {
          id: 'app-2',
          data: () => ({ id: 'app-2', status: 'confirmed', jobPostingId: 'job-1' }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: applicationDocs,
        empty: false,
        size: 2,
      });

      const result = await repository.findByJobPostingWithStats('job-1', 'employer-1');

      expect(result.applications).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.total).toBe(2);
    });

    it('should throw when job posting not found', async () => {
      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-999', null));

      await expect(repository.findByJobPostingWithStats('job-999', 'employer-1')).rejects.toThrow();
    });
  });
});
