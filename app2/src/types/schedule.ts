import { Timestamp } from 'firebase/firestore';

// 출석 상태 타입 (기존 시스템과 호환)
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out' | 'absent';

// 일정 타입 (지원/확정/완료/취소)
export type ScheduleType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

// 정산 상태
export type PayrollStatus = 'pending' | 'processing' | 'completed';

/**
 * 통합 스케줄 이벤트 인터페이스
 * workLogs, applications, staff 데이터를 통합하여 표시
 */
export interface ScheduleEvent {
  id: string;
  type: ScheduleType;
  date: string; // YYYY-MM-DD 형식
  startTime: Timestamp | null;
  endTime: Timestamp | null;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  eventId: string;
  eventName: string;
  location: string;
  detailedAddress?: string;
  role: string;
  status: AttendanceStatus;
  applicationStatus?: 'pending' | 'confirmed' | 'rejected';
  payrollStatus?: PayrollStatus;
  payrollAmount?: number;
  payrollDate?: Timestamp;
  notes?: string;
  
  // 원본 데이터 참조
  sourceCollection: 'workLogs' | 'applications' | 'staff';
  sourceId: string;
  workLogId?: string; // workLogs 참조
  applicationId?: string; // applications 참조
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
 * 스케줄 필터 옵션
 */
export interface ScheduleFilters {
  type: ScheduleType | 'all';
  status: AttendanceStatus | 'all';
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
  checked_out: 'bg-blue-100 text-blue-600',
  absent: 'bg-red-100 text-red-600'
};

/**
 * 날짜/시간 유틸리티 타입
 */
export interface TimeSlotInfo {
  displayTime: string; // "18:00 - 02:00"
  duration: number; // 근무 시간 (분 단위)
  isOvernight: boolean; // 자정을 넘어가는 근무인지
}