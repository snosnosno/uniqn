import { renderHook, act } from '@testing-library/react';
import { useHapticFeedback } from '../useHapticFeedback';

// Mock navigator.vibrate
const mockVibrate = jest.fn();

Object.defineProperty(navigator, 'vibrate', {
  writable: true,
  value: mockVibrate
});

describe('useHapticFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns all feedback functions', () => {
    const { result } = renderHook(() => useHapticFeedback());

    expect(result.current.lightImpact).toBeDefined();
    expect(result.current.mediumImpact).toBeDefined();
    expect(result.current.heavyImpact).toBeDefined();
    expect(result.current.successFeedback).toBeDefined();
    expect(result.current.errorFeedback).toBeDefined();
    expect(result.current.warningFeedback).toBeDefined();
    expect(result.current.selectionFeedback).toBeDefined();
    expect(result.current.isSupported).toBeDefined();
  });

  test('lightImpact calls vibrate with correct pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.lightImpact();
    });

    expect(mockVibrate).toHaveBeenCalledWith(10);
  });

  test('mediumImpact calls vibrate with correct pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.mediumImpact();
    });

    expect(mockVibrate).toHaveBeenCalledWith(25);
  });

  test('heavyImpact calls vibrate with correct pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.heavyImpact();
    });

    expect(mockVibrate).toHaveBeenCalledWith([50, 20, 50]);
  });

  test('successFeedback calls vibrate with correct pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.successFeedback();
    });

    expect(mockVibrate).toHaveBeenCalledWith([10, 50, 10]);
  });

  test('errorFeedback calls vibrate with correct pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.errorFeedback();
    });

    expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100, 50, 100]);
  });

  test('warningFeedback calls vibrate with correct pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.warningFeedback();
    });

    expect(mockVibrate).toHaveBeenCalledWith([50, 100, 50]);
  });

  test('selectionFeedback calls vibrate with correct pattern', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.selectionFeedback();
    });

    expect(mockVibrate).toHaveBeenCalledWith(15);
  });

  test('isSupported returns true when vibrate API is available', () => {
    const { result } = renderHook(() => useHapticFeedback());

    expect(result.current.isSupported).toBe(true);
  });

  test('handles missing vibrate API gracefully', () => {
    // Mock navigator without vibrate
    const originalVibrate = navigator.vibrate;
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: undefined
    });

    const { result } = renderHook(() => useHapticFeedback());

    expect(result.current.isSupported).toBe(false);

    // Should not throw when calling feedback functions
    expect(() => {
      result.current.lightImpact();
      result.current.mediumImpact();
      result.current.heavyImpact();
      result.current.successFeedback();
      result.current.errorFeedback();
      result.current.warningFeedback();
      result.current.selectionFeedback();
    }).not.toThrow();

    // Restore vibrate
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: originalVibrate
    });
  });

  test('feedback functions are stable across renders', () => {
    const { result, rerender } = renderHook(() => useHapticFeedback());

    const firstRenderFunctions = {
      lightImpact: result.current.lightImpact,
      mediumImpact: result.current.mediumImpact,
      heavyImpact: result.current.heavyImpact,
      successFeedback: result.current.successFeedback,
      errorFeedback: result.current.errorFeedback,
      warningFeedback: result.current.warningFeedback,
      selectionFeedback: result.current.selectionFeedback
    };

    rerender();

    expect(result.current.lightImpact).toBe(firstRenderFunctions.lightImpact);
    expect(result.current.mediumImpact).toBe(firstRenderFunctions.mediumImpact);
    expect(result.current.heavyImpact).toBe(firstRenderFunctions.heavyImpact);
    expect(result.current.successFeedback).toBe(firstRenderFunctions.successFeedback);
    expect(result.current.errorFeedback).toBe(firstRenderFunctions.errorFeedback);
    expect(result.current.warningFeedback).toBe(firstRenderFunctions.warningFeedback);
    expect(result.current.selectionFeedback).toBe(firstRenderFunctions.selectionFeedback);
  });

  test('multiple quick calls to feedback functions work correctly', () => {
    const { result } = renderHook(() => useHapticFeedback());

    act(() => {
      result.current.lightImpact();
      result.current.lightImpact();
      result.current.mediumImpact();
    });

    expect(mockVibrate).toHaveBeenCalledTimes(3);
    expect(mockVibrate).toHaveBeenNthCalledWith(1, 10);
    expect(mockVibrate).toHaveBeenNthCalledWith(2, 10);
    expect(mockVibrate).toHaveBeenNthCalledWith(3, 25);
  });
});