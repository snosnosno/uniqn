/**
 * UNIQN Mobile - 알림 관련 타입 정의
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument } from './common';

/**
 * 알림 카테고리
 */
export type NotificationCategory =
  | 'system' // 시스템 공지
  | 'work' // 지원, 확정, 취소 관련
  | 'schedule'; // 근무 관련

/**
 * 알림 타입
 */
export type NotificationType =
  // System
  | 'system_announcement' // 시스템 공지
  | 'new_job_posting' // 신규 공고
  | 'app_update' // 앱 업데이트
  // Work
  | 'job_application' // 지원 완료
  | 'staff_approval' // 지원 확정
  | 'staff_rejection' // 지원 거절
  // Schedule
  | 'schedule_reminder' // 근무 알림
  | 'schedule_change'; // 근무 변경

/**
 * 알림 우선순위
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * 알림 액션 타입
 */
export type NotificationActionType =
  | 'navigate' // 페이지 이동
  | 'open_modal' // 모달 열기
  | 'external_link' // 외부 링크
  | 'none'; // 액션 없음

/**
 * 알림 액션
 */
export interface NotificationAction {
  type: NotificationActionType;
  target?: string;
  params?: Record<string, unknown>;
}

/**
 * 알림 타입
 */
export interface Notification extends FirebaseDocument {
  // 기본 정보
  userId: string;
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
  data?: Record<string, unknown>;

  // 상태
  isRead: boolean;
  isSent: boolean;

  // 타임스탬프
  sentAt?: Timestamp | Date;
  readAt?: Timestamp | Date;
}

/**
 * 알림 설정
 */
export interface NotificationSettings {
  userId: string;
  enabled: boolean;
  categories: {
    [key in NotificationCategory]: {
      enabled: boolean;
      pushEnabled: boolean;
    };
  };
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "08:00"
  };
  updatedAt?: Timestamp | Date;
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
}

/**
 * 알림 생성 입력
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  action: NotificationAction;
  relatedId?: string;
  data?: Record<string, unknown>;
}

/**
 * 알림 타입 라벨
 */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  system_announcement: '시스템 공지',
  new_job_posting: '신규 공고',
  app_update: '앱 업데이트',
  job_application: '지원 완료',
  staff_approval: '지원 확정',
  staff_rejection: '지원 거절',
  schedule_reminder: '근무 알림',
  schedule_change: '근무 변경',
};

/**
 * Timestamp/Date를 Date로 변환
 */
export const toDateFromTimestamp = (value: Timestamp | Date | undefined): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  return value.toDate();
};
