/**
 * 성능 테스트 유틸리티
 * 브라우저에서 실행하여 실제 성능 메트릭 측정
 */

import { logger } from './logger';

const performanceTest = {
  // Core Web Vitals 측정
  measureCoreWebVitals() {
    const vitals = {};

    // Largest Contentful Paint (LCP)
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lcpEntry = entries[entries.length - 1];
      vitals.LCP = lcpEntry.startTime;
      logger.info(`LCP: ${vitals.LCP.toFixed(2)} ms`);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID) - 사용자 상호작용 시 측정됨
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        vitals.FID = entry.processingStart - entry.startTime;
        logger.info(`FID: ${vitals.FID.toFixed(2)} ms`);
      });
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      vitals.CLS = clsValue;
      logger.info(`CLS: ${vitals.CLS.toFixed(4)}`);
    }).observe({ entryTypes: ['layout-shift'] });

    return vitals;
  },

  // 페이지 로딩 성능 측정
  measurePageLoad() {
    const navigation = performance.getEntriesByType('navigation')[0];

    if (navigation) {
      const metrics = {
        // DNS 조회 시간
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,

        // TCP 연결 시간
        tcpConnection: navigation.connectEnd - navigation.connectStart,

        // SSL 협상 시간 (HTTPS인 경우)
        sslNegotiation:
          navigation.secureConnectionStart > 0
            ? navigation.connectEnd - navigation.secureConnectionStart
            : 0,

        // 서버 응답 시간
        serverResponse: navigation.responseStart - navigation.requestStart,

        // DOM 구성 시간
        domConstruction: navigation.domComplete - navigation.responseStart,

        // 페이지 로드 완료 시간
        pageLoad: navigation.loadEventEnd - navigation.fetchStart,

        // DOM 준비 시간
        domReady: navigation.domContentLoadedEventEnd - navigation.fetchStart,

        // 첫 바이트까지의 시간 (TTFB)
        ttfb: navigation.responseStart - navigation.fetchStart,
      };

      logger.info('=== 페이지 로딩 성능 ===');
      Object.entries(metrics).forEach(([key, value]) => {
        logger.info(`${key}: ${value.toFixed(2)} ms`);
      });

      return metrics;
    }
  },

  // 리소스 로딩 분석
  analyzeResources() {
    const resources = performance.getEntriesByType('resource');

    const analysis = {
      scripts: [],
      stylesheets: [],
      images: [],
      fonts: [],
      others: [],
    };

    resources.forEach((resource) => {
      const info = {
        name: resource.name.split('/').pop(),
        size: resource.transferSize || 0,
        loadTime: resource.responseEnd - resource.startTime,
        type: resource.initiatorType,
      };

      if (resource.name.includes('.js')) {
        analysis.scripts.push(info);
      } else if (resource.name.includes('.css')) {
        analysis.stylesheets.push(info);
      } else if (
        resource.name.includes('.png') ||
        resource.name.includes('.jpg') ||
        resource.name.includes('.svg')
      ) {
        analysis.images.push(info);
      } else if (resource.name.includes('.woff') || resource.name.includes('.ttf')) {
        analysis.fonts.push(info);
      } else {
        analysis.others.push(info);
      }
    });

    logger.info('=== 리소스 분석 ===');
    logger.info(`Scripts: ${analysis.scripts.length}개`);
    logger.info(`Stylesheets: ${analysis.stylesheets.length}개`);
    logger.info(`Images: ${analysis.images.length}개`);
    logger.info(`Fonts: ${analysis.fonts.length}개`);

    // 가장 큰 리소스들
    const allResources = [
      ...analysis.scripts,
      ...analysis.stylesheets,
      ...analysis.images,
      ...analysis.others,
    ];
    const largestResources = allResources
      .filter((r) => r.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);

    logger.info('=== 가장 큰 리소스 5개 ===');
    largestResources.forEach((resource) => {
      logger.info(
        `${resource.name}: ${(resource.size / 1024).toFixed(2)} KB (${resource.loadTime.toFixed(2)}ms)`
      );
    });

    return analysis;
  },

  // 메모리 사용량 측정
  measureMemoryUsage() {
    if ('memory' in performance) {
      const memory = performance.memory;
      const usage = {
        used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
        total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
        limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
      };

      logger.info('=== 메모리 사용량 ===');
      logger.info(`사용 중: ${usage.used} MB`);
      logger.info(`할당됨: ${usage.total} MB`);
      logger.info(`한계: ${usage.limit} MB`);

      return usage;
    } else {
      logger.warn('메모리 정보를 사용할 수 없습니다.');
      return null;
    }
  },

  // 전체 성능 테스트 실행
  runFullTest() {
    logger.info('🚀 T-HOLDEM 랜딩페이지 성능 테스트 시작');
    logger.info('=====================================');

    // 페이지 로드 완료 후 측정
    if (document.readyState === 'complete') {
      this.measurePageLoad();
      this.analyzeResources();
      this.measureMemoryUsage();
      this.measureCoreWebVitals();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => {
          this.measurePageLoad();
          this.analyzeResources();
          this.measureMemoryUsage();
          this.measureCoreWebVitals();
        }, 1000);
      });
    }

    logger.info('=====================================');
    logger.info('✅ 성능 테스트 완료');
  },
};

// 브라우저 콘솔에서 사용 가능하도록 전역으로 노출
if (typeof window !== 'undefined') {
  window.performanceTest = performanceTest;
}

export default performanceTest;
