/**
 * UNIQN Mobile - Application Service Tests
 *
 * @description 지원 서비스 테스트
 * @version 1.0.0
 */

import * as firestoreModule from 'firebase/firestore';
import {
  applyToJob,
  getMyApplications,
  getApplicationById,
  cancelApplication,
  hasAppliedToJob,
  getApplicationStats,
} from '../applicationService';
import {
  AlreadyAppliedError,
  ApplicationClosedError,
  MaxCapacityReachedError,
} from '@/errors';

// Mock Firebase modules
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({})),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  runTransaction: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
  increment: jest.fn((n) => n),
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

const mockRunTransaction = firestoreModule.runTransaction as jest.Mock;
const mockCollection = firestoreModule.collection as jest.Mock;
const mockDoc = firestoreModule.doc as jest.Mock;
const mockGetDoc = firestoreModule.getDoc as jest.Mock;
const mockGetDocs = firestoreModule.getDocs as jest.Mock;

describe('ApplicationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue({});
    mockCollection.mockReturnValue({});
  });

  describe('applyToJob', () => {
    const validInput = {
      jobPostingId: 'job-1',
      appliedRole: 'dealer' as const,
      message: '지원합니다',
    };
    const applicantId = 'user-1';
    const applicantName = '테스트 유저';
    const applicantPhone = '010-1234-5678';

    const mockJobData = {
      id: 'job-1',
      title: '테스트 공고',
      status: 'active',
      applicationCount: 0,
      totalPositions: 10,
      workDate: '2025-01-01',
    };

    it('should create application successfully', async () => {
      const mockTransactionGet = jest.fn()
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockJobData,
        })
        .mockResolvedValueOnce({
          exists: () => false,
        });

      const mockTransactionSet = jest.fn();
      const mockTransactionUpdate = jest.fn();

      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: mockTransactionGet,
          set: mockTransactionSet,
          update: mockTransactionUpdate,
        };
        return callback(transaction);
      });

      const result = await applyToJob(
        validInput,
        applicantId,
        applicantName,
        applicantPhone
      );

      expect(result).toBeDefined();
      expect(result.applicantId).toBe(applicantId);
      expect(result.status).toBe('applied');
      expect(mockTransactionSet).toHaveBeenCalled();
      expect(mockTransactionUpdate).toHaveBeenCalled();
    });

    it('should throw ApplicationClosedError when job posting does not exist', async () => {
      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => false,
          }),
        };
        return callback(transaction);
      });

      await expect(
        applyToJob(validInput, applicantId, applicantName)
      ).rejects.toThrow(ApplicationClosedError);
    });

    it('should throw ApplicationClosedError when job is not active', async () => {
      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ ...mockJobData, status: 'closed' }),
          }),
        };
        return callback(transaction);
      });

      await expect(
        applyToJob(validInput, applicantId, applicantName)
      ).rejects.toThrow(ApplicationClosedError);
    });

    it('should throw MaxCapacityReachedError when job is full', async () => {
      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              ...mockJobData,
              applicationCount: 10,
              totalPositions: 10,
            }),
          }),
        };
        return callback(transaction);
      });

      await expect(
        applyToJob(validInput, applicantId, applicantName)
      ).rejects.toThrow(MaxCapacityReachedError);
    });

    it('should throw AlreadyAppliedError when already applied', async () => {
      const mockTransactionGet = jest.fn()
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => mockJobData,
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'job-1_user-1',
          data: () => ({ status: 'applied' }),
        });

      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: mockTransactionGet,
        };
        return callback(transaction);
      });

      await expect(
        applyToJob(validInput, applicantId, applicantName)
      ).rejects.toThrow(AlreadyAppliedError);
    });
  });

  describe('getMyApplications', () => {
    const applicantId = 'user-1';

    it('should return empty array when no applications', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await getMyApplications(applicantId);

      expect(result).toEqual([]);
    });

    it('should return applications with job data', async () => {
      const mockApplicationDoc = {
        id: 'app-1',
        data: () => ({
          applicantId,
          jobPostingId: 'job-1',
          status: 'applied',
        }),
      };

      const mockJobDoc = {
        id: 'job-1',
        exists: () => true,
        data: () => ({
          title: '테스트 공고',
          location: '서울',
        }),
      };

      mockGetDocs.mockResolvedValue({ docs: [mockApplicationDoc] });
      mockGetDoc.mockResolvedValue(mockJobDoc);

      const result = await getMyApplications(applicantId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('app-1');
      expect(result[0].jobPosting).toBeDefined();
    });

    it('should return applications without job data when job not found', async () => {
      const mockApplicationDoc = {
        id: 'app-1',
        data: () => ({
          applicantId,
          jobPostingId: 'job-1',
          status: 'applied',
        }),
      };

      mockGetDocs.mockResolvedValue({ docs: [mockApplicationDoc] });
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getMyApplications(applicantId);

      expect(result).toHaveLength(1);
      expect(result[0].jobPosting).toBeUndefined();
    });
  });

  describe('getApplicationById', () => {
    it('should return null when application not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getApplicationById('non-existent');

      expect(result).toBeNull();
    });

    it('should return application with job data', async () => {
      mockGetDoc
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'app-1',
          data: () => ({
            applicantId: 'user-1',
            jobPostingId: 'job-1',
            status: 'applied',
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'job-1',
          data: () => ({
            title: '테스트 공고',
          }),
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
      const mockTransactionGet = jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({
          applicantId,
          jobPostingId: 'job-1',
          status: 'applied',
        }),
      });

      const mockTransactionUpdate = jest.fn();

      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: mockTransactionGet,
          update: mockTransactionUpdate,
        };
        return callback(transaction);
      });

      await expect(
        cancelApplication(applicationId, applicantId)
      ).resolves.not.toThrow();

      expect(mockTransactionUpdate).toHaveBeenCalledTimes(2);
    });

    it('should throw error when application not found', async () => {
      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => false,
          }),
        };
        return callback(transaction);
      });

      await expect(
        cancelApplication(applicationId, applicantId)
      ).rejects.toThrow();
    });

    it('should throw error when not the applicant', async () => {
      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              applicantId: 'other-user',
              status: 'applied',
            }),
          }),
        };
        return callback(transaction);
      });

      await expect(
        cancelApplication(applicationId, applicantId)
      ).rejects.toThrow();
    });

    it('should throw error when already cancelled', async () => {
      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              applicantId,
              status: 'cancelled',
            }),
          }),
        };
        return callback(transaction);
      });

      await expect(
        cancelApplication(applicationId, applicantId)
      ).rejects.toThrow();
    });

    it('should throw error when confirmed', async () => {
      mockRunTransaction.mockImplementation(async (_, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              applicantId,
              status: 'confirmed',
            }),
          }),
        };
        return callback(transaction);
      });

      await expect(
        cancelApplication(applicationId, applicantId)
      ).rejects.toThrow();
    });
  });

  describe('hasAppliedToJob', () => {
    it('should return false when not applied', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return true when applied', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'applied' }),
      });

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should return false when cancelled', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'cancelled' }),
      });

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await hasAppliedToJob('job-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('getApplicationStats', () => {
    const applicantId = 'user-1';

    it('should return zero counts when no applications', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const result = await getApplicationStats(applicantId);

      expect(result.applied).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.rejected).toBe(0);
      expect(result.cancelled).toBe(0);
    });

    it('should count applications by status', async () => {
      const mockDocs = [
        { id: 'app-1', data: () => ({ applicantId, jobPostingId: 'job-1', status: 'applied' }) },
        { id: 'app-2', data: () => ({ applicantId, jobPostingId: 'job-2', status: 'applied' }) },
        { id: 'app-3', data: () => ({ applicantId, jobPostingId: 'job-3', status: 'confirmed' }) },
        { id: 'app-4', data: () => ({ applicantId, jobPostingId: 'job-4', status: 'cancelled' }) },
      ];

      mockGetDocs.mockResolvedValue({ docs: mockDocs });
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await getApplicationStats(applicantId);

      expect(result.applied).toBe(2);
      expect(result.confirmed).toBe(1);
      expect(result.cancelled).toBe(1);
    });
  });
});
