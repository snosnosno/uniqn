import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FixedPostingBadge } from '../../../../components/jobPosting/FixedPostingBadge';
import { Timestamp } from 'firebase/firestore';

/**
 * FixedPostingBadge 컴포넌트 단위 테스트
 * - 만료일 계산 및 표시 테스트
 * - 만료 임박 상태 테스트 (D-3 이하)
 * - 만료됨 상태 테스트
 * - 다크모드 스타일 테스트
 */

describe('FixedPostingBadge', () => {
  const createDateFromDays = (daysFromNow: number): Date => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date;
  };

  describe('정상 상태 (D-4 이상)', () => {
    it('D-7 배지를 정상 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(7);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-7/)).toBeInTheDocument();
      expect(screen.getByText(/📅/)).toBeInTheDocument();
    });

    it('D-30 배지를 정상 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(30);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-30/)).toBeInTheDocument();
    });

    it('D-90 배지를 정상 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(90);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-90/)).toBeInTheDocument();
    });

    it.skip('파란색 배경 스타일 적용 확인', () => {
      const expiresAt = createDateFromDays(10);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      const badge = container.querySelector('.bg-blue-50.dark\\:bg-blue-900\\/30');
      expect(badge).toBeInTheDocument();
    });

    it('날짜 형식이 포함됨 (YYYY-MM-DD)', () => {
      const expiresAt = createDateFromDays(10);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      // 날짜 형식 패턴 확인 (2025-01-15 형식)
      const datePattern = /\d{4}-\d{2}-\d{2}/;
      expect(container.textContent).toMatch(datePattern);
    });
  });

  describe('만료 임박 상태 (D-3 이하)', () => {
    it('D-3 배지를 경고 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(3);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-3/)).toBeInTheDocument();
      expect(screen.getByText(/⚠️/)).toBeInTheDocument();
    });

    it('D-2 배지를 경고 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(2);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-2/)).toBeInTheDocument();
    });

    it('D-1 배지를 경고 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(1);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-1/)).toBeInTheDocument();
    });

    it('D-0 (오늘) 배지를 경고 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(0);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-0/)).toBeInTheDocument();
    });

    it.skip('빨간색 배경 스타일 적용 확인', () => {
      const expiresAt = createDateFromDays(2);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      const badge = container.querySelector('.bg-red-50.dark\\:bg-red-900\\/30');
      expect(badge).toBeInTheDocument();
    });

    it.skip('animate-pulse 클래스가 적용됨', () => {
      const expiresAt = createDateFromDays(1);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      const text = container.querySelector('.animate-pulse');
      expect(text).toBeInTheDocument();
    });
  });

  describe('만료됨 상태', () => {
    it('만료된 배지를 회색 스타일로 렌더링', () => {
      const expiresAt = createDateFromDays(-1);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/만료됨/)).toBeInTheDocument();
      expect(screen.getByText(/⏱️/)).toBeInTheDocument();
    });

    it('D-N 형식이 아닌 "만료됨" 텍스트 표시', () => {
      const expiresAt = createDateFromDays(-5);
      render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.queryByText(/D-/)).not.toBeInTheDocument();
      expect(screen.getByText(/만료됨/)).toBeInTheDocument();
    });

    it.skip('회색 배경 스타일 적용 확인', () => {
      const expiresAt = createDateFromDays(-3);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      const badge = container.querySelector('.bg-gray-100.dark\\:bg-gray-700');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Timestamp 타입 지원', () => {
    it('Firebase Timestamp를 Date로 변환하여 렌더링', () => {
      const futureDate = createDateFromDays(10);
      const timestamp = Timestamp.fromDate(futureDate);

      render(<FixedPostingBadge expiresAt={timestamp} />);

      expect(screen.getByText(/D-10/)).toBeInTheDocument();
    });

    it('Timestamp로 만료 임박 배지 렌더링', () => {
      const soonDate = createDateFromDays(2);
      const timestamp = Timestamp.fromDate(soonDate);

      render(<FixedPostingBadge expiresAt={timestamp} />);

      expect(screen.getByText(/D-2/)).toBeInTheDocument();
      expect(screen.getByText(/⚠️/)).toBeInTheDocument();
    });

    it('Timestamp로 만료됨 배지 렌더링', () => {
      const expiredDate = createDateFromDays(-1);
      const timestamp = Timestamp.fromDate(expiredDate);

      render(<FixedPostingBadge expiresAt={timestamp} />);

      expect(screen.getByText(/만료됨/)).toBeInTheDocument();
    });
  });

  describe('다크모드 스타일', () => {
    it.skip('정상 상태: 다크모드 파란색 클래스 적용', () => {
      const expiresAt = createDateFromDays(10);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      const badge = container.querySelector('.dark\\:bg-blue-900\\/30');
      expect(badge).toBeInTheDocument();

      const text = container.querySelector('.dark\\:text-blue-400');
      expect(text).toBeInTheDocument();
    });

    it.skip('만료 임박: 다크모드 빨간색 클래스 적용', () => {
      const expiresAt = createDateFromDays(2);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      const badge = container.querySelector('.dark\\:bg-red-900\\/30');
      expect(badge).toBeInTheDocument();

      const text = container.querySelector('.dark\\:text-red-400');
      expect(text).toBeInTheDocument();
    });

    it.skip('만료됨: 다크모드 회색 클래스 적용', () => {
      const expiresAt = createDateFromDays(-1);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      const badge = container.querySelector('.dark\\:bg-gray-700');
      expect(badge).toBeInTheDocument();

      const text = container.querySelector('.dark\\:text-gray-400');
      expect(text).toBeInTheDocument();
    });
  });

  describe('커스텀 className', () => {
    it.skip('커스텀 className이 적용됨', () => {
      const expiresAt = createDateFromDays(10);
      const { container } = render(
        <FixedPostingBadge expiresAt={expiresAt} className="custom-class" />
      );

      const badge = container.querySelector('.custom-class');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('경계값 테스트', () => {
    it.skip('D-4는 정상 상태 (파란색)', () => {
      const expiresAt = createDateFromDays(4);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-4/)).toBeInTheDocument();
      expect(container.querySelector('.bg-blue-50')).toBeInTheDocument();
    });

    it.skip('D-3는 만료 임박 상태 (빨간색)', () => {
      const expiresAt = createDateFromDays(3);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-3/)).toBeInTheDocument();
      expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    });

    it.skip('D-0는 만료 임박 상태 (빨간색)', () => {
      const expiresAt = createDateFromDays(0);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/D-0/)).toBeInTheDocument();
      expect(container.querySelector('.bg-red-50')).toBeInTheDocument();
    });

    it.skip('D-(-1)은 만료됨 상태 (회색)', () => {
      const expiresAt = createDateFromDays(-1);
      const { container } = render(<FixedPostingBadge expiresAt={expiresAt} />);

      expect(screen.getByText(/만료됨/)).toBeInTheDocument();
      expect(container.querySelector('.bg-gray-100')).toBeInTheDocument();
    });
  });
});
