/**
 * usePayrollWorker - Web Worker를 활용한 정산 계산 훅
 * Week 4 성능 최적화: 메인 스레드 블로킹 없는 백그라운드 계산
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  PayrollCalculationMessage, 
  PayrollCalculationResult, 
  PayrollCalculationError 
} from '../workers/payrollCalculator.worker';
import { EnhancedPayrollCalculation, PayrollSummary } from '../types/payroll';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { JobPosting } from '../types/jobPosting';
import { logger } from '../utils/logger';

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

          logger.info('Web Worker 정산 계산 완료', {
            component: 'usePayrollWorker',
            data: {
              staffCount: payrollData.length,
              calculationTime: Math.round(calculationTime),
              totalAmount: summary.totalAmount
            }
          });
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

      logger.info('Web Worker 초기화 완료', {
        component: 'usePayrollWorker'
      });
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
        
        logger.info('Web Worker 종료', {
          component: 'usePayrollWorker'
        });
      }
    };
  }, []);

  // 정산 계산 실행
  const calculatePayroll = useCallback(async (params: PayrollCalculationParams) => {
    if (!workerRef.current) {
      logger.warn('Web Worker가 초기화되지 않았습니다.', {
        component: 'usePayrollWorker'
      });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    const startTime = performance.now();

    try {
      const message: PayrollCalculationMessage = {
        type: 'CALCULATE_PAYROLL',
        payload: params
      };

      logger.info('Web Worker로 정산 계산 요청', {
        component: 'usePayrollWorker',
        data: {
          workLogsCount: params.workLogs.length,
          confirmedStaffCount: params.confirmedStaff.length,
          period: `${params.startDate} ~ ${params.endDate}`
        }
      });

      workerRef.current.postMessage(message);
    } catch (error) {
      const requestTime = performance.now() - startTime;
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: '정산 계산 요청 중 오류가 발생했습니다.'
      }));

      logger.error('정산 계산 요청 실패', error instanceof Error ? error : new Error(String(error)), {
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

        logger.info('정산 계산 취소 및 Worker 재시작', {
          component: 'usePayrollWorker'
        });
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