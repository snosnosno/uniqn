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
 * 표준 필드:
 * - staffId: 스태프 식별자
 * - eventId: 이벤트 식별자
 * - staffName: 스태프 이름
 * - scheduledStartTime/EndTime: 예정 근무 시간
 * - actualStartTime/EndTime: 실제 근무 시간
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 통합 WorkLog 인터페이스
 * @description 모든 WorkLog 관련 데이터의 표준 형식입니다. 새로운 개발에서는 이 타입을 우선 사용하세요.
 * 
 * 표준 필드:
 * - staffId: 스태프 식별자
 * - eventId: 이벤트 식별자
 * - staffName: 스태프 이름
 * - scheduledStartTime/EndTime: 예정 근무 시간
 * - actualStartTime/EndTime: 실제 근무 시간
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
  
  /** 스태프 ID */
  staffId: string;
  
  /** 이벤트 ID */
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
  
  /** 지원 시 설정한 시간 (스태프가 지원할 때 선택한 근무 시간) */
  assignedTime?: string | null;
  
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
  /** 근무 상태 - 출석 상태와 통합 */
  status?: 'not_started' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled';
  
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
 * @description 표준 WorkLog 사용 가이드입니다.
 * 
 * 사용 예시:
 * ```typescript
 * // ✅ 표준 필드 사용
 * const staffId = workLog.staffId;
 * const eventId = workLog.eventId;
 * const name = workLog.staffName;
 * ```
 */

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
  status?: 'not_started' | 'checked_in' | 'checked_out' | 'completed' | 'cancelled';
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
 *   logger.info('WorkLog 데이터', { staffId: data.staffId, eventId: data.eventId });
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
 * WorkLog 데이터 유효성 검사
 * @param data 검사할 WorkLog 데이터
 * @returns 유효성 검사 결과
 * 
 * @example
 * ```typescript
 * const validation = validateWorkLog(data);
 * if (!validation.isValid) {
 *   logger.error('유효하지 않은 WorkLog', validation.errors);
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
  
  if (!data.staffId) {
    errors.push('staffId는 필수 필드입니다.');
  }
  
  if (!data.eventId) {
    errors.push('eventId는 필수 필드입니다.');
  }
  
  if (!data.staffName) {
    errors.push('staffName은 필수 필드입니다.');
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
  NOT_STARTED: 'not_started',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
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