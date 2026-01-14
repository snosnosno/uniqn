/**
 * UNIQN Mobile - 스케줄 관련 타입 정의
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument } from './common';
import type { JobPostingCard } from './jobPosting';

/**
 * 출석 상태 (UI 표시용)
 */
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

/**
 * WorkLog 상태 (전체 lifecycle)
 */
export type WorkLogStatus =
  | 'scheduled' // 예정됨
  | 'checked_in' // 출근 완료
  | 'checked_out' // 퇴근 완료
  | 'completed' // 정산 완료
  | 'cancelled'; // 취소됨

/**
 * WorkLogStatus → AttendanceStatus 변환 유틸
 *
 * @example
 * toAttendanceStatus('scheduled') // 'not_started'
 * toAttendanceStatus('checked_in') // 'checked_in'
 * toAttendanceStatus('completed') // 'checked_out'
 */
export function toAttendanceStatus(workLogStatus: WorkLogStatus): AttendanceStatus {
  switch (workLogStatus) {
    case 'scheduled':
      return 'not_started';
    case 'checked_in':
      return 'checked_in';
    case 'checked_out':
    case 'completed':
      return 'checked_out';
    case 'cancelled':
      return 'not_started';
    default:
      return 'not_started';
  }
}

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
  /** 커스텀 역할명 (role이 'other'일 때) */
  customRole?: string;
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

  // JobCard 렌더링용 데이터 (스케줄 탭에서 사용)
  jobPostingCard?: JobPostingCard;
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
 * 정산 금액 수정 이력
 */
export interface SettlementModification {
  modifiedAt: string | Timestamp;
  modifiedBy: string;
  reason?: string;
  /** 이전 급여 정보 */
  previousSalaryInfo?: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
  };
  /** 새 급여 정보 */
  newSalaryInfo?: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
  };
  /** 이전 수당 정보 */
  previousAllowances?: Record<string, number>;
  /** 새 수당 정보 */
  newAllowances?: Record<string, number>;
  /** 이전 세금 설정 */
  previousTaxSettings?: {
    type: 'none' | 'rate' | 'fixed';
    value: number;
  };
  /** 새 세금 설정 */
  newTaxSettings?: {
    type: 'none' | 'rate' | 'fixed';
    value: number;
  };
}

/**
 * 근무 기록 (WorkLog)
 */
export interface WorkLog extends FirebaseDocument {
  staffId: string;
  eventId: string;
  date: string;

  // 스태프 프로필 정보 (비정규화 - 조회 편의)
  /** 스태프 이름 */
  staffName?: string;
  /** 스태프 닉네임 */
  staffNickname?: string;
  /** 스태프 프로필 사진 URL */
  staffPhotoURL?: string;

  // 예정 시간
  scheduledStartTime?: string | Timestamp;
  scheduledEndTime?: string | Timestamp;

  // 실제 시간
  actualStartTime?: string | Timestamp;
  actualEndTime?: string | Timestamp;

  // 상태
  status: WorkLogStatus;
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

  // 정산 금액 수정 이력
  settlementModificationHistory?: SettlementModification[];

  // 개별 오버라이드 설정 (구인자가 수정한 경우)
  customSalaryInfo?: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
  };
  customAllowances?: Record<string, number>;
  customTaxSettings?: {
    type: 'none' | 'rate' | 'fixed';
    value: number;
  };

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
 * QR 코드 스캔 결과 (QRCodeScanner 컴포넌트에서 사용)
 */
export interface QRCodeScanResult {
  success: boolean;
  /** 원본 QR 문자열 (processEventQRCheckIn용 - 필수) */
  qrString?: string;
  error?: string;
}


// ============================================================================
// Event QR Types (eventQRCodes 컬렉션)
// ============================================================================

/**
 * 이벤트 QR 코드 데이터 (Firestore eventQRCodes 문서)
 *
 * 구인자가 현장에서 생성하는 출퇴근용 QR 코드
 */
export interface EventQRCode {
  id: string;
  /** 공고 ID */
  eventId: string;
  /** 근무 날짜 (YYYY-MM-DD) */
  date: string;
  /** 출근/퇴근 */
  action: QRCodeAction;
  /** 보안 코드 (UUID) */
  securityCode: string;
  /** 생성자 ID (구인자) */
  createdBy: string;
  /** 생성 시간 */
  createdAt: Timestamp;
  /** 만료 시간 */
  expiresAt: Timestamp;
  /** 활성화 여부 (만료 시간으로 관리, isUsed 대신 사용) */
  isActive: boolean;
}

/**
 * QR 코드 표시용 데이터 (JSON stringify하여 QR 코드로 인코딩)
 */
export interface EventQRDisplayData {
  type: 'event';
  eventId: string;
  date: string;
  action: QRCodeAction;
  securityCode: string;
  /** 생성 시간 (ms) */
  createdAt: number;
  /** 만료 시간 (ms) */
  expiresAt: number;
}

/**
 * QR 생성 입력
 */
export interface GenerateEventQRInput {
  eventId: string;
  date: string;
  action: QRCodeAction;
  createdBy: string;
}

/**
 * QR 스캔 결과 (출퇴근 처리 후)
 */
export interface EventQRScanResult {
  success: boolean;
  workLogId: string;
  action: QRCodeAction;
  checkTime: Date;
  message: string;
}

/**
 * QR 검증 결과
 */
export interface EventQRValidationResult {
  isValid: boolean;
  eventId?: string;
  date?: string;
  action?: QRCodeAction;
  errorMessage?: string;
}
