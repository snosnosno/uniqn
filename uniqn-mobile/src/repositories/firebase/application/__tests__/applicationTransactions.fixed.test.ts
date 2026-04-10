import { getDoc, getDocs, runTransaction, Timestamp } from 'firebase/firestore';
import {
  confirmWithHistoryTransaction,
  cancelConfirmationTransaction,
} from '../applicationHistoryTransactions';

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({ app: 'db' })),
}));

jest.mock('@/schemas', () => ({
  parseApplicationDocument: jest.fn((data: Record<string, unknown>) => data),
  parseJobPostingDocument: jest.fn((data: Record<string, unknown>) => data),
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
    return new Error(String(error));
  }),
}));

jest.mock('@/errors', () => {
  class AppError extends Error {
    code: string;
    constructor(code: string, options?: { userMessage?: string }) {
      super(options?.userMessage || code);
      this.code = code;
    }
  }
  class ValidationError extends AppError {}
  class BusinessError extends AppError {}
  class PermissionError extends AppError {}
  class MaxCapacityReachedError extends AppError {}

  return {
    ValidationError,
    BusinessError,
    PermissionError,
    MaxCapacityReachedError,
    ERROR_CODES: {
      VALIDATION_REQUIRED: 'E3001',
      VALIDATION_SCHEMA: 'E3003',
      FIREBASE_DOCUMENT_NOT_FOUND: 'E4002',
      FIREBASE_PERMISSION_DENIED: 'E4001',
      SECURITY_UNAUTHORIZED_ACCESS: 'E5001',
      BUSINESS_INVALID_STATE: 'E6001',
      BUSINESS_ALREADY_APPLIED: 'E6002',
    },
    isAppError: (error: unknown) => error instanceof AppError,
    toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  };
});

jest.mock('@/types/assignment', () => ({
  FIXED_DATE_MARKER: 'FIXED_SCHEDULE',
  normalizeAssignmentRole: jest.fn((roleId: string) => ({
    role: roleId === 'custom-role' ? 'other' : 'dealer',
    customRole: roleId === 'custom-role' ? '커스텀 역할' : undefined,
  })),
}));

jest.mock('@/domains/application', () => ({
  createHistoryEntry: jest.fn((assignments: unknown[]) => ({
    assignments,
    confirmedAt: '2026-03-21T00:00:00.000Z',
    confirmedBy: 'owner-1',
  })),
  findActiveConfirmation: jest.fn((history: Record<string, unknown>[]) =>
    history.find((entry) => !entry.cancelledAt)
  ),
  updatePostingScheduleFilled: jest.fn((schedule: unknown) => schedule),
  validateAssignmentSlotCapacity: jest.fn(() => ({ available: true })),
}));

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    APPLICATIONS: 'applications',
    JOB_POSTINGS: 'jobPostings',
    WORK_LOGS: 'workLogs',
    STAFF: 'staff',
  },
  STATUS: {
    APPLICATION: {
      APPLIED: 'applied',
      CONFIRMED: 'confirmed',
      COMPLETED: 'completed',
    },
    JOB_POSTING: {
      ACTIVE: 'active',
      CLOSED: 'closed',
    },
    WORK_LOG: {
      SCHEDULED: 'scheduled',
      CANCELLED: 'cancelled',
    },
    ATTENDANCE: {
      NOT_STARTED: 'not_started',
    },
  },
}));

jest.mock('../applicationLifecycleHelpers', () => ({
  releaseConfirmedAssignmentsInTransaction: jest.fn(),
}));

jest.mock('firebase/firestore', () => {
  let autoId = 0;

  const makeTimestamp = () => ({
    seconds: 1,
    nanoseconds: 0,
    toDate: () => new Date('2026-03-21T00:00:00.000Z'),
  });

  return {
    collection: jest.fn((_db: unknown, name: string) => ({ kind: 'collection', name })),
    doc: jest.fn((...args: unknown[]) => {
      if (args.length === 1) {
        const collectionRef = args[0] as { name: string };
        autoId += 1;
        return {
          kind: 'doc',
          collection: collectionRef.name,
          id: `auto-${autoId}`,
          path: `${collectionRef.name}/auto-${autoId}`,
        };
      }

      const [, collectionName, id] = args as [unknown, string, string];
      return {
        kind: 'doc',
        collection: collectionName,
        id,
        path: `${collectionName}/${id}`,
      };
    }),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn((...parts: unknown[]) => ({ kind: 'query', parts })),
    where: jest.fn((...parts: unknown[]) => ({ kind: 'where', parts })),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
    Timestamp: {
      now: jest.fn(makeTimestamp),
      fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    },
    type: {},
  };
});

function createDocSnap(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
  };
}

describe('fixed application transaction compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('confirms fixed applications without creating worklogs', async () => {
    const transaction = {
      get: jest.fn((ref: { path: string }) => {
        if (ref.path === 'applications/app-1') {
          return Promise.resolve(
            createDocSnap('app-1', {
              id: 'app-1',
              status: 'applied',
              applicantId: 'staff-1',
              applicantName: 'Alice',
              jobPostingId: 'job-1',
              assignments: [
                {
                  roleIds: ['dealer'],
                  dates: ['FIXED_SCHEDULE'],
                  timeSlot: 'FIXED_TIME',
                  isGrouped: false,
                },
              ],
              confirmationHistory: [],
              createdAt: Timestamp.now(),
            })
          );
        }

        return Promise.resolve(
          createDocSnap('job-1', {
            id: 'job-1',
            title: 'Fixed Job',
            ownerId: 'owner-1',
            status: 'active',
            filledPositions: 0,
            totalPositions: 1,
            schedule: {
              kind: 'fixed',
              roleRequirements: [{ role: 'dealer', count: 1, filled: 0 }],
            },
          })
        );
      }),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    const result = await confirmWithHistoryTransaction('app-1', undefined, 'owner-1');

    expect(result.workLogIds).toEqual([]);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'applications/app-1' }),
      expect.objectContaining({
        status: 'confirmed',
        assignments: expect.arrayContaining([
          expect.objectContaining({
            roleIds: ['dealer'],
            dates: ['FIXED_SCHEDULE'],
          }),
        ]),
      })
    );
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'jobPostings/job-1' }),
      expect.objectContaining({
        filledPositions: 1,
        status: 'closed',
      })
    );
  });

  it('blocks fixed confirmation cancellation in phase 1', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      createDocSnap('app-1', {
        applicantId: 'staff-1',
        jobPostingId: 'job-1',
      })
    );
    (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

    const transaction = {
      get: jest.fn((ref: { path: string }) => {
        if (ref.path === 'applications/app-1') {
          return Promise.resolve(
            createDocSnap('app-1', {
              id: 'app-1',
              status: 'confirmed',
              applicantId: 'staff-1',
              applicantName: 'Alice',
              jobPostingId: 'job-1',
              assignments: [
                {
                  roleIds: ['dealer'],
                  dates: ['FIXED_SCHEDULE'],
                  timeSlot: 'FIXED_TIME',
                  isGrouped: false,
                },
              ],
              confirmationHistory: [
                {
                  assignments: [
                    {
                      roleIds: ['dealer'],
                      dates: ['FIXED_SCHEDULE'],
                      timeSlot: 'FIXED_TIME',
                    },
                  ],
                },
              ],
              originalApplication: { assignments: [] },
            })
          );
        }

        return Promise.resolve(
          createDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'owner-1',
            status: 'active',
            schedule: {
              kind: 'fixed',
              roleRequirements: [{ role: 'dealer', count: 1, filled: 1 }],
            },
          })
        );
      }),
      update: jest.fn(),
      delete: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    await expect(cancelConfirmationTransaction('app-1', 'owner-1', 'cancel')).rejects.toThrow(
      '고정공고는 1차 범위에서 확정 취소를 지원하지 않습니다.'
    );

    expect(transaction.delete).not.toHaveBeenCalled();
  });
});
