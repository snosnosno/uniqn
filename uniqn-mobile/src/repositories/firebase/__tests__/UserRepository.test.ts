import { getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { toDate } from '@/utils/date';
import { FirebaseUserRepository } from '../UserRepository';

const batchInstances: {
  update: jest.Mock;
  delete: jest.Mock;
  commit: jest.Mock;
}[] = [];

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...segments: unknown[]) => ({
    id: String(segments[segments.length - 1]),
    path: segments.slice(1).join('/'),
  })),
  documentId: jest.fn(() => '__name__'),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn((...segments: unknown[]) => ({
    path: segments.slice(1).join('/'),
  })),
  query: jest.fn((target: { path: string }, ...constraints: unknown[]) => ({
    path: target.path,
    constraints,
  })),
  where: jest.fn((...args: unknown[]) => args),
  writeBatch: jest.fn(() => {
    const batch = {
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    batchInstances.push(batch);
    return batch;
  }),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  runTransaction: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date('2025-01-01T00:00:00.000Z') })),
    fromDate: jest.fn((date: Date) => date),
  },
}));

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
  handleServiceError: jest.fn((error: unknown) =>
    error instanceof Error ? error : new Error(String(error))
  ),
}));

jest.mock('@/errors', () => ({
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  BusinessError: class BusinessError extends Error {},
  ERROR_CODES: {
    INFRA_NOT_FOUND: 'INFRA_NOT_FOUND',
    BUSINESS_INVALID_STATE: 'BUSINESS_INVALID_STATE',
  },
  isAppError: () => false,
}));

jest.mock('@/schemas', () => ({
  parseUserDocument: jest.fn((data: Record<string, unknown>) => data),
}));

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    USERS: 'users',
    APPLICATIONS: 'applications',
    WORK_LOGS: 'workLogs',
    NOTIFICATIONS: 'notifications',
  },
  FIELDS: {
    APPLICATION: {
      applicantId: 'applicantId',
    },
    WORK_LOG: {
      staffId: 'staffId',
    },
    NOTIFICATION: {
      recipientId: 'recipientId',
    },
  },
  STATUS: {
    DELETION_REQUEST: {
      PENDING: 'pending',
      CANCELLED: 'cancelled',
    },
  },
  FIREBASE_LIMITS: {
    WHERE_IN_MAX_ITEMS: 30,
    BATCH_MAX_OPERATIONS: 500,
  },
}));

jest.mock('@/utils/date', () => ({
  toDate: jest.fn(() => new Date('2025-01-01T00:00:00.000Z')),
}));

jest.mock('@/shared/time', () => ({
  TimeNormalizer: {
    parseTime: jest.fn(() => new Date('2025-01-01T09:00:00.000Z')),
  },
}));

function createSnapshotDocs(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    ref: {
      path: `${prefix}/${index + 1}`,
    },
    data: () => ({}),
  }));
}

function createDeletionRequest(status: 'pending' | 'cancelled' = 'pending') {
  return {
    userId: 'user-1',
    reason: 'other',
    requestedAt: { seconds: 1 },
    scheduledDeletionAt: { seconds: 2 },
    status,
  };
}

describe('FirebaseUserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batchInstances.length = 0;
  });

  it('chunks permanent deletion work and clears known user subcollections', async () => {
    const repository = new FirebaseUserRepository();

    (getDocs as jest.Mock)
      .mockResolvedValueOnce({ docs: createSnapshotDocs('applications', 498) })
      .mockResolvedValueOnce({ docs: createSnapshotDocs('workLogs', 2) })
      .mockResolvedValueOnce({ docs: createSnapshotDocs('notifications', 2) })
      .mockResolvedValueOnce({
        docs: [{ ref: { path: 'users/user-1/consents/employer_registration' } }],
      })
      .mockResolvedValueOnce({
        docs: [{ ref: { path: 'users/user-1/notificationSettings/default' } }],
      })
      .mockResolvedValueOnce({
        docs: [{ ref: { path: 'users/user-1/counters/notifications' } }],
      });

    await repository.permanentlyDeleteWithBatch('user-1');

    expect(writeBatch).toHaveBeenCalledTimes(2);
    batchInstances.forEach((batch) => {
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    const deletedPaths = batchInstances.flatMap((batch) =>
      batch.delete.mock.calls.map(([ref]) => (ref as { path: string }).path)
    );

    expect(deletedPaths).toContain('users/user-1/consents/employer_registration');
    expect(deletedPaths).toContain('users/user-1/notificationSettings/default');
    expect(deletedPaths).toContain('users/user-1/counters/notifications');
    expect(deletedPaths).toContain('users/user-1');
  });

  it('falls back to legacy deletion request documents when the inline field is missing', async () => {
    const repository = new FirebaseUserRepository();

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({}),
    });
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [
        {
          data: () => createDeletionRequest(),
        },
      ],
    });

    const result = await repository.getDeletionStatus('user-1');

    expect(result).toEqual(createDeletionRequest());
  });

  it('cancels pending legacy deletion request documents together with the inline status', async () => {
    const repository = new FirebaseUserRepository();
    (toDate as jest.Mock).mockReturnValueOnce(new Date('2099-01-01T00:00:00.000Z'));

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        deletionRequest: createDeletionRequest(),
      }),
    });
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [
        {
          ref: { path: 'users/user-1/deletionRequests/current' },
          data: () => createDeletionRequest(),
        },
        {
          ref: { path: 'users/user-1/deletionRequests/old' },
          data: () => createDeletionRequest('cancelled'),
        },
      ],
    });

    await repository.cancelDeletion('user-1');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1' }),
      expect.objectContaining({
        status: 'active',
        deletionRequest: expect.objectContaining({
          status: 'cancelled',
        }),
      })
    );
    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(batchInstances[0]?.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/user-1/deletionRequests/current' }),
      { status: 'cancelled' }
    );
    expect(batchInstances[0]?.commit).toHaveBeenCalledTimes(1);
  });
});
