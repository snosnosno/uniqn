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

// Helper hooks for easier usage
export const useToast = () => {
  const { addToast } = useToastStore();

  return {
    showSuccess: (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = { type: 'success', message };
      if (title !== undefined) toastData.title = title;
      if (duration !== undefined) toastData.duration = duration;
      addToast(toastData);
    },
    showError: (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = { 
        type: 'error', 
        message,
        duration: duration || 5000 // Error messages stay longer by default
      };
      if (title !== undefined) toastData.title = title;
      addToast(toastData);
    },
    showInfo: (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = { type: 'info', message };
      if (title !== undefined) toastData.title = title;
      if (duration !== undefined) toastData.duration = duration;
      addToast(toastData);
    },
    showWarning: (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = { type: 'warning', message };
      if (title !== undefined) toastData.title = title;
      if (duration !== undefined) toastData.duration = duration;
      addToast(toastData);
    },
  };
};