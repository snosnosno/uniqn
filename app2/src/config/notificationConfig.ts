/**
 * 알림 시스템 설정
 *
 * @description
 * 알림 타입별 아이콘, 색상, 라우팅 설정
 *
 * @version 1.0.0
 * @since 2025-10-02
 */

import type { NotificationType, NotificationCategory, NotificationPriority } from '../types/notification';

/**
 * 알림 타입별 설정
 */
interface NotificationTypeConfig {
  icon: string;
  color: string;
  defaultPriority: NotificationPriority;
  category: NotificationCategory;
  route: (relatedId?: string, data?: Record<string, any>) => string;
}

/**
 * 알림 타입 설정 맵
 */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  // System
  job_posting_announcement: {
    icon: '📢',
    color: 'blue',
    defaultPriority: 'high',
    category: 'system',
    route: () => '/app/jobs',
  },
  system_announcement: {
    icon: '🔔',
    color: 'blue',
    defaultPriority: 'medium',
    category: 'system',
    route: () => '/app/announcements',
  },
  app_update: {
    icon: '🔄',
    color: 'blue',
    defaultPriority: 'low',
    category: 'system',
    route: () => '/app/announcements',
  },

  // Work
  job_application: {
    icon: '📝',
    color: 'green',
    defaultPriority: 'medium',
    category: 'work',
    route: () => '/app/my-schedule',
  },
  staff_approval: {
    icon: '✅',
    color: 'green',
    defaultPriority: 'high',
    category: 'work',
    route: () => '/app/my-schedule',
  },
  staff_rejection: {
    icon: '❌',
    color: 'red',
    defaultPriority: 'medium',
    category: 'work',
    route: () => '/app/jobs',
  },

  // Schedule
  schedule_reminder: {
    icon: '⏰',
    color: 'orange',
    defaultPriority: 'high',
    category: 'schedule',
    route: () => '/app/my-schedule',
  },
  schedule_change: {
    icon: '📅',
    color: 'orange',
    defaultPriority: 'high',
    category: 'schedule',
    route: () => '/app/my-schedule',
  },
  attendance_reminder: {
    icon: '📍',
    color: 'orange',
    defaultPriority: 'medium',
    category: 'schedule',
    route: () => '/app/attendance',
  },

  // Finance
  salary_notification: {
    icon: '💰',
    color: 'yellow',
    defaultPriority: 'high',
    category: 'finance',
    route: () => '/app/staff',
  },
};

/**
 * 카테고리별 색상 (Tailwind CSS)
 */
export const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  system: 'blue',
  work: 'green',
  schedule: 'orange',
  finance: 'yellow',
};

/**
 * 우선순위별 스타일 (Tailwind CSS)
 */
export const PRIORITY_STYLES: Record<NotificationPriority, string> = {
  urgent: 'bg-red-100 border-red-500 text-red-900',
  high: 'bg-orange-100 border-orange-500 text-orange-900',
  medium: 'bg-blue-100 border-blue-500 text-blue-900',
  low: 'bg-gray-100 border-gray-300 text-gray-700',
};

/**
 * 우선순위별 배지 스타일
 */
export const PRIORITY_BADGE_STYLES: Record<NotificationPriority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-blue-500 text-white',
  low: 'bg-gray-400 text-white',
};

/**
 * 알림 타입 정보 가져오기
 */
export const getNotificationTypeConfig = (type: NotificationType): NotificationTypeConfig => {
  return NOTIFICATION_TYPE_CONFIG[type];
};

/**
 * 알림 라우트 가져오기
 */
export const getNotificationRoute = (
  type: NotificationType,
  relatedId?: string,
  data?: Record<string, any>
): string => {
  const config = getNotificationTypeConfig(type);
  return config.route(relatedId, data);
};
