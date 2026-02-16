/**
 * UNIQN Mobile - Application History Service Tests
 *
 * @description 지원서 이력 관리 서비스 테스트 (confirmationHistory 기반)
 * @version 1.0.0
 */

// ============================================================================
// Mocks
// ============================================================================

// Firebase Firestore mocks
const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
};

const mockRunTransaction = jest.fn(
  async (_db: unknown, fn: (tx: typeof mockTransaction) => Promise<unknown>) => {
    return fn(mockTransaction);
  }
);

const mockGetDoc = jest.fn();
const mockDoc = jest.fn((_db: unknown, ...pathSegments: string[]) => ({
  id: pathSegments[pathSegments.length - 1] || 'mock-doc-id',
  path: pathSegments.join('/'),
}));
const mockCollection = jest.fn((_db: unknown, path: string) => ({ path }));
const mockServerTimestamp = jest.fn(() => ({ _serverTimestamp: true }));
const mockIncrement = jest.fn((n: number) => ({ _increment: n }));

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(args[0], args[1] as string),
  doc: (...args: unknown[]) => mockDoc(args[0], ...(args.slice(1) as string[])),
  getDoc: (...args: unknown[]) => mockGetDoc(args[0]),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runTransaction: (...args: unknown[]) => mockRunTransaction(args[0], args[1] as any),
  serverTimestamp: () => mockServerTimestamp(),
  increment: (n: number) => mockIncrement(n),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1700000000, nanoseconds: 0, toDate: () => new Date() })),
    fromDate: jest.fn((d: Date) => ({
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => d,
    })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockParseApplicationDocument = jest.fn();
const mockParseJobPostingDocument = jest.fn();

jest.mock('@/schemas', () => ({
  parseApplicationDocument: (...args: unknown[]) => mockParseApplicationDocument(...args),
  parseJobPostingDocument: (...args: unknown[]) => mockParseJobPostingDocument(...args),
}));

jest.mock('@/utils/job-posting/dateUtils', () => ({
  getClosingStatus: jest.fn(() => ({ total: 10, filled: 2 })),
}));

jest.mock('@/domains/schedule', () => {
  const extractStartTime = jest.fn(() => '18:00');
  const createTimestampFromDateTime = jest.fn(() => ({
    seconds: 1700000000,
    nanoseconds: 0,
  }));

  return {
    WorkLogCreator: {
      extractStartTime,
      createTimestampFromDateTime,
    },
  };
});

jest.mock('@/types', () => ({
  createHistoryEntry: jest.fn((assignments: unknown[], confirmedBy: string) => ({
    confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
    assignments,
    confirmedBy,
  })),
  addCancellationToEntry: jest.fn(
    (entry: Record<string, unknown>, reason: string, cancelledBy: string) => ({
      ...entry,
      cancelledAt: { seconds: 1700000000, nanoseconds: 0 },
      cancelReason: reason,
      cancelledBy,
    })
  ),
  findActiveConfirmation: jest.fn(),
}));

jest.mock('@/types/jobPosting/dateRequirement', () => ({
  getDateString: jest.fn((date: unknown) => {
    if (typeof date === 'string') return date;
    return '2025-01-20';
  }),
}));

jest.mock('@/errors', () => {
  class MockAppError extends Error {
    code: string;
    userMessage: string;
    constructor(message: string) {
      super(message);
      this.code = 'E0000';
      this.userMessage = message;
    }
  }
  class MockValidationError extends MockAppError {
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage ?? 'Validation error');
      this.name = 'ValidationError';
      this.code = code;
    }
  }
  class MockBusinessError extends MockAppError {
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage ?? 'Business error');
      this.name = 'BusinessError';
      this.code = code;
    }
  }
  class MockMaxCapacityReachedError extends MockBusinessError {
    constructor(options?: {
      userMessage?: string;
      jobPostingId?: string;
      maxCapacity?: number;
      currentCount?: number;
    }) {
      super('E6003', { userMessage: options?.userMessage ?? 'Max capacity' });
      this.name = 'MaxCapacityReachedError';
    }
  }

  return {
    ValidationError: MockValidationError,
    BusinessError: MockBusinessError,
    MaxCapacityReachedError: MockMaxCapacityReachedError,
    ERROR_CODES: {
      VALIDATION_REQUIRED: 'E3001',
      VALIDATION_SCHEMA: 'E3003',
      SECURITY_UNAUTHORIZED_ACCESS: 'E5002',
      BUSINESS_INVALID_WORKLOG: 'E6006',
      UNKNOWN: 'E7001',
    },
    isAppError: jest.fn((e: unknown) => {
      return e instanceof Error && 'code' in e;
    }),
  };
});

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    APPLICATIONS: 'applications',
    JOB_POSTINGS: 'jobPostings',
    WORK_LOGS: 'workLogs',
  },
  STATUS: {
    APPLICATION: {
      CONFIRMED: 'confirmed',
      APPLIED: 'applied',
    },
    WORK_LOG: {
      SCHEDULED: 'scheduled',
    },
    ATTENDANCE: {
      NOT_STARTED: 'not_started',
    },
    JOB_POSTING: {
      CLOSED: 'closed',
      ACTIVE: 'active',
    },
  },
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import {
  confirmApplicationWithHistory,
  cancelConfirmation,
  getOriginalApplicationData,
  getConfirmedSelections,
  isV2Application,
  getApplicationHistorySummary,
  updateDateSpecificRequirementsFilled,
} from '../applicationHistoryService';
import { findActiveConfirmation } from '@/types';
import { getClosingStatus } from '@/utils/job-posting/dateUtils';
import { WorkLogCreator } from '@/domains/schedule';

const mockFindActiveConfirmation = findActiveConfirmation as jest.Mock;
const mockGetClosingStatus = getClosingStatus as jest.Mock;
const mockExtractStartTime = WorkLogCreator.extractStartTime as jest.Mock;

// ============================================================================
// Test Helpers
// ============================================================================

function createDocSnapshot(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
  };
}

function createMockApplicationData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    applicantId: 'staff-1',
    applicantName: '홍길동',
    jobPostingId: 'job-1',
    status: 'applied',
    assignments: [
      {
        roleIds: ['dealer'],
        dates: ['2025-01-20'],
        timeSlot: '18:00~02:00',
      },
    ],
    confirmationHistory: [],
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    ...overrides,
  };
}

function createMockJobData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    title: '테스트 공고',
    ownerId: 'owner-1',
    status: 'active',
    roles: [
      { role: 'dealer', count: 3, filled: 1 },
      { role: 'floor', count: 2, filled: 0 },
    ],
    filledPositions: 1,
    dateSpecificRequirements: undefined,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ApplicationHistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindActiveConfirmation.mockReturnValue(null);
    mockGetClosingStatus.mockReturnValue({ total: 10, filled: 2 });

    // Default: doc() returns sequential ids for worklog refs
    let docCallCount = 0;
    mockDoc.mockImplementation((_db: unknown, ...pathSegments: string[]) => ({
      id:
        pathSegments.length > 0
          ? pathSegments[pathSegments.length - 1]
          : `wl-auto-${++docCallCount}`,
      path: pathSegments.join('/'),
    }));
  });

  // ==========================================================================
  // updateDateSpecificRequirementsFilled
  // ==========================================================================
  describe('updateDateSpecificRequirementsFilled', () => {
    it('should return undefined when requirements is undefined', () => {
      const result = updateDateSpecificRequirementsFilled(undefined, [], 'increment');
      expect(result).toBeUndefined();
    });

    it('should return empty array when requirements is empty', () => {
      const result = updateDateSpecificRequirementsFilled([], [], 'increment');
      expect(result).toEqual([]);
    });

    it('should increment filled count for matching assignments', () => {
      mockExtractStartTime.mockReturnValue('18:00');

      const requirements = [
        {
          date: '2025-01-20',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 3, filled: 1 }],
            },
          ],
        },
      ];

      const assignments = [
        {
          roleIds: ['dealer'],
          dates: ['2025-01-20'],
          timeSlot: '18:00~02:00',
        },
      ];

      const result = updateDateSpecificRequirementsFilled(
        requirements as any,
        assignments as any,
        'increment'
      );

      expect(result![0].timeSlots[0].roles[0].filled).toBe(2);
    });

    it('should decrement filled count and not go below 0', () => {
      mockExtractStartTime.mockReturnValue('18:00');

      const requirements = [
        {
          date: '2025-01-20',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 3, filled: 0 }],
            },
          ],
        },
      ];

      const assignments = [
        {
          roleIds: ['dealer'],
          dates: ['2025-01-20'],
          timeSlot: '18:00~02:00',
        },
      ];

      const result = updateDateSpecificRequirementsFilled(
        requirements as any,
        assignments as any,
        'decrement'
      );

      expect(result![0].timeSlots[0].roles[0].filled).toBe(0);
    });

    it('should handle assignment without role', () => {
      const requirements = [
        {
          date: '2025-01-20',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 3, filled: 1 }],
            },
          ],
        },
      ];

      const assignments = [
        {
          roleIds: [],
          dates: ['2025-01-20'],
          timeSlot: '18:00~02:00',
        },
      ];

      const result = updateDateSpecificRequirementsFilled(
        requirements as any,
        assignments as any,
        'increment'
      );

      // filled should remain unchanged since no valid role
      expect(result![0].timeSlots[0].roles[0].filled).toBe(1);
    });

    it('should not mutate the original requirements', () => {
      mockExtractStartTime.mockReturnValue('18:00');

      const requirements = [
        {
          date: '2025-01-20',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 3, filled: 1 }],
            },
          ],
        },
      ];

      const assignments = [
        {
          roleIds: ['dealer'],
          dates: ['2025-01-20'],
          timeSlot: '18:00~02:00',
        },
      ];

      updateDateSpecificRequirementsFilled(requirements as any, assignments as any, 'increment');

      // Original should be unchanged
      expect(requirements[0].timeSlots[0].roles[0].filled).toBe(1);
    });
  });

  // ==========================================================================
  // confirmApplicationWithHistory
  // ==========================================================================
  describe('confirmApplicationWithHistory', () => {
    it('should confirm application and create work logs', async () => {
      const appData = createMockApplicationData();
      const jobData = createMockJobData();

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);
      mockFindActiveConfirmation.mockReturnValue(null);

      const result = await confirmApplicationWithHistory(
        'app-1',
        undefined,
        'owner-1',
        'Confirmed'
      );

      expect(result.applicationId).toBe('app-1');
      expect(result.workLogIds).toHaveLength(1);
      expect(result.message).toContain('홍길동');
      expect(mockTransaction.set).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('should throw when application does not exist', async () => {
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', null));

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toThrow(
        '존재하지 않는 지원입니다'
      );
    });

    it('should throw when application data cannot be parsed', async () => {
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', { some: 'data' }));
      mockParseApplicationDocument.mockReturnValue(null);

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toThrow(
        '지원 데이터를 파싱할 수 없습니다'
      );
    });

    it('should throw when application is already confirmed', async () => {
      const appData = createMockApplicationData({
        confirmationHistory: [
          {
            confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
            assignments: [],
          },
        ],
      });

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockParseApplicationDocument.mockReturnValue(appData);
      // findActiveConfirmation returns non-null (already confirmed)
      mockFindActiveConfirmation.mockReturnValue({
        confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
        assignments: [],
      });

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toThrow(
        '이미 확정된 지원입니다'
      );
    });

    it('should throw when job does not exist', async () => {
      const appData = createMockApplicationData();
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', null));
      mockParseApplicationDocument.mockReturnValue(appData);

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should throw when job data cannot be parsed', async () => {
      const appData = createMockApplicationData();
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', { some: 'data' }));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(null);

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toThrow(
        '공고 데이터를 파싱할 수 없습니다'
      );
    });

    it('should throw when owner does not match', async () => {
      const appData = createMockApplicationData();
      const jobData = createMockJobData({ ownerId: 'other-owner' });

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toThrow(
        '본인의 공고만 관리할 수 있습니다'
      );
    });

    it('should throw when no assignments to confirm', async () => {
      const appData = createMockApplicationData({ assignments: [] });
      const jobData = createMockJobData();

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);

      await expect(confirmApplicationWithHistory('app-1', [], 'owner-1')).rejects.toThrow(
        '확정할 일정을 선택해주세요'
      );
    });

    it('should throw when capacity is exceeded', async () => {
      const appData = createMockApplicationData({
        assignments: [
          {
            roleIds: ['dealer'],
            dates: ['2025-01-20', '2025-01-21', '2025-01-22'],
            timeSlot: '18:00~02:00',
          },
        ],
      });
      const jobData = createMockJobData();

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);
      // total=3, filled=2, trying to add 3 => 2+3=5 > 3
      mockGetClosingStatus.mockReturnValue({ total: 3, filled: 2 });

      await expect(confirmApplicationWithHistory('app-1', undefined, 'owner-1')).rejects.toThrow(
        '모집 인원이 마감되었습니다'
      );
    });

    it('should use selectedAssignments over application assignments', async () => {
      const appData = createMockApplicationData();
      const jobData = createMockJobData();
      const selectedAssignments = [
        {
          roleIds: ['floor'],
          dates: ['2025-01-20', '2025-01-21'],
          timeSlot: '18:00~02:00',
        },
      ];

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);

      const result = await confirmApplicationWithHistory(
        'app-1',
        selectedAssignments as any,
        'owner-1'
      );

      expect(result.workLogIds).toHaveLength(2); // 2 dates
    });

    it('should preserve originalApplication on first confirmation', async () => {
      const appData = createMockApplicationData({
        originalApplication: undefined,
      });
      const jobData = createMockJobData();

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);

      await confirmApplicationWithHistory('app-1', undefined, 'owner-1');

      // Verify application update includes originalApplication
      const updateCall = mockTransaction.update.mock.calls.find((call: unknown[]) => {
        const data = call[1] as Record<string, unknown>;
        return data.status === 'confirmed';
      });
      expect(updateCall).toBeDefined();
      expect((updateCall![1] as Record<string, unknown>).originalApplication).toBeDefined();
    });
  });

  // ==========================================================================
  // cancelConfirmation
  // ==========================================================================
  describe('cancelConfirmation', () => {
    it('should cancel an active confirmation', async () => {
      const activeConfirmation = {
        confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
        assignments: [{ roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' }],
      };

      const appData = createMockApplicationData({
        status: 'confirmed',
        confirmationHistory: [activeConfirmation],
      });
      const jobData = createMockJobData();

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);
      mockFindActiveConfirmation.mockReturnValue(activeConfirmation);

      const result = await cancelConfirmation('app-1', 'owner-1', 'Changed mind');

      expect(result.applicationId).toBe('app-1');
      expect(result.cancelledAt).toBeDefined();
      expect(result.restoredStatus).toBe('applied');
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('should throw when application does not exist', async () => {
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', null));

      await expect(cancelConfirmation('app-1', 'owner-1')).rejects.toThrow(
        '존재하지 않는 지원입니다'
      );
    });

    it('should throw when application data cannot be parsed', async () => {
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', { some: 'data' }));
      mockParseApplicationDocument.mockReturnValue(null);

      await expect(cancelConfirmation('app-1', 'owner-1')).rejects.toThrow(
        '지원 데이터를 파싱할 수 없습니다'
      );
    });

    it('should throw when application is not confirmed', async () => {
      const appData = createMockApplicationData({ status: 'applied' });

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockParseApplicationDocument.mockReturnValue(appData);

      await expect(cancelConfirmation('app-1', 'owner-1')).rejects.toThrow(
        '확정된 지원만 취소할 수 있습니다'
      );
    });

    it('should throw when no active confirmation found', async () => {
      const appData = createMockApplicationData({
        status: 'confirmed',
        confirmationHistory: [],
      });

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockFindActiveConfirmation.mockReturnValue(null);

      await expect(cancelConfirmation('app-1', 'owner-1')).rejects.toThrow(
        '취소할 확정 이력이 없습니다'
      );
    });

    it('should throw when owner does not match', async () => {
      const activeConfirmation = {
        confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
        assignments: [],
      };
      const appData = createMockApplicationData({
        status: 'confirmed',
        confirmationHistory: [activeConfirmation],
      });
      const jobData = createMockJobData({ ownerId: 'other-owner' });

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);
      mockFindActiveConfirmation.mockReturnValue(activeConfirmation);

      await expect(cancelConfirmation('app-1', 'owner-1')).rejects.toThrow(
        '본인의 공고만 관리할 수 있습니다'
      );
    });

    it('should throw when job does not exist', async () => {
      const activeConfirmation = {
        confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
        assignments: [],
      };
      const appData = createMockApplicationData({
        status: 'confirmed',
        confirmationHistory: [activeConfirmation],
      });

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', null));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockFindActiveConfirmation.mockReturnValue(activeConfirmation);

      await expect(cancelConfirmation('app-1', 'owner-1')).rejects.toThrow(
        '존재하지 않는 공고입니다'
      );
    });

    it('should reopen job when cancellation brings filled below total', async () => {
      const activeConfirmation = {
        confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
        assignments: [{ roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' }],
      };
      const appData = createMockApplicationData({
        status: 'confirmed',
        confirmationHistory: [activeConfirmation],
      });
      const jobData = createMockJobData({ status: 'closed' });

      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('app-1', appData));
      mockTransaction.get.mockResolvedValueOnce(createDocSnapshot('job-1', jobData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockParseJobPostingDocument.mockReturnValue(jobData);
      mockFindActiveConfirmation.mockReturnValue(activeConfirmation);
      // After decrement: 10-1=9 < 10, should reopen
      mockGetClosingStatus.mockReturnValue({ total: 10, filled: 10 });

      const result = await cancelConfirmation('app-1', 'owner-1');

      expect(result.restoredStatus).toBe('applied');
      // Check that job update includes status: 'active'
      const jobUpdateCall = mockTransaction.update.mock.calls.find((call: unknown[]) => {
        const data = call[1] as Record<string, unknown>;
        return data.filledPositions !== undefined && data.status === 'active';
      });
      expect(jobUpdateCall).toBeDefined();
    });
  });

  // ==========================================================================
  // getOriginalApplicationData
  // ==========================================================================
  describe('getOriginalApplicationData', () => {
    it('should return original assignments when available', () => {
      const originalAssignments = [
        { roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' },
      ];
      const application = {
        originalApplication: { assignments: originalAssignments },
        assignments: [{ roleIds: ['floor'], dates: ['2025-01-21'], timeSlot: '09:00~17:00' }],
      } as any;

      const result = getOriginalApplicationData(application);

      expect(result).toBe(originalAssignments);
    });

    it('should return current assignments when no originalApplication', () => {
      const currentAssignments = [
        { roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' },
      ];
      const application = {
        assignments: currentAssignments,
      } as any;

      const result = getOriginalApplicationData(application);

      expect(result).toBe(currentAssignments);
    });

    it('should return empty array when no assignments at all', () => {
      const application = {} as any;

      const result = getOriginalApplicationData(application);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // getConfirmedSelections
  // ==========================================================================
  describe('getConfirmedSelections', () => {
    it('should return active confirmation assignments', () => {
      const assignments = [{ roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' }];
      const application = {
        confirmationHistory: [{ confirmedAt: { seconds: 1700000000 }, assignments }],
      } as any;

      mockFindActiveConfirmation.mockReturnValue({
        confirmedAt: { seconds: 1700000000 },
        assignments,
      });

      const result = getConfirmedSelections(application);

      expect(result).toBe(assignments);
    });

    it('should return empty array when no confirmation history', () => {
      const application = {} as any;

      const result = getConfirmedSelections(application);

      expect(result).toEqual([]);
    });

    it('should return empty array when confirmation history is empty', () => {
      const application = { confirmationHistory: [] } as any;

      const result = getConfirmedSelections(application);

      expect(result).toEqual([]);
    });

    it('should return empty array when no active confirmation', () => {
      const application = {
        confirmationHistory: [
          {
            confirmedAt: { seconds: 1700000000 },
            cancelledAt: { seconds: 1700001000 },
            assignments: [],
          },
        ],
      } as any;

      mockFindActiveConfirmation.mockReturnValue(null);

      const result = getConfirmedSelections(application);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // isV2Application
  // ==========================================================================
  describe('isV2Application', () => {
    it('should return true when assignments exist and have length', () => {
      const application = {
        assignments: [{ roleIds: ['dealer'], dates: ['2025-01-20'], timeSlot: '18:00~02:00' }],
      } as any;

      expect(isV2Application(application)).toBe(true);
    });

    it('should return false when assignments is empty', () => {
      const application = { assignments: [] } as any;

      expect(isV2Application(application)).toBe(false);
    });

    it('should return false when assignments is undefined', () => {
      const application = {} as any;

      expect(isV2Application(application)).toBe(false);
    });

    it('should return false when assignments is null', () => {
      const application = { assignments: null } as any;

      expect(isV2Application(application)).toBe(false);
    });
  });

  // ==========================================================================
  // getApplicationHistorySummary
  // ==========================================================================
  describe('getApplicationHistorySummary', () => {
    it('should return summary for application with history', async () => {
      const historyEntry = {
        confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
        assignments: [],
      };
      const appData = createMockApplicationData({
        confirmationHistory: [historyEntry],
      });

      mockGetDoc.mockResolvedValue(createDocSnapshot('app-1', appData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockFindActiveConfirmation.mockReturnValue(historyEntry);

      const result = await getApplicationHistorySummary('app-1');

      expect(result).not.toBeNull();
      expect(result!.totalConfirmations).toBe(1);
      expect(result!.cancellations).toBe(0);
      expect(result!.isCurrentlyConfirmed).toBe(true);
    });

    it('should return null when application does not exist', async () => {
      mockGetDoc.mockResolvedValue(createDocSnapshot('app-1', null));

      const result = await getApplicationHistorySummary('non-existent');

      expect(result).toBeNull();
    });

    it('should return null when application data cannot be parsed', async () => {
      mockGetDoc.mockResolvedValue(createDocSnapshot('app-1', { some: 'data' }));
      mockParseApplicationDocument.mockReturnValue(null);

      const result = await getApplicationHistorySummary('app-1');

      expect(result).toBeNull();
    });

    it('should count cancellations correctly', async () => {
      const history = [
        {
          confirmedAt: { seconds: 1700000000, nanoseconds: 0 },
          cancelledAt: { seconds: 1700001000, nanoseconds: 0 },
          assignments: [],
        },
        {
          confirmedAt: { seconds: 1700002000, nanoseconds: 0 },
          assignments: [],
        },
      ];
      const appData = createMockApplicationData({ confirmationHistory: history });

      mockGetDoc.mockResolvedValue(createDocSnapshot('app-1', appData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockFindActiveConfirmation.mockReturnValue(history[1]);

      const result = await getApplicationHistorySummary('app-1');

      expect(result!.totalConfirmations).toBe(2);
      expect(result!.cancellations).toBe(1);
      expect(result!.isCurrentlyConfirmed).toBe(true);
      expect(result!.lastCancelledAt).toEqual({ seconds: 1700001000, nanoseconds: 0 });
    });

    it('should handle application with no history', async () => {
      const appData = createMockApplicationData({ confirmationHistory: [] });

      mockGetDoc.mockResolvedValue(createDocSnapshot('app-1', appData));
      mockParseApplicationDocument.mockReturnValue(appData);
      mockFindActiveConfirmation.mockReturnValue(null);

      const result = await getApplicationHistorySummary('app-1');

      expect(result!.totalConfirmations).toBe(0);
      expect(result!.cancellations).toBe(0);
      expect(result!.isCurrentlyConfirmed).toBe(false);
    });

    it('should propagate errors through handleServiceError', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      await expect(getApplicationHistorySummary('app-1')).rejects.toThrow();
    });
  });
});
