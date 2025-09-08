import { JobPosting } from '../types/jobPosting';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import { logger } from './logger';

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
 * 근무 시간 계산 (시간 단위)
 */
export function calculateWorkHours(workLog: UnifiedWorkLog): number {
  // 예정 시간 사용 (정산 기준)
  const startTime = workLog.scheduledStartTime;
  const endTime = workLog.scheduledEndTime;
  
  if (!startTime || !endTime) {
    return 0;
  }
  
  try {
    // 디버그: 시간 데이터 로깅
    logger.info('근무시간 계산 시작', {
      component: 'payrollCalculations',
      data: {
        workLogId: workLog.id,
        startTime: startTime,
        endTime: endTime,
        startTimeType: typeof startTime,
        endTimeType: typeof endTime,
        hasSecondsInStart: startTime && typeof startTime === 'object' && 'seconds' in startTime,
        hasSecondsInEnd: endTime && typeof endTime === 'object' && 'seconds' in endTime
      }
    });
    
    // Firebase Timestamp 형태 처리 개선
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    // startTime 처리
    if (startTime) {
      if (typeof startTime === 'object' && 'toDate' in startTime) {
        // Firebase Timestamp 객체 (toDate 메서드 있음)
        startDate = startTime.toDate();
        logger.info('startTime: toDate() 사용', { component: 'payrollCalculations', data: { startDate } });
      } else if (typeof startTime === 'object' && 'seconds' in startTime) {
        // Firebase Timestamp 플레인 객체 ({ seconds, nanoseconds })
        startDate = new Date((startTime as any).seconds * 1000);
        logger.info('startTime: seconds 사용', { component: 'payrollCalculations', data: { seconds: (startTime as any).seconds, startDate } });
      } else if (typeof startTime === 'string') {
        // 문자열 형태 시간
        startDate = new Date(startTime);
        logger.info('startTime: 문자열 사용', { component: 'payrollCalculations', data: { startTime, startDate } });
      }
    }
    
    // endTime 처리
    if (endTime) {
      if (typeof endTime === 'object' && 'toDate' in endTime) {
        // Firebase Timestamp 객체 (toDate 메서드 있음)
        endDate = endTime.toDate();
        logger.info('endTime: toDate() 사용', { component: 'payrollCalculations', data: { endDate } });
      } else if (typeof endTime === 'object' && 'seconds' in endTime) {
        // Firebase Timestamp 플레인 객체 ({ seconds, nanoseconds })
        endDate = new Date((endTime as any).seconds * 1000);
        logger.info('endTime: seconds 사용', { component: 'payrollCalculations', data: { seconds: (endTime as any).seconds, endDate } });
      } else if (typeof endTime === 'string') {
        // 문자열 형태 시간
        endDate = new Date(endTime);
        logger.info('endTime: 문자열 사용', { component: 'payrollCalculations', data: { endTime, endDate } });
      }
    }
      
    if (!startDate || !endDate) {
      logger.warn('시작/종료 시간 파싱 실패', {
        component: 'payrollCalculations',
        data: { startDate, endDate, startTime, endTime }
      });
      return 0;
    }
    
    const hoursWorked = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    return Math.max(0, Math.round(hoursWorked * 100) / 100); // 소수점 2자리
  } catch (error) {
    logger.error('근무시간 계산 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'payrollCalculations',
      data: { workLogId: workLog.id }
    });
    return 0;
  }
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
    // 역할별 급여 정보 가져오기
    const { salaryType, salaryAmount } = getRoleSalaryInfo(role, jobPosting, roleSalaryOverrides);
    
    // 총 근무 시간 계산
    const totalHours = workLogs.reduce((sum, log) => {
      return sum + calculateWorkHours(log);
    }, 0);
    
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
        totalPayment
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