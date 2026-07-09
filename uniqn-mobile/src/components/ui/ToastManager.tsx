/**
 * UNIQN Mobile - ToastManager 컴포넌트
 *
 * @description 토스트 알림 관리 컴포넌트
 * @version 1.1.0 - 웹 포탈 + Modal(zIndex 9999) 위로 올라오도록 zIndex 10000 적용
 */

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/stores/toastStore';
import { isWeb } from '@/utils/platform';
import { Toast } from './Toast';
import { WebPortal } from './WebPortal';

// ============================================================================
// Component
// ============================================================================

/**
 * 토스트 매니저
 *
 * 웹: WebPortal 로 document.body 에 렌더 + zIndex 10000 (Modal 9999 위)
 * 네이티브: 기존 absolute 포지션 유지. 네이티브 RNModal 위 표시는 별도 구조 필요.
 */
export function ToastManager() {
  const insets = useSafeAreaInsets();
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) {
    return null;
  }

  const items = toasts.map((toast) => (
    <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
  ));

  if (isWeb) {
    return (
      <WebPortal>
        <View
          className="left-0 right-0 px-4"
          style={[
            { top: insets.top + 10, pointerEvents: 'box-none' },
            // @ts-expect-error - 웹 전용 스타일 (RN View 타입엔 position:'fixed'/zIndex 10000 범위 없음)
            { position: 'fixed', zIndex: 10000 },
          ]}
        >
          {items}
        </View>
      </WebPortal>
    );
  }

  return (
    <View
      className="absolute left-0 right-0 z-50 px-4"
      style={{ top: insets.top + 10, pointerEvents: 'box-none' }}
    >
      {items}
    </View>
  );
}
