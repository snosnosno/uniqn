/**
 * UNIQN Mobile - Checkbox 컴포넌트
 *
 * @description 접근성 지원 체크박스 컴포넌트
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ============================================================================
// Types
// ============================================================================

export interface CheckboxProps {
  /** 체크 상태 */
  checked: boolean;
  /** 상태 변경 콜백 */
  onChange: (checked: boolean) => void;
  /** 라벨 텍스트 */
  label?: string;
  /** 설명 텍스트 */
  description?: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 에러 상태 */
  error?: boolean;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
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
    box: 'h-4 w-4',
    icon: 12,
    label: 'text-sm',
    description: 'text-xs',
  },
  md: {
    box: 'h-5 w-5',
    icon: 14,
    label: 'text-base',
    description: 'text-sm',
  },
  lg: {
    box: 'h-6 w-6',
    icon: 18,
    label: 'text-lg',
    description: 'text-base',
  },
};

// ============================================================================
// Component
// ============================================================================

export const Checkbox = memo(function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  error = false,
  errorMessage,
  size = 'md',
  className = '',
  testID,
}: CheckboxProps) {
  const config = sizeConfig[size];

  const handlePress = useCallback(() => {
    if (!disabled) {
      onChange(!checked);
    }
  }, [checked, onChange, disabled]);

  // 박스 스타일 결정
  const getBoxStyle = () => {
    if (disabled) {
      return checked
        ? 'bg-gray-300 dark:bg-surface-elevated border-gray-300 dark:border-surface-overlay'
        : 'bg-gray-100 dark:bg-surface border-gray-300 dark:border-surface-overlay';
    }
    if (error) {
      return checked ? 'bg-red-500 border-red-500' : 'bg-transparent border-red-500';
    }
    return checked
      ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500'
      : 'bg-transparent border-gray-300 dark:border-surface-overlay';
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      // P1 접근성: accessibilityHint 추가
      accessibilityHint={checked ? '선택됨. 두 번 탭하여 선택 해제' : '두 번 탭하여 선택'}
      testID={testID}
      hitSlop={8}
      className={`flex-row items-start ${disabled ? 'opacity-60' : ''} ${className}`}
    >
      {/* Checkbox Box */}
      <View
        className={`
          rounded border-2 items-center justify-center
          ${config.box}
          ${getBoxStyle()}
        `}
      >
        {checked && <Ionicons name="checkmark" size={config.icon} color="white" />}
      </View>

      {/* Label & Description */}
      {(label || description) && (
        <View className="ml-3 flex-1">
          {label && (
            <Text
              className={`
                font-medium
                ${config.label}
                ${disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}
              `}
            >
              {label}
            </Text>
          )}
          {description && (
            <Text
              className={`
                mt-0.5
                ${config.description}
                ${
                  disabled
                    ? // P1 접근성: WCAG AA 준수를 위해 대비 개선
                      'text-gray-500 dark:text-gray-400'
                    : 'text-gray-600 dark:text-gray-400'
                }
              `}
            >
              {description}
            </Text>
          )}
          {error && errorMessage && (
            <Text className={`mt-1 text-red-500 ${config.description}`}>{errorMessage}</Text>
          )}
        </View>
      )}
    </Pressable>
  );
});

// ============================================================================
// Checkbox Group
// ============================================================================

export interface CheckboxGroupProps {
  /** 선택된 값 배열 */
  values: string[];
  /** 변경 콜백 */
  onChange: (values: string[]) => void;
  /** 옵션 목록 */
  options: {
    value: string;
    label: string;
    description?: string;
    disabled?: boolean;
  }[];
  /** 그룹 레이블 */
  label?: string;
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
}

export const CheckboxGroup = memo(function CheckboxGroup({
  values,
  onChange,
  options,
  label,
  error = false,
  errorMessage,
  size = 'md',
  direction = 'vertical',
  className = '',
}: CheckboxGroupProps) {
  const handleToggle = useCallback(
    (value: string, checked: boolean) => {
      if (checked) {
        onChange([...values, value]);
      } else {
        onChange(values.filter((v) => v !== value));
      }
    },
    [values, onChange]
  );

  return (
    <View className={className}>
      {label && <Text className="mb-2 font-medium text-gray-900 dark:text-white">{label}</Text>}
      <View className={direction === 'horizontal' ? 'flex-row flex-wrap gap-4' : 'flex-col gap-3'}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            checked={values.includes(option.value)}
            onChange={(checked) => handleToggle(option.value, checked)}
            label={option.label}
            description={option.description}
            disabled={option.disabled}
            error={error}
            size={size}
          />
        ))}
      </View>
      {error && errorMessage && <Text className="mt-2 text-sm text-red-500">{errorMessage}</Text>}
    </View>
  );
});

export default Checkbox;
