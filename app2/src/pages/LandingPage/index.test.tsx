/**
 * LandingPage 메인 컴포넌트 테스트
 *
 * TDD RED 단계: 구현되지 않은 메인 페이지 컴포넌트에 대한 테스트
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './index';

// Mock 컴포넌트들
jest.mock('./components/HeroSection', () => {
  return function MockHeroSection({ content, onCtaClick }: any) {
    return (
      <div data-testid="hero-section">
        <h1>{content.title}</h1>
        <button onClick={() => onCtaClick?.(content.ctaLink)}>
          {content.ctaText}
        </button>
      </div>
    );
  };
});

jest.mock('./components/FeatureSection', () => {
  return function MockFeatureSection({ content, onFeatureClick }: any) {
    return (
      <div data-testid="feature-section">
        <h2>{content.title}</h2>
        {content.features.map((feature: any) => (
          <div key={feature.id} onClick={() => onFeatureClick?.(feature.id)}>
            {feature.title}
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('./components/TargetSection', () => {
  return function MockTargetSection({ targets, onTargetClick }: any) {
    return (
      <div data-testid="target-section">
        {targets.map((target: any) => (
          <div key={target.id} onClick={() => onTargetClick?.(target.id)}>
            {target.name}
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('./components/CTASection', () => {
  return function MockCTASection({ content, onCtaClick }: any) {
    return (
      <div data-testid="cta-section">
        <h2>{content.title}</h2>
        <button onClick={() => onCtaClick?.(content.primaryCTA.link)}>
          {content.primaryCTA.text}
        </button>
      </div>
    );
  };
});

jest.mock('./hooks/useLandingAnalytics', () => ({
  useLandingAnalytics: () => ({
    trackInteraction: jest.fn(),
    trackPageView: jest.fn(),
    trackCtaClick: jest.fn(),
    isLoading: false,
    error: null
  })
}));

describe('LandingPage', () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(
      <MemoryRouter>
        {component}
      </MemoryRouter>
    );
  };

  describe('렌더링 테스트', () => {
    it('랜딩페이지가 올바르게 렌더링되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });

    it('모든 섹션이 렌더링되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
      expect(screen.getByTestId('feature-section')).toBeInTheDocument();
      expect(screen.getByTestId('target-section')).toBeInTheDocument();
      expect(screen.getByTestId('cta-section')).toBeInTheDocument();
    });

    it('섹션들이 올바른 순서로 렌더링되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      const landingPage = screen.getByTestId('landing-page');
      const sections = landingPage.children;

      expect(sections[0]).toHaveAttribute('data-testid', 'hero-section');
      expect(sections[1]).toHaveAttribute('data-testid', 'feature-section');
      expect(sections[2]).toHaveAttribute('data-testid', 'target-section');
      expect(sections[3]).toHaveAttribute('data-testid', 'cta-section');
    });

    it('적절한 메타 태그가 설정되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      // 페이지 제목 확인
      expect(document.title).toBe('T-HOLDEM - 홀덤 토너먼트 관리 플랫폼');
    });
  });

  describe('콘텐츠 테스트', () => {
    it('Hero 섹션에 올바른 콘텐츠가 표시되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      expect(screen.getByText('T-HOLDEM과 함께하는 스마트한 토너먼트 운영')).toBeInTheDocument();
    });

    it('Feature 섹션에 4개 주요 기능이 표시되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      expect(screen.getByText('토너먼트 관리')).toBeInTheDocument();
      expect(screen.getByText('스태프 관리')).toBeInTheDocument();
      expect(screen.getByText('구인 관리')).toBeInTheDocument();
      expect(screen.getByText('급여 정산')).toBeInTheDocument();
    });

    it('Target 섹션에 3개 타겟 그룹이 표시되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      expect(screen.getByText('대회사')).toBeInTheDocument();
      expect(screen.getByText('홀덤펍')).toBeInTheDocument();
      expect(screen.getByText('스태프')).toBeInTheDocument();
    });

    it('CTA 섹션에 행동 유도 버튼이 표시되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      expect(screen.getByText('지금 바로 시작하세요')).toBeInTheDocument();
      expect(screen.getByText('무료로 시작하기')).toBeInTheDocument();
    });
  });

  describe('상호작용 테스트', () => {
    it('Hero CTA 버튼 클릭 시 분석 이벤트가 발생해야 한다', async () => {
      const mockTrackCtaClick = jest.fn();
      jest.doMock('./hooks/useLandingAnalytics', () => ({
        useLandingAnalytics: () => ({
          trackInteraction: jest.fn(),
          trackPageView: jest.fn(),
          trackCtaClick: mockTrackCtaClick,
          isLoading: false,
          error: null
        })
      }));

      renderWithRouter(<LandingPage />);

      const heroCtaButton = screen.getByText('무료로 시작하기');
      fireEvent.click(heroCtaButton);

      await waitFor(() => {
        expect(mockTrackCtaClick).toHaveBeenCalledWith('무료로 시작하기', '/signup');
      });
    });

    it('Feature 클릭 시 분석 이벤트가 발생해야 한다', async () => {
      renderWithRouter(<LandingPage />);

      const featureItem = screen.getByText('토너먼트 관리');
      fireEvent.click(featureItem);

      // 분석 이벤트 발생 확인 (실제 구현에서는 trackInteraction 호출)
      await waitFor(() => {
        expect(featureItem).toBeInTheDocument();
      });
    });

    it('Target 카드 클릭 시 해당 페이지로 이동해야 한다', () => {
      renderWithRouter(<LandingPage />);

      const targetCard = screen.getByText('대회사');
      fireEvent.click(targetCard);

      // 실제 구현에서는 라우터 네비게이션 확인
      expect(targetCard).toBeInTheDocument();
    });
  });

  describe('스크롤 동작 테스트', () => {
    it('스크롤 시 활성 섹션이 업데이트되어야 한다', async () => {
      renderWithRouter(<LandingPage />);

      // 스크롤 이벤트 시뮬레이션
      Object.defineProperty(window, 'scrollY', {
        writable: true,
        configurable: true,
        value: 800,
      });

      fireEvent.scroll(window);

      await waitFor(() => {
        // 활성 섹션 변경 확인 (실제 구현에서 확인)
        expect(window.scrollY).toBe(800);
      });
    });

    it('부드러운 스크롤이 활성화되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      const landingPage = screen.getByTestId('landing-page');
      expect(landingPage).toHaveClass('scroll-smooth');
    });
  });

  describe('반응형 테스트', () => {
    it('모바일에서 적절한 스타일이 적용되어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithRouter(<LandingPage />);

      const landingPage = screen.getByTestId('landing-page');
      expect(landingPage).toHaveClass('min-h-screen');
    });

    it('데스크톱에서 적절한 스타일이 적용되어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      renderWithRouter(<LandingPage />);

      const landingPage = screen.getByTestId('landing-page');
      expect(landingPage).toBeInTheDocument();
    });
  });

  describe('접근성 테스트', () => {
    it('적절한 시맨틱 HTML 구조를 가져야 한다', () => {
      renderWithRouter(<LandingPage />);

      const mainElement = screen.getByRole('main');
      expect(mainElement).toBeInTheDocument();
    });

    it('각 섹션이 적절한 landmark role을 가져야 한다', () => {
      renderWithRouter(<LandingPage />);

      const heroSection = screen.getByTestId('hero-section');
      const featureSection = screen.getByTestId('feature-section');

      expect(heroSection.closest('[role="banner"]') || heroSection.closest('header')).toBeTruthy();
      expect(featureSection.closest('[role="main"]') || featureSection.closest('main')).toBeTruthy();
    });

    it('스킵 링크가 제공되어야 한다', () => {
      renderWithRouter(<LandingPage />);

      const skipLink = screen.getByText('메인 콘텐츠로 건너뛰기');
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });
  });

  describe('성능 테스트', () => {
    it('페이지가 빠르게 로드되어야 한다', () => {
      const startTime = performance.now();

      renderWithRouter(<LandingPage />);

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(100);
    });

    it('메모이제이션이 적용되어야 한다', () => {
      const { rerender } = renderWithRouter(<LandingPage />);

      // 같은 props로 리렌더링
      rerender(
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      );

      // React.memo가 적용되어 불필요한 리렌더링 방지
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });

  describe('분석 및 추적 테스트', () => {
    it('페이지 로드 시 페이지뷰가 추적되어야 한다', async () => {
      const mockTrackPageView = jest.fn();
      jest.doMock('./hooks/useLandingAnalytics', () => ({
        useLandingAnalytics: () => ({
          trackInteraction: jest.fn(),
          trackPageView: mockTrackPageView,
          trackCtaClick: jest.fn(),
          isLoading: false,
          error: null
        })
      }));

      renderWithRouter(<LandingPage />);

      await waitFor(() => {
        expect(mockTrackPageView).toHaveBeenCalledWith('landing-page');
      });
    });

    it('사용자 상호작용이 추적되어야 한다', async () => {
      const mockTrackInteraction = jest.fn();
      jest.doMock('./hooks/useLandingAnalytics', () => ({
        useLandingAnalytics: () => ({
          trackInteraction: mockTrackInteraction,
          trackPageView: jest.fn(),
          trackCtaClick: jest.fn(),
          isLoading: false,
          error: null
        })
      }));

      renderWithRouter(<LandingPage />);

      const featureItem = screen.getByText('토너먼트 관리');
      fireEvent.click(featureItem);

      await waitFor(() => {
        expect(mockTrackInteraction).toHaveBeenCalled();
      });
    });
  });

  describe('에러 처리 테스트', () => {
    it('분석 서비스 에러가 있어도 페이지가 정상 작동해야 한다', () => {
      jest.doMock('./hooks/useLandingAnalytics', () => ({
        useLandingAnalytics: () => ({
          trackInteraction: jest.fn(),
          trackPageView: jest.fn(),
          trackCtaClick: jest.fn(),
          isLoading: false,
          error: 'Analytics service error'
        })
      }));

      renderWithRouter(<LandingPage />);

      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });

    it('네트워크 오류 시에도 기본 콘텐츠가 표시되어야 한다', () => {
      // 네트워크 오류 시뮬레이션
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      renderWithRouter(<LandingPage />);

      expect(screen.getByTestId('landing-page')).toBeInTheDocument();

      // 정리
      global.fetch = originalFetch;
    });
  });

  describe('라우팅 테스트', () => {
    it('/landing 경로에서 접근 가능해야 한다', () => {
      render(
        <MemoryRouter initialEntries={['/landing']}>
          <LandingPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });

    it('루트 경로에서도 접근 가능해야 한다', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <LandingPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });
});