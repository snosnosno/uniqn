// 급여 데이터 집계 및 계산 유틸리티
import { WorkLog } from '../../hooks/useShiftSchedule';

import { 
  PayrollCalculationData, 
  DailyWorkRecord, 
  PayrollSummary, 
  PayrollSettings, 
  DEFAULT_PAYROLL_SETTINGS 
} from './types';

export class PayrollDataGenerator {
  private settings: PayrollSettings;

  constructor(settings: PayrollSettings = DEFAULT_PAYROLL_SETTINGS) {
    this.settings = settings;
  }

  /**
   * 스태프별 일별 급여 데이터 계산
   */
  calculateStaffPayroll(
    staffId: string,
    staffName: string,
    jobRole: string,
    workLogs: WorkLog[],
    eventId: string,
    eventName?: string
  ): PayrollCalculationData {
    if (workLogs.length === 0) {
      throw new Error('근무 기록이 없습니다.');
    }

    // 기간 계산
    const dates = workLogs.map(log => log.date).sort();
    const period = {
      type: 'daily' as const,
      start: dates[0],
      end: dates[dates.length - 1]
    };

    // 일별 기록 생성
    const dailyRecords: DailyWorkRecord[] = workLogs.map(log => ({
      date: log.date,
      scheduledStartTime: log.scheduledStartTime,
      scheduledEndTime: log.scheduledEndTime,
      actualStartTime: log.actualStartTime,
      actualEndTime: log.actualEndTime,
      workMinutes: log.totalWorkMinutes,
      breakMinutes: log.totalBreakMinutes,
      tableAssignments: log.tableAssignments || [],
      exceptions: [], // 예외 기능 제거
      status: this.determineWorkStatus(log)
    }));

    // 근무시간 집계
    const workTime = this.calculateWorkTime(dailyRecords);
    
    // 예외 상황 집계
    const exceptions = this.calculateExceptions(dailyRecords);
    
    // 급여 계산
    const baseRate = this.settings.baseRates[jobRole] || this.settings.baseRates['Dealer'];
    const payment = this.calculatePay(workTime, exceptions, baseRate);

    return {
      staffId,
      staffName,
      eventId,
      eventName,
      period,
      workTime,
      exceptions,
      payment,
      dailyRecords,
      calculatedAt: new Date().toISOString(),
      status: 'draft'
    };
  }

  /**
   * 월별 급여 요약 생성
   */
  generateMonthlySummary(
    year: number,
    month: number,
    payrollData: PayrollCalculationData[]
  ): PayrollSummary {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    return this.generateSummary('monthly', startDate, endDate, payrollData);
  }

  /**
   * 주별 급여 요약 생성
   */
  generateWeeklySummary(
    startDate: string,
    endDate: string,
    payrollData: PayrollCalculationData[]
  ): PayrollSummary {
    return this.generateSummary('weekly', startDate, endDate, payrollData);
  }

  /**
   * 급여 데이터를 CSV 형식으로 내보내기
   */
  exportToCSV(payrollData: PayrollCalculationData[]): string {
    const headers = [
      '스태프명',
      '이벤트',
      '기간',
      '정규근무시간',
      '초과근무시간',
      '총근무시간',
      '지각횟수',
      '조퇴횟수',
      '결근횟수',
      '초과근무횟수',
      '기본급여',
      '초과근무급여',
      '보너스',
      '차감액',
      '총급여',
      '상태'
    ];

    const rows = payrollData.map(data => [
      data.staffName,
      data.eventName || data.eventId,
      `${data.period.start} ~ ${data.period.end}`,
      data.workTime.regularHours.toFixed(2),
      data.workTime.overtimeHours.toFixed(2),
      data.workTime.totalHours.toFixed(2),
      data.exceptions.late.count,
      data.exceptions.earlyLeave.count,
      data.exceptions.absence.count,
      data.exceptions.overtime.count,
      data.payment.regularPay.toLocaleString(),
      data.payment.overtimePay.toLocaleString(),
      data.payment.bonusPay.toLocaleString(),
      data.payment.deduction.toLocaleString(),
      data.payment.totalPay.toLocaleString(),
      this.translateStatus(data.status)
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  // Private 헬퍼 메소드들
  private determineWorkStatus(log: WorkLog): 'scheduled' | 'completed' | 'absent' {
    // 실제 시간이 있으면 completed, 없으면 scheduled (absent 판단은 실제 시간 기준)
    if (log.actualStartTime || log.actualEndTime) return 'completed';
    return 'scheduled';
  }

  private calculateWorkTime(dailyRecords: DailyWorkRecord[]) {
    let totalWorkMinutes = 0;
    let totalBreakMinutes = 0;
    let overtimeMinutes = 0;

    dailyRecords.forEach(record => {
      if (record.status !== 'absent') {
        totalWorkMinutes += record.workMinutes;
        totalBreakMinutes += record.breakMinutes;

        // 정규 근무시간을 8시간으로 가정하고 초과근무 계산
        const dailyRegularMinutes = 8 * 60; // 8시간
        if (record.workMinutes > dailyRegularMinutes) {
          overtimeMinutes += record.workMinutes - dailyRegularMinutes;
        }
      }
    });

    const totalHours = totalWorkMinutes / 60;
    const overtimeHours = overtimeMinutes / 60;
    const regularHours = totalHours - overtimeHours;
    const breakHours = totalBreakMinutes / 60;

    return {
      regularHours: Math.max(0, regularHours),
      overtimeHours,
      totalHours,
      breakHours
    };
  }

  private calculateExceptions(dailyRecords: DailyWorkRecord[]) {
    // 예외 기능 제거 - 기본 구조만 유지하여 급여 계산이 정상 작동하도록 함
    const exceptionCounts = {
      late: { count: 0, totalMinutes: 0, deductionHours: 0 },
      earlyLeave: { count: 0, totalMinutes: 0, deductionHours: 0 },
      absence: { count: 0, deductionHours: 0 },
      overtime: { count: 0, totalMinutes: 0, bonusHours: 0 }
    };

    // 예외 처리 로직 제거 - 모든 값은 0으로 유지
    return exceptionCounts;
  }

  private calculatePay(
    workTime: any,
    exceptions: any,
    baseRate: number
  ) {
    const overtimeRate = baseRate * this.settings.overtimeMultiplier;
    
    const regularPay = workTime.regularHours * baseRate;
    const overtimePay = workTime.overtimeHours * overtimeRate;
    const bonusPay = exceptions.overtime.bonusHours * baseRate;
    
    const lateDeduction = exceptions.late.deductionHours * baseRate;
    const earlyLeaveDeduction = exceptions.earlyLeave.deductionHours * baseRate;
    const absenceDeduction = exceptions.absence.deductionHours * baseRate;
    const deduction = lateDeduction + earlyLeaveDeduction + absenceDeduction;
    
    const totalPay = regularPay + overtimePay + bonusPay - deduction;

    return {
      baseRate,
      overtimeRate,
      bonusRate: baseRate,
      regularPay,
      overtimePay,
      bonusPay,
      deduction,
      totalPay: Math.max(0, totalPay) // 음수 방지
    };
  }

  private generateSummary(
    type: 'weekly' | 'monthly',
    startDate: string,
    endDate: string,
    payrollData: PayrollCalculationData[]
  ): PayrollSummary {
    const totalStaff = payrollData.length;
    const totalWorkHours = payrollData.reduce((sum, data) => sum + data.workTime.totalHours, 0);
    const totalPay = payrollData.reduce((sum, data) => sum + data.payment.totalPay, 0);
    const averageWorkHours = totalStaff > 0 ? totalWorkHours / totalStaff : 0;
    const averagePay = totalStaff > 0 ? totalPay / totalStaff : 0;

    const exceptionSummary = {
      totalLate: payrollData.reduce((sum, data) => sum + data.exceptions.late.count, 0),
      totalEarlyLeave: payrollData.reduce((sum, data) => sum + data.exceptions.earlyLeave.count, 0),
      totalAbsence: payrollData.reduce((sum, data) => sum + data.exceptions.absence.count, 0),
      totalOvertime: payrollData.reduce((sum, data) => sum + data.exceptions.overtime.count, 0),
    };

    return {
      period: { type, start: startDate, end: endDate },
      totalStaff,
      totalHours: totalWorkHours,
      regularHours: payrollData.reduce((sum, data) => sum + data.workTime.regularHours, 0),
      overtimeHours: payrollData.reduce((sum, data) => sum + data.workTime.overtimeHours, 0),
      totalPay,
      basePay: payrollData.reduce((sum, data) => sum + data.payment.regularPay, 0),
      overtimePay: payrollData.reduce((sum, data) => sum + data.payment.overtimePay, 0),
      totalDeductions: payrollData.reduce((sum, data) => sum + data.payment.deduction, 0),
      totalExceptions: payrollData.reduce((sum, data) => sum + data.exceptions.late.count + data.exceptions.earlyLeave.count + data.exceptions.absence.count, 0),
      averageWorkHours,
      averagePay,
      exceptionSummary,
      staffSummaries: payrollData
    };
  }

  private extractMinutesFromDescription(description: string): number {
    const match = description.match(/(\d+)분/);
    return match ? parseInt(match[1]) : 0;
  }

  private translateStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'draft': '임시저장',
      'confirmed': '확정',
      'paid': '지급완료'
    };
    return statusMap[status] || status;
  }

  /**
   * 설정 업데이트
   */
  updateSettings(newSettings: Partial<PayrollSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * 현재 설정 반환
   */
  getSettings(): PayrollSettings {
    return { ...this.settings };
  }
}

// 싱글톤 인스턴스
export const payrollDataGenerator = new PayrollDataGenerator();