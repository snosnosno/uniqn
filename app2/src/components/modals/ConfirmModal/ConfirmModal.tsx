import React, { useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FaExclamationTriangle } from '../../Icons/ReactIconsReplacement';
import Button from '../../ui/Button';
import FocusTrap from '../../ui/FocusTrap';
import { useConfirmInput } from './useConfirmInput';
import {
  OVERLAY_STYLES,
  CONTAINER_STYLES,
  HEADER_STYLES,
  BODY_STYLES,
  FOOTER_STYLES,
  getInputClassName,
  INPUT_STYLES,
  ARIA_IDS,
} from './styles';
import type { ConfirmModalProps } from './types';

/**
 * 재사용 가능한 확인 모달 컴포넌트
 *
 * @description
 * window.confirm()을 대체하는 사용자 친화적인 확인 다이얼로그
 * 텍스트 입력 검증 기능 포함 (전체삭제 등 위험한 작업에 사용)
 *
 * @features
 * - Portal 기반 렌더링으로 z-index 문제 해결
 * - WCAG 2.1 AA 접근성 준수
 * - ARIA 속성 (role="dialog", aria-modal, aria-labelledby, aria-describedby)
 * - ESC 키로 닫기
 * - Focus trap (모달 내부에서만 Tab 이동)
 * - 배경 클릭으로 닫기
 * - 다크모드 완벽 지원
 * - 국제화(i18n) 지원
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <ConfirmModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleConfirm}
 *   title="삭제 확인"
 *   message="정말 삭제하시겠습니까?"
 * />
 *
 * // 위험한 작업 + 텍스트 입력 검증
 * <ConfirmModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleDelete}
 *   title="전체 삭제"
 *   message="모든 데이터가 삭제됩니다."
 *   isDangerous
 *   requireTextInput={{
 *     placeholder: "'삭제'를 입력하세요",
 *     confirmValue: "삭제",
 *   }}
 * />
 * ```
 */
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  isDangerous = false,
  isLoading = false,
  requireTextInput,
}) => {
  const { t } = useTranslation();
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 기본 텍스트 (국제화)
  const resolvedConfirmText = confirmText ?? t('common.confirm', '확인');
  const resolvedCancelText = cancelText ?? t('common.cancel', '취소');
  const processingText = t('common.messages.processing', '처리 중...');

  // 입력 검증 훅
  const { inputValue, setInputValue, isValid, errorMessage, reset } =
    useConfirmInput(requireTextInput);

  /**
   * ESC 키 핸들러
   * 로딩 중이 아닐 때만 모달 닫기
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.preventDefault();
        onClose();
      }
    },
    [isLoading, onClose]
  );

  /**
   * 모달 열림/닫힘 시 사이드 이펙트 관리
   * - 입력값 초기화
   * - 포커스 저장/복원
   * - 스크롤 방지
   * - 키보드 이벤트 등록
   */
  useEffect(() => {
    if (isOpen) {
      // 입력값 초기화
      reset();

      // 이전 포커스 요소 저장
      previousActiveElement.current = document.activeElement as HTMLElement;

      // body 스크롤 방지
      document.body.style.overflow = 'hidden';

      // ESC 키 이벤트 등록
      document.addEventListener('keydown', handleKeyDown);

      // 입력 필드가 있으면 포커스
      if (requireTextInput) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      }
    }

    return () => {
      if (isOpen) {
        // 스크롤 복원
        document.body.style.overflow = '';

        // 이벤트 리스너 제거
        document.removeEventListener('keydown', handleKeyDown);

        // 이전 포커스로 복원
        previousActiveElement.current?.focus();
      }
    };
  }, [isOpen, handleKeyDown, reset, requireTextInput]);

  /**
   * 확인 버튼 클릭 핸들러
   * - 입력 검증 통과 시에만 실행
   * - 비동기 onConfirm 지원
   */
  const handleConfirm = useCallback(async () => {
    if (!isValid || isLoading) return;

    try {
      await onConfirm();
      // onConfirm 성공 후 모달 닫기는 호출하는 쪽에서 제어
      // (isLoading이 false가 되면 자동으로 닫히도록)
    } catch (error) {
      // 에러는 호출하는 쪽에서 처리
      throw error;
    }
  }, [isValid, isLoading, onConfirm]);

  /**
   * 취소/닫기 핸들러
   * 로딩 중이 아닐 때만 닫기
   */
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [isLoading, onClose]);

  /**
   * 배경 클릭 핸들러
   * 배경 영역 클릭 시에만 닫기 (이벤트 버블링 방지)
   */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  /**
   * 입력 필드 Enter 키 핸들러
   */
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && isValid && !isLoading) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [isValid, isLoading, handleConfirm]
  );

  // 닫힌 상태면 렌더링하지 않음
  if (!isOpen) return null;

  const modalContent = (
    <div className={OVERLAY_STYLES.base} onClick={handleBackdropClick} role="presentation">
      <FocusTrap active={isOpen} returnFocus>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={ARIA_IDS.modalTitle}
          aria-describedby={ARIA_IDS.modalDescription}
          aria-busy={isLoading}
          className={CONTAINER_STYLES.base}
        >
          {/* 헤더 */}
          <div className={HEADER_STYLES.wrapper}>
            <div className={HEADER_STYLES.titleContainer}>
              {isDangerous && (
                <FaExclamationTriangle className={HEADER_STYLES.warningIcon} aria-hidden="true" />
              )}
              <h3 id={ARIA_IDS.modalTitle} className={HEADER_STYLES.title}>
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              aria-label={t('common.close', '닫기')}
              className={HEADER_STYLES.closeButton}
            >
              <XMarkIcon className={HEADER_STYLES.closeIcon} aria-hidden="true" />
            </button>
          </div>

          {/* 본문 */}
          <div className={BODY_STYLES.wrapper}>
            <p id={ARIA_IDS.modalDescription} className={BODY_STYLES.message}>
              {message}
            </p>

            {/* 텍스트 입력 필드 */}
            {requireTextInput && (
              <div className={BODY_STYLES.inputWrapper}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={requireTextInput.placeholder}
                  disabled={isLoading}
                  autoComplete="off"
                  aria-invalid={!!errorMessage}
                  aria-describedby={errorMessage ? ARIA_IDS.inputError : undefined}
                  className={getInputClassName(!!errorMessage)}
                />
                {errorMessage && (
                  <p id={ARIA_IDS.inputError} className={INPUT_STYLES.errorText} role="alert">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className={FOOTER_STYLES.wrapper}>
            <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
              {resolvedCancelText}
            </Button>
            <Button
              variant={isDangerous ? 'danger' : 'primary'}
              onClick={handleConfirm}
              disabled={isLoading || !isValid}
              loading={isLoading}
            >
              {isLoading ? processingText : resolvedConfirmText}
            </Button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );

  // Portal을 사용하여 body에 직접 렌더링
  return ReactDOM.createPortal(modalContent, document.body);
};

export default ConfirmModal;
