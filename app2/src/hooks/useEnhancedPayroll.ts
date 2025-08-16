import { useCallback, useMemo, useState } from 'react';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { EnhancedPayrollCalculation, BulkAllowanceSettings, PayrollSummary } from '../types/payroll';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import { useJobPostingContext } from '../contexts/JobPostingContextAdapter';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { calculateWorkHours as calculateHours } from '../utils/workLogMapper';
import { JobPosting } from '../types/jobPosting';

interface UseEnhancedPayrollProps {
  jobPostingId?: string;
  jobPosting?: JobPosting | null;
  confirmedStaff?: ConfirmedStaff[];
  startDate?: string;
  endDate?: string;
}

export const useEnhancedPayroll = ({
  jobPostingId,
  jobPosting,
  confirmedStaff = [],
  startDate,
  endDate
}: UseEnhancedPayrollProps) => {
  
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

  // 확정된 스태프의 ID 목록
  const staffIds = useMemo(() => {
    return confirmedStaff.map(staff => staff.userId);
  }, [confirmedStaff]);

  // Context에서 WorkLogs 가져오기
  const { 
    workLogs, 
    workLogsLoading: loading, 
    workLogsError: error 
  } = useJobPostingContext();

  // 선택된 스태프 관리
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  
  // 개별 수당 오버라이드 저장
  const [staffAllowanceOverrides, setStaffAllowanceOverrides] = useState<
    Record<string, EnhancedPayrollCalculation['allowances']>
  >({});

  // 날짜 범위와 스태프 필터링된 WorkLogs
  const filteredWorkLogs = useMemo(() => {
    if (!workLogs || workLogs.length === 0) return [];
    
    let filtered = workLogs.filter(log => staffIds.includes(log.staffId));
    
    if (defaultStartDate) {
      filtered = filtered.filter(log => log.date >= defaultStartDate);
    }
    if (defaultEndDate) {
      filtered = filtered.filter(log => log.date <= defaultEndDate);
    }
    
    return filtered;
  }, [workLogs, staffIds, defaultStartDate, defaultEndDate]);

  // 급여 정보 가져오기 (공고에서 자동 로드)
  const getSalaryInfo = useCallback((role: string) => {
    // JobPosting에 정의된 급여 정보 우선 사용
    const salaryType = jobPosting?.salaryType || 'hourly';
    const salaryAmount = jobPosting?.salaryAmount ? 
      parseFloat(jobPosting.salaryAmount) : 
      (DEFAULT_HOURLY_RATES[role] || DEFAULT_HOURLY_RATES['default'] || 15000);
    
    return { salaryType, salaryAmount };
  }, [jobPosting]);

  // 기본 급여 계산
  const calculateBasePay = useCallback((
    workLogs: UnifiedWorkLog[],
    salaryType: string,
    salaryAmount: number,
    totalHours: number,
    totalDays: number
  ): number => {
    switch(salaryType) {
      case 'hourly':
        return Math.round(totalHours * salaryAmount);
      case 'daily':
        return Math.round(totalDays * salaryAmount);
      case 'monthly':
        // 월급은 고정
        return salaryAmount;
      case 'other':
        // 기타는 커스텀 계산
        return Math.round(totalDays * salaryAmount);
      default:
        return 0;
    }
  }, []);

  // 기본 수당 가져오기 (공고의 benefits에서)
  const getDefaultAllowances = useCallback((): EnhancedPayrollCalculation['allowances'] => {
    const benefits = jobPosting?.benefits;
    const allowances: EnhancedPayrollCalculation['allowances'] = {
      meal: benefits?.mealAllowance ? parseInt(benefits.mealAllowance) : 0,
      transportation: benefits?.transportation ? parseInt(benefits.transportation) : 0,
      accommodation: benefits?.accommodation ? parseInt(benefits.accommodation) : 0,
      bonus: 0,
      other: 0
    };
    
    // otherDescription은 필요시에만 추가
    return allowances;
  }, [jobPosting]);

  // EnhancedPayrollCalculation 데이터 생성
  const processedPayrollData = useMemo((): EnhancedPayrollCalculation[] => {
    const defaultAllowances = getDefaultAllowances();
    
    return confirmedStaff.map(staff => {
      const staffWorkLogs = filteredWorkLogs.filter(log => log.staffId === staff.userId);
      
      // 근무 정보 계산
      let totalHours = 0;
      let totalDays = 0;
      
      staffWorkLogs.forEach(log => {
        if (log.status === 'completed' || log.actualEndTime) {
          totalDays++;
          totalHours += calculateHours(log);
        }
      });
      
      // 급여 정보 가져오기
      const { salaryType, salaryAmount } = getSalaryInfo(staff.role);
      
      // 기본급 계산
      const basePay = calculateBasePay(
        staffWorkLogs,
        salaryType,
        salaryAmount,
        totalHours,
        totalDays
      );
      
      // 수당 정보 (개별 오버라이드가 있으면 사용, 없으면 기본값)
      const allowances = staffAllowanceOverrides[staff.userId] || defaultAllowances;
      
      // 수당 합계
      const allowanceTotal = 
        allowances.meal +
        allowances.transportation +
        allowances.accommodation +
        allowances.bonus +
        allowances.other;
      
      // 총액
      const totalAmount = basePay + allowanceTotal;
      
      const result: EnhancedPayrollCalculation = {
        staffId: staff.userId,
        staffName: staff.name,
        role: staff.role,
        workLogs: staffWorkLogs as any[], // 타입 호환성
        totalHours: Math.round(totalHours * 100) / 100,
        totalDays,
        salaryType: salaryType as any,
        baseSalary: salaryAmount,
        allowances,
        basePay,
        allowanceTotal,
        totalAmount,
        period: {
          start: defaultStartDate,
          end: defaultEndDate
        }
      };
      
      return result;
    });
  }, [
    confirmedStaff,
    filteredWorkLogs,
    getSalaryInfo,
    calculateBasePay,
    getDefaultAllowances,
    staffAllowanceOverrides,
    defaultStartDate,
    defaultEndDate
  ]);

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

  // 스태프 선택 토글
  const toggleStaffSelection = useCallback((staffId: string) => {
    setSelectedStaffIds(prev => {
      if (prev.includes(staffId)) {
        return prev.filter(id => id !== staffId);
      }
      return [...prev, staffId];
    });
  }, []);

  // 전체 선택/해제
  const toggleSelectAll = useCallback(() => {
    if (selectedStaffIds.length === processedPayrollData.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(processedPayrollData.map(d => d.staffId));
    }
  }, [selectedStaffIds, processedPayrollData]);

  // 일괄 수당 적용
  const applyBulkAllowances = useCallback((settings: BulkAllowanceSettings) => {
    let targetStaffIds: string[] = [];
    
    switch(settings.applyTo) {
      case 'all':
        targetStaffIds = processedPayrollData.map(d => d.staffId);
        break;
      case 'selected':
        targetStaffIds = selectedStaffIds;
        break;
      case 'byRole':
        targetStaffIds = processedPayrollData
          .filter(d => settings.targetRoles?.includes(d.role))
          .map(d => d.staffId);
        break;
    }
    
    const newOverrides: Record<string, EnhancedPayrollCalculation['allowances']> = {};
    
    targetStaffIds.forEach(staffId => {
      const currentStaff = processedPayrollData.find(d => d.staffId === staffId);
      if (!currentStaff) return;
      
      const currentAllowances = staffAllowanceOverrides[staffId] || currentStaff.allowances;
      
      const newAllowances: EnhancedPayrollCalculation['allowances'] = {
        meal: settings.allowances.meal?.enabled ? settings.allowances.meal.amount : currentAllowances.meal,
        transportation: settings.allowances.transportation?.enabled ? settings.allowances.transportation.amount : currentAllowances.transportation,
        accommodation: settings.allowances.accommodation?.enabled ? settings.allowances.accommodation.amount : currentAllowances.accommodation,
        bonus: settings.allowances.bonus?.enabled ? settings.allowances.bonus.amount : currentAllowances.bonus,
        other: settings.allowances.other?.enabled ? settings.allowances.other.amount : currentAllowances.other
      };
      
      // otherDescription을 조건부로 추가
      const otherDesc = settings.allowances.other?.description || currentAllowances.otherDescription;
      if (otherDesc) {
        newAllowances.otherDescription = otherDesc;
      }
      
      newOverrides[staffId] = newAllowances;
    });
    
    setStaffAllowanceOverrides(prev => ({
      ...prev,
      ...newOverrides
    }));
  }, [processedPayrollData, selectedStaffIds, staffAllowanceOverrides]);

  // 개별 수당 수정
  const updateStaffAllowances = useCallback((
    staffId: string, 
    allowances: EnhancedPayrollCalculation['allowances']
  ) => {
    setStaffAllowanceOverrides(prev => ({
      ...prev,
      [staffId]: allowances
    }));
  }, []);

  // CSV 내보내기
  const exportToCSV = useCallback(() => {
    const headers = [
      '스태프명', 
      '역할', 
      '근무일수', 
      '총 근무시간', 
      '급여유형', 
      '기본급여',
      '식비',
      '교통비',
      '숙소비',
      '보너스',
      '기타',
      '수당합계',
      '총 지급액'
    ];
    
    const rows = processedPayrollData.map(data => [
      data.staffName,
      data.role,
      data.totalDays.toString(),
      data.totalHours.toFixed(2),
      data.salaryType,
      data.basePay.toLocaleString(),
      data.allowances.meal.toLocaleString(),
      data.allowances.transportation.toLocaleString(),
      data.allowances.accommodation.toLocaleString(),
      data.allowances.bonus.toLocaleString(),
      data.allowances.other.toLocaleString(),
      data.allowanceTotal.toLocaleString(),
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
  }, [processedPayrollData, jobPostingId, defaultStartDate, defaultEndDate]);

  // 사용 가능한 역할 목록
  const availableRoles = useMemo(() => {
    return Array.from(new Set(processedPayrollData.map(d => d.role)));
  }, [processedPayrollData]);

  return {
    payrollData: processedPayrollData,
    summary,
    loading,
    error,
    selectedStaffIds,
    toggleStaffSelection,
    toggleSelectAll,
    applyBulkAllowances,
    updateStaffAllowances,
    exportToCSV,
    availableRoles,
    workLogs: filteredWorkLogs,
    period: {
      start: defaultStartDate,
      end: defaultEndDate
    }
  };
};