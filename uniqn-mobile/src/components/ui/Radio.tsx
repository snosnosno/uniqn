/**
 * UNIQN Mobile - Radio 컴포넌트
 *
 * @description 접근성 지원 라디오 버튼 컴포넌트
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { Pressable, View, Text } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioProps {
  /** 현재 선택된 값 */
  value: string | null;
  /** 상태 변경 콜백 */
  onChange: (value: string) => void;
  /** 옵션 목록 */
  options: RadioOption[];
  /** 그룹 레이블 */
  label?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 방향 */
  direction?: 'vertical' | 'horizontal';
  /** 추가 스타일 클래스 */
  className?: string;
  /** 테스트 ID */
  testID?: string;
}

// ============================================================================
// Size Configurations
// ============================================================================

const sizeConfig = {
  sm: {
    outer: 'h-4 w-4',
    inner: 'h-2 w-2',
    label: 'text-sm',
    description: 'text-xs',
  },
  md: {
    outer: 'h-5 w-5',
    inner: 'h-2.5 w-2.5',
    label: 'text-base',
    description: 'text-sm',
  },
  lg: {
    outer: 'h-6 w-6',
    inner: 'h-3 w-3',
    label: 'text-lg',
    description: 'text-base',
  },
};

// ============================================================================
// Single Radio Item
// ============================================================================

interface RadioItemProps {
  option: RadioOption;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
  error: boolean;
  size: 'sm' | 'md' | 'lg';
}

const RadioItem = memo(function RadioItem({
  option,
  selected,
  onSelect,
  disabled,
  error,
  size,
}: RadioItemProps) {
  const config = sizeConfig[size];
  const isDisabled = disabled || option.disabled;

  // 외부 원 스타일 결정
  const getOuterStyle = () => {
    if (isDisabled) {
      return 'border-secondary-300 dark:border-surface-overlay bg-secondary-100 dark:bg-surface';
    }
    if (error) {
      return 'border-error-500';
    }
    if (selected) {
      return 'border-primary-600 dark:border-primary-500';
    }
    return 'border-secondary-300 dark:border-surface-overlay';
  };

  // 내부 원 스타일 결정
  const getInnerStyle = () => {
    if (isDisabled) {
      return 'bg-secondary-400 dark:bg-secondary-500';
    }
    if (error) {
      return 'bg-error-500';
    }
    return 'bg-primary-600 dark:bg-primary-500';
  };

  return (
    <Pressable
      onPress={onSelect}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: isDisabled }}
      accessibilityLabel={option.label}
      // P1 접근성: accessibilityHint 추가
      accessibilityHint={selected ? '선택됨' : '두 번 탭하여 선택'}
      hitSlop={8}
      className={`flex-row items-start ${isDisabled ? 'opacity-60' : ''}`}
    >
      {/* Radio Circle */}
      <View
        className={`
          rounded-sm border-2 items-center justify-center
          ${config.outer}
          ${getOuterStyle()}
        `}
      >
        {selected && (
          <View
            className={`
              rounded-sm
              ${config.inner}
              ${getInnerStyle()}
            `}
          />
        )}
      </View>

      {/* Label & Description */}
      <View className="ml-3 flex-1">
        <Text
          className={`
            font-sans-medium
            ${config.label}
            ${isDisabled ? 'text-secondary-400 dark:text-secondary-500' : 'text-secondary-900 dark:text-off-white'}
          `}
        >
          {option.label}
        </Text>
        {option.description && (
          <Text
            className={`
              mt-0.5
              ${config.description}
              ${
                isDisabled
                  ? // P1 접근성: WCAG AA 준수를 위해 대비 개선
                    'text-secondary-500 dark:text-secondary-500'
                  : 'text-secondary-600 dark:text-secondary-400'
              }
             font-sans`}
          >
            {option.description}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

// ============================================================================
// Radio Group Component
// ============================================================================

export const Radio = memo(function Radio({
  value,
  onChange,
  options,
  label,
  disabled = false,
  error = false,
  errorMessage,
  size = 'md',
  direction = 'vertical',
  className = '',
  testID,
}: RadioProps) {
  const handleSelect = useCallback(
    (optionValue: string) => {
      if (!disabled) {
        onChange(optionValue);
      }
    },
    [onChange, disabled]
  );

  return (
    <View
      className={className}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      testID={testID}
    >
      {label && (
        <Text className="mb-2 font-sans-medium text-secondary-900 dark:text-off-white">
          {label}
        </Text>
      )}

      <View className={direction === 'horizontal' ? 'flex-row flex-wrap gap-4' : 'flex-col gap-3'}>
        {options.map((option) => (
          <RadioItem
            key={option.value}
            option={option}
            selected={value === option.value}
            onSelect={() => handleSelect(option.value)}
            disabled={disabled}
            error={error}
            size={size}
          />
        ))}
      </View>

      {error && errorMessage && (
        <Text className="mt-2 text-sm text-error-600 font-sans">{errorMessage}</Text>
      )}
    </View>
  );
});

export default Radio;
