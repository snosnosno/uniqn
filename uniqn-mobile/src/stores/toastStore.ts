/**
 * UNIQN Mobile - Toast Store
 *
 * @description 토스트 알림 상태 관리 (Zustand)
 * @version 1.0.0
 */

import { create } from 'zustand';
import { generateId } from '@/utils/generateId';

// ============================================================================
// Types
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  // 편의 메서드
  success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void;
  error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void;
  warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void;
  info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DURATION = 3000; // 3초
const MAX_TOASTS = 3;

// ============================================================================
// Store
// ============================================================================

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    // 중복 체크: 동일 message + type이 이미 표시 중이면 무시
    const isDuplicate = get().toasts.some(
      (t) => t.message === toast.message && t.type === toast.type
    );
    if (isDuplicate) return;

    const id = generateId();
    const newToast: Toast = {
      id,
      duration: DEFAULT_DURATION,
      ...toast,
    };

    set((state) => {
      // 최대 개수 제한
      const toasts =
        state.toasts.length >= MAX_TOASTS
          ? [...state.toasts.slice(1), newToast]
          : [...state.toasts, newToast];
      return { toasts };
    });

    // 자동 제거 타이머
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAllToasts: () => {
    set({ toasts: [] });
  },

  // 편의 메서드들
  success: (message, options) => {
    get().addToast({ type: 'success', message, ...options });
  },

  error: (message, options) => {
    get().addToast({
      type: 'error',
      message,
      duration: 5000, // 에러는 더 오래 표시
      ...options,
    });
  },

  warning: (message, options) => {
    get().addToast({ type: 'warning', message, ...options });
  },

  info: (message, options) => {
    get().addToast({ type: 'info', message, ...options });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectToasts = (state: ToastState) => state.toasts;
export const selectHasToasts = (state: ToastState) => state.toasts.length > 0;

// ============================================================================
// Hook for components
// ============================================================================

/**
 * 토스트 표시용 훅
 * @example
 * const toast = useToast();
 * toast.success('저장되었습니다');
 * toast.error('오류가 발생했습니다');
 */
export const useToast = () => {
  const { success, error, warning, info, addToast } = useToastStore();
  return { success, error, warning, info, show: addToast };
};

export default useToastStore;
