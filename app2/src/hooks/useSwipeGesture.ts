import { useRef, useCallback, useEffect } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  threshold?: number;
}

interface TouchCoordinates {
  x: number;
  y: number;
}

/**
 * 터치 기반 스와이프 제스처를 처리하는 커스텀 훅
 * 모바일 디바이스에서 카드 및 리스트 인터랙션을 위한 스와이프 감지
 */
export const useSwipeGesture = (options: SwipeGestureOptions) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 50,
    threshold = 10,
  } = options;

  const touchStart = useRef<TouchCoordinates | null>(null);
  const touchEnd = useRef<TouchCoordinates | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchEnd.current = null;
    const firstTouch = e.targetTouches[0];
    if (firstTouch) {
      touchStart.current = {
        x: firstTouch.clientX,
        y: firstTouch.clientY,
      };
    }
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const firstTouch = e.targetTouches[0];
    if (firstTouch) {
      touchEnd.current = {
        x: firstTouch.clientX,
        y: firstTouch.clientY,
      };
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const distanceX = touchStart.current.x - touchEnd.current.x;
    const distanceY = touchStart.current.y - touchEnd.current.y;
    const isLeftSwipe = distanceX > minDistance;
    const isRightSwipe = distanceX < -minDistance;
    const isUpSwipe = distanceY > minDistance;
    const isDownSwipe = distanceY < -minDistance;

    // 수직 스와이프가 수평 스와이프보다 우선순위를 가짐
    if (Math.abs(distanceY) > Math.abs(distanceX)) {
      if (isUpSwipe && onSwipeUp) {
        onSwipeUp();
      } else if (isDownSwipe && onSwipeDown) {
        onSwipeDown();
      }
    } else {
      // 수평 스와이프 처리 (약간의 수직 이동은 허용)
      if (Math.abs(distanceY) < threshold) {
        if (isLeftSwipe && onSwipeLeft) {
          onSwipeLeft();
        } else if (isRightSwipe && onSwipeRight) {
          onSwipeRight();
        }
      }
    }
  }, [minDistance, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};

/**
 * React 이벤트 핸들러용 스와이프 제스처 훅
 * 컴포넌트에서 직접 사용하기 위한 React 이벤트 래퍼
 */
export const useSwipeGestureReact = (options: SwipeGestureOptions) => {
  const touchStart = useRef<TouchCoordinates | null>(null);
  const touchEnd = useRef<TouchCoordinates | null>(null);

  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    minDistance = 50,
    threshold = 10,
  } = options;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchEnd.current = null;
    const firstTouch = e.targetTouches[0];
    if (firstTouch) {
      touchStart.current = {
        x: firstTouch.clientX,
        y: firstTouch.clientY,
      };
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const firstTouch = e.targetTouches[0];
    if (firstTouch) {
      touchEnd.current = {
        x: firstTouch.clientX,
        y: firstTouch.clientY,
      };
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const distanceX = touchStart.current.x - touchEnd.current.x;
    const distanceY = touchStart.current.y - touchEnd.current.y;
    const isLeftSwipe = distanceX > minDistance;
    const isRightSwipe = distanceX < -minDistance;
    const isUpSwipe = distanceY > minDistance;
    const isDownSwipe = distanceY < -minDistance;

    if (Math.abs(distanceY) > Math.abs(distanceX)) {
      if (isUpSwipe && onSwipeUp) {
        onSwipeUp();
      } else if (isDownSwipe && onSwipeDown) {
        onSwipeDown();
      }
    } else {
      if (Math.abs(distanceY) < threshold) {
        if (isLeftSwipe && onSwipeLeft) {
          onSwipeLeft();
        } else if (isRightSwipe && onSwipeRight) {
          onSwipeRight();
        }
      }
    }
  }, [minDistance, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};

/**
 * DOM 요소에 직접 바인딩하는 스와이프 훅
 * useEffect와 함께 사용하여 특정 DOM 요소에 이벤트 리스너 추가
 */
export const useSwipeGestureDOM = (
  elementRef: React.RefObject<HTMLElement>,
  options: SwipeGestureOptions
) => {
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture(options);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [elementRef, onTouchStart, onTouchMove, onTouchEnd]);
};
