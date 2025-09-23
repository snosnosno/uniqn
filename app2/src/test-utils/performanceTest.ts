/**
 * 성능 테스트 유틸리티
 * 애플리케이션 성능 측정 및 검증
 */

import React from 'react';
import { performance } from 'perf_hooks';

// 메모리 정보 타입 정의
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// 성능 메트릭 타입 정의
export interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: MemoryInfo | undefined;
  bundleSize?: number | undefined;
  apiResponseTime?: number | undefined;
  databaseQueryTime?: number | undefined;
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
}

// 성능 임계값 설정
export const PERFORMANCE_THRESHOLDS = {
  LOAD_TIME_MAX: 3000, // 3초
  RENDER_TIME_MAX: 1000, // 1초
  MEMORY_USAGE_MAX: 100 * 1024 * 1024, // 100MB
  BUNDLE_SIZE_MAX: 2 * 1024 * 1024, // 2MB
  API_RESPONSE_TIME_MAX: 500, // 500ms
  DATABASE_QUERY_TIME_MAX: 200, // 200ms
  ERROR_RATE_MAX: 0.01, // 1%
  REQUESTS_PER_SECOND_MIN: 100, // 100 RPS
};

/**
 * 페이지 로드 시간 측정
 */
export const measurePageLoadTime = async (
  navigateFn: () => Promise<void>
): Promise<number> => {
  const startTime = performance.now();
  await navigateFn();
  const endTime = performance.now();
  return endTime - startTime;
};

/**
 * 컴포넌트 렌더링 시간 측정
 */
export const measureRenderTime = (renderFn: () => void): number => {
  const startTime = performance.now();
  renderFn();
  const endTime = performance.now();
  return endTime - startTime;
};

/**
 * 메모리 사용량 측정
 */
export const measureMemoryUsage = (): MemoryInfo | null => {
  if (typeof window !== 'undefined' && (window.performance as any).memory) {
    return (window.performance as any).memory;
  }
  return null;
};

/**
 * API 응답 시간 측정
 */
export const measureApiResponseTime = async (
  apiCall: () => Promise<any>
): Promise<number> => {
  const startTime = performance.now();
  await apiCall();
  const endTime = performance.now();
  return endTime - startTime;
};

/**
 * 로드 테스트 실행
 */
export const runLoadTest = async (
  testFunction: () => Promise<void>,
  options: {
    concurrent: number;
    duration: number; // 테스트 지속 시간 (초)
    rampUp?: number; // 점진적 부하 증가 시간 (초)
  }
): Promise<LoadTestResult> => {
  const { concurrent, duration, rampUp = 0 } = options;
  const results: Array<{ success: boolean; responseTime: number }> = [];
  const startTime = Date.now();
  const endTime = startTime + duration * 1000;

  let activeRequests = 0;
  const maxConcurrent = concurrent;

  const executeTest = async (): Promise<void> => {
    if (Date.now() > endTime) return;

    activeRequests++;
    const requestStartTime = performance.now();

    try {
      await testFunction();
      const responseTime = performance.now() - requestStartTime;
      results.push({ success: true, responseTime });
    } catch (error) {
      const responseTime = performance.now() - requestStartTime;
      results.push({ success: false, responseTime });
    } finally {
      activeRequests--;
    }
  };

  // 점진적 부하 증가
  const rampUpStep = rampUp > 0 ? maxConcurrent / (rampUp * 10) : maxConcurrent;
  let currentConcurrent = rampUp > 0 ? 1 : maxConcurrent;

  const rampUpInterval = rampUp > 0 ? setInterval(() => {
    if (currentConcurrent < maxConcurrent) {
      currentConcurrent = Math.min(maxConcurrent, currentConcurrent + rampUpStep);
    }
  }, 100) : null;

  // 로드 테스트 실행
  const testInterval = setInterval(async () => {
    if (Date.now() > endTime) {
      clearInterval(testInterval);
      if (rampUpInterval) clearInterval(rampUpInterval);
      return;
    }

    // 동시 실행 수 제한
    if (activeRequests < currentConcurrent) {
      executeTest();
    }
  }, 10);

  // 테스트 완료 대기
  await new Promise<void>((resolve) => {
    const checkCompletion = () => {
      if (Date.now() > endTime && activeRequests === 0) {
        resolve();
      } else {
        setTimeout(checkCompletion, 100);
      }
    };
    checkCompletion();
  });

  // 결과 계산
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  const responseTimes = results.map(r => r.responseTime);

  const totalDuration = (Date.now() - startTime) / 1000;
  const requestsPerSecond = results.length / totalDuration;

  return {
    totalRequests: results.length,
    successfulRequests: successfulResults.length,
    failedRequests: failedResults.length,
    averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    maxResponseTime: Math.max(...responseTimes),
    minResponseTime: Math.min(...responseTimes),
    requestsPerSecond,
    errorRate: failedResults.length / results.length,
  };
};

/**
 * Firebase 성능 테스트
 */
export const testFirebasePerformance = async (
  firebaseOperations: Array<{ name: string; operation: () => Promise<any> }>
): Promise<Record<string, number>> => {
  const results: Record<string, number> = {};

  for (const { name, operation } of firebaseOperations) {
    const responseTime = await measureApiResponseTime(operation);
    results[name] = responseTime;
  }

  return results;
};

/**
 * 메모리 누수 테스트
 */
export const testMemoryLeak = async (
  operation: () => Promise<void>,
  iterations: number = 100
): Promise<{ initialMemory: number; finalMemory: number; leaked: boolean }> => {
  const initialMemory = measureMemoryUsage();

  // 여러 번 실행하여 메모리 사용량 변화 관찰
  for (let i = 0; i < iterations; i++) {
    await operation();

    // 가비지 컬렉션 강제 실행 (가능한 경우)
    if (global.gc) {
      global.gc();
    }
  }

  const finalMemory = measureMemoryUsage();

  const leaked = finalMemory && initialMemory
    ? finalMemory.usedJSHeapSize > initialMemory.usedJSHeapSize * 1.5
    : false;

  return {
    initialMemory: initialMemory?.usedJSHeapSize || 0,
    finalMemory: finalMemory?.usedJSHeapSize || 0,
    leaked,
  };
};

/**
 * 번들 크기 분석
 */
export const analyzeBundleSize = async (): Promise<{
  totalSize: number;
  gzippedSize: number;
  chunkSizes: Record<string, number>;
}> => {
  // 이 함수는 빌드 시점에 webpack-bundle-analyzer 결과를 파싱하여 구현
  // 실제 구현에서는 빌드 프로세스와 연동 필요

  return {
    totalSize: 0,
    gzippedSize: 0,
    chunkSizes: {},
  };
};

/**
 * 렌더링 성능 측정 (Virtual DOM)
 */
export const measureRenderingPerformance = (
  component: React.ComponentType,
  props: any,
  iterations: number = 100
): { averageRenderTime: number; maxRenderTime: number; minRenderTime: number } => {
  const renderTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const renderTime = measureRenderTime(() => {
      // React 컴포넌트 렌더링 시뮬레이션
      React.createElement(component, props);
    });
    renderTimes.push(renderTime);
  }

  return {
    averageRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
    maxRenderTime: Math.max(...renderTimes),
    minRenderTime: Math.min(...renderTimes),
  };
};

/**
 * 데이터베이스 쿼리 성능 테스트
 */
export const testDatabaseQueryPerformance = async (
  queries: Array<{ name: string; query: () => Promise<any> }>
): Promise<Record<string, { responseTime: number; recordCount?: number | undefined }>> => {
  const results: Record<string, { responseTime: number; recordCount?: number | undefined }> = {};

  for (const { name, query } of queries) {
    const startTime = performance.now();
    const result = await query();
    const responseTime = performance.now() - startTime;

    results[name] = {
      responseTime,
      recordCount: Array.isArray(result) ? result.length : undefined,
    };
  }

  return results;
};

/**
 * 네트워크 지연 시뮬레이션
 */
export const simulateNetworkDelay = (delayMs: number) => {
  return new Promise(resolve => setTimeout(resolve, delayMs));
};

/**
 * 성능 리포트 생성
 */
export const generatePerformanceReport = (
  metrics: PerformanceMetrics
): {
  passed: boolean;
  failedChecks: string[];
  recommendations: string[];
} => {
  const failedChecks: string[] = [];
  const recommendations: string[] = [];

  // 로드 시간 검사
  if (metrics.loadTime > PERFORMANCE_THRESHOLDS.LOAD_TIME_MAX) {
    failedChecks.push(`페이지 로드 시간 초과: ${metrics.loadTime}ms`);
    recommendations.push('코드 스플리팅, 이미지 최적화, CDN 사용 검토');
  }

  // 렌더링 시간 검사
  if (metrics.renderTime > PERFORMANCE_THRESHOLDS.RENDER_TIME_MAX) {
    failedChecks.push(`렌더링 시간 초과: ${metrics.renderTime}ms`);
    recommendations.push('컴포넌트 메모이제이션, 가상화 적용 검토');
  }

  // 메모리 사용량 검사
  if (metrics.memoryUsage && metrics.memoryUsage.usedJSHeapSize > PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MAX) {
    failedChecks.push(`메모리 사용량 초과: ${Math.round(metrics.memoryUsage.usedJSHeapSize / 1024 / 1024)}MB`);
    recommendations.push('메모리 누수 검사, 불필요한 객체 참조 제거');
  }

  // API 응답 시간 검사
  if (metrics.apiResponseTime && metrics.apiResponseTime > PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME_MAX) {
    failedChecks.push(`API 응답 시간 초과: ${metrics.apiResponseTime}ms`);
    recommendations.push('데이터베이스 인덱스 최적화, 캐싱 전략 개선');
  }

  return {
    passed: failedChecks.length === 0,
    failedChecks,
    recommendations,
  };
};

/**
 * 연속 성능 모니터링
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;

  start(intervalMs: number = 1000) {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      const metric: PerformanceMetrics = {
        loadTime: 0, // 현재 시점에서는 측정 불가
        renderTime: 0, // 현재 시점에서는 측정 불가
        memoryUsage: measureMemoryUsage() || undefined,
      };

      this.metrics.push(metric);
    }, intervalMs);
  }

  stop() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) return {};

    const memoryUsages = this.metrics
      .map(m => m.memoryUsage?.usedJSHeapSize)
      .filter(Boolean) as number[];

    return {
      memoryUsage: memoryUsages.length > 0 ? {
        usedJSHeapSize: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
      } : undefined,
    };
  }

  clear() {
    this.metrics = [];
  }
}

/**
 * Core Web Vitals 측정
 */
export const measureCoreWebVitals = (): Promise<{
  FCP: number; // First Contentful Paint
  LCP: number; // Largest Contentful Paint
  FID: number; // First Input Delay
  CLS: number; // Cumulative Layout Shift
}> => {
  return new Promise((resolve) => {
    const vitals = {
      FCP: 0,
      LCP: 0,
      FID: 0,
      CLS: 0,
    };

    // Performance Observer로 실제 메트릭 수집
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // First Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        vitals.FCP = entries[0]?.startTime || 0;
      }).observe({ entryTypes: ['paint'] });

      // Largest Contentful Paint
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        vitals.LCP = entries[entries.length - 1]?.startTime || 0;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const entry = entries[0] as any; // PerformanceEventTiming 타입 캐스팅
        vitals.FID = (entry?.processingStart - entry?.startTime) || 0;
      }).observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        vitals.CLS = entries.reduce((sum, entry) => sum + (entry as any).value, 0);
      }).observe({ entryTypes: ['layout-shift'] });
    }

    // 5초 후 결과 반환
    setTimeout(() => resolve(vitals), 5000);
  });
};

const performanceTestUtils = {
  measurePageLoadTime,
  measureRenderTime,
  measureMemoryUsage,
  measureApiResponseTime,
  runLoadTest,
  testFirebasePerformance,
  testMemoryLeak,
  analyzeBundleSize,
  measureRenderingPerformance,
  testDatabaseQueryPerformance,
  simulateNetworkDelay,
  generatePerformanceReport,
  measureCoreWebVitals,
  PerformanceMonitor,
  PERFORMANCE_THRESHOLDS,
};

export default performanceTestUtils;