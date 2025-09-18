/**
 * FeatureSection 컴포넌트 테스트
 *
 * TDD RED 단계: 구현되지 않은 컴포넌트에 대한 테스트
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeatureSection from './FeatureSection';
import { FeatureSection as FeatureSectionType } from '../types';

describe('FeatureSection', () => {
  const mockFeatureContent: FeatureSectionType = {
    title: '주요 기능',
    subtitle: 'T-HOLDEM이 제공하는 강력한 기능들',
    features: [
      {
        id: 'tournament-management',
        title: '토너먼트 관리',
        description: '효율적인 토너먼트 생성 및 관리 시스템',
        icon: 'trophy',
        benefits: ['실시간 진행 상황 추적', '자동 순위 계산', '상금 분배 관리']
      },
      {
        id: 'staff-management',
        title: '스태프 관리',
        description: '체계적인 인력 관리 및 스케줄링',
        icon: 'users',
        benefits: ['스마트 스케줄링', '출석 관리', '급여 자동 계산']
      },
      {
        id: 'job-posting',
        title: '구인 관리',
        description: '효과적인 구인공고 및 지원자 관리',
        icon: 'briefcase',
        benefits: ['맞춤형 구인공고', '지원자 필터링', '면접 스케줄 관리']
      },
      {
        id: 'payroll',
        title: '급여 정산',
        description: '정확하고 투명한 급여 계산 시스템',
        icon: 'currency-dollar',
        benefits: ['자동 급여 계산', '세금 공제 처리', '급여명세서 발급']
      }
    ]
  };

  const mockOnFeatureClick = jest.fn();

  beforeEach(() => {
    mockOnFeatureClick.mockClear();
  });

  describe('렌더링 테스트', () => {
    it('Feature 섹션이 올바르게 렌더링되어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      expect(screen.getByTestId('feature-section')).toBeInTheDocument();
      expect(screen.getByText('주요 기능')).toBeInTheDocument();
      expect(screen.getByText('T-HOLDEM이 제공하는 강력한 기능들')).toBeInTheDocument();
    });

    it('모든 기능 카드가 렌더링되어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      expect(screen.getByText('토너먼트 관리')).toBeInTheDocument();
      expect(screen.getByText('스태프 관리')).toBeInTheDocument();
      expect(screen.getByText('구인 관리')).toBeInTheDocument();
      expect(screen.getByText('급여 정산')).toBeInTheDocument();
    });

    it('각 기능의 설명이 표시되어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      expect(screen.getByText('효율적인 토너먼트 생성 및 관리 시스템')).toBeInTheDocument();
      expect(screen.getByText('체계적인 인력 관리 및 스케줄링')).toBeInTheDocument();
      expect(screen.getByText('효과적인 구인공고 및 지원자 관리')).toBeInTheDocument();
      expect(screen.getByText('정확하고 투명한 급여 계산 시스템')).toBeInTheDocument();
    });

    it('각 기능의 혜택 목록이 표시되어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      // 첫 번째 기능의 혜택들
      expect(screen.getByText('실시간 진행 상황 추적')).toBeInTheDocument();
      expect(screen.getByText('자동 순위 계산')).toBeInTheDocument();
      expect(screen.getByText('상금 분배 관리')).toBeInTheDocument();

      // 두 번째 기능의 혜택들
      expect(screen.getByText('스마트 스케줄링')).toBeInTheDocument();
      expect(screen.getByText('출석 관리')).toBeInTheDocument();
      expect(screen.getByText('급여 자동 계산')).toBeInTheDocument();
    });

    it('아이콘이 각 기능 카드에 표시되어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      // 아이콘 컨테이너들이 존재해야 함
      const iconContainers = screen.getAllByTestId(/feature-icon-/);
      expect(iconContainers).toHaveLength(4);
    });
  });

  describe('상호작용 테스트', () => {
    it('기능 카드 클릭 시 onFeatureClick 콜백이 호출되어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const tournamentCard = screen.getByTestId('feature-card-tournament-management');
      fireEvent.click(tournamentCard);

      expect(mockOnFeatureClick).toHaveBeenCalledTimes(1);
      expect(mockOnFeatureClick).toHaveBeenCalledWith('tournament-management');
    });

    it('모든 기능 카드가 클릭 가능해야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const featureCards = screen.getAllByTestId(/feature-card-/);

      featureCards.forEach((card, index) => {
        fireEvent.click(card);
        expect(mockOnFeatureClick).toHaveBeenCalledTimes(index + 1);
      });
    });

    it('카드에 호버 시 스타일 변화가 있어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const firstCard = screen.getByTestId('feature-card-tournament-management');

      fireEvent.mouseEnter(firstCard);
      expect(firstCard).toHaveClass('hover:shadow-lg');

      fireEvent.mouseLeave(firstCard);
    });
  });

  describe('반응형 디자인 테스트', () => {
    it('모바일에서 단일 컬럼 레이아웃이어야 한다', () => {
      // 모바일 뷰포트 설정
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const featuresGrid = screen.getByTestId('features-grid');
      expect(featuresGrid).toHaveClass('grid-cols-1');
    });

    it('태블릿에서 2컬럼 레이아웃이어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const featuresGrid = screen.getByTestId('features-grid');
      expect(featuresGrid).toHaveClass('md:grid-cols-2');
    });

    it('데스크톱에서 4컬럼 레이아웃이어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const featuresGrid = screen.getByTestId('features-grid');
      expect(featuresGrid).toHaveClass('lg:grid-cols-4');
    });
  });

  describe('접근성 테스트', () => {
    it('섹션 제목이 적절한 heading 레벨을 가져야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('주요 기능');
    });

    it('각 기능 카드가 키보드로 접근 가능해야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const firstCard = screen.getByTestId('feature-card-tournament-management');

      firstCard.focus();
      expect(firstCard).toHaveFocus();

      fireEvent.keyDown(firstCard, { key: 'Enter', code: 'Enter' });
      expect(mockOnFeatureClick).toHaveBeenCalledWith('tournament-management');
    });

    it('각 기능 카드에 적절한 role과 aria-label이 있어야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} onFeatureClick={mockOnFeatureClick} />);

      const firstCard = screen.getByTestId('feature-card-tournament-management');
      expect(firstCard).toHaveAttribute('role', 'button');
      expect(firstCard).toHaveAttribute('aria-label');
    });
  });

  describe('Edge Cases 테스트', () => {
    it('빈 기능 배열이어도 정상 렌더링되어야 한다', () => {
      const emptyContent: FeatureSectionType = {
        title: '주요 기능',
        subtitle: 'T-HOLDEM이 제공하는 강력한 기능들',
        features: []
      };

      render(<FeatureSection content={emptyContent} onFeatureClick={mockOnFeatureClick} />);

      expect(screen.getByTestId('feature-section')).toBeInTheDocument();
      expect(screen.getByText('주요 기능')).toBeInTheDocument();
    });

    it('onFeatureClick 콜백이 없어도 정상 작동해야 한다', () => {
      render(<FeatureSection content={mockFeatureContent} />);

      const firstCard = screen.getByTestId('feature-card-tournament-management');

      expect(() => {
        fireEvent.click(firstCard);
      }).not.toThrow();
    });

    it('혜택이 없는 기능도 처리해야 한다', () => {
      const contentWithEmptyBenefits: FeatureSectionType = {
        ...mockFeatureContent,
        features: [
          {
            id: 'simple-feature',
            title: '간단한 기능',
            description: '설명만 있는 기능',
            icon: 'star',
            benefits: []
          }
        ]
      };

      render(<FeatureSection content={contentWithEmptyBenefits} onFeatureClick={mockOnFeatureClick} />);

      expect(screen.getByText('간단한 기능')).toBeInTheDocument();
      expect(screen.getByText('설명만 있는 기능')).toBeInTheDocument();
    });
  });

  describe('성능 테스트', () => {
    it('많은 기능이 있어도 빠르게 렌더링되어야 한다', () => {
      const manyFeatures: FeatureSectionType = {
        ...mockFeatureContent,
        features: Array.from({ length: 20 }, (_, i) => ({
          id: `feature-${i}`,
          title: `기능 ${i + 1}`,
          description: `기능 ${i + 1}의 설명`,
          icon: 'star',
          benefits: [`혜택 ${i + 1}-1`, `혜택 ${i + 1}-2`]
        }))
      };

      const startTime = performance.now();

      render(<FeatureSection content={manyFeatures} onFeatureClick={mockOnFeatureClick} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
    });
  });
});