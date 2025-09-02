import { ScheduleEvent, ScheduleFilters, ScheduleStats } from '../../types/schedule';

export interface UseScheduleDataReturn {
  schedules: ScheduleEvent[];
  loading: boolean;
  error: string | null;
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
  assignedDate?: any;
  assignedDates?: any[];
  /** @deprecated - workLog의 scheduledStartTime/scheduledEndTime 사용 권장. 하위 호환성을 위해 유지 */
  assignedTime?: string;
  assignedTimes?: string[];
  confirmedTime?: string;
  createdAt?: any;
  updatedAt?: any;
  appliedAt?: any;
  confirmedAt?: any;
}

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
  createdAt?: any;
  updatedAt?: any;
  // 추가된 필드들
  status?: string; // 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'absent'
  eventId?: string; // 연관된 이벤트 ID
}

export interface JobPostingData {
  id: string;
  title: string;
  location?: string;
  district?: string;
  detailedAddress?: string;
  startDate?: any;
  endDate?: any;
  dateSpecificRequirements?: any[];
  timeSlots?: any[];
  createdAt?: any;
  updatedAt?: any;
}