import type { BadgeVariant } from '@/components/ui/Badge';

export interface StatusConfig {
  label: string;
  variant: BadgeVariant;
  textColor?: string;
  bgColor?: string;
  hexColor?: string;
}

export interface AttendanceStatusConfig extends StatusConfig {
  bgColor: string;
  textColor: string;
}

export type ApplicationStatusType =
  | 'applied'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'cancellation_pending';

export type ApplicationStatsKey =
  | 'total'
  | 'applied'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'cancellationPending';

export const STATUS_TO_STATS_KEY: Record<ApplicationStatusType, ApplicationStatsKey | null> = {
  applied: 'applied',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancellation_pending: 'cancellationPending',
};

export const APPLICATION_STATUS: Record<ApplicationStatusType, StatusConfig> = {
  applied: {
    label: '지원완료',
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#A855F7',
  },
  confirmed: {
    label: '확정',
    variant: 'success',
    textColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    hexColor: '#22C55E',
  },
  rejected: {
    label: '거절',
    variant: 'error',
    textColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    hexColor: '#EF4444',
  },
  cancelled: {
    label: '취소',
    variant: 'default',
    textColor: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-surface',
    hexColor: '#6B7280',
  },
  completed: {
    label: '완료',
    variant: 'default',
    textColor: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    hexColor: '#8B5CF6',
  },
  cancellation_pending: {
    label: '취소요청',
    variant: 'warning',
    textColor: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    hexColor: '#F97316',
  },
};

export type ScheduleStatusType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

export const SCHEDULE_STATUS: Record<ScheduleStatusType, StatusConfig> = {
  applied: {
    label: '지원 중',
    variant: 'warning',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    hexColor: '#F59E0B',
  },
  confirmed: {
    label: '확정',
    variant: 'success',
    textColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    hexColor: '#22C55E',
  },
  completed: {
    label: '완료',
    variant: 'default',
    textColor: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-surface',
    hexColor: '#6B7280',
  },
  cancelled: {
    label: '취소',
    variant: 'error',
    textColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    hexColor: '#EF4444',
  },
};

export type AttendanceStatusType = 'not_started' | 'checked_in' | 'checked_out';

export const ATTENDANCE_STATUS: Record<AttendanceStatusType, AttendanceStatusConfig> = {
  not_started: {
    label: '출근 전',
    variant: 'default',
    bgColor: 'bg-gray-100 dark:bg-surface',
    textColor: 'text-gray-600 dark:text-gray-400',
    hexColor: '#6B7280',
  },
  checked_in: {
    label: '근무 중',
    variant: 'success',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    hexColor: '#22C55E',
  },
  checked_out: {
    label: '퇴근 완료',
    variant: 'primary',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    textColor: 'text-primary-700 dark:text-primary-300',
    hexColor: '#A855F7',
  },
};

export type PayrollStatusType = 'pending' | 'processing' | 'completed';

export const PAYROLL_STATUS: Record<PayrollStatusType, StatusConfig> = {
  pending: {
    label: '정산 대기',
    variant: 'warning',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    hexColor: '#F59E0B',
  },
  processing: {
    label: '정산 진행',
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#A855F7',
  },
  completed: {
    label: '정산 완료',
    variant: 'success',
    textColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    hexColor: '#22C55E',
  },
};

export type JobPostingStatusType = 'active' | 'closed' | 'cancelled';

export const JOB_POSTING_STATUS: Record<JobPostingStatusType, StatusConfig> = {
  active: {
    label: '모집중',
    variant: 'success',
    textColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    hexColor: '#22C55E',
  },
  closed: {
    label: '마감',
    variant: 'default',
    textColor: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-surface',
    hexColor: '#6B7280',
  },
  cancelled: {
    label: '취소됨',
    variant: 'error',
    textColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    hexColor: '#EF4444',
  },
};

export type InquiryStatusType = 'open' | 'in_progress' | 'closed';

export const INQUIRY_STATUS: Record<InquiryStatusType, StatusConfig> = {
  open: {
    label: '접수',
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#A855F7',
  },
  in_progress: {
    label: '처리중',
    variant: 'warning',
    textColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    hexColor: '#F59E0B',
  },
  closed: {
    label: '답변 완료',
    variant: 'success',
    textColor: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    hexColor: '#22C55E',
  },
};

export type AnnouncementPriorityType = 'urgent' | 'important' | 'normal';

export const ANNOUNCEMENT_PRIORITY: Record<AnnouncementPriorityType, StatusConfig> = {
  urgent: {
    label: '긴급',
    variant: 'error',
    textColor: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    hexColor: '#EF4444',
  },
  important: {
    label: '중요',
    variant: 'warning',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    hexColor: '#F59E0B',
  },
  normal: {
    label: '일반',
    variant: 'default',
    textColor: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-surface',
    hexColor: '#6B7280',
  },
};

export function getStatusConfig<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): StatusConfig {
  if (!status || !(status in configMap)) {
    return {
      label: '상태 없음',
      variant: 'default',
      textColor: 'text-gray-500 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-surface',
      hexColor: '#6B7280',
    };
  }
  return configMap[status as T];
}

export function getStatusLabel<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): string {
  return getStatusConfig(configMap, status).label;
}

export function getStatusHexColor<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): string {
  return getStatusConfig(configMap, status).hexColor ?? '#6B7280';
}

export function getStatusVariant<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): BadgeVariant {
  return getStatusConfig(configMap, status).variant;
}

export const attendanceConfig = ATTENDANCE_STATUS;
