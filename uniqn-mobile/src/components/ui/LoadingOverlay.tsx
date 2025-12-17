/**
 * UNIQN Mobile - LoadingOverlay 컴포넌트
 *
 * @description 전체 화면 로딩 오버레이
 * @version 1.0.0
 *
 * TODO [출시 전]: 애니메이션 개선 - react-native-reanimated 적용
 * TODO [출시 전]: 로딩 진행률 표시 옵션 추가
 */

import React from 'react';
import { View, Text, ActivityIndicator, Modal } from 'react-native';

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
}

// ============================================================================
// Component
// ============================================================================

export function LoadingOverlay({
  visible,
  message,
  opacity = 0.7,
  size = 'large',
  color = '#3B82F6',
  cancellable = false,
  onCancel,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancellable ? onCancel : undefined}
    >
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: `rgba(0, 0, 0, ${opacity})` }}
      >
        <View className="bg-white dark:bg-gray-800 rounded-2xl px-8 py-6 items-center shadow-xl min-w-[160px]">
          {/* 스피너 */}
          <ActivityIndicator size={size} color={color} />

          {/* 메시지 */}
          {message && (
            <Text className="text-gray-700 dark:text-gray-300 text-center mt-4 text-base">
              {message}
            </Text>
          )}

          {/* 취소 버튼 */}
          {cancellable && onCancel && (
            <Text
              onPress={onCancel}
              className="text-gray-500 dark:text-gray-400 text-sm mt-4 underline"
            >
              취소
            </Text>
          )}
        </View>
      </View>
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
}

export function InlineLoadingOverlay({
  message,
  size = 'large',
  color = '#3B82F6',
}: InlineLoadingOverlayProps) {
  return (
    <View className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 items-center justify-center z-50">
      <View className="items-center">
        <ActivityIndicator size={size} color={color} />
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
