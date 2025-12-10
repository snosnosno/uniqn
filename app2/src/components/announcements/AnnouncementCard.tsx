/**
 * 공지사항 카드 컴포넌트
 *
 * @description
 * 공지사항 목록에서 개별 공지사항을 표시하는 카드 컴포넌트
 * - 우선순위 배지
 * - 메타 정보 (작성자, 날짜, 조회수)
 * - 이미지 썸네일 (있는 경우)
 * - 다크모드 지원
 * - 접근성 준수
 *
 * @version 1.0.0
 * @since 2025-12-10
 */

import React, { memo, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { EyeIcon, CalendarIcon, UserIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { SystemAnnouncement } from '../../types';
import { getPriorityLabel, getPriorityBadgeStyle } from '../../types';

interface AnnouncementCardProps {
  /** 공지사항 데이터 */
  announcement: SystemAnnouncement;
  /** 클릭 핸들러 */
  onClick: (announcement: SystemAnnouncement) => void;
  /** 배너 표시 여부 배지 */
  showBannerBadge?: boolean;
}

/**
 * 공지사항 카드 컴포넌트
 */
const AnnouncementCard: React.FC<AnnouncementCardProps> = memo(
  ({ announcement, onClick, showBannerBadge = false }) => {
    const { t } = useTranslation();

    /**
     * 생성일 포맷팅
     */
    const formattedDate = useMemo(() => {
      if (!announcement.createdAt) return '-';

      const date =
        announcement.createdAt instanceof Date
          ? announcement.createdAt
          : (announcement.createdAt.toDate?.() ?? new Date());

      return format(date, 'yyyy.MM.dd HH:mm', { locale: ko });
    }, [announcement.createdAt]);

    /**
     * 클릭 핸들러
     */
    const handleClick = useCallback(() => {
      onClick(announcement);
    }, [onClick, announcement]);

    /**
     * 키보드 접근성
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(announcement);
        }
      },
      [onClick, announcement]
    );

    return (
      <article
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-label={`${announcement.title} - ${getPriorityLabel(announcement.priority)} 공지사항`}
      >
        <div className="flex gap-4">
          {/* 이미지 썸네일 */}
          {announcement.imageUrl && (
            <div className="flex-shrink-0 hidden sm:block">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img
                  src={announcement.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* 콘텐츠 */}
          <div className="flex-1 min-w-0">
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2 flex-1">
                {announcement.title}
              </h3>

              {/* 배지 영역 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* 배너 배지 */}
                {showBannerBadge && announcement.showAsBanner && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                    {t('announcements.banner', '배너')}
                  </span>
                )}

                {/* 우선순위 배지 */}
                <span
                  className={`px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap ${getPriorityBadgeStyle(announcement.priority)}`}
                >
                  {getPriorityLabel(announcement.priority)}
                </span>
              </div>
            </div>

            {/* 내용 미리보기 */}
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
              {announcement.content}
            </p>

            {/* 메타 정보 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {/* 작성자 */}
              <span className="flex items-center gap-1">
                <UserIcon className="w-4 h-4" aria-hidden="true" />
                <span>{announcement.createdByName}</span>
              </span>

              {/* 작성일 */}
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" aria-hidden="true" />
                <time dateTime={formattedDate}>{formattedDate}</time>
              </span>

              {/* 조회수 */}
              <span className="flex items-center gap-1">
                <EyeIcon className="w-4 h-4" aria-hidden="true" />
                <span>{announcement.viewCount.toLocaleString()}</span>
              </span>

              {/* 이미지 표시 (모바일에서 이미지 있음 표시) */}
              {announcement.imageUrl && (
                <span className="flex items-center gap-1 sm:hidden">
                  <PhotoIcon className="w-4 h-4" aria-hidden="true" />
                  <span>{t('announcements.hasImage', '이미지')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 더보기 표시 */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {t('announcements.viewDetail', '자세히 보기')} →
          </span>
        </div>
      </article>
    );
  }
);

AnnouncementCard.displayName = 'AnnouncementCard';

export default AnnouncementCard;
