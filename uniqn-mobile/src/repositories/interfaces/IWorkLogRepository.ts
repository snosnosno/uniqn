/**
 * UNIQN Mobile - WorkLog Repository Interface
 *
 * @description 근무기록(WorkLog) 관련 데이터 접근 추상화
 * @version 1.0.0
 */

import type { Unsubscribe } from 'firebase/firestore';
import type { WorkLog, PayrollStatus, WorkLogStatus } from '@/types';

/**
 * 근무 기록 조회 필터 옵션
 */
export interface WorkLogFilterOptions {
  /** 날짜 범위 필터 */
  dateRange?: { start: string; end: string };
  /** 상태 필터 */
  status?: WorkLogStatus;
  /** 페이지 크기 (기본 50) */
  pageSize?: number;
}

// ============================================================================
// Types
// ============================================================================

/**
 * 근무 기록 통계
 */
export interface WorkLogStats {
  totalWorkLogs: number;
  completedCount: number;
  totalHoursWorked: number;
  averageHoursPerDay: number;
  pendingPayroll: number;
  completedPayroll: number;
}

/**
 * 월별 정산 요약
 */
export interface MonthlyPayrollSummary {
  month: string; // YYYY-MM
  totalAmount: number;
  pendingAmount: number;
  completedAmount: number;
  workLogCount: number;
  workLogs?: WorkLog[]; // 상세 조회 시 포함
}

// ============================================================================
// Interface
// ============================================================================

/**
 * WorkLog Repository 인터페이스
 *
 * 구현체:
 * - FirebaseWorkLogRepository (프로덕션)
 * - MockWorkLogRepository (테스트)
 */
export interface IWorkLogRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 근무 기록 조회
   * @param workLogId - 근무 기록 ID
   * @returns 근무 기록 또는 null
   */
  getById(workLogId: string): Promise<WorkLog | null>;

  /**
   * 스태프의 근무 기록 목록 조회
   * @param staffId - 스태프 ID
   * @param pageSize - 페이지 크기 (기본 50)
   * @returns 근무 기록 목록
   */
  getByStaffId(staffId: string, pageSize?: number): Promise<WorkLog[]>;

  /**
   * 스태프의 근무 기록을 필터와 함께 조회
   *
   * @description scheduleService에서 사용하는 필터링된 조회
   * - 날짜 범위 필터
   * - 상태 필터 (scheduled, checked_in, checked_out)
   *
   * @param staffId - 스태프 ID
   * @param options - 필터 옵션
   * @returns 필터링된 근무 기록 목록
   */
  getByStaffIdWithFilters(staffId: string, options?: WorkLogFilterOptions): Promise<WorkLog[]>;

  /**
   * 특정 날짜의 근무 기록 조회
   * @param staffId - 스태프 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @returns 근무 기록 목록
   */
  getByDate(staffId: string, date: string): Promise<WorkLog[]>;

  /**
   * 특정 공고의 근무 기록 조회
   * @param jobPostingId - 공고 ID
   * @returns 근무 기록 목록
   */
  getByJobPostingId(jobPostingId: string): Promise<WorkLog[]>;

  /**
   * 오늘 출근한 근무 기록 조회
   * @param staffId - 스태프 ID
   * @returns 출근 중인 근무 기록 또는 null
   */
  getTodayCheckedIn(staffId: string): Promise<WorkLog | null>;

  /**
   * 근무 기록 통계 조회
   * @param staffId - 스태프 ID
   * @returns 통계 정보
   */
  getStats(staffId: string): Promise<WorkLogStats>;

  /**
   * 월별 정산 요약 조회
   * @param staffId - 스태프 ID
   * @param year - 연도
   * @param month - 월 (1-12)
   * @returns 월별 정산 요약
   */
  getMonthlyPayroll(staffId: string, year: number, month: number): Promise<MonthlyPayrollSummary>;

  /**
   * 날짜 범위로 근무 기록 조회
   * @param staffId - 스태프 ID
   * @param startDate - 시작 날짜 (YYYY-MM-DD)
   * @param endDate - 종료 날짜 (YYYY-MM-DD)
   * @returns 근무 기록 목록
   */
  getByDateRange(staffId: string, startDate: string, endDate: string): Promise<WorkLog[]>;

  /**
   * 공고-스태프-날짜로 근무 기록 조회
   * @param jobPostingId - 공고 ID
   * @param staffId - 스태프 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @returns 근무 기록 또는 null
   */
  findByJobPostingStaffDate(
    jobPostingId: string,
    staffId: string,
    date: string
  ): Promise<WorkLog | null>;

  // ==========================================================================
  // 실시간 구독 (Realtime)
  // ==========================================================================

  /**
   * 특정 날짜의 근무 기록 실시간 구독
   * @param staffId - 스태프 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @param onData - 데이터 콜백
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeByDate(
    staffId: string,
    date: string,
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe;

  /**
   * 스태프의 전체 근무 기록 실시간 구독 (최근 50개)
   *
   * @description scheduleService의 subscribeToSchedules에서 사용
   *
   * @param staffId - 스태프 ID
   * @param onData - 데이터 콜백
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeByStaffId(
    staffId: string,
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe;

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  /**
   * 정산 상태 변경
   * @param workLogId - 근무 기록 ID
   * @param status - 새 정산 상태
   */
  updatePayrollStatus(workLogId: string, status: PayrollStatus): Promise<void>;
}
