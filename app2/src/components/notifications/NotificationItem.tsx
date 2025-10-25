/**
 * 알림 아이템 컴포넌트
 *
 * @description
 * 개별 알림을 표시하는 컴포넌트
 *
 * @version 1.0.0
 * @since 2025-10-02
 */

import React, { memo, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { Notification } from '../../types';
import { getNotificationTypeConfig, getNotificationRoute } from '../../config/notificationConfig';

export interface NotificationItemProps {
  /** 알림 데이터 */
  notification: Notification;
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 읽음 처리 핸들러 */
  onMarkAsRead?: (id: string) => void;
  /** 삭제 핸들러 */
  onDelete?: (id: string) => void;
  /** 간소화 버전 (드롭다운용) */
  compact?: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 알림 아이템
 *
 * @example
 * ```tsx
 * <NotificationItem
 *   notification={notification}
 *   onMarkAsRead={markAsRead}
 *   onDelete={deleteNotification}
 * />
 * ```
 */
export const NotificationItem = memo<NotificationItemProps>(({
  notification,
  onClick,
  onMarkAsRead,
  onDelete,
  compact = false,
  className = '',
}) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const config = getNotificationTypeConfig(notification.type);

  /**
   * 알림 클릭 핸들러
   */
  const handleClick = useCallback(() => {
    // 읽지 않은 알림이면 읽음 처리
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    // 커스텀 클릭 핸들러 실행
    if (onClick) {
      onClick();
      return;
    }

    // notificationConfig.ts의 route 함수를 우선 사용
    const route = getNotificationRoute(
      notification.type,
      notification.relatedId,
      notification.data
    );
    navigate(route);
  }, [notification, onClick, onMarkAsRead, navigate]);

  /**
   * 읽음 버튼 클릭
   */
  const handleMarkAsRead = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  }, [notification.id, onMarkAsRead]);

  /**
   * 삭제 버튼 클릭
   */
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(notification.id);
    }
  }, [notification.id, onDelete]);

  // 제거된 알림 타입 처리 (Firestore에 남아있는 데이터 대응)
  if (!config) {
    return null;
  }

  /**
   * 상대 시간 표시
   */
  const getRelativeTime = () => {
    const createdAt = notification.createdAt instanceof Date
      ? notification.createdAt
      : notification.createdAt.toDate();

    const options = {
      addSuffix: true,
      ...(i18n.language === 'ko' && { locale: ko }),
    };

    return formatDistanceToNow(createdAt, options);
  };

  // 읽지 않은 알림 스타일
  const unreadStyles = notification.isRead
    ? 'bg-white dark:bg-gray-800'
    : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-600';

  // 간소화 버전 (드롭다운용)
  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${unreadStyles} ${className}`}
      >
        <div className="flex items-start gap-3">
          {/* 아이콘 */}
          <span className="text-xl flex-shrink-0">{config.icon}</span>

          {/* 내용 */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${notification.isRead ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-gray-100'}`}>
              {notification.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {notification.body}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {getRelativeTime()}
            </p>
          </div>

          {/* 읽지 않음 표시 */}
          {!notification.isRead && (
            <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0 mt-1" />
          )}
        </div>
      </div>
    );
  }

  // 전체 버전
  return (
    <div
      onClick={handleClick}
      className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:shadow-md transition-all ${unreadStyles} ${className}`}
    >
      <div className="flex items-start gap-4">
        {/* 아이콘 */}
        <div className="flex-shrink-0">
          <span className="text-2xl">{config.icon}</span>
        </div>

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`text-sm ${notification.isRead ? 'text-gray-700 dark:text-gray-300' : 'font-bold text-gray-900 dark:text-gray-100'}`}>
              {notification.title}
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              {getRelativeTime()}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {notification.body}
          </p>

          {/* 액션 버튼 */}
          {!compact && (
            <div className="flex items-center gap-2 mt-3">
              {!notification.isRead && onMarkAsRead && (
                <button
                  onClick={handleMarkAsRead}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  읽음
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 font-medium"
                >
                  삭제
                </button>
              )}
            </div>
          )}
        </div>

        {/* 읽지 않음 표시 */}
        {!notification.isRead && (
          <span className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0 mt-1" />
        )}
      </div>
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

export default NotificationItem;
