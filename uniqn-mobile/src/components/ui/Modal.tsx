/**
 * UNIQN Mobile - Modal 컴포넌트
 *
 * @description 재사용 가능한 모달 컴포넌트
 * @version 3.0.0 - 웹 호환성 추가
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal as RNModal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { XMarkIcon } from '@/components/icons';
import { getIconColor } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import { isWeb } from '@/utils/platform';
// @ts-expect-error - react-dom 타입 없음 (Expo 웹에서 런타임에는 사용 가능)
import { createPortal } from 'react-dom';

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
// Web Modal Portal (DOM 최상위에 렌더링)
// ============================================================================

function WebModalPortal({ children }: { children: React.ReactNode }) {
  // SSR 안전 체크 및 document.body에 Portal 렌더링
  if (typeof document === 'undefined') return <>{children}</>;
  return createPortal(children, document.body);
}

// ============================================================================
// Web Modal Component
// ============================================================================

function WebModal({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  size = 'md',
  position = 'center',
}: ModalProps) {
  const { isDarkMode } = useThemeStore();
  const { height: windowHeight } = useWindowDimensions();
  const [shouldRender, setShouldRender] = useState(visible);
  const [isAnimating, setIsAnimating] = useState(false);
  const previouslyFocusedRef = useRef<Element | null>(null);

  useEffect(() => {
    if (visible) {
      // 현재 포커스된 요소 저장 후 blur (aria-hidden 충돌 방지)
      if (typeof document !== 'undefined') {
        previouslyFocusedRef.current = document.activeElement;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      setShouldRender(true);
      // 다음 프레임에서 애니메이션 시작
      requestAnimationFrame(() => setIsAnimating(true));
      // 배경 스크롤 잠금
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
      return undefined;
    } else {
      setIsAnimating(false);
      // 애니메이션 완료 후 언마운트
      const timer = setTimeout(() => setShouldRender(false), 250);
      // 배경 스크롤 해제
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        // 이전에 포커스된 요소로 복원
        if (previouslyFocusedRef.current instanceof HTMLElement) {
          previouslyFocusedRef.current.focus();
          previouslyFocusedRef.current = null;
        }
      }
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!visible || !closeOnBackdrop) return;
    if (typeof document === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, closeOnBackdrop, onClose]);

  if (!shouldRender) return null;

  const containerStyle = position === 'center' ? 'justify-center items-center' : 'justify-end';

  const modalClassName =
    position === 'center'
      ? `bg-white dark:bg-surface rounded-2xl overflow-hidden ${MODAL_SIZES[size]}`
      : 'bg-white dark:bg-surface rounded-t-3xl w-full pb-8';

  // 모달 최대 높이 스타일 (숫자값으로 계산)
  const modalMaxHeightStyle = {
    maxHeight: position === 'center' ? windowHeight * 0.85 : windowHeight * 0.9,
  };

  return (
    <WebModalPortal>
      <View
        style={[
          StyleSheet.absoluteFill,
          // @ts-expect-error - 웹 전용 스타일
          { position: 'fixed', zIndex: 9999 },
        ]}
      >
        {/* Backdrop */}
        <Pressable
          onPress={closeOnBackdrop ? onClose : undefined}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'rgba(0,0,0,0.5)',
              opacity: isAnimating ? 1 : 0,
              // @ts-expect-error - 웹 전용 스타일
              transition: 'opacity 200ms ease',
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="모달 닫기"
        />

        {/* Modal Container */}
        <View className={`flex-1 ${containerStyle}`} style={{ pointerEvents: 'box-none' }}>
          <View
            style={[
              modalMaxHeightStyle,
              position === 'center'
                ? {
                    opacity: isAnimating ? 1 : 0,
                    transform: [{ scale: isAnimating ? 1 : 0.9 }],
                    // @ts-expect-error - 웹 전용 스타일
                    transition:
                      'opacity 200ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    pointerEvents: 'auto' as const,
                  }
                : {
                    opacity: isAnimating ? 1 : 0,
                    transform: [{ translateY: isAnimating ? 0 : 100 }],
                    transition: 'opacity 200ms ease, transform 300ms ease-out',
                    pointerEvents: 'auto' as const,
                  },
            ]}
            className={modalClassName}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-surface-overlay">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                  {title || ''}
                </Text>
                {showCloseButton && (
                  <Pressable
                    onPress={onClose}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-surface active:bg-gray-200 dark:active:bg-gray-600"
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
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              <View className="p-5">{children}</View>
            </ScrollView>
          </View>
        </View>
      </View>
    </WebModalPortal>
  );
}

// ============================================================================
// Native Modal Component
// ============================================================================

function NativeModal({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
  size = 'md',
  position = 'center',
}: ModalProps) {
  const { isDarkMode } = useThemeStore();
  const { height: windowHeight } = useWindowDimensions();
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
        scale.value = withTiming(1, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
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

  const containerStyle = position === 'center' ? 'justify-center items-center' : 'justify-end';

  const modalClassName =
    position === 'center'
      ? `bg-white dark:bg-surface rounded-2xl overflow-hidden ${MODAL_SIZES[size]}`
      : 'bg-white dark:bg-surface rounded-t-3xl w-full pb-8';

  // 모달 최대 높이 스타일 (숫자값으로 계산)
  const modalMaxHeightStyle = {
    maxHeight: position === 'center' ? windowHeight * 0.85 : windowHeight * 0.9,
  };

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
        <View className={`flex-1 ${containerStyle}`} style={{ pointerEvents: 'box-none' }}>
          {/* 백드롭 - 별도 레이어로 분리 (button 중첩 방지) */}
          <Pressable
            onPress={handleBackdropPress}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityRole="button"
            accessibilityLabel="모달 닫기"
          >
            <Animated.View style={backdropAnimatedStyle} className="flex-1 bg-black/50" />
          </Pressable>

          {/* 모달 컨텐츠 - 백드롭과 형제 관계 */}
          <Animated.View style={[modalAnimatedStyle, modalMaxHeightStyle, { flexShrink: 1 }]}>
            <View className={modalClassName}>
              {/* Header */}
              {(title || showCloseButton) && (
                <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-surface-overlay">
                  <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                    {title || ''}
                  </Text>
                  {showCloseButton && (
                    <Pressable
                      onPress={onClose}
                      className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 dark:bg-surface active:bg-gray-200 dark:active:bg-gray-600"
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
                keyboardShouldPersistTaps="always"
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
// Main Export - Platform 분기
// ============================================================================

export function Modal(props: ModalProps) {
  if (isWeb) {
    return <WebModal {...props} />;
  }
  return <NativeModal {...props} />;
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
    <Modal visible={visible} onClose={onClose} title={title} size="sm" showCloseButton={false}>
      <Text className="text-gray-600 dark:text-gray-300 text-center mb-6">{message}</Text>
      <Pressable
        onPress={onClose}
        className="bg-primary-600 py-3 rounded-xl"
        accessibilityRole="button"
      >
        <Text className="text-white text-center font-semibold">{confirmText}</Text>
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
    <Modal visible={visible} onClose={onClose} title={title} size="sm" showCloseButton={false}>
      <Text className="text-gray-600 dark:text-gray-300 text-center mb-6">{message}</Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={onClose}
          className="flex-1 bg-gray-200 dark:bg-surface py-3 rounded-xl"
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
          className={`flex-1 py-3 rounded-xl ${isDestructive ? 'bg-red-600' : 'bg-primary-600'}`}
          accessibilityRole="button"
        >
          <Text className="text-white text-center font-semibold">{confirmText}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default Modal;
