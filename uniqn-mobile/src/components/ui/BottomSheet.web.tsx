import React, { useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Modal } from './Modal';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  showHandle?: boolean;
  snapPoints?: (string | number)[];
  initialSnapIndex?: number;
  enableDragClose?: boolean;
  closeOnBackdrop?: boolean;
  scrollable?: boolean;
  children: React.ReactNode;
}

export interface BottomSheetRef {
  snapToIndex: (index: number) => void;
  close: () => void;
  expand: () => void;
  collapse: () => void;
  present: () => void;
}

export const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      visible,
      onClose,
      title,
      showCloseButton = true,
      showHandle = true,
      closeOnBackdrop = true,
      scrollable = false,
      children,
    },
    ref
  ) => {
    useImperativeHandle(ref, () => ({
      snapToIndex: () => {
        // Web modal does not support snap points.
      },
      close: onClose,
      expand: () => {
        // Web modal does not support expand.
      },
      collapse: () => {
        // Web modal does not support collapse.
      },
      present: () => {
        // Visibility is controlled by props.
      },
    }));

    return (
      <Modal
        visible={visible}
        onClose={onClose}
        position="bottom"
        showCloseButton={showCloseButton}
        closeOnBackdrop={closeOnBackdrop}
      >
        {showHandle ? (
          <View className="items-center pt-3 pb-1 -mt-5 -mx-5 mb-3">
            <View className="w-10 h-1 rounded-sm bg-secondary-300 dark:bg-surface-elevated" />
          </View>
        ) : null}

        {title ? (
          <View className="flex-row items-center justify-between pb-3 -mt-2 border-b border-divider">
            <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white flex-1">
              {title}
            </Text>
          </View>
        ) : null}

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
);

BottomSheet.displayName = 'BottomSheet';

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
  /** 스냅 포인트(기본 ['40%'] — 기존 호출부 무영향). 웹 모달은 스냅 미지원이라 시각 무영향. */
  snapPoints?: string[];
  /** 목록 스크롤 활성화(기본 false — 기존 호출부 무영향). */
  scrollable?: boolean;
}

export function SelectBottomSheet({
  visible,
  onClose,
  title,
  options,
  onSelect,
  snapPoints = ['40%'],
  scrollable = false,
}: SelectBottomSheetProps) {
  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
      onClose();
    },
    [onClose, onSelect]
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      snapPoints={snapPoints}
      scrollable={scrollable}
      showCloseButton={false}
    >
      <View className="gap-1">
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!option.disabled) {
                handleSelect(option.value);
              }
            }}
            disabled={option.disabled}
            className={`
              flex-row items-center py-4 px-2 rounded-md
              ${option.disabled ? 'opacity-50' : 'active:bg-secondary-100 dark:active:bg-secondary-700'}
            `}
            accessibilityRole="button"
          >
            {option.icon ? <View className="mr-3">{option.icon}</View> : null}
            <Text
              className={`
                text-base font-sans-medium flex-1
                ${
                  option.destructive ? 'text-error-600 dark:text-error-400' : 'text-content-primary'
                }
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
