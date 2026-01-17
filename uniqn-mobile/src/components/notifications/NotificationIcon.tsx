/**
 * UNIQN Mobile - NotificationIcon 컴포넌트
 *
 * @description 알림 타입에 따른 아이콘 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import {
  UserPlusIcon,
  UserMinusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  BriefcaseIcon,
  ExclamationCircleIcon,
  MegaphoneIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon,
  ChatBubbleLeftIcon,
  ShieldCheckIcon,
  BellIcon,
} from '@/components/icons';
import { NotificationType, NotificationCategory, getNotificationCategory } from '@/types/notification';

export interface NotificationIconProps {
  /** 알림 타입 */
  type: NotificationType;
  /** 아이콘 크기 (기본: 20) */
  size?: number;
  /** 이모지 사용 여부 (기본: false) */
  useEmoji?: boolean;
  /** 커스텀 스타일 */
  className?: string;
}

// 타입별 아이콘 컴포넌트 매핑
type IconComponent = React.FC<{ size?: number; color?: string }>;

const typeIcons: Record<NotificationType, IconComponent> = {
  // 지원 관련
  [NotificationType.NEW_APPLICATION]: UserPlusIcon,
  [NotificationType.APPLICATION_CANCELLED]: UserMinusIcon,
  [NotificationType.APPLICATION_CONFIRMED]: CheckCircleIcon,
  [NotificationType.CONFIRMATION_CANCELLED]: XCircleIcon,
  [NotificationType.APPLICATION_REJECTED]: XCircleIcon,

  // 출퇴근/스케줄 관련
  [NotificationType.STAFF_CHECKED_IN]: ClockIcon,
  [NotificationType.STAFF_CHECKED_OUT]: ClockIcon,
  [NotificationType.CHECKIN_REMINDER]: CalendarDaysIcon,
  [NotificationType.NO_SHOW_ALERT]: ExclamationCircleIcon,
  [NotificationType.SCHEDULE_CHANGE]: CalendarDaysIcon,
  [NotificationType.SCHEDULE_CREATED]: CalendarDaysIcon,
  [NotificationType.SCHEDULE_CANCELLED]: XCircleIcon,

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: BanknotesIcon,
  [NotificationType.SETTLEMENT_REQUESTED]: BanknotesIcon,

  // 공고 관련
  [NotificationType.JOB_CLOSING_SOON]: BriefcaseIcon,
  [NotificationType.NEW_JOB_IN_AREA]: BriefcaseIcon,
  [NotificationType.JOB_UPDATED]: BriefcaseIcon,
  [NotificationType.JOB_CANCELLED]: XCircleIcon,

  // 시스템
  [NotificationType.ANNOUNCEMENT]: MegaphoneIcon,
  [NotificationType.MAINTENANCE]: WrenchScrewdriverIcon,
  [NotificationType.APP_UPDATE]: ArrowPathIcon,

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: ChatBubbleLeftIcon,
  [NotificationType.REPORT_RESOLVED]: ShieldCheckIcon,
};

// 타입별 이모지 매핑
const typeEmojis: Record<NotificationType, string> = {
  // 지원 관련
  [NotificationType.NEW_APPLICATION]: '👤',
  [NotificationType.APPLICATION_CANCELLED]: '❌',
  [NotificationType.APPLICATION_CONFIRMED]: '✅',
  [NotificationType.CONFIRMATION_CANCELLED]: '🚫',
  [NotificationType.APPLICATION_REJECTED]: '❌',

  // 출퇴근 관련
  [NotificationType.STAFF_CHECKED_IN]: '🟢',
  [NotificationType.STAFF_CHECKED_OUT]: '🔴',
  [NotificationType.CHECKIN_REMINDER]: '⏰',
  [NotificationType.NO_SHOW_ALERT]: '⚠️',
  [NotificationType.SCHEDULE_CHANGE]: '📅',
  [NotificationType.SCHEDULE_CREATED]: '📆',
  [NotificationType.SCHEDULE_CANCELLED]: '🚫',

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: '💰',
  [NotificationType.SETTLEMENT_REQUESTED]: '📝',

  // 공고 관련
  [NotificationType.JOB_CLOSING_SOON]: '⏳',
  [NotificationType.NEW_JOB_IN_AREA]: '📢',
  [NotificationType.JOB_UPDATED]: '📋',
  [NotificationType.JOB_CANCELLED]: '❌',

  // 시스템
  [NotificationType.ANNOUNCEMENT]: '📢',
  [NotificationType.MAINTENANCE]: '🔧',
  [NotificationType.APP_UPDATE]: '🆕',

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: '💬',
  [NotificationType.REPORT_RESOLVED]: '✅',
};

// 카테고리별 색상
const categoryColors: Record<NotificationCategory, { bg: string; icon: string }> = {
  [NotificationCategory.APPLICATION]: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    icon: '#3b82f6', // primary-500
  },
  [NotificationCategory.ATTENDANCE]: {
    bg: 'bg-success-100 dark:bg-success-900/30',
    icon: '#22c55e', // success-500
  },
  [NotificationCategory.SETTLEMENT]: {
    bg: 'bg-warning-100 dark:bg-warning-900/30',
    icon: '#f59e0b', // warning-500
  },
  [NotificationCategory.JOB]: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: '#3b82f6', // blue-500
  },
  [NotificationCategory.SYSTEM]: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    icon: '#6b7280', // gray-500
  },
  [NotificationCategory.ADMIN]: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    icon: '#6366f1', // indigo-500
  },
};

export function NotificationIcon({
  type,
  size = 20,
  useEmoji = false,
  className = '',
}: NotificationIconProps) {
  const category = getNotificationCategory(type);
  const colors = categoryColors[category] || categoryColors[NotificationCategory.SYSTEM];

  if (useEmoji) {
    const emoji = typeEmojis[type] || '🔔';
    return (
      <View
        className={`
          w-10 h-10 rounded-full items-center justify-center
          ${colors.bg}
          ${className}
        `}
      >
        <Text className="text-lg">{emoji}</Text>
      </View>
    );
  }

  const IconComponent = typeIcons[type] || BellIcon;

  return (
    <View
      className={`
        w-10 h-10 rounded-full items-center justify-center
        ${colors.bg}
        ${className}
      `}
    >
      <IconComponent size={size} color={colors.icon} />
    </View>
  );
}

export default NotificationIcon;
