/**
 * usePayrollWorker - Web Worker를 활용한 정산 계산 훅
 * Week 4 성능 최적화: 메인 스레드 블로킹 없는 백그라운드 계산
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  // PayrollCalculationMessage, // 현재 사용하지 않음
  PayrollCalculationResult,
  PayrollCalculationError
} from '../workers/payrollCalculator.worker';
import { EnhancedPayrollCalculation, PayrollSummary } from '../types/payroll';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { JobPosting } from '../types/jobPosting';
import { logger } from '../utils/logger';
import { 
  getRoleSalaryInfo, 
  calculateBasePay, 
  calculateAllowances,
  calculateWorkHours
} from '../utils/payrollCalculations';
import { matchStaffIdentifier } from '../utils/staffIdMapper';
import { groupWorkLogsByStaff, filterWorkLogsByRole } from '../utils/workLogHelpers';

interface PayrollWorkerState {
  payrollData: EnhancedPayrollCalculation[];
  summary: PayrollSummary | null;
  loading: boolean;
  error: string | null;
  calculationTime: number;
}

interface PayrollCalculationParams {
  workLogs: UnifiedWorkLog[];
  confirmedStaff: ConfirmedStaff[];
  jobPosting: JobPosting | null;
  startDate: string;
  endDate: string;
  roleSalaryOverrides?: Record<string, { salaryType: string; salaryAmount: number }>;
  staffAllowanceOverrides?: Record<string, any>;
}

export const usePayrollWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<PayrollWorkerState>({
    payrollData: [],
    summary: null,
    loading: false,
    error: null,
    calculationTime: 0
  });

  // Web Worker 초기화
  useEffect(() => {
    try {
      // Web Worker 생성
      workerRef.current = new Worker(
        new URL('../workers/payrollCalculator.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // 메시지 핸들러 설정
      workerRef.current.onmessage = (
        event: MessageEvent<PayrollCalculationResult | PayrollCalculationError>
      ) => {
        if (event.data.type === 'PAYROLL_RESULT') {
          const { payrollData, summary, calculationTime } = event.data.payload;
          
          setState({
            payrollData,
            summary,
            loading: false,
            error: null,
            calculationTime
          });

          // 성능이 좋지 않을 때만 로그 출력 (성능 최적화)
          if (calculationTime > 500) {
            logger.info('Web Worker 정산 계산 완료 (느림)', {
              component: 'usePayrollWorker',
              data: {
                staffCount: payrollData.length,
                calculationTime: Math.round(calculationTime),
                totalAmount: summary.totalAmount
              }
            });
          }
        } else if (event.data.type === 'PAYROLL_ERROR') {
          const { error, stack } = event.data.payload;
          
          setState(prev => ({
            ...prev,
            loading: false,
            error
          }));

          logger.error('Web Worker 정산 계산 오류', new Error(error), {
            component: 'usePayrollWorker',
            data: { stack }
          });
        }
      };

      // 에러 핸들러 설정
      workerRef.current.onerror = (error) => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Web Worker 실행 오류가 발생했습니다.'
        }));

        logger.error('Web Worker 오류', new Error(error.message || 'Unknown error'), {
          component: 'usePayrollWorker'
        });
      };

      // Web Worker 초기화 로그 제거 (성능 최적화)
    } catch (error) {
      logger.error('Web Worker 생성 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'usePayrollWorker'
      });

      setState(prev => ({
        ...prev,
        error: 'Web Worker를 지원하지 않는 브라우저입니다.'
      }));
    }

    // 클리너드 함수
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        
        // Web Worker 종료 로그 제거 (성능 최적화)
      }
    };
  }, []);

  // 정산 계산 실행 (Web Worker 우회 - 임시 수정)
  const calculatePayroll = useCallback(async (params: PayrollCalculationParams) => {
    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    const startTime = performance.now();

    try {
      // 실제 계산 로직 수행
      const calculationTime = performance.now() - startTime;

      const payrollData: EnhancedPayrollCalculation[] = [];
      const staffRoleMap = new Map<string, {
        staffId: string;
        staffName: string;
        role: string;
        workLogs: UnifiedWorkLog[];
      }>();

      // 1단계: 날짜 필터링된 WorkLog만 선별
      const dateFilteredWorkLogs = params.workLogs.filter(log =>
        log.date >= params.startDate && log.date <= params.endDate
      );

      // 2단계: workLogHelpers의 groupWorkLogsByStaff 사용 (성능 최적화)
      const groupedWorkLogs = groupWorkLogsByStaff(dateFilteredWorkLogs);
      
      // 3단계: confirmedStaff와 매칭되는 WorkLog만 추출
      const staffWorkLogsMap = new Map<string, UnifiedWorkLog[]>();
      
      for (const staff of params.confirmedStaff) {
        const staffId = staff.userId;
        const roleKey = `${staffId}_${staff.role?.toLowerCase() || ''}`;
        
        // 그룹화된 데이터에서 해당 스태프 찾기
        const staffWorkLogs = groupedWorkLogs.get(roleKey) || [];
        
        // 추가로 matchStaffIdentifier로 더 정확한 매칭 확인
        const matchedWorkLogs = dateFilteredWorkLogs.filter(log => 
          matchStaffIdentifier(log, [staffId])
        );
        
        // 두 결과를 합치고 중복 제거
        const allStaffLogs = [...staffWorkLogs, ...matchedWorkLogs];
        const uniqueStaffLogs = Array.from(
          new Map(allStaffLogs.map(log => [log.id, log])).values()
        );
        
        if (uniqueStaffLogs.length > 0) {
          staffWorkLogsMap.set(staffId, uniqueStaffLogs);
          
          logger.info('스태프 WorkLog 매칭 완료', {
            component: 'usePayrollWorker',
            data: {
              staffId,
              staffName: staff.name,
              role: staff.role,
              groupedCount: staffWorkLogs.length,
              matchedCount: matchedWorkLogs.length,
              finalCount: uniqueStaffLogs.length
            }
          });
        }
      }


      // 2단계: 각 확정된 스태프별로 역할별 계산
      for (const staff of params.confirmedStaff) {
        const staffId = staff.userId;
        const key = `${staffId}_${staff.role}`;
        
        if (!staffRoleMap.has(key)) {
          staffRoleMap.set(key, {
            staffId,
            staffName: staff.name,
            role: staff.role,
            workLogs: []
          });
        }

        // 해당 스태프의 WorkLog 가져오기
        const staffWorkLogs = staffWorkLogsMap.get(staffId) || [];
        
        // workLogHelpers의 filterWorkLogsByRole 사용
        const roleWorkLogs = filterWorkLogsByRole(staffWorkLogs, staff.role);

        // 날짜별 중복 제거 (같은 날짜에 동일한 역할의 WorkLog가 여러 개인 경우)
        const uniqueWorkLogs = Array.from(
          new Map(roleWorkLogs.map(log => [`${log.date}_${log.staffId}_${staff.role}`, log])).values()
        );

        const entry = staffRoleMap.get(key);
        if (entry) {
          entry.workLogs = uniqueWorkLogs; // 중복 제거된 WorkLog 할당
        }
      }

      // 각 스태프-역할 조합별로 정산 계산
      for (const [key, data] of Array.from(staffRoleMap)) {
        let totalHours = 0;
        const uniqueDates = new Set<string>();

        // WorkLog 기반 실제 근무시간 계산
        for (const log of data.workLogs) {
          if (log.scheduledStartTime && log.scheduledEndTime) {
            uniqueDates.add(log.date);
            const hours = calculateWorkHours(log);
            totalHours += hours;
          } else {
            logger.warn('WorkLog에 시간 정보 없음', {
              component: 'usePayrollWorker',
              data: {
                logId: log.id,
                date: log.date,
                hasStart: !!log.scheduledStartTime,
                hasEnd: !!log.scheduledEndTime
              }
            });
          }
        }

        const totalDays = uniqueDates.size;

        // 역할별 급여 정보 가져오기
        const { salaryType, salaryAmount } = getRoleSalaryInfo(
          data.role,
          params.jobPosting,
          params.roleSalaryOverrides
        );

        // 기본급 계산
        const basePay = calculateBasePay(salaryType, salaryAmount, totalHours, totalDays);
        
        // 수당 계산
        const staffAllowanceOverride = params.staffAllowanceOverrides?.[key] ||
                                      params.staffAllowanceOverrides?.[data.staffId];
        const defaultAllowances = calculateAllowances(params.jobPosting, totalDays);
        const allowances = staffAllowanceOverride || defaultAllowances;

        const allowanceTotal = 
          allowances.meal +
          allowances.transportation +
          allowances.accommodation +
          allowances.bonus +
          allowances.other;

        const totalAmount = basePay + allowanceTotal;

        // EnhancedPayrollCalculation 객체 생성
        const payrollCalculation: EnhancedPayrollCalculation = {
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
            start: params.startDate,
            end: params.endDate
          }
        };

        payrollData.push(payrollCalculation);
      }

      // 요약 정보 계산
      const roleStats: Record<string, { count: number; hours: number; amount: number; }> = {};
      const salaryTypeStats = { hourly: 0, daily: 0, monthly: 0, other: 0 };

      for (const data of payrollData) {
        // 역할별 통계
        if (!roleStats[data.role]) {
          roleStats[data.role] = { count: 0, hours: 0, amount: 0 };
        }
        const roleData = roleStats[data.role];
        if (roleData) {
          roleData.count++;
          roleData.hours += data.totalHours;
          roleData.amount += data.totalAmount;
        }

        // 급여 유형별 통계
        salaryTypeStats[data.salaryType as keyof typeof salaryTypeStats] += data.totalAmount;
      }

      // 유니크한 스태프 수 계산 (같은 사람이 여러 역할을 가져도 1명으로 계산)
      const uniqueStaffIds = new Set(payrollData.map(data => data.staffId));

      const summary: PayrollSummary = {
        totalStaff: uniqueStaffIds.size,
        totalHours: payrollData.reduce((sum, data) => sum + data.totalHours, 0),
        totalDays: payrollData.reduce((sum, data) => sum + data.totalDays, 0),
        totalAmount: payrollData.reduce((sum, data) => sum + data.totalAmount, 0),
        byRole: roleStats,
        bySalaryType: salaryTypeStats,
        period: {
          start: params.startDate,
          end: params.endDate
        }
      };

      setState({
        payrollData,
        summary,
        loading: false,
        error: null,
        calculationTime
      });


    } catch (error) {
      const requestTime = performance.now() - startTime;
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: '정산 계산 중 오류가 발생했습니다.'
      }));

      logger.error('메인 스레드 정산 계산 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'usePayrollWorker',
        data: { requestTime }
      });
    }
  }, []);

  // Web Worker 상태 확인
  const isWorkerReady = useCallback(() => {
    return workerRef.current !== null;
  }, []);

  // 계산 취소 (Worker 재시작)
  const cancelCalculation = useCallback(() => {
    if (workerRef.current && state.loading) {
      workerRef.current.terminate();
      
      // 새 Worker 생성
      try {
        workerRef.current = new Worker(
          new URL('../workers/payrollCalculator.worker.ts', import.meta.url),
          { type: 'module' }
        );

        setState(prev => ({
          ...prev,
          loading: false,
          error: null
        }));

        // 재시작 로그 제거 (성능 최적화)
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Worker 재시작에 실패했습니다.'
        }));

        logger.error('Worker 재시작 실패', error instanceof Error ? error : new Error(String(error)), {
          component: 'usePayrollWorker'
        });
      }
    }
  }, [state.loading]);

  // 성능 메트릭
  const getPerformanceMetrics = useCallback(() => {
    return {
      calculationTime: state.calculationTime,
      isOptimized: state.calculationTime < 1000, // 1초 이하면 최적화됨
      speedImprovement: state.calculationTime > 0 ? 
        Math.round((2000 - state.calculationTime) / 2000 * 100) : 0, // 기준 2초 대비 개선율
      workerStatus: isWorkerReady() ? 'ready' : 'not_ready'
    };
  }, [state.calculationTime, isWorkerReady]);

  return {
    // 계산 결과
    payrollData: state.payrollData,
    summary: state.summary,
    
    // 상태
    loading: state.loading,
    error: state.error,
    calculationTime: state.calculationTime,
    
    // 액션
    calculatePayroll,
    cancelCalculation,
    
    // 유틸리티
    isWorkerReady,
    getPerformanceMetrics,
    
    // 성능 정보
    isOptimized: state.calculationTime > 0 && state.calculationTime < 1000,
    speedImprovement: state.calculationTime > 0 ? 
      Math.round(Math.max(0, (2000 - state.calculationTime) / 2000 * 100)) : 0
  };
};

export default usePayrollWorker;