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

// 출석 상태 타입 (기존 시스템과 호환)
/**
 * 출석 상태 열거형
 * @description 스태프의 출석 상태를 나타냅니다.
 */
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

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
  applicationStatus?: 'pending' | 'confirmed' | 'rejected';
  
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
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * 스케줄 이벤트 색상 매핑
 */
export const SCHEDULE_COLORS: Record<ScheduleType, EventColorConfig> = {
  applied: {
    backgroundColor: '#FEF3C7', // 노란색 배경
    borderColor: '#F59E0B',
    textColor: '#92400E'
  },
  confirmed: {
    backgroundColor: '#D1FAE5', // 초록색 배경
    borderColor: '#10B981',
    textColor: '#065F46'
  },
  completed: {
    backgroundColor: '#DBEAFE', // 파란색 배경
    borderColor: '#3B82F6',
    textColor: '#1E3A8A'
  },
  cancelled: {
    backgroundColor: '#FEE2E2', // 빨간색 배경
    borderColor: '#EF4444',
    textColor: '#7F1D1D'
  }
};

/**
 * 출석 상태별 색상 매핑
 */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  checked_in: 'bg-green-100 text-green-600',
  checked_out: 'bg-blue-100 text-blue-600'
};

/**
 * 날짜/시간 유틸리티 타입
 */
export interface TimeSlotInfo {
  displayTime: string; // "18:00 - 02:00"
  duration: number; // 근무 시간 (분 단위)
  isOvernight: boolean; // 자정을 넘어가는 근무인지
}