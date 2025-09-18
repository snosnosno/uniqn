/**
 * HeroSection 컴포넌트 테스트
 *
 * TDD RED 단계: 구현되지 않은 컴포넌트에 대한 테스트
 * 이 테스트들은 현재 실패해야 하며, 구현 후 통과해야 합니다.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HeroSection from './HeroSection';
import { HeroContent } from '../types';

describe('HeroSection', () => {
  const mockHeroContent: HeroContent = {
    title: 'T-HOLDEM 구인구직 플랫폼',
    subtitle: '홀덤 토너먼트 운영의 모든 것',
    description: '효율적인 스태프 관리와 원활한 토너먼트 운영을 위한 원스톱 솔루션입니다.',
    ctaText: '지금 시작하기',
    ctaLink: '/signup',
    backgroundImage: '/images/hero-background.jpg'
  };

  const mockOnCtaClick = jest.fn();

  beforeEach(() => {
    mockOnCtaClick.mockClear();
  });

  describe('렌더링 테스트', () => {
    it('Hero 섹션이 올바르게 렌더링되어야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      // 제목이 표시되어야 함
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText('T-HOLDEM 구인구직 플랫폼')).toBeInTheDocument();
    });

    it('모든 텍스트 콘텐츠가 표시되어야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      expect(screen.getByText('T-HOLDEM 구인구직 플랫폼')).toBeInTheDocument();
      expect(screen.getByText('홀덤 토너먼트 운영의 모든 것')).toBeInTheDocument();
      expect(screen.getByText('효율적인 스태프 관리와 원활한 토너먼트 운영을 위한 원스톱 솔루션입니다.')).toBeInTheDocument();
    });

    it('CTA 버튼이 올바른 텍스트로 표시되어야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const ctaButton = screen.getByRole('button', { name: '지금 시작하기' });
      expect(ctaButton).toBeInTheDocument();
    });

    it('배경 이미지가 설정되어야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      // data-testid를 사용하여 배경 이미지 컨테이너 찾기
      const heroContainer = screen.getByTestId('hero-section');
      expect(heroContainer).toBeInTheDocument();
    });
  });

  describe('상호작용 테스트', () => {
    it('CTA 버튼 클릭 시 onCtaClick 콜백이 호출되어야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const ctaButton = screen.getByRole('button', { name: '지금 시작하기' });
      fireEvent.click(ctaButton);

      expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
      expect(mockOnCtaClick).toHaveBeenCalledWith('/signup');
    });

    it('CTA 버튼에 호버 시 스타일 변화가 있어야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const ctaButton = screen.getByRole('button', { name: '지금 시작하기' });

      // 호버 이벤트 시뮬레이션
      fireEvent.mouseEnter(ctaButton);
      expect(ctaButton).toHaveClass('hover:bg-blue-700'); // Tailwind hover 클래스

      fireEvent.mouseLeave(ctaButton);
    });
  });

  describe('반응형 디자인 테스트', () => {
    it('모바일에서 적절한 클래스가 적용되어야 한다', () => {
      // 모바일 뷰포트 설정
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const heroContainer = screen.getByTestId('hero-section');
      expect(heroContainer).toHaveClass('px-4'); // 모바일 패딩
    });

    it('데스크톱에서 적절한 클래스가 적용되어야 한다', () => {
      // 데스크톱 뷰포트 설정
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const heroContainer = screen.getByTestId('hero-section');
      expect(heroContainer).toHaveClass('lg:px-8'); // 데스크톱 패딩
    });
  });

  describe('접근성 테스트', () => {
    it('제목이 적절한 heading 레벨을 가져야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('T-HOLDEM 구인구직 플랫폼');
    });

    it('CTA 버튼이 키보드로 접근 가능해야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const ctaButton = screen.getByRole('button', { name: '지금 시작하기' });

      // 탭으로 포커스 이동
      ctaButton.focus();
      expect(ctaButton).toHaveFocus();

      // 엔터키로 클릭
      fireEvent.keyDown(ctaButton, { key: 'Enter', code: 'Enter' });
      expect(mockOnCtaClick).toHaveBeenCalledWith('/signup');
    });

    it('배경 이미지에 대한 대체 텍스트가 있어야 한다', () => {
      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      // 배경 이미지 대신 alt 텍스트 확인 (실제 구현에서는 aria-label 사용 예정)
      const heroSection = screen.getByTestId('hero-section');
      expect(heroSection).toHaveAttribute('aria-label');
    });
  });

  describe('Edge Cases 테스트', () => {
    it('배경 이미지가 없어도 정상 렌더링되어야 한다', () => {
      const contentWithoutImage: HeroContent = {
        ...mockHeroContent,
        backgroundImage: undefined
      };

      render(<HeroSection content={contentWithoutImage} onCtaClick={mockOnCtaClick} />);

      expect(screen.getByText('T-HOLDEM 구인구직 플랫폼')).toBeInTheDocument();
    });

    it('onCtaClick 콜백이 없어도 정상 작동해야 한다', () => {
      render(<HeroSection content={mockHeroContent} />);

      const ctaButton = screen.getByRole('button', { name: '지금 시작하기' });

      // 에러 없이 클릭 가능해야 함
      expect(() => {
        fireEvent.click(ctaButton);
      }).not.toThrow();
    });

    it('빈 문자열 콘텐츠 처리', () => {
      const emptyContent: HeroContent = {
        title: '',
        subtitle: '',
        description: '',
        ctaText: '',
        ctaLink: ''
      };

      render(<HeroSection content={emptyContent} onCtaClick={mockOnCtaClick} />);

      // 빈 콘텐츠여도 컴포넌트가 렌더링되어야 함
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    });
  });

  describe('성능 테스트', () => {
    it('컴포넌트가 빠르게 렌더링되어야 한다', () => {
      const startTime = performance.now();

      render(<HeroSection content={mockHeroContent} onCtaClick={mockOnCtaClick} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // 50ms 이내에 렌더링되어야 함 (성능 목표)
      expect(renderTime).toBeLessThan(50);
    });
  });
});