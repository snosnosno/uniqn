/**
 * 통합 데이터 관리 타입 정의
 * UnifiedDataContext에서 사용하는 모든 데이터 타입들을 정의합니다.
 * 
 * @version 1.0
 * @since 2025-02-01
 * @author T-HOLDEM Development Team
 */

import { Timestamp } from 'firebase/firestore';
import { ScheduleEvent } from './schedule';

// 기존 개별 타입들
export interface Staff {
  id: string;
  staffId: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkLog {
  id: string;
  staffId: string;
  staffName: string;
  eventId: string;
  date: string;
  scheduledStartTime?: Timestamp;
  scheduledEndTime?: Timestamp;
  actualStartTime?: Timestamp;
  actualEndTime?: Timestamp;
  role?: string;
  hoursWorked?: number;
  overtimeHours?: number;
  earlyLeaveHours?: number;
  notes?: string;
  status?: 'scheduled' | 'checked_in' | 'checked_out' | 'completed' | 'absent';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  workLogId?: string;
  eventId: string;
  status: 'not_started' | 'checked_in' | 'checked_out';
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface JobPosting {
  id: string;
  title: string;
  location: string;
  district?: string;
  detailedAddress?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  dateSpecificRequirements?: Array<{
    date: string;
    roles: string[];
    timeSlots: string[];
  }>;
  timeSlots?: string[];
  roles: string[];
  requirements?: string;
  salary?: {
    amount: number;
    type: 'hourly' | 'daily' | 'fixed';
  };
  status: 'draft' | 'published' | 'closed' | 'cancelled';
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Application {
  id: string;
  postId: string;
  postTitle: string;
  applicantId: string;
  applicantName: string;
  applicantPhone?: string;
  applicantEmail?: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  role?: string;
  assignedRole?: string;
  assignedRoles?: string[];
  confirmedRole?: string;
  assignedDate?: Timestamp;
  assignedDates?: Timestamp[];
  assignedTime?: string;
  assignedTimes?: string[];
  confirmedTime?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  appliedAt?: Timestamp;
  confirmedAt?: Timestamp;
}

export interface Tournament {
  id: string;
  title: string;
  date: string;
  startTime?: Timestamp;
  endTime?: Timestamp;
  location: string;
  detailedAddress?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  maxPlayers?: number;
  currentPlayers?: number;
  entryFee?: number;
  prizePool?: number;
  notes?: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 메모이제이션을 위한 캐시 키 타입
export interface CacheKeys {
  staff: string;
  workLogs: string;
  attendanceRecords: string;
  jobPostings: string;
  applications: string;
  tournaments: string;
  scheduleEvents: string;
}

// 필터 옵션들
export interface UnifiedFilters {
  dateRange: {
    start: string;
    end: string;
  };
  searchTerm?: string;
  eventId?: string;
  staffId?: string;
  status?: string;
  role?: string;
}

// 통합 데이터 상태
export interface UnifiedDataState {
  // 원시 데이터
  staff: Map<string, Staff>;
  workLogs: Map<string, WorkLog>;
  attendanceRecords: Map<string, AttendanceRecord>;
  jobPostings: Map<string, JobPosting>;
  applications: Map<string, Application>;
  tournaments: Map<string, Tournament>;
  
  // 계산된 데이터 (메모이제이션)
  scheduleEvents: ScheduleEvent[];
  
  // 로딩 상태
  loading: {
    staff: boolean;
    workLogs: boolean;
    attendanceRecords: boolean;
    jobPostings: boolean;
    applications: boolean;
    tournaments: boolean;
    initial: boolean;
  };
  
  // 에러 상태
  error: {
    staff: string | null;
    workLogs: string | null;
    attendanceRecords: string | null;
    jobPostings: string | null;
    applications: string | null;
    tournaments: string | null;
    global: string | null;
  };
  
  // 필터 상태
  filters: UnifiedFilters;
  
  // 캐시 키들 (메모이제이션용)
  cacheKeys: CacheKeys;
  
  // 마지막 업데이트 시간
  lastUpdated: {
    staff: number;
    workLogs: number;
    attendanceRecords: number;
    jobPostings: number;
    applications: number;
    tournaments: number;
  };
}

// Context 액션 타입들
export type UnifiedDataAction =
  | { type: 'SET_LOADING'; collection: keyof UnifiedDataState['loading']; loading: boolean }
  | { type: 'SET_ERROR'; collection: keyof UnifiedDataState['error']; error: string | null }
  | { type: 'SET_STAFF'; data: Staff[] }
  | { type: 'SET_WORK_LOGS'; data: WorkLog[] }
  | { type: 'SET_ATTENDANCE_RECORDS'; data: AttendanceRecord[] }
  | { type: 'SET_JOB_POSTINGS'; data: JobPosting[] }
  | { type: 'SET_APPLICATIONS'; data: Application[] }
  | { type: 'SET_TOURNAMENTS'; data: Tournament[] }
  | { type: 'SET_FILTERS'; filters: Partial<UnifiedFilters> }
  | { type: 'INVALIDATE_CACHE'; collection?: keyof CacheKeys }
  | { type: 'UPDATE_LAST_UPDATED'; collection: keyof UnifiedDataState['lastUpdated'] };

// 통합 데이터 컨텍스트 인터페이스
export interface UnifiedDataContextType {
  // 상태
  state: UnifiedDataState;
  
  // 기본 액션들
  dispatch: React.Dispatch<UnifiedDataAction>;
  
  // 편의 메서드들
  getStaffById: (staffId: string) => Staff | undefined;
  getWorkLogsByStaffId: (staffId: string) => WorkLog[];
  getWorkLogsByEventId: (eventId: string) => WorkLog[];
  getAttendanceByStaffId: (staffId: string) => AttendanceRecord[];
  getApplicationsByPostId: (postId: string) => Application[];
  
  // 필터링된 데이터
  getFilteredScheduleEvents: () => ScheduleEvent[];
  getFilteredStaff: () => Staff[];
  getFilteredWorkLogs: () => WorkLog[];
  
  // 통계 데이터
  getStats: () => {
    totalStaff: number;
    activeWorkLogs: number;
    pendingApplications: number;
    upcomingTournaments: number;
  };
  
  // 새로고침 메서드
  refresh: (collection?: keyof CacheKeys) => Promise<void>;
  
  // 성능 메트릭
  getPerformanceMetrics: () => {
    subscriptionCount: number;
    cacheHitRate: number;
    averageQueryTime: number;
  };
}

// 초기 상태
export const initialUnifiedDataState: UnifiedDataState = {
  staff: new Map(),
  workLogs: new Map(),
  attendanceRecords: new Map(),
  jobPostings: new Map(),
  applications: new Map(),
  tournaments: new Map(),
  scheduleEvents: [],
  
  loading: {
    staff: true,
    workLogs: true,
    attendanceRecords: true,
    jobPostings: true,
    applications: true,
    tournaments: true,
    initial: true,
  },
  
  error: {
    staff: null,
    workLogs: null,
    attendanceRecords: null,
    jobPostings: null,
    applications: null,
    tournaments: null,
    global: null,
  },
  
  filters: {
    dateRange: {
      start: new Date().toISOString().substring(0, 10),
      end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    },
  },
  
  cacheKeys: {
    staff: '',
    workLogs: '',
    attendanceRecords: '',
    jobPostings: '',
    applications: '',
    tournaments: '',
    scheduleEvents: '',
  },
  
  lastUpdated: {
    staff: 0,
    workLogs: 0,
    attendanceRecords: 0,
    jobPostings: 0,
    applications: 0,
    tournaments: 0,
  },
};

// 메모이제이션 헬퍼 타입
export interface MemoizedData<T> {
  data: T;
  cacheKey: string;
  timestamp: number;
}

// 성능 추적용 인터페이스
export interface PerformanceMetrics {
  subscriptionCount: number;
  queryTimes: number[];
  cacheHits: number;
  cacheMisses: number;
  errorCount: number;
  lastOptimizationRun: number;
}