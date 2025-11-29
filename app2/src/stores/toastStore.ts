import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number; // Duration in milliseconds, 0 means no auto dismiss
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

export const useToastStore = create<ToastState>()(
  devtools(
    (set, get) => ({
      toasts: [],

      addToast: (toastData) => {
        const id = Math.random().toString(36).substr(2, 9);
        const toast: Toast = {
          id,
          duration: 4000, // Default 4 seconds
          ...toastData,
        };

        set((state) => ({
          toasts: [...state.toasts, toast],
        }));

        // Auto dismiss if duration is not 0
        if (toast.duration && toast.duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, toast.duration);
        }
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
      },

      clearAllToasts: () => {
        set({ toasts: [] });
      },
    }),
    {
      name: 'toast-storage',
    }
  )
);

// NOTE: useToast hook은 hooks/useToast.ts에서 import하세요
// import { useToast } from '../hooks/useToast';
