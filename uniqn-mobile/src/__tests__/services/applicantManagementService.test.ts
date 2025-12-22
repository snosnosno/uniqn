/**
 * UNIQN Mobile - Applicant Management Service Tests
 *
 * @description Unit tests for applicant management service (employer)
 * @version 1.0.0
 */

import {
  createMockJobPosting,
  createMockApplication,
  resetCounters,
} from '../mocks/factories';

// Import after mocks
import {
  getApplicantsByJobPosting,
  confirmApplication,
  rejectApplication,
  bulkConfirmApplications,
  addToWaitlist,
  promoteFromWaitlist,
  markApplicationAsRead,
  getApplicantStatsByRole,
} from '@/services/applicantManagementService';

// ============================================================================
// Firebase Mocks
// ============================================================================

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockRunTransaction = jest.fn();
const mockWriteBatch = jest.fn();
const mockIncrement = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  increment: (n: number) => mockIncrement(n),
  serverTimestamp: () => ({ _serverTimestamp: true }),
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
}));

jest.mock('@/lib/firebase', () => ({
  db: {},
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  mapFirebaseError: (error: Error) => error,
  MaxCapacityReachedError: class MaxCapacityReachedError extends Error {
    public userMessage: string;
    public jobPostingId: string;
    public maxCapacity: number;
    public currentCount: number;
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
  },
}));

// ============================================================================
// Test Utilities
// ============================================================================

function createMockJobPostingWithRoles(overrides = {}) {
  const baseJob = createMockJobPosting();
  return {
    ...baseJob,
    id: baseJob.id,
    title: baseJob.title,
    ownerId: 'employer-1',
    workDate: '2024-01-20',
    totalPositions: 10,
    filledPositions: 0,
    roles: [
      { role: 'dealer', count: 5, filled: 0 },
      { role: 'floor', count: 3, filled: 0 },
      { role: 'chip', count: 2, filled: 0 },
    ],
    ...overrides,
  };
}

function createMockApplicationWithDetails(overrides = {}) {
  const baseApplication = createMockApplication();
  return {
    ...baseApplication,
    id: baseApplication.id,
    jobPostingId: 'job-1',
    applicantId: 'staff-1',
    applicantName: '홍길동',
    applicantEmail: 'hong@example.com',
    appliedRole: 'dealer',
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
    mockDoc.mockReturnValue({ id: 'test-doc' });
    mockCollection.mockReturnValue({ id: 'test-collection' });
    mockQuery.mockReturnValue({ query: 'test-query' });
    mockWhere.mockReturnValue({ where: 'test-where' });
    mockOrderBy.mockReturnValue({ orderBy: 'test-orderBy' });
  });

  // ==========================================================================
  // getApplicantsByJobPosting
  // ==========================================================================

  describe('getApplicantsByJobPosting', () => {
    it('should return applicants list with stats', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const applicant1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });
      const applicant2 = createMockApplicationWithDetails({
        id: 'app-2',
        status: 'confirmed',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'job-1',
        data: () => jobPosting,
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'app-1', data: () => applicant1 },
          { id: 'app-2', data: () => applicant2 },
        ],
      });

      const result = await getApplicantsByJobPosting('job-1', 'employer-1');

      expect(result.applicants).toHaveLength(2);
      expect(result.stats.total).toBe(2);
      expect(result.stats.applied).toBe(1);
      expect(result.stats.confirmed).toBe(1);
    });

    it('should throw error for non-existent job posting', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        getApplicantsByJobPosting('non-existent', 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingWithRoles({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'job-1',
        data: () => jobPosting,
      });

      await expect(
        getApplicantsByJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('본인의 공고만 조회할 수 있습니다');
    });

    it('should filter by status', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const applicant1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'job-1',
        data: () => jobPosting,
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'app-1', data: () => applicant1 }],
      });

      const result = await getApplicantsByJobPosting('job-1', 'employer-1', 'applied');

      expect(result.applicants).toHaveLength(1);
      expect(result.applicants[0].status).toBe('applied');
    });
  });

  // ==========================================================================
  // confirmApplication
  // ==========================================================================

  describe('confirmApplication', () => {
    it('should confirm an application and create work log', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
        appliedRole: 'dealer',
      });

      const mockWorkLogRef = { id: 'worklog-new' };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          set: jest.fn(),
          update: jest.fn(),
        };

        mockDoc.mockReturnValueOnce({ id: 'app-1' });
        mockDoc.mockReturnValueOnce({ id: 'job-1' });
        mockCollection.mockReturnValueOnce({});
        mockDoc.mockReturnValueOnce(mockWorkLogRef);

        return await callback(transaction);
      });

      const result = await confirmApplication(
        { applicationId: 'app-1' },
        'employer-1'
      );

      expect(result.applicationId).toBe('app-1');
      expect(result.workLogId).toBeDefined();
      expect(result.message).toContain('확정');
    });

    it('should throw error for already confirmed application', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'confirmed',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return await callback(transaction);
      });

      await expect(
        confirmApplication({ applicationId: 'app-1' }, 'employer-1')
      ).rejects.toThrow('이미 확정된 지원입니다');
    });

    it('should throw MaxCapacityReachedError when positions are full', async () => {
      const jobPosting = createMockJobPostingWithRoles({
        id: 'job-1',
        totalPositions: 5,
        filledPositions: 5,
      });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return await callback(transaction);
      });

      await expect(
        confirmApplication({ applicationId: 'app-1' }, 'employer-1')
      ).rejects.toThrow('모집 인원이 마감되었습니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingWithRoles({
        id: 'job-1',
        ownerId: 'other-employer',
      });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return await callback(transaction);
      });

      await expect(
        confirmApplication({ applicationId: 'app-1' }, 'employer-1')
      ).rejects.toThrow('본인의 공고만 관리할 수 있습니다');
    });
  });

  // ==========================================================================
  // rejectApplication
  // ==========================================================================

  describe('rejectApplication', () => {
    it('should reject an application', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      await expect(
        rejectApplication({ applicationId: 'app-1', reason: '부적합' }, 'employer-1')
      ).resolves.not.toThrow();
    });

    it('should throw error for already confirmed application', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'confirmed',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      await expect(
        rejectApplication({ applicationId: 'app-1' }, 'employer-1')
      ).rejects.toThrow('이미 확정된 지원은 거절할 수 없습니다');
    });

    it('should throw error for already rejected application', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'rejected',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      await expect(
        rejectApplication({ applicationId: 'app-1' }, 'employer-1')
      ).rejects.toThrow('이미 거절된 지원입니다');
    });
  });

  // ==========================================================================
  // bulkConfirmApplications
  // ==========================================================================

  describe('bulkConfirmApplications', () => {
    it('should confirm multiple applications', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });
      const application2 = createMockApplicationWithDetails({
        id: 'app-2',
        status: 'applied',
      });

      let callCount = 0;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        callCount++;
        const app = callCount === 1 ? application1 : application2;
        const workLogId = `worklog-${callCount}`;

        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => app,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          set: jest.fn(),
          update: jest.fn(),
        };

        mockDoc.mockReturnValueOnce({ id: workLogId });

        return await callback(transaction);
      });

      const result = await bulkConfirmApplications(
        ['app-1', 'app-2'],
        'employer-1'
      );

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.workLogIds).toHaveLength(2);
    });

    it('should handle partial failures', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application1 = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });
      const application2 = createMockApplicationWithDetails({
        id: 'app-2',
        status: 'confirmed', // already confirmed - will fail
      });

      let callCount = 0;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        callCount++;
        const app = callCount === 1 ? application1 : application2;
        const workLogId = `worklog-${callCount}`;

        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => app,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          set: jest.fn(),
          update: jest.fn(),
        };

        mockDoc.mockReturnValueOnce({ id: workLogId });

        return await callback(transaction);
      });

      const result = await bulkConfirmApplications(
        ['app-1', 'app-2'],
        'employer-1'
      );

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.failedIds).toContain('app-2');
    });
  });

  // ==========================================================================
  // addToWaitlist
  // ==========================================================================

  describe('addToWaitlist', () => {
    it('should add an application to waitlist', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      mockGetDocs.mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

      await expect(
        addToWaitlist('app-1', 'employer-1')
      ).resolves.not.toThrow();
    });

    it('should assign correct waitlist order', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'applied',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn()
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => application,
            })
            .mockResolvedValueOnce({
              exists: () => true,
              data: () => jobPosting,
            }),
          update: jest.fn(),
        };
        await callback(transaction);
      });

      // Existing waitlisted applicants
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          { data: () => ({ waitlistOrder: 3 }) },
        ],
      });

      await expect(
        addToWaitlist('app-1', 'employer-1')
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // promoteFromWaitlist
  // ==========================================================================

  describe('promoteFromWaitlist', () => {
    it('should promote a waitlisted application to confirmed', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        status: 'waitlisted',
      });

      let transactionCallCount = 0;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        transactionCallCount++;

        if (transactionCallCount === 1) {
          // First transaction: confirmApplication
          const transaction = {
            get: jest.fn()
              .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ ...application, status: 'applied' }), // Treat as applied
              })
              .mockResolvedValueOnce({
                exists: () => true,
                data: () => jobPosting,
              }),
            set: jest.fn(),
            update: jest.fn(),
          };

          mockDoc.mockReturnValueOnce({ id: 'worklog-new' });

          return await callback(transaction);
        } else {
          // Second transaction: update waitlistPromotedAt
          const transaction = {
            update: jest.fn(),
          };
          await callback(transaction);
        }
      });

      const result = await promoteFromWaitlist('app-1', 'employer-1');

      expect(result.applicationId).toBe('app-1');
      expect(result.workLogId).toBeDefined();
    });
  });

  // ==========================================================================
  // markApplicationAsRead
  // ==========================================================================

  describe('markApplicationAsRead', () => {
    it('should mark an application as read', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const application = createMockApplicationWithDetails({
        id: 'app-1',
        isRead: false,
      });

      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => application,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => jobPosting,
        });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          update: jest.fn(),
        };
        await callback(transaction);
      });

      await expect(
        markApplicationAsRead('app-1', 'employer-1')
      ).resolves.not.toThrow();
    });

    it('should throw error for non-existent application', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        markApplicationAsRead('non-existent', 'employer-1')
      ).rejects.toThrow('존재하지 않는 지원입니다');
    });
  });

  // ==========================================================================
  // getApplicantStatsByRole
  // ==========================================================================

  describe('getApplicantStatsByRole', () => {
    it('should return stats grouped by role', async () => {
      const jobPosting = createMockJobPostingWithRoles({ id: 'job-1' });
      const applicant1 = createMockApplicationWithDetails({
        id: 'app-1',
        appliedRole: 'dealer',
        status: 'confirmed',
      });
      const applicant2 = createMockApplicationWithDetails({
        id: 'app-2',
        appliedRole: 'dealer',
        status: 'applied',
      });
      const applicant3 = createMockApplicationWithDetails({
        id: 'app-3',
        appliedRole: 'manager',
        status: 'applied',
      });

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'job-1',
        data: () => jobPosting,
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'app-1', data: () => applicant1 },
          { id: 'app-2', data: () => applicant2 },
          { id: 'app-3', data: () => applicant3 },
        ],
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
