import { useCallback, useMemo, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { EnhancedPayrollCalculation, BulkAllowanceSettings, PayrollSummary, RoleSalaryConfig, BulkSalaryUpdate, BulkSalaryEditResult } from '../types/payroll';
import { DEFAULT_HOURLY_RATES } from '../types/simplePayroll';
import { useJobPostingContext } from '../contexts/JobPostingContextAdapter';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { calculateWorkHours as calculateHours } from '../utils/workLogMapper';
import { convertAssignedTimeToScheduled } from '../utils/workLogUtils';
import { JobPosting } from '../types/jobPosting';
import { logger } from '../utils/logger';

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
  
  // 역할별 급여 설정 오버라이드 상태
  const [roleSalaryOverrides, setRoleSalaryOverrides] = useState<RoleSalaryConfig>({});
  
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

  // 역할별 급여 정보 가져오기 (개선된 버전)
  const getSalaryInfo = useCallback((role: string) => {
    // 오버라이드 설정이 있는 경우 우선 사용
    const override = roleSalaryOverrides[role];
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
      meal: benefits?.mealAllowance ? (parseInt(benefits.mealAllowance) || 0) : 0,
      transportation: benefits?.transportation ? (parseInt(benefits.transportation) || 0) : 0,
      accommodation: benefits?.accommodation ? (parseInt(benefits.accommodation) || 0) : 0,
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
    
    // staff의 assignedTime을 활용한 가상 WorkLog 생성 (workLog가 없는 경우)
    // 스태프ID + 역할 조합으로 중복 체크 (같은 사람이 다른 역할일 수 있음)
    const processedStaffRoles = new Set<string>();
    
    // WorkLog ID 기반 중복 방지 - 같은 WorkLog는 한 번만 처리
    const processedWorkLogIds = new Set<string>();
    
    logger.debug('Processing confirmedStaff for virtual WorkLogs', {
      component: 'useEnhancedPayroll',
      data: {
        confirmedStaffCount: confirmedStaff.length,
        confirmedStaff: confirmedStaff.map(s => ({
          userId: s.userId,
          name: s.name,
          role: s.role,
          timeSlot: s.timeSlot,
          date: s.date
        }))
      }
    });
    
    confirmedStaff.forEach(staff => {
      const staffRoleKey = `${staff.userId}_${staff.role}_${staff.date || ''}`;
      
      logger.debug('Processing confirmedStaff item', {
        component: 'useEnhancedPayroll',
        data: {
          staffRoleKey,
          userId: staff.userId,
          name: staff.name,
          role: staff.role,
          date: staff.date,
          timeSlot: staff.timeSlot,
          assignedTime: (staff as any).assignedTime,
          alreadyProcessed: processedStaffRoles.has(staffRoleKey)
        }
      });
      
      // 해당 스태프의 특정 날짜 workLog 찾기 - confirmedStaff 항목의 날짜와 정확히 매칭
      const staffWorkLogs = filteredWorkLogs.filter(log => 
        log.staffId === staff.userId && 
        log.date === staff.date  // 날짜 매칭 추가로 정확한 workLog만 가져옴
      );
      
      // 🔥 중요: Firebase에서 직접 가져온 WorkLog 확인
      console.log('🔥 Finding WorkLogs for staff:', {
        staffId: staff.userId,
        staffName: staff.name,
        role: staff.role,
        date: staff.date,
        foundWorkLogs: staffWorkLogs.length,
        workLogDetails: staffWorkLogs.map(log => ({
          id: log.id,
          hasScheduledStart: !!log.scheduledStartTime,
          hasScheduledEnd: !!log.scheduledEndTime,
          scheduledStartTime: log.scheduledStartTime,
          scheduledEndTime: log.scheduledEndTime
        }))
      });
      
      logger.debug('Processing staff', {
        component: 'useEnhancedPayroll',
        data: {
          staffId: staff.userId,
          staffName: staff.name,
          role: staff.role,
          date: staff.date,
          timeSlot: staff.timeSlot,
          timeSlotType: typeof staff.timeSlot,
          hasWorkLogs: staffWorkLogs.length > 0,
          workLogCount: staffWorkLogs.length,
          alreadyProcessed: processedStaffRoles.has(staffRoleKey)
        }
      });
      
      const log = staffWorkLogs[0];
      if (log && staffWorkLogs.length > 0) {
        // workLog가 있는 경우 - 해당 날짜의 첫 번째 workLog 사용 (날짜별 매칭이므로 하나만 있어야 함)
        
        // WorkLog ID 기반 중복 처리 방지
        if (!processedStaffRoles.has(staffRoleKey) && !processedWorkLogIds.has(log.id)) {
          processedStaffRoles.add(staffRoleKey);
          processedWorkLogIds.add(log.id);
          
          // workLog 실제 시간 데이터 우선 사용 - 스태프탭에서 수정된 실제 근무시간 반영
          let finalScheduledStart = log.scheduledStartTime;
          let finalScheduledEnd = log.scheduledEndTime;
          
          // workLog에 시간 정보가 없는 경우 confirmedStaff의 timeSlot으로 보완
          if (!finalScheduledStart || !finalScheduledEnd) {
            const timeSlot = staff.timeSlot;
            if (timeSlot && timeSlot !== '미정' && timeSlot.includes('-')) {
              const { scheduledStartTime, scheduledEndTime } = 
                convertAssignedTimeToScheduled(timeSlot, log.date);
              
              if (!finalScheduledStart && scheduledStartTime) {
                finalScheduledStart = scheduledStartTime;
              }
              if (!finalScheduledEnd && scheduledEndTime) {
                finalScheduledEnd = scheduledEndTime;
              }
              
              logger.debug('Complemented workLog times with timeSlot', {
                component: 'useEnhancedPayroll',
                data: {
                  staffId: staff.userId,
                  role: staff.role,
                  date: log.date,
                  timeSlot,
                  startTimeAdded: !log.scheduledStartTime && !!scheduledStartTime,
                  endTimeAdded: !log.scheduledEndTime && !!scheduledEndTime
                }
              });
            }
          }
          
          logger.debug('Using actual WorkLog times from Staff tab', {
            component: 'useEnhancedPayroll',
            data: {
              staffId: staff.userId,
              role: staff.role,
              date: log.date,
              scheduledStartTime: finalScheduledStart ? 'exists' : 'null',
              scheduledEndTime: finalScheduledEnd ? 'exists' : 'null',
              source: finalScheduledStart === log.scheduledStartTime ? 'workLog_only' : 'workLog_plus_timeSlot'
            }
          });
          
          logger.debug('Using WorkLog times (priority)', {
            component: 'useEnhancedPayroll',
            data: {
              workLogId: log.id,
              staffId: staff.userId,
              role: staff.role,
              date: log.date,
              hasStart: !!finalScheduledStart,
              hasEnd: !!finalScheduledEnd,
              source: finalScheduledStart === log.scheduledStartTime ? 'workLog' : 'staff_override',
              confirmedStaffTimeSlot: staff.timeSlot || 'none'
            }
          });
          
          // 새 객체 생성하여 시간 정보와 역할 추가
          const enhancedLog = {
            ...log,
            scheduledStartTime: finalScheduledStart,
            scheduledEndTime: finalScheduledEnd,
            role: staff.role,
            displayKey: `${log.staffId}_${staff.role}` // 같은 역할은 한 행으로 합쳐짐
          } as UnifiedWorkLog & { displayKey: string };
          
          roleBasedWorkLogs.push(enhancedLog);
        }
      } else if (!processedStaffRoles.has(staffRoleKey)) {
        // workLog가 없는 경우 - 실제 workLog가 있다면 그것을 우선 사용, 없으면 staff.timeSlot 사용
        // 김승호처럼 실제 workLog 데이터가 있는 경우 해당 시간을 사용해야 함
        const timeSlot = staff.timeSlot;
        
        // 같은 staffId, 날짜로 실제 workLog가 있는지 확인 (정확한 날짜 매칭)
        const existingWorkLog = workLogs.find(log => 
          log.staffId === staff.userId && 
          log.date === staff.date &&
          (log.scheduledStartTime || log.actualStartTime)
        );
        
        logger.debug('Searching for existing WorkLog', {
          component: 'useEnhancedPayroll',
          data: {
            staffId: staff.userId,
            staffName: staff.name,
            role: staff.role,
            date: staff.date,
            timeSlot: staff.timeSlot,
            foundExisting: !!existingWorkLog,
            existingWorkLogId: existingWorkLog?.id || null,
            totalWorkLogs: workLogs.length,
            matchingStaffWorkLogs: workLogs.filter(log => log.staffId === staff.userId).map(log => ({
              id: log.id,
              date: log.date,
              hasTime: !!(log.scheduledStartTime || log.actualStartTime)
            }))
          }
        });
        
        if (existingWorkLog && !processedWorkLogIds.has(existingWorkLog.id)) {
          // 해당 날짜에 이미 실제 workLog가 있고 아직 처리되지 않았으면 실제 데이터 사용
          logger.debug('Found existing workLog for this specific date - using actual workLog', {
            component: 'useEnhancedPayroll',
            data: {
              staffId: staff.userId,
              role: staff.role,
              date: staff.date,
              workLogId: existingWorkLog.id,
              hasScheduledStart: !!existingWorkLog.scheduledStartTime,
              hasScheduledEnd: !!existingWorkLog.scheduledEndTime,
              alreadyProcessed: processedWorkLogIds.has(existingWorkLog.id)
            }
          });
          
          // 실제 workLog에 시간 정보가 없는 경우 timeSlot으로 보완
          let finalScheduledStart = existingWorkLog.scheduledStartTime;
          let finalScheduledEnd = existingWorkLog.scheduledEndTime;
          
          if (!finalScheduledStart || !finalScheduledEnd) {
            const timeSlot = staff.timeSlot;
            if (timeSlot && timeSlot !== '미정' && timeSlot.includes('-')) {
              const { scheduledStartTime, scheduledEndTime } = 
                convertAssignedTimeToScheduled(timeSlot, existingWorkLog.date);
              
              if (!finalScheduledStart && scheduledStartTime) {
                finalScheduledStart = scheduledStartTime;
              }
              if (!finalScheduledEnd && scheduledEndTime) {
                finalScheduledEnd = scheduledEndTime;
              }
              
              logger.debug('Complemented existing workLog times with timeSlot', {
                component: 'useEnhancedPayroll',
                data: {
                  staffId: staff.userId,
                  role: staff.role,
                  date: existingWorkLog.date,
                  timeSlot,
                  startTimeAdded: !existingWorkLog.scheduledStartTime && !!scheduledStartTime,
                  endTimeAdded: !existingWorkLog.scheduledEndTime && !!scheduledEndTime
                }
              });
            }
          }
          
          // 실제 workLog를 roleBasedWorkLogs에 추가 (시간 정보 보완 포함)
          const enhancedLog = {
            ...existingWorkLog,
            scheduledStartTime: finalScheduledStart,
            scheduledEndTime: finalScheduledEnd,
            role: staff.role,
            displayKey: `${existingWorkLog.staffId}_${staff.role}` // 같은 역할은 한 행으로 합쳐짐
          } as UnifiedWorkLog & { displayKey: string };
          
          roleBasedWorkLogs.push(enhancedLog);
          processedStaffRoles.add(staffRoleKey);
          processedWorkLogIds.add(existingWorkLog.id);
          
          logger.debug('Added existing workLog to roleBasedWorkLogs', {
            component: 'useEnhancedPayroll',
            data: {
              workLogId: existingWorkLog.id,
              staffId: staff.userId,
              role: staff.role,
              date: staff.date,
              displayKey: enhancedLog.displayKey
            }
          });
          
          // 실제 workLog 처리 완료, 다음 staff로 넘어감
          return;
        } else if (existingWorkLog && processedWorkLogIds.has(existingWorkLog.id)) {
          // 이미 처리된 WorkLog인 경우 건너뛰기
          logger.debug('Existing workLog already processed - skipping', {
            component: 'useEnhancedPayroll',
            data: {
              staffId: staff.userId,
              role: staff.role,
              date: staff.date,
              workLogId: existingWorkLog.id
            }
          });
          return;
        }
        
        // timeSlot이 여전히 없거나 '미정'인 경우 건너뛰기 (기본값 사용하지 않음)
        if (!timeSlot || timeSlot === '미정') {
          logger.warn('No valid timeSlot available for staff - skipping virtual WorkLog creation', {
            component: 'useEnhancedPayroll',
            data: {
              staffId: staff.userId,
              staffName: staff.name,
              role: staff.role,
              date: staff.date,
              timeSlot: staff.timeSlot,
              originalTimeSlot: staff.timeSlot,
              staffRoleKey: staffRoleKey,
              alreadyProcessed: processedStaffRoles.has(staffRoleKey)
            }
          });
          return; // 이 스태프는 건너뛰기
        }
        
        // 이미 처리된 스태프는 건너뛰기
        if (processedStaffRoles.has(staffRoleKey)) {
          logger.debug('Staff already processed - skipping virtual WorkLog creation', {
            component: 'useEnhancedPayroll',
            data: {
              staffId: staff.userId,
              staffName: staff.name,
              role: staff.role,
              date: staff.date,
              staffRoleKey: staffRoleKey
            }
          });
          return;
        }
        
        logger.debug('Attempting to create virtual WorkLog', {
          component: 'useEnhancedPayroll',
          data: {
            staffId: staff.userId,
            originalTimeSlot: staff.timeSlot,
            timeSlot: timeSlot,
            timeSlotType: typeof timeSlot,
            hasTimeSlot: !!timeSlot
          }
        });
        
        if (timeSlot) {
          // 날짜 설정: staff.date가 있으면 사용, 없으면 오늘 날짜 사용
          const virtualDate = staff.date || new Date().toISOString().split('T')[0];
          
          // timeSlot 형식 처리: "미정", "11:00", "10:00-18:00" 등
          let processedTimeSlot = timeSlot;
          
          // 기본값 사용하지 않고 실제 시간 범위만 처리
          if (timeSlot === '미정' || timeSlot === 'TBD' || !timeSlot.includes('-')) {
            // 단일 시간인 경우 (예: "11:00") 또는 미정인 경우 건너뛰기
            if (timeSlot.match(/^\d{1,2}:\d{2}$/)) {
              // 단일 시간은 범위가 없으므로 정산에서 제외
              logger.warn('Single time slot without end time - skipping', {
                component: 'useEnhancedPayroll',
                data: {
                  staffId: staff.userId,
                  role: staff.role,
                  timeSlot: timeSlot,
                  reason: 'Single time without duration'
                }
              });
              return; // 이 스태프는 건너뛰기
            } else {
              // 미정이거나 인식할 수 없는 형식인 경우 건너뛰기
              logger.warn('Invalid or undefined timeSlot - skipping', {
                component: 'useEnhancedPayroll',
                data: {
                  staffId: staff.userId,
                  role: staff.role,
                  timeSlot: timeSlot,
                  reason: 'Invalid format or TBD'
                }
              });
              return; // 이 스태프는 건너뛰기
            }
          }
          
          const { scheduledStartTime, scheduledEndTime } = 
            convertAssignedTimeToScheduled(processedTimeSlot, virtualDate);
          
          logger.debug('Creating virtual WorkLog from timeSlot', { 
            component: 'useEnhancedPayroll',
            data: {
              staffId: staff.userId,
              staffName: staff.name,
              timeSlot,
              virtualDate,
              scheduledStartTime: scheduledStartTime ? 'set' : 'null',
              scheduledEndTime: scheduledEndTime ? 'set' : 'null',
              startTimeSeconds: scheduledStartTime ? (scheduledStartTime as any).seconds : 'N/A',
              endTimeSeconds: scheduledEndTime ? (scheduledEndTime as any).seconds : 'N/A'
            }
          });
          
          const virtualLog = {
            id: `virtual_${staff.userId}_${virtualDate}`, // 가상 workLog ID (역할 제외)
            staffId: staff.userId,
            staffName: staff.name,
            eventId: jobPostingId || '',
            date: virtualDate,
            role: staff.role,
            scheduledStartTime,
            scheduledEndTime,
            actualStartTime: null,
            actualEndTime: null,
            status: 'scheduled',
            isVirtual: true,
            assignedTime: timeSlot,
            displayKey: `${staff.userId}_${staff.role}` // 같은 역할은 한 행으로 합쳐짐
          } as UnifiedWorkLog & { displayKey: string };
          
          roleBasedWorkLogs.push(virtualLog);
          processedStaffRoles.add(staffRoleKey);
        } else {
          logger.warn('No timeSlot available for staff', {
            component: 'useEnhancedPayroll',
            data: {
              staffId: staff.userId,
              staffName: staff.name,
              role: staff.role
            }
          });
        }
      }
    });
    
    // 역할 기반 workLogs 생성 완료
    logger.debug('Role-based WorkLogs created', {
      component: 'useEnhancedPayroll',
      data: {
        roleBasedWorkLogsCount: roleBasedWorkLogs.length,
        roleBasedWorkLogsDetails: roleBasedWorkLogs.map(log => ({
          id: log.id,
          staffId: log.staffId,
          date: log.date,
          role: (log as any).role,
          staffName: (log as any).staffName,
          isVirtual: (log as any).isVirtual
        }))
      }
    });
    
    // 역할 기반 workLogs를 staffId + role로 그룹화
    roleBasedWorkLogs.forEach((log, index) => {
      // workLog에 role이 있으면 우선 사용
      let role = (log as any).role;
      let staffName = (log as any).staffName || '';
      
      // workLog에 role이 없으면 confirmedStaff에서 찾기
      if (!role) {
        // 정확한 날짜와 staffId가 일치하는 staff 찾기 우선
        const matchingStaff = confirmedStaff.find(s => 
          s.userId === log.staffId && 
          s.date === log.date
        );
        
        if (matchingStaff) {
          role = matchingStaff.role;
          staffName = matchingStaff.name;
        } else {
          // 날짜 무관하게 첫 번째 매칭 찾기 (fallback)
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
      
      logger.debug('Processing WorkLog for aggregation', {
        component: 'useEnhancedPayroll',
        data: {
          workLogId: log.id,
          staffId: log.staffId,
          date: log.date,
          role,
          staffName,
          scheduledStartTime: log.scheduledStartTime ? 'set' : 'null',
          scheduledEndTime: log.scheduledEndTime ? 'set' : 'null'
        }
      });
      
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
      const uniqueDates = new Set<string>();
      
      logger.debug('Calculating payroll for role group', {
        component: 'useEnhancedPayroll',
        data: {
          key,
          staffId: data.staffId,
          staffName: data.staffName,
          role: data.role,
          workLogCount: data.workLogs.length,
          workLogDates: data.workLogs.map(log => log.date)
        }
      });
      
      // 이미 roleBasedWorkLogs 생성 과정에서 중복 방지된 WorkLog들을 재활용
      // 중복 방지를 위한 추가 처리된 WorkLog ID 추적 (이 섹션에서만 사용)
      
      data.workLogs.forEach(log => {
        // 역할별 그룹에서는 중복 체크 제거 - roleBasedWorkLogs에서 이미 중복 방지됨
        console.log('🔥 Processing WorkLog in role group:', {
          workLogId: log.id,
          staffId: log.staffId,
          role: log.role,
          date: log.date,
          hasScheduledStart: !!log.scheduledStartTime,
          hasScheduledEnd: !!log.scheduledEndTime
        });
        
        // 백업 로직 1: scheduledStartTime이 null이지만 가상 WorkLog인 경우 처리
        if (!log.scheduledStartTime && (log as any).isVirtual && (log as any).assignedTime) {
          const { scheduledStartTime, scheduledEndTime } = 
            convertAssignedTimeToScheduled((log as any).assignedTime, log.date);
          log.scheduledStartTime = scheduledStartTime;
          log.scheduledEndTime = scheduledEndTime;
          
          logger.debug('Backup logic 1: Applied assignedTime to virtual WorkLog', {
            component: 'useEnhancedPayroll',
            data: {
              workLogId: log.id,
              assignedTime: (log as any).assignedTime,
              scheduledStartTime: scheduledStartTime ? 'set' : 'null',
              scheduledEndTime: scheduledEndTime ? 'set' : 'null'
            }
          });
        }
        
        // 백업 로직 2: scheduledTime이 없지만 assignedTime이 있는 경우 (가상이 아니어도)
        if (!log.scheduledStartTime && !log.scheduledEndTime && (log as any).assignedTime) {
          const { scheduledStartTime, scheduledEndTime } = 
            convertAssignedTimeToScheduled((log as any).assignedTime, log.date);
          log.scheduledStartTime = scheduledStartTime;
          log.scheduledEndTime = scheduledEndTime;
          
          logger.debug('Backup logic 2: Applied assignedTime to WorkLog', {
            component: 'useEnhancedPayroll',
            data: {
              workLogId: log.id,
              assignedTime: (log as any).assignedTime,
              scheduledStartTime: scheduledStartTime ? 'set' : 'null',
              scheduledEndTime: scheduledEndTime ? 'set' : 'null'
            }
          });
        }
        
        // 정산 목적: scheduledEndTime(스태프탭 설정) 또는 actualEndTime(실제 퇴근) 있으면 계산
        // 모든 스케줄된 WorkLog는 시간이 있으면 정산에 포함
        if (log.scheduledEndTime || log.actualEndTime) {
          // 고유한 날짜 추가 (중복 제거)
          uniqueDates.add(log.date);
          
          // ✅ calculateHours 호출 전 상세 로깅 추가
          console.log('🚀 BEFORE calculateHours call:', {
            workLogId: log.id,
            staffId: log.staffId,
            staffName: log.staffName,
            role: log.role,
            date: log.date,
            hasScheduledStart: !!log.scheduledStartTime,
            hasScheduledEnd: !!log.scheduledEndTime,
            scheduledStartTimeRaw: log.scheduledStartTime,
            scheduledEndTimeRaw: log.scheduledEndTime,
            scheduledStartTimeType: log.scheduledStartTime ? typeof log.scheduledStartTime : 'null',
            scheduledEndTimeType: log.scheduledEndTime ? typeof log.scheduledEndTime : 'null',
            // Firebase Timestamp 디버깅
            startSeconds: log.scheduledStartTime && typeof log.scheduledStartTime === 'object' && 'seconds' in log.scheduledStartTime ? 
              (log.scheduledStartTime as any).seconds : 'N/A',
            endSeconds: log.scheduledEndTime && typeof log.scheduledEndTime === 'object' && 'seconds' in log.scheduledEndTime ? 
              (log.scheduledEndTime as any).seconds : 'N/A'
          });
          
          const hours = calculateHours(log);
          
          // ✅ calculateHours 호출 후 결과 로깅
          console.log('🎯 AFTER calculateHours call:', {
            workLogId: log.id,
            calculatedHours: hours,
            hoursType: typeof hours,
            isValidNumber: !isNaN(hours) && isFinite(hours)
          });
          
          // 계산된 시간을 WorkLog에 업데이트 (정산 화면에서 올바른 값 표시)
          log.hoursWorked = hours;
          
          // 중복 처리 방지 - WorkLog ID를 처리된 목록에 추가
          processedWorkLogIds.add(log.id);
          
          const previousTotalHours = totalHours;
          totalHours += hours;
          
          // 디버깅: 시간 계산 결과 확인
          console.log('🔥 CRITICAL DEBUG - Work hours calculated', {
            workLogId: log.id,
            staffId: log.staffId,
            role: log.role,
            date: log.date,
            calculatedHours: hours,
            previousTotalHours: previousTotalHours,
            totalHoursSoFar: totalHours,
            hasScheduledTime: !!log.scheduledEndTime,
            hasActualTime: !!log.actualEndTime,
            logHoursWorked: log.hoursWorked,
            // 추가 상세 정보
            scheduledStartTime: log.scheduledStartTime ? `${new Date((log.scheduledStartTime as any).seconds * 1000).toLocaleTimeString()}` : 'null',
            scheduledEndTime: log.scheduledEndTime ? `${new Date((log.scheduledEndTime as any).seconds * 1000).toLocaleTimeString()}` : 'null',
            logStatus: log.status,
            isVirtual: (log as any).isVirtual,
            key: key
          });
          
          logger.debug('Work hours calculated', {
            component: 'useEnhancedPayroll',
            data: {
              workLogId: log.id,
              calculatedHours: hours,
              totalHours,
              hasScheduledTime: !!log.scheduledEndTime,
              hasActualTime: !!log.actualEndTime,
              // 추가 디버깅 정보
              logHoursWorked: log.hoursWorked,
              discrepancy: hours !== log.hoursWorked ? `calculated: ${hours}, stored: ${log.hoursWorked}` : 'match',
              staffId: log.staffId,
              date: log.date,
              status: log.status
            }
          });
        }
      });
      
      // 고유 날짜 수 계산
      const totalDays = uniqueDates.size;
      
      // 최종 결과 디버깅 출력
      console.log('🔥 FINAL RESULT DEBUG - Role group calculation complete', {
        key,
        staffId: data.staffId,
        staffName: data.staffName,
        role: data.role,
        totalHours,
        totalDays,
        workLogCount: data.workLogs.length,
        workLogIds: data.workLogs.map(log => log.id),
        workLogDates: data.workLogs.map(log => log.date),
        processedWorkLogIds: Array.from(processedWorkLogIds),
        uniqueDatesArray: Array.from(uniqueDates)
      });

      logger.debug('Final calculation for role group', {
        component: 'useEnhancedPayroll',
        data: {
          key,
          totalHours,
          totalDays,
          uniqueDates: Array.from(uniqueDates)
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

  // 역할별 급여 설정 업데이트 - Firestore에 저장
  const updateRoleSalarySettings = useCallback(async (roleSalaries: RoleSalaryConfig) => {
    setRoleSalaryOverrides(roleSalaries);
    
    // Firestore에 역할별 급여 설정 저장
    if (jobPostingId) {
      try {
        const jobPostingRef = doc(db, 'jobPostings', jobPostingId);
        
        // RoleSalaryConfig를 JobPosting의 roleSalaries 형식으로 변환
        const roleSalariesForDB: { [role: string]: { salaryType: string; salaryAmount: string; customRoleName?: string } } = {};
        
        Object.entries(roleSalaries).forEach(([role, config]) => {
          roleSalariesForDB[role] = {
            salaryType: config.salaryType,
            salaryAmount: config.salaryAmount.toString(),
            ...(config.customRoleName && { customRoleName: config.customRoleName })
          };
        });
        
        await updateDoc(jobPostingRef, {
          useRoleSalary: true,
          roleSalaries: roleSalariesForDB,
          updatedAt: serverTimestamp()
        });
        
        logger.info('역할별 급여 설정 Firestore 저장 완료', {
          component: 'useEnhancedPayroll',
          operation: 'updateRoleSalarySettings',
          data: { jobPostingId, roles: Object.keys(roleSalaries) }
        });
      } catch (error) {
        logger.error('역할별 급여 설정 저장 실패', error as Error, {
          component: 'useEnhancedPayroll',
          operation: 'updateRoleSalarySettings'
        });
      }
    }
  }, [jobPostingId]);

  // 일괄 급여 편집 처리
  const handleBulkSalaryEdit = useCallback(async (update: BulkSalaryUpdate): Promise<BulkSalaryEditResult> => {
    const affectedStaff: BulkSalaryEditResult['affectedStaff'] = [];
    let successCount = 0;
    let failCount = 0;
    let totalAmountDifference = 0;

    for (const staffKey of update.targetStaffIds) {
      try {
        const parts = staffKey.split('_');
        const staffId = parts[0];
        const role = parts.slice(1).join('_');
        
        if (!staffId || !role) {
          failCount++;
          continue;
        }
        
        const staff = processedPayrollData.find(d => d.staffId === staffId && d.role === role);
        if (!staff) {
          failCount++;
          continue;
        }

        const currentSalaryInfo = getSalaryInfo(role);
        const beforeSalary = {
          type: currentSalaryInfo.salaryType,
          amount: currentSalaryInfo.salaryAmount
        };
        
        const afterSalary = {
          type: update.salaryType,
          amount: update.salaryAmount
        };

        // 급여 변경에 따른 총액 차이 계산
        const beforeTotal = staff.salaryType === 'hourly' ? 
          staff.totalHours * beforeSalary.amount :
          staff.totalDays * beforeSalary.amount;
        
        const afterTotal = update.salaryType === 'hourly' ? 
          staff.totalHours * afterSalary.amount :
          staff.totalDays * afterSalary.amount;
        
        const amountDifference = Math.round(afterTotal - beforeTotal);
        totalAmountDifference += amountDifference;

        affectedStaff.push({
          staffId,
          staffName: staff.staffName,
          role,
          beforeSalary,
          afterSalary,
          amountDifference
        });

        // 미리보기 모드가 아닌 경우에만 실제 적용
        if (!update.previewMode) {
          setRoleSalaryOverrides(prev => ({
            ...prev,
            [role]: {
              salaryType: update.salaryType,
              salaryAmount: update.salaryAmount
            }
          }));
        }

        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    return {
      affectedStaff,
      totalAmountDifference,
      successCount,
      failCount
    };
  }, [processedPayrollData, getSalaryInfo]);

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
    },
    // 새로운 기능들
    updateRoleSalarySettings,
    handleBulkSalaryEdit,
    roleSalaryOverrides
  };
};

// 역할별 정산 분리 검증 함수
// 한 스태프가 여러 역할을 가진 경우 각 역할마다 별도의 EnhancedPayrollCalculation이 생성되는지 검증
// 예시 데이터: staffId 'staff1'이 'dealer'와 'manager' 두 역할을 가진 경우
// 결과 배열에 두 개의 서로 다른 객체가 있어야 함: 
// - { staffId: 'staff1', role: 'dealer', ... }
// - { staffId: 'staff1', role: 'manager', ... }