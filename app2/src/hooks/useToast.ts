import { useCallback } from 'react';
import { useToastStore, Toast } from '../stores/toastStore';

export const useToast = () => {
  const { addToast, removeToast, clearAllToasts } = useToastStore();

  // Convenience methods for different toast types - memoized to prevent infinite re-renders
  const showSuccess = useCallback(
    (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = {
        type: 'success',
        message,
      };
      if (title) toastData.title = title;
      if (duration) toastData.duration = duration;
      addToast(toastData);
    },
    [addToast]
  );

  const showError = useCallback(
    (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = {
        type: 'error',
        message,
        duration: duration || 5000, // Error messages stay longer by default
      };
      if (title) toastData.title = title;
      addToast(toastData);
    },
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = {
        type: 'info',
        message,
      };
      if (title) toastData.title = title;
      if (duration) toastData.duration = duration;
      addToast(toastData);
    },
    [addToast]
  );

  const showWarning = useCallback(
    (message: string, title?: string, duration?: number) => {
      const toastData: Omit<Toast, 'id'> = {
        type: 'warning',
        message,
      };
      if (title) toastData.title = title;
      if (duration) toastData.duration = duration;
      addToast(toastData);
    },
    [addToast]
  );

  // Generic method for custom toasts
  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      addToast(toast);
    },
    [addToast]
  );

  return {
    show,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeToast,
    clearAllToasts,
  };
};
