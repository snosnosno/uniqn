/**
 * 시스템 공지사항 수정 모달
 *
 * @description
 * 관리자가 기존 시스템 공지사항을 수정하는 모달
 *
 * @version 1.0.0
 * @since 2025-10-25
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useToast } from '../../hooks/useToast';
import { useSystemAnnouncements } from '../../hooks/useSystemAnnouncements';
import { logger } from '../../utils/logger';
import type {
  SystemAnnouncement,
  UpdateSystemAnnouncementInput,
  AnnouncementPriority,
} from '../../types';
import { validateSystemAnnouncement, getPriorityLabel, getPriorityBadgeStyle } from '../../types';

interface EditAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  announcement: SystemAnnouncement;
}

const EditAnnouncementModal: React.FC<EditAnnouncementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  announcement,
}) => {
  const { showSuccess, showError } = useToast();
  const { updateAnnouncement } = useSystemAnnouncements();

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasEndDate, setHasEndDate] = useState(false);

  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 미리보기 모드
  const [showPreview, setShowPreview] = useState(false);

  /**
   * 공지사항 데이터로 폼 초기화
   */
  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setContent(announcement.content);
      setPriority(announcement.priority);

      // startDate 처리
      const start =
        announcement.startDate instanceof Date
          ? announcement.startDate
          : announcement.startDate?.toDate();
      setStartDate(start ? new Date(start).toISOString().slice(0, 16) : '');

      // endDate 처리
      if (announcement.endDate) {
        const end =
          announcement.endDate instanceof Date
            ? announcement.endDate
            : announcement.endDate.toDate();
        setEndDate(new Date(end).toISOString().slice(0, 16));
        setHasEndDate(true);
      } else {
        setEndDate('');
        setHasEndDate(false);
      }
    }
  }, [announcement]);

  /**
   * 폼 유효성 검증
   */
  const validationErrors = useMemo(() => {
    const input = {
      title: title.trim(),
      content: content.trim(),
      priority,
      startDate: new Date(startDate),
      endDate: hasEndDate && endDate ? new Date(endDate) : null,
    };

    const validation = validateSystemAnnouncement(input);
    return validation.errors;
  }, [title, content, priority, startDate, endDate, hasEndDate]);

  /**
   * 모달 닫기
   */
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  /**
   * 공지사항 수정
   */
  const handleSubmit = useCallback(async () => {
    try {
      setIsSubmitting(true);

      // 유효성 검증용 객체 (모든 필드 필수)
      const validationInput = {
        title: title.trim(),
        content: content.trim(),
        priority,
        startDate: new Date(startDate),
        endDate: hasEndDate && endDate ? new Date(endDate) : null,
      };

      // 유효성 검증
      const validation = validateSystemAnnouncement(validationInput);
      if (!validation.isValid) {
        showError(validation.errors[0] || '유효성 검증 실패');
        return;
      }

      // 실제 업데이트용 객체 (UpdateSystemAnnouncementInput 타입)
      const updateInput: UpdateSystemAnnouncementInput = {
        title: title.trim(),
        content: content.trim(),
        priority,
        startDate: new Date(startDate),
        endDate: hasEndDate && endDate ? new Date(endDate) : null,
      };

      // 공지사항 수정
      await updateAnnouncement(announcement.id, updateInput);

      logger.info('시스템 공지사항 수정 완료', {
        component: 'EditAnnouncementModal',
        data: { id: announcement.id, title: updateInput.title },
      });

      showSuccess('공지사항이 수정되었습니다.');
      onSuccess();
      onClose();
    } catch (error) {
      logger.error(
        '공지사항 수정 실패:',
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'EditAnnouncementModal',
        }
      );
      showError('공지사항 수정에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    announcement.id,
    title,
    content,
    priority,
    startDate,
    endDate,
    hasEndDate,
    updateAnnouncement,
    showSuccess,
    showError,
    onSuccess,
    onClose,
  ]);

  /**
   * 우선순위 옵션
   */
  const priorityOptions: Array<{ value: AnnouncementPriority; label: string }> = [
    { value: 'normal', label: getPriorityLabel('normal') },
    { value: 'important', label: getPriorityLabel('important') },
    { value: 'urgent', label: getPriorityLabel('urgent') },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" title="✏️ 시스템 공지사항 수정">
      <div className="space-y-6">
        {/* 미리보기 모드 토글 */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            {showPreview ? '✏️ 편집 모드' : '👁️ 미리보기'}
          </button>
        </div>

        {showPreview ? (
          /* 미리보기 */
          <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-700">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {title || '(제목 없음)'}
              </h3>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityBadgeStyle(priority)}`}
              >
                {getPriorityLabel(priority)}
              </span>
            </div>
            <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-200 mb-4">
              {content || '(내용 없음)'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <p>• 공개 시작: {startDate ? new Date(startDate).toLocaleString('ko-KR') : '-'}</p>
              {hasEndDate && endDate && (
                <p>• 공개 종료: {new Date(endDate).toLocaleString('ko-KR')}</p>
              )}
              {!hasEndDate && <p>• 공개 기간: 무기한</p>}
            </div>
          </div>
        ) : (
          /* 입력 폼 */
          <div className="space-y-4">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                제목 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="공지사항 제목을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
                {title.length}/100자
              </p>
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                내용 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={2000}
                rows={10}
                placeholder="공지사항 내용을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
                {content.length}/2000자
              </p>
            </div>

            {/* 우선순위 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                우선순위 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {priorityOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPriority(option.value)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      priority === option.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span className={getPriorityBadgeStyle(option.value).replace('border', '')}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 공개 기간 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 시작일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  공개 시작일 <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 종료일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  <input
                    type="checkbox"
                    checked={hasEndDate}
                    onChange={(e) => setHasEndDate(e.target.checked)}
                    className="mr-2 rounded border-gray-300 dark:border-gray-600"
                  />
                  공개 종료일 설정
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={!hasEndDate}
                  className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    !hasEndDate ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            {/* 유효성 검증 에러 */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                  ⚠️ 입력 오류
                </p>
                <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-6 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || validationErrors.length > 0}
            className="px-6 py-2 text-white bg-blue-600 dark:bg-blue-700 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '수정 중...' : '수정하기'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EditAnnouncementModal;
