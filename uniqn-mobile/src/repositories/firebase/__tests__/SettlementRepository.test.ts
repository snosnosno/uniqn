import { runTransaction } from 'firebase/firestore';
import { logger } from '@/utils/logger';
import { FirebaseSettlementRepository } from '../SettlementRepository';

const mockSettlementCalculate = jest.fn();

jest.mock('firebase/firestore', () => ({
  arrayUnion: jest.fn((value: unknown) => ({ _arrayUnion: value })),
  doc: jest.fn((_db: unknown, collection: string, id: string) => ({
    id,
    path: `${collection}/${id}`,
  })),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  Timestamp: {
    fromDate: jest.fn((date: Date) => date),
    now: jest.fn(() => ({ _timestamp: 'now' })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/domains/job-posting', () => ({
  getPostingSettlementContext: jest.fn(() => ({
    roles: [{ role: 'dealer', salary: { type: 'hourly', amount: 15000 } }],
    defaultSalary: { type: 'hourly', amount: 15000 },
    allowances: undefined,
    taxSettings: undefined,
  })),
}));

jest.mock('@/domains/settlement', () => ({
  SettlementCalculator: {
    calculate: (...args: unknown[]) => mockSettlementCalculate(...args),
  },
}));

jest.mock('@/utils/settlement', () => ({
  getEffectiveSalaryInfoFromRoles: jest.fn(() => ({ type: 'hourly', amount: 15000 })),
  getEffectiveAllowances: jest.fn(() => undefined),
  getEffectiveTaxSettings: jest.fn(() => undefined),
}));

jest.mock('@/schemas', () => ({
  parseWorkLogDocument: jest.fn((data: Record<string, unknown>) => data),
  parseJobPostingDocument: jest.fn((data: Record<string, unknown>) => data),
}));

jest.mock('@/shared/id', () => ({
  IdNormalizer: {
    normalizeJobId: jest.fn((document: { jobPostingId: string }) => document.jobPostingId),
  },
}));

jest.mock('@/errors/serviceErrorHandler', () => ({
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

jest.mock('@/errors', () => {
  class AppError extends Error {
    public readonly code: string;
    public readonly userMessage: string;

    constructor(code: string, options?: { userMessage?: string }) {
      const message = options?.userMessage ?? code;
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.userMessage = message;
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

  class AlreadySettledError extends AppError {
    constructor(options?: { userMessage?: string }) {
      super('ALREADY_SETTLED', {
        userMessage: options?.userMessage ?? '이미 정산 완료된 근무 기록입니다',
      });
      this.name = 'AlreadySettledError';
    }
  }

  return {
    BusinessError,
    PermissionError,
    AlreadySettledError,
    ERROR_CODES: {
      BUSINESS_INVALID_STATE: 'BUSINESS_INVALID_STATE',
      FIREBASE_DOCUMENT_NOT_FOUND: 'FIREBASE_DOCUMENT_NOT_FOUND',
      FIREBASE_PERMISSION_DENIED: 'FIREBASE_PERMISSION_DENIED',
    },
    isAppError: (error: unknown) =>
      error instanceof AppError ||
      error instanceof BusinessError ||
      error instanceof PermissionError ||
      error instanceof AlreadySettledError,
  };
});

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    WORK_LOGS: 'workLogs',
    JOB_POSTINGS: 'jobPostings',
  },
  FIREBASE_LIMITS: {
    BATCH_MAX_OPERATIONS: 500,
  },
  STATUS: {
    WORK_LOG: {
      CHECKED_OUT: 'checked_out',
      COMPLETED: 'completed',
    },
    PAYROLL: {
      PENDING: 'pending',
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

describe('FirebaseSettlementRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettlementCalculate.mockReturnValue({
      hoursWorked: 8,
      totalPay: 150000,
      afterTaxPay: 135000,
    });
  });

  it('recomputes individual settlement amount from canonical data before persisting', async () => {
    const transaction = {
      get: jest
        .fn()
        .mockResolvedValueOnce(
          createDocSnap('wl-1', {
            id: 'wl-1',
            jobPostingId: 'job-1',
            role: 'dealer',
            status: 'checked_out',
            payrollStatus: 'pending',
            checkInTime: new Date('2026-03-25T09:00:00.000Z'),
            checkOutTime: new Date('2026-03-25T18:00:00.000Z'),
          })
        )
        .mockResolvedValueOnce(
          createDocSnap('job-1', {
            id: 'job-1',
            ownerId: 'owner-1',
          })
        ),
      update: jest.fn(),
    };

    (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
      callback(transaction)
    );

    const repository = new FirebaseSettlementRepository();

    const result = await repository.settleWorkLogWithTransaction(
      {
        workLogId: 'wl-1',
        amount: 999999,
      },
      'owner-1'
    );

    expect(transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wl-1' }),
      expect.objectContaining({
        payrollStatus: 'completed',
        payrollAmount: 135000,
        payrollDate: { _serverTimestamp: true },
      })
    );
    expect(result).toEqual({
      success: true,
      workLogId: 'wl-1',
      amount: 135000,
      message: '정산이 완료되었습니다',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Individual settlement amount mismatch detected, using canonical amount',
      expect.objectContaining({
        workLogId: 'wl-1',
        requestedAmount: 999999,
        canonicalAmount: 135000,
      })
    );
  });
});
