/**
 * useLandingAnalytics 훅
 *
 * TDD GREEN 단계: 테스트를 통과하는 분석 훅 구현
 * 랜딩페이지에서 사용자 상호작용과 성과 지표를 추적
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';
import analyticsIntegration from '../utils/analyticsIntegration';
import performanceMonitor from '../utils/performanceMonitor';

/** 분석 이벤트 파라미터 타입 */
type AnalyticsParams = Record<string, string | number | boolean | object | null | undefined>;

interface AnalyticsEvent {
  eventName: string;
  parameters: AnalyticsParams;
  timestamp: number;
  sessionId: string;
}

interface PerformanceMetrics {
  loadTime?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  cumulativeLayoutShift?: number;
  LCP?: number;
  FID?: number;
  CLS?: number;
  timeOrigin?: number;
  [key: string]: number | undefined;
}

interface UseLandingAnalyticsReturn {
  isLoading: boolean;
  error: Error | null;
  trackPageView: (page: string, properties?: AnalyticsParams) => Promise<void>;
  trackInteraction: (eventName: string, properties?: AnalyticsParams) => Promise<void>;
  trackCtaClick: (ctaText: string, ctaLink: string, properties?: AnalyticsParams) => Promise<void>;
  trackScroll: (scrollDepth: number, section?: string) => Promise<void>;
  trackPerformance: (metricType: string, metrics: PerformanceMetrics) => Promise<void>;
}

// 세션 ID 생성
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/** Navigator Network Information API */
interface NetworkInformation {
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
}

/** Navigator with network info */
interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

// 사용자 환경 정보 수집
const getUserEnvironment = () => {
  const navigatorWithConnection = navigator as NavigatorWithConnection;
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    screen: {
      width: window.screen.width,
      height: window.screen.height,
    },
    connection: navigatorWithConnection.connection?.effectiveType || 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
};

export const useLandingAnalytics = (): UseLandingAnalyticsReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const sessionIdRef = useRef<string>(generateSessionId());
  const eventQueueRef = useRef<AnalyticsEvent[]>([]);
  const lastScrollDepthRef = useRef<number>(0);
  const duplicateFilterRef = useRef<Set<string>>(new Set());

  // 배치 처리를 위한 디바운스
  const batchProcessTimeoutRef = useRef<NodeJS.Timeout>();

  // 분석 통합 시스템 초기화
  useEffect(() => {
    analyticsIntegration.initialize();
    return () => {
      analyticsIntegration.cleanup();
    };
  }, []);

  // 개인정보 보호 동의 확인
  const hasAnalyticsConsent = useCallback((): boolean => {
    // 실제 구현에서는 사용자 동의 상태를 확인
    // 현재는 기본값으로 true 반환 (개발 환경)
    return true;
  }, []);

  // 이벤트 큐 처리
  const processEventQueue = useCallback(async () => {
    if (eventQueueRef.current.length === 0) return;

    try {
      setIsLoading(true);

      const eventsToProcess = [...eventQueueRef.current];
      eventQueueRef.current = [];

      // Firebase Analytics나 다른 분석 서비스로 이벤트 전송
      // 현재는 콘솔에 로그 출력 (개발 환경)
      logger.info('Analytics events processed', {
        eventCount: eventsToProcess.length,
        events: eventsToProcess,
      });

      // 실제 구현에서는 여기서 Firebase Analytics logEvent 호출
      // await Promise.all(eventsToProcess.map(event =>
      //   analytics.logEvent(event.eventName, event.parameters)
      // ));

      setError(null);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Analytics service error');
      setError(errorObj);
      logger.error('Failed to process analytics events', errorObj);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 배치 처리 디바운스
  const debouncedProcessQueue = useCallback(() => {
    if (batchProcessTimeoutRef.current) {
      clearTimeout(batchProcessTimeoutRef.current);
    }

    batchProcessTimeoutRef.current = setTimeout(() => {
      processEventQueue();
    }, 1000); // 1초 후 배치 처리
  }, [processEventQueue]);

  // 이벤트 추가
  const addEvent = useCallback(
    (eventName: string, parameters: AnalyticsParams) => {
      if (!hasAnalyticsConsent()) {
        logger.info('Analytics consent not given, skipping event', { operation: eventName });
        return;
      }

      // 입력 검증
      if (!eventName || eventName.trim() === '') {
        logger.warn('Invalid event name provided to analytics', { data: { eventName } });
        return;
      }

      // 중복 이벤트 필터링 (동일한 이벤트가 100ms 내에 중복 발생하는 경우)
      const eventKey = `${eventName}_${JSON.stringify(parameters)}`;
      const now = Date.now();
      const duplicateKey = `${eventKey}_${Math.floor(now / 100)}`;

      if (duplicateFilterRef.current.has(duplicateKey)) {
        return; // 중복 이벤트 무시
      }
      duplicateFilterRef.current.add(duplicateKey);

      // 중복 필터 정리 (메모리 관리)
      if (duplicateFilterRef.current.size > 1000) {
        duplicateFilterRef.current.clear();
      }

      const event: AnalyticsEvent = {
        eventName,
        parameters: {
          ...parameters,
          sessionId: sessionIdRef.current,
          timestamp: now,
          page: 'landing-page',
          userEnvironment: getUserEnvironment(),
        },
        timestamp: now,
        sessionId: sessionIdRef.current,
      };

      eventQueueRef.current.push(event);
      debouncedProcessQueue();
    },
    [hasAnalyticsConsent, debouncedProcessQueue]
  );

  // 페이지뷰 추적
  const trackPageView = useCallback(
    async (page: string, properties?: AnalyticsParams) => {
      addEvent('page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: window.location.pathname,
        page: page,
        ...properties,
      });
    },
    [addEvent]
  );

  // 상호작용 추적
  const trackInteraction = useCallback(
    async (eventName: string, properties?: AnalyticsParams) => {
      addEvent('interaction', {
        interaction_type: eventName,
        ...properties,
      });
    },
    [addEvent]
  );

  // CTA 클릭 추적 (고도화된 분석 통합)
  const trackCtaClick = useCallback(
    async (ctaText: string, ctaLink: string, properties?: AnalyticsParams) => {
      // 기존 분석 시스템
      addEvent('cta_click', {
        cta_text: ctaText,
        cta_link: ctaLink,
        click_timestamp: Date.now(),
        ...properties,
      });

      // 고도화된 분석 통합 시스템
      analyticsIntegration.trackCTAClick(ctaText, ctaLink, properties || {});
    },
    [addEvent]
  );

  // 스크롤 추적 (고도화된 분석 통합)
  const trackScroll = useCallback(
    async (scrollDepth: number, section?: string) => {
      // 스크롤 깊이가 이전보다 증가했을 때만 추적
      if (scrollDepth > lastScrollDepthRef.current && scrollDepth % 25 === 0) {
        lastScrollDepthRef.current = scrollDepth;

        // 기존 분석 시스템
        addEvent('scroll', {
          scroll_depth: scrollDepth,
          section: section,
          max_scroll_depth: Math.max(scrollDepth, lastScrollDepthRef.current),
        });

        // 고도화된 분석 통합 시스템 (시간 정보 포함)
        const timeOnPage =
          Date.now() - (performance.timeOrigin + performance.now() - performance.now());
        analyticsIntegration.trackScrollDepth(scrollDepth, section || 'unknown', timeOnPage);
      }
    },
    [addEvent]
  );

  // 성능 추적 (고도화된 분석 통합)
  const trackPerformance = useCallback(
    async (metricType: string, metrics: PerformanceMetrics) => {
      // 기존 분석 시스템
      addEvent('performance', {
        metric_type: metricType,
        ...metrics,
        performance_timestamp: Date.now(),
      });

      // 고도화된 분석 통합 시스템 (성능 모니터링과 연동)
      const currentMetrics = performanceMonitor.getMetrics();
      analyticsIntegration.trackPerformanceMetrics(currentMetrics);
    },
    [addEvent]
  );

  // 초기화 시 성능 메트릭 수집
  useEffect(() => {
    const collectInitialMetrics = () => {
      // Core Web Vitals 수집
      if ('web-vital' in window) {
        // 실제 구현에서는 web-vitals 라이브러리 사용
        trackPerformance('initial_load', {
          loadTime: performance.now(),
          timeOrigin: performance.timeOrigin,
        });
      }

      // Performance Observer 설정 (지원되는 경우)
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              if (entry.entryType === 'largest-contentful-paint') {
                trackPerformance('core_web_vitals', {
                  LCP: entry.startTime,
                });
              }
            });
          });

          observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (err) {
          logger.warn('Performance Observer not supported', {
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };

    // DOM 로드 완료 후 메트릭 수집
    if (document.readyState === 'complete') {
      collectInitialMetrics();
    } else {
      window.addEventListener('load', collectInitialMetrics);
    }

    // 페이지 언로드 시 남은 이벤트 처리
    const handleBeforeUnload = () => {
      if (eventQueueRef.current.length > 0) {
        // 개발 환경에서는 서버 전송 건너뛰기
        if (process.env.NODE_ENV === 'development') {
          logger.info(
            '📊 Unload analytics events (development mode - server transmission skipped)',
            {
              data: {
                eventsCount: eventQueueRef.current.length,
                events: eventQueueRef.current,
              },
            }
          );
          return;
        }

        // sendBeacon API 사용하여 마지막 이벤트 전송
        if ('sendBeacon' in navigator) {
          const events = JSON.stringify(eventQueueRef.current);
          navigator.sendBeacon('/api/analytics', events);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('load', collectInitialMetrics);
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (batchProcessTimeoutRef.current) {
        clearTimeout(batchProcessTimeoutRef.current);
      }
    };
  }, [trackPerformance]);

  // 세션 갱신 (30분마다)
  useEffect(() => {
    const sessionRenewalInterval = setInterval(
      () => {
        sessionIdRef.current = generateSessionId();
        logger.info('Analytics session renewed', { sessionId: sessionIdRef.current });
      },
      30 * 60 * 1000
    ); // 30분

    return () => {
      clearInterval(sessionRenewalInterval);
    };
  }, []);

  return {
    isLoading,
    error,
    trackPageView,
    trackInteraction,
    trackCtaClick,
    trackScroll,
    trackPerformance,
  };
};
