/**
 * UNIQN Mobile - JobPostingRepository 테스트
 *
 * @description Firebase JobPosting Repository 단위 테스트
 */

import { getDoc, getDocs, updateDoc, runTransaction } from 'firebase/firestore';
import { FirebaseJobPostingRepository } from '../jobPosting';

// firebase/firestore의 전역 mock에 documentId가 누락되어 있으므로 추가
const firestoreMock = jest.requireMock('firebase/firestore');
if (!firestoreMock.documentId) {
  firestoreMock.documentId = jest.fn(() => '__documentId__');
}

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/schemas', () => ({
  parseJobPostingDocument: jest.fn((data: Record<string, unknown>) => {
    if (!data || !data.id) return null;
    return data;
  }),
  parseJobPostingDocuments: jest.fn((docs: Record<string, unknown>[]) =>
    docs.filter((d) => d && d.id)
  ),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
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
    BusinessError,
    PermissionError,
    ERROR_CODES: {
      FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
      FIREBASE_PERMISSION_DENIED: 'E4001',
      BUSINESS_INVALID_STATE: 'E6010',
    },
    toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
    isAppError: (e: unknown) => e instanceof AppError,
  };
});

// Mock QueryBuilder to pass through
jest.mock('@/utils/firestore/queryBuilder', () => {
  class MockQueryBuilder {
    private ref: unknown;

    constructor(ref: unknown) {
      this.ref = ref;
    }
    whereEqual() {
      return this;
    }
    whereIf() {
      return this;
    }
    whereArrayContainsAny() {
      return this;
    }
    where() {
      return this;
    }
    whereDateRange() {
      return this;
    }
    orderBy() {
      return this;
    }
    orderByDesc() {
      return this;
    }
    limit() {
      return this;
    }
    paginate() {
      return this;
    }
    build() {
      // Return something that getDocs can consume
      return { _query: true, ref: this.ref };
    }
  }
  return { QueryBuilder: MockQueryBuilder };
});

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    JOB_POSTINGS: 'jobPostings',
    APPLICATIONS: 'applications',
    WORK_LOGS: 'workLogs',
  },
  FIELDS: {
    JOB_POSTING: {
      status: 'status',
      ownerId: 'ownerId',
      postingType: 'postingType',
      locationDistrict: 'location.district',
      isUrgent: 'isUrgent',
      workDate: 'workDate',
      tournamentApprovalStatus: 'tournamentConfig.approvalStatus',
      createdAt: 'createdAt',
    },
    APPLICATION: {
      jobPostingId: 'jobPostingId',
      applicantId: 'applicantId',
      status: 'status',
      createdAt: 'createdAt',
    },
  },
  FIREBASE_LIMITS: {
    BATCH_MAX_OPERATIONS: 500,
  },
  STATUS: {
    JOB_POSTING: {
      ACTIVE: 'active',
      CLOSED: 'closed',
      CANCELLED: 'cancelled',
    },
    TOURNAMENT: {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
    },
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function createMockDocSnap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
    ref: { id, path: `jobPostings/${id}` },
  };
}

function createMockQuerySnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const mockDocs = docs.map((d) => ({
    id: d.id,
    exists: () => true,
    data: () => d.data,
    ref: { id: d.id, path: `jobPostings/${d.id}` },
  }));
  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (cb: (doc: (typeof mockDocs)[0]) => void) => mockDocs.forEach(cb),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('FirebaseJobPostingRepository', () => {
  let repository: FirebaseJobPostingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseJobPostingRepository();
  });

  // ==========================================================================
  // getById
  // ==========================================================================
  describe('getById', () => {
    it('should return job posting when document exists', async () => {
      const jobData = {
        id: 'job-1',
        title: '테스트 구인공고',
        status: 'active',
        ownerId: 'employer-1',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1', jobData));

      const result = await repository.getById('job-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-1');
      expect(result?.title).toBe('테스트 구인공고');
    });

    it('should return null when document does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('nonexistent', null));

      const result = await repository.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when parsing fails', async () => {
      // parseJobPostingDocument returns null for invalid data
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseJobPostingDocument } = require('@/schemas');
      parseJobPostingDocument.mockReturnValueOnce(null);

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1', { title: 'invalid' }));

      const result = await repository.getById('job-1');

      expect(result).toBeNull();
    });

    it('should throw when Firebase getDoc fails', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firebase error'));

      await expect(repository.getById('job-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // getByIdBatch
  // ==========================================================================
  describe('getByIdBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await repository.getByIdBatch([]);

      expect(result).toEqual([]);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should return job postings for given IDs', async () => {
      const querySnap = createMockQuerySnap([
        { id: 'job-1', data: { id: 'job-1', title: '공고 1', status: 'active' } },
        { id: 'job-2', data: { id: 'job-2', title: '공고 2', status: 'active' } },
      ]);

      (getDocs as jest.Mock).mockImplementation(() => Promise.resolve(querySnap));

      const result = await repository.getByIdBatch(['job-1', 'job-2']);

      expect(result).toHaveLength(2);
      expect(getDocs).toHaveBeenCalled();
    });

    it('should deduplicate input IDs', async () => {
      const querySnap = createMockQuerySnap([
        { id: 'job-1', data: { id: 'job-1', title: '공고 1', status: 'active' } },
      ]);

      (getDocs as jest.Mock).mockImplementation(() => Promise.resolve(querySnap));

      await repository.getByIdBatch(['job-1', 'job-1', 'job-1']);

      // getDocs should be called once (one chunk with 1 unique ID)
      expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it('should handle partial failures gracefully', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Partial failure'));

      // Promise.allSettled handles partial failures
      const result = await repository.getByIdBatch(['job-1']);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getByOwnerId
  // ==========================================================================
  describe('getByOwnerId', () => {
    it('should return job postings for the given owner', async () => {
      const querySnap = createMockQuerySnap([
        {
          id: 'job-1',
          data: { id: 'job-1', title: '공고 1', ownerId: 'employer-1', status: 'active' },
        },
        {
          id: 'job-2',
          data: { id: 'job-2', title: '공고 2', ownerId: 'employer-1', status: 'closed' },
        },
      ]);

      (getDocs as jest.Mock).mockResolvedValue(querySnap);

      const result = await repository.getByOwnerId('employer-1');

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no postings found', async () => {
      (getDocs as jest.Mock).mockResolvedValue(createMockQuerySnap([]));

      const result = await repository.getByOwnerId('employer-999');

      expect(result).toEqual([]);
    });

    it('should filter by status when provided', async () => {
      const querySnap = createMockQuerySnap([
        { id: 'job-1', data: { id: 'job-1', ownerId: 'employer-1', status: 'active' } },
      ]);

      (getDocs as jest.Mock).mockResolvedValue(querySnap);

      const result = await repository.getByOwnerId('employer-1', 'active');

      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // getTypeCounts
  // ==========================================================================
  describe('getTypeCounts', () => {
    it('should return correct type counts', async () => {
      const querySnap = createMockQuerySnap([
        { id: 'job-1', data: { id: 'job-1', postingType: 'regular', status: 'active' } },
        { id: 'job-2', data: { id: 'job-2', postingType: 'regular', status: 'active' } },
        { id: 'job-3', data: { id: 'job-3', postingType: 'urgent', status: 'active' } },
        { id: 'job-4', data: { id: 'job-4', postingType: 'fixed', status: 'active' } },
        {
          id: 'job-5',
          data: {
            id: 'job-5',
            postingType: 'tournament',
            status: 'active',
            tournamentConfig: { approvalStatus: 'approved' },
          },
        },
      ]);

      (getDocs as jest.Mock).mockResolvedValue(querySnap);

      const counts = await repository.getTypeCounts();

      expect(counts.regular).toBe(2);
      expect(counts.urgent).toBe(1);
      expect(counts.fixed).toBe(1);
      expect(counts.tournament).toBe(1);
      expect(counts.total).toBe(5);
    });

    it('should exclude unapproved tournament postings', async () => {
      const querySnap = createMockQuerySnap([
        {
          id: 'job-1',
          data: {
            id: 'job-1',
            postingType: 'tournament',
            status: 'active',
            tournamentConfig: { approvalStatus: 'pending' },
          },
        },
      ]);

      (getDocs as jest.Mock).mockResolvedValue(querySnap);

      const counts = await repository.getTypeCounts();

      expect(counts.tournament).toBe(0);
      expect(counts.total).toBe(0);
    });
  });

  // ==========================================================================
  // incrementViewCount
  // ==========================================================================
  describe('incrementViewCount', () => {
    it('should call updateDoc with increment', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await repository.incrementViewCount('job-1');

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('should not throw when updateDoc fails', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));

      // incrementViewCount silently handles errors
      await expect(repository.incrementViewCount('job-1')).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // updateStatus
  // ==========================================================================
  describe('updateStatus', () => {
    it('should update job posting status', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await repository.updateStatus('job-1', 'closed');

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('should throw when updateDoc fails', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await expect(repository.updateStatus('job-1', 'closed')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // deleteWithTransaction
  // ==========================================================================
  describe('deleteWithTransaction', () => {
    it('should soft-delete job posting (set status to cancelled)', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'active',
            filledPositions: 0,
          })
        ),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await repository.deleteWithTransaction('job-1', 'employer-1');

      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when job posting does not exist', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(createMockDocSnap('job-1', null)),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.deleteWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });

    it('should throw when user is not the owner', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'active',
            filledPositions: 0,
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.deleteWithTransaction('job-1', 'wrong-employer')).rejects.toThrow();
    });

    it('should throw when confirmed applicants exist', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'active',
            filledPositions: 3,
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.deleteWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // closeWithTransaction
  // ==========================================================================
  describe('closeWithTransaction', () => {
    it('should close an active job posting', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'active',
          })
        ),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await repository.closeWithTransaction('job-1', 'employer-1');

      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when already closed', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'closed',
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.closeWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // reopenWithTransaction
  // ==========================================================================
  describe('reopenWithTransaction', () => {
    it('should reopen a closed job posting', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'closed',
            postingType: 'regular',
          })
        ),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await repository.reopenWithTransaction('job-1', 'employer-1');

      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when already active', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'active',
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.reopenWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });

    it('should throw when cancelled', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'cancelled',
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(repository.reopenWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });
  });

  // ==========================================================================
  // verifyOwnership
  // ==========================================================================
  describe('verifyOwnership', () => {
    it('should return true when user is the owner', async () => {
      (getDoc as jest.Mock).mockResolvedValue(
        createMockDocSnap('job-1', {
          id: 'job-1',
          ownerId: 'employer-1',
          status: 'active',
        })
      );

      const result = await repository.verifyOwnership('job-1', 'employer-1');

      expect(result).toBe(true);
    });

    it('should return false when user is not the owner', async () => {
      (getDoc as jest.Mock).mockResolvedValue(
        createMockDocSnap('job-1', {
          id: 'job-1',
          ownerId: 'employer-1',
          status: 'active',
        })
      );

      const result = await repository.verifyOwnership('job-1', 'wrong-user');

      expect(result).toBe(false);
    });

    it('should return false when document does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-999', null));

      const result = await repository.verifyOwnership('job-999', 'employer-1');

      expect(result).toBe(false);
    });

    it('should return false when getDoc fails', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firebase error'));

      const result = await repository.verifyOwnership('job-1', 'employer-1');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // getStatsByOwnerId
  // ==========================================================================
  describe('getStatsByOwnerId', () => {
    it('should return correct stats for owner', async () => {
      const querySnap = createMockQuerySnap([
        {
          id: 'job-1',
          data: {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'active',
            applicationCount: 5,
            viewCount: 100,
          },
        },
        {
          id: 'job-2',
          data: {
            id: 'job-2',
            ownerId: 'employer-1',
            status: 'closed',
            applicationCount: 3,
            viewCount: 50,
          },
        },
        {
          id: 'job-3',
          data: {
            id: 'job-3',
            ownerId: 'employer-1',
            status: 'cancelled',
            applicationCount: 0,
            viewCount: 10,
          },
        },
      ]);

      (getDocs as jest.Mock).mockResolvedValue(querySnap);

      const stats = await repository.getStatsByOwnerId('employer-1');

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(1);
      expect(stats.closed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.totalApplications).toBe(8);
      expect(stats.totalViews).toBe(160);
    });
  });

  // ==========================================================================
  // updateWithTransaction
  // ==========================================================================
  describe('updateWithTransaction', () => {
    it('should update job posting successfully', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            title: '기존 공고',
            ownerId: 'employer-1',
            status: 'active',
            filledPositions: 0,
            totalPositions: 5,
          })
        ),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      const result = await repository.updateWithTransaction(
        'job-1',
        { title: '수정된 공고' } as Record<string, unknown>,
        'employer-1'
      );

      expect(result).toBeDefined();
      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when not the owner', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'employer-1',
            status: 'active',
          })
        ),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) => {
        return callback(mockTransaction);
      });

      await expect(
        repository.updateWithTransaction(
          'job-1',
          { title: '수정' } as Record<string, unknown>,
          'wrong-employer'
        )
      ).rejects.toThrow();
    });
  });
});
