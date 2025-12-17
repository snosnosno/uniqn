/**
 * UNIQN Mobile - Modal 컴포넌트
 *
 * @description 재사용 가능한 모달 컴포넌트
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal as RNModal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

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
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const slideAnim = React.useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        position === 'center'
          ? Animated.spring(scaleAnim, {
              toValue: 1,
              tension: 65,
              friction: 10,
              useNativeDriver: true,
            })
          : Animated.timing(slideAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        position === 'center'
          ? Animated.timing(scaleAnim, {
              toValue: 0.9,
              duration: 150,
              useNativeDriver: true,
            })
          : Animated.timing(slideAnim, {
              toValue: 100,
              duration: 200,
              useNativeDriver: true,
            }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, position]); // Animated.Value refs는 의도적으로 제외

  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  const containerStyle =
    position === 'center'
      ? 'justify-center items-center'
      : 'justify-end';

  const modalStyle =
    position === 'center'
      ? { transform: [{ scale: scaleAnim }] }
      : { transform: [{ translateY: slideAnim }] };

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
        <Pressable
          onPress={handleBackdropPress}
          className={`flex-1 ${containerStyle}`}
          accessibilityRole="button"
          accessibilityLabel="모달 닫기"
        >
          <Animated.View
            style={{ opacity: fadeAnim }}
            className="absolute inset-0 bg-black/50"
          />

          <Animated.View style={modalStyle}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              className={modalClassName}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title || ''}
                  </Text>
                  {showCloseButton && (
                    <Pressable
                      onPress={onClose}
                      className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
                      accessibilityRole="button"
                      accessibilityLabel="닫기"
                    >
                      <Text className="text-gray-500 dark:text-gray-400 text-lg">
                        ✕
                      </Text>
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
            </Pressable>
          </Animated.View>
        </Pressable>
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
