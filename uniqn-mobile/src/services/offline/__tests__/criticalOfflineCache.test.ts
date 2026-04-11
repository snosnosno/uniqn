import { Timestamp } from '@/shared/time';
import { getMMKVInstance } from '@/lib/mmkvStorage';
import {
  clearCriticalOfflineCacheForUser,
  getCriticalOfflineCache,
  setCriticalOfflineCache,
} from '@/services/offline/criticalOfflineCache';

describe('criticalOfflineCache', () => {
  beforeEach(() => {
    getMMKVInstance().clearAll();
  });

  it('serializes Timestamp and Date values into cache-safe data', () => {
    const createdAt = new Date('2025-03-01T10:00:00.000Z');
    const updatedAt = new Date('2025-03-02T11:30:00.000Z');

    setCriticalOfflineCache(
      'offline-cache:test',
      {
        createdAt: Timestamp.fromDate(createdAt),
        nested: {
          updatedAt,
        },
      },
      {
        userId: 'user-1',
      }
    );

    const cached = getCriticalOfflineCache<{
      createdAt: { seconds: number; nanoseconds: number };
      nested: { updatedAt: string };
    }>('offline-cache:test', {
      userId: 'user-1',
    });

    expect(cached?.data.createdAt.seconds).toBe(Math.floor(createdAt.getTime() / 1000));
    expect(cached?.data.nested.updatedAt).toBe(updatedAt.toISOString());
  });

  it('removes only the targeted user scoped cache entries', () => {
    setCriticalOfflineCache('offline-cache:user-1', { value: 1 }, { userId: 'user-1' });
    setCriticalOfflineCache('offline-cache:user-2', { value: 2 }, { userId: 'user-2' });

    clearCriticalOfflineCacheForUser('user-1');

    expect(
      getCriticalOfflineCache<{ value: number }>('offline-cache:user-1', {
        userId: 'user-1',
      })
    ).toBeNull();

    expect(
      getCriticalOfflineCache<{ value: number }>('offline-cache:user-2', {
        userId: 'user-2',
      })?.data.value
    ).toBe(2);
  });

  it('discards cache entries when the schema version does not match', () => {
    setCriticalOfflineCache('offline-cache:schema', { value: 1 }, { schemaVersion: 1 });

    expect(
      getCriticalOfflineCache<{ value: number }>('offline-cache:schema', {
        schemaVersion: 2,
      })
    ).toBeNull();
  });
});
