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
    
    // EnhancedPayroll 데이터 처리 시작
    
    // staffId + role 조합으로 그룹화
    const staffRoleMap = new Map<string, {
      staffId: string;
      staffName: string;
      role: string;
      workLogs: UnifiedWorkLog[];
    }>();
    
    // confirmedStaff에서 같은 사람의 다른 역할 확인
    const staffRoleCount: Record<string, Set<string>> = {};
    confirmedStaff.forEach(staff => {
      if (!staffRoleCount[staff.userId]) {
        staffRoleCount[staff.userId] = new Set();
      }
      const roleSet = staffRoleCount[staff.userId];
      if (roleSet) {
        roleSet.add(staff.role);
      }
    });
    
    // 스태프별 역할 분포 처리 완료
    
    // confirmedStaff 기반으로 역할별 workLog 생성
    // (실제 workLog에 역할 정보가 없을 수 있으므로)
    const roleBasedWorkLogs: UnifiedWorkLog[] = [];
    
    confirmedStaff.forEach(staff => {
      // 해당 스태프의 모든 workLog 찾기
      const staffWorkLogs = filteredWorkLogs.filter(log => log.staffId === staff.userId);
      
      staffWorkLogs.forEach(log => {
        // workLog에 이미 role이 있으면 그대로 사용
        if ((log as any).role) {
          roleBasedWorkLogs.push(log);
        } else {
          // role이 없으면 staff의 role을 추가한 새 객체 생성
          roleBasedWorkLogs.push({
            ...log,
            role: staff.role
          } as UnifiedWorkLog);
        }
      });
    });
    
    // 역할 기반 workLogs 생성 완료
    
    // 역할 기반 workLogs를 staffId + role로 그룹화
    roleBasedWorkLogs.forEach((log, index) => {
      // workLog에 role이 있으면 우선 사용
      let role = (log as any).role;
      let staffName = (log as any).staffName || '';
      
      // workLog에 role이 없으면 confirmedStaff에서 찾기
      if (!role) {
        // 날짜가 일치하는 staff 찾기 (같은 사람이 다른 날짜/역할로 등록될 수 있음)
        const matchingStaff = confirmedStaff.find(s => 
          s.userId === log.staffId && 
          (!s.date || s.date === log.date)
        );
        
        if (matchingStaff) {
          role = matchingStaff.role;
          staffName = matchingStaff.name;
        } else {
          // 날짜 무관하게 첫 번째 매칭 찾기
          const anyStaff = confirmedStaff.find(s => s.userId === log.staffId);
          if (anyStaff) {
            role = anyStaff.role;
            staffName = anyStaff.name;
          } else {
            // WorkLog 매칭 staff 없음
            return;
          }
        }
      }
      
      // confirmedStaff에서 이름 가져오기 (role은 workLog에서 왔을 수 있으므로)
      if (!staffName) {
        const staff = confirmedStaff.find(s => s.userId === log.staffId);
        if (staff) {
          staffName = staff.name;
        }
      }
      
      const key = `${log.staffId}_${role}`;
      
      // WorkLog 처리
      
      if (!staffRoleMap.has(key)) {
        staffRoleMap.set(key, {
          staffId: log.staffId,
          staffName: staffName,
          role: role,
          workLogs: []
        });
      }
      
      const entry = staffRoleMap.get(key);
      if (entry) {
        entry.workLogs.push(log);
      }
    });
    
    // 그룹화 결과 처리 완료
    
    // 각 staffId + role 조합에 대해 EnhancedPayrollCalculation 생성
    const results: EnhancedPayrollCalculation[] = [];
    
    staffRoleMap.forEach((data, key) => {
      // 근무 정보 계산
      let totalHours = 0;
      let totalDays = 0;
      
      data.workLogs.forEach(log => {
        if (log.status === 'completed' || log.actualEndTime) {
          totalDays++;
          totalHours += calculateHours(log);
        }
      });
      
      // 급여 정보 가져오기
      const { salaryType, salaryAmount } = getSalaryInfo(data.role);
      
      // 기본급 계산
      const basePay = calculateBasePay(
        data.workLogs,
        salaryType,
        salaryAmount,
        totalHours,
        totalDays
      );
      
      // 수당 정보 (개별 오버라이드가 있으면 사용, 없으면 기본값)
      // key를 사용하여 역할별로 다른 수당 설정 가능
      const allowances = staffAllowanceOverrides[key] || staffAllowanceOverrides[data.staffId] || defaultAllowances;
      
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
        staffId: data.staffId,
        staffName: data.staffName,
        role: data.role,
        workLogs: data.workLogs, // 타입 변환 제거
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
      
      results.push(result);
    });
    
    // 이름과 역할로 정렬
    return results.sort((a, b) => {
      const nameCompare = a.staffName.localeCompare(b.staffName);
      if (nameCompare !== 0) return nameCompare;
      return a.role.localeCompare(b.role);
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
      setSelectedStaffIds(processedPayrollData.map(d => `${d.staffId}_${d.role}`));
    }
  }, [selectedStaffIds, processedPayrollData]);

  // 일괄 수당 적용
  const applyBulkAllowances = useCallback((settings: BulkAllowanceSettings) => {
    let targetKeys: string[] = [];
    
    switch(settings.applyTo) {
      case 'all':
        targetKeys = processedPayrollData.map(d => `${d.staffId}_${d.role}`);
        break;
      case 'selected':
        targetKeys = selectedStaffIds;
        break;
      case 'byRole':
        targetKeys = processedPayrollData
          .filter(d => settings.targetRoles?.includes(d.role))
          .map(d => `${d.staffId}_${d.role}`);
        break;
    }
    
    const newOverrides: Record<string, EnhancedPayrollCalculation['allowances']> = {};
    
    targetKeys.forEach(key => {
      const parts = key.split('_');
      if (parts.length < 2) return;
      
      const staffId = parts[0];
      const role = parts.slice(1).join('_'); // role 이름에 underscore가 있을 수 있음
      
      const currentStaff = processedPayrollData.find(d => d.staffId === staffId && d.role === role);
      if (!currentStaff) return;
      
      const currentAllowances = staffAllowanceOverrides[key] || (staffId ? staffAllowanceOverrides[staffId] : undefined) || currentStaff.allowances;
      
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
      
      newOverrides[key] = newAllowances;
    });
    
    setStaffAllowanceOverrides(prev => ({
      ...prev,
      ...newOverrides
    }));
  }, [processedPayrollData, selectedStaffIds, staffAllowanceOverrides]);

  // 개별 수당 수정
  const updateStaffAllowances = useCallback((
    key: string, // staffId_role 형식
    allowances: EnhancedPayrollCalculation['allowances']
  ) => {
    setStaffAllowanceOverrides(prev => ({
      ...prev,
      [key]: allowances
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