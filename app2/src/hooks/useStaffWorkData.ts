import { useMemo, useCallback, useState } from 'react';
import { useUnifiedWorkLogs } from './useUnifiedWorkLogs';
import { useJobPostingContext } from '../contexts/JobPostingContextAdapter';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { EnhancedPayrollCalculation, BulkAllowanceSettings, PayrollSummary, RoleSalaryConfig, RolePayrollInfo } from '../types/payroll';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import { calculateWorkHours } from '../utils/workLogMapper';
import { logger } from '../utils/logger';

interface StaffWorkDataItem extends EnhancedPayrollCalculation {
  // 추가 필드
  uniqueKey: string; // staffId만 사용
  staffData: ConfirmedStaff;
}

interface UseStaffWorkDataProps {
  eventId?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

interface UseStaffWorkDataReturn {
  // 통합 데이터
  staffWorkData: StaffWorkDataItem[];
  workLogs: UnifiedWorkLog[];
  
  // 계산된 값
  summary: PayrollSummary;
  availableRoles: string[];
  
  // 상태
  loading: boolean;
  error: Error | null;
  
  // 선택 관리
  selectedStaffIds: string[];
  toggleStaffSelection: (staffId: string) => void;
  toggleSelectAll: () => void;
  
  // 액션
  applyBulkAllowances: (settings: BulkAllowanceSettings) => void;
  updateStaffAllowances: (staffId: string, allowances: EnhancedPayrollCalculation['allowances']) => void;
  updateRoleSalarySettings: (settings: RoleSalaryConfig) => void;
  exportToCSV: () => void;
  
  // 유틸리티
  calculateBasePay: (workLogs: UnifiedWorkLog[], salaryType: string, salaryAmount: number, totalHours: number, totalDays: number) => number;
  getSalaryInfo: (role: string) => { salaryType: string; salaryAmount: number };
}

export const useStaffWorkData = ({
  eventId,
  startDate,
  endDate
}: UseStaffWorkDataProps = {}): UseStaffWorkDataReturn => {
  
  // Context에서 데이터 가져오기
  const { jobPosting, workLogs: contextWorkLogs } = useJobPostingContext();
  const confirmedStaff = jobPosting?.confirmedStaff || [];
  
  // 실시간 WorkLogs 구독 (Context의 workLogs가 없으면 직접 구독)
  const { 
    workLogs: directWorkLogs, 
    loading: workLogsLoading, 
    error: workLogsError 
  } = useUnifiedWorkLogs({
    filter: { eventId: eventId || jobPosting?.id },
    realtime: true,
    autoNormalize: true
  });
  
  // WorkLogs 선택 (Context 우선, 없으면 직접 구독)
  const workLogs = contextWorkLogs?.length > 0 ? contextWorkLogs : directWorkLogs;
  
  // 상태 관리
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffAllowanceOverrides, setStaffAllowanceOverrides] = useState<Record<string, EnhancedPayrollCalculation['allowances']>>({});
  const [roleSalaryOverrides, setRoleSalaryOverrides] = useState<RoleSalaryConfig>({});
  
  // 날짜 필터링된 WorkLogs
  const filteredWorkLogs = useMemo(() => {
    let filtered = [...workLogs];
    
    if (startDate) {
      filtered = filtered.filter(log => log.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(log => log.date <= endDate);
    }
    
    return filtered;
  }, [workLogs, startDate, endDate]);
  
  // 역할별 급여 정보 가져오기
  const getSalaryInfo = useCallback((role: string) => {
    // 오버라이드 설정 우선
    const override = roleSalaryOverrides[role];
    if (override) {
      return {
        salaryType: override.salaryType,
        salaryAmount: override.salaryAmount
      };
    }
    
    // 공고의 역할별 급여 설정
    if (jobPosting?.useRoleSalary && jobPosting.roleSalaries?.[role]) {
      const roleSalary = jobPosting.roleSalaries[role];
      if (roleSalary) {
        return {
          salaryType: roleSalary.salaryType === 'negotiable' ? 'other' : roleSalary.salaryType,
          salaryAmount: parseFloat(roleSalary.salaryAmount) || 0
        };
      }
    }
    
    // 기본 급여 설정
    const baseSalaryType = jobPosting?.salaryType || 'hourly';
    const salaryType = baseSalaryType === 'negotiable' ? 'other' : baseSalaryType;
    const salaryAmount = jobPosting?.salaryAmount ? 
      parseFloat(jobPosting.salaryAmount) : 
      (DEFAULT_HOURLY_RATES[role] || DEFAULT_HOURLY_RATES['default'] || 15000);
    
    return { salaryType, salaryAmount };
  }, [jobPosting, roleSalaryOverrides]);
  
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
        return salaryAmount;
      case 'other':
        return Math.round(totalDays * salaryAmount);
      default:
        return 0;
    }
  }, []);
  
  // 기본 수당 가져오기
  const getDefaultAllowances = useCallback((): EnhancedPayrollCalculation['allowances'] => {
    const benefits = jobPosting?.benefits;
    return {
      meal: benefits?.mealAllowance ? (parseInt(benefits.mealAllowance) || 0) : 0,
      transportation: benefits?.transportation ? (parseInt(benefits.transportation) || 0) : 0,
      accommodation: benefits?.accommodation ? (parseInt(benefits.accommodation) || 0) : 0,
      bonus: 0,
      other: 0
    };
  }, [jobPosting]);
  
  // 통합 데이터 생성 (핵심 로직)
  const staffWorkData = useMemo((): StaffWorkDataItem[] => {
    const defaultAllowances = getDefaultAllowances();
    const result: StaffWorkDataItem[] = [];
    
    logger.debug('useStaffWorkData - 데이터 생성 시작', {
      component: 'useStaffWorkData',
      data: {
        confirmedStaffCount: confirmedStaff.length,
        workLogsCount: filteredWorkLogs.length
      }
    });
    
    // 먼저 스태프별로 고유한 ID 집합 생성 (중복 제거)
    const uniqueStaffMap = new Map<string, any>();
    confirmedStaff.forEach((staff: any) => {
      if (!uniqueStaffMap.has(staff.userId)) {
        uniqueStaffMap.set(staff.userId, staff);
      }
    });
    
    // 고유한 스태프들에 대해서만 처리
    uniqueStaffMap.forEach((staff: any) => {
      // 해당 스태프의 WorkLogs 필터링
      const staffWorkLogs = filteredWorkLogs.filter(log => log.staffId === staff.userId);
      
      // 역할별로 WorkLogs 그룹화
      const roleWorkLogsMap = new Map<string, UnifiedWorkLog[]>();
      const rolesSet = new Set<string>();
      
      // WorkLog에 역할 정보가 있으면 사용, 없으면 staff의 role 사용
      staffWorkLogs.forEach(log => {
        const role = log.role || staff.role || 'default';
        rolesSet.add(role);
        if (!roleWorkLogsMap.has(role)) {
          roleWorkLogsMap.set(role, []);
        }
        roleWorkLogsMap.get(role)?.push(log);
      });
      
      // 역할이 없는 경우 staff.role로 빈 배열 추가
      if (roleWorkLogsMap.size === 0 && staff.role) {
        rolesSet.add(staff.role);
        roleWorkLogsMap.set(staff.role, []);
      }
      
      // 모든 역할 배열
      const allRoles = Array.from(rolesSet);
      const primaryRole = allRoles[0] || 'default';
      const uniqueKey = staff.userId; // staffId만 사용
      
      // 역할별 급여 계산
      const rolePayrollInfo = new Map<string, RolePayrollInfo>();
      let totalBasePay = 0;
      let totalHours = 0;
      const uniqueDates = new Set<string>();
      const allWorkLogs: UnifiedWorkLog[] = [];
      
      // 각 역할별로 급여 계산
      roleWorkLogsMap.forEach((roleWorkLogs, role) => {
        let roleHours = 0;
        const roleUniqueDates = new Set<string>();
        
        roleWorkLogs.forEach(log => {
          const hours = calculateWorkHours(log);
          roleHours += hours;
          totalHours += hours;
          if (log.date) {
            roleUniqueDates.add(log.date);
            uniqueDates.add(log.date);
          }
          allWorkLogs.push(log);
        });
        
        const roleDays = roleUniqueDates.size || 0;
        
        // 역할별 급여 정보
        const { salaryType, salaryAmount } = getSalaryInfo(role);
        
        // 역할별 기본급 계산
        const roleBasePay = calculateBasePay(roleWorkLogs, salaryType, salaryAmount, roleHours, roleDays);
        
        // 역할별 정보 저장
        rolePayrollInfo.set(role, {
          role,
          workLogs: roleWorkLogs,
          totalHours: roleHours,
          totalDays: roleDays,
          salaryType,
          salaryAmount,
          basePay: roleBasePay
        });
        
        totalBasePay += roleBasePay;
      });
      
      const totalDays = uniqueDates.size || 0;
      
      // 호환성을 위한 주요 역할 정보 (첫 번째 역할 또는 가장 많은 시간을 일한 역할)
      let mainRoleInfo = rolePayrollInfo.get(primaryRole);
      if (!mainRoleInfo && rolePayrollInfo.size > 0) {
        // 가장 많은 시간을 일한 역할 찾기
        let maxHours = 0;
        rolePayrollInfo.forEach((info) => {
          if (info.totalHours > maxHours) {
            maxHours = info.totalHours;
            mainRoleInfo = info;
          }
        });
      }
      
      const { salaryType, salaryAmount } = mainRoleInfo || getSalaryInfo(primaryRole);
      
      // 수당 (오버라이드 또는 기본값)
      const allowances = staffAllowanceOverrides[uniqueKey] || defaultAllowances;
      const totalAllowances = Object.entries(allowances).reduce((sum, [key, val]) => {
        if (key !== 'otherDescription' && typeof val === 'number') {
          return sum + val;
        }
        return sum;
      }, 0);
      
      // 총 급여 (역할별 기본급 합계 + 수당)
      const totalPay = totalBasePay + totalAllowances;
      
      // 데이터 생성 (모든 역할 통합)
      const item: StaffWorkDataItem = {
        uniqueKey,
        staffId: staff.userId,
        staffName: staff.name || '이름 미정',
        role: primaryRole,  // 기존 호환성 유지
        roles: allRoles,    // 모든 역할 배열
        salaryType,
        baseSalary: salaryAmount,
        totalHours,
        totalDays,
        basePay: totalBasePay,  // 역할별 기본급 합계 사용
        allowances,
        allowanceTotal: totalAllowances,
        totalAmount: totalPay,
        workLogs: allWorkLogs.sort((a, b) => a.date.localeCompare(b.date)),
        staffData: staff,
        period: {
          start: startDate || '',
          end: endDate || ''
        },
        // 역할별 급여 정보 추가
        ...(rolePayrollInfo.size > 0 && {
          rolePayrollInfo: rolePayrollInfo,
          totalBasePay: totalBasePay
        })
      };
      
      result.push(item);
    });
    
    logger.debug('useStaffWorkData - 데이터 생성 완료', {
      component: 'useStaffWorkData',
      data: {
        resultCount: result.length,
        roles: Array.from(new Set(result.map(item => item.role)))
      }
    });
    
    return result;
  }, [confirmedStaff, filteredWorkLogs, getSalaryInfo, calculateBasePay, getDefaultAllowances, staffAllowanceOverrides]);
  
  // 사용 가능한 역할 목록
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    staffWorkData.forEach(item => {
      if (item.role) roles.add(item.role);
    });
    return Array.from(roles);
  }, [staffWorkData]);
  
  // 요약 정보 계산
  const summary = useMemo((): PayrollSummary => {
    // 개인별 중복 제거를 위한 Map
    const staffTotals = new Map<string, number>();
    
    staffWorkData.forEach(item => {
      const current = staffTotals.get(item.staffId) || 0;
      staffTotals.set(item.staffId, current + item.totalAmount);
    });
    
    const totalAmount = Array.from(staffTotals.values()).reduce((sum, amount) => sum + amount, 0);
    
    return {
      totalStaff: staffTotals.size, // 중복 제거된 인원수
      totalAmount,
      totalHours: staffWorkData.reduce((sum, item) => sum + item.totalHours, 0),
      totalDays: Math.max(...staffWorkData.map(item => item.totalDays), 0),
      byRole: {},
      bySalaryType: {
        hourly: 0,
        daily: 0,
        monthly: 0,
        other: 0
      },
      period: {
        start: startDate || '',
        end: endDate || ''
      }
    };
  }, [staffWorkData]);
  
  // 스태프 선택 토글
  const toggleStaffSelection = useCallback((uniqueKey: string) => {
    setSelectedStaffIds(prev => {
      if (prev.includes(uniqueKey)) {
        return prev.filter(id => id !== uniqueKey);
      }
      return [...prev, uniqueKey];
    });
  }, []);
  
  // 전체 선택 토글
  const toggleSelectAll = useCallback(() => {
    if (selectedStaffIds.length === staffWorkData.length) {
      setSelectedStaffIds([]);
    } else {
      setSelectedStaffIds(staffWorkData.map(item => item.uniqueKey));
    }
  }, [selectedStaffIds, staffWorkData]);
  
  // 일괄 수당 적용
  const applyBulkAllowances = useCallback((settings: BulkAllowanceSettings) => {
    const updates: Record<string, EnhancedPayrollCalculation['allowances']> = {};
    
    staffWorkData.forEach(item => {
      // 역할 필터 적용
      if (settings.targetRoles && settings.targetRoles.length > 0 && !settings.targetRoles.includes(item.role)) {
        return;
      }
      
      // 선택된 스태프만 적용
      if (selectedStaffIds.length > 0 && !selectedStaffIds.includes(item.uniqueKey)) {
        return;
      }
      
      // BulkAllowanceSettings의 allowances를 변환
      const convertedAllowances: EnhancedPayrollCalculation['allowances'] = {
        meal: settings.allowances.meal?.enabled ? settings.allowances.meal.amount : 0,
        transportation: settings.allowances.transportation?.enabled ? settings.allowances.transportation.amount : 0,
        accommodation: settings.allowances.accommodation?.enabled ? settings.allowances.accommodation.amount : 0,
        bonus: settings.allowances.bonus?.enabled ? settings.allowances.bonus.amount : 0,
        other: settings.allowances.other?.enabled ? settings.allowances.other.amount : 0
      };
      
      // otherDescription은 선택적으로 추가
      if (settings.allowances.other?.description) {
        convertedAllowances.otherDescription = settings.allowances.other.description;
      }
      updates[item.uniqueKey] = convertedAllowances;
    });
    
    setStaffAllowanceOverrides(prev => ({ ...prev, ...updates }));
  }, [staffWorkData, selectedStaffIds]);
  
  // 개별 수당 업데이트
  const updateStaffAllowances = useCallback((uniqueKey: string, allowances: EnhancedPayrollCalculation['allowances']) => {
    setStaffAllowanceOverrides(prev => ({
      ...prev,
      [uniqueKey]: allowances
    }));
  }, []);
  
  // 역할별 급여 설정 업데이트
  const updateRoleSalarySettings = useCallback((settings: RoleSalaryConfig) => {
    setRoleSalaryOverrides(settings);
  }, []);
  
  // CSV 내보내기
  const exportToCSV = useCallback(() => {
    const headers = ['이름', '역할', '근무일수', '근무시간', '급여유형', '시급/일급', '기본급', '식대', '교통비', '숙박비', '보너스', '기타수당', '총수당', '총지급액'];
    
    const rows = staffWorkData.map(item => [
      item.staffName,
      item.role,
      item.totalDays,
      item.totalHours.toFixed(1),
      item.salaryType === 'hourly' ? '시급' : item.salaryType === 'daily' ? '일급' : '기타',
      item.baseSalary,
      item.basePay,
      item.allowances.meal || 0,
      item.allowances.transportation || 0,
      item.allowances.accommodation || 0,
      item.allowances.bonus || 0,
      item.allowances.other || 0,
      item.allowanceTotal,
      item.totalAmount
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `정산내역_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [staffWorkData]);
  
  return {
    staffWorkData,
    workLogs: filteredWorkLogs,
    summary,
    availableRoles,
    loading: workLogsLoading,
    error: workLogsError,
    selectedStaffIds,
    toggleStaffSelection,
    toggleSelectAll,
    applyBulkAllowances,
    updateStaffAllowances,
    updateRoleSalarySettings,
    exportToCSV,
    calculateBasePay,
    getSalaryInfo
  };
};