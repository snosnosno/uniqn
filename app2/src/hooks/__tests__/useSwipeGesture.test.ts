import { renderHook } from '@testing-library/react';
import { useSwipeGestureReact, useSwipeGesture } from '../useSwipeGesture';

describe('useSwipeGestureReact', () => {
  const mockCallbacks = {
    onSwipeLeft: jest.fn(),
    onSwipeRight: jest.fn(),
    onSwipeUp: jest.fn(),
    onSwipeDown: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns touch event handlers', () => {
    const { result } = renderHook(() => useSwipeGestureReact(mockCallbacks));

    expect(result.current.onTouchStart).toBeDefined();
    expect(result.current.onTouchMove).toBeDefined();
    expect(result.current.onTouchEnd).toBeDefined();
  });

  test('detects left swipe correctly', () => {
    const { result } = renderHook(() => useSwipeGestureReact(mockCallbacks));

    // Mock touch start event
    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    // Mock touch move event (moving left)
    const mockTouchMove = {
      targetTouches: [{ clientX: 40, clientY: 100 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeLeft).toHaveBeenCalled();
  });

  test('detects right swipe correctly', () => {
    const { result } = renderHook(() => useSwipeGestureReact(mockCallbacks));

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    const mockTouchMove = {
      targetTouches: [{ clientX: 160, clientY: 100 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeRight).toHaveBeenCalled();
  });

  test('detects up swipe correctly', () => {
    const { result } = renderHook(() => useSwipeGestureReact(mockCallbacks));

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    const mockTouchMove = {
      targetTouches: [{ clientX: 100, clientY: 40 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeUp).toHaveBeenCalled();
  });

  test('detects down swipe correctly', () => {
    const { result } = renderHook(() => useSwipeGestureReact(mockCallbacks));

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    const mockTouchMove = {
      targetTouches: [{ clientX: 100, clientY: 160 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeDown).toHaveBeenCalled();
  });

  test('respects minimum distance threshold', () => {
    const { result } = renderHook(() => 
      useSwipeGestureReact({ ...mockCallbacks, minDistance: 100 })
    );

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    // Short swipe (less than minDistance)
    const mockTouchMove = {
      targetTouches: [{ clientX: 80, clientY: 100 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeLeft).not.toHaveBeenCalled();
  });

  test('prioritizes vertical swipes over horizontal', () => {
    const { result } = renderHook(() => useSwipeGestureReact(mockCallbacks));

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    // Diagonal swipe with more vertical movement
    const mockTouchMove = {
      targetTouches: [{ clientX: 130, clientY: 40 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeUp).toHaveBeenCalled();
    expect(mockCallbacks.onSwipeRight).not.toHaveBeenCalled();
  });

  test('respects threshold for horizontal swipes', () => {
    const { result } = renderHook(() => 
      useSwipeGestureReact({ ...mockCallbacks, threshold: 5 })
    );

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    // Horizontal swipe with too much vertical movement
    const mockTouchMove = {
      targetTouches: [{ clientX: 40, clientY: 110 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeLeft).not.toHaveBeenCalled();
  });

  test('ignores swipe if no touch move occurred', () => {
    const { result } = renderHook(() => useSwipeGestureReact(mockCallbacks));

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchEnd();

    expect(mockCallbacks.onSwipeLeft).not.toHaveBeenCalled();
    expect(mockCallbacks.onSwipeRight).not.toHaveBeenCalled();
    expect(mockCallbacks.onSwipeUp).not.toHaveBeenCalled();
    expect(mockCallbacks.onSwipeDown).not.toHaveBeenCalled();
  });

  test('handles missing callbacks gracefully', () => {
    const { result } = renderHook(() => useSwipeGestureReact({}));

    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as any;

    const mockTouchMove = {
      targetTouches: [{ clientX: 40, clientY: 100 }]
    } as any;

    expect(() => {
      result.current.onTouchStart(mockTouchStart);
      result.current.onTouchMove(mockTouchMove);
      result.current.onTouchEnd();
    }).not.toThrow();
  });
});

describe('useSwipeGesture', () => {
  test('returns native event handlers', () => {
    const { result } = renderHook(() => useSwipeGesture({}));

    expect(result.current.onTouchStart).toBeDefined();
    expect(result.current.onTouchMove).toBeDefined();
    expect(result.current.onTouchEnd).toBeDefined();
    expect(typeof result.current.onTouchStart).toBe('function');
    expect(typeof result.current.onTouchMove).toBe('function');
    expect(typeof result.current.onTouchEnd).toBe('function');
  });

  test('handlers work with native TouchEvent objects', () => {
    const onSwipeLeft = jest.fn();
    const { result } = renderHook(() => useSwipeGesture({ onSwipeLeft }));

    // Mock native TouchEvent
    const mockTouchStart = {
      targetTouches: [{ clientX: 100, clientY: 100 }]
    } as unknown as TouchEvent;

    const mockTouchMove = {
      targetTouches: [{ clientX: 40, clientY: 100 }]
    } as unknown as TouchEvent;

    result.current.onTouchStart(mockTouchStart);
    result.current.onTouchMove(mockTouchMove);
    result.current.onTouchEnd();

    expect(onSwipeLeft).toHaveBeenCalled();
  });
});