/**
 * UNIQN Mobile - 스케줄 관련 타입 정의
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument } from './common';

/**
 * 출석 상태
 */
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

/**
 * 스케줄 타입
 */
export type ScheduleType = 'applied' | 'confirmed' | 'completed' | 'cancelled';

/**
 * 정산 상태
 */
export type PayrollStatus = 'pending' | 'processing' | 'completed';

/**
 * 스케줄 이벤트
 */
export interface ScheduleEvent extends FirebaseDocument {
  // 기본 정보
  type: ScheduleType;
  date: string; // YYYY-MM-DD

  // 시간 정보
  startTime: Timestamp | null;
  endTime: Timestamp | null;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;

  // 이벤트 정보
  eventId: string;
  eventName: string;
  location: string;
  detailedAddress?: string;

  // 역할 정보
  role: string;
  status: AttendanceStatus;

  // 정산 정보
  payrollStatus?: PayrollStatus;
  payrollAmount?: number;
  payrollDate?: Timestamp;

  // 메타데이터
  notes?: string;
  sourceCollection: 'workLogs' | 'applications';
  sourceId: string;
  workLogId?: string;
  applicationId?: string;
}

/**
 * 스케줄 필터
 */
export interface ScheduleFilters {
  dateRange: {
    start: string;
    end: string;
  };
  searchTerm?: string;
  type?: ScheduleType;
  status?: AttendanceStatus;
}

/**
 * 스케줄 통계
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
export type CalendarView = 'month' | 'week' | 'day';

/**
 * 스케줄 그룹 (날짜별)
 */
export interface ScheduleGroup {
  date: string;
  formattedDate: string;
  events: ScheduleEvent[];
  isToday: boolean;
  isPast: boolean;
}

/**
 * 출퇴근 요청
 */
export interface AttendanceRequest {
  scheduleId: string;
  action: 'checkIn' | 'checkOut';
  timestamp: Timestamp;
  qrCodeId?: string;
}

/**
 * 근무 시간 수정 이력
 */
export interface WorkTimeModification {
  modifiedAt: string | Timestamp;
  modifiedBy: string;
  reason: string;
  previousStartTime?: string | Timestamp | null;
  previousEndTime?: string | Timestamp | null;
  /** 새 출근 시간 (null = 미정) */
  newStartTime?: string | Timestamp | null;
  /** 새 퇴근 시간 (null = 미정) */
  newEndTime?: string | Timestamp | null;
}

/**
 * 역할 변경 이력
 */
export interface RoleChangeHistory {
  changedAt: string | Timestamp;
  changedBy: string;
  reason: string;
  previousRole: string;
  newRole: string;
}

/**
 * 근무 기록 (WorkLog)
 */
export interface WorkLog extends FirebaseDocument {
  staffId: string;
  eventId: string;
  date: string;

  // 예정 시간
  scheduledStartTime?: string | Timestamp;
  scheduledEndTime?: string | Timestamp;

  // 실제 시간
  actualStartTime?: string | Timestamp;
  actualEndTime?: string | Timestamp;

  // 상태
  status: 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled';
  role: string;
  /** 커스텀 역할명 (role이 'other'일 때) */
  customRole?: string;

  // 정산
  payrollStatus?: PayrollStatus;
  payrollAmount?: number;
  payrollDate?: Timestamp;
  payrollNotes?: string;

  // 수정 이력 (구인자에 의한 시간 수정)
  modificationHistory?: WorkTimeModification[];

  // 역할 변경 이력
  roleChangeHistory?: RoleChangeHistory[];

  notes?: string;
}

/**
 * 스케줄 타입별 색상
 */
export const SCHEDULE_COLORS: Record<
  ScheduleType,
  {
    bg: string;
    border: string;
    text: string;
  }
> = {
  applied: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    border: 'border-yellow-500',
    text: 'text-yellow-800 dark:text-yellow-200',
  },
  confirmed: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-500',
    text: 'text-green-800 dark:text-green-200',
  },
  completed: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-500',
    text: 'text-blue-800 dark:text-blue-200',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-500',
    text: 'text-red-800 dark:text-red-200',
  },
};

/**
 * 출석 상태별 색상
 */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  not_started: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  checked_in: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300',
  checked_out: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300',
};

/**
 * 스케줄 타입 라벨
 */
export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  applied: '지원 중',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소됨',
};

/**
 * 출석 상태 라벨
 */
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_started: '출근 전',
  checked_in: '근무 중',
  checked_out: '퇴근 완료',
};

// ============================================================================
// QR Code Types
// ============================================================================

/**
 * QR 코드 액션 타입
 */
export type QRCodeAction = 'checkIn' | 'checkOut';

/**
 * QR 코드 데이터 (Firestore 문서)
 */
export interface QRCodeData {
  id: string;
  eventId: string;
  staffId: string;
  action: QRCodeAction;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  isUsed: boolean;
  usedAt?: Timestamp;
}

/**
 * QR 코드 생성 요청
 */
export interface CreateQRCodeRequest {
  eventId: string;
  action: QRCodeAction;
}

/**
 * QR 코드 스캔 결과
 */
export interface QRCodeScanResult {
  success: boolean;
  qrCodeId?: string;
  eventId?: string;
  action?: QRCodeAction;
  error?: string;
}

/**
 * QR 코드 검증 결과
 */
export interface QRCodeValidationResult {
  isValid: boolean;
  qrData?: QRCodeData;
  error?: string;
  errorCode?: 'EXPIRED' | 'INVALID' | 'USED' | 'WRONG_ACTION';
}
