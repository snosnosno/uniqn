/**
 * UNIQN Mobile - Job Service Tests
 *
 * @description 구인공고 서비스 테스트
 * @version 1.0.0
 */

// ============================================================================
// Mocks (jest.mock is hoisted, so use inline factory functions)
// ============================================================================

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    getList: jest.fn(),
    getById: jest.fn(),
    incrementViewCount: jest.fn(),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
  isPerformanceAvailable: jest.fn(() => false),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
  handleSilentError: jest.fn(),
}));

const mockTrace = {
  putAttribute: jest.fn(),
  putMetric: jest.fn(),
  stop: jest.fn(),
  start: jest.fn(),
};

jest.mock('@/services/performanceService', () => ({
  startApiTrace: jest.fn(() => mockTrace),
}));

jest.mock('@/types', () => ({
  toJobPostingCard: jest.fn((posting: unknown) => ({
    ...(posting as Record<string, unknown>),
    _isCard: true,
  })),
}));

// Note: searchJobPostings uses dynamic `await import('./searchService')`.
// Jest node environment does not support --experimental-vm-modules,
// so dynamic import tests are limited to error propagation scenarios.

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  getJobPostings,
  getJobPostingById,
  incrementViewCount,
  searchJobPostings,
  getUrgentJobPostings,
  getMyJobPostings,
  convertToCard,
} from '../jobService';
import { jobPostingRepository } from '@/repositories';
import { handleServiceError, handleSilentError } from '@/errors/serviceErrorHandler';
import { startApiTrace } from '@/services/performanceService';
import { toJobPostingCard } from '@/types';

// Get typed mock references
const mockRepo = jobPostingRepository as jest.Mocked<typeof jobPostingRepository>;
const mockHandleServiceError = handleServiceError as jest.Mock;
const mockHandleSilentError = handleSilentError as jest.Mock;
const mockStartApiTrace = startApiTrace as jest.Mock;
const mockToJobPostingCard = toJobPostingCard as jest.Mock;

// ============================================================================
// Test Data Helpers
// ============================================================================

function createMockJobPosting(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    title: '테스트 공고',
    description: '테스트 설명',
    location: { name: '서울 강남구', address: '서울시 강남구 테헤란로 123' },
    ownerName: '테스트 업주',
    ownerId: 'owner-1',
    status: 'active',
    isUrgent: false,
    roles: [{ role: 'dealer', count: 2, salary: { type: 'daily', amount: 150000 } }],
    applicantCount: 0,
    maxApplicants: 10,
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    updatedAt: { seconds: 1700000000, nanoseconds: 0 },
    ...overrides,
  };
}

function createMockPaginatedResult(items: unknown[], hasMore = false) {
  return {
    items,
    hasMore,
    lastDoc: items.length > 0 ? { id: 'last-doc' } : null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('JobService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartApiTrace.mockReturnValue(mockTrace);
    mockHandleServiceError.mockImplementation((error: unknown) => {
      if (error instanceof Error) return error;
      return new Error(String(error));
    });
  });

  // ==========================================================================
  // getJobPostings
  // ==========================================================================
  describe('getJobPostings', () => {
    it('should return paginated job postings from repository', async () => {
      const mockJobs = [
        createMockJobPosting({ id: 'job-1' }),
        createMockJobPosting({ id: 'job-2' }),
      ];
      const mockResult = createMockPaginatedResult(mockJobs, true);
      mockRepo.getList.mockResolvedValue(mockResult as any);

      const result = await getJobPostings();

      expect(mockRepo.getList).toHaveBeenCalledWith(undefined, 20, undefined);
      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    it('should pass filters and custom page size', async () => {
      const mockResult = createMockPaginatedResult([]);
      mockRepo.getList.mockResolvedValue(mockResult as any);
      const filters = { status: 'active' as const };

      await getJobPostings(filters, 10);

      expect(mockRepo.getList).toHaveBeenCalledWith(filters, 10, undefined);
    });

    it('should pass lastDocument for pagination', async () => {
      const mockResult = createMockPaginatedResult([]);
      mockRepo.getList.mockResolvedValue(mockResult as any);
      const lastDoc = { id: 'cursor-doc' } as any;

      await getJobPostings(undefined, 20, lastDoc);

      expect(mockRepo.getList).toHaveBeenCalledWith(undefined, 20, lastDoc);
    });

    it('should track performance with trace', async () => {
      const mockResult = createMockPaginatedResult([createMockJobPosting()]);
      mockRepo.getList.mockResolvedValue(mockResult as any);

      await getJobPostings({ status: 'active' as const }, 15);

      expect(mockStartApiTrace).toHaveBeenCalledWith('getJobPostings');
      expect(mockTrace.putAttribute).toHaveBeenCalledWith('pageSize', '15');
      expect(mockTrace.putAttribute).toHaveBeenCalledWith('filter_status', 'active');
      expect(mockTrace.putMetric).toHaveBeenCalledWith('result_count', 1);
      expect(mockTrace.putAttribute).toHaveBeenCalledWith('status', 'success');
      expect(mockTrace.stop).toHaveBeenCalled();
    });

    it('should not put filter_status attribute when no status filter', async () => {
      const mockResult = createMockPaginatedResult([]);
      mockRepo.getList.mockResolvedValue(mockResult as any);

      await getJobPostings();

      const putAttributeCalls = mockTrace.putAttribute.mock.calls;
      const filterStatusCalls = putAttributeCalls.filter(
        (call: string[]) => call[0] === 'filter_status'
      );
      expect(filterStatusCalls).toHaveLength(0);
    });

    it('should set error trace on failure', async () => {
      const error = new Error('Query failed');
      mockRepo.getList.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getJobPostings()).rejects.toThrow('Query failed');

      expect(mockTrace.putAttribute).toHaveBeenCalledWith('status', 'error');
      expect(mockTrace.stop).toHaveBeenCalled();
    });

    it('should return empty items when no postings found', async () => {
      const mockResult = createMockPaginatedResult([], false);
      mockRepo.getList.mockResolvedValue(mockResult as any);

      const result = await getJobPostings();

      expect(result.items).toEqual([]);
      expect(result.hasMore).toBe(false);
    });
  });

  // ==========================================================================
  // getJobPostingById
  // ==========================================================================
  describe('getJobPostingById', () => {
    it('should return job posting by id', async () => {
      const mockJob = createMockJobPosting();
      mockRepo.getById.mockResolvedValue(mockJob as any);

      const result = await getJobPostingById('job-1');

      expect(mockRepo.getById).toHaveBeenCalledWith('job-1');
      expect(result).toEqual(mockJob);
    });

    it('should return null when job posting not found', async () => {
      mockRepo.getById.mockResolvedValue(null);

      const result = await getJobPostingById('non-existent');

      expect(result).toBeNull();
    });

    it('should track performance with trace on success', async () => {
      const mockJob = createMockJobPosting({ title: '딜러 구인' });
      mockRepo.getById.mockResolvedValue(mockJob as any);

      await getJobPostingById('job-1');

      expect(mockStartApiTrace).toHaveBeenCalledWith('getJobPostingById');
      expect(mockTrace.putAttribute).toHaveBeenCalledWith('jobId', 'job-1');
      expect(mockTrace.putAttribute).toHaveBeenCalledWith('status', 'success');
      expect(mockTrace.stop).toHaveBeenCalled();
    });

    it('should set not_found trace status when job not found', async () => {
      mockRepo.getById.mockResolvedValue(null);

      await getJobPostingById('job-missing');

      expect(mockTrace.putAttribute).toHaveBeenCalledWith('status', 'not_found');
      expect(mockTrace.stop).toHaveBeenCalled();
    });

    it('should set error trace on failure', async () => {
      const error = new Error('DB error');
      mockRepo.getById.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getJobPostingById('job-1')).rejects.toThrow('DB error');

      expect(mockTrace.putAttribute).toHaveBeenCalledWith('status', 'error');
      expect(mockTrace.stop).toHaveBeenCalled();
    });

    it('should propagate errors via handleServiceError', async () => {
      const error = new Error('Firestore error');
      mockRepo.getById.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getJobPostingById('job-1')).rejects.toThrow('Firestore error');
      expect(mockHandleServiceError).toHaveBeenCalledWith(error, {
        operation: '공고 상세 조회',
        component: 'jobService',
        context: { jobPostingId: 'job-1' },
      });
    });
  });

  // ==========================================================================
  // incrementViewCount
  // ==========================================================================
  describe('incrementViewCount', () => {
    it('should increment view count via repository', async () => {
      mockRepo.incrementViewCount.mockResolvedValue(undefined);

      await incrementViewCount('job-1');

      expect(mockRepo.incrementViewCount).toHaveBeenCalledWith('job-1');
    });

    it('should silently handle errors (not throw)', async () => {
      mockRepo.incrementViewCount.mockRejectedValue(new Error('Update failed'));

      await expect(incrementViewCount('job-1')).resolves.toBeUndefined();

      expect(mockHandleSilentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: '조회수 증가',
          component: 'jobService',
        })
      );
    });

    it('should not propagate errors to caller', async () => {
      mockRepo.incrementViewCount.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await incrementViewCount('job-1');
    });
  });

  // ==========================================================================
  // searchJobPostings
  // ==========================================================================
  describe('searchJobPostings', () => {
    // Note: searchJobPostings uses dynamic `await import('./searchService')` internally.
    // Jest node environment does not support ESM dynamic imports (requires --experimental-vm-modules).
    // The dynamic import throws a TypeError which is caught and handled by handleServiceError.

    it('should propagate dynamic import errors via handleServiceError', async () => {
      const dynamicImportError = new Error('Dynamic import not supported');
      mockHandleServiceError.mockReturnValue(dynamicImportError);

      await expect(searchJobPostings('test')).rejects.toThrow();

      expect(mockHandleServiceError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          operation: '공고 검색',
          component: 'jobService',
          context: { searchTerm: 'test' },
        })
      );
    });

    it('should pass search term in error context', async () => {
      const error = new Error('Search error');
      mockHandleServiceError.mockReturnValue(error);

      await expect(searchJobPostings('딜러 구인')).rejects.toThrow();

      expect(mockHandleServiceError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          context: { searchTerm: '딜러 구인' },
        })
      );
    });
  });

  // ==========================================================================
  // getUrgentJobPostings
  // ==========================================================================
  describe('getUrgentJobPostings', () => {
    it('should return urgent job postings with default page size', async () => {
      const urgentJobs = [
        createMockJobPosting({ id: 'urgent-1', isUrgent: true }),
        createMockJobPosting({ id: 'urgent-2', isUrgent: true }),
      ];
      mockRepo.getList.mockResolvedValue(createMockPaginatedResult(urgentJobs) as any);

      const result = await getUrgentJobPostings();

      expect(mockRepo.getList).toHaveBeenCalledWith(
        { status: 'active', isUrgent: true },
        10,
        undefined
      );
      expect(result).toHaveLength(2);
    });

    it('should use custom page size', async () => {
      mockRepo.getList.mockResolvedValue(createMockPaginatedResult([]) as any);

      await getUrgentJobPostings(5);

      expect(mockRepo.getList).toHaveBeenCalledWith(
        { status: 'active', isUrgent: true },
        5,
        undefined
      );
    });

    it('should return empty array when no urgent postings', async () => {
      mockRepo.getList.mockResolvedValue(createMockPaginatedResult([]) as any);

      const result = await getUrgentJobPostings();

      expect(result).toEqual([]);
    });

    it('should propagate errors', async () => {
      const error = new Error('Urgent query failed');
      mockRepo.getList.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getUrgentJobPostings()).rejects.toThrow('Urgent query failed');
    });
  });

  // ==========================================================================
  // getMyJobPostings
  // ==========================================================================
  describe('getMyJobPostings', () => {
    it('should return all active and closed postings when includeAll is true (default)', async () => {
      const activeJobs = [createMockJobPosting({ id: 'active-1', status: 'active' })];
      const closedJobs = [createMockJobPosting({ id: 'closed-1', status: 'closed' })];

      mockRepo.getList
        .mockResolvedValueOnce(createMockPaginatedResult(activeJobs) as any)
        .mockResolvedValueOnce(createMockPaginatedResult(closedJobs) as any);

      const result = await getMyJobPostings('owner-1');

      expect(result).toHaveLength(2);
      expect(mockRepo.getList).toHaveBeenCalledTimes(2);
    });

    it('should merge active and closed postings results', async () => {
      const activeJobs = [
        createMockJobPosting({ id: 'a1', status: 'active' }),
        createMockJobPosting({ id: 'a2', status: 'active' }),
      ];
      const closedJobs = [createMockJobPosting({ id: 'c1', status: 'closed' })];

      mockRepo.getList
        .mockResolvedValueOnce(createMockPaginatedResult(activeJobs) as any)
        .mockResolvedValueOnce(createMockPaginatedResult(closedJobs) as any);

      const result = await getMyJobPostings('owner-1');

      expect(result).toHaveLength(3);
    });

    it('should filter by specific status when provided', async () => {
      const activeJobs = [createMockJobPosting({ id: 'a1', status: 'active' })];
      mockRepo.getList.mockResolvedValue(createMockPaginatedResult(activeJobs) as any);

      await getMyJobPostings('owner-1', { status: 'active' as any });

      expect(mockRepo.getList).toHaveBeenCalledTimes(1);
      expect(mockRepo.getList).toHaveBeenCalledWith(
        { ownerId: 'owner-1', status: 'active' },
        100,
        undefined
      );
    });

    it('should use active status as default when includeAll is false', async () => {
      mockRepo.getList.mockResolvedValue(createMockPaginatedResult([]) as any);

      await getMyJobPostings('owner-1', { includeAll: false });

      expect(mockRepo.getList).toHaveBeenCalledTimes(1);
      expect(mockRepo.getList).toHaveBeenCalledWith(
        { ownerId: 'owner-1', status: 'active' },
        100,
        undefined
      );
    });

    it('should only fetch specific status when both status and includeAll are set', async () => {
      mockRepo.getList.mockResolvedValue(createMockPaginatedResult([]) as any);

      await getMyJobPostings('owner-1', { status: 'closed' as any, includeAll: true });

      expect(mockRepo.getList).toHaveBeenCalledTimes(1);
      expect(mockRepo.getList).toHaveBeenCalledWith(
        { ownerId: 'owner-1', status: 'closed' },
        100,
        undefined
      );
    });

    it('should return empty array when no postings found', async () => {
      mockRepo.getList
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any)
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any);

      const result = await getMyJobPostings('owner-1');

      expect(result).toEqual([]);
    });

    it('should propagate errors via handleServiceError', async () => {
      const error = new Error('My postings failed');
      mockRepo.getList.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getMyJobPostings('owner-1')).rejects.toThrow('My postings failed');
      expect(mockHandleServiceError).toHaveBeenCalledWith(error, {
        operation: '내 공고 조회',
        component: 'jobService',
        context: { ownerId: 'owner-1' },
      });
    });

    it('should handle no options parameter', async () => {
      mockRepo.getList
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any)
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any);

      const result = await getMyJobPostings('owner-1');

      expect(result).toEqual([]);
      // Default includeAll = true, no status => fetches both active and closed
      expect(mockRepo.getList).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // convertToCard
  // ==========================================================================
  describe('convertToCard', () => {
    it('should convert job posting to card format', () => {
      const mockJob = createMockJobPosting();

      const result = convertToCard(mockJob as any);

      expect(mockToJobPostingCard).toHaveBeenCalledWith(mockJob);
      expect(result).toEqual(expect.objectContaining({ _isCard: true }));
    });

    it('should delegate to toJobPostingCard function', () => {
      const mockJob = createMockJobPosting({ title: '특별 공고' });

      convertToCard(mockJob as any);

      expect(mockToJobPostingCard).toHaveBeenCalledTimes(1);
      expect(mockToJobPostingCard).toHaveBeenCalledWith(mockJob);
    });

    it('should return the result from toJobPostingCard directly', () => {
      const mockJob = createMockJobPosting({ id: 'card-test' });
      const expectedCard = { id: 'card-test', _isCard: true, title: '테스트 공고' };
      mockToJobPostingCard.mockReturnValueOnce(expectedCard);

      const result = convertToCard(mockJob as any);

      expect(result).toBe(expectedCard);
    });
  });

  // ==========================================================================
  // getJobPostings - additional edge cases
  // ==========================================================================
  describe('getJobPostings - additional edge cases', () => {
    it('should handle filters with undefined status gracefully', async () => {
      const mockResult = createMockPaginatedResult([]);
      mockRepo.getList.mockResolvedValue(mockResult as any);

      await getJobPostings({ ownerId: 'owner-1' } as any, 20);

      expect(mockRepo.getList).toHaveBeenCalledWith({ ownerId: 'owner-1' }, 20, undefined);
      // Should not set filter_status since status is undefined
      const putAttributeCalls = mockTrace.putAttribute.mock.calls;
      const filterStatusCalls = putAttributeCalls.filter(
        (call: string[]) => call[0] === 'filter_status'
      );
      expect(filterStatusCalls).toHaveLength(0);
    });

    it('should always call trace.stop even on success', async () => {
      const mockResult = createMockPaginatedResult([createMockJobPosting()]);
      mockRepo.getList.mockResolvedValue(mockResult as any);

      await getJobPostings();

      expect(mockTrace.stop).toHaveBeenCalledTimes(1);
    });

    it('should always call trace.stop even on error', async () => {
      const error = new Error('Failure');
      mockRepo.getList.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getJobPostings()).rejects.toThrow();

      expect(mockTrace.stop).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // getJobPostingById - additional edge cases
  // ==========================================================================
  describe('getJobPostingById - additional edge cases', () => {
    it('should always call trace.stop on success path', async () => {
      const mockJob = createMockJobPosting();
      mockRepo.getById.mockResolvedValue(mockJob as any);

      await getJobPostingById('job-1');

      expect(mockTrace.stop).toHaveBeenCalledTimes(1);
    });

    it('should always call trace.stop on not found path', async () => {
      mockRepo.getById.mockResolvedValue(null);

      await getJobPostingById('missing');

      expect(mockTrace.stop).toHaveBeenCalledTimes(1);
    });

    it('should always call trace.stop on error path', async () => {
      const error = new Error('Fail');
      mockRepo.getById.mockRejectedValue(error);
      mockHandleServiceError.mockReturnValue(error);

      await expect(getJobPostingById('bad')).rejects.toThrow();

      expect(mockTrace.stop).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // incrementViewCount - additional edge cases
  // ==========================================================================
  describe('incrementViewCount - additional edge cases', () => {
    it('should pass logLevel warn in silent error options', async () => {
      mockRepo.incrementViewCount.mockRejectedValue(new Error('Fail'));

      await incrementViewCount('job-1');

      expect(mockHandleSilentError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          logLevel: 'warn',
          context: { jobPostingId: 'job-1' },
        })
      );
    });
  });

  // ==========================================================================
  // getMyJobPostings - additional edge cases
  // ==========================================================================
  describe('getMyJobPostings - additional edge cases', () => {
    it('should pass ownerId in both queries when includeAll', async () => {
      mockRepo.getList
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any)
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any);

      await getMyJobPostings('owner-123');

      const calls = mockRepo.getList.mock.calls;
      expect(calls[0][0]).toEqual(expect.objectContaining({ ownerId: 'owner-123' }));
      expect(calls[1][0]).toEqual(expect.objectContaining({ ownerId: 'owner-123' }));
    });

    it('should request active and closed statuses when includeAll', async () => {
      mockRepo.getList
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any)
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any);

      await getMyJobPostings('owner-1');

      const calls = mockRepo.getList.mock.calls;
      expect(calls[0][0]).toEqual(expect.objectContaining({ status: 'active' }));
      expect(calls[1][0]).toEqual(expect.objectContaining({ status: 'closed' }));
    });

    it('should use page size 100 for all my postings queries', async () => {
      mockRepo.getList
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any)
        .mockResolvedValueOnce(createMockPaginatedResult([]) as any);

      await getMyJobPostings('owner-1');

      const calls = mockRepo.getList.mock.calls;
      expect(calls[0][1]).toBe(100);
      expect(calls[1][1]).toBe(100);
    });
  });
});
