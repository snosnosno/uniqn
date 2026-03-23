/**
 * UNIQN Mobile - ?ㅼ?以?愿??????뺤쓽
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument } from './common';
import type { JobRoleStats, PostingCompensation, SalaryInfo, SalaryType } from './jobPosting';
import type { AttendanceStatus, PayrollStatus, ScheduleType, WorkLogStatus } from '@/shared/status';
import type { TimeInput } from '@/shared/time/types';
import { StatusMapper } from '@/shared/status';
import type { StaffRole } from './role';

// Re-export SalaryType from jobPosting (single source of truth)
export type { SalaryType };
export type { AttendanceStatus, WorkLogStatus, ScheduleType, PayrollStatus };

/**
 * 異쒖꽍 ?곹깭 (UI ?쒖떆??
 */

/**
 * WorkLog ?곹깭 (?꾩껜 lifecycle)
 */

/**
 * WorkLogStatus ??AttendanceStatus 蹂???좏떥
 *
 * @description StatusMapper濡??꾩엫 (Phase 1 - ?곹깭 留ㅽ븨 ?듯빀)
 * @example
 * toAttendanceStatus('scheduled') // 'not_started'
 * toAttendanceStatus('checked_in') // 'checked_in'
 * toAttendanceStatus('completed') // 'checked_out'
 */
export function toAttendanceStatus(workLogStatus: WorkLogStatus): AttendanceStatus {
  return StatusMapper.toAttendance(workLogStatus);
}

/**
 * ?ㅼ?以???? */

/**
 * ?뺤궛 ?곹깭
 */

/**
 * ?멸툑 ??? */
export type TaxType = 'none' | 'rate' | 'fixed';

/**
 * ?뺤궛 ?몃? ?댁뿭 (誘몃━ 怨꾩궛?섏뿬 罹먯떛)
 *
 * scheduleService?먯꽌 WorkLog ??ScheduleEvent 蹂??????踰덈쭔 怨꾩궛
 * SettlementTab?먯꽌?????곗씠?곕? 洹몃?濡??ъ슜?섏뿬 以묐났 怨꾩궛 諛⑹?
 */
export interface SettlementBreakdown {
  /** 洹쇰Т ?쒓컙 (?쒓컙 ?⑥쐞) */
  hoursWorked: number;

  /** ?곸슜??湲됱뿬 ?뺣낫 */
  salaryInfo: {
    type: SalaryType;
    amount: number;
  };
  /** 湲곕낯湲?*/
  basePay: number;

  /** ?곸슜???섎떦 ?뺣낫 (?곸꽭 ?댁뿭) */
  allowances?: {
    guaranteedHours?: number;
    meal?: number;
    transportation?: number;
    accommodation?: number;
    additional?: number;
  };
  /** ?섎떦 ?⑷퀎 */
  allowancePay: number;

  /** ?곸슜???멸툑 ?ㅼ젙 */
  taxSettings?: {
    type: TaxType;
    value: number;
  };
  /** ?멸툑 湲덉븸 */
  taxAmount: number;

  /** ?몄쟾 珥앹븸 (basePay + allowancePay) */
  totalPay: number;
  /** ?명썑 珥앹븸 */
  afterTaxPay: number;

  /** ?덉긽 湲덉븸 ?щ? (actualTime???놁쓣 ??true) */
  isEstimate: boolean;
  /** 怨꾩궛 ?쒖젏 (ISO ?좎쭨 臾몄옄?? */
  calculatedAt: string;
}

export interface SchedulePostingProjection {
  ownerName?: string;
  description?: string;
  settlement: {
    roles: JobRoleStats[];
    defaultSalary?: SalaryInfo;
    allowances?: PostingCompensation['allowances'];
    taxSettings?: PostingCompensation['taxSettings'];
  };
}

/**
 * ?ㅼ?以??대깽?? */
export interface ScheduleEvent extends FirebaseDocument {
  // 湲곕낯 ?뺣낫
  type: ScheduleType;
  date: string; // YYYY-MM-DD

  // ?쒓컙 ?뺣낫
  startTime: Timestamp | null;
  endTime: Timestamp | null;
  /** ?ㅼ젣 異쒓렐 ?쒓컙 (QR ?ㅼ틪 ?먮뒗 愿由ъ옄 ?섏젙) */
  checkInTime?: TimeInput;
  /** ?ㅼ젣 ?닿렐 ?쒓컙 (QR ?ㅼ틪 ?먮뒗 愿由ъ옄 ?섏젙) */
  checkOutTime?: TimeInput;

  // 怨듦퀬 ?뺣낫
  /** 怨듦퀬 ID */
  jobPostingId: string;
  /** 怨듦퀬紐?*/
  jobPostingName: string;
  location: string;
  detailedAddress?: string;

  // ??븷 ?뺣낫
  role: string;
  /** 而ㅼ뒪? ??븷紐?(role??'other'???? */
  customRole?: string;
  status: AttendanceStatus;

  // ?뺤궛 ?뺣낫
  payrollStatus?: PayrollStatus;
  payrollAmount?: number;
  payrollDate?: Timestamp;
  /** 誘몃━ 怨꾩궛???뺤궛 ?몃? ?댁뿭 */
  settlementBreakdown?: SettlementBreakdown;

  // 援ъ씤???뺣낫
  /** 援ъ씤???곕씫泥?*/
  ownerPhone?: string;
  /** 援ъ씤??ID */
  ownerId?: string;

  // 메타데이터
  notes?: string;
  sourceCollection: 'workLogs' | 'applications';
  sourceId: string;
  workLogId?: string;
  applicationId?: string;

  // 媛쒕퀎 ?ㅻ쾭?쇱씠??(援ъ씤?먭? ?ㅽ깭?꾨퀎濡??섏젙???뺤궛 ?뺣낫)
  /** 媛쒕퀎 湲됱뿬 ?뺣낫 (?ㅻ쾭?쇱씠?? */
  customSalaryInfo?: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
  };
  /** 媛쒕퀎 ?섎떦 ?뺣낫 (?ㅻ쾭?쇱씠?? */
  customAllowances?: {
    guaranteedHours?: number;
    meal?: number;
    transportation?: number;
    accommodation?: number;
    additional?: number;
  };
  /** 媛쒕퀎 ?멸툑 ?ㅼ젙 (?ㅻ쾭?쇱씠?? */
  customTaxSettings?: {
    type: 'none' | 'rate' | 'fixed';
    value: number;
  };

  // JobCard ?뚮뜑留곸슜 ?곗씠??(?ㅼ?以???뿉???ъ슜)
  postingProjection?: SchedulePostingProjection;

  /** ?쒓컙? 臾몄옄??(?? "18:00~02:00") - ?쒓컙 ?쒖떆 ?대갚??*/
  timeSlot?: string;
  isFixedPosting?: boolean;
}

/**
 * ?ㅼ?以??꾪꽣
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
 * ?ㅼ?以??듦퀎
 */
export interface ScheduleStats {
  totalSchedules: number;
  completedSchedules: number;
  /** ?뺤젙???ㅼ?以?(誘몃옒, type === 'confirmed') */
  confirmedSchedules: number;
  /** 吏??以묒씤 ?ㅼ?以?(誘몃옒, type === 'applied') */
  upcomingSchedules: number;
  totalEarnings: number;
  thisMonthEarnings: number;
  hoursWorked: number;
}

/**
 * 罹섎┛??酉???? */
export type CalendarView = 'month' | 'week' | 'day';

/**
 * ?ㅼ?以?洹몃９ (?좎쭨蹂?
 */
export interface ScheduleGroup {
  date: string;
  formattedDate: string;
  events: ScheduleEvent[];
  isToday: boolean;
  isPast: boolean;
}

// ============================================================================
// Grouped Schedule Types (?곗냽/?ㅼ쨷 ?좎쭨 ?듯빀 ?쒖떆??
// ============================================================================

/**
 * ?좎쭨蹂??곹깭 ?뺣낫 (?듯빀 移대뱶 ?쇱묠 ???쒖떆)
 */
export interface DateStatus {
  /** ?좎쭨 (YYYY-MM-DD) */
  date: string;
  /** ?щ㎎???좎쭨 (?? "1/15(??") */
  formattedDate: string;
  /** 異쒖꽍 ?곹깭 */
  status: AttendanceStatus;
  /** ?대떦 ?좎쭨???먮낯 ScheduleEvent ID */
  scheduleEventId: string;
}

/**
 * ?듯빀 ?ㅼ?以??대깽?? *
 * 媛숈? 吏??applicationId)???곗냽/鍮꾩뿰???ㅼ쨷 ?좎쭨瑜??섎굹??移대뱶濡??듯빀 ?쒖떆
 *
 * @example
 * 3???곗냽 ?쒕윭 吏??
 * - 湲곗〈: 3媛쒖쓽 媛쒕퀎 ScheduleCard
 * - 媛쒖꽑: 1媛쒖쓽 GroupedScheduleCard ("1??15??~ 17??(3??")
 *
 * 鍮꾩뿰???좎쭨 吏??
 * - 湲곗〈: 2媛쒖쓽 媛쒕퀎 ScheduleCard (1/15, 1/17)
 * - 媛쒖꽑: 1媛쒖쓽 GroupedScheduleCard ("1/15, 1/17 (2??")
 */
export interface GroupedScheduleEvent {
  /** 怨좎쑀 ID: "grouped_{applicationId}" */
  id: string;

  /** ?ㅼ?以????(applied, confirmed, completed, cancelled) */
  type: ScheduleType;

  /** 怨듦퀬 ID */
  jobPostingId: string;

  /** 怨듦퀬紐?*/
  jobPostingName: string;

  /** ?μ냼 */
  location: string;

  /** ?곸꽭 二쇱냼 */
  detailedAddress?: string;

  /**
   * ?좎쭨 踰붿쐞 ?뺣낫
   */
  dateRange: {
    /** ?쒖옉 ?좎쭨 (YYYY-MM-DD) */
    start: string;
    /** 醫낅즺 ?좎쭨 (YYYY-MM-DD) */
    end: string;
    /** ?꾩껜 ?좎쭨 諛곗뿴 (?뺣젹?? */
    dates: string[];
    /** 珥??쇱닔 */
    totalDays: number;
    /** ?곗냽 ?좎쭨 ?щ? */
    isConsecutive: boolean;
  };

  /**
   * ??븷 紐⑸줉 (?ㅼ쨷 ??븷 ?듯빀 吏??
   * ?? ["?쒕윭"], ["?쒕윭", "?뚮줈?대㎤"]
   */
  roles: string[];

  /**
   * 而ㅼ뒪? ??븷紐?紐⑸줉 (roles? ?숈씪 ?몃뜳?ㅻ줈 留ㅽ븨)
   * undefined???대떦 role??customRole???놁쓬???섎?
   */
  customRoles?: (string | undefined)[];

  /** ?쒓컙? 臾몄옄??(?? "19:00 ~ 02:00") */
  timeSlot: string;

  /**
   * ?좎쭨蹂??곹깭 (?쇱묠 ???쒖떆)
   */
  dateStatuses: DateStatus[];

  /** ?먮낯 ScheduleEvent 諛곗뿴 */
  originalEvents: ScheduleEvent[];

  /** 吏?먯꽌 ID (applicationId) */
  applicationId?: string;

  /** JobPostingCard ?뺣낫 (UI ?뚮뜑留곸슜) */
  postingProjection?: SchedulePostingProjection;

  /** 援ъ씤??ID */
  ownerId?: string;

  /** 援ъ씤???곕씫泥?*/
  ownerPhone?: string;
}

/**
 * GroupedScheduleEvent?몄? ?뺤씤?섎뒗 ???媛?? */
export function isGroupedScheduleEvent(
  event: ScheduleEvent | GroupedScheduleEvent
): event is GroupedScheduleEvent {
  return 'dateRange' in event && 'originalEvents' in event;
}

/**
 * 異쒗눜洹??붿껌
 */
export interface AttendanceRequest {
  scheduleId: string;
  action: 'checkIn' | 'checkOut';
  timestamp: Timestamp;
  qrCodeId?: string;
}

/**
 * 洹쇰Т ?쒓컙 ?섏젙 ?대젰
 */
export interface WorkTimeModification {
  modifiedAt: TimeInput;
  modifiedBy: string;
  reason: string;
  previousStartTime?: TimeInput;
  previousEndTime?: TimeInput;
  /** ??異쒓렐 ?쒓컙 (null = 誘몄젙) */
  newStartTime?: TimeInput;
  /** ???닿렐 ?쒓컙 (null = 誘몄젙) */
  newEndTime?: TimeInput;
}

/**
 * ??븷 蹂寃??대젰
 */
export interface RoleChangeHistory {
  changedAt: string | Timestamp;
  changedBy: string;
  reason: string;
  previousRole: string;
  newRole: string;
}

/**
 * ?뺤궛 湲덉븸 ?섏젙 ?대젰
 */
export interface SettlementModification {
  modifiedAt: string | Timestamp;
  modifiedBy: string;
  reason?: string;
  /** ?댁쟾 湲됱뿬 ?뺣낫 */
  previousSalaryInfo?: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
  };
  /** ??湲됱뿬 ?뺣낫 */
  newSalaryInfo?: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
  };
  /** ?댁쟾 ?섎떦 ?뺣낫 */
  previousAllowances?: Record<string, number>;
  /** ???섎떦 ?뺣낫 */
  newAllowances?: Record<string, number>;
  /** ?댁쟾 ?멸툑 ?ㅼ젙 */
  previousTaxSettings?: {
    type: 'none' | 'rate' | 'fixed';
    value: number;
  };
  /** ???멸툑 ?ㅼ젙 */
  newTaxSettings?: {
    type: 'none' | 'rate' | 'fixed';
    value: number;
  };
}

/**
 * 洹쇰Т 湲곕줉 (WorkLog)
 */
export interface WorkLog extends FirebaseDocument {
  staffId: string;
  /** 怨듦퀬 ID */
  jobPostingId: string;
  assignmentGroupId?: string | null;
  hasTimeModificationLogs?: boolean;
  date: string;
  isFixedPosting?: boolean;

  // ?ㅽ깭???꾨줈???뺣낫 (鍮꾩젙洹쒗솕 - 議고쉶 ?몄쓽)
  /** ?ㅽ깭???대쫫 */
  staffName?: string;
  /** ?ㅽ깭???됰꽕??*/
  staffNickname?: string;
  /** ?ㅽ깭???꾨줈???ъ쭊 URL */
  staffPhotoURL?: string;

  // ?덉젙 ?쒓컙
  /** @deprecated checkInTime??以묐났媛? timeSlot?먯꽌 ?덉젙 ?쒓컙???뚯떛?섏꽭??*/
  /** @deprecated checkOutTime??以묐났媛? timeSlot?먯꽌 ?덉젙 ?쒓컙???뚯떛?섏꽭??*/

  // ?ㅼ젣 ?쒓컙 (QR ?ㅼ틪 ?먮뒗 愿由ъ옄 ?섏젙)
  /** ?ㅼ젣 異쒓렐 ?쒓컙 */
  checkInTime?: TimeInput;
  /** ?ㅼ젣 ?닿렐 ?쒓컙 */
  checkOutTime?: TimeInput;

  // ?곹깭
  status: WorkLogStatus;
  /** ?ㅽ깭??吏곷Т ??븷 */
  role: StaffRole;
  /** 而ㅼ뒪? ??븷紐?(role??'other'???? */
  customRole?: string;

  // ?뺤궛
  payrollStatus?: PayrollStatus;
  payrollAmount?: number;
  payrollDate?: Timestamp;
  payrollNotes?: string;
  noShowAt?: TimeInput;
  noShowReason?: string;

  // ?섏젙 ?대젰 (援ъ씤?먯뿉 ?섑븳 ?쒓컙 ?섏젙)
  modificationHistory?: WorkTimeModification[];

  // ??븷 蹂寃??대젰
  roleChangeHistory?: RoleChangeHistory[];

  // ?뺤궛 湲덉븸 ?섏젙 ?대젰
  settlementModificationHistory?: SettlementModification[];

  // 媛쒕퀎 ?ㅻ쾭?쇱씠???ㅼ젙 (援ъ씤?먭? ?섏젙??寃쎌슦)
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

  /** ?쒓컙? 臾몄옄??(?? "18:00~02:00") - Firestore ?곗씠??*/
  timeSlot?: string;

  // 援ъ씤???뺣낫 (鍮꾩젙洹쒗솕 - ?좉퀬 湲곕뒫 ?깆뿉???ъ슜)
  /** 援ъ씤??ID */
  ownerId?: string;
}

/**
 * ?ㅼ?以???낅퀎 ?됱긽
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
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    border: 'border-primary-500',
    text: 'text-primary-800 dark:text-primary-200',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-500',
    text: 'text-red-800 dark:text-red-200',
  },
};

/**
 * 異쒖꽍 ?곹깭蹂??됱긽
 */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  not_started: 'bg-gray-100 dark:bg-surface text-gray-600 dark:text-gray-300',
  checked_in: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300',
  checked_out: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300',
};

// ============================================================================
// QR Code Types
// ============================================================================

/**
 * QR 肄붾뱶 ?≪뀡 ??? */
export type QRCodeAction = 'checkIn' | 'checkOut';

/**
 * QR 肄붾뱶 ?ㅼ틪 寃곌낵 (QRCodeScanner 而댄룷?뚰듃?먯꽌 ?ъ슜)
 */
export interface QRCodeScanResult {
  success: boolean;
  /** ?먮낯 QR 臾몄옄??(processEventQRCheckIn??- ?꾩닔) */
  qrString?: string;
  error?: string;
}

/**
 * QR ?ㅼ틪 ?먮윭 ?뺣낫 (useQRCodeScanner ??QRCodeScanner ?꾨떖??
 */
export interface QRScanError {
  code: string;
  message: string;
  isRetryable: boolean;
}

// ============================================================================
// Event QR Types (eventQRCodes 而щ젆??
// ============================================================================

/**
 * ?대깽??QR 肄붾뱶 ?곗씠??(Firestore eventQRCodes 臾몄꽌)
 *
 * 援ъ씤?먭? ?꾩옣?먯꽌 ?앹꽦?섎뒗 異쒗눜洹쇱슜 QR 肄붾뱶
 */
export interface EventQRCode {
  id: string;
  /** 怨듦퀬 ID */
  jobPostingId: string;
  /** 洹쇰Т ?좎쭨 (YYYY-MM-DD) */
  date: string;
  /** 異쒓렐/?닿렐 */
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
  action: QRCodeAction;
  /** 蹂댁븞 肄붾뱶 (UUID) */
  securityCode: string;
  /** ?앹꽦??ID (援ъ씤?? */
  createdBy: string;
  /** ?앹꽦 ?쒓컙 */
  createdAt: Timestamp;
  /** 留뚮즺 ?쒓컙 */
  expiresAt: Timestamp;
  /** ?쒖꽦???щ? (留뚮즺 ?쒓컙?쇰줈 愿由? isUsed ????ъ슜) */
  isActive: boolean;
}

/**
 * QR 肄붾뱶 ?쒖떆???곗씠??(JSON stringify?섏뿬 QR 肄붾뱶濡??몄퐫??
 */
export interface EventQRDisplayData {
  type: 'event';
  /** 怨듦퀬 ID */
  jobPostingId: string;
  date: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
  action: QRCodeAction;
  securityCode: string;
  /** ?앹꽦 ?쒓컙 (ms) */
  createdAt: number;
  /** 留뚮즺 ?쒓컙 (ms) */
  expiresAt: number;
}

/**
 * QR ?앹꽦 ?낅젰
 */
export interface GenerateEventQRInput {
  /** 怨듦퀬 ID (?뺢퇋?붾맂 ?꾨뱶紐? */
  jobPostingId: string;
  date: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
  action: QRCodeAction;
  createdBy: string;
}

/**
 * QR ?ㅼ틪 寃곌낵 (異쒗눜洹?泥섎━ ??
 */
export interface EventQRScanResult {
  success: boolean;
  workLogId: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
  action: QRCodeAction;
  checkTime: Date;
  message: string;
}

/**
 * QR 寃利?寃곌낵
 */
export interface EventQRValidationResult {
  isValid: boolean;
  /** 怨듦퀬 ID (?뺢퇋?붾맂 ?꾨뱶紐? */
  jobPostingId?: string;
  date?: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
  action?: QRCodeAction;
  errorMessage?: string;
}
