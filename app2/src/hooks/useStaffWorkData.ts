import { useMemo, useCallback, useState } from 'react';
import { useUnifiedWorkLogs } from './useUnifiedWorkLogs';
import { useJobPostingContext } from '../contexts/JobPostingContextAdapter';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { EnhancedPayrollCalculation, BulkAllowanceSettings, PayrollSummary, RoleSalaryConfig, RolePayrollInfo } from '../types/payroll';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import { calculateWorkHours } from '../utils/workLogMapper';
import { matchStaffIdentifier } from '../utils/staffIdMapper';
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
      // 디버깅: 스태프 정보 확인
      logger.debug('스태프 처리 시작', {
        component: 'useStaffWorkData',
        data: {
          staffName: staff.name,
          userId: staff.userId,
          applicantId: staff.applicantId,
          role: staff.role,
          roles: staff.roles
        }
      });
      
      // 해당 스태프의 WorkLogs 필터링 - 간소화된 매칭
      const staffWorkLogs = filteredWorkLogs.filter(log => {
        // staffIdMapper 유틸리티 사용하여 간소화
        const staffIdentifiers = [staff.userId];
        
        // applicantId가 있고 userId와 다른 경우만 추가
        if (staff.applicantId && staff.applicantId !== staff.userId) {
          staffIdentifiers.push(staff.applicantId);
        }
        
        // 1. ID 매칭 (staffIdMapper 활용)
        if (matchStaffIdentifier(log, staffIdentifiers)) {
          logger.debug('ID 매칭 성공', {
            component: 'useStaffWorkData',
            data: { 
              staffId: log.staffId,
              staffIdentifiers,
              role: log.role
            }
          });
          return true;
        }
        
        // 2. 이름 매칭 (fallback)
        if (log.staffName === staff.name) {
          logger.debug('이름 매칭 성공', {
            component: 'useStaffWorkData',
            data: { 
              staffName: log.staffName, 
              name: staff.name,
              role: log.role
            }
          });
          return true;
        }
        
        return false;
      });
      
      logger.debug('WorkLogs 필터링 결과', {
        component: 'useStaffWorkData',
        data: {
          staffName: staff.name,
          matchedLogsCount: staffWorkLogs.length,
          matchedLogs: staffWorkLogs.map(log => ({
            id: log.id,
            staffId: log.staffId,
            staffName: log.staffName,
            role: log.role,
            date: log.date,
            scheduledStartTime: log.scheduledStartTime,
            scheduledEndTime: log.scheduledEndTime
          }))
        }
      });
      
      // 역할별로 WorkLogs 그룹화
      const roleWorkLogsMap = new Map<string, UnifiedWorkLog[]>();
      const rolesSet = new Set<string>();
      
      // WorkLog에 역할 정보가 있으면 사용, 없으면 staff의 role 사용
      staffWorkLogs.forEach(log => {
        const role = log.role || staff.role || 'default';
        // unknown이 아닌 실제 역할만 추가
        if (role && role !== 'unknown' && role !== 'default') {
          rolesSet.add(role);
          if (!roleWorkLogsMap.has(role)) {
            roleWorkLogsMap.set(role, []);
          }
          roleWorkLogsMap.get(role)?.push(log);
        }
      });
      
      // WorkLog가 없는 경우 스킬 - 실제 근무 기록이 있는 역할만 처리
      if (roleWorkLogsMap.size === 0) {
        return; // 다음 스태프로 이동
      }
      
      // 모든 역할 배열
      const allRoles = Array.from(rolesSet);
      
      // 역할별로 별도의 행 생성 (실제 WorkLog가 있는 역할만)
      allRoles.forEach(role => {
        const roleWorkLogs = roleWorkLogsMap.get(role) || [];
        
        // 실제 유효한 WorkLog가 없으면 스킵
        const validLogs = roleWorkLogs.filter(log => 
          log.scheduledStartTime && log.scheduledEndTime &&
          log.scheduledStartTime !== '미정' && log.scheduledEndTime !== '미정' &&
          log.scheduledStartTime !== '' && log.scheduledEndTime !== ''
        );
        
        if (validLogs.length === 0) {
          return; // 이 역할 스킵
        }
        let roleHours = 0;
        const roleUniqueDates = new Set<string>();
        
        roleWorkLogs.forEach(log => {
          // "미정" 시간 필터링 - 실제 근무 시간이 있는 경우만 처리
          if (!log.scheduledStartTime || !log.scheduledEndTime ||
              log.scheduledStartTime === '미정' || log.scheduledEndTime === '미정' ||
              log.scheduledStartTime === '' || log.scheduledEndTime === '') {
            return; // 스킵
          }
          
          const hours = calculateWorkHours(log);
          if (hours > 0) { // 실제 근무시간이 있는 경우만
            roleHours += hours;
            if (log.date) {
              roleUniqueDates.add(log.date);
            }
          }
        });
        
        const roleDays = roleUniqueDates.size || 0;
        
        // 역할별 급여 정보
        const { salaryType, salaryAmount } = getSalaryInfo(role);
        
        // 역할별 기본급 계산
        const roleBasePay = calculateBasePay(roleWorkLogs, salaryType, salaryAmount, roleHours, roleDays);
        
        // uniqueKey에 역할 포함하여 구분
        const uniqueKey = `${staff.userId}_${role}`;
        
        // 수당 (오버라이드 또는 기본값)
        const allowances = staffAllowanceOverrides[uniqueKey] || defaultAllowances;
        const totalAllowances = Object.entries(allowances).reduce((sum, [key, val]) => {
          if (key !== 'otherDescription' && typeof val === 'number') {
            return sum + val;
          }
          return sum;
        }, 0);
        
        // 총 급여 (기본급 + 수당)
        const totalPay = roleBasePay + totalAllowances;
        
        // 각 역할별로 별도의 데이터 생성
        const item: StaffWorkDataItem = {
          uniqueKey,
          staffId: staff.userId || staff.applicantId || '',
          staffName: staff.name || '이름 미정',
          role,  // 해당 역할
          roles: allRoles,    // 모든 역할 배열
          salaryType,
          baseSalary: salaryAmount,
          totalHours: roleHours,
          totalDays: roleDays,
          basePay: roleBasePay,
          allowances,
          allowanceTotal: totalAllowances,
          totalAmount: totalPay,
          workLogs: roleWorkLogs.sort((a, b) => a.date.localeCompare(b.date)),
          staffData: staff,
          period: {
            start: startDate || '',
            end: endDate || ''
          }
        };
        
        result.push(item);
      });
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