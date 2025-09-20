import React from 'react';
import { logger } from './logger';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

interface ComponentRenderMetric {
  componentName: string;
  renderTime: number;
  renderCount: number;
  averageRenderTime: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private componentRenders: Map<string, ComponentRenderMetric> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.initializeObservers();
    }
  }

  private initializeObservers(): void {
    // Navigation Timing API
    try {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('페이지 로드 시간', navEntry.loadEventEnd - navEntry.fetchStart, 'ms');
            this.recordMetric('DOM 콘텐츠 로드', navEntry.domContentLoadedEventEnd - navEntry.fetchStart, 'ms');
            this.recordMetric('첫 바이트까지 시간 (TTFB)', navEntry.responseStart - navEntry.fetchStart, 'ms');
          }
        }
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    } catch (error) {
      logger.warn('Navigation timing observer 초기화 실패', { component: 'performanceMonitor', data: {  error: String(error)  } });
    }

    // Resource Timing API
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.name.includes('.js') || resourceEntry.name.includes('.css')) {
              this.recordMetric(
                `리소스 로드: ${resourceEntry.name.split('/').pop() || 'unknown'}`,
                resourceEntry.duration,
                'ms'
              );
            }
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (error) {
      logger.warn('Resource timing observer 초기화 실패', { component: 'performanceMonitor', data: {  error: String(error)  } });
    }

    // Long Task API
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('긴 작업 감지', entry.duration, 'ms');
          logger.warn('긴 작업 감지됨', {
            duration: entry.duration,
            additionalData: {
              startTime: entry.startTime,
              name: entry.name
            }
          });
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (error) {
      logger.warn('Long task observer 초기화 실패', { component: 'performanceMonitor', data: {  error: String(error)  } });
    }
  }

  // 메트릭 기록
  recordMetric(name: string, value: number, unit: string = 'ms'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now()
    };
    this.metrics.push(metric);
    logger.info(`📊 성능 메트릭: ${name}`, {
      component: 'PerformanceMonitor',
      value,
      additionalData: { unit }
    });
  }

  // 컴포넌트 렌더링 시간 측정
  measureComponentRender(componentName: string, renderTime: number): void {
    const existing = this.componentRenders.get(componentName);
    if (existing) {
      existing.renderCount++;
      existing.renderTime += renderTime;
      existing.averageRenderTime = existing.renderTime / existing.renderCount;
    } else {
      this.componentRenders.set(componentName, {
        componentName,
        renderTime,
        renderCount: 1,
        averageRenderTime: renderTime
      });
    }
  }

  // 메모리 사용량 측정
  async measureMemory(): Promise<void> {
    if ('memory' in performance && typeof (performance as any).memory === 'object') {
      const memory = (performance as any).memory;
      this.recordMetric('사용된 JS 힙 크기', memory.usedJSHeapSize / 1048576, 'MB');
      this.recordMetric('전체 JS 힙 크기', memory.totalJSHeapSize / 1048576, 'MB');
      this.recordMetric('JS 힙 크기 제한', memory.jsHeapSizeLimit / 1048576, 'MB');
    }
  }

  // 번들 크기 분석
  analyzeBundleSize(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      let totalJS = 0;
      let totalCSS = 0;
      let totalImages = 0;

      resources.forEach(resource => {
        const size = resource.transferSize || 0;
        if (resource.name.includes('.js')) {
          totalJS += size;
        } else if (resource.name.includes('.css')) {
          totalCSS += size;
        } else if (resource.name.match(/\.(png|jpg|jpeg|gif|svg|webp)/i)) {
          totalImages += size;
        }
      });

      this.recordMetric('JavaScript 번들 크기', totalJS / 1024, 'KB');
      this.recordMetric('CSS 번들 크기', totalCSS / 1024, 'KB');
      this.recordMetric('이미지 크기', totalImages / 1024, 'KB');
    }
  }

  // Web Vitals 측정
  measureWebVitals(): void {
    // First Contentful Paint (FCP)
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      this.recordMetric('First Contentful Paint (FCP)', fcp.startTime, 'ms');
    }

    // Largest Contentful Paint (LCP) - Observer로 측정
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          this.recordMetric('Largest Contentful Paint (LCP)', lastEntry.startTime, 'ms');
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (error) {
      logger.warn('LCP observer 초기화 실패', { component: 'performanceMonitor', data: {  error: String(error)  } });
    }

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            this.recordMetric('Cumulative Layout Shift (CLS)', clsValue, 'score');
          }
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (error) {
      logger.warn('CLS observer 초기화 실패', { component: 'performanceMonitor', data: {  error: String(error)  } });
    }
  }

  // 성능 보고서 생성
  generateReport(): string {
    const report = ['=== 성능 측정 보고서 ===\n'];
    
    // 메트릭 그룹화
    const groupedMetrics: { [key: string]: PerformanceMetric[] } = {};
    this.metrics.forEach(metric => {
      const category = metric.name.split(':')[0] || '기타';
      if (!groupedMetrics[category]) {
        groupedMetrics[category] = [];
      }
      const metricsArray = groupedMetrics[category];
      if (metricsArray) {
        metricsArray.push(metric);
      }
    });

    // 카테고리별 출력
    Object.entries(groupedMetrics).forEach(([category, metrics]) => {
      report.push(`\n### ${category}`);
      metrics.forEach(metric => {
        report.push(`- ${metric.name}: ${metric.value.toFixed(2)} ${metric.unit}`);
      });
    });

    // 컴포넌트 렌더링 통계
    if (this.componentRenders.size > 0) {
      report.push('\n### 컴포넌트 렌더링 성능');
      const sortedComponents = Array.from(this.componentRenders.values())
        .sort((a, b) => b.averageRenderTime - a.averageRenderTime);
      
      sortedComponents.forEach(comp => {
        report.push(
          `- ${comp.componentName}: 평균 ${comp.averageRenderTime.toFixed(2)}ms (${comp.renderCount}회 렌더링)`
        );
      });
    }

    return report.join('\n');
  }

  // 콘솔에 보고서 출력
  logReport(): void {

  }

  // 정리
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
    this.componentRenders.clear();
  }
}

// 싱글톤 인스턴스
export const performanceMonitor = new PerformanceMonitor();

// React 컴포넌트 성능 측정 HOC
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P> {
  // HOC 단순화 - 현재는 패스스루로 동작
  return WrappedComponent;
}

// 성능 측정 훅
export function usePerformanceMeasure(measureName: string) {
  const startTimeRef = React.useRef<number>();

  const startMeasure = React.useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const endMeasure = React.useCallback(() => {
    if (startTimeRef.current !== undefined) {
      const duration = performance.now() - startTimeRef.current;
      performanceMonitor.recordMetric(measureName, duration, 'ms');
      return duration;
    }
    return 0;
  }, [measureName]);

  return { startMeasure, endMeasure };
}