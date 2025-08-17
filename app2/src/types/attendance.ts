/**
 * 출석 관리 관련 타입 정의
 * 
 * 이 파일은 T-HOLDEM 프로젝트의 출석 및 근무 관리를 위한 타입들을 정의합니다.
 * 
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 * 
 * 주요 변경사항:
 * - staffId (표준) ← dealerId (deprecated)
 * - actualStartTime/actualEndTime (표준) ← checkInTime/checkOutTime (deprecated)
 * - 필드 우선순위: 표준 필드 → deprecated 필드 → fallback 값
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 출석 상태 열거형
 * @description 스태프의 출석 상태를 나타냅니다.
 */
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out';

/**
 * 출석 기록 인터페이스
 * @description 개별 스태프의 출석 기록을 저장합니다.
 * 
 * 필드 우선순위:
 * - staffId (표준) → dealerId (fallback)
 * - actualStartTime (표준) → checkInTime (fallback)
 * - actualEndTime (표준) → checkOutTime (fallback)
 */
export interface AttendanceRecord {
  /** 출석 기록 고유 ID */
  id: string;
  
  /** 스태프 ID */
  staffId: string;
  
  /** 출석 날짜 (YYYY-MM-DD 형식) */
  date: string;
  
  /** 출석 상태 */
  status: AttendanceStatus;
  
  /** 실제 출근 시간 */
  actualStartTime?: Timestamp | null;
  
  /** 실제 퇴근 시간 */
  actualEndTime?: Timestamp | null;
  
  /** QR 코드 정보 */
  qrCode?: string;
  
  /** 수동 입력 여부 */
  isManualEntry?: boolean;
  
  /** 비고 */
  notes?: string;
  
  /** 생성 시간 */
  createdAt: Timestamp;
  
  /** 수정 시간 */
  updatedAt: Timestamp;
}

/**
 * 근무 일지 인터페이스
 * @description 스태프의 개별 근무 기록을 저장합니다.
 * 
 * 필드 우선순위:
 * - staffId (표준) → dealerId (fallback)
 * - scheduledStartTime/EndTime (표준) → assignedTime (fallback, common.ts에서)
 * - actualStartTime/EndTime (표준) → checkInTime/checkOutTime (fallback, AttendanceRecord에서)
 * 
 * 통합 사용 가이드:
 * - 이 타입은 types/unified/workLog.ts의 UnifiedWorkLog와 호환됩니다.
 * - 새로운 프로젝트에서는 UnifiedWorkLog 사용을 권장합니다.
 */
export interface WorkLog {
  /** 근무 일지 고유 ID */
  id: string;
  
  /** 스태프 ID */
  staffId: string;
  
  /** 근무 날짜 (YYYY-MM-DD 형식) */
  date: string;
  
  /** 예정 시작 시간 (표준 필드) */
  scheduledStartTime?: Timestamp | null;
  
  /** 예정 종료 시간 (표준 필드) */
  scheduledEndTime?: Timestamp | null;
  
  /** 실제 시작 시간 */
  actualStartTime?: Timestamp | null;
  
  /** 실제 종료 시간 */
  actualEndTime?: Timestamp | null;
  
  /** 휴게시간 (분 단위) */
  breakTime?: number;
  
  /** 실제 근무시간 (시간 단위) */
  workHours?: number;
  
  /** 초과근무시간 (시간 단위) */
  overtime?: number;
  
  /** 출석 상태 */
  status?: AttendanceStatus;
  
  /** 비고 */
  notes?: string;
  
  /** 생성 시간 */
  createdAt?: Timestamp;
  
  /** 수정 시간 */
  updatedAt?: Timestamp;
}

/**
 * 출석 요약 정보
 */
export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  attendanceRate: number; // 출석률 (%)
}

/**
 * 시간 편집 모달용 인터페이스
 */
export interface WorkTimeEditData {
  staffId: string;
  staffName: string;
  date: string;
  scheduledStartTime?: string; // HH:mm 형식
  scheduledEndTime?: string; // HH:mm 형식
  actualStartTime?: string; // HH:mm 형식
  actualEndTime?: string; // HH:mm 형식
}

/**
 * 대량 시간 편집용 인터페이스
 */
export interface BulkTimeEditData {
  staffIds: string[];
  dates: string[];
  scheduledStartTime?: string; // HH:mm 형식
  scheduledEndTime?: string; // HH:mm 형식
}

/**
 * QR 코드 데이터 인터페이스
 * @description QR 코드에 포함되는 출석 체크 데이터 구조입니다.
 */
export interface QRCodeData {
  /** QR 코드 타입 (현재는 출석만 지원) */
  type: 'attendance';
  
  /** 스태프 ID */
  staffId: string;
  
  /** QR 코드 생성 시점의 타임스탬프 */
  timestamp: number;
  
  /** 출석 액션 타입 */
  action: 'check_in' | 'check_out';
}

/**
 * QR 스캔 결과 인터페이스
 */
export interface QRScanResult {
  text: string;
  format?: string;
  timestamp?: number;
}

/**
 * QR 스캔 에러 인터페이스
 */
export interface QRScanError {
  message: string;
  code?: string;
  name?: string;
}

/**
 * 출석 통계 인터페이스
 */
export interface AttendanceStats {
  date: string;
  totalStaff: number;
  checkedIn: number;
  checkedOut: number;
  notStarted: number;
}

/**
 * 출석 필터 옵션
 * @description 출석 기록을 필터링하기 위한 옵션들을 정의합니다.
 */
export interface AttendanceFilterOptions {
  /** 시작 날짜 (YYYY-MM-DD 형식) */
  startDate?: string;
  
  /** 종료 날짜 (YYYY-MM-DD 형식) */
  endDate?: string;
  
  /** 출석 상태 필터 */
  status?: AttendanceStatus | 'all';
  
  /** 특정 스태프 ID 목록 */
  staffIds?: string[];
  
  /** 검색어 (스태프 이름 등) */
  searchTerm?: string;
}

// ============================================================================
// 마이그레이션 가이드 및 표준화된 필드 매핑
// ============================================================================

/**
 * 표준화된 필드 매핑 가이드
 * 
 * 이 섹션은 T-HOLDEM 프로젝트의 타입 표준화를 위한 마이그레이션 가이드입니다.
 * 
 * 주요 변경사항:
 * 1. staffId (표준) ← dealerId (deprecated)
 * 2. actualStartTime/actualEndTime (표준) ← checkInTime/checkOutTime (deprecated)
 * 3. scheduledStartTime/scheduledEndTime (표준) ← assignedTime (deprecated)
 * 
 * 필드 우선순위:
 * - 표준 필드 → deprecated 필드 → fallback 값 → undefined
 * 
 * 권장 사용 패턴:
 * ```typescript
 * // ✅ 표준 필드 우선 사용
 * const staffId = record.staffId || record.dealerId;
 * const startTime = record.actualStartTime || record.checkInTime;
 * const endTime = record.actualEndTime || record.checkOutTime;
 * 
 * // ✅ 안전한 타입 체크
 * if (record.actualStartTime) {
 *   // actualStartTime 사용
 * } else if (record.checkInTime) {
 *   // checkInTime fallback 사용
 * }
 * 
 * // ❌ deprecated 필드 직접 사용 지양
 * const staffId = record.dealerId; // 권장하지 않음
 * ```
 * 
 * 타입 안전성 체크:
 * ```typescript
 * // 필드 존재 여부 확인
 * const hasStaffId = 'staffId' in record && record.staffId;
 * const hasActualTime = 'actualStartTime' in record && record.actualStartTime;
 * 
 * // undefined 체크
 * const safeStaffId = record.staffId ?? record.dealerId ?? '';
 * const safeStartTime = record.actualStartTime ?? record.checkInTime ?? null;
 * ```
 * 
 * @version 2.0
 * @since 2025-01-01
 * @author T-HOLDEM Development Team
 */