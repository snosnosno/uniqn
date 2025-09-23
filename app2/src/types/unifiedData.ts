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
import { Application } from './application';

// 기존 개별 타입들
export interface Staff {
  id: string;
  staffId: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  // 지원자 확정 시 배정 정보
  assignedRole?: string;    // 지원자에서 확정된 역할
  assignedTime?: string;    // 지원자에서 확정된 시간 (예: "09:00~18:00")
  assignedDate?: string;    // 지원자에서 확정된 날짜 (예: "2025-01-06")
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  
  // users 컬렉션 연결용 (필수)
  userId?: string;          // users 컬렉션과 연결하는 사용자 ID
  
  // 원래 지원 정보
  postingId?: string;       // 원래 지원한 공고 ID (사전질문 조회용)
  
  // 추가 개인정보 (users에서 조회한 캐시용)
  gender?: string;          // 성별 (male/female/other)
  age?: number;             // 나이
  experience?: string;      // 경력 (예: "2년")
  nationality?: string;     // 국적 (KR/US/JP 등)
  region?: string;          // 지역 (seoul/gyeonggi 등)
  history?: string;         // 이력
  notes?: string;           // 기타 메모
  
  // 은행 정보 (users에서 조회한 캐시용)
  bankName?: string;        // 은행명
  bankAccount?: string;     // 계좌번호
  residentId?: string;      // 주민등록번호 뒷자리
}

export interface WorkLog {
  id: string;
  staffId: string;
  staffName: string; // 호환성을 위해 유지
  eventId: string;
  date: string;
  
  // 🚀 persons 컬렉션 통합 - 스태프 정보
  staffInfo: {
    userId: string;      // 실제 사용자 ID (Firebase Auth UID)
    name: string;        // 사용자 이름
    email?: string;      // 이메일
    phone?: string;      // 전화번호
    userRole?: string;   // 사용자 권한 (staff, manager, admin)
    jobRole?: string[];  // 직무 역할들 (['dealer', 'manager'])
    isActive?: boolean;  // 활성 상태
    // 은행 정보
    bankName?: string;   
    accountNumber?: string;
    // 추가 개인정보
    gender?: string;     
    age?: number;        
    experience?: string; 
    nationality?: string;
    region?: string;     
  };
  
  // 🚀 할당 정보 (persons 컬렉션의 할당 관련 정보)
  assignmentInfo: {
    role: string;           // 할당된 역할
    assignedRole?: string;  // 지원자에서 확정된 역할
    assignedTime?: string;  // 지원자에서 확정된 시간
    assignedDate?: string;  // 지원자에서 확정된 날짜
    postingId: string;      // 구인공고 ID
    managerId?: string;     // 관리자 ID
    type?: 'staff' | 'applicant' | 'both'; // 타입 정보
  };
  
  // 기존 근무 관련 필드
  scheduledStartTime?: Timestamp;
  scheduledEndTime?: Timestamp;
  actualStartTime?: Timestamp;
  actualEndTime?: Timestamp;
  role?: string; // 호환성을 위해 유지 (assignmentInfo.role과 동일)
  assignedTime?: string; // 호환성을 위해 유지 (UI에서 사용하는 시간 표시 필드)
  hoursWorked?: number;
  overtimeHours?: number;
  earlyLeaveHours?: number;
  notes?: string;
  status?: 'not_started' | 'checked_in' | 'checked_out' | 'completed' | 'absent';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;  // 생성자 ID
}

export interface AttendanceRecord {
  id: string;
  staffId: string;
  workLogId?: string;
  eventId: string;
  status: 'not_started' | 'checked_in' | 'checked_out';
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
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

/**
 * 지원자 선택 그룹 - 연속된 날짜 정보를 보존
 */
// 🔧 Legacy 그룹 구조 (하위 호환성용)
export interface ApplicationGroup {
  role: string;
  timeSlot: string;
  dates: string[];
  checkMethod?: 'group' | 'individual'; // 추가
  groupId?: string;                      // 추가
  duration?: {
    type: 'single' | 'multi';
    endDate?: string;
  };
}

// 🆕 개선된 Assignment 구조 - 그룹 중심 설계
export interface ApplicationAssignment {
  // 🆕 그룹 선택 지원: 단일 역할 또는 다중 역할
  role?: string;            // 개별 선택 시 사용
  roles?: string[];         // 그룹 선택 시 다중 역할 (예: ['dealer', 'floor'])
  
  timeSlot: string;
  dates: string[];  // 항상 배열로 관리 (단일 날짜도 [date] 형태)
  duration?: {
    type: 'single' | 'multi' | 'consecutive';
    startDate: string;
    endDate?: string;
  };
  // 그룹 메타데이터
  isGrouped: boolean;      // 그룹으로 선택되었는지 (연속된 날짜 등)
  groupId?: string;        // 그룹 식별자 (같은 그룹의 assignments 식별)
  checkMethod?: 'group' | 'individual'; // 추가
}

// 🚀 날짜 기반 구조 - 최신 설계
export interface DateBasedSelection {
  role: string;
  timeSlot: string;
}

export interface DateBasedAssignment {
  date: string;                        // "2025-02-09" 형식
  selections: DateBasedSelection[];    // 해당 날짜의 모든 역할/시간 조합
  isConsecutive?: boolean;             // 연속된 날짜 그룹의 일부인지
  groupId?: string;                    // 연속된 날짜 그룹 식별자
  checkMethod?: 'group' | 'individual'; // 추가
}

// Application 타입은 types/application.ts에서 import함 (중복 제거)
export type { Application } from './application';

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

// Smart Hybrid Context를 위한 구독 옵션
export interface UnifiedDataOptions {
  // 사용자 역할
  role?: 'admin' | 'manager' | 'staff' | 'user';

  // 컬렉션별 구독 설정
  subscriptions?: {
    staff?: boolean | 'myData';      // true: 전체, 'myData': 자신만, false: 구독 안함
    workLogs?: boolean | 'myData';
    applications?: boolean | 'myData';
    jobPostings?: boolean;
    attendance?: boolean | 'myData';
    tournaments?: boolean;
  };

  // 캐싱 전략
  cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';

  // 성능 옵션
  performance?: {
    maxDocuments?: number;      // 최대 문서 수 제한
    realtimeUpdates?: boolean;  // 실시간 업데이트 활성화
    batchSize?: number;         // 배치 크기
  };

  // 사용자 ID (myData 구독용)
  userId?: string;
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
  | { type: 'UPDATE_LAST_UPDATED'; collection: keyof UnifiedDataState['lastUpdated'] }
  // 🚀 즉시 업데이트를 위한 새로운 액션들
  | { type: 'UPDATE_WORK_LOG'; workLog: WorkLog }
  | { type: 'UPDATE_ATTENDANCE_RECORD'; record: AttendanceRecord }
  | { type: 'UPDATE_STAFF'; staff: Staff }
  | { type: 'UPDATE_APPLICATION'; application: Application };

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
  
  // 필터링 설정 메서드
  setCurrentEventId: (eventId: string | null) => void;
  
  // 성능 메트릭
  getPerformanceMetrics: () => {
    subscriptionCount: number;
    cacheHitRate: number;
    averageQueryTime: number;
  };
  
  // Optimistic Updates
  updateWorkLogOptimistic: (workLog: WorkLog) => void;
  updateAttendanceOptimistic: (record: AttendanceRecord) => void;
  updateStaffOptimistic: (staff: Staff) => void;
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