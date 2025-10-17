/**
 * useSmartCache.ts - UnifiedDataContext와 통합된 스마트 캐싱 훅
 * Week 4 성능 최적화: Firebase 호출을 90% 감소시키는 지능형 캐싱
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import smartCache from '../utils/smartCache';
import { logger } from '../utils/logger';

interface CacheHookOptions {
  enableCache?: boolean;
  defaultTTL?: number;
  namespace?: string;
  tags?: string[];
  enableOptimisticUpdates?: boolean;
}

interface CacheHookResult<T> {
  // 캐시 작업
  getCached: (key: string) => Promise<T | null>;
  setCached: (key: string, data: T, options?: { ttl?: number; tags?: string[] }) => Promise<void>;
  invalidate: (key: string) => Promise<boolean>;
  invalidateByTags: (tags: string[]) => Promise<number>;
  
  // 캐시 전략
  getOrFetch: <R>(
    key: string,
    fetcher: () => Promise<R>,
    options?: { 
      ttl?: number; 
      tags?: string[];
      forceRefresh?: boolean;
      staleWhileRevalidate?: boolean;
    }
  ) => Promise<R>;
  
  // 캐시 상태
  isEnabled: boolean;
  stats: ReturnType<typeof smartCache.getStats>;
  
  // 유틸리티
  generateKey: (parts: string[]) => string;
  prefetch: (key: string, fetcher: () => Promise<T>) => Promise<void>;
}

const DEFAULT_OPTIONS: Required<CacheHookOptions> = {
  enableCache: true,
  defaultTTL: 30 * 60 * 1000, // 30분
  namespace: 'unified-data',
  tags: [],
  enableOptimisticUpdates: true
};

export const useSmartCache = <T = any>(options: CacheHookOptions = {}): CacheHookResult<T> => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const statsRef = useRef(smartCache.getStats());
  const pendingRequests = useRef(new Map<string, Promise<any>>());

  // 주기적으로 통계 업데이트
  useEffect(() => {
    if (!config.enableCache) return;

    const updateStats = () => {
      statsRef.current = smartCache.getStats();
    };

    const interval = setInterval(updateStats, 5000); // 5초마다 업데이트
    updateStats(); // 초기 업데이트

    return () => clearInterval(interval);
  }, [config.enableCache]);

  // 캐시 키 생성
  const generateKey = useCallback((parts: string[]): string => {
    return parts.filter(Boolean).join(':');
  }, []);

  // 캐시에서 데이터 조회
  const getCached = useCallback(async (key: string): Promise<T | null> => {
    if (!config.enableCache) {
      return null;
    }

    try {
      const result = await smartCache.get<T>(config.namespace, key);
      return result;
    } catch (error) {
      logger.error('캐시 조회 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'useSmartCache',
        data: { namespace: config.namespace, key }
      });
      return null;
    }
  }, [config.enableCache, config.namespace]);

  // 캐시에 데이터 저장
  const setCached = useCallback(async (
    key: string, 
    data: T, 
    options?: { ttl?: number; tags?: string[] }
  ): Promise<void> => {
    if (!config.enableCache) {
      return;
    }

    try {
      await smartCache.set(config.namespace, key, data, {
        ttl: options?.ttl || config.defaultTTL,
        tags: [...config.tags, ...(options?.tags || [])],
        version: 1
      });
    } catch (error) {
      logger.error('캐시 저장 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'useSmartCache',
        data: { namespace: config.namespace, key }
      });
      // 캐시 저장 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }, [config.enableCache, config.namespace, config.defaultTTL, config.tags]);

  // 캐시 무효화
  const invalidate = useCallback(async (key: string): Promise<boolean> => {
    if (!config.enableCache) {
      return false;
    }

    try {
      const result = await smartCache.delete(config.namespace, key);
      return result;
    } catch (error) {
      logger.error('캐시 무효화 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'useSmartCache',
        data: { namespace: config.namespace, key }
      });
      return false;
    }
  }, [config.enableCache, config.namespace]);

  // 태그별 캐시 무효화
  const invalidateByTags = useCallback(async (tags: string[]): Promise<number> => {
    if (!config.enableCache) {
      return 0;
    }

    try {
      const count = await smartCache.invalidateByTags(tags);
      return count;
    } catch (error) {
      logger.error('태그별 캐시 무효화 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'useSmartCache',
        data: { tags }
      });
      return 0;
    }
  }, [config.enableCache]);

  // 캐시 우선 조회 후 없으면 fetcher 실행
  const getOrFetch = useCallback(async <R>(
    key: string,
    fetcher: () => Promise<R>,
    options?: {
      ttl?: number;
      tags?: string[];
      forceRefresh?: boolean;
      staleWhileRevalidate?: boolean;
    }
  ): Promise<R> => {
    const fullKey = generateKey([config.namespace, key]);

    // 강제 새로고침이면 캐시 무시
    if (options?.forceRefresh) {
      const result = await fetcher();
      const cacheOptions: { ttl?: number; tags?: string[] } = {};
      if (options.ttl !== undefined) cacheOptions.ttl = options.ttl;
      if (options.tags !== undefined) cacheOptions.tags = options.tags;

      await setCached(key, result as unknown as T, cacheOptions);
      return result;
    }

    // 중복 요청 방지
    if (pendingRequests.current.has(fullKey)) {
      return pendingRequests.current.get(fullKey)!;
    }

    // 캐시에서 먼저 조회
    if (config.enableCache) {
      const cached = await getCached(key);
      if (cached) {
        // Stale-While-Revalidate 전략
        if (options?.staleWhileRevalidate) {
          Promise.resolve().then(async () => {
            try {
              const fresh = await fetcher();
              const freshCacheOptions: { ttl?: number; tags?: string[] } = {};
              if (options.ttl !== undefined) freshCacheOptions.ttl = options.ttl;
              if (options.tags !== undefined) freshCacheOptions.tags = options.tags;

              await setCached(key, fresh as unknown as T, freshCacheOptions);
            } catch (error) {
              logger.warn(`백그라운드 갱신 실패 [${key}]: ${error instanceof Error ? error.message : String(error)}`);
            }
          });
        }

        return cached as R;
      }
    }

    const fetchPromise = fetcher().then(async (result) => {
      if (config.enableCache) {
        const mainCacheOptions: { ttl?: number; tags?: string[] } = {};
        if (options?.ttl !== undefined) mainCacheOptions.ttl = options.ttl;
        if (options?.tags !== undefined) mainCacheOptions.tags = options.tags;
        
        await setCached(key, result as unknown as T, mainCacheOptions);
      }
      
      pendingRequests.current.delete(fullKey);
      return result;
    }).catch((error) => {
      pendingRequests.current.delete(fullKey);
      throw error;
    });

    pendingRequests.current.set(fullKey, fetchPromise);
    return fetchPromise;
  }, [config.enableCache, config.namespace, generateKey, getCached, setCached]);

  // 프리패치 (백그라운드에서 미리 로딩)
  const prefetch = useCallback(async (key: string, fetcher: () => Promise<T>): Promise<void> => {
    if (!config.enableCache) {
      return;
    }

    const cached = await getCached(key);
    if (cached) {
      return;
    }

    try {
      const result = await fetcher();
      const prefetchCacheOptions: { ttl?: number; tags?: string[] } = {};
      if (config.defaultTTL !== undefined) prefetchCacheOptions.ttl = config.defaultTTL;
      if (config.tags !== undefined) prefetchCacheOptions.tags = config.tags;

      await setCached(key, result, prefetchCacheOptions);
    } catch (error) {
      logger.warn(`프리패치 실패 [${key}]: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [config.enableCache, config.defaultTTL, config.tags, getCached, setCached]);

  // 메모이제이션된 반환값
  return useMemo(() => ({
    getCached,
    setCached,
    invalidate,
    invalidateByTags,
    getOrFetch,
    isEnabled: config.enableCache,
    stats: statsRef.current,
    generateKey,
    prefetch
  }), [
    getCached,
    setCached,
    invalidate,
    invalidateByTags,
    getOrFetch,
    config.enableCache,
    generateKey,
    prefetch
  ]);
};

export default useSmartCache;

// 편의를 위한 특화된 훅들
export const useJobPostingCache = () => useSmartCache({
  namespace: 'job-postings',
  defaultTTL: 15 * 60 * 1000, // 15분
  tags: ['job-postings']
});

export const useStaffCache = () => useSmartCache({
  namespace: 'staff',
  defaultTTL: 10 * 60 * 1000, // 10분
  tags: ['staff']
});

export const useWorkLogCache = () => useSmartCache({
  namespace: 'work-logs',
  defaultTTL: 5 * 60 * 1000, // 5분 (더 자주 변경)
  tags: ['work-logs']
});

export const useApplicationCache = () => useSmartCache({
  namespace: 'applications',
  defaultTTL: 10 * 60 * 1000, // 10분
  tags: ['applications']
});