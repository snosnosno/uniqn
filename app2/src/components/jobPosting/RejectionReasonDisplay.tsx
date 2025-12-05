import React, { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { TournamentConfig } from '../../types/jobPosting/jobPosting';

interface RejectionReasonDisplayProps {
  tournamentConfig: TournamentConfig;
  className?: string;
  /** 접기/펼치기 기능 활성화 (기본값: false) */
  collapsible?: boolean;
  /** 초기 펼침 상태 (기본값: true) */
  defaultExpanded?: boolean;
}

/**
 * 대회 공고 거부 사유 표시 컴포넌트
 * rejected 상태일 때만 거부 사유와 거부 일시를 표시
 */
export const RejectionReasonDisplay: React.FC<RejectionReasonDisplayProps> = ({
  tournamentConfig,
  className = '',
  collapsible = false,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // rejected 상태가 아니면 렌더링하지 않음
  if (tournamentConfig.approvalStatus !== 'rejected') {
    return null;
  }

  const { rejectionReason, rejectedAt, rejectedBy } = tournamentConfig;

  // 거부 사유가 없으면 렌더링하지 않음
  if (!rejectionReason) {
    return null;
  }

  const formattedDate = rejectedAt
    ? format(rejectedAt.toDate(), 'yyyy.MM.dd HH:mm', { locale: ko })
    : null;

  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={`mt-2 p-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 ${className}`}
    >
      {/* 헤더 */}
      <div
        className={`flex items-center justify-between ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={toggleExpanded}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleExpanded();
                }
              }
            : undefined
        }
      >
        <div className="flex items-center gap-1.5">
          <span className="text-red-600 dark:text-red-400 text-sm font-medium">거부 사유</span>
          {formattedDate && (
            <span className="text-red-500 dark:text-red-500 text-xs">({formattedDate})</span>
          )}
        </div>
        {collapsible && (
          <button
            type="button"
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            aria-label={isExpanded ? '접기' : '펼치기'}
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* 거부 사유 본문 */}
      {isExpanded && (
        <div className="mt-2">
          <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
            {rejectionReason}
          </p>
          {rejectedBy && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">처리자 ID: {rejectedBy}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RejectionReasonDisplay;
