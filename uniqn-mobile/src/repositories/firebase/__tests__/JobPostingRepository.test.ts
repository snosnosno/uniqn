import { getDoc, getDocs, setDoc, updateDoc, runTransaction } from 'firebase/firestore';
import { FirebaseJobPostingRepository } from '../jobPosting';

const firestoreMock = jest.requireMock('firebase/firestore');
if (!firestoreMock.documentId) {
  firestoreMock.documentId = jest.fn(() => '__documentId__');
}

jest.mock('@/schemas', () => ({
  parseJobPostingDocument: jest.fn((data: Record<string, unknown>) => {
    if (!data || !data.id) return null;
    return data;
  }),
  parseJobPostingDocuments: jest.fn((docs: Record<string, unknown>[]) =>
    docs.filter((doc) => doc && doc.id)
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
    return new Error('service error');
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
    toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    isAppError: (error: unknown) => error instanceof AppError,
  };
});

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

function createMockDocSnap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
    ref: { id, path: `jobPostings/${id}` },
  };
}

function createMockQuerySnap(docs: { id: string; data: Record<string, unknown> }[]) {
  const mockDocs = docs.map((doc) => ({
    id: doc.id,
    exists: () => true,
    data: () => doc.data,
    ref: { id: doc.id, path: `jobPostings/${doc.id}` },
  }));

  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (callback: (doc: (typeof mockDocs)[0]) => void) => mockDocs.forEach(callback),
  };
}

function createValidJobPostingData(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: 'Existing posting',
    description: 'Saved canonical posting',
    ownerId: 'employer-1',
    ownerName: 'Owner',
    status: 'active',
    postingType: 'regular',
    workDate: '2025-06-15',
    workDates: ['2025-06-15'],
    roleKeys: ['dealer'],
    location: {
      name: 'Seoul',
      district: 'Gangnam-gu',
      detailedAddress: 'Teheran-ro 123',
    },
    contactPhone: '010-1234-5678',
    schedule: {
      kind: 'dated',
      primaryDate: '2025-06-15',
      allDates: ['2025-06-15'],
      requirements: [
        {
          date: '2025-06-15',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [
                {
                  role: 'dealer',
                  count: 5,
                  filled: 0,
                },
              ],
            },
          ],
        },
      ],
    },
    roleCatalog: [
      {
        role: 'dealer',
        salary: { type: 'daily', amount: 150000 },
      },
    ],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'daily', amount: 150000 },
      allowances: { meal: 10000 },
    },
    questions: {
      items: [],
    },
    totalPositions: 5,
    filledPositions: 0,
    viewCount: 0,
    applicationCount: 0,
    createdAt: new Date('2025-06-01T00:00:00.000Z'),
    updatedAt: new Date('2025-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createValidCreateInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    postingType: 'regular',
    title: 'Canonical create',
    description: 'create payload',
    location: {
      name: 'Seoul Gangnam',
      district: 'Teheran-ro',
    },
    contactPhone: '010-1234-5678',
    schedule: {
      kind: 'dated',
      primaryDate: '2025-06-15',
      allDates: ['2025-06-15'],
      requirements: [
        {
          date: '2025-06-15',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [
                {
                  role: 'dealer',
                  count: 1,
                  filled: 0,
                },
              ],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'daily', amount: 150000 },
      allowances: {},
    },
    questions: {
      items: [],
    },
    ...overrides,
  };
}

describe('FirebaseJobPostingRepository', () => {
  let repository: FirebaseJobPostingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseJobPostingRepository();
  });

  describe('getById', () => {
    it('should return job posting when document exists', async () => {
      const jobData = {
        id: 'job-1',
        title: 'Test posting',
        status: 'active',
        ownerId: 'employer-1',
      };

      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('job-1', jobData));

      const result = await repository.getById('job-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('job-1');
      expect(result?.title).toBe('Test posting');
    });

    it('should return null when document does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue(createMockDocSnap('nonexistent', null));

      const result = await repository.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when parsing fails', async () => {
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

  describe('getByIdBatch', () => {
    it('should return empty array for empty input', async () => {
      const result = await repository.getByIdBatch([]);

      expect(result).toEqual([]);
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should return job postings for given IDs', async () => {
      const querySnap = createMockQuerySnap([
        { id: 'job-1', data: { id: 'job-1', title: 'Posting 1', status: 'active' } },
        { id: 'job-2', data: { id: 'job-2', title: 'Posting 2', status: 'active' } },
      ]);

      (getDocs as jest.Mock).mockImplementation(() => Promise.resolve(querySnap));

      const result = await repository.getByIdBatch(['job-1', 'job-2']);

      expect(result).toHaveLength(2);
      expect(getDocs).toHaveBeenCalled();
    });

    it('should deduplicate input IDs', async () => {
      const querySnap = createMockQuerySnap([
        { id: 'job-1', data: { id: 'job-1', title: 'Posting 1', status: 'active' } },
      ]);

      (getDocs as jest.Mock).mockImplementation(() => Promise.resolve(querySnap));

      await repository.getByIdBatch(['job-1', 'job-1', 'job-1']);

      expect(getDocs).toHaveBeenCalledTimes(1);
    });

    it('should handle partial failures gracefully', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Partial failure'));

      const result = await repository.getByIdBatch(['job-1']);

      expect(result).toEqual([]);
    });
  });

  describe('getByOwnerId', () => {
    it('should return job postings for the given owner', async () => {
      const querySnap = createMockQuerySnap([
        {
          id: 'job-1',
          data: { id: 'job-1', title: 'Posting 1', ownerId: 'employer-1', status: 'active' },
        },
        {
          id: 'job-2',
          data: { id: 'job-2', title: 'Posting 2', ownerId: 'employer-1', status: 'closed' },
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

  describe('incrementViewCount', () => {
    it('should call updateDoc with increment', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await repository.incrementViewCount('job-1');

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('should not throw when updateDoc fails', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));

      await expect(repository.incrementViewCount('job-1')).resolves.toBeUndefined();
    });
  });

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

  describe('createWithTransaction', () => {
    it('writes a canonical posting when validation succeeds', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await repository.createWithTransaction(createValidCreateInput() as never, {
        ownerId: 'employer-1',
        ownerName: 'Owner',
      });

      expect(result).toBeDefined();
      expect(setDoc).toHaveBeenCalledTimes(1);
    });

    it('blocks Firestore writes when canonical validation fails before create', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseJobPostingDocument } = require('@/schemas');
      parseJobPostingDocument.mockReturnValueOnce(null);
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      await expect(
        repository.createWithTransaction(
          createValidCreateInput({
            postingType: 'fixed',
          }) as never,
          {
            ownerId: 'employer-1',
            ownerName: 'Owner',
          }
        )
      ).rejects.toThrow();

      expect(setDoc).not.toHaveBeenCalled();
    });
  });

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      await repository.deleteWithTransaction('job-1', 'employer-1');

      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    });

    it('should throw when job posting does not exist', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(createMockDocSnap('job-1', null)),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      await expect(repository.deleteWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });
  });

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      await expect(repository.closeWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });
  });

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      await expect(repository.reopenWithTransaction('job-1', 'employer-1')).rejects.toThrow();
    });
  });

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

  describe('updateWithTransaction', () => {
    it('should update job posting successfully', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(
          createMockDocSnap('job-1', {
            id: 'job-1',
            title: 'Existing posting',
            ownerId: 'employer-1',
            status: 'active',
            filledPositions: 0,
            totalPositions: 5,
          })
        ),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      mockTransaction.get.mockResolvedValueOnce(
        createMockDocSnap('job-1', createValidJobPostingData())
      );

      const result = await repository.updateWithTransaction(
        'job-1',
        { title: 'Updated posting' } as Record<string, unknown>,
        'employer-1'
      );

      expect(result).toBeDefined();
      expect(mockTransaction.set).toHaveBeenCalledTimes(1);
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    it('blocks Firestore writes when canonical validation fails before update', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(createMockDocSnap('job-1', createValidJobPostingData())),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseJobPostingDocument } = require('@/schemas');
      parseJobPostingDocument.mockImplementationOnce((data: Record<string, unknown>) => data);
      parseJobPostingDocument.mockReturnValueOnce(null);

      await expect(
        repository.updateWithTransaction(
          'job-1',
          { title: 'Broken canonical update' } as Record<string, unknown>,
          'employer-1'
        )
      ).rejects.toThrow();

      expect(mockTransaction.set).not.toHaveBeenCalled();
    });

    it('should replace the document so cleared top-level optional fields are removed', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue(createMockDocSnap('job-1', createValidJobPostingData())),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      await repository.updateWithTransaction(
        'job-1',
        {
          description: undefined,
          contactPhone: undefined,
          location: {
            name: 'Seoul',
            district: 'Gangnam-gu',
            detailedAddress: undefined,
          },
        } as Record<string, unknown>,
        'employer-1'
      );

      expect(mockTransaction.set).toHaveBeenCalledTimes(1);
      const [, nextDocument] = mockTransaction.set.mock.calls[0];
      expect(Object.prototype.hasOwnProperty.call(nextDocument, 'description')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(nextDocument, 'contactPhone')).toBe(false);
      expect(nextDocument.location).toMatchObject({
        name: 'Seoul',
        district: 'Gangnam-gu',
      });
      expect(Object.prototype.hasOwnProperty.call(nextDocument.location, 'detailedAddress')).toBe(
        false
      );
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

      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(mockTransaction)
      );

      await expect(
        repository.updateWithTransaction(
          'job-1',
          { title: 'Updated' } as Record<string, unknown>,
          'wrong-employer'
        )
      ).rejects.toThrow();
    });
  });
});
