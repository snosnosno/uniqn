/**
 * UNIQN Mobile - BottomSheet 컴포넌트
 *
 * @description @gorhom/bottom-sheet 래퍼 컴포넌트
 * @version 2.0.0 - 웹 호환성 추가
 */

import React, { useCallback, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Keyboard, ScrollView } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { XMarkIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { getIconColor } from '@/constants';
import { isWeb } from '@/utils/platform';
import { Modal } from './Modal';

// ============================================================================
// Constants
// ============================================================================

/** BottomSheet 배경색 (Tailwind gray-800 / white 대응) */
const BACKGROUND_COLORS = {
  light: '#ffffff',
  dark: '#1f2937', // gray-800
} as const;

// ============================================================================
// Types
// ============================================================================

export interface BottomSheetProps {
  /** 표시 여부 */
  visible: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 제목 (선택) */
  title?: string;
  /** 닫기 버튼 표시 여부 */
  showCloseButton?: boolean;
  /** 핸들 바 표시 여부 */
  showHandle?: boolean;
  /** 스냅 포인트 배열 (기본: ['50%', '90%']) */
  snapPoints?: (string | number)[];
  /** 초기 스냅 인덱스 (기본: 0) */
  initialSnapIndex?: number;
  /** 드래그로 닫기 활성화 (기본: true) */
  enableDragClose?: boolean;
  /** 백드롭 탭으로 닫기 (기본: true) */
  closeOnBackdrop?: boolean;
  /** 스크롤 가능한 컨텐츠 여부 */
  scrollable?: boolean;
  /** 자식 요소 */
  children: React.ReactNode;
}

export interface BottomSheetRef {
  /** 특정 스냅 포인트로 이동 */
  snapToIndex: (index: number) => void;
  /** 닫기 */
  close: () => void;
  /** 확장 */
  expand: () => void;
  /** 축소 */
  collapse: () => void;
  /** 열기 */
  present: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      visible,
      onClose,
      title,
      showCloseButton = true,
      showHandle = true,
      snapPoints: customSnapPoints,
      initialSnapIndex = 0,
      enableDragClose = true,
      closeOnBackdrop = true,
      scrollable = false,
      children,
    },
    ref
  ) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const { isDarkMode } = useThemeStore();

    // ========================================================================
    // 웹 환경: Modal(position="bottom") 사용
    // ========================================================================
    if (isWeb) {
      // ref 메서드 웹 폴백
      useImperativeHandle(ref, () => ({
        snapToIndex: () => {},
        close: onClose,
        expand: () => {},
        collapse: () => {},
        present: () => {},
      }));

      return (
        <Modal
          visible={visible}
          onClose={onClose}
          position="bottom"
          showCloseButton={showCloseButton}
          closeOnBackdrop={closeOnBackdrop}
        >
          {/* Handle bar (시각적 요소만) */}
          {showHandle && (
            <View className="items-center pt-3 pb-1 -mt-5 -mx-5 mb-3">
              <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </View>
          )}

          {/* Header */}
          {title && (
            <View className="flex-row items-center justify-between pb-3 -mt-2 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
                {title}
              </Text>
            </View>
          )}

          {/* Content */}
          {scrollable ? (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View className="py-4">{children}</View>
            </ScrollView>
          ) : (
            <View className="py-4">{children}</View>
          )}
        </Modal>
      );
    }

    // ========================================================================
    // 네이티브 환경: @gorhom/bottom-sheet 사용
    // ========================================================================

    // 스냅 포인트 메모이제이션
    const snapPoints = useMemo(
      () => customSnapPoints ?? ['50%', '90%'],
      [customSnapPoints]
    );

    // ref 메서드 노출
    useImperativeHandle(ref, () => ({
      snapToIndex: (index: number) => {
        bottomSheetRef.current?.snapToIndex(index);
      },
      close: () => {
        bottomSheetRef.current?.dismiss();
      },
      expand: () => {
        bottomSheetRef.current?.expand();
      },
      collapse: () => {
        bottomSheetRef.current?.collapse();
      },
      present: () => {
        bottomSheetRef.current?.present();
      },
    }));

    // visible 변경 시 시트 열기/닫기
    useEffect(() => {
      if (visible) {
        bottomSheetRef.current?.present();
      } else {
        bottomSheetRef.current?.dismiss();
      }
    }, [visible]);

    // 시트 닫힘 핸들러
    const handleDismiss = useCallback(() => {
      Keyboard.dismiss();
      onClose();
    }, [onClose]);

    // 백드롭 렌더러
    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior={closeOnBackdrop ? 'close' : 'none'}
          opacity={0.5}
        />
      ),
      [closeOnBackdrop]
    );

    // 핸들 컴포넌트
    const renderHandle = useCallback(() => {
      if (!showHandle) return null;
      return (
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </View>
      );
    }, [showHandle]);

    // 컨텐츠 래퍼 선택
    const ContentWrapper = scrollable ? BottomSheetScrollView : BottomSheetView;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        index={initialSnapIndex}
        snapPoints={snapPoints}
        onDismiss={handleDismiss}
        enablePanDownToClose={enableDragClose}
        backdropComponent={renderBackdrop}
        handleComponent={renderHandle}
        backgroundStyle={[
          styles.background,
          { backgroundColor: isDarkMode ? BACKGROUND_COLORS.dark : BACKGROUND_COLORS.light },
        ]}
        keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        <ContentWrapper style={styles.contentContainer}>
          {/* Header */}
          {(title || showCloseButton) && (
            <View className="flex-row items-center justify-between px-5 pb-3 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
                {title ?? ''}
              </Text>
              {showCloseButton && (
                <Pressable
                  onPress={onClose}
                  className="w-8 h-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                >
                  <XMarkIcon size={18} color={getIconColor(isDarkMode, 'primary')} />
                </Pressable>
              )}
            </View>
          )}

          {/* Content */}
          <View className="flex-1 px-5 py-4">{children}</View>
        </ContentWrapper>
      </BottomSheetModal>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  contentContainer: {
    flex: 1,
  },
});

// ============================================================================
// Preset Components
// ============================================================================

/**
 * 간단한 선택 목록용 BottomSheet
 */
export interface SelectBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ReactNode;
    destructive?: boolean;
    disabled?: boolean;
  }[];
  onSelect: (value: string) => void;
}

export function SelectBottomSheet({
  visible,
  onClose,
  title,
  options,
  onSelect,
}: SelectBottomSheetProps) {
  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
      onClose();
    },
    [onSelect, onClose]
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      snapPoints={['40%']}
      showCloseButton={false}
    >
      <View className="gap-1">
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => !option.disabled && handleSelect(option.value)}
            disabled={option.disabled}
            className={`
              flex-row items-center py-4 px-2 rounded-xl
              ${option.disabled ? 'opacity-50' : 'active:bg-gray-100 dark:active:bg-gray-700'}
            `}
            accessibilityRole="button"
          >
            {option.icon && <View className="mr-3">{option.icon}</View>}
            <Text
              className={`
                text-base font-medium flex-1
                ${option.destructive
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'}
              `}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

export default BottomSheet;
