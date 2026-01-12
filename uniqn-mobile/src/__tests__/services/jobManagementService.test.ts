/**
 * UNIQN Mobile - Job Management Service Tests
 *
 * @description Unit tests for job posting management service (employer features)
 * @version 1.0.0
 */

import {
  createMockJobPosting,
  resetCounters,
} from '../mocks/factories';
import type { CreateJobPostingInput, StaffRole } from '@/types';

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
// Firebase Mocks
// ============================================================================

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockRunTransaction = jest.fn();

// Mock Timestamp class
jest.mock('firebase/firestore', () => {
  class MockTimestampClass {
    private _date: Date;

    constructor(seconds: number, nanoseconds: number = 0) {
      this._date = new Date(seconds * 1000 + nanoseconds / 1000000);
    }

    toDate(): Date {
      return this._date;
    }

    toMillis(): number {
      return this._date.getTime();
    }

    static now(): MockTimestampClass {
      return new MockTimestampClass(Date.now() / 1000);
    }

    static fromDate(date: Date): MockTimestampClass {
      return new MockTimestampClass(date.getTime() / 1000);
    }
  }

  return {
    doc: (...args: unknown[]) => mockDoc(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    where: (...args: unknown[]) => mockWhere(...args),
    orderBy: (...args: unknown[]) => mockOrderBy(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
    serverTimestamp: () => ({ _serverTimestamp: true }),
    Timestamp: MockTimestampClass,
  };
});

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
}));

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
      { role: 'dealer' as StaffRole, count: 3, filled: 0 },
      { role: 'manager' as StaffRole, count: 1, filled: 0 },
    ],
    salary: {
      type: 'hourly' as const,
      amount: 15000,
    },
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
    mockDoc.mockReturnValue({ id: 'test-doc-id' });
    mockCollection.mockReturnValue({ id: 'test-collection' });
    mockQuery.mockReturnValue({ query: 'test-query' });
    mockWhere.mockReturnValue({ where: 'test-where' });
    mockOrderBy.mockReturnValue({ orderBy: 'test-orderBy' });
  });

  // ==========================================================================
  // createJobPosting
  // ==========================================================================

  describe('createJobPosting', () => {
    it('should create a job posting successfully', async () => {
      const input = createTestJobPostingInput();
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await createJobPosting(input, 'employer-1', '테스트 구인자');

      // 단일 생성 결과 확인 (배열이 아님)
      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result)) {
        expect(result.id).toBe('test-doc-id');
        expect(result.jobPosting.title).toBe(input.title);
        expect(result.jobPosting.status).toBe('active');
        expect(result.jobPosting.ownerId).toBe('employer-1');
        expect(result.jobPosting.totalPositions).toBe(4); // 3 dealers + 1 manager
      }
    });

    it('should calculate total positions from roles', async () => {
      const input = createTestJobPostingInput();
      input.roles = [
        { role: 'dealer' as StaffRole, count: 5, filled: 0 },
        { role: 'manager' as StaffRole, count: 2, filled: 0 },
        { role: 'chiprunner' as StaffRole, count: 3, filled: 0 },
      ];
      mockSetDoc.mockResolvedValueOnce(undefined);

      const result = await createJobPosting(input, 'employer-1', '테스트 구인자');

      expect(Array.isArray(result)).toBe(false);
      if (!Array.isArray(result)) {
        expect(result.jobPosting.totalPositions).toBe(10);
      }
    });

    it('should initialize counts to zero', async () => {
      const input = createTestJobPostingInput();
      mockSetDoc.mockResolvedValueOnce(undefined);

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
      mockSetDoc.mockRejectedValueOnce(new Error('Firebase error'));

      await expect(
        createJobPosting(input, 'employer-1', '테스트 구인자')
      ).rejects.toThrow();
    });
  });

  // ==========================================================================
  // updateJobPosting
  // ==========================================================================

  describe('updateJobPosting', () => {
    it('should update job posting successfully', async () => {
      const jobPosting = createMockJobPostingData({ id: 'job-1' });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      const result = await updateJobPosting(
        'job-1',
        { title: '수정된 제목' },
        'employer-1'
      );

      expect(result.title).toBe('수정된 제목');
    });

    it('should throw error for non-existent job posting', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => false,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        updateJobPosting('non-existent', { title: '수정' }, 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        updateJobPosting('job-1', { title: '수정' }, 'employer-1')
      ).rejects.toThrow('본인의 공고만 수정할 수 있습니다');
    });

    it('should throw error when modifying schedule with confirmed applicants', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        filledPositions: 2, // has confirmed applicants
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        updateJobPosting(
          'job-1',
          { workDate: '2024-03-01' },
          'employer-1'
        )
      ).rejects.toThrow('확정된 지원자가 있는 경우 일정 및 역할을 수정할 수 없습니다');
    });

    it('should allow title/description change with confirmed applicants', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        filledPositions: 2,
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

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
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        filledPositions: 0,
      });

      let updateCalled = false;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(() => {
            updateCalled = true;
          }),
        };
        return callback(transaction);
      });

      await deleteJobPosting('job-1', 'employer-1');

      expect(updateCalled).toBe(true);
    });

    it('should throw error for non-existent job posting', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => false,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        deleteJobPosting('non-existent', 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        deleteJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('본인의 공고만 삭제할 수 있습니다');
    });

    it('should throw error when deleting with confirmed applicants', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        filledPositions: 2,
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        deleteJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('확정된 지원자가 있는 공고는 삭제할 수 없습니다');
    });
  });

  // ==========================================================================
  // closeJobPosting
  // ==========================================================================

  describe('closeJobPosting', () => {
    it('should close job posting successfully', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        status: 'active',
      });

      let updateCalled = false;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(() => {
            updateCalled = true;
          }),
        };
        return callback(transaction);
      });

      await closeJobPosting('job-1', 'employer-1');

      expect(updateCalled).toBe(true);
    });

    it('should throw error for non-existent job posting', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => false,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        closeJobPosting('non-existent', 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        ownerId: 'other-employer',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        closeJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('본인의 공고만 마감할 수 있습니다');
    });

    it('should throw error if already closed', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        status: 'closed',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        closeJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('이미 마감된 공고입니다');
    });
  });

  // ==========================================================================
  // reopenJobPosting
  // ==========================================================================

  describe('reopenJobPosting', () => {
    it('should reopen closed job posting successfully', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        status: 'closed',
      });

      let updateCalled = false;
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(() => {
            updateCalled = true;
          }),
        };
        return callback(transaction);
      });

      await reopenJobPosting('job-1', 'employer-1');

      expect(updateCalled).toBe(true);
    });

    it('should throw error for non-existent job posting', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => false,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        reopenJobPosting('non-existent', 'employer-1')
      ).rejects.toThrow('존재하지 않는 공고입니다');
    });

    it('should throw error for unauthorized owner', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        ownerId: 'other-employer',
        status: 'closed',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        reopenJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('본인의 공고만 재오픈할 수 있습니다');
    });

    it('should throw error if already active', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        status: 'active',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        reopenJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('이미 활성 상태인 공고입니다');
    });

    it('should throw error for cancelled job posting', async () => {
      const jobPosting = createMockJobPostingData({
        id: 'job-1',
        status: 'cancelled',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValueOnce({
            exists: () => true,
            data: () => jobPosting,
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      await expect(
        reopenJobPosting('job-1', 'employer-1')
      ).rejects.toThrow('삭제된 공고는 재오픈할 수 없습니다');
    });
  });

  // ==========================================================================
  // getMyJobPostingStats
  // ==========================================================================

  describe('getMyJobPostingStats', () => {
    it('should return correct statistics', async () => {
      const jobPostings = [
        createMockJobPostingData({
          id: 'job-1',
          status: 'active',
          applicationCount: 5,
          viewCount: 100,
        }),
        createMockJobPostingData({
          id: 'job-2',
          status: 'active',
          applicationCount: 3,
          viewCount: 50,
        }),
        createMockJobPostingData({
          id: 'job-3',
          status: 'closed',
          applicationCount: 10,
          viewCount: 200,
        }),
        createMockJobPostingData({
          id: 'job-4',
          status: 'cancelled',
          applicationCount: 0,
          viewCount: 20,
        }),
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: jobPostings.map((jp, index) => ({
          id: `job-${index + 1}`,
          data: () => jp,
        })),
      });

      const stats = await getMyJobPostingStats('employer-1');

      expect(stats.total).toBe(4);
      expect(stats.active).toBe(2);
      expect(stats.closed).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.totalApplications).toBe(18); // 5 + 3 + 10 + 0
      expect(stats.totalViews).toBe(370); // 100 + 50 + 200 + 20
    });

    it('should return zero counts for new employer', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
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
      const jobPosting1 = createMockJobPostingData({ id: 'job-1' });
      const jobPosting2 = createMockJobPostingData({ id: 'job-2' });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn((ref) => {
            const id = ref?.id || 'test';
            if (id === 'job-1') {
              return Promise.resolve({
                exists: () => true,
                data: () => jobPosting1,
              });
            }
            if (id === 'job-2') {
              return Promise.resolve({
                exists: () => true,
                data: () => jobPosting2,
              });
            }
            return Promise.resolve({ exists: () => false });
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      mockDoc.mockImplementation((_db, _collection, id) => ({ id }));

      const successCount = await bulkUpdateJobPostingStatus(
        ['job-1', 'job-2'],
        'closed',
        'employer-1'
      );

      expect(successCount).toBe(2);
    });

    it('should only update owned job postings', async () => {
      const ownedJob = createMockJobPostingData({ id: 'job-1' });
      const otherJob = createMockJobPostingData({
        id: 'job-2',
        ownerId: 'other-employer',
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn((ref) => {
            const id = ref?.id || 'test';
            if (id === 'job-1') {
              return Promise.resolve({
                exists: () => true,
                data: () => ownedJob,
              });
            }
            if (id === 'job-2') {
              return Promise.resolve({
                exists: () => true,
                data: () => otherJob,
              });
            }
            return Promise.resolve({ exists: () => false });
          }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      mockDoc.mockImplementation((_db, _collection, id) => ({ id }));

      const successCount = await bulkUpdateJobPostingStatus(
        ['job-1', 'job-2'],
        'closed',
        'employer-1'
      );

      // Only job-1 should be updated (owned by employer-1)
      expect(successCount).toBe(1);
    });

    it('should handle non-existent job postings', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({ exists: () => false }),
          update: jest.fn(),
        };
        return callback(transaction);
      });

      mockDoc.mockImplementation((_db, _collection, id) => ({ id }));

      const successCount = await bulkUpdateJobPostingStatus(
        ['non-existent-1', 'non-existent-2'],
        'closed',
        'employer-1'
      );

      expect(successCount).toBe(0);
    });
  });
});
