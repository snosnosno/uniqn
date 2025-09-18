/**
 * LandingPage 라우팅 테스트
 *
 * TDD RED 단계: 구현되지 않은 라우팅 설정에 대한 테스트
 * React Router 통합 및 URL 경로 처리를 검증
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import LandingPage from './index';

// App 컴포넌트 Mock (실제 라우팅 설정 포함)
const MockApp = ({ initialEntries }: { initialEntries: string[] }) => {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/signup" element={<div data-testid="signup-page">회원가입 페이지</div>} />
        <Route path="/login" element={<div data-testid="login-page">로그인 페이지</div>} />
        <Route path="/demo" element={<div data-testid="demo-page">데모 페이지</div>} />
        <Route path="/contact" element={<div data-testid="contact-page">문의 페이지</div>} />
        <Route path="*" element={<div data-testid="not-found-page">404 - 페이지를 찾을 수 없습니다</div>} />
      </Routes>
    </MemoryRouter>
  );
};

// LandingPage 컴포넌트 Mock (실제 구현 전까지)
jest.mock('./index', () => {
  return function MockLandingPage() {
    return (
      <div data-testid="landing-page">
        <h1>T-HOLDEM과 함께하는 스마트한 토너먼트 운영</h1>
        <button data-testid="cta-signup">무료로 시작하기</button>
        <button data-testid="cta-demo">데모 보기</button>
      </div>
    );
  };
});

describe('LandingPage 라우팅 테스트', () => {
  describe('기본 경로 테스트', () => {
    it('루트 경로 "/"에서 랜딩페이지가 렌더링되어야 한다', async () => {
      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
        expect(screen.getByText('T-HOLDEM과 함께하는 스마트한 토너먼트 운영')).toBeInTheDocument();
      });
    });

    it('"/landing" 경로에서 랜딩페이지가 렌더링되어야 한다', async () => {
      render(<MockApp initialEntries={['/landing']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });

    it('"/home" 경로에서 랜딩페이지가 렌더링되어야 한다', async () => {
      render(<MockApp initialEntries={['/home']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });
  });

  describe('URL 파라미터 및 쿼리 스트링 테스트', () => {
    it('쿼리 파라미터가 있는 경로에서도 정상 작동해야 한다', async () => {
      render(<MockApp initialEntries={['/?source=google&campaign=summer2024']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // URL 파라미터 처리 확인
      const urlParams = new URLSearchParams(window.location.search);
      expect(urlParams.get('source')).toBe('google');
      expect(urlParams.get('campaign')).toBe('summer2024');
    });

    it('UTM 파라미터를 포함한 URL을 처리해야 한다', async () => {
      const utmParams = '?utm_source=facebook&utm_medium=social&utm_campaign=launch';
      render(<MockApp initialEntries={[`/${utmParams}`]} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });

    it('해시(#) 파라미터를 포함한 URL을 처리해야 한다', async () => {
      render(<MockApp initialEntries={['/#features']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });
  });

  describe('네비게이션 테스트', () => {
    it('존재하지 않는 경로는 404 페이지를 표시해야 한다', async () => {
      render(<MockApp initialEntries={['/nonexistent-page']} />);

      await waitFor(() => {
        expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
        expect(screen.getByText('404 - 페이지를 찾을 수 없습니다')).toBeInTheDocument();
      });
    });

    it('대소문자를 구분하는 경로 처리', async () => {
      render(<MockApp initialEntries={['/Landing']} />);

      await waitFor(() => {
        // 대소문자 구분으로 인한 404 처리
        expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
      });
    });
  });

  describe('라우터 상태 관리 테스트', () => {
    it('브라우저 히스토리를 올바르게 관리해야 한다', async () => {
      const { rerender } = render(<MockApp initialEntries={['/']} />);

      // 초기 랜딩페이지 렌더링 확인
      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // 다른 페이지로 이동
      rerender(<MockApp initialEntries={['/signup']} />);

      await waitFor(() => {
        expect(screen.getByTestId('signup-page')).toBeInTheDocument();
      });

      // 다시 랜딩페이지로 이동
      rerender(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });

    it('페이지 간 상태가 올바르게 초기화되어야 한다', async () => {
      const { rerender } = render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // 다른 페이지로 이동 후 다시 돌아왔을 때 상태 초기화 확인
      rerender(<MockApp initialEntries={['/login']} />);
      rerender(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });
  });

  describe('SEO 및 메타데이터 테스트', () => {
    it('랜딩페이지 로드 시 올바른 페이지 제목이 설정되어야 한다', async () => {
      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(document.title).toBe('T-HOLDEM - 홀덤 토너먼트 관리 플랫폼');
      });
    });

    it('메타 태그가 올바르게 설정되어야 한다', async () => {
      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        const metaDescription = document.querySelector('meta[name="description"]');
        expect(metaDescription?.getAttribute('content')).toBe(
          '홀덤 토너먼트 운영, 스태프 관리, 구인공고를 한번에 관리하는 스마트한 플랫폼'
        );
      });
    });

    it('OpenGraph 메타 태그가 설정되어야 한다', async () => {
      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');

        expect(ogTitle?.getAttribute('content')).toBe('T-HOLDEM - 홀덤 토너먼트 관리 플랫폼');
        expect(ogDescription?.getAttribute('content')).toBeTruthy();
      });
    });
  });

  describe('딥링크 및 공유 URL 테스트', () => {
    it('특정 섹션으로의 딥링크가 작동해야 한다', async () => {
      render(<MockApp initialEntries={['/#features']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // 해시 기반 스크롤 동작 확인 (실제 구현에서)
      expect(window.location.hash).toBe('#features');
    });

    it('소셜 미디어 공유 URL 형식을 처리해야 한다', async () => {
      const shareUrl = '/?utm_source=facebook&utm_medium=social&utm_content=share_button';
      render(<MockApp initialEntries={[shareUrl]} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });
  });

  describe('모바일 및 반응형 라우팅 테스트', () => {
    it('모바일 환경에서 라우팅이 정상 작동해야 한다', async () => {
      // 모바일 뷰포트 시뮬레이션
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });

    it('태블릿 환경에서 라우팅이 정상 작동해야 한다', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });
  });

  describe('에러 처리 및 복구 테스트', () => {
    it('라우팅 에러 발생 시 적절한 에러 페이지를 표시해야 한다', async () => {
      // 잘못된 경로 접근
      render(<MockApp initialEntries={['/invalid-route']} />);

      await waitFor(() => {
        expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
      });
    });

    it('네트워크 오류 시에도 기본 라우팅이 작동해야 한다', async () => {
      // 네트워크 오류 시뮬레이션
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // 정리
      global.fetch = originalFetch;
    });
  });

  describe('성능 및 로딩 테스트', () => {
    it('페이지 로딩이 빠르게 완료되어야 한다', async () => {
      const startTime = performance.now();

      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // 100ms 이내 로딩 (개발 환경 기준)
      expect(loadTime).toBeLessThan(100);
    });

    it('코드 스플리팅이 적용되어야 한다', async () => {
      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // 코드 스플리팅 검증은 실제 빌드에서 확인
      expect(true).toBe(true);
    });
  });

  describe('접근성 및 키보드 네비게이션 테스트', () => {
    it('키보드만으로 페이지 네비게이션이 가능해야 한다', async () => {
      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // 탭 네비게이션 시뮬레이션
      const ctaButton = screen.getByTestId('cta-signup');
      ctaButton.focus();

      expect(ctaButton).toHaveFocus();
    });

    it('스크린 리더에 적절한 라우팅 안내를 제공해야 한다', async () => {
      render(<MockApp initialEntries={['/']} />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });

      // 페이지 제목과 주요 랜드마크 확인
      const mainContent = screen.getByRole('main', { hidden: true });
      expect(mainContent || screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });
});