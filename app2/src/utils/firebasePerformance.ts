/**
 * Firebase Performance Monitoring 설정
 *
 * 애플리케이션의 성능 메트릭을 추적하고 모니터링합니다.
 */

import { getPerformance, trace } from 'firebase/performance';
import { app } from '../firebase';
import { logger } from './logger';

// Performance 인스턴스 초기화
let performance: ReturnType<typeof getPerformance> | null = null;

/**
 * Firebase Performance 초기화
 */
export const initializePerformance = () => {
  try {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      performance = getPerformance(app);
      logger.info('Firebase Performance 초기화 완료');

      // 자동 추적 활성화
      // Performance SDK는 자동으로 다음을 추적합니다:
      // - 페이지 로드 시간
      // - HTTP/HTTPS 네트워크 요청
      // - 화면 렌더링 시간
    }
  } catch (error) {
    logger.error('Firebase Performance 초기화 실패', error as Error);
  }
};

/**
 * 커스텀 트레이스 시작
 * @param traceName 트레이스 이름
 */
export const startTrace = (traceName: string) => {
  if (!performance) return null;

  try {
    const customTrace = trace(performance, traceName);
    customTrace.start();
    return customTrace;
  } catch (error) {
    logger.error(`트레이스 시작 실패: ${traceName}`, error as Error);
    return null;
  }
};

/**
 * 커스텀 메트릭 추가
 * @param customTrace 트레이스 객체
 * @param metricName 메트릭 이름
 * @param value 메트릭 값
 */
export const putMetric = (
  customTrace: ReturnType<typeof trace> | null,
  metricName: string,
  value: number
) => {
  if (!customTrace) return;

  try {
    customTrace.putMetric(metricName, value);
  } catch (error) {
    logger.error(`메트릭 추가 실패: ${metricName}`, error as Error);
  }
};

/**
 * 커스텀 속성 추가
 * @param customTrace 트레이스 객체
 * @param attributeName 속성 이름
 * @param value 속성 값
 */
export const putAttribute = (
  customTrace: ReturnType<typeof trace> | null,
  attributeName: string,
  value: string
) => {
  if (!customTrace) return;

  try {
    customTrace.putAttribute(attributeName, value);
  } catch (error) {
    logger.error(`속성 추가 실패: ${attributeName}`, error as Error);
  }
};

/**
 * 트레이스 종료
 * @param customTrace 트레이스 객체
 */
export const stopTrace = (customTrace: ReturnType<typeof trace> | null) => {
  if (!customTrace) return;

  try {
    customTrace.stop();
  } catch (error) {
    logger.error('트레이스 종료 실패', error as Error);
  }
};

/**
 * 데이터베이스 작업 성능 측정
 * @param operationName 작업 이름
 * @param operation 실행할 작업
 */
export const measureDatabaseOperation = async <T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> => {
  const trace = startTrace(`db_${operationName}`);
  const startTime = performance ? window.performance.now() : 0;

  try {
    const result = await operation();

    if (trace && performance) {
      const duration = window.performance.now() - startTime;
      putMetric(trace, 'duration', Math.round(duration));
      putAttribute(trace, 'operation', operationName);
      putAttribute(trace, 'status', 'success');
    }

    return result;
  } catch (error) {
    if (trace) {
      putAttribute(trace, 'status', 'error');
      putAttribute(trace, 'error', (error as Error).message);
    }
    throw error;
  } finally {
    stopTrace(trace);
  }
};

/**
 * API 호출 성능 측정
 * @param apiName API 이름
 * @param apiCall API 호출 함수
 */
export const measureApiCall = async <T>(apiName: string, apiCall: () => Promise<T>): Promise<T> => {
  const trace = startTrace(`api_${apiName}`);
  const startTime = performance ? window.performance.now() : 0;

  try {
    const result = await apiCall();

    if (trace && performance) {
      const duration = window.performance.now() - startTime;
      putMetric(trace, 'response_time', Math.round(duration));
      putAttribute(trace, 'api', apiName);
      putAttribute(trace, 'status', 'success');
    }

    return result;
  } catch (error) {
    if (trace) {
      putAttribute(trace, 'status', 'error');
      putAttribute(trace, 'error', (error as Error).message);
    }
    throw error;
  } finally {
    stopTrace(trace);
  }
};

/**
 * 컴포넌트 렌더링 성능 측정
 * @param componentName 컴포넌트 이름
 */
export const measureComponentRender = (componentName: string) => {
  const trace = startTrace(`component_${componentName}`);

  return {
    start: () => {
      if (trace) {
        putAttribute(trace, 'component', componentName);
      }
    },
    stop: () => {
      stopTrace(trace);
    },
  };
};

/**
 * 페이지 로드 성능 측정
 * @param pageName 페이지 이름
 */
export const measurePageLoad = (pageName: string) => {
  const trace = startTrace(`page_${pageName}`);

  if (trace) {
    putAttribute(trace, 'page', pageName);

    // 페이지 로드 관련 메트릭 추가
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
      const renderTime = timing.domComplete - timing.domLoading;

      putMetric(trace, 'page_load_time', loadTime);
      putMetric(trace, 'dom_ready_time', domReadyTime);
      putMetric(trace, 'render_time', renderTime);
    }
  }

  return trace;
};

/**
 * 이미지 로드 성능 측정
 * @param imageSrc 이미지 소스
 */
export const measureImageLoad = (imageSrc: string) => {
  const trace = startTrace('image_load');

  if (trace) {
    putAttribute(trace, 'image_src', imageSrc);
  }

  return {
    onLoad: () => {
      if (trace) {
        putAttribute(trace, 'status', 'loaded');
      }
      stopTrace(trace);
    },
    onError: () => {
      if (trace) {
        putAttribute(trace, 'status', 'error');
      }
      stopTrace(trace);
    },
  };
};
