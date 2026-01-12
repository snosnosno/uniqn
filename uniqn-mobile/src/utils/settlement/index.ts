/**
 * UNIQN Mobile - 정산 계산 유틸리티
 *
 * @description 모든 정산 금액 계산의 단일 소스
 * @version 1.0.0
 */

// ============================================================================
// Types
// ============================================================================

export type SalaryType = 'hourly' | 'daily' | 'monthly' | 'other';

export interface SalaryInfo {
  type: SalaryType;
  amount: number;
}

export interface RoleSalaries {
  [role: string]: SalaryInfo;
}

export interface SettlementResult {
  hoursWorked: number;
  basePay: number;      // 기본 급여
  allowancePay: number; // 수당
  totalPay: number;     // 총 금액 (basePay + allowancePay)
}

/** 수당 정보 */
export interface Allowances {
  guaranteedHours?: number;
  meal?: number;
  transportation?: number;
  accommodation?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 기본 급여 정보 (설정 없는 경우) */
export const DEFAULT_SALARY_INFO: SalaryInfo = {
  type: 'hourly',
  amount: 15000,
};

/** 급여 타입 라벨 */
export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '기타',
};

/** "제공" 상태를 나타내는 특별 값 */
export const PROVIDED_FLAG = -1;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Firebase Timestamp 등 다양한 형식의 날짜를 Date로 변환
 */
export function parseTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

/**
 * 근무 시간 계산 (시간 단위)
 */
export function calculateHoursWorked(
  startTime: unknown,
  endTime: unknown
): number {
  const start = parseTimestamp(startTime);
  const end = parseTimestamp(endTime);

  if (!start || !end) return 0;

  const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
  return totalMinutes / 60;
}

/**
 * 급여 타입에 따른 금액 계산
 * - 시급: 근무시간 × 시급
 * - 일급/월급: 출근 시 전액
 */
export function calculatePayByType(
  salaryInfo: SalaryInfo,
  hoursWorked: number
): number {
  switch (salaryInfo.type) {
    case 'hourly':
      return Math.round(hoursWorked * salaryInfo.amount);
    case 'daily':
    case 'monthly':
      // 출근하면 전액
      return salaryInfo.amount;
    default:
      return 0;
  }
}

/**
 * 역할에 맞는 급여 정보 가져오기
 */
export function getRoleSalaryInfo(
  role: string | undefined,
  roleSalaries: RoleSalaries | undefined,
  defaultSalary?: SalaryInfo
): SalaryInfo {
  const fallback = defaultSalary ?? DEFAULT_SALARY_INFO;

  if (!role) return fallback;
  if (!roleSalaries) return fallback;

  return roleSalaries[role] ?? fallback;
}

/**
 * 수당 금액 계산
 * - 식비/교통비/숙박비 금액만 합산
 * - PROVIDED_FLAG(-1)인 경우 "제공"이므로 금액에 포함하지 않음
 */
export function calculateAllowanceAmount(allowances?: Allowances): number {
  if (!allowances) return 0;

  let amount = 0;

  // 식비 (금액이 있는 경우만)
  if (allowances.meal && allowances.meal !== PROVIDED_FLAG && allowances.meal > 0) {
    amount += allowances.meal;
  }

  // 교통비 (금액이 있는 경우만)
  if (allowances.transportation && allowances.transportation !== PROVIDED_FLAG && allowances.transportation > 0) {
    amount += allowances.transportation;
  }

  // 숙박비 (금액이 있는 경우만)
  if (allowances.accommodation && allowances.accommodation !== PROVIDED_FLAG && allowances.accommodation > 0) {
    amount += allowances.accommodation;
  }

  return amount;
}

// ============================================================================
// Main Calculation Functions
// ============================================================================

/**
 * 정산 금액 계산 (단일 근무 기록)
 *
 * @param startTime - 출근 시간
 * @param endTime - 퇴근 시간
 * @param salaryInfo - 급여 정보
 * @param allowances - 수당 정보 (선택)
 * @returns 근무시간, 기본 급여, 수당, 총 금액
 */
export function calculateSettlement(
  startTime: unknown,
  endTime: unknown,
  salaryInfo: SalaryInfo,
  allowances?: Allowances
): SettlementResult {
  const hoursWorked = calculateHoursWorked(startTime, endTime);

  if (hoursWorked === 0) {
    return {
      hoursWorked: 0,
      basePay: 0,
      allowancePay: 0,
      totalPay: 0,
    };
  }

  const basePay = calculatePayByType(salaryInfo, hoursWorked);
  const allowancePay = calculateAllowanceAmount(allowances);
  const totalPay = basePay + allowancePay;

  return {
    hoursWorked: Math.round(hoursWorked * 100) / 100,
    basePay,
    allowancePay,
    totalPay,
  };
}

/**
 * WorkLog 객체로 정산 금액 계산
 */
export function calculateSettlementFromWorkLog(
  workLog: {
    actualStartTime?: unknown;
    actualEndTime?: unknown;
    role?: string;
  },
  salaryInfo: SalaryInfo,
  allowances?: Allowances
): SettlementResult {
  return calculateSettlement(
    workLog.actualStartTime,
    workLog.actualEndTime,
    salaryInfo,
    allowances
  );
}

/**
 * 여러 근무 기록의 총 금액 계산
 */
export function calculateTotalSettlement(
  workLogs: Array<{
    actualStartTime?: unknown;
    actualEndTime?: unknown;
    role?: string;
  }>,
  roleSalaries: RoleSalaries,
  allowances?: Allowances
): number {
  return workLogs.reduce((total, log) => {
    const salaryInfo = getRoleSalaryInfo(log.role, roleSalaries);
    const { totalPay } = calculateSettlement(
      log.actualStartTime,
      log.actualEndTime,
      salaryInfo,
      allowances
    );
    return total + totalPay;
  }, 0);
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * 금액을 한국 원화 형식으로 포맷
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

/**
 * 근무 시간을 시간/분 형식으로 포맷
 */
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/**
 * 시간을 HH:MM 형식으로 포맷
 */
export function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 날짜를 YYYY년 MM월 DD일 형식으로 포맷
 */
export function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 급여 타입 라벨 가져오기
 */
export function getSalaryTypeLabel(type: SalaryType): string {
  return SALARY_TYPE_LABELS[type] || '기타';
}
