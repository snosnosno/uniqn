/**
 * counterSyncCache 테스트
 *
 * @description 카운터 동기화 캐시 테스트
 * - TTL 기반 캐시 유효성 검사
 * - 캐시 갱신 및 초기화
 */

import {
  isSyncCacheValid,
  updateSyncCache,
  clearCounterSyncCache,
  SYNC_CACHE_TTL_MS,
} from '../counterSyncCache';

describe('counterSyncCache', () => {
  beforeEach(() => {
    // 매 테스트 전 캐시 초기화
    clearCounterSyncCache();
  });

  // ============================================================================
  // SYNC_CACHE_TTL_MS 상수 테스트
  // ============================================================================
  describe('SYNC_CACHE_TTL_MS', () => {
    it('TTL은 30초(30000ms)이다', () => {
      expect(SYNC_CACHE_TTL_MS).toBe(30000);
    });
  });

  // ============================================================================
  // isSyncCacheValid 테스트
  // ============================================================================
  describe('isSyncCacheValid', () => {
    it('캐시가 없는 사용자는 false 반환', () => {
      expect(isSyncCacheValid('user1')).toBe(false);
    });

    it('캐시 갱신 직후에는 true 반환', () => {
      updateSyncCache('user1');
      expect(isSyncCacheValid('user1')).toBe(true);
    });

    it('TTL 경과 후에는 false 반환', () => {
      // Date.now()를 모킹하여 TTL 경과 시뮬레이션
      const originalDateNow = Date.now;
      const baseTime = 1000000;

      Date.now = jest.fn(() => baseTime);
      updateSyncCache('user1');

      // TTL 직전: 아직 유효
      Date.now = jest.fn(() => baseTime + SYNC_CACHE_TTL_MS - 1);
      expect(isSyncCacheValid('user1')).toBe(true);

      // TTL 경과: 무효
      Date.now = jest.fn(() => baseTime + SYNC_CACHE_TTL_MS + 1);
      expect(isSyncCacheValid('user1')).toBe(false);

      Date.now = originalDateNow;
    });

    it('서로 다른 사용자는 독립적인 캐시', () => {
      updateSyncCache('user1');

      expect(isSyncCacheValid('user1')).toBe(true);
      expect(isSyncCacheValid('user2')).toBe(false);
    });
  });

  // ============================================================================
  // updateSyncCache 테스트
  // ============================================================================
  describe('updateSyncCache', () => {
    it('캐시를 갱신하면 유효해진다', () => {
      expect(isSyncCacheValid('user1')).toBe(false);
      updateSyncCache('user1');
      expect(isSyncCacheValid('user1')).toBe(true);
    });

    it('여러 사용자의 캐시를 독립적으로 갱신', () => {
      updateSyncCache('user1');
      updateSyncCache('user2');

      expect(isSyncCacheValid('user1')).toBe(true);
      expect(isSyncCacheValid('user2')).toBe(true);
    });
  });

  // ============================================================================
  // clearCounterSyncCache 테스트
  // ============================================================================
  describe('clearCounterSyncCache', () => {
    it('특정 사용자 캐시만 초기화', () => {
      updateSyncCache('user1');
      updateSyncCache('user2');

      clearCounterSyncCache('user1');

      expect(isSyncCacheValid('user1')).toBe(false);
      expect(isSyncCacheValid('user2')).toBe(true);
    });

    it('userId 없이 호출하면 전체 캐시 초기화', () => {
      updateSyncCache('user1');
      updateSyncCache('user2');
      updateSyncCache('user3');

      clearCounterSyncCache();

      expect(isSyncCacheValid('user1')).toBe(false);
      expect(isSyncCacheValid('user2')).toBe(false);
      expect(isSyncCacheValid('user3')).toBe(false);
    });

    it('빈 캐시에서 초기화해도 에러 없음', () => {
      expect(() => clearCounterSyncCache()).not.toThrow();
      expect(() => clearCounterSyncCache('nonexistent')).not.toThrow();
    });
  });
});
