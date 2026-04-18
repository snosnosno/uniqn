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

  it('serializes Date values into ISO strings (top-level and nested)', () => {
    const createdAt = new Date('2025-03-01T10:00:00.000Z');
    const updatedAt = new Date('2025-03-02T11:30:00.000Z');

    setCriticalOfflineCache(
      'offline-cache:test',
      {
        createdAt,
        nested: {
          updatedAt,
        },
      },
      {
        userId: 'user-1',
      }
    );

    const cached = getCriticalOfflineCache<{
      createdAt: string;
      nested: { updatedAt: string };
    }>('offline-cache:test', {
      userId: 'user-1',
    });

    expect(cached?.data.createdAt).toBe(createdAt.toISOString());
    expect(cached?.data.nested.updatedAt).toBe(updatedAt.toISOString());
  });

  it('preserves null and undefined values, recurses through arrays and plain objects', () => {
    setCriticalOfflineCache(
      'offline-cache:nested',
      {
        nullValue: null,
        list: [new Date('2025-03-03T00:00:00.000Z'), 'plain', 42],
        nested: {
          inner: { value: 'ok' },
        },
      },
      {
        userId: 'user-1',
      }
    );

    const cached = getCriticalOfflineCache<{
      nullValue: null;
      list: [string, string, number];
      nested: { inner: { value: string } };
    }>('offline-cache:nested', {
      userId: 'user-1',
    });

    expect(cached?.data.nullValue).toBeNull();
    expect(cached?.data.list[0]).toBe('2025-03-03T00:00:00.000Z');
    expect(cached?.data.list[1]).toBe('plain');
    expect(cached?.data.list[2]).toBe(42);
    expect(cached?.data.nested.inner.value).toBe('ok');
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
