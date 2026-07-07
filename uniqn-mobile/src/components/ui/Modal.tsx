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
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { WebPortal } from '@/components/ui/WebPortal';
import { triggerHaptic } from '@/utils/haptics';

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
  footer?: React.ReactNode;
  /**
   * 닫기 버튼 a11y 라벨. 컨텍스트별 분기용 (예: 진행 중 = "본인인증 취소", 완료 후 = "닫기").
   * 미지정 시 기본 "닫기".
   */
  closeAccessibilityLabel?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODAL_SIZES = {
  sm: 'w-[280px]',
  md: 'w-[340px]',
  lg: 'w-[400px]',
  // full 은 className 으로 처리 불가 (mx-4 + w-full 조합이 overflow 유발).
  // inline style 에서 windowWidth - 32 로 직접 계산.
  full: '',
};

const MODAL_FULL_MARGIN = 16; // 좌우 가장자리 여백 (px)

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
  footer,
  closeAccessibilityLabel = '닫기',
}: ModalProps) {
  const { isDarkMode } = useThemeStore();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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
      ? `bg-surface-card rounded-lg overflow-hidden ${MODAL_SIZES[size]}`
      : 'bg-surface-card rounded-t-3xl w-full pb-8';

  // 모달 최대 높이 스타일 (숫자값으로 계산)
  const modalMaxHeightStyle = {
    maxHeight: position === 'center' ? windowHeight * 0.85 : windowHeight * 0.9,
  };

  return (
    <WebPortal>
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
              size === 'full' ? { width: windowWidth - MODAL_FULL_MARGIN * 2 } : null,
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
              <View className="flex-row items-center justify-between px-5 py-2.5 border-b border-divider">
                <Text className="text-base font-display-semibold text-content-primary dark:text-off-white">
                  {title || ''}
                </Text>
                {showCloseButton && (
                  <Pressable
                    onPress={onClose}
                    className="w-9 h-9 items-center justify-center rounded-sm bg-surface-card dark:bg-surface active:bg-secondary-200 dark:active:bg-secondary-600"
                    accessibilityRole="button"
                    accessibilityLabel={closeAccessibilityLabel}
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
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              <View className="p-5">{children}</View>
            </ScrollView>

            {/* Footer (sticky) */}
            {footer && (
              <View className="px-5 py-3 border-t border-divider bg-surface-card">{footer}</View>
            )}
          </View>
        </View>
      </View>
    </WebPortal>
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
  footer,
  closeAccessibilityLabel = '닫기',
}: ModalProps) {
  const { isDarkMode } = useThemeStore();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const fadeOpacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const translateY = useSharedValue(100);
  const isKeyboardVisible = useRef(false);

  // 초기 렌더링 시 불필요한 애니메이션 방지
  const isFirstRender = useRef(true);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardVisible.current = true;
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardVisible.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
    Keyboard.dismiss();
    if (isKeyboardVisible.current) {
      return;
    }

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
      ? `bg-surface-card rounded-lg overflow-hidden ${MODAL_SIZES[size]}`
      : 'bg-surface-card rounded-t-3xl w-full pb-8';

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
          {/* size='full' — items-center 가 cross-axis stretch 막으므로 windowWidth 기반 명시 폭 부여.
              내부 child 는 align-items default stretch 로 자연스럽게 채워짐 (별도 w-full 불필요) */}
          <Animated.View
            style={[
              modalAnimatedStyle,
              modalMaxHeightStyle,
              { flexShrink: 1 },
              size === 'full' ? { width: windowWidth - MODAL_FULL_MARGIN * 2 } : null,
            ]}
          >
            <SafeAreaView
              edges={position === 'center' ? ['top', 'bottom'] : ['bottom']}
              style={{ flexShrink: 1 }}
            >
              <View className={modalClassName} style={{ flexShrink: 1 }}>
                {/* Header */}
                {(title || showCloseButton) && (
                  <View className="flex-row items-center justify-between px-5 py-2.5 border-b border-divider">
                    <Text className="text-base font-display-semibold text-content-primary dark:text-off-white">
                      {title || ''}
                    </Text>
                    {showCloseButton && (
                      <Pressable
                        onPress={onClose}
                        className="w-9 h-9 items-center justify-center rounded-sm bg-surface-card dark:bg-surface active:bg-secondary-200 dark:active:bg-secondary-600"
                        accessibilityRole="button"
                        accessibilityLabel={closeAccessibilityLabel}
                        hitSlop={8}
                      >
                        <XMarkIcon size={18} color={getIconColor(isDarkMode, 'primary')} />
                      </Pressable>
                    )}
                  </View>
                )}

                {/* Content */}
                <ScrollView
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={{ flexGrow: 1 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                  <View className="p-5">{children}</View>
                </ScrollView>

                {/* Footer (sticky) */}
                {footer && (
                  <View className="px-5 py-3 border-t border-divider bg-surface-card">
                    {footer}
                  </View>
                )}
              </View>
            </SafeAreaView>
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
      <Text className="text-content-muted dark:text-secondary-300 text-center mb-6 font-sans">
        {message}
      </Text>
      <Pressable
        onPress={onClose}
        className="bg-primary-600 py-3 rounded-md"
        accessibilityRole="button"
      >
        <Text className="text-content-onGold text-center font-sans-semibold">{confirmText}</Text>
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
  confirmTestID?: string;
  cancelTestID?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  visible,
  onClose,
  onConfirm,
  confirmTestID,
  cancelTestID,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  isDestructive = false,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} onClose={onClose} title={title} size="sm" showCloseButton={false}>
      <Text className="text-content-muted dark:text-secondary-300 text-center mb-6 font-sans">
        {message}
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={onClose}
          className="flex-1 bg-secondary-200 dark:bg-surface py-3 rounded-md"
          accessibilityRole="button"
          testID={cancelTestID}
        >
          <Text className="text-content-secondary dark:text-secondary-200 text-center font-sans-medium">
            {cancelText}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            // impeccable v2 §17 — 파괴적 확인은 Warning, 일반 확인은 Light.
            void triggerHaptic(isDestructive ? 'warning' : 'light');
            onConfirm();
            onClose();
          }}
          className={`flex-1 py-3 rounded-md ${isDestructive ? 'bg-error-600' : 'bg-primary-600'}`}
          accessibilityRole="button"
          testID={confirmTestID}
        >
          <Text
            className={`text-center font-sans-semibold ${isDestructive ? 'text-white' : 'text-content-onGold'}`}
          >
            {confirmText}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
