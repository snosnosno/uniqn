/**
 * UNIQN Mobile - 정산 서비스 타입 정의
 *
 * @description 정산 관련 타입, 인터페이스, 상수
 * @version 1.0.0
 */

import type { WorkLog, PayrollStatus } from '@/types';
import type {
  SalaryInfo as UtilitySalaryInfo,
  Allowances as UtilityAllowances,
  TaxSettings as UtilityTaxSettings,
} from '@/utils/settlement';

// ============================================================================
// Constants
// ============================================================================

export const WORK_LOGS_COLLECTION = 'workLogs';
export const JOB_POSTINGS_COLLECTION = 'jobPostings';

// ============================================================================
// Internal Types
// ============================================================================

/** 오버라이드 필드를 포함한 WorkLog 타입 (내부용) */
export type WorkLogWithOverrides = WorkLog & {
  customRole?: string;
  customSalaryInfo?: UtilitySalaryInfo;
  customAllowances?: UtilityAllowances;
  customTaxSettings?: UtilityTaxSettings;
};

// ============================================================================
// Query Types
// ============================================================================

/**
 * 정산 대상 근무 기록 (확장된 정보 포함)
 */
export interface SettlementWorkLog extends WorkLog {
  staffName?: string;
  jobPostingTitle?: string;
  calculatedAmount?: number;
  hoursWorked?: number;
}

/**
 * 정산 필터
 */
export interface SettlementFilters {
  jobPostingId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  payrollStatus?: PayrollStatus;
  role?: string;
}

/**
 * 공고별 정산 요약
 */
export interface JobPostingSettlementSummary {
  jobPostingId: string;
  jobPostingTitle: string;
  totalWorkLogs: number;
  completedWorkLogs: number;
  pendingSettlement: number;
  completedSettlement: number;
  totalPendingAmount: number;
  totalCompletedAmount: number;
  workLogsByRole: Record<
    string,
    {
      count: number;
      pendingAmount: number;
      completedAmount: number;
    }
  >;
}

// ============================================================================
// Calculation Types
// ============================================================================

/**
 * 정산 계산 입력
 */
export interface CalculateSettlementInput {
  workLogId: string;
  deductions?: number; // 공제액
}

/**
 * 정산 계산 결과
 */
export interface SettlementCalculation {
  workLogId: string;
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
  hoursWorked: number;
  grossPay: number;
  deductions: number;
  netPay: number;
}

// ============================================================================
// Mutation Types
// ============================================================================

/**
 * 시간 수정 입력
 */
export interface UpdateWorkTimeInput {
  workLogId: string;
  /** 출근 시간 (null = 미정) */
  checkInTime?: Date | null;
  /** 퇴근 시간 (null = 미정) */
  checkOutTime?: Date | null;
  notes?: string;
  reason?: string; // 수정 사유
}

/**
 * 개별 정산 입력
 */
export interface SettleWorkLogInput {
  workLogId: string;
  amount: number;
  notes?: string;
}

/**
 * 일괄 정산 입력
 */
export interface BulkSettlementInput {
  workLogIds: string[];
  settlementDate?: Date;
  notes?: string;
}

/**
 * 정산 결과
 */
export interface SettlementResult {
  success: boolean;
  workLogId: string;
  amount: number;
  message: string;
}

/**
 * 일괄 정산 결과
 */
export interface BulkSettlementResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
  totalAmount: number;
  results: SettlementResult[];
}
