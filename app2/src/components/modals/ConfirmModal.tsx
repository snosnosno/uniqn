import React, { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FaExclamationTriangle } from '../Icons/ReactIconsReplacement';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  /** 텍스트 입력을 요구하는 경우 */
  requireTextInput?: {
    placeholder: string;
    confirmValue: string;
    caseSensitive?: boolean;
  };
}

/**
 * 재사용 가능한 확인 모달 컴포넌트
 * window.confirm()을 대체하는 사용자 친화적인 확인 다이얼로그
 * 텍스트 입력 검증 기능 포함 (전체삭제 등 위험한 작업에 사용)
 *
 * 접근성 기능:
 * - ARIA 속성 (role="dialog", aria-modal, aria-labelledby)
 * - ESC 키로 닫기
 * - Focus trap (모달 내부에서만 Tab 이동)
 * - 배경 클릭으로 닫기
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  isDangerous = false,
  isLoading = false,
  requireTextInput,
}) => {
  const [inputValue, setInputValue] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // ESC 키 핸들러
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  // Focus trap 핸들러
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  }, []);

  // 모달이 열릴 때마다 입력값 초기화 및 포커스 관리
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      // 이전 포커스 요소 저장
      previousActiveElement.current = document.activeElement as HTMLElement;
      // body 스크롤 방지
      document.body.style.overflow = 'hidden';
      // 키보드 이벤트 등록
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleTabKey);
      // 모달 내 첫 번째 요소에 포커스
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([disabled])'
        );
        firstFocusable?.focus();
      }, 0);
    }

    return () => {
      if (isOpen) {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keydown', handleTabKey);
        // 이전 포커스 요소로 복원
        previousActiveElement.current?.focus();
      }
    };
  }, [isOpen, handleKeyDown, handleTabKey]);

  // 입력값 검증 (계산된 값으로 변경)
  const isInputValid =
    !requireTextInput ||
    (() => {
      const { confirmValue, caseSensitive = true } = requireTextInput;
      if (caseSensitive) {
        return inputValue === confirmValue;
      } else {
        return inputValue.toLowerCase() === confirmValue.toLowerCase();
      }
    })();

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!isInputValid) return;
    onConfirm();
    if (!isLoading) {
      onClose();
    }
  };

  const handleCancel = () => {
    if (!isLoading) {
      onClose();
    }
  };

  // 배경 클릭 핸들러
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-[60] p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-scale-up"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {isDangerous && (
              <FaExclamationTriangle
                className="w-6 h-6 text-red-500 dark:text-red-400"
                aria-hidden="true"
              />
            )}
            <h3
              id="confirm-modal-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {title}
            </h3>
          </div>
          <button
            onClick={handleCancel}
            disabled={isLoading}
            aria-label="닫기"
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line mb-4">{message}</p>

          {/* 텍스트 입력 필드 */}
          {requireTextInput && (
            <div className="mt-4">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={requireTextInput.placeholder}
                disabled={isLoading}
                autoFocus
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors ${
                  inputValue && !isInputValid
                    ? 'border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400'
                } focus:outline-none focus:ring-2 disabled:opacity-50`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isInputValid) {
                    handleConfirm();
                  }
                }}
              />
              {inputValue && !isInputValid && (
                <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                  입력값이 일치하지 않습니다. "{requireTextInput.confirmValue}"를 정확히
                  입력해주세요.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !isInputValid}
            className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDangerous
                ? 'bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600'
                : 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                처리 중...
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
