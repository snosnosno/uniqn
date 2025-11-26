/**
 * 스케줄 관리 관련 타입 정의
 *
 * 이 파일은 T-HOLDEM 프로젝트의 스케줄 및 일정 관리를 위한 타입들을 정의합니다.
 *
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 *
 * 주요 특징:
 * - 통합된 스케줄 이벤트 타입
 * - 출석 상태 및 일정 타입 표준화
 * - workLogs, applications, staff 데이터 통합 처리
 * - 캘린더 뷰 및 필터링 지원
 */

import { Timestamp } from 'firebase/firestore';
import { AttendanceStatus } from './attendance';

/**
 * AttendanceStatus - attendance.ts에서 re-export
 *
 * @description 출석 상태는 attendance.ts에서 단일 정의(SSOT)됩니다.
 * 이 re-export는 기존 import 경로와의 하위 호환성을 위해 유지됩니다.
 *
 * @see types/attendance.ts - AttendanceStatus의 단일 정의(SSOT)
 */
export type { AttendanceStatus };

// 일정 타입 (지원/확정/완료/취소)
/**
 * 스케줄 타입 열거형
 * @description 스케줄의 상태를 나타냅니다.
 */
export type ScheduleType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

// 정산 상태
/**
 * 정산 상태 열거형
 * @description 급여 정산의 진행 상태를 나타냅니다.
 */
export type PayrollStatus = 'pending' | 'processing' | 'completed';

/**
 * 통합 스케줄 이벤트 인터페이스
 * @description workLogs, applications, staff 데이터를 통합하여 표시하는 스케줄 이벤트입니다.
 *
 * 데이터 소스 우선순위:
 * - workLogs: 확정된 근무 일정 (가장 높은 우선순위)
 * - applications: 지원한 일정
 * - staff: 기본 스태프 정보 (fallback)
 *
 * 시간 정보:
 * - startTime/endTime: 예정 시간
 * - actualStartTime/EndTime: 실제 근무 시간
 *
 * @example
 * ```typescript
 * const scheduleEvent: ScheduleEvent = {
 *   id: 'event-123',
 *   type: 'confirmed',
 *   date: '2025-01-28',
 *   startTime: Timestamp.now(),
 *   endTime: Timestamp.now(),
 *   eventId: 'job-456',
 *   eventName: '홀덤 토너먼트',
 *   location: '강남구 카지노',
 *   role: 'dealer',
 *   status: 'not_started',
 *   sourceCollection: 'workLogs',
 *   sourceId: 'worklog-789'
 * };
 * ```
 */
export interface ScheduleEvent {
  /** 스케줄 이벤트 고유 ID */
  id: string;

  /** 스케줄 타입 */
  type: ScheduleType;

  /** 스케줄 날짜 (YYYY-MM-DD 형식) */
  date: string;

  /** 시작 시간 (표준 필드) */
  startTime: Timestamp | null;

  /** 종료 시간 (표준 필드) */
  endTime: Timestamp | null;

  /** 실제 시작 시간 */
  actualStartTime?: Timestamp | null;

  /** 실제 종료 시간 */
  actualEndTime?: Timestamp | null;

  /** 이벤트 ID */
  eventId: string;

  /** 이벤트 이름 */
  eventName: string;

  /** 위치 */
  location: string;

  /** 상세 주소 */
  detailedAddress?: string;

  /** 역할 */
  role: string;

  /** 출석 상태 */
  status: AttendanceStatus;

  /** 지원 상태 */
  applicationStatus?: 'applied' | 'confirmed' | 'rejected' | 'completed';

  /** 정산 상태 */
  payrollStatus?: PayrollStatus;

  /** 정산 금액 */
  payrollAmount?: number;

  /** 정산 날짜 */
  payrollDate?: Timestamp;

  /** 비고 */
  notes?: string;

  // 원본 데이터 참조
  /** 데이터 소스 컬렉션 */
  sourceCollection: 'workLogs' | 'applications' | 'staff';

  /** 소스 문서 ID */
  sourceId: string;

  /** WorkLog ID (workLogs 소스인 경우) */
  workLogId?: string;

  /** Application ID (applications 소스인 경우) */
  applicationId?: string;

  /**
   * 공고 삭제 대비 스냅샷 데이터
   * @description JobPosting 삭제 후에도 급여 계산 및 정보 표시를 위한 스냅샷
   *
   * 생성 시점:
   * - 지원 확정 시 (confirmed 상태 전환)
   * - WorkLog 생성 시
   * - 공고 삭제 전 (자동 트리거)
   *
   * 우선순위:
   * 1. snapshotData (최우선)
   * 2. JobPosting (공고 존재 시)
   * 3. Schedule 기본값 (fallback)
   */
  snapshotData?: {
    /** 공고 제목 (High - 사용자 경험) */
    title?: string;

    /** 급여 정보 (Critical - 급여 계산 필수) */
    salary: {
      type: 'hourly' | 'daily' | 'monthly' | 'other';
      amount: number;
      useRoleSalary?: boolean;
      roleSalaries?: Record<
        string,
        {
          type: string;
          amount: number;
        }
      >;
    };

    /** 수당 정보 (Critical - 급여 계산 필수) */
    allowances?: {
      meal?: number;
      transportation?: number;
      accommodation?: number;
    };

    /** 세금 설정 (Critical - 급여 계산 필수) */
    taxSettings?: {
      enabled: boolean;
      taxRate?: number;
      taxAmount?: number;
    };

    /** 장소 정보 (High - 사용자 경험) */
    location: string;
    detailedAddress?: string;
    district?: string;
    contactPhone?: string;

    /** 신고 기능 (High - 신고 기능 유지) */
    createdBy: string;

    /** 스냅샷 메타 정보 (Low - 추적용) */
    snapshotAt: Timestamp;
    snapshotReason?: 'confirmed' | 'worklog_created' | 'posting_deleted';
  };
}

/**
 * 캘린더 이벤트 색상 설정
 */
export interface EventColorConfig {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
}

/**
 * 스케줄 필터 옵션 (상태 필터 제거, 날짜 범위와 검색어만 유지)
 */
export interface ScheduleFilters {
  dateRange: {
    start: string;
    end: string;
  };
  searchTerm?: string;
}

/**
 * 스케줄 통계 정보
 */
export interface ScheduleStats {
  totalSchedules: number;
  completedSchedules: number;
  upcomingSchedules: number;
  totalEarnings: number;
  thisMonthEarnings: number;
  hoursWorked: number;
}

/**
 * 캘린더 뷰 타입
 */
export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';

/**
 * 스케줄 그룹 (날짜별 그룹화용)
 */
export interface ScheduleGroup {
  date: string;
  formattedDate: string; // "2025년 1월 28일 (화)"
  events: ScheduleEvent[];
  isToday: boolean;
  isPast: boolean;
}

/**
 * 출퇴근 처리 요청
 */
export interface AttendanceRequest {
  scheduleId: string;
  action: 'checkIn' | 'checkOut';
  timestamp: Timestamp;
}

/**
 * 스케줄 이벤트 색상 매핑 (라이트 모드)
 */
export const SCHEDULE_COLORS: Record<ScheduleType, EventColorConfig> = {
  applied: {
    backgroundColor: '#FEF3C7', // 노란색 배경
    borderColor: '#F59E0B',
    textColor: '#92400E',
  },
  confirmed: {
    backgroundColor: '#D1FAE5', // 초록색 배경
    borderColor: '#10B981',
    textColor: '#065F46',
  },
  completed: {
    backgroundColor: '#DBEAFE', // 파란색 배경
    borderColor: '#3B82F6',
    textColor: '#1E3A8A',
  },
  cancelled: {
    backgroundColor: '#FEE2E2', // 빨간색 배경
    borderColor: '#EF4444',
    textColor: '#7F1D1D',
  },
};

/**
 * 스케줄 이벤트 색상 매핑 (다크 모드)
 */
export const SCHEDULE_COLORS_DARK: Record<ScheduleType, EventColorConfig> = {
  applied: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)', // 노란색 배경 (다크)
    borderColor: '#FBBF24',
    textColor: '#FCD34D',
  },
  confirmed: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)', // 초록색 배경 (다크)
    borderColor: '#10B981',
    textColor: '#6EE7B7',
  },
  completed: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)', // 파란색 배경 (다크)
    borderColor: '#3B82F6',
    textColor: '#93C5FD',
  },
  cancelled: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // 빨간색 배경 (다크)
    borderColor: '#EF4444',
    textColor: '#FCA5A5',
  },
};

/**
 * 테마에 따라 적절한 스케줄 색상을 반환
 */
export const getScheduleColors = (isDark: boolean): Record<ScheduleType, EventColorConfig> => {
  return isDark ? SCHEDULE_COLORS_DARK : SCHEDULE_COLORS;
};

/**
 * 출석 상태별 색상 매핑
 */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  not_started: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  checked_in: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300',
  checked_out: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
};

/**
 * 날짜/시간 유틸리티 타입
 */
export interface TimeSlotInfo {
  displayTime: string; // "18:00 - 02:00"
  duration: number; // 근무 시간 (분 단위)
  isOvernight: boolean; // 자정을 넘어가는 근무인지
}
