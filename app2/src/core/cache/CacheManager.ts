/**
 * 통합 캐시 매니저 (SSOT)
 *
 * 이 파일은 T-HOLDEM 프로젝트의 캐시 관리를 표준화합니다.
 * 모든 캐시 로직은 이 모듈을 통해 관리되어야 합니다.
 *
 * @version 1.0
 * @since 2025-02-04
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - 컬렉션별 캐시 관리
 * - TTL(Time-To-Live) 지원
 * - 메모리 제한 및 LRU 정리
 * - 캐시 무효화 (개별/컬렉션/전체)
 *
 * @example
 * ```typescript
 * const cache = CacheManager.getInstance();
 *
 * // 데이터 저장
 * cache.set('users', 'user-123', userData);
 *
 * // 데이터 조회
 * const user = cache.get<User>('users', 'user-123');
 *
 * // TTL과 함께 저장
 * cache.set('sessions', 'session-abc', sessionData, { ttl: 3600000 });
 *
 * // 캐시 무효화
 * cache.invalidate('users', 'user-123');
 * cache.invalidateCollection('users');
 * cache.invalidateAll();
 * ```
 */

import { logger } from '../../utils/logger';

/**
 * 캐시 엔트리 인터페이스
 */
interface CacheEntry<T> {
  /** 저장된 데이터 */
  data: T;
  /** 저장 시간 (timestamp) */
  createdAt: number;
  /** 마지막 접근 시간 (LRU용) */
  lastAccessedAt: number;
  /** 만료 시간 (TTL, undefined면 무제한) */
  expiresAt?: number;
}

/**
 * 캐시 설정 옵션
 */
export interface CacheOptions {
  /** Time-To-Live (밀리초), undefined면 무제한 */
  ttl?: number;
  /** 캐시 우선순위 (높을수록 LRU에서 유지) */
  priority?: number;
}

/**
 * 컬렉션별 캐시 설정
 */
interface CollectionConfig {
  /** 최대 엔트리 수 */
  maxEntries: number;
  /** 기본 TTL (밀리초) */
  defaultTtl?: number;
}

/**
 * 캐시 통계
 */
export interface CacheStats {
  /** 전체 엔트리 수 */
  totalEntries: number;
  /** 컬렉션별 엔트리 수 */
  entriesByCollection: Record<string, number>;
  /** 캐시 히트 수 */
  hits: number;
  /** 캐시 미스 수 */
  misses: number;
  /** 히트율 (%) */
  hitRate: number;
}

/**
 * 통합 캐시 매니저 클래스
 *
 * 싱글톤 패턴으로 앱 전체에서 하나의 인스턴스만 사용합니다.
 */
export class CacheManager {
  private static instance: CacheManager;

  /** 컬렉션 → 키 → 엔트리 구조의 캐시 저장소 */
  private cache: Map<string, Map<string, CacheEntry<unknown>>>;

  /** 컬렉션별 설정 */
  private collectionConfigs: Map<string, CollectionConfig>;

  /** 기본 설정 */
  private defaultConfig: CollectionConfig = {
    maxEntries: 1000,
    defaultTtl: undefined, // 무제한
  };

  /** 캐시 통계 */
  private stats = {
    hits: 0,
    misses: 0,
  };

  private constructor() {
    this.cache = new Map();
    this.collectionConfigs = new Map();

    // 기본 컬렉션 설정
    this.setCollectionConfig('formatDate', { maxEntries: 1000, defaultTtl: 86400000 }); // 24시간
    this.setCollectionConfig('timeDisplay', { maxEntries: 500, defaultTtl: 86400000 });
    this.setCollectionConfig('timeSlotColor', { maxEntries: 200, defaultTtl: 86400000 });
    this.setCollectionConfig('workLogs', { maxEntries: 5000, defaultTtl: 300000 }); // 5분
    this.setCollectionConfig('jobPostings', { maxEntries: 500, defaultTtl: 300000 });
    this.setCollectionConfig('staff', { maxEntries: 1000, defaultTtl: 300000 });
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * 컬렉션 설정 지정
   */
  public setCollectionConfig(collection: string, config: Partial<CollectionConfig>): void {
    const currentConfig = this.collectionConfigs.get(collection) || { ...this.defaultConfig };
    this.collectionConfigs.set(collection, { ...currentConfig, ...config });
  }

  /**
   * 캐시에서 데이터 조회
   *
   * @param collection 컬렉션 이름
   * @param key 캐시 키
   * @returns 캐시된 데이터 또는 null
   */
  public get<T>(collection: string, key: string): T | null {
    const collectionCache = this.cache.get(collection);
    if (!collectionCache) {
      this.stats.misses++;
      return null;
    }

    const entry = collectionCache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // TTL 체크
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      collectionCache.delete(key);
      this.stats.misses++;
      return null;
    }

    // LRU 업데이트
    entry.lastAccessedAt = Date.now();
    this.stats.hits++;

    return entry.data as T;
  }

  /**
   * 캐시에 데이터 저장
   *
   * @param collection 컬렉션 이름
   * @param key 캐시 키
   * @param data 저장할 데이터
   * @param options 캐시 옵션
   */
  public set<T>(collection: string, key: string, data: T, options?: CacheOptions): void {
    let collectionCache = this.cache.get(collection);
    if (!collectionCache) {
      collectionCache = new Map();
      this.cache.set(collection, collectionCache);
    }

    const config = this.collectionConfigs.get(collection) || this.defaultConfig;
    const ttl = options?.ttl ?? config.defaultTtl;

    // 최대 엔트리 수 체크 및 LRU 정리
    if (collectionCache.size >= config.maxEntries) {
      this.evictLRU(collection, collectionCache);
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: ttl ? now + ttl : undefined,
    };

    collectionCache.set(key, entry);
  }

  /**
   * 캐시 존재 여부 확인
   */
  public has(collection: string, key: string): boolean {
    const collectionCache = this.cache.get(collection);
    if (!collectionCache) return false;

    const entry = collectionCache.get(key);
    if (!entry) return false;

    // TTL 체크
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      collectionCache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 개별 캐시 무효화
   *
   * @param collection 컬렉션 이름 (생략 시 모든 컬렉션)
   * @param key 캐시 키 (생략 시 컬렉션 전체)
   */
  public invalidate(collection?: string, key?: string): void {
    if (!collection) {
      // 전체 무효화
      this.invalidateAll();
      return;
    }

    const collectionCache = this.cache.get(collection);
    if (!collectionCache) return;

    if (!key) {
      // 컬렉션 전체 무효화
      this.invalidateCollection(collection);
      return;
    }

    // 개별 키 무효화
    collectionCache.delete(key);
  }

  /**
   * 컬렉션 전체 무효화
   */
  public invalidateCollection(collection: string): void {
    this.cache.delete(collection);

    logger.info(`[CacheManager] Collection invalidated: ${collection}`, {
      component: 'CacheManager',
    });
  }

  /**
   * 전체 캐시 무효화
   */
  public invalidateAll(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;

    logger.info('[CacheManager] All caches invalidated', {
      component: 'CacheManager',
    });
  }

  /**
   * 만료된 엔트리 정리
   */
  public cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    this.cache.forEach((collectionCache) => {
      const keysToDelete: string[] = [];
      collectionCache.forEach((entry, key) => {
        if (entry.expiresAt && now > entry.expiresAt) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => {
        collectionCache.delete(key);
        cleanedCount++;
      });
    });

    if (cleanedCount > 0) {
      logger.info(`[CacheManager] Cleaned up ${cleanedCount} expired entries`, {
        component: 'CacheManager',
      });
    }
  }

  /**
   * 캐시 통계 조회
   */
  public getStats(): CacheStats {
    const entriesByCollection: Record<string, number> = {};
    let totalEntries = 0;

    this.cache.forEach((collectionCache, collection) => {
      entriesByCollection[collection] = collectionCache.size;
      totalEntries += collectionCache.size;
    });

    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      totalEntries,
      entriesByCollection,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * LRU 기반 캐시 정리
   */
  private evictLRU(collection: string, collectionCache: Map<string, CacheEntry<unknown>>): void {
    // 가장 오래 전에 접근된 10%의 엔트리 제거
    const entries = Array.from(collectionCache.entries());
    if (entries.length === 0) return;

    entries.sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    const evictCount = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      const entry = entries[i];
      if (entry) {
        collectionCache.delete(entry[0]);
      }
    }

    logger.info(`[CacheManager] Evicted ${evictCount} LRU entries from ${collection}`, {
      component: 'CacheManager',
    });
  }
}

// =============================================================================
// 편의 함수 (싱글톤 인스턴스 사용)
// =============================================================================

/**
 * 캐시 매니저 인스턴스 반환
 */
export const getCache = (): CacheManager => CacheManager.getInstance();

/**
 * 캐시에서 데이터 조회 (단축 함수)
 */
export const cacheGet = <T>(collection: string, key: string): T | null => {
  return CacheManager.getInstance().get<T>(collection, key);
};

/**
 * 캐시에 데이터 저장 (단축 함수)
 */
export const cacheSet = <T>(
  collection: string,
  key: string,
  data: T,
  options?: CacheOptions
): void => {
  CacheManager.getInstance().set(collection, key, data, options);
};

/**
 * 캐시 무효화 (단축 함수)
 */
export const cacheInvalidate = (collection?: string, key?: string): void => {
  CacheManager.getInstance().invalidate(collection, key);
};

/**
 * 캐시 통계 조회 (단축 함수)
 */
export const getCacheStats = (): CacheStats => {
  return CacheManager.getInstance().getStats();
};

export default CacheManager;
