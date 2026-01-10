/**
 * UNIQN Mobile - ToastManager 컴포넌트
 *
 * @description 토스트 알림 관리 컴포넌트
 * @version 1.0.0
 */

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toastStore';
import { Toast } from './Toast';

// ============================================================================
// Component
// ============================================================================

export function ToastManager() {
  const insets = useSafeAreaInsets();
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View
      className="absolute left-0 right-0 z-50 px-4"
      style={{ top: insets.top + 10, pointerEvents: 'box-none' }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </View>
  );
}

export default ToastManager;
