import type { SettlementBreakdown } from '@/types/schedule';
import type { JobRoleStats, JobPostingCard, SalaryInfo } from '@/types/jobPosting';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import { parseTimeSlotToDate } from '@/utils/date/ranges';
import { DEFAULT_SALARY_INFO, PROVIDED_FLAG } from '@/utils/settlement/constants';
import {
  type TaxSettings,
  DEFAULT_TAX_SETTINGS,
  calculateTaxAmountByItems,
} from '@/utils/settlement/tax';
import { SettlementCalculator } from './SettlementCalculator';

export interface SettlementResult {
  hoursWorked: number;
  basePay: number;
  allowancePay: number;
  totalPay: number;
}

export interface Allowances {
  guaranteedHours?: number;
  meal?: number;
  transportation?: number;
  accommodation?: number;
  additional?: number;
}

export interface PostingSettlementSource {
  roles?: JobRoleStats[];
  defaultSalary?: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
}

export interface ExtendedSettlementResult extends SettlementResult {
  taxAmount: number;
  afterTaxPay: number;
}

interface WorkLogWithOverrides {
  role?: string;
  customRole?: string;
  customSalaryInfo?: SalaryInfo;
  customAllowances?: Allowances;
  customTaxSettings?: TaxSettings;
}

export function parseTimestamp(value: unknown): Date | null {
  return TimeNormalizer.parseTime(value as TimeInput);
}

export function calculateHoursWorked(startTime: TimeInput, endTime: TimeInput): number {
  return SettlementCalculator.calculateHours(startTime, endTime);
}

export function calculatePayByType(salaryInfo: SalaryInfo, hoursWorked: number): number {
  // 음수 금액 방어 (SettlementCalculator.calculateBasePay 와 동치)
  if (salaryInfo.amount < 0) {
    return 0;
  }

  switch (salaryInfo.type) {
    case 'hourly':
      return Math.round(hoursWorked * salaryInfo.amount);
    case 'daily':
    case 'monthly':
      return salaryInfo.amount;
    default:
      return 0;
  }
}

export function getRoleSalaryFromRoles(
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[] | undefined,
  targetRole: string | undefined,
  customRole?: string,
  defaultSalary?: SalaryInfo
): SalaryInfo {
  const fallback = defaultSalary ?? DEFAULT_SALARY_INFO;

  if (!targetRole || !roles?.length) return fallback;

  const effectiveRole = targetRole === 'other' && customRole ? customRole : targetRole;
  const roleData = roles.find((role) => {
    const roleKey = role.role || role.name;

    if (roleKey === 'other' && role.customRole) {
      return role.customRole === effectiveRole;
    }

    return roleKey === effectiveRole;
  });

  return roleData?.salary ?? fallback;
}

export function getRoleSalaryFromSettlementSource(
  source: PostingSettlementSource | undefined,
  targetRole: string | undefined,
  customRole?: string
): SalaryInfo {
  return getRoleSalaryFromRoles(source?.roles, targetRole, customRole, source?.defaultSalary);
}

export function calculateAllowanceAmount(allowances?: Allowances): number {
  if (!allowances) return 0;

  let amount = 0;

  if (allowances.meal && allowances.meal !== PROVIDED_FLAG && allowances.meal > 0) {
    amount += allowances.meal;
  }

  if (
    allowances.transportation &&
    allowances.transportation !== PROVIDED_FLAG &&
    allowances.transportation > 0
  ) {
    amount += allowances.transportation;
  }

  if (
    allowances.accommodation &&
    allowances.accommodation !== PROVIDED_FLAG &&
    allowances.accommodation > 0
  ) {
    amount += allowances.accommodation;
  }

  // 추가 수당 (SettlementCalculator.calculateAllowances 와 동치)
  if (allowances.additional && allowances.additional > 0) {
    amount += allowances.additional;
  }

  return amount;
}

export function calculateSettlement(
  startTime: TimeInput,
  endTime: TimeInput,
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

export function calculateSettlementFromWorkLog(
  workLog: {
    checkInTime?: TimeInput;
    checkOutTime?: TimeInput;
    role?: string;
    customSalaryInfo?: SalaryInfo;
    customAllowances?: Allowances;
    customTaxSettings?: TaxSettings;
  },
  salaryInfo: SalaryInfo,
  allowances?: Allowances,
  taxSettings?: TaxSettings
): ExtendedSettlementResult {
  const effectiveSalary = workLog.customSalaryInfo || salaryInfo;
  const effectiveAllowances = workLog.customAllowances || allowances;
  const effectiveTaxSettings = workLog.customTaxSettings || taxSettings || DEFAULT_TAX_SETTINGS;

  const baseResult = calculateSettlement(
    workLog.checkInTime,
    workLog.checkOutTime,
    effectiveSalary,
    effectiveAllowances
  );

  const taxAmount = calculateTaxAmountByItems(effectiveTaxSettings, {
    basePay: baseResult.basePay,
    meal: effectiveAllowances?.meal,
    transportation: effectiveAllowances?.transportation,
    accommodation: effectiveAllowances?.accommodation,
    additional: effectiveAllowances?.additional,
  });

  return {
    ...baseResult,
    taxAmount,
    afterTaxPay: baseResult.totalPay - taxAmount,
  };
}

export function calculateTotalSettlementFromRoles(
  workLogs: {
    checkInTime?: TimeInput;
    checkOutTime?: TimeInput;
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
  return workLogs.reduce((total, workLog) => {
    const salaryInfo =
      workLog.customSalaryInfo ||
      getRoleSalaryFromRoles(roles, workLog.role, workLog.customRole, defaultSalary);
    const effectiveAllowances = workLog.customAllowances || allowances;
    const effectiveTaxSettings = workLog.customTaxSettings || taxSettings || DEFAULT_TAX_SETTINGS;

    const baseResult = calculateSettlement(
      workLog.checkInTime,
      workLog.checkOutTime,
      salaryInfo,
      effectiveAllowances
    );

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

export function getEffectiveSalaryInfoFromRoles(
  workLog: WorkLogWithOverrides,
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[] | undefined,
  defaultSalary?: SalaryInfo
): SalaryInfo {
  if (workLog.customSalaryInfo) {
    return workLog.customSalaryInfo;
  }

  return getRoleSalaryFromRoles(roles, workLog.role, workLog.customRole, defaultSalary);
}

export function getEffectiveAllowances(
  workLog: WorkLogWithOverrides,
  defaultAllowances?: Allowances
): Allowances {
  if (workLog.customAllowances) {
    return workLog.customAllowances;
  }

  return defaultAllowances || {};
}

export function getEffectiveTaxSettings(
  workLog: WorkLogWithOverrides,
  defaultTaxSettings?: TaxSettings
): TaxSettings {
  if (workLog.customTaxSettings) {
    return workLog.customTaxSettings;
  }

  return defaultTaxSettings || DEFAULT_TAX_SETTINGS;
}

export function calculateSettlementWithTax(
  startTime: TimeInput,
  endTime: TimeInput,
  salaryInfo: SalaryInfo,
  allowances?: Allowances,
  taxSettings?: TaxSettings
): ExtendedSettlementResult {
  const baseResult = calculateSettlement(startTime, endTime, salaryInfo, allowances);
  const effectiveTaxSettings = taxSettings || DEFAULT_TAX_SETTINGS;
  const taxAmount = calculateTaxAmountByItems(effectiveTaxSettings, {
    basePay: baseResult.basePay,
    meal: allowances?.meal,
    transportation: allowances?.transportation,
    accommodation: allowances?.accommodation,
    additional: allowances?.additional,
  });

  return {
    ...baseResult,
    taxAmount,
    afterTaxPay: baseResult.totalPay - taxAmount,
  };
}

export function calculateSettlementFromWorkLogWithTax(
  workLog: WorkLogWithOverrides & {
    checkInTime?: TimeInput;
    checkOutTime?: TimeInput;
  },
  roles: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[] | undefined,
  defaultSalary?: SalaryInfo,
  defaultAllowances?: Allowances,
  defaultTaxSettings?: TaxSettings
): ExtendedSettlementResult {
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

export function getRoleSalaryFromJobPostingCard(
  jobPostingCard: JobPostingCard | undefined,
  role: string | undefined,
  customRole?: string
): SalaryInfo {
  if (!jobPostingCard || !role) {
    return DEFAULT_SALARY_INFO;
  }

  if (jobPostingCard.useSameSalary && jobPostingCard.defaultSalary) {
    return jobPostingCard.defaultSalary;
  }

  const matchedSalaryRow = (jobPostingCard.fullSalaryRows ?? jobPostingCard.salaryRows ?? []).find(
    (row) => {
      if (role === 'other') {
        return customRole
          ? row.role === 'other' && row.customRole === customRole
          : row.role === 'other';
      }

      return row.role === role;
    }
  );

  if (matchedSalaryRow?.salary) {
    return matchedSalaryRow.salary;
  }

  return jobPostingCard.defaultSalary || DEFAULT_SALARY_INFO;
}

export function calculateSettlementBreakdown(
  workLogData: {
    checkInTime?: TimeInput;
    checkOutTime?: TimeInput;
    timeSlot?: string;
    date?: string;
    role?: string;
    customRole?: string;
    customSalaryInfo?: SalaryInfo;
    customAllowances?: Allowances;
    customTaxSettings?: TaxSettings;
  },
  settlementSource?: PostingSettlementSource
): SettlementBreakdown | null {
  let startTime: TimeInput | undefined = workLogData.checkInTime;
  let endTime: TimeInput | undefined = workLogData.checkOutTime;

  if ((!startTime || !endTime) && workLogData.timeSlot && workLogData.date) {
    const parsed = parseTimeSlotToDate(workLogData.timeSlot, workLogData.date);
    if (!startTime && parsed.startTime) startTime = parsed.startTime;
    if (!endTime && parsed.endTime) endTime = parsed.endTime;
  }

  const isEstimate = !workLogData.checkInTime || !workLogData.checkOutTime;

  if (!startTime || !endTime) {
    return null;
  }

  const salaryInfo: SalaryInfo =
    workLogData.customSalaryInfo ||
    getRoleSalaryFromSettlementSource(settlementSource, workLogData.role, workLogData.customRole);
  const allowances: Allowances | undefined =
    workLogData.customAllowances || settlementSource?.allowances;
  const taxSettings: TaxSettings =
    workLogData.customTaxSettings || settlementSource?.taxSettings || DEFAULT_TAX_SETTINGS;

  const result = calculateSettlementWithTax(
    startTime,
    endTime,
    salaryInfo,
    allowances,
    taxSettings
  );

  return {
    hoursWorked: result.hoursWorked,
    salaryInfo: {
      type: salaryInfo.type,
      amount: salaryInfo.amount,
    },
    basePay: result.basePay,
    allowances: allowances
      ? {
          guaranteedHours: allowances.guaranteedHours,
          meal: allowances.meal,
          transportation: allowances.transportation,
          accommodation: allowances.accommodation,
          additional: allowances.additional,
        }
      : undefined,
    allowancePay: result.allowancePay,
    taxSettings:
      taxSettings.type !== 'none'
        ? {
            type: taxSettings.type,
            value: taxSettings.value,
          }
        : undefined,
    taxAmount: result.taxAmount,
    totalPay: result.totalPay,
    afterTaxPay: result.afterTaxPay,
    isEstimate,
    calculatedAt: new Date().toISOString(),
  };
}
