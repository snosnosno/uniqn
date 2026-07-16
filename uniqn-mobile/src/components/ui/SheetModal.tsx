/**
 * UNIQN Mobile - SheetModal 컴포넌트
 *
 * @description 전체 화면 슬라이드 모달 (iOS pageSheet 스타일 대체)
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { XMarkIcon } from '@/components/icons';
import { getIconColor } from '@/constants';
import { MOTION_EASING, MOTION_DURATION } from '@/constants/animation';
import { rubberband, shouldDismissSheet } from '@/components/ui/sheetModalGesture';
import { useReduceMotion } from '@/hooks/useReduceMotion';
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
  const reduceMotion = useReduceMotion();
  const fadeOpacity = useSharedValue(0);
  const translateY = useSharedValue(windowHeight);
  // 드래그 시작 시점의 시트 위치(오프셋) — 애니메이션 진행 중 grab 점프 방지용.
  const dragStartY = useSharedValue(0);
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
      fadeOpacity.value = withTiming(1, {
        duration: MOTION_DURATION.base,
        easing: MOTION_EASING.fade,
      });
      if (reduceMotion) {
        // reduce motion: translate 는 즉시 목표값, opacity 페이드만 유지
        translateY.value = 0;
      } else {
        translateY.value = withTiming(0, {
          duration: MOTION_DURATION.sheet,
          easing: MOTION_EASING.sheet,
        });
      }
    } else {
      fadeOpacity.value = withTiming(0, {
        duration: MOTION_DURATION.base,
        easing: MOTION_EASING.fade,
      });
      if (reduceMotion) {
        translateY.value = windowHeight;
      } else {
        translateY.value = withTiming(windowHeight, {
          duration: MOTION_DURATION.sheetExit,
          easing: MOTION_EASING.exitTravel,
        });
      }
    }
  }, [visible, reduceMotion, fadeOpacity, translateY, windowHeight]);

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

  // 헤더 한정 Pan 제스처: 끌어내려 닫기.
  // 직접 조작(direct manipulation)이므로 reduce motion 분기 대상이 아니다.
  // useMemo: 매 렌더 재생성 시 드래그 중 리렌더가 진행 중 제스처를 드롭할 수 있다
  // (gesture-handler 공식 memoize 권고, 2026-07-17 /review).
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!isLoading)
        .onStart(() => {
          // 입장/복귀 애니메이션 진행 중 grab 시 손가락 위치로 점프하지 않도록
          // 현재 위치를 기준 오프셋으로 캡처한다.
          dragStartY.value = translateY.value;
        })
        .onUpdate((e) => {
          // 아래로는 손가락과 1:1 추적, 위로는 러버밴드 저항.
          const raw = dragStartY.value + e.translationY;
          translateY.value = raw > 0 ? raw : rubberband(raw, windowHeight);
        })
        .onEnd((e) => {
          if (shouldDismissSheet(e.translationY, e.velocityY, windowHeight)) {
            // 확인형 onRequestClose 계약 때문에 여기서 퇴장 애니메이션을 선행하지 않는다.
            // 소비처가 닫기를 거부(예: 미저장 변경 시 "계속 편집" Alert)하면 시트가 화면 밖에
            // 갇히는 유령 모달이 되므로, 닫기 요청만 즉시 보낸다.
            runOnJS(handleRequestClose)();
          }
          // dismiss 여부와 무관하게 시트는 제자리 복귀(릴리즈 속도 이양, 오버슈트 0).
          // 닫힘이 확정되면 부모 visible=false → 기존 closing useEffect 가 현재 위치에서
          // 이어받아(reanimated 현재값 재타게팅) 점프 없이 퇴장한다.
          translateY.value = withSpring(0, {
            dampingRatio: 1,
            duration: 300,
            velocity: e.velocityY,
          });
        }),
    [isLoading, windowHeight, handleRequestClose, dragStartY, translateY]
  );

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    // 드래그 진행도(translateY)에 비례해 백드롭이 옅어진다.
    opacity:
      fadeOpacity.value *
      interpolate(translateY.value, [0, windowHeight], [1, 0], Extrapolation.CLAMP),
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
      {/* Android 함정 회피: RN Modal 내부에서 gesture-handler 가 동작하려면
          Modal 콘텐츠 최상단을 GestureHandlerRootView 로 감싸야 한다(RNModal 직계 자식). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
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
                {/* Header — Pan 제스처로 끌어내려 닫기(헤더 한정: 콘텐츠 ScrollView 스크롤 충돌 회피) */}
                <GestureDetector gesture={panGesture}>
                  <View className="border-b border-divider">
                    {/* 드래그 핸들 바 (끌어내려 닫기 어포던스) */}
                    <View className="items-center pt-2">
                      <View className="w-9 h-1 rounded-full bg-secondary-300 dark:bg-secondary-600" />
                    </View>
                    <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
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
                  </View>
                </GestureDetector>

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
      </GestureHandlerRootView>
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
