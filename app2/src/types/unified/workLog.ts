/**
 * 통합 WorkLog 인터페이스
 * 
 * 이 파일은 T-HOLDEM 프로젝트의 모든 WorkLog 관련 데이터를 통합하는 표준 형식을 정의합니다.
 * 
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 * 
 * 주요 특징:
 * - 모든 WorkLog 관련 데이터의 표준 형식
 * - 레거시 필드와의 호환성 보장
 * - 타입 안전성 및 유효성 검사 포함
 * 
 * 표준화된 필드 매핑:
 * - staffId (표준) ← dealerId, userId (deprecated)
 * - eventId (표준) ← jobPostingId (deprecated)
 * - staffName (표준) ← dealerName (deprecated)
 * - scheduledStartTime/EndTime (표준) ← assignedTime (deprecated)
 * - actualStartTime/EndTime (표준) ← checkInTime/checkOutTime (deprecated)
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 통합 WorkLog 인터페이스
 * @description 모든 WorkLog 관련 데이터의 표준 형식입니다. 새로운 개발에서는 이 타입을 우선 사용하세요.
 * 
 * 필드 우선순위:
 * - staffId (표준) → dealerId/userId (fallback)
 * - eventId (표준) → jobPostingId (fallback)
 * - staffName (표준) → dealerName (fallback)
 * - scheduledStartTime/EndTime (표준) → assignedTime (fallback)
 * - actualStartTime/EndTime (표준) → checkInTime/checkOutTime (fallback)
 * 
 * @example
 * ```typescript
 * const workLog: UnifiedWorkLog = {
 *   id: 'worklog-123',
 *   staffId: 'staff-456',
 *   eventId: 'event-789',
 *   staffName: '김딜러',
 *   date: '2025-01-28',
 *   scheduledStartTime: '18:00',
 *   scheduledEndTime: '02:00',
 *   status: 'scheduled'
 * };
 * ```
 */
export interface UnifiedWorkLog {
  // 기본 식별자
  /** 근무 로그 고유 ID */
  id: string;
  
  /** 스태프 ID (표준 필드명, dealerId/userId 대체) */
  staffId: string;
  
  /** 이벤트 ID (jobPostingId와 동일한 의미) */
  eventId: string;
  
  // 스태프 정보
  /** 스태프 이름 */
  staffName: string;
  
  /** 역할 */
  role?: string;
  
  // 일정 정보
  /** 근무 날짜 (YYYY-MM-DD 형식) */
  date: string;
  
  /** 근무 타입 */
  type?: 'schedule' | 'qr' | 'manual';
  
  // 시간 정보 (string 또는 Timestamp 지원)
  /** 예정 시작 시간 (표준 필드) */
  scheduledStartTime?: string | Timestamp | null;
  
  /** 예정 종료 시간 (표준 필드) */
  scheduledEndTime?: string | Timestamp | null;
  
  /** 실제 시작 시간 */
  actualStartTime?: string | Timestamp | null;
  
  /** 실제 종료 시간 */
  actualEndTime?: string | Timestamp | null;
  
  // 근무 정보
  /** 총 근무시간 (분 단위) */
  totalWorkMinutes?: number;
  
  /** 총 휴게시간 (분 단위) */
  totalBreakMinutes?: number;
  
  /** 근무시간 (시간 단위) */
  hoursWorked?: number;
  
  /** 초과근무시간 (시간 단위) */
  overtime?: number;
  
  // 상태
  /** 근무 상태 */
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  
  // 테이블/위치 정보 (딜러용)
  /** 테이블 배정 정보 */
  tableAssignments?: string[];
  
  // 메타데이터
  /** 비고 */
  notes?: string;
  
  /** 생성 시간 */
  createdAt?: Timestamp;
  
  /** 수정 시간 */
  updatedAt?: Timestamp;
  
  /** 생성자 */
  createdBy?: string;
}

/**
 * 레거시 호환성을 위한 타입
 * @description 기존 코드와의 호환성을 유지하기 위한 확장 타입입니다.
 * 
 * 마이그레이션 가이드:
 * ```typescript
 * // ❌ 기존 방식
 * const staffId = workLog.dealerId || workLog.userId;
 * const eventId = workLog.jobPostingId;
 * const name = workLog.dealerName;
 * 
 * // ✅ 권장 방식 (LegacyWorkLog 사용 시)
 * const staffId = workLog.staffId || workLog.dealerId || workLog.userId;
 * const eventId = workLog.eventId || workLog.jobPostingId;
 * const name = workLog.staffName || workLog.dealerName;
 * 
 * // ✅ 최적 방식 (UnifiedWorkLog 직접 사용)
 * const staffId = workLog.staffId;
 * const eventId = workLog.eventId;
 * const name = workLog.staffName;
 * ```
 */
export type LegacyWorkLog = UnifiedWorkLog & {
  /** @deprecated dealerId는 staffId로 대체되었습니다. staffId를 사용하세요. */
  dealerId?: string;
  
  /** @deprecated userId는 staffId로 대체되었습니다. staffId를 사용하세요. */
  userId?: string;
  
  /** @deprecated dealerName은 staffName으로 대체되었습니다. staffName을 사용하세요. */
  dealerName?: string;
  
  /** @deprecated jobPostingId는 eventId로 대체되었습니다. eventId를 사용하세요. */
  jobPostingId?: string;
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
 * @description WorkLog 데이터의 타입을 안전하게 확인하는 함수들입니다.
 */

/**
 * UnifiedWorkLog 타입 가드
 * @param data 확인할 데이터
 * @returns UnifiedWorkLog 타입인지 여부
 * 
 * @example
 * ```typescript
 * if (isUnifiedWorkLog(data)) {
 *   // data는 UnifiedWorkLog 타입으로 안전하게 사용 가능
 *   console.log(data.staffId, data.eventId);
 * }
 * ```
 */
export const isUnifiedWorkLog = (data: any): data is UnifiedWorkLog => {
  return data && 
    typeof data.staffId === 'string' && 
    typeof data.eventId === 'string' &&
    typeof data.date === 'string' &&
    typeof data.staffName === 'string';
};

/**
 * LegacyWorkLog 타입 가드
 * @param data 확인할 데이터
 * @returns LegacyWorkLog 타입인지 여부 (deprecated 필드를 포함하는 경우)
 * 
 * @example
 * ```typescript
 * if (isLegacyWorkLog(data)) {
 *   // 레거시 필드가 있는 데이터 처리
 *   const staffId = data.staffId || data.dealerId || data.userId;
 * }
 * ```
 */
export const isLegacyWorkLog = (data: any): data is LegacyWorkLog => {
  return data && (
    'dealerId' in data || 
    'userId' in data || 
    'dealerName' in data ||
    'jobPostingId' in data
  );
};

/**
 * WorkLog 데이터 유효성 검사
 * @param data 검사할 WorkLog 데이터
 * @returns 유효성 검사 결과
 * 
 * @example
 * ```typescript
 * const validation = validateWorkLog(data);
 * if (!validation.isValid) {
 *   console.error('유효하지 않은 WorkLog:', validation.errors);
 * }
 * ```
 */
export const validateWorkLog = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!data) {
    errors.push('WorkLog 데이터가 없습니다.');
    return { isValid: false, errors };
  }
  
  if (!data.id || typeof data.id !== 'string') {
    errors.push('id는 필수 문자열 필드입니다.');
  }
  
  if (!data.staffId && !data.dealerId && !data.userId) {
    errors.push('staffId(또는 dealerId/userId)는 필수 필드입니다.');
  }
  
  if (!data.eventId && !data.jobPostingId) {
    errors.push('eventId(또는 jobPostingId)는 필수 필드입니다.');
  }
  
  if (!data.staffName && !data.dealerName) {
    errors.push('staffName(또는 dealerName)은 필수 필드입니다.');
  }
  
  if (!data.date || typeof data.date !== 'string') {
    errors.push('date는 필수 문자열 필드입니다(YYYY-MM-DD 형식).');
  }
  
  return { isValid: errors.length === 0, errors };
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