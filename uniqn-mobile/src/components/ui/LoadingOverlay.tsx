/**
 * UNIQN Mobile - LoadingOverlay 컴포넌트
 *
 * @description 전체 화면 로딩 오버레이
 * @version 2.0.0
 *
 * 주요 기능:
 * - Reanimated 애니메이션 (fade/scale)
 * - 진행률 표시 옵션
 */

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, Modal, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

// ============================================================================
// Types
// ============================================================================

interface LoadingOverlayProps {
  /** 표시 여부 */
  visible: boolean;
  /** 로딩 메시지 */
  message?: string;
  /** 오버레이 배경 투명도 (0-1) */
  opacity?: number;
  /** 스피너 크기 */
  size?: 'small' | 'large';
  /** 스피너 색상 */
  color?: string;
  /** 취소 가능 여부 */
  cancellable?: boolean;
  /** 취소 시 콜백 */
  onCancel?: () => void;
  /** 진행률 (0-100) */
  progress?: number;
  /** 진행률 표시 여부 */
  showProgress?: boolean;
  /** 애니메이션 타입 */
  animationType?: 'fade' | 'scale';
}

// ============================================================================
// Progress Circle Component
// ============================================================================

interface ProgressCircleProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

function ProgressCircle({
  progress,
  size = 64,
  strokeWidth = 4,
  color = '#A855F7',
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(Math.max(progress, 0), 100) / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* 배경 원 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* 진행률 원 */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {/* 퍼센트 텍스트 */}
      <View className="absolute inset-0 items-center justify-center">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {Math.round(progress)}%
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// Component
// ============================================================================

export function LoadingOverlay({
  visible,
  message,
  opacity = 0.7,
  size = 'large',
  color = '#A855F7',
  cancellable = false,
  onCancel,
  progress,
  showProgress = false,
  animationType = 'fade',
}: LoadingOverlayProps) {
  // Reanimated 애니메이션 값
  const animatedOpacity = useSharedValue(0);
  const animatedScale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      animatedOpacity.value = withTiming(1, {
        duration: 200,
        easing: Easing.ease,
      });
      animatedScale.value = withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      animatedOpacity.value = withTiming(0, {
        duration: 150,
        easing: Easing.ease,
      });
      animatedScale.value = withTiming(0.9, {
        duration: 150,
        easing: Easing.ease,
      });
    }
  }, [visible, animatedOpacity, animatedScale]);

  // 애니메이션 스타일
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: animatedOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => {
    if (animationType === 'scale') {
      return {
        opacity: animatedOpacity.value,
        transform: [{ scale: animatedScale.value }],
      };
    }
    return {
      opacity: animatedOpacity.value,
    };
  });

  if (!visible) return null;

  const hasProgress = showProgress && typeof progress === 'number';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={cancellable ? onCancel : undefined}
    >
      <Animated.View
        className="flex-1 items-center justify-center"
        style={[{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }, containerAnimatedStyle]}
      >
        <Animated.View
          className="bg-white dark:bg-surface rounded-2xl px-8 py-6 items-center shadow-xl min-w-[160px]"
          style={contentAnimatedStyle}
        >
          {/* 진행률 표시 또는 스피너 */}
          {hasProgress ? (
            <ProgressCircle progress={progress} color={color} />
          ) : (
            <ActivityIndicator size={size} color={color} />
          )}

          {/* 메시지 */}
          {message && (
            <Text className="text-gray-700 dark:text-gray-300 text-center mt-4 text-base">
              {message}
            </Text>
          )}

          {/* 취소 버튼 */}
          {cancellable && onCancel && (
            <Pressable
              onPress={onCancel}
              className="mt-4 px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="취소"
            >
              <Text className="text-gray-500 dark:text-gray-400 text-sm underline">
                취소
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// Inline LoadingOverlay (Modal 없이 사용)
// ============================================================================

interface InlineLoadingOverlayProps {
  /** 로딩 메시지 */
  message?: string;
  /** 스피너 크기 */
  size?: 'small' | 'large';
  /** 스피너 색상 */
  color?: string;
  /** 진행률 (0-100) */
  progress?: number;
  /** 진행률 표시 여부 */
  showProgress?: boolean;
}

export function InlineLoadingOverlay({
  message,
  size = 'large',
  color = '#A855F7',
  progress,
  showProgress = false,
}: InlineLoadingOverlayProps) {
  const hasProgress = showProgress && typeof progress === 'number';

  return (
    <View className="absolute inset-0 bg-white/80 dark:bg-surface-dark/80 items-center justify-center z-50">
      <View className="items-center">
        {hasProgress ? (
          <ProgressCircle progress={progress} color={color} />
        ) : (
          <ActivityIndicator size={size} color={color} />
        )}
        {message && (
          <Text className="text-gray-700 dark:text-gray-300 text-center mt-4 text-base">
            {message}
          </Text>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default LoadingOverlay;
