/**
 * 알림 시스템 타입 정의
 *
 * @description
 * 확장 가능한 알림 시스템을 위한 타입 정의
 * - 8가지 알림 타입 지원
 * - 카테고리/우선순위 기반 분류
 * - 액션 타입 정의
 *
 * @version 1.2.0
 * @since 2025-10-02
 * @updated 2025-10-15
 */

import { Timestamp as FirebaseTimestamp } from 'firebase/firestore';

/**
 * 알림 카테고리 (대분류)
 */
export type NotificationCategory =
  | 'system'      // 시스템 공지, 신규 공고
  | 'work'        // 지원, 확정, 취소 관련
  | 'schedule';   // 근무시간 변경

/**
 * 알림 타입 (세부 분류)
 */
export type NotificationType =
  // System
  | 'job_posting_announcement'  // 공고별 공지 전송 (구현됨)
  | 'new_job_posting'            // 신규 공고 등록 알림 (구현 예정)
  | 'system_announcement'        // 시스템 공지
  | 'app_update'                 // 앱 업데이트
  // Work
  | 'job_application'            // 지원서 제출 알림 (구현 예정)
  | 'staff_approval'             // 지원 확정 알림 (구현 예정)
  | 'staff_rejection'            // 지원 취소 알림 (구현 예정)
  // Schedule
  | 'schedule_change';           // 근무시간 변경 알림 (구현 예정)

/**
 * 알림 우선순위
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * 알림 액션 타입
 */
export type NotificationActionType =
  | 'navigate'      // 특정 페이지로 이동
  | 'open_modal'    // 모달 열기
  | 'external_link' // 외부 링크
  | 'none';         // 액션 없음

/**
 * 알림 액션
 */
export interface NotificationAction {
  type: NotificationActionType;
  target?: string;
  params?: Record<string, any>;
}

/**
 * 알림 인터페이스
 */
export interface Notification {
  // 기본 정보
  id: string;
  userId: string;

  // 분류
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;

  // 내용
  title: string;
  body: string;
  imageUrl?: string;

  // 액션
  action: NotificationAction;

  // 메타데이터
  relatedId?: string;
  senderId?: string;
  data?: Record<string, any>;

  // 상태
  isRead: boolean;
  isSent: boolean;
  isLocal: boolean;

  // 타임스탬프
  createdAt: Date | FirebaseTimestamp;
  sentAt?: Date | FirebaseTimestamp;
  readAt?: Date | FirebaseTimestamp;
}

/**
 * 조용한 시간대 설정
 */
export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00" 형식
  end: string;   // "08:00" 형식
}

/**
 * 알림 타입별 설정
 */
export interface NotificationTypeSettings {
  [key: string]: boolean;
}

/**
 * 알림 설정 (사용자별)
 */
export interface NotificationSettings {
  userId: string;
  enabled: boolean;
  categories: {
    [key in NotificationCategory]: {
      enabled: boolean;
      pushEnabled: boolean;
      emailEnabled: boolean;
    };
  };
  types?: NotificationTypeSettings; // 타입별 세부 설정
  quietHours?: QuietHours;
  updatedAt?: Date | FirebaseTimestamp;
}

/**
 * 알림 필터
 */
export interface NotificationFilter {
  isRead?: boolean;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 알림 통계
 */
export interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
  byPriority: Record<NotificationPriority, number>;
}

/**
 * Firestore 타임스탬프를 Date로 변환
 */
export const convertTimestamp = (timestamp: Date | FirebaseTimestamp): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return timestamp.toDate();
};

/**
 * 알림 생성 입력
 */
export interface NotificationCreateInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  action: NotificationAction;
  relatedId?: string;
  senderId?: string;
  data?: Record<string, any>;
}
