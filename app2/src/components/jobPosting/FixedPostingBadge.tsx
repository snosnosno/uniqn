/**
 * @file FixedPostingBadge.tsx
 * @description 고정 공고 만료일 표시 컴포넌트
 *
 * 기능:
 * - 만료일 계산 및 표시 (D-N 형식)
 * - 만료 임박 시 빨간색 강조 (D-3 이하)
 * - 다크모드 지원
 */

import React, { useMemo } from 'react';
import { differenceInDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

interface FixedPostingBadgeProps {
  expiresAt: Timestamp | Date;
  className?: string;
}

/**
 * 고정 공고 만료일 배지 컴포넌트
 *
 * @param expiresAt - 만료 일시 (Timestamp 또는 Date)
 * @param className - 추가 CSS 클래스
 */
export const FixedPostingBadge: React.FC<FixedPostingBadgeProps> = ({
  expiresAt,
  className = '',
}) => {
  const { daysLeft, isExpiringSoon, isExpired, formattedDate } = useMemo(() => {
    const now = new Date();
    const expiryDate = expiresAt instanceof Timestamp ? expiresAt.toDate() : expiresAt;
    const daysLeft = differenceInDays(expiryDate, now);
    const isExpiringSoon = daysLeft <= 3 && daysLeft >= 0;
    const isExpired = daysLeft < 0;
    const formattedDate = format(expiryDate, 'yyyy-MM-dd (EEE)', { locale: ko });

    return {
      daysLeft,
      isExpiringSoon,
      isExpired,
      formattedDate,
    };
  }, [expiresAt]);

  // 만료됨
  if (isExpired) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 ${className}`}
      >
        <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">⏱️ 만료됨</span>
      </div>
    );
  }

  // 만료 임박 (D-3 이하)
  if (isExpiringSoon) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 ${className}`}
      >
        <span className="text-red-700 dark:text-red-400 text-xs font-bold animate-pulse">
          ⚠️ D-{daysLeft}
        </span>
        <span className="text-red-600 dark:text-red-400 text-xs">({formattedDate})</span>
      </div>
    );
  }

  // 정상 (D-4 이상)
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 ${className}`}
    >
      <span className="text-blue-700 dark:text-blue-400 text-xs font-medium">📅 D-{daysLeft}</span>
      <span className="text-blue-600 dark:text-blue-400 text-xs">({formattedDate})</span>
    </div>
  );
};

export default FixedPostingBadge;
