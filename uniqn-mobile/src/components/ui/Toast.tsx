/**
 * UNIQN Mobile - Toast 컴포넌트
 *
 * @description 알림 토스트 메시지
 * @version 2.1.0 - 아이콘 컴포넌트 적용 및 의존성 최적화
 */

import React, { useEffect, useCallback } from 'react';
import { View, Text, Pressable, AccessibilityInfo, Platform } from 'react-native';
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

/** 스크린리더가 읽는 접두. 영문 enum('error: …')을 그대로 읽히게 두지 않는다. */
const TOAST_TYPE_LABELS: Record<ToastType['type'], string> = {
  success: '완료',
  error: '오류',
  warning: '주의',
  info: '안내',
};

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
    translateY.value = withTiming(-20, { duration: 150, easing: Easing.ease }, (finished) => {
      if (finished) {
        runOnJS(callOnDismiss)(toast.id);
      }
    });
  }, [opacity, translateY, callOnDismiss, toast.id]);

  // iOS VoiceOver 는 RN 의 accessibilityLiveRegion 을 지원하지 않는다. 토스트가 이 탭의
  // 유일한 피드백 채널(취소 성공·딥링크 실패·사전 검증 경고)이라, 낭독이 없으면 시각장애
  // 사용자는 액션 성공 여부를 알 방법이 없다. OfflineStatusBar 와 동일한 경로로 명시 호출한다.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.announceForAccessibility(
      `${TOAST_TYPE_LABELS[toast.type] ?? '안내'}: ${toast.message}`
    );
  }, [toast.type, toast.message]);

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
        className={`flex-row items-center px-4 py-3 rounded-md shadow-lg ${style.container}`}
        accessibilityRole="alert"
        // Android 는 liveRegion 이 자동 낭독한다. iOS 는 RN liveRegion 미지원이라
        // 아래 useEffect 에서 announceForAccessibility 로 명시 호출한다(이중 낭독 방지).
        accessibilityLiveRegion={toast.type === 'error' ? 'assertive' : 'polite'}
        accessibilityLabel={`${TOAST_TYPE_LABELS[toast.type] ?? '안내'}: ${toast.message}`}
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
