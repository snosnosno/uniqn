/**
 * 캐시 모듈 Barrel Export
 *
 * @example
 * ```typescript
 * import { CacheManager, cacheGet, cacheSet, getCacheStats } from '@/core/cache';
 *
 * // 싱글톤 인스턴스 사용
 * const cache = CacheManager.getInstance();
 *
 * // 단축 함수 사용
 * cacheSet('users', 'user-123', userData);
 * const user = cacheGet<User>('users', 'user-123');
 * ```
 */

export {
  CacheManager,
  getCache,
  cacheGet,
  cacheSet,
  cacheInvalidate,
  getCacheStats,
} from './CacheManager';

export type { CacheOptions, CacheStats } from './CacheManager';

export { default } from './CacheManager';
