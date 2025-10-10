/**
 * 분석 통합 유틸리티
 * Google Analytics 4, 사용자 정의 분석, 성능 모니터링 통합
 */

import { logger } from '../../../utils/logger';
import type { PerformanceMetrics } from './performanceMonitor';

interface AnalyticsEvent {
  event_name: string;
  event_category?: string;
  event_label?: string;
  event_value?: number | undefined;
  custom_parameters?: Record<string, any>;
  timestamp: number;
  page_url: string;
  user_agent: string;
}

interface ConversionEvent {
  conversion_type: 'cta_click' | 'scroll_depth' | 'section_view' | 'feature_interest';
  conversion_value?: number;
  conversion_context: Record<string, any>;
  timestamp: number;
}

interface UserJourney {
  session_id: string;
  events: AnalyticsEvent[];
  conversions: ConversionEvent[];
  performance_metrics?: PerformanceMetrics;
  session_duration?: number;
  page_views: number;
  bounce_rate?: number;
}

class AnalyticsIntegration {
  private sessionId: string;
  private events: AnalyticsEvent[] = [];
  private conversions: ConversionEvent[] = [];
  private sessionStartTime: number;
  private isInitialized = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
  }

  /**
   * 분석 시스템 초기화
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Google Analytics 4 초기화 확인
    this.initializeGA4();

    // 사용자 정의 분석 초기화
    this.initializeCustomAnalytics();

    // 세션 시작 이벤트
    this.trackEvent({
      event_name: 'session_start',
      event_category: 'engagement',
      custom_parameters: {
        landing_page: true,
        referrer: document.referrer,
        utm_source: this.getUrlParameter('utm_source'),
        utm_medium: this.getUrlParameter('utm_medium'),
        utm_campaign: this.getUrlParameter('utm_campaign'),
        device_type: this.getDeviceType(),
        browser: this.getBrowserInfo(),
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`
      }
    });

    this.isInitialized = true;
    logger.info('Analytics integration initialized', { sessionId: this.sessionId });
  }

  /**
   * Google Analytics 4 초기화
   */
  private initializeGA4(): void {
    // GA4 스크립트가 로드되어 있는지 확인
    if (typeof gtag === 'undefined') {
      // 개발 환경에서는 mock gtag 함수 생성
      if (process.env.NODE_ENV === 'development') {
        (window as any).gtag = (...args: any[]) => {
          logger.info('Mock GA4 Event', { args });
        };
      } else {
        logger.warn('Google Analytics 4가 로드되지 않았습니다');
        return;
      }
    }

    // GA4 기본 설정
    if (typeof gtag !== 'undefined') {
      gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID || 'GA_MEASUREMENT_ID', {
        page_title: 'T-HOLDEM Landing Page',
        page_location: window.location.href,
        custom_map: {
          custom_dimension_1: 'landing_page_section',
          custom_dimension_2: 'user_journey_stage',
          custom_dimension_3: 'conversion_funnel_step'
        }
      });
    }
  }

  /**
   * 사용자 정의 분석 초기화
   */
  private initializeCustomAnalytics(): void {
    // 페이지 언로드 시 데이터 전송
    const sendSessionData = () => {
      this.sendSessionSummary();
    };

    window.addEventListener('beforeunload', sendSessionData);
    window.addEventListener('pagehide', sendSessionData);

    // Visibility API를 사용한 세션 추적
    if ('visibilityState' in document) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.sendSessionSummary();
        }
      });
    }
  }

  /**
   * 이벤트 추적
   */
  public trackEvent(event: Omit<AnalyticsEvent, 'timestamp' | 'page_url' | 'user_agent'>): void {
    const fullEvent: AnalyticsEvent = {
      ...event,
      timestamp: Date.now(),
      page_url: window.location.href,
      user_agent: navigator.userAgent
    };

    this.events.push(fullEvent);

    // Google Analytics 4로 전송
    this.sendToGA4(fullEvent);

    // 실시간 분석 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      logger.info('📊 Analytics Event', {
        event_name: fullEvent.event_name,
        event_category: fullEvent.event_category,
        event_label: fullEvent.event_label,
        event_value: fullEvent.event_value,
        custom_parameters: fullEvent.custom_parameters,
        timestamp: fullEvent.timestamp.toString(),
        page_url: fullEvent.page_url,
        user_agent: fullEvent.user_agent
      });
    }
  }

  /**
   * 전환 이벤트 추적
   */
  public trackConversion(conversion: Omit<ConversionEvent, 'timestamp'>): void {
    const fullConversion: ConversionEvent = {
      ...conversion,
      timestamp: Date.now()
    };

    this.conversions.push(fullConversion);

    // 전환 이벤트로 GA4에 전송
    this.trackEvent({
      event_name: 'conversion',
      event_category: 'conversion',
      event_label: conversion.conversion_type,
      event_value: conversion.conversion_value,
      custom_parameters: {
        conversion_type: conversion.conversion_type,
        conversion_context: conversion.conversion_context
      }
    });

    logger.info('🎯 Conversion tracked', {
      conversion_type: fullConversion.conversion_type,
      conversion_value: fullConversion.conversion_value,
      conversion_context: fullConversion.conversion_context,
      timestamp: fullConversion.timestamp.toString()
    });
  }

  /**
   * CTA 클릭 추적 (고도화)
   */
  public trackCTAClick(ctaText: string, targetUrl: string, context: Record<string, any>): void {
    this.trackEvent({
      event_name: 'cta_click',
      event_category: 'engagement',
      event_label: ctaText,
      custom_parameters: {
        cta_text: ctaText,
        target_url: targetUrl,
        ...context
      }
    });

    this.trackConversion({
      conversion_type: 'cta_click',
      conversion_value: this.getCTAValue(ctaText),
      conversion_context: {
        cta_text: ctaText,
        target_url: targetUrl,
        ...context
      }
    });
  }

  /**
   * 스크롤 깊이 추적 (고도화)
   */
  public trackScrollDepth(depth: number, section: string, timeOnPage: number): void {
    this.trackEvent({
      event_name: 'scroll_depth',
      event_category: 'engagement',
      event_value: depth,
      custom_parameters: {
        scroll_depth: depth,
        current_section: section,
        time_on_page: timeOnPage,
        engagement_level: this.calculateEngagementLevel(depth, timeOnPage)
      }
    });

    // 깊은 스크롤은 전환으로 간주
    if (depth >= 75) {
      this.trackConversion({
        conversion_type: 'scroll_depth',
        conversion_value: depth,
        conversion_context: {
          scroll_depth: depth,
          section: section,
          time_on_page: timeOnPage
        }
      });
    }
  }

  /**
   * 성능 메트릭 추적
   */
  public trackPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.trackEvent({
      event_name: 'performance_metrics',
      event_category: 'performance',
      custom_parameters: {
        lcp: metrics.lcp,
        fid: metrics.fid,
        cls: metrics.cls,
        dom_content_loaded: metrics.domContentLoaded,
        load_complete: metrics.loadComplete,
        bundle_size: metrics.bundleSize,
        connection_type: metrics.connection?.effectiveType,
        viewport_size: metrics.viewport ? `${metrics.viewport.width}x${metrics.viewport.height}` : undefined,
        performance_score: this.calculatePerformanceScore(metrics)
      }
    });
  }

  /**
   * 사용자 관심사 추적
   */
  public trackUserInterest(featureId: string, interactionType: string, timeSpent: number): void {
    this.trackEvent({
      event_name: 'user_interest',
      event_category: 'engagement',
      event_label: featureId,
      custom_parameters: {
        feature_id: featureId,
        interaction_type: interactionType,
        time_spent: timeSpent,
        interest_level: this.calculateInterestLevel(timeSpent)
      }
    });

    // 높은 관심도는 전환으로 간주
    if (timeSpent > 5000) { // 5초 이상
      this.trackConversion({
        conversion_type: 'feature_interest',
        conversion_value: timeSpent,
        conversion_context: {
          feature_id: featureId,
          interaction_type: interactionType,
          time_spent: timeSpent
        }
      });
    }
  }

  /**
   * Google Analytics 4로 이벤트 전송
   */
  private sendToGA4(event: AnalyticsEvent): void {
    if (typeof gtag === 'undefined') {
      return;
    }

    gtag('event', event.event_name, {
      event_category: event.event_category,
      event_label: event.event_label,
      value: event.event_value,
      custom_map: event.custom_parameters
    });
  }

  /**
   * 세션 요약 전송
   */
  private sendSessionSummary(): void {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const bounceRate = this.events.length < 3 ? 1 : 0; // 3개 미만 이벤트면 바운스로 간주

    const userJourney: UserJourney = {
      session_id: this.sessionId,
      events: this.events,
      conversions: this.conversions,
      session_duration: sessionDuration,
      page_views: this.events.filter(e => e.event_name === 'page_view').length || 1,
      bounce_rate: bounceRate
    };

    // 개발 환경에서는 로거 출력
    if (process.env.NODE_ENV === 'development') {
      const analyticsData = {
        sessionId: this.sessionId,
        duration: `${Math.round(sessionDuration / 1000)}s`,
        events: this.events.length,
        conversions: this.conversions.length,
        bounceRate: `${(bounceRate * 100)}%`
      };

      // logger 사용 (import 필요시 추가)
      if (typeof window !== 'undefined' && (window as any).logger) {
        (window as any).logger.info('📈 Landing Page Analytics Summary', { data: analyticsData });
      }
    }

    // 프로덕션에서는 서버로 전송
    this.sendToAnalyticsServer(userJourney);

    // GA4 세션 요약 이벤트
    this.trackEvent({
      event_name: 'session_end',
      event_category: 'engagement',
      custom_parameters: {
        session_duration: sessionDuration,
        events_count: this.events.length,
        conversions_count: this.conversions.length,
        bounce_rate: bounceRate,
        engagement_score: this.calculateEngagementScore(userJourney)
      }
    });
  }

  /**
   * 분석 서버로 데이터 전송
   */
  private sendToAnalyticsServer(userJourney: UserJourney): void {
    // 개발 환경에서는 서버 전송 건너뛰기
    if (process.env.NODE_ENV === 'development') {
      logger.info('📊 Analytics data (development mode - server transmission skipped)', {
        sessionId: userJourney.session_id,
        data: {
          eventsCount: userJourney.events.length,
          conversionsCount: userJourney.conversions.length,
          sessionDuration: userJourney.session_duration
        }
      });
      return;
    }

    try {
      const data = JSON.stringify(userJourney);

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/session', data);
      } else {
        fetch('/api/analytics/session', {
          method: 'POST',
          body: data,
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
   * 도우미 메서드들
   */
  private generateSessionId(): string {
    return `landing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUrlParameter(name: string): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  private getDeviceType(): string {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  }

  private getCTAValue(ctaText: string): number {
    // CTA별 가치 점수 (비즈니스 로직에 따라 조정)
    switch (ctaText) {
      case '무료로 시작하기': return 100;
      case '데모 보기': return 50;
      case '솔루션 보기': return 30;
      default: return 10;
    }
  }

  private calculateEngagementLevel(scrollDepth: number, timeOnPage: number): string {
    const score = (scrollDepth * 0.4) + (Math.min(timeOnPage / 1000, 300) * 0.6);
    if (score > 80) return 'high';
    if (score > 40) return 'medium';
    return 'low';
  }

  private calculateInterestLevel(timeSpent: number): string {
    if (timeSpent > 10000) return 'high'; // 10초 이상
    if (timeSpent > 3000) return 'medium'; // 3초 이상
    return 'low';
  }

  private calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = 100;

    // LCP 점수 (2.5초 이하가 좋음)
    if (metrics.lcp) {
      if (metrics.lcp > 4000) score -= 30;
      else if (metrics.lcp > 2500) score -= 15;
    }

    // FID 점수 (100ms 이하가 좋음)
    if (metrics.fid) {
      if (metrics.fid > 300) score -= 25;
      else if (metrics.fid > 100) score -= 10;
    }

    // CLS 점수 (0.1 이하가 좋음)
    if (metrics.cls) {
      if (metrics.cls > 0.25) score -= 20;
      else if (metrics.cls > 0.1) score -= 10;
    }

    return Math.max(score, 0);
  }

  private calculateEngagementScore(userJourney: UserJourney): number {
    const baseScore = Math.min((userJourney.session_duration || 0) / 1000 / 60, 10) * 10; // 최대 10분
    const eventScore = Math.min(userJourney.events.length, 20) * 5; // 최대 20개 이벤트
    const conversionScore = userJourney.conversions.length * 20; // 전환당 20점

    return Math.min(baseScore + eventScore + conversionScore, 100);
  }

  /**
   * 세션 정보 조회
   */
  public getSessionInfo(): {
    sessionId: string;
    eventsCount: number;
    conversionsCount: number;
    sessionDuration: number;
  } {
    return {
      sessionId: this.sessionId,
      eventsCount: this.events.length,
      conversionsCount: this.conversions.length,
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }

  /**
   * 리소스 정리
   */
  public cleanup(): void {
    this.sendSessionSummary();
    this.events = [];
    this.conversions = [];
    this.isInitialized = false;
  }
}

// 싱글톤 인스턴스
const analyticsIntegration = new AnalyticsIntegration();

export default analyticsIntegration;
export type { AnalyticsEvent, ConversionEvent, UserJourney };