import { useToastContext, Toast } from '../contexts/ToastContext';

export const useToast = () => {
  const { addToast, removeToast, clearAllToasts } = useToastContext();

  // Convenience methods for different toast types
  const showSuccess = (message: string, title?: string, duration?: number) => {
    const toastData: Omit<Toast, 'id'> = {
      type: 'success',
      message,
    };
    if (title) toastData.title = title;
    if (duration) toastData.duration = duration;
    addToast(toastData);
  };

  const showError = (message: string, title?: string, duration?: number) => {
    const toastData: Omit<Toast, 'id'> = {
      type: 'error',
      message,
      duration: duration || 5000, // Error messages stay longer by default
    };
    if (title) toastData.title = title;
    addToast(toastData);
  };

  const showInfo = (message: string, title?: string, duration?: number) => {
    const toastData: Omit<Toast, 'id'> = {
      type: 'info',
      message,
    };
    if (title) toastData.title = title;
    if (duration) toastData.duration = duration;
    addToast(toastData);
  };

  const showWarning = (message: string, title?: string, duration?: number) => {
    const toastData: Omit<Toast, 'id'> = {
      type: 'warning',
      message,
    };
    if (title) toastData.title = title;
    if (duration) toastData.duration = duration;
    addToast(toastData);
  };

  // Generic method for custom toasts
  const show = (toast: Omit<Toast, 'id'>) => {
    addToast(toast);
  };

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