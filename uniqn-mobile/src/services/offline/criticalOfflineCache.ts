import { getMMKVInstance } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';

export interface CachedEnvelope<T> {
  version: number;
  userId?: string;
  cachedAt: number;
  schemaVersion: number;
  data: T;
}

export interface CacheSerializer<T> {
  serialize: (value: T) => unknown;
  deserialize: (value: unknown) => T;
}

interface CacheReadOptions {
  ttlMs?: number;
  userId?: string;
  schemaVersion?: number;
}

interface CacheWriteOptions {
  schemaVersion?: number;
  userId?: string;
}

const OFFLINE_CACHE_VERSION = 1;
const OFFLINE_CACHE_PREFIX = 'critical-offline-cache';

type SerializedTimestamp = {
  seconds: number;
  nanoseconds: number;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (isDate(value)) {
    return value.toISOString();
  }

  if (isTimestampLike(value)) {
    const date = value.toDate();
    const milliseconds = date.getTime();
    const seconds = Math.floor(milliseconds / 1000);
    const nanoseconds = (milliseconds % 1000) * 1_000_000;
    const serialized: SerializedTimestamp = { seconds, nanoseconds };
    return serialized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      if (typeof entryValue === 'function' || entryValue === undefined) {
        return acc;
      }

      acc[key] = serializeValue(entryValue);
      return acc;
    }, {});
  }

  return value;
}

function createDefaultSerializer<T>(): CacheSerializer<T> {
  return {
    serialize: (value) => serializeValue(value),
    deserialize: (value) => value as T,
  };
}

function buildStorageKey(key: string): string {
  return `${OFFLINE_CACHE_PREFIX}:v${OFFLINE_CACHE_VERSION}:${key}`;
}

export function getCriticalOfflineCache<T>(
  key: string,
  options: CacheReadOptions = {},
  serializer: CacheSerializer<T> = createDefaultSerializer<T>()
): CachedEnvelope<T> | null {
  const storage = getMMKVInstance();
  const raw = storage.getString(buildStorageKey(key));

  if (!raw) {
    logger.debug('offline_cache_miss', {
      component: 'criticalOfflineCache',
      key,
    });
    return null;
  }

  try {
    const envelope = JSON.parse(raw) as CachedEnvelope<unknown>;

    if (
      typeof options.userId === 'string' &&
      envelope.userId &&
      envelope.userId !== options.userId
    ) {
      logger.warn('Discarded user-scoped offline cache for mismatched user', {
        component: 'criticalOfflineCache',
        key,
        cacheUserId: envelope.userId,
        expectedUserId: options.userId,
      });
      storage.delete(buildStorageKey(key));
      return null;
    }

    if (
      typeof options.schemaVersion === 'number' &&
      envelope.schemaVersion !== options.schemaVersion
    ) {
      logger.info('offline_cache_schema_mismatch', {
        component: 'criticalOfflineCache',
        key,
        cachedSchemaVersion: envelope.schemaVersion,
        expectedSchemaVersion: options.schemaVersion,
      });
      storage.delete(buildStorageKey(key));
      return null;
    }

    if (
      typeof options.ttlMs === 'number' &&
      Number.isFinite(options.ttlMs) &&
      options.ttlMs > 0 &&
      Date.now() - envelope.cachedAt > options.ttlMs
    ) {
      logger.info('offline_cache_expired', {
        component: 'criticalOfflineCache',
        key,
        cachedAt: envelope.cachedAt,
        ttlMs: options.ttlMs,
      });
      storage.delete(buildStorageKey(key));
      return null;
    }

    logger.info('offline_cache_hit', {
      component: 'criticalOfflineCache',
      key,
      cachedAt: envelope.cachedAt,
    });

    return {
      ...envelope,
      data: serializer.deserialize(envelope.data),
    } as CachedEnvelope<T>;
  } catch (error) {
    logger.warn('Failed to read offline cache', {
      component: 'criticalOfflineCache',
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    storage.delete(buildStorageKey(key));
    return null;
  }
}

export function setCriticalOfflineCache<T>(
  key: string,
  data: T,
  options: CacheWriteOptions = {},
  serializer: CacheSerializer<T> = createDefaultSerializer<T>()
) {
  const storage = getMMKVInstance();
  const envelope: CachedEnvelope<unknown> = {
    version: OFFLINE_CACHE_VERSION,
    userId: options.userId,
    cachedAt: Date.now(),
    schemaVersion: options.schemaVersion ?? OFFLINE_CACHE_VERSION,
    data: serializer.serialize(data),
  };

  try {
    storage.set(buildStorageKey(key), JSON.stringify(envelope));
  } catch (error) {
    logger.warn('Failed to write offline cache', {
      component: 'criticalOfflineCache',
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function removeCriticalOfflineCache(key: string) {
  getMMKVInstance().delete(buildStorageKey(key));
}

export function clearCriticalOfflineCacheForUser(userId?: string | null) {
  if (!userId) {
    return;
  }

  const storage = getMMKVInstance();
  const keys = storage.getAllKeys();

  keys.forEach((rawKey) => {
    if (!rawKey.startsWith(`${OFFLINE_CACHE_PREFIX}:v${OFFLINE_CACHE_VERSION}:`)) {
      return;
    }

    const value = storage.getString(rawKey);
    if (!value) {
      return;
    }

    try {
      const parsed = JSON.parse(value) as CachedEnvelope<unknown>;
      if (parsed.userId === userId) {
        storage.delete(rawKey);
      }
    } catch {
      storage.delete(rawKey);
    }
  });
}

export function createUserScopedCacheKey(section: string, userId: string, suffix?: string): string {
  return [section, userId, suffix].filter(Boolean).join(':');
}

export const criticalOfflineCache = {
  get: getCriticalOfflineCache,
  set: setCriticalOfflineCache,
  remove: removeCriticalOfflineCache,
  clearForUser: clearCriticalOfflineCacheForUser,
  createUserScopedKey: createUserScopedCacheKey,
};
