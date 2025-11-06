/**
 * 스케줄별 급여 계산 유틸리티
 * BasicInfoTab과 useScheduleData에서 동일한 로직 사용
 */

import { ScheduleEvent } from '../types/schedule';
import type { UnifiedWorkLog } from '../types/unified/workLog';
import type { JobPosting } from '../types/jobPosting';
import { calculateWorkHours } from './workLogMapper';
import { getRoleSalaryInfo, calculateAllowances } from './payrollCalculations';

export interface PayrollCalculationResult {
  totalHours: number;
  baseSalary: number;
  basePay: number;
  allowances: {
    meal: number;
    transportation: number;
    accommodation: number;
  };
  totalAllowances: number;
  totalPay: number;
  tax: number;
  taxRate?: number;
  afterTaxAmount: number;
}

/**
 * 스케줄의 세후 급여 계산
 * @param schedule - 스케줄 이벤트
 * @param workLog - WorkLog (선택)
 * @param jobPosting - JobPosting (선택)
 * @returns 급여 계산 결과
 */
export function calculateSchedulePayroll(
  schedule: ScheduleEvent,
  workLog: UnifiedWorkLog | null,
  jobPosting: JobPosting | null
): PayrollCalculationResult {
  const effectiveRole = schedule.role || 'staff';

  // 1. 급여 정보 추출 (payrollCalculations.ts의 getRoleSalaryInfo 사용)
  const { logger } = require('./logger');

  logger.info('🔍 급여 정보 추출 시작', {
    component: 'schedulePayrollCalculator',
    data: {
      eventId: schedule.eventId,
      eventName: schedule.eventName,
      role: effectiveRole,
      hasJobPosting: !!jobPosting,
      hasSnapshotData: !!schedule.snapshotData,
      jobPostingId: jobPosting?.id,
      jobPostingTitle: jobPosting?.title,
      jobPostingUseRoleSalary: jobPosting?.useRoleSalary,
      jobPostingRoleSalaries: jobPosting?.roleSalaries,
      jobPostingData: jobPosting,  // 🔍 전체 JobPosting 데이터 확인
      snapshotSalary: schedule.snapshotData?.salary
    }
  });

  const { salaryAmount: baseSalary } = getRoleSalaryInfo(
    effectiveRole,
    jobPosting,
    undefined,
    schedule.snapshotData
  );

  logger.info('💰 급여 정보 추출 완료', {
    component: 'schedulePayrollCalculator',
    data: {
      eventId: schedule.eventId,
      role: effectiveRole,
      baseSalary: baseSalary
    }
  });

  // 2. 근무 시간 계산 (심야 근무 자동 처리)
  let totalHours = 0;
  if (workLog) {
    totalHours = calculateWorkHours(workLog as any);
  }

  const basePay = totalHours * baseSalary;

  // 3. 수당 계산 (payrollCalculations.ts의 calculateAllowances 사용)
  const allowancesResult = calculateAllowances(jobPosting, 1, schedule.snapshotData);
  const allowances = {
    meal: allowancesResult.meal,
    transportation: allowancesResult.transportation,
    accommodation: allowancesResult.accommodation
  };

  const totalAllowances = allowances.meal + allowances.transportation + allowances.accommodation;
  const totalPay = basePay + totalAllowances;

  // 5. 세금 계산 (총 지급액 기준)
  const taxSettings = schedule.snapshotData?.taxSettings || jobPosting?.taxSettings;
  let tax = 0;
  let taxRate: number | undefined;
  let afterTaxAmount = totalPay;

  if (taxSettings?.enabled) {
    if (taxSettings.taxRate !== undefined && taxSettings.taxRate > 0) {
      taxRate = taxSettings.taxRate;
      tax = Math.round(totalPay * (taxSettings.taxRate / 100));
    } else if (taxSettings.taxAmount !== undefined && taxSettings.taxAmount > 0) {
      tax = taxSettings.taxAmount;
    }
    afterTaxAmount = totalPay - tax;
  }

  const result: PayrollCalculationResult = {
    totalHours,
    baseSalary,
    basePay,
    allowances,
    totalAllowances,
    totalPay,
    tax,
    afterTaxAmount
  };

  if (taxRate !== undefined) {
    result.taxRate = taxRate;
  }

  return result;
}