import { Timestamp } from 'firebase/firestore';
import { ScheduleEvent, ScheduleFilters, ScheduleStats } from '../../types/schedule';
import type { Assignment } from '../../types/application';

/** Firebase Timestamp 또는 문자열/Date 형태의 날짜 타입 */
export type DateLike = Timestamp | string | Date;

/**
 * 날짜별 지원 선택 정보 (레거시 구조)
 */
export interface DateAssignmentSelection {
  timeSlot: string;
  role: string;
}

/**
 * 날짜별 지원 정보 (레거시 구조)
 */
export interface DateAssignment {
  date: string;
  selections: DateAssignmentSelection[];
}

/**
 * 스냅샷 데이터 - 공고 삭제 시 보존용
 * ScheduleEvent.snapshotData와 호환되는 타입
 */
export interface SnapshotData {
  /** 공고 제목 */
  title?: string;
  /** 급여 정보 (Critical - 급여 계산 필수) */
  salary: {
    type: 'hourly' | 'daily' | 'monthly' | 'other';
    amount: number;
    useRoleSalary?: boolean;
    roleSalaries?: Record<string, { type: string; amount: number }>;
  };
  /** 수당 정보 */
  allowances?: {
    meal?: number;
    transportation?: number;
    accommodation?: number;
  };
  /** 세금 설정 */
  taxSettings?: {
    enabled: boolean;
    taxRate?: number;
    taxAmount?: number;
  };
  /** 장소 정보 (필수) */
  location: string;
  detailedAddress?: string;
  district?: string;
  contactPhone?: string;
  /** 생성자 (필수) */
  createdBy: string;
  /** 스냅샷 메타 정보 */
  snapshotAt: Timestamp;
  snapshotReason?: 'confirmed' | 'worklog_created' | 'posting_deleted';
}

/** 날짜별 요구사항 */
export interface DateSpecificRequirement {
  date: string;
  roles: Array<{ role: string; count: number }>;
  timeSlots?: string[];
}

/** 시간대 슬롯 */
export interface TimeSlot {
  startTime: string;
  endTime: string;
  label?: string;
}

/** 역할별 급여 설정 */
export interface RoleSalary {
  role: string;
  salaryType: string;
  salaryAmount: number;
}

/** 복리후생 설정 */
export interface BenefitSettings {
  meals?: boolean;
  mealAllowance?: string;
  transportation?: string | boolean;
  housing?: boolean;
  accommodation?: string;
  other?: string[];
}

/** 세금 설정 */
export interface TaxSettings {
  applyTax: boolean;
  taxRate?: number;
  taxType?: string;
}

export interface UseScheduleDataReturn {
  schedules: ScheduleEvent[];
  loading: boolean;
  error: Error | null;
  stats: ScheduleStats;
  filters: ScheduleFilters;
  setFilters: React.Dispatch<React.SetStateAction<ScheduleFilters>>;
  refreshData: () => void;
  getScheduleById: (id: string) => ScheduleEvent | undefined;
}

export interface ApplicationData {
  id: string;
  postId: string;
  postTitle: string;
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  status: string;
  role?: string;
  assignedRole?: string;
  assignedRoles?: string[];
  confirmedRole?: string;
  assignedDate?: DateLike;
  assignedDates?: DateLike[];
  /** @deprecated - workLog의 scheduledStartTime/scheduledEndTime 사용 권장. 하위 호환성을 위해 유지 */
  assignedTime?: string;
  assignedTimes?: string[];
  confirmedTime?: string;
  createdAt?: DateLike;
  updatedAt?: DateLike;
  appliedAt?: DateLike;
  confirmedAt?: DateLike;
}

/** 근무 로그 상태 */
export type WorkLogStatus =
  | 'not_started'
  | 'scheduled'
  | 'checked_in'
  | 'checked_out'
  | 'completed'
  | 'absent';

export interface WorkLogData {
  id: string;
  staffId: string;
  staffName: string;
  role?: string;
  date: string;
  scheduledStartTime?: DateLike;
  scheduledEndTime?: DateLike;
  actualStartTime?: DateLike;
  actualEndTime?: DateLike;
  hoursWorked?: number;
  overtimeHours?: number;
  earlyLeaveHours?: number;
  notes?: string;
  createdAt?: DateLike;
  updatedAt?: DateLike;
  status?: WorkLogStatus;
  eventId?: string;
}

export interface JobPostingData {
  id: string;
  title: string;
  location?: string;
  district?: string;
  detailedAddress?: string;
  startDate?: DateLike;
  endDate?: DateLike;
  dateSpecificRequirements?: DateSpecificRequirement[];
  timeSlots?: TimeSlot[];
  createdAt?: DateLike;
  updatedAt?: DateLike;
  /** 급여 정보 */
  salaryType?: string;
  salaryAmount?: string;
  useRoleSalary?: boolean;
  roleSalaries?: RoleSalary[];
  /** 복리후생 */
  benefits?: BenefitSettings;
  /** 세금 설정 */
  taxSettings?: TaxSettings;
  /** 생성자 */
  createdBy?: string;
}

/**
 * Application/ApplicationData 통합 처리를 위한 확장 타입
 * 레거시 필드와 신규 필드 모두 포함
 */
export interface ExtendedApplicationData extends ApplicationData {
  eventId?: string;
  assignments?: Assignment[];
  dateAssignments?: DateAssignment[];
  snapshotData?: SnapshotData;
}

/**
 * WorkLog 데이터 확장 타입
 */
export interface ExtendedWorkLogData extends WorkLogData {
  snapshotData?: SnapshotData;
  totalWorkMinutes?: number;
}

/** eventId 필드 존재 여부 확인 */
export function hasEventId(
  data: ApplicationData | ExtendedApplicationData
): data is ExtendedApplicationData & { eventId: string } {
  return 'eventId' in data && typeof data.eventId === 'string';
}

/** assignments 필드 존재 여부 확인 */
export function hasAssignments(
  data: ApplicationData | ExtendedApplicationData
): data is ExtendedApplicationData & { assignments: Assignment[] } {
  return 'assignments' in data && Array.isArray(data.assignments);
}

/** dateAssignments 필드 존재 여부 확인 */
export function hasDateAssignments(
  data: ApplicationData | ExtendedApplicationData
): data is ExtendedApplicationData & { dateAssignments: DateAssignment[] } {
  return 'dateAssignments' in data && Array.isArray(data.dateAssignments);
}

/** snapshotData 필드 존재 여부 확인 */
export function hasSnapshotData<T extends Record<string, unknown>>(
  data: T
): data is T & { snapshotData: SnapshotData } {
  return 'snapshotData' in data && data.snapshotData !== undefined;
}
