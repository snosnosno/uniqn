import { JobPosting } from '../types/jobPosting';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import { logger } from './logger';
import { calculateWorkHours as calculateWorkHoursFromMapper } from './workLogMapper';

/**
 * 통합 급여 계산 유틸리티
 * 모든 컴포넌트에서 일관된 급여 계산을 위한 통합 함수들
 */

export interface PayrollCalculationResult {
  hourlyRate: number;
  totalHours: number;
  basePayment: number;
  allowances: {
    meal: number;
    transportation: number;
    accommodation: number;
    bonus: number;
    other: number;
  };
  totalPayment: number;
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
}

/**
 * 역할별 급여 정보 가져오기
 */
export function getRoleSalaryInfo(
  role: string,
  jobPosting?: JobPosting | null,
  roleSalaryOverrides?: Record<string, any>
): { salaryType: string; salaryAmount: number } {
  // 오버라이드 설정이 있는 경우 우선 사용
  const override = roleSalaryOverrides?.[role];
  if (override) {
    return {
      salaryType: override.salaryType,
      salaryAmount: override.salaryAmount
    };
  }
  
  // 역할별 급여 설정이 있는 경우 우선 사용
  if (jobPosting?.useRoleSalary && jobPosting.roleSalaries?.[role]) {
    const roleSalary = jobPosting.roleSalaries[role];
    if (roleSalary) {
      return {
        salaryType: roleSalary.salaryType === 'negotiable' ? 'other' : roleSalary.salaryType,
        salaryAmount: parseFloat(roleSalary.salaryAmount) || 0
      };
    }
  }
  
  // 기본 급여 설정 사용
  const baseSalaryType = jobPosting?.salaryType || 'hourly';
  const salaryType = baseSalaryType === 'negotiable' ? 'other' : baseSalaryType;
  const salaryAmount = jobPosting?.salaryAmount ? 
    parseFloat(jobPosting.salaryAmount) : 
    (DEFAULT_HOURLY_RATES[role] || DEFAULT_HOURLY_RATES['default'] || 10000);
  
  return { salaryType, salaryAmount };
}

/**
 * 근무 시간 계산 (시간 단위) - workLogMapper의 검증된 로직 사용
 */
export function calculateWorkHours(workLog: UnifiedWorkLog): number {
  // workLogMapper에서 완벽하게 작동하는 로직을 그대로 사용
  return calculateWorkHoursFromMapper(workLog);
}

/**
 * 기본 급여 계산
 */
export function calculateBasePay(
  salaryType: string,
  salaryAmount: number,
  totalHours: number,
  totalDays: number
): number {
  switch(salaryType) {
    case 'hourly':
      return Math.round(totalHours * salaryAmount);
    case 'daily':
      return Math.round(totalDays * salaryAmount);
    case 'monthly':
      // 월급은 고정
      return salaryAmount;
    case 'other':
      // 기타는 커스텀 계산 (일급 기준)
      return Math.round(totalDays * salaryAmount);
    default:
      return Math.round(totalHours * salaryAmount); // 기본은 시급
  }
}

/**
 * 수당 계산
 */
export function calculateAllowances(jobPosting?: JobPosting | null): PayrollCalculationResult['allowances'] {
  const benefits = jobPosting?.benefits;
  
  return {
    meal: benefits?.mealAllowance ? (parseInt(benefits.mealAllowance) || 0) : 0,
    transportation: benefits?.transportation ? (parseInt(benefits.transportation) || 0) : 0,
    accommodation: benefits?.accommodation ? (parseInt(benefits.accommodation) || 0) : 0,
    bonus: 0,
    other: 0
  };
}

/**
 * 통합 급여 계산 - 모든 컴포넌트에서 사용할 메인 함수
 */
export function calculatePayroll(
  workLogs: UnifiedWorkLog[],
  role: string,
  jobPosting?: JobPosting | null,
  roleSalaryOverrides?: Record<string, any>
): PayrollCalculationResult {
  try {
    // 48시간 문제 디버깅을 위한 WorkLog 분석
    logger.debug('급여 계산 시작', {
      component: 'payrollCalculations',
      data: {
        role,
        workLogsCount: workLogs.length,
        workLogIds: workLogs.map(log => ({ 
          id: log.id, 
          staffId: log.staffId, 
          date: log.date, 
          role: log.role 
        }))
      }
    });

    // 중복 WorkLog 검사
    const workLogIds = workLogs.map(log => log.id);
    const uniqueIds = new Set(workLogIds);
    if (workLogIds.length !== uniqueIds.size) {
      logger.warn('중복 WorkLog 감지', {
        component: 'payrollCalculations',
        data: {
          role,
          totalWorkLogs: workLogIds.length,
          uniqueWorkLogs: uniqueIds.size,
          duplicateIds: workLogIds.filter((id, index) => workLogIds.indexOf(id) !== index)
        }
      });
    }
    
    // 역할별 급여 정보 가져오기
    const { salaryType, salaryAmount } = getRoleSalaryInfo(role, jobPosting, roleSalaryOverrides);
    
    // 총 근무 시간 계산 (각 WorkLog별 상세 추적)
    const hoursPerLog: { id: string; hours: number; date: string }[] = [];
    const totalHours = workLogs.reduce((sum, log) => {
      const hours = calculateWorkHours(log);
      hoursPerLog.push({ id: log.id, hours, date: log.date });
      return sum + hours;
    }, 0);

    // 48시간 이상인 경우 상세 분석
    if (totalHours >= 48) {
      logger.warn('48시간 이상 근무시간 감지 - 상세 분석', {
        component: 'payrollCalculations',
        data: {
          role,
          totalHours,
          workLogsAnalysis: hoursPerLog,
          abnormalLogs: hoursPerLog.filter(log => log.hours >= 24),
          dateDistribution: hoursPerLog.reduce((acc, log) => {
            acc[log.date] = (acc[log.date] || 0) + log.hours;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    }
    
    // 총 근무 일수 계산
    const uniqueDates = new Set(workLogs.map(log => log.date));
    const totalDays = uniqueDates.size;
    
    // 기본 급여 계산
    const basePayment = calculateBasePay(salaryType, salaryAmount, totalHours, totalDays);
    
    // 수당 계산
    const allowances = calculateAllowances(jobPosting);
    const totalAllowances = Object.values(allowances).reduce((sum, amount) => sum + amount, 0);
    
    // 총 급여 계산
    const totalPayment = basePayment + totalAllowances;
    
    logger.debug('급여 계산 완료', {
      component: 'payrollCalculations',
      data: {
        role,
        salaryType,
        salaryAmount,
        totalHours,
        totalDays,
        basePayment,
        totalAllowances,
        totalPayment,
        hoursBreakdown: hoursPerLog
      }
    });
    
    return {
      hourlyRate: salaryAmount,
      totalHours,
      basePayment,
      allowances,
      totalPayment,
      salaryType: salaryType as PayrollCalculationResult['salaryType']
    };
  } catch (error) {
    logger.error('급여 계산 오류', error instanceof Error ? error : new Error(String(error)), {
      component: 'payrollCalculations',
      data: { role, workLogsCount: workLogs.length }
    });
    
    // 오류 발생 시 기본값 반환
    return {
      hourlyRate: 10000,
      totalHours: 0,
      basePayment: 0,
      allowances: { meal: 0, transportation: 0, accommodation: 0, bonus: 0, other: 0 },
      totalPayment: 0,
      salaryType: 'hourly'
    };
  }
}

/**
 * 단일 WorkLog의 급여 계산 (내 스케줄 페이지용)
 */
export function calculateSingleWorkLogPayroll(
  workLog: UnifiedWorkLog,
  role: string,
  jobPosting?: JobPosting | null
): number {
  const result = calculatePayroll([workLog], role, jobPosting);
  return result.totalPayment;
}

/**
 * 급여 계산 결과 포맷팅
 */
export function formatPayrollAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * 시급 계산 (역호환성을 위한 함수)
 */
export function getHourlyRate(role: string, jobPosting?: JobPosting | null): number {
  const { salaryAmount } = getRoleSalaryInfo(role, jobPosting);
  return salaryAmount;
}