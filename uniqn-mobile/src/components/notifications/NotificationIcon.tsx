/**
 * UNIQN Mobile - NotificationIcon 컴포넌트
 *
 * @description 알림 타입에 따른 아이콘 표시
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo } from 'react';
import { View } from 'react-native';
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
import {
  NotificationType,
  NotificationCategory,
  getNotificationCategory,
} from '@/types/notification';

export interface NotificationIconProps {
  /** 알림 타입 */
  type: NotificationType;
  /** 아이콘 크기 (기본: 20) */
  size?: number;
  /** 커스텀 스타일 */
  className?: string;
}

// 타입별 아이콘 컴포넌트 매핑
type IconComponent = React.FC<{ size?: number; color?: string }>;

const typeIcons: Partial<Record<NotificationType, IconComponent>> = {
  // 지원 관련
  [NotificationType.NEW_APPLICATION]: UserPlusIcon,
  [NotificationType.APPLICATION_CANCELLED]: UserMinusIcon,
  [NotificationType.APPLICATION_CONFIRMED]: CheckCircleIcon,
  [NotificationType.CONFIRMATION_CANCELLED]: XCircleIcon,
  [NotificationType.APPLICATION_REJECTED]: XCircleIcon,
  [NotificationType.CANCELLATION_APPROVED]: CheckCircleIcon,
  [NotificationType.CANCELLATION_REJECTED]: XCircleIcon,

  // 출퇴근/스케줄 관련
  [NotificationType.STAFF_CHECKED_IN]: ClockIcon,
  [NotificationType.STAFF_CHECKED_OUT]: ClockIcon,
  [NotificationType.CHECK_IN_CONFIRMED]: CheckCircleIcon,
  [NotificationType.CHECK_OUT_CONFIRMED]: CheckCircleIcon,
  [NotificationType.CHECKIN_REMINDER]: CalendarDaysIcon,
  [NotificationType.NO_SHOW_ALERT]: ExclamationCircleIcon,
  [NotificationType.SCHEDULE_CHANGE]: CalendarDaysIcon,
  [NotificationType.SCHEDULE_CREATED]: CalendarDaysIcon,
  [NotificationType.SCHEDULE_CANCELLED]: XCircleIcon,

  // 정산 관련
  [NotificationType.SETTLEMENT_COMPLETED]: BanknotesIcon,
  [NotificationType.SETTLEMENT_REQUESTED]: BanknotesIcon,
  [NotificationType.NEGATIVE_SETTLEMENT_ALERT]: ExclamationCircleIcon,

  // 공고 관련
  [NotificationType.JOB_UPDATED]: BriefcaseIcon,
  [NotificationType.JOB_CANCELLED]: XCircleIcon,
  [NotificationType.JOB_CLOSED]: BriefcaseIcon,

  // 시스템
  [NotificationType.ANNOUNCEMENT]: MegaphoneIcon,
  [NotificationType.MAINTENANCE]: WrenchScrewdriverIcon,
  [NotificationType.APP_UPDATE]: ArrowPathIcon,
  [NotificationType.BOARD_COMMENT]: ChatBubbleLeftIcon,
  [NotificationType.BOARD_REPLY]: ChatBubbleLeftIcon,
  [NotificationType.BOARD_MENTION]: BellIcon,
  [NotificationType.BOARD_LOCKED]: ShieldCheckIcon,

  // 관리자
  [NotificationType.INQUIRY_ANSWERED]: ChatBubbleLeftIcon,
  [NotificationType.REPORT_RESOLVED]: ShieldCheckIcon,
  [NotificationType.NEW_REPORT]: ExclamationCircleIcon,
  [NotificationType.NEW_INQUIRY]: ChatBubbleLeftIcon,
  [NotificationType.TOURNAMENT_APPROVAL_REQUEST]: BriefcaseIcon,

  // 리뷰/평가 관련
  [NotificationType.REVIEW_REQUEST]: ChatBubbleLeftIcon,
  [NotificationType.REVIEW_RECEIVED]: CheckCircleIcon,
  [NotificationType.REVIEW_REMINDER]: ClockIcon,
};

// 카테고리별 색상 (Black & Gold v3.0)
const categoryColors: Record<NotificationCategory, { bg: string; icon: string }> = {
  [NotificationCategory.APPLICATION]: {
    bg: 'bg-primary-50 dark:bg-primary-50',
    icon: '#D4AF37',
  },
  [NotificationCategory.ATTENDANCE]: {
    bg: 'bg-success-50 dark:bg-success-50',
    icon: '#22C55E',
  },
  [NotificationCategory.SETTLEMENT]: {
    bg: 'bg-warning-50 dark:bg-warning-50',
    icon: '#D4A017',
  },
  [NotificationCategory.JOB]: {
    bg: 'bg-primary-50 dark:bg-primary-50',
    icon: '#D4AF37',
  },
  [NotificationCategory.SYSTEM]: {
    bg: 'bg-secondary-100 dark:bg-surface-overlay',
    icon: SECONDARY_PALETTE[500],
  },
  [NotificationCategory.ADMIN]: {
    bg: 'bg-info-50 dark:bg-info-50',
    icon: '#2563EB',
  },
  [NotificationCategory.REVIEW]: {
    bg: 'bg-warning-50 dark:bg-warning-50',
    icon: '#D4A017',
  },
};

export const NotificationIcon = memo(function NotificationIcon({
  type,
  size = 20,
  className = '',
}: NotificationIconProps) {
  const category = getNotificationCategory(type);
  const colors = categoryColors[category] || categoryColors[NotificationCategory.SYSTEM];
  const IconComponent = typeIcons[type] || BellIcon;

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      className={`
        w-10 h-10 rounded-sm items-center justify-center
        ${colors.bg}
        ${className}
      `}
    >
      <IconComponent size={size} color={colors.icon} />
    </View>
  );
});

export default NotificationIcon;
