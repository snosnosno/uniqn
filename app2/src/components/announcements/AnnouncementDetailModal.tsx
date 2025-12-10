/**
 * 시스템 공지사항 상세 모달
 *
 * @description
 * 공지사항 전체 내용을 표시하는 모달
 * - 이미지 표시
 * - ConfirmModal을 사용한 삭제 확인
 * - 접근성 준수
 *
 * @version 2.0.0
 * @since 2025-12-10
 */

import React, { useCallback, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CalendarIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import Modal from '../ui/Modal';
import ConfirmModal from '../modals/ConfirmModal';
import type { SystemAnnouncement } from '../../types';
import { getPriorityLabel, getPriorityBadgeStyle } from '../../types';

interface AnnouncementDetailModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 공지사항 데이터 */
  announcement: SystemAnnouncement | null;
  /** 관리자 여부 */
  isAdmin?: boolean;
  /** 수정 핸들러 */
  onEdit?: (announcement: SystemAnnouncement) => void;
  /** 삭제 핸들러 */
  onDelete?: (announcementId: string) => void;
}

/**
 * 공지사항 상세 모달
 */
const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = memo(
  ({ isOpen, onClose, announcement, isAdmin = false, onEdit, onDelete }) => {
    const { t } = useTranslation();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    /**
     * 수정 버튼 클릭
     */
    const handleEdit = useCallback(() => {
      if (announcement && onEdit) {
        onEdit(announcement);
      }
    }, [announcement, onEdit]);

    /**
     * 삭제 확인 모달 열기
     */
    const handleDeleteClick = useCallback(() => {
      setIsDeleteModalOpen(true);
    }, []);

    /**
     * 삭제 실행
     */
    const handleDeleteConfirm = useCallback(async () => {
      if (!announcement || !onDelete) return;

      try {
        setIsDeleting(true);
        await onDelete(announcement.id);
        setIsDeleteModalOpen(false);
        onClose();
      } catch {
        // 에러는 onDelete에서 처리
      } finally {
        setIsDeleting(false);
      }
    }, [announcement, onDelete, onClose]);

    /**
     * 날짜 포맷팅 헬퍼
     */
    const formatDate = useCallback(
      (timestamp: SystemAnnouncement['createdAt'] | SystemAnnouncement['startDate']) => {
        if (!timestamp) return '-';
        const date = timestamp instanceof Date ? timestamp : timestamp.toDate?.();
        if (!date) return '-';
        return format(date, 'yyyy년 MM월 dd일 HH:mm', { locale: ko });
      },
      []
    );

    if (!announcement) return null;

    return (
      <>
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          size="lg"
          title={t('announcements.detail.title', '공지사항')}
        >
          <div className="space-y-6">
            {/* 헤더 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex-1">
                  {announcement.title}
                </h2>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {announcement.showAsBanner && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                      {t('announcements.banner', '배너')}
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getPriorityBadgeStyle(announcement.priority)}`}
                  >
                    {getPriorityLabel(announcement.priority)}
                  </span>
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4" />
                  <span>{announcement.createdByName}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{formatDate(announcement.createdAt)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <EyeIcon className="w-4 h-4" />
                  <span>
                    {announcement.viewCount.toLocaleString()}
                    {t('announcements.detail.views', '회')}
                  </span>
                </span>
              </div>

              {/* 공개 기간 */}
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium">
                  {t('announcements.detail.period', '공개 기간')}:
                </span>{' '}
                {formatDate(announcement.startDate)}
                {announcement.endDate
                  ? ` ~ ${formatDate(announcement.endDate)}`
                  : ` ~ ${t('announcements.detail.indefinite', '무기한')}`}
              </div>
            </div>

            {/* 첨부 이미지 */}
            {announcement.imageUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <img
                  src={announcement.imageUrl}
                  alt={t('announcements.detail.attachedImage', '첨부 이미지')}
                  className="w-full h-auto max-h-96 object-contain bg-gray-100 dark:bg-gray-800"
                  loading="lazy"
                />
              </div>
            )}

            {/* 본문 */}
            <div className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                {announcement.content}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* 관리자 버튼 */}
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <PencilIcon className="w-4 h-4" />
                    <span>{t('common.edit', '수정')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <TrashIcon className="w-4 h-4" />
                    <span>{t('common.delete', '삭제')}</span>
                  </button>
                </div>
              )}

              {/* 닫기 버튼 */}
              <button
                type="button"
                onClick={onClose}
                className={`px-6 py-2 text-white bg-gray-600 dark:bg-gray-700 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors ${
                  !isAdmin ? 'w-full' : 'ml-auto'
                }`}
              >
                {t('common.close', '닫기')}
              </button>
            </div>
          </div>
        </Modal>

        {/* 삭제 확인 모달 */}
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteConfirm}
          title={t('announcements.delete.title', '공지사항 삭제')}
          message={t(
            'announcements.delete.message',
            '정말 이 공지사항을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'
          )}
          confirmText={t('common.delete', '삭제')}
          cancelText={t('common.cancel', '취소')}
          isDangerous
          isLoading={isDeleting}
        />
      </>
    );
  }
);

AnnouncementDetailModal.displayName = 'AnnouncementDetailModal';

export default AnnouncementDetailModal;
