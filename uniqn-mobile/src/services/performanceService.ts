/**
 * UNIQN Mobile - Performance Monitoring Service
 *
 * Firebase Performance Monitoring을 사용한 성능 추적
 *
 * @description
 * - 화면 로드 시간 측정
 * - API 호출 시간 측정
 * - 커스텀 메트릭 기록
 * - 웹/네이티브 분기 처리
 *
 * @note 현재 개발용 로깅으로 동작 (Firebase Console에서 확인 가능한 전송은 미구현)
 * @note 네이티브에서 Firebase Performance를 사용하려면 @react-native-firebase/perf 설치 필요
 */

import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { isPerformanceAvailable } from '@/lib/firebase';

// =============================================================================
// Types
// =============================================================================

export interface PerformanceTrace {
  name: string;
  startTime: number;
  attributes: Record<string, string>;
  metrics: Record<string, number>;
  start: () => void;
  stop: () => void;
  putAttribute: (key: string, value: string) => void;
  putMetric: (key: string, value: number) => void;
  incrementMetric: (key: string, value?: number) => void;
}

export interface PerformanceMetrics {
  screenLoadTime: number;
  apiResponseTime: number;
  renderTime: number;
  navigationTime: number;
}

// =============================================================================
// Performance Trace Implementation
// =============================================================================

/**
 * 성능 트레이스 생성 (웹/개발용 폴백)
 */
function createTrace(name: string): PerformanceTrace {
  const startTime = performance.now();
  const attributes: Record<string, string> = {};
  const metrics: Record<string, number> = {};

  return {
    name,
    startTime,
    attributes,
    metrics,

    start() {
      // 이미 시작됨
    },

    stop() {
      const duration = performance.now() - startTime;
      metrics['duration_ms'] = duration;

      // 개발 환경에서 로깅
      if (__DEV__) {
        logger.debug(`[Performance] ${name}`, {
          duration: `${duration.toFixed(2)}ms`,
          attributes,
          metrics,
        });
      }

      // 프로덕션에서 성능 데이터 기록 (로그로 수집 가능)
      if (!__DEV__ && isPerformanceAvailable()) {
        logger.info('Performance trace', {
          name,
          duration_ms: duration,
          platform: Platform.OS,
          attributes,
          metrics,
        });
      }
    },

    putAttribute(key: string, value: string) {
      attributes[key] = value;
    },

    putMetric(key: string, value: number) {
      metrics[key] = value;
    },

    incrementMetric(key: string, value = 1) {
      metrics[key] = (metrics[key] || 0) + value;
    },
  };
}

// =============================================================================
// Performance Service
// =============================================================================

class PerformanceService {
  private traces: Map<string, PerformanceTrace> = new Map();
  private enabled: boolean = true;

  /**
   * 서비스 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 화면 로드 시간 측정 시작
   *
   * @example
   * const trace = performanceService.startScreenTrace('JobListScreen');
   * // ... 화면 로드 완료 후
   * trace.stop();
   */
  startScreenTrace(screenName: string): PerformanceTrace {
    if (!this.enabled) {
      return this.createNoopTrace();
    }

    const traceName = `screen_${screenName}`;
    const trace = createTrace(traceName);
    trace.putAttribute('screen_name', screenName);
    trace.putAttribute('platform', Platform.OS);
    trace.start();

    this.traces.set(traceName, trace);
    return trace;
  }

  /**
   * API 호출 시간 측정 시작
   *
   * @example
   * const trace = performanceService.startApiTrace('getJobPostings');
   * const result = await fetchData();
   * trace.putMetric('response_size', result.length);
   * trace.stop();
   */
  startApiTrace(endpoint: string): PerformanceTrace {
    if (!this.enabled) {
      return this.createNoopTrace();
    }

    const traceName = `api_${endpoint}`;
    const trace = createTrace(traceName);
    trace.putAttribute('endpoint', endpoint);
    trace.putAttribute('platform', Platform.OS);
    trace.start();

    this.traces.set(traceName, trace);
    return trace;
  }

  /**
   * 커스텀 트레이스 시작
   */
  startTrace(name: string): PerformanceTrace {
    if (!this.enabled) {
      return this.createNoopTrace();
    }

    const trace = createTrace(name);
    trace.start();
    this.traces.set(name, trace);
    return trace;
  }

  /**
   * 트레이스 종료
   */
  stopTrace(name: string): void {
    const trace = this.traces.get(name);
    if (trace) {
      trace.stop();
      this.traces.delete(name);
    }
  }

  /**
   * 커스텀 메트릭 기록
   */
  recordMetric(name: string, value: number): void {
    if (!this.enabled) return;

    if (__DEV__) {
      logger.debug(`[Performance Metric] ${name}: ${value}`);
    }

    // 프로덕션에서 메트릭 기록
    if (!__DEV__) {
      logger.info('Performance metric', {
        metric_name: name,
        value,
        platform: Platform.OS,
      });
    }
  }

  /**
   * 작업 시간 측정 래퍼
   *
   * @example
   * const result = await performanceService.measureAsync(
   *   'fetchJobs',
   *   async () => await jobService.getJobPostings()
   * );
   */
  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string>
  ): Promise<T> {
    const trace = this.startTrace(name);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        trace.putAttribute(key, value);
      });
    }

    try {
      const result = await operation();
      trace.putAttribute('status', 'success');
      return result;
    } catch (error) {
      trace.putAttribute('status', 'error');
      trace.putAttribute(
        'error_message',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    } finally {
      trace.stop();
    }
  }

  /**
   * 동기 작업 시간 측정 래퍼
   */
  measure<T>(
    name: string,
    operation: () => T,
    attributes?: Record<string, string>
  ): T {
    const trace = this.startTrace(name);

    if (attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        trace.putAttribute(key, value);
      });
    }

    try {
      const result = operation();
      trace.putAttribute('status', 'success');
      return result;
    } catch (error) {
      trace.putAttribute('status', 'error');
      throw error;
    } finally {
      trace.stop();
    }
  }

  /**
   * 네비게이션 시간 측정
   */
  recordNavigationTime(
    fromScreen: string,
    toScreen: string,
    duration: number
  ): void {
    if (!this.enabled) return;

    const trace = createTrace('navigation');
    trace.putAttribute('from_screen', fromScreen);
    trace.putAttribute('to_screen', toScreen);
    trace.putMetric('duration_ms', duration);
    trace.stop();
  }

  /**
   * 렌더링 시간 측정
   */
  recordRenderTime(componentName: string, duration: number): void {
    if (!this.enabled) return;

    const trace = createTrace(`render_${componentName}`);
    trace.putAttribute('component', componentName);
    trace.putMetric('duration_ms', duration);
    trace.stop();
  }

  /**
   * No-op trace (비활성화 시)
   */
  private createNoopTrace(): PerformanceTrace {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- 의도적인 no-op 패턴
    const noop = (): void => {};
    return {
      name: 'noop',
      startTime: 0,
      attributes: {},
      metrics: {},
      start: noop,
      stop: noop,
      putAttribute: noop,
      putMetric: noop,
      incrementMetric: noop,
    };
  }

  /**
   * 모든 활성 트레이스 종료
   */
  stopAllTraces(): void {
    this.traces.forEach((trace) => trace.stop());
    this.traces.clear();
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const performanceService = new PerformanceService();

// 편의 함수 export
export const startScreenTrace = performanceService.startScreenTrace.bind(
  performanceService
);
export const startApiTrace = performanceService.startApiTrace.bind(
  performanceService
);
export const startTrace = performanceService.startTrace.bind(performanceService);
export const stopTrace = performanceService.stopTrace.bind(performanceService);
export const recordMetric = performanceService.recordMetric.bind(
  performanceService
);
export const measureAsync = performanceService.measureAsync.bind(
  performanceService
);
export const measure = performanceService.measure.bind(performanceService);
export const recordNavigationTime = performanceService.recordNavigationTime.bind(
  performanceService
);
export const recordRenderTime = performanceService.recordRenderTime.bind(
  performanceService
);
export const setPerformanceEnabled = performanceService.setEnabled.bind(
  performanceService
);

export default performanceService;
