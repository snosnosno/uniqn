/**
 * UNIQN Mobile - Modal 컴포넌트
 *
 * @description 재사용 가능한 모달 컴포넌트
 * @version 2.0.0 - Reanimated 마이그레이션
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal as RNModal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { XMarkIcon } from '@/components/icons';
import { getIconColor } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'full';
  position?: 'center' | 'bottom';
}

// ============================================================================
// Constants
// ============================================================================

const MODAL_SIZES = {
  sm: 'w-[280px]',
  md: 'w-[340px]',
  lg: 'w-[400px]',
  full: 'w-full mx-4',
};

// ============================================================================
// Component
// ============================================================================

export function Modal({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  size = 'md',
  position = 'center',
}: ModalProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const fadeOpacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(100);

  // 초기 렌더링 시 불필요한 애니메이션 방지
  const isFirstRender = useRef(true);

  useEffect(() => {
    // 초기 렌더링 시에는 애니메이션 건너뛰기
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) {
        // 초기 상태가 닫힌 상태면 애니메이션 값만 설정
        fadeOpacity.value = 0;
        scale.value = 0.9;
        translateY.value = 100;
        return;
      }
    }

    if (visible) {
      // 열기 애니메이션
      fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });

      if (position === 'center') {
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 150,
        });
      } else {
        translateY.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.ease),
        });
      }
    } else {
      // 닫기 애니메이션
      fadeOpacity.value = withTiming(0, { duration: 150, easing: Easing.ease });

      if (position === 'center') {
        scale.value = withTiming(0.9, { duration: 150, easing: Easing.ease });
      } else {
        translateY.value = withTiming(100, {
          duration: 200,
          easing: Easing.in(Easing.ease),
        });
      }
    }
  }, [visible, position, fadeOpacity, scale, translateY]);

  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  // 백드롭 애니메이션 스타일
  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  // 모달 컨텐츠 애니메이션 스타일
  const modalAnimatedStyle = useAnimatedStyle(() => {
    if (position === 'center') {
      return {
        transform: [{ scale: scale.value }],
      };
    } else {
      return {
        transform: [{ translateY: translateY.value }],
      };
    }
  });

  const containerStyle =
    position === 'center' ? 'justify-center items-center' : 'justify-end';

  const modalClassName =
    position === 'center'
      ? `bg-white dark:bg-gray-800 rounded-2xl overflow-hidden ${MODAL_SIZES[size]}`
      : 'bg-white dark:bg-gray-800 rounded-t-3xl w-full pb-8';

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className={`flex-1 ${containerStyle}`}>
          {/* 백드롭 - 별도 레이어로 분리 (button 중첩 방지) */}
          <Pressable
            onPress={handleBackdropPress}
            className="absolute inset-0"
            accessibilityRole="button"
            accessibilityLabel="모달 닫기"
          >
            <Animated.View
              style={backdropAnimatedStyle}
              className="flex-1 bg-black/50"
            />
          </Pressable>

          {/* 모달 컨텐츠 - 백드롭과 형제 관계 */}
          <Animated.View style={[modalAnimatedStyle, { pointerEvents: 'box-none' }]}>
            <View className={modalClassName}>
              {/* Header */}
              {(title || showCloseButton) && (
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title || ''}
                  </Text>
                  {showCloseButton && (
                    <Pressable
                      onPress={onClose}
                      className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                      accessibilityRole="button"
                      accessibilityLabel="닫기"
                      hitSlop={8}
                    >
                      <XMarkIcon size={18} color={getIconColor(isDarkMode, 'primary')} />
                    </Pressable>
                  )}
                </View>
              )}

              {/* Content */}
              <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
              >
                <View className="p-5">{children}</View>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

// ============================================================================
// Preset Modals
// ============================================================================

export interface AlertModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  confirmText?: string;
}

export function AlertModal({
  visible,
  onClose,
  title = '알림',
  message,
  confirmText = '확인',
}: AlertModalProps) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size="sm"
      showCloseButton={false}
    >
      <Text className="text-gray-600 dark:text-gray-300 text-center mb-6">
        {message}
      </Text>
      <Pressable
        onPress={onClose}
        className="bg-blue-600 py-3 rounded-xl"
        accessibilityRole="button"
      >
        <Text className="text-white text-center font-semibold">
          {confirmText}
        </Text>
      </Pressable>
    </Modal>
  );
}

export interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  isDestructive = false,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={title}
      size="sm"
      showCloseButton={false}
    >
      <Text className="text-gray-600 dark:text-gray-300 text-center mb-6">
        {message}
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={onClose}
          className="flex-1 bg-gray-200 dark:bg-gray-700 py-3 rounded-xl"
          accessibilityRole="button"
        >
          <Text className="text-gray-700 dark:text-gray-200 text-center font-medium">
            {cancelText}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onConfirm();
            onClose();
          }}
          className={`flex-1 py-3 rounded-xl ${
            isDestructive ? 'bg-red-600' : 'bg-blue-600'
          }`}
          accessibilityRole="button"
        >
          <Text className="text-white text-center font-semibold">
            {confirmText}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default Modal;
