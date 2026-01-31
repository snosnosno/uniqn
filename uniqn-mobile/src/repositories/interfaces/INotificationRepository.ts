/**
 * UNIQN Mobile - Notification Repository Interface
 *
 * @description 알림 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 알림 CRUD 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { PaginatedResult } from '@/utils/firestore';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
} from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

export interface GetNotificationsOptions {
  filter?: NotificationFilter;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Notification Repository 인터페이스
 *
 * 구현체:
 * - FirebaseNotificationRepository (프로덕션)
 * - MockNotificationRepository (테스트)
 */
export interface INotificationRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 알림 조회
   * @param notificationId - 알림 ID
   * @returns 알림 또는 null
   */
  getById(notificationId: string): Promise<NotificationData | null>;

  /**
   * 사용자별 알림 목록 조회 (페이지네이션)
   * @param userId - 사용자 ID
   * @param options - 필터, 페이지 크기, 커서
   * @returns 페이지네이션된 알림 목록
   */
  getByUserId(
    userId: string,
    options?: GetNotificationsOptions
  ): Promise<PaginatedResult<NotificationData>>;

  /**
   * 읽지 않은 알림 수 조회
   * @param userId - 사용자 ID
   * @returns 미읽음 알림 수
   */
  getUnreadCount(userId: string): Promise<number>;

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  /**
   * 알림 읽음 처리
   * @param notificationId - 알림 ID
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * 모든 알림 읽음 처리
   * @param userId - 사용자 ID
   */
  markAllAsRead(userId: string): Promise<void>;

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  /**
   * 알림 삭제
   * @param notificationId - 알림 ID
   */
  delete(notificationId: string): Promise<void>;

  /**
   * 여러 알림 삭제
   * @param notificationIds - 알림 ID 배열
   */
  deleteMany(notificationIds: string[]): Promise<void>;

  /**
   * 오래된 알림 정리
   * @param userId - 사용자 ID
   * @param daysToKeep - 보관 기간 (일)
   * @returns 삭제된 알림 수
   */
  deleteOlderThan(userId: string, daysToKeep: number): Promise<number>;

  // ==========================================================================
  // 설정 (Settings)
  // ==========================================================================

  /**
   * 알림 설정 조회
   * @param userId - 사용자 ID
   * @returns 알림 설정
   */
  getSettings(userId: string): Promise<NotificationSettings>;

  /**
   * 알림 설정 저장
   * @param userId - 사용자 ID
   * @param settings - 알림 설정
   */
  saveSettings(userId: string, settings: NotificationSettings): Promise<void>;

  // ==========================================================================
  // FCM 토큰 (Push Notification)
  // ==========================================================================

  /**
   * FCM 토큰 등록
   * @param userId - 사용자 ID
   * @param token - FCM 토큰
   */
  registerFCMToken(userId: string, token: string): Promise<void>;

  /**
   * FCM 토큰 삭제
   * @param userId - 사용자 ID
   * @param token - FCM 토큰
   */
  unregisterFCMToken(userId: string, token: string): Promise<void>;

  /**
   * 모든 FCM 토큰 삭제
   * @param userId - 사용자 ID
   */
  unregisterAllFCMTokens(userId: string): Promise<void>;
}
