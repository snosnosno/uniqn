/**
 * UNIQN Mobile - FormSelect 컴포넌트
 *
 * @description 선택 필드 컴포넌트 (드롭다운)
 * @version 2.0.0
 *
 * 주요 기능:
 * - 접근성 개선 (WCAG 준수)
 * - 검색 기능 (옵션이 많을 경우)
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import { View, Text, Pressable, Modal, TextInput, type ViewProps } from 'react-native';
import { FlashList } from '@shopify/flash-list';

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
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: item.disabled }}
      accessibilityLabel={`${item.label}${isSelected ? ', 선택됨' : ''}`}
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
  /** 검색 기능 활성화 */
  searchable?: boolean;
  /** 검색 플레이스홀더 */
  searchPlaceholder?: string;
  /** 검색 표시 임계값 (옵션 수가 이 값 이상일 때 검색 표시) */
  searchThreshold?: number;
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
  searchable = false,
  searchPlaceholder = '검색...',
  searchThreshold = 5,
  className,
  ...props
}: FormSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 현재 선택된 옵션 찾기
  const selectedOption = options.find((opt) => opt.value === value);

  // 검색 표시 여부 (searchable이고 옵션 수가 임계값 이상일 때)
  const showSearch = searchable && options.length >= searchThreshold;

  // 필터링된 옵션 목록
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  // 모달 닫기 시 검색어 초기화
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // 옵션 선택 핸들러
  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return;
      onValueChange?.(option.value);
      handleClose();
    },
    [onValueChange, handleClose]
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
        accessibilityLabel={`${label || placeholder}${selectedOption ? `, 현재 선택: ${selectedOption.label}` : ''}`}
        accessibilityHint="탭하여 옵션 선택"
        accessibilityState={{ expanded: isOpen, disabled }}
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
        onRequestClose={handleClose}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={handleClose}
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
                onPress={handleClose}
                className="p-2"
                accessibilityLabel="닫기"
                accessibilityRole="button"
              >
                <Text className="text-gray-500 dark:text-gray-400 text-lg">✕</Text>
              </Pressable>
            </View>

            {/* 검색 입력 */}
            {showSearch && (
              <View className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor="#9CA3AF"
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-base text-gray-900 dark:text-white"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="옵션 검색"
                />
              </View>
            )}

            {/* 옵션 목록 */}
            <FlashList
              data={filteredOptions}
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
                    {searchQuery.trim()
                      ? '검색 결과가 없습니다'
                      : '선택 가능한 옵션이 없습니다'}
                  </Text>
                  {searchQuery.trim() && (
                    <Pressable
                      onPress={() => setSearchQuery('')}
                      className="mt-2 px-4 py-2"
                      accessibilityRole="button"
                      accessibilityLabel="검색어 초기화"
                    >
                      <Text className="text-primary-600 dark:text-primary-400">
                        검색어 초기화
                      </Text>
                    </Pressable>
                  )}
                </View>
              }
              // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
              estimatedItemSize={56}
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
