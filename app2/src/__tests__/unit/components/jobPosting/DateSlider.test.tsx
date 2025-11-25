import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DateSlider } from '@/components/jobPosting/DateSlider';

/**
 * DateSlider 컴포넌트 단위 테스트
 * - 날짜 범위 생성 및 렌더링 테스트 (어제~+14일)
 * - 전체 버튼 클릭 테스트
 * - 날짜 선택 테스트
 * - 오늘/어제 라벨 표시 테스트
 * - 다크모드 스타일 테스트
 */

// IntersectionObserver 모킹
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// scrollIntoView 모킹
Element.prototype.scrollIntoView = jest.fn();

describe('DateSlider', () => {
  const mockOnDateSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('렌더링', () => {
    it('전체 버튼이 렌더링됨', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      expect(screen.getByRole('button', { name: '전체' })).toBeInTheDocument();
    });

    it('오늘 버튼이 렌더링됨', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      expect(screen.getByRole('button', { name: '오늘' })).toBeInTheDocument();
    });

    it('어제 버튼이 렌더링됨', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      expect(screen.getByRole('button', { name: '어제' })).toBeInTheDocument();
    });

    it.skip('날짜 버튼들이 렌더링됨 (16개 = 어제 + 오늘 + 14일)', () => {
      const { container } = render(
        <DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />
      );

      // 전체 버튼 + 16개 날짜 버튼 = 17개
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(17);
    });

    it('날짜 형식이 M/D로 표시됨', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      // M/D 형식 패턴 확인 (예: 1/15, 12/31)
      const buttons = screen.getAllByRole('button');
      const dateButtons = buttons.filter(btn =>
        /^\d{1,2}\/\d{1,2}$/.test(btn.textContent || '')
      );

      expect(dateButtons.length).toBeGreaterThan(0);
    });
  });

  describe('전체 버튼', () => {
    it('전체 버튼 클릭 시 onDateSelect(null) 호출', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const allButton = screen.getByRole('button', { name: '전체' });
      fireEvent.click(allButton);

      expect(mockOnDateSelect).toHaveBeenCalledWith(null);
    });

    it('selectedDate가 null일 때 전체 버튼이 활성 상태', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const allButton = screen.getByRole('button', { name: '전체' });
      expect(allButton).toHaveClass('bg-blue-600');
    });

    it('selectedDate가 있을 때 전체 버튼이 비활성 상태', () => {
      const today = new Date();
      render(<DateSlider selectedDate={today} onDateSelect={mockOnDateSelect} />);

      const allButton = screen.getByRole('button', { name: '전체' });
      expect(allButton).toHaveClass('bg-gray-100');
      expect(allButton).not.toHaveClass('bg-blue-600');
    });
  });

  describe('날짜 선택', () => {
    it('오늘 버튼 클릭 시 onDateSelect 호출', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      fireEvent.click(todayButton);

      expect(mockOnDateSelect).toHaveBeenCalled();
      const calledDate = mockOnDateSelect.mock.calls[0][0];
      expect(calledDate).toBeInstanceOf(Date);
    });

    it('어제 버튼 클릭 시 onDateSelect 호출', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const yesterdayButton = screen.getByRole('button', { name: '어제' });
      fireEvent.click(yesterdayButton);

      expect(mockOnDateSelect).toHaveBeenCalled();
      const calledDate = mockOnDateSelect.mock.calls[0][0];
      expect(calledDate).toBeInstanceOf(Date);
    });

    it('선택된 날짜가 활성 스타일로 표시됨', () => {
      const today = new Date();
      render(<DateSlider selectedDate={today} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      expect(todayButton).toHaveClass('bg-blue-600');
    });

    it('선택되지 않은 오늘은 bg-blue-500 스타일', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      expect(todayButton).toHaveClass('bg-blue-500');
    });
  });

  describe('오늘/어제 라벨', () => {
    it('오늘 날짜는 "오늘" 라벨로 표시', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      expect(todayButton).toHaveTextContent('오늘');
    });

    it('어제 날짜는 "어제" 라벨로 표시', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const yesterdayButton = screen.getByRole('button', { name: '어제' });
      expect(yesterdayButton).toHaveTextContent('어제');
    });

    it('오늘/어제가 아닌 날짜는 M/D 형식으로 표시', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const buttons = screen.getAllByRole('button');
      const dateButtons = buttons.filter(btn => {
        const text = btn.textContent || '';
        return text !== '전체' && text !== '오늘' && text !== '어제';
      });

      // M/D 형식 검증
      dateButtons.forEach(btn => {
        const text = btn.textContent || '';
        expect(text).toMatch(/^\d{1,2}\/\d{1,2}$/);
      });
    });
  });

  describe('다크모드 스타일', () => {
    it('전체 버튼: 다크모드 클래스 적용', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const allButton = screen.getByRole('button', { name: '전체' });
      expect(allButton).toHaveClass('dark:bg-blue-700');
    });

    it('비활성 버튼: 다크모드 회색 클래스 적용', () => {
      const today = new Date();
      render(<DateSlider selectedDate={today} onDateSelect={mockOnDateSelect} />);

      const allButton = screen.getByRole('button', { name: '전체' });
      expect(allButton).toHaveClass('dark:bg-gray-700', 'dark:text-gray-300');
    });

    it('선택된 버튼: 다크모드 파란색 클래스 적용', () => {
      const today = new Date();
      render(<DateSlider selectedDate={today} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      expect(todayButton).toHaveClass('dark:bg-blue-700');
    });

    it.skip('컨테이너: 다크모드 스크롤바 클래스 적용', () => {
      const { container } = render(
        <DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />
      );

      const scrollContainer = container.querySelector('.scrollbar-thin');
      expect(scrollContainer).toHaveClass('dark:scrollbar-thumb-gray-600');
    });
  });

  describe('날짜 비교 로직', () => {
    it('같은 날짜를 선택으로 인식', () => {
      const today = new Date();
      render(<DateSlider selectedDate={today} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      expect(todayButton).toHaveClass('bg-blue-600');
    });

    it('다른 날짜는 선택으로 인식하지 않음', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      render(<DateSlider selectedDate={yesterday} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      expect(todayButton).not.toHaveClass('bg-blue-600');
      expect(todayButton).toHaveClass('bg-blue-500');
    });
  });

  describe('접근성', () => {
    it.skip('모든 날짜 버튼에 aria-label 속성 존재', () => {
      const { container } = render(
        <DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />
      );

      const buttons = container.querySelectorAll('button[aria-label]');
      // 전체 버튼은 aria-label이 없으므로 16개 (날짜 버튼만)
      expect(buttons.length).toBe(16);
    });

    it('오늘 버튼의 aria-label이 "오늘"', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const todayButton = screen.getByRole('button', { name: '오늘' });
      expect(todayButton).toHaveAttribute('aria-label', '오늘');
    });

    it('어제 버튼의 aria-label이 "어제"', () => {
      render(<DateSlider selectedDate={null} onDateSelect={mockOnDateSelect} />);

      const yesterdayButton = screen.getByRole('button', { name: '어제' });
      expect(yesterdayButton).toHaveAttribute('aria-label', '어제');
    });
  });
});
