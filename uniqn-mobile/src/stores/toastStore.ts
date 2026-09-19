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
    // 중복 체크: 동일 message + type이 이미 표시 중이면 무시.
    //
    // ⚠️ `action` 토스트는 dedupe 대상이 아니다.
    // 되돌리기(Undo) 토스트의 정체성은 message+type 이 아니라 **onPress 클로저**다.
    // 예: 알림 삭제 토스트 메시지가 `'{제목}' 알림을 삭제했습니다.` 라, 제목이 같은
    // 그룹 알림 2건을 연속 삭제하면 두 번째가 dedupe 에 걸려 **되돌리기 어포던스가 통째로
    // 사라진다** — 삭제 커밋 타이머는 이미 돌고 있으므로 그대로 편도 삭제가 된다.
    // 메시지가 같아도 클로저가 다르면 다른 토스트이므로 둘 다 띄운다.
    //
    // 대신 지켜야 할 것: **action 토스트를 루프·재시도 경로에 넣지 말 것.**
    // dedupe 가 스팸을 접어 주던 경로(QR 연속 스캔 실패, 뮤테이션 에러 이중탭)는 전부
    // action 이 없는 토스트라 보호가 그대로 유지되지만, action 토스트에는 그 보호가 없다.
    // 현재 action 토스트 5곳은 전부 상류에 per-id 가드(pendingDeletesRef 등)가 있다.
    const isDuplicate =
      !toast.action &&
      get().toasts.some((t) => t.message === toast.message && t.type === toast.type);
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
