/**
 * 알림 드롭다운 컴포넌트
 *
 * @description
 * 헤더에 표시되는 알림 드롭다운
 *
 * @version 1.0.0
 * @since 2025-10-02
 */

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaBell, FaCog } from '../Icons/ReactIconsReplacement';

import { useNotifications } from '../../hooks/useNotifications';
import NotificationBadge from './NotificationBadge';
import NotificationItem from './NotificationItem';

export interface NotificationDropdownProps {
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 알림 드롭다운
 *
 * @example
 * ```tsx
 * <NotificationDropdown />
 * ```
 */
export const NotificationDropdown = memo<NotificationDropdownProps>(({ className = '' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /**
   * 드롭다운 토글
   */
  const toggleDropdown = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  /**
   * 드롭다운 닫기
   */
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  /**
   * 모두 보기 클릭
   */
  const handleViewAll = useCallback(() => {
    closeDropdown();
    navigate('/app/notifications');
  }, [navigate, closeDropdown]);

  /**
   * 설정 페이지로 이동
   */
  const handleSettings = useCallback(() => {
    closeDropdown();
    navigate('/app/notification-settings');
  }, [navigate, closeDropdown]);

  // 알림 아이템 클릭 시 자동으로 페이지 이동되므로 별도 핸들러 불필요
  // NotificationItem의 기본 라우팅 로직 사용

  /**
   * 외부 클릭 감지
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  /**
   * ESC 키로 닫기
   */
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeDropdown]);

  // 최근 5개 알림만 표시
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 알림 버튼 */}
      <button
        onClick={toggleDropdown}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={t('notifications.title', '알림')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <FaBell className="w-5 h-5 text-gray-700" />
        <NotificationBadge count={unreadCount} />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <>
          {/* 오버레이 (모바일용) */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={closeDropdown}
          />

          {/* 드롭다운 컨테이너 */}
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[80vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {t('notifications.title', '알림')}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {t('notifications.markAllAsRead', '모두 읽음')}
                  </button>
                )}
                <button
                  onClick={handleSettings}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={t('notifications.settings.title', '알림 설정')}
                  title={t('notifications.settings.title', '알림 설정')}
                >
                  <FaCog className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 알림 목록 */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  {t('notifications.loading', '로딩 중...')}
                </div>
              ) : recentNotifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {t('notifications.noNotifications', '알림이 없습니다')}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {recentNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 - 항상 알림센터 버튼 표시 */}
            <div className="p-3 border-t border-gray-200">
              <button
                onClick={handleViewAll}
                className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('notifications.notificationCenter', '알림센터')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

NotificationDropdown.displayName = 'NotificationDropdown';

export default NotificationDropdown;
