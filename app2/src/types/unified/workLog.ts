import { Timestamp } from 'firebase/firestore';

/**
 * 통합 WorkLog 인터페이스
 * 모든 WorkLog 관련 데이터의 표준 형식
 */
export interface UnifiedWorkLog {
  // 기본 식별자
  id: string;
  staffId: string;        // 표준 필드명 (dealerId, userId 대체)
  eventId: string;        // jobPostingId와 동일한 의미
  
  // 스태프 정보
  staffName: string;
  role?: string;
  
  // 일정 정보
  date: string;           // YYYY-MM-DD 형식
  type?: 'schedule' | 'qr' | 'manual';
  
  // 시간 정보 (string 또는 Timestamp)
  scheduledStartTime?: string | Timestamp | null;
  scheduledEndTime?: string | Timestamp | null;
  actualStartTime?: string | Timestamp | null;
  actualEndTime?: string | Timestamp | null;
  
  // 근무 정보
  totalWorkMinutes?: number;
  totalBreakMinutes?: number;
  hoursWorked?: number;
  overtime?: number;
  
  // 상태
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  
  // 테이블/위치 정보 (딜러용)
  tableAssignments?: string[];
  
  // 메타데이터
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

/**
 * 레거시 호환성을 위한 타입
 * 기존 코드와의 호환성 유지
 */
export type LegacyWorkLog = UnifiedWorkLog & {
  dealerId?: string;      // deprecated - staffId 사용
  userId?: string;        // deprecated - staffId 사용
  dealerName?: string;    // deprecated - staffName 사용
  jobPostingId?: string;  // deprecated - eventId 사용
};

/**
 * WorkLog 생성 시 필수 필드
 */
export interface WorkLogCreateInput {
  staffId: string;
  eventId: string;
  staffName: string;
  date: string;
  type?: 'schedule' | 'qr' | 'manual';
  scheduledStartTime?: string | Timestamp | null;
  scheduledEndTime?: string | Timestamp | null;
  role?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * WorkLog 업데이트 시 사용하는 부분 타입
 */
export type WorkLogUpdateInput = Partial<Omit<UnifiedWorkLog, 'id' | 'createdAt'>>;

/**
 * WorkLog 조회 필터
 */
export interface WorkLogFilter {
  staffId?: string | string[];
  eventId?: string | string[];
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string | string[];
  type?: string | string[];
}

/**
 * WorkLog 정렬 옵션
 */
export interface WorkLogSortOption {
  field: 'date' | 'staffName' | 'createdAt' | 'updatedAt' | '';  // 빈 문자열 허용 (정렬 비활성화)
  direction: 'asc' | 'desc';
}

/**
 * 타입 가드 함수들
 */
export const isUnifiedWorkLog = (data: any): data is UnifiedWorkLog => {
  return data && 
    typeof data.staffId === 'string' && 
    typeof data.eventId === 'string' &&
    typeof data.date === 'string';
};

export const isLegacyWorkLog = (data: any): data is LegacyWorkLog => {
  return data && (
    'dealerId' in data || 
    'userId' in data || 
    'dealerName' in data ||
    'jobPostingId' in data
  );
};

/**
 * WorkLog 상태 관련 유틸리티 타입
 */
export const WORKLOG_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export type WorkLogStatus = typeof WORKLOG_STATUS[keyof typeof WORKLOG_STATUS];

/**
 * WorkLog 타입 관련 유틸리티
 */
export const WORKLOG_TYPE = {
  SCHEDULE: 'schedule',
  QR: 'qr',
  MANUAL: 'manual'
} as const;

export type WorkLogType = typeof WORKLOG_TYPE[keyof typeof WORKLOG_TYPE];