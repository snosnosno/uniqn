/**
 * UNIQN Mobile - 카운터 동기화 캐시
 *
 * @description 미읽음 알림 카운터 동기화를 위한 캐시 관리
 * @version 1.0.0
 *
 * Service(authService)와 Hook(useNotificationHandler) 양쪽에서 사용되므로
 * shared/ 모듈로 분리하여 레이어 의존 방향을 정상화합니다.
 *
 * 의존 방향:
 *   authService → shared/cache (정상: Service → Shared)
 *   useNotificationHandler → shared/cache (정상: Hook → Shared)
 */

/** 마지막 동기화 시간 캐시 (userId → timestamp) */
const lastSyncTimeCache = new Map<string, number>();

/** 동기화 캐시 TTL (밀리초) - 30초 */
export const SYNC_CACHE_TTL_MS = 30000;

/**
 * 캐시 TTL 내인지 확인
 *
 * @param userId 사용자 ID
 * @returns TTL 내이면 true (동기화 스킵 가능)
 */
export function isSyncCacheValid(userId: string): boolean {
  const now = Date.now();
  const lastSyncTime = lastSyncTimeCache.get(userId) ?? 0;
  return now - lastSyncTime < SYNC_CACHE_TTL_MS;
}

/**
 * 캐시 갱신
 *
 * @param userId 사용자 ID
 */
export function updateSyncCache(userId: string): void {
  lastSyncTimeCache.set(userId, Date.now());
}

/**
 * 카운터 동기화 캐시 초기화
 *
 * @description 로그아웃 시 호출하여 다음 로그인 시 새로 동기화
 * @param userId 사용자 ID (선택, 없으면 전체 캐시 초기화)
 */
export function clearCounterSyncCache(userId?: string): void {
  if (userId) {
    lastSyncTimeCache.delete(userId);
  } else {
    lastSyncTimeCache.clear();
  }
}
