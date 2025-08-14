import { useCallback, useMemo } from 'react';
import { logger } from '../utils/logger';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { PayrollCalculation, PayrollSummary } from '../types/payroll';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import {
  calculateHourlyPay,
  calculateDailyPayFixed,
  calculateMonthlyPay,
  calculateCustomPay,
  calculateOvertimePay,
  getDaysInMonth
} from '../utils/simplePayrollCalculator';
import { useJobPostingContext } from '../contexts/JobPostingContextAdapter';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { calculateWorkHours as calculateHours } from '../utils/workLogMapper';

interface UseJobPostingPayrollProps {
  jobPostingId?: string;
  confirmedStaff?: ConfirmedStaff[];
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'other';
  salaryAmount?: string;
  startDate?: string;
  endDate?: string;
}

export const useJobPostingPayroll = ({
  jobPostingId,
  confirmedStaff = [],
  salaryType = 'hourly',
  salaryAmount,
  startDate,
  endDate
}: UseJobPostingPayrollProps) => {
  
  // 날짜 기본값 설정 (이번 달)
  const defaultStartDate = useMemo(() => {
    if (startDate) return startDate;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] || '';
  }, [startDate]);

  const defaultEndDate = useMemo(() => {
    if (endDate) return endDate;
    return new Date().toISOString().split('T')[0] || '';
  }, [endDate]);

  // 확정된 스태프의 ID 목록 - confirmedStaff의 length로만 의존성 체크
  const staffIds = useMemo(() => {
    return confirmedStaff.map(staff => staff.userId);
  }, [confirmedStaff.length]);

  // Context에서 WorkLogs 가져오기
  const { 
    workLogs, 
    workLogsLoading: loading, 
    workLogsError: error 
  } = useJobPostingContext();

  // 날짜 범위와 스태프 필터링된 WorkLogs
  const filteredWorkLogs = useMemo(() => {
    if (!workLogs || workLogs.length === 0) return [];
    
    // 스태프 ID 필터링
    let filtered = workLogs.filter(log => staffIds.includes(log.staffId));
    
    // 날짜 범위 필터링
    if (defaultStartDate) {
      filtered = filtered.filter(log => log.date >= defaultStartDate);
    }
    if (defaultEndDate) {
      filtered = filtered.filter(log => log.date <= defaultEndDate);
    }
    
    logger.info(`WorkLogs 필터링 완료: ${filtered.length}/${workLogs.length}건 (스태프: ${staffIds.length}명)`, {
      component: 'useJobPostingPayroll'
    });
    
    return filtered;
  }, [workLogs, staffIds, defaultStartDate, defaultEndDate]);

  // 역할별 급여 정보 가져오기
  const getRoleBasedRate = useCallback((role: string): number => {
    // JobPosting에 정의된 급여 정보 우선
    if (salaryAmount) {
      return parseFloat(salaryAmount);
    }

    // 역할별 기본 시급 사용
    const roleRates = DEFAULT_HOURLY_RATES || {};
    return roleRates[role] || roleRates['default'] || 15000;
  }, [salaryAmount]);

  // 급여 계산 로직 (UnifiedWorkLog 타입 사용)
  const calculatePayroll = useCallback((
    workLog: UnifiedWorkLog,
    type: string,
    amount: number
  ): number => {
    // 임시 변환 (기존 함수와의 호환성)
    const legacyWorkLog: any = {
      ...workLog,
      dealerId: workLog.staffId,
      dealerName: workLog.staffName
    };
    
    switch(type) {
      case 'hourly':
        return calculateHourlyPay(legacyWorkLog, amount);
      case 'daily':
        return calculateDailyPayFixed(legacyWorkLog, amount);
      case 'monthly':
        // 월급은 전체 workLogs가 필요하므로 별도 처리
        return 0;
      case 'other':
        return calculateCustomPay(legacyWorkLog, amount);
      default:
        return 0;
    }
  }, []);

  // PayrollCalculation 데이터 생성
  const processedPayrollData = useMemo(() => {
    const staffPayrollMap = new Map<string, PayrollCalculation>();

    // 스태프별로 그룹화
    confirmedStaff.forEach(staff => {
      const staffWorkLogs = filteredWorkLogs.filter(log => log.staffId === staff.userId);
      
      if (staffWorkLogs.length === 0) {
        return;
      }

      const baseRate = getRoleBasedRate(staff.role);
      let totalAmount = 0;
      let totalHours = 0;
      let totalDays = 0;

      // 급여 타입별 계산
      if (salaryType === 'monthly') {
        // 월급 계산 (전체 근무일 기준)
        const year = new Date(defaultStartDate).getFullYear();
        const month = new Date(defaultStartDate).getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        
        // 레거시 형식으로 변환
        const legacyWorkLogs = staffWorkLogs.map(log => ({
          ...log,
          dealerId: log.staffId,
          dealerName: log.staffName
        }));
        
        totalAmount = calculateMonthlyPay(legacyWorkLogs as any, baseRate, daysInMonth);
        totalDays = staffWorkLogs.filter(log => 
          log.status === 'completed' || log.actualEndTime
        ).length;
      } else {
        // 일별 계산
        staffWorkLogs.forEach(log => {
          const pay = calculatePayroll(log, salaryType, baseRate);
          totalAmount += pay;
          
          if (log.status === 'completed' || log.actualEndTime) {
            totalDays++;
            totalHours += calculateHours(log);
          }
        });
      }

      // 초과 근무 수당 계산 (시급제일 경우만)
      let overtimePay = 0;
      if (salaryType === 'hourly') {
        staffWorkLogs.forEach(log => {
          const legacyLog = { ...log, dealerId: log.staffId, dealerName: log.staffName };
          overtimePay += calculateOvertimePay(legacyLog as any);
        });
      }

      const payrollCalc: PayrollCalculation = {
        staffId: staff.userId,
        staffName: staff.name,
        role: staff.role,
        workLogs: staffWorkLogs as any[], // 타입 호환성
        totalHours: Math.round(totalHours * 100) / 100,
        totalDays,
        salaryType,
        baseRate,
        regularPay: totalAmount,
        ...(overtimePay > 0 && { overtimePay }),
        totalAmount: totalAmount + overtimePay,
        period: {
          start: defaultStartDate,
          end: defaultEndDate
        }
      };

      staffPayrollMap.set(staff.userId, payrollCalc);
    });

    return Array.from(staffPayrollMap.values());
  }, [filteredWorkLogs, confirmedStaff, salaryType, getRoleBasedRate, calculatePayroll, defaultStartDate, defaultEndDate]);

  // 요약 정보 계산
  const summary: PayrollSummary = useMemo(() => {
    const byRole: PayrollSummary['byRole'] = {};
    const bySalaryType: PayrollSummary['bySalaryType'] = {
      hourly: 0,
      daily: 0,
      monthly: 0,
      other: 0
    };

    let totalHours = 0;
    let totalDays = 0;
    let totalAmount = 0;

    processedPayrollData.forEach(data => {
      totalHours += data.totalHours;
      totalDays += data.totalDays;
      totalAmount += data.totalAmount;

      // 역할별 집계
      if (!byRole[data.role]) {
        byRole[data.role] = {
          count: 0,
          hours: 0,
          amount: 0
        };
      }
      const roleData = byRole[data.role];
      if (roleData) {
        roleData.count++;
        roleData.hours += data.totalHours;
        roleData.amount += data.totalAmount;
      }

      // 급여 타입별 집계
      if (data.salaryType in bySalaryType) {
        bySalaryType[data.salaryType as keyof typeof bySalaryType] += data.totalAmount;
      }
    });

    return {
      totalStaff: processedPayrollData.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays,
      totalAmount,
      byRole,
      bySalaryType,
      period: {
        start: defaultStartDate,
        end: defaultEndDate
      }
    };
  }, [processedPayrollData, defaultStartDate, defaultEndDate]);

  // CSV 내보내기
  const exportToCSV = useCallback(() => {
    const headers = ['스태프명', '역할', '근무일수', '총 근무시간', '급여유형', '기본급여', '초과수당', '총 지급액'];
    
    const rows = processedPayrollData.map(data => [
      data.staffName,
      data.role,
      data.totalDays.toString(),
      data.totalHours.toFixed(2),
      data.salaryType,
      data.regularPay.toLocaleString(),
      (data.overtimePay || 0).toLocaleString(),
      data.totalAmount.toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // BOM 추가 (한글 인코딩)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const fileName = `정산_${jobPostingId}_${defaultStartDate}_${defaultEndDate}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.info(`CSV 내보내기 완료: ${fileName}`, {
      component: 'useJobPostingPayroll'
    });
  }, [processedPayrollData, jobPostingId, defaultStartDate, defaultEndDate]);

  // 급여 유형 변경 시 재계산
  const calculateByType = useCallback((newType: 'hourly' | 'daily' | 'monthly' | 'other') => {
    // 급여 유형이 변경되면 재계산이 필요
    // 이는 PayrollManagementTab에서 처리
    logger.info(`급여 유형 변경: ${salaryType} → ${newType}`, {
      component: 'useJobPostingPayroll'
    });
  }, [salaryType]);

  return {
    payrollData: processedPayrollData,
    summary,
    loading,
    error,
    exportToCSV,
    calculateByType,
    workLogs: filteredWorkLogs,
    period: {
      start: defaultStartDate,
      end: defaultEndDate
    }
  };
};