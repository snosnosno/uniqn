/**
 * 알림 시스템 설정
 *
 * @description
 * 알림 타입별 아이콘, 색상, 라우팅 설정
 *
 * @version 1.1.0
 * @since 2025-10-02
 * @updated 2025-10-15
 */

import type {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
} from '../types/notification';

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
  new_job_posting: {
    icon: '🎯',
    color: 'blue',
    defaultPriority: 'medium',
    category: 'system',
    route: (_relatedId) => '/app/jobs', // 구인구직 페이지로 이동
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
    route: () => '/app/admin/job-postings',
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
    route: () => '/app/my-schedule',
  },

  // Schedule
  schedule_change: {
    icon: '📅',
    color: 'orange',
    defaultPriority: 'high',
    category: 'schedule',
    route: () => '/app/my-schedule',
  },
};

/**
 * 카테고리별 색상 (Tailwind CSS)
 */
export const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  system: 'blue',
  work: 'green',
  schedule: 'orange',
};

/**
 * 우선순위별 스타일 (Tailwind CSS)
 */
export const PRIORITY_STYLES: Record<NotificationPriority, string> = {
  urgent:
    'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-700 text-red-900 dark:text-red-200',
  high: 'bg-orange-100 dark:bg-orange-900/30 border-orange-500 dark:border-orange-700 text-orange-900 dark:text-orange-200',
  medium:
    'bg-blue-100 dark:bg-blue-900/30 border-blue-500 dark:border-blue-700 text-blue-900 dark:text-blue-200',
  low: 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200',
};

/**
 * 우선순위별 배지 스타일
 */
export const PRIORITY_BADGE_STYLES: Record<NotificationPriority, string> = {
  urgent: 'bg-red-500 dark:bg-red-600 text-white',
  high: 'bg-orange-500 dark:bg-orange-600 text-white',
  medium: 'bg-blue-500 dark:bg-blue-600 text-white',
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
