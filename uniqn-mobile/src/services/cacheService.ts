/**
 * UNIQN Mobile - 캐시 관리 서비스
 *
 * @description React Query 캐시 + MMKV 캐시 통합 관리
 * @version 1.0.0
 */

import { logger } from '@/utils/logger';
import { queryClient } from '@/lib/queryClient';
import {
  getMMKVInstance,
  STORAGE_KEYS,
  removeStorageItem,
} from '@/lib/mmkvStorage';
import { toError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

export interface CacheStats {
  /** React Query 캐시된 쿼리 수 */
  queryCount: number;
  /** MMKV 캐시 키 수 */
  mmkvCacheKeyCount: number;
  /** 캐시 가능한 키 목록 */
  cacheKeys: string[];
}

export interface ClearCacheOptions {
  /** React Query 캐시 삭제 (기본: true) */
  clearQueryCache?: boolean;
  /** MMKV 캐시 삭제 (기본: true) */
  clearMMKVCache?: boolean;
  /** 검색 기록 삭제 (기본: true) */
  clearSearchHistory?: boolean;
  /** 인증 정보 유지 (기본: true) */
  keepAuth?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** 캐시 삭제 대상 MMKV 키 목록 */
const CACHE_KEYS_TO_CLEAR = [
  STORAGE_KEYS.JOB_POSTINGS_CACHE,
  STORAGE_KEYS.SCHEDULES_CACHE,
  STORAGE_KEYS.SEARCH_HISTORY,
  STORAGE_KEYS.RECENT_JOBS,
  STORAGE_KEYS.FORM_DRAFT,
] as const;

/** 삭제하면 안 되는 키 목록 (인증 관련) */
const PROTECTED_KEYS = [
  STORAGE_KEYS.AUTH,
  STORAGE_KEYS.AUTH_TOKEN,
  STORAGE_KEYS.REFRESH_TOKEN,
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.NOTIFICATIONS,
  STORAGE_KEYS.PREFERENCES,
] as const;

// ============================================================================
// Functions
// ============================================================================

/**
 * 캐시 통계 조회
 */
export function getCacheStats(): CacheStats {
  const storage = getMMKVInstance();
  const queryCache = queryClient.getQueryCache();

  // React Query 캐시 수
  const queryCount = queryCache.getAll().length;

  // MMKV 캐시 키 수 (삭제 가능한 것만)
  const allKeys = storage.getAllKeys();
  const cacheKeys = allKeys.filter(
    (key) =>
      CACHE_KEYS_TO_CLEAR.includes(key as (typeof CACHE_KEYS_TO_CLEAR)[number])
  );

  return {
    queryCount,
    mmkvCacheKeyCount: cacheKeys.length,
    cacheKeys,
  };
}

/**
 * 캐시 전체 삭제
 *
 * @param options 삭제 옵션
 * @returns 삭제된 항목 수
 */
export async function clearAllCache(
  options: ClearCacheOptions = {}
): Promise<{ queryCleared: number; mmkvCleared: number }> {
  const {
    clearQueryCache = true,
    clearMMKVCache = true,
    clearSearchHistory = true,
    keepAuth = true,
  } = options;

  let queryCleared = 0;
  let mmkvCleared = 0;

  try {
    // 1. React Query 캐시 삭제
    if (clearQueryCache) {
      const queryCache = queryClient.getQueryCache();
      queryCleared = queryCache.getAll().length;

      // 캐시 전체 초기화 (인증 쿼리 제외 시 선택적 삭제 가능)
      queryClient.clear();

      logger.info('React Query 캐시 삭제 완료', { count: queryCleared });
    }

    // 2. MMKV 캐시 삭제
    if (clearMMKVCache) {
      const keysToDelete: string[] = [];

      // 기본 캐시 키들
      keysToDelete.push(
        STORAGE_KEYS.JOB_POSTINGS_CACHE,
        STORAGE_KEYS.SCHEDULES_CACHE,
        STORAGE_KEYS.RECENT_JOBS,
        STORAGE_KEYS.FORM_DRAFT
      );

      // 검색 기록 (옵션)
      if (clearSearchHistory) {
        keysToDelete.push(STORAGE_KEYS.SEARCH_HISTORY);
      }

      // 인증 관련 제외
      const finalKeys = keepAuth
        ? keysToDelete.filter(
            (key) => !PROTECTED_KEYS.includes(key as (typeof PROTECTED_KEYS)[number])
          )
        : keysToDelete;

      // 삭제 실행
      finalKeys.forEach((key) => {
        try {
          removeStorageItem(key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]);
          mmkvCleared++;
        } catch (e) {
          logger.warn('MMKV 키 삭제 실패', { key, error: e });
        }
      });

      logger.info('MMKV 캐시 삭제 완료', { count: mmkvCleared });
    }

    logger.info('캐시 삭제 완료', {
      queryCleared,
      mmkvCleared,
      options,
    });

    return { queryCleared, mmkvCleared };
  } catch (error) {
    logger.error('캐시 삭제 실패', toError(error));
    throw error;
  }
}

/**
 * 검색 기록만 삭제
 */
export function clearSearchHistory(): void {
  try {
    removeStorageItem(STORAGE_KEYS.SEARCH_HISTORY);
    logger.info('검색 기록 삭제 완료');
  } catch (error) {
    logger.error('검색 기록 삭제 실패', toError(error));
  }
}

/**
 * 공고 캐시만 삭제
 */
export function clearJobPostingsCache(): void {
  try {
    removeStorageItem(STORAGE_KEYS.JOB_POSTINGS_CACHE);
    removeStorageItem(STORAGE_KEYS.RECENT_JOBS);
    queryClient.invalidateQueries({ queryKey: ['jobPostings'] });
    logger.info('공고 캐시 삭제 완료');
  } catch (error) {
    logger.error('공고 캐시 삭제 실패', toError(error));
  }
}

/**
 * 스케줄 캐시만 삭제
 */
export function clearSchedulesCache(): void {
  try {
    removeStorageItem(STORAGE_KEYS.SCHEDULES_CACHE);
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    logger.info('스케줄 캐시 삭제 완료');
  } catch (error) {
    logger.error('스케줄 캐시 삭제 실패', toError(error));
  }
}

// ============================================================================
// Export
// ============================================================================

export const cacheService = {
  getCacheStats,
  clearAllCache,
  clearSearchHistory,
  clearJobPostingsCache,
  clearSchedulesCache,
};

export default cacheService;
