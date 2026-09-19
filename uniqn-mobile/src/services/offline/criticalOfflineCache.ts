import { getMMKVInstance } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
// 타입만 가져온다(런타임 import 아님) — lib/queryClient 는 이 모듈을 import 하지 않으므로
// 순환도 없다. 값의 정체를 타입으로 강제하는 것이 목적이다(아래 ttlMs 주석 참조).
import type { OfflineTtlMs } from '@/lib/queryClient';

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
  /**
   * 오프라인 보존기간. 🔴 **온라인 `staleTime` 을 여기 넘기지 말 것** — 만료는 stale 표시가
   * 아니라 **완전 삭제**(:133-147)라, 30초~10분짜리 값을 꽂으면 지하에서 화면이
   * "데이터 없음"으로 위장된다. 그래서 맨 `number` 를 받지 않고 `offlineCachePolicies`
   * 만 만들 수 있는 `OfflineTtlMs` 로 좁혔다(감사 M6 — 같은 실수가 6곳까지 늘었다).
   */
  ttlMs?: OfflineTtlMs;
  userId?: string;
  schemaVersion?: number;
}

interface CacheWriteOptions {
  schemaVersion?: number;
  userId?: string;
}

const OFFLINE_CACHE_VERSION = 1;
const OFFLINE_CACHE_PREFIX = 'critical-offline-cache';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * MMKV 직렬화 — Date → ISO string으로 저장. 다음 read 시 timestampSchema가 string을
 * 그대로 통과시킴 (이미 string이라 정규화 작업 없음, fast path).
 *
 * 기존 사용자 디바이스의 {seconds, nanoseconds} 형태 캐시는 다음 read 시 변경된
 * timestampSchema가 자동으로 ISO string으로 정규화하므로 마이그레이션 불필요.
 */
function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isDate(value)) return value.toISOString();

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
      if (typeof entryValue === 'function' || entryValue === undefined) return acc;
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
