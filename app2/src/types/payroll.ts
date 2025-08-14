import { Timestamp } from 'firebase/firestore';
import { WorkLog } from '../hooks/useShiftSchedule';

/**
 * 급여 계산 결과 타입
 */
export interface PayrollCalculation {
  staffId: string;
  staffName: string;
  role: string;
  
  // 근무 정보
  workLogs: WorkLog[];
  totalHours: number;
  totalDays: number;
  
  // 급여 정보
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
  baseRate: number;
  
  // 계산 결과
  regularPay: number;      // 정규 급여
  overtimePay?: number;    // 초과 근무 수당
  bonuses?: number;        // 보너스
  deductions?: number;     // 공제
  totalAmount: number;     // 총 지급액
  
  // 메타 정보
  period: {
    start: string;
    end: string;
  };
  calculatedAt?: Timestamp;
}

/**
 * 정산 요약 정보
 */
export interface PayrollSummary {
  totalStaff: number;
  totalHours: number;
  totalDays: number;
  totalAmount: number;
  
  // 역할별 집계
  byRole: {
    [role: string]: {
      count: number;
      hours: number;
      amount: number;
    };
  };
  
  // 급여 유형별 집계
  bySalaryType: {
    hourly: number;
    daily: number;
    monthly: number;
    other: number;
  };
  
  // 기간 정보
  period: {
    start: string;
    end: string;
  };
}

/**
 * 정산 필터 옵션
 */
export interface PayrollFilters {
  jobPostingId?: string;
  startDate?: string;
  endDate?: string;
  staffIds?: string[];
  roles?: string[];
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'other' | 'all';
}

/**
 * 역할별 기본 시급 (확장)
 */
export interface ExtendedHourlyRates {
  [role: string]: {
    hourly?: number;
    daily?: number;
    monthly?: number;
    overtime?: number;  // 초과 근무 시급 (선택)
  };
}

/**
 * 정산 상태
 */
export interface PayrollStatus {
  isPaid: boolean;
  paidAt?: Timestamp;
  paidBy?: string;
  paymentMethod?: 'cash' | 'bank' | 'other';
  notes?: string;
}