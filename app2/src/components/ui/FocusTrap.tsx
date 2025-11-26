import React, { useEffect, useRef } from 'react';

interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  returnFocus?: boolean;
}

/**
 * 포커스 트랩 컴포넌트
 * 모달, 드롭다운 등에서 키보드 네비게이션 제한
 * WCAG 2.1 AA 접근성 준수
 */
const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  active = true,
  className = '',
  returnFocus = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // 이전 포커스 요소 저장
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // 포커스 가능한 요소 선택자
    const focusableSelectors = [
      'a[href]:not([disabled])',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    // 포커스 가능한 요소 찾기
    const getFocusableElements = () => {
      const elements = container.querySelectorAll(focusableSelectors);
      return Array.from(elements) as HTMLElement[];
    };

    // 첫 번째 요소에 포커스
    const focusFirstElement = () => {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        const firstElement = elements[0];
        if (firstElement) {
          firstElement.focus();
        }
      }
    };

    // 마지막 요소에 포커스 - 향후 필요시 사용 예정
    // const focusLastElement = () => {
    //   const elements = getFocusableElements();
    //   if (elements.length > 0) {
    //     const lastElement = elements[elements.length - 1];
    //     if (lastElement) {
    //       lastElement.focus();
    //     }
    //   }
    // };

    // Tab 키 핸들러
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!firstElement || !lastElement) return;

      // Shift + Tab
      if (e.shiftKey) {
        if (activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      }
      // Tab
      else {
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // 초기 포커스 설정
    setTimeout(() => {
      focusFirstElement();
    }, 0);

    // 이벤트 리스너 등록
    container.addEventListener('keydown', handleKeyDown);

    // 클린업
    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // 이전 포커스로 복귀
      if (returnFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, returnFocus]);

  if (!active) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default FocusTrap;
