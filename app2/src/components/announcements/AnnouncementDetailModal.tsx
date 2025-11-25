/**
 * 시스템 공지사항 상세 모달
 *
 * @description
 * 공지사항 전체 내용을 표시하는 모달
 *
 * @version 1.0.0
 * @since 2025-10-25
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Modal from '../ui/Modal';
import type { SystemAnnouncement } from '../../types';
import {
  getPriorityLabel,
  getPriorityBadgeStyle
} from '../../types';

interface AnnouncementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: SystemAnnouncement | null;
  isAdmin?: boolean;
  onEdit?: (announcement: SystemAnnouncement) => void;
  onDelete?: (announcementId: string) => void;
}

const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({
  isOpen,
  onClose,
  announcement,
  isAdmin = false,
  onEdit,
  onDelete
}) => {
  const { t: _t } = useTranslation();

  /**
   * 수정 버튼 클릭
   */
  const handleEdit = useCallback(() => {
    if (announcement && onEdit) {
      onEdit(announcement);
    }
  }, [announcement, onEdit]);

  /**
   * 삭제 버튼 클릭
   */
  const handleDelete = useCallback(() => {
    if (!announcement) return;

    // eslint-disable-next-line no-alert
    if (window.confirm('정말 이 공지사항을 삭제하시겠습니까?')) {
      if (onDelete) {
        onDelete(announcement.id);
      }
      onClose();
    }
  }, [announcement, onDelete, onClose]);

  if (!announcement) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="📢 공지사항"
    >
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex-1 pr-4">
              {announcement.title}
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getPriorityBadgeStyle(announcement.priority)}`}>
              {getPriorityLabel(announcement.priority)}
            </span>
          </div>

          {/* 메타 정보 */}
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>
              <span className="font-medium text-gray-700 dark:text-gray-300">작성자:</span>{' '}
              {announcement.createdByName}
            </p>
            <p>
              <span className="font-medium text-gray-700 dark:text-gray-300">작성일:</span>{' '}
              {format(
                announcement.createdAt instanceof Date
                  ? announcement.createdAt
                  : announcement.createdAt.toDate(),
                'yyyy년 MM월 dd일 HH:mm',
                { locale: ko }
              )}
            </p>
            <p>
              <span className="font-medium text-gray-700 dark:text-gray-300">공개 기간:</span>{' '}
              {format(
                announcement.startDate instanceof Date
                  ? announcement.startDate
                  : announcement.startDate.toDate(),
                'yyyy.MM.dd HH:mm',
                { locale: ko }
              )}
              {announcement.endDate
                ? ` ~ ${format(
                    announcement.endDate instanceof Date
                      ? announcement.endDate
                      : announcement.endDate.toDate(),
                    'yyyy.MM.dd HH:mm',
                    { locale: ko }
                  )}`
                : ' ~ 무기한'}
            </p>
            <p>
              <span className="font-medium text-gray-700 dark:text-gray-300">조회수:</span>{' '}
              {announcement.viewCount.toLocaleString()}회
            </p>
          </div>
        </div>

        {/* 본문 */}
        <div className="prose dark:prose-invert max-w-none">
          <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
            {announcement.content}
          </div>
        </div>

        {/* 전송 결과 (있는 경우) */}
        {announcement.sendResult && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              📊 알림 전송 결과
            </p>
            <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <p>• 전체 사용자: {announcement.sendResult.totalUsers.toLocaleString()}명</p>
              <p>• 전송 성공: {announcement.sendResult.successCount.toLocaleString()}명</p>
              {announcement.sendResult.failedCount > 0 && (
                <p className="text-red-600 dark:text-red-400">
                  • 전송 실패: {announcement.sendResult.failedCount.toLocaleString()}명
                </p>
              )}
              {announcement.sendResult.sentAt && (
                <p>
                  • 전송 시간:{' '}
                  {format(
                    announcement.sendResult.sentAt instanceof Date
                      ? announcement.sendResult.sentAt
                      : announcement.sendResult.sentAt.toDate(),
                    'yyyy.MM.dd HH:mm',
                    { locale: ko }
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* 관리자 버튼 */}
          {isAdmin && (
            <div className="flex space-x-2">
              <button
                onClick={handleEdit}
                className="px-4 py-2 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                ✏️ 수정
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              >
                🗑️ 삭제
              </button>
            </div>
          )}

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className={`px-6 py-2 text-white bg-gray-600 dark:bg-gray-700 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors ${
              !isAdmin ? 'w-full' : ''
            }`}
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AnnouncementDetailModal;
