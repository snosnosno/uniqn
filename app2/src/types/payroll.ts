import { Timestamp } from 'firebase/firestore';
import { WorkLog } from '../hooks/useShiftSchedule';
import { UnifiedWorkLog } from './unified/workLog';

/**
 * 역할별 급여 정보
 */
export interface RolePayrollInfo {
  role: string;
  workLogs: UnifiedWorkLog[];
  totalHours: number;
  totalDays: number;
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
  salaryAmount: number;
  basePay: number;
}

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
  regularPay: number; // 정규 급여
  overtimePay?: number; // 초과 근무 수당
  bonuses?: number; // 보너스
  deductions?: number; // 공제
  totalAmount: number; // 총 지급액

  // 메타 정보
  period: {
    start: string;
    end: string;
  };
  calculatedAt?: Timestamp;
}

/**
 * 향상된 급여 계산 타입 (개선된 버전)
 */
export interface EnhancedPayrollCalculation {
  // 기본 정보
  staffId: string;
  staffName: string;
  role: string; // 기존 호환성 유지 (주요 역할)
  roles?: string[]; // 모든 역할 배열
  phone?: string;

  // 근무 정보 (자동 계산) - UnifiedWorkLog 타입 사용
  workLogs: UnifiedWorkLog[];
  totalHours: number; // 총 근무시간
  totalDays: number; // 총 근무일수
  overtimeHours?: number; // 초과 근무시간

  // 급여 정보 (공고에서 자동 로드)
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
  baseSalary: number; // 기본 급여 (시급/일급/월급)

  // 수당 정보 (개별 편집 가능)
  allowances: {
    meal: number; // 식비 (계산된 총액)
    transportation: number; // 교통비 (계산된 총액)
    accommodation: number; // 숙소비 (계산된 총액)
    bonus: number; // 보너스
    other: number; // 기타
    otherDescription?: string;

    // 일당 기반 계산을 위한 추가 필드
    dailyRates?: {
      // 일당 정보
      meal?: number;
      transportation?: number;
      accommodation?: number;
    };
    workDays?: number; // 적용된 근무일수
    isManualEdit?: boolean; // 수동 편집 여부
  };

  // 계산 결과
  basePay: number; // 기본급 (시간/일수 × 기본급여)
  allowanceTotal: number; // 수당 합계
  totalAmount: number; // 총 지급액 (세전)

  // 세금 정보
  tax?: number; // 세금 금액
  taxRate?: number; // 세율 (%)
  afterTaxAmount?: number; // 세후 급여

  // 역할별 급여 정보 (다중 역할 지원)
  rolePayrollInfo?: Map<string, RolePayrollInfo>;
  totalBasePay?: number; // 모든 역할 기본급 합계

  // 메타 정보
  period: {
    start: string;
    end: string;
  };
  notes?: string; // 특이사항
  isConfirmed?: boolean; // 정산 확정 여부
  calculatedAt?: Timestamp;
}

/**
 * 일괄 수당 적용 설정
 */
export interface BulkAllowanceSettings {
  applyTo: 'all' | 'selected' | 'byRole';
  targetRoles?: string[];
  targetStaffIds?: string[];
  allowances: {
    meal?: {
      enabled: boolean;
      amount: number;
    };
    transportation?: {
      enabled: boolean;
      amount: number;
    };
    accommodation?: {
      enabled: boolean;
      amount: number;
    };
    bonus?: {
      enabled: boolean;
      amount: number;
    };
    other?: {
      enabled: boolean;
      amount: number;
      description?: string;
    };
  };
}

/**
 * 수당 항목 타입
 */
export type AllowanceType = 'meal' | 'transportation' | 'accommodation' | 'bonus' | 'other';

/**
 * 수당 설정 타입
 */
export interface AllowanceConfig {
  type: AllowanceType;
  label: string;
  enabled: boolean;
  amount: number;
  description?: string;
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
  eventId?: string;
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
    overtime?: number; // 초과 근무 시급 (선택)
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

/**
 * 역할별 급여 설정 타입
 */
export interface RoleSalaryConfig {
  [role: string]: {
    salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
    salaryAmount: number;
    customRoleName?: string; // 기타 선택 시 직접 입력한 역할명
  };
}

/**
 * 일괄 급여 변경 타입
 */
export interface BulkSalaryUpdate {
  targetStaffIds: string[];
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
  salaryAmount: number;
  applyToRole?: string; // 특정 역할에만 적용하는 경우
  previewMode?: boolean; // 미리보기 모드인지 여부
}

/**
 * 일괄 급여 편집 결과
 */
export interface BulkSalaryEditResult {
  affectedStaff: Array<{
    staffId: string;
    staffName: string;
    role: string;
    beforeSalary: { type: string; amount: number };
    afterSalary: { type: string; amount: number };
    amountDifference: number;
  }>;
  totalAmountDifference: number;
  successCount: number;
  failCount: number;
}
