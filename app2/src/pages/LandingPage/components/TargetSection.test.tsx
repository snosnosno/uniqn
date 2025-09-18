/**
 * TargetSection 컴포넌트 테스트
 *
 * TDD RED 단계: 구현되지 않은 컴포넌트에 대한 테스트
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TargetSection from './TargetSection';
import { TargetGroup } from '../types';

describe('TargetSection', () => {
  const mockTargets: TargetGroup[] = [
    {
      id: 'tournament-organizers',
      name: '대회사',
      title: '토너먼트 주최자를 위한 완벽한 솔루션',
      description: '대규모 토너먼트 운영에 필요한 모든 기능을 한 곳에서 관리하세요.',
      benefits: [
        '실시간 참가자 관리',
        '자동 대진표 생성',
        '상금 분배 시스템',
        '라이브 스트리밍 지원'
      ],
      icon: 'building-office',
      ctaText: '대회사 솔루션 보기'
    },
    {
      id: 'poker-rooms',
      name: '홀덤펍',
      title: '홀덤펍 운영의 새로운 표준',
      description: '효율적인 게임 관리와 고객 서비스로 매출을 극대화하세요.',
      benefits: [
        '테이블 관리 시스템',
        '고객 등급 관리',
        '자동 정산 시스템',
        '예약 관리 기능'
      ],
      icon: 'home',
      ctaText: '홀덤펍 솔루션 보기'
    },
    {
      id: 'staff',
      name: '스태프',
      title: '스태프를 위한 스마트 워크 플랫폼',
      description: '편리한 스케줄 관리와 투명한 급여 시스템으로 더 나은 근무환경을 경험하세요.',
      benefits: [
        '유연한 스케줄 관리',
        '실시간 급여 확인',
        '간편한 출퇴근 체크',
        '커리어 성장 지원'
      ],
      icon: 'user-group',
      ctaText: '스태프 지원하기'
    }
  ];

  const mockOnTargetClick = jest.fn();

  beforeEach(() => {
    mockOnTargetClick.mockClear();
  });

  describe('렌더링 테스트', () => {
    it('Target 섹션이 올바르게 렌더링되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByTestId('target-section')).toBeInTheDocument();
    });

    it('섹션 제목과 부제목이 표시되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByText('맞춤형 솔루션')).toBeInTheDocument();
      expect(screen.getByText('다양한 니즈에 맞는 전문 서비스')).toBeInTheDocument();
    });

    it('모든 타겟 그룹 카드가 렌더링되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByText('대회사')).toBeInTheDocument();
      expect(screen.getByText('홀덤펍')).toBeInTheDocument();
      expect(screen.getByText('스태프')).toBeInTheDocument();
    });

    it('각 타겟의 제목과 설명이 표시되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByText('토너먼트 주최자를 위한 완벽한 솔루션')).toBeInTheDocument();
      expect(screen.getByText('홀덤펍 운영의 새로운 표준')).toBeInTheDocument();
      expect(screen.getByText('스태프를 위한 스마트 워크 플랫폼')).toBeInTheDocument();
    });

    it('각 타겟의 혜택 목록이 표시되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      // 대회사 혜택
      expect(screen.getByText('실시간 참가자 관리')).toBeInTheDocument();
      expect(screen.getByText('자동 대진표 생성')).toBeInTheDocument();

      // 홀덤펍 혜택
      expect(screen.getByText('테이블 관리 시스템')).toBeInTheDocument();
      expect(screen.getByText('고객 등급 관리')).toBeInTheDocument();

      // 스태프 혜택
      expect(screen.getByText('유연한 스케줄 관리')).toBeInTheDocument();
      expect(screen.getByText('실시간 급여 확인')).toBeInTheDocument();
    });

    it('각 타겟의 CTA 버튼이 표시되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByText('대회사 솔루션 보기')).toBeInTheDocument();
      expect(screen.getByText('홀덤펍 솔루션 보기')).toBeInTheDocument();
      expect(screen.getByText('스태프 지원하기')).toBeInTheDocument();
    });

    it('각 타겟의 아이콘이 표시되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const iconContainers = screen.getAllByTestId(/target-icon-/);
      expect(iconContainers).toHaveLength(3);
    });
  });

  describe('상호작용 테스트', () => {
    it('타겟 카드 클릭 시 onTargetClick 콜백이 호출되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const tournamentCard = screen.getByTestId('target-card-tournament-organizers');
      fireEvent.click(tournamentCard);

      expect(mockOnTargetClick).toHaveBeenCalledTimes(1);
      expect(mockOnTargetClick).toHaveBeenCalledWith('tournament-organizers');
    });

    it('CTA 버튼 클릭 시 onTargetClick 콜백이 호출되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const ctaButton = screen.getByText('대회사 솔루션 보기');
      fireEvent.click(ctaButton);

      expect(mockOnTargetClick).toHaveBeenCalledWith('tournament-organizers');
    });

    it('모든 타겟 카드가 클릭 가능해야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const targetCards = screen.getAllByTestId(/target-card-/);

      targetCards.forEach((card, index) => {
        fireEvent.click(card);
        expect(mockOnTargetClick).toHaveBeenCalledTimes(index + 1);
      });
    });

    it('카드에 호버 시 스타일 변화가 있어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const firstCard = screen.getByTestId('target-card-tournament-organizers');

      fireEvent.mouseEnter(firstCard);
      expect(firstCard).toHaveClass('hover:shadow-xl');

      fireEvent.mouseLeave(firstCard);
    });
  });

  describe('반응형 디자인 테스트', () => {
    it('모바일에서 단일 컬럼 레이아웃이어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const targetsGrid = screen.getByTestId('targets-grid');
      expect(targetsGrid).toHaveClass('grid-cols-1');
    });

    it('태블릿에서 2컬럼 레이아웃이어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const targetsGrid = screen.getByTestId('targets-grid');
      expect(targetsGrid).toHaveClass('md:grid-cols-2');
    });

    it('데스크톱에서 3컬럼 레이아웃이어야 한다', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const targetsGrid = screen.getByTestId('targets-grid');
      expect(targetsGrid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('접근성 테스트', () => {
    it('섹션 제목이 적절한 heading 레벨을 가져야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('맞춤형 솔루션');
    });

    it('각 타겟 카드가 키보드로 접근 가능해야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const firstCard = screen.getByTestId('target-card-tournament-organizers');

      firstCard.focus();
      expect(firstCard).toHaveFocus();

      fireEvent.keyDown(firstCard, { key: 'Enter', code: 'Enter' });
      expect(mockOnTargetClick).toHaveBeenCalledWith('tournament-organizers');
    });

    it('각 타겟 카드에 적절한 role과 aria-label이 있어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const firstCard = screen.getByTestId('target-card-tournament-organizers');
      expect(firstCard).toHaveAttribute('role', 'button');
      expect(firstCard).toHaveAttribute('aria-label');
    });

    it('혜택 목록이 적절한 구조로 마크업되어야 한다', () => {
      render(<TargetSection targets={mockTargets} onTargetClick={mockOnTargetClick} />);

      const benefitLists = screen.getAllByRole('list');
      expect(benefitLists.length).toBeGreaterThan(0);

      // 첫 번째 목록의 아이템들 확인
      const firstListItems = screen.getAllByText(/실시간|자동|상금|라이브/);
      expect(firstListItems.length).toBe(4);
    });
  });

  describe('Edge Cases 테스트', () => {
    it('빈 타겟 배열이어도 정상 렌더링되어야 한다', () => {
      render(<TargetSection targets={[]} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByTestId('target-section')).toBeInTheDocument();
      expect(screen.getByText('맞춤형 솔루션')).toBeInTheDocument();
    });

    it('onTargetClick 콜백이 없어도 정상 작동해야 한다', () => {
      render(<TargetSection targets={mockTargets} />);

      const firstCard = screen.getByTestId('target-card-tournament-organizers');

      expect(() => {
        fireEvent.click(firstCard);
      }).not.toThrow();
    });

    it('혜택이 없는 타겟도 처리해야 한다', () => {
      const targetsWithEmptyBenefits: TargetGroup[] = [
        {
          id: 'simple-target',
          name: '간단한 타겟',
          title: '간단한 제목',
          description: '간단한 설명',
          benefits: [],
          icon: 'star',
          ctaText: '자세히 보기'
        }
      ];

      render(<TargetSection targets={targetsWithEmptyBenefits} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByText('간단한 타겟')).toBeInTheDocument();
      expect(screen.getByText('간단한 제목')).toBeInTheDocument();
    });

    it('단일 타겟만 있어도 정상 렌더링되어야 한다', () => {
      const singleTarget = mockTargets.slice(0, 1);

      render(<TargetSection targets={singleTarget} onTargetClick={mockOnTargetClick} />);

      expect(screen.getByText('대회사')).toBeInTheDocument();
      expect(screen.getByTestId('target-card-tournament-organizers')).toBeInTheDocument();
    });
  });

  describe('성능 테스트', () => {
    it('많은 타겟이 있어도 빠르게 렌더링되어야 한다', () => {
      const manyTargets: TargetGroup[] = Array.from({ length: 10 }, (_, i) => ({
        id: `target-${i}`,
        name: `타겟 ${i + 1}`,
        title: `타겟 ${i + 1} 제목`,
        description: `타겟 ${i + 1} 설명`,
        benefits: [`혜택 ${i + 1}-1`, `혜택 ${i + 1}-2`],
        icon: 'star',
        ctaText: `타겟 ${i + 1} 보기`
      }));

      const startTime = performance.now();

      render(<TargetSection targets={manyTargets} onTargetClick={mockOnTargetClick} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
    });
  });
});