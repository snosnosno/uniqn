import { getDoc, getDocs, runTransaction, Timestamp } from 'firebase/firestore';
import {
  confirmWithHistoryTransaction,
  cancelConfirmationTransaction,
} from '../applicationHistoryTransactions';
import {
  convertApplicantToStaffTransaction,
  revertStaffConversionTransaction,
} from '../applicationConversionTransactions';

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

jest.mock('@/utils/job-posting/dateUtils', () => ({
  getClosingStatus: jest.fn(() => ({ total: 10, filled: 2 })),
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
    role: roleId === 'other:조명' ? 'other' : 'dealer',
    customRole: roleId === 'other:조명' ? '조명' : undefined,
  })),
}));

jest.mock('@/types', () => ({
  createHistoryEntry: jest.fn((assignments: unknown[]) => ({
    assignments,
    confirmedAt: '2026-03-21T00:00:00.000Z',
    confirmedBy: 'owner-1',
  })),
  addCancellationToEntry: jest.fn((entry: Record<string, unknown>, reason: string | undefined) => ({
    ...entry,
    cancelledAt: '2026-03-21T01:00:00.000Z',
    cancelReason: reason,
  })),
  findActiveConfirmation: jest.fn((history: Record<string, unknown>[]) =>
    history.find((entry) => !entry.cancelledAt)
  ),
}));

jest.mock('@/domains/application', () => ({
  updatePostingScheduleFilled: jest.fn((schedule: unknown) => schedule),
}));

jest.mock('../applicationRoleUtils', () => ({
  resolvePrimaryApplicationRole: jest.fn(() => ({
    role: 'dealer',
    customRole: undefined,
  })),
}));

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    APPLICATIONS: 'applications',
    JOB_POSTINGS: 'jobPostings',
    WORK_LOGS: 'workLogs',
    STAFF: 'staff',
  },
  FIELDS: {
    WORK_LOG: {
      staffId: 'staffId',
      jobPostingId: 'jobPostingId',
    },
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

  it('blocks fixed confirmation writes during the V3 cutover', async () => {
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
              assignments: [],
              confirmationHistory: [],
              schedule: { kind: 'fixed' },
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
            schedule: { kind: 'fixed' },
          })
        );
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    await expect(
      confirmWithHistoryTransaction(
        'app-1',
        [
          {
            roleIds: ['dealer'],
            dates: ['FIXED_SCHEDULE'],
            timeSlot: 'FIXED_TIME',
          },
        ] as never,
        'owner-1'
      )
    ).rejects.toThrow('고정공고 확정은 현재 지원하지 않습니다.');

    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/^workLogs\/auto-/) }),
      expect.anything()
    );
  });

  it('cancel marks related scheduled worklogs as cancelled for fixed confirmations', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      createDocSnap('app-1', {
        applicantId: 'staff-1',
        jobPostingId: 'job-1',
      })
    );
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [{ id: 'wl-fixed' }],
    });

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
              assignments: [],
              confirmationHistory: [{ assignments: [{ dates: ['FIXED_SCHEDULE'] }] }],
              originalApplication: { assignments: [] },
            })
          );
        }
        if (ref.path === 'jobPostings/job-1') {
          return Promise.resolve(
            createDocSnap('job-1', {
              id: 'job-1',
              ownerId: 'owner-1',
              status: 'active',
              schedule: { kind: 'fixed' },
            })
          );
        }

        return Promise.resolve(createDocSnap('wl-fixed', { status: 'scheduled' }));
      }),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    await cancelConfirmationTransaction('app-1', 'owner-1', 'cancel');

    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workLogs/wl-fixed' }),
      expect.objectContaining({
        status: 'cancelled',
        updatedAt: { _serverTimestamp: true },
      })
    );
  });

  it('blocks fixed conversion worklog writes during the V3 cutover', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      createDocSnap('app-1', {
        applicantId: 'staff-1',
      })
    );
    (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });

    const transaction = {
      get: jest.fn((ref: { path: string }) => {
        if (ref.path === 'applications/app-1') {
          return Promise.resolve(
            createDocSnap('app-1', {
              id: 'app-1',
              status: 'confirmed',
              applicantId: 'staff-1',
              applicantName: 'Alice',
              applicantPhone: '010',
              applicantEmail: 'alice@example.com',
              jobPostingId: 'job-1',
              assignments: [
                { roleIds: ['dealer'], dates: ['FIXED_SCHEDULE'], timeSlot: 'FIXED_TIME' },
              ],
            })
          );
        }
        if (ref.path === 'jobPostings/job-1') {
          return Promise.resolve(
            createDocSnap('job-1', {
              id: 'job-1',
              title: 'Fixed Job',
              ownerId: 'owner-1',
              schedule: { kind: 'fixed' },
            })
          );
        }

        return Promise.resolve(createDocSnap('staff-1', null));
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    await expect(convertApplicantToStaffTransaction('app-1', 'job-1', 'owner-1')).rejects.toThrow(
      '고정 공고 스태프 전환은 V3 canonical 전환에서 지원하지 않습니다.'
    );

    expect(transaction.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/^workLogs\/auto-/) }),
      expect.anything()
    );
  });

  it('revert cancels scheduled fixed worklogs created during conversion', async () => {
    (getDoc as jest.Mock).mockResolvedValue(
      createDocSnap('app-1', {
        applicantId: 'staff-1',
        jobPostingId: 'job-1',
      })
    );
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [{ id: 'wl-fixed' }],
    });

    const transaction = {
      get: jest.fn((ref: { path: string }) => {
        if (ref.path === 'applications/app-1') {
          return Promise.resolve(
            createDocSnap('app-1', {
              id: 'app-1',
              status: 'completed',
              applicantId: 'staff-1',
              jobPostingId: 'job-1',
            })
          );
        }
        if (ref.path === 'jobPostings/job-1') {
          return Promise.resolve(
            createDocSnap('job-1', {
              id: 'job-1',
              ownerId: 'owner-1',
            })
          );
        }

        return Promise.resolve(createDocSnap('wl-fixed', { status: 'scheduled' }));
      }),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    await revertStaffConversionTransaction('app-1', 'owner-1');

    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workLogs/wl-fixed' }),
      expect.objectContaining({
        status: 'cancelled',
        cancelledReason: '스태프 전환 취소',
        cancelledAt: { _serverTimestamp: true },
      })
    );
  });
});
