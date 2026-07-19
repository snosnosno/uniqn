/**
 * UNIQN Mobile - ActionSheet 컴포넌트
 *
 * @description iOS 스타일 하단 액션 시트
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Modal } from './Modal';

// ============================================================================
// Types
// ============================================================================

export interface ActionSheetOption {
  /** 옵션 라벨 */
  label: string;
  /** 옵션 값 (onSelect에 전달) */
  value: string;
  /** 아이콘 (선택) */
  icon?: React.ReactNode;
  /** 파괴적 액션 여부 (빨간색 표시) */
  destructive?: boolean;
  /** 비활성화 여부 */
  disabled?: boolean;
}

export interface ActionSheetProps {
  /** 표시 여부 */
  visible: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 제목 (선택) */
  title?: string;
  /** 설명 (선택) */
  description?: string;
  /** 옵션 목록 */
  options: ActionSheetOption[];
  /** 옵션 선택 핸들러 */
  onSelect: (value: string) => void;
  /** 취소 버튼 텍스트 */
  cancelText?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ActionSheet({
  visible,
  onClose,
  title,
  description,
  options,
  onSelect,
  cancelText = '취소',
}: ActionSheetProps) {
  const handleSelect = (value: string) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      position="bottom"
      showCloseButton={false}
      closeOnBackdrop={true}
    >
      {/* Header */}
      {(title || description) && (
        <View className="items-center pb-4 mb-2 border-b border-divider">
          {title && (
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              {title}
            </Text>
          )}
          {description && (
            <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400 text-center font-sans">
              {description}
            </Text>
          )}
        </View>
      )}

      {/* Options */}
      <View className="gap-1">
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => !option.disabled && handleSelect(option.value)}
            disabled={option.disabled}
            className={`
              flex-row items-center justify-center py-4 rounded-md
              ${option.disabled ? 'opacity-50' : 'active:bg-secondary-100 dark:active:bg-secondary-700'}
            `}
            accessibilityRole="button"
            accessibilityLabel={option.label}
          >
            {option.icon && <View className="mr-2">{option.icon}</View>}
            <Text
              className={`
                text-base font-sans-medium
                ${
                  option.destructive
                    ? 'text-error-600 dark:text-error-400'
                    : 'text-content-primary dark:text-content-primary'
                }
                ${option.disabled ? 'text-secondary-400 dark:text-secondary-600' : ''}
              `}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Cancel Button */}
      <View className="mt-4 pt-4 border-t border-divider">
        <Pressable
          onPress={onClose}
          className="items-center justify-center py-4 rounded-md bg-surface-card dark:bg-surface active:bg-secondary-200 dark:active:bg-secondary-600"
          accessibilityRole="button"
          accessibilityLabel={cancelText}
        >
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
            {cancelText}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}
