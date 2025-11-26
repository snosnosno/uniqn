/**
 * 알림 배지 컴포넌트
 *
 * @description
 * 읽지 않은 알림 개수를 표시하는 배지
 *
 * @version 1.0.0
 * @since 2025-10-02
 */

import React, { memo } from 'react';

export interface NotificationBadgeProps {
  /** 알림 개수 */
  count: number;
  /** 최대 표시 개수 (기본값: 99) */
  max?: number;
  /** 배지 스타일 */
  variant?: 'dot' | 'count';
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 알림 배지
 *
 * @example
 * ```tsx
 * <NotificationBadge count={5} />
 * <NotificationBadge count={100} max={99} />
 * <NotificationBadge count={3} variant="dot" />
 * ```
 */
export const NotificationBadge = memo<NotificationBadgeProps>(
  ({ count, max = 99, variant = 'count', className = '' }) => {
    // 알림이 없으면 배지를 표시하지 않음
    if (count <= 0) {
      return null;
    }

    // dot 스타일
    if (variant === 'dot') {
      return (
        <span
          className={`absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800 ${className}`}
          aria-label={`${count}개의 읽지 않은 알림`}
        />
      );
    }

    // count 스타일
    const displayCount = count > max ? `${max}+` : count.toString();

    return (
      <span
        className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800 ${className}`}
        aria-label={`${count}개의 읽지 않은 알림`}
      >
        {displayCount}
      </span>
    );
  }
);

NotificationBadge.displayName = 'NotificationBadge';

export default NotificationBadge;
