/**
 * UNIQN Mobile - ReportRepository 테스트
 *
 * @description Firebase Report Repository 단위 테스트
 */

import { getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { FirebaseReportRepository } from '../ReportRepository';

jest.mock('firebase/firestore', () => {
  let autoId = 0;

  return {
    collection: jest.fn((_db: unknown, name: string) => ({
      __type: 'collection',
      path: name,
    })),
    doc: jest.fn((...args: unknown[]) => {
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        autoId += 1;
        const path = (args[0] as { path: string }).path;
        return { id: `report-${autoId}`, path: `${path}/report-${autoId}` };
      }

      const collectionName = args[1] as string;
      const id = args[2] as string;
      return { id, path: `${collectionName}/${id}` };
    }),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn((...constraints: unknown[]) => ({ constraints })),
    where: jest.fn((...constraint: unknown[]) => constraint),
    orderBy: jest.fn((...constraint: unknown[]) => constraint),
    runTransaction: jest.fn(),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    getCountFromServer: jest.fn(),
  };
});

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({ __type: 'db' })),
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

jest.mock('@/schemas', () => ({
  parseReportDocuments: jest.fn((docs: unknown[]) => docs),
  parseReportDocument: jest.fn((doc: unknown) => doc),
}));

jest.mock('@/types/report', () => ({
  getReportSeverity: jest.fn(() => 'high'),
}));

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    REPORTS: 'reports',
    REPORT_PENDING_LOCKS: 'reportPendingLocks',
  },
  FIELDS: {
    REPORT: {
      reporterId: 'reporterId',
      targetId: 'targetId',
      jobPostingId: 'jobPostingId',
      status: 'status',
      createdAt: 'createdAt',
      severity: 'severity',
      reporterType: 'reporterType',
    },
  },
  STATUS: {
    REPORT: {
      PENDING: 'pending',
      REVIEWED: 'reviewed',
    },
  },
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

  class DuplicateReportError extends AppError {
    constructor(options?: { userMessage?: string }) {
      super('E6201', { userMessage: options?.userMessage || '이미 신고함' });
      this.name = 'DuplicateReportError';
    }
  }

  class ReportNotFoundError extends AppError {
    constructor(options?: { userMessage?: string }) {
      super('E6202', { userMessage: options?.userMessage || '신고 없음' });
      this.name = 'ReportNotFoundError';
    }
  }

  class ReportAlreadyReviewedError extends AppError {
    constructor(options?: { userMessage?: string }) {
      super('E6203', { userMessage: options?.userMessage || '이미 처리됨' });
      this.name = 'ReportAlreadyReviewedError';
    }
  }

  class CannotReportSelfError extends AppError {
    constructor(options?: { userMessage?: string }) {
      super('E6204', { userMessage: options?.userMessage || '본인 신고 불가' });
      this.name = 'CannotReportSelfError';
    }
  }

  return {
    toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
    isAppError: (error: unknown) => error instanceof AppError,
    DuplicateReportError,
    ReportNotFoundError,
    ReportAlreadyReviewedError,
    CannotReportSelfError,
  };
});

function createEmptyQuerySnapshot() {
  return {
    empty: true,
    docs: [],
  };
}

function createDocSnapshot(data: Record<string, unknown> | null) {
  return {
    exists: () => data !== null,
    data: () => data,
  };
}

describe('FirebaseReportRepository', () => {
  let repository: FirebaseReportRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new FirebaseReportRepository();
    (getDocs as jest.Mock).mockResolvedValue(createEmptyQuerySnapshot());
  });

  describe('createWithTransaction', () => {
    it('creates a pending lock and report atomically', async () => {
      const transaction = {
        get: jest.fn().mockResolvedValue(createDocSnapshot(null)),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      };
      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(transaction)
      );

      const reportId = await repository.createWithTransaction(
        {
          type: 'no_show',
          reporterType: 'employer',
          targetId: 'staff-1',
          targetName: '스태프',
          jobPostingId: 'job/1',
          jobPostingTitle: '테스트 공고',
          description: '무단 결근',
        } as never,
        {
          reporterId: 'employer-1',
          reporterName: '고용주',
        }
      );

      expect(reportId).toBe('report-1');
      expect(transaction.get).toHaveBeenCalledWith({
        id: 'employer-1__staff-1__job%2F1',
        path: 'reportPendingLocks/employer-1__staff-1__job%2F1',
      });
      expect(transaction.set).toHaveBeenNthCalledWith(
        1,
        {
          id: 'employer-1__staff-1__job%2F1',
          path: 'reportPendingLocks/employer-1__staff-1__job%2F1',
        },
        expect.objectContaining({
          reportId: 'report-1',
          reporterId: 'employer-1',
          targetId: 'staff-1',
          jobPostingId: 'job/1',
          createdAt: 'SERVER_TIMESTAMP',
          updatedAt: 'SERVER_TIMESTAMP',
        })
      );
      expect(transaction.set).toHaveBeenNthCalledWith(
        2,
        {
          id: 'report-1',
          path: 'reports/report-1',
        },
        expect.objectContaining({
          reporterId: 'employer-1',
          targetId: 'staff-1',
          jobPostingId: 'job/1',
          status: 'pending',
          severity: 'high',
          createdAt: 'SERVER_TIMESTAMP',
          updatedAt: 'SERVER_TIMESTAMP',
        })
      );
      expect(serverTimestamp).toHaveBeenCalled();
    });

    it('rejects when a pending lock already exists', async () => {
      const transaction = {
        get: jest.fn().mockResolvedValue(createDocSnapshot({ reportId: 'existing' })),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      };
      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(transaction)
      );

      await expect(
        repository.createWithTransaction(
          {
            type: 'no_show',
            reporterType: 'employer',
            targetId: 'staff-1',
            targetName: '스태프',
            jobPostingId: 'job-1',
            description: '무단 결근',
          } as never,
          {
            reporterId: 'employer-1',
            reporterName: '고용주',
          }
        )
      ).rejects.toMatchObject({ name: 'DuplicateReportError' });
    });
  });

  describe('reviewWithTransaction', () => {
    it('removes the pending lock when reviewing a pending report', async () => {
      const transaction = {
        get: jest.fn().mockResolvedValue(
          createDocSnapshot({
            reporterId: 'employer-1',
            targetId: 'staff-1',
            jobPostingId: 'job/1',
            status: 'pending',
          })
        ),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      };
      (runTransaction as jest.Mock).mockImplementation(async (_db, callback) =>
        callback(transaction)
      );

      await repository.reviewWithTransaction(
        {
          reportId: 'report-1',
          status: 'reviewed',
          reviewerNotes: '확인 완료',
        } as never,
        'admin-1'
      );

      expect(transaction.delete).toHaveBeenCalledWith({
        id: 'employer-1__staff-1__job%2F1',
        path: 'reportPendingLocks/employer-1__staff-1__job%2F1',
      });
      expect(transaction.update).toHaveBeenCalledWith(
        {
          id: 'report-1',
          path: 'reports/report-1',
        },
        expect.objectContaining({
          status: 'reviewed',
          reviewerId: 'admin-1',
          reviewerNotes: '확인 완료',
          reviewedAt: 'SERVER_TIMESTAMP',
          updatedAt: 'SERVER_TIMESTAMP',
        })
      );
    });
  });
});
