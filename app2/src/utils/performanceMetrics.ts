/**
 * 성능 메트릭 수집 유틸리티
 *
 * 기능:
 * - 결제 완료 시간 측정
 * - 페이지 로드 시간 측정
 * - API 응답 시간 측정
 * - Web Vitals 수집
 *
 * 사용법:
 * ```typescript
 * import { trackPaymentPerformance, trackPageLoad } from './utils/performanceMetrics';
 *
 * // 결제 플로우 성능 측정
 * const tracker = trackPaymentPerformance('checkout');
 * // ... 결제 로직
 * tracker.end({ orderId, amount });
 *
 * // 페이지 로드 측정
 * trackPageLoad('/payment/success');
 * ```
 */

import { logger } from './logger';
import { addBreadcrumb } from './sentry';

/**
 * 성능 메트릭 타입
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Web Vitals 메트릭
 */
export interface WebVitals {
  // Largest Contentful Paint (최대 콘텐츠풀 페인트)
  LCP?: number;
  // First Input Delay (최초 입력 지연)
  FID?: number;
  // Cumulative Layout Shift (누적 레이아웃 이동)
  CLS?: number;
  // First Contentful Paint (최초 콘텐츠풀 페인트)
  FCP?: number;
  // Time to First Byte (첫 바이트까지의 시간)
  TTFB?: number;
}

/**
 * 성능 메트릭 저장소 (메모리)
 */
const metricsStore: PerformanceMetric[] = [];
const MAX_METRICS = 100; // 최대 100개까지 메모리에 저장

/**
 * 성능 메트릭 기록
 *
 * @param metric 메트릭 객체
 */
export const recordMetric = (metric: PerformanceMetric): void => {
  // 메모리에 저장
  metricsStore.push(metric);

  // 최대 개수 초과 시 오래된 메트릭 제거
  if (metricsStore.length > MAX_METRICS) {
    metricsStore.shift();
  }

  // 로깅
  logger.info(`📊 Performance: ${metric.name}`, {
    operation: 'performance',
    additionalData: {
      value: metric.value,
      unit: metric.unit,
      ...metric.metadata,
    },
  });

  // Sentry 브레드크럼 추가
  addBreadcrumb(
    `Performance: ${metric.name} = ${metric.value}${metric.unit}`,
    'performance',
    metric.metadata
  );
};

/**
 * 타이머 시작
 *
 * @param name 메트릭 이름
 * @returns 타이머 객체
 */
export const startTimer = (name: string) => {
  const startTime = performance.now();
  const startTimestamp = Date.now();

  return {
    /**
     * 타이머 종료 및 메트릭 기록
     *
     * @param metadata 추가 메타데이터
     */
    end: (metadata?: Record<string, unknown>) => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      recordMetric({
        name,
        value: Math.round(duration),
        unit: 'ms',
        timestamp: startTimestamp,
        metadata,
      });

      return duration;
    },
  };
};

/**
 * 결제 플로우 성능 추적
 *
 * @param step 결제 단계 (checkout, payment, success)
 * @returns 타이머 객체
 */
export const trackPaymentPerformance = (step: 'checkout' | 'payment' | 'success') => {
  return startTimer(`payment.${step}`);
};

/**
 * API 호출 성능 추적
 *
 * @param apiName API 이름
 * @param fn API 호출 함수
 * @returns API 호출 결과
 */
export const trackApiCall = async <T>(
  apiName: string,
  fn: () => Promise<T>
): Promise<T> => {
  const timer = startTimer(`api.${apiName}`);

  try {
    const result = await fn();
    timer.end({ status: 'success' });
    return result;
  } catch (error) {
    timer.end({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

/**
 * 페이지 로드 성능 측정
 *
 * @param pageName 페이지 이름
 */
export const trackPageLoad = (pageName: string): void => {
  // Performance API 사용 가능 여부 확인
  if (!window.performance || !window.performance.timing) {
    return;
  }

  const timing = window.performance.timing;

  // 페이지 로드 완료 후 측정
  if (document.readyState === 'complete') {
    measurePageLoad(pageName, timing);
  } else {
    window.addEventListener('load', () => {
      // 약간의 지연 후 측정 (정확한 값을 위해)
      setTimeout(() => {
        measurePageLoad(pageName, timing);
      }, 0);
    });
  }
};

/**
 * 페이지 로드 측정 헬퍼
 */
const measurePageLoad = (pageName: string, timing: PerformanceTiming): void => {
  const loadTime = timing.loadEventEnd - timing.navigationStart;
  const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
  const responseTime = timing.responseEnd - timing.requestStart;

  recordMetric({
    name: `page.load.${pageName}`,
    value: loadTime,
    unit: 'ms',
    timestamp: Date.now(),
    metadata: {
      domReady: domReadyTime,
      responseTime,
    },
  });
};

/**
 * Web Vitals 측정 (Core Web Vitals)
 */
export const measureWebVitals = (): void => {
  // Performance Observer API 사용 가능 여부 확인
  if (!window.PerformanceObserver) {
    return;
  }

  // LCP (Largest Contentful Paint)
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      if (lastEntry) {
        recordMetric({
          name: 'webvitals.LCP',
          value: Math.round(lastEntry.startTime),
          unit: 'ms',
          timestamp: Date.now(),
        });
      }
    });

    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // LCP 측정 실패 (조용히 무시)
  }

  // FID (First Input Delay)
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;

        recordMetric({
          name: 'webvitals.FID',
          value: Math.round(fid),
          unit: 'ms',
          timestamp: Date.now(),
        });
      });
    });

    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    // FID 측정 실패 (조용히 무시)
  }

  // CLS (Cumulative Layout Shift)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });

      recordMetric({
        name: 'webvitals.CLS',
        value: Math.round(clsValue * 1000) / 1000, // 소수점 3자리
        unit: 'count',
        timestamp: Date.now(),
      });
    });

    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    // CLS 측정 실패 (조용히 무시)
  }

  // FCP (First Contentful Paint)
  try {
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        recordMetric({
          name: 'webvitals.FCP',
          value: Math.round(entry.startTime),
          unit: 'ms',
          timestamp: Date.now(),
        });
      });
    });

    fcpObserver.observe({ type: 'paint', buffered: true });
  } catch (e) {
    // FCP 측정 실패 (조용히 무시)
  }
};

/**
 * 모든 메트릭 조회
 *
 * @returns 메트릭 배열
 */
export const getMetrics = (): PerformanceMetric[] => {
  return [...metricsStore];
};

/**
 * 특정 메트릭 조회
 *
 * @param name 메트릭 이름
 * @returns 메트릭 배열
 */
export const getMetricsByName = (name: string): PerformanceMetric[] => {
  return metricsStore.filter((m) => m.name === name);
};

/**
 * 메트릭 초기화
 */
export const clearMetrics = (): void => {
  metricsStore.length = 0;
};

/**
 * 메트릭 통계 계산
 *
 * @param name 메트릭 이름
 * @returns 통계 객체
 */
export const getMetricStats = (name: string) => {
  const metrics = getMetricsByName(name);

  if (metrics.length === 0) {
    return null;
  }

  const values = metrics.map((m) => m.value);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  // 중앙값 계산
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? ((sorted[mid - 1] || 0) + (sorted[mid] || 0)) / 2
    : (sorted[mid] || 0);

  return {
    name,
    count: metrics.length,
    sum,
    avg: Math.round(avg * 100) / 100,
    min,
    max,
    median,
    unit: metrics[0]?.unit || 'ms',
  };
};

/**
 * 성능 리포트 생성
 *
 * @returns 성능 리포트 문자열
 */
export const generatePerformanceReport = (): string => {
  const uniqueNames = Array.from(new Set(metricsStore.map((m) => m.name)));
  const stats = uniqueNames.map((name) => getMetricStats(name)).filter(Boolean);

  if (stats.length === 0) {
    return '성능 메트릭이 없습니다.';
  }

  const lines = [
    '=== 성능 메트릭 리포트 ===',
    '',
    ...stats.map((s) =>
      `${s!.name}: avg=${s!.avg}${s!.unit}, min=${s!.min}, max=${s!.max}, median=${s!.median}, count=${s!.count}`
    ),
    '',
    `총 메트릭 수: ${metricsStore.length}`,
  ];

  return lines.join('\n');
};

export default {
  recordMetric,
  startTimer,
  trackPaymentPerformance,
  trackApiCall,
  trackPageLoad,
  measureWebVitals,
  getMetrics,
  getMetricsByName,
  clearMetrics,
  getMetricStats,
  generatePerformanceReport,
};
