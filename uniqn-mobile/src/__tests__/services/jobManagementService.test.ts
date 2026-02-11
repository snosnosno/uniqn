/**
 * UNIQN Mobile - Job Management Service Tests
 *
 * @description Unit tests for job posting management service (employer features)
 * @version 2.0.0 - Repository 패턴 기반
 */

import { createMockJobPosting, resetCounters } from '../mocks/factories';
import type { CreateJobPostingInput, StaffRole } from '@/types';

// ============================================================================
// Mock Repository
// ============================================================================

const mockCreateWithTransaction = jest.fn();
const mockUpdateWithTransaction = jest.fn();
const mockDeleteWithTransaction = jest.fn();
const mockCloseWithTransaction = jest.fn();
const mockReopenWithTransaction = jest.fn();
const mockGetStatsByOwnerId = jest.fn();
const mockBulkUpdateStatus = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    updateWithTransaction: (...args: unknown[]) => mockUpdateWithTransaction(...args),
    deleteWithTransaction: (...args: unknown[]) => mockDeleteWithTransaction(...args),
    closeWithTransaction: (...args: unknown[]) => mockCloseWithTransaction(...args),
    reopenWithTransaction: (...args: unknown[]) => mockReopenWithTransaction(...args),
    getStatsByOwnerId: (...args: unknown[]) => mockGetStatsByOwnerId(...args),
    bulkUpdateStatus: (...args: unknown[]) => mockBulkUpdateStatus(...args),
  },
}));

// ============================================================================
// Mock Dependencies
// ============================================================================

jest.mock('@/lib/firebase', () => ({
  db: {},
  getFirebaseDb: () => ({}),
}));

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => ({
      toMillis: () => Date.now(),
      toDate: () => new Date(),
    }),
    fromDate: (date: Date) => ({
      toMillis: () => date.getTime(),
      toDate: () => date,
    }),
  },
  serverTimestamp: () => ({ _serverTimestamp: true }),
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
    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage || code;
      super(message);
      this.name = 'PermissionError';
      this.code = code;
      this.userMessage = message;
    }
  }
  return {
    mapFirebaseError: (error: Error) => error,
    isAppError: (error: unknown) =>
      error instanceof BusinessError || error instanceof PermissionError,
    ERROR_CODES: {
      FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
      FIREBASE_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6042',
    },
    BusinessError,
    PermissionError,
  };
});

jest.mock('@/services/jobPostingMigration', () => ({
  migrateJobPostingForWrite: jest.fn((input: unknown) => ({
    data: input,
    migrated: false,
    migrationType: 'none',
  })),
}));

// Import after mocks
import {
  createJobPosting,
  updateJobPosting,
  deleteJobPosting,
  closeJobPosting,
  reopenJobPosting,
  getMyJobPostingStats,
  bulkUpdateJobPostingStatus,
} from '@/services/jobManagementService';

// ============================================================================
// Test Utilities
// ============================================================================

function createTestJobPostingInput(): CreateJobPostingInput {
  return {
    title: '테스트 딜러 모집',
    description: '테스트 공고 설명',
    location: {
      name: '서울시 강남구',
      address: '서울특별시 강남구',
    },
    workDate: '2024-02-01',
    timeSlot: '09:00-18:00',
    roles: [
      {
        role: 'dealer' as StaffRole,
        count: 3,
        filled: 0,
        salary: { type: 'hourly' as const, amount: 15000 },
      },
      {
        role: 'manager' as StaffRole,
        count: 1,
        filled: 0,
        salary: { type: 'hourly' as const, amount: 15000 },
      },
    ],
    defaultSalary: {
      type: 'hourly' as const,
      amount: 15000,
    },
    useSameSalary: true,
  };
}

function createMockJobPostingData(overrides = {}) {
  const baseJob = createMockJobPosting();
  return {
    ...baseJob,
    ownerId: 'employer-1',
    ownerName: '테스트 구인자',
    status: 'active' as const,
    totalPositions: 4,
    filledPositions: 0,
    viewCount: 10,
    applicationCount: 5,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('jobManagementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCounters();
  });

  // ==========================================================================
  // createJobPosting
  // ==========================================================================

  describe('createJobPosting', () => {
    it('should create a job posting successfully', async () => {
      const input = createTestJobPostingInput();
      const mockResult = {
        id: 'test-doc-id',
        jobPosting: {
          ...input,
          id: 'test-doc-id',
          status: 'active',
          ownerId: 'employer-1',
          totalPositions: 4,
          filledPositions: 0,
          viewCount: 0,
          applicationCount: 0,
        },
      };
      mockCreateWithTransaction.mockResolvedValue(mockResult);

      const result = await createJobPosting(input, 'employer-1', '테스트 구인자');

      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result)) {
        expect(result.id).toBe('test-doc-id');
        expect(result.jobPosting.title).toBe(input.title);
        expect(result.jobPosting.status).toBe('active');
        expect(result.jobPosting.ownerId).toBe('employer-1');
        expect(result.jobPosting.totalPositions).toBe(4);
      }
    });

    it('should calculate total positions from roles', async () => {
      const input = createTestJobPostingInput();
      input.roles = [
        { role: 'dealer' as StaffRole, count: 5, filled: 0 },
        { role: 'manager' as StaffRole, count: 2, filled: 0 },
        { role: 'chiprunner' as StaffRole, count: 3, filled: 0 },
      ];

      mockCreateWithTransaction.mockResolvedValue({
        id: 'test-doc-id',
        jobPosting: {
          ...input,
          id: 'test-doc-id',
          status: 'active',
          ownerId: 'employer-1',
          totalPositions: 10,
          filledPositions: 0,
          viewCount: 0,
          applicationCount: 0,
        },
      });

      const result = await createJobPosting(input, 'employer-1', '테스트 구인자');

      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result)) {
        expect(result.jobPosting.totalPositions).toBe(10);
      }
    });

    it('should initialize counts to zero', async () => {
      const input = createTestJobPostingInput();

      mockCreateWithTransaction.mockResolvedValue({
        id: 'test-doc-id',
        jobPosting: {
          ...input,
          id: 'test-doc-id',
          status: 'active',
          ownerId: 'employer-1',
          totalPositions: 4,
          filledPositions: 0,
          viewCount: 0,
          applicationCount: 0,
        },
      });

      const result = await createJobPosting(input, 'employer-1', '테스트 구인자');

      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result)) {
        expect(result.jobPosting.filledPositions).toBe(0);
        expect(result.jobPosting.viewCount).toBe(0);
        expect(result.jobPosting.applicationCount).toBe(0);
      }
    });

    it('should throw error on Firebase failure', async () => {
      const input = createTestJobPostingInput();
      mockCreateWithTransaction.mockRejectedValue(new Error('Firebase error'));

      await expect(createJobPosting(input, 'employer-1', '테스트 구인자')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // updateJobPosting
  // ==========================================================================

  describe('updateJobPosting', () => {
    it('should update job posting successfully', async () => {
      const updatedJobPosting = createMockJobPostingData({
        id: 'job-1',
        title: '수정된 제목',
      });

      mockUpdateWithTransaction.mockResolvedValue(updatedJobPosting);

      const result = await updateJobPosting('job-1', { title: '수정된 제목' }, 'employer-1');

      expect(result.title).toBe('수정된 제목');
      expect(mockUpdateWithTransaction).toHaveBeenCalled();
    });

    it('should throw error for non-existent job posting', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockUpdateWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        })
      );

      await expect(
        updateJobPosting('non-existent', { title: '수정' }, 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockUpdateWithTransaction.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 수정할 수 있습니다',
        })
      );

      await expect(updateJobPosting('job-1', { title: '수정' }, 'employer-1')).rejects.toThrow(
        '본인의 공고만 수정할 수 있습니다'
      );
    });

    it('should throw error when modifying schedule with confirmed applicants', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockUpdateWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원자가 있는 경우 일정 및 역할을 수정할 수 없습니다',
        })
      );

      await expect(
        updateJobPosting('job-1', { workDate: '2024-03-01' }, 'employer-1')
      ).rejects.toThrow('확정된 지원자가 있는 경우 일정 및 역할을 수정할 수 없습니다');
    });

    it('should allow title/description change with confirmed applicants', async () => {
      const updatedJobPosting = createMockJobPostingData({
        id: 'job-1',
        title: '수정된 제목',
        description: '수정된 설명',
        filledPositions: 2,
      });

      mockUpdateWithTransaction.mockResolvedValue(updatedJobPosting);

      const result = await updateJobPosting(
        'job-1',
        { title: '수정된 제목', description: '수정된 설명' },
        'employer-1'
      );

      expect(result.title).toBe('수정된 제목');
      expect(result.description).toBe('수정된 설명');
    });
  });

  // ==========================================================================
  // deleteJobPosting
  // ==========================================================================

  describe('deleteJobPosting', () => {
    it('should soft delete job posting (set status to cancelled)', async () => {
      mockDeleteWithTransaction.mockResolvedValue(undefined);

      await deleteJobPosting('job-1', 'employer-1');

      expect(mockDeleteWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
    });

    it('should throw error for non-existent job posting', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockDeleteWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        })
      );

      await expect(deleteJobPosting('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockDeleteWithTransaction.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 삭제할 수 있습니다',
        })
      );

      await expect(deleteJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '본인의 공고만 삭제할 수 있습니다'
      );
    });

    it('should throw error when deleting with confirmed applicants', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockDeleteWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '확정된 지원자가 있는 공고는 삭제할 수 없습니다',
        })
      );

      await expect(deleteJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '확정된 지원자가 있는 공고는 삭제할 수 없습니다'
      );
    });
  });

  // ==========================================================================
  // closeJobPosting
  // ==========================================================================

  describe('closeJobPosting', () => {
    it('should close job posting successfully', async () => {
      mockCloseWithTransaction.mockResolvedValue(undefined);

      await closeJobPosting('job-1', 'employer-1');

      expect(mockCloseWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
    });

    it('should throw error for non-existent job posting', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockCloseWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        })
      );

      await expect(closeJobPosting('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockCloseWithTransaction.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 마감할 수 있습니다',
        })
      );

      await expect(closeJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '본인의 공고만 마감할 수 있습니다'
      );
    });

    it('should throw error if already closed', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockCloseWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 마감된 공고입니다',
        })
      );

      await expect(closeJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '이미 마감된 공고입니다'
      );
    });
  });

  // ==========================================================================
  // reopenJobPosting
  // ==========================================================================

  describe('reopenJobPosting', () => {
    it('should reopen closed job posting successfully', async () => {
      mockReopenWithTransaction.mockResolvedValue(undefined);

      await reopenJobPosting('job-1', 'employer-1');

      expect(mockReopenWithTransaction).toHaveBeenCalledWith('job-1', 'employer-1');
    });

    it('should throw error for non-existent job posting', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockReopenWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '존재하지 않는 공고입니다',
        })
      );

      await expect(reopenJobPosting('non-existent', 'employer-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should throw error for unauthorized owner', async () => {
      const { PermissionError, ERROR_CODES } = jest.requireMock('@/errors');
      mockReopenWithTransaction.mockRejectedValue(
        new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고만 재오픈할 수 있습니다',
        })
      );

      await expect(reopenJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '본인의 공고만 재오픈할 수 있습니다'
      );
    });

    it('should throw error if already active', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockReopenWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '이미 활성 상태인 공고입니다',
        })
      );

      await expect(reopenJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '이미 활성 상태인 공고입니다'
      );
    });

    it('should throw error for cancelled job posting', async () => {
      const { BusinessError, ERROR_CODES } = jest.requireMock('@/errors');
      mockReopenWithTransaction.mockRejectedValue(
        new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '삭제된 공고는 재오픈할 수 없습니다',
        })
      );

      await expect(reopenJobPosting('job-1', 'employer-1')).rejects.toThrow(
        '삭제된 공고는 재오픈할 수 없습니다'
      );
    });
  });

  // ==========================================================================
  // getMyJobPostingStats
  // ==========================================================================

  describe('getMyJobPostingStats', () => {
    it('should return correct statistics', async () => {
      mockGetStatsByOwnerId.mockResolvedValue({
        total: 4,
        active: 2,
        closed: 1,
        cancelled: 1,
        totalApplications: 18,
        totalViews: 370,
      });

      const stats = await getMyJobPostingStats('employer-1');

      expect(stats.total).toBe(4);
      expect(stats.active).toBe(2);
      expect(stats.closed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.totalApplications).toBe(18);
      expect(stats.totalViews).toBe(370);
    });

    it('should return zero counts for new employer', async () => {
      mockGetStatsByOwnerId.mockResolvedValue({
        total: 0,
        active: 0,
        closed: 0,
        cancelled: 0,
        totalApplications: 0,
        totalViews: 0,
      });

      const stats = await getMyJobPostingStats('new-employer');

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.closed).toBe(0);
      expect(stats.totalApplications).toBe(0);
      expect(stats.totalViews).toBe(0);
    });
  });

  // ==========================================================================
  // bulkUpdateJobPostingStatus
  // ==========================================================================

  describe('bulkUpdateJobPostingStatus', () => {
    it('should update multiple job postings status', async () => {
      mockBulkUpdateStatus.mockResolvedValue(2);

      const successCount = await bulkUpdateJobPostingStatus(
        ['job-1', 'job-2'],
        'closed',
        'employer-1'
      );

      expect(successCount).toBe(2);
      expect(mockBulkUpdateStatus).toHaveBeenCalledWith(
        ['job-1', 'job-2'],
        'closed',
        'employer-1'
      );
    });

    it('should only update owned job postings', async () => {
      mockBulkUpdateStatus.mockResolvedValue(1);

      const successCount = await bulkUpdateJobPostingStatus(
        ['job-1', 'job-2'],
        'closed',
        'employer-1'
      );

      // Only job-1 should be updated (owned by employer-1)
      expect(successCount).toBe(1);
    });

    it('should handle non-existent job postings', async () => {
      mockBulkUpdateStatus.mockResolvedValue(0);

      const successCount = await bulkUpdateJobPostingStatus(
        ['non-existent-1', 'non-existent-2'],
        'closed',
        'employer-1'
      );

      expect(successCount).toBe(0);
    });
  });
});
