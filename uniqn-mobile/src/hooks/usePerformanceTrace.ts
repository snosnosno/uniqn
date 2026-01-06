/**
 * UNIQN Mobile - Performance Trace Hooks
 *
 * 성능 측정을 위한 React 훅들
 *
 * @description
 * - 화면 로드 시간 자동 측정
 * - 컴포넌트 렌더링 시간 측정
 * - API 호출 시간 측정
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  performanceService,
  type PerformanceTrace,
} from '@/services/performanceService';

// =============================================================================
// useScreenPerformance
// =============================================================================

/**
 * 화면 로드 시간을 자동으로 측정하는 훅
 *
 * @param screenName - 측정할 화면 이름
 *
 * @example
 * function JobListScreen() {
 *   useScreenPerformance('JobListScreen');
 *
 *   return <View>...</View>;
 * }
 */
export function useScreenPerformance(screenName: string): void {
  const traceRef = useRef<PerformanceTrace | null>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    // 중복 시작 방지
    if (hasStarted.current) return;
    hasStarted.current = true;

    // 트레이스 시작
    traceRef.current = performanceService.startScreenTrace(screenName);

    // 화면이 마운트되면 InteractionManager를 기다린 후 측정 종료
    // React Native에서 InteractionManager가 없으면 requestAnimationFrame 사용
    const timer = requestAnimationFrame(() => {
      setTimeout(() => {
        if (traceRef.current) {
          traceRef.current.stop();
          traceRef.current = null;
        }
      }, 0);
    });

    return () => {
      cancelAnimationFrame(timer);
      // 언마운트 시 트레이스가 아직 열려있으면 닫기
      if (traceRef.current) {
        traceRef.current.stop();
        traceRef.current = null;
      }
    };
  }, [screenName]);
}

// =============================================================================
// useRenderPerformance
// =============================================================================

/**
 * 컴포넌트 렌더링 시간을 측정하는 훅
 *
 * @param componentName - 컴포넌트 이름
 * @returns 렌더 완료 콜백 함수
 *
 * @example
 * function HeavyComponent() {
 *   const onRenderComplete = useRenderPerformance('HeavyComponent');
 *
 *   useEffect(() => {
 *     onRenderComplete();
 *   }, [onRenderComplete]);
 *
 *   return <View>...</View>;
 * }
 */
export function useRenderPerformance(componentName: string): () => void {
  const startTimeRef = useRef<number>(performance.now());

  const onRenderComplete = useCallback(() => {
    const duration = performance.now() - startTimeRef.current;
    performanceService.recordRenderTime(componentName, duration);
  }, [componentName]);

  return onRenderComplete;
}

// =============================================================================
// useApiPerformance
// =============================================================================

interface UseApiPerformanceResult {
  startTrace: () => PerformanceTrace;
  wrapAsync: <T>(operation: () => Promise<T>) => Promise<T>;
}

/**
 * API 호출 시간을 측정하는 훅
 *
 * @param endpoint - API 엔드포인트 이름
 *
 * @example
 * function useJobs() {
 *   const { wrapAsync } = useApiPerformance('getJobPostings');
 *
 *   const fetchJobs = async () => {
 *     const result = await wrapAsync(async () => {
 *       return await jobService.getJobPostings();
 *     });
 *     return result;
 *   };
 * }
 */
export function useApiPerformance(endpoint: string): UseApiPerformanceResult {
  const startTrace = useCallback(() => {
    return performanceService.startApiTrace(endpoint);
  }, [endpoint]);

  const wrapAsync = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      return performanceService.measureAsync(
        `api_${endpoint}`,
        operation,
        { endpoint }
      );
    },
    [endpoint]
  );

  return { startTrace, wrapAsync };
}

// =============================================================================
// useNavigationPerformance
// =============================================================================

interface UseNavigationPerformanceResult {
  startNavigation: (toScreen: string) => void;
  endNavigation: () => void;
}

/**
 * 화면 전환 시간을 측정하는 훅
 *
 * @param fromScreen - 현재 화면 이름
 *
 * @example
 * function JobListScreen() {
 *   const { startNavigation } = useNavigationPerformance('JobListScreen');
 *
 *   const handlePress = (jobId: string) => {
 *     startNavigation('JobDetailScreen');
 *     router.push(`/jobs/${jobId}`);
 *   };
 * }
 */
export function useNavigationPerformance(
  fromScreen: string
): UseNavigationPerformanceResult {
  const startTimeRef = useRef<number | null>(null);
  const toScreenRef = useRef<string>('');

  const startNavigation = useCallback((toScreen: string) => {
    startTimeRef.current = performance.now();
    toScreenRef.current = toScreen;
  }, []);

  const endNavigation = useCallback(() => {
    if (startTimeRef.current !== null) {
      const duration = performance.now() - startTimeRef.current;
      performanceService.recordNavigationTime(
        fromScreen,
        toScreenRef.current,
        duration
      );
      startTimeRef.current = null;
    }
  }, [fromScreen]);

  return { startNavigation, endNavigation };
}

// =============================================================================
// usePerformanceMeasure
// =============================================================================

interface UsePerformanceMeasureResult {
  measure: <T>(name: string, operation: () => T) => T;
  measureAsync: <T>(name: string, operation: () => Promise<T>) => Promise<T>;
}

/**
 * 범용 성능 측정 훅
 *
 * @example
 * function MyComponent() {
 *   const { measureAsync } = usePerformanceMeasure();
 *
 *   const handleHeavyOperation = async () => {
 *     await measureAsync('heavyOperation', async () => {
 *       // ... 무거운 작업
 *     });
 *   };
 * }
 */
export function usePerformanceMeasure(): UsePerformanceMeasureResult {
  const measure = useCallback(<T>(name: string, operation: () => T): T => {
    return performanceService.measure(name, operation);
  }, []);

  const measureAsync = useCallback(
    async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
      return performanceService.measureAsync(name, operation);
    },
    []
  );

  return { measure, measureAsync };
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  useScreenPerformance,
  useRenderPerformance,
  useApiPerformance,
  useNavigationPerformance,
  usePerformanceMeasure,
};
