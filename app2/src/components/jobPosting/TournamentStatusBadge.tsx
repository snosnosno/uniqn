import React, { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { TournamentConfig } from '../../types/jobPosting/jobPosting';

interface TournamentStatusBadgeProps {
  tournamentConfig: TournamentConfig;
  className?: string;
  /** 거부 시 사유를 툴팁으로 표시 (기본값: false) */
  showRejectionReason?: boolean;
}

/**
 * 대회 공고 승인 상태 배지 컴포넌트
 * pending, approved, rejected 상태를 시각적으로 표시
 * rejected 상태일 때 showRejectionReason이 true이면 호버 시 거부 사유 툴팁 표시
 */
export const TournamentStatusBadge: React.FC<TournamentStatusBadgeProps> = ({
  tournamentConfig,
  className = '',
  showRejectionReason = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const { approvalStatus, rejectionReason, rejectedAt } = tournamentConfig;

  const statusConfig = {
    pending: {
      label: '승인 대기',
      emoji: '⏳',
      bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
      textClass: 'text-yellow-800 dark:text-yellow-300',
      borderClass: 'border-yellow-200 dark:border-yellow-700',
    },
    approved: {
      label: '승인 완료',
      emoji: '✅',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      textClass: 'text-green-800 dark:text-green-300',
      borderClass: 'border-green-200 dark:border-green-700',
    },
    rejected: {
      label: '승인 거부',
      emoji: '❌',
      bgClass: 'bg-red-100 dark:bg-red-900/30',
      textClass: 'text-red-800 dark:text-red-300',
      borderClass: 'border-red-200 dark:border-red-700',
    },
  };

  const config = statusConfig[approvalStatus];

  const shouldShowTooltip = showRejectionReason && approvalStatus === 'rejected' && rejectionReason;

  const formattedDate = rejectedAt
    ? format(rejectedAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko })
    : null;

  return (
    <div className="relative inline-block">
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bgClass} ${config.textClass} ${config.borderClass} ${shouldShowTooltip ? 'cursor-pointer' : ''} ${className}`}
        onMouseEnter={() => shouldShowTooltip && setShowTooltip(true)}
        onMouseLeave={() => shouldShowTooltip && setShowTooltip(false)}
        onClick={() => shouldShowTooltip && setShowTooltip(!showTooltip)}
      >
        <span className="mr-1">{config.emoji}</span>
        {config.label}
      </span>

      {/* 거부 사유 툴팁 */}
      {showTooltip && shouldShowTooltip && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 p-3 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-red-600 dark:text-red-400 text-xs font-medium">거부 사유</span>
            {formattedDate && (
              <span className="text-gray-500 dark:text-gray-400 text-xs">({formattedDate})</span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {rejectionReason}
          </p>
        </div>
      )}
    </div>
  );
};
