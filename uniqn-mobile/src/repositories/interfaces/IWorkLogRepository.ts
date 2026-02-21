/**
 * UNIQN Mobile - WorkLog Repository Interface
 *
 * @description 근무기록(WorkLog) 관련 데이터 접근 추상화
 * @version 1.0.0
 */

import type { Unsubscribe } from 'firebase/firestore';
import type { WorkLog, PayrollStatus, WorkLogStatus, QRCodeAction } from '@/types';

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

  /**
   * 단일 근무 기록 실시간 구독
   * @param workLogId - 근무 기록 ID
   * @param onData - 데이터 콜백 (삭제 시 null)
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeById(
    workLogId: string,
    onData: (workLog: WorkLog | null) => void,
    onError: (error: Error) => void
  ): Unsubscribe;

  /**
   * 스태프의 근무 기록 실시간 구독 (날짜 범위 필터 지원)
   *
   * @description workLogService의 subscribeToMyWorkLogs에서 사용
   *
   * @param staffId - 스태프 ID
   * @param options - 날짜 범위, 페이지 크기
   * @param onData - 데이터 콜백
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeByStaffIdWithFilters(
    staffId: string,
    options: { dateRange?: { start: string; end: string }; pageSize?: number },
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe;

  /**
   * 오늘의 활성 근무 기록 실시간 구독 (출근 가능/출근 중)
   *
   * @description workLogService의 subscribeToTodayWorkStatus에서 사용
   *
   * @param staffId - 스태프 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @param statuses - 구독할 상태 목록
   * @param onData - 데이터 콜백 (없으면 null)
   * @param onError - 에러 콜백
   * @returns 구독 해제 함수
   */
  subscribeTodayActive(
    staffId: string,
    date: string,
    statuses: string[],
    onData: (workLog: WorkLog | null) => void,
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

  /**
   * 근무 시간 수정 (트랜잭션)
   *
   * @description 이미 정산 완료된 기록은 수정 불가
   * @param workLogId - 근무 기록 ID
   * @param updates - 수정할 필드
   * @throws BusinessError - 정산 완료된 기록 수정 시도 시
   */
  updateWorkTimeTransaction(
    workLogId: string,
    updates: {
      checkInTime?: Date;
      checkOutTime?: Date;
      notes?: string;
    }
  ): Promise<void>;

  /**
   * 정산 상태 업데이트 (트랜잭션, 중복 검증 포함)
   *
   * @description 중복 정산 방지 및 금액 지원
   * @param workLogId - 근무 기록 ID
   * @param status - 정산 상태
   * @param amount - 정산 금액 (선택)
   * @throws BusinessError - 중복 정산 시도 시
   */
  updatePayrollStatusTransaction(
    workLogId: string,
    status: PayrollStatus,
    amount?: number
  ): Promise<void>;

  /**
   * 음수 정산 플래그 기록 (관리자 알림 트리거용)
   *
   * @description Cloud Function onNegativeSettlement 트리거를 위한 플래그 기록
   * @param workLogId - 근무 기록 ID
   * @param amount - 음수 정산 금액
   */
  flagNegativeSettlement(workLogId: string, amount: number): Promise<void>;

  /**
   * QR 체크인/체크아웃 트랜잭션 처리
   *
   * @description 원자적으로 WorkLog 상태 확인 + 업데이트
   * - 출근: scheduled → checked_in (중복 출근 방지)
   * - 퇴근: checked_in → checked_out (미출근 상태 방지)
   *
   * @param workLogId - 근무 기록 ID
   * @param staffId - 스태프 ID (방어적 검증용)
   * @param jobPostingId - 공고 ID (방어적 검증용)
   * @param action - 출근/퇴근
   * @param checkTime - 체크 시각
   * @param date - 근무 날짜 (YYYY-MM-DD, timeSlot 파싱용)
   * @returns action 결과 (출근/퇴근, 근무시간)
   */
  processQRCheckInOutTransaction(
    workLogId: string,
    staffId: string,
    jobPostingId: string,
    action: QRCodeAction,
    checkTime: Date,
    date: string
  ): Promise<{
    action: QRCodeAction;
    hasExistingCheckInTime: boolean;
    workDuration: number;
  }>;
}
