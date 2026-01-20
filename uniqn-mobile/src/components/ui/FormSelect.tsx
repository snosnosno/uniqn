/**
 * UNIQN Mobile - FormSelect 컴포넌트
 *
 * @description 선택 필드 컴포넌트 (드롭다운)
 * @version 1.0.0
 *
 * TODO [출시 전]: 접근성 개선 - accessibilityRole, accessibilityState 추가
 * TODO [출시 전]: 검색 기능 추가 (옵션이 많을 경우)
 */

import React, { useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  type ViewProps,
} from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

interface SelectOptionItemProps<T> {
  item: SelectOption<T>;
  isSelected: boolean;
  onSelect: (option: SelectOption<T>) => void;
}

// ============================================================================
// SelectOptionItem Component (메모이제이션)
// ============================================================================

function SelectOptionItemComponent<T>({
  item,
  isSelected,
  onSelect,
}: SelectOptionItemProps<T>) {
  const handlePress = useCallback(() => {
    if (!item.disabled) {
      onSelect(item);
    }
  }, [item, onSelect]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={item.disabled}
      className={`
        px-4 py-4 border-b border-gray-100 dark:border-gray-700
        ${item.disabled ? 'opacity-50' : 'active:bg-gray-100 dark:active:bg-gray-700'}
        ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''}
      `}
    >
      <View className="flex-row items-center justify-between">
        <Text
          className={`text-base ${
            isSelected
              ? 'text-primary-600 dark:text-primary-400 font-medium'
              : 'text-gray-900 dark:text-white'
          } ${item.disabled ? 'text-gray-400' : ''}`}
        >
          {item.label}
        </Text>
        {isSelected && (
          <Text className="text-primary-600 dark:text-primary-400">✓</Text>
        )}
      </View>
    </Pressable>
  );
}

const SelectOptionItem = memo(SelectOptionItemComponent) as typeof SelectOptionItemComponent;

interface FormSelectProps<T = string> extends Omit<ViewProps, 'children'> {
  /** 선택 옵션 목록 */
  options: SelectOption<T>[];
  /** 현재 선택된 값 */
  value?: T | null;
  /** 값 변경 콜백 */
  onValueChange?: (value: T) => void;
  /** 플레이스홀더 텍스트 */
  placeholder?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 레이블 */
  label?: string;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 필수 여부 */
  required?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function FormSelect<T = string>({
  options,
  value,
  onValueChange,
  placeholder = '선택해주세요',
  disabled = false,
  error = false,
  label,
  errorMessage,
  required = false,
  className,
  ...props
}: FormSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  // 현재 선택된 옵션 찾기
  const selectedOption = options.find((opt) => opt.value === value);

  // 옵션 선택 핸들러
  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return;
      onValueChange?.(option.value);
      setIsOpen(false);
    },
    [onValueChange]
  );

  // 스타일 계산
  const getBorderStyle = () => {
    if (error || errorMessage) return 'border-red-500';
    if (disabled) return 'border-gray-200 dark:border-gray-700';
    return 'border-gray-300 dark:border-gray-600';
  };

  const getTextStyle = () => {
    if (disabled) return 'text-gray-400 dark:text-gray-500';
    if (!selectedOption) return 'text-gray-400 dark:text-gray-500';
    return 'text-gray-900 dark:text-white';
  };

  return (
    <View className={`mb-4 ${className || ''}`} {...props}>
      {/* 레이블 */}
      {label && (
        <View className="flex-row mb-2">
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </Text>
          {required && <Text className="text-red-500 ml-0.5">*</Text>}
        </View>
      )}

      {/* 선택 버튼 */}
      <Pressable
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`
          flex-row items-center justify-between
          px-4 py-3 rounded-lg border
          bg-white dark:bg-gray-800
          ${getBorderStyle()}
          ${disabled ? 'opacity-50' : 'active:bg-gray-50 dark:active:bg-gray-700'}
        `}
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        accessibilityHint="탭하여 옵션 선택"
      >
        <Text className={`text-base ${getTextStyle()}`}>
          {selectedOption?.label || placeholder}
        </Text>
        <Text className="text-gray-400 dark:text-gray-500">▼</Text>
      </Pressable>

      {/* 에러 메시지 */}
      {errorMessage && (
        <View className="flex-row items-center mt-1.5">
          <Text className="text-red-500 mr-1">⚠</Text>
          <Text className="text-red-500 text-sm flex-1">{errorMessage}</Text>
        </View>
      )}

      {/* 옵션 모달 */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            className="bg-white dark:bg-gray-800 rounded-t-2xl max-h-[70%]"
            onPress={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                {label || '선택'}
              </Text>
              <Pressable
                onPress={() => setIsOpen(false)}
                className="p-2"
                accessibilityLabel="닫기"
              >
                <Text className="text-gray-500 dark:text-gray-400 text-lg">✕</Text>
              </Pressable>
            </View>

            {/* 옵션 목록 */}
            <FlatList
              data={options}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              renderItem={({ item }) => (
                <SelectOptionItem
                  item={item}
                  isSelected={item.value === value}
                  onSelect={handleSelect}
                />
              )}
              ListEmptyComponent={
                <View className="py-8 items-center">
                  <Text className="text-gray-500 dark:text-gray-400">
                    선택 가능한 옵션이 없습니다
                  </Text>
                </View>
              }
            />

            {/* 하단 여백 (SafeArea) */}
            <View className="h-8" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default FormSelect;
