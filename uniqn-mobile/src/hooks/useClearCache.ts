/**
 * UNIQN Mobile - 캐시 삭제 훅
 *
 * @description 캐시 삭제 기능 제공
 * @version 1.0.0
 */

import { useState, useCallback, useEffect } from 'react';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { cacheService, type CacheStats, type ClearCacheOptions } from '@/services/cacheService';
import { useToastStore } from '@/stores';

// ============================================================================
// Types
// ============================================================================

export interface UseClearCacheReturn {
  /** 캐시 삭제 실행 */
  clearCache: (options?: ClearCacheOptions) => Promise<void>;
  /** 삭제 진행 중 여부 */
  isClearing: boolean;
  /** 캐시 통계 */
  cacheStats: CacheStats | null;
  /** 통계 새로고침 */
  refreshStats: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 캐시 삭제 훅
 *
 * @example
 * ```tsx
 * const { clearCache, isClearing, cacheStats } = useClearCache();
 *
 * <Pressable onPress={() => clearCache()} disabled={isClearing}>
 *   <Text>캐시 삭제 ({cacheStats?.queryCount}개)</Text>
 * </Pressable>
 * ```
 */
export function useClearCache(): UseClearCacheReturn {
  const [isClearing, setIsClearing] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const { addToast } = useToastStore();

  /**
   * 캐시 통계 새로고침
   */
  const refreshStats = useCallback(() => {
    try {
      const stats = cacheService.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      logger.error('캐시 통계 조회 실패', toError(error));
    }
  }, []);

  // 초기 통계 로드
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  /**
   * 캐시 삭제 실행
   */
  const clearCache = useCallback(
    async (options?: ClearCacheOptions) => {
      if (isClearing) return;

      setIsClearing(true);

      try {
        const result = await cacheService.clearAllCache(options);

        const totalCleared = result.queryCleared + result.mmkvCleared;

        addToast({
          type: 'success',
          message: `캐시가 삭제되었습니다 (${totalCleared}개 항목)`,
        });

        // 통계 새로고침
        refreshStats();

        logger.info('캐시 삭제 완료', result);
      } catch (error) {
        logger.error('캐시 삭제 실패', toError(error));

        addToast({
          type: 'error',
          message: '캐시 삭제에 실패했습니다',
        });
      } finally {
        setIsClearing(false);
      }
    },
    [isClearing, addToast, refreshStats]
  );

  return {
    clearCache,
    isClearing,
    cacheStats,
    refreshStats,
  };
}

export default useClearCache;
