import {
  buildRegisterFcmTokenUpdate,
  FirebaseNotificationRepository,
} from '@/repositories/firebase/NotificationRepository';

const mockOnSnapshot = jest.fn();
const mockRealtimeSubscribe = jest.fn((_key: string, factory: () => () => void) => factory());
const mockForceRemove = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ _type: 'collection' })),
  doc: jest.fn(() => ({ _type: 'doc' })),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  deleteField: jest.fn(() => ({ _deleteField: true })),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(),
  })),
  runTransaction: jest.fn(),
  query: jest.fn(() => ({ _type: 'query' })),
  where: jest.fn(() => ({ _type: 'where' })),
  orderBy: jest.fn(() => ({ _type: 'orderBy' })),
  limit: jest.fn(() => ({ _type: 'limit' })),
  onSnapshot: (
    queryArg: unknown,
    onNext: (snapshot: unknown) => void,
    onError?: (error: Error) => void
  ) => mockOnSnapshot(queryArg, onNext, onError),
  Timestamp: {
    fromDate: jest.fn((date: Date) => date),
  },
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
  getCountFromServer: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

jest.mock('@/shared/realtime', () => ({
  RealtimeManager: {
    subscribe: (key: string, factory: () => () => void) => mockRealtimeSubscribe(key, factory),
    forceRemove: (key: string) => mockForceRemove(key),
    Keys: {
      notifications: (userId: string) => `notifications:${userId}`,
      unreadCount: (userId: string) => `unreadCount:${userId}`,
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/errors', () => ({
  toError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
  normalizeError: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
}));

jest.mock('@/constants', () => ({
  COLLECTIONS: {
    NOTIFICATIONS: 'notifications',
    USERS: 'users',
  },
  FIREBASE_LIMITS: {
    BATCH_MAX_OPERATIONS: 500,
    WHERE_IN_MAX_ITEMS: 10,
  },
  FIELDS: {
    NOTIFICATION: {
      recipientId: 'recipientId',
      createdAt: 'createdAt',
      isRead: 'isRead',
    },
  },
}));

jest.mock('@/schemas', () => ({
  parseNotificationSettingsDocument: jest.fn(),
}));

jest.mock('@/types/notification', () => jest.requireActual('@/types/notification'));

const mockedLogger = jest.requireMock('@/utils/logger').logger as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};

function createLegacyTokenKey(token: string): string {
  return token.substring(0, 32).replace(/[^a-zA-Z0-9]/g, '_');
}

describe('NotificationRepository token helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildRegisterFcmTokenUpdate', () => {
    it('adds a new token, removes the legacy key, and evicts the oldest token at the limit', () => {
      const token = 'ExponentPushToken[new-device-token]';
      const currentTokens = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
          `existing-${index}`,
          {
            registeredAt: {
              toMillis: () => index + 1,
            },
          },
        ])
      );

      const result = buildRegisterFcmTokenUpdate(currentTokens, token, {
        type: 'expo',
        platform: 'ios',
      });

      const newTokenKey = Object.keys(result).find((key) => key.startsWith('fcmTokens.tk_'));

      expect(newTokenKey).toBeDefined();
      expect(result['fcmTokens.existing-0']).toBeDefined();
      expect(result[`fcmTokens.${createLegacyTokenKey(token)}`]).toBeDefined();
    });

    it('does not evict another token when the same device token is already stored under the legacy key', () => {
      const token = 'ExponentPushToken[already-stored-device]';
      const legacyTokenKey = createLegacyTokenKey(token);
      const currentTokens = Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [
          `existing-${index}`,
          {
            registeredAt: {
              toMillis: () => index + 1,
            },
          },
        ])
      ) as Record<string, { registeredAt: { toMillis: () => number } }>;

      currentTokens[legacyTokenKey] = {
        registeredAt: {
          toMillis: () => 999,
        },
      };

      const result = buildRegisterFcmTokenUpdate(currentTokens, token, {
        type: 'expo',
        platform: 'android',
      });

      expect(result['fcmTokens.existing-0']).toBeUndefined();
      expect(result[`fcmTokens.${legacyTokenKey}`]).toBeDefined();
    });
  });
});

describe('FirebaseNotificationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('subscribeToNotifications', () => {
    it('logs snapshot counts and warns once when the realtime limit is reached', () => {
      const repository = new FirebaseNotificationRepository();
      const onNotifications = jest.fn();
      const onError = jest.fn();
      const snapshot = {
        size: 50,
        docs: [
          {
            id: 'notification-1',
            data: () => ({
              recipientId: 'user-1',
              type: 'announcement',
              title: 'title',
              body: 'body',
              link: '/notices',
              data: { announcementId: 'announcement-1' },
              isRead: false,
              createdAt: new Date('2025-01-01T00:00:00.000Z'),
            }),
          },
        ],
      };

      mockOnSnapshot.mockImplementation((_query, onNext) => {
        onNext(snapshot);
        onNext(snapshot);
        return jest.fn();
      });

      repository.subscribeToNotifications('user-1', onNotifications, onError);

      expect(mockedLogger.info).toHaveBeenCalledWith('notification_realtime_snapshot_count', {
        listener: 'notifications',
        count: 50,
        limit: 50,
      });
      expect(mockedLogger.warn).toHaveBeenCalledWith('notification_realtime_limit_reached', {
        listener: 'notifications',
        count: 50,
        limit: 50,
      });
      expect(
        mockedLogger.warn.mock.calls.filter(
          ([message]: [string]) => message === 'notification_realtime_limit_reached'
        )
      ).toHaveLength(1);
      expect(onNotifications).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'notification-1',
          recipientId: 'user-1',
        }),
      ]);
      expect(onError).not.toHaveBeenCalled();
    });

    it('derives category and priority from the runtime notification type map', () => {
      const repository = new FirebaseNotificationRepository();
      const onNotifications = jest.fn();
      const onError = jest.fn();
      const snapshot = {
        size: 1,
        docs: [
          {
            id: 'notification-review-1',
            data: () => ({
              recipientId: 'user-1',
              type: 'review_received',
              title: '리뷰가 등록되었어요',
              body: '새 리뷰를 확인해 주세요.',
              link: '/reviews/review-1',
              data: { reviewId: 'review-1' },
              isRead: false,
              createdAt: new Date('2025-01-01T00:00:00.000Z'),
            }),
          },
        ],
      };

      mockOnSnapshot.mockImplementation((_query, onNext) => {
        onNext(snapshot);
        return jest.fn();
      });

      repository.subscribeToNotifications('user-1', onNotifications, onError);

      expect(onNotifications).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 'notification-review-1',
          type: 'review_received',
          category: 'review',
          priority: 'normal',
        }),
      ]);
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
