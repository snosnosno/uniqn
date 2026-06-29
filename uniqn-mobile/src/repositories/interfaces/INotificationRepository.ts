/**
 * UNIQN Mobile - Notification Repository Interface
 *
 * @description 알림 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. DB 직접 의존 제거 → 테스트 용이성
 * 2. 알림 CRUD 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type { PaginationCursor, PaginatedResult } from '@/types/common';
import type {
  NotificationData,
  NotificationSettings,
  NotificationFilter,
  NotificationType,
  NotificationPriority,
} from '@/types/notification';

// ============================================================================
// Types
// ============================================================================

export interface GetNotificationsOptions {
  filter?: NotificationFilter;
  pageSize?: number;
  lastDoc?: PaginationCursor;
}

/**
 * 알림 생성 입력(직접 INSERT 경로).
 *
 * @description notifications 테이블에 직접 INSERT 하면 AFTER 트리거가 푸시를 발송한다.
 *              RLS notifications_insert_service 는 authenticated 면 임의 recipient 로 INSERT 를 허용한다.
 */
export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
  priority?: NotificationPriority;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Notification Repository 인터페이스
 *
 * 구현체:
 * - SupabaseNotificationRepository (프로덕션)
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

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  /**
   * 알림 생성 (직접 INSERT — AFTER 트리거가 푸시 발송)
   * @param input - 수신자/타입/제목/본문/링크/데이터/우선순위
   */
  createNotification(input: CreateNotificationInput): Promise<void>;

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
   * 읽지 않은 알림 수 조회 (컬렉션 카운트)
   * @param userId - 사용자 ID
   * @returns 미읽음 알림 수
   */
  getUnreadCount(userId: string): Promise<number>;

  /**
   * 캐싱된 미읽음 카운터 조회 (users/{userId}/counters/notifications)
   * @param userId - 사용자 ID
   * @returns 캐싱된 카운터 값 (문서 없으면 null)
   */
  getUnreadCounterFromCache(userId: string): Promise<number | null>;

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  /**
   * 알림 읽음 처리
   * @param notificationId - 알림 ID
   */
  markAsRead(notificationId: string): Promise<void>;

  /**
   * 모든 알림 읽음 처리 (배치)
   * @param userId - 사용자 ID
   * @returns 업데이트된 알림 ID 목록
   */
  markAllAsRead(userId: string): Promise<{ updatedIds: string[] }>;

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  /**
   * 알림 삭제
   * @param notificationId - 알림 ID
   * @returns 삭제된 알림의 미읽음 여부 및 수신자 ID
   */
  delete(notificationId: string): Promise<{ wasUnread: boolean; recipientId?: string }>;

  /**
   * 여러 알림 삭제
   * @param notificationIds - 알림 ID 배열
   * @returns 삭제된 미읽음 알림 수
   */
  deleteMany(notificationIds: string[]): Promise<{ deletedUnreadCount: number }>;

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
   * @param metadata - 토큰 메타데이터 (타입, 플랫폼)
   */
  registerFCMToken(
    userId: string,
    token: string,
    metadata: { type: 'expo' | 'fcm'; platform: 'ios' | 'android' }
  ): Promise<void>;

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

  // ==========================================================================
  // 실시간 구독 (Realtime Subscription)
  // ==========================================================================

  /**
   * 알림 실시간 구독
   *
   * @param userId - 사용자 ID
   * @param onNotifications - 알림 업데이트 콜백
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeToNotifications(
    userId: string,
    onNotifications: (notifications: NotificationData[]) => void,
    onError?: (error: Error) => void
  ): () => void;

  /**
   * 읽지 않은 알림 수 실시간 구독 (카운터 문서 기반)
   *
   * @param userId - 사용자 ID
   * @param onCount - 카운트 업데이트 콜백
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeToUnreadCount(
    userId: string,
    onCount: (count: number) => void,
    onError?: (error: Error) => void
  ): () => void;
}
