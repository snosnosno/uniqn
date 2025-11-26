/**
 * LandingPage 메인 컴포넌트
 *
 * TDD GREEN 단계: 테스트를 통과하는 랜딩페이지 메인 컴포넌트 구현
 * Hero, Feature, Target, CTA 섹션을 통합하고 스크롤 동작 및 분석 기능 포함
 */

import React, { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLandingAnalytics } from './hooks/useLandingAnalytics';
import {
  HeroContent,
  FeatureSection as FeatureSectionType,
  TargetGroup,
  CTASection as CTASectionType,
} from './types';
import { logger } from '../../utils/logger';
import performanceMonitor from './utils/performanceMonitor';
import './styles/LandingPage.css';

// 네비게이션과 Footer는 즉시 로드 (중요한 UI 요소)
import LandingNavigation from './components/LandingNavigation';
import FooterSection from './components/FooterSection';

// Lazy load components for better performance
const HeroSection = lazy(() => import('./components/HeroSection'));
const FeatureSection = lazy(() => import('./components/FeatureSection'));
const TargetSection = lazy(() => import('./components/TargetSection'));
const CTASection = lazy(() => import('./components/CTASection'));

// 간단한 로딩 컴포넌트
const SectionLoader: React.FC = () => (
  <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"></div>
);

// 랜딩페이지 콘텐츠 데이터
const heroContent: HeroContent = {
  title: 'Smart Tournament Management with UNIQN',
  subtitle: 'Complete Tournament Management Solution',
  description: '효율적인 스태프 관리와 원활한 토너먼트 운영을 위한 원스톱 솔루션입니다.',
  ctaText: '무료로 시작하기',
  ctaLink: '/signup',
};

const featureContent: FeatureSectionType = {
  title: '주요 기능',
  subtitle: 'Powerful features provided by UNIQN',
  features: [
    {
      id: 'job-posting',
      title: '구인 관리',
      description: '효과적인 구인공고 및 지원자 관리',
      icon: 'briefcase',
      benefits: ['맞춤형 구인공고', '지원자 필터링', '면접 스케줄 관리'],
    },
    {
      id: 'staff-management',
      title: '스태프 관리',
      description: '체계적인 인력 관리 및 스케줄링',
      icon: 'users',
      benefits: ['스마트 스케줄링', '출석 관리', '급여 자동 계산'],
    },
    {
      id: 'payroll',
      title: '급여 정산',
      description: '정확하고 투명한 급여 계산 시스템',
      icon: 'currency-dollar',
      benefits: ['자동 급여 계산', '세금 공제 처리', '급여명세서 발급'],
    },
    {
      id: 'tournament-management',
      title: '토너먼트 관리',
      description: '효율적인 토너먼트 생성 및 관리 시스템',
      icon: 'trophy',
      benefits: ['실시간 진행 상황 추적', '자동 순위 계산', '상금 분배 관리'],
    },
  ],
};

const targetGroups: TargetGroup[] = [
  {
    id: 'tournament-organizers',
    name: '대회사',
    title: '토너먼트 주최자를 위한 완벽한 솔루션',
    description: '대규모 토너먼트 운영에 필요한 모든 기능을 한 곳에서 관리하세요.',
    benefits: [
      '실시간 참가자 관리',
      '자동 대진표 생성',
      '상금 분배 시스템',
      '라이브 스트리밍 지원',
    ],
    icon: 'building-office',
    ctaText: '대회사 솔루션 보기',
  },
  {
    id: 'poker-rooms',
    name: 'Poker Rooms',
    title: 'New Standard for Poker Room Operations',
    description: '효율적인 게임 관리와 고객 서비스로 매출을 극대화하세요.',
    benefits: ['테이블 관리 시스템', '고객 등급 관리', '자동 정산 시스템', '예약 관리 기능'],
    icon: 'home',
    ctaText: 'View Poker Room Solution',
  },
  {
    id: 'staff',
    name: '스태프',
    title: '스태프를 위한 스마트 워크 플랫폼',
    description: '편리한 스케줄 관리와 투명한 급여 시스템으로 더 나은 근무환경을 경험하세요.',
    benefits: ['유연한 스케줄 관리', '실시간 급여 확인', '간편한 출퇴근 체크', '커리어 성장 지원'],
    icon: 'user-group',
    ctaText: '스태프 지원하기',
  },
];

const ctaContent: CTASectionType = {
  title: '지금 바로 시작하세요',
  description:
    'Experience more efficient and systematic tournament management with UNIQN. Start with a free trial.',
  primaryCTA: {
    text: '무료로 시작하기',
    link: '/signup',
    variant: 'primary',
  },
  secondaryCTA: {
    text: '데모 보기',
    link: '/demo',
    variant: 'secondary',
  },
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const analytics = useLandingAnalytics();
  const [activeSection, setActiveSection] = useState<string>('hero');

  // 페이지 로드 시 분석 추적 및 성능 모니터링 초기화
  useEffect(() => {
    analytics.trackPageView('landing-page');

    // 성능 모니터링 초기화
    performanceMonitor.initialize();

    // 페이지 성능 메트릭 수집 (기존 로직 유지 + 성능 모니터 연동)
    const collectPerformanceMetrics = () => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        const performanceData = {
          loadTime: navigation.loadEventEnd - navigation.fetchStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        };

        // 기존 분석 시스템으로 전송
        analytics.trackPerformance('page_load', performanceData);

        // 성능 모니터에서 상세 메트릭 보고서 출력 (개발 환경)
        if (process.env.NODE_ENV === 'development') {
          setTimeout(() => {
            const report = performanceMonitor.getMetricsReport();
            const alerts = performanceMonitor.checkPerformanceAlerts();

            logger.info('🚀 Landing Page Performance Report', report);

            if (alerts.length > 0) {
              logger.warn('⚠️ Performance Alerts', { alerts });
            } else {
              logger.info('✅ All performance metrics are within acceptable ranges');
            }
          }, 3000); // 3초 후 메트릭 출력 (모든 데이터 수집 완료)
        }
      }
    };

    // DOM 로드 완료 후 메트릭 수집
    if (document.readyState === 'complete') {
      collectPerformanceMetrics();
    } else {
      window.addEventListener('load', collectPerformanceMetrics);
    }

    // 컴포넌트 언마운트 시 성능 모니터 정리
    return () => {
      window.removeEventListener('load', collectPerformanceMetrics);
      performanceMonitor.cleanup();
    };
  }, [analytics]);

  // 스크롤 이벤트 핸들러
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // 스크롤 깊이 계산 (백분율)
      const scrollDepth = Math.round((scrollY / (documentHeight - windowHeight)) * 100);

      // 스크롤 추적 (25% 단위)
      if (scrollDepth % 25 === 0 && scrollDepth > 0) {
        analytics.trackScroll(scrollDepth, activeSection);
      }

      // 활성 섹션 업데이트
      const sections = [
        { id: 'hero', element: document.querySelector('[data-testid="hero-section"]') },
        { id: 'features', element: document.querySelector('[data-testid="feature-section"]') },
        { id: 'targets', element: document.querySelector('[data-testid="target-section"]') },
        { id: 'cta', element: document.querySelector('[data-testid="cta-section"]') },
      ];

      for (const section of sections) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= windowHeight / 2 && rect.bottom >= windowHeight / 2) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [analytics, activeSection]);

  // CTA 클릭 핸들러
  const handleCtaClick = useCallback(
    (link: string) => {
      const ctaText = link === '/signup' ? '무료로 시작하기' : '데모 보기';

      analytics.trackCtaClick(ctaText, link, {
        section: activeSection,
        timestamp: Date.now(),
      });

      // 네비게이션
      navigate(link);
    },
    [analytics, navigate, activeSection]
  );

  // 기능 클릭 핸들러
  const handleFeatureClick = useCallback(
    (featureId: string) => {
      analytics.trackInteraction('feature_click', {
        feature_id: featureId,
        section: 'features',
      });

      // 기능별 실제 페이지로 이동
      const routeMap: Record<string, string> = {
        'job-posting': '/admin/job-postings',
        'staff-management': '/admin/shift-schedule',
        payroll: '/admin/job-postings',
        'tournament-management': '/admin/participants',
      };

      const route = routeMap[featureId];
      if (route) {
        navigate(route);
      } else {
        logger.info('Feature clicked', { featureId });
      }
    },
    [analytics, navigate]
  );

  // 타겟 클릭 핸들러
  const handleTargetClick = useCallback(
    (targetId: string) => {
      analytics.trackInteraction('target_click', {
        target_id: targetId,
        section: 'targets',
      });

      // 타겟별 실제 기능으로 이동
      const routeMap: Record<string, string> = {
        'tournament-organizers': '/admin/job-postings',
        'poker-rooms': '/admin/job-postings',
        staff: '/jobs',
      };

      const route = routeMap[targetId];
      if (route) {
        navigate(route);
      } else {
        // fallback to solutions page
        navigate(`/solutions/${targetId}`);
      }
    },
    [analytics, navigate]
  );

  // 스킵 링크 핸들러
  const handleSkipToMain = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
          mainContent.focus();
          analytics.trackInteraction('skip_link_used', {
            accessibility: true,
          });
        }
      }
    },
    [analytics]
  );

  // 네비게이션 섹션 클릭 핸들러
  const handleNavigationSectionClick = useCallback(
    (sectionId: string) => {
      analytics.trackInteraction('nav_section_click', {
        section: sectionId,
        navigation_type: 'landing_nav',
      });
    },
    [analytics]
  );

  return (
    <div data-testid="landing-page" className="min-h-screen scroll-smooth landing-page">
      {/* 네비게이션 바 */}
      <LandingNavigation onSectionClick={handleNavigationSectionClick} />

      {/* 스킵 링크 (접근성) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-20 focus:left-4 bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg z-50 focus-visible"
        onKeyDown={handleSkipToMain}
      >
        메인 콘텐츠로 건너뛰기
      </a>

      {/* 메인 콘텐츠 */}
      <main id="main-content" role="main" tabIndex={-1}>
        {/* Hero 섹션 */}
        <Suspense fallback={<SectionLoader />}>
          <HeroSection content={heroContent} onCtaClick={handleCtaClick} />
        </Suspense>

        {/* Features 섹션 */}
        <Suspense fallback={<SectionLoader />}>
          <FeatureSection content={featureContent} onFeatureClick={handleFeatureClick} />
        </Suspense>

        {/* Target 섹션 */}
        <Suspense fallback={<SectionLoader />}>
          <TargetSection targets={targetGroups} onTargetClick={handleTargetClick} />
        </Suspense>

        {/* CTA 섹션 */}
        <Suspense fallback={<SectionLoader />}>
          <CTASection content={ctaContent} onCtaClick={handleCtaClick} />
        </Suspense>
      </main>

      {/* Footer 섹션 */}
      <FooterSection />

      {/* 플로팅 네비게이션 (옵션) */}
      <nav
        className="fixed right-6 top-1/2 transform -translate-y-1/2 z-40 hidden lg:block floating-nav"
        aria-label="페이지 섹션 네비게이션"
      >
        <div className="bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-90 backdrop-blur-sm rounded-full p-3 shadow-lg">
          {[
            { id: 'hero', label: '홈' },
            { id: 'features', label: '기능' },
            { id: 'targets', label: '솔루션' },
            { id: 'cta', label: '시작하기' },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => {
                const element = document.querySelector(`[data-testid="${section.id}-section"]`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  analytics.trackInteraction('nav_click', {
                    section: section.id,
                    navigation_type: 'floating',
                  });
                }
              }}
              className={`
                block w-3 h-3 rounded-full mb-3 last:mb-0 floating-nav-dot focus-visible
                ${
                  activeSection === section.id
                    ? 'bg-blue-600 dark:bg-blue-500 scale-125 active'
                    : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                }
              `}
              aria-label={`${section.label} 섹션으로 이동`}
              title={section.label}
            />
          ))}
        </div>
      </nav>

      {/* 분석 에러 처리 */}
      {analytics.error && process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg shadow-lg z-50">
          <strong className="font-bold">분석 오류:</strong>
          <span className="block sm:inline ml-1">{analytics.error}</span>
        </div>
      )}
    </div>
  );
};

export default React.memo(LandingPage);
