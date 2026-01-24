/**
 * UNIQN Mobile - 실시간 구독 관리자
 *
 * @description Phase 12 - 중복 구독 방지 및 참조 카운팅 기반 구독 관리
 * @version 1.0.0
 *
 * @example
 * // 구독 시작
 * const unsubscribe = RealtimeManager.subscribe(
 *   RealtimeManager.Keys.notifications(userId),
 *   () => onSnapshot(notificationsQuery, callback)
 * );
 *
 * // 구독 해제 (참조 카운트가 0이 되면 실제 해제)
 * unsubscribe();
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface SubscriptionEntry {
  /** 실제 구독 해제 함수 */
  unsubscribe: () => void;
  /** 참조 카운트 */
  refCount: number;
  /** 마지막 업데이트 시간 */
  lastUpdate: number;
  /** 구독 상태 */
  status: 'active' | 'paused' | 'error';
}

interface SubscriptionStats {
  /** 활성 구독 수 */
  activeCount: number;
  /** 총 참조 수 */
  totalRefs: number;
  /** 구독 키 목록 */
  keys: string[];
}

// ============================================================================
// RealtimeManager Class
// ============================================================================

/**
 * 실시간 구독 중앙 관리자
 *
 * @description
 * - 같은 키에 대한 중복 구독 방지
 * - 참조 카운팅으로 마지막 사용자가 해제될 때만 실제 구독 해제
 * - 구독 상태 추적 및 디버깅 지원
 */
export class RealtimeManager {
  private static subscriptions = new Map<string, SubscriptionEntry>();
  private static isDebugMode = __DEV__;

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * 구독 시작 또는 기존 구독에 참조 추가
   *
   * @param key - 구독 식별 키 (Keys 헬퍼 사용 권장)
   * @param subscribeFn - 구독 함수 (onSnapshot 등)
   * @returns 구독 해제 함수
   */
  static subscribe(
    key: string,
    subscribeFn: () => () => void
  ): () => void {
    const existing = this.subscriptions.get(key);

    if (existing) {
      // 기존 구독에 참조 추가
      existing.refCount++;
      existing.lastUpdate = Date.now();

      if (this.isDebugMode) {
        logger.debug('RealtimeManager: 구독 참조 증가', {
          key,
          refCount: existing.refCount,
        });
      }

      return () => this.unsubscribe(key);
    }

    // 새 구독 생성
    try {
      const unsubscribe = subscribeFn();

      this.subscriptions.set(key, {
        unsubscribe,
        refCount: 1,
        lastUpdate: Date.now(),
        status: 'active',
      });

      if (this.isDebugMode) {
        logger.debug('RealtimeManager: 새 구독 시작', { key });
      }

      return () => this.unsubscribe(key);
    } catch (error) {
      logger.error('RealtimeManager: 구독 시작 실패', error as Error, { key });
      throw error;
    }
  }

  /**
   * 구독 해제 (참조 카운트 감소)
   *
   * @param key - 구독 식별 키
   */
  private static unsubscribe(key: string): void {
    const entry = this.subscriptions.get(key);
    if (!entry) return;

    entry.refCount--;

    if (entry.refCount <= 0) {
      // 마지막 참조 해제 - 실제 구독 해제
      try {
        entry.unsubscribe();
        this.subscriptions.delete(key);

        if (this.isDebugMode) {
          logger.debug('RealtimeManager: 구독 해제', { key });
        }
      } catch (error) {
        logger.error('RealtimeManager: 구독 해제 실패', error as Error, { key });
      }
    } else {
      if (this.isDebugMode) {
        logger.debug('RealtimeManager: 구독 참조 감소', {
          key,
          refCount: entry.refCount,
        });
      }
    }
  }

  /**
   * 특정 구독이 활성 상태인지 확인
   */
  static isActive(key: string): boolean {
    const entry = this.subscriptions.get(key);
    return entry?.status === 'active' && entry.refCount > 0;
  }

  /**
   * 특정 구독의 참조 카운트 조회
   */
  static getRefCount(key: string): number {
    return this.subscriptions.get(key)?.refCount ?? 0;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * 모든 구독 해제 (앱 종료 시 등)
   */
  static unsubscribeAll(): void {
    for (const [key, entry] of this.subscriptions) {
      try {
        entry.unsubscribe();
      } catch (error) {
        logger.error('RealtimeManager: 전체 해제 중 오류', error as Error, { key });
      }
    }
    this.subscriptions.clear();
    logger.info('RealtimeManager: 모든 구독 해제 완료');
  }

  /**
   * 구독 통계 조회
   */
  static getStats(): SubscriptionStats {
    let totalRefs = 0;
    const keys: string[] = [];

    for (const [key, entry] of this.subscriptions) {
      totalRefs += entry.refCount;
      keys.push(key);
    }

    return {
      activeCount: this.subscriptions.size,
      totalRefs,
      keys,
    };
  }

  /**
   * 디버그 모드 설정
   */
  static setDebugMode(enabled: boolean): void {
    this.isDebugMode = enabled;
  }

  // ==========================================================================
  // Key Generators (표준 키 패턴)
  // ==========================================================================

  /**
   * 구독 키 생성 헬퍼
   *
   * @description 일관된 키 패턴을 위해 이 헬퍼 사용 권장
   */
  static Keys = {
    /** 알림 목록 */
    notifications: (userId: string) => `notifications:${userId}`,

    /** 읽지 않은 알림 수 */
    unreadCount: (userId: string) => `notifications:unread:${userId}`,

    /** 스케줄 목록 */
    schedules: (userId: string) => `schedules:${userId}`,

    /** 월별 스케줄 */
    schedulesByMonth: (userId: string, year: number, month: number) =>
      `schedules:${userId}:${year}-${month}`,

    /** 근무 기록 목록 (staffId 기준) */
    workLogs: (staffId: string) => `workLogs:${staffId}`,

    /** 근무 기록 목록 (staffId + 날짜 범위 기준) */
    workLogsByRange: (staffId: string, startDate?: string, endDate?: string) =>
      `workLogs:${staffId}:${startDate ?? 'all'}:${endDate ?? 'all'}`,

    /** 단일 근무 기록 (workLogId 기준) */
    workLog: (workLogId: string) => `workLog:${workLogId}`,

    /** 오늘 근무 상태 (staffId + date 기준) */
    todayWorkStatus: (staffId: string, date: string) => `workLogs:today:${staffId}:${date}`,

    /** 확정 스태프 목록 */
    confirmedStaff: (jobPostingId: string) => `confirmedStaff:${jobPostingId}`,

    /** 지원자 목록 */
    applicants: (jobPostingId: string) => `applicants:${jobPostingId}`,

    /** 공고 상세 */
    jobPosting: (jobPostingId: string) => `jobPosting:${jobPostingId}`,
  } as const;
}
