/**
 * 공지사항 배너 컴포넌트
 *
 * @description
 * 로그인 후 메인 화면 상단에 표시되는 중요 공지사항 배너
 * - "오늘 하루 보지 않기" 기능
 * - 우선순위별 색상 구분
 * - 클릭 시 상세 보기
 * - 다크모드 지원
 * - 접근성 준수
 *
 * @version 1.0.0
 * @since 2025-12-10
 */

import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  MegaphoneIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { SystemAnnouncement } from '../../types';

interface AnnouncementBannerProps {
  /** 표시할 공지사항 */
  announcement: SystemAnnouncement;
  /** 닫기 핸들러 */
  onDismiss: () => void;
  /** "오늘 하루 보지 않기" 핸들러 */
  onHideForToday: () => void;
  /** 남은 배너 수 */
  remainingCount?: number;
}

/**
 * 우선순위별 배너 스타일
 */
const PRIORITY_STYLES = {
  urgent: {
    container: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    title: 'text-red-900 dark:text-red-100',
    content: 'text-red-700 dark:text-red-300',
    button: 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/50',
    badge: 'bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300',
  },
  important: {
    container: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    icon: 'text-orange-600 dark:text-orange-400',
    title: 'text-orange-900 dark:text-orange-100',
    content: 'text-orange-700 dark:text-orange-300',
    button: 'text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-800/50',
    badge: 'bg-orange-100 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300',
  },
  normal: {
    container: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
    content: 'text-blue-700 dark:text-blue-300',
    button: 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50',
    badge: 'bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300',
  },
};

/**
 * 우선순위별 아이콘
 */
const PriorityIcon: React.FC<{ priority: SystemAnnouncement['priority']; className?: string }> = ({
  priority,
  className,
}) => {
  switch (priority) {
    case 'urgent':
      return <ExclamationTriangleIcon className={className} />;
    case 'important':
      return <MegaphoneIcon className={className} />;
    default:
      return <InformationCircleIcon className={className} />;
  }
};

/**
 * 공지사항 배너 컴포넌트
 */
const AnnouncementBanner: React.FC<AnnouncementBannerProps> = memo(
  ({ announcement, onDismiss, onHideForToday, remainingCount = 0 }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const styles = PRIORITY_STYLES[announcement.priority];

    /**
     * 배너 클릭 시 공지사항 페이지로 이동
     */
    const handleClick = useCallback(() => {
      navigate('/app/announcements');
    }, [navigate]);

    /**
     * 닫기 버튼 클릭
     */
    const handleDismiss = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDismiss();
      },
      [onDismiss]
    );

    /**
     * "오늘 하루 보지 않기" 클릭
     */
    const handleHideForToday = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onHideForToday();
      },
      [onHideForToday]
    );

    return (
      <div
        role="banner"
        aria-label={t('announcements.bannerDisplay.label', '중요 공지사항')}
        className={`border-b ${styles.container}`}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* 아이콘 및 내용 */}
            <div
              role="button"
              tabIndex={0}
              onClick={handleClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleClick();
                }
              }}
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
            >
              {/* 아이콘 */}
              <div className="flex-shrink-0">
                <PriorityIcon
                  priority={announcement.priority}
                  className={`h-5 w-5 ${styles.icon}`}
                />
              </div>

              {/* 내용 */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${styles.title}`}>
                  {announcement.title}
                </p>
                <p className={`text-sm truncate ${styles.content}`}>
                  {announcement.content.slice(0, 100)}
                  {announcement.content.length > 100 && '...'}
                </p>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* 남은 배너 수 */}
              {remainingCount > 0 && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${styles.badge}`}>
                  +{remainingCount}
                </span>
              )}

              {/* "오늘 하루 보지 않기" 버튼 */}
              <button
                type="button"
                onClick={handleHideForToday}
                className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${styles.button}`}
                aria-label={t('announcements.bannerDisplay.hideForToday', '오늘 하루 보지 않기')}
              >
                {t('announcements.bannerDisplay.hideForTodayShort', '오늘 안 보기')}
              </button>

              {/* 닫기 버튼 */}
              <button
                type="button"
                onClick={handleDismiss}
                className={`flex-shrink-0 p-1 rounded-md transition-colors ${styles.button}`}
                aria-label={t('announcements.bannerDisplay.dismiss', '닫기')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

AnnouncementBanner.displayName = 'AnnouncementBanner';

export default AnnouncementBanner;
