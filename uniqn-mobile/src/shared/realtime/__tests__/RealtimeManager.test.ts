/**
 * RealtimeManager 테스트
 *
 * @description 실시간 구독 관리자 테스트
 * - 참조 카운팅 기반 구독 관리
 * - 중복 구독 방지
 * - 네트워크 상태 관리
 * - 구독 통계 및 유틸리티
 */

// logger mock
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { RealtimeManager } from '../RealtimeManager';

describe('RealtimeManager', () => {
  // 각 테스트 전 모든 구독 해제 및 상태 초기화
  beforeEach(() => {
    RealtimeManager.unsubscribeAll();
    RealtimeManager.setDebugMode(false);
    // 네트워크 연결 상태 복원 - disconnect 후 reconnect 호출
    RealtimeManager.onNetworkReconnect();
  });

  // ============================================================================
  // subscribe / unsubscribe 테스트
  // ============================================================================
  describe('subscribe', () => {
    it('새 구독 생성 시 subscribeFn이 호출된다', () => {
      const mockUnsubscribe = jest.fn();
      const subscribeFn = jest.fn(() => mockUnsubscribe);

      RealtimeManager.subscribe('test:key', subscribeFn);

      expect(subscribeFn).toHaveBeenCalledTimes(1);
      expect(RealtimeManager.isActive('test:key')).toBe(true);
    });

    it('같은 키로 중복 구독 시 subscribeFn이 다시 호출되지 않는다', () => {
      const mockUnsubscribe = jest.fn();
      const subscribeFn = jest.fn(() => mockUnsubscribe);

      RealtimeManager.subscribe('test:key', subscribeFn);
      RealtimeManager.subscribe('test:key', subscribeFn);

      expect(subscribeFn).toHaveBeenCalledTimes(1);
      expect(RealtimeManager.getRefCount('test:key')).toBe(2);
    });

    it('구독 해제 함수 반환', () => {
      const mockUnsubscribe = jest.fn();
      const subscribeFn = jest.fn(() => mockUnsubscribe);

      const unsubscribe = RealtimeManager.subscribe('test:key', subscribeFn);

      expect(typeof unsubscribe).toBe('function');
    });

    it('subscribeFn 에러 시 예외를 throw 한다', () => {
      const subscribeFn = jest.fn(() => {
        throw new Error('구독 실패');
      });

      expect(() => RealtimeManager.subscribe('error:key', subscribeFn)).toThrow('구독 실패');
      expect(RealtimeManager.isActive('error:key')).toBe(false);
    });
  });

  // ============================================================================
  // 참조 카운팅 테스트
  // ============================================================================
  describe('참조 카운팅', () => {
    it('구독 추가 시 refCount 증가', () => {
      const subscribeFn = jest.fn(() => jest.fn());

      RealtimeManager.subscribe('ref:key', subscribeFn);
      expect(RealtimeManager.getRefCount('ref:key')).toBe(1);

      RealtimeManager.subscribe('ref:key', subscribeFn);
      expect(RealtimeManager.getRefCount('ref:key')).toBe(2);

      RealtimeManager.subscribe('ref:key', subscribeFn);
      expect(RealtimeManager.getRefCount('ref:key')).toBe(3);
    });

    it('구독 해제 시 refCount 감소', () => {
      const subscribeFn = jest.fn(() => jest.fn());

      const unsub1 = RealtimeManager.subscribe('ref:key', subscribeFn);
      const unsub2 = RealtimeManager.subscribe('ref:key', subscribeFn);

      expect(RealtimeManager.getRefCount('ref:key')).toBe(2);

      unsub1();
      expect(RealtimeManager.getRefCount('ref:key')).toBe(1);

      unsub2();
      expect(RealtimeManager.getRefCount('ref:key')).toBe(0);
    });

    it('마지막 참조 해제 시 실제 unsubscribe 호출', () => {
      const mockUnsubscribe = jest.fn();
      const subscribeFn = jest.fn(() => mockUnsubscribe);

      const unsub = RealtimeManager.subscribe('ref:key', subscribeFn);
      unsub();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      expect(RealtimeManager.isActive('ref:key')).toBe(false);
    });

    it('중간 해제 시 실제 unsubscribe 호출되지 않음', () => {
      const mockUnsubscribe = jest.fn();
      const subscribeFn = jest.fn(() => mockUnsubscribe);

      const unsub1 = RealtimeManager.subscribe('ref:key', subscribeFn);
      RealtimeManager.subscribe('ref:key', subscribeFn);

      unsub1(); // refCount: 2 -> 1

      expect(mockUnsubscribe).not.toHaveBeenCalled();
      expect(RealtimeManager.isActive('ref:key')).toBe(true);
    });
  });

  // ============================================================================
  // isActive / getRefCount 테스트
  // ============================================================================
  describe('isActive / getRefCount', () => {
    it('존재하지 않는 키는 isActive false', () => {
      expect(RealtimeManager.isActive('nonexistent')).toBe(false);
    });

    it('존재하지 않는 키의 refCount는 0', () => {
      expect(RealtimeManager.getRefCount('nonexistent')).toBe(0);
    });
  });

  // ============================================================================
  // 네트워크 상태 관리 테스트
  // ============================================================================
  describe('네트워크 상태 관리', () => {
    it('초기 상태는 connected', () => {
      expect(RealtimeManager.isConnected()).toBe(true);
    });

    it('onNetworkDisconnect 호출 시 disconnected 상태', () => {
      RealtimeManager.onNetworkDisconnect();
      expect(RealtimeManager.isConnected()).toBe(false);
    });

    it('onNetworkReconnect 호출 시 connected 상태', () => {
      RealtimeManager.onNetworkDisconnect();
      expect(RealtimeManager.isConnected()).toBe(false);

      RealtimeManager.onNetworkReconnect();
      expect(RealtimeManager.isConnected()).toBe(true);
    });

    it('이미 connected 상태에서 onNetworkReconnect 호출 시 무시', () => {
      const callback = jest.fn();
      RealtimeManager.registerReconnectCallback('test', callback);

      // 이미 connected이므로 콜백이 호출되지 않아야 함
      RealtimeManager.onNetworkReconnect();
      expect(callback).not.toHaveBeenCalled();
    });

    it('이미 disconnected 상태에서 onNetworkDisconnect 호출 시 무시', () => {
      RealtimeManager.onNetworkDisconnect();
      // 두 번 호출해도 에러 없음
      RealtimeManager.onNetworkDisconnect();
      expect(RealtimeManager.isConnected()).toBe(false);
    });
  });

  // ============================================================================
  // 재연결 콜백 테스트
  // ============================================================================
  describe('재연결 콜백', () => {
    it('재연결 시 등록된 콜백 실행', () => {
      const callback = jest.fn();
      RealtimeManager.registerReconnectCallback('sync', callback);

      RealtimeManager.onNetworkDisconnect();
      RealtimeManager.onNetworkReconnect();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('콜백 해제 후 재연결 시 호출되지 않음', () => {
      const callback = jest.fn();
      const unregister = RealtimeManager.registerReconnectCallback('sync', callback);

      unregister();

      RealtimeManager.onNetworkDisconnect();
      RealtimeManager.onNetworkReconnect();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // unsubscribeAll 테스트
  // ============================================================================
  describe('unsubscribeAll', () => {
    it('모든 구독 해제', () => {
      const unsub1 = jest.fn();
      const unsub2 = jest.fn();

      RealtimeManager.subscribe('key1', () => unsub1);
      RealtimeManager.subscribe('key2', () => unsub2);

      expect(RealtimeManager.getStats().activeCount).toBe(2);

      RealtimeManager.unsubscribeAll();

      expect(unsub1).toHaveBeenCalledTimes(1);
      expect(unsub2).toHaveBeenCalledTimes(1);
      expect(RealtimeManager.getStats().activeCount).toBe(0);
    });
  });

  // ============================================================================
  // forceRemove 테스트
  // ============================================================================
  describe('forceRemove', () => {
    it('구독 강제 제거', () => {
      const mockUnsub = jest.fn();
      RealtimeManager.subscribe('force:key', () => mockUnsub);
      RealtimeManager.subscribe('force:key', () => mockUnsub); // refCount: 2

      RealtimeManager.forceRemove('force:key');

      expect(mockUnsub).toHaveBeenCalledTimes(1);
      expect(RealtimeManager.isActive('force:key')).toBe(false);
      expect(RealtimeManager.getRefCount('force:key')).toBe(0);
    });

    it('존재하지 않는 키 강제 제거 시 에러 없음', () => {
      expect(() => RealtimeManager.forceRemove('nonexistent')).not.toThrow();
    });
  });

  // ============================================================================
  // getStats 테스트
  // ============================================================================
  describe('getStats', () => {
    it('구독 통계 정확히 반환', () => {
      RealtimeManager.subscribe('key1', () => jest.fn());
      RealtimeManager.subscribe('key2', () => jest.fn());
      RealtimeManager.subscribe('key1', () => jest.fn()); // refCount: 2

      const stats = RealtimeManager.getStats();

      expect(stats.activeCount).toBe(2);
      expect(stats.totalRefs).toBe(3);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });

    it('빈 상태의 통계', () => {
      const stats = RealtimeManager.getStats();

      expect(stats.activeCount).toBe(0);
      expect(stats.totalRefs).toBe(0);
      expect(stats.keys).toHaveLength(0);
    });
  });

  // ============================================================================
  // Keys 헬퍼 테스트
  // ============================================================================
  describe('Keys 헬퍼', () => {
    it('notifications 키 생성', () => {
      expect(RealtimeManager.Keys.notifications('user1')).toBe('notifications:user1');
    });

    it('unreadCount 키 생성', () => {
      expect(RealtimeManager.Keys.unreadCount('user1')).toBe('notifications:unread:user1');
    });

    it('schedules 키 생성', () => {
      expect(RealtimeManager.Keys.schedules('user1')).toBe('schedules:user1');
    });

    it('schedulesByMonth 키 생성', () => {
      expect(RealtimeManager.Keys.schedulesByMonth('user1', 2026, 2)).toBe(
        'schedules:user1:2026-2'
      );
    });

    it('workLogs 키 생성', () => {
      expect(RealtimeManager.Keys.workLogs('staff1')).toBe('workLogs:staff1');
    });

    it('confirmedStaff 키 생성', () => {
      expect(RealtimeManager.Keys.confirmedStaff('job1')).toBe('confirmedStaff:job1');
    });

    it('jobPosting 키 생성', () => {
      expect(RealtimeManager.Keys.jobPosting('job1')).toBe('jobPosting:job1');
    });

    it('todayWorkStatus 키 생성', () => {
      expect(RealtimeManager.Keys.todayWorkStatus('staff1', '2026-02-11')).toBe(
        'workLogs:today:staff1:2026-02-11'
      );
    });

    it('workLogsByRange 기본값 사용', () => {
      expect(RealtimeManager.Keys.workLogsByRange('staff1')).toBe('workLogs:staff1:all:all');
    });
  });
});
