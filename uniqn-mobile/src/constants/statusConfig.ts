/**
 * UNIQN Mobile - 상태 설정 통합
 *
 * @description 모든 상태의 라벨, 색상, 배지 스타일 중앙 관리
 * @version 1.0.0
 *
 * 기존 분산된 상태 설정을 통합:
 * - JobCard.tsx의 applicationStatusConfig
 * - ScheduleCard.tsx의 statusConfig
 * - Badge.tsx의 BADGE_PRESETS
 * - 각종 컴포넌트의 statusConfig 로컬 정의
 */

import type { BadgeVariant } from '@/components/ui/Badge';

// ============================================================================
// Types
// ============================================================================

/**
 * 상태 설정 인터페이스
 */
export interface StatusConfig {
  /** 표시 라벨 */
  label: string;
  /** Badge variant */
  variant: BadgeVariant;
  /** NativeWind 텍스트 색상 클래스 */
  textColor?: string;
  /** NativeWind 배경 색상 클래스 */
  bgColor?: string;
  /** HEX 색상 코드 (차트/아이콘용) */
  hexColor?: string;
}

/**
 * 출석 상태 설정 인터페이스 (확장)
 */
export interface AttendanceStatusConfig extends StatusConfig {
  /** 배경 색상 클래스 */
  bgColor: string;
  /** 텍스트 색상 클래스 */
  textColor: string;
}

// ============================================================================
// Application Status (지원 상태)
// ============================================================================

/**
 * 지원 상태 타입
 */
export type ApplicationStatusType =
  | 'applied'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'cancellation_pending';

/**
 * ApplicationStats 필드명 타입
 */
export type ApplicationStatsKey =
  | 'total'
  | 'applied'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'completed'
  | 'cancellationPending';

/**
 * ApplicationStatus → ApplicationStats 필드명 매핑
 *
 * @description ApplicationStatus는 snake_case (cancellation_pending)
 *              ApplicationStats 필드는 camelCase (cancellationPending)
 *
 * @example
 * import { STATUS_TO_STATS_KEY } from '@/constants/statusConfig';
 *
 * const statsKey = STATUS_TO_STATS_KEY[application.status];
 * if (statsKey && statsKey !== 'total') {
 *   stats[statsKey]++;
 * }
 */
export const STATUS_TO_STATS_KEY: Record<ApplicationStatusType, ApplicationStatsKey | null> = {
  applied: 'applied',
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancellation_pending: 'cancellationPending',
};

/**
 * 지원 상태 설정
 *
 * @example
 * import { APPLICATION_STATUS } from '@/constants/statusConfig';
 *
 * const status = APPLICATION_STATUS['confirmed'];
 * // { label: '확정', variant: 'success', hexColor: '#22C55E' }
 */
export const APPLICATION_STATUS: Record<ApplicationStatusType, StatusConfig> = {
  applied: {
    label: '지원완료',
    variant: 'primary',
    textColor: 'text-primary-600 dark:text-primary-400',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    hexColor: '#A855F7',
  },
  pending: {
    label: '검토중',
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

// ============================================================================
// Schedule Status (스케줄 상태)
// ============================================================================

/**
 * 스케줄 상태 타입
 */
export type ScheduleStatusType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

/**
 * 스케줄 상태 설정
 *
 * @example
 * const config = SCHEDULE_STATUS['confirmed'];
 * <Badge variant={config.variant}>{config.label}</Badge>
 */
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

// ============================================================================
// Attendance Status (출석 상태)
// ============================================================================

/**
 * 출석 상태 타입
 */
export type AttendanceStatusType = 'not_started' | 'checked_in' | 'checked_out';

/**
 * 출석 상태 설정
 */
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

// ============================================================================
// Payroll Status (정산 상태)
// ============================================================================

/**
 * 정산 상태 타입
 */
export type PayrollStatusType = 'pending' | 'processing' | 'completed';

/**
 * 정산 상태 설정
 */
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

// ============================================================================
// Job Posting Status (공고 상태)
// ============================================================================

/**
 * 공고 상태 타입
 */
export type JobPostingStatusType = 'active' | 'closed' | 'cancelled' | 'draft';

/**
 * 공고 상태 설정
 */
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
  draft: {
    label: '임시저장',
    variant: 'secondary',
    textColor: 'text-gray-500 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-surface',
    hexColor: '#9CA3AF',
  },
};

// ============================================================================
// Inquiry Status (문의 상태)
// ============================================================================

/**
 * 문의 상태 타입
 */
export type InquiryStatusType = 'open' | 'in_progress' | 'closed';

/**
 * 문의 상태 설정
 */
export const INQUIRY_STATUS: Record<InquiryStatusType, StatusConfig> = {
  open: {
    label: '접수됨',
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

// ============================================================================
// Announcement Status (공지 상태)
// ============================================================================

/**
 * 공지 우선순위 타입
 */
export type AnnouncementPriorityType = 'urgent' | 'important' | 'normal';

/**
 * 공지 우선순위 설정
 */
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 상태 설정 조회 (null-safe)
 *
 * @param configMap - 상태 설정 맵
 * @param status - 상태 값
 * @returns 상태 설정 또는 기본값
 *
 * @example
 * const config = getStatusConfig(APPLICATION_STATUS, application.status);
 * <Badge variant={config.variant}>{config.label}</Badge>
 */
export function getStatusConfig<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): StatusConfig {
  if (!status || !(status in configMap)) {
    return {
      label: '알 수 없음',
      variant: 'default',
      textColor: 'text-gray-500 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-surface',
      hexColor: '#6B7280',
    };
  }
  return configMap[status as T];
}

/**
 * 상태 라벨 조회
 *
 * @example
 * const label = getStatusLabel(APPLICATION_STATUS, 'confirmed'); // '확정'
 */
export function getStatusLabel<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): string {
  return getStatusConfig(configMap, status).label;
}

/**
 * 상태 색상 조회 (HEX)
 *
 * @example
 * const color = getStatusHexColor(APPLICATION_STATUS, 'confirmed'); // '#22C55E'
 */
export function getStatusHexColor<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): string {
  return getStatusConfig(configMap, status).hexColor ?? '#6B7280';
}

/**
 * 상태 Badge variant 조회
 *
 * @example
 * const variant = getStatusVariant(APPLICATION_STATUS, 'confirmed'); // 'success'
 */
export function getStatusVariant<T extends string>(
  configMap: Record<T, StatusConfig>,
  status: T | string | undefined | null
): BadgeVariant {
  return getStatusConfig(configMap, status).variant;
}

// ============================================================================
// Legacy Compatibility (기존 컴포넌트와 호환)
// ============================================================================

/**
 * JobCard 호환용 applicationStatusConfig
 * @deprecated APPLICATION_STATUS 사용 권장
 */
export const applicationStatusConfig = SCHEDULE_STATUS;

/**
 * ScheduleCard 호환용 statusConfig
 * @deprecated SCHEDULE_STATUS 사용 권장
 */
export const statusConfig = SCHEDULE_STATUS;

/**
 * ScheduleCard 호환용 attendanceConfig
 * @deprecated ATTENDANCE_STATUS 사용 권장
 */
export const attendanceConfig = ATTENDANCE_STATUS;
