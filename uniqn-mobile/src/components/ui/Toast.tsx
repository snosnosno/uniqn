/**
 * UNIQN Mobile - Toast 컴포넌트
 *
 * @description 알림 토스트 메시지
 * @version 2.1.0 - 아이콘 컴포넌트 적용 및 의존성 최적화
 */

import React, { useEffect, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@/components/icons';
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
    IconComponent: CheckCircleIcon,
  },
  error: {
    container: 'bg-red-600 dark:bg-red-700',
    IconComponent: XCircleIcon,
  },
  warning: {
    container: 'bg-yellow-500 dark:bg-yellow-600',
    IconComponent: ExclamationTriangleIcon,
  },
  info: {
    container: 'bg-primary-600 dark:bg-primary-700',
    IconComponent: InformationCircleIcon,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const IconComponent = style.IconComponent;

  return (
    <Animated.View style={animatedStyle} className="mb-2">
      <Pressable
        onPress={handleDismiss}
        className={`flex-row items-center px-4 py-3 rounded-xl shadow-lg ${style.container}`}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.type}: ${toast.message}`}
      >
        <View className="mr-3">
          <IconComponent size={20} color="#FFFFFF" />
        </View>
        <Text className="text-white text-sm flex-1 font-medium">
          {toast.message}
        </Text>
        <View className="ml-2 p-1">
          <XMarkIcon size={14} color="rgba(255, 255, 255, 0.8)" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default Toast;
