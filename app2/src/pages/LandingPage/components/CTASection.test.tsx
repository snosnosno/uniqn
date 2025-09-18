/**
 * CTASection 컴포넌트 테스트
 *
 * TDD RED 단계: 구현되지 않은 컴포넌트에 대한 테스트
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CTASection from './CTASection';
import { CTASection as CTASectionType } from '../types';

describe('CTASection', () => {
  const mockCTAContent: CTASectionType = {
    title: '지금 바로 시작하세요',
    description: 'T-HOLDEM과 함께 더 효율적이고 체계적인 토너먼트 운영을 경험해보세요. 무료 체험으로 시작할 수 있습니다.',
    primaryCTA: {
      text: '무료로 시작하기',
      link: '/signup',
      variant: 'primary'
    },
    secondaryCTA: {
      text: '데모 보기',
      link: '/demo',
      variant: 'secondary'
    }
  };

  const mockOnCtaClick = jest.fn();

  beforeEach(() => {
    mockOnCtaClick.mockClear();
  });

  describe('렌더링 테스트', () => {
    it('CTA 섹션이 올바르게 렌더링되어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      expect(screen.getByTestId('cta-section')).toBeInTheDocument();
    });

    it('제목과 설명이 표시되어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      expect(screen.getByText('지금 바로 시작하세요')).toBeInTheDocument();
      expect(screen.getByText(/T-HOLDEM과 함께 더 효율적이고 체계적인/)).toBeInTheDocument();
    });

    it('Primary CTA 버튼이 표시되어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });
      expect(primaryButton).toBeInTheDocument();
      expect(primaryButton).toHaveClass('bg-blue-600'); // Primary 스타일
    });

    it('Secondary CTA 버튼이 표시되어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const secondaryButton = screen.getByRole('button', { name: '데모 보기' });
      expect(secondaryButton).toBeInTheDocument();
      expect(secondaryButton).toHaveClass('border-blue-600'); // Secondary 스타일
    });

    it('Secondary CTA가 없어도 정상 렌더링되어야 한다', () => {
      const { secondaryCTA, ...contentWithoutSecondaryCTA } = mockCTAContent;

      render(<CTASection content={contentWithoutSecondaryCTA} onCtaClick={mockOnCtaClick} />);

      expect(screen.getByRole('button', { name: '무료로 시작하기' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '데모 보기' })).not.toBeInTheDocument();
    });
  });

  describe('상호작용 테스트', () => {
    it('Primary CTA 버튼 클릭 시 onCtaClick 콜백이 호출되어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });
      fireEvent.click(primaryButton);

      expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
      expect(mockOnCtaClick).toHaveBeenCalledWith('/signup');
    });

    it('Secondary CTA 버튼 클릭 시 onCtaClick 콜백이 호출되어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const secondaryButton = screen.getByRole('button', { name: '데모 보기' });
      fireEvent.click(secondaryButton);

      expect(mockOnCtaClick).toHaveBeenCalledTimes(1);
      expect(mockOnCtaClick).toHaveBeenCalledWith('/demo');
    });

    it('버튼에 호버 시 스타일 변화가 있어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });
      const secondaryButton = screen.getByRole('button', { name: '데모 보기' });

      // Primary 버튼 호버
      fireEvent.mouseEnter(primaryButton);
      expect(primaryButton).toHaveClass('hover:bg-blue-700');

      // Secondary 버튼 호버
      fireEvent.mouseEnter(secondaryButton);
      expect(secondaryButton).toHaveClass('hover:bg-blue-50');

      fireEvent.mouseLeave(primaryButton);
      fireEvent.mouseLeave(secondaryButton);
    });

    it('버튼이 포커스를 받을 수 있어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });
      const secondaryButton = screen.getByRole('button', { name: '데모 보기' });

      primaryButton.focus();
      expect(primaryButton).toHaveFocus();

      secondaryButton.focus();
      expect(secondaryButton).toHaveFocus();
    });
  });

  describe('반응형 디자인 테스트', () => {
    it('모바일에서 버튼들이 세로로 배치되어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const buttonContainer = screen.getByTestId('cta-buttons');
      expect(buttonContainer).toHaveClass('flex-col');
    });

    it('데스크톱에서 버튼들이 가로로 배치되어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const buttonContainer = screen.getByTestId('cta-buttons');
      expect(buttonContainer).toHaveClass('sm:flex-row');
    });

    it('모바일에서 적절한 패딩이 적용되어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const ctaSection = screen.getByTestId('cta-section');
      expect(ctaSection).toHaveClass('px-4');
    });
  });

  describe('접근성 테스트', () => {
    it('섹션 제목이 적절한 heading 레벨을 가져야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('지금 바로 시작하세요');
    });

    it('버튼들이 키보드로 접근 가능해야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });
      const secondaryButton = screen.getByRole('button', { name: '데모 보기' });

      // 탭 순서 확인
      primaryButton.focus();
      expect(primaryButton).toHaveFocus();

      fireEvent.keyDown(primaryButton, { key: 'Tab' });
      secondaryButton.focus();
      expect(secondaryButton).toHaveFocus();
    });

    it('엔터키와 스페이스바로 버튼을 활성화할 수 있어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });

      // 엔터키
      fireEvent.keyDown(primaryButton, { key: 'Enter', code: 'Enter' });
      expect(mockOnCtaClick).toHaveBeenCalledWith('/signup');

      mockOnCtaClick.mockClear();

      // 스페이스바
      fireEvent.keyDown(primaryButton, { key: ' ', code: 'Space' });
      expect(mockOnCtaClick).toHaveBeenCalledWith('/signup');
    });

    it('버튼에 적절한 aria-label이 있어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });
      const secondaryButton = screen.getByRole('button', { name: '데모 보기' });

      expect(primaryButton).toHaveAttribute('aria-label');
      expect(secondaryButton).toHaveAttribute('aria-label');
    });
  });

  describe('버튼 variant 테스트', () => {
    it('Primary variant 버튼이 올바른 스타일을 가져야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });

      expect(primaryButton).toHaveClass('bg-blue-600');
      expect(primaryButton).toHaveClass('text-white');
      expect(primaryButton).toHaveClass('hover:bg-blue-700');
    });

    it('Secondary variant 버튼이 올바른 스타일을 가져야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const secondaryButton = screen.getByRole('button', { name: '데모 보기' });

      expect(secondaryButton).toHaveClass('border-blue-600');
      expect(secondaryButton).toHaveClass('text-blue-600');
      expect(secondaryButton).toHaveClass('hover:bg-blue-50');
    });

    it('Primary variant로 설정된 Secondary CTA도 올바른 스타일을 가져야 한다', () => {
      const contentWithPrimarySecondary: CTASectionType = {
        ...mockCTAContent,
        secondaryCTA: {
          text: 'Primary Secondary',
          link: '/primary-secondary',
          variant: 'primary'
        }
      };

      render(<CTASection content={contentWithPrimarySecondary} onCtaClick={mockOnCtaClick} />);

      const secondaryButton = screen.getByRole('button', { name: 'Primary Secondary' });
      expect(secondaryButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Edge Cases 테스트', () => {
    it('onCtaClick 콜백이 없어도 정상 작동해야 한다', () => {
      render(<CTASection content={mockCTAContent} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });

      expect(() => {
        fireEvent.click(primaryButton);
      }).not.toThrow();
    });

    it('빈 제목과 설명이어도 정상 렌더링되어야 한다', () => {
      const emptyContent: CTASectionType = {
        title: '',
        description: '',
        primaryCTA: {
          text: '클릭하기',
          link: '/click',
          variant: 'primary'
        }
      };

      render(<CTASection content={emptyContent} onCtaClick={mockOnCtaClick} />);

      expect(screen.getByTestId('cta-section')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '클릭하기' })).toBeInTheDocument();
    });

    it('매우 긴 텍스트도 처리해야 한다', () => {
      const longTextContent: CTASectionType = {
        title: 'Very Long Title '.repeat(10),
        description: 'Very Long Description '.repeat(20),
        primaryCTA: {
          text: 'Very Long Button Text That Might Overflow',
          link: '/long',
          variant: 'primary'
        }
      };

      render(<CTASection content={longTextContent} onCtaClick={mockOnCtaClick} />);

      expect(screen.getByTestId('cta-section')).toBeInTheDocument();
    });
  });

  describe('성능 테스트', () => {
    it('컴포넌트가 빠르게 렌더링되어야 한다', () => {
      const startTime = performance.now();

      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(50);
    });

    it('다중 클릭에도 성능 저하가 없어야 한다', () => {
      render(<CTASection content={mockCTAContent} onCtaClick={mockOnCtaClick} />);

      const primaryButton = screen.getByRole('button', { name: '무료로 시작하기' });

      const startTime = performance.now();

      // 100번 클릭
      for (let i = 0; i < 100; i++) {
        fireEvent.click(primaryButton);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(100);
      expect(mockOnCtaClick).toHaveBeenCalledTimes(100);
    });
  });
});