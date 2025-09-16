/**
 * Toast 유틸리티
 * alert() 대체용 통합 토스트 시스템
 * 
 * @example
 * // alert('성공!') 대신
 * toast.success('성공!');
 * 
 * // alert('오류 발생') 대신  
 * toast.error('오류 발생');
 */

import { useToastStore } from '../stores/toastStore';

/**
 * 전역 토스트 유틸리티 객체
 * useToast 훅 없이도 어디서든 사용 가능
 */
export const toast = {
  /**
   * 성공 메시지 표시
   */
  success: (message: string, title?: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    const toastData: any = {
      type: 'success',
      message,
      duration: duration || 3000
    };
    if (title) toastData.title = title;
    addToast(toastData);
  },

  /**
   * 에러 메시지 표시
   */
  error: (message: string, title?: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    const toastData: any = {
      type: 'error',
      message,
      duration: duration || 5000 // 에러는 더 오래 표시
    };
    if (title) toastData.title = title;
    addToast(toastData);
  },

  /**
   * 경고 메시지 표시
   */
  warning: (message: string, title?: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    const toastData: any = {
      type: 'warning',
      message,
      duration: duration || 4000
    };
    if (title) toastData.title = title;
    addToast(toastData);
  },

  /**
   * 정보 메시지 표시
   */
  info: (message: string, title?: string, duration?: number) => {
    const { addToast } = useToastStore.getState();
    const toastData: any = {
      type: 'info',
      message,
      duration: duration || 3000
    };
    if (title) toastData.title = title;
    addToast(toastData);
  },

  /**
   * 모든 토스트 제거
   */
  clear: () => {
    const { clearAllToasts } = useToastStore.getState();
    clearAllToasts();
  }
};

/**
 * alert() 대체 함수
 * 기존 alert() 코드를 최소한으로 수정하여 사용 가능
 * 
 * @deprecated alert() 사용을 지양하고 toast.success/error/warning/info 사용 권장
 * @example
 * // 기존: alert('메시지');
 * // 변경: alertToast('메시지');
 */
export const alertToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  toast[type](message);
};

export default toast;