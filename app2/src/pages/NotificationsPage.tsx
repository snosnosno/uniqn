/**
 * 알림 센터 페이지
 *
 * @description
 * 모든 알림을 관리하는 전체 페이지
 *
 * @version 1.0.0
 * @since 2025-10-02
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useNotifications } from '../hooks/useNotifications';
import NotificationItem from '../components/notifications/NotificationItem';
import LoadingSpinner from '../components/LoadingSpinner';
import type { NotificationCategory } from '../types';

type TabType = 'all' | 'unread' | 'read';

/**
 * 알림 센터 페이지
 */
const NotificationsPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    stats,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotifications();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'all'>('all');

  /**
   * 탭별 필터링된 알림
   */
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // 탭 필터링
    if (activeTab === 'unread') {
      filtered = filtered.filter(n => !n.isRead);
    } else if (activeTab === 'read') {
      filtered = filtered.filter(n => n.isRead);
    }

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(n => n.category === selectedCategory);
    }

    return filtered;
  }, [notifications, activeTab, selectedCategory]);

  /**
   * 로딩 상태
   */
  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('notifications.title', '알림')}
            </h1>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                {t('notifications.markAllAsRead', '모두 읽음')}
              </button>
            )}
          </div>

          {/* 탭 */}
          <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === 'all'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('notifications.filters.all', '전체')} ({stats.total})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === 'unread'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('notifications.filters.unread', '안읽음')} ({stats.unread})
            </button>
            <button
              onClick={() => setActiveTab('read')}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === 'read'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('notifications.filters.read', '읽음')} ({stats.total - stats.unread})
            </button>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 카테고리 필터 */}
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 dark:bg-blue-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              전체
            </button>
            {(['system', 'work', 'schedule', 'finance'] as NotificationCategory[]).map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t(`notifications.categories.${category}`, category)}
                {stats.byCategory[category] ? ` (${stats.byCategory[category]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* 알림 목록 */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-300">
              {t('notifications.noNotifications', '알림이 없습니다')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))}
          </div>
        )}

        {/* 하단 액션 */}
        {activeTab === 'read' && filteredNotifications.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={deleteAllRead}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              {t('notifications.deleteAllRead', '읽은 알림 모두 삭제')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
