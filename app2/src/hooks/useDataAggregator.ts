/**
 * useDataAggregator - Web Worker를 활용한 데이터 집계 훅
 * Week 4 성능 최적화: 대용량 데이터 분석을 백그라운드에서 처리
 * 
 * @version 4.0
 * @since 2025-02-02 (Week 4)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  DataAggregationMessage,
  DataAggregationResult,
  DataAggregationError,
  AggregatedData,
  AggregationSummary
} from '../workers/dataAggregator.worker';
import { UnifiedWorkLog } from '../types/unified/workLog';
import { ConfirmedStaff } from '../types/jobPosting/base';
import { logger } from '../utils/logger';

interface DataAggregatorState {
  aggregatedData: AggregatedData[];
  summary: AggregationSummary | null;
  loading: boolean;
  error: string | null;
  processingTime: number;
}

interface DataAggregationParams {
  workLogs: UnifiedWorkLog[];
  confirmedStaff: ConfirmedStaff[];
  startDate?: string;
  endDate?: string;
  groupBy: 'date' | 'role' | 'staff' | 'week' | 'month';
  metrics: ('hours' | 'count' | 'attendance' | 'performance')[];
}

export const useDataAggregator = () => {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<DataAggregatorState>({
    aggregatedData: [],
    summary: null,
    loading: false,
    error: null,
    processingTime: 0
  });

  // Web Worker 초기화
  useEffect(() => {
    try {
      // Web Worker 생성
      workerRef.current = new Worker(
        new URL('../workers/dataAggregator.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // 메시지 핸들러 설정
      workerRef.current.onmessage = (
        event: MessageEvent<DataAggregationResult | DataAggregationError>
      ) => {
        if (event.data.type === 'AGGREGATION_RESULT') {
          const { aggregatedData, summary, processingTime } = event.data.payload;
          
          setState({
            aggregatedData,
            summary,
            loading: false,
            error: null,
            processingTime
          });

          logger.info('Web Worker 데이터 집계 완료', {
            component: 'useDataAggregator',
            data: {
              recordCount: aggregatedData.length,
              processingTime: Math.round(processingTime),
              totalHours: summary.totalHours,
              totalStaff: summary.totalStaff
            }
          });
        } else if (event.data.type === 'AGGREGATION_ERROR') {
          const { error, stack } = event.data.payload;
          
          setState(prev => ({
            ...prev,
            loading: false,
            error
          }));

          logger.error('Web Worker 데이터 집계 오류', new Error(error), {
            component: 'useDataAggregator',
            data: { stack }
          });
        }
      };

      // 에러 핸들러 설정
      workerRef.current.onerror = (error) => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Data Aggregator Worker 실행 오류가 발생했습니다.'
        }));

        logger.error('Data Aggregator Worker 오류', new Error(error.message || 'Unknown error'), {
          component: 'useDataAggregator'
        });
      };

      logger.info('Data Aggregator Worker 초기화 완료', {
        component: 'useDataAggregator'
      });
    } catch (error) {
      logger.error('Data Aggregator Worker 생성 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'useDataAggregator'
      });

      setState(prev => ({
        ...prev,
        error: 'Data Aggregator Worker를 지원하지 않는 브라우저입니다.'
      }));
    }

    // 클리너드 함수
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        
        logger.info('Data Aggregator Worker 종료', {
          component: 'useDataAggregator'
        });
      }
    };
  }, []);

  // 데이터 집계 실행
  const aggregateData = useCallback(async (params: DataAggregationParams) => {
    if (!workerRef.current) {
      logger.warn('Data Aggregator Worker가 초기화되지 않았습니다.', {
        component: 'useDataAggregator'
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
      const message: DataAggregationMessage = {
        type: 'AGGREGATE_DATA',
        payload: params
      };

      logger.info('Web Worker로 데이터 집계 요청', {
        component: 'useDataAggregator',
        data: {
          workLogsCount: params.workLogs.length,
          confirmedStaffCount: params.confirmedStaff.length,
          groupBy: params.groupBy,
          metrics: params.metrics,
          period: params.startDate && params.endDate ? 
            `${params.startDate} ~ ${params.endDate}` : 'All'
        }
      });

      workerRef.current.postMessage(message);
    } catch (error) {
      const requestTime = performance.now() - startTime;
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: '데이터 집계 요청 중 오류가 발생했습니다.'
      }));

      logger.error('데이터 집계 요청 실패', error instanceof Error ? error : new Error(String(error)), {
        component: 'useDataAggregator',
        data: { requestTime }
      });
    }
  }, []);

  // Web Worker 상태 확인
  const isWorkerReady = useCallback(() => {
    return workerRef.current !== null;
  }, []);

  // 집계 취소 (Worker 재시작)
  const cancelAggregation = useCallback(() => {
    if (workerRef.current && state.loading) {
      workerRef.current.terminate();
      
      // 새 Worker 생성
      try {
        workerRef.current = new Worker(
          new URL('../workers/dataAggregator.worker.ts', import.meta.url),
          { type: 'module' }
        );

        setState(prev => ({
          ...prev,
          loading: false,
          error: null
        }));

        logger.info('데이터 집계 취소 및 Worker 재시작', {
          component: 'useDataAggregator'
        });
      } catch (error) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Worker 재시작에 실패했습니다.'
        }));

        logger.error('Data Aggregator Worker 재시작 실패', error instanceof Error ? error : new Error(String(error)), {
          component: 'useDataAggregator'
        });
      }
    }
  }, [state.loading]);

  // 데이터 내보내기 (CSV)
  const exportToCSV = useCallback((filename?: string) => {
    if (state.aggregatedData.length === 0) {
      logger.warn('내보낼 데이터가 없습니다.', {
        component: 'useDataAggregator'
      });
      return;
    }

    const headers = [
      '그룹',
      '총 시간',
      '작업 수',
      '스태프 수',
      '출석률',
      '완료율',
      '스태프당 평균 시간',
      '일평균 시간'
    ];

    const rows = state.aggregatedData.map(item => [
      item.displayName,
      item.metrics.totalHours.toString(),
      item.metrics.workLogCount.toString(),
      item.metrics.staffCount.toString(),
      `${item.metrics.attendanceRate}%`,
      `${item.metrics.completionRate}%`,
      item.metrics.averageHoursPerStaff.toString(),
      item.metrics.averageHoursPerDay.toString()
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
    
    const defaultFilename = `데이터_집계_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename || defaultFilename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logger.info('데이터 집계 결과 CSV 내보내기 완료', {
      component: 'useDataAggregator',
      data: { 
        filename: filename || defaultFilename,
        recordCount: state.aggregatedData.length 
      }
    });
  }, [state.aggregatedData]);

  // 성능 메트릭
  const getPerformanceMetrics = useCallback(() => {
    return {
      processingTime: state.processingTime,
      recordsPerSecond: state.processingTime > 0 ? 
        Math.round((state.aggregatedData.length / state.processingTime) * 1000) : 0,
      isOptimized: state.processingTime < 500, // 0.5초 이하면 최적화됨
      efficiency: state.processingTime > 0 && state.summary ? 
        Math.round((state.summary.totalRecords / state.processingTime) * 100) / 100 : 0,
      workerStatus: isWorkerReady() ? 'ready' : 'not_ready'
    };
  }, [state.processingTime, state.aggregatedData.length, state.summary, isWorkerReady]);

  // 상위 성과자 정보 (편의 메서드)
  const getTopPerformers = useCallback((metric: 'hours' | 'avg_hours' = 'hours') => {
    return state.summary?.topPerformers.filter(p => p.metric === metric) || [];
  }, [state.summary]);

  // 트렌드 분석 (편의 메서드)
  const getTrends = useCallback(() => {
    return state.summary?.trends || {
      hoursGrowth: 0,
      staffGrowth: 0,
      attendanceImprovement: 0
    };
  }, [state.summary]);

  return {
    // 집계 결과
    aggregatedData: state.aggregatedData,
    summary: state.summary,
    
    // 상태
    loading: state.loading,
    error: state.error,
    processingTime: state.processingTime,
    
    // 액션
    aggregateData,
    cancelAggregation,
    exportToCSV,
    
    // 유틸리티
    isWorkerReady,
    getPerformanceMetrics,
    getTopPerformers,
    getTrends,
    
    // 성능 정보
    isOptimized: state.processingTime > 0 && state.processingTime < 500,
    recordsPerSecond: state.processingTime > 0 ? 
      Math.round((state.aggregatedData.length / state.processingTime) * 1000) : 0
  };
};

export default useDataAggregator;