// 단순 정산 계산 유틸리티
import { SimplePayrollData, SimplePayrollSummary, DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import { WorkLog } from '../hooks/useShiftSchedule';

/**
 * 근무 시간 계산 (분 단위)
 */
export function calculateWorkMinutes(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0;
  
  try {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    let diffMs = end.getTime() - start.getTime();
    
    // 자정을 넘는 경우 처리
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    return Math.floor(diffMs / (1000 * 60));
  } catch {
    return 0;
  }
}

/**
 * 분을 시간으로 변환
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100; // 소수점 2자리까지
}

/**
 * 일급 계산
 */
export function calculateDailyPay(hours: number, hourlyRate: number | undefined): number {
  // DEFAULT_HOURLY_RATES가 undefined일 수 있으므로 안전하게 처리
  const defaultRate = DEFAULT_HOURLY_RATES?.['default'] ?? 15000;
  const rate = hourlyRate ?? defaultRate;
  return Math.floor(hours * rate);
}

/**
 * WorkLog를 SimplePayrollData로 변환
 */
export function workLogToPayrollData(
  workLog: WorkLog,
  hourlyRate?: number
): SimplePayrollData {
  // 실제 근무 시간 우선, 없으면 예정 시간 사용
  const startTime = workLog.actualStartTime || workLog.scheduledStartTime;
  const endTime = workLog.actualEndTime || workLog.scheduledEndTime;
  
  const workMinutes = calculateWorkMinutes(startTime, endTime);
  const workHours = minutesToHours(workMinutes);
  
  // 시급 결정 (전달받은 값 또는 기본값)
  const defaultRate = DEFAULT_HOURLY_RATES?.['default'] ?? 15000;
  const rate = hourlyRate ?? defaultRate;
  
  return {
    staffId: workLog.dealerId,
    staffName: workLog.dealerName,
    date: workLog.date,
    workHours,
    hourlyRate: rate,
    dailyPay: calculateDailyPay(workHours, rate),
    eventId: workLog.eventId,
  };
}

/**
 * 여러 일급 데이터를 집계
 */
export function aggregatePayrollData(
  payrollData: SimplePayrollData[]
): SimplePayrollSummary {
  if (payrollData.length === 0) {
    const today = new Date().toISOString().split('T')[0] || '';
    return {
      period: { start: today, end: today },
      totalStaff: 0,
      totalHours: 0,
      totalPay: 0,
      averageHours: 0,
      averagePay: 0,
      dailyPayrolls: [],
    };
  }

  // 날짜 범위 계산
  const dates = payrollData.map(p => p.date).sort();
  const startDate = dates[0] || '';
  const endDate = dates[dates.length - 1] || '';

  // 스태프별 유니크 카운트
  const uniqueStaff = new Set(payrollData.map(p => p.staffId));
  const totalStaff = uniqueStaff.size;

  // 집계
  const totalHours = payrollData.reduce((sum, p) => sum + p.workHours, 0);
  const totalPay = payrollData.reduce((sum, p) => sum + p.dailyPay, 0);

  return {
    period: { start: startDate, end: endDate },
    totalStaff,
    totalHours: Math.round(totalHours * 100) / 100,
    totalPay,
    averageHours: totalStaff > 0 ? Math.round((totalHours / totalStaff) * 100) / 100 : 0,
    averagePay: totalStaff > 0 ? Math.floor(totalPay / totalStaff) : 0,
    dailyPayrolls: payrollData,
  };
}

/**
 * 스태프별로 그룹화
 */
export function groupPayrollByStaff(
  payrollData: SimplePayrollData[]
): Map<string, SimplePayrollData[]> {
  const grouped = new Map<string, SimplePayrollData[]>();
  
  payrollData.forEach(data => {
    const key = data.staffId;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(data);
  });
  
  return grouped;
}

/**
 * 날짜별로 그룹화
 */
export function groupPayrollByDate(
  payrollData: SimplePayrollData[]
): Map<string, SimplePayrollData[]> {
  const grouped = new Map<string, SimplePayrollData[]>();
  
  payrollData.forEach(data => {
    const key = data.date;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(data);
  });
  
  return grouped;
}

/**
 * CSV 내보내기용 데이터 생성
 */
export function generateCSVData(payrollData: SimplePayrollData[]): string {
  const headers = ['날짜', '직원명', '근무시간', '시급', '일급'];
  
  const rows = payrollData.map(data => [
    data.date,
    data.staffName,
    data.workHours.toFixed(2),
    data.hourlyRate.toLocaleString(),
    data.dailyPay.toLocaleString(),
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
  
  return csvContent;
}

/**
 * 근무 시간 계산 (WorkLog 기반)
 */
export function calculateWorkHours(workLog: WorkLog): number {
  const startTime = workLog.actualStartTime || workLog.scheduledStartTime;
  const endTime = workLog.actualEndTime || workLog.scheduledEndTime;
  
  const minutes = calculateWorkMinutes(startTime, endTime);
  return minutesToHours(minutes);
}

/**
 * 시급 기반 급여 계산
 */
export function calculateHourlyPay(workLog: WorkLog, hourlyRate: number): number {
  const hours = calculateWorkHours(workLog);
  return Math.floor(hours * hourlyRate);
}

/**
 * 일급 기반 급여 계산 (고정)
 */
export function calculateDailyPayFixed(workLog: WorkLog, dailyRate: number): number {
  // 출근 여부만 확인 (completed 또는 actualEndTime이 있으면 일급 지급)
  if (workLog.status === 'completed' || workLog.actualEndTime) {
    return dailyRate;
  }
  return 0;
}

/**
 * 월급 기반 급여 계산 (일할 계산)
 */
export function calculateMonthlyPay(
  workLogs: WorkLog[], 
  monthlyRate: number,
  totalDaysInMonth: number
): number {
  // 실제 근무한 일수 계산
  const workedDays = workLogs.filter(log => 
    log.status === 'completed' || log.actualEndTime
  ).length;
  
  // 일할 계산 (월급 / 전체일수 * 근무일수)
  return Math.floor((monthlyRate / totalDaysInMonth) * workedDays);
}

/**
 * 기타/사용자 정의 급여 계산
 */
export function calculateCustomPay(workLog: WorkLog, customAmount: number): number {
  // 프로젝트 기반 고정 금액 또는 사용자 정의 로직
  if (workLog.status === 'completed' || workLog.actualEndTime) {
    return customAmount;
  }
  return 0;
}

/**
 * 초과 근무 수당 계산
 */
export function calculateOvertimePay(
  workLog: WorkLog, 
  standardHours: number = 8,
  overtimeRate: number = 1.5
): number {
  const totalHours = calculateWorkHours(workLog);
  
  if (totalHours > standardHours) {
    const overtimeHours = totalHours - standardHours;
    const hourlyRate = DEFAULT_HOURLY_RATES?.['default'] ?? 15000;
    return Math.floor(overtimeHours * hourlyRate * overtimeRate);
  }
  
  return 0;
}

/**
 * 월의 전체 일수 계산
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}