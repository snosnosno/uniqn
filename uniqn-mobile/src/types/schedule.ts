/**
 * UNIQN Mobile - 스케줄 관련 타입 정의
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument } from './common';
import type { JobPostingCard, SalaryType } from './jobPosting';
import { StatusMapper } from '@/shared/status';

// Re-export SalaryType from jobPosting (single source of truth)
export type { SalaryType };

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
 * @description StatusMapper로 위임 (Phase 1 - 상태 매핑 통합)
 * @example
 * toAttendanceStatus('scheduled') // 'not_started'
 * toAttendanceStatus('checked_in') // 'checked_in'
 * toAttendanceStatus('completed') // 'checked_out'
 */
export function toAttendanceStatus(workLogStatus: WorkLogStatus): AttendanceStatus {
  return StatusMapper.toAttendance(workLogStatus);
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
 * 세금 타입
 */
export type TaxType = 'none' | 'rate' | 'fixed';

/**
 * 정산 세부 내역 (미리 계산하여 캐싱)
 *
 * scheduleService에서 WorkLog → ScheduleEvent 변환 시 한 번만 계산
 * SettlementTab에서는 이 데이터를 그대로 사용하여 중복 계산 방지
 */
export interface SettlementBreakdown {
  /** 근무 시간 (시간 단위) */
  hoursWorked: number;

  /** 적용된 급여 정보 */
  salaryInfo: {
    type: SalaryType;
    amount: number;
  };
  /** 기본급 */
  basePay: number;

  /** 적용된 수당 정보 (상세 내역) */
  allowances?: {
    guaranteedHours?: number;
    meal?: number;
    transportation?: number;
    accommodation?: number;
    additional?: number;
  };
  /** 수당 합계 */
  allowancePay: number;

  /** 적용된 세금 설정 */
  taxSettings?: {
    type: TaxType;
    value: number;
  };
  /** 세금 금액 */
  taxAmount: number;

  /** 세전 총액 (basePay + allowancePay) */
  totalPay: number;
  /** 세후 총액 */
  afterTaxPay: number;

  /** 예상 금액 여부 (actualTime이 없을 때 true) */
  isEstimate: boolean;
  /** 계산 시점 (ISO 날짜 문자열) */
  calculatedAt: string;
}

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
  /** 실제 출근 시간 (QR 스캔 또는 관리자 수정) */
  checkInTime?: Timestamp | null;
  /** 실제 퇴근 시간 (QR 스캔 또는 관리자 수정) */
  checkOutTime?: Timestamp | null;

  // 이벤트 정보
  /** 공고 ID (정규화된 필드명) */
  jobPostingId: string;
  /** 공고명 (정규화된 필드명) */
  jobPostingName: string;
  /**
   * @deprecated eventId 대신 jobPostingId 사용 - 하위 호환성용
   * @see IdNormalizer.normalizeJobId() 정규화 헬퍼 사용
   */
  eventId?: string;
  /** @deprecated eventName 대신 jobPostingName 사용 - 하위 호환성용 */
  eventName?: string;
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
  /** 미리 계산된 정산 세부 내역 */
  settlementBreakdown?: SettlementBreakdown;

  // 구인자 정보
  /** 구인자 연락처 */
  ownerPhone?: string;
  /** 구인자 ID */
  ownerId?: string;

  // 메타데이터
  notes?: string;
  sourceCollection: 'workLogs' | 'applications';
  sourceId: string;
  workLogId?: string;
  applicationId?: string;

  // 개별 오버라이드 (구인자가 스태프별로 수정한 정산 정보)
  /** 개별 급여 정보 (오버라이드) */
  customSalaryInfo?: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
  };
  /** 개별 수당 정보 (오버라이드) */
  customAllowances?: {
    guaranteedHours?: number;
    meal?: number;
    transportation?: number;
    accommodation?: number;
    additional?: number;
  };
  /** 개별 세금 설정 (오버라이드) */
  customTaxSettings?: {
    type: 'none' | 'rate' | 'fixed';
    value: number;
  };

  // JobCard 렌더링용 데이터 (스케줄 탭에서 사용)
  jobPostingCard?: JobPostingCard;

  /** 시간대 문자열 (예: "18:00~02:00") - 시간 표시 폴백용 */
  timeSlot?: string;
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
  /** 확정된 스케줄 (미래, type === 'confirmed') */
  confirmedSchedules: number;
  /** 지원 중인 스케줄 (미래, type === 'applied') */
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

// ============================================================================
// Grouped Schedule Types (연속/다중 날짜 통합 표시용)
// ============================================================================

/**
 * 날짜별 상태 정보 (통합 카드 펼침 시 표시)
 */
export interface DateStatus {
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 포맷된 날짜 (예: "1/15(수)") */
  formattedDate: string;
  /** 출석 상태 */
  status: AttendanceStatus;
  /** 해당 날짜의 원본 ScheduleEvent ID */
  scheduleEventId: string;
}

/**
 * 통합 스케줄 이벤트
 *
 * 같은 지원(applicationId)의 연속/비연속 다중 날짜를 하나의 카드로 통합 표시
 *
 * @example
 * 3일 연속 딜러 지원:
 * - 기존: 3개의 개별 ScheduleCard
 * - 개선: 1개의 GroupedScheduleCard ("1월 15일 ~ 17일 (3일)")
 *
 * 비연속 날짜 지원:
 * - 기존: 2개의 개별 ScheduleCard (1/15, 1/17)
 * - 개선: 1개의 GroupedScheduleCard ("1/15, 1/17 (2일)")
 */
export interface GroupedScheduleEvent {
  /** 고유 ID: "grouped_{applicationId}" */
  id: string;

  /** 스케줄 타입 (applied, confirmed, completed, cancelled) */
  type: ScheduleType;

  /** 공고 ID (정규화된 필드명) */
  jobPostingId: string;

  /** 공고명 (정규화된 필드명) */
  jobPostingName: string;

  /**
   * @deprecated eventId 대신 jobPostingId 사용 - 하위 호환성용
   */
  eventId?: string;

  /** @deprecated eventName 대신 jobPostingName 사용 - 하위 호환성용 */
  eventName?: string;

  /** 장소 */
  location: string;

  /** 상세 주소 */
  detailedAddress?: string;

  /**
   * 날짜 범위 정보
   */
  dateRange: {
    /** 시작 날짜 (YYYY-MM-DD) */
    start: string;
    /** 종료 날짜 (YYYY-MM-DD) */
    end: string;
    /** 전체 날짜 배열 (정렬됨) */
    dates: string[];
    /** 총 일수 */
    totalDays: number;
    /** 연속 날짜 여부 */
    isConsecutive: boolean;
  };

  /**
   * 역할 목록 (다중 역할 통합 지원)
   * 예: ["딜러"], ["딜러", "플로어맨"]
   */
  roles: string[];

  /**
   * 커스텀 역할명 목록 (roles와 동일 인덱스로 매핑)
   * undefined는 해당 role에 customRole이 없음을 의미
   */
  customRoles?: (string | undefined)[];

  /** 시간대 문자열 (예: "19:00 ~ 02:00") */
  timeSlot: string;

  /**
   * 날짜별 상태 (펼침 시 표시)
   */
  dateStatuses: DateStatus[];

  /** 원본 ScheduleEvent 배열 */
  originalEvents: ScheduleEvent[];

  /** 지원서 ID (applicationId) */
  applicationId?: string;

  /** JobPostingCard 정보 (UI 렌더링용) */
  jobPostingCard?: JobPostingCard;

  /** 구인자 ID */
  ownerId?: string;

  /** 구인자 연락처 */
  ownerPhone?: string;
}

/**
 * GroupedScheduleEvent인지 확인하는 타입 가드
 */
export function isGroupedScheduleEvent(
  event: ScheduleEvent | GroupedScheduleEvent
): event is GroupedScheduleEvent {
  return 'dateRange' in event && 'originalEvents' in event;
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
  /** 공고 ID (정규화된 필드명) */
  jobPostingId: string;
  /**
   * @deprecated eventId 대신 jobPostingId 사용 - 하위 호환성용
   * @see IdNormalizer.normalizeJobId() 정규화 헬퍼 사용
   */
  eventId?: string;
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

  // 실제 시간 (QR 스캔 또는 관리자 수정)
  /** 실제 출근 시간 */
  checkInTime?: Timestamp | null;
  /** 실제 퇴근 시간 */
  checkOutTime?: Timestamp | null;

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

  /** 시간대 문자열 (예: "18:00~02:00") - Firestore 데이터 */
  timeSlot?: string;

  // 구인자 정보 (비정규화 - 신고 기능 등에서 사용)
  /** 구인자 ID */
  ownerId?: string;
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
  /** 공고 ID (정규화된 필드명) */
  jobPostingId: string;
  /**
   * @deprecated eventId 대신 jobPostingId 사용 - 하위 호환성용
   */
  eventId?: string;
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
  /** 공고 ID (정규화된 필드명) */
  jobPostingId: string;
  /** @deprecated eventId 대신 jobPostingId 사용 - 하위 호환성용 */
  eventId?: string;
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
  /** 공고 ID (정규화된 필드명) */
  jobPostingId: string;
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
  /** 공고 ID (정규화된 필드명) */
  jobPostingId?: string;
  date?: string;
  action?: QRCodeAction;
  errorMessage?: string;
}
