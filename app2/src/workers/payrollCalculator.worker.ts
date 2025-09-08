/**
 * payrollCalculator.worker.ts - 정산 계산 전용 Web Worker
 * Week 4 성능 최적화: 복잡한 정산 계산을 백그라운드 스레드로 이동
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { UnifiedWorkLog } from '../types/unified/workLog';
import { EnhancedPayrollCalculation, PayrollSummary } from '../types/payroll';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { JobPosting } from '../types/jobPosting';

// Web Worker 메시지 타입 정의
export interface PayrollCalculationMessage {
  type: 'CALCULATE_PAYROLL';
  payload: {
    workLogs: UnifiedWorkLog[];
    confirmedStaff: ConfirmedStaff[];
    jobPosting: JobPosting | null;
    startDate: string;
    endDate: string;
    roleSalaryOverrides?: Record<string, { salaryType: string; salaryAmount: number }>;
    staffAllowanceOverrides?: Record<string, any>;
  };
}

export interface PayrollCalculationResult {
  type: 'PAYROLL_RESULT';
  payload: {
    payrollData: EnhancedPayrollCalculation[];
    summary: PayrollSummary;
    calculationTime: number;
  };
}

export interface PayrollCalculationError {
  type: 'PAYROLL_ERROR';
  payload: {
    error: string;
    stack?: string;
  };
}

// 기본 급여율 (임포트할 수 없으므로 복사)
const DEFAULT_HOURLY_RATES: { [role: string]: number } = {
  'dealer': 18000,
  'manager': 25000,
  'tournament_director': 30000,
  'floor_supervisor': 22000,
  'cashier': 16000,
  'server': 15000,
  'security': 20000,
  'tech_support': 24000,
  'default': 15000
};

// 유틸리티 함수들 (외부 의존성 제거)
const getStaffIdentifier = (staff: any): string => {
  return staff.userId || staff.staffId || '';
};

const matchStaffIdentifier = (log: any, identifiers: string[]): boolean => {
  const logId = getStaffIdentifier(log);
  return identifiers.includes(logId);
};

const getUniqueStaffIdentifiers = (confirmedStaff: ConfirmedStaff[]): string[] => {
  return Array.from(new Set(confirmedStaff.map(getStaffIdentifier)));
};

const convertAssignedTimeToScheduled = (timeSlot: string, date: string) => {
  if (!timeSlot || timeSlot === '미정' || !timeSlot.includes('-')) {
    return { scheduledStartTime: null, scheduledEndTime: null };
  }

  const timeSlots = timeSlot.split('-');
  const startTime = timeSlots[0] || '09:00';
  const endTime = timeSlots[1] || '18:00';
  const baseDate = new Date(date + 'T00:00:00');

  const parseTime = (time: string) => {
    const timeParts = time.split(':');
    const hours = Number(timeParts[0] || 0);
    const minutes = Number(timeParts[1] || 0);
    const timestamp = new Date(baseDate);
    timestamp.setHours(hours, minutes, 0, 0);
    return { 
      seconds: Math.floor(timestamp.getTime() / 1000),
      nanoseconds: 0
    };
  };

  return {
    scheduledStartTime: parseTime(startTime),
    scheduledEndTime: parseTime(endTime)
  };
};

const calculateWorkHours = (log: UnifiedWorkLog): number => {
  const startTime = log.scheduledStartTime;
  const endTime = log.scheduledEndTime;
  
  if (!startTime || !endTime) {
    return 0;
  }

  try {
    // Firebase Timestamp 형태 처리 개선 (payrollCalculations.ts와 동일)
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    // startTime 처리
    if (startTime) {
      if (typeof startTime === 'object' && 'toDate' in startTime) {
        // Firebase Timestamp 객체 (toDate 메서드 있음)
        startDate = (startTime as any).toDate();
      } else if (typeof startTime === 'object' && 'seconds' in startTime) {
        // Firebase Timestamp 플레인 객체 ({ seconds, nanoseconds })
        startDate = new Date((startTime as any).seconds * 1000);
      } else if (typeof startTime === 'string') {
        // 문자열 형태 시간
        startDate = new Date(startTime);
      }
    }
    
    // endTime 처리
    if (endTime) {
      if (typeof endTime === 'object' && 'toDate' in endTime) {
        // Firebase Timestamp 객체 (toDate 메서드 있음)
        endDate = (endTime as any).toDate();
      } else if (typeof endTime === 'object' && 'seconds' in endTime) {
        // Firebase Timestamp 플레인 객체 ({ seconds, nanoseconds })
        endDate = new Date((endTime as any).seconds * 1000);
      } else if (typeof endTime === 'string') {
        // 문자열 형태 시간
        endDate = new Date(endTime);
      }
    }
      
    if (!startDate || !endDate) {
      return 0;
    }

    const diffMs = endDate.getTime() - startDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return Math.max(0, Math.round(diffHours * 100) / 100);
  } catch (error) {
    return 0;
  }
};

// 메인 계산 함수
const calculatePayroll = async (data: PayrollCalculationMessage['payload']): Promise<PayrollCalculationResult['payload']> => {
  const startTime = performance.now();
  
  const {
    workLogs,
    confirmedStaff,
    jobPosting,
    startDate,
    endDate,
    roleSalaryOverrides = {},
    staffAllowanceOverrides = {}
  } = data;

  // 스태프 식별자 수집
  const staffIdentifiers = getUniqueStaffIdentifiers(confirmedStaff);

  // 날짜 필터링
  const filteredWorkLogs = workLogs.filter(log => {
    const matchesStaff = matchStaffIdentifier(log, staffIdentifiers);
    const matchesDate = (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate);
    return matchesStaff && matchesDate;
  });

  // 역할별 급여 정보 가져오기
  const getSalaryInfo = (role: string) => {
    const override = roleSalaryOverrides[role];
    if (override) {
      return {
        salaryType: override.salaryType,
        salaryAmount: override.salaryAmount
      };
    }

    if (jobPosting?.useRoleSalary && jobPosting.roleSalaries?.[role]) {
      const roleSalary = jobPosting.roleSalaries[role];
      if (roleSalary) {
        return {
          salaryType: roleSalary.salaryType === 'negotiable' ? 'other' : roleSalary.salaryType,
          salaryAmount: parseFloat(roleSalary.salaryAmount) || 0
        };
      }
    }

    const baseSalaryType = jobPosting?.salaryType || 'hourly';
    const salaryType = baseSalaryType === 'negotiable' ? 'other' : baseSalaryType;
    const salaryAmount = jobPosting?.salaryAmount 
      ? parseFloat(jobPosting.salaryAmount)
      : (DEFAULT_HOURLY_RATES[role] || DEFAULT_HOURLY_RATES['default'] || 15000);

    return { salaryType, salaryAmount };
  };

  // 기본 수당 가져오기
  const getDefaultAllowances = () => {
    const benefits = jobPosting?.benefits;
    return {
      meal: benefits?.mealAllowance ? (parseInt(benefits.mealAllowance) || 0) : 0,
      transportation: benefits?.transportation ? (parseInt(benefits.transportation) || 0) : 0,
      accommodation: benefits?.accommodation ? (parseInt(benefits.accommodation) || 0) : 0,
      bonus: 0,
      other: 0
    };
  };

  // 기본 급여 계산
  const calculateBasePay = (
    salaryType: string,
    salaryAmount: number,
    totalHours: number,
    totalDays: number
  ): number => {
    switch (salaryType) {
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
  };

  // 역할 기반 WorkLogs 생성
  const roleBasedWorkLogs: (UnifiedWorkLog & { displayKey: string })[] = [];
  const processedStaffRoles = new Set<string>();
  const processedWorkLogIds = new Set<string>();

  for (const staff of confirmedStaff) {
    const staffId = getStaffIdentifier(staff);
    const staffRoleKey = `${staffId}_${staff.role}_${staff.date || ''}`;

    if (processedStaffRoles.has(staffRoleKey)) continue;

    // 해당 스태프의 특정 날짜 WorkLog 찾기
    const staffWorkLogs = filteredWorkLogs.filter(log => 
      matchStaffIdentifier(log, [staffId]) && log.date === staff.date
    );

    const log = staffWorkLogs[0];

    if (log && !processedWorkLogIds.has(log.id)) {
      // 실제 WorkLog가 있는 경우
      processedStaffRoles.add(staffRoleKey);
      processedWorkLogIds.add(log.id);

      let finalScheduledStart = log.scheduledStartTime;
      let finalScheduledEnd = log.scheduledEndTime;

      // WorkLog에 시간 정보가 없으면 timeSlot으로 보완
      if (!finalScheduledStart || !finalScheduledEnd) {
        const timeSlot = staff.timeSlot;
        if (timeSlot && timeSlot !== '미정' && timeSlot.includes('-')) {
          const { scheduledStartTime, scheduledEndTime } = 
            convertAssignedTimeToScheduled(timeSlot, log.date);
          
          if (!finalScheduledStart && scheduledStartTime) {
            finalScheduledStart = scheduledStartTime as any;
          }
          if (!finalScheduledEnd && scheduledEndTime) {
            finalScheduledEnd = scheduledEndTime as any;
          }
        }
      }

      const enhancedLog = {
        ...log,
        scheduledStartTime: finalScheduledStart,
        scheduledEndTime: finalScheduledEnd,
        role: staff.role,
        displayKey: `${log.staffId}_${staff.role}`
      } as UnifiedWorkLog & { displayKey: string };

      roleBasedWorkLogs.push(enhancedLog);
    } else if (!processedStaffRoles.has(staffRoleKey)) {
      // WorkLog가 없는 경우 가상 WorkLog 생성
      const timeSlot = staff.timeSlot;
      
      if (!timeSlot || timeSlot === '미정' || !timeSlot.includes('-')) {
        continue; // 유효하지 않은 timeSlot은 건너뛰기
      }

      const virtualDate = staff.date || new Date().toISOString().split('T')[0];
      const { scheduledStartTime, scheduledEndTime } = 
        convertAssignedTimeToScheduled(timeSlot, virtualDate!);

      if (scheduledStartTime && scheduledEndTime) {
        const virtualLog = {
          id: `virtual_${staff.userId}_${virtualDate}`,
          staffId: staff.userId,
          staffName: staff.name,
          eventId: '',
          date: virtualDate,
          role: staff.role,
          scheduledStartTime: scheduledStartTime as any,
          scheduledEndTime: scheduledEndTime as any,
          actualStartTime: null,
          actualEndTime: null,
          status: 'scheduled' as const,
          isVirtual: true,
          assignedTime: timeSlot,
          displayKey: `${staff.userId}_${staff.role}`
        } as UnifiedWorkLog & { displayKey: string };

        roleBasedWorkLogs.push(virtualLog);
        processedStaffRoles.add(staffRoleKey);
      }
    }
  }

  // 스태프 + 역할별 그룹화 및 계산
  const staffRoleMap = new Map<string, {
    staffId: string;
    staffName: string;
    role: string;
    workLogs: UnifiedWorkLog[];
  }>();

  for (const log of roleBasedWorkLogs) {
    const role = (log as any).role;
    const staffName = (log as any).staffName || '';
    
    if (!role) continue;

    const logStaffId = getStaffIdentifier(log);
    const key = `${logStaffId}_${role}`;

    if (!staffRoleMap.has(key)) {
      staffRoleMap.set(key, {
        staffId: logStaffId,
        staffName: staffName,
        role: role,
        workLogs: []
      });
    }

    const entry = staffRoleMap.get(key);
    if (entry) {
      entry.workLogs.push(log);
    }
  }

  // 정산 계산
  const results: EnhancedPayrollCalculation[] = [];
  const defaultAllowances = getDefaultAllowances();

  for (const [key, data] of Array.from(staffRoleMap)) {
    let totalHours = 0;
    const uniqueDates = new Set<string>();

    for (const log of data.workLogs) {
      if (log.scheduledEndTime) {
        uniqueDates.add(log.date);
        const hours = calculateWorkHours(log);
        totalHours += hours;
      }
    }

    const totalDays = uniqueDates.size;
    const { salaryType, salaryAmount } = getSalaryInfo(data.role);
    const basePay = calculateBasePay(salaryType, salaryAmount, totalHours, totalDays);
    
    const allowances = staffAllowanceOverrides[key] || 
                      staffAllowanceOverrides[data.staffId] || 
                      defaultAllowances;

    const allowanceTotal = 
      allowances.meal +
      allowances.transportation +
      allowances.accommodation +
      allowances.bonus +
      allowances.other;

    const totalAmount = basePay + allowanceTotal;

    const result: EnhancedPayrollCalculation = {
      staffId: data.staffId,
      staffName: data.staffName,
      role: data.role,
      workLogs: data.workLogs,
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays,
      salaryType: salaryType as any,
      baseSalary: salaryAmount,
      allowances,
      basePay,
      allowanceTotal,
      totalAmount,
      period: {
        start: startDate,
        end: endDate
      }
    };

    results.push(result);
  }

  // 정렬
  results.sort((a, b) => {
    const nameCompare = a.staffName.localeCompare(b.staffName);
    if (nameCompare !== 0) return nameCompare;
    return a.role.localeCompare(b.role);
  });

  // 요약 계산
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

  for (const data of results) {
    totalHours += data.totalHours;
    totalDays += data.totalDays;
    totalAmount += data.totalAmount;

    // 역할별 집계
    if (!byRole[data.role]) {
      byRole[data.role] = { count: 0, hours: 0, amount: 0 };
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
  }

  const summary: PayrollSummary = {
    totalStaff: results.length,
    totalHours: Math.round(totalHours * 100) / 100,
    totalDays,
    totalAmount,
    byRole,
    bySalaryType,
    period: {
      start: startDate,
      end: endDate
    }
  };

  const calculationTime = performance.now() - startTime;

  return {
    payrollData: results,
    summary,
    calculationTime
  };
};

// Web Worker 메시지 핸들러
// eslint-disable-next-line no-restricted-globals
self.onmessage = async (event: MessageEvent<PayrollCalculationMessage>) => {
  try {
    if (event.data.type === 'CALCULATE_PAYROLL') {
      const result = await calculatePayroll(event.data.payload);
      
      const response: PayrollCalculationResult = {
        type: 'PAYROLL_RESULT',
        payload: result
      };

      // eslint-disable-next-line no-restricted-globals
      self.postMessage(response);
    }
  } catch (error) {
    const payload: { error: string; stack?: string } = {
      error: error instanceof Error ? error.message : String(error)
    };
    
    if (error instanceof Error && error.stack) {
      payload.stack = error.stack;
    }
    
    const errorResponse: PayrollCalculationError = {
      type: 'PAYROLL_ERROR',
      payload
    };

    // eslint-disable-next-line no-restricted-globals
    self.postMessage(errorResponse);
  }
};

// TypeScript 타입 export (런타임에서는 무시됨)
export {};