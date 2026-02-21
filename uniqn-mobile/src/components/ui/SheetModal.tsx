/**
 * UNIQN Mobile - SheetModal 컴포넌트
 *
 * @description 전체 화면 슬라이드 모달 (iOS pageSheet 스타일 대체)
 * @version 1.0.0
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
// @ts-expect-error - react-dom 타입 없음 (Expo 웹에서 런타임에는 사용 가능)
import { createPortal } from 'react-dom';

// ============================================================================
// Types
// ============================================================================

export interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** 하단 고정 영역 (버튼 등) */
  footer?: React.ReactNode;
  /** 닫기 버튼 표시 여부 (기본: true) */
  showCloseButton?: boolean;
  /** 로딩 중 닫기 방지 */
  isLoading?: boolean;
}

// ============================================================================
// Web Modal Portal
// ============================================================================

function WebModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return <>{children}</>;
  return createPortal(children, document.body);
}

// ============================================================================
// Web SheetModal Component
// ============================================================================

function WebSheetModal({
  visible,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
  isLoading = false,
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
  useEffect(() => {
    if (!visible || isLoading) return;
    if (typeof document === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, isLoading, onClose]);

  if (!shouldRender) return null;

  const handleClose = () => {
    if (!isLoading) onClose();
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
          onPress={handleClose}
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
                maxHeight: windowHeight * 0.95,
                opacity: isAnimating ? 1 : 0,
                transform: [{ translateY: isAnimating ? 0 : windowHeight }],
                // @ts-expect-error - 웹 전용 스타일
                transition: 'opacity 200ms ease, transform 300ms ease-out',
                pointerEvents: 'auto' as const,
              },
            ]}
            className="bg-white dark:bg-surface-dark rounded-t-3xl w-full"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-surface-overlay">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">{title}</Text>
              {showCloseButton && (
                <Pressable
                  onPress={handleClose}
                  disabled={isLoading}
                  className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-surface active:bg-gray-200 dark:active:bg-gray-600"
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                >
                  <XMarkIcon size={18} color={getIconColor(isDarkMode, 'primary')} />
                </Pressable>
              )}
            </View>

            {/* Content */}
            <ScrollView
              style={{ flex: 1, maxHeight: windowHeight * 0.7 }}
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
            >
              {children}
            </ScrollView>

            {/* Footer */}
            {footer && (
              <View className="px-4 py-4 border-t border-gray-200 dark:border-surface-overlay pb-8">
                {footer}
              </View>
            )}
          </View>
        </View>
      </View>
    </WebModalPortal>
  );
}

// ============================================================================
// Native SheetModal Component
// ============================================================================

function NativeSheetModal({
  visible,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
  isLoading = false,
}: SheetModalProps) {
  const { isDarkMode } = useThemeStore();
  const { height: windowHeight } = useWindowDimensions();
  const fadeOpacity = useSharedValue(0);
  const translateY = useSharedValue(windowHeight);

  const isFirstRender = useRef(true);

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

  const handleClose = () => {
    if (!isLoading) onClose();
  };

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
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 justify-end" style={{ pointerEvents: 'box-none' }}>
          {/* Backdrop */}
          <Pressable
            onPress={handleClose}
            disabled={isLoading}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityRole="button"
            accessibilityLabel="모달 닫기"
          >
            <Animated.View style={backdropAnimatedStyle} className="flex-1 bg-black/50" />
          </Pressable>

          {/* Modal Content */}
          <Animated.View style={[modalAnimatedStyle, { maxHeight: windowHeight * 0.95, flex: 1 }]}>
            <SafeAreaView
              edges={['bottom']}
              style={{ flex: 1 }}
              className="bg-white dark:bg-surface-dark rounded-t-3xl"
            >
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-surface-overlay">
                <Text className="text-lg font-semibold text-gray-900 dark:text-white">{title}</Text>
                {showCloseButton && (
                  <Pressable
                    onPress={handleClose}
                    disabled={isLoading}
                    className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-surface active:bg-gray-200 dark:active:bg-gray-600"
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
                keyboardShouldPersistTaps="always"
              >
                {children}
              </ScrollView>

              {/* Footer */}
              {footer && (
                <View className="px-4 py-4 border-t border-gray-200 dark:border-surface-overlay">
                  {footer}
                </View>
              )}
            </SafeAreaView>
          </Animated.View>
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

export default SheetModal;
