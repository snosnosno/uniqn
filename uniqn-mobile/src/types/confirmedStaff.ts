/**
 * UNIQN Mobile - 확정 스태프 관련 타입 정의
 *
 * @description 구인자의 확정 스태프 관리에 사용되는 타입들
 * @version 1.0.0
 */

import type { Timestamp } from 'firebase/firestore';
import type { WorkLog, PayrollStatus } from './schedule';
import type { TimeInput } from '@/shared/time/types';
import { STATUS } from '@/constants';

// ============================================================================
// 확정 스태프 상태
// ============================================================================

/**
 * 확정 스태프 출퇴근 상태 (WorkLog.status 확장)
 */
export type ConfirmedStaffStatus =
  | 'scheduled' // 출근 예정
  | 'checked_in' // 출근 완료
  | 'checked_out' // 퇴근 완료
  | 'completed' // 근무 완료 (정산 대기)
  | 'cancelled' // 취소됨
  | 'no_show'; // 노쇼

/**
 * 확정 스태프 상태 라벨
 */
export const CONFIRMED_STAFF_STATUS_LABELS: Record<ConfirmedStaffStatus, string> = {
  scheduled: '출근 예정',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
  completed: '정산 대기',
  cancelled: '취소됨',
  no_show: '노쇼',
};

/**
 * 확정 스태프 상태별 색상 (NativeWind)
 */
export const CONFIRMED_STAFF_STATUS_COLORS: Record<
  ConfirmedStaffStatus,
  { bg: string; text: string }
> = {
  scheduled: {
    bg: 'bg-gray-100 dark:bg-surface',
    text: 'text-gray-600 dark:text-gray-300',
  },
  checked_in: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-300',
  },
  checked_out: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    text: 'text-primary-600 dark:text-primary-300',
  },
  completed: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-300',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-300',
  },
  no_show: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-300',
  },
};

// ============================================================================
// 확정 스태프 인터페이스
// ============================================================================

/**
 * 확정 스태프 정보 (WorkLog 기반)
 *
 * @description workLogs 컬렉션에서 jobPostingId로 필터링하여 조회
 */
export interface ConfirmedStaff {
  /** WorkLog ID */
  id: string;

  /** 스태프 ID */
  staffId: string;

  /** 스태프 이름 */
  staffName: string;

  /** 스태프 닉네임 */
  staffNickname?: string;

  /** 스태프 프로필 사진 URL */
  staffPhotoURL?: string;

  /** 스태프 연락처 */
  phone?: string;

  /** 담당 역할 */
  role: string;

  /** 커스텀 역할명 (role이 'other'일 때) */
  customRole?: string;

  /** 근무 날짜 (YYYY-MM-DD) */
  date: string;

  /** 출퇴근 상태 */
  status: ConfirmedStaffStatus;

  /** 근무 시간대 (예: "09:00-18:00", "18:00~02:00") */
  timeSlot?: string;

  /** 출근 시간 (QR 출근 또는 관리자 수정, null이면 미정) */
  checkInTime?: TimeInput;

  /** 퇴근 시간 (QR 퇴근 또는 관리자 수정, null이면 미정) */
  checkOutTime?: TimeInput;

  /** 예정 출근 시간 */
  scheduledStartTime?: Timestamp | string;

  /** 예정 퇴근 시간 */
  scheduledEndTime?: Timestamp | string;

  /** 정산 상태 */
  payrollStatus?: PayrollStatus;

  /** 정산 금액 */
  payrollAmount?: number;

  /** 비고 */
  notes?: string;

  /** 읽음 여부 (신규 지원자 표시용) */
  isRead?: boolean;

  /** 원본 WorkLog */
  workLog?: WorkLog;
}

/**
 * 날짜별 스태프 그룹
 */
export interface ConfirmedStaffGroup {
  /** 날짜 (YYYY-MM-DD) */
  date: string;

  /** 포맷된 날짜 (예: "1월 15일 (수)") */
  formattedDate: string;

  /** 해당 날짜의 스태프 목록 */
  staff: ConfirmedStaff[];

  /** 오늘 여부 */
  isToday: boolean;

  /** 지난 날짜 여부 */
  isPast: boolean;

  /** 통계 */
  stats: {
    total: number;
    checkedIn: number;
    completed: number;
    noShow: number;
  };
}

// ============================================================================
// 스태프 관리 액션
// ============================================================================

/**
 * 시간 수정 입력
 */
export interface UpdateWorkTimeInput {
  workLogId: string;
  /** 출근 시간 (null이면 미정으로 설정) */
  checkInTime: TimeInput;
  /** 퇴근 시간 (null이면 미정으로 설정) */
  checkOutTime: TimeInput;
  reason: string;
  /** 수정자 ID (선택적, 기본값: 'system') */
  modifiedBy?: string;
}

/**
 * 역할 변경 입력
 */
export interface UpdateStaffRoleInput {
  workLogId: string;
  newRole: string;
  reason: string;
  /** 변경자 ID (선택적, 기본값: 'system') */
  changedBy?: string;
}

/**
 * 스태프 삭제 입력
 */
export interface DeleteConfirmedStaffInput {
  workLogId: string;
  jobPostingId: string;
  staffId: string;
  date: string;
  reason?: string;
}

/**
 * 확정 스태프 필터 옵션
 */
export interface ConfirmedStaffFilters {
  /** 날짜 필터 */
  date?: string;
  /** 상태 필터 */
  status?: ConfirmedStaffStatus;
  /** 역할 필터 */
  role?: string;
  /** 정산 상태 필터 */
  payrollStatus?: PayrollStatus;
}

/**
 * 날짜별 그룹화된 확정 스태프
 */
export type GroupedConfirmedStaff = Record<string, ConfirmedStaff[]>;

/**
 * 스태프 관리 통계
 */
export interface ConfirmedStaffStats {
  /** 전체 확정 스태프 수 */
  total: number;

  /** 출근 예정 */
  scheduled: number;

  /** 근무 중 */
  checkedIn: number;

  /** 퇴근 완료 */
  checkedOut: number;

  /** 근무 완료 (정산 대기) */
  completed: number;

  /** 취소됨 */
  cancelled: number;

  /** 노쇼 */
  noShow: number;

  /** 정산 완료 */
  settled: number;
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * WorkLog에서 ConfirmedStaff로 변환
 */
export function workLogToConfirmedStaff(
  workLog: WorkLog & {
    timeSlot?: string;
    checkInTime?: TimeInput;
    checkOutTime?: TimeInput;
    customRole?: string;
  },
  staffName?: string
): ConfirmedStaff {
  return {
    id: workLog.id,
    staffId: workLog.staffId,
    staffName: staffName || workLog.staffId.slice(-4),
    role: workLog.role,
    customRole: workLog.customRole,
    date: workLog.date,
    status: workLog.status as ConfirmedStaffStatus,
    timeSlot: workLog.timeSlot,
    checkInTime: workLog.checkInTime as Timestamp | string | null | undefined,
    checkOutTime: workLog.checkOutTime as Timestamp | string | null | undefined,
    scheduledStartTime: workLog.scheduledStartTime,
    scheduledEndTime: workLog.scheduledEndTime,
    payrollStatus: workLog.payrollStatus,
    payrollAmount: workLog.payrollAmount,
    notes: workLog.notes,
    workLog,
  };
}

/**
 * 스태프를 날짜별로 그룹화
 */
export function groupStaffByDate(staffList: ConfirmedStaff[]): ConfirmedStaffGroup[] {
  const today = new Date().toISOString().split('T')[0];
  const groupMap = new Map<string, ConfirmedStaff[]>();

  // 날짜별 그룹화
  staffList.forEach((staff) => {
    const existing = groupMap.get(staff.date) || [];
    groupMap.set(staff.date, [...existing, staff]);
  });

  // 그룹 변환 및 정렬
  const groups: ConfirmedStaffGroup[] = Array.from(groupMap.entries())
    .map(([date, staffInDate]) => {
      const dateObj = new Date(date);
      const formattedDate = formatDateKorean(dateObj);

      return {
        date,
        formattedDate,
        staff: staffInDate,
        isToday: date === today,
        isPast: date < today,
        stats: {
          total: staffInDate.length,
          checkedIn: staffInDate.filter((s) => s.status === STATUS.WORK_LOG.CHECKED_IN).length,
          completed: staffInDate.filter((s) => s.status === STATUS.WORK_LOG.CHECKED_OUT || s.status === STATUS.WORK_LOG.COMPLETED)
            .length,
          noShow: staffInDate.filter((s) => s.status === 'no_show').length,
        },
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return groups;
}

/**
 * 날짜를 한국어 형식으로 포맷 (예: "1월 15일 (수)")
 */
function formatDateKorean(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = dayNames[date.getDay()];

  return `${month}월 ${day}일 (${dayOfWeek})`;
}

/**
 * 스태프 통계 계산
 */
export function calculateStaffStats(staffList: ConfirmedStaff[]): ConfirmedStaffStats {
  return {
    total: staffList.length,
    scheduled: staffList.filter((s) => s.status === STATUS.WORK_LOG.SCHEDULED).length,
    checkedIn: staffList.filter((s) => s.status === STATUS.WORK_LOG.CHECKED_IN).length,
    checkedOut: staffList.filter((s) => s.status === STATUS.WORK_LOG.CHECKED_OUT).length,
    completed: staffList.filter((s) => s.status === STATUS.WORK_LOG.COMPLETED).length,
    cancelled: staffList.filter((s) => s.status === STATUS.WORK_LOG.CANCELLED).length,
    noShow: staffList.filter((s) => s.status === 'no_show').length,
    settled: staffList.filter((s) => s.payrollStatus === STATUS.PAYROLL.COMPLETED).length,
  };
}

/**
 * 스태프 상태 우선순위에 따라 정렬
 * (근무 중 > 출근 예정 > 퇴근 완료 > 정산 대기 > 노쇼 > 취소)
 */
export function sortStaffByStatus(staffList: ConfirmedStaff[]): ConfirmedStaff[] {
  const statusPriority: Record<ConfirmedStaffStatus, number> = {
    checked_in: 0,
    scheduled: 1,
    checked_out: 2,
    completed: 3,
    no_show: 4,
    cancelled: 5,
  };

  return [...staffList].sort((a, b) => {
    const priorityA = statusPriority[a.status] ?? 99;
    const priorityB = statusPriority[b.status] ?? 99;
    return priorityA - priorityB;
  });
}
