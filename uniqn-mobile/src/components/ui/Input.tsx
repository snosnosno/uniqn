/**
 * UNIQN Mobile - Input 컴포넌트
 *
 * @description 라벨, 에러, 힌트, 아이콘을 지원하는 텍스트 입력
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState } from 'react';
import { View, TextInput, Text, Pressable, TextInputProps } from 'react-native';
import { EyeIcon, EyeSlashIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Theme Constants
// ============================================================================

const PLACEHOLDER_COLORS = {
  light: SECONDARY_PALETTE[500], // gray-500 (WCAG AA 준수)
  dark: SECONDARY_PALETTE[400], // gray-400 (다크모드에서 더 밝게)
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

export const Input = React.forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, leftIcon, rightIcon, type = 'text', ...props },
  ref
) {
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
      return 'border-primary-500 bg-surface-card';
    }
    return 'border-secondary-300 bg-white dark:border-surface-overlay dark:bg-surface';
  };

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 text-sm font-sans-medium text-content-secondary">{label}</Text>
      )}

      {/* Focus ring wrapper — PressableCard와 동일 idiom: m-[-2px] + border-2 border-transparent */}
      {/* 포커스 시 외곽 border 색만 변경 → layout shift 없는 2px outset info-blue ring */}
      {/* 내부 View는 기존 1px visual border 유지 (error/focused primary/default) */}
      {/* impeccable-design.md §22 Focus ring Info 블루 2px outset */}
      <View
        className={`rounded-lg m-[-2px] border-2 ${isFocused ? 'border-info-500' : 'border-transparent'}`}
      >
        <View
          className={`
            flex-row items-center rounded-lg border px-3
            ${getBorderClass()}
          `}
        >
          {leftIcon && <View className="mr-2">{leftIcon}</View>}

          <TextInput
            ref={ref}
            {...props}
            accessibilityLabel={props.accessibilityLabel ?? label}
            secureTextEntry={isPassword && !showPassword}
            keyboardType={props.keyboardType ?? getKeyboardType()}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            className="flex-1 py-3 text-base font-sans text-content-primary dark:text-secondary-100"
            placeholderTextColor={placeholderColor}
          />

          {isPassword && (
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="p-1"
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
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
      </View>

      {(error || hint) && (
        <Text
          className={`mt-1 text-sm font-sans ${
            // P1 접근성: WCAG AA 준수를 위해 대비 개선 (gray-400 → gray-500)
            error ? 'text-error-500' : 'text-secondary-600 dark:text-secondary-400'
          } font-sans`}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
});
