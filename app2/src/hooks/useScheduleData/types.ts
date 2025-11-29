import { Timestamp } from 'firebase/firestore';
import { ScheduleEvent, ScheduleFilters, ScheduleStats } from '../../types/schedule';

/** Firebase Timestamp 또는 문자열/Date 형태의 날짜 타입 */
export type DateLike = Timestamp | string | Date;

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
export type WorkLogStatus = 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'absent';

export interface WorkLogData {
  id: string;
  staffId: string;
  staffName: string;
  role?: string;
  date: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
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
