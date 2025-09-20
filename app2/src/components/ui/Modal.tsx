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

  // 접근성 props
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * 단순하고 사용하기 쉬운 모달 컴포넌트
 * ESC 키 지원, 배경 클릭 닫기 지원
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
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

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


  // 키보드 이벤트 핸들러 (ESC 키만 처리)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (closeOnEsc && e.key === 'Escape') {
      handleEscKey(e);
    }
  }, [handleEscKey, closeOnEsc]);

  // 모달 열림/닫힘 처리
  useEffect(() => {
    if (isOpen) {
      // 키보드 이벤트 리스너 추가 (ESC 키만)
      document.addEventListener('keydown', handleKeyDown);

      // 스크롤 방지
      if (preventScroll) {
        document.body.style.overflow = 'hidden';
      }

      return () => {
        // 클린업
        document.removeEventListener('keydown', handleKeyDown);

        if (preventScroll) {
          document.body.style.overflow = '';
        }
      };
    }

    return undefined;
  }, [isOpen, handleKeyDown, preventScroll]);

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