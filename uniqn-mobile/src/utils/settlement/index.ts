/**
 * UNIQN Mobile - 정산 계산 유틸리티
 *
 * @description 모든 정산 금액 계산의 단일 소스
 * @version 1.0.0
 */

import type { SettlementBreakdown, SalaryType as ScheduleSalaryType, TaxType as ScheduleTaxType } from '@/types/schedule';
import type { JobPostingCard } from '@/types/jobPosting';

// ============================================================================
// Types
// ============================================================================

export type SalaryType = 'hourly' | 'daily' | 'monthly' | 'other';

export interface SalaryInfo {
  type: SalaryType;
  amount: number;
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
  /** 추가 수당 (금액만 입력) */
  additional?: number;
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
  other: '협의',
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
 * roles 배열에서 역할별 급여 조회
 *
 * @description roles[].salary 구조에서 급여 정보를 조회
 * @param roles - 역할 배열 (salary 포함)
 * @param targetRole - 찾을 역할 코드
 * @param customRole - 커스텀 역할명 (targetRole이 'other'일 때 사용)
 * @param defaultSalary - 기본 급여 (없으면 DEFAULT_SALARY_INFO)
 */
export function getRoleSalaryFromRoles(
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[] | undefined,
  targetRole: string | undefined,
  customRole?: string,
  defaultSalary?: SalaryInfo
): SalaryInfo {
  const fallback = defaultSalary ?? DEFAULT_SALARY_INFO;

  if (!targetRole || !roles?.length) return fallback;

  // 커스텀 역할이면 customRole을 키로 사용
  const effectiveRole = targetRole === 'other' && customRole ? customRole : targetRole;

  // roles 배열에서 해당 역할 찾기
  const roleData = roles.find(r => {
    // role 또는 name 필드 확인 (FormRoleWithCount와 RoleRequirement 호환)
    const roleKey = r.role || r.name;

    // 커스텀 역할 매칭
    if (roleKey === 'other' && r.customRole) {
      return r.customRole === effectiveRole;
    }

    return roleKey === effectiveRole;
  });

  return roleData?.salary ?? fallback;
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
 * WorkLog 객체로 정산 금액 계산 (세금 포함)
 *
 * @description 개별 오버라이드(customSalaryInfo, customAllowances, customTaxSettings)가 있으면 우선 적용
 *              taxableItems에 따라 항목별로 세금 적용 여부를 결정
 */
export function calculateSettlementFromWorkLog(
  workLog: {
    checkInTime?: unknown;
    checkOutTime?: unknown;
    role?: string;
    customSalaryInfo?: SalaryInfo;
    customAllowances?: Allowances;
    customTaxSettings?: TaxSettings;
  },
  salaryInfo: SalaryInfo,
  allowances?: Allowances,
  taxSettings?: TaxSettings
): ExtendedSettlementResult {
  // 개별 오버라이드가 있으면 우선 사용
  const effectiveSalary = workLog.customSalaryInfo || salaryInfo;
  const effectiveAllowances = workLog.customAllowances || allowances;
  const effectiveTaxSettings = workLog.customTaxSettings || taxSettings || DEFAULT_TAX_SETTINGS;

  const baseResult = calculateSettlement(
    workLog.checkInTime,
    workLog.checkOutTime,
    effectiveSalary,
    effectiveAllowances
  );

  // 세금 계산 (항목별 적용 여부 고려)
  const taxAmount = calculateTaxAmountByItems(effectiveTaxSettings, {
    basePay: baseResult.basePay,
    meal: effectiveAllowances?.meal,
    transportation: effectiveAllowances?.transportation,
    accommodation: effectiveAllowances?.accommodation,
    additional: effectiveAllowances?.additional,
  });
  const afterTaxPay = baseResult.totalPay - taxAmount;

  return {
    ...baseResult,
    taxAmount,
    afterTaxPay,
  };
}

/**
 * 여러 근무 기록의 총 금액 계산
 *
 * @description roles[].salary 구조에서 급여 정보를 조회하여 정산
 *              개별 오버라이드(customSalaryInfo, customAllowances, customTaxSettings)가 있으면 우선 적용
 *              taxableItems에 따라 항목별로 세금 적용 여부를 결정
 * @param workLogs - 근무 기록 배열
 * @param roles - 역할 배열 (salary 포함)
 * @param defaultSalary - 기본 급여 (역할별 급여가 없을 때 사용)
 * @param allowances - 수당 정보
 * @param taxSettings - 세금 설정 (선택)
 * @param returnAfterTax - true면 세후 금액 합산, false면 세전 금액 합산 (기본: false)
 */
export function calculateTotalSettlementFromRoles(
  workLogs: {
    checkInTime?: unknown;
    checkOutTime?: unknown;
    role?: string;
    customRole?: string;
    customSalaryInfo?: SalaryInfo;
    customAllowances?: Allowances;
    customTaxSettings?: TaxSettings;
  }[],
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[],
  defaultSalary?: SalaryInfo,
  allowances?: Allowances,
  taxSettings?: TaxSettings,
  returnAfterTax: boolean = false
): number {
  return workLogs.reduce((total, log) => {
    // 개별 오버라이드가 있으면 우선 사용
    const salaryInfo = log.customSalaryInfo || getRoleSalaryFromRoles(roles, log.role, log.customRole, defaultSalary);
    const effectiveAllowances = log.customAllowances || allowances;
    const effectiveTaxSettings = log.customTaxSettings || taxSettings || DEFAULT_TAX_SETTINGS;

    const baseResult = calculateSettlement(
      log.checkInTime,
      log.checkOutTime,
      salaryInfo,
      effectiveAllowances
    );

    // 세금 계산 (항목별 적용 여부 고려)
    const taxAmount = calculateTaxAmountByItems(effectiveTaxSettings, {
      basePay: baseResult.basePay,
      meal: effectiveAllowances?.meal,
      transportation: effectiveAllowances?.transportation,
      accommodation: effectiveAllowances?.accommodation,
      additional: effectiveAllowances?.additional,
    });
    const afterTaxPay = baseResult.totalPay - taxAmount;

    return total + (returnAfterTax ? afterTaxPay : baseResult.totalPay);
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
  return SALARY_TYPE_LABELS[type] || '협의';
}

// ============================================================================
// Tax Calculation Functions
// ============================================================================

export type TaxType = 'none' | 'rate' | 'fixed';

/** 세금 적용 대상 항목 */
export interface TaxableItems {
  /** 기본급 */
  basePay?: boolean;
  /** 식비 */
  meal?: boolean;
  /** 교통비 */
  transportation?: boolean;
  /** 숙박비 */
  accommodation?: boolean;
  /** 추가수당 */
  additional?: boolean;
}

/** 기본 세금 적용 대상 (모두 적용) */
export const DEFAULT_TAXABLE_ITEMS: TaxableItems = {
  basePay: true,
  meal: true,
  transportation: true,
  accommodation: true,
  additional: true,
};

export interface TaxSettings {
  /** 세금 유형 */
  type: TaxType;
  /** 세율(%) 또는 고정 금액 */
  value: number;
  /** 세금 적용 대상 항목 */
  taxableItems?: TaxableItems;
}

/** 기본 세금 설정 (없음) */
export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  type: 'none',
  value: 0,
};

/**
 * 세금 금액 계산 (기본 - 전체 금액에 적용)
 */
export function calculateTaxAmount(
  taxSettings: TaxSettings,
  totalAmount: number
): number {
  if (taxSettings.type === 'none') return 0;
  if (taxSettings.type === 'fixed') return taxSettings.value;
  // rate
  return Math.round(totalAmount * (taxSettings.value / 100));
}

/** 세금 계산용 상세 금액 */
export interface TaxableAmounts {
  basePay: number;
  meal?: number;
  transportation?: number;
  accommodation?: number;
  additional?: number;
}

/**
 * 항목별 세금 적용 여부를 고려한 세금 금액 계산
 *
 * @description taxableItems에 따라 각 항목별로 세금 적용 여부를 결정
 */
export function calculateTaxAmountByItems(
  taxSettings: TaxSettings,
  amounts: TaxableAmounts
): number {
  if (taxSettings.type === 'none') return 0;

  // 고정 금액인 경우 그대로 반환
  if (taxSettings.type === 'fixed') return taxSettings.value;

  // taxableItems 기본값 적용
  const taxableItems = taxSettings.taxableItems || DEFAULT_TAXABLE_ITEMS;

  // 세금 적용 대상 금액 합산
  let taxableAmount = 0;

  // 기본급
  if (taxableItems.basePay !== false) {
    taxableAmount += amounts.basePay;
  }

  // 식비 (PROVIDED_FLAG 제외)
  if (taxableItems.meal !== false && amounts.meal && amounts.meal !== PROVIDED_FLAG && amounts.meal > 0) {
    taxableAmount += amounts.meal;
  }

  // 교통비 (PROVIDED_FLAG 제외)
  if (taxableItems.transportation !== false && amounts.transportation && amounts.transportation !== PROVIDED_FLAG && amounts.transportation > 0) {
    taxableAmount += amounts.transportation;
  }

  // 숙박비 (PROVIDED_FLAG 제외)
  if (taxableItems.accommodation !== false && amounts.accommodation && amounts.accommodation !== PROVIDED_FLAG && amounts.accommodation > 0) {
    taxableAmount += amounts.accommodation;
  }

  // 추가수당
  if (taxableItems.additional !== false && amounts.additional && amounts.additional > 0) {
    taxableAmount += amounts.additional;
  }

  // 세율 적용
  return Math.round(taxableAmount * (taxSettings.value / 100));
}

/**
 * 세후 금액 계산
 */
export function calculateAfterTaxAmount(
  taxSettings: TaxSettings,
  totalAmount: number
): number {
  const taxAmount = calculateTaxAmount(taxSettings, totalAmount);
  return totalAmount - taxAmount;
}

// ============================================================================
// Effective Value Functions (with individual overrides)
// ============================================================================

interface WorkLogWithOverrides {
  role?: string;
  customRole?: string;
  customSalaryInfo?: SalaryInfo;
  customAllowances?: Allowances;
  customTaxSettings?: TaxSettings;
}

/**
 * 개별 오버라이드를 고려한 실제 적용 급여 정보 반환
 * - workLog에 customSalaryInfo가 있으면 그것을 사용
 * - 없으면 roles 배열에서 해당 역할의 급여 정보를 사용
 *
 * @param workLog - 근무 기록 (오버라이드 포함)
 * @param roles - 역할 배열 (salary 포함)
 * @param defaultSalary - 기본 급여 (역할별 급여가 없을 때 사용)
 */
export function getEffectiveSalaryInfoFromRoles(
  workLog: WorkLogWithOverrides,
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[] | undefined,
  defaultSalary?: SalaryInfo
): SalaryInfo {
  // 개별 오버라이드가 있으면 우선 사용
  if (workLog.customSalaryInfo) {
    return workLog.customSalaryInfo;
  }
  // roles 배열에서 급여 정보 조회 (커스텀 역할 지원)
  return getRoleSalaryFromRoles(roles, workLog.role, workLog.customRole, defaultSalary);
}

/**
 * 개별 오버라이드를 고려한 실제 적용 수당 정보 반환
 * - workLog에 customAllowances가 있으면 그것을 사용
 * - 없으면 기본 수당 정보를 사용
 */
export function getEffectiveAllowances(
  workLog: WorkLogWithOverrides,
  defaultAllowances?: Allowances
): Allowances {
  // 개별 오버라이드가 있으면 우선 사용
  if (workLog.customAllowances) {
    return workLog.customAllowances;
  }
  // 기본 수당 정보 사용
  return defaultAllowances || {};
}

/**
 * 개별 오버라이드를 고려한 실제 적용 세금 설정 반환
 * - workLog에 customTaxSettings가 있으면 그것을 사용
 * - 없으면 기본 세금 설정을 사용
 */
export function getEffectiveTaxSettings(
  workLog: WorkLogWithOverrides,
  defaultTaxSettings?: TaxSettings
): TaxSettings {
  // 개별 오버라이드가 있으면 우선 사용
  if (workLog.customTaxSettings) {
    return workLog.customTaxSettings;
  }
  // 기본 세금 설정 사용
  return defaultTaxSettings || DEFAULT_TAX_SETTINGS;
}

// ============================================================================
// Extended Settlement Result (with tax)
// ============================================================================

export interface ExtendedSettlementResult extends SettlementResult {
  taxAmount: number;      // 세금 금액
  afterTaxPay: number;    // 세후 금액
}

/**
 * 세금을 포함한 정산 금액 계산
 *
 * @description taxableItems에 따라 항목별로 세금 적용 여부를 결정
 */
export function calculateSettlementWithTax(
  startTime: unknown,
  endTime: unknown,
  salaryInfo: SalaryInfo,
  allowances?: Allowances,
  taxSettings?: TaxSettings
): ExtendedSettlementResult {
  // 기본 정산 계산
  const baseResult = calculateSettlement(startTime, endTime, salaryInfo, allowances);

  // 세금 계산 (항목별 적용 여부 고려)
  const effectiveTaxSettings = taxSettings || DEFAULT_TAX_SETTINGS;
  const taxAmount = calculateTaxAmountByItems(effectiveTaxSettings, {
    basePay: baseResult.basePay,
    meal: allowances?.meal,
    transportation: allowances?.transportation,
    accommodation: allowances?.accommodation,
    additional: allowances?.additional,
  });
  const afterTaxPay = baseResult.totalPay - taxAmount;

  return {
    ...baseResult,
    taxAmount,
    afterTaxPay,
  };
}

/**
 * WorkLog 객체로 세금 포함 정산 금액 계산
 *
 * @param workLog - 근무 기록 (오버라이드 포함)
 * @param roles - 역할 배열 (salary 포함)
 * @param defaultSalary - 기본 급여
 * @param defaultAllowances - 기본 수당
 * @param defaultTaxSettings - 기본 세금 설정
 */
export function calculateSettlementFromWorkLogWithTax(
  workLog: WorkLogWithOverrides & {
    checkInTime?: unknown;
    checkOutTime?: unknown;
  },
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[] | undefined,
  defaultSalary?: SalaryInfo,
  defaultAllowances?: Allowances,
  defaultTaxSettings?: TaxSettings
): ExtendedSettlementResult {
  // 실제 적용될 값들 결정 (roles 배열 사용)
  const salaryInfo = getEffectiveSalaryInfoFromRoles(workLog, roles, defaultSalary);
  const allowances = getEffectiveAllowances(workLog, defaultAllowances);
  const taxSettings = getEffectiveTaxSettings(workLog, defaultTaxSettings);

  return calculateSettlementWithTax(
    workLog.checkInTime,
    workLog.checkOutTime,
    salaryInfo,
    allowances,
    taxSettings
  );
}

// ============================================================================
// Settlement Breakdown (Pre-calculated for caching)
// ============================================================================

/**
 * JobPostingCard에서 역할별 급여 정보 조회
 *
 * @param jobPostingCard - 공고 카드 정보
 * @param role - 역할 코드
 * @param customRole - 커스텀 역할명 (role이 'other'일 때)
 */
export function getRoleSalaryFromJobPostingCard(
  jobPostingCard: JobPostingCard | undefined,
  role: string | undefined,
  customRole?: string
): SalaryInfo {
  if (!jobPostingCard || !role) {
    return DEFAULT_SALARY_INFO;
  }

  // useSameSalary가 true면 defaultSalary 사용
  if (jobPostingCard.useSameSalary && jobPostingCard.defaultSalary) {
    return jobPostingCard.defaultSalary;
  }

  // dateRequirements > timeSlots > roles 구조에서 역할별 급여 조회
  if (jobPostingCard.dateRequirements) {
    for (const dateReq of jobPostingCard.dateRequirements) {
      for (const timeSlot of dateReq.timeSlots || []) {
        for (const r of timeSlot.roles || []) {
          // 역할 매칭
          const isMatch =
            (role === 'other' && customRole && r.customRole === customRole) ||
            (r.role === role);

          if (isMatch && r.salary) {
            return r.salary;
          }
        }
      }
    }
  }

  // 역할별 급여 못 찾으면 defaultSalary 폴백
  if (jobPostingCard.defaultSalary) {
    return jobPostingCard.defaultSalary;
  }

  return DEFAULT_SALARY_INFO;
}

/**
 * 정산 세부 내역 계산 (한 번만 호출하여 캐싱)
 *
 * scheduleService에서 WorkLog → ScheduleEvent 변환 시 호출
 * SettlementTab에서는 이 결과를 그대로 사용하여 중복 계산 방지
 *
 * @param workLogData - 근무 기록 데이터
 * @param jobPostingCard - 공고 카드 정보 (급여/수당/세금 기본값)
 * @returns SettlementBreakdown 또는 null (시간 정보 없는 경우)
 */
export function calculateSettlementBreakdown(
  workLogData: {
    checkInTime?: unknown;
    checkOutTime?: unknown;
    scheduledStartTime?: unknown;
    scheduledEndTime?: unknown;
    role?: string;
    customRole?: string;
    customSalaryInfo?: SalaryInfo;
    customAllowances?: Allowances;
    customTaxSettings?: TaxSettings;
  },
  jobPostingCard?: JobPostingCard
): SettlementBreakdown | null {
  // 1. 시간 결정 (checkIn/checkOut 우선, 없으면 scheduled)
  const startTime = workLogData.checkInTime || workLogData.scheduledStartTime;
  const endTime = workLogData.checkOutTime || workLogData.scheduledEndTime;
  const isEstimate = !workLogData.checkInTime || !workLogData.checkOutTime;

  // 시간 정보가 없으면 계산 불가
  if (!startTime || !endTime) {
    return null;
  }

  // 2. 급여 정보 결정 (오버라이드 우선)
  const salaryInfo: SalaryInfo = workLogData.customSalaryInfo ||
    getRoleSalaryFromJobPostingCard(jobPostingCard, workLogData.role, workLogData.customRole);

  // 3. 수당 정보 결정 (오버라이드 우선)
  const allowances: Allowances | undefined = workLogData.customAllowances ||
    jobPostingCard?.allowances;

  // 4. 세금 설정 결정 (오버라이드 우선)
  const taxSettings: TaxSettings = workLogData.customTaxSettings ||
    jobPostingCard?.taxSettings ||
    DEFAULT_TAX_SETTINGS;

  // 5. 정산 계산
  const result = calculateSettlementWithTax(
    startTime,
    endTime,
    salaryInfo,
    allowances,
    taxSettings
  );

  // 6. SettlementBreakdown 구성
  return {
    hoursWorked: result.hoursWorked,
    salaryInfo: {
      type: salaryInfo.type as ScheduleSalaryType,
      amount: salaryInfo.amount,
    },
    basePay: result.basePay,
    allowances: allowances ? {
      guaranteedHours: allowances.guaranteedHours,
      meal: allowances.meal,
      transportation: allowances.transportation,
      accommodation: allowances.accommodation,
      additional: allowances.additional,
    } : undefined,
    allowancePay: result.allowancePay,
    taxSettings: taxSettings.type !== 'none' ? {
      type: taxSettings.type as ScheduleTaxType,
      value: taxSettings.value,
    } : undefined,
    taxAmount: result.taxAmount,
    totalPay: result.totalPay,
    afterTaxPay: result.afterTaxPay,
    isEstimate,
    calculatedAt: new Date().toISOString(),
  };
}
