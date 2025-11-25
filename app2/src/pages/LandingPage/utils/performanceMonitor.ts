/**
 * 성능 모니터링 유틸리티
 * Core Web Vitals 및 실시간 성능 지표 수집
 */

import { logger } from '@/utils/logger';

interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift

  // Loading Performance
  domContentLoaded?: number;
  loadComplete?: number;
  firstPaint?: number;
  firstContentfulPaint?: number;

  // Bundle & Resource Info
  bundleSize?: number;
  resourceLoadTime?: number;

  // User Context
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  connection?: {
    effectiveType?: string;
    downlink?: number;
  };

  // Timestamps
  timestamp: number;
  url: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private observers: PerformanceObserver[] = [];
  private isInitialized = false;

  constructor() {
    this.metrics = {
      timestamp: Date.now(),
      url: window.location.href
    };
  }

  /**
   * 성능 모니터링 초기화
   */
  public initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    // 기본 성능 지표 수집
    this.collectBasicMetrics();

    // Core Web Vitals 수집
    this.setupCoreWebVitals();

    // 사용자 컨텍스트 수집
    this.collectUserContext();

    // 페이지 언로드 시 최종 데이터 전송
    this.setupUnloadHandler();

    this.isInitialized = true;
  }

  /**
   * 기본 성능 지표 수집
   */
  private collectBasicMetrics(): void {
    if (!('performance' in window)) {
      return;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      this.metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
      this.metrics.loadComplete = navigation.loadEventEnd - navigation.fetchStart;
    }

    // Paint Timing
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(entry => {
      if (entry.name === 'first-paint') {
        this.metrics.firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        this.metrics.firstContentfulPaint = entry.startTime;
      }
    });
  }

  /**
   * Core Web Vitals 설정
   */
  private setupCoreWebVitals(): void {
    // LCP (Largest Contentful Paint)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformancePaintTiming;
          if (lastEntry) {
            this.metrics.lcp = lastEntry.startTime;
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        logger.warn('LCP observer setup failed', e instanceof Error ? e : new Error(String(e)));
      }

      // FID (First Input Delay)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            const eventTiming = entry as PerformanceEventTiming;
            if (eventTiming.processingStart && eventTiming.startTime) {
              this.metrics.fid = eventTiming.processingStart - eventTiming.startTime;
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        logger.warn('FID observer setup failed', e instanceof Error ? e : new Error(String(e)));
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
          this.metrics.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        logger.warn('CLS observer setup failed', e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  /**
   * 사용자 컨텍스트 수집
   */
  private collectUserContext(): void {
    // User Agent
    this.metrics.userAgent = navigator.userAgent;

    // 뷰포트 크기
    this.metrics.viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // 네트워크 정보 (가능한 경우)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      this.metrics.connection = {
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink
      };
    }

    // 번들 크기 추정 (리소스 크기 합계)
    const resourceEntries = performance.getEntriesByType('resource');
    let totalSize = 0;
    let maxLoadTime = 0;

    resourceEntries.forEach((entry: any) => {
      if (entry.transferSize) {
        totalSize += entry.transferSize;
      }
      if (entry.responseEnd - entry.fetchStart > maxLoadTime) {
        maxLoadTime = entry.responseEnd - entry.fetchStart;
      }
    });

    this.metrics.bundleSize = totalSize;
    this.metrics.resourceLoadTime = maxLoadTime;
  }

  /**
   * 언로드 핸들러 설정
   */
  private setupUnloadHandler(): void {
    const sendData = () => {
      this.sendMetrics();
    };

    // 페이지 언로드 시 데이터 전송
    window.addEventListener('beforeunload', sendData);
    window.addEventListener('pagehide', sendData);

    // Visibility API를 사용한 백그라운드 전환 감지
    if ('visibilityState' in document) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.sendMetrics();
        }
      });
    }
  }

  /**
   * 성능 지표 전송
   */
  private sendMetrics(): void {
    // 개발 환경에서는 로거 출력
    if (process.env.NODE_ENV === 'development') {
      const metricsReport = this.getMetricsReport();

      // logger 사용 (import 필요시 추가)
      if (typeof window !== 'undefined' && (window as any).logger) {
        (window as any).logger.info('🚀 Landing Page Performance Metrics', { data: metricsReport });
      }
      return;
    }

    // 프로덕션에서는 분석 서비스로 전송
    this.sendToAnalytics(this.metrics);
  }

  /**
   * 분석 서비스로 데이터 전송
   */
  private sendToAnalytics(metrics: PerformanceMetrics): void {
    // Google Analytics 4 이벤트 전송
    if (typeof gtag !== 'undefined') {
      gtag('event', 'landing_page_performance', {
        custom_map: {
          lcp: metrics.lcp,
          fid: metrics.fid,
          cls: metrics.cls,
          dom_content_loaded: metrics.domContentLoaded,
          bundle_size: metrics.bundleSize
        }
      });
    }

    // 사용자 정의 분석 엔드포인트로 전송 (선택사항)
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/performance', JSON.stringify(metrics));
      } else {
        fetch('/api/analytics/performance', {
          method: 'POST',
          body: JSON.stringify(metrics),
          headers: {
            'Content-Type': 'application/json'
          },
          keepalive: true
        }).catch(() => {
          // 실패해도 조용히 처리
        });
      }
    } catch (e) {
      // 분석 전송 실패는 조용히 처리
    }
  }

  /**
   * 성능 지표 보고서 생성
   */
  public getMetricsReport(): Record<string, any> {
    const report = {
      '🎯 Core Web Vitals': {
        'LCP (ms)': this.metrics.lcp ? `${this.metrics.lcp.toFixed(2)}ms` : 'N/A',
        'FID (ms)': this.metrics.fid ? `${this.metrics.fid.toFixed(2)}ms` : 'N/A',
        'CLS': this.metrics.cls ? this.metrics.cls.toFixed(4) : 'N/A'
      },
      '⚡ Loading Performance': {
        'DOM Content Loaded': this.metrics.domContentLoaded ? `${this.metrics.domContentLoaded.toFixed(2)}ms` : 'N/A',
        'Load Complete': this.metrics.loadComplete ? `${this.metrics.loadComplete.toFixed(2)}ms` : 'N/A',
        'First Paint': this.metrics.firstPaint ? `${this.metrics.firstPaint.toFixed(2)}ms` : 'N/A',
        'First Contentful Paint': this.metrics.firstContentfulPaint ? `${this.metrics.firstContentfulPaint.toFixed(2)}ms` : 'N/A'
      },
      '📦 Resource Info': {
        'Bundle Size': this.metrics.bundleSize ? `${(this.metrics.bundleSize / 1024).toFixed(2)} KB` : 'N/A',
        'Resource Load Time': this.metrics.resourceLoadTime ? `${this.metrics.resourceLoadTime.toFixed(2)}ms` : 'N/A'
      },
      '📱 User Context': {
        'Viewport': this.metrics.viewport ? `${this.metrics.viewport.width}x${this.metrics.viewport.height}` : 'N/A',
        'Connection Type': this.metrics.connection?.effectiveType || 'N/A',
        'Connection Speed': this.metrics.connection?.downlink ? `${this.metrics.connection.downlink} Mbps` : 'N/A'
      }
    };

    return report;
  }

  /**
   * 성능 알림 체크
   */
  public checkPerformanceAlerts(): string[] {
    const alerts: string[] = [];

    // LCP 임계값 체크 (2.5초)
    if (this.metrics.lcp && this.metrics.lcp > 2500) {
      alerts.push(`⚠️ LCP가 느립니다: ${this.metrics.lcp.toFixed(2)}ms (권장: <2500ms)`);
    }

    // FID 임계값 체크 (100ms)
    if (this.metrics.fid && this.metrics.fid > 100) {
      alerts.push(`⚠️ FID가 높습니다: ${this.metrics.fid.toFixed(2)}ms (권장: <100ms)`);
    }

    // CLS 임계값 체크 (0.1)
    if (this.metrics.cls && this.metrics.cls > 0.1) {
      alerts.push(`⚠️ CLS가 높습니다: ${this.metrics.cls.toFixed(4)} (권장: <0.1)`);
    }

    // 번들 크기 체크 (500KB)
    if (this.metrics.bundleSize && this.metrics.bundleSize > 500 * 1024) {
      alerts.push(`⚠️ 번들 크기가 큽니다: ${(this.metrics.bundleSize / 1024).toFixed(2)}KB (권장: <500KB)`);
    }

    return alerts;
  }

  /**
   * 리소스 정리
   */
  public cleanup(): void {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers = [];
    this.isInitialized = false;
  }

  /**
   * 현재 메트릭 반환
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}

// 싱글톤 인스턴스
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
export type { PerformanceMetrics };