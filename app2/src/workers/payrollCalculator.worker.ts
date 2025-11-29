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
import { toISODateString } from '../utils/dateUtils';

// Firebase Timestamp 호환 인터페이스 (Web Worker 환경용)
interface FirebaseTimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

// 스태프 식별자 추출용 인터페이스
interface StaffIdentifiable {
  userId?: string;
  staffId?: string;
}

// 급여 타입
type SalaryType = 'hourly' | 'daily' | 'monthly' | 'other';

// 수당 데이터 인터페이스
export interface StaffAllowanceData {
  meal: number;
  transportation: number;
  accommodation: number;
  bonus: number;
  other: number;
  dailyRates?: {
    meal?: number;
    transportation?: number;
    accommodation?: number;
  };
  workDays?: number;
  isManualEdit?: boolean;
}

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
    staffAllowanceOverrides?: Record<string, StaffAllowanceData>;
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
  dealer: 18000,
  manager: 25000,
  tournament_director: 30000,
  floor_supervisor: 22000,
  cashier: 16000,
  server: 15000,
  security: 20000,
  tech_support: 24000,
  default: 15000,
};

// 유틸리티 함수들 (외부 의존성 제거)
const getStaffIdentifier = (staff: StaffIdentifiable): string => {
  return staff.userId || staff.staffId || '';
};

const matchStaffIdentifier = (log: StaffIdentifiable, identifiers: string[]): boolean => {
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
      nanoseconds: 0,
    };
  };

  return {
    scheduledStartTime: parseTime(startTime),
    scheduledEndTime: parseTime(endTime),
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
        const timestampWithMethod = startTime as FirebaseTimestampLike;
        if (timestampWithMethod.toDate) {
          startDate = timestampWithMethod.toDate();
        }
      } else if (typeof startTime === 'object' && 'seconds' in startTime) {
        // Firebase Timestamp 플레인 객체 ({ seconds, nanoseconds })
        const timestampPlain = startTime as FirebaseTimestampLike;
        startDate = new Date(timestampPlain.seconds * 1000);
      } else if (typeof startTime === 'string') {
        // 문자열 형태 시간
        startDate = new Date(startTime);
      }
    }

    // endTime 처리
    if (endTime) {
      if (typeof endTime === 'object' && 'toDate' in endTime) {
        // Firebase Timestamp 객체 (toDate 메서드 있음)
        const timestampWithMethod = endTime as FirebaseTimestampLike;
        if (timestampWithMethod.toDate) {
          endDate = timestampWithMethod.toDate();
        }
      } else if (typeof endTime === 'object' && 'seconds' in endTime) {
        // Firebase Timestamp 플레인 객체 ({ seconds, nanoseconds })
        const timestampPlain = endTime as FirebaseTimestampLike;
        endDate = new Date(timestampPlain.seconds * 1000);
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
const calculatePayroll = async (
  data: PayrollCalculationMessage['payload']
): Promise<PayrollCalculationResult['payload']> => {
  const startTime = performance.now();

  const {
    workLogs,
    confirmedStaff,
    jobPosting,
    startDate,
    endDate,
    roleSalaryOverrides = {},
    staffAllowanceOverrides = {},
  } = data;

  // 스태프 식별자 수집
  const staffIdentifiers = getUniqueStaffIdentifiers(confirmedStaff);

  // 날짜 필터링
  const filteredWorkLogs = workLogs.filter((log) => {
    const matchesStaff = matchStaffIdentifier(log, staffIdentifiers);
    const matchesDate = (!startDate || log.date >= startDate) && (!endDate || log.date <= endDate);
    return matchesStaff && matchesDate;
  });

  // 역할별 급여 정보 가져오기
  const getSalaryInfo = (role: string): { salaryType: SalaryType; salaryAmount: number } => {
    const override = roleSalaryOverrides[role];
    if (override) {
      const overrideSalaryType =
        override.salaryType === 'negotiable' ? 'other' : (override.salaryType as SalaryType);
      return {
        salaryType: overrideSalaryType,
        salaryAmount: override.salaryAmount,
      };
    }

    if (jobPosting?.useRoleSalary && jobPosting.roleSalaries?.[role]) {
      const roleSalary = jobPosting.roleSalaries[role];
      if (roleSalary) {
        const roleSalaryType =
          roleSalary.salaryType === 'negotiable' ? 'other' : (roleSalary.salaryType as SalaryType);
        return {
          salaryType: roleSalaryType,
          salaryAmount: parseFloat(roleSalary.salaryAmount) || 0,
        };
      }
    }

    const baseSalaryType = jobPosting?.salaryType || 'hourly';
    const salaryType: SalaryType =
      baseSalaryType === 'negotiable' ? 'other' : (baseSalaryType as SalaryType);
    const salaryAmount = jobPosting?.salaryAmount
      ? parseFloat(jobPosting.salaryAmount)
      : DEFAULT_HOURLY_RATES[role] || DEFAULT_HOURLY_RATES['default'] || 15000;

    return { salaryType, salaryAmount };
  };

  // 기본 수당 가져오기 (일당 계산 로직 추가)
  const getDefaultAllowances = (
    totalDays: number
  ): {
    meal: number;
    transportation: number;
    accommodation: number;
    bonus: number;
    other: number;
    dailyRates?: { meal?: number; transportation?: number; accommodation?: number };
    workDays?: number;
    isManualEdit?: boolean;
  } => {
    const benefits = jobPosting?.benefits;
    const isPerDay = benefits?.isPerDay !== false; // 기본값은 true (일당 계산)

    // 일당 정보 추출
    const mealDaily = benefits?.mealAllowance ? parseInt(benefits.mealAllowance) || 0 : 0;
    const transportationDaily = benefits?.transportation
      ? parseInt(benefits.transportation) || 0
      : 0;
    const accommodationDaily = benefits?.accommodation ? parseInt(benefits.accommodation) || 0 : 0;

    const baseAllowances = {
      meal: isPerDay ? mealDaily * totalDays : mealDaily,
      transportation: isPerDay ? transportationDaily * totalDays : transportationDaily,
      accommodation: isPerDay ? accommodationDaily * totalDays : accommodationDaily,
      bonus: 0,
      other: 0,
      isManualEdit: false,
    };

    // 일당 정보가 있을 때만 추가
    if (isPerDay) {
      const dailyRates: { meal?: number; transportation?: number; accommodation?: number } = {};
      if (mealDaily > 0) dailyRates.meal = mealDaily;
      if (transportationDaily > 0) dailyRates.transportation = transportationDaily;
      if (accommodationDaily > 0) dailyRates.accommodation = accommodationDaily;

      return {
        ...baseAllowances,
        dailyRates,
        workDays: totalDays,
      };
    }

    return baseAllowances;
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
    const staffWorkLogs = filteredWorkLogs.filter(
      (log) => matchStaffIdentifier(log, [staffId]) && log.date === staff.date
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
          const { scheduledStartTime, scheduledEndTime } = convertAssignedTimeToScheduled(
            timeSlot,
            log.date
          );

          if (!finalScheduledStart && scheduledStartTime) {
            // Worker 환경에서 Timestamp 객체 대신 plain object 사용
            finalScheduledStart = scheduledStartTime as unknown as typeof log.scheduledStartTime;
          }
          if (!finalScheduledEnd && scheduledEndTime) {
            finalScheduledEnd = scheduledEndTime as unknown as typeof log.scheduledEndTime;
          }
        }
      }

      const enhancedLog = {
        ...log,
        scheduledStartTime: finalScheduledStart,
        scheduledEndTime: finalScheduledEnd,
        role: staff.role,
        displayKey: `${log.staffId}_${staff.role}`,
      } as UnifiedWorkLog & { displayKey: string };

      roleBasedWorkLogs.push(enhancedLog);
    } else if (!processedStaffRoles.has(staffRoleKey)) {
      // WorkLog가 없는 경우 가상 WorkLog 생성
      const timeSlot = staff.timeSlot;

      if (!timeSlot || timeSlot === '미정' || !timeSlot.includes('-')) {
        continue; // 유효하지 않은 timeSlot은 건너뛰기
      }

      const virtualDate = staff.date || toISODateString(new Date()) || '';
      const { scheduledStartTime, scheduledEndTime } = convertAssignedTimeToScheduled(
        timeSlot,
        virtualDate!
      );

      if (scheduledStartTime && scheduledEndTime) {
        const virtualLog: UnifiedWorkLog & { displayKey: string } = {
          id: `virtual_${staff.userId}_${virtualDate}`,
          staffId: staff.userId,
          staffName: staff.name,
          eventId: '',
          date: virtualDate,
          role: staff.role,
          // Worker 환경에서 Timestamp 객체 대신 plain object 사용 (unknown 경유로 타입 변환)
          scheduledStartTime: scheduledStartTime as unknown as UnifiedWorkLog['scheduledStartTime'],
          scheduledEndTime: scheduledEndTime as unknown as UnifiedWorkLog['scheduledEndTime'],
          actualStartTime: null,
          actualEndTime: null,
          status: 'not_started' as const,
          assignedTime: timeSlot,
          displayKey: `${staff.userId}_${staff.role}`,
        };

        roleBasedWorkLogs.push(virtualLog);
        processedStaffRoles.add(staffRoleKey);
      }
    }
  }

  // 스태프 + 역할별 그룹화 및 계산
  const staffRoleMap = new Map<
    string,
    {
      staffId: string;
      staffName: string;
      role: string;
      workLogs: UnifiedWorkLog[];
    }
  >();

  for (const log of roleBasedWorkLogs) {
    const role = log.role;
    const staffName = log.staffName || '';

    if (!role) continue;

    const logStaffId = getStaffIdentifier(log);
    const key = `${logStaffId}_${role}`;

    if (!staffRoleMap.has(key)) {
      staffRoleMap.set(key, {
        staffId: logStaffId,
        staffName: staffName,
        role: role,
        workLogs: [],
      });
    }

    const entry = staffRoleMap.get(key);
    if (entry) {
      entry.workLogs.push(log);
    }
  }

  // 정산 계산
  const results: EnhancedPayrollCalculation[] = [];

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

    // 각 스태프의 totalDays에 맞게 개별적으로 계산
    const defaultAllowances = getDefaultAllowances(totalDays);
    const baseAllowances =
      staffAllowanceOverrides[key] || staffAllowanceOverrides[data.staffId] || defaultAllowances;

    // 일당 정보는 항상 유지 (수동 편집 시에도)
    const allowances = { ...baseAllowances };

    // 일당 정보가 있을 때만 추가
    if (defaultAllowances.dailyRates) {
      allowances.dailyRates = defaultAllowances.dailyRates;
    }
    if (defaultAllowances.workDays) {
      allowances.workDays = defaultAllowances.workDays;
    }

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
      salaryType,
      baseSalary: salaryAmount,
      allowances,
      basePay,
      allowanceTotal,
      totalAmount,
      period: {
        start: startDate,
        end: endDate,
      },
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
    other: 0,
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
      end: endDate,
    },
  };

  const calculationTime = performance.now() - startTime;

  return {
    payrollData: results,
    summary,
    calculationTime,
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
        payload: result,
      };

      // eslint-disable-next-line no-restricted-globals
      self.postMessage(response);
    }
  } catch (error) {
    const payload: { error: string; stack?: string } = {
      error: error instanceof Error ? error.message : String(error),
    };

    if (error instanceof Error && error.stack) {
      payload.stack = error.stack;
    }

    const errorResponse: PayrollCalculationError = {
      type: 'PAYROLL_ERROR',
      payload,
    };

    // eslint-disable-next-line no-restricted-globals
    self.postMessage(errorResponse);
  }
};

// TypeScript 타입 export (런타임에서는 무시됨)
export {};
