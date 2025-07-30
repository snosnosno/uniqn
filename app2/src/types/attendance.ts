/**
 * 출석 관리 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 출석 상태 열거형
 */
export type AttendanceStatus = 'not_started' | 'checked_in' | 'checked_out' | 'absent';

/**
 * 출석 기록 인터페이스
 */
export interface AttendanceRecord {
  id: string;
  staffId: string;
  dealerId?: string; // 기존 호환성을 위해 optional
  date: string; // YYYY-MM-DD 형식
  status: AttendanceStatus;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  checkInTime?: Timestamp | null;
  checkOutTime?: Timestamp | null;
  qrCode?: string;
  isManualEntry?: boolean;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * 근무 일지 인터페이스
 */
export interface WorkLog {
  id: string;
  staffId: string;
  dealerId?: string; // 기존 호환성을 위해 optional
  date: string; // YYYY-MM-DD 형식
  scheduledStartTime?: Timestamp | null;
  scheduledEndTime?: Timestamp | null;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  breakTime?: number; // 휴게시간 (분)
  workHours?: number; // 실제 근무시간
  overtime?: number; // 초과근무시간
  status?: AttendanceStatus;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * 출석 요약 정보
 */
export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
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
 */
export interface QRCodeData {
  type: 'attendance';
  staffId: string;
  dealerId?: string;
  timestamp: number;
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
  absent: number;
  notStarted: number;
}

/**
 * 출석 필터 옵션
 */
export interface AttendanceFilterOptions {
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus | 'all';
  staffIds?: string[];
  searchTerm?: string;
}