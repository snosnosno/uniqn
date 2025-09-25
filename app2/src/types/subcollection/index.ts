/**
 * Firebase 서브컬렉션 구조 타입 정의
 * Phase 2: 구조 최적화
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 이벤트(공고) 기본 정보
 * jobPostings/{eventId}/info
 */
export interface EventInfo {
  id: string;
  title: string;
  description: string;
  location: string;
  district?: string;
  detailedAddress?: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed' | 'completed';
  type?: 'application' | 'fixed';
  
  // 급여 정보
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: number;
  useRoleSalary?: boolean;
  roleSalaries?: Record<string, {
    salaryType: string;
    salaryAmount: number;
  }>;
  
  // 복리후생
  benefits?: {
    mealAllowance?: number;
    transportation?: number;
    accommodation?: number;
  };
  
  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/**
 * 이벤트 스태프 정보
 * jobPostings/{eventId}/staff/{userId}
 */
export interface EventStaff {
  userId: string;           // 문서 ID이자 사용자 ID
  name: string;
  email: string;
  phone: string;
  role: string;            // 업무 역할 (dealer, floor, etc.)
  roles?: string[];        // 복수 역할 가능
  
  // 할당 정보
  assignedDate: string;    // YYYY-MM-DD
  assignedTime?: string;   // HH:mm
  assignedAt: Timestamp;   // 할당 시각
  
  // 상태
  status: 'confirmed' | 'applied' | 'cancelled';
  attendanceStatus?: 'present' | 'absent' | 'late';
  
  // 지원 정보 (선택)
  applicationId?: string;
  appliedAt?: Timestamp;
  
  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 이벤트 근무 기록
 * jobPostings/{eventId}/workLogs/{workLogId}
 */
export interface EventWorkLog {
  id: string;              // 문서 ID (자동 생성 또는 {userId}_{date})
  userId: string;          // 스태프 사용자 ID
  staffName: string;       // 스태프 이름 (캐시용)
  role: string;           // 해당 근무의 역할
  date: string;           // 근무 날짜 (YYYY-MM-DD)
  
  // 예정 시간
  scheduledStartTime: Timestamp | null;
  scheduledEndTime: Timestamp | null;
  
  // 실제 시간
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  
  // 계산된 값 (캐시)
  scheduledHours?: number;
  actualHours?: number;
  hoursWorked?: number;    // 정산용 최종 시간
  
  // 상태
  status: 'not_started' | 'checked_in' | 'checked_out' | 'completed';
  
  // 정산 정보 (선택, 캐시용)
  payroll?: {
    basePay: number;
    allowances: {
      meal: number;
      transportation: number;
      accommodation: number;
      bonus: number;
    };
    totalPay: number;
    isPaid: boolean;
    paidAt?: Timestamp;
  };
  
  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

/**
 * 컬렉션 경로 헬퍼
 */
export const COLLECTION_PATHS = {
  // 메인 컬렉션
  jobPostings: 'jobPostings',
  
  // 서브컬렉션 경로 생성 함수
  eventInfo: (eventId: string) => `jobPostings/${eventId}/info`,
  eventStaff: (eventId: string) => `jobPostings/${eventId}/staff`,
  eventWorkLogs: (eventId: string) => `jobPostings/${eventId}/workLogs`,
  
  // 개별 문서 경로
  staffDoc: (eventId: string, userId: string) => 
    `jobPostings/${eventId}/staff/${userId}`,
  workLogDoc: (eventId: string, workLogId: string) => 
    `jobPostings/${eventId}/workLogs/${workLogId}`,
} as const;

/**
 * 서브컬렉션 쿼리 옵션
 */
export interface SubcollectionQueryOptions {
  eventId: string;
  limit?: number;
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  where?: Array<{
    field: string;
    operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any';
    value: any;
  }>;
}

/**
 * 배치 작업 옵션
 */
export interface BatchOperationOptions {
  batchSize?: number;      // 기본 500
  onProgress?: (current: number, total: number) => void;
  dryRun?: boolean;        // 실제 실행 없이 시뮬레이션
}