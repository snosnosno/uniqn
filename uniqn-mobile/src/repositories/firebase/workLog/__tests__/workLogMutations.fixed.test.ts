import { processQRCheckInOutTransaction } from '../workLogMutations';

const mockRunTransaction = jest.fn();

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({ kind: 'db' })),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/schemas', () => ({
  parseWorkLogDocument: jest.fn((data: unknown) => data),
}));

jest.mock('@/shared/time', () => ({
  TimeNormalizer: {
    parseTime: jest.fn(() => new Date('2025-01-15T09:00:00.000Z')),
  },
}));

jest.mock('@/utils/date', () => ({
  parseTimeSlotToDate: jest.fn(() => ({
    startTime: new Date('2025-01-15T09:00:00.000Z'),
  })),
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) => {
    if (error instanceof Error) return error;
    return new Error(String(error));
  }),
}));

jest.mock('@/errors', () => {
  class AppError extends Error {}
  class BusinessError extends AppError {}
  class InvalidQRCodeError extends AppError {}
  class AlreadyCheckedInError extends AppError {}
  class NotCheckedInError extends AppError {}

  return {
    toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    isAppError: (error: unknown) => error instanceof AppError,
    BusinessError,
    InvalidQRCodeError,
    AlreadyCheckedInError,
    NotCheckedInError,
    ERROR_CODES: {
      BUSINESS_INVALID_WORKLOG: 'E1',
      BUSINESS_ALREADY_SETTLED: 'E2',
    },
  };
});

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    static fromDate(date: Date) {
      return { toDate: () => date };
    }
  }

  return {
    doc: jest.fn((_db: unknown, collection: string, id: string) => ({
      path: `${collection}/${id}`,
      id,
    })),
    updateDoc: jest.fn(),
    serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
    Timestamp: MockTimestamp,
  };
});

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    WORK_LOGS: 'workLogs',
    JOB_POSTINGS: 'jobPostings',
  },
  STATUS: {
    WORK_LOG: {
      SCHEDULED: 'scheduled',
      CHECKED_IN: 'checked_in',
      CHECKED_OUT: 'checked_out',
      COMPLETED: 'completed',
    },
    PAYROLL: {
      COMPLETED: 'completed',
    },
  },
}));

function createDocSnap(id: string, data: Record<string, unknown>) {
  return {
    id,
    exists: () => true,
    data: () => data,
  };
}

describe('processQRCheckInOutTransaction fixed worklogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not reject fixed worklogs when QR date differs from blank persisted date', async () => {
    const transaction = {
      get: jest.fn((ref: { path: string }) => {
        if (ref.path === 'workLogs/wl-fixed') {
          return Promise.resolve(
            createDocSnap('wl-fixed', {
              id: 'wl-fixed',
              staffId: 'staff-1',
              jobPostingId: 'job-1',
              date: '',
              isFixedPosting: true,
              status: 'scheduled',
            })
          );
        }

        return Promise.resolve(
          createDocSnap('job-1', {
            status: 'active',
          })
        );
      }),
      update: jest.fn(),
    };

    mockRunTransaction.mockImplementation(async (_db, callback) => callback(transaction));

    const result = await processQRCheckInOutTransaction(
      'wl-fixed',
      'staff-1',
      'job-1',
      'checkIn',
      new Date('2025-01-15T09:00:00.000Z'),
      '2025-01-15'
    );

    expect(result.action).toBe('checkIn');
    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'workLogs/wl-fixed' }),
      expect.objectContaining({
        status: 'checked_in',
      })
    );
  });
});
