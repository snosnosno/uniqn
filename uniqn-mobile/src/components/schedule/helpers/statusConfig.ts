/**
 * UNIQN Mobile - ScheduleCard 상태 설정
 *
 * @description 스케줄 상태별 UI 설정
 * @version 1.0.0
 */

import type { ScheduleType, AttendanceStatus } from '@/types';

/**
 * 스케줄 타입별 상태 표시 설정
 */
export const statusConfig: Record<ScheduleType, { label: string; variant: 'warning' | 'success' | 'default' | 'error' }> = {
  applied: { label: '지원 중', variant: 'warning' },
  confirmed: { label: '확정', variant: 'success' },
  completed: { label: '완료', variant: 'default' },
  cancelled: { label: '취소', variant: 'error' },
};

/**
 * 출퇴근 상태별 스타일 설정
 */
export const attendanceConfig: Record<AttendanceStatus, { label: string; bgColor: string; textColor: string }> = {
  not_started: {
    label: '출근 전',
    bgColor: 'bg-gray-100 dark:bg-surface',
    textColor: 'text-gray-600 dark:text-gray-400',
  },
  checked_in: {
    label: '근무 중',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
  },
  checked_out: {
    label: '퇴근 완료',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    textColor: 'text-primary-700 dark:text-primary-300',
  },
};
