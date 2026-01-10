/**
 * UNIQN Mobile - Toast 컴포넌트
 *
 * @description 알림 토스트 메시지
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { Text, Pressable, Animated, Platform } from 'react-native';
import type { Toast as ToastType } from '@/stores/toastStore';

// react-native-web에서는 native driver를 지원하지 않음
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

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
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-20)).current;

  const style = TOAST_STYLES[toast.type];

  useEffect(() => {
    // 입장 애니메이션
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    // 자동 닫기
    const timer = setTimeout(() => {
      handleDismiss();
    }, toast.duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration]); // Animated.Value refs는 의도적으로 제외

  const handleDismiss = () => {
    // 퇴장 애니메이션
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 150,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY }],
      }}
      className="mb-2"
    >
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
