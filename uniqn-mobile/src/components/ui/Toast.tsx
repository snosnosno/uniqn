/**
 * UNIQN Mobile - Toast 컴포넌트
 *
 * @description 알림 토스트 메시지
 * @version 2.0.0 - Reanimated 마이그레이션
 */

import React, { useEffect, useCallback } from 'react';
import { Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { Toast as ToastType } from '@/stores/toastStore';

// ============================================================================
// Types
// ============================================================================

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const TOAST_STYLES = {
  success: {
    container: 'bg-green-600 dark:bg-green-700',
    icon: '✓',
  },
  error: {
    container: 'bg-red-600 dark:bg-red-700',
    icon: '✕',
  },
  warning: {
    container: 'bg-yellow-500 dark:bg-yellow-600',
    icon: '⚠',
  },
  info: {
    container: 'bg-blue-600 dark:bg-blue-700',
    icon: 'ℹ',
  },
};

// ============================================================================
// Component
// ============================================================================

export function Toast({ toast, onDismiss }: ToastProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  const style = TOAST_STYLES[toast.type];

  // JS 콜백을 워크렛에서 호출하기 위한 래퍼
  const callOnDismiss = useCallback(
    (id: string) => {
      onDismiss(id);
    },
    [onDismiss]
  );

  const handleDismiss = useCallback(() => {
    // 퇴장 애니메이션
    opacity.value = withTiming(0, { duration: 150, easing: Easing.ease });
    translateY.value = withTiming(
      -20,
      { duration: 150, easing: Easing.ease },
      (finished) => {
        if (finished) {
          runOnJS(callOnDismiss)(toast.id);
        }
      }
    );
  }, [opacity, translateY, callOnDismiss, toast.id]);

  useEffect(() => {
    // 입장 애니메이션
    opacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
    translateY.value = withTiming(0, { duration: 200, easing: Easing.ease });

    // 자동 닫기
    const timer = setTimeout(() => {
      handleDismiss();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, opacity, translateY, handleDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle} className="mb-2">
      <Pressable
        onPress={handleDismiss}
        className={`flex-row items-center px-4 py-3 rounded-xl shadow-lg ${style.container}`}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.type}: ${toast.message}`}
      >
        <Text className="text-white text-lg mr-3">{style.icon}</Text>
        <Text className="text-white text-sm flex-1 font-medium">
          {toast.message}
        </Text>
        <Text className="text-white/80 text-xs ml-2">✕</Text>
      </Pressable>
    </Animated.View>
  );
}

export default Toast;
