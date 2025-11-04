import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import JobPostingCard from '../../../../components/common/JobPostingCard';
import { JobPosting } from '../../../../types/jobPosting';
import { Timestamp } from 'firebase/firestore';

// React i18next 모킹
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'ko' }
  })
}));

// Firebase 모킹
jest.mock('../../../../firebase', () => ({
  db: {}
}));

// Firestore 함수 모킹
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  getDoc: jest.fn(),
  doc: jest.fn()
}));

/**
 * JobPostingCard 컴포넌트 단위 테스트
 * - 기본 렌더링 테스트 (regular/fixed/tournament/urgent 타입)
 * - 타입별 아이콘 및 스타일 테스트
 * - 상태 배지 테스트 (open/closed)
 * - 칩 비용 표시 테스트
 * - 다크모드 스타일 테스트
 */

describe('JobPostingCard', () => {
  const basePosting: JobPosting = {
    id: 'test-1',
    title: '테스트 공고',
    description: '테스트 설명',
    location: '서울',
    district: '강남구',
    status: 'open',
    createdBy: 'user-1',
    postingType: 'regular',
    dateSpecificRequirements: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    isChipDeducted: false
  };

  describe('기본 렌더링', () => {
    it('제목이 렌더링됨', () => {
      render(<JobPostingCard post={basePosting} variant="user-card" />);

      expect(screen.getByText('테스트 공고')).toBeInTheDocument();
    });

    it('위치 정보가 렌더링됨', () => {
      render(<JobPostingCard post={basePosting} variant="user-card" />);

      expect(screen.getByText(/서울/)).toBeInTheDocument();
      expect(screen.getByText(/강남구/)).toBeInTheDocument();
    });

    it('상태 배지가 렌더링됨', () => {
      render(<JobPostingCard post={basePosting} variant="user-card" showStatus={true} />);

      // status가 open이면 "모집중" 표시
      expect(screen.getByText(/모집중/)).toBeInTheDocument();
    });
  });

  describe('타입별 아이콘', () => {
    it('regular 타입: 📋 아이콘 렌더링', () => {
      const regularPosting = { ...basePosting, postingType: 'regular' as const };
      const { container } = render(<JobPostingCard post={regularPosting} variant="user-card" />);

      const icon = container.querySelector('[aria-label="regular"]');
      expect(icon).toHaveTextContent('📋');
    });

    it('fixed 타입: 📌 아이콘 렌더링', () => {
      const fixedPosting = { ...basePosting, postingType: 'fixed' as const };
      const { container } = render(<JobPostingCard post={fixedPosting} variant="user-card" />);

      const icon = container.querySelector('[aria-label="fixed"]');
      expect(icon).toHaveTextContent('📌');
    });

    it('tournament 타입: 🏆 아이콘 렌더링', () => {
      const tournamentPosting = { ...basePosting, postingType: 'tournament' as const };
      const { container } = render(<JobPostingCard post={tournamentPosting} variant="user-card" />);

      const icon = container.querySelector('[aria-label="tournament"]');
      expect(icon).toHaveTextContent('🏆');
    });

    it('urgent 타입: 🚨 아이콘 렌더링', () => {
      const urgentPosting = { ...basePosting, postingType: 'urgent' as const };
      const { container } = render(<JobPostingCard post={urgentPosting} variant="user-card" />);

      const icon = container.querySelector('[aria-label="urgent"]');
      expect(icon).toHaveTextContent('🚨');
    });
  });

  describe('타입별 스타일', () => {
    it('regular 타입: 회색 테두리', () => {
      const regularPosting = { ...basePosting, postingType: 'regular' as const };
      const { container } = render(<JobPostingCard post={regularPosting} variant="user-card" />);

      const card = container.querySelector('.border-gray-300');
      expect(card).toBeInTheDocument();
    });

    it('fixed 타입: 파란색 왼쪽 테두리', () => {
      const fixedPosting = { ...basePosting, postingType: 'fixed' as const };
      const { container } = render(<JobPostingCard post={fixedPosting} variant="user-card" />);

      const card = container.querySelector('.border-l-blue-500');
      expect(card).toBeInTheDocument();
    });

    it('tournament 타입: 보라색 왼쪽 테두리', () => {
      const tournamentPosting = { ...basePosting, postingType: 'tournament' as const };
      const { container } = render(<JobPostingCard post={tournamentPosting} variant="user-card" />);

      const card = container.querySelector('.border-l-purple-500');
      expect(card).toBeInTheDocument();
    });

    it('urgent 타입: 빨간색 깜빡이는 테두리', () => {
      const urgentPosting = { ...basePosting, postingType: 'urgent' as const };
      const { container } = render(<JobPostingCard post={urgentPosting} variant="user-card" />);

      const card = container.querySelector('.border-red-500.animate-pulse-border');
      expect(card).toBeInTheDocument();
    });
  });

  describe('긴급 공고 배지', () => {
    it('urgent 타입: 긴급 배지 렌더링', () => {
      const urgentPosting = { ...basePosting, postingType: 'urgent' as const };
      render(<JobPostingCard post={urgentPosting} variant="user-card" />);

      expect(screen.getByText('🚨')).toBeInTheDocument();
      expect(screen.getByText('긴급')).toBeInTheDocument();
    });

    it('urgent 타입: 배지에 animate-pulse 클래스 적용', () => {
      const urgentPosting = { ...basePosting, postingType: 'urgent' as const };
      const { container } = render(<JobPostingCard post={urgentPosting} variant="user-card" />);

      const badge = container.querySelector('.animate-pulse');
      expect(badge).toBeInTheDocument();
    });

    it('regular 타입: 긴급 배지 없음', () => {
      const regularPosting = { ...basePosting, postingType: 'regular' as const };
      render(<JobPostingCard post={regularPosting} variant="user-card" />);

      expect(screen.queryByText('긴급')).not.toBeInTheDocument();
    });
  });

  describe('상태 배지', () => {
    it('open 상태: 녹색 배지 렌더링', () => {
      const openPosting = { ...basePosting, status: 'open' as const };
      const { container } = render(
        <JobPostingCard post={openPosting} variant="user-card" showStatus={true} />
      );

      const badge = container.querySelector('.bg-green-100');
      expect(badge).toBeInTheDocument();
    });

    it('closed 상태: 빨간색 배지 렌더링', () => {
      const closedPosting = { ...basePosting, status: 'closed' as const };
      const { container } = render(
        <JobPostingCard post={closedPosting} variant="user-card" showStatus={true} />
      );

      const badge = container.querySelector('.bg-red-100');
      expect(badge).toBeInTheDocument();
    });

    it('showStatus=false: 상태 배지 없음', () => {
      render(<JobPostingCard post={basePosting} variant="user-card" showStatus={false} />);

      expect(screen.queryByText(/모집중/)).not.toBeInTheDocument();
    });
  });

  describe('칩 비용 배지', () => {
    it('chipCost > 0: 칩 비용 배지 렌더링', () => {
      const postingWithChip = { ...basePosting, chipCost: 5 };
      render(<JobPostingCard post={postingWithChip} variant="user-card" />);

      expect(screen.getByText(/💰/)).toBeInTheDocument();
      expect(screen.getByText(/5 칩/)).toBeInTheDocument();
    });

    it('chipCost = 0: 칩 비용 배지 없음', () => {
      const postingWithoutChip = { ...basePosting, chipCost: 0 };
      render(<JobPostingCard post={postingWithoutChip} variant="user-card" />);

      expect(screen.queryByText(/칩/)).not.toBeInTheDocument();
    });

    it('chipCost undefined: 칩 비용 배지 없음', () => {
      render(<JobPostingCard post={basePosting} variant="user-card" />);

      expect(screen.queryByText(/칩/)).not.toBeInTheDocument();
    });

    it('칩 비용 배지: 노란색 배경', () => {
      const postingWithChip = { ...basePosting, chipCost: 3 };
      const { container } = render(<JobPostingCard post={postingWithChip} variant="user-card" />);

      const badge = container.querySelector('.bg-yellow-100');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('다크모드 스타일', () => {
    it('카드 배경: 다크모드 클래스 적용', () => {
      const { container } = render(<JobPostingCard post={basePosting} variant="user-card" />);

      const card = container.querySelector('.dark\\:bg-gray-800');
      expect(card).toBeInTheDocument();
    });

    it('regular 타입: 다크모드 회색 테두리', () => {
      const regularPosting = { ...basePosting, postingType: 'regular' as const };
      const { container } = render(<JobPostingCard post={regularPosting} variant="user-card" />);

      const card = container.querySelector('.dark\\:border-gray-600');
      expect(card).toBeInTheDocument();
    });

    it('fixed 타입: 다크모드 파란색 테두리', () => {
      const fixedPosting = { ...basePosting, postingType: 'fixed' as const };
      const { container } = render(<JobPostingCard post={fixedPosting} variant="user-card" />);

      const card = container.querySelector('.dark\\:border-l-blue-400');
      expect(card).toBeInTheDocument();
    });

    it('tournament 타입: 다크모드 보라색 테두리', () => {
      const tournamentPosting = { ...basePosting, postingType: 'tournament' as const };
      const { container } = render(<JobPostingCard post={tournamentPosting} variant="user-card" />);

      const card = container.querySelector('.dark\\:border-l-purple-400');
      expect(card).toBeInTheDocument();
    });

    it('urgent 타입: 다크모드 빨간색 테두리', () => {
      const urgentPosting = { ...basePosting, postingType: 'urgent' as const };
      const { container } = render(<JobPostingCard post={urgentPosting} variant="user-card" />);

      const card = container.querySelector('.dark\\:border-red-400');
      expect(card).toBeInTheDocument();
    });

    it('긴급 배지: 다크모드 스타일 적용', () => {
      const urgentPosting = { ...basePosting, postingType: 'urgent' as const };
      const { container } = render(<JobPostingCard post={urgentPosting} variant="user-card" />);

      const badge = container.querySelector('.dark\\:bg-red-900\\/30');
      expect(badge).toBeInTheDocument();
    });

    it('칩 배지: 다크모드 스타일 적용', () => {
      const postingWithChip = { ...basePosting, chipCost: 5 };
      const { container } = render(<JobPostingCard post={postingWithChip} variant="user-card" />);

      const badge = container.querySelector('.dark\\:bg-yellow-900\\/30');
      expect(badge).toBeInTheDocument();
    });

    it('상태 배지: 다크모드 스타일 적용', () => {
      const { container } = render(
        <JobPostingCard post={basePosting} variant="user-card" showStatus={true} />
      );

      const badge = container.querySelector('.dark\\:bg-green-900\\/30');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('variant별 렌더링', () => {
    it('admin-list variant: hover 스타일 적용', () => {
      const { container } = render(<JobPostingCard post={basePosting} variant="admin-list" />);

      const card = container.querySelector('.hover\\:bg-gray-50');
      expect(card).toBeInTheDocument();
    });

    it('user-card variant: 오버플로우 히든', () => {
      const { container } = render(<JobPostingCard post={basePosting} variant="user-card" />);

      const card = container.querySelector('.overflow-hidden');
      expect(card).toBeInTheDocument();
    });

    it('detail-info variant: shadow-md 적용', () => {
      const { container } = render(<JobPostingCard post={basePosting} variant="detail-info" />);

      const card = container.querySelector('.shadow-md');
      expect(card).toBeInTheDocument();
    });
  });

  describe('문의 연락처', () => {
    it('contactPhone이 있으면 연락처 표시', () => {
      const postingWithPhone = { ...basePosting, contactPhone: '010-1234-5678' };
      render(<JobPostingCard post={postingWithPhone} variant="user-card" />);

      expect(screen.getByText(/010-1234-5678/)).toBeInTheDocument();
      expect(screen.getByText(/📞/)).toBeInTheDocument();
    });

    it('contactPhone이 없으면 연락처 미표시', () => {
      render(<JobPostingCard post={basePosting} variant="user-card" />);

      expect(screen.queryByText(/📞/)).not.toBeInTheDocument();
    });
  });

  describe('커스텀 className', () => {
    it('커스텀 className이 적용됨', () => {
      const { container } = render(
        <JobPostingCard post={basePosting} variant="user-card" className="custom-test-class" />
      );

      const card = container.querySelector('.custom-test-class');
      expect(card).toBeInTheDocument();
    });
  });
});
