import React from 'react';
import { render, screen } from '@testing-library/react';
import { TournamentStatusBadge } from '@/components/jobPosting/TournamentStatusBadge';
import { TournamentConfig } from '@/types/jobPosting/jobPosting';
import { Timestamp } from 'firebase/firestore';

describe('TournamentStatusBadge', () => {
  const now = Timestamp.now();

  describe('승인 대기 (pending)', () => {
    it('승인 대기 배지를 렌더링', () => {
      const config: TournamentConfig = {
        approvalStatus: 'pending',
        submittedAt: now,
      };

      render(<TournamentStatusBadge tournamentConfig={config} />);

      expect(screen.getByText(/승인 대기/i)).toBeInTheDocument();
      expect(screen.getByText(/⏳/)).toBeInTheDocument();
    });

    it.skip('노란색 스타일 적용 확인', () => {
      const config: TournamentConfig = {
        approvalStatus: 'pending',
        submittedAt: now,
      };

      const { container } = render(<TournamentStatusBadge tournamentConfig={config} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('bg-yellow-100');
      expect(badge).toHaveClass('text-yellow-800');
    });
  });

  describe('승인 완료 (approved)', () => {
    it('승인 완료 배지를 렌더링', () => {
      const config: TournamentConfig = {
        approvalStatus: 'approved',
        submittedAt: now,
        approvedBy: 'admin123',
        approvedAt: now,
      };

      render(<TournamentStatusBadge tournamentConfig={config} />);

      expect(screen.getByText(/승인 완료/i)).toBeInTheDocument();
      expect(screen.getByText(/✅/)).toBeInTheDocument();
    });

    it.skip('녹색 스타일 적용 확인', () => {
      const config: TournamentConfig = {
        approvalStatus: 'approved',
        submittedAt: now,
        approvedBy: 'admin123',
        approvedAt: now,
      };

      const { container } = render(<TournamentStatusBadge tournamentConfig={config} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });
  });

  describe('승인 거부 (rejected)', () => {
    it('승인 거부 배지를 렌더링', () => {
      const config: TournamentConfig = {
        approvalStatus: 'rejected',
        submittedAt: now,
        rejectedBy: 'admin123',
        rejectedAt: now,
        rejectionReason: '정보가 부족합니다',
      };

      render(<TournamentStatusBadge tournamentConfig={config} />);

      expect(screen.getByText(/승인 거부/i)).toBeInTheDocument();
      expect(screen.getByText(/❌/)).toBeInTheDocument();
    });

    it.skip('빨간색 스타일 적용 확인', () => {
      const config: TournamentConfig = {
        approvalStatus: 'rejected',
        submittedAt: now,
        rejectedBy: 'admin123',
        rejectedAt: now,
        rejectionReason: '정보가 부족합니다',
      };

      const { container } = render(<TournamentStatusBadge tournamentConfig={config} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
    });
  });

  describe('커스텀 className', () => {
    it.skip('커스텀 className 추가 가능', () => {
      const config: TournamentConfig = {
        approvalStatus: 'pending',
        submittedAt: now,
      };

      const { container } = render(
        <TournamentStatusBadge tournamentConfig={config} className="custom-class" />
      );
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('다크모드 클래스', () => {
    it.skip('pending 상태에 다크모드 클래스 포함', () => {
      const config: TournamentConfig = {
        approvalStatus: 'pending',
        submittedAt: now,
      };

      const { container } = render(<TournamentStatusBadge tournamentConfig={config} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('dark:bg-yellow-900/30');
      expect(badge).toHaveClass('dark:text-yellow-300');
    });

    it.skip('approved 상태에 다크모드 클래스 포함', () => {
      const config: TournamentConfig = {
        approvalStatus: 'approved',
        submittedAt: now,
        approvedBy: 'admin',
        approvedAt: now,
      };

      const { container } = render(<TournamentStatusBadge tournamentConfig={config} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('dark:bg-green-900/30');
      expect(badge).toHaveClass('dark:text-green-300');
    });

    it.skip('rejected 상태에 다크모드 클래스 포함', () => {
      const config: TournamentConfig = {
        approvalStatus: 'rejected',
        submittedAt: now,
        rejectedBy: 'admin',
        rejectedAt: now,
        rejectionReason: '테스트 사유',
      };

      const { container } = render(<TournamentStatusBadge tournamentConfig={config} />);
      const badge = container.querySelector('span');

      expect(badge).toHaveClass('dark:bg-red-900/30');
      expect(badge).toHaveClass('dark:text-red-300');
    });
  });
});
