/**
 * 공고 공지 전송 모달 컴포넌트
 *
 * @description
 * 각 공고마다 확정된 스태프들에게 일괄 공지를 보내는 모달 UI
 *
 * @version 1.0.0
 * @since 2025-09-30
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting, ConfirmedStaff, validateAnnouncement } from '../../../types';
import { logger } from '../../../utils/logger';

export interface SendAnnouncementModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 공고 정보 */
  jobPosting: JobPosting;
  /** 확정된 스태프 목록 */
  confirmedStaff: ConfirmedStaff[];
  /** 전송 핸들러 */
  onSend: (eventId: string, title: string, message: string, targetStaffIds: string[], jobPostingTitle?: string) => Promise<void>;
  /** 전송 중 상태 */
  isSending?: boolean;
}

const SendAnnouncementModal: React.FC<SendAnnouncementModalProps> = ({
  isOpen,
  onClose,
  jobPosting,
  confirmedStaff,
  onSend,
  isSending = false
}) => {
  const { t } = useTranslation();

  // 폼 상태
  const [title, setTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // 수신 대상 스태프 ID 목록
  const targetStaffIds = useMemo(() => {
    return Array.from(new Set(confirmedStaff.map(staff => staff.userId)));
  }, [confirmedStaff]);

  // 수신 대상 그룹핑 (중복 제거)
  const uniqueStaff = useMemo(() => {
    const staffMap = new Map<string, ConfirmedStaff>();
    confirmedStaff.forEach(staff => {
      if (!staffMap.has(staff.userId)) {
        staffMap.set(staff.userId, staff);
      }
    });
    return Array.from(staffMap.values());
  }, [confirmedStaff]);

  // 제목 변경 핸들러
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setTitle(value);
      setErrors([]);
    }
  }, []);

  // 내용 변경 핸들러
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setAnnouncementMessage(value);
      setErrors([]);
    }
  }, []);

  // 전송 핸들러
  const handleSend = useCallback(async () => {
    // 유효성 검증
    const validation = validateAnnouncement({
      eventId: jobPosting.id,
      title: title.trim(),
      message: announcementMessage.trim(),
      targetStaffIds
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      logger.warn('공지 유효성 검증 실패', { errors: validation.errors });
      return;
    }

    try {
      await onSend(jobPosting.id, title.trim(), announcementMessage.trim(), targetStaffIds, jobPosting.title);

      // 성공 시 폼 초기화 및 모달 닫기
      setTitle('');
      setAnnouncementMessage('');
      setErrors([]);
      onClose();
    } catch (error) {
      logger.error('공지 전송 실패', error as Error);
      setErrors(['공지 전송에 실패했습니다. 다시 시도해주세요.']);
    }
  }, [jobPosting.id, jobPosting.title, title, announcementMessage, targetStaffIds, onSend, onClose]);

  // 취소 핸들러
  const handleCancel = useCallback(() => {
    setTitle('');
    setAnnouncementMessage('');
    setErrors([]);
    onClose();
  }, [onClose]);

  // 키보드 이벤트 (Esc 키로 닫기)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSending) {
      handleCancel();
    }
  }, [isSending, handleCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 id="announcement-modal-title" className="text-lg sm:text-xl font-bold text-gray-900">
            {t('jobPosting.announcement.modalTitle')}
          </h2>
          <button
            onClick={handleCancel}
            disabled={isSending}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label={t('common.cancel')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* 확정된 스태프가 없을 때 안내 메시지 */}
          {confirmedStaff.length === 0 && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-800 mb-1">
                    수신 대상이 없습니다
                  </h4>
                  <p className="text-sm text-yellow-700">
                    공지를 전송하려면 먼저 스태프를 확정해야 합니다.
                    <br />
                    확정된 스태프에게만 공지를 전송할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <ul className="text-sm text-red-600 list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 제목 입력 */}
          <div className="mb-4">
            <label htmlFor="announcement-title" className="block text-sm font-medium text-gray-700 mb-2">
              {t('jobPosting.announcement.titleLabel')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              id="announcement-title"
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder={t('jobPosting.announcement.titlePlaceholder')}
              disabled={isSending || confirmedStaff.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              maxLength={50}
              autoFocus
            />
            <div className="mt-1 text-xs text-gray-500 text-right">
              {title.length} / 50
            </div>
          </div>

          {/* 내용 입력 */}
          <div className="mb-4">
            <label htmlFor="announcement-message" className="block text-sm font-medium text-gray-700 mb-2">
              {t('jobPosting.announcement.messageLabel')}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              id="announcement-message"
              value={announcementMessage}
              onChange={handleMessageChange}
              placeholder={t('jobPosting.announcement.messagePlaceholder')}
              disabled={isSending || confirmedStaff.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
              rows={6}
              maxLength={500}
            />
            <div className="mt-1 text-xs text-gray-500 text-right">
              {announcementMessage.length} / 500
            </div>
          </div>

          {/* 수신 대상 */}
          {confirmedStaff.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                {t('jobPosting.announcement.targetStaff')}
              </h3>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  {t('jobPosting.announcement.staffCount', { count: uniqueStaff.length })}
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {uniqueStaff.map((staff, index) => (
                    <div key={staff.userId} className="flex items-center text-sm text-gray-700">
                      <span className="w-6 text-gray-400">{index + 1}.</span>
                      <span className="font-medium">{staff.name}</span>
                      <span className="ml-2 text-gray-500">({staff.role})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 공고 정보 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600 font-medium mb-1">
              📍 {t('jobPosting.announcement.postingInfo')}
            </p>
            <p className="text-sm text-gray-700">
              {jobPosting.title}
            </p>
            {jobPosting.location && (
              <p className="text-xs text-gray-500 mt-1">
                위치: {jobPosting.location}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t bg-gray-50">
          <button
            onClick={handleCancel}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !title.trim() || !announcementMessage.trim() || confirmedStaff.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('jobPosting.announcement.sending')}
              </>
            ) : (
              <>
                <span>{t('jobPosting.announcement.sendButton')}</span>
                {confirmedStaff.length > 0 && (
                  <span className="text-xs opacity-80">({uniqueStaff.length}명)</span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendAnnouncementModal;