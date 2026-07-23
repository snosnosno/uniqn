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
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { ModalKeyboardAvoider } from '@/components/ui/ModalKeyboardAvoider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { XMarkIcon } from '@/components/icons';
import { getIconColor } from '@/constants';
import { useSheetChain } from '@/components/ui/SheetChainContext';
import { useThemeStore } from '@/stores/themeStore';
import { isWeb } from '@/utils/platform';
import { focusIfPossible } from '@/utils/focusNode';
import { WebPortal } from '@/components/ui/WebPortal';

/**
 * 시트 상단이 상태바에 닿지 않도록 남기는 최소 간격.
 * 상한 = windowHeight - insets.top - 이 값.
 */
const SHEET_TOP_GAP = 8;

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
  // 연쇄 진입 — 네이티브와 같은 계약을 웹에서도 지킨다(마운트 시점 값 고정).
  // 웹은 onShow 가 없어 표시 전환 시점에 onEntered 를 직접 호출한다.
  const chain = useSheetChain();
  const isChainEntryRef = useRef(chain?.entering === true);
  const chainOnEnteredRef = useRef(chain?.onEntered);
  chainOnEnteredRef.current = chain?.onEntered;
  const { height: windowHeight } = useWindowDimensions();
  const [shouldRender, setShouldRender] = useState(visible);
  // 연쇄 진입은 첫 페인트부터 백드롭이 불투명하고 슬라이드가 없다 — 호출부가 같은 농도의
  // 딤을 이미 깔아 두었으므로, 여기서 opacity 0 부터 시작하면 그 사이 밝은 화면이 드러난다.
  // (CSS transition 은 마운트 후 "변화"에만 걸리므로 초기값 true = 전이 없이 즉시 표시)
  const [isAnimating, setIsAnimating] = useState(visible && isChainEntryRef.current);
  // 연쇄 진입 전용 콘텐츠 fade — 백드롭은 즉시 불투명하되 내용은 160ms 로 나타난다.
  const [chainContentIn, setChainContentIn] = useState(false);
  const previouslyFocusedRef = useRef<Element | null>(null);
  // 연쇄 진입 시 새 시트 제목으로 접근성 포커스를 옮길 타깃(a11y C2) — tabIndex -1 래퍼
  const titleWrapRef = useRef<View | null>(null);

  useEffect(() => {
    if (visible) {
      if (typeof document !== 'undefined') {
        previouslyFocusedRef.current = document.activeElement;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      setShouldRender(true);
      if (isChainEntryRef.current) {
        // 딤은 시트가 실제로 그려진 뒤에 걷어야 한다 — rAF 한 번은 "다음 페인트 직전"이라
        // 아직 화면에 반영되기 전이다. 이중 rAF 로 한 프레임 그려진 것을 보장한다.
        requestAnimationFrame(() => {
          setChainContentIn(true);
          requestAnimationFrame(() => {
            chainOnEnteredRef.current?.();
            // 연쇄 전환 뒤 스크린리더·키보드 사용자가 새 시트에 착지하도록 제목으로
            // 포커스 이동(a11y C2). 일반 오픈은 사용자가 방금 탭한 맥락이 있어 옮기지
            // 않는다(절제). DOM 이 아니면(네이티브/테스트) 조용한 no-op.
            focusIfPossible(titleWrapRef.current);
          });
        });
        if (typeof document !== 'undefined') {
          document.body.style.overflow = 'hidden';
        }
        return undefined;
      }
      requestAnimationFrame(() => {
        setIsAnimating(true);
        chainOnEnteredRef.current?.();
      });
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

        {/* Modal Container — pointerEvents 는 반드시 prop 으로:
            style 의 'box-none' 은 유효 CSS 값이 아니라 RNW 가 드롭(computed auto)해
            백드롭(형제 Pressable) 클릭이 이 컨테이너에 전부 삼켜진다(웹 실측). */}
        <View className="flex-1 justify-end" pointerEvents="box-none">
          <View
            style={[
              {
                maxHeight: fullHeight ? windowHeight : windowHeight * 0.95,
                height: fullHeight ? windowHeight : undefined,
                // 연쇄 진입은 제자리에서 내용만 갈린다 — 슬라이드 없이 fade 만(네이티브와 동일).
                opacity: isChainEntryRef.current ? (chainContentIn ? 1 : 0) : isAnimating ? 1 : 0,
                transform: [
                  { translateY: isChainEntryRef.current || isAnimating ? 0 : windowHeight },
                ],
                // @ts-expect-error - 웹 전용 스타일
                transition: isChainEntryRef.current
                  ? 'opacity 160ms ease-out'
                  : 'opacity 200ms ease, transform 300ms ease-out',
                pointerEvents: 'auto' as const,
              },
            ]}
            className={`bg-surface-card w-full ${fullHeight ? 'h-full' : 'rounded-t-3xl'}`}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-divider">
              {/* tabIndex -1: 탭 순서엔 없지만 프로그램 포커스는 받는다(연쇄 진입 착지점, C2) */}
              <View ref={titleWrapRef} tabIndex={-1}>
                <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
                  {title}
                </Text>
              </View>
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
  // SafeAreaView(네이티브 뷰)는 RNModal 의 별도 윈도우를 자기 기준으로 측정해
  // 인셋이 0으로 떨어진다 (실기기 2026-07-19: 하단 버튼이 홈 인디케이터에 잘리고
  // 키보드 오픈 시 헤더가 상태바를 침범). 훅으로 앱 루트 provider 값을 직접 읽어
  // 패딩으로 적용하면 중첩 SafeAreaProvider 없이 해소된다.
  const insets = useSafeAreaInsets();
  // 연쇄 진입(주문서 미설정 항목 이어가기) — 마운트 시점 값을 고정한다.
  // 이후 Context 가 바뀌어도 이미 시작한 연출을 갈아치우지 않기 위함.
  const chain = useSheetChain();
  const isChainEntryRef = useRef(chain?.entering === true);
  const chainOnEnteredRef = useRef(chain?.onEntered);
  chainOnEnteredRef.current = chain?.onEntered;
  const fadeOpacity = useSharedValue(0);
  // 연쇄 진입은 아래에서 올라오지 않고 제자리에서 나타난다(슬라이드 이동 없음)
  const translateY = useSharedValue(isChainEntryRef.current ? 0 : windowHeight);
  const contentOpacity = useSharedValue(isChainEntryRef.current ? 0 : 1);
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
      if (isChainEntryRef.current) {
        // 백드롭은 즉시 불투명 — 호출부가 같은 농도의 딤을 이미 깔아 두어 이음매가 없다.
        fadeOpacity.value = 1;
        contentOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.ease) });
        return;
      }
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
  }, [visible, fadeOpacity, translateY, contentOpacity, windowHeight]);

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
    opacity: contentOpacity.value,
  }));

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
      onShow={() => chainOnEnteredRef.current?.()}
      statusBarTranslucent
    >
      {/* Android: statusBarTranslucent 다이얼로그에선 KAV(height)가 무력 —
          ModalKeyboardAvoider가 IME 인셋 기반 paddingBottom으로 직접 보정 */}
      <ModalKeyboardAvoider>
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
              fullHeight
                ? { flex: 1 }
                : {
                    // flex:1 을 주면 내용이 짧아도 시트가 항상 화면을 가득 채워
                    // 광활한 빈 공간이 생겼다 (실기기 2026-07-19). grow 를 없애
                    // 내용에 맞추되, shrink 는 반드시 켜 둔다 —
                    // RN 의 flexShrink 기본값은 0 이라(웹 CSS 의 1과 다름) 이게 없으면
                    // 키보드가 열려 부모가 줄어들 때 시트가 따라 줄지 않고
                    // justify-end 때문에 헤더가 화면 위로 밀려나간다.
                    flexShrink: 1,
                    // 상한은 상태바 인셋을 뺀 값이라 시트가 위로 밀려도 상태바를 침범하지 않는다.
                    maxHeight: windowHeight - insets.top - SHEET_TOP_GAP,
                  },
            ]}
          >
            <View
              style={
                fullHeight
                  ? { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }
                  : { flexShrink: 1, paddingBottom: insets.bottom }
              }
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
                // 내용 기반 높이 모드에서 flex:1 을 주면 부모 높이가 확정되지 않아
                // basis 0 으로 붕괴한다. flexShrink 만 두어 내용만큼 차지하되
                // 상한에 닿으면 줄어들며 스크롤되게 한다.
                style={fullHeight ? { flex: 1 } : { flexShrink: 1 }}
                contentContainerStyle={fullHeight ? { flexGrow: 1 } : undefined}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                {children}
              </ScrollView>

              {/* Footer */}
              {footer && <View className="px-4 py-4 border-t border-divider">{footer}</View>}
            </View>
          </Animated.View>

          {/* 오버레이 (시간 피커 등) — Modal 루트에 직접 렌더하여 중첩 Modal 회피.
              자식 오버레이가 absoluteFill로 전체 화면을 덮어 터치를 정상 수신한다. */}
          {overlay}
        </View>
      </ModalKeyboardAvoider>
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
