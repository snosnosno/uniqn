/**
 * UNIQN Mobile - SheetModal 컴포넌트
 *
 * @description 전체 화면 슬라이드 모달 (iOS pageSheet 스타일 대체)
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

// ============================================================================
// Types
// ============================================================================

export interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  onRequestClose?: () => void;
  title: string;
  children: React.ReactNode;
  /** 하단 고정 영역 (버튼 등) */
  footer?: React.ReactNode;
  /** 닫기 버튼 표시 여부 (기본: true) */
  showCloseButton?: boolean;
  /** 로딩 중 닫기 방지 */
  isLoading?: boolean;
  fullHeight?: boolean;
  /**
   * 모달 최상위에 겹쳐 띄우는 오버레이(시간 피커 등).
   * children(ScrollView 내부)이 아닌 Modal 루트에 렌더링하므로
   * 중첩 Modal 없이 전체 화면 오버레이가 터치를 정상 수신한다.
   */
  overlay?: React.ReactNode;
}

// ============================================================================
// Web SheetModal Component
// ============================================================================

function WebSheetModal({
  visible,
  onClose,
  onRequestClose,
  title,
  children,
  footer,
  showCloseButton = true,
  isLoading = false,
  fullHeight = false,
  overlay,
}: SheetModalProps) {
  const { isDarkMode } = useThemeStore();
  const { height: windowHeight } = useWindowDimensions();
  const [shouldRender, setShouldRender] = useState(visible);
  const [isAnimating, setIsAnimating] = useState(false);
  const previouslyFocusedRef = useRef<Element | null>(null);

  useEffect(() => {
    if (visible) {
      if (typeof document !== 'undefined') {
        previouslyFocusedRef.current = document.activeElement;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      setShouldRender(true);
      requestAnimationFrame(() => setIsAnimating(true));
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
      return undefined;
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 300);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        if (previouslyFocusedRef.current instanceof HTMLElement) {
          previouslyFocusedRef.current.focus();
          previouslyFocusedRef.current = null;
        }
      }
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // ESC 키로 닫기
  const handleRequestClose = useCallback(() => {
    if (!isLoading) {
      (onRequestClose ?? onClose)();
    }
  }, [isLoading, onClose, onRequestClose]);

  useEffect(() => {
    if (!visible || isLoading) return;
    if (typeof document === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleRequestClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, isLoading, handleRequestClose]);

  if (!shouldRender) return null;

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
          onPress={handleRequestClose}
          disabled={isLoading}
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
        <View className="flex-1 justify-end" style={{ pointerEvents: 'box-none' }}>
          <View
            style={[
              {
                maxHeight: fullHeight ? windowHeight : windowHeight * 0.95,
                height: fullHeight ? windowHeight : undefined,
                opacity: isAnimating ? 1 : 0,
                transform: [{ translateY: isAnimating ? 0 : windowHeight }],
                // @ts-expect-error - 웹 전용 스타일
                transition: 'opacity 200ms ease, transform 300ms ease-out',
                pointerEvents: 'auto' as const,
              },
            ]}
            className={`bg-surface-card w-full ${fullHeight ? 'h-full' : 'rounded-t-3xl'}`}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-divider">
              <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
                {title}
              </Text>
              {showCloseButton && (
                <Pressable
                  onPress={handleRequestClose}
                  disabled={isLoading}
                  className="w-10 h-10 items-center justify-center rounded-sm bg-surface-card dark:bg-surface active:bg-secondary-200 dark:active:bg-secondary-600"
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                >
                  <XMarkIcon size={18} color={getIconColor(isDarkMode, 'primary')} />
                </Pressable>
              )}
            </View>

            {/* Content */}
            <ScrollView
              style={fullHeight ? { flex: 1 } : { flex: 1, maxHeight: windowHeight * 0.7 }}
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              {children}
            </ScrollView>

            {/* Footer */}
            {footer && <View className="px-4 py-4 border-t border-divider pb-8">{footer}</View>}
          </View>
        </View>

        {/* 오버레이 (웹: TimeWheelPicker가 자체 Portal로 최상위 렌더) */}
        {overlay}
      </View>
    </WebPortal>
  );
}

// ============================================================================
// Native SheetModal Component
// ============================================================================

function NativeSheetModal({
  visible,
  onClose,
  onRequestClose,
  title,
  children,
  footer,
  showCloseButton = true,
  isLoading = false,
  fullHeight = false,
  overlay,
}: SheetModalProps) {
  const { isDarkMode } = useThemeStore();
  const { height: windowHeight } = useWindowDimensions();
  const fadeOpacity = useSharedValue(0);
  const translateY = useSharedValue(windowHeight);
  const isKeyboardVisible = useRef(false);

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
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) {
        fadeOpacity.value = 0;
        translateY.value = windowHeight;
        return;
      }
    }

    if (visible) {
      fadeOpacity.value = withTiming(1, { duration: 200, easing: Easing.ease });
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    } else {
      fadeOpacity.value = withTiming(0, { duration: 200, easing: Easing.ease });
      translateY.value = withTiming(windowHeight, {
        duration: 250,
        easing: Easing.in(Easing.ease),
      });
    }
  }, [visible, fadeOpacity, translateY, windowHeight]);

  const handleRequestClose = useCallback(() => {
    if (!isLoading) {
      (onRequestClose ?? onClose)();
    }
  }, [isLoading, onClose, onRequestClose]);

  const handleBackdropPress = useCallback(() => {
    Keyboard.dismiss();
    if (isKeyboardVisible.current) {
      return;
    }

    handleRequestClose();
  }, [handleRequestClose]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-end" style={{ pointerEvents: 'box-none' }}>
          {/* Backdrop */}
          <Pressable
            onPress={handleBackdropPress}
            disabled={isLoading}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityRole="button"
            accessibilityLabel="모달 닫기"
          >
            <Animated.View style={backdropAnimatedStyle} className="flex-1 bg-black/50" />
          </Pressable>

          {/* Modal Content */}
          <Animated.View
            style={[
              modalAnimatedStyle,
              fullHeight ? { flex: 1 } : { maxHeight: windowHeight * 0.95, flex: 1 },
            ]}
          >
            <SafeAreaView
              edges={fullHeight ? ['top', 'bottom'] : ['bottom']}
              style={{ flex: 1 }}
              className={`bg-surface-card ${fullHeight ? '' : 'rounded-t-3xl'}`}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-divider">
                <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
                  {title}
                </Text>
                {showCloseButton && (
                  <Pressable
                    onPress={handleRequestClose}
                    disabled={isLoading}
                    className="w-10 h-10 items-center justify-center rounded-sm bg-surface-card dark:bg-surface active:bg-secondary-200 dark:active:bg-secondary-600"
                    accessibilityRole="button"
                    accessibilityLabel="닫기"
                    hitSlop={8}
                  >
                    <XMarkIcon size={18} color={getIconColor(isDarkMode, 'primary')} />
                  </Pressable>
                )}
              </View>

              {/* Content */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {children}
              </ScrollView>

              {/* Footer */}
              {footer && <View className="px-4 py-4 border-t border-divider">{footer}</View>}
            </SafeAreaView>
          </Animated.View>

          {/* 오버레이 (시간 피커 등) — Modal 루트에 직접 렌더하여 중첩 Modal 회피.
              자식 오버레이가 absoluteFill로 전체 화면을 덮어 터치를 정상 수신한다. */}
          {overlay}
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

// ============================================================================
// Main Export
// ============================================================================

export function SheetModal(props: SheetModalProps) {
  if (isWeb) {
    return <WebSheetModal {...props} />;
  }
  return <NativeSheetModal {...props} />;
}
