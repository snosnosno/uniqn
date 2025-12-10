/**
 * 공지사항 이미지 업로드 컴포넌트
 *
 * @description
 * 공지사항에 첨부할 이미지를 업로드하는 컴포넌트
 * - 드래그 앤 드롭 지원
 * - 이미지 미리보기
 * - 업로드 진행률 표시
 * - 이미지 삭제 기능
 * - 다크모드 지원
 *
 * @version 1.0.0
 * @since 2025-12-10
 */

import React, { memo, useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoIcon, XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { logger } from '../../utils/logger';

/** 허용 이미지 타입 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** 최대 파일 크기 (5MB) */
const MAX_SIZE = 5 * 1024 * 1024;

interface AnnouncementImageUploadProps {
  /** 현재 이미지 URL */
  imageUrl?: string | null;
  /** 업로드 진행률 (0-100) */
  uploadProgress: number;
  /** 이미지 업로드 핸들러 */
  onUpload: (file: File) => Promise<void>;
  /** 이미지 삭제 핸들러 */
  onDelete: () => void;
  /** 비활성화 여부 */
  disabled?: boolean;
}

/**
 * 공지사항 이미지 업로드 컴포넌트
 */
const AnnouncementImageUpload: React.FC<AnnouncementImageUploadProps> = memo(
  ({ imageUrl, uploadProgress, onUpload, onDelete, disabled = false }) => {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * 파일 검증
     */
    const validateFile = useCallback(
      (file: File): string | null => {
        if (!ALLOWED_TYPES.includes(file.type)) {
          return t(
            'announcements.imageUpload.invalidType',
            '지원하지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WebP만 가능)'
          );
        }

        if (file.size > MAX_SIZE) {
          return t('announcements.imageUpload.tooLarge', '이미지 크기는 5MB 이하만 가능합니다.');
        }

        return null;
      },
      [t]
    );

    /**
     * 파일 처리
     */
    const handleFile = useCallback(
      async (file: File) => {
        setError(null);

        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }

        try {
          await onUpload(file);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
          setError(errorMessage);
          logger.error('이미지 업로드 실패', err instanceof Error ? err : new Error(String(err)), {
            component: 'AnnouncementImageUpload',
          });
        }
      },
      [validateFile, onUpload]
    );

    /**
     * 파일 입력 변경 핸들러
     */
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          handleFile(file);
        }
        // 같은 파일 재선택 가능하도록 초기화
        e.target.value = '';
      },
      [handleFile]
    );

    /**
     * 드래그 앤 드롭 핸들러
     */
    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (disabled) return;

        const file = e.dataTransfer.files[0];
        if (file) {
          handleFile(file);
        }
      },
      [disabled, handleFile]
    );

    /**
     * 클릭 핸들러
     */
    const handleClick = useCallback(() => {
      if (!disabled && fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, [disabled]);

    /**
     * 삭제 핸들러
     */
    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
        setError(null);
      },
      [onDelete]
    );

    // 업로드 중
    const isUploading = uploadProgress > 0 && uploadProgress < 100;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          {t('announcements.imageUpload.label', '이미지 첨부')}
          <span className="ml-1 text-gray-500 dark:text-gray-400 font-normal">
            ({t('announcements.imageUpload.optional', '선택')})
          </span>
        </label>

        {/* 이미지가 있는 경우 미리보기 */}
        {imageUrl ? (
          <div className="relative inline-block">
            <img
              src={imageUrl}
              alt={t('announcements.imageUpload.preview', '첨부 이미지')}
              className="max-w-full h-auto max-h-48 rounded-lg border border-gray-300 dark:border-gray-600"
            />
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled}
              className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t('announcements.imageUpload.delete', '이미지 삭제')}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* 업로드 영역 */
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={handleClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg
              transition-all cursor-pointer
              ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${isUploading ? 'pointer-events-none' : ''}
            `}
            aria-label={t(
              'announcements.imageUpload.dropzone',
              '이미지를 드래그하거나 클릭하여 업로드'
            )}
          >
            {isUploading ? (
              /* 업로드 진행 중 */
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3">
                  <svg className="animate-spin w-full h-full text-blue-500" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('announcements.imageUpload.uploading', '업로드 중...')}
                </p>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(uploadProgress)}%
                </p>
              </div>
            ) : (
              /* 기본 상태 */
              <>
                {isDragOver ? (
                  <ArrowUpTrayIcon className="w-12 h-12 text-blue-500 mb-3" />
                ) : (
                  <PhotoIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-3" />
                )}
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {isDragOver
                    ? t('announcements.imageUpload.dropHere', '여기에 놓으세요')
                    : t(
                        'announcements.imageUpload.clickOrDrag',
                        '클릭하거나 이미지를 드래그하세요'
                      )}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('announcements.imageUpload.formats', 'JPEG, PNG, GIF, WebP (최대 5MB)')}
                </p>
              </>
            )}

            {/* 숨겨진 파일 입력 */}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleInputChange}
              disabled={disabled || isUploading}
              className="hidden"
              aria-hidden="true"
            />
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AnnouncementImageUpload.displayName = 'AnnouncementImageUpload';

export default AnnouncementImageUpload;
