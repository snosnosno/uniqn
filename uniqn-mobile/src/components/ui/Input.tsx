/**
 * UNIQN Mobile - Input 컴포넌트
 *
 * @description 라벨, 에러, 힌트, 아이콘을 지원하는 텍스트 입력
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, TextInputProps } from 'react-native';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Theme Constants
// ============================================================================

const PLACEHOLDER_COLORS = {
  light: '#6B7280', // gray-500 (WCAG AA 준수)
  dark: '#9CA3AF',  // gray-400 (다크모드에서 더 밝게)
} as const;

type InputType = 'text' | 'email' | 'password' | 'number' | 'phone';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  type?: InputType;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  type = 'text',
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const isPassword = type === 'password';
  const placeholderColor = isDarkMode ? PLACEHOLDER_COLORS.dark : PLACEHOLDER_COLORS.light;

  const getKeyboardType = (): TextInputProps['keyboardType'] => {
    switch (type) {
      case 'email':
        return 'email-address';
      case 'number':
        return 'numeric';
      case 'phone':
        return 'phone-pad';
      default:
        return 'default';
    }
  };

  const getBorderClass = () => {
    if (error) {
      return 'border-error-500 bg-error-50 dark:bg-error-900/20';
    }
    if (isFocused) {
      return 'border-primary-500 bg-white dark:bg-surface';
    }
    return 'border-gray-300 bg-white dark:border-surface-overlay dark:bg-surface';
  };

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </Text>
      )}

      <View
        className={`
          flex-row items-center rounded-lg border px-3
          ${getBorderClass()}
        `}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}

        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          secureTextEntry={isPassword && !showPassword}
          keyboardType={getKeyboardType()}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className="flex-1 py-3 text-base text-gray-900 dark:text-gray-100"
          placeholderTextColor={placeholderColor}
        />

        {isPassword && (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            className="p-1"
            hitSlop={8}
          >
            {showPassword ? (
              <EyeSlashIcon size={20} color={placeholderColor} />
            ) : (
              <EyeIcon size={20} color={placeholderColor} />
            )}
          </Pressable>
        )}

        {rightIcon && !isPassword && <View className="ml-2">{rightIcon}</View>}
      </View>

      {(error || hint) && (
        <Text
          className={`mt-1 text-sm ${
            // P1 접근성: WCAG AA 준수를 위해 대비 개선 (gray-400 → gray-500)
            error ? 'text-error-500' : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}

export default Input;
