/**
 * UNIQN Mobile - Toast Store Tests
 *
 * @description Tests for toast notification state management (Zustand)
 */

import { act } from '@testing-library/react-native';
import { useToastStore, selectToasts, selectHasToasts } from '../toastStore';

// Mock generateId to return deterministic IDs
let mockIdCounter = 0;
jest.mock('@/utils/generateId', () => ({
  generateId: jest.fn(() => `mock-id-${++mockIdCounter}`),
}));

describe('ToastStore', () => {
  beforeEach(() => {
    mockIdCounter = 0;
    jest.useFakeTimers();
    act(() => {
      useToastStore.getState().clearAllToasts();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('should start with empty toasts', () => {
      expect(useToastStore.getState().toasts).toEqual([]);
    });
  });

  // ============================================================================
  // addToast
  // ============================================================================

  describe('addToast', () => {
    it('should add a toast with generated id and default duration', () => {
      act(() => {
        useToastStore.getState().addToast({
          type: 'success',
          message: '저장되었습니다',
        });
      });

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toBe('저장되었습니다');
      expect(toasts[0].id).toBeDefined();
      expect(toasts[0].duration).toBe(3000);
    });

    it('should add toast with custom duration', () => {
      act(() => {
        useToastStore.getState().addToast({
          type: 'info',
          message: '안내',
          duration: 5000,
        });
      });

      expect(useToastStore.getState().toasts[0].duration).toBe(5000);
    });

    it('should add toast with title', () => {
      act(() => {
        useToastStore.getState().addToast({
          type: 'warning',
          message: '내용',
          title: '경고 제목',
        });
      });

      expect(useToastStore.getState().toasts[0].title).toBe('경고 제목');
    });

    it('should add toast with action', () => {
      const onPress = jest.fn();
      act(() => {
        useToastStore.getState().addToast({
          type: 'info',
          message: '실행취소 가능',
          action: { label: '실행취소', onPress },
        });
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.action?.label).toBe('실행취소');
      expect(toast.action?.onPress).toBe(onPress);
    });

    it('should prevent duplicate toasts (same message + type)', () => {
      act(() => {
        useToastStore.getState().addToast({
          type: 'success',
          message: '중복 메시지',
        });
      });

      act(() => {
        useToastStore.getState().addToast({
          type: 'success',
          message: '중복 메시지',
        });
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });

    it('should allow same message with different type', () => {
      act(() => {
        useToastStore.getState().addToast({
          type: 'success',
          message: '같은 메시지',
        });
      });

      act(() => {
        useToastStore.getState().addToast({
          type: 'error',
          message: '같은 메시지',
        });
      });

      expect(useToastStore.getState().toasts).toHaveLength(2);
    });

    it('should limit to MAX_TOASTS (3)', () => {
      act(() => {
        useToastStore.getState().addToast({ type: 'info', message: '첫번째' });
      });
      act(() => {
        useToastStore.getState().addToast({ type: 'success', message: '두번째' });
      });
      act(() => {
        useToastStore.getState().addToast({ type: 'warning', message: '세번째' });
      });
      act(() => {
        useToastStore.getState().addToast({ type: 'error', message: '네번째' });
      });

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(3);
      // First toast should be removed, keeping the latter 3
      expect(toasts[0].message).toBe('두번째');
      expect(toasts[2].message).toBe('네번째');
    });

    it('should auto-remove toast after duration', () => {
      act(() => {
        useToastStore.getState().addToast({
          type: 'success',
          message: '자동 제거',
          duration: 3000,
        });
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('should not auto-remove toast with zero duration', () => {
      act(() => {
        useToastStore.getState().addToast({
          type: 'error',
          message: '수동 제거 필요',
          duration: 0,
        });
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  // ============================================================================
  // removeToast
  // ============================================================================

  describe('removeToast', () => {
    it('should remove toast by id', () => {
      act(() => {
        useToastStore.getState().addToast({ type: 'info', message: 'A' });
      });
      act(() => {
        useToastStore.getState().addToast({ type: 'success', message: 'B' });
      });

      const toastId = useToastStore.getState().toasts[0].id;

      act(() => {
        useToastStore.getState().removeToast(toastId);
      });

      const { toasts } = useToastStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('B');
    });

    it('should do nothing for non-existent id', () => {
      act(() => {
        useToastStore.getState().addToast({ type: 'info', message: 'A' });
      });

      act(() => {
        useToastStore.getState().removeToast('non-existent');
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  // ============================================================================
  // clearAllToasts
  // ============================================================================

  describe('clearAllToasts', () => {
    it('should remove all toasts', () => {
      act(() => {
        useToastStore.getState().addToast({ type: 'info', message: 'A' });
      });
      act(() => {
        useToastStore.getState().addToast({ type: 'success', message: 'B' });
      });

      act(() => {
        useToastStore.getState().clearAllToasts();
      });

      expect(useToastStore.getState().toasts).toEqual([]);
    });
  });

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  describe('Convenience Methods', () => {
    it('should add success toast', () => {
      act(() => {
        useToastStore.getState().success('성공!');
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.type).toBe('success');
      expect(toast.message).toBe('성공!');
    });

    it('should add error toast with longer duration', () => {
      act(() => {
        useToastStore.getState().error('실패!');
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.type).toBe('error');
      expect(toast.message).toBe('실패!');
      expect(toast.duration).toBe(5000);
    });

    it('should add warning toast', () => {
      act(() => {
        useToastStore.getState().warning('경고!');
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.type).toBe('warning');
      expect(toast.message).toBe('경고!');
    });

    it('should add info toast', () => {
      act(() => {
        useToastStore.getState().info('안내');
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.type).toBe('info');
      expect(toast.message).toBe('안내');
    });

    it('should accept options in convenience methods', () => {
      act(() => {
        useToastStore.getState().success('성공', { title: '완료' });
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.title).toBe('완료');
    });

    it('should allow custom duration override for error', () => {
      act(() => {
        useToastStore.getState().error('에러', { duration: 10000 });
      });

      const toast = useToastStore.getState().toasts[0];
      expect(toast.duration).toBe(10000);
    });
  });

  // ============================================================================
  // Selectors
  // ============================================================================

  describe('Selectors', () => {
    it('selectToasts should return toasts array', () => {
      act(() => {
        useToastStore.getState().addToast({ type: 'info', message: 'Test' });
      });

      const state = useToastStore.getState();
      expect(selectToasts(state)).toHaveLength(1);
    });

    it('selectHasToasts should return true when toasts exist', () => {
      act(() => {
        useToastStore.getState().addToast({ type: 'info', message: 'Test' });
      });

      expect(selectHasToasts(useToastStore.getState())).toBe(true);
    });

    it('selectHasToasts should return false when no toasts', () => {
      expect(selectHasToasts(useToastStore.getState())).toBe(false);
    });
  });
});
