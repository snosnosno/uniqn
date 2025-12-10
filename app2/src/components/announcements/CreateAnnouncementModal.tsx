/**
 * 시스템 공지사항 등록 모달
 *
 * @description
 * 관리자가 전체 사용자 대상 시스템 공지사항을 등록하는 모달
 * - 배너 표시 옵션
 * - 이미지 첨부 기능
 * - XSS 검증 통합
 *
 * @version 2.0.0
 * @since 2025-12-10
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import AnnouncementImageUpload from './AnnouncementImageUpload';
import { logger } from '../../utils/logger';
import { validateCreateAnnouncement } from '../../schemas/announcement.schema';
import type { CreateSystemAnnouncementInput, AnnouncementPriority } from '../../types';
import { getPriorityLabel, getPriorityBadgeStyle } from '../../types';

interface CreateAnnouncementModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 성공 핸들러 */
  onSuccess: () => void;
  /** 공지사항 생성 핸들러 */
  createAnnouncement: (input: CreateSystemAnnouncementInput) => Promise<string>;
  /** 이미지 업로드 핸들러 */
  uploadImage: (file: File) => Promise<{ url: string; path: string }>;
  /** 이미지 삭제 핸들러 */
  deleteImage: (path: string) => Promise<void>;
  /** 업로드 진행률 */
  uploadProgress: number;
}

/**
 * 공지사항 등록 모달
 */
const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = memo(
  ({
    isOpen,
    onClose,
    onSuccess,
    createAnnouncement,
    uploadImage,
    deleteImage,
    uploadProgress,
  }) => {
    const { t } = useTranslation();

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState<AnnouncementPriority>('normal');
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 16));
    const [endDate, setEndDate] = useState('');
    const [hasEndDate, setHasEndDate] = useState(false);
    const [showAsBanner, setShowAsBanner] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);

    // Loading state
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 미리보기 모드
    const [showPreview, setShowPreview] = useState(false);

    /**
     * 폼 유효성 검증
     */
    const validationResult = useMemo(() => {
      const input = {
        title: title.trim(),
        content: content.trim(),
        priority,
        startDate: new Date(startDate),
        endDate: hasEndDate && endDate ? new Date(endDate) : null,
        showAsBanner,
        imageUrl: imageUrl ?? undefined,
        imageStoragePath: imageStoragePath ?? undefined,
      };

      return validateCreateAnnouncement(input);
    }, [
      title,
      content,
      priority,
      startDate,
      endDate,
      hasEndDate,
      showAsBanner,
      imageUrl,
      imageStoragePath,
    ]);

    const validationErrors = validationResult.success ? [] : validationResult.errors;

    /**
     * 폼 초기화
     */
    const resetForm = useCallback(() => {
      setTitle('');
      setContent('');
      setPriority('normal');
      setStartDate(new Date().toISOString().slice(0, 16));
      setEndDate('');
      setHasEndDate(false);
      setShowAsBanner(false);
      setImageUrl(null);
      setImageStoragePath(null);
      setShowPreview(false);
    }, []);

    /**
     * 모달 닫기
     */
    const handleClose = useCallback(async () => {
      // 업로드된 이미지가 있으면 삭제
      if (imageStoragePath) {
        await deleteImage(imageStoragePath);
      }
      resetForm();
      onClose();
    }, [resetForm, onClose, imageStoragePath, deleteImage]);

    /**
     * 이미지 업로드 핸들러
     */
    const handleImageUpload = useCallback(
      async (file: File) => {
        const result = await uploadImage(file);
        setImageUrl(result.url);
        setImageStoragePath(result.path);
      },
      [uploadImage]
    );

    /**
     * 이미지 삭제 핸들러
     */
    const handleImageDelete = useCallback(async () => {
      if (imageStoragePath) {
        await deleteImage(imageStoragePath);
      }
      setImageUrl(null);
      setImageStoragePath(null);
    }, [imageStoragePath, deleteImage]);

    /**
     * 공지사항 등록
     */
    const handleSubmit = useCallback(async () => {
      if (!validationResult.success) {
        return;
      }

      try {
        setIsSubmitting(true);

        const input: CreateSystemAnnouncementInput = {
          title: title.trim(),
          content: content.trim(),
          priority,
          startDate: new Date(startDate),
          endDate: hasEndDate && endDate ? new Date(endDate) : null,
          showAsBanner,
          imageUrl: imageUrl ?? undefined,
          imageStoragePath: imageStoragePath ?? undefined,
        };

        await createAnnouncement(input);

        logger.info('공지사항 등록 성공', {
          component: 'CreateAnnouncementModal',
          data: { title: input.title, showAsBanner },
        });

        resetForm();
        onSuccess();
        onClose();
      } catch (error) {
        logger.error(
          '공지사항 등록 실패',
          error instanceof Error ? error : new Error(String(error)),
          { component: 'CreateAnnouncementModal' }
        );
      } finally {
        setIsSubmitting(false);
      }
    }, [
      validationResult.success,
      title,
      content,
      priority,
      startDate,
      endDate,
      hasEndDate,
      showAsBanner,
      imageUrl,
      imageStoragePath,
      createAnnouncement,
      resetForm,
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
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        size="lg"
        title={t('announcements.create.title', '공지사항 등록')}
      >
        <div className="space-y-6">
          {/* 미리보기 모드 토글 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              {showPreview
                ? t('announcements.form.editMode', '편집 모드')
                : t('announcements.form.preview', '미리보기')}
            </button>
          </div>

          {showPreview ? (
            /* 미리보기 */
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-700">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {title || t('announcements.form.noTitle', '(제목 없음)')}
                </h3>
                <div className="flex items-center gap-2">
                  {showAsBanner && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                      {t('announcements.banner', '배너')}
                    </span>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityBadgeStyle(priority)}`}
                  >
                    {getPriorityLabel(priority)}
                  </span>
                </div>
              </div>

              {imageUrl && (
                <div className="mb-4">
                  <img
                    src={imageUrl}
                    alt={t('announcements.form.attachedImage', '첨부 이미지')}
                    className="max-w-full h-auto max-h-48 rounded-lg"
                  />
                </div>
              )}

              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-200 mb-4">
                {content || t('announcements.form.noContent', '(내용 없음)')}
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <p>
                  • {t('announcements.form.startDate', '공개 시작')}:{' '}
                  {new Date(startDate).toLocaleString('ko-KR')}
                </p>
                {hasEndDate && endDate ? (
                  <p>
                    • {t('announcements.form.endDate', '공개 종료')}:{' '}
                    {new Date(endDate).toLocaleString('ko-KR')}
                  </p>
                ) : (
                  <p>• {t('announcements.form.noEndDate', '공개 기간: 무기한')}</p>
                )}
              </div>
            </div>
          ) : (
            /* 입력 폼 */
            <div className="space-y-4">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('announcements.form.titleLabel', '제목')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  placeholder={t(
                    'announcements.form.titlePlaceholder',
                    '공지사항 제목을 입력하세요'
                  )}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {title.length}/100
                </p>
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('announcements.form.contentLabel', '내용')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={2000}
                  rows={8}
                  placeholder={t(
                    'announcements.form.contentPlaceholder',
                    '공지사항 내용을 입력하세요'
                  )}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {content.length}/2000
                </p>
              </div>

              {/* 우선순위 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('announcements.form.priority', '우선순위')}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriority(option.value)}
                      className={`px-4 py-3 rounded-lg border-2 transition-all text-center ${
                        priority === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 font-medium'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <span className={getPriorityBadgeStyle(option.value).replace('border', '')}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 배너 표시 옵션 */}
              <div className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <input
                  type="checkbox"
                  id="showAsBanner"
                  checked={showAsBanner}
                  onChange={(e) => setShowAsBanner(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="showAsBanner" className="flex-1 cursor-pointer">
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t('announcements.form.showAsBanner', '메인 화면 배너로 표시')}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t(
                      'announcements.form.showAsBannerDesc',
                      '로그인 후 메인 화면 상단에 배너로 표시됩니다'
                    )}
                  </span>
                </label>
              </div>

              {/* 공개 기간 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    {t('announcements.form.startDateLabel', '공개 시작일')}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    <input
                      type="checkbox"
                      checked={hasEndDate}
                      onChange={(e) => setHasEndDate(e.target.checked)}
                      className="mr-2 rounded border-gray-300 dark:border-gray-600"
                    />
                    {t('announcements.form.endDateLabel', '공개 종료일 설정')}
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={!hasEndDate}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      !hasEndDate ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              {/* 이미지 업로드 */}
              <AnnouncementImageUpload
                imageUrl={imageUrl}
                uploadProgress={uploadProgress}
                onUpload={handleImageUpload}
                onDelete={handleImageDelete}
                disabled={isSubmitting}
              />

              {/* 유효성 검증 에러 */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                    {t('announcements.form.validationError', '입력 오류')}
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
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.cancel', '취소')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !validationResult.success}
              className="px-6 py-2 text-white bg-blue-600 dark:bg-blue-700 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? t('announcements.form.submitting', '등록 중...')
                : t('announcements.form.submit', '등록하기')}
            </button>
          </div>
        </div>
      </Modal>
    );
  }
);

CreateAnnouncementModal.displayName = 'CreateAnnouncementModal';

export default CreateAnnouncementModal;
