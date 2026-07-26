/**
 * UNIQN Mobile - Toast 컴포넌트
 *
 * @description 알림 토스트 메시지
 * @version 2.1.0 - 아이콘 컴포넌트 적용 및 의존성 최적화
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@/components/icons';
import { MOTION_EASING, MOTION_DURATION } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';
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
    container: 'bg-success-600 dark:bg-success-700',
    IconComponent: CheckCircleIcon,
  },
  error: {
    container: 'bg-error-600 dark:bg-error-700',
    IconComponent: XCircleIcon,
  },
  warning: {
    container: 'bg-warning-500 dark:bg-warning-600',
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
  const reduceMotion = useReduceMotion();
  // reduceMotion 을 이펙트 deps 에 넣으면 비동기 resolve/OS 토글마다 입장 이펙트가
  // 재실행되어 자동닫기 타이머 재설정·퇴장 중 부활 글리치가 생긴다(2026-07-17 /review).
  // 마운트 시점 값은 프리페치 캐시(useReduceMotion)로 이미 올바르므로 ref 로만 읽는다.
  const reduceMotionRef = useRef(reduceMotion);
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);
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
    // 퇴장 애니메이션.
    // 완료 콜백(onDismiss)은 opacity 페이드에 건다 — opacity 는 양 모드에서 항상
    // 애니메이트되므로, reduce motion 으로 translateY 를 즉시 세팅해도 콜백이 유실되지 않는다.
    opacity.value = withTiming(
      0,
      { duration: MOTION_DURATION.fast, easing: MOTION_EASING.fade },
      (finished) => {
        if (finished) {
          runOnJS(callOnDismiss)(toast.id);
        }
      }
    );
    if (reduceMotionRef.current) {
      translateY.value = -20;
    } else {
      translateY.value = withTiming(-20, {
        duration: MOTION_DURATION.fast,
        easing: MOTION_EASING.fade,
      });
    }
  }, [opacity, translateY, callOnDismiss, toast.id]);

  useEffect(() => {
    // 입장 애니메이션 — reduce motion 은 마운트 시점 값(ref)만 읽는다(상단 주석 참조).
    opacity.value = withTiming(1, { duration: MOTION_DURATION.base, easing: MOTION_EASING.enter });
    if (reduceMotionRef.current) {
      // reduce motion: translate 는 즉시 목표값, opacity 페이드만 유지
      translateY.value = 0;
    } else {
      translateY.value = withTiming(0, {
        duration: MOTION_DURATION.base,
        easing: MOTION_EASING.enter,
      });
    }

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
        className={`flex-row items-center px-4 py-3 rounded-md shadow-lg ${style.container}`}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.type}: ${toast.message}`}
      >
        <View className="mr-3">
          <IconComponent size={20} color="#FFFFFF" />
        </View>
        <Text className="text-white text-sm flex-1 font-sans-medium">{toast.message}</Text>
        {/* 액션(되돌리기 등) — 스토어 계약 필드의 렌더 배선(S1 리뷰 HIGH-1). 본문 탭(dismiss)과
            터치 분리를 위해 내부 Pressable(외부는 role=alert라 중첩 button 하이드레이션 무해). */}
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              handleDismiss();
            }}
            hitSlop={8}
            className="ml-2 px-2.5 py-1.5 rounded-sm bg-white/20 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            testID="toast-action"
          >
            <Text className="text-white text-sm font-sans-bold">{toast.action.label}</Text>
          </Pressable>
        ) : null}
        <View className="ml-2 p-1">
          <XMarkIcon size={14} color="rgba(255, 255, 255, 0.8)" />
        </View>
      </Pressable>
    </Animated.View>
  );
}
