import React from 'react';
import { TournamentConfig } from '../../types/jobPosting/jobPosting';

interface TournamentStatusBadgeProps {
  tournamentConfig: TournamentConfig;
  className?: string;
}

/**
 * 대회 공고 승인 상태 배지 컴포넌트
 * pending, approved, rejected 상태를 시각적으로 표시
 */
export const TournamentStatusBadge: React.FC<TournamentStatusBadgeProps> = ({
  tournamentConfig,
  className = ''
}) => {
  const { approvalStatus } = tournamentConfig;

  const statusConfig = {
    pending: {
      label: '승인 대기',
      emoji: '⏳',
      bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
      textClass: 'text-yellow-800 dark:text-yellow-300',
      borderClass: 'border-yellow-200 dark:border-yellow-700'
    },
    approved: {
      label: '승인 완료',
      emoji: '✅',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      textClass: 'text-green-800 dark:text-green-300',
      borderClass: 'border-green-200 dark:border-green-700'
    },
    rejected: {
      label: '승인 거부',
      emoji: '❌',
      bgClass: 'bg-red-100 dark:bg-red-900/30',
      textClass: 'text-red-800 dark:text-red-300',
      borderClass: 'border-red-200 dark:border-red-700'
    }
  };

  const config = statusConfig[approvalStatus];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass} ${className}`}
    >
      <span className="mr-1">{config.emoji}</span>
      {config.label}
    </span>
  );
};
