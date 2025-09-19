import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;

  // 구조적 props
  title?: React.ReactNode;
  footer?: React.ReactNode;

  // 스타일 props
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  centered?: boolean;

  // 동작 props
  closeOnEsc?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  preventScroll?: boolean;
  autoFocus?: boolean;
  disableFocusTrap?: boolean;

  // 접근성 props
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * 접근성과 사용성을 고려한 모달 컴포넌트
 * 포커스 트랩, ESC 키 지원, 배경 클릭 닫기 지원
 */
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  footer,
  size = 'md',
  centered = true,
  closeOnEsc = true,
  closeOnBackdrop = true,
  showCloseButton = true,
  preventScroll = true,
  autoFocus = true,
  disableFocusTrap = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // 크기 스타일
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  // 위치 스타일
  const positionClasses = centered
    ? 'min-h-screen flex items-center justify-center'
    : 'min-h-screen flex items-start justify-center pt-20';

  // ESC 키 핸들러
  const handleEscKey = useCallback((e: KeyboardEvent) => {
    if (closeOnEsc && e.key === 'Escape') {
      onClose();
    }
  }, [closeOnEsc, onClose]);

  // 배경 클릭 핸들러
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  // 포커스 트랩 구현 (textarea/input 편집 중에는 완전 비활성화)
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (!modalRef.current) return;

    // textarea나 input이 포커스되어 있는 경우 포커스 트랩 완전 비활성화
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      // 모든 텍스트 입력 요소에서 포커스 트랩 비활성화
      return;
    }

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (!e.shiftKey && document.activeElement === lastElement) {
      firstElement?.focus();
      e.preventDefault();
    }

    if (e.shiftKey && document.activeElement === firstElement) {
      lastElement?.focus();
      e.preventDefault();
    }
  }, []);

  // 키보드 이벤트 핸들러 (텍스트 입력 중에는 완전 비활성화)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 포커스 트랩이 비활성화된 경우 ESC 키만 처리
    if (disableFocusTrap) {
      if (closeOnEsc && e.key === 'Escape') {
        handleEscKey(e);
      }
      return; // 포커스 트랩 비활성화 시 다른 키 이벤트 무시
    }

    // 텍스트 입력 요소가 포커스되어 있으면 모든 키보드 이벤트 무시
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'INPUT' ||
      (activeElement as HTMLElement).contentEditable === 'true'
    )) {
      return; // 텍스트 입력 중에는 모든 키보드 이벤트 무시
    }

    // IME 구성 중인지 확인 (한글 입력 중)
    if ((e as any).isComposing) {
      return; // IME 입력 중에는 모든 키보드 이벤트 무시
    }

    if (e.key === 'Tab') {
      handleTabKey(e);
    }
    if (closeOnEsc) {
      handleEscKey(e);
    }
  }, [handleTabKey, handleEscKey, closeOnEsc, disableFocusTrap]);

  // 모달 열림/닫힘 처리
  useEffect(() => {
    if (isOpen) {
      // 이전 포커스 요소 저장
      previousActiveElement.current = document.activeElement as HTMLElement;

      // 키보드 이벤트 리스너 추가
      document.addEventListener('keydown', handleKeyDown);

      // 스크롤 방지
      if (preventScroll) {
        document.body.style.overflow = 'hidden';
      }

      // 자동 포커스 설정 (포커스 트랩이 활성화된 경우에만)
      if (autoFocus && !disableFocusTrap && modalRef.current) {
        setTimeout(() => {
          // 현재 활성 요소가 입력 요소인지 확인
          const activeElement = document.activeElement;
          const isInputElement = activeElement && (
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'INPUT' ||
            (activeElement as HTMLElement).contentEditable === 'true'
          );

          // 입력 요소가 포커스되어 있지 않은 경우에만 모달에 포커스
          if (!isInputElement && modalRef.current) {
            // 첫 번째 포커스 가능한 요소를 찾아 포커스
            const focusableElement = modalRef.current.querySelector<HTMLElement>(
              'textarea, input[type="text"], input[type="email"], input[type="password"], button:not([disabled])'
            );

            if (focusableElement) {
              focusableElement.focus();
            } else {
              modalRef.current.focus();
            }
          }
        }, 150); // 지연시간을 늘려서 다른 컴포넌트 초기화 완료 대기
      }

      return () => {
        // 클린업
        document.removeEventListener('keydown', handleKeyDown);

        if (preventScroll) {
          document.body.style.overflow = '';
        }

        // 이전 포커스 복원
        previousActiveElement.current?.focus();
      };
    }

    return undefined;
  }, [isOpen, handleKeyDown, preventScroll, autoFocus, disableFocusTrap]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={ariaDescribedBy}
      aria-modal="true"
      role="dialog"
    >
      {/* 배경 오버레이 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        aria-hidden="true"
      />

      {/* 모달 컨테이너 */}
      <div 
        className={positionClasses}
        onClick={handleBackdropClick}
      >
        <div
          ref={modalRef}
          className={`relative bg-white rounded-lg shadow-xl transform transition-all w-full ${sizeClasses[size]} animate-fade-in`}
          tabIndex={-1}
          aria-label={ariaLabel || (typeof title === 'string' ? title : undefined)}
        >
          {/* 헤더 */}
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between p-4 border-b border-gray-200">
              {title && (
                typeof title === 'string' ? (
                  <h3 id="modal-title" className="text-lg font-semibold text-gray-900">
                    {title}
                  </h3>
                ) : (
                  <div id="modal-title">{title}</div>
                )
              )}
              {showCloseButton && (
                <button
                  type="button"
                  className="ml-auto bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 p-1"
                  onClick={onClose}
                  aria-label="닫기"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* 바디 */}
          <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto">
            {children}
          </div>

          {/* 푸터 */}
          {footer && (
            <div className="flex items-center justify-end space-x-2 p-4 border-t border-gray-200">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Portal을 사용하여 body에 직접 렌더링
  return ReactDOM.createPortal(
    modalContent,
    document.body
  );
};

/**
 * 모달 헤더 컴포넌트
 */
export const ModalHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </div>
  );
};

/**
 * 모달 바디 컴포넌트
 */
export const ModalBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`text-gray-700 ${className}`}>
      {children}
    </div>
  );
};

/**
 * 모달 푸터 컴포넌트
 */
export const ModalFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`flex items-center justify-end space-x-2 ${className}`}>
      {children}
    </div>
  );
};

export default Modal;